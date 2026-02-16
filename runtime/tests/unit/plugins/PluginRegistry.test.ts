/**
 * PluginRegistry Unit Tests
 *
 * Tests for plugin registration, state management, disposable tracking,
 * and query capabilities.
 */

import {
  assertEquals,
  assertExists,
  assertThrows,
} from "@std/assert";
import { PluginRegistry } from "../../../src/plugins/PluginRegistry.ts";
import type { Plugin, PluginContext } from "../../../src/plugins/types.ts";

/**
 * Create a mock plugin for testing.
 */
function createMockPlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    id: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    activate: async (_context: PluginContext) => {},
    deactivate: async () => {},
    ...overrides,
  };
}

// ============================================================================
// Basic Registration Tests
// ============================================================================

Deno.test("PluginRegistry - register a plugin", () => {
  const registry = new PluginRegistry();
  const plugin = createMockPlugin();

  registry.register(plugin);

  assertEquals(registry.has("test-plugin"), true);
  assertEquals(registry.size, 1);
});

Deno.test("PluginRegistry - register sets initial state to installed", () => {
  const registry = new PluginRegistry();
  const plugin = createMockPlugin();

  registry.register(plugin);

  const info = registry.get("test-plugin");
  assertExists(info);
  assertEquals(info.state, "installed");
  assertEquals(info.disposables.length, 0);
});

Deno.test("PluginRegistry - register throws on duplicate ID", () => {
  const registry = new PluginRegistry();
  const plugin = createMockPlugin();

  registry.register(plugin);

  assertThrows(
    () => registry.register(plugin),
    Error,
    'Plugin "test-plugin" is already registered',
  );
});

Deno.test("PluginRegistry - register multiple plugins", () => {
  const registry = new PluginRegistry();

  registry.register(createMockPlugin({ id: "plugin-a", name: "Plugin A" }));
  registry.register(createMockPlugin({ id: "plugin-b", name: "Plugin B" }));
  registry.register(createMockPlugin({ id: "plugin-c", name: "Plugin C" }));

  assertEquals(registry.size, 3);
  assertEquals(registry.has("plugin-a"), true);
  assertEquals(registry.has("plugin-b"), true);
  assertEquals(registry.has("plugin-c"), true);
});

// ============================================================================
// Unregister Tests
// ============================================================================

Deno.test("PluginRegistry - unregister a plugin", () => {
  const registry = new PluginRegistry();
  const plugin = createMockPlugin();

  registry.register(plugin);
  assertEquals(registry.has("test-plugin"), true);

  registry.unregister("test-plugin");
  assertEquals(registry.has("test-plugin"), false);
  assertEquals(registry.size, 0);
});

Deno.test("PluginRegistry - unregister throws on unknown plugin", () => {
  const registry = new PluginRegistry();

  assertThrows(
    () => registry.unregister("nonexistent"),
    Error,
    'Plugin "nonexistent" is not registered',
  );
});

// ============================================================================
// State Management Tests
// ============================================================================

Deno.test("PluginRegistry - setState changes plugin state", () => {
  const registry = new PluginRegistry();
  registry.register(createMockPlugin());

  registry.setState("test-plugin", "activating");
  assertEquals(registry.get("test-plugin")?.state, "activating");

  registry.setState("test-plugin", "active");
  assertEquals(registry.get("test-plugin")?.state, "active");
});

Deno.test("PluginRegistry - setState sets activatedAt on active", () => {
  const registry = new PluginRegistry();
  registry.register(createMockPlugin());

  const before = Date.now();
  registry.setState("test-plugin", "active");
  const after = Date.now();

  const info = registry.get("test-plugin");
  assertExists(info?.activatedAt);
  assertEquals(info.activatedAt >= before, true);
  assertEquals(info.activatedAt <= after, true);
});

Deno.test("PluginRegistry - setState sets deactivatedAt on inactive", () => {
  const registry = new PluginRegistry();
  registry.register(createMockPlugin());

  registry.setState("test-plugin", "active");
  registry.setState("test-plugin", "deactivating");
  registry.setState("test-plugin", "inactive");

  const info = registry.get("test-plugin");
  assertExists(info?.deactivatedAt);
});

Deno.test("PluginRegistry - setState throws on unknown plugin", () => {
  const registry = new PluginRegistry();

  assertThrows(
    () => registry.setState("nonexistent", "active"),
    Error,
    'Plugin "nonexistent" is not registered',
  );
});

Deno.test("PluginRegistry - setError sets error state and error", () => {
  const registry = new PluginRegistry();
  registry.register(createMockPlugin());

  const error = new Error("Something went wrong");
  registry.setError("test-plugin", error);

  const info = registry.get("test-plugin");
  assertEquals(info?.state, "error");
  assertEquals(info?.error?.message, "Something went wrong");
});

Deno.test("PluginRegistry - setError throws on unknown plugin", () => {
  const registry = new PluginRegistry();

  assertThrows(
    () => registry.setError("nonexistent", new Error("fail")),
    Error,
    'Plugin "nonexistent" is not registered',
  );
});

// ============================================================================
// Disposable Tracking Tests
// ============================================================================

