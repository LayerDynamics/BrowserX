/**
 * HeaderParser Tests
 * Tests for HTTP header parsing and serialization (RFC 7230)
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import { HeaderParser, type Headers } from "../../../../../core/network/primitive/header/header_parser.ts";

// ============================================================================
// parseHeaders Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - parseHeaders with single header",
  fn() {
    const lines = ["Content-Type: text/html"];
    const headers = HeaderParser.parseHeaders(lines);

    assertEquals(headers["content-type"], "text/html");
  },
});

Deno.test({
  name: "HeaderParser - parseHeaders with multiple headers",
  fn() {
    const lines = [
      "Content-Type: text/html",
      "Content-Length: 1234",
      "Host: example.com",
    ];
    const headers = HeaderParser.parseHeaders(lines);

    assertEquals(headers["content-type"], "text/html");
    assertEquals(headers["content-length"], "1234");
    assertEquals(headers["host"], "example.com");
  },
});

Deno.test({
  name: "HeaderParser - parseHeaders normalizes names to lowercase",
  fn() {
    const lines = ["CONTENT-TYPE: text/html", "content-length: 100"];
    const headers = HeaderParser.parseHeaders(lines);

    assertEquals(headers["content-type"], "text/html");
    assertEquals(headers["content-length"], "100");
  },
});

Deno.test({
  name: "HeaderParser - parseHeaders handles spaces around values",
  fn() {
    const lines = ["Content-Type:   text/html  "];
    const headers = HeaderParser.parseHeaders(lines);

    assertEquals(headers["content-type"], "text/html");
  },
});

Deno.test({
  name: "HeaderParser - parseHeaders handles empty value",
  fn() {
    const lines = ["X-Empty:"];
    const headers = HeaderParser.parseHeaders(lines);

    assertEquals(headers["x-empty"], "");
  },
});

Deno.test({
  name: "HeaderParser - parseHeaders combines duplicate headers",
  fn() {
    const lines = ["Set-Cookie: a=1", "Set-Cookie: b=2"];
    const headers = HeaderParser.parseHeaders(lines);

    assertEquals(headers["set-cookie"], "a=1, b=2");
  },
});

Deno.test({
  name: "HeaderParser - parseHeaders stops at empty line",
  fn() {
    const lines = ["Content-Type: text/html", "", "Not-A-Header: value"];
    const headers = HeaderParser.parseHeaders(lines);

    assertEquals(headers["content-type"], "text/html");
    assertEquals(headers["not-a-header"], undefined);
  },
});

Deno.test({
  name: "HeaderParser - parseHeaders handles colon in value",
  fn() {
    const lines = ["Location: http://example.com:8080/path"];
    const headers = HeaderParser.parseHeaders(lines);

    assertEquals(headers["location"], "http://example.com:8080/path");
  },
});

Deno.test({
  name: "HeaderParser - parseHeaders throws on invalid header",
  fn() {
    const lines = ["Invalid Header Without Colon"];

    assertThrows(
      () => HeaderParser.parseHeaders(lines),
      Error,
      "Invalid header line",
    );
  },
});

// ============================================================================
// parseHeaderString Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - parseHeaderString parses CRLF-separated string",
  fn() {
    const headerString = "Content-Type: text/html\r\nContent-Length: 100";
    const headers = HeaderParser.parseHeaderString(headerString);

    assertEquals(headers["content-type"], "text/html");
    assertEquals(headers["content-length"], "100");
  },
});

// ============================================================================
// serializeHeaders Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - serializeHeaders creates string format",
  fn() {
    const headers: Headers = {
      "content-type": "text/html",
      "content-length": "100",
    };
    const serialized = HeaderParser.serializeHeaders(headers);

    assert(serialized.includes("Content-Type: text/html"));
    assert(serialized.includes("Content-Length: 100"));
    assert(serialized.includes("\r\n"));
  },
});

Deno.test({
  name: "HeaderParser - serializeHeaders uses Title-Case for names",
  fn() {
    const headers: Headers = { "content-type": "text/html" };
    const serialized = HeaderParser.serializeHeaders(headers);

    assert(serialized.includes("Content-Type"));
  },
});

// ============================================================================
// serializeHeadersToBytes Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - serializeHeadersToBytes returns Uint8Array",
  fn() {
    const headers: Headers = { "content-type": "text/html" };
    const bytes = HeaderParser.serializeHeadersToBytes(headers);

    assertExists(bytes);
    assert(bytes instanceof Uint8Array);
    assert(bytes.length > 0);
  },
});

// ============================================================================
// getHeader Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - getHeader retrieves existing header",
  fn() {
    const headers: Headers = { "content-type": "text/html" };
    const value = HeaderParser.getHeader(headers, "Content-Type");

    assertEquals(value, "text/html");
  },
});

Deno.test({
  name: "HeaderParser - getHeader is case-insensitive",
  fn() {
    const headers: Headers = { "content-type": "text/html" };

    assertEquals(HeaderParser.getHeader(headers, "CONTENT-TYPE"), "text/html");
    assertEquals(HeaderParser.getHeader(headers, "content-type"), "text/html");
    assertEquals(HeaderParser.getHeader(headers, "Content-Type"), "text/html");
  },
});

Deno.test({
  name: "HeaderParser - getHeader returns undefined for missing header",
  fn() {
    const headers: Headers = {};
    const value = HeaderParser.getHeader(headers, "X-Missing");

    assertEquals(value, undefined);
  },
});

// ============================================================================
// setHeader Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - setHeader adds header to object",
  fn() {
    const headers: Headers = {};
    HeaderParser.setHeader(headers, "Content-Type", "text/html");

    assertEquals(headers["content-type"], "text/html");
  },
});

Deno.test({
  name: "HeaderParser - setHeader normalizes name to lowercase",
  fn() {
    const headers: Headers = {};
    HeaderParser.setHeader(headers, "CONTENT-TYPE", "text/html");

    assertEquals(headers["content-type"], "text/html");
    assertEquals(headers["CONTENT-TYPE"], undefined);
  },
});

Deno.test({
  name: "HeaderParser - setHeader overwrites existing header",
  fn() {
    const headers: Headers = { "content-type": "text/plain" };
    HeaderParser.setHeader(headers, "Content-Type", "text/html");

    assertEquals(headers["content-type"], "text/html");
  },
});

// ============================================================================
// deleteHeader Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - deleteHeader removes header",
  fn() {
    const headers: Headers = { "content-type": "text/html" };
    HeaderParser.deleteHeader(headers, "Content-Type");

    assertEquals(headers["content-type"], undefined);
  },
});

Deno.test({
  name: "HeaderParser - deleteHeader is case-insensitive",
  fn() {
    const headers: Headers = { "content-type": "text/html" };
    HeaderParser.deleteHeader(headers, "CONTENT-TYPE");

    assertEquals(headers["content-type"], undefined);
  },
});

Deno.test({
  name: "HeaderParser - deleteHeader handles non-existent header",
  fn() {
    const headers: Headers = {};
    HeaderParser.deleteHeader(headers, "X-Missing"); // Should not throw
    assertEquals(Object.keys(headers).length, 0);
  },
});

// ============================================================================
// hasHeader Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - hasHeader returns true for existing header",
  fn() {
    const headers: Headers = { "content-type": "text/html" };
    assertEquals(HeaderParser.hasHeader(headers, "Content-Type"), true);
  },
});

Deno.test({
  name: "HeaderParser - hasHeader returns false for missing header",
  fn() {
    const headers: Headers = {};
    assertEquals(HeaderParser.hasHeader(headers, "Content-Type"), false);
  },
});

Deno.test({
  name: "HeaderParser - hasHeader is case-insensitive",
  fn() {
    const headers: Headers = { "content-type": "text/html" };

    assertEquals(HeaderParser.hasHeader(headers, "CONTENT-TYPE"), true);
    assertEquals(HeaderParser.hasHeader(headers, "content-type"), true);
  },
});

// ============================================================================
// mergeHeaders Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - mergeHeaders combines two header objects",
  fn() {
    const headers1: Headers = { "content-type": "text/html" };
    const headers2: Headers = { "content-length": "100" };
    const merged = HeaderParser.mergeHeaders(headers1, headers2);

    assertEquals(merged["content-type"], "text/html");
    assertEquals(merged["content-length"], "100");
  },
});

Deno.test({
  name: "HeaderParser - mergeHeaders second overwrites first",
  fn() {
    const headers1: Headers = { "content-type": "text/plain" };
    const headers2: Headers = { "content-type": "text/html" };
    const merged = HeaderParser.mergeHeaders(headers1, headers2);

    assertEquals(merged["content-type"], "text/html");
  },
});

Deno.test({
  name: "HeaderParser - mergeHeaders does not modify originals",
  fn() {
    const headers1: Headers = { "content-type": "text/html" };
    const headers2: Headers = { "content-length": "100" };
    const merged = HeaderParser.mergeHeaders(headers1, headers2);

    merged["x-custom"] = "value";

    assertEquals(headers1["x-custom"], undefined);
    assertEquals(headers2["x-custom"], undefined);
  },
});

// ============================================================================
// getContentLength Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - getContentLength returns parsed value",
  fn() {
    const headers: Headers = { "content-length": "1234" };
    const length = HeaderParser.getContentLength(headers);

    assertEquals(length, 1234);
  },
});

Deno.test({
  name: "HeaderParser - getContentLength returns null when missing",
  fn() {
    const headers: Headers = {};
    const length = HeaderParser.getContentLength(headers);

    assertEquals(length, null);
  },
});

Deno.test({
  name: "HeaderParser - getContentLength throws on invalid value",
  fn() {
    const headers: Headers = { "content-length": "not-a-number" };

    assertThrows(
      () => HeaderParser.getContentLength(headers),
      Error,
      "Invalid Content-Length",
    );
  },
});

Deno.test({
  name: "HeaderParser - getContentLength throws on negative value",
  fn() {
    const headers: Headers = { "content-length": "-1" };

    assertThrows(
      () => HeaderParser.getContentLength(headers),
      Error,
      "Invalid Content-Length",
    );
  },
});

// ============================================================================
// isChunkedEncoding Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - isChunkedEncoding returns true when chunked",
  fn() {
    const headers: Headers = { "transfer-encoding": "chunked" };
    assertEquals(HeaderParser.isChunkedEncoding(headers), true);
  },
});

Deno.test({
  name: "HeaderParser - isChunkedEncoding handles mixed case",
  fn() {
    const headers: Headers = { "transfer-encoding": "Chunked" };
    assertEquals(HeaderParser.isChunkedEncoding(headers), true);
  },
});

Deno.test({
  name: "HeaderParser - isChunkedEncoding with multiple encodings",
  fn() {
    const headers: Headers = { "transfer-encoding": "gzip, chunked" };
    assertEquals(HeaderParser.isChunkedEncoding(headers), true);
  },
});

Deno.test({
  name: "HeaderParser - isChunkedEncoding returns false when not chunked",
  fn() {
    const headers: Headers = { "transfer-encoding": "gzip" };
    assertEquals(HeaderParser.isChunkedEncoding(headers), false);
  },
});

Deno.test({
  name: "HeaderParser - isChunkedEncoding returns false when missing",
  fn() {
    const headers: Headers = {};
    assertEquals(HeaderParser.isChunkedEncoding(headers), false);
  },
});

// ============================================================================
// isKeepAlive Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - isKeepAlive returns true for HTTP/1.1 default",
  fn() {
    const headers: Headers = {};
    assertEquals(HeaderParser.isKeepAlive(headers, "1.1"), true);
  },
});

Deno.test({
  name: "HeaderParser - isKeepAlive returns false for HTTP/1.0 default",
  fn() {
    const headers: Headers = {};
    assertEquals(HeaderParser.isKeepAlive(headers, "1.0"), false);
  },
});

Deno.test({
  name: "HeaderParser - isKeepAlive respects Connection header",
  fn() {
    const headers1: Headers = { connection: "keep-alive" };
    assertEquals(HeaderParser.isKeepAlive(headers1, "1.0"), true);

    const headers2: Headers = { connection: "close" };
    assertEquals(HeaderParser.isKeepAlive(headers2, "1.1"), false);
  },
});

Deno.test({
  name: "HeaderParser - isKeepAlive is case-insensitive",
  fn() {
    const headers: Headers = { connection: "Keep-Alive" };
    assertEquals(HeaderParser.isKeepAlive(headers, "1.0"), true);
  },
});

// ============================================================================
// getHost Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - getHost returns host value",
  fn() {
    const headers: Headers = { host: "example.com" };
    assertEquals(HeaderParser.getHost(headers), "example.com");
  },
});

Deno.test({
  name: "HeaderParser - getHost returns host with port",
  fn() {
    const headers: Headers = { host: "example.com:8080" };
    assertEquals(HeaderParser.getHost(headers), "example.com:8080");
  },
});

Deno.test({
  name: "HeaderParser - getHost returns null when missing",
  fn() {
    const headers: Headers = {};
    assertEquals(HeaderParser.getHost(headers), null);
  },
});

// ============================================================================
// parseCookies Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - parseCookies with single cookie",
  fn() {
    const headers: Headers = { cookie: "session=abc123" };
    const cookies = HeaderParser.parseCookies(headers);

    assertEquals(cookies["session"], "abc123");
  },
});

Deno.test({
  name: "HeaderParser - parseCookies with multiple cookies",
  fn() {
    const headers: Headers = { cookie: "session=abc123; user=john; theme=dark" };
    const cookies = HeaderParser.parseCookies(headers);

    assertEquals(cookies["session"], "abc123");
    assertEquals(cookies["user"], "john");
    assertEquals(cookies["theme"], "dark");
  },
});

Deno.test({
  name: "HeaderParser - parseCookies handles spaces",
  fn() {
    const headers: Headers = { cookie: "  session = abc123  ;  user = john  " };
    const cookies = HeaderParser.parseCookies(headers);

    assertEquals(cookies["session"], "abc123");
    assertEquals(cookies["user"], "john");
  },
});

Deno.test({
  name: "HeaderParser - parseCookies handles value with equals sign",
  fn() {
    const headers: Headers = { cookie: "data=a=b=c" };
    const cookies = HeaderParser.parseCookies(headers);

    assertEquals(cookies["data"], "a=b=c");
  },
});

Deno.test({
  name: "HeaderParser - parseCookies returns empty for missing header",
  fn() {
    const headers: Headers = {};
    const cookies = HeaderParser.parseCookies(headers);

    assertEquals(Object.keys(cookies).length, 0);
  },
});

// ============================================================================
// serializeCookies Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - serializeCookies creates cookie header value",
  fn() {
    const cookies = { session: "abc123", user: "john" };
    const serialized = HeaderParser.serializeCookies(cookies);

    assert(serialized.includes("session=abc123"));
    assert(serialized.includes("user=john"));
    assert(serialized.includes("; "));
  },
});

Deno.test({
  name: "HeaderParser - serializeCookies with single cookie",
  fn() {
    const cookies = { session: "abc123" };
    const serialized = HeaderParser.serializeCookies(cookies);

    assertEquals(serialized, "session=abc123");
  },
});

Deno.test({
  name: "HeaderParser - serializeCookies with empty object",
  fn() {
    const cookies = {};
    const serialized = HeaderParser.serializeCookies(cookies);

    assertEquals(serialized, "");
  },
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

Deno.test({
  name: "HeaderParser - round-trip parse and serialize",
  fn() {
    const original = "Content-Type: text/html\r\nContent-Length: 100";
    const parsed = HeaderParser.parseHeaderString(original);
    const serialized = HeaderParser.serializeHeaders(parsed);
    const reParsed = HeaderParser.parseHeaderString(serialized);

    assertEquals(reParsed["content-type"], parsed["content-type"]);
    assertEquals(reParsed["content-length"], parsed["content-length"]);
  },
});

Deno.test({
  name: "HeaderParser - handles HTTP/1.1 response headers",
  fn() {
    const lines = [
      "Content-Type: application/json; charset=utf-8",
      "Content-Length: 42",
      "Cache-Control: no-cache",
      "X-Request-Id: abc-123-def",
    ];
    const headers = HeaderParser.parseHeaders(lines);

    assertEquals(headers["content-type"], "application/json; charset=utf-8");
    assertEquals(headers["content-length"], "42");
    assertEquals(headers["cache-control"], "no-cache");
    assertEquals(headers["x-request-id"], "abc-123-def");
  },
});

Deno.test({
  name: "HeaderParser - handles CORS headers",
  fn() {
    const lines = [
      "Access-Control-Allow-Origin: *",
      "Access-Control-Allow-Methods: GET, POST, OPTIONS",
      "Access-Control-Allow-Headers: Content-Type, Authorization",
    ];
    const headers = HeaderParser.parseHeaders(lines);

    assertEquals(headers["access-control-allow-origin"], "*");
    assertEquals(headers["access-control-allow-methods"], "GET, POST, OPTIONS");
  },
});

Deno.test({
  name: "HeaderParser - handles WWW-Authenticate header",
  fn() {
    const lines = ['WWW-Authenticate: Bearer realm="api"'];
    const headers = HeaderParser.parseHeaders(lines);

    assertEquals(headers["www-authenticate"], 'Bearer realm="api"');
  },
});

Deno.test({
  name: "HeaderParser - empty headers object",
  fn() {
    const lines: string[] = [];
    const headers = HeaderParser.parseHeaders(lines);

    assertEquals(Object.keys(headers).length, 0);
  },
});
