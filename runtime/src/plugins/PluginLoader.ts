/**
 * Plugin Loader
 *
 * Loads plugins from filesystem paths via dynamic import.
 * Validates plugin modules conform to the Plugin interface
 * and optionally reads plugin manifests for pre-validation.
 */

import type { Plugin, PluginManifest } from "./types.ts";

/**
 * Result of loading a plugin.
 */
export interface PluginLoadResult {
  /** Whether the load was successful */
  success: boolean;
  /** The loaded plugin instance (if successful) */
  plugin?: Plugin;
  /** The plugin manifest (if found) */
  manifest?: PluginManifest;
  /** Error that occurred during loading (if failed) */
  error?: Error;
  /** The path the plugin was loaded from */
  path: string;
}

/**
 * Plugin Loader
 *
 * Handles loading plugin modules from filesystem paths or URLs.
 * Validates that loaded modules export a valid Plugin implementation.
 */
export class PluginLoader {
  /**
   * Load a plugin from a filesystem path or URL.
   *
   * The module should either:
   * - Default-export a Plugin class (instantiated automatically)
   * - Default-export a Plugin instance
   * - Export a `plugin` named export (class or instance)
   */
  async load(path: string): Promise<PluginLoadResult> {
    try {
      // Resolve the path to an absolute URL for dynamic import
      const moduleUrl = this.resolveModulePath(path);

      // Dynamic import
      const module = await import(moduleUrl);

      // Extract the plugin from the module
      const plugin = this.extractPlugin(module);

      if (!plugin) {
        return {
          success: false,
          error: new Error(
            `Module at "${path}" does not export a valid Plugin. ` +
              `Expected a default export or named "plugin" export that implements the Plugin interface.`,
          ),
          path,
        };
      }

      // Validate the plugin interface
      const validationError = this.validatePlugin(plugin);
      if (validationError) {
        return {
          success: false,
          error: validationError,
          path,
        };
      }

      return {
        success: true,
        plugin,
        path,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error
          : new Error(`Failed to load plugin from "${path}": ${String(error)}`),
        path,
      };
    }
  }

  /**
   * Load a plugin manifest from a directory.
   * Looks for `plugin.json` or `manifest.json` in the given directory.
   */
  async loadManifest(dirPath: string): Promise<PluginManifest | null> {
    const manifestNames = ["plugin.json", "manifest.json"];

    for (const name of manifestNames) {
      try {
        const manifestPath = dirPath.endsWith("/")
          ? `${dirPath}${name}`
          : `${dirPath}/${name}`;

        const content = await Deno.readTextFile(manifestPath);
        const manifest = JSON.parse(content) as PluginManifest;

        const validationError = this.validateManifest(manifest);
        if (validationError) {
          console.warn(
            `[PluginLoader] Invalid manifest at "${manifestPath}": ${validationError.message}`,
          );
          continue;
        }

        return manifest;
      } catch {
        // File doesn't exist or isn't valid JSON, try next
        continue;
      }
    }

    return null;
  }

  /**
   * Scan a directory for plugins.
   * Each subdirectory is checked for a plugin manifest or module.
   */
  async scanDirectory(dirPath: string): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = [];

    try {
      for await (const entry of Deno.readDir(dirPath)) {
        if (!entry.isDirectory) {
          continue;
        }

        const pluginDir = dirPath.endsWith("/")
          ? `${dirPath}${entry.name}`
          : `${dirPath}/${entry.name}`;

        // Try to load manifest first
        const manifest = await this.loadManifest(pluginDir);

        if (manifest) {
          // Load using manifest's main entry — with path containment check
          const rawMainPath = pluginDir.endsWith("/")
            ? `${pluginDir}${manifest.main}`
            : `${pluginDir}/${manifest.main}`;

          // Resolve to absolute and verify it stays inside pluginDir
          const mainPath = await Deno.realPath(rawMainPath).catch(() => rawMainPath);
          const resolvedPluginDir = await Deno.realPath(pluginDir).catch(() => pluginDir);
          if (!mainPath.startsWith(resolvedPluginDir)) {
            console.warn(
              `[PluginLoader] Path traversal blocked: manifest.main "${manifest.main}" resolves outside plugin directory "${pluginDir}"`,
            );
            results.push({
              success: false,
              error: new Error(
                `Plugin manifest "main" entry resolves outside the plugin directory (path traversal blocked)`,
              ),
              path: rawMainPath,
            });
            continue;
          }

          const result = await this.load(mainPath);
          result.manifest = manifest;
          results.push(result);
        } else {
          // Try common entry points
          const entryPoints = ["mod.ts", "index.ts", "main.ts", "plugin.ts"];

          for (const entryPoint of entryPoints) {
            const entryPath = pluginDir.endsWith("/")
              ? `${pluginDir}${entryPoint}`
              : `${pluginDir}/${entryPoint}`;

            try {
              await Deno.stat(entryPath);
              const result = await this.load(entryPath);
              results.push(result);
              break; // Found a valid entry point
            } catch {
              // Entry point doesn't exist, try next
              continue;
            }
          }
        }
      }
    } catch (error) {
      console.warn(
        `[PluginLoader] Failed to scan directory "${dirPath}":`,
        error,
      );
    }

