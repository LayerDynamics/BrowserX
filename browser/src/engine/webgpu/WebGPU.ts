/**
 * WebGPU Main Engine
 *
 * Top-level integration of all WebGPU subsystems:
 * - Device management and initialization
 * - Buffer and memory operations
 * - Pipeline management (render and compute)
 * - Texture and sampler management
 * - Canvas context and compositor
 * - Command encoding and submission
 *
 * Provides a cohesive API for GPU-accelerated operations.
 *
 * @module webgpu
 */

import type {
    Pixels,
    HTMLCanvasElement,
    OffscreenCanvas,
    GPUTextureID,
    LayerID,
    Duration,
} from "../../types/webgpu.ts";
import { WebGPUDevice } from "./adapter/Device.ts";
import { WebGPUDriver } from "./driver/mod.ts";
import {
    WebGPUBuffer,
    BufferPool,
    StagingBufferPool,
} from "./buffer/mod.ts";
import { MemoryManager } from "./memory/mod.ts";
import {
    PipelineManager,
    type RenderPipelineDescriptor,
    type ComputePipelineDescriptor,
} from "./pipelines/mod.ts";
import {
    WebGPUTextureManager,
    type TextureDescriptor,
    type SamplerDescriptor,
} from "./operations/render/TextureManager.ts";
import {
    WebGPUCanvasContext,
    type CanvasContextConfig,
} from "./canvas/CanvasContext.ts";
import {
    WebGPUCompositorThread,
    type CompositorConfig,
    type LayerDescriptor as CompositorLayerDescriptor,
} from "./compositor/WebGPUCompositorThread.ts";
import {
    WebGPUCompositorLayer,
    type LayerConfig,
} from "./compositor/WebGPUCompositorLayer.ts";
import { WebGPUCommandEncoder } from "./encoder/mod.ts";
import {
    ComputePipeline,
    type ComputeConfig,
} from "./operations/compute/mod.ts";
import { WebGPUError } from "./errors.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * WebGPU engine state
 */
export enum WebGPUEngineState {
    UNINITIALIZED = "UNINITIALIZED",
    INITIALIZING = "INITIALIZING",
    READY = "READY",
    ERROR = "ERROR",
    DESTROYED = "DESTROYED",
}

/**
 * WebGPU engine configuration
 */
export interface WebGPUEngineConfig {
    /** Request high-performance GPU adapter */
    powerPreference?: GPUPowerPreference;
    /** Canvas for rendering (optional) */
    canvas?: HTMLCanvasElement | OffscreenCanvas;
    /** Canvas configuration */
    canvasConfig?: Partial<CanvasContextConfig>;
    /** Enable compositor */
    enableCompositor?: boolean;
    /** Compositor configuration */
    compositorConfig?: Partial<CompositorConfig>;
    /** Enable debug mode */
    debug?: boolean;
}

/**
 * WebGPU engine statistics
 */
export interface WebGPUEngineStatistics {
    state: WebGPUEngineState;
    device: {
        adapterInfo: string;
        limits: Record<string, number>;
        features: string[];
    };
    memory: {
        bufferMemory: number;
        textureMemory: number;
        totalAllocated: number;
    };
    pipelines: {
        renderPipelines: number;
        computePipelines: number;
    };
    compositor: {
        layers: number;
        framesRendered: number;
        currentFPS: number;
    };
}

// ============================================================================
// WebGPU Engine Error
// ============================================================================

/**
 * Error related to WebGPU engine operations
 */
export class WebGPUEngineError extends WebGPUError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, {
            recoverable: false,
            code: "WEBGPU_ENGINE_ERROR",
            context,
        });
        this.name = "WebGPUEngineError";
    }
}

// ============================================================================
// WebGPU Main Engine
// ============================================================================

/**
 * Main WebGPU engine integrating all subsystems
 */
export class WebGPUEngine {
    private state: WebGPUEngineState = WebGPUEngineState.UNINITIALIZED;
    private config: WebGPUEngineConfig;

    // Core subsystems
    private driver: WebGPUDriver | null = null;
    private device: WebGPUDevice | null = null;

    // Memory management
    private memoryManager: MemoryManager | null = null;
    private bufferPool: BufferPool | null = null;
    private stagingPool: StagingBufferPool | null = null;

