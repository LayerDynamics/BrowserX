/**
 * Feedback System Types
 * Types for structured errors, progress notifications, and enhanced responses
 *
 * This module defines a comprehensive type system for providing rich,
 * actionable feedback to AI agents using the MCP server.
 */

/**
 * Error codes for structured error responses
 * Organized by category for easy lookup
 */
export enum MCPErrorCode {
  // === Timeout Errors ===
  TIMEOUT = "TIMEOUT",
  NAVIGATION_TIMEOUT = "NAVIGATION_TIMEOUT",
  SELECTOR_TIMEOUT = "SELECTOR_TIMEOUT",
  QUERY_TIMEOUT = "QUERY_TIMEOUT",
  SCRIPT_TIMEOUT = "SCRIPT_TIMEOUT",

  // === Permission Errors ===
  PERMISSION_DENIED = "PERMISSION_DENIED",
  TOOL_NOT_ALLOWED = "TOOL_NOT_ALLOWED",
  OPERATION_NOT_PERMITTED = "OPERATION_NOT_PERMITTED",

  // === Validation Errors ===
  VALIDATION_FAILED = "VALIDATION_FAILED",
  INVALID_URL = "INVALID_URL",
  INVALID_SELECTOR = "INVALID_SELECTOR",
  INVALID_SCRIPT = "INVALID_SCRIPT",
  INVALID_QUERY = "INVALID_QUERY",
  INVALID_PARAMETER = "INVALID_PARAMETER",
  MISSING_PARAMETER = "MISSING_PARAMETER",

  // === Session Errors ===
  SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
  SESSION_LIMIT_REACHED = "SESSION_LIMIT_REACHED",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  SESSION_CLOSED = "SESSION_CLOSED",

  // === Element Errors ===
  ELEMENT_NOT_FOUND = "ELEMENT_NOT_FOUND",
  ELEMENT_NOT_VISIBLE = "ELEMENT_NOT_VISIBLE",
  ELEMENT_NOT_INTERACTABLE = "ELEMENT_NOT_INTERACTABLE",
  ELEMENT_DETACHED = "ELEMENT_DETACHED",
  MULTIPLE_ELEMENTS = "MULTIPLE_ELEMENTS",

  // === Network Errors ===
  NETWORK_ERROR = "NETWORK_ERROR",
  DNS_RESOLUTION_FAILED = "DNS_RESOLUTION_FAILED",
  CONNECTION_REFUSED = "CONNECTION_REFUSED",
  CONNECTION_RESET = "CONNECTION_RESET",
  SSL_ERROR = "SSL_ERROR",
  HTTP_ERROR = "HTTP_ERROR",

  // === Navigation Errors ===
  NAVIGATION_FAILED = "NAVIGATION_FAILED",
  PAGE_CRASHED = "PAGE_CRASHED",
  FRAME_NOT_FOUND = "FRAME_NOT_FOUND",

  // === Proxy Errors ===
  PROXY_NOT_AVAILABLE = "PROXY_NOT_AVAILABLE",
  CACHE_ERROR = "CACHE_ERROR",
  INTERCEPTOR_ERROR = "INTERCEPTOR_ERROR",
  CACHE_MISS = "CACHE_MISS",

  // === Query Errors ===
  QUERY_PARSE_ERROR = "QUERY_PARSE_ERROR",
  QUERY_EXECUTION_ERROR = "QUERY_EXECUTION_ERROR",
  QUERY_CANCELLED = "QUERY_CANCELLED",
  QUERY_NOT_FOUND = "QUERY_NOT_FOUND",

