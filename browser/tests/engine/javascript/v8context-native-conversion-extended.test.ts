/**
 * Extended functional tests for V8Context.jsValueToNative()
 *
 * Covers edge cases, complex structures, mixed-type graphs,
 * and ensures the conversion is faithful for all JSValue variants.
 */
import { assertEquals, assertNotEquals } from "@std/assert";
import {
  createBigInt,
  createBoolean,
  createFunction,
  createNativeFunction,
  createNull,
  createNumber,
  createObject,
  createString,
  createSymbol,
  createUndefined,
  type JSFunction,
  type JSObject,
  type JSValue,
  JSValueType,
  setProperty,
} from "../../../src/engine/javascript/JSValue.ts";
import { V8Context } from "../../../src/engine/javascript/V8Context.ts";

// Access the private method via bracket notation for testing
function toNative(ctx: V8Context, value: JSValue): unknown {
  return (ctx as unknown as Record<string, (...args: unknown[]) => unknown>)[
    "jsValueToNative"
  ](value);
}

function createCtx(): V8Context {
  return new V8Context();
}

// ── Numeric edge cases ──────────────────────────────────────────────

Deno.test("toNative - NaN", () => {
  const ctx = createCtx();
  const result = toNative(ctx, createNumber(NaN));
  assertEquals(Number.isNaN(result as number), true);
});

Deno.test("toNative - Infinity", () => {
  const ctx = createCtx();
  assertEquals(toNative(ctx, createNumber(Infinity)), Infinity);
});

Deno.test("toNative - negative Infinity", () => {
  const ctx = createCtx();
  assertEquals(toNative(ctx, createNumber(-Infinity)), -Infinity);
});

Deno.test("toNative - negative zero", () => {
  const ctx = createCtx();
  const result = toNative(ctx, createNumber(-0)) as number;
  assertEquals(Object.is(result, -0), true);
});

Deno.test("toNative - MAX_SAFE_INTEGER", () => {
  const ctx = createCtx();
  assertEquals(
    toNative(ctx, createNumber(Number.MAX_SAFE_INTEGER)),
    Number.MAX_SAFE_INTEGER,
  );
});

Deno.test("toNative - very small float", () => {
  const ctx = createCtx();
  assertEquals(
    toNative(ctx, createNumber(Number.MIN_VALUE)),
    Number.MIN_VALUE,
  );
});

// ── String edge cases ───────────────────────────────────────────────

Deno.test("toNative - string with unicode", () => {
  const ctx = createCtx();
  assertEquals(toNative(ctx, createString("🚀 café")), "🚀 café");
});

Deno.test("toNative - string with newlines and tabs", () => {
  const ctx = createCtx();
  assertEquals(toNative(ctx, createString("a\nb\tc")), "a\nb\tc");
});

Deno.test("toNative - very long string", () => {
  const ctx = createCtx();
  const long = "x".repeat(100_000);
  assertEquals(toNative(ctx, createString(long)), long);
});

// ── BigInt edge cases ───────────────────────────────────────────────

Deno.test("toNative - bigint zero", () => {
  const ctx = createCtx();
  assertEquals(toNative(ctx, createBigInt(0n)), 0n);
});

Deno.test("toNative - very large bigint", () => {
  const ctx = createCtx();
  const big = 2n ** 256n;
  assertEquals(toNative(ctx, createBigInt(big)), big);
});

Deno.test("toNative - negative bigint", () => {
  const ctx = createCtx();
  assertEquals(toNative(ctx, createBigInt(-42n)), -42n);
});

// ── Symbol edge cases ───────────────────────────────────────────────

Deno.test("toNative - symbol without description", () => {
  const ctx = createCtx();
  const result = toNative(ctx, createSymbol());
  assertEquals(typeof result, "symbol");
});

Deno.test("toNative - symbol returns unique symbol each time", () => {
  const ctx = createCtx();
  const sym = createSymbol("same");
  const a = toNative(ctx, sym);
  const b = toNative(ctx, sym);
  // Each call creates a new Symbol()
  assertNotEquals(a, b);
});

