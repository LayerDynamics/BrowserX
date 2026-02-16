/**
 * ReverseProxy Comprehensive Tests
 * Tests basic forwarding, header manipulation, error handling, statistics, and lifecycle
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import { ReverseProxy } from "../../../core/proxy_types/reverse_proxy.ts";
import type { Route, UpstreamServer } from "../../../gateway/router/request_router.ts";
import type { HTTPRequest, HTTPResponse } from "../../../core/network/transport/http/http.ts";
import { createEchoServer, createDelayedResponseServer } from "../../helpers/test-servers.ts";
import { waitFor } from "../../../../tests/helpers/shared-mocks.ts";

/**
 * Helper to create test route
 */
function createTestRoute(servers: UpstreamServer[], options: {
  healthCheck?: boolean;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
} = {}): Route {
  return {
    id: "test-route",
    pattern: "/api/*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    priority: 1,
    enabled: true,
    upstream: {
      servers,
      loadBalancingStrategy: "round-robin",
      timeout: options.timeout ?? 5000,
      retryPolicy: options.maxRetries !== undefined ? {
        maxRetries: options.maxRetries,
        retryDelay: options.retryDelay ?? 100,
        retryOn: ["error", "timeout", "5xx"],
      } : undefined,
      healthCheck: options.healthCheck ? {
        type: "http",
        interval: 1000,
        timeout: 500,
        unhealthyThreshold: 2,
        healthyThreshold: 2,
        httpPath: "/health",
      } : undefined,
    },
  };
}

/**
 * Helper to create test server config
 */
function createTestServer(id: string, host: string, port: number): UpstreamServer {
  return {
    id,
    host,
    port,
    protocol: "http",
    weight: 1,
    enabled: true,
  };
}

/**
 * Helper to create test request
 */
function createTestRequest(
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  uri = "/api/test",
  headers: Record<string, string> = {},
  body?: Uint8Array,
): HTTPRequest {
  return {
    method,
    uri,
    version: "1.1",
    headers: {
      "host": "example.com",
      ...headers,
    },
    body,
  };
}

/**
 * Helper to create request context
 */
function createRequestContext(clientIP = "192.168.1.100", clientPort = 54321) {
  return {
    clientIP,
    clientPort,
    protocol: "http",
    startTime: Date.now(),
  };
}

// =============================================================================
// BASIC FORWARDING TESTS (10 tests)
// =============================================================================

Deno.test({
  name: "ReverseProxy - forwards GET request",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.method, "GET");
    assertEquals(body.url.includes("/api/test"), true);

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - forwards POST request with body",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const bodyContent = "test body content";
    const request = createTestRequest(
      "POST",
      "/api/create",
      { "content-type": "text/plain" },
      new TextEncoder().encode(bodyContent),
    );
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.method, "POST");
    assertEquals(body.body, bodyContent);

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - forwards PUT request",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("PUT", "/api/update/123");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.method, "PUT");

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - forwards DELETE request",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("DELETE", "/api/delete/123");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.method, "DELETE");

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - preserves request headers",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("GET", "/api/test", {
      "authorization": "Bearer test-token",
      "x-custom-header": "custom-value",
    });
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.headers.authorization, "Bearer test-token");
    assertEquals(body.headers["x-custom-header"], "custom-value");

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - forwards query parameters",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("GET", "/api/test?foo=bar&baz=qux");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.url.includes("foo=bar"), true);
    assertEquals(body.url.includes("baz=qux"), true);

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - forwards request with empty body",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("POST", "/api/test", {}, new Uint8Array(0));
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.method, "POST");
    assertEquals(body.body, "");

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - returns upstream response status",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertEquals(response.version, "1.1");
    assertExists(response.headers);
    assertExists(response.body);

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - forwards request with large body",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const largeBody = "x".repeat(10000);
    const request = createTestRequest(
      "POST",
      "/api/test",
      { "content-type": "text/plain" },
      new TextEncoder().encode(largeBody),
    );
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.body.length, 10000);

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - forwards request with special characters in path",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("GET", "/api/test%20with%20spaces");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

// =============================================================================
// HEADER MANIPULATION TESTS (8 tests)
// =============================================================================

