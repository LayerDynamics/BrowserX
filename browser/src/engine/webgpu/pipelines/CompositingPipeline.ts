/**
 * Compositing Pipeline
 *
 * GPU pipeline for compositing layers with blend modes and transforms.
 * Handles:
 * - Multiple blend modes (normal, multiply, screen, overlay, etc.)
 * - Layer transforms (position, rotation, scale)
 * - Opacity blending
 * - Texture sampling
 * - Pipeline state caching
 *
 * @module pipelines
 */

import type { Pixels } from "../../../types/webgpu.ts";
import { WebGPUDevice } from "../adapter/Device.ts";
import { PipelineManager } from "./mod.ts";
import { WebGPUError } from "../errors.ts";

// ============================================================================
// Types
// ============================================================================

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
 * Compositing uniforms
 */
export interface CompositingUniforms {
    /** Transform matrix (4x4) */
    transformMatrix: Float32Array;
    /** Layer opacity (0.0 to 1.0) */
    opacity: number;
    /** Source texture size */
    sourceSize: [Pixels, Pixels];
    /** Destination texture size */
    destSize: [Pixels, Pixels];
}

/**
 * Compositing pipeline configuration
 */
export interface CompositingPipelineConfig {
    blendMode: BlendMode;
    format: GPUTextureFormat;
    sampleCount?: number;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Error related to compositing pipeline
 */
export class CompositingPipelineError extends WebGPUError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, {
            recoverable: false,
            code: "COMPOSITING_PIPELINE_ERROR",
            context,
        });
        this.name = "CompositingPipelineError";
    }
}

// ============================================================================
// Shaders
// ============================================================================

/**
 * Vertex shader for compositing
 */
const COMPOSITING_VERTEX_SHADER = `
struct VertexInput {
    @builtin(vertex_index) vertex_index: u32,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) tex_coords: vec2<f32>,
}

struct Uniforms {
    transform_matrix: mat4x4<f32>,
    opacity: f32,
    source_width: f32,
    source_height: f32,
    dest_width: f32,
    dest_height: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // Full-screen quad vertices
    var positions = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),  // Bottom-left
        vec2<f32>(1.0, -1.0),   // Bottom-right
        vec2<f32>(-1.0, 1.0),   // Top-left
        vec2<f32>(-1.0, 1.0),   // Top-left
        vec2<f32>(1.0, -1.0),   // Bottom-right
        vec2<f32>(1.0, 1.0)     // Top-right
    );

    var tex_coords = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 1.0),    // Bottom-left
        vec2<f32>(1.0, 1.0),    // Bottom-right
        vec2<f32>(0.0, 0.0),    // Top-left
        vec2<f32>(0.0, 0.0),    // Top-left
        vec2<f32>(1.0, 1.0),    // Bottom-right
        vec2<f32>(1.0, 0.0)     // Top-right
    );

    let pos = positions[input.vertex_index];
    let tex_coord = tex_coords[input.vertex_index];

    // Apply transform matrix
    let transformed = uniforms.transform_matrix * vec4<f32>(pos, 0.0, 1.0);

    output.position = transformed;
    output.tex_coords = tex_coord;

    return output;
}
`;

/**
 * Get fragment shader for blend mode
 */
function getFragmentShader(blendMode: BlendMode): string {
    const blendFunction = getBlendFunction(blendMode);

    return `
struct FragmentInput {
    @location(0) tex_coords: vec2<f32>,
}

struct Uniforms {
    transform_matrix: mat4x4<f32>,
    opacity: f32,
    source_width: f32,
    source_height: f32,
    dest_width: f32,
    dest_height: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var source_texture: texture_2d<f32>;
@group(0) @binding(2) var texture_sampler: sampler;

${blendFunction}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    // Sample source texture
    let source_color = textureSample(source_texture, texture_sampler, input.tex_coords);

    // Apply opacity
    var color = source_color;
    color.a *= uniforms.opacity;

    return color;
}
`;
}

/**
 * Get blend function for specific blend mode
 */
