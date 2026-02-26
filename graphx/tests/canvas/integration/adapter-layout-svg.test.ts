/**
 * Integration tests: Adapter → ProcessTrace → Layout → SVG pipeline
 *
 * Tests the full pipeline from raw pipeline data through adapters,
 * ProcessTraceModel, layout computation, and SVG export.
 */
import { assertEquals, assertExists, assert, assertStringIncludes } from "@std/assert";
import { RenderingPipelineAdapter } from "../../../src/canvas/adapters/RenderingPipelineAdapter.ts";
import { RequestPipelineAdapter } from "../../../src/canvas/adapters/RequestPipelineAdapter.ts";
import { QueryExecutorAdapter } from "../../../src/canvas/adapters/QueryExecutorAdapter.ts";
import { ProxyMiddlewareAdapter } from "../../../src/canvas/adapters/ProxyMiddlewareAdapter.ts";
import { ProcessTraceModel } from "../../../src/canvas/ProcessTraceModel.ts";
import { hierarchical } from "../../../src/layout/hierarchical.ts";
import { forceDirected } from "../../../src/layout/force-directed.ts";
import { radial } from "../../../src/layout/radial.ts";
import { grid } from "../../../src/layout/grid.ts";
import { render } from "../../../src/svg/SVGRenderer.ts";
import { topologicalSort } from "../../../src/algorithms/topological-sort.ts";
import { bfs } from "../../../src/algorithms/bfs.ts";
import { dfs } from "../../../src/algorithms/dfs.ts";
import { connectedComponents } from "../../../src/algorithms/connected-components.ts";
import type { ProcessTrace } from "../../../src/canvas/types.ts";

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeRenderingInput() {
  return {
    timing: {
      htmlFetch: 20, htmlParse: 15, cssFetch: 10, cssParse: 5,
      scriptExecution: 3, styleResolution: 8, layoutComputation: 6,
      paintRecording: 4, compositing: 2, total: 73,
    },
    dom: {
      nodeName: "#document",
      childNodes: [
        {
          nodeName: "html",
          childNodes: [
            { nodeName: "head", childNodes: [{ nodeName: "title" }] },
            { nodeName: "body", childNodes: [{ nodeName: "div" }, { nodeName: "p" }] },
          ],
        },
      ],
    },
    cssom: { rules: Array.from({ length: 42 }, (_, i) => ({ selector: `.rule-${i}`, properties: {} })) },
    renderTree: { root: true, children: [{ tag: "div" }, { tag: "p" }] },
    layoutTree: { type: "block", width: 1920, height: 1080, children: [{ type: "inline", width: 200, height: 40 }] },
    displayList: { commands: Array.from({ length: 156 }, (_, i) => ({ type: "rect", id: i })) },
    resources: [
      { url: "https://example.com", type: "html", size: 4096, fetchTime: 20, cached: false },
      { url: "https://example.com/style.css", type: "css", size: 2048, fetchTime: 10, cached: false },
      { url: "https://example.com/app.js", type: "script", size: 8192, fetchTime: 5, cached: true },
    ],
  };
}

function makeRequestInput(options?: { cached?: boolean; statusCode?: number }) {
  const cached = options?.cached ?? false;
  const statusCode = options?.statusCode ?? 200;
  return {
    request: {
      method: "POST",
      url: "https://api.example.com/v2/users",
      headers: { "content-type": "application/json", "authorization": "Bearer tok123", "accept": "application/json" },
    },
    response: {
      statusCode,
      statusText: statusCode === 200 ? "OK" : statusCode === 404 ? "Not Found" : "Error",
      headers: { "content-type": "application/json", "x-request-id": "abc-123", "cache-control": "no-store" },
      body: new Uint8Array(2048),
    },
    fromCache: cached,
    timing: { dnsLookup: 5, tcpConnection: 12, tlsHandshake: 10, requestSent: 1, firstByte: 25, download: 8, total: 61 },
  };
}

function makeQueryInput(stepCount: number, withError?: { stepIndex: number }) {
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    id: `step-${i}`,
    type: i === 0 ? "NAVIGATE" : i === stepCount - 1 ? "SORT" : i % 2 === 0 ? "FILTER" : "DOM_QUERY",
    dependencies: i > 0 ? [`step-${i - 1}`] : [],
    cacheable: i > 0,
  }));

  const stepResults = new Map(
    steps.map((step, i) => {
      const isError = withError?.stepIndex === i;
      const start = i * 100;
      return [
        step.id,
        {
          stepId: step.id,
          success: !isError,
          data: isError
            ? undefined
            : step.type === "NAVIGATE"
            ? { url: "https://example.com" }
            : Array.from({ length: 10 - i }, (_, j) => ({ item: j })),
          error: isError ? new Error(`Step ${step.id} failed`) : undefined,
          timing: { startTime: start, endTime: start + 80, duration: 80 },
        },
      ];
    }),
  );

  return {
    queryId: `q-integration-${stepCount}`,
    steps,
    stepResults,
    totalTime: stepCount * 100,
    cacheHits: 1,
    cacheMisses: stepCount - 1,
  };
}

