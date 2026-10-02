/**
 * Rendering Pipeline
 *
 * Thin facade that delegates to focused sub-components:
 * - ResourceFetcher: HTML/CSS/image fetching
 * - ImageDecoder: Binary format parsing (PNG/JPEG/GIF/WebP/SVG)
 * - WebGPUManager: GPU init/dispose/screenshot
 * - RenderingOrchestrator: render pipeline + observer
 *
 * Preserves the exact same public API for backward compatibility.
 */

import type { Pixels } from "../types/identifiers.ts";
import type { DOMNode, HTMLCanvasElement, ImageBitmap } from "../types/dom.ts";
import type { LayoutBox } from "../types/rendering.ts";
import type { OffscreenCanvas } from "../types/webgpu.ts";
import { RequestPipeline } from "./RequestPipeline.ts";
import { CompositorThread } from "./rendering/compositor/CompositorThread.ts";
import type { PipelineObserver } from "./PipelineObserver.ts";
import type { StorageManager } from "./storage/StorageManager.ts";
import { ContentSecurityPolicy } from "./security/ContentSecurityPolicy.ts";
import { CSSOM } from "./rendering/css-parser/CSSOM.ts";
import { RenderTree } from "./rendering/rendering/RenderTree.ts";
import { DisplayList } from "./rendering/paint/DisplayList.ts";
import { ScriptExecutor } from "./javascript/ScriptExecutor.ts";

// Sub-components
import { ResourceFetcher } from "./rendering/ResourceFetcher.ts";
import { ImageDecoder } from "./rendering/ImageDecoder.ts";
import { WebGPUManager } from "./rendering/WebGPUManager.ts";
import { RenderingOrchestrator } from "./rendering/RenderingOrchestrator.ts";

// Font engine for real TTF/OTF glyph rasterization
import { FontEngine } from "./rendering/text/FontEngine.ts";

// Re-export sub-components for direct access
export { ResourceFetcher } from "./rendering/ResourceFetcher.ts";
export { ImageDecoder } from "./rendering/ImageDecoder.ts";
export { WebGPUManager } from "./rendering/WebGPUManager.ts";
export { RenderingOrchestrator } from "./rendering/RenderingOrchestrator.ts";
export { WindowRenderer } from "./rendering/WindowRenderer.ts";
export type { WindowRendererConfig, DisplayMode, PresentFrameInfo } from "./rendering/WindowRenderer.ts";

/**
 * Rendering options
 */
export interface RenderingOptions {
  width?: number;
  height?: number;
  devicePixelRatio?: number;
  enableJavaScript?: boolean;
  enableImages?: boolean;
  enableCSS?: boolean;
  timeout?: number;
  signal?: AbortSignal;
  storageManager?: StorageManager;
  /** Maximum node count before the legacy display list pass is skipped. Default: 5000 */
  displayListNodeThreshold?: number;
}

/**
 * Rendering result
 */
export interface RenderingResult {
  dom: DOMNode;
  cssom: CSSOM;
  renderTree: RenderTree;
  layoutTree: LayoutBox;
  displayList: DisplayList;
  /** True when the display list was not populated because the DOM exceeded the node threshold */
  displayListTruncated?: boolean;
  layerTree?: import("./rendering/paint/PaintLayer.ts").LayerTree;
  scriptExecutor?: ScriptExecutor;
  timing: RenderingTiming;
  resources: ResourceInfo[];
}

/**
 * Rendering timing breakdown
 */
export interface RenderingTiming {
  htmlFetch: number;
  htmlParse: number;
  cssFetch: number;
  cssParse: number;
  scriptExecution: number;
  styleResolution: number;
  layoutComputation: number;
  paintRecording: number;
  compositing: number;
  total: number;
}

/**
 * Resource information
 */
export interface ResourceInfo {
  url: string;
  type: "html" | "css" | "script" | "image" | "font" | "other";
  size: number;
  fetchTime: number;
  cached: boolean;
}

/**
 * WebGPU statistics
 */
export interface WebGPUStats {
  active: boolean;
  available: boolean;
  offscreen?: import("./webgpu/offscreen/mod.ts").OffscreenWebGPUStatistics;
  device?: import("../types/webgpu.ts").GPUDeviceStats;
  layer?: import("./webgpu/compositor/mod.ts").LayerStatistics;
}

/**
 * Rendering pipeline statistics
 */
export interface RenderingPipelineStats {
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  resources: {
    total: number;
    byType: Record<string, number>;
    totalSize: number;
    cachedCount: number;
  };
  requestPipeline: ReturnType<import("./RequestPipeline.ts").RequestPipeline["getStats"]>;
  compositor: import("./rendering/compositor/CompositorThread.ts").CompositorStats;
  webgpu: WebGPUStats;
}

/**
 * Rendering Pipeline Error
 */
