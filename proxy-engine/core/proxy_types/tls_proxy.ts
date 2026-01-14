/**
 * TLS Proxy
 *
 * Provides TLS termination, inspection, and re-encryption with support for:
 * - TLS termination (decrypt client TLS, forward plain HTTP to backend)
 * - TLS passthrough (forward encrypted traffic without inspection)
 * - TLS re-encryption (decrypt, inspect, re-encrypt to backend)
 * - Certificate management
 * - SNI (Server Name Indication) routing
 */

import type { HTTPRequest, HTTPResponse } from "../network/transport/http/http.ts";
import { HTTP11Client } from "../network/transport/http/http.ts";
import { HTTPSClient } from "../network/transport/http/https.ts";
import type { Route, UpstreamServer } from "../../gateway/router/request_router.ts";
import type { LoadBalancer } from "../../gateway/router/load_balancer/types.ts";
import { createLoadBalancer } from "../../gateway/router/load_balancer/factory.ts";
import { HealthMonitor } from "../connection/health_check.ts";
import {
  DEFAULT_CONNECTION_POOL_CONFIG,
  UpstreamConnectionManager,
} from "../connection/connection_manager.ts";

/**
 * TLS mode
 */
export type TLSMode = "termination" | "passthrough" | "re-encryption";

/**
 * TLS proxy configuration
 */
export interface TLSProxyConfig {
  /**
   * TLS mode
   */
  mode?: TLSMode;

  /**
   * Enable SNI inspection
   */
  enableSNI?: boolean;

  /**
   * Verify upstream certificates
   */
  verifyUpstreamCerts?: boolean;

  /**
   * Minimum TLS version
   */
  minTLSVersion?: "1.2" | "1.3";

  /**
   * Connection timeout (ms)
   */
  timeout?: number;

  /**
   * Max retries on failure
   */
  maxRetries?: number;

  /**
   * Retry delay (ms)
   */
  retryDelay?: number;
}

/**
 * TLS proxy statistics
 */
export interface TLSProxyStats {
  /**
   * Total connections
   */
  totalConnections: number;

  /**
   * TLS terminations
   */
  tlsTerminations: number;

  /**
   * TLS passthroughs
   */
  tlsPassthroughs: number;

  /**
   * TLS re-encryptions
   */
  tlsReEncryptions: number;

  /**
   * Certificate errors
   */
  certificateErrors: number;

  /**
   * Connection errors
   */
  connectionErrors: number;
}

/**
 * Request context
 */
interface RequestContext {
  clientIP: string;
  clientPort: number;
  protocol: string;
  startTime: number;
}

/**
 * TLS proxy implementation
 */
export class TLSProxy {
  private loadBalancer: LoadBalancer;
  private healthMonitor?: HealthMonitor;
  private connectionManager: UpstreamConnectionManager;
  private config: Required<TLSProxyConfig>;

  // Statistics
  private stats: TLSProxyStats = {
    totalConnections: 0,
    tlsTerminations: 0,
    tlsPassthroughs: 0,
    tlsReEncryptions: 0,
    certificateErrors: 0,
    connectionErrors: 0,
  };

  constructor(
    private route: Route,
    config: TLSProxyConfig = {},
  ) {
    this.config = {
      mode: config.mode ?? "termination",
      enableSNI: config.enableSNI ?? true,
      verifyUpstreamCerts: config.verifyUpstreamCerts ?? true,
      minTLSVersion: config.minTLSVersion ?? "1.2",
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
    };

    // Create load balancer
    this.loadBalancer = createLoadBalancer(route.upstream.loadBalancingStrategy);

    // Create connection manager
    this.connectionManager = new UpstreamConnectionManager(DEFAULT_CONNECTION_POOL_CONFIG);

    // Create health monitor if health check config provided
    if (route.upstream.healthCheck) {
      this.healthMonitor = new HealthMonitor(route.upstream.healthCheck);
      this.healthMonitor.start(route.upstream.servers);
    }
  }

  /**
   * Handle request
   */
  async handleRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    this.stats.totalConnections++;

