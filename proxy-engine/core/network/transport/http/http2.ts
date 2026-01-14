/**
 * HTTP/2 Protocol Implementation
 *
 * Implements HTTP/2 client and server as defined in RFC 7540
 */

import type { HTTPRequest, HTTPResponse } from "./http.ts";
import {
  HTTP2_DEFAULT_SETTINGS,
  HTTP2_PREFACE,
  type HTTP2DataFrame,
  HTTP2ErrorCode,
  type HTTP2Frame,
  HTTP2FrameFlags,
  type HTTP2FrameHeader,
  HTTP2FrameParser,
  HTTP2FrameType,
  type HTTP2GoAwayFrame,
  type HTTP2HeadersFrame,
  type HTTP2PingFrame,
  type HTTP2SettingsFrame,
  HTTP2SettingsParameter,
  type HTTP2WindowUpdateFrame,
} from "./http2_frames.ts";
import { HTTP2Stream, HTTP2StreamState } from "./http2_stream.ts";
import { HPACKCodec } from "./http2_hpack.ts";

/**
 * HTTP/2 connection configuration
 */
export interface HTTP2ConnectionConfig {
  /**
   * Maximum concurrent streams
   */
  maxConcurrentStreams?: number;

  /**
   * Initial window size for flow control
   */
  initialWindowSize?: number;

  /**
   * Maximum frame size
   */
  maxFrameSize?: number;

  /**
   * Maximum header list size
   */
  maxHeaderListSize?: number;

  /**
   * Enable server push
   */
  enablePush?: boolean;

  /**
   * Header table size for HPACK
   */
  headerTableSize?: number;

  /**
   * Connection timeout in milliseconds
   */
  connectionTimeout?: number;

  /**
   * Idle timeout in milliseconds
   */
  idleTimeout?: number;
}

/**
 * HTTP/2 connection statistics
 */
export interface HTTP2ConnectionStats {
  /**
   * Total streams created
   */
  streamsCreated: number;

  /**
   * Active streams
   */
  activeStreams: number;

  /**
   * Frames sent
   */
  framesSent: number;

  /**
   * Frames received
   */
  framesReceived: number;

  /**
   * Bytes sent
   */
  bytesSent: number;

  /**
   * Bytes received
   */
  bytesReceived: number;

  /**
   * Connection window size
   */
  connectionWindowSize: number;

  /**
   * Settings
   */
  settings: Map<HTTP2SettingsParameter, number>;
}

/**
 * Base HTTP/2 connection
 */
export abstract class HTTP2Connection {
  protected conn: Deno.Conn;
  protected hpack = new HPACKCodec();
  protected streams = new Map<number, HTTP2Stream>();
  protected nextStreamId: number;
  protected connectionWindowSize = 65535;
  protected remoteSettings = new Map<HTTP2SettingsParameter, number>(HTTP2_DEFAULT_SETTINGS);
  protected localSettings = new Map<HTTP2SettingsParameter, number>();
  protected config: Required<HTTP2ConnectionConfig>;
  protected closed = false;
  protected pendingFrames: HTTP2Frame[] = [];

  // Statistics
  protected stats = {
    streamsCreated: 0,
    activeStreams: 0,
    framesSent: 0,
    framesReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
  };

