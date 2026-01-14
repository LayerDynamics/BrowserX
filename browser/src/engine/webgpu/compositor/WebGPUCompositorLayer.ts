/**
 * WebGPU Compositor Layer
 *
 * Manages individual compositor layers with texture resources, transforms, and rendering.
 * Each layer represents a compositable element (DOM node, canvas, video, etc.) with:
 * - Content texture management
 * - Transform and positioning
 * - Opacity and blend mode
 * - Damage tracking
 * - Render target caching
 *
 * @module compositor
 */

import type {
    LayerID,
    Pixels,
    Timestamp,
    GPUTextureID,
} from "../../../types/webgpu.ts";
import { WebGPUDevice } from "../adapter/Device.ts";
import { WebGPUTextureManager } from "../operations/render/TextureManager.ts";
import { WebGPUCommandEncoder } from "../encoder/mod.ts";
import { WebGPUError } from "../errors.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Layer state
 */
export enum LayerState {
    CREATED = "CREATED",
    READY = "READY",
    RENDERING = "RENDERING",
    DIRTY = "DIRTY",
    DESTROYED = "DESTROYED",
}

/**
 * Layer type
 */
export enum LayerType {
    /** Root layer (document) */
    ROOT = "ROOT",
    /** DOM element layer */
    ELEMENT = "ELEMENT",
    /** Canvas element */
    CANVAS = "CANVAS",
    /** Video element */
    VIDEO = "VIDEO",
    /** Image element */
    IMAGE = "IMAGE",
    /** Text layer */
    TEXT = "TEXT",
    /** Effect layer (filters, etc.) */
    EFFECT = "EFFECT",
}

/**
 * Blend mode for compositing
 */
export enum BlendMode {
    NORMAL = "NORMAL",
    MULTIPLY = "MULTIPLY",
    SCREEN = "SCREEN",
    OVERLAY = "OVERLAY",
    DARKEN = "DARKEN",
    LIGHTEN = "LIGHTEN",
    COLOR_DODGE = "COLOR_DODGE",
    COLOR_BURN = "COLOR_BURN",
    HARD_LIGHT = "HARD_LIGHT",
    SOFT_LIGHT = "SOFT_LIGHT",
    DIFFERENCE = "DIFFERENCE",
    EXCLUSION = "EXCLUSION",
    ADD = "ADD",
    SUBTRACT = "SUBTRACT",
}

/**
 * 2D transform
 */
export interface Transform {
    translateX: number;
    translateY: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    originX: number;
    originY: number;
}

/**
 * Damage rectangle
 */
export interface DamageRect {
    x: Pixels;
    y: Pixels;
    width: Pixels;
    height: Pixels;
}

/**
 * Layer configuration
 */
export interface LayerConfig {
    /** Unique layer identifier */
    id: LayerID;
    /** Layer type */
    type: LayerType;
    /** Parent layer ID */
    parentId?: LayerID;
    /** Position */
    x: Pixels;
    y: Pixels;
    /** Size */
    width: Pixels;
    height: Pixels;
    /** Z-order */
    zIndex: number;
    /** Opacity (0.0 to 1.0) */
    opacity: number;
    /** Blend mode */
    blendMode: BlendMode;
    /** Initial transform */
    transform?: Transform;
    /** Is visible */
    visible: boolean;
    /** Clip to bounds */
    clipToBounds: boolean;
    /** Background color (RGBA) */
    backgroundColor?: [number, number, number, number];
}

/**
 * Layer statistics
 */
export interface LayerStatistics {
    layerId: LayerID;
    state: LayerState;
    framesRendered: number;
    lastRenderTime: Timestamp;
    averageRenderTime: number;
    textureMemory: number;
    damageCount: number;
    uploadCount: number;
}

// ============================================================================
// Compositor Layer Errors
// ============================================================================

/**
 * Error related to compositor layer operations
 */
export class CompositorLayerError extends WebGPUError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, {
            recoverable: false,
            code: "COMPOSITOR_LAYER_ERROR",
            context,
        });
        this.name = "CompositorLayerError";
    }
}

// ============================================================================
// WebGPU Compositor Layer
// ============================================================================

/**
 * Manages a single compositor layer with texture resources and rendering
 */
export class WebGPUCompositorLayer {
    private readonly device: WebGPUDevice;
    private readonly textureManager: WebGPUTextureManager;
    private readonly config: LayerConfig;

    private state: LayerState = LayerState.CREATED;

    // Content texture
    private contentTextureId: GPUTextureID | null = null;
    private contentTexture: GPUTexture | null = null;
    private contentTextureView: GPUTextureView | null = null;

    // Render target (for effects/transforms)
    private renderTargetId: GPUTextureID | null = null;
    private renderTarget: GPUTexture | null = null;
    private renderTargetView: GPUTextureView | null = null;

