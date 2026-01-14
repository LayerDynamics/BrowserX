/**
 * HTTP Protocol Parser
 *
 * Parses HTTP requests and responses
 */

import type { HTTPRequest, HTTPResponse, HTTPMethod, HTTPVersion } from "../transport/http/http.ts";

/**
 * HTTP parser configuration
 */
export interface HTTPParserConfig {
  /**
   * Maximum header size (bytes)
   */
  maxHeaderSize?: number;

  /**
   * Maximum body size (bytes)
   */
  maxBodySize?: number;

  /**
   * Strict parsing mode
   */
  strictMode?: boolean;
}

/**
 * HTTP Request Parser
 *
 * Parses raw HTTP request bytes into structured HTTPRequest
 */
export class HTTPRequestParser {
  private config: Required<HTTPParserConfig>;

  constructor(config: HTTPParserConfig = {}) {
    this.config = {
      maxHeaderSize: config.maxHeaderSize ?? 16384, // 16KB
      maxBodySize: config.maxBodySize ?? 10485760, // 10MB
      strictMode: config.strictMode ?? false,
    };
  }

  /**
   * Parse HTTP request from bytes
   */
  parse(data: Uint8Array): HTTPRequest {
    const text = new TextDecoder().decode(data);
    const lines = text.split("\r\n");

    if (lines.length < 1) {
      throw new Error("Invalid HTTP request: empty");
    }

    // Parse request line
    const requestLine = lines[0];
    const [method, url, version] = this.parseRequestLine(requestLine);

    // Parse headers
    let headerEndIndex = 1;
    const headers: Record<string, string> = {};

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line === "") {
        headerEndIndex = i + 1;
        break;
      }

      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) {
        if (this.config.strictMode) {
          throw new Error(`Invalid header line: ${line}`);
        }
        continue;
      }

      const name = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();
      headers[name] = value;
    }

    // Check header size limit
    const headerSize = lines.slice(0, headerEndIndex).join("\r\n").length;
    if (headerSize > this.config.maxHeaderSize) {
      throw new Error(`Headers exceed maximum size: ${headerSize} > ${this.config.maxHeaderSize}`);
    }

    // Parse body
    const bodyStart = text.indexOf("\r\n\r\n");
    let body: Uint8Array | undefined;

    if (bodyStart !== -1) {
      const bodyBytes = data.slice(bodyStart + 4);
      if (bodyBytes.length > 0) {
        if (bodyBytes.length > this.config.maxBodySize) {
          throw new Error(`Body exceeds maximum size: ${bodyBytes.length} > ${this.config.maxBodySize}`);
        }
        body = bodyBytes;
      }
    }

    return {
      method: method as HTTPMethod,
      uri: url,
      version: version as HTTPVersion,
      headers,
      body,
    };
  }

  /**
   * Parse request line
   */
  private parseRequestLine(line: string): [string, string, string] {
    const parts = line.split(" ");

    if (parts.length !== 3) {
      throw new Error(`Invalid request line: ${line}`);
    }

    const method = parts[0].toUpperCase();
    const url = parts[1];
    const versionStr = parts[2];

    // Parse version (HTTP/1.1 -> 1.1)
    const versionMatch = versionStr.match(/HTTP\/(\d+\.\d+)/);
    if (!versionMatch) {
      throw new Error(`Invalid HTTP version: ${versionStr}`);
    }
    const version = versionMatch[1];

    return [method, url, version];
  }
}

/**
 * HTTP Response Parser
 *
 * Parses raw HTTP response bytes into structured HTTPResponse
 */
export class HTTPResponseParser {
  private config: Required<HTTPParserConfig>;

  constructor(config: HTTPParserConfig = {}) {
    this.config = {
      maxHeaderSize: config.maxHeaderSize ?? 16384, // 16KB
      maxBodySize: config.maxBodySize ?? 10485760, // 10MB
      strictMode: config.strictMode ?? false,
    };
  }

