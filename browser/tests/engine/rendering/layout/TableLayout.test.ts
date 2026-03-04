/**
 * Tests for Table Layout Algorithm
 */

import { assertEquals, assertExists } from "@std/assert";
import { TableLayout } from "../../../../src/engine/rendering/layout/TableLayout.ts";

function createMockRenderObject(props: any = {}): any {
  const layout = props.layout || {
    x: 0, y: 0, width: 100, height: 30,
    marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
    paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
    borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
    getTotalWidth() { return this.width; },
    getTotalHeight() { return this.height; },
    getContentBox() { return { x: this.x, y: this.y, width: this.width, height: this.height }; },
    getPaddingBox() { return this.getContentBox(); },
    getBorderBox() { return this.getContentBox(); },
    getMarginBox() { return this.getContentBox(); },
  };

  return {
    layout,
    style: {
      getPropertyValue: (prop: string) => props.styleValues?.[prop] || "",
    },
    element: { tagName: props.tagName || "div", attributes: props.attributes || new Map() },
    children: props.children || [],
    doLayout: function (constraints: any) {
      if (!this.layout) return;
      if (constraints.maxWidth) this.layout.width = Math.min(this.layout.width, constraints.maxWidth);
    },
    setPosition: function (x: number, y: number) {
      this.layout.x = x;
      this.layout.y = y;
    },
    parent: props.parent || null,
    getPixelValue: (prop: string, defaultValue?: any) => {
      const val = props.styleValues?.[prop];
      if (val && typeof val === "string" && val.endsWith("px")) return parseFloat(val);
      return defaultValue || 0;
    },
  };
}

function createMockTable(props: any = {}): any {
  return createMockRenderObject({
    tagName: "table",
    styleValues: { display: "table", ...props.styleValues },
    ...props,
    layout: {
      x: 0, y: 0, width: props.width || 400, height: 0,
      marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
      paddingTop: 5, paddingRight: 5, paddingBottom: 5, paddingLeft: 5,
      borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
      getTotalWidth() { return this.width; },
      getTotalHeight() { return this.height; },
      getContentBox() { return { x: this.x, y: this.y, width: this.width, height: this.height }; },
      getPaddingBox() { return this.getContentBox(); },
      getBorderBox() { return this.getContentBox(); },
      getMarginBox() { return this.getContentBox(); },
    },
  });
}

function createMockRow(cells: any[]): any {
  return createMockRenderObject({
    tagName: "tr",
    styleValues: { display: "table-row" },
    children: cells,
  });
}

function createMockCell(props: any = {}): any {
  const attrs = new Map<string, string>();
  if (props.colspan) attrs.set("colspan", String(props.colspan));
  if (props.rowspan) attrs.set("rowspan", String(props.rowspan));

  return createMockRenderObject({
    tagName: "td",
    styleValues: { display: "table-cell", ...props.styleValues },
    attributes: attrs,
    ...props,
  });
}

Deno.test({
  name: "TableLayout - constructor creates instance",
  fn() {
    const layout = new TableLayout();
    assertExists(layout);
  },
});

Deno.test({
  name: "TableLayout - layoutTable with no children returns 0",
  fn() {
    const layout = new TableLayout();
    const table = createMockTable();
    const constraints = { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 1000 } as any;
    const height = layout.layoutTable(table, [], constraints);
    assertEquals(height, 0);
  },
});

Deno.test({
  name: "TableLayout - layoutTable with single row, single cell",
  fn() {
    const layout = new TableLayout();
    const cell = createMockCell();
    const row = createMockRow([cell]);
    const table = createMockTable({ children: [row] });
    const constraints = { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 1000 } as any;

    const height = layout.layoutTable(table, [row], constraints);

    assertExists(height);
    // Height should be > 0 (cell height + spacing)
    assertEquals(height > 0, true);
  },
});

