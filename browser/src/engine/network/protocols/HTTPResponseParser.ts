/**
 * HTTP Response Parser
 *
 * Implements HTTP/1.1 response parsing according to RFC 7230.
 * Supports chunked transfer encoding (RFC 7230 Section 4.1).
 */

import type { ByteBuffer } from "../../../types/identifiers.ts";
import { HTTPHeaderParser, type HTTPHeaders } from "./HTTPHeaders.ts";

/**
 * HTTP status code ranges
 */
export enum HTTPStatusClass {
  INFORMATIONAL = 1, // 1xx
  SUCCESS = 2, // 2xx
  REDIRECTION = 3, // 3xx
  CLIENT_ERROR = 4, // 4xx
  SERVER_ERROR = 5, // 5xx
}

/**
 * Common HTTP status codes
 */
export enum HTTPStatus {
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  MOVED_PERMANENTLY = 301,
  FOUND = 302,
  SEE_OTHER = 303,
  NOT_MODIFIED = 304,
  TEMPORARY_REDIRECT = 307,
  PERMANENT_REDIRECT = 308,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
}

/**
 * HTTP response structure
 */
export interface HTTPResponse {
  version: string; // e.g., "HTTP/1.1"
  statusCode: number;
  statusText: string;
  headers: HTTPHeaders;
  body: ByteBuffer;
}

/**
 * HTTP response parser
 */
export class HTTPResponseParser {
  /**
   * Parse HTTP response from wire format
   *
   * @param data - Raw HTTP response bytes
   * @returns Parsed HTTP response
   */
  static parseResponse(data: ByteBuffer): HTTPResponse {
    // Find end of headers by scanning bytes directly (0x0D 0x0A 0x0D 0x0A)
    // This avoids character-offset vs byte-offset mismatches
    let headerEndByteIndex = -1;
    for (let i = 0; i < data.byteLength - 3; i++) {
      if (
        data[i] === 0x0D && data[i + 1] === 0x0A && data[i + 2] === 0x0D && data[i + 3] === 0x0A
      ) {
        headerEndByteIndex = i;
        break;
      }
    }
    if (headerEndByteIndex === -1) {
      throw new Error("Invalid HTTP response: no header end marker");
    }

    // Decode only the header portion as text
    const text = new TextDecoder().decode(data.slice(0, headerEndByteIndex));

    // Split into lines
    const lines = text.split("\r\n");

    if (lines.length === 0) {
      throw new Error("Invalid HTTP response: empty");
    }

    // Parse status line (e.g., "HTTP/1.1 200 OK")
    const statusLine = lines[0];
    const statusParts = statusLine.split(" ");

    if (statusParts.length < 2) {
      throw new Error(`Invalid HTTP status line: ${statusLine}`);
    }

    const version = statusParts[0];
    const statusCode = parseInt(statusParts[1], 10);
    const statusText = statusParts.slice(2).join(" ");

    if (isNaN(statusCode)) {
      throw new Error(`Invalid status code: ${statusParts[1]}`);
    }

    // Parse headers
    const headerLines = lines.slice(1).join("\r\n") + "\r\n";
    const headerBytes = new TextEncoder().encode(headerLines);
    const headers = HTTPHeaderParser.parseHeaders(headerBytes);

    // Extract body using byte offset (handle chunked encoding if present)
    const bodyStartIndex = headerEndByteIndex + 4; // Skip \r\n\r\n
    const rawBody = data.slice(bodyStartIndex);

    const transferEncoding = HTTPHeaderParser.getHeader(headers, "transfer-encoding");
    const body = transferEncoding?.toLowerCase().includes("chunked")
      ? this.decodeChunkedBody(rawBody)
      : rawBody;

    return {
      version,
      statusCode,
      statusText,
      headers,
      body,
    };
  }

  /**
   * Decode chunked transfer encoding
   *
   * Format:
   * chunk-size (hex) CRLF
   * chunk-data CRLF
   * ...
   * 0 CRLF
   * CRLF
   *
   * Works entirely with byte offsets to avoid character/byte offset mismatches
   * that occur when content contains multi-byte UTF-8 characters.
   */
  static decodeChunkedBody(data: ByteBuffer): ByteBuffer {
    const chunks: Uint8Array[] = [];
    let offset = 0;

    while (offset < data.byteLength) {
      // Find CRLF by scanning bytes directly
      let crlfIndex = -1;
      for (let i = offset; i < data.byteLength - 1; i++) {
        if (data[i] === 0x0D && data[i + 1] === 0x0A) { // \r\n
          crlfIndex = i;
          break;
        }
      }

      if (crlfIndex === -1) {
        // No more complete chunks
        break;
      }

      // Parse chunk size line (ASCII hex, so safe to decode as text)
      const chunkSizeBytes = data.slice(offset, crlfIndex);
      const chunkSizeLine = new TextDecoder().decode(chunkSizeBytes);
      const chunkSize = parseInt(chunkSizeLine.split(";")[0].trim(), 16);

      if (isNaN(chunkSize)) {
        throw new Error(`Invalid chunk size: ${chunkSizeLine}`);
      }

      // Last chunk (size 0)
      if (chunkSize === 0) {
        // RFC 7230 Section 4.1: Consume optional trailer headers after zero-length chunk
        // Format: 0\r\n[trailer-header\r\n]*\r\n
        offset = crlfIndex + 2; // Move past "0\r\n"

        // Consume trailer headers until we hit an empty line (just CRLF)
        while (offset < data.byteLength - 1) {
          // Find next CRLF
          let trailerCrlfIndex = -1;
          for (let i = offset; i < data.byteLength - 1; i++) {
            if (data[i] === 0x0D && data[i + 1] === 0x0A) {
              trailerCrlfIndex = i;
              break;
            }
          }

          if (trailerCrlfIndex === -1) {
            break; // No more complete lines
          }

          // If this is an empty line (CRLF at current offset), we're done
          if (trailerCrlfIndex === offset) {
            break; // Found terminating CRLF
          }

          // Otherwise it's a trailer header - skip it
          offset = trailerCrlfIndex + 2;
        }
        break;
      }

      // Extract chunk data
      const chunkStart = crlfIndex + 2; // Skip CRLF
      const chunkEnd = chunkStart + chunkSize;

      if (chunkEnd > data.byteLength) {
        throw new Error("Incomplete chunked data");
      }

      chunks.push(data.slice(chunkStart, chunkEnd));

      // Move to next chunk (skip chunk data + CRLF)
      offset = chunkEnd + 2;
    }

    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let resultOffset = 0;

    for (const chunk of chunks) {
      result.set(chunk, resultOffset);
      resultOffset += chunk.byteLength;
    }

    return result;
  }

