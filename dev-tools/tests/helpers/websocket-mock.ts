/**
 * WebSocket Mock for BrowserX DevTools Tests
 *
 * Provides mock WebSocket implementations for testing DevTools
 * server and client communication without actual network connections.
 */

import type { ProtocolMessage, ProtocolEvent, ProtocolRequest, ProtocolResponse } from "../../protocol/types.ts";

// ============================================================================
// WebSocket State Constants
// ============================================================================

export const WebSocketReadyState = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
} as const;

export type WebSocketReadyStateType = (typeof WebSocketReadyState)[keyof typeof WebSocketReadyState];

// ============================================================================
// MockWebSocket
// ============================================================================

/**
 * Mock WebSocket for testing client-server communication
 */
export class MockWebSocket {
    // WebSocket state
    readyState: WebSocketReadyStateType = WebSocketReadyState.CONNECTING;
    url: string;
    protocol: string = "";
    extensions: string = "";
    bufferedAmount: number = 0;
    binaryType: "blob" | "arraybuffer" = "blob";

    // Event handlers
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    // Message tracking
    private sentMessages: string[] = [];
    private receivedMessages: string[] = [];

    // Callbacks for the other end of the connection
    private peerMessageCallback?: (data: string) => void;

    constructor(url: string, protocols?: string | string[]) {
        this.url = url;
        if (protocols) {
            this.protocol = Array.isArray(protocols) ? protocols[0] : protocols;
        }
    }

    /**
     * Simulate the WebSocket opening
     */
    simulateOpen(): void {
        if (this.readyState !== WebSocketReadyState.CONNECTING) {
            throw new Error("Cannot open WebSocket: not in CONNECTING state");
        }
        this.readyState = WebSocketReadyState.OPEN;
        if (this.onopen) {
            this.onopen(new Event("open"));
        }
    }

    /**
     * Simulate receiving a message from the server
     */
    simulateMessage(data: string | ArrayBuffer | Blob): void {
        if (this.readyState !== WebSocketReadyState.OPEN) {
            throw new Error("Cannot receive message: WebSocket not open");
        }

        const dataStr = typeof data === "string" ? data : "[binary]";
        this.receivedMessages.push(dataStr);

        if (this.onmessage) {
            const event = new MessageEvent("message", { data });
            this.onmessage(event);
        }
    }

    /**
     * Simulate a protocol message (auto-serializes)
     */
    simulateProtocolMessage(message: ProtocolMessage): void {
        this.simulateMessage(JSON.stringify(message));
    }

    /**
     * Simulate WebSocket close
     */
    simulateClose(code: number = 1000, reason: string = ""): void {
        if (this.readyState === WebSocketReadyState.CLOSED) {
            return;
        }
        this.readyState = WebSocketReadyState.CLOSED;
        if (this.onclose) {
            const event = new CloseEvent("close", { code, reason, wasClean: code === 1000 });
            this.onclose(event);
        }
    }

    /**
     * Simulate WebSocket error
     */
    simulateError(message: string = "WebSocket error"): void {
        if (this.onerror) {
            const event = new ErrorEvent("error", { message });
            this.onerror(event);
        }
    }

    /**
     * Send a message (called by the client code under test)
     */
    send(data: string | ArrayBuffer | Blob): void {
        if (this.readyState !== WebSocketReadyState.OPEN) {
            throw new Error("Cannot send: WebSocket not open");
        }

        const dataStr = typeof data === "string" ? data : "[binary]";
        this.sentMessages.push(dataStr);

        // Notify peer if connected
        if (this.peerMessageCallback && typeof data === "string") {
            this.peerMessageCallback(data);
        }
    }

    /**
     * Close the WebSocket (called by the client code under test)
     */
    close(code?: number, reason?: string): void {
        if (this.readyState === WebSocketReadyState.CLOSED) {
            return;
        }
        this.readyState = WebSocketReadyState.CLOSING;
        // Simulate async close
        setTimeout(() => {
            this.simulateClose(code ?? 1000, reason ?? "");
        }, 0);
    }

