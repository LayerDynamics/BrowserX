/**
 * Paint Layer - Compositing layers and GPU acceleration
 *
 * Paint layers group render objects that can be painted together and
 * potentially hardware accelerated. Layers enable efficient repainting
 * and smooth animations.
 */

import type { RenderObject } from "../rendering/RenderObject.ts";
import type { Pixels } from "../../../types/identifiers.ts";
import type { CanvasRenderingContext2D } from "../../../types/dom.ts";
import { type BoundingBox, DisplayList } from "./DisplayList.ts";

/**
 * Layer ID type
 */
export type LayerID = string & { __brand: "LayerID" };

/**
 * Transform for layer positioning
 */
export interface Transform {
    translateX: Pixels;
    translateY: Pixels;
    scaleX: number;
    scaleY: number;
    rotation: number;
    originX: Pixels;
    originY: Pixels;
}

/**
 * Layer compositing mode
 */
export enum CompositingMode {
    SOURCE_OVER = "source-over",
    MULTIPLY = "multiply",
    SCREEN = "screen",
    OVERLAY = "overlay",
    DARKEN = "darken",
    LIGHTEN = "lighten",
}

/**
 * Paint Layer
 * Represents a compositing layer that can be painted independently
 */
export class PaintLayer {
    readonly id: LayerID;
    private renderObjects: RenderObject[];
    private displayList: DisplayList;
    private bounds: BoundingBox;
    private transform: Transform;
    private opacity: number;
    private compositingMode: CompositingMode;
    private parent: PaintLayer | null = null;
    private children: PaintLayer[] = [];
    private dirty: boolean = true;
    private isGPUAccelerated: boolean = false;

    constructor(id: LayerID, bounds: BoundingBox) {
        this.id = id;
        this.renderObjects = [];
        this.displayList = new DisplayList();
        this.bounds = bounds;
        this.transform = {
            translateX: 0 as Pixels,
            translateY: 0 as Pixels,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            originX: 0 as Pixels,
            originY: 0 as Pixels,
        };
        this.opacity = 1.0;
        this.compositingMode = CompositingMode.SOURCE_OVER;
    }

    /**
     * Add a render object to this layer
     */
    addRenderObject(renderObject: RenderObject): void {
        this.renderObjects.push(renderObject);
        this.markDirty();
    }

    /**
     * Remove a render object from this layer
     */
    removeRenderObject(renderObject: RenderObject): void {
        const index = this.renderObjects.indexOf(renderObject);
        if (index >= 0) {
            this.renderObjects.splice(index, 1);
            this.markDirty();
        }
    }

    /**
     * Get all render objects in this layer
     */
    getRenderObjects(): ReadonlyArray<RenderObject> {
        return this.renderObjects;
    }

    /**
     * Add a child layer
     */
    addChild(layer: PaintLayer): void {
        this.children.push(layer);
        layer.parent = this;
    }

    /**
     * Remove a child layer
     */
    removeChild(layer: PaintLayer): void {
        const index = this.children.indexOf(layer);
        if (index >= 0) {
            this.children.splice(index, 1);
            layer.parent = null;
        }
    }

    /**
     * Get child layers
     */
    getChildren(): ReadonlyArray<PaintLayer> {
        return this.children;
    }

    /**
     * Get parent layer
     */
    getParent(): PaintLayer | null {
        return this.parent;
    }

    /**
     * Get display list for this layer
     */
    getDisplayList(): DisplayList {
        return this.displayList;
    }

    /**
     * Get bounds of this layer
     */
    getBounds(): BoundingBox {
        return { ...this.bounds };
    }

    /**
     * Set bounds of this layer
     */
    setBounds(bounds: BoundingBox): void {
        this.bounds = bounds;
        this.markDirty();
    }

    /**
     * Get transform
     */
    getTransform(): Transform {
        return { ...this.transform };
    }

    /**
     * Set transform
     */
    setTransform(transform: Partial<Transform>): void {
        this.transform = { ...this.transform, ...transform };
        this.markDirty();
    }

