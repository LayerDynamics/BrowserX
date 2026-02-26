// All FFI exports for deno_bindgen MUST be in this file.
// deno_bindgen does NOT support cross-module type references.

use deno_bindgen::deno_bindgen;

use crate::bytecode::Bytecode;
use crate::error;
use crate::optimizer::OptimizationPipeline;
use crate::validator;

#[deno_bindgen]
pub fn bytecodex_init() -> u8 {
    error::clear_last_error();
    1
}

#[deno_bindgen]
pub fn bytecodex_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[deno_bindgen]
pub fn bytecodex_get_last_error() -> String {
    error::get_last_error()
}

/// Optimize bytecode
/// Input JSON: { "instructions": number[], "constant_pool": any[] }
/// Output JSON: { "instructions": number[], "constant_pool": any[], "stats": {...} }
#[deno_bindgen]
pub fn bytecodex_optimize(json: &str) -> String {
    match serde_json::from_str::<Bytecode>(json) {
        Ok(bytecode) => {
            let pipeline = OptimizationPipeline::new();
            let (optimized, stats) = pipeline.run(&bytecode);

            let result = serde_json::json!({
                "instructions": optimized.instructions,
                "constant_pool": optimized.constant_pool,
                "stats": {
                    "instructions_before": stats.instructions_before,
                    "instructions_after": stats.instructions_after,
                    "constants_folded": stats.constants_folded,
                    "dead_stores_removed": stats.dead_stores_removed,
                    "peephole_optimizations": stats.peephole_optimizations,
                }
            });

            serde_json::to_string(&result).unwrap_or_default()
        }
        Err(e) => {
            error::set_last_error(format!("Failed to parse bytecode JSON: {}", e));
            String::new()
        }
    }
}

/// Validate bytecode
/// Input JSON: { "instructions": number[], "constant_pool": any[] }
/// Output JSON: { "valid": bool, "errors": [...], "instruction_count": n, ... }
#[deno_bindgen]
pub fn bytecodex_validate(json: &str) -> String {
    match serde_json::from_str::<Bytecode>(json) {
        Ok(bytecode) => {
            let result = validator::validate(&bytecode);
            serde_json::to_string(&result).unwrap_or_default()
        }
        Err(e) => {
            error::set_last_error(format!("Failed to parse bytecode JSON: {}", e));
            String::new()
        }
    }
}

/// Disassemble bytecode to human-readable text
/// Input JSON: { "instructions": number[], "constant_pool": any[] }
/// Output: string with disassembly
#[deno_bindgen]
pub fn bytecodex_disassemble(json: &str) -> String {
    match serde_json::from_str::<Bytecode>(json) {
        Ok(bytecode) => validator::disassemble(&bytecode),
        Err(e) => {
            error::set_last_error(format!("Failed to parse bytecode JSON: {}", e));
            String::new()
        }
    }
}