export class RenderingPipelineError extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public override readonly cause?: Error,
  ) {
    super(message);
    this.name = "RenderingPipelineError";
  }
}

/**
 * Shared FontEngine singleton — initialized lazily on first fillText() call.
 * Provides real TTF/OTF glyph rasterization when system fonts are available.
 */
let sharedFontEngine: FontEngine | null = null;
let fontEngineInitPromise: Promise<void> | null = null;
let fontEngineReady = false;

function ensureFontEngine(): void {
  if (fontEngineInitPromise) return; // already initializing
  fontEngineInitPromise = (async () => {
    const engine = new FontEngine();
    const wasmOk = await engine.initialize();
    if (wasmOk) {
      const loaded = await engine.discoverSystemFonts();
      if (loaded > 0) {
        sharedFontEngine = engine;
        fontEngineReady = true;
      }
    }
  })().catch(() => {
    // Font engine init failed — bitmap fallback only
  });
}

/**
 * Proportional character width table (relative to fontSize).
 * Matches TextLayout.CHAR_WIDTHS for consistency.
 */
const CHAR_WIDTHS: Record<string, number> = {
  "i": 0.28, "l": 0.28, "1": 0.33, "!": 0.30, "|": 0.25,
  ".": 0.28, ",": 0.28, ":": 0.28, ";": 0.30, "'": 0.22,
  "\"": 0.36, "`": 0.33, "j": 0.30, "f": 0.33, "r": 0.35,
  "t": 0.35, " ": 0.28,
  "a": 0.55, "b": 0.55, "c": 0.50, "d": 0.55, "e": 0.55,
  "g": 0.55, "h": 0.55, "k": 0.50, "n": 0.55, "o": 0.55,
  "p": 0.55, "q": 0.55, "s": 0.50, "u": 0.55, "v": 0.50,
  "x": 0.50, "y": 0.50, "z": 0.50,
  "0": 0.55, "2": 0.55, "3": 0.55, "4": 0.55, "5": 0.55,
  "6": 0.55, "7": 0.50, "8": 0.55, "9": 0.55,
  "m": 0.83, "w": 0.78, "M": 0.83, "W": 0.83,
  "A": 0.67, "B": 0.67, "C": 0.67, "D": 0.72, "E": 0.61,
  "F": 0.56, "G": 0.72, "H": 0.72, "I": 0.28, "J": 0.50,
  "K": 0.67, "L": 0.56, "N": 0.72, "O": 0.72, "P": 0.61,
  "Q": 0.72, "R": 0.67, "S": 0.61, "T": 0.61, "U": 0.72,
  "V": 0.67, "X": 0.67, "Y": 0.67, "Z": 0.61,
};

/**
 * Parse font size from a CSS font string (e.g. "bold 16px Arial" → 16).
 */
function parseFontSize(font: string): number {
  const m = font.match(/(\d+(?:\.\d+)?)\s*px/);
  return m ? parseFloat(m[1]) : 16;
}

/**
 * Parse font family from a CSS font string (e.g. "bold 16px Arial, sans-serif" → "Arial, sans-serif").
 */
function parseFontFamily(font: string): string {
  // Remove weight/style keywords and size, keep what's after "px "
  const m = font.match(/\d+(?:\.\d+)?\s*px\s+(.*)/);
  return m ? m[1].trim() : "sans-serif";
}

/**
 * 5×7 bitmap font glyphs for printable ASCII (32-126).
 * Each glyph is 7 rows of 5-bit bitmasks (MSB = leftmost pixel).
 */
