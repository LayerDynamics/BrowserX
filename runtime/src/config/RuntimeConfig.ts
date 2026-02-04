/**
 * Runtime Configuration
 *
 * Unified configuration for the BrowserX Runtime system.
 * Consolidates settings for all subsystems into a single configuration object.
 */

import type { Environment, LogLevel } from "../types.ts";

/**
 * Browser pool configuration
 */
export interface BrowserPoolConfig {
  /**
   * Minimum number of browser instances to keep warm
   */
  minInstances: number;

  /**
   * Maximum number of concurrent browser instances
   */
  maxInstances: number;

  /**
   * Time (ms) after which an idle browser is closed
   */
  idleTimeout: number;

  /**
   * Maximum lifetime (ms) of a browser instance
   */
  maxLifetime: number;

  /**
   * Default viewport width
   */
  defaultWidth: number;

  /**
   * Default viewport height
   */
  defaultHeight: number;

  /**
   * Enable JavaScript execution in browsers
   */
  enableJavaScript: boolean;

  /**
   * Enable storage APIs (localStorage, cookies, etc.)
   */
  enableStorage: boolean;

  /**
   * Device pixel ratio for screenshots
   */
  devicePixelRatio: number;
}

/**
 * Proxy engine gateway configuration (simplified)
 */
export interface ProxyGatewayConfig {
  host: string;
  port: number;
  tls?: {
    certFile: string;
    keyFile: string;
    alpnProtocols?: string[];
  };
  routes?: Array<{
    pathPattern: string;
    targetHost: string;
    targetPort: number;
  }>;
}

/**
 * Proxy engine configuration
 */
export interface ProxyEngineConfig {
  /**
   * Whether proxy engine is enabled
   */
  enabled: boolean;

  /**
   * Gateway server configurations
   * Note: These are simplified configs - the runtime will convert them
   * to the full GatewayServerConfig format when initializing proxy engine
   */
  gateways: ProxyGatewayConfig[];

  /**
   * Graceful shutdown timeout (ms)
   */
  gracefulShutdownTimeout: number;

  /**
   * Enable metrics collection
   */
  metrics: boolean;

  /**
   * Metrics port (if metrics enabled)
   */
  metricsPort?: number;

  /**
   * Metrics host
   */
  metricsHost?: string;
}

/**
 * Query engine configuration
 */
export interface QueryEngineConfig {
  /**
   * Enable proxy integration
   */
  proxyEnabled: boolean;

  /**
   * Cache configuration
   */
  cache: {
    enabled: boolean;
    defaultTTL: number;
    maxSize: number;
  };

  /**
   * Rate limiting
   */
  rateLimit?: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };

  /**
   * Security sandbox configuration
   */
  sandbox: {
    enabled: boolean;
    timeout: number;
  };
}

/**
 * Event loop configuration
 */
export interface EventLoopConfig {
  /**
   * Enable event loop coordination
   */
  enabled: boolean;

  /**
   * Target frame rate for browser event loops
   */
  targetFrameRate: number;

  /**
   * Maximum microtasks per cycle
   */
  maxMicrotasksPerCycle: number;

  /**
   * Enable idle task processing
   */
  enableIdleTasks: boolean;
}

/**
 * Shutdown configuration
 */
export interface ShutdownConfig {
  /**
   * Enable graceful shutdown
   */
  graceful: boolean;

  /**
   * Total shutdown timeout (ms)
   */
  timeout: number;

  /**
   * Time to wait for active requests to drain (ms)
   */
  drainTimeout: number;

  /**
   * Force exit after timeout
   */
  forceExitOnTimeout: boolean;
}

/**
 * Signal handling configuration
 */
export interface SignalConfig {
  /**
   * Handle SIGINT (Ctrl+C)
   */
  handleSIGINT: boolean;

  /**
   * Handle SIGTERM
   */
  handleSIGTERM: boolean;

  /**
   * Handle SIGHUP (reload config)
   */
  handleSIGHUP: boolean;
}

/**
 * Metrics and observability configuration
 */
export interface MetricsConfig {
  /**
   * Enable metrics collection
   */
  enabled: boolean;

  /**
   * Metrics server port
   */
  port?: number;

  /**
   * Metrics server host
   */
  host?: string;

  /**
   * Health check interval (ms)
   */
  healthCheckInterval: number;

  /**
   * Export format
   */
  exportFormat: "prometheus" | "json";
}

/**
 * Complete BrowserX Runtime configuration
 */
