/**
 * Primitives Tests
 * Comprehensive tests for primitive type definitions
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
  DataType,
  type QueryID,
  type RequestID,
  type ConnectionID,
  type NodeID,
  type RenderObjectID,
  type LayerID,
  type ProcessID,
  type ThreadID,
  type TabID,
  type FrameID,
  type TraceID,
  type SpanID,
  type SessionID,
  type StepID,
  type URLString,
  type CSSSelector,
  type XPathExpression,
  type RegexPattern,
  type Timestamp,
  type DurationMs,
  type Bytes,
  type Pixels,
  type HTTPMethod,
  type HTTPVersion,
  type HTTPStatusCode,
  type ByteBuffer,
} from "../../types/primitives.ts";

// ============================================================================
// DataType Enum Tests
// ============================================================================

Deno.test("DataType - contains all basic types", () => {
  assertEquals(DataType.STRING, "String");
  assertEquals(DataType.NUMBER, "Number");
  assertEquals(DataType.BOOLEAN, "Boolean");
  assertEquals(DataType.NULL, "Null");
});

Deno.test("DataType - contains URL type", () => {
  assertEquals(DataType.URL, "URL");
});

Deno.test("DataType - contains collection types", () => {
  assertEquals(DataType.ARRAY, "Array");
  assertEquals(DataType.OBJECT, "Object");
  assertEquals(DataType.SET, "Set");
});

Deno.test("DataType - contains DOM types", () => {
  assertEquals(DataType.ELEMENT, "Element");
  assertEquals(DataType.NODE_LIST, "NodeList");
  assertEquals(DataType.DOCUMENT, "Document");
});

Deno.test("DataType - contains HTTP types", () => {
  assertEquals(DataType.REQUEST, "Request");
  assertEquals(DataType.RESPONSE, "Response");
  assertEquals(DataType.HEADERS, "Headers");
  assertEquals(DataType.COOKIE, "Cookie");
});

Deno.test("DataType - contains selector types", () => {
  assertEquals(DataType.SELECTOR, "Selector");
  assertEquals(DataType.XPATH, "XPath");
  assertEquals(DataType.REGEX, "Regex");
});

Deno.test("DataType - contains measurement types", () => {
  assertEquals(DataType.DURATION, "Duration");
  assertEquals(DataType.BYTES, "Bytes");
});

Deno.test("DataType - contains UNKNOWN type", () => {
  assertEquals(DataType.UNKNOWN, "Unknown");
});

Deno.test("DataType - all values are unique", () => {
  const values = Object.values(DataType);
  const uniqueValues = new Set(values);
  assertEquals(values.length, uniqueValues.size, "DataType enum should have unique values");
});

Deno.test("DataType - has expected number of types", () => {
  const types = Object.keys(DataType);
  assertEquals(types.length, 21, "DataType should have 21 types");
});

// ============================================================================
// ID Type Tests
// ============================================================================

Deno.test("QueryID - is assignable to string", () => {
  const id: QueryID = "query-123-abc";
  assertEquals(typeof id, "string");
  assert(id.length > 0);
});

Deno.test("RequestID - is assignable to string", () => {
  const id: RequestID = "req-456-def";
  assertEquals(typeof id, "string");
});

Deno.test("ConnectionID - is assignable to string", () => {
  const id: ConnectionID = "conn-789-ghi";
  assertEquals(typeof id, "string");
});

Deno.test("NodeID - is assignable to string", () => {
  const id: NodeID = "node-abc-123";
  assertEquals(typeof id, "string");
});

Deno.test("RenderObjectID - is assignable to string", () => {
  const id: RenderObjectID = "render-obj-456";
  assertEquals(typeof id, "string");
});

Deno.test("LayerID - is assignable to string", () => {
  const id: LayerID = "layer-789";
  assertEquals(typeof id, "string");
});

Deno.test("ProcessID - is assignable to number", () => {
  const id: ProcessID = 12345;
  assertEquals(typeof id, "number");
});

Deno.test("ThreadID - is assignable to number", () => {
  const id: ThreadID = 67890;
  assertEquals(typeof id, "number");
});

Deno.test("TabID - is assignable to string", () => {
  const id: TabID = "tab-001";
  assertEquals(typeof id, "string");
});

Deno.test("FrameID - is assignable to string", () => {
  const id: FrameID = "frame-main";
  assertEquals(typeof id, "string");
});

Deno.test("TraceID - is assignable to string", () => {
  const id: TraceID = "trace-xyz-123";
  assertEquals(typeof id, "string");
});

Deno.test("SpanID - is assignable to string", () => {
  const id: SpanID = "span-abc-456";
  assertEquals(typeof id, "string");
});

Deno.test("SessionID - is assignable to string", () => {
  const id: SessionID = "session-user-123";
  assertEquals(typeof id, "string");
});

Deno.test("StepID - is assignable to string", () => {
  const id: StepID = "step-1-of-5";
  assertEquals(typeof id, "string");
});

// ============================================================================
// Basic Value Type Tests
// ============================================================================

Deno.test("URLString - accepts valid URL strings", () => {
  const url1: URLString = "https://example.com";
  const url2: URLString = "http://localhost:3000/path?query=value";
  const url3: URLString = "wss://websocket.example.com";

  assertEquals(typeof url1, "string");
  assertEquals(typeof url2, "string");
  assertEquals(typeof url3, "string");
});

Deno.test("CSSSelector - accepts valid CSS selectors", () => {
  const selector1: CSSSelector = "#main";
  const selector2: CSSSelector = ".container > div";
  const selector3: CSSSelector = 'input[type="text"]';
  const selector4: CSSSelector = "div:nth-child(2n+1)";

  assertEquals(typeof selector1, "string");
  assertEquals(typeof selector2, "string");
  assertEquals(typeof selector3, "string");
  assertEquals(typeof selector4, "string");
});

Deno.test("XPathExpression - accepts valid XPath expressions", () => {
  const xpath1: XPathExpression = "//div[@id='main']";
  const xpath2: XPathExpression = "/html/body/div[1]";
  const xpath3: XPathExpression = "//a[contains(@href, 'example')]";

  assertEquals(typeof xpath1, "string");
  assertEquals(typeof xpath2, "string");
  assertEquals(typeof xpath3, "string");
});

Deno.test("RegexPattern - accepts regex pattern strings", () => {
  const pattern1: RegexPattern = "^[a-z]+$";
  const pattern2: RegexPattern = "\\d{3}-\\d{2}-\\d{4}";
  const pattern3: RegexPattern = ".*\\.js$";

  assertEquals(typeof pattern1, "string");
  assertEquals(typeof pattern2, "string");
  assertEquals(typeof pattern3, "string");
});

Deno.test("Timestamp - accepts Unix timestamps", () => {
  const now: Timestamp = Date.now();
  const past: Timestamp = 1609459200000; // 2021-01-01
  const future: Timestamp = 1893456000000; // 2030-01-01

  assertEquals(typeof now, "number");
  assertEquals(typeof past, "number");
  assertEquals(typeof future, "number");
  assert(now > past);
  assert(future > now);
});

Deno.test("DurationMs - accepts millisecond durations", () => {
  const oneSecond: DurationMs = 1000;
  const oneMinute: DurationMs = 60000;
  const oneHour: DurationMs = 3600000;

  assertEquals(oneSecond, 1000);
  assertEquals(oneMinute, 60000);
  assertEquals(oneHour, 3600000);
});

Deno.test("Bytes - accepts byte counts", () => {
  const oneKB: Bytes = 1024;
  const oneMB: Bytes = 1024 * 1024;
  const oneGB: Bytes = 1024 * 1024 * 1024;

  assertEquals(oneKB, 1024);
  assertEquals(oneMB, 1048576);
  assertEquals(oneGB, 1073741824);
});

Deno.test("Pixels - accepts pixel values", () => {
  const width: Pixels = 1920;
  const height: Pixels = 1080;
  const subPixel: Pixels = 0.5;

  assertEquals(width, 1920);
  assertEquals(height, 1080);
  assertEquals(subPixel, 0.5);
});

// ============================================================================
// HTTP Type Tests
// ============================================================================

Deno.test("HTTPMethod - accepts all standard HTTP methods", () => {
  const methods: HTTPMethod[] = [
    "GET", "POST", "PUT", "DELETE", "PATCH",
    "HEAD", "OPTIONS", "CONNECT", "TRACE"
  ];

  assertEquals(methods.length, 9);
  for (const method of methods) {
    assertEquals(typeof method, "string");
  }
});

Deno.test("HTTPMethod - GET is valid", () => {
  const method: HTTPMethod = "GET";
  assertEquals(method, "GET");
});

Deno.test("HTTPMethod - POST is valid", () => {
  const method: HTTPMethod = "POST";
  assertEquals(method, "POST");
});

Deno.test("HTTPMethod - PUT is valid", () => {
  const method: HTTPMethod = "PUT";
  assertEquals(method, "PUT");
});

Deno.test("HTTPMethod - DELETE is valid", () => {
  const method: HTTPMethod = "DELETE";
  assertEquals(method, "DELETE");
});

Deno.test("HTTPMethod - PATCH is valid", () => {
  const method: HTTPMethod = "PATCH";
  assertEquals(method, "PATCH");
});

Deno.test("HTTPVersion - accepts HTTP 1.0", () => {
  const version: HTTPVersion = "1.0";
  assertEquals(version, "1.0");
});

Deno.test("HTTPVersion - accepts HTTP 1.1", () => {
  const version: HTTPVersion = "1.1";
  assertEquals(version, "1.1");
});

Deno.test("HTTPVersion - accepts HTTP 2.0", () => {
  const version: HTTPVersion = "2.0";
  assertEquals(version, "2.0");
});

Deno.test("HTTPVersion - accepts HTTP 3.0", () => {
  const version: HTTPVersion = "3.0";
  assertEquals(version, "3.0");
});

Deno.test("HTTPStatusCode - accepts success codes", () => {
  const ok: HTTPStatusCode = 200;
  const created: HTTPStatusCode = 201;
  const noContent: HTTPStatusCode = 204;

  assertEquals(ok, 200);
  assertEquals(created, 201);
  assertEquals(noContent, 204);
});

Deno.test("HTTPStatusCode - accepts redirect codes", () => {
  const movedPermanently: HTTPStatusCode = 301;
  const found: HTTPStatusCode = 302;
  const notModified: HTTPStatusCode = 304;

  assertEquals(movedPermanently, 301);
  assertEquals(found, 302);
  assertEquals(notModified, 304);
});

Deno.test("HTTPStatusCode - accepts client error codes", () => {
  const badRequest: HTTPStatusCode = 400;
  const unauthorized: HTTPStatusCode = 401;
  const notFound: HTTPStatusCode = 404;

  assertEquals(badRequest, 400);
  assertEquals(unauthorized, 401);
  assertEquals(notFound, 404);
});

Deno.test("HTTPStatusCode - accepts server error codes", () => {
  const internalError: HTTPStatusCode = 500;
  const badGateway: HTTPStatusCode = 502;
  const serviceUnavailable: HTTPStatusCode = 503;

  assertEquals(internalError, 500);
  assertEquals(badGateway, 502);
  assertEquals(serviceUnavailable, 503);
});

// ============================================================================
// ByteBuffer Type Tests
// ============================================================================

Deno.test("ByteBuffer - is Uint8Array", () => {
  const buffer: ByteBuffer = new Uint8Array([1, 2, 3, 4, 5]);

  assert(buffer instanceof Uint8Array);
  assertEquals(buffer.length, 5);
  assertEquals(buffer[0], 1);
  assertEquals(buffer[4], 5);
});

Deno.test("ByteBuffer - can be empty", () => {
  const buffer: ByteBuffer = new Uint8Array(0);

  assertEquals(buffer.length, 0);
});

Deno.test("ByteBuffer - can hold large data", () => {
  const size = 1024 * 1024; // 1MB
  const buffer: ByteBuffer = new Uint8Array(size);

  assertEquals(buffer.length, size);
});

Deno.test("ByteBuffer - values are 0-255", () => {
  const buffer: ByteBuffer = new Uint8Array([0, 128, 255]);

  assertEquals(buffer[0], 0);
  assertEquals(buffer[1], 128);
  assertEquals(buffer[2], 255);
});

Deno.test("ByteBuffer - from string encoding", () => {
  const encoder = new TextEncoder();
  const buffer: ByteBuffer = encoder.encode("Hello");

  assertEquals(buffer.length, 5);
  assertEquals(buffer[0], 72); // 'H'
  assertEquals(buffer[1], 101); // 'e'
});

// ============================================================================
// Type Compatibility Tests
// ============================================================================

Deno.test("DataType can be used in switch statements", () => {
  function getDt(): DataType { return DataType.STRING; }
  const dt = getDt();
  let result = "";

  switch (dt) {
    case DataType.STRING:
      result = "string";
      break;
    case DataType.NUMBER:
      result = "number";
      break;
    default:
      result = "other";
  }

  assertEquals(result, "string");
});

Deno.test("DataType can be used in object keys", () => {
  const typeMap: Record<DataType, string> = {
    [DataType.STRING]: "text",
    [DataType.NUMBER]: "numeric",
    [DataType.BOOLEAN]: "flag",
    [DataType.NULL]: "empty",
    [DataType.URL]: "link",
    [DataType.ARRAY]: "list",
    [DataType.OBJECT]: "map",
    [DataType.SET]: "unique",
    [DataType.ELEMENT]: "dom",
    [DataType.NODE_LIST]: "nodes",
    [DataType.DOCUMENT]: "doc",
    [DataType.REQUEST]: "req",
    [DataType.RESPONSE]: "res",
    [DataType.HEADERS]: "hdrs",
    [DataType.COOKIE]: "cookie",
    [DataType.SELECTOR]: "css",
    [DataType.XPATH]: "xpath",
    [DataType.REGEX]: "pattern",
    [DataType.DURATION]: "time",
    [DataType.BYTES]: "size",
    [DataType.UNKNOWN]: "unknown",
  };

  assertEquals(typeMap[DataType.STRING], "text");
  assertEquals(typeMap[DataType.NUMBER], "numeric");
});

Deno.test("ID types can be used as Map keys", () => {
  const queryMap = new Map<QueryID, string>();
  queryMap.set("query-1", "result-1");
  queryMap.set("query-2", "result-2");

  assertEquals(queryMap.get("query-1"), "result-1");
  assertEquals(queryMap.size, 2);
});

Deno.test("Timestamp can be used with Date", () => {
  const ts: Timestamp = 1609459200000; // 2021-01-01 00:00:00 UTC
  const date = new Date(ts);

  // Use UTC methods to avoid timezone issues
  assertEquals(date.getUTCFullYear(), 2021);
  assertEquals(date.getUTCMonth(), 0); // January
  assertEquals(date.getUTCDate(), 1);
});

Deno.test("DurationMs arithmetic works correctly", () => {
  const duration1: DurationMs = 5000;
  const duration2: DurationMs = 3000;
  const total: DurationMs = duration1 + duration2;

  assertEquals(total, 8000);
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test("DataType - values are string-like for serialization", () => {
  const dt = DataType.STRING;
  assertEquals(JSON.stringify(dt), '"String"');
});

Deno.test("HTTPStatusCode - can be compared numerically", () => {
  const code: HTTPStatusCode = 200;
  assert(code >= 200 && code < 300, "Should be success code");
});

Deno.test("Bytes - can represent large files", () => {
  const largeFile: Bytes = 5 * 1024 * 1024 * 1024; // 5GB
  assertEquals(largeFile, 5368709120);
});

Deno.test("Pixels - can be negative for offsets", () => {
  const offset: Pixels = -100;
  assertEquals(offset, -100);
});
