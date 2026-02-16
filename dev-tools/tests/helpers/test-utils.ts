/**
 * Test Utilities for BrowserX DevTools Tests
 *
 * Provides helper functions for parsing, mocking, and test assertions
 * specific to DevTools protocol testing.
 */

import type {
    ProtocolRequest,
    ProtocolResponse,
    ProtocolEvent,
    ProtocolMessage,
    DomainName,
} from "../../protocol/types.ts";
import { isRequest, isResponse, isEvent } from "../../protocol/types.ts";
import { EventBus } from "../../integration/event-bus.ts";
import { DomainRegistry } from "../../protocol/domains.ts";
import { Router } from "../../server/router.ts";
import type { BaseDomain } from "../../domains/base-domain.ts";
import type { DomainInitContext } from "../../domains/base-domain.ts";
import { createMockContext } from "./mocks.ts";

// ============================================================================
// Message Parsing Utilities
// ============================================================================

/**
 * Parse a raw WebSocket message to a protocol object
 */
export function parseMessage(data: string): ProtocolMessage {
    const parsed = JSON.parse(data);
    if (isRequest(parsed)) {
        return parsed as ProtocolRequest;
    }
    if (isResponse(parsed)) {
        return parsed as ProtocolResponse;
    }
    if (isEvent(parsed)) {
        return parsed as ProtocolEvent;
    }
    throw new Error("Unknown message type");
}

/**
 * Parse a message and assert it's a request
 */
export function parseAsRequest(data: string): ProtocolRequest {
    const msg = parseMessage(data);
    if (!isRequest(msg)) {
        throw new Error("Expected request message");
    }
    return msg;
}

/**
 * Parse a message and assert it's a response
 */
export function parseAsResponse(data: string): ProtocolResponse {
    const msg = parseMessage(data);
    if (!isResponse(msg)) {
        throw new Error("Expected response message");
    }
    return msg;
}

/**
 * Parse a message and assert it's an event
 */
export function parseAsEvent(data: string): ProtocolEvent {
    const msg = parseMessage(data);
    if (!isEvent(msg)) {
        throw new Error("Expected event message");
    }
    return msg;
}

/**
 * Serialize a protocol message to JSON string
 */
export function serializeMessage(message: ProtocolMessage): string {
    return JSON.stringify(message);
}

// ============================================================================
// Event Utilities
// ============================================================================

/**
 * Wait for a specific event with timeout
 */
export function waitForEvent(
    eventBus: EventBus,
    eventName: string,
    timeout: number = 5000,
): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for event "${eventName}"`));
        }, timeout);

        eventBus.once(eventName, (data) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}

/**
 * Wait for a domain event with timeout
 */
export function waitForDomainEvent(
    domain: BaseDomain,
    eventMethod: string,
    timeout: number = 5000,
): Promise<ProtocolEvent> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for domain event "${eventMethod}"`));
        }, timeout);

        const listener = (event: ProtocolEvent) => {
            if (event.method === eventMethod) {
                clearTimeout(timer);
                domain.removeEventListener(listener);
                resolve(event);
            }
        };

        domain.addEventListener(listener);
    });
}

/**
 * Collect events for a duration
 */
export function collectEvents(
    eventBus: EventBus,
    eventName: string,
    duration: number,
): Promise<unknown[]> {
    return new Promise((resolve) => {
        const events: unknown[] = [];

        const handler = (data: unknown) => {
            events.push(data);
        };

        eventBus.on(eventName, handler);

        setTimeout(() => {
            eventBus.off(eventName, handler);
            resolve(events);
        }, duration);
    });
}

/**
 * Collect domain events for a duration
 */
export function collectDomainEvents(
    domain: BaseDomain,
    duration: number,
): Promise<ProtocolEvent[]> {
    return new Promise((resolve) => {
        const events: ProtocolEvent[] = [];

        const listener = (event: ProtocolEvent) => {
            events.push(event);
        };

        domain.addEventListener(listener);

        setTimeout(() => {
            domain.removeEventListener(listener);
            resolve(events);
        }, duration);
    });
}

// ============================================================================
// Test Infrastructure Utilities
// ============================================================================

/**
 * Create a test Router with a DomainRegistry
 */
export function createTestRouter(registry?: DomainRegistry): Router {
    return new Router(registry ?? new DomainRegistry());
}

/**
 * Create a test DomainRegistry
 */
