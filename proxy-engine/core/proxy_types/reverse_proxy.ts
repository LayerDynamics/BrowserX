/**
 * Reverse Proxy
 *
 * Routes client requests to backend servers. The proxy sits in front of
 * backend services and forwards requests on behalf of clients.
 *
 * Features:
 * - SSL/TLS termination
 * - Load balancing
 * - Header manipulation (X-Forwarded-*)
 * - Connection pooling
 * - Health checking
 */

import type { HTTPRequest, HTTPResponse } from "../network/transport/http/http.ts";
import { HTTP11Client } from "../network/transport/http/http.ts";
import { Socket } from "../network/transport/socket/socket.ts";
import type { Route, UpstreamServer } from "../../gateway/router/request_router.ts";
import type { LoadBalancer } from "../../gateway/router/load_balancer/types.ts";
import { createLoadBalancer } from "../../gateway/router/load_balancer/factory.ts";
import {
  DEFAULT_CONNECTION_POOL_CONFIG,
  UpstreamConnectionManager,
} from "../connection/connection_manager.ts";
import { HealthMonitor } from "../connection/health_check.ts";
import { UpstreamClient } from "../network/external/upstream_client.ts";
import type { HTTPHeaders } from "../network/utils/headers.ts";

/**
 * Reverse proxy configuration
 */
export interface ReverseProxyConfig {
  /**
   * Enable SSL/TLS termination
   */
  sslTermination?: boolean;

  /**
   * Add X-Forwarded-* headers
   */
  addForwardedHeaders?: boolean;

  /**
   * Preserve Host header from client
   */
  preserveHost?: boolean;

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
 * Request context
 */
interface RequestContext {
  clientIP: string;
  clientPort: number;
  protocol: string;
  startTime: number;
}

/**
 * Reverse proxy implementation
 */
export class ReverseProxy {
  private loadBalancer: LoadBalancer;
  private connectionManager: UpstreamConnectionManager;
  private healthMonitor?: HealthMonitor;
  private upstreamClient: UpstreamClient;

  constructor(
    protected route: Route,
    private config: ReverseProxyConfig = {},
  ) {
    // Create load balancer
    this.loadBalancer = createLoadBalancer(route.upstream.loadBalancingStrategy);

    // Create connection manager
    this.connectionManager = new UpstreamConnectionManager(DEFAULT_CONNECTION_POOL_CONFIG);

    // Create upstream client with circuit breaker and retry logic
    this.upstreamClient = new UpstreamClient();

    // Create health monitor if health check config provided
    if (route.upstream.healthCheck) {
      this.healthMonitor = new HealthMonitor(route.upstream.healthCheck);
      this.healthMonitor.start(route.upstream.servers);
    }
  }

  /**
   * Handle incoming request and forward to upstream
   */
  async handleRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    const startTime = Date.now();

    // Get healthy servers
    const servers = this.healthMonitor
      ? this.healthMonitor.getHealthyServers(this.route.upstream.servers)
      : this.route.upstream.servers.filter((s) => s.enabled);

    if (servers.length === 0) {
      return this.createErrorResponse(503, "No healthy upstream servers available");
    }

    // Select upstream server using load balancer
    const server = this.loadBalancer.select(
      {
        method: request.method,
        url: new URL(request.uri, "http://dummy"),
        headers: request.headers,
        body: request.body,
        clientIP: context.clientIP,
        metadata: {},
      },
      servers,
    );

    if (!server) {
      return this.createErrorResponse(503, "Failed to select upstream server");
    }

    // Forward request with retries
    const maxRetries = this.config.maxRetries ?? this.route.upstream.retryPolicy?.maxRetries ?? 0;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.forwardRequest(request, server, context);

        // Record success
        const responseTime = Date.now() - startTime;
        this.loadBalancer.recordSuccess(server.id, responseTime);

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Record failure
        this.loadBalancer.recordFailure(server.id);

        // Don't retry on last attempt
        if (attempt < maxRetries) {
          const retryDelay = this.config.retryDelay ??
            this.route.upstream.retryPolicy?.retryDelay ?? 100;
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    // All retries failed
    return this.createErrorResponse(
      502,
      `Bad Gateway: ${lastError?.message || "Unknown error"}`,
    );
  }

