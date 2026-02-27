/**
 * EventCoordinator Unit Tests
 *
 * Tests for event loop management, proxy/browser loop coordination,
 * and task queuing functionality.
 */

import {
  assertEquals,
  assertExists,
} from "@std/assert";
import { EventCoordinator, BrowserEventLoopHandle, EventCoordinatorStats } from "../../src/events/EventCoordinator.ts";
import type { EventLoopConfig } from "../../src/config/RuntimeConfig.ts";
import type { RuntimeEvent } from "../../src/types.ts";

/**
 * Create test event loop config
 */
function createTestEventLoopConfig(
  overrides: Partial<EventLoopConfig> = {},
): EventLoopConfig {
  return {
    enabled: false, // Disable actual event loop in most tests
    targetFrameRate: 60,
    maxMicrotasksPerCycle: 1000,
    enableIdleTasks: true,
    ...overrides,
  };
}

// ============================================================================
// Basic Instantiation Tests
// ============================================================================

Deno.test("EventCoordinator - instantiation with config", () => {
  const config = createTestEventLoopConfig();
  const coordinator = new EventCoordinator(config);

  assertExists(coordinator);
  assertEquals(coordinator.isRunning(), false);
});

Deno.test("EventCoordinator - initial state is not running", () => {
  const config = createTestEventLoopConfig();
  const coordinator = new EventCoordinator(config);

  assertEquals(coordinator.isRunning(), false);
  assertEquals(coordinator.isProxyLoopRunning(), false);
  assertEquals(coordinator.getActiveBrowserLoopCount(), 0);
});

// ============================================================================
// Start/Stop Tests
// ============================================================================

Deno.test({
  name: "EventCoordinator - start enables running state",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestEventLoopConfig({ enabled: false });
    const coordinator = new EventCoordinator(config);

    await coordinator.start();
    assertEquals(coordinator.isRunning(), true);

    await coordinator.stop();
    assertEquals(coordinator.isRunning(), false);
  },
});

Deno.test({
  name: "EventCoordinator - double start is idempotent",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestEventLoopConfig({ enabled: false });
    const coordinator = new EventCoordinator(config);

    await coordinator.start();
    await coordinator.start(); // Should not throw
    assertEquals(coordinator.isRunning(), true);

    await coordinator.stop();
  },
});

Deno.test({
  name: "EventCoordinator - double stop is idempotent",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestEventLoopConfig({ enabled: false });
    const coordinator = new EventCoordinator(config);

    await coordinator.start();
    await coordinator.stop();
    await coordinator.stop(); // Should not throw
    assertEquals(coordinator.isRunning(), false);
  },
});

Deno.test({
  name: "EventCoordinator - stop without start is safe",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestEventLoopConfig();
    const coordinator = new EventCoordinator(config);

    await coordinator.stop(); // Should not throw
    assertEquals(coordinator.isRunning(), false);
  },
});

// ============================================================================
// Statistics Tests
// ============================================================================

Deno.test("EventCoordinator - getStats returns valid structure", () => {
  const config = createTestEventLoopConfig();
  const coordinator = new EventCoordinator(config);

  const stats = coordinator.getStats();

  assertExists(stats);
  assertEquals(typeof stats.proxyLoopRunning, "boolean");
  assertEquals(typeof stats.browserLoopsActive, "number");
  assertEquals(typeof stats.proxyTasksQueued, "number");
  assertEquals(typeof stats.proxyTimersActive, "number");
  assertEquals(Array.isArray(stats.browserLoops), true);
});

Deno.test("EventCoordinator - getEventLoopStats returns valid structure", () => {
  const config = createTestEventLoopConfig();
  const coordinator = new EventCoordinator(config);

  const stats = coordinator.getEventLoopStats();

  assertExists(stats);
  assertEquals(typeof stats.proxyLoopRunning, "boolean");
  assertEquals(typeof stats.browserLoopsActive, "number");
  assertEquals(typeof stats.proxyTasksQueued, "number");
  assertEquals(typeof stats.proxyTimersActive, "number");
});

Deno.test("EventCoordinator - getActiveBrowserLoopCount returns 0 initially", () => {
  const config = createTestEventLoopConfig();
  const coordinator = new EventCoordinator(config);

  assertEquals(coordinator.getActiveBrowserLoopCount(), 0);
});

// ============================================================================
// Browser Event Loop Lookup Tests
// ============================================================================

Deno.test("EventCoordinator - getBrowserEventLoop returns undefined for unknown ID", () => {
  const config = createTestEventLoopConfig();
  const coordinator = new EventCoordinator(config);

  const handle = coordinator.getBrowserEventLoop("unknown-id");
  assertEquals(handle, undefined);
});

