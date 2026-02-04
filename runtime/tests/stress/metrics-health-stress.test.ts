/**
 * Metrics and Health Check Stress Tests
 *
 * Tests for metrics collection and health checks under stress:
 * - High-frequency metric updates
 * - Concurrent health checks
 * - Export operations under load
 * - Memory efficiency with many metrics
 */

import {
  assertEquals,
  assertExists,
} from "@std/assert";

import { UnifiedMetricsCollector } from "../../src/metrics/UnifiedMetricsCollector.ts";
import { HealthChecker } from "../../src/metrics/HealthChecker.ts";
import { createTestConfig } from "../../src/config/RuntimeConfig.ts";
import type { ComponentId } from "../../src/types.ts";

// ============================================================================
// High-Frequency Metric Update Tests
// ============================================================================

Deno.test({
  name: "Stress - High frequency counter increments",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    await metricsCollector.start();

    // High frequency counter updates
    const iterations = 10000;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      metricsCollector.incrementCounter("stress_test_counter");
    }

    const duration = Date.now() - startTime;

    // Verify counter value
    const jsonExport = metricsCollector.exportJSON();
    const counter = jsonExport.counters.find(
      (c) => c.name === "stress_test_counter",
    );
    assertExists(counter);
    assertEquals(counter.value, iterations);

    // Performance check - should complete quickly
    assertEquals(duration < 5000, true);

    await metricsCollector.stop();
  },
});

Deno.test({
  name: "Stress - High frequency gauge updates",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    await metricsCollector.start();

    const iterations = 5000;
    const startTime = Date.now();

    // Rapidly update gauges
    for (let i = 0; i < iterations; i++) {
      metricsCollector.setGauge("stress_gauge_1", i);
      metricsCollector.setGauge("stress_gauge_2", iterations - i);
      metricsCollector.setGauge("stress_gauge_3", Math.sin(i) * 100);
    }

    const duration = Date.now() - startTime;

    // Verify final values
    const jsonExport = metricsCollector.exportJSON();
    const gauge1 = jsonExport.gauges.find((g) => g.name === "stress_gauge_1");
    assertExists(gauge1);
    assertEquals(gauge1.value, iterations - 1);

    // Performance check
    assertEquals(duration < 5000, true);

    await metricsCollector.stop();
  },
});

Deno.test({
  name: "Stress - High frequency histogram observations",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    await metricsCollector.start();

    const iterations = 5000;
    const startTime = Date.now();

    // Record many histogram observations using the pre-defined histogram
    for (let i = 0; i < iterations; i++) {
      const value = Math.random() * 1; // 0-1 seconds range
      metricsCollector.observeHistogram("browserx_request_duration_seconds", value);
    }

    const duration = Date.now() - startTime;

    // Verify histogram exists
    const jsonExport = metricsCollector.exportJSON();
    const histogram = jsonExport.histograms?.find(
      (h) => h.name === "browserx_request_duration_seconds",
    );
    assertExists(histogram);

    // Performance check
    assertEquals(duration < 5000, true);

    await metricsCollector.stop();
  },
});

// ============================================================================
// Concurrent Metric Operations Tests
// ============================================================================

Deno.test({
  name: "Stress - Concurrent counter updates from multiple 'threads'",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    await metricsCollector.start();

    const workerCount = 10;
    const incrementsPerWorker = 1000;

    const runWorker = async (workerId: number): Promise<number> => {
      let count = 0;
      for (let i = 0; i < incrementsPerWorker; i++) {
        metricsCollector.incrementCounter("concurrent_counter");
        metricsCollector.incrementCounter(`worker_${workerId}_counter`);
        count++;
      }
      return count;
    };

    // Launch all workers concurrently
    const workerPromises = Array(workerCount)
      .fill(null)
      .map((_, i) => runWorker(i));

    const results = await Promise.all(workerPromises);
    const totalIncrements = results.reduce((sum, count) => sum + count, 0);

    assertEquals(totalIncrements, workerCount * incrementsPerWorker);

    // Verify main counter
    const jsonExport = metricsCollector.exportJSON();
    const mainCounter = jsonExport.counters.find(
      (c) => c.name === "concurrent_counter",
    );
    assertExists(mainCounter);
    assertEquals(mainCounter.value, workerCount * incrementsPerWorker);

    await metricsCollector.stop();
  },
});