  constructor(conn: Deno.Conn, config: HTTP2ConnectionConfig = {}) {
    this.conn = conn;
    this.config = {
      maxConcurrentStreams: config.maxConcurrentStreams ?? 100,
      initialWindowSize: config.initialWindowSize ?? 65535,
      maxFrameSize: config.maxFrameSize ?? 16384,
      maxHeaderListSize: config.maxHeaderListSize ?? 8192,
      enablePush: config.enablePush ?? true,
      headerTableSize: config.headerTableSize ?? 4096,
      connectionTimeout: config.connectionTimeout ?? 30000,
      idleTimeout: config.idleTimeout ?? 300000,
    };

    // Initialize local settings
    this.localSettings.set(HTTP2SettingsParameter.HEADER_TABLE_SIZE, this.config.headerTableSize);
    this.localSettings.set(HTTP2SettingsParameter.ENABLE_PUSH, this.config.enablePush ? 1 : 0);
    this.localSettings.set(
      HTTP2SettingsParameter.MAX_CONCURRENT_STREAMS,
      this.config.maxConcurrentStreams,
    );
    this.localSettings.set(
      HTTP2SettingsParameter.INITIAL_WINDOW_SIZE,
      this.config.initialWindowSize,
    );
    this.localSettings.set(HTTP2SettingsParameter.MAX_FRAME_SIZE, this.config.maxFrameSize);
    this.localSettings.set(
      HTTP2SettingsParameter.MAX_HEADER_LIST_SIZE,
      this.config.maxHeaderListSize,
    );

    // Client streams are odd, server streams are even
    this.nextStreamId = 1;
  }

  /**
   * Send a frame
   */
  protected async sendFrame(frame: HTTP2Frame): Promise<void> {
    if (this.closed) {
      throw new Error("Connection closed");
    }

    const bytes = HTTP2FrameParser.serializeFrame(frame);
    await this.conn.write(bytes);

    this.stats.framesSent++;
    this.stats.bytesSent += bytes.length;
  }

  /**
   * Read a frame
   */
  protected async readFrame(): Promise<HTTP2Frame | null> {
    if (this.closed) {
      return null;
    }

    // Read frame header (9 bytes)
    const headerBuffer = new Uint8Array(9);
    const headerRead = await this.conn.read(headerBuffer);

    if (headerRead === null || headerRead === 0) {
      return null;
    }

    const header = HTTP2FrameParser.parseFrameHeader(headerBuffer);

    // Read frame payload
    const payload = new Uint8Array(header.length);
    if (header.length > 0) {
      let offset = 0;
      while (offset < header.length) {
        const n = await this.conn.read(payload.subarray(offset));
        if (n === null) {
          throw new Error("Unexpected end of stream");
        }
        offset += n;
      }
    }

    this.stats.framesReceived++;
    this.stats.bytesReceived += 9 + header.length;

    return { header, payload };
  }

  /**
   * Handle incoming frame
   */
  protected async handleFrame(frame: HTTP2Frame): Promise<void> {
    // Connection-level frames (stream 0)
    if (frame.header.streamId === 0) {
      switch (frame.header.type) {
        case HTTP2FrameType.SETTINGS:
          await this.handleSettings(HTTP2FrameParser.parseSettingsFrame(frame));
          break;

        case HTTP2FrameType.PING:
          await this.handlePing(frame as HTTP2PingFrame);
          break;

        case HTTP2FrameType.GOAWAY:
          await this.handleGoAway(frame as HTTP2GoAwayFrame);
          break;

        case HTTP2FrameType.WINDOW_UPDATE:
          await this.handleConnectionWindowUpdate(HTTP2FrameParser.parseWindowUpdateFrame(frame));
          break;

        default:
          // Ignore unknown frame types on stream 0
          break;
      }
    } else {
      // Stream-level frames
      let stream = this.streams.get(frame.header.streamId);

      if (!stream) {
        // Create new stream for incoming requests
        stream = new HTTP2Stream(frame.header.streamId, false);
        this.streams.set(frame.header.streamId, stream);
        this.stats.streamsCreated++;
        this.stats.activeStreams++;
      }

      stream.processFrame(frame);

      // Decode headers if this is a HEADERS frame
      if (frame.header.type === HTTP2FrameType.HEADERS) {
        const headersFrame = HTTP2FrameParser.parseHeadersFrame(frame);
        const headers = this.hpack.decode(headersFrame.headerBlockFragment);
        stream.setReceivedHeaders(headers);
      }

      // Clean up closed streams
      if (stream.isClosed()) {
        this.streams.delete(frame.header.streamId);
        this.stats.activeStreams--;
      }
    }
  }

