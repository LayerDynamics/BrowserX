/**
 * Server-Sent Events (SSE) Client
 *
 * Client for consuming server-sent event streams
 */

import { HTTPHeaders } from "../utils/headers.ts";

/**
 * SSE event
 */
export interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

/**
 * SSE event handler
 */
export type SSEEventHandler = (event: SSEEvent) => void;

/**
 * SSE client options
 */
export interface SSEClientOptions {
  headers?: HTTPHeaders;
  withCredentials?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  lastEventId?: string;
}

/**
 * SSE client state
 */
export enum SSEState {
  CONNECTING = "CONNECTING",
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  ERROR = "ERROR",
}

/**
 * Server-Sent Events client
 */
export class SSEClient {
  private url: string;
  private options: SSEClientOptions;
  private state: SSEState = SSEState.CLOSED;
  private eventHandlers = new Map<string, Set<SSEEventHandler>>();
  private stateHandlers = new Set<(state: SSEState) => void>();
  private errorHandlers = new Set<(error: Error) => void>();
  private conn?: Deno.Conn | Deno.TlsConn;
  private reconnectAttempts = 0;
  private reconnectTimer?: number;
  private lastEventId?: string;
  private retryDelay = 3000;
  private shouldReconnect = true;
  private buffer = "";

  constructor(url: string, options: SSEClientOptions = {}) {
    this.url = url;
    this.options = {
      reconnectDelay: 3000,
      maxReconnectAttempts: Infinity,
      ...options,
    };
    this.lastEventId = options.lastEventId;
  }

  /**
   * Connect to SSE endpoint
   */
  async connect(): Promise<void> {
    if (this.state === SSEState.OPEN || this.state === SSEState.CONNECTING) {
      return;
    }

    this.setState(SSEState.CONNECTING);

    try {
      const url = new URL(this.url);
      const secure = url.protocol === "https:";
      const port = url.port ? parseInt(url.port) : (secure ? 443 : 80);

      // Connect to server
      const conn = await Deno.connect({
        hostname: url.hostname,
        port,
      });

      // Upgrade to TLS if needed
      if (secure) {
        this.conn = await Deno.startTls(conn, {
          hostname: url.hostname,
        });
      } else {
        this.conn = conn;
      }

      // Send HTTP request
      await this.sendRequest(url);

      // Read response headers
      await this.readResponseHeaders();

      // Start reading events
      this.setState(SSEState.OPEN);
      this.reconnectAttempts = 0;
      this.readEvents().catch((error) => {
        this.handleError(error);
      });
    } catch (error) {
      this.setState(SSEState.ERROR);
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      this.attemptReconnect();
    }
  }

  /**
   * Send HTTP request
   */
  private async sendRequest(url: URL): Promise<void> {
    const encoder = new TextEncoder();
    const path = url.pathname + url.search;

    let request = `GET ${path} HTTP/1.1\r\n`;
    request += `Host: ${url.hostname}\r\n`;
    request += `Accept: text/event-stream\r\n`;
    request += `Cache-Control: no-cache\r\n`;

    // Add Last-Event-ID if present
    if (this.lastEventId) {
      request += `Last-Event-ID: ${this.lastEventId}\r\n`;
    }

    // Add custom headers
    if (this.options.headers) {
      for (const [key, value] of Object.entries(this.options.headers)) {
        if (key.toLowerCase() !== "host" && key.toLowerCase() !== "accept") {
          request += `${key}: ${value}\r\n`;
        }
      }
    }

    request += `\r\n`;

    await this.conn!.write(encoder.encode(request));
  }

  /**
   * Read response headers
   */
  private async readResponseHeaders(): Promise<void> {
    const decoder = new TextDecoder();
    const buffer = new Uint8Array(8192);
    let data = new Uint8Array(0);

    // Read until we have headers
    let headersEnd = -1;
    while (headersEnd === -1) {
      const n = await this.conn!.read(buffer);
      if (n === null) {
        throw new Error("Connection closed while reading headers");
      }

      const newData = new Uint8Array(data.length + n);
      newData.set(data);
      newData.set(buffer.subarray(0, n), data.length);
      data = newData;

      const text = decoder.decode(data);
      headersEnd = text.indexOf("\r\n\r\n");
    }

    // Parse status line
    const headersText = decoder.decode(data.subarray(0, headersEnd));
    const lines = headersText.split("\r\n");
    const statusLine = lines[0];
    const [, statusCode] = statusLine.split(" ");

    if (statusCode !== "200") {
      throw new Error(`SSE connection failed with status ${statusCode}`);
    }

    // Store any remaining data
    this.buffer = decoder.decode(data.subarray(headersEnd + 4));
  }

