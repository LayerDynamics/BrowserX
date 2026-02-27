/**
 * HPACK Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { HPACKCodec, decodeHuffman, encodeHuffman } from "../../../../../core/network/transport/http/http2_hpack.ts";

// ============================================================================
// Construction
// ============================================================================

Deno.test({
  name: "HPACKCodec - constructs successfully",
  fn() {
    const codec = new HPACKCodec();
    assertExists(codec);
  },
});

// ============================================================================
// encode()
// ============================================================================

Deno.test({
  name: "HPACKCodec - encode() returns a Uint8Array",
  fn() {
    const codec = new HPACKCodec();
    const headers = new Map([["content-type", "text/html"]]);
    const encoded = codec.encode(headers);
    assert(encoded instanceof Uint8Array);
  },
});

Deno.test({
  name: "HPACKCodec - encode() of empty map returns empty buffer",
  fn() {
    const codec = new HPACKCodec();
    const encoded = codec.encode(new Map());
    assert(encoded instanceof Uint8Array);
    assertEquals(encoded.length, 0);
  },
});

Deno.test({
  name: "HPACKCodec - encode() produces non-empty output for headers",
  fn() {
    const codec = new HPACKCodec();
    const headers = new Map([[":method", "GET"], [":path", "/"]]);
    const encoded = codec.encode(headers);
    assert(encoded.length > 0);
  },
});

// ============================================================================
// decode()
// ============================================================================

Deno.test({
  name: "HPACKCodec - decode() returns a Map",
  fn() {
    const codec = new HPACKCodec();
    const headers = new Map([[":method", "GET"]]);
    const encoded = codec.encode(headers);
    const decoded = codec.decode(encoded);
    assert(decoded instanceof Map);
  },
});

Deno.test({
  name: "HPACKCodec - decode() of empty buffer returns empty Map",
  fn() {
    const codec = new HPACKCodec();
    const decoded = codec.decode(new Uint8Array(0));
    assertEquals(decoded.size, 0);
  },
});

// ============================================================================
// Round-trip encode/decode
// ============================================================================

Deno.test({
  name: "HPACKCodec - round-trip preserves :method GET",
  fn() {
    const codec = new HPACKCodec();
    const headers = new Map([[":method", "GET"]]);
    const encoded = codec.encode(headers);
    const decoded = codec.decode(encoded);
    assertEquals(decoded.get(":method"), "GET");
  },
});

Deno.test({
  name: "HPACKCodec - round-trip preserves :path /",
  fn() {
    const codec = new HPACKCodec();
    const headers = new Map([[":path", "/"]]);
    const encoded = codec.encode(headers);
    const decoded = codec.decode(encoded);
    assertEquals(decoded.get(":path"), "/");
  },
});

Deno.test({
  name: "HPACKCodec - round-trip preserves :scheme https",
  fn() {
    const codec = new HPACKCodec();
    const headers = new Map([[":scheme", "https"]]);
    const encoded = codec.encode(headers);
    const decoded = codec.decode(encoded);
    assertEquals(decoded.get(":scheme"), "https");
  },
});

Deno.test({
  name: "HPACKCodec - round-trip preserves :status 200",
  fn() {
    const codec = new HPACKCodec();
    const headers = new Map([[":status", "200"]]);
    const encoded = codec.encode(headers);
    const decoded = codec.decode(encoded);
    assertEquals(decoded.get(":status"), "200");
  },
});

Deno.test({
  name: "HPACKCodec - round-trip preserves custom header",
  fn() {
    const codec = new HPACKCodec();
    const headers = new Map([["x-custom", "my-value"]]);
    const encoded = codec.encode(headers);
    const decoded = codec.decode(encoded);
    assertEquals(decoded.get("x-custom"), "my-value");
  },
});

Deno.test({
  name: "HPACKCodec - round-trip with multiple pseudo and regular headers",
  fn() {
    const codec = new HPACKCodec();
    const headers = new Map([
      [":method", "POST"],
      [":path", "/api/data"],
      [":scheme", "https"],
      ["content-type", "application/json"],
    ]);
    const encoded = codec.encode(headers);
    const decoded = codec.decode(encoded);
    assertEquals(decoded.get(":method"), "POST");
    assertEquals(decoded.get(":path"), "/api/data");
    assertEquals(decoded.get(":scheme"), "https");
    assertEquals(decoded.get("content-type"), "application/json");
  },
});

// ============================================================================
// Multiple calls (dynamic table)
// ============================================================================

Deno.test({
  name: "HPACKCodec - multiple sequential encode/decode calls work correctly",
  fn() {
    const encCodec = new HPACKCodec();
    const decCodec = new HPACKCodec();
    const statuses = ["200", "404", "500"];
    for (const status of statuses) {
      const headers = new Map([[":status", status]]);
      const encoded = encCodec.encode(headers);
      const decoded = decCodec.decode(encoded);
      assertEquals(decoded.get(":status"), status);
    }
  },
});

Deno.test({
  name: "HPACKCodec - encode :method POST round-trips correctly",
  fn() {
    const codec = new HPACKCodec();
    const headers = new Map([[":method", "POST"]]);
    const encoded = codec.encode(headers);
    const decoded = codec.decode(encoded);
    assertEquals(decoded.get(":method"), "POST");
  },
});

// ============================================================================
// Huffman encoding/decoding (RFC 7541 Appendix B)
// ============================================================================

Deno.test({
  name: "Huffman - encodeHuffman/decodeHuffman round-trip for 'www.example.com'",
  fn() {
    const input = "www.example.com";
    const encoded = encodeHuffman(input);
    const decoded = decodeHuffman(encoded);
    assertEquals(decoded, input);
  },
});

Deno.test({
  name: "Huffman - decodes RFC 7541 C.4.1 example: 'www.example.com'",
  fn() {
    // RFC 7541 C.4.1: Huffman encoding of "www.example.com" is:
    // f1e3 c2e5 f23a 6ba0 ab90 f4ff
    const huffBytes = new Uint8Array([
      0xf1, 0xe3, 0xc2, 0xe5, 0xf2, 0x3a, 0x6b, 0xa0, 0xab, 0x90, 0xf4, 0xff,
    ]);
    const decoded = decodeHuffman(huffBytes);
    assertEquals(decoded, "www.example.com");
  },
});

Deno.test({
  name: "Huffman - encodeHuffman/decodeHuffman round-trip for 'no-cache'",
  fn() {
    const input = "no-cache";
    const encoded = encodeHuffman(input);
    const decoded = decodeHuffman(encoded);
    assertEquals(decoded, input);
  },
});

Deno.test({
  name: "Huffman - decodes RFC 7541 C.4.2 example: 'no-cache'",
  fn() {
    // RFC 7541 C.4.2: Huffman encoding of "no-cache" is: a8eb 1064 9cbf
    const huffBytes = new Uint8Array([0xa8, 0xeb, 0x10, 0x64, 0x9c, 0xbf]);
    const decoded = decodeHuffman(huffBytes);
    assertEquals(decoded, "no-cache");
  },
});

Deno.test({
  name: "Huffman - encodeHuffman/decodeHuffman round-trip for 'custom-key'",
  fn() {
    const input = "custom-key";
    const encoded = encodeHuffman(input);
    const decoded = decodeHuffman(encoded);
    assertEquals(decoded, input);
  },
});

Deno.test({
  name: "Huffman - encodeHuffman/decodeHuffman round-trip for 'custom-value'",
  fn() {
    const input = "custom-value";
    const encoded = encodeHuffman(input);
    const decoded = decodeHuffman(encoded);
    assertEquals(decoded, input);
  },
});

Deno.test({
  name: "Huffman - decodes RFC 7541 C.6.1 example: 'custom-key' and 'custom-value'",
  fn() {
    // RFC 7541 C.6.1: "custom-key" = 25a849e95ba97d7f, "custom-value" = 25a849e95bb8e8b4bf
    const keyBytes = new Uint8Array([0x25, 0xa8, 0x49, 0xe9, 0x5b, 0xa9, 0x7d, 0x7f]);
    assertEquals(decodeHuffman(keyBytes), "custom-key");

    const valBytes = new Uint8Array([0x25, 0xa8, 0x49, 0xe9, 0x5b, 0xb8, 0xe8, 0xb4, 0xbf]);
    assertEquals(decodeHuffman(valBytes), "custom-value");
  },
});

Deno.test({
  name: "Huffman - HPACKCodec decodes Huffman-encoded literal header",
  fn() {
    // Build a raw HPACK frame with a Huffman-encoded literal header
    // Format: 0x40 (literal with incremental indexing, new name)
    //         + Huffman-encoded name + Huffman-encoded value
    const nameStr = "x-test";
    const valueStr = "hello";
    const nameHuff = encodeHuffman(nameStr);
    const valueHuff = encodeHuffman(valueStr);

    // Build the HPACK block manually
    const parts: number[] = [];
    // Literal header field with incremental indexing, new name (0100 xxxx, index=0)
    parts.push(0x40);
    // Name: H=1, length
    parts.push(0x80 | nameHuff.length); // H bit set + length (assuming < 127)
    for (const b of nameHuff) parts.push(b);
    // Value: H=1, length
    parts.push(0x80 | valueHuff.length);
    for (const b of valueHuff) parts.push(b);

    const block = new Uint8Array(parts);
    const codec = new HPACKCodec();
    const headers = codec.decode(block);
    assertEquals(headers.get("x-test"), "hello");
  },
});

Deno.test({
  name: "Huffman - encodeHuffman/decodeHuffman round-trip for all printable ASCII",
  fn() {
    const input = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
    const encoded = encodeHuffman(input);
    const decoded = decodeHuffman(encoded);
    assertEquals(decoded, input);
  },
});

Deno.test({
  name: "Huffman - empty string round-trips",
  fn() {
    const encoded = encodeHuffman("");
    assertEquals(encoded.length, 0);
    const decoded = decodeHuffman(encoded);
    assertEquals(decoded, "");
  },
});
