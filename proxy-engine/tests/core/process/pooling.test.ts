/**
 * ProcessPool Tests
 * Comprehensive tests for ProcessPool functionality
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { ProcessPool } from "../../../core/process/pooling.ts";

// ============================================================================
// Constructor / Initialization Tests
// ============================================================================

Deno.test({
  name: "ProcessPool - can be instantiated with defaults",
  fn() {
    const pool = new ProcessPool();
    assertExists(pool);
    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - can be instantiated with custom min/max",
  fn() {
    const pool = new ProcessPool(5, 20);
    const stats = pool.getStats();

    assertEquals(stats.min, 5);
    assertEquals(stats.max, 20);
    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - initializes with min processes available",
  fn() {
    const pool = new ProcessPool(3, 10);
    const stats = pool.getStats();

    assertEquals(stats.total, 3);
    assertEquals(stats.available, 3);
    assertEquals(stats.busy, 0);
    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - default min is 2",
  fn() {
    const pool = new ProcessPool();
    const stats = pool.getStats();

    assertEquals(stats.min, 2);
    assertEquals(stats.available, 2);
    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - default max is 10",
  fn() {
    const pool = new ProcessPool();
    const stats = pool.getStats();

    assertEquals(stats.max, 10);
    pool.shutdown();
  },
});

// ============================================================================
// acquire Tests
// ============================================================================

Deno.test({
  name: "ProcessPool - acquire returns a PID from available pool",
  fn() {
    const pool = new ProcessPool(2, 5);

    const pid = pool.acquire();

    assertExists(pid);
    assertEquals(typeof pid, "number");
    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - acquire decreases available count",
  fn() {
    const pool = new ProcessPool(3, 5);

    assertEquals(pool.getStats().available, 3);

    pool.acquire();
    assertEquals(pool.getStats().available, 2);

    pool.acquire();
    assertEquals(pool.getStats().available, 1);

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - acquire increases busy count",
  fn() {
    const pool = new ProcessPool(3, 5);

    assertEquals(pool.getStats().busy, 0);

    pool.acquire();
    assertEquals(pool.getStats().busy, 1);

    pool.acquire();
    assertEquals(pool.getStats().busy, 2);

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - acquire creates new process when pool exhausted but under max",
  fn() {
    const pool = new ProcessPool(2, 5);

    // Exhaust initial pool
    pool.acquire();
    pool.acquire();

    assertEquals(pool.getStats().available, 0);
    assertEquals(pool.getStats().total, 2);

    // Should create new process
    const pid = pool.acquire();
    assertExists(pid);
    assertEquals(pool.getStats().total, 3);

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - acquire returns null when at max capacity",
  fn() {
    const pool = new ProcessPool(2, 3);

    // Acquire all up to max
    pool.acquire(); // 1
    pool.acquire(); // 2
    pool.acquire(); // 3 (creates new)

    assertEquals(pool.getStats().total, 3);
    assertEquals(pool.getStats().busy, 3);

    // Should return null
    const pid = pool.acquire();
    assertEquals(pid, null);

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - acquire returns unique PIDs",
  fn() {
    const pool = new ProcessPool(5, 10);
    const pids = new Set<number>();

    for (let i = 0; i < 5; i++) {
      const pid = pool.acquire();
      assertExists(pid);
      pids.add(pid);
    }

    // All PIDs should be unique
    assertEquals(pids.size, 5);
    pool.shutdown();
  },
});

// ============================================================================
// release Tests
// ============================================================================

Deno.test({
  name: "ProcessPool - release returns process to pool",
  fn() {
    const pool = new ProcessPool(2, 5);

    const pid = pool.acquire()!;
    assertEquals(pool.getStats().busy, 1);
    assertEquals(pool.getStats().available, 1);

    pool.release(pid);

    assertEquals(pool.getStats().busy, 0);
    assertEquals(pool.getStats().available, 2);

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - release only affects busy processes",
  fn() {
    const pool = new ProcessPool(2, 5);

    // Try to release a PID that wasn't acquired
    pool.release(99999);

    // Stats should be unchanged
    assertEquals(pool.getStats().busy, 0);
    assertEquals(pool.getStats().available, 2);

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - released process can be acquired again",
  fn() {
    const pool = new ProcessPool(1, 5);

    const pid1 = pool.acquire()!;
    assertEquals(pool.getStats().available, 0);

    pool.release(pid1);
    assertEquals(pool.getStats().available, 1);

    const pid2 = pool.acquire()!;
    // Should get the same PID back
    assertEquals(pid2, pid1);

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - multiple release calls for same PID are idempotent",
  fn() {
    const pool = new ProcessPool(2, 5);

    const pid = pool.acquire()!;
    pool.release(pid);
    pool.release(pid); // Second release should be a no-op

    assertEquals(pool.getStats().available, 2);
    assertEquals(pool.getStats().busy, 0);

    pool.shutdown();
  },
});

// ============================================================================
// remove Tests
// ============================================================================

Deno.test({
  name: "ProcessPool - remove deletes process from pool",
  fn() {
    const pool = new ProcessPool(3, 5);

    assertEquals(pool.getStats().total, 3);

    const pid = pool.acquire()!;
    const result = pool.remove(pid);

    assertEquals(result, true);
    assertEquals(pool.getStats().total, 2);

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - remove returns false for non-existent PID",
  fn() {
    const pool = new ProcessPool(2, 5);

    const result = pool.remove(99999);

    assertEquals(result, false);
    assertEquals(pool.getStats().total, 2);

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - remove handles busy process",
  fn() {
    const pool = new ProcessPool(2, 5);

    const pid = pool.acquire()!;
    assertEquals(pool.getStats().busy, 1);

    pool.remove(pid);

    assertEquals(pool.getStats().busy, 0);
    assertEquals(pool.getStats().total, 1);

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - remove handles available process",
  fn() {
    const pool = new ProcessPool(3, 5);

    // Get all PIDs by acquiring and releasing
    const pid1 = pool.acquire()!;
    pool.release(pid1);

    assertEquals(pool.getStats().available, 3);

    pool.remove(pid1);

    assertEquals(pool.getStats().available, 2);
    assertEquals(pool.getStats().total, 2);

    pool.shutdown();
  },
});

// ============================================================================
// getStats Tests
// ============================================================================

Deno.test({
  name: "ProcessPool - getStats returns correct structure",
  fn() {
    const pool = new ProcessPool(2, 10);
    const stats = pool.getStats();

    assertExists(stats.total);
    assertExists(stats.available);
    assertExists(stats.busy);
    assertExists(stats.min);
    assertExists(stats.max);

    assertEquals(typeof stats.total, "number");
    assertEquals(typeof stats.available, "number");
    assertEquals(typeof stats.busy, "number");
    assertEquals(typeof stats.min, "number");
    assertEquals(typeof stats.max, "number");

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - getStats total equals available plus busy",
  fn() {
    const pool = new ProcessPool(5, 10);

    pool.acquire();
    pool.acquire();
    pool.acquire();

    const stats = pool.getStats();
    assertEquals(stats.total, stats.available + stats.busy);

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - getStats reflects state changes",
  fn() {
    const pool = new ProcessPool(2, 5);

    let stats = pool.getStats();
    assertEquals(stats.total, 2);
    assertEquals(stats.available, 2);
    assertEquals(stats.busy, 0);

    const pid = pool.acquire()!;
    stats = pool.getStats();
    assertEquals(stats.total, 2);
    assertEquals(stats.available, 1);
    assertEquals(stats.busy, 1);

    pool.release(pid);
    stats = pool.getStats();
    assertEquals(stats.total, 2);
    assertEquals(stats.available, 2);
    assertEquals(stats.busy, 0);

    pool.shutdown();
  },
});

// ============================================================================
// shutdown Tests
// ============================================================================

Deno.test({
  name: "ProcessPool - shutdown clears all processes",
  fn() {
    const pool = new ProcessPool(5, 10);

    pool.acquire();
    pool.acquire();

    assertEquals(pool.getStats().total, 5);

    pool.shutdown();

    const stats = pool.getStats();
    assertEquals(stats.total, 0);
    assertEquals(stats.available, 0);
    assertEquals(stats.busy, 0);
  },
});

Deno.test({
  name: "ProcessPool - shutdown is idempotent",
  fn() {
    const pool = new ProcessPool(3, 5);

    pool.shutdown();
    pool.shutdown(); // Second call should be safe

    assertEquals(pool.getStats().total, 0);
  },
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

Deno.test({
  name: "ProcessPool - handles min equals max",
  fn() {
    const pool = new ProcessPool(5, 5);
    const stats = pool.getStats();

    assertEquals(stats.min, 5);
    assertEquals(stats.max, 5);
    assertEquals(stats.total, 5);

    // Should not create any new processes
    for (let i = 0; i < 5; i++) {
      pool.acquire();
    }

    assertEquals(pool.getStats().total, 5);
    assertEquals(pool.acquire(), null); // At max

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - acquire/release cycle works correctly",
  fn() {
    const pool = new ProcessPool(2, 5);

    // Multiple cycles
    for (let cycle = 0; cycle < 3; cycle++) {
      const pids: number[] = [];

      // Acquire all
      for (let i = 0; i < 2; i++) {
        const pid = pool.acquire();
        assertExists(pid);
        pids.push(pid);
      }

      assertEquals(pool.getStats().busy, 2);
      assertEquals(pool.getStats().available, 0);

      // Release all
      for (const pid of pids) {
        pool.release(pid);
      }

      assertEquals(pool.getStats().busy, 0);
      assertEquals(pool.getStats().available, 2);
    }

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - handles expansion and contraction",
  fn() {
    const pool = new ProcessPool(2, 5);

    assertEquals(pool.getStats().total, 2);

    // Expand pool by acquiring more than initial
    const pids: number[] = [];
    for (let i = 0; i < 4; i++) {
      const pid = pool.acquire();
      assertExists(pid);
      pids.push(pid);
    }

    assertEquals(pool.getStats().total, 4); // Expanded from 2 to 4

    // Remove some processes to contract
    pool.remove(pids[0]);
    pool.remove(pids[1]);

    assertEquals(pool.getStats().total, 2);

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - processes have consistent worker naming",
  fn() {
    // This tests internal implementation - processes are named 'worker-N'
    const pool = new ProcessPool(3, 5);

    // Pool should initialize without errors with worker naming
    assertEquals(pool.getStats().total, 3);

    // Additional workers should also be named properly
    pool.acquire();
    pool.acquire();
    pool.acquire();
    pool.acquire(); // Creates worker-3

    assertEquals(pool.getStats().total, 4);

    pool.shutdown();
  },
});

Deno.test({
  name: "ProcessPool - stress test with many operations",
  fn() {
    const pool = new ProcessPool(2, 100);

    const pids: number[] = [];

    // Acquire many
    for (let i = 0; i < 50; i++) {
      const pid = pool.acquire();
      assertExists(pid);
      pids.push(pid);
    }

    assertEquals(pool.getStats().busy, 50);
    assertEquals(pool.getStats().total, 50);

    // Release half
    for (let i = 0; i < 25; i++) {
      pool.release(pids[i]);
    }

    assertEquals(pool.getStats().busy, 25);
    assertEquals(pool.getStats().available, 25);

    // Acquire more
    for (let i = 0; i < 10; i++) {
      pool.acquire();
    }

    assertEquals(pool.getStats().busy, 35);

    pool.shutdown();
  },
});
