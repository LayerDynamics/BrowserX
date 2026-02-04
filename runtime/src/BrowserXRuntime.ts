/**
 * BrowserX Runtime
 *
 * Unified runtime coordinator for all BrowserX components.
 * Manages lifecycle, event loops, resources, and cross-cutting concerns.
 *
 * This is the main entry point for running the BrowserX system.
 */

import {
  RuntimeState,
  type ComponentId,
  type HealthCheckResult,
  type RuntimeEvent,
  type RuntimeEventListener,
  type RuntimeStats,
} from "./types.ts";

import {
  type BrowserXRuntimeConfig,
  createDefaultConfig,
  mergeConfig,
} from "./config/mod.ts";

import { LifecycleManager } from "./lifecycle/LifecycleManager.ts";
import { InitializationSequence } from "./lifecycle/InitializationSequence.ts";
import { ShutdownSequence } from "./lifecycle/ShutdownSequence.ts";
import { EventCoordinator } from "./events/EventCoordinator.ts";
import { BrowserPool } from "./resources/BrowserPool.ts";
import { SignalHandler } from "./signals/SignalHandler.ts";
import { UnifiedMetricsCollector } from "./metrics/UnifiedMetricsCollector.ts";
import { HealthChecker } from "./metrics/HealthChecker.ts";

/**
 * BrowserX Runtime Options
 */
export interface BrowserXRuntimeOptions {
  config?: Partial<BrowserXRuntimeConfig>;
}

/**
 * BrowserX Runtime
 *
 * The main runtime coordinator that manages all BrowserX components:
 * - Proxy Engine event loop
 * - Browser instance pool
 * - Query Engine
 * - Signal handling
 * - Metrics collection
 * - Health checking
 */
export class BrowserXRuntime {
  // Configuration
  private readonly config: BrowserXRuntimeConfig;

  // Core components
  private readonly lifecycleManager: LifecycleManager;
  private readonly initSequence: InitializationSequence;
  private readonly shutdownSequence: ShutdownSequence;

  // Subsystems
  public readonly eventCoordinator: EventCoordinator;
  public readonly browserPool: BrowserPool;
  public readonly signalHandler: SignalHandler;
  public readonly metricsCollector: UnifiedMetricsCollector;
  public readonly healthChecker: HealthChecker;

  // Query Engine (lazily loaded)
  private _queryEngine?: unknown;

  // Proxy Engine (lazily loaded)
  private _proxyRuntime?: unknown;

  // Runtime state
  private startTime = 0;
  private eventListeners: RuntimeEventListener[] = [];

  constructor(options: BrowserXRuntimeOptions = {}) {
    // Merge configuration with defaults
    this.config = options.config
      ? mergeConfig(options.config)
      : createDefaultConfig();

    // Initialize lifecycle management
    this.lifecycleManager = new LifecycleManager();
    this.initSequence = new InitializationSequence(this.lifecycleManager);
    this.shutdownSequence = new ShutdownSequence(this.lifecycleManager, {
      totalTimeout: this.config.shutdown.timeout,
      defaultStepTimeout: this.config.shutdown.drainTimeout,
      forceOnTimeout: this.config.shutdown.forceExitOnTimeout,
    });

    // Initialize subsystems
    this.eventCoordinator = new EventCoordinator(this.config.eventLoop);
    this.browserPool = new BrowserPool(this.config.browser, this.eventCoordinator);
    this.signalHandler = new SignalHandler(this.config.signals);
    this.metricsCollector = new UnifiedMetricsCollector(this.config.metrics);
    this.healthChecker = new HealthChecker(this.config.metrics);

    // Register components with lifecycle manager
    this.registerComponents();

    // Set up initialization steps
    this.setupInitializationSteps();

    // Set up shutdown steps
    this.setupShutdownSteps();

    // Set up signal handlers
    this.setupSignalHandlers();

    // Set up health checks
    this.setupHealthChecks();

    // Forward events from subsystems
    this.setupEventForwarding();
  }

