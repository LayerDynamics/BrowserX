/**
 * Query Engine Usage Examples
 *
 * This file demonstrates how to use the Query Engine
 */

import { QueryEngine, type QueryEngineConfig } from "./mod.ts";

/**
 * Example 1: Basic Setup and Initialization
 */
async function example1_BasicSetup() {
  console.log("\n=== Example 1: Basic Setup ===\n");

  // Create engine configuration
  const config: QueryEngineConfig = {
    browser: {
      headless: true,
      defaultViewport: { width: 1920, height: 1080 },
      defaultTimeout: 30000,
    },
    proxy: {
      enabled: true,
      defaultCache: true,
      defaultTimeout: 10000,
    },
    security: {
      permissions: ["NAVIGATE_PUBLIC", "READ_COOKIES", "SCREENSHOT"],
      sandbox: {
        enabled: true,
        timeout: 60000,
      },
      rateLimit: {
        perSecond: 10,
        perMinute: 100,
        perHour: 1000,
      },
    },
    metrics: {
      enabled: true,
      tracing: true,
      exportFormat: "json",
    },
  };

  // Create and initialize engine
  const engine = new QueryEngine(config);
  await engine.initialize(config);

  console.log("Query Engine initialized successfully!");

  return engine;
}

/**
 * Example 2: Simple Data Extraction
 */
async function example2_SimpleExtraction(engine: QueryEngine) {
  console.log("\n=== Example 2: Simple Data Extraction ===\n");

  const query = `SELECT title FROM "https://example.com"`;

  console.log("Query:", query);

  try {
    const result = await engine.execute(query);

    console.log("\nResult:");
    console.log(JSON.stringify(result, null, 2));

    console.log("\nTiming breakdown:");
    console.log(`  Lexer: ${result.timing.lexerTime.toFixed(2)}ms`);
    console.log(`  Parser: ${result.timing.parserTime.toFixed(2)}ms`);
    console.log(`  Total: ${result.timing.totalTime.toFixed(2)}ms`);
  } catch (error) {
    console.error("Error executing query:", error);
  }
}

/**
 * Example 3: Multi-field Extraction
 */
async function example3_MultiFieldExtraction(engine: QueryEngine) {
  console.log("\n=== Example 3: Multi-field Extraction ===\n");

  const query = `
    SELECT title, description, keywords
    FROM "https://example.com"
  `;

  console.log("Query:", query.trim());

  try {
    const result = await engine.execute(query);
    console.log("\nResult:", result.data);
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example 4: Navigation with Proxy Options
 */
async function example4_NavigationWithProxy(engine: QueryEngine) {
  console.log("\n=== Example 4: Navigation with Proxy ===\n");

  const query = `
    NAVIGATE TO "https://api.example.com/users"
      WITH {
        proxy: {
          headers: {"Authorization": "Bearer token123"},
          cache: false
        },
        browser: {
          viewport: {width: 1920, height: 1080}
        }
      }
      CAPTURE response.status, response.body
  `;

  console.log("Query:", query.trim());

  try {
    const result = await engine.execute(query);
    console.log("\nResult:", result.data);
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example 5: Conditional Execution
 */
async function example5_ConditionalExecution(engine: QueryEngine) {
  console.log("\n=== Example 5: Conditional Execution ===\n");

  const query = `
    IF NOT EXISTS("#user-menu") THEN
      INSERT "user@example.com" INTO "#email"
      INSERT "password123" INTO "#password"
      CLICK "#login-button"
    ELSE
      SELECT TEXT("#user-menu")
  `;

  console.log("Query:", query.trim());

  try {
    const result = await engine.execute(query);
    console.log("\nResult:", result.data);
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example 6: Iteration
 */
async function example6_Iteration(engine: QueryEngine) {
  console.log("\n=== Example 6: Iteration ===\n");

  const urls = [
    "https://example1.com",
    "https://example2.com",
    "https://example3.com",
  ];

  const query = `
    FOR EACH url IN ${JSON.stringify(urls)}
      SELECT title FROM url
  `;

  console.log("Query:", query.trim());

  try {
    const result = await engine.execute(query);
    console.log("\nResult:", result.data);
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example 7: Async Execution
 */
async function example7_AsyncExecution(engine: QueryEngine) {
  console.log("\n=== Example 7: Async Execution ===\n");

  const query = `SELECT * FROM "https://example.com"`;

  console.log("Query:", query);

  try {
    // Start async execution
    const queryId = await engine.executeAsync(query);
    console.log("\nQuery ID:", queryId);

    // Check status
    const status = await engine.getQueryStatus(queryId);
    console.log("Status:", status);

    // In a real scenario, you would poll or wait for completion
    // For now, just demonstrate the API
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example 8: Metrics Collection
 */
async function example8_MetricsCollection(engine: QueryEngine) {
  console.log("\n=== Example 8: Metrics Collection ===\n");

  const metrics = engine.getMetrics();

  console.log("Engine Metrics:");
  console.log(JSON.stringify(metrics, null, 2));
}

/**
 * Example 9: Complex Query with WHERE and ORDER BY
 */
async function example9_ComplexQuery(engine: QueryEngine) {
  console.log("\n=== Example 9: Complex Query ===\n");

  const query = `
    SELECT product.name, product.price
    FROM "https://store.example.com/products"
    WHERE product.price < 100
    ORDER BY product.price ASC
    LIMIT 10
  `;

  console.log("Query:", query.trim());

  try {
    const result = await engine.execute(query);
    console.log("\nResult:", result.data);
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example 10: Built-in Functions
 */
async function example10_BuiltinFunctions(engine: QueryEngine) {
  console.log("\n=== Example 10: Built-in Functions ===\n");

  const query = `
    SELECT
      UPPER(title) AS uppercaseTitle,
      TEXT(".description") AS description,
      COUNT("a[href]") AS linkCount
    FROM "https://example.com"
  `;

  console.log("Query:", query.trim());

  try {
    const result = await engine.execute(query);
    console.log("\nResult:", result.data);
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Main function - Run all examples
 */
async function main() {
  console.log("╔═══════════════════════════════════════╗");
  console.log("║   Query Engine Usage Examples         ║");
  console.log("╚═══════════════════════════════════════╝");

  try {
    // Initialize engine
    const engine = await example1_BasicSetup();

    // Run examples
    await example2_SimpleExtraction(engine);
    await example3_MultiFieldExtraction(engine);
    await example4_NavigationWithProxy(engine);
    await example5_ConditionalExecution(engine);
    await example6_Iteration(engine);
    await example7_AsyncExecution(engine);
    await example8_MetricsCollection(engine);
    await example9_ComplexQuery(engine);
    await example10_BuiltinFunctions(engine);

    // Shutdown
    console.log("\n=== Shutting Down ===\n");
    await engine.shutdown();
    console.log("Query Engine shut down successfully!");
  } catch (error) {
    console.error("\n❌ Error running examples:", error);
    Deno.exit(1);
  }

  console.log("\n✅ All examples completed successfully!");
}

// Run examples if this file is executed directly
if (import.meta.main) {
  main();
}
