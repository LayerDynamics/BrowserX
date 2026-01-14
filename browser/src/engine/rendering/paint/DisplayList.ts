/**
 * Display List - Paint command recording and replay
 *
 * A display list is a recorded sequence of drawing commands that can be
 * replayed to render the scene. This allows efficient re-rendering and
 * enables features like damage tracking and layer compositing.
 */

import type { Pixels } from "../../../types/identifiers.ts";
import type { CanvasRenderingContext2D } from "../../../types/dom.ts";
import type { PaintCommand } from "./PaintCommand.ts";
import { PaintCommandType } from "./PaintCommand.ts";

// Re-export for compatibility
export type { PaintCommand };
export { PaintCommandType };

/**
 * Save canvas state
 */
export interface SaveCommand extends PaintCommand {
    type: PaintCommandType.SAVE;
}

/**
 * Restore canvas state
 */
export interface RestoreCommand extends PaintCommand {
    type: PaintCommandType.RESTORE;
}

/**
 * Translate command
 */
export interface TranslateCommand extends PaintCommand {
    type: PaintCommandType.TRANSLATE;
    x: Pixels;
    y: Pixels;
}

/**
 * Scale command
 */
export interface ScaleCommand extends PaintCommand {
    type: PaintCommandType.SCALE;
    x: number;
    y: number;
}

/**
 * Rotate command
 */
export interface RotateCommand extends PaintCommand {
    type: PaintCommandType.ROTATE;
    angle: number;
}

/**
 * Clip rect command
 */
export interface ClipRectCommand extends PaintCommand {
    type: PaintCommandType.CLIP_RECT;
    x: Pixels;
    y: Pixels;
    width: Pixels;
    height: Pixels;
}

/**
 * Fill rect command
 */
export interface FillRectCommand extends PaintCommand {
    type: PaintCommandType.FILL_RECT;
    x: Pixels;
    y: Pixels;
    width: Pixels;
    height: Pixels;
    color: string;
}

/**
 * Stroke rect command
 */
export interface StrokeRectCommand extends PaintCommand {
    type: PaintCommandType.STROKE_RECT;
    x: Pixels;
    y: Pixels;
    width: Pixels;
    height: Pixels;
    color: string;
    lineWidth: Pixels;
}

/**
 * Fill text command
 */
export interface FillTextCommand extends PaintCommand {
    type: PaintCommandType.FILL_TEXT;
    text: string;
    x: Pixels;
    y: Pixels;
    font: string;
    color: string;
}

/**
 * Stroke text command
 */
export interface StrokeTextCommand extends PaintCommand {
    type: PaintCommandType.STROKE_TEXT;
    text: string;
    x: Pixels;
    y: Pixels;
    font: string;
    color: string;
    lineWidth: Pixels;
}

/**
 * Draw image command
 */
export interface DrawImageCommand extends PaintCommand {
    type: PaintCommandType.DRAW_IMAGE;
    src: string;
    x: Pixels;
    y: Pixels;
    width: Pixels;
    height: Pixels;
}

/**
 * Set fill style command
 */
export interface SetFillStyleCommand extends PaintCommand {
    type: PaintCommandType.SET_FILL_STYLE;
    style: string;
}

/**
 * Set stroke style command
 */
export interface SetStrokeStyleCommand extends PaintCommand {
    type: PaintCommandType.SET_STROKE_STYLE;
    style: string;
}

/**
 * Set line width command
 */
export interface SetLineWidthCommand extends PaintCommand {
    type: PaintCommandType.SET_LINE_WIDTH;
    width: Pixels;
}

/**
 * Set font command
 */
export interface SetFontCommand extends PaintCommand {
    type: PaintCommandType.SET_FONT;
    font: string;
}

/**
 * Set global alpha command
 */
export interface SetGlobalAlphaCommand extends PaintCommand {
    type: PaintCommandType.SET_GLOBAL_ALPHA;
    alpha: number;
}

/**
 * Set shadow command
 */
