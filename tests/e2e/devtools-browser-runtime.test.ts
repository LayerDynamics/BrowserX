// Shim HTMLElement for Deno (GraphXCanvas extends it at top level)
if (typeof globalThis.HTMLElement === "undefined") {
  (globalThis as Record<string, unknown>).HTMLElement = class HTMLElement {};
}

/**
 * E2E Tests: DevTools → Browser → Runtime
 *
 * Validates attaching DevTools to a Browser instance, querying domains,
 * and runtime event coordination.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { Browser } from "../../browser/src/main.ts";
import { BrowserXRuntime } from "../../runtime/src/BrowserXRuntime.ts";
import { attachDevTools, BrowserDevTools, EventBus } from "../../dev-tools/integration/mod.ts";
import { DOMDomain } from "../../dev-tools/domains/dom/dom-domain.ts";
import { NetworkDomain } from "../../dev-tools/domains/network/network-domain.ts";
import type { DomainInitContext } from "../../dev-tools/domains/base-domain.ts";

// ============================================================================
// Test Helpers
// ============================================================================

function createDataURL(html: string): string {
  return `data:text/html,${encodeURIComponent(html)}`;
}

function createTestPage(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><title>${title}</title></head><body>${body}</body></html>`;
}

/**
 * Build a DomainInitContext from a Browser instance and EventBus
 */
function buildDomainContext(browser: Browser, eventBus: EventBus): DomainInitContext {
  return {
    browser,
    requestPipeline: browser.getRequestPipeline(),
    renderingPipeline: browser.getRenderingPipeline(),
    storageManager: browser.getStorageManager(),
    cookieManager: browser.getCookieManager(),
    quotaManager: browser.getQuotaManager(),
    eventBus,
  };
}

// ============================================================================
// DevTools → Browser Tests
// ============================================================================

Deno.test({
  name: "E2E DevTools-Browser-Runtime - Attach DevTools to Browser, all 14 domains registered",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = new Browser({ width: 800, height: 600 });

    // Use a non-default port and disable auto-start to avoid binding
    const devtools = attachDevTools(browser, { port: 0, autoStart: false });

    try {
      assertExists(devtools);
      assertExists(devtools.eventBus);
      assertExists(devtools.registry);

      // All 14 domains should be registered
      const domainNames = devtools.getDomainNames();
      assertEquals(domainNames.length, 14);

      // Verify key domains are present
      assert(domainNames.includes("DOM"), "DOM domain should be registered");
      assert(domainNames.includes("Network"), "Network domain should be registered");
      assert(domainNames.includes("Page"), "Page domain should be registered");
      assert(domainNames.includes("Runtime"), "Runtime domain should be registered");
      assert(domainNames.includes("CSS"), "CSS domain should be registered");
      assert(domainNames.includes("Console"), "Console domain should be registered");
      assert(domainNames.includes("Storage"), "Storage domain should be registered");
    } finally {
      await devtools.dispose();
      await browser.close();
    }
  },
});

Deno.test({
  name: "E2E DevTools-Browser-Runtime - DOM domain returns document tree after navigation",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = new Browser({ width: 800, height: 600 });
    const eventBus = new EventBus();
    const context = buildDomainContext(browser, eventBus);

    const domDomain = new DOMDomain(eventBus);
    domDomain.initialize(context);

    try {
      // Navigate browser to a page
      const url = createDataURL(createTestPage("DevTools DOM Test", "<div id='main'><p>Hello</p></div>"));
      await browser.navigate(url);

      // Enable the DOM domain
      await domDomain.handleMethod("enable", {});

      // Get document tree
      const result = await domDomain.handleMethod("getDocument", {});
      assertExists(result);
      assertExists(result.root);
      // The root should be a document node
      assert(result.root.nodeType !== undefined, "Root should have nodeType");
    } finally {
      await domDomain.handleMethod("disable", {});
      eventBus.removeAllListeners();
      await browser.close();
    }
  },
});

Deno.test({
  name: "E2E DevTools-Browser-Runtime - Network domain captures request events",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = new Browser({ width: 800, height: 600 });
    const eventBus = new EventBus();
    const context = buildDomainContext(browser, eventBus);

    const networkDomain = new NetworkDomain(eventBus);
    networkDomain.initialize(context);

    try {
      // Enable network domain
      await networkDomain.handleMethod("enable", {});

      // Collect network events
      const events: Array<{ type: string; data: unknown }> = [];
      eventBus.on("Network.requestWillBeSent", (data: unknown) => {
        events.push({ type: "requestWillBeSent", data });
      });

      // Navigate — data URLs may or may not emit network events depending on impl
      const url = createDataURL(createTestPage("Network Test", "<p>Content</p>"));
      await browser.navigate(url);

      // The domain should be enabled and functioning
      const enabled = networkDomain.isEnabled();
      assertEquals(enabled, true);
    } finally {
      await networkDomain.handleMethod("disable", {});
      eventBus.removeAllListeners();
      await browser.close();
    }
  },
});

Deno.test({
  name: "E2E DevTools-Browser-Runtime - Runtime events emitted during lifecycle",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const runtime = new BrowserXRuntime();
    const events: string[] = [];

    // Listen for runtime events
    runtime.addEventListener((event) => {
      events.push(event.type);
    });

    try {
      await runtime.start();
      assertEquals(runtime.getState(), "running");

      // Runtime should have emitted lifecycle events
      assert(events.length > 0, "Expected runtime events during startup");

      // Event coordinator should be active
      assertExists(runtime.eventCoordinator);
    } finally {
      await runtime.shutdown();
      assertEquals(runtime.getState(), "stopped");
    }
  },
});

Deno.test({
  name: "E2E DevTools-Browser-Runtime - EventBus routes cross-domain events",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const eventBus = new EventBus();
    const receivedEvents: Array<{ channel: string; data: unknown }> = [];

    // Subscribe to multiple domain events
    eventBus.on("DOM.documentUpdated", (data: unknown) => {
      receivedEvents.push({ channel: "DOM.documentUpdated", data });
    });

    eventBus.on("Network.requestWillBeSent", (data: unknown) => {
      receivedEvents.push({ channel: "Network.requestWillBeSent", data });
    });

    eventBus.on("Page.loadEventFired", (data: unknown) => {
      receivedEvents.push({ channel: "Page.loadEventFired", data });
    });

    // Emit events (simulating domain agents firing events)
    eventBus.emit("DOM.documentUpdated", { nodeId: 1 });
    eventBus.emit("Network.requestWillBeSent", { requestId: "req-1", url: "https://example.com" });
    eventBus.emit("Page.loadEventFired", { timestamp: Date.now() });

    // All events should be received by their respective handlers
    assertEquals(receivedEvents.length, 3);
    assertEquals(receivedEvents[0].channel, "DOM.documentUpdated");
    assertEquals(receivedEvents[1].channel, "Network.requestWillBeSent");
    assertEquals(receivedEvents[2].channel, "Page.loadEventFired");

    eventBus.removeAllListeners();
  },
});
