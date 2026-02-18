/**
 * Comprehensive tests for RenderObject base class
 */

import { assertEquals, assertExists, assertStrictEquals } from "@std/assert";
import { RenderObject } from "../../../../src/engine/rendering/rendering/RenderObject.ts";
import type { DOMElement } from "../../../../src/types/dom.ts";
import type { ComputedStyle } from "../../../../src/types/css.ts";
import type { LayoutConstraints, PaintContext } from "../../../../src/types/rendering.ts";
import type { Pixels } from "../../../../src/types/identifiers.ts";

// ============================================================================
// Mock Classes for Testing
// ============================================================================

/**
 * Mock DOMElement for testing
 */
function createMockElement(
    tagName: string,
    id?: string,
    className?: string
): DOMElement {
    return {
        nodeId: "node-1" as any,
        nodeType: 1 as any,
        nodeName: tagName.toUpperCase(),
        nodeValue: null,
        tagName: tagName.toUpperCase(),
        parentNode: null,
        parentElement: null,
        childNodes: [],
        firstChild: null,
        lastChild: null,
        previousSibling: null,
        nextSibling: null,
        previousElementSibling: null,
        nextElementSibling: null,
        ownerDocument: null,
        attributes: new Map(
            Object.entries({
                ...(id ? { id } : {}),
                ...(className ? { class: className } : {}),
            })
        ),
        id: id || "",
        className: className || "",
        classList: null as any,
        getAttribute: (name: string) => null,
        setAttribute: () => {},
        removeAttribute: () => {},
        hasAttribute: () => false,
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementsByTagName: () => [],
        getElementsByClassName: () => [],
        matches: () => false,
        closest: () => null,
        cloneNode: () => null as any,
        appendChild: () => null as any,
        removeChild: () => null as any,
        insertBefore: () => null as any,
        replaceChild: () => null as any,
        contains: () => false,
        compareDocumentPosition: () => 0,
    } as DOMElement;
}

/**
 * Mock ComputedStyle for testing
 */
function createMockStyle(properties: Record<string, string> = {}): ComputedStyle {
    const propMap = new Map(Object.entries(properties));
    return {
        properties: propMap,
        getPropertyValue: (property: string) => propMap.get(property) || "",
        setProperty: (property: string, value: string) => {
            propMap.set(property, value);
        },
        removeProperty: (property: string) => {
            propMap.delete(property);
        },
        getPropertyNames: () => Array.from(propMap.keys()),
    } as ComputedStyle;
}

/**
 * Concrete implementation of RenderObject for testing
 */
class TestRenderObject extends RenderObject {
    doLayout(_constraints: LayoutConstraints): void {
        this.needsLayout = false;
        this.layout = {
            x: 0 as Pixels,
            y: 0 as Pixels,
            width: 100 as Pixels,
            height: 50 as Pixels,
            paddingTop: 0 as Pixels,
            paddingRight: 0 as Pixels,
            paddingBottom: 0 as Pixels,
            paddingLeft: 0 as Pixels,
            borderTopWidth: 0 as Pixels,
            borderRightWidth: 0 as Pixels,
            borderBottomWidth: 0 as Pixels,
            borderLeftWidth: 0 as Pixels,
            marginTop: 0 as Pixels,
            marginRight: 0 as Pixels,
            marginBottom: 0 as Pixels,
            marginLeft: 0 as Pixels,
            getContentBox: () => ({ x: 0 as Pixels, y: 0 as Pixels, width: 100 as Pixels, height: 50 as Pixels }),
            getPaddingBox: () => ({ x: 0 as Pixels, y: 0 as Pixels, width: 100 as Pixels, height: 50 as Pixels }),
            getBorderBox: () => ({ x: 0 as Pixels, y: 0 as Pixels, width: 100 as Pixels, height: 50 as Pixels }),
            getMarginBox: () => ({ x: 0 as Pixels, y: 0 as Pixels, width: 100 as Pixels, height: 50 as Pixels }),
            getTotalWidth: () => 100 as Pixels,
            getTotalHeight: () => 50 as Pixels,
        };
    }

    paint(_context: PaintContext): void {
        this.needsPaint = false;
    }

    setPosition(x: Pixels, y: Pixels): void {
        if (this.layout) {
            this.layout.x = x;
            this.layout.y = y;
        }
    }
}

// ============================================================================
// Tests: Creation and Basic Properties
// ============================================================================

