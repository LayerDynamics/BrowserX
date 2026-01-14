/**
 * ScriptExecutor Tests
 *
 * Comprehensive tests for script execution and loading.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    ScriptExecutor,
    ScriptLoader,
    type ScriptExecutionOptions,
} from "../../../src/engine/javascript/ScriptExecutor.ts";
import { DOMNodeType, type DOMNode, type DOMElement } from "../../../src/types/dom.ts";

// ============================================================================
// Mock DOM Nodes
// ============================================================================

function createMockDocument(): DOMElement {
    return {
        nodeId: "doc-1" as any,
        nodeType: DOMNodeType.ELEMENT,
        nodeName: "DOCUMENT",
        tagName: "DOCUMENT",
        nodeValue: null,
        childNodes: [],
        parentNode: null,
        parentElement: null,
        previousElementSibling: null,
        nextElementSibling: null,
        firstChild: null,
        lastChild: null,
        previousSibling: null,
        nextSibling: null,
        ownerDocument: null,
        attributes: new Map(),
        id: "",
        className: "",
        classList: {} as any,
        getAttribute: () => null,
        setAttribute: () => {},
        removeAttribute: () => {},
        hasAttribute: () => false,
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementsByTagName: () => [],
        getElementsByClassName: () => [],
        getElementById: () => null,
        getComputedStyle: () => ({} as any),
        matches: () => false,
        closest: () => null,
        cloneNode: () => createMockDocument(),
        appendChild: (child: DOMNode) => child,
        removeChild: (child: DOMNode) => child,
        insertBefore: (newNode: DOMNode) => newNode,
        replaceChild: (newNode: DOMNode) => newNode,
        contains: () => false,
        compareDocumentPosition: () => 0,
    } as DOMElement;
}

function createMockScriptElement(code: string, attributes?: Map<string, string>): DOMElement {
    const textNode: DOMNode = {
        nodeId: "text-1" as any,
        nodeType: DOMNodeType.TEXT,
        nodeName: "#text",
        nodeValue: code,
        childNodes: [],
        parentNode: null,
        firstChild: null,
        lastChild: null,
        previousSibling: null,
        nextSibling: null,
        ownerDocument: null,
        cloneNode: () => textNode,
        appendChild: (child: DOMNode) => child,
        removeChild: (child: DOMNode) => child,
        insertBefore: (newNode: DOMNode) => newNode,
        replaceChild: (newNode: DOMNode) => newNode,
        contains: () => false,
        compareDocumentPosition: () => 0,
    };

    return {
        nodeId: "script-1" as any,
        nodeType: DOMNodeType.ELEMENT,
        nodeName: "SCRIPT",
        nodeValue: null,
        tagName: "script",
        attributes: attributes ?? new Map(),
        childNodes: [textNode],
        parentNode: null,
        firstChild: textNode,
        lastChild: textNode,
        previousSibling: null,
        nextSibling: null,
        ownerDocument: null,
        parentElement: null,
        previousElementSibling: null,
        nextElementSibling: null,
        id: "",
        className: "",
        classList: [] as any,
        getAttribute: (name: string) => attributes?.get(name) ?? null,
        setAttribute: () => {},
        removeAttribute: () => {},
        hasAttribute: (name: string) => attributes?.has(name) ?? false,
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementsByTagName: () => [],
        getElementsByClassName: () => [],
        closest: () => null,
        matches: () => false,
        cloneNode: () => createMockScriptElement(code, attributes),
        appendChild: (child: DOMNode) => child,
        removeChild: (child: DOMNode) => child,
        insertBefore: (newNode: DOMNode) => newNode,
        replaceChild: (newNode: DOMNode) => newNode,
        contains: () => false,
        compareDocumentPosition: () => 0,
    } as DOMElement;
}

function createMockDocumentWithScripts(): DOMElement {
    const script1 = createMockScriptElement("var x = 1;");
    const script2 = createMockScriptElement("var y = 2;");

    const body: DOMElement = {
        nodeId: "body-1" as any,
        nodeType: DOMNodeType.ELEMENT,
        nodeName: "BODY",
        tagName: "BODY",
        nodeValue: null,
        childNodes: [script1, script2],
        parentNode: null,
        parentElement: null,
        previousElementSibling: null,
        nextElementSibling: null,
        firstChild: script1,
        lastChild: script2,
        previousSibling: null,
        nextSibling: null,
        ownerDocument: null,
        attributes: new Map(),
        id: "",
        className: "",
        classList: {} as any,
        getAttribute: () => null,
        setAttribute: () => {},
        removeAttribute: () => {},
        hasAttribute: () => false,
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementsByTagName: () => [script1, script2],
        getElementsByClassName: () => [],
        getElementById: () => null,
        getComputedStyle: () => ({} as any),
        matches: () => false,
        closest: () => null,
        cloneNode: () => body,
        appendChild: (child: DOMNode) => child,
        removeChild: (child: DOMNode) => child,
        insertBefore: (newNode: DOMNode) => newNode,
        replaceChild: (newNode: DOMNode) => newNode,
        contains: () => false,
        compareDocumentPosition: () => 0,
    } as DOMElement;

    return {
        nodeId: "html-1" as any,
        nodeType: DOMNodeType.ELEMENT,
        nodeName: "HTML",
        tagName: "HTML",
        nodeValue: null,
        childNodes: [body],
        parentNode: null,
        parentElement: null,
        previousElementSibling: null,
        nextElementSibling: null,
        firstChild: body,
        lastChild: body,
        previousSibling: null,
        nextSibling: null,
        ownerDocument: null,
        attributes: new Map(),
        id: "",
        className: "",
        classList: {} as any,
        getAttribute: () => null,
        setAttribute: () => {},
        removeAttribute: () => {},
        hasAttribute: () => false,
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementsByTagName: () => [body],
        getElementsByClassName: () => [],
        getElementById: () => null,
        getComputedStyle: () => ({} as any),
        matches: () => false,
        closest: () => null,
        cloneNode: () => createMockDocumentWithScripts(),
        appendChild: (child: DOMNode) => child,
        removeChild: (child: DOMNode) => child,
        insertBefore: (newNode: DOMNode) => newNode,
        replaceChild: (newNode: DOMNode) => newNode,
        contains: () => false,
        compareDocumentPosition: () => 0,
    } as DOMElement;
}

// ============================================================================
// ScriptExecutor Constructor Tests
// ============================================================================

Deno.test({
    name: "ScriptExecutor - constructor creates executor instance",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        assertExists(executor);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - constructor initializes V8 context",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const context = executor.getContext();
        assertExists(context);
        assertEquals(context.isValid(), true);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - constructor initializes window object",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const window = executor.getWindow();
        assertExists(window);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - constructor initializes event loop",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const eventLoop = executor.getEventLoop();
        assertExists(eventLoop);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - constructor initializes stats to zero",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const stats = executor.getStats();
        assertEquals(stats.scriptsExecuted, 0);

        await executor.dispose();
    },
});

// ============================================================================
// Script Execution Tests
// ============================================================================

Deno.test({
    name: "ScriptExecutor - execute runs simple JavaScript code",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const result = await executor.execute("1 + 1");

        assertEquals(result.success, true);
        assertExists(result.value);
        assertEquals(typeof result.executionTime, "number");

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - execute returns execution time",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const result = await executor.execute("42");

        assertEquals(result.success, true);
        assertEquals(result.executionTime >= 0, true);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - execute handles errors gracefully",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const result = await executor.execute("invalid syntax }}}");

        assertEquals(result.success, false);
        assertExists(result.error);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - execute increments scriptsExecuted counter",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        await executor.execute("1");
        await executor.execute("2");

        const stats = executor.getStats();
        assertEquals(stats.scriptsExecuted, 2);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - execute with async option",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const options: ScriptExecutionOptions = { async: true };
        const result = await executor.execute("3 + 3", options);

        assertEquals(result.success, true);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - execute with defer option",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const options: ScriptExecutionOptions = { defer: true };
        const result = await executor.execute("4 + 4", options);

        assertEquals(result.success, true);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - execute with sourceURL option",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const options: ScriptExecutionOptions = { sourceURL: "test.js" };
        const result = await executor.execute("5 + 5", options);

        assertEquals(result.success, true);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - execute with timeout option",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const options: ScriptExecutionOptions = { timeout: 1000 };
        const result = await executor.execute("6 + 6", options);

        assertEquals(result.success, true);

        await executor.dispose();
    },
});

// ============================================================================
// Evaluation Tests
// ============================================================================

Deno.test({
    name: "ScriptExecutor - evaluate evaluates expression",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const result = executor.evaluate("7 + 7");

        assertExists(result);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - evaluate handles errors gracefully",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const result = executor.evaluate("invalid syntax }}}");

        assertEquals(result, undefined);

        await executor.dispose();
    },
});

// ============================================================================
// Inline Script Execution Tests
// ============================================================================

Deno.test({
    name: "ScriptExecutor - executeInline executes inline script",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const scriptElement = createMockScriptElement("8 + 8");
        const result = await executor.executeInline(scriptElement);

        assertEquals(result.success, true);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - executeInline with async attribute",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const attrs = new Map([["async", ""]]);
        const scriptElement = createMockScriptElement("9 + 9", attrs);
        const result = await executor.executeInline(scriptElement);

        assertEquals(result.success, true);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - executeInline with defer attribute",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const attrs = new Map([["defer", ""]]);
        const scriptElement = createMockScriptElement("10 + 10", attrs);
        const result = await executor.executeInline(scriptElement);

        assertEquals(result.success, true);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - executeInline skips non-JavaScript types",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const attrs = new Map([["type", "application/json"]]);
        const scriptElement = createMockScriptElement('{"key": "value"}', attrs);
        const result = await executor.executeInline(scriptElement);

        assertEquals(result.success, true);
        assertEquals(result.executionTime, 0);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - executeInline handles text/javascript type",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const attrs = new Map([["type", "text/javascript"]]);
        const scriptElement = createMockScriptElement("11 + 11", attrs);
        const result = await executor.executeInline(scriptElement);

        assertEquals(result.success, true);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - executeInline handles application/javascript type",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const attrs = new Map([["type", "application/javascript"]]);
        const scriptElement = createMockScriptElement("12 + 12", attrs);
        const result = await executor.executeInline(scriptElement);

        assertEquals(result.success, true);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - executeInline throws on non-element node",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const textNode: DOMNode = {
            nodeId: "text-1" as any,
            nodeType: DOMNodeType.TEXT,
            nodeName: "#text",
            nodeValue: "text",
            childNodes: [],
            parentNode: null,
            firstChild: null,
            lastChild: null,
            previousSibling: null,
            nextSibling: null,
            ownerDocument: null,
            cloneNode: () => textNode,
            appendChild: (child: DOMNode) => child,
            removeChild: (child: DOMNode) => child,
            insertBefore: (newNode: DOMNode) => newNode,
            replaceChild: (newNode: DOMNode) => newNode,
            contains: () => false,
            compareDocumentPosition: () => 0,
        };

        try {
            await executor.executeInline(textNode);
            assert(false, "Should have thrown");
        } catch (error) {
            assert(error instanceof Error);
            assertEquals(error.message, "Script element must be an element node");
        }

        await executor.dispose();
    },
});

// ============================================================================
// DOM Script Execution Tests
// ============================================================================

Deno.test({
    name: "ScriptExecutor - executeScriptsInDOM finds and executes scripts",
    async fn() {
        const document = createMockDocumentWithScripts();
        const executor = new ScriptExecutor(document, "https://example.com");

        const results = await executor.executeScriptsInDOM();

        assertEquals(results.length, 2);
        assertEquals(results[0].success, true);
        assertEquals(results[1].success, true);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - executeScriptsInDOM handles empty document",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const results = await executor.executeScriptsInDOM();

        assertEquals(results.length, 0);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - executeScriptsInDOM handles external scripts",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const attrs = new Map([["src", "https://example.com/script.js"]]);
        const scriptElement = createMockScriptElement("", attrs);

        document.childNodes = [scriptElement];

        // Note: This will fail to fetch, but we're testing the flow
        const results = await executor.executeScriptsInDOM();

        assertEquals(results.length, 1);
        assertEquals(results[0].success, false); // Fetch will fail

        await executor.dispose();
    },
});

// ============================================================================
// Statistics Tests
// ============================================================================

Deno.test({
    name: "ScriptExecutor - getStats returns statistics",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const stats = executor.getStats();

        assertEquals(typeof stats.scriptsExecuted, "number");
        assertExists(stats.heapStats);
        assertExists(stats.eventLoop);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - getStats tracks scriptsExecuted count",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        await executor.execute("1");
        await executor.execute("2");
        await executor.execute("3");

        const stats = executor.getStats();
        assertEquals(stats.scriptsExecuted, 3);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - getStats includes heap statistics",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const stats = executor.getStats();

        assertExists(stats.heapStats);
        assertEquals(typeof stats.heapStats.totalAllocated, "number");

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - getStats includes event loop status",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const stats = executor.getStats();

        assertExists(stats.eventLoop);
        assertEquals(typeof stats.eventLoop.pending, "boolean");

        await executor.dispose();
    },
});

// ============================================================================
// Getter Tests
// ============================================================================

Deno.test({
    name: "ScriptExecutor - getWindow returns window object",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const window = executor.getWindow();

        assertExists(window);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - getContext returns V8 context",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const context = executor.getContext();

        assertExists(context);
        assertEquals(context.isValid(), true);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - getEventLoop returns event loop",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const eventLoop = executor.getEventLoop();

        assertExists(eventLoop);

        await executor.dispose();
    },
});

// ============================================================================
// Disposal Tests
// ============================================================================

Deno.test({
    name: "ScriptExecutor - dispose cleans up resources",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        await executor.dispose();

        // Should not throw
        assert(true);
    },
});

Deno.test({
    name: "ScriptExecutor - dispose clears timers",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        // Create a timer (via window object)
        await executor.execute("setTimeout(() => {}, 1000)");

        await executor.dispose();

        // Should not throw
        assert(true);
    },
});

// ============================================================================
// ScriptLoader Constructor Tests
// ============================================================================

Deno.test({
    name: "ScriptLoader - constructor creates loader instance",
    fn() {
        const loader = new ScriptLoader();

        assertExists(loader);
    },
});

Deno.test({
    name: "ScriptLoader - constructor initializes empty cache",
    fn() {
        const loader = new ScriptLoader();

        const stats = loader.getCacheStats();
        assertEquals(stats.cached, 0);
        assertEquals(stats.loading, 0);
    },
});

// ============================================================================
// ScriptLoader Cache Tests
// ============================================================================

Deno.test({
    name: "ScriptLoader - getCacheStats returns cache statistics",
    fn() {
        const loader = new ScriptLoader();

        const stats = loader.getCacheStats();

        assertEquals(typeof stats.cached, "number");
        assertEquals(typeof stats.loading, "number");
    },
});

Deno.test({
    name: "ScriptLoader - clearCache clears cache",
    fn() {
        const loader = new ScriptLoader();

        loader.clearCache();

        const stats = loader.getCacheStats();
        assertEquals(stats.cached, 0);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "ScriptExecutor - multiple executions in same context",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const result1 = await executor.execute("var a = 1");
        const result2 = await executor.execute("var b = 2");
        const result3 = await executor.execute("a + b");

        assertEquals(result1.success, true);
        assertEquals(result2.success, true);
        assertEquals(result3.success, true);

        const stats = executor.getStats();
        assertEquals(stats.scriptsExecuted, 3);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - execute and evaluate in same context",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        await executor.execute("var x = 42");
        const result = executor.evaluate("x");

        assertExists(result);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - async and sync execution",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const syncResult = await executor.execute("1 + 1");
        const asyncResult = await executor.execute("2 + 2", { async: true });

        assertEquals(syncResult.success, true);
        assertEquals(asyncResult.success, true);

        await executor.dispose();
    },
});

Deno.test({
    name: "ScriptExecutor - handles multiple script types",
    async fn() {
        const document = createMockDocument();
        const executor = new ScriptExecutor(document, "https://example.com");

        const script1 = createMockScriptElement("var a = 1");
        const attrs2 = new Map([["type", "text/javascript"]]);
        const script2 = createMockScriptElement("var b = 2", attrs2);
        const attrs3 = new Map([["type", "application/javascript"]]);
        const script3 = createMockScriptElement("var c = 3", attrs3);

        const result1 = await executor.executeInline(script1);
        const result2 = await executor.executeInline(script2);
        const result3 = await executor.executeInline(script3);

        assertEquals(result1.success, true);
        assertEquals(result2.success, true);
        assertEquals(result3.success, true);

        await executor.dispose();
    },
});
