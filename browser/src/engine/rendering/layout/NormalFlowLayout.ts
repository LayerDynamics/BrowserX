/**
 * Normal Flow Layout
 * Implements block and inline layout algorithms
 *
 * Normal flow is the default positioning scheme in CSS. Elements are
 * laid out according to their display type (block or inline) and
 * participate in block or inline formatting contexts.
 */

import type { RenderObject } from "../rendering/RenderObject.ts";
import type { RenderBox } from "../rendering/RenderBox.ts";
import type { RenderText } from "../rendering/RenderText.ts";
import type { Pixels } from "../../../types/identifiers.ts";
import type { LayoutConstraints } from "../../../types/rendering.ts";
import { TextLayout, type TextLayoutOptions } from "./TextLayout.ts";

/**
 * Formatting context type
 */
export enum FormattingContext {
    BLOCK, // Block formatting context (vertical stacking)
    INLINE, // Inline formatting context (horizontal flow)
}

/**
 * Inline box (text run or inline element in line)
 */
interface InlineBox {
    renderObject: RenderObject;
    x: Pixels;
    y: Pixels;
    width: Pixels;
    height: Pixels;
    baseline: Pixels;
}

/**
 * Line in inline formatting context
 */
interface Line {
    boxes: InlineBox[];
    y: Pixels;
    width: Pixels;
    height: Pixels;
    baseline: Pixels;
}

/**
 * NormalFlowLayout
 * Implements normal flow layout algorithm for block and inline elements
 */
export class NormalFlowLayout {
    /**
     * Layout children in block formatting context
     * Children stack vertically with margin collapse
     *
     * @param parent - Parent render object
     * @param children - Children to layout
     * @param constraints - Layout constraints
     * @returns Total content height
     */
    layoutBlockChildren(
        parent: RenderBox,
        children: RenderObject[],
        constraints: LayoutConstraints,
    ): Pixels {
        if (!parent.layout) {
            throw new Error("Parent must have layout computed before laying out children");
        }

        const availableWidth = this.getAvailableWidth(parent);
        let currentY = 0 as Pixels;
        let previousMarginBottom = 0 as Pixels;

        for (const child of children) {
            // Create constraints for child
            const childConstraints: LayoutConstraints = {
                minWidth: 0 as Pixels,
                maxWidth: availableWidth,
                minHeight: 0 as Pixels,
                maxHeight: Number.POSITIVE_INFINITY as Pixels,
            };

            // Layout child
            child.doLayout(childConstraints);

            if (!child.layout) {
                continue;
            }

            // Handle margin collapse
            // Adjacent vertical margins collapse to the larger of the two
            const marginTop = child.layout.marginTop;
            const collapsedMargin = Math.max(previousMarginBottom, marginTop) as Pixels;

            // Position child
            const childX = (parent.layout.x +
                parent.layout.paddingLeft +
                child.layout.marginLeft) as Pixels;
            const childY = (parent.layout.y +
                parent.layout.paddingTop +
                currentY +
                collapsedMargin) as Pixels;

            child.setPosition(childX, childY);

            // Update Y position for next child
            // Don't include top margin (already collapsed) or bottom margin (will collapse with next)
            const childHeight = child.layout.getTotalHeight();
            const heightWithoutMargins = (childHeight -
                child.layout.marginTop -
                child.layout.marginBottom) as Pixels;

            currentY = (currentY + collapsedMargin + heightWithoutMargins) as Pixels;
            previousMarginBottom = child.layout.marginBottom;
        }

        // Add final bottom margin to height
        return (currentY + previousMarginBottom) as Pixels;
    }

    /**
     * Layout children in inline formatting context
     * Children flow horizontally with line wrapping
     *
     * @param parent - Parent render object
     * @param children - Children to layout
     * @param constraints - Layout constraints
     * @returns Total content height
     */
    layoutInlineChildren(
        parent: RenderBox,
        children: RenderObject[],
        constraints: LayoutConstraints,
    ): Pixels {
        if (!parent.layout) {
            throw new Error("Parent must have layout computed before laying out children");
        }

        const availableWidth = this.getAvailableWidth(parent);
        const lines = this.buildLines(parent, children, availableWidth);

        // Position lines vertically
        let currentY = 0 as Pixels;
        for (const line of lines) {
            line.y = currentY;

            // Position boxes in line
            for (const box of line.boxes) {
                const finalX = (parent.layout.x + parent.layout.paddingLeft + box.x) as Pixels;
                const finalY = (parent.layout.y + parent.layout.paddingTop + currentY +
                    (line.baseline - box.baseline)) as Pixels;

                box.renderObject.setPosition(finalX, finalY);
            }

            currentY = (currentY + line.height) as Pixels;
        }

        return currentY;
    }

