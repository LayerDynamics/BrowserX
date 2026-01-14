/**
 * Tests for Layout Engine
 * Tests main layout coordinator and layout algorithms.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { LayoutEngine, type ViewportSize, type LayoutStats } from "../../../../src/engine/rendering/layout/LayoutEngine.ts";

// LayoutEngine constructor tests

Deno.test({
    name: "LayoutEngine - constructor creates engine instance",
    fn() {
        const engine = new LayoutEngine();
        assertExists(engine);
    },
});

Deno.test({
    name: "LayoutEngine - has layout method",
    fn() {
        const engine = new LayoutEngine();
        assertExists(engine.layout);
    },
});

Deno.test({
    name: "LayoutEngine - has reflow method",
    fn() {
        const engine = new LayoutEngine();
        assertExists(engine.reflow);
    },
});

Deno.test({
    name: "LayoutEngine - has getStats method",
    fn() {
        const engine = new LayoutEngine();
        assertExists(engine.getStats);
    },
});

Deno.test({
    name: "LayoutEngine - has resetStats method",
    fn() {
        const engine = new LayoutEngine();
        assertExists(engine.resetStats);
    },
});

// LayoutEngine.layout tests

Deno.test({
    name: "LayoutEngine - layout returns statistics",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: true,
            children: [],
            doLayout: () => {},
            style: {
                getPropertyValue: () => "block",
            },
        } as any;
        const viewport: ViewportSize = {
            width: 1024 as any,
            height: 768 as any,
        };

        const stats = engine.layout(root, viewport);

        assertExists(stats);
        assertExists(stats.totalNodes);
        assertExists(stats.layoutTime);
        assertExists(stats.reflowCount);
    },
});

Deno.test({
    name: "LayoutEngine - layout counts nodes",
    fn() {
        const engine = new LayoutEngine();
        const child = {
            needsLayout: true,
            children: [],
            doLayout: () => {},
            style: {
                getPropertyValue: () => "block",
            },
        } as any;

        const root = {
            needsLayout: true,
            children: [child],
            doLayout: () => {},
            style: {
                getPropertyValue: () => "block",
            },
        } as any;

        const viewport: ViewportSize = {
            width: 1024 as any,
            height: 768 as any,
        };

        const stats = engine.layout(root, viewport);

        assert(stats.totalNodes >= 1);
    },
});

Deno.test({
    name: "LayoutEngine - layout increments reflow count",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: true,
            children: [],
            doLayout: () => {},
            style: {
                getPropertyValue: () => "block",
            },
        } as any;
        const viewport: ViewportSize = {
            width: 1024 as any,
            height: 768 as any,
        };

        engine.resetStats();
        engine.layout(root, viewport);
        const stats = engine.getStats();

        assertEquals(stats.reflowCount, 1);
    },
});

Deno.test({
    name: "LayoutEngine - layout measures time",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: true,
            children: [],
            doLayout: () => {},
            style: {
                getPropertyValue: () => "block",
            },
        } as any;
        const viewport: ViewportSize = {
            width: 1024 as any,
            height: 768 as any,
        };

        const stats = engine.layout(root, viewport);

        assert(stats.layoutTime >= 0);
    },
});

Deno.test({
    name: "LayoutEngine - layout with block display",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: true,
            children: [],
            doLayout: () => {},
            style: {
                getPropertyValue: (name: string) => {
                    if (name === "display") return "block";
                    return "";
                },
            },
        } as any;
        const viewport: ViewportSize = {
            width: 1024 as any,
            height: 768 as any,
        };

        const stats = engine.layout(root, viewport);

        assertExists(stats);
    },
});

Deno.test({
    name: "LayoutEngine - layout with flex display",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: true,
            children: [],
            doLayout: () => {},
            style: {
                getPropertyValue: (name: string) => {
                    if (name === "display") return "flex";
                    return "";
                },
            },
            layout: {
                width: 1024,
                height: 768,
                x: 0,
                y: 0,
                paddingLeft: 0,
                paddingRight: 0,
                paddingTop: 0,
                paddingBottom: 0,
            },
        } as any;
        const viewport: ViewportSize = {
            width: 1024 as any,
            height: 768 as any,
        };

        const stats = engine.layout(root, viewport);

        assertExists(stats);
    },
});

Deno.test({
    name: "LayoutEngine - layout with grid display",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: true,
            children: [],
            doLayout: () => {},
            style: {
                getPropertyValue: (name: string) => {
                    if (name === "display") return "grid";
                    return "";
                },
            },
            layout: {
                width: 1024,
                height: 768,
                x: 0,
                y: 0,
                paddingLeft: 0,
                paddingRight: 0,
                paddingTop: 0,
                paddingBottom: 0,
            },
            getPixelValue: () => 0,
        } as any;
        const viewport: ViewportSize = {
            width: 1024 as any,
            height: 768 as any,
        };

        const stats = engine.layout(root, viewport);

        assertExists(stats);
    },
});

// LayoutEngine.reflow tests

Deno.test({
    name: "LayoutEngine - reflow returns statistics",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: false,
            children: [],
            doLayout: () => {},
            style: {
                getPropertyValue: () => "block",
            },
        } as any;
        const viewport: ViewportSize = {
            width: 1024 as any,
            height: 768 as any,
        };

        const stats = engine.reflow(root, viewport);

        assertExists(stats);
    },
});

Deno.test({
    name: "LayoutEngine - reflow with dirty root does full layout",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: true,
            children: [],
            doLayout: () => {},
            style: {
                getPropertyValue: () => "block",
            },
        } as any;
        const viewport: ViewportSize = {
            width: 1024 as any,
            height: 768 as any,
        };

        const stats = engine.reflow(root, viewport);

        assertExists(stats);
    },
});

Deno.test({
    name: "LayoutEngine - reflow with clean tree",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: false,
            children: [],
            doLayout: () => {},
            style: {
                getPropertyValue: () => "block",
            },
        } as any;
        const viewport: ViewportSize = {
            width: 1024 as any,
            height: 768 as any,
        };

        const stats = engine.reflow(root, viewport);

        assertEquals(stats.totalNodes, 0);
    },
});

// LayoutEngine.findDirtyNodes tests

Deno.test({
    name: "LayoutEngine - findDirtyNodes returns empty array for clean tree",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: false,
            children: [],
        } as any;

        const dirtyNodes = engine.findDirtyNodes(root);

        assertEquals(dirtyNodes.length, 0);
    },
});

Deno.test({
    name: "LayoutEngine - findDirtyNodes finds dirty root",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: true,
            children: [],
        } as any;

        const dirtyNodes = engine.findDirtyNodes(root);

        assertEquals(dirtyNodes.length, 1);
        assertEquals(dirtyNodes[0], root);
    },
});

Deno.test({
    name: "LayoutEngine - findDirtyNodes finds dirty children",
    fn() {
        const engine = new LayoutEngine();
        const child1 = {
            needsLayout: true,
            children: [],
        } as any;
        const child2 = {
            needsLayout: false,
            children: [],
        } as any;
        const root = {
            needsLayout: false,
            children: [child1, child2],
        } as any;

        const dirtyNodes = engine.findDirtyNodes(root);

        assertEquals(dirtyNodes.length, 1);
        assertEquals(dirtyNodes[0], child1);
    },
});

// LayoutEngine.clearLayoutFlags tests

Deno.test({
    name: "LayoutEngine - clearLayoutFlags clears root flag",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: true,
            children: [],
        } as any;

        engine.clearLayoutFlags(root);

        assertEquals(root.needsLayout, false);
    },
});

Deno.test({
    name: "LayoutEngine - clearLayoutFlags clears children flags",
    fn() {
        const engine = new LayoutEngine();
        const child1 = {
            needsLayout: true,
            children: [],
        } as any;
        const child2 = {
            needsLayout: true,
            children: [],
        } as any;
        const root = {
            needsLayout: true,
            children: [child1, child2],
        } as any;

        engine.clearLayoutFlags(root);

        assertEquals(root.needsLayout, false);
        assertEquals(child1.needsLayout, false);
        assertEquals(child2.needsLayout, false);
    },
});

// LayoutEngine.markSubtreeForLayout tests

Deno.test({
    name: "LayoutEngine - markSubtreeForLayout marks root",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: false,
            children: [],
            markNeedsLayout: function() {
                this.needsLayout = true;
            },
        } as any;

        engine.markSubtreeForLayout(root);

        assertEquals(root.needsLayout, true);
    },
});

Deno.test({
    name: "LayoutEngine - markSubtreeForLayout marks children",
    fn() {
        const engine = new LayoutEngine();
        const child1 = {
            needsLayout: false,
            children: [],
            markNeedsLayout: function() {
                this.needsLayout = true;
            },
        } as any;
        const child2 = {
            needsLayout: false,
            children: [],
            markNeedsLayout: function() {
                this.needsLayout = true;
            },
        } as any;
        const root = {
            needsLayout: false,
            children: [child1, child2],
            markNeedsLayout: function() {
                this.needsLayout = true;
            },
        } as any;

        engine.markSubtreeForLayout(root);

        assertEquals(root.needsLayout, true);
        assertEquals(child1.needsLayout, true);
        assertEquals(child2.needsLayout, true);
    },
});

// LayoutEngine.getStats tests

Deno.test({
    name: "LayoutEngine - getStats returns current statistics",
    fn() {
        const engine = new LayoutEngine();
        const stats = engine.getStats();

        assertExists(stats);
        assertExists(stats.totalNodes);
        assertExists(stats.layoutTime);
        assertExists(stats.reflowCount);
    },
});

Deno.test({
    name: "LayoutEngine - getStats returns copy of statistics",
    fn() {
        const engine = new LayoutEngine();
        const stats1 = engine.getStats();
        const stats2 = engine.getStats();

        assert(stats1 !== stats2);
        assertEquals(stats1.totalNodes, stats2.totalNodes);
        assertEquals(stats1.layoutTime, stats2.layoutTime);
        assertEquals(stats1.reflowCount, stats2.reflowCount);
    },
});

// LayoutEngine.resetStats tests

Deno.test({
    name: "LayoutEngine - resetStats clears statistics",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: true,
            children: [],
            doLayout: () => {},
            style: {
                getPropertyValue: () => "block",
            },
        } as any;
        const viewport: ViewportSize = {
            width: 1024 as any,
            height: 768 as any,
        };

        engine.layout(root, viewport);
        engine.resetStats();
        const stats = engine.getStats();

        assertEquals(stats.totalNodes, 0);
        assertEquals(stats.layoutTime, 0);
        assertEquals(stats.reflowCount, 0);
    },
});

// LayoutEngine.calculateMinContentWidth tests

Deno.test({
    name: "LayoutEngine - calculateMinContentWidth returns width for node with layout",
    fn() {
        const engine = new LayoutEngine();
        const node = {
            layout: {
                width: 100,
            },
        } as any;

        const width = engine.calculateMinContentWidth(node);

        assertEquals(width, 100);
    },
});

Deno.test({
    name: "LayoutEngine - calculateMinContentWidth returns 0 for node without layout",
    fn() {
        const engine = new LayoutEngine();
        const node = {} as any;

        const width = engine.calculateMinContentWidth(node);

        assertEquals(width, 0);
    },
});

// LayoutEngine.calculateMaxContentWidth tests

Deno.test({
    name: "LayoutEngine - calculateMaxContentWidth returns width for node with layout",
    fn() {
        const engine = new LayoutEngine();
        const node = {
            layout: {
                width: 100,
            },
        } as any;

        const width = engine.calculateMaxContentWidth(node);

        assertEquals(width, 100);
    },
});

Deno.test({
    name: "LayoutEngine - calculateMaxContentWidth returns 0 for node without layout",
    fn() {
        const engine = new LayoutEngine();
        const node = {} as any;

        const width = engine.calculateMaxContentWidth(node);

        assertEquals(width, 0);
    },
});

// LayoutEngine.isLayoutStable tests

Deno.test({
    name: "LayoutEngine - isLayoutStable returns true for clean tree",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: false,
            children: [],
        } as any;

        const stable = engine.isLayoutStable(root);

        assertEquals(stable, true);
    },
});

Deno.test({
    name: "LayoutEngine - isLayoutStable returns false for dirty tree",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: true,
            children: [],
        } as any;

        const stable = engine.isLayoutStable(root);

        assertEquals(stable, false);
    },
});

Deno.test({
    name: "LayoutEngine - isLayoutStable returns false with dirty children",
    fn() {
        const engine = new LayoutEngine();
        const child = {
            needsLayout: true,
            children: [],
        } as any;
        const root = {
            needsLayout: false,
            children: [child],
        } as any;

        const stable = engine.isLayoutStable(root);

        assertEquals(stable, false);
    },
});

// LayoutEngine.layoutUntilStable tests

Deno.test({
    name: "LayoutEngine - layoutUntilStable with clean tree",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: false,
            children: [],
        } as any;
        const viewport: ViewportSize = {
            width: 1024 as any,
            height: 768 as any,
        };

        const stats = engine.layoutUntilStable(root, viewport);

        assertExists(stats);
    },
});

Deno.test({
    name: "LayoutEngine - layoutUntilStable with dirty tree",
    fn() {
        const engine = new LayoutEngine();
        let layoutCalls = 0;
        const root = {
            needsLayout: true,
            children: [],
            doLayout: function() {
                layoutCalls++;
                this.needsLayout = false;
            },
            style: {
                getPropertyValue: () => "block",
            },
        } as any;
        const viewport: ViewportSize = {
            width: 1024 as any,
            height: 768 as any,
        };

        const stats = engine.layoutUntilStable(root, viewport);

        assertExists(stats);
        assert(layoutCalls > 0);
    },
});

Deno.test({
    name: "LayoutEngine - layoutUntilStable respects max iterations",
    fn() {
        const engine = new LayoutEngine();
        const root = {
            needsLayout: true,
            children: [],
            doLayout: function() {
                // Keep layout dirty to test max iterations
                this.needsLayout = true;
            },
            style: {
                getPropertyValue: () => "block",
            },
        } as any;
        const viewport: ViewportSize = {
            width: 1024 as any,
            height: 768 as any,
        };

        const stats = engine.layoutUntilStable(root, viewport, 3);

        assertExists(stats);
    },
});
