// Deno FFI bindings - ALL window functionality exposed via deno_bindgen
//
// Error handling: Functions that can fail return success codes (0 = success, 1 = failure).
// Call get_last_error() to retrieve the error message after a failure.

use deno_bindgen::deno_bindgen;
use crate::window::{WindowConfig, Event};
use parking_lot::Mutex;
use lazy_static::lazy_static;

// ============================================================================
// ERROR HANDLING
// ============================================================================

lazy_static! {
    static ref LAST_ERROR: Mutex<Option<String>> = Mutex::new(None);
}

fn set_last_error(msg: String) {
    *LAST_ERROR.lock() = Some(msg);
}

fn clear_last_error() {
    *LAST_ERROR.lock() = None;
}

/// Get the last error message
///
/// Returns empty string if no error occurred.
#[deno_bindgen]
pub fn get_last_error() -> String {
    LAST_ERROR.lock().clone().unwrap_or_default()
}

// ============================================================================
// WINDOW CREATION
// ============================================================================

/// Create a new window with the given configuration
///
/// Returns the window ID on success, or 0 on failure.
/// Call get_last_error() to get the error message if this returns 0.
#[deno_bindgen]
pub fn create_window(config: WindowConfig) -> u64 {
    match crate::window::opener::create_window_with_event_loop(config) {
        Ok(id) => {
            clear_last_error();
            id
        }
        Err(e) => {
            set_last_error(e);
            0
        }
    }
}

// ============================================================================
// WINDOW PROPERTIES - SETTERS
// ============================================================================

/// Set the window title
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn window_set_title(window_id: u64, title: &str) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        window.inner_mut().set_title(title);
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Set the window size (inner size, logical pixels)
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn window_set_size(window_id: u64, width: u32, height: u32) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        let size = winit::dpi::LogicalSize::new(width, height);
        let _ = window.inner_mut().request_inner_size(size);
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Set the window position (outer position, physical pixels)
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn window_set_position(window_id: u64, x: i32, y: i32) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        let pos = winit::dpi::PhysicalPosition::new(x, y);
        window.inner_mut().set_outer_position(pos);
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Set whether the window is visible
///
/// Returns 0 on success, 1 on failure.
/// visible: 0 = hidden, 1 = visible
#[deno_bindgen]
pub fn window_set_visible(window_id: u64, visible: u8) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        window.inner_mut().set_visible(visible != 0);
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Set whether the window is resizable
///
/// Returns 0 on success, 1 on failure.
/// resizable: 0 = not resizable, 1 = resizable
#[deno_bindgen]
pub fn window_set_resizable(window_id: u64, resizable: u8) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        window.inner_mut().set_resizable(resizable != 0);
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Set whether the window is minimized
///
/// Returns 0 on success, 1 on failure.
/// minimized: 0 = not minimized, 1 = minimized
#[deno_bindgen]
pub fn window_set_minimized(window_id: u64, minimized: u8) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        window.inner_mut().set_minimized(minimized != 0);
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Set whether the window is maximized
///
/// Returns 0 on success, 1 on failure.
/// maximized: 0 = not maximized, 1 = maximized
#[deno_bindgen]
pub fn window_set_maximized(window_id: u64, maximized: u8) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        window.inner_mut().set_maximized(maximized != 0);
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Set whether the window is fullscreen
///
/// Returns 0 on success, 1 on failure.
/// fullscreen: 0 = windowed, 1 = fullscreen
#[deno_bindgen]
pub fn window_set_fullscreen(window_id: u64, fullscreen: u8) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        if fullscreen != 0 {
            window
                .inner_mut()
                .set_fullscreen(Some(winit::window::Fullscreen::Borderless(None)));
        } else {
            window.inner_mut().set_fullscreen(None);
        }
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Set whether the window has decorations (title bar, borders)
///
/// Returns 0 on success, 1 on failure.
/// decorations: 0 = no decorations, 1 = with decorations
#[deno_bindgen]
pub fn window_set_decorations(window_id: u64, decorations: u8) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        window.inner_mut().set_decorations(decorations != 0);
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Set whether the window stays on top of others
///
/// Returns 0 on success, 1 on failure.
/// always_on_top: 0 = normal, 1 = always on top
#[deno_bindgen]
pub fn window_set_always_on_top(window_id: u64, always_on_top: u8) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        window.inner_mut().set_window_level(if always_on_top != 0 {
            winit::window::WindowLevel::AlwaysOnTop
        } else {
            winit::window::WindowLevel::Normal
        });
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Set the minimum inner size of the window
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn window_set_min_size(window_id: u64, min_width: u32, min_height: u32) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        let size = winit::dpi::LogicalSize::new(min_width, min_height);
        window.inner_mut().set_min_inner_size(Some(size));
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Set the maximum inner size of the window
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn window_set_max_size(window_id: u64, max_width: u32, max_height: u32) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        let size = winit::dpi::LogicalSize::new(max_width, max_height);
        window.inner_mut().set_max_inner_size(Some(size));
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

