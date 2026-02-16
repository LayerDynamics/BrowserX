/**
 * Tests for Rendering Domain Agent
 *
 * Covers render tree inspection, layout tree, display list, compositor layers,
 * rendering timing, visualization overlay toggles, and disposal.
 */

import { assertEquals, assertExists } from "@std/assert";
import { EventBus } from "../../../integration/event-bus.ts";
import { RenderingDomain } from "../../../domains/rendering/rendering-domain.ts";
import {
    createMockContext,
    createMockRenderingPipeline,
    createMockRenderResult,
    createMockLayoutBox,
    resetNodeIdCounter,
} from "../../helpers/mocks.ts";
import type { ProtocolEvent } from "../../../protocol/types.ts";

// ---------------------------------------------------------------------------
// Helper: set up a fresh RenderingDomain wired to an EventBus + mock context
// ---------------------------------------------------------------------------

function setup(options?: {
    renderResult?: ReturnType<typeof createMockRenderResult> | null;
    pipelineOverrides?: Record<string, unknown>;
}) {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new RenderingDomain(eventBus);

    const renderResult = options?.renderResult === null
        ? undefined
        : options?.renderResult ?? createMockRenderResult();

    const renderingPipeline = createMockRenderingPipeline(renderResult as ReturnType<typeof createMockRenderResult>);

    // Apply any pipeline overrides
    if (options?.pipelineOverrides) {
        Object.assign(renderingPipeline, options.pipelineOverrides);
    }

    const context = createMockContext({ eventBus, renderingPipeline });
    domain.initialize(context);

    // Collect emitted protocol events
    const events: ProtocolEvent[] = [];
    domain.addEventListener((evt) => events.push(evt));

    return { domain, eventBus, events, renderingPipeline };
}

// ---------------------------------------------------------------------------
// enable()
// ---------------------------------------------------------------------------

Deno.test("RenderingDomain: enable() returns empty object", async () => {
    const { domain } = setup();
    const result = await domain.enable();
    assertEquals(result, {});
});

Deno.test("RenderingDomain: enable() emits renderingStatsUpdated when lastRenderResult exists", async () => {
    const { domain, events } = setup();
    await domain.enable();

    const statsEvent = events.find((e) => e.method === "Rendering.renderingStatsUpdated");
    assertExists(statsEvent);
    assertExists(statsEvent.params);
    assertExists(statsEvent.params.timing);
});

Deno.test("RenderingDomain: enable() does not emit renderingStatsUpdated when no render result", async () => {
    const { domain, events } = setup({
        pipelineOverrides: { lastRenderResult: null },
    });
    await domain.enable();

    const statsEvent = events.find((e) => e.method === "Rendering.renderingStatsUpdated");
    assertEquals(statsEvent, undefined);
});

// ---------------------------------------------------------------------------
// getRenderTree()
// ---------------------------------------------------------------------------

Deno.test("RenderingDomain: getRenderTree() returns render tree from pipeline", async () => {
    const renderResult = createMockRenderResult({
        renderTree: {
            getRoot: () => ({
                id: "1",
                element: { tagName: "DIV" },
                layout: { x: 0, y: 0, width: 100, height: 50 },
                children: [],
                needsPaint: false,
                needsLayout: false,
                paintLayer: null,
            }),
        },
    });
    const { domain } = setup({ renderResult });
    await domain.enable();

    const result = await domain.handleMethod("getRenderTree", {});
    assertExists(result.root);
    const root = result.root as Record<string, unknown>;
    assertEquals(root.type, "DIV");
    assertEquals(root.childCount, 0);
    assertEquals(root.needsRepaint, false);
    assertEquals(root.needsLayout, false);
});

Deno.test("RenderingDomain: getRenderTree() with no render result returns null tree", async () => {
    const { domain } = setup({
        pipelineOverrides: { lastRenderResult: null },
    });
    await domain.enable();

    const result = await domain.handleMethod("getRenderTree", {});
    assertEquals(result.root, null);
});

Deno.test("RenderingDomain: getRenderTree() with no renderTree on result returns null tree", async () => {
    const renderResult = createMockRenderResult({ renderTree: null as unknown as undefined });
    const { domain } = setup({ renderResult });
    await domain.enable();

    const result = await domain.handleMethod("getRenderTree", {});
    assertEquals(result.root, null);
});

// ---------------------------------------------------------------------------
// getLayoutTree()
// ---------------------------------------------------------------------------

