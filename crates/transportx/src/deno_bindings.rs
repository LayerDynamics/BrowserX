// This file contains all FFI exports for deno_bindgen
// All #[deno_bindgen] decorated functions MUST be in this file
// deno_bindgen does NOT support cross-module type references

// NOTE: transportx_init, transportx_version, transportx_get_last_error are exported from error.rs

use deno_bindgen::deno_bindgen;

// ============================================================================
// QUIC AVAILABILITY
// ============================================================================

/// Check if QUIC transport is available (quiche compiled in).
/// Always returns 1 since quiche is a hard dependency.
#[deno_bindgen]
pub fn quic_is_available() -> u8 {
    1
}

// ============================================================================
// UDP SOCKET
// ============================================================================

/// Create a non-blocking UDP socket bound to `bind_addr`.
/// Returns handle > 0 on success, 0 on failure.
#[deno_bindgen]
pub fn udp_socket_create(bind_addr: &str) -> u64 {
    crate::udp::create_udp_socket(bind_addr)
}

/// Close a UDP socket.
#[deno_bindgen]
pub fn udp_socket_close(handle: u64) {
    crate::udp::close_udp_socket(handle);
}

// ============================================================================
// QUIC CONNECTION
// ============================================================================

/// Create a QUIC connection from JSON config.
/// Config fields: socket_handle, idle_timeout_ms, initial_max_data, alpn, verify_peer, etc.
/// Returns handle > 0 on success, 0 on failure.
#[deno_bindgen]
pub fn quic_connection_create(config_json: &str) -> u64 {
    crate::quic::create_connection(config_json)
}

/// Initiate QUIC handshake to host:port.
/// Returns 1 on success, 0 on failure.
#[deno_bindgen]
pub fn quic_connection_connect(handle: u64, host: &str, port: u16) -> u8 {
    crate::quic::connect(handle, host, port)
}

/// Poll a QUIC connection: recv/send UDP packets, return JSON events array.
/// Events: connected, stream_readable, stream_writable, stream_finished, connection_closed, error, none
#[deno_bindgen]
pub fn quic_connection_poll(handle: u64) -> String {
    crate::quic::poll_connection(handle)
}

/// Close a QUIC connection gracefully with error code and reason.
/// Returns 1 on success, 0 on failure.
#[deno_bindgen]
pub fn quic_connection_close(handle: u64, error_code: u64, reason: &str) -> u8 {
    crate::quic::close_connection(handle, error_code, reason)
}

/// Get connection state: 0=Idle, 1=Connecting, 2=Connected, 3=Draining, 4=Closed, 5=Error
#[deno_bindgen]
pub fn quic_connection_get_state(handle: u64) -> u32 {
    crate::quic::get_connection_state(handle)
}

/// Get connection statistics as JSON.
#[deno_bindgen]
pub fn quic_connection_get_stats(handle: u64) -> String {
    crate::quic::get_connection_stats(handle)
}

/// Check if QUIC handshake is complete.
/// Returns 1 if established, 0 otherwise.
#[deno_bindgen]
pub fn quic_connection_is_established(handle: u64) -> u8 {
    crate::quic::is_established(handle)
}

/// Check if connection is closed.
/// Returns 1 if closed, 0 otherwise.
#[deno_bindgen]
pub fn quic_connection_is_closed(handle: u64) -> u8 {
    crate::quic::is_closed(handle)
}

// ============================================================================
// QUIC STREAMS
// ============================================================================

/// Send data on a QUIC stream. `data` is base64-encoded.
/// `fin` = 1 to signal end of stream.
/// Returns bytes written (>= 0) or -1 on error.
#[deno_bindgen]
pub fn quic_stream_send(conn_handle: u64, stream_id: u64, data: &str, fin: u8) -> i32 {
    crate::quic::stream_send(conn_handle, stream_id, data, fin)
}

/// Receive data from a QUIC stream.
/// Returns JSON: {"data": "<base64>", "fin": bool, "len": N} or empty string on error.
#[deno_bindgen]
pub fn quic_stream_recv(conn_handle: u64, stream_id: u64) -> String {
    crate::quic::stream_recv(conn_handle, stream_id)
}

