use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use lazy_static::lazy_static;
use parking_lot::RwLock;
use quiche::h3::NameValue;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::{set_last_error, TransportXError};
use crate::quic::connection::CONNECTIONS;

/// HTTP/3 connection wrapper stored per QUIC connection handle
pub struct Http3Connection {
    pub h3_conn: quiche::h3::Connection,
}

lazy_static! {
    /// HTTP/3 connections keyed by the same handle as their parent QUIC connection
    pub static ref H3_CONNECTIONS: RwLock<HashMap<u64, Http3Connection>> = RwLock::new(HashMap::new());
}

/// Configuration for HTTP/3 connection
#[derive(Debug, Deserialize)]
pub struct Http3Config {
    /// Max header list size (default 16384)
    #[serde(default = "default_max_header_list_size")]
    pub max_header_list_size: u64,
    /// QPACK max table capacity (default 4096)
    #[serde(default = "default_qpack_max_table_capacity")]
    pub qpack_max_table_capacity: u64,
    /// QPACK blocked streams (default 100)
    #[serde(default = "default_qpack_blocked_streams")]
    pub qpack_blocked_streams: u64,
}

fn default_max_header_list_size() -> u64 { 16384 }
fn default_qpack_max_table_capacity() -> u64 { 4096 }
fn default_qpack_blocked_streams() -> u64 { 100 }

/// HTTP/3 event returned from polling
#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum Http3Event {
    #[serde(rename = "headers")]
    Headers {
        stream_id: u64,
        headers: Vec<Http3Header>,
        has_body: bool,
    },
    #[serde(rename = "data")]
    Data {
        stream_id: u64,
        data: String,
        len: usize,
    },
    #[serde(rename = "finished")]
    Finished { stream_id: u64 },
    #[serde(rename = "reset")]
    Reset { stream_id: u64, error_code: u64 },
    #[serde(rename = "goaway")]
    GoAway { stream_id: u64 },
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "none")]
    None,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Http3Header {
    pub name: String,
    pub value: String,
}

/// Create an HTTP/3 connection on top of an existing QUIC connection.
/// Returns 1 on success, 0 on failure.
pub fn create_http3(conn_handle: u64, config_json: &str) -> u8 {
    let config: Http3Config = match serde_json::from_str(config_json) {
        Ok(c) => c,
        Err(e) => {
            set_last_error(&TransportXError::ConfigError {
                field: "config_json".to_string(),
                message: format!("Invalid HTTP/3 config JSON: {}", e),
            });
            return 0;
        }
    };

    let mut h3_config = match quiche::h3::Config::new() {
        Ok(c) => c,
        Err(e) => {
            set_last_error(&TransportXError::Http3Error {
                message: format!("Failed to create h3::Config: {}", e),
            });
            return 0;
        }
    };
    h3_config.set_max_field_section_size(config.max_header_list_size);
    h3_config.set_qpack_max_table_capacity(config.qpack_max_table_capacity);
    h3_config.set_qpack_blocked_streams(config.qpack_blocked_streams);

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

    let h3_conn = match quiche::h3::Connection::with_transport(&mut qconn.conn, &h3_config) {
        Ok(c) => c,
        Err(e) => {
            set_last_error(&TransportXError::Http3Error {
                message: format!("Failed to create HTTP/3 connection: {}", e),
            });
            return 0;
        }
    };

    H3_CONNECTIONS.write().insert(conn_handle, Http3Connection { h3_conn });
    1
}

/// Send an HTTP/3 request.
/// headers_json: JSON array of {name, value} objects
/// body: base64-encoded body data
/// fin: 1 if no body follows, 0 if body will be sent separately
/// Returns stream_id (>= 0) or -1 on error.
pub fn http3_send_request(conn_handle: u64, headers_json: &str, body: &str, fin: u8) -> i64 {
    let headers: Vec<Http3Header> = match serde_json::from_str(headers_json) {
        Ok(h) => h,
        Err(e) => {
            set_last_error(&TransportXError::SerializationError {
                message: format!("Invalid headers JSON: {}", e),
            });
            return -1;
        }
    };

    let h3_headers: Vec<quiche::h3::Header> = headers
        .iter()
        .map(|h| quiche::h3::Header::new(h.name.as_bytes(), h.value.as_bytes()))
        .collect();

    // Acquire CONNECTIONS first, then H3_CONNECTIONS (consistent lock ordering)
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

    let mut h3_conns = H3_CONNECTIONS.write();
    let h3 = match h3_conns.get_mut(&conn_handle) {
        Some(c) => c,
        None => {
            set_last_error(&TransportXError::HandleNotFound {
                handle: conn_handle,
                resource_type: "Http3Connection".to_string(),
            });
            return -1;
        }
    };

    let stream_id = match h3.h3_conn.send_request(&mut qconn.conn, &h3_headers, fin != 0) {
        Ok(id) => id,
        Err(e) => {
            set_last_error(&TransportXError::Http3Error {
                message: format!("Failed to send HTTP/3 request: {}", e),
            });
            return -1;
        }
    };

    // If there's body data and fin is not set, send body
    if !body.is_empty() && fin == 0 {
        let decoded = match BASE64.decode(body) {
            Ok(d) => d,
            Err(e) => {
                set_last_error(&TransportXError::SerializationError {
                    message: format!("Invalid base64 body: {}", e),
                });
                return -1;
            }
        };

        if let Err(e) = h3.h3_conn.send_body(&mut qconn.conn, stream_id, &decoded, false) {
            set_last_error(&TransportXError::Http3Error {
                message: format!("Failed to send request body: {}", e),
            });
        }
    }

    stream_id as i64
}

