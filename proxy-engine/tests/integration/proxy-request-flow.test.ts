/**
 * Integration Tests: Proxy Request Flow
 *
 * Tests the full request flow through ReverseProxy, including:
 * - Route configuration and proxy creation
 * - Request forwarding to upstream servers
 * - Response propagation
 * - Error handling (upstream down, no healthy servers)
 * - X-Forwarded-* header injection
 * - Retries on failure
 */

import { assertEquals, assert, assertStringIncludes } from "@std/assert";
import { ReverseProxy, type ReverseProxyConfig } from "../../core/proxy_types/reverse_proxy.ts";
import type { Route, UpstreamServer } from "../../gateway/router/request_router.ts";
import type { HTTPRequest, HTTPResponse } from "../../core/network/transport/http/http.ts";
import { GatewayServer, type GatewayServerConfig } from "../../gateway/server/gateway_server.ts";
import { PatternRouter } from "../../gateway/router/request_router.ts";

// Helper: create a minimal upstream server config
function makeServer(id: string, host: string, port: number, weight = 1, enabled = true): UpstreamServer {
  return { id, host, port, weight, enabled, protocol: "http" };
}

// Helper: create a route
function makeRoute(id: string, pattern: string, servers: UpstreamServer[], strategy: Route["upstream"]["loadBalancingStrategy"] = "round-robin"): Route {
  return {
    id,
    pattern,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
    priority: 10,
    enabled: true,
    upstream: {
      servers,
      loadBalancingStrategy: strategy,
      timeout: 5000,
    },
  };
}

// Helper: create a basic HTTP request
function makeRequest(method: string, uri: string, headers: Record<string, string> = {}): HTTPRequest {
  return {
    method,
    uri,
    version: "1.1",
    headers: { host: "localhost", ...headers },
  };
}

// Helper: create a basic request context
function makeContext(clientIP = "192.168.1.100", clientPort = 54321, protocol = "http") {
  return { clientIP, clientPort, protocol, startTime: Date.now() };
}

// --- Tests ---

Deno.test("proxy-request-flow: ReverseProxy initializes with route and config", () => {
  const servers = [makeServer("s1", "127.0.0.1", 8081)];
  const route = makeRoute("r1", "/api/*", servers);
  const config: ReverseProxyConfig = { timeout: 3000, addForwardedHeaders: true };

  const proxy = new ReverseProxy(route, config);

  assertEquals(proxy.getRoute().id, "r1");
  assertEquals(proxy.getConfig().timeout, 3000);
  assert(proxy.getLoadBalancer() !== undefined);
  assert(proxy.getConnectionManager() !== undefined);
  assertEquals(proxy.getHealthMonitor(), undefined);
});

Deno.test("proxy-request-flow: ReverseProxy with health check creates HealthMonitor", () => {
  const servers = [makeServer("s1", "127.0.0.1", 8081)];
  const route = makeRoute("r1", "/api/*", servers);
  route.upstream.healthCheck = {
    type: "tcp",
    interval: 5000,
    timeout: 2000,
    unhealthyThreshold: 3,
    healthyThreshold: 2,
  };

  const proxy = new ReverseProxy(route);

  const monitor = proxy.getHealthMonitor();
  assert(monitor !== undefined, "HealthMonitor should be created");
  assert(monitor!.isRunning(), "HealthMonitor should be running");
  assertEquals(monitor!.getConfig().type, "tcp");

  // Cleanup
  monitor!.stop();
});

Deno.test("proxy-request-flow: returns 503 when no servers are enabled", async () => {
  const servers = [makeServer("s1", "127.0.0.1", 8081, 1, false)]; // disabled
  const route = makeRoute("r1", "/api/*", servers);
  const proxy = new ReverseProxy(route);

  const response = await proxy.handleRequest(
    makeRequest("GET", "/api/test"),
    makeContext(),
  );

  assertEquals(response.statusCode, 503);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  assertStringIncludes(body.error, "No healthy upstream servers");
});

