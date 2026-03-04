//! Serial device management — open, close, configure

use lazy_static::lazy_static;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serialport::SerialPort;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use crate::trace::log_event;

lazy_static! {
    static ref DEVICES: Mutex<HashMap<u64, Box<dyn SerialPort>>> = Mutex::new(HashMap::new());
}

static NEXT_DEVICE_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceConfig {
    pub data_bits: Option<u8>,
    pub stop_bits: Option<u8>,
    pub parity: Option<String>,
    pub flow_control: Option<String>,
    pub timeout_ms: Option<u64>,
}

/// Open a serial device. Returns device ID (>0) on success, 0 on failure.
pub fn open_device(port_name: &str, baud_rate: u32) -> u64 {
    log_event(
        "device",
        &format!("Opening {} at {} baud", port_name, baud_rate),
        "open",
        None,
    );

    match serialport::new(port_name, baud_rate)
        .timeout(Duration::from_millis(1000))
        .open()
    {
        Ok(port) => {
            let id = NEXT_DEVICE_ID.fetch_add(1, Ordering::SeqCst);
            DEVICES.lock().insert(id, port);
            log_event(
                "device",
                &format!("Opened device {} as id={}", port_name, id),
                "result",
                None,
            );
            id
        }
        Err(e) => {
            log_event(
                "device",
                &format!("Failed to open {}: {}", port_name, e),
                "error",
                None,
            );
            0
        }
    }
}

/// Close a serial device. Returns 0 on success, 1 on failure.
pub fn close_device(device_id: u64) -> u8 {
    log_event("device", &format!("Closing device {}", device_id), "close", None);

    match DEVICES.lock().remove(&device_id) {
        Some(_port) => {
            log_event("device", &format!("Closed device {}", device_id), "result", None);
            0
        }
        None => {
            log_event(
                "device",
                &format!("Device {} not found", device_id),
                "error",
                None,
            );
            1
        }
    }
}

/// Configure a serial device. Returns 0 on success, 1 on failure.
pub fn configure_device(device_id: u64, config_json: &str) -> u8 {
    log_event("device", &format!("Configuring device {}", device_id), "config", None);

    let config: DeviceConfig = match serde_json::from_str(config_json) {
        Ok(c) => c,
        Err(e) => {
            log_event("device", &format!("Invalid config JSON: {}", e), "error", None);
            return 1;
        }
    };

    let mut devices = DEVICES.lock();
    let port = match devices.get_mut(&device_id) {
        Some(p) => p,
        None => {
            log_event("device", &format!("Device {} not found", device_id), "error", None);
            return 1;
        }
    };

    if let Some(data_bits) = config.data_bits {
        let db = match data_bits {
            5 => serialport::DataBits::Five,
            6 => serialport::DataBits::Six,
            7 => serialport::DataBits::Seven,
            8 => serialport::DataBits::Eight,
            _ => {
                log_event("device", &format!("Invalid data bits: {}", data_bits), "error", None);
                return 1;
            }
        };
        if port.set_data_bits(db).is_err() {
            return 1;
        }
    }

    if let Some(stop_bits) = config.stop_bits {
        let sb = match stop_bits {
            1 => serialport::StopBits::One,
            2 => serialport::StopBits::Two,
            _ => {
                log_event("device", &format!("Invalid stop bits: {}", stop_bits), "error", None);
                return 1;
            }
        };
        if port.set_stop_bits(sb).is_err() {
            return 1;
        }
    }

    if let Some(ref parity) = config.parity {
        let p = match parity.as_str() {
            "none" => serialport::Parity::None,
            "odd" => serialport::Parity::Odd,
            "even" => serialport::Parity::Even,
            _ => {
                log_event("device", &format!("Invalid parity: {}", parity), "error", None);
                return 1;
            }
        };
        if port.set_parity(p).is_err() {
            return 1;
        }
    }

    if let Some(ref flow_control) = config.flow_control {
        let fc = match flow_control.as_str() {
            "none" => serialport::FlowControl::None,
            "software" => serialport::FlowControl::Software,
            "hardware" => serialport::FlowControl::Hardware,
            _ => {
                log_event(
                    "device",
                    &format!("Invalid flow control: {}", flow_control),
                    "error",
                    None,
                );
                return 1;
            }
        };
        if port.set_flow_control(fc).is_err() {
            return 1;
        }
    }

    if let Some(timeout_ms) = config.timeout_ms {
        if port.set_timeout(Duration::from_millis(timeout_ms)).is_err() {
            return 1;
        }
    }

    log_event("device", &format!("Configured device {}", device_id), "result", None);
    0
}

/// Access a device by ID for I/O operations (internal use)
pub fn with_device<F, R>(device_id: u64, f: F) -> Option<R>
where
    F: FnOnce(&mut Box<dyn SerialPort>) -> R,
{
    let mut devices = DEVICES.lock();
    devices.get_mut(&device_id).map(f)
}

/// Get count of open devices (for testing/diagnostics)
pub fn device_count() -> usize {
    DEVICES.lock().len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_nonexistent_port() {
        let id = open_device("/dev/nonexistent_port_xyz", 9600);
        assert_eq!(id, 0);
    }

    #[test]
    fn test_close_nonexistent_device() {
        let result = close_device(99999);
        assert_eq!(result, 1);
    }

    #[test]
    fn test_configure_invalid_json() {
        let result = configure_device(1, "not json");
        assert_eq!(result, 1);
    }

    #[test]
    fn test_configure_nonexistent_device() {
        let result = configure_device(99999, r#"{"data_bits": 8}"#);
        assert_eq!(result, 1);
    }

    #[test]
    fn test_device_config_parse() {
        let json = r#"{"data_bits":8,"stop_bits":1,"parity":"none","flow_control":"none","timeout_ms":500}"#;
        let config: DeviceConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.data_bits, Some(8));
        assert_eq!(config.stop_bits, Some(1));
        assert_eq!(config.parity.as_deref(), Some("none"));
        assert_eq!(config.flow_control.as_deref(), Some("none"));
        assert_eq!(config.timeout_ms, Some(500));
    }

    #[test]
    fn test_device_count() {
        // Should not panic
        let _count = device_count();
    }
}
