/**
 * Console Domain Agent Tests
 *
 * Tests for console message collection, buffer management,
 * and integration with Runtime domain events.
 */

import { assertEquals, assertExists } from "@std/assert";
import { EventBus } from "../../../integration/event-bus.ts";
import { ConsoleDomain } from "../../../domains/console/console-domain.ts";
import {
    createMockContext,
    resetNodeIdCounter,
} from "../../helpers/mocks.ts";
import type { ProtocolEvent } from "../../../protocol/types.ts";

// ---- Tests ----

Deno.test("ConsoleDomain - enable() returns empty object", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);

    const result = await domain.enable();
    assertEquals(result, {});
});

Deno.test("ConsoleDomain - clearMessages() clears buffer", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    // Add some messages
    domain.addMessage({ source: "javascript", level: "info", text: "test 1", timestamp: Date.now() });
    domain.addMessage({ source: "javascript", level: "info", text: "test 2", timestamp: Date.now() });

    // Verify messages are there
    const beforeResult = await domain.handleMethod("getMessages", {});
    const beforeMessages = (beforeResult as Record<string, unknown>).messages as unknown[];
    assertEquals(beforeMessages.length, 2);

    // Clear
    await domain.handleMethod("clearMessages", {});

    // Verify cleared
    const afterResult = await domain.handleMethod("getMessages", {});
    const afterMessages = (afterResult as Record<string, unknown>).messages as unknown[];
    assertEquals(afterMessages.length, 0);
});

Deno.test("ConsoleDomain - getMessages() returns messages", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    domain.addMessage({ source: "javascript", level: "info", text: "hello world", timestamp: 1000 });
    domain.addMessage({ source: "network", level: "error", text: "404 Not Found", timestamp: 2000 });

    const result = await domain.handleMethod("getMessages", {});
    const messages = (result as Record<string, unknown>).messages as Array<Record<string, unknown>>;

    assertEquals(messages.length, 2);
    assertEquals(messages[0].text, "hello world");
    assertEquals(messages[0].source, "javascript");
    assertEquals(messages[0].level, "info");
    assertEquals(messages[1].text, "404 Not Found");
    assertEquals(messages[1].source, "network");
    assertEquals(messages[1].level, "error");
});

Deno.test("ConsoleDomain - subscribes to Runtime.consoleAPICalled events via EventBus", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    // Simulate Runtime domain emitting a console API call
    eventBus.emit("Runtime.consoleAPICalled", {
        type: "log",
        args: [{ value: "from runtime" }],
        timestamp: Date.now(),
    });

    // Verify the console domain received it and added a message
    const result = await domain.handleMethod("getMessages", {});
    const messages = (result as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    assertEquals(messages.length, 1);
    assertEquals(messages[0].text, "from runtime");
    assertEquals(messages[0].source, "javascript");
    assertEquals(messages[0].level, "info");

    // Verify messageAdded event was emitted
    const addedEvent = events.find((e) => e.method === "Console.messageAdded");
    assertExists(addedEvent);
});

Deno.test("ConsoleDomain - subscribes to Runtime.exceptionThrown events via EventBus", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    // Simulate Runtime domain emitting an exception
    eventBus.emit("Runtime.exceptionThrown", {
        timestamp: Date.now(),
        exceptionDetails: {
            text: "Uncaught TypeError: undefined is not a function",
            lineNumber: 42,
            columnNumber: 10,
            url: "https://example.com/script.js",
        },
    });

    const result = await domain.handleMethod("getMessages", {});
    const messages = (result as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    assertEquals(messages.length, 1);
    assertEquals(messages[0].text, "Uncaught TypeError: undefined is not a function");
    assertEquals(messages[0].level, "error");
    assertEquals(messages[0].source, "javascript");
    assertEquals(messages[0].line, 42);
    assertEquals(messages[0].column, 10);
    assertEquals(messages[0].url, "https://example.com/script.js");
});

