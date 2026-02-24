/**
 * DevTools WebSocket Server
 *
 * Exposes a CDP-compatible WebSocket server on a configurable port (default 9222).
 * Provides HTTP discovery endpoints (/json, /json/version, /json/protocol) for
 * Chrome DevTools frontend discovery.
 *
 * Handles WebSocket upgrade on /devtools/page/{targetId} to establish
 * bidirectional DevTools protocol communication.
 */

import type { DomainRegistry } from "../protocol/domains.ts";
import type { Browser } from "../../browser/src/main.ts";
import type { TargetInfo } from "../protocol/session.ts";
import { Router } from "./router.ts";
import { DevToolsConnection } from "./connection.ts";
import { DevToolsSession } from "../protocol/session.ts";

/**
 * Configuration for the DevTools server
 */
export interface DevToolsServerConfig {
    /** Port to listen on (default: 9222) */
    port: number;
    /** Host to bind to (default: "127.0.0.1") */
    host: string;
}

/**
 * DevToolsServer - main CDP-compatible WebSocket server.
 *
 * Lifecycle:
 *   1. `start()` - binds the HTTP server and begins accepting connections
 *   2. Clients discover targets via GET /json
 *   3. Clients upgrade to WebSocket on /devtools/page/{targetId}
 *   4. `stop()` - closes all connections and shuts down the server
 */
export class DevToolsServer {
    private config: DevToolsServerConfig;
    private browser: Browser;
    private registry: DomainRegistry;
    private registryFactory: (() => DomainRegistry) | null;
    private connections: Map<string, DevToolsConnection> = new Map();
    private sessions: Map<string, DevToolsSession> = new Map();
    private server: Deno.HttpServer | null = null;


    constructor(
        browser: Browser,
        registry: DomainRegistry,
        config?: Partial<DevToolsServerConfig>,
        registryFactory?: () => DomainRegistry,
    ) {
        this.config = {
            port: config?.port ?? 9222,
            host: config?.host ?? "127.0.0.1",
        };
        this.browser = browser;
        this.registry = registry;
        this.registryFactory = registryFactory ?? null;
    }

    /**
     * Start the DevTools server.
     *
     * Creates a Deno HTTP server that handles:
     *   - GET /json or /json/list  -> target list discovery
     *   - GET /json/version        -> browser version info
     *   - GET /json/protocol       -> protocol schema description
     *   - WebSocket upgrade on /devtools/page/* -> DevTools connection
     */
    start(): void {
        this.server = Deno.serve(
            {
                port: this.config.port,
                hostname: this.config.host,
                onListen: ({ hostname, port }) => {
                    console.log(
                        `DevTools server listening on http://${hostname}:${port}`,
                    );
                    console.log(
                        `DevTools URL: devtools://devtools/bundled/inspector.html?ws=${hostname}:${port}/devtools/page/default`,
                    );
                },
            },
            (request: Request): Response => {
                return this.handleRequest(request);
            },
        );
    }

    /**
     * Handle an incoming HTTP request.
     *
     * Routes based on URL pathname:
     *   - /json, /json/list  -> target list
     *   - /json/version      -> version info
     *   - /json/protocol     -> protocol description
     *   - /devtools/page/*   -> WebSocket upgrade
     *   - everything else    -> 404
     */
    private handleRequest(request: Request): Response {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // WebSocket upgrade for DevTools connections
        if (pathname.startsWith("/devtools/page/")) {
            return this.handleWebSocketUpgrade(request);
        }

        // HTTP discovery endpoints
        switch (pathname) {
            case "/json":
            case "/json/list":
                return this.handleJsonList();
            case "/json/version":
                return this.handleJsonVersion();
            case "/json/protocol":
                return this.handleJsonProtocol();
            default:
                return new Response("Not Found", { status: 404 });
        }
    }

    /**
     * Handle WebSocket upgrade for a DevTools page connection.
     *
     * Extracts the target ID from the URL path, creates a new session,
     * upgrades the HTTP connection to WebSocket, and sets up the
     * DevToolsConnection to handle CDP protocol traffic.
     */
    private handleWebSocketUpgrade(request: Request): Response {
        // Validate WebSocket upgrade header
        if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
            return new Response("Upgrade Required", { status: 426, headers: { "Connection": "Upgrade", "Upgrade": "websocket" } });
        }

        // Validate Origin header to prevent cross-origin WebSocket hijacking
        const origin = request.headers.get("origin");
        if (origin !== null && origin !== "devtools://devtools" && !origin.startsWith("chrome-devtools://")) {
            // Allow null origin (direct WebSocket connections, CLI tools)
            // Allow devtools:// and chrome-devtools:// origins
            // Reject browser-initiated cross-origin requests
            return new Response("Forbidden", { status: 403 });
        }

        const url = new URL(request.url);
        const pathParts = url.pathname.split("/");
        const rawTargetId = pathParts[pathParts.length - 1] || "default";

        // Sanitize targetId to prevent log injection
        const targetId = /^[A-Za-z0-9_-]+$/.test(rawTargetId) ? rawTargetId : "default";

        // Upgrade to WebSocket
        const { socket, response } = Deno.upgradeWebSocket(request);

        // Generate unique connection and session IDs
        const connectionId = `conn-${crypto.randomUUID()}`;
        const sessionId = `session-${crypto.randomUUID()}`;

