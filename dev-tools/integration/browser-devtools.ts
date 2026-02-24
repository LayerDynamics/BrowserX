/**
 * Browser DevTools Integration
 *
 * Main entry point for attaching DevTools to a BrowserX Browser instance.
 * Creates the EventBus, DomainRegistry, instantiates all 14 domain agents,
 * and starts the WebSocket server for CDP-compatible communication.
 *
 * Usage:
 * ```ts
 * import { Browser } from "../browser/src/main.ts";
 * import { attachDevTools } from "./dev-tools/integration/browser-devtools.ts";
 *
 * const browser = new Browser({ width: 1280, height: 720 });
 * const devtools = attachDevTools(browser, { port: 9222 });
 *
 * // DevTools now listening on ws://127.0.0.1:9222
 * // Connect Chrome DevTools or use the programmatic client
 *
 * // Cleanup
 * await devtools.dispose();
 * ```
 */

import type { Browser } from "../../browser/src/main.ts";
import type { DomainName } from "../protocol/types.ts";
import { EventBus } from "./event-bus.ts";
import { DomainRegistry, type DomainMetadata } from "../protocol/domains.ts";
import type { DomainInitContext } from "../domains/base-domain.ts";
import type { BaseDomain } from "../domains/base-domain.ts";
import { DevToolsServer, type DevToolsServerConfig } from "../server/devtools-server.ts";

// Import all 14 domain agents
import { DOMDomain } from "../domains/dom/dom-domain.ts";
import { PageDomain } from "../domains/page/page-domain.ts";
import { NetworkDomain } from "../domains/network/network-domain.ts";
import { CSSDomain } from "../domains/css/css-domain.ts";
import { RuntimeDomain } from "../domains/runtime/runtime-domain.ts";
import { ConsoleDomain } from "../domains/console/console-domain.ts";
import { StorageDomain } from "../domains/storage/storage-domain.ts";
import { SecurityDomain } from "../domains/security/security-domain.ts";
import { PerformanceDomain } from "../domains/performance/performance-domain.ts";
import { MemoryDomain } from "../domains/memory/memory-domain.ts";
import { RenderingDomain } from "../domains/rendering/rendering-domain.ts";
import { DebuggerDomain } from "../domains/debugger/debugger-domain.ts";
import { OverlayDomain } from "../domains/overlay/overlay-domain.ts";
import { EmulationDomain } from "../domains/emulation/emulation-domain.ts";

/**
 * Configuration for BrowserDevTools
 */
export interface BrowserDevToolsConfig {
    /** Port for the WebSocket server (default: 9222) */
    port?: number;
    /** Host to bind to (default: "127.0.0.1") */
    host?: string;
    /** Whether to auto-start the server (default: true) */
    autoStart?: boolean;
}

/**
 * Domain metadata definitions for all 14 domains
 */
const DOMAIN_METADATA: Map<DomainName, DomainMetadata> = new Map<DomainName, DomainMetadata>([
    ["DOM", {
        name: "DOM",
        description: "DOM tree inspection and manipulation",
        version: "1.0",
        dependencies: [],
    }],
    ["Page", {
        name: "Page",
        description: "Page navigation, lifecycle, and screenshots",
        version: "1.0",
        dependencies: [],
    }],
    ["Network", {
        name: "Network",
        description: "HTTP request/response monitoring and interception",
        version: "1.0",
        dependencies: [],
    }],
    ["CSS", {
        name: "CSS",
        description: "Stylesheet inspection, computed styles, and rule matching",
        version: "1.0",
        dependencies: ["DOM"],
    }],
    ["Runtime", {
        name: "Runtime",
        description: "JavaScript evaluation, console API, and object inspection",
        version: "1.0",
        dependencies: [],
    }],
    ["Console", {
        name: "Console",
        description: "Console log messages, errors, and warnings",
        version: "1.0",
        dependencies: ["Runtime"],
    }],
    ["Storage", {
        name: "Storage",
        description: "Cookies, localStorage, and storage quota management",
        version: "1.0",
        dependencies: [],
    }],
    ["Security", {
        name: "Security",
        description: "TLS certificates, mixed content, and security state",
        version: "1.0",
        dependencies: ["Network"],
    }],
    ["Performance", {
        name: "Performance",
        description: "Performance profiling, metrics, and web vitals",
        version: "1.0",
        dependencies: ["Network", "Rendering"],
    }],
    ["Memory", {
        name: "Memory",
        description: "Heap snapshots, allocation sampling, and GC control",
        version: "1.0",
        dependencies: ["Runtime"],
    }],
    ["Rendering", {
        name: "Rendering",
        description: "Render tree, layout, paint, and compositor inspection",
        version: "1.0",
        dependencies: ["DOM"],
        experimental: true,
    }],
    ["Debugger", {
        name: "Debugger",
        description: "Breakpoints, stepping, call stacks, and script inspection",
        version: "1.0",
        dependencies: ["Runtime"],
    }],
    ["Overlay", {
        name: "Overlay",
        description: "Element highlighting, layout overlays, and inspect mode",
        version: "1.0",
        dependencies: ["DOM", "Rendering"],
    }],
    ["Emulation", {
        name: "Emulation",
        description: "Device emulation, viewport override, and network throttling",
        version: "1.0",
        dependencies: [],
    }],
]);

/**
 * BrowserDevTools - manages the full DevTools lifecycle
 *
 * Holds references to the EventBus, DomainRegistry, all domain agents,
 * and the WebSocket server. Provides access to individual domains and
 * handles cleanup on dispose.
 */
export class BrowserDevTools {
    /** Internal event bus for cross-domain communication */
    readonly eventBus: EventBus;

    /** Domain registry for method routing */
    readonly registry: DomainRegistry;

