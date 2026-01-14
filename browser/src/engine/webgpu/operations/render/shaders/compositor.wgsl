/**
 * Compositor Shader
 *
 * Used for compositing browser layers with support for:
 * - Multiple blend modes (alpha, additive, multiply, screen)
 * - 2D transformations (translate, scale, rotate)
 * - Opacity control
 * - Clipping regions
 */

// ============================================================================
// Structures
// ============================================================================

struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) texCoord: vec2<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texCoord: vec2<f32>,
}

struct TransformUniforms {
    // 3x3 transformation matrix (column-major)
    // [0-2]: column 0, [3-5]: column 1, [6-8]: column 2
    transform: mat3x3<f32>,
    // Opacity (0.0 - 1.0)
    opacity: f32,
    // Blend mode: 0=alpha, 1=additive, 2=multiply, 3=screen
    blendMode: u32,
    // Padding for alignment
    _padding: vec2<u32>,
}

struct ClipRegion {
    // Clipping rectangle in normalized device coordinates
    minX: f32,
    minY: f32,
    maxX: f32,
    maxY: f32,
}

// ============================================================================
// Bindings
// ============================================================================

// Bind Group 0: Transform and layer properties
@group(0) @binding(0)
var<uniform> uniforms: TransformUniforms;

@group(0) @binding(1)
var<uniform> clipRegion: ClipRegion;

// Bind Group 1: Layer texture
@group(1) @binding(0)
var layerTexture: texture_2d<f32>;

@group(1) @binding(1)
var layerSampler: sampler;

// ============================================================================
// Vertex Shader
// ============================================================================

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    // Apply 2D transformation
    let pos3 = vec3<f32>(in.position, 1.0);
    let transformed = uniforms.transform * pos3;

    // Convert to clip space coordinates
    out.position = vec4<f32>(transformed.xy, 0.0, 1.0);
    out.texCoord = in.texCoord;

    return out;
}

// ============================================================================
// Fragment Shader - Blend Modes
// ============================================================================

// Alpha blending (standard transparency)
fn blendAlpha(src: vec4<f32>, dst: vec4<f32>) -> vec4<f32> {
    let srcA = src.a * uniforms.opacity;
    let outA = srcA + dst.a * (1.0 - srcA);

    if (outA == 0.0) {
        return vec4<f32>(0.0, 0.0, 0.0, 0.0);
    }

    let outRGB = (src.rgb * srcA + dst.rgb * dst.a * (1.0 - srcA)) / outA;
    return vec4<f32>(outRGB, outA);
}

// Additive blending (light addition)
fn blendAdditive(src: vec4<f32>, dst: vec4<f32>) -> vec4<f32> {
    let srcA = src.a * uniforms.opacity;
    let rgb = src.rgb * srcA + dst.rgb;
    let a = min(srcA + dst.a, 1.0);
    return vec4<f32>(rgb, a);
}

// Multiply blending (darkening)
fn blendMultiply(src: vec4<f32>, dst: vec4<f32>) -> vec4<f32> {
    let srcA = src.a * uniforms.opacity;
    let rgb = src.rgb * dst.rgb;
    let a = srcA * dst.a;
    return vec4<f32>(rgb, a);
}

// Screen blending (lightening, inverse of multiply)
fn blendScreen(src: vec4<f32>, dst: vec4<f32>) -> vec4<f32> {
    let srcA = src.a * uniforms.opacity;
    let rgb = vec3<f32>(1.0) - (vec3<f32>(1.0) - src.rgb) * (vec3<f32>(1.0) - dst.rgb);
    let a = srcA + dst.a - srcA * dst.a;
    return vec4<f32>(rgb, a);
}

// ============================================================================
// Fragment Shader - Main
// ============================================================================

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Clip test - discard fragments outside clip region
    if (in.position.x < clipRegion.minX || in.position.x > clipRegion.maxX ||
        in.position.y < clipRegion.minY || in.position.y > clipRegion.maxY) {
        discard;
    }

    // Sample layer texture
    let srcColor = textureSample(layerTexture, layerSampler, in.texCoord);

    // Note: Actual destination color comes from framebuffer
    // This shader outputs the composited result directly
    // For proper compositing, the blend mode should be set in the pipeline state

    // Apply opacity
    var finalColor = srcColor;
    finalColor.a *= uniforms.opacity;

    return finalColor;
}

// ============================================================================
// Alternative: Pre-multiplied Alpha Compositing
// ============================================================================

@fragment
fn fs_premultiplied(in: VertexOutput) -> @location(0) vec4<f32> {
    // Clip test
    if (in.position.x < clipRegion.minX || in.position.x > clipRegion.maxX ||
        in.position.y < clipRegion.minY || in.position.y > clipRegion.maxY) {
        discard;
    }

    // Sample layer texture
    var color = textureSample(layerTexture, layerSampler, in.texCoord);

    // Pre-multiply alpha
    color.r *= color.a;
    color.g *= color.a;
    color.b *= color.a;

    // Apply opacity
    color *= uniforms.opacity;

    return color;
}

// ============================================================================
// Utility: Fullscreen Quad Vertex Shader
// ============================================================================

@vertex
fn vs_fullscreen(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var out: VertexOutput;

    // Generate fullscreen quad without vertex buffer
    // Triangle strip: (0,0), (1,0), (0,1), (1,1)
    let x = f32((vertexIndex & 1u) << 1u);
    let y = f32(vertexIndex & 2u);

    out.position = vec4<f32>(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0);
    out.texCoord = vec2<f32>(x, y);

    return out;
}
