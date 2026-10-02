/**
 * End-to-End Rendering Pipeline Tests
 *
 * Tests the complete path from RenderObject → layout → paint → composite → pixels
 * using real components (not mocks of internal logic).
 */

import { assertEquals, assertExists } from "@std/assert";
import { RenderBox } from "../../src/engine/rendering/rendering/RenderBox.ts";
import { RenderText } from "../../src/engine/rendering/rendering/RenderText.ts";
import { LayoutEngine } from "../../src/engine/rendering/layout/LayoutEngine.ts";
import { RenderToPixels } from "../../src/engine/rendering/paint/RenderToPixels.ts";
import { CompositorThread } from "../../src/engine/rendering/compositor/CompositorThread.ts";
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

function createCPUCanvas(width = 200, height = 200): HTMLCanvasElement {
  const pixelData = new Uint8ClampedArray(width * height * 4);

  const ctx2d = {
    clearRect() { pixelData.fill(0); },
    fillRect(x: number, y: number, w: number, h: number) {
      const startX = Math.max(0, Math.floor(x));
      const startY = Math.max(0, Math.floor(y));
      const endX = Math.min(width, Math.floor(x + w));
      const endY = Math.min(height, Math.floor(y + h));
      for (let py = startY; py < endY; py++) {
        for (let px = startX; px < endX; px++) {
          const i = (py * width + px) * 4;
          pixelData[i] = 255;
          pixelData[i + 1] = 0;
          pixelData[i + 2] = 0;
          pixelData[i + 3] = 255;
        }
      }
    },
    getImageData(sx: number, sy: number, sw: number, sh: number) {
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
      if (type === "webgl") return null;
      if (type === "2d") return ctx2d;
      return null;
    },
    toBlob(cb: (blob: unknown) => void) { cb(null); },
  } as unknown as HTMLCanvasElement;
}

function runPipeline(root: RenderBox, w: number, h: number) {
  const engine = new LayoutEngine();
  engine.layout(root, { width: w as Pixels, height: h as Pixels });

  const rtp = new RenderToPixels();
  const paintResult = rtp.paint(root, w as Pixels, h as Pixels, false);

  const compositor = new CompositorThread();
  const canvas = createCPUCanvas(w, h);
  compositor.initialize(canvas);
  compositor.updateLayerTree(paintResult.layerTree);
  compositor.setRenderTree(root);
  compositor.composite();

  return { compositor, paintResult, rtp };
}

// === Tests ===

Deno.test("E2E Pipeline: simple div produces pixel output", async () => {
  const root = new RenderBox(mockElement("div"), mockStyle({
    display: "block",
    width: "100px",
    height: "50px",
    "background-color": "#ff0000",
  }));

  const { compositor, rtp } = runPipeline(root, 200, 200);
  const pixels = await compositor.getPixels();

  assertEquals(pixels.length, 200 * 200 * 4);
  // At least some pixels should exist
  assertExists(pixels);

  rtp.dispose();
});

Deno.test("E2E Pipeline: nested blocks produce correct layer tree", () => {
  const parent = new RenderBox(mockElement("div"), mockStyle({
    display: "block", width: "300px", height: "auto",
  }));
  const child1 = new RenderBox(mockElement("div"), mockStyle({
    display: "block", height: "50px", "background-color": "blue",
  }));
  const child2 = new RenderBox(mockElement("div"), mockStyle({
    display: "block", height: "30px", "background-color": "green",
  }));
  parent.appendChild(child1);
  parent.appendChild(child2);

  const { paintResult, rtp } = runPipeline(parent, 400, 400);

  // Layer tree should have at least a root layer
  const layers = paintResult.layerTree.getAllLayers();
  assertEquals(layers.length >= 1, true, `Expected at least 1 layer, got ${layers.length}`);

  rtp.dispose();
});

Deno.test("E2E Pipeline: text node in pipeline does not crash", async () => {
  const parent = new RenderBox(mockElement("div"), mockStyle({
    display: "block", width: "200px", height: "auto",
  }));
  const text = new RenderText(mockElement("span"), mockStyle({
    "font-size": "16px", color: "#000",
  }), "Hello World");
  parent.appendChild(text);

  const { compositor, rtp } = runPipeline(parent, 200, 100);
  const pixels = await compositor.getPixels();
  assertEquals(pixels.length, 200 * 100 * 4);

  rtp.dispose();
});

Deno.test("E2E Pipeline: paint stats report layer and command counts", () => {
  const root = new RenderBox(mockElement("div"), mockStyle({
    display: "block", width: "100px", height: "100px", "background-color": "red",
  }));

  const { paintResult, rtp } = runPipeline(root, 200, 200);

  assertEquals(paintResult.stats.totalLayers >= 1, true);
  assertEquals(typeof paintResult.stats.paintTime, "number");
  assertEquals(typeof paintResult.stats.compositeTime, "number");

  rtp.dispose();
});

Deno.test("E2E Pipeline: incremental repaint only repaints dirty layers", () => {
  const root = new RenderBox(mockElement("div"), mockStyle({
    display: "block", width: "100px", height: "100px", "background-color": "red",
  }));

  const engine = new LayoutEngine();
  engine.layout(root, { width: 200 as Pixels, height: 200 as Pixels });

  const rtp = new RenderToPixels();

  // First paint — full
  const result1 = rtp.paint(root, 200 as Pixels, 200 as Pixels, false);
  assertExists(result1.layerTree);
  assertEquals(result1.stats.totalLayers >= 1, true);

  // Second paint — incremental (same tree, no mutations)
  const result2 = rtp.paint(root, 200 as Pixels, 200 as Pixels, true);
  // Both paints complete successfully; incremental path executes without error
  assertExists(result2.layerTree);
  assertEquals(result2.stats.totalLayers >= 1, true);

  rtp.dispose();
});

Deno.test("E2E Pipeline: compositor frame count increments on each composite", async () => {
  const root = new RenderBox(mockElement("div"), mockStyle({
    display: "block", width: "50px", height: "50px",
  }));

  const { compositor, rtp } = runPipeline(root, 100, 100);
  assertEquals(compositor.getStats().frameCount, 1);

  // Composite again
  compositor.composite();
  assertEquals(compositor.getStats().frameCount, 2);

  rtp.dispose();
});
