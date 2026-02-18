/**
 * Comprehensive tests for RenderTreeBuilder
 * Tests DOM→RenderTree conversion with various display properties,
 * positioning, floats, flexbox, text nodes, and edge cases.
 */

import { assertEquals, assertExists, assertStrictEquals } from "@std/assert";
import { RenderTreeBuilder } from "../../../../src/engine/rendering/rendering/RenderTreeBuilder.ts";
import { StyleResolver } from "../../../../src/engine/rendering/css-parser/StyleResolver.ts";
import { CSSOM } from "../../../../src/engine/rendering/css-parser/CSSOM.ts";
import { RenderBlock } from "../../../../src/engine/rendering/rendering/RenderBlock.ts";
import { RenderInline } from "../../../../src/engine/rendering/rendering/RenderInline.ts";
import { RenderText } from "../../../../src/engine/rendering/rendering/RenderText.ts";
import { RenderReplaced } from "../../../../src/engine/rendering/rendering/RenderReplaced.ts";
import type { DOMElement, DOMNode, DOMNodeType } from "../../../../src/types/dom.ts";
import type { ComputedStyle } from "../../../../src/types/css.ts";

// ============================================================================
// Mock Classes for Testing
// ============================================================================

/**
 * Mock DOMElement for testing
 */
function createMockElement(
    tagName: string,
    id?: string,
    className?: string,
    styleProps: Record<string, string> = {}
): DOMElement {
    const element = {
        nodeId: "node-" + Math.random() as any,
        nodeType: 1 as DOMNodeType,
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
                ...(Object.keys(styleProps).length > 0 ? {
                    style: Object.entries(styleProps).map(([k, v]) => `${k}:${v}`).join(";")
                } : {}),
            })
        ),
        id: id || "",
        className: className || "",
        classList: null as any,
        style: styleProps,
        getAttribute: (name: string) => {
            if (name === "style") {
                return Object.entries(styleProps).map(([k, v]) => `${k}:${v}`).join(";");
            }
            return null;
        },
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
        appendChild: function(child: DOMNode) {
            this.childNodes.push(child);
            child.parentNode = this;
            if (this.childNodes.length === 1) {
                this.firstChild = child;
            }
            this.lastChild = child;

            // Update sibling links
            if (this.childNodes.length > 1) {
                const prevChild = this.childNodes[this.childNodes.length - 2];
                prevChild.nextSibling = child;
                child.previousSibling = prevChild;
            }
            return child;
        },
        removeChild: () => null as any,
        insertBefore: () => null as any,
        replaceChild: () => null as any,
        contains: () => false,
        compareDocumentPosition: () => 0,
    } as DOMElement;

    return element;
}

/**
 * Create a text node
 */
function createTextNode(text: string, parent?: DOMElement): DOMNode {
    return {
        nodeId: "text-" + Math.random() as any,
        nodeType: 3 as DOMNodeType, // TEXT_NODE
        nodeName: "#text",
        nodeValue: text,
        parentNode: parent || null,
        childNodes: [],
        firstChild: null,
        lastChild: null,
        previousSibling: null,
        nextSibling: null,
        ownerDocument: null,
        cloneNode: () => null as any,
        appendChild: () => null as any,
        removeChild: () => null as any,
        insertBefore: () => null as any,
        replaceChild: () => null as any,
        contains: () => false,
        compareDocumentPosition: () => 0,
    } as DOMNode;
}

/**
 * Mock StyleResolver that returns styles based on element's style property
 */