    /**
     * Build lines for inline formatting context
     * Groups inline boxes into lines, wrapping when necessary
     */
    private buildLines(
        parent: RenderBox,
        children: RenderObject[],
        availableWidth: Pixels,
    ): Line[] {
        const lines: Line[] = [];
        let currentLine: InlineBox[] = [];
        let currentLineWidth = 0 as Pixels;
        let currentLineHeight = 0 as Pixels;
        let currentLineBaseline = 0 as Pixels;

        for (const child of children) {
            // Layout child to get dimensions
            const childConstraints: LayoutConstraints = {
                minWidth: 0 as Pixels,
                maxWidth: availableWidth,
                minHeight: 0 as Pixels,
                maxHeight: Number.POSITIVE_INFINITY as Pixels,
            };

            child.doLayout(childConstraints);

            if (!child.layout) {
                continue;
            }

            const childWidth = child.layout.getTotalWidth();
            const childHeight = child.layout.getTotalHeight();

            // Calculate baseline for this box
            // For text, baseline is ~80% down from top
            // For inline boxes, baseline is at bottom of content box
            const baseline = this.calculateBaseline(child);

            // Check if child fits on current line
            if (currentLineWidth + childWidth > availableWidth && currentLine.length > 0) {
                // Finalize current line and start new one
                lines.push({
                    boxes: currentLine,
                    y: 0 as Pixels, // Will be set later
                    width: currentLineWidth,
                    height: currentLineHeight,
                    baseline: currentLineBaseline,
                });

                currentLine = [];
                currentLineWidth = 0 as Pixels;
                currentLineHeight = 0 as Pixels;
                currentLineBaseline = 0 as Pixels;
            }

            // Add box to current line
            const box: InlineBox = {
                renderObject: child,
                x: currentLineWidth,
                y: 0 as Pixels, // Relative to line, will be adjusted
                width: childWidth,
                height: childHeight,
                baseline,
            };

            currentLine.push(box);
            currentLineWidth = (currentLineWidth + childWidth) as Pixels;
            currentLineHeight = Math.max(currentLineHeight, childHeight) as Pixels;
            currentLineBaseline = Math.max(currentLineBaseline, baseline) as Pixels;
        }

        // Add final line
        if (currentLine.length > 0) {
            lines.push({
                boxes: currentLine,
                y: 0 as Pixels,
                width: currentLineWidth,
                height: currentLineHeight,
                baseline: currentLineBaseline,
            });
        }

        return lines;
    }

    /**
     * Calculate baseline for an inline box
     */
    private calculateBaseline(renderObject: RenderObject): Pixels {
        if (!renderObject.layout) {
            return 0 as Pixels;
        }

        // For text, baseline is ~80% down
        // For inline boxes, baseline is at bottom of content
        const isText = renderObject.constructor.name === "RenderText";

        if (isText) {
            return (renderObject.layout.height * 0.8) as Pixels;
        } else {
            // For inline boxes, baseline is at the bottom of the content box
            return renderObject.layout.height as Pixels;
        }
    }

    /**
     * Get available width for children
     * Accounts for padding
     */
    private getAvailableWidth(parent: RenderBox): Pixels {
        if (!parent.layout) {
            return 0 as Pixels;
        }

        return (parent.layout.width -
            parent.layout.paddingLeft -
            parent.layout.paddingRight) as Pixels;
    }

    /**
     * Determine formatting context for element
     */
    getFormattingContext(renderObject: RenderObject): FormattingContext {
        const display = renderObject.style.getPropertyValue("display");

        switch (display) {
            case "block":
            case "flex":
            case "grid":
            case "table":
            case "list-item":
            case "flow-root":
                return FormattingContext.BLOCK;

            case "inline":
            case "inline-block":
            case "inline-flex":
            case "inline-grid":
                return FormattingContext.INLINE;

            default:
                return FormattingContext.BLOCK;
        }
    }

