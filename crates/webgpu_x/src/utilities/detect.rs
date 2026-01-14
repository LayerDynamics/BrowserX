use deno_bindgen::deno_bindgen;
use serde::{Deserialize, Serialize};
use crate::gpu::detection::GPUVendor;

/// Detected GPU backend
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DetectedBackend {
    Vulkan,
    Metal,
    DX12,
    DX11,
    OpenGL,
    WebGPU,
    Unknown,
}

/// Complete system GPU detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemGPUDetection {
    pub vendor: GPUVendor,
    pub vendor_id: u32,
    pub device_id: u32,
    pub backend: DetectedBackend,
    pub device_name: String,
    pub driver_info: String,
}

/// Detect current operating system
pub fn detect_os() -> String {
    #[cfg(target_os = "windows")]
    {
        "windows".to_string()
    }
    #[cfg(target_os = "macos")]
    {
        "darwin".to_string()
    }
    #[cfg(target_os = "linux")]
    {
        "linux".to_string()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        "unknown".to_string()
    }
}

/// Detect CPU architecture
pub fn detect_architecture() -> String {
    #[cfg(target_arch = "x86_64")]
    {
        "x86_64".to_string()
    }
    #[cfg(target_arch = "aarch64")]
    {
        "aarch64".to_string()
    }
    #[cfg(target_arch = "arm")]
    {
        "arm".to_string()
    }
    #[cfg(target_arch = "x86")]
    {
        "x86".to_string()
    }
    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64", target_arch = "arm", target_arch = "x86")))]
    {
        "unknown".to_string()
    }
}

/// Detect preferred GPU backend for current platform
pub fn detect_preferred_backend() -> DetectedBackend {
    #[cfg(target_os = "windows")]
    {
        DetectedBackend::DX12
    }
    #[cfg(target_os = "macos")]
    {
        DetectedBackend::Metal
    }
    #[cfg(target_os = "linux")]
    {
        DetectedBackend::Vulkan
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        DetectedBackend::WebGPU
    }
}

/// Check if running on mobile platform
pub fn is_mobile_platform() -> bool {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        true
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        false
    }
}

/// Check if running on desktop platform
pub fn is_desktop_platform() -> bool {
    !is_mobile_platform()
}

/// Get number of available CPU threads
pub fn detect_cpu_thread_count() -> u32 {
    std::thread::available_parallelism()
        .map(|n| n.get() as u32)
        .unwrap_or(1)
}

/// Detect if system supports SIMD operations
pub fn detect_simd_support() -> bool {
    #[cfg(target_arch = "x86_64")]
    {
        is_x86_feature_detected!("avx2") || is_x86_feature_detected!("sse4.2")
    }
    #[cfg(target_arch = "aarch64")]
    {
        true // ARM64 always has NEON
    }
    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    {
        false
    }
}

/// Detect available vector instruction sets
pub fn detect_vector_instructions() -> Vec<String> {
    let mut instructions = Vec::new();

    #[cfg(target_arch = "x86_64")]
    {
        if is_x86_feature_detected!("sse") {
            instructions.push("sse".to_string());
        }
        if is_x86_feature_detected!("sse2") {
            instructions.push("sse2".to_string());
        }
        if is_x86_feature_detected!("sse3") {
            instructions.push("sse3".to_string());
        }
        if is_x86_feature_detected!("ssse3") {
            instructions.push("ssse3".to_string());
        }
        if is_x86_feature_detected!("sse4.1") {
            instructions.push("sse4.1".to_string());
        }
        if is_x86_feature_detected!("sse4.2") {
            instructions.push("sse4.2".to_string());
        }
        if is_x86_feature_detected!("avx") {
            instructions.push("avx".to_string());
        }
        if is_x86_feature_detected!("avx2") {
            instructions.push("avx2".to_string());
        }
        if is_x86_feature_detected!("fma") {
            instructions.push("fma".to_string());
        }
    }

    #[cfg(target_arch = "aarch64")]
    {
        instructions.push("neon".to_string());
    }

    instructions
}

/// Detect endianness
pub fn detect_endianness() -> String {
    #[cfg(target_endian = "little")]
    {
        "little".to_string()
    }
    #[cfg(target_endian = "big")]
    {
        "big".to_string()
    }
}

/// Detect pointer size in bytes
pub fn detect_pointer_size() -> u32 {
    std::mem::size_of::<usize>() as u32
}
