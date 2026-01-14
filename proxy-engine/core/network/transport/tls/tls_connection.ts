/**
 * TLS Connection
 *
 * Secure connection implementation using TLS handshake
 * Wraps Deno's native TLS implementation
 */

import { Socket } from "../socket/socket.ts";
import {
  TLS13_CIPHER_SUITES,
  TLSHandshake,
  TLSHandshakeState,
  TLSVersion,
} from "./tls_handshake.ts";
import type { CipherSuite, TLSCertificate, TLSHandshakeConfig } from "./tls_handshake.ts";

/**
 * TLS connection configuration
 */
export interface TLSConnectionConfig extends TLSHandshakeConfig {
  /**
   * Hostname for certificate verification
   */
  hostname: string;

  /**
   * Port number
   */
  port: number;

  /**
   * Connection timeout (ms)
   */
  timeout?: number;

  /**
   * Certificate file path (for server)
   */
  certFile?: string;

  /**
   * Private key file path (for server)
   */
  keyFile?: string;

  /**
   * CA certificate file path
   */
  caCerts?: string;
}

/**
 * TLS connection information
 */
export interface TLSConnectionInfo {
  /**
   * TLS version
   */
  version: TLSVersion;

  /**
   * Cipher suite
   */
  cipherSuite: string;

  /**
   * Server certificate
   */
  serverCertificate?: TLSCertificate;

  /**
   * ALPN protocol
   */
  alpnProtocol?: string;

  /**
   * Server Name Indication
   */
  serverName?: string;
}

/**
 * TLS connection statistics
 */
export interface TLSConnectionStats {
  /**
   * Handshake state
   */
  handshakeState: TLSHandshakeState;

  /**
   * Handshake duration (ms)
   */
  handshakeDuration: number;

  /**
   * Total bytes encrypted
   */
  bytesEncrypted: number;

  /**
   * Total bytes decrypted
   */
  bytesDecrypted: number;

  /**
   * Connection duration (ms)
   */
  duration: number;
}

/**
 * TLS connection implementation
 *
 * Note: This wraps Deno's native TLS implementation for actual encryption.
 * The TLSHandshake class provides conceptual understanding of the protocol.
 */
export class TLSConnection {
  private conn?: Deno.TlsConn;
  private handshake: TLSHandshake;
  private established = false;
  private handshakeStartTime = 0;
  private handshakeEndTime = 0;
  private startTime = 0;

  // Statistics
  private stats = {
    bytesEncrypted: 0,
    bytesDecrypted: 0,
  };

  constructor(private config: TLSConnectionConfig) {
    this.handshake = new TLSHandshake({
      version: config.version,
      cipherSuites: config.cipherSuites,
      serverName: config.serverName,
      alpnProtocols: config.alpnProtocols,
      verifyServerCertificate: config.verifyServerCertificate,
    });
  }

  /**
   * Connect to remote host with TLS
   */
  async connect(): Promise<void> {
    if (this.established) {
      throw new Error("Already connected");
    }

    this.startTime = Date.now();
    this.handshakeStartTime = Date.now();

    try {
      // Use Deno's native TLS implementation
      this.conn = await Deno.connectTls({
        hostname: this.config.hostname,
        port: this.config.port,
        alpnProtocols: this.config.alpnProtocols,
        caCerts: this.config.caCerts ? [await Deno.readTextFile(this.config.caCerts)] : undefined,
      });

      this.handshakeEndTime = Date.now();
      this.established = true;

      // Update conceptual handshake state
      this.handshake.startClient();
    } catch (error) {
      throw new Error(`TLS connection failed: ${error}`);
    }
  }

