/**
 * BrowserPool Unit Tests
 *
 * Comprehensive tests for browser instance pooling, lifecycle management,
 * acquisition/release patterns, and cleanup behaviors.
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { BrowserPool } from "../../src/resources/BrowserPool.ts";
import type { BrowserPoolConfig } from "../../src/config/RuntimeConfig.ts";

/**
 * Create a test config with sensible defaults
 */
function createTestPoolConfig(
  overrides: Partial<BrowserPoolConfig> = {},
): BrowserPoolConfig {
  return {
    minInstances: 0,
    maxInstances: 5,
    idleTimeout: 60000,
    maxLifetime: 300000,
    defaultWidth: 1280,
    defaultHeight: 720,
    enableJavaScript: false,
    enableStorage: true,
    devicePixelRatio: 1,
    ...overrides,
  };
}

// ============================================================================
// Basic Instantiation Tests
// ============================================================================

Deno.test("BrowserPool - instantiation with default config", () => {
  const config = createTestPoolConfig();
  const pool = new BrowserPool(config);

  assertExists(pool);
  const stats = pool.getStats();
  assertEquals(stats.totalInstances, 0);
  assertEquals(stats.maxInstances, 5);
  assertEquals(stats.minInstances, 0);
});

Deno.test("BrowserPool - instantiation with custom config", () => {
  const config = createTestPoolConfig({
    minInstances: 2,
    maxInstances: 10,
    idleTimeout: 30000,
  });
  const pool = new BrowserPool(config);

  const stats = pool.getStats();
  assertEquals(stats.maxInstances, 10);
  assertEquals(stats.minInstances, 2);
});

// ============================================================================
// Start/Stop Lifecycle Tests
// ============================================================================

Deno.test({
  name: "BrowserPool - start initializes pool",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig({ minInstances: 0 });
    const pool = new BrowserPool(config);

    await pool.start();

    const stats = pool.getStats();
    assertEquals(stats.totalInstances >= 0, true);

    await pool.stop();
  },
});

Deno.test({
  name: "BrowserPool - stop cleans up all instances",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig({ minInstances: 0 });
    const pool = new BrowserPool(config);

    await pool.start();

    // Acquire some instances
    const instance1 = await pool.acquire({ timeout: 5000 });
    const instance2 = await pool.acquire({ timeout: 5000 });

    // Release them
    pool.release(instance1.id);
    pool.release(instance2.id);

    // Stop should clean up
    await pool.stop();

    const stats = pool.getStats();
    assertEquals(stats.totalInstances, 0);
  },
});

Deno.test({
  name: "BrowserPool - double start is idempotent",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();
    await pool.start(); // Should not throw

    await pool.stop();
  },
});

Deno.test({
  name: "BrowserPool - double stop is idempotent",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();
    await pool.stop();
    await pool.stop(); // Should not throw
  },
});

// ============================================================================
// Acquisition Tests
// ============================================================================

Deno.test({
  name: "BrowserPool - acquire returns valid instance",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();

    const instance = await pool.acquire({ timeout: 5000 });

    assertExists(instance);
    assertExists(instance.id);
    assertEquals(instance.state, "in_use");
    assertEquals(instance.useCount, 1);

    pool.release(instance.id);
    await pool.stop();
  },
});

Deno.test({
  name: "BrowserPool - acquire with URL sets currentUrl",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();

    const instance = await pool.acquire({
      timeout: 5000,
      url: "https://example.com",
    });

    assertEquals(instance.currentUrl, "https://example.com");

    pool.release(instance.id);
    await pool.stop();
  },
});

Deno.test({
  name: "BrowserPool - acquire reuses idle instances",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();

    // Acquire and release
    const instance1 = await pool.acquire({ timeout: 5000 });
    const id1 = instance1.id;
    pool.release(id1);

    // Acquire again - should reuse
    const instance2 = await pool.acquire({ timeout: 5000 });

    // Should be the same instance
    assertEquals(instance2.id, id1);
    assertEquals(instance2.useCount, 2);

    pool.release(instance2.id);
    await pool.stop();
  },
});

Deno.test({
  name: "BrowserPool - acquire creates new instance when all in use",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig({ maxInstances: 3 });
    const pool = new BrowserPool(config);

    await pool.start();

    // Acquire first instance
    const instance1 = await pool.acquire({ timeout: 5000 });

    // Acquire second instance - should create new
    const instance2 = await pool.acquire({ timeout: 5000 });

    assertEquals(instance1.id !== instance2.id, true);
    assertEquals(pool.getStats().totalInstances, 2);

    pool.release(instance1.id);
    pool.release(instance2.id);
    await pool.stop();
  },
});

