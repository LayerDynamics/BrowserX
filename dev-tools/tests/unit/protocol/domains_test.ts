/**
 * Tests for DomainRegistry
 *
 * Covers register/getDomain, hasDomain, handleMethod routing,
 * error handling for unknown/disabled domains, listDomains, getDomainNames, and dispose.
 */

import { assertEquals, assertRejects } from "@std/assert";
import { DomainRegistry } from "../../../protocol/domains.ts";
import type { DomainMetadata } from "../../../protocol/domains.ts";
import { ProtocolErrorCode } from "../../../protocol/types.ts";
import type { DomainName, ProtocolMethod } from "../../../protocol/types.ts";
import { BaseDomain } from "../../../domains/base-domain.ts";
import { EventBus } from "../../../integration/event-bus.ts";

// ---------------------------------------------------------------------------
// Concrete test domain extending BaseDomain
// ---------------------------------------------------------------------------

class MockDOMDomain extends BaseDomain {
    readonly name: DomainName = "DOM";

    protected setup(): void {
        this.registerMethod("getDocument", "Returns the root DOM node", async (params) => {
            return { root: { nodeId: 1 }, depth: params.depth ?? 1 };
        });
        this.registerMethod("querySelector", "Finds a node by selector", async (params) => {
            return { nodeId: 42, selector: params.selector };
        });
    }
}

class MockCSSDomain extends BaseDomain {
    readonly name: DomainName = "CSS";

    protected setup(): void {
        this.registerMethod("getStyleSheetText", "Gets stylesheet text", async () => {
            return { text: "body { color: red; }" };
        });
    }
}

// ---------------------------------------------------------------------------
// Helper to create a registry with a registered & initialized mock domain
// ---------------------------------------------------------------------------

function createRegistryWithDOMDomain(): {
    registry: DomainRegistry;
    domain: MockDOMDomain;
    eventBus: EventBus;
    meta: DomainMetadata;
} {
    const eventBus = new EventBus();
    const domain = new MockDOMDomain(eventBus);
    const meta: DomainMetadata = {
        name: "DOM",
        description: "DOM domain",
        version: "1.0",
    };

    // Initialize the domain so setup() is called and methods are registered
    const { createMockContext } = await_import_workaround();
    domain.initialize(createMockContext({ eventBus }));

    const registry = new DomainRegistry();
    registry.register(domain, meta);
    return { registry, domain, eventBus, meta };
}

// We cannot use top-level await in a helper, so we inline createMockContext
function await_import_workaround() {
    // Inline simple mock context construction (matches DomainInitContext shape)
    return {
        createMockContext: (overrides?: { eventBus?: EventBus }) => {
            const eventBus = overrides?.eventBus ?? new EventBus();
            return {
                browser: { getCurrentURL: () => "https://example.com" },
                requestPipeline: {},
                renderingPipeline: {},
                storageManager: {},
                cookieManager: {},
                quotaManager: {},
                eventBus,
                // deno-lint-ignore no-explicit-any
            } as any;
        },
    };
}

// ---------------------------------------------------------------------------
// register() and getDomain()
// ---------------------------------------------------------------------------

Deno.test("register and getDomain returns the registered domain", () => {
    const { registry, domain } = createRegistryWithDOMDomain();
    const retrieved = registry.getDomain("DOM");
    assertEquals(retrieved, domain);
});

Deno.test("getDomain returns undefined for unregistered domain", () => {
    const { registry } = createRegistryWithDOMDomain();
    const retrieved = registry.getDomain("CSS");
    assertEquals(retrieved, undefined);
});

// ---------------------------------------------------------------------------
// hasDomain()
// ---------------------------------------------------------------------------

Deno.test("hasDomain returns true for a registered domain", () => {
    const { registry } = createRegistryWithDOMDomain();
    assertEquals(registry.hasDomain("DOM"), true);
});

Deno.test("hasDomain returns false for an unregistered domain", () => {
    const { registry } = createRegistryWithDOMDomain();
    assertEquals(registry.hasDomain("Network"), false);
});

// ---------------------------------------------------------------------------
// handleMethod() - successful routing
// ---------------------------------------------------------------------------

Deno.test("handleMethod routes DOM.getDocument to the DOM domain", async () => {
    const { registry, domain } = createRegistryWithDOMDomain();
    // Must enable the domain first
    await domain.enable();

    const result = await registry.handleMethod(
        "DOM.getDocument" as ProtocolMethod,
        { depth: 3 },
    );
    assertEquals(result.root, { nodeId: 1 });
    assertEquals(result.depth, 3);
});