function makeProxyInput(options?: {
  middlewareCount?: number;
  responseMiddlewareCount?: number;
  shortCircuit?: boolean;
}) {
  const mwCount = options?.middlewareCount ?? 2;
  const rmwCount = options?.responseMiddlewareCount ?? 1;

  const requestMiddleware = Array.from({ length: mwCount }, (_, i) => ({
    name: i === 0 ? "auth" : `filter-${i}`,
    result: options?.shortCircuit && i === mwCount - 1
      ? { type: "respond" as const, statusCode: 403 }
      : { type: "continue" as const },
    timing: 2 + i,
  }));

  const responseMiddleware = Array.from({ length: rmwCount }, (_, i) => ({
    name: i === 0 ? "compress" : `transform-${i}`,
    timing: 3 + i,
    outputSummary: i === 0 ? "gzip, 42KB → 12KB" : "transformed",
  }));

  return {
    method: "GET",
    url: "https://api.example.com/users?page=1",
    clientIP: "192.168.1.100",
    routeId: "api-users-list",
    routePattern: "/users",
    routePriority: 5,
    requestMiddleware,
    upstream: { host: "backend-1", port: 8080, statusCode: 200, statusText: "OK", headers: { "x-backend": "1" }, bodySize: 4096, timing: 45 },
    responseMiddleware,
    totalTime: 55,
  };
}

// ---------------------------------------------------------------------------
// Integration: Adapter → Layout → SVG
// ---------------------------------------------------------------------------

Deno.test("Integration: rendering trace → hierarchical layout → SVG has all 9 nodes", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());
  const layout = hierarchical(trace.graph, { direction: "LR" });
  const svg = render(trace.graph, layout, { directed: true, showLabels: true });

  assert(svg.startsWith("<svg"));
  assertStringIncludes(svg, "</svg>");
  // All 9 stage names should appear as labels
  for (const stage of trace.stages) {
    assertStringIncludes(svg, stage.stage);
  }
});

Deno.test("Integration: rendering trace → force-directed layout → SVG", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());
  const layout = forceDirected(trace.graph, { width: 1200, height: 400, iterations: 30, seed: 42 });
  const svg = render(trace.graph, layout, { directed: true });

  assertEquals(layout.nodes.length, 9);
  assert(svg.startsWith("<svg"));
});

Deno.test("Integration: rendering trace → radial layout → SVG", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());
  const layout = radial(trace.graph, { radius: 300 });
  const svg = render(trace.graph, layout, { directed: true });

  assertEquals(layout.nodes.length, 9);
  assert(svg.startsWith("<svg"));
});

Deno.test("Integration: rendering trace → grid layout → SVG", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());
  const layout = grid(trace.graph, { columns: 3 });
  const svg = render(trace.graph, layout, { directed: true });

  assertEquals(layout.nodes.length, 9);
  assert(svg.startsWith("<svg"));
});

Deno.test("Integration: request trace → hierarchical layout (LR) → SVG has 6 nodes", () => {
  const trace = RequestPipelineAdapter.fromRequestResult(makeRequestInput());
  const layout = hierarchical(trace.graph, { direction: "LR" });
  const svg = render(trace.graph, layout, { directed: true, showLabels: true });

  assertEquals(layout.nodes.length, 6);
  assertStringIncludes(svg, "Cache Check");
  assertStringIncludes(svg, "Response Receive");
});

Deno.test("Integration: cached request trace → hierarchical layout → SVG has 2 nodes", () => {
  const trace = RequestPipelineAdapter.fromRequestResult(makeRequestInput({ cached: true }));
  const layout = hierarchical(trace.graph, { direction: "LR" });
  const svg = render(trace.graph, layout, { directed: true });

  assertEquals(layout.nodes.length, 2);
  assertEquals(trace.stages.length, 2);
});

Deno.test("Integration: 5-step query trace → hierarchical layout → SVG", () => {
  const trace = QueryExecutorAdapter.fromExecutionResult(makeQueryInput(5));
  const layout = hierarchical(trace.graph, { direction: "TB" });
  const svg = render(trace.graph, layout, { directed: true, showLabels: true });

  assertEquals(layout.nodes.length, 5);
  assertEquals(trace.edges.length, 4); // linear chain
  assert(svg.startsWith("<svg"));
});

