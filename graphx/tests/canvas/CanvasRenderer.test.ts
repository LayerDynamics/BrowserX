import { assertEquals, assert } from "@std/assert";
import { CanvasRenderer } from "../../src/canvas/CanvasRenderer.ts";
import { ProcessTraceModel } from "../../src/canvas/ProcessTraceModel.ts";
import { CANVAS_LIGHT_THEME } from "../../src/canvas/themes.ts";
import type { StageNode, StageEdge, CanvasTheme } from "../../src/canvas/types.ts";
import type { LayoutResult } from "../../src/layout/types.ts";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

interface MockCall {
  method: string;
  args: unknown[];
}

function createMockContext(): CanvasRenderingContext2D {
  const calls: MockCall[] = [];
  return new Proxy({} as CanvasRenderingContext2D, {
    get(_target, prop: string) {
      if (prop === "_calls") return calls;
      if (prop === "measureText") return (_text: string) => ({ width: 50 });
      if (prop === "canvas") return { width: 800, height: 600 };
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
      };
    },
    set(_target, prop: string, value: unknown) {
      calls.push({ method: `set:${prop}`, args: [value] });
      return true;
    },
  });
}

function getCalls(ctx: CanvasRenderingContext2D): MockCall[] {
  return (ctx as unknown as { _calls: MockCall[] })._calls;
}

// ---------------------------------------------------------------------------
// Fixture: 3-stage trace with 2 edges
// ---------------------------------------------------------------------------

function makeStage(
  id: string,
  name: string,
  duration: number,
  status: "completed" | "pending" | "running" | "error" = "completed",
): StageNode {
  return {
    id,
    stage: name,
    pipeline: "rendering",
    status,
    timing: { startTime: 0, endTime: duration, duration },
    inputSummary: `input for ${name}`,
    outputData: null,
    outputSummary: `output of ${name}`,
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

function makeFixture() {
  const stages: StageNode[] = [
    makeStage("s1", "DNS Resolution", 13),
    makeStage("s2", "TCP Connect", 5),
    makeStage("s3", "HTML Parse", 20, "completed"),
  ];
  const edges: StageEdge[] = [
    makeEdge("s1", "s2", "TCP socket"),
    makeEdge("s2", "s3", "HTML bytes"),
  ];
  const trace = ProcessTraceModel.fromStages("rendering", stages, edges);
  const layout: LayoutResult = {
    nodes: [
      { id: "s1", x: 0, y: 0 },
      { id: "s2", x: 220, y: 0 },
      { id: "s3", x: 440, y: 0 },
    ],
    width: 700,
    height: 200,
  };
  return { trace, layout, stages, edges };
}

const transform = { offsetX: 0, offsetY: 0, scale: 1 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("CanvasRenderer - render() returns StageNodeRect array with correct count", () => {
  const { trace, layout } = makeFixture();
  const ctx = createMockContext();
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);

  const rects = renderer.render(trace, layout, transform, null, null, false, false);

  assertEquals(rects.length, 3);
});

Deno.test("CanvasRenderer - StageNodeRect positions match layout positions", () => {
  const { trace, layout } = makeFixture();
  const ctx = createMockContext();
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);

  const rects = renderer.render(trace, layout, transform, null, null, false, false);

  // With identity transform (scale=1, offset=0,0), screen pos = world pos
  const s1Rect = rects.find((r) => r.id === "s1");
  const s2Rect = rects.find((r) => r.id === "s2");
  assert(s1Rect !== undefined, "s1 rect should exist");
  assert(s2Rect !== undefined, "s2 rect should exist");

  assertEquals(s1Rect!.x, 0);
  assertEquals(s1Rect!.y, 0);
  assertEquals(s1Rect!.width, CanvasRenderer.NODE_WIDTH);
  assertEquals(s1Rect!.height, CanvasRenderer.NODE_HEIGHT);

  assertEquals(s2Rect!.x, 220);
  assertEquals(s2Rect!.y, 0);
});

Deno.test("CanvasRenderer - status dot uses correct color for completed stage", () => {
  const { trace, layout } = makeFixture();
  const ctx = createMockContext();
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);

  renderer.render(trace, layout, transform, null, null, false, false);
  const calls = getCalls(ctx);

  // The status dot is drawn with fillStyle = statusColors.border for each stage.
  // For completed stages the border color from CANVAS_LIGHT_THEME is "#22c55e".
  const completedBorderColor = CANVAS_LIGHT_THEME.stage.completed.border;
  const fillStyleCalls = calls.filter(
    (c) => c.method === "set:fillStyle" && c.args[0] === completedBorderColor,
  );
  assert(fillStyleCalls.length > 0, `Expected fillStyle to be set to ${completedBorderColor} for status dots`);
});