  /**
   * Handle SETTINGS frame
   */
  protected async handleSettings(frame: HTTP2SettingsFrame): Promise<void> {
    if (frame.header.flags & HTTP2FrameFlags.ACK) {
      // ACK for our SETTINGS, nothing to do
      return;
    }

    // Update remote settings
    for (const [id, value] of frame.settings.entries()) {
      this.remoteSettings.set(id, value);

      // Apply settings
      switch (id) {
        case HTTP2SettingsParameter.INITIAL_WINDOW_SIZE: {
          const delta = value - 65535;
          for (const stream of this.streams.values()) {
            stream.updateLocalWindow(delta);
          }
          break;
        }

        case HTTP2SettingsParameter.HEADER_TABLE_SIZE:
          // HPACK encoder will use this for dynamic table size
          break;

        default:
          // Other settings are advisory
          break;
      }
    }

    // Send ACK
    const ackFrame = HTTP2FrameParser.createSettingsFrame(new Map(), true);
    await this.sendFrame(ackFrame);
  }

  /**
   * Handle PING frame
   */
  protected async handlePing(frame: HTTP2PingFrame): Promise<void> {
    if (!(frame.header.flags & HTTP2FrameFlags.ACK)) {
      // Echo the ping back
      const pongFrame: HTTP2PingFrame = {
        header: {
          length: 8,
          type: HTTP2FrameType.PING,
          flags: HTTP2FrameFlags.ACK,
          streamId: 0,
        },
        payload: frame.payload,
        opaqueData: frame.opaqueData,
      };
      await this.sendFrame(pongFrame);
    }
  }

  /**
   * Handle GOAWAY frame
   */
  protected async handleGoAway(frame: HTTP2GoAwayFrame): Promise<void> {
    // Close connection gracefully
    this.closed = true;
  }

  /**
   * Handle connection-level WINDOW_UPDATE
   */
  protected async handleConnectionWindowUpdate(frame: HTTP2WindowUpdateFrame): Promise<void> {
    this.connectionWindowSize += frame.windowSizeIncrement;
  }

  /**
   * Send SETTINGS frame
   */
  protected async sendSettings(): Promise<void> {
    const frame = HTTP2FrameParser.createSettingsFrame(this.localSettings);
    await this.sendFrame(frame);
  }

  /**
   * Send GOAWAY frame
   */
  protected async sendGoAway(errorCode: HTTP2ErrorCode = HTTP2ErrorCode.NO_ERROR): Promise<void> {
    const lastStreamId = Math.max(...Array.from(this.streams.keys()), 0);
    const payload = new Uint8Array(8);

    // Last stream ID
    payload[0] = (lastStreamId >> 24) & 0x7f;
    payload[1] = (lastStreamId >> 16) & 0xff;
    payload[2] = (lastStreamId >> 8) & 0xff;
    payload[3] = lastStreamId & 0xff;

    // Error code
    payload[4] = (errorCode >> 24) & 0xff;
    payload[5] = (errorCode >> 16) & 0xff;
    payload[6] = (errorCode >> 8) & 0xff;
    payload[7] = errorCode & 0xff;

    const frame: HTTP2GoAwayFrame = {
      header: {
        length: 8,
        type: HTTP2FrameType.GOAWAY,
        flags: HTTP2FrameFlags.NONE,
        streamId: 0,
      },
      payload,
      lastStreamId,
      errorCode,
      debugData: new Uint8Array(0),
    };

    await this.sendFrame(frame);
  }

  /**
   * Get connection statistics
   */
  getStats(): HTTP2ConnectionStats {
    return {
      streamsCreated: this.stats.streamsCreated,
      activeStreams: this.stats.activeStreams,
      framesSent: this.stats.framesSent,
      framesReceived: this.stats.framesReceived,
      bytesSent: this.stats.bytesSent,
      bytesReceived: this.stats.bytesReceived,
      connectionWindowSize: this.connectionWindowSize,
      settings: new Map(this.localSettings),
    };
  }

