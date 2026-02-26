use crate::bytecode::{operand_count, Bytecode, Opcode};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub offset: usize,
    pub message: String,
    pub severity: ErrorSeverity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorSeverity {
    Error,
    Warning,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
    pub instruction_count: usize,
    pub max_register: Option<u8>,
    pub max_constant_index: Option<u8>,
}

/// Validate bytecode for correctness
pub fn validate(bytecode: &Bytecode) -> ValidationResult {
    let mut errors = Vec::new();
    let mut instruction_count = 0;
    let mut max_register: Option<u8> = None;
    let mut max_constant_index: Option<u8> = None;
    let mut instruction_offsets = std::collections::HashSet::new();

    let bytes = &bytecode.instructions;
    let pool_len = bytecode.constant_pool.len();
    let mut offset = 0;

    // Pass 1: Decode instructions, check opcodes and operand counts
    while offset < bytes.len() {
        instruction_offsets.insert(offset);
        let byte = bytes[offset];

        match Opcode::from_byte(byte) {
            None => {
                errors.push(ValidationError {
                    offset,
                    message: format!("Invalid opcode: 0x{:02X}", byte),
                    severity: ErrorSeverity::Error,
                });
                offset += 1;
            }
            Some(opcode) => {
                let count = operand_count(opcode);
                offset += 1;

                if offset + count > bytes.len() {
                    errors.push(ValidationError {
                        offset: offset - 1,
                        message: format!(
                            "{} requires {} operand(s) but bytecode ends at offset {}",
                            opcode.name(),
                            count,
                            bytes.len()
                        ),
                        severity: ErrorSeverity::Error,
                    });
                    break;
                }

                // Check operand validity
                for i in 0..count {
                    let operand = bytes[offset + i];
                    check_operand(opcode, i, operand, pool_len, &mut max_register, &mut max_constant_index, offset - 1, &mut errors);
                }

                offset += count;
                instruction_count += 1;
            }
        }
    }

    // Pass 2: Check jump targets land on instruction boundaries
    let mut offset2 = 0;
    while offset2 < bytes.len() {
        if let Some(opcode) = Opcode::from_byte(bytes[offset2]) {
            let count = operand_count(opcode);
            match opcode {
                Opcode::JUMP | Opcode::JUMP_IF_TRUE | Opcode::JUMP_IF_FALSE => {
                    if count >= 1 && offset2 + 1 < bytes.len() {
                        let target = bytes[offset2 + 1] as usize;
                        if target > bytes.len() {
                            errors.push(ValidationError {
                                offset: offset2,
                                message: format!(
                                    "Jump target {} exceeds bytecode length {}",
                                    target,
                                    bytes.len()
                                ),
                                severity: ErrorSeverity::Error,
                            });
                        } else if target < bytes.len() && !instruction_offsets.contains(&target) {
                            errors.push(ValidationError {
                                offset: offset2,
                                message: format!(
                                    "Jump target {} does not land on instruction boundary",
                                    target
                                ),
                                severity: ErrorSeverity::Warning,
                            });
                        }
                    }
                }
                _ => {}
            }
            offset2 += 1 + count;
        } else {
            offset2 += 1;
        }
    }

    ValidationResult {
        valid: errors.iter().all(|e| !matches!(e.severity, ErrorSeverity::Error)),
        errors,
        instruction_count,
        max_register,
        max_constant_index,
    }
}

