/**
 * Unified Metrics Collector
 *
 * Collects and aggregates metrics from all BrowserX Runtime components.
 * Provides metrics export in Prometheus and JSON formats.
 */

import type {
  ComponentId,
  MemoryStats,
  QueryStats,
  ResourceStats,
  RuntimeEvent,
  RuntimeEventListener,
  RuntimeStats,
} from "../types.ts";
import { RuntimeState } from "../types.ts";
import type { MetricsConfig } from "../config/RuntimeConfig.ts";

/**
 * Metric types
 */
export type MetricType = "counter" | "gauge" | "histogram";

/**
 * Metric value
 */
export interface MetricValue {
  name: string;
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
  help?: string;
}

/**
 * Histogram bucket
 */
interface HistogramBucket {
  le: number;
  count: number;
}

/**
 * Histogram metric
 */
interface Histogram {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

/**
 * Unified Metrics Collector
 *
 * Collects metrics from all runtime components.
 */
export class UnifiedMetricsCollector {
  private config: MetricsConfig;
  private eventListeners: RuntimeEventListener[] = [];
  private metricsServer?: Deno.HttpServer;
  private started = false;

  // Counters
  private counters: Map<string, number> = new Map();

  // Gauges
  private gauges: Map<string, number> = new Map();

  // Histograms
  private histograms: Map<string, Histogram> = new Map();

  // Component metrics collectors
  private componentMetricsCollectors: Map<
    ComponentId,
    () => Record<string, MetricValue>
  > = new Map();

  constructor(config: MetricsConfig) {
    this.config = config;
    this.initializeMetrics();
  }

  /**
   * Initialize default metrics
   */
  private initializeMetrics(): void {
    // Runtime counters
    this.counters.set("browserx_requests_total", 0);
    this.counters.set("browserx_errors_total", 0);
    this.counters.set("browserx_browser_sessions_created_total", 0);
    this.counters.set("browserx_browser_sessions_closed_total", 0);

    // Runtime gauges
    this.gauges.set("browserx_runtime_state", 0);
    this.gauges.set("browserx_uptime_seconds", 0);
    this.gauges.set("browserx_browser_instances", 0);
    this.gauges.set("browserx_active_sessions", 0);
    this.gauges.set("browserx_event_loops_active", 0);

    // Memory gauges
    this.gauges.set("browserx_memory_heap_used_bytes", 0);
    this.gauges.set("browserx_memory_heap_total_bytes", 0);
    this.gauges.set("browserx_memory_rss_bytes", 0);

    // Request latency histogram
    this.histograms.set("browserx_request_duration_seconds", {
      buckets: [
        { le: 0.01, count: 0 },
        { le: 0.05, count: 0 },
        { le: 0.1, count: 0 },
        { le: 0.25, count: 0 },
        { le: 0.5, count: 0 },
        { le: 1.0, count: 0 },
        { le: 2.5, count: 0 },
        { le: 5.0, count: 0 },
        { le: 10.0, count: 0 },
        { le: Infinity, count: 0 },
      ],
      sum: 0,
      count: 0,
    });
  }

  /**
   * Start the metrics collector
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;

    if (this.config.enabled && this.config.port) {
      await this.startMetricsServer();
    }
  }

  /**
   * Start the metrics HTTP server
   */
  private async startMetricsServer(): Promise<void> {
    const port = this.config.port!;
    const hostname = this.config.host ?? "127.0.0.1";

    const handler = (request: Request): Response => {
      const url = new URL(request.url);

      if (url.pathname === "/metrics") {
        const metrics = this.exportPrometheus();
        return new Response(metrics, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
          },
        });
      } else if (url.pathname === "/metrics/json") {
        const metrics = this.exportJSON();
        return new Response(JSON.stringify(metrics, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      } else {
        return new Response("Not Found\n\nAvailable endpoints:\n  /metrics\n  /metrics/json", {
          status: 404,
        });
      }
    };

    try {
      this.metricsServer = Deno.serve({ port, hostname }, handler);
      console.log(`[Metrics] Server listening on http://${hostname}:${port}/metrics`);
    } catch (error) {
      console.error("[Metrics] Failed to start metrics server:", error);
    }
  }

  /**
   * Stop the metrics collector
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    if (this.metricsServer) {
      try {
        await this.metricsServer.shutdown();
      } catch (error) {
        console.error("[Metrics] Error stopping metrics server:", error);
      }
      this.metricsServer = undefined;
    }

    this.started = false;
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, value = 1, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + value);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, value);
  }

  /**
   * Observe a histogram value
   */
  observeHistogram(name: string, value: number): void {
    const histogram = this.histograms.get(name);
    if (!histogram) {
      return;
    }

    histogram.sum += value;
    histogram.count++;

    for (const bucket of histogram.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }
  }

  /**
   * Update memory metrics
   */
  updateMemoryMetrics(): void {
    const memoryUsage = Deno.memoryUsage();

    this.setGauge("browserx_memory_heap_used_bytes", memoryUsage.heapUsed);
    this.setGauge("browserx_memory_heap_total_bytes", memoryUsage.heapTotal);
    this.setGauge("browserx_memory_rss_bytes", memoryUsage.rss);
  }

