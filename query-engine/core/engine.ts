/**
 * Main Query Engine implementation
 * Orchestrates the complete query execution pipeline
 */

import { Lexer } from "../lexer/mod.ts";
import { Parser } from "../parser/mod.ts";
import { SemanticAnalyzer } from "../analyzer/mod.ts";
import { QueryOptimizer } from "../optimizer/mod.ts";
import { ExecutionPlanner } from "../planner/mod.ts";
import { QueryExecutor } from "../executor/mod.ts";
import { ResultFormatter } from "../formatter/formatter.ts";
import { type FunctionRegistry, globalRegistry } from "../schema/registry.ts";
import {
  OutputFormat,
  QueryExecutionState,
  QueryID,
  QueryOptions,
  QueryResult,
  QueryStatus,
} from "../types/mod.ts";
import { ProxyController, ProxyConfig } from "../controllers/proxy/proxy-controller.ts";
import { Runtime } from "@browserx/proxy-engine";
import { BrowserController } from "../controllers/browser/browser-controller.ts";
import { BrowserEngine } from "@browserx/browser";
import type { PipelineObserver, PipelineStageEvent } from "@browserx/browser";

/**
 * Query Engine configuration
 */
export interface QueryEngineConfig {
  browser?: BrowserEngineConfig;
  proxy?: ProxyEngineConfig;
  resources?: ResourceManagerConfig;
  security?: SecurityConfig;
  metrics?: MetricsConfig;
  errorRecovery?: ErrorRecoveryConfig;
}

export interface BrowserEngineConfig {
  // Browser-specific configuration
  headless?: boolean;
  defaultViewport?: { width: number; height: number };
  defaultTimeout?: number;
}

export interface ProxyEngineConfig {
  // Proxy-specific configuration
  enabled?: boolean;
  defaultTimeout?: number;
  cache?: {
    enabled?: boolean;
    defaultTTL?: number;
    maxSize?: number;
  };
  rateLimit?: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
  };
}

export interface ResourceManagerConfig {
  browsers?: {
    min?: number;
    max?: number;
    idleTimeout?: number;
    maxLifetime?: number;
  };
  pages?: {
    max?: number;
    idleTimeout?: number;
  };
  connections?: {
    max?: number;
    idleTimeout?: number;
  };
  memory?: {
    maxUsage?: number;
    pressureThreshold?: number;
  };
}

export interface SecurityConfig {
  permissions?: string[];
  sandbox?: {
    enabled?: boolean;
    timeout?: number;
  };
  rateLimit?: {
    perSecond?: number;
    perMinute?: number;
    perHour?: number;
  };
  urlValidation?: {
    allowedProtocols?: string[];
    allowedDomains?: string[];
    blockedDomains?: string[];
    blockPrivateIPs?: boolean;
  };
}

export interface MetricsConfig {
  enabled?: boolean;
  tracing?: boolean;
  exportFormat?: "prometheus" | "json";
}

export interface ErrorRecoveryConfig {
  retry?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    jitterFactor?: number;
  };
  circuitBreaker?: {
    failureThreshold?: number;
    resetTimeout?: number;
  };
  fallback?: {
    enabled?: boolean;
  };
}

/**
 * Main Query Engine interface
 */
export interface IQueryEngine {
  /**
   * Execute a query synchronously
   */
  execute(query: string, options?: QueryOptions): Promise<QueryResult>;

  /**
   * Execute a query asynchronously and return query ID
   */
  executeAsync(query: string, options?: QueryOptions): Promise<QueryID>;

  /**
   * Get status of an async query
   */
  getQueryStatus(queryId: QueryID): Promise<QueryStatus>;

  /**
   * Cancel a running query
   */
  cancelQuery(queryId: QueryID): Promise<void>;

  /**
   * Initialize the engine
   */
  initialize(config: QueryEngineConfig): Promise<void>;

  /**
   * Shutdown the engine and cleanup resources
   */
  shutdown(): Promise<void>;

  /**
   * Get engine metrics
   */
  getMetrics(): QueryEngineMetrics;

  /**
   * Get all tracked queries
   */
  getQueries(): Map<QueryID, QueryStatus>;

  /**
   * Check if engine is initialized
   */
  isInitialized(): boolean;

