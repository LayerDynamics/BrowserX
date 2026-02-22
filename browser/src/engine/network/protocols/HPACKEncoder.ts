/**
 * HPACK Header Compression (RFC 7541)
 *
 * Implements HPACK compression for HTTP/2 headers including
 * static table, dynamic table, and Huffman encoding.
 */

import type { HTTPHeaders } from "./HTTPHeaders.ts";
import type { ByteBuffer } from "../../../types/identifiers.ts";

/**
 * HPACK static table entry
 */
interface StaticTableEntry {
  name: string;
  value: string;
}

/**
 * HPACK static table (RFC 7541 Appendix A)
 * Index starts at 1 (index 0 is not used)
 */
const STATIC_TABLE: StaticTableEntry[] = [
  { name: ":authority", value: "" }, // 1
  { name: ":method", value: "GET" }, // 2
  { name: ":method", value: "POST" }, // 3
  { name: ":path", value: "/" }, // 4
  { name: ":path", value: "/index.html" }, // 5
  { name: ":scheme", value: "http" }, // 6
  { name: ":scheme", value: "https" }, // 7
  { name: ":status", value: "200" }, // 8
  { name: ":status", value: "204" }, // 9
  { name: ":status", value: "206" }, // 10
  { name: ":status", value: "304" }, // 11
  { name: ":status", value: "400" }, // 12
  { name: ":status", value: "404" }, // 13
  { name: ":status", value: "500" }, // 14
  { name: "accept-charset", value: "" }, // 15
  { name: "accept-encoding", value: "gzip, deflate" }, // 16
  { name: "accept-language", value: "" }, // 17
  { name: "accept-ranges", value: "" }, // 18
  { name: "accept", value: "" }, // 19
  { name: "access-control-allow-origin", value: "" }, // 20
  { name: "age", value: "" }, // 21
  { name: "allow", value: "" }, // 22
  { name: "authorization", value: "" }, // 23
  { name: "cache-control", value: "" }, // 24
  { name: "content-disposition", value: "" }, // 25
  { name: "content-encoding", value: "" }, // 26
  { name: "content-language", value: "" }, // 27
  { name: "content-length", value: "" }, // 28
  { name: "content-location", value: "" }, // 29
  { name: "content-range", value: "" }, // 30
  { name: "content-type", value: "" }, // 31
  { name: "cookie", value: "" }, // 32
  { name: "date", value: "" }, // 33
  { name: "etag", value: "" }, // 34
  { name: "expect", value: "" }, // 35
  { name: "expires", value: "" }, // 36
  { name: "from", value: "" }, // 37
  { name: "host", value: "" }, // 38
  { name: "if-match", value: "" }, // 39
  { name: "if-modified-since", value: "" }, // 40
  { name: "if-none-match", value: "" }, // 41
  { name: "if-range", value: "" }, // 42
  { name: "if-unmodified-since", value: "" }, // 43
  { name: "last-modified", value: "" }, // 44
  { name: "link", value: "" }, // 45
  { name: "location", value: "" }, // 46
  { name: "max-forwards", value: "" }, // 47
  { name: "proxy-authenticate", value: "" }, // 48
  { name: "proxy-authorization", value: "" }, // 49
  { name: "range", value: "" }, // 50
  { name: "referer", value: "" }, // 51
  { name: "refresh", value: "" }, // 52
  { name: "retry-after", value: "" }, // 53
  { name: "server", value: "" }, // 54
  { name: "set-cookie", value: "" }, // 55
  { name: "strict-transport-security", value: "" }, // 56
  { name: "transfer-encoding", value: "" }, // 57
  { name: "user-agent", value: "" }, // 58
  { name: "vary", value: "" }, // 59
  { name: "via", value: "" }, // 60
  { name: "www-authenticate", value: "" }, // 61
];

/**
 * HPACK Huffman table (RFC 7541 Appendix B)
 * Each entry is [code, length] for the byte value at that index
 * Index 256 is EOS (End of Stream)
 */