  /**
   * Encode body with chunked transfer encoding
   *
   * @param data - Body data to encode
   * @returns Chunked encoded data
   */
  static encodeChunkedBody(data: ByteBuffer, chunkSize: number = 8192): ByteBuffer {
    const chunks: Uint8Array[] = [];
    let offset = 0;

    while (offset < data.byteLength) {
      const remainingBytes = data.byteLength - offset;
      const currentChunkSize = Math.min(chunkSize, remainingBytes);
      const chunk = data.slice(offset, offset + currentChunkSize);

      // Chunk size in hex + CRLF
      const chunkSizeHex = currentChunkSize.toString(16);
      const chunkHeader = new TextEncoder().encode(`${chunkSizeHex}\r\n`);

      // Chunk data + CRLF
      const chunkWithCRLF = new Uint8Array(chunkHeader.byteLength + chunk.byteLength + 2);
      chunkWithCRLF.set(chunkHeader, 0);
      chunkWithCRLF.set(chunk, chunkHeader.byteLength);
      chunkWithCRLF.set(
        new TextEncoder().encode("\r\n"),
        chunkHeader.byteLength + chunk.byteLength,
      );

      chunks.push(chunkWithCRLF);
      offset += currentChunkSize;
    }

    // Last chunk (0 size) + CRLF
    const lastChunk = new TextEncoder().encode("0\r\n\r\n");
    chunks.push(lastChunk);

    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let resultOffset = 0;

    for (const chunk of chunks) {
      result.set(chunk, resultOffset);
      resultOffset += chunk.byteLength;
    }

    return result;
  }

  /**
   * Serialize HTTP response to wire format
   *
   * @param response - HTTP response to serialize
   * @returns Serialized response bytes
   */
  static serializeResponse(response: HTTPResponse): ByteBuffer {
    // Build status line
    const statusLine = `${response.version} ${response.statusCode} ${response.statusText}\r\n`;

    // Serialize headers
    const headers = HTTPHeaderParser.serializeHeaders(response.headers);

    // Combine status line + headers + body
    const statusLineBytes = new TextEncoder().encode(statusLine);
    const totalLength = statusLineBytes.byteLength + headers.byteLength +
      response.body.byteLength;

    const result = new Uint8Array(totalLength);
    let offset = 0;

    result.set(statusLineBytes, offset);
    offset += statusLineBytes.byteLength;

    result.set(headers, offset);
    offset += headers.byteLength;

    result.set(response.body, offset);

    return result;
  }

  /**
   * Create HTTP response
   *
   * @param statusCode - HTTP status code
   * @param statusText - Status text
   * @param headers - Response headers
   * @param body - Response body
   * @returns HTTP response object
   */
  static createResponse(
    statusCode: number,
    statusText: string,
    headers?: HTTPHeaders,
    body?: ByteBuffer,
  ): HTTPResponse {
    return {
      version: "HTTP/1.1",
      statusCode,
      statusText,
      headers: headers || HTTPHeaderParser.createHeaders(),
      body: body || new Uint8Array(0),
    };
  }

  /**
   * Get status class from status code
   *
   * @param statusCode - HTTP status code
   * @returns Status class (1xx, 2xx, etc.)
   */
  static getStatusClass(statusCode: number): HTTPStatusClass {
    return Math.floor(statusCode / 100) as HTTPStatusClass;
  }

  /**
   * Check if response is successful (2xx)
   *
   * @param statusCode - HTTP status code
   * @returns True if status is 2xx
   */
  static isSuccessful(statusCode: number): boolean {
    return this.getStatusClass(statusCode) === HTTPStatusClass.SUCCESS;
  }

  /**
   * Check if response is a redirect (3xx)
   *
   * @param statusCode - HTTP status code
   * @returns True if status is 3xx
   */
  static isRedirect(statusCode: number): boolean {
    return this.getStatusClass(statusCode) === HTTPStatusClass.REDIRECTION;
  }

  /**
   * Check if response is an error (4xx or 5xx)
   *
   * @param statusCode - HTTP status code
   * @returns True if status is 4xx or 5xx
   */
  static isError(statusCode: number): boolean {
    const statusClass = this.getStatusClass(statusCode);
    return statusClass === HTTPStatusClass.CLIENT_ERROR ||
      statusClass === HTTPStatusClass.SERVER_ERROR;
  }
}
