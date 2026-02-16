/**
 * Multi-Domain Integration Tests
 *
 * Tests coordination between multiple domains, including:
 * - DOM + CSS style lookup
 * - Network + Page navigation
 * - Runtime + Console message handling
 * - Cross-domain EventBus communication
 */

import { assertEquals, assertExists } from "@std/assert";
import { EventBus } from "../../integration/event-bus.ts";
import { DomainRegistry, type DomainMetadata } from "../../protocol/domains.ts";
import { Router } from "../../server/router.ts";
import { BaseDomain, type DomainInitContext } from "../../domains/base-domain.ts";
import type { DomainName, ProtocolEvent, ProtocolMethod } from "../../protocol/types.ts";
import { createMockContext, createMockRenderingPipeline, createMockRenderResult } from "../helpers/mocks.ts";
import { createCDPRequest } from "../helpers/fixtures.ts";

// ============================================================================
// Multi-Domain Test Domains
// ============================================================================

class TestDOMDomain extends BaseDomain {
    readonly name: DomainName = "DOM";
    private nodes: Map<number, { id: number; type: string; className?: string }> = new Map();

    protected setup(): void {
        this.registerMethod("getDocument", "Get document", async () => {
            return {
                root: { nodeId: 1, nodeType: 9, nodeName: "#document" },
            };
        });

        this.registerMethod("getNode", "Get a node", async (params) => {
            const node = this.nodes.get(params.nodeId as number);
            if (!node) {
                return { node: null };
            }
            return { node };
        });

        this.registerEvent("documentUpdated", "Document updated");
        this.registerEvent("childNodeInserted", "Child inserted");

        // Initialize some nodes
        this.nodes.set(1, { id: 1, type: "document" });
        this.nodes.set(2, { id: 2, type: "element", className: "container" });
        this.nodes.set(3, { id: 3, type: "element", className: "item" });
    }

    emitDocumentUpdated(): void {
        this.emitEvent("documentUpdated", {});
    }

    emitChildInserted(parentId: number, nodeId: number): void {
        this.emitEvent("childNodeInserted", { parentNodeId: parentId, node: { nodeId } });
    }
}

class TestCSSDomain extends BaseDomain {
    readonly name: DomainName = "CSS";
    private styles: Map<number, Record<string, string>> = new Map();
    private domUpdateReceived = false;

    constructor(eventBus: EventBus) {
        super(eventBus);

        // Listen for DOM updates
        eventBus.on("DOM.documentUpdated", () => {
            this.domUpdateReceived = true;
        });
    }

    protected setup(): void {
        this.registerMethod("getComputedStyleForNode", "Get computed styles", async (params) => {
            const styles = this.styles.get(params.nodeId as number) || {};
            return {
                computedStyle: Object.entries(styles).map(([name, value]) => ({ name, value })),
            };
        });

        this.registerMethod("getMatchedStylesForNode", "Get matched styles", async (params) => {
            return {
                matchedCSSRules: [],
                inlineStyle: this.styles.get(params.nodeId as number) || {},
            };
        });

        this.registerEvent("styleSheetChanged", "Stylesheet changed");

        // Initialize some styles
        this.styles.set(2, { "color": "red", "font-size": "16px" });
        this.styles.set(3, { "background": "blue" });
    }

    hasDOMUpdateReceived(): boolean {
        return this.domUpdateReceived;
    }
}

class TestNetworkDomain extends BaseDomain {
    readonly name: DomainName = "Network";
    private requests: Map<string, { url: string; status?: number }> = new Map();

    protected setup(): void {
        this.registerMethod("getRequestInfo", "Get request info", async (params) => {
            const request = this.requests.get(params.requestId as string);
            return { request: request || null };
        });

        this.registerEvent("requestWillBeSent", "Request will be sent");
        this.registerEvent("responseReceived", "Response received");
        this.registerEvent("loadingFinished", "Loading finished");
    }

    simulateRequest(requestId: string, url: string): void {
        this.requests.set(requestId, { url });
        this.emitEvent("requestWillBeSent", {
            requestId,
            request: { url, method: "GET" },
            timestamp: Date.now() / 1000,
        });
    }

