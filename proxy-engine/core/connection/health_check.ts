/**
 * Health Checking System
 *
 * Monitors upstream server health using TCP, HTTP, or ping checks.
 * Tracks health state transitions based on thresholds.
 */

import { Socket } from "../network/transport/socket/socket.ts";
import { HTTP11Client } from "../network/transport/http/http.ts";
import type { HealthCheckConfig, UpstreamServer } from "../../gateway/router/request_router.ts";

/**
 * Health check result
 */
export interface HealthCheckResult {
  serverId: string;
  healthy: boolean;
  responseTime: number;
  checkedAt: number;
  error?: string;
}

/**
 * Server health state
 */
export interface ServerHealthState {
  serverId: string;
  healthy: boolean;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  lastCheckAt: number;
  lastSuccessAt: number;
  lastFailureAt: number;
  totalChecks: number;
  totalSuccesses: number;
  totalFailures: number;
}

/**
 * Health checker interface
 */
export interface HealthChecker {
  /**
   * Perform health check on a server
   */
  check(server: UpstreamServer): Promise<HealthCheckResult>;

  /**
   * Get health check type
   */
  getType(): "tcp" | "http" | "ping";
}

/**
 * TCP health checker
 * Checks if TCP connection can be established
 */
export class TCPHealthChecker implements HealthChecker {
  constructor(private config: HealthCheckConfig) {}

  async check(server: UpstreamServer): Promise<HealthCheckResult> {
    const startTime = Date.now();

    const socket = new Socket(server.host, server.port);
    try {
      await socket.connect(this.config.timeout);

      // Test if socket is writable
      const writable = await socket.isWritable();

      const responseTime = Date.now() - startTime;

      return {
        serverId: server.id,
        healthy: writable,
        responseTime,
        checkedAt: startTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        serverId: server.id,
        healthy: false,
        responseTime,
        checkedAt: startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      socket.close();
    }
  }

  getType(): "tcp" {
    return "tcp";
  }
}

/**
 * HTTP health checker
 * Sends HTTP GET request to health endpoint
 */
export class HTTPHealthChecker implements HealthChecker {
  constructor(private config: HealthCheckConfig) {}

  async check(server: UpstreamServer): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const path = this.config.httpPath || "/health";

    const socket = new Socket(server.host, server.port);
    try {
      await socket.connect(this.config.timeout);

      const client = new HTTP11Client(socket);
      const response = await client.sendRequest({
        method: "GET",
        uri: path,
        version: "1.1",
        headers: {
          host: `${server.host}:${server.port}`,
          connection: "close",
        },
      });

      const responseTime = Date.now() - startTime;
      const healthy = response.statusCode >= 200 && response.statusCode < 300;

      return {
        serverId: server.id,
        healthy,
        responseTime,
        checkedAt: startTime,
        error: healthy ? undefined : `HTTP ${response.statusCode} ${response.statusText}`,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        serverId: server.id,
        healthy: false,
        responseTime,
        checkedAt: startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      socket.close();
    }
  }

  getType(): "http" {
    return "http";
  }
}

/**
 * Ping health checker
 * Uses TCP connection test (similar to TCP checker but with different semantics)
 */
export class PingHealthChecker implements HealthChecker {
  constructor(private config: HealthCheckConfig) {}

  async check(server: UpstreamServer): Promise<HealthCheckResult> {
    const startTime = Date.now();

    const socket = new Socket(server.host, server.port);
    try {
      await socket.connect(this.config.timeout);

      const responseTime = Date.now() - startTime;

      return {
        serverId: server.id,
        healthy: true,
        responseTime,
        checkedAt: startTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        serverId: server.id,
        healthy: false,
        responseTime,
        checkedAt: startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      socket.close();
    }
  }

  getType(): "ping" {
    return "ping";
  }
}

/**
 * Create health checker based on config
 */
export function createHealthChecker(config: HealthCheckConfig): HealthChecker {
  switch (config.type) {
    case "tcp":
      return new TCPHealthChecker(config);
    case "http":
      return new HTTPHealthChecker(config);
    case "ping":
      return new PingHealthChecker(config);
    default:
      throw new Error(`Unknown health check type: ${config.type}`);
  }
}

/**
 * Health monitor manages health checks for multiple servers
 */
/**
 * Maximum health check backoff interval (5 minutes)
 */
const MAX_HEALTH_CHECK_BACKOFF = 300000;

export class HealthMonitor {
  private checker: HealthChecker;
  private states: Map<string, ServerHealthState> = new Map();
  private intervalId?: number;
  private running = false;
  private nextCheckTime: Map<string, number> = new Map();
  private initialCheckComplete = false;

  constructor(private config: HealthCheckConfig) {
    this.checker = createHealthChecker(config);
  }

  /**
   * Start periodic health checking
   */
  start(servers: UpstreamServer[]): void {
    if (this.running) {
      return;
    }

    this.running = true;

    // Initialize states
    for (const server of servers) {
      if (!this.states.has(server.id)) {
        this.states.set(server.id, this.createInitialState(server.id));
      }
    }

    // Perform initial check (mark complete when done)
    this.checkAllServers(servers).then(() => {
      this.initialCheckComplete = true;
    });

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkAllServers(servers);
    }, this.config.interval);
  }

