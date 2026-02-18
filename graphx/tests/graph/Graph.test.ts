import { assertEquals, assert, assertThrows } from "@std/assert";
import { Graph, GraphNode, GraphEdge } from "../../src/graph/mod.ts";

Deno.test("Graph - construction creates empty graph", () => {
  const graph = new Graph();
  assertEquals(graph.nodeCount, 0);
  assertEquals(graph.edgeCount, 0);
  assertEquals(graph.nodes().length, 0);
  assertEquals(graph.edges().length, 0);
});

Deno.test("Graph - addNode() adds node successfully", () => {
  const graph = new Graph();
  const node = new GraphNode("A", "dataA");
  graph.addNode(node);
  assertEquals(graph.nodeCount, 1);
  assert(graph.hasNode("A"));
  assertEquals(graph.getNode("A")?.id, "A");
});

Deno.test("Graph - addNode() rejects duplicate node", () => {
  const graph = new Graph();
  const node1 = new GraphNode("A", "data1");
  const node2 = new GraphNode("A", "data2");
  graph.addNode(node1);
  assertThrows(
    () => graph.addNode(node2),
    Error,
    'Node "A" already exists'
  );
});

Deno.test("Graph - addEdge() adds edge successfully", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  const edge = new GraphEdge("e1", "A", "B");
  graph.addEdge(edge);
  assertEquals(graph.edgeCount, 1);
  assert(graph.hasEdge("e1"));
  assertEquals(graph.getEdge("e1")?.source, "A");
  assertEquals(graph.getEdge("e1")?.target, "B");
});

Deno.test("Graph - addEdge() rejects missing source node", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("B", null));
  const edge = new GraphEdge("e1", "A", "B");
  assertThrows(
    () => graph.addEdge(edge),
    Error,
    'Source node "A" does not exist'
  );
});

Deno.test("Graph - addEdge() rejects missing target node", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  const edge = new GraphEdge("e1", "A", "B");
  assertThrows(
    () => graph.addEdge(edge),
    Error,
    'Target node "B" does not exist'
  );
});

Deno.test("Graph - addEdge() rejects duplicate edge", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  const edge1 = new GraphEdge("e1", "A", "B");
  const edge2 = new GraphEdge("e1", "A", "B");
  graph.addEdge(edge1);
  assertThrows(
    () => graph.addEdge(edge2),
    Error,
    'Edge "e1" already exists'
  );
});

Deno.test("Graph - removeNode() removes node and incident edges", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addNode(new GraphNode("C", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));
  graph.addEdge(new GraphEdge("e2", "A", "C"));

  const removed = graph.removeNode("A");
  assert(removed);
  assertEquals(graph.nodeCount, 2);
  assertEquals(graph.edgeCount, 0); // Both edges should be removed
  assert(!graph.hasNode("A"));
  assert(!graph.hasEdge("e1"));
  assert(!graph.hasEdge("e2"));
});

Deno.test("Graph - removeNode() returns false for non-existent node", () => {
  const graph = new Graph();
  const removed = graph.removeNode("Z");
  assertEquals(removed, false);
});

Deno.test("Graph - removeEdge() removes edge successfully", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));

  const removed = graph.removeEdge("e1");
  assert(removed);
  assertEquals(graph.edgeCount, 0);
  assert(!graph.hasEdge("e1"));
});

Deno.test("Graph - removeEdge() returns false for non-existent edge", () => {
  const graph = new Graph();
  const removed = graph.removeEdge("e999");
  assertEquals(removed, false);
});

Deno.test("Graph - getNode() returns node if exists", () => {
  const graph = new Graph();
  const node = new GraphNode("A", "testData");
  graph.addNode(node);
  const retrieved = graph.getNode("A");
  assert(retrieved);
  assertEquals(retrieved.id, "A");
  assertEquals(retrieved.data, "testData");
});

Deno.test("Graph - getNode() returns undefined for non-existent node", () => {
  const graph = new Graph();
  const retrieved = graph.getNode("Z");
  assertEquals(retrieved, undefined);
});

Deno.test("Graph - hasNode() returns correct boolean", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  assert(graph.hasNode("A"));
  assert(!graph.hasNode("B"));
});

Deno.test("Graph - hasEdge() returns correct boolean", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));
  assert(graph.hasEdge("e1"));
  assert(!graph.hasEdge("e2"));
});

Deno.test("Graph - neighbors() returns adjacent nodes", () => {
  const graph = new Graph();
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

Deno.test("Graph - neighbors() handles disconnected node", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  const neighbors = graph.neighbors("A");
  assertEquals(neighbors.length, 0);
});

Deno.test("Graph - incidentEdges() returns correct edges", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addNode(new GraphNode("C", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));
  graph.addEdge(new GraphEdge("e2", "A", "C"));

  const edges = graph.incidentEdges("A");
  assertEquals(edges.length, 2);
  const edgeIds = edges.map(e => e.id).sort();
  assertEquals(edgeIds, ["e1", "e2"]);
});

Deno.test("Graph - degree() returns correct count", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addNode(new GraphNode("C", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));
  graph.addEdge(new GraphEdge("e2", "A", "C"));

  assertEquals(graph.degree("A"), 2);
  assertEquals(graph.degree("B"), 1);
  assertEquals(graph.degree("C"), 1);
});

Deno.test("Graph - degree() returns 0 for disconnected node", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  assertEquals(graph.degree("A"), 0);
});

Deno.test("Graph - clear() empties the graph", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));

  graph.clear();
  assertEquals(graph.nodeCount, 0);
  assertEquals(graph.edgeCount, 0);
  assertEquals(graph.nodes().length, 0);
  assertEquals(graph.edges().length, 0);
});

Deno.test("Graph - toJSON() serializes graph", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", "dataA"));
  graph.addNode(new GraphNode("B", "dataB"));
  graph.addEdge(new GraphEdge("e1", "A", "B", 5));

  const json = graph.toJSON();
  assert(json.nodes);
  assert(json.edges);
  assertEquals((json.nodes as Array<unknown>).length, 2);
  assertEquals((json.edges as Array<unknown>).length, 1);
});

Deno.test("Graph - allows self-loops", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  const edge = new GraphEdge("e1", "A", "A");
  graph.addEdge(edge);
  assertEquals(graph.edgeCount, 1);
  assert(graph.hasEdge("e1"));
  assertEquals(graph.degree("A"), 1);
});

Deno.test("Graph - allows multiple edges between same nodes", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));
  graph.addEdge(new GraphEdge("e2", "A", "B"));
  assertEquals(graph.edgeCount, 2);
  assert(graph.hasEdge("e1"));
  assert(graph.hasEdge("e2"));
});

Deno.test("Graph - neighbors() deduplicates multiple edges", () => {
  const graph = new Graph();
  graph.addNode(new GraphNode("A", null));
  graph.addNode(new GraphNode("B", null));
  graph.addEdge(new GraphEdge("e1", "A", "B"));
  graph.addEdge(new GraphEdge("e2", "A", "B"));

  const neighbors = graph.neighbors("A");
  // Should deduplicate node B even though there are 2 edges
  assertEquals(neighbors.length, 1);
  assertEquals(neighbors[0].id, "B");
});
