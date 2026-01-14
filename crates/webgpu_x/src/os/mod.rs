pub mod darwin;
pub mod linux;
pub mod windows;

pub use darwin::{
    darwin_is_apple_silicon, darwin_preferred_backend, darwin_recommended_memory_strategy,
    DarwinSystemInfo,
};

pub use linux::{
    linux_get_cpu_count, linux_get_page_size, linux_get_total_memory, linux_has_intel_gpu,
    linux_has_nvidia_driver, linux_has_rocm_driver, linux_is_arm, linux_preferred_backend,
    linux_recommended_memory_strategy, LinuxSystemInfo,
};

pub use windows::{
    windows_get_logical_processor_count, windows_get_page_size, windows_has_amd_driver,
    windows_has_dx12, windows_has_intel_driver, windows_has_nvidia_driver, windows_is_arm,
    windows_preferred_backend, windows_recommended_memory_strategy, WindowsSystemInfo,
};
