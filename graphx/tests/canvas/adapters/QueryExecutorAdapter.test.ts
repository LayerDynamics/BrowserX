import { assertEquals, assertExists } from "@std/assert";
import { QueryExecutorAdapter } from "../../../src/canvas/adapters/QueryExecutorAdapter.ts";
import type {
  QueryExecutionTraceInput,
  QueryStepInput,
  QueryStepResult,
} from "../../../src/canvas/adapters/QueryExecutorAdapter.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStep(
  id: string,
  type: string,
  deps: string[] = [],
  opts: Partial<QueryStepInput> = {},
): QueryStepInput {
  return { id, type, dependencies: deps, cacheable: false, ...opts };
}

function makeResult(
  stepId: string,
  data: unknown = null,
  opts: Partial<QueryStepResult> = {},
): QueryStepResult {
  return {
    stepId,
    success: true,
    data,
    timing: { startTime: 100, endTime: 150, duration: 50 },
    cacheHit: false,
    ...opts,
  };
}

function makeInput(
  steps: QueryStepInput[],
  stepResults: Map<string, QueryStepResult> | Record<string, QueryStepResult> = {},
  opts: Partial<QueryExecutionTraceInput> = {},
): QueryExecutionTraceInput {
  return {
    queryId: "q-test",
    steps,
    stepResults,
    totalTime: 200,
    cacheHits: 0,
    cacheMisses: steps.length,
    ...opts,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("QueryExecutorAdapter - creates one stage per step", () => {
  const steps = [makeStep("s1", "NAVIGATE"), makeStep("s2", "DOM_QUERY"), makeStep("s3", "FILTER")];
  const trace = QueryExecutorAdapter.fromExecutionResult(makeInput(steps));

  assertEquals(trace.stages.length, 3);
  assertEquals(trace.graph.nodeCount, 3);
});

Deno.test("QueryExecutorAdapter - edges from dependencies correctly mapped", () => {
  const steps = [
    makeStep("s1", "NAVIGATE"),
    makeStep("s2", "DOM_QUERY", ["s1"]),
    makeStep("s3", "FILTER", ["s1", "s2"]),
  ];
  const trace = QueryExecutorAdapter.fromExecutionResult(makeInput(steps));

  // s1→s2, s1→s3, s2→s3 — 3 edges total
  assertEquals(trace.edges.length, 3);

  const edgeIds = trace.edges.map((e) => `${e.sourceStage}->${e.targetStage}`);
  assertEquals(edgeIds.includes("s1->s2"), true);
  assertEquals(edgeIds.includes("s1->s3"), true);
  assertEquals(edgeIds.includes("s2->s3"), true);

  // All dependency edges have the correct label
  for (const edge of trace.edges) {
    assertEquals(edge.dataFlowLabel, "depends on");
  }
});

Deno.test("QueryExecutorAdapter - outputData is actual stepResult.data", () => {
  const payload = { title: "Hello", links: ["/a", "/b"] };
  const steps = [makeStep("s1", "DOM_QUERY")];
  const results: Record<string, QueryStepResult> = {
    s1: makeResult("s1", payload),
  };

  const trace = QueryExecutorAdapter.fromExecutionResult(makeInput(steps, results));
  const stage = trace.stages[0];

  assertEquals(stage.outputData, payload);
});

Deno.test("QueryExecutorAdapter - Navigate step outputSummary shows URL from data", () => {
  const steps = [makeStep("s1", "NAVIGATE")];
  const results: Record<string, QueryStepResult> = {
    s1: makeResult("s1", { url: "https://example.com/page" }),
  };

  const trace = QueryExecutorAdapter.fromExecutionResult(makeInput(steps, results));
  assertEquals(trace.stages[0].outputSummary, "→ https://example.com/page");
});

Deno.test("QueryExecutorAdapter - DOMQuery step outputSummary shows result count when data is array", () => {
  const steps = [makeStep("s1", "DOM_QUERY")];
  const results: Record<string, QueryStepResult> = {
    s1: makeResult("s1", [{ tag: "a" }, { tag: "a" }, { tag: "a" }]),
  };

  const trace = QueryExecutorAdapter.fromExecutionResult(makeInput(steps, results));
  assertEquals(trace.stages[0].outputSummary, "3 results");
});

Deno.test("QueryExecutorAdapter - Filter step shows item count when data is array", () => {
  const steps = [makeStep("s1", "FILTER")];
  const results: Record<string, QueryStepResult> = {
    s1: makeResult("s1", ["x", "y"]),
  };

  const trace = QueryExecutorAdapter.fromExecutionResult(makeInput(steps, results));
  assertEquals(trace.stages[0].outputSummary, "2 items");
});

Deno.test("QueryExecutorAdapter - cache hits noted in metrics", () => {
  const steps = [makeStep("s1", "DOM_QUERY", [], { cacheable: true })];
  const results: Record<string, QueryStepResult> = {
    s1: makeResult("s1", [], { cacheHit: true }),
  };

  const trace = QueryExecutorAdapter.fromExecutionResult(makeInput(steps, results));
  const metrics = trace.stages[0].metrics;

  assertEquals(metrics["cacheable"], true);
  assertEquals(metrics["cacheHit"], true);
});

Deno.test("QueryExecutorAdapter - error steps have error status", () => {
  const err = new Error("fetch failed");
  const steps = [makeStep("s1", "NAVIGATE")];
  const results: Record<string, QueryStepResult> = {
    s1: makeResult("s1", undefined, { success: false, error: err }),
  };

  const trace = QueryExecutorAdapter.fromExecutionResult(makeInput(steps, results));
  const stage = trace.stages[0];

  assertEquals(stage.status, "error");
  assertExists(stage.error);
  assertEquals(stage.error!.message, "fetch failed");
});

Deno.test("QueryExecutorAdapter - missing stepResult produces pending stage", () => {
  const steps = [makeStep("s1", "NAVIGATE"), makeStep("s2", "DOM_QUERY")];
  // Only provide result for s1; s2 has no result
  const results: Record<string, QueryStepResult> = {
    s1: makeResult("s1", { url: "https://example.com" }),
  };

  const trace = QueryExecutorAdapter.fromExecutionResult(makeInput(steps, results));

  assertEquals(trace.stages[0].status, "completed");
  assertEquals(trace.stages[1].status, "pending");
});

Deno.test("QueryExecutorAdapter - timing comes from stepResult.timing", () => {
  const steps = [makeStep("s1", "NAVIGATE")];
  const results: Record<string, QueryStepResult> = {
    s1: makeResult("s1", null, {
      timing: { startTime: 1000, endTime: 1250, duration: 250 },
    }),
  };

  const trace = QueryExecutorAdapter.fromExecutionResult(makeInput(steps, results));
  const { timing } = trace.stages[0];

  assertEquals(timing.startTime, 1000);
  assertEquals(timing.endTime, 1250);
  assertEquals(timing.duration, 250);
});

Deno.test("QueryExecutorAdapter - pending stage timing uses estimatedCost when no result", () => {
  const steps = [makeStep("s1", "NAVIGATE", [], { estimatedCost: 75 })];
  // No results provided — step is pending
  const trace = QueryExecutorAdapter.fromExecutionResult(makeInput(steps, {}));
  const { timing } = trace.stages[0];

  assertEquals(timing.startTime, 0);
  assertEquals(timing.endTime, 0);
  assertEquals(timing.duration, 75);
});