class MockStyleResolver extends StyleResolver {
    override resolve(element: DOMElement): ComputedStyle {
        const props = (element as any).style || {};
        const propMap = new Map(Object.entries(props));

        // Set defaults for common properties
        if (!propMap.has("display")) {
            // Default display based on tag name
            const tagName = element.tagName?.toLowerCase();
            if (tagName === "div" || tagName === "p" || tagName === "body" || tagName === "html") {
                propMap.set("display", "block");
            } else if (tagName === "span" || tagName === "a") {
                propMap.set("display", "inline");
            } else {
                propMap.set("display", "block");
            }
        }

        if (!propMap.has("visibility")) {
            propMap.set("visibility", "visible");
        }

        if (!propMap.has("position")) {
            propMap.set("position", "static");
        }

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
}

/**
 * Helper to find a node in render tree
 */
function findInTree(tree: any, predicate: (obj: any) => boolean): any {
    if (!tree) return null;
    if (predicate(tree)) return tree;

    for (const child of tree.children || []) {
        const found = findInTree(child, predicate);
        if (found) return found;
    }

    return null;
}

/**
 * Helper to count nodes in tree
 */
function countNodesInTree(tree: any): number {
    if (!tree) return 0;
    let count = 1;
    for (const child of tree.children || []) {
        count += countNodesInTree(child);
    }
    return count;
}

// ============================================================================
// Tests: Basic Conversion
// ============================================================================

Deno.test("RenderTreeBuilder - converts simple DOM to RenderTree", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div");
    const renderTree = builder.build(div);

    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderBlock, true);
    assertStrictEquals((renderTree as any).element, div);
});

Deno.test("RenderTreeBuilder - handles nested elements", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const outer = createMockElement("div");
    const inner = createMockElement("span");
    outer.appendChild(inner);

    const renderTree = builder.build(outer);

    assertExists(renderTree);
    assertEquals(renderTree.children.length, 1);
    assertStrictEquals((renderTree.children[0] as any).element, inner);
});

Deno.test("RenderTreeBuilder - handles deeply nested elements", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const level1 = createMockElement("div");
    const level2 = createMockElement("div");
    const level3 = createMockElement("div");
    const level4 = createMockElement("span");

    level1.appendChild(level2);
    level2.appendChild(level3);
    level3.appendChild(level4);

    const renderTree = builder.build(level1);

    assertExists(renderTree);
    const level4Render = findInTree(renderTree, (obj: any) => obj.element === level4);
    assertExists(level4Render);
});

Deno.test("RenderTreeBuilder - preserves hierarchy", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const parent = createMockElement("div");
    const child1 = createMockElement("div");
    const child2 = createMockElement("div");

    parent.appendChild(child1);
    parent.appendChild(child2);

    const renderTree = builder.build(parent);

    assertExists(renderTree);
    assertEquals(renderTree.children.length, 2);
    assertStrictEquals((renderTree.children[0] as any).element, child1);
    assertStrictEquals((renderTree.children[1] as any).element, child2);
});

// ============================================================================
// Tests: Display Properties
// ============================================================================

Deno.test("RenderTreeBuilder - excludes display:none elements", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const parent = createMockElement("div");
    const hidden = createMockElement("div", undefined, undefined, { display: "none" });
    const visible = createMockElement("div");

    parent.appendChild(hidden);
    parent.appendChild(visible);

    const renderTree = builder.build(parent);

    assertExists(renderTree);
    // Should only have 1 child (the visible one)
    assertEquals(renderTree.children.length, 1);
    assertStrictEquals((renderTree.children[0] as any).element, visible);
});

Deno.test("RenderTreeBuilder - creates RenderBlock for display:block", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div", undefined, undefined, { display: "block" });

    const renderTree = builder.build(div);

    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderBlock, true);
});

Deno.test("RenderTreeBuilder - creates RenderBlock for display:flex", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div", undefined, undefined, { display: "flex" });

    const renderTree = builder.build(div);

    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderBlock, true);
});

Deno.test("RenderTreeBuilder - creates RenderBlock for display:grid", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div", undefined, undefined, { display: "grid" });

    const renderTree = builder.build(div);

    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderBlock, true);
});

Deno.test("RenderTreeBuilder - creates RenderInline for display:inline", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const span = createMockElement("span", undefined, undefined, { display: "inline" });

    const renderTree = builder.build(span);

    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderInline, true);
});

Deno.test("RenderTreeBuilder - creates RenderInline for display:inline-block", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const span = createMockElement("span", undefined, undefined, { display: "inline-block" });

    const renderTree = builder.build(span);

    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderInline, true);
});

