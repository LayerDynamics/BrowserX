/**
 * Test Mocks for BrowserX DevTools
 *
 * Provides mock implementations of all browser subsystems needed by domain agents.
 * Each factory function returns a mock object that satisfies the interfaces
 * used by DomainInitContext.
 */

import { EventBus } from "../../integration/event-bus.ts";
import type { DomainInitContext } from "../../domains/base-domain.ts";
import { DOMNodeType } from "../../../browser/src/types/dom.ts";
import type { DOMNode, DOMElement } from "../../../browser/src/types/dom.ts";
import type { Cookie } from "../../../browser/src/types/storage.ts";
import type { LayoutBox } from "../../../browser/src/types/rendering.ts";

// ---- Mock DOM ----

let nextNodeId = 1;

/**
 * Create a mock DOM document node
 */
export function createMockDocument(children?: DOMNode[]): DOMNode {
    const doc: DOMNode = {
        nodeId: nextNodeId++,
        nodeType: DOMNodeType.DOCUMENT,
        nodeName: "#document",
        nodeValue: null,
        parentNode: null,
        childNodes: children || [],
        firstChild: null,
        lastChild: null,
        previousSibling: null,
        nextSibling: null,
        ownerDocument: null,
        cloneNode: () => doc,
        appendChild: (child: DOMNode) => { doc.childNodes.push(child); child.parentNode = doc; return child; },
        removeChild: (child: DOMNode) => { doc.childNodes = doc.childNodes.filter((c) => c !== child); child.parentNode = null; return child; },
        insertBefore: (newNode: DOMNode, _ref: DOMNode | null) => { doc.childNodes.unshift(newNode); return newNode; },
        replaceChild: (newNode: DOMNode, oldNode: DOMNode) => { const i = doc.childNodes.indexOf(oldNode); if (i >= 0) doc.childNodes[i] = newNode; return oldNode; },
        contains: (_node: DOMNode) => false,
        compareDocumentPosition: () => 0,
    } as unknown as DOMNode;
    for (const child of doc.childNodes) {
        child.parentNode = doc;
    }
    doc.firstChild = doc.childNodes[0] ?? null;
    doc.lastChild = doc.childNodes[doc.childNodes.length - 1] ?? null;
    return doc;
}

/**
 * Create a mock DOM element
 */
export function createMockElement(
    tagName: string,
    attrs?: Record<string, string>,
    children?: DOMNode[],
    options?: { layout?: Partial<LayoutBox>; computedStyle?: Record<string, string> },
): DOMElement {
    const attrMap = new Map<string, string>(Object.entries(attrs || {}));
    const childNodes = children || [];

    const element = {
        nodeId: nextNodeId++,
        nodeType: DOMNodeType.ELEMENT,
        nodeName: tagName.toUpperCase(),
        tagName: tagName.toUpperCase(),
        nodeValue: null,
        parentNode: null,
        parentElement: null,
        childNodes,
        firstChild: childNodes[0] ?? null,
        lastChild: childNodes[childNodes.length - 1] ?? null,
        previousSibling: null,
        nextSibling: null,
        previousElementSibling: null,
        nextElementSibling: null,
        ownerDocument: null,
        attributes: attrMap,
        id: attrs?.id || "",
        className: attrs?.class || "",
        classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => false },
        cloneNode: () => element,
        appendChild: (child: DOMNode) => { element.childNodes.push(child); child.parentNode = element as unknown as DOMNode; return child; },
        removeChild: (child: DOMNode) => { element.childNodes = element.childNodes.filter((c: DOMNode) => c !== child); child.parentNode = null; return child; },
        insertBefore: (newNode: DOMNode, _ref: DOMNode | null) => { element.childNodes.unshift(newNode); return newNode; },
        replaceChild: (newNode: DOMNode, oldNode: DOMNode) => { const i = element.childNodes.indexOf(oldNode); if (i >= 0) element.childNodes[i] = newNode; return oldNode; },
        contains: (_node: DOMNode) => false,
        compareDocumentPosition: () => 0,
        getAttribute: (name: string) => attrMap.get(name) ?? null,
        setAttribute: (name: string, value: string) => attrMap.set(name, value),
        removeAttribute: (name: string) => attrMap.delete(name),
        hasAttribute: (name: string) => attrMap.has(name),
        querySelector: (_selector: string) => null,
        querySelectorAll: (_selector: string) => [],
        getElementsByTagName: (_name: string) => [],
        getElementsByClassName: (_name: string) => [],
        matches: (_selector: string) => false,
        closest: (_selector: string) => null,
        __computedStyle: options?.computedStyle || {},
        __renderObject: options?.layout ? { layout: createMockLayoutBox(options.layout) } : undefined,
    } as unknown as DOMElement;

    for (const child of childNodes) {
        child.parentNode = element as unknown as DOMNode;
    }

    return element;
}