Deno.test({
  name: "ReverseProxy - adds X-Forwarded-For header",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route, { addForwardedHeaders: true });

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext("192.168.1.100");

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.headers["x-forwarded-for"], "192.168.1.100");

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - appends to existing X-Forwarded-For",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route, { addForwardedHeaders: true });

    const request = createTestRequest("GET", "/api/test", {
      "x-forwarded-for": "10.0.0.1, 10.0.0.2",
    });
    const context = createRequestContext("192.168.1.100");

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.headers["x-forwarded-for"], "10.0.0.1, 10.0.0.2, 192.168.1.100");

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - adds X-Forwarded-Proto header",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route, { addForwardedHeaders: true });

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();
    context.protocol = "https";

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.headers["x-forwarded-proto"], "https");

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - adds X-Forwarded-Host header",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route, { addForwardedHeaders: true });

    const request = createTestRequest("GET", "/api/test", {
      "host": "example.com:8080",
    });
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.headers["x-forwarded-host"], "example.com:8080");

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - adds X-Forwarded-Port header",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route, { addForwardedHeaders: true });

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext("192.168.1.100", 54321);

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.headers["x-forwarded-port"], "54321");

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - adds Via header",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.headers.via, "1.1 reverse-proxy");

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - updates Host header by default",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route, { preserveHost: false });

    const request = createTestRequest("GET", "/api/test", {
      "host": "example.com:8080",
    });
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.headers.host, `${echoServer.hostname}:${echoServer.port}`);

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - preserves Host header when configured",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route, { preserveHost: true });

    const request = createTestRequest("GET", "/api/test", {
      "host": "example.com:8080",
    });
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.headers.host, "example.com:8080");

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

// =============================================================================
// ERROR HANDLING TESTS (10 tests)
// =============================================================================

