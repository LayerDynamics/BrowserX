/**
 * Tests for BaseDomain
 *
 * Uses a concrete TestDomain extending BaseDomain to test initialize, enable/disable,
 * method registration and handling, event registration and emission, event listeners,
 * eventBus broadcasting, getMethodNames, getEventNames, and dispose.
 */

import { assertEquals, assertRejects } from "@std/assert";
import { BaseDomain } from "../../../domains/base-domain.ts";
import type { DomainInitContext } from "../../../domains/base-domain.ts";
import { EventBus } from "../../../integration/event-bus.ts";
import type { DomainName, ProtocolEvent } from "../../../protocol/types.ts";
import { createMockContext } from "../../helpers/mocks.ts";

// ---------------------------------------------------------------------------
// Concrete TestDomain extending BaseDomain
// ---------------------------------------------------------------------------

class TestDomain extends BaseDomain {
    readonly name: DomainName = "DOM";
    public setupCalled = false;
    public setupContext: DomainInitContext | null = null;

    protected setup(): void {
        this.setupCalled = true;
        this.setupContext = this.context;

        this.registerMethod("getDocument", "Returns root DOM node", async (params) => {
            return { root: { nodeId: 1 }, depth: params.depth ?? 1 };
        });

        this.registerMethod("querySelector", "Finds node by selector", async (params) => {
            return { nodeId: 42, selector: params.selector };
        });

        this.registerMethod("removeNode", "Removes a node", async (params) => {
            return { removed: true, nodeId: params.nodeId };
        });

        this.registerEvent("documentUpdated", "Fired when document structure changes");
        this.registerEvent("childNodeInserted", "Fired when a child node is inserted");
    }

    /**
     * Public helper to trigger emitEvent from tests
     */
    public testEmitEvent(eventName: string, params?: Record<string, unknown>): void {
        this.emitEvent(eventName, params);
    }
}

// Minimal TestDomain that registers nothing in setup
class EmptyTestDomain extends BaseDomain {
    readonly name: DomainName = "CSS";
    protected setup(): void {
        // No methods or events
    }
}

// ---------------------------------------------------------------------------
// Helper to create initialized TestDomain
// ---------------------------------------------------------------------------

function createTestDomain(eventBus?: EventBus): {
    domain: TestDomain;
    eventBus: EventBus;
    context: DomainInitContext;
} {
    const bus = eventBus ?? new EventBus();
    const domain = new TestDomain(bus);
    const context = createMockContext({ eventBus: bus });
    domain.initialize(context);
    return { domain, eventBus: bus, context };
}

// ---------------------------------------------------------------------------
// initialize() and setup()
// ---------------------------------------------------------------------------

Deno.test("initialize sets context and calls setup", () => {
    const eventBus = new EventBus();
    const domain = new TestDomain(eventBus);
    const context = createMockContext({ eventBus });

    assertEquals(domain.setupCalled, false);

    domain.initialize(context);

    assertEquals(domain.setupCalled, true);
    assertEquals(domain.setupContext, context);
});

Deno.test("initialize makes context available to the domain", () => {
    const { domain, context } = createTestDomain();
    // setupContext was captured in setup() - should match what was passed
    assertEquals(domain.setupContext, context);
});

// ---------------------------------------------------------------------------
// enable() and disable()
// ---------------------------------------------------------------------------

Deno.test("domain starts disabled", () => {
    const { domain } = createTestDomain();
    assertEquals(domain.isEnabled(), false);
});

Deno.test("enable sets domain to enabled", async () => {
    const { domain } = createTestDomain();
    await domain.enable();
    assertEquals(domain.isEnabled(), true);
});

Deno.test("enable returns empty object", async () => {
    const { domain } = createTestDomain();
    const result = await domain.enable();
    assertEquals(result, {});
});

Deno.test("disable sets domain to disabled", async () => {
    const { domain } = createTestDomain();
    await domain.enable();
    assertEquals(domain.isEnabled(), true);

    await domain.disable();
    assertEquals(domain.isEnabled(), false);
});

Deno.test("disable returns empty object", async () => {
    const { domain } = createTestDomain();
    await domain.enable();
    const result = await domain.disable();
    assertEquals(result, {});
});

