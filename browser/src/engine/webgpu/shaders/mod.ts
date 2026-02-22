/**
 * WebGPU Shaders Module
 *
 * Exports WGSL shader sources as strings for WebGPU pipeline creation.
 * Shaders are embedded as strings to avoid file I/O at runtime.
 *
 * @module webgpu/shaders
 */

// ============================================================================
// Compositor Shader
// ============================================================================

/**
 * Compositor WGSL shader source for layer compositing.
 *
 * Features:
 * - 4x4 matrix transformation for 2D positions
 * - Opacity blending with premultiplied alpha
 * - Multiple blend mode entry points
 *
 * Vertex shader entry point: vs_main
 * Fragment shader entry points:
 * - fs_main: Standard premultiplied alpha
 * - fs_main_straight_alpha: Non-premultiplied source textures
 * - fs_main_additive: Additive blending for effects
 * - fs_main_multiply: Multiply blending for shadows
 *
 * Bindings:
 * - @group(0) @binding(0): Uniforms { transform: mat4x4, opacity: f32, _padding: vec3 }
 * - @group(0) @binding(1): layer_texture: texture_2d<f32>
 * - @group(0) @binding(2): layer_sampler: sampler
 *
 * Vertex attributes:
 * - @location(0): position: vec2<f32>
 * - @location(1): texcoord: vec2<f32>
 */
export const COMPOSITOR_SHADER = `/**
 * Compositor WGSL Shader
 *
 * GPU shader for layer compositing with:
 * - 4x4 matrix transformation
 * - Opacity blending
 * - Premultiplied alpha support
 * - Texture sampling
 *
 * This shader is ported from the WebGL compositor shaders in
 * browser/src/engine/rendering/compositor/CompositorThread.ts
 *
 * @module webgpu/shaders
 */

// ============================================================================
// Uniforms
// ============================================================================

/**
 * Uniform buffer structure for layer transformation and opacity.
 * Must be 16-byte aligned for WebGPU requirements.
 */
struct Uniforms {
    // 4x4 transformation matrix (64 bytes)
    transform: mat4x4<f32>,
    // Layer opacity value 0.0 to 1.0 (4 bytes)
    opacity: f32,
    // Padding to align to 16 bytes (12 bytes)
    _padding: vec3<f32>,
}

// ============================================================================
// Vertex Shader Types
// ============================================================================

/**
 * Vertex input from vertex buffer.
 * Expects interleaved position (vec2) and texcoord (vec2) data.
 */
struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) texcoord: vec2<f32>,
}

/**
 * Vertex output passed to fragment shader.
 */
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texcoord: vec2<f32>,
}

// ============================================================================
// Bindings
// ============================================================================

// Group 0: Uniforms and texture resources
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var layer_texture: texture_2d<f32>;
@group(0) @binding(2) var layer_sampler: sampler;

// ============================================================================
// Vertex Shader
// ============================================================================

/**
 * Vertex shader entry point.
 * Transforms 2D positions using the 4x4 transform matrix and passes
 * texture coordinates to the fragment shader.
 */
@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // Transform 2D position to clip space using 4x4 matrix
    // Position is (x, y) with z=0, w=1 for 2D rendering
    output.position = uniforms.transform * vec4<f32>(input.position, 0.0, 1.0);

    // Pass through texture coordinates unchanged
    output.texcoord = input.texcoord;

    return output;
}

// ============================================================================
// Fragment Shader
// ============================================================================

/**
 * Fragment shader entry point.
 * Samples the layer texture and applies opacity with premultiplied alpha.
 *
 * Premultiplied alpha means the RGB values are already multiplied by alpha,
 * so we multiply both RGB and A by the opacity uniform. This preserves
 * correct blending behavior when compositing multiple layers.
 */
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Sample the layer texture
    let color = textureSample(layer_texture, layer_sampler, input.texcoord);

    // Apply opacity with premultiplied alpha blending
    // For premultiplied alpha: output = (R * opacity, G * opacity, B * opacity, A * opacity)
    // This allows correct blending with the standard blend equation:
    //   srcFactor: one, dstFactor: one-minus-src-alpha
    return vec4<f32>(
        color.rgb * uniforms.opacity,
        color.a * uniforms.opacity
    );
}

// ============================================================================
// Alternative Entry Points for Different Blend Modes
// ============================================================================

/**
 * Fragment shader for non-premultiplied alpha sources.
 * Use when the source texture has straight (non-premultiplied) alpha.
 */
@fragment
fn fs_main_straight_alpha(input: VertexOutput) -> @location(0) vec4<f32> {
    let color = textureSample(layer_texture, layer_sampler, input.texcoord);

    // For straight alpha: premultiply RGB by alpha, then apply opacity
    let alpha = color.a * uniforms.opacity;
    return vec4<f32>(
        color.rgb * alpha,
        alpha
    );
}

/**
 * Fragment shader for additive blending.
 * Use for effects like glows, lights, particles.
 */
@fragment
fn fs_main_additive(input: VertexOutput) -> @location(0) vec4<f32> {
    let color = textureSample(layer_texture, layer_sampler, input.texcoord);

    // For additive blending: RGB is added to destination, alpha controls intensity
    return vec4<f32>(
        color.rgb * uniforms.opacity,
        0.0  // Zero alpha for pure additive
    );
}

/**
 * Fragment shader for multiply blending.
 * Use for shadows, darkening effects.
 */
@fragment
fn fs_main_multiply(input: VertexOutput) -> @location(0) vec4<f32> {
    let color = textureSample(layer_texture, layer_sampler, input.texcoord);

    // For multiply: lerp towards white based on inverse opacity
    // At opacity=1.0, full multiply effect
    // At opacity=0.0, no effect (white, which is identity for multiply)
    let multiplied = mix(vec3<f32>(1.0), color.rgb, uniforms.opacity);
    return vec4<f32>(multiplied, color.a);
}
`;

