/**
 * Protocol Detection Utilities
 *
 * Auto-detect network protocols from data
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Detected protocol type
 */
export type Protocol =
  | "HTTP/1.0"
  | "HTTP/1.1"
  | "HTTP/2"
  | "HTTP/3"
  | "WebSocket"
  | "TLS"
  | "Unknown";

/**
 * Detect protocol from initial bytes
 */
export function detectProtocol(data: Uint8Array): Protocol {
  if (data.length === 0) {
    return "Unknown";
  }

  // Check for TLS handshake (starts with 0x16)
  if (data[0] === 0x16) {
    return "TLS";
  }

  // Check for HTTP/2 connection preface
  if (data.length >= 24) {
    const preface = decoder.decode(data.slice(0, 24));
    if (preface === "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n") {
      return "HTTP/2";
    }
  }

  // Check for HTTP/1.x
  const text = decoder.decode(data.slice(0, Math.min(data.length, 256)));

  // HTTP request methods
  const httpMethods = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "HEAD",
    "OPTIONS",
    "CONNECT",
    "TRACE",
  ];

  for (const method of httpMethods) {
    if (text.startsWith(method + " ")) {
      // Check for HTTP version
      if (text.includes("HTTP/1.0")) {
        return "HTTP/1.0";
      }
      if (text.includes("HTTP/1.1")) {
        return "HTTP/1.1";
      }
      return "HTTP/1.1"; // Default to 1.1
    }
  }

  // HTTP response
  if (text.startsWith("HTTP/1.0 ")) {
    return "HTTP/1.0";
  }
  if (text.startsWith("HTTP/1.1 ")) {
    return "HTTP/1.1";
  }

  // WebSocket upgrade (will be in HTTP/1.1 initially)
  if (
    text.toLowerCase().includes("upgrade: websocket") ||
    text.toLowerCase().includes("sec-websocket")
  ) {
    return "WebSocket";
  }

  return "Unknown";
}

/**
 * Check if data is HTTP request
 */
export function isHTTPRequest(data: Uint8Array): boolean {
  const protocol = detectProtocol(data);
  return protocol === "HTTP/1.0" || protocol === "HTTP/1.1" ||
    protocol === "HTTP/2";
}

/**
 * Check if data is HTTP response
 */
export function isHTTPResponse(data: Uint8Array): boolean {
  if (data.length < 12) {
    return false;
  }

  const text = decoder.decode(data.slice(0, 12));
  return text.startsWith("HTTP/1.0 ") || text.startsWith("HTTP/1.1 ");
}

/**
 * Check if data is TLS handshake
 */
export function isTLSHandshake(data: Uint8Array): boolean {
  return data.length > 0 && data[0] === 0x16;
}

/**
 * Check if data is HTTP/2
 */
export function isHTTP2(data: Uint8Array): boolean {
  if (data.length < 24) {
    return false;
  }

  const preface = decoder.decode(data.slice(0, 24));
  return preface === "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n";
}

/**
 * Check if connection is WebSocket
 */
export function isWebSocket(data: Uint8Array): boolean {
  const text = decoder.decode(data.slice(0, Math.min(data.length, 256)));
  return (
    text.toLowerCase().includes("upgrade: websocket") ||
    text.toLowerCase().includes("sec-websocket")
  );
}

/**
 * Parse HTTP version from request/response
 */
export function parseHTTPVersion(data: Uint8Array): string | undefined {
  const text = decoder.decode(data.slice(0, Math.min(data.length, 256)));

  const versionMatch = text.match(/HTTP\/(\d+\.\d+)/);
  return versionMatch ? versionMatch[1] : undefined;
}

/**
 * Parse HTTP method from request
 */
export function parseHTTPMethod(data: Uint8Array): string | undefined {
  const text = decoder.decode(data.slice(0, Math.min(data.length, 256)));

  const httpMethods = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "HEAD",
    "OPTIONS",
    "CONNECT",
    "TRACE",
  ];

  for (const method of httpMethods) {
    if (text.startsWith(method + " ")) {
      return method;
    }
  }

  return undefined;
}