Deno.test("multiple enable calls keep domain enabled", async () => {
    const { domain } = createTestDomain();
    await domain.enable();
    await domain.enable();
    assertEquals(domain.isEnabled(), true);
});

Deno.test("disable without prior enable keeps domain disabled", async () => {
    const { domain } = createTestDomain();
    await domain.disable();
    assertEquals(domain.isEnabled(), false);
});

// ---------------------------------------------------------------------------
// isEnabled()
// ---------------------------------------------------------------------------

Deno.test("isEnabled returns false initially", () => {
    const { domain } = createTestDomain();
    assertEquals(domain.isEnabled(), false);
});

Deno.test("isEnabled returns true after enable", async () => {
    const { domain } = createTestDomain();
    await domain.enable();
    assertEquals(domain.isEnabled(), true);
});

Deno.test("isEnabled returns false after enable then disable", async () => {
    const { domain } = createTestDomain();
    await domain.enable();
    await domain.disable();
    assertEquals(domain.isEnabled(), false);
});

// ---------------------------------------------------------------------------
// registerMethod() and handleMethod()
// ---------------------------------------------------------------------------

Deno.test("handleMethod routes to registered method handler", async () => {
    const { domain } = createTestDomain();
    const result = await domain.handleMethod("getDocument", { depth: 5 });
    assertEquals(result.root, { nodeId: 1 });
    assertEquals(result.depth, 5);
});

Deno.test("handleMethod routes to querySelector handler", async () => {
    const { domain } = createTestDomain();
    const result = await domain.handleMethod("querySelector", { selector: ".main" });
    assertEquals(result.nodeId, 42);
    assertEquals(result.selector, ".main");
});

Deno.test("handleMethod routes to removeNode handler", async () => {
    const { domain } = createTestDomain();
    const result = await domain.handleMethod("removeNode", { nodeId: 10 });
    assertEquals(result.removed, true);
    assertEquals(result.nodeId, 10);
});

// ---------------------------------------------------------------------------
// handleMethod - built-in enable/disable
// ---------------------------------------------------------------------------

Deno.test("handleMethod('enable') enables the domain", async () => {
    const { domain } = createTestDomain();
    assertEquals(domain.isEnabled(), false);

    const result = await domain.handleMethod("enable", {});
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), true);
});

Deno.test("handleMethod('disable') disables the domain", async () => {
    const { domain } = createTestDomain();
    await domain.enable();

    const result = await domain.handleMethod("disable", {});
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), false);
});

// ---------------------------------------------------------------------------
// handleMethod - unknown method throws
// ---------------------------------------------------------------------------

Deno.test("handleMethod throws for unknown method", async () => {
    const { domain } = createTestDomain();

    await assertRejects(
        async () => {
            await domain.handleMethod("nonExistentMethod", {});
        },
        Error,
        'Method "DOM.nonExistentMethod" not found',
    );
});

Deno.test("handleMethod throws for method not registered on empty domain", async () => {
    const eventBus = new EventBus();
    const domain = new EmptyTestDomain(eventBus);
    domain.initialize(createMockContext({ eventBus }));

    await assertRejects(
        async () => {
            await domain.handleMethod("anything", {});
        },
        Error,
        'Method "CSS.anything" not found',
    );
});

// ---------------------------------------------------------------------------
// registerEvent() and emitEvent()
// ---------------------------------------------------------------------------

Deno.test("emitEvent sends ProtocolEvent to event listeners", () => {
    const { domain } = createTestDomain();
    const received: ProtocolEvent[] = [];

    domain.addEventListener((event) => {
        received.push(event);
    });

    domain.testEmitEvent("documentUpdated", { timestamp: 12345 });

    assertEquals(received.length, 1);
    assertEquals(received[0].method, "DOM.documentUpdated");
    assertEquals(received[0].params, { timestamp: 12345 });
});

Deno.test("emitEvent sends event without params", () => {
    const { domain } = createTestDomain();
    const received: ProtocolEvent[] = [];

    domain.addEventListener((event) => {
        received.push(event);
    });

    domain.testEmitEvent("documentUpdated");

    assertEquals(received.length, 1);
    assertEquals(received[0].method, "DOM.documentUpdated");
    assertEquals(received[0].params, undefined);
});

