/**
 * WebGPU Compositor Thread
 *
 * Main compositor implementation using WebGPU for layer composition:
 * - Layer management and ordering
 * - Frame composition and scheduling
 * - VSync synchronization
 * - Transform and blend operations
 * - Damage tracking and optimization
 * - Performance monitoring
 *
 * @module compositor
 */

import type {
    Pixels,
    Timestamp,
    Duration,
    GPUTextureID,
} from "../../../types/webgpu.ts";
import { WebGPUDevice } from "../adapter/Device.ts";
import { WebGPUCanvasContext } from "../canvas/CanvasContext.ts";
import { WebGPUTextureManager } from "../operations/render/TextureManager.ts";
import { WebGPUCommandEncoder } from "../encoder/mod.ts";
import { PipelineManager } from "../pipelines/mod.ts";
import { WebGPUError } from "../errors.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Layer identifier
 */
export type LayerID = string;

/**
 * Compositor state
 */
export enum CompositorState {
    UNINITIALIZED = "UNINITIALIZED",
    READY = "READY",
    COMPOSITING = "COMPOSITING",
    DESTROYED = "DESTROYED",
}

/**
 * Blend mode for layer composition
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
 * Transform matrix (3x3 for 2D transforms)
 */
export interface Transform {
    /** Translation X */
    translateX: number;
    /** Translation Y */
    translateY: number;
    /** Scale X */
    scaleX: number;
    /** Scale Y */
    scaleY: number;
    /** Rotation in radians */
    rotation: number;
    /** Transform origin X */
    originX: number;
    /** Transform origin Y */
    originY: number;
}

/**
 * Layer descriptor
 */
export interface LayerDescriptor {
    /** Layer ID */
    id: LayerID;
    /** Texture containing layer content */
    textureId: GPUTextureID;
    /** Position and size */
    x: Pixels;
    y: Pixels;
    width: Pixels;
    height: Pixels;
    /** Z-order (higher = on top) */
    zIndex: number;
    /** Opacity (0-1) */
    opacity: number;
    /** Blend mode */
    blendMode: BlendMode;
    /** Transform */
    transform?: Transform;
    /** Whether layer is visible */
    visible: boolean;
    /** Clipping rect */
    clipRect?: {
        x: Pixels;
        y: Pixels;
        width: Pixels;
        height: Pixels;
    };
}

/**
 * Damage rect for incremental updates
 */
export interface DamageRect {
    x: Pixels;
    y: Pixels;
    width: Pixels;
    height: Pixels;
}

/**
 * Frame timing information
 */
export interface FrameTiming {
    frameNumber: number;
    startTime: Timestamp;
    endTime: Timestamp;
    duration: Duration;
    layerCount: number;
    drawCalls: number;
    vsyncMissed: boolean;
}

/**
 * Compositor statistics
 */
export interface CompositorStatistics {
    framesComposited: number;
    averageFrameTime: Duration;
    currentFPS: number;
    droppedFrames: number;
    totalLayers: number;
    visibleLayers: number;
    textureMemoryUsed: number;
    damageRectsProcessed: number;
}

/**
 * Compositor configuration
 */
export interface CompositorConfig {
    /** Target frames per second */
    targetFPS: number;
    /** Enable VSync */
    enableVSync: boolean;
    /** Enable damage tracking */
    enableDamageTracking: boolean;
    /** Maximum frame time before dropping */
    maxFrameTime: Duration;
    /** Clear color */
    clearColor: { r: number; g: number; b: number; a: number };
}

// ============================================================================
// WebGPU Compositor Thread
// ============================================================================

/**
 * Main compositor implementation using WebGPU
 */
export class WebGPUCompositorThread {
    private readonly device: WebGPUDevice;
    private readonly canvasContext: WebGPUCanvasContext;
    private readonly textureManager: WebGPUTextureManager;
    private readonly pipelineManager: PipelineManager;

    private state: CompositorState = CompositorState.UNINITIALIZED;
    private config: CompositorConfig;

