/**
 * Network Domain Agent Tests
 *
 * Tests for HTTP request/response tracking, cookies, cache,
 * and request statistics.
 */

import { assertEquals, assertRejects, assertExists } from "@std/assert";
import { EventBus } from "../../../integration/event-bus.ts";
import { NetworkDomain } from "../../../domains/network/network-domain.ts";
import {
    createMockContext,
    createMockCookieManager,
    createMockRenderingPipeline,
    resetNodeIdCounter,
} from "../../helpers/mocks.ts";
import type { ProtocolEvent } from "../../../protocol/types.ts";

// ---- Tests ----

Deno.test("NetworkDomain - enable() returns empty object", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);

    const result = await domain.enable();
    assertEquals(result, {});
});

Deno.test("NetworkDomain - getResponseBody() with unknown requestId throws", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    await assertRejects(
        async () => {
            await domain.handleMethod("getResponseBody", { requestId: "nonexistent" });
        },
        Error,
        "not found",
    );
});

Deno.test("NetworkDomain - trackRequest and getResponseBody() returns tracked body", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    // Track a request
    const requestId = domain.trackRequest(
        "https://example.com/api",
        "GET",
        { "Accept": "application/json" },
        "Fetch",
    );

    // Track the response with a body
    domain.trackResponse(requestId, 200, "OK", { "content-type": "application/json" }, '{"ok":true}');

    // Get response body
    const result = await domain.handleMethod("getResponseBody", { requestId });
    assertEquals((result as Record<string, unknown>).body, '{"ok":true}');
    assertEquals((result as Record<string, unknown>).base64Encoded, false);
});

Deno.test("NetworkDomain - trackRequest emits requestWillBeSent when enabled", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.trackRequest("https://test.com", "POST", {}, "XHR", "script");

    const reqEvent = events.find((e) => e.method === "Network.requestWillBeSent");
    assertExists(reqEvent);
    assertEquals(reqEvent.params?.type, "XHR");
});

Deno.test("NetworkDomain - trackResponse emits responseReceived and loadingFinished", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    const requestId = domain.trackRequest("https://test.com", "GET", {});
    domain.trackResponse(requestId, 200, "OK", {}, "body data");

    const respEvent = events.find((e) => e.method === "Network.responseReceived");
    assertExists(respEvent);

    const finishEvent = events.find((e) => e.method === "Network.loadingFinished");
    assertExists(finishEvent);
});

Deno.test("NetworkDomain - trackResponse with fromCache emits requestServedFromCache", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    const requestId = domain.trackRequest("https://cached.com", "GET", {});
    domain.trackResponse(requestId, 200, "OK", {}, "cached data", true);

    const cacheEvent = events.find((e) => e.method === "Network.requestServedFromCache");
    assertExists(cacheEvent);
    assertEquals(cacheEvent.params?.requestId, requestId);
});

Deno.test("NetworkDomain - trackFailure emits loadingFailed", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    const requestId = domain.trackRequest("https://fail.com", "GET", {});
    domain.trackFailure(requestId, "Connection refused");

    const failEvent = events.find((e) => e.method === "Network.loadingFailed");
    assertExists(failEvent);
    assertEquals(failEvent.params?.errorText, "Connection refused");
    assertEquals(failEvent.params?.canceled, false);
});

Deno.test("NetworkDomain - getCookies() returns cookies from manager", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);

    const cookieManager = createMockCookieManager([
        { name: "session", value: "abc123", domain: ".example.com", path: "/" } as never,
    ]);

    const context = createMockContext({ eventBus, cookieManager });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getCookies", {
        urls: ["https://example.com"],
    });
    const cookies = (result as Record<string, unknown>).cookies as unknown[];
    assertExists(cookies);
    assertEquals(cookies.length > 0, true);
});

Deno.test("NetworkDomain - setCookie() adds cookie via manager", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const cookieManager = createMockCookieManager();
    const context = createMockContext({ eventBus, cookieManager });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("setCookie", {
        name: "token",
        value: "xyz789",
        domain: ".example.com",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "Strict",
    });

    assertEquals((result as Record<string, unknown>).success, true);

    // Verify cookie was added
    const allCookies = cookieManager.getAllCookies();
    const tokenCookie = allCookies.find((c: unknown) => (c as Record<string, unknown>).name === "token");
    assertExists(tokenCookie);
});

