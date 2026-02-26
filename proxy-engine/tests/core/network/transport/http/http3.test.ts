/**
 * HTTP3 Tests
 *
 * Tests cover enum values, utility functions, and constructor behavior.
 * When transportx FFI is not available, constructors succeed but connect() throws.
 * When FFI is available, full QUIC/HTTP3 operations work.
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
  isQUICAvailableAsync,
  isHTTP3Supported,
  getHTTP3Availability,
  createHTTP3Client,
  createHTTP3Server,
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
    assertEquals(HTTP3ConnectionState.IDLE, "idle");
    assertEquals(HTTP3ConnectionState.CONNECTING, "connecting");
    assertEquals(HTTP3ConnectionState.CONNECTED, "connected");
    assertEquals(HTTP3ConnectionState.DRAINING, "draining");
    assertEquals(HTTP3ConnectionState.CLOSED, "closed");
    assertEquals(HTTP3ConnectionState.ERROR, "error");
  },
});

// ============================================================================
// isQUICAvailable() / isHTTP3Supported()
// ============================================================================

Deno.test({
  name: "isQUICAvailable() returns boolean",
  fn() {
    const result = isQUICAvailable();
    assertEquals(typeof result, "boolean");
  },
});

Deno.test({
  name: "isQUICAvailableAsync() returns boolean",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const result = await isQUICAvailableAsync();
    assertEquals(typeof result, "boolean");
  },
});

Deno.test({
  name: "isHTTP3Supported() matches isQUICAvailable()",
  fn() {
    assertEquals(isHTTP3Supported(), isQUICAvailable());
  },
});

// ============================================================================
// getHTTP3Availability()
// ============================================================================

Deno.test({
  name: "getHTTP3Availability() returns valid structure",
  fn() {
    const info = getHTTP3Availability();
    assertEquals(typeof info.supported, "boolean");
    assert(typeof info.reason === "string" && info.reason.length > 0);
    assert(Array.isArray(info.alternatives));
    assert(Array.isArray(info.requirements));
  },
});

// ============================================================================
// HTTP3Connection - constructor no longer throws
// ============================================================================

Deno.test({
  name: "HTTP3Connection - constructor succeeds with default config",
  fn() {
    const conn = new HTTP3Connection();
    assertEquals(conn.getState(), HTTP3ConnectionState.IDLE);
  },
});

Deno.test({
  name: "HTTP3Connection - constructor succeeds with custom config",
  fn() {
    const conn = new HTTP3Connection({
      maxConcurrentStreams: 200,
      idleTimeout: 60000,
      enable0RTT: true,
    });
    assertEquals(conn.getState(), HTTP3ConnectionState.IDLE);
  },
});

Deno.test({
  name: "HTTP3Connection - close sets state to CLOSED",
  async fn() {
    const conn = new HTTP3Connection();
    await conn.close();
    assertEquals(conn.getState(), HTTP3ConnectionState.CLOSED);
  },
});

Deno.test({
  name: "HTTP3Connection - request without connect throws",
  async fn() {
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
    assert(threw);
  },
});

// ============================================================================
// HTTP3Client - constructor no longer throws
// ============================================================================

Deno.test({
  name: "HTTP3Client - constructor succeeds",
  fn() {
    const client = new HTTP3Client();
    assert(client instanceof HTTP3Client);
  },
});

Deno.test({
  name: "HTTP3Client - close succeeds with no connections",
  async fn() {
    const client = new HTTP3Client();
    await client.close();
  },
});

// ============================================================================
// HTTP3Server - constructor no longer throws
// ============================================================================

Deno.test({
  name: "HTTP3Server - constructor succeeds",
  fn() {
    const server = new HTTP3Server();
    assert(server instanceof HTTP3Server);
    assertEquals(server.isListening(), false);
  },
});

Deno.test({
  name: "HTTP3Server - close succeeds when not listening",
  async fn() {
    const server = new HTTP3Server();
    await server.close();
    assertEquals(server.isListening(), false);
  },
});

// ============================================================================
// Factory functions
// ============================================================================

Deno.test({
  name: "createHTTP3Client - returns HTTP3Client instance",
  fn() {
    const client = createHTTP3Client();
    assert(client instanceof HTTP3Client);
  },
});

Deno.test({
  name: "createHTTP3Client - accepts config",
  fn() {
    const client = createHTTP3Client({ maxConcurrentStreams: 50 });
    assert(client instanceof HTTP3Client);
  },
});

Deno.test({
  name: "createHTTP3Server - returns HTTP3Server instance",
  fn() {
    const server = createHTTP3Server();
    assert(server instanceof HTTP3Server);
  },
});

Deno.test({
  name: "createHTTP3Server - accepts config",
  fn() {
    const server = createHTTP3Server({ idleTimeout: 60000 });
    assert(server instanceof HTTP3Server);
  },
});
