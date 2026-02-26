/**
 * BrowserX Plugin System Types
 *
 * Core type definitions for the plugin system. Defines the Plugin interface,
 * manifest format, lifecycle states, and all contribution point interfaces.
 */

import type {
  ComponentId,
  HealthStatus,
  InitializationStep,
  RuntimeEvent,
  RuntimeEventListener,
  ShutdownStep,
} from "../types.ts";

import type { BrowserXRuntimeConfig } from "../config/RuntimeConfig.ts";
import type { BrowserPool } from "../resources/BrowserPool.ts";
import type { HealthCheckHandler } from "../metrics/HealthChecker.ts";

// ── Plugin Interface ──

/**
 * Plugin interface that all BrowserX plugins must implement.
 *
 * @example
 * ```typescript
 * export default class MyPlugin implements Plugin {
 *   readonly id = "my-plugin";
 *   readonly name = "My Plugin";
 *   readonly version = "1.0.0";
 *
 *   async activate(context: PluginContext): Promise<void> {
 *     context.addRequestMiddleware({ ... });
 *   }
 *
 *   async deactivate(): Promise<void> {
 *     // All contributions auto-cleaned via Disposable pattern
 *   }
 * }
 * ```
 */
export interface Plugin {
  /** Unique plugin identifier (e.g., "browserx-plugin-analytics") */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Semantic version */
  readonly version: string;
  /** Optional dependencies on other plugins */
  readonly dependencies?: string[];
  /** Plugin description */
  readonly description?: string;

  /** Called when plugin is loaded — register contributions here */
  activate(context: PluginContext): Promise<void>;
  /** Called when plugin is unloaded — clean up resources */
  deactivate(): Promise<void>;
}

// ── Plugin Manifest ──

/**
 * Plugin manifest describing a plugin's metadata and capabilities.
 * Used for validation before loading the plugin module.
 */
export interface PluginManifest {
  /** Unique plugin identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version (e.g., "1.0.0") */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin author */
  author?: string;
  /** Dependencies on other plugins (by plugin id) */
  dependencies?: string[];
  /** Entry point module path (relative to plugin root) */
  main: string;
  /** Contribution point declarations (for validation before loading) */
  contributes?: PluginContributions;
  /** Plugin-specific configuration schema */
  configSchema?: Record<string, unknown>;
}

/**
 * Declaration of what contribution points a plugin uses.
 * Used for validation and documentation before activation.
 */
export interface PluginContributions {
  middleware?: boolean;
  queryFunctions?: boolean;
  mcpTools?: boolean;
  devtoolsDomains?: boolean;
  healthChecks?: boolean;
  commands?: boolean;
}

// ── Plugin State ──

/**
 * Plugin lifecycle states.
 *
 * State machine:
 * installed → activating → active → deactivating → inactive
 *                ↓                       ↓
 *              error ←──────────────── error
 */
export type PluginState =
  | "installed"
  | "activating"
  | "active"
  | "deactivating"
  | "inactive"
  | "error";

// ── Plugin Info ──

/**
 * Runtime information about an installed plugin.
 */
export interface PluginInfo {
  /** The plugin instance */
  plugin: Plugin;
  /** Current lifecycle state */
  state: PluginState;
  /** When the plugin was activated (undefined if never activated) */
  activatedAt?: number;
  /** When the plugin was deactivated (undefined if never deactivated) */
  deactivatedAt?: number;
  /** Error that caused the plugin to enter error state */
  error?: Error;
  /** Disposables registered by this plugin (for cleanup) */
  disposables: Disposable[];
}

// ── Disposable ──

/**
 * Returned by registration methods — call dispose() to unregister.
 * Used by PluginManager to automatically clean up all contributions
 * when a plugin is deactivated.
 */
export interface Disposable {
  dispose(): void;
}

// ── Plugin Context ──

/**
 * API surface exposed to plugins during activation.
 * Provides scoped access to runtime subsystems and contribution registration.
 */
export interface PluginContext {
  /** Plugin's own ID */
  readonly pluginId: string;
  /** Runtime config (read-only) */
  readonly config: Readonly<BrowserXRuntimeConfig>;
  /** Plugin-specific config from runtime config */
  readonly pluginConfig: Record<string, unknown>;

  // ── Contribution registration ──

  /** Register proxy request middleware */
  addRequestMiddleware(middleware: RequestMiddleware, priority?: number): Disposable;
  /** Register proxy response middleware */
  addResponseMiddleware(middleware: ResponseMiddleware, priority?: number): Disposable;

  /** Register query engine functions */
  registerQueryFunction(func: FunctionImplementation): Disposable;

  /** Register MCP tools (available when MCP server is running) */
  registerMCPTool(tool: MCPToolDefinition): Disposable;

  /** Register devtools domains */
  registerDevToolsDomain(domain: DevToolsDomainDefinition): Disposable;

  /** Register health check handlers */
  registerHealthCheck(id: string, handler: HealthCheckHandler): Disposable;

  /** Register custom initialization step */
  registerInitStep(step: InitializationStep): Disposable;
  /** Register custom shutdown step */
  registerShutdownStep(step: ShutdownStep): Disposable;

