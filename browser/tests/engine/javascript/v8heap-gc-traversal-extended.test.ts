/**
 * Extended functional tests for V8Heap GC traversal — markChildren() and markEnvironment()
 *
 * Covers complex object graphs, multi-generation GC, stats verification,
 * scope chains with objects, and stress testing graph traversal.
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
import { GCType, V8Heap } from "../../../src/engine/javascript/V8Heap.ts";

// ── Property traversal ─────────────────────────────────────────────

Deno.test("GC - property chain: A→B→C→D all survive when A is root", () => {
  const heap = new V8Heap();
  const d = createObject();
  setProperty(d, "val", createString("leaf"));
  const dId = heap.allocate(d);

  const c = createObject();
  setProperty(c, "d", d);
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
  assertEquals(heap.hasObject(dId), true);
});

Deno.test("GC - object with many properties each referencing unique objects", () => {
  const heap = new V8Heap();
  const childIds: string[] = [];
  const parent = createObject();

  for (let i = 0; i < 20; i++) {
    const child = createObject();
    setProperty(child, "index", createNumber(i));
    const childId = heap.allocate(child);
    childIds.push(childId);
    setProperty(parent, `child${i}`, child);
  }
  const parentId = heap.allocate(parent);
  heap.addRoot(parentId);
  heap.forceGC(GCType.SCAVENGE);

  assertEquals(heap.hasObject(parentId), true);
  for (const cid of childIds) {
    assertEquals(heap.hasObject(cid), true, `child ${cid} should survive`);
  }
});

Deno.test("GC - shared child referenced by two parents, only one rooted", () => {
  const heap = new V8Heap();
  const shared = createObject();
  setProperty(shared, "data", createNumber(99));
  const sharedId = heap.allocate(shared);

  const rootParent = createObject();
  setProperty(rootParent, "ref", shared);
  const rootId = heap.allocate(rootParent);
  heap.addRoot(rootId);

  const orphanParent = createObject();
  setProperty(orphanParent, "ref", shared);
  const orphanId = heap.allocate(orphanParent);
  // orphanParent is NOT rooted

  heap.forceGC(GCType.SCAVENGE);

  assertEquals(heap.hasObject(rootId), true);
  assertEquals(heap.hasObject(sharedId), true, "shared survives via rootParent");
  assertEquals(heap.hasObject(orphanId), false, "orphanParent collected");
});

// ── Prototype chain traversal ───────────────────────────────────────

Deno.test("GC - multi-level prototype chain", () => {
  const heap = new V8Heap();

  const grandProto: JSValue = {
    type: JSValueType.OBJECT,
    value: {
      properties: new Map([["level", createNumber(0)]]),
      prototype: null,
      extensible: true,
    } as JSObject,
  };
  const gpId = heap.allocate(grandProto);

  const proto: JSValue = {
    type: JSValueType.OBJECT,
    value: {
      properties: new Map([["level", createNumber(1)]]),
      prototype: grandProto.value as JSObject,
      extensible: true,
    } as JSObject,
  };
  const pId = heap.allocate(proto);

  const obj: JSValue = {
    type: JSValueType.OBJECT,
    value: {
      properties: new Map([["level", createNumber(2)]]),
      prototype: proto.value as JSObject,
      extensible: true,
    } as JSObject,
  };
  const oId = heap.allocate(obj);
  heap.addRoot(oId);

  heap.forceGC(GCType.SCAVENGE);

  assertEquals(heap.hasObject(oId), true);
  assertEquals(heap.hasObject(pId), true);
  assertEquals(heap.hasObject(gpId), true);
});

Deno.test("GC - prototype with its own object properties", () => {
  const heap = new V8Heap();

  const protoChild = createObject();
  setProperty(protoChild, "x", createNumber(1));
  const protoChildId = heap.allocate(protoChild);

  const proto: JSValue = {
    type: JSValueType.OBJECT,
    value: {
      properties: new Map<string | symbol, JSValue>([["child", protoChild]]),
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
  assertEquals(heap.hasObject(protoId), true);
  assertEquals(heap.hasObject(protoChildId), true, "proto's property child survives");
});

// ── Constructor reference ───────────────────────────────────────────

Deno.test("GC - constructor with prototype chain keeps all alive", () => {
  const heap = new V8Heap();

  const ctorProto: JSValue = {
    type: JSValueType.OBJECT,
    value: {
      properties: new Map([["type", createString("base")]]),
      prototype: null,
      extensible: true,
    } as JSObject,
  };
  const ctorProtoId = heap.allocate(ctorProto);

  const ctor = createFunction("Klass", "", 0, null);
  (ctor.value as JSFunction).prototype = ctorProto.value as JSObject;
  const ctorId = heap.allocate(ctor);

  const instance: JSValue = {
    type: JSValueType.OBJECT,
    value: {
      properties: new Map([["instanceProp", createNumber(1)]]),
      prototype: null,
      extensible: true,
      constructor: ctor.value as JSFunction,
    } as JSObject,
  };
  const instanceId = heap.allocate(instance);
  heap.addRoot(instanceId);

  heap.forceGC(GCType.SCAVENGE);

  assertEquals(heap.hasObject(instanceId), true);
  assertEquals(heap.hasObject(ctorId), true, "constructor survives");
  assertEquals(heap.hasObject(ctorProtoId), true, "constructor's prototype survives");
});

// ── Closure / scope chain traversal ─────────────────────────────────

Deno.test("GC - three-level scope chain", () => {
  const heap = new V8Heap();

  const obj1 = createObject();
  setProperty(obj1, "a", createNumber(1));
  const id1 = heap.allocate(obj1);

  const obj2 = createObject();
  setProperty(obj2, "b", createNumber(2));
  const id2 = heap.allocate(obj2);

  const obj3 = createObject();
  setProperty(obj3, "c", createNumber(3));
  const id3 = heap.allocate(obj3);

  const scope1: Environment = {
    bindings: new Map([["x", obj1]]),
    outer: null,
  };
  const scope2: Environment = {
    bindings: new Map([["y", obj2]]),
    outer: scope1,
  };
  const scope3: Environment = {
    bindings: new Map([["z", obj3]]),
    outer: scope2,
  };

  const fn = createFunction("deepClosure", "", 0, scope3);
  const fnId = heap.allocate(fn);
  heap.addRoot(fnId);

  heap.forceGC(GCType.SCAVENGE);

  assertEquals(heap.hasObject(fnId), true);
  assertEquals(heap.hasObject(id1), true, "obj in outermost scope survives");
  assertEquals(heap.hasObject(id2), true, "obj in middle scope survives");
  assertEquals(heap.hasObject(id3), true, "obj in innermost scope survives");
});

Deno.test("GC - scope binding references another function", () => {
  const heap = new V8Heap();

  const innerFn = createFunction("inner", "", 0, null);
  const innerFnId = heap.allocate(innerFn);

  const scope: Environment = {
    bindings: new Map([["callback", innerFn]]),
    outer: null,
  };

  const outerFn = createFunction("outer", "", 0, scope);
  const outerFnId = heap.allocate(outerFn);
  heap.addRoot(outerFnId);

  heap.forceGC(GCType.SCAVENGE);

  assertEquals(heap.hasObject(outerFnId), true);
  assertEquals(heap.hasObject(innerFnId), true, "function in scope survives");
});

Deno.test("GC - scope with primitive bindings does not break", () => {
  const heap = new V8Heap();

  const scope: Environment = {
    bindings: new Map<string, JSValue>([
      ["count", createNumber(10)],
      ["name", createString("test")],
      ["flag", { type: JSValueType.BOOLEAN, value: true }],
    ]),
    outer: null,
  };

  const fn = createFunction("primScope", "", 0, scope);
  const fnId = heap.allocate(fn);
  heap.addRoot(fnId);

  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(fnId), true);
});

// ── Circular references in GC ───────────────────────────────────────

Deno.test("GC - three-way cycle all survive when one is rooted", () => {
  const heap = new V8Heap();
  const a = createObject();
  const b = createObject();
  const c = createObject();
  setProperty(a, "next", b);
  setProperty(b, "next", c);
  setProperty(c, "next", a);

  const aId = heap.allocate(a);
  const bId = heap.allocate(b);
  const cId = heap.allocate(c);
  heap.addRoot(aId);

  heap.forceGC(GCType.SCAVENGE);

  assertEquals(heap.hasObject(aId), true);
  assertEquals(heap.hasObject(bId), true);
  assertEquals(heap.hasObject(cId), true);
});

Deno.test("GC - circular in scope chain (scope referencing obj that closes over scope)", () => {
  const heap = new V8Heap();

  const obj = createObject();
  const objId = heap.allocate(obj);

  // scope references obj, and obj has a function property whose scope is... this scope
  const scope: Environment = {
    bindings: new Map([["data", obj]]),
    outer: null,
  };

  const fn = createFunction("recursive", "", 0, scope);
  const fnId = heap.allocate(fn);
  setProperty(obj, "handler", fn);

  heap.addRoot(objId);

  heap.forceGC(GCType.SCAVENGE);

  assertEquals(heap.hasObject(objId), true);
  assertEquals(heap.hasObject(fnId), true, "function in circular scope/property survives");
});

// ── Multi-generation GC ─────────────────────────────────────────────

Deno.test("GC - promoted objects survive mark-sweep via property references", () => {
  const heap = new V8Heap();

  const child = createObject();
  setProperty(child, "data", createString("important"));
  const childId = heap.allocate(child);

  const parent = createObject();
  setProperty(parent, "child", child);
  const parentId = heap.allocate(parent);
  heap.addRoot(parentId);

  // Scavenge promotes both to old generation
  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(parentId), true);
  assertEquals(heap.hasObject(childId), true);

  // Mark-sweep on old generation — both should still survive
  heap.forceGC(GCType.MARK_SWEEP);
  assertEquals(heap.hasObject(parentId), true);
  assertEquals(heap.hasObject(childId), true, "child survives mark-sweep via parent");
});

Deno.test("GC - promoted orphan collected by mark-sweep", () => {
  const heap = new V8Heap();

  const obj = createObject();
  const id = heap.allocate(obj);
  heap.addRoot(id);

  // Promote to old gen
  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(id), true);

  // Remove root and sweep old gen
  heap.removeRoot(id);
  heap.forceGC(GCType.MARK_SWEEP);
  assertEquals(heap.hasObject(id), false, "unrooted old-gen object collected");
});

Deno.test("GC - scavenge then mark-sweep preserves deep graph", () => {
  const heap = new V8Heap();

  const leaf = createObject();
  setProperty(leaf, "x", createNumber(1));
  const leafId = heap.allocate(leaf);

  const mid = createObject();
  setProperty(mid, "leaf", leaf);
  const midId = heap.allocate(mid);

  const root = createObject();
  setProperty(root, "mid", mid);
  const rootId = heap.allocate(root);
  heap.addRoot(rootId);

  // Promote to old gen
  heap.forceGC(GCType.SCAVENGE);
  // Sweep old gen
  heap.forceGC(GCType.MARK_SWEEP);

  assertEquals(heap.hasObject(rootId), true);
  assertEquals(heap.hasObject(midId), true);
  assertEquals(heap.hasObject(leafId), true);
});

// ── GC stats verification ───────────────────────────────────────────

Deno.test("GC - stats reflect collected objects count", () => {
  const heap = new V8Heap();

  // Allocate 5 objects, root only 2
  const ids: string[] = [];
  for (let i = 0; i < 5; i++) {
    const obj = createObject();
    setProperty(obj, "i", createNumber(i));
    ids.push(heap.allocate(obj));
  }
  heap.addRoot(ids[0]);
  heap.addRoot(ids[1]);

  const statsBefore = heap.getStats();
  assertEquals(statsBefore.objectCount, 5);

  heap.forceGC(GCType.SCAVENGE);

  const statsAfter = heap.getStats();
  // 3 unreachable objects should have been collected
  assertEquals(statsAfter.gcStats.objectsCollected, 3);
  assertEquals(statsAfter.gcStats.scavengeCount, 1);
  assertEquals(statsAfter.gcStats.totalCollections, 1);
});

Deno.test("GC - stats track bytes reclaimed", () => {
  const heap = new V8Heap();

  const obj = createObject();
  setProperty(obj, "data", createString("x".repeat(100)));
  heap.allocate(obj);
  // Not rooted

  heap.forceGC(GCType.SCAVENGE);

  const stats = heap.getStats();
  assertNotEquals(stats.gcStats.bytesReclaimed, 0, "should reclaim bytes");
});

Deno.test("GC - multiple GC cycles accumulate stats", () => {
  const heap = new V8Heap();

  // First cycle
  const obj1 = createObject();
  heap.allocate(obj1);
  heap.forceGC(GCType.SCAVENGE);

  // Second cycle — allocate in young gen again
  const obj2 = createObject();
  heap.allocate(obj2);
  heap.forceGC(GCType.SCAVENGE);

  const stats = heap.getStats();
  assertEquals(stats.gcStats.scavengeCount, 2);
  assertEquals(stats.gcStats.totalCollections, 2);
  assertEquals(stats.gcStats.objectsCollected, 2);
});

// ── Edge cases ──────────────────────────────────────────────────────

Deno.test("GC - object with only primitive properties — no traversal crash", () => {
  const heap = new V8Heap();
  const obj = createObject();
  setProperty(obj, "a", createNumber(1));
  setProperty(obj, "b", createString("s"));
  setProperty(obj, "c", { type: JSValueType.BOOLEAN, value: true } as JSValue);
  setProperty(obj, "d", createUndefined());
  setProperty(obj, "e", { type: JSValueType.NULL } as JSValue);
  const id = heap.allocate(obj);
  heap.addRoot(id);
  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(id), true);
});

Deno.test("GC - empty object survives and is collected correctly", () => {
  const heap = new V8Heap();
  const obj = createObject();
  const id = heap.allocate(obj);
  heap.addRoot(id);
  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(id), true);
  heap.removeRoot(id);
  heap.forceGC(GCType.MARK_SWEEP);
  assertEquals(heap.hasObject(id), false);
});

Deno.test("GC - function with no scope does not crash", () => {
  const heap = new V8Heap();
  const fn = createFunction("noScope", "", 0, null);
  const fnId = heap.allocate(fn);
  heap.addRoot(fnId);
  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(fnId), true);
});

Deno.test("GC - native function survives GC", () => {
  const heap = new V8Heap();
  const fn = createNativeFunction("log", () => createUndefined(), 0);
  const fnId = heap.allocate(fn);
  heap.addRoot(fnId);
  heap.forceGC(GCType.SCAVENGE);
  assertEquals(heap.hasObject(fnId), true);
});

Deno.test("GC - adding and removing many roots", () => {
  const heap = new V8Heap();
  const ids: string[] = [];
  for (let i = 0; i < 10; i++) {
    const obj = createObject();
    setProperty(obj, "i", createNumber(i));
    const id = heap.allocate(obj);
    ids.push(id);
    heap.addRoot(id);
  }

  // Remove half the roots
  for (let i = 0; i < 5; i++) {
    heap.removeRoot(ids[i]);
  }

  // But the removed ones are still in young gen with other rooted objects
  // referencing nothing — scavenge should collect the unrooted ones
  heap.forceGC(GCType.SCAVENGE);

  for (let i = 0; i < 5; i++) {
    assertEquals(heap.hasObject(ids[i]), false, `unrooted ${i} collected`);
  }
  for (let i = 5; i < 10; i++) {
    assertEquals(heap.hasObject(ids[i]), true, `rooted ${i} survives`);
  }
});

// ── Stress: wide and deep graphs ────────────────────────────────────

Deno.test("GC - wide object graph (50 children)", () => {
  const heap = new V8Heap();
  const parent = createObject();
  const childIds: string[] = [];

  for (let i = 0; i < 50; i++) {
    const child = createObject();
    setProperty(child, "i", createNumber(i));
    const cid = heap.allocate(child);
    childIds.push(cid);
    setProperty(parent, `c${i}`, child);
  }

  const parentId = heap.allocate(parent);
  heap.addRoot(parentId);
  heap.forceGC(GCType.SCAVENGE);

  assertEquals(heap.hasObject(parentId), true);
  for (const cid of childIds) {
    assertEquals(heap.hasObject(cid), true);
  }
});

Deno.test("GC - deep linked list (30 nodes)", () => {
  const heap = new V8Heap();
  const nodeIds: string[] = [];

  let prev = createObject();
  setProperty(prev, "val", createNumber(0));
  let prevId = heap.allocate(prev);
  nodeIds.push(prevId);

  for (let i = 1; i < 30; i++) {
    const node = createObject();
    setProperty(node, "val", createNumber(i));
    setProperty(node, "next", prev);
    const nid = heap.allocate(node);
    nodeIds.push(nid);
    prev = node;
    prevId = nid;
  }

  // Root the head (last created)
  heap.addRoot(prevId);
  heap.forceGC(GCType.SCAVENGE);

  for (const nid of nodeIds) {
    assertEquals(heap.hasObject(nid), true, `node ${nid} survives via linked list`);
  }
});
