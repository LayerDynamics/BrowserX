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

// ============================================================================
// getStats() initial values
// ============================================================================

Deno.test({
  name: "TLSProxy - getStats() returns all-zero counts initially",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    const stats = proxy.getStats();
    assertEquals(stats.totalConnections, 0);
    assertEquals(stats.tlsTerminations, 0);
    assertEquals(stats.tlsPassthroughs, 0);
    assertEquals(stats.tlsReEncryptions, 0);
    assertEquals(stats.certificateErrors, 0);
    assertEquals(stats.connectionErrors, 0);
  },
});

Deno.test({
  name: "TLSProxy - getStats() returns a copy (mutation does not affect internal stats)",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    const stats = proxy.getStats();
    // Mutate the returned copy
    stats.totalConnections = 9999;
    stats.connectionErrors = 9999;
    // Internal stats must be unchanged
    const stats2 = proxy.getStats();
    assertEquals(stats2.totalConnections, 0);
    assertEquals(stats2.connectionErrors, 0);
  },
});

// ============================================================================
// Configuration defaults
// ============================================================================

Deno.test({
  name: "TLSProxy - default mode is 'termination'",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    assertEquals(proxy.getConfig().mode, "termination");
  },
});

Deno.test({
  name: "TLSProxy - default minTLSVersion is '1.2'",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    assertEquals(proxy.getConfig().minTLSVersion, "1.2");
  },
});

Deno.test({
  name: "TLSProxy - default timeout is 30000",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    assertEquals(proxy.getConfig().timeout, 30000);
  },
});

Deno.test({
  name: "TLSProxy - default maxRetries is 3",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    assertEquals(proxy.getConfig().maxRetries, 3);
  },
});

// ============================================================================
// getConfig() reflects provided values
// ============================================================================

Deno.test({
  name: "TLSProxy - getConfig() reflects custom mode",
  fn() {
    const proxy = new TLSProxy(createTestRoute(), { mode: "re-encryption" });
    assertEquals(proxy.getConfig().mode, "re-encryption");
  },
});

Deno.test({
  name: "TLSProxy - getConfig() reflects custom minTLSVersion",
  fn() {
    const proxy = new TLSProxy(createTestRoute(), { minTLSVersion: "1.3" });
    assertEquals(proxy.getConfig().minTLSVersion, "1.3");
  },
});

Deno.test({
  name: "TLSProxy - getConfig() reflects custom timeout",
  fn() {
    const proxy = new TLSProxy(createTestRoute(), { timeout: 5000 });
    assertEquals(proxy.getConfig().timeout, 5000);
  },
});

Deno.test({
  name: "TLSProxy - getConfig() reflects custom maxRetries",
  fn() {
    const proxy = new TLSProxy(createTestRoute(), { maxRetries: 1 });
    assertEquals(proxy.getConfig().maxRetries, 1);
  },
});

Deno.test({
  name: "TLSProxy - getConfig() returns a copy (mutation does not affect internal config)",
  fn() {
    const proxy = new TLSProxy(createTestRoute(), { timeout: 10000 });
    const config = proxy.getConfig() as Record<string, unknown>;
    config["timeout"] = 99999;
    assertEquals(proxy.getConfig().timeout, 10000);
  },
});

// ============================================================================
// getTLSMode() covers all modes
// ============================================================================

Deno.test({
  name: "TLSProxy - getTLSMode() returns 'termination' after construction",
  fn() {
    const proxy = new TLSProxy(createTestRoute(), { mode: "termination" });
    assertEquals(proxy.getTLSMode(), "termination");
  },
});

// ============================================================================
// handleRequest() — no healthy servers → 503 + connectionErrors increments
// ============================================================================

function createEmptyRoute(): Route {
  return {
    id: "empty-route",
    pattern: "/empty/*",
    methods: ["GET"],
    priority: 1,
    enabled: true,
    upstream: {
      servers: [],
      loadBalancingStrategy: "round-robin",
      timeout: 5000,
    },
  };
}

