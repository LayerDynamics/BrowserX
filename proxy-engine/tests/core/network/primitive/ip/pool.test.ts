/**
 * IPAddressPool Tests
 * Comprehensive tests for IPAddressPool
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import { IPAddressPool } from "../../../../../core/network/primitive/ip/pool.ts";

// ============================================================================
// Constructor / Initialization Tests
// ============================================================================

Deno.test({
  name: "IPAddressPool - can be instantiated with addresses",
  fn() {
    const pool = new IPAddressPool(["192.168.1.1", "192.168.1.2"]);
    assertExists(pool);
    assertEquals(pool.size(), 2);
  },
});

Deno.test({
  name: "IPAddressPool - defaults to round-robin strategy",
  fn() {
    const pool = new IPAddressPool(["192.168.1.1", "192.168.1.2"]);

    // Round-robin should return addresses in order
    assertEquals(pool.next(), "192.168.1.1");
    assertEquals(pool.next(), "192.168.1.2");
    assertEquals(pool.next(), "192.168.1.1");
  },
});

Deno.test({
  name: "IPAddressPool - can be instantiated with random strategy",
  fn() {
    const pool = new IPAddressPool(["192.168.1.1", "192.168.1.2"], "random");
    assertExists(pool);
    // Just verify it works - random order is unpredictable
    const addr = pool.next();
    assert(addr === "192.168.1.1" || addr === "192.168.1.2");
  },
});

Deno.test({
  name: "IPAddressPool - throws on empty address array",
  fn() {
    assertThrows(
      () => new IPAddressPool([]),
      Error,
      "IP address pool cannot be empty"
    );
  },
});

Deno.test({
  name: "IPAddressPool - can be instantiated with single address",
  fn() {
    const pool = new IPAddressPool(["192.168.1.1"]);
    assertEquals(pool.size(), 1);
    assertEquals(pool.next(), "192.168.1.1");
    assertEquals(pool.next(), "192.168.1.1");
  },
});

// ============================================================================
// next Tests - Round-Robin
// ============================================================================

Deno.test({
  name: "IPAddressPool - next cycles through addresses in order",
  fn() {
    const addresses = ["10.0.0.1", "10.0.0.2", "10.0.0.3"];
    const pool = new IPAddressPool(addresses);

    assertEquals(pool.next(), "10.0.0.1");
    assertEquals(pool.next(), "10.0.0.2");
    assertEquals(pool.next(), "10.0.0.3");
    assertEquals(pool.next(), "10.0.0.1"); // Wraps around
  },
});

Deno.test({
  name: "IPAddressPool - next with single address always returns same",
  fn() {
    const pool = new IPAddressPool(["172.16.0.1"]);

    for (let i = 0; i < 10; i++) {
      assertEquals(pool.next(), "172.16.0.1");
    }
  },
});

Deno.test({
  name: "IPAddressPool - next wraps correctly after many cycles",
  fn() {
    const pool = new IPAddressPool(["a", "b", "c"]);

    // Go through 10 complete cycles
    for (let cycle = 0; cycle < 10; cycle++) {
      assertEquals(pool.next(), "a");
      assertEquals(pool.next(), "b");
      assertEquals(pool.next(), "c");
    }
  },
});

// ============================================================================
// next Tests - Random
// ============================================================================

Deno.test({
  name: "IPAddressPool - next with random returns valid addresses",
  fn() {
    const addresses = ["10.0.0.1", "10.0.0.2", "10.0.0.3"];
    const pool = new IPAddressPool(addresses, "random");

    // Get many samples, all should be valid
    for (let i = 0; i < 100; i++) {
      const addr = pool.next();
      assert(addresses.includes(addr), `${addr} should be in pool`);
    }
  },
});

Deno.test({
  name: "IPAddressPool - random strategy with single address",
  fn() {
    const pool = new IPAddressPool(["single"], "random");

    // With only one address, random always returns that address
    for (let i = 0; i < 10; i++) {
      assertEquals(pool.next(), "single");
    }
  },
});

// ============================================================================
// get Tests
// ============================================================================

Deno.test({
  name: "IPAddressPool - get returns address at index",
  fn() {
    const pool = new IPAddressPool(["a", "b", "c"]);

    assertEquals(pool.get(0), "a");
    assertEquals(pool.get(1), "b");
    assertEquals(pool.get(2), "c");
  },
});

Deno.test({
  name: "IPAddressPool - get returns null for negative index",
  fn() {
    const pool = new IPAddressPool(["a", "b"]);

    assertEquals(pool.get(-1), null);
    assertEquals(pool.get(-100), null);
  },
});

Deno.test({
  name: "IPAddressPool - get returns null for out-of-bounds index",
  fn() {
    const pool = new IPAddressPool(["a", "b"]);

    assertEquals(pool.get(2), null);
    assertEquals(pool.get(100), null);
  },
});

Deno.test({
  name: "IPAddressPool - get with index 0 on single-item pool",
  fn() {
    const pool = new IPAddressPool(["only"]);

    assertEquals(pool.get(0), "only");
    assertEquals(pool.get(1), null);
  },
});

// ============================================================================
// add Tests
// ============================================================================

Deno.test({
  name: "IPAddressPool - add increases pool size",
  fn() {
    const pool = new IPAddressPool(["a"]);
    assertEquals(pool.size(), 1);

    pool.add("b");
    assertEquals(pool.size(), 2);
  },
});

Deno.test({
  name: "IPAddressPool - add makes address available via next",
  fn() {
    const pool = new IPAddressPool(["a"]);

    pool.add("b");

    // Should cycle through both
    assertEquals(pool.next(), "a");
    assertEquals(pool.next(), "b");
  },
});

Deno.test({
  name: "IPAddressPool - add ignores duplicate addresses",
  fn() {
    const pool = new IPAddressPool(["a", "b"]);
    assertEquals(pool.size(), 2);

    pool.add("a"); // Duplicate
    assertEquals(pool.size(), 2);

    pool.add("b"); // Duplicate
    assertEquals(pool.size(), 2);
  },
});

Deno.test({
  name: "IPAddressPool - add allows new unique addresses",
  fn() {
    const pool = new IPAddressPool(["a"]);

    pool.add("b");
    pool.add("c");
    pool.add("d");

    assertEquals(pool.size(), 4);
  },
});

// ============================================================================
// remove Tests
// ============================================================================

Deno.test({
  name: "IPAddressPool - remove returns true for existing address",
  fn() {
    const pool = new IPAddressPool(["a", "b", "c"]);

    const result = pool.remove("b");

    assertEquals(result, true);
    assertEquals(pool.size(), 2);
  },
});

Deno.test({
  name: "IPAddressPool - remove returns false for non-existent address",
  fn() {
    const pool = new IPAddressPool(["a", "b"]);

    const result = pool.remove("c");

    assertEquals(result, false);
    assertEquals(pool.size(), 2);
  },
});

Deno.test({
  name: "IPAddressPool - remove adjusts currentIndex correctly",
  fn() {
    const pool = new IPAddressPool(["a", "b", "c"]);

    // Advance to position 1
    pool.next(); // a, index now 1
    pool.next(); // b, index now 2

    // Remove 'a' (index 0)
    pool.remove("a");

    // Current index should still work
    assertEquals(pool.next(), "b"); // Was c, now b at old index
  },
});

Deno.test({
  name: "IPAddressPool - remove resets index when at end",
  fn() {
    const pool = new IPAddressPool(["a", "b", "c"]);

    // Go to end
    pool.next(); // a
    pool.next(); // b
    pool.next(); // c, index wraps to 0

    // Remove last element
    pool.remove("c");

    // Should continue cycling
    const next = pool.next();
    assert(next === "a" || next === "b");
  },
});

Deno.test({
  name: "IPAddressPool - remove multiple addresses",
  fn() {
    const pool = new IPAddressPool(["a", "b", "c", "d"]);

    pool.remove("b");
    pool.remove("d");

    assertEquals(pool.size(), 2);
    assertEquals(pool.getAll(), ["a", "c"]);
  },
});

// ============================================================================
// size Tests
// ============================================================================

Deno.test({
  name: "IPAddressPool - size returns initial count",
  fn() {
    assertEquals(new IPAddressPool(["a"]).size(), 1);
    assertEquals(new IPAddressPool(["a", "b"]).size(), 2);
    assertEquals(new IPAddressPool(["a", "b", "c", "d", "e"]).size(), 5);
  },
});

Deno.test({
  name: "IPAddressPool - size updates after add/remove",
  fn() {
    const pool = new IPAddressPool(["a"]);
    assertEquals(pool.size(), 1);

    pool.add("b");
    assertEquals(pool.size(), 2);

    pool.remove("a");
    assertEquals(pool.size(), 1);
  },
});

// ============================================================================
// getAll Tests
// ============================================================================

Deno.test({
  name: "IPAddressPool - getAll returns copy of addresses",
  fn() {
    const pool = new IPAddressPool(["a", "b", "c"]);

    const all = pool.getAll();

    assertEquals(all, ["a", "b", "c"]);
  },
});

Deno.test({
  name: "IPAddressPool - getAll returns independent copy",
  fn() {
    const pool = new IPAddressPool(["a", "b"]);

    const all = pool.getAll();
    all.push("modified");

    // Original pool should be unchanged
    assertEquals(pool.size(), 2);
    assertEquals(pool.getAll(), ["a", "b"]);
  },
});

Deno.test({
  name: "IPAddressPool - getAll reflects modifications",
  fn() {
    const pool = new IPAddressPool(["a"]);

    pool.add("b");
    assertEquals(pool.getAll(), ["a", "b"]);

    pool.remove("a");
    assertEquals(pool.getAll(), ["b"]);
  },
});

// ============================================================================
// reset Tests
// ============================================================================

Deno.test({
  name: "IPAddressPool - reset sets index to 0",
  fn() {
    const pool = new IPAddressPool(["a", "b", "c"]);

    pool.next(); // a
    pool.next(); // b

    pool.reset();

    assertEquals(pool.next(), "a");
  },
});

Deno.test({
  name: "IPAddressPool - reset after partial cycle",
  fn() {
    const pool = new IPAddressPool(["x", "y", "z"]);

    pool.next(); // x
    pool.reset();
    pool.next(); // x again
    pool.next(); // y
    pool.reset();

    assertEquals(pool.next(), "x");
  },
});

Deno.test({
  name: "IPAddressPool - reset on fresh pool is no-op",
  fn() {
    const pool = new IPAddressPool(["a", "b"]);

    pool.reset();

    assertEquals(pool.next(), "a");
  },
});

// ============================================================================
// setStrategy Tests
// ============================================================================

Deno.test({
  name: "IPAddressPool - setStrategy changes to random",
  fn() {
    const pool = new IPAddressPool(["a", "b", "c"]);

    // Verify round-robin first
    assertEquals(pool.next(), "a");
    assertEquals(pool.next(), "b");

    pool.reset();
    pool.setStrategy("random");

    // Random should return valid addresses
    const results = new Set<string>();
    for (let i = 0; i < 30; i++) {
      results.add(pool.next());
    }

    // Should eventually get all addresses
    assert(results.size >= 1);
    for (const r of results) {
      assert(["a", "b", "c"].includes(r));
    }
  },
});

Deno.test({
  name: "IPAddressPool - setStrategy changes to round-robin",
  fn() {
    const pool = new IPAddressPool(["a", "b"], "random");

    pool.setStrategy("round-robin");
    pool.reset();

    assertEquals(pool.next(), "a");
    assertEquals(pool.next(), "b");
    assertEquals(pool.next(), "a");
  },
});

Deno.test({
  name: "IPAddressPool - setStrategy can toggle strategies",
  fn() {
    const pool = new IPAddressPool(["1", "2", "3"]);

    pool.setStrategy("random");
    pool.setStrategy("round-robin");
    pool.reset();

    assertEquals(pool.next(), "1");
    assertEquals(pool.next(), "2");
    assertEquals(pool.next(), "3");
  },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
  name: "IPAddressPool - typical usage scenario",
  fn() {
    // Create pool with some IPs
    const pool = new IPAddressPool([
      "192.168.1.10",
      "192.168.1.11",
      "192.168.1.12",
    ]);

    // Use round-robin for load balancing
    const usedIPs: string[] = [];
    for (let i = 0; i < 6; i++) {
      usedIPs.push(pool.next());
    }

    // Should have cycled twice
    assertEquals(usedIPs, [
      "192.168.1.10",
      "192.168.1.11",
      "192.168.1.12",
      "192.168.1.10",
      "192.168.1.11",
      "192.168.1.12",
    ]);

    // Add a new server
    pool.add("192.168.1.13");

    // Remove a failed server
    pool.remove("192.168.1.11");

    assertEquals(pool.size(), 3);
    assertEquals(pool.getAll(), [
      "192.168.1.10",
      "192.168.1.12",
      "192.168.1.13",
    ]);
  },
});

Deno.test({
  name: "IPAddressPool - handles IPv6 addresses",
  fn() {
    const pool = new IPAddressPool([
      "2001:db8::1",
      "2001:db8::2",
      "::1",
    ]);

    assertEquals(pool.size(), 3);
    assertEquals(pool.next(), "2001:db8::1");
    assertEquals(pool.next(), "2001:db8::2");
    assertEquals(pool.next(), "::1");
  },
});

Deno.test({
  name: "IPAddressPool - handles mixed IP formats",
  fn() {
    const pool = new IPAddressPool([
      "192.168.1.1",
      "2001:db8::1",
      "10.0.0.1",
      "::1",
    ]);

    assertEquals(pool.size(), 4);

    const collected: string[] = [];
    for (let i = 0; i < 4; i++) {
      collected.push(pool.next());
    }

    assertEquals(collected, [
      "192.168.1.1",
      "2001:db8::1",
      "10.0.0.1",
      "::1",
    ]);
  },
});

Deno.test({
  name: "IPAddressPool - stress test with many addresses",
  fn() {
    const addresses: string[] = [];
    for (let i = 0; i < 100; i++) {
      addresses.push(`10.0.${Math.floor(i / 256)}.${i % 256}`);
    }

    const pool = new IPAddressPool(addresses);
    assertEquals(pool.size(), 100);

    // Cycle through all
    for (let i = 0; i < 100; i++) {
      const addr = pool.next();
      assertEquals(addr, addresses[i]);
    }

    // Should wrap
    assertEquals(pool.next(), addresses[0]);
  },
});

Deno.test({
  name: "IPAddressPool - remove all but one",
  fn() {
    const pool = new IPAddressPool(["a", "b", "c"]);

    pool.remove("a");
    pool.remove("c");

    assertEquals(pool.size(), 1);
    assertEquals(pool.next(), "b");
    assertEquals(pool.next(), "b");
  },
});
