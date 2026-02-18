/**
 * EventDrivenProxy Tests
 *
 * EventDrivenProxy.start() calls Deno.listen() and enters an async for-await loop.
 * Tests focus on construction and sync-accessible methods only.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { EventDrivenProxy } from "../../../core/proxy_types/event_driven_proxy.ts";

function createConfig() {
  return {
    listenPort: 19876, // high port unlikely to conflict
    targetHost: "localhost",
    targetPort: 8080,
    maxConnections: 10,
  };
}

// ============================================================================
// Construction
// ============================================================================

Deno.test({
  name: "EventDrivenProxy - constructs with valid config",
  fn() {
    const proxy = new EventDrivenProxy(createConfig());
    assertExists(proxy);
  },
});

// ============================================================================
// getConfig()
// ============================================================================

Deno.test({
  name: "EventDrivenProxy - getConfig() returns the configured listenPort",
  fn() {
    const proxy = new EventDrivenProxy(createConfig());
    assertEquals(proxy.getConfig().listenPort, 19876);
  },
});

Deno.test({
  name: "EventDrivenProxy - getConfig() returns the configured targetHost",
  fn() {
    const proxy = new EventDrivenProxy(createConfig());
    assertEquals(proxy.getConfig().targetHost, "localhost");
  },
});

Deno.test({
  name: "EventDrivenProxy - getConfig() returns the configured targetPort",
  fn() {
    const proxy = new EventDrivenProxy(createConfig());
    assertEquals(proxy.getConfig().targetPort, 8080);
  },
});

Deno.test({
  name: "EventDrivenProxy - getConfig() returns the configured maxConnections",
  fn() {
    const proxy = new EventDrivenProxy(createConfig());
    assertEquals(proxy.getConfig().maxConnections, 10);
  },
});

// ============================================================================
// getActiveConnections()
// ============================================================================

Deno.test({
  name: "EventDrivenProxy - getActiveConnections() starts at 0",
  fn() {
    const proxy = new EventDrivenProxy(createConfig());
    assertEquals(proxy.getActiveConnections(), 0);
  },
});

// ============================================================================
// getStats()
// ============================================================================

Deno.test({
  name: "EventDrivenProxy - getStats() returns stats object",
  fn() {
    const proxy = new EventDrivenProxy(createConfig());
    const stats = proxy.getStats();
    assertExists(stats);
    assert(typeof stats === "object");
  },
});

Deno.test({
  name: "EventDrivenProxy - getStats() initializes totalConnections to 0",
  fn() {
    const proxy = new EventDrivenProxy(createConfig());
    assertEquals(proxy.getStats().totalConnections, 0);
  },
});

Deno.test({
  name: "EventDrivenProxy - getStats() initializes activeConnections to 0",
  fn() {
    const proxy = new EventDrivenProxy(createConfig());
    assertEquals(proxy.getStats().activeConnections, 0);
  },
});

Deno.test({
  name: "EventDrivenProxy - getStats() initializes bytesProxied to 0",
  fn() {
    const proxy = new EventDrivenProxy(createConfig());
    assertEquals(proxy.getStats().bytesProxied, 0);
  },
});

Deno.test({
  name: "EventDrivenProxy - getStats() initializes requestsServed to 0",
  fn() {
    const proxy = new EventDrivenProxy(createConfig());
    assertEquals(proxy.getStats().requestsServed, 0);
  },
});

// ============================================================================
// displayStats()
// ============================================================================

Deno.test({
  name: "EventDrivenProxy - displayStats() does not throw",
  fn() {
    const proxy = new EventDrivenProxy(createConfig());
    proxy.displayStats(); // Should print to console, not throw
  },
});

// ============================================================================
// Config isolation
// ============================================================================

Deno.test({
  name: "EventDrivenProxy - two instances have independent configs",
  fn() {
    const proxy1 = new EventDrivenProxy({ listenPort: 10001, targetHost: "host1", targetPort: 8081, maxConnections: 5 });
    const proxy2 = new EventDrivenProxy({ listenPort: 10002, targetHost: "host2", targetPort: 8082, maxConnections: 20 });
    assertEquals(proxy1.getConfig().listenPort, 10001);
    assertEquals(proxy2.getConfig().listenPort, 10002);
    assertEquals(proxy1.getConfig().maxConnections, 5);
    assertEquals(proxy2.getConfig().maxConnections, 20);
  },
});
