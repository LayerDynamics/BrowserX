/**
 * Tests for Memory Domain Agent
 *
 * Covers heap statistics, heap snapshots, allocation sampling (start/stop),
 * allocation profiling, forced garbage collection, DOM counters,
 * enable/disable lifecycle, and cleanup.
 */

import { assertEquals } from "@std/assert";
import { EventBus } from "../../../integration/event-bus.ts";
import { MemoryDomain } from "../../../domains/memory/memory-domain.ts";
import {
    createMockContext,
    createMockBrowser,
    createMockRenderingPipeline,
    createMockRenderResult,
} from "../../helpers/mocks.ts";

// ---------------------------------------------------------------------------
// Helper: create a fully wired MemoryDomain
// ---------------------------------------------------------------------------

function setup(options?: { noRenderResult?: boolean }) {
    const eventBus = new EventBus();
    const browser = createMockBrowser();

    const renderResult = options?.noRenderResult ? undefined : createMockRenderResult();

    // Build rendering pipeline with the expected shape including clearCache
    let clearCacheCalled = false;
    const renderingPipeline = {
        lastRenderResult: options?.noRenderResult ? null : renderResult,
        render: async () => renderResult,
        getPixels: async () => new Uint8ClampedArray(100 * 50 * 4),
        screenshot: async () => new Uint8ClampedArray(100 * 50 * 4),
        setViewportSize: () => {},
        getRequestPipeline: () => ({}),
        getCompositor: () => ({}),
        clearCache: () => { clearCacheCalled = true; },
        close: async () => {},
        getStats: () => ({
            viewport: { width: 1024, height: 768, devicePixelRatio: 2 },
            renders: 1,
            lastRenderTime: 165,
            resources: { total: 2, totalSize: 7000, cachedCount: 1, count: 2 },
        }),
    };

    const context = createMockContext({
        eventBus,
        browser,
        renderingPipeline: renderingPipeline as unknown as ReturnType<typeof createMockRenderingPipeline>,
    });

    const domain = new MemoryDomain(eventBus);
    domain.initialize(context);

    return { domain, eventBus, renderingPipeline, getClearCacheCalled: () => clearCacheCalled };
}

// ---------------------------------------------------------------------------
// enable / disable
// ---------------------------------------------------------------------------

Deno.test("MemoryDomain enable() returns empty object", async () => {
    const { domain } = setup();
    const result = await domain.enable();
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), true);
    await domain.disable();
});

Deno.test("MemoryDomain disable() returns empty and stops sampling if active", async () => {
    const { domain } = setup();
    await domain.enable();

    // Start sampling
    await domain.handleMethod("startSampling", {});

    // Disable should stop sampling
    const result = await domain.disable();
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), false);

    // After disable, should be able to start sampling again (not "already in progress")
    await domain.enable();
    const startResult = await domain.handleMethod("startSampling", {});
    assertEquals((startResult as { error?: string }).error, undefined);

    await domain.disable();
});

// ---------------------------------------------------------------------------
// getHeapStats
// ---------------------------------------------------------------------------

Deno.test("MemoryDomain getHeapStats returns heap statistics", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getHeapStats", {});
    const heapResult = result as {
        stats: {
            totalHeapSize: number;
            usedHeapSize: number;
            heapSizeLimit: number;
            totalPhysicalSize: number;
            totalAvailableSize: number;
            mallocedMemory: number;
            peakMallocedMemory: number;
            externalMemory: number;
        };
    };

    const stats = heapResult.stats;
    assertEquals(typeof stats.totalHeapSize, "number");
    assertEquals(typeof stats.usedHeapSize, "number");
    assertEquals(stats.totalHeapSize > 0, true);
    assertEquals(stats.usedHeapSize > 0, true);
    assertEquals(stats.heapSizeLimit > 0, true);
    assertEquals(stats.totalPhysicalSize > 0, true);
    assertEquals(stats.totalAvailableSize > 0, true);
    assertEquals(stats.externalMemory, 0);

    // Verify the estimates are based on totalResourceSize (7000)
    // usedHeapSize = totalResourceSize * 3 = 21000
    assertEquals(stats.usedHeapSize, 21000);
    // totalHeapSize = totalResourceSize * 5 = 35000
    assertEquals(stats.totalHeapSize, 35000);

    await domain.disable();
});

