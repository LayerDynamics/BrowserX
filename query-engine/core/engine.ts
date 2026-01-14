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
import {
  OutputFormat,
  QueryExecutionState,
  QueryID,
  QueryOptions,
  QueryResult,
  QueryStatus,
} from "../types/mod.ts";

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
  defaultCache?: boolean;
  defaultTimeout?: number;
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
   * Initialize the engine
   */
  async initialize(config: QueryEngineConfig): Promise<void> {
    this.config = { ...this.config, ...config };

    // Initialize components (controllers will be created on-demand during execution)
    // - Browser Engine integration: BrowserController created by executor
    // - Proxy Engine integration: ProxyController created by executor
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

    const queryId = this.generateQueryId();
    const startTime = performance.now();

    // Create abort controller for cancellation
    const abortController = new AbortController();
    this.abortControllers.set(queryId, abortController);

    try {
      // Update metrics
      this.metrics.queries.total++;

      // Check if cancelled
      if (abortController.signal.aborted) {
        throw new Error("Query cancelled");
      }

      // 1. Lexer - Tokenize query string
      const lexerStart = performance.now();
      const lexer = new Lexer(query);
      const tokens = lexer.tokenize();
      const lexerTime = performance.now() - lexerStart;

      // 2. Parser - Build AST
      const parserStart = performance.now();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const parserTime = performance.now() - parserStart;

      // Check if cancelled
      if (abortController.signal.aborted) {
        throw new Error("Query cancelled during parsing");
      }

      // 3. Semantic Analysis - Type checking and validation
      const analysisStart = performance.now();
      const analyzer = new SemanticAnalyzer({
        allowUndefinedVariables: false,
        strictTypeChecking: true,
        allowPrivateIPs: this.config.security?.urlValidation?.blockPrivateIPs === false,
        maxNestingDepth: 10,
      });
      const annotatedAST = analyzer.analyze(ast);
      const analysisTime = performance.now() - analysisStart;

      // Check if cancelled
      if (abortController.signal.aborted) {
        throw new Error("Query cancelled during semantic analysis");
      }

      // 4. Optimization - Query optimization
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

      // Check if cancelled
      if (abortController.signal.aborted) {
        throw new Error("Query cancelled during optimization");
      }

      // 5. Planning - Generate execution plan
      const planningStart = performance.now();
      const planner = new ExecutionPlanner();
      const plan = planner.plan(optimizationResult.optimizedAST, {
        optimizationApplied: true,
        appliedPasses: optimizationResult.appliedPasses,
        estimatedImprovement: optimizationResult.improvement,
      });
      const planningTime = performance.now() - planningStart;

      // Check if cancelled
      if (abortController.signal.aborted) {
        throw new Error("Query cancelled during planning");
      }

      // 6. Execution - Execute the plan
      const executionStart = performance.now();
      const executor = new QueryExecutor();
      const executionResult = await executor.execute(plan);
      const data = executionResult.data;
      const executionTime = performance.now() - executionStart;

      // 7. Formatting - Format results
      const formattingStart = performance.now();
      const formatter = new ResultFormatter();
      const formatted = formatter.format(data, options.format || "JSON", {
        pretty: true,
        indent: 2,
        includeHeaders: true,
      });
      const formattingTime = performance.now() - formattingStart;

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

      throw error;
    } finally {
      // Cleanup abort controller
      this.abortControllers.delete(queryId);
    }
  }

  /**
   * Execute a query asynchronously
   */
  async executeAsync(query: string, options: QueryOptions = {}): Promise<QueryID> {
    const queryId = this.generateQueryId();

    // Create initial query status
    this.queries.set(queryId, {
      queryId,
      state: QueryExecutionState.PENDING,
      progress: 0,
      stepsCompleted: 0,
      stepsTotal: 0,
    });

    // Execute in background
    this.execute(query, options).then(
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
      },
    );

    return queryId;
  }

  /**
   * Get query status
   */
  async getQueryStatus(queryId: QueryID): Promise<QueryStatus> {
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
   * Generate a unique query ID
   */
  private generateQueryId(): QueryID {
    return `query_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
