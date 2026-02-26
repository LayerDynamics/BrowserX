//! GPU Device Management
//!
//! Provides direct GPU device operations using wgpu, bypassing Deno's WebGPU FFI
//! which has issues with empty array serialization.
//!
//! This module manages GPU adapters, devices, and their associated objects
//! (bind group layouts, pipeline layouts, textures) using handle-based access.

use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use wgpu;

// ============================================================================
// Handle Generation
// ============================================================================

static NEXT_ADAPTER_HANDLE: AtomicU64 = AtomicU64::new(1);
static NEXT_DEVICE_HANDLE: AtomicU64 = AtomicU64::new(1);
static NEXT_BIND_GROUP_LAYOUT_HANDLE: AtomicU64 = AtomicU64::new(1);
static NEXT_PIPELINE_LAYOUT_HANDLE: AtomicU64 = AtomicU64::new(1);
static NEXT_TEXTURE_HANDLE: AtomicU64 = AtomicU64::new(1);

fn next_adapter_handle() -> u64 {
    NEXT_ADAPTER_HANDLE.fetch_add(1, Ordering::SeqCst)
}

fn next_device_handle() -> u64 {
    NEXT_DEVICE_HANDLE.fetch_add(1, Ordering::SeqCst)
}

fn next_bind_group_layout_handle() -> u64 {
    NEXT_BIND_GROUP_LAYOUT_HANDLE.fetch_add(1, Ordering::SeqCst)
}

fn next_pipeline_layout_handle() -> u64 {
    NEXT_PIPELINE_LAYOUT_HANDLE.fetch_add(1, Ordering::SeqCst)
}

fn next_texture_handle() -> u64 {
    NEXT_TEXTURE_HANDLE.fetch_add(1, Ordering::SeqCst)
}

// ============================================================================
// Global Storage
// ============================================================================

lazy_static::lazy_static! {
    static ref INSTANCE: RwLock<Option<wgpu::Instance>> = RwLock::new(None);
    static ref ADAPTERS: RwLock<HashMap<u64, wgpu::Adapter>> = RwLock::new(HashMap::new());
    /// Storage for GPU devices and their queues (accessible to readback and bind_group modules)
    pub static ref DEVICES: RwLock<HashMap<u64, (wgpu::Device, wgpu::Queue)>> = RwLock::new(HashMap::new());
    /// Storage for bind group layouts (accessible to bind_group module)
    pub static ref BIND_GROUP_LAYOUTS: RwLock<HashMap<u64, wgpu::BindGroupLayout>> = RwLock::new(HashMap::new());
    pub static ref PIPELINE_LAYOUTS: RwLock<HashMap<u64, wgpu::PipelineLayout>> = RwLock::new(HashMap::new());
    /// Storage for GPU textures (accessible to readback and bind_group modules)
    pub static ref TEXTURES: RwLock<HashMap<u64, wgpu::Texture>> = RwLock::new(HashMap::new());
}

// ============================================================================
// Initialization
// ============================================================================

/// Initialize the wgpu instance
/// Returns 1 on success, 0 on failure
pub fn gpu_init() -> u8 {
    let mut instance = INSTANCE.write();
    if instance.is_none() {
        *instance = Some(wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        }));
    }
    1
}

/// Request a GPU adapter
/// Returns adapter handle or 0 on failure
pub fn gpu_request_adapter(power_preference: u32) -> u64 {
    let power_pref = match power_preference {
        0 => wgpu::PowerPreference::None,
        1 => wgpu::PowerPreference::LowPower,
        2 => wgpu::PowerPreference::HighPerformance,
        _ => wgpu::PowerPreference::None,
    };

    // Acquire read lock, call request_adapter, and drop lock before inserting
    let adapter = {
        let guard = INSTANCE.read();
        let instance = match guard.as_ref() {
            Some(i) => i,
            None => return 0,
        };

        pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: power_pref,
            compatible_surface: None,
            force_fallback_adapter: false,
        }))
    };

    match adapter {
        Some(adapter) => {
            let handle = next_adapter_handle();
            ADAPTERS.write().insert(handle, adapter);
            handle
        }
        None => 0,
    }
}

