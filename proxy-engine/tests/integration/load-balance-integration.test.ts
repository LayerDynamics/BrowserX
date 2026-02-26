/**
 * Integration Tests: Load Balancing
 *
 * Tests load balancing strategies with real component wiring:
 * - Round-robin distribution across upstreams
 * - Weighted round-robin proportional distribution
 * - Health checks removing unhealthy servers
 * - LoadBalancerProxy session affinity and failover
 * - All servers disabled returns error
 * - Stats tracking across selections
 */

import { assertEquals, assert, assertStringIncludes } from "@std/assert";
import { createLoadBalancer } from "../../gateway/router/load_balancer/factory.ts";
import { RoundRobinLoadBalancer } from "../../gateway/router/load_balancer/round_robin.ts";
import { WeightedRoundRobinLoadBalancer } from "../../gateway/router/load_balancer/weighted_round_robin.ts";
import { RandomLoadBalancer } from "../../gateway/router/load_balancer/random.ts";
import type { LoadBalancer } from "../../gateway/router/load_balancer/types.ts";
import type { UpstreamServer, IncomingRequest, Route } from "../../gateway/router/request_router.ts";
import { HealthMonitor } from "../../core/connection/health_check.ts";
import { LoadBalancerProxy } from "../../core/proxy_types/loadbalance_proxy.ts";
import { ReverseProxy } from "../../core/proxy_types/reverse_proxy.ts";

// Helper: make a server
function makeServer(id: string, weight = 1, enabled = true): UpstreamServer {
  return { id, host: "127.0.0.1", port: 8080 + parseInt(id.replace(/\D/g, "") || "0"), weight, enabled };
}

// Helper: make an incoming request
function makeRequest(clientIP = "10.0.0.1"): IncomingRequest {
  return {
    method: "GET",
    url: new URL("http://localhost/api/test"),
    headers: {},
    clientIP,
    metadata: {},
  };
}

// Helper: make a route
function makeRoute(servers: UpstreamServer[], strategy: Route["upstream"]["loadBalancingStrategy"] = "round-robin"): Route {
  return {
    id: "test-route",
    pattern: "/.*",
    methods: ["GET"],
    priority: 10,
    enabled: true,
    upstream: {
      servers,
      loadBalancingStrategy: strategy,
      timeout: 5000,
    },
  };
}

// --- Tests ---

Deno.test("load-balance: round-robin distributes evenly", () => {
  const lb = createLoadBalancer("round-robin") as RoundRobinLoadBalancer;
  const servers = [makeServer("s1"), makeServer("s2"), makeServer("s3")];

  const selections: string[] = [];
  for (let i = 0; i < 9; i++) {
    const server = lb.select(makeRequest(), servers);
    assert(server !== null);
    selections.push(server!.id);
  }

  // Each server should be selected exactly 3 times
  assertEquals(selections.filter((s) => s === "s1").length, 3);
  assertEquals(selections.filter((s) => s === "s2").length, 3);
  assertEquals(selections.filter((s) => s === "s3").length, 3);
});

Deno.test("load-balance: round-robin skips disabled servers", () => {
  const lb = createLoadBalancer("round-robin");
  const servers = [
    makeServer("s1", 1, true),
    makeServer("s2", 1, false), // disabled
    makeServer("s3", 1, true),
  ];

  const selections: string[] = [];
  for (let i = 0; i < 4; i++) {
    const server = lb.select(makeRequest(), servers);
    assert(server !== null);
    selections.push(server!.id);
  }

  // Should only select s1 and s3
  assert(!selections.includes("s2"));
  assertEquals(selections.filter((s) => s === "s1").length, 2);
  assertEquals(selections.filter((s) => s === "s3").length, 2);
});

Deno.test("load-balance: returns null when no servers are enabled", () => {
  const lb = createLoadBalancer("round-robin");
  const servers = [
    makeServer("s1", 1, false),
    makeServer("s2", 1, false),
  ];

  const server = lb.select(makeRequest(), servers);
  assertEquals(server, null);
});

