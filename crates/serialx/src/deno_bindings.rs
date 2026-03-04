//! Deno FFI bindings — all serial device functionality exposed via deno_bindgen
//!
//! Error handling: Functions that can fail return success codes (0 = success, 1 = failure).
//! Call serialx_get_last_error() to retrieve the error message after a failure.

use deno_bindgen::deno_bindgen;

// ============================================================================
// ERROR HANDLING
// ============================================================================

thread_local! {
    static LAST_ERROR: std::cell::RefCell<Option<String>> = std::cell::RefCell::new(None);
}

fn set_last_error(msg: String) {
    LAST_ERROR.with(|e| *e.borrow_mut() = Some(msg));
}

fn clear_last_error() {
    LAST_ERROR.with(|e| *e.borrow_mut() = None);
}

/// Initialize the serialx library
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn serialx_init() -> u8 {
    let _ = env_logger::try_init();
    clear_last_error();
    0
}

/// Get the library version
#[deno_bindgen]
pub fn serialx_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Get the last error message
///
/// Returns empty string if no error occurred.
#[deno_bindgen]
pub fn serialx_get_last_error() -> String {
    LAST_ERROR.with(|e| e.borrow().clone().unwrap_or_default())
}

// ============================================================================
// PORT ENUMERATION
// ============================================================================

/// List all available serial ports as JSON
#[deno_bindgen]
pub fn serialx_list_ports() -> String {
    clear_last_error();
    let ports = crate::enumerate::list_serial_ports();
    serde_json::to_string(&ports).unwrap_or_else(|e| {
        set_last_error(format!("JSON serialize error: {}", e));
        "[]".to_string()
    })
}

/// List all available printers as JSON
#[deno_bindgen]
pub fn serialx_list_printers() -> String {
    clear_last_error();
    let printers = crate::enumerate::list_printers();
    serde_json::to_string(&printers).unwrap_or_else(|e| {
        set_last_error(format!("JSON serialize error: {}", e));
        "[]".to_string()
    })
}

// ============================================================================
// DEVICE MANAGEMENT
// ============================================================================

/// Open a serial port
///
/// Returns device ID (>0) on success, 0 on failure.
#[deno_bindgen]
pub fn serialx_open(port_name: &str, baud_rate: u32) -> u64 {
    clear_last_error();
    let id = crate::device::open_device(port_name, baud_rate);
    if id == 0 {
        set_last_error(format!("Failed to open port: {}", port_name));
    }
    id
}

/// Close a serial port
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn serialx_close(device_id: u64) -> u8 {
    clear_last_error();
    let result = crate::device::close_device(device_id);
    if result != 0 {
        set_last_error(format!("Device {} not found", device_id));
    }
    result
}

/// Configure a serial port (JSON config)
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn serialx_configure(device_id: u64, config_json: &str) -> u8 {
    clear_last_error();
    let result = crate::device::configure_device(device_id, config_json);
    if result != 0 {
        set_last_error(format!("Failed to configure device {}", device_id));
    }
    result
}

// ============================================================================
// I/O OPERATIONS
// ============================================================================

/// Write base64-encoded data to a device
///
/// Returns bytes written or -1 on error.
#[deno_bindgen]
pub fn serialx_write(device_id: u64, data_b64: &str) -> i32 {
    clear_last_error();
    let result = crate::io::write_bytes(device_id, data_b64);
    if result < 0 {
        set_last_error(format!("Write failed on device {}", device_id));
    }
    result
}

/// Read data from a device
///
/// Returns base64-encoded data or empty string on error/timeout.
#[deno_bindgen]
pub fn serialx_read(device_id: u64, max_len: u32, timeout_ms: u32) -> String {
    clear_last_error();
    crate::io::read_bytes(device_id, max_len as usize, timeout_ms as u64)
}

/// Flush a device
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn serialx_flush(device_id: u64) -> u8 {
    clear_last_error();
    let result = crate::io::flush_device(device_id);
    if result != 0 {
        set_last_error(format!("Flush failed on device {}", device_id));
    }
    result
}

/// Get bytes available for reading
///
/// Returns byte count or -1 on error.
#[deno_bindgen]
pub fn serialx_bytes_available(device_id: u64) -> i32 {
    clear_last_error();
    crate::io::bytes_available(device_id)
}

// ============================================================================
// PROTOCOLS
// ============================================================================

/// Send an ESC/POS command (JSON) to a device
///
/// Returns 0 on success, 1 on failure.
#[deno_bindgen]
pub fn serialx_escpos_command(device_id: u64, command_json: &str) -> u8 {
    clear_last_error();
    let result = crate::protocol::send_escpos_command(device_id, command_json);
    if result != 0 {
        set_last_error(format!("ESC/POS command failed on device {}", device_id));
    }
    result
}

// ============================================================================
// TRACE LOG
// ============================================================================

/// Get the trace log as JSON
#[deno_bindgen]
pub fn serialx_get_trace_log() -> String {
    crate::trace::get_trace_log()
}

/// Clear the trace log
#[deno_bindgen]
pub fn serialx_clear_trace_log() {
    crate::trace::clear_trace_log();
}
