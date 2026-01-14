/**
 * HTTP3Connection Tests
 *
 * Comprehensive tests for HTTP/3 connection implementation.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    HTTP3Connection,
    HTTP3FrameType,
    HTTP3Setting,
    HTTP3ErrorCode,
    HTTP3StreamType,
    type HTTP3Frame,
} from "../../../../src/engine/network/protocols/HTTP3Connection.ts";

// ============================================================================
// HTTP3FrameType Enum Tests
// ============================================================================

Deno.test({
    name: "HTTP3FrameType - has DATA",
    fn() {
        assertEquals(HTTP3FrameType.DATA, 0x00);
    },
});

Deno.test({
    name: "HTTP3FrameType - has HEADERS",
    fn() {
        assertEquals(HTTP3FrameType.HEADERS, 0x01);
    },
});

Deno.test({
    name: "HTTP3FrameType - has CANCEL_PUSH",
    fn() {
        assertEquals(HTTP3FrameType.CANCEL_PUSH, 0x03);
    },
});

Deno.test({
    name: "HTTP3FrameType - has SETTINGS",
    fn() {
        assertEquals(HTTP3FrameType.SETTINGS, 0x04);
    },
});

Deno.test({
    name: "HTTP3FrameType - has PUSH_PROMISE",
    fn() {
        assertEquals(HTTP3FrameType.PUSH_PROMISE, 0x05);
    },
});

Deno.test({
    name: "HTTP3FrameType - has GOAWAY",
    fn() {
        assertEquals(HTTP3FrameType.GOAWAY, 0x07);
    },
});

Deno.test({
    name: "HTTP3FrameType - has MAX_PUSH_ID",
    fn() {
        assertEquals(HTTP3FrameType.MAX_PUSH_ID, 0x0d);
    },
});

// ============================================================================
// HTTP3Setting Enum Tests
// ============================================================================

Deno.test({
    name: "HTTP3Setting - has QPACK_MAX_TABLE_CAPACITY",
    fn() {
        assertEquals(HTTP3Setting.QPACK_MAX_TABLE_CAPACITY, 0x01);
    },
});

Deno.test({
    name: "HTTP3Setting - has MAX_FIELD_SECTION_SIZE",
    fn() {
        assertEquals(HTTP3Setting.MAX_FIELD_SECTION_SIZE, 0x06);
    },
});

Deno.test({
    name: "HTTP3Setting - has QPACK_BLOCKED_STREAMS",
    fn() {
        assertEquals(HTTP3Setting.QPACK_BLOCKED_STREAMS, 0x07);
    },
});

// ============================================================================
// HTTP3ErrorCode Enum Tests
// ============================================================================

Deno.test({
    name: "HTTP3ErrorCode - has NO_ERROR",
    fn() {
        assertEquals(HTTP3ErrorCode.NO_ERROR, 0x100);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has GENERAL_PROTOCOL_ERROR",
    fn() {
        assertEquals(HTTP3ErrorCode.GENERAL_PROTOCOL_ERROR, 0x101);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has INTERNAL_ERROR",
    fn() {
        assertEquals(HTTP3ErrorCode.INTERNAL_ERROR, 0x102);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has STREAM_CREATION_ERROR",
    fn() {
        assertEquals(HTTP3ErrorCode.STREAM_CREATION_ERROR, 0x103);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has CLOSED_CRITICAL_STREAM",
    fn() {
        assertEquals(HTTP3ErrorCode.CLOSED_CRITICAL_STREAM, 0x104);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has FRAME_UNEXPECTED",
    fn() {
        assertEquals(HTTP3ErrorCode.FRAME_UNEXPECTED, 0x105);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has FRAME_ERROR",
    fn() {
        assertEquals(HTTP3ErrorCode.FRAME_ERROR, 0x106);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has EXCESSIVE_LOAD",
    fn() {
        assertEquals(HTTP3ErrorCode.EXCESSIVE_LOAD, 0x107);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has ID_ERROR",
    fn() {
        assertEquals(HTTP3ErrorCode.ID_ERROR, 0x108);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has SETTINGS_ERROR",
    fn() {
        assertEquals(HTTP3ErrorCode.SETTINGS_ERROR, 0x109);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has MISSING_SETTINGS",
    fn() {
        assertEquals(HTTP3ErrorCode.MISSING_SETTINGS, 0x10a);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has REQUEST_REJECTED",
    fn() {
        assertEquals(HTTP3ErrorCode.REQUEST_REJECTED, 0x10b);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has REQUEST_CANCELLED",
    fn() {
        assertEquals(HTTP3ErrorCode.REQUEST_CANCELLED, 0x10c);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has REQUEST_INCOMPLETE",
    fn() {
        assertEquals(HTTP3ErrorCode.REQUEST_INCOMPLETE, 0x10d);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has MESSAGE_ERROR",
    fn() {
        assertEquals(HTTP3ErrorCode.MESSAGE_ERROR, 0x10e);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has CONNECT_ERROR",
    fn() {
        assertEquals(HTTP3ErrorCode.CONNECT_ERROR, 0x10f);
    },
});

Deno.test({
    name: "HTTP3ErrorCode - has VERSION_FALLBACK",
    fn() {
        assertEquals(HTTP3ErrorCode.VERSION_FALLBACK, 0x110);
    },
});

// ============================================================================
// HTTP3StreamType Enum Tests
// ============================================================================

Deno.test({
    name: "HTTP3StreamType - has CONTROL",
    fn() {
        assertEquals(HTTP3StreamType.CONTROL, 0x00);
    },
});

Deno.test({
    name: "HTTP3StreamType - has PUSH",
    fn() {
        assertEquals(HTTP3StreamType.PUSH, 0x01);
    },
});

Deno.test({
    name: "HTTP3StreamType - has QPACK_ENCODER",
    fn() {
        assertEquals(HTTP3StreamType.QPACK_ENCODER, 0x02);
    },
});

Deno.test({
    name: "HTTP3StreamType - has QPACK_DECODER",
    fn() {
        assertEquals(HTTP3StreamType.QPACK_DECODER, 0x03);
    },
});

// ============================================================================
// HTTP3Connection Constructor Tests
// ============================================================================

Deno.test({
    name: "HTTP3Connection - constructor creates connection",
    fn() {
        const connection = new HTTP3Connection();

        assertExists(connection);
    },
});

Deno.test({
    name: "HTTP3Connection - constructor initializes default settings",
    fn() {
        const connection = new HTTP3Connection();

        const stats = connection.getStats();

        assertExists(stats.settings.get(HTTP3Setting.QPACK_MAX_TABLE_CAPACITY));
        assertExists(stats.settings.get(HTTP3Setting.MAX_FIELD_SECTION_SIZE));
        assertExists(stats.settings.get(HTTP3Setting.QPACK_BLOCKED_STREAMS));
    },
});

Deno.test({
    name: "HTTP3Connection - constructor sets default QPACK table size",
    fn() {
        const connection = new HTTP3Connection();

        const stats = connection.getStats();

        assertEquals(stats.settings.get(HTTP3Setting.QPACK_MAX_TABLE_CAPACITY), 4096);
    },
});

Deno.test({
    name: "HTTP3Connection - constructor sets default field section size",
    fn() {
        const connection = new HTTP3Connection();

        const stats = connection.getStats();

        assertEquals(stats.settings.get(HTTP3Setting.MAX_FIELD_SECTION_SIZE), 16384);
    },
});

Deno.test({
    name: "HTTP3Connection - constructor sets default blocked streams",
    fn() {
        const connection = new HTTP3Connection();

        const stats = connection.getStats();

        assertEquals(stats.settings.get(HTTP3Setting.QPACK_BLOCKED_STREAMS), 100);
    },
});

// ============================================================================
// HTTP3Connection Variable-Length Integer Tests
// ============================================================================

Deno.test({
    name: "HTTP3 - encodeVarint encodes 6-bit values",
    fn() {
        const connection = new HTTP3Connection();

        // Access private method through any cast
        const encoded = (connection as any).encodeVarint(0);
        assertEquals(encoded.byteLength, 1);
        assertEquals(encoded[0], 0);

        const encoded2 = (connection as any).encodeVarint(63);
        assertEquals(encoded2.byteLength, 1);
        assertEquals(encoded2[0], 63);
    },
});

Deno.test({
    name: "HTTP3 - encodeVarint encodes 14-bit values",
    fn() {
        const connection = new HTTP3Connection();

        const encoded = (connection as any).encodeVarint(64);
        assertEquals(encoded.byteLength, 2);
        assertEquals(encoded[0] & 0xc0, 0x40); // Prefix should be 01

        const encoded2 = (connection as any).encodeVarint(16383);
        assertEquals(encoded2.byteLength, 2);
    },
});

Deno.test({
    name: "HTTP3 - encodeVarint encodes 30-bit values",
    fn() {
        const connection = new HTTP3Connection();

        const encoded = (connection as any).encodeVarint(16384);
        assertEquals(encoded.byteLength, 4);
        assertEquals(encoded[0] & 0xc0, 0x80); // Prefix should be 10
    },
});

Deno.test({
    name: "HTTP3 - encodeVarint encodes 62-bit values",
    fn() {
        const connection = new HTTP3Connection();

        const encoded = (connection as any).encodeVarint(1073741824);
        assertEquals(encoded.byteLength, 8);
        assertEquals(encoded[0] & 0xc0, 0xc0); // Prefix should be 11
    },
});

Deno.test({
    name: "HTTP3 - decodeVarint decodes 6-bit values",
    fn() {
        const connection = new HTTP3Connection();

        const data = new Uint8Array([42]);
        const { value, bytesRead } = (connection as any).decodeVarint(data, 0);

        assertEquals(value, 42);
        assertEquals(bytesRead, 1);
    },
});

Deno.test({
    name: "HTTP3 - decodeVarint decodes 14-bit values",
    fn() {
        const connection = new HTTP3Connection();

        // Encode 1000 as 14-bit: 0x43 0xE8
        const data = new Uint8Array([0x43, 0xE8]);
        const { value, bytesRead } = (connection as any).decodeVarint(data, 0);

        assertEquals(value, 1000);
        assertEquals(bytesRead, 2);
    },
});

Deno.test({
    name: "HTTP3 - decodeVarint decodes 30-bit values",
    fn() {
        const connection = new HTTP3Connection();

        // Encode 100000 as 30-bit
        const encoded = (connection as any).encodeVarint(100000);
        const { value, bytesRead } = (connection as any).decodeVarint(encoded, 0);

        assertEquals(value, 100000);
        assertEquals(bytesRead, 4);
    },
});

Deno.test({
    name: "HTTP3 - varint round-trip for small values",
    fn() {
        const connection = new HTTP3Connection();

        const testValues = [0, 1, 10, 63];

        for (const original of testValues) {
            const encoded = (connection as any).encodeVarint(original);
            const { value } = (connection as any).decodeVarint(encoded, 0);
            assertEquals(value, original);
        }
    },
});

Deno.test({
    name: "HTTP3 - varint round-trip for medium values",
    fn() {
        const connection = new HTTP3Connection();

        const testValues = [64, 100, 1000, 16383];

        for (const original of testValues) {
            const encoded = (connection as any).encodeVarint(original);
            const { value } = (connection as any).decodeVarint(encoded, 0);
            assertEquals(value, original);
        }
    },
});

Deno.test({
    name: "HTTP3 - varint round-trip for large values",
    fn() {
        const connection = new HTTP3Connection();

        const testValues = [16384, 100000, 1000000];

        for (const original of testValues) {
            const encoded = (connection as any).encodeVarint(original);
            const { value } = (connection as any).decodeVarint(encoded, 0);
            assertEquals(value, original);
        }
    },
});

Deno.test({
    name: "HTTP3 - varint round-trip for very large values",
    fn() {
        const connection = new HTTP3Connection();

        const testValues = [1073741824, 2147483647];

        for (const original of testValues) {
            const encoded = (connection as any).encodeVarint(original);
            const { value } = (connection as any).decodeVarint(encoded, 0);
            assertEquals(value, original);
        }
    },
});

Deno.test({
    name: "HTTP3 - decodeVarint handles incomplete data for 14-bit",
    fn() {
        const connection = new HTTP3Connection();

        // 14-bit encoding but only 1 byte
        const data = new Uint8Array([0x40]);
        const { value, bytesRead } = (connection as any).decodeVarint(data, 0);

        assertEquals(value, 0);
        assertEquals(bytesRead, 0);
    },
});

Deno.test({
    name: "HTTP3 - decodeVarint handles incomplete data for 30-bit",
    fn() {
        const connection = new HTTP3Connection();

        // 30-bit encoding but only 2 bytes
        const data = new Uint8Array([0x80, 0x00]);
        const { value, bytesRead } = (connection as any).decodeVarint(data, 0);

        assertEquals(value, 0);
        assertEquals(bytesRead, 0);
    },
});

Deno.test({
    name: "HTTP3 - decodeVarint handles empty buffer",
    fn() {
        const connection = new HTTP3Connection();

        const data = new Uint8Array([]);
        const { value, bytesRead } = (connection as any).decodeVarint(data, 0);

        assertEquals(value, 0);
        assertEquals(bytesRead, 0);
    },
});

// ============================================================================
// HTTP3Connection Frame Tests
// ============================================================================

Deno.test({
    name: "HTTP3 - buildFrame creates valid frame",
    fn() {
        const connection = new HTTP3Connection();

        const payload = new TextEncoder().encode("hello");
        const frame = (connection as any).buildFrame(HTTP3FrameType.DATA, payload);

        assertExists(frame);
        assert(frame instanceof Uint8Array);
        assert(frame.byteLength > payload.byteLength); // Frame header + payload
    },
});

Deno.test({
    name: "HTTP3 - buildFrame with empty payload",
    fn() {
        const connection = new HTTP3Connection();

        const payload = new Uint8Array(0);
        const frame = (connection as any).buildFrame(HTTP3FrameType.SETTINGS, payload);

        assertExists(frame);
        assert(frame.byteLength >= 2); // At least type + length
    },
});

Deno.test({
    name: "HTTP3 - parseFrame parses valid frame",
    fn() {
        const connection = new HTTP3Connection();

        const payload = new TextEncoder().encode("test");
        const frameData = (connection as any).buildFrame(HTTP3FrameType.DATA, payload);

        const parsed = (connection as any).parseFrame(frameData);

        assertExists(parsed);
        assertEquals(parsed.type, HTTP3FrameType.DATA);
        assertEquals(parsed.length, payload.byteLength);
        assertEquals(new TextDecoder().decode(parsed.payload), "test");
    },
});

Deno.test({
    name: "HTTP3 - parseFrame handles incomplete frame",
    fn() {
        const connection = new HTTP3Connection();

        // Frame that says payload is 100 bytes but only has 5
        const incomplete = new Uint8Array([0x00, 0x64, 0x01, 0x02, 0x03, 0x04, 0x05]);

        const parsed = (connection as any).parseFrame(incomplete);

        assertEquals(parsed, null);
    },
});

Deno.test({
    name: "HTTP3 - parseFrame handles empty buffer",
    fn() {
        const connection = new HTTP3Connection();

        const empty = new Uint8Array([]);
        const parsed = (connection as any).parseFrame(empty);

        assertEquals(parsed, null);
    },
});

Deno.test({
    name: "HTTP3 - frame round-trip for DATA",
    fn() {
        const connection = new HTTP3Connection();

        const payload = new TextEncoder().encode("test data");
        const frame = (connection as any).buildFrame(HTTP3FrameType.DATA, payload);
        const parsed = (connection as any).parseFrame(frame);

        assertEquals(parsed.type, HTTP3FrameType.DATA);
        assertEquals(new TextDecoder().decode(parsed.payload), "test data");
    },
});

Deno.test({
    name: "HTTP3 - frame round-trip for HEADERS",
    fn() {
        const connection = new HTTP3Connection();

        const payload = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
        const frame = (connection as any).buildFrame(HTTP3FrameType.HEADERS, payload);
        const parsed = (connection as any).parseFrame(frame);

        assertEquals(parsed.type, HTTP3FrameType.HEADERS);
        assertEquals(parsed.payload.byteLength, 4);
    },
});

Deno.test({
    name: "HTTP3 - frame round-trip for SETTINGS",
    fn() {
        const connection = new HTTP3Connection();

        const payload = new Uint8Array([0x01, 0x00, 0x10, 0x00]);
        const frame = (connection as any).buildFrame(HTTP3FrameType.SETTINGS, payload);
        const parsed = (connection as any).parseFrame(frame);

        assertEquals(parsed.type, HTTP3FrameType.SETTINGS);
    },
});

Deno.test({
    name: "HTTP3 - frame round-trip with large payload",
    fn() {
        const connection = new HTTP3Connection();

        const payload = new Uint8Array(10000);
        payload.fill(0x42);

        const frame = (connection as any).buildFrame(HTTP3FrameType.DATA, payload);
        const parsed = (connection as any).parseFrame(frame);

        assertEquals(parsed.type, HTTP3FrameType.DATA);
        assertEquals(parsed.length, 10000);
        assertEquals(parsed.payload[0], 0x42);
    },
});

// ============================================================================
// HTTP3Connection getStats() Tests
// ============================================================================

Deno.test({
    name: "HTTP3Connection - getStats returns statistics",
    fn() {
        const connection = new HTTP3Connection();

        const stats = connection.getStats();

        assertExists(stats);
        assertExists(stats.activeStreams);
        assertExists(stats.settings);
        assertExists(stats.quicStats);
    },
});

Deno.test({
    name: "HTTP3Connection - getStats returns active stream count",
    fn() {
        const connection = new HTTP3Connection();

        const stats = connection.getStats();

        assertEquals(typeof stats.activeStreams, "number");
        assertEquals(stats.activeStreams, 0);
    },
});

Deno.test({
    name: "HTTP3Connection - getStats returns settings copy",
    fn() {
        const connection = new HTTP3Connection();

        const stats = connection.getStats();

        assert(stats.settings instanceof Map);
        assert(stats.settings.size > 0);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "HTTP3 - all frame types defined",
    fn() {
        const frameTypes = [
            HTTP3FrameType.DATA,
            HTTP3FrameType.HEADERS,
            HTTP3FrameType.CANCEL_PUSH,
            HTTP3FrameType.SETTINGS,
            HTTP3FrameType.PUSH_PROMISE,
            HTTP3FrameType.GOAWAY,
            HTTP3FrameType.MAX_PUSH_ID,
        ];

        // Verify all are numbers
        for (const type of frameTypes) {
            assertEquals(typeof type, "number");
        }
    },
});

Deno.test({
    name: "HTTP3 - all error codes defined",
    fn() {
        const errorCodes = [
            HTTP3ErrorCode.NO_ERROR,
            HTTP3ErrorCode.GENERAL_PROTOCOL_ERROR,
            HTTP3ErrorCode.INTERNAL_ERROR,
            HTTP3ErrorCode.STREAM_CREATION_ERROR,
            HTTP3ErrorCode.CLOSED_CRITICAL_STREAM,
            HTTP3ErrorCode.FRAME_UNEXPECTED,
            HTTP3ErrorCode.FRAME_ERROR,
            HTTP3ErrorCode.EXCESSIVE_LOAD,
            HTTP3ErrorCode.ID_ERROR,
            HTTP3ErrorCode.SETTINGS_ERROR,
            HTTP3ErrorCode.MISSING_SETTINGS,
            HTTP3ErrorCode.REQUEST_REJECTED,
            HTTP3ErrorCode.REQUEST_CANCELLED,
            HTTP3ErrorCode.REQUEST_INCOMPLETE,
            HTTP3ErrorCode.MESSAGE_ERROR,
            HTTP3ErrorCode.CONNECT_ERROR,
            HTTP3ErrorCode.VERSION_FALLBACK,
        ];

        // Verify all are in 0x100 range
        for (const code of errorCodes) {
            assert(code >= 0x100 && code <= 0x110);
        }
    },
});

Deno.test({
    name: "HTTP3 - varint encoding boundary values",
    fn() {
        const connection = new HTTP3Connection();

        // Test boundary values
        const boundaries = [
            0,      // Min 6-bit
            63,     // Max 6-bit
            64,     // Min 14-bit
            16383,  // Max 14-bit
            16384,  // Min 30-bit
            1073741823, // Max 30-bit
            1073741824, // Min 62-bit
        ];

        for (const value of boundaries) {
            const encoded = (connection as any).encodeVarint(value);
            const { value: decoded } = (connection as any).decodeVarint(encoded, 0);
            assertEquals(decoded, value, `Failed for value ${value}`);
        }
    },
});

Deno.test({
    name: "HTTP3 - multiple frames in sequence",
    fn() {
        const connection = new HTTP3Connection();

        const frames = [
            { type: HTTP3FrameType.HEADERS, payload: new Uint8Array([1, 2, 3]) },
            { type: HTTP3FrameType.DATA, payload: new TextEncoder().encode("body") },
            { type: HTTP3FrameType.DATA, payload: new TextEncoder().encode("more") },
        ];

        for (const { type, payload } of frames) {
            const built = (connection as any).buildFrame(type, payload);
            const parsed = (connection as any).parseFrame(built);

            assertEquals(parsed.type, type);
            assertEquals(parsed.payload.byteLength, payload.byteLength);
        }
    },
});

Deno.test({
    name: "HTTP3 - settings encoding",
    fn() {
        const connection = new HTTP3Connection();

        const stats = connection.getStats();

        // Verify default settings
        assert(stats.settings.has(HTTP3Setting.QPACK_MAX_TABLE_CAPACITY));
        assert(stats.settings.has(HTTP3Setting.MAX_FIELD_SECTION_SIZE));
        assert(stats.settings.has(HTTP3Setting.QPACK_BLOCKED_STREAMS));

        // Values should be positive integers
        for (const value of stats.settings.values()) {
            assert(value > 0);
            assertEquals(typeof value, "number");
        }
    },
});

Deno.test({
    name: "HTTP3 - stream types for control streams",
    fn() {
        const streamTypes = [
            HTTP3StreamType.CONTROL,
            HTTP3StreamType.PUSH,
            HTTP3StreamType.QPACK_ENCODER,
            HTTP3StreamType.QPACK_DECODER,
        ];

        // Verify all are distinct and small numbers
        const uniqueTypes = new Set(streamTypes);
        assertEquals(uniqueTypes.size, 4);

        for (const type of streamTypes) {
            assert(type >= 0 && type <= 3);
        }
    },
});

Deno.test({
    name: "HTTP3 - varint with offset",
    fn() {
        const connection = new HTTP3Connection();

        // Create buffer with varint at offset 5
        const buffer = new Uint8Array(10);
        const encoded = (connection as any).encodeVarint(1000);
        buffer.set(encoded, 5);

        const { value, bytesRead } = (connection as any).decodeVarint(buffer, 5);

        assertEquals(value, 1000);
        assertEquals(bytesRead, 2);
    },
});

Deno.test({
    name: "HTTP3 - frame type values are correct",
    fn() {
        // Verify frame types match RFC 9114
        assertEquals(HTTP3FrameType.DATA, 0x00);
        assertEquals(HTTP3FrameType.HEADERS, 0x01);
        assertEquals(HTTP3FrameType.CANCEL_PUSH, 0x03);
        assertEquals(HTTP3FrameType.SETTINGS, 0x04);
        assertEquals(HTTP3FrameType.PUSH_PROMISE, 0x05);
        assertEquals(HTTP3FrameType.GOAWAY, 0x07);
        assertEquals(HTTP3FrameType.MAX_PUSH_ID, 0x0d);
    },
});

Deno.test({
    name: "HTTP3 - error code sequence",
    fn() {
        // Verify error codes are sequential from 0x100
        assertEquals(HTTP3ErrorCode.NO_ERROR, 0x100);
        assertEquals(HTTP3ErrorCode.GENERAL_PROTOCOL_ERROR, 0x101);
        assertEquals(HTTP3ErrorCode.INTERNAL_ERROR, 0x102);
        assertEquals(HTTP3ErrorCode.STREAM_CREATION_ERROR, 0x103);
        assertEquals(HTTP3ErrorCode.CLOSED_CRITICAL_STREAM, 0x104);
        assertEquals(HTTP3ErrorCode.FRAME_UNEXPECTED, 0x105);
        assertEquals(HTTP3ErrorCode.FRAME_ERROR, 0x106);
        assertEquals(HTTP3ErrorCode.EXCESSIVE_LOAD, 0x107);
        assertEquals(HTTP3ErrorCode.ID_ERROR, 0x108);
        assertEquals(HTTP3ErrorCode.SETTINGS_ERROR, 0x109);
        assertEquals(HTTP3ErrorCode.MISSING_SETTINGS, 0x10a);
        assertEquals(HTTP3ErrorCode.REQUEST_REJECTED, 0x10b);
        assertEquals(HTTP3ErrorCode.REQUEST_CANCELLED, 0x10c);
        assertEquals(HTTP3ErrorCode.REQUEST_INCOMPLETE, 0x10d);
        assertEquals(HTTP3ErrorCode.MESSAGE_ERROR, 0x10e);
        assertEquals(HTTP3ErrorCode.CONNECT_ERROR, 0x10f);
        assertEquals(HTTP3ErrorCode.VERSION_FALLBACK, 0x110);
    },
});
