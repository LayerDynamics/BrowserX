// metrics_collector.ts - Comprehensive metrics collection

interface Histogram {
  count: number;
  sum: number;
  min: number;
  max: number;
  buckets: Map<number, number>; // Upper bound → count
}

class ProxyMetrics {
  // Counters
  private requestCount: number = 0;
  private errorCount: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  // Gauges
  private activeConnections: number = 0;
  private connectionPoolSize: number = 0;

  // Histograms
  private responseTimeHistogram: Histogram;
  private requestSizeHistogram: Histogram;
  private responseSizeHistogram: Histogram;

  constructor() {
    this.responseTimeHistogram = this.createHistogram([10, 50, 100, 200, 500, 1000, 2000, 5000]);
    this.requestSizeHistogram = this.createHistogram([1024, 10240, 102400, 1048576, 10485760]); // 1KB, 10KB, 100KB, 1MB, 10MB
    this.responseSizeHistogram = this.createHistogram([1024, 10240, 102400, 1048576, 10485760]);
  }

  private createHistogram(buckets: number[]): Histogram {
    const histogram: Histogram = {
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      buckets: new Map(),
    };

    for (const bucket of buckets) {
      histogram.buckets.set(bucket, 0);
    }

    return histogram;
  }

  /**
   * Record request
   */
  recordRequest(
    responseTime: number,
    statusCode: number,
    requestSize: number,
    responseSize: number,
    cacheHit: boolean,
  ): void {
    this.requestCount++;

    // Error tracking
    if (statusCode >= 400) {
      this.errorCount++;
    }

    // Cache tracking
    if (cacheHit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }

    // Response time histogram
    this.recordHistogram(this.responseTimeHistogram, responseTime);

    // Request size histogram
    this.recordHistogram(this.requestSizeHistogram, requestSize);

    // Response size histogram
    this.recordHistogram(this.responseSizeHistogram, responseSize);
  }

  private recordHistogram(histogram: Histogram, value: number): void {
    histogram.count++;
    histogram.sum += value;
    histogram.min = Math.min(histogram.min, value);
    histogram.max = Math.max(histogram.max, value);

    // Find appropriate bucket
    for (const [upperBound, count] of histogram.buckets.entries()) {
      if (value <= upperBound) {
        histogram.buckets.set(upperBound, count + 1);
        break;
      }
    }
  }

  /**
   * Set gauge values
   */
  setActiveConnections(count: number): void {
    this.activeConnections = count;
  }

  setConnectionPoolSize(size: number): void {
    this.connectionPoolSize = size;
  }

  /**
   * Calculate percentile from histogram
   */
  private calculatePercentile(histogram: Histogram, percentile: number): number {
    const targetCount = histogram.count * (percentile / 100);
    let cumulativeCount = 0;

    const sortedBuckets = Array.from(histogram.buckets.entries()).sort((a, b) => a[0] - b[0]);

    for (const [upperBound, count] of sortedBuckets) {
      cumulativeCount += count;
      if (cumulativeCount >= targetCount) {
        return upperBound;
      }
    }

    return histogram.max;
  }

  /**
   * Get request count
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.errorCount;
  }

  /**
   * Get cache hits count
   */
  getCacheHits(): number {
    return this.cacheHits;
  }

  /**
   * Get cache misses count
   */
  getCacheMisses(): number {
    return this.cacheMisses;
  }

  /**
   * Get active connections gauge
   */
  getActiveConnections(): number {
    return this.activeConnections;
  }

  /**
   * Get connection pool size gauge
   */
  getConnectionPoolSize(): number {
    return this.connectionPoolSize;
  }

  /**
   * Get response time histogram
   */
  getResponseTimeHistogram(): Histogram {
    return this.responseTimeHistogram;
  }

  /**
   * Get request size histogram
   */
  getRequestSizeHistogram(): Histogram {
    return this.requestSizeHistogram;
  }

  /**
   * Get response size histogram
   */
  getResponseSizeHistogram(): Histogram {
    return this.responseSizeHistogram;
  }

