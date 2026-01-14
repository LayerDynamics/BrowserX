/**
 * Server-Sent Events (SSE) Proxy
 *
 * Proxies Server-Sent Events streams with support for:
 * - Long-lived HTTP streaming connections
 * - Event ID tracking for automatic reconnection
 * - Load balancing across upstream SSE servers
 * - Health checking
 * - Event inspection and transformation
 * - Keep-alive management
 */

import type { HTTPRequest, HTTPResponse } from "../network/transport/http/http.ts";
import { HTTP11Client } from "../network/transport/http/http.ts";
import type { Route, UpstreamServer } from "../../gateway/router/request_router.ts";
import type { LoadBalancer } from "../../gateway/router/load_balancer/types.ts";
import { createLoadBalancer } from "../../gateway/router/load_balancer/factory.ts";
import { HealthMonitor } from "../connection/health_check.ts";
import {
  DEFAULT_CONNECTION_POOL_CONFIG,
  UpstreamConnectionManager,
} from "../connection/connection_manager.ts";

/**
 * SSE proxy configuration
 */
export interface SSEProxyConfig {
  /**
   * Enable event inspection
   */
  inspectEvents?: boolean;

  /**
   * Enable event transformation
   */
  transformEvents?: boolean;

  /**
   * Event size limit (bytes)
   */
  maxEventSize?: number;

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
   * Keep-alive interval (ms)
   */
  keepAliveInterval?: number;

  /**
   * Add X-Forwarded-* headers
   */
  addForwardedHeaders?: boolean;

  /**
   * Enable automatic reconnection
   */
  enableReconnection?: boolean;

  /**
   * Reconnection timeout (ms)
   */
  reconnectionTimeout?: number;

  /**
   * Event transformation hook
   * Called for each event to allow custom transformations
   * @param event - The SSE event to transform
   * @param direction - Event direction ('origin->client')
   * @returns Transformed event
   */
  transformHook?: (event: SSEEvent, direction: string) => SSEEvent;
}

/**
 * SSE event
 */
export interface SSEEvent {
  /**
   * Event ID
   */
  id?: string;

  /**
   * Event type
   */
  event?: string;

  /**
   * Event data
   */
  data: string;

  /**
   * Retry interval (ms)
   */
  retry?: number;
}

/**
 * SSE proxy statistics
 */
export interface SSEProxyStats {
  /**
   * Total connections
   */
  totalConnections: number;

  /**
   * Active connections
   */
  activeConnections: number;

  /**
   * Events forwarded
   */
  eventsForwarded: number;

  /**
   * Bytes sent
   */
  bytesSent: number;

  /**
   * Connection errors
   */
  connectionErrors: number;

  /**
   * Event errors
   */
  eventErrors: number;

  /**
   * Reconnections
   */
  reconnections: number;
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
 * SSE proxy implementation
 */
export class SSEProxy {
  private loadBalancer: LoadBalancer;
  private healthMonitor?: HealthMonitor;
  private connectionManager: UpstreamConnectionManager;
  private config: Required<Omit<SSEProxyConfig, "transformHook">>;
  private transformHook?: (event: SSEEvent, direction: string) => SSEEvent;

  // Statistics
  private stats: SSEProxyStats = {
    totalConnections: 0,
    activeConnections: 0,
    eventsForwarded: 0,
    bytesSent: 0,
    connectionErrors: 0,
    eventErrors: 0,
    reconnections: 0,
  };

