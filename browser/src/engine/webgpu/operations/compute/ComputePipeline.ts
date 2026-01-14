/**
 * Compute Pipeline Manager
 *
 * Manages GPU compute pipelines for parallel processing:
 * - Pipeline creation and caching
 * - Workgroup size calculation
 * - Dispatch helpers
 * - Bind group management
 * - Statistics tracking
 *
 * @module operations/compute
 */

import type { GPUSize } from "../../../../types/webgpu.ts";
import { WebGPUDevice } from "../../adapter/Device.ts";
import { ComputePipelineManager } from "../../pipelines/mod.ts";
import { WebGPUError } from "../../errors.ts";
import {
    detectGPUVendor,
    getOptimalWorkgroupSize,
    type WebGPUXVendor,
    detectPlatform,
    Platform,
    getMetalCapabilities,
    getROCmCapabilities,
    getCUDACapabilities,
    MetalFamily,
    ROCmArchitecture,
} from "../../utils/DetectGPUType.ts";
import { getSystemInfo } from "../../utils/DetectSystem.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Workgroup dimensions
 */
export interface WorkgroupDimensions {
    x: number;
    y: number;
    z: number;
}

/**
 * Dispatch dimensions (number of workgroups)
 */
export interface DispatchDimensions {
    x: number;
    y: number;
    z: number;
}

/**
 * Compute configuration
 */
export interface ComputeConfig {
    /** Shader code */
    shader: string;
    /** Entry point function name */
    entryPoint?: string;
    /** Shader constants */
    constants?: Record<string, number>;
    /** Workgroup size (if not specified in shader) */
    workgroupSize?: WorkgroupDimensions;
    /** Custom label */
    label?: string;
}

/**
 * Buffer binding configuration
 */
export interface BufferBinding {
    binding: number;
    buffer: GPUBuffer;
    offset?: GPUSize;
    size?: GPUSize;
}

/**
 * Texture binding configuration
 */
export interface TextureBinding {
    binding: number;
    view: GPUTextureView;
}

/**
 * Sampler binding configuration
 */
export interface SamplerBinding {
    binding: number;
    sampler: GPUSampler;
}

/**
 * Bind group resources
 */
export interface BindGroupResources {
    buffers?: BufferBinding[];
    textures?: TextureBinding[];
    samplers?: SamplerBinding[];
}

/**
 * Compute pass configuration
 */
export interface ComputePassConfig {
    pipeline: GPUComputePipeline;
    bindGroups: GPUBindGroup[];
    dispatchWorkgroups: DispatchDimensions;
    label?: string;
}

/**
 * Compute statistics
 */
export interface ComputeStatistics {
    pipelinesCreated: number;
    activePipelines: number;
    totalDispatches: number;
    totalWorkgroups: number;
    averageDispatchTime: number;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Error related to compute operations
 */
export class ComputePipelineError extends WebGPUError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, {
            recoverable: false,
            code: "COMPUTE_PIPELINE_ERROR",
            context,
        });
        this.name = "ComputePipelineError";
    }
}

// ============================================================================
// Compute Pipeline Manager
// ============================================================================

/**
 * Manages compute pipelines and operations
 */
export class ComputePipeline {
    private readonly device: WebGPUDevice;
    private readonly pipelineManager: ComputePipelineManager;

    // Pipeline cache
    private readonly pipelines: Map<string, GPUComputePipeline> = new Map();
    private readonly pipelineConfigs: Map<string, ComputeConfig> = new Map();

    // Bind group layouts cache
    private readonly bindGroupLayouts: Map<string, GPUBindGroupLayout> = new Map();

    // Statistics
    private stats = {
        pipelinesCreated: 0,
        totalDispatches: 0,
        totalWorkgroups: 0,
        dispatchTimes: [] as number[],
    };

    // Device limits
    private maxWorkgroupSize: WorkgroupDimensions = { x: 256, y: 256, z: 64 };
    private maxWorkgroupsPerDimension = 65535;
    private maxComputeInvocationsPerWorkgroup = 256;

    // GPU vendor detection (for optimizations)
    private vendorId: number | null = null;
    private gpuVendor: WebGPUXVendor | null = null;
    private platform: Platform = Platform.Unknown;

