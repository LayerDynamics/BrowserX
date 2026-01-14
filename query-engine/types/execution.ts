/**
 * Execution-related type definitions
 */

import { Bytes, DurationMs, QueryID, StepID, TraceID } from "./primitives.ts";
import { Statement } from "./ast.ts";

// Re-export execution types from planner (source of truth for these types)
export type {
  DependencyGraph,
  ExecutionPlan,
  ExecutionStep,
  ResourceRequirements,
} from "../planner/plan.ts";

// Import for use within this file
import type { ExecutionPlan } from "../planner/plan.ts";

/**
 * Query execution state machine
 */
export enum QueryExecutionState {
  PENDING = "PENDING",
  LEXING = "LEXING",
  PARSING = "PARSING",
  ANALYZING = "ANALYZING",
  OPTIMIZING = "OPTIMIZING",
  PLANNING = "PLANNING",
  EXECUTING = "EXECUTING",
  FORMATTING = "FORMATTING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  TIMEOUT = "TIMEOUT",
}

/**
 * Step execution state machine
 */
export enum StepExecutionState {
  PENDING = "PENDING",
  READY = "READY",
  EXECUTING = "EXECUTING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  SKIPPED = "SKIPPED",
  RETRYING = "RETRYING",
}

/**
 * Query result
 */
export interface QueryResult {
  readonly queryId: QueryID;
  data: unknown;
  timing: QueryTiming;
  metadata: QueryMetadata;
  traceId?: TraceID;
}

/**
 * Query timing breakdown
 */
export interface QueryTiming {
  lexerTime: DurationMs;
  parserTime: DurationMs;
  semanticAnalysisTime: DurationMs;
  optimizationTime: DurationMs;
  planningTime: DurationMs;
  executionTime: DurationMs;
  formattingTime: DurationMs;
  totalTime: DurationMs;
}

/**
 * Query metadata
 */
export interface QueryMetadata {
  query: string;
  ast?: Statement;
  plan?: ExecutionPlan;
  stepsExecuted: number;
  estimatedCost: DurationMs;
  actualCost: DurationMs;
  browserNavigations: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Query options
 */
export interface QueryOptions {
  timeout?: DurationMs;
  permissions?: Permission[];
  format?: OutputFormat;
  stream?: boolean;
  trace?: boolean;
  profile?: boolean;
}

export enum Permission {
  NAVIGATE_PUBLIC = "NAVIGATE_PUBLIC",
  NAVIGATE_PRIVATE = "NAVIGATE_PRIVATE",
  READ_COOKIES = "READ_COOKIES",
  WRITE_COOKIES = "WRITE_COOKIES",
  READ_STORAGE = "READ_STORAGE",
  WRITE_STORAGE = "WRITE_STORAGE",
  EXECUTE_JS = "EXECUTE_JS",
  INTERCEPT_TRAFFIC = "INTERCEPT_TRAFFIC",
  MODIFY_REQUESTS = "MODIFY_REQUESTS",
  SCREENSHOT = "SCREENSHOT",
  FILE_DOWNLOAD = "FILE_DOWNLOAD",
  FILE_UPLOAD = "FILE_UPLOAD",
  DOM_QUERY = "DOM_QUERY",
  CLICK = "CLICK",
  TYPE = "TYPE",
  PDF = "PDF",
  CACHE_RESPONSES = "CACHE_RESPONSES",
}

export type OutputFormat = "JSON" | "TABLE" | "CSV" | "HTML" | "XML" | "YAML" | "STREAM";

/**
 * Query status (for async execution)
 */
export interface QueryStatus {
  readonly queryId: QueryID;
  state: QueryExecutionState;
  progress: number; // 0-100
  currentStep?: StepID;
  stepsCompleted: number;
  stepsTotal: number;
  error?: Error;
}
