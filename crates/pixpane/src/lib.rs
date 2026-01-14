// Pixpane: Cross-platform windowing toolkit for Deno
//
// This crate provides a Rust-based windowing system exposed to Deno
// via deno_bindgen FFI. All functionality is accessible through
// the deno_bindings module.

// Declare all modules
pub mod utils;
pub mod os;
pub mod window;
pub mod rendering;
pub mod deno_bindings;
// pub mod runtime;  // Optional for future deno_runtime integration

// Re-export key types for convenience
pub use window::{WindowConfig, WindowEvent, Event};
pub use deno_bindings::*;
