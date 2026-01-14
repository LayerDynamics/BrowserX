/**
 * Configuration Management
 *
 * Load and validate runtime configuration from files or objects
 */

import type { RuntimeConfig } from "./runtime.ts";
import type { GatewayServerConfig } from "../../gateway/server/gateway_server.ts";
import type { Route } from "../../gateway/router/request_router.ts";
import type { UpstreamServer } from "../../gateway/router/request_router.ts";

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

/**
 * Configuration loader
 */
export class ConfigLoader {
  /**
   * Load configuration from JSON file
   */
  static async loadFromFile(path: string): Promise<RuntimeConfig> {
    try {
      const content = await Deno.readTextFile(path);
      const config = JSON.parse(content);
      return this.validate(config);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new ConfigValidationError(`Configuration file not found: ${path}`);
      }
      if (error instanceof SyntaxError) {
        throw new ConfigValidationError(`Invalid JSON in configuration file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load configuration from object
   */
  static load(config: any): RuntimeConfig {
    return this.validate(config);
  }

  /**
   * Validate configuration
   */
  static validate(config: any): RuntimeConfig {
    if (!config || typeof config !== "object") {
      throw new ConfigValidationError("Configuration must be an object");
    }

    // Validate gateways
    if (!Array.isArray(config.gateways)) {
      throw new ConfigValidationError("Configuration must have 'gateways' array");
    }

    if (config.gateways.length === 0) {
      throw new ConfigValidationError("At least one gateway must be configured");
    }

    // Validate each gateway
    const gateways: GatewayServerConfig[] = config.gateways.map((gateway: any, index: number) => {
      return this.validateGateway(gateway, index);
    });

    return {
      gateways,
      gracefulShutdown: config.gracefulShutdown ?? true,
      gracefulShutdownTimeout: config.gracefulShutdownTimeout ?? 30000,
      handleSignals: config.handleSignals ?? true,
      environment: config.environment ?? "production",
      logLevel: config.logLevel ?? "info",
      metrics: config.metrics ?? false,
      metricsPort: config.metricsPort,
    };
  }

  /**
   * Validate gateway configuration
   */
  private static validateGateway(gateway: any, index: number): GatewayServerConfig {
    const prefix = `Gateway ${index}`;

    if (!gateway.host || typeof gateway.host !== "string") {
      throw new ConfigValidationError(`${prefix}: 'host' must be a string`);
    }

    if (typeof gateway.port !== "number" || gateway.port < 1 || gateway.port > 65535) {
      throw new ConfigValidationError(`${prefix}: 'port' must be a number between 1 and 65535`);
    }

    // Validate routes
    if (!Array.isArray(gateway.routes)) {
      throw new ConfigValidationError(`${prefix}: 'routes' must be an array`);
    }

    if (gateway.routes.length === 0) {
      throw new ConfigValidationError(`${prefix}: At least one route must be configured`);
    }

    const routes: Route[] = gateway.routes.map((route: any, routeIndex: number) => {
      return this.validateRoute(route, `${prefix}, Route ${routeIndex}`);
    });

    return {
      host: gateway.host,
      port: gateway.port,
      tls: gateway.tls,
      routes,
      middleware: gateway.middleware,
      connectionTimeout: gateway.connectionTimeout ?? 30000,
      requestTimeout: gateway.requestTimeout ?? 30000,
      maxConnections: gateway.maxConnections,
      keepAlive: gateway.keepAlive ?? true,
      keepAliveTimeout: gateway.keepAliveTimeout ?? 60000,
    };
  }

  /**
   * Validate route configuration
   */
  private static validateRoute(route: any, prefix: string): Route {
    if (!route.id || typeof route.id !== "string") {
      throw new ConfigValidationError(`${prefix}: 'id' must be a string`);
    }

    if (!route.pathPattern) {
      throw new ConfigValidationError(`${prefix}: 'pathPattern' must be specified`);
    }

    // Validate upstream
    if (!route.upstream || typeof route.upstream !== "object") {
      throw new ConfigValidationError(`${prefix}: 'upstream' must be an object`);
    }

    // Validate upstream servers
    if (!Array.isArray(route.upstream.servers)) {
      throw new ConfigValidationError(`${prefix}: 'upstream.servers' must be an array`);
    }

    if (route.upstream.servers.length === 0) {
      throw new ConfigValidationError(`${prefix}: At least one upstream server must be configured`);
    }

    const servers: UpstreamServer[] = route.upstream.servers.map(
      (server: any, serverIndex: number) => {
        return this.validateUpstreamServer(server, `${prefix}, Server ${serverIndex}`);
      },
    );

    return {
      id: route.id,
      pattern: (route as any).pathPattern || route.pattern,
      methods: route.methods,
      hostPattern: route.hostPattern,
      priority: route.priority ?? 100,
      enabled: route.enabled ?? true,
      upstream: {
        servers,
        loadBalancingStrategy:
          (route.upstream.loadBalancingStrategy || (route.upstream as any).loadBalancing) ??
            "round-robin",
        healthCheck: route.upstream.healthCheck,
        sessionAffinity: route.upstream.sessionAffinity,
        failover: route.upstream.failover,
        retryPolicy: route.upstream.retryPolicy,
        timeout: route.upstream?.timeout ?? 30000,
      },
      metadata: route.metadata,
    };
  }

  /**
   * Validate upstream server configuration
   */
  private static validateUpstreamServer(server: any, prefix: string): UpstreamServer {
    if (!server.id || typeof server.id !== "string") {
      throw new ConfigValidationError(`${prefix}: 'id' must be a string`);
    }

    if (!server.host || typeof server.host !== "string") {
      throw new ConfigValidationError(`${prefix}: 'host' must be a string`);
    }

    if (typeof server.port !== "number" || server.port < 1 || server.port > 65535) {
      throw new ConfigValidationError(`${prefix}: 'port' must be a number between 1 and 65535`);
    }

    return {
      id: server.id,
      host: server.host,
      port: server.port,
      protocol: server.protocol ?? "http",
      weight: server.weight ?? 1,
      enabled: server.enabled ?? true,
      metadata: server.metadata,
    };
  }
}

/**
 * Configuration builder for programmatic configuration
 */
export class ConfigBuilder {
  private config: Partial<RuntimeConfig> = {
    gateways: [],
  };

  /**
   * Set graceful shutdown
   */
  setGracefulShutdown(enabled: boolean, timeout?: number): this {
    this.config.gracefulShutdown = enabled;
    if (timeout !== undefined) {
      this.config.gracefulShutdownTimeout = timeout;
    }
    return this;
  }

  /**
   * Set signal handling
   */
  setSignalHandling(enabled: boolean): this {
    this.config.handleSignals = enabled;
    return this;
  }

  /**
   * Set environment
   */
  setEnvironment(environment: "development" | "production" | "test"): this {
    this.config.environment = environment;
    return this;
  }

  /**
   * Set log level
   */
  setLogLevel(level: "debug" | "info" | "warn" | "error"): this {
    this.config.logLevel = level;
    return this;
  }

  /**
   * Enable metrics
   */
  enableMetrics(port: number): this {
    this.config.metrics = true;
    this.config.metricsPort = port;
    return this;
  }

  /**
   * Add gateway
   */
  addGateway(gateway: GatewayServerConfig): this {
    if (!this.config.gateways) {
      this.config.gateways = [];
    }
    this.config.gateways.push(gateway);
    return this;
  }

  /**
   * Build configuration
   */
  build(): RuntimeConfig {
    return ConfigLoader.validate(this.config);
  }
}

/**
 * Create default configuration
 */
export function createDefaultConfig(port = 8080): RuntimeConfig {
  return new ConfigBuilder()
    .setEnvironment("development")
    .setLogLevel("info")
    .setGracefulShutdown(true, 30000)
    .setSignalHandling(true)
    .addGateway({
      host: "0.0.0.0",
      port,
      routes: [
        {
          id: "default",
          pattern: "/*",
          methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
          priority: 100,
          enabled: true,
          upstream: {
            servers: [
              {
                id: "default-backend",
                host: "localhost",
                port: 3000,
                protocol: "http",
                weight: 1,
                enabled: true,
              },
            ],
            loadBalancingStrategy: "round-robin",
            timeout: 30000,
          },
        },
      ],
    })
    .build();
}