Deno.test("handleMethod routes DOM.querySelector correctly", async () => {
    const { registry, domain } = createRegistryWithDOMDomain();
    await domain.enable();

    const result = await registry.handleMethod(
        "DOM.querySelector" as ProtocolMethod,
        { selector: "#main" },
    );
    assertEquals(result.nodeId, 42);
    assertEquals(result.selector, "#main");
});

Deno.test("handleMethod allows enable/disable even when domain is not enabled", async () => {
    const { registry } = createRegistryWithDOMDomain();
    // Domain starts disabled - enable should still work
    const result = await registry.handleMethod("DOM.enable" as ProtocolMethod, {});
    assertEquals(result, {});
});

Deno.test("handleMethod allows disable when domain is enabled", async () => {
    const { registry, domain } = createRegistryWithDOMDomain();
    await domain.enable();
    const result = await registry.handleMethod("DOM.disable" as ProtocolMethod, {});
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), false);
});

// ---------------------------------------------------------------------------
// handleMethod() - error cases
// ---------------------------------------------------------------------------

Deno.test("handleMethod throws METHOD_NOT_FOUND for unknown domain", async () => {
    const { registry } = createRegistryWithDOMDomain();

    try {
        await registry.handleMethod("Network.enable" as ProtocolMethod, {});
        throw new Error("Should have thrown");
    } catch (err) {
        const error = err as { code: number; message: string };
        assertEquals(error.code, ProtocolErrorCode.METHOD_NOT_FOUND);
        assertEquals(error.message.includes("Network"), true);
    }
});

Deno.test("handleMethod throws DOMAIN_NOT_ENABLED when domain is not enabled", async () => {
    const { registry } = createRegistryWithDOMDomain();
    // Domain is registered but not enabled

    try {
        await registry.handleMethod("DOM.getDocument" as ProtocolMethod, {});
        throw new Error("Should have thrown");
    } catch (err) {
        const error = err as { code: number; message: string };
        assertEquals(error.code, ProtocolErrorCode.DOMAIN_NOT_ENABLED);
        assertEquals(error.message.includes("DOM"), true);
    }
});

Deno.test("handleMethod throws INVALID_REQUEST for invalid method format", async () => {
    const { registry } = createRegistryWithDOMDomain();

    try {
        // Casting to bypass TypeScript ProtocolMethod type checking
        await registry.handleMethod("invalidformat" as ProtocolMethod, {});
        throw new Error("Should have thrown");
    } catch (err) {
        const error = err as { code: number; message: string };
        assertEquals(error.code, ProtocolErrorCode.INVALID_REQUEST);
        assertEquals(error.message.includes("Invalid method format"), true);
    }
});

// ---------------------------------------------------------------------------
// listDomains()
// ---------------------------------------------------------------------------

Deno.test("listDomains returns metadata for all registered domains", () => {
    const eventBus = new EventBus();
    const { createMockContext } = await_import_workaround();
    const ctx = createMockContext({ eventBus });

    const registry = new DomainRegistry();

    const domDomain = new MockDOMDomain(eventBus);
    domDomain.initialize(ctx);
    const domMeta: DomainMetadata = {
        name: "DOM",
        description: "DOM domain",
        version: "1.0",
    };
    registry.register(domDomain, domMeta);

    const cssDomain = new MockCSSDomain(eventBus);
    cssDomain.initialize(ctx);
    const cssMeta: DomainMetadata = {
        name: "CSS",
        description: "CSS domain",
        version: "1.0",
        experimental: true,
    };
    registry.register(cssDomain, cssMeta);

    const domains = registry.listDomains();
    assertEquals(domains.length, 2);
    assertEquals(domains[0].name, "DOM");
    assertEquals(domains[1].name, "CSS");
    assertEquals(domains[1].experimental, true);
});

Deno.test("listDomains returns empty array when no domains are registered", () => {
    const registry = new DomainRegistry();
    assertEquals(registry.listDomains(), []);
});

// ---------------------------------------------------------------------------
// getDomainNames()
// ---------------------------------------------------------------------------

