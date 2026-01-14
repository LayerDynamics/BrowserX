/**
 * Execution plan types and structures
 */

import { DurationMs, QueryID, RequestID, URLString } from "../types/primitives.ts";
import { Expression, Statement } from "../types/ast.ts";

/**
 * Execution step types
 */
export enum ExecutionStepType {
  // Browser operations
  NAVIGATE = "NAVIGATE",
  DOM_QUERY = "DOM_QUERY",
  CLICK = "CLICK",
  TYPE = "TYPE",
  WAIT = "WAIT",
  SCREENSHOT = "SCREENSHOT",
  PDF = "PDF",
  EVALUATE_JS = "EVALUATE_JS",

  // Proxy operations
  INTERCEPT_REQUEST = "INTERCEPT_REQUEST",
  MODIFY_REQUEST = "MODIFY_REQUEST",
  CACHE_LOOKUP = "CACHE_LOOKUP",
  CACHE_STORE = "CACHE_STORE",

  // Compute operations
  FILTER = "FILTER",
  MAP = "MAP",
  REDUCE = "REDUCE",
  SORT = "SORT",
  LIMIT = "LIMIT",
  JOIN = "JOIN",

  // Control flow
  BRANCH = "BRANCH",
  LOOP = "LOOP",
  PARALLEL = "PARALLEL",
  SEQUENTIAL = "SEQUENTIAL",

  // Data operations
  ASSIGN = "ASSIGN",
  READ_VARIABLE = "READ_VARIABLE",
  WRITE_VARIABLE = "WRITE_VARIABLE",
}

/**
 * Base execution step
 */
export interface BaseExecutionStep {
  readonly id: string;
  readonly type: ExecutionStepType;
  estimatedCost: DurationMs;
  dependencies: string[]; // IDs of steps this depends on
  cacheable: boolean;
  cacheKey?: string;
}

/**
 * Browser navigation step
 */
export interface NavigateStep extends BaseExecutionStep {
  type: ExecutionStepType.NAVIGATE;
  url: URLString;
  options?: {
    waitFor?: string; // CSS selector or 'load' or 'domcontentloaded'
    timeout?: DurationMs;
    screenshot?: boolean;
    proxy?: {
      enabled: boolean;
      cache: boolean;
    };
  };
}

/**
 * DOM query step
 */
export interface DOMQueryStep extends BaseExecutionStep {
  type: ExecutionStepType.DOM_QUERY;
  selector: string;
  selectorType: "css" | "xpath";
  extractFields: {
    name: string;
    expression: Expression;
  }[];
  filter?: Expression;
}

/**
 * Click interaction step
 */
export interface ClickStep extends BaseExecutionStep {
  type: ExecutionStepType.CLICK;
  selector: string;
  selectorType: "css" | "xpath";
  waitForNavigation?: boolean;
}

/**
 * Type interaction step
 */
export interface TypeStep extends BaseExecutionStep {
  type: ExecutionStepType.TYPE;
  selector: string;
  selectorType: "css" | "xpath";
  text: string;
  clear?: boolean;
  delay?: DurationMs; // Delay between keystrokes
}

/**
 * Wait step
 */
export interface WaitStep extends BaseExecutionStep {
  type: ExecutionStepType.WAIT;
  waitType: "time" | "selector" | "function";
  duration?: DurationMs;
  selector?: string;
  condition?: string; // JavaScript expression
}

/**
 * Screenshot step
 */
export interface ScreenshotStep extends BaseExecutionStep {
  type: ExecutionStepType.SCREENSHOT;
  fullPage?: boolean;
  selector?: string;
  format?: "png" | "jpeg";
  quality?: number; // 0-100
}

/**
 * PDF generation step
 */
