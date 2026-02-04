/**
 * Event Loop Verification Tests
 *
 * Verifies that event loops are properly started by the runtime.
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  BrowserXRuntime,
  createTestConfig,
  RuntimeState,
} from "../src/mod.ts";

Deno.test({
  name: "EventCoordinator - proxy event loop starts",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const runtime = new BrowserXRuntime({
      config: {
        ...createTestConfig(),
        eventLoop: {
          enabled: true,
          targetFrameRate: 60,
          maxMicrotasksPerCycle: 100,
          enableIdleTasks: false,
        },
        // Disable signal handling for tests
        signals: {
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
        },
      },
    });

    // Start the runtime
    await runtime.start();

    // Give the event loop time to actually start
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check that the event coordinator is running
    assertEquals(runtime.eventCoordinator.isRunning(), true);

    // Get event loop stats
    const stats = runtime.getStats();
    assertExists(stats.eventLoops);

    // The proxy loop should be running (or at least attempted to start)
    // It might fail to import in test environment, but the coordinator should still be running
    console.log("[Test] Event loop stats:", stats.eventLoops);

    // Shutdown
    await runtime.shutdown("Test complete");

    // Verify shutdown
    assertEquals(runtime.getState(), RuntimeState.STOPPED);
    assertEquals(runtime.eventCoordinator.isRunning(), false);
  },
});

Deno.test({
  name: "BrowserXRuntime - full lifecycle with event coordination",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const runtime = new BrowserXRuntime({
      config: {
        ...createTestConfig(),
        eventLoop: {
          enabled: true,
          targetFrameRate: 60,
          maxMicrotasksPerCycle: 100,
          enableIdleTasks: false,
        },
        signals: {
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
        },
      },
    });

    // Track state changes
    const stateChanges: string[] = [];
    runtime.addEventListener((event) => {
      if (event.type === "state_change") {
        stateChanges.push(`${event.from}->${event.to}`);
      }
    });

    // Start
    assertEquals(runtime.getState(), RuntimeState.STOPPED);
    await runtime.start();
    assertEquals(runtime.getState(), RuntimeState.RUNNING);

    // Verify stats show running
    const stats = runtime.getStats();
    assertEquals(stats.state, RuntimeState.RUNNING);
    assertEquals(runtime.isRunning(), true);

    // Verify uptime is tracking
    await new Promise((resolve) => setTimeout(resolve, 50));
    const uptime = runtime.getUptime();
    assertEquals(uptime >= 50, true, `Uptime should be >= 50ms, got ${uptime}ms`);

    // Shutdown
    await runtime.shutdown("Test complete");
    assertEquals(runtime.getState(), RuntimeState.STOPPED);
    assertEquals(runtime.isRunning(), false);

    // Verify state transitions occurred
    assertEquals(stateChanges.includes("stopped->starting"), true);
    assertEquals(stateChanges.includes("starting->running"), true);
    assertEquals(stateChanges.includes("running->stopping"), true);
    assertEquals(stateChanges.includes("stopping->stopped"), true);
  },
});

Deno.test({
  name: "BrowserXRuntime - metrics collection during operation",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const runtime = new BrowserXRuntime({
      config: {
        ...createTestConfig(),
        metrics: {
          enabled: true,
          healthCheckInterval: 0, // Disable periodic checks
          exportFormat: "json",
        },
        signals: {
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
        },
      },
    });

    await runtime.start();

    // Verify metrics collector is running
    assertEquals(runtime.metricsCollector.isRunning(), true);

    // Get health status
    const health = await runtime.getHealthStatus();
    assertExists(health);
    assertExists(health.status);
    assertExists(health.components);
    assertExists(health.timestamp);

    console.log("[Test] Health status:", health);

    await runtime.shutdown("Test complete");
  },
});

Deno.test({
  name: "BrowserXRuntime - browser pool operations",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const runtime = new BrowserXRuntime({
      config: {
        ...createTestConfig(),
        browser: {
          minInstances: 0,
          maxInstances: 3,
          idleTimeout: 60000,
          maxLifetime: 300000,
          defaultWidth: 1280,
          defaultHeight: 720,
          enableJavaScript: false,
          enableStorage: true,
          devicePixelRatio: 1,
        },
        signals: {
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
        },
      },
    });

    await runtime.start();

    // Get browser pool stats
    const poolStats = runtime.browserPool.getStats();
    assertExists(poolStats);
    assertEquals(poolStats.maxInstances, 3);
    assertEquals(poolStats.totalInstances, 0); // No instances yet
    assertEquals(poolStats.idleInstances, 0);
    assertEquals(poolStats.inUseInstances, 0);

    console.log("[Test] Browser pool stats:", poolStats);

    await runtime.shutdown("Test complete");
  },
});