/// Request a device from an adapter
/// Returns device handle or 0 on failure
pub fn gpu_request_device(adapter_handle: u64) -> u64 {
    let adapters = ADAPTERS.read();
    let adapter = match adapters.get(&adapter_handle) {
        Some(a) => a,
        None => return 0,
    };

    let result = pollster::block_on(adapter.request_device(
        &wgpu::DeviceDescriptor {
            label: Some("webgpu_x device"),
            required_features: wgpu::Features::empty(),
            required_limits: wgpu::Limits::default(),
            memory_hints: wgpu::MemoryHints::default(),
        },
        None,
    ));

    match result {
        Ok((device, queue)) => {
            let handle = next_device_handle();
            DEVICES.write().insert(handle, (device, queue));
            handle
        }
        Err(_) => 0,
    }
}

// ============================================================================
// Bind Group Layout
// ============================================================================

/// Bind group layout entry for FFI
#[derive(Debug, Clone)]
pub struct BindGroupLayoutEntryDesc {
    pub binding: u32,
    pub visibility: u32,
    pub ty: u32,           // 0=Buffer, 1=Sampler, 2=Texture, 3=StorageTexture
    pub buffer_type: u32,  // 0=Uniform, 1=Storage, 2=ReadOnlyStorage
    pub has_dynamic_offset: bool,
    pub min_binding_size: u64,
    pub sampler_type: u32,        // 0=Filtering, 1=NonFiltering, 2=Comparison
    pub texture_sample_type: u32, // 0=Float, 1=UnfilterableFloat, 2=Depth, 3=Sint, 4=Uint
    pub texture_view_dimension: u32, // 0=D1, 1=D2, 2=D2Array, 3=Cube, 4=CubeArray, 5=D3
    pub texture_multisampled: bool,
    pub storage_format: u32,      // wgpu TextureFormat as u32
    pub storage_access: u32,      // 0=ReadOnly, 1=WriteOnly, 2=ReadWrite
}

impl Default for BindGroupLayoutEntryDesc {
    fn default() -> Self {
        Self {
            binding: 0,
            visibility: 0,
            ty: 0,
            buffer_type: 0,
            has_dynamic_offset: false,
            min_binding_size: 0,
            sampler_type: 0,
            texture_sample_type: 0,
            texture_view_dimension: 1, // D2 default
            texture_multisampled: false,
            storage_format: 0,
            storage_access: 0,
        }
    }
}

fn visibility_from_u32(v: u32) -> wgpu::ShaderStages {
    let mut stages = wgpu::ShaderStages::empty();
    if v & 1 != 0 {
        stages |= wgpu::ShaderStages::VERTEX;
    }
    if v & 2 != 0 {
        stages |= wgpu::ShaderStages::FRAGMENT;
    }
    if v & 4 != 0 {
        stages |= wgpu::ShaderStages::COMPUTE;
    }
    stages
}