Deno.test("Integration: proxy trace → hierarchical layout → SVG", () => {
  const trace = ProxyMiddlewareAdapter.fromProxyRequest(makeProxyInput());
  const layout = hierarchical(trace.graph, { direction: "LR" });
  const svg = render(trace.graph, layout, { directed: true, showLabels: true });

  // incoming + 2 req mw + route + upstream + 1 res mw + final = 7
  assertEquals(trace.stages.length, 7);
  assertEquals(layout.nodes.length, 7);
  assertStringIncludes(svg, "Incoming Request");
  assertStringIncludes(svg, "Final Response");
});

Deno.test("Integration: proxy short-circuit → fewer stages than full trace", () => {
  const fullTrace = ProxyMiddlewareAdapter.fromProxyRequest(makeProxyInput());
  const shortTrace = ProxyMiddlewareAdapter.fromProxyRequest(makeProxyInput({ shortCircuit: true }));

  assert(shortTrace.stages.length < fullTrace.stages.length);
  assertEquals(shortTrace.stages[shortTrace.stages.length - 1].stage, "Short-Circuit Response");
  assertEquals(shortTrace.metadata["shortCircuited"], true);
});

// ---------------------------------------------------------------------------
// Integration: DiGraph algorithms on trace graphs
// ---------------------------------------------------------------------------

Deno.test("Integration: topologicalSort on rendering trace produces linear order", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());
  const result = topologicalSort(trace.graph);

  assertEquals(result.hasCycle, false);
  assertEquals(result.order.length, 9);
  // First should be s1 (no predecessors), last should be s9
  assertEquals(result.order[0], trace.stages[0].id);
  assertEquals(result.order[8], trace.stages[8].id);
});

Deno.test("Integration: BFS from first stage visits all 9 rendering stages", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());
  const result = bfs(trace.graph, trace.stages[0].id);

  assertEquals(result.order.length, 9);
});

Deno.test("Integration: DFS from first stage visits all rendering stages", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());
  const result = dfs(trace.graph, trace.stages[0].id);

  assertEquals(result.order.length, 9);
});

Deno.test("Integration: connectedComponents on linear trace = 1 component", () => {
  const trace = RequestPipelineAdapter.fromRequestResult(makeRequestInput());
  const result = connectedComponents(trace.graph);

  assertEquals(result.count, 1);
});

Deno.test("Integration: query trace with branching dependencies preserves dep edges", () => {
  // Create a diamond: s1 → s2, s1 → s3, s2 → s4, s3 → s4
  const trace = QueryExecutorAdapter.fromExecutionResult({
    queryId: "q-diamond",
    steps: [
      { id: "s1", type: "NAVIGATE", dependencies: [], cacheable: false },
      { id: "s2", type: "DOM_QUERY", dependencies: ["s1"], cacheable: true },
      { id: "s3", type: "DOM_QUERY", dependencies: ["s1"], cacheable: true },
      { id: "s4", type: "FILTER", dependencies: ["s2", "s3"], cacheable: false },
    ],
    stepResults: new Map([
      ["s1", { stepId: "s1", success: true, data: { url: "https://x.com" }, timing: { startTime: 0, endTime: 50, duration: 50 } }],
      ["s2", { stepId: "s2", success: true, data: [1, 2, 3], timing: { startTime: 50, endTime: 100, duration: 50 } }],
      ["s3", { stepId: "s3", success: true, data: [4, 5], timing: { startTime: 50, endTime: 110, duration: 60 } }],
      ["s4", { stepId: "s4", success: true, data: [1, 4], timing: { startTime: 110, endTime: 130, duration: 20 } }],
    ]),
    totalTime: 130,
    cacheHits: 0,
    cacheMisses: 4,
  });

  assertEquals(trace.stages.length, 4);
  assertEquals(trace.edges.length, 4); // s1→s2, s1→s3, s2→s4, s3→s4

  // Verify graph structure: s4 has 2 predecessors
  const predecessors = trace.graph.predecessors("s4");
  assertEquals(predecessors.length, 2);
  const predIds = predecessors.map((n) => n.id);
  assert(predIds.includes("s2"));
  assert(predIds.includes("s3"));

  // Topological sort should work (it's a DAG)
  const topo = topologicalSort(trace.graph);
  assertEquals(topo.hasCycle, false);
  assertEquals(topo.order.length, 4);
  // s1 must come before s2, s3; both must come before s4
  const s1Idx = topo.order.indexOf("s1");
  const s4Idx = topo.order.indexOf("s4");
  assert(s1Idx < s4Idx);
});