    constructor(device: WebGPUDevice, pipelineManager: ComputePipelineManager) {
        this.device = device;
        this.pipelineManager = pipelineManager;
        this.initializeDeviceLimits();
        this.detectGPUVendor();
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Initialize device limits
     */
    private initializeDeviceLimits(): void {
        const limits = this.device.getDevice().limits;

        this.maxWorkgroupSize = {
            x: limits.maxComputeWorkgroupSizeX,
            y: limits.maxComputeWorkgroupSizeY,
            z: limits.maxComputeWorkgroupSizeZ,
        };

        this.maxWorkgroupsPerDimension = limits.maxComputeWorkgroupsPerDimension;
        this.maxComputeInvocationsPerWorkgroup = limits.maxComputeInvocationsPerWorkgroup;
    }

    /**
     * Detect GPU vendor for vendor-specific optimizations
     */
    private detectGPUVendor(): void {
        this.platform = detectPlatform();

        // Try to extract vendor ID from device (implementation-dependent)
        // For now, we'll infer from platform and available capabilities
        const systemInfo = getSystemInfo();

        // Platform-specific vendor detection
        if (this.platform === Platform.Darwin && systemInfo.isAppleSilicon) {
            // Apple Silicon
            this.vendorId = 0x106B; // Apple
            this.gpuVendor = detectGPUVendor(this.vendorId);
        } else if (this.platform === Platform.Linux) {
            // Linux: Try to detect from system info
            // In real implementation, would query drm/sysfs
            // For now, default to unknown and use generic optimizations
            this.vendorId = null;
            this.gpuVendor = null;
        } else if (this.platform === Platform.Windows) {
            // Windows: Try to detect from DirectX
            // In real implementation, would query DXGI
            this.vendorId = null;
            this.gpuVendor = null;
        }
    }

    // ========================================================================
    // Pipeline Management
    // ========================================================================

    /**
     * Create or get cached compute pipeline
     */
    async createPipeline(config: ComputeConfig): Promise<GPUComputePipeline> {
        const key = this.getPipelineKey(config);

        // Check cache
        let pipeline = this.pipelines.get(key);
        if (pipeline) {
            return pipeline;
        }

        // Create new pipeline
        pipeline = await this.pipelineManager.createSimplePipeline(
            config.shader,
            config.entryPoint || "main",
            config.constants
        );

        // Cache pipeline
        this.pipelines.set(key, pipeline);
        this.pipelineConfigs.set(key, config);
        this.stats.pipelinesCreated++;

        return pipeline;
    }

    /**
     * Get pipeline key for caching
     */
    private getPipelineKey(config: ComputeConfig): string {
        const parts = [
            config.label || "",
            config.entryPoint || "main",
            JSON.stringify(config.constants || {}),
            JSON.stringify(config.workgroupSize || {}),
        ];
        return parts.join("|");
    }

    /**
     * Get pipeline by config
     */
    getPipeline(config: ComputeConfig): GPUComputePipeline | null {
        const key = this.getPipelineKey(config);
        return this.pipelines.get(key) || null;
    }

    /**
     * Check if pipeline exists
     */
    hasPipeline(config: ComputeConfig): boolean {
        const key = this.getPipelineKey(config);
        return this.pipelines.has(key);
    }

    // ========================================================================
    // Workgroup Calculation
    // ========================================================================

    /**
     * Calculate optimal workgroup size for 1D data
     * Uses vendor-specific optimizations when vendor is detected
     */
    calculateWorkgroupSize1D(dataSize: number): WorkgroupDimensions {
        const maxSize = Math.min(
            this.maxWorkgroupSize.x,
            this.maxComputeInvocationsPerWorkgroup
        );

        // Use vendor-specific optimization if available
        if (this.vendorId !== null && this.gpuVendor !== null) {
            const optimal = getOptimalWorkgroupSize(
                dataSize,
                maxSize,
                this.vendorId
            );
            return { x: optimal, y: 1, z: 1 };
        }

        // Fallback: platform-specific defaults
        if (this.platform === Platform.Darwin) {
            // Apple Metal prefers 256 (SIMD group size 32)
            return { x: Math.min(256, maxSize), y: 1, z: 1 };
        } else if (this.platform === Platform.Linux) {
            // Linux/Vulkan: conservative 128
            return { x: Math.min(128, maxSize), y: 1, z: 1 };
        }

        // Generic fallback: Find largest power of 2
        let size = 1;
        while (size * 2 <= maxSize && (dataSize % (size * 2) === 0 || size * 2 <= maxSize)) {
            size *= 2;
        }

        return { x: size, y: 1, z: 1 };
    }

    /**
     * Calculate optimal workgroup size for 2D data
     * Uses vendor-specific and platform-specific optimizations
     */
    calculateWorkgroupSize2D(width: number, height: number): WorkgroupDimensions {
        const maxInvocations = this.maxComputeInvocationsPerWorkgroup;

        // Platform-specific candidate selection
        let candidates: Array<{ x: number; y: number }>;

        if (this.platform === Platform.Darwin) {
            // Apple Metal: prefer square sizes for SIMD efficiency
            candidates = [
                { x: 16, y: 16 }, // 256 invocations - optimal for Metal
                { x: 8, y: 8 },   // 64 invocations
                { x: 32, y: 8 },  // 256 invocations - for wider images
            ];
        } else if (this.gpuVendor !== null) {
            // Vendor-specific optimizations
            switch (this.gpuVendor) {
                case 0: // NVIDIA
                    candidates = [
                        { x: 32, y: 8 },  // Warp size 32 aligned
                        { x: 16, y: 16 }, // Square for textures
                        { x: 8, y: 32 },  // For tall images
                    ];
                    break;
                case 1: // AMD
                    candidates = [
                        { x: 16, y: 16 }, // Wavefront 64 friendly
                        { x: 8, y: 8 },
                        { x: 32, y: 8 },
                    ];
                    break;
                default:
                    candidates = [
                        { x: 16, y: 16 },
                        { x: 8, y: 8 },
                        { x: 8, y: 16 },
                    ];
            }
        } else {
            // Generic candidates
            candidates = [
                { x: 16, y: 16 }, // 256 invocations
                { x: 8, y: 8 },   // 64 invocations
                { x: 8, y: 16 },  // 128 invocations
                { x: 16, y: 8 },  // 128 invocations
                { x: 32, y: 8 },  // 256 invocations
                { x: 8, y: 32 },  // 256 invocations
            ];
        }

        for (const candidate of candidates) {
            const invocations = candidate.x * candidate.y;
            if (
                invocations <= maxInvocations &&
                candidate.x <= this.maxWorkgroupSize.x &&
                candidate.y <= this.maxWorkgroupSize.y
            ) {
                return { x: candidate.x, y: candidate.y, z: 1 };
            }
        }

        // Fallback to 8x8
        return { x: 8, y: 8, z: 1 };
    }

    /**
     * Calculate optimal workgroup size for 3D data
     */
    calculateWorkgroupSize3D(width: number, height: number, depth: number): WorkgroupDimensions {
        const maxInvocations = this.maxComputeInvocationsPerWorkgroup;

        // Try common 3D workgroup sizes
        const candidates = [
            { x: 8, y: 8, z: 4 },   // 256 invocations
            { x: 4, y: 4, z: 4 },   // 64 invocations
            { x: 8, y: 4, z: 4 },   // 128 invocations
            { x: 4, y: 8, z: 4 },   // 128 invocations
            { x: 4, y: 4, z: 8 },   // 128 invocations
        ];

        for (const candidate of candidates) {
            const invocations = candidate.x * candidate.y * candidate.z;
            if (
                invocations <= maxInvocations &&
                candidate.x <= this.maxWorkgroupSize.x &&
                candidate.y <= this.maxWorkgroupSize.y &&
                candidate.z <= this.maxWorkgroupSize.z
            ) {
                return candidate;
            }
        }

        // Fallback to 4x4x4
        return { x: 4, y: 4, z: 4 };
    }

    /**
     * Calculate dispatch dimensions for 1D data
     */
    calculateDispatch1D(dataSize: number, workgroupSize: WorkgroupDimensions): DispatchDimensions {
        const workgroupCount = Math.ceil(dataSize / workgroupSize.x);

        if (workgroupCount > this.maxWorkgroupsPerDimension) {
            throw new ComputePipelineError(
                `Dispatch size ${workgroupCount} exceeds maximum ${this.maxWorkgroupsPerDimension}`
            );
        }

        return { x: workgroupCount, y: 1, z: 1 };
    }

    /**
     * Calculate dispatch dimensions for 2D data
     */
    calculateDispatch2D(
        width: number,
        height: number,
        workgroupSize: WorkgroupDimensions
    ): DispatchDimensions {
        const workgroupCountX = Math.ceil(width / workgroupSize.x);
        const workgroupCountY = Math.ceil(height / workgroupSize.y);

        if (
            workgroupCountX > this.maxWorkgroupsPerDimension ||
            workgroupCountY > this.maxWorkgroupsPerDimension
        ) {
            throw new ComputePipelineError(
                `Dispatch size (${workgroupCountX}, ${workgroupCountY}) exceeds maximum ${this.maxWorkgroupsPerDimension}`
            );
        }

        return { x: workgroupCountX, y: workgroupCountY, z: 1 };
    }

    /**
     * Calculate dispatch dimensions for 3D data
     */
    calculateDispatch3D(
        width: number,
        height: number,
        depth: number,
        workgroupSize: WorkgroupDimensions
    ): DispatchDimensions {
        const workgroupCountX = Math.ceil(width / workgroupSize.x);
        const workgroupCountY = Math.ceil(height / workgroupSize.y);
        const workgroupCountZ = Math.ceil(depth / workgroupSize.z);

        if (
            workgroupCountX > this.maxWorkgroupsPerDimension ||
            workgroupCountY > this.maxWorkgroupsPerDimension ||
            workgroupCountZ > this.maxWorkgroupsPerDimension
        ) {
            throw new ComputePipelineError(
                `Dispatch size (${workgroupCountX}, ${workgroupCountY}, ${workgroupCountZ}) exceeds maximum ${this.maxWorkgroupsPerDimension}`
            );
        }

        return { x: workgroupCountX, y: workgroupCountY, z: workgroupCountZ };
    }

    // ========================================================================
    // Bind Group Management
    // ========================================================================

    /**
     * Create bind group layout
     */
    createBindGroupLayout(entries: GPUBindGroupLayoutEntry[]): GPUBindGroupLayout {
        const gpuDevice = this.device.getDevice();

        // Create cache key
        const key = JSON.stringify(entries);

        // Check cache
        let layout = this.bindGroupLayouts.get(key);
        if (layout) {
            return layout;
        }

        // Create new layout
        layout = gpuDevice.createBindGroupLayout({
            label: "compute-bind-group-layout",
            entries,
        });

        this.bindGroupLayouts.set(key, layout);
        return layout;
    }

    /**
     * Create bind group from resources
     */
    createBindGroup(
        layout: GPUBindGroupLayout,
        resources: BindGroupResources
    ): GPUBindGroup {
        const gpuDevice = this.device.getDevice();

        const entries: GPUBindGroupEntry[] = [];

        // Add buffer bindings
        if (resources.buffers) {
            for (const buffer of resources.buffers) {
                entries.push({
                    binding: buffer.binding,
                    resource: {
                        buffer: buffer.buffer,
                        offset: buffer.offset,
                        size: buffer.size,
                    },
                });
            }
        }

        // Add texture bindings
        if (resources.textures) {
            for (const texture of resources.textures) {
                entries.push({
                    binding: texture.binding,
                    resource: texture.view,
                });
            }
        }

        // Add sampler bindings
        if (resources.samplers) {
            for (const sampler of resources.samplers) {
                entries.push({
                    binding: sampler.binding,
                    resource: sampler.sampler,
                });
            }
        }

        return gpuDevice.createBindGroup({
            label: "compute-bind-group",
            layout,
            entries,
        });
    }

    /**
     * Create simple bind group for buffers only
     */
    createBufferBindGroup(buffers: BufferBinding[]): GPUBindGroup {
        // Create layout entries
        const layoutEntries: GPUBindGroupLayoutEntry[] = buffers.map((buffer) => ({
            binding: buffer.binding,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
                type: "storage" as GPUBufferBindingType,
            },
        }));

        // Create layout
        const layout = this.createBindGroupLayout(layoutEntries);

        // Create bind group
        return this.createBindGroup(layout, { buffers });
    }

