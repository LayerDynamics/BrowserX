// Event loop management and window creation
//
// This module implements the event loop using winit 0.30's pump_events model.
// On macOS, the event loop MUST be created and run on the main thread.
// Since we're called from Deno via FFI (on the main thread), we create the
// event loop lazily on first use and use pump_events for manual polling.

use super::{WindowConfig, Event, WindowEvent, WindowBuilder};
use super::system::register_window;
use crate::utils::hash_id;
use winit::application::ApplicationHandler;
use winit::event::{WindowEvent as WinitWindowEvent, StartCause, ElementState, MouseButton, MouseScrollDelta};
use winit::event_loop::{EventLoop, ActiveEventLoop, ControlFlow};
use winit::platform::pump_events::EventLoopExtPumpEvents;
use winit::window::WindowId as WinitWindowId;
use std::collections::VecDeque;
use std::time::Duration;
use lazy_static::lazy_static;
use parking_lot::Mutex;
use std::cell::RefCell;

// ============================================================================
// GLOBAL STATE
// ============================================================================

lazy_static! {
    /// Event queue for FFI polling
    static ref EVENT_QUEUE: Mutex<VecDeque<Event>> = Mutex::new(VecDeque::new());

    /// Pending window creation request
    static ref PENDING_WINDOW: Mutex<Option<WindowConfig>> = Mutex::new(None);

    /// Result of last window creation
    static ref WINDOW_RESULT: Mutex<Option<Result<u64, String>>> = Mutex::new(None);
}

thread_local! {
    /// The event loop (must be on main thread on macOS)
    static EVENT_LOOP: RefCell<Option<EventLoop<()>>> = RefCell::new(None);

    /// Application handler state
    static APP_HANDLER: RefCell<Option<PixpaneApp>> = RefCell::new(None);
}

// ============================================================================
// EVENT LOOP APPLICATION
// ============================================================================

/// Application handler for the winit event loop
struct PixpaneApp {
    active_loop: Option<&'static ActiveEventLoop>,
}

impl PixpaneApp {
    fn new() -> Self {
        Self {
            active_loop: None,
        }
    }

    fn process_pending_windows(&mut self) {
        if let Some(active_loop) = self.active_loop {
            if let Some(config) = PENDING_WINDOW.lock().take() {
                let result = self.create_window(active_loop, config);
                *WINDOW_RESULT.lock() = Some(result);
            }
        }
    }

    fn create_window(&mut self, event_loop: &ActiveEventLoop, config: WindowConfig) -> Result<u64, String> {
        let builder = WindowBuilder::from_config(config);
        let window = builder.build(event_loop)?;
        let id = window.id;
        register_window(window);
        Ok(id)
    }
}

impl ApplicationHandler for PixpaneApp {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        // SAFETY: We're storing a reference to the event loop that lives
        // for the duration of the pump_events call. This is safe because
        // we only use it within the same pump_events invocation.
        self.active_loop = Some(unsafe {
            std::mem::transmute::<&ActiveEventLoop, &'static ActiveEventLoop>(event_loop)
        });

