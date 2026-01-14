// Platform detection and OS abstraction

use serde::{Deserialize, Serialize};

/// Supported platforms
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Platform {
    MacOS,
    Linux,
    Windows,
}

/// Detect the current platform at compile time
pub fn detect_platform() -> Platform {
    #[cfg(target_os = "macos")]
    return Platform::MacOS;

    #[cfg(target_os = "linux")]
    return Platform::Linux;

    #[cfg(target_os = "windows")]
    return Platform::Windows;

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    compile_error!("Unsupported platform. Only macOS, Linux, and Windows are supported.");
}

/// Get the platform name as a string
pub fn platform_name() -> &'static str {
    match detect_platform() {
        Platform::MacOS => "macos",
        Platform::Linux => "linux",
        Platform::Windows => "windows",
    }
}
