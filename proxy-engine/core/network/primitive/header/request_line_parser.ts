/**
 * HTTP Request Line Parser
 *
 * Parses and serializes HTTP request lines (e.g., "GET /path HTTP/1.1")
 */

/**
 * HTTP methods
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
 * Parsed request line
 */
export interface RequestLine {
  method: HTTPMethod;
  uri: string;
  version: HTTPVersion;
}

/**
 * Request line parser
 */
export class RequestLineParser {
  /**
   * Parse request line from string
   * Format: "METHOD URI HTTP/VERSION"
   * Example: "GET /index.html HTTP/1.1"
   */
  static parse(line: string): RequestLine {
    const trimmed = line.trim();

    if (!trimmed) {
      throw new Error("Empty request line");
    }

    // Split by whitespace
    const parts = trimmed.split(/\s+/);

    if (parts.length !== 3) {
      throw new Error(`Invalid request line format: ${line}`);
    }

    const [methodStr, uri, versionStr] = parts;

    // Validate and parse method
    const method = this.parseMethod(methodStr);

    // Validate URI
    if (!uri || uri.length === 0) {
      throw new Error("Empty URI in request line");
    }

    // Validate and parse version
    const version = this.parseVersion(versionStr);

    return {
      method,
      uri,
      version,
    };
  }

  /**
   * Serialize request line to string
   */
  static serialize(requestLine: RequestLine): string {
    return `${requestLine.method} ${requestLine.uri} HTTP/${requestLine.version}`;
  }

  /**
   * Serialize request line to bytes
   */
  static serializeToBytes(requestLine: RequestLine): Uint8Array {
    const line = this.serialize(requestLine);
    const encoder = new TextEncoder();
    return encoder.encode(line);
  }

  /**
   * Parse HTTP method
   */
  private static parseMethod(methodStr: string): HTTPMethod {
    const method = methodStr.toUpperCase();

    const validMethods: HTTPMethod[] = [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
      "CONNECT",
      "TRACE",
    ];

    if (!validMethods.includes(method as HTTPMethod)) {
      throw new Error(`Invalid HTTP method: ${methodStr}`);
    }

    return method as HTTPMethod;
  }

  /**
   * Parse HTTP version
   */
  private static parseVersion(versionStr: string): HTTPVersion {
    // Expected format: "HTTP/1.1"
    const match = versionStr.match(/^HTTP\/(\d+\.\d+)$/i);

    if (!match) {
      throw new Error(`Invalid HTTP version format: ${versionStr}`);
    }

    const version = match[1];

    const validVersions: HTTPVersion[] = ["1.0", "1.1", "2.0", "3.0"];

    if (!validVersions.includes(version as HTTPVersion)) {
      throw new Error(`Unsupported HTTP version: ${version}`);
    }

    return version as HTTPVersion;
  }

  /**
   * Check if method is safe (GET, HEAD, OPTIONS, TRACE)
   */
  static isSafeMethod(method: HTTPMethod): boolean {
    return ["GET", "HEAD", "OPTIONS", "TRACE"].includes(method);
  }

  /**
   * Check if method is idempotent (GET, HEAD, PUT, DELETE, OPTIONS, TRACE)
   */
  static isIdempotentMethod(method: HTTPMethod): boolean {
    return ["GET", "HEAD", "PUT", "DELETE", "OPTIONS", "TRACE"].includes(
      method,
    );
  }

  /**
   * Check if method typically has a request body
   */
  static methodHasBody(method: HTTPMethod): boolean {
    return ["POST", "PUT", "PATCH"].includes(method);
  }

  /**
   * Parse absolute URI (e.g., for proxy requests)
   * Format: http://host:port/path
   */
  static parseAbsoluteURI(uri: string): {
    scheme: string;
    host: string;
    port: number;
    path: string;
  } {
    try {
      const url = new URL(uri);
      return {
        scheme: url.protocol.replace(":", ""),
        host: url.hostname,
        port: url.port ? parseInt(url.port, 10) : (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search + url.hash,
      };
    } catch {
      throw new Error(`Invalid absolute URI: ${uri}`);
    }
  }

  /**
   * Check if URI is absolute (contains scheme)
   */
  static isAbsoluteURI(uri: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(uri);
  }

  /**
   * Normalize path (remove . and .., decode %XX)
   */
  static normalizePath(path: string): string {
    try {
      // Handle relative paths
      if (!path.startsWith("/")) {
        path = "/" + path;
      }

      // Create URL to leverage browser's normalization
      const url = new URL(path, "http://dummy");
      return url.pathname + url.search + url.hash;
    } catch {
      // Fallback: basic normalization
      return path;
    }
  }
}
