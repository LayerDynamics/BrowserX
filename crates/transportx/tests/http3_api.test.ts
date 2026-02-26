/**
 * HTTP/3 API Surface Tests
 *
 * Tests the HTTP/3 types, enums, and classes from proxy-engine's http3.ts
 * which now uses transportx FFI for QUIC support.
 */

import { assertEquals, assert, assertExists, assertInstanceOf } from "@std/assert";
import {
  HTTP3FrameType,
  HTTP3ErrorCode,
  HTTP3StreamType,
  HTTP3SettingsParameter,
  HTTP3ConnectionState,
  HTTP3Connection,
  HTTP3Client,
  HTTP3Server,
  isQUICAvailable,
  isHTTP3Supported,
  getHTTP3Availability,
  createHTTP3Client,
  createHTTP3Server,
} from "../../../proxy-engine/core/network/transport/http/http3.ts";

// ============================================================================
// Enum RFC values
// ============================================================================

Deno.test("HTTP3FrameType values match RFC 9114", () => {
  assertEquals(HTTP3FrameType.DATA, 0x00);
  assertEquals(HTTP3FrameType.HEADERS, 0x01);
  assertEquals(HTTP3FrameType.CANCEL_PUSH, 0x03);
  assertEquals(HTTP3FrameType.SETTINGS, 0x04);
  assertEquals(HTTP3FrameType.PUSH_PROMISE, 0x05);
  assertEquals(HTTP3FrameType.GOAWAY, 0x07);
  assertEquals(HTTP3FrameType.MAX_PUSH_ID, 0x0d);
});

Deno.test("HTTP3ErrorCode values match RFC 9114", () => {
  assertEquals(HTTP3ErrorCode.NO_ERROR, 0x0100);
  assertEquals(HTTP3ErrorCode.GENERAL_PROTOCOL_ERROR, 0x0101);
  assertEquals(HTTP3ErrorCode.INTERNAL_ERROR, 0x0102);
  assertEquals(HTTP3ErrorCode.STREAM_CREATION_ERROR, 0x0103);
  assertEquals(HTTP3ErrorCode.CLOSED_CRITICAL_STREAM, 0x0104);
  assertEquals(HTTP3ErrorCode.FRAME_UNEXPECTED, 0x0105);
  assertEquals(HTTP3ErrorCode.FRAME_ERROR, 0x0106);
  assertEquals(HTTP3ErrorCode.EXCESSIVE_LOAD, 0x0107);
  assertEquals(HTTP3ErrorCode.ID_ERROR, 0x0108);
  assertEquals(HTTP3ErrorCode.SETTINGS_ERROR, 0x0109);
  assertEquals(HTTP3ErrorCode.MISSING_SETTINGS, 0x010a);
  assertEquals(HTTP3ErrorCode.REQUEST_REJECTED, 0x010b);
  assertEquals(HTTP3ErrorCode.REQUEST_CANCELLED, 0x010c);
  assertEquals(HTTP3ErrorCode.REQUEST_INCOMPLETE, 0x010d);
  assertEquals(HTTP3ErrorCode.MESSAGE_ERROR, 0x010e);
  assertEquals(HTTP3ErrorCode.CONNECT_ERROR, 0x010f);
  assertEquals(HTTP3ErrorCode.VERSION_FALLBACK, 0x0110);
});

Deno.test("HTTP3StreamType values", () => {
  assertEquals(HTTP3StreamType.CONTROL, 0x00);
  assertEquals(HTTP3StreamType.PUSH, 0x01);
  assertEquals(HTTP3StreamType.QPACK_ENCODER, 0x02);
  assertEquals(HTTP3StreamType.QPACK_DECODER, 0x03);
});

Deno.test("HTTP3SettingsParameter values", () => {
  assertEquals(HTTP3SettingsParameter.QPACK_MAX_TABLE_CAPACITY, 0x01);
  assertEquals(HTTP3SettingsParameter.MAX_FIELD_SECTION_SIZE, 0x06);
  assertEquals(HTTP3SettingsParameter.QPACK_BLOCKED_STREAMS, 0x07);
});

