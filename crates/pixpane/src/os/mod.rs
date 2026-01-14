// Operating system abstractions and platform detection

pub mod osdetect;

// Platform-specific modules (conditionally compiled)
#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "linux")]
pub mod linux;

#[cfg(target_os = "windows")]
pub mod windows;

// Re-export common types
pub use osdetect::{Platform, detect_platform, platform_name};
