/**
 * Test: Page metadata is available in DOM query eval context
 */

import { assertEquals, assertExists } from "@std/assert";

Deno.test({
  name: "BrowserController.executeDOMQuery includes page metadata in eval context",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  // This is tested indirectly via the engine — a full query that resolves 'title'
  const { QueryEngine } = await import("../../core/engine.ts");
  const engine = new QueryEngine();
  await engine.initialize({});

  const result = await engine.execute(
    'SELECT title FROM "https://example.com"',
    { timeout: 15000 },
  );

  assertExists(result.data, "Should return data");

  // Parse the formatted result (JSON string) to check actual content
  const parsed = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
  assertExists(parsed, "Parsed data should exist");

  // example.com has <title>Example Domain</title>
  const rows = Array.isArray(parsed) ? parsed : parsed.rows || parsed.data || [parsed];
  assertEquals(rows.length > 0, true, "Should have at least one row");
  assertEquals(
    rows[0].title,
    "Example Domain",
    "Should extract title from <title> tag",
  );

  await engine.shutdown();
});
