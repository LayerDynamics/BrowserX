/**
 * Tests for Normal Flow Layout
 * Tests block and inline layout algorithms.
 */

import { assertEquals, assertExists } from "@std/assert";
import {
    NormalFlowLayout,
    FormattingContext,
} from "../../../../src/engine/rendering/layout/NormalFlowLayout.ts";

// FormattingContext enum tests

Deno.test({
    name: "FormattingContext - BLOCK value",
    fn() {
        assertEquals(FormattingContext.BLOCK, 0);
    },
});

Deno.test({
    name: "FormattingContext - INLINE value",
    fn() {
        assertEquals(FormattingContext.INLINE, 1);
    },
});

// NormalFlowLayout constructor tests

Deno.test({
    name: "NormalFlowLayout - constructor creates instance",
    fn() {
        const layout = new NormalFlowLayout();
        assertExists(layout);
    },
});

// Mock render objects for testing

function createMockRenderObject(props: any = {}): any {
    return {
        layout: props.layout || {
            x: 0,
            y: 0,
            width: 100,
            height: 50,
            marginTop: 0,
            marginRight: 0,
            marginBottom: 0,
            marginLeft: 0,
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            getTotalWidth: function() { return this.width + this.paddingLeft + this.paddingRight; },
            getTotalHeight: function() { return this.height + this.paddingTop + this.paddingBottom; },
        },
        style: {
            getPropertyValue: (prop: string) => props.styleValues?.[prop] || '',
        },
        doLayout: (constraints: any) => {},
        setPosition: (x: number, y: number) => {
            if (props.layout) {
                props.layout.x = x;
                props.layout.y = y;
            }
        },
        parent: props.parent || null,
        getPixelValue: (prop: string, defaultValue?: any) => defaultValue || 0,
        getText: () => props.text || '',
        constructor: { name: props.isText ? 'RenderText' : 'RenderBox' },
    };
}

function createMockRenderBox(props: any = {}): any {
    const mockLayout = {
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        marginTop: 0,
        marginRight: 0,
        marginBottom: 0,
        marginLeft: 0,
        paddingTop: 10,
        paddingRight: 10,
        paddingBottom: 10,
        paddingLeft: 10,
        getTotalWidth: function() {
            return this.width + this.marginLeft + this.marginRight + this.paddingLeft + this.paddingRight;
        },
        getTotalHeight: function() {
            return this.height + this.marginTop + this.marginBottom + this.paddingTop + this.paddingBottom;
        },
    };

    return {
        layout: mockLayout,
        style: {
            getPropertyValue: (prop: string) => props.styleValues?.[prop] || '',
        },
        doLayout: (constraints: any) => {},
        setPosition: (x: number, y: number) => {
            mockLayout.x = x;
            mockLayout.y = y;
        },
        parent: props.parent || null,
        children: props.children || [],
        getPixelValue: (prop: string, defaultValue?: any) => defaultValue || 0,
    };
}

// NormalFlowLayout.layoutBlockChildren tests

Deno.test({
    name: "NormalFlowLayout - layoutBlockChildren with no children",
    fn() {
        const layout = new NormalFlowLayout();
        const parent = createMockRenderBox();
        const children: any[] = [];
        const constraints = {
            minWidth: 0 as any,
            maxWidth: 500 as any,
            minHeight: 0 as any,
            maxHeight: 1000 as any,
        };

        const height = layout.layoutBlockChildren(parent, children, constraints);

        assertExists(height);
        assertEquals(height, 0);
    },
});

Deno.test({
    name: "NormalFlowLayout - layoutBlockChildren with single child",
    fn() {
        const layout = new NormalFlowLayout();
        const parent = createMockRenderBox();
        const child = createMockRenderObject();
        const children = [child];
        const constraints = {
            minWidth: 0 as any,
            maxWidth: 500 as any,
            minHeight: 0 as any,
            maxHeight: 1000 as any,
        };

        const height = layout.layoutBlockChildren(parent, children, constraints);

        assertExists(height);
    },
});

Deno.test({
    name: "NormalFlowLayout - layoutBlockChildren with multiple children",
    fn() {
        const layout = new NormalFlowLayout();
        const parent = createMockRenderBox();
        const child1 = createMockRenderObject();
        const child2 = createMockRenderObject();
        const child3 = createMockRenderObject();
        const children = [child1, child2, child3];
        const constraints = {
            minWidth: 0 as any,
            maxWidth: 500 as any,
            minHeight: 0 as any,
            maxHeight: 1000 as any,
        };

        const height = layout.layoutBlockChildren(parent, children, constraints);

        assertExists(height);
    },
});

