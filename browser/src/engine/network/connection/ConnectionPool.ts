/**
 * Connection Pool Management
 *
 * Manages connection pooling and reuse for HTTP requests.
 * Implements per-origin connection limits and idle connection management.
 */

import type { ConnectionID, Port } from "../../../types/identifiers.ts";
import type { Certificate, PooledConnection, Socket } from "../../../types/network.ts";
import { ConnectionState } from "../../../types/network.ts";
import { AddressFamily, SocketImpl, SocketType } from "../primitives/Socket.ts";
import { type TCPConfig, TCPConnection } from "../primitives/TCPConnection.ts";
import { loadSystemCAs } from "../security/Certificate.ts";
import { TLSConnection } from "../security/TLSConnection.ts";
import { TLSSocket } from "../security/TLSSocket.ts";
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
    // Track pending acquisitions to prevent race conditions
    private pendingAcquisitions: Map<string, number> = new Map();
    // Lock to prevent race conditions in acquire
    private acquireLock: Map<string, Promise<void>> = new Map();
    // Cached system CA certificates for TLS validation
    private systemCAs: Certificate[] | null = null;
    private systemCAsLoading: Promise<Certificate[]> | null = null;

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
    async acquire(host: string, port: Port, useTLS: boolean, hostname?: string): Promise<PooledConnection> {
        const key = this.getConnectionKey(host, port, useTLS, hostname);

        // Wait for any pending acquire operation on this key to complete
        while (this.acquireLock.has(key)) {
            await this.acquireLock.get(key);
        }

        // Create a new lock for this acquisition
        let releaseLock: () => void;
        const lockPromise = new Promise<void>((resolve) => {
            releaseLock = resolve;
        });
        this.acquireLock.set(key, lockPromise);

        try {
            return await this.acquireInternal(host, port, useTLS, hostname, key);
        } finally {
            this.acquireLock.delete(key);
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
            // Wait for an available connection
            this.stats.missCount++;
            const waitStart = Date.now();
            await this.waitForAvailableConnection(key);
            const waitTime = Date.now() - waitStart;
            this.updateAverageWaitTime(waitTime);
            // Retry acquisition after waiting
            return this.acquireInternal(host, port, useTLS, hostname, key);
        }

        // Track this pending acquisition to prevent over-allocation
        this.pendingAcquisitions.set(key, pendingCount + 1);

        // Create new connection
        // Increment miss count since we're not reusing an existing connection
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
    private async createConnection(host: string, port: Port, useTLS: boolean, sniHostname?: string): Promise<Socket> {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);
        const tcpConnection = new TCPConnection(socket, DEFAULT_TCP_CONFIG);

        // Establish TCP connection first (using IP address)
        await tcpConnection.connect(host, port);

        if (useTLS) {
            // Use provided SNI hostname, or fall back to host if not provided
            const tlsServerName = sniHostname || host;

            // Load system CA certificates for validation
            const trustedCAs = await this.getSystemCAs();

            // Create TLS connection over established TCP
            // Certificate validation enabled for production security
            const tlsConnection = new TLSConnection(socket, {
                minVersion: 0x0303, // TLS 1.2 minimum for broad compatibility
                maxVersion: 0x0304, // TLS 1.3
                cipherSuites: [
                    // TLS 1.3 cipher suites
                    0x1301, 0x1302, 0x1303,
                    // TLS 1.2 cipher suites (for servers that don't support TLS 1.3)
                    0xc02b, 0xc02f, 0xc02c, 0xc030, 0xcca9, 0xcca8,
                ],
                verifyPeerCertificate: true, // Enable certificate validation for security
                trustedCAs, // System root CA certificates
                allowSelfSigned: false, // Reject self-signed certificates in production
                serverName: tlsServerName, // Use hostname for SNI, not IP address
                alpnProtocols: ["http/1.1"],
                enableSessionResumption: false,
                sessionTicketLifetime: 7200000,
            });

            // Perform TLS handshake
            await tlsConnection.connect(tlsServerName);

            // Return TLSSocket wrapper for encrypted I/O
            return new TLSSocket(tlsConnection);
        }

        return socket;
    }

    /**
     * Wait for an available connection with timeout
     */
    private async waitForAvailableConnection(key: string, timeoutMs: number = 30000): Promise<void> {
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                // Check for timeout
                if (Date.now() - startTime > timeoutMs) {
                    clearInterval(checkInterval);
                    reject(new Error(`Connection pool timeout waiting for available connection to ${key}`));
                    return;
                }

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
                    // No pool exists, can create new connection
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
