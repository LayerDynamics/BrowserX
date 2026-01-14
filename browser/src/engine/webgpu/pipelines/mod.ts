/**
 * WebGPU Pipeline Management
 *
 * This module provides pipeline creation, caching, and management for both
 * render and compute pipelines. Includes descriptor hashing, compilation
 * tracking, and statistics.
 */

import type {
    GPUSize,
    PipelineID,
    Duration,
} from "../../../types/webgpu.ts";
import { WebGPUDevice } from "../adapter/Device.ts";
import { GPUPipelineError } from "../errors.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Pipeline types
 */
export enum PipelineType {
    RENDER = "render",
    COMPUTE = "compute",
}

/**
 * Pipeline state
 */
export enum PipelineState {
    COMPILING = "compiling",
    READY = "ready",
    ERROR = "error",
}

/**
 * Blend mode for rendering
 */
export enum BlendMode {
    NONE = "none",
    ALPHA = "alpha",
    ADDITIVE = "additive",
    MULTIPLY = "multiply",
    SCREEN = "screen",
}

/**
 * Vertex format specification
 */
export interface VertexAttribute {
    shaderLocation: number;
    format: GPUVertexFormat;
    offset: GPUSize;
}

export interface VertexBufferLayout {
    arrayStride: GPUSize;
    stepMode?: GPUVertexStepMode;
    attributes: VertexAttribute[];
}

/**
 * Render pipeline descriptor
 */
export interface RenderPipelineDescriptor {
    label?: string;
    vertex: {
        module: GPUShaderModule;
        entryPoint: string;
        buffers?: VertexBufferLayout[];
    };
    fragment?: {
        module: GPUShaderModule;
        entryPoint: string;
        targets: GPUColorTargetState[];
    };
    primitive?: GPUPrimitiveState;
    depthStencil?: GPUDepthStencilState;
    multisample?: GPUMultisampleState;
    layout?: GPUPipelineLayout | "auto";
}

/**
 * Compute pipeline descriptor
 */
export interface ComputePipelineDescriptor {
    label?: string;
    compute: {
        module: GPUShaderModule;
        entryPoint: string;
        constants?: Record<string, number>;
    };
    layout?: GPUPipelineLayout | "auto";
}

/**
 * Cached pipeline entry
 */
interface CachedPipeline<T extends GPURenderPipeline | GPUComputePipeline> {
    id: PipelineID;
    pipeline: T;
    descriptor: RenderPipelineDescriptor | ComputePipelineDescriptor;
    hash: string;
    state: PipelineState;
    createdAt: number;
    lastUsedAt: number;
    useCount: number;
    compilationTime: Duration;
}

/**
 * Pipeline cache statistics
 */
export interface PipelineCacheStats {
    renderPipelines: {
        total: number;
        hits: number;
        misses: number;
        evictions: number;
        averageCompilationTime: Duration;
    };
    computePipelines: {
        total: number;
        hits: number;
        misses: number;
        evictions: number;
        averageCompilationTime: Duration;
    };
    cacheSize: number;
    maxCacheSize: number;
}

/**
 * Pipeline manager configuration
 */
export interface PipelineManagerConfig {
    maxCacheSize?: number; // Maximum number of cached pipelines
    enableAsync?: boolean; // Enable async pipeline compilation
    trackStatistics?: boolean; // Track cache statistics
}

// ============================================================================
// Render Pipeline Manager
// ============================================================================

/**
 * Manages render pipeline creation and caching
 */
export class RenderPipelineManager {
    private device: WebGPUDevice;
    private cache: Map<string, CachedPipeline<GPURenderPipeline>> = new Map();
    private nextId = 1;
    private config: Required<PipelineManagerConfig>;

    // Statistics
    private stats = {
        total: 0,
        hits: 0,
        misses: 0,
        evictions: 0,
        compilationTimes: [] as number[],
    };

    constructor(device: WebGPUDevice, config: PipelineManagerConfig = {}) {
        this.device = device;
        this.config = {
            maxCacheSize: config.maxCacheSize ?? 100,
            enableAsync: config.enableAsync ?? true,
            trackStatistics: config.trackStatistics ?? true,
        };
    }

