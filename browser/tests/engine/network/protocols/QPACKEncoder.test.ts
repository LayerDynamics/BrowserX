/**
 * QPACKEncoder Tests
 *
 * Comprehensive tests for QPACK header compression.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { QPACKEncoder, QPACKDecoder } from "../../../../src/engine/network/protocols/QPACKEncoder.ts";

// ============================================================================
// QPACKEncoder Constructor Tests
// ============================================================================

Deno.test({
    name: "QPACKEncoder - constructor creates encoder",
    fn() {
        const encoder = new QPACKEncoder();

        assertExists(encoder);
    },
});

Deno.test({
    name: "QPACKEncoder - can create multiple encoders",
    fn() {
        const encoder1 = new QPACKEncoder();
        const encoder2 = new QPACKEncoder();

        assertExists(encoder1);
        assertExists(encoder2);
        assert(encoder1 !== encoder2);
    },
});

// ============================================================================
// QPACKEncoder encode() Tests
// ============================================================================

Deno.test({
    name: "QPACKEncoder - encode returns Uint8Array",
    fn() {
        const encoder = new QPACKEncoder();
        const headers = new Map([[":method", "GET"]]);

        const encoded = encoder.encode(headers);

        assertExists(encoded);
        assert(encoded instanceof Uint8Array);
    },
});

Deno.test({
    name: "QPACKEncoder - encode empty headers",
    fn() {
        const encoder = new QPACKEncoder();
        const headers = new Map();

        const encoded = encoder.encode(headers);

        // Should at least have field section prefix (2 bytes)
        assert(encoded.byteLength >= 2);
    },
});

Deno.test({
    name: "QPACKEncoder - encode single header",
    fn() {
        const encoder = new QPACKEncoder();
        const headers = new Map([[":method", "GET"]]);

        const encoded = encoder.encode(headers);

        assert(encoded.byteLength > 0);
    },
});

Deno.test({
    name: "QPACKEncoder - encode multiple headers",
    fn() {
        const encoder = new QPACKEncoder();
        const headers = new Map([
            [":method", "GET"],
            [":path", "/"],
            [":scheme", "https"],
        ]);

        const encoded = encoder.encode(headers);

        assert(encoded.byteLength > 0);
    },
});

Deno.test({
    name: "QPACKEncoder - encode uses static table",
    fn() {
        const encoder = new QPACKEncoder();

        // Headers that exist in static table
        const headers = new Map([
            [":method", "GET"],
            [":path", "/"],
        ]);

        const encoded = encoder.encode(headers);

        // Should be compact when using static table
        assert(encoded.byteLength < 20);
    },
});

Deno.test({
    name: "QPACKEncoder - encode custom header",
    fn() {
        const encoder = new QPACKEncoder();
        const headers = new Map([["x-custom", "value"]]);

        const encoded = encoder.encode(headers);

        assert(encoded.byteLength > 0);
    },
});

Deno.test({
    name: "QPACKEncoder - encode pseudo-headers",
    fn() {
        const encoder = new QPACKEncoder();
        const headers = new Map([
            [":method", "POST"],
            [":scheme", "https"],
            [":authority", "example.com"],
            [":path", "/api"],
        ]);

        const encoded = encoder.encode(headers);

        assert(encoded.byteLength > 0);
    },
});

// ============================================================================
// QPACKDecoder Constructor Tests
// ============================================================================

Deno.test({
    name: "QPACKDecoder - constructor creates decoder",
    fn() {
        const decoder = new QPACKDecoder();

        assertExists(decoder);
    },
});

Deno.test({
    name: "QPACKDecoder - can create multiple decoders",
    fn() {
        const decoder1 = new QPACKDecoder();
        const decoder2 = new QPACKDecoder();

        assertExists(decoder1);
        assertExists(decoder2);
        assert(decoder1 !== decoder2);
    },
});

// ============================================================================
// QPACKDecoder decode() Tests
// ============================================================================

Deno.test({
    name: "QPACKDecoder - decode returns Map",
    fn() {
        const decoder = new QPACKDecoder();

        // Minimal QPACK data with field section prefix
        const data = new Uint8Array([0, 0]); // Required Insert Count = 0, Delta Base = 0

        const decoded = decoder.decode(data);

        assertExists(decoded);
        assert(decoded instanceof Map);
    },
});

Deno.test({
    name: "QPACKDecoder - decode empty data",
    fn() {
        const decoder = new QPACKDecoder();

        const data = new Uint8Array([0, 0]);
        const decoded = decoder.decode(data);

        assertEquals(decoded.size, 0);
    },
});

// ============================================================================
// Round-trip Encoding/Decoding Tests
// ============================================================================

Deno.test({
    name: "QPACK - round-trip with static table entry",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const original = new Map([[":method", "GET"]]);
        const encoded = encoder.encode(original);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get(":method"), "GET");
    },
});

Deno.test({
    name: "QPACK - round-trip with multiple static entries",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

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
    name: "QPACK - round-trip with custom header",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const original = new Map([["x-custom", "value"]]);
        const encoded = encoder.encode(original);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get("x-custom"), "value");
    },
});

Deno.test({
    name: "QPACK - round-trip with known name, different value",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        // content-type is in static table but with different value
        const original = new Map([["content-type", "application/xml"]]);
        const encoded = encoder.encode(original);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get("content-type"), "application/xml");
    },
});

Deno.test({
    name: "QPACK - round-trip with status codes",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const statuses = ["200", "304", "404", "503"];

        for (const status of statuses) {
            const original = new Map([[":status", status]]);
            const encoded = encoder.encode(original);
            const decoded = decoder.decode(encoded);

            assertEquals(decoded.get(":status"), status);
        }
    },
});

Deno.test({
    name: "QPACK - round-trip with mixed headers",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const original = new Map([
            [":method", "GET"],
            [":scheme", "https"],
            ["accept", "*/*"],
            ["user-agent", "TestAgent/1.0"],
            ["x-custom", "value"],
        ]);

        const encoded = encoder.encode(original);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get(":method"), "GET");
        assertEquals(decoded.get(":scheme"), "https");
        assertEquals(decoded.get("accept"), "*/*");
        assertEquals(decoded.get("user-agent"), "TestAgent/1.0");
        assertEquals(decoded.get("x-custom"), "value");
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "QPACK - typical HTTP/3 request headers",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const headers = new Map([
            [":method", "GET"],
            [":scheme", "https"],
            [":path", "/index.html"],
            [":authority", "example.com"],
            ["user-agent", "Mozilla/5.0"],
            ["accept", "*/*"],
        ]);

        const encoded = encoder.encode(headers);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get(":method"), "GET");
        assertEquals(decoded.get(":scheme"), "https");
        assertEquals(decoded.get(":path"), "/index.html");
        assertEquals(decoded.get(":authority"), "example.com");
        assertEquals(decoded.get("user-agent"), "Mozilla/5.0");
        assertEquals(decoded.get("accept"), "*/*");
    },
});

