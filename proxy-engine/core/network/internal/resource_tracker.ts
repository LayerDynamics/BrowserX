/**
 * Resource Tracker
 *
 * Track network resource usage (memory, connections, bandwidth)
 */

/**
 * Resource type
 */
export type ResourceType =
  | "connections"
  | "memory"
  | "bandwidth"
  | "fileDescriptors"
  | "buffers";

/**
 * Resource usage snapshot
 */
export interface ResourceUsage {
  type: ResourceType;
  current: number;
  peak: number;
  limit: number;
  unit: string;
  timestamp: number;
}

/**
 * Resource limits
 */
export interface ResourceLimits {
  maxConnections: number;
  maxMemory: number; // bytes
  maxBandwidth: number; // bytes per second
  maxFileDescriptors: number;
  maxBuffers: number;
}

/**
 * Default resource limits
 */
const DEFAULT_LIMITS: ResourceLimits = {
  maxConnections: 10000,
  maxMemory: 1024 * 1024 * 1024, // 1GB
  maxBandwidth: 100 * 1024 * 1024, // 100MB/s
  maxFileDescriptors: 65536,
  maxBuffers: 10000,
};

/**
 * Resource Tracker
 */
export class ResourceTracker {
  private limits: ResourceLimits;
  private usage: Map<ResourceType, { current: number; peak: number }> =
    new Map();
  private bandwidthWindow: { timestamp: number; bytes: number }[] = [];
  private readonly bandwidthWindowMs = 1000; // 1 second window

  constructor(limits: Partial<ResourceLimits> = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };

    // Initialize usage
    this.usage.set("connections", { current: 0, peak: 0 });
    this.usage.set("memory", { current: 0, peak: 0 });
    this.usage.set("bandwidth", { current: 0, peak: 0 });
    this.usage.set("fileDescriptors", { current: 0, peak: 0 });
    this.usage.set("buffers", { current: 0, peak: 0 });
  }

  /**
   * Allocate resource
   */
  allocate(type: ResourceType, amount: number = 1): boolean {
    const usage = this.usage.get(type);
    if (!usage) return false;

    const newCurrent = usage.current + amount;
    const limit = this.getLimit(type);

    // Check if allocation would exceed limit
    if (newCurrent > limit) {
      return false;
    }

    // Update usage
    usage.current = newCurrent;
    usage.peak = Math.max(usage.peak, newCurrent);

    return true;
  }

  /**
   * Release resource
   */
  release(type: ResourceType, amount: number = 1): boolean {
    const usage = this.usage.get(type);
    if (!usage) return false;

    usage.current = Math.max(0, usage.current - amount);
    return true;
  }

  /**
   * Set current usage (for external tracking)
   */
  setUsage(type: ResourceType, amount: number): void {
    const usage = this.usage.get(type);
    if (!usage) return;

    usage.current = amount;
    usage.peak = Math.max(usage.peak, amount);
  }

  /**
   * Record bandwidth usage
   */
  recordBandwidth(bytes: number): void {
    const now = Date.now();

    // Add new entry
    this.bandwidthWindow.push({ timestamp: now, bytes });

    // Remove old entries (older than window)
    const cutoff = now - this.bandwidthWindowMs;
    this.bandwidthWindow = this.bandwidthWindow.filter(
      (entry) => entry.timestamp >= cutoff,
    );

    // Calculate current bandwidth (bytes per second)
    const totalBytes = this.bandwidthWindow.reduce(
      (sum, entry) => sum + entry.bytes,
      0,
    );
    const usage = this.usage.get("bandwidth")!;
    usage.current = totalBytes;
    usage.peak = Math.max(usage.peak, totalBytes);
  }

  /**
   * Get current usage
   */
  getCurrent(type: ResourceType): number {
    return this.usage.get(type)?.current || 0;
  }

  /**
   * Get peak usage
   */
  getPeak(type: ResourceType): number {
    return this.usage.get(type)?.peak || 0;
  }

  /**
   * Get limit
   */
  getLimit(type: ResourceType): number {
    switch (type) {
      case "connections":
        return this.limits.maxConnections;
      case "memory":
        return this.limits.maxMemory;
      case "bandwidth":
        return this.limits.maxBandwidth;
      case "fileDescriptors":
        return this.limits.maxFileDescriptors;
      case "buffers":
        return this.limits.maxBuffers;
      default:
        return 0;
    }
  }

  /**
   * Get utilization (0-1)
   */
  getUtilization(type: ResourceType): number {
    const current = this.getCurrent(type);
    const limit = this.getLimit(type);
    return limit > 0 ? current / limit : 0;
  }

  /**
   * Check if resource is available
   */
  isAvailable(type: ResourceType, amount: number = 1): boolean {
    const current = this.getCurrent(type);
    const limit = this.getLimit(type);
    return current + amount <= limit;
  }

  /**
   * Get resource usage snapshot
   */
  getUsage(type: ResourceType): ResourceUsage {
    const usage = this.usage.get(type)!;
    const limit = this.getLimit(type);

    return {
      type,
      current: usage.current,
      peak: usage.peak,
      limit,
      unit: this.getUnit(type),
      timestamp: Date.now(),
    };
  }

  /**
   * Get all resource usage
   */
  getAllUsage(): ResourceUsage[] {
    return Array.from(this.usage.keys()).map((type) => this.getUsage(type));
  }

  /**
   * Get unit for resource type
   */
  private getUnit(type: ResourceType): string {
    switch (type) {
      case "connections":
      case "fileDescriptors":
      case "buffers":
        return "count";
      case "memory":
        return "bytes";
      case "bandwidth":
        return "bytes/sec";
      default:
        return "unknown";
    }
  }

  /**
   * Reset peak usage
   */
  resetPeak(type?: ResourceType): void {
    if (type) {
      const usage = this.usage.get(type);
      if (usage) {
        usage.peak = usage.current;
      }
    } else {
      for (const usage of this.usage.values()) {
        usage.peak = usage.current;
      }
    }
  }

  /**
   * Update limits
   */
  updateLimits(limits: Partial<ResourceLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  /**
   * Get resource pressure (0-1, where 1 is critical)
   */
  getPressure(): number {
    const utilizations = Array.from(this.usage.keys()).map((type) =>
      this.getUtilization(type)
    );
    return Math.max(...utilizations, 0);
  }

  /**
   * Check if any resource is under pressure (>80% utilization)
   */
  isUnderPressure(): boolean {
    return this.getPressure() > 0.8;
  }

  /**
   * Get resource statistics
   */
  getStats(): {
    overall: {
      pressure: number;
      underPressure: boolean;
    };
    resources: ResourceUsage[];
  } {
    const pressure = this.getPressure();

    return {
      overall: {
        pressure,
        underPressure: pressure > 0.8,
      },
      resources: this.getAllUsage(),
    };
  }
}

/**
 * Global resource tracker instance
 */
export const globalTracker = new ResourceTracker();
