/**
 * DependencyGraphBuilder GraphX integration tests
 */

import { assertEquals, assert } from "@std/assert";
import { DependencyGraphBuilder } from "../../../planner/dependency-graph.ts";
import { ExecutionStepType } from "../../../planner/plan.ts";
import type { ExecutionStep } from "../../../planner/plan.ts";

function makeStep(
  id: string,
  dependencies: string[] = [],
  estimatedCost = 1,
): ExecutionStep {
  return {
    id,
    type: ExecutionStepType.DOM_QUERY,
    dependencies,
    estimatedCost: estimatedCost as ExecutionStep["estimatedCost"],
    cacheable: false,
    selector: "div",
    selectorType: "css",
    extractFields: [],
  } as ExecutionStep;
}

Deno.test("GraphX integration - topological sort on 5-step DAG", () => {
  const builder = new DependencyGraphBuilder();
  //  A -> B -> D
  //  A -> C -> D -> E
  const steps = [
    makeStep("A"),
    makeStep("B", ["A"]),
    makeStep("C", ["A"]),
    makeStep("D", ["B", "C"]),
    makeStep("E", ["D"]),
  ];

  const graph = builder.build(steps);
  const order = builder.topologicalSort(graph);

  assertEquals(order.length, 5);

  // Each step must come after its dependencies
  const indexOf = (id: string) => order.indexOf(id);
  assert(indexOf("A") < indexOf("B"));
  assert(indexOf("A") < indexOf("C"));
  assert(indexOf("B") < indexOf("D"));
  assert(indexOf("C") < indexOf("D"));
  assert(indexOf("D") < indexOf("E"));
});

Deno.test("GraphX integration - hasCycles returns false for DAG", () => {
  const builder = new DependencyGraphBuilder();
  const steps = [
    makeStep("A"),
    makeStep("B", ["A"]),
    makeStep("C", ["A"]),
  ];
  const graph = builder.build(steps);
  assertEquals(builder.hasCycles(graph), false);
});

Deno.test("GraphX integration - hasCycles returns true for cyclic graph", () => {
  const builder = new DependencyGraphBuilder();
  // Manually create a cycle: A -> B -> A
  const steps = [
    makeStep("A", ["B"]),
    makeStep("B", ["A"]),
  ];
  const graph = builder.build(steps);
  assertEquals(builder.hasCycles(graph), true);
});

Deno.test("GraphX integration - getDigraph returns DiGraph with correct counts", () => {
  const builder = new DependencyGraphBuilder();
  const steps = [
    makeStep("A"),
    makeStep("B", ["A"]),
    makeStep("C", ["A"]),
    makeStep("D", ["B", "C"]),
    makeStep("E", ["D"]),
  ];
  const graph = builder.build(steps);
  const digraph = builder.getDigraph(graph);

  assert(digraph !== undefined);
  assertEquals(digraph!.nodeCount, 5);
  assertEquals(digraph!.edgeCount, 5); // A->B, A->C, B->D, C->D, D->E
});

Deno.test("GraphX integration - findParallelGroups still works", () => {
  const builder = new DependencyGraphBuilder();
  //  A   B  (roots, parallel)
  //  |   |
  //  C   D  (level 2, parallel)
  //   \ /
  //    E    (leaf)
  const steps = [
    makeStep("A"),
    makeStep("B"),
    makeStep("C", ["A"]),
    makeStep("D", ["B"]),
    makeStep("E", ["C", "D"]),
  ];
  const graph = builder.build(steps);
  const groups = builder.findParallelGroups(graph);

  // Roots A,B form a parallel group; C,D form another
  assert(groups.length >= 2);
  const rootGroup = groups.find(
    (g) => g.includes("A") && g.includes("B"),
  );
  assert(rootGroup !== undefined);
  const midGroup = groups.find(
    (g) => g.includes("C") && g.includes("D"),
  );
  assert(midGroup !== undefined);
});

Deno.test("GraphX integration - topologicalSort throws on cycle", () => {
  const builder = new DependencyGraphBuilder();
  const steps = [
    makeStep("A", ["C"]),
    makeStep("B", ["A"]),
    makeStep("C", ["B"]),
  ];
  const graph = builder.build(steps);

  let threw = false;
  try {
    builder.topologicalSort(graph);
  } catch (e) {
    threw = true;
    assert((e as Error).message.includes("Circular dependency"));
  }
  assert(threw, "Expected topologicalSort to throw on cycle");
});