Deno.test("load-balance: weighted round-robin respects weights", () => {
  const lb = createLoadBalancer("weighted-round-robin") as WeightedRoundRobinLoadBalancer;
  const servers = [
    makeServer("s1", 3, true),  // weight 3
    makeServer("s2", 1, true),  // weight 1
  ];

  const counts: Record<string, number> = { s1: 0, s2: 0 };
  for (let i = 0; i < 40; i++) {
    const server = lb.select(makeRequest(), servers);
    assert(server !== null);
    counts[server!.id]++;
  }

  // s1 should get roughly 3x as many as s2
  assert(counts["s1"] > counts["s2"], `s1(${counts["s1"]}) should get more than s2(${counts["s2"]})`);
  // Ratio should be approximately 3:1
  const ratio = counts["s1"] / counts["s2"];
  assert(ratio >= 2 && ratio <= 4, `Ratio should be ~3, got ${ratio.toFixed(1)}`);
});

Deno.test("load-balance: random selects from enabled servers", () => {
  const lb = createLoadBalancer("random") as RandomLoadBalancer;
  const servers = [makeServer("s1"), makeServer("s2"), makeServer("s3")];

  const selectedIds = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const server = lb.select(makeRequest(), servers);
    assert(server !== null);
    selectedIds.add(server!.id);
  }

  // With 100 iterations, all 3 should be selected at least once
  assertEquals(selectedIds.size, 3);
});

Deno.test("load-balance: factory creates correct strategy types", () => {
  const rr = createLoadBalancer("round-robin");
  assert(rr instanceof RoundRobinLoadBalancer);

  const wrr = createLoadBalancer("weighted-round-robin");
  assert(wrr instanceof WeightedRoundRobinLoadBalancer);

  const random = createLoadBalancer("random");
  assert(random instanceof RandomLoadBalancer);
});

Deno.test("load-balance: stats track success and failure", () => {
  const lb = createLoadBalancer("round-robin");
  const servers = [makeServer("s1"), makeServer("s2")];

  // Select s1
  lb.select(makeRequest(), servers);
  lb.recordSuccess("s1", 50);
  lb.recordSuccess("s1", 100);
  lb.recordFailure("s1");

  const stats = lb.getServerStats("s1");
  assertEquals(stats.totalRequests, 3);
  assertEquals(stats.successfulRequests, 2);
  assertEquals(stats.failedRequests, 1);
  assert(stats.averageResponseTime > 0);
});

Deno.test("load-balance: HealthMonitor tracks server health state", () => {
  const monitor = new HealthMonitor({
    type: "tcp",
    interval: 60000,
    timeout: 2000,
    unhealthyThreshold: 3,
    healthyThreshold: 2,
  });

  const servers = [makeServer("s1"), makeServer("s2")];

  // Start creates initial state (assumes healthy)
  monitor.start(servers);
  assert(monitor.isRunning());

  // Initially all healthy
  assert(monitor.isHealthy("s1"));
  assert(monitor.isHealthy("s2"));

  const healthy = monitor.getHealthyServers(servers);
  assertEquals(healthy.length, 2);

  const stats = monitor.getStats();
  assertEquals(stats.totalServers, 2);
  assertEquals(stats.healthyServers, 2);

  monitor.stop();
  assertEquals(monitor.isRunning(), false);
});

Deno.test("load-balance: ReverseProxy returns 503 when all servers disabled", async () => {
  const servers = [makeServer("s1", 1, false), makeServer("s2", 1, false)];
  const route = makeRoute(servers);
  const proxy = new ReverseProxy(route);

  const response = await proxy.handleRequest(
    { method: "GET", uri: "/test", version: "1.1", headers: { host: "localhost" } },
    { clientIP: "10.0.0.1", clientPort: 12345, protocol: "http", startTime: Date.now() },
  );

  assertEquals(response.statusCode, 503);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  assertStringIncludes(body.error, "No healthy upstream servers");
});

