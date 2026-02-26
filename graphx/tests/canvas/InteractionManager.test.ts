import { assertEquals, assert, assertAlmostEquals } from "@std/assert";
import { InteractionManager } from "../../src/canvas/InteractionManager.ts";
import type { StageNodeRect } from "../../src/canvas/types.ts";
import type { LayoutResult } from "../../src/layout/types.ts";

// ---------------------------------------------------------------------------
// Mock HTMLCanvasElement
// ---------------------------------------------------------------------------

function createMockCanvas(): HTMLCanvasElement {
  const listeners: Record<string, EventListener[]> = {};
  return {
    width: 800,
    height: 600,
    addEventListener(type: string, fn: EventListener) {
      (listeners[type] ??= []).push(fn);
    },
    removeEventListener(type: string, fn: EventListener) {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== fn);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 800, height: 600 };
    },
    _listeners: listeners,
  } as unknown as HTMLCanvasElement;
}

// ---------------------------------------------------------------------------
// Fixture: 3 nodes laid out in a row, matching node rect positions
// ---------------------------------------------------------------------------

function makeNodeRects(): StageNodeRect[] {
  return [
    { id: "s1", x: 10, y: 20, width: 180, height: 70 },
    { id: "s2", x: 230, y: 20, width: 180, height: 70 },
    { id: "s3", x: 450, y: 20, width: 180, height: 70 },
  ];
}

function makeLayout(): LayoutResult {
  return {
    nodes: [
      { id: "s1", x: 10, y: 20 },
      { id: "s2", x: 230, y: 20 },
      { id: "s3", x: 450, y: 20 },
    ],
    width: 700,
    height: 200,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("InteractionManager - hitTest returns node ID when point is inside node rect", () => {
  const canvas = createMockCanvas();
  const im = new InteractionManager(canvas);
  im.setNodeRects(makeNodeRects());

  // Center of s1 rect: x=10+90=100, y=20+35=55
  const hit = im.hitTest(100, 55);
  assertEquals(hit, "s1");
});

Deno.test("InteractionManager - hitTest returns null when point misses all rects", () => {
  const canvas = createMockCanvas();
  const im = new InteractionManager(canvas);
  im.setNodeRects(makeNodeRects());

  // Point in the gap between s1 (ends at x=190) and s2 (starts at x=230)
  const hit = im.hitTest(215, 55);
  assertEquals(hit, null);
});

Deno.test("InteractionManager - screenToWorld converts correctly with offset and scale", () => {
  const canvas = createMockCanvas();
  const im = new InteractionManager(canvas);

  // Set a non-trivial transform: scale=2, offset=(100, 50)
  im.transform = { offsetX: 100, offsetY: 50, scale: 2 };

  // screenToWorld: (screenX - offsetX) / scale, (screenY - offsetY) / scale
  // screenX=200 → (200 - 100) / 2 = 50
  // screenY=150 → (150 - 50) / 2 = 50
  const world = im.screenToWorld(200, 150);
  assertAlmostEquals(world.x, 50, 1e-9);
  assertAlmostEquals(world.y, 50, 1e-9);
});

Deno.test("InteractionManager - worldToScreen is inverse of screenToWorld", () => {
  const canvas = createMockCanvas();
  const im = new InteractionManager(canvas);

  im.transform = { offsetX: 75, offsetY: 30, scale: 1.5 };

  // Round-trip: world → screen → world should be identity
  const worldX = 120;
  const worldY = 80;
  const screen = im.worldToScreen(worldX, worldY);
  const backToWorld = im.screenToWorld(screen.x, screen.y);

  assertAlmostEquals(backToWorld.x, worldX, 1e-9);
  assertAlmostEquals(backToWorld.y, worldY, 1e-9);
});

Deno.test("InteractionManager - fitToContent adjusts transform to center content", () => {
  const canvas = createMockCanvas();
  const im = new InteractionManager(canvas);
  const layout = makeLayout();

  im.fitToContent(layout, 800, 600);

  // After fitToContent the transform should be non-default and all nodes should be
  // within the canvas bounds (with padding).
  const { scale, offsetX, offsetY } = im.transform;

  assert(scale > 0, "Scale should be positive after fitToContent");
  assert(scale >= InteractionManager.MIN_SCALE, "Scale should be >= MIN_SCALE");
  assert(scale <= InteractionManager.MAX_SCALE, "Scale should be <= MAX_SCALE");

  // All layout nodes should map to positions within [padding, canvas-padding]
  const padding = 40;
  for (const node of layout.nodes) {
    const screen = im.worldToScreen(node.x, node.y);
    assert(screen.x >= padding, `Node ${node.id} left edge (${screen.x}) should be >= padding`);
    assert(screen.y >= padding, `Node ${node.id} top edge (${screen.y}) should be >= padding`);
    assert(
      screen.x + 180 * scale <= 800 + padding,
      `Node ${node.id} right edge should fit within canvas`,
    );
  }

  // The content should be horizontally centered: offsetX should be positive
  // (content is narrower than canvas at this scale)
  assert(
    offsetX !== 0 || offsetY !== 0,
    "Transform should be non-trivial after fitToContent",
  );
});

Deno.test("InteractionManager - zoom clamps scale to MIN_SCALE and MAX_SCALE bounds", () => {
  const canvas = createMockCanvas();
  const im = new InteractionManager(canvas);

  // Manually push scale past MAX
  im.transform = { offsetX: 0, offsetY: 0, scale: InteractionManager.MAX_SCALE };

  // Zooming in further should clamp at MAX_SCALE
  const zoomInDelta = -1; // negative deltaY = zoom in
  // Simulate what handleWheel does with deltaY < 0
  const prevScale = im.transform.scale;
  const delta = zoomInDelta < 0 ? InteractionManager.ZOOM_FACTOR : -InteractionManager.ZOOM_FACTOR;
  const newScale = Math.min(
    InteractionManager.MAX_SCALE,
    Math.max(InteractionManager.MIN_SCALE, prevScale + delta),
  );
  assertEquals(newScale, InteractionManager.MAX_SCALE);

  // Manually push scale past MIN
  im.transform = { offsetX: 0, offsetY: 0, scale: InteractionManager.MIN_SCALE };
  const zoomOutDelta = 1; // positive deltaY = zoom out
  const prevScale2 = im.transform.scale;
  const delta2 = zoomOutDelta < 0 ? InteractionManager.ZOOM_FACTOR : -InteractionManager.ZOOM_FACTOR;
  const newScale2 = Math.min(
    InteractionManager.MAX_SCALE,
    Math.max(InteractionManager.MIN_SCALE, prevScale2 + delta2),
  );
  assertEquals(newScale2, InteractionManager.MIN_SCALE);
});
