import { assertEquals } from "@std/assert";
import { connectedComponents } from "../../src/algorithms/mod.ts";
import { Graph, GraphNode, GraphEdge } from "../../src/graph/mod.ts";

Deno.test("connectedComponents - fully connected graph has 1 component", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  // Fully connected: A-B-C
  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));

  const result = connectedComponents(graph);

  assertEquals(result.count, 1);
  assertEquals(result.components.length, 1);
  assertEquals(result.components[0].size, 3);

  // All nodes in same component
  const compId = result.componentOf.get("A")!;
  assertEquals(result.componentOf.get("B"), compId);
  assertEquals(result.componentOf.get("C"), compId);
});

Deno.test("connectedComponents - two disconnected components", () => {
  const graph = new Graph<string, string>();
  // Component 1: A-B
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addEdge(new GraphEdge("ab", "A", "B"));

  // Component 2: C-D
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  const result = connectedComponents(graph);

  assertEquals(result.count, 2);
  assertEquals(result.components.length, 2);

  // Component sizes
  const sizes = result.components.map((c) => c.size).sort();
  assertEquals(sizes, [2, 2]);

  // A and B in same component
  assertEquals(
    result.componentOf.get("A"),
    result.componentOf.get("B"),
  );

  // C and D in same component
  assertEquals(
    result.componentOf.get("C"),
    result.componentOf.get("D"),
  );

  // A and C in different components
  assertEquals(
    result.componentOf.get("A") !== result.componentOf.get("C"),
    true,
  );
});

Deno.test("connectedComponents - three components of varying sizes", () => {
  const graph = new Graph<string, string>();
  // Component 1: A-B-C (size 3)
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));
  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));

  // Component 2: D-E (size 2)
  graph.addNode(new GraphNode("D", "d"));
  graph.addNode(new GraphNode("E", "e"));
  graph.addEdge(new GraphEdge("de", "D", "E"));

  // Component 3: F (size 1)
  graph.addNode(new GraphNode("F", "f"));

  const result = connectedComponents(graph);

  assertEquals(result.count, 3);
  assertEquals(result.components.length, 3);

  // Component sizes
  const sizes = result.components.map((c) => c.size).sort();
  assertEquals(sizes, [1, 2, 3]);
});

Deno.test("connectedComponents - single nodes each is own component", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  // No edges, all disconnected

  const result = connectedComponents(graph);

  assertEquals(result.count, 3);
  assertEquals(result.components.length, 3);

  // Each component has size 1
  for (const comp of result.components) {
    assertEquals(comp.size, 1);
  }

  // Each node in different component
  const compA = result.componentOf.get("A")!;
  const compB = result.componentOf.get("B")!;
  const compC = result.componentOf.get("C")!;

  assertEquals(compA !== compB, true);
  assertEquals(compB !== compC, true);
  assertEquals(compA !== compC, true);
});

Deno.test("connectedComponents - componentOf map correctness", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  // C is disconnected

  const result = connectedComponents(graph);

  // Should have componentOf entry for all nodes
  assertEquals(result.componentOf.size, 3);
  assertEquals(result.componentOf.has("A"), true);
  assertEquals(result.componentOf.has("B"), true);
  assertEquals(result.componentOf.has("C"), true);

  // Component IDs should be valid indices
  for (const compId of result.componentOf.values()) {
    assertEquals(compId >= 0 && compId < result.count, true);
  }
});

Deno.test("connectedComponents - components array correctness", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  // C is disconnected

  const result = connectedComponents(graph);

  // Each component should be a Set
  for (const comp of result.components) {
    assertEquals(comp instanceof Set, true);
  }

  // Union of all components should equal all nodes
  const allNodes = new Set<string>();
  for (const comp of result.components) {
    for (const id of comp) {
      allNodes.add(id);
    }
  }
  assertEquals(allNodes.size, 3);
  assertEquals(allNodes.has("A"), true);
  assertEquals(allNodes.has("B"), true);
  assertEquals(allNodes.has("C"), true);
});

Deno.test("connectedComponents - count property matches components length", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  const result = connectedComponents(graph);

  assertEquals(result.count, result.components.length);
  assertEquals(result.count, 2);
});

Deno.test("connectedComponents - linear chain is 1 component", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  const result = connectedComponents(graph);

  assertEquals(result.count, 1);
  assertEquals(result.components[0].size, 4);
});
