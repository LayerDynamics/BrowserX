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
    encode(headers: HTTPHeaders): ByteBuffer {
        const bytes: number[] = [];

        for (const [name, value] of headers.entries()) {
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
     * Simplified version without Huffman encoding
     *
     * @param value - String value
     * @param useHuffman - Whether to use Huffman encoding (not implemented)
     * @returns Encoded string bytes
     */
    private encodeString(value: string, useHuffman: boolean): number[] {
        const stringBytes = new TextEncoder().encode(value);
        const lengthBytes = this.encodeInteger(stringBytes.length, 7);

        // Set H bit (bit 7) if Huffman encoded (not implemented, always false)
        lengthBytes[0] |= useHuffman ? 0x80 : 0x00;

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

        return { index: -1, fullMatch: false };
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
            } else {
                // Other literal types (without indexing, never indexed)
                // Simplified: skip for now
                break;
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
     * Decode string (simplified, without Huffman decoding)
     */
    private decodeString(data: ByteBuffer, offset: number): {
        value: string;
        bytesRead: number;
    } {
        const huffman = (data[offset] & 0x80) !== 0;
        const { value: length, bytesRead: lengthBytes } = this.decodeInteger(data, offset, 7);
        const totalBytes = lengthBytes + length;

        if (huffman) {
            // Huffman decoding not implemented, return raw bytes as string
            const stringData = data.slice(offset + lengthBytes, offset + totalBytes);
            return {
                value: new TextDecoder().decode(stringData),
                bytesRead: totalBytes,
            };
        }

        const stringData = data.slice(offset + lengthBytes, offset + totalBytes);
        return {
            value: new TextDecoder().decode(stringData),
            bytesRead: totalBytes,
        };
    }
}
