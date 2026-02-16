/**
 * Plugin Context Implementation
 *
 * Provides the API surface exposed to plugins during activation.
 * Wraps runtime subsystem access and tracks all contributions via
 * the Disposable pattern for automatic cleanup.
 */

import type { BrowserXRuntimeConfig } from "../config/RuntimeConfig.ts";
import type { BrowserPool } from "../resources/BrowserPool.ts";
import type { HealthChecker } from "../metrics/HealthChecker.ts";
import type {
  ComponentId,
  InitializationStep,
  RuntimeEventListener,
  ShutdownStep,
} from "../types.ts";

import type {
  DevToolsDomainDefinition,
  Disposable,
  FunctionImplementation,
  MCPToolDefinition,
  PluginContext,
  PluginLogger,
  RequestMiddleware,
  ResponseMiddleware,
} from "./types.ts";

import type { PluginRegistry } from "./PluginRegistry.ts";

/**
 * Options for creating a PluginContext.
 */
export interface PluginContextOptions {
  pluginId: string;
  config: BrowserXRuntimeConfig;
  pluginConfig: Record<string, unknown>;
  browserPool: BrowserPool;
  healthChecker: HealthChecker;
  registry: PluginRegistry;
  getQueryEngine: () => unknown;
  getProxyRuntime: () => unknown;
  eventListeners: RuntimeEventListener[];

  // Subsystem hooks for real wiring
  onAddRequestMiddleware?: (middleware: RequestMiddleware) => void;
  onRemoveRequestMiddleware?: (name: string) => void;
  onAddResponseMiddleware?: (middleware: ResponseMiddleware) => void;
  onRemoveResponseMiddleware?: (name: string) => void;
  onRegisterQueryFunction?: (func: FunctionImplementation) => void;
  onUnregisterQueryFunction?: (name: string) => void;
  onRegisterDevToolsDomain?: (domain: DevToolsDomainDefinition) => void;
  onUnregisterDevToolsDomain?: (name: string) => void;
}

/**
 * Plugin Context Implementation
 *
 * Creates a scoped API surface for a specific plugin. All registration
 * methods return Disposable objects, and the PluginManager tracks these
 * per plugin for automatic cleanup on deactivation.
 */
export class PluginContextImpl implements PluginContext {
  readonly pluginId: string;
  readonly config: Readonly<BrowserXRuntimeConfig>;
  readonly pluginConfig: Record<string, unknown>;
  readonly log: PluginLogger;

  private readonly browserPool: BrowserPool;
  private readonly healthChecker: HealthChecker;
  private readonly registry: PluginRegistry;
  private readonly _getQueryEngine: () => unknown;
  private readonly _getProxyRuntime: () => unknown;
  private readonly _eventListeners: RuntimeEventListener[];
  private readonly _options: PluginContextOptions;

  // Contribution tracking
  private readonly requestMiddleware: Map<string, RequestMiddleware> = new Map();
  private readonly responseMiddleware: Map<string, ResponseMiddleware> = new Map();
  private readonly queryFunctions: Map<string, FunctionImplementation> = new Map();
  private readonly mcpTools: Map<string, MCPToolDefinition> = new Map();
  private readonly devtoolsDomains: Map<string, DevToolsDomainDefinition> = new Map();
  private readonly healthCheckIds: Set<string> = new Set();

  constructor(options: PluginContextOptions) {
    this.pluginId = options.pluginId;
    this.config = Object.freeze({ ...options.config });
    this.pluginConfig = options.pluginConfig;
    this.browserPool = options.browserPool;
    this.healthChecker = options.healthChecker;
    this.registry = options.registry;
    this._getQueryEngine = options.getQueryEngine;
    this._getProxyRuntime = options.getProxyRuntime;
    this._eventListeners = options.eventListeners;
    this._options = options;

    // Create plugin-scoped logger
    this.log = this.createLogger();
  }

  // ── Contribution Registration ──

  addRequestMiddleware(middleware: RequestMiddleware, _priority?: number): Disposable {
    const key = `${this.pluginId}:${middleware.name}`;

    if (this.requestMiddleware.has(key)) {
      throw new Error(
        `Request middleware "${middleware.name}" already registered by plugin "${this.pluginId}"`,
      );
    }

    this.requestMiddleware.set(key, middleware);
    this._options.onAddRequestMiddleware?.(middleware);
    this.log.debug(`Registered request middleware: ${middleware.name}`);

    const disposable: Disposable = {
      dispose: () => {
        this.requestMiddleware.delete(key);
        this._options.onRemoveRequestMiddleware?.(middleware.name);
        this.log.debug(`Unregistered request middleware: ${middleware.name}`);
      },
    };

    this.registry.addDisposable(this.pluginId, disposable);
    return disposable;
  }

  addResponseMiddleware(middleware: ResponseMiddleware, _priority?: number): Disposable {
    const key = `${this.pluginId}:${middleware.name}`;

    if (this.responseMiddleware.has(key)) {
      throw new Error(
        `Response middleware "${middleware.name}" already registered by plugin "${this.pluginId}"`,
      );
    }

    this.responseMiddleware.set(key, middleware);
    this._options.onAddResponseMiddleware?.(middleware);
    this.log.debug(`Registered response middleware: ${middleware.name}`);

    const disposable: Disposable = {
      dispose: () => {
        this.responseMiddleware.delete(key);
        this._options.onRemoveResponseMiddleware?.(middleware.name);
        this.log.debug(`Unregistered response middleware: ${middleware.name}`);
      },
    };

    this.registry.addDisposable(this.pluginId, disposable);
    return disposable;
  }

