/**
 * RenderBox - Box model representation
 *
 * Implements the CSS box model with content, padding, border, and margin boxes.
 * This is the base class for most rendered elements (blocks, inlines, replaced).
 */

import { RenderObject } from "./RenderObject.ts";
import type { Pixels } from "../../../types/identifiers.ts";
import type { DOMElement } from "../../../types/dom.ts";
import type { ComputedStyle } from "../../../types/css.ts";
import type { LayoutBox, LayoutConstraints, PaintContext } from "../../../types/rendering.ts";

/**
 * LayoutBox implementation
 */
class LayoutBoxImpl implements LayoutBox {
  x: Pixels;
  y: Pixels;
  width: Pixels;
  height: Pixels;

  paddingTop: Pixels;
  paddingRight: Pixels;
  paddingBottom: Pixels;
  paddingLeft: Pixels;

  borderTopWidth: Pixels;
  borderRightWidth: Pixels;
  borderBottomWidth: Pixels;
  borderLeftWidth: Pixels;

  marginTop: Pixels;
  marginRight: Pixels;
  marginBottom: Pixels;
  marginLeft: Pixels;

  // Style and content — populated from RenderObject during layout
  style?: ComputedStyle;
  type?: string;
  text?: string;
  src?: string;
  children?: LayoutBox[];

  constructor() {
    this.x = 0 as Pixels;
    this.y = 0 as Pixels;
    this.width = 0 as Pixels;
    this.height = 0 as Pixels;

    this.paddingTop = 0 as Pixels;
    this.paddingRight = 0 as Pixels;
    this.paddingBottom = 0 as Pixels;
    this.paddingLeft = 0 as Pixels;

    this.borderTopWidth = 0 as Pixels;
    this.borderRightWidth = 0 as Pixels;
    this.borderBottomWidth = 0 as Pixels;
    this.borderLeftWidth = 0 as Pixels;

    this.marginTop = 0 as Pixels;
    this.marginRight = 0 as Pixels;
    this.marginBottom = 0 as Pixels;
    this.marginLeft = 0 as Pixels;
  }

  getContentBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels } {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };
  }

  getPaddingBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels } {
    return {
      x: (this.x - this.paddingLeft) as Pixels,
      y: (this.y - this.paddingTop) as Pixels,
      width: (this.width + this.paddingLeft + this.paddingRight) as Pixels,
      height: (this.height + this.paddingTop + this.paddingBottom) as Pixels,
    };
  }

  getBorderBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels } {
    return {
      x: (this.x - this.paddingLeft - this.borderLeftWidth) as Pixels,
      y: (this.y - this.paddingTop - this.borderTopWidth) as Pixels,
      width: (this.width + this.paddingLeft + this.paddingRight + this.borderLeftWidth +
        this.borderRightWidth) as Pixels,
      height: (this.height + this.paddingTop + this.paddingBottom + this.borderTopWidth +
        this.borderBottomWidth) as Pixels,
    };
  }

  getMarginBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels } {
    return {
      x: (this.x - this.paddingLeft - this.borderLeftWidth - this.marginLeft) as Pixels,
      y: (this.y - this.paddingTop - this.borderTopWidth - this.marginTop) as Pixels,
      width: (this.width + this.paddingLeft + this.paddingRight + this.borderLeftWidth +
        this.borderRightWidth + this.marginLeft + this.marginRight) as Pixels,
      height: (this.height + this.paddingTop + this.paddingBottom + this.borderTopWidth +
        this.borderBottomWidth + this.marginTop + this.marginBottom) as Pixels,
    };
  }

  getTotalWidth(): Pixels {
    return (this.marginLeft +
      this.borderLeftWidth +
      this.paddingLeft +
      this.width +
      this.paddingRight +
      this.borderRightWidth +
      this.marginRight) as Pixels;
  }

  getTotalHeight(): Pixels {
    return (this.marginTop +
      this.borderTopWidth +
      this.paddingTop +
      this.height +
      this.paddingBottom +
      this.borderBottomWidth +
      this.marginBottom) as Pixels;
  }
}

/**
 * RenderBox - Base class for box-model elements
 */
export class RenderBox extends RenderObject {
  constructor(element: DOMElement, style: ComputedStyle) {
    super(element, style);
  }

