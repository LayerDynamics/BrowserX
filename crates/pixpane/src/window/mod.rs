// Window management module

pub mod base;
pub mod builder;
pub mod event;
pub mod opener;
pub mod system;

// Re-export commonly used types
pub use base::{Window, WindowConfig};
pub use builder::WindowBuilder;
pub use event::{Event, WindowEvent};
pub use system::{register_window, remove_window, window_count, window_exists, with_window, with_window_mut};
