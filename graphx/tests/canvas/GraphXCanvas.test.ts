import { assertEquals, assertExists } from "@std/assert";
import { ProcessTraceModel } from "../../src/canvas/ProcessTraceModel.ts";
import { RenderingPipelineAdapter } from "../../src/canvas/adapters/RenderingPipelineAdapter.ts";
import { RequestPipelineAdapter } from "../../src/canvas/adapters/RequestPipelineAdapter.ts";
import { QueryExecutorAdapter } from "../../src/canvas/adapters/QueryExecutorAdapter.ts";
import { ProxyMiddlewareAdapter } from "../../src/canvas/adapters/ProxyMiddlewareAdapter.ts";
import { hierarchical } from "../../src/layout/hierarchical.ts";
import { render } from "../../src/svg/SVGRenderer.ts";

// Note: GraphXCanvas itself (the HTMLElement) cannot be tested in Deno without a full DOM.
// These tests verify the pipeline adapter → ProcessTrace → layout pipeline that feeds it.

function makeRenderingInput() {
  return {
    timing: {
      htmlFetch: 20, htmlParse: 15, cssFetch: 10, cssParse: 5,
      scriptExecution: 3, styleResolution: 8, layoutComputation: 6,
      paintRecording: 4, compositing: 2, total: 73,
    },
    dom: { nodeName: "#document", childNodes: [{ nodeName: "html", childNodes: [{ nodeName: "body" }] }] },
    cssom: { rules: [1, 2, 3] },
    renderTree: { root: true },
    layoutTree: { type: "block", width: 1280, height: 720, children: [] },
    displayList: { commands: [1, 2, 3, 4, 5] },
    resources: [{ url: "https://example.com", type: "html", size: 4096, fetchTime: 20, cached: false }],
  };
}

function makeRequestInput(cached = false) {
  return {
    request: { method: "GET", url: "https://example.com/api", headers: { "accept": "application/json" } },
    response: { statusCode: 200, statusText: "OK", headers: { "content-type": "application/json" }, body: new Uint8Array(1024) },
    fromCache: cached,
    timing: { dnsLookup: 10, tcpConnection: 15, tlsHandshake: 8, requestSent: 2, firstByte: 20, download: 12, total: 67 },
  };
}

Deno.test("RenderingPipelineAdapter produces 9-stage trace for traceRendering", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());
  assertEquals(trace.stages.length, 9);
  assertEquals(trace.pipeline, "rendering");
  assertEquals(trace.stages[0].stage, "HTML Fetch");
  assertEquals(trace.stages[1].stage, "HTML Parse");
  assertEquals(trace.stages[8].stage, "Composite");
});

Deno.test("RequestPipelineAdapter produces 6-stage trace for traceRequest", () => {
  const trace = RequestPipelineAdapter.fromRequestResult(makeRequestInput());
  assertEquals(trace.stages.length, 6);
  assertEquals(trace.pipeline, "request");
  assertEquals(trace.stages[0].stage, "Cache Check");
  assertEquals(trace.stages[5].stage, "Response Receive");
});

Deno.test("RequestPipelineAdapter produces 2-stage trace for cached request", () => {
  const trace = RequestPipelineAdapter.fromRequestResult(makeRequestInput(true));
  assertEquals(trace.stages.length, 2);
  assertEquals(trace.stages[0].outputSummary, "HIT");
});

Deno.test("QueryExecutorAdapter produces N-stage trace matching plan steps", () => {
  const trace = QueryExecutorAdapter.fromExecutionResult({
    queryId: "q-1",
    steps: [
      { id: "s1", type: "NAVIGATE", dependencies: [], cacheable: false },
      { id: "s2", type: "DOM_QUERY", dependencies: ["s1"], cacheable: true },
      { id: "s3", type: "FILTER", dependencies: ["s2"], cacheable: false },
    ],
    stepResults: new Map([
      ["s1", { stepId: "s1", success: true, data: { url: "https://example.com" }, timing: { startTime: 0, endTime: 100, duration: 100 } }],
      ["s2", { stepId: "s2", success: true, data: [{ title: "A" }, { title: "B" }], timing: { startTime: 100, endTime: 150, duration: 50 } }],
      ["s3", { stepId: "s3", success: true, data: [{ title: "A" }], timing: { startTime: 150, endTime: 160, duration: 10 } }],
    ]),
    totalTime: 160,
    cacheHits: 0,
    cacheMisses: 3,
  });

  assertEquals(trace.stages.length, 3);
  assertEquals(trace.pipeline, "query");
  assertEquals(trace.edges.length, 2); // s1→s2, s2→s3
});

Deno.test("ProxyMiddlewareAdapter produces correct stage count", () => {
  const trace = ProxyMiddlewareAdapter.fromProxyRequest({
    method: "GET",
    url: "/api/users",
    clientIP: "10.0.0.1",
    routeId: "api-users",
    routePattern: "/api/users",
    routePriority: 10,
    requestMiddleware: [
      { name: "auth", result: { type: "continue" }, timing: 2 },
    ],
    upstream: { host: "api-1", port: 8080, statusCode: 200, statusText: "OK", headers: {}, bodySize: 512, timing: 50 },
    responseMiddleware: [],
    totalTime: 52,
  });

  // incoming + auth + route + upstream + final = 5
  assertEquals(trace.stages.length, 5);
  assertEquals(trace.pipeline, "proxy");
});

Deno.test("selectStage on trace returns correct stage data", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());
  const selected = trace.stages.find((s) => s.id === trace.stages[1].id);
  assertExists(selected);
  assertEquals(selected.stage, "HTML Parse");
  // outputData is the actual DOM tree
  assertExists(selected.outputData);
});

Deno.test("ProcessTraceModel.updateStage updates stage status for live tracing", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());
  const updated = ProcessTraceModel.updateStage(trace, trace.stages[0].id, {
    status: "error",
    error: new Error("Network timeout"),
  });
  const stage = updated.stages.find((s) => s.id === trace.stages[0].id)!;
  assertEquals(stage.status, "error");
  assertExists(stage.error);
  assertEquals(stage.error!.message, "Network timeout");
});

Deno.test("toSVG integration: trace graph produces valid SVG string", () => {
  const trace = RequestPipelineAdapter.fromRequestResult(makeRequestInput());
  const layout = hierarchical(trace.graph, { direction: "LR" });
  const svg = render(trace.graph, layout, { directed: true });
  assertEquals(svg.startsWith("<svg"), true);
  assertEquals(svg.includes("</svg>"), true);
});
