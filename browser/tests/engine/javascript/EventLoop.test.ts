/**
 * EventLoop Tests
 *
 * Comprehensive tests for the JavaScript event loop with task queues.
 */

import { assertEquals } from "@std/assert";
import {
    TaskPriority,
    TaskType,
    EventLoop,
    EventLoopFactory,
    getGlobalEventLoop,
    setGlobalEventLoop,
} from "../../../src/engine/javascript/EventLoop.ts";

// ============================================================================
// EventLoop Constructor and Configuration Tests
// ============================================================================

Deno.test({
    name: "EventLoop - constructor creates loop with default config",
    fn() {
        const loop = new EventLoop();
        const config = loop.getConfig();

        assertEquals(config.maxMicrotasksPerCycle, 1000);
        assertEquals(config.maxTaskExecutionTime, 50);
        assertEquals(config.enableIdleTasks, true);
        assertEquals(config.targetFrameRate, 60);
    },
});

Deno.test({
    name: "EventLoop - constructor accepts custom config",
    fn() {
        const loop = new EventLoop({
            maxMicrotasksPerCycle: 500,
            maxTaskExecutionTime: 100,
            enableIdleTasks: false,
            targetFrameRate: 30,
        });

        const config = loop.getConfig();
        assertEquals(config.maxMicrotasksPerCycle, 500);
        assertEquals(config.maxTaskExecutionTime, 100);
        assertEquals(config.enableIdleTasks, false);
        assertEquals(config.targetFrameRate, 30);
    },
});

Deno.test({
    name: "EventLoop - constructor initializes stats",
    fn() {
        const loop = new EventLoop();
        const stats = loop.getStats();

        assertEquals(stats.macrotasksExecuted, 0);
        assertEquals(stats.microtasksExecuted, 0);
        assertEquals(stats.totalExecutionTime, 0);
        assertEquals(stats.averageTaskTime, 0);
        assertEquals(stats.currentQueueSize, 0);
        assertEquals(stats.idleTime, 0);
        assertEquals(stats.loopIterations, 0);
    },
});

Deno.test({
    name: "EventLoop - isRunning returns false initially",
    fn() {
        const loop = new EventLoop();
        assertEquals(loop.isRunning(), false);
    },
});

// ============================================================================
// setTimeout Tests
// ============================================================================

Deno.test({
    name: "EventLoop - setTimeout schedules task",
    fn() {
        const loop = new EventLoop();
        let called = false;

        loop.setTimeout(() => {
            called = true;
        }, 0);

        assertEquals(loop.hasPendingTasks(), true);
        const sizes = loop.getQueueSizes();
        assertEquals(sizes.macrotasks, 1);
    },
});

Deno.test({
    name: "EventLoop - setTimeout with delay schedules delayed task",
    fn() {
        const loop = new EventLoop();
        const id = loop.setTimeout(() => {}, 100);

        const nextTime = loop.getNextTaskTime();
        assertEquals(nextTime !== null, true);
        if (nextTime !== null) {
            assertEquals(nextTime > performance.now(), true);
        }
    },
});

Deno.test({
    name: "EventLoop - setTimeout returns task ID",
    fn() {
        const loop = new EventLoop();
        const id1 = loop.setTimeout(() => {}, 0);
        const id2 = loop.setTimeout(() => {}, 0);

        assertEquals(typeof id1, "number");
        assertEquals(typeof id2, "number");
        assertEquals(id1 !== id2, true);
    },
});

Deno.test({
    name: "EventLoop - setTimeout executes callback",
    fn() {
        const loop = new EventLoop();
        let called = false;

        loop.setTimeout(() => {
            called = true;
        }, 0);

        loop.processPendingTasks();
        assertEquals(called, true);
    },
});

Deno.test({
    name: "EventLoop - setTimeout with priority",
    fn() {
        const loop = new EventLoop();
        const order: number[] = [];

        loop.setTimeout(() => order.push(3), 0, TaskPriority.LOW);
        loop.setTimeout(() => order.push(1), 0, TaskPriority.HIGH);
        loop.setTimeout(() => order.push(2), 0, TaskPriority.NORMAL);

        loop.processPendingTasks();
        assertEquals(order, [1, 2, 3]);
    },
});