Deno.test("PluginRegistry - addDisposable tracks disposable", () => {
  const registry = new PluginRegistry();
  registry.register(createMockPlugin());

  let disposed = false;
  registry.addDisposable("test-plugin", {
    dispose: () => { disposed = true; },
  });

  const info = registry.get("test-plugin");
  assertEquals(info?.disposables.length, 1);
  assertEquals(disposed, false);
});

Deno.test("PluginRegistry - disposeAll calls all disposables", () => {
  const registry = new PluginRegistry();
  registry.register(createMockPlugin());

  const disposals: string[] = [];
  registry.addDisposable("test-plugin", {
    dispose: () => disposals.push("a"),
  });
  registry.addDisposable("test-plugin", {
    dispose: () => disposals.push("b"),
  });
  registry.addDisposable("test-plugin", {
    dispose: () => disposals.push("c"),
  });

  registry.disposeAll("test-plugin");

  assertEquals(disposals, ["a", "b", "c"]);
  assertEquals(registry.get("test-plugin")?.disposables.length, 0);
});

Deno.test("PluginRegistry - disposeAll handles errors gracefully", () => {
  const registry = new PluginRegistry();
  registry.register(createMockPlugin());

  const disposals: string[] = [];
  registry.addDisposable("test-plugin", {
    dispose: () => disposals.push("a"),
  });
  registry.addDisposable("test-plugin", {
    dispose: () => { throw new Error("dispose error"); },
  });
  registry.addDisposable("test-plugin", {
    dispose: () => disposals.push("c"),
  });

  // Should not throw despite middle disposal failing
  registry.disposeAll("test-plugin");

  assertEquals(disposals, ["a", "c"]);
});

Deno.test("PluginRegistry - addDisposable throws on unknown plugin", () => {
  const registry = new PluginRegistry();

  assertThrows(
    () => registry.addDisposable("nonexistent", { dispose: () => {} }),
    Error,
    'Plugin "nonexistent" is not registered',
  );
});

// ============================================================================
// Query Tests
// ============================================================================

Deno.test("PluginRegistry - get returns undefined for unknown plugin", () => {
  const registry = new PluginRegistry();
  assertEquals(registry.get("nonexistent"), undefined);
});

Deno.test("PluginRegistry - getAll returns all plugins", () => {
  const registry = new PluginRegistry();

  registry.register(createMockPlugin({ id: "a", name: "A" }));
  registry.register(createMockPlugin({ id: "b", name: "B" }));

  const all = registry.getAll();
  assertEquals(all.length, 2);
});

Deno.test("PluginRegistry - getByState filters correctly", () => {
  const registry = new PluginRegistry();

  registry.register(createMockPlugin({ id: "a", name: "A" }));
  registry.register(createMockPlugin({ id: "b", name: "B" }));
  registry.register(createMockPlugin({ id: "c", name: "C" }));

  registry.setState("a", "active");
  registry.setState("b", "active");

  assertEquals(registry.getByState("active").length, 2);
  assertEquals(registry.getByState("installed").length, 1);
  assertEquals(registry.getByState("error").length, 0);
});

Deno.test("PluginRegistry - getActive returns active plugins", () => {
  const registry = new PluginRegistry();

  registry.register(createMockPlugin({ id: "a", name: "A" }));
  registry.register(createMockPlugin({ id: "b", name: "B" }));

  registry.setState("a", "active");

  const active = registry.getActive();
  assertEquals(active.length, 1);
  assertEquals(active[0].plugin.id, "a");
});

Deno.test("PluginRegistry - getIds returns all plugin IDs", () => {
  const registry = new PluginRegistry();

  registry.register(createMockPlugin({ id: "x", name: "X" }));
  registry.register(createMockPlugin({ id: "y", name: "Y" }));

  const ids = registry.getIds();
  assertEquals(ids.includes("x"), true);
  assertEquals(ids.includes("y"), true);
});

Deno.test("PluginRegistry - getSummary counts states correctly", () => {
  const registry = new PluginRegistry();

  registry.register(createMockPlugin({ id: "a", name: "A" }));
  registry.register(createMockPlugin({ id: "b", name: "B" }));
  registry.register(createMockPlugin({ id: "c", name: "C" }));
  registry.register(createMockPlugin({ id: "d", name: "D" }));

  registry.setState("a", "active");
  registry.setState("b", "active");
  registry.setError("c", new Error("fail"));

  const summary = registry.getSummary();
  assertEquals(summary.active, 2);
  assertEquals(summary.error, 1);
  assertEquals(summary.installed, 1);
  assertEquals(summary.inactive, 0);
});

// ============================================================================
// Clear Tests
// ============================================================================

Deno.test("PluginRegistry - clear disposes and removes all plugins", () => {
  const registry = new PluginRegistry();

  const disposals: string[] = [];
  registry.register(createMockPlugin({ id: "a", name: "A" }));
  registry.register(createMockPlugin({ id: "b", name: "B" }));

  registry.addDisposable("a", { dispose: () => disposals.push("a") });
  registry.addDisposable("b", { dispose: () => disposals.push("b") });

  registry.clear();

  assertEquals(registry.size, 0);
  assertEquals(disposals, ["a", "b"]);
});

Deno.test("PluginRegistry - empty registry", () => {
  const registry = new PluginRegistry();

  assertEquals(registry.size, 0);
  assertEquals(registry.getAll(), []);
  assertEquals(registry.getIds(), []);
  assertEquals(registry.getActive(), []);
});
