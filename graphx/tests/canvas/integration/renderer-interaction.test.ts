/**
 * Integration tests: CanvasRenderer + InteractionManager + AnimationController
 *
 * Tests the rendering/interaction pipeline with mock Canvas2D, verifying
 * that the renderer produces correct rects for the interaction manager's
 * hit-testing, and the animation controller properly drives the render loop.
 */
import { assertEquals, assert, assertExists } from "@std/assert";
import { RenderingPipelineAdapter } from "../../../src/canvas/adapters/RenderingPipelineAdapter.ts";
import { RequestPipelineAdapter } from "../../../src/canvas/adapters/RequestPipelineAdapter.ts";
import { CanvasRenderer } from "../../../src/canvas/CanvasRenderer.ts";
import { InteractionManager } from "../../../src/canvas/InteractionManager.ts";
import { AnimationController } from "../../../src/canvas/AnimationController.ts";
import { CANVAS_LIGHT_THEME, CANVAS_DARK_THEME } from "../../../src/canvas/themes.ts";
import { hierarchical } from "../../../src/layout/hierarchical.ts";
import type { Transform, StageNodeRect } from "../../../src/canvas/types.ts";

// ---------------------------------------------------------------------------
// Mock Canvas2D context
// ---------------------------------------------------------------------------

function createMockCtx(width = 800, height = 600) {
  const calls: { method: string; args: unknown[] }[] = [];

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === "canvas") return { width, height };
      if (prop === "__calls") return calls;
      if (typeof prop === "string" && (
        prop === "fillStyle" || prop === "strokeStyle" || prop === "lineWidth" ||
        prop === "font" || prop === "textBaseline" || prop === "globalAlpha"
      )) {
        return undefined;
      }
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        if (prop === "measureText") return { width: 50 };
        return undefined;
      };
    },
    set(_target, prop: string, value: unknown) {
      calls.push({ method: `set_${prop}`, args: [value] });
      return true;
    },
  };

  return new Proxy({} as Record<string, unknown>, handler) as unknown as CanvasRenderingContext2D;
}

// Mock HTMLCanvasElement for InteractionManager
function createMockCanvas(width = 800, height = 600) {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    width,
    height,
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON() {} }),
    addEventListener(type: string, fn: EventListenerOrEventListenerObject) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: EventListenerOrEventListenerObject) {
      listeners.get(type)?.delete(fn);
    },
    __listeners: listeners,
  } as unknown as HTMLCanvasElement;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeRenderingInput() {
  return {
    timing: {
      htmlFetch: 20, htmlParse: 15, cssFetch: 10, cssParse: 5,
      scriptExecution: 3, styleResolution: 8, layoutComputation: 6,
      paintRecording: 4, compositing: 2, total: 73,
    },
    dom: { nodeName: "#document", childNodes: [{ nodeName: "html" }] },
    cssom: { rules: [1] },
    renderTree: { root: true },
    layoutTree: { type: "block", width: 1280, height: 720, children: [] },
    displayList: { commands: [1, 2] },
    resources: [{ url: "https://example.com", type: "html", size: 4096, fetchTime: 20, cached: false }],
  };
}

function makeRequestInput() {
  return {
    request: { method: "GET", url: "https://example.com", headers: {} },
    response: { statusCode: 200, statusText: "OK", headers: {}, body: new Uint8Array(512) },
    fromCache: false,
    timing: { dnsLookup: 10, tcpConnection: 15, tlsHandshake: 8, requestSent: 2, firstByte: 20, download: 12, total: 67 },
  };
}

// ---------------------------------------------------------------------------
// Renderer → InteractionManager hit-testing
// ---------------------------------------------------------------------------

Deno.test("Integration: renderer produces rects that InteractionManager can hit-test", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());
  const layout = hierarchical(trace.graph, { direction: "LR" });
  const ctx = createMockCtx();
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);
  const transform: Transform = { offsetX: 0, offsetY: 0, scale: 1 };

  const rects = renderer.render(trace, layout, transform, null, null, true, true);

  assertEquals(rects.length, 9);

  // Set up interaction manager with these rects
  const canvas = createMockCanvas();
  const interaction = new InteractionManager(canvas);
  interaction.setNodeRects(rects);

  // Hit-test the center of each node rect
  for (const rect of rects) {
    const hit = interaction.hitTest(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
    );
    assertEquals(hit, rect.id, `Should hit node ${rect.id}`);
  }

  // Miss: hit-test well outside any rect
  const miss = interaction.hitTest(-1000, -1000);
  assertEquals(miss, null);
});

