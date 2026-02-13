/**
 * OffscreenWebGPU - Offscreen WebGPU Rendering Context
 *
 * Provides GPU-accelerated rendering without a display canvas.
 * Enables headless rendering with CPU pixel readback for:
 * - Server-side rendering
 * - Automated testing
 * - Compositor integration in Deno environment
 *
 * Key features:
 * - No canvas required (uses GPUTexture as render target)
 * - CPU pixel readback via staging buffer
 * - Device lost handling and recovery
 * - Resize support
 *
 * @module offscreen
 */

import type {
    Pixels,
    Timestamp,
} from "../../../types/webgpu.ts";
import { GPUDeviceState } from "../../../types/webgpu.ts";
import { WebGPUError } from "../errors.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Offscreen WebGPU state
 */
export enum OffscreenWebGPUState {
    UNINITIALIZED = "UNINITIALIZED",
    INITIALIZING = "INITIALIZING",
    READY = "READY",
    LOST = "LOST",
    DESTROYED = "DESTROYED",
}

/**
 * Configuration for offscreen WebGPU context
 */
export interface OffscreenWebGPUConfig {
    /** Initial width in pixels */
    width: number;
    /** Initial height in pixels */
    height: number;
    /** Power preference for GPU adapter */
    powerPreference?: GPUPowerPreference;
    /** Enable debug mode with verbose logging */
    debug?: boolean;
    /** Custom label for debugging */
    label?: string;
}

/**
 * Statistics for offscreen rendering
 */
export interface OffscreenWebGPUStatistics {
    state: OffscreenWebGPUState;
    width: number;
    height: number;
    textureFormat: GPUTextureFormat;
    readbackCount: number;
    totalReadbackTime: number;
    averageReadbackTime: number;
    createdAt: Timestamp;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Error specific to offscreen WebGPU operations
 */
export class OffscreenWebGPUError extends WebGPUError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, {
            recoverable: false,
            code: "OFFSCREEN_WEBGPU_ERROR",
            context,
        });
        this.name = "OffscreenWebGPUError";
    }
}

/**
 * Error when device is lost
 */
export class OffscreenDeviceLostError extends OffscreenWebGPUError {
    constructor(reason: string) {
        super(`Offscreen WebGPU device lost: ${reason}`, { reason });
        this.name = "OffscreenDeviceLostError";
    }
}

// ============================================================================
// OffscreenWebGPU Implementation
// ============================================================================

/**
 * Offscreen WebGPU context for headless rendering
 *
 * Provides GPU-accelerated rendering without a display canvas.
 * Uses a GPUTexture as the render target and provides CPU readback.
 *
 * @example
 * ```typescript
 * const offscreen = new OffscreenWebGPU();
 * await offscreen.initialize(800, 600);
 *
 * // Get texture view for rendering
 * const textureView = offscreen.textureView;
 *
 * // After rendering, read back pixels
 * const pixels = await offscreen.getPixels();
 *
 * // Cleanup
 * offscreen.dispose();
 * ```
 */
export class OffscreenWebGPU {
    // Core GPU resources
    private adapter: GPUAdapter | null = null;
    private device: GPUDevice | null = null;
    private renderTexture: GPUTexture | null = null;
    private renderTextureView: GPUTextureView | null = null;
    private readbackBuffer: GPUBuffer | null = null;

    // Dimensions
    private _width: number = 0;
    private _height: number = 0;

    // State
    private state: OffscreenWebGPUState = OffscreenWebGPUState.UNINITIALIZED;
    private debug: boolean = false;
    private label: string = "OffscreenWebGPU";

    // Statistics
    private createdAt: Timestamp = 0 as Timestamp;
    private readbackCount: number = 0;
    private totalReadbackTime: number = 0;

    // Device lost handling
    private deviceLostPromise: Promise<GPUDeviceLostInfo> | null = null;
    private onDeviceLostCallback?: (reason: string) => void;
    private onResizeCallback?: (width: number, height: number) => void;

    // Configuration
    private powerPreference: GPUPowerPreference = "high-performance";