/**
 * Create a mock text node
 */
export function createMockTextNode(text: string): DOMNode {
    const node: DOMNode = {
        nodeId: nextNodeId++,
        nodeType: DOMNodeType.TEXT,
        nodeName: "#text",
        nodeValue: text,
        parentNode: null,
        childNodes: [],
        firstChild: null,
        lastChild: null,
        previousSibling: null,
        nextSibling: null,
        ownerDocument: null,
        cloneNode: () => node,
        appendChild: () => node,
        removeChild: (child: DOMNode) => child,
        insertBefore: (newNode: DOMNode) => newNode,
        replaceChild: (_n: DOMNode, old: DOMNode) => old,
        contains: () => false,
        compareDocumentPosition: () => 0,
    } as unknown as DOMNode;
    return node;
}

/**
 * Create a mock LayoutBox
 */
export function createMockLayoutBox(overrides?: Partial<LayoutBox>): LayoutBox {
    return {
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        paddingTop: 5,
        paddingRight: 5,
        paddingBottom: 5,
        paddingLeft: 5,
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderLeftWidth: 1,
        marginTop: 10,
        marginRight: 10,
        marginBottom: 10,
        marginLeft: 10,
        getContentBox: () => ({ x: 0, y: 0, width: 100, height: 50 }),
        getPaddingBox: () => ({ x: 0, y: 0, width: 110, height: 60 }),
        getBorderBox: () => ({ x: 0, y: 0, width: 112, height: 62 }),
        getMarginBox: () => ({ x: 0, y: 0, width: 132, height: 82 }),
        getTotalWidth: () => 132,
        getTotalHeight: () => 82,
        ...overrides,
    } as unknown as LayoutBox;
}

// ---- Mock CSSOM ----

export function createMockCSSOM(ruleCount = 5) {
    return {
        getRuleCount: () => ruleCount,
        getStyleSheets: () => [],
        getMatchingRules: () => [],
    };
}

// ---- Mock RenderResult ----

export interface MockRenderResult {
    dom: DOMNode;
    cssom: ReturnType<typeof createMockCSSOM>;
    renderTree: unknown;
    layoutTree: LayoutBox;
    displayList: unknown;
    scriptExecutor?: unknown;
    timing: Record<string, number>;
    resources: Array<{ url: string; type: string; size: number; fetchTime: number; cached: boolean }>;
}