// ============================================================================
// WINDOW PROPERTIES - GETTERS
// ============================================================================

/// Window size information with success flag
#[derive(Debug, Clone)]
#[deno_bindgen]
pub struct WindowSize {
    /// 0 = failure, 1 = success
    pub success: u8,
    pub width: u32,
    pub height: u32,
}

/// Get the window's inner size (logical pixels)
///
/// Check the success field (1 = success, 0 = failure).
#[deno_bindgen]
pub fn window_inner_size(window_id: u64) -> WindowSize {
    match crate::window::system::with_window(window_id, |window| {
        let size = window.inner().inner_size();
        WindowSize {
            success: 1,
            width: size.width,
            height: size.height,
        }
    }) {
        Some(size) => {
            clear_last_error();
            size
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            WindowSize {
                success: 0,
                width: 0,
                height: 0,
            }
        }
    }
}

/// Get the window's outer size (physical pixels, including decorations)
///
/// Check the success field (1 = success, 0 = failure).
#[deno_bindgen]
pub fn window_outer_size(window_id: u64) -> WindowSize {
    match crate::window::system::with_window(window_id, |window| {
        let size = window.inner().outer_size();
        WindowSize {
            success: 1,
            width: size.width,
            height: size.height,
        }
    }) {
        Some(size) => {
            clear_last_error();
            size
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            WindowSize {
                success: 0,
                width: 0,
                height: 0,
            }
        }
    }
}

/// Window position information with success flag
#[derive(Debug, Clone)]
#[deno_bindgen]
pub struct WindowPosition {
    /// 0 = failure, 1 = success
    pub success: u8,
    pub x: i32,
    pub y: i32,
}

/// Get the window's inner position (logical pixels)
///
/// Check the success field (1 = success, 0 = failure).
#[deno_bindgen]
pub fn window_inner_position(window_id: u64) -> WindowPosition {
    match crate::window::system::with_window(window_id, |window| {
        window
            .inner()
            .inner_position()
            .map(|pos| WindowPosition {
                success: 1,
                x: pos.x,
                y: pos.y,
            })
            .unwrap_or(WindowPosition {
                success: 0,
                x: 0,
                y: 0,
            })
    }) {
        Some(pos) => {
            if pos.success == 1 {
                clear_last_error();
            } else {
                set_last_error("Failed to get window inner position".to_string());
            }
            pos
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            WindowPosition {
                success: 0,
                x: 0,
                y: 0,
            }
        }
    }
}

