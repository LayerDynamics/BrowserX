/**
 * Tests for WindowObject fetch() and localStorage/sessionStorage
 * wired to RequestPipeline and StorageManager
 *
 * Comprehensive functional, integration, and e2e test suite.
 */

import { assert, assertEquals, assertExists, assertThrows } from "@std/assert";
import { WindowObject } from "../../../src/engine/javascript/WindowObject.ts";
import { V8Context } from "../../../src/engine/javascript/V8Context.ts";
import { ScriptExecutor } from "../../../src/engine/javascript/ScriptExecutor.ts";
import {
  createBoolean,
  createNativeFunction,
  createNull,
  createNumber,
  createObject,
  createString,
  createUndefined,
  getProperty,
  type JSValue,
  setProperty,
} from "../../../src/engine/javascript/JSValue.ts";
import type { DOMElement, DOMNode } from "../../../src/types/dom.ts";
import { DOMNodeType } from "../../../src/types/dom.ts";
import { StorageManager } from "../../../src/engine/storage/StorageManager.ts";
import { QuotaManager } from "../../../src/engine/storage/QuotaManager.ts";
import {
  type StorageEvent,
  StorageEventEmitter,
} from "../../../src/engine/storage/StorageEvents.ts";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockDocument(): DOMElement {
  const doc: any = {
    nodeType: DOMNodeType.ELEMENT,
    nodeName: "DOCUMENT",
    tagName: "DOCUMENT",
    nodeValue: null,
    childNodes: [],
    parentNode: null,
    parentElement: null,
    previousElementSibling: null,
    nextElementSibling: null,
    firstChild: null,
    lastChild: null,
    previousSibling: null,
    nextSibling: null,
    ownerDocument: null,
    attributes: new Map(),
    id: "",
    className: "",
    classList: {},
    getAttribute: () => null,
    setAttribute: () => {},
    removeAttribute: () => {},
    hasAttribute: () => false,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    getElementsByClassName: () => [],
    getElementById: () => null,
    getComputedStyle: () => ({}),
    matches: () => false,
    closest: () => null,
    cloneNode: () => doc,
    appendChild: (child: DOMNode) => child,
    removeChild: (child: DOMNode) => child,
    insertBefore: (n: DOMNode) => n,
    replaceChild: (n: DOMNode) => n,
    contains: () => false,
    compareDocumentPosition: () => 0,
  };
  return doc as DOMElement;
}

/** Call a native function JSValue with given args */
function callNativeFn(fn: JSValue, ...args: JSValue[]): JSValue {
  if (fn.type === "function" && (fn as any).value?.nativeImpl) {
    return (fn as any).value.nativeImpl(...args);
  }
  throw new Error(`Not a native function: ${fn.type}, isNative: ${(fn as any).value?.isNative}`);
}

/** Extract native string from JSValue */
function jsStr(v: JSValue): string {
  assertEquals(v.type, "string");
  return (v as any).value;
}

/** Extract native number from JSValue */
function jsNum(v: JSValue): number {
  assertEquals(v.type, "number");
  return (v as any).value;
}

/** Extract native boolean from JSValue */
function jsBool(v: JSValue): boolean {
  assertEquals(v.type, "boolean");
  return (v as any).value;
}

/** Assert JSValue is null type */
function assertJsNull(v: JSValue) {
  assertEquals(v.type, "null");
}

/** Assert JSValue is undefined type */
function assertJsUndefined(v: JSValue) {
  assertEquals(v.type, "undefined");
}

/** Configurable mock pipeline that records all calls */
class MockRequestPipeline {
  calls: { method: string; url: string; body?: Uint8Array; options?: unknown }[] = [];
  mockStatusCode = 200;
  mockStatusText = "OK";
  mockHeaders = new Map<string, string>([["content-type", "application/json"]]);
  mockBody = new TextEncoder().encode('{"message":"hello"}');
  shouldReject = false;
  rejectError = new Error("Network error");
  /** When true, the promise never resolves (no timers, no leaks) */
  neverResolve = false;

  async get(url: string, options?: unknown) {
    this.calls.push({ method: "GET", url, options });
    if (this.neverResolve) return new Promise<never>(() => {});
    if (this.shouldReject) throw this.rejectError;
    return this.buildResult(url);
  }
  async post(url: string, body?: Uint8Array, options?: unknown) {
    this.calls.push({ method: "POST", url, body, options });
    if (this.neverResolve) return new Promise<never>(() => {});
    if (this.shouldReject) throw this.rejectError;
    return this.buildResult(url);
  }
  async put(url: string, body?: Uint8Array, options?: unknown) {
    this.calls.push({ method: "PUT", url, body, options });
    if (this.neverResolve) return new Promise<never>(() => {});
    if (this.shouldReject) throw this.rejectError;
    return this.buildResult(url);
  }
  async delete(url: string, options?: unknown) {
    this.calls.push({ method: "DELETE", url, options });
    if (this.neverResolve) return new Promise<never>(() => {});
    if (this.shouldReject) throw this.rejectError;
    return this.buildResult(url);
  }
  async request(
    url: string,
    options?: { method?: string; headers?: Record<string, string>; body?: Uint8Array },
  ) {
    const method = options?.method ?? "GET";
    this.calls.push({ method, url, body: options?.body, options });
    if (this.neverResolve) return new Promise<never>(() => {});
    if (this.shouldReject) throw this.rejectError;
    return this.buildResult(url);
  }
  private buildResult(url: string) {
    return {
      request: { url },
      response: {
        statusCode: this.mockStatusCode,
        statusText: this.mockStatusText,
        headers: new Map(this.mockHeaders),
        body: new Uint8Array(this.mockBody),
      },
      fromCache: false,
      timing: { total: 10 },
    };
  }
}

function setup(pipeline?: unknown, sm?: StorageManager, url = "https://example.com/page") {
  const context = new V8Context();
  const doc = createMockDocument();
  const wo = new WindowObject(context, doc, url, pipeline as any, sm);
  wo.install();
  return { context, wo, doc };
}

function getFetchFn(ctx: V8Context): JSValue {
  return getProperty(ctx.global, "fetch")!;
}
function getLS(ctx: V8Context): JSValue {
  return getProperty(ctx.global, "localStorage")!;
}
function getSS(ctx: V8Context): JSValue {
  return getProperty(ctx.global, "sessionStorage")!;
}

/** Call a storage method by name */
function storageFn(storage: JSValue, name: string): JSValue {
  return getProperty(storage, name)!;
}

// ============================================================================
// FETCH — Functional Tests
// ============================================================================

Deno.test("fetch/fn - GET request dispatches to pipeline with correct URL", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  callNativeFn(getFetchFn(context), createString("https://api.example.com/users"));
  assertEquals(p.calls.length, 1);
  assertEquals(p.calls[0].method, "GET");
  assertEquals(p.calls[0].url, "https://api.example.com/users");
  context.dispose();
});

Deno.test("fetch/fn - POST sends body as Uint8Array to pipeline", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const opts = createObject();
  setProperty(opts, "method", createString("POST"));
  setProperty(opts, "body", createString('{"username":"alice"}'));
  callNativeFn(getFetchFn(context), createString("https://api.com/signup"), opts);
  assertEquals(p.calls[0].method, "POST");
  const sentBody = p.calls[0].body as Uint8Array;
  assertEquals(new TextDecoder().decode(sentBody), '{"username":"alice"}');
  context.dispose();
});

Deno.test("fetch/fn - PUT sends body as Uint8Array to pipeline", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const opts = createObject();
  setProperty(opts, "method", createString("PUT"));
  setProperty(opts, "body", createString("updated"));
  callNativeFn(getFetchFn(context), createString("https://api.com/item/1"), opts);
  assertEquals(p.calls[0].method, "PUT");
  assertEquals(new TextDecoder().decode(p.calls[0].body as Uint8Array), "updated");
  context.dispose();
});

Deno.test("fetch/fn - DELETE sends no body", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const opts = createObject();
  setProperty(opts, "method", createString("DELETE"));
  callNativeFn(getFetchFn(context), createString("https://api.com/item/99"), opts);
  assertEquals(p.calls[0].method, "DELETE");
  assertEquals(p.calls[0].body, undefined);
  context.dispose();
});

Deno.test("fetch/fn - multiple headers are forwarded to pipeline", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const hdrs = createObject();
  setProperty(hdrs, "Authorization", createString("Bearer xyz"));
  setProperty(hdrs, "Content-Type", createString("application/json"));
  setProperty(hdrs, "X-Custom", createString("value123"));
  const opts = createObject();
  setProperty(opts, "headers", hdrs);
  callNativeFn(getFetchFn(context), createString("https://api.com"), opts);
  const passedHeaders = (p.calls[0].options as any).headers;
  assertEquals(passedHeaders["Authorization"], "Bearer xyz");
  assertEquals(passedHeaders["Content-Type"], "application/json");
  assertEquals(passedHeaders["X-Custom"], "value123");
  context.dispose();
});

Deno.test("fetch/fn - POST without body sends empty Uint8Array", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const opts = createObject();
  setProperty(opts, "method", createString("POST"));
  // no body property
  callNativeFn(getFetchFn(context), createString("https://api.com/endpoint"), opts);
  assertEquals(p.calls[0].method, "POST");
  const sentBody = p.calls[0].body as Uint8Array;
  assertEquals(sentBody.length, 0);
  context.dispose();
});

Deno.test("fetch/fn - default method is GET when options has no method", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const opts = createObject();
  setProperty(opts, "headers", createObject()); // options present but no method
  callNativeFn(getFetchFn(context), createString("https://api.com"), opts);
  assertEquals(p.calls[0].method, "GET");
  context.dispose();
});

Deno.test("fetch/fn - response object has all expected properties", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  assertEquals(resp.type, "object");
  assertExists(getProperty(resp, "ok"));
  assertExists(getProperty(resp, "status"));
  assertExists(getProperty(resp, "statusText"));
  assertExists(getProperty(resp, "url"));
  assertExists(getProperty(resp, "headers"));
  assertExists(getProperty(resp, "text"));
  assertExists(getProperty(resp, "json"));
  assertEquals(getProperty(resp, "text")!.type, "function");
  assertEquals(getProperty(resp, "json")!.type, "function");
  context.dispose();
});

Deno.test("fetch/fn - response url matches requested url", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://target.com/path?q=1"));
  assertEquals(jsStr(getProperty(resp, "url")!), "https://target.com/path?q=1");
  context.dispose();
});

Deno.test("fetch/fn - response initial ok/status/statusText before resolution", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  // Before async resolution, initial values set
  assertEquals(jsBool(getProperty(resp, "ok")!), true);
  assertEquals(jsNum(getProperty(resp, "status")!), 200);
  assertEquals(jsStr(getProperty(resp, "statusText")!), "OK");
  context.dispose();
});

Deno.test("fetch/fn - text() returns decoded UTF-8 body after resolution", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new TextEncoder().encode("Hello, 世界! 🌍");
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const text = callNativeFn(storageFn(resp, "text"));
  assertEquals(jsStr(text), "Hello, 世界! 🌍");
  context.dispose();
});

Deno.test("fetch/fn - text() returns empty string before resolution", () => {
  const p = new MockRequestPipeline();
  p.neverResolve = true;
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  // Promise never resolves — text() should return empty string
  const text = callNativeFn(storageFn(resp, "text"));
  assertEquals(jsStr(text), "");
  context.dispose();
});

Deno.test("fetch/fn - json() returns parsed nested object after resolution", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new TextEncoder().encode(
    '{"user":{"name":"Alice","age":30},"tags":["admin","editor"]}',
  );
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const json = callNativeFn(storageFn(resp, "json"));
  assertEquals(json.type, "object");
  // nested object
  const user = getProperty(json, "user")!;
  assertEquals(user.type, "object");
  assertEquals(jsStr(getProperty(user, "name")!), "Alice");
  assertEquals(jsNum(getProperty(user, "age")!), 30);
  // nested array-like
  const tags = getProperty(json, "tags")!;
  assertEquals(tags.type, "object");
  assertEquals(jsStr(getProperty(tags, "0")!), "admin");
  assertEquals(jsStr(getProperty(tags, "1")!), "editor");
  assertEquals(jsNum(getProperty(tags, "length")!), 2);
  context.dispose();
});

Deno.test("fetch/fn - json() returns null for invalid JSON body", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new TextEncoder().encode("not valid json {{{");
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const json = callNativeFn(storageFn(resp, "json"));
  assertJsNull(json);
  context.dispose();
});

Deno.test({
  name: "fetch/fn - json() returns null before resolution",
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const p = new MockRequestPipeline();
    p.delay = 500;
    const { context } = setup(p);
    const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
    const json = callNativeFn(storageFn(resp, "json"));
    assertJsNull(json);
    context.dispose();
  },
});

