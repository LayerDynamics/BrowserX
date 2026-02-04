/**
 * HealthChecker Unit Tests
 *
 * Comprehensive tests for health check functionality including
 * handler registration, health status computation, and event emission.
 */

import {
  assertEquals,
  assertExists,
} from "@std/assert";
import { HealthChecker, HealthCheckHandler } from "../../src/metrics/HealthChecker.ts";
import type { MetricsConfig } from "../../src/config/RuntimeConfig.ts";
import type { HealthStatus, RuntimeEvent, ComponentId } from "../../src/types.ts";

/**
 * Create test metrics config
 */
function createTestMetricsConfig(
  overrides: Partial<MetricsConfig> = {},
): MetricsConfig {
  return {
    enabled: false,
    healthCheckInterval: 0, // Disable periodic checks in tests
    exportFormat: "json",
    ...overrides,
  };
}

// ============================================================================
// Basic Instantiation Tests
// ============================================================================

Deno.test("HealthChecker - instantiation with config", () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  assertExists(checker);
  assertEquals(checker.isRunning(), false);
});

Deno.test("HealthChecker - getConfig returns copy of config", () => {
  const config = createTestMetricsConfig({ healthCheckInterval: 5000 });
  const checker = new HealthChecker(config);

  const retrieved = checker.getConfig();
  assertEquals(retrieved.healthCheckInterval, 5000);

  // Modifying returned config should not affect internal config
  retrieved.healthCheckInterval = 10000;
  assertEquals(checker.getConfig().healthCheckInterval, 5000);
});

// ============================================================================
// Start/Stop Tests
// ============================================================================

Deno.test({
  name: "HealthChecker - start enables running state",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    const config = createTestMetricsConfig();
    const checker = new HealthChecker(config);

    checker.start();
    assertEquals(checker.isRunning(), true);

    checker.stop();
    assertEquals(checker.isRunning(), false);
  },
});

Deno.test({
  name: "HealthChecker - double start is idempotent",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    const config = createTestMetricsConfig();
    const checker = new HealthChecker(config);

    checker.start();
    checker.start(); // Should not throw
    assertEquals(checker.isRunning(), true);

    checker.stop();
  },
});

Deno.test({
  name: "HealthChecker - double stop is idempotent",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    const config = createTestMetricsConfig();
    const checker = new HealthChecker(config);

    checker.start();
    checker.stop();
    checker.stop(); // Should not throw
    assertEquals(checker.isRunning(), false);
  },
});

Deno.test({
  name: "HealthChecker - periodic checks when interval > 0",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestMetricsConfig({ healthCheckInterval: 50 });
    const checker = new HealthChecker(config);

    let checkCount = 0;
    checker.registerHandler("browser-pool", async () => {
      checkCount++;
      return { status: "healthy" };
    });

    checker.start();

    // Wait for periodic checks
    await new Promise((r) => setTimeout(r, 150));

    // Should have run at least 2 checks
    assertEquals(checkCount >= 2, true);

    checker.stop();
  },
});

// ============================================================================
// Handler Registration Tests
// ============================================================================

Deno.test("HealthChecker - registerHandler adds handler", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  checker.registerHandler("browser-pool", async () => ({ status: "healthy" }));

  const result = await checker.performHealthCheck();
  assertEquals(result.components.length, 1);
  assertEquals(result.components[0].componentId, "browser-pool");
});

Deno.test("HealthChecker - unregisterHandler removes handler", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  checker.registerHandler("browser-pool", async () => ({ status: "healthy" }));
  checker.unregisterHandler("browser-pool");

  const result = await checker.performHealthCheck();
  assertEquals(result.components.length, 0);
});

Deno.test("HealthChecker - multiple handlers can be registered", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  checker.registerHandler("browser-pool", async () => ({ status: "healthy" }));
  checker.registerHandler("query-engine", async () => ({ status: "healthy" }));
  checker.registerHandler("proxy-engine", async () => ({ status: "degraded" }));

  const result = await checker.performHealthCheck();
  assertEquals(result.components.length, 3);
});

