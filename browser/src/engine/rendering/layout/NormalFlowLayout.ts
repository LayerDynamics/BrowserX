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
 * Float rect — tracks a floated element's occupied region
 */
export interface FloatRect {
  x: Pixels;
  y: Pixels;
  width: Pixels;
  height: Pixels;
  side: "left" | "right";
}

/**
 * Float context — tracks active floats within a BFC
 */
export class FloatContext {
  private leftFloats: FloatRect[] = [];
  private rightFloats: FloatRect[] = [];

  addFloat(rect: FloatRect): void {
    if (rect.side === "left") {
      this.leftFloats.push(rect);
    } else {
      this.rightFloats.push(rect);
    }
  }

  /**
   * Get available width at a given Y position, accounting for active floats
   */
  getAvailableWidthAt(y: Pixels, containerWidth: Pixels): {
    leftOffset: Pixels;
    availableWidth: Pixels;
  } {
    let leftOffset = 0;
    let rightOffset = 0;

    for (const f of this.leftFloats) {
      if (y >= f.y && y < (f.y + f.height)) {
        leftOffset = Math.max(leftOffset, f.x + f.width);
      }
    }

    for (const f of this.rightFloats) {
      if (y >= f.y && y < (f.y + f.height)) {
        rightOffset = Math.max(rightOffset, containerWidth - f.x);
      }
    }

    return {
      leftOffset: leftOffset as Pixels,
      availableWidth: Math.max(0, containerWidth - leftOffset - rightOffset) as Pixels,
    };
  }

  /**
   * Get the Y position past all floats of the given side (for clear)
   */
  getClearY(side: "left" | "right" | "both"): Pixels {
    let maxY = 0;

    if (side === "left" || side === "both") {
      for (const f of this.leftFloats) {
        maxY = Math.max(maxY, f.y + f.height);
      }
    }

    if (side === "right" || side === "both") {
      for (const f of this.rightFloats) {
        maxY = Math.max(maxY, f.y + f.height);
      }
    }

    return maxY as Pixels;
  }

  /**
   * Get the next Y position for placing a float of the given side
   */
  getNextFloatY(side: "left" | "right", containerWidth: Pixels): Pixels {
    const floats = side === "left" ? this.leftFloats : this.rightFloats;
    let maxY = 0;
    for (const f of floats) {
      maxY = Math.max(maxY, f.y + f.height);
    }
    return maxY as Pixels;
  }

  getLeftFloats(): FloatRect[] {
    return [...this.leftFloats];
  }