  /**
   * Get the proxy controller (if proxy is enabled)
   */
  getProxyController(): ProxyController | undefined;

  /**
   * Get the proxy runtime (if proxy is enabled)
   */
  getRuntime(): Runtime | undefined;
}

/**
 * Query Engine metrics
 */
export interface QueryEngineMetrics {
  queries: {
    total: number;
    successful: number;
    failed: number;
    cancelled: number;
    timeout: number;
  };
  performance: {
    averageExecutionTime: number;
    p50: number;
    p95: number;
    p99: number;
  };
  resources: {
    browsers: number;
    pages: number;
    connections: number;
    memoryUsage: number;
  };
  errors: {
    byType: Record<string, number>;
    total: number;
  };
}

/**
 * Query Engine implementation
 */
export class QueryEngine implements IQueryEngine {
  private config: QueryEngineConfig;
  private initialized: boolean;
  private queries: Map<QueryID, QueryStatus>;
  private abortControllers: Map<QueryID, AbortController>;
  private metrics: QueryEngineMetrics;
  private runtime?: Runtime;
  private proxyController?: ProxyController;
  private browserController?: BrowserController;
  private observer?: PipelineObserver;

  constructor(config: QueryEngineConfig = {}) {
    this.config = config;
    this.initialized = false;
    this.queries = new Map();
    this.abortControllers = new Map();
    this.metrics = {
      queries: {
        total: 0,
        successful: 0,
        failed: 0,
        cancelled: 0,
        timeout: 0,
      },
      performance: {
        averageExecutionTime: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      },
      resources: {
        browsers: 0,
        pages: 0,
        connections: 0,
        memoryUsage: 0,
      },
      errors: {
        byType: {},
        total: 0,
      },
    };
  }

  /**
   * Set a pipeline observer to receive stage events during query execution
   */
  setObserver(observer: PipelineObserver): void {
    this.observer = observer;
  }

  /**
   * Emit a pipeline stage event to the observer
   */
  private emitStage(
    stageId: string,
    stageName: string,
    status: PipelineStageEvent["status"],
    startTime: number,
    endTime?: number,
    duration?: number,
    artifact?: unknown,
    error?: Error,
  ): void {
    this.observer?.onStage({
      stageId,
      stageName,
      pipeline: "query",
      status,
      startTime,
      endTime,
      duration,
      artifact,
      error,
    });
  }

  /**
   * Initialize the engine
   */
  async initialize(config: QueryEngineConfig): Promise<void> {
    await Promise.resolve(); // async per IQueryEngine contract; supports future async init
    this.config = { ...this.config, ...config };

    // Reset metrics on (re)initialize
    this.metrics = {
      queries: {
        total: 0,
        successful: 0,
        failed: 0,
        cancelled: 0,
        timeout: 0,
      },
      performance: {
        averageExecutionTime: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      },
      resources: {
        browsers: 0,
        pages: 0,
        connections: 0,
        memoryUsage: 0,
      },
      errors: {
        byType: {},
        total: 0,
      },
    };

    // Initialize Proxy Engine if enabled
    if (this.config.proxy?.enabled) {
      // Create Runtime instance for proxy engine
      this.runtime = new Runtime({
        gateways: [], // No gateway servers needed for query engine integration
        handleSignals: false, // Don't register signal handlers
        environment: "production",
        logLevel: "warn",
      });

      // Create ProxyController with Runtime for cache integration
      const proxyConfig: Partial<ProxyConfig> = {
        enabled: true,
        cache: {
          enabled: this.config.proxy.cache?.enabled ?? true,
          defaultTTL: this.config.proxy.cache?.defaultTTL ?? 300000, // 5 minutes
          maxSize: this.config.proxy.cache?.maxSize ?? 100 * 1024 * 1024, // 100MB
        },
      };

      // Only add rateLimit if both values are provided
      if (
        this.config.proxy.rateLimit?.requestsPerSecond !== undefined &&
        this.config.proxy.rateLimit?.requestsPerMinute !== undefined
      ) {
        proxyConfig.rateLimit = {
          requestsPerSecond: this.config.proxy.rateLimit.requestsPerSecond,
          requestsPerMinute: this.config.proxy.rateLimit.requestsPerMinute,
        };
      }

      this.proxyController = new ProxyController(this.runtime, proxyConfig);
    }

    // Note: Other components created on-demand during execution
    // - Browser Engine integration: BrowserController created by executor
    // - Resource Manager: Managed by execution planner
    // - State Manager: ExecutionContext managed by executor
    // - Metrics Collector: Integrated in execute() method
    // - Security Validator: Applied during semantic analysis

    this.initialized = true;
  }

