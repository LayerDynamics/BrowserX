/**
 * Query executor
 * Executes execution plans
 */

// Import ExecutionPlan and ExecutionStep from types
import { ExecutionPlan, ExecutionStep } from "../types/mod.ts";

// Import step types from planner
import {
  AssignStep,
  BranchStep,
  CacheLookupStep,
  CacheRetrieveStep,
  CacheStoreStep,
  ClickStep,
  DOMQueryStep,
  EvaluateJSStep,
  ExecutionContext,
  ExecutionStepType,
  FilterStep,
  InterceptRequestStep,
  JoinStep,
  LimitStep,
  LoopStep,
  MapStep,
  ModifyRequestStep,
  NavigateStep,
  ParallelStep,
  PDFStep,
  ReadVariableStep,
  ReduceStep,
  ScreenshotStep,
  SequentialStep,
  SortStep,
  StepResult,
  TypeStep,
  WaitStep,
  WriteVariableStep,
} from "../planner/mod.ts";
import { QueryID } from "../types/primitives.ts";
import { EvaluationContext, ExpressionEvaluator } from "./expression-evaluator.ts";
import { BrowserController } from "../controllers/browser/browser-controller.ts";
import { clearBrowserContext, withBrowserContext } from "../controllers/browser/browser-context.ts";
import { ProxyController } from "../controllers/proxy/proxy-controller.ts";
import { ExecutionContextManager, StateManager } from "../state/mod.ts";
import { type DependencyGraph, toBoolean, topologicalSort } from "../utils/mod.ts";
import { isSafeRegex } from "../utils/string-utils.ts";

/** Dangerous header keys that could cause prototype pollution */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Sanitize headers by filtering out prototype pollution keys
 */
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !DANGEROUS_KEYS.has(key))
  );
}

/** Maximum number of loop iterations (default) */
export const MAX_ITERATIONS = 10000;

/** Maximum result set size */
export const MAX_RESULT_SIZE = 100000;

/**
 * Execution options
 */
export interface ExecutionOptions {
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
  /** Maximum iterations for FOR loops (default: MAX_ITERATIONS) */
  maxIterations?: number;
  /** Maximum result set rows (default: MAX_RESULT_SIZE) */
  maxResultSize?: number;
}

/**
 * Per-execution state — isolated per execute() call to avoid shared mutable state
 * when concurrent callers invoke execute() on the same QueryExecutor instance.
 */
interface PerExecutionState {
  signal?: AbortSignal;
  maxIterations: number;
  maxResultSize: number;
  contextManager?: ExecutionContextManager;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  queryId: QueryID;
  data: unknown;
  success: boolean;
  error?: Error;
  timing: {
    startTime: number;
    endTime: number;
    totalTime: number;
  };
  stepResults: Map<string, StepResult>;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Query executor
 */
export class QueryExecutor {
  private browserController?: BrowserController;
  private proxyController?: ProxyController;
  private stateManager: StateManager;

  constructor(
    browserController?: BrowserController,
    proxyController?: ProxyController,
    stateManager?: StateManager,
  ) {
    this.browserController = browserController;
    this.proxyController = proxyController;
    this.stateManager = stateManager || new StateManager();
  }

