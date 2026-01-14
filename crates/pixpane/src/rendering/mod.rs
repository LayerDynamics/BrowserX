// Rendering module - wgpu + egui integration for pixpane
//
// This module provides GPU-accelerated rendering for windows:
// - wgpu backend for texture rendering (web content pixels)
// - egui integration for immediate-mode UI (browser chrome)
// - Compositing of both layers

pub mod wgpu_state;
pub mod texture;
pub mod renderer;
pub mod shaders;
pub mod egui_state;

pub use wgpu_state::RenderState;
pub use texture::ContentTexture;
pub use renderer::render_frame;
pub use egui_state::EguiState;
