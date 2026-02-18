/**
 * HTTP2Frames Tests
 */

import { assertEquals, assert } from "@std/assert";
import {
  HTTP2FrameType,
  HTTP2FrameFlags,
  HTTP2ErrorCode,
  HTTP2SettingsParameter,
  HTTP2FrameParser,
  HTTP2_PREFACE,
  HTTP2_DEFAULT_SETTINGS,
} from "../../../../../core/network/transport/http/http2_frames.ts";

// ============================================================================
// HTTP2FrameType enum
// ============================================================================

Deno.test({
  name: "HTTP2FrameType - has all required frame types",
  fn() {
    assertEquals(HTTP2FrameType.DATA, 0x0);
    assertEquals(HTTP2FrameType.HEADERS, 0x1);
    assertEquals(HTTP2FrameType.PRIORITY, 0x2);
    assertEquals(HTTP2FrameType.RST_STREAM, 0x3);
    assertEquals(HTTP2FrameType.SETTINGS, 0x4);
    assertEquals(HTTP2FrameType.PUSH_PROMISE, 0x5);
    assertEquals(HTTP2FrameType.PING, 0x6);
    assertEquals(HTTP2FrameType.GOAWAY, 0x7);
    assertEquals(HTTP2FrameType.WINDOW_UPDATE, 0x8);
    assertEquals(HTTP2FrameType.CONTINUATION, 0x9);
  },
});

// ============================================================================
// HTTP2FrameFlags enum
// ============================================================================

Deno.test({
  name: "HTTP2FrameFlags - has expected flag values",
  fn() {
    assertEquals(HTTP2FrameFlags.NONE, 0x0);
    assertEquals(HTTP2FrameFlags.END_STREAM, 0x1);
    assertEquals(HTTP2FrameFlags.END_HEADERS, 0x4);
    assertEquals(HTTP2FrameFlags.PADDED, 0x8);
    assertEquals(HTTP2FrameFlags.ACK, 0x1);
  },
});

// ============================================================================
// HTTP2ErrorCode enum
// ============================================================================

Deno.test({
  name: "HTTP2ErrorCode - has all required error codes",
  fn() {
    assertEquals(HTTP2ErrorCode.NO_ERROR, 0x0);
    assertEquals(HTTP2ErrorCode.PROTOCOL_ERROR, 0x1);
    assertEquals(HTTP2ErrorCode.INTERNAL_ERROR, 0x2);
    assertEquals(HTTP2ErrorCode.FLOW_CONTROL_ERROR, 0x3);
    assertEquals(HTTP2ErrorCode.SETTINGS_TIMEOUT, 0x4);
    assertEquals(HTTP2ErrorCode.STREAM_CLOSED, 0x5);
    assertEquals(HTTP2ErrorCode.FRAME_SIZE_ERROR, 0x6);
    assertEquals(HTTP2ErrorCode.REFUSED_STREAM, 0x7);
    assertEquals(HTTP2ErrorCode.CANCEL, 0x8);
    assertEquals(HTTP2ErrorCode.COMPRESSION_ERROR, 0x9);
  },
});

// ============================================================================
// HTTP2SettingsParameter enum
// ============================================================================

Deno.test({
  name: "HTTP2SettingsParameter - has all required parameters",
  fn() {
    assertEquals(HTTP2SettingsParameter.HEADER_TABLE_SIZE, 0x1);
    assertEquals(HTTP2SettingsParameter.ENABLE_PUSH, 0x2);
    assertEquals(HTTP2SettingsParameter.MAX_CONCURRENT_STREAMS, 0x3);
    assertEquals(HTTP2SettingsParameter.INITIAL_WINDOW_SIZE, 0x4);
    assertEquals(HTTP2SettingsParameter.MAX_FRAME_SIZE, 0x5);
    assertEquals(HTTP2SettingsParameter.MAX_HEADER_LIST_SIZE, 0x6);
  },
});

// ============================================================================
// HTTP2_PREFACE constant
// ============================================================================

Deno.test({
  name: "HTTP2_PREFACE - is a Uint8Array",
  fn() {
    assert(HTTP2_PREFACE instanceof Uint8Array);
  },
});

Deno.test({
  name: "HTTP2_PREFACE - has correct length (24 bytes)",
  fn() {
    assertEquals(HTTP2_PREFACE.length, 24);
  },
});

Deno.test({
  name: "HTTP2_PREFACE - starts with PRI * HTTP/2.0",
  fn() {
    const decoder = new TextDecoder();
    const text = decoder.decode(HTTP2_PREFACE);
    assert(text.startsWith("PRI * HTTP/2.0"));
  },
});

// ============================================================================
// HTTP2_DEFAULT_SETTINGS
// ============================================================================

Deno.test({
  name: "HTTP2_DEFAULT_SETTINGS - is a Map",
  fn() {
    assert(HTTP2_DEFAULT_SETTINGS instanceof Map);
  },
});

// ============================================================================
// HTTP2FrameParser.serializeFrameHeader / parseFrameHeader
// ============================================================================

Deno.test({
  name: "HTTP2FrameParser - serializeFrameHeader produces 9-byte buffer",
  fn() {
    const header = {
      length: 100,
      type: HTTP2FrameType.DATA,
      flags: HTTP2FrameFlags.NONE,
      streamId: 1,
    };
    const buf = HTTP2FrameParser.serializeFrameHeader(header);
    assertEquals(buf.length, 9);
  },
});

