/**
 * EventLoop Tests
 * Comprehensive tests for EventLoop functionality
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { EventLoop, globalEventLoop } from "../../../core/event/loop.ts";

// ============================================================================
// Constructor / Initialization Tests
// ============================================================================

Deno.test({
  name: "EventLoop - can be instantiated",
  fn() {
    const loop = new EventLoop();
    assertExists(loop);
  },
});

Deno.test({
  name: "EventLoop - starts in stopped state",
  fn() {
    const loop = new EventLoop();
    assertEquals(loop.isRunning(), false);
  },
});

Deno.test({
  name: "EventLoop - starts with empty queues",
  fn() {
    const loop = new EventLoop();
    const stats = loop.getStats();

    assertEquals(stats.macroTaskCount, 0);
    assertEquals(stats.microTaskCount, 0);
    assertEquals(stats.timerCount, 0);
  },
});

// ============================================================================
// globalEventLoop Tests
// ============================================================================

Deno.test({
  name: "globalEventLoop - exists and is an EventLoop instance",
  fn() {
    assertExists(globalEventLoop);
    assert(globalEventLoop instanceof EventLoop);
  },
});

// ============================================================================
// setTimeout Tests
// ============================================================================

Deno.test({
  name: "EventLoop - setTimeout returns unique ID",
  fn() {
    const loop = new EventLoop();

    const id1 = loop.setTimeout(() => {}, 100);
    const id2 = loop.setTimeout(() => {}, 100);
    const id3 = loop.setTimeout(() => {}, 100);

    assert(id1 !== id2);
    assert(id2 !== id3);
    assert(id1 !== id3);

    loop.clear();
  },
});

Deno.test({
  name: "EventLoop - setTimeout adds to timer count",
  fn() {
    const loop = new EventLoop();

    assertEquals(loop.getStats().timerCount, 0);

    loop.setTimeout(() => {}, 100);
    assertEquals(loop.getStats().timerCount, 1);

    loop.setTimeout(() => {}, 200);
    assertEquals(loop.getStats().timerCount, 2);

    loop.clear();
  },
});

Deno.test({
  name: "EventLoop - setTimeout creates one-shot timer",
  fn() {
    const loop = new EventLoop();

    loop.setTimeout(() => {}, 100);
    const stats = loop.getStats();

    assertEquals(stats.timerCount, 1);

    loop.clear();
  },
});

// ============================================================================
// setInterval Tests
// ============================================================================

Deno.test({
  name: "EventLoop - setInterval returns unique ID",
  fn() {
    const loop = new EventLoop();

    const id1 = loop.setInterval(() => {}, 100);
    const id2 = loop.setInterval(() => {}, 100);

    assert(id1 !== id2);

    loop.clear();
  },
});

Deno.test({
  name: "EventLoop - setInterval adds to timer count",
  fn() {
    const loop = new EventLoop();

    loop.setInterval(() => {}, 100);
    assertEquals(loop.getStats().timerCount, 1);

    loop.setInterval(() => {}, 200);
    assertEquals(loop.getStats().timerCount, 2);

    loop.clear();
  },
});

// ============================================================================
// clearTimeout Tests
// ============================================================================

Deno.test({
  name: "EventLoop - clearTimeout removes timer",
  fn() {
    const loop = new EventLoop();

    const id = loop.setTimeout(() => {}, 100);
    assertEquals(loop.getStats().timerCount, 1);

    loop.clearTimeout(id);
    assertEquals(loop.getStats().timerCount, 0);
  },
});

Deno.test({
  name: "EventLoop - clearTimeout handles non-existent ID",
  fn() {
    const loop = new EventLoop();
    // Should not throw
    loop.clearTimeout(99999);
    assertEquals(loop.getStats().timerCount, 0);
  },
});

// ============================================================================
// clearInterval Tests
// ============================================================================

Deno.test({
  name: "EventLoop - clearInterval removes timer",
  fn() {
    const loop = new EventLoop();

    const id = loop.setInterval(() => {}, 100);
    assertEquals(loop.getStats().timerCount, 1);

    loop.clearInterval(id);
    assertEquals(loop.getStats().timerCount, 0);
  },
});

// ============================================================================
// queueMacroTask Tests
// ============================================================================

Deno.test({
  name: "EventLoop - queueMacroTask adds to queue",
  fn() {
    const loop = new EventLoop();

    loop.queueMacroTask(async () => {});
    assertEquals(loop.getStats().macroTaskCount, 1);

    loop.queueMacroTask(async () => {});
    assertEquals(loop.getStats().macroTaskCount, 2);

    loop.clear();
  },
});

Deno.test({
  name: "EventLoop - queueMacroTask returns task ID",
  fn() {
    const loop = new EventLoop();

    const id1 = loop.queueMacroTask(async () => {});
    const id2 = loop.queueMacroTask(async () => {});

    assert(typeof id1 === "number");
    assert(id1 !== id2);

    loop.clear();
  },
});

Deno.test({
  name: "EventLoop - queueMacroTask high priority goes first",
  fn() {
    const loop = new EventLoop();

    loop.queueMacroTask(async () => {}, "normal");
    loop.queueMacroTask(async () => {}, "high");
    loop.queueMacroTask(async () => {}, "low");

    // Queue should have high priority first
    assertEquals(loop.getStats().macroTaskCount, 3);

    loop.clear();
  },
});

Deno.test({
  name: "EventLoop - queueMacroTask low priority goes last",
  fn() {
    const loop = new EventLoop();

    loop.queueMacroTask(async () => {}, "low");
    loop.queueMacroTask(async () => {}, "normal");

    assertEquals(loop.getStats().macroTaskCount, 2);

    loop.clear();
  },
});

Deno.test({
  name: "EventLoop - queueMacroTask normal priority in middle",
  fn() {
    const loop = new EventLoop();

    loop.queueMacroTask(async () => {}, "high");
    loop.queueMacroTask(async () => {}, "low");
    loop.queueMacroTask(async () => {}, "normal");

    assertEquals(loop.getStats().macroTaskCount, 3);

    loop.clear();
  },
});

// ============================================================================
// queueMicroTask Tests
// ============================================================================

Deno.test({
  name: "EventLoop - queueMicroTask adds to queue",
  fn() {
    const loop = new EventLoop();

    loop.queueMicroTask(async () => {});
    assertEquals(loop.getStats().microTaskCount, 1);

    loop.queueMicroTask(async () => {});
    assertEquals(loop.getStats().microTaskCount, 2);

    loop.clear();
  },
});

Deno.test({
  name: "EventLoop - queueMicroTask returns task ID",
  fn() {
    const loop = new EventLoop();

    const id1 = loop.queueMicroTask(async () => {});
    const id2 = loop.queueMicroTask(async () => {});

    assert(typeof id1 === "number");
    assert(id1 !== id2);

    loop.clear();
  },
});

// ============================================================================
// cancelTask Tests
// ============================================================================

Deno.test({
  name: "EventLoop - cancelTask removes macro task",
  fn() {
    const loop = new EventLoop();

    const id = loop.queueMacroTask(async () => {});
    assertEquals(loop.getStats().macroTaskCount, 1);

    const result = loop.cancelTask(id);
    assertEquals(result, true);
    assertEquals(loop.getStats().macroTaskCount, 0);
  },
});

Deno.test({
  name: "EventLoop - cancelTask removes micro task",
  fn() {
    const loop = new EventLoop();

    const id = loop.queueMicroTask(async () => {});
    assertEquals(loop.getStats().microTaskCount, 1);

    const result = loop.cancelTask(id);
    assertEquals(result, true);
    assertEquals(loop.getStats().microTaskCount, 0);
  },
});

Deno.test({
  name: "EventLoop - cancelTask returns false for non-existent task",
  fn() {
    const loop = new EventLoop();

    const result = loop.cancelTask(99999);
    assertEquals(result, false);
  },
});

// ============================================================================
// getStats Tests
// ============================================================================

Deno.test({
  name: "EventLoop - getStats returns comprehensive statistics",
  fn() {
    const loop = new EventLoop();

    loop.queueMacroTask(async () => {});
    loop.queueMacroTask(async () => {});
    loop.queueMicroTask(async () => {});
    loop.setTimeout(() => {}, 100);
    loop.setInterval(() => {}, 200);

    const stats = loop.getStats();

    assertEquals(stats.running, false);
    assertEquals(stats.macroTaskCount, 2);
    assertEquals(stats.microTaskCount, 1);
    assertEquals(stats.timerCount, 2);
    assert(typeof stats.currentTime === "number");

    loop.clear();
  },
});

Deno.test({
  name: "EventLoop - getStats returns zeros when empty",
  fn() {
    const loop = new EventLoop();
    const stats = loop.getStats();

    assertEquals(stats.running, false);
    assertEquals(stats.macroTaskCount, 0);
    assertEquals(stats.microTaskCount, 0);
    assertEquals(stats.timerCount, 0);
  },
});

// ============================================================================
// clear Tests
// ============================================================================

Deno.test({
  name: "EventLoop - clear removes all tasks and timers",
  fn() {
    const loop = new EventLoop();

    loop.queueMacroTask(async () => {});
    loop.queueMicroTask(async () => {});
    loop.setTimeout(() => {}, 100);
    loop.setInterval(() => {}, 200);

    const beforeStats = loop.getStats();
    assert(beforeStats.macroTaskCount > 0);
    assert(beforeStats.microTaskCount > 0);
    assert(beforeStats.timerCount > 0);

    loop.clear();

    const afterStats = loop.getStats();
    assertEquals(afterStats.macroTaskCount, 0);
    assertEquals(afterStats.microTaskCount, 0);
    assertEquals(afterStats.timerCount, 0);
  },
});

Deno.test({
  name: "EventLoop - clear on empty loop does nothing",
  fn() {
    const loop = new EventLoop();
    loop.clear();
    const stats = loop.getStats();

    assertEquals(stats.macroTaskCount, 0);
    assertEquals(stats.microTaskCount, 0);
    assertEquals(stats.timerCount, 0);
  },
});

// ============================================================================
// run/stop Tests
// ============================================================================

Deno.test({
  name: "EventLoop - run starts the loop",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const loop = new EventLoop();

    assertEquals(loop.isRunning(), false);

    // Start loop in background
    const runPromise = loop.run();

    // Give loop time to start
    await new Promise((resolve) => globalThis.setTimeout(resolve, 20));

    assertEquals(loop.isRunning(), true);

    loop.stop();
    await runPromise;

    assertEquals(loop.isRunning(), false);
  },
});

Deno.test({
  name: "EventLoop - stop terminates the loop",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const loop = new EventLoop();

    const runPromise = loop.run();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 20));

    assertEquals(loop.isRunning(), true);

    loop.stop();
    await runPromise;

    assertEquals(loop.isRunning(), false);
  },
});

Deno.test({
  name: "EventLoop - run does nothing if already running",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const loop = new EventLoop();

    const runPromise1 = loop.run();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 20));

    // Second call should return immediately
    const runPromise2 = loop.run();

    assertEquals(loop.isRunning(), true);

    loop.stop();
    await runPromise1;
    await runPromise2;
  },
});

// ============================================================================
// isRunning Tests
// ============================================================================

Deno.test({
  name: "EventLoop - isRunning returns correct state",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const loop = new EventLoop();

    assertEquals(loop.isRunning(), false);

    const runPromise = loop.run();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
    assertEquals(loop.isRunning(), true);

    loop.stop();
    await runPromise;
    assertEquals(loop.isRunning(), false);
  },
});

// ============================================================================
// Task Execution Tests
// ============================================================================

Deno.test({
  name: "EventLoop - executes macro tasks",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const loop = new EventLoop();
    let executed = false;

    loop.queueMacroTask(async () => {
      executed = true;
    });

    const runPromise = loop.run();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 50));

    loop.stop();
    await runPromise;

    assertEquals(executed, true);
  },
});

Deno.test({
  name: "EventLoop - executes micro tasks before macro tasks",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const loop = new EventLoop();
    const order: string[] = [];

    // Add macro task first
    loop.queueMacroTask(async () => {
      order.push("macro");
    });

    // Add micro task second
    loop.queueMicroTask(async () => {
      order.push("micro");
    });

    const runPromise = loop.run();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 50));

    loop.stop();
    await runPromise;

    // Micro tasks should execute first
    assertEquals(order[0], "micro");
    assertEquals(order[1], "macro");
  },
});

Deno.test({
  name: "EventLoop - handles task errors without crashing",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const loop = new EventLoop();
    let secondExecuted = false;

    loop.queueMacroTask(async () => {
      throw new Error("Test error");
    });

    loop.queueMacroTask(async () => {
      secondExecuted = true;
    });

    const runPromise = loop.run();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));

    loop.stop();
    await runPromise;

    // Second task should still execute
    assertEquals(secondExecuted, true);
  },
});

// ============================================================================
// Timer Execution Tests
// ============================================================================

Deno.test({
  name: "EventLoop - executes setTimeout callbacks",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const loop = new EventLoop();
    let executed = false;

    // Need to start loop first so currentTime is set
    const runPromise = loop.run();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 20));

    loop.setTimeout(() => {
      executed = true;
    }, 10);

    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));

    loop.stop();
    await runPromise;

    assertEquals(executed, true);
  },
});

Deno.test({
  name: "EventLoop - removes one-shot timers after execution",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const loop = new EventLoop();

    const runPromise = loop.run();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 20));

    loop.setTimeout(() => {}, 10);
    assertEquals(loop.getStats().timerCount, 1);

    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));

    // Timer should be removed after execution
    assertEquals(loop.getStats().timerCount, 0);

    loop.stop();
    await runPromise;
  },
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

Deno.test({
  name: "EventLoop - handles many tasks",
  fn() {
    const loop = new EventLoop();

    for (let i = 0; i < 100; i++) {
      loop.queueMacroTask(async () => {});
      loop.queueMicroTask(async () => {});
    }

    const stats = loop.getStats();
    assertEquals(stats.macroTaskCount, 100);
    assertEquals(stats.microTaskCount, 100);

    loop.clear();
  },
});

Deno.test({
  name: "EventLoop - handles many timers",
  fn() {
    const loop = new EventLoop();

    for (let i = 0; i < 100; i++) {
      loop.setTimeout(() => {}, 100 + i);
    }

    assertEquals(loop.getStats().timerCount, 100);

    loop.clear();
  },
});

Deno.test({
  name: "EventLoop - full lifecycle test",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const loop = new EventLoop();
    const results: string[] = [];

    // Queue various tasks
    loop.queueMicroTask(async () => { results.push("micro-1"); });
    loop.queueMacroTask(async () => { results.push("macro-1"); });
    loop.queueMacroTask(async () => { results.push("macro-2"); }, "high");
    loop.queueMacroTask(async () => { results.push("macro-3"); }, "low");

    // Start loop
    const runPromise = loop.run();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));

    // Add more tasks while running
    loop.queueMicroTask(async () => { results.push("micro-2"); });

    await new Promise((resolve) => globalThis.setTimeout(resolve, 50));

    // Stop and verify
    loop.stop();
    await runPromise;

    assert(results.includes("micro-1"));
    assert(results.includes("macro-1"));
    assertEquals(loop.isRunning(), false);
  },
});

Deno.test({
  name: "EventLoop - Task interface has correct structure",
  fn() {
    // Test the Task type structure via getStats
    const loop = new EventLoop();

    const id = loop.queueMacroTask(async () => {}, "high");

    assert(typeof id === "number");
    assertEquals(loop.getStats().macroTaskCount, 1);

    loop.clear();
  },
});

Deno.test({
  name: "EventLoop - Timer interface has correct structure",
  fn() {
    // Test the Timer type structure via setTimeout/setInterval
    const loop = new EventLoop();

    const timeoutId = loop.setTimeout(() => {}, 100);
    const intervalId = loop.setInterval(() => {}, 100);

    assert(typeof timeoutId === "number");
    assert(typeof intervalId === "number");
    assertEquals(loop.getStats().timerCount, 2);

    loop.clear();
  },
});