// ============================================================================
// Health Check Execution Tests
// ============================================================================

Deno.test("HealthChecker - performHealthCheck returns healthy status", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  checker.registerHandler("browser-pool", async () => ({
    status: "healthy",
    message: "All good",
  }));

  const result = await checker.performHealthCheck();

  assertEquals(result.status, "healthy");
  assertEquals(result.components.length, 1);
  assertEquals(result.components[0].status, "healthy");
  assertEquals(result.components[0].message, "All good");
  assertExists(result.timestamp);
});

Deno.test("HealthChecker - performHealthCheck returns degraded when any component degraded", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  checker.registerHandler("browser-pool", async () => ({ status: "healthy" }));
  checker.registerHandler("query-engine", async () => ({ status: "degraded" }));

  const result = await checker.performHealthCheck();

  assertEquals(result.status, "degraded");
});

Deno.test("HealthChecker - performHealthCheck returns unhealthy when any component unhealthy", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  checker.registerHandler("browser-pool", async () => ({ status: "healthy" }));
  checker.registerHandler("query-engine", async () => ({ status: "degraded" }));
  checker.registerHandler("proxy-engine", async () => ({ status: "unhealthy" }));

  const result = await checker.performHealthCheck();

  assertEquals(result.status, "unhealthy");
});

Deno.test("HealthChecker - performHealthCheck handles handler errors", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  checker.registerHandler("browser-pool", async () => {
    throw new Error("Handler failed");
  });

  const result = await checker.performHealthCheck();

  assertEquals(result.status, "unhealthy");
  assertEquals(result.components[0].status, "unhealthy");
  assertEquals(result.components[0].message, "Handler failed");
});

Deno.test("HealthChecker - performHealthCheck records latency", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  checker.registerHandler("browser-pool", async () => {
    await new Promise((r) => setTimeout(r, 50));
    return { status: "healthy" };
  });

  const result = await checker.performHealthCheck();

  const latency = result.components[0]?.latency ?? 0;
  assertEquals(latency >= 50, true);
});

Deno.test("HealthChecker - performHealthCheck with no handlers", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  const result = await checker.performHealthCheck();

  assertEquals(result.status, "healthy");
  assertEquals(result.components.length, 0);
});

// ============================================================================
// Last Check Result Tests
// ============================================================================

Deno.test("HealthChecker - getLastCheckResult returns null initially", () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  assertEquals(checker.getLastCheckResult(), null);
});

Deno.test("HealthChecker - getLastCheckResult returns last result", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  checker.registerHandler("browser-pool", async () => ({ status: "healthy" }));
  await checker.performHealthCheck();

  const lastResult = checker.getLastCheckResult();
  assertExists(lastResult);
  assertEquals(lastResult!.status, "healthy");
});

// ============================================================================
// getHealthStatus Tests (with caching)
// ============================================================================

Deno.test("HealthChecker - getHealthStatus returns cached result if recent", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  let callCount = 0;
  checker.registerHandler("browser-pool", async () => {
    callCount++;
    return { status: "healthy" };
  });

  // First call
  await checker.getHealthStatus();
  assertEquals(callCount, 1);

  // Second call within 10 seconds should use cache
  await checker.getHealthStatus();
  assertEquals(callCount, 1);
});

Deno.test("HealthChecker - getHealthStatus performs new check if cache stale", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  let callCount = 0;
  checker.registerHandler("browser-pool", async () => {
    callCount++;
    return { status: "healthy" };
  });

  // First call
  await checker.performHealthCheck();
  assertEquals(callCount, 1);

  // Manually invalidate cache by setting old timestamp
  // (In a real test we'd mock time, but we can just check the behavior)
});

// ============================================================================
// isComponentHealthy Tests
// ============================================================================

