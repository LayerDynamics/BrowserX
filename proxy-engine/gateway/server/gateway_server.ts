/**
 * Gateway Server
 *
 * Main HTTP/HTTPS server that orchestrates request handling through
 * middleware chain and proxy handlers
 */

import { Socket } from "../../core/network/transport/socket/socket.ts";
import { HTTP11Server } from "../../core/network/transport/http/http.ts";
import type { HTTPRequest, HTTPResponse } from "../../core/network/transport/http/http.ts";
import { PatternRouter } from "../router/request_router.ts";
import type { Route, RouteMatch } from "../router/request_router.ts";
import { createErrorResponse, MiddlewareChain } from "../middleware/middleware_chain.ts";
import type { MiddlewareChainConfig, RequestContext } from "../middleware/types.ts";
import { ReverseProxy } from "../../core/proxy_types/reverse_proxy.ts";
import {
  type FailoverConfig,
  LoadBalancerProxy,
  type SessionAffinityConfig,
} from "../../core/proxy_types/loadbalance_proxy.ts";

/**
 * Server configuration
 */
export interface GatewayServerConfig {
  /**
   * Host to bind to
   */
  host: string;

  /**
   * Port to listen on
   */
  port: number;

  /**
   * Enable TLS
   */
  tls?: {
    /**
     * Path to certificate file
     */
    certFile: string;

    /**
     * Path to private key file
     */
    keyFile: string;

    /**
     * ALPN protocols
     */
    alpnProtocols?: string[];
  };

  /**
   * Routes configuration
   */
  routes: Route[];

  /**
   * Middleware configuration
   */
  middleware?: MiddlewareChainConfig;

  /**
   * Connection timeout (ms)
   */
  connectionTimeout?: number;

  /**
   * Request timeout (ms)
   */
  requestTimeout?: number;

  /**
   * Maximum concurrent connections
   */
  maxConnections?: number;

  /**
   * Enable keep-alive
   */
  keepAlive?: boolean;

  /**
   * Keep-alive timeout (ms)
   */
  keepAliveTimeout?: number;
}

/**
 * Active connection tracking
 */
interface ActiveConnection {
  socket: Socket;
  startTime: number;
  requestCount: number;
}

/**
 * Gateway server statistics
 */
export interface GatewayServerStats {
  /**
   * Total requests handled
   */
  totalRequests: number;

  /**
   * Total errors
   */
  totalErrors: number;

  /**
   * Active connections
   */
  activeConnections: number;

  /**
   * Total bytes received
   */
  bytesReceived: number;

  /**
   * Total bytes sent
   */
  bytesSent: number;

  /**
   * Average request duration (ms)
   */
  avgRequestDuration: number;

  /**
   * Requests per second
   */
  requestsPerSecond: number;

  /**
   * Uptime (ms)
   */
  uptime: number;
}

/**
 * Gateway server implementation
 */
export class GatewayServer {
  private listener?: Deno.Listener;
  private router: PatternRouter;
  private middleware: MiddlewareChain;
  private proxies: Map<string, ReverseProxy | LoadBalancerProxy> = new Map();
  private activeConnections: Map<number, ActiveConnection> = new Map();
  private nextConnectionId = 1;
  private running = false;
  private startTime = 0;

  // Ready promise for coordinating startup
  private readyResolve?: () => void;
  private readyReject?: (error: Error) => void;
  private readyPromise: Promise<void>;

  // Statistics
  private stats = {
    totalRequests: 0,
    totalErrors: 0,
    bytesReceived: 0,
    bytesSent: 0,
    requestDurations: [] as number[],
  };

  constructor(private config: GatewayServerConfig) {
    // Create router
    this.router = new PatternRouter();
    for (const route of config.routes) {
      this.router.addRoute(route);
    }

    // Create middleware chain
    this.middleware = new MiddlewareChain(config.middleware);

    // Create proxy instances for routes
    this.initializeProxies();

    // Initialize ready promise for startup coordination
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
  }

  /**
   * Initialize proxy instances for routes
   */
  private initializeProxies(): void {
    for (const route of this.config.routes) {
      // Create appropriate proxy type based on route config
      let proxy: ReverseProxy | LoadBalancerProxy;

      if (route.upstream.sessionAffinity || route.upstream.failover) {
        // Use load balancer proxy with session affinity/failover
        proxy = new LoadBalancerProxy(route, {
          sessionAffinity: route.upstream.sessionAffinity as SessionAffinityConfig,
          failover: route.upstream.failover as FailoverConfig,
          timeout: this.config.connectionTimeout,
        });
      } else {
        // Use standard reverse proxy
        proxy = new ReverseProxy(route, {
          timeout: this.config.connectionTimeout,
        });
      }

      this.proxies.set(route.id, proxy);
    }
  }

