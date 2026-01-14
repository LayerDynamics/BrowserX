/**
 * Layout Engine
 * Main coordinator for layout algorithms
 *
 * The layout engine performs the layout phase of rendering, computing the
 * position and size of every element in the render tree. It coordinates
 * different layout algorithms (normal flow, flexbox, grid) based on the
 * display type of each container.
 */

import type { RenderObject } from "../rendering/RenderObject.ts";
import type { RenderBox } from "../rendering/RenderBox.ts";
import type { Pixels } from "../../../types/identifiers.ts";
import type { LayoutConstraints } from "../../../types/rendering.ts";
import { NormalFlowLayout } from "./NormalFlowLayout.ts";
import { FlexboxLayout } from "./FlexboxLayout.ts";
import { GridLayout } from "./GridLayout.ts";

/**
 * Viewport dimensions
 */
export interface ViewportSize {
    width: Pixels;
    height: Pixels;
}

/**
 * Layout statistics
 */
export interface LayoutStats {
    totalNodes: number;
    layoutTime: number;
    reflowCount: number;
}

/**
 * LayoutEngine
 * Coordinates layout of render tree
 */
export class LayoutEngine {
    private normalFlowLayout: NormalFlowLayout;
    private flexboxLayout: FlexboxLayout;
    private gridLayout: GridLayout;
    private layoutStats: LayoutStats;

    constructor() {
        this.normalFlowLayout = new NormalFlowLayout();
        this.flexboxLayout = new FlexboxLayout();
        this.gridLayout = new GridLayout();
        this.layoutStats = {
            totalNodes: 0,
            layoutTime: 0,
            reflowCount: 0,
        };
    }

    /**
     * Perform layout on render tree
     * This is the main entry point for layout
     *
     * @param root - Root render object
     * @param viewport - Viewport dimensions
     * @returns Layout statistics
     */
    layout(root: RenderObject, viewport: ViewportSize): LayoutStats {
        const startTime = performance.now();

        // Reset stats
        this.layoutStats.totalNodes = 0;
        this.layoutStats.reflowCount++;

        // Create initial constraints based on viewport
        const constraints: LayoutConstraints = {
            minWidth: 0 as Pixels,
            maxWidth: viewport.width,
            minHeight: 0 as Pixels,
            maxHeight: viewport.height,
        };

        // Layout root and its subtree
        this.layoutNode(root, constraints);

        // Calculate stats
        this.layoutStats.layoutTime = performance.now() - startTime;
        this.layoutStats.totalNodes = this.countNodes(root);

        return { ...this.layoutStats };
    }

    /**
     * Layout a single node
     * Dispatches to appropriate layout algorithm based on display type
     */
    private layoutNode(node: RenderObject, constraints: LayoutConstraints): void {
        // Skip if node doesn't need layout
        if (!node.needsLayout) {
            return;
        }

        // Perform layout
        node.doLayout(constraints);

        // Layout children based on display type
        if (node.children.length > 0) {
            this.layoutChildren(node, constraints);
        }
    }

    /**
     * Layout children of a node
     * Chooses appropriate layout algorithm
     */
    private layoutChildren(parent: RenderObject, constraints: LayoutConstraints): void {
        const display = parent.style.getPropertyValue("display");

        // Determine which layout algorithm to use
        switch (display) {
            case "flex":
            case "inline-flex":
                this.layoutFlexChildren(parent, constraints);
                break;

            case "grid":
            case "inline-grid":
                this.layoutGridChildren(parent, constraints);
                break;

            case "block":
            case "flow-root":
                this.layoutBlockChildren(parent, constraints);
                break;

            case "inline":
            case "inline-block":
                this.layoutInlineChildren(parent, constraints);
                break;

            default:
                // Default to block layout
                this.layoutBlockChildren(parent, constraints);
                break;
        }
    }

    /**
     * Layout children using normal flow (block)
     */
    private layoutBlockChildren(parent: RenderObject, constraints: LayoutConstraints): void {
        if (!(parent instanceof Object && "layout" in parent)) {
            return;
        }

        const parentBox = parent as unknown as RenderBox;
        const contentHeight = this.normalFlowLayout.layoutBlockChildren(
            parentBox,
            parent.children,
            constraints,
        );

        // Update parent height if auto
        if (parentBox.layout && parent.style.getPropertyValue("height") === "auto") {
            parentBox.layout.height = contentHeight;
        }
    }

    /**
     * Layout children using normal flow (inline)
     */
    private layoutInlineChildren(parent: RenderObject, constraints: LayoutConstraints): void {
        if (!(parent instanceof Object && "layout" in parent)) {
            return;
        }

        const parentBox = parent as unknown as RenderBox;
        const contentHeight = this.normalFlowLayout.layoutInlineChildren(
            parentBox,
            parent.children,
            constraints,
        );

        // Update parent height if auto
        if (parentBox.layout && parent.style.getPropertyValue("height") === "auto") {
            parentBox.layout.height = contentHeight;
        }
    }

    /**
     * Layout children using flexbox
     */
    private layoutFlexChildren(parent: RenderObject, constraints: LayoutConstraints): void {
        if (!(parent instanceof Object && "layout" in parent)) {
            return;
        }

        const parentBox = parent as unknown as RenderBox;
        this.flexboxLayout.layoutContainer(parentBox, parent.children, constraints);
    }

