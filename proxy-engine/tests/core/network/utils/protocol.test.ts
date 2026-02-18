/**
 * Tests for protocol detection utilities
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  buildALPNExtension,
  detectProtocol,
  getHTTP2FrameType,
  isCONNECTRequest,
  isHTTP2,
  isHTTPRequest,
  isHTTPResponse,
  isTLSHandshake,
  isWebSocket,
  parseALPNProtocols,
  parseHTTPMethod,
  parseHTTPStatusCode,
  parseHTTPVersion,
  selectALPNProtocol,
  sniffProtocol,
  wantsHTTP2Upgrade,
} from "../../../../core/network/utils/protocol.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Build a minimal TLS ClientHello with an ALPN extension so that
 * parseALPNProtocols() can extract the protocol list.
 *
 * Layout (simplified — enough for the parser):
 *   TLS record header  (5 bytes): 0x16 0x03 0x03 len_hi len_lo
 *   Handshake header   (4 bytes): 0x01 len_hi len_mid len_lo
 *   Client version     (2 bytes): 0x03 0x03
 *   Random             (32 bytes)
 *   Session ID length  (1 byte) : 0x00
 *   Cipher suites len  (2 bytes): 0x00 0x02
 *   Cipher suite       (2 bytes): 0x00 0x35
 *   Compression len    (1 byte) : 0x01
 *   Compression method (1 byte) : 0x00
 *   Extensions length  (2 bytes): derived from alpnExt length
 *   ALPN extension bytes (variable)
 */
function buildClientHelloWithALPN(protocols: string[]): Uint8Array {
  const alpnExt = buildALPNExtension(protocols);

  // Variable-length body after the record/handshake headers
  const bodyLen =
    2 + // client version
    32 + // random
    1 + // session id length
    2 + // cipher suites length
    2 + // cipher suite
    1 + // compression length
    1 + // compression method
    2 + // extensions length field
    alpnExt.length;

  // Total handshake message length (after the 4-byte handshake header)
  const hsLen = bodyLen;

  // Total TLS record payload = handshake header (4) + body
  const recordPayloadLen = 4 + hsLen;

  const buf = new Uint8Array(5 + recordPayloadLen);
  let pos = 0;

  // TLS record header
  buf[pos++] = 0x16; // ContentType: Handshake
  buf[pos++] = 0x03;
  buf[pos++] = 0x03; // TLS 1.2
  buf[pos++] = (recordPayloadLen >> 8) & 0xff;
  buf[pos++] = recordPayloadLen & 0xff;

  // Handshake header
  buf[pos++] = 0x01; // HandshakeType: ClientHello
  buf[pos++] = (hsLen >> 16) & 0xff;
  buf[pos++] = (hsLen >> 8) & 0xff;
  buf[pos++] = hsLen & 0xff;

  // Client version
  buf[pos++] = 0x03;
  buf[pos++] = 0x03;

  // Random (32 zero bytes)
  pos += 32;

  // Session ID length
  buf[pos++] = 0x00;

  // Cipher suites
  buf[pos++] = 0x00;
  buf[pos++] = 0x02;
  buf[pos++] = 0x00;
  buf[pos++] = 0x35; // TLS_RSA_WITH_AES_256_CBC_SHA

  // Compression methods
  buf[pos++] = 0x01;
  buf[pos++] = 0x00; // null

  // Extensions length
  buf[pos++] = (alpnExt.length >> 8) & 0xff;
  buf[pos++] = alpnExt.length & 0xff;

  // ALPN extension
  buf.set(alpnExt, pos);

  return buf;
}

// ---------------------------------------------------------------------------
// detectProtocol
// ---------------------------------------------------------------------------

Deno.test("detectProtocol - empty data returns Unknown", () => {
  assertEquals(detectProtocol(new Uint8Array(0)), "Unknown");
});

Deno.test("detectProtocol - TLS handshake byte", () => {
  const data = new Uint8Array([0x16, 0x03, 0x03, 0x00, 0x05]);
  assertEquals(detectProtocol(data), "TLS");
});

Deno.test("detectProtocol - HTTP/1.1 GET request", () => {
  assertEquals(detectProtocol(toBytes("GET / HTTP/1.1\r\nHost: x\r\n\r\n")), "HTTP/1.1");
});

Deno.test("detectProtocol - HTTP/1.0 GET request", () => {
  assertEquals(detectProtocol(toBytes("GET / HTTP/1.0\r\n\r\n")), "HTTP/1.0");
});

