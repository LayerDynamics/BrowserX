/**
 * RenderReplaced - Replaced elements (img, video, canvas)
 *
 * Replaced elements are those whose content is external to the CSS.
 * They have intrinsic dimensions and are treated as opaque boxes.
 */

import { RenderBox } from "./RenderBox.ts";
import type { Pixels } from "../../../types/identifiers.ts";
import type { DOMElement } from "../../../types/dom.ts";
import type { ComputedStyle } from "../../../types/css.ts";
import type { LayoutConstraints, PaintContext } from "../../../types/rendering.ts";

/**
 * RenderReplaced - Replaced element
 *
 * Examples: img, video, canvas, iframe, object, embed
 */
export class RenderReplaced extends RenderBox {
  private intrinsicWidth: Pixels = 0 as Pixels;
  private intrinsicHeight: Pixels = 0 as Pixels;
  private intrinsicRatio: number = 0;

  constructor(element: DOMElement, style: ComputedStyle) {
    super(element, style);
    this.loadIntrinsicDimensions();
  }

  /**
   * Load intrinsic dimensions from element attributes
   */
  private loadIntrinsicDimensions(): void {
    const tagName = this.element.tagName?.toLowerCase();

    // Get width/height from attributes
    const widthAttr = this.element.attributes?.get("width");
    const heightAttr = this.element.attributes?.get("height");

    if (widthAttr) {
      this.intrinsicWidth = parseFloat(widthAttr) as Pixels;
    }

    if (heightAttr) {
      this.intrinsicHeight = parseFloat(heightAttr) as Pixels;
    }

    // Default dimensions if not specified
    if (!this.intrinsicWidth || !this.intrinsicHeight) {
      switch (tagName) {
        case "img":
          this.intrinsicWidth = this.intrinsicWidth || (300 as Pixels);
          this.intrinsicHeight = this.intrinsicHeight || (150 as Pixels);
          break;
        case "video":
          this.intrinsicWidth = this.intrinsicWidth || (640 as Pixels);
          this.intrinsicHeight = this.intrinsicHeight || (360 as Pixels);
          break;
        case "canvas":
          this.intrinsicWidth = this.intrinsicWidth || (300 as Pixels);
          this.intrinsicHeight = this.intrinsicHeight || (150 as Pixels);
          break;
        case "iframe":
          this.intrinsicWidth = this.intrinsicWidth || (300 as Pixels);
          this.intrinsicHeight = this.intrinsicHeight || (150 as Pixels);
          break;
        default:
          this.intrinsicWidth = 0 as Pixels;
          this.intrinsicHeight = 0 as Pixels;
      }
    }

    // Calculate intrinsic ratio
    if (this.intrinsicWidth > 0 && this.intrinsicHeight > 0) {
      this.intrinsicRatio = this.intrinsicWidth / this.intrinsicHeight;
    }
  }

  /**
   * Compute box model with intrinsic dimensions
   */
  protected override computeBoxModel(constraints: LayoutConstraints): void {
    if (!this.layout) return;

    // Call parent to set margins, borders, padding
    super.computeBoxModel(constraints);

    // Populate src on LayoutBox so the paint path can emit DRAW_IMAGE
    const src = this.element.attributes?.get("src");
    if (src) {
      this.layout!.src = src;
    }

    // Handle replaced element sizing
    const widthValue = this.style.getPropertyValue("width");
    const heightValue = this.style.getPropertyValue("height");

    const hasWidth = widthValue && widthValue !== "auto";
    const hasHeight = heightValue && heightValue !== "auto";

    if (hasWidth && hasHeight) {
      // Both specified - use them
      this.layout.width = this.getPixelValue("width");
      this.layout.height = this.getPixelValue("height");
    } else if (hasWidth && !hasHeight) {
      // Width specified, height auto - preserve aspect ratio
      this.layout.width = this.getPixelValue("width");
      if (this.intrinsicRatio > 0) {
        this.layout.height = (this.layout.width / this.intrinsicRatio) as Pixels;
      } else {
        this.layout.height = this.intrinsicHeight;
      }
    } else if (!hasWidth && hasHeight) {
      // Height specified, width auto - preserve aspect ratio
      this.layout.height = this.getPixelValue("height");
      if (this.intrinsicRatio > 0) {
        this.layout.width = (this.layout.height * this.intrinsicRatio) as Pixels;
      } else {
        this.layout.width = this.intrinsicWidth;
      }
    } else {
      // Both auto - use intrinsic dimensions
      this.layout.width = this.intrinsicWidth;
      this.layout.height = this.intrinsicHeight;
    }

    // Apply width/height constraints
    const minWidth = this.getPixelValue("min-width");
    const maxWidth = this.getPixelValue("max-width", constraints.maxWidth);
    const minHeight = this.getPixelValue("min-height");
    const maxHeight = this.getPixelValue("max-height", constraints.maxHeight);

    if (minWidth > 0) {
      this.layout.width = Math.max(this.layout.width, minWidth) as Pixels;
    }
    if (maxWidth > 0 && maxWidth < Number.POSITIVE_INFINITY) {
      this.layout.width = Math.min(this.layout.width, maxWidth) as Pixels;
    }
    if (minHeight > 0) {
      this.layout.height = Math.max(this.layout.height, minHeight) as Pixels;
    }
    if (maxHeight > 0 && maxHeight < Number.POSITIVE_INFINITY) {
      this.layout.height = Math.min(this.layout.height, maxHeight) as Pixels;
    }
  }

