/**
 * HTTP2 Client/Server Tests
 *
 * HTTP2Client and HTTP2Server require a real Deno.Conn. Tests here focus on
 * construction, initial state, and method availability without network I/O.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
  HTTP2Client,
  HTTP2Server,
} from "../../../../../core/network/transport/http/http2.ts";
import { HTTP2SettingsParameter } from "../../../../../core/network/transport/http/http2_frames.ts";

/**
 * Creates a minimal mock Deno.Conn for testing constructor behaviour.
 * All I/O methods return dummy values; no real network is used.
 */
function mockConn(): Deno.Conn {
  return {
    rid: 0,
    localAddr: { transport: "tcp", hostname: "127.0.0.1", port: 0 } as Deno.NetAddr,
    remoteAddr: { transport: "tcp", hostname: "127.0.0.1", port: 8080 } as Deno.NetAddr,
    readable: new ReadableStream(),
    writable: new WritableStream(),
    read: (_: Uint8Array) => Promise.resolve(null),
    write: (_: Uint8Array) => Promise.resolve(0),
    close: () => {},
    closeWrite: () => Promise.resolve(),
    ref: () => {},
    unref: () => {},
  } as unknown as Deno.Conn;
}

// ============================================================================
// HTTP2Client - Construction
// ============================================================================

Deno.test({
  name: "HTTP2Client - constructs with a Deno.Conn",
  fn() {
    const client = new HTTP2Client(mockConn());
    assertExists(client);
  },
});

Deno.test({
  name: "HTTP2Client - isClosed() is false after construction",
  fn() {
    const client = new HTTP2Client(mockConn());
    assertEquals(client.isClosed(), false);
  },
});

Deno.test({
  name: "HTTP2Client - getNextStreamId() starts at 1 (odd, client side)",
  fn() {
    const client = new HTTP2Client(mockConn());
    assertEquals(client.getNextStreamId(), 1);
  },
});

Deno.test({
  name: "HTTP2Client - getConnectionWindowSize() starts at 65535",
  fn() {
    const client = new HTTP2Client(mockConn());
    assertEquals(client.getConnectionWindowSize(), 65535);
  },
});

Deno.test({
  name: "HTTP2Client - getStreams() returns empty Map initially",
  fn() {
    const client = new HTTP2Client(mockConn());
    assertEquals(client.getStreams().size, 0);
  },
});

Deno.test({
  name: "HTTP2Client - getPendingFrames() returns empty array initially",
  fn() {
    const client = new HTTP2Client(mockConn());
    assertEquals(client.getPendingFrames().length, 0);
  },
});

Deno.test({
  name: "HTTP2Client - getStats() returns all-zero counts initially",
  fn() {
    const client = new HTTP2Client(mockConn());
    const stats = client.getStats();
    assertEquals(stats.streamsCreated, 0);
    assertEquals(stats.activeStreams, 0);
    assertEquals(stats.framesSent, 0);
    assertEquals(stats.framesReceived, 0);
    assertEquals(stats.bytesSent, 0);
    assertEquals(stats.bytesReceived, 0);
  },
});

// ============================================================================
// HTTP2Client - Config
// ============================================================================

Deno.test({
  name: "HTTP2Client - getConfig() returns default maxConcurrentStreams=100",
  fn() {
    const client = new HTTP2Client(mockConn());
    assertEquals(client.getConfig().maxConcurrentStreams, 100);
  },
});

Deno.test({
  name: "HTTP2Client - getConfig() returns default initialWindowSize=65535",
  fn() {
    const client = new HTTP2Client(mockConn());
    assertEquals(client.getConfig().initialWindowSize, 65535);
  },
});

Deno.test({
  name: "HTTP2Client - getConfig() returns custom config values",
  fn() {
    const client = new HTTP2Client(mockConn(), { maxConcurrentStreams: 50, maxFrameSize: 32768 });
    assertEquals(client.getConfig().maxConcurrentStreams, 50);
    assertEquals(client.getConfig().maxFrameSize, 32768);
  },
});

Deno.test({
  name: "HTTP2Client - getLocalSettings() returns Map with INITIAL_WINDOW_SIZE",
  fn() {
    const client = new HTTP2Client(mockConn());
    const settings = client.getLocalSettings();
    assert(settings instanceof Map);
    assert(settings.has(HTTP2SettingsParameter.INITIAL_WINDOW_SIZE));
  },
});

Deno.test({
  name: "HTTP2Client - getRemoteSettings() returns Map initially",
  fn() {
    const client = new HTTP2Client(mockConn());
    const settings = client.getRemoteSettings();
    assert(settings instanceof Map);
  },
});

// ============================================================================
// HTTP2Client - HPACK
// ============================================================================

Deno.test({
  name: "HTTP2Client - getHPACK() returns HPACKCodec instance",
  fn() {
    const client = new HTTP2Client(mockConn());
    const hpack = client.getHPACK();
    assertExists(hpack);
    assert(typeof hpack.encode === "function");
    assert(typeof hpack.decode === "function");
  },
});

// ============================================================================
// HTTP2Server - Construction
// ============================================================================

Deno.test({
  name: "HTTP2Server - constructs with a Deno.Conn",
  fn() {
    const server = new HTTP2Server(mockConn());
    assertExists(server);
  },
});

Deno.test({
  name: "HTTP2Server - isClosed() is false after construction",
  fn() {
    const server = new HTTP2Server(mockConn());
    assertEquals(server.isClosed(), false);
  },
});

Deno.test({
  name: "HTTP2Server - getNextStreamId() starts at 2 (even, server side)",
  fn() {
    const server = new HTTP2Server(mockConn());
    assertEquals(server.getNextStreamId(), 2);
  },
});

Deno.test({
  name: "HTTP2Server - getConnectionWindowSize() starts at 65535",
  fn() {
    const server = new HTTP2Server(mockConn());
    assertEquals(server.getConnectionWindowSize(), 65535);
  },
});

Deno.test({
  name: "HTTP2Server - getStreams() returns empty Map initially",
  fn() {
    const server = new HTTP2Server(mockConn());
    assertEquals(server.getStreams().size, 0);
  },
});

Deno.test({
  name: "HTTP2Server - getStats() returns all-zero counts initially",
  fn() {
    const server = new HTTP2Server(mockConn());
    const stats = server.getStats();
    assertEquals(stats.streamsCreated, 0);
    assertEquals(stats.activeStreams, 0);
    assertEquals(stats.framesSent, 0);
    assertEquals(stats.framesReceived, 0);
  },
});

Deno.test({
  name: "HTTP2Server - getConfig() returns default config values",
  fn() {
    const server = new HTTP2Server(mockConn());
    assertEquals(server.getConfig().maxConcurrentStreams, 100);
    assertEquals(server.getConfig().initialWindowSize, 65535);
  },
});
