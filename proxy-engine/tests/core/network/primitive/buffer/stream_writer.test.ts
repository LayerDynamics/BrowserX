/**
 * StreamWriter Tests
 * Comprehensive tests for StreamWriter
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import { StreamWriter } from "../../../../../core/network/primitive/buffer/stream_writer.ts";
import type { Writer } from "jsr:@std/io/types";

// ============================================================================
// Mock Writer Implementation
// ============================================================================

/**
 * Mock writer that collects written data
 */
class MockWriter implements Writer {
  private chunks: Uint8Array[] = [];
  private failOnNextWrite = false;

  write(p: Uint8Array): Promise<number> {
    if (this.failOnNextWrite) {
      this.failOnNextWrite = false;
      return Promise.reject(new Error("Write failed"));
    }

    // Store a copy of the data
    const copy = new Uint8Array(p.length);
    copy.set(p);
    this.chunks.push(copy);

    return Promise.resolve(p.length);
  }

  getData(): Uint8Array {
    const totalLength = this.chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  getDataAsString(): string {
    const decoder = new TextDecoder();
    return decoder.decode(this.getData());
  }

  getChunks(): Uint8Array[] {
    return this.chunks;
  }

  clear(): void {
    this.chunks = [];
  }

  setFailOnNextWrite(): void {
    this.failOnNextWrite = true;
  }
}

// ============================================================================
// Constructor / Initialization Tests
// ============================================================================

Deno.test({
  name: "StreamWriter - can be instantiated",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);
    assertExists(streamWriter);
    await streamWriter.close();
  },
});

Deno.test({
  name: "StreamWriter - accepts custom buffer size",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer, { bufferSize: 4096 });

    assertEquals(streamWriter.getBufferSize(), 4096);
    await streamWriter.close();
  },
});

Deno.test({
  name: "StreamWriter - uses default buffer size of 8192",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    assertEquals(streamWriter.getBufferSize(), 8192);
    await streamWriter.close();
  },
});

Deno.test({
  name: "StreamWriter - starts not closed",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    assertEquals(streamWriter.isClosed(), false);
    await streamWriter.close();
  },
});

Deno.test({
  name: "StreamWriter - starts with 0 bytes written",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    assertEquals(streamWriter.getBytesWritten(), 0);
    await streamWriter.close();
  },
});

// ============================================================================
// write Tests
// ============================================================================

Deno.test({
  name: "StreamWriter - write buffers data",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    const encoder = new TextEncoder();
    await streamWriter.write(encoder.encode("hello"));

    // Data should be buffered, not written yet
    assertEquals(streamWriter.getBufferedBytes(), 5);
    assertEquals(writer.getChunks().length, 0);

    await streamWriter.close();
    assertEquals(writer.getDataAsString(), "hello");
  },
});

Deno.test({
  name: "StreamWriter - write returns bytes written",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    const encoder = new TextEncoder();
    const result = await streamWriter.write(encoder.encode("hello"));

    assertEquals(result, 5);
    await streamWriter.close();
  },
});

Deno.test({
  name: "StreamWriter - write flushes when buffer is full",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer, { bufferSize: 10 });

    const encoder = new TextEncoder();
    await streamWriter.write(encoder.encode("12345")); // 5 bytes
    assertEquals(writer.getChunks().length, 0); // Not flushed yet

    await streamWriter.write(encoder.encode("67890")); // Now 10 bytes, buffer full
    assertEquals(writer.getChunks().length, 1); // Flushed

    await streamWriter.close();
    assertEquals(writer.getDataAsString(), "1234567890");
  },
});

Deno.test({
  name: "StreamWriter - write handles data larger than buffer",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer, { bufferSize: 5 });

    const encoder = new TextEncoder();
    await streamWriter.write(encoder.encode("this is a longer message"));

    await streamWriter.close();
    assertEquals(writer.getDataAsString(), "this is a longer message");
  },
});

Deno.test({
  name: "StreamWriter - write throws when closed",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);
    await streamWriter.close();

    const encoder = new TextEncoder();
    await assertRejects(
      () => streamWriter.write(encoder.encode("test")),
      Error,
      "closed",
    );
  },
});

// ============================================================================
// writeString Tests
// ============================================================================

Deno.test({
  name: "StreamWriter - writeString writes string data",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.writeString("hello world");
    await streamWriter.close();

    assertEquals(writer.getDataAsString(), "hello world");
  },
});

Deno.test({
  name: "StreamWriter - writeString returns bytes written",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    const result = await streamWriter.writeString("test");
    assertEquals(result, 4);

    await streamWriter.close();
  },
});

