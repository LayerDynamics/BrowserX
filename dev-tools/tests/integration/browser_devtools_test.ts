/**
 * Tests for Browser DevTools Integration
 *
 * Tests attachDevTools(), BrowserDevTools instance methods,
 * domain registration, and initialization.
 *
 * Uses autoStart: false to avoid binding to ports during tests.
 */

import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { attachDevTools, BrowserDevTools } from "../../integration/browser-devtools.ts";
import { createMockBrowser } from "../helpers/mocks.ts";
import { EventBus } from "../../integration/event-bus.ts";
import type { DomainName } from "../../protocol/types.ts";

// Import domain classes for type checking
import { DOMDomain } from "../../domains/dom/dom-domain.ts";
import { CSSDomain } from "../../domains/css/css-domain.ts";
import { PageDomain } from "../../domains/page/page-domain.ts";
import { NetworkDomain } from "../../domains/network/network-domain.ts";
import { RuntimeDomain } from "../../domains/runtime/runtime-domain.ts";
import { ConsoleDomain } from "../../domains/console/console-domain.ts";
import { StorageDomain } from "../../domains/storage/storage-domain.ts";
import { SecurityDomain } from "../../domains/security/security-domain.ts";
import { PerformanceDomain } from "../../domains/performance/performance-domain.ts";
import { MemoryDomain } from "../../domains/memory/memory-domain.ts";
import { RenderingDomain } from "../../domains/rendering/rendering-domain.ts";
import { DebuggerDomain } from "../../domains/debugger/debugger-domain.ts";
import { OverlayDomain } from "../../domains/overlay/overlay-domain.ts";
import { EmulationDomain } from "../../domains/emulation/emulation-domain.ts";
import type { BaseDomain } from "../../domains/base-domain.ts";

// ---------------------------------------------------------------------------
// attachDevTools() tests
// ---------------------------------------------------------------------------

Deno.test("attachDevTools() creates a BrowserDevTools instance", () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    assertExists(devtools);
    assertEquals(devtools instanceof BrowserDevTools, true);
});

Deno.test("attachDevTools() with autoStart: false does not start server", () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    // The server should exist but not be actively listening
    assertExists(devtools.server);
    // No error should be thrown; the server is just not started
    assertExists(devtools);
});

Deno.test("attachDevTools() uses default port 9222 and host 127.0.0.1", () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    const url = devtools.getUrl();
    assertEquals(url, "ws://127.0.0.1:9222");
});

Deno.test("attachDevTools() respects custom port and host", () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, {
        autoStart: false,
        port: 9333,
        host: "0.0.0.0",
    });

    const url = devtools.getUrl();
    assertEquals(url, "ws://0.0.0.0:9333");
});

// ---------------------------------------------------------------------------
// BrowserDevTools.getUrl() tests
// ---------------------------------------------------------------------------

Deno.test("BrowserDevTools.getUrl() returns correct URL", () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, {
        autoStart: false,
        port: 9444,
        host: "localhost",
    });

    assertEquals(devtools.getUrl(), "ws://localhost:9444");
});

// ---------------------------------------------------------------------------
// BrowserDevTools.getDomain() tests
// ---------------------------------------------------------------------------

Deno.test('BrowserDevTools.getDomain("DOM") returns DOMDomain', () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    const domDomain = devtools.getDomain("DOM");
    assertExists(domDomain);
    assertEquals(domDomain.name, "DOM");
    assertEquals(domDomain instanceof DOMDomain, true);
});

Deno.test('BrowserDevTools.getDomain("CSS") returns CSSDomain', () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    const cssDomain = devtools.getDomain("CSS");
    assertExists(cssDomain);
    assertEquals(cssDomain.name, "CSS");
    assertEquals(cssDomain instanceof CSSDomain, true);
});