export function createMockRenderResult(overrides?: Partial<MockRenderResult>): MockRenderResult {
    const html = createMockElement("html", {}, [
        createMockElement("head", {}, [
            createMockElement("title", {}, [createMockTextNode("Test Page")]),
        ]),
        createMockElement("body", {}, [
            createMockElement("div", { id: "main", class: "container" }, [
                createMockElement("h1", {}, [createMockTextNode("Hello")]),
                createMockElement("p", {}, [createMockTextNode("World")]),
            ]),
        ]),
    ]);
    const doc = createMockDocument([html]);

    return {
        dom: doc,
        cssom: createMockCSSOM(),
        renderTree: {},
        layoutTree: createMockLayoutBox(),
        displayList: { commands: [] },
        timing: {
            htmlFetch: 50,
            htmlParse: 20,
            cssFetch: 30,
            cssParse: 10,
            scriptExecution: 0,
            styleResolution: 15,
            layoutComputation: 25,
            paintRecording: 10,
            compositing: 5,
            total: 165,
        },
        resources: [
            { url: "https://example.com", type: "html", size: 5000, fetchTime: 50, cached: false },
            { url: "https://example.com/style.css", type: "css", size: 2000, fetchTime: 30, cached: false },
        ],
        ...overrides,
    };
}

// ---- Mock Browser Subsystems ----

export function createMockRequestPipeline() {
    return {
        request: async () => ({ request: {}, response: { statusCode: 200 }, fromCache: false, timing: {} }),
        get: async () => ({ request: {}, response: { statusCode: 200 }, fromCache: false, timing: {} }),
        post: async () => ({ request: {}, response: { statusCode: 200 }, fromCache: false, timing: {} }),
        put: async () => ({ request: {}, response: { statusCode: 200 }, fromCache: false, timing: {} }),
        delete: async () => ({ request: {}, response: { statusCode: 200 }, fromCache: false, timing: {} }),
        getDNSResolver: () => ({}),
        getDNSCache: () => ({}),
        getConnectionPool: () => ({
            getStats: () => ({ activeConnections: 2, idleConnections: 1, totalCreated: 5 }),
        }),
        getConnectionManager: () => ({}),
        getCacheStorage: () => ({}),
        clearDNSCache: () => {},
        close: async () => {},
        getStats: () => ({
            dnsCache: { size: 3, hits: 10, misses: 2 },
            connectionPool: { activeConnections: 2, idleConnections: 1 },
        }),
        getRequestStats: () => ({
            totalRequests: 15,
            totalBytes: 50000,
            cacheHits: 5,
            cacheMisses: 10,
        }),
    };
}

export function createMockRenderingPipeline(renderResult?: MockRenderResult) {
    const result = renderResult || createMockRenderResult();
    return {
        lastRenderResult: result,
        render: async () => result,
        getPixels: async () => new Uint8ClampedArray(100 * 50 * 4),
        screenshot: async () => new Uint8ClampedArray(100 * 50 * 4),
        setViewportSize: () => {},
        getRequestPipeline: () => createMockRequestPipeline(),
        getCompositor: () => ({}),
        clearCache: () => {},
        close: async () => {},
        getStats: () => ({
            viewport: { width: 1024, height: 768 },
            renders: 1,
            lastRenderTime: 165,
            resources: { totalSize: 7000, count: 2 },
        }),
    };
}

export function createMockStorageManager() {
    const stores: Map<string, Map<string, string>> = new Map();

    function getStore(origin: string): Map<string, string> {
        if (!stores.has(origin)) stores.set(origin, new Map());
        return stores.get(origin)!;
    }

    function createOriginStorage(origin: string) {
        const store = getStore(origin);
        return {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
            removeItem: (key: string) => store.delete(key),
            clear: () => store.clear(),
            key: (index: number) => [...store.keys()][index] ?? null,
            get length() { return store.size; },
            keys: () => [...store.keys()],
            values: () => [...store.values()],
            entries: () => [...store.entries()],
            getSize: () => [...store.values()].reduce((s, v) => s + v.length, 0),
            export: () => Object.fromEntries(store),
            import: (data: Record<string, string>) => { for (const [k, v] of Object.entries(data)) store.set(k, v); },
        };
    }

    return {
        getLocalStorage: (origin: string) => createOriginStorage(origin),
        getSessionStorage: (origin: string) => createOriginStorage(`session:${origin}`),
        clearOrigin: (origin: string) => { stores.delete(origin); stores.delete(`session:${origin}`); },
        deleteOrigin: (origin: string) => { stores.delete(origin); stores.delete(`session:${origin}`); },
        getAllOrigins: () => [...stores.keys()].filter((k) => !k.startsWith("session:")),
        getUsage: () => ({ local: 100, session: 50, total: 150 }),
        getTotalUsage: () => 150,
        getEventEmitter: () => ({ emit: () => {}, on: () => {}, off: () => {} }),
        getQuotaManager: () => createMockQuotaManager(),
        export: () => ({ localStorage: {}, sessionStorage: {} }),
        import: () => {},
        clearAllSessionStorage: () => {},
    };
}

