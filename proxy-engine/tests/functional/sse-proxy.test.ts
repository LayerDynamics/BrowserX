/**
 * SSE Proxy Functional Tests
 *
 * Tests SSE proxy construction, configuration, connection tracking,
 * reconnection config, event filtering, stats, keep-alive, and event ID tracking.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { SSEProxy } from "../../core/proxy_types/sse_proxy.ts";
import type { SSEProxyConfig, SSEEvent } from "../../core/proxy_types/sse_proxy.ts";
import type { Route } from "../../gateway/router/request_router.ts";

function createTestRoute(): Route {
  return {
    id: "sse-func-route",
    pattern: "/events/*",
    methods: ["GET"],
    priority: 1,
    enabled: true,
    upstream: {
      servers: [
        { id: "sse-1", host: "sse-backend.local", port: 8080, protocol: "http", weight: 1, enabled: true },
      ],
      loadBalancingStrategy: "round-robin",
      timeout: 5000,
    },
  };
}

// ============================================================================
// Construction and config
// ============================================================================

Deno.test("SSEProxy - constructs with default config", () => {
  const proxy = new SSEProxy(createTestRoute());
  assertExists(proxy);
  const config = proxy.getConfig();
  assertEquals(config.inspectEvents, false);
  assertEquals(config.transformEvents, false);
  assertEquals(config.maxEventSize, 64 * 1024);
  assertEquals(config.timeout, 300000);
  assertEquals(config.maxRetries, 3);
  assertEquals(config.retryDelay, 1000);
  assertEquals(config.keepAliveInterval, 15000);
  assertEquals(config.addForwardedHeaders, true);
  assertEquals(config.enableReconnection, true);
  assertEquals(config.reconnectionTimeout, 3000);
});

Deno.test("SSEProxy - constructs with custom config", () => {
  const sseConfig: SSEProxyConfig = {
    inspectEvents: true,
    transformEvents: true,
    maxEventSize: 1024,
    timeout: 60000,
    maxRetries: 5,
    retryDelay: 2000,
    keepAliveInterval: 5000,
    addForwardedHeaders: false,
    enableReconnection: false,
    reconnectionTimeout: 1000,
  };
  const proxy = new SSEProxy(createTestRoute(), sseConfig);
  const config = proxy.getConfig();

  assertEquals(config.inspectEvents, true);
  assertEquals(config.transformEvents, true);
  assertEquals(config.maxEventSize, 1024);
  assertEquals(config.timeout, 60000);
  assertEquals(config.keepAliveInterval, 5000);
  assertEquals(config.enableReconnection, false);
  assertEquals(config.reconnectionTimeout, 1000);
});

// ============================================================================
// Event stream connection tracking
// ============================================================================

Deno.test("SSEProxy - initial active connections is zero", () => {
  const proxy = new SSEProxy(createTestRoute());
  assertEquals(proxy.getActiveConnections(), 0);
});

// ============================================================================
// Reconnection config (retry interval)
// ============================================================================

Deno.test("SSEProxy - reconnection enabled by default", () => {
  const proxy = new SSEProxy(createTestRoute());
  const config = proxy.getConfig();
  assertEquals(config.enableReconnection, true);
  assertEquals(config.reconnectionTimeout, 3000);
});

Deno.test("SSEProxy - reconnection can be disabled", () => {
  const proxy = new SSEProxy(createTestRoute(), { enableReconnection: false });
  assertEquals(proxy.getConfig().enableReconnection, false);
});

// ============================================================================
// Event filtering config (inspect/transform)
// ============================================================================

Deno.test("SSEProxy - event inspection disabled by default", () => {
  const proxy = new SSEProxy(createTestRoute());
  assertEquals(proxy.getConfig().inspectEvents, false);
});

Deno.test("SSEProxy - event transformation disabled by default", () => {
  const proxy = new SSEProxy(createTestRoute());
  assertEquals(proxy.getConfig().transformEvents, false);
});

// ============================================================================
// Connection stats
// ============================================================================

Deno.test("SSEProxy - initial stats are all zero", () => {
  const proxy = new SSEProxy(createTestRoute());
  const stats = proxy.getStats();
  assertEquals(stats.totalConnections, 0);
  assertEquals(stats.activeConnections, 0);
  assertEquals(stats.eventsForwarded, 0);
  assertEquals(stats.bytesSent, 0);
  assertEquals(stats.connectionErrors, 0);
  assertEquals(stats.eventErrors, 0);
  assertEquals(stats.reconnections, 0);
});

Deno.test("SSEProxy - getStats returns a copy", () => {
  const proxy = new SSEProxy(createTestRoute());
  const s1 = proxy.getStats();
  const s2 = proxy.getStats();
  assert(s1 !== s2, "getStats should return a new object each call");
});

// ============================================================================
// Keep-alive config
// ============================================================================

Deno.test("SSEProxy - default keep-alive interval is 15s", () => {
  const proxy = new SSEProxy(createTestRoute());
  assertEquals(proxy.getConfig().keepAliveInterval, 15000);
});

Deno.test("SSEProxy - custom keep-alive interval", () => {
  const proxy = new SSEProxy(createTestRoute(), { keepAliveInterval: 60000 });
  assertEquals(proxy.getConfig().keepAliveInterval, 60000);
});

// ============================================================================
// Transform hook / Event ID tracking
// ============================================================================

Deno.test("SSEProxy - transform hook stored when provided", () => {
  const hook = (event: SSEEvent, _dir: string) => event;
  const proxy = new SSEProxy(createTestRoute(), { transformHook: hook });
  assertExists(proxy.getTransformHook());
  assertEquals(proxy.getTransformHook(), hook);
});

Deno.test("SSEProxy - no transform hook by default", () => {
  const proxy = new SSEProxy(createTestRoute());
  assertEquals(proxy.getTransformHook(), undefined);
});

// ============================================================================
// Resource accessors
// ============================================================================

Deno.test("SSEProxy - exposes route", () => {
  const proxy = new SSEProxy(createTestRoute());
  assertEquals(proxy.getRoute().id, "sse-func-route");
});

Deno.test("SSEProxy - exposes load balancer", () => {
  const proxy = new SSEProxy(createTestRoute());
  assertExists(proxy.getLoadBalancer());
});

Deno.test("SSEProxy - exposes connection manager", () => {
  const proxy = new SSEProxy(createTestRoute());
  assertExists(proxy.getConnectionManager());
});

Deno.test("SSEProxy - no health monitor without health check config", () => {
  const proxy = new SSEProxy(createTestRoute());
  assertEquals(proxy.getHealthMonitor(), undefined);
});