const HUFFMAN_TABLE: [number, number][] = [
  [0x1ff8, 13],
  [0x7fffd8, 23],
  [0xfffffe2, 28],
  [0xfffffe3, 28],
  [0xfffffe4, 28],
  [0xfffffe5, 28],
  [0xfffffe6, 28],
  [0xfffffe7, 28],
  [0xfffffe8, 28],
  [0xffffea, 24],
  [0x3ffffffc, 30],
  [0xfffffe9, 28],
  [0xfffffea, 28],
  [0x3ffffffd, 30],
  [0xfffffeb, 28],
  [0xfffffec, 28],
  [0xfffffed, 28],
  [0xfffffee, 28],
  [0xfffffef, 28],
  [0xffffff0, 28],
  [0xffffff1, 28],
  [0xffffff2, 28],
  [0x3ffffffe, 30],
  [0xffffff3, 28],
  [0xffffff4, 28],
  [0xffffff5, 28],
  [0xffffff6, 28],
  [0xffffff7, 28],
  [0xffffff8, 28],
  [0xffffff9, 28],
  [0xffffffa, 28],
  [0xffffffb, 28],
  [0x14, 6],
  [0x3f8, 10],
  [0x3f9, 10],
  [0xffa, 12],
  [0x1ff9, 13],
  [0x15, 6],
  [0xf8, 8],
  [0x7fa, 11],
  [0x3fa, 10],
  [0x3fb, 10],
  [0xf9, 8],
  [0x7fb, 11],
  [0xfa, 8],
  [0x16, 6],
  [0x17, 6],
  [0x18, 6],
  [0x0, 5],
  [0x1, 5],
  [0x2, 5],
  [0x19, 6],
  [0x1a, 6],
  [0x1b, 6],
  [0x1c, 6],
  [0x1d, 6],
  [0x1e, 6],
  [0x1f, 6],
  [0x5c, 7],
  [0xfb, 8],
  [0x7ffc, 15],
  [0x20, 6],
  [0xffb, 12],
  [0x3fc, 10],
  [0x1ffa, 13],
  [0x21, 6],
  [0x5d, 7],
  [0x5e, 7],
  [0x5f, 7],
  [0x60, 7],
  [0x61, 7],
  [0x62, 7],
  [0x63, 7],
  [0x64, 7],
  [0x65, 7],
  [0x66, 7],
  [0x67, 7],
  [0x68, 7],
  [0x69, 7],
  [0x6a, 7],
  [0x6b, 7],
  [0x6c, 7],
  [0x6d, 7],
  [0x6e, 7],
  [0x6f, 7],
  [0x70, 7],
  [0x71, 7],
  [0x72, 7],
  [0xfc, 8],
  [0x73, 7],
  [0xfd, 8],
  [0x1ffb, 13],
  [0x7fff0, 19],
  [0x1ffc, 13],
  [0x3ffc, 14],
  [0x22, 6],
  [0x7ffd, 15],
  [0x3, 5],
  [0x23, 6],
  [0x4, 5],
  [0x24, 6],
  [0x5, 5],
  [0x25, 6],
  [0x26, 6],
  [0x27, 6],
  [0x6, 5],
  [0x74, 7],
  [0x75, 7],
  [0x28, 6],
  [0x29, 6],
  [0x2a, 6],
  [0x7, 5],
  [0x2b, 6],
  [0x76, 7],
  [0x2c, 6],
  [0x8, 5],
  [0x9, 5],
  [0x2d, 6],
  [0x77, 7],
  [0x78, 7],
  [0x79, 7],
  [0x7a, 7],
  [0x7b, 7],
  [0x7ffe, 15],
  [0x7fc, 11],
  [0x3ffd, 14],
  [0x1ffd, 13],
  [0xffffffc, 28],
  [0xfffe6, 20],
  [0x3fffd2, 22],
  [0xfffe7, 20],
  [0xfffe8, 20],
  [0x3fffd3, 22],
  [0x3fffd4, 22],
  [0x3fffd5, 22],
  [0x7fffd9, 23],
  [0x3fffd6, 22],
  [0x7fffda, 23],
  [0x7fffdb, 23],
  [0x7fffdc, 23],
  [0x7fffdd, 23],
  [0x7fffde, 23],
  [0xffffeb, 24],
  [0x7fffdf, 23],
  [0xffffec, 24],
  [0xffffed, 24],
  [0x3fffd7, 22],
  [0x7fffe0, 23],
  [0xffffee, 24],
  [0x7fffe1, 23],
  [0x7fffe2, 23],
  [0x7fffe3, 23],
  [0x7fffe4, 23],
  [0x1fffdc, 21],
  [0x3fffd8, 22],
  [0x7fffe5, 23],
  [0x3fffd9, 22],
  [0x7fffe6, 23],
  [0x7fffe7, 23],
  [0xffffef, 24],
  [0x3fffda, 22],
  [0x1fffdd, 21],
  [0xfffe9, 20],
  [0x3fffdb, 22],
  [0x3fffdc, 22],
  [0x7fffe8, 23],
  [0x7fffe9, 23],
  [0x1fffde, 21],
  [0x7fffea, 23],
  [0x3fffdd, 22],
  [0x3fffde, 22],
  [0xfffff0, 24],
  [0x1fffdf, 21],
  [0x3fffdf, 22],
  [0x7fffeb, 23],
  [0x7fffec, 23],
  [0x1fffe0, 21],
  [0x1fffe1, 21],
  [0x3fffe0, 22],
  [0x1fffe2, 21],
  [0x7fffed, 23],
  [0x3fffe1, 22],
  [0x7fffee, 23],
  [0x7fffef, 23],
  [0xfffea, 20],
  [0x3fffe2, 22],
  [0x3fffe3, 22],
  [0x3fffe4, 22],
  [0x7ffff0, 23],
  [0x3fffe5, 22],
  [0x3fffe6, 22],
  [0x7ffff1, 23],
  [0x3ffffe0, 26],
  [0x3ffffe1, 26],
  [0xfffeb, 20],
  [0x7fff1, 19],
  [0x3fffe7, 22],
  [0x7ffff2, 23],
  [0x3fffe8, 22],
  [0x1ffffec, 25],
  [0x3ffffe2, 26],
  [0x3ffffe3, 26],
  [0x3ffffe4, 26],
  [0x7ffffde, 27],
  [0x7ffffdf, 27],
  [0x3ffffe5, 26],
  [0xfffff1, 24],
  [0x1ffffed, 25],
  [0x7fff2, 19],
  [0x1fffe3, 21],
  [0x3ffffe6, 26],
  [0x7ffffe0, 27],
  [0x7ffffe1, 27],
  [0x3ffffe7, 26],
  [0x7ffffe2, 27],
  [0xfffff2, 24],
  [0x1fffe4, 21],
  [0x1fffe5, 21],
  [0x3ffffe8, 26],
  [0x3ffffe9, 26],
  [0xffffffd, 28],
  [0x7ffffe3, 27],
  [0x7ffffe4, 27],
  [0x7ffffe5, 27],
  [0xfffec, 20],
  [0xfffff3, 24],
  [0xfffed, 20],
  [0x1fffe6, 21],
  [0x3fffe9, 22],
  [0x1fffe7, 21],
  [0x1fffe8, 21],
  [0x7ffff3, 23],
  [0x3fffea, 22],
  [0x3fffeb, 22],
  [0x1ffffee, 25],
  [0x1ffffef, 25],
  [0xfffff4, 24],
  [0xfffff5, 24],
  [0x3ffffea, 26],
  [0x7ffff4, 23],
  [0x3ffffeb, 26],
  [0x7ffffe6, 27],
  [0x3ffffec, 26],
  [0x3ffffed, 26],
  [0x7ffffe7, 27],
  [0x7ffffe8, 27],
  [0x7ffffe9, 27],
  [0x7ffffea, 27],
  [0x7ffffeb, 27],
  [0xffffffe, 28],
  [0x7ffffec, 27],
  [0x7ffffed, 27],
  [0x7ffffee, 27],
  [0x7ffffef, 27],
  [0x7fffff0, 27],
  [0x3ffffee, 26],
  [0x3fffffff, 30], // EOS (index 256)
];

