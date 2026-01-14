/**
 * Paint Order - z-index and stacking context
 *
 * Determines the order in which elements are painted based on CSS stacking
 * contexts and z-index. Elements are grouped into stacking contexts and
 * painted in a specific order to achieve correct visual layering.
 */

import type { RenderObject } from "../rendering/RenderObject.ts";

/**
 * Stacking context
 * Groups render objects that paint together
 */
export interface StackingContext {
    root: RenderObject;
    zIndex: number;
    isPositioned: boolean;
    children: StackingContext[];
    contents: RenderObject[];
}

/**
 * Paint phase for ordering within a stacking context
 */
export enum PaintPhase {
    BACKGROUND_AND_BORDERS = 0,
    NEGATIVE_Z_INDEX = 1,
    BLOCK_BACKGROUNDS = 2,
    FLOATS = 3,
    FOREGROUND = 4,
    OUTLINE = 5,
    POSITIVE_Z_INDEX = 6,
}

/**
 * Paint order comparator
 */
export class PaintOrder {
    /**
     * Build stacking context tree from render tree
     *
     * @param root - Root render object
     * @returns Root stacking context
     */
    buildStackingContextTree(root: RenderObject): StackingContext {
        return this.buildStackingContext(root);
    }

    /**
     * Build stacking context for a render object
     */
    private buildStackingContext(renderObject: RenderObject): StackingContext {
        const zIndex = this.getZIndex(renderObject);
        const isPositioned = this.isPositioned(renderObject);

        const context: StackingContext = {
            root: renderObject,
            zIndex,
            isPositioned,
            children: [],
            contents: [],
        };

        // Process children
        for (const child of renderObject.children) {
            if (this.createsStackingContext(child)) {
                // Child creates its own stacking context
                const childContext = this.buildStackingContext(child);
                context.children.push(childContext);
            } else {
                // Child is part of this stacking context
                context.contents.push(child);

                // Recursively check child's children
                this.collectDescendants(child, context);
            }
        }

        // Sort child stacking contexts by z-index
        context.children.sort((a, b) => a.zIndex - b.zIndex);

        return context;
    }

    /**
     * Collect descendants that don't create their own stacking context
     */
    private collectDescendants(renderObject: RenderObject, context: StackingContext): void {
        for (const child of renderObject.children) {
            if (this.createsStackingContext(child)) {
                const childContext = this.buildStackingContext(child);
                context.children.push(childContext);
            } else {
                context.contents.push(child);
                this.collectDescendants(child, context);
            }
        }
    }

    /**
     * Get paint order for a stacking context
     * Returns render objects in the order they should be painted
     *
     * @param context - Stacking context
     * @returns Ordered list of render objects
     */
    getPaintOrder(context: StackingContext): RenderObject[] {
        const ordered: RenderObject[] = [];

        // 1. Background and borders of root
        ordered.push(context.root);

        // 2. Stacking contexts with negative z-index (sorted by z-index)
        const negativeContexts = context.children.filter((c) => c.zIndex < 0);
        for (const child of negativeContexts) {
            ordered.push(...this.getPaintOrder(child));
        }

        // 3. In-flow, non-inline-level, non-positioned descendants
        const blockContents = context.contents.filter((obj) => {
            const display = obj.style.getPropertyValue("display");
            const position = obj.style.getPropertyValue("position");
            // Empty position is treated as 'static' (the default)
            return !this.isInline(display) && (position === "static" || position === "");
        });
        ordered.push(...blockContents);

        // 4. Floats
        const floats = context.contents.filter((obj) => {
            const float = obj.style.getPropertyValue("float");
            return float === "left" || float === "right";
        });
        ordered.push(...floats);

        // 5. In-flow, inline-level, non-positioned descendants
        const inlineContents = context.contents.filter((obj) => {
            const display = obj.style.getPropertyValue("display");
            const position = obj.style.getPropertyValue("position");
            // Empty position is treated as 'static' (the default)
            return this.isInline(display) && (position === "static" || position === "");
        });
        ordered.push(...inlineContents);

        // 6. Positioned descendants with z-index: auto or z-index: 0
        const zeroContexts = context.children.filter((c) => c.zIndex === 0);
        for (const child of zeroContexts) {
            ordered.push(...this.getPaintOrder(child));
        }

        // 7. Stacking contexts with positive z-index (sorted by z-index)
        const positiveContexts = context.children.filter((c) => c.zIndex > 0);
        for (const child of positiveContexts) {
            ordered.push(...this.getPaintOrder(child));
        }

        return ordered;
    }

    /**
     * Get flat paint order from render tree
     * Main entry point for getting paint order
     *
     * @param root - Root render object
     * @returns Ordered list of render objects to paint
     */
    calculatePaintOrder(root: RenderObject): RenderObject[] {
        const stackingTree = this.buildStackingContextTree(root);
        return this.getPaintOrder(stackingTree);
    }

