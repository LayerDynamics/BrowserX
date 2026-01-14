use deno_bindgen::deno_bindgen;
use std::path::Path;

/// Linux system information
#[deno_bindgen]
pub struct LinuxSystemInfo {
    pub kernel_version: String,
    pub distribution: String,
    pub cpu_brand: String,
    pub physical_cores: u32,
    pub logical_cores: u32,
    pub total_memory: u64,
}

/// Get Linux preferred backend
#[deno_bindgen]
pub fn linux_preferred_backend() -> String {
    "Vulkan".to_string()
}

/// Check if running on ARM Linux
#[deno_bindgen]
pub fn linux_is_arm() -> u8 {
    #[cfg(all(target_os = "linux", any(target_arch = "aarch64", target_arch = "arm")))]
    {
        1
    }
    #[cfg(not(all(target_os = "linux", any(target_arch = "aarch64", target_arch = "arm"))))]
    {
        0
    }
}

/// Get recommended memory allocation strategy for Linux
#[deno_bindgen]
pub fn linux_recommended_memory_strategy() -> String {
    "discrete".to_string()
}

/// Check if NVIDIA driver is available
#[deno_bindgen]
pub fn linux_has_nvidia_driver() -> u8 {
    // Check for NVIDIA device nodes
    if Path::new("/dev/nvidia0").exists()
        || Path::new("/dev/nvidiactl").exists()
        || Path::new("/proc/driver/nvidia/version").exists() { 1 } else { 0 }
}

/// Check if AMD ROCm driver is available
#[deno_bindgen]
pub fn linux_has_rocm_driver() -> u8 {
    // Check for ROCm device nodes and directories
    if Path::new("/dev/kfd").exists()
        || Path::new("/opt/rocm").exists()
        || Path::new("/sys/class/kfd").exists() { 1 } else { 0 }
}

/// Check if Intel GPU is available
#[deno_bindgen]
pub fn linux_has_intel_gpu() -> u8 {
    if Path::new("/dev/dri/renderD128").exists()
        || Path::new("/sys/class/drm/card0").exists() { 1 } else { 0 }
}

/// Get system page size
#[deno_bindgen]
pub fn linux_get_page_size() -> u64 {
    #[cfg(target_os = "linux")]
    {
        unsafe { libc::sysconf(libc::_SC_PAGESIZE) as u64 }
    }
    #[cfg(not(target_os = "linux"))]
    {
        4096
    }
}

/// Get number of CPU cores
#[deno_bindgen]
pub fn linux_get_cpu_count() -> u32 {
    #[cfg(target_os = "linux")]
    {
        unsafe { libc::sysconf(libc::_SC_NPROCESSORS_ONLN) as u32 }
    }
    #[cfg(not(target_os = "linux"))]
    {
        1
    }
}

/// Get total system memory in bytes
#[deno_bindgen]
pub fn linux_get_total_memory() -> u64 {
    #[cfg(target_os = "linux")]
    {
        unsafe {
            let pages = libc::sysconf(libc::_SC_PHYS_PAGES) as u64;
            let page_size = libc::sysconf(libc::_SC_PAGESIZE) as u64;
            pages * page_size
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        0
    }
}