  /**
   * Stop periodic health checking
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.running = false;
  }

  /**
   * Check all servers
   */
  private async checkAllServers(servers: UpstreamServer[]): Promise<void> {
    const checks = servers.map((server) => this.checkServer(server));
    await Promise.all(checks);
  }

  /**
   * Check a single server (with exponential backoff for failed servers)
   */
  private async checkServer(server: UpstreamServer): Promise<void> {
    // Apply exponential backoff: skip this check if not yet time
    const now = Date.now();
    const nextTime = this.nextCheckTime.get(server.id) ?? 0;
    if (now < nextTime) {
      return; // Skip — backoff period not yet elapsed
    }

    const result = await this.checker.check(server);
    this.updateState(result);

    // Schedule next check time based on consecutive failures
    const state = this.states.get(server.id);
    if (state && state.consecutiveFailures > 0) {
      const backoff = Math.min(
        this.config.interval * Math.pow(2, state.consecutiveFailures),
        MAX_HEALTH_CHECK_BACKOFF,
      );
      this.nextCheckTime.set(server.id, now + backoff);
    } else {
      // Healthy — use normal interval (no extra delay)
      this.nextCheckTime.delete(server.id);
    }
  }

  /**
   * Update server health state based on check result
   */
  private updateState(result: HealthCheckResult): void {
    const state = this.states.get(result.serverId) || this.createInitialState(result.serverId);

    state.lastCheckAt = result.checkedAt;
    state.totalChecks++;

    if (result.healthy) {
      state.consecutiveSuccesses++;
      state.consecutiveFailures = 0;
      state.lastSuccessAt = result.checkedAt;
      state.totalSuccesses++;

      // Transition to healthy if threshold met
      if (state.consecutiveSuccesses >= this.config.healthyThreshold) {
        state.healthy = true;
      }
    } else {
      state.consecutiveFailures++;
      state.consecutiveSuccesses = 0;
      state.lastFailureAt = result.checkedAt;
      state.totalFailures++;

      // Transition to unhealthy if threshold met
      if (state.consecutiveFailures >= this.config.unhealthyThreshold) {
        state.healthy = false;
      }
    }

    this.states.set(result.serverId, state);
  }

  /**
   * Get health state for a server
   */
  getServerState(serverId: string): ServerHealthState | null {
    return this.states.get(serverId) || null;
  }

  /**
   * Get all server states
   */
  getAllStates(): Map<string, ServerHealthState> {
    return new Map(this.states);
  }

  /**
   * Check if server is healthy
   */
  isHealthy(serverOrId: string | UpstreamServer): boolean {
    const serverId = typeof serverOrId === "string" ? serverOrId : serverOrId.id;
    const state = this.states.get(serverId);
    if (!state) return false;
    // Optimistic during startup: assume healthy until first check completes
    if (!this.initialCheckComplete && state.totalChecks === 0) return true;
    return state.healthy;
  }

  /**
   * Get all healthy servers
   */
  getHealthyServers(servers: UpstreamServer[]): UpstreamServer[] {
    return servers.filter((server) => this.isHealthy(server.id));
  }

  /**
   * Create initial health state
   */
  private createInitialState(serverId: string): ServerHealthState {
    return {
      serverId,
      healthy: false, // Unhealthy until first check passes
      consecutiveSuccesses: 0,
      consecutiveFailures: 0,
      lastCheckAt: 0,
      lastSuccessAt: 0,
      lastFailureAt: 0,
      totalChecks: 0,
      totalSuccesses: 0,
      totalFailures: 0,
    };
  }

  /**
   * Get the next scheduled check time for a server (used for backoff)
   */
  getNextCheckTime(serverId: string): number | undefined {
    return this.nextCheckTime.get(serverId);
  }

  /**
   * Reset all health states
   */
  reset(): void {
    this.states.clear();
    this.nextCheckTime.clear();
    this.initialCheckComplete = false;
  }

  /**
   * Get health checker instance
   */
  getChecker(): HealthChecker {
    return this.checker;
  }

  /**
   * Get configuration
   */
  getConfig(): HealthCheckConfig {
    return this.config;
  }

  /**
   * Get interval ID
   */
  getIntervalId(): number | undefined {
    return this.intervalId;
  }

  /**
   * Check if the initial health check round has completed
   */
  isReady(): boolean {
    return this.initialCheckComplete;
  }

  /**
   * Check if monitor is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get health check statistics
   */
  getStats() {
    const healthyCount = Array.from(this.states.values()).filter((s) => s.healthy).length;
    const unhealthyCount = this.states.size - healthyCount;

    return {
      totalServers: this.states.size,
      healthyServers: healthyCount,
      unhealthyServers: unhealthyCount,
      running: this.running,
      checkerType: this.checker.getType(),
    };
  }
}

// Export alias for test compatibility
export { HealthMonitor as HealthCheck };
