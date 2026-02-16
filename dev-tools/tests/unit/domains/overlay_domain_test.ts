/**
 * Tests for Overlay Domain Agent
 *
 * Covers node highlighting, rectangle/quad highlights, inspect mode,
 * frame highlighting, grid/flex overlay toggles, and cleanup.
 */

import { assertEquals, assertExists } from "@std/assert";
import { EventBus } from "../../../integration/event-bus.ts";
import { OverlayDomain } from "../../../domains/overlay/overlay-domain.ts";
import {
    createMockContext,
    createMockRenderingPipeline,
    createMockRenderResult,
    createMockElement,
    createMockLayoutBox,
    resetNodeIdCounter,
} from "../../helpers/mocks.ts";
import type { ProtocolEvent } from "../../../protocol/types.ts";

// ---------------------------------------------------------------------------
// Helper: set up a fresh OverlayDomain wired to an EventBus + mock context
// ---------------------------------------------------------------------------

function setup() {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new OverlayDomain(eventBus);

    const renderResult = createMockRenderResult();
    const renderingPipeline = createMockRenderingPipeline(renderResult);
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

Deno.test("OverlayDomain: enable() returns empty object", async () => {
    const { domain } = setup();
    const result = await domain.enable();
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), true);
});

// ---------------------------------------------------------------------------
// highlightNode()
// ---------------------------------------------------------------------------

Deno.test("OverlayDomain: highlightNode() stores nodeId and config", async () => {
    const { domain, events } = setup();
    await domain.enable();
    events.length = 0;

    await domain.handleMethod("highlightNode", {
        nodeId: 42,
        highlightConfig: {
            showInfo: true,
            contentColor: { r: 255, g: 0, b: 0, a: 0.5 },
        },
    });

    const state = domain.getOverlayState();
    assertEquals(state.highlightedNodeId, 42);
    assertExists(state.highlightConfig);
    const config = state.highlightConfig as Record<string, unknown>;
    assertEquals(config.showInfo, true);

    // Should have emitted nodeHighlightRequested
    const highlightEvent = events.find((e) => e.method === "Overlay.nodeHighlightRequested");
    assertExists(highlightEvent);
    assertEquals(highlightEvent.params?.nodeId, 42);
});

Deno.test("OverlayDomain: highlightNode() clears rect and quad highlights", async () => {
    const { domain } = setup();
    await domain.enable();

    // First add a rect highlight
    await domain.handleMethod("highlightRect", {
        x: 10, y: 20, width: 100, height: 50,
    });

    // Then highlight a node - should clear rects
    await domain.handleMethod("highlightNode", {
        nodeId: 1,
        highlightConfig: { showInfo: true },
    });

    const state = domain.getOverlayState();
    assertEquals(state.highlightedNodeId, 1);
    assertEquals((state.highlightedRects as unknown[]).length, 0);
    assertEquals((state.highlightedQuads as unknown[]).length, 0);
    assertEquals(state.highlightedFrameId, null);
});

// ---------------------------------------------------------------------------
// highlightRect()
// ---------------------------------------------------------------------------

Deno.test("OverlayDomain: highlightRect() stores rect highlight", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    let rectEmitted = false;
    eventBus.on("Overlay.rectHighlighted", () => { rectEmitted = true; });

    await domain.handleMethod("highlightRect", {
        x: 10,
        y: 20,
        width: 300,
        height: 200,
        color: { r: 0, g: 255, b: 0, a: 0.3 },
    });

    const state = domain.getOverlayState();
    assertEquals(state.highlightedNodeId, null);
    const rects = state.highlightedRects as Array<Record<string, unknown>>;
    assertEquals(rects.length, 1);
    assertEquals(rects[0].x, 10);
    assertEquals(rects[0].y, 20);
    assertEquals(rects[0].width, 300);
    assertEquals(rects[0].height, 200);
    assertEquals(rectEmitted, true);
});

// ---------------------------------------------------------------------------
// highlightQuad()
// ---------------------------------------------------------------------------

Deno.test("OverlayDomain: highlightQuad() stores quad", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    let quadEmitted = false;
    eventBus.on("Overlay.quadHighlighted", () => { quadEmitted = true; });

    const quad = [0, 0, 100, 0, 100, 50, 0, 50];
    await domain.handleMethod("highlightQuad", {
        quad,
        color: { r: 0, g: 0, b: 255, a: 0.5 },
    });

    const state = domain.getOverlayState();
    assertEquals(state.highlightedNodeId, null);
    const quads = state.highlightedQuads as Array<Record<string, unknown>>;
    assertEquals(quads.length, 1);
    assertEquals((quads[0].quad as number[]).length, 8);
    assertEquals(quadEmitted, true);
});