Deno.test("detectProtocol - HTTP/1.1 response", () => {
  assertEquals(detectProtocol(toBytes("HTTP/1.1 200 OK\r\n\r\n")), "HTTP/1.1");
});

Deno.test("detectProtocol - HTTP/2 preface", () => {
  const preface = new TextEncoder().encode("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");
  assertEquals(detectProtocol(preface), "HTTP/2");
});

Deno.test("detectProtocol - WebSocket upgrade", () => {
  const req = toBytes(
    "GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nSec-WebSocket-Key: abc\r\n\r\n",
  );
  // WebSocket detection is via text scan; detectProtocol returns HTTP/1.1 (method match wins)
  // but isWebSocket handles WS-specific detection
  const p = detectProtocol(req);
  assertEquals(p === "HTTP/1.1" || p === "WebSocket", true);
});

// ---------------------------------------------------------------------------
// isHTTPRequest / isHTTPResponse / isTLSHandshake / isHTTP2 / isWebSocket
// ---------------------------------------------------------------------------

Deno.test("isHTTPRequest - true for HTTP/1.1 GET", () => {
  assertEquals(isHTTPRequest(toBytes("GET / HTTP/1.1\r\n\r\n")), true);
});

Deno.test("isHTTPRequest - false for TLS", () => {
  assertEquals(isHTTPRequest(new Uint8Array([0x16, 0x03, 0x03])), false);
});

Deno.test("isHTTPResponse - true for HTTP/1.1 response", () => {
  assertEquals(isHTTPResponse(toBytes("HTTP/1.1 200 OK\r\n\r\n")), true);
});

Deno.test("isHTTPResponse - false for short data", () => {
  assertEquals(isHTTPResponse(new Uint8Array(5)), false);
});

Deno.test("isTLSHandshake - true when first byte is 0x16", () => {
  assertEquals(isTLSHandshake(new Uint8Array([0x16, 0x03, 0x03])), true);
});

Deno.test("isTLSHandshake - false for HTTP", () => {
  assertEquals(isTLSHandshake(toBytes("GET / HTTP/1.1\r\n")), false);
});

Deno.test("isHTTP2 - true for preface", () => {
  assertEquals(isHTTP2(new TextEncoder().encode("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n")), true);
});

Deno.test("isHTTP2 - false for short data", () => {
  assertEquals(isHTTP2(new Uint8Array(10)), false);
});

Deno.test("isWebSocket - true for upgrade header", () => {
  assertEquals(
    isWebSocket(toBytes("GET / HTTP/1.1\r\nUpgrade: websocket\r\n\r\n")),
    true,
  );
});

// ---------------------------------------------------------------------------
// parseHTTPVersion / parseHTTPMethod / parseHTTPStatusCode
// ---------------------------------------------------------------------------

Deno.test("parseHTTPVersion - returns version from request", () => {
  assertEquals(parseHTTPVersion(toBytes("GET / HTTP/1.1\r\n\r\n")), "1.1");
});

Deno.test("parseHTTPVersion - returns undefined for non-HTTP data", () => {
  assertEquals(parseHTTPVersion(new Uint8Array([0x16, 0x03])), undefined);
});

Deno.test("parseHTTPMethod - GET", () => {
  assertEquals(parseHTTPMethod(toBytes("GET / HTTP/1.1\r\n")), "GET");
});

Deno.test("parseHTTPMethod - POST", () => {
  assertEquals(parseHTTPMethod(toBytes("POST /api HTTP/1.1\r\n")), "POST");
});

Deno.test("parseHTTPMethod - undefined for response", () => {
  assertEquals(parseHTTPMethod(toBytes("HTTP/1.1 200 OK\r\n")), undefined);
});

Deno.test("parseHTTPStatusCode - 200", () => {
  assertEquals(parseHTTPStatusCode(toBytes("HTTP/1.1 200 OK\r\n")), 200);
});

Deno.test("parseHTTPStatusCode - 404", () => {
  assertEquals(parseHTTPStatusCode(toBytes("HTTP/1.0 404 Not Found\r\n")), 404);
});

// ---------------------------------------------------------------------------
// isCONNECTRequest
// ---------------------------------------------------------------------------

Deno.test("isCONNECTRequest - true for CONNECT", () => {
  assertEquals(isCONNECTRequest(toBytes("CONNECT example.com:443 HTTP/1.1\r\n")), true);
});