    /**
     * Get or create a render pipeline
     */
    async getPipeline(
        descriptor: RenderPipelineDescriptor,
    ): Promise<GPURenderPipeline> {
        // Generate cache key from descriptor
        const hash = this.hashDescriptor(descriptor);

        // Check cache
        const cached = this.cache.get(hash);
        if (cached) {
            cached.lastUsedAt = Date.now();
            cached.useCount++;
            if (this.config.trackStatistics) {
                this.stats.hits++;
            }
            return cached.pipeline;
        }

        // Cache miss - create new pipeline
        if (this.config.trackStatistics) {
            this.stats.misses++;
        }

        const pipeline = await this.createPipeline(descriptor, hash);
        return pipeline;
    }

    /**
     * Create a new render pipeline
     *
     * Note: Async for API compatibility, but uses sync pipeline creation
     * due to Deno FFI bug with async version
     */
    // deno-lint-ignore require-await
    private async createPipeline(
        descriptor: RenderPipelineDescriptor,
        hash: string,
    ): Promise<GPURenderPipeline> {
        const startTime = performance.now();
        const id = `render-pipeline-${this.nextId++}` as PipelineID;

        try {
            const gpuDevice = this.device.getDevice();

            // Build descriptor for pipeline creation
            // WORKAROUND: Using simplified descriptor structure due to Deno FFI bug
            // The async versions lose descriptor properties during serialization
            const pipelineDescriptor = {
                label: descriptor.label || id,
                layout: (descriptor.layout !== undefined && descriptor.layout !== "auto")
                    ? descriptor.layout
                    : "auto" as const,
                vertex: {
                    module: descriptor.vertex.module,
                    entryPoint: descriptor.vertex.entryPoint,
                    ...(descriptor.vertex.buffers ? { buffers: descriptor.vertex.buffers } : {}),
                },
                ...(descriptor.fragment ? {
                    fragment: {
                        module: descriptor.fragment.module,
                        entryPoint: descriptor.fragment.entryPoint,
                        targets: descriptor.fragment.targets,
                    },
                } : {}),
                ...(descriptor.primitive ? { primitive: descriptor.primitive } : {}),
                ...(descriptor.depthStencil ? { depthStencil: descriptor.depthStencil } : {}),
                ...(descriptor.multisample ? { multisample: descriptor.multisample } : {}),
            };

            // WORKAROUND: Force sync call due to Deno FFI bug with createRenderPipelineAsync
            // Descriptor properties get lost in async version despite having the fixes
            // TODO: Re-enable async when Deno fixes the FFI serialization bug
            const pipeline: GPURenderPipeline = gpuDevice.createRenderPipeline(pipelineDescriptor);
            // if (this.config.enableAsync) {
            //     pipeline = await gpuDevice.createRenderPipelineAsync(pipelineDescriptor);
            // } else {
            //     pipeline = gpuDevice.createRenderPipeline(pipelineDescriptor);
            // }

            const compilationTime = performance.now() - startTime;

            // Cache the pipeline
            const cached: CachedPipeline<GPURenderPipeline> = {
                id,
                pipeline,
                descriptor,
                hash,
                state: PipelineState.READY,
                createdAt: Date.now(),
                lastUsedAt: Date.now(),
                useCount: 1,
                compilationTime: compilationTime as Duration,
            };

            this.cache.set(hash, cached);
            this.stats.total++;
            this.stats.compilationTimes.push(compilationTime);

            // Track in device
            this.device.trackPipelineCreated();

            // Evict old pipelines if cache is full
            if (this.cache.size > this.config.maxCacheSize) {
                this.evictLRU();
            }

            return pipeline;
        } catch (error) {
            const compilationTime = performance.now() - startTime;
            throw new GPUPipelineError(
                `Failed to create render pipeline: ${error instanceof Error ? error.message : String(error)}`,
                {
                    pipelineId: id,
                    context: {
                        compilationTime,
                        descriptor,
                    },
                },
            );
        }
    }

