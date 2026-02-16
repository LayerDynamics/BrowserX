/**
 * Typed Domain Clients
 *
 * Provides typed method signatures for each DevTools domain.
 * These wrap the generic DevToolsClient with domain-specific methods,
 * giving callers autocomplete and compile-time safety for all 14 domains.
 *
 * Each client extends TypedDomainClient which provides enable(), disable(),
 * and a protected call() helper that prefixes the domain name.
 */

import type { DevToolsClient } from "./devtools-client.ts";
import type { ProtocolMethod } from "../protocol/types.ts";

// ---- Event handler type ----

type EventHandler = (params: Record<string, unknown>) => void;

// ---- Base class ----

/**
 * Base class for typed domain clients.
 *
 * Subclasses add domain-specific method signatures.
 */
export class TypedDomainClient {
    protected client: DevToolsClient;
    protected domainName: string;

    constructor(client: DevToolsClient, domainName: string) {
        this.client = client;
        this.domainName = domainName;
    }

    /** Enable this domain on the server */
    async enable(): Promise<Record<string, unknown>> {
        return await this.client.send(`${this.domainName}.enable` as ProtocolMethod);
    }

    /** Disable this domain on the server */
    async disable(): Promise<Record<string, unknown>> {
        return await this.client.send(`${this.domainName}.disable` as ProtocolMethod);
    }

    /** Call a method on this domain */
    protected async call(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
        return await this.client.send(`${this.domainName}.${method}` as ProtocolMethod, params);
    }

    /** Subscribe to a domain event */
    on(event: string, handler: EventHandler): void {
        this.client.on(`${this.domainName}.${event}`, handler);
    }

    /** Unsubscribe from a domain event */
    off(event: string, handler: EventHandler): void {
        this.client.off(`${this.domainName}.${event}`, handler);
    }

    /** Wait for a domain event */
    async waitForEvent(event: string, timeout?: number): Promise<Record<string, unknown>> {
        return await this.client.waitForEvent(`${this.domainName}.${event}`, timeout);
    }
}

// ============================================================================
// DOM Domain
// ============================================================================

/**
 * Typed client for the DOM domain.
 *
 * Provides DOM tree inspection and manipulation: querying nodes,
 * getting/setting attributes, removing nodes, box model access, and search.
 */
export class DOMClient extends TypedDomainClient {
    constructor(client: DevToolsClient) {
        super(client, "DOM");
    }

    /** Returns the root DOM node, optionally traversing to the given depth */
    async getDocument(params?: { depth?: number }): Promise<Record<string, unknown>> {
        return await this.call("getDocument", params);
    }

    /** Execute querySelector on a node */
    async querySelector(params: { nodeId: number; selector: string }): Promise<Record<string, unknown>> {
        return await this.call("querySelector", params);
    }

    /** Execute querySelectorAll on a node */
    async querySelectorAll(params: { nodeId: number; selector: string }): Promise<Record<string, unknown>> {
        return await this.call("querySelectorAll", params);
    }

    /** Get the outer HTML of a node */
    async getOuterHTML(params: { nodeId: number }): Promise<Record<string, unknown>> {
        return await this.call("getOuterHTML", params);
    }

    /** Set an attribute value on an element */
    async setAttributeValue(params: { nodeId: number; name: string; value: string }): Promise<Record<string, unknown>> {
        return await this.call("setAttributeValue", params);
    }

    /** Remove an attribute from an element */
    async removeAttribute(params: { nodeId: number; name: string }): Promise<Record<string, unknown>> {
        return await this.call("removeAttribute", params);
    }

    /** Remove a node from the DOM */
    async removeNode(params: { nodeId: number }): Promise<Record<string, unknown>> {
        return await this.call("removeNode", params);
    }

    /** Get the box model (content, padding, border, margin) for a node */
    async getBoxModel(params: { nodeId: number }): Promise<Record<string, unknown>> {
        return await this.call("getBoxModel", params);
    }

    /** Request child nodes for a node, optionally to a given depth */
    async requestChildNodes(params: { nodeId: number; depth?: number }): Promise<Record<string, unknown>> {
        return await this.call("requestChildNodes", params);
    }

