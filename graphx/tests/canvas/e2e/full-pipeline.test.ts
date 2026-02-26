/**
 * End-to-End tests: Full pipeline scenarios
 *
 * Simulates real-world usage patterns: creating traces from various pipeline
 * inputs, performing layout, rendering, selecting stages, inspecting data,
 * updating stages live, and exporting to SVG. Tests the complete user workflow
 * without requiring a browser DOM.
 */
import { assertEquals, assert, assertExists, assertStringIncludes } from "@std/assert";
import { RenderingPipelineAdapter } from "../../../src/canvas/adapters/RenderingPipelineAdapter.ts";
import { RequestPipelineAdapter } from "../../../src/canvas/adapters/RequestPipelineAdapter.ts";
import { QueryExecutorAdapter } from "../../../src/canvas/adapters/QueryExecutorAdapter.ts";
import { ProxyMiddlewareAdapter } from "../../../src/canvas/adapters/ProxyMiddlewareAdapter.ts";
import { ProcessTraceModel } from "../../../src/canvas/ProcessTraceModel.ts";
import { CanvasRenderer } from "../../../src/canvas/CanvasRenderer.ts";
import { InteractionManager } from "../../../src/canvas/InteractionManager.ts";
import { CANVAS_LIGHT_THEME, CANVAS_DARK_THEME, resolveTheme } from "../../../src/canvas/themes.ts";
import { hierarchical } from "../../../src/layout/hierarchical.ts";
import { render } from "../../../src/svg/SVGRenderer.ts";
import { topologicalSort } from "../../../src/algorithms/topological-sort.ts";
import type { ProcessTrace, StageNode } from "../../../src/canvas/types.ts";

// ---------------------------------------------------------------------------
// Mock Canvas infrastructure
// ---------------------------------------------------------------------------

function createMockCtx(width = 1200, height = 800) {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === "canvas") return { width, height };
      return (..._args: unknown[]) => {
        if (prop === "measureText") return { width: 40 };
        return undefined;
      };
    },
    set() { return true; },
  };
  return new Proxy({} as Record<string, unknown>, handler) as unknown as CanvasRenderingContext2D;
}

function createMockCanvas(width = 1200, height = 800) {
  return {
    width, height,
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON() {} }),
    addEventListener() {},
    removeEventListener() {},
  } as unknown as HTMLCanvasElement;
}

// ---------------------------------------------------------------------------
// E2E Scenario 1: Full Page Load Trace
// ---------------------------------------------------------------------------