/**
 * Encode bytes using Huffman coding
 */
function huffmanEncode(data: Uint8Array): number[] {
  const result: number[] = [];
  // Use BigInt to avoid 32-bit overflow with long Huffman codes (up to 30 bits)
  let buffer = 0n;
  let bufferBits = 0;

  for (const byte of data) {
    const [code, length] = HUFFMAN_TABLE[byte];
    buffer = (buffer << BigInt(length)) | BigInt(code);
    bufferBits += length;

    while (bufferBits >= 8) {
      bufferBits -= 8;
      result.push(Number((buffer >> BigInt(bufferBits)) & 0xffn));
    }
  }

  // Pad with EOS prefix if needed
  if (bufferBits > 0) {
    const [eosCode] = HUFFMAN_TABLE[256]; // EOS
    buffer = (buffer << BigInt(8 - bufferBits)) | BigInt(eosCode >> (30 - (8 - bufferBits)));
    result.push(Number(buffer & 0xffn));
  }

  return result;
}

/**
 * Decode Huffman-encoded bytes
 * Uses a simple bit-by-bit approach (could be optimized with lookup tables)
 */
function huffmanDecode(data: Uint8Array): Uint8Array {
  const result: number[] = [];
  let buffer = 0;
  let bufferBits = 0;

  // Build a simple decode map for common short codes
  const decodeMap = new Map<string, number>();
  for (let i = 0; i < 256; i++) {
    const [code, length] = HUFFMAN_TABLE[i];
    const key = `${code}:${length}`;
    decodeMap.set(key, i);
  }

  for (const byte of data) {
    buffer = (buffer << 8) | byte;
    bufferBits += 8;

    // Try to decode symbols
    while (bufferBits >= 5) { // Minimum code length is 5
      let decoded = false;

      // Try lengths from 5 to min(30, bufferBits)
      for (let len = 5; len <= Math.min(30, bufferBits); len++) {
        const code = (buffer >> (bufferBits - len)) & ((1 << len) - 1);
        const key = `${code}:${len}`;

        if (decodeMap.has(key)) {
          result.push(decodeMap.get(key)!);
          bufferBits -= len;
          buffer &= (1 << bufferBits) - 1;
          decoded = true;
          break;
        }
      }

      if (!decoded) {
        // Check for EOS (padding)
        const [eosCode, eosLen] = HUFFMAN_TABLE[256];
        if (bufferBits <= 7) {
          // Remaining bits should be EOS prefix padding
          const padMask = (1 << bufferBits) - 1;
          const eosPad = (eosCode >> (eosLen - bufferBits)) & padMask;
          if ((buffer & padMask) === eosPad) {
            break; // Valid EOS padding, done
          }
        }
        break; // Can't decode more
      }
    }
  }

  return new Uint8Array(result);
}

