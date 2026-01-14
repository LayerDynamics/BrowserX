/**
 * Connection Registry
 *
 * Central registry for tracking all active connections
 */

import type { Socket } from "../transport/socket/socket.ts";

/**
 * Connection ID type
 */
export type ConnectionID = string;

/**
 * Connection state
 */
export enum ConnectionState {
  IDLE = "IDLE",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  IN_USE = "IN_USE",
  DRAINING = "DRAINING",
  CLOSING = "CLOSING",
  CLOSED = "CLOSED",
  ERROR = "ERROR",
}

/**
 * Protocol type
 */
export type ProtocolType =
  | "HTTP/1.0"
  | "HTTP/1.1"
  | "HTTP/2"
  | "HTTP/3"
  | "WebSocket"
  | "TLS"
  | "TCP";

/**
 * Registered connection info
 */
export interface RegisteredConnection {
  id: ConnectionID;
  socket?: Socket;
  host: string;
  port: number;
  protocol: ProtocolType;
  state: ConnectionState;
  createdAt: number;
  lastActivityAt: number;
  requestCount: number;
  bytesRead: number;
  bytesWritten: number;
  errorCount: number;
  metadata: Record<string, unknown>;
}

/**
 * Connection query filters
 */
export interface ConnectionQuery {
  host?: string;
  port?: number;
  protocol?: ProtocolType;
  state?: ConnectionState;
  minAge?: number;
  maxAge?: number;
  minIdleTime?: number;
}

/**
 * Connection Registry
 */
export class ConnectionRegistry {
  private connections: Map<ConnectionID, RegisteredConnection> = new Map();
  private nextId = 1;

  /**
   * Generate unique connection ID
   */
  private generateId(): ConnectionID {
    return `conn_${this.nextId++}_${Date.now()}`;
  }

  /**
   * Register new connection
   */
  register(
    socket: Socket | undefined,
    host: string,
    port: number,
    protocol: ProtocolType,
    metadata: Record<string, unknown> = {},
  ): ConnectionID {
    const id = this.generateId();

    const connection: RegisteredConnection = {
      id,
      socket,
      host,
      port,
      protocol,
      state: ConnectionState.CONNECTING,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      requestCount: 0,
      bytesRead: 0,
      bytesWritten: 0,
      errorCount: 0,
      metadata,
    };

    this.connections.set(id, connection);
    return id;
  }

  /**
   * Unregister connection
   */
  unregister(id: ConnectionID): boolean {
    return this.connections.delete(id);
  }

  /**
   * Get connection by ID
   */
  get(id: ConnectionID): RegisteredConnection | undefined {
    return this.connections.get(id);
  }

  /**
   * Update connection state
   */
  setState(id: ConnectionID, state: ConnectionState): boolean {
    const conn = this.connections.get(id);
    if (!conn) return false;

    conn.state = state;
    conn.lastActivityAt = Date.now();
    return true;
  }

  /**
   * Update connection activity
   */
  updateActivity(
    id: ConnectionID,
    bytesRead: number = 0,
    bytesWritten: number = 0,
  ): boolean {
    const conn = this.connections.get(id);
    if (!conn) return false;

    conn.lastActivityAt = Date.now();
    conn.bytesRead += bytesRead;
    conn.bytesWritten += bytesWritten;
    return true;
  }

  /**
   * Increment request count
   */
  incrementRequests(id: ConnectionID): boolean {
    const conn = this.connections.get(id);
    if (!conn) return false;

    conn.requestCount++;
    conn.lastActivityAt = Date.now();
    return true;
  }

  /**
   * Increment error count
   */
  incrementErrors(id: ConnectionID): boolean {
    const conn = this.connections.get(id);
    if (!conn) return false;

    conn.errorCount++;
    conn.lastActivityAt = Date.now();
    return true;
  }

