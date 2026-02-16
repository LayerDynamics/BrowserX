/**
 * Page Domain Agent Tests
 *
 * Tests for page navigation, lifecycle events, screenshots,
 * history, and frame tree.
 */

import { assertEquals, assertExists } from "@std/assert";
import { EventBus } from "../../../integration/event-bus.ts";
import { PageDomain } from "../../../domains/page/page-domain.ts";
import {
    createMockContext,
    createMockBrowser,
    resetNodeIdCounter,
} from "../../helpers/mocks.ts";
import type { ProtocolEvent } from "../../../protocol/types.ts";

// ---- Tests ----

Deno.test("PageDomain - enable() emits lifecycle init event", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    await domain.enable();

    const initEvent = events.find(
        (e) => e.method === "Page.lifecycleEvent" && e.params?.name === "init",
    );
    assertExists(initEvent);
    assertEquals(initEvent.params?.frameId, "main-frame");
    assertExists(initEvent.params?.timestamp);
});

Deno.test("PageDomain - navigate() calls browser.navigate and emits lifecycle events", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);

    let navigatedURL = "";
    const browser = createMockBrowser();
    (browser as unknown as Record<string, unknown>).navigate = async (url: string) => {
        navigatedURL = url;
    };

    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    const result = await domain.handleMethod("navigate", { url: "https://test.com" });

    // Verify browser.navigate was called
    assertEquals(navigatedURL, "https://test.com");

    // Verify result contains frameId and loaderId
    assertEquals((result as Record<string, unknown>).frameId, "main-frame");
    assertExists((result as Record<string, unknown>).loaderId);

    // Verify lifecycle events were emitted
    const eventNames = events.map((e) => e.method);
    assertEquals(eventNames.includes("Page.frameStartedLoading"), true);
    assertEquals(eventNames.includes("Page.domContentEventFired"), true);
    assertEquals(eventNames.includes("Page.frameNavigated"), true);
    assertEquals(eventNames.includes("Page.loadEventFired"), true);
    assertEquals(eventNames.includes("Page.frameStoppedLoading"), true);

    // Verify lifecycleEvent DOMContentLoaded was emitted
    const dclEvent = events.find(
        (e) => e.method === "Page.lifecycleEvent" && e.params?.name === "DOMContentLoaded",
    );
    assertExists(dclEvent);

    // Verify lifecycleEvent load was emitted
    const loadEvent = events.find(
        (e) => e.method === "Page.lifecycleEvent" && e.params?.name === "load",
    );
    assertExists(loadEvent);
});

Deno.test("PageDomain - navigate() handles error from browser.navigate", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);

    const browser = createMockBrowser();
    (browser as unknown as Record<string, unknown>).navigate = async (_url: string) => {
        throw new Error("Network error");
    };

    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    const result = await domain.handleMethod("navigate", { url: "https://bad.com" });

    // Should return error text
    assertEquals((result as Record<string, unknown>).errorText, "Network error");
    assertEquals((result as Record<string, unknown>).frameId, "main-frame");

    // frameStoppedLoading should still be emitted
    const stopEvent = events.find((e) => e.method === "Page.frameStoppedLoading");
    assertExists(stopEvent);
});

Deno.test("PageDomain - reload() calls browser.reload", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);

    let reloadCalled = false;
    const browser = createMockBrowser();
    (browser as unknown as Record<string, unknown>).reload = async () => {
        reloadCalled = true;
    };

    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    await domain.handleMethod("reload", {});
    assertEquals(reloadCalled, true);
});

Deno.test("PageDomain - goBack() calls browser.back", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);

    let backCalled = false;
    const browser = createMockBrowser();
    (browser as unknown as Record<string, unknown>).back = async () => {
        backCalled = true;
        return true;
    };

    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("goBack", {});
    assertEquals(backCalled, true);
    assertEquals((result as Record<string, unknown>).success, true);
});

Deno.test("PageDomain - goForward() calls browser.forward", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);

    let forwardCalled = false;
    const browser = createMockBrowser();
    (browser as unknown as Record<string, unknown>).forward = async () => {
        forwardCalled = true;
        return true;
    };

    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("goForward", {});
    assertEquals(forwardCalled, true);
    assertEquals((result as Record<string, unknown>).success, true);
});

Deno.test("PageDomain - captureScreenshot() returns base64 data", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);

    const browser = createMockBrowser();
    // Mock screenshot to return small pixel buffer
    (browser as unknown as Record<string, unknown>).screenshot = async () => {
        return new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    };

    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("captureScreenshot", {});
    const data = (result as Record<string, unknown>).data as string;

    assertExists(data);
    // Should be a non-empty base64 string
    assertEquals(typeof data, "string");
    assertEquals(data.length > 0, true);
});

Deno.test("PageDomain - getNavigationHistory() returns history state", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);
    const browser = createMockBrowser({ currentURL: "https://example.com" });
    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getNavigationHistory", {});
    const currentIndex = (result as Record<string, unknown>).currentIndex as number;
    const entries = (result as Record<string, unknown>).entries as Array<Record<string, unknown>>;

    assertEquals(currentIndex, 1);
    assertExists(entries);
    assertEquals(entries.length, 3);

    // Verify entry structure
    assertEquals(entries[0].url, "about:blank");
    assertEquals(entries[0].transitionType, "typed");
    assertEquals(entries[1].url, "https://example.com");
});