    /** Search the DOM tree for matching text */
    async performSearch(params: { query: string }): Promise<Record<string, unknown>> {
        return await this.call("performSearch", params);
    }

    /** Get search results by range */
    async getSearchResults(params: { searchId: string; fromIndex: number; toIndex: number }): Promise<Record<string, unknown>> {
        return await this.call("getSearchResults", params);
    }
}

// ============================================================================
// Page Domain
// ============================================================================

/**
 * Typed client for the Page domain.
 *
 * Provides page navigation, lifecycle events, screenshots, and frame tree.
 */
export class PageClient extends TypedDomainClient {
    constructor(client: DevToolsClient) {
        super(client, "Page");
    }

    /** Navigate to a URL */
    async navigate(params: { url: string; referrer?: string; transitionType?: string }): Promise<Record<string, unknown>> {
        return await this.call("navigate", params);
    }

    /** Reload the current page */
    async reload(params?: { ignoreCache?: boolean; scriptToEvaluateOnLoad?: string }): Promise<Record<string, unknown>> {
        return await this.call("reload", params);
    }

    /** Navigate back in history */
    async goBack(): Promise<Record<string, unknown>> {
        return await this.call("goBack");
    }

    /** Navigate forward in history */
    async goForward(): Promise<Record<string, unknown>> {
        return await this.call("goForward");
    }

    /** Capture a screenshot of the page */
    async captureScreenshot(params?: { format?: string; quality?: number; clip?: Record<string, unknown> }): Promise<Record<string, unknown>> {
        return await this.call("captureScreenshot", params);
    }

    /** Get navigation history entries */
    async getNavigationHistory(): Promise<Record<string, unknown>> {
        return await this.call("getNavigationHistory");
    }

    /** Get the frame tree */
    async getFrameTree(): Promise<Record<string, unknown>> {
        return await this.call("getFrameTree");
    }

    /** Get the resource tree */
    async getResourceTree(): Promise<Record<string, unknown>> {
        return await this.call("getResourceTree");
    }
}

// ============================================================================
// Network Domain
// ============================================================================

/**
 * Typed client for the Network domain.
 *
 * Monitors HTTP requests and responses with timing data, manages cookies
 * and browser cache.
 */
export class NetworkClient extends TypedDomainClient {
    constructor(client: DevToolsClient) {
        super(client, "Network");
    }

    /** Get the response body for a request */
    async getResponseBody(params: { requestId: string }): Promise<Record<string, unknown>> {
        return await this.call("getResponseBody", params);
    }

    /** Get cookies for the given URLs */
    async getCookies(params?: { urls?: string[] }): Promise<Record<string, unknown>> {
        return await this.call("getCookies", params);
    }

    /** Set a cookie */
    async setCookie(params: {
        name: string;
        value: string;
        url?: string;
        domain?: string;
        path?: string;
        secure?: boolean;
        httpOnly?: boolean;
        sameSite?: string;
    }): Promise<Record<string, unknown>> {
        return await this.call("setCookie", params);
    }

    /** Clear browser cache */
    async clearBrowserCache(): Promise<Record<string, unknown>> {
        return await this.call("clearBrowserCache");
    }

    /** Clear browser cookies */
    async clearBrowserCookies(): Promise<Record<string, unknown>> {
        return await this.call("clearBrowserCookies");
    }

    /** Enable or disable cache */
    async setCacheDisabled(params: { cacheDisabled: boolean }): Promise<Record<string, unknown>> {
        return await this.call("setCacheDisabled", params);
    }

    /** Get request statistics */
    async getRequestStats(): Promise<Record<string, unknown>> {
        return await this.call("getRequestStats");
    }
}

// ============================================================================
// CSS Domain
// ============================================================================

/**
 * Typed client for the CSS domain.
 *
 * Provides stylesheet inspection, computed styles, and CSS rule matching.
 */
export class CSSClient extends TypedDomainClient {
    constructor(client: DevToolsClient) {
        super(client, "CSS");
    }