Deno.test({
    name: "QPACK - typical HTTP/3 response headers",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const headers = new Map([
            [":status", "200"],
            ["content-type", "text/html; charset=utf-8"],
            ["content-length", "1234"],
            ["cache-control", "max-age=0"],
        ]);

        const encoded = encoder.encode(headers);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get(":status"), "200");
        assertEquals(decoded.get("content-type"), "text/html; charset=utf-8");
        assertEquals(decoded.get("content-length"), "1234");
        assertEquals(decoded.get("cache-control"), "max-age=0");
    },
});

Deno.test({
    name: "QPACK - compression efficiency with static table",
    fn() {
        const encoder = new QPACKEncoder();

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
    name: "QPACK - special characters in header values",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

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
    name: "QPACK - empty header values",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

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
    name: "QPACK - long header values",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const longValue = "a".repeat(500);
        const headers = new Map([["x-long", longValue]]);

        const encoded = encoder.encode(headers);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get("x-long"), longValue);
    },
});

Deno.test({
    name: "QPACK - all common HTTP methods",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const methods = ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "CONNECT"];

        for (const method of methods) {
            const headers = new Map([[":method", method]]);
            const encoded = encoder.encode(headers);
            const decoded = decoder.decode(encoded);

            assertEquals(decoded.get(":method"), method);
        }
    },
});

Deno.test({
    name: "QPACK - all common status codes",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const statuses = ["100", "200", "204", "206", "302", "304", "400", "403", "404", "500", "503"];

        for (const status of statuses) {
            const headers = new Map([[":status", status]]);
            const encoded = encoder.encode(headers);
            const decoded = decoder.decode(encoded);

            assertEquals(decoded.get(":status"), status);
        }
    },
});

