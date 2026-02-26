import { assertEquals, assertExists } from "@std/assert";
import { ProcessTraceModel } from "../../src/canvas/ProcessTraceModel.ts";
import type { StageNode, StageEdge } from "../../src/canvas/types.ts";

function makeStage(id: string, stage: string, duration: number, status: "completed" | "pending" = "completed"): StageNode {
  return {
    id,
    stage,
    pipeline: "rendering",
    status,
    timing: { startTime: 100, endTime: 100 + duration, duration },
    inputSummary: `input for ${stage}`,
    outputData: { mockData: true },
    outputSummary: `output of ${stage}`,
    metrics: { duration },
  };
}

function makeEdge(source: string, target: string, label: string): StageEdge {
  return {
    id: `${source}->${target}`,
    sourceStage: source,
    targetStage: target,
    dataFlowLabel: label,
  };
}

Deno.test("ProcessTraceModel - fromStages builds DiGraph with correct node count", () => {
  const stages = [makeStage("s1", "HTML Fetch", 10), makeStage("s2", "HTML Parse", 5)];
  const edges = [makeEdge("s1", "s2", "HTML string")];
  const trace = ProcessTraceModel.fromStages("rendering", stages, edges);

  assertEquals(trace.graph.nodeCount, 2);
  assertEquals(trace.graph.edgeCount, 1);
  assertEquals(trace.pipeline, "rendering");
  assertEquals(trace.stages.length, 2);
  assertEquals(trace.edges.length, 1);
});

Deno.test("ProcessTraceModel - fromStages stores actual stage data in graph nodes", () => {
  const stages = [makeStage("s1", "DNS", 12)];
  const trace = ProcessTraceModel.fromStages("request", stages, []);

  const node = trace.graph.getNode("s1");
  assertExists(node);
  assertEquals(node.data.stage, "DNS");
  assertEquals(node.data.timing.duration, 12);
  assertEquals(node.data.outputData, { mockData: true });
});

Deno.test("ProcessTraceModel - fromStages stores edge data flow labels", () => {
  const stages = [makeStage("s1", "Parse", 5), makeStage("s2", "Style", 3)];
  const edges = [makeEdge("s1", "s2", "DOMNode tree")];
  const trace = ProcessTraceModel.fromStages("rendering", stages, edges);

  const edge = trace.graph.getEdge("s1->s2");
  assertExists(edge);
  assertEquals(edge.label, "DOMNode tree");
  assertEquals(edge.data?.dataFlowLabel, "DOMNode tree");
});

Deno.test("ProcessTraceModel - fromStages skips edges with missing nodes", () => {
  const stages = [makeStage("s1", "Fetch", 10)];
  const edges = [makeEdge("s1", "s999", "orphan")];
  const trace = ProcessTraceModel.fromStages("request", stages, edges);

  assertEquals(trace.graph.edgeCount, 0);
  assertEquals(trace.edges.length, 1); // original edges array unchanged
});

Deno.test("ProcessTraceModel - fromStages computes endTime when all stages complete", () => {
  const stages = [
    { ...makeStage("s1", "A", 10), timing: { startTime: 100, endTime: 110, duration: 10 } },
    { ...makeStage("s2", "B", 20), timing: { startTime: 110, endTime: 130, duration: 20 } },
  ];
  const trace = ProcessTraceModel.fromStages("rendering", stages, []);

  assertEquals(trace.startTime, 100);
  assertEquals(trace.endTime, 130);
});

Deno.test("ProcessTraceModel - fromStages leaves endTime undefined when stages pending", () => {
  const stages = [makeStage("s1", "A", 10), makeStage("s2", "B", 0, "pending")];
  const trace = ProcessTraceModel.fromStages("rendering", stages, []);

  assertEquals(trace.endTime, undefined);
});

Deno.test("ProcessTraceModel - updateStage updates stage status and data", () => {
  const stages = [makeStage("s1", "A", 10, "pending"), makeStage("s2", "B", 0, "pending")];
  const trace = ProcessTraceModel.fromStages("rendering", stages, []);

  const updated = ProcessTraceModel.updateStage(trace, "s1", {
    status: "completed",
    timing: { startTime: 100, endTime: 115, duration: 15 },
    outputData: { resolved: "93.184.216.34" },
  });

  const s1 = updated.stages.find((s) => s.id === "s1")!;
  assertEquals(s1.status, "completed");
  assertEquals(s1.timing.duration, 15);
  assertEquals(s1.outputData, { resolved: "93.184.216.34" });
});

Deno.test("ProcessTraceModel - totalDuration sums all stage durations", () => {
  const stages = [makeStage("s1", "A", 10), makeStage("s2", "B", 20), makeStage("s3", "C", 5)];
  const trace = ProcessTraceModel.fromStages("rendering", stages, []);

  assertEquals(ProcessTraceModel.totalDuration(trace), 35);
});

Deno.test("ProcessTraceModel - totalDuration returns 0 for empty trace", () => {
  const trace = ProcessTraceModel.fromStages("rendering", [], []);
  assertEquals(ProcessTraceModel.totalDuration(trace), 0);
});

Deno.test("ProcessTraceModel - stagesInOrder respects dependencies", () => {
  const stages = [makeStage("s3", "C", 5), makeStage("s1", "A", 10), makeStage("s2", "B", 3)];
  const edges = [makeEdge("s1", "s2", "x"), makeEdge("s2", "s3", "y")];
  const trace = ProcessTraceModel.fromStages("rendering", stages, edges);

  const order = ProcessTraceModel.stagesInOrder(trace);
  const ids = order.map((s) => s.id);
  assertEquals(ids.indexOf("s1") < ids.indexOf("s2"), true);
  assertEquals(ids.indexOf("s2") < ids.indexOf("s3"), true);
});

Deno.test("ProcessTraceModel - fromStages with metadata", () => {
  const trace = ProcessTraceModel.fromStages("query", [], [], { queryId: "q-123", cached: false });
  assertEquals(trace.metadata.queryId, "q-123");
  assertEquals(trace.metadata.cached, false);
});

Deno.test("ProcessTraceModel - graph preserves directed edges (successors/predecessors)", () => {
  const stages = [makeStage("s1", "A", 10), makeStage("s2", "B", 5), makeStage("s3", "C", 3)];
  const edges = [makeEdge("s1", "s2", "flow1"), makeEdge("s1", "s3", "flow2")];
  const trace = ProcessTraceModel.fromStages("rendering", stages, edges);

  const successors = trace.graph.successors("s1").map((n) => n.id).sort();
  assertEquals(successors, ["s2", "s3"]);

  const predecessors = trace.graph.predecessors("s2").map((n) => n.id);
  assertEquals(predecessors, ["s1"]);
});
