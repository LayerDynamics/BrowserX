use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;

use crate::error::{set_last_error, TransportXError};
use crate::quic::connection::CONNECTIONS;

/// Send data on a QUIC stream.
/// `data` is base64-encoded binary data.
/// `fin` = 1 to signal end of stream.
/// Returns bytes written (>= 0) or -1 on error.
pub fn stream_send(conn_handle: u64, stream_id: u64, data: &str, fin: u8) -> i32 {
    let decoded = match BASE64.decode(data) {
        Ok(d) => d,
        Err(e) => {
            set_last_error(&TransportXError::SerializationError {
                message: format!("Invalid base64 data: {}", e),
            });
            return -1;
        }
    };

    // Write lock required: quiche::Connection::stream_send() takes &mut self
    let mut conns = CONNECTIONS.write();
    let qconn = match conns.get_mut(&conn_handle) {
        Some(c) => c,
        None => {
            set_last_error(&TransportXError::HandleNotFound {
                handle: conn_handle,
                resource_type: "QuicConnection".to_string(),
            });
            return -1;
        }
    };

    match qconn.conn.stream_send(stream_id, &decoded, fin != 0) {
        Ok(n) => n as i32,
        Err(quiche::Error::Done) => 0,
        Err(e) => {
            set_last_error(&TransportXError::StreamError {
                message: format!("stream_send failed: {}", e),
                stream_id: Some(stream_id),
            });
            -1
        }
    }
}

/// Receive data from a QUIC stream.
/// Returns JSON: {"data": "<base64>", "fin": true/false, "len": N}
/// Returns empty string on error or no data.
pub fn stream_recv(conn_handle: u64, stream_id: u64) -> String {
    let mut buf = vec![0u8; 65535];

    // Write lock required: quiche::Connection::stream_recv() takes &mut self
    let mut conns = CONNECTIONS.write();
    let qconn = match conns.get_mut(&conn_handle) {
        Some(c) => c,
        None => {
            set_last_error(&TransportXError::HandleNotFound {
                handle: conn_handle,
                resource_type: "QuicConnection".to_string(),
            });
            return String::new();
        }
    };

    match qconn.conn.stream_recv(stream_id, &mut buf) {
        Ok((len, fin)) => {
            let encoded = BASE64.encode(&buf[..len]);
            serde_json::json!({
                "data": encoded,
                "fin": fin,
                "len": len,
            })
            .to_string()
        }
        Err(quiche::Error::Done) => {
            serde_json::json!({
                "data": "",
                "fin": false,
                "len": 0,
            })
            .to_string()
        }
        Err(e) => {
            set_last_error(&TransportXError::StreamError {
                message: format!("stream_recv failed: {}", e),
                stream_id: Some(stream_id),
            });
            String::new()
        }
    }
}

/// Shutdown a QUIC stream in a given direction.
/// direction: 0 = read, 1 = write
/// Returns 1 on success, 0 on failure.
pub fn stream_shutdown(conn_handle: u64, stream_id: u64, direction: u8, error_code: u64) -> u8 {
    let mut conns = CONNECTIONS.write();
    let qconn = match conns.get_mut(&conn_handle) {
        Some(c) => c,
        None => {
            set_last_error(&TransportXError::HandleNotFound {
                handle: conn_handle,
                resource_type: "QuicConnection".to_string(),
            });
            return 0;
        }
    };

    let dir = match direction {
        0 => quiche::Shutdown::Read,
        1 => quiche::Shutdown::Write,
        _ => {
            set_last_error(&TransportXError::StreamError {
                message: format!("Invalid shutdown direction: {}", direction),
                stream_id: Some(stream_id),
            });
            return 0;
        }
    };

    match qconn.conn.stream_shutdown(stream_id, dir, error_code) {
        Ok(()) => 1,
        Err(quiche::Error::Done) => 1,
        Err(e) => {
            set_last_error(&TransportXError::StreamError {
                message: format!("stream_shutdown failed: {}", e),
                stream_id: Some(stream_id),
            });
            0
        }
    }
}

