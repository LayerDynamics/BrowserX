use deno_bindgen::deno_bindgen;
use std::path::Path;

/// Windows system information
#[deno_bindgen]
pub struct WindowsSystemInfo {
    pub os_version: String,
    pub build_number: String,
    pub cpu_brand: String,
    pub physical_cores: u32,
    pub logical_cores: u32,
    pub total_memory: u64,
}

/// Get Windows preferred backend
#[deno_bindgen]
pub fn windows_preferred_backend() -> String {
    // DirectX 12 is preferred on Windows for WebGPU
    "DX12".to_string()
}

/// Check if running on ARM Windows
#[deno_bindgen]
pub fn windows_is_arm() -> u8 {
    #[cfg(all(target_os = "windows", any(target_arch = "aarch64", target_arch = "arm")))]
    {
        1
    }
    #[cfg(not(all(target_os = "windows", any(target_arch = "aarch64", target_arch = "arm"))))]
    {
        0
    }
}

/// Get recommended memory allocation strategy for Windows
#[deno_bindgen]
pub fn windows_recommended_memory_strategy() -> String {
    "discrete".to_string()
}

/// Check if NVIDIA driver is available on Windows
#[deno_bindgen]
pub fn windows_has_nvidia_driver() -> u8 {
    // Check for NVIDIA driver DLLs in System32
    if Path::new("C:\\Windows\\System32\\nvapi64.dll").exists()
        || Path::new("C:\\Windows\\System32\\DriverStore\\FileRepository").exists() { 1 } else { 0 }
}

/// Check if AMD driver is available on Windows
#[deno_bindgen]
pub fn windows_has_amd_driver() -> u8 {
    // Check for AMD driver DLLs
    if Path::new("C:\\Windows\\System32\\amdvlk64.dll").exists()
        || Path::new("C:\\Windows\\System32\\atiadlxx.dll").exists() { 1 } else { 0 }
}

/// Check if Intel GPU driver is available on Windows
#[deno_bindgen]
pub fn windows_has_intel_driver() -> u8 {
    // Check for Intel GPU driver files
    if Path::new("C:\\Windows\\System32\\DriverStore\\FileRepository").exists() { 1 } else { 0 }
}

/// Check if DirectX 12 is available
#[deno_bindgen]
pub fn windows_has_dx12() -> u8 {
    #[cfg(target_os = "windows")]
    {
        // D3D12.dll is present on Windows 10+ with DirectX 12
        if Path::new("C:\\Windows\\System32\\d3d12.dll").exists() { 1 } else { 0 }
    }
    #[cfg(not(target_os = "windows"))]
    {
        0
    }
}

/// Get Windows system page size
#[deno_bindgen]
pub fn windows_get_page_size() -> u64 {
    // Windows typically uses 4KB or 64KB pages
    4096
}

/// Get number of logical processors on Windows
#[deno_bindgen]
pub fn windows_get_logical_processor_count() -> u32 {
    std::thread::available_parallelism()
        .map(|n| n.get() as u32)
        .unwrap_or(1)
}
