/**
 * Metrics and Health Integration Tests
 *
 * Tests for integration between:
 * - UnifiedMetricsCollector and other components
 * - HealthChecker and component state
 * - Cross-component metric collection
 */

import {
  assertEquals,
  assertExists,
} from "@std/assert";

import { UnifiedMetricsCollector } from "../../src/metrics/UnifiedMetricsCollector.ts";
import { HealthChecker } from "../../src/metrics/HealthChecker.ts";
import { LifecycleManager } from "../../src/lifecycle/LifecycleManager.ts";
import { EventCoordinator } from "../../src/events/EventCoordinator.ts";
import { BrowserPool, type BrowserInstance } from "../../src/resources/BrowserPool.ts";
import { RuntimeState, type ComponentId } from "../../src/types.ts";
import { createTestConfig } from "../../src/config/RuntimeConfig.ts";

// ============================================================================
// Metrics and LifecycleManager Integration
// ============================================================================

Deno.test({
  name: "Integration - MetricsCollector tracks lifecycle state changes",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    await metricsCollector.start();

    // Track state changes
    metricsCollector.updateRuntimeState(RuntimeState.STOPPED);
    metricsCollector.updateRuntimeState(RuntimeState.STARTING);
    metricsCollector.updateRuntimeState(RuntimeState.RUNNING);
    metricsCollector.updateRuntimeState(RuntimeState.STOPPING);
    metricsCollector.updateRuntimeState(RuntimeState.STOPPED);

    // Export and verify metrics include state info
    const jsonExport = metricsCollector.exportJSON();
    assertExists(jsonExport);
    assertExists(jsonExport.gauges);

    await metricsCollector.stop();
  },
});

Deno.test({
  name: "Integration - MetricsCollector records component metrics",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);
    const lifecycleManager = new LifecycleManager();

    await metricsCollector.start();

    // Register components
    const components: ComponentId[] = [
      "browser-pool",
      "event-coordinator",
      "metrics-collector",
    ];

    for (const componentId of components) {
      lifecycleManager.registerComponent(componentId);
      metricsCollector.registerComponentMetrics(componentId, () => ({
        [`${componentId}_state`]: {
          name: `${componentId}_state`,
          type: "gauge" as const,
          value: lifecycleManager.getComponentState(componentId)?.state === RuntimeState.RUNNING ? 1 : 0,
          timestamp: Date.now(),
        },
      }));
    }

    // Update component states and record metrics
    for (const componentId of components) {
      lifecycleManager.updateComponentState(componentId, RuntimeState.STARTING);
      metricsCollector.incrementCounter("component_state_transitions", 1, {
        component: componentId,
        to: RuntimeState.STARTING,
      });

      lifecycleManager.updateComponentState(componentId, RuntimeState.RUNNING);
      metricsCollector.incrementCounter("component_state_transitions", 1, {
        component: componentId,
        to: RuntimeState.RUNNING,
      });
    }

    // Verify all components are running
    assertEquals(lifecycleManager.allComponentsInState(RuntimeState.RUNNING), true);

    // Verify metrics were recorded
    const jsonExport = metricsCollector.exportJSON();
    const transitionCounters = jsonExport.counters.filter(
      (c) => c.name.startsWith("component_state_transitions"),
    );
    assertEquals(transitionCounters.length >= 1, true);

    await metricsCollector.stop();
  },
});

// ============================================================================
// HealthChecker and Component State Integration
// ============================================================================

