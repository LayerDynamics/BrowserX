/**
 * Health Checker
 *
 * Performs health checks on all runtime components and
 * provides overall health status.
 */

import type {
  ComponentHealthCheck,
  ComponentId,
  HealthCheckResult,
  HealthStatus,
  RuntimeEvent,
  RuntimeEventListener,
} from "../types.ts";
import type { MetricsConfig } from "../config/RuntimeConfig.ts";

/**
 * Health check handler function
 */
export type HealthCheckHandler = () => Promise<{
  status: HealthStatus;
  message?: string;
}>;

/**
 * Health Checker
 *
 * Manages health checks for all runtime components.
 */
export class HealthChecker {
  private config: MetricsConfig;
  private eventListeners: RuntimeEventListener[] = [];
  private healthCheckHandlers: Map<ComponentId, HealthCheckHandler> = new Map();
  private lastCheckResult: HealthCheckResult | null = null;
  private checkIntervalId?: number;
  private started = false;

  constructor(config: MetricsConfig) {
    this.config = config;
  }

  /**
   * Start the health checker
   */
  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;

    // Start periodic health checks
    if (this.config.healthCheckInterval > 0) {
      this.checkIntervalId = setInterval(() => {
        this.performHealthCheck().catch((error) => {
          console.error("[HealthChecker] Health check error:", error);
        });
      }, this.config.healthCheckInterval);
    }
  }

  /**
   * Stop the health checker
   */
  stop(): void {
    if (!this.started) {
      return;
    }

    if (this.checkIntervalId !== undefined) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = undefined;
    }

    this.started = false;
  }

  /**
   * Register a health check handler for a component
   */
  registerHandler(componentId: ComponentId, handler: HealthCheckHandler): void {
    this.healthCheckHandlers.set(componentId, handler);
  }

  /**
   * Unregister a health check handler
   */
  unregisterHandler(componentId: ComponentId): void {
    this.healthCheckHandlers.delete(componentId);
  }

  /**
   * Perform health check on all components
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const components: ComponentHealthCheck[] = [];
    const startTime = Date.now();

    for (const [componentId, handler] of this.healthCheckHandlers.entries()) {
      const checkStart = Date.now();

      try {
        const result = await handler();

        components.push({
          componentId,
          status: result.status,
          message: result.message,
          latency: Date.now() - checkStart,
          lastCheck: Date.now(),
        });
      } catch (error) {
        components.push({
          componentId,
          status: "unhealthy",
          message: error instanceof Error ? error.message : String(error),
          latency: Date.now() - checkStart,
          lastCheck: Date.now(),
        });
      }
    }

    // Calculate overall status
    let overallStatus: HealthStatus = "healthy";

    for (const component of components) {
      if (component.status === "unhealthy") {
        overallStatus = "unhealthy";
        break;
      } else if (component.status === "degraded") {
        // Only upgrade to degraded if not already degraded
        overallStatus = "degraded";
      }
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      components,
      timestamp: Date.now(),
    };

    this.lastCheckResult = result;

    // Emit health check event
    this.emitEvent({
      type: "health_check",
      status: overallStatus,
      details: result,
    });

    return result;
  }

  /**
   * Get last health check result
   */
  getLastCheckResult(): HealthCheckResult | null {
    return this.lastCheckResult;
  }

  /**
   * Get current health status (quick check)
   */
  async getHealthStatus(): Promise<HealthCheckResult> {
    // If we have a recent result (within 10 seconds), return it
    if (
      this.lastCheckResult &&
      Date.now() - this.lastCheckResult.timestamp < 10000
    ) {
      return this.lastCheckResult;
    }

    // Otherwise perform a new check
    return this.performHealthCheck();
  }

  /**
   * Check if a specific component is healthy
   */
  async isComponentHealthy(componentId: ComponentId): Promise<boolean> {
    const handler = this.healthCheckHandlers.get(componentId);
    if (!handler) {
      return true; // No handler means we assume healthy
    }

    try {
      const result = await handler();
      return result.status === "healthy";
    } catch {
      return false;
    }
  }

  /**
   * Create simple health check handler that always returns healthy
   */
  static createSimpleHandler(status: HealthStatus = "healthy"): HealthCheckHandler {
    return async () => ({ status });
  }

  /**
   * Create health check handler from a boolean function
   */
  static createBooleanHandler(
    check: () => boolean | Promise<boolean>,
    healthyMessage = "OK",
    unhealthyMessage = "Check failed",
  ): HealthCheckHandler {
    return async () => {
      const result = await check();
      return {
        status: result ? "healthy" : "unhealthy",
        message: result ? healthyMessage : unhealthyMessage,
      };
    };
  }

  /**
   * Get configuration
   */
  getConfig(): MetricsConfig {
    return { ...this.config };
  }

  /**
   * Check if health checker is running
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

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: RuntimeEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}
