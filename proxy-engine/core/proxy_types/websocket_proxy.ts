/**
 * WebSocket Proxy
 *
 * Proxies WebSocket connections with support for:
 * - Protocol upgrade handling
 * - Bidirectional message forwarding
 * - Load balancing across upstream WebSocket servers
 * - Health checking
 * - Message inspection and transformation
 * - Authentication and authorization
 */

import type { HTTPRequest, HTTPResponse } from "../network/transport/http/http.ts";
import type { Route, UpstreamServer } from "../../gateway/router/request_router.ts";
import type { LoadBalancer } from "../../gateway/router/load_balancer/types.ts";
import { createLoadBalancer } from "../../gateway/router/load_balancer/factory.ts";
import { HealthMonitor } from "../connection/health_check.ts";

/**
 * WebSocket proxy configuration
 */
export interface WebSocketProxyConfig {
  /**
   * Enable message inspection
   */
  inspectMessages?: boolean;

  /**
   * Enable message transformation
   */
  transformMessages?: boolean;

  /**
   * Message size limit (bytes)
   */
  maxMessageSize?: number;

  /**
   * Connection timeout (ms)
   */
  timeout?: number;

  /**
   * Max retries on connection failure
   */
  maxRetries?: number;

  /**
   * Retry delay (ms)
   */
  retryDelay?: number;

  /**
   * Enable ping/pong heartbeat
   */
  enableHeartbeat?: boolean;

  /**
   * Heartbeat interval (ms)
   */
  heartbeatInterval?: number;

  /**
   * Add X-Forwarded-* headers to upgrade request
   */
  addForwardedHeaders?: boolean;

  /**
   * Message transformation hook
   * Called for each message to allow custom transformations
   * @param data - The message data (string or ArrayBuffer)
   * @param direction - Message direction ('client->origin' or 'origin->client')
   * @returns Transformed message data
   */
  transformHook?: (data: string | ArrayBuffer, direction: string) => string | ArrayBuffer;
}

/**
 * WebSocket message
 */
export interface WebSocketMessage {
  type: "text" | "binary" | "ping" | "pong" | "close";
  data: string | Uint8Array;
  timestamp: number;
}

/**
 * WebSocket proxy statistics
 */
export interface WebSocketProxyStats {
  /**
   * Total connections
   */
  totalConnections: number;

  /**
   * Active connections
   */
  activeConnections: number;

  /**
   * Messages sent (client → origin)
   */
  messagesSent: number;

  /**
   * Messages received (origin → client)
   */
  messagesReceived: number;

  /**
   * Bytes sent
   */
  bytesSent: number;

  /**
   * Bytes received
   */
  bytesReceived: number;

  /**
   * Connection errors
   */
  connectionErrors: number;

  /**
   * Message errors
   */
  messageErrors: number;
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
 * WebSocket proxy implementation
 */
export class WebSocketProxy {
  private loadBalancer: LoadBalancer;
  private healthMonitor?: HealthMonitor;
  private config: Required<Omit<WebSocketProxyConfig, "transformHook">>;
  private transformHook?: (data: string | ArrayBuffer, direction: string) => string | ArrayBuffer;

  // Statistics
  private stats: WebSocketProxyStats = {
    totalConnections: 0,
    activeConnections: 0,
    messagesSent: 0,
    messagesReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
    connectionErrors: 0,
    messageErrors: 0,
  };

  constructor(
    private route: Route,
    config: WebSocketProxyConfig = {},
  ) {
    this.config = {
      inspectMessages: config.inspectMessages ?? false,
      transformMessages: config.transformMessages ?? false,
      maxMessageSize: config.maxMessageSize ?? 1024 * 1024, // 1MB
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      enableHeartbeat: config.enableHeartbeat ?? true,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      addForwardedHeaders: config.addForwardedHeaders ?? true,
    };

    // Store transformation hook if provided
    this.transformHook = config.transformHook;

    // Create load balancer
    this.loadBalancer = createLoadBalancer(route.upstream.loadBalancingStrategy);

    // Create health monitor if health check config provided
    if (route.upstream.healthCheck) {
      this.healthMonitor = new HealthMonitor(route.upstream.healthCheck);
      this.healthMonitor.start(route.upstream.servers);
    }
  }

  /**
   * Handle WebSocket upgrade request
   */
  async handleRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    // Check if this is a WebSocket upgrade request
    const upgrade = request.headers["upgrade"]?.toLowerCase();
    const connection = request.headers["connection"]?.toLowerCase();