/**
 * HPACK dynamic table
 */
class DynamicTable {
  private entries: Array<{ name: string; value: string }> = [];
  private size: number = 0;
  private maxSize: number = 4096; // Default dynamic table size

  /**
   * Add entry to dynamic table
   * Entries are added at index 0, pushing existing entries back
   */
  add(name: string, value: string): void {
    const entrySize = 32 + name.length + value.length; // RFC 7541 Section 4.1

    if (entrySize > this.maxSize) {
      // Entry too large, clear table
      this.entries = [];
      this.size = 0;
      return;
    }

    // Add at beginning (index 0)
    this.entries.unshift({ name, value });
    this.size += entrySize;

    // Evict entries from the end if size exceeded
    while (this.size > this.maxSize && this.entries.length > 0) {
      const evicted = this.entries.pop()!;
      this.size -= 32 + evicted.name.length + evicted.value.length;
    }
  }

  /**
   * Get entry from dynamic table by index (0-based)
   */
  get(index: number): { name: string; value: string } | undefined {
    return this.entries[index];
  }

  /**
   * Get number of entries in dynamic table
   */
  getLength(): number {
    return this.entries.length;
  }

  /**
   * Update max size and evict entries if necessary
   */
  updateMaxSize(maxSize: number): void {
    this.maxSize = maxSize;

    // Evict entries if new size is smaller
    while (this.size > this.maxSize && this.entries.length > 0) {
      const evicted = this.entries.pop()!;
      this.size -= 32 + evicted.name.length + evicted.value.length;
    }
  }
}

