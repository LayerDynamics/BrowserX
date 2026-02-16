/**
 * Tests for Typed Domain Clients
 *
 * Validates the factory function createDomainClients() returns all 14 typed
 * domain clients, and verifies that each client exposes the expected
 * domain-specific methods.
 */

import { assertEquals, assertExists } from "@std/assert";
import {
    createDomainClients,
    TypedDomainClient,
    DOMClient,
    PageClient,
    NetworkClient,
    CSSClient,
    RuntimeClient,
    ConsoleClient,
    StorageClient,
    SecurityClient,
    PerformanceClient,
    MemoryClient,
    RenderingClient,
    DebuggerClient,
    OverlayClient,
    EmulationClient,
} from "../../../client/domain-clients.ts";
import { DevToolsClient } from "../../../client/devtools-client.ts";

// ---------------------------------------------------------------------------
// Helper: create a DevToolsClient (not connected; used for structure tests)
// ---------------------------------------------------------------------------

function createClient(): DevToolsClient {
    return new DevToolsClient("ws://localhost:9222/devtools/page/1");
}

// ---------------------------------------------------------------------------
// createDomainClients() factory tests
// ---------------------------------------------------------------------------

Deno.test("createDomainClients() returns all 14 domain clients", () => {
    const client = createClient();
    const domains = createDomainClients(client);

    assertExists(domains.dom);
    assertExists(domains.page);
    assertExists(domains.network);
    assertExists(domains.css);
    assertExists(domains.runtime);
    assertExists(domains.console);
    assertExists(domains.storage);
    assertExists(domains.security);
    assertExists(domains.performance);
    assertExists(domains.memory);
    assertExists(domains.rendering);
    assertExists(domains.debugger);
    assertExists(domains.overlay);
    assertExists(domains.emulation);

    // Verify exactly 14 keys
    assertEquals(Object.keys(domains).length, 14);
});

Deno.test("createDomainClients() returns correctly typed instances", () => {
    const client = createClient();
    const domains = createDomainClients(client);

    assertEquals(domains.dom instanceof DOMClient, true);
    assertEquals(domains.page instanceof PageClient, true);
    assertEquals(domains.network instanceof NetworkClient, true);
    assertEquals(domains.css instanceof CSSClient, true);
    assertEquals(domains.runtime instanceof RuntimeClient, true);
    assertEquals(domains.console instanceof ConsoleClient, true);
    assertEquals(domains.storage instanceof StorageClient, true);
    assertEquals(domains.security instanceof SecurityClient, true);
    assertEquals(domains.performance instanceof PerformanceClient, true);
    assertEquals(domains.memory instanceof MemoryClient, true);
    assertEquals(domains.rendering instanceof RenderingClient, true);
    assertEquals(domains.debugger instanceof DebuggerClient, true);
    assertEquals(domains.overlay instanceof OverlayClient, true);
    assertEquals(domains.emulation instanceof EmulationClient, true);
});

Deno.test("All domain clients extend TypedDomainClient", () => {
    const client = createClient();
    const domains = createDomainClients(client);

    for (const domainClient of Object.values(domains)) {
        assertEquals(domainClient instanceof TypedDomainClient, true);
    }
});

// ---------------------------------------------------------------------------
// TypedDomainClient base methods
// ---------------------------------------------------------------------------

Deno.test("TypedDomainClient has enable method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.enable, "function");
});

Deno.test("TypedDomainClient has disable method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.disable, "function");
});

Deno.test("TypedDomainClient has on method for event subscription", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.on, "function");
});

Deno.test("TypedDomainClient has off method for event unsubscription", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.off, "function");
});

Deno.test("TypedDomainClient has waitForEvent method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.waitForEvent, "function");
});

// ---------------------------------------------------------------------------
// DOMClient methods
// ---------------------------------------------------------------------------

Deno.test("DOMClient has getDocument method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.getDocument, "function");
});

Deno.test("DOMClient has querySelector method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.querySelector, "function");
});

Deno.test("DOMClient has querySelectorAll method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.querySelectorAll, "function");
});

Deno.test("DOMClient has getOuterHTML method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.getOuterHTML, "function");
});

Deno.test("DOMClient has setAttributeValue method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.setAttributeValue, "function");
});

Deno.test("DOMClient has removeAttribute method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.removeAttribute, "function");
});

Deno.test("DOMClient has removeNode method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.removeNode, "function");
});

Deno.test("DOMClient has getBoxModel method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.getBoxModel, "function");
});

Deno.test("DOMClient has requestChildNodes method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.requestChildNodes, "function");
});

Deno.test("DOMClient has performSearch method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.performSearch, "function");
});

Deno.test("DOMClient has getSearchResults method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.dom.getSearchResults, "function");
});

// ---------------------------------------------------------------------------
// PageClient methods
// ---------------------------------------------------------------------------

Deno.test("PageClient has navigate method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.page.navigate, "function");
});

Deno.test("PageClient has reload method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.page.reload, "function");
});

Deno.test("PageClient has goBack method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.page.goBack, "function");
});

Deno.test("PageClient has goForward method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.page.goForward, "function");
});