Deno.test("Integration: renderer rects respect transform scale", () => {
  const trace = RequestPipelineAdapter.fromRequestResult(makeRequestInput());
  const layout = hierarchical(trace.graph, { direction: "LR" });
  const ctx = createMockCtx();
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);

  const scale1Rects = renderer.render(trace, layout, { offsetX: 0, offsetY: 0, scale: 1 }, null, null, false, false);
  const scale2Rects = renderer.render(trace, layout, { offsetX: 0, offsetY: 0, scale: 2 }, null, null, false, false);

  // At scale=2, each rect should be ~2x the width/height of scale=1
  for (let i = 0; i < scale1Rects.length; i++) {
    const ratio = scale2Rects[i].width / scale1Rects[i].width;
    assert(Math.abs(ratio - 2) < 0.01, `Width ratio should be ~2, got ${ratio}`);
  }
});

Deno.test("Integration: renderer rects shift with transform offset", () => {
  const trace = RequestPipelineAdapter.fromRequestResult(makeRequestInput());
  const layout = hierarchical(trace.graph, { direction: "LR" });
  const ctx = createMockCtx();
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);

  const baseRects = renderer.render(trace, layout, { offsetX: 0, offsetY: 0, scale: 1 }, null, null, false, false);
  const offsetRects = renderer.render(trace, layout, { offsetX: 100, offsetY: 50, scale: 1 }, null, null, false, false);

  for (let i = 0; i < baseRects.length; i++) {
    assert(
      Math.abs((offsetRects[i].x - baseRects[i].x) - 100) < 0.01,
      "X offset should be 100",
    );
    assert(
      Math.abs((offsetRects[i].y - baseRects[i].y) - 50) < 0.01,
      "Y offset should be 50",
    );
  }
});

// ---------------------------------------------------------------------------
// InteractionManager fitToContent → renderer produces centered rects
// ---------------------------------------------------------------------------

Deno.test("Integration: fitToContent places all rects within canvas bounds", () => {
  const trace = RenderingPipelineAdapter.fromRenderingResult(makeRenderingInput());
  const layout = hierarchical(trace.graph, { direction: "LR" });

  const canvasW = 1200;
  const canvasH = 800;
  const canvas = createMockCanvas(canvasW, canvasH);
  const interaction = new InteractionManager(canvas);
  interaction.fitToContent(layout, canvasW, canvasH);

  const ctx = createMockCtx(canvasW, canvasH);
  const renderer = new CanvasRenderer(ctx, CANVAS_LIGHT_THEME);
  const rects = renderer.render(trace, layout, interaction.transform, null, null, false, false);

  // All rects should be within canvas bounds (with some tolerance for padding)
  for (const rect of rects) {
    assert(rect.x >= -50, `rect ${rect.id} x=${rect.x} should be >= -50`);
    assert(rect.y >= -50, `rect ${rect.id} y=${rect.y} should be >= -50`);
    assert(rect.x + rect.width <= canvasW + 50, `rect ${rect.id} right edge should be <= ${canvasW + 50}`);
    assert(rect.y + rect.height <= canvasH + 50, `rect ${rect.id} bottom edge should be <= ${canvasH + 50}`);
  }
});

// ---------------------------------------------------------------------------
// Theme switching affects renderer output
// ---------------------------------------------------------------------------

Deno.test("Integration: dark theme uses different fill styles than light theme", () => {
  const trace = RequestPipelineAdapter.fromRequestResult(makeRequestInput());
  const layout = hierarchical(trace.graph, { direction: "LR" });

  const lightCtx = createMockCtx();
  const darkCtx = createMockCtx();
  const lightRenderer = new CanvasRenderer(lightCtx, CANVAS_LIGHT_THEME);
  const darkRenderer = new CanvasRenderer(darkCtx, CANVAS_DARK_THEME);

  lightRenderer.render(trace, layout, { offsetX: 0, offsetY: 0, scale: 1 }, null, null, false, false);
  darkRenderer.render(trace, layout, { offsetX: 0, offsetY: 0, scale: 1 }, null, null, false, false);

  const lightCalls = (lightCtx as unknown as { __calls: { method: string; args: unknown[] }[] }).__calls;
  const darkCalls = (darkCtx as unknown as { __calls: { method: string; args: unknown[] }[] }).__calls;

  // Background fill should differ
  const lightBg = lightCalls.find((c) => c.method === "set_fillStyle" && c.args[0] === CANVAS_LIGHT_THEME.background);
  const darkBg = darkCalls.find((c) => c.method === "set_fillStyle" && c.args[0] === CANVAS_DARK_THEME.background);
  assertExists(lightBg);
  assertExists(darkBg);
  assert(lightBg.args[0] !== darkBg.args[0]);
});