Deno.test({
  name: "Integration - HealthChecker reflects component health states",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const healthChecker = new HealthChecker(config.metrics);
    const lifecycleManager = new LifecycleManager();

    // Register components
    lifecycleManager.registerComponent("browser-pool");
    lifecycleManager.registerComponent("event-coordinator");
    lifecycleManager.registerComponent("metrics-collector");

    // Register health handlers that check lifecycle state
    healthChecker.registerHandler("browser-pool", async () => {
      const state = lifecycleManager.getComponentState("browser-pool");
      return {
        status: state?.state === RuntimeState.RUNNING ? "healthy" : "unhealthy",
        message: `State: ${state?.state}`,
      };
    });

    healthChecker.registerHandler("event-coordinator", async () => {
      const state = lifecycleManager.getComponentState("event-coordinator");
      return {
        status: state?.state === RuntimeState.RUNNING ? "healthy" : "unhealthy",
        message: `State: ${state?.state}`,
      };
    });

    healthChecker.registerHandler("metrics-collector", async () => {
      const state = lifecycleManager.getComponentState("metrics-collector");
      return {
        status: state?.state === RuntimeState.RUNNING ? "healthy" : "unhealthy",
        message: `State: ${state?.state}`,
      };
    });

    // Initially unhealthy (stopped)
    let status = await healthChecker.performHealthCheck();
    assertEquals(status.status, "unhealthy");

    // Start components
    lifecycleManager.updateComponentState("browser-pool", RuntimeState.RUNNING);
    lifecycleManager.updateComponentState("event-coordinator", RuntimeState.RUNNING);
    lifecycleManager.updateComponentState("metrics-collector", RuntimeState.RUNNING);

    // Force a new check
    status = await healthChecker.performHealthCheck();
    assertEquals(status.status, "healthy");

    // Stop one component
    lifecycleManager.updateComponentState("browser-pool", RuntimeState.STOPPED);

    status = await healthChecker.performHealthCheck();
    // Should be unhealthy due to stopped browser-pool
    assertEquals(status.status === "unhealthy" || status.status === "degraded", true);
  },
});

Deno.test({
  name: "Integration - HealthChecker emits events on status change",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const healthChecker = new HealthChecker(config.metrics);

    let isHealthy = true;

    healthChecker.registerHandler("browser-pool", async () => ({
      status: isHealthy ? "healthy" : "unhealthy",
      message: isHealthy ? "OK" : "Failed",
    }));

    const events: unknown[] = [];
    healthChecker.addEventListener((event) => {
      events.push(event);
    });

    // Initial check - healthy
    await healthChecker.performHealthCheck();

    // Change to unhealthy
    isHealthy = false;
    await healthChecker.performHealthCheck();

    // Should have some health check events
    assertEquals(events.length >= 1, true);
  },
});

// ============================================================================
// BrowserPool and Metrics Integration
// ============================================================================

Deno.test({
  name: "Integration - BrowserPool stats available for metrics",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    config.browser.maxInstances = 5;
    config.browser.minInstances = 0;

    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    await eventCoordinator.start();
    await browserPool.start();
    await metricsCollector.start();

    // Get pool stats and record as metrics
    const stats = browserPool.getStats();

    metricsCollector.setGauge("browser_pool_total", stats.totalInstances);
    metricsCollector.setGauge("browser_pool_idle", stats.idleInstances);
    metricsCollector.setGauge("browser_pool_in_use", stats.inUseInstances);
    metricsCollector.setGauge("browser_pool_max", stats.maxInstances);

    // Export and verify
    const jsonExport = metricsCollector.exportJSON();
    const poolGauges = jsonExport.gauges.filter((g) =>
      g.name.startsWith("browser_pool_")
    );

    assertEquals(poolGauges.length >= 4, true);

    await browserPool.stop();
    await eventCoordinator.stop();
    await metricsCollector.stop();
  },
});

Deno.test({
  name: "Integration - BrowserPool health contributes to overall health",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    config.browser.maxInstances = 2;
    config.browser.minInstances = 0;

    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);
    const healthChecker = new HealthChecker(config.metrics);

    await eventCoordinator.start();
    await browserPool.start();

    // Register browser pool health handler
    healthChecker.registerHandler("browser-pool", async () => {
      const stats = browserPool.getStats();
      const hasCapacity =
        stats.idleInstances > 0 || stats.totalInstances < stats.maxInstances;

      return {
        status: hasCapacity ? "healthy" : "degraded",
        message: `${stats.idleInstances} idle, ${stats.inUseInstances} in use, max ${stats.maxInstances}`,
      };
    });

    // Initially should be healthy (has capacity)
    let status = await healthChecker.performHealthCheck();
    assertEquals(status.status, "healthy");

    // Acquire all instances
    const instances: BrowserInstance[] = [];
    for (let i = 0; i < 2; i++) {
      const instance = await browserPool.acquire({ timeout: 100 });
      if (instance) {
        instances.push(instance);
      }
    }

    // Perform new health check
    status = await healthChecker.performHealthCheck();
    assertEquals(status.status === "degraded" || status.status === "unhealthy", true);

    // Release instances
    for (const instance of instances) {
      browserPool.release(instance.id);
    }

    // Perform new health check
    status = await healthChecker.performHealthCheck();
    assertEquals(status.status, "healthy");

    await browserPool.stop();
    await eventCoordinator.stop();
  },
});