/**
 * HPACK encoder
 */
export class HPACKEncoder {
  private dynamicTable: DynamicTable = new DynamicTable();

  /**
   * Encode headers using HPACK
   *
   * @param headers - HTTP headers to encode
   * @returns Encoded header block
   */
  /** Headers that must never be indexed per security best practices */
  private static readonly SENSITIVE_HEADERS = new Set([
    "authorization",
    "cookie",
    "set-cookie",
    "proxy-authorization",
  ]);

  encode(headers: HTTPHeaders, sensitiveHeaders?: Set<string>): ByteBuffer {
    const bytes: number[] = [];

    for (const [name, value] of headers.entries()) {
      const nameLower = name.toLowerCase();
      const isSensitive = HPACKEncoder.SENSITIVE_HEADERS.has(nameLower) ||
        sensitiveHeaders?.has(nameLower);

      if (isSensitive) {
        // Literal never indexed — RFC 7541 §6.2.3
        this.encodeNeverIndexed(bytes, name, value);
        continue;
      }

      const result = this.findInTable(name, value);

      if (result.fullMatch) {
        // Indexed header field (RFC 7541 Section 6.1)
        // Format: 1xxxxxxx (top bit = 1)
        const indexBytes = this.encodeInteger(result.index, 7);
        indexBytes[0] |= 0x80; // Set top bit
        bytes.push(...indexBytes);
      } else if (result.index > 0) {
        // Literal header with incremental indexing - indexed name (RFC 7541 Section 6.2.1)
        // Format: 01xxxxxx (top 2 bits = 01)
        const indexBytes = this.encodeInteger(result.index, 6);
        indexBytes[0] |= 0x40; // Set pattern 01
        bytes.push(...indexBytes);

        // Encode value
        const valueBytes = this.encodeString(value, false);
        bytes.push(...valueBytes);

        // Add to dynamic table
        this.dynamicTable.add(name, value);
      } else {
        // Literal header with incremental indexing - new name (RFC 7541 Section 6.2.1)
        // Format: 01000000 (6-bit index = 0, meaning new name)
        bytes.push(0x40);

        // Encode name
        const nameBytes = this.encodeString(name, false);
        bytes.push(...nameBytes);

        // Encode value
        const valueBytes = this.encodeString(value, false);
        bytes.push(...valueBytes);

        // Add to dynamic table
        this.dynamicTable.add(name, value);
      }
    }

    return new Uint8Array(bytes);
  }

  /**
   * Encode a header as "never indexed" (0001xxxx) — RFC 7541 §6.2.3
   * Used for sensitive headers like Authorization, Cookie
   */
  private encodeNeverIndexed(bytes: number[], name: string, value: string): void {
    const result = this.findInTable(name, value);

    if (result.index > 0) {
      // Indexed name (use name index even on full match — value still encoded separately for never-indexed)
      const indexBytes = this.encodeInteger(result.index, 4);
      indexBytes[0] |= 0x10; // Set pattern 0001
      bytes.push(...indexBytes);
    } else {
      // New name
      bytes.push(0x10); // 0001 0000 — 4-bit index = 0
      const nameBytes = this.encodeString(name, false);
      bytes.push(...nameBytes);
    }

    const valueBytes = this.encodeString(value, false);
    bytes.push(...valueBytes);
    // Do NOT add to dynamic table
  }

  /**
   * Encode integer with prefix (RFC 7541 Section 5.1)
   *
   * @param value - Integer value
   * @param prefixBits - Number of prefix bits (1-8)
   * @returns Encoded integer bytes
   */
  private encodeInteger(value: number, prefixBits: number): number[] {
    const maxPrefixValue = (1 << prefixBits) - 1;

    if (value < maxPrefixValue) {
      return [value];
    }

    const bytes: number[] = [maxPrefixValue];
    value -= maxPrefixValue;

    while (value >= 128) {
      bytes.push((value % 128) + 128);
      value = Math.floor(value / 128);
    }

    bytes.push(value);
    return bytes;
  }

