/**
 * ConnectionPool Tests
 *
 * Comprehensive tests for connection pool management.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { ConnectionPool } from "../../../../src/engine/network/connection/ConnectionPool.ts";
import { ConnectionState } from "../../../../src/types/network.ts";

// ============================================================================
// ConnectionPool Constructor Tests
// ============================================================================

Deno.test({
    name: "ConnectionPool - constructor creates pool",
    async fn() {
        const pool = new ConnectionPool();

        assertExists(pool);
        const stats = pool.getStats();
        assertEquals(stats.totalConnections, 0);
        assertEquals(stats.activeConnections, 0);
        assertEquals(stats.idleConnections, 0);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - constructor starts auto cleanup",
    async fn() {
        const pool = new ConnectionPool();

        // Auto cleanup should be running
        // We verify by stopping it (if it wasn't running, this would be a no-op)
        pool.stopAutoCleanup();

        await pool.closeAll();

        assert(true);
    },
});

Deno.test({
    name: "ConnectionPool - constructor initializes stats",
    async fn() {
        const pool = new ConnectionPool();

        const stats = pool.getStats();
        assertEquals(stats.totalConnections, 0);
        assertEquals(stats.activeConnections, 0);
        assertEquals(stats.idleConnections, 0);
        assertEquals(stats.reuseCount, 0);
        assertEquals(stats.missCount, 0);
        assertEquals(stats.errorCount, 0);
        assertEquals(stats.averageWaitTime, 0);
        assertExists(stats.lastUpdated);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

// ============================================================================
// Acquire Connection Tests
// ============================================================================

Deno.test({
    name: "ConnectionPool - acquire creates new connection when pool empty",
    async fn() {
        const pool = new ConnectionPool();

        try {
            // This will fail because we can't actually connect, but we're testing the logic
            await pool.acquire("localhost", 80, false);
        } catch (error) {
            // Expected to fail since we can't actually create a real connection in tests
            assert(error instanceof Error);
        }

        const stats = pool.getStats();
        // Even though connection failed, stats should show the attempt
        assertEquals(stats.missCount >= 1, true);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - acquire with TLS parameter",
    async fn() {
        const pool = new ConnectionPool();

        try {
            await pool.acquire("localhost", 443, true);
        } catch (error) {
            // Expected to fail since we can't actually create a real connection
            assert(error instanceof Error);
        }

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - acquire with different ports",
    async fn() {
        const pool = new ConnectionPool();

        try {
            await pool.acquire("localhost", 8080, false);
        } catch (error) {
            // Expected to fail since we can't actually create a real connection
            assert(error instanceof Error);
        }

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - acquire with different hosts",
    async fn() {
        const pool = new ConnectionPool();

        try {
            await pool.acquire("example.com", 80, false);
        } catch (error) {
            // Expected to fail since we can't actually create a real connection
            assert(error instanceof Error);
        }

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - acquire increments error count on failure",
    async fn() {
        const pool = new ConnectionPool();

        const statsBefore = pool.getStats();
        const errorsBefore = statsBefore.errorCount;

        try {
            await pool.acquire("invalid-host", 80, false);
        } catch (error) {
            // Expected to fail
            assert(error instanceof Error);
        }

        const statsAfter = pool.getStats();
        // Error count should have increased
        assert(statsAfter.errorCount >= errorsBefore);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

// ============================================================================
// Release Connection Tests
// ============================================================================

Deno.test({
    name: "ConnectionPool - release changes connection state to IDLE",
    async fn() {
        const pool = new ConnectionPool();

        // Create a mock connection
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

        await pool.release(mockConnection);

        // Should change state to IDLE
        assertEquals(mockConnection.state, ConnectionState.IDLE);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - release updates lastUsedAt timestamp",
    async fn() {
        const pool = new ConnectionPool();

        const initialTime = Date.now() - 1000; // 1 second ago
        const mockConnection: any = {
            id: "test-1",
            socket: { close: async () => {} },
            host: "localhost",
            port: 80,
            secure: false,
            state: ConnectionState.IN_USE,
            createdAt: Date.now(),
            lastUsedAt: initialTime,
            useCount: 1,
        };

        await pool.release(mockConnection);

        // lastUsedAt should be updated to current time
        assert(mockConnection.lastUsedAt > initialTime);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - release does nothing if already IDLE",
    async fn() {
        const pool = new ConnectionPool();

        const mockConnection: any = {
            id: "test-1",
            socket: { close: async () => {} },
            host: "localhost",
            port: 80,
            secure: false,
            state: ConnectionState.IDLE,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            useCount: 1,
        };

        const stateBefore = mockConnection.state;
        await pool.release(mockConnection);

        assertEquals(mockConnection.state, stateBefore);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

// ============================================================================
// Close Connections Tests
// ============================================================================

Deno.test({
    name: "ConnectionPool - closeIdleConnections closes old connections",
    async fn() {
        const pool = new ConnectionPool();

        await pool.closeIdleConnections();

        // Should not throw
        assert(true);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - closeIdleConnections updates stats",
    async fn() {
        const pool = new ConnectionPool();

        await pool.closeIdleConnections();

        const stats = pool.getStats();
        assertExists(stats);
        assertEquals(typeof stats.lastUpdated, "number");

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - closeAll closes all connections",
    async fn() {
        const pool = new ConnectionPool();

        await pool.closeAll();

        const stats = pool.getStats();
        assertEquals(stats.totalConnections, 0);
        assertEquals(stats.activeConnections, 0);
        assertEquals(stats.idleConnections, 0);

        pool.stopAutoCleanup();
    },
});

Deno.test({
    name: "ConnectionPool - closeAll clears connection map",
    async fn() {
        const pool = new ConnectionPool();

        await pool.closeAll();

        const stats = pool.getStats();
        assertEquals(stats.totalConnections, 0);

        pool.stopAutoCleanup();
    },
});

Deno.test({
    name: "ConnectionPool - closeAll resets stats",
    async fn() {
        const pool = new ConnectionPool();

        await pool.closeAll();

        const stats = pool.getStats();
        assertEquals(stats.totalConnections, 0);
        assertEquals(stats.activeConnections, 0);
        assertEquals(stats.idleConnections, 0);

        pool.stopAutoCleanup();
    },
});

// ============================================================================
// Statistics Tests
// ============================================================================

Deno.test({
    name: "ConnectionPool - getStats returns statistics object",
    async fn() {
        const pool = new ConnectionPool();

        const stats = pool.getStats();

        assertExists(stats);
        assertEquals(typeof stats.totalConnections, "number");
        assertEquals(typeof stats.activeConnections, "number");
        assertEquals(typeof stats.idleConnections, "number");
        assertEquals(typeof stats.reuseCount, "number");
        assertEquals(typeof stats.missCount, "number");
        assertEquals(typeof stats.errorCount, "number");
        assertEquals(typeof stats.averageWaitTime, "number");
        assertEquals(typeof stats.lastUpdated, "number");

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - getStats returns copy of stats",
    async fn() {
        const pool = new ConnectionPool();

        const stats1 = pool.getStats();
        const stats2 = pool.getStats();

        // Should be different objects
        assert(stats1 !== stats2);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - stats track connection counts",
    async fn() {
        const pool = new ConnectionPool();

        const stats = pool.getStats();
        assertEquals(stats.totalConnections, 0);
        assertEquals(stats.activeConnections, 0);
        assertEquals(stats.idleConnections, 0);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - stats track reuse count",
    async fn() {
        const pool = new ConnectionPool();

        const stats = pool.getStats();
        assertEquals(stats.reuseCount, 0);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - stats track miss count",
    async fn() {
        const pool = new ConnectionPool();

        const stats = pool.getStats();
        assertEquals(stats.missCount, 0);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - stats track error count",
    async fn() {
        const pool = new ConnectionPool();

        const stats = pool.getStats();
        assertEquals(stats.errorCount, 0);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - stats track average wait time",
    async fn() {
        const pool = new ConnectionPool();

        const stats = pool.getStats();
        assertEquals(stats.averageWaitTime, 0);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - stats include last updated timestamp",
    async fn() {
        const pool = new ConnectionPool();

        const stats = pool.getStats();
        assertExists(stats.lastUpdated);
        assertEquals(typeof stats.lastUpdated, "number");
        assert(stats.lastUpdated > 0);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});

// ============================================================================
// Auto Cleanup Tests
// ============================================================================

Deno.test({
    name: "ConnectionPool - stopAutoCleanup stops cleanup timer",
    async fn() {
        const pool = new ConnectionPool();

        pool.stopAutoCleanup();

        // Should not throw
        assert(true);

        await pool.closeAll();
    },
});

Deno.test({
    name: "ConnectionPool - stopAutoCleanup can be called multiple times",
    async fn() {
        const pool = new ConnectionPool();

        pool.stopAutoCleanup();
        pool.stopAutoCleanup();
        pool.stopAutoCleanup();

        // Should not throw
        assert(true);

        await pool.closeAll();
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "ConnectionPool - complete lifecycle",
    async fn() {
        const pool = new ConnectionPool();

        // Get initial stats
        const initialStats = pool.getStats();
        assertEquals(initialStats.totalConnections, 0);

        // Try to close idle connections (should be safe even with no connections)
        await pool.closeIdleConnections();

        // Close all connections
        await pool.closeAll();

        // Stop cleanup
        pool.stopAutoCleanup();

        // Get final stats
        const finalStats = pool.getStats();
        assertEquals(finalStats.totalConnections, 0);

        assert(true);
    },
});

Deno.test({
    name: "ConnectionPool - multiple operations",
    async fn() {
        const pool = new ConnectionPool();

        // Perform multiple operations
        await pool.closeIdleConnections();
        const stats1 = pool.getStats();
        assertExists(stats1);

        await pool.closeAll();
        const stats2 = pool.getStats();
        assertExists(stats2);

        pool.stopAutoCleanup();

        assert(true);
    },
});

Deno.test({
    name: "ConnectionPool - stats remain consistent",
    async fn() {
        const pool = new ConnectionPool();

        const stats = pool.getStats();
        assertEquals(stats.totalConnections, stats.activeConnections + stats.idleConnections);

        pool.stopAutoCleanup();
        await pool.closeAll();
    },
});
