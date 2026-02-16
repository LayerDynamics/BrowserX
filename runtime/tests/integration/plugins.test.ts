/**
 * Plugin System Integration Tests
 *
 * End-to-end tests for the plugin system, testing the full lifecycle
 * of loading, activating, contributing, and deactivating plugins.
 */

import {
  assertEquals,
  assertExists,
} from "@std/assert";
import { PluginManager, type PluginManagerOptions } from "../../src/plugins/PluginManager.ts";
import type { Plugin, PluginContext } from "../../src/plugins/types.ts";
import { createTestConfig } from "../../src/config/RuntimeConfig.ts";

/**
 * Create a mock HealthChecker with tracked registrations.
 */
function createMockHealthChecker() {
  const handlers = new Map<string, unknown>();
  return {
    registerHandler: (id: string, handler: unknown) => handlers.set(id, handler),
    unregisterHandler: (id: string) => handlers.delete(id),
    getHandlers: () => handlers,
    start: () => {},
    stop: () => {},
    isRunning: () => true,
  };
}

/**
 * Create a mock BrowserPool.
 */
function createMockBrowserPool() {
  return {
    start: async () => {},
    stop: async () => {},
    getStats: () => ({
      totalInstances: 0,
      idleInstances: 0,
      inUseInstances: 0,
      maxInstances: 5,
    }),
  };
}

/**
 * Create a PluginManager with test configuration.
 */
function createTestPluginManager(): {
  manager: PluginManager;
  healthChecker: ReturnType<typeof createMockHealthChecker>;
} {
  const healthChecker = createMockHealthChecker();

  const config = {
    ...createTestConfig(),
    plugins: {
      enabled: true,
      pluginDirs: [],
      plugins: [],
      activationTimeout: 5000,
    },
  };

  const options: PluginManagerOptions = {
    config,
    browserPool: createMockBrowserPool() as unknown as PluginManagerOptions["browserPool"],
    healthChecker: healthChecker as unknown as PluginManagerOptions["healthChecker"],
    getQueryEngine: () => ({ name: "MockQueryEngine" }),
    getProxyRuntime: () => ({ name: "MockProxyRuntime" }),
  };

  return { manager: new PluginManager(options), healthChecker };
}

// ============================================================================
// Full Lifecycle Integration Test
// ============================================================================

Deno.test({
  name: "Integration - plugin registers middleware, query function, health check, then cleans up",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { manager, healthChecker } = createTestPluginManager();

    // Create a plugin that contributes across multiple layers
    const contributions: string[] = [];

    const analyticsPlugin: Plugin = {
      id: "analytics",
      name: "Analytics Plugin",
      version: "1.0.0",

      async activate(context: PluginContext) {
        // Register request middleware
        context.addRequestMiddleware({
          name: "analytics-tracker",
          async processRequest(_request, _context) {
            contributions.push("middleware");
            return { type: "continue" };
          },
        });

        // Register query function
        context.registerQueryFunction({
          signature: {
            name: "ANALYTICS",
            category: "custom",
            minArgs: 0,
            maxArgs: 1,
            argTypes: [],
            returnType: "OBJECT",
          },
          execute: () => {
            contributions.push("query");
            return { totalRequests: 42 };
          },
        });

        // Register health check
        context.registerHealthCheck("analytics", async () => {
          contributions.push("health");
          return { status: "healthy" as const, message: "Analytics OK" };
        });

        // Register MCP tool
        context.registerMCPTool({
          name: "get_analytics",
          description: "Get analytics data",
          inputSchema: { type: "object" },
          execute: async () => {
            contributions.push("mcp");
            return { data: [] };
          },
        });
      },

      async deactivate() {
        contributions.push("deactivated");
      },
    };

    // Register and activate
    manager.registerPlugin(analyticsPlugin);
    await manager.activatePlugin("analytics");

    // Verify plugin is active
    assertEquals(manager.getPlugin("analytics")?.state, "active");

    // Verify context has contributions
    const ctx = manager.getPluginContext("analytics");
    assertExists(ctx);
    assertEquals(ctx.getRequestMiddleware().length, 1);
    assertEquals(ctx.getQueryFunctions().length, 1);
    assertEquals(ctx.getMCPTools().length, 1);

    // Verify health check was registered
    assertEquals(healthChecker.getHandlers().has("plugin:analytics:analytics"), true);

    // Execute the query function
    const queryFunc = ctx.getQueryFunctions()[0];
    const result = queryFunc.execute();
    assertEquals(result, { totalRequests: 42 });
    assertEquals(contributions.includes("query"), true);

    // Execute MCP tool
    const mcpTool = ctx.getMCPTools()[0];
    const mcpResult = await mcpTool.execute({});
    assertEquals(mcpResult, { data: [] });
    assertEquals(contributions.includes("mcp"), true);

    // Deactivate
    await manager.deactivatePlugin("analytics");

    // Verify cleanup
    assertEquals(manager.getPlugin("analytics")?.state, "inactive");
    assertEquals(manager.getPluginContext("analytics"), undefined);
    assertEquals(healthChecker.getHandlers().has("plugin:analytics:analytics"), false);
    assertEquals(contributions.includes("deactivated"), true);
  },
});

