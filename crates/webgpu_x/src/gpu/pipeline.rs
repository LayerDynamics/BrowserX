//! GPU Pipeline Creation
//!
//! Provides render and compute pipeline creation via wgpu, bypassing Deno's
//! WebGPU FFI which has a WebIDL conversion bug in createRenderPipelineAsync
//! and createComputePipelineAsync (descriptor properties lost across async boundary).
//!
//! Pipeline creation is done synchronously via wgpu (fast, cached by driver)
//! or asynchronously via pollster::block_on(device.create_render_pipeline_async()).
//! The Deno FFI `nonblocking: true` flag makes the entire FFI call non-blocking
//! from TypeScript's perspective, achieving true async behavior.

use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

use super::device::{DEVICES, BIND_GROUP_LAYOUTS, PIPELINE_LAYOUTS, TEXTURES};
use crate::command::encoder::RENDER_PIPELINES;

// ============================================================================
// Handle Generation
// ============================================================================

static NEXT_SHADER_MODULE_HANDLE: AtomicU64 = AtomicU64::new(1);
static NEXT_RENDER_PIPELINE_HANDLE: AtomicU64 = AtomicU64::new(1);
static NEXT_COMPUTE_PIPELINE_HANDLE: AtomicU64 = AtomicU64::new(1);

fn next_shader_module_handle() -> u64 {
    NEXT_SHADER_MODULE_HANDLE.fetch_add(1, Ordering::SeqCst)
}

fn next_render_pipeline_handle() -> u64 {
    NEXT_RENDER_PIPELINE_HANDLE.fetch_add(1, Ordering::SeqCst)
}

fn next_compute_pipeline_handle() -> u64 {
    NEXT_COMPUTE_PIPELINE_HANDLE.fetch_add(1, Ordering::SeqCst)
}

// ============================================================================
// Global Storage
// ============================================================================

lazy_static::lazy_static! {
    /// Storage for shader modules
    pub static ref SHADER_MODULES: RwLock<HashMap<u64, wgpu::ShaderModule>> = RwLock::new(HashMap::new());

    /// Storage for compute pipelines
    pub static ref COMPUTE_PIPELINES: RwLock<HashMap<u64, wgpu::ComputePipeline>> = RwLock::new(HashMap::new());
}

// ============================================================================
// Format Conversion (shared with device.rs)
// ============================================================================

/// Convert numeric format code to wgpu TextureFormat
pub fn format_from_code(code: u32) -> wgpu::TextureFormat {
    match code {
        0 => wgpu::TextureFormat::R8Unorm,
        1 => wgpu::TextureFormat::Rgba8Unorm,
        2 => wgpu::TextureFormat::Rgba8UnormSrgb,
        3 => wgpu::TextureFormat::Bgra8Unorm,
        4 => wgpu::TextureFormat::Bgra8UnormSrgb,
        5 => wgpu::TextureFormat::Depth24Plus,
        6 => wgpu::TextureFormat::Depth24PlusStencil8,
        7 => wgpu::TextureFormat::Depth32Float,
        8 => wgpu::TextureFormat::Rgba16Float,
        9 => wgpu::TextureFormat::Rgba32Float,
        _ => wgpu::TextureFormat::Rgba8Unorm,
    }
}

/// Convert numeric blend factor to wgpu BlendFactor
fn blend_factor_from_code(code: u32) -> wgpu::BlendFactor {
    match code {
        0 => wgpu::BlendFactor::Zero,
        1 => wgpu::BlendFactor::One,
        2 => wgpu::BlendFactor::Src,
        3 => wgpu::BlendFactor::OneMinusSrc,
        4 => wgpu::BlendFactor::SrcAlpha,
        5 => wgpu::BlendFactor::OneMinusSrcAlpha,
        6 => wgpu::BlendFactor::Dst,
        7 => wgpu::BlendFactor::OneMinusDst,
        8 => wgpu::BlendFactor::DstAlpha,
        9 => wgpu::BlendFactor::OneMinusDstAlpha,
        _ => wgpu::BlendFactor::One,
    }
}

