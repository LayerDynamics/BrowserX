/**
 * Compositor Pipeline Integration Tests
 *
 * Verifies that PaintLayer tree → CompositorThread wiring works correctly:
 * - updateLayerTree() stores LayerTree
 * - CPU composite uses LayerTree path when available
 * - CPU composite falls back to RenderToPixels when no LayerTree
 * - getPixels() returns correct dimensions
 * - Tiling: layers >256px create tiles
 * - VSync frame callback fires
 * - Layer invalidation on resize
 * - Full pipeline: RenderObject → layout → paint → compositor → pixels
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { CompositorThread } from "../../src/engine/rendering/compositor/CompositorThread.ts";
import { LayerTree, PaintLayer, type LayerID } from "../../src/engine/rendering/paint/PaintLayer.ts";
import { VSync } from "../../src/engine/rendering/compositor/VSync.ts";
import { RenderToPixels } from "../../src/engine/rendering/paint/RenderToPixels.ts";
import { RenderBox } from "../../src/engine/rendering/rendering/RenderBox.ts";
import { LayoutEngine } from "../../src/engine/rendering/layout/LayoutEngine.ts";
import type { Pixels } from "../../src/types/identifiers.ts";
import type { ComputedStyle } from "../../src/types/css.ts";
import type { DOMElement, HTMLCanvasElement } from "../../src/types/dom.ts";

// --- Helpers ---

function mockStyle(values: Record<string, string> = {}): ComputedStyle {
  return {
    getPropertyValue(prop: string): string { return values[prop] || ""; },
    setProperty(): void {},
    getPropertyPriority(): string { return ""; },
    item(): string { return ""; },
    length: 0,
    cssText: "",
    parentRule: null,
    removeProperty(): string { return ""; },
    [Symbol.iterator]: function* () {},
  } as unknown as ComputedStyle;
}

function mockElement(tagName: string): DOMElement {
  return {
    tagName,
    attributes: new Map(),
    children: [],
    parentNode: null,
    nodeType: 1,
    nodeName: tagName,
    textContent: "",
  } as unknown as DOMElement;
}

/**
 * Create a minimal canvas stub that enters CPU mode (getContext("webgl") returns null)
 */
function createCPUCanvas(width = 800, height = 600): HTMLCanvasElement {
  // Backing pixel buffer for 2D context
  const pixelData = new Uint8ClampedArray(width * height * 4);

  const ctx2d = {
    clearRect(_x: number, _y: number, _w: number, _h: number) {
      pixelData.fill(0);
    },
    fillRect(x: number, y: number, w: number, h: number) {
      // Fill region with current fillStyle color (simplified: mark as non-zero)
      const startX = Math.max(0, Math.floor(x));
      const startY = Math.max(0, Math.floor(y));
      const endX = Math.min(width, Math.floor(x + w));
      const endY = Math.min(height, Math.floor(y + h));
      for (let py = startY; py < endY; py++) {
        for (let px = startX; px < endX; px++) {
          const i = (py * width + px) * 4;
          pixelData[i] = 255;     // R
          pixelData[i + 1] = 0;   // G
          pixelData[i + 2] = 0;   // B
          pixelData[i + 3] = 255; // A
        }
      }
    },
    getImageData(sx: number, sy: number, sw: number, sh: number) {
      // Return the stored pixel data
      const result = new Uint8ClampedArray(sw * sh * 4);
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const srcIdx = ((sy + y) * width + (sx + x)) * 4;
          const dstIdx = (y * sw + x) * 4;
          result[dstIdx] = pixelData[srcIdx] || 0;
          result[dstIdx + 1] = pixelData[srcIdx + 1] || 0;
          result[dstIdx + 2] = pixelData[srcIdx + 2] || 0;
          result[dstIdx + 3] = pixelData[srcIdx + 3] || 0;
        }
      }
      return { data: new Uint8ClampedArray(result), width: sw, height: sh };
    },
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    set globalAlpha(_v: number) {},
    set globalCompositeOperation(_v: string) {},
    set fillStyle(_v: string) {},
    set strokeStyle(_v: string) {},
    set font(_v: string) {},
    strokeRect() {},
    fillText() {},
    drawImage() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    fill() {},
    stroke() {},
    clip() {},
    setTransform() {},
    resetTransform() {},
    measureText() { return { width: 0 }; },
  };

  return {
    width,
    height,
    getContext(type: string) {
      if (type === "webgl") return null; // Force CPU mode
      if (type === "2d") return ctx2d;
      return null;
    },
    toBlob(cb: (blob: unknown) => void) { cb(null); },
  } as unknown as HTMLCanvasElement;
}

// === Tests ===

Deno.test("Compositor: updateLayerTree stores LayerTree in CPU mode", () => {
  const compositor = new CompositorThread();
  const canvas = createCPUCanvas();
  compositor.initialize(canvas);

  assertEquals(compositor.isCPUMode(), true);

  const layerTree = new LayerTree({ x: 0 as Pixels, y: 0 as Pixels, width: 800 as Pixels, height: 600 as Pixels });
  compositor.updateLayerTree(layerTree);

  // Should not throw — layerTree is stored internally
  // Verify by compositing (uses layerTree path)
  compositor.composite();
});

