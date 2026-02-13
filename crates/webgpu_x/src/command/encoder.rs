//! Command Encoder Operations
//!
//! Provides command encoding functionality for render passes in WebGPU.
//! This module enables recording of GPU commands that can be submitted to a queue.
//!
//! The render pass workflow is:
//! 1. Create a command encoder
//! 2. Begin a render pass with color/depth attachments
//! 3. Set pipeline, bind groups, vertex buffers
//! 4. Issue draw commands
//! 5. End the render pass
//! 6. Finish the encoder to get a command buffer
//! 7. Submit the command buffer to the queue

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use wgpu;

use crate::gpu::device::DEVICES;
use crate::gpu::bind_group::{BIND_GROUPS, GPU_BUFFERS, TEXTURE_VIEWS};

// ============================================================================
// Handle Generation
// ============================================================================

static NEXT_COMMAND_ENCODER_HANDLE: AtomicU64 = AtomicU64::new(1);
static NEXT_RENDER_PASS_HANDLE: AtomicU64 = AtomicU64::new(1);
static NEXT_COMMAND_BUFFER_HANDLE: AtomicU64 = AtomicU64::new(1);

fn next_command_encoder_handle() -> u64 {
    NEXT_COMMAND_ENCODER_HANDLE.fetch_add(1, Ordering::SeqCst)
}

fn next_render_pass_handle() -> u64 {
    NEXT_RENDER_PASS_HANDLE.fetch_add(1, Ordering::SeqCst)
}

fn next_command_buffer_handle() -> u64 {
    NEXT_COMMAND_BUFFER_HANDLE.fetch_add(1, Ordering::SeqCst)
}

// ============================================================================
// Global Storage
// ============================================================================

lazy_static::lazy_static! {
    /// Storage for command encoders
    pub static ref COMMAND_ENCODERS: RwLock<HashMap<u64, wgpu::CommandEncoder>> = RwLock::new(HashMap::new());

    /// Storage for command buffers (finished encoders)
    pub static ref COMMAND_BUFFERS: RwLock<HashMap<u64, wgpu::CommandBuffer>> = RwLock::new(HashMap::new());

    /// Storage for render pass state (we track render pass association with encoder)
    /// Maps render pass handle -> (encoder handle, render pass descriptor info)
    static ref RENDER_PASS_STATE: RwLock<HashMap<u64, RenderPassState>> = RwLock::new(HashMap::new());

    /// Temporary storage for render pipelines (from render pipeline creation)
    pub static ref RENDER_PIPELINES: RwLock<HashMap<u64, wgpu::RenderPipeline>> = RwLock::new(HashMap::new());
}

/// Commands that can be recorded in a render pass
/// These are stored and replayed when the render pass ends
#[derive(Debug, Clone)]
enum RenderPassCommand {
    /// Set the render pipeline
    SetPipeline(u64),
    /// Set a bind group at the specified index
    SetBindGroup { index: u32, handle: u64 },
    /// Set a vertex buffer at the specified slot
    SetVertexBuffer { slot: u32, handle: u64 },
    /// Issue a draw command
    Draw {
        vertex_count: u32,
        instance_count: u32,
        first_vertex: u32,
        first_instance: u32,
    },
}

/// State information for an active render pass
struct RenderPassState {
    encoder_handle: u64,
    // Track if this render pass is still active
    active: bool,
    // Color attachment descriptor for creating the actual render pass
    color_attachment: ColorAttachmentDescriptor,
    // Recorded commands to be replayed when the render pass ends
    commands: Vec<RenderPassCommand>,
}

// ============================================================================
// Color Attachment Descriptor
// ============================================================================