// ============================================================================
// Multi-Plugin Dependency Chain Integration
// ============================================================================

Deno.test({
  name: "Integration - multi-plugin dependency chain activates and deactivates in order",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { manager } = createTestPluginManager();
    const order: string[] = [];

    // Core plugin (no dependencies)
    const corePlugin: Plugin = {
      id: "core",
      name: "Core Plugin",
      version: "1.0.0",
      async activate() { order.push("core:activate"); },
      async deactivate() { order.push("core:deactivate"); },
    };

    // Auth plugin (depends on core)
    const authPlugin: Plugin = {
      id: "auth",
      name: "Auth Plugin",
      version: "1.0.0",
      dependencies: ["core"],
      async activate() { order.push("auth:activate"); },
      async deactivate() { order.push("auth:deactivate"); },
    };

    // API plugin (depends on auth)
    const apiPlugin: Plugin = {
      id: "api",
      name: "API Plugin",
      version: "1.0.0",
      dependencies: ["auth"],
      async activate() { order.push("api:activate"); },
      async deactivate() { order.push("api:deactivate"); },
    };

    // Register in reverse dependency order
    manager.registerPlugin(apiPlugin);
    manager.registerPlugin(authPlugin);
    manager.registerPlugin(corePlugin);

    // Start should activate in correct dependency order
    await manager.start();

    assertEquals(order, [
      "core:activate",
      "auth:activate",
      "api:activate",
    ]);

    // Stop should deactivate in reverse order
    order.length = 0;
    await manager.stop();

    assertEquals(order, [
      "api:deactivate",
      "auth:deactivate",
      "core:deactivate",
    ]);
  },
});

// ============================================================================
// Plugin Accesses Runtime Services Integration
// ============================================================================

Deno.test({
  name: "Integration - plugin accesses runtime services through context",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { manager } = createTestPluginManager();
    let contextAccessResult: Record<string, boolean> = {};

    const servicePlugin: Plugin = {
      id: "service-test",
      name: "Service Test Plugin",
      version: "1.0.0",

      async activate(context: PluginContext) {
        contextAccessResult = {
          hasConfig: context.config !== null,
          hasPluginId: context.pluginId === "service-test",
          hasBrowserPool: context.getBrowserPool() !== null,
          hasQueryEngine: context.getQueryEngine() !== null,
          hasProxyRuntime: context.getProxyRuntime() !== null,
          hasLogger: context.log !== null,
        };
      },

      async deactivate() {},
    };

    manager.registerPlugin(servicePlugin);
    await manager.activatePlugin("service-test");

    assertEquals(contextAccessResult.hasConfig, true);
    assertEquals(contextAccessResult.hasPluginId, true);
    assertEquals(contextAccessResult.hasBrowserPool, true);
    assertEquals(contextAccessResult.hasQueryEngine, true);
    assertEquals(contextAccessResult.hasProxyRuntime, true);
    assertEquals(contextAccessResult.hasLogger, true);

    await manager.deactivatePlugin("service-test");
  },
});

// ============================================================================
// Error Resilience Integration
// ============================================================================

