use serde::{Deserialize, Serialize};

/// Bytecode opcodes matching V8Compiler.ts Opcode enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum Opcode {
    // Special
    NOP = 0x00,

    // Load/Store
    LDA = 0x01,
    LDAR = 0x02,
    STAR = 0x03,
    LDA_ZERO = 0x04,
    LDA_UNDEFINED = 0x05,
    LDA_NULL = 0x06,
    LDA_TRUE = 0x07,
    LDA_FALSE = 0x08,
    LDA_CONSTANT = 0x09,

    // Arithmetic
    ADD = 0x10,
    SUB = 0x11,
    MUL = 0x12,
    DIV = 0x13,
    MOD = 0x14,
    INC = 0x15,
    DEC = 0x16,
    NEGATE = 0x17,

    // Comparison
    TEST_EQUAL = 0x20,
    TEST_NOT_EQUAL = 0x21,
    TEST_STRICT_EQUAL = 0x22,
    TEST_LESS_THAN = 0x23,
    TEST_GREATER_THAN = 0x24,
    TEST_LESS_EQUAL = 0x25,
    TEST_GREATER_EQUAL = 0x26,

    // Logical
    LOGICAL_NOT = 0x30,
    TO_BOOLEAN = 0x31,

    // Control flow
    JUMP = 0x40,
    JUMP_IF_TRUE = 0x41,
    JUMP_IF_FALSE = 0x42,
    RETURN = 0x43,

    // Function calls
    CALL = 0x50,
    CONSTRUCT = 0x51,

    // Property access
    GET_PROPERTY = 0x60,
    SET_PROPERTY = 0x61,
    GET_KEYED = 0x62,
    SET_KEYED = 0x63,

    // Variable access
    LDA_GLOBAL = 0x70,
    STA_GLOBAL = 0x71,
    LDA_CONTEXT_SLOT = 0x72,
    STA_CONTEXT_SLOT = 0x73,

    // Object creation
    CREATE_OBJECT = 0x80,
    CREATE_ARRAY = 0x81,
    CREATE_CLOSURE = 0x82,

    // Debug
    DEBUGGER = 0xFF,
}

impl Opcode {
    pub fn from_byte(byte: u8) -> Option<Opcode> {
        match byte {
            0x00 => Some(Opcode::NOP),
            0x01 => Some(Opcode::LDA),
            0x02 => Some(Opcode::LDAR),
            0x03 => Some(Opcode::STAR),
            0x04 => Some(Opcode::LDA_ZERO),
            0x05 => Some(Opcode::LDA_UNDEFINED),
            0x06 => Some(Opcode::LDA_NULL),
            0x07 => Some(Opcode::LDA_TRUE),
            0x08 => Some(Opcode::LDA_FALSE),
            0x09 => Some(Opcode::LDA_CONSTANT),
            0x10 => Some(Opcode::ADD),
            0x11 => Some(Opcode::SUB),
            0x12 => Some(Opcode::MUL),
            0x13 => Some(Opcode::DIV),
            0x14 => Some(Opcode::MOD),
            0x15 => Some(Opcode::INC),
            0x16 => Some(Opcode::DEC),
            0x17 => Some(Opcode::NEGATE),
            0x20 => Some(Opcode::TEST_EQUAL),
            0x21 => Some(Opcode::TEST_NOT_EQUAL),
            0x22 => Some(Opcode::TEST_STRICT_EQUAL),
            0x23 => Some(Opcode::TEST_LESS_THAN),
            0x24 => Some(Opcode::TEST_GREATER_THAN),
            0x25 => Some(Opcode::TEST_LESS_EQUAL),
            0x26 => Some(Opcode::TEST_GREATER_EQUAL),
            0x30 => Some(Opcode::LOGICAL_NOT),
            0x31 => Some(Opcode::TO_BOOLEAN),
            0x40 => Some(Opcode::JUMP),
            0x41 => Some(Opcode::JUMP_IF_TRUE),
            0x42 => Some(Opcode::JUMP_IF_FALSE),
            0x43 => Some(Opcode::RETURN),
            0x50 => Some(Opcode::CALL),
            0x51 => Some(Opcode::CONSTRUCT),
            0x60 => Some(Opcode::GET_PROPERTY),
            0x61 => Some(Opcode::SET_PROPERTY),
            0x62 => Some(Opcode::GET_KEYED),
            0x63 => Some(Opcode::SET_KEYED),
            0x70 => Some(Opcode::LDA_GLOBAL),
            0x71 => Some(Opcode::STA_GLOBAL),
            0x72 => Some(Opcode::LDA_CONTEXT_SLOT),
            0x73 => Some(Opcode::STA_CONTEXT_SLOT),
            0x80 => Some(Opcode::CREATE_OBJECT),
            0x81 => Some(Opcode::CREATE_ARRAY),
            0x82 => Some(Opcode::CREATE_CLOSURE),
            0xFF => Some(Opcode::DEBUGGER),
            _ => None,
        }
    }

