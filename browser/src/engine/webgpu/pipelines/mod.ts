/**
 * WebGPU Pipeline Management
 *
 * This module provides pipeline creation, caching, and management for both
 * render and compute pipelines. Includes descriptor hashing, compilation
 * tracking, and statistics.
 */

import type { Duration, GPUSize, PipelineID } from "../../../types/webgpu.ts";
import { WebGPUDevice } from "../adapter/Device.ts";
import { GPUPipelineError } from "../errors.ts";
import {
  clearShaderCache,
  createShaderCache,
  destroyShaderCache,
  getShaderCacheStats,
  hasShaderChanged,
  loadShader,
  type ShaderCacheStats,
  type ShaderSource,
} from "../utils/ShaderHelpers.ts";
import { WebGPUX } from "@browserx/webgpu_x";

// ============================================================================
// WebGPUX FFI singleton (lazy, fails gracefully)
// ============================================================================

let webgpuXInstance: WebGPUX | null = null;
let webgpuXInitAttempted = false;

function getWebGPUX(): WebGPUX | null {
  if (!webgpuXInitAttempted) {
    webgpuXInitAttempted = true;
    try {
      webgpuXInstance = new WebGPUX();
    } catch {
      webgpuXInstance = null;
    }
  }
  return webgpuXInstance;
}

// ============================================================================
// FFI Enum Mappings (match crates/webgpu_x/src/gpu/pipeline.rs)
// ============================================================================

const TEXTURE_FORMAT_CODES: Record<string, number> = {
  "r8unorm": 0,
  "rgba8unorm": 1,
  "rgba8unorm-srgb": 2,
  "bgra8unorm": 3,
  "bgra8unorm-srgb": 4,
  "depth24plus": 5,
  "depth24plus-stencil8": 6,
  "depth32float": 7,
  "rgba16float": 8,
  "rgba32float": 9,
};

const TOPOLOGY_CODES: Record<string, number> = {
  "point-list": 0,
  "line-list": 1,
  "line-strip": 2,
  "triangle-list": 3,
  "triangle-strip": 4,
};

const CULL_MODE_CODES: Record<string, number> = {
  "none": 0,
  "front": 1,
  "back": 2,
};

const BLEND_FACTOR_CODES: Record<string, number> = {
  "zero": 0,
  "one": 1,
  "src": 2,
  "one-minus-src": 3,
  "src-alpha": 4,
  "one-minus-src-alpha": 5,
  "dst": 6,
  "one-minus-dst": 7,
  "dst-alpha": 8,
  "one-minus-dst-alpha": 9,
};

const BLEND_OP_CODES: Record<string, number> = {
  "add": 0,
  "subtract": 1,
  "reverse-subtract": 2,
  "min": 3,
  "max": 4,
};

function blendStateToJson(targets: GPUColorTargetState[]): string {
  if (!targets.length || !targets[0].blend) return "";
  const blend = targets[0].blend;
  return JSON.stringify({
    color: {
      srcFactor: BLEND_FACTOR_CODES[blend.color.srcFactor ?? "one"] ?? 1,
      dstFactor: BLEND_FACTOR_CODES[blend.color.dstFactor ?? "zero"] ?? 0,
      operation: BLEND_OP_CODES[blend.color.operation ?? "add"] ?? 0,
    },
    alpha: {
      srcFactor: BLEND_FACTOR_CODES[blend.alpha.srcFactor ?? "one"] ?? 1,
      dstFactor: BLEND_FACTOR_CODES[blend.alpha.dstFactor ?? "zero"] ?? 0,
      operation: BLEND_OP_CODES[blend.alpha.operation ?? "add"] ?? 0,
    },
  });
}

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
 * Pipeline result that wraps either a native GPURenderPipeline/GPUComputePipeline
 * or an FFI pipeline handle (bigint). When FFI is available, the FFI path is used
 * exclusively for genuine async pipeline compilation on a background OS thread.
 * When FFI is unavailable, the native sync Deno path is used as fallback.
 */
export interface PipelineResult<T extends GPURenderPipeline | GPUComputePipeline> {
  /** True if this pipeline was compiled via webgpu_x FFI */
  readonly isFFI: boolean;
  /** Native pipeline (only set when isFFI is false) */
  readonly nativePipeline: T | null;
  /** FFI pipeline handle (only set when isFFI is true) */
  readonly ffiHandle: bigint | null;
  /** Pipeline ID for tracking */
  readonly id: PipelineID;
}

