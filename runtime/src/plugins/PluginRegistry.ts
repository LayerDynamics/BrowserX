/**
 * Plugin Registry
 *
 * Tracks installed plugins, their lifecycle states, and per-plugin
 * contribution lists. Provides lookup and querying capabilities.
 */

import type {
  Disposable,
  Plugin,
  PluginInfo,
  PluginState,
} from "./types.ts";

/**
 * Plugin Registry
 *
 * Central registry that manages plugin state tracking. The PluginManager
 * uses this to track all installed plugins and their current states.
 */
export class PluginRegistry {
  /** Map of plugin ID → plugin info */
  private readonly plugins: Map<string, PluginInfo> = new Map();

  /**
   * Register a plugin in the registry.
   * @throws If a plugin with the same ID is already registered.
   */
  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered`);
    }

    this.plugins.set(plugin.id, {
      plugin,
      state: "installed",
      disposables: [],
    });
  }

  /**
   * Unregister a plugin from the registry.
   * @throws If the plugin is not registered.
   */
  unregister(pluginId: string): void {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin "${pluginId}" is not registered`);
    }

    this.plugins.delete(pluginId);
  }

  /**
   * Get plugin info by ID.
   */
  get(pluginId: string): PluginInfo | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Check if a plugin is registered.
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Update the state of a plugin.
   * @throws If the plugin is not registered.
   */
  setState(pluginId: string, state: PluginState): void {
    const info = this.plugins.get(pluginId);
    if (!info) {
      throw new Error(`Plugin "${pluginId}" is not registered`);
    }

    info.state = state;

    if (state === "active") {
      info.activatedAt = Date.now();
    } else if (state === "inactive") {
      info.deactivatedAt = Date.now();
    }
  }

  /**
   * Set an error on a plugin and transition to error state.
   * @throws If the plugin is not registered.
   */
  setError(pluginId: string, error: Error): void {
    const info = this.plugins.get(pluginId);
    if (!info) {
      throw new Error(`Plugin "${pluginId}" is not registered`);
    }

    info.state = "error";
    info.error = error;
  }

  /**
   * Add a disposable contribution to a plugin's tracking list.
   * @throws If the plugin is not registered.
   */
  addDisposable(pluginId: string, disposable: Disposable): void {
    const info = this.plugins.get(pluginId);
    if (!info) {
      throw new Error(`Plugin "${pluginId}" is not registered`);
    }

    info.disposables.push(disposable);
  }

  /**
   * Dispose all contributions for a plugin and clear the list.
   * @throws If the plugin is not registered.
   */
  disposeAll(pluginId: string): void {
    const info = this.plugins.get(pluginId);
    if (!info) {
      throw new Error(`Plugin "${pluginId}" is not registered`);
    }

    for (const disposable of info.disposables) {
      try {
        disposable.dispose();
      } catch (error) {
        console.warn(
          `[PluginRegistry] Error disposing contribution for plugin "${pluginId}":`,
          error,
        );
      }
    }

    info.disposables = [];
  }

  /**
   * Get all registered plugins.
   */
  getAll(): PluginInfo[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all plugins in a specific state.
   */
  getByState(state: PluginState): PluginInfo[] {
    return this.getAll().filter((info) => info.state === state);
  }

  /**
   * Get all active plugins.
   */
  getActive(): PluginInfo[] {
    return this.getByState("active");
  }

  /**
   * Get all plugin IDs.
   */
  getIds(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get the number of registered plugins.
   */
  get size(): number {
    return this.plugins.size;
  }

  /**
   * Clear the registry, disposing all contributions first.
   */
  clear(): void {
    for (const pluginId of this.plugins.keys()) {
      try {
        this.disposeAll(pluginId);
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.plugins.clear();
  }

  /**
   * Get a summary of plugin states.
   */
  getSummary(): Record<PluginState, number> {
    const summary: Record<PluginState, number> = {
      installed: 0,
      activating: 0,
      active: 0,
      deactivating: 0,
      inactive: 0,
      error: 0,
    };

    for (const info of this.plugins.values()) {
      summary[info.state]++;
    }

    return summary;
  }
}