    /** Get the computed style for a node */
    async getComputedStyleForNode(params: { nodeId: number }): Promise<Record<string, unknown>> {
        return await this.call("getComputedStyleForNode", params);
    }

    /** Get matched CSS rules for a node */
    async getMatchedStylesForNode(params: { nodeId: number }): Promise<Record<string, unknown>> {
        return await this.call("getMatchedStylesForNode", params);
    }

    /** Get stylesheet text */
    async getStyleSheetText(params: { styleSheetId: string }): Promise<Record<string, unknown>> {
        return await this.call("getStyleSheetText", params);
    }

    /** Get all stylesheet headers */
    async getAllStyleSheets(): Promise<Record<string, unknown>> {
        return await this.call("getAllStyleSheets");
    }

    /** Force pseudo state on an element */
    async forcePseudoState(params: { nodeId: number; forcedPseudoClasses: string[] }): Promise<Record<string, unknown>> {
        return await this.call("forcePseudoState", params);
    }
}

// ============================================================================
// Runtime Domain
// ============================================================================

/**
 * Typed client for the Runtime domain.
 *
 * Provides JavaScript evaluation, console API interception, and object inspection.
 */
export class RuntimeClient extends TypedDomainClient {
    constructor(client: DevToolsClient) {
        super(client, "Runtime");
    }

    /** Evaluate a JavaScript expression */
    async evaluate(params: {
        expression: string;
        objectGroup?: string;
        includeCommandLineAPI?: boolean;
        silent?: boolean;
        returnByValue?: boolean;
        awaitPromise?: boolean;
    }): Promise<Record<string, unknown>> {
        return await this.call("evaluate", params);
    }

    /** Get properties of a remote object */
    async getProperties(params: {
        objectId: string;
        ownProperties?: boolean;
        accessorPropertiesOnly?: boolean;
    }): Promise<Record<string, unknown>> {
        return await this.call("getProperties", params);
    }

    /** Release a remote object reference */
    async releaseObject(params: { objectId: string }): Promise<Record<string, unknown>> {
        return await this.call("releaseObject", params);
    }

    /** Release all objects in a group */
    async releaseObjectGroup(params: { objectGroup: string }): Promise<Record<string, unknown>> {
        return await this.call("releaseObjectGroup", params);
    }

    /** Get heap usage statistics */
    async getHeapUsage(): Promise<Record<string, unknown>> {
        return await this.call("getHeapUsage");
    }

    /** Get execution contexts */
    async getExecutionContexts(): Promise<Record<string, unknown>> {
        return await this.call("getExecutionContexts");
    }
}

// ============================================================================
// Console Domain
// ============================================================================

/**
 * Typed client for the Console domain.
 *
 * Collects and dispatches console log messages.
 */
export class ConsoleClient extends TypedDomainClient {
    constructor(client: DevToolsClient) {
        super(client, "Console");
    }

    /** Clear the console message buffer */
    async clearMessages(): Promise<Record<string, unknown>> {
        return await this.call("clearMessages");
    }

    /** Get buffered console messages */
    async getMessages(): Promise<Record<string, unknown>> {
        return await this.call("getMessages");
    }
}

// ============================================================================
// Storage Domain
// ============================================================================

/**
 * Typed client for the Storage domain.
 *
 * Manages cookies, localStorage, sessionStorage, IndexedDB, and Cache API.
 */
export class StorageClient extends TypedDomainClient {
    constructor(client: DevToolsClient) {
        super(client, "Storage");
    }

    /** Get cookies matching the given URLs */
    async getCookies(params?: { urls?: string[] }): Promise<Record<string, unknown>> {
        return await this.call("getCookies", params);
    }

    /** Set a cookie */
    async setCookie(params: {
        name: string;
        value: string;
        domain?: string;
        path?: string;
        secure?: boolean;
        httpOnly?: boolean;
        sameSite?: string;
        expires?: number;
    }): Promise<Record<string, unknown>> {
        return await this.call("setCookie", params);
    }