Deno.test("RenderObject - creates with element and style", () => {
    const element = createMockElement("div");
    const style = createMockStyle();
    const obj = new TestRenderObject(element, style);

    assertExists(obj.id);
    assertStrictEquals(obj.element, element);
    assertStrictEquals(obj.style, style);
});

Deno.test("RenderObject - starts with needsLayout and needsPaint true", () => {
    const element = createMockElement("div");
    const style = createMockStyle();
    const obj = new TestRenderObject(element, style);

    assertEquals(obj.needsLayout, true);
    assertEquals(obj.needsPaint, true);
});

Deno.test("RenderObject - starts with null parent and empty children", () => {
    const element = createMockElement("div");
    const style = createMockStyle();
    const obj = new TestRenderObject(element, style);

    assertEquals(obj.parent, null);
    assertEquals(obj.children.length, 0);
    assertEquals(obj.nextSibling, null);
});

Deno.test("RenderObject - assigns unique IDs to each instance", () => {
    const element = createMockElement("div");
    const style = createMockStyle();
    const obj1 = new TestRenderObject(element, style);
    const obj2 = new TestRenderObject(element, style);
    const obj3 = new TestRenderObject(element, style);

    // IDs should be unique
    assertEquals(obj1.id !== obj2.id, true);
    assertEquals(obj2.id !== obj3.id, true);
    assertEquals(obj1.id !== obj3.id, true);
});

// ============================================================================
// Tests: Parent-Child Relationships
// ============================================================================

Deno.test("RenderObject - appendChild sets parent and adds to children", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child = new TestRenderObject(createMockElement("span"), createMockStyle());

    parent.appendChild(child);

    assertStrictEquals(child.parent, parent);
    assertEquals(parent.children.length, 1);
    assertStrictEquals(parent.children[0], child);
});

Deno.test("RenderObject - appendChild marks parent as needsLayout", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
    parent.needsLayout = false;

    const child = new TestRenderObject(createMockElement("span"), createMockStyle());
    parent.appendChild(child);

    assertEquals(parent.needsLayout, true);
});

Deno.test("RenderObject - appendChild sets sibling links correctly", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child1 = new TestRenderObject(createMockElement("span"), createMockStyle());
    const child2 = new TestRenderObject(createMockElement("span"), createMockStyle());
    const child3 = new TestRenderObject(createMockElement("span"), createMockStyle());

    parent.appendChild(child1);
    parent.appendChild(child2);
    parent.appendChild(child3);

    assertStrictEquals(child1.nextSibling, child2);
    assertStrictEquals(child2.nextSibling, child3);
    assertEquals(child3.nextSibling, null);
});

Deno.test("RenderObject - removeChild removes from children and clears parent", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child = new TestRenderObject(createMockElement("span"), createMockStyle());

    parent.appendChild(child);
    parent.removeChild(child);

    assertEquals(child.parent, null);
    assertEquals(parent.children.length, 0);
});

Deno.test("RenderObject - removeChild marks parent as needsLayout", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child = new TestRenderObject(createMockElement("span"), createMockStyle());

    parent.appendChild(child);
    parent.needsLayout = false;

    parent.removeChild(child);

    assertEquals(parent.needsLayout, true);
});

Deno.test("RenderObject - removeChild updates sibling links", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child1 = new TestRenderObject(createMockElement("span"), createMockStyle());
    const child2 = new TestRenderObject(createMockElement("span"), createMockStyle());
    const child3 = new TestRenderObject(createMockElement("span"), createMockStyle());

    parent.appendChild(child1);
    parent.appendChild(child2);
    parent.appendChild(child3);

    parent.removeChild(child2);

    assertStrictEquals(child1.nextSibling, child3);
    assertEquals(parent.children.length, 2);
    assertStrictEquals(parent.children[0], child1);
    assertStrictEquals(parent.children[1], child3);
});

Deno.test("RenderObject - removeChild ignores non-existent child", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child = new TestRenderObject(createMockElement("span"), createMockStyle());
    const otherChild = new TestRenderObject(createMockElement("span"), createMockStyle());

    parent.appendChild(child);
    parent.removeChild(otherChild); // Should not throw

    assertEquals(parent.children.length, 1);
});

Deno.test("RenderObject - insertBefore inserts at correct position", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child1 = new TestRenderObject(createMockElement("span"), createMockStyle());
    const child2 = new TestRenderObject(createMockElement("span"), createMockStyle());
    const newChild = new TestRenderObject(createMockElement("span"), createMockStyle());

    parent.appendChild(child1);
    parent.appendChild(child2);
    parent.insertBefore(newChild, child2);

    assertEquals(parent.children.length, 3);
    assertStrictEquals(parent.children[0], child1);
    assertStrictEquals(parent.children[1], newChild);
    assertStrictEquals(parent.children[2], child2);
});

