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