  /**
   * Get underlying connection
   */
  getConnection(): Deno.Conn {
    return this.conn;
  }

  /**
   * Get HPACK codec
   */
  getHPACK(): HPACKCodec {
    return this.hpack;
  }

  /**
   * Get all streams (returns copy)
   */
  getStreams(): Map<number, HTTP2Stream> {
    return new Map(this.streams);
  }

  /**
   * Get next stream ID
   */
  getNextStreamId(): number {
    return this.nextStreamId;
  }

  /**
   * Get connection window size
   */
  getConnectionWindowSize(): number {
    return this.connectionWindowSize;
  }

  /**
   * Get remote settings (returns copy)
   */
  getRemoteSettings(): Map<HTTP2SettingsParameter, number> {
    return new Map(this.remoteSettings);
  }

  /**
   * Get local settings (returns copy)
   */
  getLocalSettings(): Map<HTTP2SettingsParameter, number> {
    return new Map(this.localSettings);
  }

  /**
   * Get configuration
   */
  getConfig(): Required<HTTP2ConnectionConfig> {
    return this.config;
  }

  /**
   * Check if connection is closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Get pending frames (returns copy)
   */
  getPendingFrames(): HTTP2Frame[] {
    return [...this.pendingFrames];
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    await this.sendGoAway();
    this.closed = true;
    this.conn.close();
  }
}

/**
 * HTTP/2 client
 */
export class HTTP2Client extends HTTP2Connection {
  constructor(conn: Deno.Conn, config?: HTTP2ConnectionConfig) {
    super(conn, config);
    this.nextStreamId = 1; // Client uses odd stream IDs
  }

  /**
   * Perform HTTP/2 connection setup
   */
  async connect(): Promise<void> {
    // Send connection preface
    await this.conn.write(HTTP2_PREFACE);
    this.stats.bytesSent += HTTP2_PREFACE.length;

    // Send initial SETTINGS
    await this.sendSettings();

    // Wait for server SETTINGS
    const frame = await this.readFrame();
    if (!frame) {
      throw new Error("Failed to receive SETTINGS from server");
    }

    if (frame.header.type !== HTTP2FrameType.SETTINGS) {
      throw new Error(`Expected SETTINGS, got ${frame.header.type}`);
    }

    await this.handleFrame(frame);
  }