// ============================================================================
// clearTimeout Tests
// ============================================================================

Deno.test({
    name: "EventLoop - clearTimeout cancels scheduled task",
    fn() {
        const loop = new EventLoop();
        let called = false;

        const id = loop.setTimeout(() => {
            called = true;
        }, 0);

        const cancelled = loop.clearTimeout(id);
        assertEquals(cancelled, true);

        loop.processPendingTasks();
        assertEquals(called, false);
    },
});

Deno.test({
    name: "EventLoop - clearTimeout returns false for invalid ID",
    fn() {
        const loop = new EventLoop();
        const cancelled = loop.clearTimeout(999999 as any);
        assertEquals(cancelled, false);
    },
});

// ============================================================================
// setInterval Tests
// ============================================================================

Deno.test({
    name: "EventLoop - setInterval schedules recurring task",
    fn() {
        const loop = new EventLoop();
        const callCount: number[] = [];

        loop.setInterval(() => {
            callCount.push(1);
        }, 10);

        // Simulate time passing by manually executing macrotasks multiple times
        loop.processPendingTasks();

        // Since we can't easily simulate time in tests, we just verify it was scheduled
        assertEquals(loop.hasPendingTasks(), true);
    },
});

Deno.test({
    name: "EventLoop - setInterval returns task ID",
    fn() {
        const loop = new EventLoop();
        const id = loop.setInterval(() => {}, 100);
        assertEquals(typeof id, "number");
    },
});

// ============================================================================
// clearInterval Tests
// ============================================================================

Deno.test({
    name: "EventLoop - clearInterval cancels recurring task",
    fn() {
        const loop = new EventLoop();
        const id = loop.setInterval(() => {}, 100);

        const cancelled = loop.clearInterval(id);
        assertEquals(cancelled, true);
    },
});

// ============================================================================
// queueMicrotask Tests
// ============================================================================

Deno.test({
    name: "EventLoop - queueMicrotask schedules microtask",
    fn() {
        const loop = new EventLoop();
        let called = false;

        loop.queueMicrotask(() => {
            called = true;
        });

        const sizes = loop.getQueueSizes();
        assertEquals(sizes.microtasks, 1);

        loop.processPendingTasks();
        assertEquals(called, true);
    },
});

Deno.test({
    name: "EventLoop - queueMicrotask with priority",
    fn() {
        const loop = new EventLoop();
        const order: number[] = [];

        loop.queueMicrotask(() => order.push(2), TaskPriority.NORMAL);
        loop.queueMicrotask(() => order.push(1), TaskPriority.IMMEDIATE);

        loop.processPendingTasks();
        assertEquals(order, [1, 2]);
    },
});

Deno.test({
    name: "EventLoop - microtasks execute before next macrotask",
    fn() {
        const loop = new EventLoop();
        const order: string[] = [];

        loop.setTimeout(() => {
            order.push("macro1");
            loop.queueMicrotask(() => order.push("micro1"));
        }, 0);

        loop.setTimeout(() => {
            order.push("macro2");
        }, 0);

        loop.processPendingTasks();
        assertEquals(order, ["macro1", "micro1", "macro2"]);
    },
});

// ============================================================================
// queueTask Tests
// ============================================================================

Deno.test({
    name: "EventLoop - queueTask schedules macrotask",
    fn() {
        const loop = new EventLoop();
        let called = false;

        loop.queueTask(() => {
            called = true;
        });

        loop.processPendingTasks();
        assertEquals(called, true);
    },
});

// ============================================================================
// requestAnimationFrame Tests
// ============================================================================

Deno.test({
    name: "EventLoop - requestAnimationFrame schedules render task",
    fn() {
        const loop = new EventLoop();
        let called = false;

        loop.requestAnimationFrame(() => {
            called = true;
        });

        const sizes = loop.getQueueSizes();
        assertEquals(sizes.renderTasks, 1);
    },
});

Deno.test({
    name: "EventLoop - requestAnimationFrame returns task ID",
    fn() {
        const loop = new EventLoop();
        const id = loop.requestAnimationFrame(() => {});
        assertEquals(typeof id, "number");
    },
});

// ============================================================================
// cancelAnimationFrame Tests
// ============================================================================

