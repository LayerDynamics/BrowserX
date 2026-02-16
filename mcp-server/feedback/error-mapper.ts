/**
 * Error Mapper
 * Converts raw errors to structured MCPStructuredError with actionable suggestions
 *
 * Uses pattern matching to identify error types and provide helpful suggestions.
 */

import { MCPErrorCode, type MCPStructuredError, type ErrorContext } from "./types.ts";

/**
 * Error pattern matching rule
 */
interface ErrorPattern {
  /** Pattern to match against error message */
  match: RegExp | ((error: Error) => boolean);
  /** Error code to use when matched */
  code: MCPErrorCode;
  /** Suggestion for resolving the error */
  suggestion: string;
  /** Whether the error is retryable */
  retryable: boolean;
}

/**
 * Error patterns for automatic mapping
 * Patterns are checked in order - first match wins
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  // === Timeout Patterns ===
  {
    match: /navigation.*timeout|timeout.*navigat/i,
    code: MCPErrorCode.NAVIGATION_TIMEOUT,
    suggestion: "The page took too long to load. Try increasing the timeout parameter or check if the URL is accessible.",
    retryable: true,
  },
  {
    match: /waiting for selector.*timeout|selector.*timeout/i,
    code: MCPErrorCode.SELECTOR_TIMEOUT,
    suggestion: "Element did not appear in time. Verify the selector with browser_query_dom or increase the timeout.",
    retryable: true,
  },
  {
    match: /script.*timeout|evaluation.*timeout/i,
    code: MCPErrorCode.SCRIPT_TIMEOUT,
    suggestion: "JavaScript execution took too long. Simplify the script or increase the timeout.",
    retryable: true,
  },
  {
    match: /query.*timeout/i,
    code: MCPErrorCode.QUERY_TIMEOUT,
    suggestion: "Query execution timed out. Try simplifying the query or increasing the timeout.",
    retryable: true,
  },
  {
    match: /timeout|timed out|deadline exceeded/i,
    code: MCPErrorCode.TIMEOUT,
    suggestion: "The operation timed out. Try increasing the timeout parameter or check server health.",
    retryable: true,
  },

  // === Session Patterns ===
  {
    match: /session not found|invalid session|unknown session/i,
    code: MCPErrorCode.SESSION_NOT_FOUND,
    suggestion: "Session does not exist. Create a new session with browser_navigate or use browser_list_sessions to see active sessions.",
    retryable: false,
  },
  {
    match: /session limit|max.*session|too many session/i,
    code: MCPErrorCode.SESSION_LIMIT_REACHED,
    suggestion: "Maximum session limit reached. Close unused sessions with browser_close_session before creating new ones.",
    retryable: false,
  },
  {
    match: /session.*expired|session.*closed/i,
    code: MCPErrorCode.SESSION_EXPIRED,
    suggestion: "Session has expired or was closed. Create a new session with browser_navigate.",
    retryable: false,
  },

  // === Element Patterns ===
  {
    match: /element not found|no element.*match|cannot find element/i,
    code: MCPErrorCode.ELEMENT_NOT_FOUND,
    suggestion: "Element not found. Verify the selector using browser_query_dom or check if the element exists on the page.",
    retryable: false,
  },
  {
    match: /element.*not visible|hidden element|visibility.*hidden/i,
    code: MCPErrorCode.ELEMENT_NOT_VISIBLE,
    suggestion: "Element exists but is not visible. Try scrolling to the element or waiting for visibility.",
    retryable: true,
  },
  {
    match: /not interactable|element is not clickable|cannot.*interact/i,
    code: MCPErrorCode.ELEMENT_NOT_INTERACTABLE,
    suggestion: "Element cannot be interacted with. It may be covered by another element, disabled, or require scrolling.",
    retryable: true,
  },
  {
    match: /element.*detached|stale element/i,
    code: MCPErrorCode.ELEMENT_DETACHED,
    suggestion: "Element was removed from the DOM. Re-query the element before interacting with it.",
    retryable: true,
  },

  // === Network Patterns ===
  {
    match: /ECONNREFUSED|connection refused/i,
    code: MCPErrorCode.CONNECTION_REFUSED,
    suggestion: "Server refused the connection. Verify the URL and that the server is running.",
    retryable: true,
  },
  {
    match: /ENOTFOUND|DNS.*fail|getaddrinfo.*ENOTFOUND/i,
    code: MCPErrorCode.DNS_RESOLUTION_FAILED,
    suggestion: "DNS lookup failed. Check the hostname spelling and your network connection.",
    retryable: true,
  },
  {
    match: /ECONNRESET|connection reset/i,
    code: MCPErrorCode.CONNECTION_RESET,
    suggestion: "Connection was reset by the server. Try again or check if the server is overloaded.",
    retryable: true,
  },
  {
    match: /SSL|TLS|certificate|CERT_|ERR_CERT_/i,
    code: MCPErrorCode.SSL_ERROR,
    suggestion: "SSL/TLS error. The site may have an invalid or expired certificate.",
    retryable: false,
  },
  {
    match: /network.*error|fetch.*fail|request.*fail/i,
    code: MCPErrorCode.NETWORK_ERROR,
    suggestion: "Network error occurred. Check your connection and try again.",
    retryable: true,
  },

  // === Navigation Patterns ===
  {
    match: /navigation.*fail|failed.*navigat/i,
    code: MCPErrorCode.NAVIGATION_FAILED,
    suggestion: "Navigation failed. Check the URL and try again.",
    retryable: true,
  },
  {
    match: /page.*crash|target.*crash/i,
    code: MCPErrorCode.PAGE_CRASHED,
    suggestion: "Page crashed. Close the session and try again with a new session.",
    retryable: false,
  },

  // === Permission Patterns ===
  {
    match: /permission denied|not authorized|access denied/i,
    code: MCPErrorCode.PERMISSION_DENIED,
    suggestion: "This operation requires higher permissions. Check the MCP_PERMISSIONS environment variable.",
    retryable: false,
  },
  {
    match: /tool.*not allowed|operation.*not permitted/i,
    code: MCPErrorCode.TOOL_NOT_ALLOWED,
    suggestion: "This tool is not allowed with current permissions. Contact the administrator.",
    retryable: false,
  },

  // === Validation Patterns ===
  {
    match: /invalid url|url.*invalid|malformed.*url/i,
    code: MCPErrorCode.INVALID_URL,
    suggestion: "Provide a valid URL starting with http:// or https://.",
    retryable: false,
  },
  {
    match: /invalid selector|selector.*invalid|bad selector/i,
    code: MCPErrorCode.INVALID_SELECTOR,
    suggestion: "Invalid CSS selector syntax. Use browser_query_dom to test selectors.",
    retryable: false,
  },
  {
    match: /dangerous pattern|script.*blocked|unsafe.*script/i,
    code: MCPErrorCode.INVALID_SCRIPT,
    suggestion: "Script contains blocked patterns. Avoid eval, fetch, require, and other dangerous APIs.",
    retryable: false,
  },
  {
    match: /query.*parse|syntax error.*query|invalid.*query/i,
    code: MCPErrorCode.QUERY_PARSE_ERROR,
    suggestion: "Query syntax error. Check the query syntax using browserx_query_explain.",
    retryable: false,
  },

  // === Proxy Patterns ===
  {
    match: /proxy.*not available|controller not available/i,
    code: MCPErrorCode.PROXY_NOT_AVAILABLE,
    suggestion: "Proxy is not enabled or available. Check the server configuration.",
    retryable: false,
  },
  {
    match: /cache.*miss|not.*in.*cache/i,
    code: MCPErrorCode.CACHE_MISS,
    suggestion: "Item not found in cache. It may have expired or never been cached.",
    retryable: false,
  },
  {
    match: /cache.*error/i,
    code: MCPErrorCode.CACHE_ERROR,
    suggestion: "Cache operation failed. Try again or check cache configuration.",
    retryable: true,
  },

  // === Query Patterns ===
  {
    match: /query.*cancel/i,
    code: MCPErrorCode.QUERY_CANCELLED,
    suggestion: "Query was cancelled. Submit a new query if needed.",
    retryable: false,
  },
  {
    match: /query.*not found|unknown.*query/i,
    code: MCPErrorCode.QUERY_NOT_FOUND,
    suggestion: "Query ID not found. It may have completed or been cancelled.",
    retryable: false,
  },

  // === Resource Patterns ===
  {
    match: /out of memory|memory.*exhaust/i,
    code: MCPErrorCode.RESOURCE_EXHAUSTED,
    suggestion: "Server is out of memory. Close unused sessions and try again.",
    retryable: true,
  },
];

/**
 * Map a raw error to a structured error
 *
 * @param error - The raw error to map
 * @param toolName - Name of the tool that generated the error
 * @param context - Additional context to include
 * @returns Structured error with code, message, suggestion, and context
 */
