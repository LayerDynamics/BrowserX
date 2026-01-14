/**
 * Error types for query engine
 */

/**
 * Base query error
 */
export class QueryError extends Error {
  readonly code: string;
  readonly recoverable: boolean;
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    recoverable: boolean = false,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "QueryError";
    this.code = code;
    this.recoverable = recoverable;
    this.context = context;
  }
}

/**
 * Lexer error
 */
export class LexerError extends QueryError {
  constructor(message: string, line: number, column: number) {
    super(message, "LEXER_ERROR", false, { line, column });
    this.name = "LexerError";
  }
}

/**
 * Parser error
 */
export class ParserError extends QueryError {
  constructor(message: string, token?: unknown) {
    super(message, "PARSER_ERROR", false, { token });
    this.name = "ParserError";
  }
}

/**
 * Semantic error
 */
export class SemanticError extends QueryError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "SEMANTIC_ERROR", false, context);
    this.name = "SemanticError";
  }
}

/**
 * Type checking error
 */
export class TypeCheckError extends QueryError {
  constructor(message: string, expected?: string, actual?: string) {
    super(message, "TYPE_ERROR", false, { expected, actual });
    this.name = "TypeCheckError";
  }
}

/**
 * Validation error
 */
export class ValidationError extends QueryError {
  constructor(message: string, field?: string) {
    super(message, "VALIDATION_ERROR", false, { field });
    this.name = "ValidationError";
  }
}

/**
 * Execution error
 */
export class ExecutionError extends QueryError {
  constructor(message: string, stepId?: string, recoverable: boolean = true) {
    super(message, "EXECUTION_ERROR", recoverable, { stepId });
    this.name = "ExecutionError";
  }
}

/**
 * Browser error
 */
export class BrowserError extends QueryError {
  constructor(message: string, recoverable: boolean = true) {
    super(message, "BROWSER_ERROR", recoverable);
    this.name = "BrowserError";
  }
}

/**
 * Network error
 */
export class NetworkError extends QueryError {
  constructor(message: string, url?: string, statusCode?: number) {
    super(message, "NETWORK_ERROR", true, { url, statusCode });
    this.name = "NetworkError";
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends QueryError {
  constructor(message: string, duration?: number) {
    super(message, "TIMEOUT_ERROR", true, { duration });
    this.name = "TimeoutError";
  }
}

/**
 * Resource error
 */
export class ResourceError extends QueryError {
  constructor(message: string, resource?: string) {
    super(message, "RESOURCE_ERROR", true, { resource });
    this.name = "ResourceError";
  }
}

/**
 * Security error
 */
export class SecurityError extends QueryError {
  constructor(message: string, violation?: string) {
    super(message, "SECURITY_ERROR", false, { violation });
    this.name = "SecurityError";
  }
}

/**
 * Permission error
 */
export class PermissionError extends QueryError {
  constructor(message: string, permission?: string) {
    super(message, "PERMISSION_ERROR", false, { permission });
    this.name = "PermissionError";
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends QueryError {
  constructor(message: string, retryAfter?: number) {
    super(message, "RATE_LIMIT_ERROR", true, { retryAfter });
    this.name = "RateLimitError";
  }
}

/**
 * Cache error
 */
export class CacheError extends QueryError {
  constructor(message: string, cacheKey?: string) {
    super(message, "CACHE_ERROR", true, { cacheKey });
    this.name = "CacheError";
  }
}
