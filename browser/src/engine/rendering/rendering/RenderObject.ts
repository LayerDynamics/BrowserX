/**
 * RenderObject - Base class for render tree nodes
 *
 * The render tree is a parallel tree to the DOM that represents what will
 * actually be rendered on screen. Not all DOM nodes create render objects
 * (e.g., display:none elements are excluded).
 */

import type { Pixels, RenderObjectID } from "../../../types/identifiers.ts";
import type { ComputedStyle } from "../../../types/css.ts";
import type { DOMElement } from "../../../types/dom.ts";
import type {
    LayoutBox,
    LayoutConstraints,
    PaintContext,
    PaintLayer,
} from "../../../types/rendering.ts";

/**
 * Base render object class
 * All render objects in the tree extend this class
 */
export abstract class RenderObject {
    readonly id: RenderObjectID;
    readonly element: DOMElement;
    readonly style: ComputedStyle;

    // Tree structure
    parent: RenderObject | null = null;
    children: RenderObject[] = [];
    nextSibling: RenderObject | null = null;

    // Layout state
    layout: LayoutBox | null = null;
    needsLayout: boolean = true;

    // Paint state
    paintLayer: PaintLayer | null = null;
    needsPaint: boolean = true;

    // Internal state
    private static nextId: number = 1;

    constructor(element: DOMElement, style: ComputedStyle) {
        this.id = String(RenderObject.nextId++) as RenderObjectID;
        this.element = element;
        this.style = style;
    }

    /**
     * Mark this object and ancestors as needing layout
     */
    markNeedsLayout(): void {
        if (this.needsLayout) {
            return; // Already marked
        }

        this.needsLayout = true;

        // Propagate up the tree
        if (this.parent) {
            this.parent.markNeedsLayout();
        }
    }

    /**
     * Mark this object as needing paint
     */
    markNeedsPaint(): void {
        if (this.needsPaint) {
            return; // Already marked
        }

        this.needsPaint = true;

        // Don't propagate to parent - paint is independent per object
    }

    /**
     * Perform layout with given constraints
     * Subclasses must implement this
     */
    abstract doLayout(constraints: LayoutConstraints): void;

    /**
     * Paint this object to the paint context
     * Subclasses must implement this
     */
    abstract paint(context: PaintContext): void;

    /**
     * Set position of this render object
     * Subclasses must implement this
     */
    abstract setPosition(x: Pixels, y: Pixels): void;

    /**
     * Add child render object
     */
    appendChild(child: RenderObject): void {
        child.parent = this;

        if (this.children.length > 0) {
            const lastChild = this.children[this.children.length - 1];
            lastChild.nextSibling = child;
        }

        this.children.push(child);
        this.markNeedsLayout();
    }

    /**
     * Remove child render object
     */
    removeChild(child: RenderObject): void {
        const index = this.children.indexOf(child);
        if (index === -1) {
            return;
        }

        this.children.splice(index, 1);
        child.parent = null;

        // Update sibling links
        if (index > 0) {
            const prevSibling = this.children[index - 1];
            prevSibling.nextSibling = index < this.children.length ? this.children[index] : null;
        }

        this.markNeedsLayout();
    }

    /**
     * Insert child before reference child
     */
    insertBefore(newChild: RenderObject, refChild: RenderObject | null): void {
        if (!refChild) {
            this.appendChild(newChild);
            return;
        }

        const index = this.children.indexOf(refChild);
        if (index === -1) {
            throw new Error("Reference child not found");
        }

        newChild.parent = this;
        this.children.splice(index, 0, newChild);

        // Update sibling links
        newChild.nextSibling = refChild;
        if (index > 0) {
            const prevSibling = this.children[index - 1];
            prevSibling.nextSibling = newChild;
        }

        this.markNeedsLayout();
    }

    /**
     * Get first child
     */
    get firstChild(): RenderObject | null {
        return this.children.length > 0 ? this.children[0] : null;
    }