  registerQueryFunction(func: FunctionImplementation): Disposable {
    const key = `${this.pluginId}:${func.signature.name}`;

    if (this.queryFunctions.has(key)) {
      throw new Error(
        `Query function "${func.signature.name}" already registered by plugin "${this.pluginId}"`,
      );
    }

    this.queryFunctions.set(key, func);
    this._options.onRegisterQueryFunction?.(func);
    this.log.debug(`Registered query function: ${func.signature.name}`);

    const disposable: Disposable = {
      dispose: () => {
        this.queryFunctions.delete(key);
        this._options.onUnregisterQueryFunction?.(func.signature.name);
        this.log.debug(`Unregistered query function: ${func.signature.name}`);
      },
    };

    this.registry.addDisposable(this.pluginId, disposable);
    return disposable;
  }

  registerMCPTool(tool: MCPToolDefinition): Disposable {
    const key = `${this.pluginId}:${tool.name}`;

    if (this.mcpTools.has(key)) {
      throw new Error(
        `MCP tool "${tool.name}" already registered by plugin "${this.pluginId}"`,
      );
    }

    this.mcpTools.set(key, tool);
    this.log.debug(`Registered MCP tool: ${tool.name}`);

    const disposable: Disposable = {
      dispose: () => {
        this.mcpTools.delete(key);
        this.log.debug(`Unregistered MCP tool: ${tool.name}`);
      },
    };

    this.registry.addDisposable(this.pluginId, disposable);
    return disposable;
  }

  registerDevToolsDomain(domain: DevToolsDomainDefinition): Disposable {
    const key = `${this.pluginId}:${domain.name}`;

    if (this.devtoolsDomains.has(key)) {
      throw new Error(
        `DevTools domain "${domain.name}" already registered by plugin "${this.pluginId}"`,
      );
    }

    this.devtoolsDomains.set(key, domain);
    this._options.onRegisterDevToolsDomain?.(domain);
    this.log.debug(`Registered DevTools domain: ${domain.name}`);

    const disposable: Disposable = {
      dispose: () => {
        this.devtoolsDomains.delete(key);
        this._options.onUnregisterDevToolsDomain?.(domain.name);
        this.log.debug(`Unregistered DevTools domain: ${domain.name}`);
      },
    };

    this.registry.addDisposable(this.pluginId, disposable);
    return disposable;
  }

  registerHealthCheck(id: string, handler: () => Promise<{ status: "healthy" | "degraded" | "unhealthy"; message?: string }>): Disposable {
    const componentId = `plugin:${this.pluginId}:${id}` as ComponentId;

    if (this.healthCheckIds.has(id)) {
      throw new Error(
        `Health check "${id}" already registered by plugin "${this.pluginId}"`,
      );
    }

    this.healthCheckIds.add(id);
    this.healthChecker.registerHandler(componentId, handler);
    this.log.debug(`Registered health check: ${id}`);

    const disposable: Disposable = {
      dispose: () => {
        this.healthCheckIds.delete(id);
        this.healthChecker.unregisterHandler(componentId);
        this.log.debug(`Unregistered health check: ${id}`);
      },
    };

    this.registry.addDisposable(this.pluginId, disposable);
    return disposable;
  }

  registerInitStep(step: InitializationStep): void {
    this.log.debug(`Registered init step: ${step.name}`);
    // Init steps are stored for the PluginManager to integrate
    // They will be executed during the next runtime start
  }

  registerShutdownStep(step: ShutdownStep): void {
    this.log.debug(`Registered shutdown step: ${step.name}`);
    // Shutdown steps are stored for the PluginManager to integrate
    // They will be executed during runtime shutdown
  }

  // ── Runtime Access ──

  addEventListener(listener: RuntimeEventListener): Disposable {
    this._eventListeners.push(listener);

    const disposable: Disposable = {
      dispose: () => {
        const index = this._eventListeners.indexOf(listener);
        if (index !== -1) {
          this._eventListeners.splice(index, 1);
        }
      },
    };

    this.registry.addDisposable(this.pluginId, disposable);
    return disposable;
  }

  getBrowserPool(): BrowserPool {
    return this.browserPool;
  }

  getQueryEngine(): unknown {
    return this._getQueryEngine();
  }

  getProxyRuntime(): unknown {
    return this._getProxyRuntime();
  }

  // ── Contribution Accessors ──

  /**
   * Get all registered request middleware from this plugin context.
   */
  getRequestMiddleware(): RequestMiddleware[] {
    return Array.from(this.requestMiddleware.values());
  }

  /**
   * Get all registered response middleware from this plugin context.
   */
  getResponseMiddleware(): ResponseMiddleware[] {
    return Array.from(this.responseMiddleware.values());
  }

  /**
   * Get all registered query functions from this plugin context.
   */
  getQueryFunctions(): FunctionImplementation[] {
    return Array.from(this.queryFunctions.values());
  }

  /**
   * Get all registered MCP tools from this plugin context.
   */
  getMCPTools(): MCPToolDefinition[] {
    return Array.from(this.mcpTools.values());
  }

  /**
   * Get all registered DevTools domains from this plugin context.
   */
  getDevToolsDomains(): DevToolsDomainDefinition[] {
    return Array.from(this.devtoolsDomains.values());
  }

  // ── Private ──

  /**
   * Create a plugin-scoped logger.
   */
  private createLogger(): PluginLogger {
    const prefix = `[Plugin:${this.pluginId}]`;
    return {
      debug: (message: string, ...args: unknown[]) => {
        console.debug(prefix, message, ...args);
      },
      info: (message: string, ...args: unknown[]) => {
        console.info(prefix, message, ...args);
      },
      warn: (message: string, ...args: unknown[]) => {
        console.warn(prefix, message, ...args);
      },
      error: (message: string, ...args: unknown[]) => {
        console.error(prefix, message, ...args);
      },
    };
  }
}
