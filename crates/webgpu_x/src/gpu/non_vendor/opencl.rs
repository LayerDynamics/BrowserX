use deno_bindgen::deno_bindgen;

/// OpenCL version
#[derive(Debug, Clone)]
pub struct OpenCLVersion {
    pub major: u32,
    pub minor: u32,
}

/// OpenCL device type
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpenCLDeviceType {
    CPU,
    GPU,
    Accelerator,
    Default,
    Custom,
    All,
}

/// OpenCL device capabilities
#[derive(Debug, Clone)]
pub struct OpenCLCapabilities {
    pub opencl_version: OpenCLVersion,
    pub device_type: OpenCLDeviceType,
    pub vendor_id: u32,
    pub max_compute_units: u32,
    pub max_work_item_dimensions: u32,
    pub max_work_group_size: u64,
    pub max_work_item_size_0: u64,
    pub max_work_item_size_1: u64,
    pub max_work_item_size_2: u64,
    pub preferred_vector_width_char: u32,
    pub preferred_vector_width_short: u32,
    pub preferred_vector_width_int: u32,
    pub preferred_vector_width_long: u32,
    pub preferred_vector_width_float: u32,
    pub preferred_vector_width_double: u32,
    pub global_mem_size: u64,
    pub local_mem_size: u64,
    pub max_constant_buffer_size: u64,
}

/// OpenCL device information
#[derive(Debug, Clone)]
pub struct OpenCLDeviceInfo {
    pub name: String,
    pub vendor: String,
    pub device_type: OpenCLDeviceType,
    pub capabilities: OpenCLCapabilities,
}

/// Get optimal OpenCL workgroup size
pub fn opencl_optimal_workgroup_size(
    device_type: OpenCLDeviceType,
    max_work_group_size: u64,
) -> u64 {
    let preferred = match device_type {
        OpenCLDeviceType::GPU => 256,
        OpenCLDeviceType::CPU => 64,
        OpenCLDeviceType::Accelerator => 128,
        _ => 64,
    };

    preferred.min(max_work_group_size)
}

/// Check if OpenCL version supports feature (returns 1 if supported, 0 otherwise)
pub fn opencl_supports_version(
    version_major: u32,
    version_minor: u32,
    required_major: u32,
    required_minor: u32,
) -> u8 {
    if version_major > required_major {
        return 1;
    }
    if version_major == required_major && version_minor >= required_minor {
        return 1;
    }
    0
}

/// Check if double precision is supported (OpenCL 1.2+, returns 1 if supported, 0 otherwise)
pub fn opencl_supports_fp64(version_major: u32, version_minor: u32) -> u8 {
    opencl_supports_version(version_major, version_minor, 1, 2)
}

/// Calculate optimal local memory usage
pub fn opencl_calculate_local_memory(
    work_group_size: u64,
    element_size: u32,
    local_mem_size: u64,
) -> u64 {
    let required = work_group_size * element_size as u64;
    required.min(local_mem_size)
}
