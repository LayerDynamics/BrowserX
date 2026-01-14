/**
 * RenderText - Text runs with font metrics
 *
 * Represents text content in the render tree.
 * Handles text measurement, line breaking, and text rendering.
 */

import { RenderObject } from "./RenderObject.ts";
import type { Pixels } from "../../../types/identifiers.ts";
import type { DOMElement } from "../../../types/dom.ts";
import type { ComputedStyle } from "../../../types/css.ts";
import type { LayoutConstraints, PaintContext } from "../../../types/rendering.ts";

/**
 * Simple LayoutBox for text (doesn't use full box model)
 */
class TextLayoutBox {
    x: Pixels = 0 as Pixels;
    y: Pixels = 0 as Pixels;
    width: Pixels = 0 as Pixels;
    height: Pixels = 0 as Pixels;
}

/**
 * RenderText - Text node
 *
 * Renders actual text content. Does not have children.
 */
export class RenderText extends RenderObject {
    private text: string;
    private textLayout: TextLayoutBox | null = null;

    constructor(element: DOMElement, style: ComputedStyle, text: string) {
        super(element, style);
        this.text = text;
    }

    /**
     * Get text content
     */
    getText(): string {
        return this.text;
    }

    /**
     * Set text content
     */
    setText(text: string): void {
        this.text = text;
        this.markNeedsLayout();
    }

    /**
     * Perform layout for text
     */
    doLayout(constraints: LayoutConstraints): void {
        if (!this.needsLayout) {
            return;
        }

        // Create text layout box
        if (!this.textLayout) {
            this.textLayout = new TextLayoutBox();
        }

        // Measure text
        const metrics = this.measureText(this.text, constraints.maxWidth);
        this.textLayout.width = metrics.width;
        this.textLayout.height = metrics.height;

        // Store in layout property for consistency
        this.layout = this.textLayout as any;

        this.needsLayout = false;
        this.markNeedsPaint();
    }

    /**
     * Measure text dimensions
     * This is a simplified implementation - real browsers use complex font metrics
     */
    private measureText(text: string, maxWidth: Pixels): { width: Pixels; height: Pixels } {
        // Get font properties
        const fontSize = this.getPixelValue("font-size", 16 as Pixels);
        const fontFamily = this.style.getPropertyValue("font-family") || "sans-serif";

        // Simple character-based width estimation
        // Real implementation would use actual font metrics (canvas measureText, etc.)
        const avgCharWidth = fontSize * 0.6; // Rough estimate
        const textWidth = Math.min(text.length * avgCharWidth, maxWidth) as Pixels;

        // Height is approximately line-height or font-size
        const lineHeight = this.style.getPropertyValue("line-height");
        let textHeight: Pixels;

        if (lineHeight && lineHeight !== "normal") {
            textHeight = this.getPixelValue("line-height", fontSize);
        } else {
            // Default line-height is ~1.2 * font-size
            textHeight = (fontSize * 1.2) as Pixels;
        }

        return {
            width: textWidth,
            height: textHeight,
        };
    }

    /**
     * Paint text
     */
    override paint(context: PaintContext): void {
        if (!this.needsPaint || !this.textLayout) {
            return;
        }

        // Get text properties
        const color = this.getColorValue("color", "black");
        const fontSize = this.getPixelValue("font-size", 16 as Pixels);
        const fontFamily = this.style.getPropertyValue("font-family") || "sans-serif";
        const fontWeight = this.style.getPropertyValue("font-weight") || "normal";
        const fontStyle = this.style.getPropertyValue("font-style") || "normal";

        // Build font string
        const font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

        // Calculate baseline position (text is drawn from baseline)
        const baselineY = (this.textLayout.y + this.textLayout.height * 0.8) as Pixels;

        // Draw text
        context.fillText(
            this.text,
            this.textLayout.x,
            baselineY,
            font,
            color,
        );

        this.needsPaint = false;
    }

    /**
     * Set text position
     */
    setPosition(x: Pixels, y: Pixels): void {
        if (!this.textLayout) return;
        this.textLayout.x = x;
        this.textLayout.y = y;
        this.markNeedsPaint();
    }

    /**
     * Get text width
     */
    getWidth(): Pixels {
        return this.textLayout?.width || (0 as Pixels);
    }

    /**
     * Get text height
     */
    getHeight(): Pixels {
        return this.textLayout?.height || (0 as Pixels);
    }

    /**
     * Text nodes don't have children
     */
    override appendChild(child: RenderObject): void {
        throw new Error("Text nodes cannot have children");
    }

    /**
     * Get debug string
     */
    override toString(): string {
        const preview = this.text.length > 20 ? this.text.substring(0, 20) + "..." : this.text;
        return `RenderText("${preview}")`;
    }
}
