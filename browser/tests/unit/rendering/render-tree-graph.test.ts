import { assertEquals } from "@std/assert";
import { assertStringIncludes } from "@std/assert/string-includes";
import {
  renderTreeAsSvg,
  renderTreeToGraph,
} from "../../../src/engine/rendering/rendering/render-tree-graph.ts";
import type { RenderObject } from "../../../src/engine/rendering/rendering/RenderObject.ts";

/** Create a minimal mock RenderObject for testing */
function mockRenderObject(
  id: string,
  tagName: string,
  children: RenderObject[] = [],
): RenderObject {
  const obj = {
    id,
    element: { tagName },
    children,
    parent: null,
    nextSibling: null,
    layout: null,
    needsLayout: true,
    needsPaint: false,
    paintLayer: null,
    style: { getPropertyValue: () => "" },
    constructor: { name: "RenderBlock" },
    markNeedsLayout: () => {},
    markNeedsPaint: () => {},
    appendChild: () => {},
    removeChild: () => {},
    insertBefore: () => {},
    visitChildren: () => {},
    findAncestor: () => null,
    getDepth: () => 0,
    isAncestorOf: () => false,
    isBlock: () => true,
    isInline: () => false,
    isReplaced: () => false,
    createsStackingContext: () => false,
    getPixelValue: () => 0,
    toString: () => `RenderBlock(${tagName})`,
    debugTree: () => "",
  } as unknown as RenderObject;

  // Set constructor name properly
  Object.defineProperty(obj, "constructor", { value: { name: "RenderBlock" } });

  return obj;
}

Deno.test("renderTreeToGraph creates correct node and edge count", () => {
  const child1 = mockRenderObject("2", "SPAN");
  const child2 = mockRenderObject("3", "P");
  const root = mockRenderObject("1", "DIV", [child1, child2]);

  const graph = renderTreeToGraph(root);

  assertEquals(graph.nodeCount, 3);
  assertEquals(graph.edgeCount, 2);
});

Deno.test("renderTreeToGraph captures node data correctly", () => {
  const root = mockRenderObject("1", "DIV");
  const graph = renderTreeToGraph(root);

  const node = graph.getNode("1");
  assertEquals(node?.data.tagName, "DIV");
  assertEquals(node?.data.needsLayout, true);
  assertEquals(node?.data.needsPaint, false);
  assertEquals(node?.label, "RenderBlock(DIV)");
});

Deno.test("renderTreeToGraph handles single node", () => {
  const root = mockRenderObject("1", "BODY");
  const graph = renderTreeToGraph(root);

  assertEquals(graph.nodeCount, 1);
  assertEquals(graph.edgeCount, 0);
});

Deno.test("renderTreeAsSvg returns valid SVG", () => {
  const child = mockRenderObject("2", "SPAN");
  const root = mockRenderObject("1", "DIV", [child]);

  const svg = renderTreeAsSvg(root);

  assertStringIncludes(svg, "<svg");
  assertStringIncludes(svg, "</svg>");
  assertStringIncludes(svg, "RenderBlock(DIV)");
  assertStringIncludes(svg, "RenderBlock(SPAN)");
});
