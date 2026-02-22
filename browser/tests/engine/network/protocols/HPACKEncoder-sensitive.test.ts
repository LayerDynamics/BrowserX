/**
 * HPACK Encoder/Decoder tests for sensitive headers
 * Tests "literal without indexing" and "literal never indexed" representations
 */

import { assert, assertEquals } from "@std/assert";
import {
  HPACKDecoder,
  HPACKEncoder,
} from "../../../../src/engine/network/protocols/HPACKEncoder.ts";

// =============================================================================
// Never Indexed / Without Indexing — Decode
// =============================================================================

Deno.test("HPACKDecoder decodes literal-without-indexing header (0000 prefix)", () => {
  // Manually encode: 0x00 prefix (4-bit index=0, new name), name "x-custom", value "secret"
  const bytes: number[] = [];
  // 0000 0000 — literal without indexing, new name
  bytes.push(0x00);
  // Name: "x-custom" (length 8, no Huffman)
  bytes.push(8); // length
  bytes.push(...Array.from(new TextEncoder().encode("x-custom")));
  // Value: "secret" (length 6, no Huffman)
  bytes.push(6);
  bytes.push(...Array.from(new TextEncoder().encode("secret")));

  const decoder = new HPACKDecoder();
  const headers = decoder.decode(new Uint8Array(bytes));
  assertEquals(headers.get("x-custom"), "secret");
});

Deno.test("HPACKDecoder decodes literal-never-indexed header (0001 prefix)", () => {
  const bytes: number[] = [];
  // 0001 0000 — literal never indexed, new name
  bytes.push(0x10);
  // Name: "authorization" (length 13)
  bytes.push(13);
  bytes.push(...Array.from(new TextEncoder().encode("authorization")));
  // Value: "Bearer token123" (length 15)
  bytes.push(15);
  bytes.push(...Array.from(new TextEncoder().encode("Bearer token123")));

  const decoder = new HPACKDecoder();
  const headers = decoder.decode(new Uint8Array(bytes));
  assertEquals(headers.get("authorization"), "Bearer token123");
});

Deno.test("HPACKDecoder decodes mixed: indexed + never-indexed + indexed", () => {
  // Encode using HPACKEncoder (which produces indexed/incremental-indexing)
  // then manually append a never-indexed header, then another indexed

  const encoder = new HPACKEncoder();
  const decoder = new HPACKDecoder();

  // First encode a normal header
  const normalHeaders = new Map<string, string>();
  normalHeaders.set(":method", "GET");
  normalHeaders.set(":path", "/");
  const normalBytes = encoder.encode(normalHeaders);

  // Now manually build: normal + never-indexed + another literal-without-indexing
  const bytes: number[] = [...normalBytes];

  // Never indexed: cookie = "session=abc"
  bytes.push(0x10); // 0001 0000
  bytes.push(6); // "cookie" length
  bytes.push(...Array.from(new TextEncoder().encode("cookie")));
  bytes.push(11); // "session=abc" length
  bytes.push(...Array.from(new TextEncoder().encode("session=abc")));

  // Without indexing: set-cookie = "id=xyz"
  bytes.push(0x00); // 0000 0000
  bytes.push(10); // "set-cookie" length
  bytes.push(...Array.from(new TextEncoder().encode("set-cookie")));
  bytes.push(6); // "id=xyz" length
  bytes.push(...Array.from(new TextEncoder().encode("id=xyz")));

  const headers = decoder.decode(new Uint8Array(bytes));
  assertEquals(headers.get(":method"), "GET");
  assertEquals(headers.get(":path"), "/");
  assertEquals(headers.get("cookie"), "session=abc");
  assertEquals(headers.get("set-cookie"), "id=xyz");
});

Deno.test("HPACKDecoder does not add never-indexed headers to dynamic table", () => {
  const decoder = new HPACKDecoder();

  // Encode a never-indexed header
  const bytes: number[] = [];
  bytes.push(0x10); // never indexed
  bytes.push(6); // "secret" length
  bytes.push(...Array.from(new TextEncoder().encode("secret")));
  bytes.push(5); // "value" length
  bytes.push(...Array.from(new TextEncoder().encode("value")));

  // First decode
  const headers1 = decoder.decode(new Uint8Array(bytes));
  assertEquals(headers1.get("secret"), "value");

  // Try to reference it as an indexed header — it shouldn't be in the table
  // Indexed reference to dynamic table entry 62 (first dynamic entry)
  const indexedBytes = [0x80 | 62]; // 1xxxxxxx with index 62
  const headers2 = decoder.decode(new Uint8Array(indexedBytes));
  // Should NOT find "secret" since it wasn't indexed
  assertEquals(headers2.has("secret"), false);
});

// =============================================================================
// Never Indexed / Without Indexing — Encode
// =============================================================================

