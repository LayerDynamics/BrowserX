/**
 * PortManager Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { PortManager } from "../../../core/port/port_manager.ts";

// ============================================================================
// Construction / Defaults
// ============================================================================

Deno.test({
  name: "PortManager - constructs with default port range (8000-9000)",
  fn() {
    const mgr = new PortManager();
    assertExists(mgr);
    assertEquals(mgr.getMinPort(), 8000);
    assertEquals(mgr.getMaxPort(), 9000);
  },
});

Deno.test({
  name: "PortManager - constructs with custom port range",
  fn() {
    const mgr = new PortManager(3000, 3100);
    assertEquals(mgr.getMinPort(), 3000);
    assertEquals(mgr.getMaxPort(), 3100);
  },
});

// ============================================================================
// allocate()
// ============================================================================

Deno.test({
  name: "PortManager - allocate() returns a number in range",
  fn() {
    const mgr = new PortManager(8000, 9000);
    const port = mgr.allocate();
    assertExists(port);
    assert(port !== null && port >= 8000 && port <= 9000);
  },
});

Deno.test({
  name: "PortManager - allocate() returns preferred port when available",
  fn() {
    const mgr = new PortManager(8000, 9000);
    const port = mgr.allocate(8080);
    assertEquals(port, 8080);
  },
});

Deno.test({
  name: "PortManager - allocate() returns null for preferred port out of range",
  fn() {
    const mgr = new PortManager(8000, 9000);
    const port = mgr.allocate(5000);
    assertEquals(port, null);
  },
});

Deno.test({
  name: "PortManager - allocate() returns different port on second call",
  fn() {
    const mgr = new PortManager(8000, 9000);
    const port1 = mgr.allocate();
    const port2 = mgr.allocate();
    assertExists(port1);
    assertExists(port2);
    assert(port1 !== port2);
  },
});

Deno.test({
  name: "PortManager - allocate() returns null when preferred port is already in use",
  fn() {
    const mgr = new PortManager(8000, 9000);
    mgr.allocate(8080);
    const second = mgr.allocate(8080);
    assertEquals(second, null);
  },
});

// ============================================================================
// isAvailable()
// ============================================================================

Deno.test({
  name: "PortManager - isAvailable() returns true for unallocated port in range",
  fn() {
    const mgr = new PortManager(8000, 9000);
    assert(mgr.isAvailable(8080));
  },
});

Deno.test({
  name: "PortManager - isAvailable() returns false after port is allocated",
  fn() {
    const mgr = new PortManager(8000, 9000);
    mgr.allocate(8080);
    assert(!mgr.isAvailable(8080));
  },
});

Deno.test({
  name: "PortManager - isAvailable() returns false for port below minPort",
  fn() {
    const mgr = new PortManager(8000, 9000);
    assert(!mgr.isAvailable(7999));
  },
});

Deno.test({
  name: "PortManager - isAvailable() returns false for port above maxPort",
  fn() {
    const mgr = new PortManager(8000, 9000);
    assert(!mgr.isAvailable(9001));
  },
});

// ============================================================================
// release()
// ============================================================================

Deno.test({
  name: "PortManager - release() makes port available again",
  fn() {
    const mgr = new PortManager(8000, 9000);
    mgr.allocate(8080);
    assert(!mgr.isAvailable(8080));
    mgr.release(8080);
    assert(mgr.isAvailable(8080));
  },
});

Deno.test({
  name: "PortManager - released port can be reallocated",
  fn() {
    const mgr = new PortManager(8000, 9000);
    mgr.allocate(8080);
    mgr.release(8080);
    const port = mgr.allocate(8080);
    assertEquals(port, 8080);
  },
});

// ============================================================================
// getAllocated()
// ============================================================================

Deno.test({
  name: "PortManager - getAllocated() returns empty array initially",
  fn() {
    const mgr = new PortManager(8000, 9000);
    assertEquals(mgr.getAllocated().length, 0);
  },
});

Deno.test({
  name: "PortManager - getAllocated() contains allocated ports",
  fn() {
    const mgr = new PortManager(8000, 9000);
    mgr.allocate(8080);
    mgr.allocate(8081);
    const allocated = mgr.getAllocated();
    assert(allocated.includes(8080));
    assert(allocated.includes(8081));
    assertEquals(allocated.length, 2);
  },
});

// ============================================================================
// getStats()
// ============================================================================

Deno.test({
  name: "PortManager - getStats() returns correct total port count",
  fn() {
    const mgr = new PortManager(8000, 9000);
    const stats = mgr.getStats();
    assertEquals(stats.totalPorts, 1001);
    assertEquals(stats.allocatedPorts, 0);
    assertEquals(stats.availablePorts, 1001);
  },
});

Deno.test({
  name: "PortManager - getStats() updates after allocation",
  fn() {
    const mgr = new PortManager(8000, 9000);
    mgr.allocate(8080);
    mgr.allocate(8081);
    const stats = mgr.getStats();
    assertEquals(stats.allocatedPorts, 2);
    assertEquals(stats.availablePorts, 999);
  },
});

Deno.test({
  name: "PortManager - getStats() includes minPort and maxPort",
  fn() {
    const mgr = new PortManager(3000, 3100);
    const stats = mgr.getStats();
    assertEquals(stats.minPort, 3000);
    assertEquals(stats.maxPort, 3100);
  },
});

// ============================================================================
// clear()
// ============================================================================

Deno.test({
  name: "PortManager - clear() frees all allocations",
  fn() {
    const mgr = new PortManager(8000, 9000);
    mgr.allocate(8080);
    mgr.allocate(8081);
    mgr.clear();
    assertEquals(mgr.getAllocated().length, 0);
    assert(mgr.isAvailable(8080));
    assert(mgr.isAvailable(8081));
  },
});
