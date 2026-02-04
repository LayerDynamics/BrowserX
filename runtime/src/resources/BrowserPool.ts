/**
 * Browser Pool
 *
 * Manages a pool of browser instances with lifecycle management.
 * Provides browser instance pooling with idle timeout, max lifetime,
 * and efficient resource utilization.
 */

import type {
  ComponentId,
  ResourceStats,
  RuntimeEvent,
  RuntimeEventListener,
} from "../types.ts";
import type { BrowserPoolConfig } from "../config/RuntimeConfig.ts";
import type { EventCoordinator, BrowserEventLoopHandle } from "../events/EventCoordinator.ts";

/**
 * Browser instance state
 */
export type BrowserInstanceState = "idle" | "in_use" | "closing" | "closed" | "error";

/**
 * Browser instance
 */
export interface BrowserInstance {
  readonly id: string;
  state: BrowserInstanceState;
  readonly createdAt: number;
  lastUsedAt: number;
  useCount: number;
  currentUrl?: string;
  error?: Error;
  eventLoopHandle?: BrowserEventLoopHandle;
  browserEngine?: unknown; // Will be typed when browser engine is available
}

/**
 * Browser pool statistics
 */
export interface BrowserPoolStats {
  totalInstances: number;
  idleInstances: number;
  inUseInstances: number;
  maxInstances: number;
  minInstances: number;
  totalCreated: number;
  totalClosed: number;
  totalErrors: number;
  averageLifetime: number;
  averageUseCount: number;
}

/**
 * Browser acquisition options
 */
interface AcquisitionOptions {
  timeout?: number;
  url?: string;
}

/**
 * Browser Pool
 *
 * Manages browser instances with pooling and lifecycle management.
 */
export class BrowserPool {
  private instances: Map<string, BrowserInstance> = new Map();
  private config: BrowserPoolConfig;
  private eventCoordinator?: EventCoordinator;
  private eventListeners: RuntimeEventListener[] = [];
  private cleanupIntervalId?: number;
  private lifetimeCheckIntervalId?: number;
  private started = false;

  // Statistics
  private totalCreated = 0;
  private totalClosed = 0;
  private totalErrors = 0;
  private lifetimes: number[] = [];
  private useCounts: number[] = [];

  constructor(
    config: BrowserPoolConfig,
    eventCoordinator?: EventCoordinator,
  ) {
    this.config = config;
    this.eventCoordinator = eventCoordinator;
  }

  /**
   * Start the browser pool
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;

    // Pre-warm minimum instances
    await this.warmPool();

    // Start cleanup intervals
    this.startCleanupIntervals();
  }

  /**
   * Pre-warm the pool with minimum instances
   */
  private async warmPool(): Promise<void> {
    const instancesToCreate = Math.max(
      0,
      this.config.minInstances - this.instances.size,
    );

    for (let i = 0; i < instancesToCreate; i++) {
      try {
        await this.createInstance();
      } catch (error) {
        console.warn("[BrowserPool] Failed to pre-warm instance:", error);
      }
    }
  }

  /**
   * Create a new browser instance
   */
  private async createInstance(): Promise<BrowserInstance> {
    const id = this.generateInstanceId();

    // Create event loop for this browser instance
    let eventLoopHandle: BrowserEventLoopHandle | undefined;
    if (this.eventCoordinator) {
      try {
        eventLoopHandle = await this.eventCoordinator.createBrowserEventLoop(id);
      } catch (error) {
        console.warn(
          `[BrowserPool] Failed to create event loop for ${id}:`,
          error,
        );
      }
    }

    // Create browser engine (dynamic import to avoid circular dependencies)
    let browserEngine: unknown;
    try {
      const browserModule = await import("@browserx/browser");
      browserEngine = new browserModule.BrowserEngine({
        width: this.config.defaultWidth,
        height: this.config.defaultHeight,
      });
    } catch (error) {
      console.warn(`[BrowserPool] Failed to create browser engine for ${id}:`, error);
    }

    const instance: BrowserInstance = {
      id,
      state: "idle",
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      useCount: 0,
      eventLoopHandle,
      browserEngine,
    };

    this.instances.set(id, instance);
    this.totalCreated++;

    return instance;
  }

  /**
   * Acquire a browser instance from the pool
   */
  async acquire(options: AcquisitionOptions = {}): Promise<BrowserInstance> {
    const timeout = options.timeout ?? 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Try to get an idle instance
      for (const instance of this.instances.values()) {
        if (instance.state === "idle") {
          instance.state = "in_use";
          instance.lastUsedAt = Date.now();
          instance.useCount++;

          if (options.url) {
            instance.currentUrl = options.url;
          }

          return instance;
        }
      }

      // No idle instance available - try to create new one
      if (this.instances.size < this.config.maxInstances) {
        const instance = await this.createInstance();
        instance.state = "in_use";
        instance.useCount++;

        if (options.url) {
          instance.currentUrl = options.url;
        }

        return instance;
      }

      // Pool exhausted - wait a bit and retry
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error("Failed to acquire browser instance: pool exhausted and timeout reached");
  }

  /**
   * Release a browser instance back to the pool
   */
  release(instanceId: string): void {
    const instance = this.instances.get(instanceId);

    if (!instance) {
      console.warn(`[BrowserPool] Cannot release unknown instance: ${instanceId}`);
      return;
    }

    if (instance.state !== "in_use") {
      console.warn(
        `[BrowserPool] Cannot release instance ${instanceId} in state: ${instance.state}`,
      );
      return;
    }

    // Check if instance exceeded max lifetime
    const lifetime = Date.now() - instance.createdAt;
    if (lifetime > this.config.maxLifetime) {
      this.closeInstance(instanceId, "max_lifetime_exceeded");
      return;
    }

    // Return to pool
    instance.state = "idle";
    instance.lastUsedAt = Date.now();
    instance.currentUrl = undefined;
  }

