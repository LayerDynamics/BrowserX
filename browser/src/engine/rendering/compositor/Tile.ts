/**
 * Tile - Tiling and priority rasterization
 *
 * Tiles divide large layers into smaller chunks that can be rasterized
 * independently. This enables:
 * - Efficient memory management (only visible tiles in memory)
 * - Progressive rendering (prioritize visible tiles)
 * - Smooth scrolling (rasterize tiles as needed)
 * - GPU texture size limits (tiles fit within max texture size)
 */

import type { Pixels } from "../../../types/identifiers.ts";
import type { HTMLCanvasElement, ImageBitmap } from "../../../types/dom.ts";
import { document } from "../../../types/dom.ts";
import { type BoundingBox, DisplayList } from "../paint/DisplayList.ts";

/**
 * Tile ID type
 */
export type TileID = string & { __brand: "TileID" };

/**
 * Tile priority for rasterization scheduling
 */
export enum TilePriority {
    VISIBLE = 0, // Currently visible in viewport
    NEAR_VIEWPORT = 1, // Just outside viewport
    FAR_FROM_VIEWPORT = 2, // Far from viewport
    OFFSCREEN = 3, // Completely offscreen
}

/**
 * Tile state
 */
export enum TileState {
    PENDING = "pending", // Not yet rasterized
    RASTERIZING = "rasterizing", // Currently being rasterized
    READY = "ready", // Rasterized and ready to composite
    INVALID = "invalid", // Needs re-rasterization
}

/**
 * Rasterized tile data
 */
export interface TileData {
    bitmap: ImageBitmap | HTMLCanvasElement | null;
    width: Pixels;
    height: Pixels;
    scale: number;
}

/**
 * Tile
 * Represents a rectangular region of a layer that can be rasterized independently
 */
export class Tile {
    readonly id: TileID;
    readonly bounds: BoundingBox;
    private displayList: DisplayList;
    private state: TileState;
    private priority: TilePriority;
    private data: TileData | null = null;
    private scale: number;
    private lastRasterizeTime: number = 0;
    private rasterizeCount: number = 0;

    constructor(
        id: TileID,
        bounds: BoundingBox,
        displayList: DisplayList,
        scale: number = 1.0,
    ) {
        this.id = id;
        this.bounds = bounds;
        this.displayList = displayList;
        this.state = TileState.PENDING;
        this.priority = TilePriority.OFFSCREEN;
        this.scale = scale;
    }

    /**
     * Rasterize tile
     * Converts display list to bitmap
     */
    async rasterize(): Promise<void> {
        if (this.state === TileState.RASTERIZING) {
            return; // Already rasterizing
        }

        this.state = TileState.RASTERIZING;
        const startTime = performance.now();

        try {
            // Create canvas for rasterization
            const canvas = this.createCanvas();
            const context = canvas.getContext("2d");

            if (!context) {
                throw new Error("Failed to get 2D context for tile rasterization");
            }

            // Clear canvas
            context.clearRect(0, 0, canvas.width, canvas.height);

            // Apply tile offset
            context.save();
            context.translate(-this.bounds.x * this.scale, -this.bounds.y * this.scale);
            context.scale(this.scale, this.scale);

            // Replay display list clipped to tile bounds
            const clippedDisplayList = this.displayList.clip(this.bounds);
            clippedDisplayList.replay(context);

            context.restore();

            // Create image bitmap for GPU upload
            // ImageBitmap is more efficient for GPU transfers
            const bitmap = await createImageBitmap(canvas as unknown as ImageBitmapSource);

            this.data = {
                bitmap,
                width: canvas.width as Pixels,
                height: canvas.height as Pixels,
                scale: this.scale,
            };

            this.state = TileState.READY;
            this.lastRasterizeTime = performance.now() - startTime;
            this.rasterizeCount++;
        } catch (error) {
            console.error(`Failed to rasterize tile ${this.id}:`, error);
            this.state = TileState.INVALID;
        }
    }

