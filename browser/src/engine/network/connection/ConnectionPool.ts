/**
 * Connection Pool Management
 *
 * Manages connection pooling and reuse for HTTP requests.
 * Implements per-origin connection limits and idle connection management.
 */

import type { ConnectionID, Port, ByteBuffer, FileDescriptor, ByteCount } from "../../../types/identifiers.ts";
import type { Certificate, PooledConnection, Socket, SocketStats, SocketReadOptions, SocketWriteOptions } from "../../../types/network.ts";
import { ConnectionState, SocketState } from "../../../types/network.ts";
import { AddressFamily, SocketImpl, SocketType } from "../primitives/Socket.ts";
import { type TCPConfig, TCPConnection } from "../primitives/TCPConnection.ts";
import { loadSystemCAs } from "../security/Certificate.ts";
import { TLSConnection } from "../security/TLSConnection.ts";
import { TLSSocket } from "../security/TLSSocket.ts";
import { ConnectionPoolStats, createConnectionPoolStats } from "./ConnectionPoolStats.ts";

/**
 * Socket wrapper around Deno.TlsConn for native TLS connections.
 * Uses Deno's built-in TLS with OS certificate store for reliable cert validation.
 */
class DenoTlsSocket implements Socket {
  private conn: Deno.TlsConn;
  private _state: SocketState = SocketState.OPEN;
  private _bytesRead: ByteCount = 0 as ByteCount;
  private _bytesWritten: ByteCount = 0 as ByteCount;
  private host: string;
  private port: Port;
  private sni: string;

  readonly fd: FileDescriptor = 0 as FileDescriptor;
  readonly localAddress: string = "0.0.0.0";
  readonly localPort: Port = 0 as Port;

  get state(): SocketState { return this._state; }
  get remoteAddress(): string { return this.host; }
  get remotePort(): Port { return this.port; }
  get serverName(): string { return this.sni; }

  constructor(conn: Deno.TlsConn, host: string, port: Port, sni: string) {
    this.conn = conn;
    this.host = host;
    this.port = port;
    this.sni = sni;
  }

  async connect(_host: string, _port: Port): Promise<void> {
    // Already connected via Deno.connectTls
  }

  async read(buffer: ByteBuffer, _options?: SocketReadOptions): Promise<number | null> {
    try {
      const n = await this.conn.read(buffer);
      if (n !== null) this._bytesRead = (this._bytesRead + n) as ByteCount;
      return n;
    } catch {
      this._state = SocketState.CLOSED;
      return null;
    }
  }

  async write(data: ByteBuffer, _options?: SocketWriteOptions): Promise<number> {
    try {
      const n = await this.conn.write(data);
      this._bytesWritten = (this._bytesWritten + n) as ByteCount;
      return n;
    } catch {
      this._state = SocketState.CLOSED;
      throw new Error("Socket write failed");
    }
  }

  async close(): Promise<void> {
    this._state = SocketState.CLOSED;
    try { this.conn.close(); } catch { /* already closed */ }
  }

  getStats(): SocketStats {
    const now = Date.now();
    return {
      bytesRead: this._bytesRead,
      bytesWritten: this._bytesWritten,
      readOperations: 0,
      writeOperations: 0,
      errors: 0,
      createdAt: now,
      lastActiveAt: now,
    } as unknown as SocketStats;
  }
}

const DEFAULT_TCP_CONFIG: TCPConfig = {
  connectTimeout: 30000, // 30 seconds
  idleTimeout: 60000, // 60 seconds
  keepAliveInterval: 75000, // 75 seconds
  keepAliveProbes: 9,
  sendBufferSize: 65536, // 64KB
  receiveBufferSize: 65536, // 64KB
  noDelay: true, // Disable Nagle's algorithm
  maxSegmentSize: 1460, // Standard MSS
  windowSize: 65535, // 64KB window
};

/** Default timeout for native TLS (Deno.connectTls) connections in ms */
const NATIVE_TLS_CONNECT_TIMEOUT_MS = 10_000;

