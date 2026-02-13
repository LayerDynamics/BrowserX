//! GPU Bind Group Creation
//!
//! Provides functionality to create bind groups from layouts and resources.
//! Bind groups are the WebGPU mechanism for binding resources (buffers, textures, samplers)
//! to shader pipeline slots.
//!
//! This module supports:
//! - Creating samplers with configurable filtering and addressing
//! - Creating bind groups from layouts + resources
//! - Managing handles for samplers and bind groups

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use wgpu;

use super::device::{BIND_GROUP_LAYOUTS, DEVICES, TEXTURES};
use super::readback::READBACK_BUFFERS;

// ============================================================================
// Handle Generation
// ============================================================================

static NEXT_SAMPLER_HANDLE: AtomicU64 = AtomicU64::new(1);
static NEXT_BIND_GROUP_HANDLE: AtomicU64 = AtomicU64::new(1);
static NEXT_TEXTURE_VIEW_HANDLE: AtomicU64 = AtomicU64::new(1);
static NEXT_GPU_BUFFER_HANDLE: AtomicU64 = AtomicU64::new(1);

fn next_sampler_handle() -> u64 {
    NEXT_SAMPLER_HANDLE.fetch_add(1, Ordering::SeqCst)
}

fn next_bind_group_handle() -> u64 {
    NEXT_BIND_GROUP_HANDLE.fetch_add(1, Ordering::SeqCst)
}

fn next_texture_view_handle() -> u64 {
    NEXT_TEXTURE_VIEW_HANDLE.fetch_add(1, Ordering::SeqCst)
}

fn next_gpu_buffer_handle() -> u64 {
    NEXT_GPU_BUFFER_HANDLE.fetch_add(1, Ordering::SeqCst)
}

// ============================================================================
// Global Storage
// ============================================================================

lazy_static::lazy_static! {
    /// Storage for GPU samplers
    pub static ref SAMPLERS: RwLock<HashMap<u64, wgpu::Sampler>> = RwLock::new(HashMap::new());

    /// Storage for GPU bind groups
    pub static ref BIND_GROUPS: RwLock<HashMap<u64, wgpu::BindGroup>> = RwLock::new(HashMap::new());

    /// Storage for GPU texture views
    pub static ref TEXTURE_VIEWS: RwLock<HashMap<u64, wgpu::TextureView>> = RwLock::new(HashMap::new());

    /// Storage for GPU buffers (general purpose, not just readback)
    pub static ref GPU_BUFFERS: RwLock<HashMap<u64, wgpu::Buffer>> = RwLock::new(HashMap::new());

    /// Storage for buffer sizes
    static ref GPU_BUFFER_SIZES: RwLock<HashMap<u64, u64>> = RwLock::new(HashMap::new());
}

// ============================================================================
// Sampler Descriptor
// ============================================================================

/// Sampler descriptor for JSON parsing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SamplerDescriptor {
    /// Address mode for U coordinate (0=ClampToEdge, 1=Repeat, 2=MirrorRepeat)
    #[serde(default)]
    pub address_mode_u: u32,
    /// Address mode for V coordinate
    #[serde(default)]
    pub address_mode_v: u32,
    /// Address mode for W coordinate
    #[serde(default)]
    pub address_mode_w: u32,
    /// Magnification filter (0=Nearest, 1=Linear)
    #[serde(default = "default_filter")]
    pub mag_filter: u32,
    /// Minification filter (0=Nearest, 1=Linear)
    #[serde(default = "default_filter")]
    pub min_filter: u32,
    /// Mipmap filter (0=Nearest, 1=Linear)
    #[serde(default = "default_filter")]
    pub mipmap_filter: u32,
    /// LOD clamp minimum
    #[serde(default)]
    pub lod_min_clamp: f32,
    /// LOD clamp maximum
    #[serde(default = "default_lod_max")]
    pub lod_max_clamp: f32,
    /// Comparison function (0=Never, 1=Less, 2=Equal, 3=LessEqual, 4=Greater, 5=NotEqual, 6=GreaterEqual, 7=Always, 8=None)
    #[serde(default = "default_compare")]
    pub compare: u32,
    /// Anisotropy clamp (1-16)
    #[serde(default = "default_anisotropy")]
    pub anisotropy_clamp: u16,
}

fn default_filter() -> u32 {
    1 // Linear
}

fn default_lod_max() -> f32 {
    32.0
}

fn default_compare() -> u32 {
    8 // None
}

fn default_anisotropy() -> u16 {
    1
}