    /** Delete a cookie by name and optional scope */
    async deleteCookie(params: { name: string; domain?: string; path?: string; url?: string }): Promise<Record<string, unknown>> {
        return await this.call("deleteCookie", params);
    }

    /** Clear all browser cookies */
    async clearCookies(): Promise<Record<string, unknown>> {
        return await this.call("clearCookies");
    }

    /** Get storage entries for an origin and type */
    async getStorageEntries(params: { origin: string; storageType: string }): Promise<Record<string, unknown>> {
        return await this.call("getStorageEntries", params);
    }

    /** Clear storage for an origin */
    async clearStorage(params: { origin: string; storageTypes?: string[] }): Promise<Record<string, unknown>> {
        return await this.call("clearStorage", params);
    }

    /** Get storage usage and quota for an origin */
    async getUsageAndQuota(params: { origin: string }): Promise<Record<string, unknown>> {
        return await this.call("getUsageAndQuota", params);
    }
}

// ============================================================================
// Security Domain
// ============================================================================

/**
 * Typed client for the Security domain.
 *
 * Monitors and reports the security state of the current page,
 * including TLS certificates and mixed content.
 */
export class SecurityClient extends TypedDomainClient {
    constructor(client: DevToolsClient) {
        super(client, "Security");
    }

    /** Get the security state of the current page */
    async getSecurityState(): Promise<Record<string, unknown>> {
        return await this.call("getSecurityState");
    }

    /** Get certificate details for an origin */
    async getCertificate(params: { origin: string }): Promise<Record<string, unknown>> {
        return await this.call("getCertificate", params);
    }

    /** Get insecure content status */
    async getInsecureContentStatus(): Promise<Record<string, unknown>> {
        return await this.call("getInsecureContentStatus");
    }
}

// ============================================================================
// Performance Domain
// ============================================================================

/**
 * Typed client for the Performance domain.
 *
 * Collects performance metrics, profiling data, navigation timing,
 * Web Vitals, rendering metrics, and composite performance scores.
 */
export class PerformanceClient extends TypedDomainClient {
    constructor(client: DevToolsClient) {
        super(client, "Performance");
    }

    /** Collect performance metrics from all subsystems */
    async getMetrics(): Promise<Record<string, unknown>> {
        return await this.call("getMetrics");
    }

    /** Start CPU profiling */
    async startProfiling(params?: { samplingInterval?: number }): Promise<Record<string, unknown>> {
        return await this.call("startProfiling", params);
    }

    /** Stop CPU profiling and return profile */
    async stopProfiling(): Promise<Record<string, unknown>> {
        return await this.call("stopProfiling");
    }

    /** Get navigation timing breakdown */
    async getNavigationTiming(): Promise<Record<string, unknown>> {
        return await this.call("getNavigationTiming");
    }

    /** Get Core Web Vitals metrics */
    async getWebVitals(): Promise<Record<string, unknown>> {
        return await this.call("getWebVitals");
    }

    /** Get rendering pipeline metrics */
    async getRenderingMetrics(): Promise<Record<string, unknown>> {
        return await this.call("getRenderingMetrics");
    }

    /** Get composite performance score */
    async getPerformanceScore(): Promise<Record<string, unknown>> {
        return await this.call("getPerformanceScore");
    }
}

// ============================================================================
// Memory Domain
// ============================================================================

/**
 * Typed client for the Memory domain.
 *
 * Provides heap inspection, memory sampling, garbage collection control,
 * and DOM counter reporting.
 */
export class MemoryClient extends TypedDomainClient {
    constructor(client: DevToolsClient) {
        super(client, "Memory");
    }

    /** Get V8 heap statistics */
    async getHeapStats(): Promise<Record<string, unknown>> {
        return await this.call("getHeapStats");
    }

    /** Take a heap snapshot and stream chunks */
    async takeHeapSnapshot(params?: { reportProgress?: boolean }): Promise<Record<string, unknown>> {
        return await this.call("takeHeapSnapshot", params);
    }

    /** Start heap allocation sampling */
    async startSampling(params?: { samplingInterval?: number }): Promise<Record<string, unknown>> {
        return await this.call("startSampling", params);
    }