/** Default timeout for custom TLS handshake fallback in ms */
const CUSTOM_TLS_HANDSHAKE_TIMEOUT_MS = 5_000;

/** Interval between automatic idle-connection cleanup sweeps in ms */
const AUTO_CLEANUP_INTERVAL_MS = 30_000;

export class ConnectionPool {
  private connections: Map<string, PooledConnection[]> = new Map();
  private maxConnectionsPerOrigin: number = 6;
  private maxIdleTime: number = 60000; // 60 seconds
  private stats: ConnectionPoolStats = createConnectionPoolStats();
  private nextConnectionId: number = 1;
  private cleanupInterval: number | null = null;
  // Track pending acquisitions to prevent race conditions
  private pendingAcquisitions: Map<string, number> = new Map();
  // Per-key mutex queue: each key has a chain of promises ensuring serial access
  private acquireMutex: Map<string, Promise<void>> = new Map();
  // Cached system CA certificates for TLS validation
  private systemCAs: Certificate[] | null = null;
  private systemCAsLoading: Promise<Certificate[]> | null = null;
  // Promise-based waiter queue for connection availability (replaces polling)
  private waiters: Map<string, Array<{ resolve: () => void; reject: (err: Error) => void; timer: number }>> = new Map();

  constructor() {
    // Start automatic cleanup of idle connections
    this.startAutoCleanup();
  }

  /**
   * Get system CA certificates (lazy-loaded and cached)
   */
  private async getSystemCAs(): Promise<Certificate[]> {
    if (this.systemCAs !== null) {
      return this.systemCAs;
    }

    // If already loading, wait for the existing load
    if (this.systemCAsLoading !== null) {
      return this.systemCAsLoading;
    }

    // Start loading system CAs
    this.systemCAsLoading = loadSystemCAs().then((cas) => {
      this.systemCAs = cas;
      this.systemCAsLoading = null;
      return cas;
    });

    return this.systemCAsLoading;
  }

  /**
   * Acquire connection from pool or create new one
   *
   * @param host - Target host (IP address or hostname for TCP connection)
   * @param port - Target port
   * @param useTLS - Whether to use TLS
   * @param hostname - Optional hostname for TLS SNI (defaults to host if not provided)
   * @returns Pooled connection
   */
  async acquire(
    host: string,
    port: Port,
    useTLS: boolean,
    hostname?: string,
  ): Promise<PooledConnection> {
    const key = this.getConnectionKey(host, port, useTLS, hostname);

    // Chain this acquisition onto the per-key mutex queue.
    // Each caller awaits all previous callers for the same key,
    // ensuring strictly serialized access (no TOCTOU race).
    const previous = this.acquireMutex.get(key) ?? Promise.resolve();

    let releaseLock: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    // Immediately register our gate so the next caller queues behind us
    this.acquireMutex.set(key, gate);

    // Wait for the previous holder to finish
    await previous;

    try {
      return await this.acquireInternal(host, port, useTLS, hostname, key);
    } finally {
      // If no one else queued behind us, clean up the map entry
      if (this.acquireMutex.get(key) === gate) {
        this.acquireMutex.delete(key);
      }
      releaseLock!();
    }
  }

