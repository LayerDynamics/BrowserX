import { assertEquals, assert } from "@std/assert";
import { DiGraph, GraphNode, GraphEdge } from "../../src/graph/mod.ts";

Deno.test("DiGraph - construction creates empty directed graph", () => {
  const graph = new DiGraph();
  assertEquals(graph.nodeCount, 0);
  assertEquals(graph.edgeCount, 0);
});

Deno.test("DiGraph - addNode() initializes in/out adjacency", () => {
  const graph = new DiGraph();
  const node = new GraphNode("A", null);
  graph.addNode(node);
  assertEquals(graph.nodeCount, 1);
  assertEquals(graph.outDegree("A"), 0);
  assertEquals(graph.inDegree("A"), 0);
});

Deno.test("DiGraph - successors() returns nodes reachable from a node", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addNode(new GraphNode("C", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));
  graph.addEdge(new GraphEdge("e2", "A", "C"));

  const successors = graph.successors("A");
  assertEquals(successors.length, 2);
  const successorIds = successors.map(n => n.id).sort();
  assertEquals(successorIds, ["B", "C"]);
});

Deno.test("DiGraph - successors() returns empty for node with no outgoing edges", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));

  const successors = graph.successors("B");
  assertEquals(successors.length, 0);
});

Deno.test("DiGraph - predecessors() returns nodes pointing to a node", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addNode(new GraphNode("C", null));
  graph.addEdge(new GraphEdge("e1", "A", "C"));
  graph.addEdge(new GraphEdge("e2", "B", "C"));

  const predecessors = graph.predecessors("C");
  assertEquals(predecessors.length, 2);
  const predecessorIds = predecessors.map(n => n.id).sort();
  assertEquals(predecessorIds, ["A", "B"]);
});

Deno.test("DiGraph - predecessors() returns empty for node with no incoming edges", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));

  const predecessors = graph.predecessors("A");
  assertEquals(predecessors.length, 0);
});

Deno.test("DiGraph - outEdges() returns edges leaving a node", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addNode(new GraphNode("C", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));
  graph.addEdge(new GraphEdge("e2", "A", "C"));

  const outEdges = graph.outEdges("A");
  assertEquals(outEdges.length, 2);
  const edgeIds = outEdges.map(e => e.id).sort();
  assertEquals(edgeIds, ["e1", "e2"]);
});

Deno.test("DiGraph - inEdges() returns edges entering a node", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addNode(new GraphNode("C", null));
  graph.addEdge(new GraphEdge("e1", "A", "C"));
  graph.addEdge(new GraphEdge("e2", "B", "C"));

  const inEdges = graph.inEdges("C");
  assertEquals(inEdges.length, 2);
  const edgeIds = inEdges.map(e => e.id).sort();
  assertEquals(edgeIds, ["e1", "e2"]);
});

Deno.test("DiGraph - outDegree() returns correct count", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addNode(new GraphNode("C", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));
  graph.addEdge(new GraphEdge("e2", "A", "C"));

  assertEquals(graph.outDegree("A"), 2);
  assertEquals(graph.outDegree("B"), 0);
  assertEquals(graph.outDegree("C"), 0);
});

Deno.test("DiGraph - inDegree() returns correct count", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addNode(new GraphNode("C", null));
  graph.addEdge(new GraphEdge("e1", "A", "C"));
  graph.addEdge(new GraphEdge("e2", "B", "C"));

  assertEquals(graph.inDegree("A"), 0);
  assertEquals(graph.inDegree("B"), 0);
  assertEquals(graph.inDegree("C"), 2);
});

Deno.test("DiGraph - transpose() reverses all edges", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addNode(new GraphNode("C", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));
  graph.addEdge(new GraphEdge("e2", "A", "C"));

  const transposed = graph.transpose();
  assertEquals(transposed.nodeCount, 3);
  assertEquals(transposed.edgeCount, 2);

  // Original: A->B, A->C
  // Transposed: B->A, C->A
  const successorsA = transposed.successors("A");
  assertEquals(successorsA.length, 0);

  const successorsB = transposed.successors("B");
  assertEquals(successorsB.length, 1);
  assertEquals(successorsB[0].id, "A");

  const successorsC = transposed.successors("C");
  assertEquals(successorsC.length, 1);
  assertEquals(successorsC[0].id, "A");
});