export interface SetShadowCommand extends PaintCommand {
    type: PaintCommandType.SET_SHADOW;
    offsetX: Pixels;
    offsetY: Pixels;
    blur: Pixels;
    color: string;
}

/**
 * Union of all command types
 */
export type AnyPaintCommand =
    | SaveCommand
    | RestoreCommand
    | TranslateCommand
    | ScaleCommand
    | RotateCommand
    | ClipRectCommand
    | FillRectCommand
    | StrokeRectCommand
    | FillTextCommand
    | StrokeTextCommand
    | DrawImageCommand
    | SetFillStyleCommand
    | SetStrokeStyleCommand
    | SetLineWidthCommand
    | SetFontCommand
    | SetGlobalAlphaCommand
    | SetShadowCommand;

/**
 * Bounding box for damage tracking
 */
export interface BoundingBox {
    x: Pixels;
    y: Pixels;
    width: Pixels;
    height: Pixels;
}

/**
 * DisplayList
 * Records and replays paint commands
 */
export class DisplayList {
    private commands: AnyPaintCommand[] = [];
    private boundingBox: BoundingBox | null = null;

    /**
     * Add a command to the display list
     */
    add(command: AnyPaintCommand): void {
        this.commands.push(command);
        this.updateBoundingBox(command);
    }

    /**
     * Get all commands
     */
    getCommands(): ReadonlyArray<AnyPaintCommand> {
        return this.commands;
    }

    /**
     * Clear all commands
     */
    clear(): void {
        this.commands = [];
        this.boundingBox = null;
    }

    /**
     * Get number of commands
     */
    length(): number {
        return this.commands.length;
    }

    /**
     * Get bounding box of all paint operations
     */
    getBoundingBox(): BoundingBox | null {
        return this.boundingBox ? { ...this.boundingBox } : null;
    }

    /**
     * Update bounding box based on command
     */
    private updateBoundingBox(command: AnyPaintCommand): void {
        let commandBox: BoundingBox | null = null;

        switch (command.type) {
            case PaintCommandType.FILL_RECT:
            case PaintCommandType.STROKE_RECT:
            case PaintCommandType.CLIP_RECT:
                commandBox = {
                    x: command.x,
                    y: command.y,
                    width: command.width,
                    height: command.height,
                };
                break;

            case PaintCommandType.DRAW_IMAGE:
                commandBox = {
                    x: command.x,
                    y: command.y,
                    width: command.width,
                    height: command.height,
                };
                break;

                // Text and other commands would need proper measurement
                // Simplified here
        }

        if (commandBox) {
            if (!this.boundingBox) {
                this.boundingBox = commandBox;
            } else {
                // Expand bounding box to include new command
                const minX = Math.min(this.boundingBox.x, commandBox.x) as Pixels;
                const minY = Math.min(this.boundingBox.y, commandBox.y) as Pixels;
                const maxX = Math.max(
                    this.boundingBox.x + this.boundingBox.width,
                    commandBox.x + commandBox.width,
                ) as Pixels;
                const maxY = Math.max(
                    this.boundingBox.y + this.boundingBox.height,
                    commandBox.y + commandBox.height,
                ) as Pixels;

                this.boundingBox = {
                    x: minX,
                    y: minY,
                    width: (maxX - minX) as Pixels,
                    height: (maxY - minY) as Pixels,
                };
            }
        }
    }

    /**
     * Replay commands on a canvas context
     * This is a simplified implementation - real implementation would use
     * actual canvas 2D context or GPU commands
     */
    replay(context: CanvasRenderingContext2D): void {
        for (const command of this.commands) {
            this.executeCommand(context, command);
        }
    }