function createTestRequest(): import("../../../core/network/transport/http/http.ts").HTTPRequest {
  return {
    method: "GET",
    uri: "/test",
    version: "1.1",
    headers: { host: "localhost" },
  };
}

function createTestContext(): { clientIP: string; clientPort: number; protocol: string; startTime: number } {
  return {
    clientIP: "127.0.0.1",
    clientPort: 12345,
    protocol: "https",
    startTime: Date.now(),
  };
}

Deno.test({
  name: "TLSProxy - handleRequest() returns 503 when no servers in route",
  async fn() {
    const proxy = new TLSProxy(createEmptyRoute());
    const response = await proxy.handleRequest(createTestRequest(), createTestContext());
    assertEquals(response.statusCode, 503);
  },
});

Deno.test({
  name: "TLSProxy - handleRequest() increments totalConnections when no servers",
  async fn() {
    const proxy = new TLSProxy(createEmptyRoute());
    await proxy.handleRequest(createTestRequest(), createTestContext());
    assertEquals(proxy.getStats().totalConnections, 1);
  },
});

Deno.test({
  name: "TLSProxy - handleRequest() increments connectionErrors when no servers available",
  async fn() {
    const proxy = new TLSProxy(createEmptyRoute());
    await proxy.handleRequest(createTestRequest(), createTestContext());
    assertEquals(proxy.getStats().connectionErrors, 1);
  },
});

Deno.test({
  name: "TLSProxy - handleRequest() increments totalConnections on every call regardless of mode",
  async fn() {
    const proxy = new TLSProxy(createEmptyRoute());
    await proxy.handleRequest(createTestRequest(), createTestContext());
    await proxy.handleRequest(createTestRequest(), createTestContext());
    await proxy.handleRequest(createTestRequest(), createTestContext());
    assertEquals(proxy.getStats().totalConnections, 3);
  },
});

// ============================================================================
// handleRequest() — connection failure → 502 + connectionErrors increments
// ============================================================================

Deno.test({
  name: "TLSProxy - handleRequest() returns 502 when connection to upstream fails (termination mode)",
  async fn() {
    // Use a port that will refuse connections immediately
    const route: Route = {
      id: "fail-route",
      pattern: "/fail/*",
      methods: ["GET"],
      priority: 1,
      enabled: true,
      upstream: {
        servers: [
          { id: "s1", host: "127.0.0.1", port: 1, protocol: "http", weight: 1, enabled: true },
        ],
        loadBalancingStrategy: "round-robin",
        timeout: 5000,
      },
    };
    const proxy = new TLSProxy(route, { mode: "termination" });
    const response = await proxy.handleRequest(createTestRequest(), createTestContext());
    assertEquals(response.statusCode, 502);
  },
});

Deno.test({
  name: "TLSProxy - handleRequest() increments connectionErrors when connection fails (termination mode)",
  async fn() {
    const route: Route = {
      id: "fail-route-2",
      pattern: "/fail2/*",
      methods: ["GET"],
      priority: 1,
      enabled: true,
      upstream: {
        servers: [
          { id: "s1", host: "127.0.0.1", port: 1, protocol: "http", weight: 1, enabled: true },
        ],
        loadBalancingStrategy: "round-robin",
        timeout: 5000,
      },
    };
    const proxy = new TLSProxy(route, { mode: "termination" });
    await proxy.handleRequest(createTestRequest(), createTestContext());
    assertEquals(proxy.getStats().connectionErrors, 1);
  },
});

Deno.test({
  name: "TLSProxy - handleRequest() returns 502 when connection fails (passthrough mode)",
  async fn() {
    const route: Route = {
      id: "fail-passthrough",
      pattern: "/fp/*",
      methods: ["GET"],
      priority: 1,
      enabled: true,
      upstream: {
        servers: [
          { id: "s1", host: "127.0.0.1", port: 1, protocol: "https", weight: 1, enabled: true },
        ],
        loadBalancingStrategy: "round-robin",
        timeout: 5000,
      },
    };
    const proxy = new TLSProxy(route, { mode: "passthrough" });
    const response = await proxy.handleRequest(createTestRequest(), createTestContext());
    assertEquals(response.statusCode, 502);
  },
});

