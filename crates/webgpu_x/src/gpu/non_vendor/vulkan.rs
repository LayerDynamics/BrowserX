use deno_bindgen::deno_bindgen;

/// Vulkan API version
#[derive(Debug, Clone)]
pub struct VulkanVersion {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

/// Vulkan physical device capabilities
#[derive(Debug, Clone)]
pub struct VulkanCapabilities {
    pub api_version: VulkanVersion,
    pub driver_version: u32,
    pub vendor_id: u32,
    pub device_id: u32,
    pub max_compute_workgroup_count_x: u32,
    pub max_compute_workgroup_count_y: u32,
    pub max_compute_workgroup_count_z: u32,
    pub max_compute_workgroup_size_x: u32,
    pub max_compute_workgroup_size_y: u32,
    pub max_compute_workgroup_size_z: u32,
    pub max_compute_workgroup_invocations: u32,
    pub max_memory_allocation_count: u32,
    pub max_bound_descriptor_sets: u32,
    pub subgroup_size: u32,
}

/// Vulkan device information
#[derive(Debug, Clone)]
pub struct VulkanDeviceInfo {
    pub device_name: String,
    pub device_type: String,  // discrete, integrated, virtual, cpu, other
    pub capabilities: VulkanCapabilities,
}

/// Get optimal Vulkan workgroup size based on vendor
pub fn vulkan_optimal_workgroup_size(vendor_id: u32, subgroup_size: u32) -> u32 {
    // Use subgroup size as base
    let base = if subgroup_size > 0 { subgroup_size } else { 32 };

    match vendor_id {
        0x10DE => base * 8,  // NVIDIA: prefer 256
        0x1002 | 0x1022 => base * 8,  // AMD: prefer 256
        0x8086 | 0x8087 => base * 4,  // Intel: prefer 128
        0x106B => base * 8,  // Apple: prefer 256
        _ => base * 4,  // Default: 128
    }
}

/// Check if Vulkan version supports feature (returns 1 if supported, 0 otherwise)
pub fn vulkan_supports_version(
    api_major: u32,
    api_minor: u32,
    required_major: u32,
    required_minor: u32,
) -> u8 {
    if api_major > required_major {
        return 1;
    }
    if api_major == required_major && api_minor >= required_minor {
        return 1;
    }
    0
}

/// Check if raytracing is supported (requires Vulkan 1.2+, returns 1 if supported, 0 otherwise)
pub fn vulkan_supports_raytracing(api_major: u32, api_minor: u32) -> u8 {
    vulkan_supports_version(api_major, api_minor, 1, 2)
}

/// Get recommended descriptor set count
pub fn vulkan_recommended_descriptor_sets() -> u32 {
    4  // Common limit across most devices
}