  /**
   * Update connection metadata
   */
  updateMetadata(
    id: ConnectionID,
    metadata: Record<string, unknown>,
  ): boolean {
    const conn = this.connections.get(id);
    if (!conn) return false;

    conn.metadata = { ...conn.metadata, ...metadata };
    return true;
  }

  /**
   * Query connections by filters
   */
  query(filters: ConnectionQuery = {}): RegisteredConnection[] {
    const results: RegisteredConnection[] = [];
    const now = Date.now();

    for (const conn of this.connections.values()) {
      // Filter by host
      if (filters.host && conn.host !== filters.host) {
        continue;
      }

      // Filter by port
      if (filters.port && conn.port !== filters.port) {
        continue;
      }

      // Filter by protocol
      if (filters.protocol && conn.protocol !== filters.protocol) {
        continue;
      }

      // Filter by state
      if (filters.state && conn.state !== filters.state) {
        continue;
      }

      // Filter by age
      const age = now - conn.createdAt;
      if (filters.minAge && age < filters.minAge) {
        continue;
      }
      if (filters.maxAge && age > filters.maxAge) {
        continue;
      }

      // Filter by idle time
      if (filters.minIdleTime) {
        const idleTime = now - conn.lastActivityAt;
        if (idleTime < filters.minIdleTime) {
          continue;
        }
      }

      results.push(conn);
    }

    return results;
  }

  /**
   * Get all connections
   */
  getAll(): RegisteredConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connections by host
   */
  getByHost(host: string): RegisteredConnection[] {
    return this.query({ host });
  }

  /**
   * Get connections by state
   */
  getByState(state: ConnectionState): RegisteredConnection[] {
    return this.query({ state });
  }

  /**
   * Get idle connections
   */
  getIdleConnections(minIdleTime: number): RegisteredConnection[] {
    return this.query({ minIdleTime });
  }

  /**
   * Get connection count
   */
  get size(): number {
    return this.connections.size;
  }

  /**
   * Get connection count by state
   */
  countByState(state: ConnectionState): number {
    return this.query({ state }).length;
  }

  /**
   * Clear all connections
   */
  clear(): void {
    this.connections.clear();
  }

  /**
   * Remove connections matching query
   */
  removeMatching(filters: ConnectionQuery): number {
    const matching = this.query(filters);
    let removed = 0;

    for (const conn of matching) {
      if (this.unregister(conn.id)) {
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    total: number;
    byState: Record<ConnectionState, number>;
    byProtocol: Record<ProtocolType, number>;
    totalRequests: number;
    totalBytesRead: number;
    totalBytesWritten: number;
    totalErrors: number;
  } {
    const byState: Record<ConnectionState, number> = {
      [ConnectionState.IDLE]: 0,
      [ConnectionState.CONNECTING]: 0,
      [ConnectionState.CONNECTED]: 0,
      [ConnectionState.IN_USE]: 0,
      [ConnectionState.DRAINING]: 0,
      [ConnectionState.CLOSING]: 0,
      [ConnectionState.CLOSED]: 0,
      [ConnectionState.ERROR]: 0,
    };

    const byProtocol: Partial<Record<ProtocolType, number>> = {};
    let totalRequests = 0;
    let totalBytesRead = 0;
    let totalBytesWritten = 0;
    let totalErrors = 0;

    for (const conn of this.connections.values()) {
      byState[conn.state]++;
      byProtocol[conn.protocol] = (byProtocol[conn.protocol] || 0) + 1;
      totalRequests += conn.requestCount;
      totalBytesRead += conn.bytesRead;
      totalBytesWritten += conn.bytesWritten;
      totalErrors += conn.errorCount;
    }

    return {
      total: this.connections.size,
      byState,
      byProtocol: byProtocol as Record<ProtocolType, number>,
      totalRequests,
      totalBytesRead,
      totalBytesWritten,
      totalErrors,
    };
  }
}

/**
 * Global connection registry instance
 */
export const globalRegistry = new ConnectionRegistry();