// ---------------------------------------------------------------------------
// hideHighlight()
// ---------------------------------------------------------------------------

Deno.test("OverlayDomain: hideHighlight() clears all highlights", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    let clearEmitted = false;
    eventBus.on("Overlay.highlightCleared", () => { clearEmitted = true; });

    // Set various highlights
    await domain.handleMethod("highlightNode", {
        nodeId: 1,
        highlightConfig: { showInfo: true },
    });

    await domain.handleMethod("hideHighlight", {});

    const state = domain.getOverlayState();
    assertEquals(state.highlightedNodeId, null);
    assertEquals(state.highlightConfig, null);
    assertEquals((state.highlightedRects as unknown[]).length, 0);
    assertEquals((state.highlightedQuads as unknown[]).length, 0);
    assertEquals(state.highlightedFrameId, null);
    assertEquals(clearEmitted, true);
});

// ---------------------------------------------------------------------------
// setInspectMode()
// ---------------------------------------------------------------------------

Deno.test("OverlayDomain: setInspectMode() changes mode to searchForNode", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    let modeData: Record<string, unknown> = {};
    let modeReceived = false;
    eventBus.on("Overlay.inspectModeChanged", (data) => {
        modeData = data as Record<string, unknown>;
        modeReceived = true;
    });

    await domain.handleMethod("setInspectMode", {
        mode: "searchForNode",
        highlightConfig: { showInfo: true },
    });

    const state = domain.getOverlayState();
    assertEquals(state.inspectMode, "searchForNode");
    assertEquals(modeReceived, true);
    assertEquals(modeData.mode, "searchForNode");
});

Deno.test("OverlayDomain: setInspectMode('none') clears mode and emits inspectModeCanceled", async () => {
    const { domain, events } = setup();
    await domain.enable();

    // First enter inspect mode
    await domain.handleMethod("setInspectMode", { mode: "searchForNode" });
    events.length = 0;

    // Then exit
    await domain.handleMethod("setInspectMode", { mode: "none" });

    const state = domain.getOverlayState();
    assertEquals(state.inspectMode, "none");

    const canceled = events.find((e) => e.method === "Overlay.inspectModeCanceled");
    assertExists(canceled);
});

Deno.test("OverlayDomain: setInspectMode('captureAreaScreenshot') emits screenshotRequested", async () => {
    const { domain, events } = setup();
    await domain.enable();
    events.length = 0;

    await domain.handleMethod("setInspectMode", { mode: "captureAreaScreenshot" });

    const screenshot = events.find((e) => e.method === "Overlay.screenshotRequested");
    assertExists(screenshot);
    assertEquals(screenshot.params?.mode, "captureAreaScreenshot");
});

// ---------------------------------------------------------------------------
// getHighlightObjectForTest()
// ---------------------------------------------------------------------------

Deno.test("OverlayDomain: getHighlightObjectForTest() returns box model data for a node with layout", async () => {
    // Create an element with a layout attached
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new OverlayDomain(eventBus);

    const layout = createMockLayoutBox({
        x: 10, y: 20, width: 200, height: 100,
        paddingTop: 5, paddingRight: 10, paddingBottom: 5, paddingLeft: 10,
        borderTopWidth: 2, borderRightWidth: 2, borderBottomWidth: 2, borderLeftWidth: 2,
        marginTop: 8, marginRight: 8, marginBottom: 8, marginLeft: 8,
    });

    const element = createMockElement("div", { id: "test", class: "box" }, [], { layout });
    const mockDoc = { nodeId: 0, childNodes: [element] };

    const renderResult = createMockRenderResult();
    const renderingPipeline = createMockRenderingPipeline(renderResult);

    // Override getStats to return a result with DOM for node lookup
    Object.assign(renderingPipeline, {
        getStats: () => ({
            viewport: { width: 1024, height: 768 },
            renders: 1,
            lastRenderTime: 165,
            resources: { totalSize: 7000, count: 2 },
            lastRenderResult: {
                dom: mockDoc,
            },
        }),
    });

    const context = createMockContext({ eventBus, renderingPipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getHighlightObjectForTest", {
        nodeId: element.nodeId,
    });

    assertExists(result.highlight);
    const highlight = result.highlight as Record<string, unknown>;
    assertEquals(highlight.nodeId, element.nodeId);
    assertEquals(highlight.width, 200);
    assertEquals(highlight.height, 100);
    assertExists(highlight.contentQuad);
    assertExists(highlight.paddingQuad);
    assertExists(highlight.borderQuad);
    assertExists(highlight.marginQuad);
});

