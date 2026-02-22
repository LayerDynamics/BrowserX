/**
 * Tests for RenderObject CSS percentage length resolution
 */

import { assertEquals } from "@std/assert";
import { RenderObject } from "../../../src/engine/rendering/rendering/RenderObject.ts";
import type { DOMElement } from "../../../src/types/dom.ts";
import type { ComputedStyle } from "../../../src/types/css.ts";
import type { LayoutConstraints, PaintContext } from "../../../src/types/rendering.ts";
import type { Pixels } from "../../../src/types/identifiers.ts";

// ============================================================================
// Mocks
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
    setProperty: (property: string, value: string) => {
      propMap.set(property, value);
    },
    removeProperty: (property: string) => {
      propMap.delete(property);
    },
    getPropertyNames: () => Array.from(propMap.keys()),
  } as ComputedStyle;
}

function makeLayout(width: number, height: number) {
  return {
    x: 0 as Pixels,
    y: 0 as Pixels,
    width: width as Pixels,
    height: height as Pixels,
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
    getContentBox: () => ({
      x: 0 as Pixels,
      y: 0 as Pixels,
      width: width as Pixels,
      height: height as Pixels,
    }),
    getPaddingBox: () => ({
      x: 0 as Pixels,
      y: 0 as Pixels,
      width: width as Pixels,
      height: height as Pixels,
    }),
    getBorderBox: () => ({
      x: 0 as Pixels,
      y: 0 as Pixels,
      width: width as Pixels,
      height: height as Pixels,
    }),
    getMarginBox: () => ({
      x: 0 as Pixels,
      y: 0 as Pixels,
      width: width as Pixels,
      height: height as Pixels,
    }),
    getTotalWidth: () => width as Pixels,
    getTotalHeight: () => height as Pixels,
  };
}

class TestRenderObject extends RenderObject {
  doLayout(_constraints: LayoutConstraints): void {
    this.needsLayout = false;
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
// Tests
// ============================================================================

Deno.test("getPixelValue - 50% width with parent width 400 returns 200", () => {
  const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
  parent.layout = makeLayout(400, 300);

  const child = new TestRenderObject(createMockElement("div"), createMockStyle({ width: "50%" }));
  parent.appendChild(child);

  assertEquals(child.getPixelValue("width"), 200 as Pixels);
});

Deno.test("getPixelValue - 50% height with parent height 300 returns 150", () => {
  const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
  parent.layout = makeLayout(400, 300);

  const child = new TestRenderObject(createMockElement("div"), createMockStyle({ height: "50%" }));
  parent.appendChild(child);

  assertEquals(child.getPixelValue("height"), 150 as Pixels);
});

Deno.test("getPixelValue - percentage with no parent returns defaultValue", () => {
  const obj = new TestRenderObject(createMockElement("div"), createMockStyle({ width: "50%" }));
  assertEquals(obj.getPixelValue("width"), 0 as Pixels);
  assertEquals(obj.getPixelValue("width", 42 as Pixels), 42 as Pixels);
});

Deno.test("getPixelValue - percentage with parent but no layout returns defaultValue", () => {
  const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
  // parent.layout is null by default

  const child = new TestRenderObject(createMockElement("div"), createMockStyle({ width: "50%" }));
  parent.appendChild(child);

  assertEquals(child.getPixelValue("width"), 0 as Pixels);
});

Deno.test("getPixelValue - margin-left percentage resolves against parent width", () => {
  const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
  parent.layout = makeLayout(800, 600);

  const child = new TestRenderObject(
    createMockElement("div"),
    createMockStyle({ "margin-left": "10%" }),
  );
  parent.appendChild(child);

  assertEquals(child.getPixelValue("margin-left"), 80 as Pixels);
});

Deno.test("getPixelValue - top percentage resolves against parent height", () => {
  const parent = new TestRenderObject(createMockElement("div"), createMockStyle());
  parent.layout = makeLayout(800, 600);

  const child = new TestRenderObject(createMockElement("div"), createMockStyle({ top: "25%" }));
  parent.appendChild(child);

  assertEquals(child.getPixelValue("top"), 150 as Pixels);
});
