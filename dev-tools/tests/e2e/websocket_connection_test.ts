/**
 * WebSocket Connection E2E Tests
 *
 * Tests actual WebSocket connections to the DevTools server,
 * including message round-trips and domain events.
 */

import { assertEquals, assertExists } from "@std/assert";
import { DevToolsServer } from "../../server/devtools-server.ts";
import { DomainRegistry } from "../../protocol/domains.ts";
import { EventBus } from "../../integration/event-bus.ts";
import { BaseDomain } from "../../domains/base-domain.ts";
import type { DomainName, ProtocolRequest, ProtocolResponse } from "../../protocol/types.ts";
import type { Browser } from "../../../browser/src/main.ts";
import { createMockBrowser, createMockContext } from "../helpers/mocks.ts";
import { randomPort, wait } from "../helpers/test-utils.ts";

// Test options to disable leak checking for E2E tests
const testOpts = { sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// Test Domain
// ============================================================================

class E2ETestDomain extends BaseDomain {
    readonly name: DomainName = "DOM";

    protected setup(): void {
        this.registerMethod("getDocument", "Get document", async () => {
            return {
                root: {
                    nodeId: 1,
                    nodeType: 9,
                    nodeName: "#document",
                },
            };
        });

        this.registerMethod("triggerEvent", "Trigger a test event", async (params) => {
            this.emitEvent("documentUpdated", params);
            return { triggered: true };
        });

        this.registerMethod("echo", "Echo params back", async (params) => {
            return { echo: params };
        });

        this.registerEvent("documentUpdated", "Document updated");
    }

    triggerTestEvent(params?: Record<string, unknown>): void {
        this.emitEvent("documentUpdated", params);
    }
}

// ============================================================================
// Setup Helper
// ============================================================================

function createTestServer(): {
    server: DevToolsServer;
    domain: E2ETestDomain;
    port: number;
} {
    const port = randomPort();
    const eventBus = new EventBus();
    const browser = createMockBrowser();
    const registry = new DomainRegistry();

    const domain = new E2ETestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    registry.register(domain, { name: "DOM", description: "Test", version: "1.0" });

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    return { server, domain, port };
}

// ============================================================================
// WebSocket Connection Tests
// ============================================================================

Deno.test({ name: "WebSocket - connection upgrade on /devtools/page/*", ...testOpts, fn: async () => {
    const { server, port } = createTestServer();

    try {
        server.start();
        await wait(100);

        // Create WebSocket connection
        const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/default`);

        // Wait for open
        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Connection timeout")), 5000);
        });

        assertEquals(ws.readyState, WebSocket.OPEN);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "WebSocket - request-response round trip", ...testOpts, fn: async () => {
    const { server, port } = createTestServer();

    try {
        server.start();
        await wait(100);

        const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/default`);

        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Connection timeout")), 5000);
        });

        // Send enable request
        const enableRequest: ProtocolRequest = {
            id: 1,
            method: "DOM.enable" as ProtocolRequest["method"],
        };

        const enableResponse = await new Promise<ProtocolResponse>((resolve, reject) => {
            ws.onmessage = (event) => {
                const response = JSON.parse(event.data) as ProtocolResponse;
                resolve(response);
            };
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Response timeout")), 5000);

            ws.send(JSON.stringify(enableRequest));
        });

        assertEquals(enableResponse.id, 1);
        assertEquals(enableResponse.error, undefined);
        assertExists(enableResponse.result);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "WebSocket - domain method returns correct result", ...testOpts, fn: async () => {
    const { server, port } = createTestServer();

    try {
        server.start();
        await wait(100);

        const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/default`);

        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Connection timeout")), 5000);
        });

        // Enable first
        ws.send(JSON.stringify({ id: 1, method: "DOM.enable" }));
        await new Promise((r) => {
            ws.onmessage = () => r(undefined);
        });

        // Call getDocument
        const request: ProtocolRequest = {
            id: 2,
            method: "DOM.getDocument" as ProtocolRequest["method"],
        };

        const response = await new Promise<ProtocolResponse>((resolve, reject) => {
            ws.onmessage = (event) => {
                const resp = JSON.parse(event.data) as ProtocolResponse;
                if (resp.id === 2) {
                    resolve(resp);
                }
            };
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Response timeout")), 5000);

            ws.send(JSON.stringify(request));
        });

        assertEquals(response.id, 2);
        assertExists(response.result);
        const result = response.result as Record<string, unknown>;
        assertExists(result.root);
        const root = result.root as Record<string, unknown>;
        assertEquals(root.nodeId, 1);
        assertEquals(root.nodeType, 9);
        assertEquals(root.nodeName, "#document");

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "WebSocket - echo method returns params", ...testOpts, fn: async () => {
    const { server, port } = createTestServer();

    try {
        server.start();
        await wait(100);

        const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/default`);

        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Connection timeout")), 5000);
        });

        // Enable first
        ws.send(JSON.stringify({ id: 1, method: "DOM.enable" }));
        await new Promise((r) => {
            ws.onmessage = () => r(undefined);
        });

        // Call echo
        const testParams = { key: "value", number: 42, nested: { a: 1 } };
        const response = await new Promise<ProtocolResponse>((resolve, reject) => {
            ws.onmessage = (event) => {
                const resp = JSON.parse(event.data) as ProtocolResponse;
                if (resp.id === 2) {
                    resolve(resp);
                }
            };
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Response timeout")), 5000);

            ws.send(JSON.stringify({ id: 2, method: "DOM.echo", params: testParams }));
        });

        assertEquals(response.id, 2);
        assertEquals((response.result as Record<string, unknown>).echo, testParams);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "WebSocket - error response for method before enable", ...testOpts, fn: async () => {
    const { server, port } = createTestServer();

    try {
        server.start();
        await wait(100);

        const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/default`);

        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Connection timeout")), 5000);
        });

        // Call method without enabling first
        const response = await new Promise<ProtocolResponse>((resolve, reject) => {
            ws.onmessage = (event) => {
                const resp = JSON.parse(event.data) as ProtocolResponse;
                resolve(resp);
            };
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Response timeout")), 5000);

            ws.send(JSON.stringify({ id: 1, method: "DOM.getDocument" }));
        });

        assertEquals(response.id, 1);
        assertExists(response.error);
        assertEquals(response.error.code, -32001); // DOMAIN_NOT_ENABLED

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "WebSocket - error response for invalid JSON", ...testOpts, fn: async () => {
    const { server, port } = createTestServer();

    try {
        server.start();
        await wait(100);

        const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/default`);

        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Connection timeout")), 5000);
        });

        // Send invalid JSON
        const response = await new Promise<ProtocolResponse>((resolve, reject) => {
            ws.onmessage = (event) => {
                const resp = JSON.parse(event.data) as ProtocolResponse;
                resolve(resp);
            };
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Response timeout")), 5000);

            ws.send("not valid json");
        });

        assertExists(response.error);
        assertEquals(response.error.code, -32700); // PARSE_ERROR

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "WebSocket - multiple requests sequence", ...testOpts, fn: async () => {
    const { server, port } = createTestServer();

    try {
        server.start();
        await wait(100);

        const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/default`);

        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Connection timeout")), 5000);
        });

        const responses: ProtocolResponse[] = [];
        let responseCount = 0;

        // Set up collector
        ws.onmessage = (event) => {
            const resp = JSON.parse(event.data) as ProtocolResponse;
            if ("id" in resp) {
                responses.push(resp);
                responseCount++;
            }
        };

        // Send multiple requests
        ws.send(JSON.stringify({ id: 1, method: "DOM.enable" }));
        ws.send(JSON.stringify({ id: 2, method: "DOM.getDocument" }));
        ws.send(JSON.stringify({ id: 3, method: "DOM.echo", params: { test: true } }));

        // Wait for all responses
        await new Promise<void>((resolve) => {
            const check = setInterval(() => {
                if (responseCount >= 3) {
                    clearInterval(check);
                    resolve();
                }
            }, 10);
            setTimeout(() => {
                clearInterval(check);
                resolve();
            }, 2000);
        });

        assertEquals(responses.length, 3);
        assertEquals(responses[0].id, 1);
        assertEquals(responses[1].id, 2);
        assertEquals(responses[2].id, 3);

        // All should succeed
        for (const resp of responses) {
            assertEquals(resp.error, undefined);
        }

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "WebSocket - connection close cleanup", ...testOpts, fn: async () => {
    const { server, port } = createTestServer();

    try {
        server.start();
        await wait(100);

        const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/default`);

        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Connection timeout")), 5000);
        });

        // Verify connection was registered
        await wait(50);
        const connectionsBefore = server.getConnections().length;
        assertEquals(connectionsBefore >= 1, true);

        // Close the connection
        ws.close();
        await wait(200);

        // Verify connection was removed
        const connectionsAfter = server.getConnections().length;
        assertEquals(connectionsAfter, connectionsBefore - 1);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "WebSocket - multiple concurrent connections", ...testOpts, fn: async () => {
    const { server, port } = createTestServer();

    try {
        server.start();
        await wait(100);

        // Open multiple connections
        const ws1 = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/target1`);
        const ws2 = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/target2`);
        const ws3 = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/target3`);

        await Promise.all([
            new Promise<void>((resolve) => {
                ws1.onopen = () => resolve();
            }),
            new Promise<void>((resolve) => {
                ws2.onopen = () => resolve();
            }),
            new Promise<void>((resolve) => {
                ws3.onopen = () => resolve();
            }),
        ]);

        await wait(50);

        // All should be connected
        const connections = server.getConnections();
        assertEquals(connections.length, 3);

        ws1.close();
        ws2.close();
        ws3.close();
        await wait(200);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "WebSocket - binary message handling", ...testOpts, fn: async () => {
    const { server, port } = createTestServer();

    try {
        server.start();
        await wait(100);

        const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/default`);
        ws.binaryType = "arraybuffer";

        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Connection timeout")), 5000);
        });

        // Send binary message (should be parsed as JSON if valid)
        const jsonStr = JSON.stringify({ id: 1, method: "DOM.enable" });
        const binaryData = new TextEncoder().encode(jsonStr);

        const response = await new Promise<ProtocolResponse>((resolve, reject) => {
            ws.onmessage = (event) => {
                const data = typeof event.data === "string"
                    ? event.data
                    : new TextDecoder().decode(event.data as ArrayBuffer);
                const resp = JSON.parse(data) as ProtocolResponse;
                resolve(resp);
            };
            ws.onerror = () => reject(new Error("WebSocket error"));
            setTimeout(() => reject(new Error("Response timeout")), 5000);

            ws.send(binaryData);
        });

        assertEquals(response.id, 1);
        assertEquals(response.error, undefined);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});