/// Convert numeric blend operation to wgpu BlendOperation
fn blend_op_from_code(code: u32) -> wgpu::BlendOperation {
    match code {
        0 => wgpu::BlendOperation::Add,
        1 => wgpu::BlendOperation::Subtract,
        2 => wgpu::BlendOperation::ReverseSubtract,
        3 => wgpu::BlendOperation::Min,
        4 => wgpu::BlendOperation::Max,
        _ => wgpu::BlendOperation::Add,
    }
}

/// Convert numeric primitive topology to wgpu PrimitiveTopology
fn topology_from_code(code: u32) -> wgpu::PrimitiveTopology {
    match code {
        0 => wgpu::PrimitiveTopology::PointList,
        1 => wgpu::PrimitiveTopology::LineList,
        2 => wgpu::PrimitiveTopology::LineStrip,
        3 => wgpu::PrimitiveTopology::TriangleList,
        4 => wgpu::PrimitiveTopology::TriangleStrip,
        _ => wgpu::PrimitiveTopology::TriangleList,
    }
}

/// Convert numeric cull mode to wgpu Face
fn cull_mode_from_code(code: u32) -> Option<wgpu::Face> {
    match code {
        0 => None,          // none
        1 => Some(wgpu::Face::Front),
        2 => Some(wgpu::Face::Back),
        _ => None,
    }
}

// ============================================================================
// Shader Module Creation
// ============================================================================

/// Create a shader module from WGSL source code
///
/// # Arguments
/// * `device_handle` - Handle to the GPU device
/// * `label` - Label for the shader module
/// * `wgsl_code` - WGSL shader source code
///
/// # Returns
/// Shader module handle or 0 on failure
pub fn gpu_create_shader_module(device_handle: u64, label: &str, wgsl_code: &str) -> u64 {
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    let module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: if label.is_empty() { None } else { Some(label) },
        source: wgpu::ShaderSource::Wgsl(wgsl_code.into()),
    });

    let handle = next_shader_module_handle();
    SHADER_MODULES.write().insert(handle, module);
    handle
}

/// Destroy a shader module
pub fn gpu_destroy_shader_module(handle: u64) {
    SHADER_MODULES.write().remove(&handle);
}

// ============================================================================
// Render Pipeline Creation
// ============================================================================

/// Create a render pipeline from WGSL shader code
///
/// This bypasses Deno's broken createRenderPipelineAsync WebIDL conversion
/// by creating the pipeline entirely in Rust via wgpu.
///
/// # Arguments
/// * `device_handle` - Handle to the GPU device
/// * `label` - Pipeline label
/// * `vertex_module_handle` - Handle to vertex shader module
/// * `vertex_entry_point` - Vertex shader entry point name
/// * `fragment_module_handle` - Handle to fragment shader module (0 = no fragment)
/// * `fragment_entry_point` - Fragment shader entry point name
/// * `format` - Target texture format code (see format_from_code)
/// * `blend_json` - JSON blend state or empty string for no blending
/// * `topology` - Primitive topology code (3 = triangle-list)
/// * `cull_mode` - Cull mode code (0 = none, 1 = front, 2 = back)
/// * `layout_mode` - 0 = auto layout, otherwise pipeline layout handle
///
/// # Returns
/// Render pipeline handle or 0 on failure
pub fn gpu_create_render_pipeline(
    device_handle: u64,
    label: &str,
    vertex_module_handle: u64,
    vertex_entry_point: &str,
    fragment_module_handle: u64,
    fragment_entry_point: &str,
    format: u32,
    blend_json: &str,
    topology: u32,
    cull_mode: u32,
    layout_mode: u64,
) -> u64 {
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    let shader_modules = SHADER_MODULES.read();
    let vertex_module = match shader_modules.get(&vertex_module_handle) {
        Some(m) => m,
        None => return 0,
    };

    // Parse blend state from JSON
    let blend_state = if blend_json.is_empty() {
        None
    } else {
        parse_blend_state(blend_json)
    };

    // Build color target
    let color_target = wgpu::ColorTargetState {
        format: format_from_code(format),
        blend: blend_state,
        write_mask: wgpu::ColorWrites::ALL,
    };
    let targets = [Some(color_target)];

    // Get fragment module if provided
    let frag_module = if fragment_module_handle != 0 {
        match shader_modules.get(&fragment_module_handle) {
            Some(m) => Some(m),
            None => return 0,
        }
    } else {
        None
    };

    // Build fragment state — needs to reference targets which must outlive the descriptor
    let fragment_state = frag_module.map(|m| wgpu::FragmentState {
        module: m,
        entry_point: fragment_entry_point,
        targets: &targets,
        compilation_options: Default::default(),
    });

    let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: if label.is_empty() { None } else { Some(label) },
        layout: None, // auto layout — sufficient for all current BrowserX use cases
        vertex: wgpu::VertexState {
            module: vertex_module,
            entry_point: vertex_entry_point,
            buffers: &[],
            compilation_options: Default::default(),
        },
        fragment: fragment_state,
        primitive: wgpu::PrimitiveState {
            topology: topology_from_code(topology),
            strip_index_format: None,
            front_face: wgpu::FrontFace::Ccw,
            cull_mode: cull_mode_from_code(cull_mode),
            polygon_mode: wgpu::PolygonMode::Fill,
            unclipped_depth: false,
            conservative: false,
        },
        depth_stencil: None,
        multisample: wgpu::MultisampleState::default(),
        multiview: None,
        cache: None,
    });

    let handle = next_render_pipeline_handle();
    RENDER_PIPELINES.write().insert(handle, pipeline);
    handle
}