  /**
   * Execute a query synchronously
   */
  async execute(query: string, options: QueryOptions = {}): Promise<QueryResult> {
    if (!this.initialized) {
      throw new Error("Query Engine not initialized. Call initialize() first.");
    }

    const queryId = options.queryId ?? this.generateQueryId();
    const startTime = performance.now();
    const timeout = options.timeout ?? 30000;

    // Create abort controller for cancellation
    const abortController = new AbortController();
    this.abortControllers.set(queryId, abortController);

    // If an external signal is provided (e.g., from MCP withTimeout), link it to our controller
    // When the external signal aborts, we abort our internal controller
    let externalAbortHandler: (() => void) | undefined;
    if (options.signal) {
      externalAbortHandler = () => {
        abortController.abort(options.signal?.reason || new Error("Query aborted by external signal"));
      };
      options.signal.addEventListener("abort", externalAbortHandler);

      // Check if already aborted
      if (options.signal.aborted) {
        abortController.abort(options.signal.reason || new Error("Query aborted by external signal"));
      }
    }

    // Only set up internal timeout if no external signal is provided
    // When MCP provides a signal, it handles timeout externally
    const timeoutId = options.signal ? undefined : setTimeout(() => {
      abortController.abort(new Error(`Query timed out after ${timeout}ms`));
    }, timeout);

    try {
      // Update metrics
      this.metrics.queries.total++;

      // Check if cancelled
      if (abortController.signal.aborted) {
        throw new Error("Query cancelled");
      }

      // 1. Lexer - Tokenize query string
      this.emitStage("lexer", "Lexer", "running", performance.now());
      const lexerStart = performance.now();
      const lexer = new Lexer(query);
      const tokens = lexer.tokenize();
      const lexerTime = performance.now() - lexerStart;
      this.emitStage("lexer", "Lexer", "completed", lexerStart, performance.now(), lexerTime, tokens);

      // 2. Parser - Build AST
      this.emitStage("parser", "Parser", "running", performance.now());
      const parserStart = performance.now();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const parserTime = performance.now() - parserStart;
      this.emitStage("parser", "Parser", "completed", parserStart, performance.now(), parserTime, ast);

      // Check if cancelled
      if (abortController.signal.aborted) {
        throw new Error("Query cancelled during parsing");
      }

      // 3. Semantic Analysis - Type checking and validation
      this.emitStage("semantic-analysis", "Semantic Analysis", "running", performance.now());
      const analysisStart = performance.now();
      const analyzer = new SemanticAnalyzer({
        allowUndefinedVariables: false,
        strictTypeChecking: true,
        allowPrivateIPs: this.config.security?.urlValidation?.blockPrivateIPs === false,
        maxNestingDepth: 10,
      });
      const annotatedAST = analyzer.analyze(ast);
      const analysisTime = performance.now() - analysisStart;
      this.emitStage("semantic-analysis", "Semantic Analysis", "completed", analysisStart, performance.now(), analysisTime, annotatedAST);

      // Check if cancelled
      if (abortController.signal.aborted) {
        throw new Error("Query cancelled during semantic analysis");
      }

      // 4. Optimization - Query optimization
      this.emitStage("optimization", "Optimization", "running", performance.now());
      const optimizationStart = performance.now();
      const optimizer = new QueryOptimizer({
        enableConstantFolding: true,
        enableDeadCodeElimination: true,
        enablePredicatePushdown: true,
        enableProjectionPushdown: true,
        enableCacheOptimization: true,
        enableParallelDetection: true,
        maxPasses: 3,
      });
      const optimizationResult = optimizer.optimize(annotatedAST.ast);
      const optimizationTime = performance.now() - optimizationStart;
      this.emitStage("optimization", "Optimization", "completed", optimizationStart, performance.now(), optimizationTime, optimizationResult);

      // Check if cancelled
      if (abortController.signal.aborted) {
        throw new Error("Query cancelled during optimization");
      }

      // 5. Planning - Generate execution plan
      this.emitStage("planning", "Planning", "running", performance.now());
      const planningStart = performance.now();
      const planner = new ExecutionPlanner();
      const plan = planner.plan(optimizationResult.optimizedAST, {
        optimizationApplied: true,
        appliedPasses: optimizationResult.appliedPasses,
        estimatedImprovement: optimizationResult.improvement,
      });
      const planningTime = performance.now() - planningStart;
      this.emitStage("planning", "Planning", "completed", planningStart, performance.now(), planningTime, plan);

      // Check if cancelled
      if (abortController.signal.aborted) {
        throw new Error("Query cancelled during planning");
      }

      // 6. Execution - Execute the plan
      this.emitStage("execution", "Execution", "running", performance.now());
      const executionStart = performance.now();
      if (!this.browserController) {
        const browserEngine = new BrowserEngine();
        this.browserController = new BrowserController(browserEngine);
      }
      const executor = new QueryExecutor(this.browserController, this.proxyController);
      const executionResult = await executor.execute(plan, { signal: abortController.signal });
      const executionTime = performance.now() - executionStart;
      this.emitStage("execution", "Execution", "completed", executionStart, performance.now(), executionTime, executionResult);

      // Check for execution errors
      if (!executionResult.success && executionResult.error) {
        throw executionResult.error;
      }

      const {data} = executionResult;

      // 7. Formatting - Format results
      this.emitStage("formatting", "Formatting", "running", performance.now());
      const formattingStart = performance.now();
      const formatter = new ResultFormatter();
      const outputFormat: OutputFormat = options.format || "JSON";
      const formatted = formatter.format(data, outputFormat, {
        pretty: true,
        indent: 2,
        includeHeaders: true,
      });
      const formattingTime = performance.now() - formattingStart;
      this.emitStage("formatting", "Formatting", "completed", formattingStart, performance.now(), formattingTime, formatted);

      const totalTime = performance.now() - startTime;

      // Update metrics
      this.metrics.queries.successful++;

      return {
        queryId,
        data: formatted,
        timing: {
          lexerTime,
          parserTime,
          semanticAnalysisTime: analysisTime,
          optimizationTime,
          planningTime,
          executionTime,
          formattingTime,
          totalTime,
        },
        metadata: {
          query,
          ast,
          stepsExecuted: plan.steps.length,
          estimatedCost: plan.estimatedCost,
          actualCost: totalTime,
          browserNavigations: plan.steps.filter((s) => s.type === "NAVIGATE").length,
          cacheHits: executionResult.cacheHits,
          cacheMisses: executionResult.cacheMisses,
        },
      };
    } catch (error) {
      this.metrics.queries.failed++;
      this.metrics.errors.total++;

      const errorType = error instanceof Error ? error.constructor.name : "UnknownError";
      this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;

      this.emitStage("unknown", "Unknown", "error", startTime, performance.now(), performance.now() - startTime, undefined, error instanceof Error ? error : new Error(String(error)));

      throw error;
    } finally {
      // Cleanup timeout and abort controller
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      // Remove external signal listener if we added one
      if (options.signal && externalAbortHandler) {
        options.signal.removeEventListener("abort", externalAbortHandler);
      }

      this.abortControllers.delete(queryId);
    }
  }