function getBlendFunction(blendMode: BlendMode): string {
    switch (blendMode) {
        case BlendMode.NORMAL:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    return source;
}
`;

        case BlendMode.MULTIPLY:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    return source * dest;
}
`;

        case BlendMode.SCREEN:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(1.0) - (vec3<f32>(1.0) - source) * (vec3<f32>(1.0) - dest);
}
`;

        case BlendMode.OVERLAY:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    var result: vec3<f32>;

    if (dest.r < 0.5) {
        result.r = 2.0 * source.r * dest.r;
    } else {
        result.r = 1.0 - 2.0 * (1.0 - source.r) * (1.0 - dest.r);
    }

    if (dest.g < 0.5) {
        result.g = 2.0 * source.g * dest.g;
    } else {
        result.g = 1.0 - 2.0 * (1.0 - source.g) * (1.0 - dest.g);
    }

    if (dest.b < 0.5) {
        result.b = 2.0 * source.b * dest.b;
    } else {
        result.b = 1.0 - 2.0 * (1.0 - source.b) * (1.0 - dest.b);
    }

    return result;
}
`;

        case BlendMode.DARKEN:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    return min(source, dest);
}
`;

        case BlendMode.LIGHTEN:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    return max(source, dest);
}
`;

        case BlendMode.COLOR_DODGE:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    var result: vec3<f32>;

    result.r = select(min(1.0, dest.r / (1.0 - source.r)), 1.0, source.r >= 1.0);
    result.g = select(min(1.0, dest.g / (1.0 - source.g)), 1.0, source.g >= 1.0);
    result.b = select(min(1.0, dest.b / (1.0 - source.b)), 1.0, source.b >= 1.0);

    return result;
}
`;

        case BlendMode.COLOR_BURN:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    var result: vec3<f32>;

    result.r = select(1.0 - min(1.0, (1.0 - dest.r) / source.r), 0.0, source.r <= 0.0);
    result.g = select(1.0 - min(1.0, (1.0 - dest.g) / source.g), 0.0, source.g <= 0.0);
    result.b = select(1.0 - min(1.0, (1.0 - dest.b) / source.b), 0.0, source.b <= 0.0);

    return result;
}
`;

        case BlendMode.HARD_LIGHT:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    var result: vec3<f32>;

    if (source.r < 0.5) {
        result.r = 2.0 * source.r * dest.r;
    } else {
        result.r = 1.0 - 2.0 * (1.0 - source.r) * (1.0 - dest.r);
    }

    if (source.g < 0.5) {
        result.g = 2.0 * source.g * dest.g;
    } else {
        result.g = 1.0 - 2.0 * (1.0 - source.g) * (1.0 - dest.g);
    }

    if (source.b < 0.5) {
        result.b = 2.0 * source.b * dest.b;
    } else {
        result.b = 1.0 - 2.0 * (1.0 - source.b) * (1.0 - dest.b);
    }

    return result;
}
`;

        case BlendMode.SOFT_LIGHT:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    var result: vec3<f32>;

    if (source.r < 0.5) {
        result.r = dest.r - (1.0 - 2.0 * source.r) * dest.r * (1.0 - dest.r);
    } else {
        let d = select(sqrt(dest.r), ((16.0 * dest.r - 12.0) * dest.r + 4.0) * dest.r, dest.r > 0.25);
        result.r = dest.r + (2.0 * source.r - 1.0) * (d - dest.r);
    }

    if (source.g < 0.5) {
        result.g = dest.g - (1.0 - 2.0 * source.g) * dest.g * (1.0 - dest.g);
    } else {
        let d = select(sqrt(dest.g), ((16.0 * dest.g - 12.0) * dest.g + 4.0) * dest.g, dest.g > 0.25);
        result.g = dest.g + (2.0 * source.g - 1.0) * (d - dest.g);
    }

    if (source.b < 0.5) {
        result.b = dest.b - (1.0 - 2.0 * source.b) * dest.b * (1.0 - dest.b);
    } else {
        let d = select(sqrt(dest.b), ((16.0 * dest.b - 12.0) * dest.b + 4.0) * dest.b, dest.b > 0.25);
        result.b = dest.b + (2.0 * source.b - 1.0) * (d - dest.b);
    }

    return result;
}
`;

        case BlendMode.DIFFERENCE:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    return abs(dest - source);
}
`;

        case BlendMode.EXCLUSION:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    return source + dest - 2.0 * source * dest;
}
`;

        case BlendMode.ADD:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    return min(vec3<f32>(1.0), source + dest);
}
`;

        case BlendMode.SUBTRACT:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    return max(vec3<f32>(0.0), dest - source);
}
`;

        default:
            return `
fn blend(source: vec3<f32>, dest: vec3<f32>) -> vec3<f32> {
    return source;
}
`;
    }
}