// ── Object edge cases ───────────────────────────────────────────────

Deno.test("toNative - object with many properties", () => {
  const ctx = createCtx();
  const obj = createObject();
  for (let i = 0; i < 100; i++) {
    setProperty(obj, `key${i}`, createNumber(i));
  }
  const result = toNative(ctx, obj) as Record<string, unknown>;
  assertEquals(Object.keys(result).length, 100);
  assertEquals(result.key0, 0);
  assertEquals(result.key99, 99);
});

Deno.test("toNative - object with mixed value types in properties", () => {
  const ctx = createCtx();
  const obj = createObject();
  setProperty(obj, "str", createString("hello"));
  setProperty(obj, "num", createNumber(42));
  setProperty(obj, "bool", createBoolean(false));
  setProperty(obj, "nil", createNull());
  setProperty(obj, "undef", createUndefined());
  setProperty(obj, "nested", createObject());
  const result = toNative(ctx, obj) as Record<string, unknown>;
  assertEquals(result.str, "hello");
  assertEquals(result.num, 42);
  assertEquals(result.bool, false);
  assertEquals(result.nil, null);
  assertEquals(result.undef, undefined);
  assertEquals(typeof result.nested, "object");
});

Deno.test("toNative - deeply nested objects (5 levels)", () => {
  const ctx = createCtx();
  let current = createObject();
  setProperty(current, "depth", createNumber(5));
  for (let i = 4; i >= 1; i--) {
    const outer = createObject();
    setProperty(outer, "depth", createNumber(i));
    setProperty(outer, "child", current);
    current = outer;
  }
  const result = toNative(ctx, current) as Record<string, unknown>;
  assertEquals(result.depth, 1);
  let node = result;
  for (let i = 2; i <= 5; i++) {
    node = node.child as Record<string, unknown>;
    assertEquals(node.depth, i);
  }
});

Deno.test("toNative - object with function property", () => {
  const ctx = createCtx();
  const obj = createObject();
  const fn = createFunction("greet", "return 'hi';", 0, null);
  setProperty(obj, "method", fn);
  const result = toNative(ctx, obj) as Record<string, unknown>;
  assertEquals(result.method, "[Function: greet]");
});

Deno.test("toNative - object with native function property", () => {
  const ctx = createCtx();
  const obj = createObject();
  const nativeFn = createNativeFunction(
    "nativeMethod",
    () => createUndefined(),
    0,
  );
  setProperty(obj, "handler", nativeFn);
  const result = toNative(ctx, obj) as Record<string, unknown>;
  assertEquals(result.handler, "[Function: nativeMethod]");
});

// ── Array edge cases ────────────────────────────────────────────────

Deno.test("toNative - empty array", () => {
  const ctx = createCtx();
  const arr = createObject();
  setProperty(arr, "length", createNumber(0));
  assertEquals(toNative(ctx, arr), []);
});

Deno.test("toNative - array with single element", () => {
  const ctx = createCtx();
  const arr = createObject();
  setProperty(arr, "length", createNumber(1));
  setProperty(arr, "0", createNumber(42));
  assertEquals(toNative(ctx, arr), [42]);
});

Deno.test("toNative - array with nested objects", () => {
  const ctx = createCtx();
  const arr = createObject();
  setProperty(arr, "length", createNumber(2));

  const item0 = createObject();
  setProperty(item0, "id", createNumber(1));
  setProperty(item0, "name", createString("Alice"));

  const item1 = createObject();
  setProperty(item1, "id", createNumber(2));
  setProperty(item1, "name", createString("Bob"));

  setProperty(arr, "0", item0);
  setProperty(arr, "1", item1);

  const result = toNative(ctx, arr) as Record<string, unknown>[];
  assertEquals(result.length, 2);
  assertEquals(result[0].id, 1);
  assertEquals(result[0].name, "Alice");
  assertEquals(result[1].id, 2);
  assertEquals(result[1].name, "Bob");
});