Deno.test("RenderTreeBuilder - creates RenderInline for display:inline-flex", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div", undefined, undefined, { display: "inline-flex" });

    const renderTree = builder.build(div);

    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderInline, true);
});

// ============================================================================
// Tests: Replaced Elements
// ============================================================================

Deno.test("RenderTreeBuilder - creates RenderReplaced for img", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const img = createMockElement("img");

    const renderTree = builder.build(img);

    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderReplaced, true);
});

Deno.test("RenderTreeBuilder - creates RenderReplaced for video", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const video = createMockElement("video");

    const renderTree = builder.build(video);

    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderReplaced, true);
});

Deno.test("RenderTreeBuilder - creates RenderReplaced for canvas", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const canvas = createMockElement("canvas");

    const renderTree = builder.build(canvas);

    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderReplaced, true);
});

Deno.test("RenderTreeBuilder - creates RenderReplaced for input", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const input = createMockElement("input");

    const renderTree = builder.build(input);

    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderReplaced, true);
});

// ============================================================================
// Tests: Text Nodes
// ============================================================================

Deno.test("RenderTreeBuilder - includes text nodes", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div");
    const textNode = createTextNode("Hello World", div);
    div.childNodes.push(textNode);

    const renderTree = builder.build(div);

    assertExists(renderTree);
    assertEquals(renderTree.children.length, 1);
    assertEquals(renderTree.children[0] instanceof RenderText, true);
    assertEquals((renderTree.children[0] as any).text, "Hello World");
});

Deno.test("RenderTreeBuilder - excludes empty text nodes", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div");
    const emptyText = createTextNode("   ", div); // Only whitespace
    div.childNodes.push(emptyText);

    const renderTree = builder.build(div);

    assertExists(renderTree);
    assertEquals(renderTree.children.length, 0); // Should be excluded
});

Deno.test("RenderTreeBuilder - handles mixed element and text nodes", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div");
    const text1 = createTextNode("Before", div);
    const span = createMockElement("span");
    const text2 = createTextNode("After", div);

    div.childNodes.push(text1);
    div.appendChild(span);
    div.childNodes.push(text2);

    const renderTree = builder.build(div);

    assertExists(renderTree);
    assertEquals(renderTree.children.length, 3);
    assertEquals(renderTree.children[0] instanceof RenderText, true);
    assertEquals(renderTree.children[1] instanceof RenderInline, true);
    assertEquals(renderTree.children[2] instanceof RenderText, true);
});

// ============================================================================
// Tests: Non-Rendered Elements
// ============================================================================

Deno.test("RenderTreeBuilder - excludes script tags", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div");
    const script = createMockElement("script");
    const visible = createMockElement("span");

    div.appendChild(script);
    div.appendChild(visible);

    const renderTree = builder.build(div);

    assertExists(renderTree);
    assertEquals(renderTree.children.length, 1);
    assertStrictEquals((renderTree.children[0] as any).element, visible);
});

Deno.test("RenderTreeBuilder - excludes style tags", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div");
    const style = createMockElement("style");
    const visible = createMockElement("span");

    div.appendChild(style);
    div.appendChild(visible);

    const renderTree = builder.build(div);

    assertExists(renderTree);
    assertEquals(renderTree.children.length, 1);
    assertStrictEquals((renderTree.children[0] as any).element, visible);
});

Deno.test("RenderTreeBuilder - excludes meta tags", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const head = createMockElement("head");
    const meta = createMockElement("meta");
    const title = createMockElement("title");

    head.appendChild(meta);
    head.appendChild(title);

    const renderTree = builder.build(head);

    // head is non-rendered, but even if it wasn't, meta and title would be excluded
    assertEquals(renderTree, null);
});

// ============================================================================
// Tests: Visibility
// ============================================================================

Deno.test("RenderTreeBuilder - includes visibility:hidden elements", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div", undefined, undefined, { visibility: "hidden" });

    const renderTree = builder.build(div);

    // visibility:hidden elements still participate in layout
    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderBlock, true);
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

Deno.test("RenderTreeBuilder - returns null for non-element nodes", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const textNode = createTextNode("Text");

    const renderTree = builder.build(textNode);

    assertEquals(renderTree, null);
});

