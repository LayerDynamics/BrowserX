//! BytecodeX - Bytecode optimization, validation, and disassembly for BrowserX
//!
//! Provides Rust-native bytecode manipulation exposed to Deno via FFI (deno_bindgen).
//! Optimization passes: constant folding, dead store elimination, peephole.
//! Validation: opcode validity, operand counts, jump targets, register bounds.

pub mod bytecode;
pub mod deno_bindings;
pub mod error;
pub mod optimizer;
pub mod validator;

pub use bytecode::{Bytecode, Opcode};
pub use error::{set_last_error, BytecodeXError, BytecodeXResult};
pub use optimizer::{OptimizationPass, OptimizationPipeline, OptimizationStats};
pub use validator::{ValidationError, ValidationResult};
