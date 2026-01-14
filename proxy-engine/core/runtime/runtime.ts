/**
 * Runtime
 *
 * Main runtime coordinator for the proxy engine.
 * Manages lifecycle, configuration, and orchestrates all layers.
 */

import { GatewayServer } from "../../gateway/server/gateway_server.ts";
import type { GatewayServerConfig } from "../../gateway/server/gateway_server.ts";
import type { Route } from "../../gateway/router/request_router.ts";
import { MiddlewareChain } from "../../gateway/middleware/middleware_chain.ts";
import type { MiddlewareChainConfig } from "../../gateway/middleware/types.ts";

/**
 * Runtime state
 */
export enum RuntimeState {
  STOPPED = "stopped",
  STARTING = "starting",
  RUNNING = "running",
  STOPPING = "stopping",
  ERROR = "error",
}

/**
 * Runtime configuration
 */
export interface RuntimeConfig {
  /**
   * Gateway servers to run
   */
  gateways: GatewayServerConfig[];

  /**
   * Enable graceful shutdown
   */
  gracefulShutdown?: boolean;

  /**
   * Graceful shutdown timeout (ms)
   */
  gracefulShutdownTimeout?: number;

  /**
   * Enable signal handling (SIGTERM, SIGINT)
   */
  handleSignals?: boolean;

  /**
   * Environment (development, production, test)
   */
  environment?: "development" | "production" | "test";

  /**
   * Log level
   */
  logLevel?: "debug" | "info" | "warn" | "error";

  /**
   * Enable metrics collection
   */
  metrics?: boolean;

  /**
   * Metrics port
   */
  metricsPort?: number;

  /**
   * Metrics server hostname
   */
  metricsHost?: string;
}

/**
 * Runtime statistics
 */
export interface RuntimeStats {
  /**
   * Current state
   */
  state: RuntimeState;

  /**
   * Uptime (ms)
   */
  uptime: number;

  /**
   * Number of active gateways
   */
  activeGateways: number;

  /**
   * Gateway statistics
   */
  gateways: Array<{
    host: string;
    port: number;
    stats: any;
  }>;

  /**
   * Memory usage
   */
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

/**
 * Runtime event type
 */
export type RuntimeEvent =
  | { type: "starting" }
  | { type: "started" }
  | { type: "stopping"; reason: string }
  | { type: "stopped" }
  | { type: "error"; error: Error }
  | { type: "gateway_started"; host: string; port: number }
  | { type: "gateway_stopped"; host: string; port: number };

/**
 * Runtime event listener
 */
export type RuntimeEventListener = (event: RuntimeEvent) => void;

/**
 * Proxy engine runtime
 */
export class Runtime {
  private state: RuntimeState = RuntimeState.STOPPED;
  private gateways: GatewayServer[] = [];
  private startTime = 0;
  private shutdownPromise?: Promise<void>;
  private eventListeners: RuntimeEventListener[] = [];
  private signalHandlersRegistered = false;

  constructor(private config: RuntimeConfig) {
    // Set defaults
    this.config.gracefulShutdown = config.gracefulShutdown ?? true;
    this.config.gracefulShutdownTimeout = config.gracefulShutdownTimeout ?? 30000;
    this.config.handleSignals = config.handleSignals ?? true;
    this.config.environment = config.environment ?? "production";
    this.config.logLevel = config.logLevel ?? "info";
    this.config.metrics = config.metrics ?? false;
  }