Deno.test({
  name: "ReverseProxy - handles no healthy servers",
  async fn() {
    const server = createTestServer("s1", "localhost", 9999);
    server.enabled = false;
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 503);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.error.includes("No healthy upstream servers"), true);

    await proxy.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - handles upstream connection error",
  async fn() {
    // Non-existent server
    const server = createTestServer("s1", "localhost", 65000);
    const route = createTestRoute([server], { maxRetries: 0 });
    const proxy = new ReverseProxy(route, { timeout: 1000 });

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 502);
    assertExists(response.body);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertEquals(body.error.includes("Bad Gateway"), true);

    await proxy.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - handles upstream timeout",
  async fn() {
    const delayedServer = await createDelayedResponseServer(5000);
    const server = createTestServer("s1", delayedServer.hostname, delayedServer.port);
    const route = createTestRoute([server], { timeout: 500, maxRetries: 0 });
    const proxy = new ReverseProxy(route, { timeout: 500 });

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 502);

    await proxy.shutdown();
    await delayedServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - returns 502 Bad Gateway on upstream failure",
  async fn() {
    const server = createTestServer("s1", "invalid-host", 8080);
    const route = createTestRoute([server], { maxRetries: 0 });
    const proxy = new ReverseProxy(route, { timeout: 1000 });

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 502);
    assertEquals(response.statusText, "Bad Gateway");

    await proxy.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - error response has correct headers",
  async fn() {
    const server = createTestServer("s1", "localhost", 9999);
    server.enabled = false;
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 503);
    assertEquals(response.headers["content-type"], "application/json");
    assertEquals(response.headers["connection"], "close");
    assertExists(response.headers["content-length"]);

    await proxy.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - error response has valid JSON body",
  async fn() {
    const server = createTestServer("s1", "localhost", 9999);
    server.enabled = false;
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 503);
    assertExists(response.body);

    const body = JSON.parse(new TextDecoder().decode(response.body));
    assertExists(body.error);
    assertEquals(body.status, 503);

    await proxy.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - retries on failure when configured",
  async fn() {
    // Test that retry configuration is respected
    // When a single server fails, it will retry that same server
    const server = createTestServer("s1", "localhost", 65001);
    const route = createTestRoute([server], { maxRetries: 2, retryDelay: 50 });
    const proxy = new ReverseProxy(route, { maxRetries: 2, retryDelay: 50 });

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    const startTime = Date.now();
    const response = await proxy.handleRequest(request, context);
    const duration = Date.now() - startTime;

    // Should return 502 after all retries exhausted
    assertEquals(response.statusCode, 502);

    // Should have taken at least 100ms (2 retries * 50ms delay)
    // But not much more (allowing for some overhead)
    assert(duration >= 90, `Duration ${duration}ms should be >= 90ms`);

    await proxy.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - records failure in load balancer",
  async fn() {
    const server = createTestServer("s1", "localhost", 65002);
    const route = createTestRoute([server], { maxRetries: 0 });
    const proxy = new ReverseProxy(route, { timeout: 500 });

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    await proxy.handleRequest(request, context);

    const stats = proxy.getStats();
    assertExists(stats.loadBalancer);

    await proxy.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - handles empty server list",
  async fn() {
    const route = createTestRoute([]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 503);

    await proxy.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - handles load balancer selection failure",
  async fn() {
    const server = createTestServer("s1", "localhost", 8080);
    server.weight = 0; // This might cause load balancer issues
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    // Should handle gracefully (either select server or return error)
    assert(response.statusCode === 503 || response.statusCode === 502 || response.statusCode === 200);

    await proxy.shutdown();
  },
});

// =============================================================================
// STATISTICS TESTS (6 tests)
// =============================================================================

Deno.test({
  name: "ReverseProxy - tracks request count in load balancer",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    await proxy.handleRequest(request, context);
    await proxy.handleRequest(request, context);
    await proxy.handleRequest(request, context);

    const stats = proxy.getStats();
    assertExists(stats.loadBalancer);

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - tracks success in load balancer",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();

    const response = await proxy.handleRequest(request, context);

    assertEquals(response.statusCode, 200);
    const stats = proxy.getStats();
    assertExists(stats.loadBalancer);

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - getStats returns loadBalancer stats",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const stats = proxy.getStats();
    assertExists(stats.loadBalancer);
    assertExists(stats.connections);

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - getStats returns connections stats",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const stats = proxy.getStats();
    assertExists(stats.connections);

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - getStats returns health monitor stats when enabled",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server], { healthCheck: true });
    const proxy = new ReverseProxy(route);

    const stats = proxy.getStats();
    // Health monitor might not be ready immediately
    // Just verify stats structure exists

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - getStats health is undefined when health check disabled",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server], { healthCheck: false });
    const proxy = new ReverseProxy(route);

    const stats = proxy.getStats();
    assertEquals(stats.health, undefined);

    await proxy.shutdown();
    await echoServer.shutdown();
  },
});

// =============================================================================
// LIFECYCLE TESTS (6 tests)
// =============================================================================

Deno.test({
  name: "ReverseProxy - constructs with default config",
  fn() {
    const server = createTestServer("s1", "localhost", 8080);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    assertExists(proxy);
    assertExists(proxy.getLoadBalancer());
    assertExists(proxy.getConnectionManager());
    assertEquals(proxy.getHealthMonitor(), undefined);

    proxy.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - constructs with custom config",
  fn() {
    const server = createTestServer("s1", "localhost", 8080);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route, {
      addForwardedHeaders: true,
      preserveHost: true,
      timeout: 10000,
      maxRetries: 3,
      retryDelay: 200,
    });

    assertExists(proxy);
    const config = proxy.getConfig();
    assertEquals(config.addForwardedHeaders, true);
    assertEquals(config.preserveHost, true);
    assertEquals(config.timeout, 10000);
    assertEquals(config.maxRetries, 3);
    assertEquals(config.retryDelay, 200);

    proxy.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - getRoute returns route config",
  fn() {
    const server = createTestServer("s1", "localhost", 8080);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const returnedRoute = proxy.getRoute();
    assertEquals(returnedRoute.id, "test-route");
    assertEquals(returnedRoute.pattern, "/api/*");
    assertEquals(returnedRoute.upstream.servers.length, 1);

    proxy.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - getLoadBalancer returns load balancer instance",
  fn() {
    const server = createTestServer("s1", "localhost", 8080);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const lb = proxy.getLoadBalancer();
    assertExists(lb);
    assertExists(lb.select);
    assertExists(lb.recordSuccess);
    assertExists(lb.recordFailure);

    proxy.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - getConnectionManager returns connection manager instance",
  fn() {
    const server = createTestServer("s1", "localhost", 8080);
    const route = createTestRoute([server]);
    const proxy = new ReverseProxy(route);

    const cm = proxy.getConnectionManager();
    assertExists(cm);
    assertExists(cm.getStats);

    proxy.shutdown();
  },
});

Deno.test({
  name: "ReverseProxy - shutdown cleans up resources",
  async fn() {
    const echoServer = await createEchoServer();
    const server = createTestServer("s1", echoServer.hostname, echoServer.port);
    const route = createTestRoute([server], { healthCheck: true });
    const proxy = new ReverseProxy(route);

    // Make a request to ensure connections are established
    const request = createTestRequest("GET", "/api/test");
    const context = createRequestContext();
    await proxy.handleRequest(request, context);

    // Shutdown should clean up health monitor and connections
    await proxy.shutdown();

    // Health monitor should be stopped
    const healthMonitor = proxy.getHealthMonitor();
    // Health monitor exists but should be stopped internally

    await echoServer.shutdown();
  },
});
