/**
 * TransportX TypeScript Wrapper
 *
 * Provides high-level API over transportx FFI bindings for QUIC and HTTP/3.
 */

import {
  // Library lifecycle
  transportx_init,
  transportx_version,
  transportx_get_last_error,

  // QUIC availability
  quic_is_available,

  // UDP socket
  udp_socket_create,
  udp_socket_close,

  // QUIC connection
  quic_connection_create,
  quic_connection_connect,
  quic_connection_poll,
  quic_connection_close,
  quic_connection_get_state,
  quic_connection_get_stats,
  quic_connection_is_established,
  quic_connection_is_closed,

  // QUIC streams
  quic_stream_send,
  quic_stream_recv,
  quic_stream_shutdown,
  quic_stream_capacity,
  quic_stream_finished,

  // HTTP/3
  http3_connection_create,
  http3_send_request,
  http3_poll,
  http3_send_response,
  http3_send_body,
  http3_get_settings,

  // Library lifecycle
  preload_lib,
  close_lib,
} from "./bindings/bindings.ts";

// ============================================================================
// Enums
// ============================================================================

/**
 * QUIC connection state (matches Rust ConnectionState)
 */
export enum QuicConnectionState {
  Idle = 0,
  Connecting = 1,
  Connected = 2,
  Draining = 3,
  Closed = 4,
  Error = 5,
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Configuration for creating a QUIC connection
 */
export interface QuicConnectionConfig {
  /** UDP socket handle to use */
  socket_handle: bigint;
  /** Idle timeout in milliseconds (default: 30000) */
  idle_timeout_ms?: number;
  /** Initial max data for the connection (flow control) */
  initial_max_data?: number;
  /** Initial max data per bidirectional stream */
  initial_max_stream_data_bidi_local?: number;
  /** Initial max data per remote bidirectional stream */
  initial_max_stream_data_bidi_remote?: number;
  /** Initial max data per unidirectional stream */
  initial_max_stream_data_uni?: number;
  /** Max concurrent bidirectional streams */
  initial_max_streams_bidi?: number;
  /** Max concurrent unidirectional streams */
  initial_max_streams_uni?: number;
  /** ALPN protocols (e.g., ["h3"]) */
  alpn?: string[];
  /** Whether to verify the peer certificate */
  verify_peer?: boolean;
}

/**
 * QUIC connection statistics
 */
export interface QuicStats {
  /** Bytes sent */
  sent_bytes: number;
  /** Bytes received */
  recv_bytes: number;
  /** Packets sent */
  sent_packets: number;
  /** Packets received */
  recv_packets: number;
  /** Packets lost */
  lost_packets: number;
  /** Round-trip time in milliseconds */
  rtt_ms: number;
  /** Congestion window size */
  cwnd: number;
}

/**
 * QUIC event from poll()
 */
export type QuicEvent =
  | { type: "connected" }
  | { type: "stream_readable"; stream_id: number }
  | { type: "stream_writable"; stream_id: number }
  | { type: "stream_finished"; stream_id: number }
  | { type: "stream_reset"; stream_id: number; error_code: number }
  | { type: "dgram_readable" }
  | { type: "connection_closed"; error_code: number; reason: string }
  | { type: "error"; message: string }
  | { type: "none" };

/**
 * HTTP/3 connection configuration
 */
export interface Http3Config {
  /** Max header list size */
  max_header_list_size?: number;
  /** QPACK max table capacity */
  qpack_max_table_capacity?: number;
  /** QPACK blocked streams */
  qpack_blocked_streams?: number;
}

/**
 * HTTP/3 header
 */
export interface Http3Header {
  name: string;
  value: string;
}

/**
 * HTTP/3 event from poll()
 */
export type Http3Event =
  | { type: "headers"; stream_id: number; headers: Http3Header[]; has_body: boolean }
  | { type: "data"; stream_id: number; data: string; len: number }
  | { type: "finished"; stream_id: number }
  | { type: "reset"; stream_id: number; error_code: number }
  | { type: "goaway"; stream_id: number }
  | { type: "error"; message: string }
  | { type: "none" };

/**
 * HTTP/3 response
 */
export interface Http3Response {
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers: Http3Header[];
  /** Response body (base64-encoded) */
  body: string;
}

/**
 * Stream receive result
 */
export interface StreamRecvResult {
  /** Received data (base64-encoded) */
  data: string;
  /** Whether the stream has ended */
  fin: boolean;
  /** Number of bytes received */
  len: number;
}

// ============================================================================
// TransportX Singleton
// ============================================================================

/**
 * TransportX library singleton - initialization and QUIC availability
 */
export class TransportX {
  private initialized = false;

  constructor() {
    const result = transportx_init();
    this.initialized = result === 1;
    if (!this.initialized) {
      throw new Error(`Failed to initialize transportx: ${this.getLastError()}`);
    }
  }

  /**
   * Get library version
   */
  get version(): string {
    return transportx_version();
  }

  /**
   * Get last error message (if any)
   */
  getLastError(): string {
    return transportx_get_last_error();
  }

