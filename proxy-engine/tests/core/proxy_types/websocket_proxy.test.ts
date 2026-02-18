/**
 * WebSocketProxy Tests
 */

import { assertEquals, assertExists } from "@std/assert";
import { WebSocketProxy } from "../../../core/proxy_types/websocket_proxy.ts";
import type { Route } from "../../../gateway/router/request_router.ts";

function createTestRoute(): Route {
  return {
    id: "test-route",
    pattern: "/ws/*",
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
  name: "WebSocketProxy - constructs with route",
  fn() {
    const proxy = new WebSocketProxy(createTestRoute());
    assertExists(proxy);
  },
});

Deno.test({
  name: "WebSocketProxy - constructs with route and config",
  fn() {
    const proxy = new WebSocketProxy(createTestRoute(), { maxMessageSize: 512 * 1024 });
    assertExists(proxy);
  },
});

// ============================================================================
// getRoute()
// ============================================================================

Deno.test({
  name: "WebSocketProxy - getRoute() returns the route",
  fn() {
    const route = createTestRoute();
    const proxy = new WebSocketProxy(route);
    assertEquals(proxy.getRoute().id, "test-route");
  },
});

// ============================================================================
// getConfig()
// ============================================================================

Deno.test({
  name: "WebSocketProxy - getConfig() returns config with defaults",
  fn() {
    const proxy = new WebSocketProxy(createTestRoute());
    const config = proxy.getConfig();
    assertExists(config);
    assertEquals(config.maxMessageSize, 1024 * 1024); // default 1MB
  },
});

Deno.test({
  name: "WebSocketProxy - getConfig() reflects custom maxMessageSize",
  fn() {
    const proxy = new WebSocketProxy(createTestRoute(), { maxMessageSize: 64 * 1024 });
    assertEquals(proxy.getConfig().maxMessageSize, 64 * 1024);
  },
});

Deno.test({
  name: "WebSocketProxy - getConfig() defaults enableHeartbeat to true",
  fn() {
    const proxy = new WebSocketProxy(createTestRoute());
    assertEquals(proxy.getConfig().enableHeartbeat, true);
  },
});

// ============================================================================
// getActiveConnections()
// ============================================================================

Deno.test({
  name: "WebSocketProxy - getActiveConnections() starts at 0",
  fn() {
    const proxy = new WebSocketProxy(createTestRoute());
    assertEquals(proxy.getActiveConnections(), 0);
  },
});

// ============================================================================
// getStats()
// ============================================================================

Deno.test({
  name: "WebSocketProxy - getStats() returns all-zero counts initially",
  fn() {
    const proxy = new WebSocketProxy(createTestRoute());
    const stats = proxy.getStats();
    assertEquals(stats.totalConnections, 0);
    assertEquals(stats.activeConnections, 0);
    assertEquals(stats.messagesSent, 0);
    assertEquals(stats.messagesReceived, 0);
    assertEquals(stats.bytesSent, 0);
    assertEquals(stats.bytesReceived, 0);
    assertEquals(stats.connectionErrors, 0);
    assertEquals(stats.messageErrors, 0);
  },
});

// ============================================================================
// getLoadBalancer()
// ============================================================================

Deno.test({
  name: "WebSocketProxy - getLoadBalancer() returns a load balancer instance",
  fn() {
    const proxy = new WebSocketProxy(createTestRoute());
    assertExists(proxy.getLoadBalancer());
  },
});

// ============================================================================
// getHealthMonitor()
// ============================================================================

Deno.test({
  name: "WebSocketProxy - getHealthMonitor() returns undefined when no health check configured",
  fn() {
    const proxy = new WebSocketProxy(createTestRoute());
    assertEquals(proxy.getHealthMonitor(), undefined);
  },
});
