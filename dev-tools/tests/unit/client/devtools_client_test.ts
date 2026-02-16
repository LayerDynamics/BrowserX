/**
 * Tests for DevToolsClient
 *
 * Tests the class structure, constructor, domain accessor creation,
 * DomainAccessor method forwarding, and event subscription logic.
 *
 * Since we cannot establish a real WebSocket connection in unit tests,
 * we focus on the client's synchronous API surface and DomainAccessor behavior.
 */

import { assertEquals, assertNotEquals, assertExists } from "@std/assert";
import { DevToolsClient, DomainAccessor } from "../../../client/devtools-client.ts";

// ---------------------------------------------------------------------------
// Constructor tests
// ---------------------------------------------------------------------------

Deno.test("Constructor accepts URL string", () => {
    const client = new DevToolsClient("ws://localhost:9222/devtools/page/1");
    assertExists(client);
    assertEquals(client.isConnected(), false);
});

Deno.test("Constructor accepts config object with URL", () => {
    const client = new DevToolsClient({
        url: "ws://localhost:9222/devtools/page/1",
        timeout: 5000,
    });
    assertExists(client);
    assertEquals(client.isConnected(), false);
});

Deno.test("Constructor with config object uses default timeout when not specified", () => {
    const client = new DevToolsClient({ url: "ws://localhost:9222" });
    assertExists(client);
    // The client should have been created without error
    assertEquals(client.isConnected(), false);
});

// ---------------------------------------------------------------------------
// Domain accessor creation via domain()
// ---------------------------------------------------------------------------

Deno.test('domain("DOM") returns a DomainAccessor', () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.domain("DOM");
    assertExists(accessor);
    assertEquals(accessor instanceof DomainAccessor, true);
});

Deno.test('domain() returns distinct DomainAccessor instances for different domains', () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const domAccessor = client.domain("DOM");
    const cssAccessor = client.domain("CSS");
    assertNotEquals(domAccessor, cssAccessor);
});

// ---------------------------------------------------------------------------
// Domain getter shortcuts
// ---------------------------------------------------------------------------

Deno.test("dom getter returns DomainAccessor for DOM", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.dom;
    assertExists(accessor);
    assertEquals(accessor instanceof DomainAccessor, true);
});

Deno.test("css getter returns DomainAccessor for CSS", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.css;
    assertExists(accessor);
    assertEquals(accessor instanceof DomainAccessor, true);
});

Deno.test("network getter returns DomainAccessor for Network", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.network;
    assertExists(accessor);
});

Deno.test("page getter returns DomainAccessor for Page", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.page;
    assertExists(accessor);
});

Deno.test("runtime getter returns DomainAccessor for Runtime", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.runtime;
    assertExists(accessor);
});

Deno.test("debugger getter returns DomainAccessor for Debugger", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.debugger;
    assertExists(accessor);
});

Deno.test("performance getter returns DomainAccessor for Performance", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.performance;
    assertExists(accessor);
});

Deno.test("memory getter returns DomainAccessor for Memory", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.memory;
    assertExists(accessor);
});

Deno.test("storage getter returns DomainAccessor for Storage", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.storage;
    assertExists(accessor);
});

Deno.test("security getter returns DomainAccessor for Security", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.security;
    assertExists(accessor);
});

Deno.test("rendering getter returns DomainAccessor for Rendering", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.rendering;
    assertExists(accessor);
});

Deno.test("console getter returns DomainAccessor for Console", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.console;
    assertExists(accessor);
});

Deno.test("overlay getter returns DomainAccessor for Overlay", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.overlay;
    assertExists(accessor);
});

Deno.test("emulation getter returns DomainAccessor for Emulation", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.emulation;
    assertExists(accessor);
});

// ---------------------------------------------------------------------------
// DomainAccessor method structure
// ---------------------------------------------------------------------------

Deno.test("DomainAccessor has enable method", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.domain("DOM");
    assertEquals(typeof accessor.enable, "function");
});

Deno.test("DomainAccessor has disable method", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.domain("DOM");
    assertEquals(typeof accessor.disable, "function");
});

Deno.test("DomainAccessor has call method", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.domain("DOM");
    assertEquals(typeof accessor.call, "function");
});

Deno.test("DomainAccessor has on method", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.domain("DOM");
    assertEquals(typeof accessor.on, "function");
});

Deno.test("DomainAccessor has off method", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.domain("DOM");
    assertEquals(typeof accessor.off, "function");
});

Deno.test("DomainAccessor has waitForEvent method", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.domain("DOM");
    assertEquals(typeof accessor.waitForEvent, "function");
});

// ---------------------------------------------------------------------------
// Event subscription logic (on/off/once)
// ---------------------------------------------------------------------------

Deno.test("on() registers an event handler without error", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const handler = (_params: Record<string, unknown>) => {};
    // Should not throw
    client.on("DOM.documentUpdated", handler);
});

Deno.test("off() removes a previously registered handler without error", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const handler = (_params: Record<string, unknown>) => {};
    client.on("DOM.documentUpdated", handler);
    // Should not throw
    client.off("DOM.documentUpdated", handler);
});

Deno.test("off() on non-existent handler does not throw", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const handler = (_params: Record<string, unknown>) => {};
    // Should not throw even if handler was never registered
    client.off("DOM.documentUpdated", handler);
});

Deno.test("once() registers a handler without error", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const handler = (_params: Record<string, unknown>) => {};
    // Should not throw
    client.once("DOM.documentUpdated", handler);
});

Deno.test("DomainAccessor.on() registers domain-scoped event without error", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.domain("Network");
    // Should register for "Network.requestWillBeSent"
    accessor.on("requestWillBeSent", (_params: Record<string, unknown>) => {});
});

Deno.test("DomainAccessor.off() unregisters domain-scoped event without error", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    const accessor = client.domain("Network");
    const handler = (_params: Record<string, unknown>) => {};
    accessor.on("requestWillBeSent", handler);
    accessor.off("requestWillBeSent", handler);
});

// ---------------------------------------------------------------------------
// send() guard - not connected
// ---------------------------------------------------------------------------

Deno.test("send() throws when not connected", async () => {
    const client = new DevToolsClient("ws://localhost:9222");

    try {
        await client.send("DOM.getDocument");
        throw new Error("Should have thrown");
    } catch (error) {
        assertEquals(error instanceof Error, true);
        assertEquals((error as Error).message, "Not connected to DevTools server");
    }
});

// ---------------------------------------------------------------------------
// isConnected() state
// ---------------------------------------------------------------------------

Deno.test("isConnected() returns false before connect()", () => {
    const client = new DevToolsClient("ws://localhost:9222");
    assertEquals(client.isConnected(), false);
});
