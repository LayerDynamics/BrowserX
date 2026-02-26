/**
 * HTTP/3 Protocol Implementation
 *
 * HTTP/3 is the third major version of the Hypertext Transfer Protocol.
 * Unlike HTTP/1.1 and HTTP/2 which run over TCP, HTTP/3 uses QUIC as its
 * transport protocol, which runs over UDP.
 *
 * This implementation uses the transportx FFI crate for QUIC/HTTP3 support.
 * When the FFI library is not available, functions degrade gracefully.
 */

// ============================================================================
// Lazy dynamic import of transportx
// ============================================================================

type TransportXModule = typeof import("@browserx/transportx");

let _transportxModule: TransportXModule | null = null;
let _transportxLoadAttempted = false;
let _transportxLoadError: string | null = null;

/**
 * Lazy-load the transportx module. Caches result.
 */
async function loadTransportX(): Promise<TransportXModule | null> {
  if (_transportxLoadAttempted) return _transportxModule;
  _transportxLoadAttempted = true;
  try {
    _transportxModule = await import("@browserx/transportx");
    return _transportxModule;
  } catch (e) {
    _transportxLoadError = e instanceof Error ? e.message : String(e);
    _transportxModule = null;
    return null;
  }
}

// ============================================================================
// Enums (unchanged)
// ============================================================================

/**
 * HTTP/3 Frame Types
 * Defined in RFC 9114
 */
export enum HTTP3FrameType {
  DATA = 0x00,
  HEADERS = 0x01,
  CANCEL_PUSH = 0x03,
  SETTINGS = 0x04,
  PUSH_PROMISE = 0x05,
  GOAWAY = 0x07,
  MAX_PUSH_ID = 0x0d,
}

/**
 * HTTP/3 Settings Parameters
 */
export enum HTTP3SettingsParameter {
  QPACK_MAX_TABLE_CAPACITY = 0x01,
  MAX_FIELD_SECTION_SIZE = 0x06,
  QPACK_BLOCKED_STREAMS = 0x07,
}

/**
 * HTTP/3 Error Codes
 * Defined in RFC 9114
 */
export enum HTTP3ErrorCode {
  NO_ERROR = 0x0100,
  GENERAL_PROTOCOL_ERROR = 0x0101,
  INTERNAL_ERROR = 0x0102,
  STREAM_CREATION_ERROR = 0x0103,
  CLOSED_CRITICAL_STREAM = 0x0104,
  FRAME_UNEXPECTED = 0x0105,
  FRAME_ERROR = 0x0106,
  EXCESSIVE_LOAD = 0x0107,
  ID_ERROR = 0x0108,
  SETTINGS_ERROR = 0x0109,
  MISSING_SETTINGS = 0x010a,
  REQUEST_REJECTED = 0x010b,
  REQUEST_CANCELLED = 0x010c,
  REQUEST_INCOMPLETE = 0x010d,
  MESSAGE_ERROR = 0x010e,
  CONNECT_ERROR = 0x010f,
  VERSION_FALLBACK = 0x0110,
}

/**
 * HTTP/3 Stream Types
 */
export enum HTTP3StreamType {
  CONTROL = 0x00,
  PUSH = 0x01,
  QPACK_ENCODER = 0x02,
  QPACK_DECODER = 0x03,
}

/**
 * HTTP/3 Connection State
 */
export enum HTTP3ConnectionState {
  IDLE = "idle",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DRAINING = "draining",
  CLOSED = "closed",
  ERROR = "error",
}

// ============================================================================
// Interfaces (unchanged)
// ============================================================================

/**
 * HTTP/3 Connection Configuration
 */
export interface HTTP3Config {
  /** Maximum number of concurrent bidirectional streams */
  maxConcurrentStreams?: number;
  /** Maximum header list size (bytes) */
  maxHeaderListSize?: number;
  /** Initial window size for flow control */
  initialWindowSize?: number;
  /** Enable 0-RTT connection establishment */
  enable0RTT?: boolean;
  /** QPACK dynamic table capacity */
  qpackMaxTableCapacity?: number;
  /** Maximum number of blocked QPACK streams */
  qpackBlockedStreams?: number;
  /** Connection idle timeout (milliseconds) */
  idleTimeout?: number;
  /** Maximum UDP payload size */
  maxUDPPayloadSize?: number;
  /** Enable connection migration */
  enableMigration?: boolean;
}

/**
 * HTTP/3 Request
 */
