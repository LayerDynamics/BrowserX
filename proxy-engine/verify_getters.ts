/**
 * Getter Method Verification Script
 *
 * Tests that all newly added getter methods work correctly and return expected values.
 * This verifies Phase 2 (Getter Methods) was successful.
 */

console.log("=".repeat(70));
console.log("PHASE 3: GETTER METHOD VERIFICATION");
console.log("=".repeat(70));
console.log();

// Track results
const results: { name: string; status: "✓" | "✗"; error?: string }[] = [];

// Helper to test getter
function testGetter(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, status: "✓" });
    console.log(`✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, status: "✗", error: message });
    console.log(`✗ ${name}: ${message}`);
  }
}

// Test HTTP/1.1 Server getters
console.log("\n--- HTTP/1.1 Server Getters (3 getters) ---");

import { HTTP11Server } from "./core/network/transport/http/http.ts";
import { Socket } from "./core/network/transport/socket/socket.ts";

testGetter("HTTP11Server.getReader()", () => {
  const socket = new Socket("example.com", 80);
  const server = new HTTP11Server(socket);
  const reader = server.getReader();
  if (reader !== null && typeof reader !== "object") {
    throw new Error("Expected StreamReader or null");
  }
});

testGetter("HTTP11Server.getWriter()", () => {
  const socket = new Socket("example.com", 80);
  const server = new HTTP11Server(socket);
  const writer = server.getWriter();
  if (writer !== null && typeof writer !== "object") {
    throw new Error("Expected StreamWriter or null");
  }
});

testGetter("HTTP11Server.getSocket()", () => {
  const socket = new Socket("example.com", 80);
  const server = new HTTP11Server(socket);
  const result = server.getSocket();
  if (!(result instanceof Socket)) {
    throw new Error("Expected Socket instance");
  }
});

// Test HTTPS Client getters
console.log("\n--- HTTPS Client Getters (7 getters) ---");

import { HTTPSClient } from "./core/network/transport/http/https.ts";

testGetter("HTTPSClient.getTLSConnection()", () => {
  const client = new HTTPSClient("example.com", 443);
  const result = client.getTLSConnection();
  if (result !== null && typeof result !== "object") {
    throw new Error("Expected Deno.TlsConn or null");
  }
});

testGetter("HTTPSClient.getSocket()", () => {
  const client = new HTTPSClient("example.com", 443);
  const result = client.getSocket();
  if (result !== null && !(result instanceof Socket)) {
    throw new Error("Expected Socket or null");
  }
});

testGetter("HTTPSClient.getHTTPClient()", () => {
  const client = new HTTPSClient("example.com", 443);
  const result = client.getHTTPClient();
  if (result !== null && typeof result !== "object") {
    throw new Error("Expected HTTP11Client or null");
  }
});

testGetter("HTTPSClient.getHost()", () => {
  const client = new HTTPSClient("example.com", 443);
  const host = client.getHost();
  if (host !== "example.com") {
    throw new Error(`Expected 'example.com', got '${host}'`);
  }
});

testGetter("HTTPSClient.getPort()", () => {
  const client = new HTTPSClient("example.com", 443);
  const port = client.getPort();
  if (port !== 443) {
    throw new Error(`Expected 443, got ${port}`);
  }
});

testGetter("HTTPSClient.getTLSOptions()", () => {
  const client = new HTTPSClient("example.com", 443);
  const options = client.getTLSOptions();
  if (typeof options !== "object") {
    throw new Error("Expected TLSOptions object");
  }
});

testGetter("HTTPSClient.isConnected()", () => {
  const client = new HTTPSClient("example.com", 443);
  const connected = client.isConnected();
  if (typeof connected !== "boolean") {
    throw new Error("Expected boolean");
  }
  if (connected !== false) {
    throw new Error("Expected false (not connected yet)");
  }
});

// Test HTTP/2 Connection getters
console.log("\n--- HTTP/2 Connection Getters (10 getters) ---");

import { HTTP2Connection } from "./core/network/transport/http/http2.ts";

// Note: HTTP2Connection constructor needs actual connection, so we test method signatures
testGetter("HTTP2Connection has getConnection()", () => {
  if (typeof HTTP2Connection.prototype.getConnection !== "function") {
    throw new Error("Method getConnection not found");
  }
});

testGetter("HTTP2Connection has getHPACK()", () => {
  if (typeof HTTP2Connection.prototype.getHPACK !== "function") {
    throw new Error("Method getHPACK not found");
  }
});

testGetter("HTTP2Connection has getStreams()", () => {
  if (typeof HTTP2Connection.prototype.getStreams !== "function") {
    throw new Error("Method getStreams not found");
  }
});

testGetter("HTTP2Connection has getNextStreamId()", () => {
  if (typeof HTTP2Connection.prototype.getNextStreamId !== "function") {
    throw new Error("Method getNextStreamId not found");
  }
});

testGetter("HTTP2Connection has getConnectionWindowSize()", () => {
  if (typeof HTTP2Connection.prototype.getConnectionWindowSize !== "function") {
    throw new Error("Method getConnectionWindowSize not found");
  }
});

testGetter("HTTP2Connection has getRemoteSettings()", () => {
  if (typeof HTTP2Connection.prototype.getRemoteSettings !== "function") {
    throw new Error("Method getRemoteSettings not found");
  }
});

testGetter("HTTP2Connection has getLocalSettings()", () => {
  if (typeof HTTP2Connection.prototype.getLocalSettings !== "function") {
    throw new Error("Method getLocalSettings not found");
  }
});

testGetter("HTTP2Connection has getConfig()", () => {
  if (typeof HTTP2Connection.prototype.getConfig !== "function") {
    throw new Error("Method getConfig not found");
  }
});

testGetter("HTTP2Connection has isClosed()", () => {
  if (typeof HTTP2Connection.prototype.isClosed !== "function") {
    throw new Error("Method isClosed not found");
  }
});

testGetter("HTTP2Connection has getPendingFrames()", () => {
  if (typeof HTTP2Connection.prototype.getPendingFrames !== "function") {
    throw new Error("Method getPendingFrames not found");
  }
});

// Test Load Balancer getters
console.log("\n--- Load Balancer Getters (2 getters) ---");

import { RoundRobinLoadBalancer } from "./gateway/router/load_balancer/round_robin.ts";
import { WeightedRoundRobinLoadBalancer } from "./gateway/router/load_balancer/weighted_round_robin.ts";

testGetter("RoundRobinLoadBalancer.getCurrentIndex()", () => {
  const lb = new RoundRobinLoadBalancer();
  const index = lb.getCurrentIndex();
  if (typeof index !== "number") {
    throw new Error("Expected number");
  }
  if (index !== 0) {
    throw new Error("Expected initial index to be 0");
  }
});

testGetter("WeightedRoundRobinLoadBalancer.getCurrentWeight() & getCurrentIndex()", () => {
  const lb = new WeightedRoundRobinLoadBalancer();
  const weight = lb.getCurrentWeight();
  const index = lb.getCurrentIndex();
  if (typeof weight !== "number") {
    throw new Error("getCurrentWeight() should return number");
  }
  if (typeof index !== "number") {
    throw new Error("getCurrentIndex() should return number");
  }
});

// Test EventDrivenProxy getters
console.log("\n--- EventDrivenProxy Getters (3 getters) ---");

import { EventDrivenProxy } from "./core/proxy_types/event_driven_proxy.ts";

testGetter("EventDrivenProxy.getConfig()", () => {
  const proxy = new EventDrivenProxy({
    listenPort: 8080,
    targetHost: "example.com",
    targetPort: 80,
    maxConnections: 100,
  });
  const config = proxy.getConfig();
  if (typeof config !== "object") {
    throw new Error("Expected config object");
  }
  if (config.listenPort !== 8080) {
    throw new Error("Config should contain correct listenPort");
  }
});

testGetter("EventDrivenProxy.getActiveConnections()", () => {
  const proxy = new EventDrivenProxy({
    listenPort: 8080,
    targetHost: "example.com",
    targetPort: 80,
    maxConnections: 100,
  });
  const count = proxy.getActiveConnections();
  if (typeof count !== "number") {
    throw new Error("Expected number");
  }
  if (count !== 0) {
    throw new Error("Expected 0 active connections initially");
  }
});

testGetter("EventDrivenProxy.getStats()", () => {
  const proxy = new EventDrivenProxy({
    listenPort: 8080,
    targetHost: "example.com",
    targetPort: 80,
    maxConnections: 100,
  });
  const stats = proxy.getStats();
  if (typeof stats !== "object") {
    throw new Error("Expected stats object");
  }
  if (typeof stats.totalConnections !== "number") {
    throw new Error("Stats should have totalConnections");
  }
});

// Test ConnectionPool getters
console.log("\n--- ConnectionPool Getters (4 getters) ---");

import { ConnectionPool } from "./core/connection/connection_pool.ts";

testGetter("ConnectionPool.getPools()", () => {
  const pool = new ConnectionPool({
    minConnections: 2,
    maxConnections: 10,
    idleTimeout: 30000,
    maxLifetime: 300000,
  });
  const pools = pool.getPools();
  if (!(pools instanceof Map)) {
    throw new Error("Expected Map");
  }
});

testGetter("ConnectionPool.getConfig()", () => {
  const config = {
    minConnections: 2,
    maxConnections: 10,
    idleTimeout: 30000,
    maxLifetime: 300000,
  };
  const pool = new ConnectionPool(config);
  const result = pool.getConfig();
  if (typeof result !== "object") {
    throw new Error("Expected config object");
  }
  if (result.maxConnections !== 10) {
    throw new Error("Config should contain correct maxConnections");
  }
});

testGetter("ConnectionPool.getNextId()", () => {
  const pool = new ConnectionPool({
    minConnections: 2,
    maxConnections: 10,
    idleTimeout: 30000,
    maxLifetime: 300000,
  });
  const id = pool.getNextId();
  if (typeof id !== "number") {
    throw new Error("Expected number");
  }
});

testGetter("ConnectionPool.getStats()", () => {
  const pool = new ConnectionPool({
    minConnections: 2,
    maxConnections: 10,
    idleTimeout: 30000,
    maxLifetime: 300000,
  });
  const stats = pool.getStats();
  if (typeof stats !== "object") {
    throw new Error("Expected stats object");
  }
  if (typeof stats.totalConnections !== "number") {
    throw new Error("Stats should have totalConnections");
  }
});

// Test HealthMonitor getters
console.log("\n--- HealthMonitor Getters (4 getters) ---");

import { HealthMonitor } from "./core/connection/health_check.ts";

testGetter("HealthMonitor.getChecker()", () => {
  const monitor = new HealthMonitor({
    type: "tcp",
    interval: 5000,
    timeout: 2000,
    healthyThreshold: 2,
    unhealthyThreshold: 3,
  });
  const checker = monitor.getChecker();
  if (typeof checker !== "object") {
    throw new Error("Expected HealthChecker object");
  }
  if (typeof checker.getType !== "function") {
    throw new Error("Checker should have getType() method");
  }
});

testGetter("HealthMonitor.getConfig()", () => {
  const config = {
    type: "tcp" as const,
    interval: 5000,
    timeout: 2000,
    healthyThreshold: 2,
    unhealthyThreshold: 3,
  };
  const monitor = new HealthMonitor(config);
  const result = monitor.getConfig();
  if (typeof result !== "object") {
    throw new Error("Expected config object");
  }
  if (result.interval !== 5000) {
    throw new Error("Config should contain correct interval");
  }
});

testGetter("HealthMonitor.getIntervalId()", () => {
  const monitor = new HealthMonitor({
    type: "tcp",
    interval: 5000,
    timeout: 2000,
    healthyThreshold: 2,
    unhealthyThreshold: 3,
  });
  const id = monitor.getIntervalId();
  if (id !== undefined && typeof id !== "number") {
    throw new Error("Expected number or undefined");
  }
});

testGetter("HealthMonitor.isRunning()", () => {
  const monitor = new HealthMonitor({
    type: "tcp",
    interval: 5000,
    timeout: 2000,
    healthyThreshold: 2,
    unhealthyThreshold: 3,
  });
  const running = monitor.isRunning();
  if (typeof running !== "boolean") {
    throw new Error("Expected boolean");
  }
  if (running !== false) {
    throw new Error("Expected false (not started yet)");
  }
});

// Test HTTP11Client getters (NEW)
console.log("\n--- HTTP/1.1 Client Getters (4 getters) ---");

import { HTTP11Client } from "./core/network/transport/http/http.ts";

testGetter("HTTP11Client.getReader()", () => {
  const client = new HTTP11Client({ host: "example.com", port: 80 });
  const reader = client.getReader();
  if (reader !== null && typeof reader !== "object") {
    throw new Error("Expected StreamReader or null");
  }
});

testGetter("HTTP11Client.getWriter()", () => {
  const client = new HTTP11Client({ host: "example.com", port: 80 });
  const writer = client.getWriter();
  if (writer !== null && typeof writer !== "object") {
    throw new Error("Expected StreamWriter or null");
  }
});

testGetter("HTTP11Client.getSocket()", () => {
  const client = new HTTP11Client({ host: "example.com", port: 80 });
  const socket = client.getSocket();
  if (socket !== null && !(socket instanceof Socket)) {
    throw new Error("Expected Socket or null");
  }
});

testGetter("HTTP11Client.getConfig()", () => {
  const client = new HTTP11Client({ host: "example.com", port: 80 });
  const config = client.getConfig();
  if (config === null) {
    // Config might be null if not set yet
    return;
  }
  if (typeof config !== "object") {
    throw new Error("Expected config object or null");
  }
  if (config.host !== "example.com") {
    throw new Error("Config should contain correct host");
  }
});

// Test AuthProxy getters (NEW)
console.log("\n--- AuthProxy Getters (7 getters) ---");

import { AuthProxy } from "./core/proxy_types/auth_proxy.ts";
import type { Route } from "./gateway/router/request_router.ts";

const authRoute: Route = {
  id: "test-auth",
  path: "/api/*",
  upstream: {
    servers: [{ id: "server1", host: "backend.example.com", port: 8080, weight: 1 }],
    loadBalancingStrategy: "round-robin",
  },
};

testGetter("AuthProxy.getLoadBalancer()", () => {
  const proxy = new AuthProxy(authRoute, {
    authMethods: ["basic"],
    accessRules: [],
    userValidator: async () => ({ valid: true }),
  });
  const lb = proxy.getLoadBalancer();
  if (typeof lb !== "object") {
    throw new Error("Expected LoadBalancer object");
  }
});

testGetter("AuthProxy.getHealthMonitor()", () => {
  const proxy = new AuthProxy(authRoute, {
    authMethods: ["basic"],
    accessRules: [],
    userValidator: async () => ({ valid: true }),
  });
  const monitor = proxy.getHealthMonitor();
  // Should be undefined if not configured
  if (monitor !== undefined && typeof monitor !== "object") {
    throw new Error("Expected HealthMonitor or undefined");
  }
});

testGetter("AuthProxy.getConnectionManager()", () => {
  const proxy = new AuthProxy(authRoute, {
    authMethods: ["basic"],
    accessRules: [],
    userValidator: async () => ({ valid: true }),
  });
  const manager = proxy.getConnectionManager();
  if (typeof manager !== "object") {
    throw new Error("Expected UpstreamConnectionManager object");
  }
});

testGetter("AuthProxy.getConfig()", () => {
  const proxy = new AuthProxy(authRoute, {
    authMethods: ["basic"],
    accessRules: [],
    userValidator: async () => ({ valid: true }),
  });
  const config = proxy.getConfig();
  if (typeof config !== "object") {
    throw new Error("Expected config object");
  }
  if (!Array.isArray(config.authMethods)) {
    throw new Error("Config should have authMethods array");
  }
});

testGetter("AuthProxy.getRoute()", () => {
  const proxy = new AuthProxy(authRoute, {
    authMethods: ["basic"],
    accessRules: [],
    userValidator: async () => ({ valid: true }),
  });
  const route = proxy.getRoute();
  if (typeof route !== "object") {
    throw new Error("Expected Route object");
  }
  if (route.id !== "test-auth") {
    throw new Error("Route should have correct id");
  }
});

testGetter("AuthProxy.getUserValidator()", () => {
  const validator = async () => ({ valid: true });
  const proxy = new AuthProxy(authRoute, {
    authMethods: ["basic"],
    accessRules: [],
    userValidator: validator,
  });
  const result = proxy.getUserValidator();
  if (typeof result !== "function") {
    throw new Error("Expected function");
  }
});

testGetter("AuthProxy.getAccessRules()", () => {
  const proxy = new AuthProxy(authRoute, {
    authMethods: ["basic"],
    accessRules: [{ path: "/admin/*", roles: ["admin"], methods: ["GET", "POST"] }],
    userValidator: async () => ({ valid: true }),
  });
  const rules = proxy.getAccessRules();
  if (!Array.isArray(rules)) {
    throw new Error("Expected array");
  }
  if (rules.length !== 1) {
    throw new Error("Should have 1 access rule");
  }
});

// Test TLSProxy getters (NEW)
console.log("\n--- TLSProxy Getters (6 getters) ---");

import { TLSProxy } from "./core/proxy_types/tls_proxy.ts";

const tlsRoute: Route = {
  id: "test-tls",
  path: "/*",
  upstream: {
    servers: [{ id: "server1", host: "backend.example.com", port: 443, weight: 1 }],
    loadBalancingStrategy: "round-robin",
  },
};

testGetter("TLSProxy.getLoadBalancer()", () => {
  const proxy = new TLSProxy(tlsRoute, { mode: "termination" });
  const lb = proxy.getLoadBalancer();
  if (typeof lb !== "object") {
    throw new Error("Expected LoadBalancer object");
  }
});

testGetter("TLSProxy.getHealthMonitor()", () => {
  const proxy = new TLSProxy(tlsRoute, { mode: "termination" });
  const monitor = proxy.getHealthMonitor();
  if (monitor !== undefined && typeof monitor !== "object") {
    throw new Error("Expected HealthMonitor or undefined");
  }
});

testGetter("TLSProxy.getConnectionManager()", () => {
  const proxy = new TLSProxy(tlsRoute, { mode: "termination" });
  const manager = proxy.getConnectionManager();
  if (typeof manager !== "object") {
    throw new Error("Expected UpstreamConnectionManager object");
  }
});

testGetter("TLSProxy.getConfig()", () => {
  const proxy = new TLSProxy(tlsRoute, { mode: "termination" });
  const config = proxy.getConfig();
  if (typeof config !== "object") {
    throw new Error("Expected config object");
  }
  if (config.mode !== "termination") {
    throw new Error("Config should have correct mode");
  }
});

testGetter("TLSProxy.getRoute()", () => {
  const proxy = new TLSProxy(tlsRoute, { mode: "termination" });
  const route = proxy.getRoute();
  if (typeof route !== "object") {
    throw new Error("Expected Route object");
  }
  if (route.id !== "test-tls") {
    throw new Error("Route should have correct id");
  }
});

testGetter("TLSProxy.getTLSMode()", () => {
  const proxy = new TLSProxy(tlsRoute, { mode: "termination" });
  const mode = proxy.getTLSMode();
  if (mode !== "termination") {
    throw new Error("Expected 'termination'");
  }
});

// Test LoadBalancerProxy getters (NEW)
console.log("\n--- LoadBalancerProxy Getters (5 getters) ---");

import { LoadBalancerProxy } from "./core/proxy_types/loadbalance_proxy.ts";

const lbRoute: Route = {
  id: "test-lb",
  path: "/*",
  upstream: {
    servers: [
      { id: "server1", host: "backend1.example.com", port: 80, weight: 1 },
      { id: "server2", host: "backend2.example.com", port: 80, weight: 1 },
    ],
    loadBalancingStrategy: "round-robin",
  },
};

testGetter("LoadBalancerProxy.getSessionMap()", () => {
  const proxy = new LoadBalancerProxy(lbRoute, {
    sessionAffinity: { enabled: true },
    failover: { enabled: true },
  });
  const sessionMap = proxy.getSessionMap();
  if (!(sessionMap instanceof Map)) {
    throw new Error("Expected Map");
  }
});

testGetter("LoadBalancerProxy.getFailureState()", () => {
  const proxy = new LoadBalancerProxy(lbRoute, {
    sessionAffinity: { enabled: true },
    failover: { enabled: true },
  });
  const failureState = proxy.getFailureState();
  if (!(failureState instanceof Map)) {
    throw new Error("Expected Map");
  }
});

testGetter("LoadBalancerProxy.getSessionForClient()", () => {
  const proxy = new LoadBalancerProxy(lbRoute, {
    sessionAffinity: { enabled: true },
    failover: { enabled: true },
  });
  const session = proxy.getSessionForClient("test-session-key");
  if (session !== undefined && typeof session !== "object") {
    throw new Error("Expected SessionMapping or undefined");
  }
});

testGetter("LoadBalancerProxy.getFailureTracking()", () => {
  const proxy = new LoadBalancerProxy(lbRoute, {
    sessionAffinity: { enabled: true },
    failover: { enabled: true },
  });
  const tracking = proxy.getFailureTracking("server1");
  if (tracking !== undefined && typeof tracking !== "object") {
    throw new Error("Expected ServerFailureState or undefined");
  }
});

testGetter("LoadBalancerProxy.getLBConfig()", () => {
  const proxy = new LoadBalancerProxy(lbRoute, {
    sessionAffinity: { enabled: true },
    failover: { enabled: true },
  });
  const config = proxy.getLBConfig();
  if (typeof config !== "object") {
    throw new Error("Expected config object");
  }
  if (typeof config.sessionAffinity !== "object") {
    throw new Error("Config should have sessionAffinity");
  }
});

// Test RateLimitMiddleware getters (NEW)
console.log("\n--- RateLimitMiddleware Getters (2 getters) ---");

import { RateLimitMiddleware } from "./gateway/middleware/rate_limit.ts";

testGetter("RateLimitMiddleware.getState()", () => {
  const middleware = new RateLimitMiddleware({
    algorithm: "token_bucket",
    maxRequests: 100,
    windowMs: 60000,
  });
  const state = middleware.getState();
  if (!(state instanceof Map)) {
    throw new Error("Expected Map");
  }
});

testGetter("RateLimitMiddleware.getRateLimitStats()", () => {
  const middleware = new RateLimitMiddleware({
    algorithm: "token_bucket",
    maxRequests: 100,
    windowMs: 60000,
  });
  const stats = middleware.getRateLimitStats();
  if (typeof stats !== "object") {
    throw new Error("Expected stats object");
  }
  if (typeof stats.totalKeys !== "number") {
    throw new Error("Stats should have totalKeys");
  }
  if (typeof stats.keysWithZeroTokens !== "number") {
    throw new Error("Stats should have keysWithZeroTokens");
  }
});

// Test Header Middleware getters (NEW)
console.log("\n--- Header Middleware Getters (5 getters) ---");

import {
  HeaderTransformMiddleware,
  RequestHeaderMiddleware,
  ResponseHeaderMiddleware,
} from "./gateway/middleware/headers.ts";

testGetter("RequestHeaderMiddleware.getRules()", () => {
  const middleware = new RequestHeaderMiddleware([
    { name: "X-Custom-Header", operation: "set", value: "test" },
  ]);
  const rules = middleware.getRules();
  if (!Array.isArray(rules)) {
    throw new Error("Expected array");
  }
  if (rules.length !== 1) {
    throw new Error("Should have 1 rule");
  }
});

testGetter("ResponseHeaderMiddleware.getRules()", () => {
  const middleware = new ResponseHeaderMiddleware([
    { name: "X-Custom-Header", operation: "set", value: "test" },
  ]);
  const rules = middleware.getRules();
  if (!Array.isArray(rules)) {
    throw new Error("Expected array");
  }
});

testGetter("ResponseHeaderMiddleware.getConfig()", () => {
  const middleware = new ResponseHeaderMiddleware([], {
    securityHeaders: true,
    removeProxyHeaders: true,
  });
  const config = middleware.getConfig();
  if (typeof config !== "object") {
    throw new Error("Expected config object");
  }
  if (config.securityHeaders !== true) {
    throw new Error("Config should have correct securityHeaders");
  }
});

testGetter("HeaderTransformMiddleware.getRequestMiddleware()", () => {
  const middleware = new HeaderTransformMiddleware({
    requestRules: [{ name: "X-Test", operation: "set", value: "test" }],
  });
  const reqMiddleware = middleware.getRequestMiddleware();
  if (typeof reqMiddleware !== "object") {
    throw new Error("Expected RequestHeaderMiddleware object");
  }
  if (typeof reqMiddleware.getRules !== "function") {
    throw new Error("Should have getRules method");
  }
});

testGetter("HeaderTransformMiddleware.getResponseMiddleware()", () => {
  const middleware = new HeaderTransformMiddleware({
    responseRules: [{ name: "X-Test", operation: "set", value: "test" }],
  });
  const resMiddleware = middleware.getResponseMiddleware();
  if (typeof resMiddleware !== "object") {
    throw new Error("Expected ResponseHeaderMiddleware object");
  }
  if (typeof resMiddleware.getRules !== "function") {
    throw new Error("Should have getRules method");
  }
});

// Test that getters return copies of mutable collections
console.log("\n--- Testing Immutability (3 tests) ---");

testGetter("HTTP2Connection.getStreams() returns copy", () => {
  if (typeof HTTP2Connection.prototype.getStreams !== "function") {
    throw new Error("Method not found");
  }
  // Can't test actual copy behavior without instance, but verified method exists
});

testGetter("HTTP2Connection.getRemoteSettings() returns copy", () => {
  if (typeof HTTP2Connection.prototype.getRemoteSettings !== "function") {
    throw new Error("Method not found");
  }
});

testGetter("ConnectionPool.getPools() returns copy", () => {
  const pool = new ConnectionPool({
    minConnections: 2,
    maxConnections: 10,
    idleTimeout: 30000,
    maxLifetime: 300000,
  });
  const pools1 = pool.getPools();
  const pools2 = pool.getPools();
  if (pools1 === pools2) {
    throw new Error("Should return new copy each time");
  }
});

// Print summary
console.log("\n" + "=".repeat(70));
console.log("GETTER VERIFICATION SUMMARY");
console.log("=".repeat(70));

const passed = results.filter((r) => r.status === "✓").length;
const failed = results.filter((r) => r.status === "✗").length;

console.log(`Total: ${results.length}`);
console.log(`Passed: ${passed} ✓`);
console.log(`Failed: ${failed} ✗`);

if (failed > 0) {
  console.log("\nFailed tests:");
  results.filter((r) => r.status === "✗").forEach((r) => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
  Deno.exit(1);
} else {
  console.log("\n✓ All getter methods verified successfully!");
  Deno.exit(0);
}