Deno.test({
  name: "StreamWriter - writeString handles unicode",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.writeString("Hello, \u4e16\u754c!"); // "Hello, 世界!"
    await streamWriter.close();

    assertEquals(writer.getDataAsString(), "Hello, \u4e16\u754c!");
  },
});

// ============================================================================
// writeByte Tests
// ============================================================================

Deno.test({
  name: "StreamWriter - writeByte writes single byte",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.writeByte(65); // 'A'
    await streamWriter.close();

    assertEquals(writer.getDataAsString(), "A");
  },
});

Deno.test({
  name: "StreamWriter - writeByte handles multiple bytes",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.writeByte(65); // 'A'
    await streamWriter.writeByte(66); // 'B'
    await streamWriter.writeByte(67); // 'C'
    await streamWriter.close();

    assertEquals(writer.getDataAsString(), "ABC");
  },
});

Deno.test({
  name: "StreamWriter - writeByte flushes when buffer full",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer, { bufferSize: 3 });

    await streamWriter.writeByte(65);
    await streamWriter.writeByte(66);
    assertEquals(writer.getChunks().length, 0); // Not flushed yet

    await streamWriter.writeByte(67); // Now buffer full
    assertEquals(writer.getChunks().length, 1); // Flushed

    await streamWriter.close();
    assertEquals(writer.getDataAsString(), "ABC");
  },
});

// ============================================================================
// writeCRLF Tests
// ============================================================================

Deno.test({
  name: "StreamWriter - writeCRLF writes CRLF sequence",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.writeCRLF();
    await streamWriter.close();

    const data = writer.getData();
    assertEquals(data.length, 2);
    assertEquals(data[0], 0x0d); // \r
    assertEquals(data[1], 0x0a); // \n
  },
});

// ============================================================================
// writeLine Tests
// ============================================================================

Deno.test({
  name: "StreamWriter - writeLine writes line with CRLF",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.writeLine("hello");
    await streamWriter.close();

    assertEquals(writer.getDataAsString(), "hello\r\n");
  },
});

Deno.test({
  name: "StreamWriter - writeLine handles multiple lines",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.writeLine("line1");
    await streamWriter.writeLine("line2");
    await streamWriter.writeLine("line3");
    await streamWriter.close();

    assertEquals(writer.getDataAsString(), "line1\r\nline2\r\nline3\r\n");
  },
});

// ============================================================================
// flush Tests
// ============================================================================

Deno.test({
  name: "StreamWriter - flush writes buffered data",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.writeString("hello");
    assertEquals(writer.getChunks().length, 0);

    await streamWriter.flush();
    assertEquals(writer.getChunks().length, 1);
    assertEquals(writer.getDataAsString(), "hello");

    await streamWriter.close();
  },
});

Deno.test({
  name: "StreamWriter - flush is no-op when buffer empty",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.flush(); // Should not throw
    assertEquals(writer.getChunks().length, 0);

    await streamWriter.close();
  },
});

Deno.test({
  name: "StreamWriter - flush clears buffer",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.writeString("hello");
    assertEquals(streamWriter.getBufferedBytes(), 5);

    await streamWriter.flush();
    assertEquals(streamWriter.getBufferedBytes(), 0);

    await streamWriter.close();
  },
});

Deno.test({
  name: "StreamWriter - flush throws when closed",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);
    await streamWriter.close();

    await assertRejects(
      () => streamWriter.flush(),
      Error,
      "closed",
    );
  },
});

// ============================================================================
// getBytesWritten Tests
// ============================================================================

Deno.test({
  name: "StreamWriter - getBytesWritten tracks flushed bytes",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.writeString("hello"); // 5 bytes
    assertEquals(streamWriter.getBytesWritten(), 0); // Not flushed yet

    await streamWriter.flush();
    assertEquals(streamWriter.getBytesWritten(), 5);

    await streamWriter.close();
  },
});

Deno.test({
  name: "StreamWriter - getBytesWritten accumulates over multiple flushes",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.writeString("hello");
    await streamWriter.flush();
    assertEquals(streamWriter.getBytesWritten(), 5);

    await streamWriter.writeString("world");
    await streamWriter.flush();
    assertEquals(streamWriter.getBytesWritten(), 10);

    await streamWriter.close();
  },
});

// ============================================================================
// getBufferedBytes Tests
// ============================================================================

Deno.test({
  name: "StreamWriter - getBufferedBytes returns buffered count",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    assertEquals(streamWriter.getBufferedBytes(), 0);

    await streamWriter.writeString("hello");
    assertEquals(streamWriter.getBufferedBytes(), 5);

    await streamWriter.writeString("!");
    assertEquals(streamWriter.getBufferedBytes(), 6);

    await streamWriter.close();
  },
});

