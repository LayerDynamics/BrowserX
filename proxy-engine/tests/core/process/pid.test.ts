/**
 * PID Registry Tests
 * Comprehensive tests for PIDRegistry functionality
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { PIDRegistry, type ProcessInfo } from "../../../core/process/pid.ts";

// ============================================================================
// Helper Functions
// ============================================================================

function createTestProcessInfo(overrides?: Partial<Omit<ProcessInfo, 'pid'>>): Omit<ProcessInfo, 'pid'> {
  return {
    name: "test-process",
    startTime: Date.now(),
    status: "running",
    ...overrides,
  };
}

// ============================================================================
// Constructor / Initialization Tests
// ============================================================================

Deno.test({
  name: "PIDRegistry - can be instantiated",
  fn() {
    const registry = new PIDRegistry();
    assertExists(registry);
  },
});

Deno.test({
  name: "PIDRegistry - starts with default PID of 1000",
  fn() {
    const registry = new PIDRegistry();
    const pid = registry.allocate("test-process");
    assertEquals(pid, 1000);
  },
});

Deno.test({
  name: "PIDRegistry - starts with custom starting PID",
  fn() {
    const registry = new PIDRegistry(5000);
    const pid = registry.allocate("test-process");
    assertEquals(pid, 5000);
  },
});

Deno.test({
  name: "PIDRegistry - initializes with empty processes",
  fn() {
    const registry = new PIDRegistry();
    assertEquals(registry.size(), 0);
    assertEquals(registry.getAll().length, 0);
  },
});

// ============================================================================
// allocate Tests
// ============================================================================

Deno.test({
  name: "PIDRegistry - allocate increments PID",
  fn() {
    const registry = new PIDRegistry(1000);

    const pid1 = registry.allocate("process-1");
    const pid2 = registry.allocate("process-2");
    const pid3 = registry.allocate("process-3");

    assertEquals(pid1, 1000);
    assertEquals(pid2, 1001);
    assertEquals(pid3, 1002);
  },
});

Deno.test({
  name: "PIDRegistry - allocate creates process with running status",
  fn() {
    const registry = new PIDRegistry();
    const pid = registry.allocate("test-process");
    const info = registry.get(pid);

    assertExists(info);
    assertEquals(info.status, "running");
  },
});

Deno.test({
  name: "PIDRegistry - allocate sets correct name",
  fn() {
    const registry = new PIDRegistry();
    const pid = registry.allocate("my-custom-process");
    const info = registry.get(pid);

    assertExists(info);
    assertEquals(info.name, "my-custom-process");
  },
});

Deno.test({
  name: "PIDRegistry - allocate sets startTime",
  fn() {
    const before = Date.now();
    const registry = new PIDRegistry();
    const pid = registry.allocate("test-process");
    const after = Date.now();

    const info = registry.get(pid);
    assertExists(info);
    assert(info.startTime >= before);
    assert(info.startTime <= after);
  },
});

Deno.test({
  name: "PIDRegistry - allocate increases registry size",
  fn() {
    const registry = new PIDRegistry();

    assertEquals(registry.size(), 0);
    registry.allocate("process-1");
    assertEquals(registry.size(), 1);
    registry.allocate("process-2");
    assertEquals(registry.size(), 2);
  },
});

// ============================================================================
// register Tests
// ============================================================================

Deno.test({
  name: "PIDRegistry - register adds process with explicit PID",
  fn() {
    const registry = new PIDRegistry();
    const info = createTestProcessInfo({ name: "registered-process" });

    registry.register(9999, info);

    const retrieved = registry.get(9999);
    assertExists(retrieved);
    assertEquals(retrieved.pid, 9999);
    assertEquals(retrieved.name, "registered-process");
  },
});

Deno.test({
  name: "PIDRegistry - register overwrites existing PID",
  fn() {
    const registry = new PIDRegistry();

    registry.register(5000, createTestProcessInfo({ name: "first" }));
    registry.register(5000, createTestProcessInfo({ name: "second" }));

    const info = registry.get(5000);
    assertExists(info);
    assertEquals(info.name, "second");
    assertEquals(registry.size(), 1);
  },
});

Deno.test({
  name: "PIDRegistry - register with all ProcessInfo fields",
  fn() {
    const registry = new PIDRegistry();
    const info: Omit<ProcessInfo, 'pid'> = {
      name: "full-process",
      startTime: 1234567890,
      status: "stopped",
      memoryUsage: 1024,
      cpuUsage: 50,
    };

    registry.register(7777, info);

    const retrieved = registry.get(7777);
    assertExists(retrieved);
    assertEquals(retrieved.memoryUsage, 1024);
    assertEquals(retrieved.cpuUsage, 50);
    assertEquals(retrieved.status, "stopped");
  },
});

// ============================================================================
// unregister Tests
// ============================================================================

Deno.test({
  name: "PIDRegistry - unregister removes process",
  fn() {
    const registry = new PIDRegistry();
    const pid = registry.allocate("test-process");

    assertEquals(registry.size(), 1);
    const result = registry.unregister(pid);

    assertEquals(result, true);
    assertEquals(registry.size(), 0);
    assertEquals(registry.get(pid), null);
  },
});

Deno.test({
  name: "PIDRegistry - unregister returns false for non-existent PID",
  fn() {
    const registry = new PIDRegistry();
    const result = registry.unregister(99999);
    assertEquals(result, false);
  },
});

Deno.test({
  name: "PIDRegistry - unregister only removes specified process",
  fn() {
    const registry = new PIDRegistry();
    const pid1 = registry.allocate("process-1");
    const pid2 = registry.allocate("process-2");
    const pid3 = registry.allocate("process-3");

    registry.unregister(pid2);

    assertExists(registry.get(pid1));
    assertEquals(registry.get(pid2), null);
    assertExists(registry.get(pid3));
    assertEquals(registry.size(), 2);
  },
});

// ============================================================================
// get Tests
// ============================================================================

Deno.test({
  name: "PIDRegistry - get returns process info for valid PID",
  fn() {
    const registry = new PIDRegistry();
    const pid = registry.allocate("test-process");
    const info = registry.get(pid);

    assertExists(info);
    assertEquals(info.pid, pid);
    assertEquals(info.name, "test-process");
  },
});

Deno.test({
  name: "PIDRegistry - get returns null for non-existent PID",
  fn() {
    const registry = new PIDRegistry();
    const info = registry.get(99999);
    assertEquals(info, null);
  },
});

// ============================================================================
// updateStatus Tests
// ============================================================================

Deno.test({
  name: "PIDRegistry - updateStatus changes process status",
  fn() {
    const registry = new PIDRegistry();
    const pid = registry.allocate("test-process");

    assertEquals(registry.get(pid)?.status, "running");

    registry.updateStatus(pid, "stopped");
    assertEquals(registry.get(pid)?.status, "stopped");

    registry.updateStatus(pid, "crashed");
    assertEquals(registry.get(pid)?.status, "crashed");
  },
});

Deno.test({
  name: "PIDRegistry - updateStatus does nothing for non-existent PID",
  fn() {
    const registry = new PIDRegistry();
    // Should not throw
    registry.updateStatus(99999, "stopped");
    assertEquals(registry.size(), 0);
  },
});

// ============================================================================
// updateStats Tests
// ============================================================================

Deno.test({
  name: "PIDRegistry - updateStats sets memory and CPU usage",
  fn() {
    const registry = new PIDRegistry();
    const pid = registry.allocate("test-process");

    registry.updateStats(pid, 2048, 75);

    const info = registry.get(pid);
    assertExists(info);
    assertEquals(info.memoryUsage, 2048);
    assertEquals(info.cpuUsage, 75);
  },
});

Deno.test({
  name: "PIDRegistry - updateStats updates existing values",
  fn() {
    const registry = new PIDRegistry();
    const pid = registry.allocate("test-process");

    registry.updateStats(pid, 1024, 50);
    registry.updateStats(pid, 4096, 90);

    const info = registry.get(pid);
    assertExists(info);
    assertEquals(info.memoryUsage, 4096);
    assertEquals(info.cpuUsage, 90);
  },
});

Deno.test({
  name: "PIDRegistry - updateStats does nothing for non-existent PID",
  fn() {
    const registry = new PIDRegistry();
    // Should not throw
    registry.updateStats(99999, 1024, 50);
    assertEquals(registry.size(), 0);
  },
});

// ============================================================================
// getAll Tests
// ============================================================================

Deno.test({
  name: "PIDRegistry - getAll returns all processes",
  fn() {
    const registry = new PIDRegistry();
    registry.allocate("process-1");
    registry.allocate("process-2");
    registry.allocate("process-3");

    const all = registry.getAll();
    assertEquals(all.length, 3);
  },
});

Deno.test({
  name: "PIDRegistry - getAll returns empty array when empty",
  fn() {
    const registry = new PIDRegistry();
    const all = registry.getAll();
    assertEquals(all.length, 0);
  },
});

Deno.test({
  name: "PIDRegistry - getAll returns array not reference",
  fn() {
    const registry = new PIDRegistry();
    registry.allocate("test");

    const all1 = registry.getAll();
    const all2 = registry.getAll();

    assert(all1 !== all2);
  },
});

// ============================================================================
// getByStatus Tests
// ============================================================================

Deno.test({
  name: "PIDRegistry - getByStatus returns processes with matching status",
  fn() {
    const registry = new PIDRegistry();
    const pid1 = registry.allocate("running-1");
    const pid2 = registry.allocate("running-2");
    const pid3 = registry.allocate("stopped-1");

    registry.updateStatus(pid3, "stopped");

    const running = registry.getByStatus("running");
    const stopped = registry.getByStatus("stopped");

    assertEquals(running.length, 2);
    assertEquals(stopped.length, 1);
    assertEquals(stopped[0].name, "stopped-1");
  },
});

Deno.test({
  name: "PIDRegistry - getByStatus returns empty array when no matches",
  fn() {
    const registry = new PIDRegistry();
    registry.allocate("test");

    const crashed = registry.getByStatus("crashed");
    assertEquals(crashed.length, 0);
  },
});

Deno.test({
  name: "PIDRegistry - getByStatus filters all statuses correctly",
  fn() {
    const registry = new PIDRegistry();
    const pid1 = registry.allocate("running-process");
    const pid2 = registry.allocate("stopped-process");
    const pid3 = registry.allocate("crashed-process");

    registry.updateStatus(pid2, "stopped");
    registry.updateStatus(pid3, "crashed");

    assertEquals(registry.getByStatus("running").length, 1);
    assertEquals(registry.getByStatus("stopped").length, 1);
    assertEquals(registry.getByStatus("crashed").length, 1);
  },
});

// ============================================================================
// clear Tests
// ============================================================================

Deno.test({
  name: "PIDRegistry - clear removes all processes",
  fn() {
    const registry = new PIDRegistry();
    registry.allocate("process-1");
    registry.allocate("process-2");
    registry.allocate("process-3");

    assertEquals(registry.size(), 3);

    registry.clear();

    assertEquals(registry.size(), 0);
    assertEquals(registry.getAll().length, 0);
  },
});

Deno.test({
  name: "PIDRegistry - clear on empty registry does nothing",
  fn() {
    const registry = new PIDRegistry();
    registry.clear();
    assertEquals(registry.size(), 0);
  },
});

// ============================================================================
// size Tests
// ============================================================================

Deno.test({
  name: "PIDRegistry - size returns correct count",
  fn() {
    const registry = new PIDRegistry();

    assertEquals(registry.size(), 0);

    registry.allocate("p1");
    assertEquals(registry.size(), 1);

    registry.allocate("p2");
    assertEquals(registry.size(), 2);

    registry.allocate("p3");
    assertEquals(registry.size(), 3);
  },
});

Deno.test({
  name: "PIDRegistry - size updates after unregister",
  fn() {
    const registry = new PIDRegistry();
    const pid1 = registry.allocate("p1");
    registry.allocate("p2");

    assertEquals(registry.size(), 2);

    registry.unregister(pid1);
    assertEquals(registry.size(), 1);
  },
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

Deno.test({
  name: "PIDRegistry - handles many processes",
  fn() {
    const registry = new PIDRegistry();
    const pids: number[] = [];

    for (let i = 0; i < 100; i++) {
      pids.push(registry.allocate(`process-${i}`));
    }

    assertEquals(registry.size(), 100);
    assertEquals(pids[0], 1000);
    assertEquals(pids[99], 1099);
  },
});

Deno.test({
  name: "PIDRegistry - allocated PIDs are always unique",
  fn() {
    const registry = new PIDRegistry();
    const pids = new Set<number>();

    for (let i = 0; i < 50; i++) {
      pids.add(registry.allocate(`process-${i}`));
    }

    assertEquals(pids.size, 50);
  },
});

Deno.test({
  name: "PIDRegistry - full lifecycle test",
  fn() {
    const registry = new PIDRegistry(2000);

    // Allocate process
    const pid = registry.allocate("web-server");
    assertEquals(registry.get(pid)?.status, "running");

    // Update stats
    registry.updateStats(pid, 1024 * 1024, 25);
    assertEquals(registry.get(pid)?.memoryUsage, 1024 * 1024);
    assertEquals(registry.get(pid)?.cpuUsage, 25);

    // Stop process
    registry.updateStatus(pid, "stopped");
    assertEquals(registry.get(pid)?.status, "stopped");

    // Unregister
    registry.unregister(pid);
    assertEquals(registry.get(pid), null);
  },
});

Deno.test({
  name: "PIDRegistry - ProcessInfo type has correct structure",
  fn() {
    const registry = new PIDRegistry();
    const pid = registry.allocate("test");
    const info = registry.get(pid);

    assertExists(info);
    assertEquals(typeof info.pid, "number");
    assertEquals(typeof info.name, "string");
    assertEquals(typeof info.startTime, "number");
    assert(["running", "stopped", "crashed"].includes(info.status));
  },
});