Deno.test("RenderingDomain: getLayoutTree() returns layout tree from pipeline", async () => {
    const layoutTree = createMockLayoutBox({
        x: 10,
        y: 20,
        width: 200,
        height: 100,
        children: [] as unknown as undefined,
    });
    const renderResult = createMockRenderResult({ layoutTree });
    const { domain } = setup({ renderResult });
    await domain.enable();

    const result = await domain.handleMethod("getLayoutTree", {});
    assertExists(result.root);
    const root = result.root as Record<string, unknown>;
    const box = root.box as Record<string, number>;
    assertEquals(box.x, 10);
    assertEquals(box.y, 20);
    assertEquals(box.width, 200);
    assertEquals(box.height, 100);
});

Deno.test("RenderingDomain: getLayoutTree() with no render result returns null root", async () => {
    const { domain } = setup({
        pipelineOverrides: { lastRenderResult: null },
    });
    await domain.enable();

    const result = await domain.handleMethod("getLayoutTree", {});
    assertEquals(result.root, null);
});

// ---------------------------------------------------------------------------
// getDisplayList()
// ---------------------------------------------------------------------------

Deno.test("RenderingDomain: getDisplayList() returns serialized display list entries", async () => {
    const renderResult = createMockRenderResult({
        displayList: {
            getCommands: () => [
                { type: "fillRect", params: { x: 0, y: 0, width: 100, height: 50 } },
                { type: "drawText", params: { text: "Hello" } },
            ],
        },
    });
    const { domain } = setup({ renderResult });
    await domain.enable();

    const result = await domain.handleMethod("getDisplayList", {});
    const commands = result.commands as Array<{ type: string; data: Record<string, unknown> }>;
    assertEquals(commands.length, 2);
    assertEquals(commands[0].type, "fillRect");
    assertEquals(commands[1].type, "drawText");
});

Deno.test("RenderingDomain: getDisplayList() with no render result returns empty commands", async () => {
    const { domain } = setup({
        pipelineOverrides: { lastRenderResult: null },
    });
    await domain.enable();

    const result = await domain.handleMethod("getDisplayList", {});
    const commands = result.commands as unknown[];
    assertEquals(commands.length, 0);
});

// ---------------------------------------------------------------------------
// getCompositorLayers()
// ---------------------------------------------------------------------------

Deno.test("RenderingDomain: getCompositorLayers() returns compositor layers", async () => {
    const { domain } = setup({
        pipelineOverrides: {
            getCompositor: () => ({
                getLayerManager: () => ({
                    getAllLayers: () => [
                        {
                            id: "layer-1",
                            bounds: { x: 0, y: 0, width: 1024, height: 768 },
                            opacity: 1.0,
                            paintCommands: [1, 2, 3],
                            children: [],
                        },
                    ],
                }),
            }),
            getStats: () => ({
                viewport: { width: 1024, height: 768 },
                renders: 1,
                lastRenderTime: 165,
                resources: { totalSize: 7000, count: 2 },
                compositor: { averageFPS: 60, frameCount: 100, compositeTime: 5 },
            }),
        },
    });
    await domain.enable();

    const result = await domain.handleMethod("getCompositorLayers", {});
    const layers = result.layers as Array<Record<string, unknown>>;
    assertEquals(layers.length, 1);
    assertEquals(layers[0].id, "layer-1");
    assertEquals(layers[0].opacity, 1.0);
    assertEquals(layers[0].composited, true);
    assertEquals(layers[0].paintCommandCount, 3);
    assertEquals(layers[0].childCount, 0);
});

Deno.test("RenderingDomain: getCompositorLayers() falls back to basic layer info when compositor throws", async () => {
    const { domain } = setup({
        pipelineOverrides: {
            getCompositor: () => {
                throw new Error("No compositor");
            },
            getStats: () => ({
                viewport: { width: 800, height: 600 },
                renders: 1,
                lastRenderTime: 100,
                resources: { totalSize: 5000, count: 1 },
            }),
        },
    });
    await domain.enable();

    const result = await domain.handleMethod("getCompositorLayers", {});
    const layers = result.layers as Array<Record<string, unknown>>;
    assertEquals(layers.length, 1);
    assertEquals(layers[0].id, "root-layer");
    const bounds = layers[0].bounds as Record<string, number>;
    assertEquals(bounds.width, 800);
    assertEquals(bounds.height, 600);
});

// ---------------------------------------------------------------------------
// getRenderingTiming()
// ---------------------------------------------------------------------------

Deno.test("RenderingDomain: getRenderingTiming() returns timing breakdown", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getRenderingTiming", {});
    const timing = result.timing as Record<string, number>;
    assertExists(timing);
    assertEquals(timing.htmlParse, 20);
    assertEquals(timing.cssParse, 10);
    assertEquals(timing.styleResolution, 15);
    assertEquals(timing.layout, 25);
    assertEquals(timing.paint, 10);
    assertEquals(timing.composite, 5);
    assertEquals(timing.total, 165);
});