export function createTestRegistry(): DomainRegistry {
    return new DomainRegistry();
}

/**
 * Create a test EventBus
 */
export function createTestEventBus(): EventBus {
    return new EventBus();
}

/**
 * Initialize a domain for testing
 */
export function initializeDomain<T extends BaseDomain>(
    DomainClass: new (eventBus: EventBus) => T,
    contextOverrides?: Parameters<typeof createMockContext>[0],
): { domain: T; eventBus: EventBus; context: DomainInitContext } {
    const eventBus = new EventBus();
    const domain = new DomainClass(eventBus);
    const context = createMockContext({ eventBus, ...contextOverrides });
    domain.initialize(context);
    return { domain, eventBus, context };
}

/**
 * Create a complete test setup with router, registry, and domains
 */
export function createTestSetup(
    domains: Array<{ DomainClass: new (eventBus: EventBus) => BaseDomain; meta: { name: DomainName; description: string; version: string } }>,
): {
    router: Router;
    registry: DomainRegistry;
    eventBus: EventBus;
    context: DomainInitContext;
    domains: Map<DomainName, BaseDomain>;
} {
    const eventBus = new EventBus();
    const registry = new DomainRegistry();
    const router = new Router(registry);
    const context = createMockContext({ eventBus });
    const domainMap = new Map<DomainName, BaseDomain>();

    for (const { DomainClass, meta } of domains) {
        const domain = new DomainClass(eventBus);
        domain.initialize(context);
        registry.register(domain, meta);
        domainMap.set(domain.name, domain);
    }

    return { router, registry, eventBus, context, domains: domainMap };
}

// ============================================================================
// Timing Utilities
// ============================================================================

/**
 * Measure async function execution time
 */
export async function measureTime<T>(
    fn: () => Promise<T>,
): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
}

/**
 * Measure sync function execution time
 */
export function measureTimeSync<T>(
    fn: () => T,
): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    return { result, duration };
}

/**
 * Wait for a specified duration
 */
export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function until it succeeds or max attempts reached
 */
export async function retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 100,
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxAttempts) {
                await wait(delayMs);
            }
        }
    }

    throw lastError;
}

// ============================================================================
// Assertion Utilities
// ============================================================================

/**
 * Assert that a response is successful (has result, no error)
 */
export function assertSuccessResponse(
    response: ProtocolResponse,
    expectedId?: number,
): asserts response is ProtocolResponse & { result: Record<string, unknown> } {
    if (response.error) {
        throw new Error(`Expected success response but got error: ${response.error.message}`);
    }
    if (!response.result) {
        throw new Error("Expected response to have result property");
    }
    if (expectedId !== undefined && response.id !== expectedId) {
        throw new Error(`Expected response id ${expectedId} but got ${response.id}`);
    }
}

/**
 * Assert that a response is an error
 */
export function assertErrorResponse(
    response: ProtocolResponse,
    expectedCode?: number,
): asserts response is ProtocolResponse & { error: { code: number; message: string } } {
    if (!response.error) {
        throw new Error("Expected error response but got success");
    }
    if (expectedCode !== undefined && response.error.code !== expectedCode) {
        throw new Error(`Expected error code ${expectedCode} but got ${response.error.code}`);
    }
}

/**
 * Assert that an event has the expected method
 */
export function assertEventMethod(
    event: ProtocolEvent,
    expectedMethod: string,
): void {
    if (event.method !== expectedMethod) {
        throw new Error(`Expected event method "${expectedMethod}" but got "${event.method}"`);
    }
}

/**
 * Assert that a domain is enabled
 */
export function assertDomainEnabled(domain: BaseDomain): void {
    if (!domain.isEnabled()) {
        throw new Error(`Expected domain "${domain.name}" to be enabled`);
    }
}

/**
 * Assert that a domain is disabled
 */
export function assertDomainDisabled(domain: BaseDomain): void {
    if (domain.isEnabled()) {
        throw new Error(`Expected domain "${domain.name}" to be disabled`);
    }
}

// ============================================================================
// Error Testing Utilities
// ============================================================================

/**
 * Get error message from thrown error
 */
