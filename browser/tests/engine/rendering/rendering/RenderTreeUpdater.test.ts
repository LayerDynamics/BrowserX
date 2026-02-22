/**
 * Tests for RenderTreeUpdater - incremental render tree updates
 */

import { assert, assertEquals } from "@std/assert";
import {
  RenderTreeUpdater,
  UpdateType,
} from "../../../../src/engine/rendering/rendering/RenderTreeUpdater.ts";
import { RenderBlock } from "../../../../src/engine/rendering/rendering/RenderBlock.ts";
import { RenderTreeBuilder } from "../../../../src/engine/rendering/rendering/RenderTreeBuilder.ts";
import { StyleResolver } from "../../../../src/engine/rendering/css-parser/StyleResolver.ts";
import type { RenderObject } from "../../../../src/engine/rendering/rendering/RenderObject.ts";
import type { DOMElement } from "../../../../src/types/dom.ts";
import type { ComputedStyle } from "../../../../src/types/css.ts";
import type { Pixels } from "../../../../src/types/identifiers.ts";

// ============================================================================
// Helpers
// ============================================================================

function createMockElement(tagName: string, id?: string): DOMElement {
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
    attributes: new Map(id ? [["id", id]] : []),
    id: id || "",
    className: "",
    classList: null as any,
    getAttribute: () => null,
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

function createMockStyle(properties: Record<string, string> = {}): ComputedStyle {
  const propMap = new Map(Object.entries(properties));
  return {
    properties: propMap,
    getPropertyValue: (property: string) => propMap.get(property) || "",
    setProperty: (property: string, value: string) => propMap.set(property, value),
    removeProperty: (property: string) => propMap.delete(property),
    getPropertyNames: () => Array.from(propMap.keys()),
  } as ComputedStyle;
}

function createRenderBlock(
  tagName: string = "div",
  styleProps: Record<string, string> = {},
): RenderBlock {
  return new RenderBlock(
    createMockElement(tagName),
    createMockStyle({ display: "block", width: "auto", height: "auto", ...styleProps }),
  );
}

function createUpdater(): RenderTreeUpdater {
  const styleResolver = new StyleResolver();
  const treeBuilder = new RenderTreeBuilder(styleResolver);
  return new RenderTreeUpdater(styleResolver, treeBuilder);
}

// ============================================================================
// Tests: Style change marks dirty
// ============================================================================

Deno.test("RenderTreeUpdater - style change marks needsLayout", () => {
  const updater = createUpdater();
  const element = createMockElement("div");
  const renderObj = createRenderBlock();
  renderObj.needsLayout = false;
  renderObj.needsPaint = false;

  const result = updater.applyUpdate({
    type: UpdateType.STYLE_CHANGE,
    element,
    renderObject: renderObj,
  });

  assertEquals(result, renderObj);
  assertEquals(renderObj.needsLayout, true);
  assertEquals(renderObj.needsPaint, true);
});

Deno.test("RenderTreeUpdater - style change returns null without renderObject", () => {
  const updater = createUpdater();
  const result = updater.applyUpdate({
    type: UpdateType.STYLE_CHANGE,
    element: createMockElement("div"),
  });
  assertEquals(result, null);
});

// ============================================================================
// Tests: Attribute change marks dirty
// ============================================================================

Deno.test("RenderTreeUpdater - attribute change marks needsLayout", () => {
  const updater = createUpdater();
  const element = createMockElement("div");
  element.attributes = new Map([["data-foo", "bar"]]);
  const renderObj = createRenderBlock();
  renderObj.needsLayout = false;
  renderObj.needsPaint = false;

  updater.applyUpdate({
    type: UpdateType.ATTRIBUTE_CHANGE,
    element,
    renderObject: renderObj,
  });

  assertEquals(renderObj.needsLayout, true);
  assertEquals(renderObj.needsPaint, true);
});

Deno.test("RenderTreeUpdater - class attribute change triggers style re-resolve", () => {
  const updater = createUpdater();
  const element = createMockElement("div");
  element.attributes = new Map([["class", "new-class"]]);
  const renderObj = createRenderBlock();
  renderObj.needsLayout = false;
  renderObj.needsPaint = false;

  const result = updater.applyUpdate({
    type: UpdateType.ATTRIBUTE_CHANGE,
    element,
    renderObject: renderObj,
  });

  // Should still mark dirty (handled via handleStyleChange path)
  assert(result !== null);
  assertEquals(renderObj.needsLayout, true);
});

Deno.test("RenderTreeUpdater - attribute change returns null without renderObject", () => {
  const updater = createUpdater();
  const result = updater.applyUpdate({
    type: UpdateType.ATTRIBUTE_CHANGE,
    element: createMockElement("div"),
  });
  assertEquals(result, null);
});

// ============================================================================
// Tests: Text change
// ============================================================================

Deno.test("RenderTreeUpdater - text change marks needsLayout and needsPaint", () => {
  const updater = createUpdater();
  const renderObj = createRenderBlock();
  renderObj.needsLayout = false;
  renderObj.needsPaint = false;

  updater.applyUpdate({
    type: UpdateType.TEXT_CHANGE,
    element: createMockElement("p"),
    renderObject: renderObj,
  });

  assertEquals(renderObj.needsLayout, true);
  assertEquals(renderObj.needsPaint, true);
});

// ============================================================================
// Tests: Child removed
// ============================================================================

Deno.test("RenderTreeUpdater - child removed marks parent dirty", () => {
  const updater = createUpdater();
  const parent = createRenderBlock();
  const child = createRenderBlock();
  parent.appendChild(child);

  parent.needsLayout = false;
  parent.needsPaint = false;

  updater.applyUpdate({
    type: UpdateType.CHILD_REMOVED,
    element: createMockElement("div"),
    renderObject: child,
  });

  assertEquals(parent.needsLayout, true);
  assertEquals(parent.needsPaint, true);
  assertEquals(parent.children.length, 0);
});

Deno.test("RenderTreeUpdater - child removed returns null", () => {
  const updater = createUpdater();
  const parent = createRenderBlock();
  const child = createRenderBlock();
  parent.appendChild(child);

  const result = updater.applyUpdate({
    type: UpdateType.CHILD_REMOVED,
    element: createMockElement("div"),
    renderObject: child,
  });

  assertEquals(result, null);
});

// ============================================================================
// Tests: Incremental update traversal
// ============================================================================

Deno.test("RenderTreeUpdater - update traverses entire tree", () => {
  const updater = createUpdater();
  const root = createRenderBlock();
  const child1 = createRenderBlock();
  const child2 = createRenderBlock();
  const grandchild = createRenderBlock();

  root.appendChild(child1);
  root.appendChild(child2);
  child1.appendChild(grandchild);

  // Mark some nodes dirty
  root.needsLayout = true;
  grandchild.needsPaint = true;

  // update() traverses without error
  updater.update(root);
});

Deno.test("RenderTreeUpdater - clean nodes not disturbed by update", () => {
  const updater = createUpdater();
  const root = createRenderBlock();
  const child = createRenderBlock();
  root.appendChild(child);

  // Clear dirty flags
  root.needsLayout = false;
  root.needsPaint = false;
  child.needsLayout = false;
  child.needsPaint = false;

  updater.update(root);

  // Clean nodes remain clean after update traversal
  assertEquals(root.needsLayout, false);
  assertEquals(child.needsLayout, false);
});

// ============================================================================
// Tests: markSubtree helpers
// ============================================================================

Deno.test("RenderTreeUpdater - markSubtreeNeedsLayout marks all descendants", () => {
  const updater = createUpdater();
  const root = createRenderBlock();
  const child = createRenderBlock();
  const grandchild = createRenderBlock();

  root.appendChild(child);
  child.appendChild(grandchild);

  root.needsLayout = false;
  child.needsLayout = false;
  grandchild.needsLayout = false;

  updater.markSubtreeNeedsLayout(root);

  assertEquals(root.needsLayout, true);
  assertEquals(child.needsLayout, true);
  assertEquals(grandchild.needsLayout, true);
});

Deno.test("RenderTreeUpdater - markSubtreeNeedsPaint marks all descendants", () => {
  const updater = createUpdater();
  const root = createRenderBlock();
  const child = createRenderBlock();

  root.appendChild(child);
  root.needsPaint = false;
  child.needsPaint = false;

  updater.markSubtreeNeedsPaint(root);

  assertEquals(root.needsPaint, true);
  assertEquals(child.needsPaint, true);
});

// ============================================================================
// Tests: findRenderObject
// ============================================================================

Deno.test("RenderTreeUpdater - findRenderObject finds root element", () => {
  const updater = createUpdater();
  const element = createMockElement("div");
  const root = new RenderBlock(element, createMockStyle({ display: "block" }));

  const found = updater.findRenderObject(root, element);
  assertEquals(found, root);
});

Deno.test("RenderTreeUpdater - findRenderObject finds deep child", () => {
  const updater = createUpdater();
  const rootEl = createMockElement("div");
  const childEl = createMockElement("p");
  const grandchildEl = createMockElement("span");

  const root = new RenderBlock(rootEl, createMockStyle({ display: "block" }));
  const child = new RenderBlock(childEl, createMockStyle({ display: "block" }));
  const grandchild = new RenderBlock(grandchildEl, createMockStyle({ display: "block" }));

  root.appendChild(child);
  child.appendChild(grandchild);

  const found = updater.findRenderObject(root, grandchildEl);
  assertEquals(found, grandchild);
});

Deno.test("RenderTreeUpdater - findRenderObject returns null for missing element", () => {
  const updater = createUpdater();
  const root = createRenderBlock();
  const missingEl = createMockElement("span");

  const found = updater.findRenderObject(root, missingEl);
  assertEquals(found, null);
});

// ============================================================================
// Tests: batchUpdate
// ============================================================================

Deno.test("RenderTreeUpdater - batchUpdate applies multiple updates", () => {
  const updater = createUpdater();
  const root = createRenderBlock();
  const child1 = createRenderBlock();
  const child2 = createRenderBlock();
  root.appendChild(child1);
  root.appendChild(child2);

  child1.needsLayout = false;
  child1.needsPaint = false;
  child2.needsLayout = false;
  child2.needsPaint = false;

  updater.batchUpdate([
    { type: UpdateType.TEXT_CHANGE, element: createMockElement("div"), renderObject: child1 },
    { type: UpdateType.TEXT_CHANGE, element: createMockElement("div"), renderObject: child2 },
  ], root);

  assertEquals(child1.needsLayout, true);
  assertEquals(child2.needsLayout, true);
});

// ============================================================================
// Tests: setStyleResolver / setTreeBuilder
// ============================================================================

Deno.test("RenderTreeUpdater - setStyleResolver replaces resolver", () => {
  const updater = createUpdater();
  const newResolver = new StyleResolver();
  updater.setStyleResolver(newResolver);
  // No error means success - resolver is used internally
});

Deno.test("RenderTreeUpdater - setTreeBuilder replaces builder", () => {
  const updater = createUpdater();
  const newBuilder = new RenderTreeBuilder(new StyleResolver());
  updater.setTreeBuilder(newBuilder);
  // No error means success
});

// ============================================================================
// Tests: UpdateType enum values
// ============================================================================

Deno.test("RenderTreeUpdater - UpdateType enum has expected values", () => {
  assertEquals(UpdateType.STYLE_CHANGE, 0);
  assertEquals(UpdateType.ATTRIBUTE_CHANGE, 1);
  assertEquals(UpdateType.TEXT_CHANGE, 2);
  assertEquals(UpdateType.CHILD_ADDED, 3);
  assertEquals(UpdateType.CHILD_REMOVED, 4);
  assertEquals(UpdateType.CHILD_REORDERED, 5);
});
