/**
 * HTTP/1.1 Protocol Handler
 *
 * Implements HTTP/1.1 with persistent connections, chunked encoding,
 * and pipelining support according to RFC 7230-7235.
 */

import { StreamReader } from "../../primitive/buffer/stream_reader.ts";
import { StreamWriter } from "../../primitive/buffer/stream_writer.ts";
import { HeaderParser, type Headers } from "../../primitive/header/header_parser.ts";
import {
  type HTTPMethod,
  type HTTPVersion,
  type RequestLine,
  RequestLineParser,
} from "../../primitive/header/request_line_parser.ts";
import {
  type HTTPStatusCode,
  type StatusLine,
  StatusLineParser,
} from "../../primitive/header/status_line_parser.ts";
import { Socket } from "../socket/socket.ts";

// Re-export types for external use
export type { HTTPMethod, HTTPStatusCode, HTTPVersion };

/**
 * HTTP client configuration
 */
export interface HTTPClientConfig {
  timeout?: number;
  keepAlive?: boolean;
  maxRedirects?: number;
}

/**
 * HTTP server configuration
 */
export interface HTTPServerConfig {
  port?: number;
  hostname?: string;
  maxConnections?: number;
  timeout?: number;
}

/**
 * HTTP request
 */
export interface HTTPRequest {
  method: HTTPMethod;
  uri: string;
  version: HTTPVersion;
  headers: Headers;
  body?: Uint8Array;
}

/**
 * HTTP response
 */
export interface HTTPResponse {
  version: HTTPVersion;
  statusCode: HTTPStatusCode;
  statusText: string;
  headers: Headers;
  body?: Uint8Array;
}

/**
 * HTTP/1.1 client for sending requests
 */
export class HTTP11Client {
  private reader: StreamReader | null = null;
  private writer: StreamWriter | null = null;
  private socket: Socket | null = null;
  private config?: { host: string; port: number; timeout?: number };

  constructor(socketOrConfig: Socket | { host: string; port: number; timeout?: number }) {
    if (socketOrConfig instanceof Socket) {
      this.socket = socketOrConfig;
    } else {
      this.config = socketOrConfig;
    }
  }

  async connect(): Promise<void> {
    if (!this.config) {
      // Already connected via Socket constructor
      return;
    }

    this.socket = new Socket(this.config.host, this.config.port);
    await this.socket.connect(this.config.timeout);
  }

  /**
   * Send HTTP request and receive response
   */
  async sendRequest(request: HTTPRequest): Promise<HTTPResponse> {
    if (!this.socket || !this.socket.isConnected()) {
      throw new Error("Socket is not connected");
    }

    // Initialize reader/writer if needed
    if (!this.reader || !this.writer) {
      const conn = this.socket.getConn();
      if (!conn) {
        throw new Error("No connection available");
      }
      this.reader = new StreamReader(conn);
      this.writer = new StreamWriter(conn);
    }

    // Write request
    await this.writeRequest(request);

    // Read response
    return await this.readResponse();
  }

  /**
   * Write HTTP request to socket
   */
  private async writeRequest(request: HTTPRequest): Promise<void> {
    if (!this.writer) {
      throw new Error("Writer not initialized");
    }

    // Write request line
    const requestLine: RequestLine = {
      method: request.method,
      uri: request.uri,
      version: request.version,
    };
    await this.writer.writeString(RequestLineParser.serialize(requestLine));
    await this.writer.writeCRLF();

    // Ensure Content-Length is set if body exists
    const headers = { ...request.headers };
    if (request.body && !HeaderParser.hasHeader(headers, "content-length")) {
      HeaderParser.setHeader(headers, "content-length", request.body.length.toString());
    }

    // Write headers
    const headerString = HeaderParser.serializeHeaders(headers);
    await this.writer.writeString(headerString);
    await this.writer.writeCRLF();

    // Blank line to end headers
    await this.writer.writeCRLF();

    // Write body if present
    if (request.body && request.body.length > 0) {
      await this.writer.write(request.body);
    }

    // Flush to ensure all data is sent
    await this.writer.flush();
  }