export interface BrowserXRuntimeConfig {
  /**
   * Runtime environment
   */
  environment: Environment;

  /**
   * Logging level
   */
  logLevel: LogLevel;

  /**
   * Browser pool configuration
   */
  browser: BrowserPoolConfig;

  /**
   * Proxy engine configuration
   */
  proxy: ProxyEngineConfig;

  /**
   * Query engine configuration
   */
  query: QueryEngineConfig;

  /**
   * Event loop configuration
   */
  eventLoop: EventLoopConfig;

  /**
   * Shutdown configuration
   */
  shutdown: ShutdownConfig;

  /**
   * Signal handling configuration
   */
  signals: SignalConfig;

  /**
   * Metrics configuration
   */
  metrics: MetricsConfig;
}

/**
 * Create default runtime configuration
 */
export function createDefaultConfig(): BrowserXRuntimeConfig {
  return {
    environment: "production",
    logLevel: "info",

    browser: {
      minInstances: 0,
      maxInstances: 10,
      idleTimeout: 30 * 60 * 1000, // 30 minutes
      maxLifetime: 60 * 60 * 1000, // 1 hour
      defaultWidth: 1280,
      defaultHeight: 720,
      enableJavaScript: false,
      enableStorage: true,
      devicePixelRatio: 1.0,
    },

    proxy: {
      enabled: false,
      gateways: [],
      gracefulShutdownTimeout: 30000,
      metrics: false,
    },

    query: {
      proxyEnabled: false,
      cache: {
        enabled: true,
        defaultTTL: 5 * 60 * 1000, // 5 minutes
        maxSize: 100 * 1024 * 1024, // 100MB
      },
      sandbox: {
        enabled: true,
        timeout: 30000,
      },
    },

    eventLoop: {
      enabled: true,
      targetFrameRate: 60,
      maxMicrotasksPerCycle: 1000,
      enableIdleTasks: true,
    },

    shutdown: {
      graceful: true,
      timeout: 30000,
      drainTimeout: 5000,
      forceExitOnTimeout: true,
    },

    signals: {
      handleSIGINT: true,
      handleSIGTERM: true,
      handleSIGHUP: false,
    },

    metrics: {
      enabled: false,
      healthCheckInterval: 30000,
      exportFormat: "prometheus",
    },
  };
}

/**
 * Create development configuration with relaxed settings
 */
export function createDevelopmentConfig(): BrowserXRuntimeConfig {
  const config = createDefaultConfig();
  return {
    ...config,
    environment: "development",
    logLevel: "debug",
    browser: {
      ...config.browser,
      maxInstances: 5,
      idleTimeout: 5 * 60 * 1000, // 5 minutes
    },
    shutdown: {
      ...config.shutdown,
      timeout: 10000,
      forceExitOnTimeout: false,
    },
    eventLoop: {
      ...config.eventLoop,
      maxMicrotasksPerCycle: 500,
    },
  };
}

/**
 * Create test configuration with minimal resources
 */
export function createTestConfig(): BrowserXRuntimeConfig {
  const config = createDefaultConfig();
  return {
    ...config,
    environment: "test",
    logLevel: "warn",
    browser: {
      ...config.browser,
      minInstances: 0,
      maxInstances: 2,
      idleTimeout: 60000, // 1 minute
      maxLifetime: 5 * 60 * 1000, // 5 minutes
    },
    shutdown: {
      ...config.shutdown,
      timeout: 5000,
      drainTimeout: 1000,
    },
    signals: {
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
    },
    metrics: {
      ...config.metrics,
      enabled: false,
    },
  };
}

/**
 * Merge partial configuration with defaults
 */
export function mergeConfig(
  partial: Partial<BrowserXRuntimeConfig>,
): BrowserXRuntimeConfig {
  const defaults = createDefaultConfig();

  return {
    environment: partial.environment ?? defaults.environment,
    logLevel: partial.logLevel ?? defaults.logLevel,
    browser: { ...defaults.browser, ...partial.browser },
    proxy: { ...defaults.proxy, ...partial.proxy },
    query: {
      ...defaults.query,
      ...partial.query,
      cache: { ...defaults.query.cache, ...partial.query?.cache },
      sandbox: { ...defaults.query.sandbox, ...partial.query?.sandbox },
    },
    eventLoop: { ...defaults.eventLoop, ...partial.eventLoop },
    shutdown: { ...defaults.shutdown, ...partial.shutdown },
    signals: { ...defaults.signals, ...partial.signals },
    metrics: { ...defaults.metrics, ...partial.metrics },
  };
}
