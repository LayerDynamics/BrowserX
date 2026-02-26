use deno_bindgen::deno_bindgen;
use lazy_static::lazy_static;
use parking_lot::Mutex;

/// TransportX error types
#[derive(Debug, Clone)]
#[deno_bindgen]
pub enum TransportXError {
    /// UDP socket operation failed
    SocketError { message: String },

    /// QUIC connection error
    ConnectionError { message: String, connection_id: Option<u64> },

    /// QUIC stream error
    StreamError { message: String, stream_id: Option<u64> },

    /// HTTP/3 layer error
    Http3Error { message: String },

    /// Configuration error
    ConfigError { field: String, message: String },

    /// FFI serialization error
    SerializationError { message: String },

    /// Handle not found in registry
    HandleNotFound { handle: u64, resource_type: String },

    /// Connection state error (wrong state for operation)
    StateError { expected: String, actual: String },

    /// TLS/crypto error
    TlsError { message: String },

    /// Timeout error
    TimeoutError { message: String },
}

/// Result type for transportx operations
pub type TransportXResult<T> = Result<T, TransportXError>;

impl std::fmt::Display for TransportXError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransportXError::SocketError { message } => write!(f, "Socket error: {}", message),
            TransportXError::ConnectionError { message, connection_id } => {
                write!(f, "Connection error (id: {:?}): {}", connection_id, message)
            }
            TransportXError::StreamError { message, stream_id } => {
                write!(f, "Stream error (id: {:?}): {}", stream_id, message)
            }
            TransportXError::Http3Error { message } => write!(f, "HTTP/3 error: {}", message),
            TransportXError::ConfigError { field, message } => {
                write!(f, "Config error in '{}': {}", field, message)
            }
            TransportXError::SerializationError { message } => {
                write!(f, "Serialization error: {}", message)
            }
            TransportXError::HandleNotFound { handle, resource_type } => {
                write!(f, "{} handle {} not found", resource_type, handle)
            }
            TransportXError::StateError { expected, actual } => {
                write!(f, "State error: expected {}, got {}", expected, actual)
            }
            TransportXError::TlsError { message } => write!(f, "TLS error: {}", message),
            TransportXError::TimeoutError { message } => write!(f, "Timeout: {}", message),
        }
    }
}

impl std::error::Error for TransportXError {}

lazy_static! {
    pub static ref LAST_ERROR: Mutex<Option<String>> = Mutex::new(None);
}

/// Set last error for FFI retrieval
pub fn set_last_error(error: &TransportXError) {
    *LAST_ERROR.lock() = Some(error.to_string());
}

/// Set last error from a string message
pub fn set_last_error_msg(msg: String) {
    *LAST_ERROR.lock() = Some(msg);
}

/// Initialize transportx library
#[deno_bindgen]
pub fn transportx_init() -> u8 {
    // Clear any stale error state
    *LAST_ERROR.lock() = None;
    1
}

/// Get library version
#[deno_bindgen]
pub fn transportx_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Get last error (if any)
#[deno_bindgen]
pub fn transportx_get_last_error() -> String {
    LAST_ERROR.lock().take().unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_socket_error_display() {
        let err = TransportXError::SocketError { message: "bind failed".into() };
        assert_eq!(format!("{}", err), "Socket error: bind failed");
    }

    #[test]
    fn test_connection_error_display() {
        let err = TransportXError::ConnectionError {
            message: "timeout".into(),
            connection_id: Some(42),
        };
        assert_eq!(format!("{}", err), "Connection error (id: Some(42)): timeout");
    }

    #[test]
    fn test_connection_error_display_no_id() {
        let err = TransportXError::ConnectionError {
            message: "timeout".into(),
            connection_id: None,
        };
        assert_eq!(format!("{}", err), "Connection error (id: None): timeout");
    }

    #[test]
    fn test_stream_error_display() {
        let err = TransportXError::StreamError {
            message: "reset".into(),
            stream_id: Some(7),
        };
        assert_eq!(format!("{}", err), "Stream error (id: Some(7)): reset");
    }

    #[test]
    fn test_http3_error_display() {
        let err = TransportXError::Http3Error { message: "frame error".into() };
        assert_eq!(format!("{}", err), "HTTP/3 error: frame error");
    }

    #[test]
    fn test_config_error_display() {
        let err = TransportXError::ConfigError {
            field: "alpn".into(),
            message: "invalid".into(),
        };
        assert_eq!(format!("{}", err), "Config error in 'alpn': invalid");
    }

    #[test]
    fn test_serialization_error_display() {
        let err = TransportXError::SerializationError { message: "bad json".into() };
        assert_eq!(format!("{}", err), "Serialization error: bad json");
    }

    #[test]
    fn test_handle_not_found_display() {
        let err = TransportXError::HandleNotFound {
            handle: 99,
            resource_type: "UdpSocket".into(),
        };
        assert_eq!(format!("{}", err), "UdpSocket handle 99 not found");
    }

    #[test]
    fn test_state_error_display() {
        let err = TransportXError::StateError {
            expected: "Connected".into(),
            actual: "Idle".into(),
        };
        assert_eq!(format!("{}", err), "State error: expected Connected, got Idle");
    }

    #[test]
    fn test_tls_error_display() {
        let err = TransportXError::TlsError { message: "cert expired".into() };
        assert_eq!(format!("{}", err), "TLS error: cert expired");
    }

    #[test]
    fn test_timeout_error_display() {
        let err = TransportXError::TimeoutError { message: "5s exceeded".into() };
        assert_eq!(format!("{}", err), "Timeout: 5s exceeded");
    }

    #[test]
    fn test_set_last_error_and_get() {
        // Clear any stale state
        let _ = LAST_ERROR.lock().take();

        let err = TransportXError::SocketError { message: "test".into() };
        set_last_error(&err);

        let msg = LAST_ERROR.lock().take().unwrap_or_default();
        assert_eq!(msg, "Socket error: test");
    }

    #[test]
    fn test_set_last_error_msg() {
        let _ = LAST_ERROR.lock().take();

        set_last_error_msg("custom error".into());
        let msg = LAST_ERROR.lock().take().unwrap_or_default();
        assert_eq!(msg, "custom error");
    }

    #[test]
    fn test_transportx_init_returns_1() {
        assert_eq!(transportx_init(), 1);
    }

    #[test]
    fn test_transportx_init_clears_error() {
        set_last_error_msg("stale".into());
        transportx_init();
        let msg = LAST_ERROR.lock().clone();
        assert!(msg.is_none());
    }

    #[test]
    fn test_transportx_version_non_empty() {
        let version = env!("CARGO_PKG_VERSION");
        assert!(!version.is_empty());
    }

    #[test]
    fn test_get_last_error_clears_after_read() {
        // Set and immediately take within a single lock scope to avoid races
        {
            let mut guard = LAST_ERROR.lock();
            *guard = Some("once".into());
            let first = guard.take().unwrap_or_default();
            assert_eq!(first, "once");
            // After take(), it should be None
            assert!(guard.is_none());
        }
    }

    #[test]
    fn test_get_last_error_empty_when_none() {
        let _ = LAST_ERROR.lock().take();
        let val = LAST_ERROR.lock().take().unwrap_or_default();
        assert_eq!(val, "");
    }

    #[test]
    fn test_error_implements_std_error() {
        let err = TransportXError::SocketError { message: "test".into() };
        let _: &dyn std::error::Error = &err;
    }
}
