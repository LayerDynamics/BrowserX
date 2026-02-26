/**
 * Integration tests: ASCII + TDOM full pipeline
 */
import { assertEquals, assert } from "@std/assert";
import { Graph } from "../../src/graph/Graph.ts";
import { GraphNode } from "../../src/graph/GraphNode.ts";
import { GraphEdge } from "../../src/graph/GraphEdge.ts";
import { grid } from "../../src/layout/mod.ts";
import { ASCIIRenderer, render as renderASCII } from "../../src/ascii/mod.ts";
import { TDomNode, TDomRenderer } from "../../src/tdom/mod.ts";

function makeGraph(): Graph {
  const g = new Graph();
  g.addNode(new GraphNode("a", null, "Alpha"));
  g.addNode(new GraphNode("b", null, "Beta"));
  g.addNode(new GraphNode("c", null, "Gamma"));
  g.addEdge(new GraphEdge("e1", "a", "b"));
  g.addEdge(new GraphEdge("e2", "b", "c"));
  return g;
}

// Manual layout with wide spacing so labels fit at any scale
function makeLayout(): LayoutResult {
  return {
    nodes: [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 200, y: 0 },
      { id: "c", x: 400, y: 0 },
    ],
    width: 500,
    height: 100,
  };
}

Deno.test("Full pipeline: graph → layout → ASCII render", () => {
  const g = makeGraph();
  const layout = makeLayout();
  const output = renderASCII(g, layout);
  assert(output.length > 0, "ASCII output should be non-empty");
  assert(output.includes("Alpha"), "Should contain node label Alpha");
  assert(output.includes("Beta"), "Should contain node label Beta");
  assert(output.includes("Gamma"), "Should contain node label Gamma");
});

Deno.test("Full pipeline: graph → layout → TDOM render", () => {
  const g = makeGraph();
  const layout = makeLayout();

  // Build a TDOM tree from graph nodes
  const nodeBoxes = layout.nodes.map((ln) => {
    const node = g.getNode(ln.id);
    return TDomNode.box(
      [TDomNode.text(node?.label ?? ln.id, { fg: "cyan", bold: true })],
      { border: "rounded" },
    );
  });

  const tree = TDomNode.row(nodeBoxes);
  const renderer = new TDomRenderer();
  const output = renderer.render(tree);
  assert(output.length > 0, "TDOM output should be non-empty");
  assert(output.includes("Alpha"), "Should contain Alpha");
  assert(output.includes("Beta"), "Should contain Beta");
  assert(output.includes("╭"), "Should have rounded border");
});

Deno.test("ASCII and TDOM both produce output for same graph", () => {
  const g = makeGraph();
  const layout = grid(g, { columns: 3, cellWidth: 100, cellHeight: 50 });

  const ascii = renderASCII(g, layout);
  const tdomTree = TDomNode.column(
    layout.nodes.map((ln) => {
      const node = g.getNode(ln.id);
      return TDomNode.text(node?.label ?? ln.id);
    }),
  );
  const tdom = new TDomRenderer().render(tdomTree);

  assert(ascii.length > 0);
  assert(tdom.length > 0);
  assert(ascii !== tdom, "ASCII and TDOM outputs should differ");
});

Deno.test("Exports are accessible from graphx/mod.ts", () => {
  // These would fail at import time if not exported
  assert(ASCIIRenderer !== undefined);
  assert(renderASCII !== undefined);
  assert(TDomNode !== undefined);
  assert(TDomRenderer !== undefined);
});
