// Window builder pattern for creating windows

use super::base::{Window, WindowConfig};
use winit::event_loop::ActiveEventLoop;
use winit::window::WindowAttributes;
use crate::utils::hash_id;

/// Builder for creating windows
///
/// This takes a WindowConfig and converts it into the appropriate
/// winit WindowAttributes, then builds the actual window.
pub struct WindowBuilder {
    config: WindowConfig,
}

impl WindowBuilder {
    /// Create a new WindowBuilder with default configuration
    pub fn new() -> Self {
        Self {
            config: WindowConfig::default(),
        }
    }

    /// Create a WindowBuilder from an existing WindowConfig
    pub fn from_config(config: WindowConfig) -> Self {
        Self { config }
    }

    /// Build the window using the active event loop
    ///
    /// This creates the actual winit window and wraps it in our Window struct
    /// with a unique ID.
    pub fn build(self, event_loop: &ActiveEventLoop) -> Result<Window, String> {
        // Create winit window attributes
        let mut attributes = WindowAttributes::default()
            .with_title(&self.config.title)
            .with_inner_size(winit::dpi::LogicalSize::new(
                self.config.width,
                self.config.height,
            ))
            .with_resizable(self.config.resizable)
            .with_decorations(self.config.decorations)
            .with_transparent(self.config.transparent)
            .with_window_level(if self.config.always_on_top {
                winit::window::WindowLevel::AlwaysOnTop
            } else {
                winit::window::WindowLevel::Normal
            })
            .with_maximized(self.config.maximized)
            .with_visible(self.config.visible);

        // Set minimum size if both width and height are specified
        if let (Some(min_width), Some(min_height)) =
            (self.config.min_width, self.config.min_height)
        {
            attributes = attributes
                .with_min_inner_size(winit::dpi::LogicalSize::new(min_width, min_height));
        }

        // Set maximum size if both width and height are specified
        if let (Some(max_width), Some(max_height)) =
            (self.config.max_width, self.config.max_height)
        {
            attributes = attributes
                .with_max_inner_size(winit::dpi::LogicalSize::new(max_width, max_height));
        }

        // Build the window
        let winit_window = event_loop
            .create_window(attributes)
            .map_err(|e| format!("Failed to create window: {}", e))?;

        // Generate a unique ID for the window
        let id = hash_id(&winit_window.id());

        // Initialize render state
        let render_state = match crate::rendering::RenderState::new(&winit_window) {
            Ok(state) => Some(state),
            Err(e) => {
                eprintln!("Warning: Failed to initialize rendering: {}", e);
                None
            }
        };

        Ok(Window {
            id,
            inner: winit_window,
            render_state,
        })
    }
}

impl Default for WindowBuilder {
    fn default() -> Self {
        Self::new()
    }
}