impl Default for SamplerDescriptor {
    fn default() -> Self {
        Self {
            address_mode_u: 0,
            address_mode_v: 0,
            address_mode_w: 0,
            mag_filter: 1,
            min_filter: 1,
            mipmap_filter: 1,
            lod_min_clamp: 0.0,
            lod_max_clamp: 32.0,
            compare: 8,
            anisotropy_clamp: 1u16,
        }
    }
}

fn address_mode_from_u32(mode: u32) -> wgpu::AddressMode {
    match mode {
        0 => wgpu::AddressMode::ClampToEdge,
        1 => wgpu::AddressMode::Repeat,
        2 => wgpu::AddressMode::MirrorRepeat,
        _ => wgpu::AddressMode::ClampToEdge,
    }
}

fn filter_mode_from_u32(mode: u32) -> wgpu::FilterMode {
    match mode {
        0 => wgpu::FilterMode::Nearest,
        1 => wgpu::FilterMode::Linear,
        _ => wgpu::FilterMode::Linear,
    }
}

fn compare_function_from_u32(func: u32) -> Option<wgpu::CompareFunction> {
    match func {
        0 => Some(wgpu::CompareFunction::Never),
        1 => Some(wgpu::CompareFunction::Less),
        2 => Some(wgpu::CompareFunction::Equal),
        3 => Some(wgpu::CompareFunction::LessEqual),
        4 => Some(wgpu::CompareFunction::Greater),
        5 => Some(wgpu::CompareFunction::NotEqual),
        6 => Some(wgpu::CompareFunction::GreaterEqual),
        7 => Some(wgpu::CompareFunction::Always),
        _ => None, // No comparison
    }
}

// ============================================================================
// Bind Group Entry Descriptors
// ============================================================================

/// Buffer binding entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BufferBindingEntry {
    pub handle: u64,
    #[serde(default)]
    pub offset: u64,
    /// Size of the buffer binding. If 0, uses entire buffer from offset.
    #[serde(default)]
    pub size: u64,
}

/// Bind group entry for JSON parsing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BindGroupEntry {
    /// Binding slot index
    pub binding: u32,
    /// Buffer binding (mutually exclusive with texture_view and sampler)
    #[serde(default)]
    pub buffer: Option<BufferBindingEntry>,
    /// Texture view handle (mutually exclusive with buffer and sampler)
    #[serde(default)]
    pub texture_view: Option<u64>,
    /// Sampler handle (mutually exclusive with buffer and texture_view)
    #[serde(default)]
    pub sampler: Option<u64>,
}

// ============================================================================
// GPU Buffer Creation
// ============================================================================

/// Create a GPU buffer for use in bind groups
///
/// # Arguments
/// * `device_handle` - Handle to the GPU device
/// * `size` - Size of the buffer in bytes
/// * `usage` - Buffer usage flags (as u32, see wgpu::BufferUsages)
/// * `mapped_at_creation` - Whether to map the buffer at creation
///
/// # Returns
/// Buffer handle or 0 on failure
pub fn gpu_create_buffer(device_handle: u64, size: u64, usage: u32, mapped_at_creation: bool) -> u64 {
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    let buffer = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("gpu_buffer"),
        size,
        usage: wgpu::BufferUsages::from_bits_truncate(usage),
        mapped_at_creation,
    });

    let handle = next_gpu_buffer_handle();
    GPU_BUFFERS.write().insert(handle, buffer);
    GPU_BUFFER_SIZES.write().insert(handle, size);
    handle
}

/// Destroy a GPU buffer
pub fn gpu_destroy_buffer(handle: u64) {
    GPU_BUFFERS.write().remove(&handle);
    GPU_BUFFER_SIZES.write().remove(&handle);
}

// ============================================================================
// Texture View Creation
// ============================================================================