Deno.test("PageDomain - getFrameTree() returns frame info", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);
    const browser = createMockBrowser({ currentURL: "https://example.com" });
    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getFrameTree", {});
    const frameTree = (result as Record<string, unknown>).frameTree as Record<string, unknown>;
    const frame = frameTree.frame as Record<string, unknown>;

    assertExists(frame);
    assertEquals(frame.id, "main-frame");
    assertEquals(frame.url, "https://example.com");
    assertEquals(frame.securityOrigin, "https://example.com");
    assertEquals(frame.mimeType, "text/html");
});

Deno.test("PageDomain - getFrameTree() with about:blank has empty securityOrigin", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);
    const browser = createMockBrowser({ currentURL: "about:blank" });
    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getFrameTree", {});
    const frameTree = (result as Record<string, unknown>).frameTree as Record<string, unknown>;
    const frame = frameTree.frame as Record<string, unknown>;

    assertEquals(frame.url, "about:blank");
    assertEquals(frame.securityOrigin, "");
});

Deno.test("PageDomain - navigate() increments loaderId", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);
    const browser = createMockBrowser();
    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const result1 = await domain.handleMethod("navigate", { url: "https://one.com" });
    const loaderId1 = (result1 as Record<string, unknown>).loaderId as string;

    const result2 = await domain.handleMethod("navigate", { url: "https://two.com" });
    const loaderId2 = (result2 as Record<string, unknown>).loaderId as string;

    // Loader IDs should be different and incrementing
    assertEquals(loaderId1, "loader-1");
    assertEquals(loaderId2, "loader-2");
});

// ============================================================================
// Enhanced Edge Case Tests
// ============================================================================

Deno.test("PageDomain - disable() returns empty object", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.disable();
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), false);
});

Deno.test("PageDomain - getResourceTree() returns frame and empty resources", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);
    const browser = createMockBrowser({ currentURL: "https://resource.com" });
    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getResourceTree", {});
    const frameTree = (result as Record<string, unknown>).frameTree as Record<string, unknown>;
    const frame = frameTree.frame as Record<string, unknown>;
    const resources = frameTree.resources as unknown[];

    assertExists(frame);
    assertEquals(frame.id, "main-frame");
    assertEquals(frame.url, "https://resource.com");
    assertEquals(frame.securityOrigin, "https://resource.com");
    assertEquals(resources, []);
});

Deno.test("PageDomain - getResourceTree() with about:blank has empty origin", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);
    const browser = createMockBrowser({ currentURL: "about:blank" });
    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getResourceTree", {});
    const frameTree = (result as Record<string, unknown>).frameTree as Record<string, unknown>;
    const frame = frameTree.frame as Record<string, unknown>;

    assertEquals(frame.url, "about:blank");
    assertEquals(frame.securityOrigin, "");
});

Deno.test("PageDomain - navigate lifecycle events emitted in correct order", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);
    const browser = createMockBrowser();
    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const eventMethods: string[] = [];
    domain.addEventListener((event) => eventMethods.push(event.method));

    await domain.handleMethod("navigate", { url: "https://test.com" });

    // Verify the expected ordering
    const expectedOrder = [
        "Page.frameStartedLoading",
        "Page.domContentEventFired",
        "Page.lifecycleEvent", // DOMContentLoaded
        "Page.frameNavigated",
        "Page.loadEventFired",
        "Page.lifecycleEvent", // load
        "Page.frameStoppedLoading",
    ];

    assertEquals(eventMethods.length, expectedOrder.length);
    for (let i = 0; i < expectedOrder.length; i++) {
        assertEquals(eventMethods[i], expectedOrder[i], `Event at position ${i} should be ${expectedOrder[i]}`);
    }
});

Deno.test("PageDomain - reload() returns empty result", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);
    const browser = createMockBrowser();
    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("reload", {});
    assertEquals(result, {});
});

Deno.test("PageDomain - getNavigationHistory entry structure has expected fields", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);
    const browser = createMockBrowser({ currentURL: "https://example.com" });
    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getNavigationHistory", {});
    const entries = (result as Record<string, unknown>).entries as Array<Record<string, unknown>>;

    for (const entry of entries) {
        assertExists(entry.id, "Entry should have id");
        assertExists(entry.url, "Entry should have url");
        assertExists(entry.title, "Entry should have title");
        assertExists(entry.transitionType, "Entry should have transitionType");
        assertEquals(entry.transitionType, "typed");
    }
});

Deno.test("PageDomain - handleMethod throws for unknown method", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    await domain.enable();

    let threw = false;
    try {
        await domain.handleMethod("nonExistentMethod", {});
    } catch (e) {
        threw = true;
        assertEquals((e as Error).message.includes("not found"), true);
    }
    assertEquals(threw, true);
});

Deno.test("PageDomain - navigate frameNavigated event contains frame details", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new PageDomain(eventBus);
    const browser = createMockBrowser();
    const context = createMockContext({ eventBus, browser });
    domain.initialize(context);
    await domain.enable();

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    await domain.handleMethod("navigate", { url: "https://nav-test.com/page" });

    const frameNavEvent = events.find((e) => e.method === "Page.frameNavigated");
    assertExists(frameNavEvent);

    const frame = frameNavEvent.params?.frame as Record<string, unknown>;
    assertExists(frame);
    assertEquals(frame.id, "main-frame");
    assertEquals(frame.url, "https://nav-test.com/page");
    assertEquals(frame.securityOrigin, "https://nav-test.com");
    assertEquals(frame.mimeType, "text/html");
});
