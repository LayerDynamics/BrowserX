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
import type { ByteBuffer, Port, RequestID, URLString } from "../types/identifiers.ts";
import { DNSResolver, type DNSResult } from "./network/resolution/DNSResolver.ts";
import { DNSCache } from "./network/resolution/DNSCache.ts";
import { ConnectionPool } from "./network/connection/ConnectionPool.ts";
import { ConnectionManager } from "./network/connection/ConnectionManager.ts";
import { type CacheMatchOptions, CacheStorage } from "./storage/CacheAPI.ts";
import { HTTPRequestParser } from "./network/protocols/HTTPRequestParser.ts";
import { HTTPResponseParser } from "./network/protocols/HTTPResponseParser.ts";

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
 * Request Pipeline
 * High-level orchestrator for HTTP requests
 */
export class RequestPipeline {
    private dnsResolver: DNSResolver;
    private dnsCache: DNSCache;
    private connectionPool: ConnectionPool;
    private connectionManager: ConnectionManager;
    private cacheStorage: CacheStorage;
    private requestIdCounter: number = 1;

    constructor(origin: string = "https://localhost") {
        this.dnsResolver = new DNSResolver();
        this.dnsCache = new DNSCache();
        this.connectionPool = new ConnectionPool();
        this.connectionManager = new ConnectionManager(this.connectionPool);
        this.cacheStorage = new CacheStorage(origin);
    }

    /**
     * Make HTTP request
     */
    async request(url: string | URL, options: RequestOptions = {}): Promise<RequestResult> {
        const startTime = Date.now();
        const timing: Partial<RequestTiming> = {};

        try {
            // Parse URL
            const parsedUrl = typeof url === "string" ? new URL(url) : url;
            const isSecure = parsedUrl.protocol === "https:";
            const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (isSecure ? 443 : 80);

            // Build HTTP request object
            const request: HTTPRequest = this.buildRequest(parsedUrl, options);

            // Check cache if enabled
            if (
                options.cache !== "no-cache" && options.cache !== "no-store" &&
                options.cache !== false
            ) {
                const cached = await this.checkCache(request, options);
                if (cached) {
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

            // 1. DNS Resolution
            const dnsStart = Date.now();
            const addresses = await this.resolveDNS(parsedUrl.hostname);
            timing.dnsLookup = Date.now() - dnsStart;

            if (addresses.length === 0) {
                throw new RequestPipelineError(
                    `DNS resolution failed for ${parsedUrl.hostname}`,
                    "dns",
                );
            }

            const targetIP = addresses[0]; // Use first resolved IP

            // 2. Connection Pool (acquire connection)
            const connStart = Date.now();
            const connection = await this.connectionPool.acquire(
                targetIP,
                port as Port,
                isSecure,
            );
            timing.tcpConnection = Date.now() - connStart;

            // 3. TLS Handshake timing (if secure and new connection)
            if (isSecure && connection.useCount === 1) {
                timing.tlsHandshake = timing.tcpConnection; // Approximate
            } else {
                timing.tlsHandshake = 0;
            }

            // 4. Send HTTP request
            const reqStart = Date.now();
            const requestData = this.serializeRequest(request);
            await connection.socket.write(requestData);
            timing.requestSent = Date.now() - reqStart;

            // 5. Receive HTTP response
            const respStart = Date.now();
            const responseBuffer = new Uint8Array(65536); // 64KB buffer
            const bytesRead = await connection.socket.read(responseBuffer);
            timing.firstByte = Date.now() - respStart;

            if (bytesRead === null || bytesRead === 0) {
                throw new Error("No response received from server");
            }

            const responseData = responseBuffer.slice(0, bytesRead);

            // Parse response
            const response = this.parseResponse(responseData, request.id);
            response.fromCache = false;
            timing.download = Date.now() - respStart - timing.firstByte;

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
                    const redirectUrl = response.headers.get("location")!;
                    const redirectOptions: RequestOptions = {
                        ...options,
                        maxRedirects: maxRedirects - 1,
                    };
                    return await this.request(redirectUrl, redirectOptions);
                }
            }

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
            console.warn("Failed to store in cache:", error);
        }
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
        const parser = new HTTPResponseParser();
        const text = new TextDecoder().decode(data);

        // Parse status line
        const lines = text.split("\r\n");
        const statusLine = lines[0];
        const [version, statusCode, ...statusTextParts] = statusLine.split(" ");

        // Parse headers
        const headers: HTTPHeaders = new Map();
        let i = 1;
        for (; i < lines.length; i++) {
            const line = lines[i];
            if (line === "") {
                break;
            }
            const colonIndex = line.indexOf(":");
            if (colonIndex !== -1) {
                const key = line.substring(0, colonIndex).trim().toLowerCase();
                const value = line.substring(colonIndex + 1).trim();
                headers.set(key, value);
            }
        }

        // Parse body
        const bodyStart = text.indexOf("\r\n\r\n") + 4;
        const body = data.slice(bodyStart);

        return {
            id: requestId,
            statusCode: parseInt(statusCode, 10),
            statusText: statusTextParts.join(" "),
            version: version.replace("HTTP/", "") as import("../types/http.ts").HTTPVersion,
            headers,
            body,
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
