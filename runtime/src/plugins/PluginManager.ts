/**
 * Plugin Manager
 *
 * Core orchestrator for the plugin system. Manages the full plugin lifecycle:
 * load → validate → order → activate → deactivate.
 *
 * Integrates with the BrowserXRuntime as a new subsystem component.
 */

import type { BrowserXRuntimeConfig } from "../config/RuntimeConfig.ts";
import type { BrowserPool } from "../resources/BrowserPool.ts";
import type { HealthChecker } from "../metrics/HealthChecker.ts";
import type { RuntimeEventListener } from "../types.ts";

import type {
  DevToolsDomainDefinition,
  FunctionImplementation,
  MCPToolDefinition,
  Plugin,
  PluginConfig,
  PluginEntry,
  PluginEvent,
  PluginInfo,
  PluginState,
  RequestMiddleware,
  ResponseMiddleware,
} from "./types.ts";

import { PluginRegistry } from "./PluginRegistry.ts";
import { PluginContextImpl, type PluginContextOptions } from "./PluginContext.ts";
import { PluginLoader, type PluginLoadResult } from "./PluginLoader.ts";
import { DAG, GraphNode, GraphEdge, topologicalSort, CycleError } from "@browserx/graphx";

/**
 * Plugin Manager Options
 *
 * Provided by BrowserXRuntime when creating the PluginManager.
 */
export interface PluginManagerOptions {
  config: BrowserXRuntimeConfig;
  browserPool: BrowserPool;
  healthChecker: HealthChecker;
  getQueryEngine: () => unknown;
  getProxyRuntime: () => unknown;
}

/**
 * Plugin Manager
 *
 * Responsibilities:
 * - Load plugins from configured paths and directories
 * - Validate manifests and dependency graphs
 * - Order activation by dependency graph (topological sort)
 * - Activate/deactivate plugins with proper lifecycle
 * - Track all contributions per plugin for cleanup
 * - Emit runtime events for plugin lifecycle changes
 */
export class PluginManager {
  private readonly registry: PluginRegistry;
  private readonly loader: PluginLoader;
  private readonly options: PluginManagerOptions;
  private readonly pluginConfig: PluginConfig;
  private readonly eventListeners: RuntimeEventListener[] = [];
  private readonly pluginContexts: Map<string, PluginContextImpl> = new Map();
  private readonly activationOrder: string[] = [];
  private readonly pluginEntryMap: Map<string, PluginEntry> = new Map();
  private readonly devToolsDomainRegistry: Map<string, DevToolsDomainDefinition> = new Map();

  private started = false;

  constructor(options: PluginManagerOptions) {
    this.options = options;
    this.registry = new PluginRegistry();
    this.loader = new PluginLoader();
    this.pluginConfig = options.config.plugins ?? {
      enabled: false,
      pluginDirs: [],
      plugins: [],
      activationTimeout: 10000,
    };
  }

  // ── Lifecycle ──