export function getErrorMessage(fn: () => void): string {
    try {
        fn();
        return "";
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

/**
 * Get error message from async thrown error
 */
export async function getAsyncErrorMessage(fn: () => Promise<unknown>): Promise<string> {
    try {
        await fn();
        return "";
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

/**
 * Check if function throws specific error
 */
export function throwsError(fn: () => void, expectedMessage?: string): boolean {
    try {
        fn();
        return false;
    } catch (error) {
        if (!expectedMessage) {
            return true;
        }
        const message = error instanceof Error ? error.message : String(error);
        return message.includes(expectedMessage);
    }
}

/**
 * Check if async function throws specific error
 */
export async function throwsAsyncError(
    fn: () => Promise<unknown>,
    expectedMessage?: string,
): Promise<boolean> {
    try {
        await fn();
        return false;
    } catch (error) {
        if (!expectedMessage) {
            return true;
        }
        const message = error instanceof Error ? error.message : String(error);
        return message.includes(expectedMessage);
    }
}

// ============================================================================
// Mock Request Utilities
// ============================================================================

/**
 * Create a mock CDP request string
 */
export function createMockRequestString(
    id: number,
    method: string,
    params?: Record<string, unknown>,
): string {
    const request: ProtocolRequest = { id, method: method as ProtocolRequest["method"] };
    if (params) {
        request.params = params;
    }
    return JSON.stringify(request);
}

/**
 * Create a batch of mock requests
 */
export function createMockRequestBatch(
    startId: number,
    methods: string[],
): string[] {
    return methods.map((method, i) =>
        createMockRequestString(startId + i, method)
    );
}

/**
 * Simulate a sequence of requests through a router
 */
export async function simulateRequestSequence(
    router: Router,
    requests: ProtocolRequest[],
): Promise<ProtocolResponse[]> {
    const responses: ProtocolResponse[] = [];
    for (const request of requests) {
        const response = await router.route(request);
        responses.push(response);
    }
    return responses;
}

// ============================================================================
// Benchmark Utilities
// ============================================================================

/**
 * Run a benchmark for a function
 */
export async function benchmark(
    name: string,
    fn: () => Promise<void>,
    iterations: number = 100,
): Promise<{
    name: string;
    iterations: number;
    totalMs: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
}> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fn();
        times.push(performance.now() - start);
    }

    const totalMs = times.reduce((a, b) => a + b, 0);
    const avgMs = totalMs / iterations;
    const minMs = Math.min(...times);
    const maxMs = Math.max(...times);

    return { name, iterations, totalMs, avgMs, minMs, maxMs };
}

/**
 * Run a sync benchmark
 */
export function benchmarkSync(
    name: string,
    fn: () => void,
    iterations: number = 100,
): {
    name: string;
    iterations: number;
    totalMs: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
} {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        fn();
        times.push(performance.now() - start);
    }

    const totalMs = times.reduce((a, b) => a + b, 0);
    const avgMs = totalMs / iterations;
    const minMs = Math.min(...times);
    const maxMs = Math.max(...times);

    return { name, iterations, totalMs, avgMs, minMs, maxMs };
}

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate unique IDs for testing
 */
let nextTestId = 1;
export function generateTestId(): number {
    return nextTestId++;
}

/**
 * Reset test ID counter
 */
export function resetTestIdCounter(): void {
    nextTestId = 1;
}

/**
 * Generate a random string
 */
export function randomString(length: number = 10): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Generate a random port number (for testing)
 */
export function randomPort(): number {
    return 9000 + Math.floor(Math.random() * 1000);
}

// ============================================================================
// Protocol Validation Utilities
// ============================================================================

/**
 * Validate that a response follows the CDP response format
 */
export function validateResponseFormat(response: ProtocolResponse): boolean {
    if (typeof response.id !== "number") return false;
    if (response.error !== undefined && response.result !== undefined) return false;
    if (response.error !== undefined) {
        if (typeof response.error.code !== "number") return false;
        if (typeof response.error.message !== "string") return false;
    }
    return true;
}

/**
 * Validate that an event follows the CDP event format
 */
export function validateEventFormat(event: ProtocolEvent): boolean {
    if (typeof event.method !== "string") return false;
    if (!event.method.includes(".")) return false;
    return true;
}

/**
 * Validate that a request follows the CDP request format
 */
export function validateRequestFormat(request: ProtocolRequest): boolean {
    if (typeof request.id !== "number") return false;
    if (typeof request.method !== "string") return false;
    if (!request.method.includes(".")) return false;
    if (request.params !== undefined && typeof request.params !== "object") return false;
    return true;
}