/**
 * Cached pipeline entry
 */
interface CachedPipeline<T extends GPURenderPipeline | GPUComputePipeline> {
  id: PipelineID;
  result: PipelineResult<T>;
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

  // FFI async pipeline compilation state
  private ffiAdapterHandle: bigint | null = null;
  private ffiDeviceHandle: bigint | null = null;
  private ffiShaderModules: Map<string, bigint> = new Map();
  private ffiInitAttempted = false;

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
   * Initialize FFI device for async pipeline compilation.
   * Returns true if FFI is available, false otherwise.
   */
  private initFfiDevice(): boolean {
    if (this.ffiInitAttempted) return this.ffiDeviceHandle !== null;
    this.ffiInitAttempted = true;

    const webgpuX = getWebGPUX();
    if (!webgpuX) return false;

    try {
      // Backend type 0 = primary/default
      this.ffiAdapterHandle = webgpuX.requestAdapter(0);
      if (!this.ffiAdapterHandle || this.ffiAdapterHandle === 0n) {
        this.ffiAdapterHandle = null;
        return false;
      }
      this.ffiDeviceHandle = webgpuX.requestDevice(this.ffiAdapterHandle);
      if (!this.ffiDeviceHandle || this.ffiDeviceHandle === 0n) {
        this.ffiDeviceHandle = null;
        return false;
      }
      return true;
    } catch {
      this.ffiAdapterHandle = null;
      this.ffiDeviceHandle = null;
      return false;
    }
  }

  /**
   * Get or create an FFI shader module from WGSL source.
   */
  private getOrCreateFfiShaderModule(code: string, label: string): bigint | null {
    const hash = this.hashShaderCode(code);
    const cached = this.ffiShaderModules.get(hash);
    if (cached) return cached;

    const webgpuX = getWebGPUX();
    if (!webgpuX || !this.ffiDeviceHandle) return null;

    const handle = webgpuX.createShaderModule(this.ffiDeviceHandle, label, code);
    if (!handle || handle === 0n) return null;

    this.ffiShaderModules.set(hash, handle);
    return handle;
  }