  /**
   * Replaced elements don't have children
   */
  protected override layoutChildren(constraints: LayoutConstraints): void {
    // Replaced elements don't layout children
  }

  /**
   * Paint replaced element
   */
  override paint(context: PaintContext): void {
    if (!this.needsPaint || !this.layout) {
      return;
    }

    context.save();

    // Paint background and borders (from parent)
    this.paintBackground(context);
    this.paintBorders(context);

    // Paint replaced content
    this.paintReplacedContent(context);

    context.restore();

    this.needsPaint = false;
  }

  /**
   * Paint the actual replaced content
   */
  private paintReplacedContent(context: PaintContext): void {
    if (!this.layout) return;

    const tagName = this.element.tagName?.toLowerCase();
    const src = this.element.attributes?.get("src");

    switch (tagName) {
      case "img":
        this.paintImage(context, src);
        break;
      case "canvas":
        this.paintCanvasPlaceholder(context);
        break;
      case "video":
        this.paintVideoPlaceholder(context, src);
        break;
      case "iframe":
        this.paintIframePlaceholder(context, src);
        break;
      case "object":
      case "embed":
        this.paintObjectPlaceholder(context);
        break;
      default:
        // Generic replaced element placeholder
        this.paintGenericPlaceholder(context);
    }
  }

  /**
   * Paint image or image placeholder
   */
  private paintImage(context: PaintContext, src: string | undefined): void {
    if (!this.layout) return;

    if (src) {
      // Draw actual image
      context.drawImage(
        src,
        this.layout.x,
        this.layout.y,
        this.layout.width,
        this.layout.height,
      );
    } else {
      // No src - draw broken image placeholder
      this.paintBrokenImagePlaceholder(context);
    }
  }

  /**
   * Paint broken/missing image placeholder with alt text
   */
  private paintBrokenImagePlaceholder(context: PaintContext): void {
    if (!this.layout) return;

    const x = this.layout.x;
    const y = this.layout.y;
    const w = this.layout.width;
    const h = this.layout.height;

    // Light gray background
    context.fillRect(x, y, w, h, "#f0f0f0");

    // Border
    context.strokeRect(x, y, w, h, "#ccc", 1 as Pixels);

    // Draw broken image icon (simple X)
    const iconSize = Math.min(w, h, 24);
    const iconX = x + (w - iconSize) / 2;
    const iconY = y + (h - iconSize) / 2;

    // Draw X mark for broken image using strokeRect for line segments
    // Diagonal line 1 (top-left to bottom-right approximated with small rects)
    const lineWidth = 2 as Pixels;
    for (let i = 0; i < iconSize; i += 3) {
      context.strokeRect(
        (iconX + i) as Pixels,
        (iconY + i) as Pixels,
        lineWidth,
        lineWidth,
        "#999",
        1 as Pixels,
      );
      // Diagonal line 2 (top-right to bottom-left)
      context.strokeRect(
        (iconX + iconSize - i - lineWidth) as Pixels,
        (iconY + i) as Pixels,
        lineWidth,
        lineWidth,
        "#999",
        1 as Pixels,
      );
    }

    // Alt text if available and fits
    const altText = this.element.attributes?.get("alt");
    if (altText && h > 30 && w > 50) {
      const textY = (y + h - 8) as Pixels;
      const truncatedAlt = altText.length > 20 ? altText.slice(0, 17) + "..." : altText;
      context.fillText(truncatedAlt, (x + 4) as Pixels, textY, "10px sans-serif", "#666");
    }
  }