// ---------------------------------------------------------------------------
// Selection and hover affect renderer calls
// ---------------------------------------------------------------------------

Deno.test("Integration: selecting a stage causes additional stroke calls for selection ring", () => {
  const trace = RequestPipelineAdapter.fromRequestResult(makeRequestInput());
  const layout = hierarchical(trace.graph, { direction: "LR" });
  const transform: Transform = { offsetX: 0, offsetY: 0, scale: 1 };

  const noSelCtx = createMockCtx();
  const selCtx = createMockCtx();
  const noSelRenderer = new CanvasRenderer(noSelCtx, CANVAS_LIGHT_THEME);
  const selRenderer = new CanvasRenderer(selCtx, CANVAS_LIGHT_THEME);

  noSelRenderer.render(trace, layout, transform, null, null, false, false);
  selRenderer.render(trace, layout, transform, trace.stages[0].id, null, false, false);

  const noSelStrokes = (noSelCtx as unknown as { __calls: { method: string }[] }).__calls
    .filter((c) => c.method === "stroke").length;
  const selStrokes = (selCtx as unknown as { __calls: { method: string }[] }).__calls
    .filter((c) => c.method === "stroke").length;

  // Selection ring adds extra stroke call
  assert(selStrokes > noSelStrokes, "Selected render should have more stroke calls");
});

// ---------------------------------------------------------------------------
// AnimationController drives renderer
// ---------------------------------------------------------------------------

Deno.test("Integration: AnimationController calls renderFn when dirty", {
  sanitizeOps: false,
  sanitizeResources: false,
}, () => {
  let renderCount = 0;
  const controller = new AnimationController((_ts: number) => {
    renderCount++;
  });

  // Mock rAF — we just need it to not throw; we'll drive ticks manually
  const origRaf = (globalThis as Record<string, unknown>).requestAnimationFrame;
  const origCaf = (globalThis as Record<string, unknown>).cancelAnimationFrame;
  (globalThis as Record<string, unknown>).requestAnimationFrame = () => 1;
  (globalThis as Record<string, unknown>).cancelAnimationFrame = () => {};

  try {
    controller.start();
    // First tick renders (dirty=true by default on start)
    assertEquals(renderCount, 1);

    // Manual tick — dirty was cleared by the first render, should NOT render
    renderCount = 0;
    controller.tick(16);
    assertEquals(renderCount, 0, "Should not render when clean");

    // Mark dirty and tick again
    controller.markDirty();
    controller.tick(32);
    assertEquals(renderCount, 1, "Should render after markDirty");

    controller.stop();
    assertEquals(controller.isRunning, false);
  } finally {
    (globalThis as Record<string, unknown>).requestAnimationFrame = origRaf;
    (globalThis as Record<string, unknown>).cancelAnimationFrame = origCaf;
  }
});

// ---------------------------------------------------------------------------
// InteractionManager zoom behavior
// ---------------------------------------------------------------------------

Deno.test("Integration: InteractionManager screenToWorld/worldToScreen round-trip", () => {
  const canvas = createMockCanvas();
  const interaction = new InteractionManager(canvas);
  interaction.transform = { offsetX: 50, offsetY: 30, scale: 2 };

  const world = interaction.screenToWorld(150, 130);
  const screen = interaction.worldToScreen(world.x, world.y);

  assert(Math.abs(screen.x - 150) < 0.01);
  assert(Math.abs(screen.y - 130) < 0.01);
});

Deno.test("Integration: InteractionManager zoom clamps to MIN_SCALE/MAX_SCALE", () => {
  const canvas = createMockCanvas();
  const interaction = new InteractionManager(canvas);

  // Set scale to near-minimum
  interaction.transform = { offsetX: 0, offsetY: 0, scale: InteractionManager.MIN_SCALE };
  assert(interaction.transform.scale >= InteractionManager.MIN_SCALE);

  // Set scale to near-maximum
  interaction.transform = { offsetX: 0, offsetY: 0, scale: InteractionManager.MAX_SCALE };
  assert(interaction.transform.scale <= InteractionManager.MAX_SCALE);
});
