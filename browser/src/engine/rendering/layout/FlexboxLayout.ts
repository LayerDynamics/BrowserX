/**
 * Flexbox Layout
 * Implements CSS Flexbox layout algorithm
 *
 * Flexbox is a one-dimensional layout method for arranging items in rows or columns.
 * Items flex (grow/shrink) to fill available space or shrink to fit content.
 */

import type { RenderObject } from "../rendering/RenderObject.ts";
import type { RenderBox } from "../rendering/RenderBox.ts";
import type { Pixels } from "../../../types/identifiers.ts";
import type { LayoutConstraints } from "../../../types/rendering.ts";

/**
 * Flex direction
 */
export enum FlexDirection {
    ROW = "row",
    ROW_REVERSE = "row-reverse",
    COLUMN = "column",
    COLUMN_REVERSE = "column-reverse",
}

/**
 * Flex wrap
 */
export enum FlexWrap {
    NOWRAP = "nowrap",
    WRAP = "wrap",
    WRAP_REVERSE = "wrap-reverse",
}

/**
 * Justify content (main axis alignment)
 */
export enum JustifyContent {
    FLEX_START = "flex-start",
    FLEX_END = "flex-end",
    CENTER = "center",
    SPACE_BETWEEN = "space-between",
    SPACE_AROUND = "space-around",
    SPACE_EVENLY = "space-evenly",
}

/**
 * Align items (cross axis alignment)
 */
export enum AlignItems {
    FLEX_START = "flex-start",
    FLEX_END = "flex-end",
    CENTER = "center",
    STRETCH = "stretch",
    BASELINE = "baseline",
}

/**
 * Flex item with computed properties
 */
interface FlexItem {
    renderObject: RenderBox;
    order: number;
    flexGrow: number;
    flexShrink: number;
    flexBasis: Pixels;
    minSize: Pixels;
    maxSize: Pixels;
    hypotheticalMainSize: Pixels;
    mainSize: Pixels;
    crossSize: Pixels;
}

/**
 * Flex line (when wrapping)
 */
interface FlexLine {
    items: FlexItem[];
    mainSize: Pixels;
    crossSize: Pixels;
}

/**
 * FlexboxLayout
 * Implements the flexbox layout algorithm
 */
export class FlexboxLayout {
    /**
     * Layout flex container and its children
     *
     * @param container - Flex container render object
     * @param children - Flex items
     * @param constraints - Layout constraints
     */
    layoutContainer(
        container: RenderBox,
        children: RenderObject[],
        constraints: LayoutConstraints,
    ): void {
        if (!container.layout) {
            throw new Error("Container must have layout computed");
        }

        // Get flex properties
        const flexDirection = this.getFlexDirection(container);
        const flexWrap = this.getFlexWrap(container);
        const justifyContent = this.getJustifyContent(container);
        const alignItems = this.getAlignItems(container);
        const alignContent = container.style.getPropertyValue("align-content") || "stretch";

        const isRow = flexDirection === FlexDirection.ROW ||
            flexDirection === FlexDirection.ROW_REVERSE;
        const isReverse = flexDirection === FlexDirection.ROW_REVERSE ||
            flexDirection === FlexDirection.COLUMN_REVERSE;

        // Determine main and cross sizes
        const containerMainSize = isRow
            ? (container.layout.width - container.layout.paddingLeft -
                container.layout.paddingRight)
            : (container.layout.height - container.layout.paddingTop -
                container.layout.paddingBottom);
        const containerCrossSize = isRow
            ? (container.layout.height - container.layout.paddingTop -
                container.layout.paddingBottom)
            : (container.layout.width - container.layout.paddingLeft -
                container.layout.paddingRight);

        // Create flex items with order
        let flexItems = this.createFlexItems(children as RenderBox[], isRow);

        // Sort by order property
        flexItems.sort((a, b) => a.order - b.order);

        // Collect items into flex lines
        const lines = this.collectFlexLines(
            flexItems,
            containerMainSize as Pixels,
            flexWrap === FlexWrap.NOWRAP,
        );

        // Resolve flexible lengths for each line
        for (const line of lines) {
            this.resolveFlexibleLengths(line, containerMainSize as Pixels, isRow);
        }

        // Determine cross size of lines
        this.determineCrossSizes(lines, containerCrossSize as Pixels);

        // Align flex lines (align-content)
        const totalCrossSize = lines.reduce(
            (sum, line) => (sum + line.crossSize) as Pixels,
            0 as Pixels,
        );
        this.alignLines(lines, containerCrossSize as Pixels, totalCrossSize, alignContent);

        // Position items in each line
        let crossOffset = 0 as Pixels;
        for (const line of lines) {
            this.positionItemsInLine(
                container,
                line,
                isRow,
                isReverse,
                justifyContent,
                alignItems,
                crossOffset,
            );
            crossOffset = (crossOffset + line.crossSize) as Pixels;
        }
    }