const BITMAP_FONT: Record<number, number[]> = {
  // Space
  32: [0, 0, 0, 0, 0, 0, 0],
  // !
  33: [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00000, 0b00100],
  // "
  34: [0b01010, 0b01010, 0b01010, 0, 0, 0, 0],
  // #
  35: [0b01010, 0b11111, 0b01010, 0b01010, 0b11111, 0b01010, 0],
  // $
  36: [0b00100, 0b01111, 0b10100, 0b01110, 0b00101, 0b11110, 0b00100],
  // %
  37: [0b11001, 0b11010, 0b00100, 0b01000, 0b10110, 0b10011, 0],
  // &
  38: [0b01100, 0b10010, 0b01100, 0b10101, 0b10010, 0b01101, 0],
  // '
  39: [0b00100, 0b00100, 0, 0, 0, 0, 0],
  // (
  40: [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  // )
  41: [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  // *
  42: [0, 0b00100, 0b10101, 0b01110, 0b10101, 0b00100, 0],
  // +
  43: [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0],
  // ,
  44: [0, 0, 0, 0, 0, 0b00100, 0b01000],
  // -
  45: [0, 0, 0, 0b11111, 0, 0, 0],
  // .
  46: [0, 0, 0, 0, 0, 0b00100, 0],
  // /
  47: [0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0, 0],
  // 0
  48: [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  // 1
  49: [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  // 2
  50: [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  // 3
  51: [0b01110, 0b10001, 0b00001, 0b00110, 0b00001, 0b10001, 0b01110],
  // 4
  52: [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  // 5
  53: [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  // 6
  54: [0b01110, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b01110],
  // 7
  55: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  // 8
  56: [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  // 9
  57: [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  // :
  58: [0, 0, 0b00100, 0, 0b00100, 0, 0],
  // ;
  59: [0, 0, 0b00100, 0, 0b00100, 0b01000, 0],
  // <
  60: [0b00010, 0b00100, 0b01000, 0b10000, 0b01000, 0b00100, 0b00010],
  // =
  61: [0, 0, 0b11111, 0, 0b11111, 0, 0],
  // >
  62: [0b10000, 0b01000, 0b00100, 0b00010, 0b00100, 0b01000, 0b10000],
  // ?
  63: [0b01110, 0b10001, 0b00010, 0b00100, 0b00100, 0, 0b00100],
  // @
  64: [0b01110, 0b10001, 0b10111, 0b10101, 0b10111, 0b10000, 0b01110],
  // A-Z
  65: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  66: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  67: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  68: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  69: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  70: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  71: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  72: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  73: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  74: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  75: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  76: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  77: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  78: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  79: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  80: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  81: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  82: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  83: [0b01110, 0b10001, 0b10000, 0b01110, 0b00001, 0b10001, 0b01110],
  84: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  85: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  86: [0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b01010, 0b00100],
  87: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  88: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  89: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  90: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  // [ \ ]
  91: [0b01110, 0b01000, 0b01000, 0b01000, 0b01000, 0b01000, 0b01110],
  92: [0b10000, 0b01000, 0b00100, 0b00010, 0b00001, 0, 0],
  93: [0b01110, 0b00010, 0b00010, 0b00010, 0b00010, 0b00010, 0b01110],
  // ^ _ `
  94: [0b00100, 0b01010, 0b10001, 0, 0, 0, 0],
  95: [0, 0, 0, 0, 0, 0, 0b11111],
  96: [0b01000, 0b00100, 0, 0, 0, 0, 0],
  // a-z lowercase (g, j, p, q, y use DESCENDER_GLYPHS below for the tail)
  97:  [0, 0, 0b01110, 0b00001, 0b01111, 0b10001, 0b01111],
  98:  [0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b11110],
  99:  [0, 0, 0b01110, 0b10000, 0b10000, 0b10001, 0b01110],
  100: [0b00001, 0b00001, 0b01111, 0b10001, 0b10001, 0b10001, 0b01111],
  101: [0, 0, 0b01110, 0b10001, 0b11111, 0b10000, 0b01110],
  102: [0b00110, 0b01001, 0b01000, 0b11110, 0b01000, 0b01000, 0b01000],
  103: [0, 0, 0b01111, 0b10001, 0b10001, 0b01111, 0b00001], // row 7 = above baseline; descender continues below
  104: [0b10000, 0b10000, 0b10110, 0b11001, 0b10001, 0b10001, 0b10001],
  105: [0b00100, 0, 0b01100, 0b00100, 0b00100, 0b00100, 0b01110],
  106: [0b00010, 0, 0b00110, 0b00010, 0b00010, 0b00010, 0b00010], // descender continues
  107: [0b10000, 0b10000, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010],
  108: [0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  109: [0, 0, 0b11010, 0b10101, 0b10101, 0b10001, 0b10001],
  110: [0, 0, 0b10110, 0b11001, 0b10001, 0b10001, 0b10001],
  111: [0, 0, 0b01110, 0b10001, 0b10001, 0b10001, 0b01110],
  112: [0, 0, 0b11110, 0b10001, 0b10001, 0b11110, 0b10000], // descender continues
  113: [0, 0, 0b01111, 0b10001, 0b10001, 0b01111, 0b00001], // descender continues
  114: [0, 0, 0b10110, 0b11001, 0b10000, 0b10000, 0b10000],
  115: [0, 0, 0b01111, 0b10000, 0b01110, 0b00001, 0b11110],
  116: [0b01000, 0b01000, 0b11110, 0b01000, 0b01000, 0b01001, 0b00110],
  117: [0, 0, 0b10001, 0b10001, 0b10001, 0b10011, 0b01101],
  118: [0, 0, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  119: [0, 0, 0b10001, 0b10001, 0b10101, 0b10101, 0b01010],
  120: [0, 0, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001],
  121: [0, 0, 0b10001, 0b10001, 0b01001, 0b00110, 0b00100], // descender continues
  122: [0, 0, 0b11111, 0b00010, 0b00100, 0b01000, 0b11111],
  // { | }
  123: [0b00010, 0b00100, 0b00100, 0b01000, 0b00100, 0b00100, 0b00010],
  124: [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  125: [0b01000, 0b00100, 0b00100, 0b00010, 0b00100, 0b00100, 0b01000],
  // ~
  126: [0, 0, 0b01000, 0b10101, 0b00010, 0, 0],
};

/**
 * Descender extension rows for characters that extend below the baseline.
 * These are 2 extra rows (rows 8-9) rendered below the 7-row glyph grid.
 */
const DESCENDER_ROWS: Record<number, [number, number]> = {
  103: [0b01110, 0],       // g: closing bowl below baseline
  106: [0b10010, 0b01100], // j: curve at bottom
  112: [0b10000, 0],       // p: stem extends down
  113: [0b00001, 0],       // q: stem extends down
  121: [0b01000, 0b10000], // y: tail extends down-left
};

/**
 * Set a single pixel in the RGBA buffer with alpha blending.
 */
function blendPixel(
  pixels: Uint8ClampedArray,
  bufW: number,
  bufH: number,
  px: number,
  py: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  if (px < 0 || px >= bufW || py < 0 || py >= bufH) return;
  const idx = (py * bufW + px) * 4;
  if (a >= 0.999) {
    // Opaque fast path
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = 255;
    return;
  }
  if (a <= 0.001) return;
  const dstA = pixels[idx + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA > 0) {
    pixels[idx] = Math.round((r * a + pixels[idx] * dstA * (1 - a)) / outA);
    pixels[idx + 1] = Math.round((g * a + pixels[idx + 1] * dstA * (1 - a)) / outA);
    pixels[idx + 2] = Math.round((b * a + pixels[idx + 2] * dstA * (1 - a)) / outA);
    pixels[idx + 3] = Math.round(outA * 255);
  }
}

/**
 * Render a bitmap character into an RGBA buffer.
 *
 * The 5×7 glyph is scaled to fit a target cell whose width = charAdvance
 * and height = fontSize. This keeps characters proportional at any size.
 *
 * @param x     Left edge of the character cell
 * @param baseY Baseline y-coordinate (text draws upward from here)
 */
function renderBitmapChar(
  pixels: Uint8ClampedArray,
  bufW: number,
  bufH: number,
  code: number,
  x: number,
  baseY: number,
  fontSize: number,
  charAdvance: number,
  color: [number, number, number, number],
  alpha: number,
): void {
  const glyph = BITMAP_FONT[code];
  if (!glyph) return;

  // Ascent: how far the glyph top sits above the baseline
  const ascent = fontSize * 0.80;
  const topY = baseY - ascent;

  // Glyph drawing area: 90% of advance width, centered horizontally
  const glyphW = charAdvance * 0.90;
  const offsetX = (charAdvance - glyphW) * 0.5;

  // Scale: map 5 glyph columns → glyphW, 7 rows → fontSize
  const colW = glyphW / 5;
  const rowH = fontSize / 7;

  const a = color[3] * alpha;

  // Render the 7 main glyph rows
  for (let row = 0; row < 7; row++) {
    const bits = glyph[row];
    if (bits === 0) continue;
    const py0 = Math.round(topY + row * rowH);
    const py1 = Math.max(py0 + 1, Math.round(topY + (row + 1) * rowH));
    for (let col = 0; col < 5; col++) {
      if (!(bits & (1 << (4 - col)))) continue;
      const px0 = Math.round(x + offsetX + col * colW);
      const px1 = Math.max(px0 + 1, Math.round(x + offsetX + (col + 1) * colW));
      for (let py = py0; py < py1; py++) {
        for (let px = px0; px < px1; px++) {
          blendPixel(pixels, bufW, bufH, px, py, color[0], color[1], color[2], a);
        }
      }
    }
  }

  // Render descender rows (below baseline) if present
  const descRows = DESCENDER_ROWS[code];
  if (descRows) {
    for (let dr = 0; dr < 2; dr++) {
      const bits = descRows[dr];
      if (bits === 0) continue;
      const row = 7 + dr;
      const py0 = Math.round(topY + row * rowH);
      const py1 = Math.max(py0 + 1, Math.round(topY + (row + 1) * rowH));
      for (let col = 0; col < 5; col++) {
        if (!(bits & (1 << (4 - col)))) continue;
        const px0 = Math.round(x + offsetX + col * colW);
        const px1 = Math.max(px0 + 1, Math.round(x + offsetX + (col + 1) * colW));
        for (let py = py0; py < py1; py++) {
          for (let px = px0; px < px1; px++) {
            blendPixel(pixels, bufW, bufH, px, py, color[0], color[1], color[2], a);
          }
        }
      }
    }
  }
}

/**
 * Render a string of text as bitmap characters into an RGBA buffer.
 *
 * @param y The y position from the layout — treated as the TEXT BASELINE.
 *          The orchestrator passes layoutBox.y which is the box top, so the
 *          caller (fillText) adds the ascent offset before calling this.
 */
function renderBitmapText(
  pixels: Uint8ClampedArray,
  bufW: number,
  bufH: number,
  text: string,
  x: number,
  baseY: number,
  fontSize: number,
  color: [number, number, number, number],
  alpha: number,
  maxWidth?: number,
): void {
  let curX = x;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const charRelWidth = CHAR_WIDTHS[text[i]] ?? 0.55;
    const charAdvance = fontSize * charRelWidth;

    if (maxWidth !== undefined && (curX - x + charAdvance) > maxWidth) break;

    if (code !== 32) { // Skip rendering space characters
      renderBitmapChar(pixels, bufW, bufH, code, curX, baseY, fontSize, charAdvance, color, alpha);
    }
    curX += charAdvance;
  }
}

/**
 * Create a software Canvas2D context that holds an RGBA pixel buffer.
 * Used when no real GPU/canvas is available (headless Deno).
 */
function createSoftwareContext2D(
  canvas: { width: number; height: number },
): import("../types/dom.ts").CanvasRenderingContext2D {
  const w = canvas.width;
  const h = canvas.height;
  const pixels = new Uint8ClampedArray(w * h * 4);
  // Fill white
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255;
    pixels[i + 1] = 255;
    pixels[i + 2] = 255;
    pixels[i + 3] = 255;
  }
  const stateStack: Array<{
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    font: string;
    globalAlpha: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    shadowBlur: number;
    shadowColor: string;
    globalCompositeOperation: string;
  }> = [];

  const ctx: import("../types/dom.ts").CanvasRenderingContext2D = {
    canvas: canvas as import("../types/dom.ts").HTMLCanvasElement,
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    font: "16px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
    shadowColor: "transparent",
    globalCompositeOperation: "source-over",

    fillRect(x: number, y: number, rw: number, rh: number) {
      const color = parseColor(String(ctx.fillStyle));
      const alpha = ctx.globalAlpha;
      const x0 = Math.max(0, Math.round(x));
      const y0 = Math.max(0, Math.round(y));
      const x1 = Math.min(w, Math.round(x + rw));
      const y1 = Math.min(h, Math.round(y + rh));
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const idx = (py * w + px) * 4;
          pixels[idx] = color[0];
          pixels[idx + 1] = color[1];
          pixels[idx + 2] = color[2];
          pixels[idx + 3] = Math.round(color[3] * alpha * 255);
        }
      }
    },
    strokeRect(x: number, y: number, rw: number, rh: number) {
      const lw = ctx.lineWidth;
      ctx.fillRect(x, y, rw, lw); // top
      ctx.fillRect(x, y + rh - lw, rw, lw); // bottom
      ctx.fillRect(x, y, lw, rh); // left
      ctx.fillRect(x + rw - lw, y, lw, rh); // right
    },
    clearRect(x: number, y: number, rw: number, rh: number) {
      const x0 = Math.max(0, Math.round(x));
      const y0 = Math.max(0, Math.round(y));
      const x1 = Math.min(w, Math.round(x + rw));
      const y1 = Math.min(h, Math.round(y + rh));
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const idx = (py * w + px) * 4;
          pixels[idx] = 255;
          pixels[idx + 1] = 255;
          pixels[idx + 2] = 255;
          pixels[idx + 3] = 255;
        }
      }
    },
    fillText(text: string, x: number, y: number, maxWidth?: number) {
      const color = parseColor(String(ctx.fillStyle));
      const alpha = ctx.globalAlpha;
      const fontSize = parseFontSize(ctx.font);
      const fontFamily = parseFontFamily(ctx.font);

      // Kick off async font engine init (non-blocking)
      ensureFontEngine();

      // Try real font rendering first
      if (fontEngineReady && sharedFontEngine) {
        const rendered = sharedFontEngine.renderText(
          pixels, w, h, text, x, y, fontSize, fontFamily, color, alpha,
        );
        if (rendered > 0) return; // real glyphs rendered successfully
      }

      // Fallback: bitmap font
      renderBitmapText(pixels, w, h, text, x, y, fontSize, color, alpha, maxWidth);
    },
    strokeText(text: string, x: number, y: number, maxWidth?: number) {
      const color = parseColor(String(ctx.strokeStyle));
      const alpha = ctx.globalAlpha;
      const fontSize = parseFontSize(ctx.font);
      const fontFamily = parseFontFamily(ctx.font);

      ensureFontEngine();

      if (fontEngineReady && sharedFontEngine) {
        const rendered = sharedFontEngine.renderText(
          pixels, w, h, text, x, y, fontSize, fontFamily, color, alpha,
        );
        if (rendered > 0) return;
      }

      renderBitmapText(pixels, w, h, text, x, y, fontSize, color, alpha, maxWidth);
    },
    measureText(text: string) {
      const fontSize = parseFontSize(ctx.font);
      const fontFamily = parseFontFamily(ctx.font);

      // Use real font metrics when available
      if (fontEngineReady && sharedFontEngine) {
        const width = sharedFontEngine.measureText(text, fontFamily, fontSize);
        if (width > 0) return { width } as import("../types/dom.ts").TextMetrics;
      }

      // Fallback: proportional estimates
      let totalWidth = 0;
      for (let i = 0; i < text.length; i++) {
        const relWidth = CHAR_WIDTHS[text[i]] ?? 0.55;
        totalWidth += fontSize * relWidth;
      }
      return { width: totalWidth } as import("../types/dom.ts").TextMetrics;
    },
    drawImage(_image: unknown, _dx: number, _dy: number, _dw?: number, _dh?: number) {},
    save() {
      stateStack.push({
        fillStyle: String(ctx.fillStyle),
        strokeStyle: String(ctx.strokeStyle),
        lineWidth: ctx.lineWidth,
        font: ctx.font,
        globalAlpha: ctx.globalAlpha,
        shadowOffsetX: ctx.shadowOffsetX,
        shadowOffsetY: ctx.shadowOffsetY,
        shadowBlur: ctx.shadowBlur,
        shadowColor: ctx.shadowColor,
        globalCompositeOperation: ctx.globalCompositeOperation,
      });
    },
    restore() {
      const state = stateStack.pop();
      if (state) {
        ctx.fillStyle = state.fillStyle;
        ctx.strokeStyle = state.strokeStyle;
        ctx.lineWidth = state.lineWidth;
        ctx.font = state.font;
        ctx.globalAlpha = state.globalAlpha;
        ctx.shadowOffsetX = state.shadowOffsetX;
        ctx.shadowOffsetY = state.shadowOffsetY;
        ctx.shadowBlur = state.shadowBlur;
        ctx.shadowColor = state.shadowColor;
        ctx.globalCompositeOperation = state.globalCompositeOperation;
      }
    },
    scale(_x: number, _y: number) {},
    rotate(_angle: number) {},
    translate(_x: number, _y: number) {},
    transform(_a: number, _b: number, _c: number, _d: number, _e: number, _f: number) {},
    setTransform(_a: number, _b: number, _c: number, _d: number, _e: number, _f: number) {},
    getImageData(sx: number, sy: number, sw: number, sh: number) {
      const data = new Uint8ClampedArray(sw * sh * 4);
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const srcIdx = ((sy + y) * w + (sx + x)) * 4;
          const dstIdx = (y * sw + x) * 4;
          data[dstIdx] = pixels[srcIdx];
          data[dstIdx + 1] = pixels[srcIdx + 1];
          data[dstIdx + 2] = pixels[srcIdx + 2];
          data[dstIdx + 3] = pixels[srcIdx + 3];
        }
      }
      return { width: sw, height: sh, data } as import("../types/dom.ts").ImageData;
    },
    putImageData(imageData: import("../types/dom.ts").ImageData, dx: number, dy: number) {
      for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
          const srcIdx = (y * imageData.width + x) * 4;
          const dstIdx = ((dy + y) * w + (dx + x)) * 4;
          pixels[dstIdx] = imageData.data[srcIdx];
          pixels[dstIdx + 1] = imageData.data[srcIdx + 1];
          pixels[dstIdx + 2] = imageData.data[srcIdx + 2];
          pixels[dstIdx + 3] = imageData.data[srcIdx + 3];
        }
      }
    },
    rect(_x: number, _y: number, _w: number, _h: number) {},
    clip() {},
    beginPath() {},
    closePath() {},
    moveTo(_x: number, _y: number) {},
    lineTo(_x: number, _y: number) {},
    arc(_x: number, _y: number, _r: number, _sa: number, _ea: number, _cc?: boolean) {},
    arcTo(_x1: number, _y1: number, _x2: number, _y2: number, _r: number) {},
    quadraticCurveTo(_cpx: number, _cpy: number, _x: number, _y: number) {},
    bezierCurveTo(_cp1x: number, _cp1y: number, _cp2x: number, _cp2y: number, _x: number, _y: number) {},
    stroke() {},
    fill() {},
  };
  return ctx;
}

/**
 * Parse a CSS color string to [r, g, b, a] (0-255 for rgb, 0-1 for a)
 */
function parseColor(color: string): [number, number, number, number] {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
        1,
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      1,
    ];
  }
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return [
      parseInt(rgbaMatch[1]),
      parseInt(rgbaMatch[2]),
      parseInt(rgbaMatch[3]),
      rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    ];
  }
  // Named colors
  const named: Record<string, [number, number, number, number]> = {
    black: [0, 0, 0, 1],
    white: [255, 255, 255, 1],
    red: [255, 0, 0, 1],
    green: [0, 128, 0, 1],
    blue: [0, 0, 255, 1],
    transparent: [0, 0, 0, 0],
    gray: [128, 128, 128, 1],
    grey: [128, 128, 128, 1],
    silver: [192, 192, 192, 1],
    maroon: [128, 0, 0, 1],
    navy: [0, 0, 128, 1],
    teal: [0, 128, 128, 1],
    aqua: [0, 255, 255, 1],
    cyan: [0, 255, 255, 1],
    lime: [0, 255, 0, 1],
    olive: [128, 128, 0, 1],
    purple: [128, 0, 128, 1],
    fuchsia: [255, 0, 255, 1],
    magenta: [255, 0, 255, 1],
    yellow: [255, 255, 0, 1],
    orange: [255, 165, 0, 1],
    orangered: [255, 69, 0, 1],
    brown: [165, 42, 42, 1],
    pink: [255, 192, 203, 1],
    coral: [255, 127, 80, 1],
    tomato: [255, 99, 71, 1],
    gold: [255, 215, 0, 1],
    darkgray: [169, 169, 169, 1],
    darkgrey: [169, 169, 169, 1],
    lightgray: [211, 211, 211, 1],
    lightgrey: [211, 211, 211, 1],
    dimgray: [105, 105, 105, 1],
    dimgrey: [105, 105, 105, 1],
    darkred: [139, 0, 0, 1],
    darkblue: [0, 0, 139, 1],
    darkgreen: [0, 100, 0, 1],
    indianred: [205, 92, 92, 1],
    crimson: [220, 20, 60, 1],
    steelblue: [70, 130, 180, 1],
    dodgerblue: [30, 144, 255, 1],
    royalblue: [65, 105, 225, 1],
    cornflowerblue: [100, 149, 237, 1],
    slategray: [112, 128, 144, 1],
    slategrey: [112, 128, 144, 1],
    whitesmoke: [245, 245, 245, 1],
    gainsboro: [220, 220, 220, 1],
    ghostwhite: [248, 248, 255, 1],
    aliceblue: [240, 248, 255, 1],
    lavender: [230, 230, 250, 1],
    linen: [250, 240, 230, 1],
    ivory: [255, 255, 240, 1],
    snow: [255, 250, 250, 1],
    seashell: [255, 245, 238, 1],
    beige: [245, 245, 220, 1],
    wheat: [245, 222, 179, 1],
    tan: [210, 180, 140, 1],
    khaki: [240, 230, 140, 1],
  };
  return named[color.toLowerCase()] ?? [0, 0, 0, 1];
}

