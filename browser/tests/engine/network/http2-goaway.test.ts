import { assertEquals } from "@std/assert";
import {
  HTTP2Connection,
  HTTP2ErrorCode,
  HTTP2FrameType,
  HTTP2StreamState,
} from "../../../src/engine/network/protocols/HTTP2Connection.ts";

/**
 * Mock socket for testing HTTP2Connection frame handling
 */
function createMockSocket() {
  const written: Uint8Array[] = [];
  let closed = false;
  return {
    write: async (data: Uint8Array) => {
      written.push(new Uint8Array(data));
    },
    read: async (_buf: Uint8Array) => null as number | null,
    close: async () => {
      closed = true;
    },
    getWritten: () => written,
    isClosed: () => closed,
    // Satisfy Socket interface minimally
    connect: async () => {},
    isConnected: () => !closed,
    setOption: () => {},
    getOption: () => null,
    getLocalAddress: () => ({ host: "127.0.0.1", port: 0 }),
    getRemoteAddress: () => ({ host: "127.0.0.1", port: 0 }),
  };
}

function buildGoawayPayload(lastStreamId: number, errorCode: number): Uint8Array<ArrayBuffer> {
  const payload = new Uint8Array(8);
  const view = new DataView(payload.buffer);
  view.setUint32(0, lastStreamId & 0x7FFFFFFF);
  view.setUint32(4, errorCode);
  return payload as Uint8Array<ArrayBuffer>;
}

Deno.test("GOAWAY - rejects streams above lastStreamId", async () => {
  const sock = createMockSocket();
  // deno-lint-ignore no-explicit-any
  const conn = new HTTP2Connection(sock as any);

  // Create some streams
  const s1 = conn.createStream(); // id=1
  s1.state = HTTP2StreamState.OPEN;
  const s3 = conn.createStream(); // id=3
  s3.state = HTTP2StreamState.OPEN;
  const s5 = conn.createStream(); // id=5
  s5.state = HTTP2StreamState.OPEN;

  // Track rejections
  const rejected: number[] = [];
  s1.responseReject = () => {
    rejected.push(1);
  };
  s3.responseReject = () => {
    rejected.push(3);
  };
  s5.responseReject = () => {
    rejected.push(5);
  };

  // GOAWAY with lastStreamId=3: streams 5 should be rejected
  const payload = buildGoawayPayload(3, HTTP2ErrorCode.NO_ERROR);
  const frame = {
    length: payload.byteLength,
    type: HTTP2FrameType.GOAWAY,
    flags: 0,
    streamId: 0,
    payload,
  };

  await conn.handleFrame(frame);

  // Stream 5 was rejected (id > 3)
  assertEquals(rejected.includes(5), true);
  // Streams 1 and 3 were NOT rejected
  assertEquals(rejected.includes(1), false);
  assertEquals(rejected.includes(3), false);
});

Deno.test("GOAWAY - closes connection when no remaining streams", async () => {
  const sock = createMockSocket();
  // deno-lint-ignore no-explicit-any
  const conn = new HTTP2Connection(sock as any);

  // Create one stream above the lastStreamId
  const s1 = conn.createStream(); // id=1
  s1.state = HTTP2StreamState.OPEN;
  s1.responseReject = () => {};

  // GOAWAY with lastStreamId=0: all streams rejected
  const payload = buildGoawayPayload(0, HTTP2ErrorCode.NO_ERROR);
  await conn.handleFrame({
    length: payload.byteLength,
    type: HTTP2FrameType.GOAWAY,
    flags: 0,
    streamId: 0,
    payload,
  });

  // Connection should have been closed (socket.close called)
  assertEquals(sock.isClosed(), true);
});

Deno.test("GOAWAY - logs warning on error code", async () => {
  const sock = createMockSocket();
  // deno-lint-ignore no-explicit-any
  const conn = new HTTP2Connection(sock as any);

  const warnings: string[] = [];
  const origWarn = console.warn;
  console.warn = (msg: string) => {
    warnings.push(msg);
  };

  const payload = buildGoawayPayload(0, HTTP2ErrorCode.PROTOCOL_ERROR);
  await conn.handleFrame({
    length: payload.byteLength,
    type: HTTP2FrameType.GOAWAY,
    flags: 0,
    streamId: 0,
    payload,
  });

  console.warn = origWarn;
  assertEquals(warnings.length > 0, true);
  assertEquals(warnings[0].includes("GOAWAY"), true);
});

Deno.test("GOAWAY - keeps streams at or below lastStreamId", async () => {
  const sock = createMockSocket();
  // deno-lint-ignore no-explicit-any
  const conn = new HTTP2Connection(sock as any);

  const s1 = conn.createStream(); // id=1
  s1.state = HTTP2StreamState.OPEN;
  const s3 = conn.createStream(); // id=3
  s3.state = HTTP2StreamState.OPEN;

  // GOAWAY with lastStreamId=3: both kept
  const payload = buildGoawayPayload(3, HTTP2ErrorCode.NO_ERROR);
  await conn.handleFrame({
    length: payload.byteLength,
    type: HTTP2FrameType.GOAWAY,
    flags: 0,
    streamId: 0,
    payload,
  });

  const stats = conn.getStats();
  assertEquals(stats.activeStreams, 2);
});
