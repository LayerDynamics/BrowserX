/**
 * Serial Device Pool
 *
 * Manages a pool of serial device connections with lifecycle management.
 * Follows the BrowserPool pattern with acquire/release, idle timeout,
 * and automatic cleanup intervals.
 */

import type {
  ComponentId,
  ResourceStats,
  RuntimeEvent,
  RuntimeEventListener,
} from "../types.ts";
import type { EventCoordinator } from "../events/EventCoordinator.ts";

/**
 * Serial device instance state
 */
export type SerialDeviceState = "idle" | "in_use" | "closing" | "closed" | "error";

/**
 * Serial device instance
 */
export interface SerialDeviceInstance {
  readonly id: string;
  state: SerialDeviceState;
  readonly createdAt: number;
  lastUsedAt: number;
  useCount: number;
  portName: string;
  baudRate: number;
  error?: Error;
  // deno-lint-ignore no-explicit-any
  device?: any; // SerialDevice from browser device layer
}

/**
 * Serial device pool statistics
 */
export interface SerialDevicePoolStats {
  totalDevices: number;
  idleDevices: number;
  inUseDevices: number;
  maxDevices: number;
  totalOpened: number;
  totalClosed: number;
  totalErrors: number;
  averageLifetime: number;
  averageUseCount: number;
}

/**
 * Serial device pool configuration
 */
export interface SerialDevicePoolConfig {
  /** Maximum number of concurrent serial connections */
  maxDevices: number;
  /** Time (ms) after which an idle device connection is closed */
  idleTimeout: number;
  /** Maximum lifetime (ms) of a device connection */
  maxLifetime: number;
  /** Default baud rate for connections */
  defaultBaudRate: number;
}

/**
 * Acquisition options for serial devices
 */
interface SerialAcquisitionOptions {
  timeout?: number;
  portName?: string;
  baudRate?: number;
}

/**
 * Default serial device pool configuration
 */
export const DEFAULT_SERIAL_POOL_CONFIG: SerialDevicePoolConfig = {
  maxDevices: 8,
  idleTimeout: 60000, // 1 minute
  maxLifetime: 600000, // 10 minutes
  defaultBaudRate: 9600,
};

/**
 * Serial Device Pool
 *
 * Manages serial device connections with pooling and lifecycle management.
 */
export class SerialDevicePool {
  readonly componentId: ComponentId = "serial-pool";
  private instances: Map<string, SerialDeviceInstance> = new Map();
  private config: SerialDevicePoolConfig;
  private eventCoordinator?: EventCoordinator;
  private eventListeners: RuntimeEventListener[] = [];
  private cleanupIntervalId?: number;
  private started = false;

  // Statistics
  private totalOpened = 0;
  private totalClosed = 0;
  private totalErrors = 0;
  private lifetimes: number[] = [];
  private useCounts: number[] = [];

  private nextInstanceId = 1;

  constructor(
    config: Partial<SerialDevicePoolConfig> = {},
    eventCoordinator?: EventCoordinator,
  ) {
    this.config = { ...DEFAULT_SERIAL_POOL_CONFIG, ...config };
    this.eventCoordinator = eventCoordinator;
  }

  /**
   * Start the serial device pool
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.startCleanupIntervals();
    await Promise.resolve(); // Maintain async signature for consistency
  }

  /**
   * Stop the pool and close all devices
   */
  async stop(): Promise<void> {
    if (!this.started) return;

    // Clear cleanup intervals
    if (this.cleanupIntervalId !== undefined) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }

    // Close all devices
    const closePromises: Promise<void>[] = [];
    for (const instance of this.instances.values()) {
      if (instance.state !== "closed") {
        closePromises.push(this.closeInstance(instance));
      }
    }
    await Promise.all(closePromises);