    /**
     * Create flex items from children
     */
    private createFlexItems(children: RenderBox[], isRow: boolean): FlexItem[] {
        const items: FlexItem[] = [];

        for (const child of children) {
            // Get flex properties
            const order = this.parseNumber(child.style.getPropertyValue("order"), 0);
            const flexGrow = this.parseNumber(child.style.getPropertyValue("flex-grow"), 0);
            const flexShrink = this.parseNumber(child.style.getPropertyValue("flex-shrink"), 1);
            const flexBasisValue = child.style.getPropertyValue("flex-basis") || "auto";

            let flexBasis: Pixels;
            if (flexBasisValue === "auto") {
                // Use width/height
                flexBasis = isRow
                    ? child.getPixelValue("width", 0 as Pixels)
                    : child.getPixelValue("height", 0 as Pixels);
            } else {
                flexBasis = child.getPixelValue("flex-basis", 0 as Pixels);
            }

            // Get min/max constraints
            const minSize = isRow
                ? child.getPixelValue("min-width", 0 as Pixels)
                : child.getPixelValue("min-height", 0 as Pixels);
            const maxSize = isRow
                ? child.getPixelValue("max-width", Number.POSITIVE_INFINITY as Pixels)
                : child.getPixelValue("max-height", Number.POSITIVE_INFINITY as Pixels);

            items.push({
                renderObject: child,
                order,
                flexGrow,
                flexShrink,
                flexBasis,
                minSize,
                maxSize,
                hypotheticalMainSize: flexBasis,
                mainSize: flexBasis,
                crossSize: 0 as Pixels,
            });
        }

        return items;
    }

    /**
     * Collect flex items into flex lines (considering wrapping)
     */
    private collectFlexLines(
        items: FlexItem[],
        containerMainSize: Pixels,
        singleLine: boolean,
    ): FlexLine[] {
        if (singleLine) {
            // All items in single line
            return [{
                items,
                mainSize: 0 as Pixels,
                crossSize: 0 as Pixels,
            }];
        }

        // Multi-line wrapping
        const lines: FlexLine[] = [];
        let currentLine: FlexItem[] = [];
        let currentLineMainSize = 0 as Pixels;

        for (const item of items) {
            const itemMainSize = item.hypotheticalMainSize;

            if (
                currentLine.length === 0 ||
                currentLineMainSize + itemMainSize <= containerMainSize
            ) {
                // Add to current line
                currentLine.push(item);
                currentLineMainSize = (currentLineMainSize + itemMainSize) as Pixels;
            } else {
                // Start new line
                lines.push({
                    items: currentLine,
                    mainSize: currentLineMainSize,
                    crossSize: 0 as Pixels,
                });

                currentLine = [item];
                currentLineMainSize = itemMainSize;
            }
        }

        // Add final line
        if (currentLine.length > 0) {
            lines.push({
                items: currentLine,
                mainSize: currentLineMainSize,
                crossSize: 0 as Pixels,
            });
        }

        return lines;
    }

