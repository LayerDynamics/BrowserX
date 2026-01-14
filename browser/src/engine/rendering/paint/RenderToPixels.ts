/**
 * Render to Pixels - Main paint coordinator
 *
 * Coordinates the entire paint process from render tree to pixels:
 * 1. Calculate paint order based on stacking contexts
 * 2. Group render objects into paint layers
 * 3. Generate display lists for each layer
 * 4. Composite layers to produce final pixels
 * 5. Handle damage tracking for incremental repainting
 */

import type { RenderObject } from "../rendering/RenderObject.ts";
import type { Pixels } from "../../../types/identifiers.ts";
import type { CanvasRenderingContext2D, HTMLCanvasElement } from "../../../types/dom.ts";
import { cancelAnimationFrame, document, requestAnimationFrame } from "../../../types/dom.ts";
import { PaintOrder, type StackingContext } from "./PaintOrder.ts";
import { type BoundingBox, DisplayList, PaintCommandType } from "./DisplayList.ts";
import { CompositingMode, type LayerID, LayerTree, PaintLayer } from "./PaintLayer.ts";

/**
 * Render paint context passed to render objects during painting
 */
export interface RenderPaintContext {
    displayList: DisplayList;
    currentLayer: PaintLayer;
    opacity: number;
    clipRegion: BoundingBox | null;
}

/**
 * Paint statistics
 */
export interface PaintStats {
    totalLayers: number;
    dirtyLayers: number;
    gpuLayers: number;
    paintTime: number;
    compositeTime: number;
    totalCommands: number;
}

/**
 * Damage region for incremental repainting
 */
export interface DamageRegion {
    regions: BoundingBox[];
}

/**
 * Paint result containing canvas and metadata
 */
export interface PaintResult {
    canvas: HTMLCanvasElement;
    layerTree: LayerTree;
    stats: PaintStats;
    damageRegion: DamageRegion | null;
}

/**
 * RenderToPixels
 * Main coordinator for converting render tree to pixels
 */
export class RenderToPixels {
    private paintOrder: PaintOrder;
    private layerTree: LayerTree | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private context: CanvasRenderingContext2D | null = null;
    private lastPaintedTree: RenderObject | null = null;
    private damageRegions: BoundingBox[] = [];

    constructor() {
        this.paintOrder = new PaintOrder();
    }

    /**
     * Paint render tree to pixels
     * Main entry point for painting
     *
     * @param root - Root render object
     * @param width - Canvas width
     * @param height - Canvas height
     * @param incremental - Whether to do incremental repaint
     * @returns Paint result with canvas and metadata
     */
    paint(
        root: RenderObject,
        width: Pixels,
        height: Pixels,
        incremental: boolean = true,
    ): PaintResult {
        const startTime = performance.now();

        // Create or reuse canvas
        if (!this.canvas || this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas = this.createCanvas(width, height);
            this.context = this.canvas.getContext("2d");
            incremental = false; // Force full repaint on canvas resize
        }

        if (!this.context) {
            throw new Error("Failed to get 2D context");
        }

        // Build or update layer tree
        if (!this.layerTree || !incremental) {
            // Full rebuild
            this.layerTree = this.buildLayerTree(root, width, height);
        } else {
            // Incremental update
            this.updateLayerTree(root);
        }

        // Promote eligible layers to GPU
        this.layerTree.promoteToGPU();

        // Paint dirty layers
        const paintStartTime = performance.now();
        this.layerTree.paintDirtyLayers();
        const paintTime = performance.now() - paintStartTime;

        // Composite layers to canvas
        const compositeStartTime = performance.now();

        if (incremental && this.damageRegions.length > 0) {
            // Incremental composite - only damaged regions
            this.compositeIncremental(this.context, this.damageRegions);
        } else {
            // Full composite
            this.compositeFull(this.context);
        }

        const compositeTime = performance.now() - compositeStartTime;

        // Collect statistics
        const stats: PaintStats = {
            totalLayers: this.layerTree.getAllLayers().length,
            dirtyLayers: this.layerTree.getDirtyLayers().length,
            gpuLayers: this.layerTree.getGPULayers().length,
            paintTime,
            compositeTime,
            totalCommands: this.countTotalCommands(),
        };

        // Create damage region result
        const damageRegion: DamageRegion | null = this.damageRegions.length > 0
            ? { regions: [...this.damageRegions] }
            : null;

        // Clear damage regions for next frame
        this.damageRegions = [];
        this.lastPaintedTree = root;

        return {
            canvas: this.canvas,
            layerTree: this.layerTree,
            stats,
            damageRegion,
        };
    }