    /** Stop heap allocation sampling */
    async stopSampling(): Promise<Record<string, unknown>> {
        return await this.call("stopSampling");
    }

    /** Get sampled allocation profile */
    async getAllocationProfile(): Promise<Record<string, unknown>> {
        return await this.call("getAllocationProfile");
    }

    /** Force garbage collection */
    async forceGarbageCollection(): Promise<Record<string, unknown>> {
        return await this.call("forceGarbageCollection");
    }

    /** Get DOM node and event listener counts */
    async getDOMCounters(): Promise<Record<string, unknown>> {
        return await this.call("getDOMCounters");
    }
}

// ============================================================================
// Rendering Domain
// ============================================================================

/**
 * Typed client for the Rendering domain.
 *
 * Provides render tree inspection, layout analysis, display list viewing,
 * compositor layer inspection, and rendering timing diagnostics.
 */
export class RenderingClient extends TypedDomainClient {
    constructor(client: DevToolsClient) {
        super(client, "Rendering");
    }

    /** Get the current render tree */
    async getRenderTree(): Promise<Record<string, unknown>> {
        return await this.call("getRenderTree");
    }

    /** Get the current layout tree */
    async getLayoutTree(): Promise<Record<string, unknown>> {
        return await this.call("getLayoutTree");
    }

    /** Get the current display list */
    async getDisplayList(): Promise<Record<string, unknown>> {
        return await this.call("getDisplayList");
    }

    /** Get compositor layer information */
    async getCompositorLayers(): Promise<Record<string, unknown>> {
        return await this.call("getCompositorLayers");
    }

    /** Get rendering timing breakdown */
    async getRenderingTiming(): Promise<Record<string, unknown>> {
        return await this.call("getRenderingTiming");
    }

    /** Toggle paint rectangle visualization */
    async setShowPaintRects(params: { show: boolean }): Promise<Record<string, unknown>> {
        return await this.call("setShowPaintRects", params);
    }

    /** Toggle layout border visualization */
    async setShowLayoutBorders(params: { show: boolean }): Promise<Record<string, unknown>> {
        return await this.call("setShowLayoutBorders", params);
    }

    /** Toggle FPS counter overlay */
    async setShowFPSCounter(params: { show: boolean }): Promise<Record<string, unknown>> {
        return await this.call("setShowFPSCounter", params);
    }
}

// ============================================================================
// Debugger Domain
// ============================================================================

/**
 * Typed client for the Debugger domain.
 *
 * Provides JavaScript debugging: breakpoints, stepping, call stack inspection,
 * script source retrieval, and expression evaluation on call frames.
 */
export class DebuggerClient extends TypedDomainClient {
    constructor(client: DevToolsClient) {
        super(client, "Debugger");
    }

    /** Set a breakpoint at a specific script location */
    async setBreakpoint(params: {
        location: { scriptId: string; lineNumber: number; columnNumber?: number };
        condition?: string;
    }): Promise<Record<string, unknown>> {
        return await this.call("setBreakpoint", params);
    }

    /** Set a breakpoint by URL and line number */
    async setBreakpointByUrl(params: {
        url: string;
        lineNumber: number;
        columnNumber?: number;
        condition?: string;
    }): Promise<Record<string, unknown>> {
        return await this.call("setBreakpointByUrl", params);
    }

    /** Remove a breakpoint by ID */
    async removeBreakpoint(params: { breakpointId: string }): Promise<Record<string, unknown>> {
        return await this.call("removeBreakpoint", params);
    }

    /** Get the source code of a script */
    async getScriptSource(params: { scriptId: string }): Promise<Record<string, unknown>> {
        return await this.call("getScriptSource", params);
    }

    /** Resume script execution after a pause */
    async resume(): Promise<Record<string, unknown>> {
        return await this.call("resume");
    }

    /** Step over the next statement */
    async stepOver(): Promise<Record<string, unknown>> {
        return await this.call("stepOver");
    }

    /** Step into the next function call */
    async stepInto(): Promise<Record<string, unknown>> {
        return await this.call("stepInto");
    }