  // ── Runtime access (scoped) ──

  /** Subscribe to runtime events */
  addEventListener(listener: RuntimeEventListener): Disposable;

  /** Access browser pool (for plugins that need browser instances) */
  getBrowserPool(): BrowserPool;

  /** Access query engine */
  getQueryEngine(): unknown;

  /** Access proxy runtime */
  getProxyRuntime(): unknown;

  /** Plugin-scoped logger */
  log: PluginLogger;
}

// ── Middleware Types ──

/**
 * Request middleware for proxy engine integration.
 */
export interface RequestMiddleware {
  /** Unique name for this middleware */
  name: string;
  /** Process an incoming request. Return continue to pass through, or modify/block. */
  processRequest(
    request: MiddlewareRequest,
    context: MiddlewareContext,
  ): Promise<MiddlewareResult>;
}

/**
 * Response middleware for proxy engine integration.
 */
export interface ResponseMiddleware {
  /** Unique name for this middleware */
  name: string;
  /** Process an outgoing response. Return continue to pass through, or modify. */
  processResponse(
    response: MiddlewareResponse,
    context: MiddlewareContext,
  ): Promise<MiddlewareResult>;
}

/**
 * Simplified request representation for middleware.
 */
export interface MiddlewareRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: Uint8Array;
}

/**
 * Simplified response representation for middleware.
 */
export interface MiddlewareResponse {
  status: number;
  headers: Record<string, string>;
  body?: Uint8Array;
}

/**
 * Middleware execution context.
 */
export interface MiddlewareContext {
  /** Unique request identifier */
  requestId: string;
  /** Timestamp when the request was received */
  timestamp: number;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Result from middleware processing.
 */
export type MiddlewareResult =
  | { type: "continue" }
  | { type: "modify"; request?: MiddlewareRequest; response?: MiddlewareResponse }
  | { type: "block"; reason: string };

// ── Query Function Types ──

/**
 * Query function implementation for registering custom functions
 * with the query engine.
 */
export interface FunctionImplementation {
  /** Function signature metadata */
  signature: FunctionSignature;
  /** Function execution handler */
  execute: (...args: unknown[]) => unknown;
}

/**
 * Function signature for query engine registration.
 */
export interface FunctionSignature {
  /** Function name (e.g., "ANALYTICS") */
  name: string;
  /** Function category */
  category: string;
  /** Minimum number of arguments */
  minArgs: number;
  /** Maximum number of arguments */
  maxArgs: number;
  /** Argument type descriptors */
  argTypes: string[];
  /** Return type descriptor */
  returnType: string;
}

// ── MCP Tool Types ──

/**
 * MCP tool definition for registering tools with the MCP server.
 */
export interface MCPToolDefinition {
  /** Tool name (e.g., "browser_analytics") */
  name: string;
  /** Tool description for LLM consumption */
  description: string;
  /** JSON Schema for tool input parameters */
  inputSchema: Record<string, unknown>;
  /** Tool execution handler */
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

// ── DevTools Domain Types ──

/**
 * DevTools domain definition for registering domains with the DevTools protocol.
 */
export interface DevToolsDomainDefinition {
  /** Domain name (e.g., "Analytics") */
  name: string;
  /** Domain version */
  version: string;
  /** Domain description */
  description?: string;
  /** Domain methods */
  methods: Record<string, DevToolsMethod>;
  /** Domain events */
  events?: string[];
}

/**
 * A single DevTools protocol method.
 */
export interface DevToolsMethod {
  /** Method description */
  description?: string;
  /** Method handler */
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

// ── Plugin Logger ──

/**
 * Plugin-scoped logger that prefixes messages with the plugin ID.
 */
export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// ── Plugin Configuration ──

/**
 * Plugin system configuration within BrowserXRuntimeConfig.
 */
export interface PluginConfig {
  /** Enable the plugin system */
  enabled: boolean;
  /** Directories to scan for plugins */
  pluginDirs: string[];
  /** Explicit plugin paths/URLs to load */
  plugins: PluginEntry[];
  /** Plugin activation timeout in milliseconds */
  activationTimeout: number;
}

/**
 * Individual plugin entry in configuration.
 */
export interface PluginEntry {
  /** Path to the plugin module (local filesystem or URL) */
  path: string;
  /** Whether this plugin should be activated */
  enabled: boolean;
  /** Plugin-specific configuration */
  config?: Record<string, unknown>;
}

// ── Plugin Events ──

/**
 * Plugin-specific runtime events.
 * These extend the RuntimeEvent union type.
 */
export type PluginEvent =
  | { type: "plugin_activating"; pluginId: string }
  | { type: "plugin_activated"; pluginId: string }
  | { type: "plugin_deactivating"; pluginId: string }
  | { type: "plugin_deactivated"; pluginId: string }
  | { type: "plugin_error"; pluginId: string; error: Error };

// Re-export types used by plugin consumers
export type {
  BrowserXRuntimeConfig,
  ComponentId,
  HealthCheckHandler,
  HealthStatus,
  InitializationStep,
  RuntimeEvent,
  RuntimeEventListener,
  ShutdownStep,
};

// Re-export BrowserPool type for plugin consumers
export type { BrowserPool };
