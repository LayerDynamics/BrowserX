/**
 * PluginManager Unit Tests
 *
 * Tests for plugin lifecycle management, dependency ordering,
 * circular dependency detection, and event emission.
 */

import {
  assertEquals,
  assertExists,
} from "@std/assert";
import { PluginManager, type PluginManagerOptions } from "../../../src/plugins/PluginManager.ts";
import type { Plugin, PluginContext } from "../../../src/plugins/types.ts";
import { createTestConfig } from "../../../src/config/RuntimeConfig.ts";

/**
 * Create a mock plugin for testing.
 */
function createMockPlugin(overrides: Partial<Plugin> & { id: string }): Plugin {
  return {
    name: overrides.id,
    version: "1.0.0",
    activate: async (_context: PluginContext) => {},
    deactivate: async () => {},
    ...overrides,
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
 * Create a mock HealthChecker.
 */
function createMockHealthChecker() {
  const handlers = new Map();
  return {
    registerHandler: (id: string, handler: unknown) => handlers.set(id, handler),
    unregisterHandler: (id: string) => handlers.delete(id),
    start: () => {},
    stop: () => {},
    isRunning: () => true,
  };
}

/**
 * Create PluginManager with test configuration.
 */
function createTestPluginManager(
  configOverrides: Record<string, unknown> = {},
): PluginManager {
  const config = {
    ...createTestConfig(),
    plugins: {
      enabled: true,
      pluginDirs: [],
      plugins: [],
      activationTimeout: 5000,
      ...configOverrides,
    },
  };

  const options: PluginManagerOptions = {
    config,
    browserPool: createMockBrowserPool() as unknown as PluginManagerOptions["browserPool"],
    healthChecker: createMockHealthChecker() as unknown as PluginManagerOptions["healthChecker"],
    getQueryEngine: () => null,
    getProxyRuntime: () => null,
  };

  return new PluginManager(options);
}

// ============================================================================
// Basic Lifecycle Tests
// ============================================================================

Deno.test("PluginManager - instantiation", () => {
  const manager = createTestPluginManager();
  assertExists(manager);
  assertEquals(manager.isRunning(), false);
});

Deno.test({
  name: "PluginManager - start with no plugins",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();
    await manager.start();

    assertEquals(manager.isRunning(), true);
    assertEquals(manager.getAllPlugins().length, 0);

    await manager.stop();
    assertEquals(manager.isRunning(), false);
  },
});

Deno.test({
  name: "PluginManager - start with disabled plugin system",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager({ enabled: false });
    await manager.start();

    assertEquals(manager.isRunning(), true);

    await manager.stop();
  },
});

// ============================================================================
// Plugin Registration Tests
// ============================================================================

Deno.test("PluginManager - registerPlugin adds plugin to registry", () => {
  const manager = createTestPluginManager();
  const plugin = createMockPlugin({ id: "test-reg" });

  manager.registerPlugin(plugin);

  const info = manager.getPlugin("test-reg");
  assertExists(info);
  assertEquals(info.state, "installed");
});

Deno.test("PluginManager - getAllPlugins returns registered plugins", () => {
  const manager = createTestPluginManager();

  manager.registerPlugin(createMockPlugin({ id: "a" }));
  manager.registerPlugin(createMockPlugin({ id: "b" }));

  assertEquals(manager.getAllPlugins().length, 2);
});

// ============================================================================
// Activation/Deactivation Tests
// ============================================================================

Deno.test({
  name: "PluginManager - activatePlugin activates a registered plugin",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();
    let activated = false;

    const plugin = createMockPlugin({
      id: "activate-test",
      activate: async (_context: PluginContext) => {
        activated = true;
      },
    });

    manager.registerPlugin(plugin);
    await manager.activatePlugin("activate-test");

    assertEquals(activated, true);
    assertEquals(manager.getPlugin("activate-test")?.state, "active");
  },
});

Deno.test({
  name: "PluginManager - deactivatePlugin deactivates an active plugin",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();
    let deactivated = false;

    const plugin = createMockPlugin({
      id: "deactivate-test",
      deactivate: async () => {
        deactivated = true;
      },
    });

    manager.registerPlugin(plugin);
    await manager.activatePlugin("deactivate-test");
    await manager.deactivatePlugin("deactivate-test");

    assertEquals(deactivated, true);
    assertEquals(manager.getPlugin("deactivate-test")?.state, "inactive");
  },
});

