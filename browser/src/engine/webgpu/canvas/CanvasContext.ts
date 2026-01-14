/**
 * WebGPU Canvas Context
 *
 * Manages canvas context and swap chain for WebGPU rendering:
 * - Canvas configuration
 * - Swap chain management
 * - Surface presentation
 * - Frame acquisition
 * - Resize handling
 *
 * @module canvas
 */

import type {
    Pixels,
    Timestamp,
    HTMLCanvasElement,
    OffscreenCanvas,
} from "../../../types/webgpu.ts";
import { WebGPUDevice } from "../adapter/Device.ts";
import { WebGPUError } from "../errors.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Canvas context configuration
 */
export interface CanvasContextConfig {
    /** Canvas element or offscreen canvas */
    canvas: HTMLCanvasElement | OffscreenCanvas;
    /** Preferred swap chain format */
    format?: GPUTextureFormat;
    /** Alpha mode for compositing */
    alphaMode?: GPUCanvasAlphaMode;
    /** Color space */
    colorSpace?: PredefinedColorSpace;
    /** Usage flags for textures */
    usage?: GPUTextureUsageFlags;
    /** View formats for texture views */
    viewFormats?: GPUTextureFormat[];
}

/**
 * Canvas state
 */
export enum CanvasState {
    UNINITIALIZED = "UNINITIALIZED",
    CONFIGURED = "CONFIGURED",
    LOST = "LOST",
    DESTROYED = "DESTROYED",
}

/**
 * Canvas resize mode
 */
export enum ResizeMode {
    /** Resize immediately */
    IMMEDIATE = "IMMEDIATE",
    /** Resize on next frame */
    DEFERRED = "DEFERRED",
    /** Manual resize only */
    MANUAL = "MANUAL",
}

/**
 * Frame timing information
 */
export interface FrameTiming {
    frameNumber: number;
    acquireTime: Timestamp;
    presentTime: Timestamp;
    duration: number;
}

/**
 * Canvas statistics
 */
export interface CanvasStatistics {
    width: Pixels;
    height: Pixels;
    format: GPUTextureFormat;
    framesPresented: number;
    framesDropped: number;
    averageFrameTime: number;
    currentFPS: number;
}

// ============================================================================
// Canvas Context Errors
// ============================================================================

/**
 * Error related to canvas context operations
 */
export class CanvasContextError extends WebGPUError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, {
            recoverable: false,
            code: "CANVAS_CONTEXT_ERROR",
            context,
        });
        this.name = "CanvasContextError";
    }
}

/**
 * Error when canvas is lost
 */
export class CanvasLostError extends CanvasContextError {
    constructor(message: string) {
        super(message, { code: "CANVAS_LOST" });
        this.name = "CanvasLostError";
    }
}

// ============================================================================
// WebGPU Canvas Context
// ============================================================================

/**
 * Manages WebGPU canvas context and swap chain
 */
export class WebGPUCanvasContext {
    private readonly device: WebGPUDevice;
    private readonly canvas: HTMLCanvasElement | OffscreenCanvas;
    private context: GPUCanvasContext | null = null;
    private configuration: GPUCanvasConfiguration | null = null;
    private state: CanvasState = CanvasState.UNINITIALIZED;

    // Current frame
    private currentTexture: GPUTexture | null = null;
    private currentTextureView: GPUTextureView | null = null;
    private textureAcquired: boolean = false;  // Track if texture is currently acquired
    private lastTextureId: number = 0;  // Track texture identity to detect stale cache

    // Dimensions
    private width: Pixels = 0 as Pixels;
    private height: Pixels = 0 as Pixels;
    private devicePixelRatio: number = 1;

    // Resize handling
    private resizeMode: ResizeMode = ResizeMode.IMMEDIATE;
    private pendingResize: { width: Pixels; height: Pixels } | null = null;
    private resizeObserver: any = null; // ResizeObserver type

    // Frame timing
    private frameNumber = 0;
    private framesPresented = 0;
    private framesDropped = 0;
    private frameTimings: FrameTiming[] = [];
    private lastFrameTime: Timestamp = 0 as Timestamp;

