/**
 * Getter Verification Tests
 *
 * Verifies that all domain classes expose the correct
 * name getter, method registration, and event registration.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { EventBus } from "../../integration/event-bus.ts";
import { createMockContext } from "../helpers/mocks.ts";
import { DOMDomain } from "../../domains/dom/dom-domain.ts";
import { PageDomain } from "../../domains/page/page-domain.ts";
import { NetworkDomain } from "../../domains/network/network-domain.ts";
import { CSSDomain } from "../../domains/css/css-domain.ts";
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
import { BaseDomain } from "../../domains/base-domain.ts";
import type { DomainName } from "../../protocol/types.ts";

// ============================================================================
// Domain Name Getters
// ============================================================================

interface DomainEntry {
    DomainClass: new (eventBus: EventBus) => BaseDomain;
    expectedName: DomainName;
}

const ALL_DOMAINS: DomainEntry[] = [
    { DomainClass: DOMDomain, expectedName: "DOM" },
    { DomainClass: PageDomain, expectedName: "Page" },
    { DomainClass: NetworkDomain, expectedName: "Network" },
    { DomainClass: CSSDomain, expectedName: "CSS" },
    { DomainClass: RuntimeDomain, expectedName: "Runtime" },
    { DomainClass: ConsoleDomain, expectedName: "Console" },
    { DomainClass: StorageDomain, expectedName: "Storage" },
    { DomainClass: SecurityDomain, expectedName: "Security" },
    { DomainClass: PerformanceDomain, expectedName: "Performance" },
    { DomainClass: MemoryDomain, expectedName: "Memory" },
    { DomainClass: RenderingDomain, expectedName: "Rendering" },
    { DomainClass: DebuggerDomain, expectedName: "Debugger" },
    { DomainClass: OverlayDomain, expectedName: "Overlay" },
    { DomainClass: EmulationDomain, expectedName: "Emulation" },
];

Deno.test("Getters - all 14 domains have correct name property", () => {
    for (const { DomainClass, expectedName } of ALL_DOMAINS) {
        const eventBus = new EventBus();
        const domain = new DomainClass(eventBus);

        assertEquals(
            domain.name,
            expectedName,
            `${DomainClass.name} should have name "${expectedName}" but got "${domain.name}"`,
        );
    }
});

Deno.test("Getters - all domains are instances of BaseDomain", () => {
    for (const { DomainClass } of ALL_DOMAINS) {
        const eventBus = new EventBus();
        const domain = new DomainClass(eventBus);
        assert(domain instanceof BaseDomain, `${DomainClass.name} should be an instance of BaseDomain`);
    }
});

// ============================================================================
// Domain Initialization
// ============================================================================

Deno.test("Getters - all domains initialize without error", () => {
    for (const { DomainClass, expectedName } of ALL_DOMAINS) {
        const eventBus = new EventBus();
        const domain = new DomainClass(eventBus);
        const context = createMockContext({ eventBus });

        try {
            domain.initialize(context);
        } catch (error) {
            throw new Error(`${expectedName} domain failed to initialize: ${error}`);
        }
    }
});

Deno.test("Getters - all domains register methods after initialization", () => {
    for (const { DomainClass, expectedName } of ALL_DOMAINS) {
        const eventBus = new EventBus();
        const domain = new DomainClass(eventBus);
        const context = createMockContext({ eventBus });
        domain.initialize(context);

        const methodNames = domain.getMethodNames();
        assertExists(methodNames, `${expectedName} domain should have methods`);
        assert(methodNames.length > 0, `${expectedName} domain should register at least 1 method`);

        // All domains should have enable/disable via getMethodNames()
        assert(
            methodNames.includes("enable"),
            `${expectedName} domain should have "enable" method`,
        );
        assert(
            methodNames.includes("disable"),
            `${expectedName} domain should have "disable" method`,
        );
    }
});

Deno.test("Getters - all domains register events after initialization", () => {
    for (const { DomainClass, expectedName } of ALL_DOMAINS) {
        const eventBus = new EventBus();
        const domain = new DomainClass(eventBus);
        const context = createMockContext({ eventBus });
        domain.initialize(context);

        const eventNames = domain.getEventNames();
        assertExists(eventNames, `${expectedName} domain should have events`);
        assert(Array.isArray(eventNames), `${expectedName} domain events should be an array`);
    }
});

// ============================================================================
// Domain Method Names
// ============================================================================

Deno.test("Getters - method names are non-empty strings", () => {
    for (const { DomainClass, expectedName } of ALL_DOMAINS) {
        const eventBus = new EventBus();
        const domain = new DomainClass(eventBus);
        domain.initialize(createMockContext({ eventBus }));

        const methodNames = domain.getMethodNames();
        for (const name of methodNames) {
            assertEquals(typeof name, "string", `${expectedName} method name should be a string`);
            assert(name.length > 0, `${expectedName} method name should not be empty`);
        }
    }
});

Deno.test("Getters - event names are non-empty strings", () => {
    for (const { DomainClass, expectedName } of ALL_DOMAINS) {
        const eventBus = new EventBus();
        const domain = new DomainClass(eventBus);
        domain.initialize(createMockContext({ eventBus }));

        const eventNames = domain.getEventNames();
        for (const name of eventNames) {
            assertEquals(typeof name, "string", `${expectedName} event name should be a string`);
            assert(name.length > 0, `${expectedName} event name should not be empty`);
        }
    }
});

// ============================================================================
// Domain-Specific Method Counts
// ============================================================================

Deno.test("Getters - DOM domain has expected methods", () => {
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);
    domain.initialize(createMockContext({ eventBus }));

    const methodNames = domain.getMethodNames();

    const expectedMethods = [
        "enable", "disable",
        "getDocument", "querySelector", "querySelectorAll",
    ];

    for (const method of expectedMethods) {
        assert(methodNames.includes(method), `DOM domain should have method "${method}"`);
    }
});

Deno.test("Getters - Page domain has expected methods", () => {
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);
    domain.initialize(createMockContext({ eventBus }));

    const methodNames = domain.getMethodNames();

    const expectedMethods = ["enable", "disable", "navigate", "reload"];

    for (const method of expectedMethods) {
        assert(methodNames.includes(method), `Page domain should have method "${method}"`);
    }
});

Deno.test("Getters - Network domain has expected methods", () => {
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    domain.initialize(createMockContext({ eventBus }));

    const methodNames = domain.getMethodNames();

    const expectedMethods = ["enable", "disable", "getCookies"];

    for (const method of expectedMethods) {
        assert(methodNames.includes(method), `Network domain should have method "${method}"`);
    }
});

Deno.test("Getters - Runtime domain has expected methods", () => {
    const eventBus = new EventBus();
    const domain = new RuntimeDomain(eventBus);
    domain.initialize(createMockContext({ eventBus }));

    const methodNames = domain.getMethodNames();

    const expectedMethods = ["enable", "disable", "evaluate"];

    for (const method of expectedMethods) {
        assert(methodNames.includes(method), `Runtime domain should have method "${method}"`);
    }
});

// ============================================================================
// Enable/Disable State
// ============================================================================

Deno.test("Getters - domain enable/disable toggles state", async () => {
    for (const { DomainClass, expectedName } of ALL_DOMAINS) {
        const eventBus = new EventBus();
        const domain = new DomainClass(eventBus);
        const context = createMockContext({ eventBus });
        domain.initialize(context);

        // Domain should start disabled
        assertEquals(domain.isEnabled(), false, `${expectedName} should start disabled`);

        // Enable the domain
        await domain.handleMethod("enable", {});
        assertEquals(domain.isEnabled(), true, `${expectedName} should be enabled after enable()`);

        // Disable the domain
        await domain.handleMethod("disable", {});
        assertEquals(domain.isEnabled(), false, `${expectedName} should be disabled after disable()`);
    }
});

Deno.test({ name: "Getters - domain enable is idempotent", sanitizeOps: false, sanitizeResources: false, fn: async () => {
    for (const { DomainClass, expectedName } of ALL_DOMAINS) {
        const eventBus = new EventBus();
        const domain = new DomainClass(eventBus);
        domain.initialize(createMockContext({ eventBus }));

        // Enable twice should not error
        await domain.handleMethod("enable", {});
        await domain.handleMethod("enable", {});
        assertEquals(domain.isEnabled(), true, `${expectedName} should still be enabled`);

        // Disable twice should not error
        await domain.handleMethod("disable", {});
        await domain.handleMethod("disable", {});
        assertEquals(domain.isEnabled(), false, `${expectedName} should still be disabled`);
    }
}});

// ============================================================================
// Domain Count Verification
// ============================================================================

Deno.test("Getters - exactly 14 domains defined", () => {
    assertEquals(ALL_DOMAINS.length, 14, "Should have exactly 14 domain entries");

    const uniqueNames = new Set(ALL_DOMAINS.map((d) => d.expectedName));
    assertEquals(uniqueNames.size, 14, "All 14 domain names should be unique");
});

Deno.test("Getters - domain names match CDP convention", () => {
    for (const { expectedName } of ALL_DOMAINS) {
        // CDP domain names are PascalCase
        assert(
            /^[A-Z][a-zA-Z]*$/.test(expectedName),
            `Domain name "${expectedName}" should be PascalCase`,
        );
    }
});

// ============================================================================
// Dispose Cleanup
// ============================================================================

Deno.test({ name: "Getters - domain dispose cleans up resources", sanitizeOps: false, sanitizeResources: false, fn: () => {
    for (const { DomainClass, expectedName } of ALL_DOMAINS) {
        const eventBus = new EventBus();
        const domain = new DomainClass(eventBus);
        domain.initialize(createMockContext({ eventBus }));

        // Enable first
        domain.handleMethod("enable", {});

        // Dispose should clean up
        domain.dispose();

        assertEquals(domain.isEnabled(), false, `${expectedName} should be disabled after dispose`);
        assertEquals(domain.getMethodNames().length, 2, `${expectedName} should only have enable/disable after dispose`);
        assertEquals(domain.getEventNames().length, 0, `${expectedName} should have no events after dispose`);
    }
}});

// ============================================================================
// Event Listener Management
// ============================================================================

Deno.test("Getters - domain addEventListener/removeEventListener works", () => {
    const eventBus = new EventBus();
    const domain = new DOMDomain(eventBus);
    domain.initialize(createMockContext({ eventBus }));

    const received: string[] = [];
    const listener = (event: { method: string }) => {
        received.push(event.method);
    };

    domain.addEventListener(listener);
    // Events would be emitted through domain methods internally
    // Just verify listener management doesn't throw
    domain.removeEventListener(listener);
});
