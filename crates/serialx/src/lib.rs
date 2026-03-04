//! SerialX - Serial port and device communication for BrowserX
//!
//! Provides cross-platform serial port access exposed to Deno via FFI (deno_bindgen).
//! Features: port enumeration, device I/O, ESC/POS printer protocol, OS printer discovery.

pub mod trace;
pub mod enumerate;
pub mod device;
pub mod io;
pub mod protocol;
pub mod deno_bindings;

pub use trace::{TraceEvent, log_event, get_trace_log, clear_trace_log};
pub use enumerate::{PortInfo, list_serial_ports, list_printers};
pub use device::{open_device, close_device, configure_device};
pub use io::{write_bytes, read_bytes, flush_device, bytes_available};
pub use protocol::{send_escpos_command, EscPosCommand};