  /**
   * Execute an execution plan
   */
  async execute(plan: ExecutionPlan, options: ExecutionOptions = {}): Promise<ExecutionResult> {
    const startTime = performance.now();
    const signal = options.signal;

    // Per-execution state — isolated from other concurrent execute() calls
    const execState: PerExecutionState = {
      signal,
      maxIterations: options.maxIterations ?? MAX_ITERATIONS,
      maxResultSize: options.maxResultSize ?? MAX_RESULT_SIZE,
    };

    // Check if already aborted
    if (signal?.aborted) {
      throw signal.reason || new Error("Query aborted");
    }

    // Create execution context using StateManager
    const contextManager = this.stateManager.createExecutionContext(plan.id);
    execState.contextManager = contextManager;
    // Convert to legacy format for backward compatibility
    const context: ExecutionContext = contextManager.toLegacyContext();

    // Execute the query body, wrapping in AsyncLocalStorage-based browser context
    // if a browser controller is available (concurrency-safe isolation).
    // Falls back to singleton set/clear for legacy code paths without a controller.
    const executeBody = async (): Promise<ExecutionResult> => {
      let cacheHits = 0;
      let cacheMisses = 0;

      try {
        // Get topological order for sequential execution
        const order = this.getExecutionOrder(plan);

        // Execute steps in order
        for (const stepId of order) {
          // Check abort signal before each step
          if (signal?.aborted) {
            throw signal.reason || new Error("Query aborted during execution");
          }

          const step = plan.steps.find((s: ExecutionStep) => s.id === stepId);
          if (!step) continue;

          // Check cache
          if (step.cacheable && step.cacheKey) {
            const cached = context.cache!.get(step.cacheKey);
            if (cached) {
              cacheHits++;
              context.stepResults.set(stepId, {
                stepId,
                success: true,
                data: cached,
                timing: {
                  startTime: performance.now(),
                  endTime: performance.now(),
                  duration: 0,
                },
                cacheHit: true,
              });
              continue;
            } else {
              cacheMisses++;
            }
          }

          // Execute step
          const result = await this.executeStep(step, context, execState);
          context.stepResults.set(stepId, result);

          // Store in cache if cacheable
          if (step.cacheable && step.cacheKey && result.success) {
            context.cache!.set(step.cacheKey, result.data);
          }

          // If step failed and is critical, stop execution
          if (!result.success) {
            throw result.error || new Error(`Step ${stepId} failed`);
          }
        }

        const endTime = performance.now();

        // Get final result from last step
        const lastStepId = order[order.length - 1];
        const lastResult = context.stepResults.get(lastStepId);

        return {
          queryId: plan.id,
          data: lastResult?.data,
          success: true,
          timing: {
            startTime,
            endTime,
            totalTime: endTime - startTime,
          },
          stepResults: context.stepResults,
          cacheHits,
          cacheMisses,
        };
      } catch (error) {
        const endTime = performance.now();

        return {
          queryId: plan.id,
          data: null,
          success: false,
          error: error as Error,
          timing: {
            startTime,
            endTime,
            totalTime: endTime - startTime,
          },
          stepResults: context.stepResults,
          cacheHits,
          cacheMisses,
        };
      }
    };

    // Use AsyncLocalStorage-based context for concurrency-safe browser isolation
    try {
      if (this.browserController) {
        return await withBrowserContext(this.browserController, executeBody);
      }

      // No browser controller — execute without browser context
      return await executeBody();
    } finally {
      // Clear singleton fallback that may have been set by executeNavigate/executeDOMQuery
      clearBrowserContext();
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: ExecutionStep,
    context: ExecutionContext,
    execState?: PerExecutionState,
  ): Promise<StepResult> {
    const startTime = performance.now();
    const signal = execState?.signal;

    // Check if aborted before executing step
    if (signal?.aborted) {
      throw signal.reason || new Error("Query aborted during execution");
    }

    try {
      let data: unknown = null;

      switch (step.type) {
        case ExecutionStepType.NAVIGATE:
          data = await this.executeNavigate(step as NavigateStep, context, { signal });
          break;

        case ExecutionStepType.DOM_QUERY:
          data = await this.executeDOMQuery(step as DOMQueryStep, context, { signal }, execState);
          break;

        case ExecutionStepType.CLICK:
          data = await this.executeClick(step as ClickStep, context, { signal });
          break;

        case ExecutionStepType.TYPE:
          data = await this.executeType(step as TypeStep, context, { signal });
          break;

        case ExecutionStepType.WAIT:
          data = await this.executeWait(step as WaitStep, context, { signal });
          break;

        case ExecutionStepType.SCREENSHOT:
          data = await this.executeScreenshot(step as ScreenshotStep, context, { signal });
          break;

        case ExecutionStepType.PDF:
          data = await this.executePDF(step as PDFStep, context, { signal });
          break;

        case ExecutionStepType.EVALUATE_JS:
          data = await this.executeEvaluateJS(step as EvaluateJSStep, context, { signal });
          break;

        case ExecutionStepType.INTERCEPT_REQUEST:
          data = await this.executeInterceptRequest(step as InterceptRequestStep, context);
          break;

        case ExecutionStepType.MODIFY_REQUEST:
          data = await this.executeModifyRequest(step as ModifyRequestStep, context);
          break;

        case ExecutionStepType.CACHE_LOOKUP:
          data = await this.executeCacheLookup(step as CacheLookupStep, context);
          break;

        case ExecutionStepType.CACHE_RETRIEVE:
          data = await this.executeCacheRetrieve(step as CacheRetrieveStep, context);
          break;

        case ExecutionStepType.CACHE_STORE:
          data = await this.executeCacheStore(step as CacheStoreStep, context);
          break;

        case ExecutionStepType.FILTER:
          data = await this.executeFilter(step as FilterStep, context, execState);
          break;

        case ExecutionStepType.MAP:
          data = await this.executeMap(step as MapStep, context, execState);
          break;

        case ExecutionStepType.REDUCE:
          data = await this.executeReduce(step as ReduceStep, context);
          break;

        case ExecutionStepType.JOIN:
          data = await this.executeJoin(step as JoinStep, context, execState);
          break;

        case ExecutionStepType.SORT:
          data = await this.executeSort(step as SortStep, context);
          break;

        case ExecutionStepType.LIMIT:
          data = await this.executeLimit(step as LimitStep, context);
          break;

        case ExecutionStepType.BRANCH:
          data = await this.executeBranch(step as BranchStep, context, execState);
          break;

        case ExecutionStepType.LOOP:
          data = await this.executeLoop(step as LoopStep, context, execState);
          break;

        case ExecutionStepType.PARALLEL:
          data = await this.executeParallel(step as ParallelStep, context, execState);
          break;

        case ExecutionStepType.SEQUENTIAL:
          data = await this.executeSequential(step as SequentialStep, context, execState);
          break;

        case ExecutionStepType.ASSIGN:
          data = await this.executeAssign(step as AssignStep, context);
          break;

        case ExecutionStepType.READ_VARIABLE:
          data = await this.executeReadVariable(step as ReadVariableStep, context);
          break;

        case ExecutionStepType.WRITE_VARIABLE:
          data = await this.executeWriteVariable(step as WriteVariableStep, context);
          break;

        default: {
          // Exhaustive type check: if we add a new step type but don't handle it,
          // TypeScript will give a compile error because the unhandled type can't be assigned to never
          const _exhaustiveCheck: never = step;
          throw new Error(`Unhandled step type: ${(_exhaustiveCheck as any).type}`);
        }
      }

      const endTime = performance.now();

      return {
        stepId: step.id,
        success: true,
        data,
        timing: {
          startTime,
          endTime,
          duration: endTime - startTime,
        },
      };
    } catch (error) {
      const endTime = performance.now();

      return {
        stepId: step.id,
        success: false,
        error: error as Error,
        timing: {
          startTime,
          endTime,
          duration: endTime - startTime,
        },
      };
    }
  }

  /**
   * Execute navigate step
   */
  private async executeNavigate(
    step: NavigateStep,
    context: ExecutionContext,
    options?: { signal?: AbortSignal },
  ): Promise<unknown> {
    // Use browser controller to execute navigation
    if (!this.browserController) {
      // Create browser controller on demand if not provided
      throw new Error("Browser engine not configured - call setBrowserController() before executing browser operations");
    }

    // Evaluate URL at runtime if it's an expression
    let resolvedUrl = step.url;
    if (!resolvedUrl && step.urlExpression) {
      const evalContext: EvaluationContext = {
        variables: context.variables,
        functions: new Map(),
      };
      const evaluator = new ExpressionEvaluator(evalContext);
      resolvedUrl = await evaluator.evaluate(step.urlExpression) as string;
    }

    // Create a step with the resolved URL for the browser controller
    const resolvedStep = { ...step, url: resolvedUrl };

    // Store the page reference in context for subsequent operations
    context.currentBrowser = this.browserController;

    const result = await this.browserController.executeNavigate(resolvedStep, options);

    return result;
  }

  /**
   * Execute DOM query step
   */
  private async executeDOMQuery(
    step: DOMQueryStep,
    context: ExecutionContext,
    options?: { signal?: AbortSignal },
    execState?: PerExecutionState,
  ): Promise<unknown> {
    const maxResultSize = execState?.maxResultSize ?? MAX_RESULT_SIZE;
    // Use browser controller to execute DOM query
    if (!this.browserController) {
      // Create browser controller on demand if not provided
      throw new Error("Browser engine not configured - call setBrowserController() before executing browser operations");
    }

    // Execute the DOM query step which returns extracted data
    const results = await this.browserController.executeDOMQuery(step, options);

    // Enforce result set size limit
    if (Array.isArray(results) && results.length > maxResultSize) {
      throw new Error(
        `Result set size limit exceeded: ${results.length} rows, maximum is ${maxResultSize}`,
      );
    }

    // Store results in execution context for downstream steps
    context.variables.set("__lastQueryResult", results);
    return results;
  }

  /**
   * Execute filter step
   */
  private async executeFilter(
    step: FilterStep,
    context: ExecutionContext,
    execState?: PerExecutionState,
  ): Promise<unknown> {
    const input = context.variables.get(step.inputVariable);

    if (!Array.isArray(input)) {
      throw new Error(`Filter input must be an array`);
    }

    // Create evaluation context
    const evalContext: EvaluationContext = {
      variables: context.variables,
      functions: new Map(), // Built-in functions are handled by ExpressionEvaluator
    };

    const evaluator = new ExpressionEvaluator(evalContext);

    // Filter array by evaluating predicate for each item
    const filtered: unknown[] = [];
    for (const item of input) {
      // Set current item as the row being evaluated
      evaluator.setContext({ currentRow: item as Record<string, unknown> });

      // Evaluate predicate and convert to boolean
      const result = await evaluator.evaluate(step.predicate);
      if (toBoolean(result)) {
        filtered.push(item);
      }
    }

    this.enforceResultSizeLimit(filtered, execState);
    context.variables.set(step.outputVariable, filtered);
    return filtered;
  }

  /**
   * Execute sort step
   */
  private async executeSort(
    step: SortStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    const input = context.variables.get(step.inputVariable);

    if (!Array.isArray(input)) {
      throw new Error(`Sort input must be an array`);
    }

    // Create a copy to avoid mutating original array
    const sorted = [...input];

    // Implement multi-field sorting
    sorted.sort((a, b) => {
      for (const sortField of step.fields) {
        const aValue = typeof a === "object" && a !== null
          ? (a as Record<string, unknown>)[sortField.field]
          : a;
        const bValue = typeof b === "object" && b !== null
          ? (b as Record<string, unknown>)[sortField.field]
          : b;

        let comparison = 0;

        // Handle null/undefined
        if (aValue === null || aValue === undefined) {
          comparison = bValue === null || bValue === undefined ? 0 : -1;
        } else if (bValue === null || bValue === undefined) {
          comparison = 1;
        } // Compare numbers
        else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } // Compare strings
        else if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue);
        } // Compare booleans
        else if (typeof aValue === "boolean" && typeof bValue === "boolean") {
          comparison = aValue === bValue ? 0 : (aValue ? 1 : -1);
        } // Fallback to string comparison
        else {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        // Apply direction (ASC or DESC)
        if (comparison !== 0) {
          return sortField.direction === "DESC" ? -comparison : comparison;
        }

        // If values are equal, continue to next sort field
      }

      return 0; // All fields are equal
    });

