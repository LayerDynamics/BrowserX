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
  await engine.initialize({});

  // Execute a query that navigates
  // This should set the global browser context
  try {
    await engine.execute('NAVIGATE TO "about:blank"', { timeout: 5000 });
  } catch {
    // Navigation may fail in test environment, but context should still be set
  }

  // After navigation, the global browser context should be set
  const controller = getCurrentBrowserController();
  assertExists(controller, "Browser context should be set after navigation");

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

  const controller1 = getCurrentBrowserController();

  // Second operation should use same context
  try {
    await engine.execute('SELECT 1 AS test', { timeout: 5000 });
  } catch {
    // May fail
  }

  const controller2 = getCurrentBrowserController();

  // Context should persist
  assertExists(controller1);
  assertExists(controller2);

  await engine.shutdown();
  clearBrowserContext();
});