    /**
     * Get opacity
     */
    getOpacity(): number {
        return this.opacity;
    }

    /**
     * Set opacity
     */
    setOpacity(opacity: number): void {
        this.opacity = Math.max(0, Math.min(1, opacity));
        this.markDirty();
    }

    /**
     * Get compositing mode
     */
    getCompositingMode(): CompositingMode {
        return this.compositingMode;
    }

    /**
     * Set compositing mode
     */
    setCompositingMode(mode: CompositingMode): void {
        this.compositingMode = mode;
        this.markDirty();
    }

    /**
     * Check if layer is dirty and needs repainting
     */
    isDirty(): boolean {
        return this.dirty;
    }

    /**
     * Mark layer as dirty
     */
    markDirty(): void {
        this.dirty = true;
        // Propagate to parent
        if (this.parent) {
            this.parent.markDirty();
        }
    }

    /**
     * Mark layer as clean
     */
    markClean(): void {
        this.dirty = false;
    }

    /**
     * Check if layer is GPU accelerated
     */
    isGPULayer(): boolean {
        return this.isGPUAccelerated;
    }

    /**
     * Enable GPU acceleration for this layer
     */
    enableGPUAcceleration(): void {
        this.isGPUAccelerated = true;
    }

    /**
     * Disable GPU acceleration for this layer
     */
    disableGPUAcceleration(): void {
        this.isGPUAccelerated = false;
    }

    /**
     * Paint this layer
     * Records paint commands into display list
     */
    paint(): void {
        if (!this.dirty) {
            return;
        }

        // Clear previous display list
        this.displayList.clear();

        // Paint all render objects in this layer
        for (const renderObject of this.renderObjects) {
            if (renderObject.needsPaint) {
                // Render object should record commands to display list
                // This is simplified - real implementation would pass context
                renderObject.paint({
                    // Simplified paint context
                    save: () => {},
                    restore: () => {},
                    translate: () => {},
                    fillRect: () => {},
                    strokeRect: () => {},
                    fillText: () => {},
                    drawImage: () => {},
                } as any);
            }
        }

        this.markClean();
    }

    /**
     * Composite this layer onto a target
     * Applies transform and opacity
     */
    composite(targetContext: CanvasRenderingContext2D): void {
        targetContext.save();

        // Apply transform
        targetContext.translate(this.transform.translateX, this.transform.translateY);

        if (this.transform.rotation !== 0) {
            targetContext.translate(this.transform.originX, this.transform.originY);
            targetContext.rotate(this.transform.rotation);
            targetContext.translate(-this.transform.originX, -this.transform.originY);
        }

        if (this.transform.scaleX !== 1 || this.transform.scaleY !== 1) {
            targetContext.scale(this.transform.scaleX, this.transform.scaleY);
        }

        // Apply opacity
        targetContext.globalAlpha = this.opacity;

        // Apply compositing mode
        targetContext.globalCompositeOperation = this.compositingMode;

        // Replay display list
        this.displayList.replay(targetContext);

        // Composite children
        for (const child of this.children) {
            child.composite(targetContext);
        }

        targetContext.restore();
    }

    /**
     * Check if layer should be promoted to GPU
     * Layers with transforms, animations, or opacity are good candidates
     */
    shouldPromoteToGPU(): boolean {
        // Check for transforms
        if (
            this.transform.rotation !== 0 ||
            this.transform.scaleX !== 1 ||
            this.transform.scaleY !== 1
        ) {
            return true;
        }

        // Check for opacity
        if (this.opacity < 1.0) {
            return true;
        }

        // Check for compositing mode
        if (this.compositingMode !== CompositingMode.SOURCE_OVER) {
            return true;
        }

        // Check render objects for animations or will-change
        for (const renderObject of this.renderObjects) {
            const willChange = renderObject.style.getPropertyValue("will-change");
            if (willChange && willChange !== "auto") {
                return true;
            }

            const transform = renderObject.style.getPropertyValue("transform");
            if (transform && transform !== "none") {
                return true;
            }
        }

        return false;
    }