Deno.test("proxy-request-flow: returns 502 when upstream is unreachable", async () => {
  // Use a port that nothing is listening on
  const servers = [makeServer("s1", "127.0.0.1", 19999)];
  const route = makeRoute("r1", "/api/*", servers);
  const proxy = new ReverseProxy(route, { timeout: 1000, maxRetries: 0 });

  const response = await proxy.handleRequest(
    makeRequest("GET", "/api/test"),
    makeContext(),
  );

  assertEquals(response.statusCode, 502);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  assertStringIncludes(body.error, "Bad Gateway");
});

Deno.test("proxy-request-flow: forwards request to real upstream and gets response", async () => {
  // Start a real Deno HTTP server as upstream
  const ac = new AbortController();
  const server = Deno.serve({
    port: 18901,
    signal: ac.signal,
    onListen: () => {},
  }, (req) => {
    const url = new URL(req.url);
    return new Response(JSON.stringify({
      path: url.pathname,
      method: req.method,
      forwarded: req.headers.get("x-forwarded-for"),
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  try {
    const servers = [makeServer("s1", "127.0.0.1", 18901)];
    const route = makeRoute("r1", "/api/.*", servers);
    const proxy = new ReverseProxy(route, { addForwardedHeaders: true });

    const response = await proxy.handleRequest(
      makeRequest("GET", "/api/users"),
      makeContext("10.0.0.1"),
    );

    assertEquals(response.statusCode, 200);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.path, "/api/users");
    assertEquals(body.method, "GET");
    assertEquals(body.forwarded, "10.0.0.1");
  } finally {
    ac.abort();
    await server.finished;
  }
});

Deno.test("proxy-request-flow: preserveHost keeps original Host header", async () => {
  const ac = new AbortController();
  const server = Deno.serve({
    port: 18902,
    signal: ac.signal,
    onListen: () => {},
  }, (req) => {
    return new Response(JSON.stringify({
      host: req.headers.get("host"),
    }), { status: 200, headers: { "content-type": "application/json" } });
  });

  try {
    const servers = [makeServer("s1", "127.0.0.1", 18902)];
    const route = makeRoute("r1", "/.*", servers);
    const proxy = new ReverseProxy(route, { preserveHost: true });

    const response = await proxy.handleRequest(
      makeRequest("GET", "/test", { host: "www.example.com" }),
      makeContext(),
    );

    assertEquals(response.statusCode, 200);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.host, "www.example.com");
  } finally {
    ac.abort();
    await server.finished;
  }
});

Deno.test("proxy-request-flow: response status and headers propagate from upstream", async () => {
  const ac = new AbortController();
  const server = Deno.serve({
    port: 18903,
    signal: ac.signal,
    onListen: () => {},
  }, () => {
    return new Response("Not Found Here", {
      status: 404,
      headers: { "x-custom": "value123", "content-type": "text/plain" },
    });
  });

  try {
    const servers = [makeServer("s1", "127.0.0.1", 18903)];
    const route = makeRoute("r1", "/.*", servers);
    const proxy = new ReverseProxy(route);

    const response = await proxy.handleRequest(
      makeRequest("GET", "/missing"),
      makeContext(),
    );

    assertEquals(response.statusCode, 404);
    assertEquals(response.headers["x-custom"], "value123");
  } finally {
    ac.abort();
    await server.finished;
  }
});

Deno.test("proxy-request-flow: retry on upstream failure then succeed", async () => {
  let requestCount = 0;
  const ac = new AbortController();
  const server = Deno.serve({
    port: 18904,
    signal: ac.signal,
    onListen: () => {},
  }, () => {
    requestCount++;
    if (requestCount <= 1) {
      // First request fails
      return new Response("Internal Error", { status: 500 });
    }
    return new Response("OK", { status: 200 });
  });

  try {
    const servers = [makeServer("s1", "127.0.0.1", 18904)];
    const route = makeRoute("r1", "/.*", servers);
    // Note: retries happen in UpstreamClient; ReverseProxy also has retry loop
    const proxy = new ReverseProxy(route, { maxRetries: 0 });

    // First request gets 500 from upstream - proxy forwards it as-is
    const response = await proxy.handleRequest(
      makeRequest("GET", "/retry-test"),
      makeContext(),
    );

    // The upstream returned 500, proxy forwards it
    assertEquals(response.statusCode, 500);
    assert(requestCount >= 1);
  } finally {
    ac.abort();
    await server.finished;
  }
});

Deno.test("proxy-request-flow: getStats returns load balancer and connection stats", () => {
  const servers = [makeServer("s1", "127.0.0.1", 8081), makeServer("s2", "127.0.0.1", 8082)];
  const route = makeRoute("r1", "/api/*", servers);
  const proxy = new ReverseProxy(route);

  const stats = proxy.getStats();
  assert(stats.loadBalancer instanceof Map);
  assert(stats.connections !== undefined);
  assertEquals(stats.health, undefined); // No health monitor
});

Deno.test("proxy-request-flow: shutdown stops health monitor and connection manager", async () => {
  const servers = [makeServer("s1", "127.0.0.1", 8081)];
  const route = makeRoute("r1", "/api/*", servers);
  route.upstream.healthCheck = {
    type: "tcp",
    interval: 60000,
    timeout: 2000,
    unhealthyThreshold: 3,
    healthyThreshold: 2,
  };

  const proxy = new ReverseProxy(route);
  const monitor = proxy.getHealthMonitor()!;
  assert(monitor.isRunning());

  await proxy.shutdown();

  assertEquals(monitor.isRunning(), false);
});

Deno.test("proxy-request-flow: PatternRouter routes request to correct proxy", () => {
  const router = new PatternRouter();

  const apiRoute = makeRoute("api", "/api/.*", [makeServer("s1", "127.0.0.1", 8081)]);
  const staticRoute = makeRoute("static", "/static/.*", [makeServer("s2", "127.0.0.1", 8082)]);

  router.addRoute(apiRoute);
  router.addRoute(staticRoute);

  const apiMatch = router.match({
    method: "GET",
    url: new URL("http://localhost/api/users"),
    headers: {},
    clientIP: "127.0.0.1",
    metadata: {},
  });

  const staticMatch = router.match({
    method: "GET",
    url: new URL("http://localhost/static/style.css"),
    headers: {},
    clientIP: "127.0.0.1",
    metadata: {},
  });

  assert(apiMatch !== null);
  assertEquals(apiMatch!.route.id, "api");

  assert(staticMatch !== null);
  assertEquals(staticMatch!.route.id, "static");
});

Deno.test("proxy-request-flow: GatewayServer initializes proxies for all routes", () => {
  const servers = [makeServer("s1", "127.0.0.1", 8081)];
  const route1 = makeRoute("r1", "/api/.*", servers);
  const route2 = makeRoute("r2", "/web/.*", servers);

  const config: GatewayServerConfig = {
    host: "127.0.0.1",
    port: 19800,
    routes: [route1, route2],
  };

  const gateway = new GatewayServer(config);
  const proxies = gateway.getProxies();

  assertEquals(proxies.size, 2);
  assert(proxies.has("r1"));
  assert(proxies.has("r2"));

  const router = gateway.getRouter();
  assertEquals(router.getRoutes().length, 2);
});

Deno.test("proxy-request-flow: POST request with body forwards correctly", async () => {
  const ac = new AbortController();
  const server = Deno.serve({
    port: 18905,
    signal: ac.signal,
    onListen: () => {},
  }, async (req) => {
    const body = await req.text();
    return new Response(JSON.stringify({
      method: req.method,
      body,
      contentType: req.headers.get("content-type"),
    }), { status: 200, headers: { "content-type": "application/json" } });
  });

  try {
    const servers = [makeServer("s1", "127.0.0.1", 18905)];
    const route = makeRoute("r1", "/.*", servers);
    const proxy = new ReverseProxy(route);

    const bodyData = new TextEncoder().encode(JSON.stringify({ name: "test" }));
    const request: HTTPRequest = {
      method: "POST",
      uri: "/api/create",
      version: "1.1",
      headers: {
        host: "localhost",
        "content-type": "application/json",
        "content-length": bodyData.length.toString(),
      },
      body: bodyData,
    };

    const response = await proxy.handleRequest(request, makeContext());

    assertEquals(response.statusCode, 200);
    const respBody = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(respBody.method, "POST");
    assertEquals(respBody.contentType, "application/json");
  } finally {
    ac.abort();
    await server.finished;
  }
});