fn convert_entry(desc: &BindGroupLayoutEntryDesc) -> wgpu::BindGroupLayoutEntry {
    let visibility = visibility_from_u32(desc.visibility);

    let ty = match desc.ty {
        0 => {
            // Buffer
            let buffer_type = match desc.buffer_type {
                0 => wgpu::BufferBindingType::Uniform,
                1 => wgpu::BufferBindingType::Storage { read_only: false },
                2 => wgpu::BufferBindingType::Storage { read_only: true },
                _ => wgpu::BufferBindingType::Uniform,
            };
            wgpu::BindingType::Buffer {
                ty: buffer_type,
                has_dynamic_offset: desc.has_dynamic_offset,
                min_binding_size: if desc.min_binding_size > 0 {
                    std::num::NonZeroU64::new(desc.min_binding_size)
                } else {
                    None
                },
            }
        }
        1 => {
            // Sampler
            let sampler_type = match desc.sampler_type {
                0 => wgpu::SamplerBindingType::Filtering,
                1 => wgpu::SamplerBindingType::NonFiltering,
                2 => wgpu::SamplerBindingType::Comparison,
                _ => wgpu::SamplerBindingType::Filtering,
            };
            wgpu::BindingType::Sampler(sampler_type)
        }
        2 => {
            // Texture
            let sample_type = match desc.texture_sample_type {
                0 => wgpu::TextureSampleType::Float { filterable: true },
                1 => wgpu::TextureSampleType::Float { filterable: false },
                2 => wgpu::TextureSampleType::Depth,
                3 => wgpu::TextureSampleType::Sint,
                4 => wgpu::TextureSampleType::Uint,
                _ => wgpu::TextureSampleType::Float { filterable: true },
            };
            let view_dimension = match desc.texture_view_dimension {
                0 => wgpu::TextureViewDimension::D1,
                1 => wgpu::TextureViewDimension::D2,
                2 => wgpu::TextureViewDimension::D2Array,
                3 => wgpu::TextureViewDimension::Cube,
                4 => wgpu::TextureViewDimension::CubeArray,
                5 => wgpu::TextureViewDimension::D3,
                _ => wgpu::TextureViewDimension::D2,
            };
            wgpu::BindingType::Texture {
                sample_type,
                view_dimension,
                multisampled: desc.texture_multisampled,
            }
        }
        3 => {
            // StorageTexture
            let access = match desc.storage_access {
                0 => wgpu::StorageTextureAccess::ReadOnly,
                1 => wgpu::StorageTextureAccess::WriteOnly,
                2 => wgpu::StorageTextureAccess::ReadWrite,
                _ => wgpu::StorageTextureAccess::WriteOnly,
            };
            let view_dimension = match desc.texture_view_dimension {
                0 => wgpu::TextureViewDimension::D1,
                1 => wgpu::TextureViewDimension::D2,
                2 => wgpu::TextureViewDimension::D2Array,
                3 => wgpu::TextureViewDimension::Cube,
                4 => wgpu::TextureViewDimension::CubeArray,
                5 => wgpu::TextureViewDimension::D3,
                _ => wgpu::TextureViewDimension::D2,
            };
            let format = match desc.storage_format {
                0 => wgpu::TextureFormat::Rgba8Unorm,
                1 => wgpu::TextureFormat::Rgba8Snorm,
                2 => wgpu::TextureFormat::Rgba8Uint,
                3 => wgpu::TextureFormat::Rgba8Sint,
                4 => wgpu::TextureFormat::Rgba16Float,
                5 => wgpu::TextureFormat::Rgba32Float,
                6 => wgpu::TextureFormat::Rgba32Uint,
                7 => wgpu::TextureFormat::Rgba32Sint,
                8 => wgpu::TextureFormat::R32Float,
                9 => wgpu::TextureFormat::R32Uint,
                10 => wgpu::TextureFormat::R32Sint,
                11 => wgpu::TextureFormat::Rg32Float,
                12 => wgpu::TextureFormat::Rg32Uint,
                13 => wgpu::TextureFormat::Rg32Sint,
                14 => wgpu::TextureFormat::Bgra8Unorm,
                _ => wgpu::TextureFormat::Rgba8Unorm,
            };
            wgpu::BindingType::StorageTexture {
                access,
                format,
                view_dimension,
            }
        }
        _ => wgpu::BindingType::Buffer {
            ty: wgpu::BufferBindingType::Uniform,
            has_dynamic_offset: false,
            min_binding_size: None,
        },
    };

    wgpu::BindGroupLayoutEntry {
        binding: desc.binding,
        visibility,
        ty,
        count: None,
    }
}

/// Create a bind group layout
/// entries_json: JSON array of BindGroupLayoutEntryDesc, can be empty "[]"
/// Returns handle or 0 on failure
pub fn gpu_create_bind_group_layout(device_handle: u64, label: &str, entries_json: &str) -> u64 {
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    // Parse entries - empty array is valid
    let entries_desc: Vec<BindGroupLayoutEntryDesc> = match serde_json::from_str(entries_json) {
        Ok(e) => e,
        Err(_) => {
            // If parsing fails, try empty array
            if entries_json.trim() == "[]" {
                Vec::new()
            } else {
                return 0;
            }
        }
    };

    // Convert to wgpu entries
    let entries: Vec<wgpu::BindGroupLayoutEntry> = entries_desc.iter().map(convert_entry).collect();

    let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: if label.is_empty() { None } else { Some(label) },
        entries: &entries,
    });

    let handle = next_bind_group_layout_handle();
    BIND_GROUP_LAYOUTS.write().insert(handle, bind_group_layout);
    handle
}

