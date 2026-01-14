// Shader code for rendering textures
//
// This module contains WGSL shaders for rendering the content texture
// (web page pixels) to the window surface.

/// Vertex shader for fullscreen quad
///
/// This generates a fullscreen triangle strip without vertex buffers.
/// It uses vertex IDs to generate positions and UVs.
pub const FULLSCREEN_VERTEX_SHADER: &str = r#"
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;

    // Generate fullscreen triangle positions
    let x = f32((vertex_index << 1u) & 2u);
    let y = f32(vertex_index & 2u);

    out.position = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
    out.uv = vec2<f32>(x, y);

    return out;
}
"#;

/// Fragment shader for texture rendering
///
/// This samples the content texture and outputs it to the framebuffer.
pub const TEXTURE_FRAGMENT_SHADER: &str = r#"
@group(0) @binding(0) var content_texture: texture_2d<f32>;
@group(0) @binding(1) var content_sampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    return textureSample(content_texture, content_sampler, uv);
}
"#;
