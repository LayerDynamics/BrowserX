import { assertEquals, assert, assertThrows } from "@std/assert";
import { DAG, GraphNode, GraphEdge, CycleError } from "../../src/graph/mod.ts";

Deno.test("DAG - construction creates empty DAG", () => {
  const dag = new DAG();
  assertEquals(dag.nodeCount, 0);
  assertEquals(dag.edgeCount, 0);
});

Deno.test("DAG - behaves like DiGraph initially", () => {
  const dag = new DAG();
  dag.addNode(new GraphNode("A", null));
  dag.addNode(new GraphNode("B", null));
  dag.addEdge(new GraphEdge("e1", "A", "B"));

  assertEquals(dag.nodeCount, 2);
  assertEquals(dag.edgeCount, 1);
  assertEquals(dag.successors("A").length, 1);
  assertEquals(dag.predecessors("B").length, 1);
});

Deno.test("DAG - accepts linear chain (A->B->C)", () => {
  const dag = new DAG();
  dag.addNode(new GraphNode("A", null));
  dag.addNode(new GraphNode("B", null));
  dag.addNode(new GraphNode("C", null));
  dag.addEdge(new GraphEdge("e1", "A", "B"));
  dag.addEdge(new GraphEdge("e2", "B", "C"));

  assertEquals(dag.edgeCount, 2);
  assertEquals(dag.successors("A")[0].id, "B");
  assertEquals(dag.successors("B")[0].id, "C");
});

Deno.test("DAG - accepts tree structure", () => {
  const dag = new DAG();
  dag.addNode(new GraphNode("root", null));
  dag.addNode(new GraphNode("left", null));
  dag.addNode(new GraphNode("right", null));
  dag.addEdge(new GraphEdge("e1", "root", "left"));
  dag.addEdge(new GraphEdge("e2", "root", "right"));

  assertEquals(dag.edgeCount, 2);
  assertEquals(dag.successors("root").length, 2);
});

Deno.test("DAG - accepts diamond (A->B, A->C, B->D, C->D)", () => {
  const dag = new DAG();
  dag.addNode(new GraphNode("A", null));
  dag.addNode(new GraphNode("B", null));
  dag.addNode(new GraphNode("C", null));
  dag.addNode(new GraphNode("D", null));
  dag.addEdge(new GraphEdge("e1", "A", "B"));
  dag.addEdge(new GraphEdge("e2", "A", "C"));
  dag.addEdge(new GraphEdge("e3", "B", "D"));
  dag.addEdge(new GraphEdge("e4", "C", "D"));

  assertEquals(dag.edgeCount, 4);
  assertEquals(dag.inDegree("D"), 2);
  assertEquals(dag.outDegree("A"), 2);
});

Deno.test("DAG - rejects self-loop", () => {
  const dag = new DAG();
  const node = new GraphNode("A", null);
  dag.addNode(node);

  assertThrows(
    () => dag.addEdge(new GraphEdge("e1", "A", "A")),
    CycleError,
    "cycle"
  );

  // Graph should remain valid after rejection
  assertEquals(dag.nodeCount, 1);
  assertEquals(dag.edgeCount, 0);
});

Deno.test("DAG - rejects simple cycle (A->B->A)", () => {
  const dag = new DAG();
  dag.addNode(new GraphNode("A", null));
  dag.addNode(new GraphNode("B", null));
  dag.addEdge(new GraphEdge("e1", "A", "B"));

  assertThrows(
    () => dag.addEdge(new GraphEdge("e2", "B", "A")),
    CycleError,
    "cycle"
  );

  // Only first edge should remain
  assertEquals(dag.edgeCount, 1);
  assert(dag.hasEdge("e1"));
  assert(!dag.hasEdge("e2"));
});

Deno.test("DAG - rejects complex cycle (A->B->C->A)", () => {
  const dag = new DAG();
  dag.addNode(new GraphNode("A", null));
  dag.addNode(new GraphNode("B", null));
  dag.addNode(new GraphNode("C", null));
  dag.addEdge(new GraphEdge("e1", "A", "B"));
  dag.addEdge(new GraphEdge("e2", "B", "C"));

  assertThrows(
    () => dag.addEdge(new GraphEdge("e3", "C", "A")),
    CycleError,
    "cycle"
  );

  assertEquals(dag.edgeCount, 2);
  assert(dag.hasEdge("e1"));
  assert(dag.hasEdge("e2"));
  assert(!dag.hasEdge("e3"));
});

Deno.test("DAG - rejects cycle in larger graph (A->B->C->D->B)", () => {
  const dag = new DAG();
  dag.addNode(new GraphNode("A", null));
  dag.addNode(new GraphNode("B", null));
  dag.addNode(new GraphNode("C", null));
  dag.addNode(new GraphNode("D", null));
  dag.addEdge(new GraphEdge("e1", "A", "B"));
  dag.addEdge(new GraphEdge("e2", "B", "C"));
  dag.addEdge(new GraphEdge("e3", "C", "D"));

  assertThrows(
    () => dag.addEdge(new GraphEdge("e4", "D", "B")),
    CycleError,
    "cycle"
  );

  assertEquals(dag.edgeCount, 3);
});