    context.variables.set(step.outputVariable, sorted);
    return sorted;
  }

  /**
   * Execute limit step
   */
  private async executeLimit(
    step: LimitStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    const input = context.variables.get(step.inputVariable);

    if (!Array.isArray(input)) {
      throw new Error(`Limit input must be an array`);
    }

    const offset = step.offset || 0;
    const limited = input.slice(offset, offset + step.limit);

    context.variables.set(step.outputVariable, limited);
    return limited;
  }

  /**
   * Execute branch step
   */
  private async executeBranch(
    step: BranchStep,
    context: ExecutionContext,
    execState?: PerExecutionState,
  ): Promise<unknown> {
    // Create evaluation context
    const evalContext: EvaluationContext = {
      variables: context.variables,
      functions: new Map(),
    };

    const evaluator = new ExpressionEvaluator(evalContext);

    // Evaluate condition expression
    const conditionResult = await evaluator.evaluate(step.condition);

    // Convert to boolean using centralized toBoolean() for consistent semantics
    const conditionValue = toBoolean(conditionResult);

    const stepsToExecute = conditionValue ? step.thenSteps : (step.elseSteps || []);

    let result: unknown = null;

    for (const branchStep of stepsToExecute) {
      const stepResult = await this.executeStep(branchStep, context, execState);
      context.stepResults.set(branchStep.id, stepResult);
      result = stepResult.data;

      if (!stepResult.success) {
        throw stepResult.error || new Error(`Branch step ${branchStep.id} failed`);
      }
    }

    return result;
  }

