use deno_bindgen::deno_bindgen;

/// macOS system information
#[deno_bindgen]
pub struct DarwinSystemInfo {
    pub os_version: String,
    pub kernel_version: String,
    pub cpu_brand: String,
    pub physical_cores: u32,
    pub logical_cores: u32,
    pub total_memory: u64,
}

/// Get macOS Metal backend preference
#[deno_bindgen]
pub fn darwin_preferred_backend() -> String {
    "Metal".to_string()
}

/// Check if running on Apple Silicon
#[deno_bindgen]
pub fn darwin_is_apple_silicon() -> u8 {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        1
    }
    #[cfg(not(all(target_os = "macos", target_arch = "aarch64")))]
    {
        0
    }
}

/// Get recommended memory allocation strategy for macOS
#[deno_bindgen]
pub fn darwin_recommended_memory_strategy() -> String {
    if darwin_is_apple_silicon() != 0 {
        // Unified memory on Apple Silicon
        "unified".to_string()
    } else {
        // Discrete memory on Intel Macs
        "discrete".to_string()
    }
}
