// ============================================================================
// HTTP TYPES
// ============================================================================

import type {
    ByteBuffer,
    Duration,
    RequestID,
    SpanID,
    Timestamp,
    TraceID,
    URLString,
} from "./identifiers.ts";

/**
 * HTTP method
 */
export type HTTPMethod =
    | "GET"
    | "POST"
    | "PUT"
    | "DELETE"
    | "PATCH"
    | "HEAD"
    | "OPTIONS"
    | "CONNECT"
    | "TRACE";

/**
 * HTTP version
 */
export type HTTPVersion = "1.0" | "1.1" | "2.0" | "3.0";

/**
 * HTTP status code
 */
export type HTTPStatusCode = number;

/**
 * HTTP headers (lowercase keys)
 */
export type HTTPHeaders = Map<string, string>;

/**
 * HTTP request
 */
export interface HTTPRequest {
    readonly id: RequestID;
    method: HTTPMethod;
    url: URLString;
    version: HTTPVersion;
    headers: HTTPHeaders;
    body?: ByteBuffer;

    // Metadata
    createdAt: Timestamp;
    initiator?: RequestInitiator;

    // Tracing
    traceId?: TraceID;
    spanId?: SpanID;
}

/**
 * HTTP response
 */
export interface HTTPResponse {
    readonly id: RequestID;
    statusCode: HTTPStatusCode;
    statusText: string;
    version: HTTPVersion;
    headers: HTTPHeaders;
    body: ByteBuffer;

    // Metadata
    receivedAt: Timestamp;
    fromCache: boolean;

    // Performance
    timings: ResourceTiming;
}

/**
 * Request initiator (what triggered the request)
 */
export enum RequestInitiator {
    NAVIGATION = "navigation", // User navigation
    PARSER = "parser", // HTML parser discovered resource
    SCRIPT = "script", // JavaScript fetch/XHR
    PRELOAD = "preload", // Link rel=preload
    PREFETCH = "prefetch", // Link rel=prefetch
}

/**
 * Resource timing information
 */
export interface ResourceTiming {
    // DNS
    dnsStart: Timestamp;
    dnsEnd: Timestamp;

    // TCP
    connectStart: Timestamp;
    connectEnd: Timestamp;

    // TLS
    secureConnectionStart?: Timestamp;

    // HTTP
    requestStart: Timestamp;
    responseStart: Timestamp;
    responseEnd: Timestamp;

    // Total
    duration: Duration;
}
