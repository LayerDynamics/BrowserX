import { assertEquals, assert } from "@std/assert";
import { LiveTraceBridge } from "../../src/canvas/adapters/LiveTraceBridge.ts";
import type { ProcessTrace } from "../../src/canvas/types.ts";

Deno.test("LiveTraceBridge.forRendering - creates 9 pending stages", () => {
  const bridge = LiveTraceBridge.forRendering();
  const trace = bridge.getTrace();
  assertEquals(trace.stages.length, 9);
  assertEquals(trace.pipeline, "rendering");
  for (const stage of trace.stages) {
    assertEquals(stage.status, "pending");
  }
});

Deno.test("LiveTraceBridge.forRequest - creates 6 pending stages", () => {
  const bridge = LiveTraceBridge.forRequest();
  const trace = bridge.getTrace();
  assertEquals(trace.stages.length, 6);
  assertEquals(trace.pipeline, "request");
});

Deno.test("LiveTraceBridge.forQuery - creates 7 pending stages", () => {
  const bridge = LiveTraceBridge.forQuery();
  const trace = bridge.getTrace();
  assertEquals(trace.stages.length, 7);
  assertEquals(trace.pipeline, "query");
});

Deno.test("LiveTraceBridge.forProxy - creates 5 pending stages", () => {
  const bridge = LiveTraceBridge.forProxy();
  const trace = bridge.getTrace();
  assertEquals(trace.stages.length, 5);
  assertEquals(trace.pipeline, "proxy");
});

Deno.test("LiveTraceBridge - onStage transitions pending → running → completed", () => {
  const updates: ProcessTrace[] = [];
  const bridge = LiveTraceBridge.forRendering((trace) => updates.push({ ...trace, stages: [...trace.stages] }));

  // Running
  bridge.onStage({ stageId: "html-fetch", status: "running", startTime: 100 });
  assertEquals(updates.length, 1);
  const runningStage = updates[0].stages.find(s => s.id === "html-fetch");
  assertEquals(runningStage?.status, "running");

  // Completed
  bridge.onStage({ stageId: "html-fetch", stageName: "HTML Fetch", status: "completed", startTime: 100, endTime: 150, duration: 50, artifact: { body: "html" } });
  assertEquals(updates.length, 2);
  const completedStage = updates[1].stages.find(s => s.id === "html-fetch");
  assertEquals(completedStage?.status, "completed");
  assertEquals(completedStage?.timing.duration, 50);
});

Deno.test("LiveTraceBridge - error stage includes error info", () => {
  const bridge = LiveTraceBridge.forRendering();
  const err = new Error("DNS failed");
  bridge.onStage({ stageId: "html-fetch", status: "error", startTime: 100, endTime: 110, duration: 10, error: err });

  const trace = bridge.getTrace();
  const stage = trace.stages.find(s => s.id === "html-fetch");
  assertEquals(stage?.status, "error");
  assert(stage?.outputSummary.includes("DNS failed"));
});

Deno.test("LiveTraceBridge - full rendering trace completion", () => {
  const bridge = LiveTraceBridge.forRendering();
  const stageIds = ["html-fetch", "html-parse", "css-fetch", "css-parse", "script-execution", "style-resolution", "layout", "paint", "composite"];

  let t = 0;
  for (const id of stageIds) {
    bridge.onStage({ stageId: id, status: "running", startTime: t });
    t += 10;
    bridge.onStage({ stageId: id, status: "completed", startTime: t - 10, endTime: t, duration: 10 });
  }

  const trace = bridge.getTrace();
  for (const stage of trace.stages) {
    assertEquals(stage.status, "completed");
  }
  assert(trace.endTime !== undefined, "Should have endTime when all stages complete");
});

Deno.test("LiveTraceBridge - trace graph has correct edge count", () => {
  const bridge = LiveTraceBridge.forRendering();
  const trace = bridge.getTrace();
  assertEquals(trace.graph.edgeCount, 8); // 9 stages, 8 edges
  assertEquals(trace.graph.nodeCount, 9);
});
