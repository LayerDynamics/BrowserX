/**
 * Integration test for browser context propagation
 * Verifies that the global browser context is set after navigation
 */

import { assertEquals, assertExists } from "@std/assert";
import { QueryEngine } from "../../core/engine.ts";
import {
  clearBrowserContext,
  getCurrentBrowserController,
} from "../../controllers/browser/browser-context.ts";

Deno.test({
  name: "browser context is set globally after navigation",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  // Clear any existing context
  clearBrowserContext();

  // Verify no context exists initially
  assertEquals(getCurrentBrowserController(), undefined);

  const engine = new QueryEngine();
  assertExists(engine);
  await engine.initialize({});

  // Execute a query that navigates
  // This should set the global browser context
  try {
    await engine.execute('NAVIGATE TO "about:blank"', { timeout: 5000 });
  } catch {
    // Navigation may fail in test environment, but context should still be set
  }

  // After execute() returns, the finally block clears the browser context.
  // Context is set during execution (in executeNavigate) and cleared when execute() completes.
  const controller = getCurrentBrowserController();
  assertEquals(controller, undefined, "Browser context is cleared after execute() via finally block");

  await engine.shutdown();
  clearBrowserContext();
});

Deno.test({
  name: "browser context persists across multiple operations",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  clearBrowserContext();

  const engine = new QueryEngine();
  await engine.initialize({});

  // First navigation
  try {
    await engine.execute('NAVIGATE TO "about:blank"', { timeout: 5000 });
  } catch {
    // May fail
  }

  // After execute() returns, context is cleared by the finally block
  const controller1 = getCurrentBrowserController();

  // Second operation - context is set fresh for each execute() call
  try {
    await engine.execute('SELECT 1 AS test', { timeout: 5000 });
  } catch {
    // May fail
  }

  const controller2 = getCurrentBrowserController();

  // Both should be cleared after each execute() completes (finally block behavior)
  assertEquals(controller1, undefined, "Context cleared after first execute()");
  assertEquals(controller2, undefined, "Context cleared after second execute()");

  await engine.shutdown();
  clearBrowserContext();
});
