/**
 * Full Protocol E2E Tests
 *
 * Tests complete CDP session lifecycle with real domain interactions,
 * including DOM.getDocument, Network operations, Page navigation,
 * and Runtime.evaluate.
 */

import { assertEquals, assertExists } from "@std/assert";
import { DevToolsServer } from "../../server/devtools-server.ts";
import { DomainRegistry } from "../../protocol/domains.ts";
import { EventBus } from "../../integration/event-bus.ts";
import { BaseDomain } from "../../domains/base-domain.ts";
import type { DomainName, ProtocolResponse, ProtocolEvent } from "../../protocol/types.ts";
import type { Browser } from "../../../browser/src/main.ts";
import { createMockBrowser, createMockContext } from "../helpers/mocks.ts";
import { randomPort, wait } from "../helpers/test-utils.ts";

// Test options to disable leak checking for E2E tests
const testOpts = { sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// Test Domain Implementations
// ============================================================================

class DOMTestDomain extends BaseDomain {
    readonly name: DomainName = "DOM";
    private documentRoot = {
        nodeId: 1,
        nodeType: 9,
        nodeName: "#document",
        childNodeCount: 1,
        children: [
            {
                nodeId: 2,
                nodeType: 1,
                nodeName: "HTML",
                attributes: [],
                childNodeCount: 2,
                children: [
                    { nodeId: 3, nodeType: 1, nodeName: "HEAD", attributes: [], childNodeCount: 1 },
                    { nodeId: 4, nodeType: 1, nodeName: "BODY", attributes: [], childNodeCount: 0 },
                ],
            },
        ],
    };

    protected setup(): void {
        this.registerMethod("getDocument", "Returns the root DOM node", async (params) => {
            const depth = (params?.depth as number) ?? 1;
            return { root: this.getDocumentWithDepth(this.documentRoot, depth) };
        });

        this.registerMethod("querySelector", "Query selector", async (params) => {
            const selector = params?.selector as string;
            if (selector === "body") return { nodeId: 4 };
            return { nodeId: 0 };
        });

        this.registerMethod("getOuterHTML", "Get outer HTML", async (params) => {
            const nodeId = params?.nodeId as number;
            if (nodeId === 4) return { outerHTML: "<body></body>" };
            return { outerHTML: "" };
        });

        this.registerMethod("setAttributeValue", "Set attribute", async (params) => {
            this.emitEvent("attributeModified", {
                nodeId: params?.nodeId,
                name: params?.name,
                value: params?.value,
            });
            return {};
        });

        this.registerEvent("documentUpdated", "Document updated");
        this.registerEvent("attributeModified", "Attribute modified");
    }

    private getDocumentWithDepth(node: Record<string, unknown>, depth: number): Record<string, unknown> {
        if (depth <= 0) {
            const { children: _c, ...rest } = node;
            return rest;
        }
        const result = { ...node };
        if (Array.isArray(node.children)) {
            result.children = node.children.map((child: Record<string, unknown>) =>
                this.getDocumentWithDepth(child, depth - 1)
            );
        }
        return result;
    }
}

class NetworkTestDomain extends BaseDomain {
    readonly name: DomainName = "Network";
    private cookies: Array<{ name: string; value: string; domain: string }> = [
        { name: "session", value: "abc123", domain: "example.com" },
        { name: "user", value: "test", domain: "example.com" },
    ];

    protected setup(): void {
        this.registerMethod("getCookies", "Get all cookies", async () => {
            return { cookies: this.cookies };
        });

        this.registerMethod("setCookie", "Set a cookie", async (params) => {
            this.cookies.push({
                name: params?.name as string,
                value: params?.value as string,
                domain: (params?.domain as string) || "localhost",
            });
            return { success: true };
        });

        this.registerMethod("deleteCookies", "Delete cookies", async (params) => {
            const name = params?.name as string;
            this.cookies = this.cookies.filter((c) => c.name !== name);
            return {};
        });

        this.registerEvent("requestWillBeSent", "Request will be sent");
        this.registerEvent("responseReceived", "Response received");
    }
}

class PageTestDomain extends BaseDomain {
    readonly name: DomainName = "Page";
    private currentUrl = "about:blank";
    private frameId = "main-frame-1";

    protected setup(): void {
        this.registerMethod("navigate", "Navigate to URL", async (params) => {
            this.currentUrl = params?.url as string;
            this.emitEvent("frameStartedLoading", { frameId: this.frameId });
            setTimeout(() => {
                this.emitEvent("frameNavigated", { frame: { id: this.frameId, url: this.currentUrl } });
                this.emitEvent("frameStoppedLoading", { frameId: this.frameId });
                this.emitEvent("loadEventFired", { timestamp: Date.now() });
            }, 20);
            return { frameId: this.frameId, loaderId: "loader-1" };
        });

        this.registerMethod("getFrameTree", "Get frame tree", async () => {
            return { frameTree: { frame: { id: this.frameId, url: this.currentUrl }, childFrames: [] } };
        });

        this.registerEvent("frameStartedLoading", "Frame started loading");
        this.registerEvent("frameNavigated", "Frame navigated");
        this.registerEvent("frameStoppedLoading", "Frame stopped loading");
        this.registerEvent("loadEventFired", "Load event fired");
    }
}

class RuntimeTestDomain extends BaseDomain {
    readonly name: DomainName = "Runtime";
    private objectIdCounter = 0;
    private storedObjects = new Map<string, unknown>();

    protected setup(): void {
        this.registerMethod("evaluate", "Evaluate expression", async (params) => {
            const expression = params?.expression as string;
            const returnByValue = params?.returnByValue ?? true;

            let result: unknown;
            if (expression === "1 + 1") result = 2;
            else if (expression === "document.title") result = "Test Page";
            else if (expression === "window.location.href") result = "https://example.com";
            else if (expression === "throw new Error('test')") {
                return {
                    result: { type: "object", subtype: "error", className: "Error", description: "Error: test" },
                    exceptionDetails: { exceptionId: 1, text: "Uncaught" },
                };
            } else result = undefined;

            if (returnByValue) {
                return { result: { type: typeof result, value: result } };
            } else {
                const objectId = `obj-${++this.objectIdCounter}`;
                this.storedObjects.set(objectId, result);
                return { result: { type: typeof result, objectId } };
            }
        });

        this.registerMethod("callFunctionOn", "Call function on object", async (params) => {
            const functionDeclaration = params?.functionDeclaration as string;
            if (functionDeclaration?.includes("return this")) {
                return { result: { type: "object", value: {} } };
            }
            return { result: { type: "undefined" } };
        });

        this.registerMethod("releaseObject", "Release object", async (params) => {
            this.storedObjects.delete(params?.objectId as string);
            return {};
        });

        this.registerEvent("consoleAPICalled", "Console API called");
    }
}

// ============================================================================
// Setup Helpers
// ============================================================================

interface TestServerSetup {
    server: DevToolsServer;
    domains: { dom: DOMTestDomain; network: NetworkTestDomain; page: PageTestDomain; runtime: RuntimeTestDomain };
    port: number;
    eventBus: EventBus;
}

function createFullTestServer(): TestServerSetup {
    const port = randomPort();
    const eventBus = new EventBus();
    const browser = createMockBrowser({ currentURL: "https://example.com" });
    const registry = new DomainRegistry();

    const dom = new DOMTestDomain(eventBus);
    const network = new NetworkTestDomain(eventBus);
    const page = new PageTestDomain(eventBus);
    const runtime = new RuntimeTestDomain(eventBus);

    const context = createMockContext({ eventBus });
    dom.initialize(context);
    network.initialize(context);
    page.initialize(context);
    runtime.initialize(context);

    registry.register(dom, { name: "DOM", description: "DOM", version: "1.0" });
    registry.register(network, { name: "Network", description: "Network", version: "1.0" });
    registry.register(page, { name: "Page", description: "Page", version: "1.0" });
    registry.register(runtime, { name: "Runtime", description: "Runtime", version: "1.0" });

    const server = new DevToolsServer(browser as unknown as Browser, registry, { port, host: "127.0.0.1" });

    return { server, domains: { dom, network, page, runtime }, port, eventBus };
}

// ============================================================================
// Test Client Helper
// ============================================================================

class TestClient {
    private ws: WebSocket;
    private messageId = 0;
    private pendingRequests = new Map<number, { resolve: (v: ProtocolResponse) => void; reject: (e: Error) => void }>();
    private eventListeners: Array<(event: ProtocolEvent) => void> = [];

    constructor(ws: WebSocket) {
        this.ws = ws;
        this.ws.onmessage = (event) => this.handleMessage(event);
    }

    private handleMessage(event: MessageEvent): void {
        const message = JSON.parse(event.data);
        if ("id" in message) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                this.pendingRequests.delete(message.id);
                pending.resolve(message as ProtocolResponse);
            }
        } else if ("method" in message) {
            for (const listener of this.eventListeners) {
                listener(message as ProtocolEvent);
            }
        }
    }

    async send(method: string, params?: Record<string, unknown>): Promise<ProtocolResponse> {
        const id = ++this.messageId;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout for ${method}`));
            }, 5000);

            this.pendingRequests.set(id, {
                resolve: (value) => { clearTimeout(timeout); resolve(value); },
                reject: (err) => { clearTimeout(timeout); reject(err); },
            });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    onEvent(listener: (event: ProtocolEvent) => void): void {
        this.eventListeners.push(listener);
    }

    close(): void {
        this.ws.close();
    }
}

async function createTestClient(port: number, targetId = "default"): Promise<TestClient> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/${targetId}`);
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { ws.close(); reject(new Error("Connection timeout")); }, 5000);
        ws.onopen = () => { clearTimeout(timeout); resolve(); };
        ws.onerror = () => { clearTimeout(timeout); reject(new Error("WebSocket error")); };
    });
    return new TestClient(ws);
}

