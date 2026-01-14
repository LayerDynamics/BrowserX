/**
 * RenderInline - Inline boxes
 *
 * Implements inline formatting context where children flow horizontally
 * and wrap to new lines as needed.
 */

import { RenderBox } from "./RenderBox.ts";
import type { Pixels } from "../../../types/identifiers.ts";
import type { DOMElement } from "../../../types/dom.ts";
import type { ComputedStyle } from "../../../types/css.ts";
import type { LayoutConstraints, PaintContext } from "../../../types/rendering.ts";

/**
 * RenderInline - Inline-level element
 *
 * Inline elements flow horizontally and can wrap to multiple lines.
 * Examples: span, a, strong, em
 */
export class RenderInline extends RenderBox {
    constructor(element: DOMElement, style: ComputedStyle) {
        super(element, style);
    }

    /**
     * Layout children in inline formatting context
     * Children flow horizontally and wrap when needed
     */
    protected override layoutChildren(constraints: LayoutConstraints): void {
        if (!this.layout) return;

        const availableWidth = this.getAvailableWidth();
        let currentX = 0 as Pixels;
        let currentY = 0 as Pixels;
        let lineHeight = 0 as Pixels;

        for (const child of this.children) {
            // Create constraints for child
            const childConstraints: LayoutConstraints = {
                minWidth: 0 as Pixels,
                maxWidth: (availableWidth - currentX) as Pixels,
                minHeight: 0 as Pixels,
                maxHeight: Number.POSITIVE_INFINITY as Pixels,
            };

            // Layout child
            child.doLayout(childConstraints);

            if (!child.layout) continue;

            const childWidth = child.layout.getTotalWidth();
            const childHeight = child.layout.getTotalHeight();

            // Check if child fits on current line
            if (currentX > 0 && currentX + childWidth > availableWidth) {
                // Wrap to next line
                currentX = 0 as Pixels;
                currentY = (currentY + lineHeight) as Pixels;
                lineHeight = 0 as Pixels;
            }

            // Position child
            child.setPosition(
                (this.layout.x + this.layout.paddingLeft + currentX +
                    child.layout.marginLeft) as Pixels,
                (this.layout.y + this.layout.paddingTop + currentY +
                    child.layout.marginTop) as Pixels,
            );

            // Update position for next child
            currentX = (currentX + childWidth) as Pixels;
            lineHeight = Math.max(lineHeight, childHeight) as Pixels;
        }

        // Update our height if auto
        if (this.style.getPropertyValue("height") === "auto") {
            const contentHeight = (currentY + lineHeight) as Pixels;
            this.layout.height = contentHeight;
        }

        // Inline elements don't have explicit width - it's determined by content
        if (this.style.getPropertyValue("width") === "auto") {
            // Width is the maximum line width
            // For simplicity, use currentX (width of last line)
            this.layout.width = currentX;
        }
    }

    /**
     * Paint inline box
     * Inline boxes may have backgrounds and borders around text
     */
    override paint(context: PaintContext): void {
        if (!this.needsPaint || !this.layout) {
            return;
        }

        context.save();

        // Paint background (if any)
        // Inline backgrounds only paint behind content, not full width
        const backgroundColor = this.getColorValue("background-color", "transparent");
        if (backgroundColor !== "transparent") {
            // For simplicity, paint as rectangle
            // Real implementation would paint fragmented boxes for wrapped lines
            const paddingBox = this.layout.getPaddingBox();
            context.fillRect(
                paddingBox.x,
                paddingBox.y,
                paddingBox.width,
                paddingBox.height,
                backgroundColor,
            );
        }

        // Paint children
        for (const child of this.children) {
            child.paint(context);
        }

        context.restore();

        this.needsPaint = false;
    }
}