  /**
   * Get the FFI pipeline handle for a cached pipeline (for use with FFI render pass commands).
   * Returns null if no FFI handle exists for this hash.
   */
  getFfiPipelineHandle(hash: string): bigint | null {
    const cached = this.cache.get(hash);
    return cached?.result.ffiHandle ?? null;
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
   * Get or create a render pipeline.
   * Returns a PipelineResult wrapping either an FFI handle (preferred) or native pipeline.
   */
  async getPipeline(
    descriptor: RenderPipelineDescriptor,
  ): Promise<PipelineResult<GPURenderPipeline>> {
    const hash = this.hashDescriptor(descriptor);

    // Check cache
    const cached = this.cache.get(hash);
    if (cached) {
      cached.lastUsedAt = Date.now();
      cached.useCount++;
      if (this.config.trackStatistics) {
        this.stats.hits++;
      }
      return cached.result;
    }

    // Cache miss - create new pipeline
    if (this.config.trackStatistics) {
      this.stats.misses++;
    }

    return await this.createPipeline(descriptor, hash);
  }

  /**
   * Create a new render pipeline.
   *
   * FFI-first: When webgpu_x FFI is available, compiles the pipeline asynchronously
   * on a background OS thread via wgpu, bypassing Deno's broken createRenderPipelineAsync
   * WebIDL conversion (Deno #24317). The returned PipelineResult contains an FFI handle
   * that must be used with FFI render pass commands (gpu_render_pass_set_pipeline, etc.).
   *
   * When FFI is unavailable, falls back to Deno's sync createRenderPipeline.
   */
  private async createPipeline(
    descriptor: RenderPipelineDescriptor,
    hash: string,
  ): Promise<PipelineResult<GPURenderPipeline>> {
    const startTime = performance.now();
    const id = `render-pipeline-${this.nextId++}` as PipelineID;

    try {
      // FFI-first path: use webgpu_x async pipeline compilation on background thread
      if (this.config.enableAsync && this.initFfiDevice()) {
        const ffiResult = await this.createFfiRenderPipeline(descriptor, id);
        if (ffiResult) {
          const compilationTime = performance.now() - startTime;
          const result: PipelineResult<GPURenderPipeline> = {
            isFFI: true,
            nativePipeline: null,
            ffiHandle: ffiResult,
            id,
          };

          const cached: CachedPipeline<GPURenderPipeline> = {
            id,
            result,
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
          this.device.trackPipelineCreated();

          if (this.cache.size > this.config.maxCacheSize) {
            this.evictLRU();
          }

          return result;
        }
      }

      // Fallback: Deno native sync pipeline creation
      const gpuDevice = this.device.getDevice();

      // Build descriptor for native pipeline creation
      // WORKAROUND: Deno's WebGPU FFI has issues serializing arrays to WebIDL sequences.
      let targetsForFFI: Iterable<GPUColorTargetState | null> | undefined;
      if (descriptor.fragment && descriptor.fragment.targets.length > 0) {
        const len = descriptor.fragment.targets.length;
        const arr = new Array<GPUColorTargetState | null>(len);
        for (let i = 0; i < len; i++) {
          const src = descriptor.fragment.targets[i];
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
        targetsForFFI = Array.prototype.slice.call(arr, 0);
      }

      const vertexState: GPUVertexState = {
        module: descriptor.vertex.module,
        entryPoint: descriptor.vertex.entryPoint,
      };
      if (descriptor.vertex.buffers && descriptor.vertex.buffers.length > 0) {
        vertexState.buffers = Array.from(descriptor.vertex.buffers);
      }

      let fragmentState: GPUFragmentState | undefined;
      if (descriptor.fragment && targetsForFFI) {
        const fragObj: Record<string, unknown> = Object.create(null);
        fragObj["module"] = descriptor.fragment.module;
        fragObj["entryPoint"] = descriptor.fragment.entryPoint;
        fragObj["targets"] = targetsForFFI;
        fragmentState = fragObj as unknown as GPUFragmentState;
      }

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
      const nativePipeline: GPURenderPipeline = gpuDevice.createRenderPipeline(pipelineDescriptor);

      const compilationTime = performance.now() - startTime;

      const result: PipelineResult<GPURenderPipeline> = {
        isFFI: false,
        nativePipeline,
        ffiHandle: null,
        id,
      };

      const cached: CachedPipeline<GPURenderPipeline> = {
        id,
        result,
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
      this.device.trackPipelineCreated();

      if (this.cache.size > this.config.maxCacheSize) {
        this.evictLRU();
      }

      return result;
    } catch (error) {
      const compilationTime = performance.now() - startTime;
      throw new GPUPipelineError(
        `Failed to create render pipeline: ${
          error instanceof Error ? error.message : String(error)
        }`,
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
   * Create an FFI render pipeline asynchronously via webgpu_x on a background OS thread.
   * Returns the FFI pipeline handle (bigint) or null if compilation fails.
   */
  private async createFfiRenderPipeline(
    descriptor: RenderPipelineDescriptor,
    label: string,
  ): Promise<bigint | null> {
    const webgpuX = getWebGPUX();
    if (!webgpuX || !this.ffiDeviceHandle) return null;

    // Look up WGSL source for the vertex shader module
    const vertexCode = this.findShaderSource(descriptor.vertex.module);
    if (!vertexCode) return null;

    const vertexModuleHandle = this.getOrCreateFfiShaderModule(vertexCode, `${label}-vert`);
    if (!vertexModuleHandle) return null;

    let fragmentModuleHandle = 0n;
    let fragmentEntryPoint = "";
    let format = TEXTURE_FORMAT_CODES["rgba8unorm"] ?? 1;
    let blendJson = "";

    if (descriptor.fragment) {
      const fragmentCode = this.findShaderSource(descriptor.fragment.module);
      if (!fragmentCode) return null;

      const fragHandle = this.getOrCreateFfiShaderModule(fragmentCode, `${label}-frag`);
      if (!fragHandle) return null;
      fragmentModuleHandle = fragHandle;
      fragmentEntryPoint = descriptor.fragment.entryPoint;

      if (descriptor.fragment.targets.length > 0) {
        const targetFormat = descriptor.fragment.targets[0].format;
        format = TEXTURE_FORMAT_CODES[targetFormat] ?? 1;
        blendJson = blendStateToJson(descriptor.fragment.targets);
      }
    }

    const topology = TOPOLOGY_CODES[descriptor.primitive?.topology ?? "triangle-list"] ?? 3;
    const cullMode = CULL_MODE_CODES[descriptor.primitive?.cullMode ?? "none"] ?? 0;
    const layoutMode = 0n; // auto layout

    const ffiHandle = await webgpuX.createRenderPipelineAsync(
      this.ffiDeviceHandle,
      label,
      vertexModuleHandle,
      descriptor.vertex.entryPoint,
      fragmentModuleHandle,
      fragmentEntryPoint,
      format,
      blendJson,
      topology,
      cullMode,
      layoutMode,
    );

    if (!ffiHandle || ffiHandle === 0n) return null;
    return ffiHandle;
  }

  /**
   * Find the WGSL source code that was used to create a native GPUShaderModule.
   * Searches the shaderSourceHashes map (source → hash) and shaderModuleCache (hash → module).
   */
  private findShaderSource(module: GPUShaderModule): string | null {
    for (const [source, hash] of this.shaderSourceHashes) {
      const cachedModule = this.shaderModuleCache.get(hash);
      if (cachedModule === module) return source;
    }
    return null;
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
  ): Promise<PipelineResult<GPURenderPipeline>> {
    // Use cached shader modules for efficiency (also stores source→hash for FFI lookup)
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
    // Destroy FFI pipeline handles
    const webgpuX = getWebGPUX();
    if (webgpuX) {
      for (const cached of this.cache.values()) {
        if (cached.result.ffiHandle) {
          webgpuX.destroyRenderPipelineFfi(cached.result.ffiHandle);
        }
      }
      // Destroy FFI shader modules
      for (const handle of this.ffiShaderModules.values()) {
        webgpuX.destroyShaderModule(handle);
      }
    }
    this.ffiShaderModules.clear();
    this.ffiAdapterHandle = null;
    this.ffiDeviceHandle = null;

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

  // FFI async pipeline compilation state
  private ffiAdapterHandle: bigint | null = null;
  private ffiDeviceHandle: bigint | null = null;
  private ffiShaderModules: Map<string, bigint> = new Map();
  private ffiInitAttempted = false;

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
   * Initialize FFI device for async pipeline compilation.
   */
  private initFfiDevice(): boolean {
    if (this.ffiInitAttempted) return this.ffiDeviceHandle !== null;
    this.ffiInitAttempted = true;

    const webgpuX = getWebGPUX();
    if (!webgpuX) return false;

    try {
      this.ffiAdapterHandle = webgpuX.requestAdapter(0);
      if (!this.ffiAdapterHandle || this.ffiAdapterHandle === 0n) {
        this.ffiAdapterHandle = null;
        return false;
      }
      this.ffiDeviceHandle = webgpuX.requestDevice(this.ffiAdapterHandle);
      if (!this.ffiDeviceHandle || this.ffiDeviceHandle === 0n) {
        this.ffiDeviceHandle = null;
        return false;
      }
      return true;
    } catch {
      this.ffiAdapterHandle = null;
      this.ffiDeviceHandle = null;
      return false;
    }
  }

  /**
   * Get or create an FFI shader module from WGSL source.
   */
  private getOrCreateFfiShaderModule(code: string, label: string): bigint | null {
    const hash = this.hashShaderCode(code);
    const cached = this.ffiShaderModules.get(hash);
    if (cached) return cached;

    const webgpuX = getWebGPUX();
    if (!webgpuX || !this.ffiDeviceHandle) return null;

    const handle = webgpuX.createShaderModule(this.ffiDeviceHandle, label, code);
    if (!handle || handle === 0n) return null;

    this.ffiShaderModules.set(hash, handle);
    return handle;
  }

  /**
   * Get the FFI pipeline handle for a cached pipeline.
   */
  getFfiPipelineHandle(hash: string): bigint | null {
    const cached = this.cache.get(hash);
    return cached?.result.ffiHandle ?? null;
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
   * Find the WGSL source code that was used to create a native GPUShaderModule.
   */
  private findShaderSource(module: GPUShaderModule): string | null {
    for (const [source, hash] of this.shaderSourceHashes) {
      const cachedModule = this.shaderModuleCache.get(hash);
      if (cachedModule === module) return source;
    }
    return null;
  }

  /**
   * Get or create a compute pipeline.
   * Returns a PipelineResult wrapping either an FFI handle (preferred) or native pipeline.
   */
  async getPipeline(
    descriptor: ComputePipelineDescriptor,
  ): Promise<PipelineResult<GPUComputePipeline>> {
    const hash = this.hashDescriptor(descriptor);

    const cached = this.cache.get(hash);
    if (cached) {
      cached.lastUsedAt = Date.now();
      cached.useCount++;
      if (this.config.trackStatistics) {
        this.stats.hits++;
      }
      return cached.result;
    }

    if (this.config.trackStatistics) {
      this.stats.misses++;
    }

    return await this.createPipeline(descriptor, hash);
  }

  /**
   * Create a new compute pipeline.
   *
   * FFI-first: When webgpu_x FFI is available, compiles the pipeline asynchronously
   * on a background OS thread. When FFI is unavailable, falls back to sync native path.
   */
  private async createPipeline(
    descriptor: ComputePipelineDescriptor,
    hash: string,
  ): Promise<PipelineResult<GPUComputePipeline>> {
    const startTime = performance.now();
    const id = `compute-pipeline-${this.nextId++}` as PipelineID;

    try {
      // FFI-first path
      if (this.config.enableAsync && this.initFfiDevice()) {
        const ffiResult = await this.createFfiComputePipeline(descriptor, id);
        if (ffiResult) {
          const compilationTime = performance.now() - startTime;
          const result: PipelineResult<GPUComputePipeline> = {
            isFFI: true,
            nativePipeline: null,
            ffiHandle: ffiResult,
            id,
          };

          const cached: CachedPipeline<GPUComputePipeline> = {
            id,
            result,
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
          this.device.trackPipelineCreated();

          if (this.cache.size > this.config.maxCacheSize) {
            this.evictLRU();
          }

          return result;
        }
      }

      // Fallback: Deno native sync pipeline creation
      const gpuDevice = this.device.getDevice();

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

      const nativePipeline: GPUComputePipeline = gpuDevice.createComputePipeline(
        pipelineDescriptor,
      );
      const compilationTime = performance.now() - startTime;

      const result: PipelineResult<GPUComputePipeline> = {
        isFFI: false,
        nativePipeline,
        ffiHandle: null,
        id,
      };

      const cached: CachedPipeline<GPUComputePipeline> = {
        id,
        result,
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
      this.device.trackPipelineCreated();

      if (this.cache.size > this.config.maxCacheSize) {
        this.evictLRU();
      }

      return result;
    } catch (error) {
      const compilationTime = performance.now() - startTime;
      throw new GPUPipelineError(
        `Failed to create compute pipeline: ${
          error instanceof Error ? error.message : String(error)
        }`,
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
   * Create an FFI compute pipeline asynchronously via webgpu_x on a background OS thread.
   */
  private async createFfiComputePipeline(
    descriptor: ComputePipelineDescriptor,
    label: string,
  ): Promise<bigint | null> {
    const webgpuX = getWebGPUX();
    if (!webgpuX || !this.ffiDeviceHandle) return null;

    const shaderCode = this.findShaderSource(descriptor.compute.module);
    if (!shaderCode) return null;

    const shaderModuleHandle = this.getOrCreateFfiShaderModule(shaderCode, `${label}-compute`);
    if (!shaderModuleHandle) return null;

    const layoutMode = 0n; // auto layout

    const ffiHandle = await webgpuX.createComputePipelineAsync(
      this.ffiDeviceHandle,
      label,
      shaderModuleHandle,
      descriptor.compute.entryPoint,
      layoutMode,
    );

    if (!ffiHandle || ffiHandle === 0n) return null;
    return ffiHandle;
  }

  /**
   * Create a simple compute pipeline
   */
  async createSimplePipeline(
    shader: string,
    entryPoint = "main",
    constants?: Record<string, number>,
  ): Promise<PipelineResult<GPUComputePipeline>> {
    const module = this.getOrCreateShaderModule(shader, "Compute Shader");

    const computeStage: {
      module: GPUShaderModule;
      entryPoint: string;
      constants?: Record<string, number>;
    } = {
      module,
      entryPoint,
    };
    if (constants) {
      computeStage.constants = constants;
    }
    const descriptor: ComputePipelineDescriptor = {
      layout: "auto",
      compute: computeStage,
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
    // Destroy FFI pipeline handles
    const webgpuX = getWebGPUX();
    if (webgpuX) {
      for (const cached of this.cache.values()) {
        if (cached.result.ffiHandle) {
          webgpuX.destroyComputePipeline(cached.result.ffiHandle);
        }
      }
      for (const handle of this.ffiShaderModules.values()) {
        webgpuX.destroyShaderModule(handle);
      }
    }
    this.ffiShaderModules.clear();
    this.ffiAdapterHandle = null;
    this.ffiDeviceHandle = null;

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
  BlendMode as CompositingBlendMode,
  CompositingPipeline,
  type CompositingPipelineConfig,
  CompositingPipelineError,
  type CompositingUniforms,
} from "./CompositingPipeline.ts";
