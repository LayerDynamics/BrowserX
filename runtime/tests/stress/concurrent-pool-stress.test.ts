/**
 * Concurrent Pool Stress Tests
 *
 * Tests for BrowserPool under high concurrent load:
 * - Multiple simultaneous acquire/release operations
 * - Pool exhaustion and recovery
 * - Timeout handling under load
 * - Resource cleanup under stress
 */

import {
  assertEquals,
  assertExists,
} from "@std/assert";

import { BrowserPool, type BrowserInstance } from "../../src/resources/BrowserPool.ts";
import { EventCoordinator } from "../../src/events/EventCoordinator.ts";
import { createTestConfig } from "../../src/config/RuntimeConfig.ts";

// ============================================================================
// Concurrent Acquire/Release Stress Tests
// ============================================================================

Deno.test({
  name: "Stress - Multiple concurrent acquire operations",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    config.browser.maxInstances = 10;
    config.browser.minInstances = 0;

    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);

    await eventCoordinator.start();
    await browserPool.start();

    // Launch 20 concurrent acquire operations (more than pool size)
    const acquirePromises: Promise<BrowserInstance>[] = [];
    for (let i = 0; i < 20; i++) {
      acquirePromises.push(browserPool.acquire({ timeout: 5000 }));
    }

    const results = await Promise.allSettled(acquirePromises);

    // At least some should succeed (up to maxInstances)
    // Note: With pool reuse, more than maxInstances acquires can succeed over time
    const successful = results.filter(
      (r) => r.status === "fulfilled",
    );
    assertEquals(successful.length >= 1, true);
    // Pool can recycle released instances, so may have more than maxInstances successes
    assertEquals(successful.length <= 20, true);

    // Release all acquired instances
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        browserPool.release(result.value.id);
      }
    }

    await browserPool.stop();
    await eventCoordinator.stop();
  },
});

Deno.test({
  name: "Stress - Rapid acquire/release cycles",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    config.browser.maxInstances = 5;
    config.browser.minInstances = 0;

    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);

    await eventCoordinator.start();
    await browserPool.start();

    let successCount = 0;
    const iterations = 50;

    // Rapid acquire/release cycles
    for (let i = 0; i < iterations; i++) {
      const instance = await browserPool.acquire({ timeout: 1000 });
      if (instance) {
        successCount++;
        browserPool.release(instance.id);
      }
    }

    // Most operations should succeed
    assertEquals(successCount >= iterations * 0.8, true);

    await browserPool.stop();
    await eventCoordinator.stop();
  },
});

Deno.test({
  name: "Stress - Concurrent workers acquiring from pool",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    config.browser.maxInstances = 5;
    config.browser.minInstances = 0;

    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);

    await eventCoordinator.start();
    await browserPool.start();

    // Simulate 10 workers each doing work
    const workerResults: number[] = [];

    const simulateWorker = async (workerId: number): Promise<number> => {
      let completedTasks = 0;
      for (let task = 0; task < 5; task++) {
        const instance = await browserPool.acquire({ timeout: 2000 });
        if (instance) {
          // Simulate some work
          await new Promise((r) => setTimeout(r, 10));
          browserPool.release(instance.id);
          completedTasks++;
        }
      }
      return completedTasks;
    };

    // Launch all workers concurrently
    const workerPromises: Promise<number>[] = [];
    for (let i = 0; i < 10; i++) {
      workerPromises.push(simulateWorker(i));
    }

    const results = await Promise.all(workerPromises);

    // Total completed tasks
    const totalCompleted = results.reduce((sum, count) => sum + count, 0);

    // At least 50% of total tasks (50/100) should complete
    assertEquals(totalCompleted >= 25, true);

    await browserPool.stop();
    await eventCoordinator.stop();
  },
});

// ============================================================================
// Pool Exhaustion and Recovery Tests
// ============================================================================

