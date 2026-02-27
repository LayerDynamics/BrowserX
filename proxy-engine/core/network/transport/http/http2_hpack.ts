/**
 * HPACK Header Compression
 *
 * Simplified implementation of HPACK (RFC 7541) for HTTP/2 header compression
 */

/**
 * HPACK Huffman table (RFC 7541, Appendix B)
 * Each entry: [code, bitLength]
 */
const HUFFMAN_TABLE: Array<[number, number]> = [
  [0x1ff8, 13], [0x7fffd8, 23], [0xfffffe2, 28], [0xfffffe3, 28],
  [0xfffffe4, 28], [0xfffffe5, 28], [0xfffffe6, 28], [0xfffffe7, 28],
  [0xfffffe8, 28], [0xffffea, 24], [0x3ffffffc, 30], [0xfffffe9, 28],
  [0xfffffea, 28], [0x3ffffffd, 30], [0xfffffeb, 28], [0xfffffec, 28],
  [0xfffffed, 28], [0xfffffee, 28], [0xfffffef, 28], [0xffffff0, 28],
  [0xffffff1, 28], [0xffffff2, 28], [0x3ffffffe, 30], [0xffffff3, 28],
  [0xffffff4, 28], [0xffffff5, 28], [0xffffff6, 28], [0xffffff7, 28],
  [0xffffff8, 28], [0xffffff9, 28], [0xffffffa, 28], [0xffffffb, 28],
  [0x14, 6], [0x3f8, 10], [0x3f9, 10], [0xffa, 12],
  [0x1ff9, 13], [0x15, 6], [0xf8, 8], [0x7fa, 11],
  [0x3fa, 10], [0x3fb, 10], [0xf9, 8], [0x7fb, 11],
  [0xfa, 8], [0x16, 6], [0x17, 6], [0x18, 6],
  [0x0, 5], [0x1, 5], [0x2, 5], [0x19, 6],
  [0x1a, 6], [0x1b, 6], [0x1c, 6], [0x1d, 6],
  [0x1e, 6], [0x1f, 6], [0x5c, 7], [0xfb, 8],
  [0x7ffc, 15], [0x20, 6], [0xffb, 12], [0x3fc, 10],
  [0x1ffa, 13], [0x21, 6], [0x5d, 7], [0x5e, 7],
  [0x5f, 7], [0x60, 7], [0x61, 7], [0x62, 7],
  [0x63, 7], [0x64, 7], [0x65, 7], [0x66, 7],
  [0x67, 7], [0x68, 7], [0x69, 7], [0x6a, 7],
  [0x6b, 7], [0x6c, 7], [0x6d, 7], [0x6e, 7],
  [0x6f, 7], [0x70, 7], [0x71, 7], [0x72, 7],
  [0xfc, 8], [0x73, 7], [0xfd, 8], [0x1ffb, 13],
  [0x7fff0, 19], [0x1ffc, 13], [0x3ffc, 14], [0x22, 6],
  [0x7ffd, 15], [0x3, 5], [0x23, 6], [0x4, 5],
  [0x24, 6], [0x5, 5], [0x25, 6], [0x26, 6],
  [0x27, 6], [0x6, 5], [0x74, 7], [0x75, 7],
  [0x28, 6], [0x29, 6], [0x2a, 6], [0x7, 5],
  [0x2b, 6], [0x76, 7], [0x2c, 6], [0x8, 5],
  [0x9, 5], [0x2d, 6], [0x77, 7], [0x78, 7],
  [0x79, 7], [0x7a, 7], [0x7b, 7], [0x7fffe, 19],
  [0x7fc, 11], [0x3ffd, 14], [0x1ffd, 13], [0xffffffc, 28],
  [0xfffe6, 20], [0x3fffd2, 22], [0xfffe7, 20], [0xfffe8, 20],
  [0x3fffd3, 22], [0x3fffd4, 22], [0x3fffd5, 22], [0x7fffd9, 23],
  [0x3fffd6, 22], [0x7fffda, 23], [0x7fffdb, 23], [0x7fffdc, 23],
  [0x7fffdd, 23], [0x7fffde, 23], [0xffffeb, 24], [0x7fffdf, 23],
  [0xffffec, 24], [0xffffed, 24], [0x3fffd7, 22], [0x7fffe0, 23],
  [0xffffee, 24], [0x7fffe1, 23], [0x7fffe2, 23], [0x7fffe3, 23],
  [0x7fffe4, 23], [0x1fffdc, 21], [0x3fffd8, 22], [0x7fffe5, 23],
  [0x3fffd9, 22], [0x7fffe6, 23], [0x7fffe7, 23], [0xffffef, 24],
  [0x3fffda, 22], [0x1fffdd, 21], [0xfffe9, 20], [0x3fffdb, 22],
  [0x3fffdc, 22], [0x7fffe8, 23], [0x7fffe9, 23], [0x1fffde, 21],
  [0x7fffea, 23], [0x3fffdd, 22], [0x3fffde, 22], [0xfffff0, 24],
  [0x1fffdf, 21], [0x3fffdf, 22], [0x7fffeb, 23], [0x7fffec, 23],
  [0x1fffe0, 21], [0x1fffe1, 21], [0x3fffe0, 22], [0x1fffe2, 21],
  [0x7fffed, 23], [0x3fffe1, 22], [0x7fffee, 23], [0x7fffef, 23],
  [0xfffea, 20], [0x3fffe2, 22], [0x3fffe3, 22], [0x3fffe4, 22],
  [0x7ffff0, 23], [0x3fffe5, 22], [0x3fffe6, 22], [0x7ffff1, 23],
  [0x3ffffe0, 26], [0x3ffffe1, 26], [0xfffeb, 20], [0x7fff1, 19],
  [0x3fffe7, 22], [0x7ffff2, 23], [0x3fffe8, 22], [0x1ffffec, 25],
  [0x3ffffe2, 26], [0x3ffffe3, 26], [0x3ffffe4, 26], [0x7ffffde, 27],
  [0x7ffffdf, 27], [0x3ffffe5, 26], [0xfffff1, 24], [0x1ffffed, 25],
  [0x7fff2, 19], [0x1fffe3, 21], [0x3ffffe6, 26], [0x7ffffe0, 27],
  [0x7ffffe1, 27], [0x3ffffe7, 26], [0x7ffffe2, 27], [0xfffff2, 24],
  [0x1fffe4, 21], [0x1fffe5, 21], [0x3ffffe8, 26], [0x3ffffe9, 26],
  [0xffffffd, 28], [0x7ffffe3, 27], [0x7ffffe4, 27], [0x7ffffe5, 27],
  [0xfffec, 20], [0xfffff3, 24], [0xfffed, 20], [0x1fffe6, 21],
  [0x3fffe9, 22], [0x1fffe7, 21], [0x1fffe8, 21], [0x7ffff3, 23],
  [0x3fffea, 22], [0x3fffeb, 22], [0x1ffffee, 25], [0x1ffffef, 25],
  [0xfffff4, 24], [0xfffff5, 24], [0x3ffffea, 26], [0x7ffff4, 23],
  [0x3ffffeb, 26], [0x7ffffe6, 27], [0x3ffffec, 26], [0x3ffffed, 26],
  [0x7ffffe7, 27], [0x7ffffe8, 27], [0x7ffffe9, 27], [0x7ffffea, 27],
  [0x7ffffeb, 27], [0xffffffe, 28], [0x7ffffec, 27], [0x7ffffed, 27],
  [0x7ffffee, 27], [0x7ffffef, 27], [0x7fffff0, 27], [0x3ffffee, 26],
  // EOS = [0x3fffffff, 30]  (index 256, not used in decoding output)
];

