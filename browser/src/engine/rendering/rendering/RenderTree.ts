/**
 * Render Tree
 *
 * Wrapper for the render tree structure that combines DOM and styles.
 * Provides the root of the render tree for layout and painting.
 */

import type { DOMNode } from "../../../types/dom.ts";
import type { StyleResolver } from "../css-parser/StyleResolver.ts";
import { RenderTreeBuilder } from "./RenderTreeBuilder.ts";
import { RenderObject } from "./RenderObject.ts";

/**
 * Render Tree
 * Manages the render tree lifecycle
 */
export class RenderTree {
    private root: RenderObject | null = null;
    private builder: RenderTreeBuilder | null = null;

    /**
     * Build render tree from DOM and styles
     */
    build(dom: DOMNode, styleResolver: StyleResolver): void {
        this.builder = new RenderTreeBuilder(styleResolver);
        this.root = this.builder.buildTree(dom);
    }

    /**
     * Get root render object
     */
    getRoot(): RenderObject {
        if (!this.root) {
            throw new Error("Render tree not built - call build() first");
        }
        return this.root;
    }

    /**
     * Check if tree is built
     */
    isBuilt(): boolean {
        return this.root !== null;
    }

    /**
     * Clear render tree
     */
    clear(): void {
        this.root = null;
        this.builder = null;
    }

    /**
     * Get tree statistics
     */
    getStats() {
        if (!this.root) {
            return {
                nodeCount: 0,
                depth: 0,
            };
        }

        return {
            nodeCount: this.countNodes(this.root),
            depth: this.calculateDepth(this.root),
        };
    }

    /**
     * Count nodes in tree
     */
    private countNodes(node: RenderObject): number {
        let count = 1;
        for (const child of node.children) {
            count += this.countNodes(child);
        }
        return count;
    }

    /**
     * Calculate tree depth
     */
    private calculateDepth(node: RenderObject, currentDepth = 0): number {
        if (node.children.length === 0) {
            return currentDepth + 1;
        }

        let maxDepth = currentDepth + 1;
        for (const child of node.children) {
            const depth = this.calculateDepth(child, currentDepth + 1);
            maxDepth = Math.max(maxDepth, depth);
        }

        return maxDepth;
    }
}