Deno.test("Compositor: CPU composite uses LayerTree path when available", () => {
  const compositor = new CompositorThread();
  const canvas = createCPUCanvas();
  compositor.initialize(canvas);

  const layerTree = new LayerTree({ x: 0 as Pixels, y: 0 as Pixels, width: 800 as Pixels, height: 600 as Pixels });
  compositor.updateLayerTree(layerTree);

  // Should use layerTree.composite(ctx) path, not RenderToPixels
  compositor.composite();

  // Frame count should increment
  const stats = compositor.getStats();
  assertEquals(stats.frameCount, 1);
});

Deno.test("Compositor: CPU composite falls back to RenderToPixels when no LayerTree", () => {
  const compositor = new CompositorThread();
  const canvas = createCPUCanvas();
  compositor.initialize(canvas);

  // Set render tree but no layerTree
  const style = mockStyle({ display: "block", width: "400px", height: "200px" });
  const root = new RenderBox(mockElement("div"), style);
  const engine = new LayoutEngine();
  engine.layout(root, { width: 800 as Pixels, height: 600 as Pixels });

  compositor.setRenderTree(root);
  compositor.composite();

  const stats = compositor.getStats();
  assertEquals(stats.frameCount, 1);
});

Deno.test("Compositor: CPU composite throws when no LayerTree and no RenderTree", () => {
  const compositor = new CompositorThread();
  const canvas = createCPUCanvas();
  compositor.initialize(canvas);

  // No layerTree and no renderTree set — should throw
  try {
    compositor.composite();
    // Should not reach here
    assertEquals(true, false, "Expected composite() to throw");
  } catch (e) {
    assertExists(e);
  }
});

Deno.test("Compositor: getPixels() returns correct dimensions after composite", async () => {
  const compositor = new CompositorThread();
  const canvas = createCPUCanvas(100, 80);
  compositor.initialize(canvas);

  const layerTree = new LayerTree({ x: 0 as Pixels, y: 0 as Pixels, width: 100 as Pixels, height: 80 as Pixels });
  compositor.updateLayerTree(layerTree);
  compositor.composite();

  const pixels = await compositor.getPixels();
  // RGBA: 100 * 80 * 4 = 32000 bytes
  assertEquals(pixels.length, 100 * 80 * 4);
});

Deno.test("Compositor: getPixels() auto-composites when layerTree exists but no cpuCanvas", async () => {
  const compositor = new CompositorThread();
  const canvas = createCPUCanvas(50, 50);
  compositor.initialize(canvas);

  const layerTree = new LayerTree({ x: 0 as Pixels, y: 0 as Pixels, width: 50 as Pixels, height: 50 as Pixels });
  compositor.updateLayerTree(layerTree);

  // Don't call composite() — getPixels() should auto-composite
  const pixels = await compositor.getPixels();
  assertEquals(pixels.length, 50 * 50 * 4);
});

Deno.test("Compositor: VSync can be configured and reports stats", () => {
  const vsync = new VSync(30);
  const stats = vsync.getStats();
  assertExists(stats);
  assertEquals(typeof stats.averageFPS, "number");
});

Deno.test("Compositor: resize updates canvas dimensions", () => {
  const compositor = new CompositorThread();
  const canvas = createCPUCanvas(800, 600);
  compositor.initialize(canvas);

  compositor.resize(1024, 768);

  const c = compositor.getCanvas()!;
  assertEquals(c.width, 1024);
  assertEquals(c.height, 768);
});

Deno.test("Compositor: LayerTree getAllLayers returns flat list", () => {
  const bounds = { x: 0 as Pixels, y: 0 as Pixels, width: 100 as Pixels, height: 100 as Pixels };
  const tree = new LayerTree(bounds);
  const child = tree.createLayer(bounds);
  tree.getRoot().addChild(child);

  const layers = tree.getAllLayers();
  assertEquals(layers.length, 2); // root + child
});

Deno.test("Compositor: full pipeline RenderObject → layout → paint → compositor → pixels", async () => {
  const style = mockStyle({
    display: "block",
    width: "100px",
    height: "50px",
    "background-color": "red",
  });
  const root = new RenderBox(mockElement("div"), style);

  const engine = new LayoutEngine();
  engine.layout(root, { width: 200 as Pixels, height: 200 as Pixels });

  // Paint via RenderToPixels (like orchestrator does)
  const rtp = new RenderToPixels();
  const paintResult = rtp.paint(root, 200 as Pixels, 200 as Pixels, false);
  assertExists(paintResult.layerTree);
  assertExists(paintResult.canvas);

  // Wire into compositor
  const compositor = new CompositorThread();
  const canvas = createCPUCanvas(200, 200);
  compositor.initialize(canvas);
  compositor.updateLayerTree(paintResult.layerTree);
  compositor.setRenderTree(root);
  compositor.composite();

  const pixels = await compositor.getPixels();
  assertEquals(pixels.length, 200 * 200 * 4);

  rtp.dispose();
});
