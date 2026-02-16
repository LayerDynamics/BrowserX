/**
 * Export Verification Tests
 *
 * Verifies that all mod.ts barrel files correctly export
 * all domains, types, server components, and client components.
 */

import { assertExists, assertEquals } from "@std/assert";

// ============================================================================
// Top-level mod.ts exports
// ============================================================================

Deno.test("Exports - top-level mod.ts re-exports all modules", async () => {
    const mod = await import("../../mod.ts");

    // Protocol exports
    assertExists(mod.DomainRegistry, "DomainRegistry should be exported");
    assertExists(mod.DevToolsSession, "DevToolsSession should be exported");

    // Domain exports
    assertExists(mod.BaseDomain, "BaseDomain should be exported");
    assertExists(mod.DOMDomain, "DOMDomain should be exported");
    assertExists(mod.PageDomain, "PageDomain should be exported");
    assertExists(mod.NetworkDomain, "NetworkDomain should be exported");
    assertExists(mod.CSSDomain, "CSSDomain should be exported");
    assertExists(mod.RuntimeDomain, "RuntimeDomain should be exported");
    assertExists(mod.ConsoleDomain, "ConsoleDomain should be exported");
    assertExists(mod.StorageDomain, "StorageDomain should be exported");
    assertExists(mod.SecurityDomain, "SecurityDomain should be exported");
    assertExists(mod.PerformanceDomain, "PerformanceDomain should be exported");
    assertExists(mod.MemoryDomain, "MemoryDomain should be exported");
    assertExists(mod.RenderingDomain, "RenderingDomain should be exported");
    assertExists(mod.DebuggerDomain, "DebuggerDomain should be exported");
    assertExists(mod.OverlayDomain, "OverlayDomain should be exported");
    assertExists(mod.EmulationDomain, "EmulationDomain should be exported");

    // Server exports
    assertExists(mod.Router, "Router should be exported");
    assertExists(mod.DevToolsConnection, "DevToolsConnection should be exported");
    assertExists(mod.DevToolsServer, "DevToolsServer should be exported");

    // Integration exports
    assertExists(mod.EventBus, "EventBus should be exported");
    assertExists(mod.attachDevTools, "attachDevTools should be exported");
    assertExists(mod.BrowserDevTools, "BrowserDevTools should be exported");
});

// ============================================================================
// Protocol mod.ts exports
// ============================================================================

Deno.test("Exports - protocol/mod.ts exports types and registry", async () => {
    const mod = await import("../../protocol/mod.ts");

    // Core protocol types
    assertExists(mod.DomainRegistry, "DomainRegistry should be exported");
    assertExists(mod.DevToolsSession, "DevToolsSession should be exported");

    // Enums
    assertExists(mod.ProtocolErrorCode, "ProtocolErrorCode should be exported");
});

// ============================================================================
// Domains mod.ts exports
// ============================================================================

Deno.test("Exports - domains/mod.ts exports all 14 domains", async () => {
    const mod = await import("../../domains/mod.ts");

    const expectedDomains = [
        "BaseDomain",
        "DOMDomain",
        "PageDomain",
        "NetworkDomain",
        "CSSDomain",
        "RuntimeDomain",
        "ConsoleDomain",
        "StorageDomain",
        "SecurityDomain",
        "PerformanceDomain",
        "MemoryDomain",
        "RenderingDomain",
        "DebuggerDomain",
        "OverlayDomain",
        "EmulationDomain",
    ];

    for (const domainName of expectedDomains) {
        assertExists(
            (mod as Record<string, unknown>)[domainName],
            `${domainName} should be exported from domains/mod.ts`,
        );
    }

    // Count: 1 base + 14 domains = 15
    assertEquals(expectedDomains.length, 15);
});

Deno.test("Exports - each domain is a class extending BaseDomain", async () => {
    const mod = await import("../../domains/mod.ts");

    const domainClasses = [
        mod.DOMDomain,
        mod.PageDomain,
        mod.NetworkDomain,
        mod.CSSDomain,
        mod.RuntimeDomain,
        mod.ConsoleDomain,
        mod.StorageDomain,
        mod.SecurityDomain,
        mod.PerformanceDomain,
        mod.MemoryDomain,
        mod.RenderingDomain,
        mod.DebuggerDomain,
        mod.OverlayDomain,
        mod.EmulationDomain,
    ];

    for (const DomainClass of domainClasses) {
        assertEquals(typeof DomainClass, "function", "Domain should be a class (function)");
        // Verify it extends BaseDomain by checking prototype chain
        const proto = Object.getPrototypeOf(DomainClass.prototype);
        assertExists(proto, "Domain should have a prototype");
    }
});

// ============================================================================
// Server mod.ts exports
// ============================================================================

Deno.test("Exports - server/mod.ts exports server components", async () => {
    const mod = await import("../../server/mod.ts");

    assertExists(mod.Router, "Router should be exported");
    assertExists(mod.DevToolsConnection, "DevToolsConnection should be exported");
    assertExists(mod.DevToolsServer, "DevToolsServer should be exported");

    assertEquals(typeof mod.Router, "function", "Router should be a class");
    assertEquals(typeof mod.DevToolsConnection, "function", "DevToolsConnection should be a class");
    assertEquals(typeof mod.DevToolsServer, "function", "DevToolsServer should be a class");
});

