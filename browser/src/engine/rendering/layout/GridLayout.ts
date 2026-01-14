/**
 * Grid Layout
 * Implements CSS Grid layout algorithm
 *
 * Grid is a two-dimensional layout system for arranging items in rows and columns.
 * It provides precise control over item placement and sizing.
 */

import type { RenderObject } from "../rendering/RenderObject.ts";
import type { RenderBox } from "../rendering/RenderBox.ts";
import type { Pixels } from "../../../types/identifiers.ts";
import type { LayoutConstraints } from "../../../types/rendering.ts";

/**
 * Track sizing (grid column/row size)
 */
interface TrackSize {
    type: "fixed" | "fr" | "auto" | "minmax";
    value: number;
    minValue?: number;
    maxValue?: number;
}

/**
 * Grid track (column or row)
 */
interface GridTrack {
    size: TrackSize;
    baseSize: Pixels;
    growthLimit: Pixels;
    finalSize: Pixels;
}

/**
 * Grid cell position
 */
interface GridCell {
    row: number;
    column: number;
}

/**
 * Grid item with placement
 */
interface GridItem {
    renderObject: RenderBox;
    rowStart: number;
    rowEnd: number;
    columnStart: number;
    columnEnd: number;
    placed: boolean;
}

/**
 * GridLayout
 * Implements the grid layout algorithm
 */
export class GridLayout {
    /**
     * Layout grid container and its children
     *
     * @param container - Grid container render object
     * @param children - Grid items
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

        // Get grid properties
        const columnTemplate = this.parseGridTemplate(
            container.style.getPropertyValue("grid-template-columns") || "none",
        );
        const rowTemplate = this.parseGridTemplate(
            container.style.getPropertyValue("grid-template-rows") || "none",
        );
        const columnGap = container.getPixelValue("column-gap", 0 as Pixels);
        const rowGap = container.getPixelValue("row-gap", 0 as Pixels);

        // Create tracks
        const columnTracks = this.createTracks(columnTemplate);
        const rowTracks = this.createTracks(rowTemplate);

        // If no explicit tracks, create auto tracks
        if (columnTracks.length === 0) {
            columnTracks.push(this.createAutoTrack());
        }
        if (rowTracks.length === 0) {
            rowTracks.push(this.createAutoTrack());
        }

        // Create grid items with placement
        const gridItems = this.createGridItems(children as RenderBox[]);

        // Place items on grid
        this.placeGridItems(gridItems, columnTracks.length, rowTracks.length);

        // Expand tracks if needed based on placed items
        const maxColumn = Math.max(...gridItems.map((item) => item.columnEnd), columnTracks.length);
        const maxRow = Math.max(...gridItems.map((item) => item.rowEnd), rowTracks.length);

        while (columnTracks.length < maxColumn) {
            columnTracks.push(this.createAutoTrack());
        }
        while (rowTracks.length < maxRow) {
            rowTracks.push(this.createAutoTrack());
        }

        // Calculate available space
        const containerWidth = container.layout.width -
            container.layout.paddingLeft -
            container.layout.paddingRight;
        const containerHeight = container.layout.height -
            container.layout.paddingTop -
            container.layout.paddingBottom;

        const totalColumnGap = ((columnTracks.length - 1) * columnGap) as Pixels;
        const totalRowGap = ((rowTracks.length - 1) * rowGap) as Pixels;

        const availableWidth = (containerWidth - totalColumnGap) as Pixels;
        const availableHeight = (containerHeight - totalRowGap) as Pixels;

        // Size tracks
        this.sizeColumnTracks(columnTracks, availableWidth, gridItems);
        this.sizeRowTracks(rowTracks, availableHeight, gridItems);

        // Position grid items
        this.positionGridItems(
            container,
            gridItems,
            columnTracks,
            rowTracks,
            columnGap,
            rowGap,
        );
    }

    /**
     * Parse grid template (e.g., "100px 1fr 2fr" or "repeat(3, 1fr)")
     */
    private parseGridTemplate(template: string): TrackSize[] {
        if (template === "none" || !template) {
            return [];
        }

        const tracks: TrackSize[] = [];
        const parts = this.splitGridTemplate(template);

        for (const part of parts) {
            const trimmed = part.trim();

            if (trimmed.endsWith("fr")) {
                // Fractional unit
                const value = parseFloat(trimmed);
                tracks.push({ type: "fr", value });
            } else if (trimmed.endsWith("px")) {
                // Fixed pixel size
                const value = parseFloat(trimmed);
                tracks.push({ type: "fixed", value });
            } else if (trimmed === "auto") {
                // Auto size
                tracks.push({ type: "auto", value: 0 });
            } else if (trimmed.startsWith("minmax(")) {
                // minmax() function
                const content = trimmed.slice(7, -1);
                const [min, max] = content.split(",").map((s) => s.trim());
                tracks.push({
                    type: "minmax",
                    value: 0,
                    minValue: this.parseTrackValue(min),
                    maxValue: this.parseTrackValue(max),
                });
            } else {
                // Default to auto
                tracks.push({ type: "auto", value: 0 });
            }
        }

        return tracks;
    }