Deno.test("NetworkDomain - clearBrowserCache() calls pipeline clearCache", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);

    let cacheClearCalled = false;
    const renderingPipeline = createMockRenderingPipeline();
    (renderingPipeline as unknown as Record<string, unknown>).clearCache = () => {
        cacheClearCalled = true;
    };

    const context = createMockContext({ eventBus, renderingPipeline });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("clearBrowserCache", {});
    assertEquals(cacheClearCalled, true);
});

Deno.test("NetworkDomain - clearBrowserCookies() calls cookie manager clearAll", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);

    let clearAllCalled = false;
    const cookieManager = createMockCookieManager([
        { name: "old", value: "cookie", domain: ".example.com", path: "/" } as never,
    ]);
    const originalClearAll = cookieManager.clearAll;
    cookieManager.clearAll = () => {
        clearAllCalled = true;
        originalClearAll();
    };

    const context = createMockContext({ eventBus, cookieManager });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("clearBrowserCookies", {});
    assertEquals(clearAllCalled, true);
    assertEquals(cookieManager.getCookieCount(), 0);
});

Deno.test("NetworkDomain - setCacheDisabled() toggles cache state", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    // Enable cache disabled
    const result1 = await domain.handleMethod("setCacheDisabled", { cacheDisabled: true });
    assertEquals(result1, {});

    // Disable cache disabled
    const result2 = await domain.handleMethod("setCacheDisabled", { cacheDisabled: false });
    assertEquals(result2, {});
});

Deno.test("NetworkDomain - getRequestStats() returns stats", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    // Initially no requests
    const stats0 = await domain.handleMethod("getRequestStats", {});
    assertEquals((stats0 as Record<string, unknown>).totalRequests, 0);
    assertEquals((stats0 as Record<string, unknown>).totalBytes, 0);
    assertEquals((stats0 as Record<string, unknown>).cachedRequests, 0);

    // Track some requests
    const id1 = domain.trackRequest("https://a.com", "GET", {});
    domain.trackResponse(id1, 200, "OK", {}, "hello");

    const id2 = domain.trackRequest("https://b.com", "GET", {});
    domain.trackResponse(id2, 200, "OK", {}, "world data", true);

    const stats = await domain.handleMethod("getRequestStats", {});
    assertEquals((stats as Record<string, unknown>).totalRequests, 2);
    assertEquals((stats as Record<string, unknown>).totalBytes, 5 + 10); // "hello" + "world data"
    assertEquals((stats as Record<string, unknown>).cachedRequests, 1);
    assertEquals((stats as Record<string, unknown>).activeConnections, 0);
});

Deno.test("NetworkDomain - dispose() clears tracked requests", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    domain.trackRequest("https://test.com", "GET", {});
    domain.trackRequest("https://test2.com", "POST", {});

    const statsBefore = await domain.handleMethod("getRequestStats", {});
    assertEquals((statsBefore as Record<string, unknown>).totalRequests, 2);

    domain.dispose();

    // After dispose, domain is disabled, re-initialize for stats
    domain.initialize(context);
    const statsAfter = await domain.handleMethod("getRequestStats", {});
    assertEquals((statsAfter as Record<string, unknown>).totalRequests, 0);
});

// ============================================================================
// Enhanced Edge Case Tests
// ============================================================================

Deno.test("NetworkDomain - disable() returns empty object", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();
    assertEquals(domain.isEnabled(), true);

    const result = await domain.disable();
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), false);
});

Deno.test("NetworkDomain - trackRequest when disabled does not emit event", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    // NOT enabled

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    const requestId = domain.trackRequest("https://silent.com", "GET", {});

    // No event should be emitted
    assertEquals(events.length, 0);
    // But request should be tracked
    assertExists(requestId);
});