/// Create a texture view from a texture
///
/// # Arguments
/// * `texture_handle` - Handle to the texture
/// * `descriptor_json` - JSON descriptor for the texture view (optional fields)
///
/// # Returns
/// Texture view handle or 0 on failure
pub fn gpu_create_texture_view(texture_handle: u64, descriptor_json: &str) -> u64 {
    let textures = TEXTURES.read();
    let texture = match textures.get(&texture_handle) {
        Some(t) => t,
        None => return 0,
    };

    // Parse optional descriptor
    #[derive(Debug, Deserialize, Default)]
    struct TextureViewDesc {
        #[serde(default)]
        format: Option<u32>,
        #[serde(default)]
        dimension: Option<u32>,
        #[serde(default)]
        base_mip_level: u32,
        #[serde(default = "default_mip_count")]
        mip_level_count: Option<u32>,
        #[serde(default)]
        base_array_layer: u32,
        #[serde(default = "default_array_count")]
        array_layer_count: Option<u32>,
    }

    fn default_mip_count() -> Option<u32> {
        None
    }

    fn default_array_count() -> Option<u32> {
        None
    }

    let desc: TextureViewDesc = if descriptor_json.is_empty() || descriptor_json == "{}" {
        TextureViewDesc::default()
    } else {
        serde_json::from_str(descriptor_json).unwrap_or_default()
    };

    let dimension = desc.dimension.map(|d| match d {
        0 => wgpu::TextureViewDimension::D1,
        1 => wgpu::TextureViewDimension::D2,
        2 => wgpu::TextureViewDimension::D2Array,
        3 => wgpu::TextureViewDimension::Cube,
        4 => wgpu::TextureViewDimension::CubeArray,
        5 => wgpu::TextureViewDimension::D3,
        _ => wgpu::TextureViewDimension::D2,
    });

    let texture_view = texture.create_view(&wgpu::TextureViewDescriptor {
        label: Some("texture_view"),
        format: None, // Use texture format
        dimension,
        aspect: wgpu::TextureAspect::All,
        base_mip_level: desc.base_mip_level,
        mip_level_count: desc.mip_level_count,
        base_array_layer: desc.base_array_layer,
        array_layer_count: desc.array_layer_count,
    });

    let handle = next_texture_view_handle();
    TEXTURE_VIEWS.write().insert(handle, texture_view);
    handle
}

/// Destroy a texture view
pub fn gpu_destroy_texture_view(handle: u64) {
    TEXTURE_VIEWS.write().remove(&handle);
}

// ============================================================================
// Sampler Creation
// ============================================================================

/// Create a sampler
///
/// # Arguments
/// * `device_handle` - Handle to the GPU device
/// * `descriptor_json` - JSON descriptor for the sampler
///
/// # Returns
/// Sampler handle or 0 on failure
pub fn gpu_create_sampler(device_handle: u64, descriptor_json: &str) -> u64 {
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    // Parse descriptor
    let desc: SamplerDescriptor = if descriptor_json.is_empty() || descriptor_json == "{}" {
        SamplerDescriptor::default()
    } else {
        serde_json::from_str(descriptor_json).unwrap_or_default()
    };

    let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
        label: Some("sampler"),
        address_mode_u: address_mode_from_u32(desc.address_mode_u),
        address_mode_v: address_mode_from_u32(desc.address_mode_v),
        address_mode_w: address_mode_from_u32(desc.address_mode_w),
        mag_filter: filter_mode_from_u32(desc.mag_filter),
        min_filter: filter_mode_from_u32(desc.min_filter),
        mipmap_filter: filter_mode_from_u32(desc.mipmap_filter),
        lod_min_clamp: desc.lod_min_clamp,
        lod_max_clamp: desc.lod_max_clamp,
        compare: compare_function_from_u32(desc.compare),
        anisotropy_clamp: desc.anisotropy_clamp.max(1).min(16),
        border_color: None,
    });

    let handle = next_sampler_handle();
    SAMPLERS.write().insert(handle, sampler);
    handle
}

/// Destroy a sampler
pub fn gpu_destroy_sampler(handle: u64) {
    SAMPLERS.write().remove(&handle);
}

// ============================================================================
// Bind Group Creation
// ============================================================================

