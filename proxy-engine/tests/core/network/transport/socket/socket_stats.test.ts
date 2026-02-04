/**
 * SocketStats Tests
 * Comprehensive tests for socket statistics tracking
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
  createSocketStats,
  getAvgBytesPerRead,
  getAvgBytesPerWrite,
  getIdleTime,
  getAge,
  formatSocketStats,
  type SocketStats,
} from "../../../../../core/network/transport/socket/socket_stats.ts";

// ============================================================================
// createSocketStats Tests
// ============================================================================

Deno.test({
  name: "createSocketStats - returns SocketStats object",
  fn() {
    const stats = createSocketStats();

    assertExists(stats);
    assertEquals(typeof stats.bytesRead, "number");
    assertEquals(typeof stats.bytesWritten, "number");
    assertEquals(typeof stats.readsCount, "number");
    assertEquals(typeof stats.writesCount, "number");
    assertEquals(typeof stats.errorsCount, "number");
    assertEquals(typeof stats.createdAt, "number");
    assertEquals(typeof stats.lastActivityAt, "number");
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
  name: "createSocketStats - initializes readsCount to 0",
  fn() {
    const stats = createSocketStats();
    assertEquals(stats.readsCount, 0);
  },
});

Deno.test({
  name: "createSocketStats - initializes writesCount to 0",
  fn() {
    const stats = createSocketStats();
    assertEquals(stats.writesCount, 0);
  },
});

Deno.test({
  name: "createSocketStats - initializes errorsCount to 0",
  fn() {
    const stats = createSocketStats();
    assertEquals(stats.errorsCount, 0);
  },
});

Deno.test({
  name: "createSocketStats - sets createdAt to current time",
  fn() {
    const before = Date.now();
    const stats = createSocketStats();
    const after = Date.now();

    assert(stats.createdAt >= before);
    assert(stats.createdAt <= after);
  },
});

Deno.test({
  name: "createSocketStats - sets lastActivityAt to current time",
  fn() {
    const before = Date.now();
    const stats = createSocketStats();
    const after = Date.now();

    assert(stats.lastActivityAt >= before);
    assert(stats.lastActivityAt <= after);
  },
});

Deno.test({
  name: "createSocketStats - createdAt equals lastActivityAt initially",
  fn() {
    const stats = createSocketStats();
    assertEquals(stats.createdAt, stats.lastActivityAt);
  },
});

Deno.test({
  name: "createSocketStats - creates independent instances",
  fn() {
    const stats1 = createSocketStats();
    const stats2 = createSocketStats();

    // Modify stats1
    stats1.bytesRead = 1000;

    // stats2 should be unchanged
    assertEquals(stats2.bytesRead, 0);
  },
});

// ============================================================================
// getAvgBytesPerRead Tests
// ============================================================================

Deno.test({
  name: "getAvgBytesPerRead - returns 0 when no reads",
  fn() {
    const stats = createSocketStats();
    assertEquals(getAvgBytesPerRead(stats), 0);
  },
});

Deno.test({
  name: "getAvgBytesPerRead - calculates average correctly",
  fn() {
    const stats: SocketStats = {
      bytesRead: 1000,
      readsCount: 10,
      bytesWritten: 0,
      writesCount: 0,
      errorsCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    assertEquals(getAvgBytesPerRead(stats), 100);
  },
});

Deno.test({
  name: "getAvgBytesPerRead - handles single read",
  fn() {
    const stats: SocketStats = {
      bytesRead: 512,
      readsCount: 1,
      bytesWritten: 0,
      writesCount: 0,
      errorsCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    assertEquals(getAvgBytesPerRead(stats), 512);
  },
});

Deno.test({
  name: "getAvgBytesPerRead - handles fractional averages",
  fn() {
    const stats: SocketStats = {
      bytesRead: 100,
      readsCount: 3,
      bytesWritten: 0,
      writesCount: 0,
      errorsCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    const avg = getAvgBytesPerRead(stats);
    assert(Math.abs(avg - 33.333) < 0.01);
  },
});

// ============================================================================
// getAvgBytesPerWrite Tests
// ============================================================================

Deno.test({
  name: "getAvgBytesPerWrite - returns 0 when no writes",
  fn() {
    const stats = createSocketStats();
    assertEquals(getAvgBytesPerWrite(stats), 0);
  },
});

Deno.test({
  name: "getAvgBytesPerWrite - calculates average correctly",
  fn() {
    const stats: SocketStats = {
      bytesRead: 0,
      readsCount: 0,
      bytesWritten: 5000,
      writesCount: 50,
      errorsCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    assertEquals(getAvgBytesPerWrite(stats), 100);
  },
});

Deno.test({
  name: "getAvgBytesPerWrite - handles single write",
  fn() {
    const stats: SocketStats = {
      bytesRead: 0,
      readsCount: 0,
      bytesWritten: 1024,
      writesCount: 1,
      errorsCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    assertEquals(getAvgBytesPerWrite(stats), 1024);
  },
});

Deno.test({
  name: "getAvgBytesPerWrite - handles fractional averages",
  fn() {
    const stats: SocketStats = {
      bytesRead: 0,
      readsCount: 0,
      bytesWritten: 1000,
      writesCount: 7,
      errorsCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    const avg = getAvgBytesPerWrite(stats);
    assert(Math.abs(avg - 142.857) < 0.01);
  },
});

// ============================================================================
// getIdleTime Tests
// ============================================================================

Deno.test({
  name: "getIdleTime - returns approximately 0 for fresh stats",
  fn() {
    const stats = createSocketStats();
    const idleTime = getIdleTime(stats);

    // Should be very small (< 100ms for test execution)
    assert(idleTime >= 0);
    assert(idleTime < 100);
  },
});

Deno.test({
  name: "getIdleTime - calculates idle time correctly",
  async fn() {
    const stats: SocketStats = {
      bytesRead: 0,
      readsCount: 0,
      bytesWritten: 0,
      writesCount: 0,
      errorsCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now() - 1000, // 1 second ago
    };

    const idleTime = getIdleTime(stats);
    assert(idleTime >= 1000);
    assert(idleTime < 1100); // Allow some tolerance
  },
});

Deno.test({
  name: "getIdleTime - returns larger value for older lastActivityAt",
  fn() {
    const now = Date.now();
    const stats: SocketStats = {
      bytesRead: 0,
      readsCount: 0,
      bytesWritten: 0,
      writesCount: 0,
      errorsCount: 0,
      createdAt: now,
      lastActivityAt: now - 5000, // 5 seconds ago
    };

    const idleTime = getIdleTime(stats);
    assert(idleTime >= 5000);
    assert(idleTime < 5100);
  },
});

// ============================================================================
// getAge Tests
// ============================================================================

Deno.test({
  name: "getAge - returns approximately 0 for fresh stats",
  fn() {
    const stats = createSocketStats();
    const age = getAge(stats);

    // Should be very small
    assert(age >= 0);
    assert(age < 100);
  },
});

Deno.test({
  name: "getAge - calculates age correctly",
  fn() {
    const stats: SocketStats = {
      bytesRead: 0,
      readsCount: 0,
      bytesWritten: 0,
      writesCount: 0,
      errorsCount: 0,
      createdAt: Date.now() - 2000, // 2 seconds ago
      lastActivityAt: Date.now(),
    };

    const age = getAge(stats);
    assert(age >= 2000);
    assert(age < 2100);
  },
});

Deno.test({
  name: "getAge - returns larger value for older createdAt",
  fn() {
    const now = Date.now();
    const stats: SocketStats = {
      bytesRead: 0,
      readsCount: 0,
      bytesWritten: 0,
      writesCount: 0,
      errorsCount: 0,
      createdAt: now - 10000, // 10 seconds ago
      lastActivityAt: now,
    };

    const age = getAge(stats);
    assert(age >= 10000);
    assert(age < 10100);
  },
});

// ============================================================================
// formatSocketStats Tests
// ============================================================================

Deno.test({
  name: "formatSocketStats - returns string",
  fn() {
    const stats = createSocketStats();
    const formatted = formatSocketStats(stats);

    assertEquals(typeof formatted, "string");
  },
});

Deno.test({
  name: "formatSocketStats - includes Bytes Read",
  fn() {
    const stats = createSocketStats();
    stats.bytesRead = 1234567;
    const formatted = formatSocketStats(stats);

    assert(formatted.includes("Bytes Read:"));
    assert(formatted.includes("1,234,567"));
  },
});

Deno.test({
  name: "formatSocketStats - includes Bytes Written",
  fn() {
    const stats = createSocketStats();
    stats.bytesWritten = 9876543;
    const formatted = formatSocketStats(stats);

    assert(formatted.includes("Bytes Written:"));
    assert(formatted.includes("9,876,543"));
  },
});

Deno.test({
  name: "formatSocketStats - includes Reads count",
  fn() {
    const stats = createSocketStats();
    stats.readsCount = 1000;
    const formatted = formatSocketStats(stats);

    assert(formatted.includes("Reads:"));
    assert(formatted.includes("1,000"));
  },
});

Deno.test({
  name: "formatSocketStats - includes Writes count",
  fn() {
    const stats = createSocketStats();
    stats.writesCount = 500;
    const formatted = formatSocketStats(stats);

    assert(formatted.includes("Writes:"));
    assert(formatted.includes("500"));
  },
});

Deno.test({
  name: "formatSocketStats - includes Errors count",
  fn() {
    const stats = createSocketStats();
    stats.errorsCount = 5;
    const formatted = formatSocketStats(stats);

    assert(formatted.includes("Errors:"));
    assert(formatted.includes("5"));
  },
});

Deno.test({
  name: "formatSocketStats - includes Avg Bytes/Read",
  fn() {
    const stats: SocketStats = {
      bytesRead: 1000,
      readsCount: 4,
      bytesWritten: 0,
      writesCount: 0,
      errorsCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    const formatted = formatSocketStats(stats);

    assert(formatted.includes("Avg Bytes/Read:"));
    assert(formatted.includes("250.00"));
  },
});

Deno.test({
  name: "formatSocketStats - includes Avg Bytes/Write",
  fn() {
    const stats: SocketStats = {
      bytesRead: 0,
      readsCount: 0,
      bytesWritten: 500,
      writesCount: 2,
      errorsCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    const formatted = formatSocketStats(stats);

    assert(formatted.includes("Avg Bytes/Write:"));
    assert(formatted.includes("250.00"));
  },
});

Deno.test({
  name: "formatSocketStats - includes Age in seconds",
  fn() {
    const stats: SocketStats = {
      bytesRead: 0,
      readsCount: 0,
      bytesWritten: 0,
      writesCount: 0,
      errorsCount: 0,
      createdAt: Date.now() - 5000, // 5 seconds ago
      lastActivityAt: Date.now(),
    };
    const formatted = formatSocketStats(stats);

    assert(formatted.includes("Age:"));
    assert(formatted.includes("s")); // seconds suffix
  },
});

Deno.test({
  name: "formatSocketStats - includes Idle time in seconds",
  fn() {
    const stats: SocketStats = {
      bytesRead: 0,
      readsCount: 0,
      bytesWritten: 0,
      writesCount: 0,
      errorsCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now() - 3000, // 3 seconds idle
    };
    const formatted = formatSocketStats(stats);

    assert(formatted.includes("Idle:"));
    assert(formatted.includes("s")); // seconds suffix
  },
});

Deno.test({
  name: "formatSocketStats - uses newlines between fields",
  fn() {
    const stats = createSocketStats();
    const formatted = formatSocketStats(stats);

    // Should have multiple lines
    const lines = formatted.split("\n");
    assert(lines.length > 1);
  },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
  name: "SocketStats - typical socket usage simulation",
  fn() {
    const stats = createSocketStats();

    // Simulate multiple read/write operations
    stats.bytesRead = 50000;
    stats.readsCount = 100;
    stats.bytesWritten = 25000;
    stats.writesCount = 50;
    stats.errorsCount = 2;
    stats.lastActivityAt = Date.now();

    const avgRead = getAvgBytesPerRead(stats);
    const avgWrite = getAvgBytesPerWrite(stats);

    assertEquals(avgRead, 500);
    assertEquals(avgWrite, 500);

    const formatted = formatSocketStats(stats);
    assert(formatted.includes("Errors: 2"));
  },
});

Deno.test({
  name: "SocketStats - handles large byte counts",
  fn() {
    const stats: SocketStats = {
      bytesRead: 1_000_000_000, // 1GB
      readsCount: 1_000_000,
      bytesWritten: 500_000_000, // 500MB
      writesCount: 500_000,
      errorsCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    const avgRead = getAvgBytesPerRead(stats);
    const avgWrite = getAvgBytesPerWrite(stats);

    assertEquals(avgRead, 1000);
    assertEquals(avgWrite, 1000);
  },
});

Deno.test({
  name: "SocketStats - handles zero byte operations",
  fn() {
    const stats: SocketStats = {
      bytesRead: 0,
      readsCount: 10, // 10 reads of 0 bytes each
      bytesWritten: 0,
      writesCount: 5,
      errorsCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    assertEquals(getAvgBytesPerRead(stats), 0);
    assertEquals(getAvgBytesPerWrite(stats), 0);
  },
});
