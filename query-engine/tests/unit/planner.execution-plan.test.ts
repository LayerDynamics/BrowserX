/**
 * ExecutionPlan Tests
 */

import { assertEquals, assert, assertThrows } from "@std/assert";
import {
  ExecutionPlanBuilder,
  ExecutionPlanValidationError,
  validateExecutionPlan,
  serializeExecutionPlan,
  deserializeExecutionPlan,
  calculatePlanStatistics,
  cloneExecutionPlan,
  findCriticalPath,
} from "../../planner/execution-plan.ts";
import { ExecutionStepType } from "../../planner/plan.ts";

function makeStep(id: string, type = ExecutionStepType.DOM_QUERY, deps: string[] = []) {
  return { id, type, estimatedCost: 10, dependencies: deps, cacheable: false };
}

function makeGraph(stepIds: string[], deps: Record<string, string[]> = {}) {
  const nodes = new Map();
  for (const id of stepIds) {
    nodes.set(id, { stepId: id, step: makeStep(id), dependencies: deps[id] || [], dependents: [] });
  }
  const roots = stepIds.filter(id => !(deps[id]?.length));
  const leaves = stepIds.filter(id => !stepIds.some(other => deps[other]?.includes(id)));
  return { nodes, roots, leaves };
}

Deno.test("ExecutionPlanBuilder - constructor", () => {
  assert(new ExecutionPlanBuilder() instanceof ExecutionPlanBuilder);
});

Deno.test("ExecutionPlanBuilder - build with valid plan", () => {
  const builder = new ExecutionPlanBuilder();
  const query = { type: "SELECT" as const, fields: [{ name: "*" }], source: { type: "URL", value: "https://x.com" } } as any;
  const step = makeStep("s1");
  const plan = builder.withId("q1").withQuery(query).addStep(step).build(makeGraph(["s1"]));
  assertEquals(plan.id, "q1");
  assertEquals(plan.steps.length, 1);
});

Deno.test("ExecutionPlanBuilder - build without id throws", () => {
  const builder = new ExecutionPlanBuilder();
  const query = { type: "SELECT" } as any;
  builder.withQuery(query).addStep(makeStep("s1"));
  assertThrows(() => builder.build(makeGraph(["s1"])));
});

Deno.test("ExecutionPlanBuilder - build without query throws", () => {
  const builder = new ExecutionPlanBuilder();
  builder.withId("q1").addStep(makeStep("s1"));
  assertThrows(() => builder.build(makeGraph(["s1"])));
});

Deno.test("ExecutionPlanBuilder - build without steps throws", () => {
  const builder = new ExecutionPlanBuilder();
  builder.withId("q1").withQuery({ type: "SELECT" } as any);
  assertThrows(() => builder.build(makeGraph([])));
});

Deno.test("ExecutionPlanBuilder - addSteps adds multiple", () => {
  const builder = new ExecutionPlanBuilder();
  builder.withId("q1").withQuery({ type: "SELECT" } as any).addSteps([makeStep("s1"), makeStep("s2")]);
  const plan = builder.build(makeGraph(["s1", "s2"]));
  assertEquals(plan.steps.length, 2);
});

Deno.test("ExecutionPlanBuilder - withEstimatedCost overrides", () => {
  const builder = new ExecutionPlanBuilder();
  const plan = builder.withId("q1").withQuery({ type: "SELECT" } as any).addStep(makeStep("s1")).withEstimatedCost(999).build(makeGraph(["s1"]));
  assertEquals(plan.estimatedCost, 999);
});

Deno.test("ExecutionPlanBuilder - reset clears state", () => {
  const builder = new ExecutionPlanBuilder();
  builder.withId("q1").withQuery({ type: "SELECT" } as any).addStep(makeStep("s1")).reset();
  assertThrows(() => builder.build(makeGraph([])));
});

Deno.test("ExecutionPlanBuilder - withOptimization sets metadata", () => {
  const builder = new ExecutionPlanBuilder();
  const plan = builder.withId("q1").withQuery({ type: "SELECT" } as any).addStep(makeStep("s1")).withOptimization(["fold"], 0.5).build(makeGraph(["s1"]));
  assertEquals(plan.metadata.optimizationApplied, true);
  assertEquals(plan.metadata.appliedPasses, ["fold"]);
});

Deno.test("validateExecutionPlan - valid plan", () => {
  const builder = new ExecutionPlanBuilder();
  const plan = builder.withId("q1").withQuery({ type: "SELECT" } as any).addStep(makeStep("s1")).build(makeGraph(["s1"]));
  const result = validateExecutionPlan(plan);
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("serializeExecutionPlan and deserialize roundtrip", () => {
  const builder = new ExecutionPlanBuilder();
  const plan = builder.withId("q1").withQuery({ type: "SELECT" } as any).addStep(makeStep("s1")).build(makeGraph(["s1"]));
  const json = serializeExecutionPlan(plan);
  const restored = deserializeExecutionPlan(json);
  assertEquals(restored.id, plan.id);
  assertEquals(restored.steps.length, 1);
});

Deno.test("calculatePlanStatistics", () => {
  const builder = new ExecutionPlanBuilder();
  const plan = builder.withId("q1").withQuery({ type: "SELECT" } as any).addStep(makeStep("s1")).addStep(makeStep("s2")).build(makeGraph(["s1", "s2"]));
  const stats = calculatePlanStatistics(plan);
  assertEquals(stats.totalSteps, 2);
  assertEquals(stats.parallelGroups, 0);
});

Deno.test("cloneExecutionPlan creates independent copy", () => {
  const builder = new ExecutionPlanBuilder();
  const plan = builder.withId("q1").withQuery({ type: "SELECT" } as any).addStep(makeStep("s1")).build(makeGraph(["s1"]));
  const cloned = cloneExecutionPlan(plan);
  assertEquals(cloned.id, plan.id);
  assert(cloned !== plan);
  assert(cloned.steps !== plan.steps);
});