Deno.test("toNative - array with nested arrays", () => {
  const ctx = createCtx();
  const inner = createObject();
  setProperty(inner, "length", createNumber(2));
  setProperty(inner, "0", createNumber(10));
  setProperty(inner, "1", createNumber(20));

  const outer = createObject();
  setProperty(outer, "length", createNumber(1));
  setProperty(outer, "0", inner);

  const result = toNative(ctx, outer) as unknown[][];
  assertEquals(result, [[10, 20]]);
});

Deno.test("toNative - array with all gaps", () => {
  const ctx = createCtx();
  const arr = createObject();
  setProperty(arr, "length", createNumber(3));
  // No elements set
  assertEquals(toNative(ctx, arr), [undefined, undefined, undefined]);
});

Deno.test("toNative - large array", () => {
  const ctx = createCtx();
  const arr = createObject();
  const size = 1000;
  setProperty(arr, "length", createNumber(size));
  for (let i = 0; i < size; i++) {
    setProperty(arr, String(i), createNumber(i * 2));
  }
  const result = toNative(ctx, arr) as number[];
  assertEquals(result.length, size);
  assertEquals(result[0], 0);
  assertEquals(result[999], 1998);
});

// ── Circular reference edge cases ───────────────────────────────────

Deno.test("toNative - three-way circular reference", () => {
  const ctx = createCtx();
  const a = createObject();
  const b = createObject();
  const c = createObject();
  setProperty(a, "next", b);
  setProperty(b, "next", c);
  setProperty(c, "next", a);
  setProperty(a, "name", createString("a"));
  setProperty(b, "name", createString("b"));
  setProperty(c, "name", createString("c"));

  const result = toNative(ctx, a) as Record<string, unknown>;
  assertEquals(result.name, "a");
  const bResult = result.next as Record<string, unknown>;
  assertEquals(bResult.name, "b");
  const cResult = bResult.next as Record<string, unknown>;
  assertEquals(cResult.name, "c");
  assertEquals(cResult.next, "[Circular]"); // back to a
});

Deno.test("toNative - circular reference in array element", () => {
  const ctx = createCtx();
  const obj = createObject();
  setProperty(obj, "name", createString("parent"));
  const arr = createObject();
  setProperty(arr, "length", createNumber(1));
  setProperty(arr, "0", obj);
  setProperty(obj, "items", arr);

  const result = toNative(ctx, obj) as Record<string, unknown>;
  assertEquals(result.name, "parent");
  const items = result.items as unknown[];
  assertEquals((items[0] as Record<string, unknown>).name, undefined);
  // The first element is obj again, which was already seen → Circular
  assertEquals(items[0], "[Circular]");
});

Deno.test("toNative - diamond-shaped reference (not circular)", () => {
  const ctx = createCtx();
  const shared = createObject();
  setProperty(shared, "val", createNumber(42));

  const left = createObject();
  setProperty(left, "ref", shared);

  const right = createObject();
  setProperty(right, "ref", shared);

  const root = createObject();
  setProperty(root, "left", left);
  setProperty(root, "right", right);

  const result = toNative(ctx, root) as Record<string, unknown>;
  const leftResult = result.left as Record<string, unknown>;
  const rightResult = result.right as Record<string, unknown>;

  assertEquals((leftResult.ref as Record<string, unknown>).val, 42);
  // Second visit to shared object — seen set already has it → Circular
  assertEquals(rightResult.ref, "[Circular]");
});

// ── Function edge cases ─────────────────────────────────────────────

Deno.test("toNative - function with long name", () => {
  const ctx = createCtx();
  const name = "myVeryLongFunctionNameThatGoesOnAndOn";
  const fn = createFunction(name, "", 0, null);
  assertEquals(toNative(ctx, fn), `[Function: ${name}]`);
});

Deno.test("toNative - native function conversion", () => {
  const ctx = createCtx();
  const fn = createNativeFunction("push", () => createUndefined(), 1);
  assertEquals(toNative(ctx, fn), "[Function: push]");
});