Deno.test({
  name: "BrowserPool - acquire respects maxInstances limit",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig({ maxInstances: 2 });
    const pool = new BrowserPool(config);

    await pool.start();

    // Acquire up to max
    const instance1 = await pool.acquire({ timeout: 5000 });
    const instance2 = await pool.acquire({ timeout: 5000 });

    assertEquals(pool.getStats().totalInstances, 2);

    // Third acquisition should timeout
    await assertRejects(
      async () => {
        await pool.acquire({ timeout: 200 });
      },
      Error,
      "pool exhausted",
    );

    pool.release(instance1.id);
    pool.release(instance2.id);
    await pool.stop();
  },
});

// ============================================================================
// Release Tests
// ============================================================================

Deno.test({
  name: "BrowserPool - release returns instance to idle state",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();

    const instance = await pool.acquire({ timeout: 5000 });
    assertEquals(instance.state, "in_use");

    pool.release(instance.id);

    const released = pool.getInstance(instance.id);
    assertExists(released);
    assertEquals(released.state, "idle");
    assertEquals(released.currentUrl, undefined);

    await pool.stop();
  },
});

Deno.test({
  name: "BrowserPool - release unknown instance logs warning",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();

    // Should not throw, just warn
    pool.release("unknown-id");

    await pool.stop();
  },
});

Deno.test({
  name: "BrowserPool - release idle instance logs warning",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();

    const instance = await pool.acquire({ timeout: 5000 });
    pool.release(instance.id);

    // Double release should warn but not throw
    pool.release(instance.id);

    await pool.stop();
  },
});

// ============================================================================
// Instance Lookup Tests
// ============================================================================

Deno.test({
  name: "BrowserPool - getInstance returns correct instance",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();

    const instance = await pool.acquire({ timeout: 5000 });
    const retrieved = pool.getInstance(instance.id);

    assertExists(retrieved);
    assertEquals(retrieved.id, instance.id);

    pool.release(instance.id);
    await pool.stop();
  },
});

Deno.test({
  name: "BrowserPool - getInstance returns undefined for unknown id",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();

    const retrieved = pool.getInstance("unknown-id");
    assertEquals(retrieved, undefined);

    await pool.stop();
  },
});

Deno.test({
  name: "BrowserPool - hasInstance returns correct boolean",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();

    assertEquals(pool.hasInstance("unknown-id"), false);

    const instance = await pool.acquire({ timeout: 5000 });
    assertEquals(pool.hasInstance(instance.id), true);

    pool.release(instance.id);
    await pool.stop();
  },
});

// ============================================================================
// Close Instance Tests
// ============================================================================

Deno.test({
  name: "BrowserPool - closeInstance removes instance from pool",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();

    const instance = await pool.acquire({ timeout: 5000 });
    pool.release(instance.id);

    await pool.closeInstance(instance.id, "test");

    assertEquals(pool.hasInstance(instance.id), false);
    assertEquals(pool.getStats().totalClosed, 1);

    await pool.stop();
  },
});

Deno.test({
  name: "BrowserPool - closeInstance on unknown id is no-op",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();

    // Should not throw
    await pool.closeInstance("unknown-id", "test");

    await pool.stop();
  },
});

// ============================================================================
// Drain Tests
// ============================================================================

Deno.test({
  name: "BrowserPool - drain closes all idle instances",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();

    // Create and release multiple instances
    const instance1 = await pool.acquire({ timeout: 5000 });
    const instance2 = await pool.acquire({ timeout: 5000 });
    pool.release(instance1.id);
    pool.release(instance2.id);

    assertEquals(pool.getStats().idleInstances, 2);

    await pool.drain();

    assertEquals(pool.getStats().idleInstances, 0);
    assertEquals(pool.getStats().totalInstances, 0);

    await pool.stop();
  },
});

Deno.test({
  name: "BrowserPool - drain does not close in-use instances",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();

    const instance1 = await pool.acquire({ timeout: 5000 });
    const instance2 = await pool.acquire({ timeout: 5000 });
    pool.release(instance1.id); // This one is idle

    await pool.drain();

    assertEquals(pool.getStats().totalInstances, 1); // Only in-use remains
    assertEquals(pool.getStats().inUseInstances, 1);
    assertEquals(pool.hasInstance(instance2.id), true);

    pool.release(instance2.id);
    await pool.stop();
  },
});