  /**
   * Execute loop step
   */
  private async executeLoop(
    step: LoopStep,
    context: ExecutionContext,
    execState?: PerExecutionState,
  ): Promise<unknown> {
    // First try to get collection from variables, then evaluate expression
    let collection = context.variables.get(step.collectionVariable);

    if (collection === undefined && step.collectionExpression) {
      // Create evaluation context
      const evalContext: EvaluationContext = {
        variables: context.variables,
        functions: new Map(),
      };

      const evaluator = new ExpressionEvaluator(evalContext);

      // Evaluate the collection expression
      collection = await evaluator.evaluate(step.collectionExpression);
    }

    if (!Array.isArray(collection)) {
      throw new Error(`Loop collection must be an array`);
    }

    const maxIterations = execState?.maxIterations ?? MAX_ITERATIONS;
    const ctxManager = execState?.contextManager;

    if (collection.length > maxIterations) {
      throw new Error(
        `FOR loop iteration limit exceeded: collection has ${collection.length} items, maximum is ${maxIterations}`,
      );
    }

    const results: unknown[] = [];
    let iterationCount = 0;

    for (const item of collection) {
      iterationCount++;
      if (iterationCount > maxIterations) {
        throw new Error(
          `FOR loop iteration limit exceeded: ${maxIterations} iterations`,
        );
      }
      // Push new scope for loop iteration (enables variable shadowing)
      if (ctxManager) {
        ctxManager.pushScope();
      }

      context.variables.set(step.iteratorVariable, item);

      for (const loopStep of step.bodySteps) {
        const stepResult = await this.executeStep(loopStep, context, execState);
        context.stepResults.set(loopStep.id, stepResult);

        if (!stepResult.success) {
          // Pop scope before throwing
          if (ctxManager) {
            ctxManager.popScope();
          }
          throw stepResult.error || new Error(`Loop step ${loopStep.id} failed`);
        }
      }

      results.push(context.variables.get(step.iteratorVariable));

      // Pop scope after loop iteration
      if (ctxManager) {
        ctxManager.popScope();
      }
    }

    return results;
  }