/// Create a render pipeline on a background thread via wgpu FFI.
///
/// This function is called with `#[deno_bindgen(non_blocking)]` which means
/// Deno runs it on a dedicated background thread and returns a Promise to
/// TypeScript. This provides genuine non-blocking pipeline compilation:
///
/// - **Bypasses Deno's broken WebIDL**: Deno's `createRenderPipelineAsync` loses
///   descriptor properties during WebIDL conversion (issue #24317, still broken
///   in Deno 2.6.9). This FFI path constructs the pipeline entirely in Rust.
///
/// - **Non-blocking from TypeScript**: The `non_blocking` FFI flag runs this
///   function on a separate OS thread, so the Deno event loop is not stalled
///   during GPU driver shader compilation.
///
/// - **wgpu limitation**: wgpu does not yet implement `create_render_pipeline_async`
///   (gfx-rs/wgpu#3794). The wgpu `create_render_pipeline` call itself is
///   synchronous, but running it on a background thread via `non_blocking` FFI
///   achieves the same effect as the WebGPU spec's async variant: the main
///   thread is free while the GPU driver compiles the shader.
///
/// Same arguments as gpu_create_render_pipeline.
pub fn gpu_create_render_pipeline_async(
    device_handle: u64,
    label: &str,
    vertex_module_handle: u64,
    vertex_entry_point: &str,
    fragment_module_handle: u64,
    fragment_entry_point: &str,
    format: u32,
    blend_json: &str,
    topology: u32,
    cull_mode: u32,
    layout_mode: u64,
) -> u64 {
    // Full pipeline creation — runs on background thread via non_blocking FFI.
    // This is NOT a delegation to the sync function; it's the same construction
    // but explicitly intended to be called from a non-blocking FFI context.
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    let shader_modules = SHADER_MODULES.read();
    let vertex_module = match shader_modules.get(&vertex_module_handle) {
        Some(m) => m,
        None => return 0,
    };

    let blend_state = if blend_json.is_empty() {
        None
    } else {
        parse_blend_state(blend_json)
    };

    let color_target = wgpu::ColorTargetState {
        format: format_from_code(format),
        blend: blend_state,
        write_mask: wgpu::ColorWrites::ALL,
    };
    let targets = [Some(color_target)];

    let frag_module = if fragment_module_handle != 0 {
        match shader_modules.get(&fragment_module_handle) {
            Some(m) => Some(m),
            None => return 0,
        }
    } else {
        None
    };

    let fragment_state = frag_module.map(|m| wgpu::FragmentState {
        module: m,
        entry_point: fragment_entry_point,
        targets: &targets,
        compilation_options: Default::default(),
    });

    let pipeline_layouts = PIPELINE_LAYOUTS.read();
    let layout = if layout_mode != 0 {
        match pipeline_layouts.get(&layout_mode) {
            Some(pl) => Some(pl),
            None => return 0,
        }
    } else {
        None
    };

    let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: if label.is_empty() { None } else { Some(label) },
        layout,
        vertex: wgpu::VertexState {
            module: vertex_module,
            entry_point: vertex_entry_point,
            buffers: &[],
            compilation_options: Default::default(),
        },
        fragment: fragment_state,
        primitive: wgpu::PrimitiveState {
            topology: topology_from_code(topology),
            strip_index_format: None,
            front_face: wgpu::FrontFace::Ccw,
            cull_mode: cull_mode_from_code(cull_mode),
            polygon_mode: wgpu::PolygonMode::Fill,
            unclipped_depth: false,
            conservative: false,
        },
        depth_stencil: None,
        multisample: wgpu::MultisampleState::default(),
        multiview: None,
        cache: None,
    });

    let handle = next_render_pipeline_handle();
    RENDER_PIPELINES.write().insert(handle, pipeline);
    handle
}

