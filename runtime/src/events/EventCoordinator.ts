/**
 * Event Coordinator
 *
 * Coordinates event loops across the BrowserX runtime system.
 * Manages the proxy engine's global event loop and browser-specific event loops.
 *
 * Key responsibilities:
 * - Start/stop proxy engine event loop
 * - Create and manage browser event loops for each browser instance
 * - Track event loop statistics
 * - Coordinate shutdown across all event loops
 */

import type {
  EventLoopStats,
  RuntimeEvent,
  RuntimeEventListener,
} from "../types.ts";
import type { EventLoopConfig } from "../config/RuntimeConfig.ts";

/**
 * Browser event loop handle
 */
export interface BrowserEventLoopHandle {
  id: string;
  browserId: string;
  createdAt: number;
  isRunning: () => boolean;
  stop: () => void;
  getStats: () => Record<string, unknown>;
}

/**
 * Event coordinator statistics
 */
export interface EventCoordinatorStats {
  proxyLoopRunning: boolean;
  browserLoopsActive: number;
  proxyTasksQueued: number;
  proxyTimersActive: number;
  browserLoops: Array<{
    id: string;
    browserId: string;
    running: boolean;
    stats: Record<string, unknown>;
  }>;
}

/**
 * Event Coordinator
 *
 * Manages all event loops in the BrowserX runtime.
 */
/** Maximum number of queued events before dropping oldest */
const MAX_QUEUE_DEPTH = 10000;

export class EventCoordinator {
  private proxyEventLoop: ProxyEventLoop | null = null;
  private browserEventLoops: Map<string, BrowserEventLoopHandle> = new Map();
  private eventListeners: RuntimeEventListener[] = [];
  private eventQueue: RuntimeEvent[] = [];
  private config: EventLoopConfig;
  private started = false;
  private proxyLoopPromise: Promise<void> | null = null;
  private droppedEventCount = 0;

  constructor(config: EventLoopConfig) {
    this.config = config;
  }

  /**
   * Start the event coordinator
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;

    if (this.config.enabled) {
      await this.startProxyEventLoop();
    }
  }

  /**
   * Start the proxy engine event loop
   */
  private async startProxyEventLoop(): Promise<void> {
    try {
      // Dynamically import the proxy event loop to avoid circular dependencies
      const proxyEventModule = await import(
        "@browserx/proxy-engine/core/event/loop.ts"
      );

      this.proxyEventLoop = proxyEventModule.globalEventLoop;

      if (this.proxyEventLoop && !this.proxyEventLoop.isRunning()) {
        // Run the event loop in the background
        this.proxyLoopPromise = this.runProxyLoop();

        this.emitEvent({
          type: "event_loop_started",
          loopType: "proxy",
        });
      }
    } catch (error) {
      console.warn(
        "[EventCoordinator] Failed to start proxy event loop:",
        error,
      );
      // Non-fatal - proxy event loop is optional
    }
  }

  /**
   * Run the proxy event loop (non-blocking)
   */
  private async runProxyLoop(): Promise<void> {
    if (!this.proxyEventLoop) {
      return;
    }

    try {
      // The run() method runs indefinitely until stop() is called
      await this.proxyEventLoop.run();
    } catch (error) {
      console.error("[EventCoordinator] Proxy event loop error:", error);
    }
  }

  /**
   * Stop the proxy event loop
   */
  private stopProxyEventLoop(): void {
    if (this.proxyEventLoop) {
      this.proxyEventLoop.stop();
      this.proxyEventLoop = null;
      this.proxyLoopPromise = null;

      this.emitEvent({
        type: "event_loop_stopped",
        loopType: "proxy",
      });
    }
  }

