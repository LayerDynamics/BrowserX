import { assertEquals } from "@std/assert";
import { topologicalSort } from "../../src/algorithms/mod.ts";
import { DiGraph, GraphNode, GraphEdge } from "../../src/graph/mod.ts";

Deno.test("topologicalSort - linear DAG A→B→C→D order is correct", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  const result = topologicalSort(graph);

  assertEquals(result.hasCycle, false);
  assertEquals(result.order, ["A", "B", "C", "D"]);
});

Deno.test("topologicalSort - diamond DAG valid orderings", () => {
  const graph = new DiGraph<string, string>();
  // Diamond: A→B, A→C, B→D, C→D
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("ac", "A", "C"));
  graph.addEdge(new GraphEdge("bd", "B", "D"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  const result = topologicalSort(graph);

  assertEquals(result.hasCycle, false);
  assertEquals(result.order.length, 4);

  // A must come first, D must come last
  assertEquals(result.order[0], "A");
  assertEquals(result.order[3], "D");

  // B and C can be in any order, but both before D
  const indexB = result.order.indexOf("B");
  const indexC = result.order.indexOf("C");
  const indexD = result.order.indexOf("D");
  assertEquals(indexB < indexD, true);
  assertEquals(indexC < indexD, true);
});

Deno.test("topologicalSort - tree structure root first leaves last", () => {
  const graph = new DiGraph<string, string>();
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

  const result = topologicalSort(graph);

  assertEquals(result.hasCycle, false);
  assertEquals(result.order.length, 6);

  // A must be first
  assertEquals(result.order[0], "A");

  // B and C must come before their children
  const indexB = result.order.indexOf("B");
  const indexC = result.order.indexOf("C");
  const indexD = result.order.indexOf("D");
  const indexE = result.order.indexOf("E");
  const indexF = result.order.indexOf("F");

  assertEquals(indexB < indexD, true);
  assertEquals(indexB < indexE, true);
  assertEquals(indexC < indexF, true);
});

Deno.test("topologicalSort - single node returns that node", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "a"));

  const result = topologicalSort(graph);

  assertEquals(result.hasCycle, false);
  assertEquals(result.order, ["A"]);
});

Deno.test("topologicalSort - empty graph returns empty order", () => {
  const graph = new DiGraph<string, string>();

  const result = topologicalSort(graph);

  assertEquals(result.hasCycle, false);
  assertEquals(result.order, []);
});

Deno.test("topologicalSort - cycle detection hasCycle true for cyclic graph", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  // Cycle: A→B→C→A
  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));
  graph.addEdge(new GraphEdge("ca", "C", "A"));

  const result = topologicalSort(graph);

  assertEquals(result.hasCycle, true);
  // Partial order is returned (nodes processed before cycle detected)
  assertEquals(result.order.length < 3, true);
});

Deno.test("topologicalSort - simple cycle A→B→A partial order returned", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));

  // Simple cycle: A→B→A
  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("ba", "B", "A"));

  const result = topologicalSort(graph);

  assertEquals(result.hasCycle, true);
  // Should return partial order (not all nodes)
  assertEquals(result.order.length < 2, true);
});

Deno.test("topologicalSort - valid ordering property for edge u→v u comes before v", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));

  // A→B, A→C, B→D, C→D
  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("ac", "A", "C"));
  graph.addEdge(new GraphEdge("bd", "B", "D"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  const result = topologicalSort(graph);

  assertEquals(result.hasCycle, false);

  // For every edge, source comes before target in order
  for (const edge of graph.edges()) {
    const sourceIndex = result.order.indexOf(edge.source);
    const targetIndex = result.order.indexOf(edge.target);
    assertEquals(
      sourceIndex < targetIndex,
      true,
      `Edge ${edge.source}→${edge.target}: source should come before target`,
    );
  }
});

Deno.test("topologicalSort - disconnected components both sorted", () => {
  const graph = new DiGraph<string, string>();
  // Component 1: A→B
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addEdge(new GraphEdge("ab", "A", "B"));

  // Component 2: C→D
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  const result = topologicalSort(graph);

  assertEquals(result.hasCycle, false);
  assertEquals(result.order.length, 4);

  // Within each component, ordering is correct
  const indexA = result.order.indexOf("A");
  const indexB = result.order.indexOf("B");
  const indexC = result.order.indexOf("C");
  const indexD = result.order.indexOf("D");

  assertEquals(indexA < indexB, true);
  assertEquals(indexC < indexD, true);
});