/// Poll HTTP/3 events.
/// Returns JSON array of events.
pub fn http3_poll_events(conn_handle: u64) -> String {
    let mut events: Vec<Http3Event> = Vec::new();

    // Acquire CONNECTIONS first, then H3_CONNECTIONS (consistent lock ordering)
    let mut conns = CONNECTIONS.write();
    let qconn = match conns.get_mut(&conn_handle) {
        Some(c) => c,
        None => {
            return serde_json::to_string(&vec![Http3Event::Error {
                message: format!("QUIC connection {} not found", conn_handle),
            }])
            .unwrap_or_default();
        }
    };

    let mut h3_conns = H3_CONNECTIONS.write();
    let h3 = match h3_conns.get_mut(&conn_handle) {
        Some(c) => c,
        None => {
            return serde_json::to_string(&vec![Http3Event::Error {
                message: format!("HTTP/3 connection {} not found", conn_handle),
            }])
            .unwrap_or_default();
        }
    };

    loop {
        match h3.h3_conn.poll(&mut qconn.conn) {
            Ok((stream_id, quiche::h3::Event::Headers { list, has_body })) => {
                let headers: Vec<Http3Header> = list
                    .iter()
                    .map(|h| Http3Header {
                        name: String::from_utf8_lossy(h.name()).to_string(),
                        value: String::from_utf8_lossy(h.value()).to_string(),
                    })
                    .collect();
                events.push(Http3Event::Headers {
                    stream_id,
                    headers,
                    has_body,
                });
            }
            Ok((stream_id, quiche::h3::Event::Data)) => {
                let mut buf = vec![0u8; 65535];
                match h3.h3_conn.recv_body(&mut qconn.conn, stream_id, &mut buf) {
                    Ok(len) => {
                        let encoded = BASE64.encode(&buf[..len]);
                        events.push(Http3Event::Data {
                            stream_id,
                            data: encoded,
                            len,
                        });
                    }
                    Err(quiche::h3::Error::Done) => {}
                    Err(e) => {
                        events.push(Http3Event::Error {
                            message: format!("recv_body error on stream {}: {}", stream_id, e),
                        });
                    }
                }
            }
            Ok((stream_id, quiche::h3::Event::Finished)) => {
                events.push(Http3Event::Finished { stream_id });
            }
            Ok((stream_id, quiche::h3::Event::Reset(error_code))) => {
                events.push(Http3Event::Reset {
                    stream_id,
                    error_code: error_code as u64,
                });
            }
            Ok((stream_id, quiche::h3::Event::GoAway)) => {
                events.push(Http3Event::GoAway { stream_id });
            }
            Ok((_stream_id, quiche::h3::Event::PriorityUpdate)) => {
                // Priority updates are informational; no action needed
            }
            Err(quiche::h3::Error::Done) => break,
            Err(e) => {
                events.push(Http3Event::Error {
                    message: format!("HTTP/3 poll error: {}", e),
                });
                break;
            }
        }
    }

    if events.is_empty() {
        events.push(Http3Event::None);
    }

    serde_json::to_string(&events).unwrap_or_else(|_| "[]".to_string())
}

