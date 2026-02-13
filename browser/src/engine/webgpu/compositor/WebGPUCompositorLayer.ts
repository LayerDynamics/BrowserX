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
 * - Display list rasterization and GPU upload
 * - Bind group management for compositor shaders
 * - Tiling support for large layers
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
import {
    createCompositorBindGroup,
    createCompositorUniformBuffer,
    writeCompositorUniforms,
    createIdentityTransform,
    CompositorUniformOffsets,
    CompositorVertexLayout,
} from "../shaders/mod.ts";
import type { DisplayList, BoundingBox } from "../../rendering/paint/DisplayList.ts";
import { document, type CanvasImageSource } from "../../../types/dom.ts";

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

/**
 * Tile configuration for large layers
 */
export interface TileConfig {
    /** Tile width in pixels */
    tileWidth: Pixels;
    /** Tile height in pixels */
    tileHeight: Pixels;
    /** Scale factor for tile rasterization */
    scale: number;
}

/**
 * Default tile size (256x256 is optimal for GPU textures)
 */
export const DEFAULT_TILE_SIZE = 256 as Pixels;

/**
 * Tile data for GPU upload
 */
export interface TileData {
    /** Tile index (row * cols + col) */
    index: number;
    /** Tile bounds in layer coordinates */
    bounds: BoundingBox;
    /** Texture ID for this tile */
    textureId: GPUTextureID | null;
    /** Texture view for this tile */
    textureView: GPUTextureView | null;
    /** Whether tile needs upload */
    dirty: boolean;
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

    // GPU resources for compositing
    private uniformBuffer: GPUBuffer | null = null;
    private bindGroup: GPUBindGroup | null = null;
    private sampler: GPUSampler | null = null;

    // Tiling for large layers
    private tiles: TileData[] = [];
    private tileConfig: TileConfig;
    private useTiling: boolean = false;

    // Display list for content
    private displayList: DisplayList | null = null;