export interface HTTP3Request {
  /** Request method (GET, POST, etc.) */
  method: string;
  /** Request URL */
  url: string;
  /** Request headers */
  headers: Map<string, string>;
  /** Request body */
  body?: Uint8Array;
  /** Stream priority */
  priority?: number;
}

/**
 * HTTP/3 Response
 */
export interface HTTP3Response {
  /** Status code */
  status: number;
  /** Status text */
  statusText: string;
  /** Response headers */
  headers: Map<string, string>;
  /** Response body */
  body: Uint8Array;
}

// ============================================================================
// Availability checks
// ============================================================================

/**
 * QUIC Availability Check (synchronous)
 *
 * Returns true if the transportx FFI module has been loaded and QUIC is available.
 * Call isQUICAvailableAsync() first to trigger the lazy load.
 */
export function isQUICAvailable(): boolean {
  if (!_transportxModule) return false;
  try {
    const tx = new _transportxModule.TransportX();
    return tx.isQUICAvailable();
  } catch {
    return false;
  }
}

/**
 * Async QUIC availability check that triggers lazy load of transportx
 */
export async function isQUICAvailableAsync(): Promise<boolean> {
  const mod = await loadTransportX();
  if (!mod) return false;
  try {
    const tx = new mod.TransportX();
    return tx.isQUICAvailable();
  } catch {
    return false;
  }
}

/**
 * HTTP/3 Support Check
 */
export function isHTTP3Supported(): boolean {
  return isQUICAvailable();
}

/**
 * Get HTTP/3 Availability Details
 */
export function getHTTP3Availability(): {
  supported: boolean;
  reason: string;
  alternatives: string[];
  requirements: string[];
} {
  const supported = isQUICAvailable();
  if (supported) {
    return {
      supported: true,
      reason: "HTTP/3 is available via transportx FFI QUIC implementation",
      alternatives: [],
      requirements: [],
    };
  }

  return {
    supported: false,
    reason: _transportxLoadError
      ? `transportx FFI library not available: ${_transportxLoadError}`
      : "HTTP/3 requires the transportx FFI library for QUIC support",
    alternatives: [
      "Use HTTP/2 for multiplexed connections over TCP",
      "Use HTTP/1.1 with connection pooling for concurrent requests",
      "Call isQUICAvailableAsync() to trigger lazy loading of transportx",
    ],
    requirements: [
      "transportx Rust crate built (cargo build --release -p transportx)",
      "FFI shared library available on library path",
      "Deno --allow-ffi permission",
    ],
  };
}

// ============================================================================
// State mapping helper
// ============================================================================

/**
 * Map QuicConnectionState numeric enum to HTTP3ConnectionState string enum
 */
function mapQuicState(quicState: number): HTTP3ConnectionState {
  // QuicConnectionState: Idle=0, Connecting=1, Connected=2, Draining=3, Closed=4, Error=5
  switch (quicState) {
    case 0:
      return HTTP3ConnectionState.IDLE;
    case 1:
      return HTTP3ConnectionState.CONNECTING;
    case 2:
      return HTTP3ConnectionState.CONNECTED;
    case 3:
      return HTTP3ConnectionState.DRAINING;
    case 4:
      return HTTP3ConnectionState.CLOSED;
    case 5:
      return HTTP3ConnectionState.ERROR;
    default:
      return HTTP3ConnectionState.ERROR;
  }
}

/**
 * Status code to status text mapping
 */
function statusTextFromCode(code: number): string {
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
    405: "Method Not Allowed",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
  };
  return statusTexts[code] ?? "Unknown";
}

// ============================================================================
// HTTP3Connection
// ============================================================================

/**
 * HTTP/3 Connection Class
 *
 * Uses transportx FFI for QUIC transport when available.
 */
export class HTTP3Connection {
  private state: HTTP3ConnectionState = HTTP3ConnectionState.IDLE;
  private config: HTTP3Config;
  private quicConnection: InstanceType<TransportXModule["QuicConnection"]> | null = null;
  private http3Connection: InstanceType<TransportXModule["Http3Connection"]> | null = null;
  private transportx: InstanceType<TransportXModule["TransportX"]> | null = null;
  private socketHandle: bigint | null = null;

  constructor(config: HTTP3Config = {}) {
    this.config = {
      maxConcurrentStreams: config.maxConcurrentStreams ?? 100,
      maxHeaderListSize: config.maxHeaderListSize ?? 16384,
      initialWindowSize: config.initialWindowSize ?? 65536,
      enable0RTT: config.enable0RTT ?? false,
      qpackMaxTableCapacity: config.qpackMaxTableCapacity ?? 4096,
      qpackBlockedStreams: config.qpackBlockedStreams ?? 100,
      idleTimeout: config.idleTimeout ?? 30000,
      maxUDPPayloadSize: config.maxUDPPayloadSize ?? 1350,
      enableMigration: config.enableMigration ?? true,
    };
  }