Deno.test("OverlayDomain: getHighlightObjectForTest() with no highlighted node returns fallback data", async () => {
    const { domain } = setup();
    await domain.enable();

    // Use a nodeId that does not exist in the mock DOM
    const result = await domain.handleMethod("getHighlightObjectForTest", {
        nodeId: 99999,
    });

    assertExists(result.highlight);
    const highlight = result.highlight as Record<string, unknown>;
    assertEquals(highlight.nodeId, 99999);
    assertEquals(highlight.width, 0);
    assertEquals(highlight.height, 0);
    // contentQuad should be all zeros
    const contentQuad = highlight.contentQuad as number[];
    assertEquals(contentQuad.length, 8);
    assertEquals(contentQuad.every((v: number) => v === 0), true);
});

// ---------------------------------------------------------------------------
// highlightFrame()
// ---------------------------------------------------------------------------

Deno.test("OverlayDomain: highlightFrame() stores frame highlight", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    let frameData: Record<string, unknown> = {};
    let frameReceived = false;
    eventBus.on("Overlay.frameHighlighted", (data) => {
        frameData = data as Record<string, unknown>;
        frameReceived = true;
    });

    await domain.handleMethod("highlightFrame", {
        frameId: "frame-main",
        contentColor: { r: 255, g: 0, b: 0, a: 0.3 },
        contentOutlineColor: { r: 255, g: 0, b: 0, a: 1.0 },
    });

    const state = domain.getOverlayState();
    assertEquals(state.highlightedFrameId, "frame-main");
    assertEquals(state.highlightedNodeId, null);
    assertEquals(frameReceived, true);
    assertEquals(frameData.frameId, "frame-main");
});

// ---------------------------------------------------------------------------
// Grid/flex overlay toggles
// ---------------------------------------------------------------------------

Deno.test("OverlayDomain: setShowGridOverlays() enables grid overlays", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    let gridData: Record<string, unknown> = {};
    let gridReceived = false;
    eventBus.on("Overlay.gridOverlaysChanged", (data) => {
        gridData = data as Record<string, unknown>;
        gridReceived = true;
    });

    await domain.handleMethod("setShowGridOverlays", {
        gridNodeHighlightConfigs: [{ nodeId: 1, gridHighlightConfig: {} }],
    });

    const state = domain.getOverlayState();
    assertEquals(state.showGridOverlays, true);
    assertEquals(gridReceived, true);
    assertEquals(gridData.enabled, true);
});

Deno.test("OverlayDomain: setShowGridOverlays() with empty configs disables grid overlays", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("setShowGridOverlays", {
        gridNodeHighlightConfigs: [],
    });

    const state = domain.getOverlayState();
    assertEquals(state.showGridOverlays, false);
});

Deno.test("OverlayDomain: setShowFlexOverlays() enables flex overlays", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    let flexData: Record<string, unknown> = {};
    let flexReceived = false;
    eventBus.on("Overlay.flexOverlaysChanged", (data) => {
        flexData = data as Record<string, unknown>;
        flexReceived = true;
    });

    await domain.handleMethod("setShowFlexOverlays", {
        flexNodeHighlightConfigs: [{ nodeId: 1, flexContainerHighlightConfig: {} }],
    });

    const state = domain.getOverlayState();
    assertEquals(state.showFlexOverlays, true);
    assertEquals(flexReceived, true);
    assertEquals(flexData.enabled, true);
});

Deno.test("OverlayDomain: setShowFlexOverlays() with empty configs disables flex overlays", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("setShowFlexOverlays", {
        flexNodeHighlightConfigs: [],
    });

    const state = domain.getOverlayState();
    assertEquals(state.showFlexOverlays, false);
});

// ---------------------------------------------------------------------------
// disable()
// ---------------------------------------------------------------------------

Deno.test("OverlayDomain: disable() clears highlights and inspect mode", async () => {
    const { domain, events } = setup();
    await domain.enable();

    // Set up some state
    await domain.handleMethod("highlightNode", {
        nodeId: 1,
        highlightConfig: { showInfo: true },
    });
    await domain.handleMethod("setInspectMode", { mode: "searchForNode" });
    events.length = 0;

    await domain.disable();

    const state = domain.getOverlayState();
    assertEquals(state.highlightedNodeId, null);
    assertEquals(state.inspectMode, "none");
    assertEquals(domain.isEnabled(), false);

    // Should have emitted inspectModeCanceled since mode was active
    const canceled = events.find((e) => e.method === "Overlay.inspectModeCanceled");
    assertExists(canceled);
});