export function createMockCookieManager(initialCookies?: Cookie[]) {
    const cookies: Cookie[] = initialCookies ? [...initialCookies] : [];

    return {
        setCookie: (cookie: Cookie, _requestUrl: string) => { cookies.push(cookie); },
        getCookies: (_url: string) => [...cookies],
        getCookiesForRequest: () => [...cookies],
        deleteCookie: (name: string, domain: string, _path: string) => {
            const idx = cookies.findIndex((c) => c.name === name && c.domain === domain);
            if (idx >= 0) cookies.splice(idx, 1);
        },
        deleteCookiesForDomain: (domain: string) => {
            const toRemove = cookies.filter((c) => c.domain === domain);
            for (const c of toRemove) {
                const idx = cookies.indexOf(c);
                if (idx >= 0) cookies.splice(idx, 1);
            }
        },
        clearAll: () => { cookies.length = 0; },
        getAllCookies: () => [...cookies],
        getCookieCount: () => cookies.length,
        dispose: () => { cookies.length = 0; },
    };
}

export function createMockQuotaManager() {
    return {
        hasQuota: () => true,
        updateUsage: () => {},
        getQuota: () => 10485760,
        setQuota: () => {},
        getUsage: () => 1024,
        getUsageByType: () => 512,
        getQuotaInfo: () => ({
            quota: 10485760,
            usage: 1024,
            available: 10484736,
            usageByType: new Map(),
        }),
        getAllOrigins: () => ["https://example.com"],
        clearOrigin: () => {},
        clearAll: () => {},
        getGlobalQuotaInfo: () => ({
            quota: 104857600,
            usage: 2048,
            available: 104855552,
            originCount: 1,
        }),
        setGlobalQuota: () => {},
        setDefaultQuota: () => {},
        getDefaultQuota: () => 10485760,
        isGlobalQuotaExceeded: () => false,
        isOriginQuotaExceeded: () => false,
        getUsagePercentage: () => 0.01,
        getGlobalUsagePercentage: () => 0.002,
        export: () => ({ quotas: {}, usage: {}, globalUsage: 0 }),
        import: () => {},
    };
}

export function createMockBrowser(overrides?: {
    currentURL?: string;
    title?: string;
    config?: Record<string, unknown>;
}) {
    const currentURL = overrides?.currentURL ?? "https://example.com";
    const title = overrides?.title ?? currentURL;
    const config = {
        width: 1024,
        height: 768,
        defaultURL: "about:blank",
        enableJavaScript: false,
        enableStorage: true,
        devicePixelRatio: 1.0,
        ...overrides?.config,
    };

    return {
        getCurrentURL: () => currentURL,
        navigate: async () => {},
        reload: async () => {},
        back: async () => true,
        forward: async () => true,
        canGoBack: () => true,
        canGoForward: () => true,
        getHistoryState: () => ({ length: 3, index: 1, entries: ["about:blank", currentURL, "https://example.com/page2"] }),
        screenshot: async () => new Uint8ClampedArray(config.width * config.height * 4),
        setViewportSize: () => {},
        getConfig: () => config,
        getStats: () => ({
            currentURL,
            title,
            viewport: { width: config.width, height: config.height },
            storage: { quota: {}, cookies: 0, origins: [] },
            rendering: {},
        }),
        getTitle: () => title,
        clearData: () => {},
        getRequestPipeline: () => createMockRequestPipeline(),
        getRenderingPipeline: () => createMockRenderingPipeline(),
        getStorageManager: () => createMockStorageManager(),
        getCookieManager: () => createMockCookieManager(),
        getQuotaManager: () => createMockQuotaManager(),
        close: async () => {},
    };
}