fn check_operand(
    opcode: Opcode,
    operand_index: usize,
    value: u8,
    pool_len: usize,
    max_register: &mut Option<u8>,
    max_constant_index: &mut Option<u8>,
    instr_offset: usize,
    errors: &mut Vec<ValidationError>,
) {
    match opcode {
        // Register operands
        Opcode::LDAR | Opcode::STAR => {
            *max_register = Some(max_register.map_or(value, |m| m.max(value)));
        }
        // Arithmetic: operand is register
        Opcode::ADD | Opcode::SUB | Opcode::MUL | Opcode::DIV | Opcode::MOD
        | Opcode::TEST_EQUAL | Opcode::TEST_NOT_EQUAL | Opcode::TEST_STRICT_EQUAL
        | Opcode::TEST_LESS_THAN | Opcode::TEST_GREATER_THAN
        | Opcode::TEST_LESS_EQUAL | Opcode::TEST_GREATER_EQUAL => {
            *max_register = Some(max_register.map_or(value, |m| m.max(value)));
        }
        // Constant pool index
        Opcode::LDA_CONSTANT | Opcode::LDA_GLOBAL | Opcode::STA_GLOBAL
        | Opcode::LDA_CONTEXT_SLOT | Opcode::STA_CONTEXT_SLOT
        | Opcode::CREATE_CLOSURE => {
            *max_constant_index = Some(max_constant_index.map_or(value, |m| m.max(value)));
            if (value as usize) >= pool_len {
                errors.push(ValidationError {
                    offset: instr_offset,
                    message: format!(
                        "{}: constant pool index {} out of bounds (pool size: {})",
                        opcode.name(),
                        value,
                        pool_len
                    ),
                    severity: ErrorSeverity::Error,
                });
            }
        }
        // GET_PROPERTY: name index from constant pool
        Opcode::GET_PROPERTY => {
            *max_constant_index = Some(max_constant_index.map_or(value, |m| m.max(value)));
            if (value as usize) >= pool_len {
                errors.push(ValidationError {
                    offset: instr_offset,
                    message: format!(
                        "GET_PROPERTY: constant pool index {} out of bounds (pool size: {})",
                        value, pool_len
                    ),
                    severity: ErrorSeverity::Error,
                });
            }
        }
        // SET_PROPERTY: first operand = name index, second = object register
        Opcode::SET_PROPERTY => {
            if operand_index == 0 {
                *max_constant_index = Some(max_constant_index.map_or(value, |m| m.max(value)));
                if (value as usize) >= pool_len {
                    errors.push(ValidationError {
                        offset: instr_offset,
                        message: format!(
                            "SET_PROPERTY: constant pool index {} out of bounds (pool size: {})",
                            value, pool_len
                        ),
                        severity: ErrorSeverity::Error,
                    });
                }
            } else {
                *max_register = Some(max_register.map_or(value, |m| m.max(value)));
            }
        }
        // GET_KEYED / SET_KEYED: register operands
        Opcode::GET_KEYED | Opcode::SET_KEYED => {
            *max_register = Some(max_register.map_or(value, |m| m.max(value)));
        }
        _ => {}
    }
}

/// Disassemble bytecode to human-readable form
pub fn disassemble(bytecode: &Bytecode) -> String {
    let mut output = String::new();
    for instr in bytecode.iter_instructions() {
        let operands_str: Vec<String> = instr.operands.iter().map(|o| format!("{}", o)).collect();
        let line = if operands_str.is_empty() {
            format!("{:04}: {}\n", instr.offset, instr.opcode.name())
        } else {
            format!(
                "{:04}: {} {}\n",
                instr.offset,
                instr.opcode.name(),
                operands_str.join(", ")
            )
        };
        output.push_str(&line);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_bytecode() {
        let bytes = vec![0x09, 0x00, 0x03, 0x00, 0x43];
        let pool = vec![serde_json::Value::from(42)];
        let bc = Bytecode::new(bytes, pool);
        let result = validate(&bc);
        assert!(result.valid);
        assert_eq!(result.instruction_count, 3);
    }

    #[test]
    fn test_invalid_opcode() {
        let bytes = vec![0xFE];
        let bc = Bytecode::new(bytes, vec![]);
        let result = validate(&bc);
        assert!(!result.valid);
        assert!(result.errors[0].message.contains("Invalid opcode"));
    }

    #[test]
    fn test_constant_pool_out_of_bounds() {
        let bytes = vec![0x09, 0x05]; // LDA_CONSTANT 5 but pool is empty
        let bc = Bytecode::new(bytes, vec![]);
        let result = validate(&bc);
        assert!(!result.valid);
        assert!(result.errors[0].message.contains("out of bounds"));
    }

    #[test]
    fn test_truncated_operand() {
        let bytes = vec![0x09]; // LDA_CONSTANT without operand
        let bc = Bytecode::new(bytes, vec![]);
        let result = validate(&bc);
        assert!(!result.valid);
        assert!(result.errors[0].message.contains("requires"));
    }

    #[test]
    fn test_jump_target_out_of_bounds() {
        let bytes = vec![0x40, 0xFF]; // JUMP 255
        let bc = Bytecode::new(bytes, vec![]);
        let result = validate(&bc);
        assert!(!result.valid);
    }

    #[test]
    fn test_disassemble() {
        let bytes = vec![0x09, 0x00, 0x03, 0x00, 0x43];
        let bc = Bytecode::new(bytes, vec![serde_json::Value::from(42)]);
        let output = disassemble(&bc);
        assert!(output.contains("LDA_CONSTANT"));
        assert!(output.contains("STAR"));
        assert!(output.contains("RETURN"));
    }
}
