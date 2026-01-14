use deno_bindgen::deno_bindgen;
use serde::{Deserialize, Serialize};

/// Browser WebGPU support information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebGPUSupportInfo {
    pub supported: bool,
    pub user_agent: String,
    pub platform: String,
    pub backend_type: String,
}

/// Check if running in browser environment
pub fn is_browser_environment() -> bool {
    cfg!(target_arch = "wasm32")
}

/// Get user agent string
pub fn get_user_agent() -> String {
    format!("Deno/{}", env!("CARGO_PKG_VERSION"))
}

/// Get platform string
pub fn get_platform() -> String {
    #[cfg(target_os = "windows")]
    {
        "Win32".to_string()
    }
    #[cfg(target_os = "macos")]
    {
        "MacIntel".to_string()
    }
    #[cfg(target_os = "linux")]
    {
        "Linux".to_string()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        std::env::consts::OS.to_string()
    }
}

/// Check WebGPU feature support
pub fn check_feature_support(feature_name: String) -> bool {
    match feature_name.as_str() {
        "depth-clip-control" => true,
        "depth32float-stencil8" => true,
        "texture-compression-bc" => cfg!(target_os = "windows") || cfg!(target_os = "linux"),
        "texture-compression-etc2" => !cfg!(target_os = "windows"),
        "texture-compression-astc" => cfg!(target_os = "macos") || cfg!(target_os = "ios"),
        "timestamp-query" => true,
        "indirect-first-instance" => true,
        "shader-f16" => cfg!(any(target_arch = "aarch64", target_feature = "f16c")),
        "rg11b10ufloat-renderable" => true,
        "bgra8unorm-storage" => true,
        "float32-filterable" => true,
        "clip-distances" => true,
        "dual-source-blending" => true,
        _ => false,
    }
}

/// Get WebGPU API version
pub fn get_webgpu_version() -> String {
    "1.0".to_string()
}

/// Get WGSL language version
pub fn get_wgsl_version() -> String {
    "1.0".to_string()
}

/// Check if texture format is supported
pub fn is_texture_format_supported(format: String) -> bool {
    matches!(
        format.as_str(),
        "r8unorm" | "r8snorm" | "r8uint" | "r8sint" |
        "r16uint" | "r16sint" | "r16float" |
        "rg8unorm" | "rg8snorm" | "rg8uint" | "rg8sint" |
        "r32uint" | "r32sint" | "r32float" |
        "rg16uint" | "rg16sint" | "rg16float" |
        "rgba8unorm" | "rgba8unorm-srgb" | "rgba8snorm" | "rgba8uint" | "rgba8sint" |
        "bgra8unorm" | "bgra8unorm-srgb" |
        "rgb10a2unorm" | "rg11b10ufloat" |
        "rg32uint" | "rg32sint" | "rg32float" |
        "rgba16uint" | "rgba16sint" | "rgba16float" |
        "rgba32uint" | "rgba32sint" | "rgba32float" |
        "stencil8" | "depth16unorm" | "depth24plus" | "depth24plus-stencil8" |
        "depth32float" | "depth32float-stencil8" |
        "bc1-rgba-unorm" | "bc1-rgba-unorm-srgb" |
        "bc2-rgba-unorm" | "bc2-rgba-unorm-srgb" |
        "bc3-rgba-unorm" | "bc3-rgba-unorm-srgb" |
        "bc4-r-unorm" | "bc4-r-snorm" |
        "bc5-rg-unorm" | "bc5-rg-snorm" |
        "bc6h-rgb-ufloat" | "bc6h-rgb-float" |
        "bc7-rgba-unorm" | "bc7-rgba-unorm-srgb" |
        "etc2-rgb8unorm" | "etc2-rgb8unorm-srgb" |
        "etc2-rgb8a1unorm" | "etc2-rgb8a1unorm-srgb" |
        "etc2-rgba8unorm" | "etc2-rgba8unorm-srgb" |
        "eac-r11unorm" | "eac-r11snorm" |
        "eac-rg11unorm" | "eac-rg11snorm" |
        "astc-4x4-unorm" | "astc-4x4-unorm-srgb" |
        "astc-5x4-unorm" | "astc-5x4-unorm-srgb" |
        "astc-5x5-unorm" | "astc-5x5-unorm-srgb" |
        "astc-6x5-unorm" | "astc-6x5-unorm-srgb" |
        "astc-6x6-unorm" | "astc-6x6-unorm-srgb" |
        "astc-8x5-unorm" | "astc-8x5-unorm-srgb" |
        "astc-8x6-unorm" | "astc-8x6-unorm-srgb" |
        "astc-8x8-unorm" | "astc-8x8-unorm-srgb" |
        "astc-10x5-unorm" | "astc-10x5-unorm-srgb" |
        "astc-10x6-unorm" | "astc-10x6-unorm-srgb" |
        "astc-10x8-unorm" | "astc-10x8-unorm-srgb" |
        "astc-10x10-unorm" | "astc-10x10-unorm-srgb" |
        "astc-12x10-unorm" | "astc-12x10-unorm-srgb" |
        "astc-12x12-unorm" | "astc-12x12-unorm-srgb"
    )
}