Deno.test({
  name: "HTTP2FrameParser - parseFrameHeader round-trips correctly",
  fn() {
    const header = {
      length: 256,
      type: HTTP2FrameType.HEADERS,
      flags: HTTP2FrameFlags.END_HEADERS | HTTP2FrameFlags.END_STREAM,
      streamId: 3,
    };
    const buf = HTTP2FrameParser.serializeFrameHeader(header);
    const parsed = HTTP2FrameParser.parseFrameHeader(buf);
    assertEquals(parsed.length, header.length);
    assertEquals(parsed.type, header.type);
    assertEquals(parsed.flags, header.flags);
    assertEquals(parsed.streamId, header.streamId);
  },
});

Deno.test({
  name: "HTTP2FrameParser - parseFrameHeader throws for short buffer",
  fn() {
    let threw = false;
    try {
      HTTP2FrameParser.parseFrameHeader(new Uint8Array(5));
    } catch {
      threw = true;
    }
    assert(threw);
  },
});

// ============================================================================
// HTTP2FrameParser.createDataFrame
// ============================================================================

Deno.test({
  name: "HTTP2FrameParser.createDataFrame - creates frame with correct type",
  fn() {
    const data = new Uint8Array([1, 2, 3]);
    const frame = HTTP2FrameParser.createDataFrame(1, data, false);
    assertEquals(frame.header.type, HTTP2FrameType.DATA);
    assertEquals(frame.header.streamId, 1);
  },
});

Deno.test({
  name: "HTTP2FrameParser.createDataFrame - sets END_STREAM flag when requested",
  fn() {
    const data = new Uint8Array([1]);
    const frame = HTTP2FrameParser.createDataFrame(1, data, true);
    assert(!!(frame.header.flags & HTTP2FrameFlags.END_STREAM));
  },
});

Deno.test({
  name: "HTTP2FrameParser.createDataFrame - no END_STREAM when not last",
  fn() {
    const data = new Uint8Array([1]);
    const frame = HTTP2FrameParser.createDataFrame(1, data, false);
    assertEquals(frame.header.flags & HTTP2FrameFlags.END_STREAM, 0);
  },
});

// ============================================================================
// HTTP2FrameParser.createHeadersFrame
// ============================================================================

Deno.test({
  name: "HTTP2FrameParser.createHeadersFrame - creates frame with correct type",
  fn() {
    const fragment = new Uint8Array([0x82]); // :method GET indexed
    const frame = HTTP2FrameParser.createHeadersFrame(1, fragment, false, true);
    assertEquals(frame.header.type, HTTP2FrameType.HEADERS);
    assertEquals(frame.header.streamId, 1);
  },
});

Deno.test({
  name: "HTTP2FrameParser.createHeadersFrame - sets END_HEADERS flag",
  fn() {
    const fragment = new Uint8Array([0x82]);
    const frame = HTTP2FrameParser.createHeadersFrame(1, fragment, false, true);
    assert(!!(frame.header.flags & HTTP2FrameFlags.END_HEADERS));
  },
});

Deno.test({
  name: "HTTP2FrameParser.createHeadersFrame - sets END_STREAM when requested",
  fn() {
    const fragment = new Uint8Array([0x82]);
    const frame = HTTP2FrameParser.createHeadersFrame(1, fragment, true, true);
    assert(!!(frame.header.flags & HTTP2FrameFlags.END_STREAM));
  },
});

// ============================================================================
// HTTP2FrameParser.createSettingsFrame
// ============================================================================

Deno.test({
  name: "HTTP2FrameParser.createSettingsFrame - creates frame with type SETTINGS",
  fn() {
    const frame = HTTP2FrameParser.createSettingsFrame(new Map());
    assertEquals(frame.header.type, HTTP2FrameType.SETTINGS);
    assertEquals(frame.header.streamId, 0);
  },
});

Deno.test({
  name: "HTTP2FrameParser.createSettingsFrame - ACK flag set when ack=true",
  fn() {
    const frame = HTTP2FrameParser.createSettingsFrame(new Map(), true);
    assert(!!(frame.header.flags & HTTP2FrameFlags.ACK));
  },
});

Deno.test({
  name: "HTTP2FrameParser.createSettingsFrame - no ACK flag by default",
  fn() {
    const frame = HTTP2FrameParser.createSettingsFrame(new Map());
    assertEquals(frame.header.flags & HTTP2FrameFlags.ACK, 0);
  },
});

// ============================================================================
// HTTP2FrameParser.createWindowUpdateFrame
// ============================================================================

Deno.test({
  name: "HTTP2FrameParser.createWindowUpdateFrame - creates correct type",
  fn() {
    const frame = HTTP2FrameParser.createWindowUpdateFrame(0, 65535);
    assertEquals(frame.header.type, HTTP2FrameType.WINDOW_UPDATE);
  },
});

// ============================================================================
// HTTP2FrameParser.createRstStreamFrame
// ============================================================================

Deno.test({
  name: "HTTP2FrameParser.createRstStreamFrame - creates correct type",
  fn() {
    const frame = HTTP2FrameParser.createRstStreamFrame(1, HTTP2ErrorCode.CANCEL);
    assertEquals(frame.header.type, HTTP2FrameType.RST_STREAM);
    assertEquals(frame.header.streamId, 1);
  },
});

// ============================================================================
// HTTP2FrameParser.serializeFrame
// ============================================================================

Deno.test({
  name: "HTTP2FrameParser.serializeFrame - returns Uint8Array",
  fn() {
    const frame = HTTP2FrameParser.createDataFrame(1, new Uint8Array([1, 2]), false);
    const serialized = HTTP2FrameParser.serializeFrame(frame);
    assert(serialized instanceof Uint8Array);
  },
});

Deno.test({
  name: "HTTP2FrameParser.serializeFrame - length is 9 + payload",
  fn() {
    const payload = new Uint8Array(10);
    const frame = HTTP2FrameParser.createDataFrame(1, payload, false);
    const serialized = HTTP2FrameParser.serializeFrame(frame);
    assertEquals(serialized.length, 9 + 10);
  },
});