    /**
     * Create a simple render pipeline for common use cases
     */
    async createSimplePipeline(
        vertexShader: string,
        fragmentShader: string,
        format: GPUTextureFormat,
        blendMode: BlendMode = BlendMode.ALPHA,
    ): Promise<GPURenderPipeline> {
        const device = this.device.getDevice();

        // Create shader modules
        const vertexModule = device.createShaderModule({
            label: "Vertex Shader",
            code: vertexShader,
        });

        const fragmentModule = device.createShaderModule({
            label: "Fragment Shader",
            code: fragmentShader,
        });

        // Configure blend state
        let blend: GPUBlendState | undefined;
        switch (blendMode) {
            case BlendMode.ALPHA:
                blend = {
                    color: {
                        srcFactor: "src-alpha",
                        dstFactor: "one-minus-src-alpha",
                        operation: "add",
                    },
                    alpha: {
                        srcFactor: "one",
                        dstFactor: "one-minus-src-alpha",
                        operation: "add",
                    },
                };
                break;
            case BlendMode.ADDITIVE:
                blend = {
                    color: {
                        srcFactor: "one",
                        dstFactor: "one",
                        operation: "add",
                    },
                    alpha: {
                        srcFactor: "one",
                        dstFactor: "one",
                        operation: "add",
                    },
                };
                break;
            case BlendMode.MULTIPLY:
                blend = {
                    color: {
                        srcFactor: "dst",
                        dstFactor: "zero",
                        operation: "add",
                    },
                    alpha: {
                        srcFactor: "one",
                        dstFactor: "one-minus-src-alpha",
                        operation: "add",
                    },
                };
                break;
            case BlendMode.SCREEN:
                blend = {
                    color: {
                        srcFactor: "one",
                        dstFactor: "one-minus-src",
                        operation: "add",
                    },
                    alpha: {
                        srcFactor: "one",
                        dstFactor: "one-minus-src-alpha",
                        operation: "add",
                    },
                };
                break;
            case BlendMode.NONE:
            default:
                blend = undefined;
                break;
        }

        // Create pipeline descriptor with auto layout
        const descriptor: RenderPipelineDescriptor = {
            layout: "auto",
            vertex: {
                module: vertexModule,
                entryPoint: "main",
            },
            fragment: {
                module: fragmentModule,
                entryPoint: "main",
                targets: [{ format, blend }],
            },
            primitive: {
                topology: "triangle-list",
            },
        };

        return await this.getPipeline(descriptor);
    }

    /**
     * Hash descriptor for caching
     */
    private hashDescriptor(descriptor: RenderPipelineDescriptor): string {
        // Create a deterministic string representation
        const parts: string[] = [
            descriptor.label || "",
            descriptor.vertex.entryPoint,
            JSON.stringify(descriptor.vertex.buffers || []),
            descriptor.fragment?.entryPoint || "",
            JSON.stringify(descriptor.fragment?.targets || []),
            JSON.stringify(descriptor.primitive || {}),
            JSON.stringify(descriptor.depthStencil || {}),
            JSON.stringify(descriptor.multisample || {}),
        ];

        return parts.join("|");
    }

    /**
     * Evict least recently used pipeline
     */
    private evictLRU(): void {
        let oldest: CachedPipeline<GPURenderPipeline> | null = null;
        let oldestKey: string | null = null;

        for (const [key, cached] of this.cache) {
            if (!oldest || cached.lastUsedAt < oldest.lastUsedAt) {
                oldest = cached;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.stats.evictions++;
        }
    }

    /**
     * Clear pipeline cache
     */
    clear(): void {
        this.cache.clear();
        this.stats.total = 0;
    }

    /**
     * Get cache statistics
     */
    getStats(): PipelineCacheStats["renderPipelines"] {
        const avgTime = this.stats.compilationTimes.length > 0
            ? this.stats.compilationTimes.reduce((a, b) => a + b, 0) /
                this.stats.compilationTimes.length
            : 0;

        return {
            total: this.stats.total,
            hits: this.stats.hits,
            misses: this.stats.misses,
            evictions: this.stats.evictions,
            averageCompilationTime: avgTime as Duration,
        };
    }
}

// ============================================================================
// Compute Pipeline Manager
// ============================================================================

/**
 * Manages compute pipeline creation and caching
 */
export class ComputePipelineManager {
    private device: WebGPUDevice;
    private cache: Map<string, CachedPipeline<GPUComputePipeline>> = new Map();
    private nextId = 1;
    private config: Required<PipelineManagerConfig>;

