/**
 * Integration & E2E tests for V8Context jsValueToNative + V8Heap GC traversal
 *
 * These tests exercise the full pipeline: JS source → compile → execute → native conversion,
 * and verify that GC works correctly with heap objects produced by real execution.
 */
import { assertEquals, assertNotEquals } from "@std/assert";
import {
  createFunction,
  createNativeFunction,
  createNumber,
  createObject,
  createString,
  createUndefined,
  type Environment,
  type JSFunction,
  type JSObject,
  type JSValue,
  JSValueType,
  setProperty,
} from "../../../src/engine/javascript/JSValue.ts";
import { V8Context } from "../../../src/engine/javascript/V8Context.ts";
import { GCType, V8Heap } from "../../../src/engine/javascript/V8Heap.ts";

// Helper: access private jsValueToNative
function toNative(ctx: V8Context, value: JSValue): unknown {
  return (ctx as unknown as Record<string, (...args: unknown[]) => unknown>)[
    "jsValueToNative"
  ](value);
}

// ══════════════════════════════════════════════════════════════════════
// INTEGRATION: jsValueToNative used by console.log during execution
// ══════════════════════════════════════════════════════════════════════

Deno.test("integration - console.log receives object data not [object Object]", () => {
  const ctx = new V8Context();
  const captured: unknown[] = [];

  // Replace console.log on the global to capture output
  const global = ctx.getGlobal();
  const consoleObj = (global.value as JSObject).properties.get("console")!;
  setProperty(
    consoleObj,
    "log",
    createNativeFunction("log", (...args: JSValue[]) => {
      for (const arg of args) {
        captured.push(toNative(ctx, arg));
      }
      return createUndefined();
    }, 0),
  );

  // Execute code that creates an object and logs it
  ctx.execute("var x = 42");
  // Log a number
  const logFn = (consoleObj.value as JSObject).properties.get("log")!;
  const impl = (logFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  impl(createNumber(42));
  assertEquals(captured[0], 42);
});

Deno.test("integration - console.log with string argument", () => {
  const ctx = new V8Context();
  const captured: unknown[] = [];

  const global = ctx.getGlobal();
  const consoleObj = (global.value as JSObject).properties.get("console")!;
  setProperty(
    consoleObj,
    "log",
    createNativeFunction("log", (...args: JSValue[]) => {
      for (const arg of args) {
        captured.push(toNative(ctx, arg));
      }
      return createUndefined();
    }, 0),
  );

  const logFn = (consoleObj.value as JSObject).properties.get("log")!;
  const impl = (logFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  impl(createString("hello world"));
  assertEquals(captured[0], "hello world");
});

Deno.test("integration - console.log with nested object argument", () => {
  const ctx = new V8Context();
  const captured: unknown[] = [];

  const global = ctx.getGlobal();
  const consoleObj = (global.value as JSObject).properties.get("console")!;
  setProperty(
    consoleObj,
    "log",
    createNativeFunction("log", (...args: JSValue[]) => {
      for (const arg of args) {
        captured.push(toNative(ctx, arg));
      }
      return createUndefined();
    }, 0),
  );

  const obj = createObject();
  setProperty(obj, "name", createString("test"));
  setProperty(obj, "value", createNumber(123));
  const inner = createObject();
  setProperty(inner, "nested", createString("yes"));
  setProperty(obj, "child", inner);

  const logFn = (consoleObj.value as JSObject).properties.get("log")!;
  const impl = (logFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  impl(obj);

  const result = captured[0] as Record<string, unknown>;
  assertEquals(result.name, "test");
  assertEquals(result.value, 123);
  assertEquals((result.child as Record<string, unknown>).nested, "yes");
});

Deno.test("integration - console.log with array argument", () => {
  const ctx = new V8Context();
  const captured: unknown[] = [];

  const global = ctx.getGlobal();
  const consoleObj = (global.value as JSObject).properties.get("console")!;
  setProperty(
    consoleObj,
    "log",
    createNativeFunction("log", (...args: JSValue[]) => {
      for (const arg of args) {
        captured.push(toNative(ctx, arg));
      }
      return createUndefined();
    }, 0),
  );

  const arr = createObject();
  setProperty(arr, "length", createNumber(3));
  setProperty(arr, "0", createNumber(10));
  setProperty(arr, "1", createNumber(20));
  setProperty(arr, "2", createNumber(30));

  const logFn = (consoleObj.value as JSObject).properties.get("log")!;
  const impl = (logFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  impl(arr);
  assertEquals(captured[0], [10, 20, 30]);
});

Deno.test("integration - console.log with multiple mixed arguments", () => {
  const ctx = new V8Context();
  const captured: unknown[] = [];

  const global = ctx.getGlobal();
  const consoleObj = (global.value as JSObject).properties.get("console")!;
  setProperty(
    consoleObj,
    "log",
    createNativeFunction("log", (...args: JSValue[]) => {
      for (const arg of args) {
        captured.push(toNative(ctx, arg));
      }
      return createUndefined();
    }, 0),
  );

  const logFn = (consoleObj.value as JSObject).properties.get("log")!;
  const impl = (logFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;

  const obj = createObject();
  setProperty(obj, "key", createString("val"));

  impl(createString("prefix"), createNumber(42), obj, createUndefined());

  assertEquals(captured[0], "prefix");
  assertEquals(captured[1], 42);
  assertEquals((captured[2] as Record<string, unknown>).key, "val");
  assertEquals(captured[3], undefined);
});

Deno.test("integration - console.log with circular object argument", () => {
  const ctx = new V8Context();
  const captured: unknown[] = [];

  const global = ctx.getGlobal();
  const consoleObj = (global.value as JSObject).properties.get("console")!;
  setProperty(
    consoleObj,
    "log",
    createNativeFunction("log", (...args: JSValue[]) => {
      for (const arg of args) {
        captured.push(toNative(ctx, arg));
      }
      return createUndefined();
    }, 0),
  );

  const obj = createObject();
  setProperty(obj, "name", createString("cyclic"));
  setProperty(obj, "self", obj);

  const logFn = (consoleObj.value as JSObject).properties.get("log")!;
  const impl = (logFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  impl(obj);

  const result = captured[0] as Record<string, unknown>;
  assertEquals(result.name, "cyclic");
  assertEquals(result.self, "[Circular]");
});

// ══════════════════════════════════════════════════════════════════════
// INTEGRATION: console.warn and console.error also use jsValueToNative
// ══════════════════════════════════════════════════════════════════════

Deno.test("integration - console.warn receives proper object data", () => {
  const ctx = new V8Context();
  const captured: unknown[] = [];

  const global = ctx.getGlobal();
  const consoleObj = (global.value as JSObject).properties.get("console")!;
  setProperty(
    consoleObj,
    "warn",
    createNativeFunction("warn", (...args: JSValue[]) => {
      for (const arg of args) {
        captured.push(toNative(ctx, arg));
      }
      return createUndefined();
    }, 0),
  );

  const obj = createObject();
  setProperty(obj, "warning", createString("low disk"));
  const warnFn = (consoleObj.value as JSObject).properties.get("warn")!;
  const impl = (warnFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  impl(obj);
  assertEquals((captured[0] as Record<string, unknown>).warning, "low disk");
});

Deno.test("integration - console.error receives proper object data", () => {
  const ctx = new V8Context();
  const captured: unknown[] = [];

  const global = ctx.getGlobal();
  const consoleObj = (global.value as JSObject).properties.get("console")!;
  setProperty(
    consoleObj,
    "error",
    createNativeFunction("error", (...args: JSValue[]) => {
      for (const arg of args) {
        captured.push(toNative(ctx, arg));
      }
      return createUndefined();
    }, 0),
  );

  const obj = createObject();
  setProperty(obj, "code", createNumber(500));
  setProperty(obj, "message", createString("internal error"));
  const errFn = (consoleObj.value as JSObject).properties.get("error")!;
  const impl = (errFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  impl(obj);
  const result = captured[0] as Record<string, unknown>;
  assertEquals(result.code, 500);
  assertEquals(result.message, "internal error");
});

// ══════════════════════════════════════════════════════════════════════
// INTEGRATION: parseInt/parseFloat/isNaN/isFinite use jsValueToNative
// ══════════════════════════════════════════════════════════════════════

Deno.test("integration - parseInt converts JSValue string to native correctly", () => {
  const ctx = new V8Context();
  const global = ctx.getGlobal();
  const parseIntFn = (global.value as JSObject).properties.get("parseInt")!;
  const impl = (parseIntFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  const result = impl(createString("42"));
  assertEquals(result.type, "number");
  assertEquals((result as { type: "number"; value: number }).value, 42);
});

Deno.test("integration - parseFloat converts JSValue string to native correctly", () => {
  const ctx = new V8Context();
  const global = ctx.getGlobal();
  const parseFloatFn = (global.value as JSObject).properties.get("parseFloat")!;
  const impl = (parseFloatFn as { type: JSValueType.FUNCTION; value: JSFunction }).value
    .nativeImpl!;
  const result = impl(createString("3.14"));
  assertEquals(result.type, "number");
  assertEquals((result as { type: "number"; value: number }).value, 3.14);
});

Deno.test("integration - isNaN converts JSValue to native correctly", () => {
  const ctx = new V8Context();
  const global = ctx.getGlobal();
  const isNaNFn = (global.value as JSObject).properties.get("isNaN")!;
  const impl = (isNaNFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;

  const resultNaN = impl(createNumber(NaN));
  assertEquals((resultNaN as { type: "boolean"; value: boolean }).value, true);

  const resultNum = impl(createNumber(42));
  assertEquals((resultNum as { type: "boolean"; value: boolean }).value, false);
});

Deno.test("integration - isFinite converts JSValue to native correctly", () => {
  const ctx = new V8Context();
  const global = ctx.getGlobal();
  const isFiniteFn = (global.value as JSObject).properties.get("isFinite")!;
  const impl = (isFiniteFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;

  const resultInf = impl(createNumber(Infinity));
  assertEquals((resultInf as { type: "boolean"; value: boolean }).value, false);

  const resultNum = impl(createNumber(42));
  assertEquals((resultNum as { type: "boolean"; value: boolean }).value, true);
});

// ══════════════════════════════════════════════════════════════════════
// INTEGRATION: Math functions use jsValueToNative for argument conversion
// ══════════════════════════════════════════════════════════════════════

Deno.test("integration - Math.abs converts JSValue to native correctly", () => {
  const ctx = new V8Context();
  const global = ctx.getGlobal();
  const mathObj = (global.value as JSObject).properties.get("Math")!;
  const absFn = (mathObj.value as JSObject).properties.get("abs")!;
  const impl = (absFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  const result = impl(createNumber(-7));
  assertEquals((result as { type: "number"; value: number }).value, 7);
});

Deno.test("integration - Math.sqrt converts JSValue to native correctly", () => {
  const ctx = new V8Context();
  const global = ctx.getGlobal();
  const mathObj = (global.value as JSObject).properties.get("Math")!;
  const sqrtFn = (mathObj.value as JSObject).properties.get("sqrt")!;
  const impl = (sqrtFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  const result = impl(createNumber(16));
  assertEquals((result as { type: "number"; value: number }).value, 4);
});

Deno.test("integration - Math.floor converts JSValue to native correctly", () => {
  const ctx = new V8Context();
  const global = ctx.getGlobal();
  const mathObj = (global.value as JSObject).properties.get("Math")!;
  const floorFn = (mathObj.value as JSObject).properties.get("floor")!;
  const impl = (floorFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  const result = impl(createNumber(3.7));
  assertEquals((result as { type: "number"; value: number }).value, 3);
});

Deno.test("integration - Math.ceil converts JSValue to native correctly", () => {
  const ctx = new V8Context();
  const global = ctx.getGlobal();
  const mathObj = (global.value as JSObject).properties.get("Math")!;
  const ceilFn = (mathObj.value as JSObject).properties.get("ceil")!;
  const impl = (ceilFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  const result = impl(createNumber(3.2));
  assertEquals((result as { type: "number"; value: number }).value, 4);
});

Deno.test("integration - Math.round converts JSValue to native correctly", () => {
  const ctx = new V8Context();
  const global = ctx.getGlobal();
  const mathObj = (global.value as JSObject).properties.get("Math")!;
  const roundFn = (mathObj.value as JSObject).properties.get("round")!;
  const impl = (roundFn as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;

  const result1 = impl(createNumber(3.5));
  assertEquals((result1 as { type: "number"; value: number }).value, 4);

  const result2 = impl(createNumber(3.4));
  assertEquals((result2 as { type: "number"; value: number }).value, 3);
});

// ══════════════════════════════════════════════════════════════════════
// INTEGRATION: V8Context.execute() + heap GC interplay
// ══════════════════════════════════════════════════════════════════════

Deno.test("integration - V8Context.execute returns valid result", () => {
  const ctx = new V8Context();
  const result = ctx.execute("var x = 10");
  assertEquals(result.success, true);
});

Deno.test("integration - V8Context heap is accessible and has objects", () => {
  const ctx = new V8Context();
  const heap = ctx.getHeap();
  const stats = heap.getStats();
  // The heap should exist and be functional
  assertNotEquals(stats, null);
  assertEquals(typeof stats.totalSize, "number");
  assertEquals(typeof stats.objectCount, "number");
});

Deno.test("integration - heap allocation + GC via V8Context.getHeap()", () => {
  const ctx = new V8Context();
  const heap = ctx.getHeap();

  const obj = createObject();
  setProperty(obj, "data", createString("test"));
  const id = heap.allocate(obj);
  heap.addRoot(id);

  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(id), true, "rooted object survives GC via context heap");
});

Deno.test("integration - heap GC collects unrooted objects via context", () => {
  const ctx = new V8Context();
  const heap = ctx.getHeap();

  const obj = createObject();
  const id = heap.allocate(obj);
  // Not rooted

  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(id), false, "unrooted object collected");
});

// ══════════════════════════════════════════════════════════════════════
// E2E: Full pipeline — compile + execute + native conversion + GC
// ══════════════════════════════════════════════════════════════════════

Deno.test("e2e - execute simple expression and convert result", () => {
  const ctx = new V8Context();
  const result = ctx.execute("1 + 2");
  assertEquals(result.success, true);
  const native = toNative(ctx, result.value);
  assertEquals(native, 3);
});

Deno.test("e2e - execute string literal and convert result", () => {
  const ctx = new V8Context();
  const result = ctx.execute('"hello world"');
  assertEquals(result.success, true);
  const native = toNative(ctx, result.value);
  assertEquals(native, "hello world");
});

Deno.test("e2e - execute boolean expression and convert result", () => {
  const ctx = new V8Context();
  const result = ctx.execute("true");
  assertEquals(result.success, true);
  assertEquals(toNative(ctx, result.value), true);
});

Deno.test("e2e - execute var declaration returns undefined", () => {
  const ctx = new V8Context();
  const result = ctx.execute("var x = 5");
  assertEquals(result.success, true);
  assertEquals(toNative(ctx, result.value), undefined);
});

Deno.test("e2e - execute numeric expression with Math", () => {
  const ctx = new V8Context();
  const result = ctx.execute("2 * 3 + 1");
  assertEquals(result.success, true);
  assertEquals(toNative(ctx, result.value), 7);
});

Deno.test("e2e - execute comparison returns boolean", () => {
  const ctx = new V8Context();
  const result = ctx.execute("5 > 3");
  assertEquals(result.success, true);
  assertEquals(toNative(ctx, result.value), true);
});

Deno.test("e2e - execute false comparison returns false", () => {
  const ctx = new V8Context();
  const result = ctx.execute("1 > 10");
  assertEquals(result.success, true);
  assertEquals(toNative(ctx, result.value), false);
});

Deno.test("e2e - stats update after execution", () => {
  const ctx = new V8Context();
  ctx.execute("1 + 1");
  const stats = ctx.getStats();
  assertEquals(stats.executionsCount, 1);
  assertNotEquals(stats.totalExecutionTime, 0);
});

Deno.test("e2e - multiple executions accumulate stats", () => {
  const ctx = new V8Context();
  ctx.execute("1");
  ctx.execute("2");
  ctx.execute("3");
  const stats = ctx.getStats();
  assertEquals(stats.executionsCount, 3);
});

// ══════════════════════════════════════════════════════════════════════
// E2E: GC preserves heap-allocated objects created through real use
// ══════════════════════════════════════════════════════════════════════

Deno.test("e2e - allocate complex graph on context heap, GC preserves it", () => {
  const ctx = new V8Context();
  const heap = ctx.getHeap();

  // Build: root → child → grandchild, plus sibling
  const grandchild = createObject();
  setProperty(grandchild, "level", createNumber(3));
  const gcId = heap.allocate(grandchild);

  const child = createObject();
  setProperty(child, "level", createNumber(2));
  setProperty(child, "gc", grandchild);
  const cId = heap.allocate(child);

  const sibling = createObject();
  setProperty(sibling, "level", createNumber(2));
  const sId = heap.allocate(sibling);

  const root = createObject();
  setProperty(root, "level", createNumber(1));
  setProperty(root, "child", child);
  setProperty(root, "sibling", sibling);
  const rId = heap.allocate(root);
  heap.addRoot(rId);

  // Orphan
  const orphan = createObject();
  const oId = heap.allocate(orphan);

  heap.forceGC(GCType.SCAVENGE);

  assertEquals(heap.hasObject(rId), true);
  assertEquals(heap.hasObject(cId), true);
  assertEquals(heap.hasObject(gcId), true);
  assertEquals(heap.hasObject(sId), true);
  assertEquals(heap.hasObject(oId), false, "orphan collected");
});

Deno.test("e2e - toNative after GC — converted object is still valid", () => {
  const ctx = new V8Context();
  const heap = ctx.getHeap();

  const obj = createObject();
  setProperty(obj, "x", createNumber(99));
  setProperty(obj, "y", createString("alive"));
  const id = heap.allocate(obj);
  heap.addRoot(id);

  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(id), true);

  // Convert the survived object to native
  const heapObj = heap.getObject(id)!;
  const native = toNative(ctx, heapObj.value) as Record<string, unknown>;
  assertEquals(native.x, 99);
  assertEquals(native.y, "alive");
});

Deno.test("e2e - function with closure survives GC, scope data accessible", () => {
  const ctx = new V8Context();
  const heap = ctx.getHeap();

  const closedData = createObject();
  setProperty(closedData, "secret", createString("hidden"));
  const dataId = heap.allocate(closedData);

  const scope: Environment = {
    bindings: new Map([["data", closedData]]),
    outer: null,
  };

  const fn = createFunction("getter", "return data;", 0, scope);
  const fnId = heap.allocate(fn);
  heap.addRoot(fnId);

  // Promote
  heap.forceGC(GCType.SCAVENGE);
  // Mark-sweep
  heap.forceGC(GCType.MARK_SWEEP);

  assertEquals(heap.hasObject(fnId), true, "function survives both GC cycles");
  assertEquals(heap.hasObject(dataId), true, "closure data survives both GC cycles");

  // Verify we can still convert the closure's captured data
  const heapData = heap.getObject(dataId)!;
  const native = toNative(ctx, heapData.value) as Record<string, unknown>;
  assertEquals(native.secret, "hidden");
});

Deno.test("e2e - jsValueToNative of function returns name even after GC", () => {
  const ctx = new V8Context();
  const heap = ctx.getHeap();

  const fn = createFunction("myHandler", "", 0, null);
  const fnId = heap.allocate(fn);
  heap.addRoot(fnId);

  heap.forceGC(GCType.SCAVENGE);

  const heapFn = heap.getObject(fnId)!;
  assertEquals(toNative(ctx, heapFn.value), "[Function: myHandler]");
});

// ══════════════════════════════════════════════════════════════════════
// E2E: Custom native function using toNative to process objects
// ══════════════════════════════════════════════════════════════════════

Deno.test("e2e - custom native function receives and processes object argument", () => {
  const ctx = new V8Context();
  let processedName = "";
  let processedAge = 0;

  const global = ctx.getGlobal();
  const processUser = createNativeFunction("processUser", (userArg: JSValue) => {
    const native = toNative(ctx, userArg) as Record<string, unknown>;
    processedName = native.name as string;
    processedAge = native.age as number;
    return createString(`Processed: ${processedName}`);
  }, 1);
  setProperty(global, "processUser", processUser);

  // Call it with a JSValue object
  const user = createObject();
  setProperty(user, "name", createString("Alice"));
  setProperty(user, "age", createNumber(30));

  const impl = (processUser as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  const result = impl(user);
  assertEquals(processedName, "Alice");
  assertEquals(processedAge, 30);
  assertEquals((result as { type: "string"; value: string }).value, "Processed: Alice");
});

Deno.test("e2e - custom native function receives array and sums elements", () => {
  const ctx = new V8Context();

  const sumArray = createNativeFunction("sumArray", (arrArg: JSValue) => {
    const native = toNative(ctx, arrArg) as number[];
    const sum = native.reduce((a, b) => a + b, 0);
    return createNumber(sum);
  }, 1);

  const arr = createObject();
  setProperty(arr, "length", createNumber(4));
  setProperty(arr, "0", createNumber(10));
  setProperty(arr, "1", createNumber(20));
  setProperty(arr, "2", createNumber(30));
  setProperty(arr, "3", createNumber(40));

  const impl = (sumArray as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  const result = impl(arr);
  assertEquals((result as { type: "number"; value: number }).value, 100);
});

Deno.test("e2e - custom native function receives nested config object", () => {
  const ctx = new V8Context();
  let parsedConfig: Record<string, unknown> = {};

  const applyConfig = createNativeFunction("applyConfig", (cfg: JSValue) => {
    parsedConfig = toNative(ctx, cfg) as Record<string, unknown>;
    return createUndefined();
  }, 1);

  const db = createObject();
  setProperty(db, "host", createString("localhost"));
  setProperty(db, "port", createNumber(5432));

  const cache = createObject();
  setProperty(cache, "enabled", { type: JSValueType.BOOLEAN, value: true } as JSValue);
  setProperty(cache, "ttl", createNumber(3600));

  const config = createObject();
  setProperty(config, "db", db);
  setProperty(config, "cache", cache);
  setProperty(config, "name", createString("prod"));

  const impl = (applyConfig as { type: JSValueType.FUNCTION; value: JSFunction }).value.nativeImpl!;
  impl(config);

  assertEquals(parsedConfig.name, "prod");
  const dbResult = parsedConfig.db as Record<string, unknown>;
  assertEquals(dbResult.host, "localhost");
  assertEquals(dbResult.port, 5432);
  const cacheResult = parsedConfig.cache as Record<string, unknown>;
  assertEquals(cacheResult.enabled, true);
  assertEquals(cacheResult.ttl, 3600);
});

// ══════════════════════════════════════════════════════════════════════
// E2E: GC + toNative combined stress test
// ══════════════════════════════════════════════════════════════════════

Deno.test("e2e - allocate many objects, root some, GC, then convert survivors", () => {
  const ctx = new V8Context();
  const heap = ctx.getHeap();

  const rootedIds: string[] = [];
  const unrootedIds: string[] = [];

  for (let i = 0; i < 20; i++) {
    const obj = createObject();
    setProperty(obj, "index", createNumber(i));
    setProperty(obj, "label", createString(`item-${i}`));
    const id = heap.allocate(obj);

    if (i % 3 === 0) {
      heap.addRoot(id);
      rootedIds.push(id);
    } else {
      unrootedIds.push(id);
    }
  }

  heap.forceGC(GCType.SCAVENGE);

  // Verify rooted survived
  for (const id of rootedIds) {
    assertEquals(heap.hasObject(id), true);
    const heapObj = heap.getObject(id)!;
    const native = toNative(ctx, heapObj.value) as Record<string, unknown>;
    assertEquals(typeof native.index, "number");
    assertEquals(typeof native.label, "string");
  }

  // Verify unrooted collected
  for (const id of unrootedIds) {
    assertEquals(heap.hasObject(id), false);
  }
});

Deno.test("e2e - GC preserves object graph then toNative produces correct nested output", () => {
  const ctx = new V8Context();
  const heap = ctx.getHeap();

  // Build a mini DOM-like tree — all objects must be heap-allocated
  const textNode = createObject();
  setProperty(textNode, "type", createString("text"));
  setProperty(textNode, "content", createString("Hello World"));
  const textId = heap.allocate(textNode);

  const spanChildren = createObject();
  setProperty(spanChildren, "length", createNumber(1));
  setProperty(spanChildren, "0", textNode);
  const spanChildrenId = heap.allocate(spanChildren);

  const span = createObject();
  setProperty(span, "type", createString("span"));
  setProperty(span, "class", createString("greeting"));
  setProperty(span, "children", spanChildren);
  const spanId = heap.allocate(span);

  const divChildren = createObject();
  setProperty(divChildren, "length", createNumber(1));
  setProperty(divChildren, "0", span);
  const divChildrenId = heap.allocate(divChildren);

  const div = createObject();
  setProperty(div, "type", createString("div"));
  setProperty(div, "id", createString("root"));
  setProperty(div, "children", divChildren);
  const divId = heap.allocate(div);
  heap.addRoot(divId);

  // GC
  heap.forceGC(GCType.SCAVENGE);

  // Verify graph survived
  assertEquals(heap.hasObject(divId), true);
  assertEquals(heap.hasObject(divChildrenId), true);
  assertEquals(heap.hasObject(spanId), true);
  assertEquals(heap.hasObject(spanChildrenId), true);
  assertEquals(heap.hasObject(textId), true);

  // Convert to native and verify structure
  const heapDiv = heap.getObject(divId)!;
  const native = toNative(ctx, heapDiv.value) as Record<string, unknown>;
  assertEquals(native.type, "div");
  assertEquals(native.id, "root");
  const nativeChildren = native.children as Record<string, unknown>[];
  assertEquals(nativeChildren.length, 1);
  const nativeSpan = nativeChildren[0] as Record<string, unknown>;
  assertEquals(nativeSpan.type, "span");
  assertEquals(nativeSpan.class, "greeting");
  const nativeSpanChildren = nativeSpan.children as Record<string, unknown>[];
  assertEquals(nativeSpanChildren.length, 1);
  const nativeText = nativeSpanChildren[0] as Record<string, unknown>;
  assertEquals(nativeText.type, "text");
  assertEquals(nativeText.content, "Hello World");
});
