/**
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