    // ========================================================================
    // Dispatch Helpers
    // ========================================================================

    /**
     * Execute compute pass
     */
    async executeComputePass(
        commandEncoder: GPUCommandEncoder,
        config: ComputePassConfig
    ): Promise<void> {
        const startTime = performance.now();

        const computePass = commandEncoder.beginComputePass({
            label: config.label || "compute-pass",
        });

        computePass.setPipeline(config.pipeline);

        // Set bind groups
        for (let i = 0; i < config.bindGroups.length; i++) {
            computePass.setBindGroup(i, config.bindGroups[i]);
        }

        // Dispatch workgroups
        computePass.dispatchWorkgroups(
            config.dispatchWorkgroups.x,
            config.dispatchWorkgroups.y,
            config.dispatchWorkgroups.z
        );

        computePass.end();

        // Update statistics
        const dispatchTime = performance.now() - startTime;
        this.stats.totalDispatches++;
        this.stats.totalWorkgroups +=
            config.dispatchWorkgroups.x *
            config.dispatchWorkgroups.y *
            config.dispatchWorkgroups.z;
        this.stats.dispatchTimes.push(dispatchTime);

        // Keep only last 100 timings
        if (this.stats.dispatchTimes.length > 100) {
            this.stats.dispatchTimes.shift();
        }
    }