    constructor(config?: Partial<OffscreenWebGPUConfig>) {
        if (config) {
            this.debug = config.debug ?? false;
            this.label = config.label ?? "OffscreenWebGPU";
            this.powerPreference = config.powerPreference ?? "high-performance";
        }
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Initialize the offscreen WebGPU context
     *
     * @param width - Initial width in pixels
     * @param height - Initial height in pixels
     * @throws {OffscreenWebGPUError} If initialization fails
     */
    async initialize(width: number, height: number): Promise<void> {
        if (this.state !== OffscreenWebGPUState.UNINITIALIZED) {
            throw new OffscreenWebGPUError(
                `Cannot initialize in state ${this.state}`
            );
        }

        if (width <= 0 || height <= 0) {
            throw new OffscreenWebGPUError(
                `Invalid dimensions: ${width}x${height}. Both must be positive.`
            );
        }

        this.state = OffscreenWebGPUState.INITIALIZING;
        this.createdAt = Date.now() as Timestamp;

        try {
            // Check WebGPU availability
            if (!navigator.gpu) {
                throw new OffscreenWebGPUError(
                    "WebGPU is not supported in this environment"
                );
            }

            // Request adapter
            this.adapter = await navigator.gpu.requestAdapter({
                powerPreference: this.powerPreference,
            });

            if (!this.adapter) {
                throw new OffscreenWebGPUError(
                    "No suitable GPU adapter found"
                );
            }

            // Request device
            // Note: In Deno, we avoid requesting empty features/limits arrays
            // as they can cause FFI issues
            this.device = await this.adapter.requestDevice();

            if (!this.device) {
                throw new OffscreenWebGPUError(
                    "Failed to request GPU device"
                );
            }

            // Setup device lost handling
            this.setupDeviceLostHandler();

            // Store dimensions
            this._width = width;
            this._height = height;

            // Create render texture and readback buffer
            this.createRenderTexture();
            this.createReadbackBuffer();

            this.state = OffscreenWebGPUState.READY;

            if (this.debug) {
                console.log(
                    `[${this.label}] Initialized ${width}x${height}`
                );
            }
        } catch (error) {
            this.state = OffscreenWebGPUState.UNINITIALIZED;
            this.cleanup();

            if (error instanceof OffscreenWebGPUError) {
                throw error;
            }
            throw new OffscreenWebGPUError(
                `Initialization failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Setup device lost event handler
     */
    private setupDeviceLostHandler(): void {
        if (!this.device) return;

        this.deviceLostPromise = this.device.lost;

        this.device.lost.then((info) => {
            if (this.state === OffscreenWebGPUState.DESTROYED) {
                // Ignore if already destroyed
                return;
            }

            this.state = OffscreenWebGPUState.LOST;

            if (this.debug) {
                console.warn(
                    `[${this.label}] Device lost: ${info.reason} - ${info.message}`
                );
            }

            if (this.onDeviceLostCallback) {
                this.onDeviceLostCallback(info.message);
            }
        });
    }

    // ========================================================================
    // Texture Management
    // ========================================================================

    /**
     * Create the render target texture
     */
    private createRenderTexture(): void {
        if (!this.device) {
            throw new OffscreenWebGPUError("Device not initialized");
        }

        // Destroy existing texture
        if (this.renderTexture) {
            this.renderTexture.destroy();
            this.renderTexture = null;
            this.renderTextureView = null;
        }

        // Create new render texture
        // Using rgba8unorm for CPU readback compatibility
        // RENDER_ATTACHMENT allows use as render target
        // COPY_SRC allows copying to staging buffer for readback
        this.renderTexture = this.device.createTexture({
            label: `${this.label}-RenderTexture`,
            size: {
                width: this._width,
                height: this._height,
                depthOrArrayLayers: 1,
            },
            format: "rgba8unorm",
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.COPY_SRC |
                GPUTextureUsage.TEXTURE_BINDING,
            sampleCount: 1,
        });

        // Create texture view
        this.renderTextureView = this.renderTexture.createView({
            label: `${this.label}-RenderTextureView`,
        });

        if (this.debug) {
            console.log(
                `[${this.label}] Created render texture ${this._width}x${this._height}`
            );
        }
    }

    // ========================================================================
    // Readback Buffer Management
    // ========================================================================

    /**
     * Create the staging buffer for CPU readback
     */
    private createReadbackBuffer(): void {
        if (!this.device) {
            throw new OffscreenWebGPUError("Device not initialized");
        }

        // Destroy existing buffer
        if (this.readbackBuffer) {
            this.readbackBuffer.destroy();
            this.readbackBuffer = null;
        }

        // Calculate buffer size with proper row alignment
        // WebGPU requires rows to be aligned to 256 bytes
        const bytesPerPixel = 4; // RGBA8
        const bytesPerRow = this._width * bytesPerPixel;
        const paddedBytesPerRow = Math.ceil(bytesPerRow / 256) * 256;
        const bufferSize = paddedBytesPerRow * this._height;

        // Create staging buffer for readback
        // MAP_READ allows CPU mapping for reading
        // COPY_DST allows GPU to copy texture data into it
        this.readbackBuffer = this.device.createBuffer({
            label: `${this.label}-ReadbackBuffer`,
            size: bufferSize,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        if (this.debug) {
            console.log(
                `[${this.label}] Created readback buffer ${bufferSize} bytes (padded row: ${paddedBytesPerRow})`
            );
        }
    }

    // ========================================================================
    // Pixel Readback
    // ========================================================================

    /**
     * Read pixels from the render texture to CPU memory
     *
     * Copies the render texture to a staging buffer and maps it for reading.
     * Returns RGBA pixel data as Uint8ClampedArray.
     *
     * @returns Pixel data in RGBA format
     * @throws {OffscreenWebGPUError} If readback fails
     */
    async getPixels(): Promise<Uint8ClampedArray> {
        if (this.state !== OffscreenWebGPUState.READY) {
            throw new OffscreenWebGPUError(
                `Cannot read pixels in state ${this.state}`
            );
        }

        if (!this.device || !this.renderTexture || !this.readbackBuffer) {
            throw new OffscreenWebGPUError("Resources not initialized");
        }

        const startTime = performance.now();

        try {
            // Calculate row sizes
            const bytesPerPixel = 4; // RGBA8
            const bytesPerRow = this._width * bytesPerPixel;
            const paddedBytesPerRow = Math.ceil(bytesPerRow / 256) * 256;

            // Create command encoder for the copy operation
            const encoder = this.device.createCommandEncoder({
                label: `${this.label}-ReadbackEncoder`,
            });

            // Copy texture to buffer
            encoder.copyTextureToBuffer(
                {
                    texture: this.renderTexture,
                    mipLevel: 0,
                    origin: { x: 0, y: 0, z: 0 },
                },
                {
                    buffer: this.readbackBuffer,
                    offset: 0,
                    bytesPerRow: paddedBytesPerRow,
                    rowsPerImage: this._height,
                },
                {
                    width: this._width,
                    height: this._height,
                    depthOrArrayLayers: 1,
                }
            );

            // Submit and wait
            const commandBuffer = encoder.finish();
            this.device.queue.submit([commandBuffer]);

            // Map buffer for reading
            await this.readbackBuffer.mapAsync(GPUMapMode.READ);

            // Get mapped range
            const mappedRange = this.readbackBuffer.getMappedRange();
            const paddedData = new Uint8Array(mappedRange);

            // Create output array (without padding)
            const pixelData = new Uint8ClampedArray(
                this._width * this._height * bytesPerPixel
            );

            // Copy row by row, removing padding
            for (let row = 0; row < this._height; row++) {
                const srcOffset = row * paddedBytesPerRow;
                const dstOffset = row * bytesPerRow;
                pixelData.set(
                    paddedData.subarray(srcOffset, srcOffset + bytesPerRow),
                    dstOffset
                );
            }

            // Unmap buffer
            this.readbackBuffer.unmap();

            // Update statistics
            const readbackTime = performance.now() - startTime;
            this.readbackCount++;
            this.totalReadbackTime += readbackTime;

            if (this.debug) {
                console.log(
                    `[${this.label}] Readback completed in ${readbackTime.toFixed(2)}ms`
                );
            }

            return pixelData;
        } catch (error) {
            throw new OffscreenWebGPUError(
                `Pixel readback failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    // ========================================================================
    // Resize
    // ========================================================================

    /**
     * Resize the render target
     *
     * Recreates the render texture and readback buffer with new dimensions.
     *
     * @param width - New width in pixels
     * @param height - New height in pixels
     */
    resize(width: number, height: number): void {
        if (this.state !== OffscreenWebGPUState.READY) {
            throw new OffscreenWebGPUError(
                `Cannot resize in state ${this.state}`
            );
        }

        if (width <= 0 || height <= 0) {
            throw new OffscreenWebGPUError(
                `Invalid dimensions: ${width}x${height}. Both must be positive.`
            );
        }

        // Skip if dimensions unchanged
        if (width === this._width && height === this._height) {
            return;
        }

        const oldWidth = this._width;
        const oldHeight = this._height;

        this._width = width;
        this._height = height;

        // Recreate resources
        this.createRenderTexture();
        this.createReadbackBuffer();

        if (this.debug) {
            console.log(
                `[${this.label}] Resized from ${oldWidth}x${oldHeight} to ${width}x${height}`
            );
        }

        // Notify callback
        if (this.onResizeCallback) {
            this.onResizeCallback(width, height);
        }
    }

    // ========================================================================
    // Device Recovery
    // ========================================================================

    /**
     * Attempt to recover from device loss
     *
     * Reinitializes the GPU context with the current dimensions.
     *
     * @throws {OffscreenWebGPUError} If recovery fails
     */
    async recover(): Promise<void> {
        if (this.state !== OffscreenWebGPUState.LOST) {
            throw new OffscreenWebGPUError(
                `Cannot recover in state ${this.state}`
            );
        }

        const width = this._width;
        const height = this._height;

        // Cleanup existing resources
        this.cleanup();

        // Reset state
        this.state = OffscreenWebGPUState.UNINITIALIZED;

        // Reinitialize
        await this.initialize(width, height);

        if (this.debug) {
            console.log(`[${this.label}] Recovered from device loss`);
        }
    }

    // ========================================================================
    // Event Handlers
    // ========================================================================

    /**
     * Set callback for device lost events
     */
    setDeviceLostHandler(callback: (reason: string) => void): void {
        this.onDeviceLostCallback = callback;
    }

    /**
     * Set callback for resize events
     */
    setResizeHandler(callback: (width: number, height: number) => void): void {
        this.onResizeCallback = callback;
    }

    // ========================================================================
    // Getters
    // ========================================================================

    /**
     * Get the GPU device
     */
    get gpuDevice(): GPUDevice | null {
        return this.device;
    }

    /**
     * Get the GPU adapter
     */
    get gpuAdapter(): GPUAdapter | null {
        return this.adapter;
    }

    /**
     * Get the render texture
     */
    get texture(): GPUTexture | null {
        return this.renderTexture;
    }

    /**
     * Get the render texture view
     */
    get textureView(): GPUTextureView | null {
        return this.renderTextureView;
    }

    /**
     * Get current width in pixels
     */
    get width(): number {
        return this._width;
    }

    /**
     * Get current height in pixels
     */
    get height(): number {
        return this._height;
    }

    /**
     * Get texture format
     */
    get format(): GPUTextureFormat {
        return "rgba8unorm";
    }

    /**
     * Get current state
     */
    getState(): OffscreenWebGPUState {
        return this.state;
    }

    /**
     * Check if ready for rendering
     */
    isReady(): boolean {
        return this.state === OffscreenWebGPUState.READY;
    }

    /**
     * Check if device is lost
     */
    isLost(): boolean {
        return this.state === OffscreenWebGPUState.LOST;
    }

    // ========================================================================
    // Statistics
    // ========================================================================

    /**
     * Get rendering statistics
     */
    getStatistics(): OffscreenWebGPUStatistics {
        return {
            state: this.state,
            width: this._width,
            height: this._height,
            textureFormat: "rgba8unorm",
            readbackCount: this.readbackCount,
            totalReadbackTime: this.totalReadbackTime,
            averageReadbackTime:
                this.readbackCount > 0
                    ? this.totalReadbackTime / this.readbackCount
                    : 0,
            createdAt: this.createdAt,
        };
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Cleanup GPU resources (internal)
     */
    private cleanup(): void {
        if (this.readbackBuffer) {
            this.readbackBuffer.destroy();
            this.readbackBuffer = null;
        }

        if (this.renderTexture) {
            this.renderTexture.destroy();
            this.renderTexture = null;
        }

        this.renderTextureView = null;

        // Note: We don't destroy the device here as it may still be in use
        // The device will be cleaned up on dispose()
    }

    /**
     * Dispose of all resources
     *
     * Call this when done with the offscreen context.
     */
    dispose(): void {
        if (this.state === OffscreenWebGPUState.DESTROYED) {
            return;
        }

        // Cleanup GPU resources
        this.cleanup();

        // Destroy device
        if (this.device) {
            this.device.destroy();
            this.device = null;
        }

        this.adapter = null;
        this.deviceLostPromise = null;
        this.onDeviceLostCallback = undefined;
        this.onResizeCallback = undefined;

        this.state = OffscreenWebGPUState.DESTROYED;

        if (this.debug) {
            console.log(`[${this.label}] Disposed`);
        }
    }
}
