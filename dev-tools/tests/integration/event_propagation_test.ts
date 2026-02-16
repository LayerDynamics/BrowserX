/**
 * Event Propagation Integration Tests
 *
 * Tests event flow from domains through EventBus to listeners.
 * Verifies event delivery, ordering, filtering, and high-frequency handling.
 */

import { assertEquals, assertExists } from "@std/assert";
import { EventBus } from "../../integration/event-bus.ts";
import { BaseDomain, type DomainInitContext } from "../../domains/base-domain.ts";
import type { DomainName, ProtocolEvent, ProtocolMethod } from "../../protocol/types.ts";
import { createMockContext } from "../helpers/mocks.ts";
import { CDP_EVENTS } from "../helpers/fixtures.ts";
import { wait } from "../helpers/test-utils.ts";

// ============================================================================
// Test Domain Implementation
// ============================================================================

class EventTestDomain extends BaseDomain {
    readonly name: DomainName = "DOM";

    protected setup(): void {
        this.registerEvent("documentUpdated", "Fired when document is updated");
        this.registerEvent("childNodeInserted", "Fired when a child node is inserted");
        this.registerEvent("attributeModified", "Fired when an attribute is modified");
    }

    emitTestEvent(eventName: string, params?: Record<string, unknown>): void {
        this.emitEvent(eventName, params);
    }
}

// ============================================================================
// Event Propagation Tests
// ============================================================================

Deno.test("Event Propagation - domain event reaches listener", async () => {
    const eventBus = new EventBus();
    const domain = new EventTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const receivedEvents: ProtocolEvent[] = [];
    domain.addEventListener((event) => receivedEvents.push(event));

    domain.emitTestEvent("documentUpdated", {});

    assertEquals(receivedEvents.length, 1);
    assertEquals(receivedEvents[0].method, "DOM.documentUpdated");
});

Deno.test("Event Propagation - event params preserved", async () => {
    const eventBus = new EventBus();
    const domain = new EventTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const receivedEvents: ProtocolEvent[] = [];
    domain.addEventListener((event) => receivedEvents.push(event));

    domain.emitTestEvent("childNodeInserted", {
        parentNodeId: 1,
        previousNodeId: 2,
        node: { nodeId: 3, nodeType: 1, nodeName: "DIV" },
    });

    assertEquals(receivedEvents.length, 1);
    assertEquals(receivedEvents[0].params?.parentNodeId, 1);
    assertEquals(receivedEvents[0].params?.previousNodeId, 2);
    assertExists(receivedEvents[0].params?.node);
});

Deno.test("Event Propagation - multiple listeners receive same event", async () => {
    const eventBus = new EventBus();
    const domain = new EventTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const listener1Events: ProtocolEvent[] = [];
    const listener2Events: ProtocolEvent[] = [];
    const listener3Events: ProtocolEvent[] = [];

    domain.addEventListener((event) => listener1Events.push(event));
    domain.addEventListener((event) => listener2Events.push(event));
    domain.addEventListener((event) => listener3Events.push(event));

    domain.emitTestEvent("documentUpdated", { timestamp: 123 });

    assertEquals(listener1Events.length, 1);
    assertEquals(listener2Events.length, 1);
    assertEquals(listener3Events.length, 1);

    assertEquals(listener1Events[0].params?.timestamp, 123);
    assertEquals(listener2Events[0].params?.timestamp, 123);
    assertEquals(listener3Events[0].params?.timestamp, 123);
});

Deno.test("Event Propagation - EventBus broadcasts to subscribers", async () => {
    const eventBus = new EventBus();
    const domain = new EventTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const busEvents: unknown[] = [];
    eventBus.on("DOM.documentUpdated", (data) => busEvents.push(data));

    domain.emitTestEvent("documentUpdated", { source: "test" });

    assertEquals(busEvents.length, 1);
    assertEquals((busEvents[0] as Record<string, unknown>)?.source, "test");
});

Deno.test("Event Propagation - removeEventListener stops delivery", async () => {
    const eventBus = new EventBus();
    const domain = new EventTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const receivedEvents: ProtocolEvent[] = [];
    const listener = (event: ProtocolEvent) => receivedEvents.push(event);

    domain.addEventListener(listener);
    domain.emitTestEvent("documentUpdated", {});
    assertEquals(receivedEvents.length, 1);

    domain.removeEventListener(listener);
    domain.emitTestEvent("documentUpdated", {});
    assertEquals(receivedEvents.length, 1); // Still 1, not increased
});

