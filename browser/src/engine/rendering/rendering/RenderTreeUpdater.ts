/**
 * Render Tree Updater
 * Incremental updates to render tree
 *
 * Handles efficient updates when DOM or styles change without rebuilding
 * the entire tree. Marks affected nodes for layout/paint.
 */

import type { RenderObject } from "./RenderObject.ts";
import type { DOMElement } from "../../../types/dom.ts";
import { RenderTreeBuilder } from "./RenderTreeBuilder.ts";
import { StyleResolver } from "../css-parser/StyleResolver.ts";

/**
 * Types of updates that can occur
 */
export enum UpdateType {
    STYLE_CHANGE, // Style changed (re-resolve, re-layout, re-paint)
    ATTRIBUTE_CHANGE, // Attribute changed (may affect style)
    TEXT_CHANGE, // Text content changed
    CHILD_ADDED, // Child added to DOM
    CHILD_REMOVED, // Child removed from DOM
    CHILD_REORDERED, // Children reordered
}

/**
 * Update operation
 */
export interface RenderTreeUpdate {
    type: UpdateType;
    element: DOMElement;
    renderObject?: RenderObject;
}

/**
 * RenderTreeUpdater
 * Manages incremental render tree updates
 */
export class RenderTreeUpdater {
    private styleResolver: StyleResolver;
    private treeBuilder: RenderTreeBuilder;

    constructor(styleResolver: StyleResolver, treeBuilder: RenderTreeBuilder) {
        this.styleResolver = styleResolver;
        this.treeBuilder = treeBuilder;
    }

    /**
     * Update render tree incrementally
     * Finds affected nodes and marks them for re-layout/re-paint
     *
     * @param root - Root render object
     */
    update(root: RenderObject): void {
        // Visit all nodes and check if they need updates
        this.updateNode(root);
    }

    /**
     * Update a single node and its children
     */
    private updateNode(node: RenderObject): void {
        // Check if node needs layout
        if (node.needsLayout) {
            // Will be handled by layout pass
        }

        // Check if node needs paint
        if (node.needsPaint) {
            // Will be handled by paint pass
        }

        // Recursively update children
        for (const child of node.children) {
            this.updateNode(child);
        }
    }

    /**
     * Apply a specific update operation
     *
     * @param update - Update operation to apply
     * @returns Affected render object
     */
    applyUpdate(update: RenderTreeUpdate): RenderObject | null {
        switch (update.type) {
            case UpdateType.STYLE_CHANGE:
                return this.handleStyleChange(update.element, update.renderObject);

            case UpdateType.ATTRIBUTE_CHANGE:
                return this.handleAttributeChange(update.element, update.renderObject);

            case UpdateType.TEXT_CHANGE:
                return this.handleTextChange(update.element, update.renderObject);

            case UpdateType.CHILD_ADDED:
                return this.handleChildAdded(update.element, update.renderObject);

            case UpdateType.CHILD_REMOVED:
                return this.handleChildRemoved(update.element, update.renderObject);

            case UpdateType.CHILD_REORDERED:
                return this.handleChildReordered(update.element, update.renderObject);

            default:
                return null;
        }
    }

    /**
     * Handle style change
     */
    private handleStyleChange(
        element: DOMElement,
        renderObject?: RenderObject,
    ): RenderObject | null {
        if (!renderObject) {
            return null;
        }

        // Re-resolve computed style
        const newStyle = this.styleResolver.resolve(element);

        // Check if display changed
        const oldDisplay = renderObject.style.getPropertyValue("display");
        const newDisplay = newStyle.getPropertyValue("display");

        if (oldDisplay !== newDisplay) {
            // Display changed - need to rebuild subtree
            if (renderObject.parent) {
                const newRenderObject = this.treeBuilder.buildSubtree(element);
                if (newRenderObject) {
                    // Replace in parent
                    const parent = renderObject.parent;
                    const index = parent.children.indexOf(renderObject);
                    if (index >= 0) {
                        parent.removeChild(renderObject);
                        parent.insertBefore(newRenderObject, parent.children[index] || null);
                    }
                }
                return newRenderObject;
            }
        }

        // Style changed but display didn't - mark for re-layout
        renderObject.markNeedsLayout();
        renderObject.markNeedsPaint();

        return renderObject;
    }

