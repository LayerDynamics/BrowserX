/**
 * Integration test for QueryEngine ProxyController initialization
 * Verifies that QueryEngine creates and wires ProxyController when proxy is enabled
 */

import { assertEquals, assertExists } from "@std/assert";
import { QueryEngine } from "../../core/engine.ts";

Deno.test({
  name: "QueryEngine initializes ProxyController when proxy enabled",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: {
      enabled: true,
      cache: {
        enabled: true,
        defaultTTL: 60000,
      },
    },
  });

  // Check that proxy controller is initialized
  const proxyController = engine.getProxyController();
  assertExists(proxyController, "ProxyController should be initialized when proxy enabled");

  // Check that runtime is initialized
  const runtime = engine.getRuntime();
  assertExists(runtime, "Runtime should be initialized when proxy enabled");
  assertExists(runtime.cache, "Runtime should have cache interface");

  await engine.shutdown();
});

Deno.test({
  name: "QueryEngine does not initialize ProxyController when proxy disabled",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: {
      enabled: false,
    },
  });

  // ProxyController should not be initialized
  const proxyController = engine.getProxyController();
  assertEquals(proxyController, undefined, "ProxyController should not be initialized when proxy disabled");

  await engine.shutdown();
});

Deno.test({
  name: "QueryEngine ProxyController uses Runtime cache",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: {
      enabled: true,
      cache: {
        enabled: true,
        defaultTTL: 60000,
      },
    },
  });

  const proxyController = engine.getProxyController();
  const runtime = engine.getRuntime();

  assertExists(proxyController);
  assertExists(runtime);

  // The proxy controller should be using the runtime's cache
  // We verify this by checking that the proxy controller has the same runtime
  assertEquals(proxyController.getRuntime(), runtime, "ProxyController should use the engine's Runtime");

  await engine.shutdown();
});