// ---- DomainInitContext factory ----

/**
 * Create a complete mock DomainInitContext for testing domain agents
 */
export function createMockContext(overrides?: {
    browser?: ReturnType<typeof createMockBrowser>;
    requestPipeline?: ReturnType<typeof createMockRequestPipeline>;
    renderingPipeline?: ReturnType<typeof createMockRenderingPipeline>;
    storageManager?: ReturnType<typeof createMockStorageManager>;
    cookieManager?: ReturnType<typeof createMockCookieManager>;
    quotaManager?: ReturnType<typeof createMockQuotaManager>;
    eventBus?: EventBus;
}): DomainInitContext {
    return {
        browser: overrides?.browser ?? createMockBrowser(),
        requestPipeline: overrides?.requestPipeline ?? createMockRequestPipeline(),
        renderingPipeline: overrides?.renderingPipeline ?? createMockRenderingPipeline(),
        storageManager: overrides?.storageManager ?? createMockStorageManager(),
        cookieManager: overrides?.cookieManager ?? createMockCookieManager(),
        quotaManager: overrides?.quotaManager ?? createMockQuotaManager(),
        eventBus: overrides?.eventBus ?? new EventBus(),
    } as unknown as DomainInitContext;
}

/**
 * Reset the auto-incrementing node ID counter (useful between tests)
 */
export function resetNodeIdCounter(): void {
    nextNodeId = 1;
}

// ============================================================================
// Mock Connection, Router, and Session
// ============================================================================

import { Router } from "../../server/router.ts";
import { DomainRegistry } from "../../protocol/domains.ts";
import { DevToolsSession } from "../../protocol/session.ts";
import type { ProtocolRequest, ProtocolResponse, ProtocolEvent } from "../../protocol/types.ts";

/**
 * Create a mock DevToolsConnection for testing
 */
export function createMockConnection(options?: {
    id?: string;
    socketState?: number;
    router?: Router;
    session?: DevToolsSession;
}) {
    const sentMessages: string[] = [];
    const eventListeners: Array<(event: ProtocolEvent) => void> = [];
    let closed = false;

    return {
        id: options?.id ?? `conn-${Date.now()}`,
        closed,

        // WebSocket-like send
        send: (data: string) => {
            if (closed) throw new Error("Connection closed");
            sentMessages.push(data);
        },

        // Event handling
        sendEvent: (event: ProtocolEvent) => {
            if (!closed) {
                sentMessages.push(JSON.stringify(event));
            }
        },

        // Connection state
        isOpen: () => !closed,
        close: () => {
            closed = true;
        },

        // Test utilities
        getSentMessages: () => [...sentMessages],
        getLastSentMessage: () => sentMessages[sentMessages.length - 1],
        clearSentMessages: () => { sentMessages.length = 0; },
        getSentMessageCount: () => sentMessages.length,

        // Event listener management
        addEventListener: (listener: (event: ProtocolEvent) => void) => {
            eventListeners.push(listener);
        },
        removeEventListener: (listener: (event: ProtocolEvent) => void) => {
            const idx = eventListeners.indexOf(listener);
            if (idx >= 0) eventListeners.splice(idx, 1);
        },
        getEventListenerCount: () => eventListeners.length,
    };
}

/**
 * Create a mock Router with configurable responses
 */