    /**
     * Handle attribute change
     */
    private handleAttributeChange(
        element: DOMElement,
        renderObject?: RenderObject,
    ): RenderObject | null {
        if (!renderObject) {
            return null;
        }

        // Attributes can affect computed style (e.g., class, id, style attribute)
        const attrName = element.attributes?.keys().next().value;

        if (attrName === "class" || attrName === "id" || attrName === "style") {
            // Re-resolve style
            return this.handleStyleChange(element, renderObject);
        }

        // For other attributes (src, width, height, etc.), mark for re-layout
        renderObject.markNeedsLayout();
        renderObject.markNeedsPaint();

        return renderObject;
    }

    /**
     * Handle text content change
     */
    private handleTextChange(
        element: DOMElement,
        renderObject?: RenderObject,
    ): RenderObject | null {
        if (!renderObject) {
            return null;
        }

        // Text changed - mark for re-layout
        renderObject.markNeedsLayout();
        renderObject.markNeedsPaint();

        return renderObject;
    }

    /**
     * Handle child added to DOM
     */
    private handleChildAdded(
        element: DOMElement,
        renderObject?: RenderObject,
    ): RenderObject | null {
        if (!renderObject) {
            return null;
        }

        // Rebuild subtree for this element
        const newRenderObject = this.treeBuilder.buildSubtree(element);
        if (newRenderObject && renderObject.parent) {
            // Replace in parent
            const parent = renderObject.parent;
            const index = parent.children.indexOf(renderObject);
            if (index >= 0) {
                parent.removeChild(renderObject);
                parent.insertBefore(newRenderObject, parent.children[index] || null);
            }
        }

        return newRenderObject;
    }

    /**
     * Handle child removed from DOM
     */
    private handleChildRemoved(
        element: DOMElement,
        renderObject?: RenderObject,
    ): RenderObject | null {
        if (!renderObject) {
            return null;
        }

        // Remove from parent
        if (renderObject.parent) {
            renderObject.parent.removeChild(renderObject);
            renderObject.parent.markNeedsLayout();
            renderObject.parent.markNeedsPaint();
        }

        return null;
    }

    /**
     * Handle children reordered
     */
    private handleChildReordered(
        element: DOMElement,
        renderObject?: RenderObject,
    ): RenderObject | null {
        if (!renderObject) {
            return null;
        }

        // Rebuild children
        const newRenderObject = this.treeBuilder.buildSubtree(element);
        if (newRenderObject && renderObject.parent) {
            // Replace in parent
            const parent = renderObject.parent;
            const index = parent.children.indexOf(renderObject);
            if (index >= 0) {
                parent.removeChild(renderObject);
                parent.insertBefore(newRenderObject, parent.children[index] || null);
            }
        }

        return newRenderObject;
    }

    /**
     * Mark subtree for re-layout
     */
    markSubtreeNeedsLayout(root: RenderObject): void {
        root.markNeedsLayout();
        for (const child of root.children) {
            this.markSubtreeNeedsLayout(child);
        }
    }

    /**
     * Mark subtree for re-paint
     */
    markSubtreeNeedsPaint(root: RenderObject): void {
        root.markNeedsPaint();
        for (const child of root.children) {
            this.markSubtreeNeedsPaint(child);
        }
    }

    /**
     * Find render object for DOM element
     *
     * @param root - Root render object to search from
     * @param element - DOM element to find
     * @returns Matching render object or null
     */
    findRenderObject(root: RenderObject, element: DOMElement): RenderObject | null {
        if (root.element === element) {
            return root;
        }

        for (const child of root.children) {
            const found = this.findRenderObject(child, element);
            if (found) {
                return found;
            }
        }

        return null;
    }

    /**
     * Batch update multiple operations
     *
     * @param updates - Array of update operations
     * @param root - Root render object
     */
    batchUpdate(updates: RenderTreeUpdate[], root: RenderObject): void {
        // Apply all updates
        for (const update of updates) {
            this.applyUpdate(update);
        }

        // Single re-layout/re-paint pass
        this.update(root);
    }

    /**
     * Set style resolver
     */
    setStyleResolver(resolver: StyleResolver): void {
        this.styleResolver = resolver;
    }

    /**
     * Set tree builder
     */
    setTreeBuilder(builder: RenderTreeBuilder): void {
        this.treeBuilder = builder;
    }
}
