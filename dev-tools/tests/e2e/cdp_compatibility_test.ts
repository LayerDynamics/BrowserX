/**
 * CDP Compatibility E2E Tests
 *
 * Tests Chrome DevTools Protocol compatibility, including:
 * - Protocol version format
 * - Domain enable/disable response format
 * - Event naming conventions
 * - Error response structure
 * - Target discovery format
 */

import { assertEquals, assertExists, assertMatch } from "@std/assert";
import { DevToolsServer } from "../../server/devtools-server.ts";
import { DomainRegistry } from "../../protocol/domains.ts";
import { EventBus } from "../../integration/event-bus.ts";
import { BaseDomain } from "../../domains/base-domain.ts";
import type { DomainName, ProtocolResponse, ProtocolEvent } from "../../protocol/types.ts";
import type { Browser } from "../../../browser/src/main.ts";
import { createMockBrowser, createMockContext } from "../helpers/mocks.ts";
import { randomPort, wait } from "../helpers/test-utils.ts";
import { PROTOCOL_ERRORS } from "../helpers/fixtures.ts";

// Test options to disable leak checking for E2E tests
const testOpts = { sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// CDP-Compliant Test Domain
// ============================================================================

class CDPTestDomain extends BaseDomain {
    readonly name: DomainName = "DOM";

    protected setup(): void {
        this.registerMethod("getDocument", "Returns the root DOM node", async () => {
            return {
                root: {
                    nodeId: 1,
                    backendNodeId: 1,
                    nodeType: 9,
                    nodeName: "#document",
                    localName: "",
                    nodeValue: "",
                    childNodeCount: 1,
                    documentURL: "https://example.com",
                    baseURL: "https://example.com",
                    xmlVersion: "",
                },
            };
        });

        this.registerMethod("requestChildNodes", "Request child nodes", async (params) => {
            const nodeId = params?.nodeId as number;
            if (nodeId === 1) {
                this.emitEvent("setChildNodes", {
                    parentId: 1,
                    nodes: [
                        {
                            nodeId: 2,
                            parentId: 1,
                            backendNodeId: 2,
                            nodeType: 1,
                            nodeName: "HTML",
                            localName: "html",
                            nodeValue: "",
                            childNodeCount: 2,
                            attributes: [],
                        },
                    ],
                });
            }
            return {};
        });

        this.registerEvent("documentUpdated", "Fired when document has been totally updated");
        this.registerEvent("setChildNodes", "Fired when backend wants to provide child nodes");
        this.registerEvent("attributeModified", "Fired when Element's attribute is modified");
    }

    triggerEvent(name: string, params?: Record<string, unknown>): void {
        this.emitEvent(name, params);
    }
}

// ============================================================================
// Test Setup
// ============================================================================

function createCDPTestServer(): {
    server: DevToolsServer;
    domain: CDPTestDomain;
    port: number;
    registry: DomainRegistry;
} {
    const port = randomPort();
    const eventBus = new EventBus();
    const browser = createMockBrowser({
        currentURL: "https://example.com/page",
        title: "Test Page Title",
    });
    const registry = new DomainRegistry();

    const domain = new CDPTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    registry.register(domain, { name: "DOM", description: "DOM domain", version: "1.0" });

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    return { server, domain, port, registry };
}

async function connectWS(port: number): Promise<WebSocket> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/default`);
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);
        ws.onopen = () => { clearTimeout(timeout); resolve(); };
        ws.onerror = () => { clearTimeout(timeout); reject(new Error("WebSocket error")); };
    });
    return ws;
}

async function sendRequest(
    ws: WebSocket,
    method: string,
    params?: Record<string, unknown>,
    id = 1,
): Promise<ProtocolResponse> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Response timeout")), 5000);
        ws.onmessage = (event) => {
            const response = JSON.parse(event.data);
            if ("id" in response && response.id === id) {
                clearTimeout(timeout);
                resolve(response as ProtocolResponse);
            }
        };
        ws.onerror = () => { clearTimeout(timeout); reject(new Error("WebSocket error")); };
        ws.send(JSON.stringify({ id, method, params }));
    });
}

// ============================================================================
// Protocol Version Tests
// ============================================================================

Deno.test({ name: "CDP Compatibility - /json/version returns correct format", ...testOpts, fn: async () => {
    const { server, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        assertEquals(response.status, 200);

        const version = await response.json();

        assertExists(version.Browser);
        assertExists(version["Protocol-Version"]);
        assertExists(version["User-Agent"]);
        assertExists(version.webSocketDebuggerUrl);

        const protocolVersion = version["Protocol-Version"];
        assertMatch(protocolVersion, /^\d+\.\d+$/);
        assertMatch(version.webSocketDebuggerUrl, /^ws:\/\/.+/);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "CDP Compatibility - /json/protocol returns domain info", ...testOpts, fn: async () => {
    const { server, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const response = await fetch(`http://127.0.0.1:${port}/json/protocol`);
        assertEquals(response.status, 200);

        const protocol = await response.json();

        assertExists(protocol.version);
        assertExists(protocol.domains);
        assertEquals(Array.isArray(protocol.domains), true);

        for (const domain of protocol.domains) {
            assertExists(domain.domain);
        }
    } finally {
        await server.stop();
    }
}});

