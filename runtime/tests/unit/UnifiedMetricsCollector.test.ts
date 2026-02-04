/**
 * UnifiedMetricsCollector Unit Tests
 *
 * Comprehensive tests for metrics collection, counter/gauge/histogram operations,
 * and Prometheus/JSON export functionality.
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "@std/assert";
import { UnifiedMetricsCollector } from "../../src/metrics/UnifiedMetricsCollector.ts";
import type { MetricsConfig } from "../../src/config/RuntimeConfig.ts";
import { RuntimeState } from "../../src/types.ts";

/**
 * Create test metrics config
 */
function createTestMetricsConfig(
  overrides: Partial<MetricsConfig> = {},
): MetricsConfig {
  return {
    enabled: false, // Disable server in tests
    healthCheckInterval: 0,
    exportFormat: "json",
    ...overrides,
  };
}

// ============================================================================
// Basic Instantiation Tests
// ============================================================================

Deno.test("UnifiedMetricsCollector - instantiation with config", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  assertExists(collector);
  assertEquals(collector.isRunning(), false);
});

Deno.test("UnifiedMetricsCollector - getConfig returns copy of config", () => {
  const config = createTestMetricsConfig({ healthCheckInterval: 5000 });
  const collector = new UnifiedMetricsCollector(config);

  const retrieved = collector.getConfig();
  assertEquals(retrieved.healthCheckInterval, 5000);
});

// ============================================================================
// Start/Stop Tests
// ============================================================================

Deno.test({
  name: "UnifiedMetricsCollector - start without server (disabled)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestMetricsConfig({ enabled: false });
    const collector = new UnifiedMetricsCollector(config);

    await collector.start();
    assertEquals(collector.isRunning(), true);

    await collector.stop();
    assertEquals(collector.isRunning(), false);
  },
});

Deno.test({
  name: "UnifiedMetricsCollector - double start is idempotent",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestMetricsConfig();
    const collector = new UnifiedMetricsCollector(config);

    await collector.start();
    await collector.start(); // Should not throw
    assertEquals(collector.isRunning(), true);

    await collector.stop();
  },
});

Deno.test({
  name: "UnifiedMetricsCollector - double stop is idempotent",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestMetricsConfig();
    const collector = new UnifiedMetricsCollector(config);

    await collector.start();
    await collector.stop();
    await collector.stop(); // Should not throw
    assertEquals(collector.isRunning(), false);
  },
});

// ============================================================================
// Counter Tests
// ============================================================================

Deno.test("UnifiedMetricsCollector - incrementCounter increases value", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  // Increment a custom counter
  collector.incrementCounter("test_counter");
  collector.incrementCounter("test_counter");
  collector.incrementCounter("test_counter", 5);

  const json = collector.exportJSON();
  const counter = json.counters.find((c) => c.name === "test_counter");

  assertExists(counter);
  assertEquals(counter.value, 7);
});

Deno.test("UnifiedMetricsCollector - incrementCounter with labels", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  collector.incrementCounter("test_counter", 1, { method: "GET" });
  collector.incrementCounter("test_counter", 2, { method: "POST" });
  collector.incrementCounter("test_counter", 3, { method: "GET" });

  const json = collector.exportJSON();
  const getCounter = json.counters.find(
    (c) => c.name === "test_counter" && c.labels?.method === "GET",
  );
  const postCounter = json.counters.find(
    (c) => c.name === "test_counter" && c.labels?.method === "POST",
  );

  assertExists(getCounter);
  assertExists(postCounter);
  assertEquals(getCounter.value, 4);
  assertEquals(postCounter.value, 2);
});

Deno.test("UnifiedMetricsCollector - default counters are initialized", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  const json = collector.exportJSON();

  // Check default counters exist
  const requestsCounter = json.counters.find(
    (c) => c.name === "browserx_requests_total",
  );
  const errorsCounter = json.counters.find(
    (c) => c.name === "browserx_errors_total",
  );

  assertExists(requestsCounter);
  assertExists(errorsCounter);
  assertEquals(requestsCounter.value, 0);
  assertEquals(errorsCounter.value, 0);
});

// ============================================================================
// Gauge Tests
// ============================================================================

Deno.test("UnifiedMetricsCollector - setGauge sets value", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  collector.setGauge("test_gauge", 42);

  const json = collector.exportJSON();
  const gauge = json.gauges.find((g) => g.name === "test_gauge");

  assertExists(gauge);
  assertEquals(gauge.value, 42);
});

Deno.test("UnifiedMetricsCollector - setGauge can decrease value", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  collector.setGauge("test_gauge", 100);
  collector.setGauge("test_gauge", 50);

  const json = collector.exportJSON();
  const gauge = json.gauges.find((g) => g.name === "test_gauge");

  assertExists(gauge);
  assertEquals(gauge.value, 50);
});