  /**
   * Parse HTTP response from bytes
   */
  parse(data: Uint8Array): HTTPResponse {
    const text = new TextDecoder().decode(data);
    const lines = text.split("\r\n");

    if (lines.length < 1) {
      throw new Error("Invalid HTTP response: empty");
    }

    // Parse status line
    const statusLine = lines[0];
    const [version, statusCode, statusText] = this.parseStatusLine(statusLine);

    // Parse headers
    let headerEndIndex = 1;
    const headers: Record<string, string> = {};

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line === "") {
        headerEndIndex = i + 1;
        break;
      }

      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) {
        if (this.config.strictMode) {
          throw new Error(`Invalid header line: ${line}`);
        }
        continue;
      }

      const name = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();
      headers[name] = value;
    }

    // Check header size limit
    const headerSize = lines.slice(0, headerEndIndex).join("\r\n").length;
    if (headerSize > this.config.maxHeaderSize) {
      throw new Error(`Headers exceed maximum size: ${headerSize} > ${this.config.maxHeaderSize}`);
    }

    // Parse body
    const bodyStart = text.indexOf("\r\n\r\n");
    let body = new Uint8Array(0);

    if (bodyStart !== -1) {
      const bodyBytes = data.slice(bodyStart + 4);
      if (bodyBytes.length > 0) {
        if (bodyBytes.length > this.config.maxBodySize) {
          throw new Error(`Body exceeds maximum size: ${bodyBytes.length} > ${this.config.maxBodySize}`);
        }
        body = bodyBytes;
      }
    }

    return {
      statusCode,
      statusText,
      version: version as HTTPVersion,
      headers,
      body,
    };
  }

  /**
   * Parse status line
   */
  private parseStatusLine(line: string): [string, number, string] {
    const parts = line.split(" ");

    if (parts.length < 3) {
      throw new Error(`Invalid status line: ${line}`);
    }

    const versionStr = parts[0];
    const statusCodeStr = parts[1];
    const statusText = parts.slice(2).join(" ");

    // Parse version (HTTP/1.1 -> 1.1)
    const versionMatch = versionStr.match(/HTTP\/(\d+\.\d+)/);
    if (!versionMatch) {
      throw new Error(`Invalid HTTP version: ${versionStr}`);
    }
    const version = versionMatch[1];

    // Parse status code
    const statusCode = parseInt(statusCodeStr, 10);
    if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
      throw new Error(`Invalid status code: ${statusCodeStr}`);
    }

    return [version, statusCode, statusText];
  }
}

/**
 * Parse HTTP headers from raw bytes
 */
export function parseHTTPHeaders(data: Uint8Array): Map<string, string> {
  const headers = new Map<string, string>();
  const text = new TextDecoder().decode(data);
  const lines = text.split("\r\n");

  for (const line of lines) {
    if (line === "") break;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const name = line.substring(0, colonIndex).trim().toLowerCase();
    const value = line.substring(colonIndex + 1).trim();
    headers.set(name, value);
  }

  return headers;
}

/**
 * Serialize HTTP headers to string
 */
export function serializeHTTPHeaders(headers: Map<string, string> | Record<string, string>): string {
  let result = "";

  if (headers instanceof Map) {
    for (const [name, value] of headers.entries()) {
      result += `${name}: ${value}\r\n`;
    }
  } else {
    for (const [name, value] of Object.entries(headers)) {
      result += `${name}: ${value}\r\n`;
    }
  }

  return result;
}

/**
 * Parse chunk size from chunked transfer encoding
 */
export function parseChunkSize(line: string): number {
  const semiIndex = line.indexOf(";");
  const hexSize = semiIndex === -1 ? line : line.substring(0, semiIndex);
  const size = parseInt(hexSize.trim(), 16);

  if (isNaN(size) || size < 0) {
    throw new Error(`Invalid chunk size: ${line}`);
  }

  return size;
}

/**
 * Check if HTTP method expects a request body
 */
export function methodHasBody(method: string): boolean {
  const upperMethod = method.toUpperCase();
  return upperMethod === "POST" || upperMethod === "PUT" || upperMethod === "PATCH";
}

/**
 * Check if HTTP status code expects a response body
 */
export function statusHasBody(statusCode: number): boolean {
  // 1xx, 204, 304 should not have a body
  return !(
    (statusCode >= 100 && statusCode < 200) ||
    statusCode === 204 ||
    statusCode === 304
  );
}
