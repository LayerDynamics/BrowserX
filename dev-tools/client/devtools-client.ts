/**
 * DevTools Client
 *
 * High-level programmatic client for connecting to a BrowserX DevTools server.
 * Supports promise-based request/response, event subscription, and typed domain accessors.
 *
 * The server communicates via WebSocket with CDP-style JSON-RPC messages.
 * Each request carries a unique numeric `id`; the server replies with a
 * response containing the same `id`. Events are server-pushed messages
 * that carry a `method` but no `id`.
 */

import type {
    ProtocolMethod,
    ProtocolRequest,
    ProtocolResponse,
    ProtocolEvent,
    ProtocolError,
    MessageID,
} from "../protocol/types.ts";
import { ProtocolErrorCode } from "../protocol/types.ts";

/**
 * Configuration for creating a DevToolsClient.
 */
export interface DevToolsClientConfig {
    /** WebSocket URL to connect to (e.g. "ws://localhost:9222/devtools/page/1") */
    url: string;
    /** Default request timeout in milliseconds (default 30000) */
    timeout?: number;
}

/**
 * Handler function for protocol events.
 */
type EventHandler = (params: Record<string, unknown>) => void;

/**
 * Internal representation of an in-flight request awaiting a response.
 */
interface PendingRequest {
    resolve: (result: Record<string, unknown>) => void;
    reject: (error: ProtocolError) => void;
    timer: ReturnType<typeof setTimeout>;
}

/**
 * High-level DevTools client.
 *
 * Usage:
 * ```ts
 * const client = new DevToolsClient("ws://localhost:9222/devtools/page/1");
 * await client.connect();
 *
 * // Send a command
 * const doc = await client.send("DOM.getDocument", { depth: 2 });
 *
 * // Subscribe to events
 * client.on("Network.requestWillBeSent", (params) => { ... });
 *
 * // Use typed domain accessors
 * await client.dom.call("getDocument", { depth: 2 });
 * await client.network.enable();
 *
 * await client.disconnect();
 * ```
 */
export class DevToolsClient {
    private config: DevToolsClientConfig;
    private socket: WebSocket | null = null;
    private messageId: number = 0;
    private pendingRequests: Map<MessageID, PendingRequest> = new Map();
    private eventHandlers: Map<string, Set<EventHandler>> = new Map();
    private connected: boolean = false;
    private connectionPromise: Promise<void> | null = null;

    constructor(config: DevToolsClientConfig | string) {
        if (typeof config === "string") {
            this.config = { url: config, timeout: 30000 };
        } else {
            this.config = {
                url: config.url,
                timeout: config.timeout ?? 30000,
            };
        }
    }

    /**
     * Connect to the DevTools server.
     *
     * Opens a WebSocket connection and sets up message routing.
     * Resolves once the connection is open, rejects on failure.
     */
    async connect(): Promise<void> {
        if (this.connected) {
            return;
        }

        // If a connection attempt is already in progress, return that promise
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise<void>((resolve, reject) => {
            try {
                this.socket = new WebSocket(this.config.url);
            } catch (err) {
                this.connectionPromise = null;
                reject(err);
                return;
            }

            this.socket.onopen = () => {
                this.connected = true;
                this.connectionPromise = null;
                resolve();
            };

            this.socket.onmessage = (event: MessageEvent) => {
                const data = typeof event.data === "string"
                    ? event.data
                    : String(event.data);
                this.handleMessage(data);
            };

            this.socket.onclose = () => {
                this.connected = false;
                this.connectionPromise = null;

                // Reject all pending requests on unexpected close
                for (const [id, pending] of this.pendingRequests) {
                    clearTimeout(pending.timer);
                    pending.reject({
                        code: ProtocolErrorCode.SERVER_ERROR,
                        message: "WebSocket connection closed",
                    });
                    this.pendingRequests.delete(id);
                }
            };

            this.socket.onerror = (event: Event) => {
                if (!this.connected) {
                    this.connectionPromise = null;
                    reject(new Error(`WebSocket connection failed to ${this.config.url}`));
                }
            };
        });

        return this.connectionPromise;
    }

