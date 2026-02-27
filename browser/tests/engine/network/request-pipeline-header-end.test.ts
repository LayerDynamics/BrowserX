/**
 * Tests for RequestPipeline.findHeaderEnd - byte-level header boundary detection
 * Verifies that header/body boundary is found using raw bytes, not string character indices,
 * which avoids offset misalignment when headers contain multi-byte UTF-8.
 */

import { assertEquals } from "@std/assert";
import { RequestPipeline } from "../../../src/engine/RequestPipeline.ts";

// Access private method via prototype for testing
const findHeaderEnd = (RequestPipeline.prototype as any).findHeaderEnd;

Deno.test("findHeaderEnd - finds CRLFCRLF in ASCII headers", () => {
  const raw = new TextEncoder().encode("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html>");
  const idx = findHeaderEnd(raw);
  // The \r\n\r\n starts right after the last header
  assertEquals(idx !== -1, true);
  // Body should start at idx + 4
  const body = new TextDecoder().decode(raw.slice(idx + 4));
  assertEquals(body, "<html>");
});

Deno.test("findHeaderEnd - returns -1 when no double CRLF", () => {
  const raw = new TextEncoder().encode("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n");
  const idx = findHeaderEnd(raw);
  assertEquals(idx, -1);
});

Deno.test("findHeaderEnd - correct byte offset with multi-byte UTF-8 in headers", () => {
  // Header contains multi-byte UTF-8 characters (e.g., in a Set-Cookie value)
  // "café" = 5 chars but 6 bytes (é is 2 bytes in UTF-8)
  const header = "HTTP/1.1 200 OK\r\nX-Name: café\r\n\r\n";
  const bodyContent = "body here";
  const raw = new TextEncoder().encode(header + bodyContent);

  const idx = findHeaderEnd(raw);
  assertEquals(idx !== -1, true);

  // The body should start exactly after the \r\n\r\n in bytes
  const body = new TextDecoder().decode(raw.slice(idx + 4));
  assertEquals(body, bodyContent);

  // Verify that a naive string-based approach would give wrong results
  const text = new TextDecoder().decode(raw);
  const stringIdx = text.indexOf("\r\n\r\n");
  // String index would be different from byte index due to multi-byte chars
  // "café" has 4 chars but 5 bytes, so string index < byte index
  assertEquals(stringIdx < idx, true, "String-based index should be less than byte index for multi-byte headers");
});

Deno.test("findHeaderEnd - handles empty data", () => {
  const raw = new Uint8Array(0);
  const idx = findHeaderEnd(raw);
  assertEquals(idx, -1);
});

Deno.test("findHeaderEnd - handles data shorter than 4 bytes", () => {
  const raw = new Uint8Array([0x0d, 0x0a, 0x0d]);
  const idx = findHeaderEnd(raw);
  assertEquals(idx, -1);
});

Deno.test("findHeaderEnd - finds boundary at start", () => {
  const raw = new Uint8Array([0x0d, 0x0a, 0x0d, 0x0a, 0x41, 0x42]);
  const idx = findHeaderEnd(raw);
  assertEquals(idx, 0);
});
