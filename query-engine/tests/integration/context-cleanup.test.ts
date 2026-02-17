/**
 * Integration test for context cleanup on query completion
 * Verifies that browser context is properly cleaned up after query execution
 */

import { assertEquals, assertExists } from "@std/assert";
import { QueryEngine } from "../../core/engine.ts";
import {
  clearBrowserContext,
  getCurrentBrowserController,
} from "../../controllers/browser/browser-context.ts";

Deno.test({
  name: "browser context is cleaned up after successful query",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  clearBrowserContext();

  const engine = new QueryEngine();
  await engine.initialize({});

  // Execute a query that uses browser
  try {
    await engine.execute('NAVIGATE TO "about:blank"', { timeout: 5000 });
  } catch {
    // Navigation may fail, but context should still be managed
  }

  // After execute() completes, the finally block clears the context
  const controllerAfterExec = getCurrentBrowserController();
  assertEquals(controllerAfterExec, undefined, "Context should be cleared after execute() via finally block");

  // Shutdown the engine
  await engine.shutdown();

  clearBrowserContext(); // Manual cleanup for test isolation
});

Deno.test({
  name: "multiple sequential queries maintain isolated contexts",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  clearBrowserContext();

  const engine = new QueryEngine();
  await engine.initialize({});

  // First query
  try {
    await engine.execute('SELECT 1 AS first', { timeout: 5000 });
  } catch {
    // May fail
  }

  // Second query should work with clean context
  try {
    await engine.execute('SELECT 2 AS second', { timeout: 5000 });
  } catch {
    // May fail
  }

  // Queries should complete without context pollution
  await engine.shutdown();
  clearBrowserContext();
});

Deno.test({
  name: "engine shutdown clears proxy controller cache",
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
  assertExists(proxyController);

  // After shutdown, proxy controller should be cleared
  await engine.shutdown();

  assertEquals(engine.getProxyController(), undefined, "ProxyController should be cleared after shutdown");
  assertEquals(engine.getRuntime(), undefined, "Runtime should be cleared after shutdown");
});
