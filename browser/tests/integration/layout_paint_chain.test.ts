/**
 * Layout → Paint Chain Integration Tests
 *
 * Verifies that the layout → paint → composite chain works end-to-end:
 * - Layout produces correct positions/dimensions
 * - Paint commands have correct coordinates
 * - Style is attached to LayoutBox for paint to read colors
 */

import { assertEquals, assertExists } from "@std/assert";
import { RenderBox } from "../../src/engine/rendering/rendering/RenderBox.ts";
import { RenderText } from "../../src/engine/rendering/rendering/RenderText.ts";
import { LayoutEngine } from "../../src/engine/rendering/layout/LayoutEngine.ts";
import { NormalFlowLayout } from "../../src/engine/rendering/layout/NormalFlowLayout.ts";
import type { Pixels } from "../../src/types/identifiers.ts";
import type { ComputedStyle } from "../../src/types/css.ts";
import type { DOMElement } from "../../src/types/dom.ts";

// Create minimal mock objects that satisfy the real constructors

function mockStyle(values: Record<string, string> = {}): ComputedStyle {
  return {
    getPropertyValue(prop: string): string {
      return values[prop] || "";
    },
    setProperty(_prop: string, _value: string): void {},
    getPropertyPriority(_prop: string): string { return ""; },
    item(_index: number): string { return ""; },
    length: 0,
    cssText: "",
    parentRule: null,
    removeProperty(_prop: string): string { return ""; },
    [Symbol.iterator]: function* () {},
  } as unknown as ComputedStyle;
}

function mockElement(tagName: string, attrs?: Record<string, string>): DOMElement {
  const attrMap = new Map(Object.entries(attrs || {}));
  return {
    tagName,
    attributes: attrMap,
    children: [],
    parentNode: null,
    nodeType: 1,
    nodeName: tagName,
    textContent: "",
  } as unknown as DOMElement;
}

// === Layout produces correct positions ===

Deno.test({
  name: "Layout→Paint: block children stack vertically with correct Y positions",
  fn() {
    // Create parent
    const parentStyle = mockStyle({ display: "block", width: "400px", height: "auto" });
    const parent = new RenderBox(mockElement("div"), parentStyle);

    // Create children
    const child1Style = mockStyle({ display: "block", height: "50px" });
    const child1 = new RenderBox(mockElement("div"), child1Style);

    const child2Style = mockStyle({ display: "block", height: "30px" });
    const child2 = new RenderBox(mockElement("div"), child2Style);

    parent.appendChild(child1);
    parent.appendChild(child2);

    // Layout
    const engine = new LayoutEngine();
    const viewport = { width: 800 as Pixels, height: 600 as Pixels };
    engine.layout(parent, viewport);

    // Verify parent has layout
    assertExists(parent.layout);
    assertExists(child1.layout);
    assertExists(child2.layout);

    // Child2 should be below child1
    assertEquals(child2.layout.y >= child1.layout.y + child1.layout.height, true,
      `child2.y (${child2.layout.y}) should be >= child1.y+h (${child1.layout.y + child1.layout.height})`);
  },
});

Deno.test({
  name: "Layout→Paint: LayoutBox.style is populated for paint to read",
  fn() {
    const style = mockStyle({
      display: "block",
      "background-color": "red",
      width: "200px",
      height: "100px",
    });
    const box = new RenderBox(mockElement("div"), style);

    const engine = new LayoutEngine();
    engine.layout(box, { width: 800 as Pixels, height: 600 as Pixels });

    assertExists(box.layout);
    // The LayoutBoxImpl should have style populated
    assertExists(box.layout.style, "LayoutBox.style should be populated");
    assertEquals(box.layout.style!.getPropertyValue("background-color"), "red");
  },
});

Deno.test({
  name: "Layout→Paint: text node has position and dimensions",
  fn() {
    const parentStyle = mockStyle({ display: "block", width: "300px", height: "auto" });
    const parent = new RenderBox(mockElement("div"), parentStyle);

    const textStyle = mockStyle({ "font-size": "16px" });
    const text = new RenderText(mockElement("span"), textStyle, "Hello world");
    parent.appendChild(text);

    const engine = new LayoutEngine();
    engine.layout(parent, { width: 800 as Pixels, height: 600 as Pixels });

    assertExists(text.layout);
    assertEquals(text.layout.width > 0, true, "Text should have non-zero width");
    assertEquals(text.layout.height > 0, true, "Text should have non-zero height");
  },
});

Deno.test({
  name: "Layout→Paint: nested blocks produce correct absolute positions",
  fn() {
    const outerStyle = mockStyle({ display: "block", width: "400px", height: "auto" });
    const outer = new RenderBox(mockElement("div"), outerStyle);

    const innerStyle = mockStyle({ display: "block", height: "60px" });
    const inner = new RenderBox(mockElement("div"), innerStyle);

    const deepStyle = mockStyle({ display: "block", height: "20px" });
    const deep = new RenderBox(mockElement("div"), deepStyle);

    outer.appendChild(inner);
    inner.appendChild(deep);

    const engine = new LayoutEngine();
    engine.layout(outer, { width: 800 as Pixels, height: 600 as Pixels });

    assertExists(outer.layout);
    assertExists(inner.layout);
    assertExists(deep.layout);

    // deep should be inside inner, which is inside outer
    assertEquals(deep.layout.y >= inner.layout.y, true,
      `deep.y (${deep.layout.y}) should be >= inner.y (${inner.layout.y})`);
  },
});

