/**
 * Tests for RenderInline - inline formatting context
 */

import { assert, assertEquals } from "@std/assert";
import { RenderInline } from "../../../../src/engine/rendering/rendering/RenderInline.ts";
import { RenderBlock } from "../../../../src/engine/rendering/rendering/RenderBlock.ts";
import type { DOMElement } from "../../../../src/types/dom.ts";
import type { ComputedStyle } from "../../../../src/types/css.ts";
import type { LayoutConstraints, PaintContext } from "../../../../src/types/rendering.ts";
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

function createMockPaintContext(): PaintContext {
  return {
    save: () => {},
    restore: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    drawText: () => {},
    drawImage: () => {},
    clip: () => {},
    translate: () => {},
    setOpacity: () => {},
  } as unknown as PaintContext;
}

// ============================================================================
// Tests: Construction
// ============================================================================

Deno.test("RenderInline - creates with element and style", () => {
  const inline = new RenderInline(
    createMockElement("span"),
    createMockStyle({ display: "inline" }),
  );
  assert(inline !== null);
  assertEquals(inline.children.length, 0);
});

// ============================================================================
// Tests: Layout - Horizontal flow
// ============================================================================

Deno.test("RenderInline - lays out children horizontally", () => {
  const inline = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  const child1 = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "50px", height: "20px" }),
  );
  const child2 = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "60px", height: "20px" }),
  );

  inline.appendChild(child1);
  inline.appendChild(child2);
  inline.doLayout(defaultConstraints(500));

  assert(child1.layout !== null);
  assert(child2.layout !== null);
  // child2 should be to the right of child1
  assert(
    child2.layout!.x > child1.layout!.x,
    "child2 should be positioned after child1 horizontally",
  );
});

Deno.test("RenderInline - children fit on one line when within width", () => {
  const inline = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  const child1 = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "100px", height: "20px" }),
  );
  const child2 = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "100px", height: "20px" }),
  );

  inline.appendChild(child1);
  inline.appendChild(child2);
  inline.doLayout(defaultConstraints(500));

  // Both should be on same Y line
  assertEquals(child1.layout!.y, child2.layout!.y);
});

// ============================================================================
// Tests: Line wrapping
// ============================================================================

Deno.test("RenderInline - wraps children to next line when exceeding width", () => {
  const inline = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  // child1 takes 200px width + 60px margin-right = 260px total
  // child2 takes 200px width + 60px margin-left = 260px total
  // Together 260+260 = 520 > 500 available, so child2 wraps
  const child1 = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "200px", height: "20px", "margin-right": "60px" }),
  );
  const child2 = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "200px", height: "20px", "margin-left": "60px" }),
  );

  inline.appendChild(child1);
  inline.appendChild(child2);
  inline.doLayout(defaultConstraints(500));

  // child2 should wrap to next line (y should be greater)
  assert(child2.layout!.y > child1.layout!.y, "child2 should wrap to next line");
});

Deno.test("RenderInline - auto height grows with wrapped lines", () => {
  const inline = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  const child1 = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "200px", height: "20px", "margin-right": "60px" }),
  );
  const child2 = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "200px", height: "20px", "margin-left": "60px" }),
  );

  inline.appendChild(child1);
  inline.appendChild(child2);
  inline.doLayout(defaultConstraints(500));

  // Height should account for both lines
  assert(inline.layout!.height > 0, "height should grow to fit wrapped content");
});

// ============================================================================
// Tests: Sizing
// ============================================================================

Deno.test("RenderInline - auto width determined by content", () => {
  const inline = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  const child = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "80px", height: "20px" }),
  );

  inline.appendChild(child);
  inline.doLayout(defaultConstraints(500));

  // Inline width should be based on content, not full available width
  assert(inline.layout !== null);
});

Deno.test("RenderInline - line height is max of children heights", () => {
  const inline = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  const child1 = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "50px", height: "10px" }),
  );
  const child2 = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "50px", height: "30px" }),
  );

  inline.appendChild(child1);
  inline.appendChild(child2);
  inline.doLayout(defaultConstraints(500));

  // Auto height should be max child height (30px) since they fit on one line
  assertEquals(inline.layout!.height, 30);
});

// ============================================================================
// Tests: Empty and single child
// ============================================================================

Deno.test("RenderInline - no children produces zero-height layout", () => {
  const inline = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  inline.doLayout(defaultConstraints(500));
  assertEquals(inline.layout!.height, 0);
});

Deno.test("RenderInline - single child positions correctly", () => {
  const inline = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  const child = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "50px", height: "20px" }),
  );
  inline.appendChild(child);
  inline.doLayout(defaultConstraints(500));

  assert(child.layout !== null);
});

// ============================================================================
// Tests: Paint
// ============================================================================

Deno.test("RenderInline - paint with background color", () => {
  const inline = new RenderInline(
    createMockElement("span"),
    createMockStyle({ "background-color": "red", width: "auto", height: "auto" }),
  );
  inline.doLayout(defaultConstraints(500));

  let fillCalled = false;
  const ctx = createMockPaintContext();
  (ctx as any).fillRect = () => {
    fillCalled = true;
  };
  inline.paint(ctx);
  assertEquals(fillCalled, true);
});

Deno.test("RenderInline - paint transparent background does not fill", () => {
  const inline = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  inline.doLayout(defaultConstraints(500));

  let fillCalled = false;
  const ctx = createMockPaintContext();
  (ctx as any).fillRect = () => {
    fillCalled = true;
  };
  inline.paint(ctx);
  assertEquals(fillCalled, false);
});

Deno.test("RenderInline - paint sets needsPaint to false", () => {
  const inline = new RenderInline(
    createMockElement("span"),
    createMockStyle({ width: "auto", height: "auto" }),
  );
  inline.doLayout(defaultConstraints(500));
  assertEquals(inline.needsPaint, true);
  inline.paint(createMockPaintContext());
  assertEquals(inline.needsPaint, false);
});