/**
 * Create OffscreenCanvas abstraction for Deno runtime
 */
function createOffscreenCanvas(width: number, height: number): OffscreenCanvas {
  let cachedCtx: import("../types/dom.ts").CanvasRenderingContext2D | null = null;
  const canvas = {
    width,
    height,
    getContext: (contextId: string) => {
      if (contextId === "2d") {
        if (!cachedCtx) {
          cachedCtx = createSoftwareContext2D(canvas as unknown as { width: number; height: number });
        }
        return cachedCtx;
      }
      return null;
    },
    convertToBlob: async () => new Blob(),
    transferToImageBitmap: () => ({
      width,
      height,
      close: () => {},
    } as ImageBitmap),
  } as OffscreenCanvas;
  return canvas;
}

/**
 * Rendering Pipeline - Backward-compatible facade
 */
export class RenderingPipeline {
  private requestPipeline: RequestPipeline;
  private compositor: CompositorThread;
  private canvas: OffscreenCanvas;
  private width: number;
  private height: number;
  private devicePixelRatio: number;
  private ownsRequestPipeline: boolean;
  public lastRenderResult?: RenderingResult;

  // Sub-components
  private resourceFetcher: ResourceFetcher;
  private webgpuManager: WebGPUManager;
  private orchestrator: RenderingOrchestrator;