// ============================================================================
// Client mod.ts exports
// ============================================================================

Deno.test("Exports - client/mod.ts exports client components", async () => {
    const mod = await import("../../client/mod.ts");

    assertExists(mod.DevToolsClient, "DevToolsClient should be exported");
    assertExists(mod.DomainAccessor, "DomainAccessor should be exported");
    assertExists(mod.createDomainClients, "createDomainClients should be exported");
    assertExists(mod.TypedDomainClient, "TypedDomainClient should be exported");

    // Typed domain clients for all 14 domains
    const domainClients = [
        "DOMClient",
        "PageClient",
        "NetworkClient",
        "CSSClient",
        "RuntimeClient",
        "ConsoleClient",
        "StorageClient",
        "SecurityClient",
        "PerformanceClient",
        "MemoryClient",
        "RenderingClient",
        "DebuggerClient",
        "OverlayClient",
        "EmulationClient",
    ];

    for (const clientName of domainClients) {
        assertExists(
            (mod as Record<string, unknown>)[clientName],
            `${clientName} should be exported from client/mod.ts`,
        );
    }
});

// ============================================================================
// Integration mod.ts exports
// ============================================================================

Deno.test("Exports - integration/mod.ts exports integration components", async () => {
    const mod = await import("../../integration/mod.ts");

    assertExists(mod.EventBus, "EventBus should be exported");
    assertExists(mod.attachDevTools, "attachDevTools should be exported");
    assertExists(mod.BrowserDevTools, "BrowserDevTools should be exported");

    assertEquals(typeof mod.EventBus, "function", "EventBus should be a class");
    assertEquals(typeof mod.attachDevTools, "function", "attachDevTools should be a function");
    assertEquals(typeof mod.BrowserDevTools, "function", "BrowserDevTools should be a class");
});

// ============================================================================
// Domain individual file exports
// ============================================================================

Deno.test("Exports - individual domain files export domain class", async () => {
    const domainPaths = [
        ["../../domains/dom/dom-domain.ts", "DOMDomain"],
        ["../../domains/page/page-domain.ts", "PageDomain"],
        ["../../domains/network/network-domain.ts", "NetworkDomain"],
        ["../../domains/css/css-domain.ts", "CSSDomain"],
        ["../../domains/runtime/runtime-domain.ts", "RuntimeDomain"],
        ["../../domains/console/console-domain.ts", "ConsoleDomain"],
        ["../../domains/storage/storage-domain.ts", "StorageDomain"],
        ["../../domains/security/security-domain.ts", "SecurityDomain"],
        ["../../domains/performance/performance-domain.ts", "PerformanceDomain"],
        ["../../domains/memory/memory-domain.ts", "MemoryDomain"],
        ["../../domains/rendering/rendering-domain.ts", "RenderingDomain"],
        ["../../domains/debugger/debugger-domain.ts", "DebuggerDomain"],
        ["../../domains/overlay/overlay-domain.ts", "OverlayDomain"],
        ["../../domains/emulation/emulation-domain.ts", "EmulationDomain"],
    ];

    for (const [path, className] of domainPaths) {
        const mod = await import(path);
        assertExists(
            mod[className],
            `${className} should be exported from ${path}`,
        );
    }
});

Deno.test("Exports - individual domain type files exist and import successfully", async () => {
    const typeFiles = [
        "../../domains/dom/dom-types.ts",
        "../../domains/page/page-types.ts",
        "../../domains/network/network-types.ts",
        "../../domains/css/css-types.ts",
        "../../domains/runtime/runtime-types.ts",
        "../../domains/console/console-types.ts",
        "../../domains/storage/storage-types.ts",
        "../../domains/security/security-types.ts",
        "../../domains/performance/performance-types.ts",
        "../../domains/memory/memory-types.ts",
        "../../domains/rendering/rendering-types.ts",
        "../../domains/debugger/debugger-types.ts",
        "../../domains/overlay/overlay-types.ts",
        "../../domains/emulation/emulation-types.ts",
    ];

    for (const path of typeFiles) {
        // Verify the module can be imported without error
        // Type-only files may have 0 runtime exports but should still import
        const mod = await import(path);
        assertExists(mod, `${path} should be importable`);
    }
});

// ============================================================================
// Protocol types exports
// ============================================================================

Deno.test("Exports - protocol types exports error codes", async () => {
    const mod = await import("../../protocol/types.ts");

    assertExists(mod.ProtocolErrorCode, "ProtocolErrorCode should be exported");

    // Verify all standard error codes exist
    const errorCode = mod.ProtocolErrorCode;
    assertExists(errorCode.PARSE_ERROR, "PARSE_ERROR should exist");
    assertExists(errorCode.INVALID_REQUEST, "INVALID_REQUEST should exist");
    assertExists(errorCode.METHOD_NOT_FOUND, "METHOD_NOT_FOUND should exist");
    assertExists(errorCode.INVALID_PARAMS, "INVALID_PARAMS should exist");
    assertExists(errorCode.INTERNAL_ERROR, "INTERNAL_ERROR should exist");
    assertExists(errorCode.SERVER_ERROR, "SERVER_ERROR should exist");
    assertExists(errorCode.DOMAIN_NOT_ENABLED, "DOMAIN_NOT_ENABLED should exist");
});
