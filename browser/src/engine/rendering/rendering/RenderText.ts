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
import type { LayoutBox, LayoutConstraints, PaintContext } from "../../../types/rendering.ts";

/**
 * Simple LayoutBox for text (doesn't use full box model)
 * Text nodes don't have padding, border, or margin - just position and size
 */
class TextLayoutBox implements LayoutBox {
  x: Pixels = 0 as Pixels;
  y: Pixels = 0 as Pixels;
  width: Pixels = 0 as Pixels;
  height: Pixels = 0 as Pixels;

  // Style and content — populated from RenderText during layout
  style?: ComputedStyle;
  type?: string;
  text?: string;
  children?: import("../../../types/rendering.ts").LayoutBox[];

  // Text nodes don't have padding, border, or margin
  paddingTop: Pixels = 0 as Pixels;
  paddingRight: Pixels = 0 as Pixels;
  paddingBottom: Pixels = 0 as Pixels;
  paddingLeft: Pixels = 0 as Pixels;
  borderTopWidth: Pixels = 0 as Pixels;
  borderRightWidth: Pixels = 0 as Pixels;
  borderBottomWidth: Pixels = 0 as Pixels;
  borderLeftWidth: Pixels = 0 as Pixels;
  marginTop: Pixels = 0 as Pixels;
  marginRight: Pixels = 0 as Pixels;
  marginBottom: Pixels = 0 as Pixels;
  marginLeft: Pixels = 0 as Pixels;

  /**
   * Get content box dimensions
   */
  getContentBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels } {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Get padding box dimensions (same as content for text)
   */
  getPaddingBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels } {
    return this.getContentBox();
  }

  /**
   * Get border box dimensions (same as content for text)
   */
  getBorderBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels } {
    return this.getContentBox();
  }

  /**
   * Get margin box dimensions (same as content for text)
   */
  getMarginBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels } {
    return this.getContentBox();
  }

  /**
   * Get total width (text has no margin/border/padding, just content width)
   */
  getTotalWidth(): Pixels {
    return this.width;
  }

  /**
   * Get total height (text has no margin/border/padding, just content height)
   */
  getTotalHeight(): Pixels {
    return this.height;
  }
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

    // Populate style and content so LayoutBox tree walkers can read them
    this.textLayout.style = this.style;
    this.textLayout.type = "text";
    this.textLayout.text = this.text;

    // Store in layout property for consistency
    this.layout = this.textLayout;

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