/// Color attachment descriptor for JSON parsing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorAttachmentDescriptor {
    /// Texture view handle for the color attachment
    pub view: u64,
    /// Load operation: "clear" or "load"
    #[serde(default = "default_load_op")]
    pub load_op: String,
    /// Store operation: "store" or "discard"
    #[serde(default = "default_store_op")]
    pub store_op: String,
    /// Clear color [r, g, b, a] (used when load_op is "clear")
    #[serde(default = "default_clear_value")]
    pub clear_value: [f64; 4],
    /// Optional resolve target texture view handle
    #[serde(default)]
    pub resolve_target: Option<u64>,
}

fn default_load_op() -> String {
    "clear".to_string()
}

fn default_store_op() -> String {
    "store".to_string()
}

fn default_clear_value() -> [f64; 4] {
    [0.0, 0.0, 0.0, 1.0]
}

impl Default for ColorAttachmentDescriptor {
    fn default() -> Self {
        Self {
            view: 0,
            load_op: default_load_op(),
            store_op: default_store_op(),
            clear_value: default_clear_value(),
            resolve_target: None,
        }
    }
}

fn parse_load_op(op: &str, clear_color: wgpu::Color) -> wgpu::LoadOp<wgpu::Color> {
    match op.to_lowercase().as_str() {
        "load" => wgpu::LoadOp::Load,
        _ => wgpu::LoadOp::Clear(clear_color),
    }
}

fn parse_store_op(op: &str) -> wgpu::StoreOp {
    match op.to_lowercase().as_str() {
        "discard" => wgpu::StoreOp::Discard,
        _ => wgpu::StoreOp::Store,
    }
}

// ============================================================================
// Command Encoder Creation
// ============================================================================

/// Create a command encoder for recording GPU commands
///
/// # Arguments
/// * `device_handle` - Handle to the GPU device
///
/// # Returns
/// Command encoder handle or 0 on failure
pub fn gpu_create_command_encoder(device_handle: u64) -> u64 {
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    let encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("command_encoder"),
    });

    let handle = next_command_encoder_handle();
    COMMAND_ENCODERS.write().insert(handle, encoder);
    handle
}

// ============================================================================
// Render Pass Operations
// ============================================================================

/// Begin a render pass with the specified color attachments
///
/// Note: Due to Rust's borrow checker and wgpu's lifetime requirements,
/// we need to handle render passes differently. This function sets up
/// the render pass state and returns a handle that can be used for
/// subsequent operations. The actual render pass commands are accumulated
/// and executed when gpu_end_render_pass is called.
///
/// # Arguments
/// * `encoder_handle` - Handle to the command encoder
/// * `color_attachment_json` - JSON descriptor for color attachment
///
/// # Returns
/// Render pass handle or 0 on failure
pub fn gpu_begin_render_pass(
    encoder_handle: u64,
    color_attachment_json: &str,
) -> u64 {
    // Verify encoder exists
    let encoders = COMMAND_ENCODERS.read();
    if !encoders.contains_key(&encoder_handle) {
        return 0;
    }
    drop(encoders);

    // Parse color attachment descriptor
    let color_desc: ColorAttachmentDescriptor = match serde_json::from_str(color_attachment_json) {
        Ok(desc) => desc,
        Err(_) => return 0,
    };

    // Create render pass state with the color attachment stored for later use
    let handle = next_render_pass_handle();
    let state = RenderPassState {
        encoder_handle,
        active: true,
        color_attachment: color_desc,
        commands: Vec::new(),
    };

    RENDER_PASS_STATE.write().insert(handle, state);
    handle
}

/// Set the render pipeline for the current render pass
///
/// # Arguments
/// * `pass_handle` - Handle to the render pass
/// * `pipeline_handle` - Handle to the render pipeline
pub fn gpu_render_pass_set_pipeline(pass_handle: u64, pipeline_handle: u64) {
    // Verify pipeline exists first
    {
        let pipelines = RENDER_PIPELINES.read();
        if !pipelines.contains_key(&pipeline_handle) {
            return;
        }
    }

    // Record the command
    let mut states = RENDER_PASS_STATE.write();
    if let Some(state) = states.get_mut(&pass_handle) {
        if state.active {
            state.commands.push(RenderPassCommand::SetPipeline(pipeline_handle));
        }
    }
}