    // Pipeline management
    private pipelineManager: PipelineManager | null = null;

    // Texture management
    private textureManager: WebGPUTextureManager | null = null;

    // Canvas and compositor
    private canvasContext: WebGPUCanvasContext | null = null;
    private compositor: WebGPUCompositorThread | null = null;
    private layers: Map<LayerID, WebGPUCompositorLayer> = new Map();

    // Compute operations
    private computePipeline: ComputePipeline | null = null;

    // Debug mode
    private debug: boolean = false;

    constructor(config: WebGPUEngineConfig = {}) {
        this.config = config;
        this.debug = config.debug || false;
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Initialize WebGPU engine
     */
    async initialize(): Promise<void> {
        if (this.state !== WebGPUEngineState.UNINITIALIZED) {
            throw new WebGPUEngineError(
                `Cannot initialize engine in state ${this.state}`
            );
        }

        this.state = WebGPUEngineState.INITIALIZING;

        try {
            // Initialize driver and device
            await this.initializeDevice();

            // Initialize memory management
            this.initializeMemory();

            // Initialize pipeline management
            this.initializePipelines();

            // Initialize texture management
            this.initializeTextures();

            // Initialize canvas and compositor if canvas provided
            if (this.config.canvas) {
                this.initializeCanvas();

                if (this.config.enableCompositor !== false) {
                    await this.initializeCompositor();
                }
            }

            // Initialize compute operations
            this.initializeCompute();

            this.state = WebGPUEngineState.READY;

            if (this.debug) {
                console.log("[WebGPU] Engine initialized successfully");
            }
        } catch (error) {
            this.state = WebGPUEngineState.ERROR;
            throw new WebGPUEngineError(
                `Failed to initialize WebGPU engine: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Initialize device and driver
     */
    private async initializeDevice(): Promise<void> {
        this.driver = new WebGPUDriver({
            powerPreference: this.config.powerPreference,
        });
        this.device = new WebGPUDevice();

        await this.driver.initialize();
        await this.device.initialize();
    }

    /**
     * Initialize memory management
     */
    private initializeMemory(): void {
        if (!this.device) {
            throw new WebGPUEngineError("Device not initialized");
        }

        this.memoryManager = new MemoryManager(this.device);
        this.bufferPool = new BufferPool(this.device);
        this.stagingPool = new StagingBufferPool(this.device);
    }

    /**
     * Initialize pipeline management
     */
    private initializePipelines(): void {
        if (!this.device) {
            throw new WebGPUEngineError("Device not initialized");
        }

        this.pipelineManager = new PipelineManager(this.device);
    }

    /**
     * Initialize texture management
     */
    private initializeTextures(): void {
        if (!this.device) {
            throw new WebGPUEngineError("Device not initialized");
        }

        this.textureManager = new WebGPUTextureManager(this.device);
    }

    /**
     * Initialize canvas context
     */
    private initializeCanvas(): void {
        if (!this.device || !this.config.canvas) {
            throw new WebGPUEngineError("Device or canvas not available");
        }

        const canvasConfig: CanvasContextConfig = {
            canvas: this.config.canvas,
            ...this.config.canvasConfig,
        };

        this.canvasContext = new WebGPUCanvasContext(this.device, canvasConfig);
    }

    /**
     * Initialize compositor
     */
    private async initializeCompositor(): Promise<void> {
        if (!this.device || !this.canvasContext) {
            throw new WebGPUEngineError("Required subsystems not initialized");
        }

        const compositorConfig: CompositorConfig = {
            targetFPS: 60,
            enableVSync: true,
            enableDamageTracking: true,
            maxFrameTime: 33 as Duration,
            clearColor: { r: 0, g: 0, b: 0, a: 1 },
            ...this.config.compositorConfig,
        };

        this.compositor = new WebGPUCompositorThread(
            this.device,
            this.canvasContext,
            compositorConfig
        );

        await this.compositor.initialize();
    }

    /**
     * Initialize compute operations
     */
    private initializeCompute(): void {
        if (!this.device || !this.pipelineManager) {
            throw new WebGPUEngineError("Required subsystems not initialized");
        }

        this.computePipeline = new ComputePipeline(
            this.device,
            this.pipelineManager.getComputePipelineManager()
        );
    }

    // ========================================================================
    // Device Access
    // ========================================================================

    /**
     * Get WebGPU device
     */
    getDevice(): WebGPUDevice {
        if (!this.device) {
            throw new WebGPUEngineError("Device not initialized");
        }
        return this.device;
    }

    /**
     * Get native GPU device
     */
    getGPUDevice(): GPUDevice {
        return this.getDevice().getDevice();
    }

    // ========================================================================
    // Buffer Operations
    // ========================================================================

    /**
     * Create buffer
     */
    createBuffer(
        size: number,
        usage: GPUBufferUsageFlags,
        label?: string
    ): WebGPUBuffer {
        if (!this.device) {
            throw new WebGPUEngineError("Device not initialized");
        }

        return new WebGPUBuffer(this.device, { size, usage, label });
    }

    /**
     * Get buffer from pool
     */
    getPooledBuffer(size: number, usage: GPUBufferUsageFlags): WebGPUBuffer | null {
        if (!this.bufferPool) {
            throw new WebGPUEngineError("Buffer pool not initialized");
        }

        return this.bufferPool.acquire(size, usage);
    }

    /**
     * Release buffer to pool
     */
    releaseBuffer(buffer: WebGPUBuffer): void {
        if (!this.bufferPool) {
            throw new WebGPUEngineError("Buffer pool not initialized");
        }

        this.bufferPool.release(buffer);
    }

    // ========================================================================
    // Pipeline Operations
    // ========================================================================

    /**
     * Create render pipeline
     */
    async createRenderPipeline(
        descriptor: RenderPipelineDescriptor
    ): Promise<GPURenderPipeline> {
        if (!this.pipelineManager) {
            throw new WebGPUEngineError("Pipeline manager not initialized");
        }

        return await this.pipelineManager
            .getRenderPipelineManager()
            .getPipeline(descriptor);
    }

    /**
     * Create compute pipeline
     */
    async createComputePipeline(
        descriptor: ComputePipelineDescriptor
    ): Promise<GPUComputePipeline> {
        if (!this.pipelineManager) {
            throw new WebGPUEngineError("Pipeline manager not initialized");
        }

        return await this.pipelineManager
            .getComputePipelineManager()
            .getPipeline(descriptor);
    }

    // ========================================================================
    // Texture Operations
    // ========================================================================

    /**
     * Create texture
     */
    createTexture(descriptor: TextureDescriptor): GPUTextureID {
        if (!this.textureManager) {
            throw new WebGPUEngineError("Texture manager not initialized");
        }

        return this.textureManager.createTexture(descriptor);
    }

    /**
     * Get texture
     */
    getTexture(id: GPUTextureID): GPUTexture | null {
        if (!this.textureManager) {
            throw new WebGPUEngineError("Texture manager not initialized");
        }

        return this.textureManager.getTexture(id);
    }

    /**
     * Upload pixel data to texture
     */
    uploadPixelData(
        texture: GPUTexture,
        pixels: Uint8Array,
        width: number,
        height: number
    ): void {
        if (!this.textureManager) {
            throw new WebGPUEngineError("Texture manager not initialized");
        }

        this.textureManager.uploadPixelData(texture, pixels, width, height);
    }

    /**
     * Create sampler
     */
    createSampler(descriptor: SamplerDescriptor): GPUSampler {
        if (!this.textureManager) {
            throw new WebGPUEngineError("Texture manager not initialized");
        }

        return this.textureManager.getSampler(descriptor);
    }

    // ========================================================================
    // Canvas Operations
    // ========================================================================

    /**
     * Get canvas context
     */
    getCanvasContext(): WebGPUCanvasContext {
        if (!this.canvasContext) {
            throw new WebGPUEngineError("Canvas context not initialized");
        }
        return this.canvasContext;
    }

    /**
     * Resize canvas
     */
    resizeCanvas(width: Pixels, height: Pixels): void {
        if (!this.canvasContext) {
            throw new WebGPUEngineError("Canvas context not initialized");
        }

        this.canvasContext.resize(width, height);

        // Update compositor if enabled
        if (this.compositor) {
            this.compositor.resize(width, height);
        }
    }

    // ========================================================================
    // Compositor Operations
    // ========================================================================

    /**
     * Get compositor
     */
    getCompositor(): WebGPUCompositorThread {
        if (!this.compositor) {
            throw new WebGPUEngineError("Compositor not initialized");
        }
        return this.compositor;
    }

    // ========================================================================
    // Subsystem Access - Composable Toolkit API
    // ========================================================================

    /**
     * Get WebGPU driver
     *
     * Provides access to GPU driver management with auto-recovery and performance monitoring.
     *
     * Available after engine initialization. Use this to:
     * - Monitor driver state and recovery events
     * - Access adapter information
     * - Handle device lost scenarios
     *
     * @returns {WebGPUDriver} The driver instance
     * @throws {WebGPUEngineError} If engine is not initialized
     *
     * @example
     * ```typescript
     * const engine = new WebGPUEngine();
     * await engine.initialize();
     * const driver = engine.getDriver();
     * const state = driver.getState();
     * ```
     */
    getDriver(): WebGPUDriver {
        if (!this.driver) {
            throw new WebGPUEngineError("Driver not initialized", {
                state: this.state,
                subsystem: "driver",
            });
        }
        return this.driver;
    }

    /**
     * Get memory manager
     *
     * Unified memory coordination for all GPU memory operations.
     *
     * The memory manager provides:
     * - Buffer pool management with LRU eviction
     * - Staging ring for efficient CPU→GPU uploads
     * - Memory allocation tracking and statistics
     *
     * Available after engine initialization. Use this to:
     * - Access buffer pool directly
     * - Manage staging buffers
     * - Monitor memory usage and allocation patterns
     *
     * @returns {MemoryManager} The memory manager instance
     * @throws {WebGPUEngineError} If engine is not initialized
     *
     * @example
     * ```typescript
     * const engine = new WebGPUEngine();
     * await engine.initialize();
     * const memoryManager = engine.getMemoryManager();
     * const stats = memoryManager.getStatistics();
     * console.log(`Total memory: ${stats.bufferPool.totalMemory} bytes`);
     * ```
     */
    getMemoryManager(): MemoryManager {
        if (!this.memoryManager) {
            throw new WebGPUEngineError("Memory manager not initialized", {
                state: this.state,
                subsystem: "memory-manager",
            });
        }
        return this.memoryManager;
    }

    /**
     * Get buffer pool
     *
     * Reusable buffer pool for minimizing GPU allocation overhead.
     *
     * The buffer pool provides:
     * - Automatic buffer reuse by size and usage
     * - LRU eviction for cache management
     * - Pool statistics and trimming
     *
     * Available after engine initialization. Use this to:
     * - Acquire and release buffers directly
     * - Monitor pool hit/miss rates
     * - Trim unused buffers
     *
     * @returns {BufferPool} The buffer pool instance
     * @throws {WebGPUEngineError} If engine is not initialized
     *
     * @example
     * ```typescript
     * const engine = new WebGPUEngine();
     * await engine.initialize();
     * const bufferPool = engine.getBufferPool();
     * const buffer = bufferPool.acquire(1024, GPUBufferUsageFlags.VERTEX);
     * // ... use buffer ...
     * bufferPool.release(buffer);
     * ```
     */
    getBufferPool(): BufferPool {
        if (!this.bufferPool) {
            throw new WebGPUEngineError("Buffer pool not initialized", {
                state: this.state,
                subsystem: "buffer-pool",
            });
        }
        return this.bufferPool;
    }

    /**
     * Get staging buffer pool
     *
     * Staging buffer pool for efficient CPU→GPU uploads.
     *
     * The staging pool provides:
     * - Temporary staging buffers for uploads
     * - Pool-based reuse for reduced allocations
     * - Statistics tracking
     *
     * Available after engine initialization. Use this to:
     * - Acquire staging buffers for data uploads
     * - Monitor staging buffer usage
     * - Manage staging buffer lifecycle
     *
     * @returns {StagingBufferPool} The staging buffer pool instance
     * @throws {WebGPUEngineError} If engine is not initialized
     *
     * @example
     * ```typescript
     * const engine = new WebGPUEngine();
     * await engine.initialize();
     * const stagingPool = engine.getStagingPool();
     * const buffer = stagingPool.acquire(4096);
     * // ... use staging buffer ...
     * stagingPool.release(buffer);
     * ```
     */
    getStagingPool(): StagingBufferPool {
        if (!this.stagingPool) {
            throw new WebGPUEngineError("Staging buffer pool not initialized", {
                state: this.state,
                subsystem: "staging-pool",
            });
        }
        return this.stagingPool;
    }

    /**
     * Get pipeline manager
     *
     * Pipeline creation and caching for both render and compute pipelines.
     *
     * The pipeline manager provides:
     * - Render pipeline caching with descriptor hashing
     * - Compute pipeline caching
     * - Compilation statistics and hit rates
     *
     * Available after engine initialization. Use this to:
     * - Access render and compute pipeline managers
     * - Monitor pipeline cache performance
     * - Clear pipeline caches
     *
     * @returns {PipelineManager} The pipeline manager instance
     * @throws {WebGPUEngineError} If engine is not initialized
     *
     * @example
     * ```typescript
     * const engine = new WebGPUEngine();
     * await engine.initialize();
     * const pipelineManager = engine.getPipelineManager();
     * const stats = pipelineManager.getStats();
     * console.log(`Render pipelines: ${stats.renderPipelines.total}`);
     * ```
     */
    getPipelineManager(): PipelineManager {
        if (!this.pipelineManager) {
            throw new WebGPUEngineError("Pipeline manager not initialized", {
                state: this.state,
                subsystem: "pipeline-manager",
            });
        }
        return this.pipelineManager;
    }

    /**
     * Get texture manager
     *
     * Texture lifecycle and sampler management.
     *
     * The texture manager provides:
     * - Texture creation and tracking
     * - Bitmap uploading from multiple sources
     * - Sampler caching
     * - Mipmap generation
     *
     * Available after engine initialization. Use this to:
     * - Create and manage textures directly
     * - Upload pixel data and bitmaps
     * - Access sampler cache
     * - Monitor texture memory usage
     *
     * @returns {WebGPUTextureManager} The texture manager instance
     * @throws {WebGPUEngineError} If engine is not initialized
     *
     * @example
     * ```typescript
     * const engine = new WebGPUEngine();
     * await engine.initialize();
     * const textureManager = engine.getTextureManager();
     * const stats = textureManager.getStatistics();
     * console.log(`Active textures: ${stats.activeTextures}`);
     * ```
     */
    getTextureManager(): WebGPUTextureManager {
        if (!this.textureManager) {
            throw new WebGPUEngineError("Texture manager not initialized", {
                state: this.state,
                subsystem: "texture-manager",
            });
        }
        return this.textureManager;
    }

    /**
     * Create compositor layer
     */
    createLayer(config: LayerConfig): LayerID {
        if (!this.device || !this.textureManager) {
            throw new WebGPUEngineError("Required subsystems not initialized");
        }

        const layer = new WebGPUCompositorLayer(
            this.device,
            this.textureManager,
            config
        );

        this.layers.set(config.id, layer);

        // Add to compositor if enabled
        if (this.compositor) {
            const layerDescriptor: CompositorLayerDescriptor = {
                id: config.id,
                textureId: layer.getContentTexture()?.label as GPUTextureID || ("" as GPUTextureID),
                x: config.x,
                y: config.y,
                width: config.width,
                height: config.height,
                zIndex: config.zIndex,
                opacity: config.opacity,
                blendMode: config.blendMode,
                transform: config.transform,
                visible: config.visible,
            };

            this.compositor.addLayer(layerDescriptor);
        }

        return config.id;
    }

    /**
     * Get layer
     */
    getLayer(id: LayerID): WebGPUCompositorLayer | null {
        return this.layers.get(id) || null;
    }

    /**
     * Composite frame
     */
    async compositeFrame(): Promise<void> {
        if (!this.compositor) {
            throw new WebGPUEngineError("Compositor not initialized");
        }

        await this.compositor.compositeFrame();
    }

    // ========================================================================
    // Compute Operations
    // ========================================================================

    /**
     * Get compute pipeline manager
     */
    getComputePipeline(): ComputePipeline {
        if (!this.computePipeline) {
            throw new WebGPUEngineError("Compute pipeline not initialized");
        }
        return this.computePipeline;
    }

    /**
     * Run compute shader
     */
    async runCompute(
        config: ComputeConfig,
        bindGroups: GPUBindGroup[],
        dataSize: number | { width: number; height: number }
    ): Promise<void> {
        if (!this.computePipeline) {
            throw new WebGPUEngineError("Compute pipeline not initialized");
        }

        const encoder = this.createCommandEncoder();
        await this.computePipeline.runCompute(
            encoder.getEncoder(),
            config,
            bindGroups,
            dataSize
        );

        const commandBuffer = encoder.finish();
        this.getGPUDevice().queue.submit([commandBuffer]);
    }

    // ========================================================================
    // Command Encoding
    // ========================================================================

    /**
     * Create command encoder
     */
    createCommandEncoder(label?: string): WebGPUCommandEncoder {
        if (!this.device) {
            throw new WebGPUEngineError("Device not initialized");
        }

        return new WebGPUCommandEncoder(this.device, label);
    }

    /**
     * Submit command buffers
     */
    submit(commandBuffers: GPUCommandBuffer[]): void {
        this.getGPUDevice().queue.submit(commandBuffers);
    }

    // ========================================================================
    // State
    // ========================================================================

    /**
     * Get engine state
     */
    getState(): WebGPUEngineState {
        return this.state;
    }

    /**
     * Check if engine is ready
     */
    isReady(): boolean {
        return this.state === WebGPUEngineState.READY;
    }

    // ========================================================================
    // Statistics
    // ========================================================================

    /**
     * Get engine statistics
     */
    getStatistics(): WebGPUEngineStatistics {
        if (!this.device) {
            throw new WebGPUEngineError("Device not initialized");
        }

        const deviceStats = this.device.getStats();
        const memoryStats = this.memoryManager?.getStatistics();
        const textureStats = this.textureManager?.getStatistics();
        const pipelineStats = this.pipelineManager?.getStats();
        const compositorStats = this.compositor?.getStatistics();

        const bufferMemory = memoryStats?.bufferPool.inUseMemory || 0;
        const textureMemory = textureStats?.memoryUsed || 0;

        return {
            state: this.state,
            device: {
                adapterInfo: `WebGPU Device (uptime: ${deviceStats.uptime}ms)`,
                limits: Object.fromEntries(
                    Object.entries(this.getGPUDevice().limits)
                ),
                features: Array.from(this.getGPUDevice().features),
            },
            memory: {
                bufferMemory,
                textureMemory,
                totalAllocated: bufferMemory + textureMemory,
            },
            pipelines: {
                renderPipelines: pipelineStats?.renderPipelines.total || 0,
                computePipelines: pipelineStats?.computePipelines.total || 0,
            },
            compositor: {
                layers: compositorStats?.totalLayers || 0,
                framesRendered: compositorStats?.framesComposited || 0,
                currentFPS: compositorStats?.currentFPS || 0,
            },
        };
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Destroy engine and cleanup all resources
     */
    destroy(): void {
        if (this.state === WebGPUEngineState.DESTROYED) {
            return;
        }

        // Destroy layers
        for (const layer of this.layers.values()) {
            layer.destroy();
        }
        this.layers.clear();

        // Destroy compositor
        if (this.compositor) {
            this.compositor.destroy();
            this.compositor = null;
        }

        // Destroy canvas context
        if (this.canvasContext) {
            this.canvasContext.destroy();
            this.canvasContext = null;
        }

        // Destroy compute pipeline
        if (this.computePipeline) {
            this.computePipeline.destroy();
            this.computePipeline = null;
        }

        // Destroy texture manager
        if (this.textureManager) {
            this.textureManager.destroy();
            this.textureManager = null;
        }

        // Clear pipeline cache
        if (this.pipelineManager) {
            this.pipelineManager.clear();
            this.pipelineManager = null;
        }

        // Destroy memory management
        if (this.stagingPool) {
            this.stagingPool.destroy();
            this.stagingPool = null;
        }

        if (this.bufferPool) {
            this.bufferPool.destroy();
            this.bufferPool = null;
        }

        if (this.memoryManager) {
            this.memoryManager.destroy();
            this.memoryManager = null;
        }

        // Destroy device and driver
        if (this.device) {
            this.device.destroy();
            this.device = null;
        }

        if (this.driver) {
            this.driver.destroy();
            this.driver = null;
        }

        this.state = WebGPUEngineState.DESTROYED;

        if (this.debug) {
            console.log("[WebGPU] Engine destroyed");
        }
    }
}