    /**
     * Send a method call and wait for the response.
     *
     * @param method - Fully qualified method name (e.g. "DOM.getDocument")
     * @param params - Optional parameters for the method
     * @returns The result object from the server response
     * @throws ProtocolError if the server returns an error, or Error on timeout
     */
    async send(method: ProtocolMethod | string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
        if (!this.connected || !this.socket) {
            throw new Error("Not connected to DevTools server");
        }

        const id = ++this.messageId;

        const request: ProtocolRequest = {
            id,
            method: method as ProtocolMethod,
        };

        if (params !== undefined) {
            request.params = params;
        }

        return new Promise<Record<string, unknown>>((resolve, reject) => {
            const timeout = this.config.timeout ?? 30000;

            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout for ${method} (id=${id}) after ${timeout}ms`));
            }, timeout);

            const pending: PendingRequest = {
                resolve,
                reject,
                timer,
            };

            this.pendingRequests.set(id, pending);

            this.socket!.send(JSON.stringify(request));
        });
    }

    /**
     * Subscribe to a protocol event.
     *
     * @param event - Event name (e.g. "Network.requestWillBeSent")
     * @param handler - Callback to invoke when the event fires
     */
    on(event: string, handler: EventHandler): void {
        let handlers = this.eventHandlers.get(event);
        if (!handlers) {
            handlers = new Set();
            this.eventHandlers.set(event, handlers);
        }
        handlers.add(handler);
    }

    /**
     * Unsubscribe from a protocol event.
     *
     * @param event - Event name
     * @param handler - The handler to remove
     */
    off(event: string, handler: EventHandler): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.eventHandlers.delete(event);
            }
        }
    }

    /**
     * Subscribe to an event once. The handler is automatically
     * removed after it fires for the first time.
     *
     * @param event - Event name
     * @param handler - Callback to invoke once
     */
    once(event: string, handler: EventHandler): void {
        const wrapper: EventHandler = (params) => {
            this.off(event, wrapper);
            handler(params);
        };
        this.on(event, wrapper);
    }

    /**
     * Wait for a specific event with optional timeout.
     *
     * Returns a promise that resolves with the event params when
     * the event fires, or rejects on timeout.
     *
     * @param event - Event name to wait for
     * @param timeout - Timeout in ms (defaults to config timeout)
     * @returns The event params
     */
    async waitForEvent(event: string, timeout?: number): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.off(event, handler);
                reject(new Error(`Timeout waiting for event ${event}`));
            }, timeout ?? this.config.timeout ?? 30000);

            const handler: EventHandler = (params) => {
                clearTimeout(timer);
                resolve(params);
            };
            this.once(event, handler);
        });
    }

    /**
     * Check if the client is currently connected to the server.
     */
    isConnected(): boolean {
        return this.connected;
    }

    /**
     * Disconnect from the server.
     *
     * Closes the WebSocket, rejects all pending requests, and clears
     * event handler registrations.
     */
    async disconnect(): Promise<void> {
        if (this.socket) {
            // Reject all pending requests
            for (const [id, pending] of this.pendingRequests) {
                clearTimeout(pending.timer);
                pending.reject({
                    code: ProtocolErrorCode.SERVER_ERROR,
                    message: "Client disconnected",
                });
            }
            this.pendingRequests.clear();

            // Clear event handlers
            this.eventHandlers.clear();

            // Close the socket
            const socket = this.socket;
            this.socket = null;
            this.connected = false;
            this.connectionPromise = null;

            // Wait for the close to complete
            await new Promise<void>((resolve) => {
                if (socket.readyState === WebSocket.CLOSED) {
                    resolve();
                    return;
                }

                socket.addEventListener("close", () => {
                    resolve();
                }, { once: true });

                socket.close();
            });
        }
    }

    /**
     * Get a typed domain accessor.
     *
     * The accessor provides a convenient `domain.call(method, params)` pattern
     * as well as `enable()`, `disable()`, and event subscription scoped to the domain.
     *
     * @param name - Domain name (e.g. "DOM", "Network", "Runtime")
     * @returns A DomainAccessor for the given domain
     */
    /** Cache for domain accessors to avoid creating new objects on every access */
    private domainAccessorCache: Map<string, DomainAccessor> = new Map();

    domain(name: string): DomainAccessor {
        let accessor = this.domainAccessorCache.get(name);
        if (!accessor) {
            accessor = new DomainAccessor(name, this);
            this.domainAccessorCache.set(name, accessor);
        }
        return accessor;
    }

    // ---- Domain shorthand accessors ----

    /** DOM domain accessor */
    get dom(): DomainAccessor { return this.domain("DOM"); }

    /** CSS domain accessor */
    get css(): DomainAccessor { return this.domain("CSS"); }

    /** Network domain accessor */
    get network(): DomainAccessor { return this.domain("Network"); }

    /** Runtime domain accessor */
    get runtime(): DomainAccessor { return this.domain("Runtime"); }

    /** Debugger domain accessor */
    get debugger(): DomainAccessor { return this.domain("Debugger"); }

    /** Performance domain accessor */
    get performance(): DomainAccessor { return this.domain("Performance"); }

    /** Memory domain accessor */
    get memory(): DomainAccessor { return this.domain("Memory"); }

    /** Storage domain accessor */
    get storage(): DomainAccessor { return this.domain("Storage"); }

    /** Security domain accessor */
    get security(): DomainAccessor { return this.domain("Security"); }

    /** Page domain accessor */
    get page(): DomainAccessor { return this.domain("Page"); }

    /** Rendering domain accessor */
    get rendering(): DomainAccessor { return this.domain("Rendering"); }

    /** Console domain accessor */
    get console(): DomainAccessor { return this.domain("Console"); }

    /** Overlay domain accessor */
    get overlay(): DomainAccessor { return this.domain("Overlay"); }

    /** Emulation domain accessor */
    get emulation(): DomainAccessor { return this.domain("Emulation"); }

    /**
     * Handle an incoming message from the WebSocket.
     *
     * Messages are either:
     * - Responses: have an `id` field -> resolve/reject the matching pending request
     * - Events: have a `method` field but no `id` -> dispatch to subscribed handlers
     */
    private handleMessage(data: string): void {
        let parsed: Record<string, unknown>;
        try {
            parsed = JSON.parse(data);
        } catch {
            // Silently ignore malformed messages
            return;
        }

        // Check if this is a response (has numeric id, no method or has result/error)
        if (typeof parsed.id === "number" && !("method" in parsed && !("result" in parsed || "error" in parsed))) {
            const response = parsed as unknown as ProtocolResponse;
            const pending = this.pendingRequests.get(response.id);
            if (pending) {
                this.pendingRequests.delete(response.id);
                clearTimeout(pending.timer);

                if (response.error) {
                    pending.reject(response.error);
                } else {
                    pending.resolve(response.result ?? {});
                }
            }
            return;
        }

        // Check if this is an event (has method, no id)
        if (typeof parsed.method === "string") {
            const event = parsed as unknown as ProtocolEvent;
            const handlers = this.eventHandlers.get(event.method);
            if (handlers) {
                const params = event.params ?? {};
                for (const handler of handlers) {
                    try {
                        handler(params);
                    } catch (error) {
                        // Log handler errors but prevent them from breaking the message loop
                        console.error(`[DevToolsClient] Event handler error for ${event.method}:`, error);
                    }
                }
            }
        }
    }
}

/**
 * Domain accessor - provides a `domain.method(params)` calling pattern.
 *
 * Wraps the DevToolsClient to scope method calls and event subscriptions
 * to a specific protocol domain.
 *
 * Usage:
 * ```ts
 * const dom = client.domain("DOM");
 * await dom.enable();
 * const doc = await dom.call("getDocument", { depth: 2 });
 * dom.on("documentUpdated", () => { ... });
 * await dom.disable();
 * ```
 */
export class DomainAccessor {
    readonly domainName: string;
    private client: DevToolsClient;

    constructor(name: string, client: DevToolsClient) {
        this.domainName = name;
        this.client = client;
    }

    /**
     * Call a domain method.
     *
     * @param method - Method name within the domain (e.g. "getDocument")
     * @param params - Optional parameters
     * @returns The result from the server
     */
    async call(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
        return await this.client.send(`${this.domainName}.${method}` as ProtocolMethod, params);
    }

    /**
     * Enable this domain.
     * Most domains must be enabled before they start sending events.
     */
    async enable(): Promise<Record<string, unknown>> {
        return await this.call("enable");
    }

    /**
     * Disable this domain.
     * Stops events and releases domain-specific resources.
     */
    async disable(): Promise<Record<string, unknown>> {
        return await this.call("disable");
    }

    /**
     * Subscribe to events for this domain.
     *
     * @param event - Event name within the domain (e.g. "documentUpdated")
     * @param handler - Callback to invoke when the event fires
     */
    on(event: string, handler: EventHandler): void {
        this.client.on(`${this.domainName}.${event}`, handler);
    }

    /**
     * Unsubscribe from events for this domain.
     *
     * @param event - Event name within the domain
     * @param handler - The handler to remove
     */
    off(event: string, handler: EventHandler): void {
        this.client.off(`${this.domainName}.${event}`, handler);
    }

    /**
     * Wait for a domain event with optional timeout.
     *
     * @param event - Event name within the domain
     * @param timeout - Timeout in ms
     * @returns The event params
     */
    async waitForEvent(event: string, timeout?: number): Promise<Record<string, unknown>> {
        return await this.client.waitForEvent(`${this.domainName}.${event}`, timeout);
    }
}