  /**
   * Encode string (RFC 7541 Section 5.2)
   *
   * @param value - String value
   * @param useHuffman - Whether to use Huffman encoding
   * @returns Encoded string bytes
   */
  private encodeString(value: string, useHuffman: boolean): number[] {
    const stringBytes = new TextEncoder().encode(value);

    if (useHuffman) {
      // Huffman encode the string
      const huffmanBytes = huffmanEncode(stringBytes);
      const lengthBytes = this.encodeInteger(huffmanBytes.length, 7);
      // Set H bit (bit 7) to indicate Huffman encoding
      lengthBytes[0] |= 0x80;
      return [...lengthBytes, ...huffmanBytes];
    }

    // No Huffman encoding - just raw bytes
    const lengthBytes = this.encodeInteger(stringBytes.length, 7);
    return [...lengthBytes, ...Array.from(stringBytes)];
  }

  /**
   * Find header in static or dynamic table
   *
   * @param name - Header name
   * @param value - Header value (optional)
   * @returns Object with index and whether it's a full match
   */
  private findInTable(name: string, value?: string): { index: number; fullMatch: boolean } {
    // Search static table
    for (let i = 0; i < STATIC_TABLE.length; i++) {
      if (STATIC_TABLE[i].name === name) {
        if (value !== undefined && STATIC_TABLE[i].value === value) {
          return { index: i + 1, fullMatch: true }; // Static table indices start at 1
        }
        if (value === undefined || STATIC_TABLE[i].value === "") {
          return { index: i + 1, fullMatch: false };
        }
      }
    }

    // Search dynamic table
    const dynamicLength = this.dynamicTable.getLength();
    for (let i = 0; i < dynamicLength; i++) {
      const entry = this.dynamicTable.get(i);
      if (entry && entry.name === name) {
        const tableIndex = STATIC_TABLE.length + 1 + i; // Dynamic indices start after static table
        if (value !== undefined && entry.value === value) {
          return { index: tableIndex, fullMatch: true };
        }
        if (value === undefined) {
          return { index: tableIndex, fullMatch: false };
        }
      }
    }

    return { index: 0, fullMatch: false };
  }
}

/**
 * HPACK decoder
 */
export class HPACKDecoder {
  private dynamicTable: DynamicTable = new DynamicTable();