    // Event handlers
    private onContextLost?: () => void;
    private onResize?: (width: Pixels, height: Pixels) => void;

    constructor(device: WebGPUDevice, config: CanvasContextConfig) {
        this.device = device;
        this.canvas = config.canvas;

        // Get canvas context
        const context = this.canvas.getContext("webgpu");
        if (!context) {
            throw new CanvasContextError("Failed to get WebGPU context from canvas");
        }
        this.context = context;

        // Configure context
        let preferredFormat: GPUTextureFormat;
        if (config.format) {
            preferredFormat = config.format;
        } else if (typeof navigator !== "undefined" && navigator.gpu && typeof navigator.gpu.getPreferredCanvasFormat === "function") {
            preferredFormat = navigator.gpu.getPreferredCanvasFormat();
        } else {
            // Fallback for environments without navigator.gpu (e.g., tests)
            preferredFormat = "bgra8unorm";
        }

        this.configuration = {
            device: this.device.getDevice(),
            format: preferredFormat,
            alphaMode: config.alphaMode || "opaque",
            colorSpace: config.colorSpace || "srgb",
            usage: config.usage || GPUTextureUsage.RENDER_ATTACHMENT,
            viewFormats: config.viewFormats || [],
        };

        if (this.context) {
            this.context.configure(this.configuration);
        }
        this.state = CanvasState.CONFIGURED;

        // Initialize dimensions
        this.updateDimensions();

        // Setup resize observer for HTML canvas
        if (this.isHTMLCanvas(this.canvas)) {
            this.setupResizeObserver();
        }
    }

    /**
     * Type guard for HTMLCanvasElement
     */
    private isHTMLCanvas(canvas: any): boolean {
        return canvas && "getBoundingClientRect" in canvas && typeof canvas.getBoundingClientRect === "function";
    }

    // ========================================================================
    // Configuration
    // ========================================================================

    /**
     * Reconfigure the canvas context
     */
    reconfigure(updates: Partial<GPUCanvasConfiguration>): void {
        if (this.state !== CanvasState.CONFIGURED) {
            throw new CanvasContextError(
                `Cannot reconfigure canvas in state ${this.state}`
            );
        }

        if (!this.context || !this.configuration) {
            throw new CanvasContextError("Canvas context not initialized");
        }

        // Update configuration
        this.configuration = {
            ...this.configuration,
            ...updates,
        };

        // Apply new configuration
        this.context.configure(this.configuration);
    }

    /**
     * Get current configuration
     */
    getConfiguration(): GPUCanvasConfiguration | null {
        return this.configuration;
    }

    /**
     * Set resize mode
     */
    setResizeMode(mode: ResizeMode): void {
        this.resizeMode = mode;
    }

    // ========================================================================
    // Dimensions
    // ========================================================================

    /**
     * Update canvas dimensions from actual size
     */
    private updateDimensions(): void {
        // Check if canvas has getBoundingClientRect (HTMLCanvasElement)
        if ('getBoundingClientRect' in this.canvas && typeof (this.canvas as any).getBoundingClientRect === 'function') {
            // HTML canvas - use client size
            const rect = (this.canvas as any).getBoundingClientRect();
            const dpr = (globalThis as any).devicePixelRatio || 1;
            this.devicePixelRatio = dpr;
            this.width = Math.floor(rect.width * this.devicePixelRatio) as Pixels;
            this.height = Math.floor(rect.height * this.devicePixelRatio) as Pixels;

            // Update canvas internal size
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        } else {
            // OffscreenCanvas - use configured size
            this.width = this.canvas.width as Pixels;
            this.height = this.canvas.height as Pixels;
        }
    }

    /**
     * Get canvas width in pixels
     */
    getWidth(): Pixels {
        return this.width;
    }

    /**
     * Get canvas height in pixels
     */
    getHeight(): Pixels {
        return this.height;
    }

    /**
     * Get device pixel ratio
     */
    getDevicePixelRatio(): number {
        return this.devicePixelRatio;
    }