    /**
     * Add event listener (standard WebSocket API)
     */
    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        _options?: boolean | AddEventListenerOptions,
    ): void {
        const handler = typeof listener === "function" ? listener : listener.handleEvent.bind(listener);
        switch (type) {
            case "open":
                this.onopen = handler as (event: Event) => void;
                break;
            case "message":
                this.onmessage = handler as (event: MessageEvent) => void;
                break;
            case "close":
                this.onclose = handler as (event: CloseEvent) => void;
                break;
            case "error":
                this.onerror = handler as (event: Event) => void;
                break;
        }
    }

    /**
     * Remove event listener (standard WebSocket API)
     */
    removeEventListener(
        type: string,
        _listener: EventListenerOrEventListenerObject,
        _options?: boolean | EventListenerOptions,
    ): void {
        switch (type) {
            case "open":
                this.onopen = null;
                break;
            case "message":
                this.onmessage = null;
                break;
            case "close":
                this.onclose = null;
                break;
            case "error":
                this.onerror = null;
                break;
        }
    }

    /**
     * Dispatch event (standard WebSocket API)
     */
    dispatchEvent(event: Event): boolean {
        switch (event.type) {
            case "open":
                this.onopen?.(event);
                return true;
            case "message":
                this.onmessage?.(event as MessageEvent);
                return true;
            case "close":
                this.onclose?.(event as CloseEvent);
                return true;
            case "error":
                this.onerror?.(event);
                return true;
        }
        return false;
    }

    // ---- Test Utilities ----

    /**
     * Get all sent messages
     */
    getSentMessages(): string[] {
        return [...this.sentMessages];
    }

    /**
     * Get all received messages
     */
    getReceivedMessages(): string[] {
        return [...this.receivedMessages];
    }

    /**
     * Get the last sent message
     */
    getLastSentMessage(): string | undefined {
        return this.sentMessages[this.sentMessages.length - 1];
    }

    /**
     * Get the last sent message as a protocol object
     */
    getLastSentProtocolMessage<T extends ProtocolMessage>(): T | undefined {
        const last = this.getLastSentMessage();
        if (!last) return undefined;
        return JSON.parse(last) as T;
    }

    /**
     * Get sent message at index
     */
    getSentMessageAt(index: number): string | undefined {
        return this.sentMessages[index];
    }

    /**
     * Get sent message count
     */
    getSentMessageCount(): number {
        return this.sentMessages.length;
    }

    /**
     * Clear sent message history
     */
    clearSentMessages(): void {
        this.sentMessages = [];
    }

    /**
     * Clear received message history
     */
    clearReceivedMessages(): void {
        this.receivedMessages = [];
    }

    /**
     * Clear all message history
     */
    clearAllMessages(): void {
        this.sentMessages = [];
        this.receivedMessages = [];
    }

    /**
     * Set peer message callback (for simulating bidirectional communication)
     */
    setPeerMessageCallback(callback: (data: string) => void): void {
        this.peerMessageCallback = callback;
    }

    /**
     * Check if a specific message was sent
     */
    hasSentMessage(message: string): boolean {
        return this.sentMessages.includes(message);
    }

    /**
     * Check if a specific method was called (in any sent message)
     */
    hasSentMethod(method: string): boolean {
        return this.sentMessages.some((msg) => {
            try {
                const parsed = JSON.parse(msg);
                return parsed.method === method;
            } catch {
                return false;
            }
        });
    }

    /**
     * Find sent messages matching a predicate
     */
    findSentMessages(predicate: (msg: string) => boolean): string[] {
        return this.sentMessages.filter(predicate);
    }

    /**
     * Find sent protocol messages matching a predicate
     */
    findSentProtocolMessages<T extends ProtocolMessage>(
        predicate: (msg: T) => boolean,
    ): T[] {
        return this.sentMessages
            .map((msg) => {
                try {
                    return JSON.parse(msg) as T;
                } catch {
                    return null;
                }
            })
            .filter((msg): msg is T => msg !== null && predicate(msg));
    }
}