export function mapError(
  error: unknown,
  toolName: string,
  context?: Partial<Omit<ErrorContext, "tool">>,
): MCPStructuredError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Find matching pattern
  for (const pattern of ERROR_PATTERNS) {
    const matches =
      typeof pattern.match === "function"
        ? pattern.match(error as Error)
        : pattern.match.test(errorMessage);

    if (matches) {
      return {
        code: pattern.code,
        message: errorMessage,
        suggestion: pattern.suggestion,
        context: {
          tool: toolName,
          ...context,
        },
        cause: errorStack,
        retryable: pattern.retryable,
      };
    }
  }

  // Default to internal error for unmatched patterns
  return {
    code: MCPErrorCode.INTERNAL_ERROR,
    message: errorMessage,
    suggestion: "An unexpected error occurred. Check the error message for details and try again.",
    context: {
      tool: toolName,
      ...context,
    },
    cause: errorStack,
    retryable: false,
  };
}

/**
 * Create a structured error directly (without pattern matching)
 */
export function createError(
  code: MCPErrorCode,
  message: string,
  toolName: string,
  options?: {
    suggestion?: string;
    context?: Partial<Omit<ErrorContext, "tool">>;
    cause?: string;
    retryable?: boolean;
  },
): MCPStructuredError {
  return {
    code,
    message,
    suggestion: options?.suggestion ?? getDefaultSuggestion(code),
    context: {
      tool: toolName,
      ...options?.context,
    },
    cause: options?.cause,
    retryable: options?.retryable ?? isRetryableCode(code),
  };
}

