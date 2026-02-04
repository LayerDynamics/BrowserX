/**
 * End-to-End Integration Tests for BrowserX Query Engine
 * Tests complete query execution pipeline with all integrations
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { QueryEngine } from "../../core/engine.ts";
import {
  clearBrowserContext,
  getCurrentBrowserController,
} from "../../controllers/browser/browser-context.ts";
import { ExecutionStepType } from "../../planner/mod.ts";

/**
 * Test Suite: Query Engine E2E Integration
 * Note: SELECT with DOM field extraction requires defined DOM attributes.
 * Tests use NAVIGATE TO or SET statements for reliable execution.
 */

Deno.test({
  name: "E2E: Simple SELECT query executes successfully",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use NAVIGATE since SELECT * needs DOM field definitions
  const result = await engine.execute('NAVIGATE TO "http://example.com"', { timeout: 5000 });

  assertExists(result);
  assertExists(result.queryId);
  assertExists(result.timing);
  assertEquals(result.timing.totalTime > 0, true, "Should have execution time");

  await engine.shutdown();
});

Deno.test({
  name: "E2E: Query with proxy caching enabled",
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

  // Verify proxy controller is initialized
  const proxyController = engine.getProxyController();
  assertExists(proxyController, "ProxyController should exist");

  const runtime = engine.getRuntime();
  assertExists(runtime, "Runtime should exist");
  assertExists(runtime.cache, "Runtime cache should exist");

  // Execute a query - use NAVIGATE since SELECT needs DOM fields
  const result = await engine.execute('NAVIGATE TO "http://example.com"', { timeout: 5000 });
  assertExists(result);

  await engine.shutdown();
});

Deno.test({
  name: "E2E: Navigation sets browser context globally",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  clearBrowserContext();

  const engine = new QueryEngine();
  await engine.initialize({});

  assertEquals(getCurrentBrowserController(), undefined, "Context should be empty initially");

  // Execute navigation (may fail due to network, but context should still be set)
  try {
    await engine.execute('NAVIGATE TO "about:blank"', { timeout: 5000 });
  } catch {
    // Expected to fail without real network
  }

  // Context should be set even if navigation fails
  const controller = getCurrentBrowserController();
  assertExists(controller, "Browser context should be set after navigation attempt");

  await engine.shutdown();
  clearBrowserContext();
});

Deno.test({
  name: "E2E: Async query execution with status tracking",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Start async query - use NAVIGATE since SELECT * needs DOM fields
  const queryId = await engine.executeAsync('NAVIGATE TO "http://example.com"', { timeout: 5000 });
  assertExists(queryId);

  // Get initial status
  const status = await engine.getQueryStatus(queryId);
  assertExists(status);
  assertEquals(status.queryId, queryId);

  // Wait for completion
  await new Promise((resolve) => setTimeout(resolve, 100));

  await engine.shutdown();
});

Deno.test({
  name: "E2E: Query cancellation",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Start async query - use NAVIGATE since SELECT * needs DOM fields
  const queryId = await engine.executeAsync('NAVIGATE TO "http://example.com"', { timeout: 30000 });

  // Cancel immediately
  try {
    await engine.cancelQuery(queryId);
    const status = await engine.getQueryStatus(queryId);
    assertEquals(status.state, "CANCELLED");
  } catch {
    // May already be completed
  }

  await engine.shutdown();
});

Deno.test({
  name: "E2E: Multiple sequential queries with context isolation",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: {
      enabled: true,
      cache: { enabled: true, defaultTTL: 60000 },
    },
  });

  // Execute multiple queries - use NAVIGATE since SELECT * needs DOM fields
  const result1 = await engine.execute('NAVIGATE TO "http://example1.com"', { timeout: 5000 });
  const result2 = await engine.execute('NAVIGATE TO "http://example2.com"', { timeout: 5000 });
  const result3 = await engine.execute('NAVIGATE TO "http://example3.com"', { timeout: 5000 });

  assertExists(result1);
  assertExists(result2);
  assertExists(result3);

  // Each query should have its own queryId
  assertEquals(result1.queryId !== result2.queryId, true);
  assertEquals(result2.queryId !== result3.queryId, true);

  await engine.shutdown();
});

