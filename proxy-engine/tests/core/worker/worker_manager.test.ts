/**
 * WorkerManager Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { WorkerManager } from "../../../core/worker/worker_manager.ts";

// ============================================================================
// Construction
// ============================================================================

Deno.test({
  name: "WorkerManager - constructs with empty state",
  fn() {
    const mgr = new WorkerManager();
    assertExists(mgr);
    assertEquals(mgr.getAll().length, 0);
  },
});

// ============================================================================
// create() — Sequential IDs
// ============================================================================

Deno.test({
  name: "WorkerManager - create() returns a numeric id",
  fn() {
    const mgr = new WorkerManager();
    assert(typeof mgr.create() === "number");
  },
});

Deno.test({
  name: "WorkerManager - create() returns sequential IDs starting at 1",
  fn() {
    const mgr = new WorkerManager();
    assertEquals(mgr.create(), 1);
    assertEquals(mgr.create(), 2);
    assertEquals(mgr.create(), 3);
  },
});

Deno.test({
  name: "WorkerManager - created worker starts with idle status",
  fn() {
    const mgr = new WorkerManager();
    const id = mgr.create();
    assertEquals(mgr.getState(id)?.status, "idle");
  },
});

Deno.test({
  name: "WorkerManager - created worker starts with 0 tasksCompleted",
  fn() {
    const mgr = new WorkerManager();
    const id = mgr.create();
    assertEquals(mgr.getState(id)?.tasksCompleted, 0);
  },
});

Deno.test({
  name: "WorkerManager - getState() returns null for non-existent worker",
  fn() {
    const mgr = new WorkerManager();
    assertEquals(mgr.getState(999), null);
  },
});

// ============================================================================
// markBusy() / markIdle()
// ============================================================================

Deno.test({
  name: "WorkerManager - markBusy() sets status to 'busy'",
  fn() {
    const mgr = new WorkerManager();
    const id = mgr.create();
    mgr.markBusy(id);
    assertEquals(mgr.getState(id)?.status, "busy");
  },
});

Deno.test({
  name: "WorkerManager - markIdle() sets status back to 'idle'",
  fn() {
    const mgr = new WorkerManager();
    const id = mgr.create();
    mgr.markBusy(id);
    mgr.markIdle(id);
    assertEquals(mgr.getState(id)?.status, "idle");
  },
});

Deno.test({
  name: "WorkerManager - markIdle() increments tasksCompleted by 1",
  fn() {
    const mgr = new WorkerManager();
    const id = mgr.create();
    mgr.markBusy(id);
    mgr.markIdle(id);
    assertEquals(mgr.getState(id)?.tasksCompleted, 1);
  },
});

Deno.test({
  name: "WorkerManager - markIdle() accumulates tasksCompleted",
  fn() {
    const mgr = new WorkerManager();
    const id = mgr.create();
    for (let i = 0; i < 5; i++) { mgr.markBusy(id); mgr.markIdle(id); }
    assertEquals(mgr.getState(id)?.tasksCompleted, 5);
  },
});

// ============================================================================
// stop()
// ============================================================================

Deno.test({
  name: "WorkerManager - stop() returns true and sets status to 'stopped'",
  fn() {
    const mgr = new WorkerManager();
    const id = mgr.create();
    assert(mgr.stop(id) === true);
    assertEquals(mgr.getState(id)?.status, "stopped");
  },
});

Deno.test({
  name: "WorkerManager - stop() returns false for non-existent worker",
  fn() {
    const mgr = new WorkerManager();
    assert(mgr.stop(999) === false);
  },
});

// ============================================================================
// remove()
// ============================================================================

Deno.test({
  name: "WorkerManager - remove() deletes worker and returns true",
  fn() {
    const mgr = new WorkerManager();
    const id = mgr.create();
    assert(mgr.remove(id) === true);
    assertEquals(mgr.getState(id), null);
  },
});

Deno.test({
  name: "WorkerManager - remove() returns false for non-existent worker",
  fn() {
    const mgr = new WorkerManager();
    assert(mgr.remove(999) === false);
  },
});

// ============================================================================
// getIdle() / getBusy()
// ============================================================================

Deno.test({
  name: "WorkerManager - getIdle() returns idle worker ids",
  fn() {
    const mgr = new WorkerManager();
    const id1 = mgr.create();
    const id2 = mgr.create();
    mgr.markBusy(id2);
    const idle = mgr.getIdle();
    assert(idle.includes(id1));
    assert(!idle.includes(id2));
  },
});

Deno.test({
  name: "WorkerManager - getBusy() returns busy worker ids",
  fn() {
    const mgr = new WorkerManager();
    const id1 = mgr.create();
    const id2 = mgr.create();
    mgr.markBusy(id1);
    const busy = mgr.getBusy();
    assert(busy.includes(id1));
    assert(!busy.includes(id2));
  },
});

// ============================================================================
// getStats()
// ============================================================================

Deno.test({
  name: "WorkerManager - getStats() returns all zeros for empty manager",
  fn() {
    const mgr = new WorkerManager();
    const stats = mgr.getStats();
    assertEquals(stats.total, 0);
    assertEquals(stats.idle, 0);
    assertEquals(stats.busy, 0);
    assertEquals(stats.stopped, 0);
    assertEquals(stats.totalTasksCompleted, 0);
  },
});

Deno.test({
  name: "WorkerManager - getStats() correctly counts workers by status",
  fn() {
    const mgr = new WorkerManager();
    const id1 = mgr.create();
    const id2 = mgr.create();
    const id3 = mgr.create();
    mgr.markBusy(id2);
    mgr.stop(id3);
    const stats = mgr.getStats();
    assertEquals(stats.total, 3);
    assertEquals(stats.idle, 1);
    assertEquals(stats.busy, 1);
    assertEquals(stats.stopped, 1);
  },
});

Deno.test({
  name: "WorkerManager - getStats() sums totalTasksCompleted across workers",
  fn() {
    const mgr = new WorkerManager();
    const id1 = mgr.create();
    const id2 = mgr.create();
    mgr.markBusy(id1); mgr.markIdle(id1);
    mgr.markBusy(id1); mgr.markIdle(id1);
    mgr.markBusy(id2); mgr.markIdle(id2);
    assertEquals(mgr.getStats().totalTasksCompleted, 3);
  },
});

// ============================================================================
// clear()
// ============================================================================

Deno.test({
  name: "WorkerManager - clear() removes all workers",
  fn() {
    const mgr = new WorkerManager();
    mgr.create(); mgr.create(); mgr.create();
    mgr.clear();
    assertEquals(mgr.getAll().length, 0);
    assertEquals(mgr.getStats().total, 0);
  },
});
