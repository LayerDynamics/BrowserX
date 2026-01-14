/**
 * Render Tree Builder
 * Constructs render tree from DOM + CSSOM
 *
 * The render tree is a parallel tree to the DOM that represents what will
 * actually be rendered. It excludes elements with display:none and creates
 * appropriate RenderObject types based on element display properties.
 */

import type { DOMElement, DOMNode } from "../../../types/dom.ts";
import { RenderObject } from "./RenderObject.ts";
import { RenderBlock } from "./RenderBlock.ts";
import { RenderInline } from "./RenderInline.ts";
import { RenderText } from "./RenderText.ts";
import { RenderReplaced } from "./RenderReplaced.ts";
import { StyleResolver } from "../css-parser/StyleResolver.ts";
import type { ComputedStyle } from "../../../types/css.ts";

/**
 * RenderTreeBuilder
 * Converts DOM + computed styles into render tree
 */
export class RenderTreeBuilder {
    private styleResolver: StyleResolver;

    constructor(styleResolver: StyleResolver) {
        this.styleResolver = styleResolver;
    }

    /**
     * Build render tree from DOM
     *
     * @param dom - Root DOM node
     * @returns Root render object, or null if nothing to render
     */
    build(dom: DOMNode): RenderObject | null {
        // Must be an element to create render tree
        if (dom.nodeType !== 1) { // ELEMENT_NODE
            return null;
        }

        const element = dom as DOMElement;

        // Resolve computed style
        const style = this.styleResolver.resolve(element);

        // Check if element should be rendered
        if (!this.shouldCreateRenderObject(element, style)) {
            return null;
        }

        // Create appropriate render object type
        const renderObject = this.createRenderObject(element, style);

        // Recursively build children
        this.buildChildren(element, renderObject);

        return renderObject;
    }

    /**
     * Check if element should create a render object
     */
    private shouldCreateRenderObject(element: DOMElement, style: ComputedStyle): boolean {
        // Don't render if display is none
        const display = style.getPropertyValue("display");
        if (display === "none") {
            return false;
        }

        // Don't render if visibility is hidden and element has no layout impact
        const visibility = style.getPropertyValue("visibility");
        if (visibility === "hidden") {
            // Hidden elements still participate in layout
            // For now, we'll render them (paint can skip them)
            return true;
        }

        // Don't render script, style, meta, link, etc.
        const tagName = element.tagName?.toLowerCase();
        const nonRenderedTags = ["script", "style", "meta", "link", "title", "head"];
        if (tagName && nonRenderedTags.includes(tagName)) {
            return false;
        }

        return true;
    }

    /**
     * Create appropriate RenderObject type based on element and style
     */
    private createRenderObject(element: DOMElement, style: ComputedStyle): RenderObject {
        const tagName = element.tagName?.toLowerCase();

        // Check if replaced element
        if (this.isReplacedElement(tagName)) {
            return new RenderReplaced(element, style);
        }

        // Determine display type
        const display = style.getPropertyValue("display");

        // Create appropriate render object
        switch (display) {
            case "block":
            case "flex":
            case "grid":
            case "table":
            case "list-item":
            case "flow-root":
                return new RenderBlock(element, style);

            case "inline":
            case "inline-block":
            case "inline-flex":
            case "inline-grid":
                return new RenderInline(element, style);

            default:
                // Default to block for unknown display values
                return new RenderBlock(element, style);
        }
    }

    /**
     * Check if element is replaced
     */
    private isReplacedElement(tagName?: string): boolean {
        if (!tagName) return false;

        const replacedElements = ["img", "video", "canvas", "iframe", "object", "embed", "input"];
        return replacedElements.includes(tagName);
    }

    /**
     * Build children recursively
     */
    private buildChildren(element: DOMElement, parent: RenderObject): void {
        if (!element.childNodes) {
            return;
        }

        for (const child of element.childNodes) {
            // Handle text nodes
            if (child.nodeType === 3) { // TEXT_NODE
                const textContent = child.nodeValue?.trim();
                if (textContent) {
                    // Get parent's computed style for text
                    const style = this.styleResolver.resolve(element);
                    const textRender = new RenderText(element, style, textContent);
                    parent.appendChild(textRender);
                }
                continue;
            }

            // Handle element nodes
            if (child.nodeType === 1) { // ELEMENT_NODE
                const childElement = child as DOMElement;

                // Resolve style for child
                const childStyle = this.styleResolver.resolve(childElement);

                // Check if child should be rendered
                if (!this.shouldCreateRenderObject(childElement, childStyle)) {
                    continue;
                }

                // Create render object for child
                const childRender = this.createRenderObject(childElement, childStyle);

                // Recursively build child's children
                this.buildChildren(childElement, childRender);

                // Add to parent
                parent.appendChild(childRender);
            }
        }
    }

    /**
     * Build render tree from DOM
     */
    buildTree(dom: DOMNode): RenderObject | null {
        return this.build(dom);
    }

    /**
     * Build render tree for subtree
     * Useful for partial updates
     */
    buildSubtree(element: DOMElement): RenderObject | null {
        return this.build(element as DOMNode);
    }

    /**
     * Set style resolver
     */
    setStyleResolver(resolver: StyleResolver): void {
        this.styleResolver = resolver;
    }

    /**
     * Get style resolver
     */
    getStyleResolver(): StyleResolver {
        return this.styleResolver;
    }
}
