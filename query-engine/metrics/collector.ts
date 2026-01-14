/**
 * Metrics collector for query engine
 */

import { DurationMs, QueryID, TraceID } from "../types/primitives.ts";

/**
 * Metric types
 */
export enum MetricType {
  COUNTER = "COUNTER",
  GAUGE = "GAUGE",
  HISTOGRAM = "HISTOGRAM",
}

/**
 * Counter metric
 */
export interface Counter {
  name: string;
  value: number;
  labels: Record<string, string>;
}

/**
 * Gauge metric
 */
export interface Gauge {
  name: string;
  value: number;
  labels: Record<string, string>;
}

/**
 * Histogram metric
 */
export interface Histogram {
  name: string;
  values: number[];
  labels: Record<string, string>;
  buckets?: number[];
}

/**
 * Query metrics
 */
export interface QueryMetrics {
  queryId: QueryID;
  traceId?: TraceID;
  stage: string; // 'lexing', 'parsing', 'analysis', etc.
  duration: DurationMs;
  success: boolean;
  error?: string;
  timestamp: number;
}

/**
 * Metrics collector
 */
export class MetricsCollector {
  private counters: Map<string, Counter>;
  private gauges: Map<string, Gauge>;
  private histograms: Map<string, Histogram>;
  private queryMetrics: QueryMetrics[];

  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.queryMetrics = [];
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const key = this.makeKey(name, labels);
    const counter = this.counters.get(key);

    if (counter) {
      counter.value += value;
    } else {
      this.counters.set(key, {
        name,
        value,
        labels,
      });
    }
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.makeKey(name, labels);
    this.gauges.set(key, {
      name,
      value,
      labels,
    });
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.makeKey(name, labels);
    const histogram = this.histograms.get(key);

    if (histogram) {
      histogram.values.push(value);
    } else {
      this.histograms.set(key, {
        name,
        values: [value],
        labels,
      });
    }
  }

  /**
   * Record query metrics
   */
  recordQueryMetric(metric: QueryMetrics): void {
    this.queryMetrics.push(metric);

    // Also update counters and histograms
    this.incrementCounter("queries_total", {
      stage: metric.stage,
      success: String(metric.success),
    });

    this.recordHistogram("query_duration_ms", metric.duration, {
      stage: metric.stage,
    });

    if (!metric.success && metric.error) {
      this.incrementCounter("query_errors_total", {
        stage: metric.stage,
        error: metric.error,
      });
    }
  }

  /**
   * Get all counters
   */
  getCounters(): Counter[] {
    return Array.from(this.counters.values());
  }

  /**
   * Get all gauges
   */
  getGauges(): Gauge[] {
    return Array.from(this.gauges.values());
  }

  /**
   * Get all histograms
   */
  getHistograms(): Histogram[] {
    return Array.from(this.histograms.values());
  }

  /**
   * Get query metrics
   */
  getQueryMetrics(): QueryMetrics[] {
    return [...this.queryMetrics];
  }

  /**
   * Calculate histogram percentiles
   */
  getHistogramPercentiles(name: string, labels: Record<string, string> = {}): {
    p50: number;
    p95: number;
    p99: number;
  } {
    const key = this.makeKey(name, labels);
    const histogram = this.histograms.get(key);

    if (!histogram || histogram.values.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...histogram.values].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.queryMetrics = [];
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): Record<string, unknown> {
    return {
      counters: this.getCounters(),
      gauges: this.getGauges(),
      histograms: this.getHistograms().map((h) => ({
        ...h,
        count: h.values.length,
        sum: h.values.reduce((a, b) => a + b, 0),
        percentiles: this.getHistogramPercentiles(h.name, h.labels),
      })),
      queryMetrics: this.queryMetrics,
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    let output = "";

    // Export counters
    for (const counter of this.counters.values()) {
      output += `# TYPE ${counter.name} counter\n`;
      output += `${counter.name}${this.formatLabels(counter.labels)} ${counter.value}\n`;
    }

    // Export gauges
    for (const gauge of this.gauges.values()) {
      output += `# TYPE ${gauge.name} gauge\n`;
      output += `${gauge.name}${this.formatLabels(gauge.labels)} ${gauge.value}\n`;
    }

    // Export histograms
    for (const histogram of this.histograms.values()) {
      output += `# TYPE ${histogram.name} histogram\n`;
      const sum = histogram.values.reduce((a, b) => a + b, 0);
      const count = histogram.values.length;
      output += `${histogram.name}_sum${this.formatLabels(histogram.labels)} ${sum}\n`;
      output += `${histogram.name}_count${this.formatLabels(histogram.labels)} ${count}\n`;
    }

    return output;
  }

  /**
   * Make a unique key from name and labels
   */
  private makeKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");

    return `${name}{${labelStr}}`;
  }

  /**
   * Format labels for Prometheus
   */
  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);

    if (entries.length === 0) {
      return "";
    }

    const formatted = entries
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");

    return `{${formatted}}`;
  }

  /**
   * Get counters map (returns copy)
   */
  getCountersMap(): Map<string, Counter> {
    return new Map(this.counters);
  }

  /**
   * Get gauges map (returns copy)
   */
  getGaugesMap(): Map<string, Gauge> {
    return new Map(this.gauges);
  }

  /**
   * Get histograms map (returns copy)
   */
  getHistogramsMap(): Map<string, Histogram> {
    return new Map(this.histograms);
  }

  /**
   * Get total number of counters
   */
  getCounterCount(): number {
    return this.counters.size;
  }

  /**
   * Get total number of gauges
   */
  getGaugeCount(): number {
    return this.gauges.size;
  }

  /**
   * Get total number of histograms
   */
  getHistogramCount(): number {
    return this.histograms.size;
  }

  /**
   * Get total number of query metrics recorded
   */
  getQueryMetricCount(): number {
    return this.queryMetrics.length;
  }
}