  constructor(options: RenderingOptions = {}, requestPipeline?: RequestPipeline) {
    if (requestPipeline) {
      this.requestPipeline = requestPipeline;
      this.ownsRequestPipeline = false;
    } else {
      this.requestPipeline = new RequestPipeline();
      this.ownsRequestPipeline = true;
    }
    this.width = options.width ?? 1024;
    this.height = options.height ?? 768;
    this.devicePixelRatio = options.devicePixelRatio ?? 1.0;

    this.canvas = createOffscreenCanvas(
      this.width * this.devicePixelRatio,
      this.height * this.devicePixelRatio,
    );

    this.compositor = new CompositorThread();
    this.compositor.initialize(this.canvas as unknown as HTMLCanvasElement);

    // Initialize sub-components
    this.resourceFetcher = new ResourceFetcher(this.requestPipeline);
    this.webgpuManager = new WebGPUManager();
    this.orchestrator = new RenderingOrchestrator(
      this.resourceFetcher,
      this.compositor,
      this.width,
      this.height,
      options.enableJavaScript ?? false,
      options.storageManager,
    );
  }

  // ========================================================================
  // Observer
  // ========================================================================

  setObserver(observer: PipelineObserver): void {
    this.orchestrator.setObserver(observer);
  }

  getLastRenderArtifacts(): {
    dom: unknown;
    cssom: unknown;
    renderTree: unknown;
    layoutTree: unknown;
    displayList: unknown;
  } | undefined {
    return this.orchestrator.getLastRenderArtifacts();
  }

