/**
 * HPACKEncoder Tests
 *
 * Comprehensive tests for HPACK header compression.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { HPACKEncoder, HPACKDecoder } from "../../../../src/engine/network/protocols/HPACKEncoder.ts";

// ============================================================================
// HPACKEncoder Constructor Tests
// ============================================================================

Deno.test({
    name: "HPACKEncoder - constructor creates encoder",
    fn() {
        const encoder = new HPACKEncoder();

        assertExists(encoder);
    },
});

Deno.test({
    name: "HPACKEncoder - can create multiple encoders",
    fn() {
        const encoder1 = new HPACKEncoder();
        const encoder2 = new HPACKEncoder();

        assertExists(encoder1);
        assertExists(encoder2);
        assert(encoder1 !== encoder2);
    },
});

// ============================================================================
// HPACKEncoder encode() Tests
// ============================================================================

Deno.test({
    name: "HPACKEncoder - encode returns Uint8Array",
    fn() {
        const encoder = new HPACKEncoder();
        const headers = new Map([["content-type", "text/html"]]);

        const encoded = encoder.encode(headers);

        assertExists(encoded);
        assert(encoded instanceof Uint8Array);
    },
});

Deno.test({
    name: "HPACKEncoder - encode empty headers",
    fn() {
        const encoder = new HPACKEncoder();
        const headers = new Map();

        const encoded = encoder.encode(headers);

        assertEquals(encoded.byteLength, 0);
    },
});

Deno.test({
    name: "HPACKEncoder - encode single header",
    fn() {
        const encoder = new HPACKEncoder();
        const headers = new Map([["content-type", "text/html"]]);

        const encoded = encoder.encode(headers);

        assert(encoded.byteLength > 0);
    },
});

Deno.test({
    name: "HPACKEncoder - encode multiple headers",
    fn() {
        const encoder = new HPACKEncoder();
        const headers = new Map([
            ["content-type", "text/html"],
            ["content-length", "1234"],
            ["user-agent", "test"],
        ]);

        const encoded = encoder.encode(headers);

        assert(encoded.byteLength > 0);
    },
});

Deno.test({
    name: "HPACKEncoder - encode common method GET",
    fn() {
        const encoder = new HPACKEncoder();
        const headers = new Map([[":method", "GET"]]);

        const encoded = encoder.encode(headers);

        // :method GET is in static table at index 2
        // Should use indexed representation (1xxxxxxx)
        assert(encoded.byteLength > 0);
    },
});

Deno.test({
    name: "HPACKEncoder - encode common method POST",
    fn() {
        const encoder = new HPACKEncoder();
        const headers = new Map([[":method", "POST"]]);

        const encoded = encoder.encode(headers);

        assert(encoded.byteLength > 0);
    },
});

Deno.test({
    name: "HPACKEncoder - encode common status 200",
    fn() {
        const encoder = new HPACKEncoder();
        const headers = new Map([[":status", "200"]]);

        const encoded = encoder.encode(headers);

        assert(encoded.byteLength > 0);
    },
});

Deno.test({
    name: "HPACKEncoder - encode custom header",
    fn() {
        const encoder = new HPACKEncoder();
        const headers = new Map([["x-custom-header", "custom-value"]]);

        const encoded = encoder.encode(headers);

        assert(encoded.byteLength > 0);
    },
});

Deno.test({
    name: "HPACKEncoder - encode uses static table",
    fn() {
        const encoder = new HPACKEncoder();
        const headers = new Map([
            [":method", "GET"],
            [":path", "/"],
            [":scheme", "https"],
        ]);

        const encoded = encoder.encode(headers);

        // All these are in static table, should be compact
        assert(encoded.byteLength < 10);
    },
});

Deno.test({
    name: "HPACKEncoder - encode same header twice",
    fn() {
        const encoder = new HPACKEncoder();

        const headers1 = new Map([["content-type", "text/html"]]);
        encoder.encode(headers1);

        const headers2 = new Map([["content-type", "text/html"]]);
        const encoded2 = encoder.encode(headers2);

        // Second encoding should use dynamic table
        assert(encoded2.byteLength > 0);
    },
});

// ============================================================================
// HPACKDecoder Constructor Tests
// ============================================================================

Deno.test({
    name: "HPACKDecoder - constructor creates decoder",
    fn() {
        const decoder = new HPACKDecoder();

        assertExists(decoder);
    },
});

Deno.test({
    name: "HPACKDecoder - can create multiple decoders",
    fn() {
        const decoder1 = new HPACKDecoder();
        const decoder2 = new HPACKDecoder();

        assertExists(decoder1);
        assertExists(decoder2);
        assert(decoder1 !== decoder2);
    },
});

// ============================================================================
// HPACKDecoder decode() Tests
// ============================================================================

Deno.test({
    name: "HPACKDecoder - decode returns Map",
    fn() {
        const decoder = new HPACKDecoder();
        const data = new Uint8Array([0x82]); // :method GET

        const decoded = decoder.decode(data);

        assertExists(decoded);
        assert(decoded instanceof Map);
    },
});

Deno.test({
    name: "HPACKDecoder - decode empty data",
    fn() {
        const decoder = new HPACKDecoder();
        const data = new Uint8Array([]);

        const decoded = decoder.decode(data);

        assertEquals(decoded.size, 0);
    },
});

Deno.test({
    name: "HPACKDecoder - decode indexed header from static table",
    fn() {
        const decoder = new HPACKDecoder();
        const data = new Uint8Array([0x82]); // Index 2 = :method GET

        const decoded = decoder.decode(data);

        assertEquals(decoded.get(":method"), "GET");
    },
});

Deno.test({
    name: "HPACKDecoder - decode multiple indexed headers",
    fn() {
        const decoder = new HPACKDecoder();
        // 0x82 = :method GET (index 2)
        // 0x84 = :path / (index 4)
        const data = new Uint8Array([0x82, 0x84]);

        const decoded = decoder.decode(data);

        assertEquals(decoded.get(":method"), "GET");
        assertEquals(decoded.get(":path"), "/");
    },
});

// ============================================================================
// Round-trip Encoding/Decoding Tests
// ============================================================================

Deno.test({
    name: "HPACK - round-trip with static table entry",
    fn() {
        const encoder = new HPACKEncoder();
        const decoder = new HPACKDecoder();

        const original = new Map([[":method", "GET"]]);
        const encoded = encoder.encode(original);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get(":method"), "GET");
    },
});

Deno.test({
    name: "HPACK - round-trip with multiple static entries",
    fn() {
        const encoder = new HPACKEncoder();
        const decoder = new HPACKDecoder();

        const original = new Map([
            [":method", "POST"],
            [":path", "/"],
            [":scheme", "https"],
        ]);

        const encoded = encoder.encode(original);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get(":method"), "POST");
        assertEquals(decoded.get(":path"), "/");
        assertEquals(decoded.get(":scheme"), "https");
    },
});

Deno.test({
    name: "HPACK - round-trip with custom header",
    fn() {
        const encoder = new HPACKEncoder();
        const decoder = new HPACKDecoder();

        const original = new Map([["x-custom", "value"]]);
        const encoded = encoder.encode(original);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get("x-custom"), "value");
    },
});

Deno.test({
    name: "HPACK - round-trip with known name, different value",
    fn() {
        const encoder = new HPACKEncoder();
        const decoder = new HPACKDecoder();

        // content-type is in static table but with empty value
        const original = new Map([["content-type", "application/json"]]);
        const encoded = encoder.encode(original);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get("content-type"), "application/json");
    },
});

Deno.test({
    name: "HPACK - round-trip with status codes",
    fn() {
        const encoder = new HPACKEncoder();
        const decoder = new HPACKDecoder();

        const statuses = ["200", "204", "404", "500"];

        for (const status of statuses) {
            const original = new Map([[":status", status]]);
            const encoded = encoder.encode(original);
            const decoded = decoder.decode(encoded);

            assertEquals(decoded.get(":status"), status);
        }
    },
});

Deno.test({
    name: "HPACK - dynamic table reuse",
    fn() {
        const encoder = new HPACKEncoder();
        const decoder = new HPACKDecoder();

        // First encoding adds to dynamic table
        const headers1 = new Map([["x-custom", "value1"]]);
        const encoded1 = encoder.encode(headers1);
        const decoded1 = decoder.decode(encoded1);

        // Second encoding with same header should use dynamic table
        const headers2 = new Map([["x-custom", "value1"]]);
        const encoded2 = encoder.encode(headers2);
        const decoded2 = decoder.decode(encoded2);

        assertEquals(decoded1.get("x-custom"), "value1");
        assertEquals(decoded2.get("x-custom"), "value1");

        // Second encoding should be smaller (uses index)
        assert(encoded2.byteLength <= encoded1.byteLength);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "HPACK - typical HTTP/2 request headers",
    fn() {
        const encoder = new HPACKEncoder();
        const decoder = new HPACKDecoder();

        const headers = new Map([
            [":method", "GET"],
            [":scheme", "https"],
            [":path", "/index.html"],
            [":authority", "example.com"],
            ["user-agent", "Mozilla/5.0"],
            ["accept", "text/html"],
        ]);

        const encoded = encoder.encode(headers);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get(":method"), "GET");
        assertEquals(decoded.get(":scheme"), "https");
        assertEquals(decoded.get(":path"), "/index.html");
        assertEquals(decoded.get(":authority"), "example.com");
        assertEquals(decoded.get("user-agent"), "Mozilla/5.0");
        assertEquals(decoded.get("accept"), "text/html");
    },
});

Deno.test({
    name: "HPACK - typical HTTP/2 response headers",
    fn() {
        const encoder = new HPACKEncoder();
        const decoder = new HPACKDecoder();

        const headers = new Map([
            [":status", "200"],
            ["content-type", "text/html; charset=utf-8"],
            ["content-length", "1234"],
            ["cache-control", "max-age=3600"],
        ]);

        const encoded = encoder.encode(headers);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get(":status"), "200");
        assertEquals(decoded.get("content-type"), "text/html; charset=utf-8");
        assertEquals(decoded.get("content-length"), "1234");
        assertEquals(decoded.get("cache-control"), "max-age=3600");
    },
});

Deno.test({
    name: "HPACK - compression efficiency with static table",
    fn() {
        const encoder = new HPACKEncoder();

        // Headers that are in static table
        const staticHeaders = new Map([
            [":method", "GET"],
            [":path", "/"],
            [":scheme", "https"],
        ]);

        // Headers that are not in static table
        const customHeaders = new Map([
            ["x-custom-1", "value1"],
            ["x-custom-2", "value2"],
            ["x-custom-3", "value3"],
        ]);

        const encodedStatic = encoder.encode(staticHeaders);
        const encodedCustom = encoder.encode(customHeaders);

        // Static table headers should be more compact
        assert(encodedStatic.byteLength < encodedCustom.byteLength);
    },
});

Deno.test({
    name: "HPACK - multiple sequential requests",
    fn() {
        const encoder = new HPACKEncoder();
        const decoder = new HPACKDecoder();

        const requests = [
            new Map([[":method", "GET"], [":path", "/page1"]]),
            new Map([[":method", "GET"], [":path", "/page2"]]),
            new Map([[":method", "POST"], [":path", "/api"]]),
        ];

        for (const request of requests) {
            const encoded = encoder.encode(request);
            const decoded = decoder.decode(encoded);

            assertEquals(decoded.get(":method"), request.get(":method"));
            assertEquals(decoded.get(":path"), request.get(":path"));
        }
    },
});

Deno.test({
    name: "HPACK - special characters in header values",
    fn() {
        const encoder = new HPACKEncoder();
        const decoder = new HPACKDecoder();

        const headers = new Map([
            ["content-type", "text/html; charset=utf-8"],
            ["x-custom", "value with spaces and !@#$%"],
        ]);

        const encoded = encoder.encode(headers);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get("content-type"), "text/html; charset=utf-8");
        assertEquals(decoded.get("x-custom"), "value with spaces and !@#$%");
    },
});

Deno.test({
    name: "HPACK - empty header values",
    fn() {
        const encoder = new HPACKEncoder();
        const decoder = new HPACKDecoder();

        const headers = new Map([
            ["x-empty", ""],
            ["content-length", "0"],
        ]);

        const encoded = encoder.encode(headers);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get("x-empty"), "");
        assertEquals(decoded.get("content-length"), "0");
    },
});

Deno.test({
    name: "HPACK - long header values",
    fn() {
        const encoder = new HPACKEncoder();
        const decoder = new HPACKDecoder();

        const longValue = "a".repeat(1000);
        const headers = new Map([["x-long", longValue]]);

        const encoded = encoder.encode(headers);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get("x-long"), longValue);
    },
});

Deno.test({
    name: "HPACK - all common HTTP methods",
    fn() {
        const encoder = new HPACKEncoder();
        const decoder = new HPACKDecoder();

        const methods = ["GET", "POST"];

        for (const method of methods) {
            const headers = new Map([[":method", method]]);
            const encoded = encoder.encode(headers);
            const decoded = decoder.decode(encoded);

            assertEquals(decoded.get(":method"), method);
        }
    },
});

Deno.test({
    name: "HPACK - all common status codes",
    fn() {
        const encoder = new HPACKEncoder();
        const decoder = new HPACKDecoder();

        const statuses = ["200", "204", "206", "304", "400", "404", "500"];

        for (const status of statuses) {
            const headers = new Map([[":status", status]]);
            const encoded = encoder.encode(headers);
            const decoded = decoder.decode(encoded);

            assertEquals(decoded.get(":status"), status);
        }
    },
});

Deno.test({
    name: "HPACK - independent encoder/decoder instances",
    fn() {
        const encoder1 = new HPACKEncoder();
        const encoder2 = new HPACKEncoder();
        const decoder1 = new HPACKDecoder();
        const decoder2 = new HPACKDecoder();

        const headers = new Map([["x-test", "value"]]);

        const encoded1 = encoder1.encode(headers);
        const encoded2 = encoder2.encode(headers);

        const decoded1 = decoder1.decode(encoded1);
        const decoded2 = decoder2.decode(encoded2);

        assertEquals(decoded1.get("x-test"), "value");
        assertEquals(decoded2.get("x-test"), "value");
    },
});

Deno.test({
    name: "HPACK - encoding produces deterministic output",
    fn() {
        const encoder = new HPACKEncoder();

        const headers = new Map([
            [":method", "GET"],
            ["content-type", "text/html"],
        ]);

        const encoded1 = encoder.encode(headers);

        // Create new encoder for comparison
        const encoder2 = new HPACKEncoder();
        const encoded2 = encoder2.encode(headers);

        assertEquals(encoded1.byteLength, encoded2.byteLength);
    },
});