Deno.test("UnifiedMetricsCollector - setGauge with labels", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  collector.setGauge("connections", 10, { pool: "main" });
  collector.setGauge("connections", 5, { pool: "backup" });

  const json = collector.exportJSON();
  const mainGauge = json.gauges.find(
    (g) => g.name === "connections" && g.labels?.pool === "main",
  );
  const backupGauge = json.gauges.find(
    (g) => g.name === "connections" && g.labels?.pool === "backup",
  );

  assertExists(mainGauge);
  assertExists(backupGauge);
  assertEquals(mainGauge.value, 10);
  assertEquals(backupGauge.value, 5);
});

Deno.test("UnifiedMetricsCollector - default gauges are initialized", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  const json = collector.exportJSON();

  // Check default gauges exist
  const runtimeStateGauge = json.gauges.find(
    (g) => g.name === "browserx_runtime_state",
  );
  const uptimeGauge = json.gauges.find(
    (g) => g.name === "browserx_uptime_seconds",
  );

  assertExists(runtimeStateGauge);
  assertExists(uptimeGauge);
});

// ============================================================================
// Histogram Tests
// ============================================================================

Deno.test("UnifiedMetricsCollector - observeHistogram records values", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  // Observe some request durations
  collector.observeHistogram("browserx_request_duration_seconds", 0.05);
  collector.observeHistogram("browserx_request_duration_seconds", 0.15);
  collector.observeHistogram("browserx_request_duration_seconds", 0.5);

  const json = collector.exportJSON();
  const histogram = json.histograms.find(
    (h) => h.name === "browserx_request_duration_seconds",
  );

  assertExists(histogram);
  assertEquals(histogram.value, 3); // count
});

Deno.test("UnifiedMetricsCollector - observeHistogram updates buckets correctly", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  // Observe values in different buckets
  collector.observeHistogram("browserx_request_duration_seconds", 0.005); // <= 0.01
  collector.observeHistogram("browserx_request_duration_seconds", 0.03); // <= 0.05
  collector.observeHistogram("browserx_request_duration_seconds", 5.0); // <= 5.0

  // Check the prometheus output for bucket distribution
  const prometheus = collector.exportPrometheus();

  assertStringIncludes(prometheus, 'browserx_request_duration_seconds_bucket{le="0.01"} 1');
  assertStringIncludes(prometheus, 'browserx_request_duration_seconds_bucket{le="0.05"} 2');
});

Deno.test("UnifiedMetricsCollector - observeHistogram ignores unknown histograms", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  // This should not throw
  collector.observeHistogram("unknown_histogram", 1.0);

  const json = collector.exportJSON();
  const unknown = json.histograms.find((h) => h.name === "unknown_histogram");

  assertEquals(unknown, undefined);
});

// ============================================================================
// Runtime State Updates
// ============================================================================

Deno.test("UnifiedMetricsCollector - updateRuntimeState sets gauge", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  collector.updateRuntimeState(RuntimeState.RUNNING);

  const json = collector.exportJSON();
  const stateGauge = json.gauges.find(
    (g) => g.name === "browserx_runtime_state",
  );

  assertExists(stateGauge);
  assertEquals(stateGauge.value, 2); // RUNNING = 2
});

Deno.test("UnifiedMetricsCollector - updateRuntimeState maps all states", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  const stateValues: Array<{ state: RuntimeState; expected: number }> = [
    { state: RuntimeState.STOPPED, expected: 0 },
    { state: RuntimeState.STARTING, expected: 1 },
    { state: RuntimeState.RUNNING, expected: 2 },
    { state: RuntimeState.STOPPING, expected: 3 },
    { state: RuntimeState.ERROR, expected: 4 },
  ];

  for (const { state, expected } of stateValues) {
    collector.updateRuntimeState(state);
    const json = collector.exportJSON();
    const stateGauge = json.gauges.find(
      (g) => g.name === "browserx_runtime_state",
    );
    assertEquals(stateGauge?.value, expected);
  }
});

Deno.test("UnifiedMetricsCollector - updateUptime sets gauge", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  collector.updateUptime(60000); // 60 seconds

  const json = collector.exportJSON();
  const uptimeGauge = json.gauges.find(
    (g) => g.name === "browserx_uptime_seconds",
  );

  assertExists(uptimeGauge);
  assertEquals(uptimeGauge.value, 60);
});

// ============================================================================
// Component Metrics Registration
// ============================================================================

