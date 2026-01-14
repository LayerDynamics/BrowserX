/**
 * HTTP Header Parser
 *
 * Parses and serializes HTTP headers following RFC 7230
 */

/**
 * HTTP headers (lowercase keys)
 */
export type Headers = Record<string, string>;

/**
 * Parse HTTP headers from raw bytes
 */
export class HeaderParser {
  /**
   * Parse headers from lines
   * Each line should be "name: value"
   * Empty line signals end of headers
   */
  static parseHeaders(lines: string[]): Headers {
    const headers: Headers = {};

    for (const line of lines) {
      if (line.trim() === "") {
        break; // End of headers
      }

      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) {
        throw new Error(`Invalid header line: ${line}`);
      }

      const name = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();

      // Handle multiple headers with same name (combine with comma)
      if (headers[name]) {
        headers[name] += `, ${value}`;
      } else {
        headers[name] = value;
      }
    }

    return headers;
  }

  /**
   * Parse headers from a single string
   */
  static parseHeaderString(headerString: string): Headers {
    const lines = headerString.split("\r\n");
    return this.parseHeaders(lines);
  }

  /**
   * Serialize headers to string format
   */
  static serializeHeaders(headers: Headers): string {
    const lines: string[] = [];

    for (const [name, value] of Object.entries(headers)) {
      // RFC 7230: Header field names are case-insensitive
      // Convention is to use Title-Case for display
      const displayName = this.toTitleCase(name);
      lines.push(`${displayName}: ${value}`);
    }

    return lines.join("\r\n");
  }

  /**
   * Serialize headers to bytes
   */
  static serializeHeadersToBytes(headers: Headers): Uint8Array {
    const headerString = this.serializeHeaders(headers);
    const encoder = new TextEncoder();
    return encoder.encode(headerString);
  }

  /**
   * Get header value (case-insensitive)
   */
  static getHeader(headers: Headers, name: string): string | undefined {
    return headers[name.toLowerCase()];
  }

  /**
   * Set header value (normalizes to lowercase)
   */
  static setHeader(headers: Headers, name: string, value: string): void {
    headers[name.toLowerCase()] = value;
  }

  /**
   * Delete header (case-insensitive)
   */
  static deleteHeader(headers: Headers, name: string): void {
    delete headers[name.toLowerCase()];
  }

  /**
   * Check if header exists (case-insensitive)
   */
  static hasHeader(headers: Headers, name: string): boolean {
    return name.toLowerCase() in headers;
  }

  /**
   * Merge headers (second overwrites first)
   */
  static mergeHeaders(headers1: Headers, headers2: Headers): Headers {
    return { ...headers1, ...headers2 };
  }

  /**
   * Convert header name to Title-Case
   */
  private static toTitleCase(str: string): string {
    return str
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("-");
  }

  /**
   * Parse Content-Length header
   */
  static getContentLength(headers: Headers): number | null {
    const value = this.getHeader(headers, "content-length");
    if (!value) {
      return null;
    }

    const length = parseInt(value, 10);
    if (isNaN(length) || length < 0) {
      throw new Error(`Invalid Content-Length: ${value}`);
    }

    return length;
  }

  /**
   * Check if Transfer-Encoding is chunked
   */
  static isChunkedEncoding(headers: Headers): boolean {
    const value = this.getHeader(headers, "transfer-encoding");
    return value?.toLowerCase().includes("chunked") || false;
  }

  /**
   * Check if Connection should be kept alive
   */
  static isKeepAlive(headers: Headers, httpVersion: string): boolean {
    const connection = this.getHeader(headers, "connection");

    if (connection) {
      return connection.toLowerCase() === "keep-alive";
    }

    // HTTP/1.1 defaults to keep-alive
    return httpVersion === "1.1";
  }

  /**
   * Get Host header
   */
  static getHost(headers: Headers): string | null {
    return this.getHeader(headers, "host") || null;
  }

  /**
   * Parse Cookie header into key-value pairs
   */
  static parseCookies(headers: Headers): Record<string, string> {
    const cookieHeader = this.getHeader(headers, "cookie");
    if (!cookieHeader) {
      return {};
    }

    const cookies: Record<string, string> = {};
    const pairs = cookieHeader.split(";");

    for (const pair of pairs) {
      const [name, ...valueParts] = pair.split("=");
      const trimmedName = name.trim();
      const value = valueParts.join("=").trim();

      if (trimmedName) {
        cookies[trimmedName] = value;
      }
    }

    return cookies;
  }

  /**
   * Serialize cookies to Cookie header value
   */
  static serializeCookies(cookies: Record<string, string>): string {
    const pairs: string[] = [];

    for (const [name, value] of Object.entries(cookies)) {
      pairs.push(`${name}=${value}`);
    }

    return pairs.join("; ");
  }
}
