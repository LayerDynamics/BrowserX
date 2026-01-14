/**
 * HPACK Header Compression
 *
 * Simplified implementation of HPACK (RFC 7541) for HTTP/2 header compression
 */

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
 * HPACK encoder/decoder
 */
export class HPACKCodec {
  private dynamicTable: Array<[string, string]> = [];
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

    while (offset < buffer.length) {
      const byte = buffer[offset];

      if (byte & 0x80) {
        // Indexed header field (1xxxxxxx)
        const { value: index, bytesRead } = this.decodeInteger(buffer, offset, 7);
        offset += bytesRead;

        const [name, value] = this.getHeaderAtIndex(index - 1);
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
    if (dynamicIndex < this.dynamicTable.length) {
      return this.dynamicTable[dynamicIndex];
    }

    throw new Error(`Invalid header index: ${index}`);
  }

  /**
   * Add entry to dynamic table
   */
  private addToDynamicTable(name: string, value: string): void {
    const entrySize = 32 + name.length + value.length;

    // Evict entries if necessary
    while (
      this.currentDynamicTableSize + entrySize > this.maxDynamicTableSize &&
      this.dynamicTable.length > 0
    ) {
      const [oldName, oldValue] = this.dynamicTable.pop()!;
      this.currentDynamicTableSize -= 32 + oldName.length + oldValue.length;
    }

    // Add new entry at beginning
    this.dynamicTable.unshift([name, value]);
    this.currentDynamicTableSize += entrySize;
  }

  /**
   * Update dynamic table size
   */
  private updateDynamicTableSize(newSize: number): void {
    this.maxDynamicTableSize = newSize;

    // Evict entries if necessary
    while (this.currentDynamicTableSize > newSize && this.dynamicTable.length > 0) {
      const [name, value] = this.dynamicTable.pop()!;
      this.currentDynamicTableSize -= 32 + name.length + value.length;
    }
  }

  /**
   * Encode integer with prefix
   */
  private encodeInteger(value: number, prefixBits: number, prefixMask: number): Uint8Array {
    const maxPrefix = (1 << prefixBits) - 1;

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
    const maxPrefix = (1 << prefixBits) - 1;
    const mask = maxPrefix;

    let value = buffer[offset] & mask;
    let bytesRead = 1;

    if (value < maxPrefix) {
      return { value, bytesRead };
    }

    let multiplier = 1;
    while (offset + bytesRead < buffer.length) {
      const byte = buffer[offset + bytesRead];
      bytesRead++;

      value += (byte & 0x7f) * (1 << (multiplier * 7));
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

    // For simplicity, ignore Huffman encoding
    const value = decoder.decode(stringBytes);
    const bytesRead = lengthBytes + length;

    return { value, bytesRead };
  }
}
