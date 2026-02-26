pub mod bind_group;
pub mod detection;
pub mod device;
pub mod limits;
pub mod pipeline;
pub mod readback;
pub mod vendors;
pub mod non_vendor;

pub use detection::{detect_gpu_vendor, get_optimal_workgroup_size, GPUCapabilities, GPUInfo, GPUVendor};
pub use device::{
    gpu_init, gpu_request_adapter, gpu_request_device,
    gpu_create_bind_group_layout, gpu_create_empty_bind_group_layout,
    gpu_create_pipeline_layout, gpu_create_empty_pipeline_layout,
    gpu_create_texture,
    gpu_destroy_bind_group_layout, gpu_destroy_pipeline_layout, gpu_destroy_texture,
    gpu_destroy_device, gpu_destroy_adapter, gpu_cleanup_all,
};
pub use limits::{
    validate_bind_group_count, validate_buffer_size, validate_inter_stage_variables,
    validate_texture_dimensions, validate_workgroup_size, DeviceLimits, ValidationResult,
};
pub use readback::{
    gpu_create_readback_buffer, gpu_copy_texture_to_buffer,
    gpu_map_and_read_buffer, gpu_destroy_readback_buffer,
    gpu_cleanup_readback_buffers, calculate_aligned_bytes_per_row,
    calculate_readback_buffer_size,
};
pub use pipeline::{
    gpu_create_shader_module, gpu_destroy_shader_module,
    gpu_create_render_pipeline, gpu_create_render_pipeline_async,
    gpu_destroy_render_pipeline,
    gpu_create_compute_pipeline, gpu_create_compute_pipeline_async,
    gpu_destroy_compute_pipeline,
    gpu_cleanup_pipelines,
    format_from_code,
};
pub use bind_group::{
    gpu_create_sampler, gpu_destroy_sampler,
    gpu_create_bind_group, gpu_destroy_bind_group,
    gpu_create_texture_view, gpu_destroy_texture_view,
    gpu_create_buffer, gpu_destroy_buffer,
    gpu_cleanup_bind_groups,
    SamplerDescriptor, BindGroupEntry, BufferBindingEntry,
};
