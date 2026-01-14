pub mod detection;
pub mod limits;
pub mod vendors;
pub mod non_vendor;

pub use detection::{detect_gpu_vendor, get_optimal_workgroup_size, GPUCapabilities, GPUInfo, GPUVendor};
pub use limits::{
    validate_bind_group_count, validate_buffer_size, validate_inter_stage_variables,
    validate_texture_dimensions, validate_workgroup_size, DeviceLimits, ValidationResult,
};