Deno.test("RenderObject - insertBefore updates sibling links", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child1 = new TestRenderObject(createMockElement("span"), createMockStyle());
    const child2 = new TestRenderObject(createMockElement("span"), createMockStyle());
    const newChild = new TestRenderObject(createMockElement("span"), createMockStyle());

    parent.appendChild(child1);
    parent.appendChild(child2);
    parent.insertBefore(newChild, child2);

    assertStrictEquals(child1.nextSibling, newChild);
    assertStrictEquals(newChild.nextSibling, child2);
});

Deno.test("RenderObject - insertBefore with null reference appends", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child = new TestRenderObject(createMockElement("span"), createMockStyle());
    const newChild = new TestRenderObject(createMockElement("span"), createMockStyle());

    parent.appendChild(child);
    parent.insertBefore(newChild, null);

    assertEquals(parent.children.length, 2);
    assertStrictEquals(parent.children[1], newChild);
});

// ============================================================================
// Tests: Dirty Bit Propagation
// ============================================================================

Deno.test("RenderObject - markNeedsLayout propagates to ancestors", () => {
    const root = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child = new TestRenderObject(createMockElement("div"), createMockStyle());
    const grandchild = new TestRenderObject(createMockElement("span"), createMockStyle());

    root.appendChild(child);
    child.appendChild(grandchild);

    // Clear dirty bits
    root.needsLayout = false;
    child.needsLayout = false;
    grandchild.needsLayout = false;

    grandchild.markNeedsLayout();

    assertEquals(grandchild.needsLayout, true);
    assertEquals(child.needsLayout, true);
    assertEquals(root.needsLayout, true);
});

Deno.test("RenderObject - markNeedsLayout idempotent", () => {
    const root = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child = new TestRenderObject(createMockElement("div"), createMockStyle());

    root.appendChild(child);
    root.needsLayout = false;
    child.needsLayout = true;

    child.markNeedsLayout(); // Already marked, should not propagate

    assertEquals(child.needsLayout, true);
    assertEquals(root.needsLayout, false); // Should not propagate
});

Deno.test("RenderObject - markNeedsPaint does not propagate", () => {
    const root = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child = new TestRenderObject(createMockElement("div"), createMockStyle());

    root.appendChild(child);
    root.needsPaint = false;
    child.needsPaint = false;

    child.markNeedsPaint();

    assertEquals(child.needsPaint, true);
    assertEquals(root.needsPaint, false); // Should NOT propagate
});

Deno.test("RenderObject - markNeedsPaint idempotent", () => {
    const obj = new TestRenderObject(createMockElement("div"), createMockStyle());
    obj.needsPaint = true;

    obj.markNeedsPaint(); // Already marked

    assertEquals(obj.needsPaint, true);
});

// ============================================================================
// Tests: First/Last Child
// ============================================================================

Deno.test("RenderObject - firstChild returns first child", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child1 = new TestRenderObject(createMockElement("span"), createMockStyle());
    const child2 = new TestRenderObject(createMockElement("span"), createMockStyle());

    parent.appendChild(child1);
    parent.appendChild(child2);

    assertStrictEquals(parent.firstChild, child1);
});

Deno.test("RenderObject - firstChild returns null for empty", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());

    assertEquals(parent.firstChild, null);
});

Deno.test("RenderObject - lastChild returns last child", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child1 = new TestRenderObject(createMockElement("span"), createMockStyle());
    const child2 = new TestRenderObject(createMockElement("span"), createMockStyle());

    parent.appendChild(child1);
    parent.appendChild(child2);

    assertStrictEquals(parent.lastChild, child2);
});

Deno.test("RenderObject - lastChild returns null for empty", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());

    assertEquals(parent.lastChild, null);
});

// ============================================================================
// Tests: Display Type Checking
// ============================================================================

Deno.test("RenderObject - isBlock returns true for block display", () => {
    const style = createMockStyle({ display: "block" });
    const obj = new TestRenderObject(createMockElement("div"), style);

    assertEquals(obj.isBlock(), true);
});

Deno.test("RenderObject - isBlock returns true for flex display", () => {
    const style = createMockStyle({ display: "flex" });
    const obj = new TestRenderObject(createMockElement("div"), style);

    assertEquals(obj.isBlock(), true);
});

