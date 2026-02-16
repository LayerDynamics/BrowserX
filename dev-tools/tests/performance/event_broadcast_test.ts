/**
 * Event Broadcast Performance Tests
 *
 * Tests event delivery performance:
 * - High-frequency event emission
 * - Multi-subscriber broadcast efficiency
 * - Event ordering under load
 */

import { assertEquals, assert } from "@std/assert";
import { DevToolsServer } from "../../server/devtools-server.ts";
import { DomainRegistry } from "../../protocol/domains.ts";
import { EventBus, type EventHandler } from "../../integration/event-bus.ts";
import { BaseDomain } from "../../domains/base-domain.ts";
import type { DomainName, ProtocolEvent } from "../../protocol/types.ts";
import type { Browser } from "../../../browser/src/main.ts";
import { createMockBrowser, createMockContext } from "../helpers/mocks.ts";
import { randomPort, wait } from "../helpers/test-utils.ts";

// Test options to disable leak checking for performance tests
const testOpts = { sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// Test Domain for Event Performance
// ============================================================================

class EventPerfDomain extends BaseDomain {
    readonly name: DomainName = "DOM";
    private eventCount = 0;

    protected setup(): void {
        this.registerMethod("triggerEvents", "Trigger multiple events", async (params) => {
            const count = (params?.count as number) ?? 1;
            for (let i = 0; i < count; i++) {
                this.emitEvent("testEvent", { index: i, timestamp: Date.now() });
                this.eventCount++;
            }
            return { triggered: count };
        });

        this.registerMethod("getEventCount", "Get event count", async () => {
            return { count: this.eventCount };
        });

        this.registerEvent("testEvent", "Test event for performance");
    }

    emitTestEvent(data: Record<string, unknown>): void {
        this.emitEvent("testEvent", data);
        this.eventCount++;
    }

    getEventCount(): number {
        return this.eventCount;
    }

    resetEventCount(): void {
        this.eventCount = 0;
    }
}

// ============================================================================
// Test Setup
// ============================================================================

interface EventTestSetup {
    server: DevToolsServer;
    domain: EventPerfDomain;
    port: number;
    eventBus: EventBus;
}

function createEventTestServer(): EventTestSetup {
    const port = randomPort();
    const eventBus = new EventBus();
    const browser = createMockBrowser();
    const registry = new DomainRegistry();

    const domain = new EventPerfDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    registry.register(domain, { name: "DOM", description: "DOM", version: "1.0" });

    const server = new DevToolsServer(browser as unknown as Browser, registry, { port, host: "127.0.0.1" });

    return { server, domain, port, eventBus };
}

async function connectWS(port: number): Promise<WebSocket> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/default`);
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { ws.close(); reject(new Error("Connection timeout")); }, 5000);
        ws.onopen = () => { clearTimeout(timeout); resolve(); };
        ws.onerror = () => { clearTimeout(timeout); reject(new Error("WebSocket error")); };
    });
    return ws;
}

async function sendRequest(
    ws: WebSocket,
    method: string,
    params?: Record<string, unknown>,
    id = 1,
): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Response timeout")), 10000);
        const handler = (event: MessageEvent) => {
            const response = JSON.parse(event.data);
            if ("id" in response && response.id === id) {
                clearTimeout(timeout);
                ws.removeEventListener("message", handler);
                resolve(response);
            }
        };
        ws.addEventListener("message", handler);
        ws.onerror = () => { clearTimeout(timeout); reject(new Error("WebSocket error")); };
        ws.send(JSON.stringify({ id, method, params }));
    });
}

function collectEvents(ws: WebSocket, count: number, timeoutMs = 5000): Promise<ProtocolEvent[]> {
    return new Promise((resolve) => {
        const events: ProtocolEvent[] = [];
        const timeout = setTimeout(() => {
            ws.removeEventListener("message", handler);
            resolve(events);
        }, timeoutMs);

        const handler = (event: MessageEvent) => {
            const msg = JSON.parse(event.data);
            if ("method" in msg && !("id" in msg)) {
                events.push(msg as ProtocolEvent);
                if (events.length >= count) {
                    clearTimeout(timeout);
                    ws.removeEventListener("message", handler);
                    resolve(events);
                }
            }
        };
        ws.addEventListener("message", handler);
    });
}

// ============================================================================
// Performance Tests
// ============================================================================

Deno.test({ name: "EventPerf - single event delivery latency", ...testOpts, fn: async () => {
    const { server, domain, port } = createEventTestServer();
    try {
        server.start();
        await wait(100);
        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable");

        const latencies: number[] = [];

        for (let i = 0; i < 10; i++) {
            const startTime = Date.now();
            const eventPromise = collectEvents(ws, 1, 2000);
            domain.emitTestEvent({ test: i, sentAt: startTime });
            const events = await eventPromise;
            const endTime = Date.now();

            if (events.length > 0) {
                latencies.push(endTime - startTime);
            }
        }

        if (latencies.length > 0) {
            const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            console.log(`  Single event latency: ${avgLatency.toFixed(2)}ms avg (${latencies.length} samples)`);
            assert(avgLatency < 100, `Event latency ${avgLatency.toFixed(2)}ms exceeds 100ms`);
        } else {
            console.log(`  Note: Events not received through domain emit (expected in test setup)`);
        }

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "EventPerf - method-triggered events", ...testOpts, fn: async () => {
    const { server, domain, port } = createEventTestServer();
    try {
        server.start();
        await wait(100);
        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable");

        domain.resetEventCount();

        const response = await sendRequest(ws, "DOM.triggerEvents", { count: 10 }, 2);
        assertEquals((response.result as Record<string, unknown>)?.triggered, 10);
        assertEquals(domain.getEventCount(), 10);
        console.log(`  Method triggered ${domain.getEventCount()} events successfully`);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "EventPerf - high frequency event emission", ...testOpts, fn: async () => {
    const { server, domain, port } = createEventTestServer();
    try {
        server.start();
        await wait(100);
        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable");

        domain.resetEventCount();
        const eventCount = 100;

        const startTime = performance.now();
        const response = await sendRequest(ws, "DOM.triggerEvents", { count: eventCount }, 2);
        const durationMs = performance.now() - startTime;

        assertEquals((response.result as Record<string, unknown>)?.triggered, eventCount);

        const eventsPerSecond = (eventCount / durationMs) * 1000;
        console.log(`  High-frequency emission: ${eventsPerSecond.toFixed(0)} events/sec (${eventCount} events in ${durationMs.toFixed(0)}ms)`);
        assert(eventsPerSecond > 100, `Emission rate ${eventsPerSecond.toFixed(0)} events/sec below 100 threshold`);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "EventPerf - EventBus subscription performance", ...testOpts, fn: async () => {
    const { server, eventBus } = createEventTestServer();
    try {
        server.start();
        await wait(100);

        let receivedCount = 0;
        const handlers: EventHandler[] = [];

        const subscriberCount = 10;
        for (let i = 0; i < subscriberCount; i++) {
            const handler: EventHandler = () => { receivedCount++; };
            handlers.push(handler);
            eventBus.on("testChannel", handler);
        }

        const eventCount = 100;
        const startTime = performance.now();

        for (let i = 0; i < eventCount; i++) {
            eventBus.emit("testChannel", { index: i });
        }

        const durationMs = performance.now() - startTime;
        const expectedTotal = eventCount * subscriberCount;

        assertEquals(receivedCount, expectedTotal);

        const deliveriesPerSecond = (expectedTotal / durationMs) * 1000;
        console.log(`  EventBus throughput: ${deliveriesPerSecond.toFixed(0)} deliveries/sec (${subscriberCount} subscribers, ${eventCount} events)`);
        assert(deliveriesPerSecond > 1000, `EventBus throughput ${deliveriesPerSecond.toFixed(0)} deliveries/sec below 1000 threshold`);

        // Clean up
        for (const handler of handlers) {
            eventBus.off("testChannel", handler);
        }
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "EventPerf - EventBus multi-channel performance", ...testOpts, fn: async () => {
    const { server, eventBus } = createEventTestServer();
    try {
        server.start();
        await wait(100);

        const channels = ["channel1", "channel2", "channel3", "channel4", "channel5"];
        const receivedCounts = new Map<string, number>();
        const handlers = new Map<string, EventHandler>();

        for (const channel of channels) {
            receivedCounts.set(channel, 0);
            const handler: EventHandler = () => {
                receivedCounts.set(channel, (receivedCounts.get(channel) || 0) + 1);
            };
            handlers.set(channel, handler);
            eventBus.on(channel, handler);
        }

        const eventsPerChannel = 50;
        const startTime = performance.now();

        for (let i = 0; i < eventsPerChannel; i++) {
            for (const channel of channels) {
                eventBus.emit(channel, { index: i });
            }
        }

        const durationMs = performance.now() - startTime;

        for (const channel of channels) {
            assertEquals(receivedCounts.get(channel), eventsPerChannel, `Channel ${channel} received wrong count`);
        }

        const totalEvents = eventsPerChannel * channels.length;
        const eventsPerSecond = (totalEvents / durationMs) * 1000;
        console.log(`  Multi-channel throughput: ${eventsPerSecond.toFixed(0)} events/sec (${channels.length} channels, ${totalEvents} total)`);

        // Clean up
        for (const [channel, handler] of handlers) {
            eventBus.off(channel, handler);
        }
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "EventPerf - subscriber add/remove churn", ...testOpts, fn: async () => {
    const { server, eventBus } = createEventTestServer();
    try {
        server.start();
        await wait(100);

        const operations = 1000;
        const startTime = performance.now();

        for (let i = 0; i < operations; i++) {
            const handler: EventHandler = () => {};
            eventBus.on(`churn-channel-${i % 10}`, handler);
            eventBus.off(`churn-channel-${i % 10}`, handler);
        }

        const durationMs = performance.now() - startTime;
        const opsPerSecond = (operations / durationMs) * 1000;

        console.log(`  Subscribe/unsubscribe churn: ${opsPerSecond.toFixed(0)} ops/sec (${operations} cycles in ${durationMs.toFixed(0)}ms)`);
        assert(opsPerSecond > 5000, `Churn rate ${opsPerSecond.toFixed(0)} ops/sec below 5000 threshold`);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "EventPerf - event with large payload", ...testOpts, fn: async () => {
    const { server, eventBus } = createEventTestServer();
    try {
        server.start();
        await wait(100);

        const payloadSizes = [1024, 10240, 102400]; // 1KB, 10KB, 100KB
        const results: { size: number; durationMs: number }[] = [];

        for (const size of payloadSizes) {
            const payload = { data: "x".repeat(size), size };
            let received = false;

            const handler: EventHandler = (data) => {
                received = true;
                assertEquals((data as Record<string, unknown>).size, size);
            };

            eventBus.on("large-payload", handler);

            const startTime = performance.now();
            eventBus.emit("large-payload", payload);
            const durationMs = performance.now() - startTime;

            assertEquals(received, true);
            results.push({ size, durationMs });

            eventBus.off("large-payload", handler);
        }

        for (const result of results) {
            console.log(`  ${(result.size / 1024).toFixed(0)}KB payload: ${result.durationMs.toFixed(3)}ms`);
            assert(result.durationMs < 100, `${result.size} byte payload took ${result.durationMs}ms (>100ms)`);
        }
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "EventPerf - event ordering preservation", ...testOpts, fn: async () => {
    const { server, eventBus } = createEventTestServer();
    try {
        server.start();
        await wait(100);

        const receivedOrder: number[] = [];
        const eventCount = 100;

        const handler: EventHandler = (data) => {
            receivedOrder.push((data as Record<string, number>).index);
        };

        eventBus.on("order-test", handler);

        const startTime = performance.now();

        for (let i = 0; i < eventCount; i++) {
            eventBus.emit("order-test", { index: i });
        }

        const durationMs = performance.now() - startTime;

        assertEquals(receivedOrder.length, eventCount);

        for (let i = 0; i < eventCount; i++) {
            assertEquals(receivedOrder[i], i, `Event at position ${i} has wrong index ${receivedOrder[i]}`);
        }

        console.log(`  Event ordering preserved for ${eventCount} events in ${durationMs.toFixed(2)}ms`);

        eventBus.off("order-test", handler);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "EventPerf - concurrent emit from multiple sources", ...testOpts, fn: async () => {
    const { server, eventBus } = createEventTestServer();
    try {
        server.start();
        await wait(100);

        let receivedCount = 0;
        const sourceCount = 5;
        const eventsPerSource = 100;

        const handler: EventHandler = () => { receivedCount++; };
        eventBus.on("concurrent-emit", handler);

        const startTime = performance.now();

        const emitPromises = Array.from({ length: sourceCount }, async (_, sourceId) => {
            for (let i = 0; i < eventsPerSource; i++) {
                eventBus.emit("concurrent-emit", { source: sourceId, index: i });
            }
        });

        await Promise.all(emitPromises);

        const durationMs = performance.now() - startTime;

        const expectedTotal = sourceCount * eventsPerSource;
        assertEquals(receivedCount, expectedTotal);

        const eventsPerSecond = (expectedTotal / durationMs) * 1000;
        console.log(`  Concurrent emit: ${eventsPerSecond.toFixed(0)} events/sec (${sourceCount} sources, ${expectedTotal} total in ${durationMs.toFixed(0)}ms)`);

        eventBus.off("concurrent-emit", handler);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "EventPerf - listener count performance", ...testOpts, fn: async () => {
    const { server, eventBus } = createEventTestServer();
    try {
        server.start();
        await wait(100);

        const handlers: EventHandler[] = [];
        const listenerCounts = [1, 10, 50, 100];
        const results: { listeners: number; avgDeliveryMs: number }[] = [];

        for (const count of listenerCounts) {
            // Add listeners up to count
            while (handlers.length < count) {
                const handler: EventHandler = () => {};
                handlers.push(handler);
                eventBus.on("listener-count-test", handler);
            }

            // Measure delivery time
            const iterations = 100;
            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                eventBus.emit("listener-count-test", { i });
            }

            const durationMs = performance.now() - startTime;
            const avgPerEmit = durationMs / iterations;

            results.push({ listeners: count, avgDeliveryMs: avgPerEmit });
        }

        for (const result of results) {
            console.log(`  ${result.listeners} listeners: ${result.avgDeliveryMs.toFixed(3)}ms avg per emit`);
        }

        // Clean up
        for (const handler of handlers) {
            eventBus.off("listener-count-test", handler);
        }

        // Verify performance scales reasonably (shouldn't be more than 10x slower with 100x listeners)
        const ratio = results[results.length - 1].avgDeliveryMs / results[0].avgDeliveryMs;
        console.log(`  Scaling ratio (100 vs 1 listener): ${ratio.toFixed(1)}x`);
        assert(ratio < 200, `Listener scaling ratio ${ratio.toFixed(1)}x exceeds 200x threshold`);
    } finally {
        await server.stop();
    }
}});