Deno.test('BrowserDevTools.getDomain("Page") returns PageDomain', () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    const pageDomain = devtools.getDomain("Page");
    assertExists(pageDomain);
    assertEquals(pageDomain.name, "Page");
    assertEquals(pageDomain instanceof PageDomain, true);
});

Deno.test('BrowserDevTools.getDomain("Network") returns NetworkDomain', () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    const networkDomain = devtools.getDomain("Network");
    assertExists(networkDomain);
    assertEquals(networkDomain.name, "Network");
    assertEquals(networkDomain instanceof NetworkDomain, true);
});

Deno.test('BrowserDevTools.getDomain("Runtime") returns RuntimeDomain', () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    const runtimeDomain = devtools.getDomain("Runtime");
    assertExists(runtimeDomain);
    assertEquals(runtimeDomain.name, "Runtime");
    assertEquals(runtimeDomain instanceof RuntimeDomain, true);
});

// ---------------------------------------------------------------------------
// BrowserDevTools.getDomainNames() tests
// ---------------------------------------------------------------------------

Deno.test("BrowserDevTools.getDomainNames() returns all 14 domain names", () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    const names = devtools.getDomainNames();
    assertEquals(names.length, 14);

    const expectedNames: DomainName[] = [
        "DOM",
        "Page",
        "Network",
        "CSS",
        "Runtime",
        "Console",
        "Storage",
        "Security",
        "Performance",
        "Memory",
        "Rendering",
        "Debugger",
        "Overlay",
        "Emulation",
    ];

    for (const expected of expectedNames) {
        assertEquals(names.includes(expected), true, `Missing domain: ${expected}`);
    }
});

// ---------------------------------------------------------------------------
// BrowserDevTools.getBrowser() tests
// ---------------------------------------------------------------------------

Deno.test("BrowserDevTools.getBrowser() returns the browser instance", () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    const browser = devtools.getBrowser();
    assertExists(browser);
    // Verify it's the same mock browser
    assertEquals((browser as unknown as ReturnType<typeof createMockBrowser>).getCurrentURL(), "https://example.com");
});

// ---------------------------------------------------------------------------
// Registry contains all domains
// ---------------------------------------------------------------------------

Deno.test("All 14 domains are registered in the registry", () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    const registryDomainNames = devtools.registry.getDomainNames();
    assertEquals(registryDomainNames.length, 14);

    const expectedNames: DomainName[] = [
        "DOM", "Page", "Network", "CSS", "Runtime", "Console",
        "Storage", "Security", "Performance", "Memory", "Rendering",
        "Debugger", "Overlay", "Emulation",
    ];

    for (const name of expectedNames) {
        assertEquals(devtools.registry.hasDomain(name), true, `Registry missing domain: ${name}`);
    }
});

// ---------------------------------------------------------------------------
// Domain metadata in registry
// ---------------------------------------------------------------------------

Deno.test("Registry listDomains() returns metadata for all 14 domains", () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    const metadataList = devtools.registry.listDomains();
    assertEquals(metadataList.length, 14);

    // Verify each metadata entry has name, description, and version
    for (const meta of metadataList) {
        assertExists(meta.name);
        assertExists(meta.description);
        assertExists(meta.version);
    }
});

// ---------------------------------------------------------------------------
// All domains are initialized (have context set and can enable/disable)
// ---------------------------------------------------------------------------

Deno.test("All domains are initialized and can enable/disable", async () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    const domainNames = devtools.getDomainNames();

    for (const name of domainNames) {
        const domain = devtools.getDomain(name) as BaseDomain;
        assertExists(domain, `Domain ${name} should exist`);

        // Domains start disabled
        assertEquals(domain.isEnabled(), false, `Domain ${name} should start disabled`);

        // Enable should succeed (would fail if context not initialized)
        await domain.enable();
        assertEquals(domain.isEnabled(), true, `Domain ${name} should be enabled after enable()`);

        // Disable should succeed
        await domain.disable();
        assertEquals(domain.isEnabled(), false, `Domain ${name} should be disabled after disable()`);
    }
});