  /**
   * Execute assign step
   */
  private async executeAssign(
    step: AssignStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Create evaluation context
    const evalContext: EvaluationContext = {
      variables: context.variables,
      functions: new Map(),
    };

    const evaluator = new ExpressionEvaluator(evalContext);

    // Evaluate the assignment expression
    const value = await evaluator.evaluate(step.value);

    context.variables.set(step.variable, value);
    return value;
  }

  /**
   * Execute click step
   */
  private async executeClick(
    step: ClickStep,
    context: ExecutionContext,
    options?: { signal?: AbortSignal },
  ): Promise<unknown> {
    // Use browser controller to execute click
    if (!this.browserController) {
      throw new Error("Browser engine not configured - call setBrowserController() before executing browser operations");
    }

    await this.browserController.executeClick(step, options);
    context.variables.set("__lastAction", "click");
    return { clicked: true, selector: step.selector };
  }

  /**
   * Execute type step
   */
  private async executeType(
    step: TypeStep,
    context: ExecutionContext,
    options?: { signal?: AbortSignal },
  ): Promise<unknown> {
    // Use browser controller to execute type
    if (!this.browserController) {
      throw new Error("Browser engine not configured - call setBrowserController() before executing browser operations");
    }

    await this.browserController.executeType(step, options);
    context.variables.set("__lastAction", "type");
    return { typed: true, selector: step.selector, text: step.text };
  }

  /**
   * Execute wait step
   */
  private async executeWait(
    step: WaitStep,
    context: ExecutionContext,
    options?: { signal?: AbortSignal },
  ): Promise<unknown> {
    // Use browser controller to execute wait
    if (!this.browserController) {
      throw new Error("Browser engine not configured - call setBrowserController() before executing browser operations");
    }

    await this.browserController.executeWait(step, options);
    context.variables.set("__lastAction", "wait");
    return { waited: true, waitType: step.waitType };
  }

  /**
   * Execute screenshot step
   */
  private async executeScreenshot(
    step: ScreenshotStep,
    context: ExecutionContext,
    options?: { signal?: AbortSignal },
  ): Promise<unknown> {
    // Use browser controller to execute screenshot
    if (!this.browserController) {
      throw new Error("Browser engine not configured - call setBrowserController() before executing browser operations");
    }

    const screenshot = await this.browserController.executeScreenshot(step, options);
    context.variables.set("__lastScreenshot", screenshot);
    return screenshot;
  }

  /**
   * Execute PDF step
   */
  private async executePDF(
    step: PDFStep,
    context: ExecutionContext,
    options?: { signal?: AbortSignal },
  ): Promise<unknown> {
    // Use browser controller to execute PDF generation
    if (!this.browserController) {
      throw new Error("Browser engine not configured - call setBrowserController() before executing browser operations");
    }

    const pdf = await this.browserController.executePDF(step, options);
    context.variables.set("__lastPDF", pdf);
    return pdf;
  }

  /**
   * Execute JavaScript evaluation step
   */
  private async executeEvaluateJS(
    step: EvaluateJSStep,
    context: ExecutionContext,
    options?: { signal?: AbortSignal },
  ): Promise<unknown> {
    // Use browser controller to execute JavaScript
    if (!this.browserController) {
      throw new Error("Browser engine not configured - call setBrowserController() before executing browser operations");
    }

    const result = await this.browserController.executeEvaluateJS(step, options);
    context.variables.set("__lastEvalResult", result);
    return result;
  }

