/**
 * Tests for DevTools Protocol Types
 *
 * Covers type guards (isRequest, isResponse, isEvent),
 * ProtocolErrorCode enum values, and edge cases.
 */

import { assertEquals } from "@std/assert";
import {
    isRequest,
    isResponse,
    isEvent,
    ProtocolErrorCode,
} from "../../../protocol/types.ts";
import type {
    ProtocolRequest,
    ProtocolResponse,
    ProtocolEvent,
    ProtocolMessage,
} from "../../../protocol/types.ts";

// ---------------------------------------------------------------------------
// isRequest() type guard
// ---------------------------------------------------------------------------

Deno.test("isRequest returns true for a valid request with id and method", () => {
    const msg: ProtocolRequest = {
        id: 1,
        method: "DOM.getDocument",
    };
    assertEquals(isRequest(msg as ProtocolMessage), true);
});

Deno.test("isRequest returns true for a request with params and sessionId", () => {
    const msg: ProtocolRequest = {
        id: 42,
        method: "CSS.getStyleSheetText",
        params: { styleSheetId: "sheet-1" },
        sessionId: "session-abc",
    };
    assertEquals(isRequest(msg as ProtocolMessage), true);
});

Deno.test("isRequest returns false for a response (id only, no method)", () => {
    const msg: ProtocolResponse = {
        id: 1,
        result: { root: {} },
    };
    assertEquals(isRequest(msg as ProtocolMessage), false);
});

Deno.test("isRequest returns false for an event (method only, no id)", () => {
    const msg: ProtocolEvent = {
        method: "DOM.documentUpdated",
    };
    assertEquals(isRequest(msg as ProtocolMessage), false);
});

Deno.test("isRequest returns true for message with both id and method (request shape)", () => {
    // A message with both id and method is treated as a request by the type guard
    const msg = { id: 5, method: "Network.requestWillBeSent" } as ProtocolMessage;
    assertEquals(isRequest(msg), true);
});

// ---------------------------------------------------------------------------
// isResponse() type guard
// ---------------------------------------------------------------------------

Deno.test("isResponse returns true for a valid response with id and result", () => {
    const msg: ProtocolResponse = {
        id: 1,
        result: { nodeId: 10 },
    };
    assertEquals(isResponse(msg as ProtocolMessage), true);
});

Deno.test("isResponse returns true for a response with an error", () => {
    const msg: ProtocolResponse = {
        id: 1,
        error: {
            code: ProtocolErrorCode.METHOD_NOT_FOUND,
            message: "Method not found",
        },
    };
    assertEquals(isResponse(msg as ProtocolMessage), true);
});

Deno.test("isResponse returns true for a minimal response with id and result", () => {
    const msg: ProtocolResponse = {
        id: 99,
        result: {},
    };
    assertEquals(isResponse(msg as ProtocolMessage), true);
});

Deno.test("isResponse returns false for a message with only id (no result or error)", () => {
    const msg = { id: 99 } as ProtocolMessage;
    assertEquals(isResponse(msg as ProtocolMessage), false);
});

Deno.test("isResponse returns false for a request (has both id and method)", () => {
    const msg: ProtocolRequest = {
        id: 1,
        method: "DOM.getDocument",
    };
    assertEquals(isResponse(msg as ProtocolMessage), false);
});

Deno.test("isResponse returns false for an event (no id)", () => {
    const msg: ProtocolEvent = {
        method: "DOM.documentUpdated",
        params: {},
    };
    assertEquals(isResponse(msg as ProtocolMessage), false);
});

// ---------------------------------------------------------------------------
// isEvent() type guard
// ---------------------------------------------------------------------------

Deno.test("isEvent returns true for a valid event with method and no id", () => {
    const msg: ProtocolEvent = {
        method: "DOM.documentUpdated",
    };
    assertEquals(isEvent(msg as ProtocolMessage), true);
});

Deno.test("isEvent returns true for an event with params and sessionId", () => {
    const msg: ProtocolEvent = {
        method: "Network.requestWillBeSent",
        params: { requestId: "req-1", url: "https://example.com" },
        sessionId: "session-xyz",
    };
    assertEquals(isEvent(msg as ProtocolMessage), true);
});

Deno.test("isEvent returns false for a request (has id)", () => {
    const msg: ProtocolRequest = {
        id: 1,
        method: "DOM.getDocument",
    };
    assertEquals(isEvent(msg as ProtocolMessage), false);
});

