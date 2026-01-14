/**
 * QPACK Header Compression (RFC 9204)
 *
 * Implements QPACK compression for HTTP/3 headers.
 * QPACK is similar to HPACK but designed for unordered delivery in HTTP/3.
 */

import type { HTTPHeaders } from "./HTTPHeaders.ts";
import type { ByteBuffer } from "../../../types/identifiers.ts";

/**
 * QPACK static table (RFC 9204 Appendix A)
 * Reuses HTTP/2 static table with HTTP/3 pseudo-headers
 */
const QPACK_STATIC_TABLE = [
    { name: ":authority", value: "" }, // 0
    { name: ":path", value: "/" }, // 1
    { name: "age", value: "0" }, // 2
    { name: "content-disposition", value: "" }, // 3
    { name: "content-length", value: "0" }, // 4
    { name: "cookie", value: "" }, // 5
    { name: "date", value: "" }, // 6
    { name: "etag", value: "" }, // 7
    { name: "if-modified-since", value: "" }, // 8
    { name: "if-none-match", value: "" }, // 9
    { name: "last-modified", value: "" }, // 10
    { name: "link", value: "" }, // 11
    { name: "location", value: "" }, // 12
    { name: "referer", value: "" }, // 13
    { name: "set-cookie", value: "" }, // 14
    { name: ":method", value: "CONNECT" }, // 15
    { name: ":method", value: "DELETE" }, // 16
    { name: ":method", value: "GET" }, // 17
    { name: ":method", value: "HEAD" }, // 18
    { name: ":method", value: "OPTIONS" }, // 19
    { name: ":method", value: "POST" }, // 20
    { name: ":method", value: "PUT" }, // 21
    { name: ":scheme", value: "http" }, // 22
    { name: ":scheme", value: "https" }, // 23
    { name: ":status", value: "103" }, // 24
    { name: ":status", value: "200" }, // 25
    { name: ":status", value: "304" }, // 26
    { name: ":status", value: "404" }, // 27
    { name: ":status", value: "503" }, // 28
    { name: "accept", value: "*/*" }, // 29
    { name: "accept", value: "application/dns-message" }, // 30
    { name: "accept-encoding", value: "gzip, deflate, br" }, // 31
    { name: "accept-ranges", value: "bytes" }, // 32
    { name: "access-control-allow-headers", value: "cache-control" }, // 33
    { name: "access-control-allow-headers", value: "content-type" }, // 34
    { name: "access-control-allow-origin", value: "*" }, // 35
    { name: "cache-control", value: "max-age=0" }, // 36
    { name: "cache-control", value: "max-age=2592000" }, // 37
    { name: "cache-control", value: "max-age=604800" }, // 38
    { name: "cache-control", value: "no-cache" }, // 39
    { name: "cache-control", value: "no-store" }, // 40
    { name: "cache-control", value: "public, max-age=31536000" }, // 41
    { name: "content-encoding", value: "br" }, // 42
    { name: "content-encoding", value: "gzip" }, // 43
    { name: "content-type", value: "application/dns-message" }, // 44
    { name: "content-type", value: "application/javascript" }, // 45
    { name: "content-type", value: "application/json" }, // 46
    { name: "content-type", value: "application/x-www-form-urlencoded" }, // 47
    { name: "content-type", value: "image/gif" }, // 48
    { name: "content-type", value: "image/jpeg" }, // 49
    { name: "content-type", value: "image/png" }, // 50
    { name: "content-type", value: "text/css" }, // 51
    { name: "content-type", value: "text/html; charset=utf-8" }, // 52
    { name: "content-type", value: "text/plain" }, // 53
    { name: "content-type", value: "text/plain;charset=utf-8" }, // 54
    { name: "range", value: "bytes=0-" }, // 55
    { name: "strict-transport-security", value: "max-age=31536000" }, // 56
    { name: "strict-transport-security", value: "max-age=31536000; includesubdomains" }, // 57
    { name: "strict-transport-security", value: "max-age=31536000; includesubdomains; preload" }, // 58
    { name: "vary", value: "accept-encoding" }, // 59
    { name: "vary", value: "origin" }, // 60
    { name: "x-content-type-options", value: "nosniff" }, // 61
    { name: "x-xss-protection", value: "1; mode=block" }, // 62
    { name: ":status", value: "100" }, // 63
    { name: ":status", value: "204" }, // 64
    { name: ":status", value: "206" }, // 65
    { name: ":status", value: "302" }, // 66
    { name: ":status", value: "400" }, // 67
    { name: ":status", value: "403" }, // 68
    { name: ":status", value: "421" }, // 69
    { name: ":status", value: "425" }, // 70
    { name: ":status", value: "500" }, // 71
    { name: "accept-language", value: "" }, // 72
    { name: "access-control-allow-credentials", value: "FALSE" }, // 73
    { name: "access-control-allow-credentials", value: "TRUE" }, // 74
    { name: "access-control-allow-headers", value: "*" }, // 75
    { name: "access-control-allow-methods", value: "get" }, // 76
    { name: "access-control-allow-methods", value: "get, post, options" }, // 77
    { name: "access-control-allow-methods", value: "options" }, // 78
    { name: "access-control-expose-headers", value: "content-length" }, // 79
    { name: "access-control-request-headers", value: "content-type" }, // 80
    { name: "access-control-request-method", value: "get" }, // 81
    { name: "access-control-request-method", value: "post" }, // 82
    { name: "alt-svc", value: "clear" }, // 83
    { name: "authorization", value: "" }, // 84
    {
        name: "content-security-policy",
        value: "script-src 'none'; object-src 'none'; base-uri 'none'",
    }, // 85
    { name: "early-data", value: "1" }, // 86
    { name: "expect-ct", value: "" }, // 87
    { name: "forwarded", value: "" }, // 88
    { name: "if-range", value: "" }, // 89
    { name: "origin", value: "" }, // 90
    { name: "purpose", value: "prefetch" }, // 91
    { name: "server", value: "" }, // 92
    { name: "timing-allow-origin", value: "*" }, // 93
    { name: "upgrade-insecure-requests", value: "1" }, // 94
    { name: "user-agent", value: "" }, // 95
    { name: "x-forwarded-for", value: "" }, // 96
    { name: "x-frame-options", value: "deny" }, // 97
    { name: "x-frame-options", value: "sameorigin" }, // 98
];