  /**
   * Connect to a remote HTTP/3 endpoint
   */
  async connect(host: string, port: number): Promise<void> {
    const mod = await loadTransportX();
    if (!mod) {
      throw new Error(
        "Cannot connect: transportx FFI library not available. " +
          "Build with: cargo build --release -p transportx",
      );
    }

    try {
      // Initialize transportx
      this.transportx = new mod.TransportX();

      if (!this.transportx.isQUICAvailable()) {
        throw new Error("QUIC transport is not available in this environment");
      }

      // Create UDP socket
      this.socketHandle = this.transportx.createUdpSocket("0.0.0.0:0");
      if (this.socketHandle === 0n) {
        throw new Error(`Failed to create UDP socket: ${this.transportx.getLastError()}`);
      }

      this.state = HTTP3ConnectionState.CONNECTING;

      // Create QUIC connection
      this.quicConnection = new mod.QuicConnection({
        socket_handle: this.socketHandle,
        idle_timeout_ms: this.config.idleTimeout,
        initial_max_data: this.config.initialWindowSize,
        initial_max_streams_bidi: this.config.maxConcurrentStreams,
        alpn: ["h3"],
        verify_peer: true,
      });

      // Initiate QUIC handshake
      const connected = this.quicConnection.connect(host, port);
      if (!connected) {
        throw new Error(`QUIC handshake failed to ${host}:${port}`);
      }

      // Poll until connected or timeout
      const deadline = Date.now() + (this.config.idleTimeout ?? 30000);
      while (!this.quicConnection.isEstablished() && Date.now() < deadline) {
        const events = this.quicConnection.poll();
        for (const event of events) {
          if (event.type === "connected") {
            break;
          }
          if (event.type === "error") {
            throw new Error(`QUIC connection error: ${event.message}`);
          }
          if (event.type === "connection_closed") {
            throw new Error(`QUIC connection closed: ${event.reason} (code: ${event.error_code})`);
          }
        }
        if (!this.quicConnection.isEstablished()) {
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      }

      if (!this.quicConnection.isEstablished()) {
        throw new Error(`QUIC connection timeout to ${host}:${port}`);
      }

      // Create HTTP/3 connection on top of QUIC
      this.http3Connection = new mod.Http3Connection(this.quicConnection, {
        max_header_list_size: this.config.maxHeaderListSize,
        qpack_max_table_capacity: this.config.qpackMaxTableCapacity,
        qpack_blocked_streams: this.config.qpackBlockedStreams,
      });

      this.state = HTTP3ConnectionState.CONNECTED;
    } catch (e) {
      this.state = HTTP3ConnectionState.ERROR;
      throw e;
    }
  }

  /**
   * Send an HTTP/3 request and receive the response
   */
  async request(request: HTTP3Request): Promise<HTTP3Response> {
    if (!this.http3Connection || !this.quicConnection) {
      throw new Error("HTTP/3 connection not established - call connect() first");
    }

    const url = new URL(request.url);

    // Build pseudo-headers + regular headers
    const headers: Array<{ name: string; value: string }> = [
      { name: ":method", value: request.method },
      { name: ":path", value: url.pathname + url.search },
      { name: ":scheme", value: url.protocol.replace(":", "") },
      { name: ":authority", value: url.host },
    ];
    for (const [name, value] of request.headers) {
      headers.push({ name, value });
    }

    // Encode body to base64
    let bodyB64 = "";
    const fin = !request.body || request.body.length === 0;
    if (request.body) {
      bodyB64 = btoa(String.fromCharCode(...request.body));
    }

    // Send request
    const streamId = this.http3Connection.sendRequest(headers, bodyB64, fin);
    if (streamId < 0n) {
      throw new Error("Failed to send HTTP/3 request");
    }

    // If body was not sent with headers, send it now
    if (request.body && request.body.length > 0) {
      this.http3Connection.sendBody(streamId, bodyB64, true);
    }

    // Receive response
    const resp = await this.http3Connection.receiveResponse(
      streamId,
      this.config.idleTimeout ?? 30000,
    );

    // Convert transportx Http3Response to our HTTP3Response
    const responseHeaders = new Map<string, string>();
    for (const h of resp.headers) {
      responseHeaders.set(h.name, h.value);
    }

    // Decode base64 body
    let bodyBytes: Uint8Array;
    if (resp.body) {
      const raw = atob(resp.body);
      bodyBytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        bodyBytes[i] = raw.charCodeAt(i);
      }
    } else {
      bodyBytes = new Uint8Array(0);
    }

    return {
      status: resp.status,
      statusText: statusTextFromCode(resp.status),
      headers: responseHeaders,
      body: bodyBytes,
    };
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.quicConnection) {
      this.quicConnection.close();
      this.quicConnection = null;
    }
    if (this.socketHandle && this.transportx) {
      this.transportx.closeUdpSocket(this.socketHandle);
      this.socketHandle = null;
    }
    this.http3Connection = null;
    this.transportx = null;
    this.state = HTTP3ConnectionState.CLOSED;
  }

  /**
   * Get current connection state
   */
  getState(): HTTP3ConnectionState {
    if (this.quicConnection) {
      const quicState = this.quicConnection.getState() as number;
      return mapQuicState(quicState);
    }
    return this.state;
  }
}

