/**
 * Tests for Domain-Specific Assertions
 * Verify custom assertion helpers provide helpful error messages
 */

import { assertEquals, assertThrows } from "@std/assert";
import { AssertionError } from "@std/assert/assertion-error";
import {
  assertASTEquals,
  assertMetricsRecorded,
  assertNoResourceLeaks,
  assertResponseHeaders,
  assertStatusCode,
} from "./assertions.ts";

Deno.test("assertASTEquals - matches identical AST", () => {
  const ast = {
    type: "SelectStatement",
    columns: ["*"],
    from: "users",
  };

  assertASTEquals(ast, {
    type: "SelectStatement",
    columns: ["*"],
    from: "users",
  });
});

Deno.test("assertASTEquals - throws on mismatch with helpful diff", () => {
  const ast = {
    type: "SelectStatement",
    columns: ["id", "name"],
    from: "users",
  };

  assertThrows(
    () => {
      assertASTEquals(ast, {
        type: "SelectStatement",
        columns: ["*"],
        from: "users",
      });
    },
    AssertionError,
    "AST Mismatch"
  );
});

Deno.test("assertASTEquals - includes custom message", () => {
  const ast = { type: "Invalid" };

  assertThrows(
    () => {
      assertASTEquals(ast, { type: "Valid" }, "Parser output incorrect");
    },
    AssertionError,
    "Parser output incorrect"
  );
});

Deno.test("assertMetricsRecorded - passes when all keys present", () => {
  const metrics = {
    requests_total: 5,
    errors_total: 1,
    latency_ms: 250,
  };

  assertMetricsRecorded(metrics, ["requests_total", "errors_total"]);
});

Deno.test("assertMetricsRecorded - throws on missing keys with helpful message", () => {
  const metrics = {
    requests_total: 5,
  };

  assertThrows(
    () => {
      assertMetricsRecorded(metrics, ["requests_total", "errors_total", "latency_ms"]);
    },
    AssertionError,
    "Missing metrics: errors_total, latency_ms"
  );
});

Deno.test("assertMetricsRecorded - shows available keys in error", () => {
  const metrics = {
    foo: 1,
    bar: 2,
  };

  const error = assertThrows(
    () => {
      assertMetricsRecorded(metrics, ["baz"]);
    },
    AssertionError
  );

  assertEquals(error.message.includes("Available: foo, bar"), true);
});

Deno.test("assertNoResourceLeaks - passes when no leaks", () => {
  const pool = {
    activeConnections: 0,
    pendingRequests: 0,
    openFiles: 0,
  };

  assertNoResourceLeaks(pool);
});

Deno.test("assertNoResourceLeaks - throws on any leak with details", () => {
  const pool = {
    activeConnections: 2,
    pendingRequests: 1,
    openFiles: 0,
  };

  const error = assertThrows(
    () => {
      assertNoResourceLeaks(pool);
    },
    AssertionError,
    "Resource leaks detected"
  );

  assertEquals(error.message.includes("activeConnections: 2"), true);
  assertEquals(error.message.includes("pendingRequests: 1"), true);
});

Deno.test("assertNoResourceLeaks - includes custom message", () => {
  const pool = {
    timers: 5,
  };

  assertThrows(
    () => {
      assertNoResourceLeaks(pool, "Test cleanup failed");
    },
    AssertionError,
    "Test cleanup failed"
  );
});

Deno.test("assertResponseHeaders - passes when headers match", () => {
  const response = new Response("OK", {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-cache",
    },
  });

  assertResponseHeaders(response, {
    "content-type": "application/json",
    "cache-control": "no-cache",
  });
});

Deno.test("assertResponseHeaders - case insensitive header matching", () => {
  const response = new Response("OK", {
    headers: {
      "Content-Type": "application/json",
    },
  });

  assertResponseHeaders(response, {
    "content-type": "application/json",
  });
});

Deno.test("assertResponseHeaders - throws on mismatch with details", () => {
  const response = new Response("OK", {
    headers: {
      "content-type": "text/html",
    },
  });

  const error = assertThrows(
    () => {
      assertResponseHeaders(response, {
        "content-type": "application/json",
      });
    },
    AssertionError,
    "Header mismatches"
  );

  assertEquals(error.message.includes('expected "application/json"'), true);
  assertEquals(error.message.includes('got "text/html"'), true);
});

Deno.test("assertResponseHeaders - shows all actual headers in error", () => {
  const response = new Response("OK", {
    headers: {
      "content-type": "text/html",
      "x-custom": "value",
    },
  });

  const error = assertThrows(
    () => {
      assertResponseHeaders(response, {
        "content-type": "application/json",
      });
    },
    AssertionError
  );

  assertEquals(error.message.includes("Actual headers:"), true);
  assertEquals(error.message.includes("x-custom: value"), true);
});

Deno.test("assertStatusCode - passes when status matches", () => {
  const response = new Response("OK", { status: 200 });

  assertStatusCode(response, 200);
});

Deno.test("assertStatusCode - throws on mismatch with helpful message", () => {
  const response = new Response("Not Found", { status: 404 });

  const error = assertThrows(
    () => {
      assertStatusCode(response, 200);
    },
    AssertionError,
    "Status code mismatch"
  );

  assertEquals(error.message.includes("Expected: 200 OK"), true);
  assertEquals(error.message.includes("Got: 404 Not Found"), true);
});

Deno.test("assertStatusCode - includes URL in error", () => {
  // Create response with URL by using fetch or creating a mocked response with url property
  const response = new Response("Error", { status: 500 });
  // Mock the url property
  Object.defineProperty(response, "url", {
    value: "http://example.com/api",
    writable: false,
  });

  const error = assertThrows(
    () => {
      assertStatusCode(response, 200);
    },
    AssertionError
  );

  assertEquals(error.message.includes("http://example.com/api"), true);
});

Deno.test("assertStatusCode - includes custom message", () => {
  const response = new Response("Error", { status: 500 });

  assertThrows(
    () => {
      assertStatusCode(response, 200, "API call failed");
    },
    AssertionError,
    "API call failed"
  );
});