    /** Step out of the current function */
    async stepOut(): Promise<Record<string, unknown>> {
        return await this.call("stepOut");
    }

    /** Pause script execution */
    async pause(): Promise<Record<string, unknown>> {
        return await this.call("pause");
    }

    /** Evaluate an expression on a specific call frame */
    async evaluateOnCallFrame(params: {
        callFrameId: string;
        expression: string;
        objectGroup?: string;
        returnByValue?: boolean;
    }): Promise<Record<string, unknown>> {
        return await this.call("evaluateOnCallFrame", params);
    }

    /** Get possible breakpoint locations in a source range */
    async getPossibleBreakpoints(params: {
        start: { scriptId: string; lineNumber: number; columnNumber?: number };
        end?: { scriptId: string; lineNumber: number; columnNumber?: number };
    }): Promise<Record<string, unknown>> {
        return await this.call("getPossibleBreakpoints", params);
    }

    /** Get the current call stack trace */
    async getStackTrace(): Promise<Record<string, unknown>> {
        return await this.call("getStackTrace");
    }
}

// ============================================================================
// Overlay Domain
// ============================================================================

/**
 * Typed client for the Overlay domain.
 *
 * Provides visual overlay functionality for element inspection and highlighting.
 */
export class OverlayClient extends TypedDomainClient {
    constructor(client: DevToolsClient) {
        super(client, "Overlay");
    }

    /** Highlight a DOM node with its box model overlay */
    async highlightNode(params: {
        nodeId: number;
        highlightConfig: Record<string, unknown>;
    }): Promise<Record<string, unknown>> {
        return await this.call("highlightNode", params);
    }

    /** Highlight an arbitrary rectangle on the page */
    async highlightRect(params: {
        x: number;
        y: number;
        width: number;
        height: number;
        color?: Record<string, unknown>;
        outlineColor?: Record<string, unknown>;
    }): Promise<Record<string, unknown>> {
        return await this.call("highlightRect", params);
    }

    /** Highlight a quadrilateral region */
    async highlightQuad(params: {
        quad: number[];
        color?: Record<string, unknown>;
        outlineColor?: Record<string, unknown>;
    }): Promise<Record<string, unknown>> {
        return await this.call("highlightQuad", params);
    }

    /** Clear all active highlights */
    async hideHighlight(): Promise<Record<string, unknown>> {
        return await this.call("hideHighlight");
    }

    /** Set the element inspect mode */
    async setInspectMode(params: {
        mode: string;
        highlightConfig?: Record<string, unknown>;
    }): Promise<Record<string, unknown>> {
        return await this.call("setInspectMode", params);
    }

    /** Get highlight data for a node (testing) */
    async getHighlightObjectForTest(params: { nodeId: number }): Promise<Record<string, unknown>> {
        return await this.call("getHighlightObjectForTest", params);
    }

    /** Highlight an entire frame */
    async highlightFrame(params: {
        frameId: string;
        contentColor?: Record<string, unknown>;
        contentOutlineColor?: Record<string, unknown>;
    }): Promise<Record<string, unknown>> {
        return await this.call("highlightFrame", params);
    }
}

// ============================================================================
// Emulation Domain
// ============================================================================

/**
 * Typed client for the Emulation domain.
 *
 * Provides device and environment emulation: viewport, user agent,
 * geolocation, timezone, locale, network conditions, CPU throttling.
 */
export class EmulationClient extends TypedDomainClient {
    constructor(client: DevToolsClient) {
        super(client, "Emulation");
    }

    /** Override device metrics (viewport, scale, mobile flag) */
    async setDeviceMetricsOverride(params: {
        width: number;
        height: number;
        deviceScaleFactor: number;
        mobile: boolean;
        screenOrientation?: Record<string, unknown>;
        screenWidth?: number;
        screenHeight?: number;
        displayFeature?: Record<string, unknown>;
    }): Promise<Record<string, unknown>> {
        return await this.call("setDeviceMetricsOverride", params);
    }

    /** Clear device metrics override */
    async clearDeviceMetricsOverride(): Promise<Record<string, unknown>> {
        return await this.call("clearDeviceMetricsOverride");
    }

