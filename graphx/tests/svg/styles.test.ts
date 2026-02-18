import { assertEquals, assert } from "@std/assert";
import { DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from "../../src/svg/mod.ts";
import type { Theme, NodeStyle, EdgeStyle } from "../../src/svg/mod.ts";

Deno.test("styles - DEFAULT_LIGHT_THEME is defined", () => {
  assert(DEFAULT_LIGHT_THEME !== undefined, "DEFAULT_LIGHT_THEME should be defined");
  assert(DEFAULT_LIGHT_THEME !== null, "DEFAULT_LIGHT_THEME should not be null");
});

Deno.test("styles - DEFAULT_LIGHT_THEME has node/edge/background properties", () => {
  assert("node" in DEFAULT_LIGHT_THEME, "Should have node property");
  assert("edge" in DEFAULT_LIGHT_THEME, "Should have edge property");
  assert("background" in DEFAULT_LIGHT_THEME, "Should have background property");
});

Deno.test("styles - DEFAULT_LIGHT_THEME node has all required properties", () => {
  const node = DEFAULT_LIGHT_THEME.node;

  assert("fill" in node, "Node should have fill");
  assert("stroke" in node, "Node should have stroke");
  assert("strokeWidth" in node, "Node should have strokeWidth");
  assert("radius" in node, "Node should have radius");
  assert("fontSize" in node, "Node should have fontSize");
  assert("fontFamily" in node, "Node should have fontFamily");
  assert("labelColor" in node, "Node should have labelColor");

  // Check types
  assertEquals(typeof node.fill, "string");
  assertEquals(typeof node.stroke, "string");
  assertEquals(typeof node.strokeWidth, "number");
  assertEquals(typeof node.radius, "number");
  assertEquals(typeof node.fontSize, "number");
  assertEquals(typeof node.fontFamily, "string");
  assertEquals(typeof node.labelColor, "string");
});

Deno.test("styles - DEFAULT_DARK_THEME is defined", () => {
  assert(DEFAULT_DARK_THEME !== undefined, "DEFAULT_DARK_THEME should be defined");
  assert(DEFAULT_DARK_THEME !== null, "DEFAULT_DARK_THEME should not be null");
});

Deno.test("styles - DEFAULT_DARK_THEME has different colors than light theme", () => {
  assert(
    DEFAULT_DARK_THEME.background !== DEFAULT_LIGHT_THEME.background,
    "Background colors should differ",
  );
  assert(
    DEFAULT_DARK_THEME.node.fill !== DEFAULT_LIGHT_THEME.node.fill,
    "Node fill colors should differ",
  );
  assert(
    DEFAULT_DARK_THEME.node.stroke !== DEFAULT_LIGHT_THEME.node.stroke,
    "Node stroke colors should differ",
  );
});

Deno.test("styles - Theme type structure", () => {
  // Test that both themes conform to Theme interface
  const lightTheme: Theme = DEFAULT_LIGHT_THEME;
  const darkTheme: Theme = DEFAULT_DARK_THEME;

  assert(lightTheme.node !== undefined, "Light theme should have node");
  assert(lightTheme.edge !== undefined, "Light theme should have edge");
  assert(typeof lightTheme.background === "string", "Light theme background should be string");

  assert(darkTheme.node !== undefined, "Dark theme should have node");
  assert(darkTheme.edge !== undefined, "Dark theme should have edge");
  assert(typeof darkTheme.background === "string", "Dark theme background should be string");
});

Deno.test("styles - NodeStyle has all required properties", () => {
  const nodeStyle: NodeStyle = DEFAULT_LIGHT_THEME.node;

  const requiredProps = [
    "fill",
    "stroke",
    "strokeWidth",
    "radius",
    "fontSize",
    "fontFamily",
    "labelColor",
  ];

  for (const prop of requiredProps) {
    assert(
      prop in nodeStyle,
      `NodeStyle should have ${prop} property`,
    );
  }

  // Verify property types
  assertEquals(typeof nodeStyle.fill, "string");
  assertEquals(typeof nodeStyle.stroke, "string");
  assertEquals(typeof nodeStyle.strokeWidth, "number");
  assertEquals(typeof nodeStyle.radius, "number");
  assertEquals(typeof nodeStyle.fontSize, "number");
  assertEquals(typeof nodeStyle.fontFamily, "string");
  assertEquals(typeof nodeStyle.labelColor, "string");
});

Deno.test("styles - EdgeStyle has all required properties", () => {
  const edgeStyle: EdgeStyle = DEFAULT_LIGHT_THEME.edge;

  const requiredProps = [
    "stroke",
    "strokeWidth",
    "arrowSize",
    "arrowType",
    "fontSize",
    "fontFamily",
    "labelColor",
  ];

  for (const prop of requiredProps) {
    assert(
      prop in edgeStyle,
      `EdgeStyle should have ${prop} property`,
    );
  }

  // Verify property types
  assertEquals(typeof edgeStyle.stroke, "string");
  assertEquals(typeof edgeStyle.strokeWidth, "number");
  assertEquals(typeof edgeStyle.arrowSize, "number");
  assertEquals(typeof edgeStyle.arrowType, "string");
  assert(
    ["open", "filled", "circle"].includes(edgeStyle.arrowType),
    "arrowType should be valid",
  );
  assertEquals(typeof edgeStyle.fontSize, "number");
  assertEquals(typeof edgeStyle.fontFamily, "string");
  assertEquals(typeof edgeStyle.labelColor, "string");
});