Deno.test({
  name: "TLSProxy - handleRequest() returns 502 when connection fails (re-encryption mode)",
  async fn() {
    const route: Route = {
      id: "fail-reencrypt",
      pattern: "/fr/*",
      methods: ["GET"],
      priority: 1,
      enabled: true,
      upstream: {
        servers: [
          { id: "s1", host: "127.0.0.1", port: 1, protocol: "https", weight: 1, enabled: true },
        ],
        loadBalancingStrategy: "round-robin",
        timeout: 5000,
      },
    };
    const proxy = new TLSProxy(route, { mode: "re-encryption" });
    const response = await proxy.handleRequest(createTestRequest(), createTestContext());
    assertEquals(response.statusCode, 502);
  },
});

// ============================================================================
// Mode routing — stats counter incremented before network failure
// ============================================================================

Deno.test({
  name: "TLSProxy - tlsTerminations increments on connection error in termination mode",
  async fn() {
    // The stat is incremented inside handleTermination() BEFORE the connect() call,
    // so even a network failure still records the attempt.
    const route: Route = {
      id: "stat-term",
      pattern: "/st/*",
      methods: ["GET"],
      priority: 1,
      enabled: true,
      upstream: {
        servers: [
          { id: "s1", host: "127.0.0.1", port: 1, protocol: "http", weight: 1, enabled: true },
        ],
        loadBalancingStrategy: "round-robin",
        timeout: 5000,
      },
    };
    const proxy = new TLSProxy(route, { mode: "termination" });
    await proxy.handleRequest(createTestRequest(), createTestContext());
    assertEquals(proxy.getStats().tlsTerminations, 1);
  },
});

Deno.test({
  name: "TLSProxy - tlsPassthroughs increments on connection error in passthrough mode",
  async fn() {
    const route: Route = {
      id: "stat-pass",
      pattern: "/sp/*",
      methods: ["GET"],
      priority: 1,
      enabled: true,
      upstream: {
        servers: [
          { id: "s1", host: "127.0.0.1", port: 1, protocol: "https", weight: 1, enabled: true },
        ],
        loadBalancingStrategy: "round-robin",
        timeout: 5000,
      },
    };
    const proxy = new TLSProxy(route, { mode: "passthrough" });
    await proxy.handleRequest(createTestRequest(), createTestContext());
    assertEquals(proxy.getStats().tlsPassthroughs, 1);
  },
});

Deno.test({
  name: "TLSProxy - tlsReEncryptions increments on connection error in re-encryption mode",
  async fn() {
    const route: Route = {
      id: "stat-reenc",
      pattern: "/sr/*",
      methods: ["GET"],
      priority: 1,
      enabled: true,
      upstream: {
        servers: [
          { id: "s1", host: "127.0.0.1", port: 1, protocol: "https", weight: 1, enabled: true },
        ],
        loadBalancingStrategy: "round-robin",
        timeout: 5000,
      },
    };
    const proxy = new TLSProxy(route, { mode: "re-encryption" });
    await proxy.handleRequest(createTestRequest(), createTestContext());
    assertEquals(proxy.getStats().tlsReEncryptions, 1);
  },
});

Deno.test({
  name: "TLSProxy - totalConnections increments in termination mode",
  async fn() {
    const route: Route = {
      id: "total-term",
      pattern: "/tt/*",
      methods: ["GET"],
      priority: 1,
      enabled: true,
      upstream: {
        servers: [
          { id: "s1", host: "127.0.0.1", port: 1, protocol: "http", weight: 1, enabled: true },
        ],
        loadBalancingStrategy: "round-robin",
        timeout: 5000,
      },
    };
    const proxy = new TLSProxy(route, { mode: "termination" });
    await proxy.handleRequest(createTestRequest(), createTestContext());
    await proxy.handleRequest(createTestRequest(), createTestContext());
    assertEquals(proxy.getStats().totalConnections, 2);
  },
});