    /**
     * Create canvas element
     */
    private createCanvas(width: Pixels, height: Pixels): HTMLCanvasElement {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    /**
     * Build layer tree from render tree
     */
    private buildLayerTree(
        root: RenderObject,
        width: Pixels,
        height: Pixels,
    ): LayerTree {
        // Create layer tree
        const layerTree = new LayerTree({
            x: 0 as Pixels,
            y: 0 as Pixels,
            width,
            height,
        });

        // Build stacking context tree
        const stackingTree = this.paintOrder.buildStackingContextTree(root);

        // Create paint layers from stacking contexts
        this.createLayersFromStackingContext(stackingTree, layerTree, layerTree.getRoot());

        return layerTree;
    }

    /**
     * Create paint layers from stacking context
     */
    private createLayersFromStackingContext(
        context: StackingContext,
        layerTree: LayerTree,
        parentLayer: PaintLayer,
    ): void {
        // Determine if this stacking context needs its own layer
        const needsOwnLayer = this.shouldCreateLayer(context.root);

        let targetLayer = parentLayer;

        if (needsOwnLayer) {
            // Create new layer for this stacking context
            const bounds = this.getLayoutBounds(context.root);
            const newLayer = layerTree.createLayer(bounds);
            parentLayer.addChild(newLayer);
            targetLayer = newLayer;

            // Set layer properties based on render object
            this.configureLayer(newLayer, context.root);
        }

        // Add render object to target layer
        targetLayer.addRenderObject(context.root);

        // Add all contents to same layer
        for (const content of context.contents) {
            targetLayer.addRenderObject(content);
        }

        // Process child stacking contexts
        for (const child of context.children) {
            this.createLayersFromStackingContext(child, layerTree, targetLayer);
        }
    }

    /**
     * Check if stacking context should create its own layer
     */
    private shouldCreateLayer(renderObject: RenderObject): boolean {
        // Root always gets a layer
        if (!renderObject.parent) {
            return true;
        }

        const opacity = renderObject.style.getPropertyValue("opacity");
        const transform = renderObject.style.getPropertyValue("transform");
        const filter = renderObject.style.getPropertyValue("filter");
        const willChange = renderObject.style.getPropertyValue("will-change");
        const mixBlendMode = renderObject.style.getPropertyValue("mix-blend-mode");
        const isolation = renderObject.style.getPropertyValue("isolation");
        const position = renderObject.style.getPropertyValue("position");

        // Opacity creates layer
        if (opacity && parseFloat(opacity) < 1) {
            return true;
        }

        // Transform creates layer
        if (transform && transform !== "none") {
            return true;
        }

        // Filter creates layer
        if (filter && filter !== "none") {
            return true;
        }

        // will-change creates layer
        if (
            willChange && (willChange.includes("opacity") ||
                willChange.includes("transform") ||
                willChange.includes("filter"))
        ) {
            return true;
        }

        // mix-blend-mode creates layer
        if (mixBlendMode && mixBlendMode !== "normal") {
            return true;
        }

        // isolation creates layer
        if (isolation === "isolate") {
            return true;
        }

        // Fixed position creates layer
        if (position === "fixed") {
            return true;
        }

        // Scrollable areas create layers
        const overflow = renderObject.style.getPropertyValue("overflow");
        if (overflow === "scroll" || overflow === "auto") {
            return true;
        }

        return false;
    }

    /**
     * Configure layer properties from render object
     */
    private configureLayer(layer: PaintLayer, renderObject: RenderObject): void {
        // Set opacity
        const opacity = renderObject.style.getPropertyValue("opacity");
        if (opacity) {
            layer.setOpacity(parseFloat(opacity));
        }

        // Set transform
        const transform = renderObject.style.getPropertyValue("transform");
        if (transform && transform !== "none") {
            const parsedTransform = this.parseTransform(transform);
            layer.setTransform(parsedTransform);
        }

        // Set compositing mode
        const mixBlendMode = renderObject.style.getPropertyValue("mix-blend-mode");
        if (mixBlendMode && mixBlendMode !== "normal") {
            layer.setCompositingMode(this.mapBlendMode(mixBlendMode));
        }
    }

    /**
     * Parse CSS transform to layer transform
     * Simplified implementation - real version would use full CSS parser
     */
    private parseTransform(transformStr: string): Partial<{
        translateX: Pixels;
        translateY: Pixels;
        scaleX: number;
        scaleY: number;
        rotation: number;
    }> {
        const result: any = {};

        // Parse translate
        const translateMatch = transformStr.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (translateMatch) {
            result.translateX = parseFloat(translateMatch[1]) as Pixels;
            result.translateY = parseFloat(translateMatch[2]) as Pixels;
        }

        // Parse scale
        const scaleMatch = transformStr.match(/scale\(([^,)]+)(?:,\s*([^)]+))?\)/);
        if (scaleMatch) {
            result.scaleX = parseFloat(scaleMatch[1]);
            result.scaleY = scaleMatch[2] ? parseFloat(scaleMatch[2]) : result.scaleX;
        }