  /**
   * Start runtime
   */
  async start(): Promise<void> {
    if (this.state !== RuntimeState.STOPPED) {
      throw new Error(`Cannot start runtime in state: ${this.state}`);
    }

    try {
      this.setState(RuntimeState.STARTING);
      this.emitEvent({ type: "starting" });

      this.log("info", "Starting proxy engine runtime...");

      // Register signal handlers
      if (this.config.handleSignals) {
        this.registerSignalHandlers();
      }

      // Start gateway servers
      await this.startGateways();

      // Start metrics server if enabled
      if (this.config.metrics && this.config.metricsPort) {
        await this.startMetricsServer();
      }

      this.startTime = Date.now();
      this.setState(RuntimeState.RUNNING);
      this.emitEvent({ type: "started" });

      this.log("info", "Proxy engine runtime started successfully");
    } catch (error) {
      this.setState(RuntimeState.ERROR);
      this.emitEvent({
        type: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Start all gateway servers
   */
  private async startGateways(): Promise<void> {
    for (const config of this.config.gateways) {
      try {
        const gateway = new GatewayServer(config);
        this.gateways.push(gateway);

        // Start gateway in background
        gateway.start().catch((error) => {
          this.log("error", `Gateway ${config.host}:${config.port} error:`, error);
          this.emitEvent({
            type: "error",
            error: error instanceof Error ? error : new Error(String(error)),
          });
        });

        this.emitEvent({
          type: "gateway_started",
          host: config.host,
          port: config.port,
        });

        this.log("info", `Gateway started on ${config.host}:${config.port}`);
      } catch (error) {
        this.log("error", `Failed to start gateway ${config.host}:${config.port}:`, error);
        throw error;
      }
    }
  }

  private metricsServer?: Deno.HttpServer;

  /**
   * Start metrics server
   */
  private async startMetricsServer(): Promise<void> {
    if (!this.config.metricsPort) {
      return;
    }

    const port = this.config.metricsPort;
    const hostname = this.config.metricsHost || "127.0.0.1";

    this.log("info", `Starting metrics server on ${hostname}:${port}`);

    const handler = async (request: Request): Promise<Response> => {
      const url = new URL(request.url);

      if (url.pathname === "/metrics") {
        try {
          const stats = this.getStats();
          const metrics = this.formatPrometheusMetrics(stats);
          return new Response(metrics, {
            status: 200,
            headers: {
              "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
            },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return new Response(`Error exporting metrics: ${errorMessage}`, {
            status: 500,
          });
        }
      } else if (url.pathname === "/health") {
        const health = {
          status: "healthy",
          uptime: Date.now() - this.startTime,
          timestamp: new Date().toISOString(),
        };
        return new Response(JSON.stringify(health, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      } else {
        return new Response("Not Found\n\nAvailable endpoints:\n  /metrics\n  /health", {
          status: 404,
        });
      }
    };

    try {
      this.metricsServer = Deno.serve({
        port,
        hostname,
        onListen: ({ hostname, port }) => {
          this.log("info", `Metrics server listening on http://${hostname}:${port}/metrics`);
        },
      }, handler);
    } catch (error) {
      this.log("error", `Failed to start metrics server: ${error}`);
      throw error;
    }
  }

  /**
   * Stop runtime
   */
  async shutdown(reason = "Manual shutdown"): Promise<void> {
    // Return existing shutdown promise if already shutting down
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = this.performShutdown(reason);
    return this.shutdownPromise;
  }

  /**
   * Perform shutdown
   */
  private async performShutdown(reason: string): Promise<void> {
    if (this.state === RuntimeState.STOPPED || this.state === RuntimeState.STOPPING) {
      return;
    }

    try {
      this.setState(RuntimeState.STOPPING);
      this.emitEvent({ type: "stopping", reason });

      this.log("info", `Shutting down proxy engine runtime: ${reason}`);

      if (this.config.gracefulShutdown) {
        await this.gracefulShutdown();
      } else {
        await this.forceShutdown();
      }

      this.setState(RuntimeState.STOPPED);
      this.emitEvent({ type: "stopped" });

      this.log("info", "Proxy engine runtime stopped");
    } catch (error) {
      this.log("error", "Error during shutdown:", error);
      this.setState(RuntimeState.ERROR);
      throw error;
    }
  }

  /**
   * Graceful shutdown - wait for active connections to finish
   */
  private async gracefulShutdown(): Promise<void> {
    const shutdownStart = Date.now();
    const timeout = this.config.gracefulShutdownTimeout!;

    this.log("info", `Starting graceful shutdown (timeout: ${timeout}ms)`);

    // Stop accepting new connections
    const shutdownPromises = this.gateways.map(async (gateway, index) => {
      const config = this.config.gateways[index];
      try {
        await gateway.shutdown();
        this.emitEvent({
          type: "gateway_stopped",
          host: config.host,
          port: config.port,
        });
        this.log("info", `Gateway ${config.host}:${config.port} stopped gracefully`);
      } catch (error) {
        this.log("error", `Error shutting down gateway ${config.host}:${config.port}:`, error);
      }
    });

    // Wait for all gateways to shutdown or timeout
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        this.log("warn", "Graceful shutdown timeout reached, forcing shutdown");
        resolve();
      }, timeout);
    });

    await Promise.race([
      Promise.all(shutdownPromises),
      timeoutPromise,
    ]);

    const shutdownDuration = Date.now() - shutdownStart;
    this.log("info", `Graceful shutdown completed in ${shutdownDuration}ms`);

    this.gateways = [];

    // Shutdown metrics server
    if (this.metricsServer) {
      try {
        await this.metricsServer.shutdown();
        this.log("info", "Metrics server stopped");
      } catch (error) {
        this.log("error", "Error stopping metrics server:", error);
      }
    }
  }

  /**
   * Force shutdown - immediately close all connections
   */
  private async forceShutdown(): Promise<void> {
    this.log("info", "Forcing immediate shutdown");

    for (let i = 0; i < this.gateways.length; i++) {
      const gateway = this.gateways[i];
      const config = this.config.gateways[i];

      try {
        await gateway.shutdown();
        this.emitEvent({
          type: "gateway_stopped",
          host: config.host,
          port: config.port,
        });
      } catch (error) {
        this.log("error", `Error during force shutdown of gateway:`, error);
      }
    }

    this.gateways = [];
  }

  /**
   * Register signal handlers
   */
  private registerSignalHandlers(): void {
    if (this.signalHandlersRegistered) {
      return;
    }

    const handleShutdownSignal = (signal: string) => {
      this.log("info", `Received ${signal}, initiating shutdown...`);
      this.shutdown(`Signal: ${signal}`).catch((error) => {
        this.log("error", "Error during signal shutdown:", error);
        Deno.exit(1);
      });
    };

    // Handle SIGTERM (graceful termination)
    Deno.addSignalListener("SIGTERM", () => handleShutdownSignal("SIGTERM"));

    // Handle SIGINT (Ctrl+C)
    Deno.addSignalListener("SIGINT", () => handleShutdownSignal("SIGINT"));

    this.signalHandlersRegistered = true;
    this.log("debug", "Signal handlers registered");
  }

  /**
   * Get runtime statistics
   */
  getStats(): RuntimeStats {
    const uptime = this.state === RuntimeState.RUNNING ? Date.now() - this.startTime : 0;

    const gatewayStats = this.gateways.map((gateway, index) => {
      const config = this.config.gateways[index];
      return {
        host: config.host,
        port: config.port,
        stats: gateway.getStats(),
      };
    });

    // Get memory usage
    const memoryUsage = Deno.memoryUsage();

    return {
      state: this.state,
      uptime,
      activeGateways: this.gateways.length,
      gateways: gatewayStats,
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
      },
    };
  }

  /**
   * Format runtime statistics as Prometheus metrics
   */
  private formatPrometheusMetrics(stats: RuntimeStats): string {
    let output = "";

    // Runtime state
    output += `# HELP proxy_engine_state Runtime state (0=stopped, 1=starting, 2=running, 3=stopping, 4=error)\n`;
    output += `# TYPE proxy_engine_state gauge\n`;
    const stateValue = {
      stopped: 0,
      starting: 1,
      running: 2,
      stopping: 3,
      error: 4,
    }[stats.state];
    output += `proxy_engine_state ${stateValue}\n\n`;

    // Uptime
    output += `# HELP proxy_engine_uptime_seconds Runtime uptime in seconds\n`;
    output += `# TYPE proxy_engine_uptime_seconds counter\n`;
    output += `proxy_engine_uptime_seconds ${stats.uptime / 1000}\n\n`;

    // Active gateways
    output += `# HELP proxy_engine_active_gateways Number of active gateway servers\n`;
    output += `# TYPE proxy_engine_active_gateways gauge\n`;
    output += `proxy_engine_active_gateways ${stats.activeGateways}\n\n`;

    // Memory metrics
    output += `# HELP proxy_engine_memory_heap_used_bytes Heap memory used in bytes\n`;
    output += `# TYPE proxy_engine_memory_heap_used_bytes gauge\n`;
    output += `proxy_engine_memory_heap_used_bytes ${stats.memory.heapUsed}\n\n`;

    output += `# HELP proxy_engine_memory_heap_total_bytes Total heap memory in bytes\n`;
    output += `# TYPE proxy_engine_memory_heap_total_bytes gauge\n`;
    output += `proxy_engine_memory_heap_total_bytes ${stats.memory.heapTotal}\n\n`;

    output += `# HELP proxy_engine_memory_rss_bytes Resident set size in bytes\n`;
    output += `# TYPE proxy_engine_memory_rss_bytes gauge\n`;
    output += `proxy_engine_memory_rss_bytes ${stats.memory.rss}\n\n`;

    return output;
  }

  /**
   * Get current state
   */
  getState(): RuntimeState {
    return this.state;
  }

  /**
   * Check if runtime is running
   */
  isRunning(): boolean {
    return this.state === RuntimeState.RUNNING;
  }

  /**
   * Get all gateway servers
   */
  getGatewayServers(): GatewayServer[] {
    return [...this.gateways];
  }

  /**
   * Get runtime configuration
   */
  getConfig(): RuntimeConfig {
    return this.config;
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
   * Emit runtime event
   */
  private emitEvent(event: RuntimeEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        this.log("error", "Error in event listener:", error);
      }
    }
  }

  /**
   * Set runtime state
   */
  private setState(state: RuntimeState): void {
    this.state = state;
  }

  /**
   * Log message
   */
  private log(level: "debug" | "info" | "warn" | "error", message: string, ...args: any[]): void {
    const levels = ["debug", "info", "warn", "error"];
    const configLevel = this.config.logLevel || "info";

    if (levels.indexOf(level) >= levels.indexOf(configLevel)) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}] [Runtime]`;

      switch (level) {
        case "debug":
          console.debug(prefix, message, ...args);
          break;
        case "info":
          console.info(prefix, message, ...args);
          break;
        case "warn":
          console.warn(prefix, message, ...args);
          break;
        case "error":
          console.error(prefix, message, ...args);
          break;
      }
    }
  }
}