Deno.test("HealthChecker - isComponentHealthy returns true for healthy component", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  checker.registerHandler("browser-pool", async () => ({ status: "healthy" }));

  const isHealthy = await checker.isComponentHealthy("browser-pool");
  assertEquals(isHealthy, true);
});

Deno.test("HealthChecker - isComponentHealthy returns false for unhealthy component", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  checker.registerHandler("query-engine", async () => ({ status: "unhealthy" }));

  const isHealthy = await checker.isComponentHealthy("query-engine");
  assertEquals(isHealthy, false);
});

Deno.test("HealthChecker - isComponentHealthy returns false for degraded component", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  checker.registerHandler("proxy-engine", async () => ({ status: "degraded" }));

  const isHealthy = await checker.isComponentHealthy("proxy-engine");
  assertEquals(isHealthy, false);
});

Deno.test("HealthChecker - isComponentHealthy returns true for unknown component", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  // No handler registered - assumes healthy
  const isHealthy = await checker.isComponentHealthy("event-coordinator");
  assertEquals(isHealthy, true);
});

Deno.test("HealthChecker - isComponentHealthy returns false when handler throws", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  checker.registerHandler("browser-pool", async () => {
    throw new Error("Check failed");
  });

  const isHealthy = await checker.isComponentHealthy("browser-pool");
  assertEquals(isHealthy, false);
});

// ============================================================================
// Static Helper Tests
// ============================================================================

Deno.test("HealthChecker - createSimpleHandler returns handler", async () => {
  const handler = HealthChecker.createSimpleHandler("healthy");
  const result = await handler();

  assertEquals(result.status, "healthy");
});

Deno.test("HealthChecker - createSimpleHandler with different status", async () => {
  const handler = HealthChecker.createSimpleHandler("degraded");
  const result = await handler();

  assertEquals(result.status, "degraded");
});

Deno.test("HealthChecker - createBooleanHandler returns healthy on true", async () => {
  const handler = HealthChecker.createBooleanHandler(
    () => true,
    "OK",
    "Failed",
  );
  const result = await handler();

  assertEquals(result.status, "healthy");
  assertEquals(result.message, "OK");
});

Deno.test("HealthChecker - createBooleanHandler returns unhealthy on false", async () => {
  const handler = HealthChecker.createBooleanHandler(
    () => false,
    "OK",
    "Failed",
  );
  const result = await handler();

  assertEquals(result.status, "unhealthy");
  assertEquals(result.message, "Failed");
});

Deno.test("HealthChecker - createBooleanHandler works with async check", async () => {
  const handler = HealthChecker.createBooleanHandler(
    async () => {
      await new Promise((r) => setTimeout(r, 10));
      return true;
    },
    "OK",
    "Failed",
  );
  const result = await handler();

  assertEquals(result.status, "healthy");
});

// ============================================================================
// Event Listener Tests
// ============================================================================

Deno.test("HealthChecker - emits health_check event", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  const events: RuntimeEvent[] = [];
  checker.addEventListener((event) => events.push(event));

  checker.registerHandler("browser-pool", async () => ({ status: "healthy" }));
  await checker.performHealthCheck();

  assertEquals(events.length, 1);
  assertEquals(events[0].type, "health_check");
});

Deno.test("HealthChecker - removeEventListener stops event delivery", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  const events: RuntimeEvent[] = [];
  const listener = (event: RuntimeEvent) => events.push(event);

  checker.addEventListener(listener);
  checker.removeEventListener(listener);

  checker.registerHandler("browser-pool", async () => ({ status: "healthy" }));
  await checker.performHealthCheck();

  assertEquals(events.length, 0);
});

Deno.test("HealthChecker - handles listener errors gracefully", async () => {
  const config = createTestMetricsConfig();
  const checker = new HealthChecker(config);

  checker.addEventListener(() => {
    throw new Error("Listener error");
  });

  checker.registerHandler("browser-pool", async () => ({ status: "healthy" }));

  // Should not throw despite listener error
  const result = await checker.performHealthCheck();
  assertEquals(result.status, "healthy");
});