Deno.test("isCONNECTRequest - false for GET", () => {
  assertEquals(isCONNECTRequest(toBytes("GET / HTTP/1.1\r\n")), false);
});

// ---------------------------------------------------------------------------
// sniffProtocol
// ---------------------------------------------------------------------------

Deno.test("sniffProtocol - empty returns Unknown confidence 0", () => {
  const r = sniffProtocol(new Uint8Array(0));
  assertEquals(r.protocol, "Unknown");
  assertEquals(r.confidence, 0);
});

Deno.test("sniffProtocol - TLS has high confidence", () => {
  const r = sniffProtocol(new Uint8Array([0x16, 0x03, 0x03, 0x00, 0x05]));
  assertEquals(r.protocol, "TLS");
  assertEquals(r.confidence >= 0.9, true);
});

Deno.test("sniffProtocol - HTTP/1.1 GET has high confidence", () => {
  const r = sniffProtocol(toBytes("GET / HTTP/1.1\r\nHost: example.com\r\n\r\n"));
  assertEquals(r.protocol, "HTTP/1.1");
  assertEquals(r.confidence >= 0.9, true);
  assertExists(r.details);
});

Deno.test("sniffProtocol - HTTP/2 preface confidence is 1.0", () => {
  const r = sniffProtocol(new TextEncoder().encode("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"));
  assertEquals(r.protocol, "HTTP/2");
  assertEquals(r.confidence, 1.0);
});

// ---------------------------------------------------------------------------
// getHTTP2FrameType
// ---------------------------------------------------------------------------

Deno.test("getHTTP2FrameType - returns byte 3 for 9+ byte frames", () => {
  const frame = new Uint8Array(9);
  frame[3] = 0x01; // HEADERS frame
  assertEquals(getHTTP2FrameType(frame), 0x01);
});

Deno.test("getHTTP2FrameType - returns undefined for short data", () => {
  assertEquals(getHTTP2FrameType(new Uint8Array(5)), undefined);
});

// ---------------------------------------------------------------------------
// wantsHTTP2Upgrade
// ---------------------------------------------------------------------------

Deno.test("wantsHTTP2Upgrade - true for h2c upgrade", () => {
  assertEquals(
    wantsHTTP2Upgrade(toBytes("GET / HTTP/1.1\r\nUpgrade: h2c\r\n\r\n")),
    true,
  );
});

Deno.test("wantsHTTP2Upgrade - false for plain HTTP", () => {
  assertEquals(wantsHTTP2Upgrade(toBytes("GET / HTTP/1.1\r\nHost: x\r\n\r\n")), false);
});

// ---------------------------------------------------------------------------
// buildALPNExtension
// ---------------------------------------------------------------------------

Deno.test("buildALPNExtension - extension type is 0x0010", () => {
  const ext = buildALPNExtension(["h2", "http/1.1"]);
  assertEquals(ext[0], 0x00);
  assertEquals(ext[1], 0x10);
});

Deno.test("buildALPNExtension - single protocol round-trips via parseALPNProtocols", () => {
  const hello = buildClientHelloWithALPN(["h2"]);
  const protocols = parseALPNProtocols(hello);
  assertEquals(protocols, ["h2"]);
});

Deno.test("parseALPNProtocols - multiple protocols round-trip", () => {
  const hello = buildClientHelloWithALPN(["h2", "http/1.1"]);
  const protocols = parseALPNProtocols(hello);
  assertEquals(protocols, ["h2", "http/1.1"]);
});

Deno.test("parseALPNProtocols - returns empty for non-TLS data", () => {
  assertEquals(parseALPNProtocols(toBytes("GET / HTTP/1.1\r\n")), []);
});

Deno.test("parseALPNProtocols - returns empty for empty data", () => {
  assertEquals(parseALPNProtocols(new Uint8Array(0)), []);
});

// ---------------------------------------------------------------------------
// selectALPNProtocol
// ---------------------------------------------------------------------------

Deno.test("selectALPNProtocol - selects server preferred protocol", () => {
  assertEquals(selectALPNProtocol(["h2", "http/1.1"], ["http/1.1", "h2"]), "http/1.1");
});

Deno.test("selectALPNProtocol - returns undefined when no match", () => {
  assertEquals(selectALPNProtocol(["h2"], ["http/1.1"]), undefined);
});

Deno.test("selectALPNProtocol - returns undefined for empty lists", () => {
  assertEquals(selectALPNProtocol([], []), undefined);
});
