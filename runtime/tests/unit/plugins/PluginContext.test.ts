/**
 * PluginContext Unit Tests
 *
 * Tests for the PluginContext implementation including contribution
 * registration, disposable tracking, runtime access, and scoped logging.
 */

import {
  assertEquals,
  assertExists,
  assertThrows,
} from "@std/assert";
import { PluginContextImpl, type PluginContextOptions } from "../../../src/plugins/PluginContext.ts";
import { PluginRegistry } from "../../../src/plugins/PluginRegistry.ts";
import type { Plugin, PluginContext } from "../../../src/plugins/types.ts";
import type { BrowserXRuntimeConfig } from "../../../src/config/RuntimeConfig.ts";
import { createTestConfig } from "../../../src/config/RuntimeConfig.ts";

/**
 * Create a mock plugin for registry registration.
 */
function createMockPlugin(id = "test-plugin"): Plugin {
  return {
    id,
    name: "Test Plugin",
    version: "1.0.0",
    activate: async (_context: PluginContext) => {},
    deactivate: async () => {},
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
  const handlers = new Map<string, unknown>();
  return {
    registerHandler: (id: string, handler: unknown) => {
      handlers.set(id, handler);
    },
    unregisterHandler: (id: string) => {
      handlers.delete(id);
    },
    getHandlers: () => handlers,
  };
}

/**
 * Create a PluginContext with default test options.
 */
function createTestContext(
  pluginId = "test-plugin",
  overrides: Partial<PluginContextOptions> = {},
): { context: PluginContextImpl; registry: PluginRegistry; healthChecker: ReturnType<typeof createMockHealthChecker> } {
  const registry = new PluginRegistry();
  registry.register(createMockPlugin(pluginId));

  const healthChecker = createMockHealthChecker();

  const options: PluginContextOptions = {
    pluginId,
    config: createTestConfig(),
    pluginConfig: {},
    browserPool: createMockBrowserPool() as unknown as PluginContextOptions["browserPool"],
    healthChecker: healthChecker as unknown as PluginContextOptions["healthChecker"],
    registry,
    getQueryEngine: () => null,
    getProxyRuntime: () => null,
    eventListeners: [],
    ...overrides,
  };

  const context = new PluginContextImpl(options);
  return { context, registry, healthChecker };
}

// ============================================================================
// Basic Properties Tests
// ============================================================================

Deno.test("PluginContext - has correct pluginId", () => {
  const { context } = createTestContext("my-plugin");
  assertEquals(context.pluginId, "my-plugin");
});

Deno.test("PluginContext - has frozen config", () => {
  const { context } = createTestContext();
  assertExists(context.config);
  assertEquals(context.config.environment, "test");

  // Config should be frozen
  assertThrows(() => {
    (context.config as BrowserXRuntimeConfig).environment = "production";
  });
});

Deno.test("PluginContext - has plugin-specific config", () => {
  const { context } = createTestContext("test-plugin", {
    pluginConfig: { trackingId: "abc-123" },
  });

  assertEquals(context.pluginConfig.trackingId, "abc-123");
});

Deno.test("PluginContext - has scoped logger", () => {
  const { context } = createTestContext();
  assertExists(context.log);
  assertExists(context.log.debug);
  assertExists(context.log.info);
  assertExists(context.log.warn);
  assertExists(context.log.error);
});

// ============================================================================
// Request Middleware Tests
// ============================================================================

Deno.test("PluginContext - addRequestMiddleware registers middleware", () => {
  const { context } = createTestContext();

  const disposable = context.addRequestMiddleware({
    name: "test-mw",
    processRequest: async () => ({ type: "continue" as const }),
  });

  assertExists(disposable);
  assertEquals(context.getRequestMiddleware().length, 1);
  assertEquals(context.getRequestMiddleware()[0].name, "test-mw");
});

Deno.test("PluginContext - addRequestMiddleware dispose removes middleware", () => {
  const { context } = createTestContext();

  const disposable = context.addRequestMiddleware({
    name: "test-mw",
    processRequest: async () => ({ type: "continue" as const }),
  });

  assertEquals(context.getRequestMiddleware().length, 1);

  disposable.dispose();
  assertEquals(context.getRequestMiddleware().length, 0);
});

Deno.test("PluginContext - addRequestMiddleware throws on duplicate name", () => {
  const { context } = createTestContext();

  context.addRequestMiddleware({
    name: "test-mw",
    processRequest: async () => ({ type: "continue" as const }),
  });

  assertThrows(
    () => context.addRequestMiddleware({
      name: "test-mw",
      processRequest: async () => ({ type: "continue" as const }),
    }),
    Error,
    "already registered",
  );
});

Deno.test("PluginContext - addRequestMiddleware tracks disposable in registry", () => {
  const { context, registry } = createTestContext();

  context.addRequestMiddleware({
    name: "test-mw",
    processRequest: async () => ({ type: "continue" as const }),
  });

  const info = registry.get("test-plugin");
  assertEquals(info?.disposables.length, 1);
});

// ============================================================================
// Response Middleware Tests
// ============================================================================

Deno.test("PluginContext - addResponseMiddleware registers and disposes", () => {
  const { context } = createTestContext();

  const disposable = context.addResponseMiddleware({
    name: "resp-mw",
    processResponse: async () => ({ type: "continue" as const }),
  });

  assertEquals(context.getResponseMiddleware().length, 1);

  disposable.dispose();
  assertEquals(context.getResponseMiddleware().length, 0);
});

// ============================================================================
// Query Function Tests
// ============================================================================

Deno.test("PluginContext - registerQueryFunction registers function", () => {
  const { context } = createTestContext();

  const disposable = context.registerQueryFunction({
    signature: {
      name: "MY_FUNC",
      category: "custom",
      minArgs: 0,
      maxArgs: 1,
      argTypes: [],
      returnType: "STRING",
    },
    execute: () => "hello",
  });

  assertExists(disposable);
  assertEquals(context.getQueryFunctions().length, 1);
  assertEquals(context.getQueryFunctions()[0].signature.name, "MY_FUNC");
});

Deno.test("PluginContext - registerQueryFunction dispose cleans up", () => {
  const { context } = createTestContext();

  const disposable = context.registerQueryFunction({
    signature: {
      name: "MY_FUNC",
      category: "custom",
      minArgs: 0,
      maxArgs: 0,
      argTypes: [],
      returnType: "NUMBER",
    },
    execute: () => 42,
  });

  disposable.dispose();
  assertEquals(context.getQueryFunctions().length, 0);
});

Deno.test("PluginContext - registerQueryFunction throws on duplicate", () => {
  const { context } = createTestContext();

  context.registerQueryFunction({
    signature: { name: "DUPE", category: "custom", minArgs: 0, maxArgs: 0, argTypes: [], returnType: "STRING" },
    execute: () => "a",
  });

  assertThrows(
    () => context.registerQueryFunction({
      signature: { name: "DUPE", category: "custom", minArgs: 0, maxArgs: 0, argTypes: [], returnType: "STRING" },
      execute: () => "b",
    }),
    Error,
    "already registered",
  );
});

// ============================================================================
// MCP Tool Tests
// ============================================================================

Deno.test("PluginContext - registerMCPTool registers and disposes", () => {
  const { context } = createTestContext();

  const disposable = context.registerMCPTool({
    name: "my_tool",
    description: "A test tool",
    inputSchema: { type: "object" },
    execute: async () => ({ result: "ok" }),
  });

  assertEquals(context.getMCPTools().length, 1);

  disposable.dispose();
  assertEquals(context.getMCPTools().length, 0);
});

Deno.test("PluginContext - registerMCPTool throws on duplicate", () => {
  const { context } = createTestContext();

  context.registerMCPTool({
    name: "my_tool",
    description: "Tool 1",
    inputSchema: {},
    execute: async () => ({}),
  });

  assertThrows(
    () => context.registerMCPTool({
      name: "my_tool",
      description: "Tool 2",
      inputSchema: {},
      execute: async () => ({}),
    }),
    Error,
    "already registered",
  );
});

// ============================================================================
// DevTools Domain Tests
// ============================================================================

Deno.test("PluginContext - registerDevToolsDomain registers and disposes", () => {
  const { context } = createTestContext();

  const disposable = context.registerDevToolsDomain({
    name: "MyDomain",
    version: "1.0",
    methods: {
      getData: {
        handler: async () => ({ data: [] }),
      },
    },
  });

  assertEquals(context.getDevToolsDomains().length, 1);

  disposable.dispose();
  assertEquals(context.getDevToolsDomains().length, 0);
});

// ============================================================================
// Health Check Tests
// ============================================================================

Deno.test("PluginContext - registerHealthCheck registers with HealthChecker", () => {
  const { context, healthChecker } = createTestContext();

  context.registerHealthCheck("my-check", async () => ({
    status: "healthy" as const,
    message: "All good",
  }));

  // Should have registered with the health checker
  assertEquals(healthChecker.getHandlers().has("plugin:test-plugin:my-check"), true);
});

Deno.test("PluginContext - registerHealthCheck dispose unregisters", () => {
  const { context, healthChecker } = createTestContext();

  const disposable = context.registerHealthCheck("my-check", async () => ({
    status: "healthy" as const,
  }));

  assertEquals(healthChecker.getHandlers().has("plugin:test-plugin:my-check"), true);

  disposable.dispose();
  assertEquals(healthChecker.getHandlers().has("plugin:test-plugin:my-check"), false);
});

Deno.test("PluginContext - registerHealthCheck throws on duplicate", () => {
  const { context } = createTestContext();

  context.registerHealthCheck("my-check", async () => ({
    status: "healthy" as const,
  }));

  assertThrows(
    () => context.registerHealthCheck("my-check", async () => ({
      status: "healthy" as const,
    })),
    Error,
    "already registered",
  );
});

// ============================================================================
// Event Listener Tests
// ============================================================================

Deno.test("PluginContext - addEventListener adds listener", () => {
  const listeners: unknown[] = [];
  const eventListeners: Array<(event: unknown) => void> = [];

  const { context } = createTestContext("test-plugin", {
    eventListeners: eventListeners as unknown as PluginContextOptions["eventListeners"],
  });

  context.addEventListener((event) => {
    listeners.push(event);
  });

  assertEquals(eventListeners.length, 1);
});

Deno.test("PluginContext - addEventListener dispose removes listener", () => {
  const eventListeners: Array<(event: unknown) => void> = [];

  const { context } = createTestContext("test-plugin", {
    eventListeners: eventListeners as unknown as PluginContextOptions["eventListeners"],
  });

  const disposable = context.addEventListener(() => {});

  assertEquals(eventListeners.length, 1);

  disposable.dispose();
  assertEquals(eventListeners.length, 0);
});

// ============================================================================
// Runtime Access Tests
// ============================================================================

Deno.test("PluginContext - getBrowserPool returns browser pool", () => {
  const mockPool = createMockBrowserPool();
  const { context } = createTestContext("test-plugin", {
    browserPool: mockPool as unknown as PluginContextOptions["browserPool"],
  });

  assertEquals(context.getBrowserPool(), mockPool);
});

Deno.test("PluginContext - getQueryEngine returns query engine", () => {
  const queryEngine = { execute: () => {} };
  const { context } = createTestContext("test-plugin", {
    getQueryEngine: () => queryEngine,
  });

  assertEquals(context.getQueryEngine(), queryEngine);
});

Deno.test("PluginContext - getProxyRuntime returns proxy runtime", () => {
  const proxyRuntime = { handle: () => {} };
  const { context } = createTestContext("test-plugin", {
    getProxyRuntime: () => proxyRuntime,
  });

  assertEquals(context.getProxyRuntime(), proxyRuntime);
});

// ============================================================================
// Multiple Contributions Tests
// ============================================================================

Deno.test("PluginContext - multiple contributions are tracked in registry", () => {
  const { context, registry } = createTestContext();

  context.addRequestMiddleware({
    name: "mw-1",
    processRequest: async () => ({ type: "continue" as const }),
  });

  context.registerQueryFunction({
    signature: { name: "FUNC", category: "custom", minArgs: 0, maxArgs: 0, argTypes: [], returnType: "STRING" },
    execute: () => "test",
  });

  context.registerMCPTool({
    name: "tool",
    description: "A tool",
    inputSchema: {},
    execute: async () => ({}),
  });

  const info = registry.get("test-plugin");
  assertEquals(info?.disposables.length, 3);
});

Deno.test("PluginContext - registry disposeAll cleans all contributions", () => {
  const { context, registry } = createTestContext();

  context.addRequestMiddleware({
    name: "mw-1",
    processRequest: async () => ({ type: "continue" as const }),
  });

  context.registerQueryFunction({
    signature: { name: "FUNC", category: "custom", minArgs: 0, maxArgs: 0, argTypes: [], returnType: "STRING" },
    execute: () => "test",
  });

  // Dispose all via registry (simulating plugin deactivation)
  registry.disposeAll("test-plugin");

  assertEquals(context.getRequestMiddleware().length, 0);
  assertEquals(context.getQueryFunctions().length, 0);
});

// ============================================================================
// Subsystem Hook Callback Tests
// ============================================================================

Deno.test("PluginContext - onAddRequestMiddleware hook is called on registration", () => {
  const hookCalls: string[] = [];
  const { context } = createTestContext("test-plugin", {
    onAddRequestMiddleware: (mw) => { hookCalls.push(`add:${mw.name}`); },
  });

  context.addRequestMiddleware({
    name: "hook-mw",
    processRequest: async () => ({ type: "continue" as const }),
  });

  assertEquals(hookCalls, ["add:hook-mw"]);
});

Deno.test("PluginContext - onRemoveRequestMiddleware hook is called on dispose", () => {
  const hookCalls: string[] = [];
  const { context } = createTestContext("test-plugin", {
    onRemoveRequestMiddleware: (name) => { hookCalls.push(`remove:${name}`); },
  });

  const disposable = context.addRequestMiddleware({
    name: "hook-mw",
    processRequest: async () => ({ type: "continue" as const }),
  });

  disposable.dispose();

  assertEquals(hookCalls, ["remove:hook-mw"]);
});

Deno.test("PluginContext - onAddResponseMiddleware hook is called on registration", () => {
  const hookCalls: string[] = [];
  const { context } = createTestContext("test-plugin", {
    onAddResponseMiddleware: (mw) => { hookCalls.push(`add:${mw.name}`); },
  });

  context.addResponseMiddleware({
    name: "hook-resp-mw",
    processResponse: async () => ({ type: "continue" as const }),
  });

  assertEquals(hookCalls, ["add:hook-resp-mw"]);
});

Deno.test("PluginContext - onRemoveResponseMiddleware hook is called on dispose", () => {
  const hookCalls: string[] = [];
  const { context } = createTestContext("test-plugin", {
    onRemoveResponseMiddleware: (name) => { hookCalls.push(`remove:${name}`); },
  });

  const disposable = context.addResponseMiddleware({
    name: "hook-resp-mw",
    processResponse: async () => ({ type: "continue" as const }),
  });

  disposable.dispose();

  assertEquals(hookCalls, ["remove:hook-resp-mw"]);
});

Deno.test("PluginContext - onRegisterQueryFunction hook is called on registration", () => {
  const hookCalls: string[] = [];
  const { context } = createTestContext("test-plugin", {
    onRegisterQueryFunction: (func) => { hookCalls.push(`add:${func.signature.name}`); },
  });

  context.registerQueryFunction({
    signature: { name: "HOOK_FUNC", category: "custom", minArgs: 0, maxArgs: 0, argTypes: [], returnType: "STRING" },
    execute: () => "test",
  });

  assertEquals(hookCalls, ["add:HOOK_FUNC"]);
});

Deno.test("PluginContext - onUnregisterQueryFunction hook is called on dispose", () => {
  const hookCalls: string[] = [];
  const { context } = createTestContext("test-plugin", {
    onUnregisterQueryFunction: (name) => { hookCalls.push(`remove:${name}`); },
  });

  const disposable = context.registerQueryFunction({
    signature: { name: "HOOK_FUNC", category: "custom", minArgs: 0, maxArgs: 0, argTypes: [], returnType: "STRING" },
    execute: () => "test",
  });

  disposable.dispose();

  assertEquals(hookCalls, ["remove:HOOK_FUNC"]);
});

Deno.test("PluginContext - onRegisterDevToolsDomain hook is called on registration", () => {
  const hookCalls: string[] = [];
  const { context } = createTestContext("test-plugin", {
    onRegisterDevToolsDomain: (domain) => { hookCalls.push(`add:${domain.name}`); },
  });

  context.registerDevToolsDomain({
    name: "HookDomain",
    version: "1.0",
    methods: {},
  });

  assertEquals(hookCalls, ["add:HookDomain"]);
});

Deno.test("PluginContext - onUnregisterDevToolsDomain hook is called on dispose", () => {
  const hookCalls: string[] = [];
  const { context } = createTestContext("test-plugin", {
    onUnregisterDevToolsDomain: (name) => { hookCalls.push(`remove:${name}`); },
  });

  const disposable = context.registerDevToolsDomain({
    name: "HookDomain",
    version: "1.0",
    methods: {},
  });

  disposable.dispose();

  assertEquals(hookCalls, ["remove:HookDomain"]);
});

Deno.test("PluginContext - hooks are optional and don't break without them", () => {
  // Create context with NO hooks (default behavior)
  const { context } = createTestContext();

  // All registration should work fine without hooks
  const d1 = context.addRequestMiddleware({
    name: "no-hook-mw",
    processRequest: async () => ({ type: "continue" as const }),
  });
  const d2 = context.addResponseMiddleware({
    name: "no-hook-resp",
    processResponse: async () => ({ type: "continue" as const }),
  });
  const d3 = context.registerQueryFunction({
    signature: { name: "NO_HOOK", category: "custom", minArgs: 0, maxArgs: 0, argTypes: [], returnType: "STRING" },
    execute: () => "test",
  });
  const d4 = context.registerDevToolsDomain({
    name: "NoHookDomain",
    version: "1.0",
    methods: {},
  });

  assertEquals(context.getRequestMiddleware().length, 1);
  assertEquals(context.getResponseMiddleware().length, 1);
  assertEquals(context.getQueryFunctions().length, 1);
  assertEquals(context.getDevToolsDomains().length, 1);

  // Dispose all — should work fine without hooks
  d1.dispose();
  d2.dispose();
  d3.dispose();
  d4.dispose();

  assertEquals(context.getRequestMiddleware().length, 0);
  assertEquals(context.getResponseMiddleware().length, 0);
  assertEquals(context.getQueryFunctions().length, 0);
  assertEquals(context.getDevToolsDomains().length, 0);
});

Deno.test("PluginContext - disposeAll triggers removal hooks for all contributions", () => {
  const hookCalls: string[] = [];
  const { context, registry } = createTestContext("test-plugin", {
    onRemoveRequestMiddleware: (name) => { hookCalls.push(`remove-req:${name}`); },
    onUnregisterQueryFunction: (name) => { hookCalls.push(`remove-qf:${name}`); },
    onUnregisterDevToolsDomain: (name) => { hookCalls.push(`remove-dt:${name}`); },
  });

  context.addRequestMiddleware({
    name: "bulk-mw",
    processRequest: async () => ({ type: "continue" as const }),
  });
  context.registerQueryFunction({
    signature: { name: "BULK_FUNC", category: "custom", minArgs: 0, maxArgs: 0, argTypes: [], returnType: "STRING" },
    execute: () => "test",
  });
  context.registerDevToolsDomain({
    name: "BulkDomain",
    version: "1.0",
    methods: {},
  });

  // Simulate plugin deactivation
  registry.disposeAll("test-plugin");

  assertEquals(hookCalls.includes("remove-req:bulk-mw"), true);
  assertEquals(hookCalls.includes("remove-qf:BULK_FUNC"), true);
  assertEquals(hookCalls.includes("remove-dt:BulkDomain"), true);
});