  /**
   * Execute cache lookup step
   */
  private async executeCacheLookup(
    step: CacheLookupStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Use proxy controller to execute cache lookup
    if (!this.proxyController) {
      // Cache is optional, return null if not configured
      return null;
    }

    const cached = await this.proxyController.executeCacheLookup(step);
    context.variables.set(step.cacheKey, cached);
    return cached;
  }

  /**
   * Execute cache retrieve step
   */
  private async executeCacheRetrieve(
    step: CacheRetrieveStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Use proxy controller to retrieve from cache
    if (!this.proxyController) {
      // Cache is optional, return null if not configured
      return null;
    }

    const cached = await this.proxyController.executeCacheRetrieve(step);
    context.variables.set(step.cacheKey, cached);
    return cached;
  }

  /**
   * Execute cache store step
   */
  private async executeCacheStore(
    step: CacheStoreStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Use proxy controller to execute cache store
    if (!this.proxyController) {
      // Cache is optional, skip if not configured
      return { stored: false, reason: "No proxy controller configured" };
    }

    const value = context.variables.get(step.cacheKey);
    await this.proxyController.executeCacheStore(step);
    return { stored: true, cacheKey: step.cacheKey, hadValue: value !== undefined };
  }

  /**
   * Execute map step
   */
  private async executeMap(
    step: MapStep,
    context: ExecutionContext,
    execState?: PerExecutionState,
  ): Promise<unknown> {
    const input = context.variables.get(step.inputVariable);

    if (!Array.isArray(input)) {
      throw new Error(`Map input must be an array`);
    }

    // Create evaluation context
    const evalContext: EvaluationContext = {
      variables: context.variables,
      functions: new Map(),
    };

    const evaluator = new ExpressionEvaluator(evalContext);

    // Map array by evaluating transform for each item
    const mapped = await Promise.all(
      input.map(async (item) => {
        // Set current item as the row being evaluated
        evaluator.setContext({ currentRow: item as Record<string, unknown> });

        // Evaluate transform expression
        return await evaluator.evaluate(step.transform);
      }),
    );

    this.enforceResultSizeLimit(mapped, execState);
    context.variables.set(step.outputVariable, mapped);
    return mapped;
  }

  /**
   * Execute parallel step
   */
  private async executeParallel(
    step: ParallelStep,
    context: ExecutionContext,
    execState?: PerExecutionState,
  ): Promise<unknown> {
    // Create shallow clones of context for each sub-step to prevent
    // concurrent writes to context.variables from racing with each other.
    const clonedContexts = step.steps.map(() => ({
      ...context,
      variables: new Map(context.variables),
      stepResults: new Map(context.stepResults),
    }));

    // Execute all steps in parallel, each with its own isolated context clone
    const promises = step.steps.map((parallelStep, i) =>
      this.executeStep(parallelStep, clonedContexts[i], execState)
    );

    const results = await Promise.all(promises);

    // Merge results back into the original context
    for (let i = 0; i < step.steps.length; i++) {
      const parallelStep = step.steps[i];
      const result = results[i];
      const clonedCtx = clonedContexts[i];

      // Merge variables written by this sub-step back into the parent context
      for (const [key, value] of clonedCtx.variables) {
        if (!context.variables.has(key) || context.variables.get(key) !== value) {
          context.variables.set(key, value);
        }
      }

      context.stepResults.set(parallelStep.id, result);

      if (!result.success) {
        throw result.error || new Error(`Parallel step ${parallelStep.id} failed`);
      }
    }

    // Return array of all results
    return results.map((r) => r.data);
  }

  /**
   * Execute sequential step
   */
  private async executeSequential(
    step: SequentialStep,
    context: ExecutionContext,
    execState?: PerExecutionState,
  ): Promise<unknown> {
    let lastResult: unknown = null;

    // Execute steps one by one in order
    for (const seqStep of step.steps) {
      const result = await this.executeStep(seqStep, context, execState);
      context.stepResults.set(seqStep.id, result);
      lastResult = result.data;

      if (!result.success) {
        throw result.error || new Error(`Sequential step ${seqStep.id} failed`);
      }
    }

    return lastResult;
  }

