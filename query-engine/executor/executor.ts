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
import { ProxyController } from "../controllers/proxy/proxy-controller.ts";
import { ExecutionContextManager, StateManager } from "../state/mod.ts";
import { type DependencyGraph, topologicalSort } from "../utils/mod.ts";
import { BrowserEngine } from "../../browser/src/api/mod.ts";

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
  private currentContextManager?: ExecutionContextManager;

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
  async execute(plan: ExecutionPlan): Promise<ExecutionResult> {
    const startTime = performance.now();

    // Create execution context using StateManager
    this.currentContextManager = this.stateManager.createExecutionContext(plan.id);

    // Convert to legacy format for backward compatibility
    const context: ExecutionContext = this.currentContextManager.toLegacyContext();

    let cacheHits = 0;
    let cacheMisses = 0;

    try {
      // Get topological order for sequential execution
      const order = this.getExecutionOrder(plan);

      // Execute steps in order
      for (const stepId of order) {
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
        const result = await this.executeStep(step, context);
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
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: ExecutionStep,
    context: ExecutionContext,
  ): Promise<StepResult> {
    const startTime = performance.now();

    try {
      let data: unknown = null;

      switch (step.type) {
        case ExecutionStepType.NAVIGATE:
          data = await this.executeNavigate(step as NavigateStep, context);
          break;

        case ExecutionStepType.DOM_QUERY:
          data = await this.executeDOMQuery(step as DOMQueryStep, context);
          break;

        case ExecutionStepType.CLICK:
          data = await this.executeClick(step as ClickStep, context);
          break;

        case ExecutionStepType.TYPE:
          data = await this.executeType(step as TypeStep, context);
          break;

        case ExecutionStepType.WAIT:
          data = await this.executeWait(step as WaitStep, context);
          break;

        case ExecutionStepType.SCREENSHOT:
          data = await this.executeScreenshot(step as ScreenshotStep, context);
          break;

        case ExecutionStepType.PDF:
          data = await this.executePDF(step as PDFStep, context);
          break;

        case ExecutionStepType.EVALUATE_JS:
          data = await this.executeEvaluateJS(step as EvaluateJSStep, context);
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

        case ExecutionStepType.CACHE_STORE:
          data = await this.executeCacheStore(step as CacheStoreStep, context);
          break;

        case ExecutionStepType.FILTER:
          data = await this.executeFilter(step as FilterStep, context);
          break;

        case ExecutionStepType.MAP:
          data = await this.executeMap(step as MapStep, context);
          break;

        case ExecutionStepType.REDUCE:
          data = await this.executeReduce(step as ReduceStep, context);
          break;

        case ExecutionStepType.JOIN:
          data = await this.executeJoin(step as JoinStep, context);
          break;

        case ExecutionStepType.SORT:
          data = await this.executeSort(step as SortStep, context);
          break;

        case ExecutionStepType.LIMIT:
          data = await this.executeLimit(step as LimitStep, context);
          break;

        case ExecutionStepType.BRANCH:
          data = await this.executeBranch(step as BranchStep, context);
          break;

        case ExecutionStepType.LOOP:
          data = await this.executeLoop(step as LoopStep, context);
          break;

        case ExecutionStepType.PARALLEL:
          data = await this.executeParallel(step as ParallelStep, context);
          break;

        case ExecutionStepType.SEQUENTIAL:
          data = await this.executeSequential(step as SequentialStep, context);
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
  ): Promise<unknown> {
    // Use browser controller to execute navigation
    if (!this.browserController) {
      // Create browser controller on demand if not provided
      const browserEngine = new BrowserEngine();
      this.browserController = new BrowserController(browserEngine);
    }

    const result = await this.browserController.executeNavigate(step);

    // Store the page reference in context for subsequent operations
    context.currentBrowser = this.browserController;

    return result;
  }

  /**
   * Execute DOM query step
   */
  private async executeDOMQuery(
    step: DOMQueryStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Use browser controller to execute DOM query
    if (!this.browserController) {
      // Create browser controller on demand if not provided
      const browserEngine = new BrowserEngine();
      this.browserController = new BrowserController(browserEngine);
    }

    // Execute the DOM query step which returns extracted data
    const results = await this.browserController.executeDOMQuery(step);

    return results;
  }

  /**
   * Execute filter step
   */
  private async executeFilter(
    step: FilterStep,
    context: ExecutionContext,
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
    const filtered = [];
    for (const item of input) {
      // Set current item as the row being evaluated
      evaluator.setContext({ currentRow: item as Record<string, unknown> });

      // Evaluate predicate and convert to boolean
      const result = await evaluator.evaluate(step.predicate);
      if (result === true || result === 1 || (typeof result === "string" && result.length > 0)) {
        filtered.push(item);
      }
    }

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
  ): Promise<unknown> {
    // Create evaluation context
    const evalContext: EvaluationContext = {
      variables: context.variables,
      functions: new Map(),
    };

    const evaluator = new ExpressionEvaluator(evalContext);

    // Evaluate condition expression
    const conditionResult = await evaluator.evaluate(step.condition);

    // Convert to boolean (truthy/falsy logic)
    const conditionValue = conditionResult === true ||
      conditionResult === 1 ||
      (typeof conditionResult === "string" && conditionResult.length > 0) ||
      (typeof conditionResult === "number" && conditionResult !== 0) ||
      (Array.isArray(conditionResult) && conditionResult.length > 0);

    const stepsToExecute = conditionValue ? step.thenSteps : (step.elseSteps || []);

    let result: unknown = null;

    for (const branchStep of stepsToExecute) {
      const stepResult = await this.executeStep(branchStep, context);
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
  ): Promise<unknown> {
    const collection = context.variables.get(step.collectionVariable);

    if (!Array.isArray(collection)) {
      throw new Error(`Loop collection must be an array`);
    }

    const results: unknown[] = [];

    for (const item of collection) {
      // Push new scope for loop iteration (enables variable shadowing)
      if (this.currentContextManager) {
        this.currentContextManager.pushScope();
      }

      context.variables.set(step.iteratorVariable, item);

      for (const loopStep of step.bodySteps) {
        const stepResult = await this.executeStep(loopStep, context);
        context.stepResults.set(loopStep.id, stepResult);

        if (!stepResult.success) {
          // Pop scope before throwing
          if (this.currentContextManager) {
            this.currentContextManager.popScope();
          }
          throw stepResult.error || new Error(`Loop step ${loopStep.id} failed`);
        }
      }

      results.push(context.variables.get(step.iteratorVariable));

      // Pop scope after loop iteration
      if (this.currentContextManager) {
        this.currentContextManager.popScope();
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
  ): Promise<unknown> {
    // Use browser controller to execute click
    if (!this.browserController) {
      const browserEngine = new BrowserEngine();
      this.browserController = new BrowserController(browserEngine);
    }

    await this.browserController.executeClick(step);
    return { clicked: true, selector: step.selector };
  }

  /**
   * Execute type step
   */
  private async executeType(
    step: TypeStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Use browser controller to execute type
    if (!this.browserController) {
      const browserEngine = new BrowserEngine();
      this.browserController = new BrowserController(browserEngine);
    }

    await this.browserController.executeType(step);
    return { typed: true, selector: step.selector, text: step.text };
  }

  /**
   * Execute wait step
   */
  private async executeWait(
    step: WaitStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Use browser controller to execute wait
    if (!this.browserController) {
      const browserEngine = new BrowserEngine();
      this.browserController = new BrowserController(browserEngine);
    }

    await this.browserController.executeWait(step);
    return { waited: true, waitType: step.waitType };
  }

  /**
   * Execute screenshot step
   */
  private async executeScreenshot(
    step: ScreenshotStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Use browser controller to execute screenshot
    if (!this.browserController) {
      const browserEngine = new BrowserEngine();
      this.browserController = new BrowserController(browserEngine);
    }

    const screenshot = await this.browserController.executeScreenshot(step);
    return screenshot;
  }

  /**
   * Execute PDF step
   */
  private async executePDF(
    step: PDFStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Use browser controller to execute PDF generation
    if (!this.browserController) {
      const browserEngine = new BrowserEngine();
      this.browserController = new BrowserController(browserEngine);
    }

    const pdf = await this.browserController.executePDF(step);
    return pdf;
  }

  /**
   * Execute JavaScript evaluation step
   */
  private async executeEvaluateJS(
    step: EvaluateJSStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Use browser controller to execute JavaScript
    if (!this.browserController) {
      const browserEngine = new BrowserEngine();
      this.browserController = new BrowserController(browserEngine);
    }

    const result = await this.browserController.executeEvaluateJS(step);
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

    await this.proxyController.executeCacheStore(step);
    return { stored: true, cacheKey: step.cacheKey };
  }

  /**
   * Execute map step
   */
  private async executeMap(
    step: MapStep,
    context: ExecutionContext,
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

    context.variables.set(step.outputVariable, mapped);
    return mapped;
  }

  /**
   * Execute parallel step
   */
  private async executeParallel(
    step: ParallelStep,
    context: ExecutionContext,
  ): Promise<unknown> {
    // Execute all steps in parallel using Promise.all
    const promises = step.steps.map((parallelStep) => this.executeStep(parallelStep, context));

    const results = await Promise.all(promises);

    // Store all step results
    for (let i = 0; i < step.steps.length; i++) {
      const parallelStep = step.steps[i];
      const result = results[i];
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
  ): Promise<unknown> {
    let lastResult: unknown = null;

    // Execute steps one by one in order
    for (const seqStep of step.steps) {
      const result = await this.executeStep(seqStep, context);
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
      const urlMatch = !step.urlPattern || new RegExp(step.urlPattern).test(request.url);
      const methodMatch = !step.methodPattern ||
        new RegExp(step.methodPattern).test(request.method);

      let headerMatch = true;
      if (step.headerMatchers) {
        for (const [key, pattern] of Object.entries(step.headerMatchers)) {
          const headerValue = request.headers[key.toLowerCase()];
          if (!headerValue || !new RegExp(pattern).test(headerValue)) {
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
                headers: { ...request.headers, ...step.modifications.headers },
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
          headers: { ...request.headers, ...step.modifications.headers },
          body: step.modifications.body !== undefined ? step.modifications.body : request.body,
        };
      }
      return request;
    };

    this.proxyController.addRequestInterceptor(interceptor);
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
        const leftKey = evaluator.evaluate(step.leftKey);
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
    } catch (error) {
      // Fall back to sequential order if there's a cycle
      console.warn("Circular dependency detected in execution plan, using sequential order");
      return plan.steps.map((s: ExecutionStep) => s.id);
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
   * Get current execution context manager
   */
  getCurrentContextManager(): ExecutionContextManager | undefined {
    return this.currentContextManager;
  }
}
