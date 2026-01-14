// Core window types and configuration

use winit::window::Window as WinitWindow;
use crate::rendering::RenderState;

/// Core window state (not directly exposed via FFI)
///
/// This wraps a winit Window and maintains additional state needed
/// for the deno_bindgen FFI layer. Windows are stored in a global
/// registry and referenced by their u64 ID.
pub struct Window {
    pub(crate) id: u64,
    pub(crate) inner: WinitWindow,
    pub(crate) render_state: Option<RenderState>,
}

impl Window {
    /// Get the window's unique ID
    pub fn id(&self) -> u64 {
        self.id
    }

    /// Get a reference to the underlying winit window
    pub fn inner(&self) -> &WinitWindow {
        &self.inner
    }

    /// Get a mutable reference to the underlying winit window
    pub fn inner_mut(&mut self) -> &mut WinitWindow {
        &mut self.inner
    }
}

/// Window configuration (deno_bindgen compatible)
///
/// This struct is fully serializable and can be passed across the
/// FFI boundary from Deno/TypeScript to Rust.
#[derive(Debug, Clone)]
#[deno_bindgen::deno_bindgen]
pub struct WindowConfig {
    /// Window title
    pub title: String,

    /// Window width in logical pixels
    pub width: u32,

    /// Window height in logical pixels
    pub height: u32,

    /// Whether the window is resizable
    pub resizable: bool,

    /// Whether the window has decorations (title bar, borders)
    pub decorations: bool,

    /// Whether the window is transparent
    pub transparent: bool,

    /// Whether the window stays on top of others
    pub always_on_top: bool,

    /// Whether the window starts maximized
    pub maximized: bool,

    /// Whether the window is visible on creation
    pub visible: bool,

    /// Minimum window width (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_width: Option<u32>,

    /// Minimum window height (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_height: Option<u32>,

    /// Maximum window width (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_width: Option<u32>,

    /// Maximum window height (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_height: Option<u32>,
}

impl Default for WindowConfig {
    fn default() -> Self {
        Self {
            title: "Pixpane Window".to_string(),
            width: 800,
            height: 600,
            resizable: true,
            decorations: true,
            transparent: false,
            always_on_top: false,
            maximized: false,
            visible: true,
            min_width: None,
            min_height: None,
            max_width: None,
            max_height: None,
        }
    }
}
