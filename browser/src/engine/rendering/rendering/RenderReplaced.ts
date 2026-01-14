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

        if (tagName === "img" && src) {
            // Draw image
            context.drawImage(
                src,
                this.layout.x,
                this.layout.y,
                this.layout.width,
                this.layout.height,
            );
        } else if (tagName === "canvas") {
            // Canvas would be rendered by its own context
            // For now, just draw a placeholder border
            context.strokeRect(
                this.layout.x,
                this.layout.y,
                this.layout.width,
                this.layout.height,
                "#ccc",
                1 as Pixels,
            );
        } else if (tagName === "video" && src) {
            // Video would need video frame rendering
            // For now, draw placeholder
            context.fillRect(
                this.layout.x,
                this.layout.y,
                this.layout.width,
                this.layout.height,
                "#000",
            );
        } else if (tagName === "iframe" && src) {
            // iframe contains another document
            // For now, draw placeholder
            context.fillRect(
                this.layout.x,
                this.layout.y,
                this.layout.width,
                this.layout.height,
                "#f0f0f0",
            );
        }
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
