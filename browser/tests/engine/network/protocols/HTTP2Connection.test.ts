/**
 * HTTP2Connection Tests
 *
 * Comprehensive tests for HTTP/2 connection implementation.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    HTTP2Connection,
    HTTP2FrameType,
    HTTP2FrameFlags,
    HTTP2Settings,
    HTTP2ErrorCode,
    HTTP2StreamState,
    type HTTP2Frame,
    type HTTP2Stream,
} from "../../../../src/engine/network/protocols/HTTP2Connection.ts";
import type { Socket } from "../../../../src/engine/network/primitives/Socket.ts";
import { SocketState } from "../../../../src/types/network.ts";
import type { SocketStats } from "../../../../src/types/network.ts";
import type { FileDescriptor, Port, ByteBuffer } from "../../../../src/types/identifiers.ts";

// ============================================================================
// Mock Socket for Testing
// ============================================================================

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
            return null;
        }
        const data = this.readBuffer.shift()!;
        const bytesToCopy = Math.min(buffer.byteLength, data.byteLength);
        buffer.set(data.slice(0, bytesToCopy), 0);
        return bytesToCopy;
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

    // Test helpers
    getWrittenData(): ByteBuffer[] {
        return this.writeBuffer;
    }

    queueReadData(data: ByteBuffer): void {
        this.readBuffer.push(data);
    }

    clearWriteBuffer(): void {
        this.writeBuffer = [];
    }
}

// ============================================================================
// HTTP2FrameType Enum Tests
// ============================================================================

Deno.test({
    name: "HTTP2FrameType - has DATA",
    fn() {
        assertEquals(HTTP2FrameType.DATA, 0x0);
    },
});

Deno.test({
    name: "HTTP2FrameType - has HEADERS",
    fn() {
        assertEquals(HTTP2FrameType.HEADERS, 0x1);
    },
});

Deno.test({
    name: "HTTP2FrameType - has PRIORITY",
    fn() {
        assertEquals(HTTP2FrameType.PRIORITY, 0x2);
    },
});

Deno.test({
    name: "HTTP2FrameType - has RST_STREAM",
    fn() {
        assertEquals(HTTP2FrameType.RST_STREAM, 0x3);
    },
});

Deno.test({
    name: "HTTP2FrameType - has SETTINGS",
    fn() {
        assertEquals(HTTP2FrameType.SETTINGS, 0x4);
    },
});

Deno.test({
    name: "HTTP2FrameType - has PUSH_PROMISE",
    fn() {
        assertEquals(HTTP2FrameType.PUSH_PROMISE, 0x5);
    },
});

Deno.test({
    name: "HTTP2FrameType - has PING",
    fn() {
        assertEquals(HTTP2FrameType.PING, 0x6);
    },
});

Deno.test({
    name: "HTTP2FrameType - has GOAWAY",
    fn() {
        assertEquals(HTTP2FrameType.GOAWAY, 0x7);
    },
});

Deno.test({
    name: "HTTP2FrameType - has WINDOW_UPDATE",
    fn() {
        assertEquals(HTTP2FrameType.WINDOW_UPDATE, 0x8);
    },
});

Deno.test({
    name: "HTTP2FrameType - has CONTINUATION",
    fn() {
        assertEquals(HTTP2FrameType.CONTINUATION, 0x9);
    },
});

// ============================================================================
// HTTP2FrameFlags Enum Tests
// ============================================================================

Deno.test({
    name: "HTTP2FrameFlags - has END_STREAM",
    fn() {
        assertEquals(HTTP2FrameFlags.END_STREAM, 0x1);
    },
});

Deno.test({
    name: "HTTP2FrameFlags - has END_HEADERS",
    fn() {
        assertEquals(HTTP2FrameFlags.END_HEADERS, 0x4);
    },
});

Deno.test({
    name: "HTTP2FrameFlags - has PADDED",
    fn() {
        assertEquals(HTTP2FrameFlags.PADDED, 0x8);
    },
});

Deno.test({
    name: "HTTP2FrameFlags - has PRIORITY",
    fn() {
        assertEquals(HTTP2FrameFlags.PRIORITY, 0x20);
    },
});

Deno.test({
    name: "HTTP2FrameFlags - has ACK",
    fn() {
        assertEquals(HTTP2FrameFlags.ACK, 0x1);
    },
});

// ============================================================================
// HTTP2Settings Enum Tests
// ============================================================================

Deno.test({
    name: "HTTP2Settings - has HEADER_TABLE_SIZE",
    fn() {
        assertEquals(HTTP2Settings.HEADER_TABLE_SIZE, 0x1);
    },
});

Deno.test({
    name: "HTTP2Settings - has ENABLE_PUSH",
    fn() {
        assertEquals(HTTP2Settings.ENABLE_PUSH, 0x2);
    },
});

Deno.test({
    name: "HTTP2Settings - has MAX_CONCURRENT_STREAMS",
    fn() {
        assertEquals(HTTP2Settings.MAX_CONCURRENT_STREAMS, 0x3);
    },
});

Deno.test({
    name: "HTTP2Settings - has INITIAL_WINDOW_SIZE",
    fn() {
        assertEquals(HTTP2Settings.INITIAL_WINDOW_SIZE, 0x4);
    },
});

Deno.test({
    name: "HTTP2Settings - has MAX_FRAME_SIZE",
    fn() {
        assertEquals(HTTP2Settings.MAX_FRAME_SIZE, 0x5);
    },
});

Deno.test({
    name: "HTTP2Settings - has MAX_HEADER_LIST_SIZE",
    fn() {
        assertEquals(HTTP2Settings.MAX_HEADER_LIST_SIZE, 0x6);
    },
});

// ============================================================================
// HTTP2ErrorCode Enum Tests
// ============================================================================

Deno.test({
    name: "HTTP2ErrorCode - has NO_ERROR",
    fn() {
        assertEquals(HTTP2ErrorCode.NO_ERROR, 0x0);
    },
});

Deno.test({
    name: "HTTP2ErrorCode - has PROTOCOL_ERROR",
    fn() {
        assertEquals(HTTP2ErrorCode.PROTOCOL_ERROR, 0x1);
    },
});

Deno.test({
    name: "HTTP2ErrorCode - has INTERNAL_ERROR",
    fn() {
        assertEquals(HTTP2ErrorCode.INTERNAL_ERROR, 0x2);
    },
});

Deno.test({
    name: "HTTP2ErrorCode - has FLOW_CONTROL_ERROR",
    fn() {
        assertEquals(HTTP2ErrorCode.FLOW_CONTROL_ERROR, 0x3);
    },
});

Deno.test({
    name: "HTTP2ErrorCode - has SETTINGS_TIMEOUT",
    fn() {
        assertEquals(HTTP2ErrorCode.SETTINGS_TIMEOUT, 0x4);
    },
});

Deno.test({
    name: "HTTP2ErrorCode - has STREAM_CLOSED",
    fn() {
        assertEquals(HTTP2ErrorCode.STREAM_CLOSED, 0x5);
    },
});

Deno.test({
    name: "HTTP2ErrorCode - has FRAME_SIZE_ERROR",
    fn() {
        assertEquals(HTTP2ErrorCode.FRAME_SIZE_ERROR, 0x6);
    },
});

Deno.test({
    name: "HTTP2ErrorCode - has REFUSED_STREAM",
    fn() {
        assertEquals(HTTP2ErrorCode.REFUSED_STREAM, 0x7);
    },
});

Deno.test({
    name: "HTTP2ErrorCode - has CANCEL",
    fn() {
        assertEquals(HTTP2ErrorCode.CANCEL, 0x8);
    },
});

Deno.test({
    name: "HTTP2ErrorCode - has COMPRESSION_ERROR",
    fn() {
        assertEquals(HTTP2ErrorCode.COMPRESSION_ERROR, 0x9);
    },
});

Deno.test({
    name: "HTTP2ErrorCode - has CONNECT_ERROR",
    fn() {
        assertEquals(HTTP2ErrorCode.CONNECT_ERROR, 0xa);
    },
});

Deno.test({
    name: "HTTP2ErrorCode - has ENHANCE_YOUR_CALM",
    fn() {
        assertEquals(HTTP2ErrorCode.ENHANCE_YOUR_CALM, 0xb);
    },
});

Deno.test({
    name: "HTTP2ErrorCode - has INADEQUATE_SECURITY",
    fn() {
        assertEquals(HTTP2ErrorCode.INADEQUATE_SECURITY, 0xc);
    },
});

Deno.test({
    name: "HTTP2ErrorCode - has HTTP_1_1_REQUIRED",
    fn() {
        assertEquals(HTTP2ErrorCode.HTTP_1_1_REQUIRED, 0xd);
    },
});

// ============================================================================
// HTTP2StreamState Enum Tests
// ============================================================================

Deno.test({
    name: "HTTP2StreamState - has IDLE",
    fn() {
        assertEquals(HTTP2StreamState.IDLE, "IDLE");
    },
});

Deno.test({
    name: "HTTP2StreamState - has RESERVED_LOCAL",
    fn() {
        assertEquals(HTTP2StreamState.RESERVED_LOCAL, "RESERVED_LOCAL");
    },
});

Deno.test({
    name: "HTTP2StreamState - has RESERVED_REMOTE",
    fn() {
        assertEquals(HTTP2StreamState.RESERVED_REMOTE, "RESERVED_REMOTE");
    },
});

Deno.test({
    name: "HTTP2StreamState - has OPEN",
    fn() {
        assertEquals(HTTP2StreamState.OPEN, "OPEN");
    },
});

Deno.test({
    name: "HTTP2StreamState - has HALF_CLOSED_LOCAL",
    fn() {
        assertEquals(HTTP2StreamState.HALF_CLOSED_LOCAL, "HALF_CLOSED_LOCAL");
    },
});

Deno.test({
    name: "HTTP2StreamState - has HALF_CLOSED_REMOTE",
    fn() {
        assertEquals(HTTP2StreamState.HALF_CLOSED_REMOTE, "HALF_CLOSED_REMOTE");
    },
});

Deno.test({
    name: "HTTP2StreamState - has CLOSED",
    fn() {
        assertEquals(HTTP2StreamState.CLOSED, "CLOSED");
    },
});

// ============================================================================
// HTTP2Connection Constructor Tests
// ============================================================================

Deno.test({
    name: "HTTP2Connection - constructor creates connection",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        assertExists(connection);
    },
});

Deno.test({
    name: "HTTP2Connection - constructor initializes stats",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const stats = connection.getStats();

        assertEquals(stats.activeStreams, 0);
        assertEquals(stats.nextStreamId, 1);
        assertEquals(stats.connectionWindowSize, 65535);
        assertEquals(stats.prefaceSent, false);
        assertEquals(stats.settingsReceived, false);
    },
});

// ============================================================================
// HTTP2Connection createStream() Tests
// ============================================================================

Deno.test({
    name: "HTTP2Connection - createStream creates stream with odd ID",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const stream = connection.createStream();

        assertEquals(stream.id, 1);
        assertEquals(stream.state, HTTP2StreamState.IDLE);
    },
});

Deno.test({
    name: "HTTP2Connection - createStream increments by 2",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const stream1 = connection.createStream();
        const stream2 = connection.createStream();
        const stream3 = connection.createStream();

        assertEquals(stream1.id, 1);
        assertEquals(stream2.id, 3);
        assertEquals(stream3.id, 5);
    },
});

Deno.test({
    name: "HTTP2Connection - createStream initializes window sizes",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const stream = connection.createStream();

        assertEquals(stream.localWindowSize, 65535);
        assertEquals(stream.remoteWindowSize, 65535);
    },
});

Deno.test({
    name: "HTTP2Connection - createStream initializes empty data chunks",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const stream = connection.createStream();

        assertEquals(stream.dataChunks.length, 0);
        assertEquals(stream.headersComplete, false);
    },
});

// ============================================================================
// HTTP2Connection parseFrame() Tests
// ============================================================================

Deno.test({
    name: "HTTP2Connection - parseFrame parses DATA frame",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        // Build frame: length=5, type=DATA(0), flags=0, streamId=1, payload="hello"
        const payload = new TextEncoder().encode("hello");
        const frame = new Uint8Array(9 + payload.byteLength);
        const view = new DataView(frame.buffer);

        view.setUint8(0, 0); // Length high byte
        view.setUint8(1, 0);
        view.setUint8(2, 5); // Length = 5
        view.setUint8(3, HTTP2FrameType.DATA);
        view.setUint8(4, 0); // Flags
        view.setUint32(5, 1); // Stream ID = 1

        frame.set(payload, 9);

        const parsed = connection.parseFrame(frame);

        assertEquals(parsed.length, 5);
        assertEquals(parsed.type, HTTP2FrameType.DATA);
        assertEquals(parsed.flags, 0);
        assertEquals(parsed.streamId, 1);
        assertEquals(new TextDecoder().decode(parsed.payload), "hello");
    },
});

Deno.test({
    name: "HTTP2Connection - parseFrame parses HEADERS frame",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const frame = new Uint8Array(9);
        const view = new DataView(frame.buffer);

        view.setUint8(0, 0);
        view.setUint8(1, 0);
        view.setUint8(2, 0); // Length = 0
        view.setUint8(3, HTTP2FrameType.HEADERS);
        view.setUint8(4, HTTP2FrameFlags.END_HEADERS);
        view.setUint32(5, 3); // Stream ID = 3

        const parsed = connection.parseFrame(frame);

        assertEquals(parsed.type, HTTP2FrameType.HEADERS);
        assertEquals(parsed.flags, HTTP2FrameFlags.END_HEADERS);
        assertEquals(parsed.streamId, 3);
    },
});

Deno.test({
    name: "HTTP2Connection - parseFrame parses SETTINGS frame",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const frame = new Uint8Array(9);
        const view = new DataView(frame.buffer);

        view.setUint8(0, 0);
        view.setUint8(1, 0);
        view.setUint8(2, 0);
        view.setUint8(3, HTTP2FrameType.SETTINGS);
        view.setUint8(4, 0);
        view.setUint32(5, 0); // Stream ID must be 0 for SETTINGS

        const parsed = connection.parseFrame(frame);

        assertEquals(parsed.type, HTTP2FrameType.SETTINGS);
        assertEquals(parsed.streamId, 0);
    },
});

Deno.test({
    name: "HTTP2Connection - parseFrame throws on too short buffer",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const frame = new Uint8Array(5); // Too short

        let errorThrown = false;
        try {
            connection.parseFrame(frame);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("Frame too short"));
        }

        assert(errorThrown);
    },
});

Deno.test({
    name: "HTTP2Connection - parseFrame handles large payload",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const payload = new Uint8Array(16384); // 16KB payload
        payload.fill(0x42);

        const frame = new Uint8Array(9 + payload.byteLength);
        const view = new DataView(frame.buffer);

        view.setUint8(0, 0);
        view.setUint8(1, 0x40); // 16384 = 0x4000
        view.setUint8(2, 0);
        view.setUint8(3, HTTP2FrameType.DATA);
        view.setUint8(4, 0);
        view.setUint32(5, 1);

        frame.set(payload, 9);

        const parsed = connection.parseFrame(frame);

        assertEquals(parsed.length, 16384);
        assertEquals(parsed.payload.byteLength, 16384);
    },
});

Deno.test({
    name: "HTTP2Connection - parseFrame handles all frame types",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const types = [
            HTTP2FrameType.DATA,
            HTTP2FrameType.HEADERS,
            HTTP2FrameType.PRIORITY,
            HTTP2FrameType.RST_STREAM,
            HTTP2FrameType.SETTINGS,
            HTTP2FrameType.PUSH_PROMISE,
            HTTP2FrameType.PING,
            HTTP2FrameType.GOAWAY,
            HTTP2FrameType.WINDOW_UPDATE,
            HTTP2FrameType.CONTINUATION,
        ];

        for (const type of types) {
            const frame = new Uint8Array(9);
            const view = new DataView(frame.buffer);

            view.setUint8(0, 0);
            view.setUint8(1, 0);
            view.setUint8(2, 0);
            view.setUint8(3, type);
            view.setUint8(4, 0);
            view.setUint32(5, type === HTTP2FrameType.SETTINGS ? 0 : 1);

            const parsed = connection.parseFrame(frame);
            assertEquals(parsed.type, type);
        }
    },
});

// ============================================================================
// HTTP2Connection sendSettings() Tests
// ============================================================================

Deno.test({
    name: "HTTP2Connection - sendSettings sends SETTINGS frame",
    async fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const settings = new Map([[HTTP2Settings.MAX_CONCURRENT_STREAMS, 100]]);

        await connection.sendSettings(settings);

        const written = socket.getWrittenData();
        assert(written.length > 0);

        // Parse frame
        const frame = connection.parseFrame(written[0]);
        assertEquals(frame.type, HTTP2FrameType.SETTINGS);
        assertEquals(frame.streamId, 0);
    },
});

Deno.test({
    name: "HTTP2Connection - sendSettings encodes setting values",
    async fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const settings = new Map([
            [HTTP2Settings.HEADER_TABLE_SIZE, 4096],
            [HTTP2Settings.ENABLE_PUSH, 1],
        ]);

        await connection.sendSettings(settings);

        const written = socket.getWrittenData();
        const frame = connection.parseFrame(written[0]);

        // Payload should be 2 settings * 6 bytes = 12 bytes
        assertEquals(frame.payload.byteLength, 12);
    },
});

// ============================================================================
// HTTP2Connection sendPreface() Tests
// ============================================================================

Deno.test({
    name: "HTTP2Connection - sendPreface sends connection preface",
    async fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        await connection.sendPreface();

        const written = socket.getWrittenData();
        assert(written.length >= 2); // Preface + SETTINGS frame

        // Check preface string
        const prefaceText = new TextDecoder().decode(written[0]);
        assert(prefaceText.includes("PRI * HTTP/2.0"));
    },
});

Deno.test({
    name: "HTTP2Connection - sendPreface only sends once",
    async fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        await connection.sendPreface();
        socket.clearWriteBuffer();

        await connection.sendPreface(); // Should not send again

        const written = socket.getWrittenData();
        assertEquals(written.length, 0);
    },
});

Deno.test({
    name: "HTTP2Connection - sendPreface updates stats",
    async fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        await connection.sendPreface();

        const stats = connection.getStats();
        assertEquals(stats.prefaceSent, true);
    },
});

// ============================================================================
// HTTP2Connection updateWindow() Tests
// ============================================================================

Deno.test({
    name: "HTTP2Connection - updateWindow sends WINDOW_UPDATE frame",
    async fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        await connection.updateWindow(1, 1024);

        const written = socket.getWrittenData();
        const frame = connection.parseFrame(written[0]);

        assertEquals(frame.type, HTTP2FrameType.WINDOW_UPDATE);
        assertEquals(frame.streamId, 1);
    },
});

Deno.test({
    name: "HTTP2Connection - updateWindow encodes increment value",
    async fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        await connection.updateWindow(1, 65535);

        const written = socket.getWrittenData();
        const frame = connection.parseFrame(written[0]);

        const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength);
        const increment = view.getUint32(0) & 0x7FFFFFFF;

        assertEquals(increment, 65535);
    },
});

// ============================================================================
// HTTP2Connection close() Tests
// ============================================================================

Deno.test({
    name: "HTTP2Connection - close sends GOAWAY frame",
    async fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        await connection.close();

        const written = socket.getWrittenData();
        const goawayFrame = written.find(data => {
            const frame = connection.parseFrame(data);
            return frame.type === HTTP2FrameType.GOAWAY;
        });

        assertExists(goawayFrame);
    },
});

Deno.test({
    name: "HTTP2Connection - close closes socket",
    async fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        await connection.close();

        assertEquals(socket.state, "CLOSED");
    },
});

Deno.test({
    name: "HTTP2Connection - close clears streams",
    async fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        connection.createStream();
        connection.createStream();

        await connection.close();

        const stats = connection.getStats();
        assertEquals(stats.activeStreams, 0);
    },
});

// ============================================================================
// HTTP2Connection getStats() Tests
// ============================================================================

Deno.test({
    name: "HTTP2Connection - getStats returns current statistics",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const stats = connection.getStats();

        assertExists(stats.activeStreams);
        assertExists(stats.nextStreamId);
        assertExists(stats.connectionWindowSize);
        assertEquals(typeof stats.prefaceSent, "boolean");
        assertEquals(typeof stats.settingsReceived, "boolean");
    },
});

Deno.test({
    name: "HTTP2Connection - getStats tracks active streams",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        assertEquals(connection.getStats().activeStreams, 0);

        connection.createStream();
        assertEquals(connection.getStats().activeStreams, 1);

        connection.createStream();
        assertEquals(connection.getStats().activeStreams, 2);
    },
});

Deno.test({
    name: "HTTP2Connection - getStats tracks next stream ID",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        assertEquals(connection.getStats().nextStreamId, 1);

        connection.createStream();
        assertEquals(connection.getStats().nextStreamId, 3);

        connection.createStream();
        assertEquals(connection.getStats().nextStreamId, 5);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "HTTP2 - frame serialization round-trip",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const payload = new TextEncoder().encode("test data");
        const originalFrame: HTTP2Frame = {
            length: payload.byteLength,
            type: HTTP2FrameType.DATA,
            flags: HTTP2FrameFlags.END_STREAM,
            streamId: 1,
            payload,
        };

        // Build frame manually
        const buffer = new Uint8Array(9 + payload.byteLength);
        const view = new DataView(buffer.buffer);

        view.setUint8(0, (payload.byteLength >> 16) & 0xFF);
        view.setUint8(1, (payload.byteLength >> 8) & 0xFF);
        view.setUint8(2, payload.byteLength & 0xFF);
        view.setUint8(3, originalFrame.type);
        view.setUint8(4, originalFrame.flags);
        view.setUint32(5, originalFrame.streamId);
        buffer.set(payload, 9);

        const parsed = connection.parseFrame(buffer);

        assertEquals(parsed.length, originalFrame.length);
        assertEquals(parsed.type, originalFrame.type);
        assertEquals(parsed.flags, originalFrame.flags);
        assertEquals(parsed.streamId, originalFrame.streamId);
        assertEquals(new TextDecoder().decode(parsed.payload), "test data");
    },
});

Deno.test({
    name: "HTTP2 - connection lifecycle",
    async fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        // Initial state
        let stats = connection.getStats();
        assertEquals(stats.prefaceSent, false);
        assertEquals(stats.activeStreams, 0);

        // Send preface
        await connection.sendPreface();
        stats = connection.getStats();
        assertEquals(stats.prefaceSent, true);

        // Create streams
        connection.createStream();
        connection.createStream();
        stats = connection.getStats();
        assertEquals(stats.activeStreams, 2);

        // Close connection
        await connection.close();
        stats = connection.getStats();
        assertEquals(stats.activeStreams, 0);
    },
});

Deno.test({
    name: "HTTP2 - stream ID sequence",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const streamIds: number[] = [];

        for (let i = 0; i < 10; i++) {
            const stream = connection.createStream();
            streamIds.push(stream.id);
        }

        // Verify all odd and increasing
        for (let i = 0; i < streamIds.length; i++) {
            assertEquals(streamIds[i], 1 + (i * 2));
            assertEquals(streamIds[i] % 2, 1); // All odd
        }
    },
});

Deno.test({
    name: "HTTP2 - multiple frame types",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const frames: HTTP2Frame[] = [
            {
                length: 0,
                type: HTTP2FrameType.SETTINGS,
                flags: 0,
                streamId: 0,
                payload: new Uint8Array(0),
            },
            {
                length: 5,
                type: HTTP2FrameType.DATA,
                flags: HTTP2FrameFlags.END_STREAM,
                streamId: 1,
                payload: new TextEncoder().encode("hello"),
            },
            {
                length: 0,
                type: HTTP2FrameType.PING,
                flags: HTTP2FrameFlags.ACK,
                streamId: 0,
                payload: new Uint8Array(8),
            },
        ];

        for (const frame of frames) {
            // Build and parse frame
            const buffer = new Uint8Array(9 + frame.payload.byteLength);
            const view = new DataView(buffer.buffer);

            view.setUint8(0, (frame.payload.byteLength >> 16) & 0xFF);
            view.setUint8(1, (frame.payload.byteLength >> 8) & 0xFF);
            view.setUint8(2, frame.payload.byteLength & 0xFF);
            view.setUint8(3, frame.type);
            view.setUint8(4, frame.flags);
            view.setUint32(5, frame.streamId);
            buffer.set(frame.payload, 9);

            const parsed = connection.parseFrame(buffer);
            assertEquals(parsed.type, frame.type);
            assertEquals(parsed.flags, frame.flags);
            assertEquals(parsed.streamId, frame.streamId);
        }
    },
});

Deno.test({
    name: "HTTP2 - SETTINGS frame format",
    async fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const settings = new Map([
            [HTTP2Settings.MAX_CONCURRENT_STREAMS, 100],
            [HTTP2Settings.INITIAL_WINDOW_SIZE, 32768],
        ]);

        await connection.sendSettings(settings);

        const written = socket.getWrittenData();
        const frame = connection.parseFrame(written[0]);

        // Parse settings payload
        const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength);

        const setting1Id = view.getUint16(0);
        const setting1Value = view.getUint32(2);
        const setting2Id = view.getUint16(6);
        const setting2Value = view.getUint32(8);

        assertEquals(setting1Id, HTTP2Settings.MAX_CONCURRENT_STREAMS);
        assertEquals(setting1Value, 100);
        assertEquals(setting2Id, HTTP2Settings.INITIAL_WINDOW_SIZE);
        assertEquals(setting2Value, 32768);
    },
});

Deno.test({
    name: "HTTP2 - default connection settings",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const stream = connection.createStream();

        // Check default window size
        assertEquals(stream.localWindowSize, 65535);
        assertEquals(stream.remoteWindowSize, 65535);

        const stats = connection.getStats();
        assertEquals(stats.connectionWindowSize, 65535);
    },
});

Deno.test({
    name: "HTTP2 - stream state transitions",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const stream = connection.createStream();

        assertEquals(stream.state, HTTP2StreamState.IDLE);

        // Simulate state transitions
        stream.state = HTTP2StreamState.OPEN;
        assertEquals(stream.state, HTTP2StreamState.OPEN);

        stream.state = HTTP2StreamState.HALF_CLOSED_LOCAL;
        assertEquals(stream.state, HTTP2StreamState.HALF_CLOSED_LOCAL);

        stream.state = HTTP2StreamState.CLOSED;
        assertEquals(stream.state, HTTP2StreamState.CLOSED);
    },
});

Deno.test({
    name: "HTTP2 - all error codes defined",
    fn() {
        const errorCodes = [
            HTTP2ErrorCode.NO_ERROR,
            HTTP2ErrorCode.PROTOCOL_ERROR,
            HTTP2ErrorCode.INTERNAL_ERROR,
            HTTP2ErrorCode.FLOW_CONTROL_ERROR,
            HTTP2ErrorCode.SETTINGS_TIMEOUT,
            HTTP2ErrorCode.STREAM_CLOSED,
            HTTP2ErrorCode.FRAME_SIZE_ERROR,
            HTTP2ErrorCode.REFUSED_STREAM,
            HTTP2ErrorCode.CANCEL,
            HTTP2ErrorCode.COMPRESSION_ERROR,
            HTTP2ErrorCode.CONNECT_ERROR,
            HTTP2ErrorCode.ENHANCE_YOUR_CALM,
            HTTP2ErrorCode.INADEQUATE_SECURITY,
            HTTP2ErrorCode.HTTP_1_1_REQUIRED,
        ];

        // Verify all are numbers
        for (const code of errorCodes) {
            assertEquals(typeof code, "number");
        }

        // Verify they're in sequence
        assertEquals(errorCodes.length, 14);
    },
});

Deno.test({
    name: "HTTP2 - frame flag combinations",
    fn() {
        const socket = new MockSocket();
        const connection = new HTTP2Connection(socket);

        const flagCombinations = [
            HTTP2FrameFlags.END_STREAM,
            HTTP2FrameFlags.END_HEADERS,
            HTTP2FrameFlags.END_STREAM | HTTP2FrameFlags.END_HEADERS,
            HTTP2FrameFlags.PADDED,
            HTTP2FrameFlags.PRIORITY,
            HTTP2FrameFlags.ACK,
        ];

        for (const flags of flagCombinations) {
            const buffer = new Uint8Array(9);
            const view = new DataView(buffer.buffer);

            view.setUint8(0, 0);
            view.setUint8(1, 0);
            view.setUint8(2, 0);
            view.setUint8(3, HTTP2FrameType.DATA);
            view.setUint8(4, flags);
            view.setUint32(5, 1);

            const parsed = connection.parseFrame(buffer);
            assertEquals(parsed.flags, flags);
        }
    },
});