    /**
     * Split grid template respecting function boundaries
     */
    private splitGridTemplate(template: string): string[] {
        const parts: string[] = [];
        let current = "";
        let depth = 0;

        for (const char of template) {
            if (char === "(") {
                depth++;
                current += char;
            } else if (char === ")") {
                depth--;
                current += char;
            } else if (char === " " && depth === 0) {
                if (current.trim()) {
                    parts.push(current.trim());
                }
                current = "";
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            parts.push(current.trim());
        }

        return parts;
    }

    /**
     * Parse track value (for minmax)
     */
    private parseTrackValue(value: string): number {
        if (value === "auto") {
            return 0;
        } else if (value.endsWith("fr")) {
            return parseFloat(value);
        } else if (value.endsWith("px")) {
            return parseFloat(value);
        } else {
            return parseFloat(value) || 0;
        }
    }

    /**
     * Create tracks from template
     */
    private createTracks(template: TrackSize[]): GridTrack[] {
        return template.map((size) => ({
            size,
            baseSize: 0 as Pixels,
            growthLimit: Number.POSITIVE_INFINITY as Pixels,
            finalSize: 0 as Pixels,
        }));
    }

    /**
     * Create auto track
     */
    private createAutoTrack(): GridTrack {
        return {
            size: { type: "auto", value: 0 },
            baseSize: 0 as Pixels,
            growthLimit: Number.POSITIVE_INFINITY as Pixels,
            finalSize: 0 as Pixels,
        };
    }

    /**
     * Create grid items with placement info
     */
    private createGridItems(children: RenderBox[]): GridItem[] {
        const items: GridItem[] = [];

        for (const child of children) {
            // Parse grid placement properties
            const columnStart = this.parseGridLine(
                child.style.getPropertyValue("grid-column-start"),
                1,
            );
            const columnEnd = this.parseGridLine(
                child.style.getPropertyValue("grid-column-end"),
                columnStart + 1,
            );
            const rowStart = this.parseGridLine(
                child.style.getPropertyValue("grid-row-start"),
                1,
            );
            const rowEnd = this.parseGridLine(
                child.style.getPropertyValue("grid-row-end"),
                rowStart + 1,
            );

            const hasPlacement = child.style.getPropertyValue("grid-column-start") ||
                child.style.getPropertyValue("grid-row-start");

            items.push({
                renderObject: child,
                columnStart,
                columnEnd,
                rowStart,
                rowEnd,
                placed: hasPlacement !== undefined,
            });
        }

        return items;
    }

    /**
     * Parse grid line (e.g., "2" or "span 2")
     */
    private parseGridLine(value: string | undefined, defaultValue: number): number {
        if (!value || value === "auto") {
            return defaultValue;
        }

        if (value.startsWith("span ")) {
            const span = parseInt(value.slice(5));
            return defaultValue + span;
        }

        return parseInt(value) || defaultValue;
    }

    /**
     * Place grid items using auto-placement algorithm
     */
    private placeGridItems(
        items: GridItem[],
        columnCount: number,
        rowCount: number,
    ): void {
        // Grid for tracking occupied cells
        const occupied = new Set<string>();

        // Place explicitly positioned items first
        for (const item of items) {
            if (item.placed) {
                for (let row = item.rowStart; row < item.rowEnd; row++) {
                    for (let col = item.columnStart; col < item.columnEnd; col++) {
                        occupied.add(`${row},${col}`);
                    }
                }
            }
        }

        // Auto-place remaining items
        let currentRow = 1;
        let currentColumn = 1;

        for (const item of items) {
            if (item.placed) continue;

            // Find next available cell
            while (occupied.has(`${currentRow},${currentColumn}`)) {
                currentColumn++;
                if (currentColumn > columnCount) {
                    currentColumn = 1;
                    currentRow++;
                }
            }

            // Place item
            const columnSpan = item.columnEnd - item.columnStart;
            const rowSpan = item.rowEnd - item.rowStart;

            item.columnStart = currentColumn;
            item.columnEnd = currentColumn + columnSpan;
            item.rowStart = currentRow;
            item.rowEnd = currentRow + rowSpan;

            // Mark cells as occupied
            for (let row = item.rowStart; row < item.rowEnd; row++) {
                for (let col = item.columnStart; col < item.columnEnd; col++) {
                    occupied.add(`${row},${col}`);
                }
            }

            // Advance position
            currentColumn++;
            if (currentColumn > columnCount) {
                currentColumn = 1;
                currentRow++;
            }
        }
    }

    /**
     * Size column tracks
     */
    private sizeColumnTracks(
        tracks: GridTrack[],
        availableWidth: Pixels,
        items: GridItem[],
    ): void {
        this.sizeTracks(tracks, availableWidth, items, true);
    }

    /**
     * Size row tracks
     */
    private sizeRowTracks(
        tracks: GridTrack[],
        availableHeight: Pixels,
        items: GridItem[],
    ): void {
        this.sizeTracks(tracks, availableHeight, items, false);
    }

    /**
     * Size tracks (generic for columns and rows)
     */
    private sizeTracks(
        tracks: GridTrack[],
        availableSpace: Pixels,
        items: GridItem[],
        isColumn: boolean,
    ): void {
        // Initialize base sizes for fixed and auto tracks
        let remainingSpace = availableSpace;
        let totalFr = 0;

        for (const track of tracks) {
            switch (track.size.type) {
                case "fixed":
                    track.baseSize = track.size.value as Pixels;
                    track.finalSize = track.size.value as Pixels;
                    remainingSpace = (remainingSpace - track.size.value) as Pixels;
                    break;

                case "auto":
                    // Auto tracks sized based on content
                    track.baseSize = 0 as Pixels;
                    track.finalSize = 0 as Pixels;
                    break;

                case "fr":
                    totalFr += track.size.value;
                    track.baseSize = 0 as Pixels;
                    break;

                case "minmax":
                    track.baseSize = (track.size.minValue || 0) as Pixels;
                    track.growthLimit = (track.size.maxValue || Number.POSITIVE_INFINITY) as Pixels;
                    remainingSpace = (remainingSpace - track.baseSize) as Pixels;
                    break;
            }
        }

        // Size auto tracks based on content
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            if (track.size.type !== "auto") continue;

            let maxContentSize = 0 as Pixels;

            // Find max content size for items in this track
            for (const item of items) {
                const spansTrack = isColumn
                    ? (item.columnStart <= i + 1 && item.columnEnd > i + 1)
                    : (item.rowStart <= i + 1 && item.rowEnd > i + 1);

                if (spansTrack) {
                    // Layout item to get size
                    const constraints: LayoutConstraints = {
                        minWidth: 0 as Pixels,
                        maxWidth: Number.POSITIVE_INFINITY as Pixels,
                        minHeight: 0 as Pixels,
                        maxHeight: Number.POSITIVE_INFINITY as Pixels,
                    };
                    item.renderObject.doLayout(constraints);

                    if (item.renderObject.layout) {
                        const itemSize = isColumn
                            ? item.renderObject.layout.getTotalWidth()
                            : item.renderObject.layout.getTotalHeight();
                        maxContentSize = Math.max(maxContentSize, itemSize) as Pixels;
                    }
                }
            }

            track.baseSize = maxContentSize;
            track.finalSize = maxContentSize;
            remainingSpace = (remainingSpace - maxContentSize) as Pixels;
        }

        // Distribute remaining space to fr tracks
        if (totalFr > 0 && remainingSpace > 0) {
            const frSize = (remainingSpace / totalFr) as Pixels;

            for (const track of tracks) {
                if (track.size.type === "fr") {
                    track.finalSize = (frSize * track.size.value) as Pixels;
                }
            }
        }
    }