    // Statistics
    private stats = {
        total: 0,
        hits: 0,
        misses: 0,
        evictions: 0,
        compilationTimes: [] as number[],
    };

    constructor(device: WebGPUDevice, config: PipelineManagerConfig = {}) {
        this.device = device;
        this.config = {
            maxCacheSize: config.maxCacheSize ?? 50,
            enableAsync: config.enableAsync ?? true,
            trackStatistics: config.trackStatistics ?? true,
        };
    }

    /**
     * Get or create a compute pipeline
     */
    async getPipeline(
        descriptor: ComputePipelineDescriptor,
    ): Promise<GPUComputePipeline> {
        // Generate cache key from descriptor
        const hash = this.hashDescriptor(descriptor);

        // Check cache
        const cached = this.cache.get(hash);
        if (cached) {
            cached.lastUsedAt = Date.now();
            cached.useCount++;
            if (this.config.trackStatistics) {
                this.stats.hits++;
            }
            return cached.pipeline;
        }

        // Cache miss - create new pipeline
        if (this.config.trackStatistics) {
            this.stats.misses++;
        }

        const pipeline = await this.createPipeline(descriptor, hash);
        return pipeline;
    }

    /**
     * Create a new compute pipeline
     *
     * Note: Async for API compatibility, but uses sync pipeline creation
     * due to Deno FFI bug with async version
     */
    // deno-lint-ignore require-await
    private async createPipeline(
        descriptor: ComputePipelineDescriptor,
        hash: string,
    ): Promise<GPUComputePipeline> {
        const startTime = performance.now();
        const id = `compute-pipeline-${this.nextId++}` as PipelineID;

        try {
            const gpuDevice = this.device.getDevice();

            // Build complete descriptor in single object literal
            // This matches the pattern that works in minimal test
            const pipelineDescriptor = {
                label: descriptor.label || id,
                layout: (descriptor.layout !== undefined && descriptor.layout !== "auto")
                    ? descriptor.layout
                    : "auto" as const,
                compute: {
                    module: descriptor.compute.module,
                    entryPoint: descriptor.compute.entryPoint,
                    ...(descriptor.compute.constants ? { constants: descriptor.compute.constants } : {}),
                },
            };

            // WORKAROUND: Force sync call due to Deno FFI bug with createComputePipelineAsync
            // Same issue as createRenderPipelineAsync - descriptor properties get lost in async version
            // TODO: Re-enable async when Deno fixes the FFI serialization bug
            // Always use sync version for now
            const pipeline: GPUComputePipeline = gpuDevice.createComputePipeline(pipelineDescriptor);
            // if (this.config.enableAsync) {
            //     pipeline = await gpuDevice.createComputePipelineAsync(pipelineDescriptor);
            // } else {
            //     pipeline = gpuDevice.createComputePipeline(pipelineDescriptor);
            // }

            const compilationTime = performance.now() - startTime;

            // Cache the pipeline
            const cached: CachedPipeline<GPUComputePipeline> = {
                id,
                pipeline,
                descriptor,
                hash,
                state: PipelineState.READY,
                createdAt: Date.now(),
                lastUsedAt: Date.now(),
                useCount: 1,
                compilationTime: compilationTime as Duration,
            };

            this.cache.set(hash, cached);
            this.stats.total++;
            this.stats.compilationTimes.push(compilationTime);

            // Track in device
            this.device.trackPipelineCreated();

            // Evict old pipelines if cache is full
            if (this.cache.size > this.config.maxCacheSize) {
                this.evictLRU();
            }

            return pipeline;
        } catch (error) {
            const compilationTime = performance.now() - startTime;
            throw new GPUPipelineError(
                `Failed to create compute pipeline: ${error instanceof Error ? error.message : String(error)}`,
                {
                    pipelineId: id,
                    context: {
                        compilationTime,
                        descriptor,
                    },
                },
            );
        }
    }