    /**
     * Check if element establishes new block formatting context
     * BFC is established by:
     * - Root element
     * - Floats
     * - Absolutely positioned elements
     * - Inline-blocks
     * - Table cells
     * - Elements with overflow other than visible
     * - Flex/grid items
     * - Flow-root
     */
    establishesBlockFormattingContext(renderObject: RenderObject): boolean {
        // Root element always creates BFC
        if (!renderObject.parent) {
            return true;
        }

        const display = renderObject.style.getPropertyValue("display");
        const position = renderObject.style.getPropertyValue("position");
        const float = renderObject.style.getPropertyValue("float");
        const overflow = renderObject.style.getPropertyValue("overflow");

        // Display types that create BFC
        if (
            display === "inline-block" ||
            display === "table-cell" ||
            display === "table-caption" ||
            display === "flow-root"
        ) {
            return true;
        }

        // Positioned elements (except relative)
        if (position === "absolute" || position === "fixed") {
            return true;
        }

        // Floats
        if (float === "left" || float === "right") {
            return true;
        }

        // Overflow other than visible
        if (
            overflow === "hidden" ||
            overflow === "scroll" ||
            overflow === "auto"
        ) {
            return true;
        }

        // Flex/grid items
        if (renderObject.parent) {
            const parentDisplay = renderObject.parent.style.getPropertyValue("display");
            if (
                parentDisplay === "flex" ||
                parentDisplay === "inline-flex" ||
                parentDisplay === "grid" ||
                parentDisplay === "inline-grid"
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Layout text content using TextLayout
     *
     * @param renderText - RenderText object
     * @param maxWidth - Maximum width for text
     * @returns Layout result with line boxes
     */
    layoutText(renderText: RenderText, maxWidth: Pixels): void {
        // Get text layout options from computed style
        const options: TextLayoutOptions = {
            fontSize: renderText.getPixelValue("font-size", 16 as Pixels),
            fontFamily: renderText.style.getPropertyValue("font-family") || "sans-serif",
            lineHeight: renderText.getPixelValue(
                "line-height",
                (renderText.getPixelValue("font-size", 16 as Pixels) * 1.2) as Pixels,
            ),
            whiteSpace: renderText.style.getPropertyValue("white-space") || "normal",
            wordBreak: renderText.style.getPropertyValue("word-break") || "normal",
            overflowWrap: renderText.style.getPropertyValue("overflow-wrap") || "normal",
        };

        const textLayout = new TextLayout(options);
        const text = renderText.getText();
        const result = textLayout.layout(text, maxWidth);

        // Apply layout result to render text
        // For now, use simplified single-line approach
        // (Full multi-line text would need line box support in RenderText)
        if (result.lines.length > 0) {
            const firstLine = result.lines[0];
            if (renderText.layout) {
                renderText.layout.width = firstLine.width;
                renderText.layout.height = result.totalHeight;
            }
        }
    }

    /**
     * Calculate collapsed margin between two adjacent blocks
     *
     * @param margin1 - First margin
     * @param margin2 - Second margin
     * @returns Collapsed margin value
     */
    collapseMargins(margin1: Pixels, margin2: Pixels): Pixels {
        // Positive margins: take max
        if (margin1 >= 0 && margin2 >= 0) {
            return Math.max(margin1, margin2) as Pixels;
        }

        // Negative margins: take min (most negative)
        if (margin1 < 0 && margin2 < 0) {
            return Math.min(margin1, margin2) as Pixels;
        }

        // One positive, one negative: sum them
        return (margin1 + margin2) as Pixels;
    }

    /**
     * Calculate shrink-to-fit width
     * Used for floats, absolutely positioned elements, inline-blocks
     *
     * @param renderObject - Render object to calculate width for
     * @param availableWidth - Available width
     * @returns Preferred width
     */
    calculateShrinkToFitWidth(
        renderObject: RenderObject,
        availableWidth: Pixels,
    ): Pixels {
        // Simplified implementation
        // Real implementation would calculate:
        // 1. Preferred width (widest line without breaking)
        // 2. Minimum width (narrowest possible with breaking)
        // Then: min(max(minimum, availableWidth), preferred)

        // For now, just return available width
        return availableWidth;
    }

    /**
     * Handle absolutely positioned element
     * These are removed from normal flow
     */
    layoutAbsolutelyPositioned(
        renderObject: RenderBox,
        containingBlock: RenderBox,
    ): void {
        if (!renderObject.layout || !containingBlock.layout) {
            return;
        }

        // Get position properties
        const top = renderObject.style.getPropertyValue("top");
        const right = renderObject.style.getPropertyValue("right");
        const bottom = renderObject.style.getPropertyValue("bottom");
        const left = renderObject.style.getPropertyValue("left");

        // Calculate position relative to containing block
        let x = containingBlock.layout.x;
        let y = containingBlock.layout.y;

        if (left && left !== "auto") {
            x = (containingBlock.layout.x + renderObject.getPixelValue("left")) as Pixels;
        } else if (right && right !== "auto") {
            x = (containingBlock.layout.x + containingBlock.layout.width -
                renderObject.layout.width -
                renderObject.getPixelValue("right")) as Pixels;
        }

        if (top && top !== "auto") {
            y = (containingBlock.layout.y + renderObject.getPixelValue("top")) as Pixels;
        } else if (bottom && bottom !== "auto") {
            y = (containingBlock.layout.y + containingBlock.layout.height -
                renderObject.layout.height -
                renderObject.getPixelValue("bottom")) as Pixels;
        }

        renderObject.setPosition(x, y);
    }

    /**
     * Handle floated element
     * Floats are removed from normal flow but affect line box positioning
     */
    layoutFloat(
        renderObject: RenderBox,
        containingBlock: RenderBox,
    ): void {
        if (!renderObject.layout || !containingBlock.layout) {
            return;
        }

        const float = renderObject.style.getPropertyValue("float");

        if (float === "left") {
            // Position at left edge of containing block
            const x = (containingBlock.layout.x + containingBlock.layout.paddingLeft) as Pixels;
            const y = (containingBlock.layout.y + containingBlock.layout.paddingTop) as Pixels;
            renderObject.setPosition(x, y);
        } else if (float === "right") {
            // Position at right edge of containing block
            const x = (containingBlock.layout.x +
                containingBlock.layout.width -
                renderObject.layout.width -
                containingBlock.layout.paddingRight) as Pixels;
            const y = (containingBlock.layout.y + containingBlock.layout.paddingTop) as Pixels;
            renderObject.setPosition(x, y);
        }
    }
}