    /**
     * Get memory usage estimate
     */
    getMemoryUsage(): number {
        let total = 0;

        // Display list memory
        total += this.displayList.getMemoryUsage();

        // Child layers
        for (const child of this.children) {
            total += child.getMemoryUsage();
        }

        return total;
    }

    /**
     * Invalidate a region of this layer
     * Used for incremental repainting
     */
    invalidateRegion(region: BoundingBox): void {
        // Check if region intersects with layer bounds
        if (this.regionsIntersect(region, this.bounds)) {
            this.markDirty();
        }
    }

    /**
     * Check if two regions intersect
     */
    private regionsIntersect(a: BoundingBox, b: BoundingBox): boolean {
        return !(
            a.x + a.width < b.x ||
            b.x + b.width < a.x ||
            a.y + a.height < b.y ||
            b.y + b.height < a.y
        );
    }

    /**
     * Clone this layer
     */
    clone(): PaintLayer {
        const cloned = new PaintLayer(this.id, this.bounds);
        cloned.renderObjects = [...this.renderObjects];
        cloned.transform = { ...this.transform };
        cloned.opacity = this.opacity;
        cloned.compositingMode = this.compositingMode;
        cloned.isGPUAccelerated = this.isGPUAccelerated;

        // Clone children
        for (const child of this.children) {
            cloned.addChild(child.clone());
        }

        return cloned;
    }

    /**
     * Get all layers in subtree (depth-first)
     */
    getAllLayers(): PaintLayer[] {
        const layers: PaintLayer[] = [this];

        for (const child of this.children) {
            layers.push(...child.getAllLayers());
        }

        return layers;
    }

    /**
     * Find layer by ID in subtree
     */
    findLayerById(id: LayerID): PaintLayer | null {
        if (this.id === id) {
            return this;
        }

        for (const child of this.children) {
            const found = child.findLayerById(id);
            if (found) {
                return found;
            }
        }

        return null;
    }
}

/**
 * Layer tree manager
 * Manages the hierarchy of paint layers
 */
export class LayerTree {
    private root: PaintLayer;
    private nextLayerId = 0;

    constructor(rootBounds: BoundingBox) {
        this.root = new PaintLayer(this.generateLayerId(), rootBounds);
    }

    /**
     * Get root layer
     */
    getRoot(): PaintLayer {
        return this.root;
    }

    /**
     * Create a new layer
     */
    createLayer(bounds: BoundingBox): PaintLayer {
        return new PaintLayer(this.generateLayerId(), bounds);
    }

    /**
     * Generate unique layer ID
     */
    private generateLayerId(): LayerID {
        return `layer-${this.nextLayerId++}` as LayerID;
    }

    /**
     * Find layer by ID
     */
    findLayer(id: LayerID): PaintLayer | null {
        return this.root.findLayerById(id);
    }

    /**
     * Get all layers
     */
    getAllLayers(): PaintLayer[] {
        return this.root.getAllLayers();
    }

    /**
     * Get all dirty layers
     */
    getDirtyLayers(): PaintLayer[] {
        return this.getAllLayers().filter((layer) => layer.isDirty());
    }

    /**
     * Get all GPU layers
     */
    getGPULayers(): PaintLayer[] {
        return this.getAllLayers().filter((layer) => layer.isGPULayer());
    }

    /**
     * Paint all dirty layers
     */
    paintDirtyLayers(): void {
        const dirtyLayers = this.getDirtyLayers();
        for (const layer of dirtyLayers) {
            layer.paint();
        }
    }

    /**
     * Composite entire tree onto target
     */
    composite(targetContext: CanvasRenderingContext2D): void {
        this.root.composite(targetContext);
    }

    /**
     * Get total memory usage
     */
    getMemoryUsage(): number {
        return this.root.getMemoryUsage();
    }

    /**
     * Promote eligible layers to GPU
     */
    promoteToGPU(): void {
        const layers = this.getAllLayers();
        for (const layer of layers) {
            if (layer.shouldPromoteToGPU() && !layer.isGPULayer()) {
                layer.enableGPUAcceleration();
            }
        }
    }
}
