/**
 * HTTPRequestParser Tests
 *
 * Comprehensive tests for HTTP request parsing and serialization.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    HTTPRequestParser,
    HTTPMethod,
    type HTTPRequest,
} from "../../../../src/engine/network/protocols/HTTPRequestParser.ts";
import { HTTPHeaderParser } from "../../../../src/engine/network/protocols/HTTPHeaders.ts";

// ============================================================================
// HTTPMethod Enum Tests
// ============================================================================

Deno.test({
    name: "HTTPMethod - has GET",
    fn() {
        assertEquals(HTTPMethod.GET, "GET");
    },
});

Deno.test({
    name: "HTTPMethod - has POST",
    fn() {
        assertEquals(HTTPMethod.POST, "POST");
    },
});

Deno.test({
    name: "HTTPMethod - has PUT",
    fn() {
        assertEquals(HTTPMethod.PUT, "PUT");
    },
});

Deno.test({
    name: "HTTPMethod - has DELETE",
    fn() {
        assertEquals(HTTPMethod.DELETE, "DELETE");
    },
});

Deno.test({
    name: "HTTPMethod - has HEAD",
    fn() {
        assertEquals(HTTPMethod.HEAD, "HEAD");
    },
});

Deno.test({
    name: "HTTPMethod - has OPTIONS",
    fn() {
        assertEquals(HTTPMethod.OPTIONS, "OPTIONS");
    },
});

Deno.test({
    name: "HTTPMethod - has PATCH",
    fn() {
        assertEquals(HTTPMethod.PATCH, "PATCH");
    },
});

Deno.test({
    name: "HTTPMethod - has CONNECT",
    fn() {
        assertEquals(HTTPMethod.CONNECT, "CONNECT");
    },
});

Deno.test({
    name: "HTTPMethod - has TRACE",
    fn() {
        assertEquals(HTTPMethod.TRACE, "TRACE");
    },
});

// ============================================================================
// HTTPRequestParser parseRequest() Tests
// ============================================================================

Deno.test({
    name: "HTTPRequestParser - parseRequest parses GET request",
    fn() {
        const requestText = "GET /index.html HTTP/1.1\r\nHost: example.com\r\n\r\n";
        const requestBytes = new TextEncoder().encode(requestText);

        const request = HTTPRequestParser.parseRequest(requestBytes);

        assertEquals(request.method, "GET");
        assertEquals(request.path, "/index.html");
        assertEquals(request.version, "HTTP/1.1");
        assertEquals(request.headers.get("host"), "example.com");
    },
});

Deno.test({
    name: "HTTPRequestParser - parseRequest parses POST request",
    fn() {
        const requestText = "POST /api/data HTTP/1.1\r\nHost: example.com\r\n\r\n";
        const requestBytes = new TextEncoder().encode(requestText);

        const request = HTTPRequestParser.parseRequest(requestBytes);

        assertEquals(request.method, "POST");
        assertEquals(request.path, "/api/data");
    },
});

Deno.test({
    name: "HTTPRequestParser - parseRequest parses multiple headers",
    fn() {
        const requestText =
            "GET / HTTP/1.1\r\n" +
            "Host: example.com\r\n" +
            "User-Agent: test\r\n" +
            "Accept: text/html\r\n\r\n";
        const requestBytes = new TextEncoder().encode(requestText);

        const request = HTTPRequestParser.parseRequest(requestBytes);

        assertEquals(request.headers.get("host"), "example.com");
        assertEquals(request.headers.get("user-agent"), "test");
        assertEquals(request.headers.get("accept"), "text/html");
    },
});

Deno.test({
    name: "HTTPRequestParser - parseRequest extracts body",
    fn() {
        const requestText =
            "POST /api HTTP/1.1\r\n" +
            "Content-Length: 5\r\n\r\n" +
            "hello";
        const requestBytes = new TextEncoder().encode(requestText);

        const request = HTTPRequestParser.parseRequest(requestBytes);

        const bodyText = new TextDecoder().decode(request.body);
        assertEquals(bodyText, "hello");
    },
});

Deno.test({
    name: "HTTPRequestParser - parseRequest handles empty body",
    fn() {
        const requestText = "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n";
        const requestBytes = new TextEncoder().encode(requestText);

        const request = HTTPRequestParser.parseRequest(requestBytes);

        assertEquals(request.body.byteLength, 0);
    },
});

Deno.test({
    name: "HTTPRequestParser - parseRequest throws on missing header end",
    fn() {
        const requestText = "GET / HTTP/1.1\r\nHost: example.com";
        const requestBytes = new TextEncoder().encode(requestText);

        let errorThrown = false;
        try {
            HTTPRequestParser.parseRequest(requestBytes);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("no header end marker"));
        }

        assert(errorThrown);
    },
});

Deno.test({
    name: "HTTPRequestParser - parseRequest throws on invalid request line",
    fn() {
        const requestText = "INVALID\r\n\r\n";
        const requestBytes = new TextEncoder().encode(requestText);

        let errorThrown = false;
        try {
            HTTPRequestParser.parseRequest(requestBytes);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("Invalid HTTP request line"));
        }

        assert(errorThrown);
    },
});

Deno.test({
    name: "HTTPRequestParser - parseRequest handles path with query string",
    fn() {
        const requestText = "GET /search?q=test HTTP/1.1\r\nHost: example.com\r\n\r\n";
        const requestBytes = new TextEncoder().encode(requestText);

        const request = HTTPRequestParser.parseRequest(requestBytes);

        assertEquals(request.path, "/search?q=test");
    },
});

// ============================================================================
// HTTPRequestParser serializeRequest() Tests
// ============================================================================

Deno.test({
    name: "HTTPRequestParser - serializeRequest creates valid request",
    fn() {
        const request: HTTPRequest = {
            method: HTTPMethod.GET,
            path: "/index.html",
            version: "HTTP/1.1",
            headers: new Map([["host", "example.com"]]),
            body: new Uint8Array(0),
        };

        const serialized = HTTPRequestParser.serializeRequest(request);
        const text = new TextDecoder().decode(serialized);

        assert(text.includes("GET /index.html HTTP/1.1"));
        assert(text.includes("host: example.com"));
    },
});

Deno.test({
    name: "HTTPRequestParser - serializeRequest includes body",
    fn() {
        const bodyText = "test body";
        const request: HTTPRequest = {
            method: HTTPMethod.POST,
            path: "/api",
            version: "HTTP/1.1",
            headers: new Map([["content-length", "9"]]),
            body: new TextEncoder().encode(bodyText),
        };

        const serialized = HTTPRequestParser.serializeRequest(request);
        const text = new TextDecoder().decode(serialized);

        assert(text.endsWith(bodyText));
    },
});

Deno.test({
    name: "HTTPRequestParser - serializeRequest round-trip",
    fn() {
        const original: HTTPRequest = {
            method: HTTPMethod.POST,
            path: "/api/data",
            version: "HTTP/1.1",
            headers: new Map([
                ["host", "example.com"],
                ["content-type", "application/json"],
            ]),
            body: new TextEncoder().encode('{"key":"value"}'),
        };

        const serialized = HTTPRequestParser.serializeRequest(original);
        const parsed = HTTPRequestParser.parseRequest(serialized);

        assertEquals(parsed.method, original.method);
        assertEquals(parsed.path, original.path);
        assertEquals(parsed.version, original.version);
        assertEquals(parsed.headers.get("host"), "example.com");
        assertEquals(parsed.headers.get("content-type"), "application/json");
        assertEquals(new TextDecoder().decode(parsed.body), '{"key":"value"}');
    },
});

// ============================================================================
// HTTPRequestParser createRequest() Tests
// ============================================================================

Deno.test({
    name: "HTTPRequestParser - createRequest creates request with defaults",
    fn() {
        const request = HTTPRequestParser.createRequest(HTTPMethod.GET, "/");

        assertEquals(request.method, HTTPMethod.GET);
        assertEquals(request.path, "/");
        assertEquals(request.version, "HTTP/1.1");
        assertEquals(request.headers.size, 0);
        assertEquals(request.body.byteLength, 0);
    },
});

Deno.test({
    name: "HTTPRequestParser - createRequest accepts custom headers",
    fn() {
        const headers = new Map([["host", "example.com"]]);
        const request = HTTPRequestParser.createRequest(HTTPMethod.GET, "/", headers);

        assertEquals(request.headers.get("host"), "example.com");
    },
});

Deno.test({
    name: "HTTPRequestParser - createRequest accepts custom body",
    fn() {
        const body = new TextEncoder().encode("test");
        const request = HTTPRequestParser.createRequest(HTTPMethod.POST, "/", undefined, body);

        assertEquals(new TextDecoder().decode(request.body), "test");
    },
});

Deno.test({
    name: "HTTPRequestParser - createRequest with all parameters",
    fn() {
        const headers = new Map([["content-type", "text/plain"]]);
        const body = new TextEncoder().encode("hello");
        const request = HTTPRequestParser.createRequest(HTTPMethod.POST, "/api", headers, body);

        assertEquals(request.method, HTTPMethod.POST);
        assertEquals(request.path, "/api");
        assertEquals(request.headers.get("content-type"), "text/plain");
        assertEquals(new TextDecoder().decode(request.body), "hello");
    },
});

Deno.test({
    name: "HTTPRequestParser - createRequest accepts string method",
    fn() {
        const request = HTTPRequestParser.createRequest("CUSTOM", "/");

        assertEquals(request.method, "CUSTOM");
    },
});

// ============================================================================
// HTTPRequestParser parseQueryString() Tests
// ============================================================================

Deno.test({
    name: "HTTPRequestParser - parseQueryString parses simple query",
    fn() {
        const result = HTTPRequestParser.parseQueryString("/search?q=test");

        assertEquals(result.pathname, "/search");
        assertEquals(result.query.get("q"), "test");
    },
});

Deno.test({
    name: "HTTPRequestParser - parseQueryString parses multiple parameters",
    fn() {
        const result = HTTPRequestParser.parseQueryString("/search?q=test&page=2&limit=10");

        assertEquals(result.pathname, "/search");
        assertEquals(result.query.get("q"), "test");
        assertEquals(result.query.get("page"), "2");
        assertEquals(result.query.get("limit"), "10");
    },
});

Deno.test({
    name: "HTTPRequestParser - parseQueryString handles no query string",
    fn() {
        const result = HTTPRequestParser.parseQueryString("/search");

        assertEquals(result.pathname, "/search");
        assertEquals(result.query.size, 0);
    },
});

Deno.test({
    name: "HTTPRequestParser - parseQueryString handles empty value",
    fn() {
        const result = HTTPRequestParser.parseQueryString("/search?q=");

        assertEquals(result.query.get("q"), "");
    },
});

Deno.test({
    name: "HTTPRequestParser - parseQueryString decodes URI components",
    fn() {
        const result = HTTPRequestParser.parseQueryString("/search?q=hello%20world");

        assertEquals(result.query.get("q"), "hello world");
    },
});

Deno.test({
    name: "HTTPRequestParser - parseQueryString handles special characters",
    fn() {
        const result = HTTPRequestParser.parseQueryString("/search?q=test%26more");

        assertEquals(result.query.get("q"), "test&more");
    },
});

Deno.test({
    name: "HTTPRequestParser - parseQueryString handles key without value",
    fn() {
        const result = HTTPRequestParser.parseQueryString("/search?debug");

        assertEquals(result.query.get("debug"), "");
    },
});

// ============================================================================
// HTTPRequestParser buildQueryString() Tests
// ============================================================================

Deno.test({
    name: "HTTPRequestParser - buildQueryString from Map",
    fn() {
        const params = new Map([
            ["q", "test"],
            ["page", "2"],
        ]);

        const queryString = HTTPRequestParser.buildQueryString(params);

        assert(queryString.includes("q=test"));
        assert(queryString.includes("page=2"));
        assert(queryString.includes("&"));
    },
});

Deno.test({
    name: "HTTPRequestParser - buildQueryString from object",
    fn() {
        const params = {
            q: "test",
            page: "2",
        };

        const queryString = HTTPRequestParser.buildQueryString(params);

        assert(queryString.includes("q=test"));
        assert(queryString.includes("page=2"));
    },
});

Deno.test({
    name: "HTTPRequestParser - buildQueryString encodes special characters",
    fn() {
        const params = new Map([["q", "hello world"]]);

        const queryString = HTTPRequestParser.buildQueryString(params);

        assert(queryString.includes("hello%20world"));
    },
});

Deno.test({
    name: "HTTPRequestParser - buildQueryString handles empty map",
    fn() {
        const params = new Map();

        const queryString = HTTPRequestParser.buildQueryString(params);

        assertEquals(queryString, "");
    },
});

Deno.test({
    name: "HTTPRequestParser - buildQueryString encodes ampersand",
    fn() {
        const params = new Map([["q", "test&more"]]);

        const queryString = HTTPRequestParser.buildQueryString(params);

        assert(queryString.includes("test%26more"));
    },
});

Deno.test({
    name: "HTTPRequestParser - buildQueryString round-trip",
    fn() {
        const original = new Map([
            ["q", "test search"],
            ["page", "2"],
            ["filter", "active"],
        ]);

        const queryString = HTTPRequestParser.buildQueryString(original);
        const path = `/search?${queryString}`;
        const parsed = HTTPRequestParser.parseQueryString(path);

        assertEquals(parsed.query.get("q"), "test search");
        assertEquals(parsed.query.get("page"), "2");
        assertEquals(parsed.query.get("filter"), "active");
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "HTTPRequest - typical GET request",
    fn() {
        const request = HTTPRequestParser.createRequest(
            HTTPMethod.GET,
            "/api/users?page=1",
            new Map([
                ["host", "api.example.com"],
                ["user-agent", "test/1.0"],
                ["accept", "application/json"],
            ])
        );

        const serialized = HTTPRequestParser.serializeRequest(request);
        const parsed = HTTPRequestParser.parseRequest(serialized);

        assertEquals(parsed.method, HTTPMethod.GET);
        assertEquals(parsed.path, "/api/users?page=1");
        assertEquals(parsed.headers.get("host"), "api.example.com");
    },
});

Deno.test({
    name: "HTTPRequest - typical POST request with JSON body",
    fn() {
        const body = JSON.stringify({ name: "test", value: 123 });
        const request = HTTPRequestParser.createRequest(
            HTTPMethod.POST,
            "/api/data",
            new Map([
                ["host", "api.example.com"],
                ["content-type", "application/json"],
                ["content-length", body.length.toString()],
            ]),
            new TextEncoder().encode(body)
        );

        const serialized = HTTPRequestParser.serializeRequest(request);
        const parsed = HTTPRequestParser.parseRequest(serialized);

        assertEquals(parsed.method, HTTPMethod.POST);
        assertEquals(parsed.headers.get("content-type"), "application/json");
        assertEquals(new TextDecoder().decode(parsed.body), body);
    },
});

Deno.test({
    name: "HTTPRequest - all HTTP methods",
    fn() {
        const methods = [
            HTTPMethod.GET,
            HTTPMethod.POST,
            HTTPMethod.PUT,
            HTTPMethod.DELETE,
            HTTPMethod.HEAD,
            HTTPMethod.OPTIONS,
            HTTPMethod.PATCH,
            HTTPMethod.CONNECT,
            HTTPMethod.TRACE,
        ];

        for (const method of methods) {
            const request = HTTPRequestParser.createRequest(method, "/");
            const serialized = HTTPRequestParser.serializeRequest(request);
            const parsed = HTTPRequestParser.parseRequest(serialized);

            assertEquals(parsed.method, method);
        }
    },
});

Deno.test({
    name: "HTTPRequest - complex query string",
    fn() {
        const params = new Map([
            ["search", "test query"],
            ["category", "electronics"],
            ["min_price", "10"],
            ["max_price", "100"],
            ["sort", "relevance"],
        ]);

        const queryString = HTTPRequestParser.buildQueryString(params);
        const path = `/products?${queryString}`;
        const parsed = HTTPRequestParser.parseQueryString(path);

        assertEquals(parsed.pathname, "/products");
        assertEquals(parsed.query.get("search"), "test query");
        assertEquals(parsed.query.get("category"), "electronics");
        assertEquals(parsed.query.get("min_price"), "10");
    },
});

Deno.test({
    name: "HTTPRequest - request with large body",
    fn() {
        const largeBody = "x".repeat(10000);
        const request = HTTPRequestParser.createRequest(
            HTTPMethod.POST,
            "/upload",
            new Map([["content-length", largeBody.length.toString()]]),
            new TextEncoder().encode(largeBody)
        );

        const serialized = HTTPRequestParser.serializeRequest(request);
        const parsed = HTTPRequestParser.parseRequest(serialized);

        assertEquals(new TextDecoder().decode(parsed.body), largeBody);
    },
});