// ============================================================================
// EventCoordinator and Metrics Integration
// ============================================================================

Deno.test({
  name: "Integration - EventCoordinator stats available for metrics",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    await eventCoordinator.start();
    await metricsCollector.start();

    // Get event loop stats
    const stats = eventCoordinator.getStats();

    metricsCollector.setGauge(
      "event_loop_proxy_running",
      stats.proxyLoopRunning ? 1 : 0,
    );
    metricsCollector.setGauge("event_loop_browser_count", stats.browserLoopsActive);
    metricsCollector.setGauge("event_loop_proxy_tasks", stats.proxyTasksQueued);
    metricsCollector.setGauge("event_loop_proxy_timers", stats.proxyTimersActive);

    // Export and verify
    const jsonExport = metricsCollector.exportJSON();
    const eventLoopGauges = jsonExport.gauges.filter((g) =>
      g.name.startsWith("event_loop_")
    );

    assertEquals(eventLoopGauges.length >= 4, true);

    await eventCoordinator.stop();
    await metricsCollector.stop();
  },
});

Deno.test({
  name: "Integration - EventCoordinator health check",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const healthChecker = new HealthChecker(config.metrics);

    // Register event coordinator health handler
    healthChecker.registerHandler(
      "event-coordinator",
      HealthChecker.createBooleanHandler(
        () => eventCoordinator.isRunning(),
        "Event coordinator running",
        "Event coordinator not running",
      ),
    );

    // Initially unhealthy (not running)
    let status = await healthChecker.performHealthCheck();
    assertEquals(status.status, "unhealthy");

    // Start coordinator
    await eventCoordinator.start();

    // Now should be healthy
    status = await healthChecker.performHealthCheck();
    assertEquals(status.status, "healthy");

    // Stop coordinator
    await eventCoordinator.stop();

    // Should be unhealthy again
    status = await healthChecker.performHealthCheck();
    assertEquals(status.status, "unhealthy");
  },
});

// ============================================================================
// Cross-Component Metrics Integration
// ============================================================================

Deno.test({
  name: "Integration - Full system metrics collection",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();

    const lifecycleManager = new LifecycleManager();
    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    // Register components
    const components: ComponentId[] = [
      "event-coordinator",
      "browser-pool",
      "metrics-collector",
    ];
    for (const id of components) {
      lifecycleManager.registerComponent(id);
      metricsCollector.registerComponentMetrics(id, () => ({
        [`${id}_state`]: {
          name: `${id}_state`,
          type: "gauge" as const,
          value: lifecycleManager.getComponentState(id)?.state === RuntimeState.RUNNING ? 1 : 0,
          timestamp: Date.now(),
        },
      }));
    }

    // Start all components
    await metricsCollector.start();
    lifecycleManager.updateComponentState("metrics-collector", RuntimeState.RUNNING);

    await eventCoordinator.start();
    lifecycleManager.updateComponentState("event-coordinator", RuntimeState.RUNNING);

    await browserPool.start();
    lifecycleManager.updateComponentState("browser-pool", RuntimeState.RUNNING);

    // Collect metrics from all components
    const poolStats = browserPool.getStats();
    const eventLoopStats = eventCoordinator.getStats();

    metricsCollector.setGauge("browser_pool_total", poolStats.totalInstances);
    metricsCollector.setGauge("browser_pool_idle", poolStats.idleInstances);
    metricsCollector.setGauge("event_loop_active", eventLoopStats.browserLoopsActive);
    metricsCollector.incrementCounter("system_operations", 1, { type: "metrics_collect" });

    // Get lifecycle summary
    const summary = lifecycleManager.getSummary();
    metricsCollector.setGauge("components_total", summary.componentCount);
    metricsCollector.setGauge("components_running", summary.runningComponents);

    // Export all metrics
    const jsonExport = metricsCollector.exportJSON();
    const prometheusExport = metricsCollector.exportPrometheus();

    // Verify comprehensive metrics
    assertEquals(jsonExport.counters.length >= 1, true);
    assertEquals(jsonExport.gauges.length >= 4, true);
    assertEquals(prometheusExport.includes("browser_pool"), true);
    assertEquals(prometheusExport.includes("components"), true);

    // Shutdown
    await browserPool.stop();
    await eventCoordinator.stop();
    await metricsCollector.stop();
  },
});

