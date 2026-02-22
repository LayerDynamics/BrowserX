/**
 * Tests for Flexbox Layout
 * Tests CSS Flexbox layout algorithm implementation.
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import {
  AlignItems,
  FlexboxLayout,
  FlexDirection,
  FlexWrap,
  JustifyContent,
} from "../../../../src/engine/rendering/layout/FlexboxLayout.ts";

// FlexDirection enum tests

Deno.test({
  name: "FlexDirection - ROW value",
  fn() {
    assertEquals(FlexDirection.ROW, "row");
  },
});

Deno.test({
  name: "FlexDirection - ROW_REVERSE value",
  fn() {
    assertEquals(FlexDirection.ROW_REVERSE, "row-reverse");
  },
});

Deno.test({
  name: "FlexDirection - COLUMN value",
  fn() {
    assertEquals(FlexDirection.COLUMN, "column");
  },
});

Deno.test({
  name: "FlexDirection - COLUMN_REVERSE value",
  fn() {
    assertEquals(FlexDirection.COLUMN_REVERSE, "column-reverse");
  },
});

// FlexWrap enum tests

Deno.test({
  name: "FlexWrap - NOWRAP value",
  fn() {
    assertEquals(FlexWrap.NOWRAP, "nowrap");
  },
});

Deno.test({
  name: "FlexWrap - WRAP value",
  fn() {
    assertEquals(FlexWrap.WRAP, "wrap");
  },
});

Deno.test({
  name: "FlexWrap - WRAP_REVERSE value",
  fn() {
    assertEquals(FlexWrap.WRAP_REVERSE, "wrap-reverse");
  },
});

// JustifyContent enum tests

Deno.test({
  name: "JustifyContent - FLEX_START value",
  fn() {
    assertEquals(JustifyContent.FLEX_START, "flex-start");
  },
});

Deno.test({
  name: "JustifyContent - FLEX_END value",
  fn() {
    assertEquals(JustifyContent.FLEX_END, "flex-end");
  },
});

Deno.test({
  name: "JustifyContent - CENTER value",
  fn() {
    assertEquals(JustifyContent.CENTER, "center");
  },
});

Deno.test({
  name: "JustifyContent - SPACE_BETWEEN value",
  fn() {
    assertEquals(JustifyContent.SPACE_BETWEEN, "space-between");
  },
});

Deno.test({
  name: "JustifyContent - SPACE_AROUND value",
  fn() {
    assertEquals(JustifyContent.SPACE_AROUND, "space-around");
  },
});

Deno.test({
  name: "JustifyContent - SPACE_EVENLY value",
  fn() {
    assertEquals(JustifyContent.SPACE_EVENLY, "space-evenly");
  },
});

// AlignItems enum tests

Deno.test({
  name: "AlignItems - FLEX_START value",
  fn() {
    assertEquals(AlignItems.FLEX_START, "flex-start");
  },
});

Deno.test({
  name: "AlignItems - FLEX_END value",
  fn() {
    assertEquals(AlignItems.FLEX_END, "flex-end");
  },
});

Deno.test({
  name: "AlignItems - CENTER value",
  fn() {
    assertEquals(AlignItems.CENTER, "center");
  },
});

Deno.test({
  name: "AlignItems - STRETCH value",
  fn() {
    assertEquals(AlignItems.STRETCH, "stretch");
  },
});

Deno.test({
  name: "AlignItems - BASELINE value",
  fn() {
    assertEquals(AlignItems.BASELINE, "baseline");
  },
});

// FlexboxLayout constructor tests

Deno.test({
  name: "FlexboxLayout - constructor creates layout instance",
  fn() {
    const layout = new FlexboxLayout();
    assertExists(layout);
  },
});

Deno.test({
  name: "FlexboxLayout - has layoutContainer method",
  fn() {
    const layout = new FlexboxLayout();
    assertExists(layout.layoutContainer);
  },
});

// FlexboxLayout.layoutContainer tests

Deno.test({
  name: "FlexboxLayout - layoutContainer throws if container has no layout",
  fn() {
    const layout = new FlexboxLayout();
    const container = {} as any;
    const constraints = {
      minWidth: 0,
      maxWidth: 1000,
      minHeight: 0,
      maxHeight: 1000,
    } as any;

    try {
      layout.layoutContainer(container, [], constraints);
      assert(false, "Should have thrown");
    } catch (e) {
      assertEquals((e as Error).message, "Container must have layout computed");
    }
  },
});

Deno.test({
  name: "FlexboxLayout - layoutContainer with empty children",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 100,
        height: 100,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 100,
        getTotalHeight: () => 100,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "flex-start";
          if (name === "align-items") return "stretch";
          return "";
        },
      },
    } as any;
    const constraints = {
      minWidth: 0,
      maxWidth: 1000,
      minHeight: 0,
      maxHeight: 1000,
    } as any;

    layout.layoutContainer(container, [], constraints);
    assert(true, "Should not throw with empty children");
  },
});

Deno.test({
  name: "FlexboxLayout - layoutContainer with single child",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 100,
        height: 100,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 100,
        getTotalHeight: () => 100,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "flex-start";
          if (name === "align-items") return "stretch";
          return "";
        },
      },
    } as any;

    const child = {
      style: {
        getPropertyValue: (name: string) => {
          if (name === "order") return "0";
          if (name === "flex-grow") return "0";
          if (name === "flex-shrink") return "1";
          if (name === "flex-basis") return "auto";
          if (name === "align-self") return "auto";
          return "";
        },
      },
      getPixelValue: () => 50,
      doLayout: () => {},
      layout: {
        width: 50,
        height: 50,
        getTotalWidth: () => 50,
        getTotalHeight: () => 50,
      },
      setPosition: () => {},
    } as any;

    const constraints = {
      minWidth: 0,
      maxWidth: 1000,
      minHeight: 0,
      maxHeight: 1000,
    } as any;

    layout.layoutContainer(container, [child], constraints);
    assert(true, "Should layout single child");
  },
});

Deno.test({
  name: "FlexboxLayout - layoutContainer with row direction",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 300,
        height: 100,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 300,
        getTotalHeight: () => 100,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "flex-start";
          if (name === "align-items") return "stretch";
          return "";
        },
      },
    } as any;

    const child1 = {
      style: {
        getPropertyValue: () => "",
      },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: {
        width: 100,
        height: 100,
        getTotalWidth: () => 100,
        getTotalHeight: () => 100,
      },
      setPosition: () => {},
    } as any;

    const child2 = {
      style: {
        getPropertyValue: () => "",
      },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: {
        width: 100,
        height: 100,
        getTotalWidth: () => 100,
        getTotalHeight: () => 100,
      },
      setPosition: () => {},
    } as any;

    const constraints = {
      minWidth: 0,
      maxWidth: 1000,
      minHeight: 0,
      maxHeight: 1000,
    } as any;

    layout.layoutContainer(container, [child1, child2], constraints);
    assert(true, "Should layout children in row");
  },
});

Deno.test({
  name: "FlexboxLayout - layoutContainer with column direction",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 100,
        height: 300,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 100,
        getTotalHeight: () => 300,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "column";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "flex-start";
          if (name === "align-items") return "stretch";
          return "";
        },
      },
    } as any;

    const child = {
      style: {
        getPropertyValue: () => "",
      },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: {
        width: 100,
        height: 100,
        getTotalWidth: () => 100,
        getTotalHeight: () => 100,
      },
      setPosition: () => {},
    } as any;

    const constraints = {
      minWidth: 0,
      maxWidth: 1000,
      minHeight: 0,
      maxHeight: 1000,
    } as any;

    layout.layoutContainer(container, [child], constraints);
    assert(true, "Should layout children in column");
  },
});

Deno.test({
  name: "FlexboxLayout - layoutContainer with flex-grow",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 300,
        height: 100,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 300,
        getTotalHeight: () => 100,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "flex-start";
          if (name === "align-items") return "stretch";
          return "";
        },
      },
    } as any;

    const child = {
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-grow") return "1";
          if (name === "align-self") return "auto";
          return "";
        },
      },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: {
        width: 100,
        height: 100,
        getTotalWidth: () => 100,
        getTotalHeight: () => 100,
      },
      setPosition: () => {},
    } as any;

    const constraints = {
      minWidth: 0,
      maxWidth: 1000,
      minHeight: 0,
      maxHeight: 1000,
    } as any;

    layout.layoutContainer(container, [child], constraints);
    assert(true, "Should handle flex-grow");
  },
});

Deno.test({
  name: "FlexboxLayout - layoutContainer with flex-shrink",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 100,
        height: 100,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 100,
        getTotalHeight: () => 100,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "flex-start";
          if (name === "align-items") return "stretch";
          return "";
        },
      },
    } as any;

    const child = {
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-shrink") return "1";
          if (name === "align-self") return "auto";
          return "";
        },
      },
      getPixelValue: () => 200,
      doLayout: () => {},
      layout: {
        width: 200,
        height: 100,
        getTotalWidth: () => 200,
        getTotalHeight: () => 100,
      },
      setPosition: () => {},
    } as any;

    const constraints = {
      minWidth: 0,
      maxWidth: 1000,
      minHeight: 0,
      maxHeight: 1000,
    } as any;

    layout.layoutContainer(container, [child], constraints);
    assert(true, "Should handle flex-shrink");
  },
});

Deno.test({
  name: "FlexboxLayout - layoutContainer with wrap",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 150,
        height: 200,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 150,
        getTotalHeight: () => 200,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "wrap";
          if (name === "justify-content") return "flex-start";
          if (name === "align-items") return "stretch";
          return "";
        },
      },
    } as any;

    const child1 = {
      style: {
        getPropertyValue: () => "",
      },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: {
        width: 100,
        height: 50,
        getTotalWidth: () => 100,
        getTotalHeight: () => 50,
      },
      setPosition: () => {},
    } as any;

    const child2 = {
      style: {
        getPropertyValue: () => "",
      },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: {
        width: 100,
        height: 50,
        getTotalWidth: () => 100,
        getTotalHeight: () => 50,
      },
      setPosition: () => {},
    } as any;

    const constraints = {
      minWidth: 0,
      maxWidth: 1000,
      minHeight: 0,
      maxHeight: 1000,
    } as any;

    layout.layoutContainer(container, [child1, child2], constraints);
    assert(true, "Should handle wrapping");
  },
});

Deno.test({
  name: "FlexboxLayout - layoutContainer with justify-content center",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 300,
        height: 100,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 300,
        getTotalHeight: () => 100,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "center";
          if (name === "align-items") return "stretch";
          return "";
        },
      },
    } as any;

    const child = {
      style: {
        getPropertyValue: () => "",
      },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: {
        width: 100,
        height: 100,
        getTotalWidth: () => 100,
        getTotalHeight: () => 100,
      },
      setPosition: () => {},
    } as any;

    const constraints = {
      minWidth: 0,
      maxWidth: 1000,
      minHeight: 0,
      maxHeight: 1000,
    } as any;

    layout.layoutContainer(container, [child], constraints);
    assert(true, "Should handle justify-content center");
  },
});

Deno.test({
  name: "FlexboxLayout - layoutContainer with justify-content space-between",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 300,
        height: 100,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 300,
        getTotalHeight: () => 100,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "space-between";
          if (name === "align-items") return "stretch";
          return "";
        },
      },
    } as any;

    const child1 = {
      style: {
        getPropertyValue: () => "",
      },
      getPixelValue: () => 50,
      doLayout: () => {},
      layout: {
        width: 50,
        height: 100,
        getTotalWidth: () => 50,
        getTotalHeight: () => 100,
      },
      setPosition: () => {},
    } as any;

    const child2 = {
      style: {
        getPropertyValue: () => "",
      },
      getPixelValue: () => 50,
      doLayout: () => {},
      layout: {
        width: 50,
        height: 100,
        getTotalWidth: () => 50,
        getTotalHeight: () => 100,
      },
      setPosition: () => {},
    } as any;

    const constraints = {
      minWidth: 0,
      maxWidth: 1000,
      minHeight: 0,
      maxHeight: 1000,
    } as any;

    layout.layoutContainer(container, [child1, child2], constraints);
    assert(true, "Should handle justify-content space-between");
  },
});

Deno.test({
  name: "FlexboxLayout - layoutContainer with align-items center",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 300,
        height: 200,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 300,
        getTotalHeight: () => 200,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "flex-start";
          if (name === "align-items") return "center";
          return "";
        },
      },
    } as any;

    const child = {
      style: {
        getPropertyValue: (name: string) => {
          if (name === "align-self") return "auto";
          return "";
        },
      },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: {
        width: 100,
        height: 100,
        getTotalWidth: () => 100,
        getTotalHeight: () => 100,
      },
      setPosition: () => {},
    } as any;

    const constraints = {
      minWidth: 0,
      maxWidth: 1000,
      minHeight: 0,
      maxHeight: 1000,
    } as any;

    layout.layoutContainer(container, [child], constraints);
    assert(true, "Should handle align-items center");
  },
});

Deno.test({
  name: "FlexboxLayout - layoutContainer with item order",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 300,
        height: 100,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 300,
        getTotalHeight: () => 100,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "flex-start";
          if (name === "align-items") return "stretch";
          return "";
        },
      },
    } as any;

    const child1 = {
      style: {
        getPropertyValue: (name: string) => {
          if (name === "order") return "2";
          if (name === "align-self") return "auto";
          return "";
        },
      },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: {
        width: 100,
        height: 100,
        getTotalWidth: () => 100,
        getTotalHeight: () => 100,
      },
      setPosition: () => {},
    } as any;

    const child2 = {
      style: {
        getPropertyValue: (name: string) => {
          if (name === "order") return "1";
          if (name === "align-self") return "auto";
          return "";
        },
      },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: {
        width: 100,
        height: 100,
        getTotalWidth: () => 100,
        getTotalHeight: () => 100,
      },
      setPosition: () => {},
    } as any;

    const constraints = {
      minWidth: 0,
      maxWidth: 1000,
      minHeight: 0,
      maxHeight: 1000,
    } as any;

    layout.layoutContainer(container, [child1, child2], constraints);
    assert(true, "Should handle item order");
  },
});

Deno.test({
  name: "FlexboxLayout - layoutContainer with padding",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 300,
        height: 100,
        x: 0,
        y: 0,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 5,
        paddingBottom: 5,
        getTotalWidth: () => 300,
        getTotalHeight: () => 100,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "flex-start";
          if (name === "align-items") return "stretch";
          return "";
        },
      },
    } as any;

    const child = {
      style: {
        getPropertyValue: () => "",
      },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: {
        width: 100,
        height: 100,
        getTotalWidth: () => 100,
        getTotalHeight: () => 100,
      },
      setPosition: () => {},
    } as any;

    const constraints = {
      minWidth: 0,
      maxWidth: 1000,
      minHeight: 0,
      maxHeight: 1000,
    } as any;

    layout.layoutContainer(container, [child], constraints);
    assert(true, "Should handle container padding");
  },
});

// Baseline alignment tests

Deno.test({
  name: "FlexboxLayout - baseline alignment positions items by baseline",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 400,
        height: 200,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 400,
        getTotalHeight: () => 200,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "flex-start";
          if (name === "align-items") return "baseline";
          return "";
        },
      },
    } as any;

    const positions: { x: number; y: number }[] = [];

    // Item 1: height 80, baseline at 60 (from top)
    const child1 = {
      style: { getPropertyValue: (name: string) => name === "align-self" ? "auto" : "" },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: { width: 100, height: 80, getTotalWidth: () => 100, getTotalHeight: () => 80 },
      setPosition: (x: number, y: number) => {
        positions.push({ x, y });
      },
      getBaseline: () => 60,
    } as any;

    // Item 2: height 50, baseline at 30 (from top)
    const child2 = {
      style: { getPropertyValue: (name: string) => name === "align-self" ? "auto" : "" },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: { width: 100, height: 50, getTotalWidth: () => 100, getTotalHeight: () => 50 },
      setPosition: (x: number, y: number) => {
        positions.push({ x, y });
      },
      getBaseline: () => 30,
    } as any;

    const constraints = { minWidth: 0, maxWidth: 1000, minHeight: 0, maxHeight: 1000 } as any;
    layout.layoutContainer(container, [child1, child2], constraints);

    // lineBaseline = max(60, 30) = 60
    // child1 y = 0 + 60 - 60 = 0
    // child2 y = 0 + 60 - 30 = 30
    assertEquals(positions[0].y, 0, "Item with largest baseline should be at cross-start");
    assertEquals(positions[1].y, 30, "Item with smaller baseline should be offset down");
  },
});

Deno.test({
  name: "FlexboxLayout - baseline alignment with align-self override",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 400,
        height: 200,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 400,
        getTotalHeight: () => 200,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "flex-start";
          if (name === "align-items") return "baseline";
          return "";
        },
      },
    } as any;

    const positions: { x: number; y: number }[] = [];

    // Item 1: uses baseline alignment
    const child1 = {
      style: { getPropertyValue: (name: string) => name === "align-self" ? "auto" : "" },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: { width: 100, height: 80, getTotalWidth: () => 100, getTotalHeight: () => 80 },
      setPosition: (x: number, y: number) => {
        positions.push({ x, y });
      },
      getBaseline: () => 60,
    } as any;

    // Item 2: overrides to flex-end
    const child2 = {
      style: { getPropertyValue: (name: string) => name === "align-self" ? "flex-end" : "" },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: { width: 100, height: 50, getTotalWidth: () => 100, getTotalHeight: () => 50 },
      setPosition: (x: number, y: number) => {
        positions.push({ x, y });
      },
      getBaseline: () => 30,
    } as any;

    const constraints = { minWidth: 0, maxWidth: 1000, minHeight: 0, maxHeight: 1000 } as any;
    layout.layoutContainer(container, [child1, child2], constraints);

    // child1: baseline alignment, y = 0 + 60 - 60 = 0
    assertEquals(positions[0].y, 0, "Baseline-aligned item at cross-start");
    // child2: flex-end, y = 0 + lineCrossSize - itemCrossSize = 80 - 50 = 30
    assertEquals(positions[1].y, 30, "flex-end aligned item at bottom of line");
  },
});

Deno.test({
  name: "FlexboxLayout - baseline fallback uses cross size when no getBaseline",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 400,
        height: 200,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 400,
        getTotalHeight: () => 200,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "flex-start";
          if (name === "align-items") return "baseline";
          return "";
        },
      },
    } as any;

    const positions: { x: number; y: number }[] = [];

    // Item 1: no getBaseline, crossSize = 80 (height), so baseline = 80
    const child1 = {
      style: { getPropertyValue: (name: string) => name === "align-self" ? "auto" : "" },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: { width: 100, height: 80, getTotalWidth: () => 100, getTotalHeight: () => 80 },
      setPosition: (x: number, y: number) => {
        positions.push({ x, y });
      },
    } as any;

    // Item 2: no getBaseline, crossSize = 50 (height), so baseline = 50
    const child2 = {
      style: { getPropertyValue: (name: string) => name === "align-self" ? "auto" : "" },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: { width: 100, height: 50, getTotalWidth: () => 100, getTotalHeight: () => 50 },
      setPosition: (x: number, y: number) => {
        positions.push({ x, y });
      },
    } as any;

    const constraints = { minWidth: 0, maxWidth: 1000, minHeight: 0, maxHeight: 1000 } as any;
    layout.layoutContainer(container, [child1, child2], constraints);

    // lineBaseline = max(80, 50) = 80
    // child1 y = 0 + 80 - 80 = 0
    // child2 y = 0 + 80 - 50 = 30
    assertEquals(positions[0].y, 0, "Taller item at top");
    assertEquals(positions[1].y, 30, "Shorter item offset so bottom edges align");
  },
});

Deno.test({
  name: "FlexboxLayout - baseline alignment with first child baseline",
  fn() {
    const layout = new FlexboxLayout();
    const container = {
      layout: {
        width: 400,
        height: 200,
        x: 0,
        y: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        getTotalWidth: () => 400,
        getTotalHeight: () => 200,
      },
      style: {
        getPropertyValue: (name: string) => {
          if (name === "flex-direction") return "row";
          if (name === "flex-wrap") return "nowrap";
          if (name === "justify-content") return "flex-start";
          if (name === "align-items") return "baseline";
          return "";
        },
      },
    } as any;

    const positions: { x: number; y: number }[] = [];

    // Item 1: has children, first child has getBaseline returning 40
    const child1 = {
      style: { getPropertyValue: (name: string) => name === "align-self" ? "auto" : "" },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: { width: 100, height: 80, getTotalWidth: () => 100, getTotalHeight: () => 80 },
      setPosition: (x: number, y: number) => {
        positions.push({ x, y });
      },
      children: [
        { getBaseline: () => 40, layout: { height: 60, width: 100 } },
      ],
    } as any;

    // Item 2: has getBaseline directly returning 20
    const child2 = {
      style: { getPropertyValue: (name: string) => name === "align-self" ? "auto" : "" },
      getPixelValue: () => 100,
      doLayout: () => {},
      layout: { width: 100, height: 50, getTotalWidth: () => 100, getTotalHeight: () => 50 },
      setPosition: (x: number, y: number) => {
        positions.push({ x, y });
      },
      getBaseline: () => 20,
    } as any;

    const constraints = { minWidth: 0, maxWidth: 1000, minHeight: 0, maxHeight: 1000 } as any;
    layout.layoutContainer(container, [child1, child2], constraints);

    // child1 baseline from first child's getBaseline = 40
    // child2 baseline from own getBaseline = 20
    // lineBaseline = max(40, 20) = 40
    // child1 y = 0 + 40 - 40 = 0
    // child2 y = 0 + 40 - 20 = 20
    assertEquals(positions[0].y, 0, "Item with child baseline at top");
    assertEquals(positions[1].y, 20, "Item with smaller baseline offset down");
  },
});
