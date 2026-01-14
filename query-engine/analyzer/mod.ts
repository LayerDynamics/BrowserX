/**
 * Semantic Analyzer Module
 * Exports all semantic analysis components
 */

// Main semantic analyzer
export {
  type AnnotatedAST,
  SemanticAnalyzer,
  type SemanticAnalyzerConfig,
  SemanticError,
} from "./semantic.ts";

// Symbol table
export {
  ScopeType,
  type Symbol,
  type SymbolLocation,
  type SymbolMetadata,
  type SymbolScope,
  SymbolTable,
  SymbolType,
} from "./symbols.ts";

// Type checker
export { TypeChecker, TypeCheckError } from "./type-checker.ts";

// Validator
export { ValidationError, Validator } from "./validator.ts";