  /**
   * Perform layout with given constraints
   */
  doLayout(constraints: LayoutConstraints): void {
    if (!this.needsLayout) {
      return;
    }

    // Create layout box if doesn't exist
    if (!this.layout) {
      this.layout = new LayoutBoxImpl();
    }

    // Populate style and content from this RenderObject so that
    // code walking the LayoutBox tree (e.g. RenderingPipeline.paint())
    // can read background-color, border-color, text, etc.
    const layoutImpl = this.layout as LayoutBoxImpl;
    layoutImpl.style = this.style;

    // Preserve actual display type (block, inline, flex, grid, table, inline-block, etc.)
    layoutImpl.type = this.style.getPropertyValue("display") || "block";

    // Extract box model properties from computed style
    this.computeBoxModel(constraints);

    // Layout children (subclasses override this)
    this.layoutChildren(constraints);

    // After children are laid out, populate children LayoutBox references
    const childLayouts: LayoutBox[] = [];
    for (const child of this.children) {
      if (child.layout) {
        childLayouts.push(child.layout);
      }
    }
    if (childLayouts.length > 0) {
      layoutImpl.children = childLayouts;
    }

    this.needsLayout = false;
    this.markNeedsPaint();
  }

  /**
   * Compute box model dimensions from style
   */
  protected computeBoxModel(constraints: LayoutConstraints): void {
    if (!this.layout) return;

    // Margins
    this.layout.marginTop = this.getPixelValue("margin-top");
    this.layout.marginRight = this.getPixelValue("margin-right");
    this.layout.marginBottom = this.getPixelValue("margin-bottom");
    this.layout.marginLeft = this.getPixelValue("margin-left");

    // Borders
    this.layout.borderTopWidth = this.getPixelValue("border-top-width");
    this.layout.borderRightWidth = this.getPixelValue("border-right-width");
    this.layout.borderBottomWidth = this.getPixelValue("border-bottom-width");
    this.layout.borderLeftWidth = this.getPixelValue("border-left-width");

    // Padding
    this.layout.paddingTop = this.getPixelValue("padding-top");
    this.layout.paddingRight = this.getPixelValue("padding-right");
    this.layout.paddingBottom = this.getPixelValue("padding-bottom");
    this.layout.paddingLeft = this.getPixelValue("padding-left");

    // Width
    const widthValue = this.style.getPropertyValue("width");
    if (widthValue && widthValue !== "auto") {
      this.layout.width = this.getPixelValue("width");
    } else {
      // Auto width - use constraint
      const horizontalSpace = this.layout.marginLeft +
        this.layout.borderLeftWidth +
        this.layout.paddingLeft +
        this.layout.paddingRight +
        this.layout.borderRightWidth +
        this.layout.marginRight;
      this.layout.width = Math.max(0, constraints.maxWidth - horizontalSpace) as Pixels;
    }

    // Apply width constraints
    const minWidth = this.getPixelValue("min-width");
    const maxWidth = this.getPixelValue("max-width", constraints.maxWidth);

    if (minWidth > 0) {
      this.layout.width = Math.max(this.layout.width, minWidth) as Pixels;
    }
    if (maxWidth > 0 && maxWidth < Number.POSITIVE_INFINITY) {
      this.layout.width = Math.min(this.layout.width, maxWidth) as Pixels;
    }

    // Height
    const heightValue = this.style.getPropertyValue("height");
    if (heightValue && heightValue !== "auto") {
      this.layout.height = this.getPixelValue("height");
    } else {
      // Auto height - will be determined by content
      this.layout.height = 0 as Pixels;
    }

    // Apply aspect-ratio: if one dimension is auto and we have a ratio
    const aspectRatio = this.style.getPropertyValue("aspect-ratio");
    if (aspectRatio && aspectRatio !== "auto") {
      const ratio = this.parseAspectRatio(aspectRatio);
      if (ratio > 0) {
        const heightIsAuto = !heightValue || heightValue === "auto";
        const widthIsAuto = !widthValue || widthValue === "auto";

        if (heightIsAuto && !widthIsAuto) {
          // Width set, compute height from ratio
          this.layout.height = (this.layout.width / ratio) as Pixels;
        } else if (widthIsAuto && !heightIsAuto) {
          // Height set, compute width from ratio
          this.layout.width = (this.layout.height * ratio) as Pixels;
        } else if (heightIsAuto && widthIsAuto) {
          // Both auto — use width from constraints, compute height
          this.layout.height = (this.layout.width / ratio) as Pixels;
        }
      }
    }

    // Apply height constraints
    const minHeight = this.getPixelValue("min-height");
    const maxHeight = this.getPixelValue("max-height", constraints.maxHeight);

    if (minHeight > 0) {
      this.layout.height = Math.max(this.layout.height, minHeight) as Pixels;
    }
    if (maxHeight > 0 && maxHeight < Number.POSITIVE_INFINITY) {
      this.layout.height = Math.min(this.layout.height, maxHeight) as Pixels;
    }
  }