    /**
     * Resize canvas to specific dimensions
     */
    resize(width: Pixels, height: Pixels): void {
        if (this.resizeMode === ResizeMode.MANUAL) {
            this.applyResize(width, height);
        } else if (this.resizeMode === ResizeMode.DEFERRED) {
            this.pendingResize = { width, height };
        } else {
            // IMMEDIATE
            this.applyResize(width, height);
        }
    }

    /**
     * Apply pending resize if any
     */
    private applyPendingResize(): void {
        if (this.pendingResize) {
            this.applyResize(this.pendingResize.width, this.pendingResize.height);
            this.pendingResize = null;
        }
    }

    /**
     * Actually apply the resize
     */
    private applyResize(width: Pixels, height: Pixels): void {
        const oldWidth = this.width;
        const oldHeight = this.height;

        this.width = width;
        this.height = height;

        // Update canvas size
        this.canvas.width = width;
        this.canvas.height = height;

        // Notify resize handler
        if (this.onResize && (oldWidth !== width || oldHeight !== height)) {
            this.onResize(width, height);
        }
    }

    /**
     * Setup resize observer for HTML canvas
     */
    private setupResizeObserver(): void {
        const ResizeObserverClass = (globalThis as any).ResizeObserver;
        if (typeof ResizeObserverClass === "undefined") {
            return;
        }

        this.resizeObserver = new ResizeObserverClass((entries: any[]) => {
            for (const entry of entries) {
                if (entry.target === this.canvas) {
                    const rect = entry.contentRect;
                    const width = Math.floor(rect.width * this.devicePixelRatio) as Pixels;
                    const height = Math.floor(rect.height * this.devicePixelRatio) as Pixels;

                    if (width !== this.width || height !== this.height) {
                        this.resize(width, height);
                    }
                }
            }
        });

        this.resizeObserver.observe(this.canvas as HTMLCanvasElement);
    }

    // ========================================================================
    // Frame Management
    // ========================================================================

