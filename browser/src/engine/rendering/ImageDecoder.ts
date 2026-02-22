/**
 * ImageDecoder
 *
 * Static utility class for parsing intrinsic dimensions from image binary data.
 * Supports PNG, JPEG, GIF, WebP, and BMP header parsing.
 */

export interface ImageDimensions {
    width: number;
    height: number;
}

/**
 * Parse intrinsic dimensions from image binary data.
 * Supports PNG, JPEG, GIF, WebP, and BMP header parsing.
 * Returns { width: 0, height: 0 } if format is unrecognized.
 */
export class ImageDecoder {
    static parseImageDimensions(data: Uint8Array): ImageDimensions {
        if (data.length < 8) return { width: 0, height: 0 };

        // PNG: bytes 0-7 are signature, IHDR chunk starts at 8, width at 16, height at 20 (big-endian)
        if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
            if (data.length < 24) return { width: 0, height: 0 };
            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
            return {
                width: view.getUint32(16, false),
                height: view.getUint32(20, false),
            };
        }

        // JPEG: starts with 0xFFD8, scan for SOF0/SOF2 marker (0xFFC0/0xFFC2)
        if (data[0] === 0xFF && data[1] === 0xD8) {
            let offset = 2;
            while (offset < data.length - 9) {
                if (data[offset] !== 0xFF) { offset++; continue; }
                const marker = data[offset + 1];
                // SOF0 (0xC0) through SOF3 (0xC3), excluding DHT (0xC4)
                if (marker >= 0xC0 && marker <= 0xC3) {
                    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
                    return {
                        width: view.getUint16(offset + 7, false),
                        height: view.getUint16(offset + 5, false),
                    };
                }
                // Skip to next marker using segment length
                if (marker === 0xD0 || marker === 0xD1 || marker === 0xD2 || marker === 0xD3 ||
                    marker === 0xD4 || marker === 0xD5 || marker === 0xD6 || marker === 0xD7 ||
                    marker === 0xD8 || marker === 0xD9 || marker === 0x01) {
                    offset += 2;
                } else {
                    if (offset + 3 >= data.length) break;
                    const segLen = (data[offset + 2] << 8) | data[offset + 3];
                    offset += 2 + segLen;
                }
            }
            return { width: 0, height: 0 };
        }

        // GIF: "GIF87a" or "GIF89a", width at 6, height at 8 (little-endian)
        if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
            if (data.length < 10) return { width: 0, height: 0 };
            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
            return {
                width: view.getUint16(6, true),
                height: view.getUint16(8, true),
            };
        }

        // WebP: "RIFF" at 0, "WEBP" at 8
        if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
            data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
            // VP8 lossy: "VP8 " at 12, width at 26, height at 28
            if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x20) {
                if (data.length < 30) return { width: 0, height: 0 };
                const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
                return {
                    width: view.getUint16(26, true) & 0x3FFF,
                    height: view.getUint16(28, true) & 0x3FFF,
                };
            }
            // VP8L lossless: "VP8L" at 12, packed dimensions at 21
            if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x4C) {
                if (data.length < 25) return { width: 0, height: 0 };
                const bits = (data[21]) | (data[22] << 8) | (data[23] << 16) | (data[24] << 24);
                return {
                    width: (bits & 0x3FFF) + 1,
                    height: ((bits >> 14) & 0x3FFF) + 1,
                };
            }
            // VP8X extended: width at 24 (24-bit LE + 1), height at 27 (24-bit LE + 1)
            if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x58) {
                if (data.length < 30) return { width: 0, height: 0 };
                return {
                    width: (data[24] | (data[25] << 8) | (data[26] << 16)) + 1,
                    height: (data[27] | (data[28] << 8) | (data[29] << 16)) + 1,
                };
            }
        }

        // BMP: "BM" at 0, width at 18, height at 22 (little-endian, signed for height)
        if (data[0] === 0x42 && data[1] === 0x4D) {
            if (data.length < 26) return { width: 0, height: 0 };
            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
            return {
                width: view.getInt32(18, true),
                height: Math.abs(view.getInt32(22, true)),
            };
        }

        return { width: 0, height: 0 };
    }
}
