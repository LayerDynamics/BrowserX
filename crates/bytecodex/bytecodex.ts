/**
 * ByteCodeX — Bytecode Optimization & Validation via Rust FFI
 *
 * Provides high-level API over bytecodex FFI bindings for optimizing,
 * validating, and disassembling BrowserX JavaScript bytecode.
 */

import {
  bytecodex_init,
  bytecodex_version,
  bytecodex_get_last_error,
  bytecodex_optimize,
  bytecodex_validate,
  bytecodex_disassemble,
  preloadLib,
  closeLib,
} from "./bindings/bindings.ts";

/**
 * Bytecode input format for FFI calls
 */
export interface BytecodeInput {
  /** Raw bytecode instruction bytes */
  instructions: number[];
  /** Constant pool values (numbers, strings, etc.) */
  constant_pool: (string | number | boolean | null)[];
}

/**
 * Optimization statistics returned by the optimizer
 */
export interface OptimizationStats {
  instructions_before: number;
  instructions_after: number;
  constants_folded: number;
  dead_stores_removed: number;
  peephole_optimizations: number;
}

/**
 * Result of bytecode optimization
 */
export interface OptimizationResult {
  /** Optimized bytecode instructions */
  instructions: number[];
  /** Updated constant pool */
  constant_pool: (string | number | boolean | null)[];
  /** Optimization statistics */
  stats: OptimizationStats;
}

/**
 * Validation error with location and severity
 */
export interface ValidationError {
  offset: number;
  message: string;
  severity: "Error" | "Warning";
}

/**
 * Result of bytecode validation
 */
export interface ValidationResult {
  /** Whether the bytecode is valid (no Error-severity issues) */
  valid: boolean;
  /** List of validation errors and warnings */
  errors: ValidationError[];
  /** Number of decoded instructions */
  instruction_count: number;
  /** Highest register index referenced, if any */
  max_register: number | null;
  /** Highest constant pool index referenced, if any */
  max_constant_index: number | null;
}

/**
 * Main ByteCodeX class providing high-level bytecode optimization API
 */
export class ByteCodeX {
  private initialized = false;

  constructor() {
    const result = bytecodex_init();
    this.initialized = result === 1;
    if (!this.initialized) {
      throw new Error(`Failed to initialize bytecodex: ${this.getLastError()}`);
    }
  }

  /**
   * Get library version
   */
  get version(): string {
    return bytecodex_version();
  }

  /**
   * Get last error message (if any)
   */
  getLastError(): string {
    return bytecodex_get_last_error();
  }

  /**
   * Optimize bytecode using the full optimization pipeline:
   * 1. Constant folding (arithmetic on constants → single constant)
   * 2. Dead store elimination (STAR rN where rN is never read)
   * 3. Peephole optimizations (STAR+LDAR → STAR, double NOT → remove)
   *
   * @param bytecode - Bytecode input with instructions and constant pool
   * @returns Optimized bytecode with statistics
   */
  optimize(bytecode: BytecodeInput): OptimizationResult {
    const json = JSON.stringify(bytecode);
    const resultJson = bytecodex_optimize(json);
    if (!resultJson) {
      throw new Error(`bytecodex optimize failed: ${this.getLastError() || "unknown error"}`);
    }
    try {
      return JSON.parse(resultJson) as OptimizationResult;
    } catch (e) {
      throw new Error(`bytecodex optimize result parse failed: ${e}`);
    }
  }

  /**
   * Validate bytecode for correctness:
   * - Valid opcodes with correct operand counts
   * - Constant pool index bounds checking
   * - Jump targets land on instruction boundaries
   * - Tracks max register and constant pool indices
   *
   * @param bytecode - Bytecode input to validate
   * @returns Validation result
   */
  validate(bytecode: BytecodeInput): ValidationResult {
    const json = JSON.stringify(bytecode);
    const resultJson = bytecodex_validate(json);
    if (!resultJson) {
      throw new Error(`bytecodex validate failed: ${this.getLastError() || "unknown error"}`);
    }
    try {
      return JSON.parse(resultJson) as ValidationResult;
    } catch (e) {
      throw new Error(`bytecodex validate result parse failed: ${e}`);
    }
  }

  /**
   * Disassemble bytecode to human-readable text
   *
   * @param bytecode - Bytecode input to disassemble
   * @returns Human-readable disassembly string
   */
  disassemble(bytecode: BytecodeInput): string {
    const json = JSON.stringify(bytecode);
    return bytecodex_disassemble(json);
  }

  /**
   * Release native FFI library resources
   */
  dispose(): void {
    closeLib();
    this.initialized = false;
  }

  // deno-lint-ignore no-explicit-any
  [(Symbol as any).dispose](): void {
    this.dispose();
  }
}

export { preloadLib, closeLib };