  /**
   * Read and parse events
   */
  private async readEvents(): Promise<void> {
    const decoder = new TextDecoder();
    const buffer = new Uint8Array(8192);

    while (this.state === SSEState.OPEN) {
      const n = await this.conn!.read(buffer);
      if (n === null) {
        // Connection closed
        this.close();
        this.attemptReconnect();
        return;
      }

      this.buffer += decoder.decode(buffer.subarray(0, n));
      this.processBuffer();
    }
  }

  /**
   * Process buffered data for events
   */
  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    // Keep last incomplete line in buffer
    this.buffer = lines.pop() || "";

    let currentEvent: Partial<SSEEvent> = {};

    for (let line of lines) {
      line = line.replace(/\r$/, ""); // Remove trailing \r

      // Empty line signals end of event
      if (line === "") {
        if (currentEvent.data !== undefined) {
          // Remove trailing newline from data
          currentEvent.data = currentEvent.data.replace(/\n$/, "");

          // Emit event
          this.emitEvent({
            id: currentEvent.id,
            event: currentEvent.event,
            data: currentEvent.data,
            retry: currentEvent.retry,
          });

          // Update last event ID
          if (currentEvent.id) {
            this.lastEventId = currentEvent.id;
          }

          // Update retry delay
          if (currentEvent.retry !== undefined) {
            this.retryDelay = currentEvent.retry;
          }
        }
        currentEvent = {};
        continue;
      }

      // Ignore comments
      if (line.startsWith(":")) {
        continue;
      }

      // Parse field
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) {
        continue;
      }

      const field = line.substring(0, colonIndex);
      let value = line.substring(colonIndex + 1);

      // Remove leading space from value
      if (value.startsWith(" ")) {
        value = value.substring(1);
      }

      // Process field
      switch (field) {
        case "event":
          currentEvent.event = value;
          break;
        case "data":
          if (currentEvent.data === undefined) {
            currentEvent.data = value;
          } else {
            currentEvent.data += "\n" + value;
          }
          break;
        case "id":
          currentEvent.id = value;
          break;
        case "retry":
          const retry = parseInt(value);
          if (!isNaN(retry)) {
            currentEvent.retry = retry;
          }
          break;
      }
    }
  }

  /**
   * Emit event to handlers
   */
  private emitEvent(event: SSEEvent): void {
    const eventType = event.event || "message";
    const handlers = this.eventHandlers.get(eventType);

    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error("Error in SSE event handler:", error);
        }
      }
    }
  }

  /**
   * Add event handler
   */
  on(eventType: string, handler: SSEEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);

    return () => {
      this.eventHandlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Add state change handler
   */
  onStateChange(handler: (state: SSEState) => void): () => void {
    this.stateHandlers.add(handler);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  /**
   * Add error handler
   */
  onError(handler: (error: Error) => void): () => void {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  /**
   * Set state and notify handlers
   */
  private setState(state: SSEState): void {
    this.state = state;
    for (const handler of this.stateHandlers) {
      try {
        handler(state);
      } catch (error) {
        console.error("Error in SSE state handler:", error);
      }
    }
  }

  /**
   * Handle error
   */
  private handleError(error: Error): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch (err) {
        console.error("Error in SSE error handler:", err);
      }
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (!this.shouldReconnect) return;

    if (this.options.maxReconnectAttempts !== undefined &&
      this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.retryDelay;

    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Close connection
   */
  close(): void {
    this.shouldReconnect = false;
    this.setState(SSEState.CLOSED);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.conn) {
      try {
        this.conn.close();
      } catch {
        // Ignore close errors
      }
      this.conn = undefined;
    }
  }

  /**
   * Get current state
   */
  getState(): SSEState {
    return this.state;
  }

  /**
   * Get last event ID
   */
  getLastEventId(): string | undefined {
    return this.lastEventId;
  }
}
