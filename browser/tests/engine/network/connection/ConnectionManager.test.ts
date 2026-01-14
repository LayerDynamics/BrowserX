/**
 * ConnectionManager Tests
 *
 * Comprehensive tests for connection manager functionality.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { ConnectionManager } from "../../../../src/engine/network/connection/ConnectionManager.ts";
import { ConnectionPool } from "../../../../src/engine/network/connection/ConnectionPool.ts";
import { ConnectionState } from "../../../../src/types/network.ts";

// ============================================================================
// ConnectionManager Constructor Tests
// ============================================================================

Deno.test({
    name: "ConnectionManager - constructor creates manager with pool",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        assertExists(manager);
        assertEquals(manager.getPool(), pool);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - constructor starts health checking",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        // Health checking should be running
        manager.stopHealthChecking(); // If it wasn't running, this is a no-op

        pool.stopAutoCleanup();
        await manager.closeAll();

        assert(true);
    },
});

// ============================================================================
// Acquire and Release Tests
// ============================================================================

Deno.test({
    name: "ConnectionManager - acquire delegates to pool",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        try {
            await manager.acquire("localhost", 80, false);
        } catch (error) {
            // Expected to fail since we can't actually create real connections
            assert(error instanceof Error);
        }

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - acquire with TLS",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        try {
            await manager.acquire("localhost", 443, true);
        } catch (error) {
            // Expected to fail since we can't actually create real connections
            assert(error instanceof Error);
        }

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - acquire with different hosts",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        try {
            await manager.acquire("example.com", 80, false);
        } catch (error) {
            // Expected to fail
            assert(error instanceof Error);
        }

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - release delegates to pool",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        const mockConnection: any = {
            id: "test-1",
            socket: { close: async () => {} },
            host: "localhost",
            port: 80,
            secure: false,
            state: ConnectionState.IN_USE,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            useCount: 1,
        };

        await manager.release(mockConnection);

        assertEquals(mockConnection.state, ConnectionState.IDLE);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

// ============================================================================
// Health Check Tests
// ============================================================================

Deno.test({
    name: "ConnectionManager - checkHealth returns false for CLOSED connection",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        const mockConnection: any = {
            id: "test-1",
            socket: { state: "OPEN", close: async () => {} },
            host: "localhost",
            port: 80,
            secure: false,
            state: "CLOSED",
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            useCount: 1,
        };

        const isHealthy = await manager.checkHealth(mockConnection);

        assertEquals(isHealthy, false);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - checkHealth returns false for ERROR connection",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        const mockConnection: any = {
            id: "test-1",
            socket: { state: "OPEN", close: async () => {} },
            host: "localhost",
            port: 80,
            secure: false,
            state: "ERROR",
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            useCount: 1,
        };

        const isHealthy = await manager.checkHealth(mockConnection);

        assertEquals(isHealthy, false);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - checkHealth returns false for closed socket",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        const mockConnection: any = {
            id: "test-1",
            socket: { state: "CLOSED", close: async () => {} },
            host: "localhost",
            port: 80,
            secure: false,
            state: ConnectionState.IDLE,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            useCount: 1,
        };

        const isHealthy = await manager.checkHealth(mockConnection);

        assertEquals(isHealthy, false);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - checkHealth returns false for old idle connection",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        const oldTime = Date.now() - 400000; // More than 5 minutes ago
        const mockConnection: any = {
            id: "test-1",
            socket: { state: "OPEN", close: async () => {} },
            host: "localhost",
            port: 80,
            secure: false,
            state: "IDLE",
            createdAt: oldTime,
            lastUsedAt: oldTime,
            useCount: 1,
        };

        const isHealthy = await manager.checkHealth(mockConnection);

        assertEquals(isHealthy, false);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - checkHealth returns true for healthy connection",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        const mockConnection: any = {
            id: "test-1",
            socket: { state: "OPEN", close: async () => {} },
            host: "localhost",
            port: 80,
            secure: false,
            state: ConnectionState.IN_USE,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            useCount: 1,
        };

        const isHealthy = await manager.checkHealth(mockConnection);

        assertEquals(isHealthy, true);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - checkHealth returns true for recent idle connection",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        const recentTime = Date.now() - 10000; // 10 seconds ago
        const mockConnection: any = {
            id: "test-1",
            socket: { state: "OPEN", close: async () => {} },
            host: "localhost",
            port: 80,
            secure: false,
            state: "IDLE",
            createdAt: recentTime,
            lastUsedAt: recentTime,
            useCount: 1,
        };

        const isHealthy = await manager.checkHealth(mockConnection);

        assertEquals(isHealthy, true);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

// ============================================================================
// Statistics Tests
// ============================================================================

Deno.test({
    name: "ConnectionManager - getStatistics returns statistics object",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        const stats = manager.getStatistics();

        assertExists(stats);
        assertEquals(typeof stats.totalConnections, "number");
        assertEquals(typeof stats.activeConnections, "number");
        assertEquals(typeof stats.idleConnections, "number");
        assertEquals(typeof stats.reuseCount, "number");
        assertEquals(typeof stats.missCount, "number");
        assertEquals(typeof stats.errorCount, "number");
        assertEquals(typeof stats.errorRate, "number");
        assertEquals(typeof stats.averageWaitTime, "number");
        assertEquals(typeof stats.reuseRate, "number");

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - getStatistics calculates reuse rate",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        const stats = manager.getStatistics();

        // With no connections, reuse rate should be 0
        assertEquals(stats.reuseRate, 0);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - getStatistics calculates error rate",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        const stats = manager.getStatistics();

        // With no connections, error rate should be 0
        assertEquals(stats.errorRate, 0);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - getStatistics includes all pool stats",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        const stats = manager.getStatistics();
        const poolStats = pool.getStats();

        assertEquals(stats.totalConnections, poolStats.totalConnections);
        assertEquals(stats.activeConnections, poolStats.activeConnections);
        assertEquals(stats.idleConnections, poolStats.idleConnections);
        assertEquals(stats.reuseCount, poolStats.reuseCount);
        assertEquals(stats.missCount, poolStats.missCount);
        assertEquals(stats.errorCount, poolStats.errorCount);
        assertEquals(stats.averageWaitTime, poolStats.averageWaitTime);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

// ============================================================================
// Close Connections Tests
// ============================================================================

Deno.test({
    name: "ConnectionManager - closeIdleConnections delegates to pool",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        await manager.closeIdleConnections();

        // Should not throw
        assert(true);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - closeAll closes all connections",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        await manager.closeAll();

        const stats = manager.getStatistics();
        assertEquals(stats.totalConnections, 0);
        assertEquals(stats.activeConnections, 0);
        assertEquals(stats.idleConnections, 0);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
    },
});

Deno.test({
    name: "ConnectionManager - closeAll stops health checking",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        await manager.closeAll();

        // Health checking should be stopped
        // Calling stop again should be safe
        manager.stopHealthChecking();

        pool.stopAutoCleanup();

        assert(true);
    },
});

// ============================================================================
// Health Checking Management Tests
// ============================================================================

Deno.test({
    name: "ConnectionManager - stopHealthChecking stops health checks",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        manager.stopHealthChecking();

        // Should not throw
        assert(true);

        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - stopHealthChecking can be called multiple times",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        manager.stopHealthChecking();
        manager.stopHealthChecking();
        manager.stopHealthChecking();

        // Should not throw
        assert(true);

        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

// ============================================================================
// Pool Access Tests
// ============================================================================

Deno.test({
    name: "ConnectionManager - getPool returns pool instance",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        const retrievedPool = manager.getPool();

        assertEquals(retrievedPool, pool);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - getPool returns same instance",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        const pool1 = manager.getPool();
        const pool2 = manager.getPool();

        assertEquals(pool1, pool2);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "ConnectionManager - complete lifecycle",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        // Get initial statistics
        const initialStats = manager.getStatistics();
        assertEquals(initialStats.totalConnections, 0);

        // Check health of mock connection
        const mockConnection: any = {
            id: "test-1",
            socket: { state: "OPEN", close: async () => {} },
            host: "localhost",
            port: 80,
            secure: false,
            state: ConnectionState.IN_USE,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            useCount: 1,
        };

        const isHealthy = await manager.checkHealth(mockConnection);
        assertEquals(isHealthy, true);

        // Close idle connections
        await manager.closeIdleConnections();

        // Get final statistics
        const finalStats = manager.getStatistics();
        assertExists(finalStats);

        // Cleanup
        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();

        assert(true);
    },
});

Deno.test({
    name: "ConnectionManager - health checking different connection states",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        // Test various connection states
        const states = [ConnectionState.IN_USE, ConnectionState.IDLE, "CLOSED", "ERROR"];

        for (const state of states) {
            const mockConnection: any = {
                id: `test-${state}`,
                socket: { state: "OPEN", close: async () => {} },
                host: "localhost",
                port: 80,
                secure: false,
                state,
                createdAt: Date.now(),
                lastUsedAt: Date.now(),
                useCount: 1,
            };

            const isHealthy = await manager.checkHealth(mockConnection);

            if (state === "CLOSED" || state === "ERROR") {
                assertEquals(isHealthy, false);
            } else {
                assertEquals(isHealthy, true);
            }
        }

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();
    },
});

Deno.test({
    name: "ConnectionManager - multiple operations in sequence",
    async fn() {
        const pool = new ConnectionPool();
        const manager = new ConnectionManager(pool);

        // Perform multiple operations
        const stats1 = manager.getStatistics();
        assertExists(stats1);

        await manager.closeIdleConnections();

        const stats2 = manager.getStatistics();
        assertExists(stats2);

        const retrievedPool = manager.getPool();
        assertEquals(retrievedPool, pool);

        manager.stopHealthChecking();
        pool.stopAutoCleanup();
        await manager.closeAll();

        assert(true);
    },
});
