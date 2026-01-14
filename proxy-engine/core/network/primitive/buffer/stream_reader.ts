/**
 * Stream Reader for async reading from Deno readers
 *
 * Provides buffered reading with peek, skip, and readUntil operations
 */

import type { Reader } from "jsr:@std/io/types";
import { acquireBuffer, releaseBuffer } from "./buffer_pool.ts";

/**
 * Stream reader options
 */
export interface StreamReaderOptions {
  bufferSize?: number;
  maxBufferSize?: number;
}

/**
 * Buffered stream reader
 */
export class StreamReader {
  private buffer: Uint8Array;
  private bufferPos = 0;
  private bufferEnd = 0;
  private eof = false;
  private closed = false;

  constructor(
    private reader: Reader,
    private options: StreamReaderOptions = {},
  ) {
    const bufferSize = options.bufferSize || 8192;
    this.buffer = acquireBuffer(bufferSize);
  }

  /**
   * Read exactly n bytes
   */
  async readExact(n: number): Promise<Uint8Array> {
    if (this.closed) {
      throw new Error("StreamReader is closed");
    }

    const result = new Uint8Array(n);
    let offset = 0;

    while (offset < n) {
      await this.fill();

      if (this.eof && this.bufferPos === this.bufferEnd) {
        throw new Error(`Unexpected EOF: wanted ${n} bytes, got ${offset}`);
      }

      const available = this.bufferEnd - this.bufferPos;
      const needed = n - offset;
      const toCopy = Math.min(available, needed);

      result.set(
        this.buffer.subarray(this.bufferPos, this.bufferPos + toCopy),
        offset,
      );

      this.bufferPos += toCopy;
      offset += toCopy;
    }

    return result;
  }

  /**
   * Read up to n bytes (may return less)
   */
  async read(n: number): Promise<Uint8Array | null> {
    if (this.closed) {
      throw new Error("StreamReader is closed");
    }

    await this.fill();

    if (this.eof && this.bufferPos === this.bufferEnd) {
      return null; // EOF
    }

    const available = this.bufferEnd - this.bufferPos;
    const toRead = Math.min(available, n);

    const result = this.buffer.subarray(
      this.bufferPos,
      this.bufferPos + toRead,
    ).slice(); // slice to copy

    this.bufferPos += toRead;
    return result;
  }

  /**
   * Read a single byte
   */
  async readByte(): Promise<number | null> {
    if (this.closed) {
      throw new Error("StreamReader is closed");
    }

    await this.fill();

    if (this.eof && this.bufferPos === this.bufferEnd) {
      return null; // EOF
    }

    return this.buffer[this.bufferPos++];
  }

  /**
   * Peek at next n bytes without consuming them
   */
  async peek(n: number): Promise<Uint8Array | null> {
    if (this.closed) {
      throw new Error("StreamReader is closed");
    }

    await this.fill();

    if (this.eof && this.bufferPos === this.bufferEnd) {
      return null; // EOF
    }

    const available = this.bufferEnd - this.bufferPos;
    const toPeek = Math.min(available, n);

    return this.buffer.subarray(
      this.bufferPos,
      this.bufferPos + toPeek,
    ).slice();
  }

  /**
   * Skip n bytes
   */
  async skip(n: number): Promise<number> {
    if (this.closed) {
      throw new Error("StreamReader is closed");
    }

    let skipped = 0;

    while (skipped < n) {
      await this.fill();

      if (this.eof && this.bufferPos === this.bufferEnd) {
        break; // EOF
      }

      const available = this.bufferEnd - this.bufferPos;
      const toSkip = Math.min(available, n - skipped);

      this.bufferPos += toSkip;
      skipped += toSkip;
    }

    return skipped;
  }

  /**
   * Read until delimiter is found (delimiter is consumed but not included)
   */
  async readUntil(delimiter: number): Promise<Uint8Array> {
    if (this.closed) {
      throw new Error("StreamReader is closed");
    }

    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    while (true) {
      await this.fill();

      if (this.eof && this.bufferPos === this.bufferEnd) {
        // EOF without finding delimiter
        if (chunks.length === 0) {
          return new Uint8Array(0);
        }
        break;
      }

      // Search for delimiter in buffer
      const searchStart = this.bufferPos;
      const searchEnd = this.bufferEnd;

      for (let i = searchStart; i < searchEnd; i++) {
        if (this.buffer[i] === delimiter) {
          // Found delimiter
          const chunk = this.buffer.subarray(searchStart, i).slice();
          chunks.push(chunk);
          totalLength += chunk.length;

          // Consume delimiter
          this.bufferPos = i + 1;

          // Combine chunks
          const result = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
          }
          return result;
        }
      }

      // Delimiter not found in current buffer
      const chunk = this.buffer.subarray(searchStart, searchEnd).slice();
      chunks.push(chunk);
      totalLength += chunk.length;
      this.bufferPos = searchEnd;
    }

    // EOF reached, return what we have
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  /**
   * Read a line (terminated by \n, \r\n is also handled)
   */
  async readLine(): Promise<string | null> {
    if (this.closed) {
      throw new Error("StreamReader is closed");
    }

    const lineBytes = await this.readUntil(0x0a); // \n

    if (lineBytes.length === 0 && this.eof) {
      return null; // EOF
    }

    // Remove trailing \r if present (CRLF line ending)
    let end = lineBytes.length;
    if (end > 0 && lineBytes[end - 1] === 0x0d) { // \r
      end--;
    }

    const decoder = new TextDecoder();
    return decoder.decode(lineBytes.subarray(0, end));
  }

  /**
   * Check if EOF has been reached
   */
  isEOF(): boolean {
    return this.eof && this.bufferPos === this.bufferEnd;
  }

  /**
   * Fill internal buffer from reader
   */
  private async fill(): Promise<void> {
    if (this.eof) {
      return;
    }

    // If buffer has data, shift it to the beginning
    if (this.bufferPos > 0 && this.bufferPos < this.bufferEnd) {
      const remaining = this.bufferEnd - this.bufferPos;
      this.buffer.copyWithin(0, this.bufferPos, this.bufferEnd);
      this.bufferEnd = remaining;
      this.bufferPos = 0;
    } else if (this.bufferPos === this.bufferEnd) {
      // Buffer is empty
      this.bufferPos = 0;
      this.bufferEnd = 0;
    }

    // Try to fill buffer
    if (this.bufferEnd < this.buffer.length) {
      const readBuffer = this.buffer.subarray(this.bufferEnd);
      const n = await this.reader.read(readBuffer);

      if (n === null) {
        this.eof = true;
      } else {
        this.bufferEnd += n;
      }
    }
  }

  /**
   * Close the stream reader and release buffer
   */
  close(): void {
    if (!this.closed) {
      releaseBuffer(this.buffer);
      this.closed = true;
    }
  }

  /**
   * Get underlying reader
   */
  getReader(): Reader {
    return this.reader;
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Get available bytes in buffer
   */
  getAvailable(): number {
    return this.bufferEnd - this.bufferPos;
  }

  /**
   * Check if stream is closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Get options
   */
  getOptions(): Readonly<StreamReaderOptions> {
    return { ...this.options };
  }
}
