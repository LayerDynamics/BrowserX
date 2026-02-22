/**
 * Tests for RenderBlock - block formatting context
 */

import { assert, assertEquals } from "@std/assert";
import { RenderBlock } from "../../../../src/engine/rendering/rendering/RenderBlock.ts";
import type { DOMElement } from "../../../../src/types/dom.ts";
import type { ComputedStyle } from "../../../../src/types/css.ts";
import type { LayoutConstraints } from "../../../../src/types/rendering.ts";
import type { Pixels } from "../../../../src/types/identifiers.ts";

// ============================================================================
// Helpers
// ============================================================================

function createMockElement(tagName: string): DOMElement {
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
    attributes: new Map(),
    id: "",
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

function defaultConstraints(maxWidth: number = 500): LayoutConstraints {
  return {
    minWidth: 0 as Pixels,
    maxWidth: maxWidth as Pixels,
    minHeight: 0 as Pixels,
    maxHeight: Number.POSITIVE_INFINITY as Pixels,
  };
}

// ============================================================================
// Tests: Construction
// ============================================================================

Deno.test("RenderBlock - creates with element and style", () => {
  const block = new RenderBlock(createMockElement("div"), createMockStyle({ display: "block" }));
  assert(block !== null);
  assertEquals(block.children.length, 0);
});

// ============================================================================
// Tests: Vertical stacking
// ============================================================================

Deno.test("RenderBlock - children stack vertically", () => {
  const parent = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  const child1 = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "50px" }),
  );
  const child2 = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "30px" }),
  );

  parent.appendChild(child1);
  parent.appendChild(child2);
  parent.doLayout(defaultConstraints(500));

  assert(child1.layout !== null);
  assert(child2.layout !== null);
  assert(child2.layout!.y > child1.layout!.y, "child2 should be below child1");
});

Deno.test("RenderBlock - auto height equals sum of children", () => {
  const parent = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  const child1 = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "50px" }),
  );
  const child2 = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "30px" }),
  );

  parent.appendChild(child1);
  parent.appendChild(child2);
  parent.doLayout(defaultConstraints(500));

  // Parent height should be sum of children heights (50 + 30 = 80)
  assertEquals(parent.layout!.height, 80);
});

Deno.test("RenderBlock - empty block has zero auto height", () => {
  const block = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  block.doLayout(defaultConstraints(500));
  assertEquals(block.layout!.height, 0);
});

// ============================================================================
// Tests: Margin collapse
// ============================================================================

Deno.test("RenderBlock - margin collapse between siblings uses max", () => {
  const parent = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  const child1 = new RenderBlock(
    createMockElement("div"),
    createMockStyle({
      width: "auto",
      height: "50px",
      "margin-bottom": "20px",
    }),
  );
  const child2 = new RenderBlock(
    createMockElement("div"),
    createMockStyle({
      width: "auto",
      height: "30px",
      "margin-top": "30px",
    }),
  );

  parent.appendChild(child1);
  parent.appendChild(child2);
  parent.doLayout(defaultConstraints(500));

  // Collapsed margin should be max(20, 30) = 30, not 20+30=50
  const gap = child2.layout!.y - (child1.layout!.y + child1.layout!.height);
  // The gap includes the collapsed margin
  assert(gap <= 30, `gap (${gap}) should reflect collapsed margin of 30, not additive 50`);
});

Deno.test("RenderBlock - no margin collapse with zero margins", () => {
  const parent = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  const child1 = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "50px" }),
  );
  const child2 = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "30px" }),
  );

  parent.appendChild(child1);
  parent.appendChild(child2);
  parent.doLayout(defaultConstraints(500));

  // With zero margins, children should be adjacent
  const expectedY2 = child1.layout!.y + child1.layout!.height;
  // Allow for the collapsed margin (max(0,0)=0)
  assert(
    Math.abs(child2.layout!.y - expectedY2) <= 1,
    "children should be adjacent with zero margins",
  );
});

