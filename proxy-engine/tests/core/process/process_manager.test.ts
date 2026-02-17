/**
 * ProcessManager Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { ProcessManager } from "../../../core/process/process_manager.ts";

// ============================================================================
// Construction
// ============================================================================

Deno.test({
  name: "ProcessManager - constructs with default min/max (2/10)",
  fn() {
    const mgr = new ProcessManager();
    assertExists(mgr);
    const stats = mgr.getStats();
    assertEquals(stats.pool.min, 2);
    assertEquals(stats.pool.max, 10);
  },
});

Deno.test({
  name: "ProcessManager - constructs with custom min/max",
  fn() {
    const mgr = new ProcessManager(3, 8);
    assertEquals(mgr.getStats().pool.min, 3);
    assertEquals(mgr.getStats().pool.max, 8);
  },
});

Deno.test({
  name: "ProcessManager - initial process count is zero",
  fn() {
    const mgr = new ProcessManager(2, 10);
    assertEquals(mgr.getStats().processes, 0);
  },
});

// ============================================================================
// start()
// ============================================================================

Deno.test({
  name: "ProcessManager - start() returns a numeric PID",
  async fn() {
    const mgr = new ProcessManager(2, 10);
    const pid = await mgr.start("test-process");
    assert(typeof pid === "number");
  },
});

Deno.test({
  name: "ProcessManager - start() registers process with running status",
  async fn() {
    const mgr = new ProcessManager(2, 10);
    const pid = await mgr.start("proc-a");
    const info = mgr.getInfo(pid);
    assertExists(info);
    assertEquals(info!.status, "running");
    assertEquals(info!.name, "proc-a");
  },
});

Deno.test({
  name: "ProcessManager - start() increments processes count",
  async fn() {
    const mgr = new ProcessManager(2, 10);
    assertEquals(mgr.getStats().processes, 0);
    await mgr.start("proc-1");
    assertEquals(mgr.getStats().processes, 1);
    await mgr.start("proc-2");
    assertEquals(mgr.getStats().processes, 2);
  },
});

Deno.test({
  name: "ProcessManager - start() throws when pool is exhausted",
  async fn() {
    const mgr = new ProcessManager(1, 1);
    await mgr.start("p1");
    let threw = false;
    try {
      await mgr.start("p2");
    } catch {
      threw = true;
    }
    assert(threw);
  },
});

// ============================================================================
// stop()
// ============================================================================

Deno.test({
  name: "ProcessManager - stop() updates process status to stopped",
  async fn() {
    const mgr = new ProcessManager(2, 10);
    const pid = await mgr.start("s1");
    await mgr.stop(pid);
    const info = mgr.getInfo(pid);
    assertExists(info);
    assertEquals(info!.status, "stopped");
  },
});

Deno.test({
  name: "ProcessManager - stop() releases the process slot back to pool",
  async fn() {
    const mgr = new ProcessManager(2, 10);
    const before = mgr.getPool().getStats().available;
    const pid = await mgr.start("rel");
    assert(mgr.getPool().getStats().available < before || before >= 0);
    await mgr.stop(pid);
    assertEquals(mgr.getPool().getStats().available, before);
  },
});

// ============================================================================
// kill()
// ============================================================================

Deno.test({
  name: "ProcessManager - kill() removes process from registry",
  async fn() {
    const mgr = new ProcessManager(2, 10);
    const pid = await mgr.start("k1");
    await mgr.kill(pid);
    assertEquals(mgr.getInfo(pid), null);
  },
});

Deno.test({
  name: "ProcessManager - kill() decrements processes count",
  async fn() {
    const mgr = new ProcessManager(2, 10);
    const pid = await mgr.start("k2");
    assertEquals(mgr.getStats().processes, 1);
    await mgr.kill(pid);
    assertEquals(mgr.getStats().processes, 0);
  },
});

// ============================================================================
// getInfo()
// ============================================================================

Deno.test({
  name: "ProcessManager - getInfo() returns null for unknown PID",
  fn() {
    assertEquals(new ProcessManager(2, 10).getInfo(99999), null);
  },
});

Deno.test({
  name: "ProcessManager - getInfo() returns correct process name",
  async fn() {
    const mgr = new ProcessManager(2, 10);
    const pid = await mgr.start("named-proc");
    assertEquals(mgr.getInfo(pid)!.name, "named-proc");
  },
});

// ============================================================================
// getAllProcesses()
// ============================================================================

Deno.test({
  name: "ProcessManager - getAllProcesses() returns empty array initially",
  fn() {
    assertEquals(new ProcessManager(2, 10).getAllProcesses(), []);
  },
});

Deno.test({
  name: "ProcessManager - getAllProcesses() returns all started processes",
  async fn() {
    const mgr = new ProcessManager(3, 10);
    await mgr.start("a");
    await mgr.start("b");
    const all = mgr.getAllProcesses();
    assertEquals(all.length, 2);
  },
});

// ============================================================================
// getPool() / getRegistry()
// ============================================================================

Deno.test({
  name: "ProcessManager - getPool() returns the underlying ProcessPool",
  fn() {
    assertExists(new ProcessManager(2, 10).getPool());
  },
});

Deno.test({
  name: "ProcessManager - getRegistry() returns the underlying PIDRegistry",
  fn() {
    assertExists(new ProcessManager(2, 10).getRegistry());
  },
});

// ============================================================================
// getStats()
// ============================================================================

Deno.test({
  name: "ProcessManager - getStats() pool field reflects pool state",
  fn() {
    const mgr = new ProcessManager(2, 10);
    const stats = mgr.getStats();
    assertExists(stats.pool);
    assertEquals(stats.pool.min, 2);
    assertEquals(stats.pool.max, 10);
  },
});

// ============================================================================
// shutdown()
// ============================================================================

Deno.test({
  name: "ProcessManager - shutdown() clears all processes",
  async fn() {
    const mgr = new ProcessManager(2, 10);
    await mgr.start("x");
    await mgr.start("y");
    assertEquals(mgr.getStats().processes, 2);
    await mgr.shutdown();
    assertEquals(mgr.getStats().processes, 0);
  },
});

Deno.test({
  name: "ProcessManager - shutdown() resets pool to empty",
  async fn() {
    const mgr = new ProcessManager(2, 10);
    await mgr.start("z");
    await mgr.shutdown();
    assertEquals(mgr.getPool().getStats().total, 0);
  },
});