    // Transform and positioning
    private transform: Transform;
    private transformMatrix: Float32Array;
    private transformDirty: boolean = true;

    // Damage tracking
    private damageRects: DamageRect[] = [];
    private fullDamage: boolean = true;

    // Parent-child relationships
    private children: Set<LayerID> = new Set();
    private parentId: LayerID | null = null;

    // Statistics
    private framesRendered = 0;
    private renderTimings: number[] = [];
    private uploadCount = 0;
    private lastRenderTime: Timestamp = 0 as Timestamp;

    // Visibility and culling
    private visible: boolean;
    private occluded: boolean = false;

    constructor(
        device: WebGPUDevice,
        textureManager: WebGPUTextureManager,
        config: LayerConfig
    ) {
        this.device = device;
        this.textureManager = textureManager;
        this.config = config;
        this.visible = config.visible;
        this.parentId = config.parentId || null;

        // Initialize transform
        this.transform = config.transform || {
            translateX: 0,
            translateY: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            originX: config.width / 2,
            originY: config.height / 2,
        };

        this.transformMatrix = new Float32Array(16);

        // Create content texture
        this.createContentTexture();

        this.state = LayerState.READY;
    }

    // ========================================================================
    // Texture Management
    // ========================================================================

    /**
     * Create content texture for layer
     */
    private createContentTexture(): void {
        const descriptor = {
            width: this.config.width,
            height: this.config.height,
            format: "rgba8unorm" as GPUTextureFormat,
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
            label: `layer-content-${this.config.id}`,
        };

        this.contentTextureId = this.textureManager.createTexture(descriptor);
        this.contentTexture = this.textureManager.getTexture(this.contentTextureId);

        if (!this.contentTexture) {
            throw new CompositorLayerError(
                `Failed to create content texture for layer ${this.config.id}`
            );
        }

        this.contentTextureView = this.contentTexture.createView();

        // Initialize with background color if specified
        if (this.config.backgroundColor) {
            this.clearContentTexture(this.config.backgroundColor);
        }
    }

    /**
     * Create render target for effects/transforms
     */
    private createRenderTarget(): void {
        if (this.renderTargetId) {
            return; // Already created
        }

        const descriptor = {
            width: this.config.width,
            height: this.config.height,
            format: "rgba8unorm" as GPUTextureFormat,
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.RENDER_ATTACHMENT,
            label: `layer-render-target-${this.config.id}`,
        };

        this.renderTargetId = this.textureManager.createTexture(descriptor);
        this.renderTarget = this.textureManager.getTexture(this.renderTargetId);

        if (!this.renderTarget) {
            throw new CompositorLayerError(
                `Failed to create render target for layer ${this.config.id}`
            );
        }

        this.renderTargetView = this.renderTarget.createView();
    }

