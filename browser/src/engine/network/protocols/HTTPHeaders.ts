/**
 * HTTP Header Parser and Utilities
 *
 * Provides parsing and serialization for HTTP headers according to RFC 7230.
 */

import type { ByteBuffer } from "../../../types/identifiers.ts";

/**
 * HTTP headers represented as a map of header names to values
 */
export type HTTPHeaders = Map<string, string>;

/**
 * HTTP header parser and serializer
 */
export class HTTPHeaderParser {
    /**
     * Parse raw HTTP headers
     */
    static parseHeaders(headerBytes: ByteBuffer): HTTPHeaders {
        const headers = new Map<string, string>();
        const headerText = new TextDecoder().decode(headerBytes);
        const lines = headerText.split("\r\n");

        for (const line of lines) {
            if (line.length === 0) {
                // End of headers
                break;
            }

            const colonIndex = line.indexOf(":");
            if (colonIndex === -1) {
                // Invalid header line, skip
                continue;
            }

            const name = line.substring(0, colonIndex).trim().toLowerCase();
            const value = line.substring(colonIndex + 1).trim();

            // Handle multiple headers with same name (e.g., Set-Cookie)
            if (headers.has(name)) {
                // Append to existing value with comma separator
                headers.set(name, `${headers.get(name)}, ${value}`);
            } else {
                headers.set(name, value);
            }
        }

        return headers;
    }

    /**
     * Serialize headers to wire format
     */
    static serializeHeaders(headers: HTTPHeaders): ByteBuffer {
        const lines: string[] = [];

        for (const [name, value] of headers.entries()) {
            lines.push(`${name}: ${value}`);
        }

        const headerText = lines.join("\r\n") + "\r\n\r\n";
        return new TextEncoder().encode(headerText);
    }

    /**
     * Parse specific header value
     */
    static parseHeaderValue(value: string, type: "list" | "dict" | "int" | "date"): unknown {
        switch (type) {
            case "list":
                // Parse comma-separated list (e.g., Accept-Encoding: gzip, deflate, br)
                return value.split(",").map((v) => v.trim());

            case "dict":
                // Parse key=value pairs (e.g., Cache-Control: max-age=3600, public)
                const dict: Record<string, string> = {};
                for (const part of value.split(",")) {
                    const [key, val] = part.trim().split("=");
                    dict[key] = val || "true";
                }
                return dict;

            case "int":
                // Parse integer (e.g., Content-Length: 1234)
                return parseInt(value, 10);

            case "date":
                // Parse HTTP date (e.g., Last-Modified: Wed, 21 Oct 2015 07:28:00 GMT)
                return new Date(value);

            default:
                return value;
        }
    }

    /**
     * Get header value (case-insensitive)
     */
    static getHeader(headers: HTTPHeaders, name: string): string | undefined {
        return headers.get(name.toLowerCase());
    }

    /**
     * Set header value (case-insensitive)
     */
    static setHeader(headers: HTTPHeaders, name: string, value: string): void {
        headers.set(name.toLowerCase(), value);
    }

    /**
     * Check if header exists (case-insensitive)
     */
    static hasHeader(headers: HTTPHeaders, name: string): boolean {
        return headers.has(name.toLowerCase());
    }

    /**
     * Delete header (case-insensitive)
     */
    static deleteHeader(headers: HTTPHeaders, name: string): boolean {
        return headers.delete(name.toLowerCase());
    }

    /**
     * Create empty headers map
     */
    static createHeaders(): HTTPHeaders {
        return new Map<string, string>();
    }

    /**
     * Clone headers map
     */
    static cloneHeaders(headers: HTTPHeaders): HTTPHeaders {
        return new Map(headers);
    }
}
