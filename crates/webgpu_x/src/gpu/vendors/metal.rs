use deno_bindgen::deno_bindgen;

/// Metal GPU family
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MetalFamily {
    Apple1,
    Apple2,
    Apple3,
    Apple4,
    Apple5,
    Apple6,
    Apple7,
    Apple8,
    Apple9,
    Mac1,
    Mac2,
    Unknown,
}

/// Metal-specific GPU capabilities
#[derive(Debug, Clone)]
pub struct MetalCapabilities {
    pub family: MetalFamily,
    pub simd_group_size: u32,
    pub max_threads_per_threadgroup: u32,
    pub max_threadgroups_per_grid: u32,
    pub max_buffer_length: u64,
    pub supports_tier2_argument_buffers: u8,
    pub supports_raytracing: u8,
    pub supports_function_pointers: u8,
}

/// Metal device information
#[derive(Debug, Clone)]
pub struct MetalDeviceInfo {
    pub name: String,
    pub registry_id: u64,
    pub family: MetalFamily,
    pub capabilities: MetalCapabilities,
    pub recommended_max_working_set_size: u64,
}

/// Get optimal Metal workgroup size (family as u32: 0-9=Apple1-9, 10=Mac1, 11=Mac2, 12=Unknown)
#[deno_bindgen]
pub fn metal_optimal_workgroup_size(family: u32) -> u32 {
    // SIMD group size is typically 32 on Apple GPUs
    let simd_size = 32u32;

    match family {
        0 | 1 => simd_size * 4,  // Apple1-2: 128
        2 | 3 => simd_size * 8,  // Apple3-4: 256
        4 | 5 => simd_size * 8,  // Apple5-6: 256
        6 | 7 => simd_size * 8,  // Apple7-8: 256
        8 => simd_size * 8,      // Apple9: 256
        9 | 10 => simd_size * 8, // Mac1-2: 256
        _ => simd_size * 4,      // Unknown: Conservative 128
    }
}

/// Check if Metal family supports raytracing (family as u32: 0-9=Apple1-9, 10=Mac1, 11=Mac2, 12=Unknown; returns 1 if supported, 0 otherwise)
#[deno_bindgen]
pub fn metal_supports_raytracing(family: u32) -> u8 {
    // Apple6-9 (5-8) and Mac2 (11) support raytracing
    if matches!(family, 5 | 6 | 7 | 8 | 11) { 1 } else { 0 }
}

/// Check if Metal family supports tier 2 argument buffers (family as u32: 0-9=Apple1-9, 10=Mac1, 11=Mac2, 12=Unknown; returns 1 if supported, 0 otherwise)
#[deno_bindgen]
pub fn metal_supports_tier2_argument_buffers(family: u32) -> u8 {
    // Apple4-9 (3-8) and Mac2 (11) support tier 2 argument buffers
    if matches!(family, 3 | 4 | 5 | 6 | 7 | 8 | 11) { 1 } else { 0 }
}

/// Get Metal SIMD group size (family as u32: 0-9=Apple1-9, 10=Mac1, 11=Mac2, 12=Unknown)
#[deno_bindgen]
pub fn metal_simd_group_size(family: u32) -> u32 {
    // Apple GPUs typically have SIMD width of 32
    32
}

/// Get maximum threadgroup memory for Metal family (family as u32: 0-9=Apple1-9, 10=Mac1, 11=Mac2, 12=Unknown)
#[deno_bindgen]
pub fn metal_max_threadgroup_memory(family: u32) -> u64 {
    match family {
        0 | 1 => 16 * 1024,  // Apple1-2: 16 KB
        2 => 32 * 1024,      // Apple3: 32 KB
        3 | 4 => 32 * 1024,  // Apple4-5: 32 KB
        5 | 6 => 64 * 1024,  // Apple6-7: 64 KB
        7 | 8 => 64 * 1024,  // Apple8-9: 64 KB
        9 => 32 * 1024,      // Mac1: 32 KB
        10 => 64 * 1024,     // Mac2: 64 KB
        _ => 16 * 1024,      // Unknown: Conservative 16 KB
    }
}
