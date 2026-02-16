/**
 * BrowserX Runtime Module
 *
 * Unified runtime coordinator for the BrowserX system.
 * Provides lifecycle management, event loop coordination,
 * and cross-layer resource management.
 *
 * @module @browserx/runtime
 */

// Main runtime class
export {
  BrowserXRuntime,
  createRuntime,
  type BrowserXRuntimeOptions,
} from "./BrowserXRuntime.ts";

// Types
export {
  RuntimeState,
  type ComponentId,
  type ComponentState,
  type Environment,
  type EventLoopStats,
  type HealthCheckResult,
  type HealthStatus,
  type InitializationStep,
  type LogLevel,
  type MemoryStats,
  type QueryStats,
  type ResourceStats,
  type RuntimeEvent,
  type RuntimeEventListener,
  type RuntimeStats,
  type ShutdownStep,
  type SignalCallback,
  type SignalType,
} from "./types.ts";

// Configuration
export {
  createDefaultConfig,
  createDevelopmentConfig,
  createTestConfig,
  mergeConfig,
  type BrowserPoolConfig,
  type BrowserXRuntimeConfig,
  type EventLoopConfig,
  type MetricsConfig,
  type ProxyEngineConfig,
  type QueryEngineConfig,
  type ShutdownConfig,
  type SignalConfig,
} from "./config/mod.ts";

// Lifecycle management
export {
  InitializationSequence,
  LifecycleManager,
  ShutdownSequence,
  type InitializationProgress,
  type ShutdownProgress,
  type ShutdownStepResult,
  type StepExecutionResult,
} from "./lifecycle/mod.ts";

// Event coordination
export {
  EventCoordinator,
  type BrowserEventLoopHandle,
  type EventCoordinatorStats,
} from "./events/mod.ts";

// Resource management
export {
  BrowserPool,
  type BrowserInstance,
  type BrowserInstanceState,
  type BrowserPoolStats,
} from "./resources/mod.ts";

// Signal handling
export { SignalHandler } from "./signals/mod.ts";

// Metrics and health
export {
  HealthChecker,
  type HealthCheckHandler,
  type MetricValue,
  UnifiedMetricsCollector,
} from "./metrics/mod.ts";

// Plugin system
export {
  PluginContextImpl,
  PluginLoader,
  PluginManager,
  PluginRegistry,
  type DevToolsDomainDefinition,
  type DevToolsMethod,
  type Disposable,
  type FunctionImplementation,
  type FunctionSignature,
  type MCPToolDefinition,
  type MiddlewareContext,
  type MiddlewareRequest,
  type MiddlewareResponse,
  type MiddlewareResult,
  type Plugin,
  type PluginConfig,
  type PluginContext,
  type PluginContributions,
  type PluginContextOptions,
  type PluginEntry,
  type PluginEvent,
  type PluginInfo,
  type PluginLoadResult,
  type PluginLogger,
  type PluginManagerOptions,
  type PluginManifest,
  type PluginState,
  type RequestMiddleware,
  type ResponseMiddleware,
} from "./plugins/mod.ts";
