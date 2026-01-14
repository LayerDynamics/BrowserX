/**
 * Connection Pool Management
 *
 * Manages connection pooling and reuse for HTTP requests.
 * Implements per-origin connection limits and idle connection management.
 */

import type { ConnectionID, Port } from "../../../types/identifiers.ts";
import type { PooledConnection } from "../../../types/network.ts";
import { ConnectionState } from "../../../types/network.ts";
import { AddressFamily, SocketImpl, SocketType } from "../primitives/Socket.ts";
import { type TCPConfig, TCPConnection } from "../primitives/TCPConnection.ts";
import { TLSConnection } from "../security/TLSConnection.ts";
import { ConnectionPoolStats, createConnectionPoolStats } from "./ConnectionPoolStats.ts";

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

export class ConnectionPool {
    private connections: Map<string, PooledConnection[]> = new Map();
    private maxConnectionsPerOrigin: number = 6;
    private maxIdleTime: number = 60000; // 60 seconds
    private stats: ConnectionPoolStats = createConnectionPoolStats();
    private nextConnectionId: number = 1;
    private cleanupInterval: number | null = null;

    constructor() {
        // Start automatic cleanup of idle connections
        this.startAutoCleanup();
    }

    /**
     * Acquire connection from pool or create new one
     *
     * @param host - Target host
     * @param port - Target port
     * @param useTLS - Whether to use TLS
     * @returns Pooled connection
     */
    async acquire(host: string, port: Port, useTLS: boolean): Promise<PooledConnection> {
        const key = this.getConnectionKey(host, port, useTLS);
        const pool = this.connections.get(key) || [];

        // Try to reuse an idle connection
        for (let i = 0; i < pool.length; i++) {
            const conn = pool[i];
            if (conn.state === ConnectionState.IDLE) {
                // Check if connection is still alive
                const age = Date.now() - conn.lastUsedAt;
                if (age < this.maxIdleTime) {
                    conn.state = ConnectionState.IN_USE;
                    conn.lastUsedAt = Date.now();
                    conn.useCount++;
                    this.stats.reuseCount++;
                    this.updateStats();
                    return conn;
                } else {
                    // Connection is too old, remove it
                    await conn.socket.close();
                    pool.splice(i, 1);
                    i--;
                }
            }
        }

        // Check if we can create a new connection
        const activeCount = pool.filter((c) => c.state === ConnectionState.IN_USE).length;
        if (activeCount >= this.maxConnectionsPerOrigin) {
            // Wait for an available connection
            this.stats.missCount++;
            const waitStart = Date.now();
            await this.waitForAvailableConnection(key);
            const waitTime = Date.now() - waitStart;
            this.updateAverageWaitTime(waitTime);
            return this.acquire(host, port, useTLS);
        }

        // Create new connection
        // Increment miss count since we're not reusing an existing connection
        this.stats.missCount++;

        try {
            const socket = await this.createConnection(host, port, useTLS);
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
     */
    private getConnectionKey(host: string, port: Port, useTLS: boolean): string {
        return `${useTLS ? "https" : "http"}://${host}:${port}`;
    }

    /**
     * Create new connection (TCP or TLS)
     */
    private async createConnection(host: string, port: Port, useTLS: boolean): Promise<SocketImpl> {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);
        const tcpConnection = new TCPConnection(socket, DEFAULT_TCP_CONFIG);

        await tcpConnection.connect(host, port);

        if (useTLS) {
            const tlsConnection = new TLSConnection(socket);
            await tlsConnection.connect(host);
            return tlsConnection.getSocket() as SocketImpl;
        }

        return socket;
    }

    /**
     * Wait for an available connection
     */
    private async waitForAvailableConnection(key: string): Promise<void> {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const pool = this.connections.get(key);
                if (pool) {
                    const hasIdle = pool.some((c) => c.state === ConnectionState.IDLE);
                    const activeCount = pool.filter((c) =>
                        c.state === ConnectionState.IN_USE
                    ).length;
                    if (hasIdle || activeCount < this.maxConnectionsPerOrigin) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                } else {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 10); // Check every 10ms
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
        }, 30000); // Clean up every 30 seconds
    }
}