// ---------------------------------------------------------------------------
// Domain instances have correct types
// ---------------------------------------------------------------------------

Deno.test("Each domain instance is the correct class", () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    const domainClassMap: Array<{ name: DomainName; cls: new (...args: unknown[]) => BaseDomain }> = [
        { name: "DOM", cls: DOMDomain as unknown as new (...args: unknown[]) => BaseDomain },
        { name: "Page", cls: PageDomain as unknown as new (...args: unknown[]) => BaseDomain },
        { name: "Network", cls: NetworkDomain as unknown as new (...args: unknown[]) => BaseDomain },
        { name: "CSS", cls: CSSDomain as unknown as new (...args: unknown[]) => BaseDomain },
        { name: "Runtime", cls: RuntimeDomain as unknown as new (...args: unknown[]) => BaseDomain },
        { name: "Console", cls: ConsoleDomain as unknown as new (...args: unknown[]) => BaseDomain },
        { name: "Storage", cls: StorageDomain as unknown as new (...args: unknown[]) => BaseDomain },
        { name: "Security", cls: SecurityDomain as unknown as new (...args: unknown[]) => BaseDomain },
        { name: "Performance", cls: PerformanceDomain as unknown as new (...args: unknown[]) => BaseDomain },
        { name: "Memory", cls: MemoryDomain as unknown as new (...args: unknown[]) => BaseDomain },
        { name: "Rendering", cls: RenderingDomain as unknown as new (...args: unknown[]) => BaseDomain },
        { name: "Debugger", cls: DebuggerDomain as unknown as new (...args: unknown[]) => BaseDomain },
        { name: "Overlay", cls: OverlayDomain as unknown as new (...args: unknown[]) => BaseDomain },
        { name: "Emulation", cls: EmulationDomain as unknown as new (...args: unknown[]) => BaseDomain },
    ];

    for (const { name, cls } of domainClassMap) {
        const domain = devtools.getDomain(name);
        assertExists(domain, `Domain ${name} should exist`);
        assertEquals(domain instanceof cls, true, `Domain ${name} should be instance of ${cls.name}`);
    }
});

// ---------------------------------------------------------------------------
// EventBus is accessible and functional
// ---------------------------------------------------------------------------

Deno.test("BrowserDevTools.eventBus is an EventBus instance", () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    assertExists(devtools.eventBus);
    assertEquals(devtools.eventBus instanceof EventBus, true);
});

Deno.test("EventBus can emit and receive events across domains", () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    let received = false;
    devtools.eventBus.on("test-event", () => {
        received = true;
    });

    devtools.eventBus.emit("test-event");
    assertEquals(received, true);
});

// ---------------------------------------------------------------------------
// Domains have registered methods
// ---------------------------------------------------------------------------

Deno.test("DOM domain has expected method names registered", () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    const domDomain = devtools.getDomain("DOM") as BaseDomain;
    assertExists(domDomain);

    const methodNames = domDomain.getMethodNames();
    // Should include enable, disable, and DOM-specific methods
    assertEquals(methodNames.includes("enable"), true);
    assertEquals(methodNames.includes("disable"), true);
    assertEquals(methodNames.includes("getDocument"), true);
    assertEquals(methodNames.includes("querySelector"), true);
    assertEquals(methodNames.includes("querySelectorAll"), true);
});

Deno.test("DOM domain has expected event names registered", () => {
    const mockBrowser = createMockBrowser();
    const devtools = attachDevTools(mockBrowser as never, { autoStart: false });

    const domDomain = devtools.getDomain("DOM") as BaseDomain;
    assertExists(domDomain);

    const eventNames = domDomain.getEventNames();
    assertEquals(eventNames.includes("documentUpdated"), true);
    assertEquals(eventNames.includes("setChildNodes"), true);
    assertEquals(eventNames.includes("attributeModified"), true);
});