Deno.test("load-balance: LoadBalancerProxy initializes with session affinity config", { sanitizeOps: false, sanitizeResources: false }, () => {
  const servers = [makeServer("s1"), makeServer("s2")];
  const route = makeRoute(servers);
  const proxy = new LoadBalancerProxy(route, {
    sessionAffinity: {
      enabled: true,
      cookieName: "MYSESSION",
      cookieMaxAge: 7200,
    },
    failover: {
      enabled: true,
      maxFailures: 5,
      failureWindow: 30000,
      cooldownPeriod: 15000,
    },
  });

  const config = proxy.getLBConfig();
  assertEquals(config.sessionAffinity?.enabled, true);
  assertEquals(config.sessionAffinity?.cookieName, "MYSESSION");
  assertEquals(config.failover?.enabled, true);
  assertEquals(config.failover?.maxFailures, 5);

  // Session map starts empty
  assertEquals(proxy.getSessionMap().size, 0);

  proxy.shutdown();
});

Deno.test("load-balance: LoadBalancerProxy stats include session and failover info", { sanitizeOps: false, sanitizeResources: false }, () => {
  const servers = [makeServer("s1"), makeServer("s2")];
  const route = makeRoute(servers);
  const proxy = new LoadBalancerProxy(route, {
    sessionAffinity: { enabled: true },
    failover: { enabled: true },
  });

  const stats = proxy.getLoadBalancerStats();
  assert("sessions" in stats);
  assert("failover" in stats);
  assertEquals(stats.sessions.total, 0);
  assertEquals(stats.failover.downServers.length, 0);

  proxy.shutdown();
});

Deno.test("load-balance: LoadBalancerProxy shutdown clears state", { sanitizeOps: false, sanitizeResources: false }, async () => {
  const servers = [makeServer("s1")];
  const route = makeRoute(servers);
  const proxy = new LoadBalancerProxy(route, {
    sessionAffinity: { enabled: true },
  });

  await proxy.shutdown();

  assertEquals(proxy.getSessionMap().size, 0);
  assertEquals(proxy.getFailureState().size, 0);
});

Deno.test("load-balance: round-robin with real upstream server", async () => {
  // Start two upstream servers
  const ac1 = new AbortController();
  const ac2 = new AbortController();
  const server1 = Deno.serve({ port: 18911, signal: ac1.signal, onListen: () => {} }, () =>
    new Response(JSON.stringify({ server: "s1" }), { status: 200, headers: { "content-type": "application/json" } }),
  );
  const server2 = Deno.serve({ port: 18912, signal: ac2.signal, onListen: () => {} }, () =>
    new Response(JSON.stringify({ server: "s2" }), { status: 200, headers: { "content-type": "application/json" } }),
  );

  try {
    const servers = [
      { id: "s1", host: "127.0.0.1", port: 18911, weight: 1, enabled: true, protocol: "http" as const },
      { id: "s2", host: "127.0.0.1", port: 18912, weight: 1, enabled: true, protocol: "http" as const },
    ];
    const route = makeRoute(servers, "round-robin");
    const proxy = new ReverseProxy(route);

    const results: string[] = [];
    for (let i = 0; i < 4; i++) {
      const response = await proxy.handleRequest(
        { method: "GET", uri: "/api/test", version: "1.1", headers: { host: "localhost" } },
        { clientIP: "10.0.0.1", clientPort: 12345, protocol: "http", startTime: Date.now() },
      );
      assertEquals(response.statusCode, 200);
      const body = JSON.parse(new TextDecoder().decode(response.body));
      results.push(body.server);
    }

    // Should alternate between s1 and s2
    assert(results.includes("s1"), "Should hit server 1");
    assert(results.includes("s2"), "Should hit server 2");

    await proxy.shutdown();
  } finally {
    ac1.abort();
    ac2.abort();
    await server1.finished;
    await server2.finished;
  }
});

Deno.test("load-balance: selectServer alternative signature works", () => {
  const lb = createLoadBalancer("round-robin");
  const servers = [makeServer("s1"), makeServer("s2")];

  const server = lb.selectServer(servers, undefined, "10.0.0.1");
  assert(server !== null);
  assert(["s1", "s2"].includes(server!.id));
});

Deno.test("load-balance: reset clears all stats", () => {
  const lb = createLoadBalancer("round-robin");
  const servers = [makeServer("s1")];

  lb.select(makeRequest(), servers);
  lb.recordSuccess("s1", 100);

  let stats = lb.getAllStats();
  assert(stats.size > 0);

  lb.reset();
  stats = lb.getAllStats();
  assertEquals(stats.size, 0);
});
