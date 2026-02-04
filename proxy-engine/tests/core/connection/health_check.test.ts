/**
 * Health Check Tests
 * Comprehensive tests for HealthMonitor and health checkers
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import {
  HealthMonitor,
  HealthCheck,
  TCPHealthChecker,
  HTTPHealthChecker,
  PingHealthChecker,
  createHealthChecker,
  type HealthCheckResult,
  type ServerHealthState,
  type HealthChecker,
} from "../../../core/connection/health_check.ts";

// ============================================================================
// Helper Functions
// ============================================================================

function createTestConfig(overrides?: Partial<{
  type: "tcp" | "http" | "ping";
  interval: number;
  timeout: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  httpPath?: string;
}>) {
  return {
    type: "tcp" as const,
    interval: 5000,
    timeout: 1000,
    healthyThreshold: 2,
    unhealthyThreshold: 3,
    ...overrides,
  };
}

function createTestServer(overrides?: Partial<{
  id: string;
  host: string;
  port: number;
  weight: number;
  enabled: boolean;
}>) {
  return {
    id: `server-${Date.now()}-${Math.random()}`,
    host: "localhost",
    port: 8080,
    weight: 1,
    enabled: true,
    ...overrides,
  };
}

// ============================================================================
// createHealthChecker Tests
// ============================================================================

Deno.test({
  name: "createHealthChecker - creates TCPHealthChecker for tcp type",
  fn() {
    const checker = createHealthChecker(createTestConfig({ type: "tcp" }));
    assert(checker instanceof TCPHealthChecker);
    assertEquals(checker.getType(), "tcp");
  },
});

Deno.test({
  name: "createHealthChecker - creates HTTPHealthChecker for http type",
  fn() {
    const checker = createHealthChecker(createTestConfig({ type: "http" }));
    assert(checker instanceof HTTPHealthChecker);
    assertEquals(checker.getType(), "http");
  },
});

Deno.test({
  name: "createHealthChecker - creates PingHealthChecker for ping type",
  fn() {
    const checker = createHealthChecker(createTestConfig({ type: "ping" }));
    assert(checker instanceof PingHealthChecker);
    assertEquals(checker.getType(), "ping");
  },
});

Deno.test({
  name: "createHealthChecker - throws for unknown type",
  fn() {
    assertThrows(
      () => createHealthChecker({ type: "unknown" as any, interval: 1000, timeout: 500, healthyThreshold: 2, unhealthyThreshold: 3 }),
      Error,
      "Unknown health check type"
    );
  },
});

// ============================================================================
// TCPHealthChecker Tests
// ============================================================================

Deno.test({
  name: "TCPHealthChecker - can be instantiated",
  fn() {
    const checker = new TCPHealthChecker(createTestConfig());
    assertExists(checker);
  },
});

Deno.test({
  name: "TCPHealthChecker - getType returns tcp",
  fn() {
    const checker = new TCPHealthChecker(createTestConfig());
    assertEquals(checker.getType(), "tcp");
  },
});

Deno.test({
  name: "TCPHealthChecker - check returns HealthCheckResult",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const checker = new TCPHealthChecker(createTestConfig({ timeout: 100 }));
    const server = createTestServer({ host: "localhost", port: 99999 });

    const result = await checker.check(server);

    assertExists(result);
    assertEquals(result.serverId, server.id);
    assertEquals(typeof result.healthy, "boolean");
    assertEquals(typeof result.responseTime, "number");
    assertEquals(typeof result.checkedAt, "number");
  },
});

Deno.test({
  name: "TCPHealthChecker - returns unhealthy for unreachable server",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const checker = new TCPHealthChecker(createTestConfig({ timeout: 100 }));
    const server = createTestServer({ host: "localhost", port: 99999 });

    const result = await checker.check(server);

    assertEquals(result.healthy, false);
    assertExists(result.error);
  },
});

// ============================================================================
// HTTPHealthChecker Tests
// ============================================================================

Deno.test({
  name: "HTTPHealthChecker - can be instantiated",
  fn() {
    const checker = new HTTPHealthChecker(createTestConfig({ type: "http" }));
    assertExists(checker);
  },
});

Deno.test({
  name: "HTTPHealthChecker - getType returns http",
  fn() {
    const checker = new HTTPHealthChecker(createTestConfig({ type: "http" }));
    assertEquals(checker.getType(), "http");
  },
});

Deno.test({
  name: "HTTPHealthChecker - check returns HealthCheckResult",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const checker = new HTTPHealthChecker(createTestConfig({ type: "http", timeout: 100 }));
    const server = createTestServer({ host: "localhost", port: 99999 });

    const result = await checker.check(server);

    assertExists(result);
    assertEquals(result.serverId, server.id);
    assertEquals(typeof result.healthy, "boolean");
  },
});

// ============================================================================
// PingHealthChecker Tests
// ============================================================================

Deno.test({
  name: "PingHealthChecker - can be instantiated",
  fn() {
    const checker = new PingHealthChecker(createTestConfig({ type: "ping" }));
    assertExists(checker);
  },
});

Deno.test({
  name: "PingHealthChecker - getType returns ping",
  fn() {
    const checker = new PingHealthChecker(createTestConfig({ type: "ping" }));
    assertEquals(checker.getType(), "ping");
  },
});

Deno.test({
  name: "PingHealthChecker - check returns HealthCheckResult",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const checker = new PingHealthChecker(createTestConfig({ type: "ping", timeout: 100 }));
    const server = createTestServer({ host: "localhost", port: 99999 });

    const result = await checker.check(server);

    assertExists(result);
    assertEquals(result.serverId, server.id);
    assertEquals(typeof result.healthy, "boolean");
  },
});

// ============================================================================
// HealthMonitor Constructor Tests
// ============================================================================

Deno.test({
  name: "HealthMonitor - can be instantiated",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthMonitor(createTestConfig());
    assertExists(monitor);
  },
});

Deno.test({
  name: "HealthMonitor - HealthCheck alias works",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthCheck(createTestConfig());
    assertExists(monitor);
  },
});

Deno.test({
  name: "HealthMonitor - starts in stopped state",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthMonitor(createTestConfig());
    assertEquals(monitor.isRunning(), false);
  },
});

// ============================================================================
// HealthMonitor start/stop Tests
// ============================================================================

Deno.test({
  name: "HealthMonitor - start begins monitoring",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthMonitor(createTestConfig({ interval: 60000 }));
    const servers = [createTestServer()];

    assertEquals(monitor.isRunning(), false);

    monitor.start(servers);

    assertEquals(monitor.isRunning(), true);

    monitor.stop();
  },
});

Deno.test({
  name: "HealthMonitor - stop terminates monitoring",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthMonitor(createTestConfig({ interval: 60000 }));
    const servers = [createTestServer()];

    monitor.start(servers);
    assertEquals(monitor.isRunning(), true);

    monitor.stop();
    assertEquals(monitor.isRunning(), false);
  },
});

Deno.test({
  name: "HealthMonitor - start does nothing if already running",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthMonitor(createTestConfig({ interval: 60000 }));
    const servers = [createTestServer()];

    monitor.start(servers);
    const intervalId1 = monitor.getIntervalId();

    monitor.start(servers);
    const intervalId2 = monitor.getIntervalId();

    // Should be same interval
    assertEquals(intervalId1, intervalId2);

    monitor.stop();
  },
});

Deno.test({
  name: "HealthMonitor - stop clears interval",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthMonitor(createTestConfig({ interval: 60000 }));
    const servers = [createTestServer()];

    monitor.start(servers);
    assertExists(monitor.getIntervalId());

    monitor.stop();
    assertEquals(monitor.getIntervalId(), undefined);
  },
});

// ============================================================================
// HealthMonitor getServerState Tests
// ============================================================================

Deno.test({
  name: "HealthMonitor - getServerState returns null for unknown server",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthMonitor(createTestConfig());
    assertEquals(monitor.getServerState("unknown"), null);
  },
});

Deno.test({
  name: "HealthMonitor - getServerState returns state after start",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const monitor = new HealthMonitor(createTestConfig({ interval: 60000 }));
    const server = createTestServer();

    monitor.start([server]);

    // Wait for initial check
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));

    const state = monitor.getServerState(server.id);
    assertExists(state);
    assertEquals(state.serverId, server.id);

    monitor.stop();
  },
});

// ============================================================================
// HealthMonitor getAllStates Tests
// ============================================================================

Deno.test({
  name: "HealthMonitor - getAllStates returns empty map initially",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthMonitor(createTestConfig());
    const states = monitor.getAllStates();

    assertEquals(states.size, 0);
  },
});

Deno.test({
  name: "HealthMonitor - getAllStates returns all server states",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const monitor = new HealthMonitor(createTestConfig({ interval: 60000 }));
    const servers = [
      createTestServer({ id: "server-1" }),
      createTestServer({ id: "server-2" }),
      createTestServer({ id: "server-3" }),
    ];

    monitor.start(servers);

    // Wait for initial checks
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));

    const states = monitor.getAllStates();
    assertEquals(states.size, 3);
    assert(states.has("server-1"));
    assert(states.has("server-2"));
    assert(states.has("server-3"));

    monitor.stop();
  },
});

// ============================================================================
// HealthMonitor isHealthy Tests
// ============================================================================

Deno.test({
  name: "HealthMonitor - isHealthy returns true for unknown server (default healthy)",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthMonitor(createTestConfig());
    assertEquals(monitor.isHealthy("unknown-server"), true);
  },
});

Deno.test({
  name: "HealthMonitor - isHealthy accepts server ID string",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthMonitor(createTestConfig());
    assertEquals(monitor.isHealthy("server-1"), true);
  },
});

Deno.test({
  name: "HealthMonitor - isHealthy accepts UpstreamServer object",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthMonitor(createTestConfig());
    const server = createTestServer();

    assertEquals(monitor.isHealthy(server), true);
  },
});

// ============================================================================
// HealthMonitor getHealthyServers Tests
// ============================================================================

Deno.test({
  name: "HealthMonitor - getHealthyServers returns all servers if not checked",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthMonitor(createTestConfig());
    const servers = [
      createTestServer({ id: "s1" }),
      createTestServer({ id: "s2" }),
    ];

    const healthy = monitor.getHealthyServers(servers);
    assertEquals(healthy.length, 2);
  },
});

// ============================================================================
// HealthMonitor reset Tests
// ============================================================================

Deno.test({
  name: "HealthMonitor - reset clears all states",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const monitor = new HealthMonitor(createTestConfig({ interval: 60000 }));
    const servers = [createTestServer()];

    monitor.start(servers);
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));

    assert(monitor.getAllStates().size > 0);

    monitor.reset();

    assertEquals(monitor.getAllStates().size, 0);

    monitor.stop();
  },
});

// ============================================================================
// HealthMonitor getChecker Tests
// ============================================================================

Deno.test({
  name: "HealthMonitor - getChecker returns checker instance",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthMonitor(createTestConfig({ type: "tcp" }));
    const checker = monitor.getChecker();

    assertExists(checker);
    assertEquals(checker.getType(), "tcp");
  },
});

// ============================================================================
// HealthMonitor getConfig Tests
// ============================================================================

Deno.test({
  name: "HealthMonitor - getConfig returns configuration",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const config = createTestConfig({
      interval: 10000,
      timeout: 2000,
      healthyThreshold: 5,
    });
    const monitor = new HealthMonitor(config);
    const retrieved = monitor.getConfig();

    assertEquals(retrieved.interval, 10000);
    assertEquals(retrieved.timeout, 2000);
    assertEquals(retrieved.healthyThreshold, 5);
  },
});

// ============================================================================
// HealthMonitor getStats Tests
// ============================================================================

Deno.test({
  name: "HealthMonitor - getStats returns comprehensive statistics",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const monitor = new HealthMonitor(createTestConfig({ type: "tcp", interval: 60000 }));
    const servers = [
      createTestServer({ id: "s1" }),
      createTestServer({ id: "s2" }),
    ];

    monitor.start(servers);
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));

    const stats = monitor.getStats();

    assertEquals(stats.totalServers, 2);
    assertEquals(typeof stats.healthyServers, "number");
    assertEquals(typeof stats.unhealthyServers, "number");
    assertEquals(stats.running, true);
    assertEquals(stats.checkerType, "tcp");

    monitor.stop();
  },
});

Deno.test({
  name: "HealthMonitor - getStats returns zeros when empty",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const monitor = new HealthMonitor(createTestConfig());
    const stats = monitor.getStats();

    assertEquals(stats.totalServers, 0);
    assertEquals(stats.healthyServers, 0);
    assertEquals(stats.unhealthyServers, 0);
    assertEquals(stats.running, false);
  },
});

// ============================================================================
// ServerHealthState Tests
// ============================================================================

Deno.test({
  name: "ServerHealthState - has correct initial structure",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const monitor = new HealthMonitor(createTestConfig({ interval: 60000 }));
    const server = createTestServer();

    monitor.start([server]);
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));

    const state = monitor.getServerState(server.id);
    assertExists(state);

    assertEquals(state.serverId, server.id);
    assertEquals(typeof state.healthy, "boolean");
    assertEquals(typeof state.consecutiveSuccesses, "number");
    assertEquals(typeof state.consecutiveFailures, "number");
    assertEquals(typeof state.lastCheckAt, "number");
    assertEquals(typeof state.lastSuccessAt, "number");
    assertEquals(typeof state.lastFailureAt, "number");
    assertEquals(typeof state.totalChecks, "number");
    assertEquals(typeof state.totalSuccesses, "number");
    assertEquals(typeof state.totalFailures, "number");

    monitor.stop();
  },
});

// ============================================================================
// HealthCheckResult Tests
// ============================================================================

Deno.test({
  name: "HealthCheckResult - has correct structure",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const checker = new TCPHealthChecker(createTestConfig({ timeout: 100 }));
    const server = createTestServer({ port: 99999 });

    const result = await checker.check(server);

    assertEquals(typeof result.serverId, "string");
    assertEquals(typeof result.healthy, "boolean");
    assertEquals(typeof result.responseTime, "number");
    assertEquals(typeof result.checkedAt, "number");
    // error is optional
  },
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

Deno.test({
  name: "HealthMonitor - handles many servers",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const monitor = new HealthMonitor(createTestConfig({ interval: 60000 }));
    const servers = Array.from({ length: 20 }, (_, i) =>
      createTestServer({ id: `server-${i}` })
    );

    monitor.start(servers);
    await new Promise((resolve) => globalThis.setTimeout(resolve, 200));

    const states = monitor.getAllStates();
    assertEquals(states.size, 20);

    monitor.stop();
  },
});

Deno.test({
  name: "HealthMonitor - full lifecycle test",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const monitor = new HealthMonitor(createTestConfig({
      type: "tcp",
      interval: 60000,
      timeout: 100,
      healthyThreshold: 2,
      unhealthyThreshold: 2,
    }));

    // Create servers
    const servers = [
      createTestServer({ id: "server-1", port: 99998 }),
      createTestServer({ id: "server-2", port: 99999 }),
    ];

    // Start monitoring
    assertEquals(monitor.isRunning(), false);
    monitor.start(servers);
    assertEquals(monitor.isRunning(), true);

    // Wait for checks
    await new Promise((resolve) => globalThis.setTimeout(resolve, 200));

    // Verify states
    const states = monitor.getAllStates();
    assertEquals(states.size, 2);

    const state1 = monitor.getServerState("server-1");
    assertExists(state1);
    assert(state1.totalChecks > 0);

    // Check stats
    const stats = monitor.getStats();
    assertEquals(stats.totalServers, 2);
    assertEquals(stats.running, true);
    assertEquals(stats.checkerType, "tcp");

    // Reset states
    monitor.reset();
    assertEquals(monitor.getAllStates().size, 0);

    // Stop monitoring
    monitor.stop();
    assertEquals(monitor.isRunning(), false);
    assertEquals(monitor.getIntervalId(), undefined);
  },
});