  /**
   * Get snapshot of all metrics
   */
  snapshot(): Record<string, any> {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      activeConnections: this.activeConnections,
      connectionPoolSize: this.connectionPoolSize,
      responseTime: {
        count: this.responseTimeHistogram.count,
        sum: this.responseTimeHistogram.sum,
        min: this.responseTimeHistogram.min,
        max: this.responseTimeHistogram.max,
        avg: this.responseTimeHistogram.sum / this.responseTimeHistogram.count || 0,
      },
    };
  }

  /**
   * Get metrics snapshot
   */
  getMetrics() {
    const cacheHitRate = this.cacheHits + this.cacheMisses > 0
      ? ((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(2)
      : "0.00";

    const errorRate = this.requestCount > 0
      ? ((this.errorCount / this.requestCount) * 100).toFixed(2)
      : "0.00";

    const avgResponseTime = this.responseTimeHistogram.count > 0
      ? (this.responseTimeHistogram.sum / this.responseTimeHistogram.count).toFixed(2)
      : "0.00";

    return {
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        errorRate: `${errorRate}%`,
      },
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate: `${cacheHitRate}%`,
      },
      connections: {
        active: this.activeConnections,
        poolSize: this.connectionPoolSize,
      },
      responseTime: {
        avg: `${avgResponseTime}ms`,
        min: `${this.responseTimeHistogram.min}ms`,
        max: `${this.responseTimeHistogram.max}ms`,
        p50: `${this.calculatePercentile(this.responseTimeHistogram, 50)}ms`,
        p95: `${this.calculatePercentile(this.responseTimeHistogram, 95)}ms`,
        p99: `${this.calculatePercentile(this.responseTimeHistogram, 99)}ms`,
      },
    };
  }

  /**
   * Display metrics
   */
  displayMetrics(): void {
    const metrics = this.getMetrics();

    console.log(`\n${"=".repeat(70)}`);
    console.log("Proxy Metrics");
    console.log("=".repeat(70));

    console.log("\nRequests:");
    console.log(`  Total: ${metrics.requests.total}`);
    console.log(`  Errors: ${metrics.requests.errors} (${metrics.requests.errorRate})`);

    console.log("\nCache:");
    console.log(`  Hits: ${metrics.cache.hits}`);
    console.log(`  Misses: ${metrics.cache.misses}`);
    console.log(`  Hit Rate: ${metrics.cache.hitRate}`);

    console.log("\nConnections:");
    console.log(`  Active: ${metrics.connections.active}`);
    console.log(`  Pool Size: ${metrics.connections.poolSize}`);

    console.log("\nResponse Time:");
    console.log(`  Average: ${metrics.responseTime.avg}`);
    console.log(`  Min: ${metrics.responseTime.min}`);
    console.log(`  Max: ${metrics.responseTime.max}`);
    console.log(`  P50 (Median): ${metrics.responseTime.p50}`);
    console.log(`  P95: ${metrics.responseTime.p95}`);
    console.log(`  P99: ${metrics.responseTime.p99}`);

    console.log("=".repeat(70) + "\n");
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    let output = "";

    // Counters
    output += `# HELP proxy_requests_total Total number of requests\n`;
    output += `# TYPE proxy_requests_total counter\n`;
    output += `proxy_requests_total ${this.requestCount}\n\n`;

    output += `# HELP proxy_errors_total Total number of errors\n`;
    output += `# TYPE proxy_errors_total counter\n`;
    output += `proxy_errors_total ${this.errorCount}\n\n`;

    output += `# HELP proxy_cache_hits_total Total cache hits\n`;
    output += `# TYPE proxy_cache_hits_total counter\n`;
    output += `proxy_cache_hits_total ${this.cacheHits}\n\n`;

    output += `# HELP proxy_cache_misses_total Total cache misses\n`;
    output += `# TYPE proxy_cache_misses_total counter\n`;
    output += `proxy_cache_misses_total ${this.cacheMisses}\n\n`;

    // Gauges
    output += `# HELP proxy_active_connections Current active connections\n`;
    output += `# TYPE proxy_active_connections gauge\n`;
    output += `proxy_active_connections ${this.activeConnections}\n\n`;

    // Histograms
    output += `# HELP proxy_response_time_ms Response time in milliseconds\n`;
    output += `# TYPE proxy_response_time_ms histogram\n`;

    const sortedBuckets = Array.from(this.responseTimeHistogram.buckets.entries()).sort((a, b) =>
      a[0] - b[0]
    );
    let cumulativeCount = 0;

    for (const [upperBound, count] of sortedBuckets) {
      cumulativeCount += count;
      output += `proxy_response_time_ms_bucket{le="${upperBound}"} ${cumulativeCount}\n`;
    }

    output += `proxy_response_time_ms_bucket{le="+Inf"} ${this.responseTimeHistogram.count}\n`;
    output += `proxy_response_time_ms_sum ${this.responseTimeHistogram.sum}\n`;
    output += `proxy_response_time_ms_count ${this.responseTimeHistogram.count}\n`;

    return output;
  }
}

// Example usage
const metrics = new ProxyMetrics();

console.log("=== Metrics Collection Demo ===\n");

// Simulate requests
console.log("Simulating 100 requests...\n");

for (let i = 0; i < 100; i++) {
  const responseTime = Math.floor(Math.random() * 500) + 10; // 10-510ms
  const statusCode = Math.random() < 0.95 ? 200 : 500; // 5% error rate
  const requestSize = Math.floor(Math.random() * 10000) + 500; // 500-10500 bytes
  const responseSize = Math.floor(Math.random() * 50000) + 1000; // 1000-51000 bytes
  const cacheHit = Math.random() < 0.3; // 30% cache hit rate

  metrics.recordRequest(responseTime, statusCode, requestSize, responseSize, cacheHit);
}

metrics.setActiveConnections(25);
metrics.setConnectionPoolSize(50);

// Display metrics
metrics.displayMetrics();

// Export Prometheus format
console.log("=== Prometheus Export ===\n");
console.log(metrics.exportPrometheus());

console.log("=== Integration Options ===");
console.log("✓ Expose /metrics endpoint for Prometheus scraping");
console.log("✓ Push metrics to Grafana Cloud, Datadog, New Relic");
console.log("✓ Store time-series data in InfluxDB, TimescaleDB");
console.log("✓ Visualize with Grafana dashboards");
console.log("✓ Alert on anomalies (high error rate, slow responses)");