/// Send an HTTP/3 response (server-side).
/// Returns 1 on success, 0 on failure.
pub fn http3_send_response(conn_handle: u64, stream_id: u64, headers_json: &str, fin: u8) -> u8 {
    let headers: Vec<Http3Header> = match serde_json::from_str(headers_json) {
        Ok(h) => h,
        Err(e) => {
            set_last_error(&TransportXError::SerializationError {
                message: format!("Invalid headers JSON: {}", e),
            });
            return 0;
        }
    };

    let h3_headers: Vec<quiche::h3::Header> = headers
        .iter()
        .map(|h| quiche::h3::Header::new(h.name.as_bytes(), h.value.as_bytes()))
        .collect();

    // Acquire CONNECTIONS first, then H3_CONNECTIONS (consistent lock ordering)
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

    let mut h3_conns = H3_CONNECTIONS.write();
    let h3 = match h3_conns.get_mut(&conn_handle) {
        Some(c) => c,
        None => {
            set_last_error(&TransportXError::HandleNotFound {
                handle: conn_handle,
                resource_type: "Http3Connection".to_string(),
            });
            return 0;
        }
    };

    match h3.h3_conn.send_response(&mut qconn.conn, stream_id, &h3_headers, fin != 0) {
        Ok(_) => 1,
        Err(e) => {
            set_last_error(&TransportXError::Http3Error {
                message: format!("Failed to send HTTP/3 response: {}", e),
            });
            0
        }
    }
}

/// Send HTTP/3 body data on a stream.
/// data is base64-encoded.
/// Returns 1 on success, 0 on failure.
pub fn http3_send_body(conn_handle: u64, stream_id: u64, data: &str, fin: u8) -> u8 {
    let decoded = match BASE64.decode(data) {
        Ok(d) => d,
        Err(e) => {
            set_last_error(&TransportXError::SerializationError {
                message: format!("Invalid base64 body: {}", e),
            });
            return 0;
        }
    };

    // Acquire CONNECTIONS first, then H3_CONNECTIONS (consistent lock ordering)
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

    let mut h3_conns = H3_CONNECTIONS.write();
    let h3 = match h3_conns.get_mut(&conn_handle) {
        Some(c) => c,
        None => {
            set_last_error(&TransportXError::HandleNotFound {
                handle: conn_handle,
                resource_type: "Http3Connection".to_string(),
            });
            return 0;
        }
    };

    match h3.h3_conn.send_body(&mut qconn.conn, stream_id, &decoded, fin != 0) {
        Ok(_) => 1,
        Err(e) => {
            set_last_error(&TransportXError::Http3Error {
                message: format!("Failed to send HTTP/3 body: {}", e),
            });
            0
        }
    }
}

