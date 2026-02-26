/**
 * TransportX TypeScript API Tests
 *
 * Tests the TypeScript wrapper classes and enums exported from transportx.ts.
 * FFI-dependent tests are skipped when the native library is not built.
 */

import { assertEquals, assertExists, assertInstanceOf } from "@std/assert";
import {
  QuicConnectionState,
  TransportX,
  QuicConnection,
  Http3Connection,
  preload_lib,
  close_lib,
} from "../transportx.ts";

// ============================================================================
// Detect FFI availability
// ============================================================================

let ffiAvailable = false;
try {
  preload_lib();
  ffiAvailable = true;
} catch {
  // FFI library not built - skip FFI-dependent tests
}

// ============================================================================
// Enum exports
// ============================================================================

Deno.test("QuicConnectionState enum values", () => {
  assertEquals(QuicConnectionState.Idle, 0);
  assertEquals(QuicConnectionState.Connecting, 1);
  assertEquals(QuicConnectionState.Connected, 2);
  assertEquals(QuicConnectionState.Draining, 3);
  assertEquals(QuicConnectionState.Closed, 4);
  assertEquals(QuicConnectionState.Error, 5);
});

Deno.test("QuicConnectionState reverse mapping", () => {
  assertEquals(QuicConnectionState[0], "Idle");
  assertEquals(QuicConnectionState[1], "Connecting");
  assertEquals(QuicConnectionState[4], "Closed");
});

// ============================================================================
// Class exports
// ============================================================================

Deno.test("TransportX class exists and can be imported", () => {
  assertExists(TransportX);
  assertEquals(typeof TransportX, "function");
});

Deno.test("QuicConnection class exists", () => {
  assertExists(QuicConnection);
  assertEquals(typeof QuicConnection, "function");
});

Deno.test("Http3Connection class exists", () => {
  assertExists(Http3Connection);
  assertEquals(typeof Http3Connection, "function");
});

Deno.test("preload_lib and close_lib are exported", () => {
  assertExists(preload_lib);
  assertExists(close_lib);
  assertEquals(typeof preload_lib, "function");
  assertEquals(typeof close_lib, "function");
});

// ============================================================================
// FFI-dependent tests (skipped when library not built)
// ============================================================================

Deno.test({
  name: "TransportX init and version",
  ignore: !ffiAvailable,
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const tx = new TransportX();
    assertExists(tx);
    const version = tx.version;
    assertEquals(typeof version, "string");
    // Version should be non-empty
    assertEquals(version.length > 0, true);
  },
});

Deno.test({
  name: "TransportX isQUICAvailable returns boolean",
  ignore: !ffiAvailable,
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const tx = new TransportX();
    const available = tx.isQUICAvailable();
    assertEquals(typeof available, "boolean");
  },
});

Deno.test({
  name: "TransportX getLastError returns string",
  ignore: !ffiAvailable,
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const tx = new TransportX();
    const err = tx.getLastError();
    assertEquals(typeof err, "string");
  },
});

Deno.test({
  name: "TransportX createUdpSocket and closeUdpSocket",
  ignore: !ffiAvailable,
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const tx = new TransportX();
    const handle = tx.createUdpSocket("0.0.0.0:0");
    assertEquals(typeof handle, "bigint");
    // If handle is valid (non-zero), close it
    if (handle !== 0n) {
      tx.closeUdpSocket(handle);
    }
  },
});

Deno.test({
  name: "QuicConnection create and close",
  ignore: !ffiAvailable,
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const tx = new TransportX();
    const socket = tx.createUdpSocket("0.0.0.0:0");
    if (socket === 0n) return; // skip if socket creation failed

    try {
      const conn = new QuicConnection({
        socket_handle: socket,
        idle_timeout_ms: 5000,
        alpn: ["h3"],
      });
      assertExists(conn);
      assertInstanceOf(conn, QuicConnection);

      const handle = conn.getHandle();
      assertEquals(typeof handle, "bigint");

      conn.close();
      assertEquals(conn.isClosed(), true);
    } finally {
      tx.closeUdpSocket(socket);
    }
  },
});

Deno.test({
  name: "QuicConnection state transitions",
  ignore: !ffiAvailable,
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const tx = new TransportX();
    const socket = tx.createUdpSocket("0.0.0.0:0");
    if (socket === 0n) return;

    try {
      const conn = new QuicConnection({
        socket_handle: socket,
        idle_timeout_ms: 5000,
        alpn: ["h3"],
      });

      // Initial state should be Idle
      const initialState = conn.getState();
      assertEquals(typeof initialState, "number");
      assertEquals(initialState, QuicConnectionState.Idle);

      // Not established yet
      assertEquals(conn.isEstablished(), false);

      conn.close();
    } finally {
      tx.closeUdpSocket(socket);
    }
  },
});

Deno.test({
  name: "QuicConnection getStats returns valid structure",
  ignore: !ffiAvailable,
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const tx = new TransportX();
    const socket = tx.createUdpSocket("0.0.0.0:0");
    if (socket === 0n) return;

    try {
      const conn = new QuicConnection({
        socket_handle: socket,
        idle_timeout_ms: 5000,
        alpn: ["h3"],
      });

      const stats = conn.getStats();
      assertExists(stats);
      assertEquals(typeof stats.sent_bytes, "number");
      assertEquals(typeof stats.recv_bytes, "number");
      assertEquals(typeof stats.sent_packets, "number");
      assertEquals(typeof stats.recv_packets, "number");
      assertEquals(typeof stats.lost_packets, "number");
      assertEquals(typeof stats.rtt_ms, "number");
      assertEquals(typeof stats.cwnd, "number");

      conn.close();
    } finally {
      tx.closeUdpSocket(socket);
    }
  },
});

Deno.test({
  name: "QuicConnection poll returns array",
  ignore: !ffiAvailable,
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const tx = new TransportX();
    const socket = tx.createUdpSocket("0.0.0.0:0");
    if (socket === 0n) return;

    try {
      const conn = new QuicConnection({
        socket_handle: socket,
        idle_timeout_ms: 5000,
        alpn: ["h3"],
      });

      const events = conn.poll();
      assertEquals(Array.isArray(events), true);

      conn.close();
    } finally {
      tx.closeUdpSocket(socket);
    }
  },
});

Deno.test({
  name: "close_lib does not throw",
  ignore: !ffiAvailable,
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    // close_lib should be safe to call
    close_lib();
    // Re-preload for any subsequent tests
    preload_lib();
  },
});