  getRightFloats(): FloatRect[] {
    return [...this.rightFloats];
  }
}

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
  /** Float context for the current BFC */
  private floatContext: FloatContext = new FloatContext();

  /**
   * Get the current float context
   */
  getFloatContext(): FloatContext {
    return this.floatContext;
  }

  /**
   * Reset float context (for new BFC)
   */
  resetFloatContext(): void {
    this.floatContext = new FloatContext();
  }

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

    const containerWidth = this.getAvailableWidth(parent);
    let currentY = 0 as Pixels;
    let previousMarginBottom = 0 as Pixels;

    // Reset float context for new BFC
    this.resetFloatContext();

    for (const child of children) {
      // Check if child is floated
      const floatValue = child.style.getPropertyValue("float");
      if (floatValue === "left" || floatValue === "right") {
        this.layoutFloatInContext(child as RenderBox, parent, currentY);
        continue;
      }

      // Handle clear property
      const clearValue = child.style.getPropertyValue("clear");
      if (clearValue === "left" || clearValue === "right" || clearValue === "both") {
        const clearY = this.floatContext.getClearY(clearValue);
        if (clearY > currentY) {
          currentY = clearY;
          previousMarginBottom = 0 as Pixels;
        }
      }

      // Get available width accounting for floats at current Y
      const parentContentY = (parent.layout.y + parent.layout.paddingTop + currentY);
      const { leftOffset, availableWidth } = this.floatContext.getAvailableWidthAt(
        parentContentY as Pixels,
        containerWidth,
      );

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

      // Position child — offset by float exclusion zone
      const childX = (parent.layout.x +
        parent.layout.paddingLeft +
        leftOffset +
        child.layout.marginLeft) as Pixels;
      const childY = (parent.layout.y +
        parent.layout.paddingTop +
        currentY +
        collapsedMargin) as Pixels;

      child.setPosition(childX, childY);

      // Update Y position for next child
      const childHeight = child.layout.getTotalHeight();
      const heightWithoutMargins = (childHeight -
        child.layout.marginTop -
        child.layout.marginBottom) as Pixels;

      currentY = (currentY + collapsedMargin + heightWithoutMargins) as Pixels;
      previousMarginBottom = child.layout.marginBottom;
    }

    // Add final bottom margin to height
    // Also ensure height encompasses all floats
    const floatClearY = this.floatContext.getClearY("both");
    const contentHeight = (currentY + previousMarginBottom) as Pixels;
    return Math.max(contentHeight, floatClearY) as Pixels;
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

    const containerWidth = this.getAvailableWidth(parent);

    // Position lines vertically, accounting for float exclusion zones
    let currentY = 0 as Pixels;

    // Get available width at current Y accounting for floats
    const parentContentY = (parent.layout.y + parent.layout.paddingTop + currentY);
    const { leftOffset, availableWidth } = this.floatContext.getAvailableWidthAt(
      parentContentY as Pixels,
      containerWidth,
    );

    const lines = this.buildLines(parent, children, availableWidth);

    for (const line of lines) {
      // Re-check float exclusion at each line's Y
      const lineAbsY = (parent.layout.y + parent.layout.paddingTop + currentY);
      const floatInfo = this.floatContext.getAvailableWidthAt(
        lineAbsY as Pixels,
        containerWidth,
      );

      line.y = currentY;

      // Position boxes in line — offset by float exclusion
      for (const box of line.boxes) {
        const finalX = (parent.layout.x + parent.layout.paddingLeft +
          floatInfo.leftOffset + box.x) as Pixels;
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
   * Uses font metrics (~75% ascent) for text, bottom edge for replaced elements
   */
  private calculateBaseline(renderObject: RenderObject): Pixels {
    if (!renderObject.layout) {
      return 0 as Pixels;
    }

    const isText = renderObject.constructor.name === "RenderText";

    if (isText) {
      // Font baseline is approximately 75% of font-size (ascent)
      // relative to the top of the line box
      const fontSize = renderObject.getPixelValue("font-size", 16 as Pixels);
      const lineHeight = renderObject.layout.height;
      // Baseline = half-leading + ascent
      const leading = (lineHeight - fontSize);
      const ascent = fontSize * 0.75;
      return (leading / 2 + ascent) as Pixels;
    } else if (typeof renderObject.isReplaced === "function" && renderObject.isReplaced()) {
      // Replaced elements: baseline at bottom edge
      return renderObject.layout.height as Pixels;
    } else {
      // Inline boxes: baseline from last inline child, or bottom of content
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
    // CSS 2.1 §10.3.5: shrink-to-fit width
    // Result = min(max(preferredMinimumWidth, availableWidth), preferredWidth)

    // Check for explicit width first
    const explicitWidth = renderObject.style.getPropertyValue("width");
    if (explicitWidth && explicitWidth !== "auto") {
      const px = renderObject.getPixelValue("width");
      if (px > 0) return this.applyWidthConstraints(renderObject, px);
    }

    // Calculate preferred width (widest without any line breaks)
    // and preferred minimum width (narrowest with breaks at every opportunity)
    const { preferredWidth, preferredMinimumWidth } = this.measureContentWidths(renderObject);

    // Apply formula: min(max(preferredMinimum, available), preferred)
    const result = Math.min(
      Math.max(preferredMinimumWidth, availableWidth),
      preferredWidth,
    ) as Pixels;

    return this.applyWidthConstraints(renderObject, result);
  }

  /**
   * Measure content to determine preferred and preferred minimum widths.
   * - Preferred width: layout all content on one infinitely wide line
   * - Preferred minimum width: break at every opportunity (longest unbreakable run)
   */
  private measureContentWidths(renderObject: RenderObject): {
    preferredWidth: Pixels;
    preferredMinimumWidth: Pixels;
  } {
    let preferredWidth = 0;
    let preferredMinimumWidth = 0;

    const children = renderObject.children ?? [];
    if (children.length === 0) {
      return { preferredWidth: 0 as Pixels, preferredMinimumWidth: 0 as Pixels };
    }

    // Determine formatting context: if any child is block-level, use block context
    const context = this.getChildrenFormattingContext(children);

    if (context === FormattingContext.INLINE) {
      // Inline context: content flows horizontally
      // Preferred width = sum of all inline content widths (no wrapping)
      // Preferred minimum = max of individual word/element widths
      let lineWidth = 0;

      for (const child of children) {
        if (this.isTextNode(child)) {
          const text = (child as RenderText).getText();
          const fontSize = child.getPixelValue("font-size", 16 as Pixels);
          const avgCharWidth = fontSize * 0.6;

          // Preferred: full text width without wrapping
          const fullWidth = text.length * avgCharWidth;
          lineWidth += fullWidth;

          // Minimum: longest word (break at spaces)
          const words = text.split(/\s+/);
          for (const word of words) {
            const wordWidth = word.length * avgCharWidth;
            preferredMinimumWidth = Math.max(preferredMinimumWidth, wordWidth);
          }
        } else {
          // Inline element or inline-block: measure recursively
          const childWidths = this.measureContentWidths(child);
          const display = child.style.getPropertyValue("display");

          if (display === "inline-block") {
            // Inline-block is an atomic inline — can't break inside
            lineWidth += childWidths.preferredWidth;
            preferredMinimumWidth = Math.max(
              preferredMinimumWidth,
              childWidths.preferredMinimumWidth,
            );
          } else {
            // Inline element: content participates in line
            lineWidth += childWidths.preferredWidth;
            preferredMinimumWidth = Math.max(
              preferredMinimumWidth,
              childWidths.preferredMinimumWidth,
            );
          }

          // Add horizontal margins/padding/border
          if (child.layout) {
            const extra = child.layout.marginLeft + child.layout.paddingLeft +
              child.layout.borderLeftWidth + child.layout.paddingRight +
              child.layout.borderRightWidth + child.layout.marginRight;
            lineWidth += extra;
          }
        }
      }
      preferredWidth = Math.max(preferredWidth, lineWidth);
    } else {
      // Block context: children stack vertically
      // Preferred width = max child preferred width
      // Preferred minimum = max child preferred minimum width
      for (const child of children) {
        const childExplicitWidth = child.style.getPropertyValue("width");
        if (childExplicitWidth && childExplicitWidth !== "auto") {
          const px = child.getPixelValue("width");
          if (px > 0) {
            let totalWidth = px;
            if (child.layout) {
              totalWidth += child.layout.marginLeft + child.layout.paddingLeft +
                child.layout.borderLeftWidth + child.layout.paddingRight +
                child.layout.borderRightWidth + child.layout.marginRight;
            }
            preferredWidth = Math.max(preferredWidth, totalWidth);
            preferredMinimumWidth = Math.max(preferredMinimumWidth, totalWidth);
            continue;
          }
        }

        const childWidths = this.measureContentWidths(child);
        let extra = 0;
        if (child.layout) {
          extra = child.layout.marginLeft + child.layout.paddingLeft +
            child.layout.borderLeftWidth + child.layout.paddingRight +
            child.layout.borderRightWidth + child.layout.marginRight;
        }
        preferredWidth = Math.max(preferredWidth, childWidths.preferredWidth + extra);
        preferredMinimumWidth = Math.max(
          preferredMinimumWidth,
          childWidths.preferredMinimumWidth + extra,
        );
      }
    }

    return {
      preferredWidth: preferredWidth as Pixels,
      preferredMinimumWidth: preferredMinimumWidth as Pixels,
    };
  }

  /**
   * Apply min-width and max-width constraints
   */
  private applyWidthConstraints(renderObject: RenderObject, width: Pixels): Pixels {
    const minWidth = renderObject.getPixelValue("min-width");
    const maxWidth = renderObject.getPixelValue("max-width", Number.POSITIVE_INFINITY as Pixels);

    let result = width;
    if (minWidth > 0) {
      result = Math.max(result, minWidth) as Pixels;
    }
    if (maxWidth > 0 && maxWidth < Number.POSITIVE_INFINITY) {
      result = Math.min(result, maxWidth) as Pixels;
    }
    return result as Pixels;
  }

  /**
   * Check if a render object is a text node
   */
  private isTextNode(obj: RenderObject): obj is RenderText {
    return "getText" in obj && typeof (obj as RenderText).getText === "function";
  }

  /**
   * Determine formatting context from a list of children.
   * If any child is block-level, the context is block; otherwise inline.
   */
  private getChildrenFormattingContext(children: RenderObject[]): FormattingContext {
    for (const child of children) {
      if (this.isTextNode(child)) continue;
      const display = child.style?.getPropertyValue("display") ?? "";
      if (
        display === "block" || display === "flex" || display === "grid" ||
        display === "table" || display === "list-item" || display === "flow-root"
      ) {
        return FormattingContext.BLOCK;
      }
    }
    return FormattingContext.INLINE;
  }

  /**
   * Handle absolutely or fixed positioned element
   * These are removed from normal flow.
   * Fixed elements position relative to viewport, not containing block.
   */
  layoutAbsolutelyPositioned(
    renderObject: RenderBox,
    containingBlock: RenderBox,
    viewport?: { width: Pixels; height: Pixels },
  ): void {
    if (!renderObject.layout || !containingBlock.layout) {
      return;
    }

    const position = renderObject.style.getPropertyValue("position");
    const isFixed = position === "fixed";

    // For fixed positioning, use viewport as containing block
    const cbX = isFixed && viewport ? (0 as Pixels) : containingBlock.layout.x;
    const cbY = isFixed && viewport ? (0 as Pixels) : containingBlock.layout.y;
    const cbWidth = isFixed && viewport ? viewport.width : containingBlock.layout.width;
    const cbHeight = isFixed && viewport ? viewport.height : containingBlock.layout.height;

    // Apply shrink-to-fit width for auto-width
    const widthValue = renderObject.style.getPropertyValue("width");
    if (!widthValue || widthValue === "auto") {
      const shrinkWidth = this.calculateShrinkToFitWidth(renderObject, cbWidth);
      renderObject.layout.width = shrinkWidth;
    }

    // Get position properties
    const top = renderObject.style.getPropertyValue("top");
    const right = renderObject.style.getPropertyValue("right");
    const bottom = renderObject.style.getPropertyValue("bottom");
    const left = renderObject.style.getPropertyValue("left");

    // Calculate position relative to containing block (or viewport for fixed)
    let x = cbX;
    let y = cbY;

    if (left && left !== "auto") {
      x = (cbX + renderObject.getPixelValue("left")) as Pixels;
    } else if (right && right !== "auto") {
      x = (cbX + cbWidth -
        renderObject.layout.width -
        renderObject.getPixelValue("right")) as Pixels;
    }

    if (top && top !== "auto") {
      y = (cbY + renderObject.getPixelValue("top")) as Pixels;
    } else if (bottom && bottom !== "auto") {
      y = (cbY + cbHeight -
        renderObject.layout.height -
        renderObject.getPixelValue("bottom")) as Pixels;
    }

    renderObject.setPosition(x, y);
  }

  /**
   * Handle sticky positioned element
   * Sticky elements are in normal flow but store a sticky offset for scrolling.
   * They behave as relative until scroll reaches their threshold, then fixed
   * within their scroll container.
   */
  layoutStickyPositioned(
    renderObject: RenderBox,
    containingBlock: RenderBox,
    scrollOffset: Pixels = 0 as Pixels,
  ): { stickyOffset: Pixels } {
    if (!renderObject.layout || !containingBlock.layout) {
      return { stickyOffset: 0 as Pixels };
    }

    const top = renderObject.style.getPropertyValue("top");
    const bottom = renderObject.style.getPropertyValue("bottom");

    // Normal flow position (relative behavior)
    const normalY = renderObject.layout.y;

    // Sticky threshold
    let stickyOffset = 0 as Pixels;

    if (top && top !== "auto") {
      const topThreshold = renderObject.getPixelValue("top");
      // If scrolled past the element, stick it at the threshold
      const stickyY = (containingBlock.layout.y + topThreshold) as Pixels;
      if (scrollOffset > 0 && normalY - scrollOffset < stickyY) {
        stickyOffset = (stickyY - (normalY - scrollOffset)) as Pixels;
      }
    } else if (bottom && bottom !== "auto") {
      const bottomThreshold = renderObject.getPixelValue("bottom");
      const containerBottom = (containingBlock.layout.y + containingBlock.layout.height) as Pixels;
      const stickyY = (containerBottom - renderObject.layout.height - bottomThreshold) as Pixels;
      if (normalY + scrollOffset > stickyY) {
        stickyOffset = (stickyY - normalY - scrollOffset) as Pixels;
      }
    }

    // Clamp sticky offset within container bounds
    const containerTop = containingBlock.layout.y;
    const containerBottom = (containingBlock.layout.y + containingBlock.layout.height -
      renderObject.layout.height);
    const adjustedY = (normalY + stickyOffset) as Pixels;
    if (adjustedY < containerTop) {
      stickyOffset = (containerTop - normalY) as Pixels;
    } else if (adjustedY > containerBottom) {
      stickyOffset = (containerBottom - normalY) as Pixels;
    }

    return { stickyOffset };
  }

  /**
   * Layout a float within the current BFC, registering it in the float context
   */
  private layoutFloatInContext(
    renderObject: RenderBox,
    containingBlock: RenderBox,
    currentY: Pixels,
  ): void {
    if (!renderObject.layout || !containingBlock.layout) {
      return;
    }

    const floatSide = renderObject.style.getPropertyValue("float") as "left" | "right";
    const containerWidth = this.getAvailableWidth(containingBlock);

    // Apply shrink-to-fit width
    const widthValue = renderObject.style.getPropertyValue("width");
    if (!widthValue || widthValue === "auto") {
      const shrinkWidth = this.calculateShrinkToFitWidth(renderObject, containerWidth);
      renderObject.layout.width = shrinkWidth;
    }

    // Layout children to determine height
    renderObject.doLayout({
      minWidth: 0 as Pixels,
      maxWidth: renderObject.layout.width,
      minHeight: 0 as Pixels,
      maxHeight: Number.POSITIVE_INFINITY as Pixels,
    });

    const absY = (containingBlock.layout.y + containingBlock.layout.paddingTop + currentY) as Pixels;

    let x: Pixels;
    if (floatSide === "left") {
      x = (containingBlock.layout.x + containingBlock.layout.paddingLeft) as Pixels;
    } else {
      x = (containingBlock.layout.x + containingBlock.layout.paddingLeft +
        containerWidth - renderObject.layout.width) as Pixels;
    }

    renderObject.setPosition(x, absY);

    // Register in float context
    this.floatContext.addFloat({
      x: (x - containingBlock.layout.x - containingBlock.layout.paddingLeft) as Pixels,
      y: currentY,
      width: renderObject.layout.width,
      height: renderObject.layout.height || renderObject.layout.getTotalHeight(),
      side: floatSide,
    });
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

    // Apply shrink-to-fit width for auto-width floated elements
    const widthValue = renderObject.style.getPropertyValue("width");
    if (!widthValue || widthValue === "auto") {
      const availableWidth = containingBlock.layout.width as Pixels;
      const shrinkWidth = this.calculateShrinkToFitWidth(renderObject, availableWidth);
      renderObject.layout.width = shrinkWidth;
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