// ============================================================================
// MockWebSocketServer
// ============================================================================

/**
 * Mock WebSocket server for integration tests
 */
export class MockWebSocketServer {
    private connections: Map<string, MockWebSocket> = new Map();
    private messageHandlers: Array<(connectionId: string, data: string) => void> = [];
    private connectHandlers: Array<(connectionId: string, socket: MockWebSocket) => void> = [];
    private disconnectHandlers: Array<(connectionId: string) => void> = [];
    private nextConnectionId = 1;
    private isRunning = false;

    /**
     * Start the mock server
     */
    start(): void {
        this.isRunning = true;
    }

    /**
     * Stop the mock server
     */
    stop(): void {
        this.isRunning = false;
        // Close all connections
        for (const [id, socket] of this.connections) {
            socket.simulateClose(1001, "Server shutting down");
            this.connections.delete(id);
        }
    }

    /**
     * Check if server is running
     */
    isStarted(): boolean {
        return this.isRunning;
    }

    /**
     * Simulate a client connection
     */
    simulateConnection(url: string = "ws://localhost:9222"): { id: string; socket: MockWebSocket } {
        if (!this.isRunning) {
            throw new Error("Server not running");
        }

        const id = `conn-${this.nextConnectionId++}`;
        const socket = new MockWebSocket(url);

        // Set up message forwarding from socket to server handlers
        socket.setPeerMessageCallback((data) => {
            for (const handler of this.messageHandlers) {
                handler(id, data);
            }
        });

        this.connections.set(id, socket);

        // Notify connect handlers
        for (const handler of this.connectHandlers) {
            handler(id, socket);
        }

        // Auto-open the socket
        socket.simulateOpen();

        return { id, socket };
    }

    /**
     * Simulate a client disconnection
     */
    simulateDisconnection(connectionId: string, code: number = 1000): void {
        const socket = this.connections.get(connectionId);
        if (socket) {
            socket.simulateClose(code);
            this.connections.delete(connectionId);
            for (const handler of this.disconnectHandlers) {
                handler(connectionId);
            }
        }
    }

    /**
     * Send a message to a specific client
     */
    sendToClient(connectionId: string, data: string): void {
        const socket = this.connections.get(connectionId);
        if (socket) {
            socket.simulateMessage(data);
        }
    }

    /**
     * Send a protocol message to a specific client
     */
    sendProtocolMessageToClient(connectionId: string, message: ProtocolMessage): void {
        this.sendToClient(connectionId, JSON.stringify(message));
    }

    /**
     * Broadcast a message to all connected clients
     */
    broadcast(data: string): void {
        for (const socket of this.connections.values()) {
            socket.simulateMessage(data);
        }
    }

    /**
     * Broadcast a protocol message to all connected clients
     */
    broadcastProtocolMessage(message: ProtocolMessage): void {
        this.broadcast(JSON.stringify(message));
    }

    /**
     * Get a connection by ID
     */
    getConnection(connectionId: string): MockWebSocket | undefined {
        return this.connections.get(connectionId);
    }

    /**
     * Get all connection IDs
     */
    getConnectionIds(): string[] {
        return [...this.connections.keys()];
    }

    /**
     * Get connection count
     */
    getConnectionCount(): number {
        return this.connections.size;
    }

    /**
     * Add message handler
     */
    onMessage(handler: (connectionId: string, data: string) => void): void {
        this.messageHandlers.push(handler);
    }

    /**
     * Add connection handler
     */
    onConnect(handler: (connectionId: string, socket: MockWebSocket) => void): void {
        this.connectHandlers.push(handler);
    }

    /**
     * Add disconnection handler
     */
    onDisconnect(handler: (connectionId: string) => void): void {
        this.disconnectHandlers.push(handler);
    }