        // Create a per-session domain registry (isolates domain state between clients)
        const sessionRegistry = this.registryFactory ? this.registryFactory() : this.registry;

        // Create a new session for this connection
        const session = new DevToolsSession(
            sessionId,
            this.browser,
            sessionRegistry,
        );
        session.attach();
        this.sessions.set(sessionId, session);

        // Create a router scoped to the session's domain registry
        const router = new Router(session.domains);

        // Store the connection reference in a closure so the onclose handler
        // set by DevToolsConnection in its constructor is preserved.
        // We add a socket event listener (not onclose assignment) for server-level cleanup.
        socket.addEventListener("close", () => {
            this.connections.delete(connectionId);
            this.sessions.delete(sessionId);
            session.dispose();
            console.log(
                `DevTools connection ${connectionId} closed (target: ${targetId})`,
            );
        });

        // Create the connection handler (sets its own onclose/onmessage/onerror handlers)
        const connection = new DevToolsConnection(
            connectionId,
            socket,
            router,
            session,
        );
        this.connections.set(connectionId, connection);

        console.log(
            `DevTools connection ${connectionId} established (target: ${targetId})`,
        );

        return response;
    }

    /**
     * GET /json or /json/list - return discoverable targets.
     *
     * Returns an array of TargetInfo-compatible objects that Chrome DevTools
     * uses to discover available debugging targets.
     */
    private handleJsonList(): Response {
        const host = `${this.config.host}:${this.config.port}`;
        const currentUrl = this.browser.getCurrentURL() || "about:blank";
        const title = currentUrl === "about:blank" ? "BrowserX" : currentUrl;

        // Build target list from active sessions, plus a default target
        const targets: Array<
            TargetInfo & {
                description: string;
                webSocketDebuggerUrl: string;
                devtoolsFrontendUrl: string;
                faviconUrl: string;
            }
        > = [];

        // Add active session targets
        for (const [_sessionId, session] of this.sessions) {
            const info = session.getTargetInfo();
            targets.push({
                ...info,
                description: "BrowserX page target",
                webSocketDebuggerUrl: `ws://${host}/devtools/page/${info.targetId}`,
                devtoolsFrontendUrl: `devtools://devtools/bundled/inspector.html?ws=${host}/devtools/page/${info.targetId}`,
                faviconUrl: "",
            });
        }

        // Always include a default target if none exist
        if (targets.length === 0) {
            targets.push({
                targetId: "default",
                type: "page",
                title,
                url: currentUrl,
                attached: false,
                description: "BrowserX page target",
                webSocketDebuggerUrl: `ws://${host}/devtools/page/default`,
                devtoolsFrontendUrl: `devtools://devtools/bundled/inspector.html?ws=${host}/devtools/page/default`,
                faviconUrl: "",
            });
        }

        return new Response(JSON.stringify(targets, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    /**
     * GET /json/version - return browser version information.
     *
     * Provides version metadata compatible with the Chrome DevTools protocol
     * version endpoint.
     */
    private handleJsonVersion(): Response {
        const host = `${this.config.host}:${this.config.port}`;
        const versionInfo = {
            "Browser": "BrowserX/1.0.0",
            "Protocol-Version": "1.3",
            "User-Agent": "BrowserX/1.0.0",
            "V8-Version": "12.9.202.13",
            "WebKit-Version": "537.36",
            "webSocketDebuggerUrl": `ws://${host}/devtools/browser`,
        };

        return new Response(JSON.stringify(versionInfo, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    /**
     * GET /json/protocol - return protocol schema.
     *
     * Returns a description of the supported domains and their methods,
     * built from the DomainRegistry.
     */
    private handleJsonProtocol(): Response {
        const domainMetadata = this.registry.listDomains();

        const protocol = {
            version: { major: "1", minor: "3" },
            domains: domainMetadata.map((meta) => {
                const domain = this.registry.getDomain(meta.name);
                return {
                    domain: meta.name,
                    description: meta.description,
                    version: meta.version,
                    experimental: meta.experimental ?? false,
                    dependencies: meta.dependencies ?? [],
                    commands: domain
                        ? domain.getMethodNames().map((method) => ({
                            name: method,
                            description: `${meta.name}.${method}`,
                        }))
                        : [],
                    events: domain
                        ? domain.getEventNames().map((event) => ({
                            name: event,
                            description: `${meta.name}.${event}`,
                        }))
                        : [],
                };
            }),
        };

        return new Response(JSON.stringify(protocol, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    /**
     * Get the base WebSocket URL for this server.
     */
    getUrl(): string {
        return `ws://${this.config.host}:${this.config.port}`;
    }

    /**
     * Get all active DevTools connections.
     */
    getConnections(): DevToolsConnection[] {
        return Array.from(this.connections.values());
    }

    /**
     * Get all active sessions.
     */
    getSessions(): DevToolsSession[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Stop the server and close all active connections.
     */
    async stop(): Promise<void> {
        console.log("Stopping DevTools server...");

        // Close all active connections
        for (const [id, connection] of Array.from(this.connections)) {
            connection.close();
            this.connections.delete(id);
        }

        // Dispose all sessions
        for (const [id, session] of Array.from(this.sessions)) {
            session.dispose();
            this.sessions.delete(id);
        }

        // Shutdown the HTTP server
        if (this.server) {
            await this.server.shutdown();
            this.server = null;
        }

        console.log("DevTools server stopped");
    }
}
