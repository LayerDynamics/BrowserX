/**
 * Middleware Module
 *
 * Exports all middleware types and implementations
 */

// Types
export type {
  AuthenticatedUser,
  MiddlewareChainConfig,
  MiddlewareConfig,
  MiddlewareResult,
  RequestContext,
  RequestMiddleware,
  ResponseMiddleware,
} from "./types.ts";

// Middleware chain
export { createErrorResponse, MiddlewareChain } from "./middleware_chain.ts";

// Auth middleware
export {
  AuthenticationError,
  AuthMiddleware,
  InMemoryTokenValidator,
  InMemoryUserValidator,
} from "./auth.ts";
export type {
  AuthMethod,
  AuthMiddlewareConfig,
  BasicAuthValidator,
  TokenValidator,
  UserValidator,
} from "./auth.ts";

// Rate limit middleware
export { RateLimitError, RateLimitMiddleware } from "./rate_limit.ts";
export type { RateLimitAlgorithm, RateLimitConfig } from "./rate_limit.ts";

// Logging middleware
export {
  CombinedLogFormatter,
  CombinedLoggingMiddleware,
  CommonLogFormatter,
  ConsoleLogger,
  RequestLoggingMiddleware,
  ResponseLoggingMiddleware,
} from "./logging.ts";
export type { LogFormat, Logger, LoggingConfig, LogLevel } from "./logging.ts";

// CORS middleware
export { CORSMiddleware } from "./cors.ts";
export type { CORSConfig } from "./cors.ts";

// Compression middleware
export { CompressionMiddleware } from "./compression.ts";
export type { CompressionConfig, CompressionEncoding } from "./compression.ts";

// Header transformation middleware
export {
  HeaderTransformMiddleware,
  RequestHeaderMiddleware,
  ResponseHeaderMiddleware,
} from "./headers.ts";
export type { HeaderOperation, HeaderRule, HeaderTransformConfig } from "./headers.ts";
