/**
 * TLSProxy Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { TLSProxy } from "../../../core/proxy_types/tls_proxy.ts";
import type { Route } from "../../../gateway/router/request_router.ts";

function createTestRoute(): Route {
  return {
    id: "tls-test-route",
    pattern: "/secure/*",
    methods: ["GET", "POST"],
    priority: 1,
    enabled: true,
    upstream: {
      servers: [
        { id: "server-1", host: "localhost", port: 8443, protocol: "https", weight: 1, enabled: true },
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
  name: "TLSProxy - constructs with route",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    assertExists(proxy);
  },
});

Deno.test({
  name: "TLSProxy - constructs with route and config",
  fn() {
    const proxy = new TLSProxy(createTestRoute(), { mode: "passthrough" });
    assertExists(proxy);
  },
});

// ============================================================================
// getRoute()
// ============================================================================

Deno.test({
  name: "TLSProxy - getRoute() returns the route",
  fn() {
    const route = createTestRoute();
    const proxy = new TLSProxy(route);
    assertEquals(proxy.getRoute().id, "tls-test-route");
  },
});

// ============================================================================
// getTLSMode()
// ============================================================================

Deno.test({
  name: "TLSProxy - getTLSMode() defaults to 'termination'",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    assertEquals(proxy.getTLSMode(), "termination");
  },
});

Deno.test({
  name: "TLSProxy - getTLSMode() returns 'passthrough' when configured",
  fn() {
    const proxy = new TLSProxy(createTestRoute(), { mode: "passthrough" });
    assertEquals(proxy.getTLSMode(), "passthrough");
  },
});

Deno.test({
  name: "TLSProxy - getTLSMode() returns 're-encryption' when configured",
  fn() {
    const proxy = new TLSProxy(createTestRoute(), { mode: "re-encryption" });
    assertEquals(proxy.getTLSMode(), "re-encryption");
  },
});

// ============================================================================
// getConfig()
// ============================================================================

Deno.test({
  name: "TLSProxy - getConfig() returns config",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    const config = proxy.getConfig();
    assertExists(config);
  },
});

// ============================================================================
// getStats()
// ============================================================================

Deno.test({
  name: "TLSProxy - getStats() returns stats object",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    const stats = proxy.getStats();
    assertExists(stats);
    assert(typeof stats === "object");
  },
});

// ============================================================================
// getLoadBalancer()
// ============================================================================

Deno.test({
  name: "TLSProxy - getLoadBalancer() returns a load balancer",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    assertExists(proxy.getLoadBalancer());
  },
});

// ============================================================================
// getHealthMonitor()
// ============================================================================

Deno.test({
  name: "TLSProxy - getHealthMonitor() returns undefined when no health check configured",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    assertEquals(proxy.getHealthMonitor(), undefined);
  },
});

// ============================================================================
// getConnectionManager()
// ============================================================================

Deno.test({
  name: "TLSProxy - getConnectionManager() returns connection manager",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    assertExists(proxy.getConnectionManager());
  },
});