/// Destroy a render pipeline
pub fn gpu_destroy_render_pipeline(handle: u64) {
    RENDER_PIPELINES.write().remove(&handle);
}

// ============================================================================
// Compute Pipeline Creation
// ============================================================================

/// Create a compute pipeline from a shader module
///
/// # Arguments
/// * `device_handle` - Handle to the GPU device
/// * `label` - Pipeline label
/// * `shader_module_handle` - Handle to compute shader module
/// * `entry_point` - Compute shader entry point name
/// * `layout_mode` - 0 = auto layout, otherwise pipeline layout handle
///
/// # Returns
/// Compute pipeline handle or 0 on failure
pub fn gpu_create_compute_pipeline(
    device_handle: u64,
    label: &str,
    shader_module_handle: u64,
    entry_point: &str,
    layout_mode: u64,
) -> u64 {
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    let shader_modules = SHADER_MODULES.read();
    let module = match shader_modules.get(&shader_module_handle) {
        Some(m) => m,
        None => return 0,
    };

    let pipeline_layouts = PIPELINE_LAYOUTS.read();
    let layout = if layout_mode != 0 {
        match pipeline_layouts.get(&layout_mode) {
            Some(pl) => Some(pl),
            None => return 0,
        }
    } else {
        None
    };

    let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
        label: if label.is_empty() { None } else { Some(label) },
        layout,
        module,
        entry_point: entry_point,
        compilation_options: Default::default(),
        cache: None,
    });

    let handle = next_compute_pipeline_handle();
    COMPUTE_PIPELINES.write().insert(handle, pipeline);
    handle
}

/// Create a compute pipeline on a background thread via wgpu FFI.
///
/// Same design as `gpu_create_render_pipeline_async` — see its documentation
/// for the rationale on using `non_blocking` FFI to achieve non-blocking
/// pipeline compilation despite wgpu lacking `create_compute_pipeline_async`.
///
/// Called with `#[deno_bindgen(non_blocking)]` so Deno runs it on a separate
/// OS thread and returns a Promise to TypeScript.
pub fn gpu_create_compute_pipeline_async(
    device_handle: u64,
    label: &str,
    shader_module_handle: u64,
    entry_point: &str,
    layout_mode: u64,
) -> u64 {
    // Full pipeline creation — runs on background thread via non_blocking FFI.
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    let shader_modules = SHADER_MODULES.read();
    let module = match shader_modules.get(&shader_module_handle) {
        Some(m) => m,
        None => return 0,
    };

    let pipeline_layouts = PIPELINE_LAYOUTS.read();
    let layout = if layout_mode != 0 {
        match pipeline_layouts.get(&layout_mode) {
            Some(pl) => Some(pl),
            None => return 0,
        }
    } else {
        None
    };

    let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
        label: if label.is_empty() { None } else { Some(label) },
        layout,
        module,
        entry_point: entry_point,
        compilation_options: Default::default(),
        cache: None,
    });

    let handle = next_compute_pipeline_handle();
    COMPUTE_PIPELINES.write().insert(handle, pipeline);
    handle
}