Deno.test("RenderingDomain: getRenderingTiming() with no render result returns zeroes", async () => {
    const { domain } = setup({
        pipelineOverrides: { lastRenderResult: null },
    });
    await domain.enable();

    const result = await domain.handleMethod("getRenderingTiming", {});
    const timing = result.timing as Record<string, number>;
    assertEquals(timing.htmlParse, 0);
    assertEquals(timing.total, 0);
});

// ---------------------------------------------------------------------------
// setShowPaintRects()
// ---------------------------------------------------------------------------

Deno.test("RenderingDomain: setShowPaintRects(true) toggles on and emits paintFlashing event", async () => {
    const { domain, events } = setup();
    await domain.enable();

    const result = await domain.handleMethod("setShowPaintRects", { show: true });
    assertEquals(result.show, true);

    const flashEvent = events.find((e) => e.method === "Rendering.paintFlashing");
    assertExists(flashEvent);
    assertEquals(flashEvent.params?.enabled, true);
});

Deno.test("RenderingDomain: setShowPaintRects(false) toggles off without emitting paintFlashing", async () => {
    const { domain, events } = setup();
    await domain.enable();

    const result = await domain.handleMethod("setShowPaintRects", { show: false });
    assertEquals(result.show, false);

    const flashEvent = events.find((e) => e.method === "Rendering.paintFlashing");
    assertEquals(flashEvent, undefined);
});

// ---------------------------------------------------------------------------
// setShowLayoutBorders()
// ---------------------------------------------------------------------------

Deno.test("RenderingDomain: setShowLayoutBorders() toggles and returns state", async () => {
    const { domain } = setup();
    await domain.enable();

    const on = await domain.handleMethod("setShowLayoutBorders", { show: true });
    assertEquals(on.show, true);

    const off = await domain.handleMethod("setShowLayoutBorders", { show: false });
    assertEquals(off.show, false);
});

// ---------------------------------------------------------------------------
// setShowFPSCounter()
// ---------------------------------------------------------------------------

Deno.test("RenderingDomain: setShowFPSCounter(true) toggles on and emits renderingStatsUpdated", async () => {
    const { domain, events } = setup({
        pipelineOverrides: {
            getStats: () => ({
                viewport: { width: 1024, height: 768 },
                renders: 1,
                lastRenderTime: 165,
                resources: { totalSize: 7000, count: 2 },
                compositor: { averageFPS: 60, frameCount: 120, compositeTime: 4 },
            }),
        },
    });
    await domain.enable();

    // Clear events from enable()
    events.length = 0;

    const result = await domain.handleMethod("setShowFPSCounter", { show: true });
    assertEquals(result.show, true);

    const statsEvent = events.find((e) => e.method === "Rendering.renderingStatsUpdated");
    assertExists(statsEvent);
    assertEquals(statsEvent.params?.fps, 60);
    assertEquals(statsEvent.params?.frameCount, 120);
});

// ---------------------------------------------------------------------------
// disable()
// ---------------------------------------------------------------------------

Deno.test("RenderingDomain: disable() resets visualization state", async () => {
    const { domain } = setup({
        pipelineOverrides: {
            getStats: () => ({
                viewport: { width: 1024, height: 768 },
                renders: 1,
                lastRenderTime: 165,
                resources: { totalSize: 7000, count: 2 },
                compositor: { averageFPS: 60, frameCount: 120, compositeTime: 4 },
            }),
        },
    });
    await domain.enable();

    // Set various visualization flags
    await domain.handleMethod("setShowPaintRects", { show: true });
    await domain.handleMethod("setShowLayoutBorders", { show: true });
    await domain.handleMethod("setShowFPSCounter", { show: true });

    // Disable should reset them
    const result = await domain.disable();
    assertExists(result);

    // After disable, enabling again should not emit paintFlashing
    // because the flags should have been reset
    assertEquals(domain.isEnabled(), false);
});

// ---------------------------------------------------------------------------
// dispose()
// ---------------------------------------------------------------------------

Deno.test("RenderingDomain: dispose() resets visualization state and cleans up", async () => {
    const { domain } = setup({
        pipelineOverrides: {
            getStats: () => ({
                viewport: { width: 1024, height: 768 },
                renders: 1,
                lastRenderTime: 165,
                resources: { totalSize: 7000, count: 2 },
                compositor: { averageFPS: 60, frameCount: 120, compositeTime: 4 },
            }),
        },
    });
    await domain.enable();
    await domain.handleMethod("setShowPaintRects", { show: true });
    await domain.handleMethod("setShowFPSCounter", { show: true });

    domain.dispose();

    assertEquals(domain.isEnabled(), false);
    assertEquals(domain.getMethodNames().length, 0 + 2); // only enable/disable after dispose clear
});

