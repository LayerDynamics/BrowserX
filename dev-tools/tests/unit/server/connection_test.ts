/**
 * Tests for DevToolsConnection
 *
 * Uses a mock WebSocket to verify the connection setup, event forwarding,
 * isOpen state, close behavior, and sendEvent serialization.
 */

import { assertEquals } from "@std/assert";
import { DevToolsConnection } from "../../../server/connection.ts";
import { Router } from "../../../server/router.ts";
import { DomainRegistry } from "../../../protocol/domains.ts";
import { DevToolsSession } from "../../../protocol/session.ts";
import { EventBus } from "../../../integration/event-bus.ts";
import { BaseDomain } from "../../../domains/base-domain.ts";
import { createMockContext, createMockBrowser } from "../../helpers/mocks.ts";
import type { DomainName, ProtocolEvent } from "../../../protocol/types.ts";

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

/**
 * Minimal mock WebSocket that records sent messages and supports
 * readyState, close, and event handler assignment.
 */
class MockWebSocket {
    readyState: number;
    sentMessages: string[] = [];
    closeCalled: boolean = false;

    // Event handlers (assigned by DevToolsConnection)
    onopen: ((ev: Event) => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;

    // addEventListener support for server-level cleanup
    private eventListeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();

    constructor(readyState: number = WebSocket.CONNECTING) {
        this.readyState = readyState;
    }

    send(data: string): void {
        this.sentMessages.push(data);
    }

    close(): void {
        this.closeCalled = true;
        this.readyState = WebSocket.CLOSED;
    }

    addEventListener(event: string, handler: (...args: unknown[]) => void): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(handler);
    }

    removeEventListener(event: string, handler: (...args: unknown[]) => void): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const idx = listeners.indexOf(handler);
            if (idx >= 0) listeners.splice(idx, 1);
        }
    }

    // Simulate opening the socket
    simulateOpen(): void {
        this.readyState = WebSocket.OPEN;
        if (this.onopen) {
            this.onopen(new Event("open"));
        }
    }

    // Simulate an incoming message
    simulateMessage(data: string): void {
        if (this.onmessage) {
            this.onmessage(new MessageEvent("message", { data }));
        }
    }

    // Simulate the socket closing
    simulateClose(): void {
        this.readyState = WebSocket.CLOSED;
        if (this.onclose) {
            this.onclose();
        }
    }
}

// ---------------------------------------------------------------------------
// Helper: A simple mock domain for the session's registry
// ---------------------------------------------------------------------------

class TestDomain extends BaseDomain {
    readonly name: DomainName = "DOM";

    constructor(eventBus: EventBus) {
        super(eventBus);
    }

    protected setup(): void {
        this.registerMethod("getDocument", "Returns root", async () => {
            return { root: { nodeId: 1 } };
        });
    }
}

/**
 * Create a DevToolsConnection with all required dependencies.
 */