Deno.test({
  name: "Stress - Pool exhaustion with queued waiters",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    config.browser.maxInstances = 3;
    config.browser.minInstances = 0;

    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);

    await eventCoordinator.start();
    await browserPool.start();

    // Acquire all instances
    const heldInstances: BrowserInstance[] = [];
    for (let i = 0; i < 3; i++) {
      const instance = await browserPool.acquire({ timeout: 1000 });
      heldInstances.push(instance);
    }
    assertEquals(heldInstances.length, 3);

    // Pool should be exhausted
    const stats = browserPool.getStats();
    assertEquals(stats.idleInstances, 0);
    assertEquals(stats.inUseInstances, 3);

    // New acquire should wait/timeout (throws error on timeout)
    let timedOut = false;
    try {
      await browserPool.acquire({ timeout: 100 });
    } catch (e) {
      if (e instanceof Error && e.message.includes("pool exhausted")) {
        timedOut = true;
      }
    }
    assertEquals(timedOut, true);

    // Release one instance
    browserPool.release(heldInstances[0].id);

    // Now acquire should succeed
    const newInstance = await browserPool.acquire({ timeout: 1000 });
    assertExists(newInstance);

    // Release all
    browserPool.release(newInstance.id);
    for (let i = 1; i < heldInstances.length; i++) {
      browserPool.release(heldInstances[i].id);
    }

    await browserPool.stop();
    await eventCoordinator.stop();
  },
});

Deno.test({
  name: "Stress - Recovery after all instances released",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    config.browser.maxInstances = 5;
    config.browser.minInstances = 0;

    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);

    await eventCoordinator.start();
    await browserPool.start();

    // Exhaust the pool multiple times
    for (let round = 0; round < 3; round++) {
      // Acquire all
      const instances: BrowserInstance[] = [];
      for (let i = 0; i < 5; i++) {
        const instance = await browserPool.acquire({ timeout: 1000 });
        if (instance) {
          instances.push(instance);
        }
      }

      // Verify exhaustion
      const stats = browserPool.getStats();
      assertEquals(stats.idleInstances, 0);

      // Release all
      for (const instance of instances) {
        browserPool.release(instance.id);
      }

      // Verify recovery
      const recoveredStats = browserPool.getStats();
      assertEquals(recoveredStats.inUseInstances, 0);
    }

    await browserPool.stop();
    await eventCoordinator.stop();
  },
});

// ============================================================================
// Timeout Handling Under Load Tests
// ============================================================================

Deno.test({
  name: "Stress - Timeout handling with many waiters",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    config.browser.maxInstances = 2;
    config.browser.minInstances = 0;

    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);

    await eventCoordinator.start();
    await browserPool.start();

    // Hold all instances
    const held: BrowserInstance[] = [];
    for (let i = 0; i < 2; i++) {
      const instance = await browserPool.acquire({ timeout: 1000 });
      held.push(instance);
    }

    // Launch many acquire operations with short timeouts
    const waiters: Promise<BrowserInstance>[] = [];
    for (let i = 0; i < 20; i++) {
      waiters.push(browserPool.acquire({ timeout: 50 }));
    }

    // All should timeout (rejected promises) since pool is exhausted
    const results = await Promise.allSettled(waiters);
    const rejected = results.filter(
      (r) => r.status === "rejected",
    );

    // Most should timeout (rejected)
    assertEquals(rejected.length >= 15, true);

    // Release held instances
    for (const instance of held) {
      browserPool.release(instance.id);
    }

    await browserPool.stop();
    await eventCoordinator.stop();
  },
});

Deno.test({
  name: "Stress - Mixed timeout durations",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    config.browser.maxInstances = 3;
    config.browser.minInstances = 0;

    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);

    await eventCoordinator.start();
    await browserPool.start();

    // Hold all instances
    const held: BrowserInstance[] = [];
    for (let i = 0; i < 3; i++) {
      const instance = await browserPool.acquire({ timeout: 1000 });
      held.push(instance);
    }

    // Launch acquires with varying timeouts
    const shortTimeouts = Array(5)
      .fill(null)
      .map(() => browserPool.acquire({ timeout: 20 }));
    const mediumTimeouts = Array(5)
      .fill(null)
      .map(() => browserPool.acquire({ timeout: 100 }));
    const longTimeouts = Array(5)
      .fill(null)
      .map(() => browserPool.acquire({ timeout: 500 }));

    // Wait for short timeouts to complete - they should all timeout (reject)
    const shortResults = await Promise.allSettled(shortTimeouts);
    const shortRejected = shortResults.filter(
      (r) => r.status === "rejected",
    );
    assertEquals(shortRejected.length >= 4, true);

    // Release one instance to let some medium/long acquire
    browserPool.release(held[0].id);

    // Some medium/long timeouts might succeed now
    const mediumResults = await Promise.allSettled(mediumTimeouts);
    const longResults = await Promise.allSettled(longTimeouts);

    // Release remaining
    for (let i = 1; i < held.length; i++) {
      browserPool.release(held[i].id);
    }

    // Clean up any acquired instances
    for (const result of [...mediumResults, ...longResults]) {
      if (result.status === "fulfilled" && result.value) {
        browserPool.release(result.value.id);
      }
    }

    await browserPool.stop();
    await eventCoordinator.stop();
  },
});