  /**
   * Forward request to upstream server
   */
  private async forwardRequest(
    request: HTTPRequest,
    server: UpstreamServer,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    // Prepare upstream request
    const upstreamRequest = this.prepareUpstreamRequest(request, server, context);

    // Build URL for upstream server
    const protocol = server.protocol === "https" ? "https" : "http";
    const url = `${protocol}://${server.host}:${server.port}${upstreamRequest.uri}`;

    // Convert HTTPHeaders Record to plain object
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(upstreamRequest.headers)) {
      headers[key] = value;
    }

    // Use UpstreamClient to make the request with built-in retry and circuit breaker
    const response = await this.upstreamClient.request({
      method: upstreamRequest.method,
      url,
      headers,
      body: upstreamRequest.body,
      timeout: this.config.timeout ?? this.route.upstream.timeout,
      retries: this.config.maxRetries ?? this.route.upstream.retryPolicy?.maxRetries,
      retryDelay: this.config.retryDelay ?? this.route.upstream.retryPolicy?.retryDelay,
    });

    // Convert response to HTTPResponse format
    const httpResponse: HTTPResponse = {
      version: "1.1",
      statusCode: response.statusCode,
      statusText: response.statusText,
      headers: response.headers,
      body: response.body,
    };

    // Process response
    return this.processUpstreamResponse(httpResponse, server);
  }

  /**
   * Prepare request for upstream server
   */
  private prepareUpstreamRequest(
    request: HTTPRequest,
    server: UpstreamServer,
    context: RequestContext,
  ): HTTPRequest {
    const headers = { ...request.headers };

    // Update Host header
    if (!this.config.preserveHost) {
      headers["host"] = `${server.host}:${server.port}`;
    }

    // Add X-Forwarded-* headers
    if (this.config.addForwardedHeaders !== false) {
      // X-Forwarded-For
      const existingXFF = headers["x-forwarded-for"];
      headers["x-forwarded-for"] = existingXFF
        ? `${existingXFF}, ${context.clientIP}`
        : context.clientIP;

      // X-Forwarded-Proto
      headers["x-forwarded-proto"] = context.protocol;

      // X-Forwarded-Host
      if (request.headers["host"]) {
        headers["x-forwarded-host"] = request.headers["host"];
      }

      // X-Forwarded-Port
      headers["x-forwarded-port"] = context.clientPort.toString();
    }

    // Add Via header
    headers["via"] = `1.1 reverse-proxy`;

    return {
      ...request,
      headers,
    };
  }

  /**
   * Process response from upstream server
   */
  private processUpstreamResponse(
    response: HTTPResponse,
    _server: UpstreamServer,
  ): HTTPResponse {
    // Could add response transformations here
    // For now, just pass through

    return response;
  }

  /**
   * Create error response
   */
  private createErrorResponse(status: number, message: string): HTTPResponse {
    const body = new TextEncoder().encode(JSON.stringify({
      error: message,
      status,
    }));

    return {
      version: "1.1",
      statusCode: status,
      statusText: this.getStatusText(status),
      headers: {
        "content-type": "application/json",
        "content-length": body.length.toString(),
        "connection": "close",
      },
      body,
    };
  }

  /**
   * Get status text for status code
   */
  private getStatusText(code: number): string {
    const statusTexts: Record<number, string> = {
      502: "Bad Gateway",
      503: "Service Unavailable",
      504: "Gateway Timeout",
    };

    return statusTexts[code] || "Error";
  }

  /**
   * Get load balancer
   */
  getLoadBalancer(): LoadBalancer {
    return this.loadBalancer;
  }

  /**
   * Get connection manager
   */
  getConnectionManager(): UpstreamConnectionManager {
    return this.connectionManager;
  }

  /**
   * Get health monitor (if enabled)
   */
  getHealthMonitor(): HealthMonitor | undefined {
    return this.healthMonitor;
  }

  /**
   * Get route configuration
   */
  getRoute(): Route {
    return this.route;
  }

  /**
   * Get proxy configuration
   */
  getConfig(): ReverseProxyConfig {
    return this.config;
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    return {
      loadBalancer: this.loadBalancer.getAllStats(),
      connections: this.connectionManager.getStats(),
      health: this.healthMonitor?.getStats(),
    };
  }

  /**
   * Shutdown proxy
   */
  async shutdown(): Promise<void> {
    if (this.healthMonitor) {
      this.healthMonitor.stop();
    }
    await this.connectionManager.shutdown();
  }
}