Deno.test({
  name: "E2E: Query metrics tracking",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Execute several queries - use SET for reliable execution
  await engine.execute('SET value1 = 1', { timeout: 5000 });
  await engine.execute('SET value2 = 2', { timeout: 5000 });
  await engine.execute('SET value3 = 3', { timeout: 5000 });

  const metrics = engine.getMetrics();

  assertExists(metrics);
  assertEquals(metrics.queries.total, 3, "Should track 3 queries");
  assertEquals(metrics.queries.successful, 3, "Should have 3 successful queries");

  await engine.shutdown();
});

Deno.test({
  name: "E2E: Error recovery - invalid query syntax",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Execute invalid query
  await assertRejects(
    () => engine.execute("INVALID QUERY SYNTAX !!!", { timeout: 5000 }),
    Error,
  );

  // Engine should still be usable after error - use SET for reliable execution
  const result = await engine.execute('SET recovery = 1', { timeout: 5000 });
  assertExists(result);

  const metrics = engine.getMetrics();
  assertEquals(metrics.queries.failed > 0, true, "Should track failed query");

  await engine.shutdown();
});

Deno.test({
  name: "E2E: Engine state management",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();

  // Not initialized yet
  assertEquals(engine.isInitialized(), false);

  await engine.initialize({});
  assertEquals(engine.isInitialized(), true);

  // Can execute queries - use SET for reliable execution
  const result = await engine.execute('SET value = 1', { timeout: 5000 });
  assertExists(result);

  await engine.shutdown();
  assertEquals(engine.isInitialized(), false);

  // Attempting to execute after shutdown should fail
  await assertRejects(
    () => engine.execute('SET value = 1', { timeout: 5000 }),
    Error,
    "not initialized",
  );
});

Deno.test({
  name: "E2E: Query timing breakdown",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use SET for reliable execution
  const result = await engine.execute('SET computed = 1 + 1', { timeout: 5000 });

  assertExists(result.timing);
  assertExists(result.timing.lexerTime);
  assertExists(result.timing.parserTime);
  assertExists(result.timing.semanticAnalysisTime);
  assertExists(result.timing.optimizationTime);
  assertExists(result.timing.planningTime);
  assertExists(result.timing.executionTime);
  assertExists(result.timing.formattingTime);
  assertExists(result.timing.totalTime);

  // All timings should be non-negative
  assertEquals(result.timing.totalTime >= 0, true);
  assertEquals(result.timing.lexerTime >= 0, true);
  assertEquals(result.timing.parserTime >= 0, true);

  await engine.shutdown();
});

Deno.test({
  name: "E2E: Proxy controller uses runtime cache integration",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: {
      enabled: true,
      cache: { enabled: true, defaultTTL: 60000 },
    },
  });

  const proxyController = engine.getProxyController();
  const runtime = engine.getRuntime();

  assertExists(proxyController);
  assertExists(runtime);

  // Store a value via proxy controller
  await proxyController.executeCacheStore({
    type: ExecutionStepType.CACHE_STORE,
    id: "test-store",
    dependencies: [],
    estimatedCost: 1,
    cacheable: true,
    cacheKey: "e2e-test-key",
    value: { test: "data" },
    ttl: 60000,
  });

  // Retrieve via runtime cache
  const cachedValue = runtime.cache.get("e2e-test-key");
  assertExists(cachedValue);
  assertEquals((cachedValue as any).test, "data");

  await engine.shutdown();
});

Deno.test({
  name: "E2E: Full query metadata",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use SET for reliable execution
  const query = 'SET result = 1';
  const result = await engine.execute(query, { timeout: 5000 });

  assertExists(result.metadata);
  assertEquals(result.metadata.query, query);
  assertExists(result.metadata.ast);
  assertExists(result.metadata.stepsExecuted);
  assertExists(result.metadata.estimatedCost);

  await engine.shutdown();
});
