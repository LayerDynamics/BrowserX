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
use std::sync::Arc;
use std::time::Duration;
use lazy_static::lazy_static;
use parking_lot::Mutex;
use std::cell::RefCell;

// ============================================================================
// GLOBAL STATE
// ============================================================================

/// Maximum number of events held in the queue. When the queue is full,
/// high-frequency events (MouseMoved, MouseWheel, RedrawRequested) are
/// coalesced per-window, and if still at capacity the oldest non-critical
/// event is dropped. Critical events (CloseRequested, Destroyed) are never
/// dropped.
const EVENT_QUEUE_CAPACITY: usize = 4096;

lazy_static! {
    /// Event queue for FFI polling
    static ref EVENT_QUEUE: Mutex<VecDeque<Event>> = Mutex::new(VecDeque::with_capacity(EVENT_QUEUE_CAPACITY));

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
struct PixpaneApp;

impl PixpaneApp {
    fn new() -> Self {
        Self
    }

    /// Process any pending window creation requests using the active event loop.
    ///
    /// Must be called synchronously within an ApplicationHandler callback —
    /// the &ActiveEventLoop is only valid for the duration of that callback.
    fn process_pending_windows(&mut self, event_loop: &ActiveEventLoop) {
        if let Some(config) = PENDING_WINDOW.lock().take() {
            let result = self.create_window(event_loop, config);
            *WINDOW_RESULT.lock() = Some(result);
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
        self.process_pending_windows(event_loop);
    }

    fn window_event(
        &mut self,
        event_loop: &ActiveEventLoop,
        window_id: WinitWindowId,
        event: WinitWindowEvent,
    ) {
        let id = hash_id(&window_id);

        // Pass event to egui first (but not CloseRequested - that's always for the app)
        let egui_consumed = if !matches!(event, WinitWindowEvent::CloseRequested) {
            crate::window::system::with_window_mut(id, |window| {
                // Clone the Arc to get an independent handle — avoids aliasing
                // between the shared winit window ref and &mut render_state
                let winit_window = Arc::clone(&window.inner);

                if let Some(render_state) = &mut window.render_state {
                    render_state.egui_state.handle_event(&winit_window, &event)
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
        if let Some(evt) = window_event {
            if is_critical || !egui_consumed {
                enqueue_event(Event { window_id: id, event: evt });
            }
        }

        self.process_pending_windows(event_loop);
    }

    fn new_events(&mut self, event_loop: &ActiveEventLoop, _cause: StartCause) {
        self.process_pending_windows(event_loop);
    }
}

// ============================================================================
// BOUNDED EVENT QUEUE
// ============================================================================

/// Returns true for high-frequency events that can be coalesced (only the
/// latest value matters — intermediate positions/deltas are stale).
fn is_coalescable(event: &WindowEvent) -> bool {
    matches!(
        event,
        WindowEvent::MouseMoved { .. }
            | WindowEvent::MouseWheel { .. }
            | WindowEvent::RedrawRequested
    )
}

/// Returns true for events that must never be dropped.
fn is_critical_event(event: &WindowEvent) -> bool {
    matches!(
        event,
        WindowEvent::CloseRequested | WindowEvent::Destroyed
    )
}

/// Returns true if two events are the same variant (ignoring payload).
fn same_variant(a: &WindowEvent, b: &WindowEvent) -> bool {
    std::mem::discriminant(a) == std::mem::discriminant(b)
}

/// Push an event into EVENT_QUEUE with bounded capacity.
///
/// When the queue is at capacity:
/// 1. For coalescable events, replace the last queued event of the same
///    type for the same window (in-place update, no growth).
/// 2. Otherwise, drop the oldest non-critical event to make room.
/// 3. If the queue is entirely critical events (extremely unlikely at 4096),
///    the new non-critical event is silently dropped.
fn enqueue_event(event: Event) {
    let mut queue = EVENT_QUEUE.lock();

    if queue.len() < EVENT_QUEUE_CAPACITY {
        queue.push_back(event);
        return;
    }

    // Queue is full — try to coalesce if applicable
    if is_coalescable(&event.event) {
        // Walk backwards to find the latest same-variant event for this window
        for existing in queue.iter_mut().rev() {
            if existing.window_id == event.window_id
                && same_variant(&existing.event, &event.event)
            {
                existing.event = event.event;
                return;
            }
        }
    }

    // No coalescable match — drop the oldest non-critical event
    if let Some(idx) = queue
        .iter()
        .position(|e| !is_critical_event(&e.event))
    {
        queue.remove(idx);
        queue.push_back(event);
    }
    // else: queue is entirely critical events — drop the new event silently
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

/// Drain all pending events for a specific window from the event queue.
///
/// Called by window_close to prevent stale events from being returned
/// after a window has been destroyed.
pub fn drain_events_for_window(window_id: u64) {
    EVENT_QUEUE.lock().retain(|event| event.window_id != window_id);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mouse_moved(wid: u64, x: f64, y: f64) -> Event {
        Event { window_id: wid, event: WindowEvent::MouseMoved { x, y } }
    }

    fn close_requested(wid: u64) -> Event {
        Event { window_id: wid, event: WindowEvent::CloseRequested }
    }

    fn focused(wid: u64) -> Event {
        Event { window_id: wid, event: WindowEvent::Focused { focused: true } }
    }

    fn redraw(wid: u64) -> Event {
        Event { window_id: wid, event: WindowEvent::RedrawRequested }
    }

    /// Serialize all tests that touch the global EVENT_QUEUE.
    static TEST_LOCK: parking_lot::Mutex<()> = parking_lot::Mutex::new(());

    /// Run a closure with exclusive access to the global queue, clearing
    /// it before and after.
    fn with_clean_queue(f: impl FnOnce()) {
        let _guard = TEST_LOCK.lock();
        EVENT_QUEUE.lock().clear();
        f();
        EVENT_QUEUE.lock().clear();
    }

    #[test]
    fn enqueue_within_capacity() {
        with_clean_queue(|| {
            for i in 0..100 {
                enqueue_event(mouse_moved(1, i as f64, 0.0));
            }
            assert_eq!(EVENT_QUEUE.lock().len(), 100);
        });
    }

    #[test]
    fn coalescable_events_are_replaced_at_capacity() {
        with_clean_queue(|| {
            for _ in 0..EVENT_QUEUE_CAPACITY {
                enqueue_event(focused(1));
            }
            assert_eq!(EVENT_QUEUE.lock().len(), EVENT_QUEUE_CAPACITY);

            // Add a mouse-moved — drops oldest non-critical to make room
            enqueue_event(mouse_moved(1, 10.0, 20.0));
            assert_eq!(EVENT_QUEUE.lock().len(), EVENT_QUEUE_CAPACITY);

            // Another mouse-moved for same window — should coalesce in-place
            enqueue_event(mouse_moved(1, 99.0, 99.0));
            assert_eq!(EVENT_QUEUE.lock().len(), EVENT_QUEUE_CAPACITY);

            let queue = EVENT_QUEUE.lock();
            let last_mm = queue.iter().rev().find(|e| {
                e.window_id == 1 && matches!(e.event, WindowEvent::MouseMoved { .. })
            });
            match &last_mm.unwrap().event {
                WindowEvent::MouseMoved { x, y } => {
                    assert_eq!(*x, 99.0);
                    assert_eq!(*y, 99.0);
                }
                _ => panic!("expected MouseMoved"),
            }
        });
    }

    #[test]
    fn critical_events_never_dropped() {
        with_clean_queue(|| {
            for _ in 0..EVENT_QUEUE_CAPACITY {
                enqueue_event(close_requested(1));
            }
            // Non-critical event when queue is all critical — silently dropped
            enqueue_event(focused(1));
            let queue = EVENT_QUEUE.lock();
            assert_eq!(queue.len(), EVENT_QUEUE_CAPACITY);
            assert!(queue.iter().all(|e| matches!(e.event, WindowEvent::CloseRequested)));
        });
    }

    #[test]
    fn coalesce_per_window() {
        with_clean_queue(|| {
            for _ in 0..EVENT_QUEUE_CAPACITY {
                enqueue_event(focused(1));
            }
            enqueue_event(mouse_moved(1, 1.0, 1.0));
            enqueue_event(mouse_moved(2, 2.0, 2.0));

            let queue = EVENT_QUEUE.lock();
            let mm_events: Vec<_> = queue.iter().filter(|e| {
                matches!(e.event, WindowEvent::MouseMoved { .. })
            }).collect();
            assert_eq!(mm_events.len(), 2);
            assert_eq!(mm_events[0].window_id, 1);
            assert_eq!(mm_events[1].window_id, 2);
        });
    }

    #[test]
    fn redraw_coalesces() {
        with_clean_queue(|| {
            for _ in 0..EVENT_QUEUE_CAPACITY {
                enqueue_event(focused(1));
            }
            enqueue_event(redraw(1));
            enqueue_event(redraw(1)); // should coalesce
            let queue = EVENT_QUEUE.lock();
            let redraw_count = queue.iter().filter(|e| {
                matches!(e.event, WindowEvent::RedrawRequested)
            }).count();
            assert_eq!(redraw_count, 1);
        });
    }
}