  /**
   * Send HTTP request
   */
  async sendRequest(request: HTTPRequest): Promise<HTTPResponse> {
    if (this.closed) {
      throw new Error("Connection closed");
    }

    // Allocate stream ID
    const streamId = this.nextStreamId;
    this.nextStreamId += 2;

    // Create stream
    const stream = new HTTP2Stream(streamId, true);
    this.streams.set(streamId, stream);
    this.stats.streamsCreated++;
    this.stats.activeStreams++;

    // Convert request to HTTP/2 headers
    const headers = new Map<string, string>();

    // Pseudo-headers
    headers.set(":method", request.method);
    headers.set(":scheme", new URL(request.uri).protocol.replace(":", ""));
    headers.set(":authority", request.headers["host"] || new URL(request.uri).host);
    headers.set(":path", new URL(request.uri).pathname + new URL(request.uri).search);

    // Regular headers
    for (const [name, value] of Object.entries(request.headers)) {
      if (name.toLowerCase() !== "host" && name.toLowerCase() !== "connection") {
        headers.set(name.toLowerCase(), value);
      }
    }

    // Encode headers with HPACK
    const headerBlock = this.hpack.encode(headers);

    // Send HEADERS frame
    const hasBody = request.body && request.body.length > 0;
    const headersFrame = HTTP2FrameParser.createHeadersFrame(
      streamId,
      headerBlock,
      !hasBody, // END_STREAM if no body
      true, // END_HEADERS
    );
    await this.sendFrame(headersFrame);
    stream.sendHeaders(!hasBody);

    // Send DATA frames if body exists
    if (hasBody && request.body) {
      const maxFrameSize = this.remoteSettings.get(HTTP2SettingsParameter.MAX_FRAME_SIZE) || 16384;
      let offset = 0;

      while (offset < request.body.length) {
        const chunkSize = Math.min(maxFrameSize, request.body.length - offset);
        const chunk = request.body.slice(offset, offset + chunkSize);
        const isLast = offset + chunkSize >= request.body.length;

        const dataFrame = HTTP2FrameParser.createDataFrame(streamId, chunk, isLast);
        await this.sendFrame(dataFrame);
        stream.sendData(chunk.length, isLast);

        offset += chunkSize;
      }
    }

    // Wait for response
    while (!stream.isClosed() && !stream.areHeadersComplete()) {
      const frame = await this.readFrame();
      if (!frame) {
        throw new Error("Connection closed while waiting for response");
      }
      await this.handleFrame(frame);
    }

    // Continue reading until stream is closed
    while (!stream.isClosed()) {
      const frame = await this.readFrame();
      if (!frame) {
        break;
      }
      await this.handleFrame(frame);
    }

    // Convert response back to HTTP/1.1 format
    const responseHeaders = stream.getReceivedHeaders();
    const statusHeader = responseHeaders.get(":status");
    if (!statusHeader) {
      throw new Error("Response missing :status pseudo-header");
    }

    const statusCode = parseInt(statusHeader, 10);
    const headers1 = new Map<string, string>();

    for (const [name, value] of responseHeaders.entries()) {
      if (!name.startsWith(":")) {
        headers1.set(name, value);
      }
    }

    const response: HTTPResponse = {
      version: "2.0",
      statusCode,
      statusText: this.getStatusText(statusCode),
      headers: headers1 as any, // Convert Map to Record for HTTPResponse
      body: stream.getReceivedData(),
    };

    // Clean up stream
    this.streams.delete(streamId);
    this.stats.activeStreams--;

    return response;
  }

  /**
   * Get status text for status code
   */
  private getStatusText(statusCode: number): string {
    const statusTexts: Record<number, string> = {
      200: "OK",
      201: "Created",
      204: "No Content",
      301: "Moved Permanently",
      302: "Found",
      304: "Not Modified",
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      500: "Internal Server Error",
      502: "Bad Gateway",
      503: "Service Unavailable",
    };

    return statusTexts[statusCode] || "Unknown";
  }
}

/**
 * HTTP/2 server
 */
export class HTTP2Server extends HTTP2Connection {
  constructor(conn: Deno.Conn, config?: HTTP2ConnectionConfig) {
    super(conn, config);
    this.nextStreamId = 2; // Server uses even stream IDs
  }

  /**
   * Accept HTTP/2 connection
   */
  async accept(): Promise<void> {
    // Read connection preface
    const prefaceBuffer = new Uint8Array(HTTP2_PREFACE.length);
    const n = await this.conn.read(prefaceBuffer);

    if (n === null || n !== HTTP2_PREFACE.length) {
      throw new Error("Invalid connection preface");
    }

    // Verify preface
    for (let i = 0; i < HTTP2_PREFACE.length; i++) {
      if (prefaceBuffer[i] !== HTTP2_PREFACE[i]) {
        throw new Error("Invalid connection preface");
      }
    }

    this.stats.bytesReceived += HTTP2_PREFACE.length;

    // Send initial SETTINGS
    await this.sendSettings();

    // Wait for client SETTINGS
    const frame = await this.readFrame();
    if (!frame) {
      throw new Error("Failed to receive SETTINGS from client");
    }

    if (frame.header.type !== HTTP2FrameType.SETTINGS) {
      throw new Error(`Expected SETTINGS, got ${frame.header.type}`);
    }

    await this.handleFrame(frame);
  }