Deno.test("EventCoordinator - getBrowserEventLoopsForBrowser returns empty array for unknown browser", () => {
  const config = createTestEventLoopConfig();
  const coordinator = new EventCoordinator(config);

  const handles = coordinator.getBrowserEventLoopsForBrowser("unknown-browser");
  assertEquals(handles.length, 0);
});

Deno.test({
  name: "EventCoordinator - stopBrowserEventLoops does nothing for unknown browser",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestEventLoopConfig();
    const coordinator = new EventCoordinator(config);

    await coordinator.start();

    // Should not throw
    coordinator.stopBrowserEventLoops("unknown-browser");

    await coordinator.stop();
  },
});

// ============================================================================
// Proxy Task Queuing Tests (without actual event loop)
// ============================================================================

Deno.test("EventCoordinator - queueProxyTask returns null when loop not running", () => {
  const config = createTestEventLoopConfig({ enabled: false });
  const coordinator = new EventCoordinator(config);

  const taskId = coordinator.queueProxyTask(async () => {});
  assertEquals(taskId, null);
});

Deno.test("EventCoordinator - queueProxyMicrotask returns null when loop not running", () => {
  const config = createTestEventLoopConfig({ enabled: false });
  const coordinator = new EventCoordinator(config);

  const taskId = coordinator.queueProxyMicrotask(async () => {});
  assertEquals(taskId, null);
});

// ============================================================================
// Event Listener Tests
// ============================================================================

Deno.test("EventCoordinator - addEventListener and removeEventListener", () => {
  const config = createTestEventLoopConfig();
  const coordinator = new EventCoordinator(config);

  const events: RuntimeEvent[] = [];
  const listener = (event: RuntimeEvent) => events.push(event);

  coordinator.addEventListener(listener);
  coordinator.removeEventListener(listener);

  // Should work without errors
  assertExists(coordinator);
});

Deno.test({
  name: "EventCoordinator - stop clears all browser event loops",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestEventLoopConfig({ enabled: false });
    const coordinator = new EventCoordinator(config);

    await coordinator.start();

    // Get initial count
    const initialCount = coordinator.getActiveBrowserLoopCount();

    await coordinator.stop();

    // After stop, should have no active loops
    assertEquals(coordinator.getActiveBrowserLoopCount(), 0);
    assertEquals(coordinator.isRunning(), false);
  },
});

// ============================================================================
// Integration Tests (with mocked event loops)
// ============================================================================

Deno.test("EventCoordinator - stats reflect correct state when disabled", async () => {
  const config = createTestEventLoopConfig({ enabled: false });
  const coordinator = new EventCoordinator(config);

  await coordinator.start();

  const stats = coordinator.getStats();

  // Proxy loop should not be running when disabled
  assertEquals(stats.proxyLoopRunning, false);
  assertEquals(stats.browserLoopsActive, 0);

  await coordinator.stop();
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test({
  name: "EventCoordinator - stop() awaits proxy loop promise before completing (race condition fix)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const config = createTestEventLoopConfig({ enabled: false });
    const coordinator = new EventCoordinator(config);

    await coordinator.start();

    // Inject a mock proxy event loop and promise to simulate the race
    let loopResolved = false;
    let stopCalled = false;

    const mockProxyEventLoop = {
      run: () => new Promise<void>(() => {}), // never resolves on its own
      stop: () => { stopCalled = true; },
      isRunning: () => !stopCalled,
      getStats: () => ({}),
      queueMacroTask: () => 0,
      queueMicroTask: () => 0,
    };

    // Create a promise that resolves after a short delay (simulating loop finishing after stop)
    const loopPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        loopResolved = true;
        resolve();
      }, 50);
    });

    // Set private fields directly to simulate an active proxy loop
    (coordinator as any).proxyEventLoop = mockProxyEventLoop;
    (coordinator as any).proxyLoopPromise = loopPromise;

    // stop() should await the loop promise before returning
    await coordinator.stop();

    // The loop promise should have resolved because stop() waited for it
    assertEquals(loopResolved, true, "stop() should have awaited the proxy loop promise");
    assertEquals(stopCalled, true, "stop() should have called proxyEventLoop.stop()");
  },
});

Deno.test("EventCoordinator - handles various priority levels for tasks", () => {
  const config = createTestEventLoopConfig({ enabled: false });
  const coordinator = new EventCoordinator(config);

  // These should all return null since loop isn't running, but shouldn't throw
  const highPriority = coordinator.queueProxyTask(async () => {}, "high");
  const normalPriority = coordinator.queueProxyTask(async () => {}, "normal");
  const lowPriority = coordinator.queueProxyTask(async () => {}, "low");

  assertEquals(highPriority, null);
  assertEquals(normalPriority, null);
  assertEquals(lowPriority, null);
});