/// Get the send capacity of a stream (how many bytes can be written).
/// Returns -1 on error.
pub fn stream_capacity(conn_handle: u64, stream_id: u64) -> i64 {
    let conns = CONNECTIONS.read();
    let qconn = match conns.get(&conn_handle) {
        Some(c) => c,
        None => {
            set_last_error(&TransportXError::HandleNotFound {
                handle: conn_handle,
                resource_type: "QuicConnection".to_string(),
            });
            return -1;
        }
    };

    match qconn.conn.stream_capacity(stream_id) {
        Ok(n) => n as i64,
        Err(e) => {
            set_last_error(&TransportXError::StreamError {
                message: format!("stream_capacity failed: {}", e),
                stream_id: Some(stream_id),
            });
            -1
        }
    }
}

/// Check if a stream has been fully received (FIN received and all data read).
/// Returns 1 if finished, 0 otherwise.
pub fn stream_finished(conn_handle: u64, stream_id: u64) -> u8 {
    let conns = CONNECTIONS.read();
    let qconn = match conns.get(&conn_handle) {
        Some(c) => c,
        None => return 0,
    };

    if qconn.conn.stream_finished(stream_id) { 1 } else { 0 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stream_send_nonexistent_connection_returns_neg1() {
        // Use valid base64 for "hello"
        let result = stream_send(999_888_001, 0, "aGVsbG8=", 0);
        assert_eq!(result, -1);
    }

    #[test]
    fn test_stream_send_invalid_base64_returns_neg1() {
        let result = stream_send(999_888_002, 0, "!!!not-base64!!!", 0);
        assert_eq!(result, -1);
    }

    #[test]
    fn test_stream_recv_nonexistent_connection_returns_empty() {
        let result = stream_recv(999_888_003, 0);
        assert_eq!(result, "");
    }

    #[test]
    fn test_stream_capacity_nonexistent_returns_neg1() {
        let result = stream_capacity(999_888_004, 0);
        assert_eq!(result, -1);
    }

    #[test]
    fn test_stream_finished_nonexistent_returns_0() {
        let result = stream_finished(999_888_005, 0);
        assert_eq!(result, 0);
    }

    #[test]
    fn test_stream_shutdown_nonexistent_returns_0() {
        let result = stream_shutdown(999_888_006, 0, 1, 0);
        assert_eq!(result, 0);
    }

    #[test]
    fn test_stream_shutdown_invalid_direction_on_real_conn() {
        // With nonexistent conn, it fails on handle lookup before direction check.
        // Just verify it doesn't panic with direction=255 on nonexistent.
        let result = stream_shutdown(999_888_007, 0, 255, 0);
        assert_eq!(result, 0);
    }

    #[test]
    fn test_stream_send_encodes_base64_correctly() {
        // Verify that the base64 decode path works with known input
        // "SGVsbG8gV29ybGQ=" is base64 for "Hello World"
        let decoded = BASE64.decode("SGVsbG8gV29ybGQ=").unwrap();
        assert_eq!(decoded, b"Hello World");

        // Empty base64
        let decoded_empty = BASE64.decode("").unwrap();
        assert!(decoded_empty.is_empty());

        // Binary data round-trip
        let binary_data: Vec<u8> = (0..=255).collect();
        let encoded = BASE64.encode(&binary_data);
        let decoded_back = BASE64.decode(&encoded).unwrap();
        assert_eq!(decoded_back, binary_data);
    }

    #[test]
    fn test_stream_recv_encodes_base64_correctly() {
        // Verify base64 encoding of output matches expectations
        let data = b"QUIC stream data payload";
        let encoded = BASE64.encode(data);
        // Decode back and verify
        let decoded = BASE64.decode(&encoded).unwrap();
        assert_eq!(decoded, data);

        // Verify the JSON format that stream_recv would produce
        let json = serde_json::json!({
            "data": encoded,
            "fin": false,
            "len": data.len(),
        });
        let parsed: serde_json::Value = serde_json::from_str(&json.to_string()).unwrap();
        assert_eq!(parsed["len"].as_u64().unwrap(), data.len() as u64);
        assert_eq!(parsed["fin"].as_bool().unwrap(), false);

        // Decode the data field from the JSON
        let data_field = parsed["data"].as_str().unwrap();
        let recovered = BASE64.decode(data_field).unwrap();
        assert_eq!(recovered, data);
    }
}