Deno.test("isEvent returns false for a response (has id, no method)", () => {
    const msg: ProtocolResponse = {
        id: 1,
        result: {},
    };
    assertEquals(isEvent(msg as ProtocolMessage), false);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

Deno.test("message with both id and method is classified as request, not event", () => {
    const msg = { id: 10, method: "Runtime.evaluate" } as ProtocolMessage;
    assertEquals(isRequest(msg), true);
    assertEquals(isResponse(msg), false);
    assertEquals(isEvent(msg), false);
});

Deno.test("message with only id and result is classified as response", () => {
    const msg = { id: 10, result: {} } as ProtocolMessage;
    assertEquals(isRequest(msg), false);
    assertEquals(isResponse(msg), true);
    assertEquals(isEvent(msg), false);
});

Deno.test("message with only method is classified as event", () => {
    const msg = { method: "DOM.childNodeInserted" } as ProtocolMessage;
    assertEquals(isRequest(msg), false);
    assertEquals(isResponse(msg), false);
    assertEquals(isEvent(msg), true);
});

Deno.test("empty object is classified as none of the three", () => {
    const msg = {} as ProtocolMessage;
    assertEquals(isRequest(msg), false);
    assertEquals(isResponse(msg), false);
    assertEquals(isEvent(msg), false);
});

Deno.test("message with id=0 is still detected as having an id", () => {
    const msg = { id: 0, result: {} } as ProtocolMessage;
    assertEquals(isResponse(msg), true);
    assertEquals(isRequest(msg), false);
});

// ---------------------------------------------------------------------------
// ProtocolErrorCode enum values
// ---------------------------------------------------------------------------

Deno.test("ProtocolErrorCode.PARSE_ERROR equals -32700", () => {
    assertEquals(ProtocolErrorCode.PARSE_ERROR, -32700);
});

Deno.test("ProtocolErrorCode.INVALID_REQUEST equals -32600", () => {
    assertEquals(ProtocolErrorCode.INVALID_REQUEST, -32600);
});

Deno.test("ProtocolErrorCode.METHOD_NOT_FOUND equals -32601", () => {
    assertEquals(ProtocolErrorCode.METHOD_NOT_FOUND, -32601);
});

Deno.test("ProtocolErrorCode.INVALID_PARAMS equals -32602", () => {
    assertEquals(ProtocolErrorCode.INVALID_PARAMS, -32602);
});

Deno.test("ProtocolErrorCode.INTERNAL_ERROR equals -32603", () => {
    assertEquals(ProtocolErrorCode.INTERNAL_ERROR, -32603);
});

Deno.test("ProtocolErrorCode.SERVER_ERROR equals -32000", () => {
    assertEquals(ProtocolErrorCode.SERVER_ERROR, -32000);
});

Deno.test("ProtocolErrorCode.DOMAIN_NOT_ENABLED equals -32001", () => {
    assertEquals(ProtocolErrorCode.DOMAIN_NOT_ENABLED, -32001);
});

Deno.test("ProtocolErrorCode.NODE_NOT_FOUND equals -32002", () => {
    assertEquals(ProtocolErrorCode.NODE_NOT_FOUND, -32002);
});

Deno.test("ProtocolErrorCode.STYLESHEET_NOT_FOUND equals -32003", () => {
    assertEquals(ProtocolErrorCode.STYLESHEET_NOT_FOUND, -32003);
});

Deno.test("ProtocolErrorCode.BREAKPOINT_NOT_FOUND equals -32004", () => {
    assertEquals(ProtocolErrorCode.BREAKPOINT_NOT_FOUND, -32004);
});

Deno.test("ProtocolErrorCode.OBJECT_NOT_FOUND equals -32005", () => {
    assertEquals(ProtocolErrorCode.OBJECT_NOT_FOUND, -32005);
});

Deno.test("ProtocolErrorCode.SESSION_NOT_FOUND equals -32006", () => {
    assertEquals(ProtocolErrorCode.SESSION_NOT_FOUND, -32006);
});

Deno.test("ProtocolErrorCode.TARGET_NOT_FOUND equals -32007", () => {
    assertEquals(ProtocolErrorCode.TARGET_NOT_FOUND, -32007);
});

// ---------------------------------------------------------------------------
// Mutual exclusivity across all three guards
// ---------------------------------------------------------------------------

Deno.test("exactly one type guard returns true for a request message", () => {
    const msg: ProtocolMessage = { id: 1, method: "DOM.getDocument" } as ProtocolMessage;
    const results = [isRequest(msg), isResponse(msg), isEvent(msg)];
    assertEquals(results.filter(Boolean).length, 1);
    assertEquals(results[0], true);
});

Deno.test("exactly one type guard returns true for a response message", () => {
    const msg: ProtocolMessage = { id: 1, result: {} } as ProtocolMessage;
    const results = [isRequest(msg), isResponse(msg), isEvent(msg)];
    assertEquals(results.filter(Boolean).length, 1);
    assertEquals(results[1], true);
});

Deno.test("exactly one type guard returns true for an event message", () => {
    const msg: ProtocolMessage = { method: "DOM.documentUpdated" } as ProtocolMessage;
    const results = [isRequest(msg), isResponse(msg), isEvent(msg)];
    assertEquals(results.filter(Boolean).length, 1);
    assertEquals(results[2], true);
});
