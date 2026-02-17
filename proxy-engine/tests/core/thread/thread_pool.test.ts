/**
 * ThreadPool Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { ThreadPool } from "../../../core/thread/thread_pool.ts";
import type { Task } from "../../../core/thread/thread_pool.ts";

// ============================================================================
// Construction
// ============================================================================

Deno.test({
  name: "ThreadPool - constructs with default maxConcurrency of 4",
  fn() {
    const pool = new ThreadPool();
    assertExists(pool);
    assertEquals(pool.getStats().maxConcurrency, 4);
  },
});

Deno.test({
  name: "ThreadPool - constructs with custom maxConcurrency",
  fn() {
    const pool = new ThreadPool(8);
    assertEquals(pool.getStats().maxConcurrency, 8);
  },
});

// ============================================================================
// getStats()
// ============================================================================

Deno.test({
  name: "ThreadPool - getStats() returns zero activeTasks and queuedTasks initially",
  fn() {
    const stats = new ThreadPool(4).getStats();
    assertEquals(stats.activeTasks, 0);
    assertEquals(stats.queuedTasks, 0);
  },
});

Deno.test({
  name: "ThreadPool - getStats() utilization is 0% when idle",
  fn() {
    const stats = new ThreadPool(4).getStats();
    assertEquals(stats.utilization, "0.00%");
  },
});

// ============================================================================
// submit()
// ============================================================================

Deno.test({
  name: "ThreadPool - submit() executes synchronous task and returns result",
  async fn() {
    const pool = new ThreadPool(2);
    const task: Task<number> = { id: "t1", fn: () => 99 };
    const result = await pool.submit(task);
    assertEquals(result, 99);
    pool.stop();
  },
});

Deno.test({
  name: "ThreadPool - submit() executes async task and returns result",
  async fn() {
    const pool = new ThreadPool(2);
    const task: Task<string> = {
      id: "t2",
      fn: async () => {
        await Promise.resolve();
        return "hello";
      },
    };
    const result = await pool.submit(task);
    assertEquals(result, "hello");
    pool.stop();
  },
});

Deno.test({
  name: "ThreadPool - submit() propagates task errors",
  async fn() {
    const pool = new ThreadPool(2);
    const task: Task = { id: "err", fn: () => { throw new Error("boom"); } };
    let threw = false;
    try {
      await pool.submit(task);
    } catch (e) {
      threw = true;
      assert((e as Error).message === "boom");
    }
    assert(threw);
    pool.stop();
  },
});

Deno.test({
  name: "ThreadPool - submit() runs multiple concurrent tasks up to maxConcurrency",
  async fn() {
    const pool = new ThreadPool(4);
    const tasks = Array.from({ length: 4 }, (_, i): Task<number> => ({
      id: `task-${i}`,
      fn: () => i,
    }));
    const results = await Promise.all(tasks.map((t) => pool.submit(t)));
    assertEquals(results, [0, 1, 2, 3]);
    pool.stop();
  },
});

Deno.test({
  name: "ThreadPool - submit() returns correct results for many tasks",
  async fn() {
    const pool = new ThreadPool(4);
    const tasks = Array.from({ length: 6 }, (_, i): Task<number> => ({
      id: `task-${i}`,
      fn: () => i * 2,
    }));
    const results = await Promise.all(tasks.map((t) => pool.submit(t)));
    assertEquals(results, [0, 2, 4, 6, 8, 10]);
    pool.stop();
  },
});

Deno.test({
  name: "ThreadPool - submit() respects task priority ordering",
  async fn() {
    const order: number[] = [];
    const pool = new ThreadPool(1);
    let releaseBlock!: () => void;
    const blocker = new Promise<void>((r) => { releaseBlock = r; });
    const blocking: Task = { id: "block", fn: () => blocker };
    const low: Task = { id: "low", fn: () => { order.push(1); }, priority: 1 };
    const high: Task = { id: "high", fn: () => { order.push(10); }, priority: 10 };
    const p0 = pool.submit(blocking);
    await new Promise((r) => setTimeout(r, 10));
    const pLow = pool.submit(low);
    const pHigh = pool.submit(high);
    releaseBlock();
    await p0;
    await pLow;
    await pHigh;
    // high priority should run before low
    assertEquals(order[0], 10);
    assertEquals(order[1], 1);
    pool.stop();
  },
});

// ============================================================================
// drain()
// ============================================================================

Deno.test({
  name: "ThreadPool - drain() resolves after all active tasks finish",
  async fn() {
    const pool = new ThreadPool(2);
    pool.submit({
      id: "d1",
      fn: async () => { await new Promise((r) => setTimeout(r, 5)); },
    });
    pool.submit({
      id: "d2",
      fn: async () => { await new Promise((r) => setTimeout(r, 5)); },
    });
    await pool.drain();
    assertEquals(pool.getStats().activeTasks, 0);
    assertEquals(pool.getStats().queuedTasks, 0);
    pool.stop();
  },
});

Deno.test({
  name: "ThreadPool - drain() resolves immediately when pool is idle",
  async fn() {
    const pool = new ThreadPool(2);
    await pool.drain();
    assertEquals(pool.getStats().activeTasks, 0);
    pool.stop();
  },
});

// ============================================================================
// clear()
// ============================================================================

Deno.test({
  name: "ThreadPool - clear() removes all queued tasks",
  async fn() {
    const pool = new ThreadPool(1);
    let releaseBlock!: () => void;
    const blocker = new Promise<void>((r) => { releaseBlock = r; });
    const blocking: Task = { id: "blk", fn: () => blocker };
    pool.submit(blocking);
    await new Promise((r) => setTimeout(r, 5));
    pool.submit({ id: "q1", fn: () => 1 });
    pool.submit({ id: "q2", fn: () => 2 });
    assertEquals(pool.getStats().queuedTasks, 2);
    pool.clear();
    assertEquals(pool.getStats().queuedTasks, 0);
    releaseBlock();
    pool.stop();
  },
});

// ============================================================================
// stop()
// ============================================================================

Deno.test({
  name: "ThreadPool - stop() clears queue",
  fn() {
    const pool = new ThreadPool(4);
    pool.stop();
    assertEquals(pool.getStats().queuedTasks, 0);
  },
});

Deno.test({
  name: "ThreadPool - stop() allows drain() to return without hanging",
  async fn() {
    const pool = new ThreadPool(2);
    pool.stop();
    await pool.drain();
    assertEquals(pool.getStats().activeTasks, 0);
  },
});