        // Parse rotate
        const rotateMatch = transformStr.match(/rotate\(([^)]+)\)/);
        if (rotateMatch) {
            const degrees = parseFloat(rotateMatch[1]);
            result.rotation = (degrees * Math.PI) / 180; // Convert to radians
        }

        return result;
    }

    /**
     * Map CSS blend mode to compositing mode
     */
    private mapBlendMode(blendMode: string): CompositingMode {
        switch (blendMode) {
            case "multiply":
                return CompositingMode.MULTIPLY;
            case "screen":
                return CompositingMode.SCREEN;
            case "overlay":
                return CompositingMode.OVERLAY;
            case "darken":
                return CompositingMode.DARKEN;
            case "lighten":
                return CompositingMode.LIGHTEN;
            default:
                return CompositingMode.SOURCE_OVER;
        }
    }

    /**
     * Get layout bounds for render object
     */
    private getLayoutBounds(renderObject: RenderObject): BoundingBox {
        if (renderObject.layout) {
            return {
                x: renderObject.layout.x,
                y: renderObject.layout.y,
                width: renderObject.layout.width,
                height: renderObject.layout.height,
            };
        }

        // Fallback for objects without layout
        return {
            x: 0 as Pixels,
            y: 0 as Pixels,
            width: 0 as Pixels,
            height: 0 as Pixels,
        };
    }

    /**
     * Update existing layer tree with changes
     */
    private updateLayerTree(root: RenderObject): void {
        if (!this.layerTree) {
            return;
        }

        // Find render objects that need repainting
        const dirtyObjects = this.findDirtyRenderObjects(root);

        // Invalidate layers containing dirty objects
        for (const obj of dirtyObjects) {
            const bounds = this.getLayoutBounds(obj);
            this.invalidateRegion(bounds);
        }
    }

    /**
     * Find render objects marked as needing paint
     */
    private findDirtyRenderObjects(root: RenderObject): RenderObject[] {
        const dirty: RenderObject[] = [];

        const visit = (node: RenderObject) => {
            if (node.needsPaint) {
                dirty.push(node);
            }
            for (const child of node.children) {
                visit(child);
            }
        };

        visit(root);
        return dirty;
    }

    /**
     * Invalidate a region for repainting
     */
    private invalidateRegion(region: BoundingBox): void {
        this.damageRegions.push(region);

        if (this.layerTree) {
            // Invalidate layers intersecting with region
            const allLayers = this.layerTree.getAllLayers();
            for (const layer of allLayers) {
                layer.invalidateRegion(region);
            }
        }
    }

    /**
     * Composite all layers to canvas (full repaint)
     */
    private compositeFull(context: CanvasRenderingContext2D): void {
        // Clear canvas
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);

        // Composite layer tree
        if (this.layerTree) {
            this.layerTree.composite(context);
        }
    }

    /**
     * Composite only damaged regions (incremental repaint)
     */
    private compositeIncremental(
        context: CanvasRenderingContext2D,
        regions: BoundingBox[],
    ): void {
        if (!this.layerTree) {
            return;
        }

        // For each damaged region
        for (const region of regions) {
            // Clear region
            context.clearRect(region.x, region.y, region.width, region.height);

            // Save context
            context.save();

            // Clip to region
            context.beginPath();
            context.rect(region.x, region.y, region.width, region.height);
            context.clip();

            // Composite layers
            this.layerTree.composite(context);

            // Restore context
            context.restore();
        }
    }

    /**
     * Count total paint commands across all layers
     */
    private countTotalCommands(): number {
        if (!this.layerTree) {
            return 0;
        }

        let total = 0;
        const layers = this.layerTree.getAllLayers();

        for (const layer of layers) {
            const displayList = layer.getDisplayList();
            total += displayList.length();
        }

        return total;
    }

    /**
     * Invalidate entire tree
     */
    invalidate(): void {
        this.damageRegions = [];

        if (this.canvas) {
            this.damageRegions.push({
                x: 0 as Pixels,
                y: 0 as Pixels,
                width: this.canvas.width as Pixels,
                height: this.canvas.height as Pixels,
            });
        }

        if (this.layerTree) {
            const allLayers = this.layerTree.getAllLayers();
            for (const layer of allLayers) {
                layer.markDirty();
            }
        }
    }

    /**
     * Get current layer tree
     */
    getLayerTree(): LayerTree | null {
        return this.layerTree;
    }

    /**
     * Get current canvas
     */
    getCanvas(): HTMLCanvasElement | null {
        return this.canvas;
    }

    /**
     * Get damage regions
     */
    getDamageRegions(): ReadonlyArray<BoundingBox> {
        return this.damageRegions;
    }

    /**
     * Clear damage regions
     */
    clearDamageRegions(): void {
        this.damageRegions = [];
    }

    /**
     * Export layer tree for debugging
     */
    exportLayerTree(): any {
        if (!this.layerTree) {
            return null;
        }

        const exportLayer = (layer: PaintLayer): any => {
            return {
                id: layer.id,
                bounds: layer.getBounds(),
                transform: layer.getTransform(),
                opacity: layer.getOpacity(),
                compositingMode: layer.getCompositingMode(),
                isGPU: layer.isGPULayer(),
                isDirty: layer.isDirty(),
                commandCount: layer.getDisplayList().length(),
                children: layer.getChildren().map(exportLayer),
            };
        };

        return exportLayer(this.layerTree.getRoot());
    }

    /**
     * Get memory usage
     */
    getMemoryUsage(): number {
        if (!this.layerTree) {
            return 0;
        }

        let total = this.layerTree.getMemoryUsage();

        // Add canvas memory
        if (this.canvas) {
            // 4 bytes per pixel (RGBA)
            total += this.canvas.width * this.canvas.height * 4;
        }

        return total;
    }

    /**
     * Paint to offscreen canvas for testing/export
     */
    paintToCanvas(
        root: RenderObject,
        width: Pixels,
        height: Pixels,
    ): HTMLCanvasElement {
        const result = this.paint(root, width, height, false);
        return result.canvas;
    }

    /**
     * Create paint context for render object
     */
    createPaintContext(layer: PaintLayer): RenderPaintContext {
        return {
            displayList: layer.getDisplayList(),
            currentLayer: layer,
            opacity: layer.getOpacity(),
            clipRegion: null,
        };
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.canvas = null;
        this.context = null;
        this.layerTree = null;
        this.lastPaintedTree = null;
        this.damageRegions = [];
    }
}

/**
 * Paint scheduler for coordinating paint with vsync
 */
export class PaintScheduler {
    private renderToPixels: RenderToPixels;
    private pendingPaint: boolean = false;
    private animationFrameId: number | null = null;

    constructor(renderToPixels: RenderToPixels) {
        this.renderToPixels = renderToPixels;
    }

    /**
     * Schedule a paint on next frame
     */
    schedulePaint(
        root: RenderObject,
        width: Pixels,
        height: Pixels,
        callback?: (result: PaintResult) => void,
    ): void {
        if (this.pendingPaint) {
            return; // Already scheduled
        }

        this.pendingPaint = true;

        this.animationFrameId = requestAnimationFrame(() => {
            const result = this.renderToPixels.paint(root, width, height, true);
            this.pendingPaint = false;
            this.animationFrameId = null;

            if (callback) {
                callback(result);
            }
        });
    }

    /**
     * Cancel pending paint
     */
    cancelPaint(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            this.pendingPaint = false;
        }
    }

    /**
     * Check if paint is pending
     */
    isPaintPending(): boolean {
        return this.pendingPaint;
    }
}