    /**
     * Layout children using grid
     */
    private layoutGridChildren(parent: RenderObject, constraints: LayoutConstraints): void {
        if (!(parent instanceof Object && "layout" in parent)) {
            return;
        }

        const parentBox = parent as unknown as RenderBox;
        this.gridLayout.layoutContainer(parentBox, parent.children, constraints);
    }

    /**
     * Perform incremental layout (reflow)
     * Only layouts nodes marked as needing layout
     *
     * @param root - Root render object
     * @param viewport - Viewport dimensions
     * @returns Layout statistics
     */
    reflow(root: RenderObject, viewport: ViewportSize): LayoutStats {
        const startTime = performance.now();

        // Count nodes needing layout
        let nodesToLayout = 0;
        this.visitTree(root, (node) => {
            if (node.needsLayout) {
                nodesToLayout++;
            }
        });

        // If root needs layout, do full layout
        if (root.needsLayout) {
            return this.layout(root, viewport);
        }

        // Otherwise, incrementally layout subtrees
        this.reflowSubtree(root, viewport);

        // Calculate stats
        this.layoutStats.layoutTime = performance.now() - startTime;
        this.layoutStats.totalNodes = nodesToLayout;
        this.layoutStats.reflowCount++;

        return { ...this.layoutStats };
    }

    /**
     * Reflow a subtree
     */
    private reflowSubtree(node: RenderObject, viewport: ViewportSize): void {
        if (node.needsLayout) {
            // Get constraints from parent or viewport
            const constraints = this.getConstraintsForNode(node, viewport);
            this.layoutNode(node, constraints);
        }

        // Recursively reflow children
        for (const child of node.children) {
            this.reflowSubtree(child, viewport);
        }
    }

    /**
     * Get layout constraints for a node
     */
    private getConstraintsForNode(node: RenderObject, viewport: ViewportSize): LayoutConstraints {
        // If node has parent, get constraints from parent's content box
        if (node.parent && node.parent.layout) {
            const parentLayout = node.parent.layout;
            return {
                minWidth: 0 as Pixels,
                maxWidth: (parentLayout.width - parentLayout.paddingLeft -
                    parentLayout.paddingRight) as Pixels,
                minHeight: 0 as Pixels,
                maxHeight: (parentLayout.height - parentLayout.paddingTop -
                    parentLayout.paddingBottom) as Pixels,
            };
        }

        // Root node - use viewport
        return {
            minWidth: 0 as Pixels,
            maxWidth: viewport.width,
            minHeight: 0 as Pixels,
            maxHeight: viewport.height,
        };
    }

    /**
     * Count total nodes in tree
     */
    private countNodes(root: RenderObject): number {
        let count = 1;
        for (const child of root.children) {
            count += this.countNodes(child);
        }
        return count;
    }

    /**
     * Visit every node in tree
     */
    private visitTree(root: RenderObject, visitor: (node: RenderObject) => void): void {
        visitor(root);
        for (const child of root.children) {
            this.visitTree(child, visitor);
        }
    }

    /**
     * Find all nodes that need layout
     */
    findDirtyNodes(root: RenderObject): RenderObject[] {
        const dirtyNodes: RenderObject[] = [];
        this.visitTree(root, (node) => {
            if (node.needsLayout) {
                dirtyNodes.push(node);
            }
        });
        return dirtyNodes;
    }

    /**
     * Clear layout flags after layout complete
     */
    clearLayoutFlags(root: RenderObject): void {
        this.visitTree(root, (node) => {
            node.needsLayout = false;
        });
    }

    /**
     * Mark subtree for layout
     */
    markSubtreeForLayout(root: RenderObject): void {
        this.visitTree(root, (node) => {
            node.markNeedsLayout();
        });
    }

    /**
     * Get layout statistics
     */
    getStats(): LayoutStats {
        return { ...this.layoutStats };
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.layoutStats = {
            totalNodes: 0,
            layoutTime: 0,
            reflowCount: 0,
        };
    }

    /**
     * Calculate minimum content width for an element
     * Used for shrink-to-fit and table layout
     */
    calculateMinContentWidth(node: RenderObject): Pixels {
        // Simplified implementation
        // Real implementation would calculate minimum width without line breaking
        if (node.layout) {
            return node.layout.width;
        }
        return 0 as Pixels;
    }

    /**
     * Calculate maximum content width for an element
     * Used for shrink-to-fit and table layout
     */
    calculateMaxContentWidth(node: RenderObject): Pixels {
        // Simplified implementation
        // Real implementation would calculate preferred width (no wrapping)
        if (node.layout) {
            return node.layout.width;
        }
        return 0 as Pixels;
    }

    /**
     * Check if layout is stable (no more reflows needed)
     */
    isLayoutStable(root: RenderObject): boolean {
        let stable = true;
        this.visitTree(root, (node) => {
            if (node.needsLayout) {
                stable = false;
            }
        });
        return stable;
    }

    /**
     * Perform layout until stable (for cases with constraints changing)
     * Maximum iterations to prevent infinite loops
     */
    layoutUntilStable(
        root: RenderObject,
        viewport: ViewportSize,
        maxIterations: number = 10,
    ): LayoutStats {
        let iterations = 0;
        let lastStats = this.layoutStats;

        while (!this.isLayoutStable(root) && iterations < maxIterations) {
            lastStats = this.reflow(root, viewport);
            iterations++;
        }

        if (iterations >= maxIterations) {
            console.warn(`Layout did not stabilize after ${maxIterations} iterations`);
        }

        return lastStats;
    }
}