  /**
   * Start server
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error("Server is already running");
    }

    try {
      // Create listener
      if (this.config.tls) {
        // Read certificate and key files
        const cert = await Deno.readTextFile(this.config.tls.certFile);
        const key = await Deno.readTextFile(this.config.tls.keyFile);

        this.listener = Deno.listenTls({
          hostname: this.config.host,
          port: this.config.port,
          cert,
          key,
          alpnProtocols: this.config.tls.alpnProtocols,
        });
        console.log(
          `Gateway server listening on https://${this.config.host}:${this.config.port}`,
        );
      } else {
        this.listener = Deno.listen({
          hostname: this.config.host,
          port: this.config.port,
        });
        console.log(
          `Gateway server listening on http://${this.config.host}:${this.config.port}`,
        );
      }

      this.running = true;
      this.startTime = Date.now();

      // Signal that server is ready to accept connections
      this.readyResolve?.();

      // Accept connections
      await this.acceptConnections();
    } catch (error) {
      // Signal failure to start
      this.readyReject?.(error instanceof Error ? error : new Error(String(error)));
      console.error("Failed to start server:", error);
      throw error;
    }
  }

  /**
   * Wait for server to be ready to accept connections
   */
  waitForReady(): Promise<void> {
    return this.readyPromise;
  }

  /**
   * Accept incoming connections
   */
  private async acceptConnections(): Promise<void> {
    if (!this.listener) {
      throw new Error("Listener not initialized");
    }

    for await (const conn of this.listener) {
      // Check max connections
      if (
        this.config.maxConnections &&
        this.activeConnections.size >= this.config.maxConnections
      ) {
        console.warn("Max connections reached, rejecting connection");
        conn.close();
        continue;
      }

      // Handle connection in background
      this.handleConnection(conn).catch((error) => {
        console.error("Connection handling error:", error);
      });
    }
  }

  /**
   * Handle individual connection
   */
  private async handleConnection(conn: Deno.Conn): Promise<void> {
    const connectionId = this.nextConnectionId++;
    const socket = Socket.fromConn(conn as Deno.TcpConn);

    // Track active connection
    const activeConn: ActiveConnection = {
      socket,
      startTime: Date.now(),
      requestCount: 0,
    };
    this.activeConnections.set(connectionId, activeConn);

    // Declare outside try block so it's accessible in finally
    let keepAliveIntervalId: number | undefined;
    let requestTimeoutId: number | undefined;

    try {
      // Create HTTP server
      const httpServer = new HTTP11Server(socket);

      // Handle requests on this connection
      let shouldKeepAlive = this.config.keepAlive ?? true;

      while (shouldKeepAlive && this.running) {
        try {
          // Clear any existing keep-alive interval before reading next request
          if (keepAliveIntervalId !== undefined) {
            clearInterval(keepAliveIntervalId);
            keepAliveIntervalId = undefined;
          }

          // Clear any existing request timeout
          if (requestTimeoutId !== undefined) {
            clearTimeout(requestTimeoutId);
            requestTimeoutId = undefined;
          }

          // Set request timeout
          const timeout = this.config.requestTimeout || 30000;
          requestTimeoutId = setTimeout(() => {
            socket.close();
          }, timeout) as unknown as number;

          // Read request
          const request = await httpServer.readRequest();
          clearTimeout(requestTimeoutId);
          requestTimeoutId = undefined;

          activeConn.requestCount++;
          this.stats.bytesReceived += request.body?.length || 0;

          // Handle request
          const response = await this.handleRequest(request, {
            socket,
            connectionId,
          });

          this.stats.bytesSent += response.body?.length || 0;

          // Send response
          await httpServer.sendResponse(response);

          // Check if should keep connection alive
          const connection = request.headers["connection"]?.toLowerCase();
          const responseConnection = response.headers["connection"]?.toLowerCase();

          shouldKeepAlive = shouldKeepAlive &&
            connection !== "close" &&
            responseConnection !== "close";

          // Apply keep-alive timeout
          if (shouldKeepAlive && this.config.keepAliveTimeout) {
            const idleStart = Date.now();
            const keepAliveTimeout = this.config.keepAliveTimeout;

            // Check if connection has been idle too long
            keepAliveIntervalId = setInterval(() => {
              const idleTime = Date.now() - idleStart;
              if (idleTime > keepAliveTimeout) {
                shouldKeepAlive = false;
                if (keepAliveIntervalId !== undefined) {
                  clearInterval(keepAliveIntervalId);
                  keepAliveIntervalId = undefined;
                }
                socket.close();
              }
            }, 1000) as unknown as number;
          }
        } catch (error) {
          // Request processing error - close connection
          console.error("Request processing error:", error);
          shouldKeepAlive = false;
        }
      }
    } finally {
      // Cleanup request timeout to prevent memory leak
      if (requestTimeoutId !== undefined) {
        clearTimeout(requestTimeoutId);
      }
      // Cleanup keep-alive interval to prevent memory leak
      if (keepAliveIntervalId !== undefined) {
        clearInterval(keepAliveIntervalId);
      }
      // Cleanup connection
      this.activeConnections.delete(connectionId);
      socket.close();
    }
  }

