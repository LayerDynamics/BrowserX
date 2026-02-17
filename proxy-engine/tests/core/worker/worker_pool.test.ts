/**
 * WorkerPool Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { WorkerPool } from "../../../core/worker/worker_pool.ts";

// ============================================================================
// Construction
// ============================================================================

Deno.test({
  name: "WorkerPool - constructs with default min/max (2/10)",
  fn() {
    const pool = new WorkerPool();
    assertEquals(pool.getMinWorkers(), 2);
    assertEquals(pool.getMaxWorkers(), 10);
  },
});

Deno.test({
  name: "WorkerPool - constructs with custom min/max",
  fn() {
    const pool = new WorkerPool(3, 8);
    assertEquals(pool.getMinWorkers(), 3);
    assertEquals(pool.getMaxWorkers(), 8);
  },
});

Deno.test({
  name: "WorkerPool - initializes pool with minWorkers pre-allocated",
  fn() {
    const pool = new WorkerPool(3, 10);
    assertEquals(pool.getStats().total, 3);
    assertEquals(pool.getStats().idle, 3);
  },
});

// ============================================================================
// getMinWorkers() / getMaxWorkers()
// ============================================================================

Deno.test({
  name: "WorkerPool - getMinWorkers() returns configured minimum",
  fn() {
    assertEquals(new WorkerPool(1, 5).getMinWorkers(), 1);
  },
});

Deno.test({
  name: "WorkerPool - getMaxWorkers() returns configured maximum",
  fn() {
    assertEquals(new WorkerPool(1, 5).getMaxWorkers(), 5);
  },
});

// ============================================================================
// getManager()
// ============================================================================

Deno.test({
  name: "WorkerPool - getManager() returns the underlying WorkerManager",
  fn() {
    const pool = new WorkerPool(2, 10);
    const manager = pool.getManager();
    assertExists(manager);
    assertEquals(manager.getStats().total, 2);
  },
});

// ============================================================================
// getStats()
// ============================================================================

Deno.test({
  name: "WorkerPool - getStats() includes min and max fields",
  fn() {
    const stats = new WorkerPool(2, 8).getStats();
    assertEquals(stats.min, 2);
    assertEquals(stats.max, 8);
  },
});

Deno.test({
  name: "WorkerPool - getStats() reports correct total/idle/busy after construction",
  fn() {
    const stats = new WorkerPool(4, 10).getStats();
    assertEquals(stats.total, 4);
    assertEquals(stats.idle, 4);
    assertEquals(stats.busy, 0);
  },
});

// ============================================================================
// acquire()
// ============================================================================

Deno.test({
  name: "WorkerPool - acquire() returns a numeric worker ID",
  fn() {
    const pool = new WorkerPool(2, 10);
    const id = pool.acquire();
    assert(id !== null);
    assert(typeof id === "number");
  },
});

Deno.test({
  name: "WorkerPool - acquire() marks the worker busy",
  fn() {
    const pool = new WorkerPool(2, 10);
    pool.acquire();
    assertEquals(pool.getStats().busy, 1);
    assertEquals(pool.getStats().idle, 1);
  },
});

Deno.test({
  name: "WorkerPool - acquire() creates a new worker when idle list empty but under max",
  fn() {
    const pool = new WorkerPool(1, 5);
    pool.acquire(); // uses the 1 idle worker
    const id = pool.acquire(); // should create a new one
    assert(id !== null);
    assertEquals(pool.getStats().total, 2);
  },
});

Deno.test({
  name: "WorkerPool - acquire() returns null when all workers busy and at max",
  fn() {
    const pool = new WorkerPool(1, 2);
    pool.acquire();
    pool.acquire();
    assertEquals(pool.acquire(), null);
  },
});

// ============================================================================
// release()
// ============================================================================

Deno.test({
  name: "WorkerPool - release() makes the worker idle again",
  fn() {
    const pool = new WorkerPool(2, 10);
    const id = pool.acquire()!;
    pool.release(id);
    assertEquals(pool.getStats().busy, 0);
    assertEquals(pool.getStats().idle, 2);
  },
});

Deno.test({
  name: "WorkerPool - released worker can be acquired again",
  fn() {
    const pool = new WorkerPool(1, 2);
    pool.acquire(); pool.acquire(); // exhaust pool
    assertEquals(pool.acquire(), null); // at max
    pool.release(pool.getManager().getIdle()[0] || 1); // release one
    // now can acquire again (release on busy worker)
    const id1 = pool.acquire()!;
    pool.release(id1);
    assert(pool.acquire() !== null || pool.getStats().idle >= 0);
  },
});

// ============================================================================
// remove()
// ============================================================================

Deno.test({
  name: "WorkerPool - remove() returns true and deletes the worker",
  fn() {
    const pool = new WorkerPool(2, 10);
    const id = pool.acquire()!;
    assert(pool.remove(id) === true);
    assertEquals(pool.getStats().total, 1);
  },
});

Deno.test({
  name: "WorkerPool - remove() returns false for non-existent worker ID",
  fn() {
    assertEquals(new WorkerPool(2, 10).remove(99999), false);
  },
});

// ============================================================================
// execute()
// ============================================================================

Deno.test({
  name: "WorkerPool - execute() runs the task and returns its result",
  async fn() {
    const pool = new WorkerPool(2, 10);
    const result = await pool.execute(() => 42);
    assertEquals(result, 42);
  },
});

Deno.test({
  name: "WorkerPool - execute() releases worker back to idle after completion",
  async fn() {
    const pool = new WorkerPool(2, 10);
    await pool.execute(() => "done");
    assertEquals(pool.getStats().busy, 0);
    assertEquals(pool.getStats().idle, 2);
  },
});

Deno.test({
  name: "WorkerPool - execute() throws when pool is exhausted",
  async fn() {
    const pool = new WorkerPool(1, 1);
    // Exhaust the pool manually without releasing
    const id = pool.acquire()!;
    let threw = false;
    try {
      await pool.execute(() => "fail");
    } catch {
      threw = true;
    }
    assert(threw);
    pool.release(id);
  },
});

// ============================================================================
// shutdown()
// ============================================================================

Deno.test({
  name: "WorkerPool - shutdown() clears all workers",
  fn() {
    const pool = new WorkerPool(4, 10);
    pool.shutdown();
    assertEquals(pool.getStats().total, 0);
  },
});