  /**
   * Register all components with lifecycle manager
   */
  private registerComponents(): void {
    const components: ComponentId[] = [
      "event-coordinator",
      "browser-pool",
      "metrics-collector",
      "resource-manager",
    ];

    if (this.config.proxy.enabled) {
      components.push("proxy-engine");
    }

    components.push("query-engine");

    for (const id of components) {
      this.lifecycleManager.registerComponent(id);
    }
  }

  /**
   * Set up initialization steps
   */
  private setupInitializationSteps(): void {
    // Step 1: Metrics collector (no dependencies)
    this.initSequence.registerStep({
      name: "Initialize metrics collector",
      component: "metrics-collector",
      execute: async () => {
        await this.metricsCollector.start();
      },
      dependencies: [],
      timeout: 5000,
    });

    // Step 2: Event coordinator (depends on metrics)
    this.initSequence.registerStep({
      name: "Initialize event coordinator",
      component: "event-coordinator",
      execute: async () => {
        await this.eventCoordinator.start();
      },
      dependencies: ["metrics-collector"],
      timeout: 10000,
    });

    // Step 3: Browser pool (depends on event coordinator)
    this.initSequence.registerStep({
      name: "Initialize browser pool",
      component: "browser-pool",
      execute: async () => {
        await this.browserPool.start();
      },
      dependencies: ["event-coordinator"],
      timeout: 30000,
    });

    // Step 4: Proxy engine (optional, depends on event coordinator)
    if (this.config.proxy.enabled) {
      this.initSequence.registerStep({
        name: "Initialize proxy engine",
        component: "proxy-engine",
        execute: async () => {
          await this.initializeProxyEngine();
        },
        dependencies: ["event-coordinator"],
        timeout: 30000,
        optional: false,
      });
    }

    // Step 5: Query engine (depends on browser pool)
    this.initSequence.registerStep({
      name: "Initialize query engine",
      component: "query-engine",
      execute: async () => {
        await this.initializeQueryEngine();
      },
      dependencies: ["browser-pool"],
      timeout: 10000,
    });
  }

  /**
   * Set up shutdown steps
   */
  private setupShutdownSteps(): void {
    // Shutdown in reverse order of initialization

    // Step 1: Query engine
    this.shutdownSequence.registerStep({
      name: "Shutdown query engine",
      component: "query-engine",
      execute: async () => {
        // Query engine cleanup
        this._queryEngine = undefined;
      },
      timeout: 5000,
      graceful: true,
    });

    // Step 2: Proxy engine (if enabled)
    if (this.config.proxy.enabled) {
      this.shutdownSequence.registerStep({
        name: "Shutdown proxy engine",
        component: "proxy-engine",
        execute: async () => {
          if (this._proxyRuntime) {
            const runtime = this._proxyRuntime as { shutdown: () => Promise<void> };
            await runtime.shutdown();
            this._proxyRuntime = undefined;
          }
        },
        timeout: this.config.proxy.gracefulShutdownTimeout,
        graceful: true,
      });
    }

    // Step 3: Browser pool
    this.shutdownSequence.registerStep({
      name: "Shutdown browser pool",
      component: "browser-pool",
      execute: async () => {
        await this.browserPool.stop();
      },
      timeout: 10000,
      graceful: true,
    });

    // Step 4: Event coordinator
    this.shutdownSequence.registerStep({
      name: "Shutdown event coordinator",
      component: "event-coordinator",
      execute: async () => {
        await this.eventCoordinator.stop();
      },
      timeout: 5000,
      graceful: true,
    });

    // Step 5: Metrics collector
    this.shutdownSequence.registerStep({
      name: "Shutdown metrics collector",
      component: "metrics-collector",
      execute: async () => {
        await this.metricsCollector.stop();
      },
      timeout: 5000,
      graceful: true,
    });
  }