Deno.test("HTTP3ConnectionState enum values", () => {
  assertEquals(HTTP3ConnectionState.IDLE, "idle");
  assertEquals(HTTP3ConnectionState.CONNECTING, "connecting");
  assertEquals(HTTP3ConnectionState.CONNECTED, "connected");
  assertEquals(HTTP3ConnectionState.DRAINING, "draining");
  assertEquals(HTTP3ConnectionState.CLOSED, "closed");
  assertEquals(HTTP3ConnectionState.ERROR, "error");
});

// ============================================================================
// Availability checks
// ============================================================================

Deno.test("isQUICAvailable returns boolean", () => {
  const result = isQUICAvailable();
  assertEquals(typeof result, "boolean");
});

Deno.test("isHTTP3Supported matches isQUICAvailable", () => {
  assertEquals(isHTTP3Supported(), isQUICAvailable());
});

Deno.test("getHTTP3Availability returns proper structure", () => {
  const info = getHTTP3Availability();
  assertExists(info);
  assertEquals(typeof info.supported, "boolean");
  assertEquals(typeof info.reason, "string");
  assert(info.reason.length > 0);
  assert(Array.isArray(info.alternatives));
  assert(Array.isArray(info.requirements));

  if (!info.supported) {
    // When not supported, should have alternatives and requirements
    assert(info.alternatives.length > 0);
    assert(info.requirements.length > 0);
  } else {
    // When supported, alternatives and requirements are empty
    assertEquals(info.alternatives.length, 0);
    assertEquals(info.requirements.length, 0);
  }
});

// ============================================================================
// Constructors no longer throw
// ============================================================================

Deno.test("HTTP3Connection constructor does not throw", () => {
  const conn = new HTTP3Connection();
  assertExists(conn);
  assertInstanceOf(conn, HTTP3Connection);
});

Deno.test("HTTP3Connection constructor with config does not throw", () => {
  const conn = new HTTP3Connection({
    maxConcurrentStreams: 50,
    maxHeaderListSize: 8192,
    enable0RTT: true,
    idleTimeout: 60000,
  });
  assertExists(conn);
});

Deno.test("HTTP3Client constructor does not throw", () => {
  const client = new HTTP3Client();
  assertExists(client);
  assertInstanceOf(client, HTTP3Client);
});

Deno.test("HTTP3Server constructor does not throw", () => {
  const server = new HTTP3Server();
  assertExists(server);
  assertInstanceOf(server, HTTP3Server);
  assertEquals(server.isListening(), false);
});

// ============================================================================
// Factory functions
// ============================================================================

Deno.test("createHTTP3Client returns HTTP3Client instance", () => {
  const client = createHTTP3Client();
  assertInstanceOf(client, HTTP3Client);
});

Deno.test("createHTTP3Client accepts config", () => {
  const client = createHTTP3Client({ maxConcurrentStreams: 200 });
  assertInstanceOf(client, HTTP3Client);
});

Deno.test("createHTTP3Server returns HTTP3Server instance", () => {
  const server = createHTTP3Server();
  assertInstanceOf(server, HTTP3Server);
});

Deno.test("createHTTP3Server accepts config", () => {
  const server = createHTTP3Server({ idleTimeout: 120000 });
  assertInstanceOf(server, HTTP3Server);
});

// ============================================================================
// HTTP3Connection state
// ============================================================================

Deno.test("HTTP3Connection initial state is IDLE", () => {
  const conn = new HTTP3Connection();
  assertEquals(conn.getState(), HTTP3ConnectionState.IDLE);
});

Deno.test("HTTP3Connection close sets state to CLOSED", async () => {
  const conn = new HTTP3Connection();
  assertEquals(conn.getState(), HTTP3ConnectionState.IDLE);
  await conn.close();
  assertEquals(conn.getState(), HTTP3ConnectionState.CLOSED);
});

Deno.test("HTTP3Connection request without connect throws", async () => {
  const conn = new HTTP3Connection();
  let threw = false;
  try {
    await conn.request({
      method: "GET",
      url: "https://example.com/",
      headers: new Map(),
    });
  } catch {
    threw = true;
  }
  assert(threw, "Expected request without connect to throw");
});

Deno.test("HTTP3Server close when not listening succeeds", async () => {
  const server = new HTTP3Server();
  await server.close();
  assertEquals(server.isListening(), false);
});

Deno.test("HTTP3Client close with no connections succeeds", async () => {
  const client = new HTTP3Client();
  await client.close();
});