Deno.test("DiGraph - transpose() returns new graph (not mutating original)", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));

  const transposed = graph.transpose();

  // Original unchanged
  assertEquals(graph.successors("A").length, 1);
  assertEquals(graph.successors("B").length, 0);

  // Transposed reversed
  assertEquals(transposed.successors("A").length, 0);
  assertEquals(transposed.successors("B").length, 1);
});

Deno.test("DiGraph - neighbors() returns successors for directed graphs", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addNode(new GraphNode("C", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));
  graph.addEdge(new GraphEdge("e2", "A", "C"));

  const neighbors = graph.neighbors("A");
  assertEquals(neighbors.length, 2);
  const neighborIds = neighbors.map(n => n.id).sort();
  assertEquals(neighborIds, ["B", "C"]);
});

Deno.test("DiGraph - removeNode() removes both in/out edges", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addNode(new GraphNode("C", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));
  graph.addEdge(new GraphEdge("e2", "B", "C"));

  const removed = graph.removeNode("B");
  assert(removed);
  assertEquals(graph.nodeCount, 2);
  assertEquals(graph.edgeCount, 0);
  assert(!graph.hasEdge("e1"));
  assert(!graph.hasEdge("e2"));
});

Deno.test("DiGraph - diamond graph (A->B, A->C, B->D, C->D)", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addNode(new GraphNode("C", null));
  graph.addNode(new GraphNode("D", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));
  graph.addEdge(new GraphEdge("e2", "A", "C"));
  graph.addEdge(new GraphEdge("e3", "B", "D"));
  graph.addEdge(new GraphEdge("e4", "C", "D"));

  assertEquals(graph.successors("A").length, 2);
  assertEquals(graph.successors("D").length, 0);
  assertEquals(graph.predecessors("D").length, 2);
  assertEquals(graph.inDegree("D"), 2);
  assertEquals(graph.outDegree("A"), 2);
});

Deno.test("DiGraph - linear chain (A->B->C->D)", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addNode(new GraphNode("C", null));
  graph.addNode(new GraphNode("D", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));
  graph.addEdge(new GraphEdge("e2", "B", "C"));
  graph.addEdge(new GraphEdge("e3", "C", "D"));

  assertEquals(graph.successors("A")[0].id, "B");
  assertEquals(graph.successors("B")[0].id, "C");
  assertEquals(graph.successors("C")[0].id, "D");
  assertEquals(graph.successors("D").length, 0);

  assertEquals(graph.predecessors("A").length, 0);
  assertEquals(graph.predecessors("D")[0].id, "C");
});

Deno.test("DiGraph - star graph (center with outgoing edges)", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("center", null));
  for (let i = 1; i <= 5; i++) {
    const id = `node${i}`;
    graph.addNode(new GraphNode(id, null));
    graph.addEdge(new GraphEdge(`e${i}`, "center", id));
  }

  assertEquals(graph.outDegree("center"), 5);
  assertEquals(graph.inDegree("center"), 0);
  assertEquals(graph.successors("center").length, 5);

  for (let i = 1; i <= 5; i++) {
    const id = `node${i}`;
    assertEquals(graph.inDegree(id), 1);
    assertEquals(graph.outDegree(id), 0);
  }
});

Deno.test("DiGraph - self-loop preserves directed semantics", () => {
  const graph = new DiGraph();
  graph.addNode(new GraphNode("A", null));
  graph.addEdge(new GraphEdge("e1", "A", "A"));

  assertEquals(graph.outDegree("A"), 1);
  assertEquals(graph.inDegree("A"), 1);
  assertEquals(graph.successors("A").length, 1);
  assertEquals(graph.predecessors("A").length, 1);
  assertEquals(graph.successors("A")[0].id, "A");
});