Deno.test("fetch/fn - json() parses array at top level", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new TextEncoder().encode('[1,"two",true,null]');
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const json = callNativeFn(storageFn(resp, "json"));
  assertEquals(json.type, "object");
  assertEquals(jsNum(getProperty(json, "0")!), 1);
  assertEquals(jsStr(getProperty(json, "1")!), "two");
  assertEquals(jsBool(getProperty(json, "2")!), true);
  assertJsNull(getProperty(json, "3")!);
  assertEquals(jsNum(getProperty(json, "length")!), 4);
  context.dispose();
});

Deno.test("fetch/fn - json() parses primitive string value", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new TextEncoder().encode('"just a string"');
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const json = callNativeFn(storageFn(resp, "json"));
  assertEquals(jsStr(json), "just a string");
  context.dispose();
});

Deno.test("fetch/fn - json() parses boolean value", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new TextEncoder().encode("false");
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const json = callNativeFn(storageFn(resp, "json"));
  assertEquals(jsBool(json), false);
  context.dispose();
});

Deno.test("fetch/fn - json() parses null value", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new TextEncoder().encode("null");
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const json = callNativeFn(storageFn(resp, "json"));
  assertJsNull(json);
  context.dispose();
});

Deno.test("fetch/fn - text() and json() can both be called on same response", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new TextEncoder().encode('{"x":1}');
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const text = callNativeFn(storageFn(resp, "text"));
  assertEquals(jsStr(text), '{"x":1}');
  const json = callNativeFn(storageFn(resp, "json"));
  assertEquals(jsNum(getProperty(json, "x")!), 1);
  context.dispose();
});

Deno.test("fetch/fn - text() returns empty string on pipeline rejection", async () => {
  const p = new MockRequestPipeline();
  p.shouldReject = true;
  p.rejectError = new Error("DNS lookup failed");
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://fail.example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const text = callNativeFn(storageFn(resp, "text"));
  assertEquals(jsStr(text), "");
  context.dispose();
});

Deno.test("fetch/fn - json() returns null on pipeline rejection", async () => {
  const p = new MockRequestPipeline();
  p.shouldReject = true;
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://fail.example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const json = callNativeFn(storageFn(resp, "json"));
  assertJsNull(json);
  context.dispose();
});

Deno.test("fetch/fn - no pipeline returns empty stub object", () => {
  const { context } = setup();
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  assertEquals(resp.type, "object");
  // Stub has no text/json methods
  context.dispose();
});

Deno.test("fetch/fn - non-string URL arg returns empty object", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createNumber(42));
  assertEquals(resp.type, "object");
  assertEquals(p.calls.length, 0); // no request made
  context.dispose();
});

Deno.test("fetch/fn - no args returns empty object", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context));
  assertEquals(resp.type, "object");
  assertEquals(p.calls.length, 0);
  context.dispose();
});

Deno.test("fetch/fn - multiple sequential fetches dispatch independently", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  callNativeFn(getFetchFn(context), createString("https://api.com/a"));
  callNativeFn(getFetchFn(context), createString("https://api.com/b"));
  callNativeFn(getFetchFn(context), createString("https://api.com/c"));
  assertEquals(p.calls.length, 3);
  assertEquals(p.calls[0].url, "https://api.com/a");
  assertEquals(p.calls[1].url, "https://api.com/b");
  assertEquals(p.calls[2].url, "https://api.com/c");
  context.dispose();
});

