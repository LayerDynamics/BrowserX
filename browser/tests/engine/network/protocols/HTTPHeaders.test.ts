/**
 * HTTPHeaders Tests
 *
 * Comprehensive tests for HTTP header parsing and utilities.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { HTTPHeaderParser, type HTTPHeaders } from "../../../../src/engine/network/protocols/HTTPHeaders.ts";

// ============================================================================
// HTTPHeaderParser parseHeaders() Tests
// ============================================================================

Deno.test({
    name: "HTTPHeaderParser - parseHeaders parses single header",
    fn() {
        const headerBytes = new TextEncoder().encode("Content-Type: text/html\r\n\r\n");

        const headers = HTTPHeaderParser.parseHeaders(headerBytes);

        assertEquals(headers.get("content-type"), "text/html");
    },
});

Deno.test({
    name: "HTTPHeaderParser - parseHeaders parses multiple headers",
    fn() {
        const headerBytes = new TextEncoder().encode(
            "Content-Type: text/html\r\n" +
            "Content-Length: 1234\r\n" +
            "Host: example.com\r\n\r\n"
        );

        const headers = HTTPHeaderParser.parseHeaders(headerBytes);

        assertEquals(headers.get("content-type"), "text/html");
        assertEquals(headers.get("content-length"), "1234");
        assertEquals(headers.get("host"), "example.com");
    },
});

Deno.test({
    name: "HTTPHeaderParser - parseHeaders normalizes header names to lowercase",
    fn() {
        const headerBytes = new TextEncoder().encode("Content-Type: text/html\r\n\r\n");

        const headers = HTTPHeaderParser.parseHeaders(headerBytes);

        assertEquals(headers.get("content-type"), "text/html");
        assertEquals(headers.get("Content-Type"), undefined);
    },
});

Deno.test({
    name: "HTTPHeaderParser - parseHeaders trims whitespace",
    fn() {
        const headerBytes = new TextEncoder().encode("  Content-Type  :  text/html  \r\n\r\n");

        const headers = HTTPHeaderParser.parseHeaders(headerBytes);

        assertEquals(headers.get("content-type"), "text/html");
    },
});

Deno.test({
    name: "HTTPHeaderParser - parseHeaders handles empty input",
    fn() {
        const headerBytes = new TextEncoder().encode("\r\n");

        const headers = HTTPHeaderParser.parseHeaders(headerBytes);

        assertEquals(headers.size, 0);
    },
});

Deno.test({
    name: "HTTPHeaderParser - parseHeaders skips invalid lines",
    fn() {
        const headerBytes = new TextEncoder().encode(
            "Content-Type: text/html\r\n" +
            "InvalidLineWithoutColon\r\n" +
            "Host: example.com\r\n\r\n"
        );

        const headers = HTTPHeaderParser.parseHeaders(headerBytes);

        assertEquals(headers.size, 2);
        assertEquals(headers.get("content-type"), "text/html");
        assertEquals(headers.get("host"), "example.com");
    },
});

Deno.test({
    name: "HTTPHeaderParser - parseHeaders handles duplicate header names",
    fn() {
        const headerBytes = new TextEncoder().encode(
            "Set-Cookie: cookie1=value1\r\n" +
            "Set-Cookie: cookie2=value2\r\n\r\n"
        );

        const headers = HTTPHeaderParser.parseHeaders(headerBytes);

        // Duplicates are combined with comma
        assertEquals(headers.get("set-cookie"), "cookie1=value1, cookie2=value2");
    },
});

Deno.test({
    name: "HTTPHeaderParser - parseHeaders handles headers with colons in value",
    fn() {
        const headerBytes = new TextEncoder().encode("Date: Mon, 01 Jan 2024 12:00:00 GMT\r\n\r\n");

        const headers = HTTPHeaderParser.parseHeaders(headerBytes);

        assertEquals(headers.get("date"), "Mon, 01 Jan 2024 12:00:00 GMT");
    },
});

Deno.test({
    name: "HTTPHeaderParser - parseHeaders handles empty header value",
    fn() {
        const headerBytes = new TextEncoder().encode("X-Empty:\r\n\r\n");

        const headers = HTTPHeaderParser.parseHeaders(headerBytes);

        assertEquals(headers.get("x-empty"), "");
    },
});

// ============================================================================
// HTTPHeaderParser serializeHeaders() Tests
// ============================================================================

Deno.test({
    name: "HTTPHeaderParser - serializeHeaders creates proper format",
    fn() {
        const headers = new Map([
            ["content-type", "text/html"],
            ["host", "example.com"],
        ]);

        const serialized = HTTPHeaderParser.serializeHeaders(headers);
        const text = new TextDecoder().decode(serialized);

        assert(text.includes("content-type: text/html"));
        assert(text.includes("host: example.com"));
        assert(text.endsWith("\r\n\r\n"));
    },
});

Deno.test({
    name: "HTTPHeaderParser - serializeHeaders creates CRLF line endings",
    fn() {
        const headers = new Map([["content-type", "text/html"]]);

        const serialized = HTTPHeaderParser.serializeHeaders(headers);
        const text = new TextDecoder().decode(serialized);

        assert(text.includes("\r\n"));
    },
});

Deno.test({
    name: "HTTPHeaderParser - serializeHeaders ends with double CRLF",
    fn() {
        const headers = new Map([["content-type", "text/html"]]);

        const serialized = HTTPHeaderParser.serializeHeaders(headers);
        const text = new TextDecoder().decode(serialized);

        assert(text.endsWith("\r\n\r\n"));
    },
});

Deno.test({
    name: "HTTPHeaderParser - serializeHeaders handles empty headers",
    fn() {
        const headers = new Map();

        const serialized = HTTPHeaderParser.serializeHeaders(headers);
        const text = new TextDecoder().decode(serialized);

        assertEquals(text, "\r\n\r\n");
    },
});

Deno.test({
    name: "HTTPHeaderParser - serializeHeaders round-trip",
    fn() {
        const original = new Map([
            ["content-type", "application/json"],
            ["content-length", "42"],
        ]);

        const serialized = HTTPHeaderParser.serializeHeaders(original);
        const parsed = HTTPHeaderParser.parseHeaders(serialized);

        assertEquals(parsed.get("content-type"), "application/json");
        assertEquals(parsed.get("content-length"), "42");
    },
});

// ============================================================================
// HTTPHeaderParser parseHeaderValue() Tests
// ============================================================================

Deno.test({
    name: "HTTPHeaderParser - parseHeaderValue parses list",
    fn() {
        const value = "gzip, deflate, br";

        const parsed = HTTPHeaderParser.parseHeaderValue(value, "list");

        assert(Array.isArray(parsed));
        assertEquals((parsed as string[]).length, 3);
        assertEquals((parsed as string[])[0], "gzip");
        assertEquals((parsed as string[])[1], "deflate");
        assertEquals((parsed as string[])[2], "br");
    },
});

Deno.test({
    name: "HTTPHeaderParser - parseHeaderValue parses dict",
    fn() {
        const value = "max-age=3600, public";

        const parsed = HTTPHeaderParser.parseHeaderValue(value, "dict") as Record<string, string>;

        assertEquals(parsed["max-age"], "3600");
        assertEquals(parsed["public"], "true");
    },
});

Deno.test({
    name: "HTTPHeaderParser - parseHeaderValue parses int",
    fn() {
        const value = "1234";

        const parsed = HTTPHeaderParser.parseHeaderValue(value, "int");

        assertEquals(parsed, 1234);
    },
});

Deno.test({
    name: "HTTPHeaderParser - parseHeaderValue parses date",
    fn() {
        const value = "Wed, 21 Oct 2015 07:28:00 GMT";

        const parsed = HTTPHeaderParser.parseHeaderValue(value, "date");

        assert(parsed instanceof Date);
        assertEquals((parsed as Date).getUTCFullYear(), 2015);
    },
});

Deno.test({
    name: "HTTPHeaderParser - parseHeaderValue handles empty list",
    fn() {
        const value = "";

        const parsed = HTTPHeaderParser.parseHeaderValue(value, "list");

        assert(Array.isArray(parsed));
        assertEquals((parsed as string[]).length, 1);
        assertEquals((parsed as string[])[0], "");
    },
});

Deno.test({
    name: "HTTPHeaderParser - parseHeaderValue handles whitespace in list",
    fn() {
        const value = "value1 , value2 , value3";

        const parsed = HTTPHeaderParser.parseHeaderValue(value, "list") as string[];

        assertEquals(parsed[0], "value1");
        assertEquals(parsed[1], "value2");
        assertEquals(parsed[2], "value3");
    },
});

// ============================================================================
// HTTPHeaderParser getHeader() Tests
// ============================================================================

Deno.test({
    name: "HTTPHeaderParser - getHeader retrieves header",
    fn() {
        const headers = new Map([["content-type", "text/html"]]);

        const value = HTTPHeaderParser.getHeader(headers, "content-type");

        assertEquals(value, "text/html");
    },
});

Deno.test({
    name: "HTTPHeaderParser - getHeader is case-insensitive",
    fn() {
        const headers = new Map([["content-type", "text/html"]]);

        assertEquals(HTTPHeaderParser.getHeader(headers, "Content-Type"), "text/html");
        assertEquals(HTTPHeaderParser.getHeader(headers, "CONTENT-TYPE"), "text/html");
    },
});

Deno.test({
    name: "HTTPHeaderParser - getHeader returns undefined for missing header",
    fn() {
        const headers = new Map();

        const value = HTTPHeaderParser.getHeader(headers, "content-type");

        assertEquals(value, undefined);
    },
});

// ============================================================================
// HTTPHeaderParser setHeader() Tests
// ============================================================================

Deno.test({
    name: "HTTPHeaderParser - setHeader sets header",
    fn() {
        const headers = new Map();

        HTTPHeaderParser.setHeader(headers, "content-type", "text/html");

        assertEquals(headers.get("content-type"), "text/html");
    },
});

Deno.test({
    name: "HTTPHeaderParser - setHeader normalizes to lowercase",
    fn() {
        const headers = new Map();

        HTTPHeaderParser.setHeader(headers, "Content-Type", "text/html");

        assertEquals(headers.get("content-type"), "text/html");
    },
});

Deno.test({
    name: "HTTPHeaderParser - setHeader overwrites existing value",
    fn() {
        const headers = new Map([["content-type", "text/plain"]]);

        HTTPHeaderParser.setHeader(headers, "content-type", "text/html");

        assertEquals(headers.get("content-type"), "text/html");
    },
});

// ============================================================================
// HTTPHeaderParser hasHeader() Tests
// ============================================================================

Deno.test({
    name: "HTTPHeaderParser - hasHeader returns true for existing header",
    fn() {
        const headers = new Map([["content-type", "text/html"]]);

        assertEquals(HTTPHeaderParser.hasHeader(headers, "content-type"), true);
    },
});

Deno.test({
    name: "HTTPHeaderParser - hasHeader is case-insensitive",
    fn() {
        const headers = new Map([["content-type", "text/html"]]);

        assertEquals(HTTPHeaderParser.hasHeader(headers, "Content-Type"), true);
        assertEquals(HTTPHeaderParser.hasHeader(headers, "CONTENT-TYPE"), true);
    },
});

Deno.test({
    name: "HTTPHeaderParser - hasHeader returns false for missing header",
    fn() {
        const headers = new Map();

        assertEquals(HTTPHeaderParser.hasHeader(headers, "content-type"), false);
    },
});

// ============================================================================
// HTTPHeaderParser deleteHeader() Tests
// ============================================================================

Deno.test({
    name: "HTTPHeaderParser - deleteHeader removes header",
    fn() {
        const headers = new Map([["content-type", "text/html"]]);

        const deleted = HTTPHeaderParser.deleteHeader(headers, "content-type");

        assertEquals(deleted, true);
        assertEquals(headers.size, 0);
    },
});

Deno.test({
    name: "HTTPHeaderParser - deleteHeader is case-insensitive",
    fn() {
        const headers = new Map([["content-type", "text/html"]]);

        const deleted = HTTPHeaderParser.deleteHeader(headers, "Content-Type");

        assertEquals(deleted, true);
        assertEquals(headers.size, 0);
    },
});

Deno.test({
    name: "HTTPHeaderParser - deleteHeader returns false for missing header",
    fn() {
        const headers = new Map();

        const deleted = HTTPHeaderParser.deleteHeader(headers, "content-type");

        assertEquals(deleted, false);
    },
});

// ============================================================================
// HTTPHeaderParser createHeaders() Tests
// ============================================================================

Deno.test({
    name: "HTTPHeaderParser - createHeaders creates empty map",
    fn() {
        const headers = HTTPHeaderParser.createHeaders();

        assertExists(headers);
        assert(headers instanceof Map);
        assertEquals(headers.size, 0);
    },
});

Deno.test({
    name: "HTTPHeaderParser - createHeaders creates independent maps",
    fn() {
        const headers1 = HTTPHeaderParser.createHeaders();
        const headers2 = HTTPHeaderParser.createHeaders();

        headers1.set("test", "value");

        assertEquals(headers1.size, 1);
        assertEquals(headers2.size, 0);
    },
});

// ============================================================================
// HTTPHeaderParser cloneHeaders() Tests
// ============================================================================

Deno.test({
    name: "HTTPHeaderParser - cloneHeaders creates copy",
    fn() {
        const original = new Map([
            ["content-type", "text/html"],
            ["host", "example.com"],
        ]);

        const cloned = HTTPHeaderParser.cloneHeaders(original);

        assertEquals(cloned.size, 2);
        assertEquals(cloned.get("content-type"), "text/html");
        assertEquals(cloned.get("host"), "example.com");
    },
});

Deno.test({
    name: "HTTPHeaderParser - cloneHeaders creates independent copy",
    fn() {
        const original = new Map([["content-type", "text/html"]]);

        const cloned = HTTPHeaderParser.cloneHeaders(original);
        cloned.set("host", "example.com");

        assertEquals(original.size, 1);
        assertEquals(cloned.size, 2);
    },
});

Deno.test({
    name: "HTTPHeaderParser - cloneHeaders handles empty map",
    fn() {
        const original = new Map();

        const cloned = HTTPHeaderParser.cloneHeaders(original);

        assertEquals(cloned.size, 0);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "HTTPHeaders - complete workflow",
    fn() {
        // Create headers
        const headers = HTTPHeaderParser.createHeaders();

        // Set headers
        HTTPHeaderParser.setHeader(headers, "Content-Type", "application/json");
        HTTPHeaderParser.setHeader(headers, "Content-Length", "42");

        // Check headers
        assert(HTTPHeaderParser.hasHeader(headers, "content-type"));
        assertEquals(HTTPHeaderParser.getHeader(headers, "content-length"), "42");

        // Serialize
        const serialized = HTTPHeaderParser.serializeHeaders(headers);

        // Parse back
        const parsed = HTTPHeaderParser.parseHeaders(serialized);

        assertEquals(parsed.get("content-type"), "application/json");
        assertEquals(parsed.get("content-length"), "42");
    },
});

Deno.test({
    name: "HTTPHeaders - typical HTTP request headers",
    fn() {
        const headerBytes = new TextEncoder().encode(
            "Host: www.example.com\r\n" +
            "User-Agent: Mozilla/5.0\r\n" +
            "Accept: text/html,application/xhtml+xml\r\n" +
            "Accept-Language: en-US,en;q=0.5\r\n" +
            "Accept-Encoding: gzip, deflate\r\n" +
            "Connection: keep-alive\r\n\r\n"
        );

        const headers = HTTPHeaderParser.parseHeaders(headerBytes);

        assertEquals(headers.get("host"), "www.example.com");
        assertEquals(headers.get("user-agent"), "Mozilla/5.0");
        assertEquals(headers.get("accept"), "text/html,application/xhtml+xml");
        assertEquals(headers.get("connection"), "keep-alive");
    },
});

Deno.test({
    name: "HTTPHeaders - typical HTTP response headers",
    fn() {
        const headerBytes = new TextEncoder().encode(
            "Content-Type: text/html; charset=UTF-8\r\n" +
            "Content-Length: 1234\r\n" +
            "Date: Mon, 01 Jan 2024 12:00:00 GMT\r\n" +
            "Server: Apache/2.4.41\r\n" +
            "Cache-Control: max-age=3600\r\n\r\n"
        );

        const headers = HTTPHeaderParser.parseHeaders(headerBytes);

        assertEquals(headers.get("content-type"), "text/html; charset=UTF-8");
        assertEquals(headers.get("content-length"), "1234");
        assertEquals(headers.get("server"), "Apache/2.4.41");
    },
});

Deno.test({
    name: "HTTPHeaders - case-insensitive operations",
    fn() {
        const headers = HTTPHeaderParser.createHeaders();

        HTTPHeaderParser.setHeader(headers, "Content-Type", "text/html");

        assert(HTTPHeaderParser.hasHeader(headers, "content-type"));
        assert(HTTPHeaderParser.hasHeader(headers, "Content-Type"));
        assert(HTTPHeaderParser.hasHeader(headers, "CONTENT-TYPE"));

        assertEquals(HTTPHeaderParser.getHeader(headers, "content-type"), "text/html");
        assertEquals(HTTPHeaderParser.getHeader(headers, "Content-Type"), "text/html");

        HTTPHeaderParser.deleteHeader(headers, "CONTENT-TYPE");
        assertEquals(headers.size, 0);
    },
});

Deno.test({
    name: "HTTPHeaders - parsing special header values",
    fn() {
        // List value
        const acceptEncoding = HTTPHeaderParser.parseHeaderValue("gzip, deflate, br", "list");
        assertEquals((acceptEncoding as string[]).length, 3);

        // Dict value
        const cacheControl = HTTPHeaderParser.parseHeaderValue("max-age=3600, public", "dict") as Record<string, string>;
        assertEquals(cacheControl["max-age"], "3600");

        // Int value
        const contentLength = HTTPHeaderParser.parseHeaderValue("1234", "int");
        assertEquals(contentLength, 1234);

        // Date value
        const date = HTTPHeaderParser.parseHeaderValue("Mon, 01 Jan 2024 12:00:00 GMT", "date");
        assert(date instanceof Date);
    },
});
