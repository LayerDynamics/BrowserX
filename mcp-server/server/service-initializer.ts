/**
 * Service Initializer
 * Lazy initialization of heavy services for MCP server
 *
 * Services are initialized on first use, not at server startup.
 * This enables:
 * - Fast server startup (<100ms to accept connections)
 * - Graceful degradation (if one service fails, others still work)
 * - Resource efficiency (don't init browser pool if only querying cache)
 */

import { QueryEngine, type IQueryEngine } from "@browserx/query-engine";
import {
  BrowserXRuntime,
  type BrowserXRuntimeConfig,
  createTestConfig,
} from "@browserx/runtime";
import { SessionManager, type SessionManagerConfig } from "../session/session-manager.ts";
import { withTimeout, TimeoutError } from "../../proxy-engine/core/network/utils/timeout.ts";

/** Default initialization timeout in milliseconds */
const INIT_TIMEOUT = 30000; // 30 seconds for heavy service init

/**
 * Service initialization state
 */
type ServiceState<T> =
  | { status: "uninitialized" }
  | { status: "initializing"; promise: Promise<T> }
  | { status: "ready"; service: T }
  | { status: "failed"; error: Error };

/**
 * Configuration for service initialization
 */
export interface ServiceInitializerConfig {
  /** Session manager config */
  sessionConfig?: SessionManagerConfig;
  /** Query engine config */
  queryEngineConfig?: {
    security?: {
      sandbox?: {
        enabled?: boolean;
        timeout?: number;
      };
    };
  };
  /** Runtime config overrides */
  runtimeConfig?: Partial<BrowserXRuntimeConfig>;
}

/**
 * Service Initializer
 *
 * Provides lazy initialization of heavy services:
 * - BrowserXRuntime (event loops, browser pool)
 * - QueryEngine (SQL-like query interface)
 * - SessionManager (browser session pooling)
 *
 * Each service initializes exactly once on first access.
 * Subsequent calls return the cached instance.
 */
export class ServiceInitializer {
  private runtimeState: ServiceState<BrowserXRuntime> = { status: "uninitialized" };
  private queryEngineState: ServiceState<IQueryEngine> = { status: "uninitialized" };
  private sessionManagerState: ServiceState<SessionManager> = { status: "uninitialized" };

  constructor(private readonly config: ServiceInitializerConfig = {}) {}

  /**
   * Get or initialize the BrowserX Runtime
   *
   * This is the heaviest service - starts event loops and browser pool.
   * Only initialize when browser tools are actually used.
   */
  async getRuntime(): Promise<BrowserXRuntime> {
    switch (this.runtimeState.status) {
      case "ready":
        return this.runtimeState.service;

      case "initializing":
        return this.runtimeState.promise;

      case "failed":
        throw this.runtimeState.error;

      case "uninitialized": {
        const promise = this.initRuntime();
        this.runtimeState = { status: "initializing", promise };

        try {
          const runtime = await promise;
          this.runtimeState = { status: "ready", service: runtime };
          return runtime;
        } catch (error) {
          this.runtimeState = { status: "failed", error: error as Error };
          throw error;
        }
      }
    }
  }

  /**
   * Get or initialize the Query Engine
   *
   * Tries to get from runtime first, falls back to standalone.
   */
  async getQueryEngine(): Promise<IQueryEngine> {
    switch (this.queryEngineState.status) {
      case "ready":
        return this.queryEngineState.service;

      case "initializing":
        return this.queryEngineState.promise;

      case "failed":
        throw this.queryEngineState.error;

      case "uninitialized": {
        const promise = this.initQueryEngine();
        this.queryEngineState = { status: "initializing", promise };

        try {
          const engine = await promise;
          this.queryEngineState = { status: "ready", service: engine };
          return engine;
        } catch (error) {
          this.queryEngineState = { status: "failed", error: error as Error };
          throw error;
        }
      }
    }
  }

  /**
   * Get or initialize the Session Manager
   *
   * Lightweight - just manages browser sessions.
   */
  async getSessionManager(): Promise<SessionManager> {
    switch (this.sessionManagerState.status) {
      case "ready":
        return this.sessionManagerState.service;

      case "initializing":
        return this.sessionManagerState.promise;

      case "failed":
        throw this.sessionManagerState.error;

      case "uninitialized": {
        const promise = this.initSessionManager();
        this.sessionManagerState = { status: "initializing", promise };

        try {
          const manager = await promise;
          this.sessionManagerState = { status: "ready", service: manager };
          return manager;
        } catch (error) {
          this.sessionManagerState = { status: "failed", error: error as Error };
          throw error;
        }
      }
    }
  }

  /**
   * Check if runtime is initialized (without triggering init)
   */
  isRuntimeReady(): boolean {
    return this.runtimeState.status === "ready";
  }

  /**
   * Check if query engine is initialized (without triggering init)
   */
  isQueryEngineReady(): boolean {
    return this.queryEngineState.status === "ready";
  }

  /**
   * Check if session manager is initialized (without triggering init)
   */
  isSessionManagerReady(): boolean {
    return this.sessionManagerState.status === "ready";
  }

  /**
   * Get initialization status for all services
   */
  getStatus(): {
    runtime: string;
    queryEngine: string;
    sessionManager: string;
  } {
    return {
      runtime: this.runtimeState.status,
      queryEngine: this.queryEngineState.status,
      sessionManager: this.sessionManagerState.status,
    };
  }