  // ========================================================================
  // WebGPU
  // ========================================================================

  async initializeWebGPU(): Promise<boolean> {
    return this.webgpuManager.initializeWebGPU(
      this.width * this.devicePixelRatio,
      this.height * this.devicePixelRatio,
    );
  }

  isWebGPUActive(): boolean {
    return this.webgpuManager.isWebGPUActive();
  }

  // ========================================================================
  // Render
  // ========================================================================

  /**
   * Initialize the font engine and discover system fonts.
   * Call before render() for best text quality on first frame.
   * Automatically called lazily if not called explicitly.
   */
  async initializeFonts(): Promise<boolean> {
    ensureFontEngine();
    if (fontEngineInitPromise) {
      await fontEngineInitPromise;
    }
    return fontEngineReady;
  }

  /**
   * Get the shared font engine instance (null if not yet initialized or failed).
   */
  getFontEngine(): FontEngine | null {
    return sharedFontEngine;
  }

  async render(url: string | URL, options: RenderingOptions = {}): Promise<RenderingResult> {
    // Ensure font engine is initialized before rendering
    ensureFontEngine();
    if (fontEngineInitPromise) {
      await fontEngineInitPromise;
    }

    const result = await this.orchestrator.render(url, options, this.requestPipeline);
    this.lastRenderResult = result;
    return result;
  }

