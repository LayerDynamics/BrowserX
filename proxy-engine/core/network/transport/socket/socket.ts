/**
 * Socket wrapper for TCP connections
 *
 * Provides a unified interface over Deno.Conn with statistics tracking
 */

import type { Closer, Reader, Writer } from "jsr:@std/io/types";
import { type SocketStats } from "./socket_stats.ts";
import { type SocketOptions } from "./socket_options.ts";

// Re-export types for external use
export type { SocketOptions, SocketStats };

/**
 * Socket state
 */
export enum SocketState {
  CLOSED = "CLOSED",
  OPENING = "OPENING",
  OPEN = "OPEN",
  CLOSING = "CLOSING",
  ERROR = "ERROR",
}

/**
 * Socket wrapper class
 */
export class Socket implements Reader, Writer, Closer {
  private conn: Deno.TcpConn | null = null;
  private state: SocketState = SocketState.CLOSED;
  private stats: SocketStats;
  private errorMessage?: string;

  constructor(
    public readonly host: string,
    public readonly port: number,
    private options: SocketOptions = {},
  ) {
    this.stats = {
      bytesRead: 0,
      bytesWritten: 0,
      readsCount: 0,
      writesCount: 0,
      errorsCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
  }

  /**
   * Connect to remote host
   */
  async connect(timeout?: number): Promise<void> {
    if (this.state !== SocketState.CLOSED) {
      throw new Error(`Cannot connect: socket is ${this.state}`);
    }

    this.state = SocketState.OPENING;

    try {
      const connectOptions: Deno.ConnectOptions = {
        hostname: this.host,
        port: this.port,
        transport: "tcp",
      };

      if (timeout) {
        // Use AbortSignal for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          this.conn = await Deno.connect({
            ...connectOptions,
            // @ts-ignore - signal is not in type definition but works
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
      } else {
        this.conn = await Deno.connect(connectOptions);
      }

      this.state = SocketState.OPEN;
      this.applyOptions();
    } catch (error) {
      this.state = SocketState.ERROR;
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.stats.errorsCount++;
      throw new Error(`Failed to connect to ${this.host}:${this.port}: ${this.errorMessage}`);
    }
  }

  /**
   * Create socket from existing connection
   */
  static fromConn(conn: Deno.TcpConn, options: SocketOptions = {}): Socket {
    const remoteAddr = conn.remoteAddr as Deno.NetAddr;
    const socket = new Socket(remoteAddr.hostname, remoteAddr.port, options);
    socket.conn = conn;
    socket.state = SocketState.OPEN;
    socket.applyOptions();
    return socket;
  }

  /**
   * Read data from socket
   */
  async read(p: Uint8Array): Promise<number | null> {
    if (this.state !== SocketState.OPEN || !this.conn) {
      throw new Error(`Cannot read: socket is ${this.state}`);
    }

    try {
      const n = await this.conn.read(p);

      if (n !== null) {
        this.stats.bytesRead += n;
        this.stats.readsCount++;
        this.stats.lastActivityAt = Date.now();
      }

      return n;
    } catch (error) {
      this.state = SocketState.ERROR;
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.stats.errorsCount++;
      throw error;
    }
  }

  /**
   * Write data to socket
   */
  async write(p: Uint8Array): Promise<number> {
    if (this.state !== SocketState.OPEN || !this.conn) {
      throw new Error(`Cannot write: socket is ${this.state}`);
    }

    try {
      const n = await this.conn.write(p);
      this.stats.bytesWritten += n;
      this.stats.writesCount++;
      this.stats.lastActivityAt = Date.now();
      return n;
    } catch (error) {
      this.state = SocketState.ERROR;
      this.errorMessage = error instanceof Error ? error.message : String(error);
      this.stats.errorsCount++;
      throw error;
    }
  }

  /**
   * Close socket
   */
  close(): void {
    if (this.state === SocketState.CLOSED) {
      return;
    }

    this.state = SocketState.CLOSING;

    try {
      if (this.conn) {
        this.conn.close();
        this.conn = null;
      }
    } finally {
      this.state = SocketState.CLOSED;
    }
  }

  /**
   * Get socket state
   */
  getState(): SocketState {
    return this.state;
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.state === SocketState.OPEN;
  }

  /**
   * Get socket statistics
   */
  getStats(): Readonly<SocketStats> {
    return { ...this.stats };
  }

  /**
   * Get error message if socket is in error state
   */
  getError(): string | undefined {
    return this.errorMessage;
  }

  /**
   * Get local address
   */
  getLocalAddr(): Deno.NetAddr | null {
    return this.conn?.localAddr as Deno.NetAddr || null;
  }

  /**
   * Get remote address
   */
  getRemoteAddr(): Deno.NetAddr | null {
    return this.conn?.remoteAddr as Deno.NetAddr || null;
  }

  /**
   * Get underlying Deno connection
   */
  getConn(): Deno.TcpConn | null {
    return this.conn;
  }

  /**
   * Set socket options
   */
  async setOptions(options: Partial<SocketOptions>): Promise<void> {
    Object.assign(this.options, options);
    if (this.conn) {
      await this.applyOptions();
    }
  }

  /**
   * Apply socket options to underlying connection
   */
  private async applyOptions(): Promise<void> {
    if (!this.conn) {
      return;
    }

    try {
      // Set TCP_NODELAY (disable Nagle's algorithm for lower latency)
      if (this.options.tcpNoDelay !== undefined) {
        await this.conn.setNoDelay(this.options.tcpNoDelay);
      }

      // Set TCP_KEEPALIVE
      if (this.options.tcpKeepAlive !== undefined) {
        await this.conn.setKeepAlive(this.options.tcpKeepAlive);
      }
    } catch (error) {
      console.warn("Failed to set socket options:", error);
    }
  }

  /**
   * Test if socket is writable (simple health check)
   */
  async isWritable(): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    try {
      // Try to write empty buffer
      await this.write(new Uint8Array(0));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get idle time in milliseconds
   */
  getIdleTime(): number {
    return Date.now() - this.stats.lastActivityAt;
  }

  /**
   * Get connection age in milliseconds
   */
  getAge(): number {
    return Date.now() - this.stats.createdAt;
  }

  /**
   * Get socket options
   */
  getOptions(): Readonly<SocketOptions> {
    return { ...this.options };
  }
}

// Export alias for test compatibility
export { Socket as SocketImpl };