export function createMockRouter(options?: {
    registry?: DomainRegistry;
    responses?: Map<string, ProtocolResponse>;
    defaultResponse?: ProtocolResponse;
}) {
    const responses = options?.responses ?? new Map<string, ProtocolResponse>();
    const defaultResponse = options?.defaultResponse ?? { id: 0, result: {} };
    const routedRequests: ProtocolRequest[] = [];

    return {
        // Router methods
        route: async (request: ProtocolRequest): Promise<ProtocolResponse> => {
            routedRequests.push(request);

            const response = responses.get(request.method);
            if (response) {
                return { ...response, id: request.id };
            }
            return { ...defaultResponse, id: request.id };
        },

        parseMessage: (data: string): ProtocolRequest => {
            const parsed = JSON.parse(data);
            if (typeof parsed.id !== "number" || typeof parsed.method !== "string") {
                throw { code: -32600, message: "Invalid request" };
            }
            return parsed as ProtocolRequest;
        },

        serialize: (message: ProtocolResponse | ProtocolEvent): string => {
            return JSON.stringify(message);
        },

        // Test utilities
        setResponse: (method: string, response: ProtocolResponse) => {
            responses.set(method, response);
        },
        getRoutedRequests: () => [...routedRequests],
        getLastRoutedRequest: () => routedRequests[routedRequests.length - 1],
        clearRoutedRequests: () => { routedRequests.length = 0; },
    };
}

/**
 * Create a mock DevToolsSession for testing
 */
export function createMockSession(options?: {
    id?: string;
    browser?: ReturnType<typeof createMockBrowser>;
    registry?: DomainRegistry;
}) {
    const id = options?.id ?? `session-${Date.now()}`;
    const browser = options?.browser ?? createMockBrowser();
    const registry = options?.registry ?? new DomainRegistry();
    let attached = false;

    return {
        id,
        targetId: `page-${id}`,
        browser,
        domains: registry,

        attach: () => { attached = true; },
        detach: () => { attached = false; },
        isAttached: () => attached,

        getTargetInfo: () => ({
            targetId: `page-${id}`,
            type: "page" as const,
            title: browser.getCurrentURL(),
            url: browser.getCurrentURL(),
            attached,
        }),

        dispose: () => {
            attached = false;
            registry.dispose();
        },
    };
}

// ============================================================================
// Enhanced DOM Mocks with querySelector Support
// ============================================================================

/**
 * Create a mock element that can find children by selector
 */
export function createMockElementWithQuery(
    tagName: string,
    attrs?: Record<string, string>,
    children?: DOMNode[],
    options?: { layout?: Partial<LayoutBox>; computedStyle?: Record<string, string> },
): DOMElement {
    const element = createMockElement(tagName, attrs, children, options);
    const childNodes = children || [];

    // Enhanced querySelector that searches children
    (element as unknown as Record<string, unknown>).querySelector = (selector: string) => {
        return findNodeBySelector(childNodes, selector);
    };

    // Enhanced querySelectorAll that searches children
    (element as unknown as Record<string, unknown>).querySelectorAll = (selector: string) => {
        return findAllNodesBySelector(childNodes, selector);
    };

    return element;
}

/**
 * Simple selector matching for mock DOM
 */
function matchesSelector(node: DOMNode, selector: string): boolean {
    if (node.nodeType !== DOMNodeType.ELEMENT) return false;

    const el = node as unknown as DOMElement;

    // ID selector
    if (selector.startsWith("#")) {
        const id = selector.slice(1);
        return el.id === id || (el.attributes?.get?.("id") === id);
    }

    // Class selector
    if (selector.startsWith(".")) {
        const className = selector.slice(1);
        const elClass = el.className || el.attributes?.get?.("class") || "";
        return elClass.split(/\s+/).includes(className);
    }

    // Tag selector
    return el.nodeName?.toLowerCase() === selector.toLowerCase() ||
           el.tagName?.toLowerCase() === selector.toLowerCase();
}

/**
 * Find first node matching selector
 */
