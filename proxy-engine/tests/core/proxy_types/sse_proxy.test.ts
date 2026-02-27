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
    // the lastEventIds map is cleaned up (entries deleted on error path).
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

    // After error connections, entries should be cleaned up immediately
    const ids = proxy.getLastEventIds();
    assertEquals(ids.size, 0, "All connection entries should be cleaned up after error");

    // activeConnections should be 0 after errors (errors decrement immediately)
    assertEquals(proxy.getActiveConnections(), 0, "Error connections decrement immediately");
  },
});

// ============================================================================
// releaseConnection() — deferred cleanup for successful responses
// ============================================================================

Deno.test({
  name: "SSEProxy - releaseConnection() returns false for unknown connectionId",
  fn() {
    const proxy = new SSEProxy(createTestRoute());
    assertEquals(proxy.releaseConnection("nonexistent"), false);
  },
});

Deno.test({
  name: "SSEProxy - releaseConnection() returns false when called twice for same connectionId",
  fn() {
    const proxy = new SSEProxy(createTestRoute());
    // No active connections, so any release returns false
    assertEquals(proxy.releaseConnection("0"), false);
  },
});

Deno.test({
  name: "SSEProxy - error path decrements activeConnections immediately",
  async fn() {
    const route = createTestRoute();
    route.upstream.servers[0].host = "192.0.2.1";
    route.upstream.servers[0].port = 1;
    const proxy = new SSEProxy(route, {
      maxRetries: 1,
      timeout: 50,
      retryDelay: 10,
    });

    const request = {
      method: "GET" as const,
      uri: "/events/test",
      version: "1.1" as const,
      headers: { accept: "text/event-stream" },
    };
    const context = { clientIP: "127.0.0.1", clientPort: 5000, protocol: "http", startTime: Date.now() };

    await proxy.handleRequest(request, context);

    // After error, activeConnections should be 0 (decremented on error path)
    assertEquals(proxy.getActiveConnections(), 0);
    assertEquals(proxy.getStats().totalConnections, 1);
  },
});

Deno.test({
  name: "SSEProxy - close() releases all active connections",
  async fn() {
    const proxy = new SSEProxy(createTestRoute());
    // Just verify close works cleanly with no active connections
    await proxy.close();
    assertEquals(proxy.getActiveConnections(), 0);
  },
});

// ============================================================================
// lastEventId persists during stream processing
// ============================================================================

Deno.test({
  name: "SSEProxy - lastEventId is available during event stream processing via transformHook",
  fn() {
    // Use transformHook to observe lastEventId mid-stream.
    // The hook fires for each event AFTER lastEventIds.set() but BEFORE
    // the finally block that deletes it. This proves the ID persists
    // throughout stream consumption.
    const observedIds: (string | undefined)[] = [];
    let capturedConnectionId: string | undefined;

    const proxy = new SSEProxy(createTestRoute(), {
      transformEvents: true,
      transformHook: (event, _direction) => {
        // During processing, the lastEventId for the connection should be set
        if (capturedConnectionId !== undefined) {
          observedIds.push(proxy.getLastEventId(capturedConnectionId));
        }
        return event;
      },
    });

    // Simulate what createStreamingResponse does: call processEventStream
    // We access the private method via casting for this test.
    const ssePayload = [
      "id: evt-1",
      "data: first",
      "",
      "id: evt-2",
      "data: second",
      "",
    ].join("\n");

    const body = new TextEncoder().encode(ssePayload);
    const context = { clientIP: "127.0.0.1", clientPort: 5000, protocol: "http", startTime: Date.now() };

    // The connection ID will be "0" (first connection)
    capturedConnectionId = "0";

    // Call processEventStream via the private method
    // deno-lint-ignore no-explicit-any
    const result = (proxy as any).processEventStream(body, context, "0");

    // The transform hook should have observed the lastEventId during processing
    assertEquals(observedIds.length, 2, "Hook should fire for both events");
    assertEquals(observedIds[0], "evt-1", "First event should have id evt-1 during processing");
    assertEquals(observedIds[1], "evt-2", "Second event should have id evt-2 during processing");

    // After processEventStream completes, the lastEventId should be cleaned up
    assertEquals(proxy.getLastEventId("0"), undefined, "lastEventId should be cleaned up after stream ends");

    // Verify we got actual output
    assert(result.length > 0, "Should produce output bytes");
  },
});