    /**
     * Get current frame texture
     *
     * IMPORTANT: This method works around Deno's WebGPU surface texture caching bug
     * (Issue #28207) where cached textures are returned without properly acquiring
     * from wgpu-core, leaving the surface in an inconsistent state after present().
     */
    getCurrentTexture(): GPUTexture {
        if (this.state !== CanvasState.CONFIGURED) {
            throw new CanvasContextError(
                `Cannot get texture in state ${this.state}`
            );
        }

        if (!this.context) {
            throw new CanvasContextError("Canvas context not initialized");
        }

        // Apply pending resize before acquiring texture
        if (this.resizeMode === ResizeMode.DEFERRED) {
            this.applyPendingResize();
        }

        // If we already have an acquired texture this frame, return it
        if (this.currentTexture && this.textureAcquired) {
            return this.currentTexture;
        }

        // WORKAROUND: Force cache invalidation by unconfiguring/reconfiguring
        // This ensures Deno's cache doesn't return stale textures after present()
        // Addresses Deno Issue #28207: WebGPU surface texture caching bug
        if (this.textureAcquired && this.configuration) {
            // Previous texture was presented but Deno's cache may return stale texture
            // Force fresh acquisition by explicitly unconfiguring then reconfiguring
            try {
                // Explicitly unconfigure to clear internal cache
                this.context.unconfigure();
                // Reconfigure with same settings to restore context
                this.context.configure(this.configuration);
                this.textureAcquired = false;  // Reset flag after cache invalidation
            } catch (error) {
                // If unconfigure/reconfigure fails, log but continue
                console.warn("[CanvasContext] Failed to unconfigure/reconfigure context for cache invalidation:", error);
                // Try to recover by just reconfiguring
                try {
                    this.context.configure(this.configuration);
                } catch (reconfigError) {
                    console.error("[CanvasContext] Failed to recover context configuration:", reconfigError);
                }
                this.textureAcquired = false;  // Reset flag even on error
            }
        }

        // Release previous texture references
        if (this.currentTexture) {
            this.currentTexture = null;
            this.currentTextureView = null;
        }

        try {
            const acquireTime = Date.now() as Timestamp;

            // Acquire new texture from surface
            this.currentTexture = this.context.getCurrentTexture();
            this.textureAcquired = true;
            this.lastTextureId++;  // Increment to track new texture
            this.frameNumber++;

            // Record frame timing
            if (this.lastFrameTime > 0) {
                const duration = acquireTime - this.lastFrameTime;
                this.frameTimings.push({
                    frameNumber: this.frameNumber,
                    acquireTime,
                    presentTime: 0 as Timestamp, // Will be set on present
                    duration,
                });

                // Keep only last 60 frames
                if (this.frameTimings.length > 60) {
                    this.frameTimings.shift();
                }
            }
            this.lastFrameTime = acquireTime;

            return this.currentTexture;
        } catch (error) {
            this.textureAcquired = false;
            this.state = CanvasState.LOST;
            if (this.onContextLost) {
                this.onContextLost();
            }
            throw new CanvasLostError(
                `Failed to get current texture: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Get view of current frame texture
     */
    getCurrentTextureView(): GPUTextureView {
        if (!this.currentTextureView) {
            const texture = this.getCurrentTexture();
            this.currentTextureView = texture.createView();
        }
        return this.currentTextureView;
    }

    /**
     * Present the current frame
     *
     * IMPORTANT: Marks the texture as presented, which will trigger cache invalidation
     * on the next getCurrentTexture() call to work around Deno's caching bug.
     */
    present(): void {
        if (this.currentTexture && this.textureAcquired) {
            this.framesPresented++;

            // Update present time in timing
            if (this.frameTimings.length > 0) {
                this.frameTimings[this.frameTimings.length - 1].presentTime = Date.now() as Timestamp;
            }

            // Note: WebGPU automatically presents when command buffers are submitted
            // No explicit present call needed

            // Clear texture references BUT keep textureAcquired flag set
            // This signals to getCurrentTexture() that it needs to invalidate cache
            this.currentTexture = null;
            this.currentTextureView = null;
            // textureAcquired stays true to trigger reconfigure on next acquisition
        }
    }

    // ========================================================================
    // Statistics
    // ========================================================================

    /**
     * Get canvas statistics
     */
    getStatistics(): CanvasStatistics {
        const avgFrameTime = this.calculateAverageFrameTime();
        const fps = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;

        return {
            width: this.width,
            height: this.height,
            format: this.configuration?.format || "bgra8unorm",
            framesPresented: this.framesPresented,
            framesDropped: this.framesDropped,
            averageFrameTime: avgFrameTime,
            currentFPS: fps,
        };
    }

    /**
     * Calculate average frame time from recent frames
     */
    private calculateAverageFrameTime(): number {
        if (this.frameTimings.length === 0) {
            return 0;
        }

        const sum = this.frameTimings.reduce((acc, timing) => acc + timing.duration, 0);
        return sum / this.frameTimings.length;
    }

    /**
     * Get frame timing history
     */
    getFrameTimings(): FrameTiming[] {
        return [...this.frameTimings];
    }

    // ========================================================================
    // Event Handlers
    // ========================================================================

    /**
     * Set context lost handler
     */
    setContextLostHandler(handler: () => void): void {
        this.onContextLost = handler;
    }

    /**
     * Set resize handler
     */
    setResizeHandler(handler: (width: Pixels, height: Pixels) => void): void {
        this.onResize = handler;
    }

    // ========================================================================
    // State
    // ========================================================================

    /**
     * Get current state
     */
    getState(): CanvasState {
        return this.state;
    }

    /**
     * Check if context is configured
     */
    isConfigured(): boolean {
        return this.state === CanvasState.CONFIGURED;
    }

    /**
     * Check if context is lost
     */
    isLost(): boolean {
        return this.state === CanvasState.LOST;
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Destroy canvas context and cleanup resources
     */
    destroy(): void {
        if (this.state === CanvasState.DESTROYED) {
            return;
        }

        // Cleanup resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Unconfigure context
        if (this.context) {
            this.context.unconfigure();
            this.context = null;
        }

        // Clear state
        this.currentTexture = null;
        this.currentTextureView = null;
        this.textureAcquired = false;
        this.lastTextureId = 0;
        this.configuration = null;
        this.frameTimings = [];
        this.state = CanvasState.DESTROYED;
    }
}