  /**
   * Create and register a browser event loop
   */
  async createBrowserEventLoop(
    browserId: string,
  ): Promise<BrowserEventLoopHandle> {
    const loopId = `browser-${browserId}-${Date.now()}`;

    try {
      // Dynamically import browser event loop
      const browserEventModule = await import(
        "@browserx/browser/src/engine/javascript/EventLoop.ts"
      );

      const eventLoop = browserEventModule.EventLoopFactory.createWithConfig({
        maxMicrotasksPerCycle: this.config.maxMicrotasksPerCycle,
        targetFrameRate: this.config.targetFrameRate,
        enableIdleTasks: this.config.enableIdleTasks,
      });

      // Start the event loop
      eventLoop.start();

      const handle: BrowserEventLoopHandle = {
        id: loopId,
        browserId,
        createdAt: Date.now(),
        isRunning: () => eventLoop.isRunning(),
        stop: () => {
          eventLoop.stop();
          this.browserEventLoops.delete(loopId);

          this.emitEvent({
            type: "event_loop_stopped",
            loopType: "browser",
            id: loopId,
          });
        },
        getStats: () => eventLoop.getStats() as unknown as Record<string, unknown>,
      };

      this.browserEventLoops.set(loopId, handle);

      this.emitEvent({
        type: "event_loop_started",
        loopType: "browser",
        id: loopId,
      });

      return handle;
    } catch (error) {
      console.error(
        `[EventCoordinator] Failed to create browser event loop for ${browserId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get a browser event loop by ID
   */
  getBrowserEventLoop(loopId: string): BrowserEventLoopHandle | undefined {
    return this.browserEventLoops.get(loopId);
  }

  /**
   * Get all browser event loops for a browser ID
   */
  getBrowserEventLoopsForBrowser(browserId: string): BrowserEventLoopHandle[] {
    return Array.from(this.browserEventLoops.values()).filter(
      (handle) => handle.browserId === browserId,
    );
  }

  /**
   * Stop all browser event loops for a browser
   */
  stopBrowserEventLoops(browserId: string): void {
    const handles = this.getBrowserEventLoopsForBrowser(browserId);
    for (const handle of handles) {
      handle.stop();
    }
  }

  /**
   * Stop the event coordinator and all event loops
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    // Stop all browser event loops first
    for (const handle of this.browserEventLoops.values()) {
      handle.stop();
    }
    this.browserEventLoops.clear();

    // Stop proxy event loop
    this.stopProxyEventLoop();

    // Wait for proxy loop to finish if running
    if (this.proxyLoopPromise) {
      try {
        await Promise.race([
          this.proxyLoopPromise,
          new Promise((resolve) => setTimeout(resolve, 1000)), // 1s timeout
        ]);
      } catch {
        // Ignore errors during shutdown
      }
    }

    this.started = false;
  }

  /**
   * Check if event coordinator is running
   */
  isRunning(): boolean {
    return this.started;
  }

  /**
   * Check if proxy event loop is running
   */
  isProxyLoopRunning(): boolean {
    return this.proxyEventLoop?.isRunning() ?? false;
  }

  /**
   * Get number of active browser event loops
   */
  getActiveBrowserLoopCount(): number {
    let count = 0;
    for (const handle of this.browserEventLoops.values()) {
      if (handle.isRunning()) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get event coordinator statistics
   */
  getStats(): EventCoordinatorStats {
    const proxyStats = this.proxyEventLoop?.getStats?.() ?? {
      macroTaskCount: 0,
      timerCount: 0,
    };

    const browserLoopStats = Array.from(this.browserEventLoops.values()).map(
      (handle) => ({
        id: handle.id,
        browserId: handle.browserId,
        running: handle.isRunning(),
        stats: handle.getStats(),
      }),
    );

    return {
      proxyLoopRunning: this.isProxyLoopRunning(),
      browserLoopsActive: this.getActiveBrowserLoopCount(),
      proxyTasksQueued:
        (proxyStats as Record<string, number>).macroTaskCount ?? 0,
      proxyTimersActive:
        (proxyStats as Record<string, number>).timerCount ?? 0,
      browserLoops: browserLoopStats,
    };
  }

  /**
   * Get runtime event loop stats (for RuntimeStats)
   */
  getEventLoopStats(): EventLoopStats {
    return {
      proxyLoopRunning: this.isProxyLoopRunning(),
      browserLoopsActive: this.getActiveBrowserLoopCount(),
      proxyTasksQueued:
        (this.proxyEventLoop?.getStats?.() as Record<string, number>)
          ?.macroTaskCount ?? 0,
      proxyTimersActive:
        (this.proxyEventLoop?.getStats?.() as Record<string, number>)
          ?.timerCount ?? 0,
    };
  }

  /**
   * Queue a task on the proxy event loop
   */
  queueProxyTask(
    task: () => Promise<void>,
    priority: "high" | "normal" | "low" = "normal",
  ): number | null {
    if (!this.proxyEventLoop) {
      console.warn(
        "[EventCoordinator] Cannot queue task: proxy event loop not running",
      );
      return null;
    }

    return this.proxyEventLoop.queueMacroTask(task, priority);
  }

  /**
   * Queue a microtask on the proxy event loop
   */
  queueProxyMicrotask(task: () => Promise<void>): number | null {
    if (!this.proxyEventLoop) {
      console.warn(
        "[EventCoordinator] Cannot queue microtask: proxy event loop not running",
      );
      return null;
    }

    return this.proxyEventLoop.queueMicroTask(task);
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

  /**
   * Get the number of events dropped due to backpressure
   */
  getDroppedEventCount(): number {
    return this.droppedEventCount;
  }

  /**
   * Emit event to all listeners with backpressure
   */
  private emitEvent(event: RuntimeEvent): void {
    // Backpressure: if queue exceeds max depth, drop oldest events
    this.eventQueue.push(event);
    if (this.eventQueue.length > MAX_QUEUE_DEPTH) {
      const dropped = this.eventQueue.length - MAX_QUEUE_DEPTH;
      this.eventQueue.splice(0, dropped);
      this.droppedEventCount += dropped;
      console.warn(
        `[EventCoordinator] Backpressure: dropped ${dropped} oldest events (total dropped: ${this.droppedEventCount})`,
      );
    }

    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

/**
 * Proxy event loop interface (imported dynamically)
 */
interface ProxyEventLoop {
  run(): Promise<void>;
  stop(): void;
  isRunning(): boolean;
  getStats(): Record<string, unknown>;
  queueMacroTask(
    task: () => Promise<void>,
    priority: "high" | "normal" | "low",
  ): number;
  queueMicroTask(task: () => Promise<void>): number;
}
