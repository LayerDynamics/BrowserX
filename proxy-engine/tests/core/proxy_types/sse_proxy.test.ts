/**
 * SSEProxy Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { SSEProxy } from "../../../core/proxy_types/sse_proxy.ts";
import type { Route } from "../../../gateway/router/request_router.ts";

function createTestRoute(): Route {
  return {
    id: "sse-test-route",
    pattern: "/events/*",
    methods: ["GET"],
    priority: 1,
    enabled: true,
    upstream: {
      servers: [
        { id: "server-1", host: "localhost", port: 8080, protocol: "http", weight: 1, enabled: true },
      ],
      loadBalancingStrategy: "round-robin",
      timeout: 5000,
    },
  };
}

// ============================================================================
// Construction
// ============================================================================

Deno.test({
  name: "SSEProxy - constructs with route",
  fn() {
    const proxy = new SSEProxy(createTestRoute());
    assertExists(proxy);
  },
});

Deno.test({
  name: "SSEProxy - constructs with route and config",
  fn() {
    const proxy = new SSEProxy(createTestRoute(), { keepAliveInterval: 15000 });
    assertExists(proxy);
  },
});

// ============================================================================
// getRoute()
// ============================================================================

Deno.test({
  name: "SSEProxy - getRoute() returns the route",
  fn() {
    const route = createTestRoute();
    const proxy = new SSEProxy(route);
    assertEquals(proxy.getRoute().id, "sse-test-route");
  },
});

// ============================================================================
// getConfig()
// ============================================================================

Deno.test({
  name: "SSEProxy - getConfig() returns config with defaults",
  fn() {
    const proxy = new SSEProxy(createTestRoute());
    const config = proxy.getConfig();
    assertExists(config);
  },
});

Deno.test({
  name: "SSEProxy - getConfig() reflects custom keepAliveInterval",
  fn() {
    const proxy = new SSEProxy(createTestRoute(), { keepAliveInterval: 15000 });
    assertEquals(proxy.getConfig().keepAliveInterval, 15000);
  },
});

// ============================================================================
// getActiveConnections()
// ============================================================================

Deno.test({
  name: "SSEProxy - getActiveConnections() starts at 0",
  fn() {
    const proxy = new SSEProxy(createTestRoute());
    assertEquals(proxy.getActiveConnections(), 0);
  },
});

// ============================================================================
// getStats()
// ============================================================================

Deno.test({
  name: "SSEProxy - getStats() returns all-zero counts initially",
  fn() {
    const proxy = new SSEProxy(createTestRoute());
    const stats = proxy.getStats();
    assertExists(stats);
    assert(typeof stats.totalConnections === "number");
    assertEquals(stats.totalConnections, 0);
    assertEquals(stats.activeConnections, 0);
  },
});

// ============================================================================
// getLoadBalancer()
// ============================================================================

Deno.test({
  name: "SSEProxy - getLoadBalancer() returns a load balancer instance",
  fn() {
    const proxy = new SSEProxy(createTestRoute());
    assertExists(proxy.getLoadBalancer());
  },
});

// ============================================================================
// getHealthMonitor()
// ============================================================================

Deno.test({
  name: "SSEProxy - getHealthMonitor() returns undefined when no health check configured",
  fn() {
    const proxy = new SSEProxy(createTestRoute());
    assertEquals(proxy.getHealthMonitor(), undefined);
  },
});

// ============================================================================
// getConnectionManager()
// ============================================================================

Deno.test({
  name: "SSEProxy - getConnectionManager() returns connection manager",
  fn() {
    const proxy = new SSEProxy(createTestRoute());
    assertExists(proxy.getConnectionManager());
  },
});

// ============================================================================
// Resource Leak Prevention - connectToUpstream closes client on failure
// ============================================================================

Deno.test({
  name: "SSEProxy - handleRequest rejects gracefully on connection failure without leaking",
  async fn() {
    const route = createTestRoute();
    // Use an unreachable host to force connection failure
    route.upstream.servers[0].host = "192.0.2.1"; // RFC 5737 TEST-NET, guaranteed unreachable
    route.upstream.servers[0].port = 1;
    const proxy = new SSEProxy(route, {
      maxRetries: 1,
      timeout: 100,
      retryDelay: 10,
    });

    const request = {
      method: "GET" as const,
      uri: "/events/test",
      version: "1.1" as const,
      headers: { accept: "text/event-stream" },
    };

    const context = {
      clientIP: "127.0.0.1",
      startTime: Date.now(),
      requestId: "test-leak-1",
    };

    // Should not throw unhandled errors — the client should be cleaned up internally
    try {
      await proxy.handleRequest(request, context);
    } catch {
      // Expected to fail — we're verifying no resource leak, not success
    }

    // If we reach here without hanging or crashing, client was properly closed
    const stats = proxy.getStats();
    assertExists(stats);
  },
});

Deno.test({
  name: "SSEProxy - connection errors tracked on upstream failure without resource leaks",
  async fn() {
    const route = createTestRoute();
    route.upstream.servers[0].host = "192.0.2.1";
    route.upstream.servers[0].port = 1;
    const proxy = new SSEProxy(route, {
      maxRetries: 1,
      timeout: 100,
      retryDelay: 10,
    });

    const request = {
      method: "GET" as const,
      uri: "/events/test",
      version: "1.1" as const,
      headers: { accept: "text/event-stream" },
    };

    const context = {
      clientIP: "127.0.0.1",
      startTime: Date.now(),
      requestId: "test-leak-2",
    };

    const response = await proxy.handleRequest(request, context);

    // Should return 502 error response, not hang or leak
    assertEquals(response.statusCode, 502);
    const stats = proxy.getStats();
    assert(stats.connectionErrors >= 1, "Should track connection errors");
  },
});

// ============================================================================
// Per-connection lastEventId isolation
// ============================================================================

Deno.test({
  name: "SSEProxy - getLastEventId() returns undefined with no connectionId",
  fn() {
    const proxy = new SSEProxy(createTestRoute());
    assertEquals(proxy.getLastEventId(), undefined);
  },
});

Deno.test({
  name: "SSEProxy - getLastEventId() returns undefined for unknown connectionId",
  fn() {
    const proxy = new SSEProxy(createTestRoute());
    assertEquals(proxy.getLastEventId("unknown-conn"), undefined);
  },
});

Deno.test({
  name: "SSEProxy - getLastEventIds() returns empty map initially",
  fn() {
    const proxy = new SSEProxy(createTestRoute());
    const ids = proxy.getLastEventIds();
    assertEquals(ids.size, 0);
  },
});

Deno.test({
  name: "SSEProxy - getLastEventIds() returns a copy, not the internal map",
  fn() {
    const proxy = new SSEProxy(createTestRoute());
    const ids1 = proxy.getLastEventIds();
    const ids2 = proxy.getLastEventIds();
    assert(ids1 !== ids2, "Should return a new Map each time");
  },
});

Deno.test({
  name: "SSEProxy - concurrent connections do not share lastEventId (per-connection isolation)",
  async fn() {
    // Two concurrent handleRequest calls should get separate connection IDs
    // and not overwrite each other's lastEventId.
    // We verify by checking that after both fail (no real server),
    // the lastEventIds map is cleaned up (entries deleted in finally block).
    const route = createTestRoute();
    route.upstream.servers[0].host = "192.0.2.1";
    route.upstream.servers[0].port = 1;
    const proxy = new SSEProxy(route, {
      maxRetries: 1,
      timeout: 50,
      retryDelay: 10,
    });

    // Launch two concurrent requests
    const request1 = {
      method: "GET" as const,
      uri: "/events/stream1",
      version: "1.1" as const,
      headers: { accept: "text/event-stream", "last-event-id": "evt-100" },
    };
    const request2 = {
      method: "GET" as const,
      uri: "/events/stream2",
      version: "1.1" as const,
      headers: { accept: "text/event-stream", "last-event-id": "evt-200" },
    };

    const context1 = { clientIP: "10.0.0.1", clientPort: 5001, protocol: "http", startTime: Date.now() };
    const context2 = { clientIP: "10.0.0.2", clientPort: 5002, protocol: "http", startTime: Date.now() };

    // Both should complete (with errors) without corrupting each other's state
    const [resp1, resp2] = await Promise.all([
      proxy.handleRequest(request1, context1),
      proxy.handleRequest(request2, context2),
    ]);

    // Both got error responses
    assertEquals(resp1.statusCode, 502);
    assertEquals(resp2.statusCode, 502);

    // After connections close, entries should be cleaned up
    const ids = proxy.getLastEventIds();
    assertEquals(ids.size, 0, "All connection entries should be cleaned up after close");
  },
});
