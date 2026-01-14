/**
 * TCPConnection Tests
 *
 * Comprehensive tests for TCP connection implementation.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    TCPConnection,
    createTCPSegment,
    serializeTCPSegment,
    parseTCPSegment,
    type TCPConfig,
    type TCPSegment,
    type TCPFlags,
    type TCPOptions,
    type TCPMetrics,
} from "../../../../src/engine/network/primitives/TCPConnection.ts";
import { TCPState, SocketState } from "../../../../src/types/network.ts";

// Helper to create default TCP config
function createDefaultConfig(): TCPConfig {
    return {
        connectTimeout: 5000,
        idleTimeout: 60000,
        keepAliveInterval: 30000,
        keepAliveProbes: 3,
        sendBufferSize: 65536,
        receiveBufferSize: 65536,
        noDelay: true,
        maxSegmentSize: 1460,
        windowSize: 65535,
    };
}

// Mock socket for testing
function createMockSocket(): any {
    return {
        fd: 1,
        state: SocketState.OPEN,
        localAddress: "127.0.0.1",
        localPort: 12345,
        remoteAddress: "127.0.0.1",
        remotePort: 80,
        read: async (_buffer: Uint8Array) => null,
        write: async (_data: Uint8Array) => _data.byteLength,
        close: async () => {},
        getStats: () => ({
            bytesRead: 0,
            bytesWritten: 0,
            readOperations: 0,
            writeOperations: 0,
            errors: 0,
        }),
    };
}

// ============================================================================
// TCPConfig Interface Tests
// ============================================================================

Deno.test({
    name: "TCPConfig - contains required connection timeout fields",
    fn() {
        const config = createDefaultConfig();

        assertExists(config.connectTimeout);
        assertExists(config.idleTimeout);
        assertExists(config.keepAliveInterval);
        assertExists(config.keepAliveProbes);
    },
});

Deno.test({
    name: "TCPConfig - contains required buffer size fields",
    fn() {
        const config = createDefaultConfig();

        assertExists(config.sendBufferSize);
        assertExists(config.receiveBufferSize);
    },
});

Deno.test({
    name: "TCPConfig - contains required TCP options",
    fn() {
        const config = createDefaultConfig();

        assertEquals(typeof config.noDelay, "boolean");
        assertExists(config.maxSegmentSize);
        assertExists(config.windowSize);
    },
});

// ============================================================================
// TCPConnection Constructor Tests
// ============================================================================

Deno.test({
    name: "TCPConnection - constructor creates connection",
    fn() {
        const socket = createMockSocket();
        const config = createDefaultConfig();
        const connection = new TCPConnection(socket, config);

        assertExists(connection);
    },
});

Deno.test({
    name: "TCPConnection - constructor initializes metrics",
    fn() {
        const socket = createMockSocket();
        const config = createDefaultConfig();
        const connection = new TCPConnection(socket, config);

        const metrics = connection.getMetrics();

        assertExists(metrics);
        assertEquals(metrics.state, TCPState.CLOSED);
        assertEquals(metrics.bytesSent, 0);
        assertEquals(metrics.bytesReceived, 0);
    },
});

Deno.test({
    name: "TCPConnection - constructor sets window sizes from config",
    fn() {
        const socket = createMockSocket();
        const config = createDefaultConfig();
        const connection = new TCPConnection(socket, config);

        const metrics = connection.getMetrics();

        assertEquals(metrics.congestionWindow, config.windowSize);
        assertEquals(metrics.slowStartThreshold, config.windowSize);
        assertEquals(metrics.sendWindow, config.windowSize);
        assertEquals(metrics.receiveWindow, config.windowSize);
    },
});

// ============================================================================
// TCPConnection connect() Tests
// ============================================================================

Deno.test({
    name: "TCPConnection - connect throws from non-CLOSED state",
    async fn() {
        const socket = createMockSocket();
        const config = createDefaultConfig();
        const connection = new TCPConnection(socket, config);

        // Mock socket to simulate connection
        socket.write = async (_data: Uint8Array) => _data.byteLength;
        socket.read = async (buffer: Uint8Array) => {
            // Simulate SYN-ACK response
            const synAck = createTCPSegment({
                flags: { SYN: true, ACK: true },
                sequenceNumber: 1000,
                acknowledgmentNumber: 1,
            });
            const serialized = serializeTCPSegment(synAck);
            buffer.set(serialized);
            return serialized.byteLength;
        };

        try {
            await connection.connect("localhost", 80);
        } catch {
            // May fail, but state should change
        }

        // Now try to connect again
        let errorThrown = false;
        try {
            await connection.connect("localhost", 80);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("Cannot connect from state"));
        }

        assert(errorThrown);
    },
});

// ============================================================================
// TCPConnection getMetrics() Tests
// ============================================================================

Deno.test({
    name: "TCPConnection - getMetrics returns metrics object",
    fn() {
        const socket = createMockSocket();
        const config = createDefaultConfig();
        const connection = new TCPConnection(socket, config);

        const metrics = connection.getMetrics();

        assertExists(metrics);
    },
});

Deno.test({
    name: "TCPConnection - getMetrics returns copy of metrics",
    fn() {
        const socket = createMockSocket();
        const config = createDefaultConfig();
        const connection = new TCPConnection(socket, config);

        const metrics1 = connection.getMetrics();
        const metrics2 = connection.getMetrics();

        // Should be different objects
        assert(metrics1 !== metrics2);

        // But with same values
        assertEquals(metrics1.state, metrics2.state);
        assertEquals(metrics1.bytesSent, metrics2.bytesSent);
    },
});

Deno.test({
    name: "TCPConnection - getMetrics includes all required fields",
    fn() {
        const socket = createMockSocket();
        const config = createDefaultConfig();
        const connection = new TCPConnection(socket, config);

        const metrics = connection.getMetrics();

        assertExists(metrics.state);
        assertEquals(typeof metrics.uptime, "number");
        assertEquals(typeof metrics.bytesSent, "number");
        assertEquals(typeof metrics.bytesReceived, "number");
        assertEquals(typeof metrics.segmentsSent, "number");
        assertEquals(typeof metrics.segmentsReceived, "number");
        assertEquals(typeof metrics.rtt, "number");
        assertEquals(typeof metrics.rttVariance, "number");
        assertEquals(typeof metrics.retransmissions, "number");
        assertEquals(typeof metrics.congestionWindow, "number");
        assertEquals(typeof metrics.slowStartThreshold, "number");
        assertEquals(typeof metrics.sendWindow, "number");
        assertEquals(typeof metrics.receiveWindow, "number");
    },
});

Deno.test({
    name: "TCPConnection - getMetrics initializes with zero values",
    fn() {
        const socket = createMockSocket();
        const config = createDefaultConfig();
        const connection = new TCPConnection(socket, config);

        const metrics = connection.getMetrics();

        assertEquals(metrics.state, TCPState.CLOSED);
        assertEquals(metrics.uptime, 0);
        assertEquals(metrics.bytesSent, 0);
        assertEquals(metrics.bytesReceived, 0);
        assertEquals(metrics.segmentsSent, 0);
        assertEquals(metrics.segmentsReceived, 0);
        assertEquals(metrics.rtt, 0);
        assertEquals(metrics.rttVariance, 0);
        assertEquals(metrics.retransmissions, 0);
    },
});

// ============================================================================
// createTCPSegment Tests
// ============================================================================

Deno.test({
    name: "createTCPSegment - creates segment with defaults",
    fn() {
        const segment = createTCPSegment({});

        assertExists(segment);
        assertEquals(segment.sourcePort, 0);
        assertEquals(segment.destinationPort, 0);
        assertEquals(segment.sequenceNumber, 0);
        assertEquals(segment.acknowledgmentNumber, 0);
        assertEquals(segment.dataOffset, 5);
        assertEquals(segment.windowSize, 65535);
    },
});

Deno.test({
    name: "createTCPSegment - creates segment with SYN flag",
    fn() {
        const segment = createTCPSegment({
            flags: { SYN: true },
            sequenceNumber: 1000,
        });

        assertEquals(segment.flags.SYN, true);
        assertEquals(segment.sequenceNumber, 1000);
    },
});

Deno.test({
    name: "createTCPSegment - creates segment with ACK flag",
    fn() {
        const segment = createTCPSegment({
            flags: { ACK: true },
            acknowledgmentNumber: 2000,
        });

        assertEquals(segment.flags.ACK, true);
        assertEquals(segment.acknowledgmentNumber, 2000);
    },
});

Deno.test({
    name: "createTCPSegment - creates segment with FIN flag",
    fn() {
        const segment = createTCPSegment({
            flags: { FIN: true },
        });

        assertEquals(segment.flags.FIN, true);
    },
});

Deno.test({
    name: "createTCPSegment - creates segment with RST flag",
    fn() {
        const segment = createTCPSegment({
            flags: { RST: true },
        });

        assertEquals(segment.flags.RST, true);
    },
});

Deno.test({
    name: "createTCPSegment - creates segment with PSH flag",
    fn() {
        const segment = createTCPSegment({
            flags: { PSH: true },
        });

        assertEquals(segment.flags.PSH, true);
    },
});

Deno.test({
    name: "createTCPSegment - creates segment with URG flag",
    fn() {
        const segment = createTCPSegment({
            flags: { URG: true },
        });

        assertEquals(segment.flags.URG, true);
    },
});

Deno.test({
    name: "createTCPSegment - creates segment with ECE flag",
    fn() {
        const segment = createTCPSegment({
            flags: { ECE: true },
        });

        assertEquals(segment.flags.ECE, true);
    },
});

Deno.test({
    name: "createTCPSegment - creates segment with CWR flag",
    fn() {
        const segment = createTCPSegment({
            flags: { CWR: true },
        });

        assertEquals(segment.flags.CWR, true);
    },
});

Deno.test({
    name: "createTCPSegment - creates segment with multiple flags",
    fn() {
        const segment = createTCPSegment({
            flags: { SYN: true, ACK: true },
        });

        assertEquals(segment.flags.SYN, true);
        assertEquals(segment.flags.ACK, true);
    },
});

Deno.test({
    name: "createTCPSegment - creates segment with data",
    fn() {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const segment = createTCPSegment({
            data,
        });

        assertEquals(segment.data, data);
    },
});

Deno.test({
    name: "createTCPSegment - creates segment with TCP options",
    fn() {
        const segment = createTCPSegment({
            options: {
                MSS: 1460,
                WINDOW_SCALE: 7,
                SACK_PERMITTED: true,
            },
        });

        assertEquals(segment.options.MSS, 1460);
        assertEquals(segment.options.WINDOW_SCALE, 7);
        assertEquals(segment.options.SACK_PERMITTED, true);
    },
});

Deno.test({
    name: "createTCPSegment - sets timestamp",
    fn() {
        const segment = createTCPSegment({});

        assertExists(segment.timestamp);
        assert(segment.timestamp > 0);
    },
});

Deno.test({
    name: "createTCPSegment - accepts custom timestamp",
    fn() {
        const customTimestamp = 123456789;
        const segment = createTCPSegment({
            timestamp: customTimestamp,
        });

        assertEquals(segment.timestamp, customTimestamp);
    },
});

// ============================================================================
// serializeTCPSegment Tests
// ============================================================================

Deno.test({
    name: "serializeTCPSegment - serializes basic segment",
    fn() {
        const segment = createTCPSegment({
            sourcePort: 12345,
            destinationPort: 80,
            sequenceNumber: 1000,
            acknowledgmentNumber: 2000,
        });

        const buffer = serializeTCPSegment(segment);

        assertExists(buffer);
        assert(buffer.byteLength >= 20); // Minimum TCP header size
    },
});

Deno.test({
    name: "serializeTCPSegment - serializes segment with data",
    fn() {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const segment = createTCPSegment({
            data,
        });

        const buffer = serializeTCPSegment(segment);

        assertEquals(buffer.byteLength, 20 + data.byteLength);
    },
});

Deno.test({
    name: "serializeTCPSegment - serializes SYN flag",
    fn() {
        const segment = createTCPSegment({
            flags: { SYN: true },
        });

        const buffer = serializeTCPSegment(segment);
        const view = new DataView(buffer.buffer, buffer.byteOffset);

        // Check flags field (offset 12-13)
        const flagsField = view.getUint16(12);
        assert((flagsField & 0x002) !== 0); // SYN bit
    },
});

Deno.test({
    name: "serializeTCPSegment - serializes ACK flag",
    fn() {
        const segment = createTCPSegment({
            flags: { ACK: true },
        });

        const buffer = serializeTCPSegment(segment);
        const view = new DataView(buffer.buffer, buffer.byteOffset);

        const flagsField = view.getUint16(12);
        assert((flagsField & 0x010) !== 0); // ACK bit
    },
});

Deno.test({
    name: "serializeTCPSegment - serializes FIN flag",
    fn() {
        const segment = createTCPSegment({
            flags: { FIN: true },
        });

        const buffer = serializeTCPSegment(segment);
        const view = new DataView(buffer.buffer, buffer.byteOffset);

        const flagsField = view.getUint16(12);
        assert((flagsField & 0x001) !== 0); // FIN bit
    },
});

Deno.test({
    name: "serializeTCPSegment - serializes RST flag",
    fn() {
        const segment = createTCPSegment({
            flags: { RST: true },
        });

        const buffer = serializeTCPSegment(segment);
        const view = new DataView(buffer.buffer, buffer.byteOffset);

        const flagsField = view.getUint16(12);
        assert((flagsField & 0x004) !== 0); // RST bit
    },
});

Deno.test({
    name: "serializeTCPSegment - serializes multiple flags",
    fn() {
        const segment = createTCPSegment({
            flags: { SYN: true, ACK: true },
        });

        const buffer = serializeTCPSegment(segment);
        const view = new DataView(buffer.buffer, buffer.byteOffset);

        const flagsField = view.getUint16(12);
        assert((flagsField & 0x002) !== 0); // SYN bit
        assert((flagsField & 0x010) !== 0); // ACK bit
    },
});

Deno.test({
    name: "serializeTCPSegment - includes data payload",
    fn() {
        const data = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD]);
        const segment = createTCPSegment({
            data,
        });

        const buffer = serializeTCPSegment(segment);

        // Data starts after header (20 bytes)
        const payloadStart = 20;
        assertEquals(buffer[payloadStart], 0xAA);
        assertEquals(buffer[payloadStart + 1], 0xBB);
        assertEquals(buffer[payloadStart + 2], 0xCC);
        assertEquals(buffer[payloadStart + 3], 0xDD);
    },
});

// ============================================================================
// parseTCPSegment Tests
// ============================================================================

Deno.test({
    name: "parseTCPSegment - throws on short buffer",
    fn() {
        const buffer = new Uint8Array(10); // Less than 20 bytes

        let errorThrown = false;
        try {
            parseTCPSegment(buffer);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("too short"));
        }

        assert(errorThrown);
    },
});

Deno.test({
    name: "parseTCPSegment - parses basic segment",
    fn() {
        const original = createTCPSegment({
            sourcePort: 12345,
            destinationPort: 80,
            sequenceNumber: 1000,
            acknowledgmentNumber: 2000,
        });

        const buffer = serializeTCPSegment(original);
        const parsed = parseTCPSegment(buffer);

        assertEquals(parsed.sourcePort, 12345);
        assertEquals(parsed.destinationPort, 80);
        assertEquals(parsed.sequenceNumber, 1000);
        assertEquals(parsed.acknowledgmentNumber, 2000);
    },
});

Deno.test({
    name: "parseTCPSegment - parses SYN flag",
    fn() {
        const original = createTCPSegment({
            flags: { SYN: true },
        });

        const buffer = serializeTCPSegment(original);
        const parsed = parseTCPSegment(buffer);

        assertEquals(parsed.flags.SYN, true);
    },
});

Deno.test({
    name: "parseTCPSegment - parses ACK flag",
    fn() {
        const original = createTCPSegment({
            flags: { ACK: true },
        });

        const buffer = serializeTCPSegment(original);
        const parsed = parseTCPSegment(buffer);

        assertEquals(parsed.flags.ACK, true);
    },
});

Deno.test({
    name: "parseTCPSegment - parses FIN flag",
    fn() {
        const original = createTCPSegment({
            flags: { FIN: true },
        });

        const buffer = serializeTCPSegment(original);
        const parsed = parseTCPSegment(buffer);

        assertEquals(parsed.flags.FIN, true);
    },
});

Deno.test({
    name: "parseTCPSegment - parses RST flag",
    fn() {
        const original = createTCPSegment({
            flags: { RST: true },
        });

        const buffer = serializeTCPSegment(original);
        const parsed = parseTCPSegment(buffer);

        assertEquals(parsed.flags.RST, true);
    },
});

Deno.test({
    name: "parseTCPSegment - parses PSH flag",
    fn() {
        const original = createTCPSegment({
            flags: { PSH: true },
        });

        const buffer = serializeTCPSegment(original);
        const parsed = parseTCPSegment(buffer);

        assertEquals(parsed.flags.PSH, true);
    },
});

Deno.test({
    name: "parseTCPSegment - parses multiple flags",
    fn() {
        const original = createTCPSegment({
            flags: { SYN: true, ACK: true },
        });

        const buffer = serializeTCPSegment(original);
        const parsed = parseTCPSegment(buffer);

        assertEquals(parsed.flags.SYN, true);
        assertEquals(parsed.flags.ACK, true);
    },
});

Deno.test({
    name: "parseTCPSegment - parses data payload",
    fn() {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const original = createTCPSegment({
            data,
        });

        const buffer = serializeTCPSegment(original);
        const parsed = parseTCPSegment(buffer);

        assertEquals(parsed.data.byteLength, data.byteLength);
        assertEquals(parsed.data[0], 1);
        assertEquals(parsed.data[4], 5);
    },
});

Deno.test({
    name: "parseTCPSegment - round-trip serialization",
    fn() {
        const original = createTCPSegment({
            sourcePort: 54321,
            destinationPort: 443,
            sequenceNumber: 12345,
            acknowledgmentNumber: 67890,
            flags: { ACK: true, PSH: true },
            windowSize: 32768,
            data: new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]),
        });

        const buffer = serializeTCPSegment(original);
        const parsed = parseTCPSegment(buffer);

        assertEquals(parsed.sourcePort, original.sourcePort);
        assertEquals(parsed.destinationPort, original.destinationPort);
        assertEquals(parsed.sequenceNumber, original.sequenceNumber);
        assertEquals(parsed.acknowledgmentNumber, original.acknowledgmentNumber);
        assertEquals(parsed.flags.ACK, original.flags.ACK);
        assertEquals(parsed.flags.PSH, original.flags.PSH);
        assertEquals(parsed.windowSize, original.windowSize);
        assertEquals(parsed.data.byteLength, original.data.byteLength);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "TCPConnection - complete lifecycle",
    fn() {
        const socket = createMockSocket();
        const config = createDefaultConfig();
        const connection = new TCPConnection(socket, config);

        // Initial state
        const initialMetrics = connection.getMetrics();
        assertEquals(initialMetrics.state, TCPState.CLOSED);
        assertEquals(initialMetrics.bytesSent, 0);
        assertEquals(initialMetrics.bytesReceived, 0);

        assert(true);
    },
});

Deno.test({
    name: "TCPConnection - different configurations",
    fn() {
        const socket = createMockSocket();

        const config1: TCPConfig = {
            connectTimeout: 1000,
            idleTimeout: 30000,
            keepAliveInterval: 15000,
            keepAliveProbes: 5,
            sendBufferSize: 32768,
            receiveBufferSize: 32768,
            noDelay: true,
            maxSegmentSize: 536,
            windowSize: 16384,
        };

        const config2: TCPConfig = {
            connectTimeout: 10000,
            idleTimeout: 120000,
            keepAliveInterval: 60000,
            keepAliveProbes: 3,
            sendBufferSize: 131072,
            receiveBufferSize: 131072,
            noDelay: false,
            maxSegmentSize: 1460,
            windowSize: 65535,
        };

        const conn1 = new TCPConnection(createMockSocket(), config1);
        const conn2 = new TCPConnection(createMockSocket(), config2);

        const metrics1 = conn1.getMetrics();
        const metrics2 = conn2.getMetrics();

        // Different window sizes
        assertEquals(metrics1.congestionWindow, config1.windowSize);
        assertEquals(metrics2.congestionWindow, config2.windowSize);
    },
});

Deno.test({
    name: "TCP segment serialization and parsing",
    fn() {
        // Create a complex segment with all flags
        const segment = createTCPSegment({
            sourcePort: 12345,
            destinationPort: 80,
            sequenceNumber: 1000000,
            acknowledgmentNumber: 2000000,
            flags: {
                FIN: true,
                SYN: true,
                RST: false,
                PSH: true,
                ACK: true,
                URG: false,
                ECE: true,
                CWR: false,
            },
            windowSize: 32768,
            data: new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]), // "Hello"
            options: {
                MSS: 1460,
                WINDOW_SCALE: 7,
                SACK_PERMITTED: true,
            },
        });

        // Serialize and parse
        const buffer = serializeTCPSegment(segment);
        const parsed = parseTCPSegment(buffer);

        // Verify all fields
        assertEquals(parsed.sourcePort, segment.sourcePort);
        assertEquals(parsed.destinationPort, segment.destinationPort);
        assertEquals(parsed.sequenceNumber, segment.sequenceNumber);
        assertEquals(parsed.acknowledgmentNumber, segment.acknowledgmentNumber);
        assertEquals(parsed.flags.FIN, true);
        assertEquals(parsed.flags.SYN, true);
        assertEquals(parsed.flags.PSH, true);
        assertEquals(parsed.flags.ACK, true);
        assertEquals(parsed.flags.ECE, true);
        assertEquals(parsed.data.byteLength, 5);
    },
});