/**
 * QPACK dynamic table
 */
class QPACKDynamicTable {
    private entries: Array<{ name: string; value: string }> = [];
    private size: number = 0;
    private maxSize: number = 4096;

    add(name: string, value: string): void {
        const entrySize = 32 + name.length + value.length;

        if (entrySize > this.maxSize) {
            this.entries = [];
            this.size = 0;
            return;
        }

        this.entries.unshift({ name, value });
        this.size += entrySize;

        while (this.size > this.maxSize && this.entries.length > 0) {
            const evicted = this.entries.pop()!;
            this.size -= 32 + evicted.name.length + evicted.value.length;
        }
    }

    get(index: number): { name: string; value: string } | undefined {
        return this.entries[index];
    }

    getLength(): number {
        return this.entries.length;
    }

    updateMaxSize(maxSize: number): void {
        this.maxSize = maxSize;

        while (this.size > this.maxSize && this.entries.length > 0) {
            const evicted = this.entries.pop()!;
            this.size -= 32 + evicted.name.length + evicted.value.length;
        }
    }
}

/**
 * QPACK encoder
 */
export class QPACKEncoder {
    private dynamicTable: QPACKDynamicTable = new QPACKDynamicTable();

    /**
     * Encode headers using QPACK
     */
    encode(headers: HTTPHeaders): ByteBuffer {
        const bytes: number[] = [];

        // Encoded field section prefix (Required Insert Count + Delta Base)
        bytes.push(0); // Required Insert Count = 0 (not using dynamic table)
        bytes.push(0); // Delta Base = 0

        for (const [name, value] of headers.entries()) {
            const result = this.findInTable(name, value);

            if (result.fullMatch) {
                // Indexed field line
                const indexBytes = this.encodeInteger(result.index, 6);
                indexBytes[0] |= 0b11000000; // Pattern: 11xxxxxx
                bytes.push(...indexBytes);
            } else if (result.index >= 0) {
                // Literal with name reference
                const indexBytes = this.encodeInteger(result.index, 4);
                indexBytes[0] |= 0b01010000; // Pattern: 0101xxxx (literal with incremental indexing)
                bytes.push(...indexBytes);

                const valueBytes = this.encodeString(value);
                bytes.push(...valueBytes);
            } else {
                // Literal with literal name
                bytes.push(0b00100000); // Pattern: 001xxxxx (literal without indexing)

                const nameBytes = this.encodeString(name);
                bytes.push(...nameBytes);

                const valueBytes = this.encodeString(value);
                bytes.push(...valueBytes);
            }
        }

        return new Uint8Array(bytes);
    }

