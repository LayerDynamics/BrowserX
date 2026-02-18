import { assertEquals, assertThrows } from "@std/assert";
import { bfs } from "../../src/algorithms/mod.ts";
import { Graph, GraphNode, GraphEdge } from "../../src/graph/mod.ts";

Deno.test("bfs - single node graph", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "data-a"));

  const result = bfs(graph, "A");

  assertEquals(result.order, ["A"]);
  assertEquals(result.parent.get("A"), null);
  assertEquals(result.depth.get("A"), 0);
});

Deno.test("bfs - linear chain A→B→C→D", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "data-a"));
  graph.addNode(new GraphNode("B", "data-b"));
  graph.addNode(new GraphNode("C", "data-c"));
  graph.addNode(new GraphNode("D", "data-d"));

  graph.addEdge(new GraphEdge("edge-ab", "A", "B"));
  graph.addEdge(new GraphEdge("edge-bc", "B", "C"));
  graph.addEdge(new GraphEdge("edge-cd", "C", "D"));

  const result = bfs(graph, "A");

  assertEquals(result.order, ["A", "B", "C", "D"]);
  assertEquals(result.parent.get("A"), null);
  assertEquals(result.parent.get("B"), "A");
  assertEquals(result.parent.get("C"), "B");
  assertEquals(result.parent.get("D"), "C");
  assertEquals(result.depth.get("A"), 0);
  assertEquals(result.depth.get("B"), 1);
  assertEquals(result.depth.get("C"), 2);
  assertEquals(result.depth.get("D"), 3);
});

Deno.test("bfs - tree structure breadth-first order", () => {
  const graph = new Graph<string, string>();
  // Root: A
  // Level 1: B, C
  // Level 2: D, E, F
  graph.addNode(new GraphNode("A", "root"));
  graph.addNode(new GraphNode("B", "child1"));
  graph.addNode(new GraphNode("C", "child2"));
  graph.addNode(new GraphNode("D", "grandchild1"));
  graph.addNode(new GraphNode("E", "grandchild2"));
  graph.addNode(new GraphNode("F", "grandchild3"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("ac", "A", "C"));
  graph.addEdge(new GraphEdge("bd", "B", "D"));
  graph.addEdge(new GraphEdge("be", "B", "E"));
  graph.addEdge(new GraphEdge("cf", "C", "F"));

  const result = bfs(graph, "A");

  // BFS should visit level-by-level
  assertEquals(result.order[0], "A");
  // B and C are both at depth 1 (order may vary)
  assertEquals(result.order.slice(1, 3).sort(), ["B", "C"]);
  // D, E, F are at depth 2 (order may vary)
  assertEquals(result.order.slice(3).sort(), ["D", "E", "F"]);

  assertEquals(result.depth.get("A"), 0);
  assertEquals(result.depth.get("B"), 1);
  assertEquals(result.depth.get("C"), 1);
  assertEquals(result.depth.get("D"), 2);
  assertEquals(result.depth.get("E"), 2);
  assertEquals(result.depth.get("F"), 2);
});

Deno.test("bfs - graph with cycle (undirected)", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  // Triangle: A-B-C-A
  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));
  graph.addEdge(new GraphEdge("ca", "C", "A"));

  const result = bfs(graph, "A");

  // Should visit all 3 nodes
  assertEquals(result.order.length, 3);
  assertEquals(result.order[0], "A");
  assertEquals(result.parent.get("A"), null);
  assertEquals(result.depth.get("A"), 0);

  // B and C should both be at depth 1 (neighbors of A)
  const depthOneNodes = result.order.slice(1);
  assertEquals(depthOneNodes.sort(), ["B", "C"]);
  assertEquals(result.depth.get("B"), 1);
  assertEquals(result.depth.get("C"), 1);
});

Deno.test("bfs - parent map correctness", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("ac", "A", "C"));

  const result = bfs(graph, "A");

  assertEquals(result.parent.get("A"), null);
  assertEquals(result.parent.get("B"), "A");
  assertEquals(result.parent.get("C"), "A");
});

Deno.test("bfs - depth map correctness", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  const result = bfs(graph, "A");

  assertEquals(result.depth.get("A"), 0);
  assertEquals(result.depth.get("B"), 1);
  assertEquals(result.depth.get("C"), 2);
  assertEquals(result.depth.get("D"), 3);
});

Deno.test("bfs - order array correctness", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));

  const result = bfs(graph, "A");

  assertEquals(result.order, ["A", "B", "C"]);
});

Deno.test("bfs - disconnected graph (BFS from one component)", () => {
  const graph = new Graph<string, string>();
  // Component 1: A-B
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addEdge(new GraphEdge("ab", "A", "B"));

  // Component 2: C-D (disconnected from A-B)
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  const result = bfs(graph, "A");

  // Should only visit component containing A
  assertEquals(result.order, ["A", "B"]);
  assertEquals(result.parent.size, 2);
  assertEquals(result.depth.size, 2);
});

Deno.test("bfs - start node doesn't exist (throws)", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));

  assertThrows(
    () => {
      bfs(graph, "Z");
    },
    Error,
    'Start node "Z" does not exist',
  );
});

Deno.test("bfs - empty graph (throws)", () => {
  const graph = new Graph<string, string>();

  assertThrows(
    () => {
      bfs(graph, "A");
    },
    Error,
    'Start node "A" does not exist',
  );
});