Deno.test("E2E: full page load — create trace, layout, render, select each stage, export SVG", () => {
  // Step 1: Simulate a page load result
  const renderingResult = {
    timing: {
      htmlFetch: 35, htmlParse: 22, cssFetch: 18, cssParse: 8,
      scriptExecution: 15, styleResolution: 12, layoutComputation: 9,
      paintRecording: 6, compositing: 3, total: 128,
    },
    dom: {
      nodeName: "#document",
      childNodes: [{
        nodeName: "html",
        childNodes: [
          { nodeName: "head", childNodes: [
            { nodeName: "meta" },
            { nodeName: "title", childNodes: [{ nodeName: "#text", nodeValue: "My Page" }] },
            { nodeName: "link" },
          ]},
          { nodeName: "body", childNodes: [
            { nodeName: "header", childNodes: [{ nodeName: "nav" }] },
            { nodeName: "main", childNodes: [
              { nodeName: "h1" },
              { nodeName: "p" },
              { nodeName: "div", childNodes: [{ nodeName: "img" }, { nodeName: "span" }] },
            ]},
            { nodeName: "footer" },
          ]},
        ],
      }],
    },
    cssom: {
      rules: Array.from({ length: 87 }, (_, i) => ({
        selector: i < 5 ? "body" : `.cls-${i}`,
        properties: { color: "#333", margin: "0" },
      })),
    },
    renderTree: {
      root: true,
      tag: "html",
      children: [
        { tag: "body", children: [{ tag: "header" }, { tag: "main" }, { tag: "footer" }] },
      ],
    },
    layoutTree: {
      type: "block", width: 1920, height: 1080,
      children: [
        { type: "block", width: 1920, height: 60, children: [] },
        { type: "block", width: 1920, height: 960, children: [
          { type: "inline", width: 300, height: 40, children: [] },
        ]},
        { type: "block", width: 1920, height: 60, children: [] },
      ],
    },
    displayList: {
      commands: Array.from({ length: 234 }, (_, i) => ({ type: i % 3 === 0 ? "rect" : "text", id: i })),
    },
    resources: [
      { url: "https://example.com", type: "html", size: 12800, fetchTime: 35, cached: false },
      { url: "https://example.com/styles.css", type: "css", size: 6400, fetchTime: 15, cached: false },
      { url: "https://cdn.example.com/framework.css", type: "css", size: 24000, fetchTime: 18, cached: true },
      { url: "https://example.com/app.js", type: "script", size: 51200, fetchTime: 10, cached: false },
    ],
  };

  // Step 2: Create trace
  const trace = RenderingPipelineAdapter.fromRenderingResult(renderingResult);
  assertEquals(trace.stages.length, 9);
  assertEquals(trace.pipeline, "rendering");
  assertEquals(trace.edges.length, 8);

  // Step 3: Verify all stages have correct pipeline data
  const stageNames = trace.stages.map((s) => s.stage);
  assertEquals(stageNames, [
    "HTML Fetch", "HTML Parse", "CSS Fetch", "CSS Parse",
    "Script Execution", "Style Resolution", "Layout", "Paint", "Composite",
  ]);

  // Step 4: Verify timing adds up
  const totalStageTime = trace.stages.reduce((sum, s) => sum + s.timing.duration, 0);
  assertEquals(totalStageTime, 128);

  // Step 5: Layout
  const layout = hierarchical(trace.graph, { direction: "LR" });
  assertEquals(layout.nodes.length, 9);
  assert(layout.width > 0);
  assert(layout.height > 0);

  // Step 6: Render
  const ctx = createMockCtx();
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);
  const rects = renderer.render(
    trace, layout, { offsetX: 0, offsetY: 0, scale: 1 },
    null, null, true, true,
  );
  assertEquals(rects.length, 9);

  // Step 7: Select each stage and verify outputData
  const htmlParseStage = trace.stages.find((s) => s.stage === "HTML Parse")!;
  assertEquals((htmlParseStage.outputData as Record<string, unknown>)["nodeName"], "#document");

  const cssParseStage = trace.stages.find((s) => s.stage === "CSS Parse")!;
  const cssom = cssParseStage.outputData as Record<string, unknown>;
  assertEquals((cssom["rules"] as unknown[]).length, 87);

  const layoutStage = trace.stages.find((s) => s.stage === "Layout")!;
  const layoutData = layoutStage.outputData as Record<string, unknown>;
  assertEquals(layoutData["width"], 1920);
  assertEquals(layoutData["height"], 1080);

  const paintStage = trace.stages.find((s) => s.stage === "Paint")!;
  const displayList = paintStage.outputData as Record<string, unknown>;
  assertEquals((displayList["commands"] as unknown[]).length, 234);

  // Step 8: Export to SVG
  const svg = render(trace.graph, layout, { directed: true, showLabels: true });
  assert(svg.startsWith("<svg"));
  assertStringIncludes(svg, "</svg>");
  assertStringIncludes(svg, "HTML Parse");
  assertStringIncludes(svg, "Layout");
});

// ---------------------------------------------------------------------------
// E2E Scenario 2: API Request with Cache Miss → Retry with Cache Hit
// ---------------------------------------------------------------------------