  /**
   * Start the plugin manager.
   * Loads and activates all configured plugins.
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    if (!this.pluginConfig.enabled) {
      console.debug("[PluginManager] Plugin system is disabled");
      this.started = true;
      return;
    }

    console.info("[PluginManager] Starting plugin system...");

    // Phase 1: Load plugins from configured paths
    await this.loadConfiguredPlugins();

    // Phase 2: Load plugins from plugin directories
    await this.loadPluginDirectories();

    // Phase 3: Validate dependency graph
    const validationErrors = this.validateDependencies();
    if (validationErrors.length > 0) {
      for (const error of validationErrors) {
        console.error(`[PluginManager] Dependency validation error: ${error}`);
      }
      throw new Error(
        `Plugin dependency validation failed: ${validationErrors.join("; ")}`,
      );
    }

    // Phase 4: Activate plugins in dependency order
    const activationOrder = this.getActivationOrder();
    const failedPlugins = new Set<string>();

    for (const pluginId of activationOrder) {
      // Skip plugins that depend on a failed plugin
      const info = this.registry.get(pluginId);
      if (info) {
        const deps = info.plugin.dependencies ?? [];
        const blockedBy = deps.find((dep) => failedPlugins.has(dep));
        if (blockedBy) {
          console.warn(
            `[PluginManager] Skipping plugin "${pluginId}": depends on failed plugin "${blockedBy}"`,
          );
          failedPlugins.add(pluginId);
          this.registry.setError(pluginId, new Error(`Dependency "${blockedBy}" failed to activate`));
          continue;
        }
      }

      try {
        await this.activatePlugin(pluginId);
      } catch {
        // activatePlugin may throw for registration/state issues
        failedPlugins.add(pluginId);
        continue;
      }

      // Check if activation failed (activatePlugin catches errors internally)
      const postInfo = this.registry.get(pluginId);
      if (postInfo && postInfo.state === "error") {
        failedPlugins.add(pluginId);
      }
    }

    this.started = true;

    const summary = this.registry.getSummary();
    console.info(
      `[PluginManager] Plugin system started: ${summary.active} active, ${summary.error} errored`,
    );
  }

  /**
   * Stop the plugin manager.
   * Deactivates all plugins in reverse activation order.
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    console.info("[PluginManager] Stopping plugin system...");

    // Deactivate in reverse activation order (last activated = first deactivated)
    const reverseOrder = [...this.activationOrder].reverse();

    for (const pluginId of reverseOrder) {
      await this.deactivatePlugin(pluginId);
    }

    this.activationOrder.length = 0;
    this.pluginContexts.clear();
    this.started = false;

    console.info("[PluginManager] Plugin system stopped");
  }

  // ── Plugin Loading ──

  /**
   * Load plugins from explicit plugin entries in config.
   */
  private async loadConfiguredPlugins(): Promise<void> {
    for (const entry of this.pluginConfig.plugins) {
      if (!entry.enabled) {
        console.debug(`[PluginManager] Skipping disabled plugin: ${entry.path}`);
        continue;
      }

      const result = await this.loader.load(entry.path);
      if (result.success && result.plugin) {
        this.registerLoadedPlugin(result.plugin, entry);
      } else {
        console.error(
          `[PluginManager] Failed to load plugin from "${entry.path}": ${result.error?.message}`,
        );
      }
    }
  }

  /**
   * Load plugins from configured plugin directories.
   */
  private async loadPluginDirectories(): Promise<void> {
    for (const dir of this.pluginConfig.pluginDirs) {
      console.debug(`[PluginManager] Scanning plugin directory: ${dir}`);
      const results: PluginLoadResult[] = await this.loader.scanDirectory(dir);

      for (const result of results) {
        if (result.success && result.plugin) {
          this.registerLoadedPlugin(result.plugin);
        } else {
          console.warn(
            `[PluginManager] Failed to load plugin from "${result.path}": ${result.error?.message}`,
          );
        }
      }
    }
  }

  /**
   * Register a loaded plugin with the registry.
   */
  private registerLoadedPlugin(plugin: Plugin, entry?: PluginEntry): void {
    try {
      if (this.registry.has(plugin.id)) {
        console.warn(
          `[PluginManager] Plugin "${plugin.id}" is already registered, skipping duplicate`,
        );
        return;
      }

      this.registry.register(plugin);
      console.debug(
        `[PluginManager] Registered plugin: ${plugin.id} v${plugin.version}`,
      );

      // Store the plugin-specific config if provided
      if (entry) {
        this.pluginEntryMap.set(plugin.id, entry);
      }
    } catch (error) {
      console.error(
        `[PluginManager] Failed to register plugin "${plugin.id}":`,
        error,
      );
    }
  }

  /**
   * Register a plugin instance directly (for programmatic use).
   */
  registerPlugin(plugin: Plugin): void {
    this.registry.register(plugin);
  }

  // ── Plugin Activation ──

