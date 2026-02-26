/**
 * LayoutBox - Geometry and box model for layout
 * Implements the LayoutBox interface from types/rendering.ts
 */

import type { Pixels } from "../../../types/identifiers.ts";
import type { LayoutBox as ILayoutBox } from "../../../types/rendering.ts";

/**
 * LayoutBox class implementing box model calculations
 */
export class LayoutBoxImpl implements ILayoutBox {
  x: Pixels = 0 as Pixels;
  y: Pixels = 0 as Pixels;
  width: Pixels = 0 as Pixels;
  height: Pixels = 0 as Pixels;
  marginTop: Pixels = 0 as Pixels;
  marginRight: Pixels = 0 as Pixels;
  marginBottom: Pixels = 0 as Pixels;
  marginLeft: Pixels = 0 as Pixels;
  paddingTop: Pixels = 0 as Pixels;
  paddingRight: Pixels = 0 as Pixels;
  paddingBottom: Pixels = 0 as Pixels;
  paddingLeft: Pixels = 0 as Pixels;
  borderTopWidth: Pixels = 0 as Pixels;
  borderRightWidth: Pixels = 0 as Pixels;
  borderBottomWidth: Pixels = 0 as Pixels;
  borderLeftWidth: Pixels = 0 as Pixels;

  /** Optional DOM node ID for CDP DOM-layout correlation */
  nodeId?: number;

  /**
   * Get content box dimensions
   */
  getContentBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels } {
    return {
      x: (this.x + this.marginLeft + this.borderLeftWidth + this.paddingLeft) as Pixels,
      y: (this.y + this.marginTop + this.borderTopWidth + this.paddingTop) as Pixels,
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Get padding box dimensions
   */
  getPaddingBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels } {
    return {
      x: (this.x + this.marginLeft + this.borderLeftWidth) as Pixels,
      y: (this.y + this.marginTop + this.borderTopWidth) as Pixels,
      width: (this.width + this.paddingLeft + this.paddingRight) as Pixels,
      height: (this.height + this.paddingTop + this.paddingBottom) as Pixels,
    };
  }

  /**
   * Get border box dimensions
   */
  getBorderBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels } {
    return {
      x: (this.x + this.marginLeft) as Pixels,
      y: (this.y + this.marginTop) as Pixels,
      width: (this.width + this.paddingLeft + this.paddingRight +
        this.borderLeftWidth + this.borderRightWidth) as Pixels,
      height: (this.height + this.paddingTop + this.paddingBottom +
        this.borderTopWidth + this.borderBottomWidth) as Pixels,
    };
  }

  /**
   * Get margin box dimensions
   */
  getMarginBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels } {
    return {
      x: this.x,
      y: this.y,
      width: this.getTotalWidth(),
      height: this.getTotalHeight(),
    };
  }

  /**
   * Get total width including margin, border, and padding
   */
  getTotalWidth(): Pixels {
    return (this.width + this.paddingLeft + this.paddingRight +
      this.borderLeftWidth + this.borderRightWidth +
      this.marginLeft + this.marginRight) as Pixels;
  }

  /**
   * Get total height including margin, border, and padding
   */
  getTotalHeight(): Pixels {
    return (this.height + this.paddingTop + this.paddingBottom +
      this.borderTopWidth + this.borderBottomWidth +
      this.marginTop + this.marginBottom) as Pixels;
  }
}

/**
 * Legacy interface for backwards compatibility
 */
export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
}

/**
 * Create a new LayoutBox instance with proper methods
 */
export function createLayoutBox(): LayoutBoxImpl {
  return new LayoutBoxImpl();
}