Deno.test("E2E: API request — cache miss then cache hit produces different traces", () => {
  const baseInput = {
    request: {
      method: "GET",
      url: "https://api.example.com/v3/products?category=electronics",
      headers: {
        "accept": "application/json",
        "authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.token",
        "x-request-id": "req-001",
      },
    },
    timing: { dnsLookup: 8, tcpConnection: 20, tlsHandshake: 12, requestSent: 1, firstByte: 45, download: 15, total: 101 },
  };

  // First request: cache miss
  const miss = RequestPipelineAdapter.fromRequestResult({
    ...baseInput,
    response: {
      statusCode: 200,
      statusText: "OK",
      headers: {
        "content-type": "application/json",
        "cache-control": "max-age=300",
        "content-length": "8192",
        "x-cache": "MISS",
      },
      body: new Uint8Array(8192),
    },
    fromCache: false,
  });

  assertEquals(miss.stages.length, 6);
  assertEquals(miss.pipeline, "request");
  assertEquals(miss.stages[0].outputSummary, "MISS");

  // Verify Request Send stage has full request data
  const reqStage = miss.stages.find((s) => s.stage === "Request Send")!;
  const reqData = reqStage.outputData as Record<string, unknown>;
  assertEquals(reqData["method"], "GET");
  assertStringIncludes(reqData["url"] as string, "products");

  // Verify Response stage has full response data
  const resStage = miss.stages.find((s) => s.stage === "Response Receive")!;
  const resData = resStage.outputData as Record<string, unknown>;
  assertEquals(resData["statusCode"], 200);

  // Second request: cache hit
  const hit = RequestPipelineAdapter.fromRequestResult({
    ...baseInput,
    response: {
      statusCode: 200,
      statusText: "OK",
      headers: { "content-type": "application/json", "x-cache": "HIT" },
      body: new Uint8Array(8192),
    },
    fromCache: true,
    timing: { dnsLookup: 0, tcpConnection: 0, tlsHandshake: 0, requestSent: 0, firstByte: 1, download: 0, total: 1 },
  });

  assertEquals(hit.stages.length, 2);
  assertEquals(hit.stages[0].outputSummary, "HIT");

  // Layout both traces
  const missLayout = hierarchical(miss.graph, { direction: "LR" });
  const hitLayout = hierarchical(hit.graph, { direction: "LR" });

  // Cache hit trace should be much shorter spatially
  assert(missLayout.nodes.length > hitLayout.nodes.length);

  // Both produce valid SVG
  const missSvg = render(miss.graph, missLayout, { directed: true });
  const hitSvg = render(hit.graph, hitLayout, { directed: true });
  assert(missSvg.startsWith("<svg"));
  assert(hitSvg.startsWith("<svg"));
});

// ---------------------------------------------------------------------------
// E2E Scenario 3: Multi-Step Query Execution with Error
// ---------------------------------------------------------------------------