/// Set a bind group for the current render pass
///
/// # Arguments
/// * `pass_handle` - Handle to the render pass
/// * `index` - Bind group slot index
/// * `bind_group_handle` - Handle to the bind group
pub fn gpu_render_pass_set_bind_group(pass_handle: u64, index: u32, bind_group_handle: u64) {
    // Verify bind group exists first
    {
        let bind_groups = BIND_GROUPS.read();
        if !bind_groups.contains_key(&bind_group_handle) {
            return;
        }
    }

    // Record the command
    let mut states = RENDER_PASS_STATE.write();
    if let Some(state) = states.get_mut(&pass_handle) {
        if state.active {
            state.commands.push(RenderPassCommand::SetBindGroup {
                index,
                handle: bind_group_handle,
            });
        }
    }
}

/// Set a vertex buffer for the current render pass
///
/// # Arguments
/// * `pass_handle` - Handle to the render pass
/// * `slot` - Vertex buffer slot index
/// * `buffer_handle` - Handle to the vertex buffer
pub fn gpu_render_pass_set_vertex_buffer(pass_handle: u64, slot: u32, buffer_handle: u64) {
    // Verify buffer exists first
    {
        let buffers = GPU_BUFFERS.read();
        if !buffers.contains_key(&buffer_handle) {
            return;
        }
    }

    // Record the command
    let mut states = RENDER_PASS_STATE.write();
    if let Some(state) = states.get_mut(&pass_handle) {
        if state.active {
            state.commands.push(RenderPassCommand::SetVertexBuffer {
                slot,
                handle: buffer_handle,
            });
        }
    }
}

/// Issue a draw command for the current render pass
///
/// # Arguments
/// * `pass_handle` - Handle to the render pass
/// * `vertex_count` - Number of vertices to draw
/// * `instance_count` - Number of instances to draw
/// * `first_vertex` - Index of the first vertex
/// * `first_instance` - Index of the first instance
pub fn gpu_render_pass_draw(
    pass_handle: u64,
    vertex_count: u32,
    instance_count: u32,
    first_vertex: u32,
    first_instance: u32,
) {
    // Record the draw command
    let mut states = RENDER_PASS_STATE.write();
    if let Some(state) = states.get_mut(&pass_handle) {
        if state.active {
            state.commands.push(RenderPassCommand::Draw {
                vertex_count,
                instance_count,
                first_vertex,
                first_instance,
            });
        }
    }
}