    // Layer management
    private layers: Map<LayerID, LayerDescriptor> = new Map();
    private layerOrder: LayerID[] = [];
    private dirtyLayers: Set<LayerID> = new Set();

    // Damage tracking
    private damageRects: DamageRect[] = [];
    private fullDamage = true;

    // Frame scheduling
    private frameNumber = 0;
    private lastFrameTime: Timestamp = 0 as Timestamp;
    private frameTimings: FrameTiming[] = [];
    private animationFrameId: number | null = null;
    private vsyncCallback: ((timestamp: Timestamp) => void) | null = null;

    // Statistics
    private stats: CompositorStatistics = {
        framesComposited: 0,
        averageFrameTime: 0,
        currentFPS: 0,
        droppedFrames: 0,
        totalLayers: 0,
        visibleLayers: 0,
        textureMemoryUsed: 0,
        damageRectsProcessed: 0,
    };

    // Intermediate render targets
    private compositeTexture: GPUTexture | null = null;
    private compositeTextureView: GPUTextureView | null = null;

    constructor(
        device: WebGPUDevice,
        canvasContext: WebGPUCanvasContext,
        config?: Partial<CompositorConfig>
    ) {
        this.device = device;
        this.canvasContext = canvasContext;
        this.textureManager = new WebGPUTextureManager(device);
        this.pipelineManager = new PipelineManager(device);

        this.config = {
            targetFPS: config?.targetFPS || 60,
            enableVSync: config?.enableVSync ?? true,
            enableDamageTracking: config?.enableDamageTracking ?? true,
            maxFrameTime: (config?.maxFrameTime || 33) as Duration, // ~30fps minimum
            clearColor: config?.clearColor || { r: 0, g: 0, b: 0, a: 1 },
        };
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Initialize compositor
     */
    async initialize(): Promise<void> {
        if (this.state !== CompositorState.UNINITIALIZED) {
            throw new WebGPUError("Compositor already initialized");
        }

        // Create composite texture for intermediate rendering
        const width = this.canvasContext.getWidth();
        const height = this.canvasContext.getHeight();

        this.compositeTexture = this.device.getDevice().createTexture({
            size: { width, height },
            format: "rgba8unorm",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });

        this.compositeTextureView = this.compositeTexture.createView();

        this.state = CompositorState.READY;
    }

    // ========================================================================
    // Layer Management
    // ========================================================================

    /**
     * Add or update layer
     */
    addLayer(descriptor: LayerDescriptor): void {
        const existingLayer = this.layers.get(descriptor.id);

        this.layers.set(descriptor.id, descriptor);
        this.dirtyLayers.add(descriptor.id);

        // Update layer order if new or z-index changed
        if (!existingLayer || existingLayer.zIndex !== descriptor.zIndex) {
            this.updateLayerOrder();
        }

        this.stats.totalLayers = this.layers.size;
        this.markDamage();
    }

    /**
     * Remove layer
     */
    removeLayer(layerId: LayerID): void {
        const layer = this.layers.get(layerId);
        if (!layer) return;

        this.layers.delete(layerId);
        this.dirtyLayers.delete(layerId);

        // Update layer order
        this.layerOrder = this.layerOrder.filter((id) => id !== layerId);

        this.stats.totalLayers = this.layers.size;
        this.markDamage();
    }

    /**
     * Get layer by ID
     */
    getLayer(layerId: LayerID): LayerDescriptor | null {
        return this.layers.get(layerId) || null;
    }

    /**
     * Update layer properties
     */
    updateLayer(layerId: LayerID, updates: Partial<LayerDescriptor>): void {
        const layer = this.layers.get(layerId);
        if (!layer) {
            throw new WebGPUError(`Layer ${layerId} not found`);
        }

        const updated = { ...layer, ...updates, id: layerId };
        this.layers.set(layerId, updated);
        this.dirtyLayers.add(layerId);

        // Update order if z-index changed
        if (updates.zIndex !== undefined && updates.zIndex !== layer.zIndex) {
            this.updateLayerOrder();
        }

        this.markDamage();
    }

    /**
     * Update layer ordering by z-index
     */
    private updateLayerOrder(): void {
        this.layerOrder = Array.from(this.layers.keys()).sort((a, b) => {
            const layerA = this.layers.get(a)!;
            const layerB = this.layers.get(b)!;
            return layerA.zIndex - layerB.zIndex;
        });
    }

    /**
     * Get all layers in rendering order
     */
    getLayersInOrder(): LayerDescriptor[] {
        return this.layerOrder
            .map((id) => this.layers.get(id)!)
            .filter((layer) => layer.visible);
    }

    // ========================================================================
    // Damage Tracking
    // ========================================================================

    /**
     * Mark entire frame as damaged
     */
    markDamage(): void {
        this.fullDamage = true;
    }

    /**
     * Mark specific rect as damaged
     */
    markDamageRect(rect: DamageRect): void {
        if (!this.config.enableDamageTracking) {
            this.markDamage();
            return;
        }

        this.damageRects.push(rect);
        this.stats.damageRectsProcessed++;
    }

    /**
     * Check if layer intersects damage
     */
    private layerIntersectsDamage(layer: LayerDescriptor): boolean {
        if (this.fullDamage) return true;
        if (this.damageRects.length === 0) return false;

        const layerRect = {
            x: layer.x,
            y: layer.y,
            width: layer.width,
            height: layer.height,
        };

        return this.damageRects.some((damage) =>
            this.rectsIntersect(layerRect, damage)
        );
    }

    /**
     * Check if two rects intersect
     */
    private rectsIntersect(a: DamageRect, b: DamageRect): boolean {
        return !(
            a.x + a.width < b.x ||
            b.x + b.width < a.x ||
            a.y + a.height < b.y ||
            b.y + b.height < a.y
        );
    }

    /**
     * Clear damage tracking for next frame
     */
    private clearDamage(): void {
        this.damageRects = [];
        this.fullDamage = false;
        this.dirtyLayers.clear();
    }

    // ========================================================================
    // Frame Composition
    // ========================================================================

    /**
     * Composite a single frame
     */
    async compositeFrame(): Promise<void> {
        if (this.state !== CompositorState.READY) {
            throw new WebGPUError("Compositor not ready");
        }

        this.state = CompositorState.COMPOSITING;

        const startTime = Date.now() as Timestamp;
        this.frameNumber++;

        try {
            // Get canvas texture
            const canvasTexture = this.canvasContext.getCurrentTexture();
            const canvasView = this.canvasContext.getCurrentTextureView();

            // Create command encoder
            const encoder = new WebGPUCommandEncoder(this.device, `frame-${this.frameNumber}`);

            // Get visible layers in order
            const visibleLayers = this.getLayersInOrder();
            this.stats.visibleLayers = visibleLayers.length;

            let drawCalls = 0;

            // Render each layer
            for (const layer of visibleLayers) {
                // Skip if layer doesn't intersect damage
                if (!this.layerIntersectsDamage(layer)) {
                    continue;
                }

                // Get layer texture
                const layerTexture = this.textureManager.getTexture(layer.textureId);
                if (!layerTexture) {
                    console.warn(`Layer ${layer.id} texture not found`);
                    continue;
                }

                // Composite layer to canvas
                await this.compositeLayer(encoder, layer, layerTexture, canvasView);
                drawCalls++;
            }

            // Finish and submit commands
            const commandBuffer = encoder.finish();
            this.device.getDevice().queue.submit([commandBuffer]);

            // Present frame
            this.canvasContext.present();

            // Record timing
            const endTime = Date.now() as Timestamp;
            const duration = (endTime - startTime) as Duration;

            this.recordFrameTiming({
                frameNumber: this.frameNumber,
                startTime,
                endTime,
                duration,
                layerCount: visibleLayers.length,
                drawCalls,
                vsyncMissed: duration > this.config.maxFrameTime,
            });

            // Clear damage for next frame
            this.clearDamage();

            this.stats.framesComposited++;
        } catch (error) {
            this.stats.droppedFrames++;
            throw new WebGPUError(
                `Frame composition failed: ${error instanceof Error ? error.message : String(error)}`,
                { cause: error instanceof Error ? error : undefined }
            );
        } finally {
            this.state = CompositorState.READY;
        }
    }

    /**
     * Composite a single layer
     */
    private async compositeLayer(
        encoder: WebGPUCommandEncoder,
        layer: LayerDescriptor,
        texture: GPUTexture,
        targetView: GPUTextureView
    ): Promise<void> {
        // Create render pass
        const passDescriptor = {
            colorAttachments: [{
                view: targetView,
                loadOp: this.frameNumber === 1 ? "clear" : "load",
                storeOp: "store",
                clearValue: this.config.clearColor,
            }] as GPURenderPassColorAttachment[],
        };

        const renderPass = encoder.beginRenderPass(passDescriptor);

        // TODO: Set pipeline for layer compositing
        // This requires the compositing pipeline which we'll implement next
        // For now, we just end the pass

        encoder.endRenderPass();
    }

    // ========================================================================
    // Frame Scheduling
    // ========================================================================

    /**
     * Start frame loop
     */
    startFrameLoop(): void {
        if (this.animationFrameId !== null) {
            return; // Already running
        }

        this.scheduleNextFrame();
    }

    /**
     * Stop frame loop
     */
    stopFrameLoop(): void {
        if (this.animationFrameId !== null) {
            const cancelFn = (globalThis as any).cancelAnimationFrame;
            if (cancelFn) {
                cancelFn(this.animationFrameId);
            }
            this.animationFrameId = null;
        }
    }

    /**
     * Schedule next frame
     */
    private scheduleNextFrame(): void {
        if (this.config.enableVSync) {
            const requestFn = (globalThis as any).requestAnimationFrame;
            if (requestFn) {
                this.animationFrameId = requestFn((timestamp: number) => {
                    this.onFrameCallback(timestamp as Timestamp);
                });
            } else {
                // Fallback to setTimeout for 60fps
                this.animationFrameId = setTimeout(() => {
                    this.onFrameCallback(Date.now() as Timestamp);
                }, 16) as any;
            }
        } else {
            // Manual scheduling without VSync
            const targetFrameTime = 1000 / this.config.targetFPS;
            setTimeout(() => {
                this.onFrameCallback(Date.now() as Timestamp);
            }, targetFrameTime);
        }
    }

    /**
     * Frame callback
     */
    private onFrameCallback(timestamp: Timestamp): void {
        // Composite frame
        this.compositeFrame().catch((error) => {
            console.error("Frame composition error:", error);
            this.stats.droppedFrames++;
        });

        // Call user vsync callback if set
        if (this.vsyncCallback) {
            try {
                this.vsyncCallback(timestamp);
            } catch (error) {
                console.error("VSync callback error:", error);
            }
        }

        // Schedule next frame
        this.scheduleNextFrame();
    }

    /**
     * Set VSync callback
     */
    setVSyncCallback(callback: (timestamp: Timestamp) => void): void {
        this.vsyncCallback = callback;
    }

    // ========================================================================
    // Transform Operations
    // ========================================================================

    /**
     * Create identity transform
     */
    static createIdentityTransform(): Transform {
        return {
            translateX: 0,
            translateY: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            originX: 0,
            originY: 0,
        };
    }

    /**
     * Convert transform to 4x4 matrix
     */
    static transformToMatrix(transform: Transform): Float32Array {
        const matrix = new Float32Array(16);

        const cos = Math.cos(transform.rotation);
        const sin = Math.sin(transform.rotation);

        // Translation to origin
        const tx1 = -transform.originX;
        const ty1 = -transform.originY;

        // Scale and rotate
        const m00 = transform.scaleX * cos;
        const m01 = transform.scaleX * -sin;
        const m10 = transform.scaleY * sin;
        const m11 = transform.scaleY * cos;

        // Translation back and apply final translation
        const tx2 = transform.translateX + transform.originX;
        const ty2 = transform.translateY + transform.originY;

        // Build 4x4 matrix (column-major for WebGPU)
        matrix[0] = m00;
        matrix[1] = m10;
        matrix[2] = 0;
        matrix[3] = 0;

        matrix[4] = m01;
        matrix[5] = m11;
        matrix[6] = 0;
        matrix[7] = 0;

        matrix[8] = 0;
        matrix[9] = 0;
        matrix[10] = 1;
        matrix[11] = 0;

        matrix[12] = tx1 * m00 + ty1 * m01 + tx2;
        matrix[13] = tx1 * m10 + ty1 * m11 + ty2;
        matrix[14] = 0;
        matrix[15] = 1;

        return matrix;
    }

    /**
     * Compose transforms
     */
    static composeTransforms(a: Transform, b: Transform): Transform {
        // Apply b's transform to a
        return {
            translateX: a.translateX + b.translateX,
            translateY: a.translateY + b.translateY,
            scaleX: a.scaleX * b.scaleX,
            scaleY: a.scaleY * b.scaleY,
            rotation: a.rotation + b.rotation,
            originX: a.originX,
            originY: a.originY,
        };
    }

    // ========================================================================
    // Statistics and Timing
    // ========================================================================

    /**
     * Record frame timing
     */
    private recordFrameTiming(timing: FrameTiming): void {
        this.frameTimings.push(timing);

        // Keep last 60 frames
        if (this.frameTimings.length > 60) {
            this.frameTimings.shift();
        }

        // Update statistics
        this.updateStatistics();

        this.lastFrameTime = timing.endTime;
    }

    /**
     * Update statistics from frame timings
     */
    private updateStatistics(): void {
        if (this.frameTimings.length === 0) return;

        const totalTime = this.frameTimings.reduce((sum, t) => sum + t.duration, 0);
        this.stats.averageFrameTime = (totalTime / this.frameTimings.length) as Duration;

        if (this.stats.averageFrameTime > 0) {
            this.stats.currentFPS = 1000 / this.stats.averageFrameTime;
        }

        // Update texture memory from texture manager
        const textureStats = this.textureManager.getStatistics();
        this.stats.textureMemoryUsed = textureStats.memoryUsed;
    }

    /**
     * Get compositor statistics
     */
    getStatistics(): CompositorStatistics {
        return { ...this.stats };
    }

    /**
     * Get frame timings
     */
    getFrameTimings(): FrameTiming[] {
        return [...this.frameTimings];
    }

    /**
     * Get current state
     */
    getState(): CompositorState {
        return this.state;
    }

    // ========================================================================
    // Resize Handling
    // ========================================================================

    /**
     * Handle canvas resize
     */
    resize(width: Pixels, height: Pixels): void {
        // Recreate composite texture
        if (this.compositeTexture) {
            this.compositeTexture.destroy();
        }

        this.compositeTexture = this.device.getDevice().createTexture({
            size: { width, height },
            format: "rgba8unorm",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });

        this.compositeTextureView = this.compositeTexture.createView();

        // Mark full damage
        this.markDamage();
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Destroy compositor and cleanup resources
     */
    destroy(): void {
        if (this.state === CompositorState.DESTROYED) {
            return;
        }

        // Stop frame loop
        this.stopFrameLoop();

        // Destroy intermediate textures
        if (this.compositeTexture) {
            this.compositeTexture.destroy();
            this.compositeTexture = null;
            this.compositeTextureView = null;
        }

        // Clear layers
        this.layers.clear();
        this.layerOrder = [];
        this.dirtyLayers.clear();

        // Destroy managers
        this.textureManager.destroy();

        this.state = CompositorState.DESTROYED;
    }
}