Deno.test("E2E: query execution — 5 steps with error at step 3", () => {
  const input = {
    queryId: "q-e2e-error",
    steps: [
      { id: "nav", type: "NAVIGATE", dependencies: [], cacheable: false },
      { id: "query", type: "DOM_QUERY", dependencies: ["nav"], cacheable: true },
      { id: "filter", type: "FILTER", dependencies: ["query"], cacheable: false },
      { id: "sort", type: "SORT", dependencies: ["filter"], cacheable: false },
      { id: "format", type: "SELECT", dependencies: ["sort"], cacheable: false },
    ],
    stepResults: new Map([
      ["nav", { stepId: "nav", success: true, data: { url: "https://shop.example.com/products" }, timing: { startTime: 0, endTime: 120, duration: 120 } }],
      ["query", { stepId: "query", success: true, data: Array.from({ length: 50 }, (_, i) => ({ name: `Product ${i}`, price: 10 + i })), timing: { startTime: 120, endTime: 200, duration: 80 } }],
      ["filter", { stepId: "filter", success: false, error: new Error("Selector '.product-card' not found on page"), timing: { startTime: 200, endTime: 210, duration: 10 } }],
      ["sort", { stepId: "sort", success: false, error: new Error("Upstream dependency failed"), timing: { startTime: 210, endTime: 210, duration: 0 } }],
      ["format", { stepId: "format", success: false, error: new Error("Upstream dependency failed"), timing: { startTime: 210, endTime: 210, duration: 0 } }],
    ]),
    totalTime: 210,
    cacheHits: 0,
    cacheMisses: 5,
  };

  const trace = QueryExecutorAdapter.fromExecutionResult(input);

  // 5 stages
  assertEquals(trace.stages.length, 5);
  assertEquals(trace.pipeline, "query");

  // Check statuses
  assertEquals(trace.stages[0].status, "completed"); // nav
  assertEquals(trace.stages[1].status, "completed"); // query
  assertEquals(trace.stages[2].status, "error");     // filter
  assertEquals(trace.stages[3].status, "error");     // sort
  assertEquals(trace.stages[4].status, "error");     // format

  // Error stages have Error objects
  assertExists(trace.stages[2].error);
  assertStringIncludes(trace.stages[2].error!.message, "not found");

  // Query stage has the actual extracted data
  const queryStage = trace.stages[1];
  const data = queryStage.outputData as unknown[];
  assertEquals(data.length, 50);
  assertEquals((data[0] as Record<string, unknown>)["name"], "Product 0");

  // Navigate stage has URL
  assertStringIncludes(trace.stages[0].outputSummary, "shop.example.com");

  // Graph is still valid and acyclic
  const topo = topologicalSort(trace.graph);
  assertEquals(topo.hasCycle, false);
  assertEquals(topo.order.length, 5);

  // Layout and SVG still work
  const layout = hierarchical(trace.graph, { direction: "LR" });
  const svg = render(trace.graph, layout, { directed: true, showLabels: true });
  assertStringIncludes(svg, "FILTER(filter)");
});

// ---------------------------------------------------------------------------
// E2E Scenario 4: Proxy Middleware Chain with Short-Circuit
// ---------------------------------------------------------------------------

Deno.test("E2E: proxy middleware — auth rejects request, short-circuits", () => {
  const trace = ProxyMiddlewareAdapter.fromProxyRequest({
    method: "DELETE",
    url: "https://api.internal.com/admin/users/42",
    clientIP: "10.0.0.50",
    routeId: "admin-delete",
    routePattern: "/admin/users/:id",
    routePriority: 1,
    requestMiddleware: [
      { name: "rate-limiter", result: { type: "continue" }, timing: 1 },
      { name: "auth", result: { type: "respond", statusCode: 403 }, timing: 3 },
    ],
    upstream: { host: "admin-svc", port: 9090, statusCode: 200, statusText: "OK", headers: {}, bodySize: 0, timing: 0 },
    responseMiddleware: [],
    totalTime: 4,
  });

  // Short-circuit: incoming + rate-limiter + auth + short-circuit = 4
  assertEquals(trace.stages.length, 4);
  assertEquals(trace.metadata["shortCircuited"], true);

  // Last stage is short-circuit response
  const lastStage = trace.stages[trace.stages.length - 1];
  assertEquals(lastStage.stage, "Short-Circuit Response");

  // Auth middleware shows respond: 403
  const authStage = trace.stages.find((s) => s.stage === "Middleware: auth")!;
  assertEquals(authStage.outputSummary, "respond: 403");

  // Layout
  const layout = hierarchical(trace.graph, { direction: "LR" });
  assertEquals(layout.nodes.length, 4);
});

