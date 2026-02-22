/**
 * GraphX Pipeline Integration Tests
 *
 * Verifies end-to-end integration between RenderingPipeline,
 * LiveTraceBridge, and tree-to-graph converters.
 */

import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { RenderingPipeline } from "../../src/engine/RenderingPipeline.ts";
import { LiveTraceBridge } from "@browserx/graphx/adapters";
import {
  cssomAsSvg,
  cssomToGraph,
  displayListAsSvg,
  displayListToGraph,
  domTreeAsSvg,
  domTreeToGraph,
  layoutTreeAsSvg,
  layoutTreeToGraph,
} from "../../src/engine/rendering/graphs/mod.ts";

Deno.test({
  name: "RenderingPipeline + LiveTraceBridge - all 9 stages complete",
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  const bridge = LiveTraceBridge.forRendering();
  const pipeline = new RenderingPipeline();
  pipeline.setObserver(bridge);

  const _result = await pipeline.render(
    "data:text/html,<html><body><div style='background:red'>Hello</div></body></html>",
  );

  const trace = bridge.getTrace();
  const completed = trace.stages.filter(
    (s: { status: string }) => s.status === "completed",
  );
  assertEquals(
    completed.length,
    9,
    `Expected 9 completed stages, got ${completed.length}: ${
      trace.stages.map((s: { id: string; status: string }) => `${s.id}:${s.status}`).join(", ")
    }`,
  );

  assert(trace.edges.length >= 8, "Should have at least 8 edges");
});

Deno.test({
  name: "getLastRenderArtifacts + tree converters produce DiGraphs",
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  const pipeline = new RenderingPipeline();
  await pipeline.render(
    "data:text/html,<html><head><style>body{color:red}</style></head><body><p>Test</p></body></html>",
  );

  const artifacts = pipeline.getLastRenderArtifacts();
  assertExists(artifacts, "Should have render artifacts");

  // DOM tree
  if (artifacts.dom) {
    const domGraph = domTreeToGraph(artifacts.dom);
    assert(domGraph.nodeCount > 0, "DOM graph should have nodes");
    const svg = domTreeAsSvg(artifacts.dom);
    assert(svg.includes("<svg"), "DOM SVG should contain <svg");
  }

  // CSSOM
  if (artifacts.cssom) {
    const cssomGraph = cssomToGraph(artifacts.cssom);
    assert(cssomGraph.nodeCount > 0, "CSSOM graph should have nodes");
    const svg = cssomAsSvg(artifacts.cssom);
    assert(svg.includes("<svg"), "CSSOM SVG should contain <svg");
  }

  // Layout tree
  if (artifacts.layoutTree) {
    const layoutGraph = layoutTreeToGraph(artifacts.layoutTree);
    assert(layoutGraph.nodeCount > 0, "Layout graph should have nodes");
    const svg = layoutTreeAsSvg(artifacts.layoutTree);
    assert(svg.includes("<svg"), "Layout SVG should contain <svg");
  }

  // Display list
  if (artifacts.displayList) {
    const dlGraph = displayListToGraph(artifacts.displayList);
    assert(dlGraph.nodeCount > 0, "DisplayList graph should have nodes");
    const svg = displayListAsSvg(artifacts.displayList);
    assert(svg.includes("<svg"), "DisplayList SVG should contain <svg");
  }
});

Deno.test("LiveTraceBridge.forQuery factory creates 7 stages", () => {
  const bridge = LiveTraceBridge.forQuery();
  const trace = bridge.getTrace();
  assertEquals(trace.stages.length, 7);
  assertEquals(trace.pipeline, "query");
});

Deno.test("LiveTraceBridge.forProxy factory creates 5 stages", () => {
  const bridge = LiveTraceBridge.forProxy();
  const trace = bridge.getTrace();
  assertEquals(trace.stages.length, 5);
  assertEquals(trace.pipeline, "proxy");
});