    /**
     * Check if render object creates a stacking context
     */
    private createsStackingContext(renderObject: RenderObject): boolean {
        // Root always creates stacking context
        if (!renderObject.parent) {
            return true;
        }

        const position = renderObject.style.getPropertyValue("position");
        const zIndex = renderObject.style.getPropertyValue("z-index");
        const opacity = renderObject.style.getPropertyValue("opacity");
        const transform = renderObject.style.getPropertyValue("transform");
        const filter = renderObject.style.getPropertyValue("filter");
        const willChange = renderObject.style.getPropertyValue("will-change");
        const isolation = renderObject.style.getPropertyValue("isolation");
        const mixBlendMode = renderObject.style.getPropertyValue("mix-blend-mode");

        // Positioned elements with z-index other than auto
        if (
            (position === "absolute" || position === "relative" || position === "fixed" ||
                position === "sticky") &&
            zIndex && zIndex !== "auto"
        ) {
            return true;
        }

        // Opacity less than 1
        if (opacity && parseFloat(opacity) < 1) {
            return true;
        }

        // Transform other than none
        if (transform && transform !== "none") {
            return true;
        }

        // Filter other than none
        if (filter && filter !== "none") {
            return true;
        }

        // will-change specifying any property that creates stacking context
        if (
            willChange && (willChange.includes("opacity") ||
                willChange.includes("transform") ||
                willChange.includes("filter"))
        ) {
            return true;
        }

        // isolation: isolate
        if (isolation === "isolate") {
            return true;
        }

        // mix-blend-mode other than normal
        if (mixBlendMode && mixBlendMode !== "normal") {
            return true;
        }

        // Flex/grid items with z-index other than auto
        if (renderObject.parent) {
            const parentDisplay = renderObject.parent.style.getPropertyValue("display");
            if (
                (parentDisplay === "flex" || parentDisplay === "inline-flex" ||
                    parentDisplay === "grid" || parentDisplay === "inline-grid") &&
                zIndex && zIndex !== "auto"
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get z-index value for render object
     */
    private getZIndex(renderObject: RenderObject): number {
        const zIndex = renderObject.style.getPropertyValue("z-index");

        if (!zIndex || zIndex === "auto") {
            return 0;
        }

        const parsed = parseInt(zIndex, 10);
        return isNaN(parsed) ? 0 : parsed;
    }

    /**
     * Check if render object is positioned
     */
    private isPositioned(renderObject: RenderObject): boolean {
        const position = renderObject.style.getPropertyValue("position");
        return position === "relative" ||
            position === "absolute" ||
            position === "fixed" ||
            position === "sticky";
    }

    /**
     * Check if display is inline
     */
    private isInline(display: string): boolean {
        return display === "inline" ||
            display === "inline-block" ||
            display === "inline-flex" ||
            display === "inline-grid";
    }

    /**
     * Sort render objects by tree order (document order)
     * Used for elements at the same stacking level
     */
    sortByTreeOrder(objects: RenderObject[]): RenderObject[] {
        // Create a map of render object to tree position
        const positions = new Map<RenderObject, number>();
        let position = 0;

        const assignPositions = (obj: RenderObject) => {
            positions.set(obj, position++);
            for (const child of obj.children) {
                assignPositions(child);
            }
        };

        // Find common ancestor and assign positions
        if (objects.length > 0) {
            let root = objects[0];
            while (root.parent) {
                root = root.parent;
            }
            assignPositions(root);
        }

        // Sort by position
        return objects.sort((a, b) => {
            const posA = positions.get(a) ?? 0;
            const posB = positions.get(b) ?? 0;
            return posA - posB;
        });
    }

    /**
     * Get stacking context root for a render object
     * Walks up the tree to find the stacking context this object belongs to
     */
    getStackingContextRoot(renderObject: RenderObject): RenderObject {
        let current: RenderObject | null = renderObject;

        while (current?.parent) {
            if (this.createsStackingContext(current)) {
                return current;
            }
            current = current.parent;
        }

        return current || renderObject;
    }

    /**
     * Compare two render objects for paint order
     * Returns negative if a should be painted before b
     */
    compare(a: RenderObject, b: RenderObject): number {
        // If they're in different stacking contexts, compare the contexts
        const contextA = this.getStackingContextRoot(a);
        const contextB = this.getStackingContextRoot(b);

        if (contextA !== contextB) {
            return this.getZIndex(contextA) - this.getZIndex(contextB);
        }

        // Same stacking context - use tree order
        // Find which comes first in tree traversal
        const positions = new Map<RenderObject, number>();
        let position = 0;

        const assignPositions = (obj: RenderObject) => {
            positions.set(obj, position++);
            for (const child of obj.children) {
                assignPositions(child);
            }
        };

        assignPositions(contextA);

        const posA = positions.get(a) ?? 0;
        const posB = positions.get(b) ?? 0;

        return posA - posB;
    }

    /**
     * Group render objects by paint phase
     */
    groupByPaintPhase(objects: RenderObject[]): Map<PaintPhase, RenderObject[]> {
        const groups = new Map<PaintPhase, RenderObject[]>();

        for (const obj of objects) {
            const phase = this.getPaintPhase(obj);

            if (!groups.has(phase)) {
                groups.set(phase, []);
            }

            groups.get(phase)!.push(obj);
        }

        return groups;
    }

    /**
     * Get paint phase for a render object
     */
    private getPaintPhase(renderObject: RenderObject): PaintPhase {
        const position = renderObject.style.getPropertyValue("position");
        const float = renderObject.style.getPropertyValue("float");
        const display = renderObject.style.getPropertyValue("display");
        const zIndex = this.getZIndex(renderObject);

        // Positioned with negative z-index
        if (this.isPositioned(renderObject) && zIndex < 0) {
            return PaintPhase.NEGATIVE_Z_INDEX;
        }

        // Positioned with positive z-index
        if (this.isPositioned(renderObject) && zIndex > 0) {
            return PaintPhase.POSITIVE_Z_INDEX;
        }

        // Floats
        if (float === "left" || float === "right") {
            return PaintPhase.FLOATS;
        }

        // Inline content
        if (this.isInline(display)) {
            return PaintPhase.FOREGROUND;
        }

        // Block backgrounds
        if (display === "block") {
            return PaintPhase.BLOCK_BACKGROUNDS;
        }

        return PaintPhase.FOREGROUND;
    }
}
