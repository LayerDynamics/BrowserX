/**
 * Chunked Transfer Encoding Utilities
 *
 * Encode and decode HTTP chunked transfer encoding
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Encode data using chunked transfer encoding
 */
export function encodeChunked(data: Uint8Array, chunkSize = 8192): Uint8Array {
  const chunks: Uint8Array[] = [];
  let offset = 0;

  while (offset < data.length) {
    const end = Math.min(offset + chunkSize, data.length);
    const chunk = data.slice(offset, end);

    // Chunk size in hex + CRLF
    const sizeHex = chunk.length.toString(16);
    chunks.push(encoder.encode(`${sizeHex}\r\n`));

    // Chunk data + CRLF
    chunks.push(chunk);
    chunks.push(encoder.encode("\r\n"));

    offset = end;
  }

  // Final chunk (0 size) + CRLF
  chunks.push(encoder.encode("0\r\n\r\n"));

  return concatenateUint8Arrays(chunks);
}

/**
 * Decode chunked transfer encoding
 */
export function decodeChunked(data: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let offset = 0;

  while (offset < data.length) {
    // Find CRLF after chunk size
    const crlfIndex = findCRLF(data, offset);
    if (crlfIndex === -1) {
      throw new Error("Invalid chunked encoding: missing CRLF after size");
    }

    // Parse chunk size (hex)
    const sizeLine = decoder.decode(data.slice(offset, crlfIndex));
    const chunkSize = parseInt(sizeLine.split(";")[0].trim(), 16);

    if (isNaN(chunkSize)) {
      throw new Error(`Invalid chunked encoding: invalid size "${sizeLine}"`);
    }

    // Last chunk (size 0)
    if (chunkSize === 0) {
      break;
    }

    // Extract chunk data
    const chunkStart = crlfIndex + 2; // Skip CRLF
    const chunkEnd = chunkStart + chunkSize;

    if (chunkEnd > data.length) {
      throw new Error("Invalid chunked encoding: chunk size exceeds data");
    }

    chunks.push(data.slice(chunkStart, chunkEnd));

    // Skip trailing CRLF
    offset = chunkEnd + 2;
  }

  return concatenateUint8Arrays(chunks);
}

/**
 * Stream-based chunked encoder
 */
export class ChunkedEncoder {
  private chunkSize: number;

  constructor(chunkSize = 8192) {
    this.chunkSize = chunkSize;
  }

  /**
   * Encode chunk
   */
  encodeChunk(data: Uint8Array): Uint8Array {
    if (data.length === 0) {
      // Final chunk
      return encoder.encode("0\r\n\r\n");
    }

    const sizeHex = data.length.toString(16);
    return concatenateUint8Arrays([
      encoder.encode(`${sizeHex}\r\n`),
      data,
      encoder.encode("\r\n"),
    ]);
  }

  /**
   * Create final chunk marker
   */
  encodeFinal(): Uint8Array {
    return encoder.encode("0\r\n\r\n");
  }

  /**
   * Create transform stream for chunked encoding
   */
  createTransformStream(): TransformStream<Uint8Array, Uint8Array> {
    const chunkSize = this.chunkSize;
    const enc = this;
    let buffer: Uint8Array<ArrayBuffer> = new Uint8Array(0) as Uint8Array<ArrayBuffer>;

    return new TransformStream({
      transform(chunk, controller) {
        // Add to buffer
        buffer = concatenateUint8Arrays([buffer, chunk]);

        // Encode complete chunks
        while (buffer.length >= chunkSize) {
          const chunkData = buffer.slice(0, chunkSize);
          buffer = buffer.slice(chunkSize);
          controller.enqueue(enc.encodeChunk(chunkData));
        }
      },

      flush(controller) {
        // Encode remaining data
        if (buffer.length > 0) {
          controller.enqueue(enc.encodeChunk(buffer));
        }
        // Send final chunk
        controller.enqueue(enc.encodeFinal());
      },
    });
  }
}

/**
 * Stream-based chunked decoder
 */