Deno.test({
    name: "EventLoop - cancelAnimationFrame cancels render task",
    fn() {
        const loop = new EventLoop();
        let called = false;

        const id = loop.requestAnimationFrame(() => {
            called = true;
        });

        const cancelled = loop.cancelAnimationFrame(id);
        assertEquals(cancelled, true);

        loop.processPendingTasks();
        assertEquals(called, false);
    },
});

// ============================================================================
// requestIdleCallback Tests
// ============================================================================

Deno.test({
    name: "EventLoop - requestIdleCallback schedules idle task",
    fn() {
        const loop = new EventLoop();
        let called = false;

        loop.requestIdleCallback(() => {
            called = true;
        });

        const sizes = loop.getQueueSizes();
        assertEquals(sizes.idleTasks, 1);
    },
});

Deno.test({
    name: "EventLoop - requestIdleCallback returns task ID",
    fn() {
        const loop = new EventLoop();
        const id = loop.requestIdleCallback(() => {});
        assertEquals(typeof id, "number");
    },
});

// ============================================================================
// cancelIdleCallback Tests
// ============================================================================

Deno.test({
    name: "EventLoop - cancelIdleCallback cancels idle task",
    fn() {
        const loop = new EventLoop();
        const id = loop.requestIdleCallback(() => {});

        const cancelled = loop.cancelIdleCallback(id);
        assertEquals(cancelled, true);
    },
});

// ============================================================================
// Queue Management Tests
// ============================================================================

Deno.test({
    name: "EventLoop - getQueueSizes returns current queue sizes",
    fn() {
        const loop = new EventLoop();

        loop.setTimeout(() => {}, 0);
        loop.queueMicrotask(() => {});
        loop.requestAnimationFrame(() => {});
        loop.requestIdleCallback(() => {});

        const sizes = loop.getQueueSizes();
        assertEquals(sizes.macrotasks, 1);
        assertEquals(sizes.microtasks, 1);
        assertEquals(sizes.renderTasks, 1);
        assertEquals(sizes.idleTasks, 1);
    },
});

Deno.test({
    name: "EventLoop - hasPendingTasks returns true when tasks exist",
    fn() {
        const loop = new EventLoop();

        assertEquals(loop.hasPendingTasks(), false);

        loop.setTimeout(() => {}, 0);
        assertEquals(loop.hasPendingTasks(), true);
    },
});

Deno.test({
    name: "EventLoop - hasPendingTasks returns false when no tasks exist",
    fn() {
        const loop = new EventLoop();
        assertEquals(loop.hasPendingTasks(), false);
    },
});

Deno.test({
    name: "EventLoop - clearAllQueues removes all tasks",
    fn() {
        const loop = new EventLoop();

        loop.setTimeout(() => {}, 0);
        loop.queueMicrotask(() => {});
        loop.requestAnimationFrame(() => {});
        loop.requestIdleCallback(() => {});

        loop.clearAllQueues();

        assertEquals(loop.hasPendingTasks(), false);
        const sizes = loop.getQueueSizes();
        assertEquals(sizes.macrotasks, 0);
        assertEquals(sizes.microtasks, 0);
        assertEquals(sizes.renderTasks, 0);
        assertEquals(sizes.idleTasks, 0);
    },
});

// ============================================================================
// Statistics Tests
// ============================================================================

Deno.test({
    name: "EventLoop - getStats returns current statistics",
    fn() {
        const loop = new EventLoop();
        const stats = loop.getStats();

        assertEquals(typeof stats.macrotasksExecuted, "number");
        assertEquals(typeof stats.microtasksExecuted, "number");
        assertEquals(typeof stats.totalExecutionTime, "number");
        assertEquals(typeof stats.averageTaskTime, "number");
    },
});

Deno.test({
    name: "EventLoop - resetStats resets statistics",
    fn() {
        const loop = new EventLoop();

        loop.setTimeout(() => {}, 0);
        loop.processPendingTasks();

        const statsBefore = loop.getStats();
        assertEquals(statsBefore.macrotasksExecuted > 0, true);

        loop.resetStats();

        const statsAfter = loop.getStats();
        assertEquals(statsAfter.macrotasksExecuted, 0);
        assertEquals(statsAfter.microtasksExecuted, 0);
        assertEquals(statsAfter.totalExecutionTime, 0);
    },
});

