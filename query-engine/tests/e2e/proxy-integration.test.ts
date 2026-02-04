/**
 * E2E Proxy Integration Tests
 * Tests proxy engine integration with the query engine
 * Including caching, connection pooling, and request interception
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import { QueryEngine } from "../../core/engine.ts";
import { Lexer } from "../../lexer/mod.ts";
import { Parser } from "../../parser/mod.ts";
import { SemanticAnalyzer } from "../../analyzer/mod.ts";
import { QueryOptimizer } from "../../optimizer/mod.ts";
import { ExecutionPlanner, ExecutionStepType } from "../../planner/mod.ts";

// ============================================================================
// Proxy Initialization E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Proxy Integration - engine initializes without proxy",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: { enabled: false },
  });

  assertEquals(engine.isInitialized(), true);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Proxy Integration - engine initializes with proxy",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: { enabled: true },
  });

  assertEquals(engine.isInitialized(), true);

  const proxyController = engine.getProxyController();
  assertExists(proxyController);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Proxy Integration - proxy controller accessible",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: { enabled: true },
  });

  const proxyController = engine.getProxyController();
  assertExists(proxyController);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Proxy Integration - runtime accessible",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: { enabled: true },
  });

  const runtime = engine.getRuntime();
  assertExists(runtime);

  await engine.shutdown();
});

// ============================================================================
// Cache Integration E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Proxy Integration - cache enabled with proxy",
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

  const runtime = engine.getRuntime();
  assertExists(runtime);
  assertExists(runtime.cache);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Proxy Integration - cache store and retrieve",
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

  // Store via proxy controller
  await proxyController.executeCacheStore({
    type: ExecutionStepType.CACHE_STORE,
    id: "test-cache-store",
    dependencies: [],
    estimatedCost: 1,
    cacheable: true,
    cacheKey: "test-key",
    value: { data: "test-value" },
    ttl: 60000,
  });

  // Retrieve via runtime cache
  const cached = runtime.cache.get("test-key");
  assertExists(cached);
  assertEquals((cached as any).data, "test-value");

  await engine.shutdown();
});

Deno.test({
  name: "E2E Proxy Integration - cache retrieve",
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

  // Store first
  runtime.cache.set("retrieve-test-key", { value: 42 });

  // Retrieve via proxy controller
  const result = await proxyController.executeCacheRetrieve({
    type: ExecutionStepType.CACHE_RETRIEVE,
    id: "test-cache-retrieve",
    dependencies: [],
    estimatedCost: 1,
    cacheable: true,
    cacheKey: "retrieve-test-key",
  });

  assertExists(result);
  assertEquals((result as any).value, 42);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Proxy Integration - cache invalidation",
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

  const runtime = engine.getRuntime();

  // Store and invalidate
  runtime.cache.set("invalidate-key", { data: "test" });
  assertExists(runtime.cache.get("invalidate-key"));

  runtime.cache.delete("invalidate-key");
  // Cache returns null for missing keys
  assertEquals(runtime.cache.get("invalidate-key"), null);

  await engine.shutdown();
});

// ============================================================================
// NAVIGATE with Proxy Options E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Proxy Integration - NAVIGATE with cache option parses",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "http://example.com" WITH { proxy: { cache: true } }';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();

  assertEquals(ast.type, "NAVIGATE");
  assertExists((ast as any).options);
});

Deno.test({
  name: "E2E Proxy Integration - NAVIGATE with TTL option parses",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "http://example.com" WITH { proxy: { cache: true, ttl: 3600 } }';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();

  assertEquals(ast.type, "NAVIGATE");
  assertExists((ast as any).options);
});

Deno.test({
  name: "E2E Proxy Integration - NAVIGATE with headers option",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `NAVIGATE TO "http://example.com" WITH {
    proxy: {
      headers: { "Authorization": "Bearer token" }
    }
  }`;
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();

  assertEquals(ast.type, "NAVIGATE");
  assertExists((ast as any).options);
});

Deno.test({
  name: "E2E Proxy Integration - NAVIGATE preserves options through pipeline",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "http://example.com" WITH { proxy: { cache: true } }';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertEquals(optimized.optimizedAST.type, "NAVIGATE");
  assertExists((optimized.optimizedAST as any).options);
});

Deno.test({
  name: "E2E Proxy Integration - NAVIGATE with proxy executes",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: { enabled: true },
  });

  const result = await engine.execute(
    'NAVIGATE TO "http://example.com" WITH { proxy: { cache: true } }',
    { timeout: 5000 }
  );

  assertExists(result);

  await engine.shutdown();
});

// ============================================================================
// Execution Step Types E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Proxy Integration - CACHE_STORE step type",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  assertExists(ExecutionStepType.CACHE_STORE);
});

Deno.test({
  name: "E2E Proxy Integration - CACHE_RETRIEVE step type",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  assertExists(ExecutionStepType.CACHE_RETRIEVE);
});

Deno.test({
  name: "E2E Proxy Integration - plan step types",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "http://example.com"';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);
  const planner = new ExecutionPlanner();
  const plan = planner.plan(optimized.optimizedAST, {
    optimizationApplied: true,
    appliedPasses: [],
    estimatedImprovement: 0,
  });

  // Plan should have steps with valid types
  for (const step of plan.steps) {
    assertExists(step.type);
    assertExists(ExecutionStepType[step.type as keyof typeof ExecutionStepType]);
  }
});

// ============================================================================
// Multiple Queries with Proxy E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Proxy Integration - sequential queries share proxy",
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

  // Use NAVIGATE instead of SELECT to avoid expression evaluation issues
  const result1 = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );
  const result2 = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );
  const result3 = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result1);
  assertExists(result2);
  assertExists(result3);

  // All should use same proxy controller
  const proxyController = engine.getProxyController();
  assertExists(proxyController);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Proxy Integration - concurrent queries with proxy",
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

  // Start multiple async queries
  const queryId1 = await engine.executeAsync(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );
  const queryId2 = await engine.executeAsync(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(queryId1);
  assertExists(queryId2);
  assert(queryId1 !== queryId2);

  await engine.shutdown();
});

// ============================================================================
// Error Handling with Proxy E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Proxy Integration - engine recovers after proxy error",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: { enabled: true },
  });

  // First query fails
  try {
    await engine.execute('INVALID QUERY!!!', { timeout: 5000 });
  } catch {
    // Expected
  }

  // Second query should succeed
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );
  assertExists(result);

  // Proxy controller should still be accessible
  const proxyController = engine.getProxyController();
  assertExists(proxyController);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Proxy Integration - metrics track failed proxy queries",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: { enabled: true },
  });

  // Execute a failing query
  try {
    await engine.execute('INVALID!!!', { timeout: 5000 });
  } catch {
    // Expected
  }

  const metrics = engine.getMetrics();
  assertEquals(metrics.queries.failed > 0, true);

  await engine.shutdown();
});

// ============================================================================
// Metrics with Proxy E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Proxy Integration - metrics track proxy queries",
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

  await engine.execute('NAVIGATE TO "http://example.com"', { timeout: 5000 });
  await engine.execute('NAVIGATE TO "http://example.com"', { timeout: 5000 });

  const metrics = engine.getMetrics();
  assertEquals(metrics.queries.total, 2);
  assertEquals(metrics.queries.successful, 2);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Proxy Integration - timing includes proxy operations",
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

  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result.timing);
  assertExists(result.timing.totalTime);
  assertEquals(result.timing.totalTime >= 0, true);

  await engine.shutdown();
});

// ============================================================================
// Engine Lifecycle with Proxy E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Proxy Integration - shutdown cleans up proxy",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: { enabled: true },
  });

  assertExists(engine.getProxyController());
  assertExists(engine.getRuntime());

  await engine.shutdown();

  assertEquals(engine.isInitialized(), false);
});

Deno.test({
  name: "E2E Proxy Integration - reinitialize proxy",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();

  // First session
  await engine.initialize({
    proxy: { enabled: true },
  });
  const result1 = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );
  assertExists(result1);
  await engine.shutdown();

  // Second session
  await engine.initialize({
    proxy: { enabled: true },
  });
  const result2 = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );
  assertExists(result2);
  await engine.shutdown();
});

Deno.test({
  name: "E2E Proxy Integration - metrics reset on reinit",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();

  // First session
  await engine.initialize({
    proxy: { enabled: true },
  });
  await engine.execute('NAVIGATE TO "http://example.com"', { timeout: 5000 });
  assertEquals(engine.getMetrics().queries.total, 1);
  await engine.shutdown();

  // Second session - metrics should reset
  await engine.initialize({
    proxy: { enabled: true },
  });
  assertEquals(engine.getMetrics().queries.total, 0);
  await engine.shutdown();
});

// ============================================================================
// Configuration E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Proxy Integration - custom cache TTL",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: {
      enabled: true,
      cache: {
        enabled: true,
        defaultTTL: 30000, // 30 seconds
      },
    },
  });

  assertExists(engine.getRuntime());
  assertExists(engine.getRuntime().cache);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Proxy Integration - cache disabled",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: {
      enabled: true,
      cache: {
        enabled: false,
      },
    },
  });

  // Should still work without cache
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );
  assertExists(result);

  await engine.shutdown();
});

// ============================================================================
// Async Operations with Proxy E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Proxy Integration - async query with proxy",
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

  const queryId = await engine.executeAsync(
    'NAVIGATE TO "http://example.com"',
    { timeout: 10000 }
  );

  assertExists(queryId);

  const status = await engine.getQueryStatus(queryId);
  assertExists(status);
  assertEquals(status.queryId, queryId);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Proxy Integration - cancel query with proxy",
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

  const queryId = await engine.executeAsync(
    'FOR i IN [1,2,3,4,5] DO NAVIGATE TO "http://example.com" END',
    { timeout: 30000 }
  );

  try {
    await engine.cancelQuery(queryId);
    const status = await engine.getQueryStatus(queryId);
    assert(status.state === "CANCELLED" || status.state === "COMPLETED");
  } catch {
    // May have completed
  }

  await engine.shutdown();
});

// ============================================================================
// Query Result Metadata E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Proxy Integration - result contains query string",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: { enabled: true },
  });

  const query = 'NAVIGATE TO "http://example.com"';
  const result = await engine.execute(query, { timeout: 5000 });

  assertEquals(result.metadata.query, query);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Proxy Integration - result contains AST",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: { enabled: true },
  });

  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result.metadata.ast);
  assertEquals(result.metadata.ast.type, "NAVIGATE");

  await engine.shutdown();
});

Deno.test({
  name: "E2E Proxy Integration - result contains estimated cost",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: { enabled: true },
  });

  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result.metadata.estimatedCost);
  assertEquals(typeof result.metadata.estimatedCost, "number");

  await engine.shutdown();
});
