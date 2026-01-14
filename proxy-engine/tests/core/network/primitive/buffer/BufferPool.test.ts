/**
 * BufferPool Tests
 * Tests for efficient buffer memory pooling and reuse
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { BufferPool, getGlobalBufferPool, setGlobalBufferPool, acquireBuffer, releaseBuffer } from "../../../../../core/network/primitive/buffer/buffer_pool.ts";

// ============================================================================
// Constructor Tests
// ============================================================================

Deno.test({
  name: "BufferPool - constructor with default sizes",
  fn() {
    const pool = new BufferPool();
    assertExists(pool);

    const stats = pool.getStats();
    assertEquals(stats.totalBuffers, 70); // 7 sizes * 10 buffers each
    assertEquals(stats.available, 70);
    assertEquals(stats.inUse, 0);
  },
});

Deno.test({
  name: "BufferPool - constructor with custom sizes",
  fn() {
    const customSizes = [512, 1024, 2048];
    const pool = new BufferPool(customSizes, 5);

    const stats = pool.getStats();
    assertEquals(stats.totalBuffers, 15); // 3 sizes * 5 buffers each
    assertEquals(stats.available, 15);
  },
});

Deno.test({
  name: "BufferPool - constructor with single size",
  fn() {
    const pool = new BufferPool([4096], 3);

    const stats = pool.getStats();
    assertEquals(stats.totalBuffers, 3);
    assertEquals(stats.bySize.size, 1);
    assert(stats.bySize.has(4096));
  },
});

// ============================================================================
// Acquire Tests
// ============================================================================

Deno.test({
  name: "BufferPool - acquire returns buffer of requested size or larger",
  fn() {
    const pool = new BufferPool();

    const buffer = pool.acquire(1024);
    assertExists(buffer);
    assertEquals(buffer.length, 1024);
  },
});

Deno.test({
  name: "BufferPool - acquire rounds up to next standard size",
  fn() {
    const pool = new BufferPool();

    const buffer = pool.acquire(1500); // Between 1024 and 2048
    assertExists(buffer);
    assertEquals(buffer.length, 2048); // Rounded up
  },
});

Deno.test({
  name: "BufferPool - acquire for 1KB buffer",
  fn() {
    const pool = new BufferPool();
    const buffer = pool.acquire(1024);

    assertEquals(buffer.length, 1024);
    assertEquals(buffer.constructor, Uint8Array);
  },
});

Deno.test({
  name: "BufferPool - acquire for 2KB buffer",
  fn() {
    const pool = new BufferPool();
    const buffer = pool.acquire(2048);

    assertEquals(buffer.length, 2048);
  },
});

Deno.test({
  name: "BufferPool - acquire for 4KB buffer",
  fn() {
    const pool = new BufferPool();
    const buffer = pool.acquire(4096);

    assertEquals(buffer.length, 4096);
  },
});

Deno.test({
  name: "BufferPool - acquire for 8KB buffer",
  fn() {
    const pool = new BufferPool();
    const buffer = pool.acquire(8192);

    assertEquals(buffer.length, 8192);
  },
});

Deno.test({
  name: "BufferPool - acquire for 16KB buffer",
  fn() {
    const pool = new BufferPool();
    const buffer = pool.acquire(16384);

    assertEquals(buffer.length, 16384);
  },
});

Deno.test({
  name: "BufferPool - acquire for 32KB buffer",
  fn() {
    const pool = new BufferPool();
    const buffer = pool.acquire(32768);

    assertEquals(buffer.length, 32768);
  },
});

Deno.test({
  name: "BufferPool - acquire for 64KB buffer",
  fn() {
    const pool = new BufferPool();
    const buffer = pool.acquire(65536);

    assertEquals(buffer.length, 65536);
  },
});

Deno.test({
  name: "BufferPool - acquire larger than max standard size creates custom buffer",
  fn() {
    const pool = new BufferPool();

    const buffer = pool.acquire(100000); // Larger than 64KB
    assertExists(buffer);
    assertEquals(buffer.length, 100000);
  },
});

Deno.test({
  name: "BufferPool - acquire increments totalAcquired",
  fn() {
    const pool = new BufferPool();

    pool.acquire(1024);
    pool.acquire(2048);
    pool.acquire(4096);

    const stats = pool.getStats();
    assertEquals(stats.totalAcquired, 3);
  },
});

Deno.test({
  name: "BufferPool - acquire updates inUse count",
  fn() {
    const pool = new BufferPool();

    pool.acquire(1024);
    pool.acquire(1024);

    const stats = pool.getStats();
    assertEquals(stats.inUse, 2);
    assertEquals(stats.available, 68); // 70 - 2
  },
});

// ============================================================================
// Release Tests
// ============================================================================

Deno.test({
  name: "BufferPool - release returns buffer to pool",
  fn() {
    const pool = new BufferPool();

    const buffer = pool.acquire(1024);
    const statsBefore = pool.getStats();

    const released = pool.release(buffer);

    assert(released);
    const statsAfter = pool.getStats();
    assertEquals(statsAfter.available, statsBefore.available + 1);
  },
});

Deno.test({
  name: "BufferPool - release zeros out buffer data",
  fn() {
    const pool = new BufferPool();

    const buffer = pool.acquire(1024);
    buffer[0] = 123;
    buffer[100] = 45;
    buffer[500] = 67;

    pool.release(buffer);

    // Acquire again and verify it's zeroed
    const reusedBuffer = pool.acquire(1024);
    assertEquals(reusedBuffer[0], 0);
    assertEquals(reusedBuffer[100], 0);
    assertEquals(reusedBuffer[500], 0);
  },
});

Deno.test({
  name: "BufferPool - release increments totalReleased",
  fn() {
    const pool = new BufferPool();

    const buffer1 = pool.acquire(1024);
    const buffer2 = pool.acquire(2048);

    pool.release(buffer1);
    pool.release(buffer2);

    const stats = pool.getStats();
    assertEquals(stats.totalReleased, 2);
  },
});

Deno.test({
  name: "BufferPool - release non-pooled buffer returns false",
  fn() {
    const pool = new BufferPool();

    const customBuffer = new Uint8Array(999); // Non-standard size
    const released = pool.release(customBuffer);

    assertEquals(released, false);
  },
});

Deno.test({
  name: "BufferPool - release same buffer twice returns false on second",
  fn() {
    const pool = new BufferPool();

    const buffer = pool.acquire(1024);
    const firstRelease = pool.release(buffer);
    const secondRelease = pool.release(buffer);

    assert(firstRelease);
    assertEquals(secondRelease, false);
  },
});

// ============================================================================
// Statistics Tests
// ============================================================================

Deno.test({
  name: "BufferPool - getStats returns accurate counts",
  fn() {
    const pool = new BufferPool();

    const buffer1 = pool.acquire(1024);
    const buffer2 = pool.acquire(2048);

    const stats = pool.getStats();

    assertEquals(stats.totalAcquired, 2);
    assertEquals(stats.totalReleased, 0);
    assertEquals(stats.inUse, 2);
    assertEquals(stats.totalBuffers, 70);
  },
});

Deno.test({
  name: "BufferPool - getStats bySize shows per-size statistics",
  fn() {
    const pool = new BufferPool();

    pool.acquire(1024);
    pool.acquire(1024);
    pool.acquire(2048);

    const stats = pool.getStats();

    const size1024 = stats.bySize.get(1024);
    assertExists(size1024);
    assertEquals(size1024.inUse, 2);

    const size2048 = stats.bySize.get(2048);
    assertExists(size2048);
    assertEquals(size2048.inUse, 1);
  },
});

Deno.test({
  name: "BufferPool - hit tracking when reusing buffers",
  fn() {
    const pool = new BufferPool();

    const buffer = pool.acquire(1024);
    pool.release(buffer);

    // This should be a hit since buffer is available
    pool.acquire(1024);

    const stats = pool.getStats();
    assert(stats.hits > 0);
  },
});

Deno.test({
  name: "BufferPool - miss tracking when pool exhausted",
  fn() {
    const pool = new BufferPool([1024], 2); // Only 2 buffers

    pool.acquire(1024);
    pool.acquire(1024);
    pool.acquire(1024); // This should be a miss

    const stats = pool.getStats();
    assert(stats.misses > 0);
  },
});

Deno.test({
  name: "BufferPool - getHitRate returns correct ratio",
  fn() {
    const pool = new BufferPool([1024], 1);

    pool.acquire(1024); // Miss (pool exhausted)
    const buffer = pool.acquire(1024); // Miss
    pool.release(buffer);
    pool.acquire(1024); // Hit

    const hitRate = pool.getHitRate();
    assert(hitRate > 0 && hitRate <= 1);
  },
});

Deno.test({
  name: "BufferPool - getHitRate returns 0 when no acquisitions",
  fn() {
    const pool = new BufferPool();

    const hitRate = pool.getHitRate();
    assertEquals(hitRate, 0);
  },
});

// ============================================================================
// Clear Tests
// ============================================================================

Deno.test({
  name: "BufferPool - clear resets all pools",
  fn() {
    const pool = new BufferPool();

    pool.acquire(1024);
    pool.acquire(2048);

    pool.clear();

    const stats = pool.getStats();
    assertEquals(stats.totalBuffers, 0);
    assertEquals(stats.available, 0);
    assertEquals(stats.inUse, 0);
    assertEquals(stats.totalAcquired, 0);
    assertEquals(stats.totalReleased, 0);
  },
});

// ============================================================================
// Buffer Reuse Tests
// ============================================================================

Deno.test({
  name: "BufferPool - reuses released buffers",
  fn() {
    const pool = new BufferPool();

    const buffer1 = pool.acquire(1024);
    const statsBefore = pool.getStats();

    pool.release(buffer1);
    const buffer2 = pool.acquire(1024);

    // Should reuse the buffer
    const statsAfter = pool.getStats();
    assertEquals(statsAfter.totalBuffers, statsBefore.totalBuffers);
  },
});

Deno.test({
  name: "BufferPool - multiple acquire and release cycles",
  fn() {
    const pool = new BufferPool();

    for (let i = 0; i < 5; i++) {
      const buffer = pool.acquire(1024);
      buffer[0] = i; // Use the buffer
      pool.release(buffer);
    }

    const stats = pool.getStats();
    assertEquals(stats.totalAcquired, 5);
    assertEquals(stats.totalReleased, 5);
  },
});

// ============================================================================
// Global Pool Tests
// ============================================================================

Deno.test({
  name: "getGlobalBufferPool - returns singleton instance",
  fn() {
    const pool1 = getGlobalBufferPool();
    const pool2 = getGlobalBufferPool();

    // Should be the same instance
    assertEquals(pool1, pool2);
  },
});

Deno.test({
  name: "setGlobalBufferPool - sets custom global pool",
  fn() {
    const customPool = new BufferPool([2048], 5);
    setGlobalBufferPool(customPool);

    const pool = getGlobalBufferPool();
    assertEquals(pool, customPool);

    // Cleanup: reset to default
    setGlobalBufferPool(new BufferPool());
  },
});

Deno.test({
  name: "acquireBuffer - convenience function uses global pool",
  fn() {
    const buffer = acquireBuffer(1024);

    assertExists(buffer);
    assertEquals(buffer.length, 1024);
  },
});

Deno.test({
  name: "releaseBuffer - convenience function uses global pool",
  fn() {
    const buffer = acquireBuffer(1024);
    const released = releaseBuffer(buffer);

    assert(released);
  },
});

// ============================================================================
// Concurrent Usage Tests
// ============================================================================

Deno.test({
  name: "BufferPool - handles concurrent acquisitions",
  fn() {
    const pool = new BufferPool();

    const buffers = [];
    for (let i = 0; i < 50; i++) {
      buffers.push(pool.acquire(1024));
    }

    const stats = pool.getStats();
    assertEquals(stats.inUse, 50);
    assertEquals(buffers.length, 50);
  },
});

Deno.test({
  name: "BufferPool - handles mixed size acquisitions",
  fn() {
    const pool = new BufferPool();

    pool.acquire(1024);
    pool.acquire(2048);
    pool.acquire(4096);
    pool.acquire(8192);
    pool.acquire(16384);

    const stats = pool.getStats();
    assertEquals(stats.inUse, 5);
    assertEquals(stats.totalAcquired, 5);
  },
});
