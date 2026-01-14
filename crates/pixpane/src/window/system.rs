// Global window registry and management

use super::base::Window;
use std::collections::HashMap;
use parking_lot::RwLock;
use lazy_static::lazy_static;

lazy_static! {
    /// Global registry of all windows
    ///
    /// Windows are stored by their unique u64 ID. Access is synchronized
    /// using parking_lot's RwLock for better performance than std's RwLock.
    pub static ref WINDOWS: RwLock<HashMap<u64, Window>> = RwLock::new(HashMap::new());
}

/// Register a new window in the global registry
///
/// Returns the window's ID for future reference.
pub fn register_window(window: Window) -> u64 {
    let id = window.id;
    WINDOWS.write().insert(id, window);
    id
}

/// Get a reference to a window by ID
///
/// Note: This clones the Window, which is currently expensive since
/// Window contains a WinitWindow. In the future, we may want to use
/// Arc or another shared ownership pattern.
pub fn get_window(id: u64) -> Option<Window> {
    // Note: We can't return a reference here because the RwLockReadGuard
    // would need to outlive this function. For now, we don't support
    // cloning windows, so this will always return None.
    // In phase 6, we'll access windows differently.
    None
}

/// Remove a window from the registry
///
/// Returns the window if it was found and removed.
pub fn remove_window(id: u64) -> Option<Window> {
    WINDOWS.write().remove(&id)
}

/// Get the count of registered windows
pub fn window_count() -> usize {
    WINDOWS.read().len()
}

/// Check if a window with the given ID exists
pub fn window_exists(id: u64) -> bool {
    WINDOWS.read().contains_key(&id)
}

/// Execute a function with read access to a window
///
/// This is the preferred way to access window data without cloning.
pub fn with_window<F, R>(id: u64, f: F) -> Option<R>
where
    F: FnOnce(&Window) -> R,
{
    let windows = WINDOWS.read();
    windows.get(&id).map(f)
}

/// Execute a function with write access to a window
///
/// This is the preferred way to modify window data.
pub fn with_window_mut<F, R>(id: u64, f: F) -> Option<R>
where
    F: FnOnce(&mut Window) -> R,
{
    let mut windows = WINDOWS.write();
    windows.get_mut(&id).map(f)
}
