import { assertEquals } from "@std/assert";
import { hasCycle } from "../../src/algorithms/mod.ts";
import { DiGraph, GraphNode, GraphEdge } from "../../src/graph/mod.ts";

Deno.test("hasCycle - acyclic linear chain returns false", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  assertEquals(hasCycle(graph), false);
});

Deno.test("hasCycle - acyclic tree returns false", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "root"));
  graph.addNode(new GraphNode("B", "child1"));
  graph.addNode(new GraphNode("C", "child2"));
  graph.addNode(new GraphNode("D", "grandchild1"));
  graph.addNode(new GraphNode("E", "grandchild2"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("ac", "A", "C"));
  graph.addEdge(new GraphEdge("bd", "B", "D"));
  graph.addEdge(new GraphEdge("be", "B", "E"));

  assertEquals(hasCycle(graph), false);
});

Deno.test("hasCycle - self-loop returns true", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "a"));

  // Self-loop: A→A
  graph.addEdge(new GraphEdge("aa", "A", "A"));

  assertEquals(hasCycle(graph), true);
});

Deno.test("hasCycle - simple cycle A→B→A returns true", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));

  // Cycle: A→B→A
  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("ba", "B", "A"));

  assertEquals(hasCycle(graph), true);
});

Deno.test("hasCycle - diamond (acyclic) returns false", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));

  // Diamond: A→B, A→C, B→D, C→D (no cycle)
  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("ac", "A", "C"));
  graph.addEdge(new GraphEdge("bd", "B", "D"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  assertEquals(hasCycle(graph), false);
});

Deno.test("hasCycle - complex cycle A→B→C→A returns true", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  // Cycle: A→B→C→A
  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));
  graph.addEdge(new GraphEdge("ca", "C", "A"));

  assertEquals(hasCycle(graph), true);
});

Deno.test("hasCycle - disconnected with cycle in one component returns true", () => {
  const graph = new DiGraph<string, string>();
  // Component 1: A→B (acyclic)
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addEdge(new GraphEdge("ab", "A", "B"));

  // Component 2: C→D→C (cyclic)
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));
  graph.addEdge(new GraphEdge("dc", "D", "C"));

  assertEquals(hasCycle(graph), true);
});

Deno.test("hasCycle - empty graph returns false", () => {
  const graph = new DiGraph<string, string>();

  assertEquals(hasCycle(graph), false);
});