    /**
     * Clear content texture with color
     */
    private clearContentTexture(color: [number, number, number, number]): void {
        if (!this.contentTextureView) {
            return;
        }

        const encoder = new WebGPUCommandEncoder(
            this.device,
            `clear-layer-${this.config.id}`
        );

        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.contentTextureView,
                    clearValue: {
                        r: color[0],
                        g: color[1],
                        b: color[2],
                        a: color[3],
                    },
                    loadOp: "clear" as GPULoadOp,
                    storeOp: "store" as GPUStoreOp,
                },
            ],
        });

        pass.end();
        encoder.endRenderPass();

        const commandBuffer = encoder.finish();
        this.device.getDevice().queue.submit([commandBuffer]);
    }

    /**
     * Upload pixel data to content texture
     */
    uploadPixelData(
        pixels: Uint8Array,
        width: number,
        height: number,
        x: number = 0,
        y: number = 0
    ): void {
        if (!this.contentTexture) {
            throw new CompositorLayerError("Content texture not initialized");
        }

        if (this.state === LayerState.DESTROYED) {
            throw new CompositorLayerError("Cannot upload to destroyed layer");
        }

        // Upload to texture manager
        this.textureManager.uploadPixelData(
            this.contentTexture,
            pixels,
            width,
            height,
            {
                origin: {
                    x,
                    y,
                    z: 0,
                },
            }
        );

        this.uploadCount++;
        this.markDamage({ x: x as Pixels, y: y as Pixels, width: width as Pixels, height: height as Pixels });
        this.state = LayerState.DIRTY;
    }

    /**
     * Resize layer and recreate textures
     */
    resize(width: Pixels, height: Pixels): void {
        if (width === this.config.width && height === this.config.height) {
            return;
        }

        // Update config
        (this.config as any).width = width;
        (this.config as any).height = height;

        // Destroy old textures
        if (this.contentTextureId) {
            this.textureManager.destroyTexture(this.contentTextureId);
        }
        if (this.renderTargetId) {
            this.textureManager.destroyTexture(this.renderTargetId);
            this.renderTargetId = null;
        }

        // Recreate content texture
        this.createContentTexture();

        // Update transform origin
        this.transform.originX = width / 2;
        this.transform.originY = height / 2;
        this.transformDirty = true;

        this.markFullDamage();
    }

    // ========================================================================
    // Transform Management
    // ========================================================================

    /**
     * Set layer transform
     */
    setTransform(transform: Partial<Transform>): void {
        this.transform = {
            ...this.transform,
            ...transform,
        };
        this.transformDirty = true;
        this.markFullDamage();
    }

    /**
     * Get current transform
     */
    getTransform(): Transform {
        return { ...this.transform };
    }

    /**
     * Get transform matrix (4x4)
     */
    getTransformMatrix(): Float32Array {
        if (this.transformDirty) {
            this.updateTransformMatrix();
        }
        return this.transformMatrix;
    }

    /**
     * Update transform matrix from transform properties
     */
    private updateTransformMatrix(): void {
        const t = this.transform;
        const cos = Math.cos(t.rotation);
        const sin = Math.sin(t.rotation);

        // Create transformation matrix:
        // 1. Translate to origin
        // 2. Scale
        // 3. Rotate
        // 4. Translate back
        // 5. Apply final translation

        const m = this.transformMatrix;

        // Combined transformation matrix
        m[0] = t.scaleX * cos;
        m[1] = t.scaleX * sin;
        m[2] = 0;
        m[3] = 0;

        m[4] = -t.scaleY * sin;
        m[5] = t.scaleY * cos;
        m[6] = 0;
        m[7] = 0;

        m[8] = 0;
        m[9] = 0;
        m[10] = 1;
        m[11] = 0;

        // Translation component
        const tx = t.translateX - t.originX * (t.scaleX * cos - 1) + t.originY * t.scaleY * sin;
        const ty = t.translateY - t.originX * t.scaleX * sin - t.originY * (t.scaleY * cos - 1);

        m[12] = tx;
        m[13] = ty;
        m[14] = 0;
        m[15] = 1;

        this.transformDirty = false;
    }

    // ========================================================================
    // Position and Visibility
    // ========================================================================

    /**
     * Set layer position
     */
    setPosition(x: Pixels, y: Pixels): void {
        if (x === this.config.x && y === this.config.y) {
            return;
        }

        (this.config as any).x = x;
        (this.config as any).y = y;
        this.markFullDamage();
    }

    /**
     * Get layer position
     */
    getPosition(): { x: Pixels; y: Pixels } {
        return { x: this.config.x, y: this.config.y };
    }

    /**
     * Set layer z-index
     */
    setZIndex(zIndex: number): void {
        (this.config as any).zIndex = zIndex;
    }

    /**
     * Get layer z-index
     */
    getZIndex(): number {
        return this.config.zIndex;
    }

    /**
     * Set layer opacity
     */
    setOpacity(opacity: number): void {
        opacity = Math.max(0, Math.min(1, opacity));
        if (opacity === this.config.opacity) {
            return;
        }

        (this.config as any).opacity = opacity;
        this.markFullDamage();
    }

    /**
     * Get layer opacity
     */
    getOpacity(): number {
        return this.config.opacity;
    }

    /**
     * Set layer visibility
     */
    setVisible(visible: boolean): void {
        if (visible === this.visible) {
            return;
        }

        this.visible = visible;
        this.markFullDamage();
    }

    /**
     * Check if layer is visible
     */
    isVisible(): boolean {
        return this.visible && this.config.opacity > 0;
    }

    /**
     * Set occluded state (for culling)
     */
    setOccluded(occluded: boolean): void {
        this.occluded = occluded;
    }

    /**
     * Check if layer is occluded
     */
    isOccluded(): boolean {
        return this.occluded;
    }

    /**
     * Set blend mode
     */
    setBlendMode(blendMode: BlendMode): void {
        (this.config as any).blendMode = blendMode;
        this.markFullDamage();
    }

    /**
     * Get blend mode
     */
    getBlendMode(): BlendMode {
        return this.config.blendMode;
    }

    // ========================================================================
    // Parent-Child Relationships
    // ========================================================================

    /**
     * Add child layer
     */
    addChild(layerId: LayerID): void {
        this.children.add(layerId);
    }

    /**
     * Remove child layer
     */
    removeChild(layerId: LayerID): void {
        this.children.delete(layerId);
    }

    /**
     * Get child layer IDs
     */
    getChildren(): LayerID[] {
        return Array.from(this.children);
    }

    /**
     * Set parent layer
     */
    setParent(parentId: LayerID | null): void {
        this.parentId = parentId;
    }

    /**
     * Get parent layer ID
     */
    getParent(): LayerID | null {
        return this.parentId;
    }

    // ========================================================================
    // Damage Tracking
    // ========================================================================

    /**
     * Mark region as damaged
     */
    markDamage(rect: DamageRect): void {
        this.damageRects.push(rect);
        this.state = LayerState.DIRTY;
    }

    /**
     * Mark entire layer as damaged
     */
    markFullDamage(): void {
        this.fullDamage = true;
        this.damageRects = [];
        this.state = LayerState.DIRTY;
    }

    /**
     * Get damage rectangles
     */
    getDamageRects(): DamageRect[] {
        if (this.fullDamage) {
            return [
                {
                    x: this.config.x,
                    y: this.config.y,
                    width: this.config.width,
                    height: this.config.height,
                },
            ];
        }
        return [...this.damageRects];
    }

    /**
     * Clear damage
     */
    clearDamage(): void {
        this.damageRects = [];
        this.fullDamage = false;
        if (this.state === LayerState.DIRTY) {
            this.state = LayerState.READY;
        }
    }

    /**
     * Check if layer has damage
     */
    hasDamage(): boolean {
        return this.fullDamage || this.damageRects.length > 0;
    }

    // ========================================================================
    // Rendering
    // ========================================================================

    /**
     * Begin rendering to this layer
     */
    beginRender(): void {
        if (this.state === LayerState.DESTROYED) {
            throw new CompositorLayerError("Cannot render destroyed layer");
        }

        this.state = LayerState.RENDERING;
        this.lastRenderTime = Date.now() as Timestamp;
    }

    /**
     * End rendering to this layer
     */
    endRender(): void {
        if (this.state !== LayerState.RENDERING) {
            return;
        }

        const renderTime = Date.now() - this.lastRenderTime;
        this.renderTimings.push(renderTime);

        // Keep only last 60 frames
        if (this.renderTimings.length > 60) {
            this.renderTimings.shift();
        }

        this.framesRendered++;
        this.state = LayerState.READY;
    }

    /**
     * Get content texture for rendering
     */
    getContentTexture(): GPUTexture | null {
        return this.contentTexture;
    }

    /**
     * Get content texture view for rendering
     */
    getContentTextureView(): GPUTextureView | null {
        return this.contentTextureView;
    }

    /**
     * Get render target texture
     */
    getRenderTarget(): GPUTexture | null {
        if (!this.renderTarget) {
            this.createRenderTarget();
        }
        return this.renderTarget;
    }

    /**
     * Get render target view
     */
    getRenderTargetView(): GPUTextureView | null {
        if (!this.renderTargetView) {
            this.createRenderTarget();
        }
        return this.renderTargetView;
    }

    // ========================================================================
    // Configuration and State
    // ========================================================================

    /**
     * Get layer ID
     */
    getId(): LayerID {
        return this.config.id;
    }

    /**
     * Get layer type
     */
    getType(): LayerType {
        return this.config.type;
    }

    /**
     * Get layer state
     */
    getState(): LayerState {
        return this.state;
    }

    /**
     * Get layer configuration
     */
    getConfig(): Readonly<LayerConfig> {
        return this.config;
    }

    /**
     * Get layer size
     */
    getSize(): { width: Pixels; height: Pixels } {
        return { width: this.config.width, height: this.config.height };
    }

    // ========================================================================
    // Statistics
    // ========================================================================

    /**
     * Get layer statistics
     */
    getStatistics(): LayerStatistics {
        const avgRenderTime =
            this.renderTimings.length > 0
                ? this.renderTimings.reduce((a, b) => a + b, 0) / this.renderTimings.length
                : 0;

        // Calculate texture memory
        const bytesPerPixel = 4; // RGBA8
        const contentMemory = this.config.width * this.config.height * bytesPerPixel;
        const renderTargetMemory = this.renderTargetId
            ? this.config.width * this.config.height * bytesPerPixel
            : 0;

        return {
            layerId: this.config.id,
            state: this.state,
            framesRendered: this.framesRendered,
            lastRenderTime: this.lastRenderTime,
            averageRenderTime: avgRenderTime,
            textureMemory: contentMemory + renderTargetMemory,
            damageCount: this.damageRects.length,
            uploadCount: this.uploadCount,
        };
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Destroy layer and cleanup resources
     */
    destroy(): void {
        if (this.state === LayerState.DESTROYED) {
            return;
        }

        // Destroy textures
        if (this.contentTextureId) {
            this.textureManager.destroyTexture(this.contentTextureId);
            this.contentTextureId = null;
        }

        if (this.renderTargetId) {
            this.textureManager.destroyTexture(this.renderTargetId);
            this.renderTargetId = null;
        }

        // Clear references
        this.contentTexture = null;
        this.contentTextureView = null;
        this.renderTarget = null;
        this.renderTargetView = null;

        // Clear damage
        this.damageRects = [];
        this.children.clear();

        this.state = LayerState.DESTROYED;
    }
}