Deno.test({
  name: "Stress - Mixed metric operations concurrently",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    await metricsCollector.start();

    const operationCount = 1000;

    // Run different types of operations concurrently
    const counterOps = (async () => {
      for (let i = 0; i < operationCount; i++) {
        metricsCollector.incrementCounter("mixed_counter", 1, { type: "counter" });
      }
    })();

    const gaugeOps = (async () => {
      for (let i = 0; i < operationCount; i++) {
        metricsCollector.setGauge("mixed_gauge", i);
      }
    })();

    const histogramOps = (async () => {
      for (let i = 0; i < operationCount; i++) {
        metricsCollector.observeHistogram("browserx_request_duration_seconds", Math.random());
      }
    })();

    await Promise.all([counterOps, gaugeOps, histogramOps]);

    // Verify all metrics exist
    const jsonExport = metricsCollector.exportJSON();
    assertExists(jsonExport.counters.find((c) => c.name === "mixed_counter"));
    assertExists(jsonExport.gauges.find((g) => g.name === "mixed_gauge"));

    await metricsCollector.stop();
  },
});

// ============================================================================
// Health Check Stress Tests
// ============================================================================

Deno.test({
  name: "Stress - Many registered health handlers",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const healthChecker = new HealthChecker(config.metrics);

    // Register many handlers (using valid ComponentIds)
    const components: ComponentId[] = [
      "proxy-engine",
      "browser-engine",
      "query-engine",
      "event-coordinator",
      "resource-manager",
      "metrics-collector",
      "browser-pool",
    ];

    for (const id of components) {
      healthChecker.registerHandler(id, async () => ({
        status: Math.random() > 0.1 ? "healthy" : "degraded",
        message: `Component ${id} check`,
      }));
    }

    // Run many health checks
    const checkCount = 50;
    const startTime = Date.now();

    for (let i = 0; i < checkCount; i++) {
      const status = await healthChecker.performHealthCheck();
      assertExists(status);
      assertEquals(status.components.length, components.length);
    }

    const duration = Date.now() - startTime;

    // Should complete reasonably fast
    assertEquals(duration < 10000, true);
  },
});

Deno.test({
  name: "Stress - Concurrent health checks",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const healthChecker = new HealthChecker(config.metrics);

    // Register handlers with delays
    healthChecker.registerHandler("browser-pool", async () => {
      await new Promise((r) => setTimeout(r, 10));
      return { status: "healthy", message: "OK" };
    });

    healthChecker.registerHandler("event-coordinator", async () => {
      await new Promise((r) => setTimeout(r, 15));
      return { status: "healthy", message: "OK" };
    });

    healthChecker.registerHandler("metrics-collector", async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { status: "healthy", message: "OK" };
    });

    // Launch many concurrent health checks
    const concurrentChecks = 20;
    const checkPromises = Array(concurrentChecks)
      .fill(null)
      .map(() => healthChecker.performHealthCheck());

    const results = await Promise.all(checkPromises);

    // All should succeed
    assertEquals(results.length, concurrentChecks);
    for (const result of results) {
      assertEquals(result.components.length, 3);
    }
  },
});

Deno.test({
  name: "Stress - Health check with failing handlers",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const healthChecker = new HealthChecker(config.metrics);

    let callCount = 0;

    // Register handlers that sometimes fail
    healthChecker.registerHandler("browser-pool", async () => {
      callCount++;
      if (callCount % 5 === 0) {
        throw new Error("Random failure");
      }
      return { status: "healthy", message: "OK" };
    });

    healthChecker.registerHandler("event-coordinator", async () => ({
      status: "healthy",
      message: "OK",
    }));

    // Run many checks - should handle failures gracefully
    const checkCount = 30;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < checkCount; i++) {
      try {
        const status = await healthChecker.performHealthCheck();
        assertExists(status);
        if (status.status === "healthy") {
          successCount++;
        }
      } catch (_e) {
        errorCount++;
      }
    }

    // Most should succeed
    assertEquals(successCount >= checkCount * 0.5, true);
  },
});

// ============================================================================
// Export Operations Stress Tests
// ============================================================================

Deno.test({
  name: "Stress - Frequent JSON exports",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    await metricsCollector.start();

    // Create many metrics
    for (let i = 0; i < 100; i++) {
      metricsCollector.incrementCounter(`counter_${i}`);
      metricsCollector.setGauge(`gauge_${i}`, i);
    }

    // Frequent exports
    const exportCount = 100;
    const startTime = Date.now();

    for (let i = 0; i < exportCount; i++) {
      const jsonExport = metricsCollector.exportJSON();
      assertExists(jsonExport);
      assertEquals(jsonExport.counters.length >= 100, true);
    }

    const duration = Date.now() - startTime;

    // Should be fast
    assertEquals(duration < 5000, true);

    await metricsCollector.stop();
  },
});