export class ChunkedDecoder {
  private buffer: Uint8Array<ArrayBuffer> = new Uint8Array(0) as Uint8Array<ArrayBuffer>;
  private state: "SIZE" | "DATA" | "TRAILER" | "DONE" = "SIZE";
  private currentChunkSize = 0;
  private currentChunkReceived = 0;

  /**
   * Decode chunk
   */
  decode(data: Uint8Array): Uint8Array[] {
    this.buffer = concatenateUint8Arrays([this.buffer, data]);
    const chunks: Uint8Array[] = [];

    while (this.buffer.length > 0 && this.state !== "DONE") {
      if (this.state === "SIZE") {
        // Look for CRLF
        const crlfIndex = findCRLF(this.buffer, 0);
        if (crlfIndex === -1) {
          break; // Need more data
        }

        // Parse size
        const sizeLine = decoder.decode(this.buffer.slice(0, crlfIndex));
        this.currentChunkSize = parseInt(sizeLine.split(";")[0].trim(), 16);

        if (isNaN(this.currentChunkSize)) {
          throw new Error(
            `Invalid chunked encoding: invalid size "${sizeLine}"`,
          );
        }

        this.buffer = this.buffer.slice(crlfIndex + 2);

        if (this.currentChunkSize === 0) {
          this.state = "TRAILER";
        } else {
          this.state = "DATA";
          this.currentChunkReceived = 0;
        }
      } else if (this.state === "DATA") {
        const remaining = this.currentChunkSize - this.currentChunkReceived;
        const available = Math.min(remaining, this.buffer.length);

        if (available > 0) {
          chunks.push(this.buffer.slice(0, available));
          this.buffer = this.buffer.slice(available);
          this.currentChunkReceived += available;
        }

        if (this.currentChunkReceived === this.currentChunkSize) {
          // Skip trailing CRLF
          if (this.buffer.length < 2) {
            break; // Need more data
          }
          this.buffer = this.buffer.slice(2);
          this.state = "SIZE";
        }
      } else if (this.state === "TRAILER") {
        // Look for final CRLF
        const crlfIndex = findCRLF(this.buffer, 0);
        if (crlfIndex === -1) {
          break; // Need more data
        }
        this.buffer = this.buffer.slice(crlfIndex + 2);
        this.state = "DONE";
      }
    }

    return chunks;
  }

  /**
   * Check if decoding is complete
   */
  isDone(): boolean {
    return this.state === "DONE";
  }

  /**
   * Create transform stream for chunked decoding
   */
  createTransformStream(): TransformStream<Uint8Array, Uint8Array> {
    const decoder = this;

    return new TransformStream({
      transform(chunk, controller) {
        const decoded = decoder.decode(chunk);
        for (const data of decoded) {
          controller.enqueue(data);
        }
      },

      flush() {
        if (!decoder.isDone()) {
          throw new Error("Chunked encoding incomplete");
        }
      },
    });
  }
}

/**
 * Find CRLF in Uint8Array
 */
function findCRLF(data: Uint8Array, start: number): number {
  for (let i = start; i < data.length - 1; i++) {
    if (data[i] === 0x0d && data[i + 1] === 0x0a) {
      return i;
    }
  }
  return -1;
}

/**
 * Concatenate Uint8Arrays
 */
function concatenateUint8Arrays(arrays: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result as Uint8Array<ArrayBuffer>;
}

/**
 * Parse chunk extensions (after size)
 */
export function parseChunkExtensions(
  sizeLine: string,
): Record<string, string> {
  const parts = sizeLine.split(";");
  const extensions: Record<string, string> = {};

  for (let i = 1; i < parts.length; i++) {
    const [name, value] = parts[i].trim().split("=");
    if (name) {
      extensions[name] = value || "";
    }
  }

  return extensions;
}

/**
 * Format chunk extensions
 */
export function formatChunkExtensions(
  extensions: Record<string, string>,
): string {
  return Object.entries(extensions)
    .map(([name, value]) => (value ? `${name}=${value}` : name))
    .join(";");
}