  /**
   * Execute a query asynchronously
   */
  async executeAsync(query: string, options: QueryOptions = {}): Promise<QueryID> {
    await Promise.resolve(); // async per IQueryEngine contract
    const queryId = this.generateQueryId();

    // Create initial query status
    this.queries.set(queryId, {
      queryId,
      state: QueryExecutionState.PENDING,
      progress: 0,
      stepsCompleted: 0,
      stepsTotal: 0,
    });

    // Execute in background, passing the outer queryId so status tracking is consistent
    this.execute(query, { ...options, queryId }).then(
      (result) => {
        this.queries.set(queryId, {
          queryId,
          state: QueryExecutionState.COMPLETED,
          progress: 100,
          stepsCompleted: result.metadata.stepsExecuted,
          stepsTotal: result.metadata.stepsExecuted,
        });
      },
      (error) => {
        this.queries.set(queryId, {
          queryId,
          state: QueryExecutionState.FAILED,
          progress: 0,
          stepsCompleted: 0,
          stepsTotal: 0,
          error,
        });

        // Emit error so callers can observe async query failures
        console.error(
          `[QueryEngine] Async query ${queryId} failed:`,
          error instanceof Error ? error.message : String(error),
        );
      },
    );

    return queryId;
  }

  /**
   * Get query status
   */
  async getQueryStatus(queryId: QueryID): Promise<QueryStatus> {
    await Promise.resolve(); // async per IQueryEngine contract
    const status = this.queries.get(queryId);

    if (!status) {
      throw new Error(`Query ${queryId} not found`);
    }

    return status;
  }

