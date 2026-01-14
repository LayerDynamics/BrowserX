/**
 * Upstream Client
 *
 * HTTP/HTTPS client for making requests to origin servers
 */

import { HTTPHeaders } from "../utils/headers.ts";
import { CircuitBreaker } from "./circuit_breaker.ts";
import { retry, RetryableErrors } from "../utils/retry.ts";
import { withTimeout } from "../utils/timeout.ts";

/**
 * HTTP request options
 */
export interface RequestOptions {
  method: string;
  url: string;
  headers?: HTTPHeaders;
  body?: Uint8Array | string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  circuitBreaker?: boolean;
}

/**
 * HTTP response
 */
export interface Response {
  statusCode: number;
  statusText: string;
  headers: HTTPHeaders;
  body: Uint8Array;
  duration: number;
}

/**
 * Upstream connection stats
 */
export interface UpstreamStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  activeConnections: number;
}

/**
 * Upstream client for making HTTP/HTTPS requests
 */
export class UpstreamClient {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private stats: UpstreamStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    activeConnections: 0,
  };

  /**
   * Make HTTP request
   */
  async request(options: RequestOptions): Promise<Response> {
    const startTime = Date.now();
    this.stats.totalRequests++;
    this.stats.activeConnections++;

    try {
      const url = new URL(options.url);
      const host = url.hostname;
      const port = url.port ? parseInt(url.port) : (url.protocol === "https:" ? 443 : 80);

      // Get or create circuit breaker for this host
      let breaker: CircuitBreaker | undefined;
      if (options.circuitBreaker !== false) {
        const key = `${host}:${port}`;
        if (!this.circuitBreakers.has(key)) {
          this.circuitBreakers.set(key, new CircuitBreaker(key, {
            failureThreshold: 5,
            resetTimeout: 30000,
            successThreshold: 2,
          }));
        }
        breaker = this.circuitBreakers.get(key);
      }

      // Make request with circuit breaker and retry
      const makeRequest = async () => {
        if (breaker) {
          return await breaker.execute(() => this.executeRequest(options, host, port));
        }
        return await this.executeRequest(options, host, port);
      };

      let response: Response;
      if (options.retries && options.retries > 0) {
        response = await retry(makeRequest, {
          maxAttempts: options.retries,
          initialDelay: options.retryDelay || 1000,
          isRetryable: (error: Error) =>
            RetryableErrors.isNetworkError(error) ||
            error.message.includes("timeout") ||
            error.message.includes("connection"),
        });
      } else {
        response = await makeRequest();
      }

      const duration = Date.now() - startTime;
      this.stats.successfulRequests++;
      this.updateAvgResponseTime(duration);

      return { ...response, duration };
    } catch (error) {
      this.stats.failedRequests++;
      throw error;
    } finally {
      this.stats.activeConnections--;
    }
  }

  /**
   * Execute the actual HTTP request
   */
  private async executeRequest(
    options: RequestOptions,
    host: string,
    port: number,
  ): Promise<Response> {
    const url = new URL(options.url);
    const secure = url.protocol === "https:";

    // Connect to server
    const conn = await Deno.connect({
      hostname: host,
      port,
    });

    try {
      // Upgrade to TLS if needed
      let stream: Deno.Conn | Deno.TlsConn = conn;
      if (secure) {
        stream = await Deno.startTls(conn, {
          hostname: host,
        });
      }

      // Build request
      const path = url.pathname + url.search;
      const method = options.method.toUpperCase();
      const headers = options.headers || {};

      // Add required headers
      if (!headers["host"]) {
        headers["host"] = host;
      }
      if (!headers["user-agent"]) {
        headers["user-agent"] = "BrowserX/1.0";
      }

      // Build request line and headers
      const encoder = new TextEncoder();
      let requestText = `${method} ${path} HTTP/1.1\r\n`;

      // Add body if present
      let body: Uint8Array | undefined;
      if (options.body) {
        if (typeof options.body === "string") {
          body = encoder.encode(options.body);
        } else {
          body = options.body;
        }
        headers["content-length"] = body.length.toString();
      }

      // Write headers
      for (const [key, value] of Object.entries(headers)) {
        requestText += `${key}: ${value}\r\n`;
      }
      requestText += "\r\n";

      // Send request
      await stream.write(encoder.encode(requestText));
      if (body) {
        await stream.write(body);
      }

      // Read response with timeout
      const timeout = options.timeout || 30000;
      const responsePromise = this.readResponse(stream);
      const response = await withTimeout(responsePromise, timeout);

      return response;
    } finally {
      try {
        conn.close();
      } catch {
        // Ignore close errors
      }
    }
  }

  /**
   * Read HTTP response from stream
   */
  private async readResponse(stream: Deno.Conn | Deno.TlsConn): Promise<Response> {
    const decoder = new TextDecoder();
    const buffer = new Uint8Array(8192);
    let data = new Uint8Array(0);

    // Read until we have headers
    let headersEnd = -1;
    while (headersEnd === -1) {
      const n = await stream.read(buffer);
      if (n === null) {
        throw new Error("Connection closed while reading headers");
      }

      // Append to data
      const newData = new Uint8Array(data.length + n);
      newData.set(data);
      newData.set(buffer.subarray(0, n), data.length);
      data = newData;

      // Look for end of headers
      const text = decoder.decode(data);
      headersEnd = text.indexOf("\r\n\r\n");
    }

    // Parse headers
    const headersText = decoder.decode(data.subarray(0, headersEnd));
    const lines = headersText.split("\r\n");
    const statusLine = lines[0];
    const [, statusCodeStr, ...statusTextParts] = statusLine.split(" ");
    const statusCode = parseInt(statusCodeStr);
    const statusText = statusTextParts.join(" ");

    const headers: HTTPHeaders = {};
    for (let i = 1; i < lines.length; i++) {
      const colonIndex = lines[i].indexOf(":");
      if (colonIndex > 0) {
        const key = lines[i].substring(0, colonIndex).trim().toLowerCase();
        const value = lines[i].substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    // Get body
    let body = data.subarray(headersEnd + 4);

    // Read remaining body based on content-length
    const contentLength = headers["content-length"];
    if (contentLength) {
      const expectedLength = parseInt(contentLength);
      while (body.length < expectedLength) {
        const n = await stream.read(buffer);
        if (n === null) break;

        const newBody = new Uint8Array(body.length + n);
        newBody.set(body);
        newBody.set(buffer.subarray(0, n), body.length);
        body = newBody;
      }
    }

    return {
      statusCode,
      statusText,
      headers,
      body,
      duration: 0, // Will be set by caller
    };
  }

  /**
   * Update average response time
   */
  private updateAvgResponseTime(duration: number): void {
    const total = this.stats.totalRequests;
    const current = this.stats.avgResponseTime;
    this.stats.avgResponseTime = ((current * (total - 1)) + duration) / total;
  }

  /**
   * Get client statistics
   */
  getStats(): UpstreamStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      activeConnections: 0,
    };
  }

  /**
   * Close all circuit breakers
   */
  close(): void {
    this.circuitBreakers.clear();
  }
}