/**
 * Parse HTTP status code from response
 */
export function parseHTTPStatusCode(data: Uint8Array): number | undefined {
  const text = decoder.decode(data.slice(0, Math.min(data.length, 256)));

  const statusMatch = text.match(/HTTP\/\d+\.\d+ (\d{3})/);
  return statusMatch ? parseInt(statusMatch[1], 10) : undefined;
}

/**
 * Check if request is CONNECT method (for proxying)
 */
export function isCONNECTRequest(data: Uint8Array): boolean {
  const text = decoder.decode(data.slice(0, Math.min(data.length, 256)));
  return text.startsWith("CONNECT ");
}

/**
 * Protocol sniffer with confidence score
 */
export interface ProtocolDetection {
  protocol: Protocol;
  confidence: number; // 0-1
  details?: Record<string, unknown>;
}

export function sniffProtocol(data: Uint8Array): ProtocolDetection {
  if (data.length === 0) {
    return { protocol: "Unknown", confidence: 0 };
  }

  // TLS - very high confidence
  if (data[0] === 0x16 && data.length >= 5) {
    const tlsVersion = (data[1] << 8) | data[2];
    return {
      protocol: "TLS",
      confidence: 0.99,
      details: { tlsVersion },
    };
  }

  // HTTP/2 preface - very high confidence
  if (data.length >= 24) {
    const preface = decoder.decode(data.slice(0, 24));
    if (preface === "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n") {
      return {
        protocol: "HTTP/2",
        confidence: 1.0,
      };
    }
  }

  const text = decoder.decode(data.slice(0, Math.min(data.length, 256)));

  // HTTP/1.x request - high confidence
  const httpMethods = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "HEAD",
    "OPTIONS",
    "CONNECT",
    "TRACE",
  ];

  for (const method of httpMethods) {
    if (text.startsWith(method + " ")) {
      const versionMatch = text.match(/HTTP\/(\d+\.\d+)/);
      if (versionMatch) {
        const version = versionMatch[1];
        const protocol = version === "1.0" ? "HTTP/1.0" : "HTTP/1.1";

        // Check for WebSocket upgrade
        if (
          text.toLowerCase().includes("upgrade: websocket") &&
          text.toLowerCase().includes("sec-websocket")
        ) {
          return {
            protocol: "WebSocket",
            confidence: 0.95,
            details: { upgradeFrom: protocol, method },
          };
        }

        return {
          protocol,
          confidence: 0.95,
          details: { method },
        };
      }

      // No version found but looks like HTTP
      return {
        protocol: "HTTP/1.1",
        confidence: 0.7,
        details: { method },
      };
    }
  }

  // HTTP/1.x response - high confidence
  if (text.startsWith("HTTP/1.0 ") || text.startsWith("HTTP/1.1 ")) {
    const statusMatch = text.match(/HTTP\/(\d+\.\d+) (\d{3})/);
    if (statusMatch) {
      const version = statusMatch[1];
      const statusCode = parseInt(statusMatch[2], 10);
      const protocol = version === "1.0" ? "HTTP/1.0" : "HTTP/1.1";

      return {
        protocol,
        confidence: 0.95,
        details: { statusCode },
      };
    }
  }

  // Unknown
  return {
    protocol: "Unknown",
    confidence: 0,
  };
}

/**
 * Get HTTP/2 frame type from data
 */
export function getHTTP2FrameType(data: Uint8Array): number | undefined {
  if (data.length < 9) {
    return undefined; // HTTP/2 frame header is 9 bytes
  }

  return data[3]; // Frame type is at byte 3
}

/**
 * Check if HTTP request wants HTTP/2 upgrade
 */
export function wantsHTTP2Upgrade(data: Uint8Array): boolean {
  const text = decoder.decode(data.slice(0, Math.min(data.length, 512)));
  return (
    text.toLowerCase().includes("upgrade: h2c") ||
    text.toLowerCase().includes("http2-settings:")
  );
}

