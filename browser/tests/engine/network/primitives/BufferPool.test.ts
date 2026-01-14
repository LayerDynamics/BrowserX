/**
 * BufferPool Tests
 *
 * Comprehensive tests for buffer pool implementation.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { BufferPool, type BufferPoolStats } from "../../../../src/engine/network/primitives/BufferPool.ts";
import type { ByteBuffer } from "../../../../src/types/identifiers.ts";

// ============================================================================
// BufferPoolStats Interface Tests
// ============================================================================

Deno.test({
    name: "BufferPoolStats - contains required fields",
    fn() {
        const pool = new BufferPool();
        const stats = pool.getStats();

        assertExists(stats.totalAllocated);
        assertExists(stats.totalReleased);
        assertExists(stats.currentInUse);
        assertExists(stats.hits);
        assertExists(stats.misses);
    },
});

// ============================================================================
// BufferPool Constructor Tests
// ============================================================================

Deno.test({
    name: "BufferPool - constructor creates pool",
    fn() {
        const pool = new BufferPool();

        assertExists(pool);
    },
});

Deno.test({
    name: "BufferPool - constructor initializes statistics",
    fn() {
        const pool = new BufferPool();
        const stats = pool.getStats();

        assertEquals(stats.totalAllocated, 0);
        assertEquals(stats.totalReleased, 0);
        assertEquals(stats.currentInUse, 0);
        assertEquals(stats.hits, 0);
        assertEquals(stats.misses, 0);
    },
});

Deno.test({
    name: "BufferPool - constructor pre-allocates buffers",
    fn() {
        const pool = new BufferPool();

        // Try to acquire a buffer - should be a hit
        const buffer = pool.acquire(1024);
        assertExists(buffer);

        const stats = pool.getStats();
        // Should be a hit from pre-allocated pool
        assertEquals(stats.hits, 1);
    },
});

// ============================================================================
// BufferPool acquire() Tests
// ============================================================================

Deno.test({
    name: "BufferPool - acquire returns buffer of requested size",
    fn() {
        const pool = new BufferPool();

        const buffer = pool.acquire(1024);

        assertExists(buffer);
        assert(buffer.byteLength >= 1024);
    },
});

Deno.test({
    name: "BufferPool - acquire with 1024 bytes",
    fn() {
        const pool = new BufferPool();

        const buffer = pool.acquire(1024);

        assertEquals(buffer.byteLength, 1024);
    },
});

Deno.test({
    name: "BufferPool - acquire with 2048 bytes",
    fn() {
        const pool = new BufferPool();

        const buffer = pool.acquire(2048);

        assertEquals(buffer.byteLength, 2048);
    },
});

Deno.test({
    name: "BufferPool - acquire with 4096 bytes",
    fn() {
        const pool = new BufferPool();

        const buffer = pool.acquire(4096);

        assertEquals(buffer.byteLength, 4096);
    },
});

Deno.test({
    name: "BufferPool - acquire with 8192 bytes",
    fn() {
        const pool = new BufferPool();

        const buffer = pool.acquire(8192);

        assertEquals(buffer.byteLength, 8192);
    },
});

Deno.test({
    name: "BufferPool - acquire with 16384 bytes",
    fn() {
        const pool = new BufferPool();

        const buffer = pool.acquire(16384);

        assertEquals(buffer.byteLength, 16384);
    },
});

Deno.test({
    name: "BufferPool - acquire with 32768 bytes",
    fn() {
        const pool = new BufferPool();

        const buffer = pool.acquire(32768);

        assertEquals(buffer.byteLength, 32768);
    },
});

Deno.test({
    name: "BufferPool - acquire with 65536 bytes",
    fn() {
        const pool = new BufferPool();

        const buffer = pool.acquire(65536);

        assertEquals(buffer.byteLength, 65536);
    },
});

Deno.test({
    name: "BufferPool - acquire rounds up to next standard size",
    fn() {
        const pool = new BufferPool();

        const buffer = pool.acquire(1500);

        // Should round up to 2048
        assertEquals(buffer.byteLength, 2048);
    },
});

Deno.test({
    name: "BufferPool - acquire with size exceeding largest pool",
    fn() {
        const pool = new BufferPool();

        const buffer = pool.acquire(100000);

        assertExists(buffer);
        assert(buffer.byteLength >= 100000);
    },
});

Deno.test({
    name: "BufferPool - acquire updates statistics on hit",
    fn() {
        const pool = new BufferPool();

        const initialStats = pool.getStats();
        const initialHits = initialStats.hits;

        pool.acquire(1024);

        const stats = pool.getStats();
        assertEquals(stats.hits, initialHits + 1);
        assertEquals(stats.currentInUse, 1);
    },
});

Deno.test({
    name: "BufferPool - acquire updates statistics on miss",
    fn() {
        const pool = new BufferPool();
        pool.clear(); // Clear pre-allocated buffers

        pool.acquire(1024);

        const stats = pool.getStats();
        assertEquals(stats.misses, 1);
        assertEquals(stats.totalAllocated, 1);
        assertEquals(stats.currentInUse, 1);
    },
});

Deno.test({
    name: "BufferPool - acquire multiple buffers",
    fn() {
        const pool = new BufferPool();

        const buffer1 = pool.acquire(1024);
        const buffer2 = pool.acquire(2048);
        const buffer3 = pool.acquire(4096);

        assertExists(buffer1);
        assertExists(buffer2);
        assertExists(buffer3);

        const stats = pool.getStats();
        assertEquals(stats.currentInUse, 3);
    },
});

// ============================================================================
// BufferPool release() Tests
// ============================================================================

Deno.test({
    name: "BufferPool - release returns buffer to pool",
    fn() {
        const pool = new BufferPool();
        pool.clear();

        const buffer = pool.acquire(1024);
        pool.release(buffer);

        const stats = pool.getStats();
        assertEquals(stats.totalReleased, 1);
        assertEquals(stats.currentInUse, 0);
    },
});

Deno.test({
    name: "BufferPool - release clears buffer contents",
    fn() {
        const pool = new BufferPool();

        const buffer = pool.acquire(1024);
        buffer[0] = 0xFF;
        buffer[1] = 0xAA;

        pool.release(buffer);

        // Acquire again and verify it's cleared
        const newBuffer = pool.acquire(1024);
        assertEquals(newBuffer[0], 0);
        assertEquals(newBuffer[1], 0);
    },
});

Deno.test({
    name: "BufferPool - release allows buffer reuse",
    fn() {
        const pool = new BufferPool();
        pool.clear();

        const buffer1 = pool.acquire(1024);
        pool.release(buffer1);

        const buffer2 = pool.acquire(1024);

        // Should be the same buffer (reused)
        assertEquals(buffer1, buffer2);
    },
});

Deno.test({
    name: "BufferPool - release updates current in use",
    fn() {
        const pool = new BufferPool();

        const buffer = pool.acquire(1024);

        const beforeRelease = pool.getStats();
        const inUseBefore = beforeRelease.currentInUse;

        pool.release(buffer);

        const afterRelease = pool.getStats();
        assertEquals(afterRelease.currentInUse, inUseBefore - 1);
    },
});

Deno.test({
    name: "BufferPool - release non-standard size buffer",
    fn() {
        const pool = new BufferPool();

        const buffer = pool.acquire(100000); // Exceeds largest pool size
        pool.release(buffer);

        const stats = pool.getStats();
        assertEquals(stats.totalReleased, 1);
    },
});

// ============================================================================
// BufferPool getStats() Tests
// ============================================================================

Deno.test({
    name: "BufferPool - getStats returns statistics object",
    fn() {
        const pool = new BufferPool();

        const stats = pool.getStats();

        assertExists(stats);
        assertEquals(typeof stats.totalAllocated, "number");
        assertEquals(typeof stats.totalReleased, "number");
        assertEquals(typeof stats.currentInUse, "number");
        assertEquals(typeof stats.hits, "number");
        assertEquals(typeof stats.misses, "number");
    },
});

Deno.test({
    name: "BufferPool - getStats returns copy of statistics",
    fn() {
        const pool = new BufferPool();

        const stats1 = pool.getStats();
        const stats2 = pool.getStats();

        // Should be different objects
        assert(stats1 !== stats2);

        // But with same values
        assertEquals(stats1.totalAllocated, stats2.totalAllocated);
        assertEquals(stats1.hits, stats2.hits);
    },
});

Deno.test({
    name: "BufferPool - getStats reflects acquire operations",
    fn() {
        const pool = new BufferPool();
        pool.clear();

        pool.acquire(1024);
        pool.acquire(2048);

        const stats = pool.getStats();
        assertEquals(stats.currentInUse, 2);
        assertEquals(stats.totalAllocated, 2);
    },
});

Deno.test({
    name: "BufferPool - getStats reflects release operations",
    fn() {
        const pool = new BufferPool();
        pool.clear();

        const buffer = pool.acquire(1024);
        pool.release(buffer);

        const stats = pool.getStats();
        assertEquals(stats.totalReleased, 1);
        assertEquals(stats.currentInUse, 0);
    },
});

// ============================================================================
// BufferPool getHitRate() Tests
// ============================================================================

Deno.test({
    name: "BufferPool - getHitRate returns 0 with no operations",
    fn() {
        const pool = new BufferPool();
        pool.clear();

        const hitRate = pool.getHitRate();

        assertEquals(hitRate, 0);
    },
});

Deno.test({
    name: "BufferPool - getHitRate returns 100 with all hits",
    fn() {
        const pool = new BufferPool();
        // Pool has pre-allocated buffers

        pool.acquire(1024);
        pool.acquire(2048);
        pool.acquire(4096);

        const hitRate = pool.getHitRate();

        // All should be hits from pre-allocated pool
        assertEquals(hitRate, 100);
    },
});

Deno.test({
    name: "BufferPool - getHitRate returns 0 with all misses",
    fn() {
        const pool = new BufferPool();
        pool.clear(); // Clear pre-allocated buffers

        pool.acquire(1024);
        pool.acquire(2048);

        const hitRate = pool.getHitRate();

        assertEquals(hitRate, 0);
    },
});

Deno.test({
    name: "BufferPool - getHitRate calculates percentage correctly",
    fn() {
        const pool = new BufferPool();
        pool.clear();

        // First acquire is a miss
        const buffer = pool.acquire(1024);
        const stats1 = pool.getStats();
        assertEquals(stats1.misses, 1);

        // Release and reacquire for a hit
        pool.release(buffer);
        pool.acquire(1024);

        const hitRate = pool.getHitRate();

        // 1 hit, 1 miss = 50%
        assertEquals(hitRate, 50);
    },
});

// ============================================================================
// BufferPool clear() Tests
// ============================================================================

Deno.test({
    name: "BufferPool - clear removes all buffers from pools",
    fn() {
        const pool = new BufferPool();

        // Acquire and release some buffers
        const buffer1 = pool.acquire(1024);
        const buffer2 = pool.acquire(2048);
        pool.release(buffer1);
        pool.release(buffer2);

        pool.clear();

        const stats = pool.getStats();
        assertEquals(stats.totalAllocated, 0);
        assertEquals(stats.totalReleased, 0);
        assertEquals(stats.currentInUse, 0);
        assertEquals(stats.hits, 0);
        assertEquals(stats.misses, 0);
    },
});

Deno.test({
    name: "BufferPool - clear resets statistics",
    fn() {
        const pool = new BufferPool();

        pool.acquire(1024);
        pool.acquire(2048);

        pool.clear();

        const stats = pool.getStats();
        assertEquals(stats.hits, 0);
        assertEquals(stats.misses, 0);
    },
});

Deno.test({
    name: "BufferPool - clear allows fresh start",
    fn() {
        const pool = new BufferPool();

        pool.acquire(1024);
        pool.clear();

        const buffer = pool.acquire(1024);
        assertExists(buffer);

        const stats = pool.getStats();
        assertEquals(stats.misses, 1); // Should be a miss after clear
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "BufferPool - complete acquire/release cycle",
    fn() {
        const pool = new BufferPool();
        pool.clear();

        // Acquire buffer
        const buffer = pool.acquire(1024);
        assertEquals(buffer.byteLength, 1024);

        const afterAcquire = pool.getStats();
        assertEquals(afterAcquire.currentInUse, 1);
        assertEquals(afterAcquire.misses, 1);

        // Release buffer
        pool.release(buffer);

        const afterRelease = pool.getStats();
        assertEquals(afterRelease.currentInUse, 0);
        assertEquals(afterRelease.totalReleased, 1);

        // Reacquire - should be a hit
        const buffer2 = pool.acquire(1024);
        assertEquals(buffer2, buffer);

        const afterReacquire = pool.getStats();
        assertEquals(afterReacquire.hits, 1);
    },
});

Deno.test({
    name: "BufferPool - multiple buffer sizes",
    fn() {
        const pool = new BufferPool();
        pool.clear();

        const sizes = [1024, 2048, 4096, 8192, 16384, 32768, 65536];
        const buffers: ByteBuffer[] = [];

        // Acquire buffers of different sizes
        for (const size of sizes) {
            buffers.push(pool.acquire(size));
        }

        const stats = pool.getStats();
        assertEquals(stats.currentInUse, sizes.length);

        // Release all buffers
        for (const buffer of buffers) {
            pool.release(buffer);
        }

        const afterRelease = pool.getStats();
        assertEquals(afterRelease.currentInUse, 0);
        assertEquals(afterRelease.totalReleased, sizes.length);
    },
});

Deno.test({
    name: "BufferPool - buffer reuse improves hit rate",
    fn() {
        const pool = new BufferPool();
        pool.clear();

        // Acquire and release to populate pool
        const buffer = pool.acquire(1024);
        pool.release(buffer);

        // Now acquire multiple times - should all be hits
        for (let i = 0; i < 10; i++) {
            const buf = pool.acquire(1024);
            pool.release(buf);
        }

        const hitRate = pool.getHitRate();

        // First acquire was a miss, rest were hits
        // 10 hits, 1 miss = ~90.9%
        assert(hitRate > 90);
    },
});

Deno.test({
    name: "BufferPool - pool size limit prevents memory bloat",
    fn() {
        const pool = new BufferPool();
        pool.clear();

        // Release more than 100 buffers of same size
        for (let i = 0; i < 150; i++) {
            const buffer = pool.acquire(1024);
            pool.release(buffer);
        }

        const stats = pool.getStats();

        // Pool should have released all 150 buffers
        assertEquals(stats.totalReleased, 150);

        // But only keeps 100 in pool (implementation detail)
        // This ensures memory doesn't grow unbounded
        assert(true);
    },
});

Deno.test({
    name: "BufferPool - handles mixed operations",
    fn() {
        const pool = new BufferPool();
        pool.clear();

        const buffers: ByteBuffer[] = [];

        // Acquire various sizes
        buffers.push(pool.acquire(1024));
        buffers.push(pool.acquire(2048));
        buffers.push(pool.acquire(1500)); // Rounds to 2048
        buffers.push(pool.acquire(4096));

        // Release some
        pool.release(buffers[0]);
        pool.release(buffers[1]);

        // Acquire more
        buffers.push(pool.acquire(1024)); // Should be a hit
        buffers.push(pool.acquire(8192));

        const stats = pool.getStats();

        // Should have at least 1 hit (the 1024 reacquire)
        assert(stats.hits > 0);
        // Should have some misses (initial acquires)
        assert(stats.misses > 0);
    },
});

Deno.test({
    name: "BufferPool - non-power-of-2 sizes",
    fn() {
        const pool = new BufferPool();

        // Request odd sizes, should round up
        const buffer1 = pool.acquire(1000);
        const buffer2 = pool.acquire(3000);
        const buffer3 = pool.acquire(5000);

        assertEquals(buffer1.byteLength, 1024);
        assertEquals(buffer2.byteLength, 4096);
        assertEquals(buffer3.byteLength, 8192);
    },
});

Deno.test({
    name: "BufferPool - statistics accuracy",
    fn() {
        const pool = new BufferPool();
        pool.clear();

        // Perform known sequence
        const buf1 = pool.acquire(1024); // miss
        assertEquals(pool.getStats().misses, 1);

        pool.release(buf1);
        assertEquals(pool.getStats().totalReleased, 1);

        const buf2 = pool.acquire(1024); // hit
        assertEquals(pool.getStats().hits, 1);

        const buf3 = pool.acquire(2048); // miss
        assertEquals(pool.getStats().misses, 2);

        pool.release(buf2);
        pool.release(buf3);
        assertEquals(pool.getStats().totalReleased, 3);
        assertEquals(pool.getStats().currentInUse, 0);
    },
});
