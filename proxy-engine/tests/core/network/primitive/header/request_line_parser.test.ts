/**
 * RequestLineParser Tests
 * Comprehensive tests for RequestLineParser
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import {
  RequestLineParser,
  type HTTPMethod,
  type HTTPVersion,
  type RequestLine,
} from "../../../../../core/network/primitive/header/request_line_parser.ts";

// ============================================================================
// parse Tests
// ============================================================================

Deno.test({
  name: "RequestLineParser - parse handles basic GET request",
  fn() {
    const result = RequestLineParser.parse("GET /index.html HTTP/1.1");

    assertEquals(result.method, "GET");
    assertEquals(result.uri, "/index.html");
    assertEquals(result.version, "1.1");
  },
});

Deno.test({
  name: "RequestLineParser - parse handles all HTTP methods",
  fn() {
    const methods: HTTPMethod[] = [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
      "CONNECT",
      "TRACE",
    ];

    for (const method of methods) {
      const result = RequestLineParser.parse(`${method} / HTTP/1.1`);
      assertEquals(result.method, method);
    }
  },
});

Deno.test({
  name: "RequestLineParser - parse handles lowercase methods",
  fn() {
    const result = RequestLineParser.parse("get /path HTTP/1.1");
    assertEquals(result.method, "GET");
  },
});

Deno.test({
  name: "RequestLineParser - parse handles mixed case methods",
  fn() {
    const result = RequestLineParser.parse("pOsT /api/data HTTP/1.1");
    assertEquals(result.method, "POST");
  },
});

Deno.test({
  name: "RequestLineParser - parse handles all HTTP versions",
  fn() {
    const versions: HTTPVersion[] = ["1.0", "1.1", "2.0", "3.0"];

    for (const version of versions) {
      const result = RequestLineParser.parse(`GET / HTTP/${version}`);
      assertEquals(result.version, version);
    }
  },
});

Deno.test({
  name: "RequestLineParser - parse handles complex URIs",
  fn() {
    const result = RequestLineParser.parse(
      "GET /api/users?id=123&name=test#section HTTP/1.1"
    );
    assertEquals(result.uri, "/api/users?id=123&name=test#section");
  },
});

Deno.test({
  name: "RequestLineParser - parse handles URI with encoded characters",
  fn() {
    const result = RequestLineParser.parse(
      "GET /path%20with%20spaces HTTP/1.1"
    );
    assertEquals(result.uri, "/path%20with%20spaces");
  },
});

Deno.test({
  name: "RequestLineParser - parse handles root URI",
  fn() {
    const result = RequestLineParser.parse("GET / HTTP/1.1");
    assertEquals(result.uri, "/");
  },
});

Deno.test({
  name: "RequestLineParser - parse handles absolute URI",
  fn() {
    const result = RequestLineParser.parse(
      "GET http://example.com/path HTTP/1.1"
    );
    assertEquals(result.uri, "http://example.com/path");
  },
});

Deno.test({
  name: "RequestLineParser - parse handles asterisk URI for OPTIONS",
  fn() {
    const result = RequestLineParser.parse("OPTIONS * HTTP/1.1");
    assertEquals(result.uri, "*");
  },
});

Deno.test({
  name: "RequestLineParser - parse trims whitespace",
  fn() {
    const result = RequestLineParser.parse("  GET /path HTTP/1.1  ");
    assertEquals(result.method, "GET");
    assertEquals(result.uri, "/path");
    assertEquals(result.version, "1.1");
  },
});

Deno.test({
  name: "RequestLineParser - parse handles multiple spaces between parts",
  fn() {
    const result = RequestLineParser.parse("GET    /path    HTTP/1.1");
    assertEquals(result.method, "GET");
    assertEquals(result.uri, "/path");
    assertEquals(result.version, "1.1");
  },
});

Deno.test({
  name: "RequestLineParser - parse throws on empty string",
  fn() {
    assertThrows(
      () => RequestLineParser.parse(""),
      Error,
      "Empty request line"
    );
  },
});

Deno.test({
  name: "RequestLineParser - parse throws on whitespace only",
  fn() {
    assertThrows(
      () => RequestLineParser.parse("   "),
      Error,
      "Empty request line"
    );
  },
});

Deno.test({
  name: "RequestLineParser - parse throws on invalid format (missing parts)",
  fn() {
    assertThrows(
      () => RequestLineParser.parse("GET /path"),
      Error,
      "Invalid request line format"
    );
  },
});

Deno.test({
  name: "RequestLineParser - parse throws on invalid format (too many parts)",
  fn() {
    assertThrows(
      () => RequestLineParser.parse("GET /path HTTP/1.1 extra"),
      Error,
      "Invalid request line format"
    );
  },
});

Deno.test({
  name: "RequestLineParser - parse throws on invalid method",
  fn() {
    assertThrows(
      () => RequestLineParser.parse("INVALID /path HTTP/1.1"),
      Error,
      "Invalid HTTP method"
    );
  },
});

Deno.test({
  name: "RequestLineParser - parse throws on invalid version format",
  fn() {
    assertThrows(
      () => RequestLineParser.parse("GET /path HTTP1.1"),
      Error,
      "Invalid HTTP version format"
    );
  },
});

Deno.test({
  name: "RequestLineParser - parse throws on unsupported version",
  fn() {
    assertThrows(
      () => RequestLineParser.parse("GET /path HTTP/0.9"),
      Error,
      "Unsupported HTTP version"
    );
  },
});

Deno.test({
  name: "RequestLineParser - parse case insensitive HTTP in version",
  fn() {
    const result = RequestLineParser.parse("GET /path http/1.1");
    assertEquals(result.version, "1.1");
  },
});

// ============================================================================
// serialize Tests
// ============================================================================

Deno.test({
  name: "RequestLineParser - serialize creates valid request line",
  fn() {
    const requestLine: RequestLine = {
      method: "GET",
      uri: "/index.html",
      version: "1.1",
    };

    const result = RequestLineParser.serialize(requestLine);
    assertEquals(result, "GET /index.html HTTP/1.1");
  },
});

Deno.test({
  name: "RequestLineParser - serialize handles all methods",
  fn() {
    const methods: HTTPMethod[] = [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
      "CONNECT",
      "TRACE",
    ];

    for (const method of methods) {
      const requestLine: RequestLine = {
        method,
        uri: "/test",
        version: "1.1",
      };

      const result = RequestLineParser.serialize(requestLine);
      assert(result.startsWith(method));
    }
  },
});

Deno.test({
  name: "RequestLineParser - serialize handles all versions",
  fn() {
    const versions: HTTPVersion[] = ["1.0", "1.1", "2.0", "3.0"];

    for (const version of versions) {
      const requestLine: RequestLine = {
        method: "GET",
        uri: "/",
        version,
      };

      const result = RequestLineParser.serialize(requestLine);
      assert(result.endsWith(`HTTP/${version}`));
    }
  },
});

// ============================================================================
// serializeToBytes Tests
// ============================================================================

Deno.test({
  name: "RequestLineParser - serializeToBytes returns Uint8Array",
  fn() {
    const requestLine: RequestLine = {
      method: "GET",
      uri: "/",
      version: "1.1",
    };

    const result = RequestLineParser.serializeToBytes(requestLine);
    assertExists(result);
    assert(result instanceof Uint8Array);
  },
});

Deno.test({
  name: "RequestLineParser - serializeToBytes produces valid bytes",
  fn() {
    const requestLine: RequestLine = {
      method: "GET",
      uri: "/test",
      version: "1.1",
    };

    const bytes = RequestLineParser.serializeToBytes(requestLine);
    const decoded = new TextDecoder().decode(bytes);

    assertEquals(decoded, "GET /test HTTP/1.1");
  },
});

// ============================================================================
// Round-trip Tests
// ============================================================================

Deno.test({
  name: "RequestLineParser - parse then serialize is identity",
  fn() {
    const original = "POST /api/users HTTP/1.1";
    const parsed = RequestLineParser.parse(original);
    const serialized = RequestLineParser.serialize(parsed);

    assertEquals(serialized, original);
  },
});

Deno.test({
  name: "RequestLineParser - serialize then parse is identity",
  fn() {
    const original: RequestLine = {
      method: "PUT",
      uri: "/resource/123",
      version: "2.0",
    };

    const serialized = RequestLineParser.serialize(original);
    const parsed = RequestLineParser.parse(serialized);

    assertEquals(parsed.method, original.method);
    assertEquals(parsed.uri, original.uri);
    assertEquals(parsed.version, original.version);
  },
});

// ============================================================================
// isSafeMethod Tests
// ============================================================================

Deno.test({
  name: "RequestLineParser - isSafeMethod returns true for safe methods",
  fn() {
    const safeMethods: HTTPMethod[] = ["GET", "HEAD", "OPTIONS", "TRACE"];

    for (const method of safeMethods) {
      assert(RequestLineParser.isSafeMethod(method), `${method} should be safe`);
    }
  },
});

Deno.test({
  name: "RequestLineParser - isSafeMethod returns false for unsafe methods",
  fn() {
    const unsafeMethods: HTTPMethod[] = ["POST", "PUT", "DELETE", "PATCH", "CONNECT"];

    for (const method of unsafeMethods) {
      assert(
        !RequestLineParser.isSafeMethod(method),
        `${method} should not be safe`
      );
    }
  },
});

// ============================================================================
// isIdempotentMethod Tests
// ============================================================================

Deno.test({
  name: "RequestLineParser - isIdempotentMethod returns true for idempotent methods",
  fn() {
    const idempotentMethods: HTTPMethod[] = [
      "GET",
      "HEAD",
      "PUT",
      "DELETE",
      "OPTIONS",
      "TRACE",
    ];

    for (const method of idempotentMethods) {
      assert(
        RequestLineParser.isIdempotentMethod(method),
        `${method} should be idempotent`
      );
    }
  },
});

Deno.test({
  name: "RequestLineParser - isIdempotentMethod returns false for non-idempotent methods",
  fn() {
    const nonIdempotentMethods: HTTPMethod[] = ["POST", "PATCH", "CONNECT"];

    for (const method of nonIdempotentMethods) {
      assert(
        !RequestLineParser.isIdempotentMethod(method),
        `${method} should not be idempotent`
      );
    }
  },
});

// ============================================================================
// methodHasBody Tests
// ============================================================================

Deno.test({
  name: "RequestLineParser - methodHasBody returns true for methods with body",
  fn() {
    const methodsWithBody: HTTPMethod[] = ["POST", "PUT", "PATCH"];

    for (const method of methodsWithBody) {
      assert(
        RequestLineParser.methodHasBody(method),
        `${method} should have body`
      );
    }
  },
});

Deno.test({
  name: "RequestLineParser - methodHasBody returns false for methods without body",
  fn() {
    const methodsWithoutBody: HTTPMethod[] = [
      "GET",
      "HEAD",
      "DELETE",
      "OPTIONS",
      "TRACE",
      "CONNECT",
    ];

    for (const method of methodsWithoutBody) {
      assert(
        !RequestLineParser.methodHasBody(method),
        `${method} should not have body`
      );
    }
  },
});

// ============================================================================
// parseAbsoluteURI Tests
// ============================================================================

Deno.test({
  name: "RequestLineParser - parseAbsoluteURI parses HTTP URL",
  fn() {
    const result = RequestLineParser.parseAbsoluteURI(
      "http://example.com/path"
    );

    assertEquals(result.scheme, "http");
    assertEquals(result.host, "example.com");
    assertEquals(result.port, 80);
    assertEquals(result.path, "/path");
  },
});

Deno.test({
  name: "RequestLineParser - parseAbsoluteURI parses HTTPS URL",
  fn() {
    const result = RequestLineParser.parseAbsoluteURI(
      "https://example.com/path"
    );

    assertEquals(result.scheme, "https");
    assertEquals(result.host, "example.com");
    assertEquals(result.port, 443);
    assertEquals(result.path, "/path");
  },
});

Deno.test({
  name: "RequestLineParser - parseAbsoluteURI parses URL with explicit port",
  fn() {
    const result = RequestLineParser.parseAbsoluteURI(
      "http://example.com:8080/path"
    );

    assertEquals(result.host, "example.com");
    assertEquals(result.port, 8080);
  },
});

Deno.test({
  name: "RequestLineParser - parseAbsoluteURI parses URL with query string",
  fn() {
    const result = RequestLineParser.parseAbsoluteURI(
      "http://example.com/path?query=value"
    );

    assertEquals(result.path, "/path?query=value");
  },
});

Deno.test({
  name: "RequestLineParser - parseAbsoluteURI parses URL with hash",
  fn() {
    const result = RequestLineParser.parseAbsoluteURI(
      "http://example.com/path#section"
    );

    assertEquals(result.path, "/path#section");
  },
});

Deno.test({
  name: "RequestLineParser - parseAbsoluteURI throws on invalid URI",
  fn() {
    assertThrows(
      () => RequestLineParser.parseAbsoluteURI("not-a-valid-uri"),
      Error,
      "Invalid absolute URI"
    );
  },
});

// ============================================================================
// isAbsoluteURI Tests
// ============================================================================

Deno.test({
  name: "RequestLineParser - isAbsoluteURI returns true for HTTP URI",
  fn() {
    assert(RequestLineParser.isAbsoluteURI("http://example.com"));
  },
});

Deno.test({
  name: "RequestLineParser - isAbsoluteURI returns true for HTTPS URI",
  fn() {
    assert(RequestLineParser.isAbsoluteURI("https://example.com"));
  },
});

Deno.test({
  name: "RequestLineParser - isAbsoluteURI returns true for FTP URI",
  fn() {
    assert(RequestLineParser.isAbsoluteURI("ftp://ftp.example.com"));
  },
});

Deno.test({
  name: "RequestLineParser - isAbsoluteURI returns false for relative path",
  fn() {
    assert(!RequestLineParser.isAbsoluteURI("/path/to/resource"));
  },
});

Deno.test({
  name: "RequestLineParser - isAbsoluteURI returns false for asterisk",
  fn() {
    assert(!RequestLineParser.isAbsoluteURI("*"));
  },
});

Deno.test({
  name: "RequestLineParser - isAbsoluteURI returns false for query-only",
  fn() {
    assert(!RequestLineParser.isAbsoluteURI("?query=value"));
  },
});

// ============================================================================
// normalizePath Tests
// ============================================================================

Deno.test({
  name: "RequestLineParser - normalizePath handles root path",
  fn() {
    const result = RequestLineParser.normalizePath("/");
    assertEquals(result, "/");
  },
});

Deno.test({
  name: "RequestLineParser - normalizePath handles simple path",
  fn() {
    const result = RequestLineParser.normalizePath("/path/to/resource");
    assertEquals(result, "/path/to/resource");
  },
});

Deno.test({
  name: "RequestLineParser - normalizePath adds leading slash",
  fn() {
    const result = RequestLineParser.normalizePath("path/to/resource");
    assertEquals(result, "/path/to/resource");
  },
});

Deno.test({
  name: "RequestLineParser - normalizePath handles query string",
  fn() {
    const result = RequestLineParser.normalizePath("/path?query=value");
    assertEquals(result, "/path?query=value");
  },
});

Deno.test({
  name: "RequestLineParser - normalizePath handles hash",
  fn() {
    const result = RequestLineParser.normalizePath("/path#section");
    assertEquals(result, "/path#section");
  },
});

Deno.test({
  name: "RequestLineParser - normalizePath removes dot segments",
  fn() {
    const result = RequestLineParser.normalizePath("/path/./to/../resource");
    assertEquals(result, "/path/resource");
  },
});
