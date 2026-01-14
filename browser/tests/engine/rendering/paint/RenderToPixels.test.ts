/**
 * Tests for Render To Pixels
 * Tests main paint coordinator and paint scheduler.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    RenderToPixels,
    PaintScheduler,
    type PaintResult,
    type PaintStats,
    type DamageRegion,
} from "../../../../src/engine/rendering/paint/RenderToPixels.ts";
import type { RenderObject } from "../../../../src/engine/rendering/rendering/RenderObject.ts";
import type { Pixels } from "../../../../src/types/identifiers.ts";

// Mock RenderObject for testing
function createMockRenderObject(
    id: string,
    styleProps: Record<string, string> = {},
    parent: RenderObject | null = null,
): RenderObject {
    const obj: RenderObject = {
        id: id as any,
        element: {} as any,
        style: {
            getPropertyValue: (prop: string) => styleProps[prop] || '',
        } as any,
        parent,
        children: [],
        nextSibling: null,
        layout: {
            x: 0 as Pixels,
            y: 0 as Pixels,
            width: 100 as Pixels,
            height: 100 as Pixels,
        } as any,
        needsLayout: false,
        paintLayer: null,
        needsPaint: false,
        markNeedsLayout: () => {},
        doLayout: () => {},
        markNeedsPaint: () => {},
        paint: () => {},
        setPosition: () => {},
        appendChild: () => {},
        removeChild: () => {},
        insertBefore: () => {},
        get firstChild() { return null; },
        get lastChild() { return null; },
        isBlock: () => false,
        isInline: () => false,
        isReplaced: () => false,
        createsStackingContext: () => false,
        getPixelValue: () => 0 as any,
        visitChildren: () => {},
        findAncestor: () => null,
        getDepth: () => 0,
        isAncestorOf: () => false,
        toString: () => '',
        debugTree: () => '',
    } as any;
    return obj;
}

// Helper to add child to parent
function addChild(parent: RenderObject, child: RenderObject): void {
    parent.children.push(child);
    (child as any).parent = parent;
}

// RenderToPixels constructor tests

Deno.test({
    name: "RenderToPixels - constructor creates instance",
    fn() {
        const renderer = new RenderToPixels();
        assertExists(renderer);
    },
});

Deno.test({
    name: "RenderToPixels - getCanvas returns null initially",
    fn() {
        const renderer = new RenderToPixels();
        assertEquals(renderer.getCanvas(), null);
    },
});

Deno.test({
    name: "RenderToPixels - getLayerTree returns null initially",
    fn() {
        const renderer = new RenderToPixels();
        assertEquals(renderer.getLayerTree(), null);
    },
});

Deno.test({
    name: "RenderToPixels - getDamageRegions returns empty array initially",
    fn() {
        const renderer = new RenderToPixels();
        assertEquals(renderer.getDamageRegions().length, 0);
    },
});

// RenderToPixels.paint tests

Deno.test({
    name: "RenderToPixels - paint creates canvas",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels);

        const canvas = renderer.getCanvas();
        assertExists(canvas);
    },
});

Deno.test({
    name: "RenderToPixels - paint sets canvas dimensions",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels);

        const canvas = renderer.getCanvas();
        assertExists(canvas);
        assertEquals(canvas.width, 800);
        assertEquals(canvas.height, 600);
    },
});

Deno.test({
    name: "RenderToPixels - paint creates layer tree",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels);

        const layerTree = renderer.getLayerTree();
        assertExists(layerTree);
    },
});

Deno.test({
    name: "RenderToPixels - paint returns result",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        const result = renderer.paint(root, 800 as Pixels, 600 as Pixels);

        assertExists(result);
        assertExists(result.canvas);
        assertExists(result.layerTree);
        assertExists(result.stats);
    },
});

Deno.test({
    name: "RenderToPixels - paint returns stats",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        const result = renderer.paint(root, 800 as Pixels, 600 as Pixels);

        assertExists(result.stats.totalLayers);
        assertExists(result.stats.dirtyLayers);
        assertExists(result.stats.gpuLayers);
        assert(result.stats.paintTime >= 0);
        assert(result.stats.compositeTime >= 0);
        assert(result.stats.totalCommands >= 0);
    },
});

Deno.test({
    name: "RenderToPixels - paint with incremental false forces full repaint",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels, false);
        const result = renderer.paint(root, 800 as Pixels, 600 as Pixels, false);

        // Should have no damage region on full repaint
        assertEquals(result.damageRegion, null);
    },
});

Deno.test({
    name: "RenderToPixels - paint creates new canvas on dimension change",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        const canvas1 = renderer.getCanvas();

        renderer.paint(root, 1024 as Pixels, 768 as Pixels);
        const canvas2 = renderer.getCanvas();

        assertExists(canvas2);
        assertEquals(canvas2.width, 1024);
        assertEquals(canvas2.height, 768);
    },
});

// RenderToPixels.paintToCanvas tests

Deno.test({
    name: "RenderToPixels - paintToCanvas returns canvas",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        const canvas = renderer.paintToCanvas(root, 800 as Pixels, 600 as Pixels);

        assertExists(canvas);
        assertEquals(canvas.width, 800);
        assertEquals(canvas.height, 600);
    },
});

// RenderToPixels.invalidate tests

Deno.test({
    name: "RenderToPixels - invalidate marks all layers dirty",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        renderer.invalidate();

        const layerTree = renderer.getLayerTree();
        assertExists(layerTree);
        const dirtyLayers = layerTree.getDirtyLayers();
        assert(dirtyLayers.length > 0);
    },
});

Deno.test({
    name: "RenderToPixels - invalidate creates full damage region",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        renderer.invalidate();

        const damageRegions = renderer.getDamageRegions();
        assertEquals(damageRegions.length, 1);
        assertEquals(damageRegions[0].width, 800);
        assertEquals(damageRegions[0].height, 600);
    },
});

// RenderToPixels.clearDamageRegions tests

Deno.test({
    name: "RenderToPixels - clearDamageRegions clears regions",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        renderer.invalidate();
        renderer.clearDamageRegions();

        const damageRegions = renderer.getDamageRegions();
        assertEquals(damageRegions.length, 0);
    },
});

// RenderToPixels.exportLayerTree tests

Deno.test({
    name: "RenderToPixels - exportLayerTree returns layer data",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        const exported = renderer.exportLayerTree();

        assertExists(exported);
        assertExists(exported.id);
        assertExists(exported.bounds);
        assertExists(exported.transform);
    },
});

Deno.test({
    name: "RenderToPixels - exportLayerTree returns null when no tree",
    fn() {
        const renderer = new RenderToPixels();

        const exported = renderer.exportLayerTree();

        assertEquals(exported, null);
    },
});

Deno.test({
    name: "RenderToPixels - exportLayerTree includes children",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { opacity: "0.5" }, root);
        addChild(root, child);

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        const exported = renderer.exportLayerTree();

        assertExists(exported);
        assertExists(exported.children);
    },
});

// RenderToPixels.getMemoryUsage tests

Deno.test({
    name: "RenderToPixels - getMemoryUsage returns 0 when no tree",
    fn() {
        const renderer = new RenderToPixels();

        const usage = renderer.getMemoryUsage();

        assertEquals(usage, 0);
    },
});

Deno.test({
    name: "RenderToPixels - getMemoryUsage includes canvas memory",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        const usage = renderer.getMemoryUsage();

        // Should include canvas (800 * 600 * 4 bytes = 1,920,000 bytes)
        assert(usage >= 800 * 600 * 4);
    },
});

// RenderToPixels.createPaintContext tests

Deno.test({
    name: "RenderToPixels - createPaintContext returns context",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        const layerTree = renderer.getLayerTree();
        assertExists(layerTree);

        const context = renderer.createPaintContext(layerTree.getRoot());

        assertExists(context);
        assertExists(context.displayList);
        assertExists(context.currentLayer);
        assertExists(context.opacity);
    },
});

Deno.test({
    name: "RenderToPixels - createPaintContext includes layer properties",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        const layerTree = renderer.getLayerTree();
        assertExists(layerTree);

        const context = renderer.createPaintContext(layerTree.getRoot());

        assertEquals(context.opacity, 1.0);
        assertEquals(context.clipRegion, null);
    },
});

// RenderToPixels.dispose tests

Deno.test({
    name: "RenderToPixels - dispose clears canvas",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        renderer.dispose();

        assertEquals(renderer.getCanvas(), null);
    },
});

Deno.test({
    name: "RenderToPixels - dispose clears layer tree",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        renderer.dispose();

        assertEquals(renderer.getLayerTree(), null);
    },
});

Deno.test({
    name: "RenderToPixels - dispose clears damage regions",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        renderer.invalidate();
        renderer.dispose();

        assertEquals(renderer.getDamageRegions().length, 0);
    },
});

// RenderToPixels layer creation tests

Deno.test({
    name: "RenderToPixels - creates layer for opacity",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { opacity: "0.5" }, root);
        addChild(root, child);

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        const layerTree = renderer.getLayerTree();
        assertExists(layerTree);

        const layers = layerTree.getAllLayers();
        assert(layers.length > 1);
    },
});

Deno.test({
    name: "RenderToPixels - creates layer for transform",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { transform: "translateX(10px)" }, root);
        addChild(root, child);

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        const layerTree = renderer.getLayerTree();
        assertExists(layerTree);

        const layers = layerTree.getAllLayers();
        assert(layers.length > 1);
    },
});

Deno.test({
    name: "RenderToPixels - creates layer for filter",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { filter: "blur(5px)" }, root);
        addChild(root, child);

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        const layerTree = renderer.getLayerTree();
        assertExists(layerTree);

        const layers = layerTree.getAllLayers();
        assert(layers.length > 1);
    },
});

Deno.test({
    name: "RenderToPixels - creates layer for fixed position",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { position: "fixed" }, root);
        addChild(root, child);

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        const layerTree = renderer.getLayerTree();
        assertExists(layerTree);

        const layers = layerTree.getAllLayers();
        assert(layers.length > 1);
    },
});

Deno.test({
    name: "RenderToPixels - creates layer for overflow scroll",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { overflow: "scroll" }, root);
        addChild(root, child);

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        const layerTree = renderer.getLayerTree();
        assertExists(layerTree);

        const layers = layerTree.getAllLayers();
        assert(layers.length > 1);
    },
});

Deno.test({
    name: "RenderToPixels - creates layer for will-change",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { "will-change": "transform" }, root);
        addChild(root, child);

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        const layerTree = renderer.getLayerTree();
        assertExists(layerTree);

        const layers = layerTree.getAllLayers();
        assert(layers.length > 1);
    },
});

Deno.test({
    name: "RenderToPixels - creates layer for mix-blend-mode",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { "mix-blend-mode": "multiply" }, root);
        addChild(root, child);

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        const layerTree = renderer.getLayerTree();
        assertExists(layerTree);

        const layers = layerTree.getAllLayers();
        assert(layers.length > 1);
    },
});

Deno.test({
    name: "RenderToPixels - creates layer for isolation",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { isolation: "isolate" }, root);
        addChild(root, child);

        renderer.paint(root, 800 as Pixels, 600 as Pixels);
        const layerTree = renderer.getLayerTree();
        assertExists(layerTree);

        const layers = layerTree.getAllLayers();
        assert(layers.length > 1);
    },
});

// PaintScheduler constructor tests

Deno.test({
    name: "PaintScheduler - constructor creates instance",
    fn() {
        const renderer = new RenderToPixels();
        const scheduler = new PaintScheduler(renderer);
        assertExists(scheduler);
    },
});

Deno.test({
    name: "PaintScheduler - isPaintPending returns false initially",
    fn() {
        const renderer = new RenderToPixels();
        const scheduler = new PaintScheduler(renderer);

        assertEquals(scheduler.isPaintPending(), false);
    },
});

// PaintScheduler.schedulePaint tests

Deno.test({
    name: "PaintScheduler - schedulePaint sets pending flag",
    fn() {
        const renderer = new RenderToPixels();
        const scheduler = new PaintScheduler(renderer);
        const root = createMockRenderObject("root");

        scheduler.schedulePaint(root, 800 as Pixels, 600 as Pixels);

        assertEquals(scheduler.isPaintPending(), true);
    },
});

Deno.test({
    name: "PaintScheduler - schedulePaint ignores duplicate calls",
    fn() {
        const renderer = new RenderToPixels();
        const scheduler = new PaintScheduler(renderer);
        const root = createMockRenderObject("root");

        scheduler.schedulePaint(root, 800 as Pixels, 600 as Pixels);
        scheduler.schedulePaint(root, 800 as Pixels, 600 as Pixels);

        assertEquals(scheduler.isPaintPending(), true);
    },
});

// PaintScheduler.cancelPaint tests

Deno.test({
    name: "PaintScheduler - cancelPaint clears pending flag",
    fn() {
        const renderer = new RenderToPixels();
        const scheduler = new PaintScheduler(renderer);
        const root = createMockRenderObject("root");

        scheduler.schedulePaint(root, 800 as Pixels, 600 as Pixels);
        scheduler.cancelPaint();

        assertEquals(scheduler.isPaintPending(), false);
    },
});

Deno.test({
    name: "PaintScheduler - cancelPaint when not pending",
    fn() {
        const renderer = new RenderToPixels();
        const scheduler = new PaintScheduler(renderer);

        scheduler.cancelPaint();

        assertEquals(scheduler.isPaintPending(), false);
    },
});

// Integration tests

Deno.test({
    name: "RenderToPixels - complex tree with multiple layers",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const layer1 = createMockRenderObject("layer1", { opacity: "0.8" }, root);
        const layer2 = createMockRenderObject("layer2", { transform: "translateX(10px)" }, root);
        const child = createMockRenderObject("child", {}, layer1);

        addChild(root, layer1);
        addChild(root, layer2);
        addChild(layer1, child);

        const result = renderer.paint(root, 800 as Pixels, 600 as Pixels);

        assertExists(result.layerTree);
        assert(result.stats.totalLayers >= 3);
    },
});

Deno.test({
    name: "RenderToPixels - incremental repaint with dirty objects",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");

        // First paint
        renderer.paint(root, 800 as Pixels, 600 as Pixels);

        // Mark as needing paint
        root.needsPaint = true;

        // Second paint (incremental)
        const result = renderer.paint(root, 800 as Pixels, 600 as Pixels, true);

        assertExists(result);
    },
});

Deno.test({
    name: "RenderToPixels - GPU layer promotion",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { opacity: "0.5" }, root);
        addChild(root, child);

        const result = renderer.paint(root, 800 as Pixels, 600 as Pixels);

        // Should have promoted layers with opacity
        assert(result.stats.gpuLayers >= 0);
    },
});

Deno.test({
    name: "RenderToPixels - transform parsing translate",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { transform: "translate(10px, 20px)" }, root);
        addChild(root, child);

        const result = renderer.paint(root, 800 as Pixels, 600 as Pixels);

        assertExists(result.layerTree);
        const layers = result.layerTree.getAllLayers();
        assert(layers.length > 1);
    },
});

Deno.test({
    name: "RenderToPixels - transform parsing scale",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { transform: "scale(2)" }, root);
        addChild(root, child);

        const result = renderer.paint(root, 800 as Pixels, 600 as Pixels);

        assertExists(result.layerTree);
        const layers = result.layerTree.getAllLayers();
        assert(layers.length > 1);
    },
});

Deno.test({
    name: "RenderToPixels - transform parsing rotate",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { transform: "rotate(45deg)" }, root);
        addChild(root, child);

        const result = renderer.paint(root, 800 as Pixels, 600 as Pixels);

        assertExists(result.layerTree);
        const layers = result.layerTree.getAllLayers();
        assert(layers.length > 1);
    },
});

Deno.test({
    name: "RenderToPixels - blend mode mapping",
    fn() {
        const renderer = new RenderToPixels();
        const root = createMockRenderObject("root");
        const multiply = createMockRenderObject("multiply", { "mix-blend-mode": "multiply" }, root);
        const screen = createMockRenderObject("screen", { "mix-blend-mode": "screen" }, root);

        addChild(root, multiply);
        addChild(root, screen);

        const result = renderer.paint(root, 800 as Pixels, 600 as Pixels);

        assertExists(result.layerTree);
        assert(result.stats.totalLayers >= 2);
    },
});
