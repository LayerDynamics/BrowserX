//! WebGPU Extensions for Deno
//!
//! Provides utilities and functionality not covered by Deno's native WebGPU implementation.

pub mod error;
pub mod gpu;
pub mod memory;
pub mod descriptors;
pub mod compute;
pub mod pipeline;
pub mod os;
pub mod utilities;
pub mod shader;
pub mod texture;
pub mod tensor;
pub mod framework;
pub mod web;

// All FFI bindings in one module
pub mod deno_bindings;

// Re-export main types and functions
pub use error::{
    webgpu_x_get_last_error, webgpu_x_init, webgpu_x_version, WebGPUXError, WebGPUXResult,
};

pub use gpu::detection::{
    detect_gpu_vendor, get_optimal_workgroup_size, GPUCapabilities, GPUInfo, GPUVendor,
};

pub use gpu::limits::{
    validate_bind_group_count, validate_buffer_size, validate_inter_stage_variables,
    validate_texture_dimensions, validate_workgroup_size, DeviceLimits, ValidationResult,
};

pub use memory::buffer_pool::{
    buffer_pool_acquire, buffer_pool_add, buffer_pool_clear, buffer_pool_configure,
    buffer_pool_evict, buffer_pool_release, buffer_pool_remove, buffer_pool_stats,
    BufferPoolConfig, BufferPoolStats,
};

pub use memory::buddy_allocator::{
    buddy_allocator_allocate, buddy_allocator_create, buddy_allocator_destroy,
    buddy_allocator_free, buddy_allocator_stats, Allocation, AllocatorStats,
};

pub use descriptors::validator::{
    validate_bind_group_layout_descriptor, validate_buffer_descriptor,
    validate_compute_pipeline_descriptor, validate_render_pipeline_descriptor,
    validate_texture_descriptor, DescriptorValidationResult, ValidationRule,
};

pub use compute::workgroup::{
    calculate_dispatch_size, calculate_dispatch_size_1d, calculate_dispatch_size_2d,
    calculate_workgroup_size_1d, calculate_workgroup_size_2d, calculate_workgroup_size_3d,
    round_up_to_workgroup, WorkgroupSize,
};

pub use compute::kernel::{
    create_kernel_spec, create_simple_kernel_1d, kernel_add_param, kernel_generate_wgsl,
    kernel_set_shader, simple_kernel_build, KernelParam, KernelParamType, KernelSpec,
    SimpleKernelBuilder,
};

pub use pipeline::cache::{
    hash_descriptor, pipeline_cache_clear, pipeline_cache_insert_compute,
    pipeline_cache_insert_render, pipeline_cache_lookup_compute, pipeline_cache_lookup_render,
    pipeline_cache_remove_compute, pipeline_cache_remove_render, pipeline_cache_stats,
    pipeline_cache_top_hits, PipelineCacheStats, PipelineHitInfo,
};

pub use framework::{
    create_model_matrix, create_orthographic_matrix, create_perspective_matrix,
    create_view_matrix, opengl_to_wgpu_matrix, DeviceConfig,
};