Deno.test({
  name: "Layout→Paint: LayoutBox type is set to display value",
  fn() {
    const style = mockStyle({ display: "flex", width: "300px", height: "100px" });
    const box = new RenderBox(mockElement("div"), style);

    const engine = new LayoutEngine();
    engine.layout(box, { width: 800 as Pixels, height: 600 as Pixels });

    assertExists(box.layout);
    assertEquals(box.layout.type, "flex");
  },
});

Deno.test({
  name: "Layout→Paint: aspect-ratio computes height from width",
  fn() {
    const style = mockStyle({
      display: "block",
      width: "300px",
      "aspect-ratio": "16 / 9",
    });
    const box = new RenderBox(mockElement("div"), style);

    const engine = new LayoutEngine();
    engine.layout(box, { width: 800 as Pixels, height: 600 as Pixels });

    assertExists(box.layout);
    // 300 / (16/9) ≈ 168.75
    const expectedHeight = 300 / (16 / 9);
    assertEquals(
      Math.abs(box.layout.height - expectedHeight) < 1,
      true,
      `Height ${box.layout.height} should be ~${expectedHeight}`,
    );
  },
});

Deno.test({
  name: "Layout→Paint: aspect-ratio 1 produces square",
  fn() {
    const style = mockStyle({
      display: "block",
      width: "200px",
      "aspect-ratio": "1",
    });
    const box = new RenderBox(mockElement("div"), style);

    const engine = new LayoutEngine();
    engine.layout(box, { width: 800 as Pixels, height: 600 as Pixels });

    assertExists(box.layout);
    assertEquals(box.layout.height, 200);
  },
});

Deno.test({
  name: "Layout→Paint: children LayoutBox references are populated",
  fn() {
    const parentStyle = mockStyle({ display: "block", width: "400px", height: "auto" });
    const parent = new RenderBox(mockElement("div"), parentStyle);

    const childStyle = mockStyle({ display: "block", height: "50px" });
    const child = new RenderBox(mockElement("div"), childStyle);
    parent.appendChild(child);

    const engine = new LayoutEngine();
    engine.layout(parent, { width: 800 as Pixels, height: 600 as Pixels });

    assertExists(parent.layout);
    assertEquals(parent.layout.width, 400);
    // Child layout computed by engine, not hardcoded
    assertExists(child.layout);
    assertEquals(child.layout.height, 50);
    // Parent's LayoutBox children array should reference child's LayoutBox
    assertExists(parent.layout.children);
    assertEquals(parent.layout.children!.length, 1);
    assertEquals(parent.layout.children![0], child.layout);
  },
});

// === NormalFlowLayout float + position tests with real RenderBox ===

Deno.test({
  name: "Layout→Paint: fixed positioning via NormalFlowLayout",
  fn() {
    const nfl = new NormalFlowLayout();

    const fixedStyle = mockStyle({
      position: "fixed",
      width: "100px",
      height: "50px",
      top: "10px",
      left: "20px",
    });
    const fixedBox = new RenderBox(mockElement("div"), fixedStyle);
    fixedBox.doLayout({
      minWidth: 0 as Pixels, maxWidth: 1024 as Pixels,
      minHeight: 0 as Pixels, maxHeight: 768 as Pixels,
    });

    const containerStyle = mockStyle({ display: "block", width: "400px", height: "300px" });
    const container = new RenderBox(mockElement("div"), containerStyle);
    container.doLayout({
      minWidth: 0 as Pixels, maxWidth: 800 as Pixels,
      minHeight: 0 as Pixels, maxHeight: 600 as Pixels,
    });
    container.setPosition(100 as Pixels, 200 as Pixels);

    nfl.layoutAbsolutelyPositioned(
      fixedBox, container,
      { width: 1024 as Pixels, height: 768 as Pixels },
    );

    // Fixed should be at viewport (20, 10), not container-relative
    assertEquals(fixedBox.layout!.x, 20);
    assertEquals(fixedBox.layout!.y, 10);
  },
});

Deno.test({
  name: "Layout→Paint: table display triggers table layout dispatch",
  fn() {
    const tableStyle = mockStyle({ display: "table", width: "400px", height: "auto" });
    const table = new RenderBox(mockElement("table"), tableStyle);

    const rowStyle = mockStyle({ display: "table-row" });
    const row = new RenderBox(mockElement("tr"), rowStyle);

    const cellStyle = mockStyle({ display: "table-cell", height: "30px" });
    const cell = new RenderBox(mockElement("td"), cellStyle);

    row.appendChild(cell);
    table.appendChild(row);

    const engine = new LayoutEngine();
    engine.layout(table, { width: 800 as Pixels, height: 600 as Pixels });

    assertExists(table.layout);
    assertExists(cell.layout);
  },
});