    simulateResponse(requestId: string, status: number): void {
        const request = this.requests.get(requestId);
        if (request) {
            request.status = status;
            this.emitEvent("responseReceived", {
                requestId,
                response: { status, statusText: status === 200 ? "OK" : "Error" },
                timestamp: Date.now() / 1000,
            });
        }
    }

    simulateLoadingFinished(requestId: string): void {
        this.emitEvent("loadingFinished", {
            requestId,
            timestamp: Date.now() / 1000,
            encodedDataLength: 1024,
        });
    }
}

class TestPageDomain extends BaseDomain {
    readonly name: DomainName = "Page";
    private currentUrl = "about:blank";
    private networkEvents: string[] = [];

    constructor(eventBus: EventBus) {
        super(eventBus);

        // Listen for network events
        eventBus.on("Network.requestWillBeSent", () => {
            this.networkEvents.push("requestWillBeSent");
        });
        eventBus.on("Network.loadingFinished", () => {
            this.networkEvents.push("loadingFinished");
        });
    }

    protected setup(): void {
        this.registerMethod("navigate", "Navigate to URL", async (params) => {
            this.currentUrl = params.url as string;
            this.emitEvent("frameNavigated", {
                frame: { url: this.currentUrl, id: "frame-1" },
            });
            return { frameId: "frame-1" };
        });

        this.registerMethod("getCurrentUrl", "Get current URL", async () => {
            return { url: this.currentUrl };
        });

        this.registerEvent("frameNavigated", "Frame navigated");
        this.registerEvent("loadEventFired", "Load event fired");
    }

    getNetworkEventsReceived(): string[] {
        return [...this.networkEvents];
    }
}

class TestRuntimeDomain extends BaseDomain {
    readonly name: DomainName = "Runtime";
    private consoleMessages: string[] = [];

