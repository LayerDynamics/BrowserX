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
        color: string,
        fontSize: number,
        fontFamily: string,
    ): void {
        this.commands.push({
            type: PaintCommandType.FILL_TEXT,
            params: { text, x, y, color, fontSize, fontFamily },
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
}
