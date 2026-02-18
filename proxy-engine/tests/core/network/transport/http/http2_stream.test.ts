/**
 * HTTP2Stream Tests
 */

import { assertEquals, assert } from "@std/assert";
import { HTTP2Stream, HTTP2StreamState } from "../../../../../core/network/transport/http/http2_stream.ts";
import { HTTP2FrameType, HTTP2FrameFlags, HTTP2ErrorCode } from "../../../../../core/network/transport/http/http2_frames.ts";
import type { HTTP2Frame } from "../../../../../core/network/transport/http/http2_frames.ts";

// Helper: build a minimal HTTP2Frame for testing
function makeFrame(
  type: HTTP2FrameType,
  flags: number,
  streamId: number,
  payload: Uint8Array = new Uint8Array(0),
): HTTP2Frame {
  return {
    header: { length: payload.length, type, flags, streamId },
    payload,
  };
}

// ============================================================================
// Construction
// ============================================================================

Deno.test({
  name: "HTTP2Stream - constructs with id and isLocal",
  fn() {
    const s = new HTTP2Stream(1, true);
    assertEquals(s.id, 1);
    assertEquals(s.isLocal, true);
  },
});

Deno.test({
  name: "HTTP2Stream - initial state is IDLE",
  fn() {
    const s = new HTTP2Stream(1, true);
    assertEquals(s.getState(), HTTP2StreamState.IDLE);
  },
});

Deno.test({
  name: "HTTP2Stream - initial isClosed() is false",
  fn() {
    const s = new HTTP2Stream(1, true);
    assertEquals(s.isClosed(), false);
  },
});

// ============================================================================
// HTTP2StreamState enum
// ============================================================================

Deno.test({
  name: "HTTP2StreamState - has all expected values",
  fn() {
    assertEquals(HTTP2StreamState.IDLE, "idle");
    assertEquals(HTTP2StreamState.OPEN, "open");
    assertEquals(HTTP2StreamState.HALF_CLOSED_LOCAL, "half_closed_local");
    assertEquals(HTTP2StreamState.HALF_CLOSED_REMOTE, "half_closed_remote");
    assertEquals(HTTP2StreamState.CLOSED, "closed");
    assertEquals(HTTP2StreamState.RESERVED_LOCAL, "reserved_local");
    assertEquals(HTTP2StreamState.RESERVED_REMOTE, "reserved_remote");
  },
});

// ============================================================================
// sendHeaders()
// ============================================================================

Deno.test({
  name: "HTTP2Stream - sendHeaders() transitions IDLE → OPEN when not endStream",
  fn() {
    const s = new HTTP2Stream(1, true);
    s.sendHeaders(false);
    assertEquals(s.getState(), HTTP2StreamState.OPEN);
  },
});

Deno.test({
  name: "HTTP2Stream - sendHeaders() transitions IDLE → HALF_CLOSED_LOCAL when endStream",
  fn() {
    const s = new HTTP2Stream(1, true);
    s.sendHeaders(true);
    assertEquals(s.getState(), HTTP2StreamState.HALF_CLOSED_LOCAL);
  },
});

// ============================================================================
// canSend() / canReceive()
// ============================================================================

Deno.test({
  name: "HTTP2Stream - canSend() is false when IDLE",
  fn() {
    const s = new HTTP2Stream(1, true);
    assertEquals(s.canSend(), false);
  },
});

Deno.test({
  name: "HTTP2Stream - canReceive() is false when IDLE",
  fn() {
    const s = new HTTP2Stream(1, true);
    assertEquals(s.canReceive(), false);
  },
});

Deno.test({
  name: "HTTP2Stream - canSend() is true when OPEN",
  fn() {
    const s = new HTTP2Stream(1, true);
    s.sendHeaders(false);
    assertEquals(s.canSend(), true);
  },
});

Deno.test({
  name: "HTTP2Stream - canReceive() is true when OPEN",
  fn() {
    const s = new HTTP2Stream(1, true);
    s.sendHeaders(false);
    assertEquals(s.canReceive(), true);
  },
});

// ============================================================================
// sendData()
// ============================================================================

Deno.test({
  name: "HTTP2Stream - sendData() works when OPEN",
  fn() {
    const s = new HTTP2Stream(1, true);
    s.sendHeaders(false);
    s.sendData(100, false); // Should not throw
    assertEquals(s.getState(), HTTP2StreamState.OPEN);
  },
});

Deno.test({
  name: "HTTP2Stream - sendData() with endStream transitions OPEN → HALF_CLOSED_LOCAL",
  fn() {
    const s = new HTTP2Stream(1, true);
    s.sendHeaders(false);
    s.sendData(10, true);
    assertEquals(s.getState(), HTTP2StreamState.HALF_CLOSED_LOCAL);
  },
});

Deno.test({
  name: "HTTP2Stream - sendData() throws when IDLE",
  fn() {
    const s = new HTTP2Stream(1, true);
    let threw = false;
    try {
      s.sendData(10, false);
    } catch {
      threw = true;
    }
    assert(threw);
  },
});

// ============================================================================
// sendReset()
// ============================================================================

Deno.test({
  name: "HTTP2Stream - sendReset() transitions state to CLOSED",
  fn() {
    const s = new HTTP2Stream(1, true);
    s.sendHeaders(false);
    s.sendReset(HTTP2ErrorCode.CANCEL);
    assertEquals(s.isClosed(), true);
  },
});

// ============================================================================
// processFrame()
// ============================================================================

Deno.test({
  name: "HTTP2Stream - processFrame() with HEADERS frame transitions IDLE remote → OPEN",
  fn() {
    const s = new HTTP2Stream(2, false); // remote stream
    const frame = makeFrame(
      HTTP2FrameType.HEADERS,
      HTTP2FrameFlags.END_HEADERS,
      2,
    );
    s.processFrame(frame);
    assertEquals(s.getState(), HTTP2StreamState.OPEN);
  },
});

Deno.test({
  name: "HTTP2Stream - processFrame() with RST_STREAM closes stream",
  fn() {
    const s = new HTTP2Stream(1, true);
    s.sendHeaders(false);
    const payload = new Uint8Array(4); // errorCode = 0
    const frame = makeFrame(HTTP2FrameType.RST_STREAM, 0, 1, payload);
    s.processFrame(frame);
    assertEquals(s.isClosed(), true);
  },
});

// ============================================================================
// getReceivedData()
// ============================================================================

Deno.test({
  name: "HTTP2Stream - getReceivedData() returns empty array initially",
  fn() {
    const s = new HTTP2Stream(1, true);
    const data = s.getReceivedData();
    assertEquals(data.length, 0);
  },
});

Deno.test({
  name: "HTTP2Stream - getReceivedData() returns data after DATA frame processed",
  fn() {
    const s = new HTTP2Stream(2, false);
    // First open the stream
    const headersFrame = makeFrame(HTTP2FrameType.HEADERS, HTTP2FrameFlags.END_HEADERS, 2);
    s.processFrame(headersFrame);
    // Send data frame
    const payload = new Uint8Array([65, 66, 67]);
    const dataFrame = makeFrame(HTTP2FrameType.DATA, HTTP2FrameFlags.NONE, 2, payload);
    s.processFrame(dataFrame);
    const received = s.getReceivedData();
    assertEquals(received.length, 3);
    assertEquals(received[0], 65);
  },
});
