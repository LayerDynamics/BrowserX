/**
 * Connection Manager
 *
 * High-level connection management including pool coordination,
 * connection health checking, and statistics tracking.
 */

import { ConnectionPool } from "./ConnectionPool.ts";
import type { PooledConnection } from "../../../types/network.ts";
import type { Port } from "../../../types/identifiers.ts";

/**
 * Connection statistics
 */
export interface ConnectionStatistics {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    reuseCount: number;
    missCount: number;
    errorCount: number;
    errorRate: number;
    averageWaitTime: number;
    reuseRate: number;
}

export class ConnectionManager {
    private pool: ConnectionPool;
    private healthCheckInterval: number | null = null;
    private healthCheckIntervalMs: number = 60000; // 60 seconds

    constructor(pool: ConnectionPool) {
        this.pool = pool;
        this.startHealthChecking();
    }

    /**
     * Acquire connection from pool
     *
     * @param host - Target host
     * @param port - Target port
     * @param useTLS - Whether to use TLS
     * @returns Pooled connection
     */
    async acquire(host: string, port: Port, useTLS: boolean): Promise<PooledConnection> {
        return this.pool.acquire(host, port, useTLS);
    }

    /**
     * Release connection back to pool
     *
     * @param connection - Connection to release
     */
    async release(connection: PooledConnection): Promise<void> {
        return this.pool.release(connection);
    }

    /**
     * Check connection health
     *
     * @param connection - Connection to check
     * @returns Whether connection is healthy
     */
    async checkHealth(connection: PooledConnection): Promise<boolean> {
        try {
            // Check if connection is in valid state
            if (connection.state === "CLOSED" || connection.state === "ERROR") {
                return false;
            }

            // Check if socket is still open
            if (connection.socket.state !== "OPEN") {
                return false;
            }

            // Check if connection has been idle too long (more than 5 minutes)
            const idleTime = Date.now() - connection.lastUsedAt;
            if (idleTime > 300000 && connection.state === "IDLE") {
                return false;
            }

            // For more robust health checking, could implement:
            // - TCP keep-alive probes
            // - Application-level ping/pong
            // - TLS session validation

            return true;
        } catch (error) {
            console.error("Health check failed:", error);
            return false;
        }
    }

    /**
     * Get connection statistics
     */
    getStatistics(): ConnectionStatistics {
        const poolStats = this.pool.getStats();

        const totalRequests = poolStats.reuseCount + poolStats.missCount;
        const reuseRate = totalRequests > 0 ? poolStats.reuseCount / totalRequests : 0;
        const errorRate = totalRequests > 0 ? poolStats.errorCount / totalRequests : 0;

        return {
            totalConnections: poolStats.totalConnections,
            activeConnections: poolStats.activeConnections,
            idleConnections: poolStats.idleConnections,
            reuseCount: poolStats.reuseCount,
            missCount: poolStats.missCount,
            errorCount: poolStats.errorCount,
            errorRate,
            averageWaitTime: poolStats.averageWaitTime,
            reuseRate,
        };
    }

    /**
     * Close idle connections
     */
    async closeIdleConnections(): Promise<void> {
        return this.pool.closeIdleConnections();
    }

    /**
     * Close all connections
     */
    async closeAll(): Promise<void> {
        this.stopHealthChecking();
        return this.pool.closeAll();
    }

    /**
     * Stop automatic health checking
     */
    stopHealthChecking(): void {
        if (this.healthCheckInterval !== null) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    /**
     * Get connection pool
     */
    getPool(): ConnectionPool {
        return this.pool;
    }

    /**
     * Start automatic health checking
     */
    private startHealthChecking(): void {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthChecks().catch((error) => {
                console.error("Error during health checks:", error);
            });
        }, this.healthCheckIntervalMs);
    }

    /**
     * Perform health checks on all idle connections
     */
    private async performHealthChecks(): Promise<void> {
        const poolStats = this.pool.getStats();

        // Only perform health checks if we have idle connections
        if (poolStats.idleConnections > 0) {
            await this.pool.closeIdleConnections();
        }
    }
}
