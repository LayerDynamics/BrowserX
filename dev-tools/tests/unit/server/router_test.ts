/**
 * Tests for Protocol Message Router
 *
 * Covers parseMessage(), route(), and serialize() methods.
 */

import { assertEquals, assertThrows } from "@std/assert";
import { Router } from "../../../server/router.ts";
import { DomainRegistry } from "../../../protocol/domains.ts";
import { ProtocolErrorCode } from "../../../protocol/types.ts";
import type {
    ProtocolResponse,
    ProtocolEvent,
    DomainName,
} from "../../../protocol/types.ts";
import { BaseDomain } from "../../../domains/base-domain.ts";
import { EventBus } from "../../../integration/event-bus.ts";
import { createMockContext } from "../../helpers/mocks.ts";

// ---------------------------------------------------------------------------
// Helper: A minimal concrete domain for testing
// ---------------------------------------------------------------------------

class MockDomain extends BaseDomain {
    readonly name: DomainName = "DOM";

    constructor(eventBus: EventBus) {
        super(eventBus);
    }

    protected setup(): void {
        this.registerMethod("getDocument", "Returns root DOM node", async (_params) => {
            return { root: { nodeId: 1 } };
        });

        this.registerMethod("failingMethod", "Always throws", async (_params) => {
            throw new Error("Something went wrong inside domain");
        });
    }
}

/**
 * Create a Router backed by a real DomainRegistry with a single mock domain.
 */
function createTestRouter(): { router: Router; registry: DomainRegistry; domain: MockDomain } {
    const eventBus = new EventBus();
    const registry = new DomainRegistry();
    const domain = new MockDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    registry.register(domain, {
        name: "DOM",
        description: "DOM tree inspection",
        version: "1.0",
        dependencies: [],
    });
    const router = new Router(registry);
    return { router, registry, domain };
}

// ---------------------------------------------------------------------------
// parseMessage() tests
// ---------------------------------------------------------------------------

Deno.test("parseMessage() parses a valid JSON-RPC request", () => {
    const { router } = createTestRouter();
    const msg = JSON.stringify({ id: 1, method: "DOM.getDocument", params: { depth: 2 } });
    const request = router.parseMessage(msg);

    assertEquals(request.id, 1);
    assertEquals(request.method, "DOM.getDocument");
    assertEquals(request.params, { depth: 2 });
});

Deno.test("parseMessage() parses request without params", () => {
    const { router } = createTestRouter();
    const msg = JSON.stringify({ id: 42, method: "DOM.enable" });
    const request = router.parseMessage(msg);

    assertEquals(request.id, 42);
    assertEquals(request.method, "DOM.enable");
    assertEquals(request.params, undefined);
});

Deno.test("parseMessage() preserves sessionId when present", () => {
    const { router } = createTestRouter();
    const msg = JSON.stringify({ id: 1, method: "DOM.getDocument", sessionId: "sess-1" });
    const request = router.parseMessage(msg);

    assertEquals(request.sessionId, "sess-1");
});

Deno.test("parseMessage() rejects non-JSON input", () => {
    const { router } = createTestRouter();

    try {
        router.parseMessage("this is not json!");
        throw new Error("Should have thrown");
    } catch (error: unknown) {
        const e = error as { code: number; message: string };
        assertEquals(e.code, ProtocolErrorCode.PARSE_ERROR);
        assertEquals(e.message, "Failed to parse JSON message");
    }
});

Deno.test("parseMessage() rejects missing id field", () => {
    const { router } = createTestRouter();

    try {
        router.parseMessage(JSON.stringify({ method: "DOM.getDocument" }));
        throw new Error("Should have thrown");
    } catch (error: unknown) {
        const e = error as { code: number; message: string };
        assertEquals(e.code, ProtocolErrorCode.INVALID_REQUEST);
        assertEquals(e.message, 'Message must contain a numeric "id" field');
    }
});

Deno.test("parseMessage() rejects missing method field", () => {
    const { router } = createTestRouter();

    try {
        router.parseMessage(JSON.stringify({ id: 1 }));
        throw new Error("Should have thrown");
    } catch (error: unknown) {
        const e = error as { code: number; message: string };
        assertEquals(e.code, ProtocolErrorCode.INVALID_REQUEST);
        assertEquals(e.message, 'Message must contain a string "method" field');
    }
});

Deno.test("parseMessage() rejects method without dot (invalid Domain.method format)", () => {
    const { router } = createTestRouter();

    try {
        router.parseMessage(JSON.stringify({ id: 1, method: "getDocument" }));
        throw new Error("Should have thrown");
    } catch (error: unknown) {
        const e = error as { code: number; message: string };
        assertEquals(e.code, ProtocolErrorCode.INVALID_REQUEST);
        assertEquals(e.message, 'Invalid method format: "getDocument". Expected "Domain.method".');
    }
});

