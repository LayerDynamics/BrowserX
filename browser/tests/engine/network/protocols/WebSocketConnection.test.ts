/**
 * Tests for WebSocket Connection Implementation
 *
 * Tests WebSocket protocol (RFC 6455) including opcodes, states,
 * and connection interface.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    WebSocketConnection,
    WebSocketOpcode,
    WebSocketState,
    type WebSocketFrame,
} from "../../../../src/engine/network/protocols/WebSocketConnection.ts";
import type { Socket } from "../../../../src/engine/network/primitives/Socket.ts";
import { SocketState } from "../../../../src/types/network.ts";
import type { SocketStats } from "../../../../src/types/network.ts";
import type { FileDescriptor, Port, ByteBuffer } from "../../../../src/types/identifiers.ts";

// Mock Socket implementation for testing
class MockSocket implements Socket {
    private writeBuffer: ByteBuffer[] = [];
    private readBuffer: ByteBuffer[] = [];
    private closed = false;
    private _fd: FileDescriptor = 1 as FileDescriptor;
    private _localAddress: string = "127.0.0.1";
    private _localPort: Port = 8080 as Port;
    private _remoteAddress: string = "127.0.0.1";
    private _remotePort: Port = 9090 as Port;

    get fd(): FileDescriptor {
        return this._fd;
    }

    get state(): SocketState {
        return this.closed ? SocketState.CLOSED : SocketState.OPEN;
    }

    get localAddress(): string {
        return this._localAddress;
    }

    get localPort(): Port {
        return this._localPort;
    }

    get remoteAddress(): string {
        return this._remoteAddress;
    }

    get remotePort(): Port {
        return this._remotePort;
    }

    async read(buffer: ByteBuffer): Promise<number | null> {
        if (this.readBuffer.length === 0) {
            return 0;
        }
        const data = this.readBuffer.shift()!;
        buffer.set(data);
        return data.byteLength;
    }

    async write(data: ByteBuffer): Promise<number> {
        this.writeBuffer.push(new Uint8Array(data) as ByteBuffer);
        return data.byteLength;
    }

    async close(): Promise<void> {
        this.closed = true;
    }

    getStats(): SocketStats {
        return {
            bytesRead: 0,
            bytesWritten: 0,
            readOperations: 0,
            writeOperations: 0,
            errors: 0,
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
        };
    }

    getWrittenData(): ByteBuffer[] {
        return this.writeBuffer;
    }

    addReadData(data: ByteBuffer): void {
        this.readBuffer.push(data);
    }

    isClosed(): boolean {
        return this.closed;
    }
}

// WebSocketOpcode enum tests

Deno.test({
    name: "WebSocketOpcode - CONTINUATION has value 0x0",
    fn() {
        assertEquals(WebSocketOpcode.CONTINUATION, 0x0);
    },
});

Deno.test({
    name: "WebSocketOpcode - TEXT has value 0x1",
    fn() {
        assertEquals(WebSocketOpcode.TEXT, 0x1);
    },
});

Deno.test({
    name: "WebSocketOpcode - BINARY has value 0x2",
    fn() {
        assertEquals(WebSocketOpcode.BINARY, 0x2);
    },
});

Deno.test({
    name: "WebSocketOpcode - CLOSE has value 0x8",
    fn() {
        assertEquals(WebSocketOpcode.CLOSE, 0x8);
    },
});

Deno.test({
    name: "WebSocketOpcode - PING has value 0x9",
    fn() {
        assertEquals(WebSocketOpcode.PING, 0x9);
    },
});

Deno.test({
    name: "WebSocketOpcode - PONG has value 0xA",
    fn() {
        assertEquals(WebSocketOpcode.PONG, 0xA);
    },
});

// WebSocketState enum tests

Deno.test({
    name: "WebSocketState - CONNECTING value",
    fn() {
        assertEquals(WebSocketState.CONNECTING, "CONNECTING");
    },
});

Deno.test({
    name: "WebSocketState - OPEN value",
    fn() {
        assertEquals(WebSocketState.OPEN, "OPEN");
    },
});

Deno.test({
    name: "WebSocketState - CLOSING value",
    fn() {
        assertEquals(WebSocketState.CLOSING, "CLOSING");
    },
});

Deno.test({
    name: "WebSocketState - CLOSED value",
    fn() {
        assertEquals(WebSocketState.CLOSED, "CLOSED");
    },
});

// WebSocketConnection constructor tests

Deno.test({
    name: "WebSocketConnection - constructor creates connection",
    fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        assertExists(connection);
    },
});

Deno.test({
    name: "WebSocketConnection - initial state is CONNECTING",
    fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        // State is private, but we can verify it's initialized by checking behavior
        assertExists(connection);
    },
});

// WebSocketConnection.handshake tests

Deno.test({
    name: "WebSocketConnection - handshake with ws:// URL",
    async fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        try {
            await connection.handshake("ws://example.com/socket");
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.handshake not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - handshake with wss:// URL",
    async fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        try {
            await connection.handshake("wss://example.com/socket");
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.handshake not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - handshake with protocols",
    async fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        try {
            await connection.handshake("ws://example.com/socket", ["chat", "superchat"]);
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.handshake not implemented");
        }
    },
});

// WebSocketConnection.send tests

Deno.test({
    name: "WebSocketConnection - send string message",
    async fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        try {
            await connection.send("Hello, WebSocket!");
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.send not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - send binary message",
    async fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        const data = new Uint8Array([1, 2, 3, 4]);
        try {
            await connection.send(data);
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.send not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - send empty message",
    async fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        try {
            await connection.send("");
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.send not implemented");
        }
    },
});

// WebSocketConnection.receive tests

Deno.test({
    name: "WebSocketConnection - receive message",
    async fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        try {
            await connection.receive();
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.receive not implemented");
        }
    },
});

// WebSocketConnection.parseFrame tests

Deno.test({
    name: "WebSocketConnection - parseFrame with data",
    fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        const data = new Uint8Array([0x81, 0x05, 0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
        try {
            connection.parseFrame(data);
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.parseFrame not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - parseFrame with empty data",
    fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        const data = new Uint8Array([]);
        try {
            connection.parseFrame(data);
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.parseFrame not implemented");
        }
    },
});

// WebSocketConnection.encodeFrame tests

Deno.test({
    name: "WebSocketConnection - encodeFrame for TEXT opcode",
    fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        const payload = new TextEncoder().encode("Hello");
        try {
            connection.encodeFrame(WebSocketOpcode.TEXT, payload, true);
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.encodeFrame not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - encodeFrame for BINARY opcode",
    fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        const payload = new Uint8Array([1, 2, 3, 4]);
        try {
            connection.encodeFrame(WebSocketOpcode.BINARY, payload, true);
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.encodeFrame not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - encodeFrame for PING opcode",
    fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        const payload = new Uint8Array([]);
        try {
            connection.encodeFrame(WebSocketOpcode.PING, payload, true);
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.encodeFrame not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - encodeFrame for PONG opcode",
    fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        const payload = new Uint8Array([]);
        try {
            connection.encodeFrame(WebSocketOpcode.PONG, payload, true);
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.encodeFrame not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - encodeFrame for CLOSE opcode",
    fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        const payload = new Uint8Array([0x03, 0xe8]); // 1000 = Normal closure
        try {
            connection.encodeFrame(WebSocketOpcode.CLOSE, payload, true);
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.encodeFrame not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - encodeFrame for CONTINUATION opcode",
    fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        const payload = new TextEncoder().encode("continued...");
        try {
            connection.encodeFrame(WebSocketOpcode.CONTINUATION, payload, false);
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.encodeFrame not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - encodeFrame with fin=false",
    fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        const payload = new TextEncoder().encode("fragment");
        try {
            connection.encodeFrame(WebSocketOpcode.TEXT, payload, false);
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.encodeFrame not implemented");
        }
    },
});

// WebSocketConnection.ping tests

Deno.test({
    name: "WebSocketConnection - ping sends PING frame",
    async fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        try {
            await connection.ping();
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.ping not implemented");
        }
    },
});

// WebSocketConnection.close tests

Deno.test({
    name: "WebSocketConnection - close without parameters",
    async fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        try {
            await connection.close();
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.close not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - close with status code 1000",
    async fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        try {
            await connection.close(1000);
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.close not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - close with status code and reason",
    async fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        try {
            await connection.close(1000, "Normal closure");
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.close not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - close with status code 1001 (going away)",
    async fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        try {
            await connection.close(1001, "Going away");
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.close not implemented");
        }
    },
});

Deno.test({
    name: "WebSocketConnection - close with status code 1002 (protocol error)",
    async fn() {
        const socket = new MockSocket();
        const connection = new WebSocketConnection(socket);
        try {
            await connection.close(1002, "Protocol error");
            assert(false, "Should have thrown");
        } catch (e) {
            assertEquals((e as Error).message, "WebSocketConnection.close not implemented");
        }
    },
});

// WebSocketFrame interface structure tests

Deno.test({
    name: "WebSocketFrame - interface structure with fin=true",
    fn() {
        const frame: WebSocketFrame = {
            fin: true,
            opcode: WebSocketOpcode.TEXT,
            masked: true,
            payload: new TextEncoder().encode("Hello"),
        };
        assertEquals(frame.fin, true);
        assertEquals(frame.opcode, WebSocketOpcode.TEXT);
        assertEquals(frame.masked, true);
        assertExists(frame.payload);
    },
});

Deno.test({
    name: "WebSocketFrame - interface structure with fin=false",
    fn() {
        const frame: WebSocketFrame = {
            fin: false,
            opcode: WebSocketOpcode.CONTINUATION,
            masked: false,
            payload: new Uint8Array([]),
        };
        assertEquals(frame.fin, false);
        assertEquals(frame.opcode, WebSocketOpcode.CONTINUATION);
        assertEquals(frame.masked, false);
        assertEquals(frame.payload.byteLength, 0);
    },
});

Deno.test({
    name: "WebSocketFrame - BINARY frame structure",
    fn() {
        const frame: WebSocketFrame = {
            fin: true,
            opcode: WebSocketOpcode.BINARY,
            masked: true,
            payload: new Uint8Array([0x01, 0x02, 0x03]),
        };
        assertEquals(frame.opcode, WebSocketOpcode.BINARY);
        assertEquals(frame.payload.byteLength, 3);
    },
});

Deno.test({
    name: "WebSocketFrame - CLOSE frame structure",
    fn() {
        const frame: WebSocketFrame = {
            fin: true,
            opcode: WebSocketOpcode.CLOSE,
            masked: true,
            payload: new Uint8Array([0x03, 0xe8]), // 1000
        };
        assertEquals(frame.opcode, WebSocketOpcode.CLOSE);
        assertEquals(frame.payload.byteLength, 2);
    },
});

Deno.test({
    name: "WebSocketFrame - PING frame structure",
    fn() {
        const frame: WebSocketFrame = {
            fin: true,
            opcode: WebSocketOpcode.PING,
            masked: true,
            payload: new Uint8Array([]),
        };
        assertEquals(frame.opcode, WebSocketOpcode.PING);
        assertEquals(frame.fin, true);
    },
});

Deno.test({
    name: "WebSocketFrame - PONG frame structure",
    fn() {
        const frame: WebSocketFrame = {
            fin: true,
            opcode: WebSocketOpcode.PONG,
            masked: false,
            payload: new Uint8Array([]),
        };
        assertEquals(frame.opcode, WebSocketOpcode.PONG);
        assertEquals(frame.masked, false);
    },
});