// ============================================================================
// Tests
// ============================================================================

Deno.test({ name: "Full Protocol - complete DOM session lifecycle", ...testOpts, fn: async () => {
    const { server, port } = createFullTestServer();
    try {
        server.start();
        await wait(100);
        const client = await createTestClient(port);

        const enableResponse = await client.send("DOM.enable");
        assertEquals(enableResponse.error, undefined);

        const docResponse = await client.send("DOM.getDocument", { depth: 2 });
        assertEquals(docResponse.error, undefined);
        const root = (docResponse.result as Record<string, unknown>).root as Record<string, unknown>;
        assertEquals(root.nodeName, "#document");

        const queryResponse = await client.send("DOM.querySelector", { nodeId: root.nodeId, selector: "body" });
        assertEquals((queryResponse.result as Record<string, unknown>).nodeId, 4);

        const htmlResponse = await client.send("DOM.getOuterHTML", { nodeId: 4 });
        assertEquals((htmlResponse.result as Record<string, unknown>).outerHTML, "<body></body>");

        await client.send("DOM.disable");
        client.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Full Protocol - Network cookie operations", ...testOpts, fn: async () => {
    const { server, port } = createFullTestServer();
    try {
        server.start();
        await wait(100);
        const client = await createTestClient(port);

        await client.send("Network.enable");

        const initialCookies = await client.send("Network.getCookies");
        assertEquals(((initialCookies.result as Record<string, unknown>).cookies as Array<unknown>).length, 2);

        await client.send("Network.setCookie", { name: "test", value: "value123", domain: "test.com" });

        const updatedCookies = await client.send("Network.getCookies");
        assertEquals(((updatedCookies.result as Record<string, unknown>).cookies as Array<unknown>).length, 3);

        await client.send("Network.deleteCookies", { name: "test" });

        const finalCookies = await client.send("Network.getCookies");
        assertEquals(((finalCookies.result as Record<string, unknown>).cookies as Array<unknown>).length, 2);

        await client.send("Network.disable");
        client.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Full Protocol - Page navigation with events", ...testOpts, fn: async () => {
    const { server, port } = createFullTestServer();
    try {
        server.start();
        await wait(100);
        const client = await createTestClient(port);
        const receivedEvents: ProtocolEvent[] = [];
        client.onEvent((event) => receivedEvents.push(event));

        await client.send("Page.enable");

        const navResponse = await client.send("Page.navigate", { url: "https://test.example.com/page" });
        assertEquals(navResponse.error, undefined);
        assertExists((navResponse.result as Record<string, unknown>).frameId);

        await wait(100);

        const eventMethods = receivedEvents.map((e) => e.method);
        assertEquals(eventMethods.includes("Page.frameStartedLoading"), true);

        const frameResponse = await client.send("Page.getFrameTree");
        const frameTree = (frameResponse.result as Record<string, unknown>).frameTree as Record<string, unknown>;
        assertEquals((frameTree.frame as Record<string, unknown>).url, "https://test.example.com/page");

        await client.send("Page.disable");
        client.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Full Protocol - Runtime evaluate expressions", ...testOpts, fn: async () => {
    const { server, port } = createFullTestServer();
    try {
        server.start();
        await wait(100);
        const client = await createTestClient(port);

        await client.send("Runtime.enable");

        const mathResult = await client.send("Runtime.evaluate", { expression: "1 + 1", returnByValue: true });
        assertEquals(((mathResult.result as Record<string, unknown>).result as Record<string, unknown>).value, 2);

        const titleResult = await client.send("Runtime.evaluate", { expression: "document.title", returnByValue: true });
        assertEquals(((titleResult.result as Record<string, unknown>).result as Record<string, unknown>).value, "Test Page");

        const errorResult = await client.send("Runtime.evaluate", { expression: "throw new Error('test')" });
        assertExists((errorResult.result as Record<string, unknown>).exceptionDetails);

        await client.send("Runtime.disable");
        client.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Full Protocol - multi-domain coordination", ...testOpts, fn: async () => {
    const { server, port } = createFullTestServer();
    try {
        server.start();
        await wait(100);
        const client = await createTestClient(port);
        const receivedEvents: ProtocolEvent[] = [];
        client.onEvent((event) => receivedEvents.push(event));

        await client.send("DOM.enable");
        await client.send("Network.enable");
        await client.send("Page.enable");
        await client.send("Runtime.enable");

        await client.send("Page.navigate", { url: "https://multi.example.com" });
        await wait(50);

        const doc = await client.send("DOM.getDocument", { depth: 1 });
        assertExists((doc.result as Record<string, unknown>).root);

        await client.send("Runtime.evaluate", { expression: "window.location.href" });
        await client.send("Network.getCookies");

        client.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Full Protocol - Runtime object lifecycle", ...testOpts, fn: async () => {
    const { server, port } = createFullTestServer();
    try {
        server.start();
        await wait(100);
        const client = await createTestClient(port);

        await client.send("Runtime.enable");

        const objResult = await client.send("Runtime.evaluate", { expression: "({ a: 1, b: 2 })", returnByValue: false });
        const result = (objResult.result as Record<string, unknown>).result as Record<string, unknown>;
        const objectId = result.objectId as string;
        assertExists(objectId);

        const callResult = await client.send("Runtime.callFunctionOn", {
            objectId,
            functionDeclaration: "function() { return this; }",
        });
        assertEquals(callResult.error, undefined);

        const releaseResult = await client.send("Runtime.releaseObject", { objectId });
        assertEquals(releaseResult.error, undefined);

        await client.send("Runtime.disable");
        client.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Full Protocol - concurrent requests", ...testOpts, fn: async () => {
    const { server, port } = createFullTestServer();
    try {
        server.start();
        await wait(100);
        const client = await createTestClient(port);

        await client.send("DOM.enable");
        await client.send("Runtime.enable");

        const promises = [
            client.send("DOM.getDocument", { depth: 1 }),
            client.send("Runtime.evaluate", { expression: "1 + 1" }),
            client.send("DOM.querySelector", { nodeId: 1, selector: "body" }),
            client.send("Runtime.evaluate", { expression: "document.title" }),
        ];

        const results = await Promise.all(promises);

        for (const result of results) {
            assertEquals(result.error, undefined);
        }

        assertExists((results[0].result as Record<string, unknown>).root);

        client.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Full Protocol - enable/disable cycles", ...testOpts, fn: async () => {
    const { server, port } = createFullTestServer();
    try {
        server.start();
        await wait(100);
        const client = await createTestClient(port);

        for (let i = 0; i < 3; i++) {
            await client.send("DOM.enable");
            const doc = await client.send("DOM.getDocument", { depth: 1 });
            assertExists((doc.result as Record<string, unknown>).root);
            await client.send("DOM.disable");
        }

        await client.send("DOM.enable");
        const finalDoc = await client.send("DOM.getDocument", { depth: 1 });
        assertExists((finalDoc.result as Record<string, unknown>).root);

        client.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Full Protocol - all domains enable/disable", ...testOpts, fn: async () => {
    const { server, port } = createFullTestServer();
    try {
        server.start();
        await wait(100);
        const client = await createTestClient(port);

        const domains = ["DOM", "Network", "Page", "Runtime"];
        for (const domain of domains) {
            const result = await client.send(`${domain}.enable`);
            assertEquals(result.error, undefined);
        }

        for (const domain of domains) {
            const result = await client.send(`${domain}.disable`);
            assertEquals(result.error, undefined);
        }

        client.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});