    pub fn name(&self) -> &'static str {
        match self {
            Opcode::NOP => "NOP",
            Opcode::LDA => "LDA",
            Opcode::LDAR => "LDAR",
            Opcode::STAR => "STAR",
            Opcode::LDA_ZERO => "LDA_ZERO",
            Opcode::LDA_UNDEFINED => "LDA_UNDEFINED",
            Opcode::LDA_NULL => "LDA_NULL",
            Opcode::LDA_TRUE => "LDA_TRUE",
            Opcode::LDA_FALSE => "LDA_FALSE",
            Opcode::LDA_CONSTANT => "LDA_CONSTANT",
            Opcode::ADD => "ADD",
            Opcode::SUB => "SUB",
            Opcode::MUL => "MUL",
            Opcode::DIV => "DIV",
            Opcode::MOD => "MOD",
            Opcode::INC => "INC",
            Opcode::DEC => "DEC",
            Opcode::NEGATE => "NEGATE",
            Opcode::TEST_EQUAL => "TEST_EQUAL",
            Opcode::TEST_NOT_EQUAL => "TEST_NOT_EQUAL",
            Opcode::TEST_STRICT_EQUAL => "TEST_STRICT_EQUAL",
            Opcode::TEST_LESS_THAN => "TEST_LESS_THAN",
            Opcode::TEST_GREATER_THAN => "TEST_GREATER_THAN",
            Opcode::TEST_LESS_EQUAL => "TEST_LESS_EQUAL",
            Opcode::TEST_GREATER_EQUAL => "TEST_GREATER_EQUAL",
            Opcode::LOGICAL_NOT => "LOGICAL_NOT",
            Opcode::TO_BOOLEAN => "TO_BOOLEAN",
            Opcode::JUMP => "JUMP",
            Opcode::JUMP_IF_TRUE => "JUMP_IF_TRUE",
            Opcode::JUMP_IF_FALSE => "JUMP_IF_FALSE",
            Opcode::RETURN => "RETURN",
            Opcode::CALL => "CALL",
            Opcode::CONSTRUCT => "CONSTRUCT",
            Opcode::GET_PROPERTY => "GET_PROPERTY",
            Opcode::SET_PROPERTY => "SET_PROPERTY",
            Opcode::GET_KEYED => "GET_KEYED",
            Opcode::SET_KEYED => "SET_KEYED",
            Opcode::LDA_GLOBAL => "LDA_GLOBAL",
            Opcode::STA_GLOBAL => "STA_GLOBAL",
            Opcode::LDA_CONTEXT_SLOT => "LDA_CONTEXT_SLOT",
            Opcode::STA_CONTEXT_SLOT => "STA_CONTEXT_SLOT",
            Opcode::CREATE_OBJECT => "CREATE_OBJECT",
            Opcode::CREATE_ARRAY => "CREATE_ARRAY",
            Opcode::CREATE_CLOSURE => "CREATE_CLOSURE",
            Opcode::DEBUGGER => "DEBUGGER",
        }
    }
}

/// Number of operand bytes per opcode
pub fn operand_count(opcode: Opcode) -> usize {
    match opcode {
        // No operands
        Opcode::NOP
        | Opcode::LDA_ZERO
        | Opcode::LDA_UNDEFINED
        | Opcode::LDA_NULL
        | Opcode::LDA_TRUE
        | Opcode::LDA_FALSE
        | Opcode::INC
        | Opcode::DEC
        | Opcode::NEGATE
        | Opcode::LOGICAL_NOT
        | Opcode::TO_BOOLEAN
        | Opcode::RETURN
        | Opcode::CREATE_OBJECT
        | Opcode::DEBUGGER => 0,

        // 1 operand
        Opcode::LDA
        | Opcode::LDAR
        | Opcode::STAR
        | Opcode::LDA_CONSTANT
        | Opcode::ADD
        | Opcode::SUB
        | Opcode::MUL
        | Opcode::DIV
        | Opcode::MOD
        | Opcode::TEST_EQUAL
        | Opcode::TEST_NOT_EQUAL
        | Opcode::TEST_STRICT_EQUAL
        | Opcode::TEST_LESS_THAN
        | Opcode::TEST_GREATER_THAN
        | Opcode::TEST_LESS_EQUAL
        | Opcode::TEST_GREATER_EQUAL
        | Opcode::JUMP
        | Opcode::JUMP_IF_TRUE
        | Opcode::JUMP_IF_FALSE
        | Opcode::CALL
        | Opcode::CONSTRUCT
        | Opcode::GET_PROPERTY
        | Opcode::GET_KEYED
        | Opcode::LDA_GLOBAL
        | Opcode::STA_GLOBAL
        | Opcode::LDA_CONTEXT_SLOT
        | Opcode::STA_CONTEXT_SLOT
        | Opcode::CREATE_ARRAY
        | Opcode::CREATE_CLOSURE => 1,

        // 2 operands
        Opcode::SET_PROPERTY | Opcode::SET_KEYED => 2,
    }
}

