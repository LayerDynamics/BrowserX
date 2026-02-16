/**
 * Message Throughput Performance Tests
 *
 * Tests message processing performance under load:
 * - High volume message handling
 * - Concurrent request processing
 * - Response latency under load
 * - Memory efficiency
 */

import { assertEquals, assert } from "@std/assert";
import { DevToolsServer } from "../../server/devtools-server.ts";
import { DomainRegistry } from "../../protocol/domains.ts";
import { EventBus } from "../../integration/event-bus.ts";
import { BaseDomain } from "../../domains/base-domain.ts";
import type { DomainName, ProtocolResponse } from "../../protocol/types.ts";
import type { Browser } from "../../../browser/src/main.ts";
import { createMockBrowser, createMockContext } from "../helpers/mocks.ts";
import { randomPort, wait } from "../helpers/test-utils.ts";

// Test options to disable leak checking for performance tests
const testOpts = { sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// Test Domain for Performance Testing
// ============================================================================

class PerfTestDomain extends BaseDomain {
    readonly name: DomainName = "DOM";
    private callCount = 0;

    protected setup(): void {
        this.registerMethod("echo", "Echo params back", async (params) => {
            this.callCount++;
            return { echo: params, count: this.callCount };
        });

        this.registerMethod("heavyComputation", "Simulates heavy work", async (params) => {
            const iterations = (params?.iterations as number) ?? 1000;
            let result = 0;
            for (let i = 0; i < iterations; i++) {
                result += Math.sqrt(i);
            }
            return { result, iterations };
        });

        this.registerMethod("getCallCount", "Get number of calls", async () => {
            return { count: this.callCount };
        });

        this.registerEvent("tick", "Periodic tick event");
    }

    getCallCount(): number {
        return this.callCount;
    }

    resetCallCount(): void {
        this.callCount = 0;
    }

    emitTick(data: Record<string, unknown>): void {
        this.emitEvent("tick", data);
    }
}

// ============================================================================
// Test Setup
// ============================================================================

interface PerfTestSetup {
    server: DevToolsServer;
    domain: PerfTestDomain;
    port: number;
}

function createPerfTestServer(): PerfTestSetup {
    const port = randomPort();
    const eventBus = new EventBus();
    const browser = createMockBrowser();
    const registry = new DomainRegistry();

    const domain = new PerfTestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    registry.register(domain, { name: "DOM", description: "DOM", version: "1.0" });

    const server = new DevToolsServer(browser as unknown as Browser, registry, { port, host: "127.0.0.1" });

    return { server, domain, port };
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
): Promise<ProtocolResponse> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Response timeout")), 10000);
        const handler = (event: MessageEvent) => {
            const response = JSON.parse(event.data);
            if ("id" in response && response.id === id) {
                clearTimeout(timeout);
                ws.removeEventListener("message", handler);
                resolve(response as ProtocolResponse);
            }
        };
        ws.addEventListener("message", handler);
        ws.onerror = () => { clearTimeout(timeout); reject(new Error("WebSocket error")); };
        ws.send(JSON.stringify({ id, method, params }));
    });
}

// ============================================================================
// Helper Functions
// ============================================================================

function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
    const start = performance.now();
    return fn().then((result) => ({
        result,
        durationMs: performance.now() - start,
    }));
}

// ============================================================================
// Performance Tests
// ============================================================================