// ---------------------------------------------------------------------------
// Integration: ProcessTraceModel operations across different adapters
// ---------------------------------------------------------------------------

Deno.test("Integration: updateStage across multiple stages simulates live tracing", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());

  // Simulate stages completing one by one
  let current = trace;
  for (let i = 0; i < trace.stages.length; i++) {
    current = ProcessTraceModel.updateStage(current, trace.stages[i].id, {
      status: "running",
    });
    assertEquals(current.stages[i].status, "running");

    current = ProcessTraceModel.updateStage(current, trace.stages[i].id, {
      status: "completed",
    });
    assertEquals(current.stages[i].status, "completed");
  }

  // All stages completed → endTime should be set
  assertExists(current.endTime);
});

Deno.test("Integration: totalDuration consistent across adapter types", () => {
  const renderTrace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());
  const requestTrace = RequestPipelineAdapter.fromRequestResult(makeRequestInput());
  const queryTrace = QueryExecutorAdapter.fromExecutionResult(makeQueryInput(3));
  const proxyTrace = ProxyMiddlewareAdapter.fromProxyRequest(makeProxyInput());

  // Each should have a positive total duration
  assert(ProcessTraceModel.totalDuration(renderTrace) > 0);
  assert(ProcessTraceModel.totalDuration(requestTrace) > 0);
  assert(ProcessTraceModel.totalDuration(queryTrace) > 0);
  assert(ProcessTraceModel.totalDuration(proxyTrace) > 0);
});

Deno.test("Integration: stagesInOrder respects dependency ordering for query trace", () => {
  const trace = QueryExecutorAdapter.fromExecutionResult(makeQueryInput(4));
  const ordered = ProcessTraceModel.stagesInOrder(trace);

  assertEquals(ordered.length, 4);
  // First should be step-0 (NAVIGATE, no deps)
  assertEquals(ordered[0].id, "step-0");
  // Each subsequent stage depends on the previous
  for (let i = 1; i < ordered.length; i++) {
    const prevIdx = ordered.findIndex((s) => s.id === `step-${i - 1}`);
    const curIdx = ordered.findIndex((s) => s.id === `step-${i}`);
    assert(prevIdx < curIdx, `step-${i - 1} should come before step-${i}`);
  }
});

// ---------------------------------------------------------------------------
// Integration: Cross-adapter graph comparison
// ---------------------------------------------------------------------------

Deno.test("Integration: all pipeline traces produce valid DiGraphs with matching node/edge counts", () => {
  const traces: ProcessTrace[] = [
    RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput()),
    RequestPipelineAdapter.fromRequestResult(makeRequestInput()),
    QueryExecutorAdapter.fromExecutionResult(makeQueryInput(3)),
    ProxyMiddlewareAdapter.fromProxyRequest(makeProxyInput()),
  ];

  for (const trace of traces) {
    // DiGraph node count matches stage count
    assertEquals(trace.graph.nodeCount, trace.stages.length);
    // DiGraph edge count matches edge count
    assertEquals(trace.graph.edgeCount, trace.edges.length);
    // Every stage ID is a graph node
    for (const stage of trace.stages) {
      assert(trace.graph.hasNode(stage.id));
    }
    // Every edge references valid nodes
    for (const edge of trace.edges) {
      assert(trace.graph.hasNode(edge.sourceStage));
      assert(trace.graph.hasNode(edge.targetStage));
    }
  }
});

Deno.test("Integration: layout node count matches graph node count for all layouts", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());

  const layouts = [
    hierarchical(trace.graph, { direction: "LR" }),
    forceDirected(trace.graph, { seed: 42 }),
    radial(trace.graph),
    grid(trace.graph),
  ];

  for (const layout of layouts) {
    assertEquals(layout.nodes.length, trace.graph.nodeCount);
    assert(layout.width > 0);
    assert(layout.height > 0);
  }
});

// ---------------------------------------------------------------------------
// Integration: Error stages propagated through pipeline
// ---------------------------------------------------------------------------

Deno.test("Integration: query trace with error step has error status and Error object", () => {
  const trace = QueryExecutorAdapter.fromExecutionResult(makeQueryInput(3, { stepIndex: 1 }));

  const errorStage = trace.stages[1];
  assertEquals(errorStage.status, "error");
  assertExists(errorStage.error);
  assertStringIncludes(errorStage.error!.message, "step-1");

  // Non-error stages still have correct status
  assertEquals(trace.stages[0].status, "completed");
  assertEquals(trace.stages[2].status, "completed");

  // Layout still works with error stages
  const layout = hierarchical(trace.graph, { direction: "LR" });
  assertEquals(layout.nodes.length, 3);
});

