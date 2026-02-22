/**
 * Graphics Context
 *
 * 2D graphics rendering context for drawing shapes, text, and images.
 * This provides the paint operations used by the browser's paint system.
 */

import type { CanvasRenderingContext2D, HTMLCanvasElement } from "../../types/dom.ts";

// Declare document global for browser environment
declare const document: {
  createElement(tagName: string): HTMLCanvasElement;
} | undefined;

/**
 * Color representation (CSS color string)
 */
export type Color = string;

/**
 * Font specification (CSS font string)
 */
export type Font = string;

/**
 * Graphics state (for save/restore)
 */
interface GraphicsState {
  fillStyle: Color;
  strokeStyle: Color;
  lineWidth: number;
  font: Font;
  globalAlpha: number;
  transform: number[]; // 2D transform matrix [a, b, c, d, e, f]
  clipBounds: ClipBounds | null;
}

/**
 * Clip bounds for headless path clipping
 */
interface ClipBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Path segment types for headless path tracking
 */
type PathSegment =
  | { type: "moveTo"; x: number; y: number }
  | { type: "lineTo"; x: number; y: number }
  | { type: "close" };

/**
 * Named CSS colors
 */
const NAMED_COLORS: Record<string, [number, number, number, number]> = {
  black: [0, 0, 0, 255],
  white: [255, 255, 255, 255],
  red: [255, 0, 0, 255],
  green: [0, 128, 0, 255],
  blue: [0, 0, 255, 255],
  yellow: [255, 255, 0, 255],
  cyan: [0, 255, 255, 255],
  magenta: [255, 0, 255, 255],
  orange: [255, 165, 0, 255],
  purple: [128, 0, 128, 255],
  gray: [128, 128, 128, 255],
  grey: [128, 128, 128, 255],
  transparent: [0, 0, 0, 0],
};

/**
 * Graphics Context - 2D drawing operations
 *
 * This class provides Canvas-like 2D drawing API for the paint system.
 * In a real browser, this would interface with Skia or a similar graphics library.
 */
export class GraphicsContext {
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private stateStack: GraphicsState[] = [];

  // Software pixel buffer for headless mode
  private pixelBuffer?: Uint8Array;

  // Headless path tracking
  private currentPath: PathSegment[] = [];

  // Current transform matrix [a, b, c, d, e, f] — maps to [scaleX, skewY, skewX, scaleY, translateX, translateY]
  private currentTransform: number[] = [1, 0, 0, 1, 0, 0];

  // Clip bounds for headless clipping
  private clipBounds: ClipBounds | null = null;

  // Current graphics state
  private fillStyle: Color = "#000000";
  private strokeStyle: Color = "#000000";
  private lineWidth: number = 1;
  private font: Font = "10px sans-serif";
  private globalAlpha: number = 1.0;

  /**
   * Create graphics context
   * @param width - Context width in pixels
   * @param height - Context height in pixels
   */
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Try to create canvas context (if in browser environment)
    if (typeof document !== "undefined") {
      this.canvas = document.createElement("canvas");
      this.canvas.width = width;
      this.canvas.height = height;
      const ctx = this.canvas.getContext("2d");
      if (ctx) {
        this.ctx = ctx;
      }
    }

