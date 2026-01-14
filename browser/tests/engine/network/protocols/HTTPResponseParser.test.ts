/**
 * HTTPResponseParser Tests
 *
 * Comprehensive tests for HTTP response parsing and serialization.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    HTTPResponseParser,
    HTTPStatusClass,
    HTTPStatus,
    type HTTPResponse,
} from "../../../../src/engine/network/protocols/HTTPResponseParser.ts";
import { HTTPHeaderParser } from "../../../../src/engine/network/protocols/HTTPHeaders.ts";

// ============================================================================
// HTTPStatusClass Enum Tests
// ============================================================================

Deno.test({
    name: "HTTPStatusClass - has INFORMATIONAL",
    fn() {
        assertEquals(HTTPStatusClass.INFORMATIONAL, 1);
    },
});

Deno.test({
    name: "HTTPStatusClass - has SUCCESS",
    fn() {
        assertEquals(HTTPStatusClass.SUCCESS, 2);
    },
});

Deno.test({
    name: "HTTPStatusClass - has REDIRECTION",
    fn() {
        assertEquals(HTTPStatusClass.REDIRECTION, 3);
    },
});

Deno.test({
    name: "HTTPStatusClass - has CLIENT_ERROR",
    fn() {
        assertEquals(HTTPStatusClass.CLIENT_ERROR, 4);
    },
});

Deno.test({
    name: "HTTPStatusClass - has SERVER_ERROR",
    fn() {
        assertEquals(HTTPStatusClass.SERVER_ERROR, 5);
    },
});

// ============================================================================
// HTTPStatus Enum Tests
// ============================================================================

Deno.test({
    name: "HTTPStatus - has OK",
    fn() {
        assertEquals(HTTPStatus.OK, 200);
    },
});

Deno.test({
    name: "HTTPStatus - has CREATED",
    fn() {
        assertEquals(HTTPStatus.CREATED, 201);
    },
});

Deno.test({
    name: "HTTPStatus - has ACCEPTED",
    fn() {
        assertEquals(HTTPStatus.ACCEPTED, 202);
    },
});

Deno.test({
    name: "HTTPStatus - has NO_CONTENT",
    fn() {
        assertEquals(HTTPStatus.NO_CONTENT, 204);
    },
});

Deno.test({
    name: "HTTPStatus - has MOVED_PERMANENTLY",
    fn() {
        assertEquals(HTTPStatus.MOVED_PERMANENTLY, 301);
    },
});

Deno.test({
    name: "HTTPStatus - has FOUND",
    fn() {
        assertEquals(HTTPStatus.FOUND, 302);
    },
});

Deno.test({
    name: "HTTPStatus - has SEE_OTHER",
    fn() {
        assertEquals(HTTPStatus.SEE_OTHER, 303);
    },
});

Deno.test({
    name: "HTTPStatus - has NOT_MODIFIED",
    fn() {
        assertEquals(HTTPStatus.NOT_MODIFIED, 304);
    },
});

Deno.test({
    name: "HTTPStatus - has TEMPORARY_REDIRECT",
    fn() {
        assertEquals(HTTPStatus.TEMPORARY_REDIRECT, 307);
    },
});

Deno.test({
    name: "HTTPStatus - has PERMANENT_REDIRECT",
    fn() {
        assertEquals(HTTPStatus.PERMANENT_REDIRECT, 308);
    },
});

Deno.test({
    name: "HTTPStatus - has BAD_REQUEST",
    fn() {
        assertEquals(HTTPStatus.BAD_REQUEST, 400);
    },
});

Deno.test({
    name: "HTTPStatus - has UNAUTHORIZED",
    fn() {
        assertEquals(HTTPStatus.UNAUTHORIZED, 401);
    },
});

Deno.test({
    name: "HTTPStatus - has FORBIDDEN",
    fn() {
        assertEquals(HTTPStatus.FORBIDDEN, 403);
    },
});

Deno.test({
    name: "HTTPStatus - has NOT_FOUND",
    fn() {
        assertEquals(HTTPStatus.NOT_FOUND, 404);
    },
});

Deno.test({
    name: "HTTPStatus - has METHOD_NOT_ALLOWED",
    fn() {
        assertEquals(HTTPStatus.METHOD_NOT_ALLOWED, 405);
    },
});

Deno.test({
    name: "HTTPStatus - has CONFLICT",
    fn() {
        assertEquals(HTTPStatus.CONFLICT, 409);
    },
});

Deno.test({
    name: "HTTPStatus - has INTERNAL_SERVER_ERROR",
    fn() {
        assertEquals(HTTPStatus.INTERNAL_SERVER_ERROR, 500);
    },
});

Deno.test({
    name: "HTTPStatus - has NOT_IMPLEMENTED",
    fn() {
        assertEquals(HTTPStatus.NOT_IMPLEMENTED, 501);
    },
});

Deno.test({
    name: "HTTPStatus - has BAD_GATEWAY",
    fn() {
        assertEquals(HTTPStatus.BAD_GATEWAY, 502);
    },
});

Deno.test({
    name: "HTTPStatus - has SERVICE_UNAVAILABLE",
    fn() {
        assertEquals(HTTPStatus.SERVICE_UNAVAILABLE, 503);
    },
});

// ============================================================================
// HTTPResponseParser parseResponse() Tests
// ============================================================================

Deno.test({
    name: "HTTPResponseParser - parseResponse parses 200 OK",
    fn() {
        const responseText = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n";
        const responseBytes = new TextEncoder().encode(responseText);

        const response = HTTPResponseParser.parseResponse(responseBytes);

        assertEquals(response.version, "HTTP/1.1");
        assertEquals(response.statusCode, 200);
        assertEquals(response.statusText, "OK");
        assertEquals(response.headers.get("content-type"), "text/html");
    },
});

Deno.test({
    name: "HTTPResponseParser - parseResponse parses 404 Not Found",
    fn() {
        const responseText = "HTTP/1.1 404 Not Found\r\nContent-Type: text/html\r\n\r\n";
        const responseBytes = new TextEncoder().encode(responseText);

        const response = HTTPResponseParser.parseResponse(responseBytes);

        assertEquals(response.statusCode, 404);
        assertEquals(response.statusText, "Not Found");
    },
});

Deno.test({
    name: "HTTPResponseParser - parseResponse parses multiple headers",
    fn() {
        const responseText =
            "HTTP/1.1 200 OK\r\n" +
            "Content-Type: text/html\r\n" +
            "Content-Length: 1234\r\n" +
            "Server: TestServer\r\n\r\n";
        const responseBytes = new TextEncoder().encode(responseText);

        const response = HTTPResponseParser.parseResponse(responseBytes);

        assertEquals(response.headers.get("content-type"), "text/html");
        assertEquals(response.headers.get("content-length"), "1234");
        assertEquals(response.headers.get("server"), "TestServer");
    },
});

Deno.test({
    name: "HTTPResponseParser - parseResponse extracts body",
    fn() {
        const responseText =
            "HTTP/1.1 200 OK\r\n" +
            "Content-Length: 5\r\n\r\n" +
            "hello";
        const responseBytes = new TextEncoder().encode(responseText);

        const response = HTTPResponseParser.parseResponse(responseBytes);

        const bodyText = new TextDecoder().decode(response.body);
        assertEquals(bodyText, "hello");
    },
});

Deno.test({
    name: "HTTPResponseParser - parseResponse handles empty body",
    fn() {
        const responseText = "HTTP/1.1 204 No Content\r\n\r\n";
        const responseBytes = new TextEncoder().encode(responseText);

        const response = HTTPResponseParser.parseResponse(responseBytes);

        assertEquals(response.body.byteLength, 0);
    },
});

Deno.test({
    name: "HTTPResponseParser - parseResponse throws on missing header end",
    fn() {
        const responseText = "HTTP/1.1 200 OK\r\nContent-Type: text/html";
        const responseBytes = new TextEncoder().encode(responseText);

        let errorThrown = false;
        try {
            HTTPResponseParser.parseResponse(responseBytes);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("no header end marker"));
        }

        assert(errorThrown);
    },
});

Deno.test({
    name: "HTTPResponseParser - parseResponse throws on invalid status line",
    fn() {
        const responseText = "INVALID\r\n\r\n";
        const responseBytes = new TextEncoder().encode(responseText);

        let errorThrown = false;
        try {
            HTTPResponseParser.parseResponse(responseBytes);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("Invalid HTTP status line"));
        }

        assert(errorThrown);
    },
});

Deno.test({
    name: "HTTPResponseParser - parseResponse throws on invalid status code",
    fn() {
        const responseText = "HTTP/1.1 ABC OK\r\n\r\n";
        const responseBytes = new TextEncoder().encode(responseText);

        let errorThrown = false;
        try {
            HTTPResponseParser.parseResponse(responseBytes);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("Invalid status code"));
        }

        assert(errorThrown);
    },
});

Deno.test({
    name: "HTTPResponseParser - parseResponse handles status text with spaces",
    fn() {
        const responseText = "HTTP/1.1 503 Service Temporarily Unavailable\r\n\r\n";
        const responseBytes = new TextEncoder().encode(responseText);

        const response = HTTPResponseParser.parseResponse(responseBytes);

        assertEquals(response.statusText, "Service Temporarily Unavailable");
    },
});

// ============================================================================
// HTTPResponseParser chunked encoding Tests
// ============================================================================

Deno.test({
    name: "HTTPResponseParser - decodeChunkedBody decodes single chunk",
    fn() {
        const chunkedData = "5\r\nhello\r\n0\r\n\r\n";
        const chunkedBytes = new TextEncoder().encode(chunkedData);

        const decoded = HTTPResponseParser.decodeChunkedBody(chunkedBytes);

        const decodedText = new TextDecoder().decode(decoded);
        assertEquals(decodedText, "hello");
    },
});

Deno.test({
    name: "HTTPResponseParser - decodeChunkedBody decodes multiple chunks",
    fn() {
        const chunkedData = "5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n";
        const chunkedBytes = new TextEncoder().encode(chunkedData);

        const decoded = HTTPResponseParser.decodeChunkedBody(chunkedBytes);

        const decodedText = new TextDecoder().decode(decoded);
        assertEquals(decodedText, "hello world");
    },
});

Deno.test({
    name: "HTTPResponseParser - decodeChunkedBody handles empty chunks",
    fn() {
        const chunkedData = "0\r\n\r\n";
        const chunkedBytes = new TextEncoder().encode(chunkedData);

        const decoded = HTTPResponseParser.decodeChunkedBody(chunkedBytes);

        assertEquals(decoded.byteLength, 0);
    },
});

Deno.test({
    name: "HTTPResponseParser - decodeChunkedBody handles chunk extensions",
    fn() {
        const chunkedData = "5;name=value\r\nhello\r\n0\r\n\r\n";
        const chunkedBytes = new TextEncoder().encode(chunkedData);

        const decoded = HTTPResponseParser.decodeChunkedBody(chunkedBytes);

        const decodedText = new TextDecoder().decode(decoded);
        assertEquals(decodedText, "hello");
    },
});

Deno.test({
    name: "HTTPResponseParser - decodeChunkedBody throws on invalid chunk size",
    fn() {
        const chunkedData = "XYZ\r\nhello\r\n0\r\n\r\n";
        const chunkedBytes = new TextEncoder().encode(chunkedData);

        let errorThrown = false;
        try {
            HTTPResponseParser.decodeChunkedBody(chunkedBytes);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("Invalid chunk size"));
        }

        assert(errorThrown);
    },
});

Deno.test({
    name: "HTTPResponseParser - decodeChunkedBody throws on incomplete data",
    fn() {
        const chunkedData = "A\r\nhello"; // Chunk size 10 but only 5 bytes
        const chunkedBytes = new TextEncoder().encode(chunkedData);

        let errorThrown = false;
        try {
            HTTPResponseParser.decodeChunkedBody(chunkedBytes);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("Incomplete chunked data"));
        }

        assert(errorThrown);
    },
});

Deno.test({
    name: "HTTPResponseParser - encodeChunkedBody encodes small data",
    fn() {
        const data = new TextEncoder().encode("hello");

        const encoded = HTTPResponseParser.encodeChunkedBody(data);

        const encodedText = new TextDecoder().decode(encoded);
        assert(encodedText.includes("5\r\n"));
        assert(encodedText.includes("hello"));
        assert(encodedText.includes("0\r\n"));
    },
});

Deno.test({
    name: "HTTPResponseParser - encodeChunkedBody uses specified chunk size",
    fn() {
        const data = new TextEncoder().encode("hello world");

        const encoded = HTTPResponseParser.encodeChunkedBody(data, 5);

        const encodedText = new TextDecoder().decode(encoded);
        // Should have multiple chunks of size 5
        assert(encodedText.includes("5\r\n"));
    },
});

Deno.test({
    name: "HTTPResponseParser - encodeChunkedBody round-trip",
    fn() {
        const original = new TextEncoder().encode("hello world test data");

        const encoded = HTTPResponseParser.encodeChunkedBody(original);
        const decoded = HTTPResponseParser.decodeChunkedBody(encoded);

        const decodedText = new TextDecoder().decode(decoded);
        assertEquals(decodedText, "hello world test data");
    },
});

Deno.test({
    name: "HTTPResponseParser - parseResponse handles chunked encoding",
    fn() {
        const responseText =
            "HTTP/1.1 200 OK\r\n" +
            "Transfer-Encoding: chunked\r\n\r\n" +
            "5\r\nhello\r\n0\r\n\r\n";
        const responseBytes = new TextEncoder().encode(responseText);

        const response = HTTPResponseParser.parseResponse(responseBytes);

        const bodyText = new TextDecoder().decode(response.body);
        assertEquals(bodyText, "hello");
    },
});

// ============================================================================
// HTTPResponseParser serializeResponse() Tests
// ============================================================================

Deno.test({
    name: "HTTPResponseParser - serializeResponse creates valid response",
    fn() {
        const response: HTTPResponse = {
            version: "HTTP/1.1",
            statusCode: 200,
            statusText: "OK",
            headers: new Map([["content-type", "text/html"]]),
            body: new Uint8Array(0),
        };

        const serialized = HTTPResponseParser.serializeResponse(response);
        const text = new TextDecoder().decode(serialized);

        assert(text.includes("HTTP/1.1 200 OK"));
        assert(text.includes("content-type: text/html"));
    },
});

Deno.test({
    name: "HTTPResponseParser - serializeResponse includes body",
    fn() {
        const bodyText = "test body";
        const response: HTTPResponse = {
            version: "HTTP/1.1",
            statusCode: 200,
            statusText: "OK",
            headers: new Map([["content-length", "9"]]),
            body: new TextEncoder().encode(bodyText),
        };

        const serialized = HTTPResponseParser.serializeResponse(response);
        const text = new TextDecoder().decode(serialized);

        assert(text.endsWith(bodyText));
    },
});

Deno.test({
    name: "HTTPResponseParser - serializeResponse round-trip",
    fn() {
        const original: HTTPResponse = {
            version: "HTTP/1.1",
            statusCode: 200,
            statusText: "OK",
            headers: new Map([
                ["content-type", "application/json"],
                ["server", "TestServer"],
            ]),
            body: new TextEncoder().encode('{"key":"value"}'),
        };

        const serialized = HTTPResponseParser.serializeResponse(original);
        const parsed = HTTPResponseParser.parseResponse(serialized);

        assertEquals(parsed.version, original.version);
        assertEquals(parsed.statusCode, original.statusCode);
        assertEquals(parsed.statusText, original.statusText);
        assertEquals(parsed.headers.get("content-type"), "application/json");
        assertEquals(parsed.headers.get("server"), "TestServer");
        assertEquals(new TextDecoder().decode(parsed.body), '{"key":"value"}');
    },
});

// ============================================================================
// HTTPResponseParser createResponse() Tests
// ============================================================================

Deno.test({
    name: "HTTPResponseParser - createResponse creates response with defaults",
    fn() {
        const response = HTTPResponseParser.createResponse(200, "OK");

        assertEquals(response.version, "HTTP/1.1");
        assertEquals(response.statusCode, 200);
        assertEquals(response.statusText, "OK");
        assertEquals(response.headers.size, 0);
        assertEquals(response.body.byteLength, 0);
    },
});

Deno.test({
    name: "HTTPResponseParser - createResponse accepts custom headers",
    fn() {
        const headers = new Map([["content-type", "text/html"]]);
        const response = HTTPResponseParser.createResponse(200, "OK", headers);

        assertEquals(response.headers.get("content-type"), "text/html");
    },
});

Deno.test({
    name: "HTTPResponseParser - createResponse accepts custom body",
    fn() {
        const body = new TextEncoder().encode("test");
        const response = HTTPResponseParser.createResponse(200, "OK", undefined, body);

        assertEquals(new TextDecoder().decode(response.body), "test");
    },
});

Deno.test({
    name: "HTTPResponseParser - createResponse with all parameters",
    fn() {
        const headers = new Map([["content-type", "application/json"]]);
        const body = new TextEncoder().encode('{"status":"ok"}');
        const response = HTTPResponseParser.createResponse(201, "Created", headers, body);

        assertEquals(response.statusCode, 201);
        assertEquals(response.statusText, "Created");
        assertEquals(response.headers.get("content-type"), "application/json");
        assertEquals(new TextDecoder().decode(response.body), '{"status":"ok"}');
    },
});

// ============================================================================
// HTTPResponseParser status helper Tests
// ============================================================================

Deno.test({
    name: "HTTPResponseParser - getStatusClass for 1xx",
    fn() {
        assertEquals(HTTPResponseParser.getStatusClass(100), HTTPStatusClass.INFORMATIONAL);
        assertEquals(HTTPResponseParser.getStatusClass(101), HTTPStatusClass.INFORMATIONAL);
    },
});

Deno.test({
    name: "HTTPResponseParser - getStatusClass for 2xx",
    fn() {
        assertEquals(HTTPResponseParser.getStatusClass(200), HTTPStatusClass.SUCCESS);
        assertEquals(HTTPResponseParser.getStatusClass(201), HTTPStatusClass.SUCCESS);
        assertEquals(HTTPResponseParser.getStatusClass(204), HTTPStatusClass.SUCCESS);
    },
});

Deno.test({
    name: "HTTPResponseParser - getStatusClass for 3xx",
    fn() {
        assertEquals(HTTPResponseParser.getStatusClass(301), HTTPStatusClass.REDIRECTION);
        assertEquals(HTTPResponseParser.getStatusClass(302), HTTPStatusClass.REDIRECTION);
        assertEquals(HTTPResponseParser.getStatusClass(304), HTTPStatusClass.REDIRECTION);
    },
});

Deno.test({
    name: "HTTPResponseParser - getStatusClass for 4xx",
    fn() {
        assertEquals(HTTPResponseParser.getStatusClass(400), HTTPStatusClass.CLIENT_ERROR);
        assertEquals(HTTPResponseParser.getStatusClass(404), HTTPStatusClass.CLIENT_ERROR);
    },
});

Deno.test({
    name: "HTTPResponseParser - getStatusClass for 5xx",
    fn() {
        assertEquals(HTTPResponseParser.getStatusClass(500), HTTPStatusClass.SERVER_ERROR);
        assertEquals(HTTPResponseParser.getStatusClass(503), HTTPStatusClass.SERVER_ERROR);
    },
});

Deno.test({
    name: "HTTPResponseParser - isSuccessful returns true for 2xx",
    fn() {
        assert(HTTPResponseParser.isSuccessful(200));
        assert(HTTPResponseParser.isSuccessful(201));
        assert(HTTPResponseParser.isSuccessful(204));
    },
});

Deno.test({
    name: "HTTPResponseParser - isSuccessful returns false for non-2xx",
    fn() {
        assert(!HTTPResponseParser.isSuccessful(100));
        assert(!HTTPResponseParser.isSuccessful(301));
        assert(!HTTPResponseParser.isSuccessful(404));
        assert(!HTTPResponseParser.isSuccessful(500));
    },
});

Deno.test({
    name: "HTTPResponseParser - isRedirect returns true for 3xx",
    fn() {
        assert(HTTPResponseParser.isRedirect(301));
        assert(HTTPResponseParser.isRedirect(302));
        assert(HTTPResponseParser.isRedirect(304));
        assert(HTTPResponseParser.isRedirect(307));
    },
});

Deno.test({
    name: "HTTPResponseParser - isRedirect returns false for non-3xx",
    fn() {
        assert(!HTTPResponseParser.isRedirect(200));
        assert(!HTTPResponseParser.isRedirect(404));
        assert(!HTTPResponseParser.isRedirect(500));
    },
});

Deno.test({
    name: "HTTPResponseParser - isError returns true for 4xx",
    fn() {
        assert(HTTPResponseParser.isError(400));
        assert(HTTPResponseParser.isError(404));
        assert(HTTPResponseParser.isError(409));
    },
});

Deno.test({
    name: "HTTPResponseParser - isError returns true for 5xx",
    fn() {
        assert(HTTPResponseParser.isError(500));
        assert(HTTPResponseParser.isError(502));
        assert(HTTPResponseParser.isError(503));
    },
});

Deno.test({
    name: "HTTPResponseParser - isError returns false for 1xx, 2xx, 3xx",
    fn() {
        assert(!HTTPResponseParser.isError(100));
        assert(!HTTPResponseParser.isError(200));
        assert(!HTTPResponseParser.isError(301));
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "HTTPResponse - typical 200 OK response",
    fn() {
        const response = HTTPResponseParser.createResponse(
            200,
            "OK",
            new Map([
                ["content-type", "text/html"],
                ["server", "TestServer/1.0"],
            ]),
            new TextEncoder().encode("<html><body>Hello</body></html>")
        );

        const serialized = HTTPResponseParser.serializeResponse(response);
        const parsed = HTTPResponseParser.parseResponse(serialized);

        assertEquals(parsed.statusCode, 200);
        assertEquals(parsed.headers.get("content-type"), "text/html");
        assert(new TextDecoder().decode(parsed.body).includes("Hello"));
    },
});

Deno.test({
    name: "HTTPResponse - typical 404 Not Found response",
    fn() {
        const response = HTTPResponseParser.createResponse(
            404,
            "Not Found",
            new Map([["content-type", "text/html"]]),
            new TextEncoder().encode("<html><body>Not Found</body></html>")
        );

        assert(HTTPResponseParser.isError(response.statusCode));
        assert(!HTTPResponseParser.isSuccessful(response.statusCode));
    },
});

Deno.test({
    name: "HTTPResponse - typical 301 redirect",
    fn() {
        const response = HTTPResponseParser.createResponse(
            301,
            "Moved Permanently",
            new Map([["location", "https://example.com/new-location"]])
        );

        assert(HTTPResponseParser.isRedirect(response.statusCode));
        assert(!HTTPResponseParser.isSuccessful(response.statusCode));
        assertEquals(response.headers.get("location"), "https://example.com/new-location");
    },
});

Deno.test({
    name: "HTTPResponse - all common status codes",
    fn() {
        const statuses = [
            [200, "OK"],
            [201, "Created"],
            [204, "No Content"],
            [301, "Moved Permanently"],
            [302, "Found"],
            [304, "Not Modified"],
            [400, "Bad Request"],
            [401, "Unauthorized"],
            [404, "Not Found"],
            [500, "Internal Server Error"],
            [503, "Service Unavailable"],
        ];

        for (const [code, text] of statuses) {
            const response = HTTPResponseParser.createResponse(code as number, text as string);
            const serialized = HTTPResponseParser.serializeResponse(response);
            const parsed = HTTPResponseParser.parseResponse(serialized);

            assertEquals(parsed.statusCode, code);
            assertEquals(parsed.statusText, text);
        }
    },
});

Deno.test({
    name: "HTTPResponse - JSON response body",
    fn() {
        const jsonData = { status: "success", data: { id: 123, name: "test" } };
        const body = JSON.stringify(jsonData);

        const response = HTTPResponseParser.createResponse(
            200,
            "OK",
            new Map([
                ["content-type", "application/json"],
                ["content-length", body.length.toString()],
            ]),
            new TextEncoder().encode(body)
        );

        const serialized = HTTPResponseParser.serializeResponse(response);
        const parsed = HTTPResponseParser.parseResponse(serialized);

        const parsedBody = JSON.parse(new TextDecoder().decode(parsed.body));
        assertEquals(parsedBody.status, "success");
        assertEquals(parsedBody.data.id, 123);
    },
});

Deno.test({
    name: "HTTPResponse - large response body",
    fn() {
        const largeBody = "x".repeat(100000);
        const response = HTTPResponseParser.createResponse(
            200,
            "OK",
            new Map([["content-length", largeBody.length.toString()]]),
            new TextEncoder().encode(largeBody)
        );

        const serialized = HTTPResponseParser.serializeResponse(response);
        const parsed = HTTPResponseParser.parseResponse(serialized);

        assertEquals(new TextDecoder().decode(parsed.body), largeBody);
    },
});

Deno.test({
    name: "HTTPResponse - chunked encoding with large data",
    fn() {
        const originalData = "a".repeat(25000);
        const originalBytes = new TextEncoder().encode(originalData);

        const chunked = HTTPResponseParser.encodeChunkedBody(originalBytes, 8192);
        const decoded = HTTPResponseParser.decodeChunkedBody(chunked);

        assertEquals(new TextDecoder().decode(decoded), originalData);
    },
});

Deno.test({
    name: "HTTPResponse - complete workflow with chunked encoding",
    fn() {
        const bodyData = "This is test data for chunked encoding";

        // Create response
        const response = HTTPResponseParser.createResponse(
            200,
            "OK",
            new Map([
                ["transfer-encoding", "chunked"],
                ["content-type", "text/plain"],
            ]),
            HTTPResponseParser.encodeChunkedBody(new TextEncoder().encode(bodyData))
        );

        // Serialize
        const serialized = HTTPResponseParser.serializeResponse(response);

        // Parse back
        const parsed = HTTPResponseParser.parseResponse(serialized);

        // Should decode chunked body automatically
        const decodedBody = new TextDecoder().decode(parsed.body);
        assertEquals(decodedBody, bodyData);
    },
});

Deno.test({
    name: "HTTPResponse - status helpers consistency",
    fn() {
        // Check all status codes from 100 to 599
        for (let code = 100; code < 600; code++) {
            const statusClass = HTTPResponseParser.getStatusClass(code);
            const isSuccess = HTTPResponseParser.isSuccessful(code);
            const isRedirect = HTTPResponseParser.isRedirect(code);
            const isError = HTTPResponseParser.isError(code);

            // Verify mutual exclusivity
            const trueCount = [isSuccess, isRedirect, isError].filter(v => v).length;
            assert(trueCount <= 1, `Multiple status checks true for ${code}`);

            // Verify consistency with status class
            if (statusClass === HTTPStatusClass.SUCCESS) {
                assert(isSuccess);
            } else if (statusClass === HTTPStatusClass.REDIRECTION) {
                assert(isRedirect);
            } else if (statusClass === HTTPStatusClass.CLIENT_ERROR || statusClass === HTTPStatusClass.SERVER_ERROR) {
                assert(isError);
            }
        }
    },
});

Deno.test({
    name: "HTTPResponse - HTTP status enum values",
    fn() {
        // Verify all enum values are in correct ranges
        assert(HTTPStatus.OK >= 200 && HTTPStatus.OK < 300);
        assert(HTTPStatus.CREATED >= 200 && HTTPStatus.CREATED < 300);
        assert(HTTPStatus.MOVED_PERMANENTLY >= 300 && HTTPStatus.MOVED_PERMANENTLY < 400);
        assert(HTTPStatus.FOUND >= 300 && HTTPStatus.FOUND < 400);
        assert(HTTPStatus.BAD_REQUEST >= 400 && HTTPStatus.BAD_REQUEST < 500);
        assert(HTTPStatus.NOT_FOUND >= 400 && HTTPStatus.NOT_FOUND < 500);
        assert(HTTPStatus.INTERNAL_SERVER_ERROR >= 500 && HTTPStatus.INTERNAL_SERVER_ERROR < 600);
        assert(HTTPStatus.SERVICE_UNAVAILABLE >= 500 && HTTPStatus.SERVICE_UNAVAILABLE < 600);
    },
});