Deno.test({
  name: "PluginManager - activation failure sets error state",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();

    const plugin = createMockPlugin({
      id: "error-plugin",
      activate: async () => {
        throw new Error("Activation failed");
      },
    });

    manager.registerPlugin(plugin);
    await manager.activatePlugin("error-plugin");

    assertEquals(manager.getPlugin("error-plugin")?.state, "error");
    assertExists(manager.getPlugin("error-plugin")?.error);
  },
});

Deno.test({
  name: "PluginManager - plugin receives PluginContext during activation",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();
    let receivedPluginId = "";
    let hasConfig = false;
    let hasLog = false;

    const plugin = createMockPlugin({
      id: "context-test",
      activate: async (context: PluginContext) => {
        receivedPluginId = context.pluginId;
        hasConfig = context.config !== null && context.config !== undefined;
        hasLog = context.log !== null && context.log !== undefined;
      },
    });

    manager.registerPlugin(plugin);
    await manager.activatePlugin("context-test");

    assertEquals(receivedPluginId, "context-test");
    assertEquals(hasConfig, true);
    assertEquals(hasLog, true);
  },
});

Deno.test({
  name: "PluginManager - contributions are cleaned up on deactivation",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();

    const plugin = createMockPlugin({
      id: "cleanup-test",
      activate: async (context: PluginContext) => {
        // Register some contributions
        context.addRequestMiddleware({
          name: "test-mw",
          processRequest: async () => ({ type: "continue" as const }),
        });
        context.registerQueryFunction({
          signature: { name: "TEST", category: "custom", minArgs: 0, maxArgs: 0, argTypes: [], returnType: "STRING" },
          execute: () => "test",
        });
      },
    });

    manager.registerPlugin(plugin);
    await manager.activatePlugin("cleanup-test");

    // Verify contributions exist
    const ctx = manager.getPluginContext("cleanup-test");
    assertExists(ctx);
    assertEquals(ctx.getRequestMiddleware().length, 1);
    assertEquals(ctx.getQueryFunctions().length, 1);

    // Deactivate should clean up
    await manager.deactivatePlugin("cleanup-test");

    // Context should be removed after deactivation
    assertEquals(manager.getPluginContext("cleanup-test"), undefined);
  },
});

// ============================================================================
// Dependency Ordering Tests
// ============================================================================

Deno.test("PluginManager - getActivationOrder respects dependencies", () => {
  const manager = createTestPluginManager();

  manager.registerPlugin(createMockPlugin({
    id: "plugin-c",
    dependencies: ["plugin-b"],
  }));
  manager.registerPlugin(createMockPlugin({
    id: "plugin-a",
  }));
  manager.registerPlugin(createMockPlugin({
    id: "plugin-b",
    dependencies: ["plugin-a"],
  }));

  const order = manager.getActivationOrder();

  const indexA = order.indexOf("plugin-a");
  const indexB = order.indexOf("plugin-b");
  const indexC = order.indexOf("plugin-c");

  // A must come before B, and B must come before C
  assertEquals(indexA < indexB, true);
  assertEquals(indexB < indexC, true);
});

Deno.test("PluginManager - getActivationOrder handles no dependencies", () => {
  const manager = createTestPluginManager();

  manager.registerPlugin(createMockPlugin({ id: "x" }));
  manager.registerPlugin(createMockPlugin({ id: "y" }));
  manager.registerPlugin(createMockPlugin({ id: "z" }));

  const order = manager.getActivationOrder();
  assertEquals(order.length, 3);
});

// ============================================================================
// Dependency Validation Tests
// ============================================================================

Deno.test("PluginManager - validateDependencies passes with valid deps", () => {
  const manager = createTestPluginManager();

  manager.registerPlugin(createMockPlugin({ id: "base" }));
  manager.registerPlugin(createMockPlugin({
    id: "child",
    dependencies: ["base"],
  }));

  const errors = manager.validateDependencies();
  assertEquals(errors.length, 0);
});

Deno.test("PluginManager - validateDependencies detects missing dependency", () => {
  const manager = createTestPluginManager();

  manager.registerPlugin(createMockPlugin({
    id: "orphan",
    dependencies: ["nonexistent"],
  }));

  const errors = manager.validateDependencies();
  assertEquals(errors.length, 1);
  assertEquals(errors[0].includes("nonexistent"), true);
});