    /** WebSocket server for CDP communication */
    readonly server: DevToolsServer;

    /** All instantiated domain agents */
    private domainInstances: Map<DomainName, BaseDomain> = new Map();

    /** Browser instance */
    private browser: Browser;

    constructor(
        browser: Browser,
        eventBus: EventBus,
        registry: DomainRegistry,
        server: DevToolsServer,
        domainInstances: Map<DomainName, BaseDomain>,
    ) {
        this.browser = browser;
        this.eventBus = eventBus;
        this.registry = registry;
        this.server = server;
        this.domainInstances = domainInstances;
    }

    /**
     * Get the WebSocket URL for connecting to the DevTools server
     */
    getUrl(): string {
        return this.server.getUrl();
    }

    /**
     * Get a specific domain agent by name
     */
    getDomain<T extends BaseDomain>(name: DomainName): T | undefined {
        return this.domainInstances.get(name) as T | undefined;
    }

    /**
     * Get all registered domain names
     */
    getDomainNames(): DomainName[] {
        return Array.from(this.domainInstances.keys());
    }

    /**
     * Get the browser instance
     */
    getBrowser(): Browser {
        return this.browser;
    }

    /**
     * Start the DevTools server (if not auto-started)
     */
    start(): void {
        this.server.start();
    }

    /**
     * Stop the server and dispose all resources
     */
    async dispose(): Promise<void> {
        // Stop the server first (closes all connections)
        await this.server.stop();

        // Dispose the domain registry (disposes all domains)
        this.registry.dispose();

        // Clear the event bus
        this.eventBus.removeAllListeners();

        // Clear local domain references
        this.domainInstances.clear();

        console.log("BrowserDevTools disposed");
    }
}

/**
 * All 14 domain constructors in registration order.
 */
const domainConstructors: Array<new (eventBus: EventBus) => BaseDomain> = [
    DOMDomain,
    PageDomain,
    NetworkDomain,
    CSSDomain,
    RuntimeDomain,
    ConsoleDomain,
    StorageDomain,
    SecurityDomain,
    PerformanceDomain,
    MemoryDomain,
    RenderingDomain,
    DebuggerDomain,
    OverlayDomain,
    EmulationDomain,
];

/**
 * Create a DomainRegistry with all 14 domains initialized against the given browser.
 *
 * Used both for the primary (schema-introspection) registry and for per-session
 * registries created by the registryFactory.
 */
function createDomainRegistry(
    browser: Browser,
    eventBus: EventBus,
): { registry: DomainRegistry; domainInstances: Map<DomainName, BaseDomain> } {
    const registry = new DomainRegistry();
    const context: DomainInitContext = {
        browser,
        requestPipeline: browser.getRequestPipeline(),
        renderingPipeline: browser.getRenderingPipeline(),
        storageManager: browser.getStorageManager(),
        cookieManager: browser.getCookieManager(),
        quotaManager: browser.getQuotaManager(),
        eventBus,
    };
    const domainInstances = new Map<DomainName, BaseDomain>();
    for (const DomainClass of domainConstructors) {
        const domain = new DomainClass(eventBus);
        domain.initialize(context);
        const meta = DOMAIN_METADATA.get(domain.name);
        if (!meta) {
            throw new Error(`No metadata defined for domain "${domain.name}"`);
        }
        registry.register(domain, meta);
        domainInstances.set(domain.name, domain);
    }

    // Wire registry into each domain for explicit cross-domain resolution
    for (const domain of domainInstances.values()) {
        domain.setRegistry(registry);
    }

    // Validate that all declared dependencies are satisfied
    const depErrors = registry.validateDependencies();
    if (depErrors.length > 0) {
        for (const err of depErrors) {
            console.error(`DevTools dependency error: ${err}`);
        }
    }

    return { registry, domainInstances };
}

/**
 * Attach DevTools to a Browser instance.
 *
 * This is the main entry point for enabling DevTools on a BrowserX browser.
 * It:
 *   1. Creates an EventBus for cross-domain communication
 *   2. Creates a DomainRegistry and registers all 14 domain agents
 *   3. Initializes each domain with the browser's subsystem context
 *   4. Creates and starts a WebSocket server on the specified port
 *   5. Returns a BrowserDevTools instance for management
 *
 * @param browser - The Browser instance to attach DevTools to
 * @param config - Optional configuration (port, host, autoStart)
 * @returns BrowserDevTools instance
 */
export function attachDevTools(
    browser: Browser,
    config?: BrowserDevToolsConfig,
): BrowserDevTools {
    const port = config?.port ?? 9222;
    const host = config?.host ?? "127.0.0.1";
    const autoStart = config?.autoStart ?? true;

    // 1. Create event bus
    const eventBus = new EventBus();

    // 2. Create primary registry — only used for /json/protocol schema introspection
    const { registry, domainInstances } = createDomainRegistry(browser, eventBus);

    console.log(
        `DevTools: Registered ${domainInstances.size} domains: ${
            Array.from(domainInstances.keys()).join(", ")
        }`,
    );

    // 3. Create WebSocket server
    const serverConfig: Partial<DevToolsServerConfig> = { port, host };
    // Factory creates a fresh DomainRegistry per session to isolate domain state
    const registryFactory = (): DomainRegistry => {
        const sessionEventBus = new EventBus();
        const { registry: sessionRegistry } = createDomainRegistry(browser, sessionEventBus);
        return sessionRegistry;
    };

    const server = new DevToolsServer(browser, registry, serverConfig, registryFactory);

    // 4. Auto-start if configured
    if (autoStart) {
        server.start();
    }

    // 5. Return BrowserDevTools instance
    return new BrowserDevTools(
        browser,
        eventBus,
        registry,
        server,
        domainInstances,
    );
}