/// End the render pass
///
/// This is where the actual GPU commands are recorded. All previously
/// recorded commands are replayed on the actual wgpu render pass.
///
/// # Arguments
/// * `pass_handle` - Handle to the render pass
pub fn gpu_end_render_pass(pass_handle: u64) {
    // Remove the state and get ownership of it
    let state = {
        let mut states = RENDER_PASS_STATE.write();
        states.remove(&pass_handle)
    };

    let state = match state {
        Some(s) if s.active => s,
        _ => return,
    };

    // Get the encoder (we need mutable access)
    let mut encoders = COMMAND_ENCODERS.write();
    let encoder = match encoders.get_mut(&state.encoder_handle) {
        Some(e) => e,
        None => return,
    };

    // Get the texture view for the color attachment
    let texture_views = TEXTURE_VIEWS.read();
    let view = match texture_views.get(&state.color_attachment.view) {
        Some(v) => v,
        None => return,
    };

    // Get optional resolve target
    let resolve_target = state.color_attachment.resolve_target.and_then(|h| texture_views.get(&h));

    // Create clear color from descriptor
    let clear_color = wgpu::Color {
        r: state.color_attachment.clear_value[0],
        g: state.color_attachment.clear_value[1],
        b: state.color_attachment.clear_value[2],
        a: state.color_attachment.clear_value[3],
    };

    // Parse load and store operations
    let load_op = parse_load_op(&state.color_attachment.load_op, clear_color);
    let store_op = parse_store_op(&state.color_attachment.store_op);

    // Create the actual render pass and replay all recorded commands
    {
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("deferred_render_pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view,
                resolve_target,
                ops: wgpu::Operations {
                    load: load_op,
                    store: store_op,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
        });

        // Replay all recorded commands
        // We need to acquire locks inside the render pass scope
        let pipelines = RENDER_PIPELINES.read();
        let bind_groups = BIND_GROUPS.read();
        let buffers = GPU_BUFFERS.read();

        for command in &state.commands {
            match command {
                RenderPassCommand::SetPipeline(pipeline_handle) => {
                    if let Some(pipeline) = pipelines.get(pipeline_handle) {
                        render_pass.set_pipeline(pipeline);
                    }
                }
                RenderPassCommand::SetBindGroup { index, handle } => {
                    if let Some(bind_group) = bind_groups.get(handle) {
                        render_pass.set_bind_group(*index, bind_group, &[]);
                    }
                }
                RenderPassCommand::SetVertexBuffer { slot, handle } => {
                    if let Some(buffer) = buffers.get(handle) {
                        render_pass.set_vertex_buffer(*slot, buffer.slice(..));
                    }
                }
                RenderPassCommand::Draw {
                    vertex_count,
                    instance_count,
                    first_vertex,
                    first_instance,
                } => {
                    render_pass.draw(
                        *first_vertex..(*first_vertex + *vertex_count),
                        *first_instance..(*first_instance + *instance_count),
                    );
                }
            }
        }
        // render_pass is dropped here, which ends the render pass
    }
}

// ============================================================================
// Command Buffer Operations
// ============================================================================

/// Finish the command encoder and get a command buffer
///
/// # Arguments
/// * `encoder_handle` - Handle to the command encoder
///
/// # Returns
/// Command buffer handle or 0 on failure
pub fn gpu_finish_command_encoder(encoder_handle: u64) -> u64 {
    // Remove encoder from storage (it's consumed when finishing)
    let mut encoders = COMMAND_ENCODERS.write();
    let encoder = match encoders.remove(&encoder_handle) {
        Some(e) => e,
        None => return 0,
    };

    let command_buffer = encoder.finish();
    let handle = next_command_buffer_handle();
    COMMAND_BUFFERS.write().insert(handle, command_buffer);
    handle
}

/// Submit a command buffer to the device queue
///
/// # Arguments
/// * `device_handle` - Handle to the GPU device
/// * `command_buffer_handle` - Handle to the command buffer
pub fn gpu_queue_submit(device_handle: u64, command_buffer_handle: u64) {
    let devices = DEVICES.read();
    let (_device, queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return,
    };

    // Remove command buffer from storage (it's consumed when submitting)
    let mut buffers = COMMAND_BUFFERS.write();
    let command_buffer = match buffers.remove(&command_buffer_handle) {
        Some(cb) => cb,
        None => return,
    };

    queue.submit(std::iter::once(command_buffer));
}

/// Destroy a command buffer
///
/// # Arguments
/// * `handle` - Handle to the command buffer to destroy
pub fn gpu_destroy_command_buffer(handle: u64) {
    COMMAND_BUFFERS.write().remove(&handle);
}

// ============================================================================
// Cleanup
// ============================================================================

/// Clean up all command-related resources
pub fn gpu_cleanup_command_resources() {
    COMMAND_ENCODERS.write().clear();
    COMMAND_BUFFERS.write().clear();
    RENDER_PASS_STATE.write().clear();
    RENDER_PIPELINES.write().clear();
}

// ============================================================================
// Additional Helper Functions
// ============================================================================

