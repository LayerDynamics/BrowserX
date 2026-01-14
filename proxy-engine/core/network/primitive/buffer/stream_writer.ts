/**
 * Stream Writer for buffered async writing to Deno writers
 *
 * Provides buffered writing with automatic flushing
 */

import type { Writer } from "jsr:@std/io/types";
import { acquireBuffer, releaseBuffer } from "./buffer_pool.ts";

/**
 * Stream writer options
 */
export interface StreamWriterOptions {
  bufferSize?: number;
  autoFlush?: boolean;
  autoFlushInterval?: number;
}

/**
 * Buffered stream writer
 */
export class StreamWriter {
  private buffer: Uint8Array;
  private bufferPos = 0;
  private closed = false;
  private autoFlushTimer?: number;
  private bytesWritten = 0;

  constructor(
    private writer: Writer,
    private options: StreamWriterOptions = {},
  ) {
    const bufferSize = options.bufferSize || 8192;
    this.buffer = acquireBuffer(bufferSize);

    // Setup auto-flush timer if enabled
    if (options.autoFlush && options.autoFlushInterval) {
      this.startAutoFlush();
    }
  }

  /**
   * Write data to the stream (buffered)
   */
  async write(data: Uint8Array): Promise<number> {
    if (this.closed) {
      throw new Error("StreamWriter is closed");
    }

    let offset = 0;

    while (offset < data.length) {
      const available = this.buffer.length - this.bufferPos;
      const toWrite = Math.min(available, data.length - offset);

      // Copy to buffer
      this.buffer.set(
        data.subarray(offset, offset + toWrite),
        this.bufferPos,
      );

      this.bufferPos += toWrite;
      offset += toWrite;

      // Flush if buffer is full
      if (this.bufferPos === this.buffer.length) {
        await this.flush();
      }
    }

    return data.length;
  }

  /**
   * Write a string to the stream
   */
  async writeString(str: string): Promise<number> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    return await this.write(data);
  }

  /**
   * Write a single byte
   */
  async writeByte(byte: number): Promise<void> {
    if (this.closed) {
      throw new Error("StreamWriter is closed");
    }

    this.buffer[this.bufferPos++] = byte;

    if (this.bufferPos === this.buffer.length) {
      await this.flush();
    }
  }

  /**
   * Write CRLF (\r\n)
   */
  async writeCRLF(): Promise<void> {
    await this.writeByte(0x0d); // \r
    await this.writeByte(0x0a); // \n
  }

  /**
   * Write a line (string + CRLF)
   */
  async writeLine(line: string): Promise<void> {
    await this.writeString(line);
    await this.writeCRLF();
  }

  /**
   * Flush buffered data to underlying writer
   */
  async flush(): Promise<void> {
    if (this.closed) {
      throw new Error("StreamWriter is closed");
    }

    if (this.bufferPos === 0) {
      return; // Nothing to flush
    }

    const toWrite = this.buffer.subarray(0, this.bufferPos);
    let offset = 0;

    while (offset < toWrite.length) {
      const n = await this.writer.write(toWrite.subarray(offset));
      offset += n;
      this.bytesWritten += n;
    }

    this.bufferPos = 0;
  }

  /**
   * Get total bytes written
   */
  getBytesWritten(): number {
    return this.bytesWritten;
  }

  /**
   * Get buffered bytes (not yet flushed)
   */
  getBufferedBytes(): number {
    return this.bufferPos;
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    if (this.autoFlushTimer) {
      return;
    }

    const interval = this.options.autoFlushInterval || 1000;

    this.autoFlushTimer = setInterval(async () => {
      if (this.bufferPos > 0) {
        try {
          await this.flush();
        } catch (error) {
          console.error("Auto-flush error:", error);
        }
      }
    }, interval);
  }

  /**
   * Stop auto-flush timer
   */
  private stopAutoFlush(): void {
    if (this.autoFlushTimer) {
      clearInterval(this.autoFlushTimer);
      this.autoFlushTimer = undefined;
    }
  }

  /**
   * Close the stream writer (flushes and releases buffer)
   */
  async close(): Promise<void> {
    if (!this.closed) {
      this.stopAutoFlush();

      // Flush remaining data
      if (this.bufferPos > 0) {
        await this.flush();
      }

      releaseBuffer(this.buffer);
      this.closed = true;
    }
  }

  /**
   * Get underlying writer
   */
  getWriter(): Writer {
    return this.writer;
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
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
  getOptions(): Readonly<StreamWriterOptions> {
    return { ...this.options };
  }
}
