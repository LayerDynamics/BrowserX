/**
 * BrowserX Runtime Types
 *
 * Core type definitions for the unified runtime system.
 */

/**
 * Runtime state machine states
 */
export enum RuntimeState {
  STOPPED = "stopped",
  STARTING = "starting",
  RUNNING = "running",
  STOPPING = "stopping",
  ERROR = "error",
}

/**
 * Component identifier for tracked subsystems
 */
export type ComponentId =
  | "proxy-engine"
  | "browser-engine"
  | "query-engine"
  | "event-coordinator"
  | "resource-manager"
  | "metrics-collector"
  | "browser-pool";

/**
 * State of an individual component
 */
export interface ComponentState {
  readonly id: ComponentId;
  state: RuntimeState;
  startedAt?: number;
  stoppedAt?: number;
  error?: Error;
  stats?: Record<string, unknown>;
}

/**
 * Runtime event types for lifecycle notifications
 */
export type RuntimeEvent =
  | { type: "state_change"; from: RuntimeState; to: RuntimeState }
  | { type: "component_starting"; componentId: ComponentId }
  | { type: "component_started"; componentId: ComponentId }
  | { type: "component_stopping"; componentId: ComponentId }
  | { type: "component_stopped"; componentId: ComponentId }
  | { type: "component_error"; componentId: ComponentId; error: Error }
  | { type: "signal_received"; signal: string }
  | { type: "shutdown_initiated"; reason: string }
  | { type: "shutdown_timeout"; elapsed: number }
  | { type: "shutdown_complete"; duration: number }
  | { type: "health_check"; status: HealthStatus; details: HealthCheckResult }
  | { type: "event_loop_started"; loopType: "proxy" | "browser"; id?: string }
  | { type: "event_loop_stopped"; loopType: "proxy" | "browser"; id?: string };

/**
 * Runtime event listener callback
 */
export type RuntimeEventListener = (event: RuntimeEvent) => void;

/**
 * Health status levels
 */
export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/**
 * Health check result for a component
 */
export interface ComponentHealthCheck {
  componentId: ComponentId;
  status: HealthStatus;
  message?: string;
  latency?: number;
  lastCheck: number;
}

/**
 * Overall health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  components: ComponentHealthCheck[];
  timestamp: number;
}

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

/**
 * Resource usage statistics
 */
export interface ResourceStats {
  browserInstances: number;
  activeSessions: number;
  activePages: number;
  connectionPools: number;
  activeConnections: number;
  pendingRequests: number;
}

/**
 * Query execution statistics
 */
export interface QueryStats {
  total: number;
  active: number;
  successful: number;
  failed: number;
  cancelled: number;
  averageExecutionTime: number;
}

/**
 * Event loop statistics
 */
export interface EventLoopStats {
  proxyLoopRunning: boolean;
  browserLoopsActive: number;
  proxyTasksQueued: number;
  proxyTimersActive: number;
}

/**
 * Complete runtime statistics
 */
export interface RuntimeStats {
  state: RuntimeState;
  uptime: number;
  startedAt?: number;
  components: ComponentState[];
  memory: MemoryStats;
  resources: ResourceStats;
  queries: QueryStats;
  eventLoops: EventLoopStats;
  health: HealthCheckResult;
}

/**
 * Initialization step definition
 */
export interface InitializationStep {
  name: string;
  component: ComponentId;
  execute: () => Promise<void>;
  dependencies: ComponentId[];
  optional?: boolean;
  timeout?: number;
}

/**
 * Shutdown step definition
 */
export interface ShutdownStep {
  name: string;
  component: ComponentId;
  execute: () => Promise<void>;
  timeout: number;
  graceful?: boolean;
}

/**
 * Log levels
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Environment types
 */
export type Environment = "development" | "production" | "test";

/**
 * Signal types handled by the runtime
 */
export type SignalType = "SIGINT" | "SIGTERM" | "SIGHUP";

/**
 * Signal handler callback
 */
export type SignalCallback = (signal: SignalType) => void;