Deno.test({ name: "Perf - single request latency baseline", ...testOpts, fn: async () => {
    const { server, port } = createPerfTestServer();
    try {
        server.start();
        await wait(100);
        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable");

        // Warm up
        await sendRequest(ws, "DOM.echo", { data: "warmup" }, 1);

        // Measure single request latency
        const latencies: number[] = [];
        for (let i = 0; i < 10; i++) {
            const { durationMs } = await measureTime(() =>
                sendRequest(ws, "DOM.echo", { data: `test-${i}` }, i + 2)
            );
            latencies.push(durationMs);
        }

        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        console.log(`  Average single request latency: ${avgLatency.toFixed(2)}ms`);

        // Baseline should be under 50ms per request
        assert(avgLatency < 50, `Average latency ${avgLatency.toFixed(2)}ms exceeds 50ms threshold`);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Perf - sequential message throughput", ...testOpts, fn: async () => {
    const { server, port, domain } = createPerfTestServer();
    try {
        server.start();
        await wait(100);
        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable");

        domain.resetCallCount();
        const messageCount = 100;

        const { durationMs } = await measureTime(async () => {
            for (let i = 0; i < messageCount; i++) {
                await sendRequest(ws, "DOM.echo", { index: i }, i + 2);
            }
        });

        const messagesPerSecond = (messageCount / durationMs) * 1000;
        console.log(`  Sequential throughput: ${messagesPerSecond.toFixed(0)} msgs/sec (${messageCount} msgs in ${durationMs.toFixed(0)}ms)`);

        assertEquals(domain.getCallCount(), messageCount);
        // Should handle at least 50 messages per second
        assert(messagesPerSecond > 50, `Throughput ${messagesPerSecond.toFixed(0)} msgs/sec below 50 threshold`);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Perf - concurrent request handling", ...testOpts, fn: async () => {
    const { server, port, domain } = createPerfTestServer();
    try {
        server.start();
        await wait(100);
        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable");

        domain.resetCallCount();
        const concurrentCount = 50;

        const { durationMs } = await measureTime(async () => {
            const promises = Array.from({ length: concurrentCount }, (_, i) =>
                sendRequest(ws, "DOM.echo", { index: i }, i + 2)
            );
            await Promise.all(promises);
        });

        const requestsPerSecond = (concurrentCount / durationMs) * 1000;
        console.log(`  Concurrent throughput: ${requestsPerSecond.toFixed(0)} reqs/sec (${concurrentCount} concurrent reqs in ${durationMs.toFixed(0)}ms)`);

        assertEquals(domain.getCallCount(), concurrentCount);
        // Concurrent handling should be faster than sequential
        assert(requestsPerSecond > 100, `Concurrent throughput ${requestsPerSecond.toFixed(0)} reqs/sec below 100 threshold`);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Perf - large payload handling", ...testOpts, fn: async () => {
    const { server, port } = createPerfTestServer();
    try {
        server.start();
        await wait(100);
        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable");

        // Create payloads of increasing sizes
        const sizes = [1024, 10240, 102400]; // 1KB, 10KB, 100KB
        const results: { size: number; durationMs: number }[] = [];

        for (const size of sizes) {
            const payload = { data: "x".repeat(size) };
            const { durationMs } = await measureTime(() =>
                sendRequest(ws, "DOM.echo", payload, size)
            );
            results.push({ size, durationMs });
            console.log(`  ${(size / 1024).toFixed(0)}KB payload: ${durationMs.toFixed(2)}ms`);
        }

        // All payloads should complete within reasonable time
        for (const result of results) {
            assert(result.durationMs < 1000, `${result.size} byte payload took ${result.durationMs}ms (>1000ms)`);
        }

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Perf - sustained load over time", ...testOpts, fn: async () => {
    const { server, port, domain } = createPerfTestServer();
    try {
        server.start();
        await wait(100);
        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable");

        domain.resetCallCount();
        const durationSeconds = 2;
        const batchSize = 10;
        const batchDelayMs = 50;

        let totalMessages = 0;
        const startTime = Date.now();

        while (Date.now() - startTime < durationSeconds * 1000) {
            const promises = Array.from({ length: batchSize }, (_, i) =>
                sendRequest(ws, "DOM.echo", { batch: totalMessages + i }, totalMessages + i + 100)
            );
            await Promise.all(promises);
            totalMessages += batchSize;
            await wait(batchDelayMs);
        }

        const actualDuration = (Date.now() - startTime) / 1000;
        const sustainedRate = totalMessages / actualDuration;
        console.log(`  Sustained rate: ${sustainedRate.toFixed(0)} msgs/sec over ${actualDuration.toFixed(1)}s (${totalMessages} total)`);

        assertEquals(domain.getCallCount(), totalMessages);
        // Should maintain at least 50 messages per second sustained
        assert(sustainedRate > 50, `Sustained rate ${sustainedRate.toFixed(0)} msgs/sec below 50 threshold`);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Perf - multiple clients concurrent", ...testOpts, fn: async () => {
    const { server, port, domain } = createPerfTestServer();
    try {
        server.start();
        await wait(100);

        const clientCount = 5;
        const messagesPerClient = 20;

        domain.resetCallCount();

        const { durationMs } = await measureTime(async () => {
            const clients = await Promise.all(
                Array.from({ length: clientCount }, () => connectWS(port))
            );

            // Enable domain on all clients
            await Promise.all(clients.map((ws, i) => sendRequest(ws, "DOM.enable", undefined, i * 1000)));

            // Send messages from all clients concurrently
            const allPromises: Promise<ProtocolResponse>[] = [];
            for (let c = 0; c < clientCount; c++) {
                for (let m = 0; m < messagesPerClient; m++) {
                    const id = c * 1000 + m + 1;
                    allPromises.push(sendRequest(clients[c], "DOM.echo", { client: c, msg: m }, id));
                }
            }

            await Promise.all(allPromises);

            // Close all clients
            for (const ws of clients) {
                ws.close();
            }
        });

        const totalMessages = clientCount * messagesPerClient;
        const throughput = (totalMessages / durationMs) * 1000;
        console.log(`  Multi-client throughput: ${throughput.toFixed(0)} msgs/sec (${clientCount} clients, ${totalMessages} total msgs in ${durationMs.toFixed(0)}ms)`);

        assertEquals(domain.getCallCount(), totalMessages);
        assert(throughput > 100, `Multi-client throughput ${throughput.toFixed(0)} msgs/sec below 100 threshold`);

        await wait(200);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Perf - request-response latency distribution", ...testOpts, fn: async () => {
    const { server, port } = createPerfTestServer();
    try {
        server.start();
        await wait(100);
        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable");

        const sampleCount = 50;
        const latencies: number[] = [];

        for (let i = 0; i < sampleCount; i++) {
            const { durationMs } = await measureTime(() =>
                sendRequest(ws, "DOM.echo", { sample: i }, i + 2)
            );
            latencies.push(durationMs);
        }

        latencies.sort((a, b) => a - b);

        const min = latencies[0];
        const max = latencies[latencies.length - 1];
        const median = latencies[Math.floor(sampleCount / 2)];
        const p95 = latencies[Math.floor(sampleCount * 0.95)];
        const p99 = latencies[Math.floor(sampleCount * 0.99)];

        console.log(`  Latency distribution (${sampleCount} samples):`);
        console.log(`    Min: ${min.toFixed(2)}ms, Median: ${median.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
        console.log(`    P95: ${p95.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`);

        // P99 should be under 100ms
        assert(p99 < 100, `P99 latency ${p99.toFixed(2)}ms exceeds 100ms threshold`);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Perf - heavy computation request", ...testOpts, fn: async () => {
    const { server, port } = createPerfTestServer();
    try {
        server.start();
        await wait(100);
        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable");

        const iterations = [100, 1000, 10000];
        const results: { iterations: number; durationMs: number }[] = [];

        for (const iter of iterations) {
            const { durationMs } = await measureTime(() =>
                sendRequest(ws, "DOM.heavyComputation", { iterations: iter }, iter)
            );
            results.push({ iterations: iter, durationMs });
            console.log(`  ${iter} iterations: ${durationMs.toFixed(2)}ms`);
        }

        // Verify computation scales roughly linearly
        const ratio1 = results[1].durationMs / results[0].durationMs;
        const ratio2 = results[2].durationMs / results[1].durationMs;
        console.log(`  Scaling ratios: 10x=${ratio1.toFixed(1)}x, 100x=${ratio2.toFixed(1)}x`);

        // Heavy computation should complete within reasonable time
        assert(results[2].durationMs < 1000, `Heavy computation took ${results[2].durationMs}ms (>1000ms)`);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Perf - rapid connect/disconnect cycles", ...testOpts, fn: async () => {
    const { server, port } = createPerfTestServer();
    try {
        server.start();
        await wait(100);

        const cycles = 10;
        const { durationMs } = await measureTime(async () => {
            for (let i = 0; i < cycles; i++) {
                const ws = await connectWS(port);
                await sendRequest(ws, "DOM.enable");
                await sendRequest(ws, "DOM.echo", { cycle: i }, i + 1);
                ws.close();
                await wait(50); // Small delay to let connection clean up
            }
        });

        const cyclesPerSecond = (cycles / durationMs) * 1000;
        console.log(`  Connect/disconnect rate: ${cyclesPerSecond.toFixed(1)} cycles/sec (${cycles} cycles in ${durationMs.toFixed(0)}ms)`);

        // Should handle at least 5 connect/disconnect cycles per second
        assert(cyclesPerSecond > 5, `Cycle rate ${cyclesPerSecond.toFixed(1)} cycles/sec below 5 threshold`);

        await wait(100);
    } finally {
        await server.stop();
    }
}});

Deno.test({ name: "Perf - request ID uniqueness under load", ...testOpts, fn: async () => {
    const { server, port } = createPerfTestServer();
    try {
        server.start();
        await wait(100);
        const ws = await connectWS(port);
        await sendRequest(ws, "DOM.enable");

        const requestCount = 100;
        const receivedIds = new Set<number>();
        const sentIds = new Set<number>();

        const promises: Promise<ProtocolResponse>[] = [];
        for (let i = 1; i <= requestCount; i++) {
            sentIds.add(i);
            promises.push(sendRequest(ws, "DOM.echo", { id: i }, i));
        }

        const responses = await Promise.all(promises);

        for (const response of responses) {
            receivedIds.add(response.id);
        }

        assertEquals(receivedIds.size, requestCount, "Not all unique IDs received");
        assertEquals(responses.length, requestCount, "Not all responses received");

        // Verify all sent IDs were received
        for (const id of sentIds) {
            assert(receivedIds.has(id), `Response ID ${id} missing`);
        }

        console.log(`  All ${requestCount} unique request IDs properly tracked`);

        ws.close();
        await wait(100);
    } finally {
        await server.stop();
    }
}});
