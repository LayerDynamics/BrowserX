use crate::bytecode::{operand_count, Bytecode, Opcode};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OptimizationStats {
    pub instructions_before: usize,
    pub instructions_after: usize,
    pub constants_folded: usize,
    pub dead_stores_removed: usize,
    pub peephole_optimizations: usize,
}

pub trait OptimizationPass {
    fn name(&self) -> &str;
    fn run(&self, bytecode: &Bytecode, stats: &mut OptimizationStats) -> Bytecode;
}

/// Constant folding: LDA_CONSTANT n1, STAR r, LDA_CONSTANT n2, ADD r -> LDA_CONSTANT (n1+n2)
pub struct ConstantFoldingPass;

impl OptimizationPass for ConstantFoldingPass {
    fn name(&self) -> &str {
        "constant-folding"
    }

    fn run(&self, bytecode: &Bytecode, stats: &mut OptimizationStats) -> Bytecode {
        let bytes = &bytecode.instructions;
        let mut result = Vec::with_capacity(bytes.len());
        let mut pool = bytecode.constant_pool.clone();
        let mut i = 0;

        while i < bytes.len() {
            // Pattern: LDA_CONSTANT c1, STAR r, LDA_CONSTANT c2, <arith> r
            if i + 7 <= bytes.len()
                && bytes[i] == Opcode::LDA_CONSTANT as u8
                && bytes[i + 2] == Opcode::STAR as u8
                && bytes[i + 4] == Opcode::LDA_CONSTANT as u8
            {
                let c1_idx = bytes[i + 1] as usize;
                let reg = bytes[i + 3];
                let c2_idx = bytes[i + 5] as usize;
                let arith_op = bytes[i + 6];
                let arith_reg = if i + 7 < bytes.len() { bytes[i + 7] } else { 0 };

                if arith_reg == reg && c1_idx < pool.len() && c2_idx < pool.len() {
                    let v1 = pool[c1_idx].as_f64();
                    let v2 = pool[c2_idx].as_f64();

                    if let (Some(n1), Some(n2)) = (v1, v2) {
                        let folded = match arith_op {
                            x if x == Opcode::ADD as u8 => Some(n1 + n2),
                            x if x == Opcode::SUB as u8 => Some(n1 - n2),
                            x if x == Opcode::MUL as u8 => Some(n1 * n2),
                            x if x == Opcode::DIV as u8 && n2 != 0.0 => Some(n1 / n2),
                            x if x == Opcode::MOD as u8 && n2 != 0.0 => Some(n1 % n2),
                            _ => None,
                        };

                        if let Some(val) = folded {
                            let new_idx = pool.len();
                            if new_idx > u8::MAX as usize {
                                // Pool overflow — skip folding, emit original instructions
                                for j in i..i + 8 {
                                    if j < bytes.len() {
                                        result.push(bytes[j]);
                                    }
                                }
                                i += 8;
                                continue;
                            }
                            pool.push(serde_json::Value::from(val));
                            result.push(Opcode::LDA_CONSTANT as u8);
                            result.push(new_idx as u8);
                            stats.constants_folded += 1;
                            i += 8; // Skip all 4 instructions
                            continue;
                        }
                    }
                }
            }

            // Copy instruction as-is
            let opcode_byte = bytes[i];
            result.push(opcode_byte);
            i += 1;
            if let Some(op) = Opcode::from_byte(opcode_byte) {
                let count = operand_count(op);
                for _ in 0..count {
                    if i < bytes.len() {
                        result.push(bytes[i]);
                        i += 1;
                    }
                }
            }
        }

        Bytecode::new(result, pool)
    }
}

/// Dead store elimination: STAR rN where rN is never subsequently read
pub struct DeadStoreEliminationPass;

impl OptimizationPass for DeadStoreEliminationPass {
    fn name(&self) -> &str {
        "dead-store-elimination"
    }

    fn run(&self, bytecode: &Bytecode, stats: &mut OptimizationStats) -> Bytecode {
        let instrs: Vec<_> = bytecode.iter_instructions().collect();

        // Find which registers are read
        let mut read_registers = std::collections::HashSet::new();
        for instr in &instrs {
            match instr.opcode {
                Opcode::LDAR | Opcode::ADD | Opcode::SUB | Opcode::MUL | Opcode::DIV
                | Opcode::MOD | Opcode::TEST_EQUAL | Opcode::TEST_NOT_EQUAL
                | Opcode::TEST_STRICT_EQUAL | Opcode::TEST_LESS_THAN
                | Opcode::TEST_GREATER_THAN | Opcode::TEST_LESS_EQUAL
                | Opcode::TEST_GREATER_EQUAL | Opcode::GET_KEYED => {
                    if !instr.operands.is_empty() {
                        read_registers.insert(instr.operands[0]);
                    }
                }
                Opcode::SET_PROPERTY | Opcode::SET_KEYED => {
                    // Second operand is object register (read)
                    if instr.operands.len() > 1 {
                        read_registers.insert(instr.operands[1]);
                    }
                }
                Opcode::CALL | Opcode::CONSTRUCT => {
                    // Operand is arg count. Arguments are in r0..r(arg_count-1).
                    if !instr.operands.is_empty() {
                        let arg_count = instr.operands[0] as usize;
                        for r in 0..arg_count.min(256) {
                            read_registers.insert(r as u8);
                        }
                    }
                }
                Opcode::GET_PROPERTY => {
                    // First operand is the object register (read)
                    if !instr.operands.is_empty() {
                        read_registers.insert(instr.operands[0]);
                    }
                }
                _ => {}
            }
        }

        // Rebuild without dead STARs
        let mut result = Vec::with_capacity(bytecode.instructions.len());
        for instr in &instrs {
            if instr.opcode == Opcode::STAR && !instr.operands.is_empty() {
                if !read_registers.contains(&instr.operands[0]) {
                    stats.dead_stores_removed += 1;
                    continue;
                }
            }
            result.push(instr.opcode as u8);
            for &op in &instr.operands {
                result.push(op);
            }
        }

        Bytecode::new(result, bytecode.constant_pool.clone())
    }
}

