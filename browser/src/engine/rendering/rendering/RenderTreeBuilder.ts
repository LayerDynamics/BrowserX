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
   * User-agent default display values for HTML elements.
   * Applied when the author stylesheet doesn't set display explicitly.
   */
  private static readonly UA_BLOCK_ELEMENTS = new Set([
    "html", "body", "div", "section", "article", "aside", "nav", "main",
    "header", "footer", "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "blockquote", "pre", "figure", "figcaption",
    "ul", "ol", "dl", "dt", "dd", "form", "fieldset", "legend",
    "details", "summary", "dialog", "address", "hr", "center",
    "noscript", "template", "hgroup", "search",
  ]);

  private static readonly UA_LIST_ITEM_ELEMENTS = new Set(["li"]);

  private static readonly UA_TABLE_ELEMENTS: Record<string, string> = {
    "table": "table",
    "thead": "table-header-group",
    "tbody": "table-row-group",
    "tfoot": "table-footer-group",
    "tr": "table-row",
    "td": "table-cell",
    "th": "table-cell",
    "caption": "table-caption",
    "colgroup": "table-column-group",
    "col": "table-column",
  };

  /**
   * User-agent default styles for HTML elements (font-size, margins, etc.).
   */
  private static readonly UA_STYLES: Record<string, Record<string, string>> = {
    "h1": { "font-size": "32px", "font-weight": "bold", "margin-top": "21px", "margin-bottom": "21px" },
    "h2": { "font-size": "24px", "font-weight": "bold", "margin-top": "19px", "margin-bottom": "19px" },
    "h3": { "font-size": "18.7px", "font-weight": "bold", "margin-top": "18px", "margin-bottom": "18px" },
    "h4": { "font-size": "16px", "font-weight": "bold", "margin-top": "21px", "margin-bottom": "21px" },
    "h5": { "font-size": "13.3px", "font-weight": "bold", "margin-top": "22px", "margin-bottom": "22px" },
    "h6": { "font-size": "10.7px", "font-weight": "bold", "margin-top": "25px", "margin-bottom": "25px" },
    "p":  { "margin-top": "16px", "margin-bottom": "16px" },
    "blockquote": { "margin-top": "16px", "margin-bottom": "16px", "margin-left": "40px", "margin-right": "40px" },
    "ul": { "margin-top": "16px", "margin-bottom": "16px", "padding-left": "40px" },
    "ol": { "margin-top": "16px", "margin-bottom": "16px", "padding-left": "40px" },
    "li": { "margin-top": "0", "margin-bottom": "0" },
    "pre": { "font-family": "monospace", "white-space": "pre" },
    "code": { "font-family": "monospace" },
    "body": { "margin-top": "8px", "margin-right": "8px", "margin-bottom": "8px", "margin-left": "8px" },
    "hr": { "margin-top": "8px", "margin-bottom": "8px", "border-top-width": "1px", "border-top-style": "solid", "border-top-color": "#ccc" },
    "a": { "color": "#0000ee", "text-decoration": "underline" },
    "b": { "font-weight": "bold" },
    "strong": { "font-weight": "bold" },
    "i": { "font-style": "italic" },
    "em": { "font-style": "italic" },
    "small": { "font-size": "13px" },
    "center": { "text-align": "center" },
    "font": {},
  };

  /**
   * Apply user-agent default styles to a computed style.
   * Only sets properties that the author stylesheet hasn't already set.
   */
  private applyUADefaults(tagName: string | undefined, style: ComputedStyle): void {
    if (!tagName) return;
    const tag = tagName.toLowerCase();

    // Apply UA display defaults if author didn't set display
    const authorDisplay = style.getPropertyValue("display");
    if (!authorDisplay || authorDisplay === "inline") {
      // Table elements get their specific display values (must check before block)
      if (tag in RenderTreeBuilder.UA_TABLE_ELEMENTS) {
        style.setProperty("display", RenderTreeBuilder.UA_TABLE_ELEMENTS[tag]);
      } else if (RenderTreeBuilder.UA_BLOCK_ELEMENTS.has(tag)) {
        style.setProperty("display", "block");
      } else if (RenderTreeBuilder.UA_LIST_ITEM_ELEMENTS.has(tag)) {
        style.setProperty("display", "list-item");
      }
    }

    // Apply UA styles (font-size, margins, etc.)
    const uaStyles = RenderTreeBuilder.UA_STYLES[tag];
    if (uaStyles) {
      for (const [prop, val] of Object.entries(uaStyles)) {
        const authorVal = style.getPropertyValue(prop);
        // Only apply if author didn't explicitly set this property
        if (!authorVal || authorVal === "0" || authorVal === "medium" || authorVal === "normal" || authorVal === "serif") {
          style.setProperty(prop, val);
        }
      }
    }
  }

  /**
   * Apply HTML presentational attributes (bgcolor, color, width, align, font tag, etc.)
   * These have lower specificity than CSS — only apply if no author style is set.
   */
  private applyPresentationalAttributes(element: DOMElement, style: ComputedStyle): void {
    if (!element.getAttribute) return;
    const tag = element.tagName?.toLowerCase();

    // bgcolor attribute → background-color
    const bgcolor = element.getAttribute("bgcolor");
    if (bgcolor) {
      const existing = style.getPropertyValue("background-color");
      if (!existing || existing === "transparent" || existing === "rgba(0, 0, 0, 0)") {
        style.setProperty("background-color", bgcolor);
      }
    }

    // color attribute → color
    const color = element.getAttribute("color");
    if (color && !style.getPropertyValue("color")) {
      style.setProperty("color", color.startsWith("#") ? color : color);
    }

    // width attribute → width (on table, td, th, img, etc.)
    const width = element.getAttribute("width");
    if (width) {
      const w = width.endsWith("%") ? width : width + "px";
      if (!style.getPropertyValue("width")) style.setProperty("width", w);
    }

    // height attribute
    const height = element.getAttribute("height");
    if (height) {
      const h = height.endsWith("%") ? height : height + "px";
      if (!style.getPropertyValue("height")) style.setProperty("height", h);
    }

    // align attribute → text-align
    const align = element.getAttribute("align");
    if (align && !style.getPropertyValue("text-align")) {
      style.setProperty("text-align", align.toLowerCase());
    }

    // valign attribute → vertical-align
    const valign = element.getAttribute("valign");
    if (valign && !style.getPropertyValue("vertical-align")) {
      style.setProperty("vertical-align", valign.toLowerCase());
    }

    // cellpadding on table → padding on td/th children (stored as data for layout)
    const cellpadding = element.getAttribute("cellpadding");
    if (cellpadding && (tag === "table")) {
      style.setProperty("--cellpadding", cellpadding + "px");
    }

    // cellspacing on table → border-spacing
    const cellspacing = element.getAttribute("cellspacing");
    if (cellspacing && (tag === "table") && !style.getPropertyValue("border-spacing")) {
      style.setProperty("border-spacing", cellspacing + "px");
    }

    // border attribute
    const border = element.getAttribute("border");
    if (border && !style.getPropertyValue("border-width")) {
      const bw = border === "0" ? "0" : (border + "px");
      style.setProperty("border-width", bw);
      if (border !== "0") {
        style.setProperty("border-style", "solid");
        style.setProperty("border-color", "#000");
      }
    }

    // <font> tag attributes
    if (tag === "font") {
      const fcolor = element.getAttribute("color");
      if (fcolor) style.setProperty("color", fcolor);
      const fsize = element.getAttribute("size");
      if (fsize) {
        // HTML font size: 1-7 maps to CSS px values
        const sizeMap: Record<string, string> = {
          "1": "10px", "2": "13px", "3": "16px", "4": "18px",
          "5": "24px", "6": "32px", "7": "48px",
          "-2": "10px", "-1": "13px", "+0": "16px",
          "+1": "18px", "+2": "24px", "+3": "32px", "+4": "48px",
        };
        style.setProperty("font-size", sizeMap[fsize] || "16px");
      }
      const fface = element.getAttribute("face");
      if (fface) style.setProperty("font-family", fface);
    }

    // Inherit cellpadding from parent table to td/th
    if (tag === "td" || tag === "th") {
      // Walk up to find parent table's cellpadding
      let parent = element.parentNode;
      while (parent) {
        const pEl = parent as DOMElement;
        if (pEl.tagName?.toLowerCase() === "table") {
          const cp = pEl.getAttribute?.("cellpadding");
          if (cp && cp !== "0" && !style.getPropertyValue("padding")) {
            style.setProperty("padding", cp + "px");
          }
          break;
        }
        parent = pEl.parentNode;
      }
    }
  }

  /**
   * Create appropriate RenderObject type based on element and style
   */
  private createRenderObject(element: DOMElement, style: ComputedStyle): RenderObject {
    const tagName = element.tagName?.toLowerCase();

    // Apply user-agent default styles
    this.applyUADefaults(tagName, style);

    // Apply HTML presentational attributes
    this.applyPresentationalAttributes(element, style);

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
