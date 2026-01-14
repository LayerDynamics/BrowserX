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
}

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
        } else {
            // Stub: In real implementation, this would rasterize to pixel buffer
            console.log(`fillRect(${x}, ${y}, ${width}, ${height}) with ${this.fillStyle}`);
        }
    }

    /**
     * Stroke rectangle
     */
    strokeRect(x: number, y: number, width: number, height: number): void {
        if (this.ctx) {
            this.ctx.strokeRect(x, y, width, height);
        } else {
            console.log(`strokeRect(${x}, ${y}, ${width}, ${height}) with ${this.strokeStyle}`);
        }
    }

    /**
     * Clear rectangle (set to transparent)
     */
    clearRect(x: number, y: number, width: number, height: number): void {
        if (this.ctx) {
            this.ctx.clearRect(x, y, width, height);
        } else {
            console.log(`clearRect(${x}, ${y}, ${width}, ${height})`);
        }
    }

    /**
     * Fill text at position
     */
    fillText(text: string, x: number, y: number, maxWidth?: number): void {
        if (this.ctx) {
            this.ctx.fillText(text, x, y, maxWidth);
        } else {
            console.log(`fillText("${text}", ${x}, ${y}) with font ${this.font}`);
        }
    }

    /**
     * Stroke text at position
     */
    strokeText(text: string, x: number, y: number, maxWidth?: number): void {
        if (this.ctx) {
            this.ctx.strokeText(text, x, y, maxWidth);
        } else {
            console.log(`strokeText("${text}", ${x}, ${y})`);
        }
    }

    /**
     * Measure text width
     */
    measureText(text: string): number {
        if (this.ctx) {
            return this.ctx.measureText(text).width;
        }
        // Stub: rough approximation
        return text.length * 8;
    }

    /**
     * Begin path
     */
    beginPath(): void {
        if (this.ctx) {
            this.ctx.beginPath();
        }
    }

    /**
     * Close path
     */
    closePath(): void {
        if (this.ctx) {
            this.ctx.closePath();
        }
    }

    /**
     * Move to point
     */
    moveTo(x: number, y: number): void {
        if (this.ctx) {
            this.ctx.moveTo(x, y);
        }
    }

    /**
     * Line to point
     */
    lineTo(x: number, y: number): void {
        if (this.ctx) {
            this.ctx.lineTo(x, y);
        }
    }

    /**
     * Fill current path
     */
    fill(): void {
        if (this.ctx) {
            this.ctx.fill();
        }
    }

    /**
     * Stroke current path
     */
    stroke(): void {
        if (this.ctx) {
            this.ctx.stroke();
        }
    }

    /**
     * Clip to current path
     */
    clip(): void {
        if (this.ctx) {
            this.ctx.clip();
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
            transform: [1, 0, 0, 1, 0, 0], // Identity matrix
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
    }

    /**
     * Scale coordinate system
     */
    scale(x: number, y: number): void {
        if (this.ctx) {
            this.ctx.scale(x, y);
        }
    }

    /**
     * Rotate coordinate system
     */
    rotate(angle: number): void {
        if (this.ctx) {
            this.ctx.rotate(angle);
        }
    }

    /**
     * Get pixel data as ImageData
     */
    getImageData(x: number, y: number, width: number, height: number): Uint8Array {
        if (this.ctx) {
            const imageData = this.ctx.getImageData(x, y, width, height);
            return new Uint8Array(imageData.data.buffer);
        }
        // Stub: return empty buffer
        return new Uint8Array(width * height * 4);
    }

    /**
     * Get canvas dimensions
     */
    getDimensions(): { width: number; height: number } {
        return { width: this.width, height: this.height };
    }
}