    /**
     * Create and execute simple compute pass
     */
    async runCompute(
        commandEncoder: GPUCommandEncoder,
        config: ComputeConfig,
        bindGroups: GPUBindGroup[],
        dataSize: number | { width: number; height: number } | { width: number; height: number; depth: number }
    ): Promise<void> {
        // Get or create pipeline
        const pipeline = await this.createPipeline(config);

        // Calculate workgroup and dispatch sizes
        let workgroupSize: WorkgroupDimensions;
        let dispatch: DispatchDimensions;

        if (typeof dataSize === "number") {
            // 1D
            workgroupSize = config.workgroupSize || this.calculateWorkgroupSize1D(dataSize);
            dispatch = this.calculateDispatch1D(dataSize, workgroupSize);
        } else if ("depth" in dataSize) {
            // 3D
            workgroupSize = config.workgroupSize ||
                this.calculateWorkgroupSize3D(
                    dataSize.width,
                    dataSize.height,
                    dataSize.depth
                );
            dispatch = this.calculateDispatch3D(
                dataSize.width,
                dataSize.height,
                dataSize.depth,
                workgroupSize
            );
        } else {
            // 2D
            workgroupSize = config.workgroupSize ||
                this.calculateWorkgroupSize2D(dataSize.width, dataSize.height);
            dispatch = this.calculateDispatch2D(
                dataSize.width,
                dataSize.height,
                workgroupSize
            );
        }

        // Execute compute pass
        await this.executeComputePass(commandEncoder, {
            pipeline,
            bindGroups,
            dispatchWorkgroups: dispatch,
            label: config.label,
        });
    }

