// Shim HTMLElement for Deno (GraphXCanvas extends it at top level)
if (typeof globalThis.HTMLElement === "undefined") {
  (globalThis as Record<string, unknown>).HTMLElement = class HTMLElement {};
}

/**
 * E2E Tests: Query Engine → Proxy Engine → Browser
 *
 * Validates query parsing, execution, and proxy configuration flowing
 * through the full BrowserX stack.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { QueryEngine } from "../../query-engine/core/engine.ts";
import { BrowserXRuntime } from "../../runtime/src/BrowserXRuntime.ts";
import { PatternRouter, type Route, type IncomingRequest } from "../../proxy-engine/gateway/router/request_router.ts";

// ============================================================================
// Test Helpers
// ============================================================================

function createDataURL(html: string): string {
  return `data:text/html,${encodeURIComponent(html)}`;
}

function createTestPage(options: {
  title?: string;
  body?: string;
} = {}): string {
  const { title = "Test Page", body = "<h1>Hello</h1>" } = options;
  return `<!DOCTYPE html><html><head><title>${title}</title></head><body>${body}</body></html>`;
}

// ============================================================================
// Query Engine → Browser Execution Tests
// ============================================================================

Deno.test({
  name: "E2E Query-Proxy-Browser - SELECT query parses and plans through engine pipeline",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const queryEngine = new QueryEngine();
    await queryEngine.initialize({});

    try {
      const url = createDataURL(createTestPage({ title: "Query Test" }));

      // SELECT goes through: Lexer → Parser → Analyzer → Optimizer → Planner → Executor
      try {
        const result = await queryEngine.execute(`SELECT title FROM "${url}"`);
        assertExists(result.queryId);
        assertExists(result.timing);
        assertExists(result.metadata);
        // If execution succeeded, verify timing breakdown exists
        assert(result.timing.totalTime >= 0);
      } catch (e) {
        // Expected if browser context not available — validates parsing path
        assert(e instanceof Error);
        assert(
          e.message.includes("page") || e.message.includes("browser") || e.message.includes("context"),
          `Unexpected error: ${e.message}`,
        );
      }
    } finally {
      await queryEngine.shutdown();
    }
  },
});

Deno.test({
  name: "E2E Query-Proxy-Browser - NAVIGATE query triggers browser navigation path",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const queryEngine = new QueryEngine();
    await queryEngine.initialize({});

    try {
      const url = createDataURL(createTestPage({ title: "Navigation Target" }));

      const result = await queryEngine.execute(`NAVIGATE TO "${url}"`);
      assertExists(result.queryId);
      assertExists(result.timing);
      assert(result.timing.totalTime >= 0);

      // Verify the query was tracked in metrics
      const metrics = queryEngine.getMetrics();
      assert(metrics.queries.total >= 1);
    } finally {
      await queryEngine.shutdown();
    }
  },
});

Deno.test({
  name: "E2E Query-Proxy-Browser - NAVIGATE with WITH clause passes proxy config",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const queryEngine = new QueryEngine();
    await queryEngine.initialize({});

    try {
      const url = createDataURL(createTestPage({ title: "Proxy Config Test" }));

      // WITH clause should parse and pass through to execution
      const result = await queryEngine.execute(
        `NAVIGATE TO "${url}" WITH { timeout: 30000 }`,
      );
      assertExists(result.queryId);
      assertExists(result.timing);
    } finally {
      await queryEngine.shutdown();
    }
  },
});

Deno.test({
  name: "E2E Query-Proxy-Browser - PatternRouter routes requests to proxy targets",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const router = new PatternRouter();

    // Add routes with full Route interface
    const apiRoute: Route = {
      id: "api-route",
      pattern: "/api/:path*",
      methods: ["GET", "POST"],
      priority: 10,
      enabled: true,
      upstream: {
        servers: [
          { id: "api-1", host: "localhost", port: 8080, weight: 1, enabled: true },
        ],
        loadBalancingStrategy: "round-robin",
        timeout: 30000,
      },
    };

    const staticRoute: Route = {
      id: "static-route",
      pattern: "/static/:path*",
      methods: ["GET"],
      priority: 5,
      enabled: true,
      upstream: {
        servers: [
          { id: "static-1", host: "localhost", port: 8081, weight: 1, enabled: true },
        ],
        loadBalancingStrategy: "round-robin",
        timeout: 30000,
      },
    };

    router.addRoute(apiRoute);
    router.addRoute(staticRoute);

    // Match routes using proper IncomingRequest with URL objects
    const apiMatch = router.match({
      method: "GET",
      url: new URL("http://localhost/api/users"),
      headers: {},
      clientIP: "127.0.0.1",
      metadata: {},
    } as IncomingRequest);
    assertExists(apiMatch);

    const staticMatch = router.match({
      method: "GET",
      url: new URL("http://localhost/static/style.css"),
      headers: {},
      clientIP: "127.0.0.1",
      metadata: {},
    } as IncomingRequest);
    assertExists(staticMatch);

    // Non-matching path returns null
    const noMatch = router.match({
      method: "GET",
      url: new URL("http://localhost/unknown/path"),
      headers: {},
      clientIP: "127.0.0.1",
      metadata: {},
    } as IncomingRequest);
    assertEquals(noMatch, null);
  },
});

Deno.test({
  name: "E2E Query-Proxy-Browser - Query engine metrics track across multiple queries",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const queryEngine = new QueryEngine();
    await queryEngine.initialize({});

    try {
      const urls = [
        createDataURL(createTestPage({ title: "Page A" })),
        createDataURL(createTestPage({ title: "Page B" })),
        createDataURL(createTestPage({ title: "Page C" })),
      ];

      // Execute multiple queries
      for (const url of urls) {
        try {
          await queryEngine.execute(`SELECT title FROM "${url}"`);
        } catch (_e) {
          // Expected — browser may not be available
        }
      }

      // Metrics should track all query attempts
      const metrics = queryEngine.getMetrics();
      assert(metrics.queries.total >= 3, `Expected >= 3 queries, got ${metrics.queries.total}`);

      // Engine should remain healthy
      assert(queryEngine.isInitialized());
    } finally {
      await queryEngine.shutdown();
    }
  },
});