Deno.test("Integration: updateStage to error mid-trace sets endTime to undefined", () => {
  const trace = RequestPipelineAdapter.fromRequestResult(makeRequestInput());
  // All stages start as completed, so endTime is set
  assertExists(trace.endTime);

  // Set one stage to running (simulates re-trace)
  const updated = ProcessTraceModel.updateStage(trace, trace.stages[2].id, {
    status: "running",
  });
  // endTime should be undefined since not all stages are complete/error
  assertEquals(updated.endTime, undefined);
});

// ---------------------------------------------------------------------------
// Integration: Rendering adapter data fidelity
// ---------------------------------------------------------------------------

Deno.test("Integration: rendering trace outputData preserves original DOM tree", () => {
  const input = makeRenderingInput();
  const trace = RenderingPipelineAdapter.fromRenderingResult(input);

  const htmlParseStage = trace.stages.find((s) => s.stage === "HTML Parse");
  assertExists(htmlParseStage);
  assertEquals(htmlParseStage.outputData, input.dom);
});

Deno.test("Integration: rendering trace outputData preserves original CSSOM", () => {
  const input = makeRenderingInput();
  const trace = RenderingPipelineAdapter.fromRenderingResult(input);

  const cssParseStage = trace.stages.find((s) => s.stage === "CSS Parse");
  assertExists(cssParseStage);
  assertEquals(cssParseStage.outputData, input.cssom);
});

Deno.test("Integration: rendering trace outputData preserves layout tree", () => {
  const input = makeRenderingInput();
  const trace = RenderingPipelineAdapter.fromRenderingResult(input);

  const layoutStage = trace.stages.find((s) => s.stage === "Layout");
  assertExists(layoutStage);
  assertEquals(layoutStage.outputData, input.layoutTree);
});

Deno.test("Integration: rendering trace outputData preserves display list", () => {
  const input = makeRenderingInput();
  const trace = RenderingPipelineAdapter.fromRenderingResult(input);

  const paintStage = trace.stages.find((s) => s.stage === "Paint");
  assertExists(paintStage);
  assertEquals(paintStage.outputData, input.displayList);
});

// ---------------------------------------------------------------------------
// Integration: Request adapter data fidelity
// ---------------------------------------------------------------------------

Deno.test("Integration: request trace Response stage has full HTTP response data", () => {
  const input = makeRequestInput();
  const trace = RequestPipelineAdapter.fromRequestResult(input);

  const responseStage = trace.stages.find((s) => s.stage === "Response Receive");
  assertExists(responseStage);
  const data = responseStage.outputData as Record<string, unknown>;
  assertEquals(data["statusCode"], 200);
  assertExists(data["headers"]);
});

Deno.test("Integration: request trace Request Send stage has HTTP request data", () => {
  const input = makeRequestInput();
  const trace = RequestPipelineAdapter.fromRequestResult(input);

  const requestStage = trace.stages.find((s) => s.stage === "Request Send");
  assertExists(requestStage);
  assertEquals(requestStage.outputData, input.request);
});

// ---------------------------------------------------------------------------
// Integration: Multiple traces don't share state
// ---------------------------------------------------------------------------

Deno.test("Integration: creating two proxy traces produces independent ID spaces", () => {
  const trace1 = ProxyMiddlewareAdapter.fromProxyRequest(makeProxyInput());
  const trace2 = ProxyMiddlewareAdapter.fromProxyRequest(makeProxyInput({ middlewareCount: 3 }));

  // Both should have valid IDs that don't conflict (different stage counts means different structures)
  assert(trace1.stages.length !== trace2.stages.length);

  // IDs within each trace should be unique
  const ids1 = new Set(trace1.stages.map((s) => s.id));
  const ids2 = new Set(trace2.stages.map((s) => s.id));
  assertEquals(ids1.size, trace1.stages.length);
  assertEquals(ids2.size, trace2.stages.length);
});

Deno.test("Integration: creating two rendering traces produces independent graphs", () => {
  const trace1 = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());
  const trace2 = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());

  // Both are valid with same structure
  assertEquals(trace1.stages.length, trace2.stages.length);

  // Modifying one doesn't affect the other's stages array
  const updated = ProcessTraceModel.updateStage(trace1, trace1.stages[0].id, { status: "error" });
  assertEquals(updated.stages[0].status, "error");
  assertEquals(trace2.stages[0].status, "completed");
});