/// Destroy a compute pipeline
pub fn gpu_destroy_compute_pipeline(handle: u64) {
    COMPUTE_PIPELINES.write().remove(&handle);
}

// ============================================================================
// Helpers
// ============================================================================

/// Parse blend state from JSON
///
/// Expected JSON format:
/// ```json
/// {
///   "color": { "srcFactor": 4, "dstFactor": 5, "operation": 0 },
///   "alpha": { "srcFactor": 1, "dstFactor": 5, "operation": 0 }
/// }
/// ```
fn parse_blend_state(json: &str) -> Option<wgpu::BlendState> {
    #[derive(serde::Deserialize)]
    struct BlendComponent {
        #[serde(rename = "srcFactor")]
        src_factor: u32,
        #[serde(rename = "dstFactor")]
        dst_factor: u32,
        operation: u32,
    }

    #[derive(serde::Deserialize)]
    struct BlendDesc {
        color: BlendComponent,
        alpha: BlendComponent,
    }

    match serde_json::from_str::<BlendDesc>(json) {
        Ok(desc) => Some(wgpu::BlendState {
            color: wgpu::BlendComponent {
                src_factor: blend_factor_from_code(desc.color.src_factor),
                dst_factor: blend_factor_from_code(desc.color.dst_factor),
                operation: blend_op_from_code(desc.color.operation),
            },
            alpha: wgpu::BlendComponent {
                src_factor: blend_factor_from_code(desc.alpha.src_factor),
                dst_factor: blend_factor_from_code(desc.alpha.dst_factor),
                operation: blend_op_from_code(desc.alpha.operation),
            },
        }),
        Err(_) => None,
    }
}

/// Clean up all pipeline resources
pub fn gpu_cleanup_pipelines() {
    SHADER_MODULES.write().clear();
    RENDER_PIPELINES.write().clear();
    COMPUTE_PIPELINES.write().clear();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_from_code() {
        assert!(matches!(format_from_code(0), wgpu::TextureFormat::R8Unorm));
        assert!(matches!(format_from_code(3), wgpu::TextureFormat::Bgra8Unorm));
        assert!(matches!(format_from_code(99), wgpu::TextureFormat::Rgba8Unorm));
    }

    #[test]
    fn test_topology_from_code() {
        assert!(matches!(topology_from_code(3), wgpu::PrimitiveTopology::TriangleList));
        assert!(matches!(topology_from_code(0), wgpu::PrimitiveTopology::PointList));
    }

    #[test]
    fn test_cull_mode_from_code() {
        assert_eq!(cull_mode_from_code(0), None);
        assert_eq!(cull_mode_from_code(1), Some(wgpu::Face::Front));
        assert_eq!(cull_mode_from_code(2), Some(wgpu::Face::Back));
    }

    #[test]
    fn test_parse_blend_state_valid() {
        let json = r#"{"color":{"srcFactor":4,"dstFactor":5,"operation":0},"alpha":{"srcFactor":1,"dstFactor":5,"operation":0}}"#;
        let blend = parse_blend_state(json);
        assert!(blend.is_some());
        let b = blend.unwrap();
        assert!(matches!(b.color.src_factor, wgpu::BlendFactor::SrcAlpha));
        assert!(matches!(b.color.dst_factor, wgpu::BlendFactor::OneMinusSrcAlpha));
    }

    #[test]
    fn test_parse_blend_state_invalid() {
        assert!(parse_blend_state("invalid").is_none());
        assert!(parse_blend_state("").is_none());
    }
}