/// Bytecode container
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bytecode {
    pub instructions: Vec<u8>,
    pub constant_pool: Vec<serde_json::Value>,
}

impl Bytecode {
    pub fn new(instructions: Vec<u8>, constant_pool: Vec<serde_json::Value>) -> Self {
        Bytecode {
            instructions,
            constant_pool,
        }
    }

    pub fn len(&self) -> usize {
        self.instructions.len()
    }

    pub fn is_empty(&self) -> bool {
        self.instructions.is_empty()
    }

    /// Iterate over instructions
    pub fn iter_instructions(&self) -> InstructionIterator<'_> {
        InstructionIterator {
            bytecode: &self.instructions,
            offset: 0,
        }
    }
}

/// Decoded instruction
#[derive(Debug, Clone)]
pub struct Instruction {
    pub offset: usize,
    pub opcode: Opcode,
    pub operands: Vec<u8>,
}

/// Iterator over bytecode instructions
pub struct InstructionIterator<'a> {
    bytecode: &'a [u8],
    offset: usize,
}

impl<'a> Iterator for InstructionIterator<'a> {
    type Item = Instruction;

    fn next(&mut self) -> Option<Self::Item> {
        if self.offset >= self.bytecode.len() {
            return None;
        }

        let instr_offset = self.offset;
        let byte = self.bytecode[self.offset];
        self.offset += 1;

        let opcode = match Opcode::from_byte(byte) {
            Some(op) => op,
            None => {
                return Some(Instruction {
                    offset: instr_offset,
                    opcode: Opcode::NOP,
                    operands: vec![byte],
                });
            }
        };

        let count = operand_count(opcode);
        let mut operands = Vec::with_capacity(count);
        for _ in 0..count {
            if self.offset < self.bytecode.len() {
                operands.push(self.bytecode[self.offset]);
                self.offset += 1;
            }
        }

        Some(Instruction {
            offset: instr_offset,
            opcode,
            operands,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_opcode_from_byte_valid() {
        assert_eq!(Opcode::from_byte(0x00), Some(Opcode::NOP));
        assert_eq!(Opcode::from_byte(0x10), Some(Opcode::ADD));
        assert_eq!(Opcode::from_byte(0x50), Some(Opcode::CALL));
        assert_eq!(Opcode::from_byte(0x80), Some(Opcode::CREATE_OBJECT));
    }

    #[test]
    fn test_opcode_from_byte_invalid() {
        assert_eq!(Opcode::from_byte(0xFE), None);
        assert_eq!(Opcode::from_byte(0x0A), None);
    }

    #[test]
    fn test_operand_count() {
        assert_eq!(operand_count(Opcode::NOP), 0);
        assert_eq!(operand_count(Opcode::RETURN), 0);
        assert_eq!(operand_count(Opcode::ADD), 1);
        assert_eq!(operand_count(Opcode::CALL), 1);
        assert_eq!(operand_count(Opcode::SET_PROPERTY), 2);
    }

    #[test]
    fn test_instruction_iterator() {
        // LDA_CONSTANT 0, STAR 0, LDA_CONSTANT 1, ADD 0, RETURN
        let bytes = vec![0x09, 0x00, 0x03, 0x00, 0x09, 0x01, 0x10, 0x00, 0x43];
        let bc = Bytecode::new(bytes, vec![]);
        let instrs: Vec<_> = bc.iter_instructions().collect();

        assert_eq!(instrs.len(), 5);
        assert_eq!(instrs[0].opcode, Opcode::LDA_CONSTANT);
        assert_eq!(instrs[0].operands, vec![0x00]);
        assert_eq!(instrs[1].opcode, Opcode::STAR);
        assert_eq!(instrs[2].opcode, Opcode::LDA_CONSTANT);
        assert_eq!(instrs[3].opcode, Opcode::ADD);
        assert_eq!(instrs[4].opcode, Opcode::RETURN);
    }

    #[test]
    fn test_bytecode_len() {
        let bc = Bytecode::new(vec![0x00, 0x43], vec![]);
        assert_eq!(bc.len(), 2);
        assert!(!bc.is_empty());
    }
}
