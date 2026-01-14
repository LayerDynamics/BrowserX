/**
 * Metrics Types
 *
 * Core metric types for monitoring and observability
 */

/**
 * Counter - Monotonically increasing metric
 * Used for: total_requests, total_errors, bytes_sent, etc.
 */
export class Counter {
  private value = 0;
  private readonly name: string;
  private readonly labels: Map<string, string>;

  constructor(name: string, labels?: Record<string, string>) {
    this.name = name;
    this.labels = new Map(Object.entries(labels || {}));
  }

  /**
   * Increment counter by amount (default 1)
   */
  inc(amount = 1): void {
    if (amount < 0) {
      throw new Error("Counter can only increase");
    }
    this.value += amount;
  }

  /**
   * Get current value
   */
  get(): number {
    return this.value;
  }

  /**
   * Reset counter to zero
   */
  reset(): void {
    this.value = 0;
  }

  /**
   * Get metric name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get labels
   */
  getLabels(): Map<string, string> {
    return new Map(this.labels);
  }
}

/**
 * Gauge - Metric that can increase or decrease
 * Used for: active_connections, memory_usage, queue_size, etc.
 */
export class Gauge {
  private value = 0;
  private readonly name: string;
  private readonly labels: Map<string, string>;

  constructor(name: string, labels?: Record<string, string>) {
    this.name = name;
    this.labels = new Map(Object.entries(labels || {}));
  }

  /**
   * Set gauge to specific value
   */
  set(value: number): void {
    this.value = value;
  }

  /**
   * Increment gauge by amount (default 1)
   */
  inc(amount = 1): void {
    this.value += amount;
  }

  /**
   * Decrement gauge by amount (default 1)
   */
  dec(amount = 1): void {
    this.value -= amount;
  }

  /**
   * Get current value
   */
  get(): number {
    return this.value;
  }

  /**
   * Reset gauge to zero
   */
  reset(): void {
    this.value = 0;
  }

  /**
   * Get metric name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get labels
   */
  getLabels(): Map<string, string> {
    return new Map(this.labels);
  }
}

/**
 * Histogram - Distribution of values with buckets
 * Used for: request_duration, response_size, etc.
 */
export class Histogram {
  private readonly name: string;
  private readonly labels: Map<string, string>;
  private readonly buckets: number[]; // Upper bounds
  private bucketCounts: Map<number, number>;
  private sum = 0;
  private count = 0;

  constructor(name: string, buckets: number[], labels?: Record<string, string>) {
    this.name = name;
    this.buckets = [...buckets].sort((a, b) => a - b);
    this.labels = new Map(Object.entries(labels || {}));
    this.bucketCounts = new Map();

    // Initialize bucket counts
    for (const bucket of this.buckets) {
      this.bucketCounts.set(bucket, 0);
    }
    // Add +Inf bucket
    this.bucketCounts.set(Infinity, 0);
  }

  /**
   * Observe a value and add it to appropriate buckets
   */
  observe(value: number): void {
    this.sum += value;
    this.count++;

    // Increment all buckets where value <= bucket upper bound
    for (const bucket of this.buckets) {
      if (value <= bucket) {
        const currentCount = this.bucketCounts.get(bucket) || 0;
        this.bucketCounts.set(bucket, currentCount + 1);
      }
    }

    // Always increment +Inf bucket
    const infCount = this.bucketCounts.get(Infinity) || 0;
    this.bucketCounts.set(Infinity, infCount + 1);
  }

  /**
   * Get sum of all observed values
   */
  getSum(): number {
    return this.sum;
  }

  /**
   * Get count of observations
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Get bucket counts
   */
  getBuckets(): Map<number, number> {
    return new Map(this.bucketCounts);
  }

  /**
   * Get average value
   */
  getAverage(): number {
    return this.count > 0 ? this.sum / this.count : 0;
  }

  /**
   * Reset histogram
   */
  reset(): void {
    this.sum = 0;
    this.count = 0;
    for (const bucket of this.bucketCounts.keys()) {
      this.bucketCounts.set(bucket, 0);
    }
  }

  /**
   * Get metric name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get labels
   */
  getLabels(): Map<string, string> {
    return new Map(this.labels);
  }
}

/**
 * Summary - Quantiles (percentiles) for latency analysis
 * Used for: p50, p95, p99 latency calculations
 */
export class Summary {
  private readonly name: string;
  private readonly labels: Map<string, string>;
  private readonly maxAge: number; // Max age of observations in ms
  private readonly maxSize: number; // Max number of observations to keep
  private observations: Array<{ value: number; timestamp: number }> = [];
  private sum = 0;
  private count = 0;