/// Execute a complete render pass with the specified parameters
///
/// This is a higher-level function that combines begin, draw, and end
/// operations into a single call for simple use cases.
///
/// # Arguments
/// * `device_handle` - Handle to the GPU device
/// * `color_attachment_json` - JSON descriptor for color attachment
/// * `pipeline_handle` - Handle to the render pipeline (optional, 0 if none)
/// * `vertex_buffer_handle` - Handle to vertex buffer (optional, 0 if none)
/// * `vertex_count` - Number of vertices to draw
/// * `instance_count` - Number of instances (1 for single instance)
///
/// # Returns
/// true on success, false on failure
pub fn gpu_execute_render_pass(
    device_handle: u64,
    color_attachment_json: &str,
    pipeline_handle: u64,
    vertex_buffer_handle: u64,
    vertex_count: u32,
    instance_count: u32,
) -> bool {
    let devices = DEVICES.read();
    let (device, queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return false,
    };

    // Parse color attachment
    let color_desc: ColorAttachmentDescriptor = match serde_json::from_str(color_attachment_json) {
        Ok(desc) => desc,
        Err(_) => return false,
    };

    // Get texture view
    let texture_views = TEXTURE_VIEWS.read();
    let view = match texture_views.get(&color_desc.view) {
        Some(v) => v,
        None => return false,
    };

    // Get optional resolve target
    let resolve_target = color_desc.resolve_target.and_then(|h| texture_views.get(&h));

    // Create clear color from descriptor
    let clear_color = wgpu::Color {
        r: color_desc.clear_value[0],
        g: color_desc.clear_value[1],
        b: color_desc.clear_value[2],
        a: color_desc.clear_value[3],
    };

    // Parse load and store operations
    let load_op = parse_load_op(&color_desc.load_op, clear_color);
    let store_op = parse_store_op(&color_desc.store_op);

    // Create command encoder
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("render_pass_encoder"),
    });

    // Begin render pass
    {
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("render_pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view,
                resolve_target,
                ops: wgpu::Operations {
                    load: load_op,
                    store: store_op,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
        });

        // Set pipeline if provided
        if pipeline_handle != 0 {
            let pipelines = RENDER_PIPELINES.read();
            if let Some(pipeline) = pipelines.get(&pipeline_handle) {
                render_pass.set_pipeline(pipeline);
            }
        }

        // Set vertex buffer if provided
        if vertex_buffer_handle != 0 {
            let buffers = GPU_BUFFERS.read();
            if let Some(buffer) = buffers.get(&vertex_buffer_handle) {
                render_pass.set_vertex_buffer(0, buffer.slice(..));
            }
        }

        // Draw if vertex count > 0
        if vertex_count > 0 {
            render_pass.draw(0..vertex_count, 0..instance_count);
        }
    }

    // Submit
    queue.submit(std::iter::once(encoder.finish()));

    true
}

/// Create a render pipeline and store it
///
/// This is a simplified pipeline creation for basic rendering.
/// For full control, use the more comprehensive pipeline creation functions.
///
/// # Arguments
/// * `device_handle` - Handle to the GPU device
/// * `shader_module_handle` - Handle to the shader module (not implemented, uses internal)
/// * `vertex_entry_point` - Vertex shader entry point name
/// * `fragment_entry_point` - Fragment shader entry point name
/// * `texture_format` - Texture format code (1=Rgba8Unorm, etc.)
///
/// # Returns
/// Render pipeline handle or 0 on failure
pub fn gpu_create_render_pipeline_simple(
    device_handle: u64,
    _shader_module_handle: u64,
    _vertex_entry_point: &str,
    _fragment_entry_point: &str,
    _texture_format: u32,
) -> u64 {
    // Verify device exists
    let devices = DEVICES.read();
    if !devices.contains_key(&device_handle) {
        return 0;
    }

    // Note: Full pipeline creation requires shader module management
    // This is a placeholder for integration with shader modules
    // The actual implementation would create the pipeline with proper shaders

    0 // Return 0 for now - full implementation requires shader module system
}