  /**
   * Execute intercept request step
   */
  private async executeInterceptRequest(
    step: InterceptRequestStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Use proxy controller to intercept requests
    if (!this.proxyController) {
      throw new Error("Proxy controller not configured for request interception");
    }

    // Set up request interceptor based on patterns
    const interceptor = (request: any) => {
      // Check if request matches patterns
      const urlMatch = !step.urlPattern || (isSafeRegex(step.urlPattern) && new RegExp(step.urlPattern).test(request.url));
      const methodMatch = !step.methodPattern ||
        (isSafeRegex(step.methodPattern) && new RegExp(step.methodPattern).test(request.method));

      let headerMatch = true;
      if (step.headerMatchers) {
        for (const [key, pattern] of Object.entries(step.headerMatchers)) {
          const headerValue = request.headers[key.toLowerCase()];
          if (!headerValue || !isSafeRegex(pattern) || !new RegExp(pattern).test(headerValue)) {
            headerMatch = false;
            break;
          }
        }
      }

      if (urlMatch && methodMatch && headerMatch) {
        // Apply action
        switch (step.action) {
          case "block":
            throw new Error(`Request blocked by interceptor: ${request.url}`);

          case "modify":
            if (step.modifications) {
              return {
                ...request,
                url: step.modifications.url || request.url,
                method: step.modifications.method || request.method,
                headers: { ...request.headers, ...sanitizeHeaders(step.modifications.headers || {}) },
                body: step.modifications.body !== undefined
                  ? step.modifications.body
                  : request.body,
              };
            }
            return request;

          case "allow":
          default:
            return request;
        }
      }

      return request;
    };

    this.proxyController.addRequestInterceptor(interceptor);
    context.variables.set("__lastInterceptor", { action: step.action, urlPattern: step.urlPattern });
    return { interceptorAdded: true, action: step.action };
  }

  /**
   * Execute modify request step
   */
  private async executeModifyRequest(
    step: ModifyRequestStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Use proxy controller to modify a specific request
    if (!this.proxyController) {
      throw new Error("Proxy controller not configured for request modification");
    }

    // Create interceptor for specific request ID
    const interceptor = (request: any) => {
      if (request.id === step.requestId) {
        return {
          ...request,
          url: step.modifications.url || request.url,
          method: step.modifications.method || request.method,
          headers: { ...request.headers, ...sanitizeHeaders(step.modifications.headers || {}) },
          body: step.modifications.body !== undefined ? step.modifications.body : request.body,
        };
      }
      return request;
    };

    this.proxyController.addRequestInterceptor(interceptor);
    context.variables.set("__lastModifiedRequest", step.requestId);
    return { modified: true, requestId: step.requestId };
  }

  /**
   * Execute reduce step
   */
  private async executeReduce(
    step: ReduceStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    const input = context.variables.get(step.inputVariable);

    if (!Array.isArray(input)) {
      throw new Error(`Reduce input must be an array`);
    }

    // Create evaluation context
    const evalContext: EvaluationContext = {
      variables: context.variables,
      functions: new Map(),
    };

    const evaluator = new ExpressionEvaluator(evalContext);

    // Evaluate initial value
    let accumulator = await evaluator.evaluate(step.initialValue);

    // Reduce array by evaluating reducer for each item
    for (const item of input) {
      // Set accumulator and current item in context
      context.variables.set("accumulator", accumulator);
      evaluator.setContext({
        variables: context.variables,
        currentRow: item as Record<string, unknown>,
      });

      // Evaluate reducer expression
      accumulator = await evaluator.evaluate(step.reducer);
    }

    context.variables.set(step.outputVariable, accumulator);
    return accumulator;
  }

