// Window event types (fully serializable for deno_bindgen)

/// Window events that can be sent across the FFI boundary
///
/// All variants are fully serializable and designed to be
/// easily consumed from Deno/TypeScript.
#[derive(Debug, Clone)]
#[deno_bindgen::deno_bindgen]
#[serde(tag = "type", content = "data")]
pub enum WindowEvent {
    /// Window was resized
    Resized {
        width: u32,
        height: u32,
    },

    /// Window was moved
    Moved {
        x: i32,
        y: i32,
    },

    /// Window close was requested (e.g., user clicked X button)
    CloseRequested,

    /// Window was destroyed
    Destroyed,

    /// Window focus changed
    Focused {
        focused: bool,
    },

    /// Keyboard input event
    KeyboardInput {
        key: String,
        pressed: bool,
    },

    /// Mouse button event
    MouseInput {
        button: String,
        pressed: bool,
    },

    /// Mouse cursor moved
    MouseMoved {
        x: f64,
        y: f64,
    },

    /// Mouse wheel scrolled
    MouseWheel {
        delta_x: f32,
        delta_y: f32,
    },

    /// Cursor entered window
    CursorEntered,

    /// Cursor left window
    CursorLeft,

    /// Window needs to be redrawn
    RedrawRequested,

    /// DPI scale factor changed
    ScaleFactorChanged {
        scale_factor: f64,
    },

    /// Theme changed (light/dark mode)
    ThemeChanged {
        theme: String,
    },
}

/// Event container with window ID
///
/// This wraps a WindowEvent with the window ID that generated it,
/// allowing the Deno side to know which window the event came from.
#[derive(Debug, Clone)]
#[deno_bindgen::deno_bindgen]
pub struct Event {
    /// The ID of the window that generated this event
    pub window_id: u64,

    /// The event itself
    pub event: WindowEvent,
}

impl Event {
    /// Create a new event for a specific window
    pub fn new(window_id: u64, event: WindowEvent) -> Self {
        Self { window_id, event }
    }
}