// ============================================================================
// Statistics Tests
// ============================================================================

Deno.test({
  name: "BrowserPool - getStats returns accurate counts",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig({ maxInstances: 5 });
    const pool = new BrowserPool(config);

    await pool.start();

    // Initial stats
    let stats = pool.getStats();
    assertEquals(stats.totalInstances, 0);
    assertEquals(stats.idleInstances, 0);
    assertEquals(stats.inUseInstances, 0);
    assertEquals(stats.totalCreated, 0);
    assertEquals(stats.totalClosed, 0);

    // Acquire instances
    const instance1 = await pool.acquire({ timeout: 5000 });
    const instance2 = await pool.acquire({ timeout: 5000 });

    stats = pool.getStats();
    assertEquals(stats.totalInstances, 2);
    assertEquals(stats.inUseInstances, 2);
    assertEquals(stats.idleInstances, 0);
    assertEquals(stats.totalCreated, 2);

    // Release one
    pool.release(instance1.id);

    stats = pool.getStats();
    assertEquals(stats.inUseInstances, 1);
    assertEquals(stats.idleInstances, 1);

    // Close one
    await pool.closeInstance(instance1.id, "test");

    stats = pool.getStats();
    assertEquals(stats.totalInstances, 1);
    assertEquals(stats.totalClosed, 1);

    pool.release(instance2.id);
    await pool.stop();
  },
});

Deno.test({
  name: "BrowserPool - getResourceStats returns summary",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig();
    const pool = new BrowserPool(config);

    await pool.start();

    const instance = await pool.acquire({ timeout: 5000 });
    const resourceStats = pool.getResourceStats();

    assertExists(resourceStats.browserInstances);
    assertExists(resourceStats.activeSessions);
    assertEquals(resourceStats.browserInstances, 1);
    assertEquals(resourceStats.activeSessions, 1);

    pool.release(instance.id);
    await pool.stop();
  },
});

// ============================================================================
// Event Listener Tests
// ============================================================================

Deno.test("BrowserPool - addEventListener and removeEventListener", () => {
  const config = createTestPoolConfig();
  const pool = new BrowserPool(config);

  const events: unknown[] = [];
  const listener = (event: unknown) => events.push(event);

  pool.addEventListener(listener);
  pool.removeEventListener(listener);

  // No events should be captured after removal
  assertEquals(events.length, 0);
});

// ============================================================================
// Max Lifetime Tests
// ============================================================================

Deno.test({
  name: "BrowserPool - release closes instance exceeding maxLifetime",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig({
      maxLifetime: 1, // Very short lifetime
    });
    const pool = new BrowserPool(config);

    await pool.start();

    const instance = await pool.acquire({ timeout: 5000 });

    // Wait for lifetime to expire
    await new Promise((r) => setTimeout(r, 10));

    pool.release(instance.id);

    // Instance should be closed, not returned to pool
    assertEquals(pool.hasInstance(instance.id), false);

    await pool.stop();
  },
});

// ============================================================================
// Race Condition Tests
// ============================================================================

Deno.test({
  name: "BrowserPool - release to waiter marks instance in_use before resolving (no double-spend)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestPoolConfig({ maxInstances: 1 });
    const pool = new BrowserPool(config);

    await pool.start();

    // Acquire the only instance
    const instance1 = await pool.acquire({ timeout: 5000 });
    const instanceId = instance1.id;

    // Start a second acquire that will wait
    const acquire2Promise = pool.acquire({ timeout: 5000 });

    // Release instance1 - the waiter should get it with state already "in_use"
    pool.release(instanceId);

    // Before the waiter's microtask runs, the instance should already be in_use
    // (not idle), preventing a concurrent acquire from grabbing it
    const instanceNow = pool.getInstance(instanceId);
    assertExists(instanceNow);
    assertEquals(instanceNow.state, "in_use");

    // The waiter should resolve successfully
    const instance2 = await acquire2Promise;
    assertEquals(instance2.id, instanceId);
    assertEquals(instance2.state, "in_use");

    // Verify only one instance exists (no double-spend created a second)
    const stats = pool.getStats();
    assertEquals(stats.totalInstances, 1);

    pool.release(instance2.id);
    await pool.stop();
  },
});