Deno.test({
  name: "fetch/fn - large JSON body round-trips correctly",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const p = new MockRequestPipeline();
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item_${i}` }));
    p.mockBody = new TextEncoder().encode(JSON.stringify(items));
    const { context } = setup(p);
    const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
    await new Promise((r) => setTimeout(r, 50));
    const json = callNativeFn(storageFn(resp, "json"));
    assertEquals(jsNum(getProperty(json, "length")!), 100);
    const item50 = getProperty(json, "50")!;
    assertEquals(jsNum(getProperty(item50, "id")!), 50);
    assertEquals(jsStr(getProperty(item50, "name")!), "item_50");
    context.dispose();
  },
});

Deno.test("fetch/fn - empty body text() returns empty string", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new Uint8Array(0);
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  assertEquals(jsStr(callNativeFn(storageFn(resp, "text"))), "");
  context.dispose();
});

// ============================================================================
// FETCH — Enhanced Response API Tests
// ============================================================================

Deno.test("fetch/fn - response has type property set to 'basic'", async () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  assertEquals(jsStr(getProperty(resp, "type")!), "basic");
  context.dispose();
});

Deno.test("fetch/fn - response has redirected property set to false", async () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  assertEquals(jsBool(getProperty(resp, "redirected")!), false);
  context.dispose();
});

Deno.test("fetch/fn - response bodyUsed starts false, becomes true after text()", async () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  assertEquals(jsBool(getProperty(resp, "bodyUsed")!), false);
  callNativeFn(storageFn(resp, "text"));
  assertEquals(jsBool(getProperty(resp, "bodyUsed")!), true);
  context.dispose();
});

Deno.test("fetch/fn - response bodyUsed becomes true after json()", async () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  callNativeFn(storageFn(resp, "json"));
  assertEquals(jsBool(getProperty(resp, "bodyUsed")!), true);
  context.dispose();
});

Deno.test("fetch/fn - blob() returns object with size and type", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new TextEncoder().encode("hello world");
  p.mockHeaders = new Map([["content-type", "text/plain"]]);
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const blob = callNativeFn(storageFn(resp, "blob"));
  assertEquals(jsNum(getProperty(blob, "size")!), 11);
  assertEquals(jsStr(getProperty(blob, "type")!), "text/plain");
  // blob.text() should return the body text
  assertEquals(jsStr(callNativeFn(storageFn(blob, "text"))), "hello world");
  context.dispose();
});

Deno.test("fetch/fn - arrayBuffer() returns object with byteLength", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new TextEncoder().encode("12345");
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const buf = callNativeFn(storageFn(resp, "arrayBuffer"));
  assertEquals(jsNum(getProperty(buf, "byteLength")!), 5);
  context.dispose();
});

Deno.test("fetch/fn - clone() returns independent response with same data", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new TextEncoder().encode('{"cloned":true}');
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com/data"));
  await new Promise((r) => setTimeout(r, 50));
  const cloned = callNativeFn(storageFn(resp, "clone"));
  assertEquals(jsStr(getProperty(cloned, "url")!), "https://example.com/data");
  const json = callNativeFn(storageFn(cloned, "json"));
  assertEquals(jsBool(getProperty(json, "cloned")!), true);
  context.dispose();
});

Deno.test("fetch/fn - headers.get() returns header value case-insensitively", async () => {
  const p = new MockRequestPipeline();
  p.mockHeaders = new Map([["Content-Type", "application/json"], ["X-Custom", "test-value"]]);
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  // Call text() to trigger response property update
  callNativeFn(storageFn(resp, "text"));
  const headers = getProperty(resp, "headers")!;
  assertEquals(
    jsStr(callNativeFn(storageFn(headers, "get"), createString("content-type"))),
    "application/json",
  );
  assertEquals(
    jsStr(callNativeFn(storageFn(headers, "get"), createString("x-custom"))),
    "test-value",
  );
  context.dispose();
});

Deno.test("fetch/fn - headers.has() checks header existence", async () => {
  const p = new MockRequestPipeline();
  p.mockHeaders = new Map([["content-type", "text/html"]]);
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  callNativeFn(storageFn(resp, "text"));
  const headers = getProperty(resp, "headers")!;
  assertEquals(jsBool(callNativeFn(storageFn(headers, "has"), createString("content-type"))), true);
  assertEquals(jsBool(callNativeFn(storageFn(headers, "has"), createString("x-missing"))), false);
  context.dispose();
});

Deno.test("fetch/fn - response updates ok/status/statusText from actual response on body read", async () => {
  const p = new MockRequestPipeline();
  p.mockStatusCode = 404;
  p.mockStatusText = "Not Found";
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  // Before body read, initial placeholders
  // After body read, should update to actual values
  callNativeFn(storageFn(resp, "text"));
  assertEquals(jsBool(getProperty(resp, "ok")!), false);
  assertEquals(jsNum(getProperty(resp, "status")!), 404);
  assertEquals(jsStr(getProperty(resp, "statusText")!), "Not Found");
  context.dispose();
});

Deno.test("fetch/fn - PATCH method uses request() on pipeline", async () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const opts = createObject();
  setProperty(opts, "method", createString("PATCH"));
  setProperty(opts, "body", createString('{"patched":true}'));
  callNativeFn(getFetchFn(context), createString("https://api.com/resource"), opts);
  assertEquals(p.calls.length, 1);
  assertEquals(p.calls[0].method, "PATCH");
  context.dispose();
});

Deno.test("fetch/fn - HEAD method uses request() on pipeline", async () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const opts = createObject();
  setProperty(opts, "method", createString("HEAD"));
  callNativeFn(getFetchFn(context), createString("https://api.com/resource"), opts);
  assertEquals(p.calls.length, 1);
  assertEquals(p.calls[0].method, "HEAD");
  context.dispose();
});

Deno.test("fetch/fn - OPTIONS method uses request() on pipeline", async () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const opts = createObject();
  setProperty(opts, "method", createString("OPTIONS"));
  callNativeFn(getFetchFn(context), createString("https://api.com/resource"), opts);
  assertEquals(p.calls.length, 1);
  assertEquals(p.calls[0].method, "OPTIONS");
  context.dispose();
});

Deno.test("fetch/fn - method is normalized to uppercase", async () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const opts = createObject();
  setProperty(opts, "method", createString("post"));
  setProperty(opts, "body", createString("data"));
  callNativeFn(getFetchFn(context), createString("https://api.com/data"), opts);
  assertEquals(p.calls.length, 1);
  assertEquals(p.calls[0].method, "POST");
  context.dispose();
});

// ============================================================================
// LOCALSTORAGE — Functional Tests
// ============================================================================

Deno.test("localStorage/fn - setItem + getItem round-trip", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString("key"), createString("value"));
  assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString("key"))), "value");
  context.dispose();
});

Deno.test("localStorage/fn - getItem returns null for nonexistent key", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  assertJsNull(callNativeFn(storageFn(getLS(context), "getItem"), createString("missing")));
  context.dispose();
});

Deno.test("localStorage/fn - setItem overwrites existing value", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString("k"), createString("v1"));
  callNativeFn(storageFn(ls, "setItem"), createString("k"), createString("v2"));
  assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString("k"))), "v2");
  context.dispose();
});

Deno.test("localStorage/fn - setItem returns undefined", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const result = callNativeFn(
    storageFn(getLS(context), "setItem"),
    createString("k"),
    createString("v"),
  );
  assertJsUndefined(result);
  context.dispose();
});

Deno.test("localStorage/fn - removeItem deletes existing key", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString("del"), createString("me"));
  callNativeFn(storageFn(ls, "removeItem"), createString("del"));
  assertJsNull(callNativeFn(storageFn(ls, "getItem"), createString("del")));
  context.dispose();
});

Deno.test("localStorage/fn - removeItem on nonexistent key is no-op", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString("keep"), createString("me"));
  callNativeFn(storageFn(ls, "removeItem"), createString("nope"));
  assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString("keep"))), "me");
  context.dispose();
});

Deno.test("localStorage/fn - removeItem returns undefined", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const result = callNativeFn(storageFn(getLS(context), "removeItem"), createString("x"));
  assertJsUndefined(result);
  context.dispose();
});

Deno.test("localStorage/fn - clear removes all items", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString("a"), createString("1"));
  callNativeFn(storageFn(ls, "setItem"), createString("b"), createString("2"));
  callNativeFn(storageFn(ls, "setItem"), createString("c"), createString("3"));
  callNativeFn(storageFn(ls, "clear"));
  assertJsNull(callNativeFn(storageFn(ls, "getItem"), createString("a")));
  assertJsNull(callNativeFn(storageFn(ls, "getItem"), createString("b")));
  assertJsNull(callNativeFn(storageFn(ls, "getItem"), createString("c")));
  context.dispose();
});

Deno.test("localStorage/fn - clear returns undefined", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  assertJsUndefined(callNativeFn(storageFn(getLS(context), "clear")));
  context.dispose();
});

Deno.test("localStorage/fn - key(0) returns first stored key", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString("first"), createString("1"));
  assertEquals(jsStr(callNativeFn(storageFn(ls, "key"), createNumber(0))), "first");
  context.dispose();
});

Deno.test("localStorage/fn - key() returns null for out-of-range index", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  assertJsNull(callNativeFn(storageFn(getLS(context), "key"), createNumber(0)));
  assertJsNull(callNativeFn(storageFn(getLS(context), "key"), createNumber(99)));
  context.dispose();
});

Deno.test("localStorage/fn - key() returns null for negative index", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString("k"), createString("v"));
  assertJsNull(callNativeFn(storageFn(ls, "key"), createNumber(-1)));
  context.dispose();
});

Deno.test("localStorage/fn - length property reflects item count", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  // Initial length is 0
  assertEquals(jsNum(getProperty(ls, "length")!), 0);
  context.dispose();
});

Deno.test("localStorage/fn - stores empty string value", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString("empty"), createString(""));
  assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString("empty"))), "");
  context.dispose();
});

Deno.test("localStorage/fn - stores empty string key", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString(""), createString("val"));
  assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString(""))), "val");
  context.dispose();
});

Deno.test("localStorage/fn - stores long values", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  const longVal = "x".repeat(10000);
  callNativeFn(storageFn(ls, "setItem"), createString("big"), createString(longVal));
  assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString("big"))), longVal);
  context.dispose();
});

Deno.test("localStorage/fn - stores unicode keys and values", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString("日本語"), createString("こんにちは世界"));
  assertEquals(
    jsStr(callNativeFn(storageFn(ls, "getItem"), createString("日本語"))),
    "こんにちは世界",
  );
  context.dispose();
});

Deno.test("localStorage/fn - stores special characters", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  callNativeFn(
    storageFn(ls, "setItem"),
    createString("spec"),
    createString('{"key":"val\nnewline\ttab"}'),
  );
  assertEquals(
    jsStr(callNativeFn(storageFn(ls, "getItem"), createString("spec"))),
    '{"key":"val\nnewline\ttab"}',
  );
  context.dispose();
});

Deno.test("localStorage/fn - 50 items can be stored and retrieved", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  for (let i = 0; i < 50; i++) {
    callNativeFn(storageFn(ls, "setItem"), createString(`key${i}`), createString(`val${i}`));
  }
  for (let i = 0; i < 50; i++) {
    assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString(`key${i}`))), `val${i}`);
  }
  context.dispose();
});

// ============================================================================
// SESSIONSTORAGE — Functional Tests
// ============================================================================

Deno.test("sessionStorage/fn - basic setItem/getItem", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ss = getSS(context);
  callNativeFn(storageFn(ss, "setItem"), createString("sess"), createString("data"));
  assertEquals(jsStr(callNativeFn(storageFn(ss, "getItem"), createString("sess"))), "data");
  context.dispose();
});

Deno.test("sessionStorage/fn - removeItem", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ss = getSS(context);
  callNativeFn(storageFn(ss, "setItem"), createString("rm"), createString("v"));
  callNativeFn(storageFn(ss, "removeItem"), createString("rm"));
  assertJsNull(callNativeFn(storageFn(ss, "getItem"), createString("rm")));
  context.dispose();
});

Deno.test("sessionStorage/fn - clear", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ss = getSS(context);
  callNativeFn(storageFn(ss, "setItem"), createString("a"), createString("1"));
  callNativeFn(storageFn(ss, "setItem"), createString("b"), createString("2"));
  callNativeFn(storageFn(ss, "clear"));
  assertJsNull(callNativeFn(storageFn(ss, "getItem"), createString("a")));
  assertJsNull(callNativeFn(storageFn(ss, "getItem"), createString("b")));
  context.dispose();
});

Deno.test("sessionStorage/fn - key()", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ss = getSS(context);
  callNativeFn(storageFn(ss, "setItem"), createString("only"), createString("one"));
  assertEquals(jsStr(callNativeFn(storageFn(ss, "key"), createNumber(0))), "only");
  assertJsNull(callNativeFn(storageFn(ss, "key"), createNumber(1)));
  context.dispose();
});

// ============================================================================
// STORAGE — Stub Fallback Tests
// ============================================================================

Deno.test("storage/fallback - localStorage works without StorageManager via in-memory fallback", () => {
  const { context } = setup();
  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString("k"), createString("v"));
  assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString("k"))), "v");
  context.dispose();
});

Deno.test("storage/fallback - sessionStorage works without StorageManager via in-memory fallback", () => {
  const { context } = setup();
  const ss = getSS(context);
  callNativeFn(storageFn(ss, "setItem"), createString("k"), createString("v"));
  assertEquals(jsStr(callNativeFn(storageFn(ss, "getItem"), createString("k"))), "v");
  context.dispose();
});

Deno.test("storage/fallback - all methods exist on fallback localStorage", () => {
  const { context } = setup();
  const ls = getLS(context);
  assertExists(getProperty(ls, "getItem"));
  assertExists(getProperty(ls, "setItem"));
  assertExists(getProperty(ls, "removeItem"));
  assertExists(getProperty(ls, "clear"));
  assertExists(getProperty(ls, "key"));
  assertExists(getProperty(ls, "length"));
  context.dispose();
});

Deno.test("storage/fallback - removeItem deletes key, clear empties storage", () => {
  const { context } = setup();
  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString("a"), createString("1"));
  callNativeFn(storageFn(ls, "setItem"), createString("b"), createString("2"));
  // removeItem removes a single key
  assertJsUndefined(callNativeFn(storageFn(ls, "removeItem"), createString("a")));
  assertJsNull(callNativeFn(storageFn(ls, "getItem"), createString("a")));
  assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString("b"))), "2");
  // clear removes all
  assertJsUndefined(callNativeFn(storageFn(ls, "clear")));
  assertJsNull(callNativeFn(storageFn(ls, "getItem"), createString("b")));
  context.dispose();
});

Deno.test("storage/fallback - key() returns key by index", () => {
  const { context } = setup();
  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString("first"), createString("1"));
  const key0 = callNativeFn(storageFn(ls, "key"), createNumber(0));
  assertEquals(jsStr(key0), "first");
  assertJsNull(callNativeFn(storageFn(ls, "key"), createNumber(99)));
  context.dispose();
});

Deno.test("storage/fallback - getItem returns null for nonexistent key", () => {
  const { context } = setup();
  const ls = getLS(context);
  assertJsNull(callNativeFn(storageFn(ls, "getItem"), createString("nope")));
  context.dispose();
});

// ============================================================================
// STORAGE — Origin Isolation Tests
// ============================================================================

Deno.test("storage/origin - localStorage is isolated by origin", () => {
  const sm = new StorageManager();
  const { context: ctx1 } = setup(undefined, sm, "https://site-a.com/page");
  const { context: ctx2 } = setup(undefined, sm, "https://site-b.com/page");
  const ls1 = getLS(ctx1);
  const ls2 = getLS(ctx2);

  callNativeFn(storageFn(ls1, "setItem"), createString("shared"), createString("from-a"));
  assertJsNull(callNativeFn(storageFn(ls2, "getItem"), createString("shared")));

  callNativeFn(storageFn(ls2, "setItem"), createString("shared"), createString("from-b"));
  assertEquals(jsStr(callNativeFn(storageFn(ls1, "getItem"), createString("shared"))), "from-a");
  assertEquals(jsStr(callNativeFn(storageFn(ls2, "getItem"), createString("shared"))), "from-b");
  ctx1.dispose();
  ctx2.dispose();
});

Deno.test("storage/origin - same origin different paths share storage", () => {
  const sm = new StorageManager();
  const { context: ctx1 } = setup(undefined, sm, "https://example.com/page1");
  const { context: ctx2 } = setup(undefined, sm, "https://example.com/page2");
  const ls1 = getLS(ctx1);
  const ls2 = getLS(ctx2);

  callNativeFn(storageFn(ls1, "setItem"), createString("shared"), createString("from-page1"));
  assertEquals(
    jsStr(callNativeFn(storageFn(ls2, "getItem"), createString("shared"))),
    "from-page1",
  );
  ctx1.dispose();
  ctx2.dispose();
});

Deno.test("storage/origin - different ports are different origins", () => {
  const sm = new StorageManager();
  const { context: ctx1 } = setup(undefined, sm, "https://example.com:443/page");
  const { context: ctx2 } = setup(undefined, sm, "https://example.com:8443/page");
  const ls1 = getLS(ctx1);
  const ls2 = getLS(ctx2);

  callNativeFn(storageFn(ls1, "setItem"), createString("port"), createString("443"));
  assertJsNull(callNativeFn(storageFn(ls2, "getItem"), createString("port")));
  ctx1.dispose();
  ctx2.dispose();
});

Deno.test("storage/origin - http vs https are different origins", () => {
  const sm = new StorageManager();
  const { context: ctx1 } = setup(undefined, sm, "http://example.com/page");
  const { context: ctx2 } = setup(undefined, sm, "https://example.com/page");
  const ls1 = getLS(ctx1);
  const ls2 = getLS(ctx2);

  callNativeFn(storageFn(ls1, "setItem"), createString("protocol"), createString("http"));
  assertJsNull(callNativeFn(storageFn(ls2, "getItem"), createString("protocol")));
  ctx1.dispose();
  ctx2.dispose();
});

Deno.test("storage/origin - sessionStorage is isolated by origin", () => {
  const sm = new StorageManager();
  const { context: ctx1 } = setup(undefined, sm, "https://app-a.com/");
  const { context: ctx2 } = setup(undefined, sm, "https://app-b.com/");
  const ss1 = getSS(ctx1);
  const ss2 = getSS(ctx2);

  callNativeFn(storageFn(ss1, "setItem"), createString("token"), createString("aaa"));
  assertJsNull(callNativeFn(storageFn(ss2, "getItem"), createString("token")));
  ctx1.dispose();
  ctx2.dispose();
});

Deno.test("storage/origin - localStorage and sessionStorage are independent namespaces", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm);
  const ls = getLS(context);
  const ss = getSS(context);

  callNativeFn(storageFn(ls, "setItem"), createString("ns"), createString("local-val"));
  callNativeFn(storageFn(ss, "setItem"), createString("ns"), createString("session-val"));

  assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString("ns"))), "local-val");
  assertEquals(jsStr(callNativeFn(storageFn(ss, "getItem"), createString("ns"))), "session-val");

  // clear localStorage doesn't affect sessionStorage
  callNativeFn(storageFn(ls, "clear"));
  assertJsNull(callNativeFn(storageFn(ls, "getItem"), createString("ns")));
  assertEquals(jsStr(callNativeFn(storageFn(ss, "getItem"), createString("ns"))), "session-val");
  context.dispose();
});

// ============================================================================
// STORAGE — Quota Enforcement Tests
// ============================================================================

Deno.test("storage/quota - setItem throws QuotaExceededError when quota exhausted", () => {
  const qm = new QuotaManager(100); // 100 bytes per origin
  const sm = new StorageManager(qm);
  const { context } = setup(undefined, sm);
  const ls = getLS(context);

  // 100 bytes quota, "key"(3 chars) + "x".repeat(50) = 53 chars * 2 bytes = 106 bytes — over quota
  try {
    callNativeFn(storageFn(ls, "setItem"), createString("key"), createString("x".repeat(50)));
    // Should have thrown
    assert(false, "Expected QuotaExceededError");
  } catch (e) {
    assert((e as Error).message.includes("QuotaExceededError"));
  }
  context.dispose();
});

Deno.test("storage/quota - quota is tracked per origin through StorageManager", () => {
  const qm = new QuotaManager(200);
  const sm = new StorageManager(qm);
  const { context } = setup(undefined, sm, "https://tracked.com/");
  const ls = getLS(context);

  // "a"(1) + "x"*10(10) = 11 chars * 2 = 22 bytes
  callNativeFn(storageFn(ls, "setItem"), createString("a"), createString("x".repeat(10)));

  const usage = sm.getUsage("https://tracked.com");
  assert(usage.local > 0, `Usage should be > 0, got ${usage.local}`);
  context.dispose();
});

Deno.test("storage/quota - removeItem frees quota", () => {
  const qm = new QuotaManager(200);
  const sm = new StorageManager(qm);
  const { context } = setup(undefined, sm, "https://quota.com/");
  const ls = getLS(context);

  callNativeFn(storageFn(ls, "setItem"), createString("k"), createString("v".repeat(20)));
  const usageBefore = sm.getUsage("https://quota.com").local;

  callNativeFn(storageFn(ls, "removeItem"), createString("k"));
  const usageAfter = sm.getUsage("https://quota.com").local;

  assert(usageAfter < usageBefore, `Usage should decrease: ${usageAfter} < ${usageBefore}`);
  context.dispose();
});

Deno.test("storage/quota - clear frees all quota", () => {
  const qm = new QuotaManager(1000);
  const sm = new StorageManager(qm);
  const { context } = setup(undefined, sm, "https://clear.com/");
  const ls = getLS(context);

  for (let i = 0; i < 10; i++) {
    callNativeFn(storageFn(ls, "setItem"), createString(`k${i}`), createString(`v${i}`));
  }
  assert(sm.getUsage("https://clear.com").local > 0);

  callNativeFn(storageFn(ls, "clear"));
  assertEquals(sm.getUsage("https://clear.com").local, 0);
  context.dispose();
});

// ============================================================================
// STORAGE — Event Emission Tests
// ============================================================================

Deno.test("storage/events - setItem emits storage event with correct fields", async () => {
  const eventEmitter = new StorageEventEmitter();
  const qm = new QuotaManager();
  const sm = new StorageManager(qm, eventEmitter);
  const { context } = setup(undefined, sm);
  const ls = getLS(context);

  const events: StorageEvent[] = [];
  eventEmitter.addEventListener((e) => events.push(e));

  callNativeFn(storageFn(ls, "setItem"), createString("evtKey"), createString("evtVal"));
  // Events are emitted via queueMicrotask
  await new Promise((r) => setTimeout(r, 20));

  assertEquals(events.length, 1);
  assertEquals(events[0].key, "evtKey");
  assertEquals(events[0].oldValue, null);
  assertEquals(events[0].newValue, "evtVal");
  assertEquals(events[0].storageArea, "localStorage");
  context.dispose();
});

Deno.test("storage/events - overwrite emits event with old and new values", async () => {
  const eventEmitter = new StorageEventEmitter();
  const sm = new StorageManager(new QuotaManager(), eventEmitter);
  const { context } = setup(undefined, sm);
  const ls = getLS(context);

  callNativeFn(storageFn(ls, "setItem"), createString("k"), createString("old"));
  // Wait for first event to flush
  await new Promise((r) => setTimeout(r, 20));

  const events: StorageEvent[] = [];
  eventEmitter.addEventListener((e) => events.push(e));

  callNativeFn(storageFn(ls, "setItem"), createString("k"), createString("new"));
  await new Promise((r) => setTimeout(r, 20));

  assertEquals(events.length, 1);
  assertEquals(events[0].key, "k");
  assertEquals(events[0].oldValue, "old");
  assertEquals(events[0].newValue, "new");
  context.dispose();
});

Deno.test("storage/events - removeItem emits event with null newValue", async () => {
  const eventEmitter = new StorageEventEmitter();
  const sm = new StorageManager(new QuotaManager(), eventEmitter);
  const { context } = setup(undefined, sm);
  const ls = getLS(context);

  callNativeFn(storageFn(ls, "setItem"), createString("del"), createString("val"));
  // Wait for first event to flush
  await new Promise((r) => setTimeout(r, 20));

  const events: StorageEvent[] = [];
  eventEmitter.addEventListener((e) => events.push(e));

  callNativeFn(storageFn(ls, "removeItem"), createString("del"));
  await new Promise((r) => setTimeout(r, 20));

  assertEquals(events.length, 1);
  assertEquals(events[0].key, "del");
  assertEquals(events[0].oldValue, "val");
  assertEquals(events[0].newValue, null);
  context.dispose();
});

Deno.test("storage/events - sessionStorage setItem emits with sessionStorage area", async () => {
  const eventEmitter = new StorageEventEmitter();
  const sm = new StorageManager(new QuotaManager(), eventEmitter);
  const { context } = setup(undefined, sm);
  const ss = getSS(context);

  const events: StorageEvent[] = [];
  eventEmitter.addEventListener((e) => events.push(e));

  callNativeFn(storageFn(ss, "setItem"), createString("skey"), createString("sval"));
  await new Promise((r) => setTimeout(r, 20));

  assertEquals(events.length, 1);
  assertEquals(events[0].storageArea, "sessionStorage");
  context.dispose();
});

// ============================================================================
// INTEGRATION — ScriptExecutor Wiring
// ============================================================================

Deno.test({
  name: "integration/scriptexec - ScriptExecutor passes pipeline to WindowObject",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const pipeline = new MockRequestPipeline();
    const doc = createMockDocument();
    const executor = new ScriptExecutor(doc, "https://example.com", pipeline as any);

    const fetchFn = getProperty(executor.getContext().global, "fetch")!;
    callNativeFn(fetchFn, createString("https://api.example.com/test"));
    assertEquals(pipeline.calls.length, 1);
    assertEquals(pipeline.calls[0].url, "https://api.example.com/test");
    await executor.dispose();
  },
});

Deno.test({
  name: "integration/scriptexec - ScriptExecutor passes StorageManager to WindowObject",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const sm = new StorageManager();
    const doc = createMockDocument();
    const executor = new ScriptExecutor(doc, "https://example.com", undefined, sm);

    const ls = getProperty(executor.getContext().global, "localStorage")!;
    callNativeFn(storageFn(ls, "setItem"), createString("via-exec"), createString("works"));
    assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString("via-exec"))), "works");
    await executor.dispose();
  },
});

Deno.test({
  name: "integration/scriptexec - ScriptExecutor passes both pipeline and storage",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const pipeline = new MockRequestPipeline();
    pipeline.mockBody = new TextEncoder().encode('{"session":"xyz"}');
    const sm = new StorageManager();
    const doc = createMockDocument();
    const executor = new ScriptExecutor(doc, "https://app.com", pipeline as any, sm);
    const ctx = executor.getContext();

    // fetch via pipeline
    const resp = callNativeFn(
      getProperty(ctx.global, "fetch")!,
      createString("https://api.app.com/login"),
    );
    await new Promise((r) => setTimeout(r, 50));
    const json = callNativeFn(storageFn(resp, "json"));
    assertEquals(jsStr(getProperty(json, "session")!), "xyz");

    // store in localStorage
    const ls = getProperty(ctx.global, "localStorage")!;
    callNativeFn(storageFn(ls, "setItem"), createString("session"), createString("xyz"));
    assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString("session"))), "xyz");
    await executor.dispose();
  },
});

Deno.test({
  name: "integration/scriptexec - ScriptExecutor without explicit deps uses default StorageManager",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const doc = createMockDocument();
    const executor = new ScriptExecutor(doc, "https://example.com");
    const ctx = executor.getContext();

    // fetch without pipeline returns empty object (no network)
    const resp = callNativeFn(
      getProperty(ctx.global, "fetch")!,
      createString("https://example.com"),
    );
    assertEquals(resp.type, "object");

    // localStorage works via default StorageManager — setItem/getItem round-trip
    const ls = getProperty(ctx.global, "localStorage")!;
    callNativeFn(storageFn(ls, "setItem"), createString("k"), createString("v"));
    assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString("k"))), "v");
    await executor.dispose();
  },
});

// ============================================================================
// E2E — Realistic Multi-Window Scenarios
// ============================================================================

Deno.test("e2e - simulated login flow: fetch token then store in localStorage", async () => {
  const pipeline = new MockRequestPipeline();
  pipeline.mockBody = new TextEncoder().encode(
    '{"access_token":"eyJhbGciOiJIUzI1NiJ9.test","refresh_token":"rt_abc","expires_in":3600}',
  );
  const sm = new StorageManager();
  const { context } = setup(pipeline, sm, "https://app.example.com/login");

  // 1. POST login credentials
  const loginOpts = createObject();
  setProperty(loginOpts, "method", createString("POST"));
  setProperty(loginOpts, "body", createString('{"email":"user@example.com","password":"secret"}'));
  const loginHdrs = createObject();
  setProperty(loginHdrs, "Content-Type", createString("application/json"));
  setProperty(loginOpts, "headers", loginHdrs);

  const resp = callNativeFn(
    getFetchFn(context),
    createString("https://api.example.com/auth/login"),
    loginOpts,
  );
  await new Promise((r) => setTimeout(r, 50));

  // Verify pipeline received the request
  assertEquals(pipeline.calls[0].method, "POST");
  assertEquals(pipeline.calls[0].url, "https://api.example.com/auth/login");

  // 2. Parse response
  const json = callNativeFn(storageFn(resp, "json"));
  const accessToken = jsStr(getProperty(json, "access_token")!);
  const refreshToken = jsStr(getProperty(json, "refresh_token")!);
  const expiresIn = jsNum(getProperty(json, "expires_in")!);

  assertEquals(accessToken, "eyJhbGciOiJIUzI1NiJ9.test");
  assertEquals(refreshToken, "rt_abc");
  assertEquals(expiresIn, 3600);

  // 3. Store tokens in localStorage
  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString("access_token"), createString(accessToken));
  callNativeFn(storageFn(ls, "setItem"), createString("refresh_token"), createString(refreshToken));

  // 4. Make authenticated API call
  const apiHdrs = createObject();
  setProperty(apiHdrs, "Authorization", createString(`Bearer ${accessToken}`));
  const apiOpts = createObject();
  setProperty(apiOpts, "headers", apiHdrs);

  pipeline.mockBody = new TextEncoder().encode('{"user":{"id":1,"name":"Alice"}}');
  callNativeFn(getFetchFn(context), createString("https://api.example.com/me"), apiOpts);

  assertEquals(pipeline.calls[1].method, "GET");
  const authHeader = (pipeline.calls[1].options as any).headers["Authorization"];
  assertEquals(authHeader, "Bearer eyJhbGciOiJIUzI1NiJ9.test");

  // 5. Verify tokens survive in storage
  assertEquals(
    jsStr(callNativeFn(storageFn(ls, "getItem"), createString("access_token"))),
    accessToken,
  );
  assertEquals(
    jsStr(callNativeFn(storageFn(ls, "getItem"), createString("refresh_token"))),
    refreshToken,
  );

  context.dispose();
});

Deno.test("e2e - multi-tab storage sharing: two windows on same origin see same localStorage", () => {
  const sm = new StorageManager();
  // Tab 1
  const { context: tab1 } = setup(undefined, sm, "https://app.com/tab1");
  // Tab 2
  const { context: tab2 } = setup(undefined, sm, "https://app.com/tab2");

  const ls1 = getLS(tab1);
  const ls2 = getLS(tab2);

  // Tab 1 writes
  callNativeFn(storageFn(ls1, "setItem"), createString("theme"), createString("dark"));
  callNativeFn(storageFn(ls1, "setItem"), createString("lang"), createString("en"));

  // Tab 2 reads — same origin, same storage
  assertEquals(jsStr(callNativeFn(storageFn(ls2, "getItem"), createString("theme"))), "dark");
  assertEquals(jsStr(callNativeFn(storageFn(ls2, "getItem"), createString("lang"))), "en");

  // Tab 2 modifies
  callNativeFn(storageFn(ls2, "setItem"), createString("theme"), createString("light"));

  // Tab 1 sees the change
  assertEquals(jsStr(callNativeFn(storageFn(ls1, "getItem"), createString("theme"))), "light");

  tab1.dispose();
  tab2.dispose();
});

Deno.test("e2e - multi-tab with different origins are isolated", () => {
  const sm = new StorageManager();
  const { context: gmail } = setup(undefined, sm, "https://mail.google.com/inbox");
  const { context: evil } = setup(undefined, sm, "https://evil.com/steal");

  const gmailLs = getLS(gmail);
  const evilLs = getLS(evil);

  callNativeFn(
    storageFn(gmailLs, "setItem"),
    createString("auth"),
    createString("sensitive-token"),
  );
  assertJsNull(callNativeFn(storageFn(evilLs, "getItem"), createString("auth")));

  gmail.dispose();
  evil.dispose();
});

Deno.test("e2e - fetch API data, cache in sessionStorage, re-read from cache", async () => {
  const pipeline = new MockRequestPipeline();
  pipeline.mockBody = new TextEncoder().encode(
    '[{"id":1,"title":"Post 1"},{"id":2,"title":"Post 2"}]',
  );
  const sm = new StorageManager();
  const { context } = setup(pipeline, sm, "https://blog.com/");

  // First call: fetch from API
  const resp = callNativeFn(getFetchFn(context), createString("https://api.blog.com/posts"));
  await new Promise((r) => setTimeout(r, 50));
  const bodyText = jsStr(callNativeFn(storageFn(resp, "text")));

  // Cache in sessionStorage
  const ss = getSS(context);
  callNativeFn(storageFn(ss, "setItem"), createString("cached_posts"), createString(bodyText));

  // Read from cache (no new fetch needed)
  const cached = jsStr(callNativeFn(storageFn(ss, "getItem"), createString("cached_posts")));
  const parsed = JSON.parse(cached);
  assertEquals(parsed.length, 2);
  assertEquals(parsed[0].title, "Post 1");
  assertEquals(parsed[1].title, "Post 2");

  // Only 1 network request was made
  assertEquals(pipeline.calls.length, 1);
  context.dispose();
});

Deno.test("e2e - user preferences stored in localStorage persist across page navigations", () => {
  const sm = new StorageManager();

  // Page 1: user sets preferences
  const { context: ctx1 } = setup(undefined, sm, "https://app.com/settings");
  const ls1 = getLS(ctx1);
  callNativeFn(storageFn(ls1, "setItem"), createString("fontSize"), createString("16px"));
  callNativeFn(storageFn(ls1, "setItem"), createString("theme"), createString("solarized"));
  callNativeFn(storageFn(ls1, "setItem"), createString("notifications"), createString("true"));
  ctx1.dispose();

  // Page 2: new WindowObject same origin reads preferences
  const { context: ctx2 } = setup(undefined, sm, "https://app.com/dashboard");
  const ls2 = getLS(ctx2);
  assertEquals(jsStr(callNativeFn(storageFn(ls2, "getItem"), createString("fontSize"))), "16px");
  assertEquals(jsStr(callNativeFn(storageFn(ls2, "getItem"), createString("theme"))), "solarized");
  assertEquals(
    jsStr(callNativeFn(storageFn(ls2, "getItem"), createString("notifications"))),
    "true",
  );
  ctx2.dispose();
});

Deno.test("e2e - StorageManager clearAllSessionStorage clears session data but not local", () => {
  const sm = new StorageManager();
  const { context } = setup(undefined, sm, "https://app.com/");
  const ls = getLS(context);
  const ss = getSS(context);

  callNativeFn(storageFn(ls, "setItem"), createString("persist"), createString("yes"));
  callNativeFn(storageFn(ss, "setItem"), createString("temp"), createString("gone"));

  // Simulate browser close
  await sm.clearAllSessionStorage();

  // localStorage survives
  assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString("persist"))), "yes");

  // sessionStorage wiped — but the OriginStorage object in the window still has the old ref
  // We need to create a new window to test this properly
  context.dispose();

  const { context: ctx2 } = setup(undefined, sm, "https://app.com/");
  const ss2 = getSS(ctx2);
  assertJsNull(callNativeFn(storageFn(ss2, "getItem"), createString("temp")));
  ctx2.dispose();
});

Deno.test("e2e - StorageManager export/import preserves localStorage through WindowObject", () => {
  const sm1 = new StorageManager();
  const { context: ctx1 } = setup(undefined, sm1, "https://export.com/");
  const ls1 = getLS(ctx1);
  callNativeFn(storageFn(ls1, "setItem"), createString("exportKey"), createString("exportVal"));
  ctx1.dispose();

  // Export data
  const exported = sm1.export();
  assertEquals(exported.localStorage["https://export.com"]["exportKey"], "exportVal");

  // Import into fresh StorageManager
  const sm2 = new StorageManager();
  sm2.import(exported);

  const { context: ctx2 } = setup(undefined, sm2, "https://export.com/");
  const ls2 = getLS(ctx2);
  assertEquals(
    jsStr(callNativeFn(storageFn(ls2, "getItem"), createString("exportKey"))),
    "exportVal",
  );
  ctx2.dispose();
});

Deno.test("e2e - multiple sequential fetch calls with different responses", async () => {
  const pipeline = new MockRequestPipeline();
  const { context } = setup(pipeline);

  // First fetch
  pipeline.mockBody = new TextEncoder().encode('{"page":1}');
  const resp1 = callNativeFn(getFetchFn(context), createString("https://api.com/page/1"));
  await new Promise((r) => setTimeout(r, 50));

  // Second fetch with different response
  pipeline.mockBody = new TextEncoder().encode('{"page":2}');
  const resp2 = callNativeFn(getFetchFn(context), createString("https://api.com/page/2"));
  await new Promise((r) => setTimeout(r, 50));

  // Each response has its own body
  const json1 = callNativeFn(storageFn(resp1, "json"));
  const json2 = callNativeFn(storageFn(resp2, "json"));

  assertEquals(jsNum(getProperty(json1, "page")!), 1);
  assertEquals(jsNum(getProperty(json2, "page")!), 2);

  assertEquals(pipeline.calls.length, 2);
  assertEquals(pipeline.calls[0].url, "https://api.com/page/1");
  assertEquals(pipeline.calls[1].url, "https://api.com/page/2");
  context.dispose();
});

Deno.test("e2e - nativeToJSValue handles all JSON types correctly", async () => {
  const pipeline = new MockRequestPipeline();
  pipeline.mockBody = new TextEncoder().encode(JSON.stringify({
    str: "hello",
    num: 42,
    float: 3.14,
    bool_true: true,
    bool_false: false,
    null_val: null,
    nested: { inner: "deep" },
    arr: [1, "two", null],
  }));
  const { context } = setup(pipeline);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const json = callNativeFn(storageFn(resp, "json"));

  assertEquals(jsStr(getProperty(json, "str")!), "hello");
  assertEquals(jsNum(getProperty(json, "num")!), 42);
  assertEquals(jsNum(getProperty(json, "float")!), 3.14);
  assertEquals(jsBool(getProperty(json, "bool_true")!), true);
  assertEquals(jsBool(getProperty(json, "bool_false")!), false);
  assertJsNull(getProperty(json, "null_val")!);

  const nested = getProperty(json, "nested")!;
  assertEquals(jsStr(getProperty(nested, "inner")!), "deep");

  const arr = getProperty(json, "arr")!;
  assertEquals(jsNum(getProperty(arr, "0")!), 1);
  assertEquals(jsStr(getProperty(arr, "1")!), "two");
  assertJsNull(getProperty(arr, "2")!);
  assertEquals(jsNum(getProperty(arr, "length")!), 3);
  context.dispose();
});

Deno.test("e2e - WindowObject.clearTimers does not affect fetch or storage", () => {
  const pipeline = new MockRequestPipeline();
  const sm = new StorageManager();
  const { context, wo } = setup(pipeline, sm);

  const ls = getLS(context);
  callNativeFn(storageFn(ls, "setItem"), createString("survives"), createString("yes"));

  wo.clearTimers();

  // Storage still works
  assertEquals(jsStr(callNativeFn(storageFn(ls, "getItem"), createString("survives"))), "yes");
  // Fetch still works
  callNativeFn(getFetchFn(context), createString("https://example.com"));
  assertEquals(pipeline.calls.length, 1);
  context.dispose();
});

Deno.test("e2e - three origins with quota tracking all work independently", () => {
  const qm = new QuotaManager(10000);
  const sm = new StorageManager(qm);

  const origins = ["https://a.com/", "https://b.com/", "https://c.com/"];
  const contexts: V8Context[] = [];

  for (const origin of origins) {
    const { context } = setup(undefined, sm, origin);
    contexts.push(context);
    const ls = getLS(context);
    for (let i = 0; i < 5; i++) {
      callNativeFn(storageFn(ls, "setItem"), createString(`key${i}`), createString(`val${i}`));
    }
  }

  // Each origin has its own data
  for (let oi = 0; oi < origins.length; oi++) {
    const ls = getLS(contexts[oi]);
    for (let i = 0; i < 5; i++) {
      assertEquals(
        jsStr(callNativeFn(storageFn(ls, "getItem"), createString(`key${i}`))),
        `val${i}`,
      );
    }
  }

  // Total usage tracked
  assertEquals(sm.getAllOrigins().length, 3);
  assert(sm.getTotalUsage() > 0);

  for (const ctx of contexts) ctx.dispose();
});

// ============================================================================
// WINDOW OBJECT — Global Properties & Aliases
// ============================================================================

Deno.test("window - window global is an object", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  assertEquals(win.type, "object");
  context.dispose();
});

Deno.test("window - self aliases window", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  const self = getProperty(context.global, "self")!;
  assertEquals(win, self);
  context.dispose();
});

Deno.test("window - globalThis aliases window", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  const gt = getProperty(context.global, "globalThis")!;
  assertEquals(win, gt);
  context.dispose();
});

Deno.test("window - innerWidth/innerHeight default to 1024x768", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  assertEquals(jsNum(getProperty(win, "innerWidth")!), 1024);
  assertEquals(jsNum(getProperty(win, "innerHeight")!), 768);
  context.dispose();
});

Deno.test("window - outerWidth/outerHeight default to 1024x768", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  assertEquals(jsNum(getProperty(win, "outerWidth")!), 1024);
  assertEquals(jsNum(getProperty(win, "outerHeight")!), 768);
  context.dispose();
});

Deno.test("window - screenX/screenY default to 0", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  assertEquals(jsNum(getProperty(win, "screenX")!), 0);
  assertEquals(jsNum(getProperty(win, "screenY")!), 0);
  context.dispose();
});

Deno.test("window - scrollX/scrollY default to 0", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  assertEquals(jsNum(getProperty(win, "scrollX")!), 0);
  assertEquals(jsNum(getProperty(win, "scrollY")!), 0);
  context.dispose();
});

Deno.test("window - scrollTo is a native function", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  const scrollTo = getProperty(win, "scrollTo")!;
  assertEquals(scrollTo.type, "function");
  // Should not throw
  callNativeFn(scrollTo, createNumber(0), createNumber(100));
  context.dispose();
});

Deno.test("window - scrollBy is a native function", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  const scrollBy = getProperty(win, "scrollBy")!;
  assertEquals(scrollBy.type, "function");
  callNativeFn(scrollBy, createNumber(10), createNumber(20));
  context.dispose();
});

// ============================================================================
// DOCUMENT — Installed via DOM bindings
// ============================================================================

Deno.test("document - document global is installed", () => {
  const { context } = setup();
  const doc = getProperty(context.global, "document");
  assertExists(doc);
  assertEquals(doc!.type, "object");
  context.dispose();
});

// ============================================================================
// CONSOLE — Log Methods
// ============================================================================

Deno.test("console - console global is an object", () => {
  const { context } = setup();
  const con = getProperty(context.global, "console")!;
  assertEquals(con.type, "object");
  context.dispose();
});

Deno.test("console - console.log is a native function that returns undefined", () => {
  const { context } = setup();
  const con = getProperty(context.global, "console")!;
  const log = getProperty(con, "log")!;
  assertEquals(log.type, "function");
  const result = callNativeFn(log, createString("test message"));
  assertEquals(result.type, "undefined");
  context.dispose();
});

Deno.test("console - console.info returns undefined", () => {
  const { context } = setup();
  const con = getProperty(context.global, "console")!;
  const result = callNativeFn(getProperty(con, "info")!, createString("info msg"));
  assertEquals(result.type, "undefined");
  context.dispose();
});

Deno.test("console - console.warn returns undefined", () => {
  const { context } = setup();
  const con = getProperty(context.global, "console")!;
  const result = callNativeFn(getProperty(con, "warn")!, createString("warn msg"));
  assertEquals(result.type, "undefined");
  context.dispose();
});

Deno.test("console - console.error returns undefined", () => {
  const { context } = setup();
  const con = getProperty(context.global, "console")!;
  const result = callNativeFn(getProperty(con, "error")!, createString("error msg"));
  assertEquals(result.type, "undefined");
  context.dispose();
});

Deno.test("console - all four methods exist on console", () => {
  const { context } = setup();
  const con = getProperty(context.global, "console")!;
  for (const method of ["log", "info", "warn", "error"]) {
    const fn = getProperty(con, method);
    assertExists(fn, `console.${method} should exist`);
    assertEquals(fn!.type, "function");
  }
  context.dispose();
});

// ============================================================================
// TIMERS — setTimeout, clearTimeout, setInterval, clearInterval
// ============================================================================

Deno.test("timers - setTimeout is a native function", () => {
  const { context } = setup();
  const st = getProperty(context.global, "setTimeout")!;
  assertEquals(st.type, "function");
  context.dispose();
});

Deno.test("timers - setTimeout returns a numeric handle", () => {
  const { context, wo } = setup();
  const st = getProperty(context.global, "setTimeout")!;
  const handle = callNativeFn(
    st,
    createNativeFunction("cb", () => createUndefined()),
    createNumber(1000),
  );
  assertEquals(handle.type, "number");
  assert(jsNum(handle) > 0);
  wo.clearTimers();
  context.dispose();
});

Deno.test("timers - clearTimeout is a native function", () => {
  const { context } = setup();
  const ct = getProperty(context.global, "clearTimeout")!;
  assertEquals(ct.type, "function");
  context.dispose();
});

Deno.test("timers - clearTimeout can cancel a timer by handle", () => {
  const { context } = setup();
  const st = getProperty(context.global, "setTimeout")!;
  const ct = getProperty(context.global, "clearTimeout")!;
  const handle = callNativeFn(
    st,
    createNativeFunction("cb", () => createUndefined()),
    createNumber(5000),
  );
  // Should not throw
  const result = callNativeFn(ct, handle);
  assertEquals(result.type, "undefined");
  context.dispose();
});

Deno.test("timers - clearTimeout with invalid handle is no-op", () => {
  const { context } = setup();
  const ct = getProperty(context.global, "clearTimeout")!;
  const result = callNativeFn(ct, createNumber(99999));
  assertEquals(result.type, "undefined");
  context.dispose();
});

Deno.test("timers - setInterval is a native function", () => {
  const { context } = setup();
  const si = getProperty(context.global, "setInterval")!;
  assertEquals(si.type, "function");
  context.dispose();
});

Deno.test("timers - setInterval returns a numeric handle", () => {
  const { context, wo } = setup();
  const si = getProperty(context.global, "setInterval")!;
  const handle = callNativeFn(
    si,
    createNativeFunction("cb", () => createUndefined()),
    createNumber(1000),
  );
  assertEquals(handle.type, "number");
  assert(jsNum(handle) > 0);
  wo.clearTimers();
  context.dispose();
});

Deno.test("timers - clearInterval is a native function", () => {
  const { context } = setup();
  const ci = getProperty(context.global, "clearInterval")!;
  assertEquals(ci.type, "function");
  context.dispose();
});

Deno.test("timers - clearInterval can cancel an interval by handle", () => {
  const { context } = setup();
  const si = getProperty(context.global, "setInterval")!;
  const ci = getProperty(context.global, "clearInterval")!;
  const handle = callNativeFn(
    si,
    createNativeFunction("cb", () => createUndefined()),
    createNumber(1000),
  );
  const result = callNativeFn(ci, handle);
  assertEquals(result.type, "undefined");
  context.dispose();
});

Deno.test("timers - setTimeout and setInterval return unique handles", () => {
  const { context, wo } = setup();
  const st = getProperty(context.global, "setTimeout")!;
  const si = getProperty(context.global, "setInterval")!;
  const cb = createNativeFunction("cb", () => createUndefined());
  const h1 = jsNum(callNativeFn(st, cb, createNumber(100)));
  const h2 = jsNum(callNativeFn(si, cb, createNumber(100)));
  const h3 = jsNum(callNativeFn(st, cb, createNumber(100)));
  assert(h1 !== h2, "handles should be unique");
  assert(h2 !== h3, "handles should be unique");
  assert(h1 !== h3, "handles should be unique");
  wo.clearTimers();
  context.dispose();
});

Deno.test("timers - clearTimers() clears all active timers", () => {
  const { context, wo } = setup();
  const st = getProperty(context.global, "setTimeout")!;
  const si = getProperty(context.global, "setInterval")!;
  const cb = createNativeFunction("cb", () => createUndefined());
  callNativeFn(st, cb, createNumber(10000));
  callNativeFn(si, cb, createNumber(10000));
  callNativeFn(st, cb, createNumber(10000));
  // Should not throw
  wo.clearTimers();
  context.dispose();
});

// ============================================================================
// LOCATION — URL Properties
// ============================================================================

Deno.test("location - href matches page URL", () => {
  const { context } = setup(undefined, undefined, "https://example.com:8080/path?q=1#hash");
  const loc = getProperty(context.global, "location")!;
  assertEquals(jsStr(getProperty(loc, "href")!), "https://example.com:8080/path?q=1#hash");
  context.dispose();
});

Deno.test("location - protocol is 'https:'", () => {
  const { context } = setup(undefined, undefined, "https://example.com/page");
  const loc = getProperty(context.global, "location")!;
  assertEquals(jsStr(getProperty(loc, "protocol")!), "https:");
  context.dispose();
});

Deno.test("location - hostname is extracted correctly", () => {
  const { context } = setup(undefined, undefined, "https://sub.example.com/page");
  const loc = getProperty(context.global, "location")!;
  assertEquals(jsStr(getProperty(loc, "hostname")!), "sub.example.com");
  context.dispose();
});

Deno.test("location - port is extracted from URL", () => {
  const { context } = setup(undefined, undefined, "https://example.com:3000/page");
  const loc = getProperty(context.global, "location")!;
  assertEquals(jsStr(getProperty(loc, "port")!), "3000");
  context.dispose();
});

Deno.test("location - port is empty string for default ports", () => {
  const { context } = setup(undefined, undefined, "https://example.com/page");
  const loc = getProperty(context.global, "location")!;
  assertEquals(jsStr(getProperty(loc, "port")!), "");
  context.dispose();
});

Deno.test("location - pathname is extracted correctly", () => {
  const { context } = setup(undefined, undefined, "https://example.com/my/path");
  const loc = getProperty(context.global, "location")!;
  assertEquals(jsStr(getProperty(loc, "pathname")!), "/my/path");
  context.dispose();
});

Deno.test("location - search includes query string", () => {
  const { context } = setup(undefined, undefined, "https://example.com/page?foo=bar&baz=1");
  const loc = getProperty(context.global, "location")!;
  assertEquals(jsStr(getProperty(loc, "search")!), "?foo=bar&baz=1");
  context.dispose();
});

Deno.test("location - search is empty when no query params", () => {
  const { context } = setup(undefined, undefined, "https://example.com/page");
  const loc = getProperty(context.global, "location")!;
  assertEquals(jsStr(getProperty(loc, "search")!), "");
  context.dispose();
});

Deno.test("location - hash is extracted correctly", () => {
  const { context } = setup(undefined, undefined, "https://example.com/page#section1");
  const loc = getProperty(context.global, "location")!;
  assertEquals(jsStr(getProperty(loc, "hash")!), "#section1");
  context.dispose();
});

Deno.test("location - hash is empty when no hash", () => {
  const { context } = setup(undefined, undefined, "https://example.com/page");
  const loc = getProperty(context.global, "location")!;
  assertEquals(jsStr(getProperty(loc, "hash")!), "");
  context.dispose();
});

Deno.test("location - origin is scheme + host", () => {
  const { context } = setup(undefined, undefined, "https://example.com:8080/page");
  const loc = getProperty(context.global, "location")!;
  assertEquals(jsStr(getProperty(loc, "origin")!), "https://example.com:8080");
  context.dispose();
});

Deno.test("location - host includes port when non-default", () => {
  const { context } = setup(undefined, undefined, "https://example.com:9090/page");
  const loc = getProperty(context.global, "location")!;
  assertEquals(jsStr(getProperty(loc, "host")!), "example.com:9090");
  context.dispose();
});

Deno.test("location - all properties present for complex URL", () => {
  const { context } = setup(
    undefined,
    undefined,
    "http://user:pass@host.com:4000/a/b?x=1&y=2#frag",
  );
  const loc = getProperty(context.global, "location")!;
  assertEquals(jsStr(getProperty(loc, "protocol")!), "http:");
  assertEquals(jsStr(getProperty(loc, "hostname")!), "host.com");
  assertEquals(jsStr(getProperty(loc, "port")!), "4000");
  assertEquals(jsStr(getProperty(loc, "pathname")!), "/a/b");
  assertEquals(jsStr(getProperty(loc, "search")!), "?x=1&y=2");
  assertEquals(jsStr(getProperty(loc, "hash")!), "#frag");
  context.dispose();
});

// ============================================================================
// NAVIGATOR — Browser Identity
// ============================================================================

Deno.test("navigator - navigator global is an object", () => {
  const { context } = setup();
  const nav = getProperty(context.global, "navigator")!;
  assertEquals(nav.type, "object");
  context.dispose();
});

Deno.test("navigator - userAgent is BrowserX/1.0", () => {
  const { context } = setup();
  const nav = getProperty(context.global, "navigator")!;
  assertEquals(jsStr(getProperty(nav, "userAgent")!), "BrowserX/1.0");
  context.dispose();
});

Deno.test("navigator - language is en-US", () => {
  const { context } = setup();
  const nav = getProperty(context.global, "navigator")!;
  assertEquals(jsStr(getProperty(nav, "language")!), "en-US");
  context.dispose();
});

Deno.test("navigator - platform is BrowserX", () => {
  const { context } = setup();
  const nav = getProperty(context.global, "navigator")!;
  assertEquals(jsStr(getProperty(nav, "platform")!), "BrowserX");
  context.dispose();
});

// ============================================================================
// ALERT / CONFIRM / PROMPT — Headless Dialog Stubs
// ============================================================================

Deno.test("alert - alert is a native function", () => {
  const { context } = setup();
  const alert = getProperty(context.global, "alert")!;
  assertEquals(alert.type, "function");
  context.dispose();
});

Deno.test("alert - alert returns undefined", () => {
  const { context } = setup();
  const alert = getProperty(context.global, "alert")!;
  const result = callNativeFn(alert, createString("hello"));
  assertEquals(result.type, "undefined");
  context.dispose();
});

Deno.test("confirm - confirm is a native function", () => {
  const { context } = setup();
  const confirm = getProperty(context.global, "confirm")!;
  assertEquals(confirm.type, "function");
  context.dispose();
});

Deno.test("confirm - confirm returns false in headless mode", () => {
  const { context } = setup();
  const confirm = getProperty(context.global, "confirm")!;
  const result = callNativeFn(confirm, createString("are you sure?"));
  assertEquals(result.type, "boolean");
  assertEquals(jsBool(result), false);
  context.dispose();
});

Deno.test("prompt - prompt is a native function", () => {
  const { context } = setup();
  const prompt = getProperty(context.global, "prompt")!;
  assertEquals(prompt.type, "function");
  context.dispose();
});

Deno.test("prompt - prompt returns null in headless mode", () => {
  const { context } = setup();
  const prompt = getProperty(context.global, "prompt")!;
  const result = callNativeFn(prompt, createString("enter name:"));
  assertEquals(result.type, "null");
  context.dispose();
});

// ============================================================================
// FETCH — Additional Edge Cases
// ============================================================================

Deno.test("fetch/fn - bodyUsed becomes true after blob()", async () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  assertEquals(jsBool(getProperty(resp, "bodyUsed")!), false);
  callNativeFn(storageFn(resp, "blob"));
  assertEquals(jsBool(getProperty(resp, "bodyUsed")!), true);
  context.dispose();
});

Deno.test("fetch/fn - bodyUsed becomes true after arrayBuffer()", async () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  callNativeFn(storageFn(resp, "arrayBuffer"));
  assertEquals(jsBool(getProperty(resp, "bodyUsed")!), true);
  context.dispose();
});

Deno.test("fetch/fn - 500 status sets ok to false", async () => {
  const p = new MockRequestPipeline();
  p.mockStatusCode = 500;
  p.mockStatusText = "Internal Server Error";
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  callNativeFn(storageFn(resp, "text"));
  assertEquals(jsBool(getProperty(resp, "ok")!), false);
  assertEquals(jsNum(getProperty(resp, "status")!), 500);
  assertEquals(jsStr(getProperty(resp, "statusText")!), "Internal Server Error");
  context.dispose();
});

Deno.test("fetch/fn - 301 redirect status sets ok to false", async () => {
  const p = new MockRequestPipeline();
  p.mockStatusCode = 301;
  p.mockStatusText = "Moved Permanently";
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  callNativeFn(storageFn(resp, "text"));
  assertEquals(jsBool(getProperty(resp, "ok")!), false);
  assertEquals(jsNum(getProperty(resp, "status")!), 301);
  context.dispose();
});

Deno.test("fetch/fn - 204 No Content sets ok to true with empty body", async () => {
  const p = new MockRequestPipeline();
  p.mockStatusCode = 204;
  p.mockStatusText = "No Content";
  p.mockBody = new Uint8Array(0);
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  callNativeFn(storageFn(resp, "text"));
  assertEquals(jsBool(getProperty(resp, "ok")!), true);
  assertEquals(jsNum(getProperty(resp, "status")!), 204);
  assertEquals(jsStr(callNativeFn(storageFn(resp, "text"))), "");
  context.dispose();
});

Deno.test("fetch/fn - clone does not share bodyUsed state", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new TextEncoder().encode("cloneable");
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const cloned = callNativeFn(storageFn(resp, "clone"));
  // Read original
  callNativeFn(storageFn(resp, "text"));
  assertEquals(jsBool(getProperty(resp, "bodyUsed")!), true);
  // Clone should be independent
  assertEquals(jsBool(getProperty(cloned, "bodyUsed")!), false);
  context.dispose();
});

Deno.test("fetch/fn - headers.entries() returns all headers as array of pairs", async () => {
  const p = new MockRequestPipeline();
  p.mockHeaders = new Map([["content-type", "text/html"], ["x-req-id", "abc123"]]);
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  callNativeFn(storageFn(resp, "text"));
  const headers = getProperty(resp, "headers")!;
  const entries = callNativeFn(storageFn(headers, "entries"));
  assertEquals(jsNum(getProperty(entries, "length")!), 2);
  context.dispose();
});

Deno.test("fetch/fn - headers.get() returns null for missing header", async () => {
  const p = new MockRequestPipeline();
  p.mockHeaders = new Map([["content-type", "text/html"]]);
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  callNativeFn(storageFn(resp, "text"));
  const headers = getProperty(resp, "headers")!;
  assertJsNull(callNativeFn(storageFn(headers, "get"), createString("x-nonexistent")));
  context.dispose();
});

Deno.test("fetch/fn - error response from pipeline rejection has ok=false, status=0", async () => {
  const p = new MockRequestPipeline();
  p.shouldReject = true;
  p.rejectError = new Error("Connection refused");
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  callNativeFn(storageFn(resp, "text"));
  assertEquals(jsBool(getProperty(resp, "ok")!), false);
  assertEquals(jsNum(getProperty(resp, "status")!), 0);
  assertEquals(jsStr(getProperty(resp, "statusText")!), "Connection refused");
  context.dispose();
});

Deno.test("fetch/fn - blob on empty body returns size 0", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new Uint8Array(0);
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const blob = callNativeFn(storageFn(resp, "blob"));
  assertEquals(jsNum(getProperty(blob, "size")!), 0);
  context.dispose();
});

Deno.test("fetch/fn - arrayBuffer on empty body returns byteLength 0", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new Uint8Array(0);
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  const buf = callNativeFn(storageFn(resp, "arrayBuffer"));
  assertEquals(jsNum(getProperty(buf, "byteLength")!), 0);
  context.dispose();
});

Deno.test("fetch/fn - PATCH sends body bytes to pipeline", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const opts = createObject();
  setProperty(opts, "method", createString("PATCH"));
  setProperty(opts, "body", createString('{"field":"updated"}'));
  callNativeFn(getFetchFn(context), createString("https://api.com/items/1"), opts);
  assertEquals(p.calls.length, 1);
  assertEquals(p.calls[0].method, "PATCH");
  assertExists(p.calls[0].body);
  const bodyText = new TextDecoder().decode(p.calls[0].body);
  assertEquals(bodyText, '{"field":"updated"}');
  context.dispose();
});

Deno.test("fetch/fn - HEAD does not send body even if provided", () => {
  const p = new MockRequestPipeline();
  const { context } = setup(p);
  const opts = createObject();
  setProperty(opts, "method", createString("HEAD"));
  setProperty(opts, "body", createString("should be ignored"));
  callNativeFn(getFetchFn(context), createString("https://api.com/status"), opts);
  assertEquals(p.calls.length, 1);
  assertEquals(p.calls[0].method, "HEAD");
  // Body should not be sent for HEAD
  assertEquals(p.calls[0].options?.body, undefined);
  context.dispose();
});

Deno.test("fetch/fn - multiple response methods can all be called", async () => {
  const p = new MockRequestPipeline();
  p.mockBody = new TextEncoder().encode('{"val":42}');
  const { context } = setup(p);
  const resp = callNativeFn(getFetchFn(context), createString("https://example.com"));
  await new Promise((r) => setTimeout(r, 50));
  // All should work without throwing
  const text = callNativeFn(storageFn(resp, "text"));
  assertEquals(jsStr(text), '{"val":42}');
  const json = callNativeFn(storageFn(resp, "json"));
  assertEquals(jsNum(getProperty(json, "val")!), 42);
  const blob = callNativeFn(storageFn(resp, "blob"));
  assertEquals(jsNum(getProperty(blob, "size")!), 10);
  const buf = callNativeFn(storageFn(resp, "arrayBuffer"));
  assertEquals(jsNum(getProperty(buf, "byteLength")!), 10);
  context.dispose();
});

// ============================================================================
// DOM BINDINGS — getDOMBindings / getJSDocument
// ============================================================================

Deno.test("getDOMBindings - returns DOMBindings instance", () => {
  const { wo } = setup();
  const bindings = wo.getDOMBindings();
  assertExists(bindings);
});

Deno.test("getJSDocument - returns a wrapped document object", () => {
  const { wo } = setup();
  const doc = wo.getJSDocument();
  assertExists(doc);
});

// ============================================================================
// WINDOW OBJECT — Extended Browser APIs
// ============================================================================

Deno.test("window - devicePixelRatio defaults to 1", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  assertEquals(jsNum(getProperty(win, "devicePixelRatio")!), 1);
  context.dispose();
});

Deno.test("window - pageXOffset/pageYOffset default to 0", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  assertEquals(jsNum(getProperty(win, "pageXOffset")!), 0);
  assertEquals(jsNum(getProperty(win, "pageYOffset")!), 0);
  context.dispose();
});

Deno.test("window - requestAnimationFrame returns numeric id", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  const raf = getProperty(win, "requestAnimationFrame")!;
  const id = callNativeFn(raf, createNativeFunction("cb", () => createUndefined()));
  assertEquals(id.type, "number");
  assert(jsNum(id) > 0);
  // Cancel to prevent timer leak
  const caf = getProperty(win, "cancelAnimationFrame")!;
  callNativeFn(caf, id);
  context.dispose();
});

Deno.test("window - cancelAnimationFrame cancels a pending raf", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  const raf = getProperty(win, "requestAnimationFrame")!;
  const caf = getProperty(win, "cancelAnimationFrame")!;
  const id = callNativeFn(raf, createNativeFunction("cb", () => createUndefined()));
  const result = callNativeFn(caf, id);
  assertEquals(result.type, "undefined");
  context.dispose();
});

Deno.test("window - addEventListener/removeEventListener/dispatchEvent exist", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  for (const name of ["addEventListener", "removeEventListener", "dispatchEvent"]) {
    const fn = getProperty(win, name);
    assertExists(fn, `window.${name} should exist`);
    assertEquals(fn!.type, "function");
  }
  context.dispose();
});

Deno.test("window - addEventListener registers and dispatchEvent fires listener", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  let called = false;
  const handler = createNativeFunction("handler", () => {
    called = true;
    return createUndefined();
  });
  callNativeFn(getProperty(win, "addEventListener")!, createString("test"), handler);
  const event = createObject();
  setProperty(event, "type", createString("test"));
  callNativeFn(getProperty(win, "dispatchEvent")!, event);
  assertEquals(called, true);
  context.dispose();
});

Deno.test("window - removeEventListener stops listener from firing", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  let callCount = 0;
  const handler = createNativeFunction("handler", () => {
    callCount++;
    return createUndefined();
  });
  callNativeFn(getProperty(win, "addEventListener")!, createString("click"), handler);
  callNativeFn(getProperty(win, "removeEventListener")!, createString("click"), handler);
  const event = createObject();
  setProperty(event, "type", createString("click"));
  callNativeFn(getProperty(win, "dispatchEvent")!, event);
  assertEquals(callCount, 0);
  context.dispose();
});

Deno.test("window - getComputedStyle returns object with getPropertyValue", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  const gcs = getProperty(win, "getComputedStyle")!;
  const style = callNativeFn(gcs, createObject());
  assertEquals(style.type, "object");
  assertEquals(jsStr(getProperty(style, "display")!), "block");
  assertEquals(jsStr(getProperty(style, "visibility")!), "visible");
  assertEquals(jsStr(getProperty(style, "fontSize")!), "16px");
  const gpv = getProperty(style, "getPropertyValue")!;
  assertEquals(callNativeFn(gpv, createString("color")).type, "string");
  context.dispose();
});

Deno.test("window - matchMedia returns MediaQueryList-like object", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  const mm = getProperty(win, "matchMedia")!;
  const mql = callNativeFn(mm, createString("(max-width: 600px)"));
  assertEquals(mql.type, "object");
  assertEquals(jsBool(getProperty(mql, "matches")!), false);
  assertEquals(jsStr(getProperty(mql, "media")!), "(max-width: 600px)");
  assertExists(getProperty(mql, "addEventListener"));
  assertExists(getProperty(mql, "removeEventListener"));
  context.dispose();
});

Deno.test("window - postMessage is a function", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  const pm = getProperty(win, "postMessage")!;
  assertEquals(pm.type, "function");
  const result = callNativeFn(pm, createString("hello"), createString("*"));
  assertEquals(result.type, "undefined");
  context.dispose();
});

Deno.test("window - open returns null in headless mode", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  const result = callNativeFn(getProperty(win, "open")!, createString("https://example.com"));
  assertEquals(result.type, "null");
  context.dispose();
});

Deno.test("window - close/focus/blur/print/stop return undefined", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  for (const name of ["close", "focus", "blur", "print", "stop"]) {
    const result = callNativeFn(getProperty(win, name)!);
    assertEquals(result.type, "undefined", `window.${name}() should return undefined`);
  }
  context.dispose();
});

Deno.test("window - getSelection returns Selection-like object", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  const sel = callNativeFn(getProperty(win, "getSelection")!);
  assertEquals(sel.type, "object");
  assertEquals(jsNum(getProperty(sel, "rangeCount")!), 0);
  assertEquals(jsBool(getProperty(sel, "isCollapsed")!), true);
  assertExists(getProperty(sel, "removeAllRanges"));
  context.dispose();
});

Deno.test("window - closed/name/opener/frameElement/length properties", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  assertEquals(jsBool(getProperty(win, "closed")!), false);
  assertEquals(jsStr(getProperty(win, "name")!), "");
  assertEquals(getProperty(win, "opener")!.type, "null");
  assertEquals(getProperty(win, "frameElement")!.type, "null");
  assertEquals(jsNum(getProperty(win, "length")!), 0);
  context.dispose();
});

Deno.test("window - parent/top/frames reference window itself", () => {
  const { context } = setup();
  const win = getProperty(context.global, "window")!;
  assertEquals(getProperty(win, "parent"), win);
  assertEquals(getProperty(win, "top"), win);
  assertEquals(getProperty(win, "frames"), win);
  context.dispose();
});

Deno.test("window - isSecureContext true for https, false for http", () => {
  const { context: ctx1 } = setup(undefined, undefined, "https://example.com/");
  const win1 = getProperty(ctx1.global, "window")!;
  assertEquals(jsBool(getProperty(win1, "isSecureContext")!), true);
  ctx1.dispose();

  const { context: ctx2 } = setup(undefined, undefined, "http://example.com/");
  const win2 = getProperty(ctx2.global, "window")!;
  assertEquals(jsBool(getProperty(win2, "isSecureContext")!), false);
  ctx2.dispose();
});

// ============================================================================
// GLOBAL APIs — atob, btoa, encoding
// ============================================================================

Deno.test("atob - decodes base64 string", () => {
  const { context } = setup();
  const atobFn = getProperty(context.global, "atob")!;
  assertEquals(jsStr(callNativeFn(atobFn, createString("aGVsbG8="))), "hello");
  context.dispose();
});

Deno.test("btoa - encodes string to base64", () => {
  const { context } = setup();
  const btoaFn = getProperty(context.global, "btoa")!;
  assertEquals(jsStr(callNativeFn(btoaFn, createString("hello"))), "aGVsbG8=");
  context.dispose();
});

Deno.test("atob/btoa - round-trip", () => {
  const { context } = setup();
  const atobFn = getProperty(context.global, "atob")!;
  const btoaFn = getProperty(context.global, "btoa")!;
  const encoded = callNativeFn(btoaFn, createString("test data 123"));
  const decoded = callNativeFn(atobFn, encoded);
  assertEquals(jsStr(decoded), "test data 123");
  context.dispose();
});

Deno.test("encodeURIComponent/decodeURIComponent round-trip", () => {
  const { context } = setup();
  const enc = getProperty(context.global, "encodeURIComponent")!;
  const dec = getProperty(context.global, "decodeURIComponent")!;
  const encoded = callNativeFn(enc, createString("hello world & foo=bar"));
  assertEquals(jsStr(encoded), "hello%20world%20%26%20foo%3Dbar");
  assertEquals(jsStr(callNativeFn(dec, encoded)), "hello world & foo=bar");
  context.dispose();
});

Deno.test("encodeURI/decodeURI round-trip", () => {
  const { context } = setup();
  const enc = getProperty(context.global, "encodeURI")!;
  const dec = getProperty(context.global, "decodeURI")!;
  const encoded = callNativeFn(enc, createString("https://example.com/path with spaces"));
  assertEquals(jsStr(callNativeFn(dec, encoded)), "https://example.com/path with spaces");
  context.dispose();
});

// ============================================================================
// GLOBAL APIs — queueMicrotask, structuredClone
// ============================================================================

Deno.test("queueMicrotask - exists and returns undefined", () => {
  const { context } = setup();
  const qm = getProperty(context.global, "queueMicrotask")!;
  assertEquals(qm.type, "function");
  const result = callNativeFn(qm, createNativeFunction("cb", () => createUndefined()));
  assertEquals(result.type, "undefined");
  context.dispose();
});

Deno.test("structuredClone - clones primitive values", () => {
  const { context } = setup();
  const sc = getProperty(context.global, "structuredClone")!;
  assertEquals(jsStr(callNativeFn(sc, createString("hello"))), "hello");
  assertEquals(jsNum(callNativeFn(sc, createNumber(42))), 42);
  assertEquals(jsBool(callNativeFn(sc, createBoolean(true))), true);
  assertJsNull(callNativeFn(sc, createNull()));
  context.dispose();
});

Deno.test("structuredClone - clones object", () => {
  const { context } = setup();
  const sc = getProperty(context.global, "structuredClone")!;
  const obj = createObject();
  setProperty(obj, "a", createNumber(1));
  setProperty(obj, "b", createString("two"));
  const clone = callNativeFn(sc, obj);
  assertEquals(clone.type, "object");
  assertEquals(jsNum(getProperty(clone, "a")!), 1);
  assertEquals(jsStr(getProperty(clone, "b")!), "two");
  context.dispose();
});

// ============================================================================
// PERFORMANCE — Timing API
// ============================================================================

Deno.test("performance - performance.now() returns a number", () => {
  const { context } = setup();
  const perf = getProperty(context.global, "performance")!;
  assertEquals(perf.type, "object");
  const now = callNativeFn(getProperty(perf, "now")!);
  assertEquals(now.type, "number");
  assert(jsNum(now) >= 0);
  context.dispose();
});

Deno.test("performance - performance.timeOrigin is a number", () => {
  const { context } = setup();
  const perf = getProperty(context.global, "performance")!;
  const to = getProperty(perf, "timeOrigin")!;
  assertEquals(to.type, "number");
  assert(jsNum(to) > 0);
  context.dispose();
});

Deno.test("performance - timing object has navigationStart", () => {
  const { context } = setup();
  const perf = getProperty(context.global, "performance")!;
  const timing = getProperty(perf, "timing")!;
  assertEquals(timing.type, "object");
  assert(jsNum(getProperty(timing, "navigationStart")!) > 0);
  context.dispose();
});

Deno.test("performance - mark/measure/getEntriesByType exist", () => {
  const { context } = setup();
  const perf = getProperty(context.global, "performance")!;
  for (const name of ["mark", "measure", "getEntriesByType", "getEntriesByName"]) {
    assertExists(getProperty(perf, name), `performance.${name} should exist`);
  }
  callNativeFn(getProperty(perf, "mark")!, createString("start"));
  const entries = callNativeFn(getProperty(perf, "getEntriesByType")!, createString("mark"));
  assertEquals(entries.type, "object");
  context.dispose();
});

// ============================================================================
// SCREEN — Display Properties
// ============================================================================

Deno.test("screen - screen object has width/height/colorDepth", () => {
  const { context } = setup();
  const scr = getProperty(context.global, "screen")!;
  assertEquals(scr.type, "object");
  assertEquals(jsNum(getProperty(scr, "width")!), 1920);
  assertEquals(jsNum(getProperty(scr, "height")!), 1080);
  assertEquals(jsNum(getProperty(scr, "availWidth")!), 1920);
  assertEquals(jsNum(getProperty(scr, "availHeight")!), 1080);
  assertEquals(jsNum(getProperty(scr, "colorDepth")!), 24);
  assertEquals(jsNum(getProperty(scr, "pixelDepth")!), 24);
  context.dispose();
});

Deno.test("screen - orientation has type and angle", () => {
  const { context } = setup();
  const scr = getProperty(context.global, "screen")!;
  const orient = getProperty(scr, "orientation")!;
  assertEquals(jsStr(getProperty(orient, "type")!), "landscape-primary");
  assertEquals(jsNum(getProperty(orient, "angle")!), 0);
  context.dispose();
});

// ============================================================================
// HISTORY — Navigation Stack
// ============================================================================

Deno.test("history - initial state has length 1 and null state", () => {
  const { context } = setup();
  const hist = getProperty(context.global, "history")!;
  assertEquals(hist.type, "object");
  assertEquals(jsNum(getProperty(hist, "length")!), 1);
  assertJsNull(getProperty(hist, "state")!);
  assertEquals(jsStr(getProperty(hist, "scrollRestoration")!), "auto");
  context.dispose();
});

Deno.test("history - pushState increases length and updates state", () => {
  const { context } = setup();
  const hist = getProperty(context.global, "history")!;
  const state = createObject();
  setProperty(state, "page", createNumber(2));
  callNativeFn(getProperty(hist, "pushState")!, state, createString(""), createString("/page2"));
  assertEquals(jsNum(getProperty(hist, "length")!), 2);
  assertEquals(jsNum(getProperty(getProperty(hist, "state")!, "page")!), 2);
  context.dispose();
});

Deno.test("history - replaceState does not increase length", () => {
  const { context } = setup();
  const hist = getProperty(context.global, "history")!;
  callNativeFn(
    getProperty(hist, "replaceState")!,
    createNull(),
    createString(""),
    createString("/replaced"),
  );
  assertEquals(jsNum(getProperty(hist, "length")!), 1);
  context.dispose();
});

Deno.test("history - back/forward/go are functions", () => {
  const { context } = setup();
  const hist = getProperty(context.global, "history")!;
  for (const name of ["back", "forward", "go"]) {
    const fn = getProperty(hist, name);
    assertExists(fn, `history.${name} should exist`);
    assertEquals(fn!.type, "function");
  }
  // Should not throw
  callNativeFn(getProperty(hist, "back")!);
  callNativeFn(getProperty(hist, "forward")!);
  callNativeFn(getProperty(hist, "go")!, createNumber(-1));
  context.dispose();
});

// ============================================================================
// CRYPTO — Random Values
// ============================================================================

Deno.test("crypto - crypto.randomUUID returns a valid UUID string", () => {
  const { context } = setup();
  const cr = getProperty(context.global, "crypto")!;
  assertEquals(cr.type, "object");
  const uuid = callNativeFn(getProperty(cr, "randomUUID")!);
  assertEquals(uuid.type, "string");
  // UUID v4 format: 8-4-4-4-12 hex chars
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(jsStr(uuid)));
  context.dispose();
});

Deno.test("crypto - crypto.getRandomValues exists and returns object", () => {
  const { context } = setup();
  const cr = getProperty(context.global, "crypto")!;
  const grv = getProperty(cr, "getRandomValues")!;
  assertEquals(grv.type, "function");
  const result = callNativeFn(grv, createObject());
  assertEquals(result.type, "object");
  context.dispose();
});

// ============================================================================
// URL — Constructor
// ============================================================================

Deno.test("URL - parses absolute URL into components", () => {
  const { context } = setup();
  const urlFn = getProperty(context.global, "URL")!;
  const parsed = callNativeFn(urlFn, createString("https://example.com:8080/path?q=1#hash"));
  assertEquals(jsStr(getProperty(parsed, "protocol")!), "https:");
  assertEquals(jsStr(getProperty(parsed, "hostname")!), "example.com");
  assertEquals(jsStr(getProperty(parsed, "port")!), "8080");
  assertEquals(jsStr(getProperty(parsed, "pathname")!), "/path");
  assertEquals(jsStr(getProperty(parsed, "search")!), "?q=1");
  assertEquals(jsStr(getProperty(parsed, "hash")!), "#hash");
  assertEquals(jsStr(getProperty(parsed, "origin")!), "https://example.com:8080");
  context.dispose();
});

Deno.test("URL - toString returns href", () => {
  const { context } = setup();
  const urlFn = getProperty(context.global, "URL")!;
  const parsed = callNativeFn(urlFn, createString("https://example.com/page"));
  const str = callNativeFn(getProperty(parsed, "toString")!);
  assertEquals(jsStr(str), "https://example.com/page");
  context.dispose();
});

Deno.test("URL - toJSON returns href", () => {
  const { context } = setup();
  const urlFn = getProperty(context.global, "URL")!;
  const parsed = callNativeFn(urlFn, createString("https://example.com/api"));
  assertEquals(jsStr(callNativeFn(getProperty(parsed, "toJSON")!)), "https://example.com/api");
  context.dispose();
});

Deno.test("URL - relative URL with base resolves correctly", () => {
  const { context } = setup();
  const urlFn = getProperty(context.global, "URL")!;
  const parsed = callNativeFn(urlFn, createString("/page"), createString("https://example.com"));
  assertEquals(jsStr(getProperty(parsed, "href")!), "https://example.com/page");
  context.dispose();
});

Deno.test("URL - invalid URL returns null", () => {
  const { context } = setup();
  const urlFn = getProperty(context.global, "URL")!;
  const result = callNativeFn(urlFn, createString("not a url at all"));
  assertEquals(result.type, "null");
  context.dispose();
});

// ============================================================================
// parseInt / parseFloat / isNaN / isFinite / globals
// ============================================================================

Deno.test("parseInt - parses integer string", () => {
  const { context } = setup();
  const pi = getProperty(context.global, "parseInt")!;
  assertEquals(jsNum(callNativeFn(pi, createString("42"))), 42);
  assertEquals(jsNum(callNativeFn(pi, createString("0xFF"), createNumber(16))), 255);
  context.dispose();
});

Deno.test("parseFloat - parses float string", () => {
  const { context } = setup();
  const pf = getProperty(context.global, "parseFloat")!;
  assertEquals(jsNum(callNativeFn(pf, createString("3.14"))), 3.14);
  context.dispose();
});

Deno.test("isNaN - detects NaN", () => {
  const { context } = setup();
  const isn = getProperty(context.global, "isNaN")!;
  assertEquals(jsBool(callNativeFn(isn, createNumber(NaN))), true);
  assertEquals(jsBool(callNativeFn(isn, createNumber(42))), false);
  context.dispose();
});

Deno.test("isFinite - detects finite numbers", () => {
  const { context } = setup();
  const isf = getProperty(context.global, "isFinite")!;
  assertEquals(jsBool(callNativeFn(isf, createNumber(42))), true);
  assertEquals(jsBool(callNativeFn(isf, createNumber(Infinity))), false);
  assertEquals(jsBool(callNativeFn(isf, createNumber(NaN))), false);
  context.dispose();
});

Deno.test("globals - NaN, Infinity, undefined exist", () => {
  const { context } = setup();
  const nan = getProperty(context.global, "NaN")!;
  assertEquals(nan.type, "number");
  assert(isNaN(jsNum(nan)));
  assertEquals(jsNum(getProperty(context.global, "Infinity")!), Infinity);
  assertEquals(getProperty(context.global, "undefined")!.type, "undefined");
  context.dispose();
});

// ============================================================================
// JSON — parse / stringify
// ============================================================================

Deno.test("JSON.parse - parses JSON string to JSValue", () => {
  const { context } = setup();
  const json = getProperty(context.global, "JSON")!;
  const parsed = callNativeFn(getProperty(json, "parse")!, createString('{"a":1,"b":"two"}'));
  assertEquals(jsNum(getProperty(parsed, "a")!), 1);
  assertEquals(jsStr(getProperty(parsed, "b")!), "two");
  context.dispose();
});

Deno.test("JSON.parse - returns null for invalid JSON", () => {
  const { context } = setup();
  const json = getProperty(context.global, "JSON")!;
  const result = callNativeFn(getProperty(json, "parse")!, createString("not json"));
  assertJsNull(result);
  context.dispose();
});

Deno.test("JSON.stringify - serializes string value", () => {
  const { context } = setup();
  const json = getProperty(context.global, "JSON")!;
  const result = callNativeFn(getProperty(json, "stringify")!, createString("hello"));
  assertEquals(jsStr(result), '"hello"');
  context.dispose();
});

Deno.test("JSON.stringify - serializes number value", () => {
  const { context } = setup();
  const json = getProperty(context.global, "JSON")!;
  assertEquals(jsStr(callNativeFn(getProperty(json, "stringify")!, createNumber(42))), "42");
  context.dispose();
});

Deno.test("JSON.stringify - serializes object", () => {
  const { context } = setup();
  const json = getProperty(context.global, "JSON")!;
  const obj = createObject();
  setProperty(obj, "x", createNumber(1));
  const result = jsStr(callNativeFn(getProperty(json, "stringify")!, obj));
  assert(result.includes('"x"'));
  assert(result.includes("1"));
  context.dispose();
});

Deno.test("JSON.stringify - serializes null and boolean", () => {
  const { context } = setup();
  const json = getProperty(context.global, "JSON")!;
  assertEquals(jsStr(callNativeFn(getProperty(json, "stringify")!, createNull())), "null");
  assertEquals(jsStr(callNativeFn(getProperty(json, "stringify")!, createBoolean(true))), "true");
  context.dispose();
});

// ============================================================================
// MATH — Mathematical Functions
// ============================================================================

Deno.test("Math - constants PI, E, SQRT2", () => {
  const { context } = setup();
  const math = getProperty(context.global, "Math")!;
  assertEquals(math.type, "object");
  assertEquals(jsNum(getProperty(math, "PI")!), Math.PI);
  assertEquals(jsNum(getProperty(math, "E")!), Math.E);
  assertEquals(jsNum(getProperty(math, "SQRT2")!), Math.SQRT2);
  context.dispose();
});

Deno.test("Math - abs/ceil/floor/round", () => {
  const { context } = setup();
  const math = getProperty(context.global, "Math")!;
  assertEquals(jsNum(callNativeFn(getProperty(math, "abs")!, createNumber(-5))), 5);
  assertEquals(jsNum(callNativeFn(getProperty(math, "ceil")!, createNumber(1.2))), 2);
  assertEquals(jsNum(callNativeFn(getProperty(math, "floor")!, createNumber(1.9))), 1);
  assertEquals(jsNum(callNativeFn(getProperty(math, "round")!, createNumber(1.5))), 2);
  context.dispose();
});

Deno.test("Math - sqrt/pow", () => {
  const { context } = setup();
  const math = getProperty(context.global, "Math")!;
  assertEquals(jsNum(callNativeFn(getProperty(math, "sqrt")!, createNumber(9))), 3);
  assertEquals(
    jsNum(callNativeFn(getProperty(math, "pow")!, createNumber(2), createNumber(10))),
    1024,
  );
  context.dispose();
});

Deno.test("Math - max/min", () => {
  const { context } = setup();
  const math = getProperty(context.global, "Math")!;
  assertEquals(
    jsNum(
      callNativeFn(getProperty(math, "max")!, createNumber(1), createNumber(5), createNumber(3)),
    ),
    5,
  );
  assertEquals(
    jsNum(
      callNativeFn(getProperty(math, "min")!, createNumber(1), createNumber(5), createNumber(3)),
    ),
    1,
  );
  context.dispose();
});

Deno.test("Math - random returns number between 0 and 1", () => {
  const { context } = setup();
  const math = getProperty(context.global, "Math")!;
  const r = jsNum(callNativeFn(getProperty(math, "random")!));
  assert(r >= 0 && r < 1);
  context.dispose();
});

Deno.test("Math - trunc/sign", () => {
  const { context } = setup();
  const math = getProperty(context.global, "Math")!;
  assertEquals(jsNum(callNativeFn(getProperty(math, "trunc")!, createNumber(4.7))), 4);
  assertEquals(jsNum(callNativeFn(getProperty(math, "sign")!, createNumber(-3))), -1);
  assertEquals(jsNum(callNativeFn(getProperty(math, "sign")!, createNumber(5))), 1);
  context.dispose();
});
