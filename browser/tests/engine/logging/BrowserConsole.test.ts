import { assertEquals, assertStringIncludes } from "@std/assert";
import { BrowserConsole } from "../../../src/engine/logging/BrowserConsole.ts";
import type { LogEntry, LogSink } from "../../../src/engine/logging/LogSink.ts";

class MockSink implements LogSink {
  entries: LogEntry[] = [];
  write(entry: LogEntry): void {
    this.entries.push(entry);
  }
  last(): LogEntry {
    return this.entries[this.entries.length - 1];
  }
}

Deno.test("BrowserConsole - log emits info level", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.log("hello");
  assertEquals(sink.last().level, "info");
  assertEquals(sink.last().message, "hello");
  assertEquals(sink.last().component, "Test");
});

Deno.test("BrowserConsole - debug emits debug level", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.debug("dbg");
  assertEquals(sink.last().level, "debug");
});

Deno.test("BrowserConsole - info emits info level", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.info("inf");
  assertEquals(sink.last().level, "info");
});

Deno.test("BrowserConsole - warn emits warn level", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.warn("w");
  assertEquals(sink.last().level, "warn");
});

Deno.test("BrowserConsole - error emits error level", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.error("e");
  assertEquals(sink.last().level, "error");
});

Deno.test("BrowserConsole - log with data", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.log("msg", { key: 1 });
  assertEquals(sink.last().data, { key: 1 });
});

Deno.test("BrowserConsole - log with multiple args", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.log("msg", 1, 2);
  assertEquals(sink.last().data, [1, 2]);
});

Deno.test("BrowserConsole - trace includes stack", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.trace("myTrace");
  assertEquals(sink.last().level, "debug");
  assertEquals(sink.last().message, "myTrace");
  assertStringIncludes(sink.last().data as string, "Error");
});

Deno.test("BrowserConsole - assert does nothing on true", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.assert(true, "ok");
  assertEquals(sink.entries.length, 0);
});

Deno.test("BrowserConsole - assert emits on false", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.assert(false, "bad");
  assertEquals(sink.last().level, "error");
  assertStringIncludes(sink.last().message, "Assertion failed");
  assertStringIncludes(sink.last().message, "bad");
});

Deno.test("BrowserConsole - count increments", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.count("x");
  assertEquals(sink.last().message, "x: 1");
  c.count("x");
  assertEquals(sink.last().message, "x: 2");
});

Deno.test("BrowserConsole - countReset resets", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.count("x");
  c.count("x");
  c.countReset("x");
  c.count("x");
  assertEquals(sink.last().message, "x: 1");
});

Deno.test("BrowserConsole - time/timeEnd records duration", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.time("t");
  c.timeEnd("t");
  assertStringIncludes(sink.last().message, "t:");
  assertStringIncludes(sink.last().message, "ms");
});

Deno.test("BrowserConsole - timeEnd without time warns", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.timeEnd("nope");
  assertEquals(sink.last().level, "warn");
});

Deno.test("BrowserConsole - timeLog without time warns", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.timeLog("nope");
  assertEquals(sink.last().level, "warn");
});

Deno.test("BrowserConsole - group/groupEnd affects indentation", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.log("a");
  assertEquals(sink.last().message, "a");
  c.group("g1");
  c.log("b");
  assertEquals(sink.last().message, "  b");
  c.group("g2");
  c.log("c");
  assertEquals(sink.last().message, "    c");
  c.groupEnd();
  c.log("d");
  assertEquals(sink.last().message, "  d");
  c.groupEnd();
  c.log("e");
  assertEquals(sink.last().message, "e");
});

Deno.test("BrowserConsole - groupEnd at zero depth is safe", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.groupEnd();
  c.log("ok");
  assertEquals(sink.last().message, "ok");
});

Deno.test("BrowserConsole - dir emits entry", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.dir({ a: 1 });
  assertEquals(sink.last().data, { a: 1 });
});

Deno.test("BrowserConsole - table emits entry", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.table([1, 2, 3]);
  assertEquals(sink.last().data, [1, 2, 3]);
});

Deno.test("BrowserConsole - clear emits info", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  c.clear();
  assertStringIncludes(sink.last().message, "Console cleared");
});

Deno.test("BrowserConsole - timestamp is set", () => {
  const sink = new MockSink();
  const c = new BrowserConsole("Test", sink);
  const before = Date.now();
  c.log("ts");
  const after = Date.now();
  const ts = sink.last().timestamp;
  assertEquals(ts >= before && ts <= after, true);
});