Deno.test("emitEvent notifies multiple direct event listeners", () => {
    const { domain } = createTestDomain();
    const calls: string[] = [];

    domain.addEventListener(() => calls.push("listener-1"));
    domain.addEventListener(() => calls.push("listener-2"));

    domain.testEmitEvent("childNodeInserted", { nodeId: 5 });

    assertEquals(calls, ["listener-1", "listener-2"]);
});

// ---------------------------------------------------------------------------
// addEventListener() and removeEventListener()
// ---------------------------------------------------------------------------

Deno.test("addEventListener adds listener that receives events", () => {
    const { domain } = createTestDomain();
    const received: ProtocolEvent[] = [];

    const listener = (event: ProtocolEvent) => received.push(event);
    domain.addEventListener(listener);

    domain.testEmitEvent("documentUpdated");
    assertEquals(received.length, 1);
});

Deno.test("removeEventListener stops listener from receiving events", () => {
    const { domain } = createTestDomain();
    const received: ProtocolEvent[] = [];

    const listener = (event: ProtocolEvent) => received.push(event);
    domain.addEventListener(listener);

    domain.testEmitEvent("documentUpdated");
    assertEquals(received.length, 1);

    domain.removeEventListener(listener);

    domain.testEmitEvent("documentUpdated");
    assertEquals(received.length, 1); // Should not have changed
});

Deno.test("removeEventListener with non-existent listener does not throw", () => {
    const { domain } = createTestDomain();
    const listener = (_event: ProtocolEvent) => {};
    // Should not throw
    domain.removeEventListener(listener);
});

Deno.test("removeEventListener only removes the specific listener", () => {
    const { domain } = createTestDomain();
    const calls1: number[] = [];
    const calls2: number[] = [];

    const listener1 = () => calls1.push(1);
    const listener2 = () => calls2.push(2);

    domain.addEventListener(listener1);
    domain.addEventListener(listener2);

    domain.testEmitEvent("documentUpdated");
    assertEquals(calls1, [1]);
    assertEquals(calls2, [2]);

    domain.removeEventListener(listener1);

    domain.testEmitEvent("documentUpdated");
    assertEquals(calls1, [1]); // Not called again
    assertEquals(calls2, [2, 2]); // Called again
});

// ---------------------------------------------------------------------------
// Events broadcast to eventBus
// ---------------------------------------------------------------------------

Deno.test("emitEvent broadcasts to eventBus with fully qualified method name", () => {
    const eventBus = new EventBus();
    const { domain } = createTestDomain(eventBus);
    const busReceived: unknown[] = [];

    eventBus.on("DOM.documentUpdated", (data) => {
        busReceived.push(data);
    });

    domain.testEmitEvent("documentUpdated", { revision: 3 });

    assertEquals(busReceived.length, 1);
    assertEquals(busReceived[0], { revision: 3 });
});

Deno.test("emitEvent broadcasts to both direct listeners and eventBus", () => {
    const eventBus = new EventBus();
    const { domain } = createTestDomain(eventBus);
    const directReceived: ProtocolEvent[] = [];
    const busReceived: unknown[] = [];

    domain.addEventListener((event) => directReceived.push(event));
    eventBus.on("DOM.childNodeInserted", (data) => busReceived.push(data));

    domain.testEmitEvent("childNodeInserted", { parentNodeId: 1, nodeId: 5 });

    assertEquals(directReceived.length, 1);
    assertEquals(directReceived[0].method, "DOM.childNodeInserted");
    assertEquals(busReceived.length, 1);
    assertEquals(busReceived[0], { parentNodeId: 1, nodeId: 5 });
});

// ---------------------------------------------------------------------------
// Error isolation in event listeners
// ---------------------------------------------------------------------------

Deno.test("error in one event listener does not prevent others from running", () => {
    const { domain } = createTestDomain();
    const calls: string[] = [];

    domain.addEventListener(() => calls.push("before"));
    domain.addEventListener(() => {
        throw new Error("listener error");
    });
    domain.addEventListener(() => calls.push("after"));

    // Suppress console.error noise
    const originalError = console.error;
    console.error = () => {};

    try {
        domain.testEmitEvent("documentUpdated");
    } finally {
        console.error = originalError;
    }

    assertEquals(calls, ["before", "after"]);
});

