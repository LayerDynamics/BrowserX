/**
 * WindowObject Tests
 *
 * Comprehensive tests for the Window object and Web APIs.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { WindowObject } from "../../../src/engine/javascript/WindowObject.ts";
import { V8Context } from "../../../src/engine/javascript/V8Context.ts";
import { DOMNodeType, type DOMNode, type DOMElement } from "../../../src/types/dom.ts";
import { getProperty } from "../../../src/engine/javascript/JSValue.ts";

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

// ============================================================================
// WindowObject Constructor Tests
// ============================================================================

Deno.test({
    name: "WindowObject - constructor creates window object instance",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        assertExists(window);

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - constructor initializes DOM bindings",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        const bindings = window.getDOMBindings();
        assertExists(bindings);

        context.dispose();
    },
});

// ============================================================================
// Install Tests
// ============================================================================

Deno.test({
    name: "WindowObject - install adds window to global",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const windowObj = getProperty(context.global, "window");
        assertEquals(windowObj.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - install adds self alias",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const selfObj = getProperty(context.global, "self");
        assertEquals(selfObj.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - install adds globalThis alias",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const globalThisObj = getProperty(context.global, "globalThis");
        assertEquals(globalThisObj.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - install adds document",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const docObj = getProperty(context.global, "document");
        assertEquals(docObj.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - install adds console",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const consoleObj = getProperty(context.global, "console");
        assertEquals(consoleObj.type, "object");

        context.dispose();
    },
});

// ============================================================================
// Console Tests
// ============================================================================

Deno.test({
    name: "WindowObject - console has log method",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const consoleObj = getProperty(context.global, "console");
        const logFunc = getProperty(consoleObj, "log");
        assertEquals(logFunc.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - console has info method",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const consoleObj = getProperty(context.global, "console");
        const infoFunc = getProperty(consoleObj, "info");
        assertEquals(infoFunc.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - console has warn method",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const consoleObj = getProperty(context.global, "console");
        const warnFunc = getProperty(consoleObj, "warn");
        assertEquals(warnFunc.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - console has error method",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const consoleObj = getProperty(context.global, "console");
        const errorFunc = getProperty(consoleObj, "error");
        assertEquals(errorFunc.type, "function");

        context.dispose();
    },
});

// ============================================================================
// Timer Tests
// ============================================================================

Deno.test({
    name: "WindowObject - install adds setTimeout",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const setTimeoutFunc = getProperty(context.global, "setTimeout");
        assertEquals(setTimeoutFunc.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - install adds clearTimeout",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const clearTimeoutFunc = getProperty(context.global, "clearTimeout");
        assertEquals(clearTimeoutFunc.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - install adds setInterval",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const setIntervalFunc = getProperty(context.global, "setInterval");
        assertEquals(setIntervalFunc.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - install adds clearInterval",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const clearIntervalFunc = getProperty(context.global, "clearInterval");
        assertEquals(clearIntervalFunc.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - clearTimers clears all timers",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();
        window.clearTimers();

        // Should not throw
        assert(true);

        context.dispose();
    },
});

// ============================================================================
// Location Tests
// ============================================================================

Deno.test({
    name: "WindowObject - install adds location",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const locationObj = getProperty(context.global, "location");
        assertEquals(locationObj.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - location has href property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com/path");

        window.install();

        const locationObj = getProperty(context.global, "location");
        const href = getProperty(locationObj, "href");
        assertEquals(href.type, "string");
        if (href.type === "string") {
            assertEquals(href.value, "https://example.com/path");
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - location has protocol property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const locationObj = getProperty(context.global, "location");
        const protocol = getProperty(locationObj, "protocol");
        assertEquals(protocol.type, "string");
        if (protocol.type === "string") {
            assertEquals(protocol.value, "https:");
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - location has host property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com:8080");

        window.install();

        const locationObj = getProperty(context.global, "location");
        const host = getProperty(locationObj, "host");
        assertEquals(host.type, "string");
        if (host.type === "string") {
            assertEquals(host.value, "example.com:8080");
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - location has hostname property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com:8080");

        window.install();

        const locationObj = getProperty(context.global, "location");
        const hostname = getProperty(locationObj, "hostname");
        assertEquals(hostname.type, "string");
        if (hostname.type === "string") {
            assertEquals(hostname.value, "example.com");
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - location has port property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com:8080");

        window.install();

        const locationObj = getProperty(context.global, "location");
        const port = getProperty(locationObj, "port");
        assertEquals(port.type, "string");
        if (port.type === "string") {
            assertEquals(port.value, "8080");
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - location has pathname property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com/path/to/page");

        window.install();

        const locationObj = getProperty(context.global, "location");
        const pathname = getProperty(locationObj, "pathname");
        assertEquals(pathname.type, "string");
        if (pathname.type === "string") {
            assertEquals(pathname.value, "/path/to/page");
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - location has search property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com?query=test");

        window.install();

        const locationObj = getProperty(context.global, "location");
        const search = getProperty(locationObj, "search");
        assertEquals(search.type, "string");
        if (search.type === "string") {
            assertEquals(search.value, "?query=test");
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - location has hash property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com#section");

        window.install();

        const locationObj = getProperty(context.global, "location");
        const hash = getProperty(locationObj, "hash");
        assertEquals(hash.type, "string");
        if (hash.type === "string") {
            assertEquals(hash.value, "#section");
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - location has origin property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com:8080/path");

        window.install();

        const locationObj = getProperty(context.global, "location");
        const origin = getProperty(locationObj, "origin");
        assertEquals(origin.type, "string");
        if (origin.type === "string") {
            assertEquals(origin.value, "https://example.com:8080");
        }

        context.dispose();
    },
});

// ============================================================================
// Navigator Tests
// ============================================================================

Deno.test({
    name: "WindowObject - install adds navigator",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const navigatorObj = getProperty(context.global, "navigator");
        assertEquals(navigatorObj.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - navigator has userAgent property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const navigatorObj = getProperty(context.global, "navigator");
        const userAgent = getProperty(navigatorObj, "userAgent");
        assertEquals(userAgent.type, "string");
        if (userAgent.type === "string") {
            assertEquals(userAgent.value, "GeoProx-Browser/1.0");
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - navigator has language property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const navigatorObj = getProperty(context.global, "navigator");
        const language = getProperty(navigatorObj, "language");
        assertEquals(language.type, "string");
        if (language.type === "string") {
            assertEquals(language.value, "en-US");
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - navigator has platform property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const navigatorObj = getProperty(context.global, "navigator");
        const platform = getProperty(navigatorObj, "platform");
        assertEquals(platform.type, "string");
        if (platform.type === "string") {
            assertEquals(platform.value, "GeoProx");
        }

        context.dispose();
    },
});

// ============================================================================
// Window Properties Tests
// ============================================================================

Deno.test({
    name: "WindowObject - window has innerWidth property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const windowObj = getProperty(context.global, "window");
        const innerWidth = getProperty(windowObj, "innerWidth");
        assertEquals(innerWidth.type, "number");
        if (innerWidth.type === "number") {
            assertEquals(innerWidth.value, 1024);
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - window has innerHeight property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const windowObj = getProperty(context.global, "window");
        const innerHeight = getProperty(windowObj, "innerHeight");
        assertEquals(innerHeight.type, "number");
        if (innerHeight.type === "number") {
            assertEquals(innerHeight.value, 768);
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - window has outerWidth property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const windowObj = getProperty(context.global, "window");
        const outerWidth = getProperty(windowObj, "outerWidth");
        assertEquals(outerWidth.type, "number");
        if (outerWidth.type === "number") {
            assertEquals(outerWidth.value, 1024);
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - window has outerHeight property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const windowObj = getProperty(context.global, "window");
        const outerHeight = getProperty(windowObj, "outerHeight");
        assertEquals(outerHeight.type, "number");
        if (outerHeight.type === "number") {
            assertEquals(outerHeight.value, 768);
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - window has scrollX property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const windowObj = getProperty(context.global, "window");
        const scrollX = getProperty(windowObj, "scrollX");
        assertEquals(scrollX.type, "number");
        if (scrollX.type === "number") {
            assertEquals(scrollX.value, 0);
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - window has scrollY property",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const windowObj = getProperty(context.global, "window");
        const scrollY = getProperty(windowObj, "scrollY");
        assertEquals(scrollY.type, "number");
        if (scrollY.type === "number") {
            assertEquals(scrollY.value, 0);
        }

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - window has scrollTo method",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const windowObj = getProperty(context.global, "window");
        const scrollTo = getProperty(windowObj, "scrollTo");
        assertEquals(scrollTo.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - window has scrollBy method",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const windowObj = getProperty(context.global, "window");
        const scrollBy = getProperty(windowObj, "scrollBy");
        assertEquals(scrollBy.type, "function");

        context.dispose();
    },
});

// ============================================================================
// Web API Tests
// ============================================================================

Deno.test({
    name: "WindowObject - install adds fetch",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const fetchFunc = getProperty(context.global, "fetch");
        assertEquals(fetchFunc.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - install adds localStorage",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const localStorage = getProperty(context.global, "localStorage");
        assertEquals(localStorage.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - localStorage has getItem method",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const localStorage = getProperty(context.global, "localStorage");
        const getItem = getProperty(localStorage, "getItem");
        assertEquals(getItem.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - localStorage has setItem method",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const localStorage = getProperty(context.global, "localStorage");
        const setItem = getProperty(localStorage, "setItem");
        assertEquals(setItem.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - install adds sessionStorage",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const sessionStorage = getProperty(context.global, "sessionStorage");
        assertEquals(sessionStorage.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - sessionStorage has getItem method",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const sessionStorage = getProperty(context.global, "sessionStorage");
        const getItem = getProperty(sessionStorage, "getItem");
        assertEquals(getItem.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - sessionStorage has setItem method",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const sessionStorage = getProperty(context.global, "sessionStorage");
        const setItem = getProperty(sessionStorage, "setItem");
        assertEquals(setItem.type, "function");

        context.dispose();
    },
});

// ============================================================================
// Dialog API Tests
// ============================================================================

Deno.test({
    name: "WindowObject - install adds alert",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const alertFunc = getProperty(context.global, "alert");
        assertEquals(alertFunc.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - install adds confirm",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const confirmFunc = getProperty(context.global, "confirm");
        assertEquals(confirmFunc.type, "function");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - install adds prompt",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        const promptFunc = getProperty(context.global, "prompt");
        assertEquals(promptFunc.type, "function");

        context.dispose();
    },
});

// ============================================================================
// Getter Tests
// ============================================================================

Deno.test({
    name: "WindowObject - getDOMBindings returns DOM bindings",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        const bindings = window.getDOMBindings();

        assertExists(bindings);

        context.dispose();
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "WindowObject - full installation with all APIs",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const window = new WindowObject(context, document, "https://example.com");

        window.install();

        // Check window
        const windowObj = getProperty(context.global, "window");
        assertEquals(windowObj.type, "object");

        // Check console
        const consoleObj = getProperty(context.global, "console");
        assertEquals(consoleObj.type, "object");

        // Check timers
        const setTimeout = getProperty(context.global, "setTimeout");
        assertEquals(setTimeout.type, "function");

        // Check location
        const location = getProperty(context.global, "location");
        assertEquals(location.type, "object");

        // Check navigator
        const navigator = getProperty(context.global, "navigator");
        assertEquals(navigator.type, "object");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - parses complex URL",
    fn() {
        const context = new V8Context();
        const document = createMockDocument();
        const complexUrl = "https://user:pass@example.com:8080/path/to/page?query=test&foo=bar#section";
        const window = new WindowObject(context, document, complexUrl);

        window.install();

        const locationObj = getProperty(context.global, "location");
        const protocol = getProperty(locationObj, "protocol");
        const hostname = getProperty(locationObj, "hostname");
        const port = getProperty(locationObj, "port");
        const pathname = getProperty(locationObj, "pathname");
        const search = getProperty(locationObj, "search");
        const hash = getProperty(locationObj, "hash");

        if (protocol.type === "string") assertEquals(protocol.value, "https:");
        if (hostname.type === "string") assertEquals(hostname.value, "example.com");
        if (port.type === "string") assertEquals(port.value, "8080");
        if (pathname.type === "string") assertEquals(pathname.value, "/path/to/page");
        if (search.type === "string") assertEquals(search.value, "?query=test&foo=bar");
        if (hash.type === "string") assertEquals(hash.value, "#section");

        context.dispose();
    },
});

Deno.test({
    name: "WindowObject - multiple instances are independent",
    fn() {
        const context1 = new V8Context();
        const context2 = new V8Context();
        const document1 = createMockDocument();
        const document2 = createMockDocument();

        const window1 = new WindowObject(context1, document1, "https://example1.com");
        const window2 = new WindowObject(context2, document2, "https://example2.com");

        window1.install();
        window2.install();

        const location1 = getProperty(context1.global, "location");
        const location2 = getProperty(context2.global, "location");

        const href1 = getProperty(location1, "href");
        const href2 = getProperty(location2, "href");

        if (href1.type === "string") assertEquals(href1.value, "https://example1.com/");
        if (href2.type === "string") assertEquals(href2.value, "https://example2.com/");

        context1.dispose();
        context2.dispose();
    },
});
