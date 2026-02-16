/**
 * Server Startup E2E Tests
 *
 * Tests actual DevTools server startup, HTTP endpoints, and shutdown.
 * These tests start real servers on available ports.
 */

import { assertEquals, assertExists } from "@std/assert";
import { DevToolsServer } from "../../server/devtools-server.ts";
import { DomainRegistry } from "../../protocol/domains.ts";
import { EventBus } from "../../integration/event-bus.ts";
import { BaseDomain } from "../../domains/base-domain.ts";
import type { DomainName } from "../../protocol/types.ts";
import type { Browser } from "../../../browser/src/main.ts";
import { createMockBrowser, createMockContext } from "../helpers/mocks.ts";
import { randomPort, wait } from "../helpers/test-utils.ts";

// Test options to disable leak checking for E2E tests
const testOpts = { sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// Test Domain
// ============================================================================

class TestDomain extends BaseDomain {
    readonly name: DomainName = "DOM";

    protected setup(): void {
        this.registerMethod("getDocument", "Get document", async () => {
            return { root: { nodeId: 1 } };
        });
    }
}

// ============================================================================
// Server Startup Tests
// ============================================================================

Deno.test({ name: "Server Startup - server starts on configured port", ...testOpts, fn: async () => {
    const port = randomPort();
    const browser = createMockBrowser();
    const registry = new DomainRegistry();

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    try {
        server.start();

        // Give server time to start
        await wait(100);

        // Try to fetch from the server
        const response = await fetch(`http://127.0.0.1:${port}/json`);
        assertEquals(response.status, 200);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Server Startup - /json endpoint returns targets", ...testOpts, fn: async () => {
    const port = randomPort();
    const browser = createMockBrowser({ currentURL: "https://example.com" });
    const registry = new DomainRegistry();

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    try {
        server.start();
        await wait(100);

        const response = await fetch(`http://127.0.0.1:${port}/json`);
        const targets = await response.json();

        assertExists(targets);
        assertEquals(Array.isArray(targets), true);
        assertEquals(targets.length >= 1, true);

        const target = targets[0];
        assertExists(target.targetId);
        assertExists(target.type);
        assertExists(target.url);
        assertExists(target.webSocketDebuggerUrl);
        assertExists(target.devtoolsFrontendUrl);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Server Startup - /json/list is equivalent to /json", ...testOpts, fn: async () => {
    const port = randomPort();
    const browser = createMockBrowser();
    const registry = new DomainRegistry();

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    try {
        server.start();
        await wait(100);

        const jsonResponse = await fetch(`http://127.0.0.1:${port}/json`);
        const listResponse = await fetch(`http://127.0.0.1:${port}/json/list`);

        const jsonTargets = await jsonResponse.json();
        const listTargets = await listResponse.json();

        assertEquals(jsonResponse.status, 200);
        assertEquals(listResponse.status, 200);
        assertEquals(JSON.stringify(jsonTargets), JSON.stringify(listTargets));
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Server Startup - /json/version returns version info", ...testOpts, fn: async () => {
    const port = randomPort();
    const browser = createMockBrowser();
    const registry = new DomainRegistry();

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    try {
        server.start();
        await wait(100);

        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        const versionInfo = await response.json();

        assertEquals(response.status, 200);
        assertExists(versionInfo.Browser);
        assertExists(versionInfo["Protocol-Version"]);
        assertExists(versionInfo["User-Agent"]);
        assertExists(versionInfo.webSocketDebuggerUrl);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Server Startup - /json/protocol returns protocol info", ...testOpts, fn: async () => {
    const port = randomPort();
    const eventBus = new EventBus();
    const browser = createMockBrowser();
    const registry = new DomainRegistry();

    // Register a domain
    const domain = new TestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    registry.register(domain, { name: "DOM", description: "Test", version: "1.0" });

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    try {
        server.start();
        await wait(100);

        const response = await fetch(`http://127.0.0.1:${port}/json/protocol`);
        const protocol = await response.json();

        assertEquals(response.status, 200);
        assertExists(protocol.version);
        assertExists(protocol.domains);
        assertEquals(Array.isArray(protocol.domains), true);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Server Startup - unknown endpoint returns 404", ...testOpts, fn: async () => {
    const port = randomPort();
    const browser = createMockBrowser();
    const registry = new DomainRegistry();

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    try {
        server.start();
        await wait(100);

        const response = await fetch(`http://127.0.0.1:${port}/unknown`);
        assertEquals(response.status, 404);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Server Startup - graceful shutdown", ...testOpts, fn: async () => {
    const port = randomPort();
    const browser = createMockBrowser();
    const registry = new DomainRegistry();

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    server.start();
    await wait(100);

    // Verify server is running
    const response1 = await fetch(`http://127.0.0.1:${port}/json`);
    assertEquals(response1.status, 200);

    // Stop the server
    await server.stop();
    await wait(100);

    // Verify server is stopped (should throw connection error)
    try {
        await fetch(`http://127.0.0.1:${port}/json`);
        // If we get here, server is still running
        throw new Error("Server should be stopped");
    } catch (error) {
        // Expected - connection refused
        const errMsg = (error as Error).message;
        assertEquals(
            errMsg.includes("refused") || errMsg.includes("Stopped") || errMsg.includes("Should be"),
            true,
        );
    }
}});

Deno.test({ name: "Server Startup - getUrl returns correct URL", ...testOpts, fn: async () => {
    const port = randomPort();
    const browser = createMockBrowser();
    const registry = new DomainRegistry();

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    assertEquals(server.getUrl(), `ws://127.0.0.1:${port}`);

    // No need to start for this test
}});

Deno.test({ name: "Server Startup - getConnections initially empty", ...testOpts, fn: async () => {
    const port = randomPort();
    const browser = createMockBrowser();
    const registry = new DomainRegistry();

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    try {
        server.start();
        await wait(100);

        const connections = server.getConnections();
        assertEquals(connections.length, 0);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Server Startup - getSessions initially empty", ...testOpts, fn: async () => {
    const port = randomPort();
    const browser = createMockBrowser();
    const registry = new DomainRegistry();

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    try {
        server.start();
        await wait(100);

        const sessions = server.getSessions();
        assertEquals(sessions.length, 0);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Server Startup - multiple HTTP requests concurrent", ...testOpts, fn: async () => {
    const port = randomPort();
    const browser = createMockBrowser();
    const registry = new DomainRegistry();

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    try {
        server.start();
        await wait(100);

        // Make multiple concurrent requests
        const requests = [
            fetch(`http://127.0.0.1:${port}/json`),
            fetch(`http://127.0.0.1:${port}/json/version`),
            fetch(`http://127.0.0.1:${port}/json/protocol`),
            fetch(`http://127.0.0.1:${port}/json/list`),
        ];

        const responses = await Promise.all(requests);

        for (const response of responses) {
            assertEquals(response.status, 200);
        }
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Server Startup - target URL reflects browser URL", ...testOpts, fn: async () => {
    const port = randomPort();
    const browser = createMockBrowser({ currentURL: "https://test-site.example.com/page" });
    const registry = new DomainRegistry();

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    try {
        server.start();
        await wait(100);

        const response = await fetch(`http://127.0.0.1:${port}/json`);
        const targets = await response.json();

        const target = targets[0];
        assertEquals(target.url, "https://test-site.example.com/page");
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Server Startup - about:blank URL handled", ...testOpts, fn: async () => {
    const port = randomPort();
    const browser = createMockBrowser({ currentURL: "about:blank" });
    const registry = new DomainRegistry();

    const server = new DevToolsServer(
        browser as unknown as Browser,
        registry,
        { port, host: "127.0.0.1" },
    );

    try {
        server.start();
        await wait(100);

        const response = await fetch(`http://127.0.0.1:${port}/json`);
        const targets = await response.json();

        const target = targets[0];
        assertEquals(target.url, "about:blank");
        // Title should be "BrowserX" for about:blank
        assertEquals(target.title, "BrowserX");
    } finally {
        await server.stop();
    }
}});