/// Shutdown a stream. direction: 0=read, 1=write.
/// Returns 1 on success, 0 on failure.
#[deno_bindgen]
pub fn quic_stream_shutdown(conn_handle: u64, stream_id: u64, direction: u8, error_code: u64) -> u8 {
    crate::quic::stream_shutdown(conn_handle, stream_id, direction, error_code)
}

/// Get stream send capacity in bytes. Returns -1 on error.
#[deno_bindgen]
pub fn quic_stream_capacity(conn_handle: u64, stream_id: u64) -> i64 {
    crate::quic::stream_capacity(conn_handle, stream_id)
}

/// Check if a stream is fully received (FIN + all data read).
/// Returns 1 if finished, 0 otherwise.
#[deno_bindgen]
pub fn quic_stream_finished(conn_handle: u64, stream_id: u64) -> u8 {
    crate::quic::stream_finished(conn_handle, stream_id)
}

// ============================================================================
// HTTP/3
// ============================================================================

/// Create an HTTP/3 connection on top of an existing QUIC connection.
/// config_json: {"max_header_list_size": N, "qpack_max_table_capacity": N, ...}
/// Returns 1 on success, 0 on failure.
#[deno_bindgen]
pub fn http3_connection_create(conn_handle: u64, config_json: &str) -> u8 {
    crate::quic::create_http3(conn_handle, config_json)
}

/// Send an HTTP/3 request.
/// headers_json: JSON array of {name, value}.
/// body: base64-encoded body (empty string for no body).
/// fin: 1 if request has no body, 0 if body follows.
/// Returns stream_id (>= 0) or -1 on error.
#[deno_bindgen]
pub fn http3_send_request(conn_handle: u64, headers_json: &str, body: &str, fin: u8) -> i64 {
    crate::quic::http3_send_request(conn_handle, headers_json, body, fin)
}

/// Poll HTTP/3 events. Returns JSON array of events.
/// Events: headers, data, finished, reset, goaway, error, none
#[deno_bindgen]
pub fn http3_poll(conn_handle: u64) -> String {
    crate::quic::http3_poll_events(conn_handle)
}

/// Send HTTP/3 response headers (server-side).
/// Returns 1 on success, 0 on failure.
#[deno_bindgen]
pub fn http3_send_response(conn_handle: u64, stream_id: u64, headers_json: &str, fin: u8) -> u8 {
    crate::quic::http3_send_response(conn_handle, stream_id, headers_json, fin)
}

/// Send HTTP/3 body data. `data` is base64-encoded.
/// Returns 1 on success, 0 on failure.
#[deno_bindgen]
pub fn http3_send_body(conn_handle: u64, stream_id: u64, data: &str, fin: u8) -> u8 {
    crate::quic::http3_send_body(conn_handle, stream_id, data, fin)
}

/// Get HTTP/3 connection settings as JSON.
#[deno_bindgen]
pub fn http3_get_settings(conn_handle: u64) -> String {
    crate::quic::http3_get_settings(conn_handle)
}

// ============================================================================
// LIBRARY LIFECYCLE
// ============================================================================

/// Preload / warm-up the native library.
/// Returns 1 (always succeeds since the library is already loaded by this point).
#[deno_bindgen]
pub fn preload_lib() -> u8 {
    1
}


/// Close the native library and release all managed resources:
/// HTTP/3 connections, QUIC connections, and UDP sockets.
#[deno_bindgen]
pub fn close_lib() -> u8 {
    // Close all HTTP/3 connections
    {
        let mut h3_conns = crate::quic::http3::H3_CONNECTIONS.write();
        h3_conns.clear();
    }
    // Close all QUIC connections
    {
        let mut conns = crate::quic::connection::CONNECTIONS.write();
        for (_handle, qconn) in conns.iter_mut() {
            let _ = qconn.conn.close(true, 0, b"library shutdown");
        }
        conns.clear();
    }
    // Close all UDP sockets
    {
        let mut sockets = crate::udp::socket::UDP_SOCKETS.write();
        sockets.clear();
    }
    1
}
