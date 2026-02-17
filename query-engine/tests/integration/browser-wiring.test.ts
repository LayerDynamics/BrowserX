/**
 * Integration test: BrowserController wired into QueryExecutor
 * Verifies that the global browser context is set at the start of execute()
 * and cleared in the finally block regardless of success/failure.
 */
import { assertEquals, assert } from "@std/assert";
import { QueryExecutor } from "../../executor/executor.ts";
import { BrowserController } from "../../controllers/browser/browser-controller.ts";
import {
  getCurrentBrowserController,
  clearBrowserContext,
} from "../../controllers/browser/browser-context.ts";

Deno.test({
  name: "QueryExecutor - browser context cleared after execute() on success",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    clearBrowserContext();

    const controller = new BrowserController();
    const executor = new QueryExecutor(controller);

    // Empty plan - 0 steps, succeeds immediately
    const emptyPlan = {
      id: "test-plan-1",
      steps: [],
      metadata: {
        queryId: "test-plan-1",
        estimatedCost: 0,
        parallelizable: false,
        cacheable: false,
      },
    };

    const result = await executor.execute(emptyPlan as never);
    assert(result.success);

    // After execute(), context must be cleared by finally block
    assertEquals(getCurrentBrowserController(), undefined);
  },
});

Deno.test({
  name: "QueryExecutor - browser context cleared after execute() on error",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    clearBrowserContext();

    const controller = new BrowserController();
    const executor = new QueryExecutor(controller);

    // Plan with invalid step type to trigger error path
    const badPlan = {
      id: "test-plan-2",
      steps: [{ id: "s1", type: "INVALID_STEP_TYPE_XYZ" }],
      metadata: {
        queryId: "test-plan-2",
        estimatedCost: 0,
        parallelizable: false,
        cacheable: false,
      },
    };

    const result = await executor.execute(badPlan as never);
    // Either succeeds or fails gracefully - no crash
    assert(result !== null);

    // Context must be cleared regardless of success/failure
    assertEquals(getCurrentBrowserController(), undefined);
  },
});

Deno.test({
  name: "QueryExecutor - no browser context set when controller is undefined",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    clearBrowserContext();

    // Create executor with NO browser controller
    const executor = new QueryExecutor();

    const emptyPlan = {
      id: "test-plan-3",
      steps: [],
      metadata: {
        queryId: "test-plan-3",
        estimatedCost: 0,
        parallelizable: false,
        cacheable: false,
      },
    };

    await executor.execute(emptyPlan as never);

    // Context should still be undefined (never set since no controller)
    assertEquals(getCurrentBrowserController(), undefined);
  },
});