    /**
     * Create a simple compute pipeline
     */
    async createSimplePipeline(
        shader: string,
        entryPoint = "main",
        constants?: Record<string, number>,
    ): Promise<GPUComputePipeline> {
        const device = this.device.getDevice();

        // Create shader module
        const module = device.createShaderModule({
            label: "Compute Shader",
            code: shader,
        });

        // Create pipeline descriptor with auto layout
        const descriptor: ComputePipelineDescriptor = {
            layout: "auto",
            compute: {
                module,
                entryPoint,
                constants,
            },
        };

        return await this.getPipeline(descriptor);
    }

    /**
     * Hash descriptor for caching
     */
    private hashDescriptor(descriptor: ComputePipelineDescriptor): string {
        // Create a deterministic string representation
        const parts: string[] = [
            descriptor.label || "",
            descriptor.compute.entryPoint,
            JSON.stringify(descriptor.compute.constants || {}),
        ];

        return parts.join("|");
    }

    /**
     * Evict least recently used pipeline
     */
    private evictLRU(): void {
        let oldest: CachedPipeline<GPUComputePipeline> | null = null;
        let oldestKey: string | null = null;

        for (const [key, cached] of this.cache) {
            if (!oldest || cached.lastUsedAt < oldest.lastUsedAt) {
                oldest = cached;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.stats.evictions++;
        }
    }

    /**
     * Clear pipeline cache
     */
    clear(): void {
        this.cache.clear();
        this.stats.total = 0;
    }

    /**
     * Get cache statistics
     */
    getStats(): PipelineCacheStats["computePipelines"] {
        const avgTime = this.stats.compilationTimes.length > 0
            ? this.stats.compilationTimes.reduce((a, b) => a + b, 0) /
                this.stats.compilationTimes.length
            : 0;

        return {
            total: this.stats.total,
            hits: this.stats.hits,
            misses: this.stats.misses,
            evictions: this.stats.evictions,
            averageCompilationTime: avgTime as Duration,
        };
    }
}

// ============================================================================
// Pipeline Manager (Unified)
// ============================================================================

/**
 * Unified pipeline manager for both render and compute pipelines
 */
export class PipelineManager {
    private renderPipelines: RenderPipelineManager;
    private computePipelines: ComputePipelineManager;

    constructor(device: WebGPUDevice, config: PipelineManagerConfig = {}) {
        this.renderPipelines = new RenderPipelineManager(device, config);
        this.computePipelines = new ComputePipelineManager(device, config);
    }

    /**
     * Get render pipeline manager
     */
    getRenderPipelineManager(): RenderPipelineManager {
        return this.renderPipelines;
    }

    /**
     * Get compute pipeline manager
     */
    getComputePipelineManager(): ComputePipelineManager {
        return this.computePipelines;
    }

    /**
     * Get unified statistics
     */
    getStats(): PipelineCacheStats {
        const renderStats = this.renderPipelines.getStats();
        const computeStats = this.computePipelines.getStats();

        return {
            renderPipelines: renderStats,
            computePipelines: computeStats,
            cacheSize: renderStats.total + computeStats.total,
            maxCacheSize: 150, // Default combined max
        };
    }

    /**
     * Clear all pipeline caches
     */
    clear(): void {
        this.renderPipelines.clear();
        this.computePipelines.clear();
    }
}

// Export compositing pipeline
export {
    CompositingPipeline,
    BlendMode as CompositingBlendMode,
    type CompositingUniforms,
    type CompositingPipelineConfig,
    CompositingPipelineError,
} from "./CompositingPipeline.ts";