Deno.test("HPACKEncoder encodes authorization as never-indexed", () => {
  const encoder = new HPACKEncoder();
  const decoder = new HPACKDecoder();

  const headers = new Map<string, string>();
  headers.set("authorization", "Bearer abc123");

  const encoded = encoder.encode(headers);
  // First byte should have 0001xxxx pattern (never indexed)
  assertEquals(encoded[0] & 0xF0, 0x10);

  // Verify round-trip
  const decoded = decoder.decode(encoded);
  assertEquals(decoded.get("authorization"), "Bearer abc123");
});

Deno.test("HPACKEncoder encodes cookie as never-indexed", () => {
  const encoder = new HPACKEncoder();
  const decoder = new HPACKDecoder();

  const headers = new Map<string, string>();
  headers.set("cookie", "session=xyz");

  const encoded = encoder.encode(headers);
  assertEquals(encoded[0] & 0xF0, 0x10);

  const decoded = decoder.decode(encoded);
  assertEquals(decoded.get("cookie"), "session=xyz");
});

Deno.test("HPACKEncoder encodes set-cookie as never-indexed", () => {
  const encoder = new HPACKEncoder();
  const decoder = new HPACKDecoder();

  const headers = new Map<string, string>();
  headers.set("set-cookie", "id=abc; Path=/");

  const encoded = encoder.encode(headers);
  assertEquals(encoded[0] & 0xF0, 0x10);

  const decoded = decoder.decode(encoded);
  assertEquals(decoded.get("set-cookie"), "id=abc; Path=/");
});

Deno.test("HPACKEncoder normal headers still use incremental indexing", () => {
  const encoder = new HPACKEncoder();

  const headers = new Map<string, string>();
  headers.set("content-type", "application/json");

  const encoded = encoder.encode(headers);
  // Should NOT be never-indexed — should be indexed or incremental
  assert((encoded[0] & 0xF0) !== 0x10, "Normal headers should not use never-indexed");
});

Deno.test("HPACKEncoder round-trips mixed normal + sensitive headers", () => {
  const encoder = new HPACKEncoder();
  const decoder = new HPACKDecoder();

  const headers = new Map<string, string>();
  headers.set(":method", "POST");
  headers.set(":path", "/api");
  headers.set("content-type", "application/json");
  headers.set("authorization", "Bearer secret");
  headers.set("cookie", "sid=123");

  const encoded = encoder.encode(headers);
  const decoded = decoder.decode(encoded);

  assertEquals(decoded.get(":method"), "POST");
  assertEquals(decoded.get(":path"), "/api");
  assertEquals(decoded.get("content-type"), "application/json");
  assertEquals(decoded.get("authorization"), "Bearer secret");
  assertEquals(decoded.get("cookie"), "sid=123");
});

Deno.test("HPACKEncoder custom sensitive headers via parameter", () => {
  const encoder = new HPACKEncoder();
  const decoder = new HPACKDecoder();

  const headers = new Map<string, string>();
  headers.set("x-api-key", "my-secret-key");

  const customSensitive = new Set(["x-api-key"]);
  const encoded = encoder.encode(headers, customSensitive);

  // Should be never-indexed
  assertEquals(encoded[0] & 0xF0, 0x10);

  const decoded = decoder.decode(encoded);
  assertEquals(decoded.get("x-api-key"), "my-secret-key");
});

// =============================================================================
// Dynamic Table Size Update
// =============================================================================

Deno.test("HPACKDecoder handles dynamic table size update (001xxxxx)", () => {
  const decoder = new HPACKDecoder();

  // Dynamic table size update to 256 bytes: 001xxxxx with 5-bit prefix
  // 256 fits in continuation: first byte = 0x20 | 31 = 0x3F, then 256-31=225 = 0xE1, 0x01
  const bytes: number[] = [0x3F, 0xE1, 0x01];

  // Should not crash — just updates internal table size
  const headers = decoder.decode(new Uint8Array(bytes));
  assertEquals(headers.size, 0); // No headers, just a table update
});

Deno.test("HPACKDecoder handles table size update followed by headers", () => {
  const encoder = new HPACKEncoder();
  const decoder = new HPACKDecoder();

  // First: table size update to 128
  // 128 in 5-bit prefix: 0x20 | 31 = 0x3F, then 128-31=97 = 0x61
  const sizeUpdate = [0x3F, 0x61];

  // Then: a normal header
  const normalHeaders = new Map<string, string>();
  normalHeaders.set(":method", "GET");
  const headerBytes = encoder.encode(normalHeaders);

  const combined = new Uint8Array([...sizeUpdate, ...headerBytes]);
  const decoded = decoder.decode(combined);
  assertEquals(decoded.get(":method"), "GET");
});