  /**
   * Decode HPACK-encoded headers
   *
   * @param data - Encoded header block
   * @returns Decoded HTTP headers
   */
  decode(data: ByteBuffer): HTTPHeaders {
    const headers = new Map<string, string>();
    let offset = 0;

    while (offset < data.byteLength) {
      const byte = data[offset];

      if ((byte & 0x80) !== 0) {
        // Indexed header field (1xxxxxxx)
        const { value: index, bytesRead } = this.decodeInteger(data, offset, 7);
        offset += bytesRead;

        const entry = this.getTableEntry(index);
        if (entry) {
          headers.set(entry.name, entry.value);
        }
      } else if ((byte & 0x40) !== 0) {
        // Literal with incremental indexing (01xxxxxx)
        const { value: nameIndex, bytesRead: indexBytes } = this.decodeInteger(
          data,
          offset,
          6,
        );
        offset += indexBytes;

        let name: string;
        if (nameIndex === 0) {
          // New name
          const { value: decodedName, bytesRead: nameBytes } = this.decodeString(
            data,
            offset,
          );
          offset += nameBytes;
          name = decodedName;
        } else {
          // Indexed name
          const entry = this.getTableEntry(nameIndex);
          name = entry?.name || "";
        }

        // Decode value
        const { value, bytesRead: valueBytes } = this.decodeString(data, offset);
        offset += valueBytes;

        headers.set(name, value);
        this.dynamicTable.add(name, value);
      } else if ((byte & 0xF0) === 0x00) {
        // Literal without indexing (0000xxxx) — RFC 7541 §6.2.2
        const { value: nameIndex, bytesRead: indexBytes } = this.decodeInteger(
          data,
          offset,
          4,
        );
        offset += indexBytes;

        let name: string;
        if (nameIndex === 0) {
          const { value: decodedName, bytesRead: nameBytes } = this.decodeString(
            data,
            offset,
          );
          offset += nameBytes;
          name = decodedName;
        } else {
          const entry = this.getTableEntry(nameIndex);
          name = entry?.name || "";
        }

        const { value, bytesRead: valueBytes } = this.decodeString(data, offset);
        offset += valueBytes;

        headers.set(name, value);
        // Do NOT add to dynamic table
      } else if ((byte & 0xF0) === 0x10) {
        // Literal never indexed (0001xxxx) — RFC 7541 §6.2.3
        const { value: nameIndex, bytesRead: indexBytes } = this.decodeInteger(
          data,
          offset,
          4,
        );
        offset += indexBytes;

        let name: string;
        if (nameIndex === 0) {
          const { value: decodedName, bytesRead: nameBytes } = this.decodeString(
            data,
            offset,
          );
          offset += nameBytes;
          name = decodedName;
        } else {
          const entry = this.getTableEntry(nameIndex);
          name = entry?.name || "";
        }

        const { value, bytesRead: valueBytes } = this.decodeString(data, offset);
        offset += valueBytes;

        headers.set(name, value);
        // Do NOT add to dynamic table (sensitive header)
      } else if ((byte & 0xE0) === 0x20) {
        // Dynamic table size update (001xxxxx) — RFC 7541 §6.3
        const { value: newSize, bytesRead } = this.decodeInteger(data, offset, 5);
        offset += bytesRead;
        this.dynamicTable.updateMaxSize(newSize);
      } else {
        // Unknown encoding — skip byte to avoid infinite loop
        offset++;
      }
    }

    return headers;
  }

  /**
   * Get entry from static or dynamic table by index
   */
  private getTableEntry(index: number): { name: string; value: string } | undefined {
    if (index === 0) {
      return undefined;
    }

    // Static table (1-61)
    if (index <= STATIC_TABLE.length) {
      return STATIC_TABLE[index - 1];
    }

    // Dynamic table
    const dynamicIndex = index - STATIC_TABLE.length - 1;
    return this.dynamicTable.get(dynamicIndex);
  }

  /**
   * Decode integer with prefix (RFC 7541 Section 5.1)
   */
  private decodeInteger(data: ByteBuffer, offset: number, prefixBits: number): {
    value: number;
    bytesRead: number;
  } {
    const mask = (1 << prefixBits) - 1;
    let value = data[offset] & mask;
    let bytesRead = 1;

    if (value < mask) {
      return { value, bytesRead };
    }

    let m = 0;
    while (offset + bytesRead < data.byteLength) {
      const byte = data[offset + bytesRead];
      bytesRead++;

      value += (byte & 0x7F) * Math.pow(2, m);
      m += 7;

      if ((byte & 0x80) === 0) {
        break;
      }
    }

    return { value, bytesRead };
  }

  /**
   * Decode string (RFC 7541 Section 5.2)
   */
  private decodeString(data: ByteBuffer, offset: number): {
    value: string;
    bytesRead: number;
  } {
    const isHuffmanEncoded = (data[offset] & 0x80) !== 0;
    const { value: length, bytesRead: lengthBytes } = this.decodeInteger(data, offset, 7);
    const totalBytes = lengthBytes + length;
    const stringData = data.slice(offset + lengthBytes, offset + totalBytes);

    if (isHuffmanEncoded) {
      // Huffman decode the string
      const decodedBytes = huffmanDecode(new Uint8Array(stringData));
      return {
        value: new TextDecoder().decode(decodedBytes),
        bytesRead: totalBytes,
      };
    }

    return {
      value: new TextDecoder().decode(stringData),
      bytesRead: totalBytes,
    };
  }
}