Deno.test("ConsoleDomain - does not process events when disabled", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    // Do NOT enable the domain

    // Emit a console event - should be ignored because domain is disabled
    eventBus.emit("Runtime.consoleAPICalled", {
        type: "log",
        args: [{ value: "should be ignored" }],
        timestamp: Date.now(),
    });

    // Enable the domain now to get messages
    await domain.enable();

    const result = await domain.handleMethod("getMessages", {});
    const messages = (result as Record<string, unknown>).messages as unknown[];
    assertEquals(messages.length, 0);
});

Deno.test("ConsoleDomain - message buffer stores received events", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    // Add messages via different methods
    domain.log("info", "log message 1");
    domain.log("warning", "log message 2", "network");
    domain.log("error", "log message 3", "security");

    domain.addMessage({
        source: "javascript",
        level: "verbose",
        text: "debug info",
        timestamp: Date.now(),
    });

    const result = await domain.handleMethod("getMessages", {});
    const messages = (result as Record<string, unknown>).messages as Array<Record<string, unknown>>;

    assertEquals(messages.length, 4);
    assertEquals(messages[0].text, "log message 1");
    assertEquals(messages[0].level, "info");
    assertEquals(messages[0].source, "other");
    assertEquals(messages[1].text, "log message 2");
    assertEquals(messages[1].level, "warning");
    assertEquals(messages[1].source, "network");
    assertEquals(messages[2].text, "log message 3");
    assertEquals(messages[2].level, "error");
    assertEquals(messages[2].source, "security");
    assertEquals(messages[3].text, "debug info");
    assertEquals(messages[3].level, "verbose");
});

Deno.test("ConsoleDomain - buffer has max size limit", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    // Add more than maxMessages (1000) messages
    for (let i = 0; i < 1010; i++) {
        domain.addMessage({
            source: "javascript",
            level: "info",
            text: `message ${i}`,
            timestamp: i,
        });
    }

    const result = await domain.handleMethod("getMessages", {});
    const messages = (result as Record<string, unknown>).messages as Array<Record<string, unknown>>;

    // Should be trimmed to 1000
    assertEquals(messages.length, 1000);

    // The oldest messages should have been removed (message 0-9 dropped)
    assertEquals(messages[0].text, "message 10");
    assertEquals(messages[messages.length - 1].text, "message 1009");
});

Deno.test("ConsoleDomain - addMessage emits messageAdded event when enabled", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.addMessage({
        source: "javascript",
        level: "info",
        text: "test message",
        timestamp: Date.now(),
    });

    const addedEvent = events.find((e) => e.method === "Console.messageAdded");
    assertExists(addedEvent);

    const message = (addedEvent.params?.message) as Record<string, unknown>;
    assertExists(message);
    assertEquals(message.text, "test message");
    assertEquals(message.level, "info");
});

Deno.test("ConsoleDomain - addMessage does NOT emit event when disabled", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    // Domain is NOT enabled

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.addMessage({
        source: "javascript",
        level: "info",
        text: "should not emit event",
        timestamp: Date.now(),
    });

    const addedEvent = events.find((e) => e.method === "Console.messageAdded");
    assertEquals(addedEvent, undefined);
});

Deno.test("ConsoleDomain - console type to level mapping", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    // Test various console types via Runtime events
    const typeToLevel: Array<[string, string]> = [
        ["error", "error"],
        ["assert", "error"],
        ["warning", "warning"],
        ["warn", "warning"],
        ["debug", "verbose"],
        ["log", "info"],
        ["info", "info"],
        ["dir", "info"],
        ["table", "info"],
        ["trace", "info"],
        ["count", "info"],
        ["timeEnd", "info"],
    ];

    for (const [consoleType, expectedLevel] of typeToLevel) {
        // Clear messages
        await domain.handleMethod("clearMessages", {});

        // Emit event with this console type
        eventBus.emit("Runtime.consoleAPICalled", {
            type: consoleType,
            args: [{ value: `test ${consoleType}` }],
            timestamp: Date.now(),
        });

        const result = await domain.handleMethod("getMessages", {});
        const messages = (result as Record<string, unknown>).messages as Array<
            Record<string, unknown>
        >;

        assertEquals(
            messages.length,
            1,
            `Expected 1 message for console type "${consoleType}"`,
        );
        assertEquals(
            messages[0].level,
            expectedLevel,
            `Console type "${consoleType}" should map to level "${expectedLevel}"`,
        );
    }
});

