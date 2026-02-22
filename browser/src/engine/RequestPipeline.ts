/**
 * Request Pipeline
 *
 * Orchestrates the complete request lifecycle from URL to response:
 * 1. DNS Resolution
 * 2. Connection Pool (reuse or create)
 * 3. TLS Handshake (if HTTPS)
 * 4. HTTP Request/Response
 * 5. Cache Storage
 */

import type { HTTPHeaders, HTTPMethod, HTTPRequest, HTTPResponse } from "../types/http.ts";
import { BrowserConsole } from "./logging/BrowserConsole.ts";
import type { ByteBuffer, Port, RequestID, URLString } from "../types/identifiers.ts";
import { DNSResolver, type DNSResult } from "./network/resolution/DNSResolver.ts";
import { DNSCache } from "./network/resolution/DNSCache.ts";
import { ConnectionPool } from "./network/connection/ConnectionPool.ts";
import { ConnectionManager } from "./network/connection/ConnectionManager.ts";
import { type CacheMatchOptions, CacheStorage } from "./storage/CacheAPI.ts";
import { HTTPRequestParser } from "./network/protocols/HTTPRequestParser.ts";
import { HTTPResponseParser } from "./network/protocols/HTTPResponseParser.ts";
import type { PipelineObserver, PipelineStageEvent } from "./PipelineObserver.ts";

/**
 * Request options
 */
export interface RequestOptions {
  method?: HTTPMethod;
  headers?: Record<string, string>;
  body?: ByteBuffer;
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  cache?: boolean | "force-cache" | "no-cache" | "no-store";
  signal?: AbortSignal;
}

/**
 * Request result
 */
export interface RequestResult {
  request: HTTPRequest;
  response: HTTPResponse;
  fromCache: boolean;
  timing: RequestTiming;
}

/**
 * Request timing information
 */
export interface RequestTiming {
  dnsLookup: number;
  tcpConnection: number;
  tlsHandshake: number;
  requestSent: number;
  firstByte: number;
  download: number;
  total: number;
}

/**
 * Request Pipeline Error
 */
export class RequestPipelineError extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public override readonly cause?: Error,
  ) {
    super(message);
    this.name = "RequestPipelineError";
  }
}

/**
 * Request Pipeline configuration
 */
export interface RequestPipelineConfig {
  origin?: string;
  dnsConfig?: {
    /** DNS-over-HTTPS endpoint (default: Cloudflare) */
    dohEndpoint?: string;
    /** Fallback DNS servers for UDP queries */
    nameservers?: string[];
    /** Use DoH as primary method (default: true) */
    preferDoH?: boolean;
  };
}

/**
 * Request Pipeline
 * High-level orchestrator for HTTP requests
 */
export class RequestPipeline {
  private pipelineLogger = new BrowserConsole("RequestPipeline");
  private dnsResolver: DNSResolver;
  private dnsCache: DNSCache;
  private connectionPool: ConnectionPool;
  private connectionManager: ConnectionManager;
  private cacheStorage: CacheStorage;
  private requestIdCounter: number = 1;
  private observer?: PipelineObserver;

  setObserver(observer: PipelineObserver): void {
    this.observer = observer;
  }

  private emitStage(
    stageId: string,
    stageName: string,
    status: PipelineStageEvent["status"],
    startTime: number,
    endTime?: number,
    duration?: number,
    artifact?: unknown,
    error?: Error,
  ): void {
    this.observer?.onStage({
      stageId,
      stageName,
      pipeline: "request",
      status,
      startTime,
      endTime,
      duration,
      artifact,
      error,
    });
  }