  constructor(
    name: string,
    options?: {
      maxAge?: number;
      maxSize?: number;
      labels?: Record<string, string>;
    }
  ) {
    this.name = name;
    this.maxAge = options?.maxAge || 600000; // Default 10 minutes
    this.maxSize = options?.maxSize || 1000; // Default 1000 observations
    this.labels = new Map(Object.entries(options?.labels || {}));
  }

  /**
   * Observe a value
   */
  observe(value: number): void {
    const now = Date.now();

    // Add new observation
    this.observations.push({ value, timestamp: now });
    this.sum += value;
    this.count++;

    // Remove old observations
    this.pruneObservations(now);
  }

  /**
   * Remove observations older than maxAge or exceeding maxSize
   */
  private pruneObservations(now: number): void {
    const cutoffTime = now - this.maxAge;

    // Remove old observations
    this.observations = this.observations.filter(
      (obs) => obs.timestamp >= cutoffTime
    );

    // If still too many, keep only the most recent maxSize
    if (this.observations.length > this.maxSize) {
      this.observations = this.observations.slice(-this.maxSize);
    }
  }

  /**
   * Calculate quantile (0.0 to 1.0)
   * Examples: 0.5 = p50 (median), 0.95 = p95, 0.99 = p99
   */
  quantile(q: number): number {
    if (q < 0 || q > 1) {
      throw new Error("Quantile must be between 0 and 1");
    }

    if (this.observations.length === 0) {
      return 0;
    }

    // Sort observations by value
    const sorted = [...this.observations]
      .map((obs) => obs.value)
      .sort((a, b) => a - b);

    // Calculate index
    const index = Math.ceil(sorted.length * q) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get p50 (median)
   */
  p50(): number {
    return this.quantile(0.5);
  }

  /**
   * Get p95
   */
  p95(): number {
    return this.quantile(0.95);
  }

  /**
   * Get p99
   */
  p99(): number {
    return this.quantile(0.99);
  }

  /**
   * Get sum of all observed values
   */
  getSum(): number {
    return this.sum;
  }

  /**
   * Get count of observations
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Get average value
   */
  getAverage(): number {
    return this.count > 0 ? this.sum / this.count : 0;
  }

  /**
   * Reset summary
   */
  reset(): void {
    this.observations = [];
    this.sum = 0;
    this.count = 0;
  }

  /**
   * Get metric name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get labels
   */
  getLabels(): Map<string, string> {
    return new Map(this.labels);
  }
}

/**
 * Metric registry for managing all metrics
 */
export class MetricRegistry {
  private counters = new Map<string, Counter>();
  private gauges = new Map<string, Gauge>();
  private histograms = new Map<string, Histogram>();
  private summaries = new Map<string, Summary>();

  /**
   * Register or get existing counter
   */
  counter(name: string, labels?: Record<string, string>): Counter {
    const key = this.getKey(name, labels);
    let counter = this.counters.get(key);
    if (!counter) {
      counter = new Counter(name, labels);
      this.counters.set(key, counter);
    }
    return counter;
  }

  /**
   * Register or get existing gauge
   */
  gauge(name: string, labels?: Record<string, string>): Gauge {
    const key = this.getKey(name, labels);
    let gauge = this.gauges.get(key);
    if (!gauge) {
      gauge = new Gauge(name, labels);
      this.gauges.set(key, gauge);
    }
    return gauge;
  }

  /**
   * Register or get existing histogram
   */
  histogram(
    name: string,
    buckets: number[],
    labels?: Record<string, string>
  ): Histogram {
    const key = this.getKey(name, labels);
    let histogram = this.histograms.get(key);
    if (!histogram) {
      histogram = new Histogram(name, buckets, labels);
      this.histograms.set(key, histogram);
    }
    return histogram;
  }

  /**
   * Register or get existing summary
   */
  summary(
    name: string,
    options?: {
      maxAge?: number;
      maxSize?: number;
      labels?: Record<string, string>;
    }
  ): Summary {
    const key = this.getKey(name, options?.labels);
    let summary = this.summaries.get(key);
    if (!summary) {
      summary = new Summary(name, options);
      this.summaries.set(key, summary);
    }
    return summary;
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
   * Get all summaries
   */
  getSummaries(): Summary[] {
    return Array.from(this.summaries.values());
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    for (const counter of this.counters.values()) {
      counter.reset();
    }
    for (const gauge of this.gauges.values()) {
      gauge.reset();
    }
    for (const histogram of this.histograms.values()) {
      histogram.reset();
    }
    for (const summary of this.summaries.values()) {
      summary.reset();
    }
  }

  /**
   * Clear all registered metrics
   */
  clear(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
  }

  /**
   * Generate unique key for metric with labels
   */
  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }

    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");

    return `${name}{${labelStr}}`;
  }
}

/**
 * Default global registry
 */
export const defaultRegistry = new MetricRegistry();