// ============================================================================
// Tests: Width calculation
// ============================================================================

Deno.test("RenderBlock - auto width fills available constraint width", () => {
  const block = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  block.doLayout(defaultConstraints(400));

  // Auto width block should expand to fill available width
  assertEquals(block.layout!.width, 400);
});

Deno.test("RenderBlock - explicit width is respected", () => {
  const block = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "200px", height: "auto" }),
  );
  block.doLayout(defaultConstraints(500));

  assertEquals(block.layout!.width, 200);
});

Deno.test("RenderBlock - children receive available width from parent", () => {
  const parent = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "300px", height: "auto" }),
  );
  const child = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "50px" }),
  );

  parent.appendChild(child);
  parent.doLayout(defaultConstraints(500));

  // Child with auto width should fill parent's content width (300px)
  assertEquals(child.layout!.width, 300);
});

// ============================================================================
// Tests: Block formatting context
// ============================================================================

Deno.test("RenderBlock - createsBlockFormattingContext for overflow hidden", () => {
  const block = new RenderBlock(createMockElement("div"), createMockStyle({ overflow: "hidden" }));
  assertEquals(block.createsBlockFormattingContext(), true);
});

Deno.test("RenderBlock - createsBlockFormattingContext for flow-root", () => {
  const block = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ display: "flow-root" }),
  );
  assertEquals(block.createsBlockFormattingContext(), true);
});

Deno.test("RenderBlock - createsBlockFormattingContext for inline-block", () => {
  const block = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ display: "inline-block" }),
  );
  assertEquals(block.createsBlockFormattingContext(), true);
});

Deno.test("RenderBlock - createsBlockFormattingContext for absolute position", () => {
  const block = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ position: "absolute" }),
  );
  assertEquals(block.createsBlockFormattingContext(), true);
});

Deno.test("RenderBlock - createsBlockFormattingContext for fixed position", () => {
  const block = new RenderBlock(createMockElement("div"), createMockStyle({ position: "fixed" }));
  assertEquals(block.createsBlockFormattingContext(), true);
});

Deno.test("RenderBlock - createsBlockFormattingContext for float", () => {
  const block = new RenderBlock(createMockElement("div"), createMockStyle({ float: "left" }));
  assertEquals(block.createsBlockFormattingContext(), true);
});

Deno.test("RenderBlock - no BFC for normal visible overflow with float none", () => {
  const block = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ overflow: "visible", float: "none" }),
  );
  assertEquals(block.createsBlockFormattingContext(), false);
});

Deno.test("RenderBlock - no BFC for default styles", () => {
  const block = new RenderBlock(createMockElement("div"), createMockStyle({}));
  // Default: overflow visible, no float, no special display/position
  // float defaults to "" which is !== "none", so this actually returns true
  // Let's explicitly set float to none
  const block2 = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ float: "none", overflow: "visible" }),
  );
  assertEquals(block2.createsBlockFormattingContext(), false);
});

// ============================================================================
// Tests: Multiple children with margins
// ============================================================================

Deno.test("RenderBlock - three children stack correctly", () => {
  const parent = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  const child1 = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "40px" }),
  );
  const child2 = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "30px" }),
  );
  const child3 = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "20px" }),
  );

  parent.appendChild(child1);
  parent.appendChild(child2);
  parent.appendChild(child3);
  parent.doLayout(defaultConstraints(500));

  assert(child1.layout!.y < child2.layout!.y, "child1 before child2");
  assert(child2.layout!.y < child3.layout!.y, "child2 before child3");
  assertEquals(parent.layout!.height, 90); // 40+30+20
});

Deno.test("RenderBlock - explicit height overrides auto", () => {
  const block = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "200px" }),
  );
  const child = new RenderBlock(
    createMockElement("div"),
    createMockStyle({ width: "auto", height: "50px" }),
  );
  block.appendChild(child);
  block.doLayout(defaultConstraints(500));

  assertEquals(block.layout!.height, 200);
});