  /**
   * Set up signal handlers
   */
  private setupSignalHandlers(): void {
    this.signalHandler.onShutdown((signal) => {
      console.log(`[BrowserXRuntime] Received ${signal}, initiating shutdown...`);
      this.shutdown(`Signal: ${signal}`).catch((error) => {
        console.error("[BrowserXRuntime] Error during signal shutdown:", error);
        Deno.exit(1);
      });
    });
  }

  /**
   * Set up health checks
   */
  private setupHealthChecks(): void {
    // Event coordinator health
    this.healthChecker.registerHandler(
      "event-coordinator",
      HealthChecker.createBooleanHandler(
        () => this.eventCoordinator.isRunning(),
        "Event coordinator running",
        "Event coordinator not running",
      ),
    );

    // Browser pool health
    this.healthChecker.registerHandler(
      "browser-pool",
      async () => {
        const stats = this.browserPool.getStats();
        const hasCapacity = stats.idleInstances > 0 || stats.totalInstances < stats.maxInstances;

        return {
          status: hasCapacity ? "healthy" : "degraded",
          message: hasCapacity
            ? `${stats.idleInstances} idle, ${stats.inUseInstances} in use`
            : "Pool at capacity",
        };
      },
    );

    // Metrics collector health
    this.healthChecker.registerHandler(
      "metrics-collector",
      HealthChecker.createBooleanHandler(
        () => this.metricsCollector.isRunning(),
        "Metrics collector running",
        "Metrics collector not running",
      ),
    );
  }

  /**
   * Set up event forwarding from subsystems
   */
  private setupEventForwarding(): void {
    const forwardEvent = (event: RuntimeEvent) => {
      this.emitEvent(event);
    };

    this.initSequence.addEventListener(forwardEvent);
    this.shutdownSequence.addEventListener(forwardEvent);
    this.eventCoordinator.addEventListener(forwardEvent);
    this.signalHandler.addEventListener(forwardEvent);
    this.healthChecker.addEventListener(forwardEvent);
  }

  /**
   * Initialize proxy engine
   */
  private async initializeProxyEngine(): Promise<void> {
    try {
      const proxyModule = await import("@browserx/proxy-engine/core/runtime/runtime.ts");

      // Convert our gateway config to the full format expected by proxy engine
      const gateways = this.config.proxy.gateways.map((gw) => ({
        host: gw.host,
        port: gw.port,
        tls: gw.tls,
        // Convert simplified route config to full Route interface
        routes: (gw.routes ?? []).map((route, index) => ({
          id: `route-${index}`,
          pattern: new RegExp(route.pathPattern),
          methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as Array<"GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS" | "CONNECT" | "TRACE">,
          priority: 0,
          enabled: true,
          upstream: {
            servers: [{
              id: `server-${index}`,
              host: route.targetHost,
              port: route.targetPort,
              weight: 1,
              enabled: true,
            }],
            loadBalancingStrategy: "round-robin" as "round-robin",
            timeout: 30000,
          },
        })),
      }));

      this._proxyRuntime = new proxyModule.Runtime({
        gateways,
        gracefulShutdown: this.config.shutdown.graceful,
        gracefulShutdownTimeout: this.config.proxy.gracefulShutdownTimeout,
        handleSignals: false, // We handle signals centrally
        environment: this.config.environment,
        logLevel: this.config.logLevel,
        metrics: this.config.proxy.metrics,
        metricsPort: this.config.proxy.metricsPort,
        metricsHost: this.config.proxy.metricsHost,
      });

      const runtime = this._proxyRuntime as { start: () => Promise<void> };
      await runtime.start();
    } catch (error) {
      console.warn("[BrowserXRuntime] Failed to initialize proxy engine:", error);
      throw error;
    }
  }