// NormalFlowLayout.layoutInlineChildren tests

Deno.test({
    name: "NormalFlowLayout - layoutInlineChildren with no children",
    fn() {
        const layout = new NormalFlowLayout();
        const parent = createMockRenderBox();
        const children: any[] = [];
        const constraints = {
            minWidth: 0 as any,
            maxWidth: 500 as any,
            minHeight: 0 as any,
            maxHeight: 1000 as any,
        };

        const height = layout.layoutInlineChildren(parent, children, constraints);

        assertExists(height);
        assertEquals(height, 0);
    },
});

Deno.test({
    name: "NormalFlowLayout - layoutInlineChildren with single child",
    fn() {
        const layout = new NormalFlowLayout();
        const parent = createMockRenderBox();
        const child = createMockRenderObject();
        const children = [child];
        const constraints = {
            minWidth: 0 as any,
            maxWidth: 500 as any,
            minHeight: 0 as any,
            maxHeight: 1000 as any,
        };

        const height = layout.layoutInlineChildren(parent, children, constraints);

        assertExists(height);
    },
});

// NormalFlowLayout.getFormattingContext tests

Deno.test({
    name: "NormalFlowLayout - getFormattingContext for block display",
    fn() {
        const layout = new NormalFlowLayout();
        const renderObject = createMockRenderObject({
            styleValues: { display: 'block' },
        });

        const context = layout.getFormattingContext(renderObject);

        assertEquals(context, FormattingContext.BLOCK);
    },
});

Deno.test({
    name: "NormalFlowLayout - getFormattingContext for inline display",
    fn() {
        const layout = new NormalFlowLayout();
        const renderObject = createMockRenderObject({
            styleValues: { display: 'inline' },
        });

        const context = layout.getFormattingContext(renderObject);

        assertEquals(context, FormattingContext.INLINE);
    },
});

Deno.test({
    name: "NormalFlowLayout - getFormattingContext for flex display",
    fn() {
        const layout = new NormalFlowLayout();
        const renderObject = createMockRenderObject({
            styleValues: { display: 'flex' },
        });

        const context = layout.getFormattingContext(renderObject);

        assertEquals(context, FormattingContext.BLOCK);
    },
});

Deno.test({
    name: "NormalFlowLayout - getFormattingContext for inline-block display",
    fn() {
        const layout = new NormalFlowLayout();
        const renderObject = createMockRenderObject({
            styleValues: { display: 'inline-block' },
        });

        const context = layout.getFormattingContext(renderObject);

        assertEquals(context, FormattingContext.INLINE);
    },
});

Deno.test({
    name: "NormalFlowLayout - getFormattingContext for grid display",
    fn() {
        const layout = new NormalFlowLayout();
        const renderObject = createMockRenderObject({
            styleValues: { display: 'grid' },
        });

        const context = layout.getFormattingContext(renderObject);

        assertEquals(context, FormattingContext.BLOCK);
    },
});

// NormalFlowLayout.establishesBlockFormattingContext tests

Deno.test({
    name: "NormalFlowLayout - establishesBlockFormattingContext for root element",
    fn() {
        const layout = new NormalFlowLayout();
        const renderObject = createMockRenderObject({ parent: null });

        const establishes = layout.establishesBlockFormattingContext(renderObject);

        assertEquals(establishes, true);
    },
});

Deno.test({
    name: "NormalFlowLayout - establishesBlockFormattingContext for inline-block",
    fn() {
        const parent = createMockRenderObject();
        const layout = new NormalFlowLayout();
        const renderObject = createMockRenderObject({
            parent,
            styleValues: { display: 'inline-block' },
        });

        const establishes = layout.establishesBlockFormattingContext(renderObject);

        assertEquals(establishes, true);
    },
});

Deno.test({
    name: "NormalFlowLayout - establishesBlockFormattingContext for absolute positioning",
    fn() {
        const parent = createMockRenderObject();
        const layout = new NormalFlowLayout();
        const renderObject = createMockRenderObject({
            parent,
            styleValues: { position: 'absolute' },
        });

        const establishes = layout.establishesBlockFormattingContext(renderObject);

        assertEquals(establishes, true);
    },
});

