/**
 * ConnectionPoolStats Tests
 *
 * Comprehensive tests for connection pool statistics.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { createConnectionPoolStats, type ConnectionPoolStats } from "../../../../src/engine/network/connection/ConnectionPoolStats.ts";

// ============================================================================
// createConnectionPoolStats Tests
// ============================================================================

Deno.test({
    name: "createConnectionPoolStats - creates stats object",
    fn() {
        const stats = createConnectionPoolStats();

        assertExists(stats);
    },
});

Deno.test({
    name: "createConnectionPoolStats - initializes totalConnections to 0",
    fn() {
        const stats = createConnectionPoolStats();

        assertEquals(stats.totalConnections, 0);
    },
});

Deno.test({
    name: "createConnectionPoolStats - initializes activeConnections to 0",
    fn() {
        const stats = createConnectionPoolStats();

        assertEquals(stats.activeConnections, 0);
    },
});

Deno.test({
    name: "createConnectionPoolStats - initializes idleConnections to 0",
    fn() {
        const stats = createConnectionPoolStats();

        assertEquals(stats.idleConnections, 0);
    },
});

Deno.test({
    name: "createConnectionPoolStats - initializes reuseCount to 0",
    fn() {
        const stats = createConnectionPoolStats();

        assertEquals(stats.reuseCount, 0);
    },
});

Deno.test({
    name: "createConnectionPoolStats - initializes missCount to 0",
    fn() {
        const stats = createConnectionPoolStats();

        assertEquals(stats.missCount, 0);
    },
});

Deno.test({
    name: "createConnectionPoolStats - initializes errorCount to 0",
    fn() {
        const stats = createConnectionPoolStats();

        assertEquals(stats.errorCount, 0);
    },
});

Deno.test({
    name: "createConnectionPoolStats - initializes averageWaitTime to 0",
    fn() {
        const stats = createConnectionPoolStats();

        assertEquals(stats.averageWaitTime, 0);
    },
});

Deno.test({
    name: "createConnectionPoolStats - sets lastUpdated timestamp",
    fn() {
        const stats = createConnectionPoolStats();

        assertExists(stats.lastUpdated);
        assertEquals(typeof stats.lastUpdated, "number");
        assert(stats.lastUpdated > 0);
    },
});

Deno.test({
    name: "createConnectionPoolStats - creates new object each time",
    fn() {
        const stats1 = createConnectionPoolStats();
        const stats2 = createConnectionPoolStats();

        assert(stats1 !== stats2);
    },
});

Deno.test({
    name: "createConnectionPoolStats - stats are mutable",
    fn() {
        const stats = createConnectionPoolStats();

        stats.totalConnections = 10;
        stats.activeConnections = 5;
        stats.idleConnections = 5;

        assertEquals(stats.totalConnections, 10);
        assertEquals(stats.activeConnections, 5);
        assertEquals(stats.idleConnections, 5);
    },
});

Deno.test({
    name: "createConnectionPoolStats - all properties have correct types",
    fn() {
        const stats = createConnectionPoolStats();

        assertEquals(typeof stats.totalConnections, "number");
        assertEquals(typeof stats.activeConnections, "number");
        assertEquals(typeof stats.idleConnections, "number");
        assertEquals(typeof stats.reuseCount, "number");
        assertEquals(typeof stats.missCount, "number");
        assertEquals(typeof stats.errorCount, "number");
        assertEquals(typeof stats.averageWaitTime, "number");
        assertEquals(typeof stats.lastUpdated, "number");
    },
});