/**
 * Huffman decoder node for the binary tree
 */
interface HuffmanNode {
  symbol?: number;
  left?: HuffmanNode;  // 0 bit
  right?: HuffmanNode; // 1 bit
}

/**
 * Build the Huffman decoding tree from the table
 */
function buildHuffmanTree(): HuffmanNode {
  const root: HuffmanNode = {};

  // Add symbols 0-255 plus EOS (symbol 256) to the tree
  const allSymbols: Array<[number, number, number]> = [];
  for (let sym = 0; sym < 256; sym++) {
    const [code, bitLen] = HUFFMAN_TABLE[sym];
    allSymbols.push([sym, code, bitLen]);
  }
  // EOS symbol (index 256): code 0x3fffffff, 30 bits
  allSymbols.push([256, 0x3fffffff, 30]);

  for (const [sym, code, bitLen] of allSymbols) {
    let node = root;

    for (let i = bitLen - 1; i >= 0; i--) {
      const bit = (code >> i) & 1;
      if (bit === 0) {
        if (!node.left) node.left = {};
        node = node.left;
      } else {
        if (!node.right) node.right = {};
        node = node.right;
      }
    }

    node.symbol = sym;
  }

  return root;
}

const HUFFMAN_ROOT = buildHuffmanTree();

/**
 * Decode Huffman-encoded bytes per RFC 7541 Appendix B
 */