  /**
   * Accept TLS connection (server side)
   */
  static async startTls(
    conn: Deno.Conn,
    config: {
      certFile: string;
      keyFile: string;
      alpnProtocols?: string[];
    },
  ): Promise<TLSConnection> {
    const tlsConn = await Deno.startTls(conn as Deno.TcpConn, {
      hostname: "localhost",
      alpnProtocols: config.alpnProtocols,
    });

    const tlsConnection = new TLSConnection({
      hostname: "localhost",
      port: 0,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      alpnProtocols: config.alpnProtocols,
    });

    tlsConnection.conn = tlsConn;
    tlsConnection.established = true;
    tlsConnection.startTime = Date.now();

    return tlsConnection;
  }

  /**
   * Read data from TLS connection
   */
  async read(buffer: Uint8Array): Promise<number | null> {
    if (!this.conn) {
      throw new Error("Not connected");
    }

    const n = await this.conn.read(buffer);
    if (n !== null) {
      this.stats.bytesDecrypted += n;
    }

    return n;
  }

  /**
   * Write data to TLS connection
   */
  async write(data: Uint8Array): Promise<number> {
    if (!this.conn) {
      throw new Error("Not connected");
    }

    const n = await this.conn.write(data);
    this.stats.bytesEncrypted += n;

    return n;
  }

  /**
   * Close TLS connection
   */
  close(): void {
    if (this.conn) {
      this.conn.close();
      this.conn = undefined;
    }
    this.established = false;
  }

  /**
   * Check if connection is established
   */
  isEstablished(): boolean {
    return this.established;
  }

  /**
   * Get TLS handshake information
   */
  async getHandshakeInfo(): Promise<Deno.TlsHandshakeInfo | null> {
    if (!this.conn) {
      return null;
    }

    try {
      return await this.conn.handshake();
    } catch {
      return null;
    }
  }

  /**
   * Get TLS connection information
   */
  async getConnectionInfo(): Promise<TLSConnectionInfo | null> {
    const handshakeInfo = await this.getHandshakeInfo();
    if (!handshakeInfo) {
      return null;
    }

    return {
      version: this.config.version,
      cipherSuite: this.handshake.getCipherSuite()?.name || "unknown",
      serverCertificate: this.handshake.getServerCertificate(),
      alpnProtocol: handshakeInfo.alpnProtocol || this.config.alpnProtocols?.[0],
      serverName: this.config.serverName,
    };
  }

  /**
   * Get connection statistics
   */
  getStats(): TLSConnectionStats {
    const duration = this.startTime > 0 ? Date.now() - this.startTime : 0;
    const handshakeDuration = this.handshakeEndTime > 0
      ? this.handshakeEndTime - this.handshakeStartTime
      : 0;

    return {
      handshakeState: this.handshake.getState(),
      handshakeDuration,
      bytesEncrypted: this.stats.bytesEncrypted,
      bytesDecrypted: this.stats.bytesDecrypted,
      duration,
    };
  }

  /**
   * Get underlying Deno connection
   */
  getConn(): Deno.TlsConn | undefined {
    return this.conn;
  }

  /**
   * Get local address
   */
  get localAddr(): Deno.NetAddr | undefined {
    return this.conn?.localAddr as Deno.NetAddr | undefined;
  }

  /**
   * Get remote address
   */
  get remoteAddr(): Deno.NetAddr | undefined {
    return this.conn?.remoteAddr as Deno.NetAddr | undefined;
  }

  /**
   * Implement Deno.Reader interface
   */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array> {
    if (!this.conn) {
      return;
    }

    const buffer = new Uint8Array(8192);
    while (true) {
      const n = await this.read(buffer);
      if (n === null) {
        break;
      }
      yield buffer.subarray(0, n);
    }
  }
}

/**
 * Create TLS connection
 */
export async function createTLSConnection(
  config: TLSConnectionConfig,
): Promise<TLSConnection> {
  const conn = new TLSConnection(config);
  await conn.connect();
  return conn;
}

/**
 * Wrap existing connection with TLS (server side)
 */
export async function wrapWithTLS(
  conn: Deno.Conn,
  config: {
    certFile: string;
    keyFile: string;
    alpnProtocols?: string[];
  },
): Promise<TLSConnection> {
  return await TLSConnection.startTls(conn, config);
}
