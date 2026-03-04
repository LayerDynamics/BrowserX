//! Serial device I/O — read, write, flush

use std::io::{Read, Write};
use std::time::Duration;

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use crate::device::with_device;
use crate::trace::log_event;

/// Maximum read buffer size (1 MB) to prevent allocation panics from FFI input
const MAX_READ_BUFFER: usize = 1024 * 1024;

/// Write base64-encoded data to a device. Returns bytes written or -1 on error.
pub fn write_bytes(device_id: u64, data_b64: &str) -> i32 {
    let data = match BASE64.decode(data_b64) {
        Ok(d) => d,
        Err(e) => {
            log_event("io", &format!("Invalid base64 data: {}", e), "error", None);
            return -1;
        }
    };

    log_event(
        "io",
        &format!("Writing {} bytes to device {}", data.len(), device_id),
        "out",
        Some(&format!("{} bytes", data.len())),
    );

    match with_device(device_id, |port| port.write(&data)) {
        Some(Ok(n)) => {
            log_event("io", &format!("Wrote {} bytes", n), "result", None);
            std::cmp::min(n, i32::MAX as usize) as i32
        }
        Some(Err(e)) => {
            log_event("io", &format!("Write error: {}", e), "error", None);
            -1
        }
        None => {
            log_event("io", &format!("Device {} not found", device_id), "error", None);
            -1
        }
    }
}

/// Read data from a device. Returns base64-encoded data or empty string on error.
pub fn read_bytes(device_id: u64, max_len: usize, timeout_ms: u64) -> String {
    let max_len = std::cmp::min(max_len, MAX_READ_BUFFER);
    log_event(
        "io",
        &format!("Reading up to {} bytes from device {}", max_len, device_id),
        "in",
        None,
    );

    let mut buf = vec![0u8; max_len];
    match with_device(device_id, |port| {
        // Set timeout and read in a single lock acquisition to avoid TOCTOU race
        if timeout_ms > 0 {
            let _ = port.set_timeout(Duration::from_millis(timeout_ms));
        }
        port.read(&mut buf)
    }) {
        Some(Ok(n)) => {
            buf.truncate(n);
            let encoded = BASE64.encode(&buf);
            log_event("io", &format!("Read {} bytes", n), "result", None);
            encoded
        }
        Some(Err(e)) => {
            if e.kind() == std::io::ErrorKind::TimedOut {
                log_event("io", "Read timed out", "timeout", None);
            } else {
                log_event("io", &format!("Read error: {}", e), "error", None);
            }
            String::new()
        }
        None => {
            log_event("io", &format!("Device {} not found", device_id), "error", None);
            String::new()
        }
    }
}

/// Flush a device. Returns 0 on success, 1 on failure.
pub fn flush_device(device_id: u64) -> u8 {
    log_event("io", &format!("Flushing device {}", device_id), "flush", None);

    match with_device(device_id, |port| port.flush()) {
        Some(Ok(())) => {
            log_event("io", "Flush complete", "result", None);
            0
        }
        Some(Err(e)) => {
            log_event("io", &format!("Flush error: {}", e), "error", None);
            1
        }
        None => {
            log_event("io", &format!("Device {} not found", device_id), "error", None);
            1
        }
    }
}

/// Get bytes available for reading. Returns count or -1 on error.
pub fn bytes_available(device_id: u64) -> i32 {
    match with_device(device_id, |port| port.bytes_to_read()) {
        Some(Ok(n)) => std::cmp::min(n, i32::MAX as u32) as i32,
        Some(Err(_)) => -1,
        None => -1,
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base64_roundtrip() {
        let data = b"Hello, serial!";
        let encoded = BASE64.encode(data);
        let decoded = BASE64.decode(&encoded).unwrap();
        assert_eq!(decoded, data);
    }

    #[test]
    fn test_base64_empty() {
        let encoded = BASE64.encode(b"");
        assert_eq!(encoded, "");
        let decoded = BASE64.decode("").unwrap();
        assert!(decoded.is_empty());
    }

    #[test]
    fn test_write_nonexistent_device() {
        let result = write_bytes(99999, &BASE64.encode(b"test"));
        assert_eq!(result, -1);
    }

    #[test]
    fn test_read_nonexistent_device() {
        let result = read_bytes(99999, 1024, 100);
        assert_eq!(result, "");
    }

    #[test]
    fn test_flush_nonexistent_device() {
        let result = flush_device(99999);
        assert_eq!(result, 1);
    }

    #[test]
    fn test_bytes_available_nonexistent() {
        let result = bytes_available(99999);
        assert_eq!(result, -1);
    }

    #[test]
    fn test_invalid_base64() {
        let result = write_bytes(1, "!!!invalid!!!");
        assert_eq!(result, -1);
    }
}