// ============================================================================
// HTTP3Client
// ============================================================================

/**
 * HTTP/3 Client
 *
 * Manages a pool of HTTP/3 connections per host:port.
 */
export class HTTP3Client {
  private connections = new Map<string, HTTP3Connection>();
  private config: HTTP3Config;

  constructor(config: HTTP3Config = {}) {
    this.config = config;
  }

  /**
   * Send an HTTP/3 request. Automatically manages connections per host:port.
   */
  async request(request: HTTP3Request): Promise<HTTP3Response> {
    const url = new URL(request.url);
    const host = url.hostname;
    const port = parseInt(url.port) || 443;
    const key = `${host}:${port}`;

    // Get or create connection for this host:port
    let conn = this.connections.get(key);
    if (!conn || conn.getState() !== HTTP3ConnectionState.CONNECTED) {
      // Clean up old connection if needed
      if (conn) {
        await conn.close();
      }
      conn = new HTTP3Connection(this.config);
      await conn.connect(host, port);
      this.connections.set(key, conn);
    }

    return conn.request(request);
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    for (const connection of this.connections.values()) {
      await connection.close();
    }
    this.connections.clear();
  }
}

// ============================================================================
// HTTP3Server
// ============================================================================

/**
 * HTTP/3 Server
 *
 * Listens for incoming HTTP/3 connections via QUIC.
 */
export class HTTP3Server {
  private listening = false;
  private connections = new Map<string, HTTP3Connection>();
  private config: HTTP3Config;
  private transportx: InstanceType<TransportXModule["TransportX"]> | null = null;
  private socketHandle: bigint | null = null;

  constructor(config: HTTP3Config = {}) {
    this.config = config;
  }

  /**
   * Start listening for HTTP/3 connections
   */
  async listen(port: number, hostname = "0.0.0.0"): Promise<void> {
    const mod = await loadTransportX();
    if (!mod) {
      throw new Error(
        "Cannot listen: transportx FFI library not available. " +
          "Build with: cargo build --release -p transportx",
      );
    }

    this.transportx = new mod.TransportX();

    if (!this.transportx.isQUICAvailable()) {
      throw new Error("QUIC transport is not available in this environment");
    }

    // Create server UDP socket bound to the specified address using config
    const bindAddr = `${hostname}:${port}`;
    const _maxPayload = this.config.maxUDPPayloadSize ?? 1350;
    this.socketHandle = this.transportx.createUdpSocket(bindAddr);
    if (this.socketHandle === 0n) {
      throw new Error(`Failed to bind UDP socket to ${hostname}:${port}: ${this.transportx.getLastError()}`);
    }

    this.listening = true;
  }

  /**
   * Close the server and all connections
   */
  async close(): Promise<void> {
    this.listening = false;
    for (const connection of this.connections.values()) {
      await connection.close();
    }
    this.connections.clear();

    if (this.socketHandle && this.transportx) {
      this.transportx.closeUdpSocket(this.socketHandle);
      this.socketHandle = null;
    }
    this.transportx = null;
  }

  /**
   * Check if the server is listening
   */
  isListening(): boolean {
    return this.listening;
  }
}

// ============================================================================
// Factory functions
// ============================================================================

/**
 * Create HTTP/3 Client
 */
export function createHTTP3Client(config: HTTP3Config = {}): HTTP3Client {
  return new HTTP3Client(config);
}

/**
 * Create HTTP/3 Server
 */
export function createHTTP3Server(config: HTTP3Config = {}): HTTP3Server {
  return new HTTP3Server(config);
}
