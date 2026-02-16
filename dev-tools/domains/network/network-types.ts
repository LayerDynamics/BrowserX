/**
 * Network Domain Types
 *
 * Types for HTTP request/response monitoring, timing, and interception.
 */

import type { RequestID, URLString } from "../../../browser/src/types/identifiers.ts";
import type { HTTPMethod, HTTPVersion } from "../../../browser/src/types/http.ts";

/**
 * Network request description for protocol transport
 */
export interface NetworkRequestDescription {
    requestId: RequestID;
    url: URLString;
    method: HTTPMethod;
    headers: Record<string, string>;
    postData?: string;
    hasPostData?: boolean;
    timestamp: number;
    initiator: RequestInitiatorDescription;
}

/**
 * Request initiator description
 */
export interface RequestInitiatorDescription {
    type: "parser" | "script" | "preload" | "preflight" | "other";
    url?: string;
    lineNumber?: number;
}

/**
 * Network response description
 */
export interface NetworkResponseDescription {
    requestId: RequestID;
    url: URLString;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
    connectionReused: boolean;
    connectionId: string;
    encodedDataLength: number;
    fromCache: boolean;
    fromServiceWorker: boolean;
    timing: NetworkResourceTiming;
    protocol: HTTPVersion;
    securityState: "secure" | "insecure" | "neutral" | "unknown";
}

/**
 * Network resource timing (protocol format)
 */
export interface NetworkResourceTiming {
    requestTime: number;
    dnsStart: number;
    dnsEnd: number;
    connectStart: number;
    connectEnd: number;
    sslStart: number;
    sslEnd: number;
    sendStart: number;
    sendEnd: number;
    receiveHeadersStart: number;
    receiveHeadersEnd: number;
}

/**
 * Resource type
 */
export type ResourceType =
    | "Document"
    | "Stylesheet"
    | "Script"
    | "Image"
    | "Font"
    | "XHR"
    | "Fetch"
    | "WebSocket"
    | "Other";

/**
 * Tracked request data (internal)
 */
export interface TrackedRequest {
    request: NetworkRequestDescription;
    response?: NetworkResponseDescription;
    body?: string;
    resourceType: ResourceType;
    startTime: number;
    endTime?: number;
}

export interface GetResponseBodyParams {
    requestId: RequestID;
}

export interface GetResponseBodyResult {
    body: string;
    base64Encoded: boolean;
}

export interface GetCookiesParams {
    urls?: string[];
}

export interface SetCookieParams {
    name: string;
    value: string;
    url?: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
    expires?: number;
}

export interface SetCookieResult {
    success: boolean;
}

export interface EmulateNetworkConditionsParams {
    offline: boolean;
    latency: number;
    downloadThroughput: number;
    uploadThroughput: number;
}

export interface GetRequestStatsResult {
    totalRequests: number;
    cachedRequests: number;
    totalBytes: number;
    activeConnections: number;
}