// ============================================================================
// Compositing Pipeline
// ============================================================================

/**
 * Manages compositing pipelines for layer blending
 */
export class CompositingPipeline {
    private readonly device: WebGPUDevice;
    private readonly pipelineManager: PipelineManager;

    // Pipeline cache by blend mode and format
    private readonly pipelineCache: Map<string, GPURenderPipeline> = new Map();

    // Bind group layouts
    private bindGroupLayout: GPUBindGroupLayout | null = null;

    // Samplers
    private linearSampler: GPUSampler | null = null;
    private nearestSampler: GPUSampler | null = null;

    constructor(device: WebGPUDevice, pipelineManager: PipelineManager) {
        this.device = device;
        this.pipelineManager = pipelineManager;

        this.initialize();
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Initialize compositing pipeline resources
     */
    private initialize(): void {
        this.createBindGroupLayout();
        this.createSamplers();
    }

    /**
     * Create bind group layout
     */
    private createBindGroupLayout(): void {
        const gpuDevice = this.device.getDevice();

        this.bindGroupLayout = gpuDevice.createBindGroupLayout({
            label: "compositing-bind-group-layout",
            entries: [
                {
                    // Uniforms
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform" as GPUBufferBindingType,
                    },
                },
                {
                    // Source texture
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float" as GPUTextureSampleType,
                    },
                },
                {
                    // Sampler
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {
                        type: "filtering" as GPUSamplerBindingType,
                    },
                },
            ],
        });
    }

    /**
     * Create texture samplers
     */
    private createSamplers(): void {
        const gpuDevice = this.device.getDevice();

        this.linearSampler = gpuDevice.createSampler({
            label: "compositing-linear-sampler",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear",
        });

        this.nearestSampler = gpuDevice.createSampler({
            label: "compositing-nearest-sampler",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            magFilter: "nearest",
            minFilter: "nearest",
        });
    }

    // ========================================================================
    // Pipeline Management
    // ========================================================================

    /**
     * Get or create pipeline for blend mode
     */
    getPipeline(config: CompositingPipelineConfig): GPURenderPipeline {
        const key = this.getPipelineKey(config);

        let pipeline = this.pipelineCache.get(key);
        if (pipeline) {
            return pipeline;
        }

        pipeline = this.createPipeline(config);
        this.pipelineCache.set(key, pipeline);

        return pipeline;
    }

    /**
     * Create pipeline key for caching
     */
    private getPipelineKey(config: CompositingPipelineConfig): string {
        return `${config.blendMode}_${config.format}_${config.sampleCount || 1}`;
    }

    /**
     * Create render pipeline
     */
    private createPipeline(config: CompositingPipelineConfig): GPURenderPipeline {
        const gpuDevice = this.device.getDevice();

        if (!this.bindGroupLayout) {
            throw new CompositingPipelineError("Bind group layout not initialized");
        }

        // Create shader modules
        const vertexModule = gpuDevice.createShaderModule({
            label: "compositing-vertex-shader",
            code: COMPOSITING_VERTEX_SHADER,
        });

        const fragmentModule = gpuDevice.createShaderModule({
            label: `compositing-fragment-shader-${config.blendMode}`,
            code: getFragmentShader(config.blendMode),
        });

        // Create pipeline layout
        const pipelineLayout = gpuDevice.createPipelineLayout({
            label: "compositing-pipeline-layout",
            bindGroupLayouts: [this.bindGroupLayout],
        });

        // Create render pipeline
        const pipeline = gpuDevice.createRenderPipeline({
            label: `compositing-pipeline-${config.blendMode}`,
            layout: pipelineLayout,
            vertex: {
                module: vertexModule,
                entryPoint: "main",
            },
            fragment: {
                module: fragmentModule,
                entryPoint: "main",
                targets: [
                    {
                        format: config.format,
                        blend: {
                            color: {
                                srcFactor: "src-alpha" as GPUBlendFactor,
                                dstFactor: "one-minus-src-alpha" as GPUBlendFactor,
                                operation: "add" as GPUBlendOperation,
                            },
                            alpha: {
                                srcFactor: "one" as GPUBlendFactor,
                                dstFactor: "one-minus-src-alpha" as GPUBlendFactor,
                                operation: "add" as GPUBlendOperation,
                            },
                        },
                    },
                ],
            },
            primitive: {
                topology: "triangle-list",
                cullMode: "none",
            },
            multisample: {
                count: config.sampleCount || 1,
            },
        });

        return pipeline;
    }

    // ========================================================================
    // Bind Groups
    // ========================================================================

    /**
     * Create bind group for compositing
     */
    createBindGroup(
        uniformBuffer: GPUBuffer,
        sourceTextureView: GPUTextureView,
        useLinearSampling: boolean = true
    ): GPUBindGroup {
        const gpuDevice = this.device.getDevice();

        if (!this.bindGroupLayout) {
            throw new CompositingPipelineError("Bind group layout not initialized");
        }

        const sampler = useLinearSampling ? this.linearSampler : this.nearestSampler;

        if (!sampler) {
            throw new CompositingPipelineError("Samplers not initialized");
        }

        return gpuDevice.createBindGroup({
            label: "compositing-bind-group",
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: uniformBuffer,
                    },
                },
                {
                    binding: 1,
                    resource: sourceTextureView,
                },
                {
                    binding: 2,
                    resource: sampler,
                },
            ],
        });
    }

    // ========================================================================
    // Uniforms
    // ========================================================================

    /**
     * Create uniform buffer
     */
    createUniformBuffer(): GPUBuffer {
        const gpuDevice = this.device.getDevice();

        // Uniforms layout:
        // - transform_matrix: mat4x4<f32> = 16 floats = 64 bytes
        // - opacity: f32 = 4 bytes
        // - source_width: f32 = 4 bytes
        // - source_height: f32 = 4 bytes
        // - dest_width: f32 = 4 bytes
        // - dest_height: f32 = 4 bytes
        // - padding: 12 bytes (for alignment)
        // Total: 96 bytes

        return gpuDevice.createBuffer({
            label: "compositing-uniform-buffer",
            size: 96,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    /**
     * Update uniform buffer
     */
    updateUniformBuffer(buffer: GPUBuffer, uniforms: CompositingUniforms): void {
        const gpuDevice = this.device.getDevice();

        // Create uniform data
        const data = new Float32Array(24); // 96 bytes / 4 bytes per float

        // Transform matrix (16 floats)
        data.set(uniforms.transformMatrix, 0);

        // Opacity (1 float at offset 16)
        data[16] = uniforms.opacity;

        // Source size (2 floats at offset 17-18)
        data[17] = uniforms.sourceSize[0];
        data[18] = uniforms.sourceSize[1];

        // Dest size (2 floats at offset 19-20)
        data[19] = uniforms.destSize[0];
        data[20] = uniforms.destSize[1];

        // Write to buffer
        gpuDevice.queue.writeBuffer(buffer, 0, data);
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Clear pipeline cache
     */
    clearCache(): void {
        this.pipelineCache.clear();
    }

    /**
     * Destroy compositing pipeline resources
     */
    destroy(): void {
        this.clearCache();
        this.bindGroupLayout = null;
        this.linearSampler = null;
        this.nearestSampler = null;
    }
}