Deno.test("NetworkDomain - trackResponse for unknown requestId is no-op", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    // Track response for non-existent request
    domain.trackResponse("unknown-req", 200, "OK", {}, "body");

    // No events emitted
    const respEvents = events.filter((e) =>
        e.method === "Network.responseReceived" || e.method === "Network.loadingFinished"
    );
    assertEquals(respEvents.length, 0);
});

Deno.test("NetworkDomain - trackFailure for unknown requestId is no-op", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    domain.trackFailure("unknown-req", "Connection refused");

    const failEvents = events.filter((e) => e.method === "Network.loadingFailed");
    assertEquals(failEvents.length, 0);
});

Deno.test("NetworkDomain - getResponseBody returns empty string for request without body", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const requestId = domain.trackRequest("https://nobody.com", "HEAD", {});
    domain.trackResponse(requestId, 204, "No Content", {});

    const result = await domain.handleMethod("getResponseBody", { requestId });
    assertEquals((result as Record<string, unknown>).body, "");
    assertEquals((result as Record<string, unknown>).base64Encoded, false);
});

Deno.test("NetworkDomain - getCookies with empty URLs returns empty array", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const cookieManager = createMockCookieManager();
    const context = createMockContext({ eventBus, cookieManager });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getCookies", { urls: [] });
    const cookies = (result as Record<string, unknown>).cookies as unknown[];
    assertEquals(cookies, []);
});

Deno.test("NetworkDomain - setCookie with minimal params succeeds", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const cookieManager = createMockCookieManager();
    const context = createMockContext({ eventBus, cookieManager });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("setCookie", {
        name: "simple",
        value: "val",
        domain: ".example.com",
    });

    assertEquals((result as Record<string, unknown>).success, true);
});

Deno.test("NetworkDomain - getRequestStats with failed requests counts correctly", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    // Track a successful request
    const id1 = domain.trackRequest("https://success.com", "GET", {});
    domain.trackResponse(id1, 200, "OK", {}, "data");

    // Track a failed request
    const id2 = domain.trackRequest("https://fail.com", "GET", {});
    domain.trackFailure(id2, "DNS resolution failed");

    const stats = await domain.handleMethod("getRequestStats", {});
    assertEquals((stats as Record<string, unknown>).totalRequests, 2);
    assertEquals((stats as Record<string, unknown>).totalBytes, 4); // "data" = 4 bytes
    assertEquals((stats as Record<string, unknown>).cachedRequests, 0);
});

Deno.test("NetworkDomain - trackRequest returns unique sequential IDs", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const id1 = domain.trackRequest("https://a.com", "GET", {});
    const id2 = domain.trackRequest("https://b.com", "GET", {});
    const id3 = domain.trackRequest("https://c.com", "GET", {});

    assertEquals(id1, "req-1");
    assertEquals(id2, "req-2");
    assertEquals(id3, "req-3");
});

Deno.test("NetworkDomain - evicts oldest completed requests when exceeding capacity", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    // Fill up to the max (1000) with completed requests
    const ids: string[] = [];
    for (let i = 0; i < 1001; i++) {
        const id = domain.trackRequest(`https://example.com/${i}`, "GET", {});
        domain.trackResponse(id, 200, "OK", {}, `body-${i}`);
        ids.push(id);
    }

    // Stats should show 1000 (the oldest completed request was evicted)
    const stats = await domain.handleMethod("getRequestStats", {});
    assertEquals((stats as Record<string, unknown>).totalRequests, 1000);

    // The first request should have been evicted
    await assertRejects(
        async () => {
            await domain.handleMethod("getResponseBody", { requestId: ids[0] });
        },
        Error,
        "not found",
    );

    // The last request should still be accessible
    const result = await domain.handleMethod("getResponseBody", { requestId: ids[1000] });
    assertEquals((result as Record<string, unknown>).body, "body-1000");
});

Deno.test("NetworkDomain - handleMethod throws for unknown method", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new NetworkDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    await assertRejects(
        async () => {
            await domain.handleMethod("nonExistentMethod", {});
        },
        Error,
        "not found",
    );
});
