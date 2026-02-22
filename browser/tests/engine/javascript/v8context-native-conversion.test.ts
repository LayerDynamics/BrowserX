/**
 * Tests for V8Context.jsValueToNative() — object-to-native conversion
 */
import { assertEquals } from "@std/assert";
import {
  createBigInt,
  createBoolean,
  createFunction,
  createNull,
  createNumber,
  createObject,
  createString,
  createSymbol,
  createUndefined,
  type JSObject,
  type JSValue,
  setProperty,
} from "../../../src/engine/javascript/JSValue.ts";
import { V8Context } from "../../../src/engine/javascript/V8Context.ts";

// Access the private method via bracket notation for testing
function toNative(ctx: V8Context, value: JSValue): unknown {
  return (ctx as unknown as Record<string, (...args: unknown[]) => unknown>)["jsValueToNative"](
    value,
  );
}

function createContext(): V8Context {
  return new V8Context();
}

Deno.test("jsValueToNative - undefined", () => {
  const ctx = createContext();
  assertEquals(toNative(ctx, createUndefined()), undefined);
});

Deno.test("jsValueToNative - null", () => {
  const ctx = createContext();
  assertEquals(toNative(ctx, createNull()), null);
});

Deno.test("jsValueToNative - boolean true", () => {
  const ctx = createContext();
  assertEquals(toNative(ctx, createBoolean(true)), true);
});

Deno.test("jsValueToNative - boolean false", () => {
  const ctx = createContext();
  assertEquals(toNative(ctx, createBoolean(false)), false);
});

Deno.test("jsValueToNative - number", () => {
  const ctx = createContext();
  assertEquals(toNative(ctx, createNumber(42)), 42);
});

Deno.test("jsValueToNative - number zero", () => {
  const ctx = createContext();
  assertEquals(toNative(ctx, createNumber(0)), 0);
});

Deno.test("jsValueToNative - string", () => {
  const ctx = createContext();
  assertEquals(toNative(ctx, createString("hello")), "hello");
});

Deno.test("jsValueToNative - empty string", () => {
  const ctx = createContext();
  assertEquals(toNative(ctx, createString("")), "");
});

Deno.test("jsValueToNative - bigint", () => {
  const ctx = createContext();
  assertEquals(toNative(ctx, createBigInt(123n)), 123n);
});

Deno.test("jsValueToNative - symbol", () => {
  const ctx = createContext();
  const result = toNative(ctx, createSymbol("test"));
  assertEquals(typeof result, "symbol");
});

Deno.test("jsValueToNative - empty object", () => {
  const ctx = createContext();
  const obj = createObject();
  const result = toNative(ctx, obj);
  assertEquals(result, {});
});

Deno.test("jsValueToNative - object with string properties", () => {
  const ctx = createContext();
  const obj = createObject();
  setProperty(obj, "name", createString("Alice"));
  setProperty(obj, "age", createNumber(30));
  const result = toNative(ctx, obj) as Record<string, unknown>;
  assertEquals(result.name, "Alice");
  assertEquals(result.age, 30);
});

Deno.test("jsValueToNative - nested object", () => {
  const ctx = createContext();
  const inner = createObject();
  setProperty(inner, "x", createNumber(1));
  const outer = createObject();
  setProperty(outer, "child", inner);
  const result = toNative(ctx, outer) as Record<string, unknown>;
  assertEquals((result.child as Record<string, unknown>).x, 1);
});

Deno.test("jsValueToNative - array-like object", () => {
  const ctx = createContext();
  const arr = createObject();
  setProperty(arr, "length", createNumber(3));
  setProperty(arr, "0", createString("a"));
  setProperty(arr, "1", createString("b"));
  setProperty(arr, "2", createString("c"));
  const result = toNative(ctx, arr);
  assertEquals(result, ["a", "b", "c"]);
});

Deno.test("jsValueToNative - array with gaps", () => {
  const ctx = createContext();
  const arr = createObject();
  setProperty(arr, "length", createNumber(3));
  setProperty(arr, "0", createString("a"));
  // index 1 missing
  setProperty(arr, "2", createString("c"));
  const result = toNative(ctx, arr);
  assertEquals(result, ["a", undefined, "c"]);
});

Deno.test("jsValueToNative - circular reference", () => {
  const ctx = createContext();
  const obj = createObject();
  setProperty(obj, "self", obj);
  const result = toNative(ctx, obj) as Record<string, unknown>;
  assertEquals(result.self, "[Circular]");
});

Deno.test("jsValueToNative - deeply nested circular reference", () => {
  const ctx = createContext();
  const a = createObject();
  const b = createObject();
  setProperty(a, "b", b);
  setProperty(b, "a", a);
  const result = toNative(ctx, a) as Record<string, unknown>;
  const bResult = result.b as Record<string, unknown>;
  assertEquals(bResult.a, "[Circular]");
});

Deno.test("jsValueToNative - function shows name", () => {
  const ctx = createContext();
  const fn = createFunction("myFunc", "return 1;", 0, null);
  const result = toNative(ctx, fn);
  assertEquals(result, "[Function: myFunc]");
});

Deno.test("jsValueToNative - anonymous function", () => {
  const ctx = createContext();
  const fn = createFunction("", "return 1;", 0, null);
  const result = toNative(ctx, fn);
  assertEquals(result, "[Function: anonymous]");
});

Deno.test("jsValueToNative - object with boolean and null properties", () => {
  const ctx = createContext();
  const obj = createObject();
  setProperty(obj, "active", createBoolean(true));
  setProperty(obj, "data", createNull());
  const result = toNative(ctx, obj) as Record<string, unknown>;
  assertEquals(result.active, true);
  assertEquals(result.data, null);
});
