/**
 * HeaderParser Tests
 * Tests for HTTP header parsing and serialization (RFC 7230)
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import { HeaderParser, Headers } from "../../../../../core/network/primitive/header/header_parser.ts";

// ============================================================================
// Parse Headers Tests
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
  name: "HeaderParser - getContentLength returns parsed value",
  fn() {
    const headers: Headers = { "content-length": "1234" };
    const length = HeaderParser.getContentLength(headers);

    assertEquals(length, 1234);
  },
});

Deno.test({
  name: "HeaderParser - parseCookies with single cookie",
  fn() {
    const headers: Headers = { "cookie": "session=abc123" };
    const cookies = HeaderParser.parseCookies(headers);

    assertEquals(cookies["session"], "abc123");
  },
});