/**
 * Parse ALPN protocols from TLS ClientHello by walking the TLS extension structure.
 * Looks for extension type 0x0010 (ALPN) and extracts the protocol name list.
 */
export function parseALPNProtocols(data: Uint8Array): string[] {
  // Must be a TLS handshake record (0x16) and a ClientHello (0x01)
  if (data.length < 9 || data[0] !== 0x16) return [];
  if (data[5] !== 0x01) return [];

  // Skip: record header (5) + handshake header (4) + client version (2) + random (32)
  let pos = 9 + 2 + 32;
  if (pos >= data.length) return [];

  // Skip session ID
  const sessionIdLen = data[pos++];
  pos += sessionIdLen;
  if (pos + 2 > data.length) return [];

  // Skip cipher suites
  const cipherSuitesLen = (data[pos] << 8) | data[pos + 1];
  pos += 2 + cipherSuitesLen;
  if (pos + 1 > data.length) return [];

  // Skip compression methods
  const compLen = data[pos++];
  pos += compLen;
  if (pos + 2 > data.length) return [];

  // Walk extensions looking for ALPN (type 0x0010)
  const extensionsLen = (data[pos] << 8) | data[pos + 1];
  pos += 2;
  const extensionsEnd = Math.min(pos + extensionsLen, data.length);

  while (pos + 4 <= extensionsEnd) {
    const extType = (data[pos] << 8) | data[pos + 1];
    const extLen = (data[pos + 2] << 8) | data[pos + 3];
    pos += 4;
    if (extType === 0x0010) {
      if (pos + 2 > data.length) return [];
      const listLen = (data[pos] << 8) | data[pos + 1];
      let ppos = pos + 2;
      const listEnd = ppos + listLen;
      const protocols: string[] = [];
      while (ppos < listEnd && ppos < data.length) {
        const protoLen = data[ppos++];
        if (ppos + protoLen > data.length) break;
        protocols.push(decoder.decode(data.slice(ppos, ppos + protoLen)));
        ppos += protoLen;
      }
      return protocols;
    }
    pos += extLen;
  }
  return [];
}

/**
 * Get preferred protocol from ALPN list
 */
export function selectALPNProtocol(
  clientProtocols: string[],
  serverProtocols: string[],
): string | undefined {
  // Server preference order
  for (const serverProto of serverProtocols) {
    if (clientProtocols.includes(serverProto)) {
      return serverProto;
    }
  }

  return undefined;
}

/**
 * Build a TLS ALPN extension (type 0x0010) bytes for use in ClientHello construction.
 * Returns the raw extension bytes: type(2) + length(2) + protocol_list_length(2) + protocols.
 */
export function buildALPNExtension(protocols: string[]): Uint8Array {
  // Encode each protocol name
  const encoded = protocols.map((p) => encoder.encode(p));

  // Protocol list length = sum of (1 + proto_len) for each proto
  const listLen = encoded.reduce((acc, p) => acc + 1 + p.length, 0);

  // Extension: type(2) + ext_len(2) + list_len(2) + protocols
  const extDataLen = 2 + listLen; // list_length field + protocol bytes
  const buf = new Uint8Array(4 + extDataLen); // type + length + data
  let pos = 0;

  // Extension type 0x0010 (ALPN)
  buf[pos++] = 0x00;
  buf[pos++] = 0x10;

  // Extension data length
  buf[pos++] = (extDataLen >> 8) & 0xff;
  buf[pos++] = extDataLen & 0xff;

  // Protocol list length
  buf[pos++] = (listLen >> 8) & 0xff;
  buf[pos++] = listLen & 0xff;

  // Each protocol: length(1) + bytes
  for (const proto of encoded) {
    buf[pos++] = proto.length;
    buf.set(proto, pos);
    pos += proto.length;
  }

  return buf;
}
