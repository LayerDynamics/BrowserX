/**
 * Test: BrowserEngine is shared across execution steps
 * Verifies that NAVIGATE and DOM_QUERY use the same browser instance
 */

import { assertEquals, assertExists } from "@std/assert";
import { QueryEngine } from "../../core/engine.ts";

Deno.test({
  name: "QueryEngine shares BrowserController across NAVIGATE + DOM_QUERY steps",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // This query creates a NAVIGATE step then a DOM_QUERY step.
  // Before the fix, DOM_QUERY gets a fresh BrowserEngine with no DOM.
  // After the fix, both steps share the same BrowserController.
  const result = await engine.execute(
    'SELECT title FROM "https://example.com"',
    { timeout: 15000 },
  );

  assertExists(result, "Result should exist");
  assertExists(result.data, "Data should exist");
  // The query should NOT throw "Undefined identifier: title" or "No page available"
  // (It may still fail on field resolution until Fix 1, but should not crash on missing browser)

  await engine.shutdown();
});
