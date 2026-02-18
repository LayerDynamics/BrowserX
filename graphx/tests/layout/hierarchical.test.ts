import { assertEquals, assert, assertThrows } from "@std/assert";
import { hierarchical } from "../../src/layout/mod.ts";
import { DiGraph, DAG, GraphNode, GraphEdge } from "../../src/graph/mod.ts";

Deno.test("hierarchical - linear chain correct layer ordering", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addNode(new GraphNode("C", "Node C"));
  graph.addEdge(new GraphEdge("AB", "A", "B"));
  graph.addEdge(new GraphEdge("BC", "B", "C"));

  const result = hierarchical(graph, { direction: "TB" });

  const nodeA = result.nodes.find((n) => n.id === "A")!;
  const nodeB = result.nodes.find((n) => n.id === "B")!;
  const nodeC = result.nodes.find((n) => n.id === "C")!;

  // In TB direction, y increases down the layers
  assert(nodeA.y < nodeB.y, "A should be above B");
  assert(nodeB.y < nodeC.y, "B should be above C");
});

Deno.test("hierarchical - diamond DAG layers", () => {
  const graph = new DAG<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addNode(new GraphNode("C", "Node C"));
  graph.addNode(new GraphNode("D", "Node D"));
  graph.addEdge(new GraphEdge("AB", "A", "B"));
  graph.addEdge(new GraphEdge("AC", "A", "C"));
  graph.addEdge(new GraphEdge("BD", "B", "D"));
  graph.addEdge(new GraphEdge("CD", "C", "D"));

  const result = hierarchical(graph, { direction: "TB" });

  const nodeA = result.nodes.find((n) => n.id === "A")!;
  const nodeB = result.nodes.find((n) => n.id === "B")!;
  const nodeC = result.nodes.find((n) => n.id === "C")!;
  const nodeD = result.nodes.find((n) => n.id === "D")!;

  // A in layer 0, B and C in layer 1, D in layer 2
  assert(nodeA.y < nodeB.y, "A should be above B");
  assert(nodeA.y < nodeC.y, "A should be above C");
  assertEquals(nodeB.y, nodeC.y, "B and C should be in same layer");
  assert(nodeB.y < nodeD.y, "B should be above D");
  assert(nodeC.y < nodeD.y, "C should be above D");
});

Deno.test("hierarchical - direction TB (top-bottom)", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addEdge(new GraphEdge("AB", "A", "B"));

  const result = hierarchical(graph, { direction: "TB" });

  const nodeA = result.nodes.find((n) => n.id === "A")!;
  const nodeB = result.nodes.find((n) => n.id === "B")!;

  // TB: y increases down
  assert(nodeA.y < nodeB.y, "In TB, source should have smaller y");
});

Deno.test("hierarchical - direction LR (left-right)", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addEdge(new GraphEdge("AB", "A", "B"));

  const result = hierarchical(graph, { direction: "LR" });

  const nodeA = result.nodes.find((n) => n.id === "A")!;
  const nodeB = result.nodes.find((n) => n.id === "B")!;

  // LR: x increases right
  assert(nodeA.x < nodeB.x, "In LR, source should have smaller x");
});

Deno.test("hierarchical - direction BT (bottom-top)", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addEdge(new GraphEdge("AB", "A", "B"));

  const result = hierarchical(graph, { direction: "BT" });

  const nodeA = result.nodes.find((n) => n.id === "A")!;
  const nodeB = result.nodes.find((n) => n.id === "B")!;

  // BT: y decreases (more negative) down layers
  assert(nodeA.y > nodeB.y, "In BT, source should have larger y");
});

Deno.test("hierarchical - direction RL (right-left)", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addEdge(new GraphEdge("AB", "A", "B"));

  const result = hierarchical(graph, { direction: "RL" });

  const nodeA = result.nodes.find((n) => n.id === "A")!;
  const nodeB = result.nodes.find((n) => n.id === "B")!;

  // RL: x decreases (more negative) across layers
  assert(nodeA.x > nodeB.x, "In RL, source should have larger x");
});

Deno.test("hierarchical - throws on cycle", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addNode(new GraphNode("C", "Node C"));
  graph.addEdge(new GraphEdge("AB", "A", "B"));
  graph.addEdge(new GraphEdge("BC", "B", "C"));
  graph.addEdge(new GraphEdge("CA", "C", "A")); // Creates cycle

  assertThrows(
    () => hierarchical(graph),
    Error,
    "Cannot create hierarchical layout for a graph with cycles",
  );
});
