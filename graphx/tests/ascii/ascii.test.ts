import { assertEquals, assert, assertNotEquals } from "@std/assert";
import { Graph } from "../../src/graph/Graph.ts";
import { GraphNode } from "../../src/graph/GraphNode.ts";
import { GraphEdge } from "../../src/graph/GraphEdge.ts";
import { ASCIIRenderer, render } from "../../src/ascii/mod.ts";
import type { LayoutResult } from "../../src/layout/types.ts";

function createSimpleGraph(): { graph: Graph; layout: LayoutResult } {
  const graph = new Graph();
  graph.addNode(new GraphNode("a", "A", "A"));
  graph.addNode(new GraphNode("b", "B", "B"));
  graph.addEdge(new GraphEdge("e1", "a", "b"));
  const layout: LayoutResult = {
    nodes: [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 100, y: 0 },
    ],
    width: 200,
    height: 50,
  };
  return { graph, layout };
}

Deno.test("ASCIIRenderer - single node renders as box with label", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("n1", null, "Hello"));
  const layout: LayoutResult = {
    nodes: [{ id: "n1", x: 0, y: 0 }],
    width: 100,
    height: 50,
  };
  const result = new ASCIIRenderer(graph, layout).render();
  assert(result.includes("Hello"), "Should contain the label");
  assert(result.includes("\u250C"), "Should contain top-left corner");
  assert(result.includes("\u2518"), "Should contain bottom-right corner");
});

Deno.test("ASCIIRenderer - two connected nodes with edge line", () => {
  const { graph, layout } = createSimpleGraph();
  const result = new ASCIIRenderer(graph, layout).render();
  assert(result.includes("A"), "Should contain label A");
  assert(result.includes("B"), "Should contain label B");
  // Should have horizontal edge char or arrow
  assert(
    result.includes("\u2500") || result.includes("\u2192"),
    "Should contain horizontal edge or arrow",
  );
});

Deno.test("ASCIIRenderer - directed edges show arrows", () => {
  const { graph, layout } = createSimpleGraph();
  const result = new ASCIIRenderer(graph, layout, { arrows: true }).render();
  const hasArrow =
    result.includes("\u2192") ||
    result.includes("\u2190") ||
    result.includes("\u2191") ||
    result.includes("\u2193");
  assert(hasArrow, "Should contain an arrow character");
});

Deno.test("ASCIIRenderer - arrows disabled", () => {
  const { graph, layout } = createSimpleGraph();
  const result = new ASCIIRenderer(graph, layout, { arrows: false }).render();
  // Arrows should not be present at edge endpoints, but horizontal lines should
  // The edge chars should be box-drawing only
  assert(result.length > 0, "Should produce output");
});

Deno.test("ASCIIRenderer - empty graph returns empty string", () => {
  const graph = new Graph();
  const layout: LayoutResult = { nodes: [], width: 0, height: 0 };
  const result = new ASCIIRenderer(graph, layout).render();
  assertEquals(result, "");
});

Deno.test("ASCIIRenderer - node labels appear inside boxes", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("x", null, "MyLabel"));
  const layout: LayoutResult = {
    nodes: [{ id: "x", x: 0, y: 0 }],
    width: 100,
    height: 50,
  };
  const result = new ASCIIRenderer(graph, layout).render();
  assert(result.includes("MyLabel"), "Label must appear in output");
});

Deno.test("ASCIIRenderer - multiple edges render correctly", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("a", null, "A"));
  graph.addNode(new GraphNode("b", null, "B"));
  graph.addNode(new GraphNode("c", null, "C"));
  graph.addEdge(new GraphEdge("e1", "a", "b"));
  graph.addEdge(new GraphEdge("e2", "b", "c"));
  const layout: LayoutResult = {
    nodes: [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 100, y: 0 },
      { id: "c", x: 200, y: 0 },
    ],
    width: 300,
    height: 50,
  };
  const result = new ASCIIRenderer(graph, layout).render();
  assert(result.includes("A"), "Should have A");
  assert(result.includes("B"), "Should have B");
  assert(result.includes("C"), "Should have C");
});

Deno.test("ASCIIRenderer - edge labels at midpoint", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("a", null, "A"));
  graph.addNode(new GraphNode("b", null, "B"));
  graph.addEdge(new GraphEdge("e1", "a", "b", 1, undefined, "link"));
  const layout: LayoutResult = {
    nodes: [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 200, y: 0 },
    ],
    width: 300,
    height: 50,
  };
  const result = new ASCIIRenderer(graph, layout, { showEdgeLabels: true }).render();
  assert(result.includes("link"), "Edge label should appear");
});

Deno.test("ASCIIRenderer - large graph with 5+ nodes renders without error", () => {
  const graph = new Graph();
  for (let i = 0; i < 6; i++) {
    graph.addNode(new GraphNode(`n${i}`, null, `Node${i}`));
  }
  for (let i = 0; i < 5; i++) {
    graph.addEdge(new GraphEdge(`e${i}`, `n${i}`, `n${i + 1}`));
  }
  const layout: LayoutResult = {
    nodes: Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, x: i * 120, y: (i % 2) * 80 })),
    width: 800,
    height: 200,
  };
  const result = new ASCIIRenderer(graph, layout).render();
  assert(result.length > 0, "Should produce output");
  for (let i = 0; i < 6; i++) {
    assert(result.includes(`Node${i}`), `Should contain Node${i}`);
  }
});

Deno.test("ASCIIRenderer - convenience render() function works", () => {
  const { graph, layout } = createSimpleGraph();
  const result = render(graph, layout);
  assert(result.includes("A"), "Convenience function should produce output with label A");
  assert(result.includes("B"), "Convenience function should produce output with label B");
});

Deno.test("ASCIIRenderer - double border style", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("n", null, "X"));
  const layout: LayoutResult = {
    nodes: [{ id: "n", x: 0, y: 0 }],
    width: 50,
    height: 50,
  };
  const result = new ASCIIRenderer(graph, layout, { border: "double" }).render();
  assert(result.includes("\u2554"), "Should use double top-left corner");
  assert(result.includes("\u2550"), "Should use double horizontal");
  assert(result.includes("\u2551"), "Should use double vertical");
});

Deno.test("ASCIIRenderer - rounded border style", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("n", null, "X"));
  const layout: LayoutResult = {
    nodes: [{ id: "n", x: 0, y: 0 }],
    width: 50,
    height: 50,
  };
  const result = new ASCIIRenderer(graph, layout, { border: "rounded" }).render();
  assert(result.includes("\u256D"), "Should use rounded top-left corner");
  assert(result.includes("\u256E"), "Should use rounded top-right corner");
});

Deno.test("ASCIIRenderer - vertical edge with arrow", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("a", null, "Top"));
  graph.addNode(new GraphNode("b", null, "Bot"));
  graph.addEdge(new GraphEdge("e1", "a", "b"));
  const layout: LayoutResult = {
    nodes: [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 150 },
    ],
    width: 50,
    height: 200,
  };
  const result = new ASCIIRenderer(graph, layout, { arrows: true }).render();
  assert(result.includes("\u2193") || result.includes("\u2502"), "Should have vertical edge or down arrow");
});