  /**
   * Check if QUIC transport is available
   */
  isQUICAvailable(): boolean {
    return quic_is_available() === 1;
  }

  /**
   * Create a UDP socket bound to the given address
   * @param bindAddr - Address to bind (e.g., "0.0.0.0:0")
   * @returns Socket handle (0 on failure)
   */
  createUdpSocket(bindAddr: string): bigint {
    return udp_socket_create(bindAddr) as bigint;
  }

  /**
   * Close a UDP socket
   * @param handle - Socket handle
   */
  closeUdpSocket(handle: bigint): void {
    udp_socket_close(handle);
  }
}

// ============================================================================
// QuicConnection
// ============================================================================

/**
 * QUIC connection with stream support
 */
export class QuicConnection {
  private handle: bigint;
  private _closed = false;

  /**
   * Create a new QUIC connection
   * @param config - Connection configuration
   */
  constructor(config: QuicConnectionConfig) {
    const configJson = JSON.stringify({
      ...config,
      socket_handle: Number(config.socket_handle),
    });
    this.handle = quic_connection_create(configJson) as bigint;
    if (this.handle === 0n) {
      throw new Error(`Failed to create QUIC connection: ${transportx_get_last_error()}`);
    }
  }

  /**
   * Get the connection handle
   */
  getHandle(): bigint {
    return this.handle;
  }

  /**
   * Initiate QUIC handshake to host:port
   * @param host - Remote hostname
   * @param port - Remote port
   * @returns true on success
   */
  connect(host: string, port: number): boolean {
    return quic_connection_connect(this.handle, host, port) === 1;
  }

  /**
   * Poll the connection for events
   * @returns Array of QUIC events
   */
  poll(): QuicEvent[] {
    const json = quic_connection_poll(this.handle);
    if (!json) return [];
    try {
      return JSON.parse(json) as QuicEvent[];
    } catch {
      return [];
    }
  }

  /**
   * Close the connection gracefully
   * @param errorCode - Application error code (0 for normal close)
   * @param reason - Human-readable reason
   * @returns true on success
   */
  close(errorCode: bigint = 0n, reason: string = ""): boolean {
    if (this._closed) return true;
    const result = quic_connection_close(this.handle, errorCode, reason) === 1;
    if (result) this._closed = true;
    return result;
  }

  /**
   * Get current connection state
   */
  getState(): QuicConnectionState {
    return quic_connection_get_state(this.handle) as QuicConnectionState;
  }

  /**
   * Get connection statistics
   */
  getStats(): QuicStats {
    const json = quic_connection_get_stats(this.handle);
    try {
      return JSON.parse(json) as QuicStats;
    } catch {
      return {
        sent_bytes: 0,
        recv_bytes: 0,
        sent_packets: 0,
        recv_packets: 0,
        lost_packets: 0,
        rtt_ms: 0,
        cwnd: 0,
      };
    }
  }

  /**
   * Check if QUIC handshake is complete
   */
  isEstablished(): boolean {
    return quic_connection_is_established(this.handle) === 1;
  }

  /**
   * Check if connection is closed
   */
  isClosed(): boolean {
    return quic_connection_is_closed(this.handle) === 1;
  }

  // ── Stream Operations ──────────────────────────────────────────────────────

  /**
   * Send data on a QUIC stream
   * @param streamId - Stream ID
   * @param data - Base64-encoded data
   * @param fin - Whether this is the final data on the stream
   * @returns Bytes written, or -1 on error
   */
  sendStream(streamId: bigint, data: string, fin: boolean = false): number {
    return quic_stream_send(this.handle, streamId, data, fin ? 1 : 0) as number;
  }

  /**
   * Receive data from a QUIC stream
   * @param streamId - Stream ID
   * @returns Receive result with data, fin flag, and length
   */
  recvStream(streamId: bigint): StreamRecvResult | null {
    const json = quic_stream_recv(this.handle, streamId);
    if (!json) return null;
    try {
      return JSON.parse(json) as StreamRecvResult;
    } catch {
      return null;
    }
  }

  /**
   * Shutdown a stream direction
   * @param streamId - Stream ID
   * @param direction - 0=read, 1=write
   * @param errorCode - Application error code
   * @returns true on success
   */
  shutdownStream(streamId: bigint, direction: 0 | 1, errorCode: bigint = 0n): boolean {
    return quic_stream_shutdown(this.handle, streamId, direction, errorCode) === 1;
  }

  /**
   * Get stream send capacity in bytes
   * @param streamId - Stream ID
   * @returns Capacity in bytes, or -1 on error
   */
  streamCapacity(streamId: bigint): bigint {
    return quic_stream_capacity(this.handle, streamId) as bigint;
  }

  /**
   * Check if a stream is fully received (FIN + all data read)
   * @param streamId - Stream ID
   * @returns true if finished
   */
  streamFinished(streamId: bigint): boolean {
    return quic_stream_finished(this.handle, streamId) === 1;
  }
}

// ============================================================================
// Http3Connection
// ============================================================================

/**
 * HTTP/3 connection layered on top of a QUIC connection
 */
export class Http3Connection {
  private connHandle: bigint;
  private quicConnection: QuicConnection;

