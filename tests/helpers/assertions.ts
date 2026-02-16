/**
 * Domain-Specific Test Assertions
 * Custom assertion helpers for clearer test failures
 */

import { AssertionError } from "@std/assert/assertion-error";

/**
 * Deep compare AST nodes with helpful diff output
 *
 * @example
 * const ast = parser.parse("SELECT * FROM users");
 * assertASTEquals(ast, {
 *   type: "SelectStatement",
 *   columns: ["*"],
 *   from: "users"
 * });
 */
export function assertASTEquals(
  actual: unknown,
  expected: unknown,
  message?: string
): void {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);

  if (actualStr !== expectedStr) {
    const diff = generateDiff(actualStr, expectedStr);
    const msg = message
      ? `${message}\n\nAST Mismatch:\n${diff}`
      : `AST Mismatch:\n${diff}`;
    throw new AssertionError(msg);
  }
}

/**
 * Verify metrics object has specific keys recorded
 *
 * @example
 * const metrics = { requests_total: 5, errors_total: 1 };
 * assertMetricsRecorded(metrics, ["requests_total", "errors_total"]);
 */
export function assertMetricsRecorded(
  metrics: Record<string, unknown>,
  keys: string[],
  message?: string
): void {
  const missingKeys: string[] = [];
  const foundKeys: string[] = [];

  for (const key of keys) {
    if (!(key in metrics)) {
      missingKeys.push(key);
    } else {
      foundKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    const availableKeys = Object.keys(metrics).join(", ");
    const msg = message
      ? `${message}\n\nMissing metrics: ${missingKeys.join(", ")}\nExpected: ${keys.join(", ")}\nFound: ${foundKeys.join(", ")}\nAvailable: ${availableKeys}`
      : `Missing metrics: ${missingKeys.join(", ")}\nExpected: ${keys.join(", ")}\nFound: ${foundKeys.join(", ")}\nAvailable: ${availableKeys}`;
    throw new AssertionError(msg);
  }
}

/**
 * Check connection/resource pool has no leaks
 *
 * @example
 * const pool = { activeConnections: 0, pendingRequests: 0 };
 * assertNoResourceLeaks(pool);
 */
export function assertNoResourceLeaks(
  pool: {
    activeConnections?: number;
    pendingRequests?: number;
    openFiles?: number;
    timers?: number;
    [key: string]: number | undefined;
  },
  message?: string
): void {
  const leaks: string[] = [];

  for (const [key, value] of Object.entries(pool)) {
    if (typeof value === "number" && value > 0) {
      leaks.push(`${key}: ${value}`);
    }
  }

  if (leaks.length > 0) {
    const msg = message
      ? `${message}\n\nResource leaks detected:\n  ${leaks.join("\n  ")}`
      : `Resource leaks detected:\n  ${leaks.join("\n  ")}`;
    throw new AssertionError(msg);
  }
}

/**
 * Compare HTTP response headers
 *
 * @example
 * const response = await fetch("http://example.com");
 * assertResponseHeaders(response, {
 *   "content-type": "application/json",
 *   "cache-control": "no-cache"
 * });
 */
export function assertResponseHeaders(
  response: Response,
  expected: Record<string, string>,
  message?: string
): void {
  const mismatches: string[] = [];
  const actual: Record<string, string> = {};

  // Collect all headers from response
  response.headers.forEach((value, key) => {
    actual[key.toLowerCase()] = value;
  });

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key.toLowerCase()];
    if (actualValue !== expectedValue) {
      mismatches.push(
        `  ${key}: expected "${expectedValue}", got "${actualValue || "undefined"}"`
      );
    }
  }

  if (mismatches.length > 0) {
    const allHeaders = Object.entries(actual)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n");
    const msg = message
      ? `${message}\n\nHeader mismatches:\n${mismatches.join("\n")}\n\nActual headers:\n${allHeaders}`
      : `Header mismatches:\n${mismatches.join("\n")}\n\nActual headers:\n${allHeaders}`;
    throw new AssertionError(msg);
  }
}

/**
 * Check HTTP status with helpful message
 *
 * @example
 * const response = await fetch("http://example.com");
 * assertStatusCode(response, 200);
 */
export function assertStatusCode(
  response: Response,
  expected: number,
  message?: string
): void {
  if (response.status !== expected) {
    const statusText = response.statusText || getStatusText(response.status);
    const expectedText = getStatusText(expected);
    const msg = message
      ? `${message}\n\nStatus code mismatch:\n  Expected: ${expected} ${expectedText}\n  Got: ${response.status} ${statusText}\n  URL: ${response.url}`
      : `Status code mismatch:\n  Expected: ${expected} ${expectedText}\n  Got: ${response.status} ${statusText}\n  URL: ${response.url}`;
    throw new AssertionError(msg);
  }
}

// Helper: Generate diff between two strings
function generateDiff(actual: string, expected: string): string {
  const actualLines = actual.split("\n");
  const expectedLines = expected.split("\n");
  const maxLines = Math.max(actualLines.length, expectedLines.length);
  const diff: string[] = [];

  diff.push("Expected:");
  diff.push(expected);
  diff.push("\nActual:");
  diff.push(actual);
  diff.push("\nLine-by-line diff:");

  for (let i = 0; i < maxLines; i++) {
    const actualLine = actualLines[i] || "";
    const expectedLine = expectedLines[i] || "";

    if (actualLine !== expectedLine) {
      diff.push(`  Line ${i + 1}:`);
      diff.push(`    - ${expectedLine}`);
      diff.push(`    + ${actualLine}`);
    }
  }

  return diff.join("\n");
}

// Helper: Get HTTP status text
function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    200: "OK",
    201: "Created",
    204: "No Content",
    301: "Moved Permanently",
    302: "Found",
    304: "Not Modified",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };

  return statusTexts[status] || "Unknown";
}