Deno.test("E2E: proxy middleware — full chain with response compression", () => {
  const trace = ProxyMiddlewareAdapter.fromProxyRequest({
    method: "GET",
    url: "https://cdn.example.com/assets/bundle.js",
    clientIP: "203.0.113.42",
    routeId: "cdn-assets",
    routePattern: "/assets/*",
    routePriority: 100,
    requestMiddleware: [
      { name: "cors", result: { type: "continue" }, timing: 1 },
      { name: "auth", result: { type: "continue" }, timing: 2 },
      { name: "rate-limit", result: { type: "continue" }, timing: 1 },
    ],
    upstream: { host: "origin-1", port: 443, statusCode: 200, statusText: "OK", headers: { "content-type": "application/javascript" }, bodySize: 256000, timing: 80 },
    responseMiddleware: [
      { name: "compress", timing: 5, outputSummary: "gzip, 250KB → 68KB" },
      { name: "cache-tag", timing: 1, outputSummary: "Cache-Control: public, max-age=31536000" },
    ],
    totalTime: 90,
  });

  // incoming + 3 req mw + route + upstream + 2 res mw + final = 9
  assertEquals(trace.stages.length, 9);
  assertEquals(trace.metadata["shortCircuited"], false);

  // Verify upstream data
  const upstream = trace.stages.find((s) => s.stage.startsWith("Upstream:"))!;
  const upData = upstream.outputData as Record<string, unknown>;
  assertEquals(upData["statusCode"], 200);
  assertEquals(upData["bodySize"], 256000);

  // Compress middleware shows summary
  const compress = trace.stages.find((s) => s.stage === "Middleware: compress")!;
  assertEquals(compress.outputSummary, "gzip, 250KB → 68KB");

  // Full trace SVG
  const layout = hierarchical(trace.graph, { direction: "LR" });
  const svg = render(trace.graph, layout, { directed: true, showLabels: true });
  assertStringIncludes(svg, "Incoming Request");
  assertStringIncludes(svg, "Final Response");
});

// ---------------------------------------------------------------------------
// E2E Scenario 5: Live Tracing Simulation
// ---------------------------------------------------------------------------

Deno.test("E2E: live tracing — stages transition pending → running → completed one by one", () => {
  // Start with a rendering trace where all stages are initially pending
  const input = {
    timing: {
      htmlFetch: 0, htmlParse: 0, cssFetch: 0, cssParse: 0,
      scriptExecution: 0, styleResolution: 0, layoutComputation: 0,
      paintRecording: 0, compositing: 0, total: 0,
    },
    dom: { nodeName: "#document" },
    cssom: { rules: [] },
    renderTree: null,
    layoutTree: { type: "block", width: 0, height: 0, children: [] },
    displayList: { commands: [] },
    resources: [],
  };

  let trace = RenderingPipelineAdapter.fromRenderingResult(input);

  // Override all stages to pending
  for (const stage of trace.stages) {
    trace = ProcessTraceModel.updateStage(trace, stage.id, { status: "pending" });
  }

  // Verify all pending
  for (const stage of trace.stages) {
    assertEquals(stage.status, "pending");
  }
  assertEquals(trace.endTime, undefined);

  // Simulate stages completing one by one with actual timing
  const durations = [35, 22, 18, 8, 15, 12, 9, 6, 3];
  let clock = 0;

  for (let i = 0; i < trace.stages.length; i++) {
    const stageId = trace.stages[i].id;

    // Mark running
    trace = ProcessTraceModel.updateStage(trace, stageId, { status: "running" });
    assertEquals(trace.stages[i].status, "running");
    assertEquals(trace.endTime, undefined);

    // Mark completed with timing
    clock += durations[i];
    trace = ProcessTraceModel.updateStage(trace, stageId, {
      status: "completed",
      timing: { startTime: clock - durations[i], endTime: clock, duration: durations[i] },
    });
    assertEquals(trace.stages[i].status, "completed");
    assertEquals(trace.stages[i].timing.duration, durations[i]);
  }

  // All completed → endTime should be set
  assertExists(trace.endTime);
  assertEquals(ProcessTraceModel.totalDuration(trace), durations.reduce((a, b) => a + b, 0));
});

// ---------------------------------------------------------------------------
// E2E Scenario 6: Theme Resolution and Switching
// ---------------------------------------------------------------------------

