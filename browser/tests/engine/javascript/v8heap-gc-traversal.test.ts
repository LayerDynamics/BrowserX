/**
 * Tests for V8Heap GC traversal — markChildren() and markEnvironment()
 */
import { assertEquals } from "@std/assert";
import {
  createFunction,
  createNumber,
  createObject,
  createString,
  createUndefined,
  type JSObject,
  type JSValue,
  JSValueType,
  setProperty,
} from "../../../src/engine/javascript/JSValue.ts";
import { GCType, V8Heap } from "../../../src/engine/javascript/V8Heap.ts";

Deno.test("GC traversal - root object survives scavenge", () => {
  const heap = new V8Heap();
  const obj = createObject();
  setProperty(obj, "x", createNumber(1));
  const id = heap.allocate(obj);
  heap.addRoot(id);
  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(id), true);
});

Deno.test("GC traversal - unreachable object is collected", () => {
  const heap = new V8Heap();
  const obj = createObject();
  const id = heap.allocate(obj);
  // No root added
  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(id), false);
});

Deno.test("GC traversal - object referenced by root survives", () => {
  const heap = new V8Heap();
  const child = createObject();
  setProperty(child, "val", createNumber(42));
  const childId = heap.allocate(child);

  const parent = createObject();
  setProperty(parent, "child", child);
  const parentId = heap.allocate(parent);
  heap.addRoot(parentId);

  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(parentId), true, "parent should survive");
  assertEquals(heap.hasObject(childId), true, "child should survive via parent reference");
});

Deno.test("GC traversal - deep object graph traverses fully", () => {
  const heap = new V8Heap();

  const c = createObject();
  setProperty(c, "val", createString("deep"));
  const cId = heap.allocate(c);

  const b = createObject();
  setProperty(b, "c", c);
  const bId = heap.allocate(b);

  const a = createObject();
  setProperty(a, "b", b);
  const aId = heap.allocate(a);
  heap.addRoot(aId);

  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(aId), true);
  assertEquals(heap.hasObject(bId), true);
  assertEquals(heap.hasObject(cId), true);
});

Deno.test("GC traversal - prototype chain keeps objects alive", () => {
  const heap = new V8Heap();

  const proto: JSValue = {
    type: JSValueType.OBJECT,
    value: {
      properties: new Map([["toString", createString("proto")]]),
      prototype: null,
      extensible: true,
    } as JSObject,
  };
  const protoId = heap.allocate(proto);

  const obj: JSValue = {
    type: JSValueType.OBJECT,
    value: {
      properties: new Map(),
      prototype: proto.value as JSObject,
      extensible: true,
    } as JSObject,
  };
  const objId = heap.allocate(obj);
  heap.addRoot(objId);

  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(objId), true);
  assertEquals(heap.hasObject(protoId), true, "prototype should survive");
});

Deno.test("GC traversal - circular references don't cause infinite loop", () => {
  const heap = new V8Heap();

  const a = createObject();
  const b = createObject();
  setProperty(a, "b", b);
  setProperty(b, "a", a);

  const aId = heap.allocate(a);
  const bId = heap.allocate(b);
  heap.addRoot(aId);

  // Should not hang
  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(aId), true);
  assertEquals(heap.hasObject(bId), true);
});

Deno.test("GC traversal - self-referencing object doesn't infinite loop", () => {
  const heap = new V8Heap();
  const obj = createObject();
  setProperty(obj, "self", obj);
  const id = heap.allocate(obj);
  heap.addRoot(id);
  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(id), true);
});

Deno.test("GC traversal - function closure keeps scope alive", () => {
  const heap = new V8Heap(32 * 1024 * 1024);

  const closedOver = createObject();
  setProperty(closedOver, "data", createNumber(99));
  const closedId = heap.allocate(closedOver);

  const scope = {
    bindings: new Map<string, JSValue>([["captured", closedOver]]),
    outer: null,
  };

  const fn = createFunction("myClosure", "return captured;", 0, scope);
  const fnId = heap.allocate(fn);
  heap.addRoot(fnId);

  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(fnId), true);
  assertEquals(heap.hasObject(closedId), true, "closed-over object should survive via scope");
});

Deno.test("GC traversal - nested scope chain traversal", () => {
  const heap = new V8Heap();

  const innerObj = createObject();
  setProperty(innerObj, "x", createNumber(1));
  const innerObjId = heap.allocate(innerObj);

  const outerScope = {
    bindings: new Map<string, JSValue>([["outerVar", innerObj]]),
    outer: null,
  };
  const innerScope = {
    bindings: new Map<string, JSValue>(),
    outer: outerScope,
  };

  const fn = createFunction("nested", "return outerVar;", 0, innerScope);
  const fnId = heap.allocate(fn);
  heap.addRoot(fnId);

  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(fnId), true);
  assertEquals(heap.hasObject(innerObjId), true, "object in outer scope should survive");
});

Deno.test("GC traversal - multiple roots keep separate graphs alive", () => {
  const heap = new V8Heap();

  const a = createObject();
  setProperty(a, "val", createNumber(1));
  const aId = heap.allocate(a);
  heap.addRoot(aId);

  const b = createObject();
  setProperty(b, "val", createNumber(2));
  const bId = heap.allocate(b);
  heap.addRoot(bId);

  const orphan = createObject();
  const orphanId = heap.allocate(orphan);

  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(aId), true);
  assertEquals(heap.hasObject(bId), true);
  assertEquals(heap.hasObject(orphanId), false, "orphan should be collected");
});

Deno.test("GC traversal - removing root makes object collectible", () => {
  const heap = new V8Heap();
  const obj = createObject();
  const id = heap.allocate(obj);
  heap.addRoot(id);

  // First GC — object survives
  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(id), true);

  // After scavenge, object is promoted to old gen; now remove root and mark-sweep
  heap.removeRoot(id);
  heap.forceGC(GCType.MARK_SWEEP);
  assertEquals(heap.hasObject(id), false);
});

Deno.test("GC traversal - constructor reference keeps constructor alive", () => {
  const heap = new V8Heap();

  const ctorFn = createFunction("MyClass", "", 0, null);
  const ctorId = heap.allocate(ctorFn);

  const instance: JSValue = {
    type: JSValueType.OBJECT,
    value: {
      properties: new Map(),
      prototype: null,
      extensible: true,
      constructor: ctorFn.value,
    } as JSObject,
  };
  const instanceId = heap.allocate(instance);
  heap.addRoot(instanceId);

  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(instanceId), true);
  assertEquals(heap.hasObject(ctorId), true, "constructor should survive via instance reference");
});

Deno.test("GC traversal - primitive-only properties don't break traversal", () => {
  const heap = new V8Heap();
  const obj = createObject();
  setProperty(obj, "str", createString("hello"));
  setProperty(obj, "num", createNumber(42));
  setProperty(obj, "undef", createUndefined());
  const id = heap.allocate(obj);
  heap.addRoot(id);

  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(id), true);
});
