/**
 * TLS Proxy Functional Tests
 *
 * Tests TLS proxy construction, configuration, mode handling, stats tracking,
 * and resource management across termination, passthrough, and re-encryption modes.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { TLSProxy } from "../../core/proxy_types/tls_proxy.ts";
import type { TLSProxyConfig } from "../../core/proxy_types/tls_proxy.ts";
import type { Route } from "../../gateway/router/request_router.ts";

function createTestRoute(overrides?: Partial<Route>): Route {
  return {
    id: "tls-func-route",
    pattern: "/secure/*",
    methods: ["GET", "POST"],
    priority: 1,
    enabled: true,
    upstream: {
      servers: [
        { id: "s1", host: "backend1.local", port: 8443, protocol: "https", weight: 1, enabled: true },
        { id: "s2", host: "backend2.local", port: 8443, protocol: "https", weight: 1, enabled: true },
      ],
      loadBalancingStrategy: "round-robin",
      timeout: 5000,
    },
    ...overrides,
  };
}

// ============================================================================
// Construction with passthrough mode
// ============================================================================

Deno.test("TLSProxy - constructs in passthrough mode", () => {
  const proxy = new TLSProxy(createTestRoute(), { mode: "passthrough" });
  assertExists(proxy);
  assertEquals(proxy.getTLSMode(), "passthrough");
});

// ============================================================================
// SNI hostname extraction from config
// ============================================================================

Deno.test("TLSProxy - SNI enabled by default", () => {
  const proxy = new TLSProxy(createTestRoute());
  const config = proxy.getConfig();
  assertEquals(config.enableSNI, true);
});

Deno.test("TLSProxy - SNI can be disabled", () => {
  const proxy = new TLSProxy(createTestRoute(), { enableSNI: false });
  const config = proxy.getConfig();
  assertEquals(config.enableSNI, false);
});

// ============================================================================
// Passthrough config forwarding
// ============================================================================

Deno.test("TLSProxy - passthrough config preserves all settings", () => {
  const tlsConfig: TLSProxyConfig = {
    mode: "passthrough",
    enableSNI: true,
    verifyUpstreamCerts: false,
    timeout: 10000,
    maxRetries: 5,
    retryDelay: 2000,
  };
  const proxy = new TLSProxy(createTestRoute(), tlsConfig);
  const config = proxy.getConfig();

  assertEquals(config.mode, "passthrough");
  assertEquals(config.enableSNI, true);
  assertEquals(config.verifyUpstreamCerts, false);
  assertEquals(config.timeout, 10000);
  assertEquals(config.maxRetries, 5);
  assertEquals(config.retryDelay, 2000);
});

// ============================================================================
// TLS version configuration
// ============================================================================

Deno.test("TLSProxy - default min TLS version is 1.2", () => {
  const proxy = new TLSProxy(createTestRoute());
  const config = proxy.getConfig();
  assertEquals(config.minTLSVersion, "1.2");
});

Deno.test("TLSProxy - min TLS version can be set to 1.3", () => {
  const proxy = new TLSProxy(createTestRoute(), { minTLSVersion: "1.3" });
  const config = proxy.getConfig();
  assertEquals(config.minTLSVersion, "1.3");
});

// ============================================================================
// Certificate configuration handling
// ============================================================================

Deno.test("TLSProxy - verifyUpstreamCerts defaults to true", () => {
  const proxy = new TLSProxy(createTestRoute());
  const config = proxy.getConfig();
  assertEquals(config.verifyUpstreamCerts, true);
});

Deno.test("TLSProxy - verifyUpstreamCerts can be disabled for passthrough", () => {
  const proxy = new TLSProxy(createTestRoute(), {
    mode: "passthrough",
    verifyUpstreamCerts: false,
  });
  const config = proxy.getConfig();
  assertEquals(config.verifyUpstreamCerts, false);
});

// ============================================================================
// Connection stats tracking
// ============================================================================

Deno.test("TLSProxy - initial stats are zero", () => {
  const proxy = new TLSProxy(createTestRoute());
  const stats = proxy.getStats();

  assertEquals(stats.totalConnections, 0);
  assertEquals(stats.tlsTerminations, 0);
  assertEquals(stats.tlsPassthroughs, 0);
  assertEquals(stats.tlsReEncryptions, 0);
  assertEquals(stats.certificateErrors, 0);
  assertEquals(stats.connectionErrors, 0);
});

Deno.test("TLSProxy - stats returns a copy (immutable)", () => {
  const proxy = new TLSProxy(createTestRoute());
  const stats1 = proxy.getStats();
  const stats2 = proxy.getStats();
  assert(stats1 !== stats2, "getStats should return a new object each time");
  assertEquals(stats1.totalConnections, stats2.totalConnections);
});

// ============================================================================
// Multiple concurrent connections tracked via route servers
// ============================================================================

Deno.test("TLSProxy - route exposes multiple upstream servers", () => {
  const proxy = new TLSProxy(createTestRoute());
  const route = proxy.getRoute();
  assertEquals(route.upstream.servers.length, 2);
  assertEquals(route.upstream.servers[0].host, "backend1.local");
  assertEquals(route.upstream.servers[1].host, "backend2.local");
});

// ============================================================================
// Mode variations
// ============================================================================

Deno.test("TLSProxy - default mode is termination", () => {
  const proxy = new TLSProxy(createTestRoute());
  assertEquals(proxy.getTLSMode(), "termination");
});

Deno.test("TLSProxy - re-encryption mode", () => {
  const proxy = new TLSProxy(createTestRoute(), { mode: "re-encryption" });
  assertEquals(proxy.getTLSMode(), "re-encryption");
});

// ============================================================================
// Resource accessors
// ============================================================================

Deno.test("TLSProxy - exposes load balancer", () => {
  const proxy = new TLSProxy(createTestRoute());
  assertExists(proxy.getLoadBalancer());
});

Deno.test("TLSProxy - exposes connection manager", () => {
  const proxy = new TLSProxy(createTestRoute());
  assertExists(proxy.getConnectionManager());
});

Deno.test("TLSProxy - no health monitor without health check config", () => {
  const proxy = new TLSProxy(createTestRoute());
  assertEquals(proxy.getHealthMonitor(), undefined);
});
