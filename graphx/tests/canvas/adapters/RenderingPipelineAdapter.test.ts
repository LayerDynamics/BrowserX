import { assertEquals, assertExists } from "@std/assert";
import { RenderingPipelineAdapter } from "../../../src/canvas/adapters/RenderingPipelineAdapter.ts";

/** Build a minimal but realistic rendering trace input for tests */
function makeResult(overrides: Record<string, unknown> = {}) {
  const mockDom = {
    tagName: "html",
    childNodes: [
      {
        tagName: "head",
        childNodes: [{ tagName: "title", childNodes: [] }],
      },
      {
        tagName: "body",
        childNodes: [
          { tagName: "div", childNodes: [{ tagName: "p", childNodes: [] }] },
        ],
      },
    ],
  };

  const mockCssom = { rules: [{ selector: "body" }, { selector: "div" }, { selector: "p" }] };
  const mockRenderTree = { type: "render-tree", root: mockDom };
  const mockLayoutTree = { type: "layout-box", width: 800, height: 600 };
  const mockDisplayList = { type: "display-list", commands: ["fillRect", "drawText"] };
  const mockScriptExecutor = { executedScripts: 2 };

  return {
    timing: {
      htmlFetch: 120,
      htmlParse: 30,
      cssFetch: 50,
      cssParse: 15,
      scriptExecution: 40,
      styleResolution: 10,
      layoutComputation: 25,
      paintRecording: 18,
      compositing: 12,
      total: 320,
    },
    dom: mockDom,
    cssom: mockCssom,
    renderTree: mockRenderTree,
    layoutTree: mockLayoutTree,
    displayList: mockDisplayList,
    scriptExecutor: mockScriptExecutor,
    resources: [
      { url: "https://example.com/", type: "html", size: 8192, fetchTime: 120, cached: false },
      { url: "https://example.com/style.css", type: "css", size: 4096, fetchTime: 50, cached: true },
      {
        url: "https://example.com/theme.css",
        type: "css",
        size: 2048,
        fetchTime: 50,
        cached: false,
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test 1: Creates 9 stages from a full result
// ---------------------------------------------------------------------------
Deno.test("RenderingPipelineAdapter - creates 9 stages from full result", () => {
  const result = makeResult();
  const trace = RenderingPipelineAdapter.fromRenderingResult(result);

  assertEquals(trace.stages.length, 9);
  assertEquals(trace.pipeline, "rendering");
  const names = trace.stages.map((s) => s.stage);
  assertEquals(names, [
    "HTML Fetch",
    "HTML Parse",
    "CSS Fetch",
    "CSS Parse",
    "Script Execution",
    "Style Resolution",
    "Layout",
    "Paint",
    "Composite",
  ]);
});

// ---------------------------------------------------------------------------
// Test 2: Each stage timing derives from the RenderingTiming fields
// ---------------------------------------------------------------------------
Deno.test("RenderingPipelineAdapter - stage timings come from timing fields", () => {
  const result = makeResult();
  const trace = RenderingPipelineAdapter.fromRenderingResult(result);
  const t = result.timing;

  // HTML Fetch: starts at 0, duration = htmlFetch
  assertEquals(trace.stages[0].timing.startTime, 0);
  assertEquals(trace.stages[0].timing.duration, t.htmlFetch);

  // HTML Parse: starts at htmlFetch, duration = htmlParse
  assertEquals(trace.stages[1].timing.startTime, t.htmlFetch);
  assertEquals(trace.stages[1].timing.duration, t.htmlParse);

  // CSS Fetch: starts at htmlFetch + htmlParse
  assertEquals(trace.stages[2].timing.startTime, t.htmlFetch + t.htmlParse);
  assertEquals(trace.stages[2].timing.duration, t.cssFetch);

  // Layout: check startTime
  const layoutStart =
    t.htmlFetch +
    t.htmlParse +
    t.cssFetch +
    t.cssParse +
    t.scriptExecution +
    t.styleResolution;
  assertEquals(trace.stages[6].timing.startTime, layoutStart);
  assertEquals(trace.stages[6].timing.duration, t.layoutComputation);
});

// ---------------------------------------------------------------------------
// Test 3: HTML Parse outputData is the actual dom object
// ---------------------------------------------------------------------------
Deno.test("RenderingPipelineAdapter - HTML Parse outputData is the dom object", () => {
  const result = makeResult();
  const trace = RenderingPipelineAdapter.fromRenderingResult(result);

  const parseStage = trace.stages.find((s) => s.stage === "HTML Parse");
  assertExists(parseStage);
  assertEquals(parseStage.outputData, result.dom);
});

// ---------------------------------------------------------------------------
// Test 4: CSS Parse outputData is the actual cssom object
// ---------------------------------------------------------------------------
Deno.test("RenderingPipelineAdapter - CSS Parse outputData is the cssom object", () => {
  const result = makeResult();
  const trace = RenderingPipelineAdapter.fromRenderingResult(result);

  const parseStage = trace.stages.find((s) => s.stage === "CSS Parse");
  assertExists(parseStage);
  assertEquals(parseStage.outputData, result.cssom);
});

// ---------------------------------------------------------------------------
// Test 5: Layout outputData is the actual layoutTree
// ---------------------------------------------------------------------------
Deno.test("RenderingPipelineAdapter - Layout outputData is the layoutTree", () => {
  const result = makeResult();
  const trace = RenderingPipelineAdapter.fromRenderingResult(result);

  const layoutStage = trace.stages.find((s) => s.stage === "Layout");
  assertExists(layoutStage);
  assertEquals(layoutStage.outputData, result.layoutTree);
});

// ---------------------------------------------------------------------------
// Test 6: Paint outputData is the actual displayList
// ---------------------------------------------------------------------------
Deno.test("RenderingPipelineAdapter - Paint outputData is the displayList", () => {
  const result = makeResult();
  const trace = RenderingPipelineAdapter.fromRenderingResult(result);

  const paintStage = trace.stages.find((s) => s.stage === "Paint");
  assertExists(paintStage);
  assertEquals(paintStage.outputData, result.displayList);
});

// ---------------------------------------------------------------------------
// Test 7: Edges have correct data-flow labels (all 8 edges)
// ---------------------------------------------------------------------------
Deno.test("RenderingPipelineAdapter - edges have correct data-flow labels", () => {
  const result = makeResult();
  const trace = RenderingPipelineAdapter.fromRenderingResult(result);

  assertEquals(trace.edges.length, 8);
  const labels = trace.edges.map((e) => e.dataFlowLabel);
  assertEquals(labels, [
    "HTML bytes",
    "DOMNode tree",
    "CSS text",
    "CSSOM",
    "styled DOM",
    "RenderTree",
    "LayoutBox tree",
    "DisplayList",
  ]);
});

// ---------------------------------------------------------------------------
// Test 8: Script Execution stage shows disabled when scriptExecution is 0
// ---------------------------------------------------------------------------
Deno.test("RenderingPipelineAdapter - Script Execution shows disabled when scriptExecution is 0", () => {
  const result = makeResult();
  result.timing.scriptExecution = 0;
  const trace = RenderingPipelineAdapter.fromRenderingResult(result);

  const scriptStage = trace.stages.find((s) => s.stage === "Script Execution");
  assertExists(scriptStage);
  assertEquals(scriptStage.outputSummary, "disabled");
  assertEquals(scriptStage.metrics.disabled, true);
});

// ---------------------------------------------------------------------------
// Test 9: Metrics capture nodeCount for HTML Parse (with mock dom)
// ---------------------------------------------------------------------------
Deno.test("RenderingPipelineAdapter - HTML Parse metrics include nodeCount", () => {
  // Tree: html(1) → head(1) → title(1), body(1) → div(1) → p(1) = 6 nodes total
  const result = makeResult();
  const trace = RenderingPipelineAdapter.fromRenderingResult(result);

  const parseStage = trace.stages.find((s) => s.stage === "HTML Parse");
  assertExists(parseStage);
  // html + head + title + body + div + p = 6
  assertEquals(parseStage.metrics.nodeCount, 6);
});

// ---------------------------------------------------------------------------
// Test 10: Resource info attached to HTML Fetch stage
// ---------------------------------------------------------------------------
Deno.test("RenderingPipelineAdapter - HTML Fetch stage has resource info in metrics", () => {
  const result = makeResult();
  const trace = RenderingPipelineAdapter.fromRenderingResult(result);

  const fetchStage = trace.stages.find((s) => s.stage === "HTML Fetch");
  assertExists(fetchStage);

  // The HTML resource is the first resource of type "html"
  const htmlResource = result.resources.find((r) => r.type === "html")!;
  assertEquals(fetchStage.metrics.url, htmlResource.url);
  assertEquals(fetchStage.metrics.size, htmlResource.size);
  assertEquals(fetchStage.metrics.cached, htmlResource.cached);
  assertEquals(fetchStage.metrics.fetchTime, htmlResource.fetchTime);
  assertEquals(fetchStage.outputData, htmlResource);
});