// ============================================================================
// close Tests
// ============================================================================

Deno.test({
  name: "StreamWriter - close flushes remaining data",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.writeString("hello");
    assertEquals(writer.getChunks().length, 0);

    await streamWriter.close();
    assertEquals(writer.getDataAsString(), "hello");
  },
});

Deno.test({
  name: "StreamWriter - close sets closed state",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    assertEquals(streamWriter.isClosed(), false);
    await streamWriter.close();
    assertEquals(streamWriter.isClosed(), true);
  },
});

Deno.test({
  name: "StreamWriter - close is idempotent",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.close();
    await streamWriter.close(); // Should not throw

    assertEquals(streamWriter.isClosed(), true);
  },
});

// ============================================================================
// getWriter Tests
// ============================================================================

Deno.test({
  name: "StreamWriter - getWriter returns underlying writer",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    assertEquals(streamWriter.getWriter(), writer);

    await streamWriter.close();
  },
});

// ============================================================================
// getOptions Tests
// ============================================================================

Deno.test({
  name: "StreamWriter - getOptions returns copy of options",
  async fn() {
    const options = { bufferSize: 4096 };
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer, options);

    const returned = streamWriter.getOptions();
    assertEquals(returned.bufferSize, 4096);

    await streamWriter.close();
  },
});

// ============================================================================
// Auto-flush Tests
// ============================================================================

Deno.test({
  name: "StreamWriter - auto-flush writes data periodically",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer, {
      autoFlush: true,
      autoFlushInterval: 50,
    });

    await streamWriter.writeString("hello");
    assertEquals(writer.getChunks().length, 0); // Not flushed yet

    // Wait for auto-flush
    await new Promise((resolve) => setTimeout(resolve, 100));

    assertEquals(writer.getDataAsString(), "hello");

    await streamWriter.close();
  },
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

Deno.test({
  name: "StreamWriter - handles empty writes",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.write(new Uint8Array(0));
    await streamWriter.writeString("");
    await streamWriter.close();

    assertEquals(writer.getData().length, 0);
  },
});

Deno.test({
  name: "StreamWriter - handles binary data",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.write(new Uint8Array([0x00, 0xFF, 0x7F, 0x80]));
    await streamWriter.close();

    const data = writer.getData();
    assertEquals(data[0], 0x00);
    assertEquals(data[1], 0xFF);
    assertEquals(data[2], 0x7F);
    assertEquals(data[3], 0x80);
  },
});

Deno.test({
  name: "StreamWriter - mixed write operations work correctly",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    await streamWriter.writeString("Header: ");
    await streamWriter.writeString("value");
    await streamWriter.writeCRLF();
    await streamWriter.writeLine("Content-Type: text/plain");
    await streamWriter.writeByte(65); // 'A'

    await streamWriter.close();

    assertEquals(
      writer.getDataAsString(),
      "Header: value\r\nContent-Type: text/plain\r\nA",
    );
  },
});

Deno.test({
  name: "StreamWriter - handles large writes",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer, { bufferSize: 100 });

    const largeData = "x".repeat(10000);
    await streamWriter.writeString(largeData);
    await streamWriter.close();

    assertEquals(writer.getDataAsString(), largeData);
  },
});

Deno.test({
  name: "StreamWriter - counts bytes correctly with multiple operations",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer, { bufferSize: 10 });

    await streamWriter.writeString("hello"); // 5 bytes
    await streamWriter.flush();
    assertEquals(streamWriter.getBytesWritten(), 5);

    await streamWriter.writeString("12345"); // 5 bytes, triggers flush
    await streamWriter.writeString("67890"); // 5 bytes
    await streamWriter.flush();
    assertEquals(streamWriter.getBytesWritten(), 15);

    await streamWriter.close();
    assertEquals(writer.getDataAsString(), "hello1234567890");
  },
});

Deno.test({
  name: "StreamWriter - HTTP response simulation",
  async fn() {
    const writer = new MockWriter();
    const streamWriter = new StreamWriter(writer);

    // Write HTTP response
    await streamWriter.writeLine("HTTP/1.1 200 OK");
    await streamWriter.writeLine("Content-Type: application/json");
    await streamWriter.writeLine("Content-Length: 13");
    await streamWriter.writeCRLF(); // Empty line
    await streamWriter.writeString('{"ok": true}');

    await streamWriter.close();

    const expected =
      "HTTP/1.1 200 OK\r\n" +
      "Content-Type: application/json\r\n" +
      "Content-Length: 13\r\n" +
      "\r\n" +
      '{"ok": true}';

    assertEquals(writer.getDataAsString(), expected);
  },
});