    /** Override the user agent string */
    async setUserAgentOverride(params: {
        userAgent: string;
        acceptLanguage?: string;
        platform?: string;
        userAgentMetadata?: Record<string, unknown>;
    }): Promise<Record<string, unknown>> {
        return await this.call("setUserAgentOverride", params);
    }

    /** Override CSS media type and features */
    async setEmulatedMedia(params: {
        media?: string;
        features?: Array<{ name: string; value: string }>;
    }): Promise<Record<string, unknown>> {
        return await this.call("setEmulatedMedia", params);
    }

    /** Override geolocation position */
    async setGeolocationOverride(params: {
        latitude?: number;
        longitude?: number;
        accuracy?: number;
    }): Promise<Record<string, unknown>> {
        return await this.call("setGeolocationOverride", params);
    }

    /** Clear geolocation override */
    async clearGeolocationOverride(): Promise<Record<string, unknown>> {
        return await this.call("clearGeolocationOverride");
    }

    /** Override timezone */
    async setTimezoneOverride(params: { timezoneId: string }): Promise<Record<string, unknown>> {
        return await this.call("setTimezoneOverride", params);
    }

    /** Override locale */
    async setLocaleOverride(params: { locale: string }): Promise<Record<string, unknown>> {
        return await this.call("setLocaleOverride", params);
    }

    /** Enable or disable touch emulation */
    async setTouchEmulationEnabled(params: {
        enabled: boolean;
        maxTouchPoints?: number;
    }): Promise<Record<string, unknown>> {
        return await this.call("setTouchEmulationEnabled", params);
    }

    /** Set network throttling conditions */
    async setNetworkConditions(params: {
        offline: boolean;
        latency: number;
        downloadThroughput: number;
        uploadThroughput: number;
    }): Promise<Record<string, unknown>> {
        return await this.call("setNetworkConditions", params);
    }

    /** Set CPU throttling rate (1 = no throttle) */
    async setCPUThrottlingRate(params: { rate: number }): Promise<Record<string, unknown>> {
        return await this.call("setCPUThrottlingRate", params);
    }

    /** Disable or enable script execution */
    async setScriptExecutionDisabled(params: { value: boolean }): Promise<Record<string, unknown>> {
        return await this.call("setScriptExecutionDisabled", params);
    }

    /** Check if emulation is supported */
    async canEmulate(): Promise<Record<string, unknown>> {
        return await this.call("canEmulate");
    }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create all typed domain clients for a DevTools client.
 *
 * Usage:
 * ```ts
 * const client = new DevToolsClient("ws://localhost:9222/devtools/page/1");
 * await client.connect();
 *
 * const domains = createDomainClients(client);
 * await domains.dom.enable();
 * const doc = await domains.dom.getDocument({ depth: 2 });
 * await domains.network.enable();
 * const stats = await domains.network.getRequestStats();
 * ```
 *
 * @param client - A connected DevToolsClient instance
 * @returns An object containing all 14 typed domain clients
 */
export function createDomainClients(client: DevToolsClient): {
    dom: DOMClient;
    page: PageClient;
    network: NetworkClient;
    css: CSSClient;
    runtime: RuntimeClient;
    console: ConsoleClient;
    storage: StorageClient;
    security: SecurityClient;
    performance: PerformanceClient;
    memory: MemoryClient;
    rendering: RenderingClient;
    debugger: DebuggerClient;
    overlay: OverlayClient;
    emulation: EmulationClient;
} {
    return {
        dom: new DOMClient(client),
        page: new PageClient(client),
        network: new NetworkClient(client),
        css: new CSSClient(client),
        runtime: new RuntimeClient(client),
        console: new ConsoleClient(client),
        storage: new StorageClient(client),
        security: new SecurityClient(client),
        performance: new PerformanceClient(client),
        memory: new MemoryClient(client),
        rendering: new RenderingClient(client),
        debugger: new DebuggerClient(client),
        overlay: new OverlayClient(client),
        emulation: new EmulationClient(client),
    };
}