    /**
     * Resolve flexible lengths (flex-grow/flex-shrink)
     */
    private resolveFlexibleLengths(
        line: FlexLine,
        containerMainSize: Pixels,
        isRow: boolean,
    ): void {
        // Calculate initial free space
        let totalHypotheticalMainSize = 0 as Pixels;
        for (const item of line.items) {
            totalHypotheticalMainSize = (totalHypotheticalMainSize +
                item.hypotheticalMainSize) as Pixels;
        }

        let freeSpace = (containerMainSize - totalHypotheticalMainSize) as Pixels;

        if (freeSpace > 0) {
            // Distribute free space using flex-grow
            const totalFlexGrow = line.items.reduce((sum, item) => sum + item.flexGrow, 0);

            if (totalFlexGrow > 0) {
                for (const item of line.items) {
                    if (item.flexGrow > 0) {
                        const growAmount = (freeSpace * item.flexGrow / totalFlexGrow) as Pixels;
                        item.mainSize = (item.hypotheticalMainSize + growAmount) as Pixels;

                        // Apply min/max constraints
                        item.mainSize = Math.max(item.minSize, item.mainSize) as Pixels;
                        item.mainSize = Math.min(item.maxSize, item.mainSize) as Pixels;
                    } else {
                        item.mainSize = item.hypotheticalMainSize;
                    }
                }
            } else {
                // No flex-grow, use hypothetical sizes
                for (const item of line.items) {
                    item.mainSize = item.hypotheticalMainSize;
                }
            }
        } else if (freeSpace < 0) {
            // Negative free space - shrink items using flex-shrink
            const totalFlexShrink = line.items.reduce((sum, item) => sum + item.flexShrink, 0);

            if (totalFlexShrink > 0) {
                const scaledShrinkFactors = line.items.map((item) =>
                    item.flexShrink * item.hypotheticalMainSize
                );
                const totalScaledShrinkFactor = scaledShrinkFactors.reduce(
                    (sum, val) => sum + val,
                    0,
                );

                for (let i = 0; i < line.items.length; i++) {
                    const item = line.items[i];
                    if (item.flexShrink > 0) {
                        const shrinkAmount = Math.abs(freeSpace) *
                            scaledShrinkFactors[i] /
                            totalScaledShrinkFactor;
                        item.mainSize = (item.hypotheticalMainSize - shrinkAmount) as Pixels;

                        // Apply min constraint
                        item.mainSize = Math.max(item.minSize, item.mainSize) as Pixels;
                    } else {
                        item.mainSize = item.hypotheticalMainSize;
                    }
                }
            } else {
                // No flex-shrink, overflow
                for (const item of line.items) {
                    item.mainSize = item.hypotheticalMainSize;
                }
            }
        } else {
            // Exactly fits
            for (const item of line.items) {
                item.mainSize = item.hypotheticalMainSize;
            }
        }

        // Update line main size
        line.mainSize = line.items.reduce(
            (sum, item) => (sum + item.mainSize) as Pixels,
            0 as Pixels,
        );

        // Layout children to get cross size
        for (const item of line.items) {
            const constraints: LayoutConstraints = {
                minWidth: isRow ? item.mainSize : (0 as Pixels),
                maxWidth: isRow ? item.mainSize : Number.POSITIVE_INFINITY as Pixels,
                minHeight: isRow ? (0 as Pixels) : item.mainSize,
                maxHeight: isRow ? Number.POSITIVE_INFINITY as Pixels : item.mainSize,
            };

            item.renderObject.doLayout(constraints);

            if (item.renderObject.layout) {
                item.crossSize = isRow
                    ? item.renderObject.layout.getTotalHeight()
                    : item.renderObject.layout.getTotalWidth();
            }
        }
    }

    /**
     * Determine cross sizes of flex lines
     */
    private determineCrossSizes(lines: FlexLine[], containerCrossSize: Pixels): void {
        for (const line of lines) {
            // Line cross size is max cross size of items
            let maxCrossSize = 0 as Pixels;
            for (const item of line.items) {
                maxCrossSize = Math.max(maxCrossSize, item.crossSize) as Pixels;
            }
            line.crossSize = maxCrossSize;
        }
    }

    /**
     * Align flex lines (align-content)
     */
    private alignLines(
        lines: FlexLine[],
        containerCrossSize: Pixels,
        totalCrossSize: Pixels,
        alignContent: string,
    ): void {
        // For single line, no alignment needed
        if (lines.length === 1) {
            return;
        }

        const freeSpace = (containerCrossSize - totalCrossSize) as Pixels;

        // Adjust line cross sizes based on align-content
        switch (alignContent) {
            case "stretch":
                if (freeSpace > 0) {
                    const extraPerLine = (freeSpace / lines.length) as Pixels;
                    for (const line of lines) {
                        line.crossSize = (line.crossSize + extraPerLine) as Pixels;
                    }
                }
                break;
                // Other align-content values handled during positioning
        }
    }