/// Create a bind group
///
/// # Arguments
/// * `device_handle` - Handle to the GPU device
/// * `layout_handle` - Handle to the bind group layout
/// * `entries_json` - JSON array of bind group entries
///
/// # Returns
/// Bind group handle or 0 on failure
pub fn gpu_create_bind_group(device_handle: u64, layout_handle: u64, entries_json: &str) -> u64 {
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    let layouts = BIND_GROUP_LAYOUTS.read();
    let layout = match layouts.get(&layout_handle) {
        Some(l) => l,
        None => return 0,
    };

    // Parse entries
    let entries_desc: Vec<BindGroupEntry> = match serde_json::from_str(entries_json) {
        Ok(e) => e,
        Err(_) => {
            if entries_json.trim() == "[]" {
                Vec::new()
            } else {
                return 0;
            }
        }
    };

    // Get resource locks
    let buffers = GPU_BUFFERS.read();
    let readback_buffers = READBACK_BUFFERS.read();
    let texture_views = TEXTURE_VIEWS.read();
    let samplers = SAMPLERS.read();

    // Build entries
    let mut wgpu_entries: Vec<wgpu::BindGroupEntry> = Vec::with_capacity(entries_desc.len());

    // We need to keep references alive for the duration of bind group creation
    // Use indices to track which resources we're using
    struct ResourceRef<'a> {
        binding: u32,
        resource: wgpu::BindingResource<'a>,
    }

    let mut resource_refs: Vec<ResourceRef> = Vec::with_capacity(entries_desc.len());

    for entry in &entries_desc {
        if let Some(ref buffer_entry) = entry.buffer {
            // Try GPU_BUFFERS first, then READBACK_BUFFERS
            let buffer = buffers.get(&buffer_entry.handle)
                .or_else(|| readback_buffers.get(&buffer_entry.handle));

            if let Some(buffer) = buffer {
                let size = if buffer_entry.size == 0 {
                    None // Use entire buffer
                } else {
                    Some(std::num::NonZeroU64::new(buffer_entry.size).unwrap_or(std::num::NonZeroU64::new(1).unwrap()))
                };

                resource_refs.push(ResourceRef {
                    binding: entry.binding,
                    resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding {
                        buffer,
                        offset: buffer_entry.offset,
                        size,
                    }),
                });
            } else {
                return 0; // Buffer not found
            }
        } else if let Some(view_handle) = entry.texture_view {
            if let Some(view) = texture_views.get(&view_handle) {
                resource_refs.push(ResourceRef {
                    binding: entry.binding,
                    resource: wgpu::BindingResource::TextureView(view),
                });
            } else {
                return 0; // Texture view not found
            }
        } else if let Some(sampler_handle) = entry.sampler {
            if let Some(sampler) = samplers.get(&sampler_handle) {
                resource_refs.push(ResourceRef {
                    binding: entry.binding,
                    resource: wgpu::BindingResource::Sampler(sampler),
                });
            } else {
                return 0; // Sampler not found
            }
        }
    }

    // Convert to wgpu entries
    for resource_ref in &resource_refs {
        wgpu_entries.push(wgpu::BindGroupEntry {
            binding: resource_ref.binding,
            resource: resource_ref.resource.clone(),
        });
    }

    let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: Some("bind_group"),
        layout,
        entries: &wgpu_entries,
    });

    let handle = next_bind_group_handle();
    BIND_GROUPS.write().insert(handle, bind_group);
    handle
}

/// Destroy a bind group
pub fn gpu_destroy_bind_group(handle: u64) {
    BIND_GROUPS.write().remove(&handle);
}

// ============================================================================
// Cleanup
// ============================================================================

/// Clean up all bind group resources
pub fn gpu_cleanup_bind_groups() {
    BIND_GROUPS.write().clear();
    SAMPLERS.write().clear();
    TEXTURE_VIEWS.write().clear();
    GPU_BUFFERS.write().clear();
    GPU_BUFFER_SIZES.write().clear();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sampler_descriptor_default() {
        let desc = SamplerDescriptor::default();
        assert_eq!(desc.mag_filter, 1); // Linear
        assert_eq!(desc.min_filter, 1); // Linear
        assert_eq!(desc.address_mode_u, 0); // ClampToEdge
    }

    #[test]
    fn test_address_mode_conversion() {
        assert!(matches!(address_mode_from_u32(0), wgpu::AddressMode::ClampToEdge));
        assert!(matches!(address_mode_from_u32(1), wgpu::AddressMode::Repeat));
        assert!(matches!(address_mode_from_u32(2), wgpu::AddressMode::MirrorRepeat));
        assert!(matches!(address_mode_from_u32(99), wgpu::AddressMode::ClampToEdge));
    }

    #[test]
    fn test_filter_mode_conversion() {
        assert!(matches!(filter_mode_from_u32(0), wgpu::FilterMode::Nearest));
        assert!(matches!(filter_mode_from_u32(1), wgpu::FilterMode::Linear));
        assert!(matches!(filter_mode_from_u32(99), wgpu::FilterMode::Linear));
    }

    #[test]
    fn test_compare_function_conversion() {
        assert!(matches!(compare_function_from_u32(0), Some(wgpu::CompareFunction::Never)));
        assert!(matches!(compare_function_from_u32(1), Some(wgpu::CompareFunction::Less)));
        assert!(matches!(compare_function_from_u32(8), None));
    }

    #[test]
    fn test_bind_group_entry_parsing() {
        let json = r#"[
            {"binding": 0, "buffer": {"handle": 123, "offset": 0, "size": 80}},
            {"binding": 1, "texture_view": 456},
            {"binding": 2, "sampler": 789}
        ]"#;

        let entries: Vec<BindGroupEntry> = serde_json::from_str(json).unwrap();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].binding, 0);
        assert!(entries[0].buffer.is_some());
        assert_eq!(entries[1].binding, 1);
        assert!(entries[1].texture_view.is_some());
        assert_eq!(entries[2].binding, 2);
        assert!(entries[2].sampler.is_some());
    }
}
