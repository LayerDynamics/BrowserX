use deno_bindgen::deno_bindgen;
use serde::{Deserialize, Serialize};

/// GPU vendor types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GPUVendor {
    NVIDIA,
    AMD,
    Intel,
    Apple,
    Qualcomm,
    ARM,
    Unknown,
}

/// GPU information
#[derive(Debug, Clone)]
pub struct GPUInfo {
    pub vendor: GPUVendor,
    pub device_name: String,
    pub backend: String, // Vulkan, Metal, DX12, OpenGL
    pub driver_version: String,
    pub vendor_id: u32,
    pub device_id: u32,
}

/// Platform-specific GPU capabilities
#[derive(Debug, Clone)]
pub struct GPUCapabilities {
    pub max_compute_workgroup_size_x: u32,
    pub max_compute_workgroup_size_y: u32,
    pub max_compute_workgroup_size_z: u32,
    pub max_compute_invocations_per_workgroup: u32,
    pub max_compute_workgroups_per_dimension: u32,

    // Missing limits in Deno WebGPU
    pub max_bind_groups_plus_vertex_buffers: u32,
    pub max_inter_stage_shader_variables: u32,

    // Vendor-specific optimizations
    pub supports_subgroups: u8,
    pub subgroup_size: u32,
    pub supports_shader_float16: u8,
    pub supports_timestamp_queries: u8,
}

/// Detect GPU vendor from vendor ID (returns vendor as u32: 0=NVIDIA, 1=AMD, 2=Intel, 3=Apple, 4=Qualcomm, 5=ARM, 6=Unknown)
#[deno_bindgen]
pub fn detect_gpu_vendor(vendor_id: u32) -> u32 {
    match vendor_id {
        0x10DE => 0, // NVIDIA
        0x1002 | 0x1022 => 1, // AMD
        0x8086 | 0x8087 => 2, // Intel
        0x106B => 3, // Apple
        0x5143 => 4, // Qualcomm
        0x13B5 => 5, // ARM
        _ => 6, // Unknown
    }
}

/// Internal function that returns GPUVendor enum
pub(crate) fn detect_gpu_vendor_enum(vendor_id: u32) -> GPUVendor {
    match vendor_id {
        0x10DE => GPUVendor::NVIDIA,
        0x1002 | 0x1022 => GPUVendor::AMD,
        0x8086 | 0x8087 => GPUVendor::Intel,
        0x106B => GPUVendor::Apple,
        0x5143 => GPUVendor::Qualcomm,
        0x13B5 => GPUVendor::ARM,
        _ => GPUVendor::Unknown,
    }
}

/// Get optimal workgroup size for device (vendor as u32: 0=NVIDIA, 1=AMD, 2=Intel, 3=Apple, 4=Qualcomm, 5=ARM, 6=Unknown)
#[deno_bindgen]
pub fn get_optimal_workgroup_size(
    problem_size: u32,
    max_workgroup_size: u32,
    vendor: u32,
) -> u32 {
    // Vendor-specific optimizations
    let preferred_size = match vendor {
        0 => 256,  // NVIDIA - Warp size 32, prefer multiples
        1 => 256,  // AMD - Wavefront size 64, prefer multiples
        2 => 128,  // Intel - Subgroup size 8-32
        3 => 256,  // Apple - SIMD group size 32
        _ => 64,   // Conservative default
    };

    // Clamp to device limits
    let size = preferred_size.min(max_workgroup_size);

    // Round down to power of 2
    if size == 0 {
        return 1;
    }
    let next_pow2 = size.next_power_of_two();
    if next_pow2 == size {
        size
    } else {
        next_pow2 / 2
    }
}
