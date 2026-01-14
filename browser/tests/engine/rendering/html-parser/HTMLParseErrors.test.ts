/**
 * Tests for HTML Parse Errors
 * Tests error recovery for malformed HTML.
 */

import { assertEquals, assertExists } from "@std/assert";
import {
    createParseError,
    type HTMLParseError,
} from "../../../../src/engine/rendering/html-parser/HTMLParseErrors.ts";

// HTMLParseError interface tests

Deno.test({
    name: "HTMLParseError - interface structure",
    fn() {
        const error: HTMLParseError = {
            code: "unexpected-token",
            message: "Unexpected token",
            line: 1,
            column: 5,
        };
        assertEquals(error.code, "unexpected-token");
        assertEquals(error.message, "Unexpected token");
        assertEquals(error.line, 1);
        assertEquals(error.column, 5);
    },
});

Deno.test({
    name: "HTMLParseError - interface with zero values",
    fn() {
        const error: HTMLParseError = {
            code: "error",
            message: "Error",
            line: 0,
            column: 0,
        };
        assertEquals(error.line, 0);
        assertEquals(error.column, 0);
    },
});

// createParseError function tests

Deno.test({
    name: "createParseError - creates error with code and message",
    fn() {
        const error = createParseError("test-error", "This is a test error");
        assertExists(error);
        assertEquals(error.code, "test-error");
        assertEquals(error.message, "This is a test error");
    },
});

Deno.test({
    name: "createParseError - sets line to 0",
    fn() {
        const error = createParseError("test-error", "Test");
        assertEquals(error.line, 0);
    },
});

Deno.test({
    name: "createParseError - sets column to 0",
    fn() {
        const error = createParseError("test-error", "Test");
        assertEquals(error.column, 0);
    },
});

Deno.test({
    name: "createParseError - handles empty code",
    fn() {
        const error = createParseError("", "Message");
        assertEquals(error.code, "");
        assertEquals(error.message, "Message");
    },
});

Deno.test({
    name: "createParseError - handles empty message",
    fn() {
        const error = createParseError("code", "");
        assertEquals(error.code, "code");
        assertEquals(error.message, "");
    },
});

Deno.test({
    name: "createParseError - handles long error code",
    fn() {
        const longCode = "very-long-error-code-with-many-dashes-and-words";
        const error = createParseError(longCode, "Test");
        assertEquals(error.code, longCode);
    },
});

Deno.test({
    name: "createParseError - handles long error message",
    fn() {
        const longMessage = "This is a very long error message that describes in great detail what went wrong during HTML parsing";
        const error = createParseError("test", longMessage);
        assertEquals(error.message, longMessage);
    },
});

Deno.test({
    name: "createParseError - handles special characters in code",
    fn() {
        const error = createParseError("error:123", "Test");
        assertEquals(error.code, "error:123");
    },
});

Deno.test({
    name: "createParseError - handles special characters in message",
    fn() {
        const error = createParseError("test", "Error at '<div>' tag");
        assertEquals(error.message, "Error at '<div>' tag");
    },
});

Deno.test({
    name: "createParseError - common error: unexpected-eof",
    fn() {
        const error = createParseError("unexpected-eof", "Unexpected end of file");
        assertEquals(error.code, "unexpected-eof");
        assertEquals(error.message, "Unexpected end of file");
    },
});

Deno.test({
    name: "createParseError - common error: missing-end-tag",
    fn() {
        const error = createParseError("missing-end-tag", "Missing closing tag");
        assertEquals(error.code, "missing-end-tag");
        assertEquals(error.message, "Missing closing tag");
    },
});

Deno.test({
    name: "createParseError - common error: unexpected-token",
    fn() {
        const error = createParseError("unexpected-token", "Unexpected token '<'");
        assertEquals(error.code, "unexpected-token");
    },
});

Deno.test({
    name: "createParseError - common error: invalid-attribute",
    fn() {
        const error = createParseError("invalid-attribute", "Invalid attribute name");
        assertEquals(error.code, "invalid-attribute");
    },
});

Deno.test({
    name: "createParseError - common error: duplicate-attribute",
    fn() {
        const error = createParseError("duplicate-attribute", "Duplicate attribute 'id'");
        assertEquals(error.code, "duplicate-attribute");
    },
});