Deno.test("RenderTreeBuilder - handles element with no children", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div");

    const renderTree = builder.build(div);

    assertExists(renderTree);
    assertEquals(renderTree.children.length, 0);
});

Deno.test("RenderTreeBuilder - handles element with null childNodes", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div");
    (div as any).childNodes = null;

    const renderTree = builder.build(div);

    assertExists(renderTree);
    assertEquals(renderTree.children.length, 0);
});

Deno.test("RenderTreeBuilder - buildTree alias works", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div");

    const renderTree = builder.buildTree(div);

    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderBlock, true);
});

Deno.test("RenderTreeBuilder - buildSubtree works", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const div = createMockElement("div");
    const child = createMockElement("span");
    div.appendChild(child);

    const renderTree = builder.buildSubtree(div);

    assertExists(renderTree);
    assertEquals(renderTree.children.length, 1);
});

Deno.test("RenderTreeBuilder - getStyleResolver returns resolver", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const result = builder.getStyleResolver();

    assertStrictEquals(result, resolver);
});

Deno.test("RenderTreeBuilder - setStyleResolver updates resolver", () => {
    const resolver1 = new MockStyleResolver();
    const resolver2 = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver1);

    builder.setStyleResolver(resolver2);

    assertStrictEquals(builder.getStyleResolver(), resolver2);
});

// ============================================================================
// Tests: Complex Hierarchies
// ============================================================================

Deno.test("RenderTreeBuilder - handles complex hierarchy with mixed content", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const root = createMockElement("div");
    const header = createMockElement("div");
    const title = createMockElement("h1");
    const content = createMockElement("div");
    const p1 = createMockElement("p");
    const p2 = createMockElement("p");
    const hiddenDiv = createMockElement("div", undefined, undefined, { display: "none" });

    root.appendChild(header);
    header.appendChild(title);
    root.appendChild(content);
    content.appendChild(p1);
    content.appendChild(hiddenDiv);
    content.appendChild(p2);

    const renderTree = builder.build(root);

    assertExists(renderTree);
    // Root should have 2 children (header, content)
    assertEquals(renderTree.children.length, 2);
    // Content should have 2 children (p1, p2) - hiddenDiv excluded
    assertEquals(renderTree.children[1].children.length, 2);

    // Verify total node count
    const totalNodes = countNodesInTree(renderTree);
    assertEquals(totalNodes, 6); // root, header, title, content, p1, p2
});

Deno.test("RenderTreeBuilder - handles list structure", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const ul = createMockElement("ul", undefined, undefined, { display: "list-item" });
    const li1 = createMockElement("li", undefined, undefined, { display: "list-item" });
    const li2 = createMockElement("li", undefined, undefined, { display: "list-item" });
    const li3 = createMockElement("li", undefined, undefined, { display: "list-item" });

    ul.appendChild(li1);
    ul.appendChild(li2);
    ul.appendChild(li3);

    const renderTree = builder.build(ul);

    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderBlock, true);
    assertEquals(renderTree.children.length, 3);
    assertEquals(renderTree.children[0] instanceof RenderBlock, true);
    assertEquals(renderTree.children[1] instanceof RenderBlock, true);
    assertEquals(renderTree.children[2] instanceof RenderBlock, true);
});

Deno.test("RenderTreeBuilder - handles table-like structure", () => {
    const resolver = new MockStyleResolver();
    const builder = new RenderTreeBuilder(resolver);

    const table = createMockElement("div", undefined, undefined, { display: "table" });
    const row = createMockElement("div", undefined, undefined, { display: "table-row" });
    const cell1 = createMockElement("div", undefined, undefined, { display: "table-cell" });
    const cell2 = createMockElement("div", undefined, undefined, { display: "table-cell" });

    table.appendChild(row);
    row.appendChild(cell1);
    row.appendChild(cell2);

    const renderTree = builder.build(table);

    assertExists(renderTree);
    assertEquals(renderTree instanceof RenderBlock, true);
    assertEquals(renderTree.children.length, 1);
    assertEquals(renderTree.children[0].children.length, 2);
});