  /**
   * Initialize query engine
   */
  private async initializeQueryEngine(): Promise<void> {
    try {
      const queryModule = await import("@browserx/query-engine");

      // QueryEngine config matches query-engine/core/engine.ts QueryEngineConfig
      this._queryEngine = new queryModule.QueryEngine({
        proxy: {
          enabled: this.config.query.proxyEnabled,
          cache: {
            enabled: this.config.query.cache.enabled,
            defaultTTL: this.config.query.cache.defaultTTL,
            maxSize: this.config.query.cache.maxSize,
          },
          rateLimit: this.config.query.rateLimit,
        },
        security: {
          sandbox: {
            enabled: this.config.query.sandbox.enabled,
            timeout: this.config.query.sandbox.timeout,
          },
        },
      });

      // Initialize the query engine
      const engine = this._queryEngine as { initialize: (config: unknown) => Promise<void> };
      await engine.initialize({});
    } catch (error) {
      console.warn("[BrowserXRuntime] Failed to initialize query engine:", error);
      throw error;
    }
  }

  /**
   * Start the runtime
   */
  async start(): Promise<void> {
    const currentState = this.lifecycleManager.getState();

    if (currentState !== RuntimeState.STOPPED) {
      throw new Error(`Cannot start runtime in state: ${currentState}`);
    }

    try {
      // Transition to STARTING
      this.lifecycleManager.transition(RuntimeState.STARTING);
      this.emitEvent({
        type: "state_change",
        from: RuntimeState.STOPPED,
        to: RuntimeState.STARTING,
      });

      console.log("[BrowserXRuntime] Starting BrowserX Runtime...");

      // Register signal handlers
      this.signalHandler.register();

      // Execute initialization sequence
      const results = await this.initSequence.execute((progress) => {
        console.log(
          `[BrowserXRuntime] Initializing: ${progress.currentStep} (${progress.percentage}%)`,
        );
      });

      // Check for failures
      const failures = results.filter((r) => !r.success && !r.step.optional);
      if (failures.length > 0) {
        const errorMessages = failures
          .map((r) => `${r.step.name}: ${r.error?.message ?? "Unknown error"}`)
          .join("; ");
        throw new Error(`Initialization failed: ${errorMessages}`);
      }

      // Start health checker
      this.healthChecker.start();

      // Record start time
      this.startTime = Date.now();

      // Transition to RUNNING
      this.lifecycleManager.transition(RuntimeState.RUNNING);
      this.emitEvent({
        type: "state_change",
        from: RuntimeState.STARTING,
        to: RuntimeState.RUNNING,
      });

      console.log("[BrowserXRuntime] BrowserX Runtime started successfully");

      // Update metrics
      this.metricsCollector.updateRuntimeState(RuntimeState.RUNNING);
    } catch (error) {
      // Transition to ERROR
      this.lifecycleManager.transition(RuntimeState.ERROR);
      this.metricsCollector.updateRuntimeState(RuntimeState.ERROR);

      console.error("[BrowserXRuntime] Failed to start:", error);
      throw error;
    }
  }

  /**
   * Shutdown the runtime
   */
  async shutdown(reason = "Manual shutdown"): Promise<void> {
    const currentState = this.lifecycleManager.getState();

    if (currentState === RuntimeState.STOPPED || currentState === RuntimeState.STOPPING) {
      return;
    }

    try {
      // Transition to STOPPING
      this.lifecycleManager.transition(RuntimeState.STOPPING);
      this.emitEvent({
        type: "state_change",
        from: currentState,
        to: RuntimeState.STOPPING,
      });

      console.log(`[BrowserXRuntime] Shutting down: ${reason}`);

      // Update metrics
      this.metricsCollector.updateRuntimeState(RuntimeState.STOPPING);

      // Stop health checker
      this.healthChecker.stop();

      // Execute shutdown sequence
      const results = await this.shutdownSequence.execute(reason, (progress) => {
        console.log(
          `[BrowserXRuntime] Shutting down: ${progress.currentStep} (${progress.percentage}%)`,
        );
      });

      // Log any failures
      const failures = results.filter((r) => !r.success);
      for (const failure of failures) {
        console.warn(
          `[BrowserXRuntime] Shutdown step failed: ${failure.step.name}`,
          failure.error,
        );
      }

      // Unregister signal handlers
      this.signalHandler.unregister();

      // Transition to STOPPED
      this.lifecycleManager.transition(RuntimeState.STOPPED);
      this.emitEvent({
        type: "state_change",
        from: RuntimeState.STOPPING,
        to: RuntimeState.STOPPED,
      });

      console.log("[BrowserXRuntime] BrowserX Runtime stopped");
    } catch (error) {
      // Transition to ERROR
      try {
        this.lifecycleManager.transition(RuntimeState.ERROR);
      } catch {
        // Ignore if already in error state
      }

      console.error("[BrowserXRuntime] Error during shutdown:", error);
      throw error;
    }
  }

