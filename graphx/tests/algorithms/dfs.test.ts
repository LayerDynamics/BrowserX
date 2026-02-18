import { assertEquals, assertThrows } from "@std/assert";
import { dfs, dfsAll } from "../../src/algorithms/mod.ts";
import { Graph, GraphNode, GraphEdge } from "../../src/graph/mod.ts";

Deno.test("dfs - single node", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "data-a"));

  const result = dfs(graph, "A");

  assertEquals(result.order, ["A"]);
  assertEquals(result.parent.get("A"), null);
  assertEquals(result.depth.get("A"), 0);
  assertEquals(result.discovery.get("A"), 0);
  assertEquals(result.finish.get("A"), 1);
});

Deno.test("dfs - linear chain depth-first order", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  const result = dfs(graph, "A");

  // DFS should go as deep as possible first
  assertEquals(result.order, ["A", "B", "C", "D"]);
  assertEquals(result.parent.get("A"), null);
  assertEquals(result.parent.get("B"), "A");
  assertEquals(result.parent.get("C"), "B");
  assertEquals(result.parent.get("D"), "C");
});

Deno.test("dfs - tree structure", () => {
  const graph = new Graph<string, string>();
  // Root: A
  // Children: B, C
  // Grandchildren: D (from B), E (from B)
  graph.addNode(new GraphNode("A", "root"));
  graph.addNode(new GraphNode("B", "child1"));
  graph.addNode(new GraphNode("C", "child2"));
  graph.addNode(new GraphNode("D", "grandchild1"));
  graph.addNode(new GraphNode("E", "grandchild2"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("ac", "A", "C"));
  graph.addEdge(new GraphEdge("bd", "B", "D"));
  graph.addEdge(new GraphEdge("be", "B", "E"));

  const result = dfs(graph, "A");

  // Should visit all nodes
  assertEquals(result.order.length, 5);
  assertEquals(result.order[0], "A");
  assertEquals(result.parent.get("A"), null);
  assertEquals(result.depth.get("A"), 0);
});

Deno.test("dfs - discovery times correctness", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));

  const result = dfs(graph, "A");

  // Discovery times should be in order of visit
  assertEquals(result.discovery.get("A"), 0);
  assertEquals(result.discovery.get("B"), 1);
  assertEquals(result.discovery.get("C"), 2);
});

Deno.test("dfs - finish times correctness", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));

  const result = dfs(graph, "A");

  // Finish times: C finishes first (no children), then B, then A
  const finishA = result.finish.get("A")!;
  const finishB = result.finish.get("B")!;
  const finishC = result.finish.get("C")!;

  // C should finish before B, B should finish before A
  assertEquals(finishC < finishB, true);
  assertEquals(finishB < finishA, true);
});

Deno.test("dfs - parent map", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("ac", "A", "C"));

  const result = dfs(graph, "A");

  assertEquals(result.parent.get("A"), null);
  // B and C are both children of A
  assertEquals(
    result.parent.get("B") === "A" || result.parent.get("C") === "A",
    true,
  );
});

Deno.test("dfs - depth map", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));

  const result = dfs(graph, "A");

  assertEquals(result.depth.get("A"), 0);
  assertEquals(result.depth.get("B"), 1);
  assertEquals(result.depth.get("C"), 2);
});

Deno.test("dfsAll - disconnected graph visits all components", () => {
  const graph = new Graph<string, string>();
  // Component 1: A-B
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addEdge(new GraphEdge("ab", "A", "B"));

  // Component 2: C-D
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  const result = dfsAll(graph);

  // Should visit all 4 nodes
  assertEquals(result.order.length, 4);
  assertEquals(result.order.includes("A"), true);
  assertEquals(result.order.includes("B"), true);
  assertEquals(result.order.includes("C"), true);
  assertEquals(result.order.includes("D"), true);
});

Deno.test("dfsAll - multiple trees", () => {
  const graph = new Graph<string, string>();
  // Tree 1: A with child B
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addEdge(new GraphEdge("ab", "A", "B"));

  // Tree 2: C with children D, E
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));
  graph.addNode(new GraphNode("E", "e"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));
  graph.addEdge(new GraphEdge("ce", "C", "E"));

  const result = dfsAll(graph);

  assertEquals(result.order.length, 5);
});

Deno.test("dfsAll - all nodes visited", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));

  // Disconnected nodes
  const result = dfsAll(graph);

  assertEquals(result.order.length, 4);
  assertEquals(result.parent.size, 4);
  assertEquals(result.depth.size, 4);
});

Deno.test("dfsAll - discovery and finish times span entire graph", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  // C is disconnected

  const result = dfsAll(graph);

  // Should have discovery and finish times for all nodes
  assertEquals(result.discovery.size, 3);
  assertEquals(result.finish.size, 3);

  // All discovery times should be unique and in range [0, 5]
  const discoveryTimes = Array.from(result.discovery.values());
  assertEquals(new Set(discoveryTimes).size, 3);

  // All finish times should be unique and in range [1, 6]
  const finishTimes = Array.from(result.finish.values());
  assertEquals(new Set(finishTimes).size, 3);
});

Deno.test("dfs - start node doesn't exist (throws)", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));

  assertThrows(
    () => {
      dfs(graph, "Z");
    },
    Error,
    'Start node "Z" does not exist',
  );
});