    /**
     * Rasterize synchronously (without ImageBitmap creation)
     * Used when async rasterization is not needed
     */
    rasterizeSync(): void {
        if (this.state === TileState.RASTERIZING || this.state === TileState.READY) {
            return;
        }

        this.state = TileState.RASTERIZING;
        const startTime = performance.now();

        try {
            const canvas = this.createCanvas();
            const context = canvas.getContext("2d");

            if (!context) {
                throw new Error("Failed to get 2D context for tile rasterization");
            }

            context.clearRect(0, 0, canvas.width, canvas.height);

            context.save();
            context.translate(-this.bounds.x * this.scale, -this.bounds.y * this.scale);
            context.scale(this.scale, this.scale);

            const clippedDisplayList = this.displayList.clip(this.bounds);
            clippedDisplayList.replay(context);

            context.restore();

            this.data = {
                bitmap: canvas,
                width: canvas.width as Pixels,
                height: canvas.height as Pixels,
                scale: this.scale,
            };

            this.state = TileState.READY;
            this.lastRasterizeTime = performance.now() - startTime;
            this.rasterizeCount++;
        } catch (error) {
            console.error(`Failed to rasterize tile ${this.id}:`, error);
            this.state = TileState.INVALID;
        }
    }

    /**
     * Create canvas for rasterization
     */
    private createCanvas(): HTMLCanvasElement {
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(this.bounds.width * this.scale);
        canvas.height = Math.ceil(this.bounds.height * this.scale);
        return canvas;
    }

    /**
     * Invalidate tile
     * Marks tile as needing re-rasterization
     */
    invalidate(): void {
        if (this.state === TileState.READY || this.state === TileState.PENDING) {
            this.state = TileState.INVALID;
        }

        // Release old data
        if (this.data?.bitmap && "close" in this.data.bitmap) {
            this.data.bitmap.close();
        }
        this.data = null;
    }

    /**
     * Update display list
     */
    updateDisplayList(displayList: DisplayList): void {
        this.displayList = displayList;
        this.invalidate();
    }

    /**
     * Get tile state
     */
    getState(): TileState {
        return this.state;
    }

    /**
     * Check if tile is ready for compositing
     */
    isReady(): boolean {
        return this.state === TileState.READY && this.data !== null;
    }

    /**
     * Get tile data
     */
    getData(): TileData | null {
        return this.data;
    }

    /**
     * Get tile priority
     */
    getPriority(): TilePriority {
        return this.priority;
    }

    /**
     * Set tile priority
     */
    setPriority(priority: TilePriority): void {
        this.priority = priority;
    }

    /**
     * Calculate priority based on viewport
     */
    calculatePriority(viewport: BoundingBox): TilePriority {
        // Check if tile intersects viewport
        if (this.intersects(this.bounds, viewport)) {
            this.priority = TilePriority.VISIBLE;
            return this.priority;
        }

        // Calculate distance from viewport
        const distance = this.distanceFromViewport(viewport);

        // Threshold for "near" viewport (in pixels)
        const NEAR_THRESHOLD = 500;
        const FAR_THRESHOLD = 1500;

        if (distance < NEAR_THRESHOLD) {
            this.priority = TilePriority.NEAR_VIEWPORT;
        } else if (distance < FAR_THRESHOLD) {
            this.priority = TilePriority.FAR_FROM_VIEWPORT;
        } else {
            this.priority = TilePriority.OFFSCREEN;
        }

        return this.priority;
    }

    /**
     * Check if two bounding boxes intersect
     */
    private intersects(a: BoundingBox, b: BoundingBox): boolean {
        return !(
            a.x + a.width < b.x ||
            b.x + b.width < a.x ||
            a.y + a.height < b.y ||
            b.y + b.height < a.y
        );
    }