Deno.test("PageClient has captureScreenshot method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.page.captureScreenshot, "function");
});

Deno.test("PageClient has getNavigationHistory method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.page.getNavigationHistory, "function");
});

Deno.test("PageClient has getFrameTree method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.page.getFrameTree, "function");
});

Deno.test("PageClient has getResourceTree method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.page.getResourceTree, "function");
});

// ---------------------------------------------------------------------------
// NetworkClient methods
// ---------------------------------------------------------------------------

Deno.test("NetworkClient has getResponseBody method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.network.getResponseBody, "function");
});

Deno.test("NetworkClient has getCookies method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.network.getCookies, "function");
});

Deno.test("NetworkClient has setCookie method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.network.setCookie, "function");
});

Deno.test("NetworkClient has clearBrowserCache method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.network.clearBrowserCache, "function");
});

Deno.test("NetworkClient has clearBrowserCookies method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.network.clearBrowserCookies, "function");
});

Deno.test("NetworkClient has setCacheDisabled method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.network.setCacheDisabled, "function");
});

Deno.test("NetworkClient has getRequestStats method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.network.getRequestStats, "function");
});

// ---------------------------------------------------------------------------
// CSSClient methods
// ---------------------------------------------------------------------------

Deno.test("CSSClient has getComputedStyleForNode method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.css.getComputedStyleForNode, "function");
});

Deno.test("CSSClient has getMatchedStylesForNode method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.css.getMatchedStylesForNode, "function");
});

Deno.test("CSSClient has getStyleSheetText method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.css.getStyleSheetText, "function");
});

Deno.test("CSSClient has getAllStyleSheets method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.css.getAllStyleSheets, "function");
});

Deno.test("CSSClient has forcePseudoState method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.css.forcePseudoState, "function");
});

// ---------------------------------------------------------------------------
// RuntimeClient methods
// ---------------------------------------------------------------------------

Deno.test("RuntimeClient has evaluate method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.runtime.evaluate, "function");
});

Deno.test("RuntimeClient has getProperties method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.runtime.getProperties, "function");
});

Deno.test("RuntimeClient has releaseObject method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.runtime.releaseObject, "function");
});

Deno.test("RuntimeClient has getHeapUsage method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.runtime.getHeapUsage, "function");
});

Deno.test("RuntimeClient has getExecutionContexts method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.runtime.getExecutionContexts, "function");
});

// ---------------------------------------------------------------------------
// ConsoleClient methods
// ---------------------------------------------------------------------------

Deno.test("ConsoleClient has clearMessages method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.console.clearMessages, "function");
});

Deno.test("ConsoleClient has getMessages method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.console.getMessages, "function");
});

// ---------------------------------------------------------------------------
// StorageClient methods
// ---------------------------------------------------------------------------

Deno.test("StorageClient has getCookies method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.storage.getCookies, "function");
});

Deno.test("StorageClient has setCookie method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.storage.setCookie, "function");
});

Deno.test("StorageClient has deleteCookie method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.storage.deleteCookie, "function");
});

Deno.test("StorageClient has clearCookies method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.storage.clearCookies, "function");
});

Deno.test("StorageClient has getStorageEntries method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.storage.getStorageEntries, "function");
});

Deno.test("StorageClient has clearStorage method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.storage.clearStorage, "function");
});

Deno.test("StorageClient has getUsageAndQuota method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.storage.getUsageAndQuota, "function");
});

// ---------------------------------------------------------------------------
// SecurityClient methods
// ---------------------------------------------------------------------------

Deno.test("SecurityClient has getSecurityState method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.security.getSecurityState, "function");
});

Deno.test("SecurityClient has getCertificate method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.security.getCertificate, "function");
});

Deno.test("SecurityClient has getInsecureContentStatus method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.security.getInsecureContentStatus, "function");
});

// ---------------------------------------------------------------------------
// PerformanceClient methods
// ---------------------------------------------------------------------------

Deno.test("PerformanceClient has getMetrics method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.performance.getMetrics, "function");
});

Deno.test("PerformanceClient has startProfiling method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.performance.startProfiling, "function");
});

Deno.test("PerformanceClient has stopProfiling method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.performance.stopProfiling, "function");
});

Deno.test("PerformanceClient has getNavigationTiming method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.performance.getNavigationTiming, "function");
});

Deno.test("PerformanceClient has getWebVitals method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.performance.getWebVitals, "function");
});

Deno.test("PerformanceClient has getRenderingMetrics method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.performance.getRenderingMetrics, "function");
});

Deno.test("PerformanceClient has getPerformanceScore method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.performance.getPerformanceScore, "function");
});

// ---------------------------------------------------------------------------
// MemoryClient methods
// ---------------------------------------------------------------------------

Deno.test("MemoryClient has getHeapStats method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.memory.getHeapStats, "function");
});

Deno.test("MemoryClient has takeHeapSnapshot method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.memory.takeHeapSnapshot, "function");
});

Deno.test("MemoryClient has startSampling method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.memory.startSampling, "function");
});

Deno.test("MemoryClient has stopSampling method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.memory.stopSampling, "function");
});