  /**
   * Update runtime state metric
   */
  updateRuntimeState(state: RuntimeState): void {
    const stateValue = {
      [RuntimeState.STOPPED]: 0,
      [RuntimeState.STARTING]: 1,
      [RuntimeState.RUNNING]: 2,
      [RuntimeState.STOPPING]: 3,
      [RuntimeState.ERROR]: 4,
    }[state];

    this.setGauge("browserx_runtime_state", stateValue);
  }

  /**
   * Update uptime metric
   */
  updateUptime(uptimeMs: number): void {
    this.setGauge("browserx_uptime_seconds", uptimeMs / 1000);
  }

  /**
   * Register a component metrics collector
   */
  registerComponentMetrics(
    componentId: ComponentId,
    collector: () => Record<string, MetricValue>,
  ): void {
    this.componentMetricsCollectors.set(componentId, collector);
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    let output = "";

    // Update memory metrics
    this.updateMemoryMetrics();

    // Export counters
    for (const [name, value] of this.counters.entries()) {
      const { metricName, labels } = this.parseMetricKey(name);
      const labelStr = this.formatPrometheusLabels(labels);
      output += `# TYPE ${metricName} counter\n`;
      output += `${metricName}${labelStr} ${value}\n\n`;
    }

    // Export gauges
    for (const [name, value] of this.gauges.entries()) {
      const { metricName, labels } = this.parseMetricKey(name);
      const labelStr = this.formatPrometheusLabels(labels);
      output += `# TYPE ${metricName} gauge\n`;
      output += `${metricName}${labelStr} ${value}\n\n`;
    }

    // Export histograms
    for (const [name, histogram] of this.histograms.entries()) {
      output += `# TYPE ${name} histogram\n`;

      for (const bucket of histogram.buckets) {
        const le = bucket.le === Infinity ? "+Inf" : bucket.le.toString();
        output += `${name}_bucket{le="${le}"} ${bucket.count}\n`;
      }

      output += `${name}_sum ${histogram.sum}\n`;
      output += `${name}_count ${histogram.count}\n\n`;
    }

    // Collect component metrics
    for (const [componentId, collector] of this.componentMetricsCollectors.entries()) {
      try {
        const metrics = collector();
        for (const metric of Object.values(metrics)) {
          const labelStr = this.formatPrometheusLabels({
            ...metric.labels,
            component: componentId,
          });
          output += `# TYPE ${metric.name} ${metric.type}\n`;
          output += `${metric.name}${labelStr} ${metric.value}\n\n`;
        }
      } catch (error) {
        console.error(`[Metrics] Error collecting metrics from ${componentId}:`, error);
      }
    }

    return output;
  }

  /**
   * Export metrics in JSON format
   */
  exportJSON(): Record<string, MetricValue[]> {
    const result: Record<string, MetricValue[]> = {
      counters: [],
      gauges: [],
      histograms: [],
    };

    // Update memory metrics
    this.updateMemoryMetrics();

    const now = Date.now();

    // Export counters
    for (const [name, value] of this.counters.entries()) {
      const { metricName, labels } = this.parseMetricKey(name);
      result.counters.push({
        name: metricName,
        type: "counter",
        value,
        labels,
        timestamp: now,
      });
    }

    // Export gauges
    for (const [name, value] of this.gauges.entries()) {
      const { metricName, labels } = this.parseMetricKey(name);
      result.gauges.push({
        name: metricName,
        type: "gauge",
        value,
        labels,
        timestamp: now,
      });
    }

    // Export histograms
    for (const [name, histogram] of this.histograms.entries()) {
      result.histograms.push({
        name,
        type: "histogram",
        value: histogram.count,
        labels: {
          sum: histogram.sum.toString(),
          buckets: JSON.stringify(histogram.buckets),
        },
        timestamp: now,
      });
    }

    return result;
  }

  /**
   * Get metric key with labels
   */
  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }

    const sortedLabels = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");

    return `${name}{${sortedLabels}}`;
  }

  /**
   * Parse metric key into name and labels
   */
  private parseMetricKey(key: string): {
    metricName: string;
    labels: Record<string, string>;
  } {
    const match = key.match(/^([^{]+)(?:\{(.+)\})?$/);
    if (!match) {
      return { metricName: key, labels: {} };
    }

    const metricName = match[1];
    const labels: Record<string, string> = {};

    if (match[2]) {
      const labelPairs = match[2].split(",");
      for (const pair of labelPairs) {
        const [k, v] = pair.split("=");
        if (k && v) {
          labels[k] = v.replace(/^"|"$/g, "");
        }
      }
    }

    return { metricName, labels };
  }

  /**
   * Format labels for Prometheus
   */
  private formatPrometheusLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) {
      return "";
    }

    const labelStr = entries
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");

    return `{${labelStr}}`;
  }

  /**
   * Get configuration
   */
  getConfig(): MetricsConfig {
    return { ...this.config };
  }

  /**
   * Check if metrics server is running
   */
  isRunning(): boolean {
    return this.started;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: RuntimeEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: RuntimeEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }
}
