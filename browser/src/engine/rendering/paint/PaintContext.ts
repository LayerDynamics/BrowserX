/**
 * Paint Context - Paint command collection
 */

import type { PaintCommand } from "./PaintCommand.ts";
import type { Pixels } from "../../../types/identifiers.ts";
import { PaintCommandType } from "../../../types/rendering.ts";

export class PaintContext {
  public commands: PaintCommand[] = [];

  /**
   * Add paint command
   */
  addCommand(command: PaintCommand): void {
    this.commands.push(command);
  }

  /**
   * Get all paint commands
   */
  getCommands(): PaintCommand[] {
    return this.commands;
  }

  /**
   * Fill rectangle
   */
  fillRect(x: Pixels, y: Pixels, width: Pixels, height: Pixels, color: string): void {
    this.commands.push({
      type: PaintCommandType.FILL_RECT,
      params: { x, y, width, height, color },
    });
  }

  /**
   * Stroke rectangle
   */
  strokeRect(
    x: Pixels,
    y: Pixels,
    width: Pixels,
    height: Pixels,
    color: string,
    lineWidth: Pixels,
  ): void {
    this.commands.push({
      type: PaintCommandType.STROKE_RECT,
      params: { x, y, width, height, color, lineWidth },
    });
  }

  /**
   * Fill text
   */
  fillText(
    text: string,
    x: Pixels,
    y: Pixels,
    font: string,
    color: string,
  ): void {
    this.commands.push({
      type: PaintCommandType.FILL_TEXT,
      params: { text, x, y, font, color },
    });
  }

  /**
   * Draw image
   */
  drawImage(src: string, x: Pixels, y: Pixels, width: Pixels, height: Pixels): void {
    this.commands.push({
      type: PaintCommandType.DRAW_IMAGE,
      params: { src, x, y, width, height },
    });
  }

  /**
   * Save graphics state
   */
  save(): void {
    this.commands.push({
      type: PaintCommandType.SAVE,
      params: {},
    });
  }

  /**
   * Restore graphics state
   */
  restore(): void {
    this.commands.push({
      type: PaintCommandType.RESTORE,
      params: {},
    });
  }

  /**
   * Apply transform matrix to current graphics state
   */
  transform(matrix: import("../../../types/rendering.ts").TransformMatrix): void {
    this.commands.push({
      type: PaintCommandType.TRANSFORM,
      params: { matrix },
    });
  }

  /**
   * Set opacity
   */
  setOpacity(opacity: number): void {
    this.commands.push({
      type: PaintCommandType.SET_GLOBAL_ALPHA,
      params: { alpha: opacity },
    });
  }

  /**
   * Set shadow
   */
  setShadow(offsetX: Pixels, offsetY: Pixels, blur: Pixels, color: string): void {
    this.commands.push({
      type: PaintCommandType.SET_SHADOW,
      params: { offsetX, offsetY, blur, color },
    });
  }

  /**
   * Clear shadow
   */
  clearShadow(): void {
    this.commands.push({
      type: PaintCommandType.SET_SHADOW,
      params: { offsetX: 0, offsetY: 0, blur: 0, color: "transparent" },
    });
  }

  /**
   * Set font
   */
  setFont(font: string): void {
    this.commands.push({
      type: PaintCommandType.SET_FONT,
      params: { font },
    });
  }

  /**
   * Fill rounded rectangle
   */
  fillRoundedRect(
    x: Pixels,
    y: Pixels,
    width: Pixels,
    height: Pixels,
    color: string,
    radii: [number, number, number, number],
  ): void {
    this.commands.push({
      type: PaintCommandType.FILL_ROUNDED_RECT,
      params: { x, y, width, height, color, radii },
    });
  }

  /**
   * Stroke rounded rectangle
   */
  strokeRoundedRect(
    x: Pixels,
    y: Pixels,
    width: Pixels,
    height: Pixels,
    color: string,
    lineWidth: Pixels,
    radii: [number, number, number, number],
  ): void {
    this.commands.push({
      type: PaintCommandType.STROKE_ROUNDED_RECT,
      params: { x, y, width, height, color, lineWidth, radii },
    });
  }
}