Deno.test("RenderObject - isBlock returns false for inline display", () => {
    const style = createMockStyle({ display: "inline" });
    const obj = new TestRenderObject(createMockElement("span"), style);

    assertEquals(obj.isBlock(), false);
});

Deno.test("RenderObject - isInline returns true for inline display", () => {
    const style = createMockStyle({ display: "inline" });
    const obj = new TestRenderObject(createMockElement("span"), style);

    assertEquals(obj.isInline(), true);
});

Deno.test("RenderObject - isInline returns true for inline-block", () => {
    const style = createMockStyle({ display: "inline-block" });
    const obj = new TestRenderObject(createMockElement("span"), style);

    assertEquals(obj.isInline(), true);
});

Deno.test("RenderObject - isInline returns false for block display", () => {
    const style = createMockStyle({ display: "block" });
    const obj = new TestRenderObject(createMockElement("div"), style);

    assertEquals(obj.isInline(), false);
});

// ============================================================================
// Tests: Replaced Element Detection
// ============================================================================

Deno.test("RenderObject - isReplaced returns true for img", () => {
    const element = createMockElement("img");
    const obj = new TestRenderObject(element, createMockStyle());

    assertEquals(obj.isReplaced(), true);
});

Deno.test("RenderObject - isReplaced returns true for video", () => {
    const element = createMockElement("video");
    const obj = new TestRenderObject(element, createMockStyle());

    assertEquals(obj.isReplaced(), true);
});

Deno.test("RenderObject - isReplaced returns false for div", () => {
    const element = createMockElement("div");
    const obj = new TestRenderObject(element, createMockStyle());

    assertEquals(obj.isReplaced(), false);
});

// ============================================================================
// Tests: Stacking Context
// ============================================================================

Deno.test("RenderObject - createsStackingContext for positioned with z-index", () => {
    const style = createMockStyle({ position: "absolute", "z-index": "10" });
    const obj = new TestRenderObject(createMockElement("div"), style);

    assertEquals(obj.createsStackingContext(), true);
});

Deno.test("RenderObject - createsStackingContext for opacity < 1", () => {
    const style = createMockStyle({ opacity: "0.5" });
    const obj = new TestRenderObject(createMockElement("div"), style);

    assertEquals(obj.createsStackingContext(), true);
});

Deno.test("RenderObject - createsStackingContext for transform", () => {
    const style = createMockStyle({ transform: "translateX(10px)" });
    const obj = new TestRenderObject(createMockElement("div"), style);

    assertEquals(obj.createsStackingContext(), true);
});

Deno.test("RenderObject - createsStackingContext for root (no parent)", () => {
    const obj = new TestRenderObject(createMockElement("div"), createMockStyle());

    assertEquals(obj.createsStackingContext(), true);
});

Deno.test("RenderObject - no stacking context for static positioned", () => {
    const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
    const style = createMockStyle({ position: "static" });
    const child = new TestRenderObject(createMockElement("div"), style);
    parent.appendChild(child);

    assertEquals(child.createsStackingContext(), false);
});

// ============================================================================
// Tests: Pixel Value Parsing
// ============================================================================

Deno.test("RenderObject - getPixelValue parses px values", () => {
    const style = createMockStyle({ width: "100px" });
    const obj = new TestRenderObject(createMockElement("div"), style);

    assertEquals(obj.getPixelValue("width"), 100);
});

Deno.test("RenderObject - getPixelValue returns default for auto", () => {
    const style = createMockStyle({ width: "auto" });
    const obj = new TestRenderObject(createMockElement("div"), style);

    assertEquals(obj.getPixelValue("width", 50 as Pixels), 50);
});

Deno.test("RenderObject - getPixelValue returns default for missing property", () => {
    const style = createMockStyle({});
    const obj = new TestRenderObject(createMockElement("div"), style);

    assertEquals(obj.getPixelValue("width", 42 as Pixels), 42);
});

Deno.test("RenderObject - getPixelValue parses numeric strings", () => {
    const style = createMockStyle({ opacity: "0.5" });
    const obj = new TestRenderObject(createMockElement("div"), style);

    assertEquals(obj.getPixelValue("opacity"), 0.5);
});

Deno.test("RenderObject - getPixelValue returns default for percentage", () => {
    const style = createMockStyle({ width: "50%" });
    const obj = new TestRenderObject(createMockElement("div"), style);

    // Percentage not implemented yet, should return default
    assertEquals(obj.getPixelValue("width", 100 as Pixels), 100);
});