// ============================================================================
// Shader Entry Points
// ============================================================================

/**
 * Compositor shader entry points for different blend modes.
 */
export const CompositorEntryPoints = {
  /** Standard vertex shader entry point */
  vertex: "vs_main",

  /** Fragment shader for premultiplied alpha (default) */
  fragmentPremultiplied: "fs_main",

  /** Fragment shader for straight (non-premultiplied) alpha */
  fragmentStraightAlpha: "fs_main_straight_alpha",

  /** Fragment shader for additive blending */
  fragmentAdditive: "fs_main_additive",

  /** Fragment shader for multiply blending */
  fragmentMultiply: "fs_main_multiply",
} as const;

/**
 * Type for compositor fragment entry points
 */
export type CompositorFragmentEntryPoint =
  | typeof CompositorEntryPoints.fragmentPremultiplied
  | typeof CompositorEntryPoints.fragmentStraightAlpha
  | typeof CompositorEntryPoints.fragmentAdditive
  | typeof CompositorEntryPoints.fragmentMultiply;

// ============================================================================
// Uniform Buffer Layout
// ============================================================================

/**
 * Compositor uniform buffer byte offsets.
 * Use for writing individual uniform values to the buffer.
 */
export const CompositorUniformOffsets = {
  /** Offset of transform matrix (mat4x4<f32>) */
  transform: 0,
  /** Offset of opacity value (f32) */
  opacity: 64,
  /** Offset of padding (vec3<f32>) - internal use only */
  _padding: 68,
  /** Total size of uniform buffer in bytes */
  totalSize: 80,
} as const;

/**
 * Compositor vertex buffer layout.
 * Describes the interleaved vertex data format.
 */