  /**
   * Shutdown all initialized services
   *
   * CRITICAL ORDERING: SessionManager must shut down BEFORE Runtime.
   * SessionManager.shutdown() releases all pool instances back to BrowserPool.
   * Runtime.shutdown() then stops the BrowserPool (closing remaining instances).
   * Reversing this order would destroy pool instances while sessions still hold them.
   */
  async shutdown(reason: string = "Service shutdown"): Promise<void> {
    const errors: Error[] = [];

    // Shutdown session manager first (releases pool instances)
    if (this.sessionManagerState.status === "ready") {
      try {
        await this.sessionManagerState.service.shutdown();
      } catch (error) {
        errors.push(error as Error);
      }
    }

    // Shutdown runtime (handles query engine cleanup)
    if (this.runtimeState.status === "ready") {
      try {
        await this.runtimeState.service.shutdown(reason);
      } catch (error) {
        errors.push(error as Error);
      }
    }

    // Reset states
    this.runtimeState = { status: "uninitialized" };
    this.queryEngineState = { status: "uninitialized" };
    this.sessionManagerState = { status: "uninitialized" };

    if (errors.length > 0) {
      throw new AggregateError(errors, "Errors during service shutdown");
    }
  }

  // ---- Private initialization methods ----

  private async initRuntime(): Promise<BrowserXRuntime> {
    console.error("[ServiceInitializer] Initializing BrowserX Runtime...");
    const startTime = Date.now();

    const baseConfig = createTestConfig();
    const runtime = new BrowserXRuntime({
      config: {
        ...baseConfig,
        ...this.config.runtimeConfig,
        // MCP server handles its own signals
        signals: {
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
        },
        browser: {
          ...baseConfig.browser,
          maxInstances: this.config.sessionConfig?.maxSessions ?? 10,
        },
        query: {
          ...baseConfig.query,
          sandbox: {
            enabled: this.config.queryEngineConfig?.security?.sandbox?.enabled ?? true,
            timeout: this.config.queryEngineConfig?.security?.sandbox?.timeout ?? 30000,
          },
        },
      },
    });

    // Start with timeout to prevent hanging
    try {
      await withTimeout(
        runtime.start(),
        INIT_TIMEOUT,
        `BrowserX Runtime initialization timed out after ${INIT_TIMEOUT}ms`
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        console.error(`[ServiceInitializer] Runtime init timeout - attempting graceful shutdown`);
        try {
          await runtime.shutdown("Initialization timeout");
        } catch {
          // Ignore shutdown errors
        }
      }
      throw error;
    }

    const elapsed = Date.now() - startTime;
    console.error(`[ServiceInitializer] BrowserX Runtime ready (${elapsed}ms)`);

    return runtime;
  }

  private async initQueryEngine(): Promise<IQueryEngine> {
    console.error("[ServiceInitializer] Initializing Query Engine...");
    const startTime = Date.now();

    // Try to get from runtime first
    if (this.runtimeState.status === "ready") {
      const runtimeEngine = this.runtimeState.service.getQueryEngine();
      if (runtimeEngine) {
        console.error("[ServiceInitializer] Using Query Engine from Runtime");
        return runtimeEngine as IQueryEngine;
      }
    }

    // Fallback: create standalone query engine
    const queryEngine = new QueryEngine();
    await queryEngine.initialize({
      security: {
        sandbox: {
          enabled: this.config.queryEngineConfig?.security?.sandbox?.enabled ?? true,
          timeout: this.config.queryEngineConfig?.security?.sandbox?.timeout ?? 30000,
        },
      },
    });

    const elapsed = Date.now() - startTime;
    console.error(`[ServiceInitializer] Query Engine ready (${elapsed}ms)`);

    return queryEngine;
  }

  private async initSessionManager(): Promise<SessionManager> {
    console.error("[ServiceInitializer] Initializing Session Manager...");
    const startTime = Date.now();

    // SessionManager depends on Runtime's BrowserPool for unified instance lifecycle.
    // This ensures the first browser tool call triggers: Runtime init → SessionManager init.
    const runtime = await this.getRuntime();

    const manager = new SessionManager({
      ...this.config.sessionConfig,
      browserPool: runtime.browserPool,
      eventEmitter: (event) => runtime.emitExternalEvent(event),
    });

    // Register health check for session manager with Runtime's HealthChecker
    runtime.healthChecker.registerHandler("session-manager", async () => {
      const stats = manager.getPoolStats();
      const hasCapacity = stats.activeSessions < stats.maxSessions;
      return {
        status: hasCapacity ? "healthy" : "degraded",
        message: `${stats.activeSessions}/${stats.maxSessions} sessions active`,
      };
    });

    // Register session metrics with Runtime's UnifiedMetricsCollector
    runtime.metricsCollector.registerComponentMetrics("session-manager", () => ({
      active_sessions: {
        name: "browserx_mcp_active_sessions",
        type: "gauge" as const,
        value: manager.getPoolStats().activeSessions,
        timestamp: Date.now(),
      },
      sessions_created: {
        name: "browserx_mcp_sessions_created_total",
        type: "counter" as const,
        value: manager.getPoolStats().totalCreated,
        timestamp: Date.now(),
      },
      sessions_closed: {
        name: "browserx_mcp_sessions_closed_total",
        type: "counter" as const,
        value: manager.getPoolStats().totalClosed,
        timestamp: Date.now(),
      },
    }));

    const elapsed = Date.now() - startTime;
    console.error(`[ServiceInitializer] Session Manager ready (${elapsed}ms)`);

    return manager;
  }
}

/**
 * Create a service initializer with config
 */
export function createServiceInitializer(
  config: ServiceInitializerConfig = {},
): ServiceInitializer {
  return new ServiceInitializer(config);
}
