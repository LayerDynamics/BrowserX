/**
 * RenderBlock - Block-level boxes
 *
 * Implements block formatting context where children stack vertically.
 * Handles margin collapse and block layout algorithm.
 */

import { RenderBox } from "./RenderBox.ts";
import type { Pixels } from "../../../types/identifiers.ts";
import type { DOMElement } from "../../../types/dom.ts";
import type { ComputedStyle } from "../../../types/css.ts";
import type { LayoutConstraints } from "../../../types/rendering.ts";

/**
 * RenderBlock - Block-level element
 *
 * Block elements stack vertically and expand to fill available width.
 * Examples: div, p, h1, section, article
 */
export class RenderBlock extends RenderBox {
    constructor(element: DOMElement, style: ComputedStyle) {
        super(element, style);
    }

    /**
     * Layout children in block formatting context
     * Children are stacked vertically with margin collapse
     */
    protected override layoutChildren(constraints: LayoutConstraints): void {
        if (!this.layout) return;

        const availableWidth = this.getAvailableWidth();
        let currentY = 0 as Pixels;
        let previousMarginBottom = 0 as Pixels;

        for (const child of this.children) {
            // Create constraints for child
            const childConstraints: LayoutConstraints = {
                minWidth: 0 as Pixels,
                maxWidth: availableWidth,
                minHeight: 0 as Pixels,
                maxHeight: Number.POSITIVE_INFINITY as Pixels,
            };

            // Layout child
            child.doLayout(childConstraints);

            if (!child.layout) continue;

            // Calculate vertical position with margin collapse
            const marginTop = child.layout.marginTop;
            const collapsedMargin = Math.max(previousMarginBottom, marginTop) as Pixels;

            // Position child
            child.setPosition(
                (this.layout.x + this.layout.paddingLeft + child.layout.marginLeft) as Pixels,
                (this.layout.y + this.layout.paddingTop + currentY + collapsedMargin) as Pixels,
            );

            // Update current Y for next child
            currentY = (currentY + collapsedMargin + child.layout.getTotalHeight() -
                child.layout.marginTop - child.layout.marginBottom) as Pixels;
            previousMarginBottom = child.layout.marginBottom;
        }

        // Update our height if auto
        if (this.style.getPropertyValue("height") === "auto") {
            // Height is sum of all children
            const contentHeight = (currentY + previousMarginBottom) as Pixels;
            this.layout.height = contentHeight;
        }
    }

    /**
     * Check if this creates a new block formatting context
     */
    createsBlockFormattingContext(): boolean {
        const overflow = this.style.getPropertyValue("overflow");
        const display = this.style.getPropertyValue("display");
        const position = this.style.getPropertyValue("position");
        const float = this.style.getPropertyValue("float");

        return overflow !== "visible" ||
            display === "flow-root" ||
            display === "inline-block" ||
            position === "absolute" ||
            position === "fixed" ||
            float !== "none";
    }
}
