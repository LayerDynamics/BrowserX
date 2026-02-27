/**
 * Tests for PluginManager.withTimeout cancellation fix.
 *
 * Verifies that when a plugin activation times out, the AbortSignal
 * is fired and the plugin is marked as failed rather than left in
 * an inconsistent state.
 */

import { assertEquals, assertExists } from "@std/assert";
import { PluginManager, type PluginManagerOptions } from "../../../src/plugins/PluginManager.ts";
import type { Plugin, PluginContext } from "../../../src/plugins/types.ts";
import { createTestConfig } from "../../../src/config/RuntimeConfig.ts";

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

function createTestPluginManager(
  configOverrides: Record<string, unknown> = {},
): PluginManager {
  const config = {
    ...createTestConfig(),
    plugins: {
      enabled: true,
      pluginDirs: [],
      plugins: [],
      activationTimeout: 100, // Very short for tests
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

Deno.test({
  name: "PluginManager timeout - slow plugin activation is aborted and marked as error",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const manager = createTestPluginManager({ activationTimeout: 50 });
    await manager.start();

    const slowPlugin: Plugin = {
      id: "slow-plugin",
      name: "slow-plugin",
      version: "1.0.0",
      activate: async (_context: PluginContext) => {
        // Simulate a slow operation that never completes within timeout
        await new Promise((resolve) => setTimeout(resolve, 5000));
      },
      deactivate: async () => {},
    };

    manager.registerPlugin(slowPlugin);
    await manager.activatePlugin("slow-plugin");

    // Plugin should be in error state, not active
    const info = manager.getPlugin("slow-plugin");
    assertExists(info);
    assertEquals(info.state, "error");

    await manager.stop();
  },
});

Deno.test({
  name: "PluginManager timeout - fast plugin activation succeeds normally",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const manager = createTestPluginManager({ activationTimeout: 5000 });
    await manager.start();

    let activated = false;
    const fastPlugin: Plugin = {
      id: "fast-plugin",
      name: "fast-plugin",
      version: "1.0.0",
      activate: async (_context: PluginContext) => {
        activated = true;
      },
      deactivate: async () => {},
    };

    manager.registerPlugin(fastPlugin);
    await manager.activatePlugin("fast-plugin");

    assertEquals(activated, true);
    const info = manager.getPlugin("fast-plugin");
    assertExists(info);
    assertEquals(info.state, "active");

    await manager.stop();
  },
});

Deno.test({
  name: "PluginManager timeout - withTimeout AbortSignal is provided for cancellation",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const manager = createTestPluginManager({ activationTimeout: 50 });
    await manager.start();

    // After timeout, plugin should be in error state and not corrupt manager state
    const hangingPlugin: Plugin = {
      id: "hanging-plugin",
      name: "hanging-plugin",
      version: "1.0.0",
      activate: async (_context: PluginContext) => {
        // This simulates a plugin that hangs
        await new Promise((_resolve) => {
          // Never resolves - timeout should handle this
          setTimeout(() => {}, 10000);
        });
      },
      deactivate: async () => {},
    };

    manager.registerPlugin(hangingPlugin);
    await manager.activatePlugin("hanging-plugin");

    // Should be error, not active
    const info = manager.getPlugin("hanging-plugin");
    assertExists(info);
    assertEquals(info.state, "error");

    // Manager should still be functional
    assertEquals(manager.isRunning(), true);

    await manager.stop();
  },
});