Deno.test("ConsoleDomain - dispose() clears messages", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    domain.addMessage({ source: "javascript", level: "info", text: "before dispose", timestamp: Date.now() });

    domain.dispose();

    assertEquals(domain.isEnabled(), false);
});

// ============================================================================
// Enhanced Edge Case Tests
// ============================================================================

Deno.test("ConsoleDomain - disable() returns empty object", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();
    assertEquals(domain.isEnabled(), true);

    const result = await domain.disable();
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), false);
});

Deno.test("ConsoleDomain - getMessages returns empty array initially", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getMessages", {});
    const messages = (result as Record<string, unknown>).messages as unknown[];
    assertEquals(messages, []);
});

Deno.test("ConsoleDomain - clearMessages returns empty object", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    domain.addMessage({ source: "javascript", level: "info", text: "msg", timestamp: Date.now() });

    const result = await domain.handleMethod("clearMessages", {});
    assertEquals(result, {});
});

Deno.test("ConsoleDomain - multiple args in consoleAPICalled joined with spaces", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    eventBus.emit("Runtime.consoleAPICalled", {
        type: "log",
        args: [
            { value: "hello" },
            { value: "world" },
            { description: "[Object]" },
        ],
        timestamp: Date.now(),
    });

    const result = await domain.handleMethod("getMessages", {});
    const messages = (result as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    assertEquals(messages.length, 1);
    assertEquals(messages[0].text, "hello world [Object]");
});

Deno.test("ConsoleDomain - args with no value or description show [object]", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    eventBus.emit("Runtime.consoleAPICalled", {
        type: "log",
        args: [{ }],
        timestamp: Date.now(),
    });

    const result = await domain.handleMethod("getMessages", {});
    const messages = (result as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    assertEquals(messages.length, 1);
    assertEquals(messages[0].text, "[object]");
});

Deno.test("ConsoleDomain - addMessage stores even when disabled but does not emit", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    // Not enabled

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.addMessage({ source: "javascript", level: "info", text: "stored", timestamp: Date.now() });

    // No event emitted
    assertEquals(events.length, 0);

    // But message is stored (enable to check)
    await domain.enable();
    const result = await domain.handleMethod("getMessages", {});
    const messages = (result as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    assertEquals(messages.length, 1);
    assertEquals(messages[0].text, "stored");
});

Deno.test("ConsoleDomain - exceptionThrown with stackTrace is preserved", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const mockStackTrace = {
        callFrames: [
            {
                functionName: "doStuff",
                scriptId: "1",
                url: "https://example.com/app.js",
                lineNumber: 10,
                columnNumber: 5,
            },
        ],
    };

    eventBus.emit("Runtime.exceptionThrown", {
        timestamp: Date.now(),
        exceptionDetails: {
            text: "ReferenceError: x is not defined",
            lineNumber: 10,
            columnNumber: 5,
            url: "https://example.com/app.js",
            stackTrace: mockStackTrace,
        },
    });

    const result = await domain.handleMethod("getMessages", {});
    const messages = (result as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    assertEquals(messages.length, 1);
    assertEquals(messages[0].text, "ReferenceError: x is not defined");
    assertExists(messages[0].stackTrace);
});

Deno.test("ConsoleDomain - unknown console type maps to info level", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    eventBus.emit("Runtime.consoleAPICalled", {
        type: "unknownType",
        args: [{ value: "test" }],
        timestamp: Date.now(),
    });

    const result = await domain.handleMethod("getMessages", {});
    const messages = (result as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    assertEquals(messages.length, 1);
    assertEquals(messages[0].level, "info");
});

Deno.test("ConsoleDomain - handleMethod throws for unknown method", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new ConsoleDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    let threw = false;
    try {
        await domain.handleMethod("nonExistentMethod", {});
    } catch (e) {
        threw = true;
        assertEquals((e as Error).message.includes("not found"), true);
    }
    assertEquals(threw, true);
});