    /**
     * Position items within a flex line
     */
    private positionItemsInLine(
        container: RenderBox,
        line: FlexLine,
        isRow: boolean,
        isReverse: boolean,
        justifyContent: JustifyContent,
        alignItems: AlignItems,
        crossOffset: Pixels,
    ): void {
        if (!container.layout) return;

        const containerMainSize = isRow
            ? (container.layout.width - container.layout.paddingLeft -
                container.layout.paddingRight)
            : (container.layout.height - container.layout.paddingTop -
                container.layout.paddingBottom);

        const freeSpace = (containerMainSize - line.mainSize) as Pixels;

        // Calculate main axis positions
        const mainPositions = this.calculateMainAxisPositions(
            line.items,
            freeSpace,
            justifyContent,
        );

        // Position each item
        for (let i = 0; i < line.items.length; i++) {
            const item = line.items[i];
            const itemIndex = isReverse ? line.items.length - 1 - i : i;
            const mainPos = mainPositions[itemIndex];

            // Calculate cross axis position
            const itemAlignSelf = item.renderObject.style.getPropertyValue("align-self") || "auto";
            const effectiveAlign = itemAlignSelf === "auto"
                ? alignItems
                : itemAlignSelf as AlignItems;

            let crossPos: Pixels;
            switch (effectiveAlign) {
                case AlignItems.FLEX_START:
                    crossPos = crossOffset;
                    break;
                case AlignItems.FLEX_END:
                    crossPos = (crossOffset + line.crossSize - item.crossSize) as Pixels;
                    break;
                case AlignItems.CENTER:
                    crossPos = (crossOffset + (line.crossSize - item.crossSize) / 2) as Pixels;
                    break;
                case AlignItems.STRETCH:
                    crossPos = crossOffset;
                    // Stretch cross size to line cross size
                    item.crossSize = line.crossSize;
                    break;
                case AlignItems.BASELINE:
                    // Simplified: treat as flex-start
                    crossPos = crossOffset;
                    break;
                default:
                    crossPos = crossOffset;
            }

            // Set final position
            const containerX = container.layout.x + container.layout.paddingLeft;
            const containerY = container.layout.y + container.layout.paddingTop;

            const finalX = isRow
                ? (containerX + mainPos) as Pixels
                : (containerX + crossPos) as Pixels;
            const finalY = isRow
                ? (containerY + crossPos) as Pixels
                : (containerY + mainPos) as Pixels;

            item.renderObject.setPosition(finalX, finalY);

            // Set size if stretched
            if (effectiveAlign === AlignItems.STRETCH && item.renderObject.layout) {
                if (isRow) {
                    item.renderObject.layout.height = item.crossSize;
                } else {
                    item.renderObject.layout.width = item.crossSize;
                }
            }
        }
    }

    /**
     * Calculate main axis positions based on justify-content
     */
    private calculateMainAxisPositions(
        items: FlexItem[],
        freeSpace: Pixels,
        justifyContent: JustifyContent,
    ): Pixels[] {
        const positions: Pixels[] = [];
        let currentPos = 0 as Pixels;

        switch (justifyContent) {
            case JustifyContent.FLEX_START:
                for (const item of items) {
                    positions.push(currentPos);
                    currentPos = (currentPos + item.mainSize) as Pixels;
                }
                break;

            case JustifyContent.FLEX_END:
                currentPos = freeSpace;
                for (const item of items) {
                    positions.push(currentPos);
                    currentPos = (currentPos + item.mainSize) as Pixels;
                }
                break;

            case JustifyContent.CENTER:
                currentPos = (freeSpace / 2) as Pixels;
                for (const item of items) {
                    positions.push(currentPos);
                    currentPos = (currentPos + item.mainSize) as Pixels;
                }
                break;

            case JustifyContent.SPACE_BETWEEN:
                if (items.length === 1) {
                    positions.push(0 as Pixels);
                } else {
                    const gap = (freeSpace / (items.length - 1)) as Pixels;
                    for (const item of items) {
                        positions.push(currentPos);
                        currentPos = (currentPos + item.mainSize + gap) as Pixels;
                    }
                }
                break;

            case JustifyContent.SPACE_AROUND:
                const gapAround = (freeSpace / items.length) as Pixels;
                currentPos = (gapAround / 2) as Pixels;
                for (const item of items) {
                    positions.push(currentPos);
                    currentPos = (currentPos + item.mainSize + gapAround) as Pixels;
                }
                break;

            case JustifyContent.SPACE_EVENLY:
                const gapEvenly = (freeSpace / (items.length + 1)) as Pixels;
                currentPos = gapEvenly;
                for (const item of items) {
                    positions.push(currentPos);
                    currentPos = (currentPos + item.mainSize + gapEvenly) as Pixels;
                }
                break;

            default:
                for (const item of items) {
                    positions.push(currentPos);
                    currentPos = (currentPos + item.mainSize) as Pixels;
                }
        }

        return positions;
    }

    /**
     * Get flex direction
     */
    private getFlexDirection(container: RenderObject): FlexDirection {
        const value = container.style.getPropertyValue("flex-direction") || "row";
        return value as FlexDirection;
    }

    /**
     * Get flex wrap
     */
    private getFlexWrap(container: RenderObject): FlexWrap {
        const value = container.style.getPropertyValue("flex-wrap") || "nowrap";
        return value as FlexWrap;
    }

    /**
     * Get justify content
     */
    private getJustifyContent(container: RenderObject): JustifyContent {
        const value = container.style.getPropertyValue("justify-content") || "flex-start";
        return value as JustifyContent;
    }

    /**
     * Get align items
     */
    private getAlignItems(container: RenderObject): AlignItems {
        const value = container.style.getPropertyValue("align-items") || "stretch";
        return value as AlignItems;
    }

    /**
     * Parse number from CSS value
     */
    private parseNumber(value: string | undefined, defaultValue: number): number {
        if (!value) return defaultValue;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }
}