    /**
     * Execute a single command
     */
    private executeCommand(context: CanvasRenderingContext2D, command: AnyPaintCommand): void {
        switch (command.type) {
            case PaintCommandType.SAVE:
                context.save();
                break;

            case PaintCommandType.RESTORE:
                context.restore();
                break;

            case PaintCommandType.TRANSLATE:
                context.translate(command.x, command.y);
                break;

            case PaintCommandType.SCALE:
                context.scale(command.x, command.y);
                break;

            case PaintCommandType.ROTATE:
                context.rotate(command.angle);
                break;

            case PaintCommandType.CLIP_RECT:
                context.beginPath();
                context.rect(command.x, command.y, command.width, command.height);
                context.clip();
                break;

            case PaintCommandType.FILL_RECT:
                context.fillStyle = command.color;
                context.fillRect(command.x, command.y, command.width, command.height);
                break;

            case PaintCommandType.STROKE_RECT:
                context.strokeStyle = command.color;
                context.lineWidth = command.lineWidth;
                context.strokeRect(command.x, command.y, command.width, command.height);
                break;

            case PaintCommandType.FILL_TEXT:
                context.font = command.font;
                context.fillStyle = command.color;
                context.fillText(command.text, command.x, command.y);
                break;

            case PaintCommandType.STROKE_TEXT:
                context.font = command.font;
                context.strokeStyle = command.color;
                context.lineWidth = command.lineWidth;
                context.strokeText(command.text, command.x, command.y);
                break;

            case PaintCommandType.DRAW_IMAGE:
                // Image drawing would require loading the image first
                // Simplified here
                break;

            case PaintCommandType.SET_FILL_STYLE:
                context.fillStyle = command.style;
                break;

            case PaintCommandType.SET_STROKE_STYLE:
                context.strokeStyle = command.style;
                break;

            case PaintCommandType.SET_LINE_WIDTH:
                context.lineWidth = command.width;
                break;

            case PaintCommandType.SET_FONT:
                context.font = command.font;
                break;

            case PaintCommandType.SET_GLOBAL_ALPHA:
                context.globalAlpha = command.alpha;
                break;

            case PaintCommandType.SET_SHADOW:
                context.shadowOffsetX = command.offsetX;
                context.shadowOffsetY = command.offsetY;
                context.shadowBlur = command.blur;
                context.shadowColor = command.color;
                break;
        }
    }

    /**
     * Serialize display list to binary format
     * Used for sending to compositor thread or caching
     */
    serialize(): Uint8Array {
        const json = JSON.stringify(this.commands);
        const encoder = new TextEncoder();
        return encoder.encode(json);
    }

    /**
     * Deserialize display list from binary format
     */
    static deserialize(data: Uint8Array): DisplayList {
        const decoder = new TextDecoder();
        const json = decoder.decode(data);
        const commands = JSON.parse(json) as AnyPaintCommand[];

        const displayList = new DisplayList();
        for (const command of commands) {
            displayList.add(command);
        }

        return displayList;
    }

    /**
     * Create a sub-list with commands in a specific region
     * Used for partial repainting
     */
    clip(region: BoundingBox): DisplayList {
        const clipped = new DisplayList();

        for (const command of this.commands) {
            // Check if command intersects with region
            if (this.commandIntersectsRegion(command, region)) {
                clipped.add(command);
            }
        }

        return clipped;
    }

    /**
     * Check if a command intersects with a region
     */
    private commandIntersectsRegion(command: AnyPaintCommand, region: BoundingBox): boolean {
        // Simplified - only check rect commands
        if ("x" in command && "y" in command && "width" in command && "height" in command) {
            return this.boxesIntersect(
                { x: command.x, y: command.y, width: command.width, height: command.height },
                region,
            );
        }

        // Other commands assumed to intersect
        return true;
    }

    /**
     * Check if two bounding boxes intersect
     */
    private boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
        return !(
            a.x + a.width < b.x ||
            b.x + b.width < a.x ||
            a.y + a.height < b.y ||
            b.y + b.height < a.y
        );
    }

    /**
     * Merge another display list into this one
     */
    merge(other: DisplayList): void {
        for (const command of other.commands) {
            this.add(command);
        }
    }

    /**
     * Get memory usage estimate in bytes
     */
    getMemoryUsage(): number {
        // Rough estimate: JSON size
        return JSON.stringify(this.commands).length;
    }
}