// ============================================================================
// Tests: Tree Traversal
// ============================================================================

Deno.test("RenderObject - visitChildren visits all descendants", () => {
    const root = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child1 = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child2 = new TestRenderObject(createMockElement("div"), createMockStyle());
    const grandchild = new TestRenderObject(createMockElement("span"), createMockStyle());

    root.appendChild(child1);
    root.appendChild(child2);
    child1.appendChild(grandchild);

    const visited: RenderObject[] = [];
    root.visitChildren((obj) => visited.push(obj));

    assertEquals(visited.length, 3);
    assertEquals(visited.includes(child1), true);
    assertEquals(visited.includes(child2), true);
    assertEquals(visited.includes(grandchild), true);
});

Deno.test("RenderObject - findAncestor finds matching ancestor", () => {
    const root = new TestRenderObject(createMockElement("div"), createMockStyle());
    root.element.id = "root";
    const child = new TestRenderObject(createMockElement("div"), createMockStyle());
    const grandchild = new TestRenderObject(createMockElement("span"), createMockStyle());

    root.appendChild(child);
    child.appendChild(grandchild);

    const found = grandchild.findAncestor((obj) => obj.element.id === "root");

    assertStrictEquals(found, root);
});

Deno.test("RenderObject - findAncestor returns null if not found", () => {
    const root = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child = new TestRenderObject(createMockElement("div"), createMockStyle());

    root.appendChild(child);

    const found = child.findAncestor((obj) => obj.element.id === "nonexistent");

    assertEquals(found, null);
});

Deno.test("RenderObject - getDepth returns 0 for root", () => {
    const root = new TestRenderObject(createMockElement("div"), createMockStyle());

    assertEquals(root.getDepth(), 0);
});

Deno.test("RenderObject - getDepth returns correct depth", () => {
    const root = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child = new TestRenderObject(createMockElement("div"), createMockStyle());
    const grandchild = new TestRenderObject(createMockElement("span"), createMockStyle());

    root.appendChild(child);
    child.appendChild(grandchild);

    assertEquals(child.getDepth(), 1);
    assertEquals(grandchild.getDepth(), 2);
});

Deno.test("RenderObject - isAncestorOf returns true for descendant", () => {
    const root = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child = new TestRenderObject(createMockElement("div"), createMockStyle());
    const grandchild = new TestRenderObject(createMockElement("span"), createMockStyle());

    root.appendChild(child);
    child.appendChild(grandchild);

    assertEquals(root.isAncestorOf(grandchild), true);
    assertEquals(child.isAncestorOf(grandchild), true);
});

Deno.test("RenderObject - isAncestorOf returns false for non-descendant", () => {
    const obj1 = new TestRenderObject(createMockElement("div"), createMockStyle());
    const obj2 = new TestRenderObject(createMockElement("div"), createMockStyle());

    assertEquals(obj1.isAncestorOf(obj2), false);
});

Deno.test("RenderObject - isAncestorOf returns false for self", () => {
    const obj = new TestRenderObject(createMockElement("div"), createMockStyle());

    assertEquals(obj.isAncestorOf(obj), false);
});

// ============================================================================
// Tests: Debug Methods
// ============================================================================

Deno.test("RenderObject - toString includes tag name", () => {
    const element = createMockElement("div");
    const obj = new TestRenderObject(element, createMockStyle());

    const str = obj.toString();

    assertEquals(str.includes("DIV"), true);
});

Deno.test("RenderObject - toString includes id", () => {
    const element = createMockElement("div", "myid");
    const obj = new TestRenderObject(element, createMockStyle());

    const str = obj.toString();

    assertEquals(str.includes("#myid"), true);
});

Deno.test("RenderObject - toString includes class", () => {
    const element = createMockElement("div", undefined, "class1 class2");
    const obj = new TestRenderObject(element, createMockStyle());

    const str = obj.toString();

    assertEquals(str.includes(".class1.class2"), true);
});

Deno.test("RenderObject - debugTree shows hierarchy", () => {
    const root = new TestRenderObject(createMockElement("div"), createMockStyle());
    const child = new TestRenderObject(createMockElement("span"), createMockStyle());

    root.appendChild(child);

    const tree = root.debugTree();

    assertEquals(tree.includes("DIV"), true);
    assertEquals(tree.includes("SPAN"), true);
});
