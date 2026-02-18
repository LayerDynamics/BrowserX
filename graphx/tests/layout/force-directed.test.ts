import { assertEquals, assert } from "@std/assert";
import { forceDirected } from "../../src/layout/mod.ts";
import { Graph, GraphNode, GraphEdge } from "../../src/graph/mod.ts";

Deno.test("forceDirected - all nodes get positions", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addNode(new GraphNode("C", "Node C"));
  graph.addEdge(new GraphEdge("AB", "A", "B"));

  const result = forceDirected(graph);

  assertEquals(result.nodes.length, 3);
  for (const node of result.nodes) {
    assert(typeof node.x === "number");
    assert(typeof node.y === "number");
    assert(!isNaN(node.x));
    assert(!isNaN(node.y));
  }
});

Deno.test("forceDirected - positions within bounds", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addNode(new GraphNode("C", "Node C"));

  const width = 400;
  const height = 300;
  const result = forceDirected(graph, { width, height });

  for (const node of result.nodes) {
    assert(node.x >= 0 && node.x <= width, `x=${node.x} not in [0, ${width}]`);
    assert(node.y >= 0 && node.y <= height, `y=${node.y} not in [0, ${height}]`);
  }
});

Deno.test("forceDirected - returns correct width/height", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));

  const width = 500;
  const height = 400;
  const result = forceDirected(graph, { width, height });

  assertEquals(result.width, width);
  assertEquals(result.height, height);
});

Deno.test("forceDirected - seeded layout is reproducible", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addNode(new GraphNode("C", "Node C"));
  graph.addEdge(new GraphEdge("AB", "A", "B"));

  const seed = 12345;
  const result1 = forceDirected(graph, { seed, iterations: 10 });
  const result2 = forceDirected(graph, { seed, iterations: 10 });

  assertEquals(result1.nodes.length, result2.nodes.length);
  for (let i = 0; i < result1.nodes.length; i++) {
    assertEquals(result1.nodes[i].id, result2.nodes[i].id);
    assertEquals(result1.nodes[i].x, result2.nodes[i].x);
    assertEquals(result1.nodes[i].y, result2.nodes[i].y);
  }
});

Deno.test("forceDirected - different seeds produce different layouts", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addNode(new GraphNode("C", "Node C"));
  graph.addEdge(new GraphEdge("AB", "A", "B"));

  const result1 = forceDirected(graph, { seed: 111, iterations: 10 });
  const result2 = forceDirected(graph, { seed: 999, iterations: 10 });

  // At least one node should have different positions
  let foundDifference = false;
  for (let i = 0; i < result1.nodes.length; i++) {
    if (
      result1.nodes[i].x !== result2.nodes[i].x ||
      result1.nodes[i].y !== result2.nodes[i].y
    ) {
      foundDifference = true;
      break;
    }
  }
  assert(foundDifference, "Different seeds should produce different layouts");
});

Deno.test("forceDirected - single node positioned in graph", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));

  const result = forceDirected(graph, { width: 800, height: 600 });

  assertEquals(result.nodes.length, 1);
  const node = result.nodes[0];
  assert(node.x >= 0 && node.x <= 800);
  assert(node.y >= 0 && node.y <= 600);
});

Deno.test("forceDirected - two connected nodes not at same position", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addEdge(new GraphEdge("AB", "A", "B"));

  const result = forceDirected(graph, { iterations: 50 });

  assertEquals(result.nodes.length, 2);
  const nodeA = result.nodes.find((n) => n.id === "A")!;
  const nodeB = result.nodes.find((n) => n.id === "B")!;

  assert(nodeA.x !== nodeB.x || nodeA.y !== nodeB.y, "Connected nodes should not be at same position");
});

Deno.test("forceDirected - custom options", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));

  const result = forceDirected(graph, {
    width: 1000,
    height: 800,
    iterations: 20,
  });

  assertEquals(result.width, 1000);
  assertEquals(result.height, 800);
  assertEquals(result.nodes.length, 2);
});