    /**
     * Position grid items
     */
    private positionGridItems(
        container: RenderBox,
        items: GridItem[],
        columnTracks: GridTrack[],
        rowTracks: GridTrack[],
        columnGap: Pixels,
        rowGap: Pixels,
    ): void {
        if (!container.layout) return;

        // Calculate column positions
        const columnPositions: Pixels[] = [0 as Pixels];
        let currentX = 0 as Pixels;
        for (let i = 0; i < columnTracks.length; i++) {
            currentX = (currentX + columnTracks[i].finalSize + (i > 0 ? columnGap : 0)) as Pixels;
            columnPositions.push(currentX);
        }

        // Calculate row positions
        const rowPositions: Pixels[] = [0 as Pixels];
        let currentY = 0 as Pixels;
        for (let i = 0; i < rowTracks.length; i++) {
            currentY = (currentY + rowTracks[i].finalSize + (i > 0 ? rowGap : 0)) as Pixels;
            rowPositions.push(currentY);
        }

        // Position each item
        for (const item of items) {
            const columnStart = Math.max(0, item.columnStart - 1);
            const columnEnd = Math.min(columnTracks.length, item.columnEnd - 1);
            const rowStart = Math.max(0, item.rowStart - 1);
            const rowEnd = Math.min(rowTracks.length, item.rowEnd - 1);

            const x = (container.layout.x +
                container.layout.paddingLeft +
                columnPositions[columnStart]) as Pixels;
            const y = (container.layout.y +
                container.layout.paddingTop +
                rowPositions[rowStart]) as Pixels;

            const width = (columnPositions[columnEnd] -
                columnPositions[columnStart] -
                (columnEnd > columnStart + 1 ? columnGap : 0)) as Pixels;
            const height = (rowPositions[rowEnd] -
                rowPositions[rowStart] -
                (rowEnd > rowStart + 1 ? rowGap : 0)) as Pixels;

            // Layout item with grid cell constraints
            const constraints: LayoutConstraints = {
                minWidth: 0 as Pixels,
                maxWidth: width,
                minHeight: 0 as Pixels,
                maxHeight: height,
            };

            item.renderObject.doLayout(constraints);

            // Apply alignment
            const justifySelf = item.renderObject.style.getPropertyValue("justify-self") ||
                "stretch";
            const alignSelf = item.renderObject.style.getPropertyValue("align-self") || "stretch";

            let finalX = x;
            let finalY = y;
            let finalWidth = width;
            let finalHeight = height;

            if (item.renderObject.layout) {
                // Horizontal alignment
                if (justifySelf === "start") {
                    finalWidth = item.renderObject.layout.getTotalWidth();
                } else if (justifySelf === "end") {
                    finalWidth = item.renderObject.layout.getTotalWidth();
                    finalX = (x + width - finalWidth) as Pixels;
                } else if (justifySelf === "center") {
                    finalWidth = item.renderObject.layout.getTotalWidth();
                    finalX = (x + (width - finalWidth) / 2) as Pixels;
                }

                // Vertical alignment
                if (alignSelf === "start") {
                    finalHeight = item.renderObject.layout.getTotalHeight();
                } else if (alignSelf === "end") {
                    finalHeight = item.renderObject.layout.getTotalHeight();
                    finalY = (y + height - finalHeight) as Pixels;
                } else if (alignSelf === "center") {
                    finalHeight = item.renderObject.layout.getTotalHeight();
                    finalY = (y + (height - finalHeight) / 2) as Pixels;
                }

                // Set size if stretched
                if (justifySelf === "stretch") {
                    item.renderObject.layout.width = width;
                }
                if (alignSelf === "stretch") {
                    item.renderObject.layout.height = height;
                }
            }

            item.renderObject.setPosition(finalX, finalY);
        }
    }
}