Deno.test("Event Propagation - event ordering preserved", async () => {
    const eventBus = new EventBus();
    const domain = new EventTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const receivedEvents: ProtocolEvent[] = [];
    domain.addEventListener((event) => receivedEvents.push(event));

    // Emit multiple events in order
    for (let i = 0; i < 10; i++) {
        domain.emitTestEvent("documentUpdated", { index: i });
    }

    assertEquals(receivedEvents.length, 10);
    for (let i = 0; i < 10; i++) {
        assertEquals(receivedEvents[i].params?.index, i);
    }
});

Deno.test("Event Propagation - high-frequency events handled", async () => {
    const eventBus = new EventBus();
    const domain = new EventTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const receivedEvents: ProtocolEvent[] = [];
    domain.addEventListener((event) => receivedEvents.push(event));

    const eventCount = 1000;
    for (let i = 0; i < eventCount; i++) {
        domain.emitTestEvent("documentUpdated", { index: i });
    }

    assertEquals(receivedEvents.length, eventCount);
});

Deno.test("Event Propagation - listener error doesn't break other listeners", async () => {
    const eventBus = new EventBus();
    const domain = new EventTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const listener1Events: ProtocolEvent[] = [];
    const listener3Events: ProtocolEvent[] = [];

    // First listener
    domain.addEventListener((event) => listener1Events.push(event));

    // Second listener throws
    domain.addEventListener((_event) => {
        throw new Error("Listener error");
    });

    // Third listener should still receive event
    domain.addEventListener((event) => listener3Events.push(event));

    // Emit event - should not throw
    domain.emitTestEvent("documentUpdated", {});

    assertEquals(listener1Events.length, 1);
    assertEquals(listener3Events.length, 1);
});

// ============================================================================
// EventBus Tests
// ============================================================================

Deno.test("EventBus - on/emit basic functionality", () => {
    const eventBus = new EventBus();
    const received: unknown[] = [];

    eventBus.on("test.event", (data) => received.push(data));
    eventBus.emit("test.event", { value: 42 });

    assertEquals(received.length, 1);
    assertEquals((received[0] as Record<string, unknown>)?.value, 42);
});

Deno.test("EventBus - off removes listener", () => {
    const eventBus = new EventBus();
    const received: unknown[] = [];

    const handler = (data: unknown) => received.push(data);
    eventBus.on("test.event", handler);
    eventBus.emit("test.event", { value: 1 });
    assertEquals(received.length, 1);

    eventBus.off("test.event", handler);
    eventBus.emit("test.event", { value: 2 });
    assertEquals(received.length, 1); // Still 1
});

Deno.test("EventBus - once fires only once", () => {
    const eventBus = new EventBus();
    const received: unknown[] = [];

    eventBus.once("test.event", (data) => received.push(data));

    eventBus.emit("test.event", { value: 1 });
    eventBus.emit("test.event", { value: 2 });
    eventBus.emit("test.event", { value: 3 });

    assertEquals(received.length, 1);
    assertEquals((received[0] as Record<string, unknown>)?.value, 1);
});

Deno.test("EventBus - removeAllListeners clears all", () => {
    const eventBus = new EventBus();
    const received1: unknown[] = [];
    const received2: unknown[] = [];

    eventBus.on("event1", (data) => received1.push(data));
    eventBus.on("event2", (data) => received2.push(data));

    eventBus.emit("event1", {});
    eventBus.emit("event2", {});
    assertEquals(received1.length, 1);
    assertEquals(received2.length, 1);

    eventBus.removeAllListeners();

    eventBus.emit("event1", {});
    eventBus.emit("event2", {});
    assertEquals(received1.length, 1); // Still 1
    assertEquals(received2.length, 1); // Still 1
});

Deno.test("EventBus - listenerCount returns correct count", () => {
    const eventBus = new EventBus();

    assertEquals(eventBus.listenerCount("test.event"), 0);

    eventBus.on("test.event", () => {});
    assertEquals(eventBus.listenerCount("test.event"), 1);

    eventBus.on("test.event", () => {});
    assertEquals(eventBus.listenerCount("test.event"), 2);
});

Deno.test("EventBus - eventNames returns registered events", () => {
    const eventBus = new EventBus();

    eventBus.on("event1", () => {});
    eventBus.on("event2", () => {});
    eventBus.on("event3", () => {});

    const names = eventBus.eventNames();
    assertEquals(names.includes("event1"), true);
    assertEquals(names.includes("event2"), true);
    assertEquals(names.includes("event3"), true);
});

Deno.test("EventBus - multiple handlers for same event", () => {
    const eventBus = new EventBus();
    const results: number[] = [];

    eventBus.on("test.event", () => results.push(1));
    eventBus.on("test.event", () => results.push(2));
    eventBus.on("test.event", () => results.push(3));

    eventBus.emit("test.event", {});

    assertEquals(results.length, 3);
    assertEquals(results.includes(1), true);
    assertEquals(results.includes(2), true);
    assertEquals(results.includes(3), true);
});