    // Create software pixel buffer for headless mode
    if (!this.ctx && width > 0 && height > 0) {
      this.pixelBuffer = new Uint8Array(width * height * 4);
    }
  }

  /**
   * Parse a CSS color string to RGBA values
   */
  private parseColor(color: string): [number, number, number, number] {
    // Named colors
    const lower = color.toLowerCase().trim();
    if (NAMED_COLORS[lower]) {
      return NAMED_COLORS[lower];
    }

    // #rgb
    if (/^#[0-9a-fA-F]{3}$/.test(color)) {
      const r = parseInt(color[1] + color[1], 16);
      const g = parseInt(color[2] + color[2], 16);
      const b = parseInt(color[3] + color[3], 16);
      return [r, g, b, 255];
    }

    // #rrggbb
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return [r, g, b, 255];
    }

    // #rrggbbaa
    if (/^#[0-9a-fA-F]{8}$/.test(color)) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const a = parseInt(color.slice(7, 9), 16);
      return [r, g, b, a];
    }

    // rgb(r, g, b)
    const rgbMatch = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
    if (rgbMatch) {
      return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]), 255];
    }

    // rgba(r, g, b, a)
    const rgbaMatch = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
    if (rgbaMatch) {
      return [
        parseInt(rgbaMatch[1]),
        parseInt(rgbaMatch[2]),
        parseInt(rgbaMatch[3]),
        Math.round(parseFloat(rgbaMatch[4]) * 255),
      ];
    }

    // Fallback: black
    return [0, 0, 0, 255];
  }

  /**
   * Parse font string to extract font size in pixels
   */
  private parseFontSize(font: string): number {
    const match = font.match(/(\d+(?:\.\d+)?)\s*px/);
    if (match) {
      return parseFloat(match[1]);
    }
    return 10; // default
  }

  /**
   * Apply current transform to a point
   */
  private transformPoint(x: number, y: number): [number, number] {
    const [a, b, c, d, e, f] = this.currentTransform;
    return [a * x + c * y + e, b * x + d * y + f];
  }

  /**
   * Set a pixel in the buffer with bounds and clip checking
   */
  private setPixel(px: number, py: number, r: number, g: number, b: number, a: number): void {
    if (!this.pixelBuffer) return;
    const ix = Math.round(px);
    const iy = Math.round(py);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return;

    // Clip check
    if (this.clipBounds) {
      if (
        ix < this.clipBounds.minX || ix > this.clipBounds.maxX ||
        iy < this.clipBounds.minY || iy > this.clipBounds.maxY
      ) {
        return;
      }
    }

    // Apply global alpha
    const finalA = Math.round(a * this.globalAlpha);

    const offset = (iy * this.width + ix) * 4;

    // Alpha blending with existing pixel
    if (finalA === 255) {
      this.pixelBuffer[offset] = r;
      this.pixelBuffer[offset + 1] = g;
      this.pixelBuffer[offset + 2] = b;
      this.pixelBuffer[offset + 3] = finalA;
    } else if (finalA > 0) {
      const srcA = finalA / 255;
      const dstA = this.pixelBuffer[offset + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA > 0) {
        this.pixelBuffer[offset] = Math.round(
          (r * srcA + this.pixelBuffer[offset] * dstA * (1 - srcA)) / outA,
        );
        this.pixelBuffer[offset + 1] = Math.round(
          (g * srcA + this.pixelBuffer[offset + 1] * dstA * (1 - srcA)) / outA,
        );
        this.pixelBuffer[offset + 2] = Math.round(
          (b * srcA + this.pixelBuffer[offset + 2] * dstA * (1 - srcA)) / outA,
        );
        this.pixelBuffer[offset + 3] = Math.round(outA * 255);
      }
    }
  }

  /**
   * Draw a horizontal line in the pixel buffer
   */
  private drawHLine(
    x1: number,
    x2: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ): void {
    const startX = Math.max(0, Math.min(x1, x2));
    const endX = Math.min(this.width - 1, Math.max(x1, x2));
    for (let x = startX; x <= endX; x++) {
      this.setPixel(x, y, r, g, b, a);
    }
  }

  /**
   * Bresenham's line algorithm for stroke
   */
  private drawLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ): void {
    let ix0 = Math.round(x0);
    let iy0 = Math.round(y0);
    const ix1 = Math.round(x1);
    const iy1 = Math.round(y1);
    const dx = Math.abs(ix1 - ix0);
    const dy = Math.abs(iy1 - iy0);
    const sx = ix0 < ix1 ? 1 : -1;
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx - dy;

    // For lineWidth > 1, draw thicker lines
    const halfW = Math.floor(this.lineWidth / 2);

    while (true) {
      if (halfW <= 0) {
        this.setPixel(ix0, iy0, r, g, b, a);
      } else {
        for (let wy = -halfW; wy <= halfW; wy++) {
          for (let wx = -halfW; wx <= halfW; wx++) {
            this.setPixel(ix0 + wx, iy0 + wy, r, g, b, a);
          }
        }
      }

      if (ix0 === ix1 && iy0 === iy1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        ix0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        iy0 += sy;
      }
    }
  }

  /**
   * Scanline fill for a polygon defined by path segments
   */
  private scanlineFill(segments: PathSegment[], r: number, g: number, b: number, a: number): void {
    // Collect edges from path
    const edges: { x0: number; y0: number; x1: number; y1: number }[] = [];
    let firstX = 0, firstY = 0;
    let curX = 0, curY = 0;
    let hasFirst = false;

    for (const seg of segments) {
      if (seg.type === "moveTo") {
        curX = seg.x;
        curY = seg.y;
        firstX = seg.x;
        firstY = seg.y;
        hasFirst = true;
      } else if (seg.type === "lineTo") {
        edges.push({ x0: curX, y0: curY, x1: seg.x, y1: seg.y });
        curX = seg.x;
        curY = seg.y;
      } else if (seg.type === "close" && hasFirst) {
        if (curX !== firstX || curY !== firstY) {
          edges.push({ x0: curX, y0: curY, x1: firstX, y1: firstY });
        }
        curX = firstX;
        curY = firstY;
      }
    }

    if (edges.length < 2) return;

    // Find bounding box
    let minY = Infinity, maxY = -Infinity;
    for (const e of edges) {
      minY = Math.min(minY, e.y0, e.y1);
      maxY = Math.max(maxY, e.y0, e.y1);
    }
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.min(this.height - 1, Math.ceil(maxY));

    // Scanline
    for (let y = minY; y <= maxY; y++) {
      const intersections: number[] = [];
      for (const e of edges) {
        const { x0, y0, x1, y1 } = e;
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          const t = (y - y0) / (y1 - y0);
          intersections.push(x0 + t * (x1 - x0));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length - 1; i += 2) {
        this.drawHLine(
          Math.ceil(intersections[i]),
          Math.floor(intersections[i + 1]),
          y,
          r,
          g,
          b,
          a,
        );
      }
    }
  }

  /**
   * Simple bitmap font rendering - renders ASCII chars as small patterns
   */
  private renderBitmapChar(
    ch: string,
    x: number,
    y: number,
    fontSize: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ): void {
    // Scale factor relative to base 8px character size
    const scale = Math.max(1, Math.round(fontSize / 10));
    const charWidth = Math.round(fontSize * 0.6);
    const charHeight = Math.round(fontSize);

    // Simple block rendering: fill a portion of the character cell
    // For printable ASCII, render a small pattern
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) {
      if (code === 32) return; // space - no pixels

      // Render character as a filled block (simplified bitmap)
      const blockW = Math.max(1, Math.round(charWidth * 0.7));
      const blockH = Math.max(1, Math.round(charHeight * 0.7));
      const offsetY = Math.round(charHeight * 0.15);

      for (let dy = 0; dy < blockH; dy++) {
        for (let dx = 0; dx < blockW; dx++) {
          this.setPixel(
            x + dx * scale / Math.max(1, scale),
            y - charHeight + offsetY + dy,
            r,
            g,
            b,
            a,
          );
        }
      }
    } else {
      // Non-ASCII: render as a filled rectangle placeholder
      const blockW = Math.max(1, Math.round(charWidth * 0.7));
      const blockH = Math.max(1, Math.round(charHeight * 0.7));
      for (let dy = 0; dy < blockH; dy++) {
        for (let dx = 0; dx < blockW; dx++) {
          this.setPixel(x + dx, y - charHeight + dy, r, g, b, a);
        }
      }
    }
  }

  /**
   * Set fill style (color or pattern)
   */
  setFillStyle(style: Color): void {
    this.fillStyle = style;
    if (this.ctx) {
      this.ctx.fillStyle = style;
    }
  }

  /**
   * Set stroke style (color or pattern)
   */
  setStrokeStyle(style: Color): void {
    this.strokeStyle = style;
    if (this.ctx) {
      this.ctx.strokeStyle = style;
    }
  }

  /**
   * Set line width for stroke operations
   */
  setLineWidth(width: number): void {
    this.lineWidth = width;
    if (this.ctx) {
      this.ctx.lineWidth = width;
    }
  }

  /**
   * Set font for text operations
   */
  setFont(font: Font): void {
    this.font = font;
    if (this.ctx) {
      this.ctx.font = font;
    }
  }

  /**
   * Set global alpha (opacity)
   */
  setGlobalAlpha(alpha: number): void {
    this.globalAlpha = alpha;
    if (this.ctx) {
      this.ctx.globalAlpha = alpha;
    }
  }

  /**
   * Fill rectangle
   */
  fillRect(x: number, y: number, width: number, height: number): void {
    if (this.ctx) {
      this.ctx.fillRect(x, y, width, height);
    } else if (this.pixelBuffer) {
      const [r, g, b, a] = this.parseColor(this.fillStyle);
      // Transform the four corners
      const [tx, ty] = this.transformPoint(x, y);
      const [tx2, ty2] = this.transformPoint(x + width, y + height);

      const startX = Math.max(0, Math.floor(Math.min(tx, tx2)));
      const endX = Math.min(this.width - 1, Math.ceil(Math.max(tx, tx2)) - 1);
      const startY = Math.max(0, Math.floor(Math.min(ty, ty2)));
      const endY = Math.min(this.height - 1, Math.ceil(Math.max(ty, ty2)) - 1);

      for (let py = startY; py <= endY; py++) {
        for (let px = startX; px <= endX; px++) {
          this.setPixel(px, py, r, g, b, a);
        }
      }
    }
  }

  /**
   * Stroke rectangle
   */
  strokeRect(x: number, y: number, width: number, height: number): void {
    if (this.ctx) {
      this.ctx.strokeRect(x, y, width, height);
    } else if (this.pixelBuffer) {
      const [r, g, b, a] = this.parseColor(this.strokeStyle);
      const [x0, y0] = this.transformPoint(x, y);
      const [x1, y1] = this.transformPoint(x + width, y + height);

      // Draw four edges
      this.drawLine(x0, y0, x1, y0, r, g, b, a); // top
      this.drawLine(x1, y0, x1, y1, r, g, b, a); // right
      this.drawLine(x1, y1, x0, y1, r, g, b, a); // bottom
      this.drawLine(x0, y1, x0, y0, r, g, b, a); // left
    }
  }

  /**
   * Clear rectangle (set to transparent)
   */
  clearRect(x: number, y: number, width: number, height: number): void {
    if (this.ctx) {
      this.ctx.clearRect(x, y, width, height);
    } else if (this.pixelBuffer) {
      const [tx, ty] = this.transformPoint(x, y);
      const [tx2, ty2] = this.transformPoint(x + width, y + height);

      const startX = Math.max(0, Math.floor(Math.min(tx, tx2)));
      const endX = Math.min(this.width - 1, Math.ceil(Math.max(tx, tx2)) - 1);
      const startY = Math.max(0, Math.floor(Math.min(ty, ty2)));
      const endY = Math.min(this.height - 1, Math.ceil(Math.max(ty, ty2)) - 1);

      for (let py = startY; py <= endY; py++) {
        for (let px = startX; px <= endX; px++) {
          const offset = (py * this.width + px) * 4;
          this.pixelBuffer[offset] = 0;
          this.pixelBuffer[offset + 1] = 0;
          this.pixelBuffer[offset + 2] = 0;
          this.pixelBuffer[offset + 3] = 0;
        }
      }
    }
  }

  /**
   * Fill text at position
   */
  fillText(text: string, x: number, y: number, _maxWidth?: number): void {
    if (this.ctx) {
      this.ctx.fillText(text, x, y, _maxWidth);
    } else if (this.pixelBuffer) {
      const [r, g, b, a] = this.parseColor(this.fillStyle);
      const fontSize = this.parseFontSize(this.font);
      const charWidth = fontSize * 0.6;
      const [tx, ty] = this.transformPoint(x, y);

      for (let i = 0; i < text.length; i++) {
        this.renderBitmapChar(text[i], tx + i * charWidth, ty, fontSize, r, g, b, a);
      }
    }
  }

  /**
   * Stroke text at position
   */
  strokeText(text: string, x: number, y: number, _maxWidth?: number): void {
    if (this.ctx) {
      this.ctx.strokeText(text, x, y, _maxWidth);
    } else if (this.pixelBuffer) {
      // For stroke text, render outline by drawing at slight offsets
      const [r, g, b, a] = this.parseColor(this.strokeStyle);
      const fontSize = this.parseFontSize(this.font);
      const charWidth = fontSize * 0.6;
      const [tx, ty] = this.transformPoint(x, y);

      for (let i = 0; i < text.length; i++) {
        this.renderBitmapChar(text[i], tx + i * charWidth, ty, fontSize, r, g, b, a);
      }
    }
  }

  /**
   * Measure text width
   */
  measureText(text: string): number {
    if (this.ctx) {
      return this.ctx.measureText(text).width;
    }
    // Font-size-aware calculation
    const fontSize = this.parseFontSize(this.font);
    return fontSize * 0.6 * text.length;
  }

  /**
   * Begin path
   */
  beginPath(): void {
    if (this.ctx) {
      this.ctx.beginPath();
    } else {
      this.currentPath = [];
    }
  }

  /**
   * Close path
   */
  closePath(): void {
    if (this.ctx) {
      this.ctx.closePath();
    } else {
      this.currentPath.push({ type: "close" });
    }
  }

  /**
   * Move to point
   */
  moveTo(x: number, y: number): void {
    if (this.ctx) {
      this.ctx.moveTo(x, y);
    } else {
      const [tx, ty] = this.transformPoint(x, y);
      this.currentPath.push({ type: "moveTo", x: tx, y: ty });
    }
  }

  /**
   * Line to point
   */
  lineTo(x: number, y: number): void {
    if (this.ctx) {
      this.ctx.lineTo(x, y);
    } else {
      const [tx, ty] = this.transformPoint(x, y);
      this.currentPath.push({ type: "lineTo", x: tx, y: ty });
    }
  }

  /**
   * Fill current path
   */
  fill(): void {
    if (this.ctx) {
      this.ctx.fill();
    } else if (this.pixelBuffer && this.currentPath.length > 0) {
      const [r, g, b, a] = this.parseColor(this.fillStyle);
      this.scanlineFill(this.currentPath, r, g, b, a);
    }
  }

  /**
   * Stroke current path
   */
  stroke(): void {
    if (this.ctx) {
      this.ctx.stroke();
    } else if (this.pixelBuffer && this.currentPath.length > 0) {
      const [r, g, b, a] = this.parseColor(this.strokeStyle);
      let curX = 0, curY = 0;
      for (const seg of this.currentPath) {
        if (seg.type === "moveTo") {
          curX = seg.x;
          curY = seg.y;
        } else if (seg.type === "lineTo") {
          this.drawLine(curX, curY, seg.x, seg.y, r, g, b, a);
          curX = seg.x;
          curY = seg.y;
        }
      }
    }
  }

  /**
   * Clip to current path
   */
  clip(): void {
    if (this.ctx) {
      this.ctx.clip();
    } else {
      // Compute bounding box of current path as clip bounds
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;
      for (const seg of this.currentPath) {
        if (seg.type === "moveTo" || seg.type === "lineTo") {
          minX = Math.min(minX, seg.x);
          minY = Math.min(minY, seg.y);
          maxX = Math.max(maxX, seg.x);
          maxY = Math.max(maxY, seg.y);
        }
      }
      if (minX <= maxX && minY <= maxY) {
        this.clipBounds = {
          minX: Math.floor(minX),
          minY: Math.floor(minY),
          maxX: Math.ceil(maxX),
          maxY: Math.ceil(maxY),
        };
      }
    }
  }

  /**
   * Save graphics state
   */
  save(): void {
    this.stateStack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      font: this.font,
      globalAlpha: this.globalAlpha,
      transform: [...this.currentTransform],
      clipBounds: this.clipBounds ? { ...this.clipBounds } : null,
    });
    if (this.ctx) {
      this.ctx.save();
    }
  }

  /**
   * Restore graphics state
   */
  restore(): void {
    const state = this.stateStack.pop();
    if (state) {
      this.fillStyle = state.fillStyle;
      this.strokeStyle = state.strokeStyle;
      this.lineWidth = state.lineWidth;
      this.font = state.font;
      this.globalAlpha = state.globalAlpha;
      this.currentTransform = [...state.transform];
      this.clipBounds = state.clipBounds ? { ...state.clipBounds } : null;
    }
    if (this.ctx) {
      this.ctx.restore();
    }
  }

  /**
   * Translate coordinate system
   */
  translate(x: number, y: number): void {
    if (this.ctx) {
      this.ctx.translate(x, y);
    }
    // Always update headless transform
    const [a, b, c, d, e, f] = this.currentTransform;
    this.currentTransform = [a, b, c, d, e + a * x + c * y, f + b * x + d * y];
  }

  /**
   * Scale coordinate system
   */
  scale(x: number, y: number): void {
    if (this.ctx) {
      this.ctx.scale(x, y);
    }
    const [a, b, c, d, e, f] = this.currentTransform;
    this.currentTransform = [a * x, b * x, c * y, d * y, e, f];
  }

  /**
   * Rotate coordinate system
   */
  rotate(angle: number): void {
    if (this.ctx) {
      this.ctx.rotate(angle);
    }
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const [a, b, c, d, e, f] = this.currentTransform;
    this.currentTransform = [
      a * cos + c * sin,
      b * cos + d * sin,
      c * cos - a * sin,
      d * cos - b * sin,
      e,
      f,
    ];
  }

  /**
   * Get pixel data as ImageData
   */
  getImageData(x: number, y: number, width: number, height: number): Uint8Array {
    if (this.ctx) {
      const imageData = this.ctx.getImageData(x, y, width, height);
      return new Uint8Array(imageData.data.buffer);
    }
    if (this.pixelBuffer && width > 0 && height > 0) {
      const result = new Uint8Array(width * height * 4);
      for (let row = 0; row < height; row++) {
        const srcY = y + row;
        if (srcY < 0 || srcY >= this.height) continue;
        for (let col = 0; col < width; col++) {
          const srcX = x + col;
          if (srcX < 0 || srcX >= this.width) continue;
          const srcOffset = (srcY * this.width + srcX) * 4;
          const dstOffset = (row * width + col) * 4;
          result[dstOffset] = this.pixelBuffer[srcOffset];
          result[dstOffset + 1] = this.pixelBuffer[srcOffset + 1];
          result[dstOffset + 2] = this.pixelBuffer[srcOffset + 2];
          result[dstOffset + 3] = this.pixelBuffer[srcOffset + 3];
        }
      }
      return result;
    }
    return new Uint8Array(width * height * 4);
  }

  /**
   * Get canvas dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}