Deno.test("PluginManager - validateDependencies detects circular dependency", () => {
  const manager = createTestPluginManager();

  manager.registerPlugin(createMockPlugin({
    id: "cycle-a",
    dependencies: ["cycle-b"],
  }));
  manager.registerPlugin(createMockPlugin({
    id: "cycle-b",
    dependencies: ["cycle-a"],
  }));

  const errors = manager.validateDependencies();
  assertEquals(errors.some((e) => e.includes("Circular")), true);
});

Deno.test("PluginManager - validateDependencies detects 3-node cycle", () => {
  const manager = createTestPluginManager();

  manager.registerPlugin(createMockPlugin({
    id: "c1",
    dependencies: ["c3"],
  }));
  manager.registerPlugin(createMockPlugin({
    id: "c2",
    dependencies: ["c1"],
  }));
  manager.registerPlugin(createMockPlugin({
    id: "c3",
    dependencies: ["c2"],
  }));

  const errors = manager.validateDependencies();
  assertEquals(errors.some((e) => e.includes("Circular")), true);
});

// ============================================================================
// Event Emission Tests
// ============================================================================

Deno.test({
  name: "PluginManager - emits plugin lifecycle events",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();
    const events: string[] = [];

    manager.addEventListener((event) => {
      if ("pluginId" in event) {
        events.push(event.type);
      }
    });

    manager.registerPlugin(createMockPlugin({ id: "event-test" }));
    await manager.activatePlugin("event-test");
    await manager.deactivatePlugin("event-test");

    assertEquals(events.includes("plugin_activating"), true);
    assertEquals(events.includes("plugin_activated"), true);
    assertEquals(events.includes("plugin_deactivating"), true);
    assertEquals(events.includes("plugin_deactivated"), true);
  },
});

Deno.test({
  name: "PluginManager - emits plugin_error on activation failure",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();
    const events: string[] = [];

    manager.addEventListener((event) => {
      if ("pluginId" in event) {
        events.push(event.type);
      }
    });

    manager.registerPlugin(createMockPlugin({
      id: "fail-plugin",
      activate: async () => { throw new Error("boom"); },
    }));

    await manager.activatePlugin("fail-plugin");

    assertEquals(events.includes("plugin_activating"), true);
    assertEquals(events.includes("plugin_error"), true);
    assertEquals(events.includes("plugin_activated"), false);
  },
});

// ============================================================================
// Start/Stop Full Lifecycle Tests
// ============================================================================

Deno.test({
  name: "PluginManager - start activates all registered plugins in order",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();
    const activationOrder: string[] = [];

    manager.registerPlugin(createMockPlugin({
      id: "dep-b",
      dependencies: ["dep-a"],
      activate: async () => { activationOrder.push("dep-b"); },
    }));

    manager.registerPlugin(createMockPlugin({
      id: "dep-a",
      activate: async () => { activationOrder.push("dep-a"); },
    }));

    await manager.start();

    // dep-a should be activated before dep-b
    assertEquals(activationOrder, ["dep-a", "dep-b"]);
    assertEquals(manager.getActivePlugins().length, 2);

    await manager.stop();
  },
});

Deno.test({
  name: "PluginManager - stop deactivates all active plugins",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();
    const deactivations: string[] = [];

    manager.registerPlugin(createMockPlugin({
      id: "stop-a",
      deactivate: async () => { deactivations.push("stop-a"); },
    }));
    manager.registerPlugin(createMockPlugin({
      id: "stop-b",
      deactivate: async () => { deactivations.push("stop-b"); },
    }));

    await manager.start();
    assertEquals(manager.getActivePlugins().length, 2);

    await manager.stop();
    assertEquals(manager.getActivePlugins().length, 0);
    assertEquals(deactivations.length, 2);
  },
});

// ============================================================================
// Summary Tests
// ============================================================================

Deno.test({
  name: "PluginManager - getSummary returns correct counts",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();

    manager.registerPlugin(createMockPlugin({ id: "active-1" }));
    manager.registerPlugin(createMockPlugin({ id: "active-2" }));
    manager.registerPlugin(createMockPlugin({
      id: "error-1",
      activate: async () => { throw new Error("fail"); },
    }));

    await manager.start();

    const summary = manager.getSummary();
    assertEquals(summary.active, 2);
    assertEquals(summary.error, 1);

    await manager.stop();
  },
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test({
  name: "PluginManager - double start is idempotent",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();
    await manager.start();
    await manager.start(); // Should not throw

    assertEquals(manager.isRunning(), true);

    await manager.stop();
  },
});

Deno.test({
  name: "PluginManager - double stop is idempotent",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();
    await manager.start();
    await manager.stop();
    await manager.stop(); // Should not throw

    assertEquals(manager.isRunning(), false);
  },
});

