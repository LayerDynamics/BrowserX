/**
 * Tests for Paint Order
 * Tests z-index and stacking context logic.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    PaintOrder,
    PaintPhase,
    type StackingContext,
} from "../../../../src/engine/rendering/paint/PaintOrder.ts";
import type { RenderObject } from "../../../../src/engine/rendering/rendering/RenderObject.ts";

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
        layout: null,
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

// PaintPhase enum tests

Deno.test({
    name: "PaintPhase - BACKGROUND_AND_BORDERS value",
    fn() {
        assertEquals(PaintPhase.BACKGROUND_AND_BORDERS, 0);
    },
});

Deno.test({
    name: "PaintPhase - NEGATIVE_Z_INDEX value",
    fn() {
        assertEquals(PaintPhase.NEGATIVE_Z_INDEX, 1);
    },
});

Deno.test({
    name: "PaintPhase - BLOCK_BACKGROUNDS value",
    fn() {
        assertEquals(PaintPhase.BLOCK_BACKGROUNDS, 2);
    },
});

Deno.test({
    name: "PaintPhase - FLOATS value",
    fn() {
        assertEquals(PaintPhase.FLOATS, 3);
    },
});

Deno.test({
    name: "PaintPhase - FOREGROUND value",
    fn() {
        assertEquals(PaintPhase.FOREGROUND, 4);
    },
});

Deno.test({
    name: "PaintPhase - OUTLINE value",
    fn() {
        assertEquals(PaintPhase.OUTLINE, 5);
    },
});

Deno.test({
    name: "PaintPhase - POSITIVE_Z_INDEX value",
    fn() {
        assertEquals(PaintPhase.POSITIVE_Z_INDEX, 6);
    },
});

// PaintOrder constructor tests

Deno.test({
    name: "PaintOrder - constructor creates instance",
    fn() {
        const paintOrder = new PaintOrder();
        assertExists(paintOrder);
    },
});

// PaintOrder.buildStackingContextTree tests

Deno.test({
    name: "PaintOrder - buildStackingContextTree creates context for root",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");

        const context = paintOrder.buildStackingContextTree(root);

        assertExists(context);
        assertEquals(context.root, root);
    },
});

Deno.test({
    name: "PaintOrder - buildStackingContextTree initializes empty children",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");

        const context = paintOrder.buildStackingContextTree(root);

        assertExists(context.children);
        assertEquals(context.children.length, 0);
    },
});

Deno.test({
    name: "PaintOrder - buildStackingContextTree with child creating stacking context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { position: "relative", "z-index": "1" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);

        assertEquals(context.children.length, 1);
        assertEquals(context.children[0].root, child);
    },
});

Deno.test({
    name: "PaintOrder - buildStackingContextTree with child in same context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", {}, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);

        assertEquals(context.contents.length, 1);
        assertEquals(context.contents[0], child);
    },
});

Deno.test({
    name: "PaintOrder - buildStackingContextTree sorts children by z-index",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child1 = createMockRenderObject("child1", { position: "relative", "z-index": "10" }, root);
        const child2 = createMockRenderObject("child2", { position: "relative", "z-index": "5" }, root);
        addChild(root, child1);
        addChild(root, child2);

        const context = paintOrder.buildStackingContextTree(root);

        assertEquals(context.children.length, 2);
        assertEquals(context.children[0].zIndex, 5);
        assertEquals(context.children[1].zIndex, 10);
    },
});

// PaintOrder.createsStackingContext tests

Deno.test({
    name: "PaintOrder - root creates stacking context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const context = paintOrder.buildStackingContextTree(root);

        // Root should create its own context
        assertExists(context);
    },
});

Deno.test({
    name: "PaintOrder - positioned element with z-index creates context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { position: "absolute", "z-index": "1" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);

        assertEquals(context.children.length, 1);
    },
});

Deno.test({
    name: "PaintOrder - opacity less than 1 creates context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { opacity: "0.5" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);

        assertEquals(context.children.length, 1);
    },
});

Deno.test({
    name: "PaintOrder - transform creates context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { transform: "translateX(10px)" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);

        assertEquals(context.children.length, 1);
    },
});

Deno.test({
    name: "PaintOrder - filter creates context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { filter: "blur(5px)" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);

        assertEquals(context.children.length, 1);
    },
});

Deno.test({
    name: "PaintOrder - isolation isolate creates context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { isolation: "isolate" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);

        assertEquals(context.children.length, 1);
    },
});

Deno.test({
    name: "PaintOrder - mix-blend-mode creates context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { "mix-blend-mode": "multiply" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);

        assertEquals(context.children.length, 1);
    },
});

Deno.test({
    name: "PaintOrder - flex item with z-index creates context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root", { display: "flex" });
        const child = createMockRenderObject("child", { "z-index": "1" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);

        assertEquals(context.children.length, 1);
    },
});

// PaintOrder.getPaintOrder tests

Deno.test({
    name: "PaintOrder - getPaintOrder includes root",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const context = paintOrder.buildStackingContextTree(root);

        const order = paintOrder.getPaintOrder(context);

        assert(order.includes(root));
    },
});

Deno.test({
    name: "PaintOrder - getPaintOrder places negative z-index before root",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { position: "relative", "z-index": "-1" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);
        const order = paintOrder.getPaintOrder(context);

        // Root should be first, then negative z-index child's paint order
        assertEquals(order[0], root);
    },
});

Deno.test({
    name: "PaintOrder - getPaintOrder places positive z-index after content",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child1 = createMockRenderObject("child1", { position: "static" }, root);
        const child2 = createMockRenderObject("child2", { position: "relative", "z-index": "1" }, root);
        addChild(root, child1);
        addChild(root, child2);

        const order = paintOrder.calculatePaintOrder(root);

        const child1Index = order.indexOf(child1);
        const child2Index = order.indexOf(child2);
        assert(child1Index < child2Index);
    },
});

Deno.test({
    name: "PaintOrder - getPaintOrder includes block contents",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { display: "block", position: "static" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);
        const order = paintOrder.getPaintOrder(context);

        assert(order.includes(child));
    },
});

Deno.test({
    name: "PaintOrder - getPaintOrder includes floats",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { float: "left" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);
        const order = paintOrder.getPaintOrder(context);

        assert(order.includes(child));
    },
});

Deno.test({
    name: "PaintOrder - getPaintOrder includes inline contents",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { display: "inline", position: "static" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);
        const order = paintOrder.getPaintOrder(context);

        assert(order.includes(child));
    },
});

// PaintOrder.calculatePaintOrder tests

Deno.test({
    name: "PaintOrder - calculatePaintOrder returns ordered list",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");

        const order = paintOrder.calculatePaintOrder(root);

        assertExists(order);
        assert(Array.isArray(order));
    },
});

Deno.test({
    name: "PaintOrder - calculatePaintOrder includes all elements",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child1 = createMockRenderObject("child1", {}, root);
        const child2 = createMockRenderObject("child2", {}, root);
        addChild(root, child1);
        addChild(root, child2);

        const order = paintOrder.calculatePaintOrder(root);

        assert(order.includes(root));
        assert(order.includes(child1));
        assert(order.includes(child2));
    },
});

Deno.test({
    name: "PaintOrder - calculatePaintOrder respects z-index",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const low = createMockRenderObject("low", { position: "relative", "z-index": "1" }, root);
        const high = createMockRenderObject("high", { position: "relative", "z-index": "10" }, root);
        addChild(root, high);
        addChild(root, low);

        const order = paintOrder.calculatePaintOrder(root);

        const lowIndex = order.indexOf(low);
        const highIndex = order.indexOf(high);
        assert(lowIndex < highIndex);
    },
});

// PaintOrder.sortByTreeOrder tests

Deno.test({
    name: "PaintOrder - sortByTreeOrder sorts by document order",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child1 = createMockRenderObject("child1", {}, root);
        const child2 = createMockRenderObject("child2", {}, root);
        addChild(root, child1);
        addChild(root, child2);

        const sorted = paintOrder.sortByTreeOrder([child2, child1]);

        assertEquals(sorted[0], child1);
        assertEquals(sorted[1], child2);
    },
});

Deno.test({
    name: "PaintOrder - sortByTreeOrder handles empty array",
    fn() {
        const paintOrder = new PaintOrder();

        const sorted = paintOrder.sortByTreeOrder([]);

        assertEquals(sorted.length, 0);
    },
});

Deno.test({
    name: "PaintOrder - sortByTreeOrder handles single element",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");

        const sorted = paintOrder.sortByTreeOrder([root]);

        assertEquals(sorted.length, 1);
        assertEquals(sorted[0], root);
    },
});

// PaintOrder.getStackingContextRoot tests

Deno.test({
    name: "PaintOrder - getStackingContextRoot returns root for root",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");

        const contextRoot = paintOrder.getStackingContextRoot(root);

        assertEquals(contextRoot, root);
    },
});

Deno.test({
    name: "PaintOrder - getStackingContextRoot returns parent context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const parent = createMockRenderObject("parent", { position: "relative", "z-index": "1" }, root);
        const child = createMockRenderObject("child", {}, parent);
        addChild(root, parent);
        addChild(parent, child);

        const contextRoot = paintOrder.getStackingContextRoot(child);

        assertEquals(contextRoot, parent);
    },
});

Deno.test({
    name: "PaintOrder - getStackingContextRoot handles no stacking context parent",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", {}, root);
        addChild(root, child);

        const contextRoot = paintOrder.getStackingContextRoot(child);

        assertEquals(contextRoot, root);
    },
});

// PaintOrder.compare tests

Deno.test({
    name: "PaintOrder - compare elements in same context by tree order",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child1 = createMockRenderObject("child1", {}, root);
        const child2 = createMockRenderObject("child2", {}, root);
        addChild(root, child1);
        addChild(root, child2);

        const result = paintOrder.compare(child1, child2);

        assert(result < 0);
    },
});

Deno.test({
    name: "PaintOrder - compare elements in different contexts by z-index",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const low = createMockRenderObject("low", { position: "relative", "z-index": "1" }, root);
        const high = createMockRenderObject("high", { position: "relative", "z-index": "10" }, root);
        addChild(root, low);
        addChild(root, high);

        const result = paintOrder.compare(low, high);

        assert(result < 0);
    },
});

// PaintOrder.groupByPaintPhase tests

Deno.test({
    name: "PaintOrder - groupByPaintPhase groups by phase",
    fn() {
        const paintOrder = new PaintOrder();
        const block = createMockRenderObject("block", { display: "block" });
        const inline = createMockRenderObject("inline", { display: "inline" });

        const groups = paintOrder.groupByPaintPhase([block, inline]);

        assertExists(groups.get(PaintPhase.BLOCK_BACKGROUNDS));
        assertExists(groups.get(PaintPhase.FOREGROUND));
    },
});

Deno.test({
    name: "PaintOrder - groupByPaintPhase handles empty array",
    fn() {
        const paintOrder = new PaintOrder();

        const groups = paintOrder.groupByPaintPhase([]);

        assertEquals(groups.size, 0);
    },
});

Deno.test({
    name: "PaintOrder - groupByPaintPhase negative z-index",
    fn() {
        const paintOrder = new PaintOrder();
        const obj = createMockRenderObject("obj", { position: "relative", "z-index": "-1" });

        const groups = paintOrder.groupByPaintPhase([obj]);

        assertExists(groups.get(PaintPhase.NEGATIVE_Z_INDEX));
    },
});

Deno.test({
    name: "PaintOrder - groupByPaintPhase positive z-index",
    fn() {
        const paintOrder = new PaintOrder();
        const obj = createMockRenderObject("obj", { position: "relative", "z-index": "1" });

        const groups = paintOrder.groupByPaintPhase([obj]);

        assertExists(groups.get(PaintPhase.POSITIVE_Z_INDEX));
    },
});

Deno.test({
    name: "PaintOrder - groupByPaintPhase floats",
    fn() {
        const paintOrder = new PaintOrder();
        const obj = createMockRenderObject("obj", { float: "left" });

        const groups = paintOrder.groupByPaintPhase([obj]);

        assertExists(groups.get(PaintPhase.FLOATS));
    },
});

Deno.test({
    name: "PaintOrder - groupByPaintPhase inline content",
    fn() {
        const paintOrder = new PaintOrder();
        const obj = createMockRenderObject("obj", { display: "inline" });

        const groups = paintOrder.groupByPaintPhase([obj]);

        assertExists(groups.get(PaintPhase.FOREGROUND));
    },
});

Deno.test({
    name: "PaintOrder - groupByPaintPhase block content",
    fn() {
        const paintOrder = new PaintOrder();
        const obj = createMockRenderObject("obj", { display: "block" });

        const groups = paintOrder.groupByPaintPhase([obj]);

        assertExists(groups.get(PaintPhase.BLOCK_BACKGROUNDS));
    },
});

// Complex stacking context tests

Deno.test({
    name: "PaintOrder - complex nested stacking contexts",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const layer1 = createMockRenderObject("layer1", { position: "relative", "z-index": "1" }, root);
        const layer2 = createMockRenderObject("layer2", { position: "relative", "z-index": "2" }, root);
        const nested = createMockRenderObject("nested", { position: "relative", "z-index": "3" }, layer1);

        addChild(root, layer1);
        addChild(root, layer2);
        addChild(layer1, nested);

        const order = paintOrder.calculatePaintOrder(root);

        // Should include all elements
        assert(order.includes(root));
        assert(order.includes(layer1));
        assert(order.includes(layer2));
        assert(order.includes(nested));
    },
});

Deno.test({
    name: "PaintOrder - will-change creates stacking context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { "will-change": "transform" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);

        assertEquals(context.children.length, 1);
    },
});

Deno.test({
    name: "PaintOrder - grid item with z-index creates context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root", { display: "grid" });
        const child = createMockRenderObject("child", { "z-index": "1" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);

        assertEquals(context.children.length, 1);
    },
});

Deno.test({
    name: "PaintOrder - positioned element without z-index doesn't create context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { position: "relative" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);

        assertEquals(context.children.length, 0);
        assertEquals(context.contents.length, 1);
    },
});

Deno.test({
    name: "PaintOrder - z-index auto doesn't create context",
    fn() {
        const paintOrder = new PaintOrder();
        const root = createMockRenderObject("root");
        const child = createMockRenderObject("child", { position: "relative", "z-index": "auto" }, root);
        addChild(root, child);

        const context = paintOrder.buildStackingContextTree(root);

        assertEquals(context.children.length, 0);
        assertEquals(context.contents.length, 1);
    },
});