    /**
     * Encode integer (RFC 9204 Section 4.1.1)
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
     * Encode string (simplified, without Huffman)
     */
    private encodeString(value: string): number[] {
        const stringBytes = new TextEncoder().encode(value);
        const lengthBytes = this.encodeInteger(stringBytes.length, 7);

        // H bit = 0 (not Huffman encoded)
        lengthBytes[0] &= 0b01111111;

        return [...lengthBytes, ...Array.from(stringBytes)];
    }

    /**
     * Find header in static or dynamic table
     */
    private findInTable(name: string, value?: string): { index: number; fullMatch: boolean } {
        // Search static table
        for (let i = 0; i < QPACK_STATIC_TABLE.length; i++) {
            if (QPACK_STATIC_TABLE[i].name === name) {
                if (value !== undefined && QPACK_STATIC_TABLE[i].value === value) {
                    return { index: i, fullMatch: true };
                }
                if (value === undefined || QPACK_STATIC_TABLE[i].value === "") {
                    return { index: i, fullMatch: false };
                }
            }
        }

        // Search dynamic table
        const dynamicLength = this.dynamicTable.getLength();
        for (let i = 0; i < dynamicLength; i++) {
            const entry = this.dynamicTable.get(i);
            if (entry && entry.name === name) {
                const tableIndex = QPACK_STATIC_TABLE.length + i;
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
 * QPACK decoder
 */
export class QPACKDecoder {
    private dynamicTable: QPACKDynamicTable = new QPACKDynamicTable();

    /**
     * Decode QPACK-encoded headers
     */
    decode(data: ByteBuffer): HTTPHeaders {
        const headers = new Map<string, string>();
        let offset = 0;

        // Decode field section prefix
        const { value: requiredInsertCount, bytesRead: ricBytes } = this.decodeInteger(
            data,
            offset,
            8,
        );
        offset += ricBytes;

        const { value: deltaBase, bytesRead: dbBytes } = this.decodeInteger(data, offset, 7);
        offset += dbBytes;

        // Decode field lines
        while (offset < data.byteLength) {
            const byte = data[offset];

            if ((byte & 0b11000000) === 0b11000000) {
                // Indexed field line
                const { value: index, bytesRead } = this.decodeInteger(data, offset, 6);
                offset += bytesRead;

                const entry = this.getTableEntry(index);
                if (entry) {
                    headers.set(entry.name, entry.value);
                }
            } else if ((byte & 0b11110000) === 0b01010000) {
                // Literal with name reference
                const { value: nameIndex, bytesRead: indexBytes } = this.decodeInteger(
                    data,
                    offset,
                    4,
                );
                offset += indexBytes;

                const nameEntry = this.getTableEntry(nameIndex);
                const name = nameEntry?.name || "";

                const { value, bytesRead: valueBytes } = this.decodeString(data, offset);
                offset += valueBytes;

                headers.set(name, value);
            } else if ((byte & 0b11100000) === 0b00100000) {
                // Literal with literal name
                offset++; // Skip pattern byte

                const { value: name, bytesRead: nameBytes } = this.decodeString(data, offset);
                offset += nameBytes;

                const { value, bytesRead: valueBytes } = this.decodeString(data, offset);
                offset += valueBytes;

                headers.set(name, value);
            } else {
                break;
            }
        }

        return headers;
    }

    /**
     * Get entry from static or dynamic table
     */
    private getTableEntry(index: number): { name: string; value: string } | undefined {
        if (index < QPACK_STATIC_TABLE.length) {
            return QPACK_STATIC_TABLE[index];
        }

        const dynamicIndex = index - QPACK_STATIC_TABLE.length;
        return this.dynamicTable.get(dynamicIndex);
    }

    /**
     * Decode integer
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
     * Decode string
     */
    private decodeString(data: ByteBuffer, offset: number): {
        value: string;
        bytesRead: number;
    } {
        const huffman = (data[offset] & 0x80) !== 0;
        const { value: length, bytesRead: lengthBytes } = this.decodeInteger(data, offset, 7);
        const totalBytes = lengthBytes + length;

        const stringData = data.slice(offset + lengthBytes, offset + totalBytes);
        return {
            value: new TextDecoder().decode(stringData),
            bytesRead: totalBytes,
        };
    }
}
