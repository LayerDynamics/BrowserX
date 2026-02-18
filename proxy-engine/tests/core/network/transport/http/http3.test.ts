/**
 * HTTP3 Tests
 *
 * HTTP/3 requires QUIC which is not available in Deno's stable APIs.
 * Tests cover enum values, utility functions, and the expected throws from
 * constructors that require QUIC.
 */

import { assertEquals, assert } from "@std/assert";
import {
  HTTP3FrameType,
  HTTP3SettingsParameter,
  HTTP3ErrorCode,
  HTTP3StreamType,
  HTTP3ConnectionState,
  HTTP3Connection,
  HTTP3Client,
  HTTP3Server,
  isQUICAvailable,
  isHTTP3Supported,
  getHTTP3Availability,
} from "../../../../../core/network/transport/http/http3.ts";

// ============================================================================
// HTTP3FrameType enum
// ============================================================================

Deno.test({
  name: "HTTP3FrameType - has all required frame types",
  fn() {
    assertEquals(HTTP3FrameType.DATA, 0x00);
    assertEquals(HTTP3FrameType.HEADERS, 0x01);
    assertEquals(HTTP3FrameType.CANCEL_PUSH, 0x03);
    assertEquals(HTTP3FrameType.SETTINGS, 0x04);
    assertEquals(HTTP3FrameType.PUSH_PROMISE, 0x05);
    assertEquals(HTTP3FrameType.GOAWAY, 0x07);
    assertEquals(HTTP3FrameType.MAX_PUSH_ID, 0x0d);
  },
});

// ============================================================================
// HTTP3SettingsParameter enum
// ============================================================================

Deno.test({
  name: "HTTP3SettingsParameter - has all required values",
  fn() {
    assertEquals(HTTP3SettingsParameter.QPACK_MAX_TABLE_CAPACITY, 0x01);
    assertEquals(HTTP3SettingsParameter.MAX_FIELD_SECTION_SIZE, 0x06);
    assertEquals(HTTP3SettingsParameter.QPACK_BLOCKED_STREAMS, 0x07);
  },
});

// ============================================================================
// HTTP3ErrorCode enum
// ============================================================================

Deno.test({
  name: "HTTP3ErrorCode - NO_ERROR is 0x0100",
  fn() {
    assertEquals(HTTP3ErrorCode.NO_ERROR, 0x0100);
  },
});

Deno.test({
  name: "HTTP3ErrorCode - has GENERAL_PROTOCOL_ERROR",
  fn() {
    assertEquals(HTTP3ErrorCode.GENERAL_PROTOCOL_ERROR, 0x0101);
  },
});

Deno.test({
  name: "HTTP3ErrorCode - has REQUEST_CANCELLED",
  fn() {
    assertEquals(HTTP3ErrorCode.REQUEST_CANCELLED, 0x010c);
  },
});

// ============================================================================
// HTTP3StreamType enum
// ============================================================================

Deno.test({
  name: "HTTP3StreamType - has all stream types",
  fn() {
    assertEquals(HTTP3StreamType.CONTROL, 0x00);
    assertEquals(HTTP3StreamType.PUSH, 0x01);
    assertEquals(HTTP3StreamType.QPACK_ENCODER, 0x02);
    assertEquals(HTTP3StreamType.QPACK_DECODER, 0x03);
  },
});

// ============================================================================
// HTTP3ConnectionState enum
// ============================================================================

Deno.test({
  name: "HTTP3ConnectionState - has expected values",
  fn() {
    assert(typeof HTTP3ConnectionState.IDLE === "string" || typeof HTTP3ConnectionState.IDLE === "number");
    assert(HTTP3ConnectionState.CLOSED !== undefined);
  },
});

// ============================================================================
// isQUICAvailable() / isHTTP3Supported()
// ============================================================================

Deno.test({
  name: "isQUICAvailable() returns false in Deno",
  fn() {
    assertEquals(isQUICAvailable(), false);
  },
});

Deno.test({
  name: "isHTTP3Supported() returns false in Deno",
  fn() {
    assertEquals(isHTTP3Supported(), false);
  },
});

// ============================================================================
// getHTTP3Availability()
// ============================================================================

Deno.test({
  name: "getHTTP3Availability() returns supported=false",
  fn() {
    const info = getHTTP3Availability();
    assertEquals(info.supported, false);
  },
});

Deno.test({
  name: "getHTTP3Availability() returns non-empty reason",
  fn() {
    const info = getHTTP3Availability();
    assert(typeof info.reason === "string" && info.reason.length > 0);
  },
});

Deno.test({
  name: "getHTTP3Availability() returns alternatives array",
  fn() {
    const info = getHTTP3Availability();
    assert(Array.isArray(info.alternatives));
    assert(info.alternatives.length > 0);
  },
});

Deno.test({
  name: "getHTTP3Availability() returns requirements array",
  fn() {
    const info = getHTTP3Availability();
    assert(Array.isArray(info.requirements));
    assert(info.requirements.length > 0);
  },
});

// ============================================================================
// HTTP3Connection - constructor throws (QUIC unavailable)
// ============================================================================

Deno.test({
  name: "HTTP3Connection - constructor throws because QUIC is unavailable",
  fn() {
    let threw = false;
    try {
      new HTTP3Connection();
    } catch {
      threw = true;
    }
    assert(threw);
  },
});

// ============================================================================
// HTTP3Client - constructor throws (QUIC unavailable)
// ============================================================================

Deno.test({
  name: "HTTP3Client - constructor throws because QUIC is unavailable",
  fn() {
    let threw = false;
    try {
      new HTTP3Client();
    } catch {
      threw = true;
    }
    assert(threw);
  },
});

// ============================================================================
// HTTP3Server - constructor throws (QUIC unavailable)
// ============================================================================

Deno.test({
  name: "HTTP3Server - constructor throws because QUIC is unavailable",
  fn() {
    let threw = false;
    try {
      new HTTP3Server();
    } catch {
      threw = true;
    }
    assert(threw);
  },
});