/// Get the window's outer position (physical pixels)
///
/// Check the success field (1 = success, 0 = failure).
#[deno_bindgen]
pub fn window_outer_position(window_id: u64) -> WindowPosition {
    match crate::window::system::with_window(window_id, |window| {
        window
            .inner()
            .outer_position()
            .map(|pos| WindowPosition {
                success: 1,
                x: pos.x,
                y: pos.y,
            })
            .unwrap_or(WindowPosition {
                success: 0,
                x: 0,
                y: 0,
            })
    }) {
        Some(pos) => {
            if pos.success == 1 {
                clear_last_error();
            } else {
                set_last_error("Failed to get window outer position".to_string());
            }
            pos
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            WindowPosition {
                success: 0,
                x: 0,
                y: 0,
            }
        }
    }
}

/// Get the window's scale factor (DPI)
///
/// Returns 0.0 on failure. Call get_last_error() to check for errors.
#[deno_bindgen]
pub fn window_scale_factor(window_id: u64) -> f64 {
    match crate::window::system::with_window(window_id, |window| window.inner().scale_factor()) {
        Some(factor) => {
            clear_last_error();
            factor
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            0.0
        }
    }
}

/// Check if the window is maximized
///
/// Returns 1 if maximized, 0 if not or if window not found.
#[deno_bindgen]
pub fn window_is_maximized(window_id: u64) -> u8 {
    match crate::window::system::with_window(window_id, |window| window.inner().is_maximized()) {
        Some(true) => {
            clear_last_error();
            1
        }
        Some(false) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            0
        }
    }
}

/// Check if the window is minimized
///
/// Returns 1 if minimized, 0 if not or if window not found.
#[deno_bindgen]
pub fn window_is_minimized(window_id: u64) -> u8 {
    match crate::window::system::with_window(window_id, |window| {
        window.inner().is_minimized().unwrap_or(false)
    }) {
        Some(true) => {
            clear_last_error();
            1
        }
        Some(false) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            0
        }
    }
}

/// Check if the window is visible
///
/// Returns 1 if visible, 0 if not or if window not found.
#[deno_bindgen]
pub fn window_is_visible(window_id: u64) -> u8 {
    match crate::window::system::with_window(window_id, |window| {
        window.inner().is_visible().unwrap_or(false)
    }) {
        Some(true) => {
            clear_last_error();
            1
        }
        Some(false) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            0
        }
    }
}

/// Check if the window is resizable
///
/// Returns 1 if resizable, 0 if not or if window not found.
#[deno_bindgen]
pub fn window_is_resizable(window_id: u64) -> u8 {
    match crate::window::system::with_window(window_id, |window| window.inner().is_resizable()) {
        Some(true) => {
            clear_last_error();
            1
        }
        Some(false) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            0
        }
    }
}

/// Check if the window has decorations
///
/// Returns 1 if decorated, 0 if not or if window not found.
#[deno_bindgen]
pub fn window_is_decorated(window_id: u64) -> u8 {
    match crate::window::system::with_window(window_id, |window| window.inner().is_decorated()) {
        Some(true) => {
            clear_last_error();
            1
        }
        Some(false) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            0
        }
    }
}

// ============================================================================
// WINDOW CONTROL
// ============================================================================