Deno.test({
    name: "EventLoop - stats track macrotask execution",
    fn() {
        const loop = new EventLoop();

        loop.setTimeout(() => {}, 0);
        loop.processPendingTasks();

        const stats = loop.getStats();
        assertEquals(stats.macrotasksExecuted, 1);
    },
});

Deno.test({
    name: "EventLoop - stats track microtask execution",
    fn() {
        const loop = new EventLoop();

        loop.queueMicrotask(() => {});
        loop.processPendingTasks();

        const stats = loop.getStats();
        assertEquals(stats.microtasksExecuted, 1);
    },
});

// ============================================================================
// Task Execution Tests
// ============================================================================

Deno.test({
    name: "EventLoop - processPendingTasks executes all tasks",
    fn() {
        const loop = new EventLoop();
        let count = 0;

        loop.setTimeout(() => count++, 0);
        loop.setTimeout(() => count++, 0);
        loop.queueMicrotask(() => count++);

        loop.processPendingTasks();

        assertEquals(count, 3);
        assertEquals(loop.hasPendingTasks(), false);
    },
});

Deno.test({
    name: "EventLoop - drainMicrotaskQueue executes all microtasks",
    fn() {
        const loop = new EventLoop();
        let count = 0;

        loop.queueMicrotask(() => count++);
        loop.queueMicrotask(() => count++);
        loop.queueMicrotask(() => count++);

        loop.drainMicrotaskQueue();

        assertEquals(count, 3);
        assertEquals(loop.getQueueSizes().microtasks, 0);
    },
});

Deno.test({
    name: "EventLoop - task execution handles errors gracefully",
    fn() {
        const loop = new EventLoop();
        let secondCalled = false;

        loop.setTimeout(() => {
            throw new Error("Test error");
        }, 0);

        loop.setTimeout(() => {
            secondCalled = true;
        }, 0);

        loop.processPendingTasks();

        // Second task should still execute
        assertEquals(secondCalled, true);
    },
});

// ============================================================================
// Task Timing Tests
// ============================================================================

Deno.test({
    name: "EventLoop - getNextTaskTime returns next scheduled time",
    fn() {
        const loop = new EventLoop();

        assertEquals(loop.getNextTaskTime(), null);

        loop.setTimeout(() => {}, 100);
        const nextTime = loop.getNextTaskTime();

        assertEquals(nextTime !== null, true);
    },
});

Deno.test({
    name: "EventLoop - getNextTaskTime returns null when no tasks",
    fn() {
        const loop = new EventLoop();
        assertEquals(loop.getNextTaskTime(), null);
    },
});

// ============================================================================
// EventLoopFactory Tests
// ============================================================================

Deno.test({
    name: "EventLoopFactory - createDefault creates loop with default config",
    fn() {
        const loop = EventLoopFactory.createDefault();
        const config = loop.getConfig();

        assertEquals(config.maxMicrotasksPerCycle, 1000);
        assertEquals(config.targetFrameRate, 60);
    },
});

Deno.test({
    name: "EventLoopFactory - createDevelopment creates loop with dev config",
    fn() {
        const loop = EventLoopFactory.createDevelopment();
        const config = loop.getConfig();

        assertEquals(config.maxMicrotasksPerCycle, 500);
        assertEquals(config.maxTaskExecutionTime, 100);
        assertEquals(config.enableIdleTasks, true);
    },
});

Deno.test({
    name: "EventLoopFactory - createProduction creates loop with prod config",
    fn() {
        const loop = EventLoopFactory.createProduction();
        const config = loop.getConfig();

        assertEquals(config.maxMicrotasksPerCycle, 2000);
        assertEquals(config.maxTaskExecutionTime, 16);
        assertEquals(config.enableIdleTasks, true);
    },
});

Deno.test({
    name: "EventLoopFactory - createForTesting creates loop with test config",
    fn() {
        const loop = EventLoopFactory.createForTesting();
        const config = loop.getConfig();

        assertEquals(config.maxMicrotasksPerCycle, 100);
        assertEquals(config.maxTaskExecutionTime, 1000);
        assertEquals(config.enableIdleTasks, false);
    },
});

