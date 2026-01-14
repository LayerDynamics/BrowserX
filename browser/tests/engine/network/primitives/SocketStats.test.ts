/**
 * SocketStats Tests
 *
 * Comprehensive tests for socket statistics tracking.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    createSocketStats,
    recordReadOperation,
    recordWriteOperation,
    recordError,
    type SocketStats,
} from "../../../../src/engine/network/primitives/SocketStats.ts";

// ============================================================================
// createSocketStats Tests
// ============================================================================

Deno.test({
    name: "createSocketStats - creates stats object",
    fn() {
        const stats = createSocketStats();

        assertExists(stats);
    },
});

Deno.test({
    name: "createSocketStats - initializes bytesRead to 0",
    fn() {
        const stats = createSocketStats();

        assertEquals(stats.bytesRead, 0);
    },
});

Deno.test({
    name: "createSocketStats - initializes bytesWritten to 0",
    fn() {
        const stats = createSocketStats();

        assertEquals(stats.bytesWritten, 0);
    },
});

Deno.test({
    name: "createSocketStats - initializes readOperations to 0",
    fn() {
        const stats = createSocketStats();

        assertEquals(stats.readOperations, 0);
    },
});

Deno.test({
    name: "createSocketStats - initializes writeOperations to 0",
    fn() {
        const stats = createSocketStats();

        assertEquals(stats.writeOperations, 0);
    },
});

Deno.test({
    name: "createSocketStats - initializes errors to 0",
    fn() {
        const stats = createSocketStats();

        assertEquals(stats.errors, 0);
    },
});

Deno.test({
    name: "createSocketStats - sets createdAt timestamp",
    fn() {
        const stats = createSocketStats();

        assertExists(stats.createdAt);
        assertEquals(typeof stats.createdAt, "number");
        assert(stats.createdAt > 0);
    },
});

Deno.test({
    name: "createSocketStats - sets lastActiveAt timestamp",
    fn() {
        const stats = createSocketStats();

        assertExists(stats.lastActiveAt);
        assertEquals(typeof stats.lastActiveAt, "number");
        assert(stats.lastActiveAt > 0);
    },
});

Deno.test({
    name: "createSocketStats - createdAt and lastActiveAt are same initially",
    fn() {
        const stats = createSocketStats();

        assertEquals(stats.createdAt, stats.lastActiveAt);
    },
});

Deno.test({
    name: "createSocketStats - creates new object each time",
    fn() {
        const stats1 = createSocketStats();
        const stats2 = createSocketStats();

        assert(stats1 !== stats2);
    },
});

Deno.test({
    name: "createSocketStats - all properties have correct types",
    fn() {
        const stats = createSocketStats();

        assertEquals(typeof stats.bytesRead, "number");
        assertEquals(typeof stats.bytesWritten, "number");
        assertEquals(typeof stats.readOperations, "number");
        assertEquals(typeof stats.writeOperations, "number");
        assertEquals(typeof stats.errors, "number");
        assertEquals(typeof stats.createdAt, "number");
        assertEquals(typeof stats.lastActiveAt, "number");
    },
});

// ============================================================================
// recordReadOperation Tests
// ============================================================================

Deno.test({
    name: "recordReadOperation - increments bytesRead",
    fn() {
        const stats = createSocketStats();

        recordReadOperation(stats, 100);

        assertEquals(stats.bytesRead, 100);
    },
});

Deno.test({
    name: "recordReadOperation - accumulates bytesRead",
    fn() {
        const stats = createSocketStats();

        recordReadOperation(stats, 100);
        recordReadOperation(stats, 200);
        recordReadOperation(stats, 50);

        assertEquals(stats.bytesRead, 350);
    },
});

Deno.test({
    name: "recordReadOperation - increments readOperations count",
    fn() {
        const stats = createSocketStats();

        recordReadOperation(stats, 100);

        assertEquals(stats.readOperations, 1);
    },
});

Deno.test({
    name: "recordReadOperation - increments count for each call",
    fn() {
        const stats = createSocketStats();

        recordReadOperation(stats, 100);
        recordReadOperation(stats, 200);
        recordReadOperation(stats, 300);

        assertEquals(stats.readOperations, 3);
    },
});

Deno.test({
    name: "recordReadOperation - updates lastActiveAt",
    fn() {
        const stats = createSocketStats();
        const initialTime = stats.lastActiveAt;

        // Small delay to ensure timestamp changes
        const startTime = Date.now();
        while (Date.now() === startTime) {
            // Wait for time to advance
        }

        recordReadOperation(stats, 100);

        assert(stats.lastActiveAt > initialTime);
    },
});

Deno.test({
    name: "recordReadOperation - handles zero bytes",
    fn() {
        const stats = createSocketStats();

        recordReadOperation(stats, 0);

        assertEquals(stats.bytesRead, 0);
        assertEquals(stats.readOperations, 1);
    },
});

Deno.test({
    name: "recordReadOperation - handles large byte counts",
    fn() {
        const stats = createSocketStats();

        recordReadOperation(stats, 1048576); // 1 MB

        assertEquals(stats.bytesRead, 1048576);
    },
});

Deno.test({
    name: "recordReadOperation - does not affect bytesWritten",
    fn() {
        const stats = createSocketStats();

        recordReadOperation(stats, 100);

        assertEquals(stats.bytesWritten, 0);
    },
});

Deno.test({
    name: "recordReadOperation - does not affect writeOperations",
    fn() {
        const stats = createSocketStats();

        recordReadOperation(stats, 100);

        assertEquals(stats.writeOperations, 0);
    },
});

// ============================================================================
// recordWriteOperation Tests
// ============================================================================

Deno.test({
    name: "recordWriteOperation - increments bytesWritten",
    fn() {
        const stats = createSocketStats();

        recordWriteOperation(stats, 100);

        assertEquals(stats.bytesWritten, 100);
    },
});

Deno.test({
    name: "recordWriteOperation - accumulates bytesWritten",
    fn() {
        const stats = createSocketStats();

        recordWriteOperation(stats, 100);
        recordWriteOperation(stats, 200);
        recordWriteOperation(stats, 50);

        assertEquals(stats.bytesWritten, 350);
    },
});

Deno.test({
    name: "recordWriteOperation - increments writeOperations count",
    fn() {
        const stats = createSocketStats();

        recordWriteOperation(stats, 100);

        assertEquals(stats.writeOperations, 1);
    },
});

Deno.test({
    name: "recordWriteOperation - increments count for each call",
    fn() {
        const stats = createSocketStats();

        recordWriteOperation(stats, 100);
        recordWriteOperation(stats, 200);
        recordWriteOperation(stats, 300);

        assertEquals(stats.writeOperations, 3);
    },
});

Deno.test({
    name: "recordWriteOperation - updates lastActiveAt",
    fn() {
        const stats = createSocketStats();
        const initialTime = stats.lastActiveAt;

        // Small delay to ensure timestamp changes
        const startTime = Date.now();
        while (Date.now() === startTime) {
            // Wait for time to advance
        }

        recordWriteOperation(stats, 100);

        assert(stats.lastActiveAt > initialTime);
    },
});

Deno.test({
    name: "recordWriteOperation - handles zero bytes",
    fn() {
        const stats = createSocketStats();

        recordWriteOperation(stats, 0);

        assertEquals(stats.bytesWritten, 0);
        assertEquals(stats.writeOperations, 1);
    },
});

Deno.test({
    name: "recordWriteOperation - handles large byte counts",
    fn() {
        const stats = createSocketStats();

        recordWriteOperation(stats, 1048576); // 1 MB

        assertEquals(stats.bytesWritten, 1048576);
    },
});

Deno.test({
    name: "recordWriteOperation - does not affect bytesRead",
    fn() {
        const stats = createSocketStats();

        recordWriteOperation(stats, 100);

        assertEquals(stats.bytesRead, 0);
    },
});

Deno.test({
    name: "recordWriteOperation - does not affect readOperations",
    fn() {
        const stats = createSocketStats();

        recordWriteOperation(stats, 100);

        assertEquals(stats.readOperations, 0);
    },
});

// ============================================================================
// recordError Tests
// ============================================================================

Deno.test({
    name: "recordError - increments error count",
    fn() {
        const stats = createSocketStats();

        recordError(stats);

        assertEquals(stats.errors, 1);
    },
});

Deno.test({
    name: "recordError - accumulates errors",
    fn() {
        const stats = createSocketStats();

        recordError(stats);
        recordError(stats);
        recordError(stats);

        assertEquals(stats.errors, 3);
    },
});

Deno.test({
    name: "recordError - updates lastActiveAt",
    fn() {
        const stats = createSocketStats();
        const initialTime = stats.lastActiveAt;

        // Small delay to ensure timestamp changes
        const startTime = Date.now();
        while (Date.now() === startTime) {
            // Wait for time to advance
        }

        recordError(stats);

        assert(stats.lastActiveAt > initialTime);
    },
});

Deno.test({
    name: "recordError - does not affect bytesRead",
    fn() {
        const stats = createSocketStats();

        recordError(stats);

        assertEquals(stats.bytesRead, 0);
    },
});

Deno.test({
    name: "recordError - does not affect bytesWritten",
    fn() {
        const stats = createSocketStats();

        recordError(stats);

        assertEquals(stats.bytesWritten, 0);
    },
});

Deno.test({
    name: "recordError - does not affect readOperations",
    fn() {
        const stats = createSocketStats();

        recordError(stats);

        assertEquals(stats.readOperations, 0);
    },
});

Deno.test({
    name: "recordError - does not affect writeOperations",
    fn() {
        const stats = createSocketStats();

        recordError(stats);

        assertEquals(stats.writeOperations, 0);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "SocketStats - complete usage scenario",
    fn() {
        const stats = createSocketStats();

        // Perform some reads
        recordReadOperation(stats, 1024);
        recordReadOperation(stats, 2048);

        // Perform some writes
        recordWriteOperation(stats, 512);
        recordWriteOperation(stats, 1024);
        recordWriteOperation(stats, 256);

        // Record an error
        recordError(stats);

        // Verify final state
        assertEquals(stats.bytesRead, 3072);
        assertEquals(stats.bytesWritten, 1792);
        assertEquals(stats.readOperations, 2);
        assertEquals(stats.writeOperations, 3);
        assertEquals(stats.errors, 1);
        assert(stats.lastActiveAt > stats.createdAt);
    },
});

Deno.test({
    name: "SocketStats - mixed operations",
    fn() {
        const stats = createSocketStats();

        recordReadOperation(stats, 100);
        recordWriteOperation(stats, 200);
        recordReadOperation(stats, 150);
        recordError(stats);
        recordWriteOperation(stats, 300);

        assertEquals(stats.bytesRead, 250);
        assertEquals(stats.bytesWritten, 500);
        assertEquals(stats.readOperations, 2);
        assertEquals(stats.writeOperations, 2);
        assertEquals(stats.errors, 1);
    },
});

Deno.test({
    name: "SocketStats - high volume operations",
    fn() {
        const stats = createSocketStats();

        // Simulate many operations
        for (let i = 0; i < 1000; i++) {
            recordReadOperation(stats, 1024);
            recordWriteOperation(stats, 512);
        }

        assertEquals(stats.bytesRead, 1024000);
        assertEquals(stats.bytesWritten, 512000);
        assertEquals(stats.readOperations, 1000);
        assertEquals(stats.writeOperations, 1000);
    },
});

Deno.test({
    name: "SocketStats - lastActiveAt tracks most recent activity",
    fn() {
        const stats = createSocketStats();

        recordReadOperation(stats, 100);
        const afterRead = stats.lastActiveAt;

        // Wait for time to advance
        const startTime = Date.now();
        while (Date.now() === startTime) {
            // Wait
        }

        recordWriteOperation(stats, 100);
        const afterWrite = stats.lastActiveAt;

        assert(afterWrite > afterRead);

        // Wait again
        const nextTime = Date.now();
        while (Date.now() === nextTime) {
            // Wait
        }

        recordError(stats);
        const afterError = stats.lastActiveAt;

        assert(afterError > afterWrite);
    },
});

Deno.test({
    name: "SocketStats - independent stat objects",
    fn() {
        const stats1 = createSocketStats();
        const stats2 = createSocketStats();

        recordReadOperation(stats1, 100);
        recordWriteOperation(stats2, 200);

        assertEquals(stats1.bytesRead, 100);
        assertEquals(stats1.bytesWritten, 0);
        assertEquals(stats2.bytesRead, 0);
        assertEquals(stats2.bytesWritten, 200);
    },
});

Deno.test({
    name: "SocketStats - all operations update lastActiveAt",
    fn() {
        const stats = createSocketStats();
        const initialTime = stats.lastActiveAt;

        // Wait for time to advance
        let startTime = Date.now();
        while (Date.now() === startTime) {
            // Wait
        }

        recordReadOperation(stats, 100);
        assert(stats.lastActiveAt > initialTime);
        const afterRead = stats.lastActiveAt;

        startTime = Date.now();
        while (Date.now() === startTime) {
            // Wait
        }

        recordWriteOperation(stats, 100);
        assert(stats.lastActiveAt > afterRead);
        const afterWrite = stats.lastActiveAt;

        startTime = Date.now();
        while (Date.now() === startTime) {
            // Wait
        }

        recordError(stats);
        assert(stats.lastActiveAt > afterWrite);
    },
});

Deno.test({
    name: "SocketStats - calculate statistics",
    fn() {
        const stats = createSocketStats();

        recordReadOperation(stats, 1024);
        recordReadOperation(stats, 2048);
        recordReadOperation(stats, 512);

        // Calculate average bytes per read
        const avgBytesPerRead = stats.bytesRead / stats.readOperations;
        assertEquals(avgBytesPerRead, 1194.6666666666667);

        recordWriteOperation(stats, 3072);
        recordWriteOperation(stats, 1536);

        // Calculate average bytes per write
        const avgBytesPerWrite = stats.bytesWritten / stats.writeOperations;
        assertEquals(avgBytesPerWrite, 2304);
    },
});
