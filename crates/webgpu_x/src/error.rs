use deno_bindgen::deno_bindgen;
use lazy_static::lazy_static;
use parking_lot::Mutex;

/// WebGPU extension error types
#[derive(Debug, Clone)]
#[deno_bindgen]
pub enum WebGPUXError {
    /// Device not found or initialization failed
    DeviceNotFound { message: String },

    /// Buffer operation failed
    BufferError { message: String, buffer_id: Option<u64> },

    /// Texture operation failed
    TextureError { message: String, texture_id: Option<u64> },

    /// Pipeline creation or execution failed
    PipelineError { message: String, pipeline_id: Option<u64> },

    /// Descriptor validation failed
    ValidationError { field: String, message: String },

    /// Memory allocation failed
    OutOfMemory { requested_bytes: u64, available_bytes: u64 },

    /// Device lost during operation
    DeviceLost { reason: String },

    /// FFI serialization error
    SerializationError { message: String },

    /// Limit exceeded
    LimitExceeded { limit_name: String, requested: u64, maximum: u64 },
}

/// Result type for webgpu_x operations
pub type WebGPUXResult<T> = Result<T, WebGPUXError>;

impl std::fmt::Display for WebGPUXError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WebGPUXError::DeviceNotFound { message } => write!(f, "Device not found: {}", message),
            WebGPUXError::BufferError { message, buffer_id } => {
                write!(f, "Buffer error (id: {:?}): {}", buffer_id, message)
            }
            WebGPUXError::TextureError { message, texture_id } => {
                write!(f, "Texture error (id: {:?}): {}", texture_id, message)
            }
            WebGPUXError::PipelineError { message, pipeline_id } => {
                write!(f, "Pipeline error (id: {:?}): {}", pipeline_id, message)
            }
            WebGPUXError::ValidationError { field, message } => {
                write!(f, "Validation error in '{}': {}", field, message)
            }
            WebGPUXError::OutOfMemory { requested_bytes, available_bytes } => {
                write!(f, "Out of memory: requested {} bytes, available {} bytes",
                       requested_bytes, available_bytes)
            }
            WebGPUXError::DeviceLost { reason } => write!(f, "Device lost: {}", reason),
            WebGPUXError::SerializationError { message } => {
                write!(f, "Serialization error: {}", message)
            }
            WebGPUXError::LimitExceeded { limit_name, requested, maximum } => {
                write!(f, "Limit '{}' exceeded: requested {}, maximum {}",
                       limit_name, requested, maximum)
            }
        }
    }
}

impl std::error::Error for WebGPUXError {}

lazy_static! {
    pub static ref LAST_ERROR: Mutex<Option<String>> = Mutex::new(None);
}

/// Set last error for FFI retrieval
pub(crate) fn set_last_error(error: &WebGPUXError) {
    *LAST_ERROR.lock() = Some(error.to_string());
}

/// Initialize webgpu_x library
#[deno_bindgen]
pub fn webgpu_x_init() -> u8 {
    // Initialize logging, error tracking, etc.
    1
}

/// Get library version
#[deno_bindgen]
pub fn webgpu_x_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Get last error (if any)
#[deno_bindgen]
pub fn webgpu_x_get_last_error() -> String {
    LAST_ERROR.lock().take().unwrap_or_default()
}