  // ========================================================================
  // Pixels / Screenshot
  // ========================================================================

  async getPixels(): Promise<Uint8ClampedArray> {
    return this.webgpuManager.getPixels(this.compositor);
  }

  async screenshot(): Promise<Uint8ClampedArray> {
    return await this.getPixels();
  }

  // ========================================================================
  // Viewport
  // ========================================================================

  setViewportSize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    const scaledWidth = width * this.devicePixelRatio;
    const scaledHeight = height * this.devicePixelRatio;

    this.compositor.resize(scaledWidth, scaledHeight);
    this.webgpuManager.resizeWebGPU(scaledWidth, scaledHeight);
    this.orchestrator.setDimensions(width, height);
  }

  // ========================================================================
  // Stats
  // ========================================================================

  getStats(): RenderingPipelineStats {
    const resources = this.resourceFetcher.getResources();
    const grouped: Record<string, number> = {};
    for (const resource of resources) {
      grouped[resource.type] = (grouped[resource.type] || 0) + 1;
    }

    return {
      viewport: {
        width: this.width,
        height: this.height,
        devicePixelRatio: this.devicePixelRatio,
      },
      resources: {
        total: resources.length,
        byType: grouped,
        totalSize: resources.reduce((sum, r) => sum + r.size, 0),
        cachedCount: resources.filter((r) => r.cached).length,
      },
      requestPipeline: this.requestPipeline.getStats(),
      compositor: this.compositor.getStats(),
      webgpu: this.webgpuManager.getWebGPUStats(),
    };
  }

  // ========================================================================
  // CSP
  // ========================================================================

  setCSP(csp: ContentSecurityPolicy): void {
    this.orchestrator.setCSP(csp);
  }

  getCSP(): ContentSecurityPolicy | undefined {
    return this.orchestrator.getCSP();
  }

  // ========================================================================
  // Cache
  // ========================================================================

  clearCache(): void {
    this.requestPipeline.clearDNSCache();
    this.resourceFetcher.clearResources();
  }

  // ========================================================================
  // Subsystem Access
  // ========================================================================

  getRequestPipeline(): RequestPipeline {
    return this.requestPipeline;
  }

  getCompositor(): CompositorThread {
    return this.compositor;
  }

  getOrchestrator(): RenderingOrchestrator {
    return this.orchestrator;
  }

  /**
   * Set a WindowRenderer on the orchestrator.
   * When set, each render() call will push pixels to the renderer.
   */
  setWindowRenderer(renderer: import("./rendering/WindowRenderer.ts").WindowRenderer | null): void {
    this.orchestrator.setWindowRenderer(renderer);
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  async close(): Promise<void> {
    await this.webgpuManager.disposeWebGPU();

    if (this.ownsRequestPipeline) {
      await this.requestPipeline.close();
    }

    await this.compositor.destroy();
  }
}