Deno.test({
  name: "PluginManager - activatePlugin on already active plugin is no-op",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();
    let activateCount = 0;

    manager.registerPlugin(createMockPlugin({
      id: "double-activate",
      activate: async () => { activateCount++; },
    }));

    await manager.activatePlugin("double-activate");
    await manager.activatePlugin("double-activate");

    assertEquals(activateCount, 1);
  },
});

Deno.test({
  name: "PluginManager - deactivatePlugin on non-active plugin is no-op",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();

    manager.registerPlugin(createMockPlugin({ id: "inactive-deactivate" }));

    // Plugin is in "installed" state, not "active"
    await manager.deactivatePlugin("inactive-deactivate");

    assertEquals(manager.getPlugin("inactive-deactivate")?.state, "installed");
  },
});

// ============================================================================
// getAllMCPTools Tests
// ============================================================================

Deno.test({
  name: "PluginManager - getAllMCPTools returns tools from all active plugins",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();

    manager.registerPlugin(createMockPlugin({
      id: "tools-plugin-a",
      activate: async (context: PluginContext) => {
        context.registerMCPTool({
          name: "tool_a",
          description: "Tool A",
          inputSchema: {},
          execute: async () => ({}),
        });
      },
    }));

    manager.registerPlugin(createMockPlugin({
      id: "tools-plugin-b",
      activate: async (context: PluginContext) => {
        context.registerMCPTool({
          name: "tool_b",
          description: "Tool B",
          inputSchema: {},
          execute: async () => ({}),
        });
      },
    }));

    await manager.activatePlugin("tools-plugin-a");
    await manager.activatePlugin("tools-plugin-b");

    const tools = manager.getAllMCPTools();
    assertEquals(tools.length, 2);

    const names = tools.map(t => t.name);
    assertEquals(names.includes("tool_a"), true);
    assertEquals(names.includes("tool_b"), true);
  },
});

Deno.test({
  name: "PluginManager - getAllMCPTools returns empty array when no tools registered",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();

    manager.registerPlugin(createMockPlugin({ id: "no-tools" }));
    await manager.activatePlugin("no-tools");

    assertEquals(manager.getAllMCPTools().length, 0);
  },
});

// ============================================================================
// Subsystem Wiring Tests
// ============================================================================

Deno.test({
  name: "PluginManager - wires request middleware to proxy runtime on registration",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const addedMiddleware: string[] = [];
    const mockMiddlewareChain = {
      addRequestMiddleware: (mw: { name: string }) => { addedMiddleware.push(mw.name); },
      removeRequestMiddleware: (_name: string) => true,
    };
    const mockGateway = { getMiddlewareChain: () => mockMiddlewareChain };
    const mockProxyRuntime = { getGatewayServers: () => [mockGateway] };

    const manager = createTestPluginManager();
    // Override the getProxyRuntime to return our mock
    (manager as unknown as { options: { getProxyRuntime: () => unknown } }).options.getProxyRuntime = () => mockProxyRuntime;

    manager.registerPlugin(createMockPlugin({
      id: "wire-req-mw",
      activate: async (context: PluginContext) => {
        context.addRequestMiddleware({
          name: "wired-mw",
          processRequest: async () => ({ type: "continue" as const }),
        });
      },
    }));

    await manager.activatePlugin("wire-req-mw");

    assertEquals(addedMiddleware, ["wired-mw"]);
  },
});

Deno.test({
  name: "PluginManager - unwires request middleware from proxy runtime on dispose",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const removedMiddleware: string[] = [];
    const mockMiddlewareChain = {
      addRequestMiddleware: (_mw: { name: string }) => {},
      removeRequestMiddleware: (name: string) => { removedMiddleware.push(name); return true; },
    };
    const mockGateway = { getMiddlewareChain: () => mockMiddlewareChain };
    const mockProxyRuntime = { getGatewayServers: () => [mockGateway] };

    const manager = createTestPluginManager();
    (manager as unknown as { options: { getProxyRuntime: () => unknown } }).options.getProxyRuntime = () => mockProxyRuntime;

    manager.registerPlugin(createMockPlugin({
      id: "unwire-req-mw",
      activate: async (context: PluginContext) => {
        context.addRequestMiddleware({
          name: "to-remove",
          processRequest: async () => ({ type: "continue" as const }),
        });
      },
    }));

    await manager.activatePlugin("unwire-req-mw");
    await manager.deactivatePlugin("unwire-req-mw");

    assertEquals(removedMiddleware, ["to-remove"]);
  },
});