Deno.test({
    name: "NormalFlowLayout - establishesBlockFormattingContext for floats",
    fn() {
        const parent = createMockRenderObject();
        const layout = new NormalFlowLayout();
        const renderObject = createMockRenderObject({
            parent,
            styleValues: { float: 'left' },
        });

        const establishes = layout.establishesBlockFormattingContext(renderObject);

        assertEquals(establishes, true);
    },
});

Deno.test({
    name: "NormalFlowLayout - establishesBlockFormattingContext for overflow hidden",
    fn() {
        const parent = createMockRenderObject();
        const layout = new NormalFlowLayout();
        const renderObject = createMockRenderObject({
            parent,
            styleValues: { overflow: 'hidden' },
        });

        const establishes = layout.establishesBlockFormattingContext(renderObject);

        assertEquals(establishes, true);
    },
});

Deno.test({
    name: "NormalFlowLayout - establishesBlockFormattingContext for flow-root",
    fn() {
        const parent = createMockRenderObject();
        const layout = new NormalFlowLayout();
        const renderObject = createMockRenderObject({
            parent,
            styleValues: { display: 'flow-root' },
        });

        const establishes = layout.establishesBlockFormattingContext(renderObject);

        assertEquals(establishes, true);
    },
});

// NormalFlowLayout.collapseMargins tests

Deno.test({
    name: "NormalFlowLayout - collapseMargins with two positive margins",
    fn() {
        const layout = new NormalFlowLayout();
        const collapsed = layout.collapseMargins(10 as any, 20 as any);

        assertEquals(collapsed, 20);
    },
});

Deno.test({
    name: "NormalFlowLayout - collapseMargins with equal positive margins",
    fn() {
        const layout = new NormalFlowLayout();
        const collapsed = layout.collapseMargins(15 as any, 15 as any);

        assertEquals(collapsed, 15);
    },
});

Deno.test({
    name: "NormalFlowLayout - collapseMargins with two negative margins",
    fn() {
        const layout = new NormalFlowLayout();
        const collapsed = layout.collapseMargins(-10 as any, -20 as any);

        assertEquals(collapsed, -20);
    },
});

Deno.test({
    name: "NormalFlowLayout - collapseMargins with positive and negative margins",
    fn() {
        const layout = new NormalFlowLayout();
        const collapsed = layout.collapseMargins(10 as any, -5 as any);

        assertEquals(collapsed, 5);
    },
});

Deno.test({
    name: "NormalFlowLayout - collapseMargins with zero margins",
    fn() {
        const layout = new NormalFlowLayout();
        const collapsed = layout.collapseMargins(0 as any, 0 as any);

        assertEquals(collapsed, 0);
    },
});

// NormalFlowLayout.calculateShrinkToFitWidth tests

Deno.test({
    name: "NormalFlowLayout - calculateShrinkToFitWidth",
    fn() {
        const layout = new NormalFlowLayout();
        const renderObject = createMockRenderObject();
        const width = layout.calculateShrinkToFitWidth(renderObject, 300 as any);

        assertExists(width);
        assertEquals(width, 300);
    },
});

// Integration tests

Deno.test({
    name: "NormalFlowLayout - layout block children stacks vertically",
    fn() {
        const layout = new NormalFlowLayout();
        const parent = createMockRenderBox();
        const child1 = createMockRenderObject({ layout: {
            x: 0, y: 0, width: 100, height: 50,
            marginTop: 10, marginRight: 0, marginBottom: 10, marginLeft: 0,
            paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
            getTotalWidth: function() { return this.width; },
            getTotalHeight: function() { return this.height + this.marginTop + this.marginBottom; },
        }});
        const child2 = createMockRenderObject({ layout: {
            x: 0, y: 0, width: 100, height: 50,
            marginTop: 10, marginRight: 0, marginBottom: 10, marginLeft: 0,
            paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
            getTotalWidth: function() { return this.width; },
            getTotalHeight: function() { return this.height + this.marginTop + this.marginBottom; },
        }});
        const children = [child1, child2];
        const constraints = {
            minWidth: 0 as any,
            maxWidth: 500 as any,
            minHeight: 0 as any,
            maxHeight: 1000 as any,
        };

        const height = layout.layoutBlockChildren(parent, children, constraints);

        assertExists(height);
    },
});