  /**
   * Handle HTTP request
   */
  private async handleRequest(
    request: HTTPRequest,
    connectionInfo: {
      socket: Socket;
      connectionId: number;
    },
  ): Promise<HTTPResponse> {
    const requestStartTime = Date.now();

    try {
      // Create request context
      const remoteAddr = connectionInfo.socket.getRemoteAddr();
      const context: RequestContext = {
        clientIP: (remoteAddr as Deno.NetAddr)?.hostname || "unknown",
        clientPort: (remoteAddr as Deno.NetAddr)?.port || 0,
        protocol: this.config.tls ? "https" : "http",
        startTime: requestStartTime,
        requestId: `${connectionInfo.connectionId}-${crypto.randomUUID()}`,
        metadata: {},
      };

      // Execute request middleware chain
      const middlewareResult = await this.middleware.executeRequest(request, context);

      if (middlewareResult.type === "respond") {
        // Middleware short-circuited with response
        const response = middlewareResult.response;
        return await this.middleware.executeResponse(request, response, context);
      }

      if (middlewareResult.type === "error") {
        // Middleware error
        this.stats.totalErrors++;
        const errorResponse = createErrorResponse(middlewareResult.error);
        return await this.middleware.executeResponse(request, errorResponse, context);
      }

      // Route request
      const match = this.router.match({
        method: request.method,
        url: new URL(request.uri, `${context.protocol}://localhost`),
        headers: request.headers,
        body: request.body,
        clientIP: context.clientIP,
        metadata: context.metadata,
      });

      if (!match) {
        // No route matched
        const notFoundResponse = this.createNotFoundResponse();
        return await this.middleware.executeResponse(request, notFoundResponse, context);
      }

      // Get proxy handler for route
      const proxy = this.proxies.get(match.route.id);
      if (!proxy) {
        throw new Error(`No proxy handler found for route ${match.route.id}`);
      }

      // Forward to proxy handler
      const response = await proxy.handleRequest(request, {
        clientIP: context.clientIP,
        clientPort: context.clientPort,
        protocol: context.protocol,
        startTime: context.startTime,
      });

      // Execute response middleware chain
      const finalResponse = await this.middleware.executeResponse(
        request,
        response,
        context,
      );

      // Record statistics
      this.stats.totalRequests++;
      const duration = Date.now() - requestStartTime;
      this.stats.requestDurations.push(duration);

      // Keep last 1000 durations
      if (this.stats.requestDurations.length > 1000) {
        this.stats.requestDurations.shift();
      }

      return finalResponse;
    } catch (error) {
      console.error("Request handling error:", error);
      this.stats.totalErrors++;

      const errorResponse = createErrorResponse(
        error instanceof Error ? error : new Error(String(error)),
      );

      return errorResponse;
    }
  }

  /**
   * Create 404 Not Found response
   */
  private createNotFoundResponse(): HTTPResponse {
    const body = new TextEncoder().encode(
      JSON.stringify({
        error: "Not Found",
        message: "The requested resource was not found",
        statusCode: 404,
      }),
    );

    return {
      version: "1.1",
      statusCode: 404,
      statusText: "Not Found",
      headers: {
        "content-type": "application/json",
        "content-length": body.length.toString(),
        "connection": "close",
      },
      body,
    };
  }

  /**
   * Get server statistics
   */
  getStats(): GatewayServerStats {
    const uptime = Date.now() - this.startTime;
    const avgDuration = this.stats.requestDurations.length > 0
      ? this.stats.requestDurations.reduce((a, b) => a + b, 0) /
        this.stats.requestDurations.length
      : 0;

    const requestsPerSecond = uptime > 0 ? (this.stats.totalRequests / uptime) * 1000 : 0;

    return {
      totalRequests: this.stats.totalRequests,
      totalErrors: this.stats.totalErrors,
      activeConnections: this.activeConnections.size,
      bytesReceived: this.stats.bytesReceived,
      bytesSent: this.stats.bytesSent,
      avgRequestDuration: avgDuration,
      requestsPerSecond,
      uptime,
    };
  }

  /**
   * Get router instance
   */
  getRouter(): PatternRouter {
    return this.router;
  }

  /**
   * Get middleware chain
   */
  getMiddlewareChain(): MiddlewareChain {
    return this.middleware;
  }

  /**
   * Get proxy instances
   */
  getProxies(): Map<string, ReverseProxy | LoadBalancerProxy> {
    return new Map(this.proxies);
  }

  /**
   * Get server configuration
   */
  getConfig(): GatewayServerConfig {
    return this.config;
  }

  /**
   * Stop server
   */
  async shutdown(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.log("Shutting down gateway server...");
    this.running = false;

    // Close listener
    if (this.listener) {
      this.listener.close();
      this.listener = undefined;
    }

    // Close all active connections
    for (const [_id, conn] of this.activeConnections.entries()) {
      conn.socket.close();
    }
    this.activeConnections.clear();

    // Shutdown all proxies
    for (const [_id, proxy] of this.proxies.entries()) {
      await proxy.shutdown();
    }
    this.proxies.clear();

    console.log("Gateway server shut down");
  }
}