Deno.test("OverlayDomain: disable() does not emit inspectModeCanceled when mode is already none", async () => {
    const { domain, events } = setup();
    await domain.enable();
    events.length = 0;

    await domain.disable();

    const canceled = events.find((e) => e.method === "Overlay.inspectModeCanceled");
    assertEquals(canceled, undefined);
});

// ---------------------------------------------------------------------------
// dispose()
// ---------------------------------------------------------------------------

Deno.test("OverlayDomain: dispose() cleans up all state", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("highlightNode", {
        nodeId: 1,
        highlightConfig: { showInfo: true },
    });
    await domain.handleMethod("setInspectMode", { mode: "searchForNode" });
    await domain.handleMethod("setShowGridOverlays", {
        gridNodeHighlightConfigs: [{ nodeId: 1 }],
    });

    domain.dispose();

    const state = domain.getOverlayState();
    assertEquals(state.highlightedNodeId, null);
    assertEquals(state.inspectMode, "none");
    assertEquals(state.showGridOverlays, false);
    assertEquals(state.showFlexOverlays, false);
    assertEquals(domain.isEnabled(), false);
});

// ---------------------------------------------------------------------------
// Enhanced Edge Case Tests
// ---------------------------------------------------------------------------

Deno.test("OverlayDomain: handleMethod throws for unknown method", async () => {
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

Deno.test("OverlayDomain: DOM.documentUpdated event clears highlights when enabled", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    // Set up a highlight
    await domain.handleMethod("highlightNode", {
        nodeId: 1,
        highlightConfig: { showInfo: true },
    });
    assertEquals(domain.getOverlayState().highlightedNodeId, 1);

    // Simulate DOM document update
    eventBus.emit("DOM.documentUpdated", {});

    // Highlights should be cleared
    const state = domain.getOverlayState();
    assertEquals(state.highlightedNodeId, null);
    assertEquals(state.highlightConfig, null);
});

Deno.test("OverlayDomain: DOM.documentUpdated does not clear when disabled", async () => {
    const { domain, eventBus } = setup();
    // NOT enabled

    // Simulate DOM document update - should not throw
    eventBus.emit("DOM.documentUpdated", {});

    // State should remain default
    const state = domain.getOverlayState();
    assertEquals(state.highlightedNodeId, null);
});

Deno.test("OverlayDomain: DOM.nodeSelected in searchForNode mode emits inspectNodeRequested", async () => {
    const { domain, eventBus, events } = setup();
    await domain.enable();

    // Enter inspect mode
    await domain.handleMethod("setInspectMode", { mode: "searchForNode" });
    events.length = 0;

    // Simulate node selection
    eventBus.emit("DOM.nodeSelected", { nodeId: 42 });

    const inspectEvent = events.find((e) => e.method === "Overlay.inspectNodeRequested");
    assertExists(inspectEvent);
    assertEquals(inspectEvent.params?.nodeId, 42);

    // Should also auto-highlight the selected node
    const state = domain.getOverlayState();
    assertEquals(state.highlightedNodeId, 42);
});

Deno.test("OverlayDomain: DOM.nodeSelected is ignored when not in inspect mode", async () => {
    const { domain, eventBus, events } = setup();
    await domain.enable();
    events.length = 0;

    // Default inspect mode is "none"
    eventBus.emit("DOM.nodeSelected", { nodeId: 42 });

    const inspectEvent = events.find((e) => e.method === "Overlay.inspectNodeRequested");
    assertEquals(inspectEvent, undefined);
});

Deno.test("OverlayDomain: highlightFrame clears node and rect highlights", async () => {
    const { domain } = setup();
    await domain.enable();

    // Set up node and rect highlights
    await domain.handleMethod("highlightNode", {
        nodeId: 1,
        highlightConfig: { showInfo: true },
    });
    await domain.handleMethod("highlightRect", {
        x: 10, y: 10, width: 100, height: 100,
    });

    // Now highlight a frame
    await domain.handleMethod("highlightFrame", {
        frameId: "main-frame",
    });

    const state = domain.getOverlayState();
    assertEquals(state.highlightedFrameId, "main-frame");
    assertEquals(state.highlightedNodeId, null);
    assertEquals((state.highlightedRects as unknown[]).length, 0);
    assertEquals((state.highlightedQuads as unknown[]).length, 0);
});