    /**
     * Get last child
     */
    get lastChild(): RenderObject | null {
        return this.children.length > 0 ? this.children[this.children.length - 1] : null;
    }

    /**
     * Check if this is a block-level element
     */
    isBlock(): boolean {
        const display = this.style.getPropertyValue("display");
        return display === "block" ||
            display === "flex" ||
            display === "grid" ||
            display === "table" ||
            display === "list-item";
    }

    /**
     * Check if this is an inline-level element
     */
    isInline(): boolean {
        const display = this.style.getPropertyValue("display");
        return display === "inline" ||
            display === "inline-block" ||
            display === "inline-flex";
    }

    /**
     * Check if this is a replaced element (img, video, etc.)
     */
    isReplaced(): boolean {
        const tagName = this.element.tagName?.toLowerCase();
        return tagName === "img" ||
            tagName === "video" ||
            tagName === "canvas" ||
            tagName === "iframe" ||
            tagName === "object" ||
            tagName === "embed";
    }

    /**
     * Check if this creates a new stacking context
     */
    createsStackingContext(): boolean {
        const position = this.style.getPropertyValue("position");
        const zIndex = this.style.getPropertyValue("z-index");
        const opacity = this.style.getPropertyValue("opacity");
        const transform = this.style.getPropertyValue("transform");

        // Creates stacking context if:
        // - Positioned with z-index
        // - Has opacity < 1
        // - Has transform
        // - Is root
        return (position !== "static" && zIndex !== "auto") ||
            (opacity !== "" && parseFloat(opacity) < 1) ||
            (transform !== "" && transform !== "none") ||
            this.parent === null;
    }

    /**
     * Get computed pixel value for a CSS length property
     */
    public getPixelValue(property: string, defaultValue: Pixels = 0 as Pixels): Pixels {
        const value = this.style.getPropertyValue(property);

        if (!value || value === "auto" || value === "none") {
            return defaultValue;
        }

        // Parse pixel value
        if (value.endsWith("px")) {
            return parseFloat(value) as Pixels;
        }

        // Parse percentage (would need parent context)
        if (value.endsWith("%")) {
            // TODO: Calculate percentage relative to parent
            return defaultValue;
        }

        // Try to parse as number
        const num = parseFloat(value);
        if (!isNaN(num)) {
            return num as Pixels;
        }

        return defaultValue;
    }

    /**
     * Get computed color value
     */
    protected getColorValue(property: string, defaultValue: string = "transparent"): string {
        const value = this.style.getPropertyValue(property);
        return value || defaultValue;
    }

    /**
     * Visit all descendants with callback
     */
    visitChildren(callback: (child: RenderObject) => void): void {
        for (const child of this.children) {
            callback(child);
            child.visitChildren(callback);
        }
    }

    /**
     * Find ancestor matching predicate
     */
    findAncestor(predicate: (obj: RenderObject) => boolean): RenderObject | null {
        let current = this.parent;
        while (current) {
            if (predicate(current)) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    /**
     * Get depth in tree (distance from root)
     */
    getDepth(): number {
        let depth = 0;
        let current = this.parent;
        while (current) {
            depth++;
            current = current.parent;
        }
        return depth;
    }

    /**
     * Check if this is an ancestor of another object
     */
    isAncestorOf(other: RenderObject): boolean {
        let current = other.parent;
        while (current) {
            if (current === this) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    /**
     * Get debug string representation
     */
    toString(): string {
        const tagName = this.element.tagName || "unknown";
        const id = this.element.attributes?.get("id");
        const classes = this.element.attributes?.get("class");

        let str = `${this.constructor.name}(${tagName}`;
        if (id) str += `#${id}`;
        if (classes) str += `.${classes.split(" ").join(".")}`;
        str += `)`;

        return str;
    }

    /**
     * Get debug tree representation
     */
    debugTree(indent: string = ""): string {
        let str = indent + this.toString() + "\n";
        for (const child of this.children) {
            str += child.debugTree(indent + "  ");
        }
        return str;
    }
}