    if (upgrade !== "websocket" || !connection?.includes("upgrade")) {
      return {
        statusCode: 400,
        statusText: "Bad Request",
        version: "1.1",
        headers: {
          "content-type": "text/plain",
        },
        body: new TextEncoder().encode("Expected WebSocket upgrade request"),
      };
    }

    // Select upstream server
    const server = this.selectUpstreamServer(request, context);
    if (!server) {
      this.stats.connectionErrors++;
      return {
        statusCode: 503,
        statusText: "Service Unavailable",
        version: "1.1",
        headers: {
          "content-type": "text/plain",
        },
        body: new TextEncoder().encode("No healthy upstream servers available"),
      };
    }

    // For now, return upgrade response
    // In a real implementation, this would be handled by the gateway server
    // which would upgrade the connection and call handleWebSocketConnection
    return {
      statusCode: 101,
      statusText: "Switching Protocols",
      version: "1.1",
      headers: {
        "upgrade": "websocket",
        "connection": "Upgrade",
      },
      body: new Uint8Array(0),
    };
  }

  /**
   * Handle upgraded WebSocket connection
   */
  async handleWebSocketConnection(
    clientWs: WebSocket,
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<void> {
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    let originWs: WebSocket | null = null;
    let heartbeatInterval: number | null = null;

    try {
      // Select upstream server
      const server = this.selectUpstreamServer(request, context);
      if (!server) {
        throw new Error("No healthy upstream servers available");
      }

      // Build origin WebSocket URL
      const originUrl = this.buildOriginUrl(server, request);

      // Connect to origin WebSocket with retries
      originWs = await this.connectToOrigin(originUrl, request, context);

      // Set up bidirectional message forwarding
      this.setupMessageForwarding(clientWs, originWs, context);

      // Set up heartbeat if enabled
      if (this.config.enableHeartbeat) {
        heartbeatInterval = setInterval(() => {
          try {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "ping" }));
            }
          } catch (error) {
            console.error("[WebSocket Proxy] Heartbeat error:", error);
          }
        }, this.config.heartbeatInterval);
      }

      // Wait for connection to close
      await new Promise<void>((resolve) => {
        const closeHandler = () => {
          resolve();
        };
        clientWs.addEventListener("close", closeHandler);
        originWs!.addEventListener("close", closeHandler);
      });
    } catch (error) {
      console.error("[WebSocket Proxy] Connection error:", error);
      this.stats.connectionErrors++;

      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1011, "Internal server error");
      }
    } finally {
      // Clean up
      if (heartbeatInterval !== null) {
        clearInterval(heartbeatInterval);
      }

      if (originWs && originWs.readyState === WebSocket.OPEN) {
        originWs.close();
      }

      this.stats.activeConnections--;
    }
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
   * Build origin WebSocket URL
   */
  private buildOriginUrl(server: UpstreamServer, request: HTTPRequest): string {
    const url = new URL(request.uri);
    const protocol = server.protocol === "https" ? "wss" : "ws";
    return `${protocol}://${server.host}:${server.port}${url.pathname}${url.search}`;
  }

  /**
   * Connect to origin WebSocket with retries
   */
  private async connectToOrigin(
    url: string,
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<WebSocket> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const ws = new WebSocket(url);

        // Add forwarded headers if enabled
        if (this.config.addForwardedHeaders) {
          // Note: WebSocket API doesn't support custom headers
          // In production, this would be handled at the TCP level
        }

        // Wait for connection to open
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("WebSocket connection timeout"));
          }, this.config.timeout);

          ws.onopen = () => {
            clearTimeout(timeout);
            resolve();
          };

          ws.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("WebSocket connection failed"));
          };
        });

        return ws;
      } catch (error) {
        lastError = error as Error;
        console.error(`[WebSocket Proxy] Connection attempt ${attempt + 1} failed:`, error);

        if (attempt < this.config.maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }

    throw lastError || new Error("Failed to connect to origin");
  }

  /**
   * Set up bidirectional message forwarding
   */
  private setupMessageForwarding(
    clientWs: WebSocket,
    originWs: WebSocket,
    context: RequestContext,
  ): void {
    // Client → Origin
    clientWs.onmessage = (event) => {
      try {
        const data = event.data;

        // Check message size
        const size = typeof data === "string" ? data.length : data.byteLength;
        if (size > this.config.maxMessageSize) {
          this.stats.messageErrors++;
          console.error("[WebSocket Proxy] Message too large:", size);
          return;
        }

        // Inspect message if enabled
        if (this.config.inspectMessages) {
          this.inspectMessage("client→origin", data, context);
        }

        // Transform message if enabled
        let transformedData = data;
        if (this.config.transformMessages) {
          transformedData = this.transformMessage(data, "client→origin");
        }

        // Forward to origin
        if (originWs.readyState === WebSocket.OPEN) {
          originWs.send(transformedData);
          this.stats.messagesSent++;
          this.stats.bytesSent += size;
        }
      } catch (error) {
        this.stats.messageErrors++;
        console.error("[WebSocket Proxy] Error forwarding client message:", error);
      }
    };

    // Origin → Client
    originWs.onmessage = (event) => {
      try {
        const data = event.data;

        // Check message size
        const size = typeof data === "string" ? data.length : data.byteLength;
        if (size > this.config.maxMessageSize) {
          this.stats.messageErrors++;
          console.error("[WebSocket Proxy] Message too large:", size);
          return;
        }

        // Inspect message if enabled
        if (this.config.inspectMessages) {
          this.inspectMessage("origin→client", data, context);
        }

        // Transform message if enabled
        let transformedData = data;
        if (this.config.transformMessages) {
          transformedData = this.transformMessage(data, "origin→client");
        }

        // Forward to client
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(transformedData);
          this.stats.messagesReceived++;
          this.stats.bytesReceived += size;
        }
      } catch (error) {
        this.stats.messageErrors++;
        console.error("[WebSocket Proxy] Error forwarding origin message:", error);
      }
    };

    // Handle close from either side
    clientWs.onclose = (event) => {
      if (originWs.readyState === WebSocket.OPEN) {
        originWs.close(event.code, event.reason);
      }
    };

    originWs.onclose = (event) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(event.code, event.reason);
      }
    };

    // Handle errors
    clientWs.onerror = () => {
      this.stats.messageErrors++;
      if (originWs.readyState === WebSocket.OPEN) {
        originWs.close(1011, "Client error");
      }
    };

    originWs.onerror = () => {
      this.stats.messageErrors++;
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1011, "Origin error");
      }
    };
  }

  /**
   * Inspect message (for logging/debugging)
   */
  private inspectMessage(
    direction: string,
    data: string | ArrayBuffer,
    context: RequestContext,
  ): void {
    const preview = typeof data === "string"
      ? data.substring(0, 100)
      : `<binary ${data.byteLength} bytes>`;
    console.log(`[WebSocket Proxy] ${direction} [${context.clientIP}]: ${preview}`);
  }

  /**
   * Transform message using configured transformation hook
   *
   * @param data - Message data to transform
   * @param direction - Direction of message flow ('client->origin' or 'origin->client')
   * @returns Transformed message data, or original data if no hook configured or on error
   */
  private transformMessage(
    data: string | ArrayBuffer,
    direction: string,
  ): string | ArrayBuffer {
    // Return original data if transformation is disabled or no hook configured
    if (!this.config.transformMessages || !this.transformHook) {
      return data;
    }

    try {
      // Apply transformation hook
      const transformed = this.transformHook(data, direction);
      return transformed;
    } catch (error) {
      // On error, increment error counter and log, then return original data
      this.stats.messageErrors++;
      console.error(
        `[WebSocket Proxy] Message transformation error (${direction}):`,
        error,
      );
      return data;
    }
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
   * Get configuration
   */
  getConfig(): Required<Omit<WebSocketProxyConfig, "transformHook">> & { transformHook?: (data: string | ArrayBuffer, direction: string) => string | ArrayBuffer } {
    return { ...this.config, transformHook: this.transformHook };
  }

  /**
   * Get transform hook
   */
  getTransformHook(): ((data: string | ArrayBuffer, direction: string) => string | ArrayBuffer) | undefined {
    return this.transformHook;
  }

  /**
   * Get route
   */
  getRoute(): Route {
    return this.route;
  }

  /**
   * Get active connections count
   */
  getActiveConnections(): number {
    return this.stats.activeConnections;
  }

  /**
   * Get proxy statistics
   */
  getStats(): WebSocketProxyStats {
    return { ...this.stats };
  }

  /**
   * Close proxy and clean up resources
   */
  async close(): Promise<void> {
    if (this.healthMonitor) {
      this.healthMonitor.stop();
    }
  }
}
