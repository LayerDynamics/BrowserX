/**
 * Error Messages and Utilities Tests
 * Comprehensive tests for error creation, formatting, wrapping, and retry logic
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import {
  type ExtendedError,
  createError,
  wrapError,
  formatError,
  getErrorMessage,
  shouldRetry,
  calculateRetryDelay,
  AggregateError,
  createAggregateError,
  assert as assertUtil,
  assertNotNull,
  tryCatch,
  tryAsync,
} from "../../utils/error-utils.ts";

// ============================================================================
// ExtendedError Interface Tests
// ============================================================================

Deno.test("ExtendedError - basic error with message", () => {
  const error: ExtendedError = new Error("Test error");

  assertEquals(error.message, "Test error");
  assertExists(error.stack);
});

Deno.test("ExtendedError - with code property", () => {
  const error = new Error("Test error") as ExtendedError;
  error.code = "ERR_TEST";

  assertEquals(error.code, "ERR_TEST");
});

Deno.test("ExtendedError - with context property", () => {
  const error = new Error("Test error") as ExtendedError;
  error.context = { userId: 123, action: "fetch" };

  assertExists(error.context);
  assertEquals(error.context.userId, 123);
  assertEquals(error.context.action, "fetch");
});

Deno.test("ExtendedError - with cause property", () => {
  const originalError = new Error("Original");
  const error = new Error("Wrapped") as ExtendedError;
  error.cause = originalError;

  assertExists(error.cause);
  assertEquals(error.cause.message, "Original");
});

Deno.test("ExtendedError - with status property", () => {
  const error = new Error("Not Found") as ExtendedError;
  error.status = 404;

  assertEquals(error.status, 404);
});

Deno.test("ExtendedError - with statusCode property", () => {
  const error = new Error("Server Error") as ExtendedError;
  error.statusCode = 500;

  assertEquals(error.statusCode, 500);
});

Deno.test("ExtendedError - with all properties", () => {
  const cause = new Error("Root cause");
  const error = new Error("Full error") as ExtendedError;
  error.code = "ERR_FULL";
  error.context = { key: "value" };
  error.cause = cause;
  error.status = 400;
  error.statusCode = 400;

  assertEquals(error.code, "ERR_FULL");
  assertExists(error.context);
  assertEquals(error.cause, cause);
  assertEquals(error.status, 400);
  assertEquals(error.statusCode, 400);
});

// ============================================================================
// createError Tests
// ============================================================================

Deno.test("createError - with message only", () => {
  const error = createError("Simple error");

  assertEquals(error.message, "Simple error");
  assertEquals(error.code, undefined);
  assertEquals(error.context, undefined);
});

Deno.test("createError - with message and code", () => {
  const error = createError("Error with code", "ERR_CODE");

  assertEquals(error.message, "Error with code");
  assertEquals(error.code, "ERR_CODE");
  assertEquals(error.context, undefined);
});

Deno.test("createError - with all parameters", () => {
  const context = { requestId: "abc123", method: "POST" };
  const error = createError("Full error", "ERR_FULL", context);

  assertEquals(error.message, "Full error");
  assertEquals(error.code, "ERR_FULL");
  assertExists(error.context);
  assertEquals(error.context.requestId, "abc123");
  assertEquals(error.context.method, "POST");
});

Deno.test("createError - error is instanceof Error", () => {
  const error = createError("Test error");

  assert(error instanceof Error);
});

Deno.test("createError - has stack trace", () => {
  const error = createError("Test error");

  assertExists(error.stack);
  assert(error.stack!.length > 0);
});

Deno.test("createError - context with complex values", () => {
  const context = {
    nested: { deep: { value: 42 } },
    array: [1, 2, 3],
    nullValue: null,
    undefinedValue: undefined,
  };
  const error = createError("Complex context", "ERR_COMPLEX", context);

  assertExists(error.context);
  assertEquals((error.context.nested as Record<string, unknown>).deep, { value: 42 });
  assertEquals(error.context.array, [1, 2, 3]);
});

// ============================================================================
// wrapError Tests
// ============================================================================

Deno.test("wrapError - combines messages", () => {
  const original = new Error("Original error");
  const wrapped = wrapError(original, "Wrapper message");

  assertEquals(wrapped.message, "Wrapper message: Original error");
});

Deno.test("wrapError - preserves cause", () => {
  const original = new Error("Original error");
  const wrapped = wrapError(original, "Wrapper");

  assertEquals(wrapped.cause, original);
});

Deno.test("wrapError - preserves original stack", () => {
  const original = new Error("Original error");
  const wrapped = wrapError(original, "Wrapper");

  assertEquals(wrapped.stack, original.stack);
});

Deno.test("wrapError - wraps extended error", () => {
  const original = createError("Original", "ERR_ORIG", { key: "value" });
  const wrapped = wrapError(original, "Wrapped");

  assertEquals(wrapped.message, "Wrapped: Original");
  assertEquals(wrapped.cause, original);
  assertEquals((wrapped.cause as ExtendedError).code, "ERR_ORIG");
});

Deno.test("wrapError - multiple wrapping levels", () => {
  const level1 = new Error("Level 1");
  const level2 = wrapError(level1, "Level 2");
  const level3 = wrapError(level2, "Level 3");

  assertEquals(level3.message, "Level 3: Level 2: Level 1");
  assertEquals(level3.cause, level2);
  assertEquals((level3.cause as ExtendedError).cause, level1);
});

// ============================================================================
// formatError Tests
// ============================================================================

Deno.test("formatError - basic error message", () => {
  const error = new Error("Test message");
  const formatted = formatError(error);

  assert(formatted.includes("Test message"));
});

Deno.test("formatError - includes code", () => {
  const error = createError("Test error", "ERR_TEST");
  const formatted = formatError(error);

  assert(formatted.includes("Test error"));
  assert(formatted.includes("Code: ERR_TEST"));
});

Deno.test("formatError - includes context", () => {
  const error = createError("Test error", "ERR_TEST", { userId: 123 });
  const formatted = formatError(error);

  assert(formatted.includes("Test error"));
  assert(formatted.includes("Context:"));
  assert(formatted.includes("userId"));
  assert(formatted.includes("123"));
});

Deno.test("formatError - includes stack trace", () => {
  const error = new Error("Test error");
  const formatted = formatError(error);

  assert(formatted.includes("Stack:"));
});

Deno.test("formatError - full format with all fields", () => {
  const error = createError("Full error", "ERR_FULL", { key: "value" });
  const formatted = formatError(error);

  const parts = formatted.split("\n");
  assert(parts.length >= 3); // message, code, context, stack
  assert(parts[0].includes("Full error"));
});

// ============================================================================
// getErrorMessage Tests
// ============================================================================

Deno.test("getErrorMessage - from Error instance", () => {
  const error = new Error("Error message");
  const message = getErrorMessage(error);

  assertEquals(message, "Error message");
});

Deno.test("getErrorMessage - from string", () => {
  const message = getErrorMessage("String error");

  assertEquals(message, "String error");
});

Deno.test("getErrorMessage - from object with message", () => {
  const obj = { message: "Object message" };
  const message = getErrorMessage(obj);

  assertEquals(message, "Object message");
});

Deno.test("getErrorMessage - from number", () => {
  const message = getErrorMessage(42);

  assertEquals(message, "42");
});

Deno.test("getErrorMessage - from null", () => {
  const message = getErrorMessage(null);

  assertEquals(message, "null");
});

Deno.test("getErrorMessage - from undefined", () => {
  const message = getErrorMessage(undefined);

  assertEquals(message, "undefined");
});

Deno.test("getErrorMessage - from boolean", () => {
  assertEquals(getErrorMessage(true), "true");
  assertEquals(getErrorMessage(false), "false");
});

Deno.test("getErrorMessage - from extended error", () => {
  const error = createError("Extended error message", "ERR_EXT");
  const message = getErrorMessage(error);

  assertEquals(message, "Extended error message");
});

Deno.test("getErrorMessage - from object with non-string message", () => {
  const obj = { message: 123 };
  const message = getErrorMessage(obj);

  assertEquals(message, "123");
});

// ============================================================================
// shouldRetry Tests
// ============================================================================

Deno.test("shouldRetry - returns false when max attempts reached", () => {
  const error = new Error("Test");

  assertEquals(shouldRetry(error, 3, 3), false);
  assertEquals(shouldRetry(error, 5, 3), false);
});

Deno.test("shouldRetry - ECONNRESET is retryable", () => {
  const error = createError("Connection reset", "ECONNRESET");

  assertEquals(shouldRetry(error, 1, 3), true);
});

Deno.test("shouldRetry - ETIMEDOUT is retryable", () => {
  const error = createError("Timeout", "ETIMEDOUT");

  assertEquals(shouldRetry(error, 1, 3), true);
});

Deno.test("shouldRetry - ECONNREFUSED is retryable", () => {
  const error = createError("Connection refused", "ECONNREFUSED");

  assertEquals(shouldRetry(error, 1, 3), true);
});

Deno.test("shouldRetry - ENETUNREACH is retryable", () => {
  const error = createError("Network unreachable", "ENETUNREACH");

  assertEquals(shouldRetry(error, 1, 3), true);
});

Deno.test("shouldRetry - EAI_AGAIN is retryable", () => {
  const error = createError("DNS temporary failure", "EAI_AGAIN");

  assertEquals(shouldRetry(error, 1, 3), true);
});

Deno.test("shouldRetry - HTTP 429 Too Many Requests is retryable", () => {
  const error = new Error("Rate limited") as ExtendedError;
  error.status = 429;

  assertEquals(shouldRetry(error, 1, 3), true);
});

Deno.test("shouldRetry - HTTP 503 Service Unavailable is retryable", () => {
  const error = new Error("Service unavailable") as ExtendedError;
  error.status = 503;

  assertEquals(shouldRetry(error, 1, 3), true);
});

Deno.test("shouldRetry - HTTP 504 Gateway Timeout is retryable", () => {
  const error = new Error("Gateway timeout") as ExtendedError;
  error.status = 504;

  assertEquals(shouldRetry(error, 1, 3), true);
});

Deno.test("shouldRetry - HTTP statusCode property is checked", () => {
  const error = new Error("Rate limited") as ExtendedError;
  error.statusCode = 429;

  assertEquals(shouldRetry(error, 1, 3), true);
});

Deno.test("shouldRetry - HTTP 400 Bad Request is not retryable", () => {
  const error = new Error("Bad request") as ExtendedError;
  error.status = 400;

  assertEquals(shouldRetry(error, 1, 3), false);
});

Deno.test("shouldRetry - HTTP 404 Not Found is not retryable", () => {
  const error = new Error("Not found") as ExtendedError;
  error.status = 404;

  assertEquals(shouldRetry(error, 1, 3), false);
});

Deno.test("shouldRetry - HTTP 500 Internal Server Error is not retryable", () => {
  const error = new Error("Internal error") as ExtendedError;
  error.status = 500;

  assertEquals(shouldRetry(error, 1, 3), false);
});

Deno.test("shouldRetry - unknown error code is not retryable", () => {
  const error = createError("Unknown error", "ERR_UNKNOWN");

  assertEquals(shouldRetry(error, 1, 3), false);
});

Deno.test("shouldRetry - generic error without code is not retryable", () => {
  const error = new Error("Generic error");

  assertEquals(shouldRetry(error, 1, 3), false);
});

Deno.test("shouldRetry - non-Error value is not retryable", () => {
  assertEquals(shouldRetry("string error", 1, 3), false);
  assertEquals(shouldRetry(null, 1, 3), false);
  assertEquals(shouldRetry(42, 1, 3), false);
});

// ============================================================================
// calculateRetryDelay Tests
// ============================================================================

Deno.test("calculateRetryDelay - exponential backoff base case", () => {
  // With jitter disabled, we can test exact values
  const delay = calculateRetryDelay(0, 1000, 30000, false);

  // 1000 * 2^0 = 1000
  assertEquals(delay, 1000);
});

Deno.test("calculateRetryDelay - exponential backoff increases", () => {
  const delay0 = calculateRetryDelay(0, 1000, 30000, false);
  const delay1 = calculateRetryDelay(1, 1000, 30000, false);
  const delay2 = calculateRetryDelay(2, 1000, 30000, false);
  const delay3 = calculateRetryDelay(3, 1000, 30000, false);

  assertEquals(delay0, 1000);  // 1000 * 2^0
  assertEquals(delay1, 2000);  // 1000 * 2^1
  assertEquals(delay2, 4000);  // 1000 * 2^2
  assertEquals(delay3, 8000);  // 1000 * 2^3
});

Deno.test("calculateRetryDelay - respects max delay", () => {
  // Very high attempt number should cap at maxDelay
  const delay = calculateRetryDelay(10, 1000, 30000, false);

  assertEquals(delay, 30000);
});

Deno.test("calculateRetryDelay - with custom base delay", () => {
  const delay = calculateRetryDelay(0, 500, 30000, false);

  assertEquals(delay, 500);
});

Deno.test("calculateRetryDelay - with custom max delay", () => {
  const delay = calculateRetryDelay(5, 1000, 10000, false);

  // 1000 * 2^5 = 32000, capped at 10000
  assertEquals(delay, 10000);
});

Deno.test("calculateRetryDelay - jitter adds randomness", () => {
  // With jitter enabled, delay should be between 50% and 100% of calculated value
  const delays: number[] = [];
  for (let i = 0; i < 10; i++) {
    delays.push(calculateRetryDelay(0, 1000, 30000, true));
  }

  // All delays should be between 500 and 1000 (50% to 100% of 1000)
  for (const delay of delays) {
    assert(delay >= 500, `Delay ${delay} should be >= 500`);
    assert(delay <= 1000, `Delay ${delay} should be <= 1000`);
  }
});

Deno.test("calculateRetryDelay - returns integer", () => {
  const delay = calculateRetryDelay(0, 1000, 30000, true);

  assertEquals(delay, Math.floor(delay));
});

Deno.test("calculateRetryDelay - default parameters", () => {
  // Using only required parameter
  const delay = calculateRetryDelay(0);

  // Should be between 500 and 1000 (default baseDelay=1000 with default jitter=true)
  assert(delay >= 500);
  assert(delay <= 1000);
});

// ============================================================================
// AggregateError Tests
// ============================================================================

Deno.test("AggregateError - stores multiple errors", () => {
  const errors = [
    new Error("Error 1"),
    new Error("Error 2"),
    new Error("Error 3"),
  ];
  const aggError = new AggregateError(errors);

  assertEquals(aggError.errors.length, 3);
  assertEquals(aggError.errors[0].message, "Error 1");
  assertEquals(aggError.errors[1].message, "Error 2");
  assertEquals(aggError.errors[2].message, "Error 3");
});

Deno.test("AggregateError - default message", () => {
  const errors = [new Error("E1"), new Error("E2")];
  const aggError = new AggregateError(errors);

  assertEquals(aggError.message, "2 errors occurred");
});

Deno.test("AggregateError - custom message", () => {
  const errors = [new Error("E1"), new Error("E2")];
  const aggError = new AggregateError(errors, "Custom aggregate message");

  assertEquals(aggError.message, "Custom aggregate message");
});

Deno.test("AggregateError - name property", () => {
  const aggError = new AggregateError([new Error("E1")]);

  assertEquals(aggError.name, "AggregateError");
});

Deno.test("AggregateError - is instanceof Error", () => {
  const aggError = new AggregateError([new Error("E1")]);

  assert(aggError instanceof Error);
  assert(aggError instanceof AggregateError);
});

Deno.test("AggregateError - empty errors array", () => {
  const aggError = new AggregateError([]);

  assertEquals(aggError.errors.length, 0);
  assertEquals(aggError.message, "0 errors occurred");
});

Deno.test("AggregateError - single error", () => {
  const aggError = new AggregateError([new Error("Single error")]);

  assertEquals(aggError.errors.length, 1);
  assertEquals(aggError.message, "1 errors occurred");
});

// ============================================================================
// createAggregateError Tests
// ============================================================================

Deno.test("createAggregateError - creates AggregateError", () => {
  const errors = [new Error("E1"), new Error("E2")];
  const aggError = createAggregateError(errors);

  assert(aggError instanceof AggregateError);
  assertEquals(aggError.errors.length, 2);
});

Deno.test("createAggregateError - with custom message", () => {
  const errors = [new Error("E1")];
  const aggError = createAggregateError(errors, "Custom message");

  assertEquals(aggError.message, "Custom message");
});

// ============================================================================
// assert Tests
// ============================================================================

Deno.test("assert - passes for truthy values", () => {
  // These should not throw
  assertUtil(true);
  assertUtil(1);
  assertUtil("string");
  assertUtil({});
  assertUtil([]);
});

Deno.test("assert - throws for false", () => {
  assertThrows(
    () => assertUtil(false),
    Error,
    "Assertion failed"
  );
});

Deno.test("assert - throws for falsy values", () => {
  assertThrows(() => assertUtil(0), Error);
  assertThrows(() => assertUtil(""), Error);
  assertThrows(() => assertUtil(null), Error);
  assertThrows(() => assertUtil(undefined), Error);
});

Deno.test("assert - custom error message", () => {
  assertThrows(
    () => assertUtil(false, "Custom assertion message"),
    Error,
    "Custom assertion message"
  );
});

Deno.test("assert - default error message", () => {
  assertThrows(
    () => assertUtil(false),
    Error,
    "Assertion failed"
  );
});

// ============================================================================
// assertNotNull Tests
// ============================================================================

Deno.test("assertNotNull - passes for non-null values", () => {
  // These should not throw
  assertNotNull("string");
  assertNotNull(0);
  assertNotNull(false);
  assertNotNull({});
  assertNotNull([]);
});

Deno.test("assertNotNull - throws for null", () => {
  assertThrows(
    () => assertNotNull(null),
    Error,
    "Value is null or undefined"
  );
});

Deno.test("assertNotNull - throws for undefined", () => {
  assertThrows(
    () => assertNotNull(undefined),
    Error,
    "Value is null or undefined"
  );
});

Deno.test("assertNotNull - custom error message", () => {
  assertThrows(
    () => assertNotNull(null, "Custom null message"),
    Error,
    "Custom null message"
  );
});

// ============================================================================
// tryCatch Tests
// ============================================================================

Deno.test("tryCatch - returns success for successful function", () => {
  const result = tryCatch(() => 42);

  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.value, 42);
  }
});

Deno.test("tryCatch - returns error for throwing function", () => {
  const result = tryCatch(() => {
    throw new Error("Test error");
  });

  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.error.message, "Test error");
  }
});

Deno.test("tryCatch - converts non-Error throws to Error", () => {
  const result = tryCatch(() => {
    throw "string error";
  });

  assertEquals(result.success, false);
  if (!result.success) {
    assert(result.error instanceof Error);
    assertEquals(result.error.message, "string error");
  }
});

Deno.test("tryCatch - preserves Error instance", () => {
  const originalError = new Error("Original");
  const result = tryCatch(() => {
    throw originalError;
  });

  if (!result.success) {
    assertEquals(result.error, originalError);
  }
});

Deno.test("tryCatch - works with complex return values", () => {
  const result = tryCatch(() => ({ nested: { value: [1, 2, 3] } }));

  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.value.nested.value, [1, 2, 3]);
  }
});

// ============================================================================
// tryAsync Tests
// ============================================================================

Deno.test("tryAsync - returns success for successful async function", async () => {
  const result = await tryAsync(async () => {
    await Promise.resolve();
    return 42;
  });

  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.value, 42);
  }
});

Deno.test("tryAsync - returns error for rejected promise", async () => {
  const result = await tryAsync(async () => {
    throw new Error("Async error");
  });

  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.error.message, "Async error");
  }
});

Deno.test("tryAsync - converts non-Error rejections to Error", async () => {
  const result = await tryAsync(async () => {
    throw "string rejection";
  });

  assertEquals(result.success, false);
  if (!result.success) {
    assert(result.error instanceof Error);
    assertEquals(result.error.message, "string rejection");
  }
});

Deno.test("tryAsync - preserves Error instance", async () => {
  const originalError = new Error("Original async");
  const result = await tryAsync(async () => {
    throw originalError;
  });

  if (!result.success) {
    assertEquals(result.error, originalError);
  }
});

Deno.test("tryAsync - works with delayed async operations", async () => {
  const result = await tryAsync(async () => {
    return new Promise<string>((resolve) => {
      setTimeout(() => resolve("delayed"), 10);
    });
  });

  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.value, "delayed");
  }
});

Deno.test("tryAsync - handles Promise.reject", async () => {
  const result = await tryAsync(() => Promise.reject(new Error("Rejected")));

  assertEquals(result.success, false);
  if (!result.success) {
    assertEquals(result.error.message, "Rejected");
  }
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test("Integration - createError with wrapError and formatError", () => {
  const original = createError("Database connection failed", "ERR_DB", { host: "localhost" });
  const wrapped = wrapError(original, "Service initialization failed");
  const formatted = formatError(wrapped);

  assert(formatted.includes("Service initialization failed"));
  assert(formatted.includes("Database connection failed"));
});

Deno.test("Integration - retry logic with shouldRetry and calculateRetryDelay", () => {
  const error = createError("Connection reset", "ECONNRESET");
  let attempt = 0;
  const maxAttempts = 3;
  const delays: number[] = [];

  while (shouldRetry(error, attempt, maxAttempts)) {
    delays.push(calculateRetryDelay(attempt, 100, 1000, false));
    attempt++;
  }

  assertEquals(attempt, 3);
  assertEquals(delays.length, 3);
  assertEquals(delays[0], 100);
  assertEquals(delays[1], 200);
  assertEquals(delays[2], 400);
});

Deno.test("Integration - aggregate errors from multiple operations", () => {
  const results = [
    tryCatch(() => { throw new Error("Op 1 failed"); }),
    tryCatch(() => 42),
    tryCatch(() => { throw new Error("Op 3 failed"); }),
    tryCatch(() => "success"),
  ];

  const errors = results
    .filter((r): r is { success: false; error: Error } => !r.success)
    .map((r) => r.error);

  assertEquals(errors.length, 2);

  if (errors.length > 0) {
    const aggregate = createAggregateError(errors, "Multiple operations failed");
    assertEquals(aggregate.errors.length, 2);
    assertEquals(aggregate.message, "Multiple operations failed");
  }
});

Deno.test("Integration - error chain with multiple wrap levels", () => {
  const dbError = createError("Query failed", "ERR_QUERY", { sql: "SELECT *" });
  const repoError = wrapError(dbError, "Repository operation failed");
  const serviceError = wrapError(repoError, "Service request failed");
  const apiError = wrapError(serviceError, "API call failed");

  // Full message chain
  assert(apiError.message.includes("API call failed"));
  assert(apiError.message.includes("Service request failed"));
  assert(apiError.message.includes("Repository operation failed"));
  assert(apiError.message.includes("Query failed"));

  // Can traverse cause chain
  assertEquals(apiError.cause, serviceError);
  assertEquals((apiError.cause as ExtendedError).cause, repoError);
});