Deno.test("MemoryClient has getAllocationProfile method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.memory.getAllocationProfile, "function");
});

Deno.test("MemoryClient has forceGarbageCollection method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.memory.forceGarbageCollection, "function");
});

Deno.test("MemoryClient has getDOMCounters method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.memory.getDOMCounters, "function");
});

// ---------------------------------------------------------------------------
// RenderingClient methods
// ---------------------------------------------------------------------------

Deno.test("RenderingClient has getRenderTree method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.rendering.getRenderTree, "function");
});

Deno.test("RenderingClient has getLayoutTree method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.rendering.getLayoutTree, "function");
});

Deno.test("RenderingClient has getDisplayList method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.rendering.getDisplayList, "function");
});

Deno.test("RenderingClient has getCompositorLayers method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.rendering.getCompositorLayers, "function");
});

Deno.test("RenderingClient has getRenderingTiming method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.rendering.getRenderingTiming, "function");
});

Deno.test("RenderingClient has setShowPaintRects method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.rendering.setShowPaintRects, "function");
});

Deno.test("RenderingClient has setShowLayoutBorders method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.rendering.setShowLayoutBorders, "function");
});

Deno.test("RenderingClient has setShowFPSCounter method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.rendering.setShowFPSCounter, "function");
});

// ---------------------------------------------------------------------------
// DebuggerClient methods
// ---------------------------------------------------------------------------

Deno.test("DebuggerClient has setBreakpoint method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.debugger.setBreakpoint, "function");
});

Deno.test("DebuggerClient has setBreakpointByUrl method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.debugger.setBreakpointByUrl, "function");
});

Deno.test("DebuggerClient has removeBreakpoint method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.debugger.removeBreakpoint, "function");
});

Deno.test("DebuggerClient has getScriptSource method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.debugger.getScriptSource, "function");
});

Deno.test("DebuggerClient has resume method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.debugger.resume, "function");
});

Deno.test("DebuggerClient has stepOver method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.debugger.stepOver, "function");
});

Deno.test("DebuggerClient has stepInto method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.debugger.stepInto, "function");
});

Deno.test("DebuggerClient has stepOut method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.debugger.stepOut, "function");
});

Deno.test("DebuggerClient has pause method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.debugger.pause, "function");
});

Deno.test("DebuggerClient has evaluateOnCallFrame method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.debugger.evaluateOnCallFrame, "function");
});

Deno.test("DebuggerClient has getPossibleBreakpoints method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.debugger.getPossibleBreakpoints, "function");
});

Deno.test("DebuggerClient has getStackTrace method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.debugger.getStackTrace, "function");
});

// ---------------------------------------------------------------------------
// OverlayClient methods
// ---------------------------------------------------------------------------

Deno.test("OverlayClient has highlightNode method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.overlay.highlightNode, "function");
});

Deno.test("OverlayClient has highlightRect method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.overlay.highlightRect, "function");
});

Deno.test("OverlayClient has highlightQuad method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.overlay.highlightQuad, "function");
});

Deno.test("OverlayClient has hideHighlight method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.overlay.hideHighlight, "function");
});

Deno.test("OverlayClient has setInspectMode method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.overlay.setInspectMode, "function");
});

Deno.test("OverlayClient has getHighlightObjectForTest method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.overlay.getHighlightObjectForTest, "function");
});

Deno.test("OverlayClient has highlightFrame method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.overlay.highlightFrame, "function");
});

// ---------------------------------------------------------------------------
// EmulationClient methods
// ---------------------------------------------------------------------------

Deno.test("EmulationClient has setDeviceMetricsOverride method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.emulation.setDeviceMetricsOverride, "function");
});

Deno.test("EmulationClient has clearDeviceMetricsOverride method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.emulation.clearDeviceMetricsOverride, "function");
});

Deno.test("EmulationClient has setUserAgentOverride method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.emulation.setUserAgentOverride, "function");
});

Deno.test("EmulationClient has setEmulatedMedia method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.emulation.setEmulatedMedia, "function");
});

Deno.test("EmulationClient has setGeolocationOverride method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.emulation.setGeolocationOverride, "function");
});

Deno.test("EmulationClient has clearGeolocationOverride method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.emulation.clearGeolocationOverride, "function");
});

Deno.test("EmulationClient has setTimezoneOverride method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.emulation.setTimezoneOverride, "function");
});

Deno.test("EmulationClient has setLocaleOverride method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.emulation.setLocaleOverride, "function");
});

Deno.test("EmulationClient has setTouchEmulationEnabled method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.emulation.setTouchEmulationEnabled, "function");
});

Deno.test("EmulationClient has setNetworkConditions method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.emulation.setNetworkConditions, "function");
});

Deno.test("EmulationClient has setCPUThrottlingRate method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.emulation.setCPUThrottlingRate, "function");
});

Deno.test("EmulationClient has setScriptExecutionDisabled method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.emulation.setScriptExecutionDisabled, "function");
});

Deno.test("EmulationClient has canEmulate method", () => {
    const client = createClient();
    const domains = createDomainClients(client);
    assertEquals(typeof domains.emulation.canEmulate, "function");
});
