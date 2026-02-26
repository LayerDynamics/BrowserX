/**
 * PluginManager GraphX Integration Tests
 *
 * Tests that the PluginManager correctly uses GraphX DAG and topologicalSort
 * for activation ordering and cycle detection.
 */

import {
  assertEquals,
  assertStringIncludes,
} from "@std/assert";
import { PluginManager, type PluginManagerOptions } from "../../../src/plugins/PluginManager.ts";
import type { Plugin, PluginContext } from "../../../src/plugins/types.ts";
import { createTestConfig } from "../../../src/config/RuntimeConfig.ts";

// ── Helpers ──

function createMockPlugin(overrides: Partial<Plugin> & { id: string }): Plugin {
  return {
    name: overrides.id,
    version: "1.0.0",
    activate: async (_context: PluginContext) => {},
    deactivate: async () => {},
    ...overrides,
  };
}

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

function createTestPluginManager(): PluginManager {
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
    healthChecker: createMockHealthChecker() as unknown as PluginManagerOptions["healthChecker"],
    getQueryEngine: () => null,
    getProxyRuntime: () => null,
  };

  return new PluginManager(options);
}

// ── Tests ──

Deno.test("GraphX integration - diamond dependency: D activates before B and C, which activate before A", () => {
  const manager = createTestPluginManager();

  // Diamond: A depends on B and C, both B and C depend on D
  const pluginD = createMockPlugin({ id: "D" });
  const pluginB = createMockPlugin({ id: "B", dependencies: ["D"] });
  const pluginC = createMockPlugin({ id: "C", dependencies: ["D"] });
  const pluginA = createMockPlugin({ id: "A", dependencies: ["B", "C"] });

  manager.registerPlugin(pluginA);
  manager.registerPlugin(pluginB);
  manager.registerPlugin(pluginC);
  manager.registerPlugin(pluginD);

  const order = manager.getActivationOrder();

  // D must come before B and C; B and C must come before A
  const indexD = order.indexOf("D");
  const indexB = order.indexOf("B");
  const indexC = order.indexOf("C");
  const indexA = order.indexOf("A");

  assertEquals(order.length, 4);
  assertEquals(indexD < indexB, true, "D should activate before B");
  assertEquals(indexD < indexC, true, "D should activate before C");
  assertEquals(indexB < indexA, true, "B should activate before A");
  assertEquals(indexC < indexA, true, "C should activate before A");
});

Deno.test("GraphX integration - cycle detection: A -> B -> C -> A causes validation error", () => {
  const manager = createTestPluginManager();

  const pluginA = createMockPlugin({ id: "A", dependencies: ["C"] });
  const pluginB = createMockPlugin({ id: "B", dependencies: ["A"] });
  const pluginC = createMockPlugin({ id: "C", dependencies: ["B"] });

  manager.registerPlugin(pluginA);
  manager.registerPlugin(pluginB);
  manager.registerPlugin(pluginC);

  const errors = manager.validateDependencies();
  assertEquals(errors.length > 0, true, "Should detect circular dependency");
  assertStringIncludes(errors[0], "Circular dependency detected:");
});

Deno.test({
  name: "GraphX integration - deactivation is reverse of activation",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const manager = createTestPluginManager();
    const activationLog: string[] = [];
    const deactivationLog: string[] = [];

    const pluginB = createMockPlugin({
      id: "B",
      activate: async (_ctx: PluginContext) => { activationLog.push("B"); },
      deactivate: async () => { deactivationLog.push("B"); },
    });
    const pluginA = createMockPlugin({
      id: "A",
      dependencies: ["B"],
      activate: async (_ctx: PluginContext) => { activationLog.push("A"); },
      deactivate: async () => { deactivationLog.push("A"); },
    });

    manager.registerPlugin(pluginA);
    manager.registerPlugin(pluginB);

    await manager.start();

    assertEquals(activationLog, ["B", "A"]);

    await manager.stop();

    assertEquals(deactivationLog, ["A", "B"]);
  },
});

Deno.test("GraphX integration - single plugin with no dependencies", () => {
  const manager = createTestPluginManager();

  const plugin = createMockPlugin({ id: "solo" });
  manager.registerPlugin(plugin);

  const order = manager.getActivationOrder();
  assertEquals(order, ["solo"]);
});

Deno.test("GraphX integration - linear chain preserves order", () => {
  const manager = createTestPluginManager();

  const pluginC = createMockPlugin({ id: "C" });
  const pluginB = createMockPlugin({ id: "B", dependencies: ["C"] });
  const pluginA = createMockPlugin({ id: "A", dependencies: ["B"] });

  manager.registerPlugin(pluginA);
  manager.registerPlugin(pluginB);
  manager.registerPlugin(pluginC);

  const order = manager.getActivationOrder();
  const indexC = order.indexOf("C");
  const indexB = order.indexOf("B");
  const indexA = order.indexOf("A");

  assertEquals(indexC < indexB, true, "C before B");
  assertEquals(indexB < indexA, true, "B before A");
});

Deno.test("GraphX integration - missing dependency skipped in ordering (validation catches separately)", () => {
  const manager = createTestPluginManager();

  // A depends on "missing" which is not registered
  const pluginA = createMockPlugin({ id: "A", dependencies: ["missing"] });
  manager.registerPlugin(pluginA);

  // getActivationOrder should not throw — it skips unregistered deps
  const order = manager.getActivationOrder();
  assertEquals(order, ["A"]);

  // But validateDependencies should catch the missing dep
  const errors = manager.validateDependencies();
  assertEquals(errors.length > 0, true);
  assertStringIncludes(errors[0], "unregistered plugin");
});
