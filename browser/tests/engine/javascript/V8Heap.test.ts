/**
 * V8Heap Tests
 *
 * Comprehensive tests for heap management and garbage collection.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    V8Heap,
    MemoryPage,
    MemorySpace,
    SpaceType,
    GCType,
    ObjectColor,
    HeapFactory,
    type HeapObjectID,
} from "../../../src/engine/javascript/V8Heap.ts";
import { createNumber, createString, createBoolean, createObject } from "../../../src/engine/javascript/JSValue.ts";

// ============================================================================
// MemoryPage Constructor Tests
// ============================================================================

Deno.test({
    name: "MemoryPage - constructor creates page with default size",
    fn() {
        const page = new MemoryPage();

        assertExists(page);
        assertEquals(page.size, 256 * 1024);
    },
});

Deno.test({
    name: "MemoryPage - constructor creates page with custom size",
    fn() {
        const page = new MemoryPage(512 * 1024);

        assertEquals(page.size, 512 * 1024);
    },
});

Deno.test({
    name: "MemoryPage - constructor initializes with zero allocated",
    fn() {
        const page = new MemoryPage();

        assertEquals(page.getAllocated(), 0);
    },
});

// ============================================================================
// MemoryPage Allocation Tests
// ============================================================================

Deno.test({
    name: "MemoryPage - tryAllocate succeeds when space available",
    fn() {
        const page = new MemoryPage(1024);

        const result = page.tryAllocate(512);

        assertEquals(result, true);
        assertEquals(page.getAllocated(), 512);
    },
});

Deno.test({
    name: "MemoryPage - tryAllocate fails when space insufficient",
    fn() {
        const page = new MemoryPage(1024);

        page.tryAllocate(512);
        const result = page.tryAllocate(600);

        assertEquals(result, false);
    },
});

Deno.test({
    name: "MemoryPage - tryAllocate exactly fills page",
    fn() {
        const page = new MemoryPage(1024);

        const result = page.tryAllocate(1024);

        assertEquals(result, true);
        assertEquals(page.getAllocated(), 1024);
        assertEquals(page.getAvailable(), 0);
    },
});

Deno.test({
    name: "MemoryPage - getAvailable returns correct value",
    fn() {
        const page = new MemoryPage(1024);

        page.tryAllocate(300);

        assertEquals(page.getAvailable(), 724);
    },
});

// ============================================================================
// MemoryPage Object Management Tests
// ============================================================================

Deno.test({
    name: "MemoryPage - addObject adds object to page",
    fn() {
        const page = new MemoryPage();
        const obj = {
            id: "test-1" as HeapObjectID,
            value: createNumber(42),
            size: 16,
            color: ObjectColor.WHITE,
            generation: 0 as const,
            marked: false,
        };

        page.addObject(obj);

        const objects = page.getObjects();
        assertEquals(objects.length, 1);
        assertEquals(objects[0].id, "test-1");
    },
});

Deno.test({
    name: "MemoryPage - removeObject removes object from page",
    fn() {
        const page = new MemoryPage();
        page.tryAllocate(16);

        const obj = {
            id: "test-1" as HeapObjectID,
            value: createNumber(42),
            size: 16,
            color: ObjectColor.WHITE,
            generation: 0 as const,
            marked: false,
        };

        page.addObject(obj);
        page.removeObject("test-1" as HeapObjectID);

        const objects = page.getObjects();
        assertEquals(objects.length, 0);
        assertEquals(page.getAllocated(), 0);
    },
});

Deno.test({
    name: "MemoryPage - getObjects returns all objects",
    fn() {
        const page = new MemoryPage();

        const obj1 = {
            id: "test-1" as HeapObjectID,
            value: createNumber(1),
            size: 16,
            color: ObjectColor.WHITE,
            generation: 0 as const,
            marked: false,
        };

        const obj2 = {
            id: "test-2" as HeapObjectID,
            value: createNumber(2),
            size: 16,
            color: ObjectColor.WHITE,
            generation: 0 as const,
            marked: false,
        };

        page.addObject(obj1);
        page.addObject(obj2);

        const objects = page.getObjects();
        assertEquals(objects.length, 2);
    },
});

Deno.test({
    name: "MemoryPage - clear removes all objects",
    fn() {
        const page = new MemoryPage();
        page.tryAllocate(100);

        page.clear();

        assertEquals(page.getAllocated(), 0);
        assertEquals(page.getObjects().length, 0);
    },
});

// ============================================================================
// MemorySpace Constructor Tests
// ============================================================================

Deno.test({
    name: "MemorySpace - constructor creates space with type",
    fn() {
        const space = new MemorySpace(SpaceType.NEW_SPACE, 1024 * 1024);

        assertExists(space);
        assertEquals(space.type, SpaceType.NEW_SPACE);
        assertEquals(space.maxSize, 1024 * 1024);
    },
});

Deno.test({
    name: "MemorySpace - constructor allocates initial page",
    fn() {
        const space = new MemorySpace(SpaceType.NEW_SPACE, 1024 * 1024);

        assertEquals(space.getPageCount(), 1);
    },
});

// ============================================================================
// MemorySpace Allocation Tests
// ============================================================================

Deno.test({
    name: "MemorySpace - tryAllocate succeeds in current page",
    fn() {
        const space = new MemorySpace(SpaceType.NEW_SPACE, 1024 * 1024);

        const page = space.tryAllocate(1024);

        assertExists(page);
        assertEquals(space.getTotalSize(), 1024);
    },
});

Deno.test({
    name: "MemorySpace - tryAllocate creates new page when needed",
    fn() {
        const space = new MemorySpace(SpaceType.NEW_SPACE, 1024 * 1024);

        // Fill first page
        space.tryAllocate(256 * 1024);

        // This should create a new page
        const page = space.tryAllocate(100 * 1024);

        assertExists(page);
        assertEquals(space.getPageCount(), 2);
    },
});

Deno.test({
    name: "MemorySpace - tryAllocate fails when max size exceeded",
    fn() {
        const space = new MemorySpace(SpaceType.NEW_SPACE, 1024);

        space.tryAllocate(512);
        const page = space.tryAllocate(1024);

        assertEquals(page, null);
    },
});

Deno.test({
    name: "MemorySpace - getTotalSize returns total allocated",
    fn() {
        const space = new MemorySpace(SpaceType.NEW_SPACE, 1024 * 1024);

        space.tryAllocate(1000);
        space.tryAllocate(2000);

        assertEquals(space.getTotalSize(), 3000);
    },
});

Deno.test({
    name: "MemorySpace - getAllObjects returns objects from all pages",
    fn() {
        const space = new MemorySpace(SpaceType.NEW_SPACE, 1024 * 1024);

        // Allocate to ensure we have pages
        space.tryAllocate(1024);

        const objects = space.getAllObjects();
        assertExists(objects);
    },
});

Deno.test({
    name: "MemorySpace - clear removes all pages and creates new one",
    fn() {
        const space = new MemorySpace(SpaceType.NEW_SPACE, 1024 * 1024);

        space.tryAllocate(1024);
        space.clear();

        assertEquals(space.getTotalSize(), 0);
        assertEquals(space.getPageCount(), 1);
    },
});

Deno.test({
    name: "MemorySpace - compact removes empty pages",
    fn() {
        const space = new MemorySpace(SpaceType.NEW_SPACE, 1024 * 1024);

        // Allocate multiple pages
        space.tryAllocate(256 * 1024);
        space.tryAllocate(256 * 1024);

        space.compact();

        // Should keep at least one page
        assert(space.getPageCount() >= 1);
    },
});

// ============================================================================
// V8Heap Constructor Tests
// ============================================================================

Deno.test({
    name: "V8Heap - constructor creates heap with default sizes",
    fn() {
        const heap = new V8Heap();

        assertExists(heap);
        assertEquals(heap.getObjectCount(), 0);
    },
});

Deno.test({
    name: "V8Heap - constructor creates heap with custom sizes",
    fn() {
        const heap = new V8Heap(8 * 1024 * 1024, 64 * 1024 * 1024);

        assertExists(heap);
    },
});

Deno.test({
    name: "V8Heap - constructor initializes GC stats",
    fn() {
        const heap = new V8Heap();

        const stats = heap.getGCStats();
        assertEquals(stats.totalCollections, 0);
        assertEquals(stats.scavengeCount, 0);
        assertEquals(stats.markSweepCount, 0);
    },
});

// ============================================================================
// V8Heap Allocation Tests
// ============================================================================

Deno.test({
    name: "V8Heap - allocate allocates object",
    fn() {
        const heap = new V8Heap();

        const id = heap.allocate(createNumber(42));

        assertExists(id);
        assertEquals(heap.hasObject(id), true);
        assertEquals(heap.getObjectCount(), 1);
    },
});

Deno.test({
    name: "V8Heap - allocate small object goes to young generation",
    fn() {
        const heap = new V8Heap();

        const id = heap.allocate(createString("hello"));

        const obj = heap.getObject(id);
        assertExists(obj);
        assertEquals(obj.generation, 0);
    },
});

Deno.test({
    name: "V8Heap - allocate returns unique IDs",
    fn() {
        const heap = new V8Heap();

        const id1 = heap.allocate(createNumber(1));
        const id2 = heap.allocate(createNumber(2));

        assert(id1 !== id2);
    },
});

Deno.test({
    name: "V8Heap - getObject retrieves allocated object",
    fn() {
        const heap = new V8Heap();

        const value = createNumber(42);
        const id = heap.allocate(value);

        const obj = heap.getObject(id);

        assertExists(obj);
        assertEquals(obj.value.type, "number");
    },
});

Deno.test({
    name: "V8Heap - getObject returns null for non-existent ID",
    fn() {
        const heap = new V8Heap();

        const obj = heap.getObject("non-existent" as HeapObjectID);

        assertEquals(obj, null);
    },
});

Deno.test({
    name: "V8Heap - hasObject returns true for allocated objects",
    fn() {
        const heap = new V8Heap();

        const id = heap.allocate(createNumber(42));

        assertEquals(heap.hasObject(id), true);
    },
});

Deno.test({
    name: "V8Heap - hasObject returns false for non-existent objects",
    fn() {
        const heap = new V8Heap();

        assertEquals(heap.hasObject("non-existent" as HeapObjectID), false);
    },
});

// ============================================================================
// V8Heap Root Management Tests
// ============================================================================

Deno.test({
    name: "V8Heap - addRoot adds root object",
    fn() {
        const heap = new V8Heap();

        const id = heap.allocate(createNumber(42));
        heap.addRoot(id);

        // Should not throw
        assert(true);
    },
});

Deno.test({
    name: "V8Heap - removeRoot removes root object",
    fn() {
        const heap = new V8Heap();

        const id = heap.allocate(createNumber(42));
        heap.addRoot(id);
        heap.removeRoot(id);

        // Should not throw
        assert(true);
    },
});

// ============================================================================
// V8Heap Garbage Collection Tests
// ============================================================================

Deno.test({
    name: "V8Heap - gc runs garbage collection",
    fn() {
        const heap = new V8Heap();

        heap.allocate(createNumber(1));
        heap.allocate(createNumber(2));

        heap.gc();

        // Should not throw
        assert(true);
    },
});

Deno.test({
    name: "V8Heap - forceGC runs scavenge",
    fn() {
        const heap = new V8Heap();

        heap.allocate(createNumber(42));
        heap.forceGC(GCType.SCAVENGE);

        const stats = heap.getGCStats();
        assertEquals(stats.scavengeCount, 1);
    },
});

Deno.test({
    name: "V8Heap - forceGC runs mark-sweep",
    fn() {
        const heap = new V8Heap();

        heap.allocate(createNumber(42));
        heap.forceGC(GCType.MARK_SWEEP);

        const stats = heap.getGCStats();
        assertEquals(stats.markSweepCount, 1);
    },
});

Deno.test({
    name: "V8Heap - forceGC runs mark-compact",
    fn() {
        const heap = new V8Heap();

        heap.allocate(createNumber(42));
        heap.forceGC(GCType.MARK_COMPACT);

        const stats = heap.getGCStats();
        assertEquals(stats.markSweepCount, 1);
    },
});

Deno.test({
    name: "V8Heap - GC updates statistics",
    fn() {
        const heap = new V8Heap();

        heap.allocate(createNumber(1));
        heap.forceGC(GCType.SCAVENGE);

        const stats = heap.getGCStats();
        assertEquals(stats.totalCollections, 1);
        assertEquals(stats.lastGCType, GCType.SCAVENGE);
        assertEquals(stats.lastGCTime >= 0, true);
    },
});

Deno.test({
    name: "V8Heap - GC preserves root objects",
    fn() {
        const heap = new V8Heap();

        const id = heap.allocate(createNumber(42));
        heap.addRoot(id);

        heap.forceGC(GCType.SCAVENGE);

        assertEquals(heap.hasObject(id), true);
    },
});

Deno.test({
    name: "V8Heap - scavenge promotes objects to old generation",
    fn() {
        const heap = new V8Heap();

        const id = heap.allocate(createNumber(42));
        heap.addRoot(id);

        heap.forceGC(GCType.SCAVENGE);

        const obj = heap.getObject(id);
        assertExists(obj);
        assertEquals(obj.generation, 1);
    },
});

// ============================================================================
// V8Heap Statistics Tests
// ============================================================================

Deno.test({
    name: "V8Heap - getStats returns heap statistics",
    fn() {
        const heap = new V8Heap();

        const stats = heap.getStats();

        assertExists(stats);
        assertEquals(typeof stats.totalSize, "number");
        assertEquals(typeof stats.totalAllocated, "number");
        assertEquals(typeof stats.objectCount, "number");
        assertExists(stats.gcStats);
    },
});

Deno.test({
    name: "V8Heap - getStats tracks object count",
    fn() {
        const heap = new V8Heap();

        heap.allocate(createNumber(1));
        heap.allocate(createNumber(2));
        heap.allocate(createNumber(3));

        const stats = heap.getStats();
        assertEquals(stats.objectCount, 3);
    },
});

Deno.test({
    name: "V8Heap - getStats tracks generation sizes",
    fn() {
        const heap = new V8Heap();

        heap.allocate(createNumber(1));

        const stats = heap.getStats();
        assertEquals(typeof stats.youngGenerationSize, "number");
        assertEquals(typeof stats.oldGenerationSize, "number");
    },
});

Deno.test({
    name: "V8Heap - getGCStats returns GC statistics",
    fn() {
        const heap = new V8Heap();

        const stats = heap.getGCStats();

        assertEquals(typeof stats.totalCollections, "number");
        assertEquals(typeof stats.scavengeCount, "number");
        assertEquals(typeof stats.markSweepCount, "number");
        assertEquals(typeof stats.totalGCTime, "number");
    },
});

Deno.test({
    name: "V8Heap - getObjectCount returns correct count",
    fn() {
        const heap = new V8Heap();

        heap.allocate(createNumber(1));
        heap.allocate(createNumber(2));

        assertEquals(heap.getObjectCount(), 2);
    },
});

Deno.test({
    name: "V8Heap - getTotalAllocated returns total memory",
    fn() {
        const heap = new V8Heap();

        heap.allocate(createNumber(1));

        const total = heap.getTotalAllocated();
        assertEquals(typeof total, "number");
        assertEquals(total >= 0, true);
    },
});

// ============================================================================
// V8Heap Clear and Dispose Tests
// ============================================================================

Deno.test({
    name: "V8Heap - clear removes all objects",
    fn() {
        const heap = new V8Heap();

        heap.allocate(createNumber(1));
        heap.allocate(createNumber(2));

        heap.clear();

        assertEquals(heap.getObjectCount(), 0);
    },
});

Deno.test({
    name: "V8Heap - clear resets statistics",
    fn() {
        const heap = new V8Heap();

        heap.allocate(createNumber(1));
        heap.clear();

        const stats = heap.getStats();
        assertEquals(stats.totalSize, 0);
        assertEquals(stats.objectCount, 0);
    },
});

Deno.test({
    name: "V8Heap - dispose cleans up resources",
    fn() {
        const heap = new V8Heap();

        heap.allocate(createNumber(1));
        heap.dispose();

        assertEquals(heap.getObjectCount(), 0);
    },
});

// ============================================================================
// HeapFactory Tests
// ============================================================================

Deno.test({
    name: "HeapFactory - createDefault creates default heap",
    fn() {
        const heap = HeapFactory.createDefault();

        assertExists(heap);
        assertEquals(heap.getObjectCount(), 0);
    },
});

Deno.test({
    name: "HeapFactory - createLarge creates large heap",
    fn() {
        const heap = HeapFactory.createLarge();

        assertExists(heap);
    },
});

Deno.test({
    name: "HeapFactory - createSmall creates small heap",
    fn() {
        const heap = HeapFactory.createSmall();

        assertExists(heap);
    },
});

Deno.test({
    name: "HeapFactory - createForTesting creates test heap",
    fn() {
        const heap = HeapFactory.createForTesting();

        assertExists(heap);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "V8Heap - allocate multiple types",
    fn() {
        const heap = new V8Heap();

        const id1 = heap.allocate(createNumber(42));
        const id2 = heap.allocate(createString("hello"));
        const id3 = heap.allocate(createBoolean(true));
        const id4 = heap.allocate(createObject());

        assertEquals(heap.getObjectCount(), 4);
        assertEquals(heap.hasObject(id1), true);
        assertEquals(heap.hasObject(id2), true);
        assertEquals(heap.hasObject(id3), true);
        assertEquals(heap.hasObject(id4), true);
    },
});

Deno.test({
    name: "V8Heap - multiple GC cycles",
    fn() {
        const heap = new V8Heap();

        heap.allocate(createNumber(1));
        heap.allocate(createNumber(2));

        heap.forceGC(GCType.SCAVENGE);
        heap.forceGC(GCType.MARK_SWEEP);
        heap.forceGC(GCType.SCAVENGE);

        const stats = heap.getGCStats();
        assertEquals(stats.totalCollections, 3);
        assertEquals(stats.scavengeCount, 2);
        assertEquals(stats.markSweepCount, 1);
    },
});

Deno.test({
    name: "V8Heap - allocate after GC",
    fn() {
        const heap = new V8Heap();

        heap.allocate(createNumber(1));
        heap.forceGC(GCType.SCAVENGE);

        const id = heap.allocate(createNumber(2));

        assertEquals(heap.hasObject(id), true);
    },
});

Deno.test({
    name: "V8Heap - root objects survive multiple GCs",
    fn() {
        const heap = new V8Heap();

        const id = heap.allocate(createNumber(42));
        heap.addRoot(id);

        heap.forceGC(GCType.SCAVENGE);
        heap.forceGC(GCType.MARK_SWEEP);
        heap.forceGC(GCType.SCAVENGE);

        assertEquals(heap.hasObject(id), true);
    },
});

Deno.test({
    name: "V8Heap - object colors during marking",
    fn() {
        const heap = new V8Heap();

        const id = heap.allocate(createNumber(42));
        heap.addRoot(id);

        heap.forceGC(GCType.SCAVENGE);

        const obj = heap.getObject(id);
        assertExists(obj);
        // Color should be reset to WHITE after GC
        assertEquals(obj.color, ObjectColor.WHITE);
    },
});

Deno.test({
    name: "MemorySpace - handles different space types",
    fn() {
        const newSpace = new MemorySpace(SpaceType.NEW_SPACE, 1024 * 1024);
        const oldSpace = new MemorySpace(SpaceType.OLD_SPACE, 1024 * 1024);
        const codeSpace = new MemorySpace(SpaceType.CODE_SPACE, 1024 * 1024);
        const largeSpace = new MemorySpace(SpaceType.LARGE_OBJECT_SPACE, 1024 * 1024);

        assertEquals(newSpace.type, SpaceType.NEW_SPACE);
        assertEquals(oldSpace.type, SpaceType.OLD_SPACE);
        assertEquals(codeSpace.type, SpaceType.CODE_SPACE);
        assertEquals(largeSpace.type, SpaceType.LARGE_OBJECT_SPACE);
    },
});

Deno.test({
    name: "V8Heap - stress test with many allocations",
    fn() {
        const heap = HeapFactory.createForTesting();

        // Allocate many objects
        for (let i = 0; i < 100; i++) {
            heap.allocate(createNumber(i));
        }

        assertEquals(heap.getObjectCount(), 100);

        // Run GC
        heap.gc();

        // Should still have statistics
        const stats = heap.getGCStats();
        assertExists(stats);
    },
});