/// Get bytes per pixel for texture format
pub fn get_format_bytes_per_pixel(format: String) -> u32 {
    match format.as_str() {
        "r8unorm" | "r8snorm" | "r8uint" | "r8sint" | "stencil8" => 1,
        "r16uint" | "r16sint" | "r16float" | "rg8unorm" | "rg8snorm" | "rg8uint" | "rg8sint" | "depth16unorm" => 2,
        "r32uint" | "r32sint" | "r32float" | "rg16uint" | "rg16sint" | "rg16float" |
        "rgba8unorm" | "rgba8unorm-srgb" | "rgba8snorm" | "rgba8uint" | "rgba8sint" |
        "bgra8unorm" | "bgra8unorm-srgb" | "rgb10a2unorm" | "rg11b10ufloat" |
        "depth24plus" | "depth24plus-stencil8" | "depth32float" => 4,
        "depth32float-stencil8" | "rg32uint" | "rg32sint" | "rg32float" | "rgba16uint" | "rgba16sint" | "rgba16float" => 8,
        "rgba32uint" | "rgba32sint" | "rgba32float" => 16,
        _ if format.starts_with("bc1") => 8,
        _ if format.starts_with("bc2") | format.starts_with("bc3") | format.starts_with("bc4") | format.starts_with("bc5") | format.starts_with("bc6") | format.starts_with("bc7") => 16,
        _ if format.starts_with("etc2") | format.starts_with("eac") => 8,
        _ if format.starts_with("astc") => 16,
        _ => 0,
    }
}

/// Check if format is depth or stencil
pub fn is_depth_stencil_format(format: String) -> bool {
    matches!(
        format.as_str(),
        "stencil8" | "depth16unorm" | "depth24plus" | "depth24plus-stencil8" | "depth32float" | "depth32float-stencil8"
    )
}

/// Check if format is compressed
pub fn is_compressed_format(format: String) -> bool {
    format.starts_with("bc") || format.starts_with("etc2") || format.starts_with("eac") || format.starts_with("astc")
}

/// Get block dimensions for compressed format
pub fn get_compressed_block_dimensions(format: String) -> Vec<u32> {
    if format.starts_with("bc") || format.starts_with("etc2") || format.starts_with("eac") {
        vec![4, 4]
    } else if let Some(dims) = format.strip_prefix("astc-") {
        if let Some(x_end) = dims.find('x') {
            if let Some(y_end) = dims[x_end+1..].find('-') {
                let x_str = &dims[..x_end];
                let y_str = &dims[x_end+1..x_end+1+y_end];
                if let (Ok(x), Ok(y)) = (x_str.parse::<u32>(), y_str.parse::<u32>()) {
                    return vec![x, y];
                }
            }
        }
        vec![4, 4]
    } else {
        vec![1, 1]
    }
}

/// Calculate mip level count for texture
pub fn calculate_mip_level_count(width: u32, height: u32) -> u32 {
    let max_dim = width.max(height);
    if max_dim == 0 {
        return 1;
    }
    (32 - max_dim.leading_zeros()) as u32
}

/// Calculate texture size in bytes
pub fn calculate_texture_size(
    width: u32,
    height: u32,
    depth: u32,
    format: String,
    mip_levels: u32,
) -> u64 {
    let mut total_size = 0u64;
    let bytes_per_pixel = get_format_bytes_per_pixel(format.clone()) as u64;
    let is_compressed = is_compressed_format(format.clone());

    for mip in 0..mip_levels {
        let mip_width = (width >> mip).max(1);
        let mip_height = (height >> mip).max(1);
        let mip_depth = depth.max(1);

        if is_compressed {
            let block_dims = get_compressed_block_dimensions(format.clone());
            let block_width = block_dims[0];
            let block_height = block_dims[1];
            let blocks_wide = (mip_width + block_width - 1) / block_width;
            let blocks_high = (mip_height + block_height - 1) / block_height;
            total_size += (blocks_wide as u64) * (blocks_high as u64) * (mip_depth as u64) * bytes_per_pixel;
        } else {
            total_size += (mip_width as u64) * (mip_height as u64) * (mip_depth as u64) * bytes_per_pixel;
        }
    }

    total_size
}

/// Get texture format component count
pub fn get_format_component_count(format: String) -> u32 {
    if format.starts_with("r8") || format.starts_with("r16") || format.starts_with("r32") {
        1
    } else if format.starts_with("rg") {
        2
    } else if format.starts_with("rgb") {
        3
    } else if format.starts_with("rgba") || format.starts_with("bgra") {
        4
    } else if format.contains("depth") && format.contains("stencil") {
        2
    } else if format.contains("depth") || format.contains("stencil") {
        1
    } else {
        4
    }
}

/// Check if format supports filtering
pub fn is_filterable_format(format: String) -> bool {
    !format.contains("uint") && !format.contains("sint") && !is_depth_stencil_format(format.clone())
}

/// Check if format supports rendering
pub fn is_renderable_format(format: String) -> bool {
    !is_compressed_format(format.clone()) || format == "rg11b10ufloat"
}

/// Get format sample type
pub fn get_format_sample_type(format: String) -> String {
    if format.contains("uint") {
        "uint".to_string()
    } else if format.contains("sint") {
        "sint".to_string()
    } else if is_depth_stencil_format(format.clone()) {
        "depth".to_string()
    } else {
        "float".to_string()
    }
}