/// Peephole optimization: pattern matching on small instruction windows
pub struct PeepholePass;

impl OptimizationPass for PeepholePass {
    fn name(&self) -> &str {
        "peephole"
    }

    fn run(&self, bytecode: &Bytecode, stats: &mut OptimizationStats) -> Bytecode {
        let instrs: Vec<_> = bytecode.iter_instructions().collect();
        let mut result = Vec::with_capacity(bytecode.instructions.len());
        let mut i = 0;

        while i < instrs.len() {
            // Pattern: STAR rN, LDAR rN -> STAR rN (value already in accumulator)
            if i + 1 < instrs.len()
                && instrs[i].opcode == Opcode::STAR
                && instrs[i + 1].opcode == Opcode::LDAR
                && !instrs[i].operands.is_empty()
                && !instrs[i + 1].operands.is_empty()
                && instrs[i].operands[0] == instrs[i + 1].operands[0]
            {
                // Keep STAR, skip LDAR
                result.push(Opcode::STAR as u8);
                result.push(instrs[i].operands[0]);
                stats.peephole_optimizations += 1;
                i += 2;
                continue;
            }

            // Pattern: LOGICAL_NOT, LOGICAL_NOT -> remove both (double negation)
            if i + 1 < instrs.len()
                && instrs[i].opcode == Opcode::LOGICAL_NOT
                && instrs[i + 1].opcode == Opcode::LOGICAL_NOT
            {
                stats.peephole_optimizations += 1;
                i += 2;
                continue;
            }

            // Copy instruction as-is
            result.push(instrs[i].opcode as u8);
            for &op in &instrs[i].operands {
                result.push(op);
            }
            i += 1;
        }

        Bytecode::new(result, bytecode.constant_pool.clone())
    }
}

/// Pipeline that runs multiple optimization passes
pub struct OptimizationPipeline {
    passes: Vec<Box<dyn OptimizationPass>>,
}

impl OptimizationPipeline {
    pub fn new() -> Self {
        OptimizationPipeline {
            passes: vec![
                Box::new(ConstantFoldingPass),
                Box::new(DeadStoreEliminationPass),
                Box::new(PeepholePass),
            ],
        }
    }

    pub fn run(&self, bytecode: &Bytecode) -> (Bytecode, OptimizationStats) {
        let mut stats = OptimizationStats {
            instructions_before: bytecode.iter_instructions().count(),
            ..Default::default()
        };

        let mut current = bytecode.clone();
        for pass in &self.passes {
            current = pass.run(&current, &mut stats);
        }

        stats.instructions_after = current.iter_instructions().count();
        (current, stats)
    }
}

impl Default for OptimizationPipeline {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constant_folding_add() {
        // LDA_CONSTANT 0 (=5), STAR r0, LDA_CONSTANT 1 (=3), ADD r0
        let bytes = vec![0x09, 0x00, 0x03, 0x00, 0x09, 0x01, 0x10, 0x00, 0x43];
        let pool = vec![serde_json::Value::from(5.0), serde_json::Value::from(3.0)];
        let bc = Bytecode::new(bytes, pool);

        let mut stats = OptimizationStats::default();
        let result = ConstantFoldingPass.run(&bc, &mut stats);

        assert_eq!(stats.constants_folded, 1);
        // Result should be: LDA_CONSTANT 2, RETURN
        let instrs: Vec<_> = result.iter_instructions().collect();
        assert_eq!(instrs[0].opcode, Opcode::LDA_CONSTANT);
        assert_eq!(result.constant_pool[2].as_f64().unwrap(), 8.0);
    }

    #[test]
    fn test_peephole_star_ldar() {
        // STAR r0, LDAR r0 -> STAR r0
        let bytes = vec![0x03, 0x00, 0x02, 0x00];
        let bc = Bytecode::new(bytes, vec![]);

        let mut stats = OptimizationStats::default();
        let result = PeepholePass.run(&bc, &mut stats);

        assert_eq!(stats.peephole_optimizations, 1);
        assert_eq!(result.instructions, vec![0x03, 0x00]);
    }

    #[test]
    fn test_peephole_double_not() {
        // LOGICAL_NOT, LOGICAL_NOT -> (removed)
        let bytes = vec![0x30, 0x30];
        let bc = Bytecode::new(bytes, vec![]);

        let mut stats = OptimizationStats::default();
        let result = PeepholePass.run(&bc, &mut stats);

        assert_eq!(stats.peephole_optimizations, 1);
        assert!(result.instructions.is_empty());
    }

    #[test]
    fn test_pipeline() {
        // LDA_CONSTANT 0, STAR r0, LDA_CONSTANT 1, ADD r0, RETURN
        let bytes = vec![0x09, 0x00, 0x03, 0x00, 0x09, 0x01, 0x10, 0x00, 0x43];
        let pool = vec![serde_json::Value::from(10.0), serde_json::Value::from(20.0)];
        let bc = Bytecode::new(bytes, pool);

        let pipeline = OptimizationPipeline::new();
        let (result, stats) = pipeline.run(&bc);

        assert!(stats.instructions_after <= stats.instructions_before);
        assert!(stats.constants_folded >= 1);
    }
}
