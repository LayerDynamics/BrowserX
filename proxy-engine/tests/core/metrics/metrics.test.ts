/**
 * Metrics Tests
 * Comprehensive tests for Counter, Gauge, Histogram, Summary, and MetricRegistry
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import {
  Counter,
  Gauge,
  Histogram,
  Summary,
  MetricRegistry,
  defaultRegistry,
} from "../../../core/metrics/metrics.ts";

// ============================================================================
// Counter Tests
// ============================================================================

Deno.test({
  name: "Counter - initializes with zero value",
  fn() {
    const counter = new Counter("test_counter");
    assertEquals(counter.get(), 0);
  },
});

Deno.test({
  name: "Counter - increments by 1 by default",
  fn() {
    const counter = new Counter("test_counter");
    counter.inc();
    assertEquals(counter.get(), 1);
    counter.inc();
    assertEquals(counter.get(), 2);
  },
});

Deno.test({
  name: "Counter - increments by specified amount",
  fn() {
    const counter = new Counter("test_counter");
    counter.inc(5);
    assertEquals(counter.get(), 5);
    counter.inc(10);
    assertEquals(counter.get(), 15);
  },
});

Deno.test({
  name: "Counter - throws on negative increment",
  fn() {
    const counter = new Counter("test_counter");
    assertThrows(
      () => counter.inc(-1),
      Error,
      "Counter can only increase"
    );
  },
});

Deno.test({
  name: "Counter - reset sets value to zero",
  fn() {
    const counter = new Counter("test_counter");
    counter.inc(100);
    assertEquals(counter.get(), 100);
    counter.reset();
    assertEquals(counter.get(), 0);
  },
});

Deno.test({
  name: "Counter - stores name correctly",
  fn() {
    const counter = new Counter("my_counter");
    assertEquals(counter.getName(), "my_counter");
  },
});

Deno.test({
  name: "Counter - stores labels correctly",
  fn() {
    const counter = new Counter("my_counter", { method: "GET", path: "/api" });
    const labels = counter.getLabels();
    assertEquals(labels.get("method"), "GET");
    assertEquals(labels.get("path"), "/api");
  },
});

Deno.test({
  name: "Counter - handles empty labels",
  fn() {
    const counter = new Counter("my_counter");
    const labels = counter.getLabels();
    assertEquals(labels.size, 0);
  },
});

// ============================================================================
// Gauge Tests
// ============================================================================

Deno.test({
  name: "Gauge - initializes with zero value",
  fn() {
    const gauge = new Gauge("test_gauge");
    assertEquals(gauge.get(), 0);
  },
});

Deno.test({
  name: "Gauge - set changes value",
  fn() {
    const gauge = new Gauge("test_gauge");
    gauge.set(42);
    assertEquals(gauge.get(), 42);
    gauge.set(-10);
    assertEquals(gauge.get(), -10);
  },
});

Deno.test({
  name: "Gauge - inc increments by 1 by default",
  fn() {
    const gauge = new Gauge("test_gauge");
    gauge.inc();
    assertEquals(gauge.get(), 1);
  },
});

Deno.test({
  name: "Gauge - inc increments by specified amount",
  fn() {
    const gauge = new Gauge("test_gauge");
    gauge.set(10);
    gauge.inc(5);
    assertEquals(gauge.get(), 15);
  },
});

Deno.test({
  name: "Gauge - dec decrements by 1 by default",
  fn() {
    const gauge = new Gauge("test_gauge");
    gauge.set(10);
    gauge.dec();
    assertEquals(gauge.get(), 9);
  },
});

Deno.test({
  name: "Gauge - dec decrements by specified amount",
  fn() {
    const gauge = new Gauge("test_gauge");
    gauge.set(10);
    gauge.dec(3);
    assertEquals(gauge.get(), 7);
  },
});

Deno.test({
  name: "Gauge - can go negative",
  fn() {
    const gauge = new Gauge("test_gauge");
    gauge.dec(5);
    assertEquals(gauge.get(), -5);
  },
});

Deno.test({
  name: "Gauge - reset sets value to zero",
  fn() {
    const gauge = new Gauge("test_gauge");
    gauge.set(100);
    gauge.reset();
    assertEquals(gauge.get(), 0);
  },
});

Deno.test({
  name: "Gauge - stores name and labels correctly",
  fn() {
    const gauge = new Gauge("active_connections", { server: "web-01" });
    assertEquals(gauge.getName(), "active_connections");
    assertEquals(gauge.getLabels().get("server"), "web-01");
  },
});

// ============================================================================
// Histogram Tests
// ============================================================================

Deno.test({
  name: "Histogram - initializes with empty buckets",
  fn() {
    const histogram = new Histogram("request_duration", [0.1, 0.5, 1, 5]);
    assertEquals(histogram.getCount(), 0);
    assertEquals(histogram.getSum(), 0);
  },
});

Deno.test({
  name: "Histogram - observe updates count and sum",
  fn() {
    const histogram = new Histogram("request_duration", [0.1, 0.5, 1, 5]);
    histogram.observe(0.25);
    assertEquals(histogram.getCount(), 1);
    assertEquals(histogram.getSum(), 0.25);
  },
});

Deno.test({
  name: "Histogram - observe increments appropriate buckets",
  fn() {
    const histogram = new Histogram("request_duration", [1, 5, 10]);
    histogram.observe(3); // Should be in buckets 5, 10, and +Inf

    const buckets = histogram.getBuckets();
    assertEquals(buckets.get(1), 0); // 3 > 1, not in this bucket
    assertEquals(buckets.get(5), 1); // 3 <= 5
    assertEquals(buckets.get(10), 1); // 3 <= 10
    assertEquals(buckets.get(Infinity), 1); // Always in +Inf
  },
});

Deno.test({
  name: "Histogram - multiple observations accumulate",
  fn() {
    const histogram = new Histogram("request_duration", [1, 5, 10]);
    histogram.observe(0.5);
    histogram.observe(2);
    histogram.observe(7);
    histogram.observe(15);

    assertEquals(histogram.getCount(), 4);
    assertEquals(histogram.getSum(), 0.5 + 2 + 7 + 15);

    const buckets = histogram.getBuckets();
    assertEquals(buckets.get(1), 1); // Only 0.5 <= 1
    assertEquals(buckets.get(5), 2); // 0.5 and 2 <= 5
    assertEquals(buckets.get(10), 3); // 0.5, 2, and 7 <= 10
    assertEquals(buckets.get(Infinity), 4); // All values
  },
});

Deno.test({
  name: "Histogram - getAverage calculates correctly",
  fn() {
    const histogram = new Histogram("request_duration", [1, 5, 10]);
    histogram.observe(10);
    histogram.observe(20);
    histogram.observe(30);

    assertEquals(histogram.getAverage(), 20);
  },
});

Deno.test({
  name: "Histogram - getAverage returns 0 for empty histogram",
  fn() {
    const histogram = new Histogram("request_duration", [1, 5, 10]);
    assertEquals(histogram.getAverage(), 0);
  },
});

Deno.test({
  name: "Histogram - reset clears all data",
  fn() {
    const histogram = new Histogram("request_duration", [1, 5, 10]);
    histogram.observe(3);
    histogram.observe(7);

    histogram.reset();

    assertEquals(histogram.getCount(), 0);
    assertEquals(histogram.getSum(), 0);

    const buckets = histogram.getBuckets();
    assertEquals(buckets.get(1), 0);
    assertEquals(buckets.get(5), 0);
    assertEquals(buckets.get(10), 0);
    assertEquals(buckets.get(Infinity), 0);
  },
});

Deno.test({
  name: "Histogram - buckets are sorted",
  fn() {
    const histogram = new Histogram("test", [10, 1, 5]); // Unsorted input
    const buckets = histogram.getBuckets();
    const keys = Array.from(buckets.keys()).filter((k) => k !== Infinity);

    // Check buckets are sorted
    for (let i = 1; i < keys.length; i++) {
      assert(keys[i] > keys[i - 1], "Buckets should be sorted");
    }
  },
});

Deno.test({
  name: "Histogram - stores name and labels",
  fn() {
    const histogram = new Histogram("latency", [1, 5], { endpoint: "/api/users" });
    assertEquals(histogram.getName(), "latency");
    assertEquals(histogram.getLabels().get("endpoint"), "/api/users");
  },
});

// ============================================================================
// Summary Tests
// ============================================================================

Deno.test({
  name: "Summary - initializes with empty observations",
  fn() {
    const summary = new Summary("request_latency");
    assertEquals(summary.getCount(), 0);
    assertEquals(summary.getSum(), 0);
  },
});

Deno.test({
  name: "Summary - observe updates count and sum",
  fn() {
    const summary = new Summary("request_latency");
    summary.observe(100);
    assertEquals(summary.getCount(), 1);
    assertEquals(summary.getSum(), 100);
  },
});

Deno.test({
  name: "Summary - multiple observations accumulate",
  fn() {
    const summary = new Summary("request_latency");
    summary.observe(10);
    summary.observe(20);
    summary.observe(30);

    assertEquals(summary.getCount(), 3);
    assertEquals(summary.getSum(), 60);
  },
});

Deno.test({
  name: "Summary - quantile returns correct values",
  fn() {
    const summary = new Summary("request_latency");
    // Add values 1-10
    for (let i = 1; i <= 10; i++) {
      summary.observe(i);
    }

    // p50 should be around 5
    const p50 = summary.quantile(0.5);
    assert(p50 >= 4 && p50 <= 6, `p50 should be around 5, got ${p50}`);
  },
});

Deno.test({
  name: "Summary - p50 p95 p99 methods work",
  fn() {
    const summary = new Summary("request_latency");
    // Add values 1-100
    for (let i = 1; i <= 100; i++) {
      summary.observe(i);
    }

    const p50 = summary.p50();
    const p95 = summary.p95();
    const p99 = summary.p99();

    // p50 should be around 50
    assert(p50 >= 45 && p50 <= 55, `p50 should be around 50, got ${p50}`);
    // p95 should be around 95
    assert(p95 >= 90 && p95 <= 100, `p95 should be around 95, got ${p95}`);
    // p99 should be around 99
    assert(p99 >= 95 && p99 <= 100, `p99 should be around 99, got ${p99}`);
  },
});

Deno.test({
  name: "Summary - quantile throws on invalid value",
  fn() {
    const summary = new Summary("request_latency");
    summary.observe(1);

    assertThrows(
      () => summary.quantile(-0.1),
      Error,
      "Quantile must be between 0 and 1"
    );

    assertThrows(
      () => summary.quantile(1.1),
      Error,
      "Quantile must be between 0 and 1"
    );
  },
});

Deno.test({
  name: "Summary - quantile returns 0 for empty summary",
  fn() {
    const summary = new Summary("request_latency");
    assertEquals(summary.quantile(0.5), 0);
  },
});

Deno.test({
  name: "Summary - getAverage calculates correctly",
  fn() {
    const summary = new Summary("request_latency");
    summary.observe(10);
    summary.observe(20);
    summary.observe(30);

    assertEquals(summary.getAverage(), 20);
  },
});

Deno.test({
  name: "Summary - reset clears all data",
  fn() {
    const summary = new Summary("request_latency");
    summary.observe(100);
    summary.observe(200);

    summary.reset();

    assertEquals(summary.getCount(), 0);
    assertEquals(summary.getSum(), 0);
    assertEquals(summary.quantile(0.5), 0);
  },
});

Deno.test({
  name: "Summary - stores name and labels",
  fn() {
    const summary = new Summary("latency", { labels: { service: "api" } });
    assertEquals(summary.getName(), "latency");
    assertEquals(summary.getLabels().get("service"), "api");
  },
});

Deno.test({
  name: "Summary - respects maxSize option",
  fn() {
    const summary = new Summary("latency", { maxSize: 5 });

    // Add more than maxSize observations
    for (let i = 1; i <= 10; i++) {
      summary.observe(i);
    }

    // Count and sum still reflect all observations
    assertEquals(summary.getCount(), 10);
    assertEquals(summary.getSum(), 55); // 1+2+...+10 = 55

    // But quantile calculations use only recent maxSize observations (6-10)
    const p50 = summary.p50();
    assert(p50 >= 6 && p50 <= 10, `p50 should be in recent values, got ${p50}`);
  },
});

// ============================================================================
// MetricRegistry Tests
// ============================================================================

Deno.test({
  name: "MetricRegistry - counter creates and retrieves counter",
  fn() {
    const registry = new MetricRegistry();
    const counter = registry.counter("http_requests");

    assertExists(counter);
    assertEquals(counter.getName(), "http_requests");

    counter.inc();
    assertEquals(counter.get(), 1);
  },
});

Deno.test({
  name: "MetricRegistry - counter returns same instance for same name",
  fn() {
    const registry = new MetricRegistry();
    const counter1 = registry.counter("http_requests");
    const counter2 = registry.counter("http_requests");

    // Should be the same instance
    counter1.inc();
    assertEquals(counter2.get(), 1);
  },
});

Deno.test({
  name: "MetricRegistry - counter with different labels returns different instances",
  fn() {
    const registry = new MetricRegistry();
    const counter1 = registry.counter("http_requests", { method: "GET" });
    const counter2 = registry.counter("http_requests", { method: "POST" });

    counter1.inc();

    assertEquals(counter1.get(), 1);
    assertEquals(counter2.get(), 0);
  },
});

Deno.test({
  name: "MetricRegistry - gauge creates and retrieves gauge",
  fn() {
    const registry = new MetricRegistry();
    const gauge = registry.gauge("active_connections");

    assertExists(gauge);
    gauge.set(42);
    assertEquals(gauge.get(), 42);
  },
});

Deno.test({
  name: "MetricRegistry - histogram creates and retrieves histogram",
  fn() {
    const registry = new MetricRegistry();
    const histogram = registry.histogram("request_duration", [0.1, 0.5, 1]);

    assertExists(histogram);
    histogram.observe(0.25);
    assertEquals(histogram.getCount(), 1);
  },
});

Deno.test({
  name: "MetricRegistry - summary creates and retrieves summary",
  fn() {
    const registry = new MetricRegistry();
    const summary = registry.summary("latency");

    assertExists(summary);
    summary.observe(100);
    assertEquals(summary.getCount(), 1);
  },
});

Deno.test({
  name: "MetricRegistry - getCounters returns all counters",
  fn() {
    const registry = new MetricRegistry();
    registry.counter("counter1");
    registry.counter("counter2");
    registry.counter("counter3");

    const counters = registry.getCounters();
    assertEquals(counters.length, 3);
  },
});

Deno.test({
  name: "MetricRegistry - getGauges returns all gauges",
  fn() {
    const registry = new MetricRegistry();
    registry.gauge("gauge1");
    registry.gauge("gauge2");

    const gauges = registry.getGauges();
    assertEquals(gauges.length, 2);
  },
});

Deno.test({
  name: "MetricRegistry - getHistograms returns all histograms",
  fn() {
    const registry = new MetricRegistry();
    registry.histogram("hist1", [1, 5, 10]);
    registry.histogram("hist2", [1, 5, 10]);

    const histograms = registry.getHistograms();
    assertEquals(histograms.length, 2);
  },
});

Deno.test({
  name: "MetricRegistry - getSummaries returns all summaries",
  fn() {
    const registry = new MetricRegistry();
    registry.summary("sum1");
    registry.summary("sum2");

    const summaries = registry.getSummaries();
    assertEquals(summaries.length, 2);
  },
});

Deno.test({
  name: "MetricRegistry - reset resets all metrics",
  fn() {
    const registry = new MetricRegistry();
    const counter = registry.counter("test_counter");
    const gauge = registry.gauge("test_gauge");
    const histogram = registry.histogram("test_histogram", [1, 5, 10]);
    const summary = registry.summary("test_summary");

    counter.inc(10);
    gauge.set(50);
    histogram.observe(3);
    summary.observe(100);

    registry.reset();

    assertEquals(counter.get(), 0);
    assertEquals(gauge.get(), 0);
    assertEquals(histogram.getCount(), 0);
    assertEquals(summary.getCount(), 0);
  },
});

Deno.test({
  name: "MetricRegistry - clear removes all metrics",
  fn() {
    const registry = new MetricRegistry();
    registry.counter("counter1");
    registry.gauge("gauge1");
    registry.histogram("histogram1", [1, 5, 10]);
    registry.summary("summary1");

    registry.clear();

    assertEquals(registry.getCounters().length, 0);
    assertEquals(registry.getGauges().length, 0);
    assertEquals(registry.getHistograms().length, 0);
    assertEquals(registry.getSummaries().length, 0);
  },
});

Deno.test({
  name: "MetricRegistry - labels sorted consistently in key",
  fn() {
    const registry = new MetricRegistry();

    // Register with labels in different order
    const counter1 = registry.counter("test", { b: "2", a: "1" });
    const counter2 = registry.counter("test", { a: "1", b: "2" });

    // Should be the same metric
    counter1.inc();
    assertEquals(counter2.get(), 1);
  },
});

// ============================================================================
// Default Registry Tests
// ============================================================================

Deno.test({
  name: "defaultRegistry - is a MetricRegistry instance",
  fn() {
    assertExists(defaultRegistry);
    assert(defaultRegistry instanceof MetricRegistry);
  },
});

Deno.test({
  name: "defaultRegistry - can create metrics",
  fn() {
    // Clear first to ensure clean state
    defaultRegistry.clear();

    const counter = defaultRegistry.counter("global_counter");
    counter.inc();
    assertEquals(counter.get(), 1);

    // Clean up
    defaultRegistry.clear();
  },
});