Deno.test({
  name: "TLSProxy - totalConnections increments in passthrough mode",
  async fn() {
    const route: Route = {
      id: "total-pass",
      pattern: "/tp/*",
      methods: ["GET"],
      priority: 1,
      enabled: true,
      upstream: {
        servers: [
          { id: "s1", host: "127.0.0.1", port: 1, protocol: "https", weight: 1, enabled: true },
        ],
        loadBalancingStrategy: "round-robin",
        timeout: 5000,
      },
    };
    const proxy = new TLSProxy(route, { mode: "passthrough" });
    await proxy.handleRequest(createTestRequest(), createTestContext());
    await proxy.handleRequest(createTestRequest(), createTestContext());
    assertEquals(proxy.getStats().totalConnections, 2);
  },
});

Deno.test({
  name: "TLSProxy - totalConnections increments in re-encryption mode",
  async fn() {
    const route: Route = {
      id: "total-reenc",
      pattern: "/tr/*",
      methods: ["GET"],
      priority: 1,
      enabled: true,
      upstream: {
        servers: [
          { id: "s1", host: "127.0.0.1", port: 1, protocol: "https", weight: 1, enabled: true },
        ],
        loadBalancingStrategy: "round-robin",
        timeout: 5000,
      },
    };
    const proxy = new TLSProxy(route, { mode: "re-encryption" });
    await proxy.handleRequest(createTestRequest(), createTestContext());
    await proxy.handleRequest(createTestRequest(), createTestContext());
    assertEquals(proxy.getStats().totalConnections, 2);
  },
});

// ============================================================================
// Stats independence across multiple proxies
// ============================================================================

Deno.test({
  name: "TLSProxy - stats are independent between proxy instances",
  async fn() {
    const route1: Route = {
      id: "ind-route-1",
      pattern: "/ind1/*",
      methods: ["GET"],
      priority: 1,
      enabled: true,
      upstream: {
        servers: [
          { id: "s1", host: "127.0.0.1", port: 1, protocol: "http", weight: 1, enabled: true },
        ],
        loadBalancingStrategy: "round-robin",
        timeout: 5000,
      },
    };
    const route2: Route = { ...route1, id: "ind-route-2", pattern: "/ind2/*" };

    const proxy1 = new TLSProxy(route1);
    const proxy2 = new TLSProxy(route2);

    await proxy1.handleRequest(createTestRequest(), createTestContext());
    await proxy1.handleRequest(createTestRequest(), createTestContext());
    await proxy2.handleRequest(createTestRequest(), createTestContext());

    assertEquals(proxy1.getStats().totalConnections, 2);
    assertEquals(proxy2.getStats().totalConnections, 1);
  },
});

// ============================================================================
// close()
// ============================================================================

Deno.test({
  name: "TLSProxy - close() resolves without throwing",
  async fn() {
    const proxy = new TLSProxy(createTestRoute());
    await proxy.close();
  },
});

// ============================================================================
// SNI / verifyUpstreamCerts defaults
// ============================================================================

Deno.test({
  name: "TLSProxy - default enableSNI is true",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    assertEquals((proxy.getConfig() as { enableSNI?: boolean }).enableSNI, true);
  },
});

Deno.test({
  name: "TLSProxy - default verifyUpstreamCerts is true",
  fn() {
    const proxy = new TLSProxy(createTestRoute());
    assertEquals((proxy.getConfig() as { verifyUpstreamCerts?: boolean }).verifyUpstreamCerts, true);
  },
});

Deno.test({
  name: "TLSProxy - enableSNI can be disabled",
  fn() {
    const proxy = new TLSProxy(createTestRoute(), { enableSNI: false });
    assertEquals((proxy.getConfig() as { enableSNI?: boolean }).enableSNI, false);
  },
});

Deno.test({
  name: "TLSProxy - verifyUpstreamCerts can be disabled",
  fn() {
    const proxy = new TLSProxy(createTestRoute(), { verifyUpstreamCerts: false });
    assertEquals((proxy.getConfig() as { verifyUpstreamCerts?: boolean }).verifyUpstreamCerts, false);
  },
});