Deno.test("UnifiedMetricsCollector - registerComponentMetrics adds collector", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  collector.registerComponentMetrics("browser-pool", () => ({
    pool_size: {
      name: "browser_pool_size",
      type: "gauge",
      value: 5,
      timestamp: Date.now(),
    },
  }));

  const prometheus = collector.exportPrometheus();
  assertStringIncludes(prometheus, "browser_pool_size");
});

Deno.test("UnifiedMetricsCollector - component metrics include component label", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  collector.registerComponentMetrics("query-engine", () => ({
    queries: {
      name: "query_count",
      type: "counter",
      value: 100,
      timestamp: Date.now(),
    },
  }));

  const prometheus = collector.exportPrometheus();
  assertStringIncludes(prometheus, 'component="query-engine"');
});

Deno.test("UnifiedMetricsCollector - handles component collector errors", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  collector.registerComponentMetrics("browser-pool", () => {
    throw new Error("Collector error");
  });

  // Should not throw, just log error
  const prometheus = collector.exportPrometheus();
  assertExists(prometheus);
});

// ============================================================================
// Prometheus Export Tests
// ============================================================================

Deno.test("UnifiedMetricsCollector - exportPrometheus returns valid format", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  collector.incrementCounter("test_counter", 5);
  collector.setGauge("test_gauge", 10);

  const output = collector.exportPrometheus();

  assertStringIncludes(output, "# TYPE test_counter counter");
  assertStringIncludes(output, "test_counter 5");
  assertStringIncludes(output, "# TYPE test_gauge gauge");
  assertStringIncludes(output, "test_gauge 10");
});

Deno.test("UnifiedMetricsCollector - exportPrometheus includes histogram buckets", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  collector.observeHistogram("browserx_request_duration_seconds", 0.5);

  const output = collector.exportPrometheus();

  assertStringIncludes(output, "# TYPE browserx_request_duration_seconds histogram");
  assertStringIncludes(output, "_bucket{le=");
  assertStringIncludes(output, "_sum ");
  assertStringIncludes(output, "_count ");
});

Deno.test("UnifiedMetricsCollector - exportPrometheus formats labels correctly", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  collector.incrementCounter("requests", 1, { method: "GET", path: "/api" });

  const output = collector.exportPrometheus();

  assertStringIncludes(output, 'method="GET"');
  assertStringIncludes(output, 'path="/api"');
});

// ============================================================================
// JSON Export Tests
// ============================================================================

Deno.test("UnifiedMetricsCollector - exportJSON returns structured data", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  const json = collector.exportJSON();

  assertExists(json.counters);
  assertExists(json.gauges);
  assertExists(json.histograms);
  assertEquals(Array.isArray(json.counters), true);
  assertEquals(Array.isArray(json.gauges), true);
  assertEquals(Array.isArray(json.histograms), true);
});

Deno.test("UnifiedMetricsCollector - exportJSON includes timestamps", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  collector.incrementCounter("test_counter");

  const json = collector.exportJSON();
  const counter = json.counters.find((c) => c.name === "test_counter");

  assertExists(counter);
  assertExists(counter.timestamp);
  assertEquals(typeof counter.timestamp, "number");
});

Deno.test("UnifiedMetricsCollector - exportJSON includes metric types", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  const json = collector.exportJSON();

  for (const counter of json.counters) {
    assertEquals(counter.type, "counter");
  }

  for (const gauge of json.gauges) {
    assertEquals(gauge.type, "gauge");
  }

  for (const histogram of json.histograms) {
    assertEquals(histogram.type, "histogram");
  }
});

// ============================================================================
// Event Listener Tests
// ============================================================================

Deno.test("UnifiedMetricsCollector - addEventListener and removeEventListener", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  const events: unknown[] = [];
  const listener = (event: unknown) => events.push(event);

  collector.addEventListener(listener);
  collector.removeEventListener(listener);

  // Should work without errors
  assertExists(collector);
});

// ============================================================================
// Memory Metrics Tests
// ============================================================================

Deno.test("UnifiedMetricsCollector - updateMemoryMetrics populates memory gauges", () => {
  const config = createTestMetricsConfig();
  const collector = new UnifiedMetricsCollector(config);

  collector.updateMemoryMetrics();

  const json = collector.exportJSON();

  const heapUsed = json.gauges.find(
    (g) => g.name === "browserx_memory_heap_used_bytes",
  );
  const heapTotal = json.gauges.find(
    (g) => g.name === "browserx_memory_heap_total_bytes",
  );
  const rss = json.gauges.find((g) => g.name === "browserx_memory_rss_bytes");

  assertExists(heapUsed);
  assertExists(heapTotal);
  assertExists(rss);

  // Values should be non-zero (actual memory usage)
  assertEquals(heapUsed.value > 0, true);
  assertEquals(heapTotal.value > 0, true);
  assertEquals(rss.value > 0, true);
});