  /**
   * Internal acquire implementation (called with lock held)
   */
  private async acquireInternal(
    host: string,
    port: Port,
    useTLS: boolean,
    hostname: string | undefined,
    key: string,
  ): Promise<PooledConnection> {
    // Use hostname for pool key to correctly group connections by origin
    const sniHostname = hostname || host;

    // Loop instead of recursing to avoid stack overflow when many callers
    // are waiting for a connection to become available.
    while (true) {
      const pool = this.connections.get(key) || [];

      // Try to reuse an idle connection - mark IN_USE immediately to prevent race
      for (let i = 0; i < pool.length; i++) {
        const conn = pool[i];
        if (conn.state === ConnectionState.IDLE) {
          // Immediately mark as IN_USE to prevent race conditions
          conn.state = ConnectionState.IN_USE;

          // Check if connection is still alive
          const age = Date.now() - conn.lastUsedAt;
          if (age < this.maxIdleTime) {
            conn.lastUsedAt = Date.now();
            conn.useCount++;
            this.stats.reuseCount++;
            this.updateStats();
            return conn;
          } else {
            // Connection is too old, close and remove it
            await conn.socket.close();
            pool.splice(i, 1);
            i--;
            this.stats.totalConnections--;
          }
        }
      }

      // Check if we can create a new connection (including pending acquisitions)
      const activeCount = pool.filter((c) => c.state === ConnectionState.IN_USE).length;
      const pendingCount = this.pendingAcquisitions.get(key) || 0;
      if (activeCount + pendingCount >= this.maxConnectionsPerOrigin) {
        // Wait for an available connection, then loop back to retry
        const waitStart = Date.now();
        await this.waitForAvailableConnection(key);
        const waitTime = Date.now() - waitStart;
        this.updateAverageWaitTime(waitTime);
        continue;
      }

      // Track this pending acquisition to prevent over-allocation
      this.pendingAcquisitions.set(key, pendingCount + 1);

      // Create new connection — count as cache miss (no idle connection reused)
      this.stats.missCount++;

      try {
        const socket = await this.createConnection(host, port, useTLS, sniHostname);
        const connection: PooledConnection = {
          id: String(this.nextConnectionId++) as ConnectionID,
          socket,
          host,
          port,
          secure: useTLS,
          state: ConnectionState.IN_USE,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
          useCount: 1,
        };

        pool.push(connection);
        this.connections.set(key, pool);
        this.stats.totalConnections++;
        this.updateStats();

        return connection;
      } catch (error) {
        this.stats.errorCount++;
        this.updateStats();
        throw error;
      } finally {
        // Always decrement pending count after connection attempt completes
        const currentPending = this.pendingAcquisitions.get(key) || 0;
        if (currentPending > 1) {
          this.pendingAcquisitions.set(key, currentPending - 1);
        } else {
          this.pendingAcquisitions.delete(key);
        }
      }
    }
  }

  /**
   * Release connection back to pool
   *
   * @param connection - Connection to release
   */
  async release(connection: PooledConnection): Promise<void> {
    if (connection.state === ConnectionState.IN_USE) {
      connection.state = ConnectionState.IDLE;
      connection.lastUsedAt = Date.now();
      this.updateStats();

      // Find the pool key for this connection and only notify its waiters
      let connectionKey: string | undefined;
      for (const [key, pool] of this.connections.entries()) {
        if (pool.includes(connection)) {
          connectionKey = key;
          break;
        }
      }

      if (connectionKey) {
        const keyWaiters = this.waiters.get(connectionKey);
        if (keyWaiters && keyWaiters.length > 0) {
          const waiter = keyWaiters.shift()!;
          clearTimeout(waiter.timer);
          waiter.resolve();
          if (keyWaiters.length === 0) {
            this.waiters.delete(connectionKey);
          }
        }
      }
    }
  }

  /**
   * Close idle connections
   */
  async closeIdleConnections(): Promise<void> {
    const now = Date.now();

    for (const [key, pool] of this.connections.entries()) {
      const toRemove: number[] = [];

      for (let i = 0; i < pool.length; i++) {
        const conn = pool[i];
        if (conn.state === ConnectionState.IDLE) {
          const age = now - conn.lastUsedAt;
          if (age >= this.maxIdleTime) {
            await conn.socket.close();
            toRemove.push(i);
            this.stats.totalConnections--;
          }
        }
      }

      // Remove closed connections (iterate in reverse to avoid index issues)
      for (let i = toRemove.length - 1; i >= 0; i--) {
        pool.splice(toRemove[i], 1);
      }

      // Clean up empty pools
      if (pool.length === 0) {
        this.connections.delete(key);
      }
    }

    this.updateStats();
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    for (const pool of this.connections.values()) {
      for (const conn of pool) {
        await conn.socket.close();
      }
    }

    this.connections.clear();
    this.stats.totalConnections = 0;
    this.stats.activeConnections = 0;
    this.stats.idleConnections = 0;
    this.updateStats();
  }