Deno.test({
  name: "Stress - Frequent Prometheus exports",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    await metricsCollector.start();

    // Create many metrics with labels
    for (let i = 0; i < 50; i++) {
      metricsCollector.incrementCounter(`prom_counter`, 1, {
        instance: `instance_${i % 5}`,
        region: `region_${i % 3}`,
      });
      metricsCollector.setGauge(`prom_gauge_${i}`, i * 10);
    }

    // Frequent Prometheus exports
    const exportCount = 50;
    const startTime = Date.now();

    for (let i = 0; i < exportCount; i++) {
      const promExport = metricsCollector.exportPrometheus();
      assertExists(promExport);
      assertEquals(typeof promExport, "string");
      assertEquals(promExport.includes("prom_counter"), true);
    }

    const duration = Date.now() - startTime;

    // Should be fast
    assertEquals(duration < 5000, true);

    await metricsCollector.stop();
  },
});

Deno.test({
  name: "Stress - Concurrent exports while updating",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    await metricsCollector.start();

    let updatesDone = false;
    let exportsDone = false;

    // Run updates in background
    const updateTask = (async () => {
      for (let i = 0; i < 5000; i++) {
        metricsCollector.incrementCounter("concurrent_update_counter");
        metricsCollector.setGauge("concurrent_update_gauge", i);
      }
      updatesDone = true;
    })();

    // Run exports concurrently
    const exportTask = (async () => {
      for (let i = 0; i < 100; i++) {
        const jsonExport = metricsCollector.exportJSON();
        assertExists(jsonExport);
        await new Promise((r) => setTimeout(r, 10));
      }
      exportsDone = true;
    })();

    await Promise.all([updateTask, exportTask]);

    assertEquals(updatesDone, true);
    assertEquals(exportsDone, true);

    await metricsCollector.stop();
  },
});

// ============================================================================
// Memory Efficiency Tests
// ============================================================================

Deno.test({
  name: "Stress - Many unique counter names",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    await metricsCollector.start();

    // Create many unique counters
    const counterCount = 1000;
    for (let i = 0; i < counterCount; i++) {
      metricsCollector.incrementCounter(`unique_counter_${i}`);
    }

    // Export should handle all
    const jsonExport = metricsCollector.exportJSON();
    assertEquals(jsonExport.counters.length >= counterCount, true);

    await metricsCollector.stop();
  },
});

Deno.test({
  name: "Stress - Many labels per metric",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const metricsCollector = new UnifiedMetricsCollector(config.metrics);

    await metricsCollector.start();

    // Create metrics with many label combinations
    for (let region = 0; region < 10; region++) {
      for (let instance = 0; instance < 10; instance++) {
        for (let endpoint = 0; endpoint < 10; endpoint++) {
          metricsCollector.incrementCounter("labeled_counter", 1, {
            region: `region_${region}`,
            instance: `instance_${instance}`,
            endpoint: `endpoint_${endpoint}`,
          });
        }
      }
    }

    // Export should work
    const promExport = metricsCollector.exportPrometheus();
    assertExists(promExport);
    assertEquals(promExport.includes("labeled_counter"), true);

    await metricsCollector.stop();
  },
});

// ============================================================================
// Event Listener Stress Tests
// ============================================================================

Deno.test({
  name: "Stress - Many health check event listeners",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const healthChecker = new HealthChecker(config.metrics);

    const eventCounts: number[] = [];

    // Add many listeners
    for (let i = 0; i < 50; i++) {
      eventCounts[i] = 0;
      healthChecker.addEventListener(() => {
        eventCounts[i]++;
      });
    }

    healthChecker.registerHandler("browser-pool", async () => ({
      status: "healthy",
      message: "OK",
    }));

    // Run health checks
    for (let i = 0; i < 10; i++) {
      await healthChecker.performHealthCheck();
    }

    // All listeners should have received events
    const totalEvents = eventCounts.reduce((sum, count) => sum + count, 0);
    assertEquals(totalEvents >= 50, true); // At least one event per listener
  },
});

Deno.test({
  name: "Stress - Rapid listener add/remove",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    const healthChecker = new HealthChecker(config.metrics);

    healthChecker.registerHandler("browser-pool", async () => ({
      status: "healthy",
      message: "OK",
    }));

    // Rapidly add and remove listeners
    for (let i = 0; i < 100; i++) {
      const listener = () => {};
      healthChecker.addEventListener(listener);
      await healthChecker.performHealthCheck();
      healthChecker.removeEventListener(listener);
    }

    // Should still work after many add/removes
    const status = await healthChecker.performHealthCheck();
    assertExists(status);
    assertEquals(status.status, "healthy");
  },
});