Deno.test({
    name: "QPACK - independent encoder/decoder instances",
    fn() {
        const encoder1 = new QPACKEncoder();
        const encoder2 = new QPACKEncoder();
        const decoder1 = new QPACKDecoder();
        const decoder2 = new QPACKDecoder();

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
    name: "QPACK - encoding produces deterministic output",
    fn() {
        const headers = new Map([
            [":method", "GET"],
            ["content-type", "text/html"],
        ]);

        // Create two separate encoders
        const encoder1 = new QPACKEncoder();
        const encoded1 = encoder1.encode(headers);

        const encoder2 = new QPACKEncoder();
        const encoded2 = encoder2.encode(headers);

        assertEquals(encoded1.byteLength, encoded2.byteLength);
    },
});

Deno.test({
    name: "QPACK - field section prefix",
    fn() {
        const encoder = new QPACKEncoder();
        const headers = new Map([[":method", "GET"]]);

        const encoded = encoder.encode(headers);

        // First two bytes should be field section prefix
        // (Required Insert Count and Delta Base)
        assertEquals(encoded[0], 0); // Required Insert Count = 0
        assertEquals(encoded[1], 0); // Delta Base = 0
    },
});

Deno.test({
    name: "QPACK - content-type static table entries",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const contentTypes = [
            "application/json",
            "application/javascript",
            "text/html; charset=utf-8",
            "text/plain",
            "image/jpeg",
            "image/png",
        ];

        for (const contentType of contentTypes) {
            const headers = new Map([["content-type", contentType]]);
            const encoded = encoder.encode(headers);
            const decoded = decoder.decode(encoded);

            assertEquals(decoded.get("content-type"), contentType);
        }
    },
});

Deno.test({
    name: "QPACK - cache-control static table entries",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const cacheControls = [
            "max-age=0",
            "no-cache",
            "no-store",
            "public, max-age=31536000",
        ];

        for (const cacheControl of cacheControls) {
            const headers = new Map([["cache-control", cacheControl]]);
            const encoded = encoder.encode(headers);
            const decoded = decoder.decode(encoded);

            assertEquals(decoded.get("cache-control"), cacheControl);
        }
    },
});

Deno.test({
    name: "QPACK - access-control headers",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const headers = new Map([
            ["access-control-allow-origin", "*"],
            ["access-control-allow-methods", "get, post, options"],
            ["access-control-allow-credentials", "TRUE"],
        ]);

        const encoded = encoder.encode(headers);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get("access-control-allow-origin"), "*");
        assertEquals(decoded.get("access-control-allow-methods"), "get, post, options");
        assertEquals(decoded.get("access-control-allow-credentials"), "TRUE");
    },
});

Deno.test({
    name: "QPACK - security headers",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const headers = new Map([
            ["strict-transport-security", "max-age=31536000"],
            ["x-content-type-options", "nosniff"],
            ["x-frame-options", "deny"],
            ["x-xss-protection", "1; mode=block"],
        ]);

        const encoded = encoder.encode(headers);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get("strict-transport-security"), "max-age=31536000");
        assertEquals(decoded.get("x-content-type-options"), "nosniff");
        assertEquals(decoded.get("x-frame-options"), "deny");
        assertEquals(decoded.get("x-xss-protection"), "1; mode=block");
    },
});

Deno.test({
    name: "QPACK - multiple sequential requests",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

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
    name: "QPACK - header with colon in value",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const headers = new Map([
            ["date", "Mon, 01 Jan 2024 12:00:00 GMT"],
        ]);

        const encoded = encoder.encode(headers);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get("date"), "Mon, 01 Jan 2024 12:00:00 GMT");
    },
});

Deno.test({
    name: "QPACK - unicode in header values",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const headers = new Map([
            ["x-unicode", "Hello 世界 🌍"],
        ]);

        const encoded = encoder.encode(headers);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get("x-unicode"), "Hello 世界 🌍");
    },
});

Deno.test({
    name: "QPACK - large number of headers",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const headers = new Map<string, string>();
        for (let i = 0; i < 20; i++) {
            headers.set(`x-header-${i}`, `value-${i}`);
        }

        const encoded = encoder.encode(headers);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.size, 20);
        for (let i = 0; i < 20; i++) {
            assertEquals(decoded.get(`x-header-${i}`), `value-${i}`);
        }
    },
});

Deno.test({
    name: "QPACK - accept-encoding header",
    fn() {
        const encoder = new QPACKEncoder();
        const decoder = new QPACKDecoder();

        const headers = new Map([
            ["accept-encoding", "gzip, deflate, br"],
        ]);

        const encoded = encoder.encode(headers);
        const decoded = decoder.decode(encoded);

        assertEquals(decoded.get("accept-encoding"), "gzip, deflate, br");
    },
});