  /**
   * Close a browser instance
   */
  async closeInstance(instanceId: string, reason = "manual"): Promise<void> {
    const instance = this.instances.get(instanceId);

    if (!instance) {
      return;
    }

    instance.state = "closing";

    try {
      // Stop event loop if present
      if (instance.eventLoopHandle) {
        instance.eventLoopHandle.stop();
      }

      // Record statistics
      const lifetime = Date.now() - instance.createdAt;
      this.lifetimes.push(lifetime);
      this.useCounts.push(instance.useCount);

      // Keep only last 100 values for averages
      if (this.lifetimes.length > 100) {
        this.lifetimes.shift();
        this.useCounts.shift();
      }

      instance.state = "closed";
      this.instances.delete(instanceId);
      this.totalClosed++;
    } catch (error) {
      instance.state = "error";
      instance.error = error instanceof Error ? error : new Error(String(error));
      this.totalErrors++;
      console.error(`[BrowserPool] Error closing instance ${instanceId}:`, error);
    }
  }

  /**
   * Get an instance by ID
   */
  getInstance(instanceId: string): BrowserInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Check if an instance exists
   */
  hasInstance(instanceId: string): boolean {
    return this.instances.has(instanceId);
  }

  /**
   * Get pool statistics
   */
  getStats(): BrowserPoolStats {
    let idleCount = 0;
    let inUseCount = 0;

    for (const instance of this.instances.values()) {
      if (instance.state === "idle") {
        idleCount++;
      } else if (instance.state === "in_use") {
        inUseCount++;
      }
    }

    const avgLifetime =
      this.lifetimes.length > 0
        ? this.lifetimes.reduce((a, b) => a + b, 0) / this.lifetimes.length
        : 0;

    const avgUseCount =
      this.useCounts.length > 0
        ? this.useCounts.reduce((a, b) => a + b, 0) / this.useCounts.length
        : 0;

    return {
      totalInstances: this.instances.size,
      idleInstances: idleCount,
      inUseInstances: inUseCount,
      maxInstances: this.config.maxInstances,
      minInstances: this.config.minInstances,
      totalCreated: this.totalCreated,
      totalClosed: this.totalClosed,
      totalErrors: this.totalErrors,
      averageLifetime: avgLifetime,
      averageUseCount: avgUseCount,
    };
  }

  /**
   * Get resource stats for runtime
   */
  getResourceStats(): Partial<ResourceStats> {
    const stats = this.getStats();

    return {
      browserInstances: stats.totalInstances,
      activeSessions: stats.inUseInstances,
    };
  }

  /**
   * Stop the browser pool and close all instances
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    // Stop cleanup intervals
    this.stopCleanupIntervals();

    // Close all instances
    const instanceIds = Array.from(this.instances.keys());
    for (const id of instanceIds) {
      await this.closeInstance(id, "pool_shutdown");
    }

    this.started = false;
  }

  /**
   * Drain the pool (close all idle instances)
   */
  async drain(): Promise<void> {
    const idleInstances: string[] = [];

    for (const [id, instance] of this.instances.entries()) {
      if (instance.state === "idle") {
        idleInstances.push(id);
      }
    }

    for (const id of idleInstances) {
      await this.closeInstance(id, "drain");
    }
  }

  /**
   * Start cleanup intervals
   */
  private startCleanupIntervals(): void {
    // Idle timeout cleanup - check every minute
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupIdleInstances().catch((error) => {
        console.error("[BrowserPool] Idle cleanup error:", error);
      });
    }, 60 * 1000);

    // Lifetime check - check every 5 minutes
    this.lifetimeCheckIntervalId = setInterval(() => {
      this.checkInstanceLifetimes().catch((error) => {
        console.error("[BrowserPool] Lifetime check error:", error);
      });
    }, 5 * 60 * 1000);
  }

  /**
   * Stop cleanup intervals
   */
  private stopCleanupIntervals(): void {
    if (this.cleanupIntervalId !== undefined) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }

    if (this.lifetimeCheckIntervalId !== undefined) {
      clearInterval(this.lifetimeCheckIntervalId);
      this.lifetimeCheckIntervalId = undefined;
    }
  }

  /**
   * Cleanup idle instances that have timed out
   */
  private async cleanupIdleInstances(): Promise<void> {
    const now = Date.now();
    const toClose: string[] = [];

    for (const [id, instance] of this.instances.entries()) {
      if (instance.state === "idle") {
        const idleTime = now - instance.lastUsedAt;

        // Don't close if we're at minimum instances
        if (
          idleTime > this.config.idleTimeout &&
          this.instances.size > this.config.minInstances
        ) {
          toClose.push(id);
        }
      }
    }

    for (const id of toClose) {
      await this.closeInstance(id, "idle_timeout");
    }
  }

  /**
   * Check and close instances that exceeded max lifetime
   */
  private async checkInstanceLifetimes(): Promise<void> {
    const now = Date.now();
    const toClose: string[] = [];

    for (const [id, instance] of this.instances.entries()) {
      const lifetime = now - instance.createdAt;

      if (lifetime > this.config.maxLifetime && instance.state === "idle") {
        toClose.push(id);
      }
    }

    for (const id of toClose) {
      await this.closeInstance(id, "max_lifetime_exceeded");
    }
  }

  /**
   * Generate a unique instance ID
   */
  private generateInstanceId(): string {
    return `browser_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
