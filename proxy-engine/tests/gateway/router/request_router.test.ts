/**
 * RequestRouter (PatternRouter) Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
  PatternRouter,
  RequestRouter,
  createRoute,
  type IncomingRequest,
  type UpstreamConfig,
} from "../../../gateway/router/request_router.ts";

// ============================================================================
// Helpers
// ============================================================================

function makeUpstream(): UpstreamConfig {
  return {
    servers: [{ id: "s1", host: "localhost", port: 8080, weight: 1, enabled: true }],
    loadBalancingStrategy: "round-robin",
    timeout: 5000,
  };
}

function makeRequest(method: string, pathname: string, host = "example.com"): IncomingRequest {
  return {
    method: method as "GET" | "POST" | "PUT" | "DELETE",
    url: new URL(`http://${host}${pathname}`),
    headers: { host },
    clientIP: "127.0.0.1",
    metadata: {},
  };
}

// ============================================================================
// createRoute()
// ============================================================================

Deno.test({
  name: "createRoute - creates route with all required fields",
  fn() {
    const route = createRoute({ id: "r1", pattern: "/api", upstream: makeUpstream() });
    assertExists(route);
    assertEquals(route.id, "r1");
    assertEquals(route.pattern, "/api");
    assertEquals(route.enabled, true);
    assertEquals(route.priority, 0);
  },
});

Deno.test({
  name: "createRoute - includes GET and POST in default methods",
  fn() {
    const route = createRoute({ id: "r1", pattern: "/api", upstream: makeUpstream() });
    assert(route.methods.includes("GET"));
    assert(route.methods.includes("POST"));
  },
});

Deno.test({
  name: "createRoute - custom priority is applied",
  fn() {
    const route = createRoute({ id: "r1", pattern: "/", upstream: makeUpstream(), priority: 100 });
    assertEquals(route.priority, 100);
  },
});

Deno.test({
  name: "createRoute - enabled can be set to false",
  fn() {
    const route = createRoute({ id: "r1", pattern: "/", upstream: makeUpstream(), enabled: false });
    assertEquals(route.enabled, false);
  },
});

// ============================================================================
// Construction
// ============================================================================

Deno.test({
  name: "PatternRouter - constructs with empty route list",
  fn() {
    const router = new PatternRouter();
    assertExists(router);
    assertEquals(router.getRoutes().length, 0);
  },
});

Deno.test({
  name: "RequestRouter - alias exported and constructable",
  fn() {
    const router = new RequestRouter();
    assertExists(router);
    assertEquals(router.getRoutes().length, 0);
  },
});

// ============================================================================
// addRoute() / getRoutes()
// ============================================================================

Deno.test({
  name: "PatternRouter - addRoute() adds a route",
  fn() {
    const router = new PatternRouter();
    router.addRoute(createRoute({ id: "r1", pattern: "/api", upstream: makeUpstream() }));
    assertEquals(router.getRoutes().length, 1);
  },
});

Deno.test({
  name: "PatternRouter - addRoute() inserts higher-priority routes before lower",
  fn() {
    const router = new PatternRouter();
    router.addRoute(createRoute({ id: "low", pattern: "/low", upstream: makeUpstream(), priority: 1 }));
    router.addRoute(createRoute({ id: "high", pattern: "/high", upstream: makeUpstream(), priority: 100 }));
    const routes = router.getRoutes();
    assertEquals(routes[0].id, "high");
    assertEquals(routes[1].id, "low");
  },
});

// ============================================================================
// removeRoute()
// ============================================================================

Deno.test({
  name: "PatternRouter - removeRoute() returns true and removes route",
  fn() {
    const router = new PatternRouter();
    router.addRoute(createRoute({ id: "r1", pattern: "/api", upstream: makeUpstream() }));
    const result = router.removeRoute("r1");
    assert(result === true);
    assertEquals(router.getRoutes().length, 0);
  },
});

Deno.test({
  name: "PatternRouter - removeRoute() returns false for non-existent route",
  fn() {
    const router = new PatternRouter();
    const result = router.removeRoute("non-existent");
    assert(result === false);
  },
});

// ============================================================================
// match() — String patterns
// ============================================================================

Deno.test({
  name: "PatternRouter - match() returns null for empty router",
  fn() {
    const router = new PatternRouter();
    assertEquals(router.match(makeRequest("GET", "/api")), null);
  },
});

Deno.test({
  name: "PatternRouter - match() finds route with exact string pattern",
  fn() {
    const router = new PatternRouter();
    router.addRoute(createRoute({ id: "r1", pattern: "/api", upstream: makeUpstream() }));
    const result = router.match(makeRequest("GET", "/api"));
    assertExists(result);
    assertEquals(result.route.id, "r1");
  },
});

Deno.test({
  name: "PatternRouter - match() extracts :param from string pattern",
  fn() {
    const router = new PatternRouter();
    router.addRoute(createRoute({ id: "r1", pattern: "/users/:id", upstream: makeUpstream() }));
    const result = router.match(makeRequest("GET", "/users/42"));
    assertExists(result);
    assertEquals(result.params["id"], "42");
  },
});

// ============================================================================
// match() — RegExp patterns
// ============================================================================

Deno.test({
  name: "PatternRouter - match() finds route with RegExp pattern",
  fn() {
    const router = new PatternRouter();
    router.addRoute(createRoute({ id: "r1", pattern: /^\/api\/v\d+/, upstream: makeUpstream() }));
    const result = router.match(makeRequest("GET", "/api/v2"));
    assertExists(result);
    assertEquals(result.route.id, "r1");
  },
});

Deno.test({
  name: "PatternRouter - match() returns null for non-matching RegExp",
  fn() {
    const router = new PatternRouter();
    router.addRoute(createRoute({ id: "r1", pattern: /^\/api\/v\d+/, upstream: makeUpstream() }));
    assertEquals(router.match(makeRequest("GET", "/home")), null);
  },
});

// ============================================================================
// match() — Method filtering
// ============================================================================

Deno.test({
  name: "PatternRouter - match() skips route when method does not match",
  fn() {
    const router = new PatternRouter();
    router.addRoute(createRoute({ id: "r1", pattern: "/api", methods: ["POST"], upstream: makeUpstream() }));
    assertEquals(router.match(makeRequest("GET", "/api")), null);
  },
});

// ============================================================================
// match() — Disabled routes skipped
// ============================================================================

Deno.test({
  name: "PatternRouter - match() skips disabled routes",
  fn() {
    const router = new PatternRouter();
    router.addRoute(createRoute({ id: "r1", pattern: "/api", upstream: makeUpstream(), enabled: false }));
    assertEquals(router.match(makeRequest("GET", "/api")), null);
  },
});

// ============================================================================
// clear()
// ============================================================================

Deno.test({
  name: "PatternRouter - clear() removes all routes",
  fn() {
    const router = new PatternRouter();
    router.addRoute(createRoute({ id: "r1", pattern: "/a", upstream: makeUpstream() }));
    router.addRoute(createRoute({ id: "r2", pattern: "/b", upstream: makeUpstream() }));
    router.clear();
    assertEquals(router.getRoutes().length, 0);
  },
});