    this.instances.clear();
    this.started = false;
  }

  /**
   * Acquire a serial device from the pool
   */
  async acquire(options: SerialAcquisitionOptions = {}): Promise<SerialDeviceInstance> {
    if (!options.portName) {
      throw new Error("portName is required to acquire a serial device");
    }
    const timeout = options.timeout ?? 5000;

    // If a specific port is requested, check if we already have an idle connection to it
    if (options.portName) {
      for (const instance of this.instances.values()) {
        if (
          instance.state === "idle" &&
          instance.portName === options.portName
        ) {
          return this.markInUse(instance);
        }
      }
    }

    // Create new instance if under limit
    if (this.instances.size < this.config.maxDevices) {
      const instance = await this.createInstance(
        options.portName,
        options.baudRate ?? this.config.defaultBaudRate,
      );
      return this.markInUse(instance);
    }

    // Pool exhausted — wait with timeout
    return new Promise<SerialDeviceInstance>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Failed to acquire serial device: pool exhausted and timeout reached"));
      }, timeout);

      // Poll for availability
      const pollInterval = setInterval(() => {
        for (const instance of this.instances.values()) {
          if (instance.state === "idle") {
            clearTimeout(timer);
            clearInterval(pollInterval);
            resolve(this.markInUse(instance));
            return;
          }
        }
      }, 100);
    });
  }

  /**
   * Release a serial device back to the pool
   */
  release(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    if (instance.state === "in_use") {
      instance.state = "idle";
      instance.lastUsedAt = Date.now();
      this.emitEvent({
        type: "serial_device_released" as RuntimeEvent["type"],
        instanceId,
      } as RuntimeEvent);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): SerialDevicePoolStats {
    let idleCount = 0;
    let inUseCount = 0;
    for (const instance of this.instances.values()) {
      if (instance.state === "idle") idleCount++;
      if (instance.state === "in_use") inUseCount++;
    }

    const avgLifetime = this.lifetimes.length > 0
      ? this.lifetimes.reduce((a, b) => a + b, 0) / this.lifetimes.length
      : 0;
    const avgUseCount = this.useCounts.length > 0
      ? this.useCounts.reduce((a, b) => a + b, 0) / this.useCounts.length
      : 0;

    return {
      totalDevices: this.instances.size,
      idleDevices: idleCount,
      inUseDevices: inUseCount,
      maxDevices: this.config.maxDevices,
      totalOpened: this.totalOpened,
      totalClosed: this.totalClosed,
      totalErrors: this.totalErrors,
      averageLifetime: avgLifetime,
      averageUseCount: avgUseCount,
    };
  }

  /**
   * Get resource stats for runtime health reporting
   */
  getResourceStats(): ResourceStats {
    const stats = this.getStats();
    return {
      allocated: stats.inUseDevices,
      available: stats.maxDevices - stats.totalDevices,
      total: stats.maxDevices,
      utilization: stats.totalDevices > 0
        ? stats.inUseDevices / stats.totalDevices
        : 0,
    };
  }

  /**
   * Register an event listener
   */
  addEventListener(listener: RuntimeEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove an event listener
   */
  removeEventListener(listener: RuntimeEventListener): void {
    const idx = this.eventListeners.indexOf(listener);
    if (idx !== -1) this.eventListeners.splice(idx, 1);
  }

  // =========================================================================
  // Private methods
  // =========================================================================

  private async createInstance(
    portName: string,
    baudRate: number,
  ): Promise<SerialDeviceInstance> {
    const id = `serial-${this.nextInstanceId++}`;

    // Create device via browser device layer
    let device: unknown;
    try {
      const deviceModule = await import("@browserx/browser");
      const serialDevice = new (deviceModule as Record<string, unknown>).SerialDevice();
      if (portName) {
        await (serialDevice as { open: (name: string, opts: Record<string, unknown>) => Promise<boolean> })
          .open(portName, { baudRate });
      }
      device = serialDevice;
    } catch {
      // Device layer not available — create placeholder instance
    }

    const instance: SerialDeviceInstance = {
      id,
      state: "idle",
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      useCount: 0,
      portName,
      baudRate,
      device,
    };

    this.instances.set(id, instance);
    this.totalOpened++;

    this.emitEvent({
      type: "serial_device_opened" as RuntimeEvent["type"],
      instanceId: id,
      portName,
    } as RuntimeEvent);

    return instance;
  }

  private markInUse(instance: SerialDeviceInstance): SerialDeviceInstance {
    instance.state = "in_use";
    instance.lastUsedAt = Date.now();
    instance.useCount++;
    return instance;
  }

  private async closeInstance(instance: SerialDeviceInstance): Promise<void> {
    instance.state = "closing";

    try {
      if (instance.device) {
        const dev = instance.device as { close: () => boolean };
        dev.close();
      }
    } catch {
      this.totalErrors++;
    }

    const lifetime = Date.now() - instance.createdAt;
    this.lifetimes.push(lifetime);
    this.useCounts.push(instance.useCount);
    // Keep last 100 entries for averaging
    if (this.lifetimes.length > 100) this.lifetimes.shift();
    if (this.useCounts.length > 100) this.useCounts.shift();

    instance.state = "closed";
    this.instances.delete(instance.id);
    this.totalClosed++;

    this.emitEvent({
      type: "serial_device_closed" as RuntimeEvent["type"],
      instanceId: instance.id,
      reason: "pool_cleanup",
    } as RuntimeEvent);

    await Promise.resolve();
  }

  private startCleanupIntervals(): void {
    this.cleanupIntervalId = setInterval(async () => {
      await this.cleanupIdleInstances();
      await this.cleanupExpiredInstances();
    }, 10000) as unknown as number;
  }

  private async cleanupIdleInstances(): Promise<void> {
    const now = Date.now();
    const toClose: SerialDeviceInstance[] = [];
    for (const instance of this.instances.values()) {
      if (
        instance.state === "idle" &&
        now - instance.lastUsedAt > this.config.idleTimeout
      ) {
        toClose.push(instance);
      }
    }
    for (const instance of toClose) {
      await this.closeInstance(instance);
    }
  }

  private async cleanupExpiredInstances(): Promise<void> {
    const now = Date.now();
    const toClose: SerialDeviceInstance[] = [];
    for (const instance of this.instances.values()) {
      if (
        instance.state === "idle" &&
        now - instance.createdAt > this.config.maxLifetime
      ) {
        toClose.push(instance);
      }
    }
    for (const instance of toClose) {
      await this.closeInstance(instance);
    }
  }

  private emitEvent(event: RuntimeEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }

    if (this.eventCoordinator) {
      try {
        (this.eventCoordinator as { emitExternalEvent: (e: RuntimeEvent) => void })
          .emitExternalEvent(event);
      } catch {
        // Ignore coordinator errors
      }
    }
  }
}