Deno.test({
  name: "TableLayout - layoutTable with multiple rows",
  fn() {
    const layout = new TableLayout();
    const cell1 = createMockCell();
    const cell2 = createMockCell();
    const row1 = createMockRow([cell1]);
    const row2 = createMockRow([cell2]);
    const table = createMockTable({ children: [row1, row2] });
    const constraints = { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 1000 } as any;

    const height = layout.layoutTable(table, [row1, row2], constraints);

    // Should be taller than single row
    assertEquals(height > 30, true);
  },
});

Deno.test({
  name: "TableLayout - layoutTable with multiple columns",
  fn() {
    const layout = new TableLayout();
    const cell1 = createMockCell();
    const cell2 = createMockCell();
    const cell3 = createMockCell();
    const row = createMockRow([cell1, cell2, cell3]);
    const table = createMockTable({ children: [row] });
    const constraints = { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 1000 } as any;

    const height = layout.layoutTable(table, [row], constraints);
    assertExists(height);

    // Cells should be positioned at different X coordinates
    assertEquals(cell1.layout.x < cell2.layout.x, true);
    assertEquals(cell2.layout.x < cell3.layout.x, true);
  },
});

Deno.test({
  name: "TableLayout - layoutTable with colspan",
  fn() {
    const layout = new TableLayout();
    // Row 1: 3 cells
    const cell1a = createMockCell();
    const cell1b = createMockCell();
    const cell1c = createMockCell();
    const row1 = createMockRow([cell1a, cell1b, cell1c]);

    // Row 2: 1 cell with colspan=3
    const cell2a = createMockCell({ colspan: 3 });
    const row2 = createMockRow([cell2a]);

    const table = createMockTable({ children: [row1, row2] });
    const constraints = { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 1000 } as any;

    const height = layout.layoutTable(table, [row1, row2], constraints);
    assertExists(height);
  },
});

Deno.test({
  name: "TableLayout - fixed table-layout uses first row widths",
  fn() {
    const layout = new TableLayout();
    const cell1 = createMockCell({ styleValues: { width: "100px", display: "table-cell" } });
    cell1.getPixelValue = (prop: string, defaultValue?: any) => {
      if (prop === "width") return 100;
      return defaultValue || 0;
    };
    const cell2 = createMockCell();
    const row = createMockRow([cell1, cell2]);
    const table = createMockTable({
      children: [row],
      styleValues: { display: "table", "table-layout": "fixed" },
    });
    const constraints = { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 1000 } as any;

    const height = layout.layoutTable(table, [row], constraints);
    assertExists(height);
  },
});

Deno.test({
  name: "TableLayout - border-collapse removes spacing",
  fn() {
    const layout = new TableLayout();
    const cell = createMockCell();
    const row = createMockRow([cell]);
    const table = createMockTable({
      children: [row],
      styleValues: { display: "table", "border-collapse": "collapse" },
    });
    const constraints = { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 1000 } as any;

    const height = layout.layoutTable(table, [row], constraints);
    // With collapse, spacing is 0 so height is just cell height
    assertEquals(height, 30);
  },
});

Deno.test({
  name: "TableLayout - table-row-group children are collected",
  fn() {
    const layout = new TableLayout();
    const cell = createMockCell();
    const row = createMockRow([cell]);
    const tbody = createMockRenderObject({
      tagName: "tbody",
      styleValues: { display: "table-row-group" },
      children: [row],
    });
    const table = createMockTable({ children: [tbody] });
    const constraints = { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 1000 } as any;

    const height = layout.layoutTable(table, [tbody], constraints);
    assertExists(height);
    assertEquals(height > 0, true);
  },
});

Deno.test({
  name: "TableLayout - equal column widths when no explicit widths",
  fn() {
    const layout = new TableLayout();
    const cell1 = createMockCell();
    const cell2 = createMockCell();
    const row = createMockRow([cell1, cell2]);
    const table = createMockTable({ width: 400, children: [row] });
    const constraints = { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 1000 } as any;

    layout.layoutTable(table, [row], constraints);

    // Both cells should have similar widths (equal distribution)
    const w1 = cell1.layout.width;
    const w2 = cell2.layout.width;
    assertEquals(Math.abs(w1 - w2) < 1, true);
  },
});