Deno.test("CanvasRenderer - timing text includes duration with 'ms'", () => {
  const { trace, layout } = makeFixture();
  const ctx = createMockContext();
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);

  renderer.render(trace, layout, transform, null, null, true, false);
  const calls = getCalls(ctx);

  // fillText calls that contain "ms" from duration rendering
  const fillTextCalls = calls.filter((c) => c.method === "fillText");
  const msTexts = fillTextCalls.filter((c) => typeof c.args[0] === "string" && (c.args[0] as string).includes("ms"));
  assert(msTexts.length > 0, "Expected at least one fillText call containing 'ms' for timing");
  // Verify the specific durations appear: "13ms", "5ms", "20ms"
  const texts = fillTextCalls.map((c) => c.args[0] as string);
  assert(texts.some((t) => t.includes("13ms")), "Should render '13ms' for DNS Resolution stage");
});

Deno.test("CanvasRenderer - edges drawn between connected stages (lineTo calls)", () => {
  const { trace, layout } = makeFixture();
  const ctx = createMockContext();
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);

  renderer.render(trace, layout, transform, null, null, false, false);
  const calls = getCalls(ctx);

  // Each edge calls moveTo + lineTo to draw the connecting line
  const lineToCount = calls.filter((c) => c.method === "lineTo").length;
  // 2 edges → at least 2 lineTo calls for the lines (arrow triangles add more lineTo calls)
  assert(lineToCount >= 2, `Expected at least 2 lineTo calls for 2 edges, got ${lineToCount}`);
});

Deno.test("CanvasRenderer - selection ring drawn for selected node", () => {
  const { trace, layout } = makeFixture();
  const ctx = createMockContext();
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);

  renderer.render(trace, layout, transform, "s1", null, false, false);
  const calls = getCalls(ctx);

  // When selected, strokeStyle is set to selection.stroke before drawing the ring
  const selectionColor = CANVAS_LIGHT_THEME.selection.stroke;
  const selectionStrokeCalls = calls.filter(
    (c) => c.method === "set:strokeStyle" && c.args[0] === selectionColor,
  );
  assert(
    selectionStrokeCalls.length > 0,
    `Expected strokeStyle to be set to selection color ${selectionColor}`,
  );
});

Deno.test("CanvasRenderer - data flow labels drawn on edges when showDataFlow=true", () => {
  const { trace, layout } = makeFixture();
  const ctx = createMockContext();
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);

  renderer.render(trace, layout, transform, null, null, false, true);
  const calls = getCalls(ctx);

  const fillTextCalls = calls.filter((c) => c.method === "fillText");
  const texts = fillTextCalls.map((c) => c.args[0] as string);
  assert(texts.some((t) => t === "TCP socket"), "Should render 'TCP socket' data flow label");
  assert(texts.some((t) => t === "HTML bytes"), "Should render 'HTML bytes' data flow label");
});

Deno.test("CanvasRenderer - clear() fills background with theme background color", () => {
  const ctx = createMockContext();
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);

  renderer.clear();
  const calls = getCalls(ctx);

  // clear() sets fillStyle to theme.background then calls fillRect
  const bgColorSet = calls.find(
    (c) => c.method === "set:fillStyle" && c.args[0] === CANVAS_LIGHT_THEME.background,
  );
  assert(bgColorSet !== undefined, "Expected fillStyle to be set to theme background color");

  const fillRectCall = calls.find((c) => c.method === "fillRect");
  assert(fillRectCall !== undefined, "Expected fillRect to be called in clear()");
});

Deno.test("CanvasRenderer - setTheme updates theme used for rendering", () => {
  const { trace, layout } = makeFixture();
  const ctx = createMockContext();

  const customTheme: CanvasTheme = {
    ...CANVAS_LIGHT_THEME,
    background: "#112233",
  };

  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);
  renderer.setTheme(customTheme);
  renderer.clear();

  const calls = getCalls(ctx);
  const bgSet = calls.find(
    (c) => c.method === "set:fillStyle" && c.args[0] === "#112233",
  );
  assert(bgSet !== undefined, "After setTheme, clear() should use new background color");

  // Suppress unused variable warning — trace and layout are not used in this test but
  // are pulled from makeFixture() to keep the helper consistent with other tests.
  void trace;
  void layout;
});