/// Destroy a render pipeline
pub fn gpu_destroy_render_pipeline(handle: u64) {
    RENDER_PIPELINES.write().remove(&handle);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_color_attachment_descriptor_default() {
        let desc = ColorAttachmentDescriptor::default();
        assert_eq!(desc.view, 0);
        assert_eq!(desc.load_op, "clear");
        assert_eq!(desc.store_op, "store");
        assert_eq!(desc.clear_value, [0.0, 0.0, 0.0, 1.0]);
        assert!(desc.resolve_target.is_none());
    }

    #[test]
    fn test_color_attachment_parsing() {
        let json = r#"{
            "view": 12345,
            "load_op": "clear",
            "store_op": "store",
            "clear_value": [0.1, 0.2, 0.3, 1.0]
        }"#;

        let desc: ColorAttachmentDescriptor = serde_json::from_str(json).unwrap();
        assert_eq!(desc.view, 12345);
        assert_eq!(desc.load_op, "clear");
        assert_eq!(desc.store_op, "store");
        assert_eq!(desc.clear_value, [0.1, 0.2, 0.3, 1.0]);
    }

    #[test]
    fn test_color_attachment_with_resolve_target() {
        let json = r#"{
            "view": 123,
            "load_op": "load",
            "store_op": "discard",
            "clear_value": [0.0, 0.0, 0.0, 0.0],
            "resolve_target": 456
        }"#;

        let desc: ColorAttachmentDescriptor = serde_json::from_str(json).unwrap();
        assert_eq!(desc.view, 123);
        assert_eq!(desc.load_op, "load");
        assert_eq!(desc.store_op, "discard");
        assert_eq!(desc.resolve_target, Some(456));
    }

    #[test]
    fn test_parse_load_op() {
        let clear_color = wgpu::Color::RED;
        assert!(matches!(parse_load_op("load", clear_color), wgpu::LoadOp::Load));
        assert!(matches!(parse_load_op("LOAD", clear_color), wgpu::LoadOp::Load));
        assert!(matches!(parse_load_op("clear", clear_color), wgpu::LoadOp::Clear(_)));
        assert!(matches!(parse_load_op("anything_else", clear_color), wgpu::LoadOp::Clear(_)));
    }

    #[test]
    fn test_parse_store_op() {
        assert!(matches!(parse_store_op("store"), wgpu::StoreOp::Store));
        assert!(matches!(parse_store_op("STORE"), wgpu::StoreOp::Store));
        assert!(matches!(parse_store_op("discard"), wgpu::StoreOp::Discard));
        assert!(matches!(parse_store_op("DISCARD"), wgpu::StoreOp::Discard));
    }

    #[test]
    fn test_handle_generation() {
        let handle1 = next_command_encoder_handle();
        let handle2 = next_command_encoder_handle();
        assert!(handle2 > handle1);

        let rp1 = next_render_pass_handle();
        let rp2 = next_render_pass_handle();
        assert!(rp2 > rp1);

        let cb1 = next_command_buffer_handle();
        let cb2 = next_command_buffer_handle();
        assert!(cb2 > cb1);
    }

    #[test]
    fn test_create_encoder_invalid_device() {
        let handle = gpu_create_command_encoder(999999);
        assert_eq!(handle, 0);
    }

    #[test]
    fn test_begin_render_pass_invalid_encoder() {
        let json = r#"{"view": 123}"#;
        let handle = gpu_begin_render_pass(999999, json);
        assert_eq!(handle, 0);
    }

    #[test]
    fn test_begin_render_pass_invalid_json() {
        // This will fail because encoder doesn't exist
        let handle = gpu_begin_render_pass(1, "not valid json");
        assert_eq!(handle, 0);
    }

    #[test]
    fn test_finish_encoder_invalid() {
        let handle = gpu_finish_command_encoder(999999);
        assert_eq!(handle, 0);
    }

    #[test]
    fn test_cleanup() {
        // Just verify cleanup doesn't panic
        gpu_cleanup_command_resources();
    }
}