  /**
   * Paint canvas placeholder
   */
  private paintCanvasPlaceholder(context: PaintContext): void {
    if (!this.layout) return;

    // Transparent by default per HTML5 spec
    context.fillRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      "rgba(0,0,0,0)",
    );

    // Draw subtle border to indicate canvas bounds
    context.strokeRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      "#e0e0e0",
      1 as Pixels,
    );
  }

  /**
   * Paint video placeholder with poster or default
   */
  private paintVideoPlaceholder(context: PaintContext, src: string | undefined): void {
    if (!this.layout) return;

    const x = this.layout.x;
    const y = this.layout.y;
    const w = this.layout.width;
    const h = this.layout.height;

    // Check for poster image
    const poster = this.element.attributes?.get("poster");
    if (poster) {
      context.drawImage(poster, x, y, w, h);
    } else {
      // Black background for video
      context.fillRect(x, y, w, h, "#000");
    }

    // Draw play button triangle
    const buttonSize = Math.min(w, h) * 0.3;
    const centerX = x + w / 2;
    const centerY = y + h / 2;

    // Play button background (square approximation of circle)
    const radius = buttonSize / 2;
    context.fillRect(
      (centerX - radius) as Pixels,
      (centerY - radius) as Pixels,
      buttonSize as Pixels,
      buttonSize as Pixels,
      "rgba(0,0,0,0.6)",
    );

    // Play triangle (simplified as a rect for now)
    const triSize = buttonSize * 0.4;
    context.fillRect(
      (centerX - triSize / 3) as Pixels,
      (centerY - triSize / 2) as Pixels,
      triSize as Pixels,
      triSize as Pixels,
      "#fff",
    );

    // Show duration if available
    if (!src) {
      context.fillText(
        "No video source",
        (x + 8) as Pixels,
        (y + h - 8) as Pixels,
        "12px sans-serif",
        "#fff",
      );
    }
  }

  /**
   * Paint iframe placeholder
   */
  private paintIframePlaceholder(context: PaintContext, src: string | undefined): void {
    if (!this.layout) return;

    const x = this.layout.x;
    const y = this.layout.y;
    const w = this.layout.width;
    const h = this.layout.height;

    // Light gray background
    context.fillRect(x, y, w, h, "#f5f5f5");

    // Border
    context.strokeRect(x, y, w, h, "#ddd", 1 as Pixels);

    // Show iframe icon/text
    if (h > 40 && w > 80) {
      const text = src ? new URL(src).hostname : "iframe";
      context.fillText(
        text.slice(0, 30),
        (x + 8) as Pixels,
        (y + h / 2) as Pixels,
        "11px sans-serif",
        "#888",
      );
    }
  }

  /**
   * Paint object/embed placeholder
   */
  private paintObjectPlaceholder(context: PaintContext): void {
    if (!this.layout) return;

    // Gray background
    context.fillRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      "#e8e8e8",
    );

    // Border
    context.strokeRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      "#ccc",
      1 as Pixels,
    );

    // Plugin icon placeholder
    if (this.layout.height > 30 && this.layout.width > 60) {
      context.fillText(
        "Plugin content",
        (this.layout.x + 8) as Pixels,
        (this.layout.y + this.layout.height / 2) as Pixels,
        "10px sans-serif",
        "#666",
      );
    }
  }

  /**
   * Paint generic placeholder for unknown replaced elements
   */
  private paintGenericPlaceholder(context: PaintContext): void {
    if (!this.layout) return;

    // Light background
    context.fillRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      "#fafafa",
    );

    // Dashed border
    context.strokeRect(
      this.layout.x,
      this.layout.y,
      this.layout.width,
      this.layout.height,
      "#ddd",
      1 as Pixels,
    );
  }

  /**
   * Get intrinsic dimensions
   */
  getIntrinsicDimensions(): { width: Pixels; height: Pixels; ratio: number } {
    return {
      width: this.intrinsicWidth,
      height: this.intrinsicHeight,
      ratio: this.intrinsicRatio,
    };
  }
}
