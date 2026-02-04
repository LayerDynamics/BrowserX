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
import {
    createShaderCache,
    loadShader,
    hasShaderChanged,
    clearShaderCache,
    getShaderCacheStats,
    destroyShaderCache,
    type ShaderCacheStats,
    type ShaderSource,
} from "../utils/ShaderHelpers.ts";

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

    // Shader module caching using webgpu_x
    private shaderCacheHandle: bigint | null = null;
    private shaderModuleCache: Map<string, GPUShaderModule> = new Map();
    private shaderSourceHashes: Map<string, string> = new Map(); // Track source->hash for invalidation

    // Statistics
    private stats = {
        total: 0,
        hits: 0,
        misses: 0,
        evictions: 0,
        compilationTimes: [] as number[],
    };

    // Shader module statistics
    private shaderStats = {
        moduleHits: 0,
        moduleMisses: 0,
        fileReloads: 0,
    };

    constructor(device: WebGPUDevice, config: PipelineManagerConfig = {}) {
        this.device = device;
        this.config = {
            maxCacheSize: config.maxCacheSize ?? 100,
            enableAsync: config.enableAsync ?? true,
            trackStatistics: config.trackStatistics ?? true,
        };
        // Initialize webgpu_x shader cache for file-based hot-reload
        this.shaderCacheHandle = createShaderCache();
    }

    /**
     * Get or create a cached shader module from source code
     *
     * Uses in-memory hash-based caching for efficient shader module reuse.
     *
     * @param code - WGSL shader source code
     * @param label - Optional debug label
     * @returns Cached or newly created shader module
     */
    getOrCreateShaderModule(code: string, label?: string): GPUShaderModule {
        const hash = this.hashShaderCode(code);

        // Check cache
        const cached = this.shaderModuleCache.get(hash);
        if (cached) {
            if (this.config.trackStatistics) {
                this.shaderStats.moduleHits++;
            }
            return cached;
        }

        // Cache miss - create new module
        if (this.config.trackStatistics) {
            this.shaderStats.moduleMisses++;
        }

        const gpuDevice = this.device.getDevice();
        const module = gpuDevice.createShaderModule({
            label: label || `shader-${hash.substring(0, 8)}`,
            code,
        });

        this.shaderModuleCache.set(hash, module);
        this.shaderSourceHashes.set(code, hash);

        return module;
    }

    /**
     * Load shader module from file with hot-reload support
     *
     * Uses webgpu_x shader cache for file monitoring and hot-reload detection.
     *
     * @param filePath - Path to WGSL shader file
     * @param label - Optional debug label
     * @returns Shader module, or null if file couldn't be loaded
     */
    loadShaderModuleFromFile(filePath: string, label?: string): GPUShaderModule | null {
        if (!this.shaderCacheHandle) {
            this.shaderCacheHandle = createShaderCache();
        }

        // Check if file has changed (for hot-reload)
        const needsReload = hasShaderChanged(this.shaderCacheHandle, filePath);
        const cacheKey = `file:${filePath}`;

        if (!needsReload && this.shaderModuleCache.has(cacheKey)) {
            if (this.config.trackStatistics) {
                this.shaderStats.moduleHits++;
            }
            return this.shaderModuleCache.get(cacheKey)!;
        }

        // Load shader from file
        const source: ShaderSource | null = loadShader(this.shaderCacheHandle, filePath);
        if (!source) {
            return null;
        }

        if (this.config.trackStatistics) {
            if (needsReload && this.shaderModuleCache.has(cacheKey)) {
                this.shaderStats.fileReloads++;
            } else {
                this.shaderStats.moduleMisses++;
            }
        }

        const gpuDevice = this.device.getDevice();
        const module = gpuDevice.createShaderModule({
            label: label || `shader-file-${filePath}`,
            code: source.code,
        });

        this.shaderModuleCache.set(cacheKey, module);

        return module;
    }

    /**
     * Check if a shader file has changed (for hot-reload)
     */
    hasShaderFileChanged(filePath: string): boolean {
        if (!this.shaderCacheHandle) {
            return false;
        }
        return hasShaderChanged(this.shaderCacheHandle, filePath);
    }

    /**
     * Get shader cache statistics
     */
    getShaderCacheStats(): ShaderCacheStats | null {
        if (!this.shaderCacheHandle) {
            return null;
        }
        return getShaderCacheStats(this.shaderCacheHandle);
    }

    /**
     * Hash shader code for caching
     */
    private hashShaderCode(code: string): string {
        // Simple but effective hash for shader deduplication
        let hash = 0;
        for (let i = 0; i < code.length; i++) {
            const char = code.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
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
            // WORKAROUND: Deno's WebGPU FFI has issues serializing arrays to WebIDL sequences.
            // The FFI uses V8's internal API to read arrays, and certain array creation patterns
            // fail to serialize. We use Array.of() and explicit index assignment to create
            // arrays that the FFI can properly serialize.

            // Create targets array using Array.of() and explicit construction
            // This approach creates arrays that Deno's FFI can serialize to WebIDL sequences
            let targetsForFFI: Iterable<GPUColorTargetState | null> | undefined;
            if (descriptor.fragment && descriptor.fragment.targets.length > 0) {
                const len = descriptor.fragment.targets.length;
                // Use Array constructor with explicit length, then assign by index
                const arr = new Array<GPUColorTargetState | null>(len);
                for (let i = 0; i < len; i++) {
                    const src = descriptor.fragment.targets[i];
                    // Create a plain object with no prototype chain issues
                    // by using Object.assign to a null-prototype object
                    const target: Record<string, unknown> = Object.create(null);
                    target["format"] = src.format;
                    if (src.blend !== undefined && src.blend !== null) {
                        target["blend"] = src.blend;
                    }
                    if (src.writeMask !== undefined) {
                        target["writeMask"] = src.writeMask;
                    }
                    arr[i] = target as unknown as GPUColorTargetState;
                }
                // Convert to a real array-like structure using Array.from with explicit iteration
                targetsForFFI = Array.prototype.slice.call(arr, 0);
            }

            // Build vertex state
            const vertexState: GPUVertexState = {
                module: descriptor.vertex.module,
                entryPoint: descriptor.vertex.entryPoint,
            };
            if (descriptor.vertex.buffers && descriptor.vertex.buffers.length > 0) {
                vertexState.buffers = Array.from(descriptor.vertex.buffers);
            }

            // Build fragment state if present - using explicit property assignment
            let fragmentState: GPUFragmentState | undefined;
            if (descriptor.fragment && targetsForFFI) {
                // Create fragment state with explicit property assignment to avoid spread issues
                const fragObj: Record<string, unknown> = Object.create(null);
                fragObj["module"] = descriptor.fragment.module;
                fragObj["entryPoint"] = descriptor.fragment.entryPoint;
                fragObj["targets"] = targetsForFFI;
                fragmentState = fragObj as unknown as GPUFragmentState;
            }

            // Build the final descriptor using explicit property assignment
            // This avoids any potential issues with spread operators or object literals
            const descObj: Record<string, unknown> = Object.create(null);
            descObj["label"] = descriptor.label || id;
            descObj["layout"] = (descriptor.layout !== undefined && descriptor.layout !== "auto")
                ? descriptor.layout
                : "auto";
            descObj["vertex"] = vertexState;

            if (fragmentState) {
                descObj["fragment"] = fragmentState;
            }
            if (descriptor.primitive) {
                descObj["primitive"] = descriptor.primitive;
            }
            if (descriptor.depthStencil) {
                descObj["depthStencil"] = descriptor.depthStencil;
            }
            if (descriptor.multisample) {
                descObj["multisample"] = descriptor.multisample;
            }

            const pipelineDescriptor = descObj as unknown as GPURenderPipelineDescriptor;

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
     *
     * Uses cached shader modules for efficient reuse of identical shaders.
     */
    async createSimplePipeline(
        vertexShader: string,
        fragmentShader: string,
        format: GPUTextureFormat,
        blendMode: BlendMode = BlendMode.ALPHA,
    ): Promise<GPURenderPipeline> {
        // Use cached shader modules for efficiency
        const vertexModule = this.getOrCreateShaderModule(vertexShader, "Vertex Shader");
        const fragmentModule = this.getOrCreateShaderModule(fragmentShader, "Fragment Shader");

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
     * Clear shader module cache
     */
    clearShaderModuleCache(): void {
        this.shaderModuleCache.clear();
        this.shaderSourceHashes.clear();
        if (this.shaderCacheHandle) {
            clearShaderCache(this.shaderCacheHandle);
        }
        this.shaderStats.moduleHits = 0;
        this.shaderStats.moduleMisses = 0;
        this.shaderStats.fileReloads = 0;
    }

    /**
     * Destroy the pipeline manager and release resources
     */
    destroy(): void {
        this.clear();
        this.clearShaderModuleCache();
        if (this.shaderCacheHandle) {
            destroyShaderCache(this.shaderCacheHandle);
            this.shaderCacheHandle = null;
        }
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

    /**
     * Get shader module cache statistics
     */
    getShaderModuleStats(): {
        moduleHits: number;
        moduleMisses: number;
        fileReloads: number;
        cachedModules: number;
    } {
        return {
            ...this.shaderStats,
            cachedModules: this.shaderModuleCache.size,
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

    // Shader module caching using webgpu_x
    private shaderCacheHandle: bigint | null = null;
    private shaderModuleCache: Map<string, GPUShaderModule> = new Map();
    private shaderSourceHashes: Map<string, string> = new Map();

    // Statistics
    private stats = {
        total: 0,
        hits: 0,
        misses: 0,
        evictions: 0,
        compilationTimes: [] as number[],
    };

    // Shader module statistics
    private shaderStats = {
        moduleHits: 0,
        moduleMisses: 0,
        fileReloads: 0,
    };

    constructor(device: WebGPUDevice, config: PipelineManagerConfig = {}) {
        this.device = device;
        this.config = {
            maxCacheSize: config.maxCacheSize ?? 50,
            enableAsync: config.enableAsync ?? true,
            trackStatistics: config.trackStatistics ?? true,
        };
        // Initialize webgpu_x shader cache for file-based hot-reload
        this.shaderCacheHandle = createShaderCache();
    }

    /**
     * Get or create a cached shader module from source code
     */
    getOrCreateShaderModule(code: string, label?: string): GPUShaderModule {
        const hash = this.hashShaderCode(code);

        const cached = this.shaderModuleCache.get(hash);
        if (cached) {
            if (this.config.trackStatistics) {
                this.shaderStats.moduleHits++;
            }
            return cached;
        }

        if (this.config.trackStatistics) {
            this.shaderStats.moduleMisses++;
        }

        const gpuDevice = this.device.getDevice();
        const module = gpuDevice.createShaderModule({
            label: label || `compute-shader-${hash.substring(0, 8)}`,
            code,
        });

        this.shaderModuleCache.set(hash, module);
        this.shaderSourceHashes.set(code, hash);

        return module;
    }

    /**
     * Load shader module from file with hot-reload support
     */
    loadShaderModuleFromFile(filePath: string, label?: string): GPUShaderModule | null {
        if (!this.shaderCacheHandle) {
            this.shaderCacheHandle = createShaderCache();
        }

        const needsReload = hasShaderChanged(this.shaderCacheHandle, filePath);
        const cacheKey = `file:${filePath}`;

        if (!needsReload && this.shaderModuleCache.has(cacheKey)) {
            if (this.config.trackStatistics) {
                this.shaderStats.moduleHits++;
            }
            return this.shaderModuleCache.get(cacheKey)!;
        }

        const source: ShaderSource | null = loadShader(this.shaderCacheHandle, filePath);
        if (!source) {
            return null;
        }

        if (this.config.trackStatistics) {
            if (needsReload && this.shaderModuleCache.has(cacheKey)) {
                this.shaderStats.fileReloads++;
            } else {
                this.shaderStats.moduleMisses++;
            }
        }

        const gpuDevice = this.device.getDevice();
        const module = gpuDevice.createShaderModule({
            label: label || `compute-shader-file-${filePath}`,
            code: source.code,
        });

        this.shaderModuleCache.set(cacheKey, module);

        return module;
    }

    /**
     * Check if a shader file has changed
     */
    hasShaderFileChanged(filePath: string): boolean {
        if (!this.shaderCacheHandle) {
            return false;
        }
        return hasShaderChanged(this.shaderCacheHandle, filePath);
    }

    /**
     * Hash shader code for caching
     */
    private hashShaderCode(code: string): string {
        let hash = 0;
        for (let i = 0; i < code.length; i++) {
            const char = code.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
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
     *
     * Uses cached shader modules for efficient reuse of identical shaders.
     */
    async createSimplePipeline(
        shader: string,
        entryPoint = "main",
        constants?: Record<string, number>,
    ): Promise<GPUComputePipeline> {
        // Use cached shader module for efficiency
        const module = this.getOrCreateShaderModule(shader, "Compute Shader");

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
     * Clear shader module cache
     */
    clearShaderModuleCache(): void {
        this.shaderModuleCache.clear();
        this.shaderSourceHashes.clear();
        if (this.shaderCacheHandle) {
            clearShaderCache(this.shaderCacheHandle);
        }
        this.shaderStats.moduleHits = 0;
        this.shaderStats.moduleMisses = 0;
        this.shaderStats.fileReloads = 0;
    }

    /**
     * Destroy the pipeline manager and release resources
     */
    destroy(): void {
        this.clear();
        this.clearShaderModuleCache();
        if (this.shaderCacheHandle) {
            destroyShaderCache(this.shaderCacheHandle);
            this.shaderCacheHandle = null;
        }
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

    /**
     * Get shader module cache statistics
     */
    getShaderModuleStats(): {
        moduleHits: number;
        moduleMisses: number;
        fileReloads: number;
        cachedModules: number;
    } {
        return {
            ...this.shaderStats,
            cachedModules: this.shaderModuleCache.size,
        };
    }

    /**
     * Get webgpu_x shader cache statistics (file-based)
     */
    getShaderCacheStats(): ShaderCacheStats | null {
        if (!this.shaderCacheHandle) {
            return null;
        }
        return getShaderCacheStats(this.shaderCacheHandle);
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

    /**
     * Clear all shader module caches
     */
    clearShaderModuleCaches(): void {
        this.renderPipelines.clearShaderModuleCache();
        this.computePipelines.clearShaderModuleCache();
    }

    /**
     * Destroy all pipeline managers and release resources
     */
    destroy(): void {
        this.renderPipelines.destroy();
        this.computePipelines.destroy();
    }

    /**
     * Get combined shader module statistics
     */
    getShaderModuleStats(): {
        render: ReturnType<RenderPipelineManager["getShaderModuleStats"]>;
        compute: ReturnType<ComputePipelineManager["getShaderModuleStats"]>;
    } {
        return {
            render: this.renderPipelines.getShaderModuleStats(),
            compute: this.computePipelines.getShaderModuleStats(),
        };
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
