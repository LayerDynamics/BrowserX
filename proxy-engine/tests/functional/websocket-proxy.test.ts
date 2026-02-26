/**
 * WebSocket Proxy Functional Tests
 *
 * Tests WebSocket proxy construction, configuration, connection tracking,
 * message forwarding, stats, heartbeat, and transform hook handling.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { WebSocketProxy } from "../../core/proxy_types/websocket_proxy.ts";
import type { WebSocketProxyConfig } from "../../core/proxy_types/websocket_proxy.ts";
import type { Route } from "../../gateway/router/request_router.ts";

function createTestRoute(): Route {
  return {
    id: "ws-func-route",
    pattern: "/ws/*",
    methods: ["GET"],
    priority: 1,
    enabled: true,
    upstream: {
      servers: [
        { id: "ws-1", host: "ws-backend.local", port: 9090, protocol: "http", weight: 1, enabled: true },
      ],
      loadBalancingStrategy: "round-robin",
      timeout: 5000,
    },
  };
}

// ============================================================================
// Construction and config
// ============================================================================

Deno.test("WebSocketProxy - constructs with default config", () => {
  const proxy = new WebSocketProxy(createTestRoute());
  assertExists(proxy);
  const config = proxy.getConfig();
  assertEquals(config.inspectMessages, false);
  assertEquals(config.transformMessages, false);
  assertEquals(config.maxMessageSize, 1024 * 1024);
  assertEquals(config.timeout, 30000);
  assertEquals(config.maxRetries, 3);
  assertEquals(config.retryDelay, 1000);
  assertEquals(config.enableHeartbeat, true);
  assertEquals(config.heartbeatInterval, 30000);
  assertEquals(config.addForwardedHeaders, true);
});

Deno.test("WebSocketProxy - constructs with custom config", () => {
  const wsConfig: WebSocketProxyConfig = {
    inspectMessages: true,
    transformMessages: true,
    maxMessageSize: 512,
    timeout: 5000,
    maxRetries: 1,
    retryDelay: 500,
    enableHeartbeat: false,
    heartbeatInterval: 10000,
    addForwardedHeaders: false,
  };
  const proxy = new WebSocketProxy(createTestRoute(), wsConfig);
  const config = proxy.getConfig();

  assertEquals(config.inspectMessages, true);
  assertEquals(config.transformMessages, true);
  assertEquals(config.maxMessageSize, 512);
  assertEquals(config.enableHeartbeat, false);
  assertEquals(config.heartbeatInterval, 10000);
  assertEquals(config.addForwardedHeaders, false);
});

// ============================================================================
// Connection tracking (stats-based)
// ============================================================================

Deno.test("WebSocketProxy - initial active connections is zero", () => {
  const proxy = new WebSocketProxy(createTestRoute());
  assertEquals(proxy.getActiveConnections(), 0);
});

Deno.test("WebSocketProxy - initial stats are all zero", () => {
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
});

// ============================================================================
// Message forwarding config
// ============================================================================

Deno.test("WebSocketProxy - message inspection disabled by default", () => {
  const proxy = new WebSocketProxy(createTestRoute());
  assertEquals(proxy.getConfig().inspectMessages, false);
});

Deno.test("WebSocketProxy - message transformation disabled by default", () => {
  const proxy = new WebSocketProxy(createTestRoute());
  assertEquals(proxy.getConfig().transformMessages, false);
});

// ============================================================================
// Connection stats (snapshot immutability)
// ============================================================================

Deno.test("WebSocketProxy - getStats returns a copy", () => {
  const proxy = new WebSocketProxy(createTestRoute());
  const s1 = proxy.getStats();
  const s2 = proxy.getStats();
  assert(s1 !== s2, "getStats should return a new object each call");
  assertEquals(s1.totalConnections, s2.totalConnections);
});

// ============================================================================
// Max message size limit
// ============================================================================

Deno.test("WebSocketProxy - default max message size is 1MB", () => {
  const proxy = new WebSocketProxy(createTestRoute());
  assertEquals(proxy.getConfig().maxMessageSize, 1024 * 1024);
});

Deno.test("WebSocketProxy - custom max message size", () => {
  const proxy = new WebSocketProxy(createTestRoute(), { maxMessageSize: 256 });
  assertEquals(proxy.getConfig().maxMessageSize, 256);
});

// ============================================================================
// Ping/pong handling config
// ============================================================================

Deno.test("WebSocketProxy - heartbeat enabled by default", () => {
  const proxy = new WebSocketProxy(createTestRoute());
  assertEquals(proxy.getConfig().enableHeartbeat, true);
  assertEquals(proxy.getConfig().heartbeatInterval, 30000);
});

Deno.test("WebSocketProxy - heartbeat can be disabled", () => {
  const proxy = new WebSocketProxy(createTestRoute(), { enableHeartbeat: false });
  assertEquals(proxy.getConfig().enableHeartbeat, false);
});

// ============================================================================
// Transform hook
// ============================================================================

Deno.test("WebSocketProxy - transform hook stored when provided", () => {
  const hook = (data: string | ArrayBuffer, _dir: string) => data;
  const proxy = new WebSocketProxy(createTestRoute(), { transformHook: hook });
  assertExists(proxy.getTransformHook());
  assertEquals(proxy.getTransformHook(), hook);
});

Deno.test("WebSocketProxy - no transform hook by default", () => {
  const proxy = new WebSocketProxy(createTestRoute());
  assertEquals(proxy.getTransformHook(), undefined);
});

// ============================================================================
// Route and load balancer accessors
// ============================================================================

Deno.test("WebSocketProxy - exposes route", () => {
  const proxy = new WebSocketProxy(createTestRoute());
  assertEquals(proxy.getRoute().id, "ws-func-route");
});

Deno.test("WebSocketProxy - exposes load balancer", () => {
  const proxy = new WebSocketProxy(createTestRoute());
  assertExists(proxy.getLoadBalancer());
});