/// Create a bind group layout with empty entries (common case)
/// Returns handle or 0 on failure
pub fn gpu_create_empty_bind_group_layout(device_handle: u64, label: &str) -> u64 {
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: if label.is_empty() { None } else { Some(label) },
        entries: &[], // Empty entries - wgpu handles this correctly
    });

    let handle = next_bind_group_layout_handle();
    BIND_GROUP_LAYOUTS.write().insert(handle, bind_group_layout);
    handle
}

// ============================================================================
// Pipeline Layout
// ============================================================================

/// Create a pipeline layout
/// bind_group_layout_handles_json: JSON array of u64 handles, can be empty "[]"
/// Returns handle or 0 on failure
pub fn gpu_create_pipeline_layout(
    device_handle: u64,
    label: &str,
    bind_group_layout_handles_json: &str,
) -> u64 {
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    // Parse handles
    let handles: Vec<u64> = match serde_json::from_str(bind_group_layout_handles_json) {
        Ok(h) => h,
        Err(_) => {
            if bind_group_layout_handles_json.trim() == "[]" {
                Vec::new()
            } else {
                return 0;
            }
        }
    };

    // Get bind group layouts
    let layouts_guard = BIND_GROUP_LAYOUTS.read();
    let mut layouts: Vec<&wgpu::BindGroupLayout> = Vec::with_capacity(handles.len());
    for handle in &handles {
        match layouts_guard.get(handle) {
            Some(l) => layouts.push(l),
            None => return 0,
        }
    }

    let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: if label.is_empty() { None } else { Some(label) },
        bind_group_layouts: &layouts,
        push_constant_ranges: &[],
    });

    let handle = next_pipeline_layout_handle();
    PIPELINE_LAYOUTS.write().insert(handle, pipeline_layout);
    handle
}

/// Create a pipeline layout with empty bind group layouts
/// Returns handle or 0 on failure
pub fn gpu_create_empty_pipeline_layout(device_handle: u64, label: &str) -> u64 {
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: if label.is_empty() { None } else { Some(label) },
        bind_group_layouts: &[], // Empty - wgpu handles this correctly
        push_constant_ranges: &[],
    });

    let handle = next_pipeline_layout_handle();
    PIPELINE_LAYOUTS.write().insert(handle, pipeline_layout);
    handle
}

// ============================================================================
// Texture
// ============================================================================

/// Create a texture
/// view_formats_json: JSON array of format strings, can be empty "[]"
/// Returns handle or 0 on failure
pub fn gpu_create_texture(
    device_handle: u64,
    label: &str,
    width: u32,
    height: u32,
    depth_or_array_layers: u32,
    mip_level_count: u32,
    sample_count: u32,
    dimension: u32,        // 0=D1, 1=D2, 2=D3
    format: u32,           // TextureFormat as u32
    usage: u32,            // TextureUsages as u32
    view_formats_json: &str,
) -> u64 {
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    let dimension = match dimension {
        0 => wgpu::TextureDimension::D1,
        1 => wgpu::TextureDimension::D2,
        2 => wgpu::TextureDimension::D3,
        _ => wgpu::TextureDimension::D2,
    };

    // Convert format - simplified, add more as needed
    let format = match format {
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
    };

    let usage = wgpu::TextureUsages::from_bits_truncate(usage);

    // Parse view formats - empty is valid
    let _view_formats: Vec<String> = match serde_json::from_str(view_formats_json) {
        Ok(f) => f,
        Err(_) => Vec::new(),
    };

    // For now, we don't use view_formats since wgpu handles the default well
    // This can be extended to convert string formats to wgpu::TextureFormat

    let texture = device.create_texture(&wgpu::TextureDescriptor {
        label: if label.is_empty() { None } else { Some(label) },
        size: wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers,
        },
        mip_level_count,
        sample_count,
        dimension,
        format,
        usage,
        view_formats: &[], // Empty view formats - wgpu handles this correctly
    });

    let handle = next_texture_handle();
    TEXTURES.write().insert(handle, texture);
    handle
}