// ---------------------------------------------------------------------------
// takeHeapSnapshot
// ---------------------------------------------------------------------------

Deno.test("MemoryDomain takeHeapSnapshot emits chunk events and returns complete", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const chunks: unknown[] = [];
    eventBus.on("Memory.addHeapSnapshotChunk", (data) => chunks.push(data));

    const result = await domain.handleMethod("takeHeapSnapshot", {});
    const snapshotResult = result as { complete: boolean; totalChunks: number };

    assertEquals(snapshotResult.complete, true);
    assertEquals(snapshotResult.totalChunks > 0, true);
    assertEquals(chunks.length, snapshotResult.totalChunks);

    // Each chunk should have a chunk string property
    for (const chunk of chunks) {
        const chunkData = chunk as { chunk: string };
        assertEquals(typeof chunkData.chunk, "string");
        assertEquals(chunkData.chunk.length > 0, true);
    }

    // Reconstruct the full snapshot and verify it's valid JSON
    const fullSnapshot = chunks.map((c) => (c as { chunk: string }).chunk).join("");
    const parsed = JSON.parse(fullSnapshot);
    assertEquals(parsed.snapshot !== undefined, true);
    assertEquals(parsed.snapshot.title.includes("Heap Snapshot"), true);

    await domain.disable();
});

Deno.test("MemoryDomain takeHeapSnapshot with reportProgress parameter", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("takeHeapSnapshot", { reportProgress: true });
    const snapshotResult = result as { complete: boolean; totalChunks: number };

    assertEquals(snapshotResult.complete, true);
    assertEquals(snapshotResult.totalChunks > 0, true);

    await domain.disable();
});

Deno.test("MemoryDomain takeHeapSnapshot includes DOM info when render result available", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const chunks: unknown[] = [];
    eventBus.on("Memory.addHeapSnapshotChunk", (data) => chunks.push(data));

    await domain.handleMethod("takeHeapSnapshot", {});

    const fullSnapshot = chunks.map((c) => (c as { chunk: string }).chunk).join("");
    const parsed = JSON.parse(fullSnapshot);

    assertEquals(parsed.domInfo !== undefined, true);
    assertEquals(parsed.domInfo.nodeCount > 0, true);
    assertEquals(typeof parsed.domInfo.cssRuleCount, "number");
    assertEquals(parsed.heapStats !== undefined, true);

    await domain.disable();
});

// ---------------------------------------------------------------------------
// startSampling / stopSampling
// ---------------------------------------------------------------------------

Deno.test("MemoryDomain startSampling starts sampling and returns empty", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("startSampling", {});
    assertEquals((result as { error?: string }).error, undefined);

    // Clean up
    await domain.handleMethod("stopSampling", {});
    await domain.disable();
});

Deno.test("MemoryDomain startSampling when already sampling returns error", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("startSampling", {});
    const secondStart = await domain.handleMethod("startSampling", {});

    assertEquals((secondStart as { error: string }).error, "Sampling already in progress");

    await domain.handleMethod("stopSampling", {});
    await domain.disable();
});

Deno.test("MemoryDomain startSampling accepts custom samplingInterval", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("startSampling", { samplingInterval: 65536 });
    assertEquals((result as { error?: string }).error, undefined);

    await domain.handleMethod("stopSampling", {});
    await domain.disable();
});

Deno.test("MemoryDomain stopSampling returns profile with head node", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("startSampling", {});

    // Wait a small amount for at least one sample to be collected
    await new Promise((resolve) => setTimeout(resolve, 150));

    const result = await domain.handleMethod("stopSampling", {});
    const profileResult = result as {
        profile: {
            head: {
                callFrame: { functionName: string };
                selfSize: number;
                id: number;
                children: unknown[];
            };
        };
    };

    assertEquals(profileResult.profile !== undefined, true);
    assertEquals(profileResult.profile.head.callFrame.functionName, "(root)");
    assertEquals(profileResult.profile.head.id, 1);
    assertEquals(Array.isArray(profileResult.profile.head.children), true);
    assertEquals(profileResult.profile.head.children.length >= 1, true);

    await domain.disable();
});