  /**
   * Activate a specific plugin by ID.
   */
  async activatePlugin(pluginId: string): Promise<void> {
    const info = this.registry.get(pluginId);
    if (!info) {
      throw new Error(`Plugin "${pluginId}" is not registered`);
    }

    if (info.state === "active") {
      return; // Already active
    }

    if (info.state !== "installed" && info.state !== "inactive") {
      throw new Error(
        `Cannot activate plugin "${pluginId}" in state: ${info.state}`,
      );
    }

    // Emit activating event
    this.registry.setState(pluginId, "activating");
    this.emitPluginEvent({ type: "plugin_activating", pluginId });

    try {
      // Find plugin-specific config from the plugin entries
      const pluginSpecificConfig = this.findPluginConfig(pluginId);

      // Create plugin context with subsystem wiring hooks
      const contextOptions: PluginContextOptions = {
        pluginId,
        config: this.options.config,
        pluginConfig: pluginSpecificConfig,
        browserPool: this.options.browserPool,
        healthChecker: this.options.healthChecker,
        registry: this.registry,
        getQueryEngine: this.options.getQueryEngine,
        getProxyRuntime: this.options.getProxyRuntime,
        eventListeners: this.eventListeners,

        // Subsystem wiring hooks
        onAddRequestMiddleware: (middleware) => {
          this.wireRequestMiddleware(middleware);
        },
        onRemoveRequestMiddleware: (name) => {
          this.unwireRequestMiddleware(name);
        },
        onAddResponseMiddleware: (middleware) => {
          this.wireResponseMiddleware(middleware);
        },
        onRemoveResponseMiddleware: (name) => {
          this.unwireResponseMiddleware(name);
        },
        onRegisterQueryFunction: (func) => {
          this.wireQueryFunction(func);
        },
        onUnregisterQueryFunction: (name) => {
          this.unwireQueryFunction(name);
        },
        onRegisterDevToolsDomain: (domain) => {
          this.wireDevToolsDomain(domain);
        },
        onUnregisterDevToolsDomain: (name) => {
          this.unwireDevToolsDomain(name);
        },
      };

      const context = new PluginContextImpl(contextOptions);
      this.pluginContexts.set(pluginId, context);

      // Activate with timeout
      await this.withTimeout(
        info.plugin.activate(context),
        this.pluginConfig.activationTimeout,
        `Plugin "${pluginId}" activation timed out after ${this.pluginConfig.activationTimeout}ms`,
      );

      // Mark as active and track activation order
      this.registry.setState(pluginId, "active");
      this.activationOrder.push(pluginId);
      this.emitPluginEvent({ type: "plugin_activated", pluginId });

      console.info(
        `[PluginManager] Activated plugin: ${pluginId} v${info.plugin.version}`,
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Clean up on failure
      this.registry.disposeAll(pluginId);
      this.pluginContexts.delete(pluginId);
      this.registry.setError(pluginId, err);

      this.emitPluginEvent({ type: "plugin_error", pluginId, error: err });

      console.error(
        `[PluginManager] Failed to activate plugin "${pluginId}":`,
        err.message,
      );
    }
  }

  /**
   * Deactivate a specific plugin by ID.
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    const info = this.registry.get(pluginId);
    if (!info) {
      throw new Error(`Plugin "${pluginId}" is not registered`);
    }

    if (info.state !== "active") {
      return; // Not active, nothing to do
    }

    // Emit deactivating event
    this.registry.setState(pluginId, "deactivating");
    this.emitPluginEvent({ type: "plugin_deactivating", pluginId });

    try {
      // Call plugin's deactivate method
      await this.withTimeout(
        info.plugin.deactivate(),
        this.pluginConfig.activationTimeout,
        `Plugin "${pluginId}" deactivation timed out`,
      );

      // Dispose all contributions registered by this plugin
      this.registry.disposeAll(pluginId);
      this.pluginContexts.delete(pluginId);

      // Mark as inactive
      this.registry.setState(pluginId, "inactive");
      this.emitPluginEvent({ type: "plugin_deactivated", pluginId });

      console.info(`[PluginManager] Deactivated plugin: ${pluginId}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Force cleanup even on error
      this.registry.disposeAll(pluginId);
      this.pluginContexts.delete(pluginId);
      this.registry.setError(pluginId, err);

      this.emitPluginEvent({ type: "plugin_error", pluginId, error: err });

      console.error(
        `[PluginManager] Error deactivating plugin "${pluginId}":`,
        err.message,
      );
    }
  }

  // ── Dependency Management ──

  /**
   * Validate the dependency graph for all registered plugins.
   * Checks for missing dependencies and circular dependencies.
   */
  validateDependencies(): string[] {
    const errors: string[] = [];
    const allPlugins = this.registry.getAll();

    for (const info of allPlugins) {
      const deps = info.plugin.dependencies ?? [];

      for (const dep of deps) {
        if (!this.registry.has(dep)) {
          errors.push(
            `Plugin "${info.plugin.id}" depends on unregistered plugin "${dep}"`,
          );
        }
      }
    }

    // Check for circular dependencies
    const cycleError = this.detectCycles();
    if (cycleError) {
      errors.push(cycleError);
    }

    return errors;
  }

  /**
   * Get the activation order using topological sort of the dependency graph.
   * Plugins with no dependencies are activated first.
   */
  getActivationOrder(): string[] {
    const allPlugins = this.registry.getAll();
    const dag = new DAG<Plugin>();

    // Add nodes
    for (const info of allPlugins) {
      dag.addNode(new GraphNode(info.plugin.id, info.plugin));
    }

    // Add edges: dependency → dependent (source=dep, target=plugin)
    for (const info of allPlugins) {
      const deps = info.plugin.dependencies ?? [];
      for (const dep of deps) {
        // Skip edges for unregistered dependencies (validation catches it separately)
        if (!this.registry.has(dep)) continue;
        dag.addEdge(new GraphEdge(dep + "->" + info.plugin.id, dep, info.plugin.id));
      }
    }

    const result = topologicalSort(dag);
    return result.order;
  }

  /**
   * Detect circular dependencies in the plugin graph.
   */
  private detectCycles(): string | null {
    const allPlugins = this.registry.getAll();
    const dag = new DAG<Plugin>();

    // Add all nodes first
    for (const info of allPlugins) {
      dag.addNode(new GraphNode(info.plugin.id, info.plugin));
    }

    // Try adding edges; CycleError means a cycle exists
    for (const info of allPlugins) {
      const deps = info.plugin.dependencies ?? [];
      for (const dep of deps) {
        if (!this.registry.has(dep)) continue;
        try {
          dag.addEdge(new GraphEdge(dep + "->" + info.plugin.id, dep, info.plugin.id));
        } catch (error) {
          if (error instanceof CycleError) {
            // Build cycle path for the error message
            // Walk the dependency chain to reconstruct the cycle
            const cycle = this.traceCyclePath(info.plugin.id, dep);
            return `Circular dependency detected: ${cycle.join(" \u2192 ")}`;
          }
          throw error;
        }
      }
    }

    return null;
  }

  /**
   * Trace the cycle path from a plugin back to itself through dependencies.
   */
  private traceCyclePath(pluginId: string, depThatCausedCycle: string): string[] {
    // The cycle is: depThatCausedCycle -> ... -> pluginId -> depThatCausedCycle
    const path: string[] = [depThatCausedCycle];
    const visited = new Set<string>();

    const trace = (current: string): boolean => {
      if (current === pluginId) {
        path.push(current);
        path.push(depThatCausedCycle);
        return true;
      }
      if (visited.has(current)) return false;
      visited.add(current);

      const info = this.registry.get(current);
      if (!info) return false;

      const deps = info.plugin.dependencies ?? [];
      for (const dep of deps) {
        path.push(dep);
        if (trace(dep)) return true;
        path.pop();
      }
      return false;
    };

    // Start from depThatCausedCycle, try to reach pluginId
    const info = this.registry.get(depThatCausedCycle);
    if (info) {
      const deps = info.plugin.dependencies ?? [];
      for (const dep of deps) {
        path.push(dep);
        if (trace(dep)) return path;
        path.pop();
      }
    }

    // Fallback: simple A → B → A
    return [depThatCausedCycle, pluginId, depThatCausedCycle];
  }

  // ── Query Methods ──

  /**
   * Get information about a specific plugin.
   */
  getPlugin(pluginId: string): PluginInfo | undefined {
    return this.registry.get(pluginId);
  }

  /**
   * Get all registered plugins.
   */
  getAllPlugins(): PluginInfo[] {
    return this.registry.getAll();
  }

  /**
   * Get all active plugins.
   */
  getActivePlugins(): PluginInfo[] {
    return this.registry.getActive();
  }

  /**
   * Get the plugin context for a specific plugin (if active).
   */
  getPluginContext(pluginId: string): PluginContextImpl | undefined {
    return this.pluginContexts.get(pluginId);
  }

  /**
   * Get a summary of all plugin states.
   */
  getSummary(): Record<PluginState, number> {
    return this.registry.getSummary();
  }

  /**
   * Check if the plugin manager is running.
   */
  isRunning(): boolean {
    return this.started;
  }

  /**
   * Get the plugin registry (for testing and internal use).
   */
  getRegistry(): PluginRegistry {
    return this.registry;
  }

  /**
   * Get the plugin loader (for testing and internal use).
   */
  getLoader(): PluginLoader {
    return this.loader;
  }

  // ── Subsystem Aggregation ──

  /**
   * Get all MCP tools registered by all active plugins.
   * Used by the MCP server to discover plugin-contributed tools.
   */
  getAllMCPTools(): MCPToolDefinition[] {
    const tools: MCPToolDefinition[] = [];
    for (const ctx of this.pluginContexts.values()) {
      tools.push(...ctx.getMCPTools());
    }
    return tools;
  }

  // ── Subsystem Wiring ──

  /**
   * Wire request middleware into all proxy engine gateway servers.
   */
  private wireRequestMiddleware(middleware: RequestMiddleware): void {
    const proxyRuntime = this.options.getProxyRuntime();
    if (!proxyRuntime) return;

    const rt = proxyRuntime as {
      getGatewayServers(): Array<{
        getMiddlewareChain(): { addRequestMiddleware(m: RequestMiddleware): void };
      }>;
    };

    if (typeof rt.getGatewayServers !== "function") return;

    for (const gateway of rt.getGatewayServers()) {
      gateway.getMiddlewareChain().addRequestMiddleware(middleware);
    }
  }

  /**
   * Unwire request middleware from all proxy engine gateway servers.
   */
  private unwireRequestMiddleware(name: string): void {
    const proxyRuntime = this.options.getProxyRuntime();
    if (!proxyRuntime) return;

    const rt = proxyRuntime as {
      getGatewayServers(): Array<{
        getMiddlewareChain(): { removeRequestMiddleware(n: string): boolean };
      }>;
    };

    if (typeof rt.getGatewayServers !== "function") return;

    for (const gateway of rt.getGatewayServers()) {
      gateway.getMiddlewareChain().removeRequestMiddleware(name);
    }
  }

  /**
   * Wire response middleware into all proxy engine gateway servers.
   */
  private wireResponseMiddleware(middleware: ResponseMiddleware): void {
    const proxyRuntime = this.options.getProxyRuntime();
    if (!proxyRuntime) return;

    const rt = proxyRuntime as {
      getGatewayServers(): Array<{
        getMiddlewareChain(): { addResponseMiddleware(m: ResponseMiddleware): void };
      }>;
    };

    if (typeof rt.getGatewayServers !== "function") return;

    for (const gateway of rt.getGatewayServers()) {
      gateway.getMiddlewareChain().addResponseMiddleware(middleware);
    }
  }

  /**
   * Unwire response middleware from all proxy engine gateway servers.
   */
  private unwireResponseMiddleware(name: string): void {
    const proxyRuntime = this.options.getProxyRuntime();
    if (!proxyRuntime) return;

    const rt = proxyRuntime as {
      getGatewayServers(): Array<{
        getMiddlewareChain(): { removeResponseMiddleware(n: string): boolean };
      }>;
    };

    if (typeof rt.getGatewayServers !== "function") return;

    for (const gateway of rt.getGatewayServers()) {
      gateway.getMiddlewareChain().removeResponseMiddleware(name);
    }
  }

  /**
   * Wire a query function into the query engine's function registry.
   */
  private wireQueryFunction(func: FunctionImplementation): void {
    const queryEngine = this.options.getQueryEngine();
    if (!queryEngine) return;

    const engine = queryEngine as {
      getFunctionRegistry(): { register(f: FunctionImplementation): void };
    };

    if (typeof engine.getFunctionRegistry !== "function") return;

    engine.getFunctionRegistry().register(func);
  }

  /**
   * Unwire a query function from the query engine's function registry.
   */
  private unwireQueryFunction(name: string): void {
    const queryEngine = this.options.getQueryEngine();
    if (!queryEngine) return;

    const engine = queryEngine as {
      getFunctionRegistry(): { unregister(n: string): boolean };
    };

    if (typeof engine.getFunctionRegistry !== "function") return;

    engine.getFunctionRegistry().unregister(name);
  }

  /**
   * Wire a DevTools domain into the DevTools domain registry.
   */
  private wireDevToolsDomain(domain: DevToolsDomainDefinition): void {
    this.devToolsDomainRegistry.set(domain.name, domain);
    console.debug(
      `[PluginManager] DevTools domain "${domain.name}" registered by plugin — available for DevTools integration`,
    );
  }

  /**
   * Unwire a DevTools domain from the DevTools domain registry.
   */
  private unwireDevToolsDomain(name: string): void {
    this.devToolsDomainRegistry.delete(name);
    console.debug(
      `[PluginManager] DevTools domain "${name}" unregistered by plugin`,
    );
  }

  /**
   * Get all registered DevTools domains from plugins.
   */
  getDevToolsDomains(): Map<string, DevToolsDomainDefinition> {
    return new Map(this.devToolsDomainRegistry);
  }

  // ── Events ──

  /**
   * Add event listener for plugin lifecycle events.
   */
  addEventListener(listener: RuntimeEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener.
   */
  removeEventListener(listener: RuntimeEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit a plugin event to all listeners.
   */
  private emitPluginEvent(event: PluginEvent): void {
    // Plugin events are compatible with RuntimeEvent via the union type extension
    for (const listener of this.eventListeners) {
      try {
        // Cast to RuntimeEvent since PluginEvent extends the union
        listener(event as unknown as import("../types.ts").RuntimeEvent);
      } catch {
        // Ignore listener errors
      }
    }
  }

  // ── Private Helpers ──

  /**
   * Find plugin-specific config from the configured plugin entries.
   */
  private findPluginConfig(pluginId: string): Record<string, unknown> {
    // First check the entry map (keyed by plugin.id at registration time)
    const entry = this.pluginEntryMap.get(pluginId);
    if (entry?.config) {
      return entry.config;
    }

    // Fallback: search configured plugin entries by path containing the pluginId.
    // This handles plugins registered via registerPlugin() that weren't loaded
    // through loadConfiguredPlugins() but still have config in the config file.
    for (const configEntry of this.pluginConfig.plugins) {
      const pathStem = configEntry.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
      if (pathStem === pluginId && configEntry.config) {
        return configEntry.config;
      }
    }

    return {};
  }

  /**
   * Execute a promise with a timeout.
   */
  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(message));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