  constructor(
    private route: Route,
    config: SSEProxyConfig = {},
  ) {
    this.config = {
      inspectEvents: config.inspectEvents ?? false,
      transformEvents: config.transformEvents ?? false,
      maxEventSize: config.maxEventSize ?? 64 * 1024, // 64KB
      timeout: config.timeout ?? 300000, // 5 minutes
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      keepAliveInterval: config.keepAliveInterval ?? 15000,
      addForwardedHeaders: config.addForwardedHeaders ?? true,
      enableReconnection: config.enableReconnection ?? true,
      reconnectionTimeout: config.reconnectionTimeout ?? 3000,
    };

    // Store transformation hook if provided
    this.transformHook = config.transformHook;

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
   * Handle SSE request
   */
  async handleRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    try {
      // Select upstream server
      const server = this.selectUpstreamServer(request, context);
      if (!server) {
        this.stats.connectionErrors++;
        return this.createErrorResponse(503, "No healthy upstream servers available");
      }

      // Get Last-Event-ID if present (for reconnection)
      const lastEventId = request.headers["last-event-id"];

      // Create upstream request
      const upstreamRequest = this.buildUpstreamRequest(request, server, context, lastEventId);

      // Connect to upstream with retries
      const upstreamResponse = await this.connectToUpstream(upstreamRequest, server);

      // Return streaming response
      return this.createStreamingResponse(upstreamResponse, context);
    } catch (error) {
      console.error("[SSE Proxy] Request handling error:", error);
      this.stats.connectionErrors++;
      return this.createErrorResponse(502, "Failed to connect to upstream");
    } finally {
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
   * Build upstream request
   */
  private buildUpstreamRequest(
    request: HTTPRequest,
    server: UpstreamServer,
    context: RequestContext,
    lastEventId?: string | null,
  ): HTTPRequest {
    const url = new URL(request.uri);
    const upstreamUrl =
      `${server.protocol}://${server.host}:${server.port}${url.pathname}${url.search}`;

    const headers = { ...request.headers };

    // Add forwarded headers if enabled
    if (this.config.addForwardedHeaders) {
      headers["x-forwarded-for"] = context.clientIP;
      headers["x-forwarded-proto"] = context.protocol;
      headers["x-forwarded-host"] = request.headers["host"] || "";
    }

    // Add Last-Event-ID for reconnection
    if (lastEventId) {
      headers["last-event-id"] = lastEventId;
    }

    // Set SSE headers
    headers["accept"] = "text/event-stream";
    headers["cache-control"] = "no-cache";

    return {
      method: request.method,
      uri: upstreamUrl,
      version: request.version || "1.1",
      headers,
      body: request.body,
    };
  }

  /**
   * Connect to upstream with retries
   */
  private async connectToUpstream(
    request: HTTPRequest,
    server: UpstreamServer,
  ): Promise<HTTPResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const client = new HTTP11Client({
          host: server.host,
          port: server.port,
          timeout: this.config.timeout,
        });

        await client.connect();
        const response = await client.sendRequest(request);

        // Check response status
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw new Error(`Upstream returned ${response.statusCode}`);
        }

        // Check content type
        const contentType = response.headers["content-type"];
        if (!contentType?.includes("text/event-stream")) {
          throw new Error(`Invalid content-type: ${contentType}`);
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(`[SSE Proxy] Connection attempt ${attempt + 1} failed:`, error);

        if (attempt < this.config.maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
          this.stats.reconnections++;
        }
      }
    }

    throw lastError || new Error("Failed to connect to upstream");
  }

  /**
   * Create streaming response
   */
  private createStreamingResponse(
    upstreamResponse: HTTPResponse,
    context: RequestContext,
  ): HTTPResponse {
    // In a real implementation, this would create a streaming response
    // For now, we return the upstream response directly
    // The gateway server would handle the actual streaming

    const headers = {
      ...upstreamResponse.headers,
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive",
      "x-accel-buffering": "no", // Disable buffering in nginx
    };

    return {
      version: upstreamResponse.version,
      statusCode: upstreamResponse.statusCode,
      statusText: upstreamResponse.statusText,
      headers,
      body: this.processEventStream(upstreamResponse.body || new Uint8Array(), context),
    };
  }