Deno.test("MemoryDomain stopSampling when not sampling returns empty object", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("stopSampling", {});
    // When not sampling, returns empty {}
    assertEquals(Object.keys(result).length === 0 || (result as { profile?: unknown }).profile === undefined, true);

    await domain.disable();
});

// ---------------------------------------------------------------------------
// getAllocationProfile
// ---------------------------------------------------------------------------

Deno.test("MemoryDomain getAllocationProfile returns sampling profile", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getAllocationProfile", {});
    const profileResult = result as {
        profile: {
            head: {
                callFrame: { functionName: string };
                children: unknown[];
            };
        };
    };

    assertEquals(profileResult.profile.head.callFrame.functionName, "(root)");
    assertEquals(Array.isArray(profileResult.profile.head.children), true);
    // With no sampling data, should have an (idle) placeholder child
    assertEquals(profileResult.profile.head.children.length >= 1, true);

    await domain.disable();
});

Deno.test("MemoryDomain getAllocationProfile after sampling has collected data", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("startSampling", {});
    await new Promise((resolve) => setTimeout(resolve, 150));
    await domain.handleMethod("stopSampling", {});

    const result = await domain.handleMethod("getAllocationProfile", {});
    const profileResult = result as {
        profile: {
            head: {
                children: Array<{ callFrame: { functionName: string }; selfSize: number }>;
            };
        };
    };

    // After collecting samples, should have (heap) data grouped
    assertEquals(profileResult.profile.head.children.length >= 1, true);

    await domain.disable();
});

// ---------------------------------------------------------------------------
// forceGarbageCollection
// ---------------------------------------------------------------------------

Deno.test("MemoryDomain forceGarbageCollection calls clearCache on renderingPipeline", async () => {
    const { domain, getClearCacheCalled } = setup();
    await domain.enable();

    await domain.handleMethod("forceGarbageCollection", {});

    assertEquals(getClearCacheCalled(), true);

    await domain.disable();
});

Deno.test("MemoryDomain forceGarbageCollection returns empty result", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("forceGarbageCollection", {});
    assertEquals(typeof result, "object");

    await domain.disable();
});

// ---------------------------------------------------------------------------
// getDOMCounters
// ---------------------------------------------------------------------------

Deno.test("MemoryDomain getDOMCounters returns node/document/listener counts", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getDOMCounters", {});
    const counters = result as {
        documents: number;
        nodes: number;
        jsEventListeners: number;
    };

    assertEquals(counters.nodes > 0, true);
    assertEquals(counters.documents >= 1, true); // At least 1 document
    assertEquals(typeof counters.jsEventListeners, "number");

    await domain.disable();
});

Deno.test("MemoryDomain getDOMCounters with no render result returns zeros", async () => {
    const { domain } = setup({ noRenderResult: true });
    await domain.enable();

    const result = await domain.handleMethod("getDOMCounters", {});
    const counters = result as {
        documents: number;
        nodes: number;
        jsEventListeners: number;
    };

    assertEquals(counters.documents, 0);
    assertEquals(counters.nodes, 0);
    assertEquals(counters.jsEventListeners, 0);

    await domain.disable();
});

Deno.test("MemoryDomain getDOMCounters counts mock DOM tree nodes correctly", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getDOMCounters", {});
    const counters = result as { nodes: number; documents: number };

    // Mock DOM structure: document -> html -> head -> title -> text, body -> div -> h1 -> text, p -> text
    // That's: document(1) + html(1) + head(1) + title(1) + text(1) + body(1) + div(1) + h1(1) + text(1) + p(1) + text(1) = 11
    assertEquals(counters.nodes, 11);
    // Only 1 document node (nodeType === 9)
    assertEquals(counters.documents, 1);

    await domain.disable();
});

// ---------------------------------------------------------------------------
// Sampling timer emits heapStatsUpdate
// ---------------------------------------------------------------------------

Deno.test("MemoryDomain sampling emits heapStatsUpdate events", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const events: unknown[] = [];
    eventBus.on("Memory.heapStatsUpdate", (data) => events.push(data));

    await domain.handleMethod("startSampling", {});

    // Wait for at least one sampling interval (100ms) plus some buffer
    await new Promise((resolve) => setTimeout(resolve, 250));

    await domain.handleMethod("stopSampling", {});

    // Should have received at least one heapStatsUpdate event
    assertEquals(events.length >= 1, true);
    const eventData = events[0] as {
        statsUpdate: number[];
        timestamp: number;
    };
    assertEquals(Array.isArray(eventData.statsUpdate), true);
    assertEquals(eventData.statsUpdate.length, 3);
    assertEquals(typeof eventData.timestamp, "number");

    await domain.disable();
});