  /**
   * Run the runtime (starts and waits for shutdown)
   */
  async run(): Promise<void> {
    await this.start();

    // Keep running until shutdown
    await new Promise<void>((resolve) => {
      const checkShutdown = () => {
        if (
          this.lifecycleManager.getState() === RuntimeState.STOPPED ||
          this.lifecycleManager.getState() === RuntimeState.ERROR
        ) {
          resolve();
        } else {
          setTimeout(checkShutdown, 100);
        }
      };
      checkShutdown();
    });
  }

  /**
   * Get current runtime state
   */
  getState(): RuntimeState {
    return this.lifecycleManager.getState();
  }

  /**
   * Check if runtime is running
   */
  isRunning(): boolean {
    return this.lifecycleManager.getState() === RuntimeState.RUNNING;
  }

  /**
   * Get runtime uptime in milliseconds
   */
  getUptime(): number {
    if (this.startTime === 0) {
      return 0;
    }
    return Date.now() - this.startTime;
  }

  /**
   * Get runtime statistics
   */
  getStats(): RuntimeStats {
    const health = this.healthChecker.getLastCheckResult() ?? {
      status: "healthy" as const,
      components: [],
      timestamp: Date.now(),
    };

    return {
      state: this.lifecycleManager.getState(),
      uptime: this.getUptime(),
      startedAt: this.startTime > 0 ? this.startTime : undefined,
      components: this.lifecycleManager.getComponentStates(),
      memory: {
        heapUsed: Deno.memoryUsage().heapUsed,
        heapTotal: Deno.memoryUsage().heapTotal,
        external: Deno.memoryUsage().external,
        rss: Deno.memoryUsage().rss,
      },
      resources: {
        browserInstances: this.browserPool.getStats().totalInstances,
        activeSessions: this.browserPool.getStats().inUseInstances,
        activePages: 0, // Would be tracked per browser instance
        connectionPools: 0, // Would come from proxy engine
        activeConnections: 0,
        pendingRequests: 0,
      },
      queries: {
        total: 0,
        active: 0,
        successful: 0,
        failed: 0,
        cancelled: 0,
        averageExecutionTime: 0,
      },
      eventLoops: this.eventCoordinator.getEventLoopStats(),
      health,
    };
  }

  /**
   * Get health check result
   */
  async getHealthStatus(): Promise<HealthCheckResult> {
    return this.healthChecker.getHealthStatus();
  }

  /**
   * Get runtime configuration
   */
  getConfig(): BrowserXRuntimeConfig {
    return this.config;
  }

  /**
   * Get query engine (if initialized)
   */
  getQueryEngine(): unknown {
    return this._queryEngine;
  }

  /**
   * Get proxy runtime (if initialized)
   */
  getProxyRuntime(): unknown {
    return this._proxyRuntime;
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

/**
 * Create and start a BrowserX Runtime with default configuration
 */
export async function createRuntime(
  options: BrowserXRuntimeOptions = {},
): Promise<BrowserXRuntime> {
  const runtime = new BrowserXRuntime(options);
  await runtime.start();
  return runtime;
}
