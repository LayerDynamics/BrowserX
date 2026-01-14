/**
 * Memory State Tracking
 *
 * Monitor and manage memory usage and pressure
 */

import type { MemoryConfig } from "./config.ts";

/**
 * Memory state
 */
export interface MemoryState {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  timestamp: Date;
}

/**
 * Memory pressure level
 */
export enum MemoryPressure {
  NORMAL = "normal",
  MODERATE = "moderate",
  CRITICAL = "critical",
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  current: MemoryState;
  pressure: MemoryPressure;
  utilizationPercent: number;
  trend: "increasing" | "decreasing" | "stable";
  gcRecommended: boolean;
}

/**
 * Memory state manager
 */
export class MemoryStateManager {
  private history: MemoryState[] = [];
  private maxHistorySize = 100;
  private lastGC: Date | null = null;
  private gcCount = 0;

  constructor(private config: MemoryConfig) {}

  /**
   * Get current memory state
   */
  getCurrentState(): MemoryState {
    const memoryUsage = Deno.memoryUsage();

    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      arrayBuffers: 0, // Not directly available in Deno
      timestamp: new Date(),
    };
  }

  /**
   * Record current state in history
   */
  recordState(): MemoryState {
    const state = this.getCurrentState();

    this.history.push(state);

    // Trim history if too large
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    return state;
  }

  /**
   * Get memory pressure level
   */
  getPressure(): MemoryPressure {
    const state = this.getCurrentState();
    const utilizationPercent = (state.heapUsed / state.heapTotal) * 100;

    if (utilizationPercent >= this.config.criticalThreshold) {
      return MemoryPressure.CRITICAL;
    } else if (utilizationPercent >= this.config.warningThreshold) {
      return MemoryPressure.MODERATE;
    } else {
      return MemoryPressure.NORMAL;
    }
  }

  /**
   * Get memory utilization percentage
   */
  getUtilization(): number {
    const state = this.getCurrentState();
    return (state.heapUsed / state.heapTotal) * 100;
  }

  /**
   * Get memory trend
   */
  getTrend(): "increasing" | "decreasing" | "stable" {
    if (this.history.length < 3) {
      return "stable";
    }

    const recent = this.history.slice(-3);
    const deltas = [];

    for (let i = 1; i < recent.length; i++) {
      deltas.push(recent[i].heapUsed - recent[i - 1].heapUsed);
    }

    const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;

    // If average delta is significant (> 1MB change)
    const threshold = 1024 * 1024;

    if (avgDelta > threshold) {
      return "increasing";
    } else if (avgDelta < -threshold) {
      return "decreasing";
    } else {
      return "stable";
    }
  }

  /**
   * Check if GC is recommended
   */
  isGCRecommended(): boolean {
    const pressure = this.getPressure();
    const trend = this.getTrend();

    // Recommend GC if pressure is high or memory is increasing rapidly
    if (pressure === MemoryPressure.CRITICAL) {
      return true;
    }

    if (pressure === MemoryPressure.MODERATE && trend === "increasing") {
      return true;
    }

    // Also recommend if we haven't GC'd in a while and memory is high
    if (this.lastGC) {
      const timeSinceLastGC = Date.now() - this.lastGC.getTime();
      const utilizationPercent = this.getUtilization();

      if (timeSinceLastGC > this.config.gcInterval && utilizationPercent > 60) {
        return true;
      }
    }

    return false;
  }

  /**
   * Trigger garbage collection
   */
  async triggerGC(): Promise<void> {
    // Deno doesn't expose a direct GC trigger, but we can force it indirectly
    // by creating memory pressure and then releasing references

    // Record GC event
    this.lastGC = new Date();
    this.gcCount++;

    // In V8-based runtimes, GC is automatic
    // We can only suggest it by clearing unnecessary references
    // The runtime will handle actual collection

    // Clear old history to reduce memory pressure
    if (this.history.length > this.maxHistorySize / 2) {
      this.history = this.history.slice(-Math.floor(this.maxHistorySize / 2));
    }
  }

  /**
   * Get comprehensive memory statistics
   */
  getStats(): MemoryStats {
    const current = this.getCurrentState();
    const pressure = this.getPressure();
    const utilizationPercent = this.getUtilization();
    const trend = this.getTrend();
    const gcRecommended = this.isGCRecommended();

    return {
      current,
      pressure,
      utilizationPercent,
      trend,
      gcRecommended,
    };
  }

  /**
   * Get memory history
   */
  getHistory(limit?: number): MemoryState[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get GC statistics
   */
  getGCStats() {
    return {
      lastGC: this.lastGC,
      gcCount: this.gcCount,
      timeSinceLastGC: this.lastGC ? Date.now() - this.lastGC.getTime() : null,
    };
  }

  /**
   * Check if memory limit is exceeded
   */
  isLimitExceeded(): boolean {
    const state = this.getCurrentState();

    if (this.config.maxHeapSize && state.heapUsed > this.config.maxHeapSize) {
      return true;
    }

    if (this.config.maxRSS && state.rss > this.config.maxRSS) {
      return true;
    }

    return false;
  }

  /**
   * Get memory delta (change since last state)
   */
  getMemoryDelta(): number | null {
    if (this.history.length < 2) {
      return null;
    }

    const current = this.history[this.history.length - 1];
    const previous = this.history[this.history.length - 2];

    return current.heapUsed - previous.heapUsed;
  }

  /**
   * Format bytes to human-readable string
   */
  static formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Get configuration
   */
  getConfig(): MemoryConfig {
    return this.config;
  }

  /**
   * Get formatted memory report
   */
  getFormattedReport(): string {
    const stats = this.getStats();
    const current = stats.current;

    return [
      "=== Memory Report ===",
      `Heap Used: ${MemoryStateManager.formatBytes(current.heapUsed)}`,
      `Heap Total: ${MemoryStateManager.formatBytes(current.heapTotal)}`,
      `RSS: ${MemoryStateManager.formatBytes(current.rss)}`,
      `External: ${MemoryStateManager.formatBytes(current.external)}`,
      `Utilization: ${stats.utilizationPercent.toFixed(2)}%`,
      `Pressure: ${stats.pressure}`,
      `Trend: ${stats.trend}`,
      `GC Recommended: ${stats.gcRecommended}`,
      `GC Count: ${this.gcCount}`,
      `Last GC: ${this.lastGC?.toISOString() || "Never"}`,
      "===================",
    ].join("\n");
  }
}