function findNodeBySelector(nodes: DOMNode[], selector: string): DOMNode | null {
    for (const node of nodes) {
        if (matchesSelector(node, selector)) {
            return node;
        }
        if (node.childNodes && node.childNodes.length > 0) {
            const found = findNodeBySelector(node.childNodes, selector);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Find all nodes matching selector
 */
function findAllNodesBySelector(nodes: DOMNode[], selector: string): DOMNode[] {
    const results: DOMNode[] = [];
    for (const node of nodes) {
        if (matchesSelector(node, selector)) {
            results.push(node);
        }
        if (node.childNodes && node.childNodes.length > 0) {
            results.push(...findAllNodesBySelector(node.childNodes, selector));
        }
    }
    return results;
}

// ============================================================================
// Script Executor Mock
// ============================================================================

/**
 * Create a mock script executor for Runtime domain testing
 */
export function createMockScriptExecutor() {
    const scripts: Map<string, { source: string; url: string }> = new Map();
    const executionResults: Map<string, unknown> = new Map();
    let nextScriptId = 1;
    let nextObjectId = 1;

    return {
        // Script management
        parseScript: (source: string, url: string = "inline") => {
            const scriptId = `script-${nextScriptId++}`;
            scripts.set(scriptId, { source, url });
            return { scriptId };
        },

        getScriptSource: (scriptId: string) => {
            const script = scripts.get(scriptId);
            return script ? { scriptSource: script.source } : null;
        },

        // Execution
        evaluate: (expression: string, _options?: Record<string, unknown>) => {
            // Simple evaluation for testing
            try {
                // Only evaluate simple expressions for testing
                if (expression.match(/^\d+\s*[\+\-\*\/]\s*\d+$/)) {
                    const result = eval(expression); // Safe for simple math in tests
                    return {
                        result: {
                            type: typeof result,
                            value: result,
                            description: String(result),
                        },
                    };
                }
                return {
                    result: {
                        type: "undefined",
                        value: undefined,
                    },
                };
            } catch (error) {
                return {
                    exceptionDetails: {
                        exceptionId: 1,
                        text: error instanceof Error ? error.message : String(error),
                        lineNumber: 0,
                        columnNumber: 0,
                    },
                };
            }
        },

        // Object management
        createObjectId: () => `obj-${nextObjectId++}`,

        getProperties: (_objectId: string) => {
            return {
                result: [
                    { name: "property1", value: { type: "string", value: "value1" } },
                    { name: "property2", value: { type: "number", value: 42 } },
                ],
            };
        },

        releaseObject: (objectId: string) => {
            executionResults.delete(objectId);
        },

        releaseObjectGroup: (_objectGroup: string) => {},

        // Test utilities
        getScriptCount: () => scripts.size,
        clearScripts: () => scripts.clear(),
    };
}

// ============================================================================
// Network Request/Response Mocks
// ============================================================================

/**
 * Create a mock network request for testing
 */
export function createMockNetworkRequest(overrides?: {
    requestId?: string;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    postData?: string;
}) {
    return {
        requestId: overrides?.requestId ?? `req-${Date.now()}`,
        loaderId: "loader-1",
        documentURL: "https://example.com",
        request: {
            url: overrides?.url ?? "https://api.example.com/data",
            method: overrides?.method ?? "GET",
            headers: overrides?.headers ?? { "User-Agent": "BrowserX" },
            postData: overrides?.postData,
        },
        timestamp: Date.now() / 1000,
        wallTime: Date.now(),
        initiator: { type: "script" },
        type: "XHR",
    };
}

/**
 * Create a mock network response for testing
 */
export function createMockNetworkResponse(overrides?: {
    requestId?: string;
    url?: string;
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    mimeType?: string;
}) {
    return {
        requestId: overrides?.requestId ?? `req-${Date.now()}`,
        loaderId: "loader-1",
        timestamp: Date.now() / 1000,
        type: "XHR",
        response: {
            url: overrides?.url ?? "https://api.example.com/data",
            status: overrides?.status ?? 200,
            statusText: overrides?.statusText ?? "OK",
            headers: overrides?.headers ?? { "Content-Type": "application/json" },
            mimeType: overrides?.mimeType ?? "application/json",
        },
    };
}