  // === Internal Errors ===
  INTERNAL_ERROR = "INTERNAL_ERROR",
  NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
  RESOURCE_EXHAUSTED = "RESOURCE_EXHAUSTED",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

/**
 * Error context - provides additional information about where/how the error occurred
 */
export interface ErrorContext {
  /** Tool that generated the error */
  tool: string;
  /** Parameters that were passed (sanitized) */
  parameters?: Record<string, unknown>;
  /** Session ID if applicable */
  sessionId?: string;
  /** URL if applicable */
  url?: string;
  /** Selector if applicable */
  selector?: string;
  /** Query if applicable */
  query?: string;
  /** Duration before error in milliseconds */
  duration?: number;
  /** Additional tool-specific context */
  metadata?: Record<string, unknown>;
}

/**
 * Structured error response
 */
export interface MCPStructuredError {
  /** Error code for programmatic handling */
  code: MCPErrorCode;
  /** Human-readable error message */
  message: string;
  /** Actionable suggestion for resolving the error */
  suggestion: string;
  /** Context about where/how the error occurred */
  context: ErrorContext;
  /** Original error message or stack trace (for debugging) */
  cause?: string;
  /** Whether the operation can be retried */
  retryable: boolean;
}

/**
 * Progress notification levels
 */
export enum ProgressLevel {
  /** Informational progress update */
  INFO = "info",
  /** Debug-level detail (may be filtered) */
  DEBUG = "debug",
  /** Warning about potential issue */
  WARNING = "warning",
}

/**
 * Progress state for operations with measurable progress
 */
export interface ProgressState {
  /** Current step number */
  current: number;
  /** Total steps */
  total: number;
  /** Percentage complete (0-100) */
  percentage: number;
}

/**
 * Timing information for progress updates
 */
export interface ProgressTiming {
  /** Time elapsed in milliseconds */
  elapsed: number;
  /** Estimated time remaining in milliseconds */
  estimated?: number;
}

/**
 * Progress notification structure
 */
export interface ProgressNotification {
  /** Progress level */
  level: ProgressLevel;
  /** Current stage/phase of operation */
  stage: string;
  /** Human-readable message */
  message: string;
  /** Optional progress state */
  progress?: ProgressState;
  /** Optional timing information */
  timing?: ProgressTiming;
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Warning for success responses
 */
export interface ResponseWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Optional suggestion for handling the warning */
  suggestion?: string;
}

/**
 * Timing breakdown for operations
 */
export interface TimingBreakdown {
  /** Total operation time in milliseconds */
  total: number;
  /** Optional breakdown by phase */
  breakdown?: Record<string, number>;
}

/**
 * Enhanced success response
 */
export interface EnhancedSuccessResponse<T = unknown> {
  /** Always true for success */
  success: true;
  /** Response data */
  data: T;
  /** Timing information */
  timing: TimingBreakdown;
  /** Optional warnings */
  warnings?: ResponseWarning[];
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Enhanced error response (wraps MCPStructuredError)
 */
export interface EnhancedErrorResponse {
  /** Always false for error */
  success: false;
  /** Structured error */
  error: Omit<MCPStructuredError, "cause">;
}

/**
 * Progress stage definitions for common operations
 */
export const PROGRESS_STAGES = {
  /** Browser navigation stages */
  NAVIGATE: {
    STARTING: "Starting navigation",
    DNS_LOOKUP: "Resolving DNS",
    CONNECTING: "Establishing connection",
    TLS_HANDSHAKE: "TLS handshake",
    REQUESTING: "Sending request",
    RECEIVING: "Receiving response",
    PARSING: "Parsing HTML",
    LOADING_RESOURCES: "Loading resources",
    DOM_READY: "DOM content loaded",
    COMPLETE: "Page load complete",
  },

  /** Wait operation stages */
  WAIT: {
    STARTING: "Starting wait",
    CHECKING: "Checking condition",
    POLLING: "Polling for condition",
    SATISFIED: "Condition satisfied",
  },

  /** Query execution stages */
  QUERY: {
    PARSING: "Parsing query",
    ANALYZING: "Semantic analysis",
    OPTIMIZING: "Optimizing query",
    PLANNING: "Creating execution plan",
    EXECUTING: "Executing query",
    FORMATTING: "Formatting results",
  },

  /** Screenshot stages */
  SCREENSHOT: {
    PREPARING: "Preparing screenshot",
    RENDERING: "Rendering page",
    CAPTURING: "Capturing image",
    ENCODING: "Encoding result",
  },

  /** PDF generation stages */
  PDF: {
    PREPARING: "Preparing PDF",
    RENDERING: "Rendering page",
    GENERATING: "Generating PDF",
    ENCODING: "Encoding result",
  },

  /** Session stages */
  SESSION: {
    CREATING: "Creating session",
    INITIALIZING: "Initializing browser",
    READY: "Session ready",
    CLOSING: "Closing session",
    CLOSED: "Session closed",
  },
} as const;

/**
 * Common warning codes
 */
export const WARNING_CODES = {
  /** URL was redirected */
  URL_REDIRECTED: "URL_REDIRECTED",
  /** Element found but not visible */
  ELEMENT_NOT_VISIBLE: "ELEMENT_NOT_VISIBLE",
  /** Multiple elements matched selector */
  MULTIPLE_MATCHES: "MULTIPLE_MATCHES",
  /** Operation took longer than expected */
  SLOW_OPERATION: "SLOW_OPERATION",
  /** Resource was served from cache */
  CACHED_RESPONSE: "CACHED_RESPONSE",
  /** Feature is deprecated */
  DEPRECATED: "DEPRECATED",
  /** Timeout was capped to tier maximum */
  TIMEOUT_CAPPED: "TIMEOUT_CAPPED",
} as const;