    return results;
  }

  /**
   * Extract a Plugin from a loaded module.
   */
  private extractPlugin(module: Record<string, unknown>): Plugin | null {
    // Try default export first
    const defaultExport = module.default;
    if (defaultExport) {
      const plugin = this.instantiateIfClass(defaultExport);
      if (plugin && this.isPlugin(plugin)) {
        return plugin;
      }
    }

    // Try named "plugin" export
    const namedExport = module.plugin;
    if (namedExport) {
      const plugin = this.instantiateIfClass(namedExport);
      if (plugin && this.isPlugin(plugin)) {
        return plugin;
      }
    }

    // Try named "Plugin" export (common capitalization)
    const capitalExport = module.Plugin;
    if (capitalExport) {
      const plugin = this.instantiateIfClass(capitalExport);
      if (plugin && this.isPlugin(plugin)) {
        return plugin;
      }
    }

    return null;
  }

  /**
   * Instantiate a class constructor, or return the value if it's already an instance.
   */
  private instantiateIfClass(value: unknown): unknown {
    if (typeof value === "function" && value.prototype) {
      try {
        // deno-lint-ignore no-explicit-any
        return new (value as any)();
      } catch {
        return null;
      }
    }
    return value;
  }

  /**
   * Check if a value implements the Plugin interface.
   */
  private isPlugin(value: unknown): value is Plugin {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const obj = value as Record<string, unknown>;
    return (
      typeof obj.id === "string" &&
      typeof obj.name === "string" &&
      typeof obj.version === "string" &&
      typeof obj.activate === "function" &&
      typeof obj.deactivate === "function"
    );
  }

  /**
   * Validate a Plugin instance has all required properties.
   */
  private validatePlugin(plugin: Plugin): Error | null {
    if (!plugin.id || plugin.id.trim() === "") {
      return new Error("Plugin id must be a non-empty string");
    }

    if (!plugin.name || plugin.name.trim() === "") {
      return new Error("Plugin name must be a non-empty string");
    }

    if (!plugin.version || plugin.version.trim() === "") {
      return new Error("Plugin version must be a non-empty string");
    }

    if (typeof plugin.activate !== "function") {
      return new Error("Plugin must implement activate() method");
    }

    if (typeof plugin.deactivate !== "function") {
      return new Error("Plugin must implement deactivate() method");
    }

    return null;
  }

  /**
   * Validate a plugin manifest.
   */
  private validateManifest(manifest: PluginManifest): Error | null {
    if (!manifest.id || typeof manifest.id !== "string") {
      return new Error("Manifest must have a valid 'id' string");
    }

    if (!manifest.name || typeof manifest.name !== "string") {
      return new Error("Manifest must have a valid 'name' string");
    }

    if (!manifest.version || typeof manifest.version !== "string") {
      return new Error("Manifest must have a valid 'version' string");
    }

    if (!manifest.main || typeof manifest.main !== "string") {
      return new Error("Manifest must have a valid 'main' entry point string");
    }

    if (manifest.dependencies && !Array.isArray(manifest.dependencies)) {
      return new Error("Manifest 'dependencies' must be an array of strings");
    }

    return null;
  }

  /**
   * Resolve a path to an importable URL.
   * Remote URLs (http/https) are blocked by default for security.
   */
  private resolveModulePath(path: string, allowRemote = false): string {
    // Remote URLs require explicit opt-in
    if (path.startsWith("http://") || path.startsWith("https://")) {
      if (!allowRemote) {
        throw new Error(
          `Remote plugin URLs are blocked for security. ` +
            `Set allowRemote: true in plugin config to enable loading from "${path}".`,
        );
      }
      return path;
    }

    // Already a file:// URL
    if (path.startsWith("file://")) {
      return path;
    }

    // Absolute path — convert to file:// URL
    if (path.startsWith("/")) {
      return `file://${path}`;
    }

    // Relative path — resolve from CWD
    const cwd = Deno.cwd();
    const absolutePath = cwd.endsWith("/")
      ? `${cwd}${path}`
      : `${cwd}/${path}`;
    return `file://${absolutePath}`;
  }
}
