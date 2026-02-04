pub mod detection;
pub mod device;
pub mod limits;
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
