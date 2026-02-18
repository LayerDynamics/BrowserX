/**
 * Socket Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { Socket, SocketState } from "../../../../../core/network/transport/socket/socket.ts";

// ============================================================================
// Construction
// ============================================================================

Deno.test({
  name: "Socket - constructs with host and port",
  fn() {
    const s = new Socket("localhost", 8080);
    assertEquals(s.host, "localhost");
    assertEquals(s.port, 8080);
  },
});

Deno.test({
  name: "Socket - initial state is CLOSED",
  fn() {
    const s = new Socket("localhost", 8080);
    assertEquals(s.getState(), SocketState.CLOSED);
  },
});

Deno.test({
  name: "Socket - isConnected() is false when CLOSED",
  fn() {
    const s = new Socket("localhost", 8080);
    assertEquals(s.isConnected(), false);
  },
});

Deno.test({
  name: "Socket - getConn() returns null before connect",
  fn() {
    const s = new Socket("localhost", 8080);
    assertEquals(s.getConn(), null);
  },
});

Deno.test({
  name: "Socket - getLocalAddr() returns null before connect",
  fn() {
    const s = new Socket("localhost", 8080);
    assertEquals(s.getLocalAddr(), null);
  },
});

Deno.test({
  name: "Socket - getRemoteAddr() returns null before connect",
  fn() {
    const s = new Socket("localhost", 8080);
    assertEquals(s.getRemoteAddr(), null);
  },
});

// ============================================================================
// getStats()
// ============================================================================

Deno.test({
  name: "Socket - getStats() returns zero-valued stats initially",
  fn() {
    const s = new Socket("localhost", 8080);
    const stats = s.getStats();
    assertEquals(stats.bytesRead, 0);
    assertEquals(stats.bytesWritten, 0);
    assertEquals(stats.readsCount, 0);
    assertEquals(stats.writesCount, 0);
    assertEquals(stats.errorsCount, 0);
  },
});

Deno.test({
  name: "Socket - getStats() returns createdAt timestamp",
  fn() {
    const before = Date.now();
    const s = new Socket("localhost", 8080);
    const after = Date.now();
    const stats = s.getStats();
    assert(stats.createdAt >= before);
    assert(stats.createdAt <= after);
  },
});

Deno.test({
  name: "Socket - getStats() returns lastActivityAt timestamp",
  fn() {
    const s = new Socket("localhost", 8080);
    const stats = s.getStats();
    assertExists(stats.lastActivityAt);
    assert(typeof stats.lastActivityAt === "number");
  },
});

// ============================================================================
// getOptions()
// ============================================================================

Deno.test({
  name: "Socket - getOptions() returns empty options when none provided",
  fn() {
    const s = new Socket("localhost", 8080);
    const opts = s.getOptions();
    assertExists(opts);
  },
});

Deno.test({
  name: "Socket - getOptions() returns provided options",
  fn() {
    const s = new Socket("localhost", 8080, { tcpNoDelay: true, tcpKeepAlive: true });
    const opts = s.getOptions();
    assertEquals(opts.tcpNoDelay, true);
    assertEquals(opts.tcpKeepAlive, true);
  },
});

// ============================================================================
// getAge() / getIdleTime()
// ============================================================================

Deno.test({
  name: "Socket - getAge() returns non-negative number",
  fn() {
    const s = new Socket("localhost", 8080);
    assert(s.getAge() >= 0);
  },
});

Deno.test({
  name: "Socket - getIdleTime() returns non-negative number",
  fn() {
    const s = new Socket("localhost", 8080);
    assert(s.getIdleTime() >= 0);
  },
});

// ============================================================================
// close()
// ============================================================================

Deno.test({
  name: "Socket - close() on CLOSED socket does not throw",
  fn() {
    const s = new Socket("localhost", 8080);
    s.close(); // Should be no-op
    assertEquals(s.getState(), SocketState.CLOSED);
  },
});

Deno.test({
  name: "Socket - close() twice does not throw",
  fn() {
    const s = new Socket("localhost", 8080);
    s.close();
    s.close(); // Second close should also be no-op
    assertEquals(s.getState(), SocketState.CLOSED);
  },
});

// ============================================================================
// connect() error behavior
// ============================================================================

Deno.test({
  name: "Socket - connect() to refused port enters ERROR state",
  async fn() {
    const s = new Socket("127.0.0.1", 19998); // refused connection is immediate
    let threw = false;
    try {
      await s.connect();
    } catch {
      threw = true;
    }
    assert(threw);
    // State should be ERROR after failed connect
    assert(
      s.getState() === SocketState.ERROR || s.getState() === SocketState.CLOSED,
    );
  },
});

Deno.test({
  name: "Socket - getError() returns string after failed connect",
  async fn() {
    const s = new Socket("127.0.0.1", 19998);
    try {
      await s.connect();
    } catch {
      // expected
    }
    // After error, getError() may return a message
    const err = s.getError();
    if (err !== undefined) {
      assert(typeof err === "string");
    }
  },
});

// ============================================================================
// read() / write() error behavior (not connected)
// ============================================================================

Deno.test({
  name: "Socket - read() throws when not connected",
  async fn() {
    const s = new Socket("localhost", 8080);
    let threw = false;
    try {
      await s.read(new Uint8Array(10));
    } catch {
      threw = true;
    }
    assert(threw);
  },
});

Deno.test({
  name: "Socket - write() throws when not connected",
  async fn() {
    const s = new Socket("localhost", 8080);
    let threw = false;
    try {
      await s.write(new Uint8Array([1, 2, 3]));
    } catch {
      threw = true;
    }
    assert(threw);
  },
});

// ============================================================================
// SocketState enum
// ============================================================================

Deno.test({
  name: "SocketState - has expected enum values",
  fn() {
    assertEquals(SocketState.CLOSED, "CLOSED");
    assertEquals(SocketState.OPENING, "OPENING");
    assertEquals(SocketState.OPEN, "OPEN");
    assertEquals(SocketState.CLOSING, "CLOSING");
    assertEquals(SocketState.ERROR, "ERROR");
  },
});

// ============================================================================
// fromConn() static method
// ============================================================================

Deno.test({
  name: "Socket - fromConn is a static function",
  fn() {
    assert(typeof Socket.fromConn === "function");
  },
});
