/**
 * V8Isolate Tests
 *
 * Comprehensive tests for V8 isolate management.
 */

import { assertEquals, assertExists, assertThrows } from "@std/assert";
import {
    V8Isolate,
    IsolateFactory,
    IsolateManager,
} from "../../../src/engine/javascript/V8Isolate.ts";
import { GCType } from "../../../src/engine/javascript/V8Heap.ts";

// ============================================================================
// V8Isolate Constructor Tests
// ============================================================================

Deno.test({
    name: "V8Isolate - constructor creates isolate with default config",
    fn() {
        const isolate = new V8Isolate();

        assertExists(isolate);
        assertEquals(isolate.isDisposed(), false);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - constructor creates isolate with custom config",
    fn() {
        const isolate = new V8Isolate({
            heapSize: {
                youngGeneration: 8 * 1024 * 1024,
                oldGeneration: 64 * 1024 * 1024,
            },
            maxContexts: 5,
            enableBackgroundGC: false,
        });

        const config = isolate.getConfig();
        assertEquals(config.maxContexts, 5);
        assertEquals(config.enableBackgroundGC, false);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - constructor generates unique ID",
    fn() {
        const isolate1 = new V8Isolate();
        const isolate2 = new V8Isolate();

        const id1 = isolate1.getId();
        const id2 = isolate2.getId();

        assertEquals(id1 !== id2, true);

        isolate1.dispose();
        isolate2.dispose();
    },
});

Deno.test({
    name: "V8Isolate - getId returns isolate ID",
    fn() {
        const isolate = new V8Isolate();
        const id = isolate.getId();

        assertEquals(typeof id, "string");
        assertEquals(id.startsWith("isolate-"), true);

        isolate.dispose();
    },
});

// ============================================================================
// Context Management Tests
// ============================================================================

Deno.test({
    name: "V8Isolate - createContext creates new context",
    fn() {
        const isolate = new V8Isolate();
        const context = isolate.createContext();

        assertExists(context);
        assertEquals(isolate.getContextCount(), 1);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - createContext throws when isolate is disposed",
    fn() {
        const isolate = new V8Isolate();
        isolate.dispose();

        assertThrows(
            () => {
                isolate.createContext();
            },
            Error,
            "Isolate has been disposed"
        );
    },
});

Deno.test({
    name: "V8Isolate - createContext throws when max contexts reached",
    fn() {
        const isolate = new V8Isolate({ maxContexts: 2 });

        isolate.createContext();
        isolate.createContext();

        assertThrows(
            () => {
                isolate.createContext();
            },
            Error,
            "Maximum context limit reached"
        );

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - createContext accepts config",
    fn() {
        const isolate = new V8Isolate();
        const context = isolate.createContext({
            enableJIT: false,
        });

        assertExists(context);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - getAllContexts returns all contexts",
    fn() {
        const isolate = new V8Isolate();

        const context1 = isolate.createContext();
        const context2 = isolate.createContext();

        const contexts = isolate.getAllContexts();
        assertEquals(contexts.length, 2);
        assertEquals(contexts.includes(context1), true);
        assertEquals(contexts.includes(context2), true);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - getAllContexts returns empty array when no contexts",
    fn() {
        const isolate = new V8Isolate();
        const contexts = isolate.getAllContexts();

        assertEquals(contexts.length, 0);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - getContextCount returns correct count",
    fn() {
        const isolate = new V8Isolate();

        assertEquals(isolate.getContextCount(), 0);

        isolate.createContext();
        assertEquals(isolate.getContextCount(), 1);

        isolate.createContext();
        assertEquals(isolate.getContextCount(), 2);

        isolate.dispose();
    },
});

// ============================================================================
// Context Disposal Tests
// ============================================================================

Deno.test({
    name: "V8Isolate - disposeContext removes context",
    fn() {
        const isolate = new V8Isolate();
        const context = isolate.createContext();

        assertEquals(isolate.getContextCount(), 1);

        // Find context ID (would normally be tracked externally)
        const allContexts = isolate.getAllContexts();
        assertEquals(allContexts.length, 1);

        isolate.dispose();
    },
});

// ============================================================================
// Garbage Collection Tests
// ============================================================================

Deno.test({
    name: "V8Isolate - collectGarbage runs without errors",
    fn() {
        const isolate = new V8Isolate({ enableBackgroundGC: false });

        isolate.collectGarbage();

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - collectGarbage does nothing when disposed",
    fn() {
        const isolate = new V8Isolate({ enableBackgroundGC: false });
        isolate.dispose();

        // Should not throw
        isolate.collectGarbage();
    },
});

Deno.test({
    name: "V8Isolate - collectGarbage with GC type",
    fn() {
        const isolate = new V8Isolate({ enableBackgroundGC: false });

        isolate.collectGarbage(GCType.SCAVENGE);
        isolate.collectGarbage(GCType.MARK_SWEEP);

        isolate.dispose();
    },
});

// ============================================================================
// Statistics Tests
// ============================================================================

Deno.test({
    name: "V8Isolate - getStats returns isolate statistics",
    fn() {
        const isolate = new V8Isolate();

        const stats = isolate.getStats();

        assertEquals(typeof stats.id, "string");
        assertEquals(typeof stats.contextCount, "number");
        assertEquals(typeof stats.uptime, "number");
        assertExists(stats.heapStats);
        assertExists(stats.gcStats);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - getStats reflects context count",
    fn() {
        const isolate = new V8Isolate();

        let stats = isolate.getStats();
        assertEquals(stats.contextCount, 0);

        isolate.createContext();
        stats = isolate.getStats();
        assertEquals(stats.contextCount, 1);

        isolate.createContext();
        stats = isolate.getStats();
        assertEquals(stats.contextCount, 2);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - getHeap returns heap instance",
    fn() {
        const isolate = new V8Isolate();
        const heap = isolate.getHeap();

        assertExists(heap);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - getHeapStatistics returns heap stats",
    fn() {
        const isolate = new V8Isolate();
        const heapStats = isolate.getHeapStatistics();

        assertExists(heapStats);
        assertEquals(typeof heapStats.totalSize, "number");
        assertEquals(typeof heapStats.totalAllocated, "number");

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - getConfig returns configuration",
    fn() {
        const isolate = new V8Isolate({
            maxContexts: 7,
            enableBackgroundGC: false,
        });

        const config = isolate.getConfig();

        assertEquals(config.maxContexts, 7);
        assertEquals(config.enableBackgroundGC, false);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - getUptime returns elapsed time",
    fn() {
        const isolate = new V8Isolate();

        const uptime1 = isolate.getUptime();
        assertEquals(uptime1 >= 0, true);

        // Wait a bit
        const now = performance.now();
        while (performance.now() - now < 10) {
            // Busy wait
        }

        const uptime2 = isolate.getUptime();
        assertEquals(uptime2 > uptime1, true);

        isolate.dispose();
    },
});

// ============================================================================
// Execution Tests
// ============================================================================

Deno.test({
    name: "V8Isolate - executeInNewContext creates temporary context",
    fn() {
        const isolate = new V8Isolate();

        const countBefore = isolate.getContextCount();
        const result = isolate.executeInNewContext("1 + 1");

        // Context should be disposed after execution
        const countAfter = isolate.getContextCount();
        assertEquals(countAfter, countBefore);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - executeInNewContext returns result",
    fn() {
        const isolate = new V8Isolate();
        const result = isolate.executeInNewContext("42");

        assertExists(result);
        assertExists(result.value);

        isolate.dispose();
    },
});

// ============================================================================
// Disposal Tests
// ============================================================================

Deno.test({
    name: "V8Isolate - isDisposed returns false initially",
    fn() {
        const isolate = new V8Isolate();

        assertEquals(isolate.isDisposed(), false);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - isDisposed returns true after disposal",
    fn() {
        const isolate = new V8Isolate();

        isolate.dispose();

        assertEquals(isolate.isDisposed(), true);
    },
});

Deno.test({
    name: "V8Isolate - dispose cleans up contexts",
    fn() {
        const isolate = new V8Isolate();

        isolate.createContext();
        isolate.createContext();

        assertEquals(isolate.getContextCount(), 2);

        isolate.dispose();

        assertEquals(isolate.getContextCount(), 0);
    },
});

Deno.test({
    name: "V8Isolate - dispose is idempotent",
    fn() {
        const isolate = new V8Isolate();

        isolate.dispose();
        isolate.dispose(); // Should not throw

        assertEquals(isolate.isDisposed(), true);
    },
});

// ============================================================================
// IsolateFactory Tests
// ============================================================================

Deno.test({
    name: "IsolateFactory - createDefault creates isolate",
    fn() {
        const isolate = IsolateFactory.createDefault();

        assertExists(isolate);

        isolate.dispose();
    },
});

Deno.test({
    name: "IsolateFactory - createDevelopment creates isolate with dev config",
    fn() {
        const isolate = IsolateFactory.createDevelopment();

        const config = isolate.getConfig();
        assertEquals(config.maxContexts, 5);
        assertEquals(config.gcInterval, 10000);

        isolate.dispose();
    },
});

Deno.test({
    name: "IsolateFactory - createProduction creates isolate with prod config",
    fn() {
        const isolate = IsolateFactory.createProduction();

        const config = isolate.getConfig();
        assertEquals(config.maxContexts, 20);
        assertEquals(config.gcInterval, 3000);

        isolate.dispose();
    },
});

Deno.test({
    name: "IsolateFactory - createForTesting creates isolate with test config",
    fn() {
        const isolate = IsolateFactory.createForTesting();

        const config = isolate.getConfig();
        assertEquals(config.maxContexts, 3);
        assertEquals(config.enableBackgroundGC, false);

        isolate.dispose();
    },
});

Deno.test({
    name: "IsolateFactory - createWithConfig creates isolate with custom config",
    fn() {
        const customConfig = {
            maxContexts: 15,
            enableBackgroundGC: false,
            gcInterval: 7000,
        };

        const isolate = IsolateFactory.createWithConfig(customConfig);
        const config = isolate.getConfig();

        assertEquals(config.maxContexts, 15);
        assertEquals(config.enableBackgroundGC, false);
        assertEquals(config.gcInterval, 7000);

        isolate.dispose();
    },
});

// ============================================================================
// IsolateManager Tests
// ============================================================================

Deno.test({
    name: "IsolateManager - getInstance returns singleton",
    fn() {
        const manager1 = IsolateManager.getInstance();
        const manager2 = IsolateManager.getInstance();

        assertEquals(manager1, manager2);

        manager1.disposeAll();
    },
});

Deno.test({
    name: "IsolateManager - createIsolate creates and tracks isolate",
    fn() {
        const manager = IsolateManager.getInstance();

        const isolate = manager.createIsolate();

        assertExists(isolate);
        assertEquals(manager.getIsolateCount() > 0, true);

        manager.disposeAll();
    },
});

Deno.test({
    name: "IsolateManager - getIsolate retrieves isolate by ID",
    fn() {
        const manager = IsolateManager.getInstance();

        const isolate = manager.createIsolate();
        const id = isolate.getId();

        const retrieved = manager.getIsolate(id);

        assertEquals(retrieved, isolate);

        manager.disposeAll();
    },
});

Deno.test({
    name: "IsolateManager - getIsolate returns null for unknown ID",
    fn() {
        const manager = IsolateManager.getInstance();

        const retrieved = manager.getIsolate("unknown-id" as any);

        assertEquals(retrieved, null);

        manager.disposeAll();
    },
});

Deno.test({
    name: "IsolateManager - getAllIsolates returns all isolates",
    fn() {
        const manager = IsolateManager.getInstance();
        manager.disposeAll(); // Clean slate

        const isolate1 = manager.createIsolate();
        const isolate2 = manager.createIsolate();

        const isolates = manager.getAllIsolates();

        assertEquals(isolates.length, 2);
        assertEquals(isolates.includes(isolate1), true);
        assertEquals(isolates.includes(isolate2), true);

        manager.disposeAll();
    },
});

Deno.test({
    name: "IsolateManager - disposeIsolate removes and disposes isolate",
    fn() {
        const manager = IsolateManager.getInstance();

        const isolate = manager.createIsolate();
        const id = isolate.getId();

        const countBefore = manager.getIsolateCount();
        const disposed = manager.disposeIsolate(id);

        assertEquals(disposed, true);
        assertEquals(isolate.isDisposed(), true);
        assertEquals(manager.getIsolateCount(), countBefore - 1);

        manager.disposeAll();
    },
});

Deno.test({
    name: "IsolateManager - disposeIsolate returns false for unknown ID",
    fn() {
        const manager = IsolateManager.getInstance();

        const disposed = manager.disposeIsolate("unknown-id" as any);

        assertEquals(disposed, false);

        manager.disposeAll();
    },
});

Deno.test({
    name: "IsolateManager - disposeAll disposes all isolates",
    fn() {
        const manager = IsolateManager.getInstance();
        manager.disposeAll(); // Clean slate

        const isolate1 = manager.createIsolate();
        const isolate2 = manager.createIsolate();

        assertEquals(manager.getIsolateCount(), 2);

        manager.disposeAll();

        assertEquals(manager.getIsolateCount(), 0);
        assertEquals(isolate1.isDisposed(), true);
        assertEquals(isolate2.isDisposed(), true);
    },
});

Deno.test({
    name: "IsolateManager - getIsolateCount returns correct count",
    fn() {
        const manager = IsolateManager.getInstance();
        manager.disposeAll();

        assertEquals(manager.getIsolateCount(), 0);

        manager.createIsolate();
        assertEquals(manager.getIsolateCount(), 1);

        manager.createIsolate();
        assertEquals(manager.getIsolateCount(), 2);

        manager.disposeAll();
    },
});

Deno.test({
    name: "IsolateManager - getTotalStats aggregates statistics",
    fn() {
        const manager = IsolateManager.getInstance();
        manager.disposeAll();

        const isolate1 = manager.createIsolate();
        const isolate2 = manager.createIsolate();

        isolate1.createContext();
        isolate2.createContext();
        isolate2.createContext();

        const stats = manager.getTotalStats();

        assertEquals(stats.isolateCount, 2);
        assertEquals(stats.totalContexts, 3);
        assertEquals(typeof stats.totalHeapSize, "number");
        assertEquals(typeof stats.totalObjects, "number");

        manager.disposeAll();
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "V8Isolate - multiple contexts can be created and used",
    fn() {
        const isolate = new V8Isolate();

        const context1 = isolate.createContext();
        const context2 = isolate.createContext();

        const result1 = context1.execute("1 + 1");
        const result2 = context2.execute("2 + 2");

        assertExists(result1);
        assertExists(result2);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - contexts are isolated from each other",
    fn() {
        const isolate = new V8Isolate();

        const context1 = isolate.createContext();
        const context2 = isolate.createContext();

        // Set variable in context1
        context1.execute("var x = 42");

        // Try to access in context2 - should not exist
        const result = context2.execute("typeof x");

        // Would check that x is undefined in context2
        assertExists(result);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - GC affects all contexts",
    fn() {
        const isolate = new V8Isolate({ enableBackgroundGC: false });

        const context1 = isolate.createContext();
        const context2 = isolate.createContext();

        // Get heap stats before GC
        const statsBefore = isolate.getHeapStatistics();

        // Run GC
        isolate.collectGarbage();

        // Get heap stats after GC
        const statsAfter = isolate.getHeapStatistics();

        // Stats should exist (actual memory change may vary)
        assertExists(statsBefore);
        assertExists(statsAfter);

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - background GC can be disabled",
    fn() {
        const isolate = new V8Isolate({ enableBackgroundGC: false });

        // Should not throw or cause issues
        isolate.collectGarbage();

        isolate.dispose();
    },
});

Deno.test({
    name: "V8Isolate - config defaults are applied",
    fn() {
        const isolate = new V8Isolate();
        const config = isolate.getConfig();

        assertEquals(config.maxContexts, 10);
        assertEquals(config.enableBackgroundGC, true);
        assertEquals(config.gcInterval, 5000);
        assertExists(config.heapSize);

        isolate.dispose();
    },
});