// ============================================================================
// Cross-Domain Event Tests
// ============================================================================

class NetworkTestDomain extends BaseDomain {
    readonly name: DomainName = "Network";

    protected setup(): void {
        this.registerEvent("requestWillBeSent", "Fired when request is about to be sent");
        this.registerEvent("responseReceived", "Fired when response is received");
    }

    emitTestEvent(eventName: string, params?: Record<string, unknown>): void {
        this.emitEvent(eventName, params);
    }
}

Deno.test("Event Propagation - cross-domain events via EventBus", async () => {
    const eventBus = new EventBus();

    const domDomain = new EventTestDomain(eventBus);
    const networkDomain = new NetworkTestDomain(eventBus);

    const domContext = createMockContext({ eventBus });
    const networkContext = createMockContext({ eventBus });

    domDomain.initialize(domContext);
    networkDomain.initialize(networkContext);

    await domDomain.enable();
    await networkDomain.enable();

    // Listen for events from both domains via EventBus
    const allEvents: string[] = [];
    eventBus.on("DOM.documentUpdated", () => allEvents.push("DOM.documentUpdated"));
    eventBus.on("Network.requestWillBeSent", () => allEvents.push("Network.requestWillBeSent"));

    // Emit from both domains
    domDomain.emitTestEvent("documentUpdated", {});
    networkDomain.emitTestEvent("requestWillBeSent", { requestId: "req-1" });

    assertEquals(allEvents.length, 2);
    assertEquals(allEvents.includes("DOM.documentUpdated"), true);
    assertEquals(allEvents.includes("Network.requestWillBeSent"), true);
});

Deno.test("Event Propagation - domain can subscribe to other domain's events", async () => {
    const eventBus = new EventBus();

    const domDomain = new EventTestDomain(eventBus);
    const networkDomain = new NetworkTestDomain(eventBus);

    const domContext = createMockContext({ eventBus });
    const networkContext = createMockContext({ eventBus });

    domDomain.initialize(domContext);
    networkDomain.initialize(networkContext);

    // Subscribe to Network events from DOM domain perspective
    const networkEventsReceivedByDom: unknown[] = [];
    eventBus.on("Network.requestWillBeSent", (data) => {
        networkEventsReceivedByDom.push(data);
    });

    await networkDomain.enable();
    networkDomain.emitTestEvent("requestWillBeSent", { url: "https://example.com" });

    assertEquals(networkEventsReceivedByDom.length, 1);
    assertEquals((networkEventsReceivedByDom[0] as Record<string, unknown>)?.url, "https://example.com");
});

// ============================================================================
// Event Filtering Tests
// ============================================================================

Deno.test("Event Propagation - filter events by domain", async () => {
    const eventBus = new EventBus();

    const domDomain = new EventTestDomain(eventBus);
    const networkDomain = new NetworkTestDomain(eventBus);

    const domContext = createMockContext({ eventBus });
    const networkContext = createMockContext({ eventBus });

    domDomain.initialize(domContext);
    networkDomain.initialize(networkContext);

    await domDomain.enable();
    await networkDomain.enable();

    // Only listen for DOM events
    const domOnlyEvents: string[] = [];
    eventBus.on("DOM.documentUpdated", () => domOnlyEvents.push("DOM"));

    domDomain.emitTestEvent("documentUpdated", {});
    networkDomain.emitTestEvent("requestWillBeSent", {});

    assertEquals(domOnlyEvents.length, 1);
    assertEquals(domOnlyEvents[0], "DOM");
});

Deno.test("Event Propagation - domain listener only receives domain events", async () => {
    const eventBus = new EventBus();

    const domDomain = new EventTestDomain(eventBus);
    const networkDomain = new NetworkTestDomain(eventBus);

    const domContext = createMockContext({ eventBus });
    const networkContext = createMockContext({ eventBus });

    domDomain.initialize(domContext);
    networkDomain.initialize(networkContext);

    await domDomain.enable();
    await networkDomain.enable();

    const domEvents: ProtocolEvent[] = [];
    const networkEvents: ProtocolEvent[] = [];

    domDomain.addEventListener((event) => domEvents.push(event));
    networkDomain.addEventListener((event) => networkEvents.push(event));

    domDomain.emitTestEvent("documentUpdated", {});
    networkDomain.emitTestEvent("requestWillBeSent", {});

    // Each listener only receives events from its domain
    assertEquals(domEvents.length, 1);
    assertEquals(domEvents[0].method, "DOM.documentUpdated");

    assertEquals(networkEvents.length, 1);
    assertEquals(networkEvents[0].method, "Network.requestWillBeSent");
});