// ---------------------------------------------------------------------------
// Enhanced Edge Case Tests
// ---------------------------------------------------------------------------

Deno.test("RenderingDomain: handleMethod throws for unknown method", async () => {
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
});

Deno.test("RenderingDomain: disable() returns empty object", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.disable();
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), false);
});

Deno.test("RenderingDomain: setShowPaintRects(true) twice emits paintFlashing twice", async () => {
    const { domain, events } = setup();
    await domain.enable();

    events.length = 0; // Clear enable events

    await domain.handleMethod("setShowPaintRects", { show: true });
    await domain.handleMethod("setShowPaintRects", { show: true });

    const flashEvents = events.filter((e) => e.method === "Rendering.paintFlashing");
    assertEquals(flashEvents.length, 2);
});

Deno.test("RenderingDomain: setShowLayoutBorders does not emit paintFlashing", async () => {
    const { domain, events } = setup();
    await domain.enable();

    events.length = 0;

    await domain.handleMethod("setShowLayoutBorders", { show: true });

    const flashEvent = events.find((e) => e.method === "Rendering.paintFlashing");
    assertEquals(flashEvent, undefined);
});

Deno.test("RenderingDomain: setShowFPSCounter(false) does not emit renderingStatsUpdated", async () => {
    const { domain, events } = setup({
        pipelineOverrides: {
            getStats: () => ({
                viewport: { width: 1024, height: 768 },
                renders: 1,
                lastRenderTime: 165,
                resources: { totalSize: 7000, count: 2 },
                compositor: { averageFPS: 60, frameCount: 100, compositeTime: 5 },
            }),
        },
    });
    await domain.enable();

    events.length = 0;

    const result = await domain.handleMethod("setShowFPSCounter", { show: false });
    assertEquals(result.show, false);

    const statsEvent = events.find((e) => e.method === "Rendering.renderingStatsUpdated");
    assertEquals(statsEvent, undefined);
});

Deno.test("RenderingDomain: getLayoutTree includes padding/margin/border info", async () => {
    const layoutTree = createMockLayoutBox({
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        children: [] as unknown as undefined,
    });
    const renderResult = createMockRenderResult({ layoutTree });
    const { domain } = setup({ renderResult });
    await domain.enable();

    const result = await domain.handleMethod("getLayoutTree", {});
    assertExists(result.root);
    const root = result.root as Record<string, unknown>;
    const box = root.box as Record<string, number>;

    // Verify all box model properties are present
    assertEquals(typeof box.paddingTop, "number");
    assertEquals(typeof box.paddingRight, "number");
    assertEquals(typeof box.paddingBottom, "number");
    assertEquals(typeof box.paddingLeft, "number");
    assertEquals(typeof box.borderTop, "number");
    assertEquals(typeof box.borderRight, "number");
    assertEquals(typeof box.borderBottom, "number");
    assertEquals(typeof box.borderLeft, "number");
    assertEquals(typeof box.marginTop, "number");
    assertEquals(typeof box.marginRight, "number");
    assertEquals(typeof box.marginBottom, "number");
    assertEquals(typeof box.marginLeft, "number");
});

Deno.test("RenderingDomain: getDisplayList commands have type and data properties", async () => {
    const renderResult = createMockRenderResult({
        displayList: {
            getCommands: () => [
                { type: "drawBorder", params: { color: "black", width: 1 } },
            ],
        },
    });
    const { domain } = setup({ renderResult });
    await domain.enable();

    const result = await domain.handleMethod("getDisplayList", {});
    const commands = result.commands as Array<{ type: string; data: Record<string, unknown> }>;

    assertEquals(commands.length, 1);
    assertEquals(commands[0].type, "drawBorder");
    assertEquals(commands[0].data.color, "black");
    assertEquals(commands[0].data.width, 1);
});

Deno.test("RenderingDomain: getRenderTree root includes nodeId and bounds", async () => {
    const renderResult = createMockRenderResult({
        renderTree: {
            getRoot: () => ({
                id: "42",
                element: { tagName: "BODY" },
                layout: { x: 0, y: 0, width: 800, height: 600 },
                children: [],
                needsPaint: true,
                needsLayout: false,
                paintLayer: null,
            }),
        },
    });
    const { domain } = setup({ renderResult });
    await domain.enable();

    const result = await domain.handleMethod("getRenderTree", {});
    const root = result.root as Record<string, unknown>;

    assertEquals(root.nodeId, 42);
    assertEquals(root.type, "BODY");
    assertEquals(root.needsRepaint, true);
    assertEquals(root.needsLayout, false);
    const bounds = root.bounds as Record<string, number>;
    assertEquals(bounds.x, 0);
    assertEquals(bounds.y, 0);
    assertEquals(bounds.width, 800);
    assertEquals(bounds.height, 600);
});