/// Get HTTP/3 connection settings as JSON.
pub fn http3_get_settings(conn_handle: u64) -> String {
    let h3_conns = H3_CONNECTIONS.read();
    let _h3 = match h3_conns.get(&conn_handle) {
        Some(c) => c,
        None => {
            set_last_error(&TransportXError::HandleNotFound {
                handle: conn_handle,
                resource_type: "Http3Connection".to_string(),
            });
            return "{}".to_string();
        }
    };

    serde_json::json!({
        "conn_handle": conn_handle,
        "protocol": "h3",
    })
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_http3_nonexistent_connection_returns_0() {
        let result = create_http3(999_777_001, "{}");
        assert_eq!(result, 0);
    }

    #[test]
    fn test_create_http3_invalid_config_returns_0() {
        let result = create_http3(999_777_002, "not json");
        assert_eq!(result, 0);
    }

    #[test]
    fn test_http3_poll_events_nonexistent_returns_error() {
        let result = http3_poll_events(999_777_003);
        let events: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap();
        assert!(!events.is_empty());
        assert_eq!(events[0]["type"], "error");
    }

    #[test]
    fn test_http3_send_request_nonexistent_returns_neg1() {
        let headers = r#"[{"name":":method","value":"GET"}]"#;
        let result = http3_send_request(999_777_004, headers, "", 1);
        assert_eq!(result, -1);
    }

    #[test]
    fn test_http3_send_request_invalid_headers_returns_neg1() {
        let result = http3_send_request(999_777_005, "not json", "", 1);
        assert_eq!(result, -1);
    }

    #[test]
    fn test_http3_get_settings_nonexistent_returns_empty_json() {
        let result = http3_get_settings(999_777_006);
        assert_eq!(result, "{}");
    }

    #[test]
    fn test_http3_send_response_nonexistent_returns_0() {
        let headers = r#"[{"name":":status","value":"200"}]"#;
        let result = http3_send_response(999_777_007, 0, headers, 1);
        assert_eq!(result, 0);
    }

    #[test]
    fn test_http3_send_body_nonexistent_returns_0() {
        let result = http3_send_body(999_777_008, 0, "aGVsbG8=", 1);
        assert_eq!(result, 0);
    }

    #[test]
    fn test_http3_send_body_invalid_base64_returns_0() {
        let result = http3_send_body(999_777_009, 0, "!!!bad!!!", 1);
        assert_eq!(result, 0);
    }

    #[test]
    fn test_http3_header_serialization() {
        let header = Http3Header {
            name: ":method".to_string(),
            value: "GET".to_string(),
        };
        let json = serde_json::to_string(&header).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["name"], ":method");
        assert_eq!(parsed["value"], "GET");

        // Round-trip deserialization
        let deserialized: Http3Header = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, ":method");
        assert_eq!(deserialized.value, "GET");

        // Multiple headers as array
        let headers = vec![
            Http3Header { name: ":method".to_string(), value: "POST".to_string() },
            Http3Header { name: ":path".to_string(), value: "/api/data".to_string() },
            Http3Header { name: "content-type".to_string(), value: "application/json".to_string() },
        ];
        let json_arr = serde_json::to_string(&headers).unwrap();
        let parsed_arr: Vec<Http3Header> = serde_json::from_str(&json_arr).unwrap();
        assert_eq!(parsed_arr.len(), 3);
        assert_eq!(parsed_arr[1].name, ":path");
        assert_eq!(parsed_arr[2].value, "application/json");
    }

    #[test]
    fn test_http3_event_serialization() {
        // Headers event
        let evt = Http3Event::Headers {
            stream_id: 4,
            headers: vec![Http3Header { name: ":status".to_string(), value: "200".to_string() }],
            has_body: true,
        };
        let json = serde_json::to_string(&evt).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["type"], "headers");
        assert_eq!(parsed["stream_id"], 4);
        assert_eq!(parsed["has_body"], true);
        assert_eq!(parsed["headers"][0]["name"], ":status");

        // Data event
        let evt_data = Http3Event::Data {
            stream_id: 8,
            data: "aGVsbG8=".to_string(),
            len: 5,
        };
        let json_data = serde_json::to_string(&evt_data).unwrap();
        let parsed_data: serde_json::Value = serde_json::from_str(&json_data).unwrap();
        assert_eq!(parsed_data["type"], "data");
        assert_eq!(parsed_data["stream_id"], 8);
        assert_eq!(parsed_data["len"], 5);

        // Finished event
        let evt_fin = Http3Event::Finished { stream_id: 12 };
        let json_fin = serde_json::to_string(&evt_fin).unwrap();
        let parsed_fin: serde_json::Value = serde_json::from_str(&json_fin).unwrap();
        assert_eq!(parsed_fin["type"], "finished");

        // Reset event
        let evt_reset = Http3Event::Reset { stream_id: 16, error_code: 42 };
        let json_reset = serde_json::to_string(&evt_reset).unwrap();
        let parsed_reset: serde_json::Value = serde_json::from_str(&json_reset).unwrap();
        assert_eq!(parsed_reset["type"], "reset");
        assert_eq!(parsed_reset["error_code"], 42);

        // GoAway event
        let evt_goaway = Http3Event::GoAway { stream_id: 0 };
        let json_goaway = serde_json::to_string(&evt_goaway).unwrap();
        let parsed_goaway: serde_json::Value = serde_json::from_str(&json_goaway).unwrap();
        assert_eq!(parsed_goaway["type"], "goaway");

        // Error event
        let evt_err = Http3Event::Error { message: "test error".to_string() };
        let json_err = serde_json::to_string(&evt_err).unwrap();
        let parsed_err: serde_json::Value = serde_json::from_str(&json_err).unwrap();
        assert_eq!(parsed_err["type"], "error");
        assert_eq!(parsed_err["message"], "test error");

        // None event
        let evt_none = Http3Event::None;
        let json_none = serde_json::to_string(&evt_none).unwrap();
        let parsed_none: serde_json::Value = serde_json::from_str(&json_none).unwrap();
        assert_eq!(parsed_none["type"], "none");
    }

    #[test]
    fn test_http3_config_defaults() {
        // Empty JSON object should deserialize with all defaults
        let config: Http3Config = serde_json::from_str("{}").unwrap();
        assert_eq!(config.max_header_list_size, 16384);
        assert_eq!(config.qpack_max_table_capacity, 4096);
        assert_eq!(config.qpack_blocked_streams, 100);

        // Partial override
        let config2: Http3Config = serde_json::from_str(r#"{"max_header_list_size": 32768}"#).unwrap();
        assert_eq!(config2.max_header_list_size, 32768);
        assert_eq!(config2.qpack_max_table_capacity, 4096); // still default
        assert_eq!(config2.qpack_blocked_streams, 100); // still default

        // Full override
        let config3: Http3Config = serde_json::from_str(
            r#"{"max_header_list_size": 8192, "qpack_max_table_capacity": 2048, "qpack_blocked_streams": 50}"#
        ).unwrap();
        assert_eq!(config3.max_header_list_size, 8192);
        assert_eq!(config3.qpack_max_table_capacity, 2048);
        assert_eq!(config3.qpack_blocked_streams, 50);
    }
}