Deno.test({
  name: "Integration - failing plugin does not prevent other plugins from activating",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { manager } = createTestPluginManager();

    const goodPlugin: Plugin = {
      id: "good",
      name: "Good Plugin",
      version: "1.0.0",
      async activate() {},
      async deactivate() {},
    };

    const badPlugin: Plugin = {
      id: "bad",
      name: "Bad Plugin",
      version: "1.0.0",
      async activate() { throw new Error("I fail!"); },
      async deactivate() {},
    };

    const anotherGoodPlugin: Plugin = {
      id: "another-good",
      name: "Another Good Plugin",
      version: "1.0.0",
      async activate() {},
      async deactivate() {},
    };

    manager.registerPlugin(goodPlugin);
    manager.registerPlugin(badPlugin);
    manager.registerPlugin(anotherGoodPlugin);

    await manager.start();

    assertEquals(manager.getPlugin("good")?.state, "active");
    assertEquals(manager.getPlugin("bad")?.state, "error");
    assertEquals(manager.getPlugin("another-good")?.state, "active");

    const summary = manager.getSummary();
    assertEquals(summary.active, 2);
    assertEquals(summary.error, 1);

    await manager.stop();
  },
});

// ============================================================================
// Event Tracking Integration
// ============================================================================

Deno.test({
  name: "Integration - full event lifecycle tracking",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { manager } = createTestPluginManager();
    const events: Array<{ type: string; pluginId?: string }> = [];

    manager.addEventListener((event) => {
      if ("pluginId" in event) {
        events.push({
          type: event.type,
          pluginId: (event as { pluginId: string }).pluginId,
        });
      }
    });

    const plugin: Plugin = {
      id: "event-track",
      name: "Event Track Plugin",
      version: "1.0.0",
      async activate(context: PluginContext) {
        context.addRequestMiddleware({
          name: "tracker",
          async processRequest() { return { type: "continue" as const }; },
        });
      },
      async deactivate() {},
    };

    manager.registerPlugin(plugin);
    await manager.activatePlugin("event-track");
    await manager.deactivatePlugin("event-track");

    assertEquals(events.length, 4);
    assertEquals(events[0], { type: "plugin_activating", pluginId: "event-track" });
    assertEquals(events[1], { type: "plugin_activated", pluginId: "event-track" });
    assertEquals(events[2], { type: "plugin_deactivating", pluginId: "event-track" });
    assertEquals(events[3], { type: "plugin_deactivated", pluginId: "event-track" });
  },
});

// ============================================================================
// Plugin-to-Plugin Communication via Events
// ============================================================================

Deno.test({
  name: "Integration - plugins can communicate via runtime events",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { manager } = createTestPluginManager();
    let receivedEvent = false;

    // Plugin A subscribes to events
    const pluginA: Plugin = {
      id: "listener-plugin",
      name: "Listener Plugin",
      version: "1.0.0",
      async activate(context: PluginContext) {
        context.addEventListener((event) => {
          if (event.type === "plugin_activated" && "pluginId" in event) {
            const e = event as { pluginId: string };
            if (e.pluginId === "emitter-plugin") {
              receivedEvent = true;
            }
          }
        });
      },
      async deactivate() {},
    };

    // Plugin B's activation triggers an event
    const pluginB: Plugin = {
      id: "emitter-plugin",
      name: "Emitter Plugin",
      version: "1.0.0",
      async activate() {},
      async deactivate() {},
    };

    manager.registerPlugin(pluginA);
    manager.registerPlugin(pluginB);

    await manager.activatePlugin("listener-plugin");
    await manager.activatePlugin("emitter-plugin");

    assertEquals(receivedEvent, true);

    await manager.stop();
  },
});

// ============================================================================
// Dynamic Plugin Loading Integration
// ============================================================================

Deno.test({
  name: "Integration - load plugin from filesystem and activate",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const { manager } = createTestPluginManager();

    // Create a temporary plugin file
    const tempDir = await Deno.makeTempDir();
    const pluginFile = `${tempDir}/dynamic-plugin.ts`;
    await Deno.writeTextFile(pluginFile, `
export default class DynamicPlugin {
  id = "dynamic-loaded";
  name = "Dynamic Plugin";
  version = "1.0.0";

  async activate(context) {
    context.registerHealthCheck("dynamic-health", async () => ({
      status: "healthy",
      message: "Dynamically loaded and healthy",
    }));
  }

  async deactivate() {}
}
`);

    // Load and register the plugin
    const loader = manager.getLoader();
    const result = await loader.load(pluginFile);

    assertEquals(result.success, true);
    assertExists(result.plugin);

    manager.registerPlugin(result.plugin);
    await manager.activatePlugin("dynamic-loaded");

    assertEquals(manager.getPlugin("dynamic-loaded")?.state, "active");

    await manager.deactivatePlugin("dynamic-loaded");

    // Cleanup
    await Deno.remove(tempDir, { recursive: true });
  },
});