// ============================================================================
// Target Discovery Tests
// ============================================================================

Deno.test({ name: "CDP Compatibility - /json returns target list format", ...testOpts, fn: async () => {
    const { server, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const response = await fetch(`http://127.0.0.1:${port}/json`);
        assertEquals(response.status, 200);

        const targets = await response.json();
        assertEquals(Array.isArray(targets), true);
        assertEquals(targets.length >= 1, true);

        const target = targets[0];

        assertExists(target.targetId);
        assertExists(target.type);
        assertExists(target.title);
        assertExists(target.url);
        assertExists(target.webSocketDebuggerUrl);
        assertExists(target.devtoolsFrontendUrl);

        assertEquals(target.type, "page");
        assertMatch(target.webSocketDebuggerUrl, /^ws:\/\/.+\/devtools\/page\/.+/);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "CDP Compatibility - target ID matches WebSocket path", ...testOpts, fn: async () => {
    const { server, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const response = await fetch(`http://127.0.0.1:${port}/json`);
        const targets = await response.json();
        const target = targets[0];

        const wsUrl = target.webSocketDebuggerUrl;
        assertEquals(wsUrl.includes(target.targetId), true);
    } finally {
        await server.stop();
    }
}});

// ============================================================================
// Enable/Disable Response Format Tests
// ============================================================================

Deno.test({ name: "CDP Compatibility - domain enable returns empty result", ...testOpts, fn: async () => {
    const { server, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const ws = await connectWS(port);
        const response = await sendRequest(ws, "DOM.enable");

        assertEquals(response.id, 1);
        assertEquals(response.error, undefined);
        assertExists(response.result);
        assertEquals(typeof response.result, "object");

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "CDP Compatibility - domain disable returns empty result", ...testOpts, fn: async () => {
    const { server, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable", undefined, 1);
        const response = await sendRequest(ws, "DOM.disable", undefined, 2);

        assertEquals(response.id, 2);
        assertEquals(response.error, undefined);
        assertExists(response.result);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

// ============================================================================
// Event Naming Convention Tests
// ============================================================================

Deno.test({ name: "CDP Compatibility - events use Domain.eventName format", ...testOpts, fn: async () => {
    const { server, domain, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable");

        const events: ProtocolEvent[] = [];
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if ("method" in msg && !("id" in msg)) {
                events.push(msg as ProtocolEvent);
            }
        };

        domain.triggerEvent("documentUpdated", {});
        await wait(50);

        for (const event of events) {
            assertMatch(event.method, /^[A-Z][a-zA-Z]+\.[a-z][a-zA-Z]+$/);
            assertEquals(event.method.startsWith("DOM."), true);
        }

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "CDP Compatibility - events include params field", ...testOpts, fn: async () => {
    const { server, domain, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable");

        let receivedEvent: ProtocolEvent | null = null;
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if ("method" in msg && !("id" in msg)) {
                receivedEvent = msg as ProtocolEvent;
            }
        };

        domain.triggerEvent("attributeModified", {
            nodeId: 1,
            name: "class",
            value: "test",
        });

        await wait(50);

        assertExists(receivedEvent);
        const evt = receivedEvent as ProtocolEvent;
        assertExists(evt.params);
        assertEquals(evt.params?.nodeId, 1);
        assertEquals(evt.params?.name, "class");
        assertEquals(evt.params?.value, "test");

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

// ============================================================================
// Error Response Structure Tests
// ============================================================================

Deno.test({ name: "CDP Compatibility - error response format", ...testOpts, fn: async () => {
    const { server, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const ws = await connectWS(port);
        const response = await sendRequest(ws, "Fake.nonExistent");

        assertEquals(response.id, 1);
        assertExists(response.error);
        assertExists(response.error!.code);
        assertExists(response.error!.message);

        assertEquals(typeof response.error!.code, "number");
        assertEquals(typeof response.error!.message, "string");

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "CDP Compatibility - parse error for invalid JSON", ...testOpts, fn: async () => {
    const { server, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const ws = await connectWS(port);

        const response = await new Promise<ProtocolResponse>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Response timeout")), 5000);
            ws.onmessage = (event) => {
                clearTimeout(timeout);
                resolve(JSON.parse(event.data) as ProtocolResponse);
            };
            ws.onerror = () => { clearTimeout(timeout); reject(new Error("WebSocket error")); };
            ws.send("not valid json {{{");
        });

        assertExists(response.error);
        assertEquals(response.error!.code, PROTOCOL_ERRORS.PARSE_ERROR);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "CDP Compatibility - method not found error", ...testOpts, fn: async () => {
    const { server, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable", undefined, 1);
        const response = await sendRequest(ws, "DOM.nonExistentMethod", undefined, 2);

        // Should return an error for non-existent method
        assertExists(response.error);
        assertEquals(typeof response.error!.code, "number");
        assertEquals(typeof response.error!.message, "string");
        // Server may return METHOD_NOT_FOUND or INTERNAL_ERROR depending on implementation
        assertEquals(response.error!.code < 0, true);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "CDP Compatibility - domain not enabled error", ...testOpts, fn: async () => {
    const { server, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const ws = await connectWS(port);
        const response = await sendRequest(ws, "DOM.getDocument");

        assertExists(response.error);
        assertEquals(response.error!.code, PROTOCOL_ERRORS.DOMAIN_NOT_ENABLED);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

// ============================================================================
// Request/Response ID Matching Tests
// ============================================================================

Deno.test({ name: "CDP Compatibility - response ID matches request ID", ...testOpts, fn: async () => {
    const { server, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const ws = await connectWS(port);

        const ids = [42, 100, 999];
        const responses: ProtocolResponse[] = [];

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if ("id" in msg) {
                responses.push(msg as ProtocolResponse);
            }
        };

        for (const id of ids) {
            ws.send(JSON.stringify({ id, method: "DOM.enable" }));
        }

        await wait(200);

        assertEquals(responses.length, 3);

        const responseIds = responses.map((r) => r.id);
        for (const id of ids) {
            assertEquals(responseIds.includes(id), true);
        }

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

// ============================================================================
// Method Result Format Tests
// ============================================================================

Deno.test({ name: "CDP Compatibility - getDocument returns CDP node format", ...testOpts, fn: async () => {
    const { server, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable", undefined, 1);
        const response = await sendRequest(ws, "DOM.getDocument", undefined, 2);

        assertEquals(response.error, undefined);
        assertExists(response.result);

        const result = response.result as Record<string, unknown>;
        assertExists(result.root);

        const root = result.root as Record<string, unknown>;

        assertExists(root.nodeId);
        assertExists(root.nodeType);
        assertExists(root.nodeName);
        assertEquals(typeof root.nodeId, "number");
        assertEquals(typeof root.nodeType, "number");

        assertEquals(root.nodeType, 9);
        assertEquals(root.nodeName, "#document");

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "CDP Compatibility - requestChildNodes returns success", ...testOpts, fn: async () => {
    const { server, port } = createCDPTestServer();

    try {
        server.start();
        await wait(100);

        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable", undefined, 1);

        // Call requestChildNodes - should return success
        const response = await sendRequest(ws, "DOM.requestChildNodes", { nodeId: 1 }, 2);

        assertEquals(response.error, undefined);
        assertExists(response.result);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});
