/**
 * Connection Manager
 *
 * Manages connection pools across multiple host:port combinations.
 * Provides unified interface for upstream connection management.
 */

import type { UpstreamServer } from "../../gateway/router/request_router.ts";
import {
  ConnectionRegistry,
  ConnectionState as RegistryConnectionState,
  type ConnectionID,
  type ProtocolType,
} from "../network/internal/connection_registry.ts";

/**
 * Pooled connection
 */
export interface PooledConnection {
  id: string;
  registryId?: ConnectionID; // ID in the global registry
  conn: Deno.TcpConn;
  host: string;
  port: number;
  createdAt: number;
  lastUsedAt: number;
  requestCount: number;
  inUse: boolean;
  state: ConnectionState;
}

/**
 * Connection state
 */
export enum ConnectionState {
  IDLE = "IDLE",
  IN_USE = "IN_USE",
  CLOSING = "CLOSING",
  CLOSED = "CLOSED",
  ERROR = "ERROR",
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  idleTimeout: number; // milliseconds
  maxLifetime: number; // milliseconds
  connectionTimeout?: number; // milliseconds
  healthCheckInterval?: number; // milliseconds
}

/**
 * Connection pool statistics
 */
export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  byHost: Map<string, {
    total: number;
    active: number;
    idle: number;
  }>;
}

/**
 * Upstream connection statistics
 */
export interface UpstreamConnectionStats {
  totalServers: number;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  byServer: Map<string, {
    connections: number;
    active: number;
    idle: number;
  }>;
}

/**
 * Single host connection pool
 */
class HostConnectionPool {
  private connections: PooledConnection[] = [];
  private nextId = 1;
  private cleanupIntervalId?: number;
  private registry: ConnectionRegistry;

  constructor(
    private host: string,
    private port: number,
    private config: ConnectionPoolConfig,
    registry?: ConnectionRegistry,
  ) {
    this.registry = registry || new ConnectionRegistry();
    this.startCleanupInterval();
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(timeout?: number): Promise<PooledConnection | null> {
    // Find available connection
    const available = this.connections.find(
      (c) => c.state === ConnectionState.IDLE && this.isConnectionValid(c),
    );

    if (available) {
      available.state = ConnectionState.IN_USE;
      available.inUse = true;
      available.lastUsedAt = Date.now();
      available.requestCount++;

      // Update registry
      if (available.registryId) {
        this.registry.setState(available.registryId, RegistryConnectionState.IN_USE);
        this.registry.incrementRequests(available.registryId);
      }

      return available;
    }

    // Create new connection if under limit
    if (this.connections.length < this.config.maxConnections) {
      return await this.createConnection(timeout);
    }

    // Pool exhausted
    return null;
  }

  /**
   * Release connection back to pool
   */
  release(conn: PooledConnection): void {
    conn.state = ConnectionState.IDLE;
    conn.inUse = false;
    conn.lastUsedAt = Date.now();

    // Update registry
    if (conn.registryId) {
      this.registry.setState(conn.registryId, RegistryConnectionState.IDLE);
    }
  }

  /**
   * Remove connection from pool
   */
  remove(conn: PooledConnection): void {
    const index = this.connections.findIndex((c) => c.id === conn.id);
    if (index !== -1) {
      try {
        conn.conn.close();
      } catch {
        // Already closed
      }
      conn.state = ConnectionState.CLOSED;

      // Unregister from registry
      if (conn.registryId) {
        this.registry.unregister(conn.registryId);
      }

      this.connections.splice(index, 1);
    }
  }

  /**
   * Create new connection
   */
  private async createConnection(timeout?: number): Promise<PooledConnection | null> {
    try {
      const connectTimeout = timeout || this.config.connectionTimeout || 30000;

      // Connect with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), connectTimeout);

      let conn: Deno.TcpConn;
      try {
        conn = await Deno.connect({
          hostname: this.host,
          port: this.port,
          transport: "tcp",
        }) as Deno.TcpConn;
      } finally {
        clearTimeout(timeoutId);
      }

      const pooledConn: PooledConnection = {
        id: `${this.host}:${this.port}-${this.nextId++}`,
        conn,
        host: this.host,
        port: this.port,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        requestCount: 1,
        inUse: true,
        state: ConnectionState.IN_USE,
      };

      // Register with connection registry
      const protocol: ProtocolType = this.port === 443 ? "TLS" : "TCP";
      pooledConn.registryId = this.registry.register(
        undefined, // Socket not used in this implementation
        this.host,
        this.port,
        protocol,
        { poolId: pooledConn.id },
      );

      // Update registry state to IN_USE
      this.registry.setState(pooledConn.registryId, RegistryConnectionState.IN_USE);
      this.registry.incrementRequests(pooledConn.registryId);

      this.connections.push(pooledConn);
      return pooledConn;
    } catch (error) {
      console.error(`Failed to create connection to ${this.host}:${this.port}:`, error);
      return null;
    }
  }

  /**
   * Check if connection is valid
   */
  private isConnectionValid(conn: PooledConnection): boolean {
    const now = Date.now();

    // Check age
    const age = now - conn.createdAt;
    if (age > this.config.maxLifetime) {
      return false;
    }

    // Check idle time
    const idleTime = now - conn.lastUsedAt;
    if (idleTime > this.config.idleTimeout) {
      return false;
    }

    return true;
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.config.healthCheckInterval) {
      this.cleanupIntervalId = setInterval(() => {
        this.cleanup();
      }, this.config.healthCheckInterval);
    }
  }

