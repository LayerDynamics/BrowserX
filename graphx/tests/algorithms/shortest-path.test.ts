import { assertEquals, assertThrows } from "@std/assert";
import { dijkstra } from "../../src/algorithms/mod.ts";
import { Graph, GraphNode, GraphEdge } from "../../src/graph/mod.ts";

Deno.test("dijkstra - single node distance 0 to itself", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));

  const result = dijkstra(graph, "A");

  assertEquals(result.distance.get("A"), 0);
  assertEquals(result.previous.get("A"), null);
  assertEquals(result.path("A"), ["A"]);
  assertEquals(result.cost("A"), 0);
});

Deno.test("dijkstra - linear chain with unit weights correct distances", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));

  // Unit weight edges (default weight = 1)
  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  const result = dijkstra(graph, "A");

  assertEquals(result.distance.get("A"), 0);
  assertEquals(result.distance.get("B"), 1);
  assertEquals(result.distance.get("C"), 2);
  assertEquals(result.distance.get("D"), 3);
});

Deno.test("dijkstra - linear chain with varying weights correct shortest path", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  const edge1 = new GraphEdge("ab", "A", "B", 5, "ab");
  graph.addEdge(edge1);

  const edge2 = new GraphEdge("bc", "B", "C", 3, "bc");
  graph.addEdge(edge2);

  const result = dijkstra(graph, "A");

  assertEquals(result.distance.get("A"), 0);
  assertEquals(result.distance.get("B"), 5);
  assertEquals(result.distance.get("C"), 8); // 5 + 3
});

Deno.test("dijkstra - tree structure correct paths from root", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "root"));
  graph.addNode(new GraphNode("B", "child1"));
  graph.addNode(new GraphNode("C", "child2"));
  graph.addNode(new GraphNode("D", "grandchild"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("ac", "A", "C"));
  graph.addEdge(new GraphEdge("bd", "B", "D"));

  const result = dijkstra(graph, "A");

  assertEquals(result.distance.get("A"), 0);
  assertEquals(result.distance.get("B"), 1);
  assertEquals(result.distance.get("C"), 1);
  assertEquals(result.distance.get("D"), 2);
});

Deno.test("dijkstra - graph with multiple paths chooses shortest", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  // Direct path A→C with weight 10
  const edge1 = new GraphEdge("ac", "A", "C", 10, "ac");
  graph.addEdge(edge1);

  // Indirect path A→B→C with weights 2+3=5
  const edge2 = new GraphEdge("ab", "A", "B", 2, "ab");
  graph.addEdge(edge2);

  const edge3 = new GraphEdge("bc", "B", "C", 3, "bc");
  graph.addEdge(edge3);

  const result = dijkstra(graph, "A");

  // Should choose the shorter path A→B→C with total cost 5
  assertEquals(result.distance.get("C"), 5);
  assertEquals(result.path("C"), ["A", "B", "C"]);
});

Deno.test("dijkstra - path() method returns correct path array", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  graph.addEdge(new GraphEdge("ab", "A", "B"));
  graph.addEdge(new GraphEdge("bc", "B", "C"));

  const result = dijkstra(graph, "A");

  assertEquals(result.path("A"), ["A"]);
  assertEquals(result.path("B"), ["A", "B"]);
  assertEquals(result.path("C"), ["A", "B", "C"]);
});

Deno.test("dijkstra - cost() method returns correct cost", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addNode(new GraphNode("C", "c"));

  const edge1 = new GraphEdge("ab", "A", "B", 4, "ab");
  graph.addEdge(edge1);

  const edge2 = new GraphEdge("bc", "B", "C", 7, "bc");
  graph.addEdge(edge2);

  const result = dijkstra(graph, "A");

  assertEquals(result.cost("A"), 0);
  assertEquals(result.cost("B"), 4);
  assertEquals(result.cost("C"), 11);
});

Deno.test("dijkstra - unreachable nodes distance is Infinity", () => {
  const graph = new Graph<string, string>();
  // Component 1: A-B
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));
  graph.addEdge(new GraphEdge("ab", "A", "B"));

  // Component 2: C-D (disconnected)
  graph.addNode(new GraphNode("C", "c"));
  graph.addNode(new GraphNode("D", "d"));
  graph.addEdge(new GraphEdge("cd", "C", "D"));

  const result = dijkstra(graph, "A");

  assertEquals(result.distance.get("A"), 0);
  assertEquals(result.distance.get("B"), 1);
  assertEquals(result.distance.get("C"), Infinity);
  assertEquals(result.distance.get("D"), Infinity);
  assertEquals(result.path("C"), []); // No path
  assertEquals(result.cost("D"), Infinity);
});

Deno.test("dijkstra - start node doesn't exist (throws)", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));

  assertThrows(
    () => {
      dijkstra(graph, "Z");
    },
    Error,
    'Start node "Z" does not exist',
  );
});

Deno.test("dijkstra - weighted edges respects edge.weight property", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "a"));
  graph.addNode(new GraphNode("B", "b"));

  const edge = new GraphEdge("ab", "A", "B", 42, "ab");
  graph.addEdge(edge);

  const result = dijkstra(graph, "A");

  assertEquals(result.distance.get("B"), 42);
  assertEquals(result.cost("B"), 42);
});
