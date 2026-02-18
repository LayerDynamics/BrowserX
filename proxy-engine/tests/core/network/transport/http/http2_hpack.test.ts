/**
 * HPACK Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { HPACKCodec } from "../../../../../core/network/transport/http/http2_hpack.ts";

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