    protected setup(): void {
        this.registerMethod("evaluate", "Evaluate expression", async (params) => {
            const expr = params.expression as string;

            // Simple evaluation for testing
            if (expr.startsWith("console.log(")) {
                const message = expr.match(/console\.log\(['"](.+)['"]\)/)?.[1] || "unknown";
                this.consoleMessages.push(message);
                this.emitEvent("consoleAPICalled", {
                    type: "log",
                    args: [{ type: "string", value: message }],
                });
                return { result: { type: "undefined" } };
            }

            return { result: { type: "number", value: 42 } };
        });

        this.registerMethod("getConsoleMessages", "Get console messages", async () => {
            return { messages: this.consoleMessages };
        });

        this.registerEvent("consoleAPICalled", "Console API called");
        this.registerEvent("executionContextCreated", "Execution context created");
    }
}

class TestConsoleDomain extends BaseDomain {
    readonly name: DomainName = "Console";
    private messages: Array<{ level: string; text: string }> = [];

    constructor(eventBus: EventBus) {
        super(eventBus);

        // Listen for runtime console events
        eventBus.on("Runtime.consoleAPICalled", (data) => {
            const typedData = data as { type: string; args: Array<{ value: string }> };
            this.messages.push({
                level: typedData.type,
                text: typedData.args[0]?.value || "",
            });
            this.emitEvent("messageAdded", {
                message: { level: typedData.type, text: typedData.args[0]?.value || "" },
            });
        });
    }

    protected setup(): void {
        this.registerMethod("getMessages", "Get console messages", async () => {
            return { messages: this.messages };
        });

        this.registerMethod("clearMessages", "Clear messages", async () => {
            this.messages = [];
            this.emitEvent("messagesCleared", {});
            return {};
        });

        this.registerEvent("messageAdded", "Message added");
        this.registerEvent("messagesCleared", "Messages cleared");
    }

    getMessageCount(): number {
        return this.messages.length;
    }
}

// ============================================================================
// Test Setup
// ============================================================================

function createMultiDomainSetup(): {
    router: Router;
    registry: DomainRegistry;
    eventBus: EventBus;
    domains: {
        dom: TestDOMDomain;
        css: TestCSSDomain;
        network: TestNetworkDomain;
        page: TestPageDomain;
        runtime: TestRuntimeDomain;
        console: TestConsoleDomain;
    };
} {
    const eventBus = new EventBus();
    const registry = new DomainRegistry();
    const router = new Router(registry);
    const context = createMockContext({ eventBus });

    const domDomain = new TestDOMDomain(eventBus);
    const cssDomain = new TestCSSDomain(eventBus);
    const networkDomain = new TestNetworkDomain(eventBus);
    const pageDomain = new TestPageDomain(eventBus);
    const runtimeDomain = new TestRuntimeDomain(eventBus);
    const consoleDomain = new TestConsoleDomain(eventBus);

    domDomain.initialize(context);
    cssDomain.initialize(context);
    networkDomain.initialize(context);
    pageDomain.initialize(context);
    runtimeDomain.initialize(context);
    consoleDomain.initialize(context);

    registry.register(domDomain, { name: "DOM", description: "DOM", version: "1.0" });
    registry.register(cssDomain, { name: "CSS", description: "CSS", version: "1.0" });
    registry.register(networkDomain, { name: "Network", description: "Network", version: "1.0" });
    registry.register(pageDomain, { name: "Page", description: "Page", version: "1.0" });
    registry.register(runtimeDomain, { name: "Runtime", description: "Runtime", version: "1.0" });
    registry.register(consoleDomain, { name: "Console", description: "Console", version: "1.0" });

    return {
        router,
        registry,
        eventBus,
        domains: {
            dom: domDomain,
            css: cssDomain,
            network: networkDomain,
            page: pageDomain,
            runtime: runtimeDomain,
            console: consoleDomain,
        },
    };
}

// ============================================================================
// DOM + CSS Coordination Tests
// ============================================================================

Deno.test("Multi-Domain - CSS domain receives DOM updates", async () => {
    const { domains } = createMultiDomainSetup();

    await domains.dom.enable();
    await domains.css.enable();

    assertEquals(domains.css.hasDOMUpdateReceived(), false);

    domains.dom.emitDocumentUpdated();

    assertEquals(domains.css.hasDOMUpdateReceived(), true);
});

Deno.test("Multi-Domain - get node then get styles", async () => {
    const { router, domains } = createMultiDomainSetup();

    await domains.dom.enable();
    await domains.css.enable();

    // Get node info
    const nodeResponse = await router.route(createCDPRequest(1, "DOM.getNode", { nodeId: 2 }));
    assertExists((nodeResponse.result as Record<string, unknown>)?.node);

    // Get styles for the same node
    const styleResponse = await router.route(createCDPRequest(2, "CSS.getComputedStyleForNode", { nodeId: 2 }));
    const styles = (styleResponse.result as Record<string, unknown>)?.computedStyle as Array<{ name: string; value: string }>;

    assertExists(styles);
    assertEquals(styles.some((s) => s.name === "color" && s.value === "red"), true);
});

// ============================================================================
// Network + Page Coordination Tests
// ============================================================================

Deno.test("Multi-Domain - Page receives network events during navigation", async () => {
    const { domains } = createMultiDomainSetup();

    await domains.network.enable();
    await domains.page.enable();

    // Simulate network activity
    domains.network.simulateRequest("req-1", "https://example.com");
    domains.network.simulateResponse("req-1", 200);
    domains.network.simulateLoadingFinished("req-1");

    const events = domains.page.getNetworkEventsReceived();
    assertEquals(events.includes("requestWillBeSent"), true);
    assertEquals(events.includes("loadingFinished"), true);
});

Deno.test("Multi-Domain - navigation triggers frame event", async () => {
    const { router, domains, eventBus } = createMultiDomainSetup();

    await domains.page.enable();

    const frameEvents: ProtocolEvent[] = [];
    eventBus.on("Page.frameNavigated", (data) => {
        frameEvents.push({ method: "Page.frameNavigated" as ProtocolMethod, params: data as Record<string, unknown> });
    });

    await router.route(createCDPRequest(1, "Page.navigate", { url: "https://example.com" }));

    assertEquals(frameEvents.length, 1);
    assertEquals((frameEvents[0].params?.frame as Record<string, unknown>)?.url, "https://example.com");
});

// ============================================================================
// Runtime + Console Coordination Tests
// ============================================================================

Deno.test("Multi-Domain - Runtime console.log triggers Console messageAdded", async () => {
    const { router, domains } = createMultiDomainSetup();

    await domains.runtime.enable();
    await domains.console.enable();

    assertEquals(domains.console.getMessageCount(), 0);

    // Evaluate console.log
    await router.route(createCDPRequest(1, "Runtime.evaluate", { expression: "console.log('Hello')" }));

    assertEquals(domains.console.getMessageCount(), 1);
});

Deno.test("Multi-Domain - multiple console messages flow correctly", async () => {
    const { router, domains } = createMultiDomainSetup();

    await domains.runtime.enable();
    await domains.console.enable();

    // Log multiple messages
    await router.route(createCDPRequest(1, "Runtime.evaluate", { expression: "console.log('Message 1')" }));
    await router.route(createCDPRequest(2, "Runtime.evaluate", { expression: "console.log('Message 2')" }));
    await router.route(createCDPRequest(3, "Runtime.evaluate", { expression: "console.log('Message 3')" }));

    assertEquals(domains.console.getMessageCount(), 3);

    const messagesResponse = await router.route(createCDPRequest(4, "Console.getMessages", {}));
    const messages = (messagesResponse.result as Record<string, unknown>)?.messages as Array<{ text: string }>;

    assertEquals(messages.length, 3);
    assertEquals(messages[0].text, "Message 1");
    assertEquals(messages[1].text, "Message 2");
    assertEquals(messages[2].text, "Message 3");
});

// ============================================================================
// Cross-Domain EventBus Tests
// ============================================================================

Deno.test("Multi-Domain - EventBus routes events to correct subscribers", async () => {
    const { domains, eventBus } = createMultiDomainSetup();

    await domains.dom.enable();
    await domains.network.enable();

    const domEvents: string[] = [];
    const networkEvents: string[] = [];

    eventBus.on("DOM.documentUpdated", () => domEvents.push("documentUpdated"));
    eventBus.on("DOM.childNodeInserted", () => domEvents.push("childNodeInserted"));
    eventBus.on("Network.requestWillBeSent", () => networkEvents.push("requestWillBeSent"));

    domains.dom.emitDocumentUpdated();
    domains.dom.emitChildInserted(1, 4);
    domains.network.simulateRequest("req-1", "https://test.com");

    assertEquals(domEvents.length, 2);
    assertEquals(networkEvents.length, 1);
});

Deno.test("Multi-Domain - domains can communicate via EventBus", async () => {
    const { domains, eventBus } = createMultiDomainSetup();

    await domains.dom.enable();
    await domains.css.enable();

    let cssReceivedDOMEvent = false;
    eventBus.on("DOM.childNodeInserted", () => {
        cssReceivedDOMEvent = true;
    });

    domains.dom.emitChildInserted(1, 5);

    assertEquals(cssReceivedDOMEvent, true);
});

// ============================================================================
// Enable/Disable Across Domains Tests
// ============================================================================

Deno.test("Multi-Domain - enable multiple domains in sequence", async () => {
    const { router, domains } = createMultiDomainSetup();

    // Enable all domains
    await router.route(createCDPRequest(1, "DOM.enable", {}));
    await router.route(createCDPRequest(2, "CSS.enable", {}));
    await router.route(createCDPRequest(3, "Network.enable", {}));
    await router.route(createCDPRequest(4, "Page.enable", {}));
    await router.route(createCDPRequest(5, "Runtime.enable", {}));
    await router.route(createCDPRequest(6, "Console.enable", {}));

    assertEquals(domains.dom.isEnabled(), true);
    assertEquals(domains.css.isEnabled(), true);
    assertEquals(domains.network.isEnabled(), true);
    assertEquals(domains.page.isEnabled(), true);
    assertEquals(domains.runtime.isEnabled(), true);
    assertEquals(domains.console.isEnabled(), true);
});

Deno.test("Multi-Domain - disable one domain doesn't affect others", async () => {
    const { router, domains } = createMultiDomainSetup();

    await domains.dom.enable();
    await domains.css.enable();
    await domains.network.enable();

    // Disable CSS only
    await router.route(createCDPRequest(1, "CSS.disable", {}));

    assertEquals(domains.dom.isEnabled(), true);
    assertEquals(domains.css.isEnabled(), false);
    assertEquals(domains.network.isEnabled(), true);
});

Deno.test("Multi-Domain - concurrent enable requests", async () => {
    const { router, domains } = createMultiDomainSetup();

    // Enable all concurrently
    const responses = await Promise.all([
        router.route(createCDPRequest(1, "DOM.enable", {})),
        router.route(createCDPRequest(2, "CSS.enable", {})),
        router.route(createCDPRequest(3, "Network.enable", {})),
        router.route(createCDPRequest(4, "Page.enable", {})),
    ]);

    // All should succeed
    for (const response of responses) {
        assertEquals(response.error, undefined);
    }

    assertEquals(domains.dom.isEnabled(), true);
    assertEquals(domains.css.isEnabled(), true);
    assertEquals(domains.network.isEnabled(), true);
    assertEquals(domains.page.isEnabled(), true);
});

// ============================================================================
// Full Workflow Tests
// ============================================================================

Deno.test("Multi-Domain - full navigation workflow", async () => {
    const { router, domains, eventBus } = createMultiDomainSetup();

    // Enable necessary domains
    await domains.page.enable();
    await domains.network.enable();
    await domains.dom.enable();

    const allEvents: string[] = [];
    eventBus.on("Page.frameNavigated", () => allEvents.push("frameNavigated"));
    eventBus.on("Network.requestWillBeSent", () => allEvents.push("requestWillBeSent"));
    eventBus.on("Network.responseReceived", () => allEvents.push("responseReceived"));
    eventBus.on("Network.loadingFinished", () => allEvents.push("loadingFinished"));
    eventBus.on("DOM.documentUpdated", () => allEvents.push("documentUpdated"));

    // Navigate
    await router.route(createCDPRequest(1, "Page.navigate", { url: "https://example.com" }));

    // Simulate network activity
    domains.network.simulateRequest("req-1", "https://example.com");
    domains.network.simulateResponse("req-1", 200);
    domains.network.simulateLoadingFinished("req-1");

    // Simulate DOM update
    domains.dom.emitDocumentUpdated();

    // Verify events occurred
    assertEquals(allEvents.includes("frameNavigated"), true);
    assertEquals(allEvents.includes("requestWillBeSent"), true);
    assertEquals(allEvents.includes("responseReceived"), true);
    assertEquals(allEvents.includes("loadingFinished"), true);
    assertEquals(allEvents.includes("documentUpdated"), true);
});

Deno.test("Multi-Domain - full console logging workflow", async () => {
    const { router, domains, eventBus } = createMultiDomainSetup();

    await domains.runtime.enable();
    await domains.console.enable();

    const consoleEvents: ProtocolEvent[] = [];
    eventBus.on("Runtime.consoleAPICalled", (data) => {
        consoleEvents.push({ method: "Runtime.consoleAPICalled" as ProtocolMethod, params: data as Record<string, unknown> });
    });
    eventBus.on("Console.messageAdded", (data) => {
        consoleEvents.push({ method: "Console.messageAdded" as ProtocolMethod, params: data as Record<string, unknown> });
    });

    // Execute console.log via Runtime
    await router.route(createCDPRequest(1, "Runtime.evaluate", { expression: "console.log('Test message')" }));

    // Both Runtime and Console should emit events
    assertEquals(consoleEvents.some((e) => e.method === "Runtime.consoleAPICalled"), true);
    assertEquals(consoleEvents.some((e) => e.method === "Console.messageAdded"), true);

    // Verify Console domain captured the message
    const messagesResponse = await router.route(createCDPRequest(2, "Console.getMessages", {}));
    const messages = (messagesResponse.result as Record<string, unknown>)?.messages as Array<{ text: string }>;

    assertEquals(messages.length, 1);
    assertEquals(messages[0].text, "Test message");
});