    /**
     * Remove all handlers
     */
    clearHandlers(): void {
        this.messageHandlers = [];
        this.connectHandlers = [];
        this.disconnectHandlers = [];
    }

    /**
     * Get all messages received from a specific client
     */
    getClientMessages(connectionId: string): string[] {
        const socket = this.connections.get(connectionId);
        return socket ? socket.getSentMessages() : [];
    }
}

// ============================================================================
// WebSocket Pair (for bidirectional testing)
// ============================================================================

/**
 * Create a pair of connected mock WebSockets for testing bidirectional communication
 */
export function createWebSocketPair(): { client: MockWebSocket; server: MockWebSocket } {
    const client = new MockWebSocket("ws://localhost:9222");
    const server = new MockWebSocket("ws://localhost:9222");

    // Wire them together
    client.setPeerMessageCallback((data) => {
        server.simulateMessage(data);
    });

    server.setPeerMessageCallback((data) => {
        client.simulateMessage(data);
    });

    return { client, server };
}

/**
 * Create and open a pair of connected mock WebSockets
 */
export function createOpenWebSocketPair(): { client: MockWebSocket; server: MockWebSocket } {
    const pair = createWebSocketPair();
    pair.client.simulateOpen();
    pair.server.simulateOpen();
    return pair;
}

// ============================================================================
// CDP Communication Helpers
// ============================================================================

/**
 * Simulate a CDP request-response cycle on a mock WebSocket
 */
export async function simulateCDPRequestResponse(
    socket: MockWebSocket,
    _request: ProtocolRequest,
    response: ProtocolResponse,
    delayMs: number = 0,
): Promise<void> {
    return new Promise((resolve) => {
        // Capture the send
        const originalSend = socket.send.bind(socket);
        socket.send = (data: string | ArrayBuffer | Blob) => {
            originalSend(data);

            // Simulate response after delay
            setTimeout(() => {
                socket.simulateProtocolMessage(response);
                resolve();
            }, delayMs);
        };
    });
}

/**
 * Create a mock CDP server that auto-responds to requests
 */
export function createMockCDPServer(
    responseMap: Map<string, (request: ProtocolRequest) => ProtocolResponse>,
): MockWebSocketServer {
    const server = new MockWebSocketServer();

    server.onMessage((connectionId, data) => {
        try {
            const request = JSON.parse(data) as ProtocolRequest;
            const handler = responseMap.get(request.method);

            if (handler) {
                const response = handler(request);
                server.sendProtocolMessageToClient(connectionId, response);
            } else {
                // Default: method not found
                server.sendProtocolMessageToClient(connectionId, {
                    id: request.id,
                    error: {
                        code: -32601,
                        message: `Method "${request.method}" not found`,
                    },
                });
            }
        } catch (_error) {
            // Parse error
            server.sendToClient(connectionId, JSON.stringify({
                id: 0,
                error: {
                    code: -32700,
                    message: "Parse error",
                },
            }));
        }
    });

    return server;
}

// ============================================================================
// Event Simulation Helpers
// ============================================================================

/**
 * Simulate a stream of CDP events
 */
export async function simulateEventStream(
    socket: MockWebSocket,
    events: ProtocolEvent[],
    intervalMs: number = 10,
): Promise<void> {
    for (const event of events) {
        socket.simulateProtocolMessage(event);
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
}

/**
 * Create a CDP event emitter for testing
 */
export function createEventEmitter(socket: MockWebSocket): {
    emit: (method: string, params?: Record<string, unknown>) => void;
    emitMany: (events: ProtocolEvent[]) => void;
} {
    return {
        emit: (method: string, params?: Record<string, unknown>) => {
            const event: ProtocolEvent = { method: method as ProtocolEvent["method"] };
            if (params) {
                event.params = params;
            }
            socket.simulateProtocolMessage(event);
        },
        emitMany: (events: ProtocolEvent[]) => {
            for (const event of events) {
                socket.simulateProtocolMessage(event);
            }
        },
    };
}