export interface PDFStep extends BaseExecutionStep {
  type: ExecutionStepType.PDF;
  format?: "A4" | "Letter";
  landscape?: boolean;
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

/**
 * JavaScript evaluation step
 */
export interface EvaluateJSStep extends BaseExecutionStep {
  type: ExecutionStepType.EVALUATE_JS;
  script: string;
  args?: unknown[];
}

/**
 * Cache lookup step
 */
export interface CacheLookupStep extends BaseExecutionStep {
  type: ExecutionStepType.CACHE_LOOKUP;
  cacheKey: string;
  ttl?: DurationMs;
}

/**
 * Cache store step
 */
export interface CacheStoreStep extends BaseExecutionStep {
  type: ExecutionStepType.CACHE_STORE;
  cacheKey: string;
  value: unknown;
  ttl?: DurationMs;
}

/**
 * Intercept request step
 */
export interface InterceptRequestStep extends BaseExecutionStep {
  type: ExecutionStepType.INTERCEPT_REQUEST;
  urlPattern?: string;
  methodPattern?: string;
  headerMatchers?: Record<string, string>;
  action: "allow" | "block" | "modify";
  modifications?: {
    url?: URLString;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
}

/**
 * Modify request step
 */
export interface ModifyRequestStep extends BaseExecutionStep {
  type: ExecutionStepType.MODIFY_REQUEST;
  requestId: RequestID;
  modifications: {
    url?: URLString;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
}

/**
 * Filter operation step
 */
export interface FilterStep extends BaseExecutionStep {
  type: ExecutionStepType.FILTER;
  predicate: Expression;
  inputVariable: string;
  outputVariable: string;
}

/**
 * Map operation step
 */
export interface MapStep extends BaseExecutionStep {
  type: ExecutionStepType.MAP;
  transform: Expression;
  inputVariable: string;
  outputVariable: string;
}

/**
 * Reduce operation step
 */
export interface ReduceStep extends BaseExecutionStep {
  type: ExecutionStepType.REDUCE;
  reducer: Expression;
  initialValue: Expression;
  inputVariable: string;
  outputVariable: string;
}

/**
 * Join operation step
 */
export interface JoinStep extends BaseExecutionStep {
  type: ExecutionStepType.JOIN;
  leftVariable: string;
  rightVariable: string;
  leftKey: Expression;
  rightKey: Expression;
  joinType: "inner" | "left" | "right" | "full";
  outputVariable: string;
}

/**
 * Sort operation step
 */
export interface SortStep extends BaseExecutionStep {
  type: ExecutionStepType.SORT;
  fields: {
    field: string;
    direction: "ASC" | "DESC";
  }[];
  inputVariable: string;
  outputVariable: string;
}

/**
 * Limit operation step
 */
export interface LimitStep extends BaseExecutionStep {
  type: ExecutionStepType.LIMIT;
  limit: number;
  offset?: number;
  inputVariable: string;
  outputVariable: string;
}

/**
 * Branch (conditional) step
 */
export interface BranchStep extends BaseExecutionStep {
  type: ExecutionStepType.BRANCH;
  condition: Expression;
  thenSteps: ExecutionStep[];
  elseSteps?: ExecutionStep[];
}

/**
 * Loop step
 */
export interface LoopStep extends BaseExecutionStep {
  type: ExecutionStepType.LOOP;
  iteratorVariable: string;
  collectionVariable: string;
  bodySteps: ExecutionStep[];
  parallel?: boolean;
}

/**
 * Parallel execution step
 */
export interface ParallelStep extends BaseExecutionStep {
  type: ExecutionStepType.PARALLEL;
  steps: ExecutionStep[];
}

/**
 * Sequential execution step
 */
export interface SequentialStep extends BaseExecutionStep {
  type: ExecutionStepType.SEQUENTIAL;
  steps: ExecutionStep[];
}

/**
 * Variable assignment step
 */
export interface AssignStep extends BaseExecutionStep {
  type: ExecutionStepType.ASSIGN;
  variable: string;
  value: Expression;
}

/**
 * Read variable step
 */
export interface ReadVariableStep extends BaseExecutionStep {
  type: ExecutionStepType.READ_VARIABLE;
  variable: string;
  outputVariable: string;
}

/**
 * Write variable step
 */
export interface WriteVariableStep extends BaseExecutionStep {
  type: ExecutionStepType.WRITE_VARIABLE;
  variable: string;
  value: Expression;
}

/**
 * Union of all execution step types
 */
export type ExecutionStep =
  | NavigateStep
  | DOMQueryStep
  | ClickStep
  | TypeStep
  | WaitStep
  | ScreenshotStep
  | PDFStep
  | EvaluateJSStep
  | InterceptRequestStep
  | ModifyRequestStep
  | CacheLookupStep
  | CacheStoreStep
  | FilterStep
  | MapStep
  | ReduceStep
  | JoinStep
  | SortStep
  | LimitStep
  | BranchStep
  | LoopStep
  | ParallelStep
  | SequentialStep
  | AssignStep
  | ReadVariableStep
  | WriteVariableStep;

/**
 * Resource requirements for execution
 */
export interface ResourceRequirements {
  browsers: number; // Number of browser instances needed
  pages: number; // Number of pages/tabs needed
  connections: number; // Number of network connections
  memory: number; // Estimated memory usage in MB
  cpu: number; // Estimated CPU usage (0-100)
}

/**
 * Dependency graph node
 */
export interface DependencyNode {
  stepId: string;
  step: ExecutionStep;
  dependencies: string[]; // Step IDs this depends on
  dependents: string[]; // Step IDs that depend on this
}

/**
 * Dependency graph
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  roots: string[]; // Step IDs with no dependencies
  leaves: string[]; // Step IDs with no dependents
}

/**
 * Execution plan
 */
export interface ExecutionPlan {
  readonly id: QueryID;
  readonly query: Statement;
  steps: ExecutionStep[];
  estimatedCost: DurationMs;
  resources: ResourceRequirements;
  dependencies: DependencyGraph;
  cacheableSteps: string[]; // IDs of cacheable steps
  parallelGroups: string[][]; // Groups of step IDs that can run in parallel
  metadata: {
    optimizationApplied: boolean;
    appliedPasses: string[];
    estimatedImprovement: number;
  };
}

/**
 * Execution step result
 */
export interface StepResult {
  stepId: string;
  success: boolean;
  data?: unknown;
  error?: Error;
  timing: {
    startTime: number;
    endTime: number;
    duration: DurationMs;
  };
  cacheHit?: boolean;
}

/**
 * Execution context
 */
export interface ExecutionContext {
  queryId: QueryID;
  variables: Map<string, unknown>;
  stepResults: Map<string, StepResult>;
  currentPage?: unknown; // Reference to browser page
  currentBrowser?: unknown; // Reference to browser instance
  cache?: Map<string, unknown>; // Cache storage
}
