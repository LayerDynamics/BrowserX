/**
 * HTTP Request Parser
 *
 * Implements HTTP/1.1 request parsing and serialization according to RFC 7230.
 */

import type { ByteBuffer } from "../../../types/identifiers.ts";
import { HTTPHeaderParser, type HTTPHeaders } from "./HTTPHeaders.ts";

/**
 * HTTP method
 */
export enum HTTPMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE",
    HEAD = "HEAD",
    OPTIONS = "OPTIONS",
    PATCH = "PATCH",
    CONNECT = "CONNECT",
    TRACE = "TRACE",
}

/**
 * HTTP request structure
 */
export interface HTTPRequest {
    method: HTTPMethod | string;
    path: string;
    version: string; // e.g., "HTTP/1.1"
    headers: HTTPHeaders;
    body: ByteBuffer;
}

/**
 * HTTP request parser and serializer
 */
export class HTTPRequestParser {
    /**
     * Parse HTTP request from wire format
     *
     * @param data - Raw HTTP request bytes
     * @returns Parsed HTTP request
     */
    static parseRequest(data: ByteBuffer): HTTPRequest {
        const text = new TextDecoder().decode(data);

        // Find end of headers (double CRLF)
        const headerEndIndex = text.indexOf("\r\n\r\n");
        if (headerEndIndex === -1) {
            throw new Error("Invalid HTTP request: no header end marker");
        }

        // Split into lines
        const lines = text.substring(0, headerEndIndex).split("\r\n");

        if (lines.length === 0) {
            throw new Error("Invalid HTTP request: empty");
        }

        // Parse request line (e.g., "GET /path HTTP/1.1")
        const requestLine = lines[0];
        const requestParts = requestLine.split(" ");

        if (requestParts.length !== 3) {
            throw new Error(`Invalid HTTP request line: ${requestLine}`);
        }

        const method = requestParts[0];
        const path = requestParts[1];
        const version = requestParts[2];

        // Parse headers
        const headerLines = lines.slice(1).join("\r\n") + "\r\n";
        const headerBytes = new TextEncoder().encode(headerLines);
        const headers = HTTPHeaderParser.parseHeaders(headerBytes);

        // Extract body
        const bodyStartIndex = headerEndIndex + 4; // Skip \r\n\r\n
        const body = data.slice(bodyStartIndex);

        return {
            method,
            path,
            version,
            headers,
            body,
        };
    }

    /**
     * Serialize HTTP request to wire format
     *
     * @param request - HTTP request to serialize
     * @returns Serialized request bytes
     */
    static serializeRequest(request: HTTPRequest): ByteBuffer {
        // Build request line
        const requestLine = `${request.method} ${request.path} ${request.version}\r\n`;

        // Serialize headers
        const headers = HTTPHeaderParser.serializeHeaders(request.headers);

        // Combine request line + headers + body
        const requestLineBytes = new TextEncoder().encode(requestLine);
        const totalLength = requestLineBytes.byteLength + headers.byteLength +
            request.body.byteLength;

        const result = new Uint8Array(totalLength);
        let offset = 0;

        result.set(requestLineBytes, offset);
        offset += requestLineBytes.byteLength;

        result.set(headers, offset);
        offset += headers.byteLength;

        result.set(request.body, offset);

        return result;
    }

    /**
     * Create HTTP request
     *
     * @param method - HTTP method
     * @param path - Request path
     * @param headers - Request headers
     * @param body - Request body
     * @returns HTTP request object
     */
    static createRequest(
        method: HTTPMethod | string,
        path: string,
        headers?: HTTPHeaders,
        body?: ByteBuffer,
    ): HTTPRequest {
        return {
            method,
            path,
            version: "HTTP/1.1",
            headers: headers || HTTPHeaderParser.createHeaders(),
            body: body || new Uint8Array(0),
        };
    }

    /**
     * Parse query string from path
     *
     * @param path - Request path (may include query string)
     * @returns Object with pathname and query parameters
     */
    static parseQueryString(path: string): {
        pathname: string;
        query: Map<string, string>;
    } {
        const questionMarkIndex = path.indexOf("?");

        if (questionMarkIndex === -1) {
            return {
                pathname: path,
                query: new Map(),
            };
        }

        const pathname = path.substring(0, questionMarkIndex);
        const queryString = path.substring(questionMarkIndex + 1);

        const query = new Map<string, string>();

        for (const param of queryString.split("&")) {
            const [key, value] = param.split("=");
            if (key) {
                query.set(
                    decodeURIComponent(key),
                    value ? decodeURIComponent(value) : "",
                );
            }
        }

        return { pathname, query };
    }

    /**
     * Build query string from parameters
     *
     * @param params - Query parameters
     * @returns Query string (without leading ?)
     */
    static buildQueryString(params: Map<string, string> | Record<string, string>): string {
        const parts: string[] = [];

        const entries = params instanceof Map
            ? Array.from(params.entries())
            : Object.entries(params);

        for (const [key, value] of entries) {
            parts.push(
                `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
            );
        }

        return parts.join("&");
    }
}