  /**
   * Read HTTP response from socket
   */
  private async readResponse(): Promise<HTTPResponse> {
    if (!this.reader) {
      throw new Error("Reader not initialized");
    }

    // Read status line
    const statusLineStr = await this.reader.readLine();
    if (!statusLineStr) {
      throw new Error("Connection closed before status line received");
    }

    const statusLine = StatusLineParser.parse(statusLineStr);

    // Read headers
    const headerLines: string[] = [];
    while (true) {
      const line = await this.reader.readLine();
      if (line === null) {
        throw new Error("Connection closed while reading headers");
      }
      if (line === "") {
        break; // End of headers
      }
      headerLines.push(line);
    }

    const headers = HeaderParser.parseHeaders(headerLines);

    // Read body
    let body: Uint8Array | undefined;

    // Check if response can have body
    if (StatusLineParser.canHaveBody(statusLine.statusCode)) {
      if (HeaderParser.isChunkedEncoding(headers)) {
        // Read chunked body
        body = await this.readChunkedBody();
      } else {
        const contentLength = HeaderParser.getContentLength(headers);
        if (contentLength !== null && contentLength > 0) {
          // Read fixed-length body
          body = await this.reader.readExact(contentLength);
        }
      }
    }

    return {
      version: statusLine.version,
      statusCode: statusLine.statusCode,
      statusText: statusLine.statusText,
      headers,
      body,
    };
  }

  /**
   * Read chunked transfer encoding body
   */
  private async readChunkedBody(): Promise<Uint8Array> {
    if (!this.reader) {
      throw new Error("Reader not initialized");
    }

    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    while (true) {
      // Read chunk size line
      const chunkSizeLine = await this.reader.readLine();
      if (!chunkSizeLine) {
        throw new Error("Connection closed while reading chunk size");
      }

      // Parse chunk size (hex)
      const chunkSize = parseInt(chunkSizeLine.trim().split(";")[0], 16);

      if (isNaN(chunkSize)) {
        throw new Error(`Invalid chunk size: ${chunkSizeLine}`);
      }

      if (chunkSize === 0) {
        // Last chunk
        // Read trailing headers (we ignore them for now)
        while (true) {
          const line = await this.reader.readLine();
          if (line === null || line === "") {
            break;
          }
        }
        break;
      }

      // Read chunk data
      const chunk = await this.reader.readExact(chunkSize);
      chunks.push(chunk);
      totalLength += chunk.length;

      // Read trailing CRLF
      await this.reader.readLine();
    }

    // Combine chunks
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }

    return body;
  }

  /**
   * Get stream reader
   */
  getReader(): StreamReader | null {
    return this.reader;
  }

  /**
   * Get stream writer
   */
  getWriter(): StreamWriter | null {
    return this.writer;
  }

  /**
   * Get socket
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Get client configuration
   */
  getConfig(): { host: string; port: number; timeout?: number } | undefined {
    return this.config;
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.isConnected();
  }

  /**
   * Close the client (closes reader/writer and socket)
   */
  close(): void {
    if (this.reader) {
      this.reader.close();
      this.reader = null;
    }
    if (this.writer) {
      this.writer.close();
      this.writer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

/**
 * HTTP/1.1 server for handling incoming requests
 */
export class HTTP11Server {
  private reader: StreamReader | null = null;
  private writer: StreamWriter | null = null;

  constructor(private socket: Socket) {}

  /**
   * Read incoming HTTP request
   */
  async readRequest(): Promise<HTTPRequest> {
    if (!this.socket.isConnected()) {
      throw new Error("Socket is not connected");
    }

    // Initialize reader if needed
    if (!this.reader) {
      const conn = this.socket.getConn();
      if (!conn) {
        throw new Error("No connection available");
      }
      this.reader = new StreamReader(conn);
    }

    // Read request line
    const requestLineStr = await this.reader.readLine();
    if (!requestLineStr) {
      throw new Error("Connection closed before request line received");
    }

    const requestLine = RequestLineParser.parse(requestLineStr);

    // Read headers
    const headerLines: string[] = [];
    while (true) {
      const line = await this.reader.readLine();
      if (line === null) {
        throw new Error("Connection closed while reading headers");
      }
      if (line === "") {
        break; // End of headers
      }
      headerLines.push(line);
    }

    const headers = HeaderParser.parseHeaders(headerLines);

    // Read body
    let body: Uint8Array | undefined;

    if (RequestLineParser.methodHasBody(requestLine.method)) {
      if (HeaderParser.isChunkedEncoding(headers)) {
        // Read chunked body
        body = await this.readChunkedBody();
      } else {
        const contentLength = HeaderParser.getContentLength(headers);
        if (contentLength !== null && contentLength > 0) {
          // Read fixed-length body
          body = await this.reader.readExact(contentLength);
        }
      }
    }

    return {
      method: requestLine.method,
      uri: requestLine.uri,
      version: requestLine.version,
      headers,
      body,
    };
  }

  /**
   * Send HTTP response
   */
  async sendResponse(response: HTTPResponse): Promise<void> {
    if (!this.socket.isConnected()) {
      throw new Error("Socket is not connected");
    }

    // Initialize writer if needed
    if (!this.writer) {
      const conn = this.socket.getConn();
      if (!conn) {
        throw new Error("No connection available");
      }
      this.writer = new StreamWriter(conn);
    }

    // Write status line
    const statusLine: StatusLine = {
      version: response.version,
      statusCode: response.statusCode,
      statusText: response.statusText,
    };
    await this.writer.writeString(StatusLineParser.serialize(statusLine));
    await this.writer.writeCRLF();

    // Ensure Content-Length is set if body exists
    const headers = { ...response.headers };
    if (response.body && !HeaderParser.hasHeader(headers, "content-length")) {
      HeaderParser.setHeader(headers, "content-length", response.body.length.toString());
    }

    // Write headers
    const headerString = HeaderParser.serializeHeaders(headers);
    await this.writer.writeString(headerString);
    await this.writer.writeCRLF();

    // Blank line to end headers
    await this.writer.writeCRLF();

    // Write body if present
    if (response.body && response.body.length > 0) {
      await this.writer.write(response.body);
    }

    // Flush to ensure all data is sent
    await this.writer.flush();
  }

  /**
   * Read chunked transfer encoding body
   */
  private async readChunkedBody(): Promise<Uint8Array> {
    if (!this.reader) {
      throw new Error("Reader not initialized");
    }

    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    while (true) {
      // Read chunk size line
      const chunkSizeLine = await this.reader.readLine();
      if (!chunkSizeLine) {
        throw new Error("Connection closed while reading chunk size");
      }

      // Parse chunk size (hex)
      const chunkSize = parseInt(chunkSizeLine.trim().split(";")[0], 16);

      if (isNaN(chunkSize)) {
        throw new Error(`Invalid chunk size: ${chunkSizeLine}`);
      }

      if (chunkSize === 0) {
        // Last chunk
        // Read trailing headers (we ignore them for now)
        while (true) {
          const line = await this.reader.readLine();
          if (line === null || line === "") {
            break;
          }
        }
        break;
      }

      // Read chunk data
      const chunk = await this.reader.readExact(chunkSize);
      chunks.push(chunk);
      totalLength += chunk.length;

      // Read trailing CRLF
      await this.reader.readLine();
    }

    // Combine chunks
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }

    return body;
  }

  /**
   * Get stream reader
   */
  getReader(): StreamReader | null {
    return this.reader;
  }

  /**
   * Get stream writer
   */
  getWriter(): StreamWriter | null {
    return this.writer;
  }

  /**
   * Get socket
   */
  getSocket(): Socket {
    return this.socket;
  }

  /**
   * Close the server (closes reader/writer, not socket)
   */
  close(): void {
    if (this.reader) {
      this.reader.close();
      this.reader = null;
    }
    if (this.writer) {
      this.writer.close();
      this.writer = null;
    }
  }
}

/**
 * Convenience function to make HTTP request
 */
export async function makeHTTPRequest(
  host: string,
  port: number,
  request: HTTPRequest,
): Promise<HTTPResponse> {
  const socket = new Socket(host, port);
  await socket.connect();

  try {
    const client = new HTTP11Client(socket);
    return await client.sendRequest(request);
  } finally {
    socket.close();
  }
}