// ---------------------------------------------------------------------------
// getMethodNames()
// ---------------------------------------------------------------------------

Deno.test("getMethodNames includes enable, disable, and registered methods", () => {
    const { domain } = createTestDomain();
    const names = domain.getMethodNames();

    assertEquals(names.includes("enable"), true);
    assertEquals(names.includes("disable"), true);
    assertEquals(names.includes("getDocument"), true);
    assertEquals(names.includes("querySelector"), true);
    assertEquals(names.includes("removeNode"), true);
    assertEquals(names.length, 5); // enable + disable + 3 registered
});

Deno.test("getMethodNames on empty domain only returns enable and disable", () => {
    const eventBus = new EventBus();
    const domain = new EmptyTestDomain(eventBus);
    domain.initialize(createMockContext({ eventBus }));

    const names = domain.getMethodNames();
    assertEquals(names, ["enable", "disable"]);
});

// ---------------------------------------------------------------------------
// getEventNames()
// ---------------------------------------------------------------------------

Deno.test("getEventNames returns registered event names", () => {
    const { domain } = createTestDomain();
    const names = domain.getEventNames();

    assertEquals(names.includes("documentUpdated"), true);
    assertEquals(names.includes("childNodeInserted"), true);
    assertEquals(names.length, 2);
});

Deno.test("getEventNames returns empty for domain with no registered events", () => {
    const eventBus = new EventBus();
    const domain = new EmptyTestDomain(eventBus);
    domain.initialize(createMockContext({ eventBus }));

    assertEquals(domain.getEventNames(), []);
});

// ---------------------------------------------------------------------------
// dispose()
// ---------------------------------------------------------------------------

Deno.test("dispose clears event listeners", () => {
    const { domain } = createTestDomain();
    const received: ProtocolEvent[] = [];

    domain.addEventListener((event) => received.push(event));
    domain.testEmitEvent("documentUpdated");
    assertEquals(received.length, 1);

    domain.dispose();

    domain.testEmitEvent("documentUpdated");
    assertEquals(received.length, 1); // No new event received
});

Deno.test("dispose clears registered methods", async () => {
    const { domain } = createTestDomain();

    // Methods work before dispose
    const result = await domain.handleMethod("getDocument", {});
    assertEquals(result.root, { nodeId: 1 });

    domain.dispose();

    // Methods should be gone after dispose (except enable/disable which are built-in)
    await assertRejects(
        async () => {
            await domain.handleMethod("getDocument", {});
        },
        Error,
        'Method "DOM.getDocument" not found',
    );
});

Deno.test("dispose clears registered events", () => {
    const { domain } = createTestDomain();
    assertEquals(domain.getEventNames().length, 2);

    domain.dispose();
    assertEquals(domain.getEventNames().length, 0);
});

Deno.test("dispose sets enabled to false", async () => {
    const { domain } = createTestDomain();
    await domain.enable();
    assertEquals(domain.isEnabled(), true);

    domain.dispose();
    assertEquals(domain.isEnabled(), false);
});

Deno.test("dispose clears everything at once", async () => {
    const { domain } = createTestDomain();
    const received: ProtocolEvent[] = [];

    await domain.enable();
    domain.addEventListener((event) => received.push(event));

    domain.dispose();

    assertEquals(domain.isEnabled(), false);
    assertEquals(domain.getMethodNames(), ["enable", "disable"]); // Only built-ins remain
    assertEquals(domain.getEventNames(), []);

    // Event listener should be gone
    domain.testEmitEvent("documentUpdated");
    assertEquals(received.length, 0);
});

// ---------------------------------------------------------------------------
// Domain name in fully qualified event method
// ---------------------------------------------------------------------------

Deno.test("emitEvent uses domain name in fully qualified method string", () => {
    const { domain } = createTestDomain();
    const received: ProtocolEvent[] = [];

    domain.addEventListener((event) => received.push(event));
    domain.testEmitEvent("customEvent", {});

    assertEquals(received[0].method, "DOM.customEvent");
});