  /**
   * Process event stream
   */
  private processEventStream(body: Uint8Array, context: RequestContext): Uint8Array {
    // Parse SSE events
    const decoder = new TextDecoder();
    const text = decoder.decode(body);
    const events = this.parseSSEEvents(text);

    // Process each event
    const processedEvents: string[] = [];

    for (const event of events) {
      try {
        // Inspect event if enabled
        if (this.config.inspectEvents) {
          this.inspectEvent(event, context);
        }

        // Transform event if enabled
        let transformedEvent = event;
        if (this.config.transformEvents) {
          transformedEvent = this.transformEvent(event, "origin->client");
        }

        // Serialize event
        processedEvents.push(this.serializeSSEEvent(transformedEvent));
        this.stats.eventsForwarded++;
      } catch (error) {
        console.error("[SSE Proxy] Event processing error:", error);
        this.stats.eventErrors++;
      }
    }

    const result = processedEvents.join("");
    this.stats.bytesSent += result.length;

    return new TextEncoder().encode(result);
  }

  /**
   * Parse SSE events from text
   */
  private parseSSEEvents(text: string): SSEEvent[] {
    const events: SSEEvent[] = [];
    const lines = text.split("\n");

    let currentEvent: Partial<SSEEvent> = {};

    for (const line of lines) {
      if (line.trim() === "") {
        // Empty line indicates end of event
        if (currentEvent.data !== undefined) {
          events.push(currentEvent as SSEEvent);
          currentEvent = {};
        }
        continue;
      }

      if (line.startsWith(":")) {
        // Comment, ignore
        continue;
      }

      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) {
        continue;
      }

      const field = line.substring(0, colonIndex);
      let value = line.substring(colonIndex + 1);

      // Remove leading space
      if (value.startsWith(" ")) {
        value = value.substring(1);
      }

      switch (field) {
        case "id":
          currentEvent.id = value;
          break;
        case "event":
          currentEvent.event = value;
          break;
        case "data":
          currentEvent.data = (currentEvent.data || "") + value + "\n";
          break;
        case "retry":
          currentEvent.retry = parseInt(value, 10);
          break;
      }
    }

    return events;
  }

  /**
   * Serialize SSE event to text
   */
  private serializeSSEEvent(event: SSEEvent): string {
    let result = "";

    if (event.id) {
      result += `id: ${event.id}\n`;
    }

    if (event.event) {
      result += `event: ${event.event}\n`;
    }

    if (event.retry !== undefined) {
      result += `retry: ${event.retry}\n`;
    }

    // Split data into lines
    const dataLines = event.data.trimEnd().split("\n");
    for (const line of dataLines) {
      result += `data: ${line}\n`;
    }

    result += "\n";

    return result;
  }

  /**
   * Inspect event (for logging/debugging)
   */
  private inspectEvent(event: SSEEvent, context: RequestContext): void {
    const preview = event.data.substring(0, 100);
    console.log(
      `[SSE Proxy] Event [${context.clientIP}] id=${event.id} type=${
        event.event || "message"
      }: ${preview}`,
    );
  }

  /**
   * Transform event using configured transformation hook
   *
   * @param event - SSE event to transform
   * @param direction - Direction of event flow (typically 'origin->client')
   * @returns Transformed event, or original event if no hook configured or on error
   */
  private transformEvent(event: SSEEvent, direction: string): SSEEvent {
    // Return original event if transformation is disabled or no hook configured
    if (!this.config.transformEvents || !this.transformHook) {
      return event;
    }

    try {
      // Apply transformation hook
      const transformed = this.transformHook(event, direction);
      return transformed;
    } catch (error) {
      // On error, increment error counter and log, then return original event
      this.stats.eventErrors++;
      console.error(
        `[SSE Proxy] Event transformation error (${direction}):`,
        error,
      );
      return event;
    }
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
  getConfig(): Required<Omit<SSEProxyConfig, "transformHook">> & { transformHook?: (event: SSEEvent, direction: string) => SSEEvent } {
    return { ...this.config, transformHook: this.transformHook };
  }

  /**
   * Get transform hook
   */
  getTransformHook(): ((event: SSEEvent, direction: string) => SSEEvent) | undefined {
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
  getStats(): SSEProxyStats {
    return { ...this.stats };
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