  /**
   * Cancel a running query
   */
  async cancelQuery(queryId: QueryID): Promise<void> {
    await Promise.resolve(); // async per IQueryEngine contract
    const status = this.queries.get(queryId);

    if (!status) {
      throw new Error(`Query ${queryId} not found`);
    }

    // Check if query is already completed or cancelled
    if (
      status.state === QueryExecutionState.COMPLETED ||
      status.state === QueryExecutionState.CANCELLED ||
      status.state === QueryExecutionState.FAILED
    ) {
      throw new Error(`Query ${queryId} is already ${status.state.toLowerCase()}`);
    }

    // Signal the abort controller to cancel execution
    const abortController = this.abortControllers.get(queryId);
    if (abortController) {
      abortController.abort();
    }

    // Update query status
    this.queries.set(queryId, {
      ...status,
      state: QueryExecutionState.CANCELLED,
    });

    // Cleanup abort controller
    this.abortControllers.delete(queryId);

    this.metrics.queries.cancelled++;
  }

  /**
   * Shutdown the engine
   */
  async shutdown(): Promise<void> {
    // Cancel all running queries
    const runningQueries = Array.from(this.queries.entries()).filter(
      ([_, status]) =>
        status.state === QueryExecutionState.PENDING ||
        status.state === QueryExecutionState.EXECUTING,
    );

    for (const [queryId] of runningQueries) {
      try {
        await this.cancelQuery(queryId);
      } catch (error) {
        // Ignore errors during shutdown cancellation
        console.error(`Error cancelling query ${queryId} during shutdown:`, error);
      }
    }

    // Clear abort controllers (any remaining ones)
    for (const [queryId, controller] of this.abortControllers.entries()) {
      controller.abort();
      this.abortControllers.delete(queryId);
    }

    // Clear query status map
    this.queries.clear();

    // Shutdown proxy runtime if initialized
    if (this.runtime) {
      try {
        await this.runtime.shutdown();
      } catch (error) {
        // Ignore errors during runtime shutdown
        console.error("Error shutting down proxy runtime:", error);
      }
      this.runtime = undefined;
    }

    // Clear proxy controller
    this.proxyController = undefined;

    // Close browser controller if it was created
    if (this.browserController) {
      await this.browserController.closePage();
      this.browserController = undefined;
    }

    // Mark as not initialized
    this.initialized = false;
  }

  /**
   * Get engine metrics
   */
  getMetrics(): QueryEngineMetrics {
    return { ...this.metrics };
  }

  /**
   * Get query engine configuration
   */
  getConfig(): Readonly<QueryEngineConfig> {
    return { ...this.config };
  }

  /**
   * Get all tracked queries
   */
  getQueries(): Map<QueryID, QueryStatus> {
    return new Map(this.queries);
  }

  /**
   * Get abort controllers for active queries
   */
  getAbortControllers(): Map<QueryID, AbortController> {
    return new Map(this.abortControllers);
  }

  /**
   * Check if engine is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the proxy controller (if proxy is enabled)
   */
  getProxyController(): ProxyController | undefined {
    return this.proxyController;
  }

  /**
   * Get the proxy runtime (if proxy is enabled)
   */
  getRuntime(): Runtime | undefined {
    return this.runtime;
  }

  /**
   * Get the function registry for registering/unregistering custom functions
   */
  getFunctionRegistry(): FunctionRegistry {
    return globalRegistry;
  }

  /**
   * Generate a unique query ID
   */
  private generateQueryId(): QueryID {
    return `query_${Date.now()}_${crypto.randomUUID().slice(0, 9)}`;
  }
}
