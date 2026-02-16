/**
 * DevTools Connection
 *
 * Handles a single WebSocket connection from a DevTools client.
 * Manages message framing, JSON parsing, routing, and event dispatch.
 *
 * Each connection is associated with a DevToolsSession and a Router.
 * Domain events are forwarded to the client automatically.
 */

import type { ProtocolEvent } from "../protocol/types.ts";
import { ProtocolErrorCode } from "../protocol/types.ts";
import type { Router } from "./router.ts";
import type { DevToolsSession } from "../protocol/session.ts";
import type { BaseDomain } from "../domains/base-domain.ts";

/**
 * DevToolsConnection - manages a single WebSocket client connection.
 *
 * Sets up bidirectional communication: incoming CDP requests are parsed,
 * routed, and responded to; outgoing domain events are pushed to the client.
 */
export class DevToolsConnection {
    readonly id: string;
    private socket: WebSocket;
    private router: Router;
    private session: DevToolsSession;
    private closed: boolean = false;
    private eventListener: (event: ProtocolEvent) => void;
    private subscribedDomains: Set<BaseDomain> = new Set();

    constructor(
        id: string,
        socket: WebSocket,
        router: Router,
        session: DevToolsSession,
    ) {
        this.id = id;
        this.socket = socket;
        this.router = router;
        this.session = session;

        // Create a reusable event listener that forwards domain events to the client
        this.eventListener = (event: ProtocolEvent) => {
            this.sendEvent(event);
        };

        // Set up WebSocket event handlers
        this.socket.onopen = () => {
            console.log(`DevTools connection ${this.id}: opened`);
            this.subscribeToAllDomains();
        };

        this.socket.onmessage = (event: MessageEvent) => {
            const data = typeof event.data === "string"
                ? event.data
                : new TextDecoder().decode(event.data as ArrayBuffer);
            this.handleMessage(data);
        };

        this.socket.onclose = () => {
            console.log(`DevTools connection ${this.id}: closed`);
            this.cleanup();
        };

        this.socket.onerror = (event: Event) => {
            console.error(`DevTools connection ${this.id}: error`, event);
            this.cleanup();
        };

        // If the socket is already open (possible with Deno.upgradeWebSocket),
        // subscribe immediately
        if (this.socket.readyState === WebSocket.OPEN) {
            this.subscribeToAllDomains();
        }
    }

    /**
     * Handle an incoming WebSocket message.
     *
     * Parses the raw JSON via the router, routes to the correct domain,
     * and sends the response back over the socket.
     */
    private async handleMessage(data: string): Promise<void> {
        try {
            const request = this.router.parseMessage(data);
            const response = await this.router.route(request);
            const serialized = this.router.serialize(response);
            if (!this.closed) {
                this.socket.send(serialized);
            }
        } catch (error: unknown) {
            // Parse/validation errors from router.parseMessage()
            const errorResponse = {
                id: 0,
                error: {
                    code: ProtocolErrorCode.PARSE_ERROR,
                    message: "Failed to process message",
                },
            };

            if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                "message" in error
            ) {
                const structured = error as { code: number; message: string };
                errorResponse.error.code = structured.code;
                errorResponse.error.message = structured.message;
            } else if (error instanceof Error) {
                errorResponse.error.code = ProtocolErrorCode.INTERNAL_ERROR;
                errorResponse.error.message = error.message;
            }

            if (!this.closed) {
                this.socket.send(JSON.stringify(errorResponse));
            }
        }
    }

    /**
     * Send a protocol event to the client.
     *
     * Events are server-initiated messages (no `id` field) pushed to the
     * client when domain state changes.
     */
    sendEvent(event: ProtocolEvent): void {
        if (!this.closed && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(event));
        }
    }

    /**
     * Close the connection and clean up resources.
     */
    close(): void {
        if (this.closed) return;
        this.cleanup();
        if (
            this.socket.readyState === WebSocket.OPEN ||
            this.socket.readyState === WebSocket.CONNECTING
        ) {
            this.socket.close();
        }
    }

    /**
     * Check if the connection is still open.
     */
    isOpen(): boolean {
        return !this.closed;
    }

    /**
     * Subscribe to events from all registered domains in the session's registry.
     * Each domain's addEventListener is called so that protocol events flow
     * through this connection to the client.
     */
    private subscribeToAllDomains(): void {
        const domainNames = this.session.domains.getDomainNames();
        for (const name of domainNames) {
            const domain = this.session.domains.getDomain(name);
            if (domain && !this.subscribedDomains.has(domain)) {
                domain.addEventListener(this.eventListener);
                this.subscribedDomains.add(domain);
            }
        }
    }

    /**
     * Unsubscribe from all domain event listeners and mark connection as closed.
     */
    private cleanup(): void {
        this.closed = true;
        for (const domain of this.subscribedDomains) {
            domain.removeEventListener(this.eventListener);
        }
        this.subscribedDomains.clear();
        this.session.detach();
    }
}
