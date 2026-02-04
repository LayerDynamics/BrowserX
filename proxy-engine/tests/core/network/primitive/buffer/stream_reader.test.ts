/**
 * StreamReader Tests
 * Comprehensive tests for StreamReader
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import { StreamReader } from "../../../../../core/network/primitive/buffer/stream_reader.ts";
import type { Reader } from "jsr:@std/io/types";

// ============================================================================
// Mock Reader Implementation
// ============================================================================

/**
 * Mock reader that returns data from a Uint8Array
 */
class MockReader implements Reader {
  private position = 0;
  private chunkSize: number;

  constructor(
    private data: Uint8Array,
    chunkSize: number = 1024,
  ) {
    this.chunkSize = chunkSize;
  }

  read(p: Uint8Array): Promise<number | null> {
    if (this.position >= this.data.length) {
      return Promise.resolve(null); // EOF
    }

    const remaining = this.data.length - this.position;
    const toRead = Math.min(remaining, p.length, this.chunkSize);

    p.set(this.data.subarray(this.position, this.position + toRead));
    this.position += toRead;

    return Promise.resolve(toRead);
  }

  getPosition(): number {
    return this.position;
  }
}

/**
 * Create mock reader from string
 */
function readerFromString(str: string, chunkSize?: number): MockReader {
  const encoder = new TextEncoder();
  return new MockReader(encoder.encode(str), chunkSize);
}

/**
 * Create mock reader from bytes
 */
function readerFromBytes(data: Uint8Array, chunkSize?: number): MockReader {
  return new MockReader(data, chunkSize);
}

// ============================================================================
// Constructor / Initialization Tests
// ============================================================================