  /**
   * Cleanup stale connections
   */
  private cleanup(): void {
    const validConnections = this.connections.filter((conn) => {
      if (conn.state === ConnectionState.IN_USE) {
        return true; // Keep active connections
      }

      if (!this.isConnectionValid(conn)) {
        try {
          conn.conn.close();
        } catch {
          // Already closed
        }
        conn.state = ConnectionState.CLOSED;

        // Unregister from registry
        if (conn.registryId) {
          this.registry.unregister(conn.registryId);
        }

        return false;
      }

      return true;
    });

    this.connections = validConnections;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      total: this.connections.length,
      active: this.connections.filter((c) => c.state === ConnectionState.IN_USE).length,
      idle: this.connections.filter((c) => c.state === ConnectionState.IDLE).length,
    };
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }

    for (const conn of this.connections) {
      try {
        conn.conn.close();
        conn.state = ConnectionState.CLOSED;

        // Unregister from registry
        if (conn.registryId) {
          this.registry.unregister(conn.registryId);
        }
      } catch {
        // Already closed
      }
    }

    this.connections = [];
  }
}

/**
 * Connection Pool Manager
 * Manages pools for multiple host:port combinations
 */
export class ConnectionPoolManager {
  private pools: Map<string, HostConnectionPool> = new Map();
  private registry: ConnectionRegistry;

  constructor(
    private config: ConnectionPoolConfig,
    registry?: ConnectionRegistry,
  ) {
    this.registry = registry || new ConnectionRegistry();
  }

  /**
   * Get pool for host:port (creates if doesn't exist)
   */
  getPool(host: string, port: number): HostConnectionPool {
    const key = `${host}:${port}`;
    let pool = this.pools.get(key);

    if (!pool) {
      pool = new HostConnectionPool(host, port, this.config, this.registry);
      this.pools.set(key, pool);
    }

    return pool;
  }

  /**
   * Get aggregate statistics across all pools
   */
  getAggregateStats(): UpstreamConnectionStats {
    let totalConnections = 0;
    let activeConnections = 0;
    let idleConnections = 0;

    const byServer = new Map<string, {
      connections: number;
      active: number;
      idle: number;
    }>();

    for (const [key, pool] of this.pools.entries()) {
      const stats = pool.getStats();
      totalConnections += stats.total;
      activeConnections += stats.active;
      idleConnections += stats.idle;

      byServer.set(key, {
        connections: stats.total,
        active: stats.active,
        idle: stats.idle,
      });
    }

    return {
      totalServers: this.pools.size,
      totalConnections,
      activeConnections,
      idleConnections,
      byServer,
    };
  }

  /**
   * Get all connection pools
   */
  getAllPools(): Map<string, HostConnectionPool> {
    return new Map(this.pools);
  }

  /**
   * Close all connections in all pools
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.pools.values()).map((pool) => pool.close());
    await Promise.all(closePromises);
    this.pools.clear();
  }

  /**
   * Get the connection registry
   */
  getRegistry(): ConnectionRegistry {
    return this.registry;
  }
}

/**
 * Upstream Connection Manager
 * High-level interface for managing upstream connections
 */
export class UpstreamConnectionManager {
  private poolManager: ConnectionPoolManager;

  constructor(
    config: ConnectionPoolConfig,
    registry?: ConnectionRegistry,
  ) {
    this.poolManager = new ConnectionPoolManager(config, registry);
  }

  /**
   * Get or create connection to upstream server
   */
  async getConnection(server: UpstreamServer, timeout?: number): Promise<PooledConnection> {
    const pool = this.poolManager.getPool(server.host, server.port);
    const conn = await pool.acquire(timeout);

    if (!conn) {
      throw new Error(`Failed to acquire connection to ${server.host}:${server.port}`);
    }

    return conn;
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(conn: PooledConnection): void {
    const pool = this.poolManager.getPool(conn.host, conn.port);
    pool.release(conn);
  }

  /**
   * Close all connections to a server
   */
  async closeServerConnections(serverId: string): Promise<void> {
    // This would require tracking server ID to host:port mapping
    // For now, we'll close by host:port
    // Implementation depends on how server IDs map to connections
  }

  /**
   * Get connection statistics
   */
  getStats(): UpstreamConnectionStats {
    return this.poolManager.getAggregateStats();
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    await this.poolManager.closeAll();
  }

  /**
   * Get pool for specific host:port
   */
  getPool(host: string, port: number): HostConnectionPool {
    return this.poolManager.getPool(host, port);
  }

  /**
   * Get all connection pools
   */
  getAllPools(): Map<string, HostConnectionPool> {
    return this.poolManager.getAllPools();
  }

  /**
   * Shutdown all connections
   */
  async shutdown(): Promise<void> {
    await this.closeAll();
  }

  /**
   * Get the connection registry
   */
  getRegistry(): ConnectionRegistry {
    return this.poolManager.getRegistry();
  }
}

/**
 * Default connection pool configuration
 */
export const DEFAULT_CONNECTION_POOL_CONFIG: ConnectionPoolConfig = {
  minConnections: 0,
  maxConnections: 100,
  idleTimeout: 60000, // 1 minute
  maxLifetime: 600000, // 10 minutes
  connectionTimeout: 30000, // 30 seconds
  healthCheckInterval: 10000, // 10 seconds
};