export const CompositorVertexLayout = {
  /** Stride between vertices in bytes (position: vec2 + texcoord: vec2) */
  stride: 16,
  /** Position attribute offset in bytes */
  positionOffset: 0,
  /** Texcoord attribute offset in bytes */
  texcoordOffset: 8,
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a shader module from compositor shader source.
 *
 * @param device - WebGPU device
 * @param label - Optional label for debugging
 * @returns GPUShaderModule
 */
export function createCompositorShaderModule(
  device: GPUDevice,
  label = "compositor-shader",
): GPUShaderModule {
  return device.createShaderModule({
    label,
    code: COMPOSITOR_SHADER,
  });
}

/**
 * Create compositor uniform buffer.
 *
 * @param device - WebGPU device
 * @param label - Optional label for debugging
 * @returns GPUBuffer configured for compositor uniforms
 */
export function createCompositorUniformBuffer(
  device: GPUDevice,
  label = "compositor-uniforms",
): GPUBuffer {
  return device.createBuffer({
    label,
    size: CompositorUniformOffsets.totalSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

/**
 * Write compositor uniforms to buffer.
 *
 * @param device - WebGPU device
 * @param buffer - Uniform buffer to write to
 * @param transform - 4x4 transformation matrix (16 floats)
 * @param opacity - Layer opacity (0.0 to 1.0)
 */
export function writeCompositorUniforms(
  device: GPUDevice,
  buffer: GPUBuffer,
  transform: Float32Array,
  opacity: number,
): void {
  // Create uniform data array
  // Layout: mat4x4 (16 floats) + opacity (1 float) + padding (3 floats) = 20 floats
  const data = new Float32Array(20);

  // Write transform matrix (floats 0-15)
  data.set(transform, 0);

  // Write opacity (float 16)
  data[16] = opacity;

  // Padding is zero-initialized (floats 17-19)

  // Write to GPU buffer
  // Cast to BufferSource for TypeScript compatibility with Deno's stricter types
  device.queue.writeBuffer(buffer, 0, data as unknown as BufferSource);
}

/**
 * Create identity transform matrix.
 *
 * @returns Float32Array containing 4x4 identity matrix
 */
export function createIdentityTransform(): Float32Array {
  return new Float32Array([
    1,
    0,
    0,
    0, // Column 0
    0,
    1,
    0,
    0, // Column 1
    0,
    0,
    1,
    0, // Column 2
    0,
    0,
    0,
    1, // Column 3
  ]);
}

/**
 * Create 2D translation matrix.
 *
 * @param x - X translation in clip space (-1 to 1)
 * @param y - Y translation in clip space (-1 to 1)
 * @returns Float32Array containing 4x4 translation matrix
 */
export function createTranslationTransform(x: number, y: number): Float32Array {
  return new Float32Array([
    1,
    0,
    0,
    0, // Column 0
    0,
    1,
    0,
    0, // Column 1
    0,
    0,
    1,
    0, // Column 2
    x,
    y,
    0,
    1, // Column 3
  ]);
}

/**
 * Create 2D scale matrix.
 *
 * @param scaleX - X scale factor
 * @param scaleY - Y scale factor
 * @returns Float32Array containing 4x4 scale matrix
 */
export function createScaleTransform(scaleX: number, scaleY: number): Float32Array {
  return new Float32Array([
    scaleX,
    0,
    0,
    0, // Column 0
    0,
    scaleY,
    0,
    0, // Column 1
    0,
    0,
    1,
    0, // Column 2
    0,
    0,
    0,
    1, // Column 3
  ]);
}

/**
 * Create compositor bind group layout.
 *
 * @param device - WebGPU device
 * @param label - Optional label for debugging
 * @returns GPUBindGroupLayout for compositor pipeline
 */
export function createCompositorBindGroupLayout(
  device: GPUDevice,
  label = "compositor-bind-group-layout",
): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label,
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
        // Layer texture
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
 * Create compositor bind group.
 *
 * @param device - WebGPU device
 * @param layout - Bind group layout
 * @param uniformBuffer - Uniform buffer
 * @param textureView - Layer texture view
 * @param sampler - Texture sampler
 * @param label - Optional label for debugging
 * @returns GPUBindGroup for compositor rendering
 */
export function createCompositorBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  uniformBuffer: GPUBuffer,
  textureView: GPUTextureView,
  sampler: GPUSampler,
  label = "compositor-bind-group",
): GPUBindGroup {
  return device.createBindGroup({
    label,
    layout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
      {
        binding: 1,
        resource: textureView,
      },
      {
        binding: 2,
        resource: sampler,
      },
    ],
  });
}

// ============================================================================
// Quad Vertex Data
// ============================================================================

/**
 * Create full-screen quad vertex data.
 * Returns interleaved position (vec2) and texcoord (vec2) data.
 *
 * @returns Float32Array with 6 vertices (2 triangles)
 */
export function createFullScreenQuadVertices(): Float32Array {
  // Two triangles forming a full-screen quad
  // Each vertex: position.x, position.y, texcoord.u, texcoord.v
  return new Float32Array([
    // Triangle 1
    -1.0,
    -1.0,
    0.0,
    1.0, // Bottom-left
    1.0,
    -1.0,
    1.0,
    1.0, // Bottom-right
    -1.0,
    1.0,
    0.0,
    0.0, // Top-left

    // Triangle 2
    -1.0,
    1.0,
    0.0,
    0.0, // Top-left
    1.0,
    -1.0,
    1.0,
    1.0, // Bottom-right
    1.0,
    1.0,
    1.0,
    0.0, // Top-right
  ]);
}

/**
 * Create vertex buffer for full-screen quad.
 *
 * @param device - WebGPU device
 * @param label - Optional label for debugging
 * @returns GPUBuffer containing quad vertex data
 */
export function createFullScreenQuadBuffer(
  device: GPUDevice,
  label = "compositor-quad-vertices",
): GPUBuffer {
  const vertices = createFullScreenQuadVertices();

  const buffer = device.createBuffer({
    label,
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // Cast to BufferSource for TypeScript compatibility with Deno's stricter types
  device.queue.writeBuffer(buffer, 0, vertices as unknown as BufferSource);

  return buffer;
}