/**
 * Get default suggestion for an error code
 */
function getDefaultSuggestion(code: MCPErrorCode): string {
  const suggestions: Partial<Record<MCPErrorCode, string>> = {
    [MCPErrorCode.TIMEOUT]: "Try increasing the timeout parameter.",
    [MCPErrorCode.SESSION_NOT_FOUND]: "Create a new session with browser_navigate.",
    [MCPErrorCode.ELEMENT_NOT_FOUND]: "Verify the selector with browser_query_dom.",
    [MCPErrorCode.NETWORK_ERROR]: "Check your network connection and try again.",
    [MCPErrorCode.PERMISSION_DENIED]: "Check your permission level.",
    [MCPErrorCode.INTERNAL_ERROR]: "An unexpected error occurred. Please try again.",
  };

  return suggestions[code] ?? "Please try again or contact support if the issue persists.";
}

/**
 * Check if an error code is typically retryable
 */
function isRetryableCode(code: MCPErrorCode): boolean {
  const retryableCodes = new Set([
    MCPErrorCode.TIMEOUT,
    MCPErrorCode.NAVIGATION_TIMEOUT,
    MCPErrorCode.SELECTOR_TIMEOUT,
    MCPErrorCode.QUERY_TIMEOUT,
    MCPErrorCode.SCRIPT_TIMEOUT,
    MCPErrorCode.NETWORK_ERROR,
    MCPErrorCode.CONNECTION_REFUSED,
    MCPErrorCode.CONNECTION_RESET,
    MCPErrorCode.DNS_RESOLUTION_FAILED,
    MCPErrorCode.ELEMENT_NOT_VISIBLE,
    MCPErrorCode.ELEMENT_NOT_INTERACTABLE,
    MCPErrorCode.ELEMENT_DETACHED,
    MCPErrorCode.NAVIGATION_FAILED,
    MCPErrorCode.CACHE_ERROR,
    MCPErrorCode.RESOURCE_EXHAUSTED,
    MCPErrorCode.SERVICE_UNAVAILABLE,
  ]);

  return retryableCodes.has(code);
}

/**
 * Format structured error for MCP response
 */
export function formatErrorResponse(error: MCPStructuredError): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
              suggestion: error.suggestion,
              retryable: error.retryable,
              context: {
                tool: error.context.tool,
                ...(error.context.sessionId && { sessionId: error.context.sessionId }),
                ...(error.context.url && { url: error.context.url }),
                ...(error.context.selector && { selector: error.context.selector }),
                ...(error.context.query && { query: error.context.query }),
                ...(error.context.duration && { duration: error.context.duration }),
              },
            },
          },
          null,
          2,
        ),
      },
    ],
    isError: true,
  };
}

/**
 * Check if an error should be logged (for debugging)
 */
export function shouldLogError(error: MCPStructuredError): boolean {
  // Log internal errors and non-retryable errors
  return error.code === MCPErrorCode.INTERNAL_ERROR || !error.retryable;
}