    constructor(
        device: WebGPUDevice,
        textureManager: WebGPUTextureManager,
        config: LayerConfig,
        options?: {
            useTiling?: boolean;
            tileConfig?: Partial<TileConfig>;
        }
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

        // Initialize tiling configuration
        this.tileConfig = {
            tileWidth: options?.tileConfig?.tileWidth || DEFAULT_TILE_SIZE,
            tileHeight: options?.tileConfig?.tileHeight || DEFAULT_TILE_SIZE,
            scale: options?.tileConfig?.scale || 1.0,
        };

        // Enable tiling for large layers (> 4096 pixels in any dimension)
        const MAX_SINGLE_TEXTURE_SIZE = 4096;
        this.useTiling = options?.useTiling ?? (
            config.width > MAX_SINGLE_TEXTURE_SIZE ||
            config.height > MAX_SINGLE_TEXTURE_SIZE
        );

        // Create content texture (or tiles)
        if (this.useTiling) {
            this.createTiles();
        } else {
            this.createContentTexture();
        }

        // Create uniform buffer for compositor shader
        this.createUniformBuffer();

        // Create sampler for texture sampling
        this.createSampler();

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
     * Create tiles for large layers
     */
    private createTiles(): void {
        const cols = Math.ceil(this.config.width / this.tileConfig.tileWidth);
        const rows = Math.ceil(this.config.height / this.tileConfig.tileHeight);

        this.tiles = [];

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * this.tileConfig.tileWidth;
                const y = row * this.tileConfig.tileHeight;
                const width = Math.min(
                    this.tileConfig.tileWidth,
                    this.config.width - x
                ) as Pixels;
                const height = Math.min(
                    this.tileConfig.tileHeight,
                    this.config.height - y
                ) as Pixels;

                const tileData: TileData = {
                    index: row * cols + col,
                    bounds: { x: x as Pixels, y: y as Pixels, width, height },
                    textureId: null,
                    textureView: null,
                    dirty: true,
                };

                // Create texture for this tile
                const descriptor = {
                    width,
                    height,
                    format: "rgba8unorm" as GPUTextureFormat,
                    usage:
                        GPUTextureUsage.TEXTURE_BINDING |
                        GPUTextureUsage.COPY_DST |
                        GPUTextureUsage.RENDER_ATTACHMENT,
                    label: `layer-tile-${this.config.id}-${tileData.index}`,
                };

                tileData.textureId = this.textureManager.createTexture(descriptor);
                const texture = this.textureManager.getTexture(tileData.textureId);
                if (texture) {
                    tileData.textureView = texture.createView();
                }

                this.tiles.push(tileData);
            }
        }
    }

    /**
     * Create uniform buffer for compositor shader
     */
    private createUniformBuffer(): void {
        this.uniformBuffer = createCompositorUniformBuffer(
            this.device.getDevice(),
            `layer-uniforms-${this.config.id}`
        );

        // Initialize with identity transform and full opacity
        this.updateUniformBuffer();
    }

    /**
     * Update uniform buffer with current transform and opacity
     */
    private updateUniformBuffer(): void {
        if (!this.uniformBuffer) {
            return;
        }

        // Get transform matrix
        const transformMatrix = this.getTransformMatrix();

        // Write uniforms to GPU buffer
        writeCompositorUniforms(
            this.device.getDevice(),
            this.uniformBuffer,
            transformMatrix,
            this.config.opacity
        );
    }

    /**
     * Create sampler for texture sampling
     */
    private createSampler(): void {
        this.sampler = this.textureManager.getSampler({
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear",
            label: `layer-sampler-${this.config.id}`,
        });
    }

    /**
     * Upload display list content to GPU texture.
     * Rasterizes the display list to an ImageBitmap, then copies to GPU.
     *
     * @param displayList - The display list to upload
     */
    async uploadTexture(displayList: DisplayList): Promise<void> {
        if (this.state === LayerState.DESTROYED) {
            throw new CompositorLayerError("Cannot upload to destroyed layer");
        }

        this.displayList = displayList;

        if (this.useTiling) {
            await this.uploadTiledTexture(displayList);
        } else {
            await this.uploadSingleTexture(displayList);
        }

        this.markFullDamage();
        this.state = LayerState.DIRTY;
    }

    /**
     * Upload display list as a single texture
     */
    private async uploadSingleTexture(displayList: DisplayList): Promise<void> {
        if (!this.contentTexture) {
            throw new CompositorLayerError("Content texture not initialized");
        }

        // Create canvas for rasterization
        const canvas = document.createElement("canvas");
        canvas.width = this.config.width;
        canvas.height = this.config.height;

        const context = canvas.getContext("2d");
        if (!context) {
            throw new CompositorLayerError("Failed to get 2D context for rasterization");
        }

        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Replay display list to canvas
        displayList.replay(context);

        // Create ImageBitmap for efficient GPU upload
        const bitmap = await createImageBitmap(canvas as unknown as ImageBitmapSource);

        // Get pixel data from bitmap via canvas
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = bitmap.width;
        tempCanvas.height = bitmap.height;
        const tempContext = tempCanvas.getContext("2d");

        if (!tempContext) {
            bitmap.close();
            throw new CompositorLayerError("Failed to get temp context for pixel extraction");
        }

        tempContext.drawImage(bitmap as unknown as CanvasImageSource, 0, 0);
        const imageData = tempContext.getImageData(0, 0, bitmap.width, bitmap.height);
        const pixels = new Uint8Array(imageData.data.buffer);

        // Upload to GPU
        this.textureManager.uploadPixelData(
            this.contentTexture,
            pixels,
            this.config.width,
            this.config.height
        );

        bitmap.close();
        this.uploadCount++;
    }

    /**
     * Upload display list as tiled textures (256x256 tiles)
     */
    private async uploadTiledTexture(displayList: DisplayList): Promise<void> {
        for (const tile of this.tiles) {
            if (!tile.dirty && !this.fullDamage) {
                continue; // Skip clean tiles
            }

            const texture = tile.textureId
                ? this.textureManager.getTexture(tile.textureId)
                : null;

            if (!texture) {
                continue;
            }

            // Create canvas for this tile
            const canvas = document.createElement("canvas");
            canvas.width = tile.bounds.width;
            canvas.height = tile.bounds.height;

            const context = canvas.getContext("2d");
            if (!context) {
                continue;
            }

            // Clear and set up translation
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.save();
            context.translate(-tile.bounds.x, -tile.bounds.y);
            context.scale(this.tileConfig.scale, this.tileConfig.scale);

            // Clip display list to tile bounds and replay
            const clippedDisplayList = displayList.clip(tile.bounds);
            clippedDisplayList.replay(context);

            context.restore();

            // Create ImageBitmap
            const bitmap = await createImageBitmap(canvas as unknown as ImageBitmapSource);

            // Extract pixel data
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = bitmap.width;
            tempCanvas.height = bitmap.height;
            const tempContext = tempCanvas.getContext("2d");

            if (tempContext) {
                tempContext.drawImage(bitmap as unknown as CanvasImageSource, 0, 0);
                const imageData = tempContext.getImageData(0, 0, bitmap.width, bitmap.height);
                const pixels = new Uint8Array(imageData.data.buffer);

                // Upload to GPU
                this.textureManager.uploadPixelData(
                    texture,
                    pixels,
                    tile.bounds.width,
                    tile.bounds.height
                );

                tile.dirty = false;
            }

            bitmap.close();
        }

        this.uploadCount++;
    }

    /**
     * Create bind group for this layer.
     * Uses the compositor shader bind group layout with uniform buffer, texture, and sampler.
     *
     * @param layout - Bind group layout from the compositor pipeline
     * @param sampler - Sampler to use (optional, uses internal sampler if not provided)
     * @returns GPUBindGroup for this layer
     */
    createBindGroup(layout: GPUBindGroupLayout, sampler?: GPUSampler): GPUBindGroup {
        if (!this.uniformBuffer) {
            throw new CompositorLayerError("Uniform buffer not initialized");
        }

        if (!this.contentTextureView) {
            throw new CompositorLayerError("Content texture view not initialized");
        }

        const layerSampler = sampler || this.sampler;
        if (!layerSampler) {
            throw new CompositorLayerError("Sampler not initialized");
        }

        // Update uniform buffer before creating bind group
        this.updateUniformBuffer();

        // Create and store bind group
        this.bindGroup = createCompositorBindGroup(
            this.device.getDevice(),
            layout,
            this.uniformBuffer,
            this.contentTextureView,
            layerSampler,
            `layer-bind-group-${this.config.id}`
        );

        return this.bindGroup;
    }

    /**
     * Composite this layer to a render pass.
     * Draws the layer content with transforms and opacity applied.
     *
     * @param renderPass - The render pass encoder to draw to
     * @param viewport - The viewport bounds for clipping
     * @param pipeline - Optional render pipeline (must be set on render pass if not provided)
     * @param vertexBuffer - Vertex buffer for full-screen quad
     */
    composite(
        renderPass: GPURenderPassEncoder,
        viewport: BoundingBox,
        pipeline?: GPURenderPipeline,
        vertexBuffer?: GPUBuffer
    ): void {
        if (this.state === LayerState.DESTROYED) {
            return;
        }

        if (!this.isVisible() || this.isOccluded()) {
            return;
        }

        // Check if layer intersects viewport
        if (!this.intersectsViewport(viewport)) {
            return;
        }

        this.beginRender();

        try {
            // Update uniforms with current transform and opacity
            this.updateUniformBuffer();

            // Set pipeline if provided
            if (pipeline) {
                renderPass.setPipeline(pipeline);
            }

            // Set bind group
            if (this.bindGroup) {
                renderPass.setBindGroup(0, this.bindGroup);
            }

            // Set vertex buffer if provided
            if (vertexBuffer) {
                renderPass.setVertexBuffer(0, vertexBuffer);
            }

            if (this.useTiling) {
                // Draw visible tiles
                this.compositeTiles(renderPass, viewport);
            } else {
                // Draw single quad
                renderPass.draw(6); // 6 vertices for 2 triangles
            }
        } finally {
            this.endRender();
        }
    }

    /**
     * Composite tiled layer
     */
    private compositeTiles(renderPass: GPURenderPassEncoder, viewport: BoundingBox): void {
        for (const tile of this.tiles) {
            // Check if tile intersects viewport
            if (!this.boundsIntersect(tile.bounds, viewport)) {
                continue;
            }

            // Create bind group for this tile if needed
            if (tile.textureView && this.uniformBuffer && this.sampler) {
                // Note: In a full implementation, we'd have separate bind groups per tile
                // For now, we draw the visible tiles using the main bind group
                renderPass.draw(6);
            }
        }
    }

    /**
     * Check if layer intersects viewport
     */
    private intersectsViewport(viewport: BoundingBox): boolean {
        const layerBounds: BoundingBox = {
            x: this.config.x,
            y: this.config.y,
            width: this.config.width,
            height: this.config.height,
        };
        return this.boundsIntersect(layerBounds, viewport);
    }

    /**
     * Check if two bounding boxes intersect
     */
    private boundsIntersect(a: BoundingBox, b: BoundingBox): boolean {
        return !(
            a.x + a.width < b.x ||
            b.x + b.width < a.x ||
            a.y + a.height < b.y ||
            b.y + b.height < a.y
        );
    }

    /**
     * Update transform matrix and write to uniform buffer
     *
     * @param transform - 4x4 transformation matrix (16 floats)
     */
    updateTransform(transform: Float32Array): void {
        if (transform.length !== 16) {
            throw new CompositorLayerError("Transform matrix must be 4x4 (16 floats)");
        }

        // Copy transform to internal matrix
        this.transformMatrix.set(transform);
        this.transformDirty = false;

        // Update uniform buffer
        this.updateUniformBuffer();
        this.markFullDamage();
    }

    /**
     * Get the bind group for this layer
     */
    getBindGroup(): GPUBindGroup | null {
        return this.bindGroup;
    }

    /**
     * Get the uniform buffer for this layer
     */
    getUniformBuffer(): GPUBuffer | null {
        return this.uniformBuffer;
    }

    /**
     * Get tile data for this layer
     */
    getTiles(): ReadonlyArray<TileData> {
        return this.tiles;
    }

    /**
     * Get visible tiles for a viewport
     */
    getVisibleTiles(viewport: BoundingBox): TileData[] {
        return this.tiles.filter((tile) => this.boundsIntersect(tile.bounds, viewport));
    }

    /**
     * Check if layer uses tiling
     */
    isTiled(): boolean {
        return this.useTiling;
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
        if (this.useTiling) {
            // Destroy tile textures
            for (const tile of this.tiles) {
                if (tile.textureId) {
                    this.textureManager.destroyTexture(tile.textureId);
                }
            }
            this.tiles = [];
        } else {
            if (this.contentTextureId) {
                this.textureManager.destroyTexture(this.contentTextureId);
            }
        }

        if (this.renderTargetId) {
            this.textureManager.destroyTexture(this.renderTargetId);
            this.renderTargetId = null;
        }

        // Check if we need to switch tiling mode
        const MAX_SINGLE_TEXTURE_SIZE = 4096;
        const shouldUseTiling = width > MAX_SINGLE_TEXTURE_SIZE || height > MAX_SINGLE_TEXTURE_SIZE;

        if (shouldUseTiling !== this.useTiling) {
            this.useTiling = shouldUseTiling;
        }

        // Recreate textures
        if (this.useTiling) {
            this.createTiles();
        } else {
            this.createContentTexture();
        }

        // Clear bind group (needs to be recreated with new texture)
        this.bindGroup = null;

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
        let textureMemory = 0;

        if (this.useTiling) {
            // Sum up tile texture memory
            for (const tile of this.tiles) {
                if (tile.textureId) {
                    textureMemory += tile.bounds.width * tile.bounds.height * bytesPerPixel;
                }
            }
        } else {
            // Single content texture
            textureMemory = this.config.width * this.config.height * bytesPerPixel;
        }

        // Add render target memory if present
        const renderTargetMemory = this.renderTargetId
            ? this.config.width * this.config.height * bytesPerPixel
            : 0;

        // Add uniform buffer memory (80 bytes)
        const uniformBufferMemory = this.uniformBuffer ? CompositorUniformOffsets.totalSize : 0;

        return {
            layerId: this.config.id,
            state: this.state,
            framesRendered: this.framesRendered,
            lastRenderTime: this.lastRenderTime,
            averageRenderTime: avgRenderTime,
            textureMemory: textureMemory + renderTargetMemory + uniformBufferMemory,
            damageCount: this.damageRects.length,
            uploadCount: this.uploadCount,
        };
    }

    // ========================================================================
    // Configuration Updates
    // ========================================================================

    /**
     * Update layer configuration dynamically
     *
     * Allows updating mutable configuration properties at runtime.
     * Some properties (id, type) cannot be changed after construction.
     *
     * @param config - Partial configuration to merge with current config
     */
    updateConfig(config: Partial<LayerConfig>): void {
        if (this.state === LayerState.DESTROYED) {
            throw new CompositorLayerError("Cannot update config of destroyed layer");
        }

        // Update mutable properties
        if (config.x !== undefined) {
            (this.config as LayerConfig).x = config.x;
        }
        if (config.y !== undefined) {
            (this.config as LayerConfig).y = config.y;
        }
        if (config.zIndex !== undefined) {
            (this.config as LayerConfig).zIndex = config.zIndex;
        }
        if (config.opacity !== undefined) {
            const opacity = Math.max(0, Math.min(1, config.opacity));
            (this.config as LayerConfig).opacity = opacity;
        }
        if (config.blendMode !== undefined) {
            (this.config as LayerConfig).blendMode = config.blendMode;
        }
        if (config.visible !== undefined) {
            this.visible = config.visible;
            (this.config as LayerConfig).visible = config.visible;
        }
        if (config.clipToBounds !== undefined) {
            (this.config as LayerConfig).clipToBounds = config.clipToBounds;
        }
        if (config.backgroundColor !== undefined) {
            (this.config as LayerConfig).backgroundColor = config.backgroundColor;
            // Clear texture with new background color
            if (this.contentTextureView && config.backgroundColor) {
                this.clearContentTexture(config.backgroundColor);
            }
        }
        if (config.transform !== undefined) {
            this.setTransform(config.transform);
        }
        if (config.parentId !== undefined) {
            this.parentId = config.parentId || null;
            (this.config as LayerConfig).parentId = config.parentId;
        }

        // Handle size changes
        if (config.width !== undefined || config.height !== undefined) {
            const newWidth = config.width ?? this.config.width;
            const newHeight = config.height ?? this.config.height;
            this.resize(newWidth, newHeight);
        }

        // Mark as dirty to trigger re-render
        this.markFullDamage();

        // Update uniform buffer with new values
        this.updateUniformBuffer();
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Dispose layer and cleanup resources
     *
     * Alias for destroy() to match common disposal patterns.
     * Prefer using this method for consistency with other WebGPU APIs.
     */
    dispose(): void {
        this.destroy();
    }

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

        // Destroy tile textures
        for (const tile of this.tiles) {
            if (tile.textureId) {
                this.textureManager.destroyTexture(tile.textureId);
                tile.textureId = null;
                tile.textureView = null;
            }
        }
        this.tiles = [];

        // Destroy uniform buffer
        if (this.uniformBuffer) {
            this.uniformBuffer.destroy();
            this.uniformBuffer = null;
        }

        // Clear bind group reference (bind groups are not destroyed, just dereferenced)
        this.bindGroup = null;

        // Clear sampler reference (samplers are cached in texture manager)
        this.sampler = null;

        // Clear references
        this.contentTexture = null;
        this.contentTextureView = null;
        this.renderTarget = null;
        this.renderTargetView = null;

        // Clear display list
        this.displayList = null;

        // Clear damage
        this.damageRects = [];
        this.children.clear();

        this.state = LayerState.DESTROYED;
    }
}