  /**
   * Get pool statistics
   */
  getStats(): ConnectionPoolStats {
    return { ...this.stats };
  }

  /**
   * Destroy the connection pool, stopping cleanup and closing all connections
   */
  async destroy(): Promise<void> {
    this.stopAutoCleanup();

    // Reject all pending waiters
    for (const [, keyWaiters] of this.waiters) {
      for (const waiter of keyWaiters) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error("Connection pool destroyed"));
      }
    }
    this.waiters.clear();

    await this.closeAll();
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get connection key for pooling
   *
   * For TLS connections, the key includes the SNI hostname (if provided) because
   * TLS sessions are hostname-specific. Even if two hostnames resolve to the same
   * IP address, they need separate TLS connections with different SNI values.
   */
  private getConnectionKey(host: string, port: Port, useTLS: boolean, hostname?: string): string {
    // For TLS connections, use hostname (SNI) if provided to separate connections by origin
    const effectiveHost = useTLS && hostname ? hostname : host;
    return `${useTLS ? "https" : "http"}://${effectiveHost}:${port}`;
  }

  /**
   * Create new connection (TCP or TLS)
   * @param host - IP address or hostname for TCP connection
   * @param port - Target port
   * @param useTLS - Whether to use TLS
   * @param sniHostname - Hostname for TLS SNI (must be hostname, not IP address)
   */
  private async createConnection(
    host: string,
    port: Port,
    useTLS: boolean,
    sniHostname?: string,
  ): Promise<Socket> {
    if (useTLS) {
      // Use Deno's native TLS for reliable certificate validation
      const tlsServerName = sniHostname || host;
      try {
        // Wrap Deno.connectTls in a 10s timeout to prevent hanging on unresponsive servers
        let nativeTlsTimer: number | undefined;
        let conn: Deno.TlsConn;
        const tlsConnectPromise = Deno.connectTls({
          hostname: tlsServerName,
          port,
          alpnProtocols: ["http/1.1"],
        });
        try {
          conn = await Promise.race([
            tlsConnectPromise,
            new Promise<never>((_, reject) => {
              nativeTlsTimer = setTimeout(() => reject(new Error(`TLS connection to ${tlsServerName}:${port} timed out after ${NATIVE_TLS_CONNECT_TIMEOUT_MS}ms`)), NATIVE_TLS_CONNECT_TIMEOUT_MS) as unknown as number;
            }),
          ]);
        } catch (err) {
          // If timeout won the race, the TLS connect may still resolve later — close it to prevent leak
          tlsConnectPromise.then((c) => { try { c.close(); } catch { /* already closed */ } }).catch(() => {});
          throw err;
        } finally {
          if (nativeTlsTimer !== undefined) clearTimeout(nativeTlsTimer);
        }
        return new DenoTlsSocket(conn, host, port as Port, tlsServerName);
      } catch (nativeErr) {
        // Only fall back to custom TLS if Deno.connectTls is truly unavailable,
        // NOT on certificate validation errors (which should propagate)
        const errMsg = (nativeErr as Error).message || "";
        if (
          errMsg.includes("certificate") ||
          errMsg.includes("CERTIFICATE") ||
          errMsg.includes("self-signed") ||
          errMsg.includes("expired") ||
          errMsg.includes("hostname mismatch") ||
          errMsg.includes("unknown CA") ||
          errMsg.includes("InvalidData") ||
          errMsg.includes("timed out")
        ) {
          throw nativeErr; // Don't mask cert/timeout errors with custom TLS fallback
        }
        // Fallback to custom TLS stack if Deno.connectTls unavailable
        // Wrap entire custom handshake in 5s timeout for fail-fast behavior
        // Track the underlying socket so we can close it on timeout even if
        // the TLS handshake hasn't completed (before TLSSocket wrapping)
        let rawSocket: SocketImpl | undefined;
        const customTlsPromise = (async () => {
          const af = host.includes(":") ? AddressFamily.IPv6 : AddressFamily.IPv4;
          const socket = new SocketImpl(af, SocketType.STREAM);
          rawSocket = socket;
          const tcpConnection = new TCPConnection(socket, DEFAULT_TCP_CONFIG);
          await tcpConnection.connect(host, port);

          const trustedCAs = await this.getSystemCAs();
          const tlsConnection = new TLSConnection(socket, {
            minVersion: 0x0303,
            maxVersion: 0x0304,
            cipherSuites: [0x1301, 0x1302, 0x1303, 0xc02b, 0xc02f, 0xc02c, 0xc030, 0xcca9, 0xcca8],
            verifyPeerCertificate: true,
            trustedCAs,
            allowSelfSigned: false,
            serverName: tlsServerName,
            alpnProtocols: ["http/1.1"],
            enableSessionResumption: false,
            sessionTicketLifetime: 7200000,
          });
          await tlsConnection.connect(tlsServerName);
          return new TLSSocket(tlsConnection);
        })();

        let customTlsTimer: number | undefined;
        try {
          return await Promise.race([
            customTlsPromise,
            new Promise<never>((_, reject) => {
              customTlsTimer = setTimeout(() => reject(new Error(`Custom TLS handshake to ${tlsServerName}:${port} timed out after ${CUSTOM_TLS_HANDSHAKE_TIMEOUT_MS}ms`)), CUSTOM_TLS_HANDSHAKE_TIMEOUT_MS) as unknown as number;
            }),
          ]);
        } catch (err) {
          // Close the underlying raw socket to prevent leak even if TLS wrapping never completed
          if (rawSocket) {
            try { await rawSocket.close(); } catch { /* already closed */ }
          }
          // If timeout won, the custom TLS handshake may still complete — close to prevent leak
          customTlsPromise.then((sock) => {
            try { sock.close(); } catch { /* already closed */ }
          }).catch(() => {});
          throw err;
        } finally {
          if (customTlsTimer !== undefined) clearTimeout(customTlsTimer);
        }
      }
    }

    const af = host.includes(":") ? AddressFamily.IPv6 : AddressFamily.IPv4;
    const socket = new SocketImpl(af, SocketType.STREAM);
    const tcpConnection = new TCPConnection(socket, DEFAULT_TCP_CONFIG);
    await tcpConnection.connect(host, port);
    return socket;
  }

  /**
   * Wait for an available connection with timeout
   */
  private async waitForAvailableConnection(key: string, timeoutMs: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove this waiter from the queue on timeout
        const keyWaiters = this.waiters.get(key);
        if (keyWaiters) {
          const idx = keyWaiters.findIndex((w) => w.timer === timer);
          if (idx !== -1) keyWaiters.splice(idx, 1);
          if (keyWaiters.length === 0) this.waiters.delete(key);
        }
        reject(new Error(`Connection pool timeout waiting for available connection to ${key}`));
      }, timeoutMs);

      const waiter = { resolve, reject, timer };
      if (!this.waiters.has(key)) {
        this.waiters.set(key, []);
      }
      this.waiters.get(key)!.push(waiter);
    });
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    let active = 0;
    let idle = 0;

    for (const pool of this.connections.values()) {
      for (const conn of pool) {
        if (conn.state === ConnectionState.IN_USE) {
          active++;
        } else if (conn.state === ConnectionState.IDLE) {
          idle++;
        }
      }
    }

    this.stats.activeConnections = active;
    this.stats.idleConnections = idle;
    this.stats.lastUpdated = Date.now();
  }

  /**
   * Update average wait time
   */
  private updateAverageWaitTime(newWaitTime: number): void {
    const alpha = 0.1; // Exponential moving average factor
    this.stats.averageWaitTime = this.stats.averageWaitTime * (1 - alpha) + newWaitTime * alpha;
  }

  /**
   * Start automatic cleanup timer
   */
  private startAutoCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.closeIdleConnections().catch((error) => {
        console.error("Error during automatic connection cleanup:", error);
      });
    }, AUTO_CLEANUP_INTERVAL_MS);
  }
}
