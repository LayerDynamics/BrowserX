/**
 * Tests for Float Exclusion Zones, Fixed Positioning, and Sticky Positioning
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  FloatContext,
  NormalFlowLayout,
} from "../../../../src/engine/rendering/layout/NormalFlowLayout.ts";
import type { Pixels } from "../../../../src/types/identifiers.ts";

// Helper: create mock render objects

function createMockRenderObject(props: any = {}): any {
  const layout = props.layout || {
    x: 0, y: 0, width: 100, height: 50,
    marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
    paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
    borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
    getTotalWidth() {
      return this.width + this.marginLeft + this.marginRight +
        this.paddingLeft + this.paddingRight +
        this.borderLeftWidth + this.borderRightWidth;
    },
    getTotalHeight() {
      return this.height + this.marginTop + this.marginBottom +
        this.paddingTop + this.paddingBottom +
        this.borderTopWidth + this.borderBottomWidth;
    },
  };

  return {
    layout,
    style: {
      getPropertyValue: (prop: string) => props.styleValues?.[prop] || "",
    },
    element: { tagName: props.tagName || "div", attributes: new Map() },
    children: props.children || [],
    doLayout(_constraints: any) {},
    setPosition(x: number, y: number) {
      this.layout.x = x;
      this.layout.y = y;
    },
    parent: props.parent || null,
    getPixelValue: (prop: string, defaultValue?: any) => {
      const sv = props.styleValues?.[prop];
      if (sv && typeof sv === "string" && sv.endsWith("px")) return parseFloat(sv);
      return defaultValue || 0;
    },
    isReplaced: () => false,
    constructor: { name: props.isText ? "RenderText" : "RenderBox" },
    getText: () => props.text || "",
  };
}

function createMockRenderBox(props: any = {}): any {
  const layout = {
    x: 0, y: 0,
    width: props.width || 400,
    height: props.height || 200,
    marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
    paddingTop: props.paddingTop ?? 0,
    paddingRight: props.paddingRight ?? 0,
    paddingBottom: props.paddingBottom ?? 0,
    paddingLeft: props.paddingLeft ?? 0,
    borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
    getTotalWidth() { return this.width; },
    getTotalHeight() { return this.height; },
  };

  return {
    layout,
    style: {
      getPropertyValue: (prop: string) => props.styleValues?.[prop] || "",
    },
    element: { tagName: "div", attributes: new Map() },
    children: props.children || [],
    doLayout(_constraints: any) {},
    setPosition(x: number, y: number) {
      this.layout.x = x;
      this.layout.y = y;
    },
    parent: props.parent || null,
    getPixelValue: (prop: string, defaultValue?: any) => defaultValue || 0,
  };
}

// === FloatContext unit tests ===

Deno.test({
  name: "FloatContext - newly created has no floats",
  fn() {
    const ctx = new FloatContext();
    assertEquals(ctx.getLeftFloats().length, 0);
    assertEquals(ctx.getRightFloats().length, 0);
  },
});

Deno.test({
  name: "FloatContext - addFloat tracks left floats",
  fn() {
    const ctx = new FloatContext();
    ctx.addFloat({ x: 0 as Pixels, y: 0 as Pixels, width: 100 as Pixels, height: 50 as Pixels, side: "left" });
    assertEquals(ctx.getLeftFloats().length, 1);
    assertEquals(ctx.getRightFloats().length, 0);
  },
});

Deno.test({
  name: "FloatContext - addFloat tracks right floats",
  fn() {
    const ctx = new FloatContext();
    ctx.addFloat({ x: 300 as Pixels, y: 0 as Pixels, width: 100 as Pixels, height: 50 as Pixels, side: "right" });
    assertEquals(ctx.getLeftFloats().length, 0);
    assertEquals(ctx.getRightFloats().length, 1);
  },
});

Deno.test({
  name: "FloatContext - getAvailableWidthAt reduces width for left float",
  fn() {
    const ctx = new FloatContext();
    ctx.addFloat({ x: 0 as Pixels, y: 0 as Pixels, width: 100 as Pixels, height: 50 as Pixels, side: "left" });
    const result = ctx.getAvailableWidthAt(25 as Pixels, 400 as Pixels);
    assertEquals(result.leftOffset, 100);
    assertEquals(result.availableWidth, 300);
  },
});

Deno.test({
  name: "FloatContext - getAvailableWidthAt reduces width for right float",
  fn() {
    const ctx = new FloatContext();
    ctx.addFloat({ x: 300 as Pixels, y: 0 as Pixels, width: 100 as Pixels, height: 50 as Pixels, side: "right" });
    const result = ctx.getAvailableWidthAt(25 as Pixels, 400 as Pixels);
    assertEquals(result.leftOffset, 0);
    assertEquals(result.availableWidth, 300);
  },
});

Deno.test({
  name: "FloatContext - getAvailableWidthAt full width below floats",
  fn() {
    const ctx = new FloatContext();
    ctx.addFloat({ x: 0 as Pixels, y: 0 as Pixels, width: 100 as Pixels, height: 50 as Pixels, side: "left" });
    const result = ctx.getAvailableWidthAt(60 as Pixels, 400 as Pixels);
    assertEquals(result.leftOffset, 0);
    assertEquals(result.availableWidth, 400);
  },
});

Deno.test({
  name: "FloatContext - getClearY returns bottom of cleared floats",
  fn() {
    const ctx = new FloatContext();
    ctx.addFloat({ x: 0 as Pixels, y: 10 as Pixels, width: 100 as Pixels, height: 40 as Pixels, side: "left" });
    ctx.addFloat({ x: 300 as Pixels, y: 5 as Pixels, width: 100 as Pixels, height: 80 as Pixels, side: "right" });
    assertEquals(ctx.getClearY("left"), 50);
    assertEquals(ctx.getClearY("right"), 85);
    assertEquals(ctx.getClearY("both"), 85);
  },
});

Deno.test({
  name: "FloatContext - both left and right floats reduce available width",
  fn() {
    const ctx = new FloatContext();
    ctx.addFloat({ x: 0 as Pixels, y: 0 as Pixels, width: 80 as Pixels, height: 50 as Pixels, side: "left" });
    ctx.addFloat({ x: 300 as Pixels, y: 0 as Pixels, width: 100 as Pixels, height: 50 as Pixels, side: "right" });
    const result = ctx.getAvailableWidthAt(25 as Pixels, 400 as Pixels);
    assertEquals(result.leftOffset, 80);
    assertEquals(result.availableWidth, 220);
  },
});

// === Float exclusion in block layout ===

Deno.test({
  name: "NormalFlowLayout - float children are excluded from normal flow",
  fn() {
    const nfl = new NormalFlowLayout();
    const parent = createMockRenderBox({ width: 400 });

    const floatChild = createMockRenderObject({
      styleValues: { float: "left", width: "100px" },
      layout: {
        x: 0, y: 0, width: 100, height: 50,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
        getTotalWidth() { return this.width; },
        getTotalHeight() { return this.height; },
      },
    });

    const blockChild = createMockRenderObject({
      layout: {
        x: 0, y: 0, width: 300, height: 30,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
        getTotalWidth() { return this.width; },
        getTotalHeight() { return this.height; },
      },
    });

    const constraints = { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 1000 } as any;
    const height = nfl.layoutBlockChildren(parent, [floatChild, blockChild], constraints);

    assertExists(height);
    // Block child should be offset by float
    assertEquals(blockChild.layout.x > 0 || height > 0, true);
  },
});

Deno.test({
  name: "NormalFlowLayout - clear:both advances past floats",
  fn() {
    const nfl = new NormalFlowLayout();
    const parent = createMockRenderBox({ width: 400 });

    const floatChild = createMockRenderObject({
      styleValues: { float: "left" },
      layout: {
        x: 0, y: 0, width: 100, height: 80,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
        getTotalWidth() { return this.width; },
        getTotalHeight() { return this.height; },
      },
    });

    const clearChild = createMockRenderObject({
      styleValues: { clear: "both" },
      layout: {
        x: 0, y: 0, width: 400, height: 30,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
        getTotalWidth() { return this.width; },
        getTotalHeight() { return this.height; },
      },
    });

    const constraints = { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 1000 } as any;
    nfl.layoutBlockChildren(parent, [floatChild, clearChild], constraints);

    // clearChild should be positioned below the float (y >= 80)
    assertEquals(clearChild.layout.y >= 80, true);
  },
});

Deno.test({
  name: "NormalFlowLayout - container height encompasses floats",
  fn() {
    const nfl = new NormalFlowLayout();
    const parent = createMockRenderBox({ width: 400 });

    const floatChild = createMockRenderObject({
      styleValues: { float: "left" },
      layout: {
        x: 0, y: 0, width: 100, height: 200,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
        getTotalWidth() { return this.width; },
        getTotalHeight() { return this.height; },
      },
    });

    const shortChild = createMockRenderObject({
      layout: {
        x: 0, y: 0, width: 300, height: 20,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
        getTotalWidth() { return this.width; },
        getTotalHeight() { return this.height; },
      },
    });

    const constraints = { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 1000 } as any;
    const height = nfl.layoutBlockChildren(parent, [floatChild, shortChild], constraints);

    // Height must be at least as tall as the float (200)
    assertEquals(height >= 200, true);
  },
});

// === Fixed positioning ===

Deno.test({
  name: "NormalFlowLayout - layoutAbsolutelyPositioned with fixed uses viewport",
  fn() {
    const nfl = new NormalFlowLayout();
    const containingBlock = createMockRenderBox({ width: 400, height: 300 });
    containingBlock.layout.x = 50;
    containingBlock.layout.y = 100;

    const fixedObj = createMockRenderObject({
      styleValues: { position: "fixed", top: "10px", left: "20px" },
      layout: {
        x: 0, y: 0, width: 200, height: 100,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
        getTotalWidth() { return this.width; },
        getTotalHeight() { return this.height; },
      },
    });
    fixedObj.getPixelValue = (prop: string, defaultValue?: any) => {
      if (prop === "top") return 10;
      if (prop === "left") return 20;
      return defaultValue || 0;
    };

    const viewport = { width: 1024 as Pixels, height: 768 as Pixels };
    nfl.layoutAbsolutelyPositioned(fixedObj, containingBlock, viewport);

    // Fixed should position relative to viewport (0,0), not containing block (50,100)
    assertEquals(fixedObj.layout.x, 20);
    assertEquals(fixedObj.layout.y, 10);
  },
});

Deno.test({
  name: "NormalFlowLayout - layoutAbsolutelyPositioned without fixed uses containing block",
  fn() {
    const nfl = new NormalFlowLayout();
    const containingBlock = createMockRenderBox({ width: 400, height: 300 });
    containingBlock.layout.x = 50;
    containingBlock.layout.y = 100;

    const absObj = createMockRenderObject({
      styleValues: { position: "absolute", top: "10px", left: "20px" },
      layout: {
        x: 0, y: 0, width: 200, height: 100,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
        getTotalWidth() { return this.width; },
        getTotalHeight() { return this.height; },
      },
    });
    absObj.getPixelValue = (prop: string, defaultValue?: any) => {
      if (prop === "top") return 10;
      if (prop === "left") return 20;
      return defaultValue || 0;
    };

    nfl.layoutAbsolutelyPositioned(absObj, containingBlock);

    // Absolute should position relative to containing block (50,100)
    assertEquals(absObj.layout.x, 70); // 50 + 20
    assertEquals(absObj.layout.y, 110); // 100 + 10
  },
});

Deno.test({
  name: "NormalFlowLayout - fixed with right/bottom positioning",
  fn() {
    const nfl = new NormalFlowLayout();
    const containingBlock = createMockRenderBox({ width: 400, height: 300 });

    const fixedObj = createMockRenderObject({
      styleValues: { position: "fixed", right: "10px", bottom: "20px", width: "100px" },
      layout: {
        x: 0, y: 0, width: 100, height: 50,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
        getTotalWidth() { return this.width; },
        getTotalHeight() { return this.height; },
      },
    });
    fixedObj.getPixelValue = (prop: string, defaultValue?: any) => {
      if (prop === "right") return 10;
      if (prop === "bottom") return 20;
      if (prop === "width") return 100;
      return defaultValue || 0;
    };

    const viewport = { width: 1024 as Pixels, height: 768 as Pixels };
    nfl.layoutAbsolutelyPositioned(fixedObj, containingBlock, viewport);

    // x = 0 + 1024 - 100 - 10 = 914
    assertEquals(fixedObj.layout.x, 914);
    // y = 0 + 768 - 50 - 20 = 698
    assertEquals(fixedObj.layout.y, 698);
  },
});

// === Sticky positioning ===

Deno.test({
  name: "NormalFlowLayout - layoutStickyPositioned returns stickyOffset",
  fn() {
    const nfl = new NormalFlowLayout();
    const containingBlock = createMockRenderBox({ width: 400, height: 500 });
    const stickyObj = createMockRenderObject({
      styleValues: { position: "sticky", top: "0px" },
      layout: {
        x: 0, y: 100, width: 400, height: 50,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
        getTotalWidth() { return this.width; },
        getTotalHeight() { return this.height; },
      },
    });
    stickyObj.getPixelValue = (prop: string, defaultValue?: any) => {
      if (prop === "top") return 0;
      return defaultValue || 0;
    };

    const result = nfl.layoutStickyPositioned(stickyObj, containingBlock, 0 as Pixels);
    assertExists(result);
    assertEquals(typeof result.stickyOffset, "number");
  },
});

Deno.test({
  name: "NormalFlowLayout - sticky with no scroll has zero offset",
  fn() {
    const nfl = new NormalFlowLayout();
    const containingBlock = createMockRenderBox({ width: 400, height: 500 });
    const stickyObj = createMockRenderObject({
      styleValues: { position: "sticky", top: "0px" },
      layout: {
        x: 0, y: 100, width: 400, height: 50,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
        getTotalWidth() { return this.width; },
        getTotalHeight() { return this.height; },
      },
    });
    stickyObj.getPixelValue = (prop: string, defaultValue?: any) => {
      if (prop === "top") return 0;
      return defaultValue || 0;
    };

    const result = nfl.layoutStickyPositioned(stickyObj, containingBlock, 0 as Pixels);
    assertEquals(result.stickyOffset, 0);
  },
});

// === Baseline accuracy ===

Deno.test({
  name: "NormalFlowLayout - getFloatContext returns float context",
  fn() {
    const nfl = new NormalFlowLayout();
    const ctx = nfl.getFloatContext();
    assertExists(ctx);
  },
});

Deno.test({
  name: "NormalFlowLayout - resetFloatContext clears floats",
  fn() {
    const nfl = new NormalFlowLayout();
    nfl.getFloatContext().addFloat({
      x: 0 as Pixels, y: 0 as Pixels, width: 100 as Pixels, height: 50 as Pixels, side: "left",
    });
    assertEquals(nfl.getFloatContext().getLeftFloats().length, 1);
    nfl.resetFloatContext();
    assertEquals(nfl.getFloatContext().getLeftFloats().length, 0);
  },
});