  constructor(config: RequestPipelineConfig = {}) {
    const origin = config.origin || "https://localhost";
    const dnsConfig = config.dnsConfig || {};

    // Configure DNS resolver with DoH as primary method
    // DNS-over-HTTPS provides encrypted DNS queries over HTTPS
    // This avoids the need for --unstable-net flag required by UDP
    this.dnsResolver = new DNSResolver({
      // Use Cloudflare DoH by default (fast, privacy-focused)
      dohEndpoint: dnsConfig.dohEndpoint || "https://cloudflare-dns.com/dns-query",
      // Fallback nameservers for UDP (requires --unstable-net flag)
      nameservers: dnsConfig.nameservers || ["8.8.8.8", "8.8.4.4"],
    });

    this.dnsCache = new DNSCache();
    this.connectionPool = new ConnectionPool();
    this.connectionManager = new ConnectionManager(this.connectionPool);
    this.cacheStorage = new CacheStorage(origin);
  }

  /**
   * Make HTTP request
   */
  async request(url: string | URL, options: RequestOptions = {}): Promise<RequestResult> {
    // Check if already aborted
    if (options.signal?.aborted) {
      throw options.signal.reason || new RequestPipelineError("Request aborted", "aborted");
    }

    const startTime = Date.now();
    const timeout = options.timeout ?? 30000; // Default 30 second timeout

    // Wrap the request in a timeout
    const requestPromise = this.doRequest(url, options, startTime);

    const racers: Promise<RequestResult | never>[] = [requestPromise];

    if (timeout > 0) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new RequestPipelineError(
              `Request timed out after ${timeout}ms`,
              "timeout",
            ),
          );
        }, timeout);
      });
      racers.push(timeoutPromise);
    }

    // Add abort signal to the race if provided
    if (options.signal) {
      const abortPromise = new Promise<never>((_, reject) => {
        options.signal!.addEventListener("abort", () => {
          reject(options.signal!.reason || new RequestPipelineError("Request aborted", "aborted"));
        }, { once: true });
      });
      racers.push(abortPromise);
    }

    return Promise.race(racers);
  }

  /**
   * Internal request implementation
   */
  private async doRequest(
    url: string | URL,
    options: RequestOptions,
    startTime: number,
  ): Promise<RequestResult> {
    const timing: Partial<RequestTiming> = {};

    try {
      // Check if aborted
      if (options.signal?.aborted) {
        throw options.signal.reason || new RequestPipelineError("Request aborted", "aborted");
      }

      // Parse URL
      const parsedUrl = typeof url === "string" ? new URL(url) : url;
      const isSecure = parsedUrl.protocol === "https:";
      const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (isSecure ? 443 : 80);

      // Build HTTP request object
      const request: HTTPRequest = this.buildRequest(parsedUrl, options);

      // Check cache if enabled
      this.emitStage("cache-check", "Cache Check", "running", Date.now());
      if (
        options.cache !== "no-cache" && options.cache !== "no-store" &&
        options.cache !== false
      ) {
        const cached = await this.checkCache(request, options);
        if (cached) {
          this.emitStage(
            "cache-check",
            "Cache Check",
            "completed",
            Date.now(),
            Date.now(),
            0,
            cached,
          );
          return {
            request,
            response: cached,
            fromCache: true,
            timing: {
              dnsLookup: 0,
              tcpConnection: 0,
              tlsHandshake: 0,
              requestSent: 0,
              firstByte: 0,
              download: 0,
              total: Date.now() - startTime,
            },
          };
        }
      }
      this.emitStage("cache-check", "Cache Check", "completed", Date.now(), Date.now(), 0, null);

      // Check if aborted before DNS resolution
      if (options.signal?.aborted) {
        throw options.signal.reason || new RequestPipelineError("Request aborted", "aborted");
      }

      // 1. DNS Resolution
      this.emitStage("dns-resolution", "DNS Resolution", "running", Date.now());
      const dnsStart = Date.now();
      const addresses = await this.resolveDNS(parsedUrl.hostname);
      timing.dnsLookup = Date.now() - dnsStart;
      this.emitStage(
        "dns-resolution",
        "DNS Resolution",
        "completed",
        dnsStart,
        Date.now(),
        timing.dnsLookup,
        addresses,
      );

      if (addresses.length === 0) {
        throw new RequestPipelineError(
          `DNS resolution failed for ${parsedUrl.hostname}`,
          "dns",
        );
      }

      const targetIP = addresses[0]; // Use first resolved IP

      // Check if aborted before connection acquire
      if (options.signal?.aborted) {
        throw options.signal.reason || new RequestPipelineError("Request aborted", "aborted");
      }

      // 2. Connection Pool (acquire connection)
      // Pass hostname for TLS SNI - must be hostname, not IP address
      this.emitStage("tcp-connection", "TCP Connection", "running", Date.now());
      const connStart = Date.now();
      const connection = await this.connectionPool.acquire(
        targetIP,
        port as Port,
        isSecure,
        parsedUrl.hostname, // Pass hostname for TLS SNI
      );
      timing.tcpConnection = Date.now() - connStart;
      this.emitStage(
        "tcp-connection",
        "TCP Connection",
        "completed",
        connStart,
        Date.now(),
        timing.tcpConnection,
        connection,
      );

      // 3. TLS Handshake timing (if secure and new connection)
      if (isSecure && connection.useCount === 1) {
        timing.tlsHandshake = timing.tcpConnection; // Approximate
      } else {
        timing.tlsHandshake = 0;
      }
      this.emitStage(
        "tls-handshake",
        "TLS Handshake",
        "completed",
        Date.now(),
        Date.now(),
        timing.tlsHandshake ?? 0,
      );

      // 4. Send HTTP request
      this.emitStage("http-send", "HTTP Send", "running", Date.now());
      const reqStart = Date.now();
      const requestData = this.serializeRequest(request);
      await connection.socket.write(requestData);
      timing.requestSent = Date.now() - reqStart;
      this.emitStage(
        "http-send",
        "HTTP Send",
        "completed",
        reqStart,
        Date.now(),
        timing.requestSent,
        request,
      );

      // 5. Receive HTTP response
      this.emitStage("http-receive", "HTTP Receive", "running", Date.now());
      const respStart = Date.now();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let headersComplete = false;
      let isChunked = false;
      let contentLength = -1;
      let bodyStartIndex = 0;

      // Read until response is complete
      while (true) {
        // Check if aborted in read loop
        if (options.signal?.aborted) {
          // Close the connection on abort
          await connection.socket.close();
          throw options.signal.reason || new RequestPipelineError("Request aborted", "aborted");
        }

        const chunk = new Uint8Array(16384); // 16KB chunks
        const bytesRead = await connection.socket.read(chunk, { signal: options.signal });

        if (totalBytes === 0) {
          timing.firstByte = Date.now() - respStart;
        }

        if (bytesRead === null || bytesRead === 0) {
          break; // Connection closed
        }

        chunks.push(chunk.slice(0, bytesRead));
        totalBytes += bytesRead;

        // Check if headers are complete
        if (!headersComplete) {
          const partialResponse = this.concatChunks(chunks, totalBytes);
          const text = new TextDecoder().decode(partialResponse);
          const headerEndIndex = text.indexOf("\r\n\r\n");

          if (headerEndIndex !== -1) {
            headersComplete = true;
            bodyStartIndex = headerEndIndex + 4;

            // Check for chunked encoding or content-length
            const lowerText = text.toLowerCase();
            if (lowerText.includes("transfer-encoding: chunked")) {
              isChunked = true;
            }

            // Check for multiple Content-Length headers (potential HTTP desync attack)
            const clMatches = lowerText.match(/content-length:\s*\d+/g);
            if (clMatches && clMatches.length > 1) {
              throw new Error(
                "Multiple Content-Length headers detected - potential HTTP desync attack",
              );
            }

            const clMatch = lowerText.match(/content-length:\s*(\d+)/);
            if (clMatch) {
              const parsedLength = parseInt(clMatch[1], 10);
              // Validate Content-Length is a valid non-negative integer
              if (Number.isNaN(parsedLength) || parsedLength < 0) {
                throw new Error(`Invalid Content-Length value: ${clMatch[1]}`);
              }
              // Validate Content-Length doesn't exceed max response size (10MB)
              const maxResponseSize = 10 * 1024 * 1024;
              if (parsedLength > maxResponseSize) {
                throw new Error(
                  `Content-Length ${parsedLength} exceeds maximum allowed size of ${maxResponseSize} bytes`,
                );
              }
              contentLength = parsedLength;
            }
          }
        }

        // Check if response is complete
        if (headersComplete) {
          const partialResponse = this.concatChunks(chunks, totalBytes);

          if (isChunked) {
            // Check for chunked terminator: 0\r\n followed by optional trailers and final \r\n
            // RFC 7230 Section 4.1: chunked-body = *chunk last-chunk trailer-part CRLF
            // last-chunk = "0" *( ";" chunk-ext ) CRLF
            // trailer-part = *( header-field CRLF )
            const text = new TextDecoder().decode(partialResponse.slice(bodyStartIndex));
            // Find the zero-length chunk (can be "0\r\n" or "0;ext\r\n")
            const zeroChunkMatch = text.match(/\r\n0(?:;[^\r\n]*)?\r\n/);
            if (zeroChunkMatch) {
              // Zero-length chunk found - check if the message ends with \r\n\r\n
              // (either no trailers: "0\r\n\r\n" or trailers followed by "\r\n\r\n")
              if (text.endsWith("\r\n\r\n")) {
                break; // Chunked response complete
              }
            }
          } else if (contentLength >= 0) {
            const bodyBytes = totalBytes - bodyStartIndex;
            if (bodyBytes >= contentLength) {
              break; // Content-Length reached
            }
          } else {
            // No content-length or chunked - read a bit more then stop
            // This handles responses with no body
            if (totalBytes > bodyStartIndex) {
              break;
            }
          }
        }

        // Safety limit - should match Content-Length validation (10MB)
        if (totalBytes > 10 * 1024 * 1024) { // 10MB max
          break;
        }
      }

      if (totalBytes === 0) {
        throw new Error("No response received from server");
      }

      const responseData = this.concatChunks(chunks, totalBytes);

      // Parse response
      const response = this.parseResponse(responseData as ByteBuffer, request.id);
      response.fromCache = false;
      timing.download = Date.now() - respStart - (timing.firstByte || 0);

      // Release connection back to pool
      await this.connectionPool.release(connection);

      // 6. Store in cache (if cacheable)
      if (
        this.isCacheable(request, response) && options.cache !== "no-store" &&
        options.cache !== false
      ) {
        await this.storeInCache(request, response);
      }

      // Handle redirects
      if (
        options.followRedirects !== false &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.has("location")
      ) {
        const maxRedirects = options.maxRedirects ?? 5;
        if (maxRedirects > 0) {
          const locationHeader = response.headers.get("location")!;
          // Resolve relative URLs against the original request URL
          // This handles both absolute URLs (https://...) and relative URLs (/path, ./path, ../path)
          const redirectUrl = new URL(locationHeader, request.url).toString();

          // Create redirect options, removing host header so it will be set correctly for new URL
          // The host header must match the target hostname, not the original hostname
          const redirectHeaders = options.headers ? { ...options.headers } : undefined;
          if (redirectHeaders) {
            // Remove host header (case-insensitive) so buildRequest can set it correctly
            for (const key of Object.keys(redirectHeaders)) {
              if (key.toLowerCase() === "host") {
                delete redirectHeaders[key];
              }
            }
          }

          const redirectOptions: RequestOptions = {
            ...options,
            headers: redirectHeaders,
            maxRedirects: maxRedirects - 1,
          };
          return await this.request(redirectUrl, redirectOptions);
        }
      }

      this.emitStage(
        "http-receive",
        "HTTP Receive",
        "completed",
        respStart,
        Date.now(),
        Date.now() - respStart,
        response,
      );

      timing.total = Date.now() - startTime;

      return {
        request,
        response,
        fromCache: false,
        timing: timing as RequestTiming,
      };
    } catch (error) {
      if (error instanceof RequestPipelineError) {
        throw error;
      }
      throw new RequestPipelineError(
        `Request failed: ${error instanceof Error ? error.message : String(error)}`,
        "unknown",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Make GET request
   */
  async get(
    url: string | URL,
    options: Omit<RequestOptions, "method"> = {},
  ): Promise<RequestResult> {
    return this.request(url, { ...options, method: "GET" });
  }

  /**
   * Make POST request
   */
  async post(
    url: string | URL,
    body: ByteBuffer,
    options: Omit<RequestOptions, "method" | "body"> = {},
  ): Promise<RequestResult> {
    return this.request(url, { ...options, method: "POST", body });
  }

  /**
   * Make PUT request
   */
  async put(
    url: string | URL,
    body: ByteBuffer,
    options: Omit<RequestOptions, "method" | "body"> = {},
  ): Promise<RequestResult> {
    return this.request(url, { ...options, method: "PUT", body });
  }

  /**
   * Make DELETE request
   */
  async delete(
    url: string | URL,
    options: Omit<RequestOptions, "method"> = {},
  ): Promise<RequestResult> {
    return this.request(url, { ...options, method: "DELETE" });
  }

  /**
   * Resolve DNS with caching
   */
  private async resolveDNS(hostname: string): Promise<string[]> {
    // Check cache first
    const cached = this.dnsCache.get(hostname);
    if (cached && cached.addresses.length > 0) {
      return cached.addresses;
    }

    // Resolve via DNS
    try {
      const result = await this.dnsResolver.resolve(hostname);

      // Store in cache
      this.dnsCache.set(result);

      return result.addresses;
    } catch (error) {
      throw new RequestPipelineError(
        `DNS resolution failed for ${hostname}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        "dns",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Check cache for request
   */
  private async checkCache(
    request: HTTPRequest,
    options: RequestOptions,
  ): Promise<HTTPResponse | undefined> {
    if (options.cache === "force-cache") {
      // Always use cache if available
      return await this.cacheStorage.match(request);
    }

    if (options.cache === "no-cache") {
      // Skip cache
      return undefined;
    }

    // Default: use cache if not expired
    return await this.cacheStorage.match(request);
  }

  /**
   * Store response in cache
   */
  private async storeInCache(request: HTTPRequest, response: HTTPResponse): Promise<void> {
    try {
      const cache = await this.cacheStorage.open("http-cache");
      await cache.put(request, response);
    } catch (error) {
      // Log but don't fail request if caching fails
      this.pipelineLogger.warn("Failed to store in cache:", error);
    }
  }
  /**
   * Concatenate byte array chunks into a single buffer
   */
  private concatChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
    const result = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  }

  /**
   * Check if response is cacheable
   */
  private isCacheable(request: HTTPRequest, response: HTTPResponse): boolean {
    // Only cache GET requests
    if (request.method !== "GET") {
      return false;
    }

    // Check status code (200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501)
    const cacheableStatuses = [200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501];
    if (!cacheableStatuses.includes(response.statusCode)) {
      return false;
    }

    // Check Cache-Control header
    const cacheControl = response.headers.get("cache-control");
    if (cacheControl) {
      if (cacheControl.includes("no-store") || cacheControl.includes("private")) {
        return false;
      }
    }

    return true;
  }

  /**
   * Build HTTP request object
   */
  private buildRequest(url: URL, options: RequestOptions): HTTPRequest {
    const headers: HTTPHeaders = new Map();

    // Add default headers
    headers.set("host", url.host);
    headers.set("user-agent", "GeoProx-Browser/1.0");
    headers.set("accept", "*/*");
    headers.set("connection", "keep-alive");

    // Add custom headers
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers.set(key.toLowerCase(), value);
      }
    }

    // Add content-length for body
    if (options.body) {
      headers.set("content-length", String(options.body.byteLength));
    }

    return {
      id: `req-${this.requestIdCounter++}` as RequestID,
      method: options.method || "GET",
      url: url.toString() as URLString,
      version: "1.1",
      headers,
      body: options.body,
      createdAt: Date.now(),
    };
  }

  /**
   * Serialize HTTP request to bytes
   */
  private serializeRequest(request: HTTPRequest): ByteBuffer {
    const lines: string[] = [];

    // Request line
    const url = new URL(request.url);
    const path = url.pathname + url.search;
    lines.push(`${request.method} ${path} HTTP/${request.version}`);

    // Headers
    for (const [key, value] of request.headers.entries()) {
      lines.push(`${key}: ${value}`);
    }

    // Empty line
    lines.push("");

    // Combine into buffer
    const headerData = new TextEncoder().encode(lines.join("\r\n") + "\r\n");

    // Add body if present
    if (request.body) {
      const combined = new Uint8Array(headerData.byteLength + request.body.byteLength);
      combined.set(headerData, 0);
      combined.set(new Uint8Array(request.body), headerData.byteLength);
      return combined;
    }

    return headerData;
  }

  /**
   * Parse HTTP response from bytes
   */
  private parseResponse(data: ByteBuffer, requestId: RequestID): HTTPResponse {
    // Use the proper HTTPResponseParser which handles NaN validation,
    // chunked encoding, and correct binary body extraction
    const parsed = HTTPResponseParser.parseResponse(data);

    return {
      id: requestId,
      statusCode: parsed.statusCode,
      statusText: parsed.statusText,
      version: parsed.version.replace("HTTP/", "") as import("../types/http.ts").HTTPVersion,
      headers: parsed.headers,
      body: parsed.body,
      receivedAt: Date.now(),
      fromCache: false,
      timings: {
        dnsStart: 0,
        dnsEnd: 0,
        connectStart: 0,
        connectEnd: 0,
        requestStart: 0,
        responseStart: 0,
        responseEnd: 0,
        duration: 0,
      },
    };
  }

  /**
   * Clear DNS cache
   */
  clearDNSCache(): void {
    this.dnsCache.clear();
  }

  // ========================================================================
  // Subsystem Access - Composable Toolkit API
  // ========================================================================

  /**
   * Get DNS resolver
   *
   * Provides access to DNS resolution with caching.
   *
   * @returns {DNSResolver} The DNS resolver instance
   * @example
   * ```typescript
   * const pipeline = new RequestPipeline();
   * const resolver = pipeline.getDNSResolver();
   * const addresses = await resolver.resolve("example.com");
   * ```
   */
  getDNSResolver(): DNSResolver {
    return this.dnsResolver;
  }

  /**
   * Get DNS cache
   *
   * Provides access to DNS cache for inspection and management.
   *
   * @returns {DNSCache} The DNS cache instance
   * @example
   * ```typescript
   * const pipeline = new RequestPipeline();
   * const cache = pipeline.getDNSCache();
   * const stats = cache.getStats();
   * ```
   */
  getDNSCache(): DNSCache {
    return this.dnsCache;
  }

  /**
   * Get connection pool
   *
   * Provides access to the connection pool for reusable HTTP connections.
   *
   * @returns {ConnectionPool} The connection pool instance
   * @example
   * ```typescript
   * const pipeline = new RequestPipeline();
   * const pool = pipeline.getConnectionPool();
   * const stats = pool.getStats();
   * ```
   */
  getConnectionPool(): ConnectionPool {
    return this.connectionPool;
  }

  /**
   * Get connection manager
   *
   * Provides access to connection lifecycle management.
   *
   * @returns {ConnectionManager} The connection manager instance
   * @example
   * ```typescript
   * const pipeline = new RequestPipeline();
   * const manager = pipeline.getConnectionManager();
   * await manager.closeAll();
   * ```
   */
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  /**
   * Get cache storage
   *
   * Provides access to HTTP cache for inspection and management.
   *
   * @returns {CacheStorage} The cache storage instance
   * @example
   * ```typescript
   * const pipeline = new RequestPipeline();
   * const cache = pipeline.getCacheStorage();
   * const allCaches = await cache.keys();
   * ```
   */
  getCacheStorage(): CacheStorage {
    return this.cacheStorage;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.connectionManager.closeAll();
  }

  /**
   * Get pipeline statistics
   */
  getStats() {
    return {
      dnsCache: this.dnsCache.getStats(),
      connectionPool: this.connectionPool.getStats(),
    };
  }
}
