import { assertEquals } from "@std/assert";
import { assertStringIncludes } from "@std/assert/string-includes";
import { executionPlanToGraph, renderExecutionPlanAsSvg } from "../../../planner/execution-trace-graph.ts";
import type { ExecutionPlan, ExecutionStep } from "../../../planner/plan.ts";
import { ExecutionStepType } from "../../../planner/plan.ts";

function mockStep(id: string, type: ExecutionStepType, deps: string[] = []): ExecutionStep {
  return {
    id,
    type,
    estimatedCost: 100 as unknown as import("../../../types/primitives.ts").DurationMs,
    dependencies: deps,
    cacheable: type === ExecutionStepType.DOM_QUERY,
  } as ExecutionStep;
}

function mockPlan(steps: ExecutionStep[]): ExecutionPlan {
  return {
    id: "q1" as unknown as import("../../../types/primitives.ts").QueryID,
    query: {} as unknown as import("../../../types/ast.ts").Statement,
    steps,
    estimatedCost: 500 as unknown as import("../../../types/primitives.ts").DurationMs,
    resources: { browsers: 1, pages: 1, connections: 1, memory: 100, cpu: 50 },
    dependencies: {
      nodes: new Map(),
      roots: [],
      leaves: [],
    },
    cacheableSteps: [],
    parallelGroups: [],
    metadata: {
      optimizationApplied: false,
      appliedPasses: [],
      estimatedImprovement: 0,
    },
  };
}

Deno.test("executionPlanToGraph creates correct node count", () => {
  const steps = [
    mockStep("s1", ExecutionStepType.NAVIGATE),
    mockStep("s2", ExecutionStepType.DOM_QUERY, ["s1"]),
    mockStep("s3", ExecutionStepType.FILTER, ["s2"]),
  ];
  const plan = mockPlan(steps);
  const graph = executionPlanToGraph(plan);

  assertEquals(graph.nodeCount, 3);
  assertEquals(graph.edgeCount, 2);
});

Deno.test("executionPlanToGraph captures step data", () => {
  const steps = [mockStep("s1", ExecutionStepType.NAVIGATE)];
  const plan = mockPlan(steps);
  const graph = executionPlanToGraph(plan);

  const node = graph.getNode("s1");
  assertEquals(node?.data.type, "NAVIGATE");
  assertEquals(node?.data.cacheable, false);
});

Deno.test("executionPlanToGraph handles no dependencies", () => {
  const steps = [
    mockStep("s1", ExecutionStepType.NAVIGATE),
    mockStep("s2", ExecutionStepType.SCREENSHOT),
  ];
  const plan = mockPlan(steps);
  const graph = executionPlanToGraph(plan);

  assertEquals(graph.nodeCount, 2);
  assertEquals(graph.edgeCount, 0);
});

Deno.test("executionPlanToGraph ignores missing dependency references", () => {
  const steps = [
    mockStep("s1", ExecutionStepType.NAVIGATE, ["nonexistent"]),
  ];
  const plan = mockPlan(steps);
  const graph = executionPlanToGraph(plan);

  assertEquals(graph.nodeCount, 1);
  assertEquals(graph.edgeCount, 0);
});

Deno.test("renderExecutionPlanAsSvg returns valid SVG", () => {
  const steps = [
    mockStep("s1", ExecutionStepType.NAVIGATE),
    mockStep("s2", ExecutionStepType.DOM_QUERY, ["s1"]),
  ];
  const plan = mockPlan(steps);
  const svg = renderExecutionPlanAsSvg(plan);

  assertStringIncludes(svg, "<svg");
  assertStringIncludes(svg, "</svg>");
  assertStringIncludes(svg, "NAVIGATE");
  assertStringIncludes(svg, "DOM_QUERY");
});