Deno.test("E2E: theme resolution — string, object, and default", () => {
  const light = resolveTheme("light");
  const dark = resolveTheme("dark");
  const custom = resolveTheme(CANVAS_DARK_THEME);

  assertEquals(light, CANVAS_LIGHT_THEME);
  assertEquals(dark, CANVAS_DARK_THEME);
  assertEquals(custom, CANVAS_DARK_THEME);

  // All have required properties
  for (const theme of [light, dark, custom]) {
    assertExists(theme.background);
    assertExists(theme.stage.pending);
    assertExists(theme.stage.running);
    assertExists(theme.stage.completed);
    assertExists(theme.stage.error);
    assertExists(theme.edge.stroke);
    assertExists(theme.label.font);
    assertExists(theme.panel.background);
  }
});

// ---------------------------------------------------------------------------
// E2E Scenario 7: Query with Record-based stepResults (not Map)
// ---------------------------------------------------------------------------

Deno.test("E2E: query adapter accepts Record<string, StepResult> (not just Map)", () => {
  const trace = QueryExecutorAdapter.fromExecutionResult({
    queryId: "q-record",
    steps: [
      { id: "s1", type: "NAVIGATE", dependencies: [], cacheable: false },
      { id: "s2", type: "DOM_QUERY", dependencies: ["s1"], cacheable: true },
    ],
    stepResults: {
      s1: { stepId: "s1", success: true, data: { url: "https://example.com" }, timing: { startTime: 0, endTime: 100, duration: 100 } },
      s2: { stepId: "s2", success: true, data: [1, 2, 3], timing: { startTime: 100, endTime: 150, duration: 50 }, cacheHit: true },
    },
    totalTime: 150,
    cacheHits: 1,
    cacheMisses: 1,
  });

  assertEquals(trace.stages.length, 2);
  assertEquals(trace.stages[0].status, "completed");
  assertEquals(trace.stages[1].status, "completed");
  assertEquals(trace.stages[1].metrics["cacheHit"], true);
});

// ---------------------------------------------------------------------------
// E2E Scenario 8: Rendering + Request traces on same graph infrastructure
// ---------------------------------------------------------------------------

Deno.test("E2E: multiple trace types use same GraphX infrastructure correctly", () => {
  const renderTrace = RenderingPipelineAdapter.fromRenderingResult({
    timing: { htmlFetch: 10, htmlParse: 5, cssFetch: 3, cssParse: 2, scriptExecution: 1, styleResolution: 2, layoutComputation: 3, paintRecording: 1, compositing: 1, total: 28 },
    dom: { nodeName: "#document" }, cssom: { rules: [] }, renderTree: null,
    layoutTree: { type: "block", width: 800, height: 600, children: [] },
    displayList: { commands: [] }, resources: [],
  });

  const requestTrace = RequestPipelineAdapter.fromRequestResult({
    request: { method: "GET", url: "https://example.com", headers: {} },
    response: { statusCode: 200, statusText: "OK", headers: {}, body: new Uint8Array(100) },
    fromCache: false,
    timing: { dnsLookup: 5, tcpConnection: 10, tlsHandshake: 5, requestSent: 1, firstByte: 15, download: 5, total: 41 },
  });

  // Both produce valid graphs that can be laid out independently
  const renderLayout = hierarchical(renderTrace.graph, { direction: "LR" });
  const requestLayout = hierarchical(requestTrace.graph, { direction: "LR" });

  assertEquals(renderLayout.nodes.length, 9);
  assertEquals(requestLayout.nodes.length, 6);

  // Both can render to same canvas with different transforms
  const ctx = createMockCtx();
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);

  const renderRects = renderer.render(renderTrace, renderLayout, { offsetX: 0, offsetY: 0, scale: 0.8 }, null, null, true, true);
  const requestRects = renderer.render(requestTrace, requestLayout, { offsetX: 0, offsetY: 400, scale: 1 }, null, null, true, true);

  assertEquals(renderRects.length, 9);
  assertEquals(requestRects.length, 6);

  // Both export to SVG independently
  const renderSvg = render(renderTrace.graph, renderLayout, { directed: true });
  const requestSvg = render(requestTrace.graph, requestLayout, { directed: true });
  assert(renderSvg.startsWith("<svg"));
  assert(requestSvg.startsWith("<svg"));
});