export function decodeHuffman(encoded: Uint8Array): string {
  const decoded: number[] = [];
  let node = HUFFMAN_ROOT;

  let bitsConsumedSinceLastSymbol = 0;

  for (let byteIdx = 0; byteIdx < encoded.length; byteIdx++) {
    const byte = encoded[byteIdx];
    for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
      const bit = (byte >> bitIdx) & 1;
      node = bit === 0 ? node.left! : node.right!;
      bitsConsumedSinceLastSymbol++;

      if (node.symbol !== undefined) {
        // RFC 7541 §5.2: EOS symbol MUST NOT appear in the decoded stream
        if (node.symbol === 256) {
          throw new Error("HPACK COMPRESSION_ERROR: EOS symbol decoded in Huffman stream");
        }
        decoded.push(node.symbol);
        node = HUFFMAN_ROOT;
        bitsConsumedSinceLastSymbol = 0;
      }
    }
  }

  // RFC 7541 §5.2: Padding validation
  // Padding MUST NOT exceed 7 bits
  if (bitsConsumedSinceLastSymbol > 7) {
    throw new Error("HPACK COMPRESSION_ERROR: Huffman padding exceeds 7 bits");
  }

  // Remaining padding bits MUST all be 1s (i.e., node reached only via right branches)
  if (node !== HUFFMAN_ROOT) {
    // Verify padding is all 1s by checking we're on the all-right path from root
    let checkNode = HUFFMAN_ROOT;
    for (let i = 0; i < bitsConsumedSinceLastSymbol; i++) {
      checkNode = checkNode.right!;
    }
    if (checkNode !== node) {
      throw new Error("HPACK COMPRESSION_ERROR: Huffman padding contains non-1 bits");
    }
  }

  return String.fromCharCode(...decoded);
}

/**
 * Huffman-encode a string per RFC 7541 Appendix B
 */
export function encodeHuffman(str: string): Uint8Array {
  let totalBits = 0;
  for (let i = 0; i < str.length; i++) {
    totalBits += HUFFMAN_TABLE[str.charCodeAt(i)][1];
  }

  const bytes = new Uint8Array(Math.ceil(totalBits / 8));
  let bytePos = 0;
  let bitPos = 7; // current bit position within current byte (7=MSB)

  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const [code, bitLen] = HUFFMAN_TABLE[charCode];

    for (let j = bitLen - 1; j >= 0; j--) {
      if ((code >> j) & 1) {
        bytes[bytePos] |= (1 << bitPos);
      }
      bitPos--;
      if (bitPos < 0) {
        bitPos = 7;
        bytePos++;
      }
    }
  }

  // Pad remaining bits with 1s (EOS prefix)
  if (bitPos < 7) {
    for (let i = bitPos; i >= 0; i--) {
      bytes[bytePos] |= (1 << i);
    }
  }

  return bytes;
}

/**
 * Static table entries (from RFC 7541 Appendix A)
 */
