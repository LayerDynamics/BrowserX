/**
 * HTTP Status Line Parser
 *
 * Parses and serializes HTTP status lines (e.g., "HTTP/1.1 200 OK")
 */

import type { HTTPVersion } from "./request_line_parser.ts";

/**
 * HTTP status code
 */
export type HTTPStatusCode = number;

/**
 * Parsed status line
 */
export interface StatusLine {
  version: HTTPVersion;
  statusCode: HTTPStatusCode;
  statusText: string;
}

/**
 * Status line parser
 */
export class StatusLineParser {
  /**
   * Standard status text by code
   */
  private static readonly STATUS_TEXT: Record<number, string> = {
    // 1xx Informational
    100: "Continue",
    101: "Switching Protocols",
    102: "Processing",
    103: "Early Hints",

    // 2xx Success
    200: "OK",
    201: "Created",
    202: "Accepted",
    203: "Non-Authoritative Information",
    204: "No Content",
    205: "Reset Content",
    206: "Partial Content",
    207: "Multi-Status",
    208: "Already Reported",
    226: "IM Used",

    // 3xx Redirection
    300: "Multiple Choices",
    301: "Moved Permanently",
    302: "Found",
    303: "See Other",
    304: "Not Modified",
    305: "Use Proxy",
    307: "Temporary Redirect",
    308: "Permanent Redirect",

    // 4xx Client Error
    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    407: "Proxy Authentication Required",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    411: "Length Required",
    412: "Precondition Failed",
    413: "Payload Too Large",
    414: "URI Too Long",
    415: "Unsupported Media Type",
    416: "Range Not Satisfiable",
    417: "Expectation Failed",
    418: "I'm a teapot",
    421: "Misdirected Request",
    422: "Unprocessable Entity",
    423: "Locked",
    424: "Failed Dependency",
    425: "Too Early",
    426: "Upgrade Required",
    428: "Precondition Required",
    429: "Too Many Requests",
    431: "Request Header Fields Too Large",
    451: "Unavailable For Legal Reasons",

    // 5xx Server Error
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
    505: "HTTP Version Not Supported",
    506: "Variant Also Negotiates",
    507: "Insufficient Storage",
    508: "Loop Detected",
    510: "Not Extended",
    511: "Network Authentication Required",
  };

  /**
   * Parse status line from string
   * Format: "HTTP/VERSION CODE TEXT"
   * Example: "HTTP/1.1 200 OK"
   */
  static parse(line: string): StatusLine {
    const trimmed = line.trim();

    if (!trimmed) {
      throw new Error("Empty status line");
    }

    // Split by whitespace (status text can have spaces)
    const firstSpace = trimmed.indexOf(" ");
    if (firstSpace === -1) {
      throw new Error(`Invalid status line format: ${line}`);
    }

    const versionStr = trimmed.slice(0, firstSpace);
    const rest = trimmed.slice(firstSpace + 1).trim();

    const secondSpace = rest.indexOf(" ");
    let statusCodeStr: string;
    let statusText: string;

    if (secondSpace === -1) {
      // No status text provided
      statusCodeStr = rest;
      statusText = "";
    } else {
      statusCodeStr = rest.slice(0, secondSpace);
      statusText = rest.slice(secondSpace + 1).trim();
    }

    // Parse version
    const version = this.parseVersion(versionStr);

    // Parse status code
    const statusCode = this.parseStatusCode(statusCodeStr);

    // Use default status text if none provided
    if (!statusText) {
      statusText = this.getDefaultStatusText(statusCode);
    }

    return {
      version,
      statusCode,
      statusText,
    };
  }

  /**
   * Serialize status line to string
   */
  static serialize(statusLine: StatusLine): string {
    return `HTTP/${statusLine.version} ${statusLine.statusCode} ${statusLine.statusText}`;
  }

  /**
   * Serialize status line to bytes
   */
  static serializeToBytes(statusLine: StatusLine): Uint8Array {
    const line = this.serialize(statusLine);
    const encoder = new TextEncoder();
    return encoder.encode(line);
  }

  /**
   * Parse HTTP version
   */
  private static parseVersion(versionStr: string): HTTPVersion {
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
   * Parse status code
   */
  private static parseStatusCode(codeStr: string): HTTPStatusCode {
    const code = parseInt(codeStr, 10);

    if (isNaN(code) || code < 100 || code > 599) {
      throw new Error(`Invalid status code: ${codeStr}`);
    }

    return code;
  }

  /**
   * Get default status text for code
   */
  static getDefaultStatusText(code: HTTPStatusCode): string {
    return this.STATUS_TEXT[code] || "Unknown";
  }

  /**
   * Check if status code is informational (1xx)
   */
  static isInformational(code: HTTPStatusCode): boolean {
    return code >= 100 && code < 200;
  }

  /**
   * Check if status code is success (2xx)
   */
  static isSuccess(code: HTTPStatusCode): boolean {
    return code >= 200 && code < 300;
  }

  /**
   * Check if status code is redirection (3xx)
   */
  static isRedirection(code: HTTPStatusCode): boolean {
    return code >= 300 && code < 400;
  }

  /**
   * Check if status code is client error (4xx)
   */
  static isClientError(code: HTTPStatusCode): boolean {
    return code >= 400 && code < 500;
  }

  /**
   * Check if status code is server error (5xx)
   */
  static isServerError(code: HTTPStatusCode): boolean {
    return code >= 500 && code < 600;
  }

  /**
   * Check if status code is error (4xx or 5xx)
   */
  static isError(code: HTTPStatusCode): boolean {
    return code >= 400;
  }

  /**
   * Check if response with this status can have a body
   */
  static canHaveBody(code: HTTPStatusCode): boolean {
    // 1xx, 204 No Content, and 304 Not Modified cannot have body
    return !(
      this.isInformational(code) ||
      code === 204 ||
      code === 304
    );
  }

  /**
   * Create a standard status line
   */
  static create(statusCode: HTTPStatusCode, version: HTTPVersion = "1.1"): StatusLine {
    return {
      version,
      statusCode,
      statusText: this.getDefaultStatusText(statusCode),
    };
  }
}
