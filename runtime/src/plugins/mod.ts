/**
 * BrowserX Plugin System Module
 *
 * Re-exports all plugin types, classes, and interfaces for the
 * BrowserX plugin system.
 *
 * @module @browserx/runtime/plugins
 */

// Core types
export type {
  DevToolsDomainDefinition,
  DevToolsMethod,
  Disposable,
  FunctionImplementation,
  FunctionSignature,
  MCPToolDefinition,
  MiddlewareContext,
  MiddlewareRequest,
  MiddlewareResponse,
  MiddlewareResult,
  Plugin,
  PluginConfig,
  PluginContributions,
  PluginContext,
  PluginEntry,
  PluginEvent,
  PluginInfo,
  PluginLogger,
  PluginManifest,
  PluginState,
  RequestMiddleware,
  ResponseMiddleware,
} from "./types.ts";

// Plugin Manager
export { PluginManager, type PluginManagerOptions } from "./PluginManager.ts";

// Plugin Context implementation
export { PluginContextImpl, type PluginContextOptions } from "./PluginContext.ts";

// Plugin Registry
export { PluginRegistry } from "./PluginRegistry.ts";

// Plugin Loader
export { PluginLoader, type PluginLoadResult } from "./PluginLoader.ts";