Deno.test("getDomainNames returns names of all registered domains", () => {
    const eventBus = new EventBus();
    const { createMockContext } = await_import_workaround();
    const ctx = createMockContext({ eventBus });

    const registry = new DomainRegistry();

    const domDomain = new MockDOMDomain(eventBus);
    domDomain.initialize(ctx);
    registry.register(domDomain, { name: "DOM", description: "DOM", version: "1.0" });

    const cssDomain = new MockCSSDomain(eventBus);
    cssDomain.initialize(ctx);
    registry.register(cssDomain, { name: "CSS", description: "CSS", version: "1.0" });

    const names = registry.getDomainNames();
    assertEquals(names.length, 2);
    assertEquals(names.includes("DOM"), true);
    assertEquals(names.includes("CSS"), true);
});

Deno.test("getDomainNames returns empty array when no domains registered", () => {
    const registry = new DomainRegistry();
    assertEquals(registry.getDomainNames(), []);
});

// ---------------------------------------------------------------------------
// dispose()
// ---------------------------------------------------------------------------

Deno.test("dispose clears all domains and metadata", () => {
    const { registry } = createRegistryWithDOMDomain();
    assertEquals(registry.hasDomain("DOM"), true);

    registry.dispose();

    assertEquals(registry.hasDomain("DOM"), false);
    assertEquals(registry.listDomains().length, 0);
    assertEquals(registry.getDomainNames().length, 0);
});

Deno.test("dispose disables domains and clears their methods", () => {
    const { registry, domain } = createRegistryWithDOMDomain();
    domain.enable();
    assertEquals(domain.isEnabled(), true);

    registry.dispose();
    assertEquals(domain.isEnabled(), false);
});

// ---------------------------------------------------------------------------
// unregister()
// ---------------------------------------------------------------------------

Deno.test("unregister removes domain and returns true", () => {
    const { registry } = createRegistryWithDOMDomain();
    assertEquals(registry.hasDomain("DOM"), true);

    const result = registry.unregister("DOM");

    assertEquals(result, true);
    assertEquals(registry.hasDomain("DOM"), false);
    assertEquals(registry.getDomain("DOM"), undefined);
    assertEquals(registry.listDomains().length, 0);
    assertEquals(registry.getDomainNames().length, 0);
});

Deno.test("unregister returns false for non-existent domain", () => {
    const { registry } = createRegistryWithDOMDomain();

    const result = registry.unregister("CSS");

    assertEquals(result, false);
    // DOM should still exist
    assertEquals(registry.hasDomain("DOM"), true);
});

Deno.test("unregister disposes the domain before removal", () => {
    const { registry, domain } = createRegistryWithDOMDomain();
    domain.enable();
    assertEquals(domain.isEnabled(), true);

    registry.unregister("DOM");

    // Domain should have been disposed (which disables it)
    assertEquals(domain.isEnabled(), false);
});

Deno.test("unregister removes one domain but leaves others intact", () => {
    const eventBus = new EventBus();
    const { createMockContext } = await_import_workaround();
    const ctx = createMockContext({ eventBus });

    const registry = new DomainRegistry();

    const domDomain = new MockDOMDomain(eventBus);
    domDomain.initialize(ctx);
    registry.register(domDomain, { name: "DOM", description: "DOM", version: "1.0" });

    const cssDomain = new MockCSSDomain(eventBus);
    cssDomain.initialize(ctx);
    registry.register(cssDomain, { name: "CSS", description: "CSS", version: "1.0" });

    registry.unregister("DOM");

    assertEquals(registry.hasDomain("DOM"), false);
    assertEquals(registry.hasDomain("CSS"), true);
    assertEquals(registry.getDomainNames().length, 1);
    assertEquals(registry.listDomains().length, 1);
});

// ---------------------------------------------------------------------------
// Multiple domains routing
// ---------------------------------------------------------------------------

Deno.test("handleMethod routes to correct domain among multiple", async () => {
    const eventBus = new EventBus();
    const { createMockContext } = await_import_workaround();
    const ctx = createMockContext({ eventBus });

    const registry = new DomainRegistry();

    const domDomain = new MockDOMDomain(eventBus);
    domDomain.initialize(ctx);
    registry.register(domDomain, { name: "DOM", description: "DOM", version: "1.0" });

    const cssDomain = new MockCSSDomain(eventBus);
    cssDomain.initialize(ctx);
    registry.register(cssDomain, { name: "CSS", description: "CSS", version: "1.0" });

    await domDomain.enable();
    await cssDomain.enable();

    const domResult = await registry.handleMethod("DOM.getDocument" as ProtocolMethod, {});
    assertEquals(domResult.root, { nodeId: 1 });

    const cssResult = await registry.handleMethod(
        "CSS.getStyleSheetText" as ProtocolMethod,
        {},
    );
    assertEquals(cssResult.text, "body { color: red; }");
});