    /**
     * Calculate distance from viewport
     */
    private distanceFromViewport(viewport: BoundingBox): number {
        // Calculate closest point on tile to viewport
        const closestX = Math.max(
            this.bounds.x,
            Math.min(viewport.x + viewport.width, this.bounds.x + this.bounds.width),
        );
        const closestY = Math.max(
            this.bounds.y,
            Math.min(viewport.y + viewport.height, this.bounds.y + this.bounds.height),
        );

        // Calculate distance
        const dx = Math.max(
            0,
            Math.abs(closestX - (viewport.x + viewport.width / 2)) - viewport.width / 2,
        );
        const dy = Math.max(
            0,
            Math.abs(closestY - (viewport.y + viewport.height / 2)) - viewport.height / 2,
        );

        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get memory usage in bytes
     */
    getMemoryUsage(): number {
        if (!this.data) {
            return 0;
        }

        // 4 bytes per pixel (RGBA)
        return this.data.width * this.data.height * 4;
    }

    /**
     * Get last rasterize time
     */
    getLastRasterizeTime(): number {
        return this.lastRasterizeTime;
    }

    /**
     * Get rasterize count
     */
    getRasterizeCount(): number {
        return this.rasterizeCount;
    }

    /**
     * Dispose tile resources
     */
    dispose(): void {
        if (this.data?.bitmap && "close" in this.data.bitmap) {
            this.data.bitmap.close();
        }
        this.data = null;
        this.state = TileState.INVALID;
    }
}

/**
 * Tile grid manager
 * Manages a grid of tiles for a layer
 */
export class TileGrid {
    private tiles: Map<TileID, Tile> = new Map();
    private tileSize: Pixels;
    private scale: number;
    private nextTileId = 0;

    constructor(tileSize: Pixels = 256 as Pixels, scale: number = 1.0) {
        this.tileSize = tileSize;
        this.scale = scale;
    }

    /**
     * Create tiles for a layer bounds
     */
    createTilesForBounds(bounds: BoundingBox, displayList: DisplayList): Tile[] {
        const tiles: Tile[] = [];

        const tilesX = Math.ceil(bounds.width / this.tileSize);
        const tilesY = Math.ceil(bounds.height / this.tileSize);

        for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
                const tileBounds: BoundingBox = {
                    x: (bounds.x + x * this.tileSize) as Pixels,
                    y: (bounds.y + y * this.tileSize) as Pixels,
                    width: Math.min(this.tileSize, bounds.width - x * this.tileSize) as Pixels,
                    height: Math.min(this.tileSize, bounds.height - y * this.tileSize) as Pixels,
                };

                const tile = new Tile(
                    this.generateTileId(),
                    tileBounds,
                    displayList,
                    this.scale,
                );

                this.tiles.set(tile.id, tile);
                tiles.push(tile);
            }
        }

        return tiles;
    }

    /**
     * Generate unique tile ID
     */
    private generateTileId(): TileID {
        return `tile-${this.nextTileId++}` as TileID;
    }

    /**
     * Get tile by ID
     */
    getTile(id: TileID): Tile | undefined {
        return this.tiles.get(id);
    }

    /**
     * Get all tiles
     */
    getAllTiles(): Tile[] {
        return Array.from(this.tiles.values());
    }

    /**
     * Get tiles intersecting viewport
     */
    getTilesInViewport(viewport: BoundingBox): Tile[] {
        return this.getAllTiles().filter((tile) => {
            return this.intersects(tile.bounds, viewport);
        });
    }

    /**
     * Update priorities based on viewport
     */
    updatePriorities(viewport: BoundingBox): void {
        for (const tile of this.tiles.values()) {
            tile.calculatePriority(viewport);
        }
    }

    /**
     * Get tiles sorted by priority
     */
    getTilesByPriority(): Tile[] {
        return this.getAllTiles().sort((a, b) => {
            return a.getPriority() - b.getPriority();
        });
    }

    /**
     * Invalidate all tiles
     */
    invalidateAll(): void {
        for (const tile of this.tiles.values()) {
            tile.invalidate();
        }
    }

    /**
     * Dispose all tiles
     */
    dispose(): void {
        for (const tile of this.tiles.values()) {
            tile.dispose();
        }
        this.tiles.clear();
    }

    /**
     * Get total memory usage
     */
    getMemoryUsage(): number {
        let total = 0;
        for (const tile of this.tiles.values()) {
            total += tile.getMemoryUsage();
        }
        return total;
    }

    /**
     * Check if two bounding boxes intersect
     */
    private intersects(a: BoundingBox, b: BoundingBox): boolean {
        return !(
            a.x + a.width < b.x ||
            b.x + b.width < a.x ||
            a.y + a.height < b.y ||
            b.y + b.height < a.y
        );
    }
}
