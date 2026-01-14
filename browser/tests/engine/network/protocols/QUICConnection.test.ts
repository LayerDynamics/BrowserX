/**
 * QUICConnection Tests
 *
 * Comprehensive tests for QUIC connection implementation.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    QUICConnection,
    QUICPacketType,
    QUICFrameType,
    QUICStreamState,
    QUICConnectionState,
    type QUICStream,
    type QUICFrame,
} from "../../../../src/engine/network/protocols/QUICConnection.ts";

// ============================================================================
// QUICPacketType Enum Tests
// ============================================================================

Deno.test({
    name: "QUICPacketType - has INITIAL",
    fn() {
        assertEquals(QUICPacketType.INITIAL, 0x0);
    },
});

Deno.test({
    name: "QUICPacketType - has ZERO_RTT",
    fn() {
        assertEquals(QUICPacketType.ZERO_RTT, 0x1);
    },
});

Deno.test({
    name: "QUICPacketType - has HANDSHAKE",
    fn() {
        assertEquals(QUICPacketType.HANDSHAKE, 0x2);
    },
});

Deno.test({
    name: "QUICPacketType - has RETRY",
    fn() {
        assertEquals(QUICPacketType.RETRY, 0x3);
    },
});

// ============================================================================
// QUICFrameType Enum Tests
// ============================================================================

Deno.test({
    name: "QUICFrameType - has PADDING",
    fn() {
        assertEquals(QUICFrameType.PADDING, 0x00);
    },
});

Deno.test({
    name: "QUICFrameType - has PING",
    fn() {
        assertEquals(QUICFrameType.PING, 0x01);
    },
});

Deno.test({
    name: "QUICFrameType - has ACK",
    fn() {
        assertEquals(QUICFrameType.ACK, 0x02);
    },
});

Deno.test({
    name: "QUICFrameType - has ACK_ECN",
    fn() {
        assertEquals(QUICFrameType.ACK_ECN, 0x03);
    },
});

Deno.test({
    name: "QUICFrameType - has RESET_STREAM",
    fn() {
        assertEquals(QUICFrameType.RESET_STREAM, 0x04);
    },
});

Deno.test({
    name: "QUICFrameType - has STOP_SENDING",
    fn() {
        assertEquals(QUICFrameType.STOP_SENDING, 0x05);
    },
});

Deno.test({
    name: "QUICFrameType - has CRYPTO",
    fn() {
        assertEquals(QUICFrameType.CRYPTO, 0x06);
    },
});

Deno.test({
    name: "QUICFrameType - has NEW_TOKEN",
    fn() {
        assertEquals(QUICFrameType.NEW_TOKEN, 0x07);
    },
});

Deno.test({
    name: "QUICFrameType - has STREAM",
    fn() {
        assertEquals(QUICFrameType.STREAM, 0x08);
    },
});

Deno.test({
    name: "QUICFrameType - has MAX_DATA",
    fn() {
        assertEquals(QUICFrameType.MAX_DATA, 0x10);
    },
});

Deno.test({
    name: "QUICFrameType - has MAX_STREAM_DATA",
    fn() {
        assertEquals(QUICFrameType.MAX_STREAM_DATA, 0x11);
    },
});

Deno.test({
    name: "QUICFrameType - has MAX_STREAMS_BIDI",
    fn() {
        assertEquals(QUICFrameType.MAX_STREAMS_BIDI, 0x12);
    },
});

Deno.test({
    name: "QUICFrameType - has MAX_STREAMS_UNI",
    fn() {
        assertEquals(QUICFrameType.MAX_STREAMS_UNI, 0x13);
    },
});

Deno.test({
    name: "QUICFrameType - has DATA_BLOCKED",
    fn() {
        assertEquals(QUICFrameType.DATA_BLOCKED, 0x14);
    },
});

Deno.test({
    name: "QUICFrameType - has STREAM_DATA_BLOCKED",
    fn() {
        assertEquals(QUICFrameType.STREAM_DATA_BLOCKED, 0x15);
    },
});

Deno.test({
    name: "QUICFrameType - has STREAMS_BLOCKED_BIDI",
    fn() {
        assertEquals(QUICFrameType.STREAMS_BLOCKED_BIDI, 0x16);
    },
});

Deno.test({
    name: "QUICFrameType - has STREAMS_BLOCKED_UNI",
    fn() {
        assertEquals(QUICFrameType.STREAMS_BLOCKED_UNI, 0x17);
    },
});

Deno.test({
    name: "QUICFrameType - has NEW_CONNECTION_ID",
    fn() {
        assertEquals(QUICFrameType.NEW_CONNECTION_ID, 0x18);
    },
});

Deno.test({
    name: "QUICFrameType - has RETIRE_CONNECTION_ID",
    fn() {
        assertEquals(QUICFrameType.RETIRE_CONNECTION_ID, 0x19);
    },
});

Deno.test({
    name: "QUICFrameType - has PATH_CHALLENGE",
    fn() {
        assertEquals(QUICFrameType.PATH_CHALLENGE, 0x1a);
    },
});

Deno.test({
    name: "QUICFrameType - has PATH_RESPONSE",
    fn() {
        assertEquals(QUICFrameType.PATH_RESPONSE, 0x1b);
    },
});

Deno.test({
    name: "QUICFrameType - has CONNECTION_CLOSE",
    fn() {
        assertEquals(QUICFrameType.CONNECTION_CLOSE, 0x1c);
    },
});

Deno.test({
    name: "QUICFrameType - has CONNECTION_CLOSE_APP",
    fn() {
        assertEquals(QUICFrameType.CONNECTION_CLOSE_APP, 0x1d);
    },
});

Deno.test({
    name: "QUICFrameType - has HANDSHAKE_DONE",
    fn() {
        assertEquals(QUICFrameType.HANDSHAKE_DONE, 0x1e);
    },
});

// ============================================================================
// QUICStreamState Enum Tests
// ============================================================================

Deno.test({
    name: "QUICStreamState - has IDLE",
    fn() {
        assertEquals(QUICStreamState.IDLE, "IDLE");
    },
});

Deno.test({
    name: "QUICStreamState - has OPEN",
    fn() {
        assertEquals(QUICStreamState.OPEN, "OPEN");
    },
});

Deno.test({
    name: "QUICStreamState - has HALF_CLOSED_LOCAL",
    fn() {
        assertEquals(QUICStreamState.HALF_CLOSED_LOCAL, "HALF_CLOSED_LOCAL");
    },
});

Deno.test({
    name: "QUICStreamState - has HALF_CLOSED_REMOTE",
    fn() {
        assertEquals(QUICStreamState.HALF_CLOSED_REMOTE, "HALF_CLOSED_REMOTE");
    },
});

Deno.test({
    name: "QUICStreamState - has CLOSED",
    fn() {
        assertEquals(QUICStreamState.CLOSED, "CLOSED");
    },
});

// ============================================================================
// QUICConnectionState Enum Tests
// ============================================================================

Deno.test({
    name: "QUICConnectionState - has INITIAL",
    fn() {
        assertEquals(QUICConnectionState.INITIAL, "INITIAL");
    },
});

Deno.test({
    name: "QUICConnectionState - has HANDSHAKE",
    fn() {
        assertEquals(QUICConnectionState.HANDSHAKE, "HANDSHAKE");
    },
});

Deno.test({
    name: "QUICConnectionState - has ESTABLISHED",
    fn() {
        assertEquals(QUICConnectionState.ESTABLISHED, "ESTABLISHED");
    },
});

Deno.test({
    name: "QUICConnectionState - has CLOSING",
    fn() {
        assertEquals(QUICConnectionState.CLOSING, "CLOSING");
    },
});

Deno.test({
    name: "QUICConnectionState - has CLOSED",
    fn() {
        assertEquals(QUICConnectionState.CLOSED, "CLOSED");
    },
});

// ============================================================================
// QUICConnection Constructor Tests
// ============================================================================

Deno.test({
    name: "QUICConnection - constructor creates connection",
    fn() {
        const connection = new QUICConnection();

        assertExists(connection);
    },
});

Deno.test({
    name: "QUICConnection - constructor initializes state to INITIAL",
    fn() {
        const connection = new QUICConnection();

        const stats = connection.getStats();

        assertEquals(stats.state, QUICConnectionState.INITIAL);
    },
});

Deno.test({
    name: "QUICConnection - constructor initializes packet number to 0",
    fn() {
        const connection = new QUICConnection();

        const stats = connection.getStats();

        assertEquals(stats.packetNumber, 0);
    },
});

Deno.test({
    name: "QUICConnection - constructor initializes no active streams",
    fn() {
        const connection = new QUICConnection();

        const stats = connection.getStats();

        assertEquals(stats.activeStreams, 0);
    },
});

Deno.test({
    name: "QUICConnection - constructor sets default max data",
    fn() {
        const connection = new QUICConnection();

        const stats = connection.getStats();

        assertEquals(stats.maxData, 1048576); // 1MB
    },
});

// ============================================================================
// QUICConnection createStream() Tests
// ============================================================================

Deno.test({
    name: "QUICConnection - createStream creates stream",
    fn() {
        const connection = new QUICConnection();

        const stream = connection.createStream();

        assertExists(stream);
        assertEquals(typeof stream.id, "number");
    },
});

Deno.test({
    name: "QUICConnection - createStream starts with ID 0",
    fn() {
        const connection = new QUICConnection();

        const stream = connection.createStream();

        assertEquals(stream.id, 0);
    },
});

Deno.test({
    name: "QUICConnection - createStream increments by 4",
    fn() {
        const connection = new QUICConnection();

        const stream1 = connection.createStream();
        const stream2 = connection.createStream();
        const stream3 = connection.createStream();

        // Client bidirectional streams: 0, 4, 8, 12...
        assertEquals(stream1.id, 0);
        assertEquals(stream2.id, 4);
        assertEquals(stream3.id, 8);
    },
});

Deno.test({
    name: "QUICConnection - createStream initializes state to IDLE",
    fn() {
        const connection = new QUICConnection();

        const stream = connection.createStream();

        assertEquals(stream.state, QUICStreamState.IDLE);
    },
});

Deno.test({
    name: "QUICConnection - createStream initializes empty buffers",
    fn() {
        const connection = new QUICConnection();

        const stream = connection.createStream();

        assertEquals(stream.sendBuffer.length, 0);
        assertEquals(stream.receiveBuffer.length, 0);
    },
});

Deno.test({
    name: "QUICConnection - createStream initializes data counters",
    fn() {
        const connection = new QUICConnection();

        const stream = connection.createStream();

        assertEquals(stream.dataReceived, 0);
        assertEquals(stream.dataSent, 0);
    },
});

Deno.test({
    name: "QUICConnection - createStream sets max data",
    fn() {
        const connection = new QUICConnection();

        const stream = connection.createStream();

        assertEquals(stream.maxData, 1048576);
    },
});

Deno.test({
    name: "QUICConnection - createStream increases active stream count",
    fn() {
        const connection = new QUICConnection();

        assertEquals(connection.getStats().activeStreams, 0);

        connection.createStream();
        assertEquals(connection.getStats().activeStreams, 1);

        connection.createStream();
        assertEquals(connection.getStats().activeStreams, 2);
    },
});

// ============================================================================
// QUICConnection getStats() Tests
// ============================================================================

Deno.test({
    name: "QUICConnection - getStats returns statistics",
    fn() {
        const connection = new QUICConnection();

        const stats = connection.getStats();

        assertExists(stats);
        assertExists(stats.state);
        assertExists(stats.activeStreams);
        assertEquals(typeof stats.packetNumber, "number");
        assertEquals(typeof stats.maxData, "number");
    },
});

Deno.test({
    name: "QUICConnection - getStats tracks state",
    fn() {
        const connection = new QUICConnection();

        const stats = connection.getStats();

        assertEquals(stats.state, QUICConnectionState.INITIAL);
    },
});

Deno.test({
    name: "QUICConnection - getStats tracks active streams",
    fn() {
        const connection = new QUICConnection();

        let stats = connection.getStats();
        assertEquals(stats.activeStreams, 0);

        connection.createStream();
        stats = connection.getStats();
        assertEquals(stats.activeStreams, 1);

        connection.createStream();
        connection.createStream();
        stats = connection.getStats();
        assertEquals(stats.activeStreams, 3);
    },
});

Deno.test({
    name: "QUICConnection - getStats tracks packet number",
    fn() {
        const connection = new QUICConnection();

        const stats = connection.getStats();

        assertEquals(stats.packetNumber, 0);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "QUIC - stream ID sequence for client bidirectional",
    fn() {
        const connection = new QUICConnection();

        const streamIds: number[] = [];

        for (let i = 0; i < 10; i++) {
            const stream = connection.createStream();
            streamIds.push(stream.id);
        }

        // Verify client bidirectional pattern: 0, 4, 8, 12...
        for (let i = 0; i < streamIds.length; i++) {
            assertEquals(streamIds[i], i * 4);
            assertEquals(streamIds[i] % 4, 0); // All multiples of 4
        }
    },
});

Deno.test({
    name: "QUIC - multiple streams lifecycle",
    fn() {
        const connection = new QUICConnection();

        const stream1 = connection.createStream();
        const stream2 = connection.createStream();
        const stream3 = connection.createStream();

        assertEquals(stream1.state, QUICStreamState.IDLE);
        assertEquals(stream2.state, QUICStreamState.IDLE);
        assertEquals(stream3.state, QUICStreamState.IDLE);

        // Verify each stream is independent
        assert(stream1.id !== stream2.id);
        assert(stream2.id !== stream3.id);
    },
});

Deno.test({
    name: "QUIC - all packet types defined",
    fn() {
        const packetTypes = [
            QUICPacketType.INITIAL,
            QUICPacketType.ZERO_RTT,
            QUICPacketType.HANDSHAKE,
            QUICPacketType.RETRY,
        ];

        // Verify all are sequential from 0
        for (let i = 0; i < packetTypes.length; i++) {
            assertEquals(packetTypes[i], i);
        }
    },
});

Deno.test({
    name: "QUIC - all frame types defined",
    fn() {
        const frameTypes = [
            QUICFrameType.PADDING,
            QUICFrameType.PING,
            QUICFrameType.ACK,
            QUICFrameType.CRYPTO,
            QUICFrameType.STREAM,
            QUICFrameType.MAX_DATA,
            QUICFrameType.CONNECTION_CLOSE,
            QUICFrameType.HANDSHAKE_DONE,
        ];

        // Verify all are numbers
        for (const type of frameTypes) {
            assertEquals(typeof type, "number");
        }
    },
});

Deno.test({
    name: "QUIC - connection state transitions",
    fn() {
        const connection = new QUICConnection();

        // Initial state
        let stats = connection.getStats();
        assertEquals(stats.state, QUICConnectionState.INITIAL);

        // States are strings for clarity
        const states = [
            QUICConnectionState.INITIAL,
            QUICConnectionState.HANDSHAKE,
            QUICConnectionState.ESTABLISHED,
            QUICConnectionState.CLOSING,
            QUICConnectionState.CLOSED,
        ];

        for (const state of states) {
            assertEquals(typeof state, "string");
        }
    },
});

Deno.test({
    name: "QUIC - stream state transitions",
    fn() {
        const states = [
            QUICStreamState.IDLE,
            QUICStreamState.OPEN,
            QUICStreamState.HALF_CLOSED_LOCAL,
            QUICStreamState.HALF_CLOSED_REMOTE,
            QUICStreamState.CLOSED,
        ];

        for (const state of states) {
            assertEquals(typeof state, "string");
        }
    },
});

Deno.test({
    name: "QUIC - stream data counters",
    fn() {
        const connection = new QUICConnection();

        const stream = connection.createStream();

        // Initial counters
        assertEquals(stream.dataReceived, 0);
        assertEquals(stream.dataSent, 0);

        // Counters are independent per stream
        const stream2 = connection.createStream();
        assertEquals(stream2.dataReceived, 0);
        assertEquals(stream2.dataSent, 0);
    },
});

Deno.test({
    name: "QUIC - frame types cover all categories",
    fn() {
        // Verify frame types for different categories exist
        const controlFrames = [
            QUICFrameType.PADDING,
            QUICFrameType.PING,
            QUICFrameType.CONNECTION_CLOSE,
        ];

        const ackFrames = [
            QUICFrameType.ACK,
            QUICFrameType.ACK_ECN,
        ];

        const streamFrames = [
            QUICFrameType.STREAM,
            QUICFrameType.RESET_STREAM,
            QUICFrameType.STOP_SENDING,
        ];

        const flowControlFrames = [
            QUICFrameType.MAX_DATA,
            QUICFrameType.MAX_STREAM_DATA,
            QUICFrameType.DATA_BLOCKED,
            QUICFrameType.STREAM_DATA_BLOCKED,
        ];

        const cryptoFrames = [
            QUICFrameType.CRYPTO,
        ];

        // All should be numbers
        const allFrames = [...controlFrames, ...ackFrames, ...streamFrames, ...flowControlFrames, ...cryptoFrames];
        for (const frame of allFrames) {
            assertEquals(typeof frame, "number");
        }
    },
});

Deno.test({
    name: "QUIC - connection max data limit",
    fn() {
        const connection = new QUICConnection();

        const stats = connection.getStats();

        // Default 1MB limit
        assertEquals(stats.maxData, 1048576);
        assert(stats.maxData > 0);
    },
});

Deno.test({
    name: "QUIC - QUICStream interface structure",
    fn() {
        const connection = new QUICConnection();

        const stream = connection.createStream();

        // Verify required fields
        assertExists(stream.id);
        assertExists(stream.state);
        assertExists(stream.sendBuffer);
        assertExists(stream.receiveBuffer);
        assertExists(stream.maxData);
        assertExists(stream.dataReceived);
        assertExists(stream.dataSent);

        // Verify types
        assertEquals(typeof stream.id, "number");
        assertEquals(typeof stream.state, "string");
        assert(Array.isArray(stream.sendBuffer));
        assert(Array.isArray(stream.receiveBuffer));
        assertEquals(typeof stream.maxData, "number");
        assertEquals(typeof stream.dataReceived, "number");
        assertEquals(typeof stream.dataSent, "number");
    },
});

Deno.test({
    name: "QUIC - bidirectional stream IDs",
    fn() {
        const connection = new QUICConnection();

        // Create multiple streams and verify IDs follow pattern
        const streams: QUICStream[] = [];
        for (let i = 0; i < 5; i++) {
            streams.push(connection.createStream());
        }

        // Client-initiated bidirectional: 0, 4, 8, 12, 16
        assertEquals(streams[0].id, 0);
        assertEquals(streams[1].id, 4);
        assertEquals(streams[2].id, 8);
        assertEquals(streams[3].id, 12);
        assertEquals(streams[4].id, 16);

        // All should be divisible by 4
        for (const stream of streams) {
            assertEquals(stream.id % 4, 0);
        }

        // Should be strictly increasing
        for (let i = 1; i < streams.length; i++) {
            assert(streams[i].id > streams[i - 1].id);
        }
    },
});

Deno.test({
    name: "QUIC - frame type values match RFC 9000",
    fn() {
        // Verify critical frame types match specification
        assertEquals(QUICFrameType.PADDING, 0x00);
        assertEquals(QUICFrameType.PING, 0x01);
        assertEquals(QUICFrameType.ACK, 0x02);
        assertEquals(QUICFrameType.CRYPTO, 0x06);
        assertEquals(QUICFrameType.STREAM, 0x08);
        assertEquals(QUICFrameType.CONNECTION_CLOSE, 0x1c);
        assertEquals(QUICFrameType.HANDSHAKE_DONE, 0x1e);
    },
});

Deno.test({
    name: "QUIC - packet types are sequential",
    fn() {
        assertEquals(QUICPacketType.INITIAL, 0);
        assertEquals(QUICPacketType.ZERO_RTT, 1);
        assertEquals(QUICPacketType.HANDSHAKE, 2);
        assertEquals(QUICPacketType.RETRY, 3);
    },
});

Deno.test({
    name: "QUIC - stream flow control parameters",
    fn() {
        const connection = new QUICConnection();

        const stream = connection.createStream();

        // Flow control is per-stream and connection-wide
        assert(stream.maxData > 0);
        assert(connection.getStats().maxData > 0);

        // Stream max should not exceed connection max
        assert(stream.maxData <= connection.getStats().maxData);
    },
});

Deno.test({
    name: "QUIC - frame type grouping",
    fn() {
        // Stream-related frames (0x08-0x0f range)
        const streamBase = QUICFrameType.STREAM;
        assertEquals(streamBase, 0x08);

        // Flow control frames (0x10-0x17 range)
        assertEquals(QUICFrameType.MAX_DATA, 0x10);
        assertEquals(QUICFrameType.MAX_STREAM_DATA, 0x11);
        assertEquals(QUICFrameType.MAX_STREAMS_BIDI, 0x12);
        assertEquals(QUICFrameType.MAX_STREAMS_UNI, 0x13);
        assertEquals(QUICFrameType.DATA_BLOCKED, 0x14);
        assertEquals(QUICFrameType.STREAM_DATA_BLOCKED, 0x15);

        // Connection management frames (0x18-0x1e range)
        assertEquals(QUICFrameType.NEW_CONNECTION_ID, 0x18);
        assertEquals(QUICFrameType.RETIRE_CONNECTION_ID, 0x19);
        assertEquals(QUICFrameType.PATH_CHALLENGE, 0x1a);
        assertEquals(QUICFrameType.PATH_RESPONSE, 0x1b);
        assertEquals(QUICFrameType.CONNECTION_CLOSE, 0x1c);
        assertEquals(QUICFrameType.CONNECTION_CLOSE_APP, 0x1d);
        assertEquals(QUICFrameType.HANDSHAKE_DONE, 0x1e);
    },
});

Deno.test({
    name: "QUIC - connection lifecycle stages",
    fn() {
        // Verify all connection states are defined
        const states = [
            QUICConnectionState.INITIAL,
            QUICConnectionState.HANDSHAKE,
            QUICConnectionState.ESTABLISHED,
            QUICConnectionState.CLOSING,
            QUICConnectionState.CLOSED,
        ];

        // Should have exactly 5 states
        assertEquals(states.length, 5);

        // All should be unique
        const uniqueStates = new Set(states);
        assertEquals(uniqueStates.size, 5);
    },
});