function createTestConnection(opts?: { socketReadyState?: number }): {
    connection: DevToolsConnection;
    socket: MockWebSocket;
    session: DevToolsSession;
    registry: DomainRegistry;
    domain: TestDomain;
} {
    const eventBus = new EventBus();
    const registry = new DomainRegistry();
    const domain = new TestDomain(eventBus);
    const context = createMockContext({ eventBus });
    domain.initialize(context);
    registry.register(domain, {
        name: "DOM",
        description: "DOM tree inspection",
        version: "1.0",
        dependencies: [],
    });

    const browser = createMockBrowser();
    const session = new DevToolsSession("test-session", browser as never, registry);
    session.attach();

    const router = new Router(registry);
    const socket = new MockWebSocket(opts?.socketReadyState ?? WebSocket.CONNECTING);

    const connection = new DevToolsConnection(
        "conn-1",
        socket as unknown as WebSocket,
        router,
        session,
    );

    return { connection, socket, session, registry, domain };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("Constructor assigns id and sets up WebSocket handlers", () => {
    const { connection, socket } = createTestConnection();

    assertEquals(connection.id, "conn-1");
    // The constructor should have assigned onmessage, onclose, onerror
    // (onopen is no longer set — Deno.upgradeWebSocket returns already-open sockets)
    assertEquals(typeof socket.onmessage, "function");
    assertEquals(typeof socket.onclose, "function");
    assertEquals(typeof socket.onerror, "function");
});

Deno.test("Connection isOpen() returns true initially, false after close", () => {
    const { connection } = createTestConnection();

    assertEquals(connection.isOpen(), true);

    connection.close();

    assertEquals(connection.isOpen(), false);
});

Deno.test("close() closes the socket when it is OPEN", () => {
    const { connection, socket } = createTestConnection({ socketReadyState: WebSocket.OPEN });

    assertEquals(socket.closeCalled, false);

    connection.close();

    assertEquals(socket.closeCalled, true);
    assertEquals(connection.isOpen(), false);
});

Deno.test("close() is idempotent (calling twice does not error)", () => {
    const { connection, socket } = createTestConnection({ socketReadyState: WebSocket.OPEN });

    connection.close();
    connection.close();

    assertEquals(socket.closeCalled, true);
    assertEquals(connection.isOpen(), false);
});

Deno.test("sendEvent() sends serialized event through socket when open", () => {
    const { connection, socket } = createTestConnection({ socketReadyState: WebSocket.OPEN });

    const event: ProtocolEvent = {
        method: "DOM.documentUpdated",
        params: { timestamp: 12345 },
    };

    connection.sendEvent(event);

    assertEquals(socket.sentMessages.length, 1);
    const parsed = JSON.parse(socket.sentMessages[0]);
    assertEquals(parsed.method, "DOM.documentUpdated");
    assertEquals(parsed.params.timestamp, 12345);
});

Deno.test("sendEvent() does not send when connection is closed", () => {
    const { connection, socket } = createTestConnection({ socketReadyState: WebSocket.OPEN });

    connection.close();

    const event: ProtocolEvent = {
        method: "DOM.documentUpdated",
        params: {},
    };

    connection.sendEvent(event);

    // Only messages before close (none in this case)
    assertEquals(socket.sentMessages.length, 0);
});

Deno.test("sendEvent() does not send when socket readyState is not OPEN", () => {
    const { connection, socket } = createTestConnection({ socketReadyState: WebSocket.CONNECTING });

    const event: ProtocolEvent = {
        method: "DOM.documentUpdated",
        params: {},
    };

    connection.sendEvent(event);

    assertEquals(socket.sentMessages.length, 0);
});

Deno.test("onclose handler marks connection as not open and detaches session", () => {
    const { connection, socket, session } = createTestConnection();

    // Simulate socket close
    socket.simulateClose();

    assertEquals(connection.isOpen(), false);
    assertEquals(session.isAttached(), false);
});

Deno.test("handleMessage routes valid request and sends response", async () => {
    const { socket, domain } = createTestConnection({ socketReadyState: WebSocket.OPEN });
    await domain.enable();

    // Simulate opening the socket
    socket.simulateOpen();

    // Simulate sending a valid request
    socket.simulateMessage(JSON.stringify({
        id: 1,
        method: "DOM.getDocument",
        params: {},
    }));

    // Give async route() time to process
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The response should have been sent back
    const responseMessages = socket.sentMessages.filter((m) => {
        const parsed = JSON.parse(m);
        return typeof parsed.id === "number";
    });
    assertEquals(responseMessages.length >= 1, true);
    const response = JSON.parse(responseMessages[responseMessages.length - 1]);
    assertEquals(response.id, 1);
    assertEquals(response.result.root.nodeId, 1);
});

Deno.test("handleMessage sends error for invalid JSON", async () => {
    const { socket } = createTestConnection({ socketReadyState: WebSocket.OPEN });

    socket.simulateOpen();
    socket.simulateMessage("not valid json!");

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should have sent an error response
    assertEquals(socket.sentMessages.length >= 1, true);
    const response = JSON.parse(socket.sentMessages[socket.sentMessages.length - 1]);
    assertEquals(typeof response.error, "object");
    assertEquals(response.error.code, -32700); // PARSE_ERROR
});