    try {
      // Select upstream server
      const server = this.selectUpstreamServer(request, context);
      if (!server) {
        this.stats.connectionErrors++;
        return this.createErrorResponse(503, "No healthy upstream servers available");
      }

      // Handle based on TLS mode
      switch (this.config.mode) {
        case "termination":
          return await this.handleTermination(request, server, context);
        case "passthrough":
          return await this.handlePassthrough(request, server, context);
        case "re-encryption":
          return await this.handleReEncryption(request, server, context);
        default:
          throw new Error(`Unknown TLS mode: ${this.config.mode}`);
      }
    } catch (error) {
      console.error("[TLS Proxy] Request handling error:", error);
      this.stats.connectionErrors++;
      return this.createErrorResponse(502, "Bad Gateway");
    }
  }

  /**
   * Handle TLS termination (decrypt, forward plain HTTP)
   */
  private async handleTermination(
    request: HTTPRequest,
    server: UpstreamServer,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    this.stats.tlsTerminations++;

    // Forward as plain HTTP
    const client = new HTTP11Client({
      host: server.host,
      port: server.port,
      timeout: this.config.timeout,
    });

    await client.connect();
    const response = await client.sendRequest(request);
    await client.close();

    return response;
  }

  /**
   * Handle TLS passthrough (forward encrypted without inspection)
   */
  private async handlePassthrough(
    request: HTTPRequest,
    server: UpstreamServer,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    this.stats.tlsPassthroughs++;

    // In passthrough mode, we can't inspect the request
    // Just forward the encrypted stream
    // This is a placeholder - real implementation would handle at TCP level

    return this.createErrorResponse(501, "TLS passthrough not yet implemented");
  }

  /**
   * Handle TLS re-encryption (decrypt, inspect, re-encrypt)
   */
  private async handleReEncryption(
    request: HTTPRequest,
    server: UpstreamServer,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    this.stats.tlsReEncryptions++;

    // Forward as HTTPS (re-encrypt to upstream)
    const client = new HTTPSClient(server.host, server.port);

    await client.connect();
    const response = await client.sendRequest(request);
    await client.close();

    return response;
  }

  /**
   * Select upstream server using load balancer
   */
  private selectUpstreamServer(
    request: HTTPRequest,
    context: RequestContext,
  ): UpstreamServer | null {
    // Filter healthy servers
    const servers = this.route.upstream.servers.filter((server) => {
      if (this.healthMonitor) {
        return this.healthMonitor.isHealthy(server);
      }
      return true;
    });

    if (servers.length === 0) {
      return null;
    }

    // Select server using load balancer
    return this.loadBalancer.selectServer(servers, request, context.clientIP);
  }

  /**
   * Create error response
   */
  private createErrorResponse(statusCode: number, message: string): HTTPResponse {
    return {
      statusCode,
      statusText: message,
      version: "1.1",
      headers: {
        "content-type": "text/plain",
      },
      body: new TextEncoder().encode(message),
    };
  }

  /**
   * Get proxy statistics
   */
  getStats(): TLSProxyStats {
    return { ...this.stats };
  }

  /**
   * Get load balancer
   */
  getLoadBalancer(): LoadBalancer {
    return this.loadBalancer;
  }

  /**
   * Get health monitor
   */
  getHealthMonitor(): HealthMonitor | undefined {
    return this.healthMonitor;
  }

  /**
   * Get connection manager
   */
  getConnectionManager(): UpstreamConnectionManager {
    return this.connectionManager;
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<TLSProxyConfig> {
    return { ...this.config };
  }

  /**
   * Get route
   */
  getRoute(): Route {
    return this.route;
  }

  /**
   * Get TLS mode
   */
  getTLSMode(): TLSMode {
    return this.config.mode;
  }

  /**
   * Close proxy and clean up resources
   */
  async close(): Promise<void> {
    if (this.healthMonitor) {
      this.healthMonitor.stop();
    }

    await this.connectionManager.closeAll();
  }
}