  /**
   * Create an HTTP/3 connection on top of an existing QUIC connection
   * @param quicConnection - The underlying QUIC connection
   * @param config - HTTP/3 configuration
   */
  constructor(quicConnection: QuicConnection, config: Http3Config = {}) {
    this.quicConnection = quicConnection;
    this.connHandle = quicConnection.getHandle();
    const configJson = JSON.stringify(config);
    const result = http3_connection_create(this.connHandle, configJson);
    if (result !== 1) {
      throw new Error(`Failed to create HTTP/3 connection: ${transportx_get_last_error()}`);
    }
  }

  /**
   * Send an HTTP/3 request
   * @param headers - Request headers (must include :method, :path, :scheme, :authority pseudo-headers)
   * @param body - Base64-encoded body (empty string for no body)
   * @param fin - true if the request has no body
   * @returns Stream ID (>= 0) or -1 on error
   */
  sendRequest(headers: Http3Header[], body: string = "", fin: boolean = true): bigint {
    const headersJson = JSON.stringify(headers);
    return http3_send_request(this.connHandle, headersJson, body, fin ? 1 : 0) as bigint;
  }

  /**
   * Poll for HTTP/3 events
   * @returns Array of HTTP/3 events
   */
  poll(): Http3Event[] {
    const json = http3_poll(this.connHandle);
    if (!json) return [];
    try {
      return JSON.parse(json) as Http3Event[];
    } catch {
      return [];
    }
  }

  /**
   * Receive a complete HTTP/3 response (async helper)
   * Polls until headers + body + finished are received for the given stream
   * @param streamId - Stream ID from sendRequest()
   * @param timeoutMs - Timeout in milliseconds (default: 30000)
   * @returns Complete HTTP/3 response
   */
  async receiveResponse(streamId: bigint, timeoutMs: number = 30000): Promise<Http3Response> {
    const startTime = Date.now();
    let status = 0;
    const headers: Http3Header[] = [];
    const bodyParts: string[] = [];
    let finished = false;

    while (!finished && (Date.now() - startTime) < timeoutMs) {
      // Drive QUIC layer to recv/send UDP packets
      this.quicConnection.poll();
      const events = this.poll();
      for (const event of events) {
        if (event.type === "headers" && BigInt(event.stream_id) === streamId) {
          for (const h of event.headers) {
            if (h.name === ":status") {
              status = parseInt(h.value, 10);
            } else {
              headers.push(h);
            }
          }
        } else if (event.type === "data" && BigInt(event.stream_id) === streamId) {
          bodyParts.push(event.data);
        } else if (event.type === "finished" && BigInt(event.stream_id) === streamId) {
          finished = true;
        } else if (event.type === "error") {
          throw new Error(`HTTP/3 error: ${event.message}`);
        } else if (event.type === "reset" && BigInt(event.stream_id) === streamId) {
          throw new Error(`HTTP/3 stream reset with error code ${event.error_code}`);
        }
      }

      if (!finished) {
        // Yield to event loop before next poll
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }

    if (!finished) {
      throw new Error(`HTTP/3 response timeout after ${timeoutMs}ms`);
    }

    // Decode each base64 chunk individually (concatenating base64 strings with
    // padding characters produces invalid base64), then re-encode as one string
    const decodedChunks = bodyParts.map((part) => atob(part));
    const totalLen = decodedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of decodedChunks) {
      for (let i = 0; i < chunk.length; i++) {
        combined[offset++] = chunk.charCodeAt(i);
      }
    }
    // Re-encode as single valid base64 string for consumers that expect base64
    const body = btoa(String.fromCharCode(...combined));

    return {
      status,
      headers,
      body,
    };
  }

  /**
   * Send an HTTP/3 response (server-side)
   * @param streamId - Stream ID
   * @param headers - Response headers
   * @param fin - true if no body follows
   * @returns true on success
   */
  sendResponse(streamId: bigint, headers: Http3Header[], fin: boolean = false): boolean {
    const headersJson = JSON.stringify(headers);
    return http3_send_response(this.connHandle, streamId, headersJson, fin ? 1 : 0) === 1;
  }

  /**
   * Send HTTP/3 body data
   * @param streamId - Stream ID
   * @param data - Base64-encoded body data
   * @param fin - true if this is the last body chunk
   * @returns true on success
   */
  sendBody(streamId: bigint, data: string, fin: boolean = true): boolean {
    return http3_send_body(this.connHandle, streamId, data, fin ? 1 : 0) === 1;
  }

  /**
   * Get HTTP/3 connection settings
   * @returns Settings object
   */
  getSettings(): Record<string, number> {
    const json = http3_get_settings(this.connHandle);
    try {
      return JSON.parse(json) as Record<string, number>;
    } catch {
      return {};
    }
  }
}

// Re-export library lifecycle functions
export { preload_lib, close_lib };