  /**
   * Execute join step
   */
  private async executeJoin(
    step: JoinStep,
    context: ExecutionContext,
    execState?: PerExecutionState,
  ): Promise<unknown> {
    const leftData = context.variables.get(step.leftVariable);
    const rightData = context.variables.get(step.rightVariable);

    if (!Array.isArray(leftData) || !Array.isArray(rightData)) {
      throw new Error(`Join inputs must be arrays`);
    }

    // Create evaluation context
    const evalContext: EvaluationContext = {
      variables: context.variables,
      functions: new Map(),
    };

    const evaluator = new ExpressionEvaluator(evalContext);

    // Build index for right side
    const rightIndex = new Map<any, any[]>();
    for (const rightItem of rightData) {
      evaluator.setContext({ currentRow: rightItem as Record<string, unknown> });
      const rightKey = await evaluator.evaluate(step.rightKey);

      if (!rightIndex.has(rightKey)) {
        rightIndex.set(rightKey, []);
      }
      rightIndex.get(rightKey)!.push(rightItem);
    }

    const results: any[] = [];

    // Perform join
    for (const leftItem of leftData) {
      evaluator.setContext({ currentRow: leftItem as Record<string, unknown> });
      const leftKey = await evaluator.evaluate(step.leftKey);

      const matches = rightIndex.get(leftKey) || [];

      if (matches.length > 0) {
        // Inner, left, or full join with matches
        for (const rightItem of matches) {
          results.push({
            ...leftItem as Record<string, unknown>,
            ...rightItem as Record<string, unknown>,
          });
        }
      } else if (step.joinType === "left" || step.joinType === "full") {
        // Left or full join without matches - include left with null right
        results.push({
          ...leftItem as Record<string, unknown>,
        });
      }
    }

    // For full join, add unmatched right items
    if (step.joinType === "full") {
      const matchedRightKeys = new Set<any>();
      for (const leftItem of leftData) {
        evaluator.setContext({ currentRow: leftItem as Record<string, unknown> });
        const leftKey = await evaluator.evaluate(step.leftKey);
        matchedRightKeys.add(leftKey);
      }

      for (const [rightKey, rightItems] of rightIndex.entries()) {
        if (!matchedRightKeys.has(rightKey)) {
          for (const rightItem of rightItems) {
            results.push({
              ...rightItem as Record<string, unknown>,
            });
          }
        }
      }
    }

    // For right join
    if (step.joinType === "right") {
      const matchedRightKeys = new Set<any>();
      for (const leftItem of leftData) {
        evaluator.setContext({ currentRow: leftItem as Record<string, unknown> });
        const leftKey = await evaluator.evaluate(step.leftKey);
        const matches = rightIndex.get(leftKey) || [];

        if (matches.length > 0) {
          matchedRightKeys.add(leftKey);
          for (const rightItem of matches) {
            results.push({
              ...leftItem as Record<string, unknown>,
              ...rightItem as Record<string, unknown>,
            });
          }
        }
      }

      // Add unmatched right items
      for (const [rightKey, rightItems] of rightIndex.entries()) {
        if (!matchedRightKeys.has(rightKey)) {
          for (const rightItem of rightItems) {
            results.push({
              ...rightItem as Record<string, unknown>,
            });
          }
        }
      }
    }

    this.enforceResultSizeLimit(results, execState);
    context.variables.set(step.outputVariable, results);
    return results;
  }

  /**
   * Execute read variable step
   */
  private async executeReadVariable(
    step: ReadVariableStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    const value = context.variables.get(step.variable);

    if (value === undefined) {
      throw new Error(`Variable '${step.variable}' not found in context`);
    }

    context.variables.set(step.outputVariable, value);
    return value;
  }

  /**
   * Execute write variable step
   */
  private async executeWriteVariable(
    step: WriteVariableStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Create evaluation context
    const evalContext: EvaluationContext = {
      variables: context.variables,
      functions: new Map(),
    };

    const evaluator = new ExpressionEvaluator(evalContext);

    // Evaluate the value expression
    const value = await evaluator.evaluate(step.value);

    context.variables.set(step.variable, value);
    return value;
  }

  /**
   * Enforce result set size limit on an array
   */
  private enforceResultSizeLimit(results: unknown[], execState?: PerExecutionState): void {
    const maxResultSize = execState?.maxResultSize ?? MAX_RESULT_SIZE;
    if (results.length > maxResultSize) {
      throw new Error(
        `Result set size limit exceeded: ${results.length} rows, maximum is ${maxResultSize}`,
      );
    }
  }

  /**
   * Get execution order for steps using topological sort
   */
  private getExecutionOrder(plan: ExecutionPlan): string[] {
    // Build dependency graph for topological sort
    const edges = new Map<string, string[]>();
    const nodes: string[] = [];

    for (const step of plan.steps) {
      nodes.push(step.id);
      edges.set(step.id, step.dependencies || []);
    }

    const graph: DependencyGraph = { nodes, edges };

    // Use utility function for topological sort
    try {
      return topologicalSort(graph);
    } catch (_error) {
      throw new Error("Circular dependency in execution plan");
    }
  }

  /**
   * Get browser controller
   */
  getBrowserController(): BrowserController | undefined {
    return this.browserController;
  }

  /**
   * Get proxy controller
   */
  getProxyController(): ProxyController | undefined {
    return this.proxyController;
  }

  /**
   * Get state manager
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Get the execution context manager for a given execution.
   * Context managers are now per-execution (via execState.contextManager)
   * and no longer stored as shared instance state.
   * @deprecated Use execState.contextManager within execute() instead.
   */
  getCurrentContextManager(): ExecutionContextManager | undefined {
    return undefined;
  }
}

/**
 * Executor - alias for QueryExecutor for test compatibility
 */
export const Executor = QueryExecutor;
