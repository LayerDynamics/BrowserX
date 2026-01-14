/**
 * Error utility functions
 * Error creation, formatting, wrapping, retry logic
 */

/**
 * Create error with additional context
 */
export function createError(
  message: string,
  code?: string,
  context?: Record<string, unknown>,
): Error & { code?: string; context?: Record<string, unknown> } {
  const error: any = new Error(message);
  if (code) error.code = code;
  if (context) error.context = context;
  return error;
}

/**
 * Wrap error with additional message
 */
export function wrapError(original: Error, message: string): Error {
  const wrapped = new Error(`${message}: ${original.message}`);
  (wrapped as any).cause = original;
  wrapped.stack = original.stack;
  return wrapped;
}

/**
 * Format error with context for display
 */
export function formatError(error: Error): string {
  const parts: string[] = [error.message];

  if ((error as any).code) {
    parts.push(`Code: ${(error as any).code}`);
  }

  if ((error as any).context) {
    parts.push(`Context: ${JSON.stringify((error as any).context, null, 2)}`);
  }

  if (error.stack) {
    parts.push(`Stack: ${error.stack}`);
  }

  return parts.join("\n");
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error != null && typeof error === "object" && "message" in error) {
    return String((error as any).message);
  }
  return String(error);
}

/**
 * Check if error should trigger retry
 */
export function shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts) return false;

  // Check for retryable error codes/types
  if (error instanceof Error) {
    const code = (error as any).code;

    // Network errors are retryable
    const retryableCodes = [
      "ECONNRESET",
      "ETIMEDOUT",
      "ECONNREFUSED",
      "ENETUNREACH",
      "EAI_AGAIN",
    ];

    if (code && retryableCodes.includes(code)) {
      return true;
    }

    // HTTP status codes that are retryable
    const status = (error as any).status || (error as any).statusCode;
    if (status) {
      // 429 Too Many Requests, 503 Service Unavailable, 504 Gateway Timeout
      if ([429, 503, 504].includes(status)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000,
  jitter: boolean = true,
): number {
  // Exponential backoff: baseDelay * 2^attempt
  let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

  // Add jitter to prevent thundering herd
  if (jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }

  return Math.floor(delay);
}

/**
 * Aggregate multiple errors
 */
export class AggregateError extends Error {
  errors: Error[];

  constructor(errors: Error[], message?: string) {
    super(message || `${errors.length} errors occurred`);
    this.name = "AggregateError";
    this.errors = errors;
  }
}

/**
 * Create aggregate error from array of errors
 */
export function createAggregateError(errors: Error[], message?: string): AggregateError {
  return new AggregateError(errors, message);
}

/**
 * Assert condition or throw error
 */
export function assert(
  condition: unknown,
  message: string = "Assertion failed",
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Assert value is not null/undefined
 */
export function assertNotNull<T>(
  value: T | null | undefined,
  message?: string,
): asserts value is T {
  if (value == null) {
    throw new Error(message || "Value is null or undefined");
  }
}

/**
 * Try/catch wrapper that returns result or error
 */
export function tryCatch<T>(
  fn: () => T,
): { success: true; value: T } | { success: false; error: Error } {
  try {
    const value = fn();
    return { success: true, value };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Async try/catch wrapper
 */
export async function tryAsync<T>(
  fn: () => Promise<T>,
): Promise<{ success: true; value: T } | { success: false; error: Error }> {
  try {
    const value = await fn();
    return { success: true, value };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