const STATIC_TABLE: Array<[string, string]> = [
  [":authority", ""],
  [":method", "GET"],
  [":method", "POST"],
  [":path", "/"],
  [":path", "/index.html"],
  [":scheme", "http"],
  [":scheme", "https"],
  [":status", "200"],
  [":status", "204"],
  [":status", "206"],
  [":status", "304"],
  [":status", "400"],
  [":status", "404"],
  [":status", "500"],
  ["accept-charset", ""],
  ["accept-encoding", "gzip, deflate"],
  ["accept-language", ""],
  ["accept-ranges", ""],
  ["accept", ""],
  ["access-control-allow-origin", ""],
  ["age", ""],
  ["allow", ""],
  ["authorization", ""],
  ["cache-control", ""],
  ["content-disposition", ""],
  ["content-encoding", ""],
  ["content-language", ""],
  ["content-length", ""],
  ["content-location", ""],
  ["content-range", ""],
  ["content-type", ""],
  ["cookie", ""],
  ["date", ""],
  ["etag", ""],
  ["expect", ""],
  ["expires", ""],
  ["from", ""],
  ["host", ""],
  ["if-match", ""],
  ["if-modified-since", ""],
  ["if-none-match", ""],
  ["if-range", ""],
  ["if-unmodified-since", ""],
  ["last-modified", ""],
  ["link", ""],
  ["location", ""],
  ["max-forwards", ""],
  ["proxy-authenticate", ""],
  ["proxy-authorization", ""],
  ["range", ""],
  ["referer", ""],
  ["refresh", ""],
  ["retry-after", ""],
  ["server", ""],
  ["set-cookie", ""],
  ["strict-transport-security", ""],
  ["transfer-encoding", ""],
  ["user-agent", ""],
  ["vary", ""],
  ["via", ""],
  ["www-authenticate", ""],
];

/**
 * Maximum decompressed header size to prevent HPACK bomb attacks (64KB)
 */
export const MAX_DECOMPRESSED_HEADER_SIZE = 65536;

/**
 * HPACK encoder/decoder
 */
export class HPACKCodec {
  private dynamicTable: Array<[string, string]> = [];
  private dynamicTableStart = 0; // logical start index (entries before this are evicted)
  private maxDynamicTableSize = 4096;
  private currentDynamicTableSize = 0;