    // ========================================================================
    // Device Limits
    // ========================================================================

    /**
     * Get maximum workgroup size
     */
    getMaxWorkgroupSize(): WorkgroupDimensions {
        return { ...this.maxWorkgroupSize };
    }

    /**
     * Get maximum workgroups per dimension
     */
    getMaxWorkgroupsPerDimension(): number {
        return this.maxWorkgroupsPerDimension;
    }

    /**
     * Get maximum compute invocations per workgroup
     */
    getMaxComputeInvocationsPerWorkgroup(): number {
        return this.maxComputeInvocationsPerWorkgroup;
    }

    // ========================================================================
    // Statistics
    // ========================================================================

    /**
     * Get compute statistics
     */
    getStatistics(): ComputeStatistics {
        const avgDispatchTime =
            this.stats.dispatchTimes.length > 0
                ? this.stats.dispatchTimes.reduce((a, b) => a + b, 0) /
                    this.stats.dispatchTimes.length
                : 0;

        return {
            pipelinesCreated: this.stats.pipelinesCreated,
            activePipelines: this.pipelines.size,
            totalDispatches: this.stats.totalDispatches,
            totalWorkgroups: this.stats.totalWorkgroups,
            averageDispatchTime: avgDispatchTime,
        };
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Clear pipeline cache
     */
    clearCache(): void {
        this.pipelines.clear();
        this.pipelineConfigs.clear();
        this.bindGroupLayouts.clear();
    }

    /**
     * Destroy compute pipeline manager
     */
    destroy(): void {
        this.clearCache();
        this.stats = {
            pipelinesCreated: 0,
            totalDispatches: 0,
            totalWorkgroups: 0,
            dispatchTimes: [],
        };
    }
}