        self.process_pending_windows();
    }

    fn window_event(
        &mut self,
        _event_loop: &ActiveEventLoop,
        window_id: WinitWindowId,
        event: WinitWindowEvent,
    ) {
        let id = hash_id(&window_id);

        // Pass event to egui first (but not CloseRequested - that's always for the app)
        let egui_consumed = if !matches!(event, WinitWindowEvent::CloseRequested) {
            crate::window::system::with_window_mut(id, |window| {
                // Get window pointer before mutable borrow
                let winit_window = window.inner() as *const winit::window::Window;

                if let Some(render_state) = &mut window.render_state {
                    // SAFETY: We know the window is valid for the duration of this closure
                    let winit_window_ref = unsafe { &*winit_window };
                    render_state.egui_state.handle_event(winit_window_ref, &event)
                } else {
                    false
                }
            }).unwrap_or(false)
        } else {
            false
        };

        // Handle surface resize immediately
        if let WinitWindowEvent::Resized(size) = &event {
            crate::window::system::with_window_mut(id, |window| {
                if let Some(render_state) = &mut window.render_state {
                    render_state.resize(*size);
                }
            });
        }

        // Convert winit event to our Event type
        // Always queue critical system events (CloseRequested, Destroyed) regardless of egui
        let is_critical = matches!(event,
            WinitWindowEvent::CloseRequested |
            WinitWindowEvent::Destroyed
        );

        let window_event = match event {
            WinitWindowEvent::Resized(size) => {
                Some(WindowEvent::Resized {
                    width: size.width,
                    height: size.height,
                })
            }
            WinitWindowEvent::Moved(pos) => {
                Some(WindowEvent::Moved {
                    x: pos.x,
                    y: pos.y,
                })
            }
            WinitWindowEvent::CloseRequested => {
                Some(WindowEvent::CloseRequested)
            }
            WinitWindowEvent::Destroyed => {
                Some(WindowEvent::Destroyed)
            }
            WinitWindowEvent::Focused(focused) => {
                Some(WindowEvent::Focused { focused })
            }
            WinitWindowEvent::CursorEntered { .. } => {
                Some(WindowEvent::CursorEntered)
            }
            WinitWindowEvent::CursorLeft { .. } => {
                Some(WindowEvent::CursorLeft)
            }
            WinitWindowEvent::CursorMoved { position, .. } => {
                Some(WindowEvent::MouseMoved {
                    x: position.x,
                    y: position.y,
                })
            }
            WinitWindowEvent::MouseInput { state, button, .. } => {
                let button_str = match button {
                    MouseButton::Left => "Left",
                    MouseButton::Right => "Right",
                    MouseButton::Middle => "Middle",
                    MouseButton::Back => "Back",
                    MouseButton::Forward => "Forward",
                    _ => "Other",
                };
                Some(WindowEvent::MouseInput {
                    button: button_str.to_string(),
                    pressed: state == ElementState::Pressed,
                })
            }
            WinitWindowEvent::MouseWheel { delta, .. } => {
                let (delta_x, delta_y) = match delta {
                    MouseScrollDelta::LineDelta(x, y) => (x, y),
                    MouseScrollDelta::PixelDelta(pos) => (pos.x as f32, pos.y as f32),
                };
                Some(WindowEvent::MouseWheel { delta_x, delta_y })
            }
            WinitWindowEvent::KeyboardInput { event, .. } => {
                let key = format!("{:?}", event.logical_key);
                Some(WindowEvent::KeyboardInput {
                    key,
                    pressed: event.state == ElementState::Pressed,
                })
            }
            WinitWindowEvent::RedrawRequested => {
                Some(WindowEvent::RedrawRequested)
            }
            WinitWindowEvent::ScaleFactorChanged { scale_factor, .. } => {
                Some(WindowEvent::ScaleFactorChanged { scale_factor })
            }
            _ => None,
        };

        // Queue event if it's critical or egui didn't consume it
        if let Some(event) = window_event {
            if is_critical || !egui_consumed {
                EVENT_QUEUE.lock().push_back(Event {
                    window_id: id,
                    event,
                });
            }
        }

        self.process_pending_windows();
    }

    fn new_events(&mut self, event_loop: &ActiveEventLoop, _cause: StartCause) {
        // Store the active event loop reference
        self.active_loop = Some(unsafe {
            std::mem::transmute::<&ActiveEventLoop, &'static ActiveEventLoop>(event_loop)
        });

        self.process_pending_windows();
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/// Initialize the event loop (must be called on main thread on macOS)
///
/// This creates the event loop lazily on the first call.
/// On macOS, this MUST be called from the main thread.
fn ensure_event_loop_initialized() -> Result<(), String> {
    EVENT_LOOP.with(|event_loop_cell| {
        let mut event_loop_opt = event_loop_cell.borrow_mut();

        if event_loop_opt.is_none() {
            let event_loop = EventLoop::new()
                .map_err(|e| format!("Failed to create event loop: {}", e))?;

            event_loop.set_control_flow(ControlFlow::Poll);
            *event_loop_opt = Some(event_loop);

            // Initialize the app handler
            APP_HANDLER.with(|handler_cell| {
                *handler_cell.borrow_mut() = Some(PixpaneApp::new());
            });
        }

        Ok(())
    })
}

/// Pump events from the event loop
///
/// This processes pending events without blocking.
pub fn pump_events() {
    EVENT_LOOP.with(|event_loop_cell| {
        if let Some(event_loop) = event_loop_cell.borrow_mut().as_mut() {
            APP_HANDLER.with(|handler_cell| {
                if let Some(handler) = handler_cell.borrow_mut().as_mut() {
                    let timeout: Option<Duration> = None;
                    let _ = event_loop.pump_app_events(timeout, handler);
                }
            });
        }
    });
}

// ============================================================================
// PUBLIC API
// ============================================================================

/// Create a window with the event loop
///
/// This must be called from the main thread on macOS.
pub fn create_window_with_event_loop(config: WindowConfig) -> Result<u64, String> {
    // Ensure event loop is initialized on this (main) thread
    ensure_event_loop_initialized()?;

    // Store the window request
    *PENDING_WINDOW.lock() = Some(config);
    *WINDOW_RESULT.lock() = None;

    // Pump events to process the window creation
    pump_events();

    // Get the result
    WINDOW_RESULT.lock()
        .take()
        .unwrap_or_else(|| Err("Window creation failed - no result".to_string()))
}

/// Poll for the next event (non-blocking)
///
/// This pumps the event loop and returns the next queued event if available.
pub fn poll_event() -> Option<Event> {
    // Pump events to collect new events
    pump_events();

    // Return the next event from the queue
    EVENT_QUEUE.lock().pop_front()
}