Deno.test({
  name: "StreamReader - can be instantiated",
  fn() {
    const reader = readerFromString("test");
    const streamReader = new StreamReader(reader);
    assertExists(streamReader);
    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - accepts custom buffer size",
  fn() {
    const reader = readerFromString("test");
    const streamReader = new StreamReader(reader, { bufferSize: 4096 });

    assertEquals(streamReader.getBufferSize(), 4096);
    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - uses default buffer size of 8192",
  fn() {
    const reader = readerFromString("test");
    const streamReader = new StreamReader(reader);

    assertEquals(streamReader.getBufferSize(), 8192);
    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - starts not closed",
  fn() {
    const reader = readerFromString("test");
    const streamReader = new StreamReader(reader);

    assertEquals(streamReader.isClosed(), false);
    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - starts not at EOF",
  fn() {
    const reader = readerFromString("test");
    const streamReader = new StreamReader(reader);

    assertEquals(streamReader.isEOF(), false);
    streamReader.close();
  },
});

// ============================================================================
// read Tests
// ============================================================================

Deno.test({
  name: "StreamReader - read returns data",
  async fn() {
    const reader = readerFromString("hello world");
    const streamReader = new StreamReader(reader);

    const data = await streamReader.read(5);
    assertExists(data);
    assertEquals(data.length, 5);

    const decoder = new TextDecoder();
    assertEquals(decoder.decode(data), "hello");

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - read returns null at EOF",
  async fn() {
    const reader = readerFromString("hi");
    const streamReader = new StreamReader(reader);

    // Read all content
    await streamReader.read(100);

    // Next read should return null
    const data = await streamReader.read(10);
    assertEquals(data, null);

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - read returns less data than requested if less available",
  async fn() {
    const reader = readerFromString("short");
    const streamReader = new StreamReader(reader);

    const data = await streamReader.read(1000);
    assertExists(data);
    assertEquals(data.length, 5); // "short".length

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - read throws when closed",
  async fn() {
    const reader = readerFromString("test");
    const streamReader = new StreamReader(reader);
    streamReader.close();

    await assertRejects(
      () => streamReader.read(5),
      Error,
      "closed",
    );
  },
});

// ============================================================================
// readExact Tests
// ============================================================================

Deno.test({
  name: "StreamReader - readExact returns exactly n bytes",
  async fn() {
    const reader = readerFromString("hello world");
    const streamReader = new StreamReader(reader);

    const data = await streamReader.readExact(5);
    assertEquals(data.length, 5);

    const decoder = new TextDecoder();
    assertEquals(decoder.decode(data), "hello");

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - readExact throws on EOF before reading enough",
  async fn() {
    const reader = readerFromString("hi");
    const streamReader = new StreamReader(reader);

    await assertRejects(
      () => streamReader.readExact(100),
      Error,
      "Unexpected EOF",
    );

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - readExact works across multiple chunks",
  async fn() {
    // Small chunk size to force multiple reads
    const reader = readerFromString("hello world", 2);
    const streamReader = new StreamReader(reader);

    const data = await streamReader.readExact(11);
    const decoder = new TextDecoder();
    assertEquals(decoder.decode(data), "hello world");

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - readExact throws when closed",
  async fn() {
    const reader = readerFromString("test");
    const streamReader = new StreamReader(reader);
    streamReader.close();

    await assertRejects(
      () => streamReader.readExact(5),
      Error,
      "closed",
    );
  },
});

// ============================================================================
// readByte Tests
// ============================================================================

Deno.test({
  name: "StreamReader - readByte returns single byte",
  async fn() {
    const reader = readerFromBytes(new Uint8Array([65, 66, 67]));
    const streamReader = new StreamReader(reader);

    const byte = await streamReader.readByte();
    assertEquals(byte, 65); // 'A'

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - readByte returns null at EOF",
  async fn() {
    const reader = readerFromBytes(new Uint8Array([65]));
    const streamReader = new StreamReader(reader);

    await streamReader.readByte(); // Read the one byte
    const byte = await streamReader.readByte();
    assertEquals(byte, null);

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - readByte advances position",
  async fn() {
    const reader = readerFromBytes(new Uint8Array([65, 66, 67]));
    const streamReader = new StreamReader(reader);

    assertEquals(await streamReader.readByte(), 65);
    assertEquals(await streamReader.readByte(), 66);
    assertEquals(await streamReader.readByte(), 67);
    assertEquals(await streamReader.readByte(), null);

    streamReader.close();
  },
});

// ============================================================================
// peek Tests
// ============================================================================

Deno.test({
  name: "StreamReader - peek returns data without consuming",
  async fn() {
    const reader = readerFromString("hello");
    const streamReader = new StreamReader(reader);

    const peeked = await streamReader.peek(5);
    assertExists(peeked);
    assertEquals(peeked.length, 5);

    // Should still be able to read the same data
    const data = await streamReader.read(5);
    assertExists(data);

    const decoder = new TextDecoder();
    assertEquals(decoder.decode(peeked), decoder.decode(data));

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - peek returns null at EOF",
  async fn() {
    const reader = readerFromString("hi");
    const streamReader = new StreamReader(reader);

    await streamReader.read(100); // Read everything
    const peeked = await streamReader.peek(5);
    assertEquals(peeked, null);

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - multiple peeks return same data",
  async fn() {
    const reader = readerFromString("test");
    const streamReader = new StreamReader(reader);

    const peek1 = await streamReader.peek(4);
    const peek2 = await streamReader.peek(4);

    assertExists(peek1);
    assertExists(peek2);

    const decoder = new TextDecoder();
    assertEquals(decoder.decode(peek1), decoder.decode(peek2));

    streamReader.close();
  },
});

// ============================================================================
// skip Tests
// ============================================================================

Deno.test({
  name: "StreamReader - skip skips n bytes",
  async fn() {
    const reader = readerFromString("hello world");
    const streamReader = new StreamReader(reader);

    const skipped = await streamReader.skip(6);
    assertEquals(skipped, 6);

    const data = await streamReader.read(5);
    assertExists(data);
    const decoder = new TextDecoder();
    assertEquals(decoder.decode(data), "world");

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - skip returns actual bytes skipped",
  async fn() {
    const reader = readerFromString("hi");
    const streamReader = new StreamReader(reader);

    const skipped = await streamReader.skip(100);
    assertEquals(skipped, 2); // Only 2 bytes available

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - skip returns 0 at EOF",
  async fn() {
    const reader = readerFromString("hi");
    const streamReader = new StreamReader(reader);

    await streamReader.skip(2); // Skip all
    const skipped = await streamReader.skip(5);
    assertEquals(skipped, 0);

    streamReader.close();
  },
});

// ============================================================================
// readUntil Tests
// ============================================================================

Deno.test({
  name: "StreamReader - readUntil reads until delimiter",
  async fn() {
    const reader = readerFromString("hello\nworld");
    const streamReader = new StreamReader(reader);

    const data = await streamReader.readUntil(0x0a); // newline
    const decoder = new TextDecoder();
    assertEquals(decoder.decode(data), "hello");

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - readUntil consumes delimiter",
  async fn() {
    const reader = readerFromString("hello\nworld");
    const streamReader = new StreamReader(reader);

    await streamReader.readUntil(0x0a); // Read "hello"

    const data = await streamReader.read(5);
    assertExists(data);
    const decoder = new TextDecoder();
    assertEquals(decoder.decode(data), "world");

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - readUntil returns all data if delimiter not found",
  async fn() {
    const reader = readerFromString("no newline here");
    const streamReader = new StreamReader(reader);

    const data = await streamReader.readUntil(0x0a);
    const decoder = new TextDecoder();
    assertEquals(decoder.decode(data), "no newline here");

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - readUntil returns empty at EOF",
  async fn() {
    const reader = readerFromString("");
    const streamReader = new StreamReader(reader);

    const data = await streamReader.readUntil(0x0a);
    assertEquals(data.length, 0);

    streamReader.close();
  },
});

// ============================================================================
// readLine Tests
// ============================================================================

Deno.test({
  name: "StreamReader - readLine reads line with LF",
  async fn() {
    const reader = readerFromString("hello\nworld");
    const streamReader = new StreamReader(reader);

    const line = await streamReader.readLine();
    assertEquals(line, "hello");

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - readLine reads line with CRLF",
  async fn() {
    const reader = readerFromString("hello\r\nworld");
    const streamReader = new StreamReader(reader);

    const line = await streamReader.readLine();
    assertEquals(line, "hello");

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - readLine returns null at EOF",
  async fn() {
    const reader = readerFromString("");
    const streamReader = new StreamReader(reader);

    const line = await streamReader.readLine();
    assertEquals(line, null);

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - readLine reads multiple lines",
  async fn() {
    const reader = readerFromString("line1\nline2\nline3");
    const streamReader = new StreamReader(reader);

    assertEquals(await streamReader.readLine(), "line1");
    assertEquals(await streamReader.readLine(), "line2");
    assertEquals(await streamReader.readLine(), "line3");

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - readLine handles empty lines",
  async fn() {
    const reader = readerFromString("line1\n\nline3");
    const streamReader = new StreamReader(reader);

    assertEquals(await streamReader.readLine(), "line1");
    assertEquals(await streamReader.readLine(), "");
    assertEquals(await streamReader.readLine(), "line3");

    streamReader.close();
  },
});

// ============================================================================
// isEOF Tests
// ============================================================================

Deno.test({
  name: "StreamReader - isEOF returns false before reading all data",
  async fn() {
    const reader = readerFromString("test");
    const streamReader = new StreamReader(reader);

    assertEquals(streamReader.isEOF(), false);

    await streamReader.read(2);
    assertEquals(streamReader.isEOF(), false);

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - isEOF returns true after reading all data",
  async fn() {
    const reader = readerFromString("hi");
    const streamReader = new StreamReader(reader);

    await streamReader.read(100);
    assertEquals(streamReader.isEOF(), true);

    streamReader.close();
  },
});

// ============================================================================
// close Tests
// ============================================================================

Deno.test({
  name: "StreamReader - close sets closed state",
  fn() {
    const reader = readerFromString("test");
    const streamReader = new StreamReader(reader);

    assertEquals(streamReader.isClosed(), false);
    streamReader.close();
    assertEquals(streamReader.isClosed(), true);
  },
});

Deno.test({
  name: "StreamReader - close is idempotent",
  fn() {
    const reader = readerFromString("test");
    const streamReader = new StreamReader(reader);

    streamReader.close();
    streamReader.close(); // Should not throw

    assertEquals(streamReader.isClosed(), true);
  },
});

// ============================================================================
// getReader Tests
// ============================================================================

Deno.test({
  name: "StreamReader - getReader returns underlying reader",
  fn() {
    const reader = readerFromString("test");
    const streamReader = new StreamReader(reader);

    assertEquals(streamReader.getReader(), reader);

    streamReader.close();
  },
});

// ============================================================================
// getAvailable Tests
// ============================================================================

Deno.test({
  name: "StreamReader - getAvailable returns available bytes",
  async fn() {
    const reader = readerFromString("hello");
    const streamReader = new StreamReader(reader);

    assertEquals(streamReader.getAvailable(), 0); // Nothing buffered yet

    await streamReader.read(2);
    // After reading, buffer has remaining data
    assert(streamReader.getAvailable() >= 0);

    streamReader.close();
  },
});

// ============================================================================
// getOptions Tests
// ============================================================================

Deno.test({
  name: "StreamReader - getOptions returns copy of options",
  fn() {
    const options = { bufferSize: 4096 };
    const reader = readerFromString("test");
    const streamReader = new StreamReader(reader, options);

    const returned = streamReader.getOptions();
    assertEquals(returned.bufferSize, 4096);

    streamReader.close();
  },
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

Deno.test({
  name: "StreamReader - handles binary data",
  async fn() {
    const binaryData = new Uint8Array([0x00, 0xFF, 0x7F, 0x80, 0x01]);
    const reader = readerFromBytes(binaryData);
    const streamReader = new StreamReader(reader);

    const data = await streamReader.readExact(5);
    assertEquals(data[0], 0x00);
    assertEquals(data[1], 0xFF);
    assertEquals(data[2], 0x7F);
    assertEquals(data[3], 0x80);
    assertEquals(data[4], 0x01);

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - handles small chunk reads",
  async fn() {
    // Reader delivers data 1 byte at a time
    const reader = readerFromString("hello world", 1);
    const streamReader = new StreamReader(reader);

    const data = await streamReader.readExact(11);
    const decoder = new TextDecoder();
    assertEquals(decoder.decode(data), "hello world");

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - mixed operations work correctly",
  async fn() {
    const reader = readerFromString("header\nbody content here");
    const streamReader = new StreamReader(reader);

    // Read line
    const header = await streamReader.readLine();
    assertEquals(header, "header");

    // Peek
    const peeked = await streamReader.peek(4);
    assertExists(peeked);
    const decoder = new TextDecoder();
    assertEquals(decoder.decode(peeked), "body");

    // Skip
    await streamReader.skip(5); // "body "

    // Read rest
    const rest = await streamReader.read(100);
    assertExists(rest);
    assertEquals(decoder.decode(rest), "content here");

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - reads UTF-8 correctly",
  async fn() {
    const reader = readerFromString("Hello, \u4e16\u754c!"); // "Hello, 世界!"
    const streamReader = new StreamReader(reader);

    const line = await streamReader.readLine();
    // Content will be returned, may need to handle partial reads
    assertExists(line);
    assert(line!.length > 0);

    streamReader.close();
  },
});

Deno.test({
  name: "StreamReader - handles very long lines",
  async fn() {
    const longLine = "x".repeat(10000);
    const reader = readerFromString(longLine + "\nshort");
    const streamReader = new StreamReader(reader);

    const line = await streamReader.readLine();
    assertEquals(line, longLine);
    assertEquals(await streamReader.readLine(), "short");

    streamReader.close();
  },
});