// ============================================================================
// Health Check Aggregation Integration
// ============================================================================

Deno.test({
  name: "Integration - Aggregate health from multiple components",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const healthChecker = new HealthChecker(config.metrics);
    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    // Start components
    await metricsCollector.start();
    await eventCoordinator.start();
    await browserPool.start();

    // Register all health handlers
    healthChecker.registerHandler(
      "metrics-collector",
      HealthChecker.createBooleanHandler(
        () => metricsCollector.isRunning(),
        "Metrics collector OK",
        "Metrics collector not running",
      ),
    );

    healthChecker.registerHandler(
      "event-coordinator",
      HealthChecker.createBooleanHandler(
        () => eventCoordinator.isRunning(),
        "Event coordinator OK",
        "Event coordinator not running",
      ),
    );

    healthChecker.registerHandler("browser-pool", async () => {
      const stats = browserPool.getStats();
      return {
        status: stats.totalInstances <= stats.maxInstances ? "healthy" : "degraded",
        message: `${stats.totalInstances}/${stats.maxInstances} instances`,
      };
    });

    // All healthy
    let status = await healthChecker.performHealthCheck();
    assertEquals(status.status, "healthy");
    assertEquals(status.components.length, 3);

    // Stop one component
    await eventCoordinator.stop();

    // Should now be unhealthy
    status = await healthChecker.performHealthCheck();
    assertEquals(status.status === "unhealthy" || status.status === "degraded", true);

    // Find the unhealthy component
    const unhealthyComponent = status.components.find(
      (c) => c.componentId === "event-coordinator",
    );
    assertExists(unhealthyComponent);
    assertEquals(unhealthyComponent!.status, "unhealthy");

    // Cleanup
    await browserPool.stop();
    await metricsCollector.stop();
  },
});

// ============================================================================
// Periodic Health Check Integration
// ============================================================================

Deno.test({
  name: "Integration - Periodic health checks update metrics",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    config.metrics.healthCheckInterval = 100; // Fast interval for testing

    const healthChecker = new HealthChecker(config.metrics);
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    await metricsCollector.start();

    healthChecker.registerHandler("browser-pool", async () => ({
      status: "healthy",
      message: "OK",
    }));

    healthChecker.registerHandler("event-coordinator", async () => ({
      status: "healthy",
      message: "OK",
    }));

    // Start periodic checks
    healthChecker.start();

    // Wait for a few check cycles
    await new Promise((r) => setTimeout(r, 350));

    // Record health metrics
    const lastResult = healthChecker.getLastCheckResult();
    if (lastResult) {
      metricsCollector.setGauge(
        "health_check_status",
        lastResult.status === "healthy" ? 1 : 0,
      );
      metricsCollector.setGauge(
        "health_check_components",
        lastResult.components.length,
      );
    }

    // Stop periodic checks
    healthChecker.stop();

    // Verify metrics
    const jsonExport = metricsCollector.exportJSON();
    const healthGauges = jsonExport.gauges.filter((g) =>
      g.name.startsWith("health_check_")
    );
    assertEquals(healthGauges.length >= 2, true);

    await metricsCollector.stop();
  },
});