// ---------------------------------------------------------------------------
// E2E Scenario 9: Large query trace (20 steps)
// ---------------------------------------------------------------------------

Deno.test("E2E: large query trace with 20 steps handles correctly", () => {
  const steps = Array.from({ length: 20 }, (_, i) => ({
    id: `step-${i}`,
    type: i === 0 ? "NAVIGATE" : i % 4 === 0 ? "CLICK" : i % 3 === 0 ? "FILTER" : "DOM_QUERY",
    dependencies: i > 0 ? [`step-${i - 1}`] : [],
    cacheable: i > 1,
  }));

  const stepResults = new Map(
    steps.map((step, i) => [
      step.id,
      {
        stepId: step.id,
        success: true,
        data: step.type === "NAVIGATE"
          ? { url: "https://example.com" }
          : Array.from({ length: 100 - i * 3 }, (_, j) => ({ val: j })),
        timing: { startTime: i * 50, endTime: i * 50 + 40, duration: 40 },
      },
    ]),
  );

  const trace = QueryExecutorAdapter.fromExecutionResult({
    queryId: "q-large",
    steps,
    stepResults,
    totalTime: 1000,
    cacheHits: 5,
    cacheMisses: 15,
  });

  assertEquals(trace.stages.length, 20);
  assertEquals(trace.edges.length, 19); // linear chain

  // Graph valid
  const topo = topologicalSort(trace.graph);
  assertEquals(topo.hasCycle, false);
  assertEquals(topo.order.length, 20);

  // Layout and render
  const layout = hierarchical(trace.graph, { direction: "LR" });
  assertEquals(layout.nodes.length, 20);

  const ctx = createMockCtx(2400, 600);
  const renderer = new CanvasRenderer(ctx, CANVAS_DARK_THEME);
  const rects = renderer.render(trace, layout, { offsetX: 0, offsetY: 0, scale: 0.5 }, null, null, true, true);
  assertEquals(rects.length, 20);

  // SVG export
  const svg = render(trace.graph, layout, { directed: true });
  assert(svg.length > 1000); // should be a substantial SVG
});

// ---------------------------------------------------------------------------
// E2E Scenario 10: Proxy with error middleware
// ---------------------------------------------------------------------------

Deno.test("E2E: proxy middleware error produces error stage", () => {
  const trace = ProxyMiddlewareAdapter.fromProxyRequest({
    method: "POST",
    url: "https://api.example.com/webhook",
    clientIP: "172.16.0.1",
    routeId: "webhook",
    routePattern: "/webhook",
    routePriority: 50,
    requestMiddleware: [
      { name: "validate-signature", result: { type: "error", message: "Invalid HMAC signature" }, timing: 5 },
    ],
    upstream: { host: "webhook-svc", port: 3000, statusCode: 200, statusText: "OK", headers: {}, bodySize: 0, timing: 0 },
    responseMiddleware: [],
    totalTime: 5,
  });

  // incoming + validate-signature (error) + short-circuit = 3
  assertEquals(trace.stages.length, 3);

  const errorStage = trace.stages.find((s) => s.stage === "Middleware: validate-signature")!;
  assertEquals(errorStage.status, "error");
  assertExists(errorStage.error);
  assertStringIncludes(errorStage.error!.message, "HMAC");
});

// ---------------------------------------------------------------------------
// E2E Scenario 11: Interaction — select, inspect data, clear selection
// ---------------------------------------------------------------------------