/// Request the window to redraw
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn window_request_redraw(window_id: u64) -> u8 {
    match crate::window::system::with_window(window_id, |window| {
        window.inner().request_redraw();
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Focus the window
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn window_focus(window_id: u64) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        window.inner_mut().focus_window();
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Close the window
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn window_close(window_id: u64) -> u8 {
    match crate::window::system::remove_window(window_id) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

// ============================================================================
// CURSOR/MOUSE
// ============================================================================

/// Set whether the cursor is visible over the window
///
/// Returns 0 on success, 1 on failure.
/// visible: 0 = hidden, 1 = visible
#[deno_bindgen]
pub fn window_set_cursor_visible(window_id: u64, visible: u8) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        window.inner_mut().set_cursor_visible(visible != 0);
    }) {
        Some(_) => {
            clear_last_error();
            0
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Set the cursor grab mode
///
/// Returns 0 on success, 1 on failure.
/// grab: 0 = no grab, 1 = grab (confined)
#[deno_bindgen]
pub fn window_set_cursor_grab(window_id: u64, grab: u8) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        let mode = if grab != 0 {
            winit::window::CursorGrabMode::Confined
        } else {
            winit::window::CursorGrabMode::None
        };
        window
            .inner_mut()
            .set_cursor_grab(mode)
            .map_err(|e| e.to_string())
    }) {
        Some(Ok(_)) => {
            clear_last_error();
            0
        }
        Some(Err(e)) => {
            set_last_error(e);
            1
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Set the cursor position within the window
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn window_set_cursor_position(window_id: u64, x: f64, y: f64) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        let pos = winit::dpi::LogicalPosition::new(x, y);
        window
            .inner_mut()
            .set_cursor_position(pos)
            .map_err(|e| e.to_string())
    }) {
        Some(Ok(_)) => {
            clear_last_error();
            0
        }
        Some(Err(e)) => {
            set_last_error(e);
            1
        }
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

// ============================================================================
// EVENT LOOP
// ============================================================================

/// Event result with success flag
#[derive(Debug, Clone)]
#[deno_bindgen]
pub struct EventResult {
    /// 0 = no event available, 1 = event available
    pub has_event: u8,
    /// The event (only valid if has_event == 1)
    pub event: Event,
}

/// Poll for the next window event (non-blocking)
///
/// Check the has_event field (1 = event available, 0 = no event).
/// Only read the event field if has_event == 1.
#[deno_bindgen(non_blocking)]
pub fn poll_event() -> EventResult {
    match crate::window::opener::poll_event() {
        Some(event) => EventResult {
            has_event: 1,
            event,
        },
        None => EventResult {
            has_event: 0,
            // Dummy event when no event available (check has_event field!)
            event: Event {
                window_id: 0,
                event: crate::window::WindowEvent::CloseRequested,
            },
        },
    }
}

/// Pump the event loop to process pending events
///
/// This processes all pending window events without blocking.
/// Useful for ensuring events are processed before rendering egui frames.
#[deno_bindgen]
pub fn pump_events() {
    crate::window::opener::pump_events();
}

// ============================================================================
// SYSTEM INFO
// ============================================================================

/// Get the current platform name
///
/// Returns "macos", "linux", or "windows".
#[deno_bindgen]
pub fn platform() -> String {
    crate::os::platform_name().to_string()
}

/// Get the count of currently open windows
#[deno_bindgen]
pub fn window_count() -> usize {
    crate::window::system::window_count()
}

/// Check if a window exists
///
/// Returns 1 if the window exists, 0 if not.
#[deno_bindgen]
pub fn window_exists(window_id: u64) -> u8 {
    if crate::window::system::window_exists(window_id) {
        1
    } else {
        0
    }
}

// ============================================================================
// RENDERING
// ============================================================================

/// Render a frame to the window
///
/// This renders the window's content and presents it to the screen.
/// Automatically requests the next redraw to maintain continuous 60 FPS rendering.
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn window_render(window_id: u64) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        // Get window reference before mutable borrow
        let winit_window = window.inner() as *const winit::window::Window;

        if let Some(render_state) = &mut window.render_state {
            // SAFETY: We know the window is valid for the duration of this closure
            let winit_window_ref = unsafe { &*winit_window };

            match crate::rendering::render_frame(render_state, winit_window_ref) {
                Ok(()) => {
                    // Request next redraw to maintain continuous 60 FPS
                    winit_window_ref.request_redraw();
                    clear_last_error();
                    0
                },
                Err(e) => {
                    set_last_error(format!("Render error: {:?}", e));
                    1
                }
            }
        } else {
            set_last_error("Window does not have rendering enabled".to_string());
            1
        }
    }) {
        Some(result) => result,
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Upload pixel data to the window's content texture
///
/// Pixels must be in RGBA8 format (width * height * 4 bytes).
/// This will create or resize the texture as needed.
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn window_upload_pixels(window_id: u64, pixels: &[u8], width: u32, height: u32) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        if let Some(render_state) = &mut window.render_state {
            // Check if we need to create or resize the texture
            let needs_new_texture = match &render_state.content_texture {
                None => true,
                Some(tex) => tex.width != width || tex.height != height,
            };

            if needs_new_texture {
                render_state.content_texture = Some(crate::rendering::ContentTexture::new(
                    &render_state.device,
                    width,
                    height,
                    &render_state.texture_bind_group_layout,
                ));
            }

            // Upload pixels
            if let Some(texture) = &render_state.content_texture {
                texture.upload_pixels(&render_state.queue, pixels);
                clear_last_error();
                0
            } else {
                set_last_error("Failed to create content texture".to_string());
                1
            }
        } else {
            set_last_error("Window does not have rendering enabled".to_string());
            1
        }
    }) {
        Some(result) => result,
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

// ============================================================================
// EGUI UI
// ============================================================================

/// Begin an egui frame
///
/// Call this before drawing any egui UI elements.
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn egui_begin_frame(window_id: u64) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        // Get window pointer before mutable borrow
        let winit_window = window.inner() as *const winit::window::Window;

        if let Some(render_state) = &mut window.render_state {
            // SAFETY: We know the window is valid for the duration of this closure
            let winit_window_ref = unsafe { &*winit_window };
            render_state.egui_state.begin_frame(winit_window_ref);
            clear_last_error();
            0
        } else {
            set_last_error("Window does not have rendering enabled".to_string());
            1
        }
    }) {
        Some(result) => result,
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Queue an egui button
///
/// Returns 1 if the button was clicked in the last frame, 0 otherwise.
#[deno_bindgen]
pub fn egui_button(window_id: u64, label: &str) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        if let Some(render_state) = &mut window.render_state {
            // Queue the button command
            render_state.egui_state.ui_commands.push(
                crate::rendering::egui_state::UICommand::Button {
                    label: label.to_string(),
                }
            );

            // Check if this button was clicked in the last frame
            let clicked = render_state.egui_state.ui_result
                .button_clicked
                .get(label)
                .copied()
                .unwrap_or(false);

            clear_last_error();
            if clicked { 1 } else { 0 }
        } else {
            set_last_error("Window does not have rendering enabled".to_string());
            0
        }
    }) {
        Some(result) => result,
        None => {
            set_last_error(format!("Window {} not found", window_id));
            0
        }
    }
}

