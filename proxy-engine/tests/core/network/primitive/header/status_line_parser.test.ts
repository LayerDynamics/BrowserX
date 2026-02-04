/**
 * StatusLineParser Tests
 * Comprehensive tests for StatusLineParser
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import {
  StatusLineParser,
  type StatusLine,
} from "../../../../../core/network/primitive/header/status_line_parser.ts";
import type { HTTPVersion } from "../../../../../core/network/primitive/header/request_line_parser.ts";

// ============================================================================
// parse Tests
// ============================================================================

Deno.test({
  name: "StatusLineParser - parse handles basic 200 OK response",
  fn() {
    const result = StatusLineParser.parse("HTTP/1.1 200 OK");

    assertEquals(result.version, "1.1");
    assertEquals(result.statusCode, 200);
    assertEquals(result.statusText, "OK");
  },
});

Deno.test({
  name: "StatusLineParser - parse handles all HTTP versions",
  fn() {
    const versions: HTTPVersion[] = ["1.0", "1.1", "2.0", "3.0"];

    for (const version of versions) {
      const result = StatusLineParser.parse(`HTTP/${version} 200 OK`);
      assertEquals(result.version, version);
    }
  },
});

Deno.test({
  name: "StatusLineParser - parse handles informational status codes",
  fn() {
    const codes = [100, 101, 102, 103];

    for (const code of codes) {
      const result = StatusLineParser.parse(
        `HTTP/1.1 ${code} ${StatusLineParser.getDefaultStatusText(code)}`
      );
      assertEquals(result.statusCode, code);
      assert(StatusLineParser.isInformational(result.statusCode));
    }
  },
});

Deno.test({
  name: "StatusLineParser - parse handles success status codes",
  fn() {
    const codes = [200, 201, 202, 204, 206];

    for (const code of codes) {
      const result = StatusLineParser.parse(
        `HTTP/1.1 ${code} ${StatusLineParser.getDefaultStatusText(code)}`
      );
      assertEquals(result.statusCode, code);
      assert(StatusLineParser.isSuccess(result.statusCode));
    }
  },
});

Deno.test({
  name: "StatusLineParser - parse handles redirection status codes",
  fn() {
    const codes = [301, 302, 303, 304, 307, 308];

    for (const code of codes) {
      const result = StatusLineParser.parse(
        `HTTP/1.1 ${code} ${StatusLineParser.getDefaultStatusText(code)}`
      );
      assertEquals(result.statusCode, code);
      assert(StatusLineParser.isRedirection(result.statusCode));
    }
  },
});

Deno.test({
  name: "StatusLineParser - parse handles client error status codes",
  fn() {
    const codes = [400, 401, 403, 404, 405, 429];

    for (const code of codes) {
      const result = StatusLineParser.parse(
        `HTTP/1.1 ${code} ${StatusLineParser.getDefaultStatusText(code)}`
      );
      assertEquals(result.statusCode, code);
      assert(StatusLineParser.isClientError(result.statusCode));
    }
  },
});

Deno.test({
  name: "StatusLineParser - parse handles server error status codes",
  fn() {
    const codes = [500, 501, 502, 503, 504];

    for (const code of codes) {
      const result = StatusLineParser.parse(
        `HTTP/1.1 ${code} ${StatusLineParser.getDefaultStatusText(code)}`
      );
      assertEquals(result.statusCode, code);
      assert(StatusLineParser.isServerError(result.statusCode));
    }
  },
});

Deno.test({
  name: "StatusLineParser - parse handles status text with spaces",
  fn() {
    const result = StatusLineParser.parse(
      "HTTP/1.1 500 Internal Server Error"
    );

    assertEquals(result.statusCode, 500);
    assertEquals(result.statusText, "Internal Server Error");
  },
});

Deno.test({
  name: "StatusLineParser - parse handles missing status text",
  fn() {
    const result = StatusLineParser.parse("HTTP/1.1 200");

    assertEquals(result.statusCode, 200);
    assertEquals(result.statusText, "OK");
  },
});

Deno.test({
  name: "StatusLineParser - parse handles custom status text",
  fn() {
    const result = StatusLineParser.parse("HTTP/1.1 200 Custom Success Message");

    assertEquals(result.statusCode, 200);
    assertEquals(result.statusText, "Custom Success Message");
  },
});

Deno.test({
  name: "StatusLineParser - parse trims whitespace",
  fn() {
    const result = StatusLineParser.parse("  HTTP/1.1 200 OK  ");

    assertEquals(result.version, "1.1");
    assertEquals(result.statusCode, 200);
    assertEquals(result.statusText, "OK");
  },
});

Deno.test({
  name: "StatusLineParser - parse throws on empty string",
  fn() {
    assertThrows(
      () => StatusLineParser.parse(""),
      Error,
      "Empty status line"
    );
  },
});

Deno.test({
  name: "StatusLineParser - parse throws on whitespace only",
  fn() {
    assertThrows(
      () => StatusLineParser.parse("   "),
      Error,
      "Empty status line"
    );
  },
});

Deno.test({
  name: "StatusLineParser - parse throws on invalid format",
  fn() {
    assertThrows(
      () => StatusLineParser.parse("InvalidFormat"),
      Error,
      "Invalid status line format"
    );
  },
});

Deno.test({
  name: "StatusLineParser - parse throws on invalid version format",
  fn() {
    assertThrows(
      () => StatusLineParser.parse("HTTP1.1 200 OK"),
      Error,
      "Invalid HTTP version format"
    );
  },
});

Deno.test({
  name: "StatusLineParser - parse throws on unsupported version",
  fn() {
    assertThrows(
      () => StatusLineParser.parse("HTTP/0.9 200 OK"),
      Error,
      "Unsupported HTTP version"
    );
  },
});

Deno.test({
  name: "StatusLineParser - parse throws on invalid status code (non-numeric)",
  fn() {
    assertThrows(
      () => StatusLineParser.parse("HTTP/1.1 ABC OK"),
      Error,
      "Invalid status code"
    );
  },
});

Deno.test({
  name: "StatusLineParser - parse throws on status code below 100",
  fn() {
    assertThrows(
      () => StatusLineParser.parse("HTTP/1.1 99 Too Low"),
      Error,
      "Invalid status code"
    );
  },
});

Deno.test({
  name: "StatusLineParser - parse throws on status code above 599",
  fn() {
    assertThrows(
      () => StatusLineParser.parse("HTTP/1.1 600 Too High"),
      Error,
      "Invalid status code"
    );
  },
});

Deno.test({
  name: "StatusLineParser - parse handles case insensitive HTTP",
  fn() {
    const result = StatusLineParser.parse("http/1.1 200 OK");
    assertEquals(result.version, "1.1");
  },
});

// ============================================================================
// serialize Tests
// ============================================================================

Deno.test({
  name: "StatusLineParser - serialize creates valid status line",
  fn() {
    const statusLine: StatusLine = {
      version: "1.1",
      statusCode: 200,
      statusText: "OK",
    };

    const result = StatusLineParser.serialize(statusLine);
    assertEquals(result, "HTTP/1.1 200 OK");
  },
});

Deno.test({
  name: "StatusLineParser - serialize handles all versions",
  fn() {
    const versions: HTTPVersion[] = ["1.0", "1.1", "2.0", "3.0"];

    for (const version of versions) {
      const statusLine: StatusLine = {
        version,
        statusCode: 200,
        statusText: "OK",
      };

      const result = StatusLineParser.serialize(statusLine);
      assert(result.startsWith(`HTTP/${version}`));
    }
  },
});

Deno.test({
  name: "StatusLineParser - serialize handles multi-word status text",
  fn() {
    const statusLine: StatusLine = {
      version: "1.1",
      statusCode: 500,
      statusText: "Internal Server Error",
    };

    const result = StatusLineParser.serialize(statusLine);
    assertEquals(result, "HTTP/1.1 500 Internal Server Error");
  },
});

// ============================================================================
// serializeToBytes Tests
// ============================================================================

Deno.test({
  name: "StatusLineParser - serializeToBytes returns Uint8Array",
  fn() {
    const statusLine: StatusLine = {
      version: "1.1",
      statusCode: 200,
      statusText: "OK",
    };

    const result = StatusLineParser.serializeToBytes(statusLine);
    assertExists(result);
    assert(result instanceof Uint8Array);
  },
});

Deno.test({
  name: "StatusLineParser - serializeToBytes produces valid bytes",
  fn() {
    const statusLine: StatusLine = {
      version: "1.1",
      statusCode: 404,
      statusText: "Not Found",
    };

    const bytes = StatusLineParser.serializeToBytes(statusLine);
    const decoded = new TextDecoder().decode(bytes);

    assertEquals(decoded, "HTTP/1.1 404 Not Found");
  },
});

// ============================================================================
// Round-trip Tests
// ============================================================================

Deno.test({
  name: "StatusLineParser - parse then serialize is identity",
  fn() {
    const original = "HTTP/1.1 301 Moved Permanently";
    const parsed = StatusLineParser.parse(original);
    const serialized = StatusLineParser.serialize(parsed);

    assertEquals(serialized, original);
  },
});

Deno.test({
  name: "StatusLineParser - serialize then parse is identity",
  fn() {
    const original: StatusLine = {
      version: "2.0",
      statusCode: 403,
      statusText: "Forbidden",
    };

    const serialized = StatusLineParser.serialize(original);
    const parsed = StatusLineParser.parse(serialized);

    assertEquals(parsed.version, original.version);
    assertEquals(parsed.statusCode, original.statusCode);
    assertEquals(parsed.statusText, original.statusText);
  },
});

// ============================================================================
// getDefaultStatusText Tests
// ============================================================================

Deno.test({
  name: "StatusLineParser - getDefaultStatusText returns correct text for common codes",
  fn() {
    assertEquals(StatusLineParser.getDefaultStatusText(100), "Continue");
    assertEquals(StatusLineParser.getDefaultStatusText(200), "OK");
    assertEquals(StatusLineParser.getDefaultStatusText(201), "Created");
    assertEquals(StatusLineParser.getDefaultStatusText(204), "No Content");
    assertEquals(StatusLineParser.getDefaultStatusText(301), "Moved Permanently");
    assertEquals(StatusLineParser.getDefaultStatusText(302), "Found");
    assertEquals(StatusLineParser.getDefaultStatusText(304), "Not Modified");
    assertEquals(StatusLineParser.getDefaultStatusText(400), "Bad Request");
    assertEquals(StatusLineParser.getDefaultStatusText(401), "Unauthorized");
    assertEquals(StatusLineParser.getDefaultStatusText(403), "Forbidden");
    assertEquals(StatusLineParser.getDefaultStatusText(404), "Not Found");
    assertEquals(StatusLineParser.getDefaultStatusText(500), "Internal Server Error");
    assertEquals(StatusLineParser.getDefaultStatusText(502), "Bad Gateway");
    assertEquals(StatusLineParser.getDefaultStatusText(503), "Service Unavailable");
  },
});

Deno.test({
  name: "StatusLineParser - getDefaultStatusText returns Unknown for unknown codes",
  fn() {
    assertEquals(StatusLineParser.getDefaultStatusText(599), "Unknown");
    assertEquals(StatusLineParser.getDefaultStatusText(199), "Unknown");
  },
});

Deno.test({
  name: "StatusLineParser - getDefaultStatusText handles teapot",
  fn() {
    assertEquals(StatusLineParser.getDefaultStatusText(418), "I'm a teapot");
  },
});

// ============================================================================
// Status Code Classification Tests
// ============================================================================

Deno.test({
  name: "StatusLineParser - isInformational correctly classifies 1xx codes",
  fn() {
    assert(StatusLineParser.isInformational(100));
    assert(StatusLineParser.isInformational(101));
    assert(StatusLineParser.isInformational(199));
    assert(!StatusLineParser.isInformational(200));
    assert(!StatusLineParser.isInformational(99));
  },
});

Deno.test({
  name: "StatusLineParser - isSuccess correctly classifies 2xx codes",
  fn() {
    assert(StatusLineParser.isSuccess(200));
    assert(StatusLineParser.isSuccess(201));
    assert(StatusLineParser.isSuccess(299));
    assert(!StatusLineParser.isSuccess(199));
    assert(!StatusLineParser.isSuccess(300));
  },
});

Deno.test({
  name: "StatusLineParser - isRedirection correctly classifies 3xx codes",
  fn() {
    assert(StatusLineParser.isRedirection(300));
    assert(StatusLineParser.isRedirection(301));
    assert(StatusLineParser.isRedirection(399));
    assert(!StatusLineParser.isRedirection(299));
    assert(!StatusLineParser.isRedirection(400));
  },
});

Deno.test({
  name: "StatusLineParser - isClientError correctly classifies 4xx codes",
  fn() {
    assert(StatusLineParser.isClientError(400));
    assert(StatusLineParser.isClientError(404));
    assert(StatusLineParser.isClientError(499));
    assert(!StatusLineParser.isClientError(399));
    assert(!StatusLineParser.isClientError(500));
  },
});

Deno.test({
  name: "StatusLineParser - isServerError correctly classifies 5xx codes",
  fn() {
    assert(StatusLineParser.isServerError(500));
    assert(StatusLineParser.isServerError(503));
    assert(StatusLineParser.isServerError(599));
    assert(!StatusLineParser.isServerError(499));
  },
});

Deno.test({
  name: "StatusLineParser - isError correctly classifies 4xx and 5xx codes",
  fn() {
    assert(StatusLineParser.isError(400));
    assert(StatusLineParser.isError(404));
    assert(StatusLineParser.isError(500));
    assert(StatusLineParser.isError(503));
    assert(!StatusLineParser.isError(200));
    assert(!StatusLineParser.isError(301));
    assert(!StatusLineParser.isError(399));
  },
});

// ============================================================================
// canHaveBody Tests
// ============================================================================

Deno.test({
  name: "StatusLineParser - canHaveBody returns false for 1xx codes",
  fn() {
    assert(!StatusLineParser.canHaveBody(100));
    assert(!StatusLineParser.canHaveBody(101));
  },
});

Deno.test({
  name: "StatusLineParser - canHaveBody returns false for 204",
  fn() {
    assert(!StatusLineParser.canHaveBody(204));
  },
});

Deno.test({
  name: "StatusLineParser - canHaveBody returns false for 304",
  fn() {
    assert(!StatusLineParser.canHaveBody(304));
  },
});

Deno.test({
  name: "StatusLineParser - canHaveBody returns true for 200",
  fn() {
    assert(StatusLineParser.canHaveBody(200));
  },
});

Deno.test({
  name: "StatusLineParser - canHaveBody returns true for 404",
  fn() {
    assert(StatusLineParser.canHaveBody(404));
  },
});

Deno.test({
  name: "StatusLineParser - canHaveBody returns true for 500",
  fn() {
    assert(StatusLineParser.canHaveBody(500));
  },
});

Deno.test({
  name: "StatusLineParser - canHaveBody returns true for 301",
  fn() {
    assert(StatusLineParser.canHaveBody(301));
  },
});

// ============================================================================
// create Tests
// ============================================================================

Deno.test({
  name: "StatusLineParser - create creates status line with default version",
  fn() {
    const result = StatusLineParser.create(200);

    assertEquals(result.version, "1.1");
    assertEquals(result.statusCode, 200);
    assertEquals(result.statusText, "OK");
  },
});

Deno.test({
  name: "StatusLineParser - create creates status line with specified version",
  fn() {
    const result = StatusLineParser.create(404, "2.0");

    assertEquals(result.version, "2.0");
    assertEquals(result.statusCode, 404);
    assertEquals(result.statusText, "Not Found");
  },
});

Deno.test({
  name: "StatusLineParser - create uses default status text",
  fn() {
    const result = StatusLineParser.create(500);

    assertEquals(result.statusText, "Internal Server Error");
  },
});

Deno.test({
  name: "StatusLineParser - create handles unknown status codes",
  fn() {
    const result = StatusLineParser.create(599);

    assertEquals(result.statusCode, 599);
    assertEquals(result.statusText, "Unknown");
  },
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test({
  name: "StatusLineParser - handles all standard status codes",
  fn() {
    const standardCodes = [
      100, 101, 102, 103, // 1xx
      200, 201, 202, 203, 204, 205, 206, 207, 208, 226, // 2xx
      300, 301, 302, 303, 304, 305, 307, 308, // 3xx
      400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414,
      415, 416, 417, 418, 421, 422, 423, 424, 425, 426, 428, 429, 431, 451, // 4xx
      500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511, // 5xx
    ];

    for (const code of standardCodes) {
      const statusLine = StatusLineParser.create(code);
      assertExists(statusLine.statusText);
      assert(statusLine.statusText !== "Unknown", `Code ${code} should have known status text`);
    }
  },
});

Deno.test({
  name: "StatusLineParser - handles boundary status codes",
  fn() {
    // Minimum valid
    const min = StatusLineParser.parse("HTTP/1.1 100 Continue");
    assertEquals(min.statusCode, 100);

    // Maximum valid
    const max = StatusLineParser.parse("HTTP/1.1 599 Unknown");
    assertEquals(max.statusCode, 599);
  },
});