Deno.test("DAG - edge rollback on cycle maintains graph validity", () => {
  const dag = new DAG();
  dag.addNode(new GraphNode("A", null));
  dag.addNode(new GraphNode("B", null));
  dag.addEdge(new GraphEdge("e1", "A", "B"));

  try {
    dag.addEdge(new GraphEdge("e2", "B", "A"));
  } catch (_e) {
    // Expected
  }

  // Graph should still be valid - can add other edges
  dag.addNode(new GraphNode("C", null));
  dag.addEdge(new GraphEdge("e3", "B", "C"));
  assertEquals(dag.edgeCount, 2);
  assertEquals(dag.successors("B")[0].id, "C");
});

Deno.test("DAG - CycleError has correct name", () => {
  const error = new CycleError();
  assertEquals(error.name, "CycleError");
});

Deno.test("DAG - CycleError has correct default message", () => {
  const error = new CycleError();
  assert(error.message.includes("cycle"));
});

Deno.test("DAG - CycleError accepts custom message", () => {
  const error = new CycleError("Custom cycle message");
  assertEquals(error.message, "Custom cycle message");
});

Deno.test("DAG - large valid DAG (50 nodes in layers)", () => {
  const dag = new DAG();

  // Create 5 layers of 10 nodes each
  for (let layer = 0; layer < 5; layer++) {
    for (let i = 0; i < 10; i++) {
      const id = `L${layer}N${i}`;
      dag.addNode(new GraphNode(id, null));
    }
  }

  // Connect each layer to the next
  let edgeId = 0;
  for (let layer = 0; layer < 4; layer++) {
    for (let i = 0; i < 10; i++) {
      const sourceId = `L${layer}N${i}`;
      // Connect to next layer nodes
      for (let j = 0; j < 2; j++) {
        const targetId = `L${layer + 1}N${(i + j) % 10}`;
        dag.addEdge(new GraphEdge(`e${edgeId++}`, sourceId, targetId));
      }
    }
  }

  assertEquals(dag.nodeCount, 50);
  assertEquals(dag.edgeCount, 80); // 4 layers * 10 nodes * 2 connections
});

Deno.test("DAG - edge addition order doesn't matter for valid DAGs", () => {
  const dag1 = new DAG();
  dag1.addNode(new GraphNode("A", null));
  dag1.addNode(new GraphNode("B", null));
  dag1.addNode(new GraphNode("C", null));
  dag1.addEdge(new GraphEdge("e1", "A", "B"));
  dag1.addEdge(new GraphEdge("e2", "B", "C"));

  const dag2 = new DAG();
  dag2.addNode(new GraphNode("A", null));
  dag2.addNode(new GraphNode("B", null));
  dag2.addNode(new GraphNode("C", null));
  dag2.addEdge(new GraphEdge("e2", "B", "C"));
  dag2.addEdge(new GraphEdge("e1", "A", "B"));

  assertEquals(dag1.edgeCount, dag2.edgeCount);
  assertEquals(dag1.nodeCount, dag2.nodeCount);
});

Deno.test("DAG - complex diamond with multiple paths", () => {
  const dag = new DAG();
  // A->B->D, A->C->D, A->D (three paths from A to D)
  dag.addNode(new GraphNode("A", null));
  dag.addNode(new GraphNode("B", null));
  dag.addNode(new GraphNode("C", null));
  dag.addNode(new GraphNode("D", null));
  dag.addEdge(new GraphEdge("e1", "A", "B"));
  dag.addEdge(new GraphEdge("e2", "A", "C"));
  dag.addEdge(new GraphEdge("e3", "A", "D"));
  dag.addEdge(new GraphEdge("e4", "B", "D"));
  dag.addEdge(new GraphEdge("e5", "C", "D"));

  assertEquals(dag.edgeCount, 5);
  assertEquals(dag.inDegree("D"), 3);
});

Deno.test("DAG - rejects cycle after many valid edges", () => {
  const dag = new DAG();
  dag.addNode(new GraphNode("A", null));
  dag.addNode(new GraphNode("B", null));
  dag.addNode(new GraphNode("C", null));
  dag.addNode(new GraphNode("D", null));
  dag.addNode(new GraphNode("E", null));

  // Build a long valid path: A->B->C->D->E
  dag.addEdge(new GraphEdge("e1", "A", "B"));
  dag.addEdge(new GraphEdge("e2", "B", "C"));
  dag.addEdge(new GraphEdge("e3", "C", "D"));
  dag.addEdge(new GraphEdge("e4", "D", "E"));

  // Try to close a cycle: E->A
  assertThrows(
    () => dag.addEdge(new GraphEdge("e5", "E", "A")),
    CycleError
  );

  assertEquals(dag.edgeCount, 4);
});

Deno.test("DAG - multiple disconnected components are valid", () => {
  const dag = new DAG();

  // Component 1: A->B->C
  dag.addNode(new GraphNode("A", null));
  dag.addNode(new GraphNode("B", null));
  dag.addNode(new GraphNode("C", null));
  dag.addEdge(new GraphEdge("e1", "A", "B"));
  dag.addEdge(new GraphEdge("e2", "B", "C"));

  // Component 2: X->Y->Z
  dag.addNode(new GraphNode("X", null));
  dag.addNode(new GraphNode("Y", null));
  dag.addNode(new GraphNode("Z", null));
  dag.addEdge(new GraphEdge("e3", "X", "Y"));
  dag.addEdge(new GraphEdge("e4", "Y", "Z"));

  assertEquals(dag.nodeCount, 6);
  assertEquals(dag.edgeCount, 4);
});