/// Queue an egui label
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn egui_label(window_id: u64, text: &str) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        if let Some(render_state) = &mut window.render_state {
            render_state.egui_state.ui_commands.push(
                crate::rendering::egui_state::UICommand::Label {
                    text: text.to_string(),
                }
            );
            clear_last_error();
            0
        } else {
            set_last_error("Window does not have rendering enabled".to_string());
            1
        }
    }) {
        Some(result) => result,
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Queue an egui text input
///
/// Returns the text value from the last frame (updated if user typed).
#[deno_bindgen]
pub fn egui_text_input(window_id: u64, id: &str, current_value: &str) -> String {
    match crate::window::system::with_window_mut(window_id, |window| {
        if let Some(render_state) = &mut window.render_state {
            // Queue the text input command with current value
            render_state.egui_state.ui_commands.push(
                crate::rendering::egui_state::UICommand::TextInput {
                    id: id.to_string(),
                    value: current_value.to_string(),
                }
            );

            // Get the value from last frame (or current if not changed)
            let text = render_state.egui_state.ui_result
                .text_values
                .get(id)
                .cloned()
                .unwrap_or_else(|| current_value.to_string());

            clear_last_error();
            text
        } else {
            set_last_error("Window does not have rendering enabled".to_string());
            current_value.to_string()
        }
    }) {
        Some(result) => result,
        None => {
            set_last_error(format!("Window {} not found", window_id));
            current_value.to_string()
        }
    }
}

/// Begin a horizontal layout
///
/// All UI elements added after this (until egui_horizontal_end) will be laid out horizontally.
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn egui_horizontal_begin(window_id: u64) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        if let Some(render_state) = &mut window.render_state {
            render_state.egui_state.ui_commands.push(
                crate::rendering::egui_state::UICommand::HorizontalBegin
            );
            clear_last_error();
            0
        } else {
            set_last_error("Window does not have rendering enabled".to_string());
            1
        }
    }) {
        Some(result) => result,
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// End a horizontal layout
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn egui_horizontal_end(window_id: u64) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        if let Some(render_state) = &mut window.render_state {
            render_state.egui_state.ui_commands.push(
                crate::rendering::egui_state::UICommand::HorizontalEnd
            );
            clear_last_error();
            0
        } else {
            set_last_error("Window does not have rendering enabled".to_string());
            1
        }
    }) {
        Some(result) => result,
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Queue a context menu area (responds to right-click)
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn egui_context_menu_area(window_id: u64, id: &str) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        if let Some(render_state) = &mut window.render_state {
            render_state.egui_state.ui_commands.push(
                crate::rendering::egui_state::UICommand::ContextMenuArea {
                    id: id.to_string(),
                }
            );
            clear_last_error();
            0
        } else {
            set_last_error("Window does not have rendering enabled".to_string());
            1
        }
    }) {
        Some(result) => result,
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Begin defining a context menu
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn egui_context_menu_begin(window_id: u64, menu_id: &str) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        if let Some(render_state) = &mut window.render_state {
            render_state.egui_state.ui_commands.push(
                crate::rendering::egui_state::UICommand::ContextMenuBegin {
                    menu_id: menu_id.to_string(),
                }
            );
            clear_last_error();
            0
        } else {
            set_last_error("Window does not have rendering enabled".to_string());
            1
        }
    }) {
        Some(result) => result,
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// Add a context menu item
///
/// Returns the item_id if it was clicked, empty string otherwise.
#[deno_bindgen]
pub fn egui_context_menu_item(window_id: u64, menu_id: &str, item_id: &str, label: &str) -> String {
    match crate::window::system::with_window_mut(window_id, |window| {
        if let Some(render_state) = &mut window.render_state {
            // Queue the menu item command
            render_state.egui_state.ui_commands.push(
                crate::rendering::egui_state::UICommand::ContextMenuItem {
                    menu_id: menu_id.to_string(),
                    item_id: item_id.to_string(),
                    label: label.to_string(),
                }
            );

            // Check if this menu had an item clicked in the last frame
            let clicked_item = render_state.egui_state.ui_result
                .context_menu_clicked
                .get(menu_id)
                .cloned()
                .unwrap_or_default();

            clear_last_error();
            clicked_item
        } else {
            set_last_error("Window does not have rendering enabled".to_string());
            String::new()
        }
    }) {
        Some(result) => result,
        None => {
            set_last_error(format!("Window {} not found", window_id));
            String::new()
        }
    }
}

/// End a context menu definition
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn egui_context_menu_end(window_id: u64) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        if let Some(render_state) = &mut window.render_state {
            render_state.egui_state.ui_commands.push(
                crate::rendering::egui_state::UICommand::ContextMenuEnd
            );
            clear_last_error();
            0
        } else {
            set_last_error("Window does not have rendering enabled".to_string());
            1
        }
    }) {
        Some(result) => result,
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}

/// End egui frame and prepare for rendering
///
/// Call this after drawing all egui UI elements, before window_render.
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn egui_end_frame(window_id: u64) -> u8 {
    match crate::window::system::with_window_mut(window_id, |window| {
        if let Some(render_state) = &mut window.render_state {
            let egui_output = render_state.egui_state.end_frame();

            // Store the output for rendering in window_render
            render_state.egui_output = Some(egui_output);
            clear_last_error();
            0
        } else {
            set_last_error("Window does not have rendering enabled".to_string());
            1
        }
    }) {
        Some(result) => result,
        None => {
            set_last_error(format!("Window {} not found", window_id));
            1
        }
    }
}