  /**
   * Read incoming request
   */
  async readRequest(): Promise<HTTPRequest | null> {
    if (this.closed) {
      return null;
    }

    // Process frames until we get a complete request
    while (true) {
      const frame = await this.readFrame();
      if (!frame) {
        return null;
      }

      await this.handleFrame(frame);

      // Check if any stream has complete headers
      for (const [streamId, stream] of this.streams.entries()) {
        if (stream.areHeadersComplete()) {
          // Convert to HTTP/1.1 request
          const headers = stream.getReceivedHeaders();

          const method = headers.get(":method") || "GET";
          const scheme = headers.get(":scheme") || "https";
          const authority = headers.get(":authority") || "localhost";
          const path = headers.get(":path") || "/";

          const url = `${scheme}://${authority}${path}`;

          const headers1 = new Map<string, string>();
          headers1.set("host", authority);

          for (const [name, value] of headers.entries()) {
            if (!name.startsWith(":")) {
              headers1.set(name, value);
            }
          }

          // Wait for body if not END_STREAM
          if (stream.canReceive()) {
            while (!stream.isClosed()) {
              const bodyFrame = await this.readFrame();
              if (!bodyFrame) {
                break;
              }
              await this.handleFrame(bodyFrame);
            }
          }

          const body = stream.getReceivedData();

          const request: HTTPRequest = {
            method: method as any, // Type cast for HTTPMethod
            uri: url,
            version: "2.0",
            headers: headers1 as any, // Convert Map to Record for HTTPRequest
            body: body.length > 0 ? body : undefined,
          };

          return request;
        }
      }
    }
  }

  /**
   * Send HTTP response
   */
  async sendResponse(streamId: number, response: HTTPResponse): Promise<void> {
    if (this.closed) {
      throw new Error("Connection closed");
    }

    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    // Convert response to HTTP/2 headers
    const headers = new Map<string, string>();

    // Pseudo-header
    headers.set(":status", response.statusCode.toString());

    // Regular headers
    for (const [name, value] of Object.entries(response.headers)) {
      if (name.toLowerCase() !== "connection") {
        headers.set(name.toLowerCase(), value);
      }
    }

    // Encode headers with HPACK
    const headerBlock = this.hpack.encode(headers);

    // Send HEADERS frame
    const hasBody = response.body && response.body.length > 0;
    const headersFrame = HTTP2FrameParser.createHeadersFrame(
      streamId,
      headerBlock,
      !hasBody, // END_STREAM if no body
      true, // END_HEADERS
    );
    await this.sendFrame(headersFrame);
    stream.sendHeaders(!hasBody);

    // Send DATA frames if body exists
    if (hasBody && response.body) {
      const maxFrameSize = this.remoteSettings.get(HTTP2SettingsParameter.MAX_FRAME_SIZE) || 16384;
      let offset = 0;

      while (offset < response.body.length) {
        const chunkSize = Math.min(maxFrameSize, response.body.length - offset);
        const chunk = response.body.slice(offset, offset + chunkSize);
        const isLast = offset + chunkSize >= response.body.length;

        const dataFrame = HTTP2FrameParser.createDataFrame(streamId, chunk, isLast);
        await this.sendFrame(dataFrame);
        stream.sendData(chunk.length, isLast);

        offset += chunkSize;
      }
    }

    // Clean up stream
    this.streams.delete(streamId);
    this.stats.activeStreams--;
  }
}

/**
 * Create HTTP/2 client connection
 */
export async function createHTTP2Client(
  hostname: string,
  port: number,
  config?: HTTP2ConnectionConfig,
): Promise<HTTP2Client> {
  const conn = await Deno.connectTls({
    hostname,
    port,
    alpnProtocols: ["h2"],
  });

  const client = new HTTP2Client(conn, config);
  await client.connect();

  return client;
}

/**
 * Create HTTP/2 server
 */
export async function createHTTP2Server(
  listener: Deno.Listener,
  config?: HTTP2ConnectionConfig,
): Promise<HTTP2Server> {
  const conn = await listener.accept() as Deno.TcpConn;

  // Upgrade to TLS with ALPN
  const tlsConn = await Deno.startTls(conn, {
    alpnProtocols: ["h2"],
  });

  const server = new HTTP2Server(tlsConn, config);
  await server.accept();

  return server;
}
