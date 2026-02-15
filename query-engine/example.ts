/**
 * BrowserX Query Engine — Example Usage
 *
 * Run: deno task query:example
 */

import { QueryEngine } from "./core/engine.ts";

async function main() {
  const engine = new QueryEngine();
  await engine.initialize({});

  console.log("=== BrowserX Query Engine Examples ===\n");

  // Example 1: Extract page title
  console.log("1. SELECT title FROM URL:");
  try {
    const result = await engine.execute(
      'SELECT title FROM "https://example.com"',
      { timeout: 15000 },
    );
    console.log("   Result:", result.data);
    console.log("   Time:", Math.round(result.timing.totalTime), "ms\n");
  } catch (e) {
    console.error("   Error:", (e as Error).message, "\n");
  }

  // Example 2: SET configuration
  console.log("2. SET timeout:");
  try {
    const result = await engine.execute("SET timeout = 10000");
    console.log("   Result:", result.data);
    console.log("   Time:", Math.round(result.timing.totalTime), "ms\n");
  } catch (e) {
    console.error("   Error:", (e as Error).message, "\n");
  }

  // Example 3: NAVIGATE with capture
  console.log("3. NAVIGATE TO URL:");
  try {
    const result = await engine.execute(
      'NAVIGATE TO "https://example.com"',
      { timeout: 15000 },
    );
    console.log("   Result:", result.data);
    console.log("   Time:", Math.round(result.timing.totalTime), "ms\n");
  } catch (e) {
    console.error("   Error:", (e as Error).message, "\n");
  }

  await engine.shutdown();
  console.log("=== Done ===");
}

main();