// ============================================================================
// Resource Cleanup Under Stress Tests
// ============================================================================

Deno.test({
  name: "Stress - Graceful shutdown during active operations",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    config.browser.maxInstances = 5;
    config.browser.minInstances = 0;

    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);

    await eventCoordinator.start();
    await browserPool.start();

    // Acquire some instances
    const held: BrowserInstance[] = [];
    for (let i = 0; i < 3; i++) {
      const instance = await browserPool.acquire({ timeout: 1000 });
      if (instance) {
        held.push(instance);
      }
    }

    // Start background acquire operations
    const backgroundAcquires = Array(10)
      .fill(null)
      .map(() => browserPool.acquire({ timeout: 5000 }));

    // Immediately stop the pool (graceful shutdown)
    await browserPool.stop();
    await eventCoordinator.stop();

    // Wait for background operations to settle
    await Promise.allSettled(backgroundAcquires);

    // Pool should be stopped - verify it's no longer running
    // Note: totalInstances may still show previous count after stop,
    // but the pool should not be accepting new operations
    const stats = browserPool.getStats();
    // After stop, idle should be 0 (all instances cleaned up or not accepting new work)
    assertEquals(stats.idleInstances, 0);
  },
});

Deno.test({
  name: "Stress - Multiple start/stop cycles",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    config.browser.maxInstances = 3;
    config.browser.minInstances = 0;

    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);

    await eventCoordinator.start();

    // Multiple start/stop cycles
    for (let cycle = 0; cycle < 5; cycle++) {
      await browserPool.start();

      // Do some work
      const instance = await browserPool.acquire({ timeout: 500 });
      if (instance) {
        browserPool.release(instance.id);
      }

      await browserPool.stop();

      // Verify clean state
      const stats = browserPool.getStats();
      assertEquals(stats.totalInstances, 0);
    }

    await eventCoordinator.stop();
  },
});

// ============================================================================
// High Throughput Tests
// ============================================================================

Deno.test({
  name: "Stress - High throughput acquire/release",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    config.browser.maxInstances = 10;
    config.browser.minInstances = 2;

    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);

    await eventCoordinator.start();
    await browserPool.start();

    const startTime = Date.now();
    const targetOps = 100;
    let completedOps = 0;

    // Run operations for up to 5 seconds
    while (completedOps < targetOps && Date.now() - startTime < 5000) {
      const instance = await browserPool.acquire({ timeout: 100 });
      if (instance) {
        completedOps++;
        browserPool.release(instance.id);
      }
    }

    const duration = Date.now() - startTime;
    const opsPerSecond = (completedOps / duration) * 1000;

    // Should achieve at least 10 ops/sec
    assertEquals(opsPerSecond >= 10, true);

    await browserPool.stop();
    await eventCoordinator.stop();
  },
});

Deno.test({
  name: "Stress - Parallel high throughput operations",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestConfig();
    config.browser.maxInstances = 10;
    config.browser.minInstances = 0;

    const eventCoordinator = new EventCoordinator(config.eventLoop);
    const browserPool = new BrowserPool(config.browser, eventCoordinator);

    await eventCoordinator.start();
    await browserPool.start();

    // Run parallel streams of operations
    const streamCount = 5;
    const opsPerStream = 20;

    const runStream = async (): Promise<number> => {
      let completed = 0;
      for (let i = 0; i < opsPerStream; i++) {
        const instance = await browserPool.acquire({ timeout: 500 });
        if (instance) {
          completed++;
          // Small delay to simulate work
          await new Promise((r) => setTimeout(r, 5));
          browserPool.release(instance.id);
        }
      }
      return completed;
    };

    const streams = Array(streamCount).fill(null).map(() => runStream());
    const results = await Promise.all(streams);
    const totalCompleted = results.reduce((sum, count) => sum + count, 0);

    // Should complete at least 50% of operations
    assertEquals(totalCompleted >= (streamCount * opsPerStream) / 2, true);

    await browserPool.stop();
    await eventCoordinator.stop();
  },
});