// ============================================================================
// Cleanup
// ============================================================================

/// Destroy a bind group layout
pub fn gpu_destroy_bind_group_layout(handle: u64) {
    BIND_GROUP_LAYOUTS.write().remove(&handle);
}

/// Destroy a pipeline layout
pub fn gpu_destroy_pipeline_layout(handle: u64) {
    PIPELINE_LAYOUTS.write().remove(&handle);
}

/// Destroy a texture
pub fn gpu_destroy_texture(handle: u64) {
    TEXTURES.write().remove(&handle);
}

/// Destroy a device
pub fn gpu_destroy_device(handle: u64) {
    DEVICES.write().remove(&handle);
}

/// Destroy an adapter
pub fn gpu_destroy_adapter(handle: u64) {
    ADAPTERS.write().remove(&handle);
}

/// Cleanup all resources
pub fn gpu_cleanup_all() {
    TEXTURES.write().clear();
    PIPELINE_LAYOUTS.write().clear();
    BIND_GROUP_LAYOUTS.write().clear();
    DEVICES.write().clear();
    ADAPTERS.write().clear();
}

// ============================================================================
// Serde implementations for BindGroupLayoutEntryDesc
// ============================================================================

use serde::{Deserialize, Serialize};

impl Serialize for BindGroupLayoutEntryDesc {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("BindGroupLayoutEntryDesc", 12)?;
        state.serialize_field("binding", &self.binding)?;
        state.serialize_field("visibility", &self.visibility)?;
        state.serialize_field("ty", &self.ty)?;
        state.serialize_field("buffer_type", &self.buffer_type)?;
        state.serialize_field("has_dynamic_offset", &self.has_dynamic_offset)?;
        state.serialize_field("min_binding_size", &self.min_binding_size)?;
        state.serialize_field("sampler_type", &self.sampler_type)?;
        state.serialize_field("texture_sample_type", &self.texture_sample_type)?;
        state.serialize_field("texture_view_dimension", &self.texture_view_dimension)?;
        state.serialize_field("texture_multisampled", &self.texture_multisampled)?;
        state.serialize_field("storage_format", &self.storage_format)?;
        state.serialize_field("storage_access", &self.storage_access)?;
        state.end()
    }
}

impl<'de> Deserialize<'de> for BindGroupLayoutEntryDesc {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct Helper {
            binding: u32,
            visibility: u32,
            ty: u32,
            #[serde(default)]
            buffer_type: u32,
            #[serde(default)]
            has_dynamic_offset: bool,
            #[serde(default)]
            min_binding_size: u64,
            #[serde(default)]
            sampler_type: u32,
            #[serde(default)]
            texture_sample_type: u32,
            #[serde(default = "default_view_dimension")]
            texture_view_dimension: u32,
            #[serde(default)]
            texture_multisampled: bool,
            #[serde(default)]
            storage_format: u32,
            #[serde(default)]
            storage_access: u32,
        }

        fn default_view_dimension() -> u32 {
            1 // D2
        }

        let helper = Helper::deserialize(deserializer)?;
        Ok(BindGroupLayoutEntryDesc {
            binding: helper.binding,
            visibility: helper.visibility,
            ty: helper.ty,
            buffer_type: helper.buffer_type,
            has_dynamic_offset: helper.has_dynamic_offset,
            min_binding_size: helper.min_binding_size,
            sampler_type: helper.sampler_type,
            texture_sample_type: helper.texture_sample_type,
            texture_view_dimension: helper.texture_view_dimension,
            texture_multisampled: helper.texture_multisampled,
            storage_format: helper.storage_format,
            storage_access: helper.storage_access,
        })
    }
}
