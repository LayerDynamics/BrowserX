/**
 * Errors Module
 * Exports all error types
 */

// Exclude SemanticError, TypeCheckError, ValidationError which are exported from analyzer/
export {
  BrowserError,
  CacheError,
  ExecutionError,
  LexerError,
  NetworkError,
  ParserError,
  PermissionError,
  QueryError,
  RateLimitError,
  ResourceError,
  SecurityError,
  TimeoutError,
} from "./types.ts";