// ── Object with prototype (no prototype properties leak) ────────────

Deno.test("toNative - object with prototype does not include prototype properties", () => {
  const ctx = createCtx();
  const proto: JSValue = {
    type: JSValueType.OBJECT,
    value: {
      properties: new Map<string | symbol, JSValue>([
        ["protoMethod", createString("should not appear")],
      ]),
      prototype: null,
      extensible: true,
    } as JSObject,
  };
  const obj: JSValue = {
    type: JSValueType.OBJECT,
    value: {
      properties: new Map<string | symbol, JSValue>([
        ["own", createString("visible")],
      ]),
      prototype: (proto as { type: JSValueType.OBJECT; value: JSObject }).value,
      extensible: true,
    } as JSObject,
  };
  const result = toNative(ctx, obj) as Record<string, unknown>;
  assertEquals(result.own, "visible");
  assertEquals(result.protoMethod, undefined); // only own properties
});

// ── Integration: object inside native function call ─────────────────

Deno.test("toNative - multiple arguments to console-style function", () => {
  const ctx = createCtx();
  const captured: unknown[] = [];
  const logFn = createNativeFunction(
    "log",
    (...args: JSValue[]) => {
      for (const arg of args) {
        captured.push(toNative(ctx, arg));
      }
      return createUndefined();
    },
    0,
  );

  // Simulate calling log("hello", {x: 1}, [1,2,3])
  const str = createString("hello");
  const obj = createObject();
  setProperty(obj, "x", createNumber(1));
  const arr = createObject();
  setProperty(arr, "length", createNumber(3));
  setProperty(arr, "0", createNumber(1));
  setProperty(arr, "1", createNumber(2));
  setProperty(arr, "2", createNumber(3));

  const impl = (logFn as { type: JSValueType.FUNCTION; value: JSFunction })
    .value.nativeImpl!;
  impl(str, obj, arr);

  assertEquals(captured.length, 3);
  assertEquals(captured[0], "hello");
  assertEquals(captured[1], { x: 1 });
  assertEquals(captured[2], [1, 2, 3]);
});

// ── Conversion preserves insertion order ────────────────────────────

Deno.test("toNative - object property order preserved", () => {
  const ctx = createCtx();
  const obj = createObject();
  setProperty(obj, "z", createNumber(3));
  setProperty(obj, "a", createNumber(1));
  setProperty(obj, "m", createNumber(2));
  const result = toNative(ctx, obj) as Record<string, unknown>;
  const keys = Object.keys(result);
  assertEquals(keys, ["z", "a", "m"]);
});

// ── Mixed nested structures ─────────────────────────────────────────

Deno.test("toNative - complex nested structure: user with addresses array", () => {
  const ctx = createCtx();

  const addr1 = createObject();
  setProperty(addr1, "city", createString("NYC"));
  setProperty(addr1, "zip", createNumber(10001));

  const addr2 = createObject();
  setProperty(addr2, "city", createString("LA"));
  setProperty(addr2, "zip", createNumber(90001));

  const addresses = createObject();
  setProperty(addresses, "length", createNumber(2));
  setProperty(addresses, "0", addr1);
  setProperty(addresses, "1", addr2);

  const user = createObject();
  setProperty(user, "name", createString("John"));
  setProperty(user, "age", createNumber(30));
  setProperty(user, "active", createBoolean(true));
  setProperty(user, "addresses", addresses);
  setProperty(user, "metadata", createNull());

  const result = toNative(ctx, user) as Record<string, unknown>;
  assertEquals(result.name, "John");
  assertEquals(result.age, 30);
  assertEquals(result.active, true);
  assertEquals(result.metadata, null);
  const addrs = result.addresses as Record<string, unknown>[];
  assertEquals(addrs.length, 2);
  assertEquals(addrs[0].city, "NYC");
  assertEquals(addrs[0].zip, 10001);
  assertEquals(addrs[1].city, "LA");
  assertEquals(addrs[1].zip, 90001);
});