  /**
   * Parse aspect-ratio value (e.g., "16 / 9", "1.5", "1")
   * Returns width/height ratio, or 0 if invalid
   */
  private parseAspectRatio(value: string): number {
    if (value.includes("/")) {
      const parts = value.split("/").map((s) => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] !== 0) {
        return parts[0] / parts[1];
      }
    }
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Layout children (subclasses override this)
   */
  protected layoutChildren(constraints: LayoutConstraints): void {
    // Base implementation does nothing
    // Subclasses like RenderBlock and RenderInline will override
  }

  /**
   * Paint this box
   */
  paint(context: PaintContext): void {
    if (!this.needsPaint || !this.layout) {
      return;
    }

    // Save context state
    context.save();

    // Paint background
    this.paintBackground(context);

    // Paint borders
    this.paintBorders(context);

    // Paint children
    for (const child of this.children) {
      child.paint(context);
    }

    // Restore context state
    context.restore();

    this.needsPaint = false;
  }

  /**
   * Paint background
   */
  protected paintBackground(context: PaintContext): void {
    if (!this.layout) return;

    const backgroundColor = this.getColorValue("background-color", "transparent");
    if (backgroundColor === "transparent") {
      return;
    }

    const paddingBox = this.layout.getPaddingBox();
    context.fillRect(
      paddingBox.x,
      paddingBox.y,
      paddingBox.width,
      paddingBox.height,
      backgroundColor,
    );
  }

  /**
   * Paint borders
   */
  protected paintBorders(context: PaintContext): void {
    if (!this.layout) return;

    const borderBox = this.layout.getBorderBox();
    const paddingBox = this.layout.getPaddingBox();

    // Top border
    if (this.layout.borderTopWidth > 0) {
      const borderColor = this.getColorValue("border-top-color", "black");
      context.fillRect(
        borderBox.x,
        borderBox.y,
        borderBox.width,
        this.layout.borderTopWidth,
        borderColor,
      );
    }

    // Right border
    if (this.layout.borderRightWidth > 0) {
      const borderColor = this.getColorValue("border-right-color", "black");
      context.fillRect(
        (paddingBox.x + paddingBox.width) as Pixels,
        borderBox.y,
        this.layout.borderRightWidth,
        borderBox.height,
        borderColor,
      );
    }

    // Bottom border
    if (this.layout.borderBottomWidth > 0) {
      const borderColor = this.getColorValue("border-bottom-color", "black");
      context.fillRect(
        borderBox.x,
        (paddingBox.y + paddingBox.height) as Pixels,
        borderBox.width,
        this.layout.borderBottomWidth,
        borderColor,
      );
    }

    // Left border
    if (this.layout.borderLeftWidth > 0) {
      const borderColor = this.getColorValue("border-left-color", "black");
      context.fillRect(
        borderBox.x,
        borderBox.y,
        this.layout.borderLeftWidth,
        borderBox.height,
        borderColor,
      );
    }
  }

  /**
   * Get available width for children (content box width)
   */
  protected getAvailableWidth(): Pixels {
    if (!this.layout) return 0 as Pixels;
    return this.layout.width;
  }

  /**
   * Get available height for children (content box height)
   */
  protected getAvailableHeight(): Pixels {
    if (!this.layout) return 0 as Pixels;
    return this.layout.height;
  }

  /**
   * Set content box position
   */
  setPosition(x: Pixels, y: Pixels): void {
    if (!this.layout) return;
    this.layout.x = x;
    this.layout.y = y;
    this.markNeedsPaint();
  }

  /**
   * Set content box size
   */
  setSize(width: Pixels, height: Pixels): void {
    if (!this.layout) return;
    this.layout.width = width;
    this.layout.height = height;
    this.markNeedsPaint();
  }
}