Deno.test("E2E: select stage → get outputData → clear selection workflow", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult({
    timing: { htmlFetch: 10, htmlParse: 5, cssFetch: 3, cssParse: 2, scriptExecution: 1, styleResolution: 2, layoutComputation: 3, paintRecording: 1, compositing: 1, total: 28 },
    dom: { nodeName: "#document", childNodes: [{ nodeName: "html", childNodes: [{ nodeName: "body" }] }] },
    cssom: { rules: [{ selector: "body", properties: { margin: "0" } }] },
    renderTree: { root: true },
    layoutTree: { type: "block", width: 800, height: 600, children: [] },
    displayList: { commands: [1, 2, 3] },
    resources: [{ url: "https://example.com", type: "html", size: 1024, fetchTime: 10, cached: false }],
  });

  const layout = hierarchical(trace.graph, { direction: "LR" });
  const ctx = createMockCtx();
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);
  const canvas = createMockCanvas();
  const interaction = new InteractionManager(canvas);

  // Render and get rects
  const rects = renderer.render(trace, layout, { offsetX: 0, offsetY: 0, scale: 1 }, null, null, false, false);
  interaction.setNodeRects(rects);

  // Select the "HTML Parse" node by hitting its center
  const htmlParseRect = rects.find((r) => r.id === trace.stages[1].id)!;
  const hitId = interaction.hitTest(
    htmlParseRect.x + htmlParseRect.width / 2,
    htmlParseRect.y + htmlParseRect.height / 2,
  );
  assertEquals(hitId, trace.stages[1].id);

  // Get the stage data for the selected node
  const selectedStage = trace.stages.find((s) => s.id === hitId)!;
  assertEquals(selectedStage.stage, "HTML Parse");
  assertExists(selectedStage.outputData);
  assertEquals((selectedStage.outputData as Record<string, unknown>)["nodeName"], "#document");

  // Clear selection (miss)
  const missId = interaction.hitTest(-100, -100);
  assertEquals(missId, null);
});

// ---------------------------------------------------------------------------
// E2E Scenario 12: ProcessTraceModel.stagesInOrder for diamond dependency
// ---------------------------------------------------------------------------

Deno.test("E2E: stagesInOrder handles diamond dependency graph", () => {
  const trace = QueryExecutorAdapter.fromExecutionResult({
    queryId: "q-diamond-e2e",
    steps: [
      { id: "root", type: "NAVIGATE", dependencies: [], cacheable: false },
      { id: "left", type: "DOM_QUERY", dependencies: ["root"], cacheable: true },
      { id: "right", type: "DOM_QUERY", dependencies: ["root"], cacheable: true },
      { id: "merge", type: "FILTER", dependencies: ["left", "right"], cacheable: false },
      { id: "output", type: "SORT", dependencies: ["merge"], cacheable: false },
    ],
    stepResults: new Map([
      ["root", { stepId: "root", success: true, data: { url: "https://x.com" }, timing: { startTime: 0, endTime: 50, duration: 50 } }],
      ["left", { stepId: "left", success: true, data: [1, 2], timing: { startTime: 50, endTime: 100, duration: 50 } }],
      ["right", { stepId: "right", success: true, data: [3, 4], timing: { startTime: 50, endTime: 110, duration: 60 } }],
      ["merge", { stepId: "merge", success: true, data: [1, 2, 3, 4], timing: { startTime: 110, endTime: 130, duration: 20 } }],
      ["output", { stepId: "output", success: true, data: [1, 2, 3, 4], timing: { startTime: 130, endTime: 140, duration: 10 } }],
    ]),
    totalTime: 140,
    cacheHits: 0,
    cacheMisses: 5,
  });

  const ordered = ProcessTraceModel.stagesInOrder(trace);
  assertEquals(ordered.length, 5);

  // root must be first
  assertEquals(ordered[0].id, "root");
  // output must be last
  assertEquals(ordered[4].id, "output");
  // merge must come after both left and right
  const mergeIdx = ordered.findIndex((s) => s.id === "merge");
  const leftIdx = ordered.findIndex((s) => s.id === "left");
  const rightIdx = ordered.findIndex((s) => s.id === "right");
  assert(mergeIdx > leftIdx);
  assert(mergeIdx > rightIdx);
});