  /**
   * Encode headers to HPACK format
   */
  encode(headers: Map<string, string>): Uint8Array {
    const chunks: Uint8Array[] = [];

    for (const [name, value] of headers.entries()) {
      const lowerName = name.toLowerCase();

      // Try to find in static table
      const staticIndex = this.findInStaticTable(lowerName, value);
      if (staticIndex !== -1) {
        // Indexed header field
        chunks.push(this.encodeInteger(staticIndex + 1, 7, 0x80));
      } else {
        // Try to find name in static table
        const nameIndex = this.findNameInStaticTable(lowerName);
        if (nameIndex !== -1) {
          // Literal with incremental indexing - indexed name
          chunks.push(this.encodeInteger(nameIndex + 1, 6, 0x40));
          chunks.push(this.encodeString(value));
        } else {
          // Literal with incremental indexing - new name
          chunks.push(new Uint8Array([0x40])); // 01 prefix
          chunks.push(this.encodeString(lowerName));
          chunks.push(this.encodeString(value));
        }

        // Add to dynamic table
        this.addToDynamicTable(lowerName, value);
      }
    }

    // Concatenate all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Decode HPACK headers
   */
  decode(buffer: Uint8Array): Map<string, string> {
    const headers = new Map<string, string>();
    let offset = 0;
    let totalDecompressedSize = 0;

    while (offset < buffer.length) {
      const byte = buffer[offset];

      if (byte & 0x80) {
        // Indexed header field (1xxxxxxx)
        const { value: index, bytesRead } = this.decodeInteger(buffer, offset, 7);
        offset += bytesRead;

        const [name, value] = this.getHeaderAtIndex(index - 1);
        totalDecompressedSize += name.length + value.length;
        if (totalDecompressedSize > MAX_DECOMPRESSED_HEADER_SIZE) {
          throw new Error(`HPACK decompressed header size exceeds limit of ${MAX_DECOMPRESSED_HEADER_SIZE} bytes`);
        }
        headers.set(name, value);
      } else if (byte & 0x40) {
        // Literal with incremental indexing (01xxxxxx)
        const { value: nameIndex, bytesRead: nameBytesRead } = this.decodeInteger(
          buffer,
          offset,
          6,
        );
        offset += nameBytesRead;

        let name: string;
        if (nameIndex === 0) {
          // New name
          const { value: nameStr, bytesRead: nameStrBytesRead } = this.decodeString(
            buffer,
            offset,
          );
          offset += nameStrBytesRead;
          name = nameStr;
        } else {
          // Indexed name
          [name] = this.getHeaderAtIndex(nameIndex - 1);
        }

        // Decode value
        const { value, bytesRead: valueBytesRead } = this.decodeString(buffer, offset);
        offset += valueBytesRead;

        totalDecompressedSize += name.length + value.length;
        if (totalDecompressedSize > MAX_DECOMPRESSED_HEADER_SIZE) {
          throw new Error(`HPACK decompressed header size exceeds limit of ${MAX_DECOMPRESSED_HEADER_SIZE} bytes`);
        }
        headers.set(name, value);
        this.addToDynamicTable(name, value);
      } else if (byte & 0x20) {
        // Dynamic table size update (001xxxxx)
        const { value: newSize, bytesRead } = this.decodeInteger(buffer, offset, 5);
        offset += bytesRead;
        this.updateDynamicTableSize(newSize);
      } else {
        // Literal without indexing (0000xxxx) or never indexed (0001xxxx)
        const prefix = (byte & 0x10) ? 4 : 4;
        const { value: nameIndex, bytesRead: nameBytesRead } = this.decodeInteger(
          buffer,
          offset,
          prefix,
        );
        offset += nameBytesRead;

        let name: string;
        if (nameIndex === 0) {
          const { value: nameStr, bytesRead: nameStrBytesRead } = this.decodeString(
            buffer,
            offset,
          );
          offset += nameStrBytesRead;
          name = nameStr;
        } else {
          [name] = this.getHeaderAtIndex(nameIndex - 1);
        }

        const { value, bytesRead: valueBytesRead } = this.decodeString(buffer, offset);
        offset += valueBytesRead;

        totalDecompressedSize += name.length + value.length;
        if (totalDecompressedSize > MAX_DECOMPRESSED_HEADER_SIZE) {
          throw new Error(`HPACK decompressed header size exceeds limit of ${MAX_DECOMPRESSED_HEADER_SIZE} bytes`);
        }
        headers.set(name, value);
      }
    }

    return headers;
  }

  /**
   * Find header in static table
   */
  private findInStaticTable(name: string, value: string): number {
    for (let i = 0; i < STATIC_TABLE.length; i++) {
      if (STATIC_TABLE[i][0] === name && STATIC_TABLE[i][1] === value) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Find name in static table
   */
  private findNameInStaticTable(name: string): number {
    for (let i = 0; i < STATIC_TABLE.length; i++) {
      if (STATIC_TABLE[i][0] === name) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Get header at index (static or dynamic)
   */
  private getHeaderAtIndex(index: number): [string, string] {
    if (index < STATIC_TABLE.length) {
      return STATIC_TABLE[index];
    }

    const dynamicIndex = index - STATIC_TABLE.length;
    const logicalLength = this.dynamicTable.length - this.dynamicTableStart;
    if (dynamicIndex < logicalLength) {
      // Index 0 = most recent entry = last element in backing array
      return this.dynamicTable[this.dynamicTable.length - 1 - dynamicIndex];
    }

    throw new Error(`Invalid header index: ${index}`);
  }

  /**
   * Add entry to dynamic table
   */
  private addToDynamicTable(name: string, value: string): void {
    const entrySize = 32 + name.length + value.length;

    // Evict oldest entries (from logical front) if necessary
    while (
      this.currentDynamicTableSize + entrySize > this.maxDynamicTableSize &&
      this.dynamicTableStart < this.dynamicTable.length
    ) {
      const [oldName, oldValue] = this.dynamicTable[this.dynamicTableStart];
      this.currentDynamicTableSize -= 32 + oldName.length + oldValue.length;
      this.dynamicTableStart++;
    }

    // Compact when more than half the backing array is dead entries
    if (this.dynamicTableStart > 0 && this.dynamicTableStart >= this.dynamicTable.length) {
      this.dynamicTable.length = 0;
      this.dynamicTableStart = 0;
    } else if (this.dynamicTableStart > 64 && this.dynamicTableStart >= (this.dynamicTable.length >>> 1)) {
      this.dynamicTable = this.dynamicTable.slice(this.dynamicTableStart);
      this.dynamicTableStart = 0;
    }

    // Add new entry at end — O(1) amortized
    this.dynamicTable.push([name, value]);
    this.currentDynamicTableSize += entrySize;
  }

  /**
   * Update dynamic table size
   */
  private updateDynamicTableSize(newSize: number): void {
    this.maxDynamicTableSize = newSize;

    // Evict oldest entries if necessary
    while (this.currentDynamicTableSize > newSize && this.dynamicTableStart < this.dynamicTable.length) {
      const [name, value] = this.dynamicTable[this.dynamicTableStart];
      this.currentDynamicTableSize -= 32 + name.length + value.length;
      this.dynamicTableStart++;
    }

    // Compact if all entries evicted
    if (this.dynamicTableStart >= this.dynamicTable.length) {
      this.dynamicTable.length = 0;
      this.dynamicTableStart = 0;
    }
  }

  /**
   * Encode integer with prefix
   */
  private encodeInteger(value: number, prefixBits: number, prefixMask: number): Uint8Array {
    const maxPrefix = (2 ** prefixBits) - 1;

    if (value < maxPrefix) {
      return new Uint8Array([prefixMask | value]);
    }

    const bytes: number[] = [prefixMask | maxPrefix];
    value -= maxPrefix;

    while (value >= 128) {
      bytes.push((value & 0x7f) | 0x80);
      value >>= 7;
    }

    bytes.push(value);
    return new Uint8Array(bytes);
  }

  /**
   * Decode integer with prefix
   */
  private decodeInteger(
    buffer: Uint8Array,
    offset: number,
    prefixBits: number,
  ): { value: number; bytesRead: number } {
    const maxPrefix = (2 ** prefixBits) - 1;
    const mask = maxPrefix;

    let value = buffer[offset] & mask;
    let bytesRead = 1;

    if (value < maxPrefix) {
      return { value, bytesRead };
    }

    const MAX_CONTINUATION_BYTES = 8;
    let multiplier = 1;
    while (offset + bytesRead < buffer.length) {
      if (multiplier > MAX_CONTINUATION_BYTES) {
        throw new Error("HPACK integer overflow: too many continuation bytes");
      }

      const byte = buffer[offset + bytesRead];
      bytesRead++;

      value += (byte & 0x7f) * (2 ** (multiplier * 7));
      if (value > Number.MAX_SAFE_INTEGER) {
        throw new Error("HPACK integer overflow");
      }
      multiplier++;

      if (!(byte & 0x80)) {
        break;
      }
    }

    return { value, bytesRead };
  }

  /**
   * Encode string (without Huffman coding for simplicity)
   */
  private encodeString(str: string): Uint8Array {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const lengthBytes = this.encodeInteger(bytes.length, 7, 0x00); // H=0 (no Huffman)

    const result = new Uint8Array(lengthBytes.length + bytes.length);
    result.set(lengthBytes, 0);
    result.set(bytes, lengthBytes.length);

    return result;
  }

  /**
   * Decode string
   */
  private decodeString(
    buffer: Uint8Array,
    offset: number,
  ): { value: string; bytesRead: number } {
    const huffman = !!(buffer[offset] & 0x80);
    const { value: length, bytesRead: lengthBytes } = this.decodeInteger(buffer, offset, 7);

    offset += lengthBytes;

    const stringBytes = buffer.slice(offset, offset + length);
    const decoder = new TextDecoder();

    // Huffman-encoded strings require Huffman decoding table; raw strings decode directly
    const value = huffman
      ? decodeHuffman(stringBytes)
      : decoder.decode(stringBytes);
    const bytesRead = lengthBytes + length;

    return { value, bytesRead };
  }
}
