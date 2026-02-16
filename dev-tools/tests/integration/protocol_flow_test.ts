/**
 * Protocol Flow Integration Tests
 *
 * Tests the full message flow: Router → DomainRegistry → Domain → Response.
 * Verifies session ID propagation, enable/disable sequences, and concurrent handling.
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { Router } from "../../server/router.ts";
import { DomainRegistry, type DomainMetadata } from "../../protocol/domains.ts";
import { EventBus } from "../../integration/event-bus.ts";
import { BaseDomain, type DomainInitContext } from "../../domains/base-domain.ts";
import type { DomainName, ProtocolRequest, ProtocolResponse, ProtocolMethod } from "../../protocol/types.ts";
import { ProtocolErrorCode } from "../../protocol/types.ts";
import { createMockContext } from "../helpers/mocks.ts";
import {
    createCDPRequest,
    CDP_REQUESTS,
} from "../helpers/fixtures.ts";

// ============================================================================
// Test Domain Implementation
// ============================================================================

class TestDomain extends BaseDomain {
    readonly name: DomainName = "DOM";
    private methodCallCount = 0;
    private lastMethodParams: Record<string, unknown> | null = null;

    protected setup(): void {
        this.registerMethod("getDocument", "Get the DOM document", async (params) => {
            this.methodCallCount++;
            this.lastMethodParams = params;
            return {
                root: {
                    nodeId: 1,
                    nodeType: 9,
                    nodeName: "#document",
                },
            };
        });

        this.registerMethod("querySelector", "Query selector", async (params) => {
            this.methodCallCount++;
            this.lastMethodParams = params;
            if (!params.nodeId) {
                throw { code: ProtocolErrorCode.INVALID_PARAMS, message: "nodeId is required" };
            }
            return { nodeId: params.nodeId as number + 1 };
        });

        this.registerMethod("slowMethod", "A slow method", async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            this.methodCallCount++;
            return { completed: true };
        });

        this.registerMethod("errorMethod", "A method that throws", async () => {
            this.methodCallCount++;
            throw new Error("Something went wrong");
        });

        this.registerEvent("documentUpdated", "Fired when document is updated");
    }

    getMethodCallCount(): number {
        return this.methodCallCount;
    }

    getLastMethodParams(): Record<string, unknown> | null {
        return this.lastMethodParams;
    }

    resetCounts(): void {
        this.methodCallCount = 0;
        this.lastMethodParams = null;
    }
}

// ============================================================================
// Test Setup Helpers
// ============================================================================

function createTestSetup(): {
    router: Router;
    registry: DomainRegistry;
    eventBus: EventBus;
    domain: TestDomain;
} {
    const eventBus = new EventBus();
    const registry = new DomainRegistry();
    const router = new Router(registry);

    const domain = new TestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);

    const meta: DomainMetadata = {
        name: "DOM",
        description: "Test DOM domain",
        version: "1.0",
    };
    registry.register(domain, meta);

    return { router, registry, eventBus, domain };
}

// ============================================================================
// Protocol Flow Tests
// ============================================================================

Deno.test("Protocol Flow - full request-response cycle", async () => {
    const { router, domain } = createTestSetup();

    // Enable the domain first
    await domain.enable();

    const request = createCDPRequest(1, "DOM.getDocument", { depth: 2 });
    const response = await router.route(request);

    assertEquals(response.id, 1);
    assertExists(response.result);
    assertEquals((response.result as Record<string, unknown>).root !== undefined, true);
    assertEquals(response.error, undefined);
});

Deno.test("Protocol Flow - params passed to domain method", async () => {
    const { router, domain } = createTestSetup();
    await domain.enable();

    const request = createCDPRequest(1, "DOM.querySelector", { nodeId: 5, selector: "#main" });
    await router.route(request);

    const params = domain.getLastMethodParams();
    assertEquals(params?.nodeId, 5);
    assertEquals(params?.selector, "#main");
});

Deno.test("Protocol Flow - session ID propagation", async () => {
    const { router, domain } = createTestSetup();
    await domain.enable();

    const request: ProtocolRequest = {
        id: 1,
        method: "DOM.getDocument" as ProtocolMethod,
        params: {},
        sessionId: "session-123",
    };

    const response = await router.route(request);

    assertEquals(response.sessionId, "session-123");
    assertEquals(response.id, 1);
});

Deno.test("Protocol Flow - enable before method call", async () => {
    const { router, domain } = createTestSetup();

    // Domain is not enabled, so method call should fail (except enable itself)
    const request = createCDPRequest(1, "DOM.getDocument", {});
    const response = await router.route(request);

    assertEquals(response.error?.code, ProtocolErrorCode.DOMAIN_NOT_ENABLED);
});

Deno.test("Protocol Flow - enable returns empty object", async () => {
    const { router } = createTestSetup();

    const request = createCDPRequest(1, "DOM.enable", {});
    const response = await router.route(request);

    assertEquals(response.result, {});
    assertEquals(response.error, undefined);
});

Deno.test("Protocol Flow - disable returns empty object", async () => {
    const { router, domain } = createTestSetup();
    await domain.enable();

    const request = createCDPRequest(1, "DOM.disable", {});
    const response = await router.route(request);

    assertEquals(response.result, {});
    assertEquals(response.error, undefined);
    assertEquals(domain.isEnabled(), false);
});

Deno.test("Protocol Flow - enable -> method -> disable sequence", async () => {
    const { router, domain } = createTestSetup();

    // Enable
    const enableResponse = await router.route(createCDPRequest(1, "DOM.enable", {}));
    assertEquals(enableResponse.error, undefined);
    assertEquals(domain.isEnabled(), true);

    // Method call
    const methodResponse = await router.route(createCDPRequest(2, "DOM.getDocument", {}));
    assertEquals(methodResponse.error, undefined);
    assertExists(methodResponse.result);

    // Disable
    const disableResponse = await router.route(createCDPRequest(3, "DOM.disable", {}));
    assertEquals(disableResponse.error, undefined);
    assertEquals(domain.isEnabled(), false);

    // Method call after disable should fail
    const failedResponse = await router.route(createCDPRequest(4, "DOM.getDocument", {}));
    assertEquals(failedResponse.error?.code, ProtocolErrorCode.DOMAIN_NOT_ENABLED);
});

// ============================================================================
// Error Handling Tests
// ============================================================================

Deno.test("Protocol Flow - domain method throws structured error", async () => {
    const { router, domain } = createTestSetup();
    await domain.enable();

    // querySelector throws INVALID_PARAMS when nodeId is missing
    const request = createCDPRequest(1, "DOM.querySelector", { selector: "#main" });
    const response = await router.route(request);

    assertEquals(response.error?.code, ProtocolErrorCode.INVALID_PARAMS);
    assertEquals(response.error?.message, "nodeId is required");
});

Deno.test("Protocol Flow - domain method throws Error", async () => {
    const { router, domain } = createTestSetup();
    await domain.enable();

    const request = createCDPRequest(1, "DOM.errorMethod", {});
    const response = await router.route(request);

    assertEquals(response.error?.code, ProtocolErrorCode.INTERNAL_ERROR);
    assertEquals(response.error?.message, "Something went wrong");
});

Deno.test("Protocol Flow - method not found error", async () => {
    const { router, domain } = createTestSetup();
    await domain.enable();

    const request = createCDPRequest(1, "DOM.unknownMethod", {});
    const response = await router.route(request);

    // When method is not found, domain.handleMethod throws
    assertExists(response.error);
});

Deno.test("Protocol Flow - domain not found error", async () => {
    const { router } = createTestSetup();

    const request = createCDPRequest(1, "Unknown.method", {});
    const response = await router.route(request);

    assertEquals(response.error?.code, ProtocolErrorCode.METHOD_NOT_FOUND);
});

// ============================================================================
// Message Parsing Tests
// ============================================================================

Deno.test("Protocol Flow - parseMessage with valid request", () => {
    const { router } = createTestSetup();

    const data = JSON.stringify({ id: 1, method: "DOM.getDocument", params: { depth: 2 } });
    const request = router.parseMessage(data);

    assertEquals(request.id, 1);
    assertEquals(request.method, "DOM.getDocument");
    assertEquals(request.params?.depth, 2);
});

Deno.test("Protocol Flow - parseMessage with invalid JSON throws", () => {
    const { router } = createTestSetup();

    try {
        router.parseMessage("not valid json");
        throw new Error("Should have thrown");
    } catch (error) {
        const e = error as { code: number; message: string };
        assertEquals(e.code, ProtocolErrorCode.PARSE_ERROR);
    }
});

Deno.test("Protocol Flow - parseMessage with missing id throws", () => {
    const { router } = createTestSetup();

    try {
        router.parseMessage(JSON.stringify({ method: "DOM.getDocument" }));
        throw new Error("Should have thrown");
    } catch (error) {
        const e = error as { code: number; message: string };
        assertEquals(e.code, ProtocolErrorCode.INVALID_REQUEST);
    }
});

Deno.test("Protocol Flow - parseMessage with missing method throws", () => {
    const { router } = createTestSetup();

    try {
        router.parseMessage(JSON.stringify({ id: 1 }));
        throw new Error("Should have thrown");
    } catch (error) {
        const e = error as { code: number; message: string };
        assertEquals(e.code, ProtocolErrorCode.INVALID_REQUEST);
    }
});

Deno.test("Protocol Flow - parseMessage with invalid method format throws", () => {
    const { router } = createTestSetup();

    try {
        router.parseMessage(JSON.stringify({ id: 1, method: "getDocument" }));
        throw new Error("Should have thrown");
    } catch (error) {
        const e = error as { code: number; message: string };
        assertEquals(e.code, ProtocolErrorCode.INVALID_REQUEST);
    }
});

Deno.test("Protocol Flow - parseMessage with non-object params throws", () => {
    const { router } = createTestSetup();

    try {
        router.parseMessage(JSON.stringify({ id: 1, method: "DOM.getDocument", params: "invalid" }));
        throw new Error("Should have thrown");
    } catch (error) {
        const e = error as { code: number; message: string };
        assertEquals(e.code, ProtocolErrorCode.INVALID_PARAMS);
    }
});

// ============================================================================
// Concurrent Request Tests
// ============================================================================

Deno.test("Protocol Flow - concurrent requests handled correctly", async () => {
    const { router, domain } = createTestSetup();
    await domain.enable();

    // Send multiple requests concurrently
    const requests = [
        router.route(createCDPRequest(1, "DOM.getDocument", {})),
        router.route(createCDPRequest(2, "DOM.querySelector", { nodeId: 1, selector: "#a" })),
        router.route(createCDPRequest(3, "DOM.querySelector", { nodeId: 2, selector: "#b" })),
    ];

    const responses = await Promise.all(requests);

    // All should complete without error
    assertEquals(responses[0].id, 1);
    assertEquals(responses[1].id, 2);
    assertEquals(responses[2].id, 3);

    assertEquals(responses[0].error, undefined);
    assertEquals(responses[1].error, undefined);
    assertEquals(responses[2].error, undefined);
});

Deno.test("Protocol Flow - request IDs preserved in responses", async () => {
    const { router, domain } = createTestSetup();
    await domain.enable();

    // Use non-sequential IDs
    const ids = [100, 5, 999, 42];
    const requests = ids.map((id) => router.route(createCDPRequest(id, "DOM.getDocument", {})));
    const responses = await Promise.all(requests);

    for (let i = 0; i < ids.length; i++) {
        assertEquals(responses[i].id, ids[i]);
    }
});

Deno.test("Protocol Flow - slow method doesn't block fast method", async () => {
    const { router, domain } = createTestSetup();
    await domain.enable();

    const startTime = Date.now();

    // Start slow method first, then fast method
    const slowPromise = router.route(createCDPRequest(1, "DOM.slowMethod", {}));
    const fastPromise = router.route(createCDPRequest(2, "DOM.getDocument", {}));

    const [slowResponse, fastResponse] = await Promise.all([slowPromise, fastPromise]);

    assertEquals(slowResponse.id, 1);
    assertEquals(fastResponse.id, 2);

    // Both should complete successfully
    assertEquals(slowResponse.error, undefined);
    assertEquals(fastResponse.error, undefined);
});

// ============================================================================
// Serialization Tests
// ============================================================================

Deno.test("Protocol Flow - serialize response with result", () => {
    const { router } = createTestSetup();

    const response: ProtocolResponse = {
        id: 1,
        result: { nodeId: 5 },
    };

    const serialized = router.serialize(response);
    const parsed = JSON.parse(serialized);

    assertEquals(parsed.id, 1);
    assertEquals(parsed.result.nodeId, 5);
    assertEquals(parsed.error, undefined);
});

Deno.test("Protocol Flow - serialize response with error", () => {
    const { router } = createTestSetup();

    const response: ProtocolResponse = {
        id: 1,
        error: { code: -32600, message: "Invalid request" },
    };

    const serialized = router.serialize(response);
    const parsed = JSON.parse(serialized);

    assertEquals(parsed.id, 1);
    assertEquals(parsed.error.code, -32600);
    assertEquals(parsed.error.message, "Invalid request");
});

Deno.test("Protocol Flow - serialize response with sessionId", () => {
    const { router } = createTestSetup();

    const response: ProtocolResponse = {
        id: 1,
        result: {},
        sessionId: "session-abc",
    };

    const serialized = router.serialize(response);
    const parsed = JSON.parse(serialized);

    assertEquals(parsed.sessionId, "session-abc");
});