// ---------------------------------------------------------------------------
// dispose
// ---------------------------------------------------------------------------

Deno.test("MemoryDomain dispose cleans up timer and data", async () => {
    const { domain } = setup();
    await domain.enable();

    // Start sampling so there's state to clean up
    await domain.handleMethod("startSampling", {});

    domain.dispose();

    assertEquals(domain.isEnabled(), false);
});

Deno.test("MemoryDomain dispose without prior enable does not throw", () => {
    const { domain } = setup();
    // Dispose without enabling - should not throw
    domain.dispose();
    assertEquals(domain.isEnabled(), false);
});

// ---------------------------------------------------------------------------
// Enhanced Edge Case Tests
// ---------------------------------------------------------------------------

Deno.test("MemoryDomain handleMethod throws for unknown method", async () => {
    const { domain } = setup();
    await domain.enable();

    let threw = false;
    try {
        await domain.handleMethod("nonExistentMethod", {});
    } catch (e) {
        threw = true;
        assertEquals((e as Error).message.includes("not found"), true);
    }
    assertEquals(threw, true);

    await domain.disable();
});

Deno.test("MemoryDomain getHeapStats without render result still returns estimates", async () => {
    const { domain } = setup({ noRenderResult: true });
    await domain.enable();

    const result = await domain.handleMethod("getHeapStats", {});
    const heapResult = result as {
        stats: {
            totalHeapSize: number;
            usedHeapSize: number;
            heapSizeLimit: number;
        };
    };

    // Even without render result, getStats() returns resource sizes for estimation
    assertEquals(typeof heapResult.stats.totalHeapSize, "number");
    assertEquals(typeof heapResult.stats.usedHeapSize, "number");
    assertEquals(heapResult.stats.heapSizeLimit > 0, true);

    await domain.disable();
});

Deno.test("MemoryDomain takeHeapSnapshot without render result still completes", async () => {
    const { domain, eventBus } = setup({ noRenderResult: true });
    await domain.enable();

    const chunks: unknown[] = [];
    eventBus.on("Memory.addHeapSnapshotChunk", (data) => chunks.push(data));

    const result = await domain.handleMethod("takeHeapSnapshot", {});
    const snapshotResult = result as { complete: boolean; totalChunks: number };

    assertEquals(snapshotResult.complete, true);
    assertEquals(snapshotResult.totalChunks > 0, true);

    // Reconstruct and verify snapshot structure
    const fullSnapshot = chunks.map((c) => (c as { chunk: string }).chunk).join("");
    const parsed = JSON.parse(fullSnapshot);
    assertEquals(parsed.snapshot !== undefined, true);

    // Without render result, domInfo should not be present
    assertEquals(parsed.domInfo, undefined);

    // But heapStats should still be present
    assertEquals(parsed.heapStats !== undefined, true);

    await domain.disable();
});

Deno.test("MemoryDomain getAllocationProfile head always has id=1", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getAllocationProfile", {});
    const profileResult = result as {
        profile: {
            head: { id: number; callFrame: { functionName: string } };
        };
    };

    assertEquals(profileResult.profile.head.id, 1);
    assertEquals(profileResult.profile.head.callFrame.functionName, "(root)");

    await domain.disable();
});

Deno.test("MemoryDomain forceGarbageCollection calls clearCache", async () => {
    const { domain, getClearCacheCalled } = setup();
    await domain.enable();

    assertEquals(getClearCacheCalled(), false);
    await domain.handleMethod("forceGarbageCollection", {});
    assertEquals(getClearCacheCalled(), true);

    await domain.disable();
});

Deno.test("MemoryDomain getDOMCounters documents is at least 1 when render result exists", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getDOMCounters", {});
    const counters = result as { documents: number; nodes: number };

    // The code uses Math.max(1, documentCount), ensuring at least 1
    assertEquals(counters.documents >= 1, true);
    assertEquals(counters.nodes > 0, true);

    await domain.disable();
});
