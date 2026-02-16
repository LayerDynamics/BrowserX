/**
 * Visibility System Types
 * Types for exposing system state, operations, and health to agents
 *
 * These types define the data structures for the visibility dashboard
 * that provides real-time insight into MCP server operations.
 */

/**
 * Operation types for tracking
 */
export type OperationType =
  | "navigate"
  | "click"
  | "type"
  | "screenshot"
  | "pdf"
  | "evaluate"
  | "wait"
  | "query"
  | "query_dom"
  | "cache_get"
  | "cache_set"
  | "cache_clear"
  | "interceptor"
  | "session_create"
  | "session_close"
  | "other";

/**
 * Enhanced session information
 */
export interface EnhancedSessionInfo {
  /** Session ID */
  id: string;
  /** Current URL */
  url?: string;
  /** Page title (if available) */
  pageTitle?: string;
  /** When session was created (Unix timestamp) */
  createdAt: number;
  /** When session was last used (Unix timestamp) */
  lastUsedAt: number;
  /** Time idle in milliseconds */
  idleTimeMs: number;
  /** Estimated memory usage in bytes */
  memoryEstimateBytes: number;
  /** Number of pending operations for this session */
  pendingOperations: number;
  /** Session permissions */
  permissions: string[];
}

/**
 * Query execution state
 */
export type QueryState =
  | "PENDING"
  | "LEXING"
  | "PARSING"
  | "ANALYZING"
  | "OPTIMIZING"
  | "PLANNING"
  | "EXECUTING"
  | "FORMATTING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "TIMEOUT";

/**
 * Running query information
 */
export interface RunningQueryInfo {
  /** Query ID */
  queryId: string;
  /** Query text (truncated if long) */
  query: string;
  /** Current state */
  state: QueryState;
  /** Progress percentage (0-100) */
  progress: number;
  /** Steps completed */
  stepsCompleted: number;
  /** Total steps */
  stepsTotal: number;
  /** When query started (Unix timestamp) */
  startedAt: number;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
  /** Estimated remaining time in milliseconds */
  estimatedRemainingMs?: number;
  /** Current step name */
  currentStep?: string;
}

/**
 * Active operation tracking
 */
export interface ActiveOperation {
  /** Operation ID */
  id: string;
  /** Operation type */
  type: OperationType;
  /** Session ID if applicable */
  sessionId?: string;
  /** When operation started (Unix timestamp) */
  startedAt: number;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
  /** Human-readable description */
  description: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Memory usage information
 */
export interface MemoryInfo {
  /** Heap memory used in MB */
  heapUsedMB: number;
  /** Total heap memory in MB */
  heapTotalMB: number;
  /** Resident set size in MB */
  rssMB: number;
  /** External memory in MB */
  externalMB: number;
  /** Usage percentage (heapUsed / heapTotal) */
  usagePercent: number;
}

/**
 * Session statistics
 */
export interface SessionStats {
  /** Currently active sessions */
  active: number;
  /** Maximum allowed sessions */
  max: number;
  /** Total sessions created since start */
  totalCreated: number;
  /** Total sessions closed since start */
  totalClosed: number;
}

/**
 * Query statistics
 */
export interface QueryStats {
  /** Total queries executed */
  total: number;
  /** Currently active queries */
  active: number;
  /** Successful queries */
  successful: number;
  /** Failed queries */
  failed: number;
  /** Cancelled queries */
  cancelled: number;
  /** Average execution time in milliseconds */
  avgExecutionMs: number;
}

/**
 * Operation statistics
 */
export interface OperationStats {
  /** Currently active operations */
  active: number;
  /** Operations completed in last minute */
  completedLastMinute: number;
  /** Requests per second (recent average) */
  requestsPerSecond: number;
}

/**
 * Error statistics
 */
export interface ErrorStats {
  /** Total errors since start */
  total: number;
  /** Errors in last hour */
  lastHour: number;
  /** Error rate (errors per minute, recent average) */
  rate: number;
}

/**
 * Server health status
 */
export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/**
 * Server health metrics
 */
export interface ServerHealthMetrics {
  /** Overall health status */
  status: HealthStatus;
  /** Uptime in milliseconds */
  uptime: number;
  /** Formatted uptime string */
  uptimeFormatted: string;
  /** Memory usage */
  memory: MemoryInfo;
  /** Session statistics */
  sessions: SessionStats;
  /** Query statistics */
  queries: QueryStats;
  /** Operation statistics */
  operations: OperationStats;
  /** Error statistics */
  errors: ErrorStats;
}

/**
 * Complete visibility dashboard
 */
export interface VisibilityDashboard {
  /** When this snapshot was taken (Unix timestamp) */
  timestamp: number;
  /** Server health metrics */
  server: ServerHealthMetrics;
  /** Active sessions with details */
  sessions: EnhancedSessionInfo[];
  /** Currently running queries */
  runningQueries: RunningQueryInfo[];
  /** Currently active operations */
  activeOperations: ActiveOperation[];
  /** Human-readable summary */
  summary: string;
}

/**
 * Operation tracker statistics
 */
export interface OperationTrackerStats {
  /** Currently active operations */
  active: number;
  /** Operations completed in last minute */
  completedLastMinute: number;
  /** Requests per second (last second) */
  requestsPerSecond: number;
  /** Errors in last hour */
  errorsLastHour: number;
  /** Error rate (per minute) */
  errorRate: number;
}

/**
 * Format uptime milliseconds to human-readable string
 */
export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}