Deno.test({
  name: "PluginManager - wires response middleware to proxy runtime on registration",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const addedMiddleware: string[] = [];
    const mockMiddlewareChain = {
      addResponseMiddleware: (mw: { name: string }) => { addedMiddleware.push(mw.name); },
      removeResponseMiddleware: (_name: string) => true,
    };
    const mockGateway = { getMiddlewareChain: () => mockMiddlewareChain };
    const mockProxyRuntime = { getGatewayServers: () => [mockGateway] };

    const manager = createTestPluginManager();
    (manager as unknown as { options: { getProxyRuntime: () => unknown } }).options.getProxyRuntime = () => mockProxyRuntime;

    manager.registerPlugin(createMockPlugin({
      id: "wire-resp-mw",
      activate: async (context: PluginContext) => {
        context.addResponseMiddleware({
          name: "wired-resp",
          processResponse: async () => ({ type: "continue" as const }),
        });
      },
    }));

    await manager.activatePlugin("wire-resp-mw");

    assertEquals(addedMiddleware, ["wired-resp"]);
  },
});

Deno.test({
  name: "PluginManager - wires query function to query engine on registration",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const registeredFunctions: string[] = [];
    const mockRegistry = {
      register: (func: { signature: { name: string } }) => { registeredFunctions.push(func.signature.name); },
      unregister: (_name: string) => true,
    };
    const mockQueryEngine = { getFunctionRegistry: () => mockRegistry };

    const manager = createTestPluginManager();
    (manager as unknown as { options: { getQueryEngine: () => unknown } }).options.getQueryEngine = () => mockQueryEngine;

    manager.registerPlugin(createMockPlugin({
      id: "wire-qf",
      activate: async (context: PluginContext) => {
        context.registerQueryFunction({
          signature: { name: "WIRED_FUNC", category: "custom", minArgs: 0, maxArgs: 0, argTypes: [], returnType: "STRING" },
          execute: () => "wired",
        });
      },
    }));

    await manager.activatePlugin("wire-qf");

    assertEquals(registeredFunctions, ["WIRED_FUNC"]);
  },
});

Deno.test({
  name: "PluginManager - unwires query function from query engine on dispose",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const unregisteredFunctions: string[] = [];
    const mockRegistry = {
      register: (_func: unknown) => {},
      unregister: (name: string) => { unregisteredFunctions.push(name); return true; },
    };
    const mockQueryEngine = { getFunctionRegistry: () => mockRegistry };

    const manager = createTestPluginManager();
    (manager as unknown as { options: { getQueryEngine: () => unknown } }).options.getQueryEngine = () => mockQueryEngine;

    manager.registerPlugin(createMockPlugin({
      id: "unwire-qf",
      activate: async (context: PluginContext) => {
        context.registerQueryFunction({
          signature: { name: "TO_REMOVE", category: "custom", minArgs: 0, maxArgs: 0, argTypes: [], returnType: "STRING" },
          execute: () => "test",
        });
      },
    }));

    await manager.activatePlugin("unwire-qf");
    await manager.deactivatePlugin("unwire-qf");

    assertEquals(unregisteredFunctions, ["TO_REMOVE"]);
  },
});

Deno.test({
  name: "PluginManager - wiring is safe when proxy runtime is null",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    // Default mock returns null for getProxyRuntime — should not throw
    const manager = createTestPluginManager();

    manager.registerPlugin(createMockPlugin({
      id: "null-proxy",
      activate: async (context: PluginContext) => {
        context.addRequestMiddleware({
          name: "safe-mw",
          processRequest: async () => ({ type: "continue" as const }),
        });
      },
    }));

    await manager.activatePlugin("null-proxy");

    assertEquals(manager.getPlugin("null-proxy")?.state, "active");
  },
});

Deno.test({
  name: "PluginManager - wiring is safe when query engine is null",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    // Default mock returns null for getQueryEngine — should not throw
    const manager = createTestPluginManager();

    manager.registerPlugin(createMockPlugin({
      id: "null-qe",
      activate: async (context: PluginContext) => {
        context.registerQueryFunction({
          signature: { name: "SAFE_FUNC", category: "custom", minArgs: 0, maxArgs: 0, argTypes: [], returnType: "STRING" },
          execute: () => "test",
        });
      },
    }));

    await manager.activatePlugin("null-qe");

    assertEquals(manager.getPlugin("null-qe")?.state, "active");
  },
});
