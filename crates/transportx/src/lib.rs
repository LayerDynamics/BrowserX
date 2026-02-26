//! TransportX — QUIC/HTTP3 Transport for Deno
//!
//! Provides QUIC and HTTP/3 transport via Cloudflare's quiche library,
//! exposed to Deno through deno_bindgen FFI.

pub mod error;
pub mod udp;
pub mod quic;

// All FFI bindings in one module
pub mod deno_bindings;

// Re-export main types and functions
pub use error::{
    transportx_init, transportx_version, transportx_get_last_error,
    TransportXError, TransportXResult,
};

pub use udp::{
    create_udp_socket, close_udp_socket,
};

pub use quic::{
    create_connection, connect, poll_connection, close_connection,
    get_connection_state, get_connection_stats, is_established, is_closed,
    ConnectionState,
};

pub use quic::stream::{
    stream_send, stream_recv, stream_shutdown, stream_capacity, stream_finished,
};

pub use quic::http3::{
    create_http3, http3_send_request, http3_poll_events, http3_send_response,
    http3_send_body, http3_get_settings,
};