Deno.test("parseMessage() rejects non-object params", () => {
    const { router } = createTestRouter();

    try {
        router.parseMessage(JSON.stringify({ id: 1, method: "DOM.getDocument", params: "not-object" }));
        throw new Error("Should have thrown");
    } catch (error: unknown) {
        const e = error as { code: number; message: string };
        assertEquals(e.code, ProtocolErrorCode.INVALID_PARAMS);
        assertEquals(e.message, '"params" must be an object');
    }
});

// ---------------------------------------------------------------------------
// route() tests
// ---------------------------------------------------------------------------

Deno.test("route() dispatches to domain registry and returns response", async () => {
    const { router, domain } = createTestRouter();
    // Enable the domain first (required for non-enable/disable methods)
    await domain.enable();

    const request = router.parseMessage(
        JSON.stringify({ id: 5, method: "DOM.getDocument", params: {} }),
    );
    const response = await router.route(request);

    assertEquals(response.id, 5);
    assertEquals(response.error, undefined);
    assertEquals(response.result, { root: { nodeId: 1 } });
});

Deno.test("route() returns error response when domain method throws", async () => {
    const { router, domain } = createTestRouter();
    await domain.enable();

    const request = router.parseMessage(
        JSON.stringify({ id: 10, method: "DOM.failingMethod", params: {} }),
    );
    const response = await router.route(request);

    assertEquals(response.id, 10);
    assertEquals(response.error?.code, ProtocolErrorCode.INTERNAL_ERROR);
    assertEquals(response.error?.message, "Something went wrong inside domain");
    assertEquals(response.result, undefined);
});

Deno.test("route() returns error response on unknown domain", async () => {
    const { router } = createTestRouter();

    const request = router.parseMessage(
        JSON.stringify({ id: 20, method: "FakeDomain.fakeMethod", params: {} }),
    );
    const response = await router.route(request);

    assertEquals(response.id, 20);
    assertEquals(response.error?.code, ProtocolErrorCode.METHOD_NOT_FOUND);
});

Deno.test("route() preserves sessionId in response when present in request", async () => {
    const { router, domain } = createTestRouter();
    await domain.enable();

    const request = router.parseMessage(
        JSON.stringify({ id: 7, method: "DOM.getDocument", params: {}, sessionId: "s-99" }),
    );
    const response = await router.route(request);

    assertEquals(response.sessionId, "s-99");
});

Deno.test("route() returns empty result when domain method returns null", async () => {
    const { router, registry } = createTestRouter();

    // Create a domain with a method that returns null/undefined
    const eventBus = new EventBus();
    class NullDomain extends BaseDomain {
        readonly name: DomainName = "Page";
        constructor(eb: EventBus) { super(eb); }
        protected setup(): void {
            this.registerMethod("reload", "Reload page", async () => {
                return null as unknown as Record<string, unknown>;
            });
        }
    }
    const nullDomain = new NullDomain(eventBus);
    nullDomain.initialize(createMockContext({ eventBus }));
    registry.register(nullDomain, { name: "Page", description: "Page domain", version: "1.0" });
    await nullDomain.enable();

    const request = router.parseMessage(
        JSON.stringify({ id: 30, method: "Page.reload", params: {} }),
    );
    const response = await router.route(request);

    assertEquals(response.id, 30);
    // null result gets replaced with {}
    assertEquals(response.result, {});
});

// ---------------------------------------------------------------------------
// serialize() tests
// ---------------------------------------------------------------------------

Deno.test("serialize() converts ProtocolResponse to JSON string", () => {
    const { router } = createTestRouter();
    const response: ProtocolResponse = {
        id: 1,
        result: { nodeId: 42 },
    };

    const json = router.serialize(response);
    const parsed = JSON.parse(json);

    assertEquals(parsed.id, 1);
    assertEquals(parsed.result.nodeId, 42);
});

Deno.test("serialize() converts ProtocolResponse with error to JSON string", () => {
    const { router } = createTestRouter();
    const response: ProtocolResponse = {
        id: 2,
        error: {
            code: ProtocolErrorCode.INTERNAL_ERROR,
            message: "Internal error",
        },
    };

    const json = router.serialize(response);
    const parsed = JSON.parse(json);

    assertEquals(parsed.id, 2);
    assertEquals(parsed.error.code, ProtocolErrorCode.INTERNAL_ERROR);
    assertEquals(parsed.error.message, "Internal error");
});

Deno.test("serialize() converts ProtocolEvent to JSON string", () => {
    const { router } = createTestRouter();
    const event: ProtocolEvent = {
        method: "DOM.documentUpdated",
        params: { timestamp: 123456 },
    };

    const json = router.serialize(event);
    const parsed = JSON.parse(json);

    assertEquals(parsed.method, "DOM.documentUpdated");
    assertEquals(parsed.params.timestamp, 123456);
});

Deno.test("serialize() converts ProtocolEvent without params to JSON string", () => {
    const { router } = createTestRouter();
    const event: ProtocolEvent = {
        method: "Page.loadEventFired",
    };

    const json = router.serialize(event);
    const parsed = JSON.parse(json);

    assertEquals(parsed.method, "Page.loadEventFired");
    assertEquals(parsed.params, undefined);
});