Deno.test({
    name: "EventLoopFactory - createWithConfig creates loop with custom config",
    fn() {
        const customConfig = {
            maxMicrotasksPerCycle: 777,
            maxTaskExecutionTime: 888,
            enableIdleTasks: false,
            targetFrameRate: 30,
        };

        const loop = EventLoopFactory.createWithConfig(customConfig);
        const config = loop.getConfig();

        assertEquals(config.maxMicrotasksPerCycle, 777);
        assertEquals(config.maxTaskExecutionTime, 888);
        assertEquals(config.enableIdleTasks, false);
        assertEquals(config.targetFrameRate, 30);
    },
});

// ============================================================================
// Global Event Loop Tests
// ============================================================================

Deno.test({
    name: "EventLoop - getGlobalEventLoop returns event loop instance",
    fn() {
        const loop = getGlobalEventLoop();
        assertEquals(loop instanceof EventLoop, true);
    },
});

Deno.test({
    name: "EventLoop - getGlobalEventLoop returns same instance",
    fn() {
        const loop1 = getGlobalEventLoop();
        const loop2 = getGlobalEventLoop();
        assertEquals(loop1 === loop2, true);
    },
});

Deno.test({
    name: "EventLoop - setGlobalEventLoop sets global instance",
    fn() {
        const customLoop = new EventLoop({
            maxMicrotasksPerCycle: 999,
        });

        setGlobalEventLoop(customLoop);
        const loop = getGlobalEventLoop();

        assertEquals(loop === customLoop, true);
        assertEquals(loop.getConfig().maxMicrotasksPerCycle, 999);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "EventLoop - complex task execution order",
    fn() {
        const loop = new EventLoop();
        const order: string[] = [];

        // Schedule various tasks
        loop.setTimeout(() => {
            order.push("macro1");
            loop.queueMicrotask(() => order.push("micro1"));
            loop.queueMicrotask(() => order.push("micro2"));
        }, 0);

        loop.setTimeout(() => {
            order.push("macro2");
        }, 0);

        loop.queueMicrotask(() => {
            order.push("micro-before");
        });

        loop.processPendingTasks();

        // Microtasks execute before first macrotask
        // Then microtasks queued during macro1 execute before macro2
        assertEquals(order, ["micro-before", "macro1", "micro1", "micro2", "macro2"]);
    },
});

Deno.test({
    name: "EventLoop - nested task scheduling",
    fn() {
        const loop = new EventLoop();
        let count = 0;

        loop.setTimeout(() => {
            count++;
            loop.queueMicrotask(() => {
                count++;
            });
        }, 0);

        loop.processPendingTasks();
        assertEquals(count, 2);
    },
});

Deno.test({
    name: "EventLoop - cancelled tasks are not executed",
    fn() {
        const loop = new EventLoop();
        let called = false;

        const id1 = loop.setTimeout(() => {
            called = true;
        }, 0);
        const id2 = loop.setTimeout(() => {}, 0);

        loop.clearTimeout(id1);
        loop.processPendingTasks();

        assertEquals(called, false);
    },
});

Deno.test({
    name: "EventLoop - start and stop manage running state",
    fn() {
        const loop = new EventLoop();

        assertEquals(loop.isRunning(), false);

        loop.start();
        assertEquals(loop.isRunning(), true);

        loop.stop();
        assertEquals(loop.isRunning(), false);
    },
});

Deno.test({
    name: "EventLoop - multiple starts do not cause issues",
    fn() {
        const loop = new EventLoop();

        loop.start();
        loop.start(); // Should be idempotent

        assertEquals(loop.isRunning(), true);

        loop.stop();
    },
});

Deno.test({
    name: "EventLoop - getConfig returns copy of config",
    fn() {
        const loop = new EventLoop();
        const config1 = loop.getConfig();
        const config2 = loop.getConfig();

        assertEquals(config1 !== config2, true);
        assertEquals(config1.maxMicrotasksPerCycle, config2.maxMicrotasksPerCycle);
    },
});

Deno.test({
    name: "EventLoop - getStats returns copy of stats",
    fn() {
        const loop = new EventLoop();
        const stats1 = loop.getStats();
        const stats2 = loop.getStats();

        assertEquals(stats1 !== stats2, true);
        assertEquals(stats1.macrotasksExecuted, stats2.macrotasksExecuted);
    },
});
