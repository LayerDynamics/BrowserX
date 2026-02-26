use lazy_static::lazy_static;
use parking_lot::Mutex;
use std::fmt;

lazy_static! {
    static ref LAST_ERROR: Mutex<Option<String>> = Mutex::new(None);
}

#[derive(Debug)]
pub enum BytecodeXError {
    InvalidBytecode(String),
    OptimizationFailed(String),
    ValidationFailed(String),
    SerializationError(String),
}

impl fmt::Display for BytecodeXError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BytecodeXError::InvalidBytecode(msg) => write!(f, "Invalid bytecode: {}", msg),
            BytecodeXError::OptimizationFailed(msg) => write!(f, "Optimization failed: {}", msg),
            BytecodeXError::ValidationFailed(msg) => write!(f, "Validation failed: {}", msg),
            BytecodeXError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
        }
    }
}

impl std::error::Error for BytecodeXError {}

pub type BytecodeXResult<T> = Result<T, BytecodeXError>;

pub fn set_last_error(error: String) {
    *LAST_ERROR.lock() = Some(error);
}

pub fn get_last_error() -> String {
    LAST_ERROR
        .lock()
        .take()
        .unwrap_or_default()
}

pub fn clear_last_error() {
    *LAST_ERROR.lock() = None;
}
