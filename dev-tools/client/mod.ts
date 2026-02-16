/**
 * DevTools Client Layer
 *
 * Programmatic client for connecting to a BrowserX DevTools server.
 * Provides both a generic client with domain accessors and typed
 * domain clients with full method signatures for all 14 domains.
 *
 * Usage:
 * ```ts
 * import { DevToolsClient, createDomainClients } from "./mod.ts";
 *
 * // Generic client with domain accessors
 * const client = new DevToolsClient("ws://localhost:9222/devtools/page/1");
 * await client.connect();
 * await client.dom.call("getDocument", { depth: 2 });
 *
 * // Typed domain clients
 * const domains = createDomainClients(client);
 * await domains.dom.getDocument({ depth: 2 });
 * await domains.network.enable();
 * ```
 */

export { DevToolsClient, DomainAccessor, type DevToolsClientConfig } from "./devtools-client.ts";

export {
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
} from "./domain-clients.ts";
