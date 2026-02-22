/**
 * IDBObjectStore query/filtering tests
 * Tests matchesQuery(), compareKeys(), IDBKeyRange
 */

import { assert, assertEquals } from "@std/assert";
import { IDBKeyRangeImpl, IDBObjectStoreImpl } from "../../../src/engine/storage/IDBObjectStore.ts";

// Helper: create and populate a store
async function createPopulatedStore(): Promise<IDBObjectStoreImpl> {
  const store = new IDBObjectStoreImpl("test", { keyPath: null, autoIncrement: false });
  await store.put("Alice", 1);
  await store.put("Bob", 2);
  await store.put("Charlie", 3);
  await store.put("Diana", 4);
  await store.put("Eve", 5);
  return store;
}

// =============================================================================
// IDBKeyRange
// =============================================================================

Deno.test("IDBKeyRange.only - matches exact key", () => {
  const range = IDBKeyRangeImpl.only(3);
  assertEquals(range.includes(3), true);
  assertEquals(range.includes(2), false);
  assertEquals(range.includes(4), false);
});

Deno.test("IDBKeyRange.only - string key", () => {
  const range = IDBKeyRangeImpl.only("hello");
  assertEquals(range.includes("hello"), true);
  assertEquals(range.includes("world"), false);
});

Deno.test("IDBKeyRange.lowerBound - closed (inclusive)", () => {
  const range = IDBKeyRangeImpl.lowerBound(3);
  assertEquals(range.includes(2), false);
  assertEquals(range.includes(3), true);
  assertEquals(range.includes(4), true);
  assertEquals(range.includes(100), true);
});

Deno.test("IDBKeyRange.lowerBound - open (exclusive)", () => {
  const range = IDBKeyRangeImpl.lowerBound(3, true);
  assertEquals(range.includes(3), false);
  assertEquals(range.includes(4), true);
});

Deno.test("IDBKeyRange.upperBound - closed (inclusive)", () => {
  const range = IDBKeyRangeImpl.upperBound(3);
  assertEquals(range.includes(1), true);
  assertEquals(range.includes(3), true);
  assertEquals(range.includes(4), false);
});

Deno.test("IDBKeyRange.upperBound - open (exclusive)", () => {
  const range = IDBKeyRangeImpl.upperBound(3, true);
  assertEquals(range.includes(3), false);
  assertEquals(range.includes(2), true);
});

Deno.test("IDBKeyRange.bound - closed/closed", () => {
  const range = IDBKeyRangeImpl.bound(2, 4);
  assertEquals(range.includes(1), false);
  assertEquals(range.includes(2), true);
  assertEquals(range.includes(3), true);
  assertEquals(range.includes(4), true);
  assertEquals(range.includes(5), false);
});

Deno.test("IDBKeyRange.bound - open/open", () => {
  const range = IDBKeyRangeImpl.bound(2, 4, true, true);
  assertEquals(range.includes(2), false);
  assertEquals(range.includes(3), true);
  assertEquals(range.includes(4), false);
});

Deno.test("IDBKeyRange.bound - open/closed", () => {
  const range = IDBKeyRangeImpl.bound(2, 4, true, false);
  assertEquals(range.includes(2), false);
  assertEquals(range.includes(3), true);
  assertEquals(range.includes(4), true);
});

Deno.test("IDBKeyRange.bound - closed/open", () => {
  const range = IDBKeyRangeImpl.bound(2, 4, false, true);
  assertEquals(range.includes(2), true);
  assertEquals(range.includes(3), true);
  assertEquals(range.includes(4), false);
});

// =============================================================================
// compareKeys
// =============================================================================

Deno.test("compareKeys - numbers", () => {
  assertEquals(IDBObjectStoreImpl.compareKeys(1, 2), -1);
  assertEquals(IDBObjectStoreImpl.compareKeys(2, 1), 1);
  assertEquals(IDBObjectStoreImpl.compareKeys(3, 3), 0);
});

Deno.test("compareKeys - strings", () => {
  assertEquals(IDBObjectStoreImpl.compareKeys("a", "b"), -1);
  assertEquals(IDBObjectStoreImpl.compareKeys("b", "a"), 1);
  assertEquals(IDBObjectStoreImpl.compareKeys("abc", "abc"), 0);
});

Deno.test("compareKeys - dates", () => {
  const d1 = new Date(2020, 0, 1);
  const d2 = new Date(2021, 0, 1);
  assertEquals(IDBObjectStoreImpl.compareKeys(d1, d2), -1);
  assertEquals(IDBObjectStoreImpl.compareKeys(d2, d1), 1);
  assertEquals(IDBObjectStoreImpl.compareKeys(d1, new Date(2020, 0, 1)), 0);
});

Deno.test("compareKeys - type ordering: number < Date < string < Array", () => {
  assert(IDBObjectStoreImpl.compareKeys(1, new Date()) < 0);
  assert(IDBObjectStoreImpl.compareKeys(new Date(), "hello") < 0);
  assert(IDBObjectStoreImpl.compareKeys("hello", [1]) < 0);
  assert(IDBObjectStoreImpl.compareKeys(1, "hello") < 0);
  assert(IDBObjectStoreImpl.compareKeys(1, [1]) < 0);
});

Deno.test("compareKeys - arrays (compound keys)", () => {
  assertEquals(IDBObjectStoreImpl.compareKeys([1, 2], [1, 2]), 0);
  assertEquals(IDBObjectStoreImpl.compareKeys([1, 2], [1, 3]), -1);
  assertEquals(IDBObjectStoreImpl.compareKeys([1, 2], [1, 1]), 1);
  assertEquals(IDBObjectStoreImpl.compareKeys([1], [1, 2]), -1); // shorter < longer
  assertEquals(IDBObjectStoreImpl.compareKeys([1, 2], [1]), 1);
});

Deno.test("compareKeys - undefined handling", () => {
  assertEquals(IDBObjectStoreImpl.compareKeys(undefined, undefined), 0);
  assertEquals(IDBObjectStoreImpl.compareKeys(undefined, 1), -1);
  assertEquals(IDBObjectStoreImpl.compareKeys(1, undefined), 1);
});

// =============================================================================
// getAll with query
// =============================================================================

Deno.test("getAll - no query returns all records", async () => {
  const store = await createPopulatedStore();
  const all = await store.getAll();
  assertEquals(all.length, 5);
});

Deno.test("getAll - exact key match", async () => {
  const store = await createPopulatedStore();
  const results = await store.getAll(3);
  assertEquals(results.length, 1);
  assertEquals(results[0], "Charlie");
});

Deno.test("getAll - IDBKeyRange.only", async () => {
  const store = await createPopulatedStore();
  const results = await store.getAll(IDBKeyRangeImpl.only(2));
  assertEquals(results.length, 1);
  assertEquals(results[0], "Bob");
});

Deno.test("getAll - IDBKeyRange.lowerBound", async () => {
  const store = await createPopulatedStore();
  const results = await store.getAll(IDBKeyRangeImpl.lowerBound(3));
  assertEquals(results.length, 3);
  assert(results.includes("Charlie"));
  assert(results.includes("Diana"));
  assert(results.includes("Eve"));
});

Deno.test("getAll - IDBKeyRange.upperBound", async () => {
  const store = await createPopulatedStore();
  const results = await store.getAll(IDBKeyRangeImpl.upperBound(2));
  assertEquals(results.length, 2);
  assert(results.includes("Alice"));
  assert(results.includes("Bob"));
});

Deno.test("getAll - IDBKeyRange.bound", async () => {
  const store = await createPopulatedStore();
  const results = await store.getAll(IDBKeyRangeImpl.bound(2, 4));
  assertEquals(results.length, 3);
  assert(results.includes("Bob"));
  assert(results.includes("Charlie"));
  assert(results.includes("Diana"));
});

Deno.test("getAll - with count limit", async () => {
  const store = await createPopulatedStore();
  const results = await store.getAll(IDBKeyRangeImpl.lowerBound(1), 2);
  assertEquals(results.length, 2);
});

Deno.test("getAll - no matches returns empty", async () => {
  const store = await createPopulatedStore();
  const results = await store.getAll(IDBKeyRangeImpl.bound(10, 20));
  assertEquals(results.length, 0);
});

// =============================================================================
// getAllKeys with query
// =============================================================================

Deno.test("getAllKeys - IDBKeyRange.bound", async () => {
  const store = await createPopulatedStore();
  const keys = await store.getAllKeys(IDBKeyRangeImpl.bound(2, 4));
  assertEquals(keys.length, 3);
  assert(keys.includes(2));
  assert(keys.includes(3));
  assert(keys.includes(4));
});

Deno.test("getAllKeys - exact key", async () => {
  const store = await createPopulatedStore();
  const keys = await store.getAllKeys(5);
  assertEquals(keys.length, 1);
  assertEquals(keys[0], 5);
});

// =============================================================================
// count with query
// =============================================================================

Deno.test("count - no query returns total", async () => {
  const store = await createPopulatedStore();
  assertEquals(await store.count(), 5);
});

Deno.test("count - with IDBKeyRange", async () => {
  const store = await createPopulatedStore();
  assertEquals(await store.count(IDBKeyRangeImpl.bound(2, 4)), 3);
});

Deno.test("count - exact key", async () => {
  const store = await createPopulatedStore();
  assertEquals(await store.count(3), 1);
});

Deno.test("count - no matches returns 0", async () => {
  const store = await createPopulatedStore();
  assertEquals(await store.count(99), 0);
});

// =============================================================================
// openCursor with query
// =============================================================================

Deno.test("openCursor - with range filters keys", async () => {
  const store = await createPopulatedStore();
  const cursor = await store.openCursor(IDBKeyRangeImpl.bound(2, 3));
  assert(cursor !== null);
  const keys: unknown[] = [];
  while (!cursor.done) {
    keys.push(cursor.key);
    cursor.continue();
  }
  assertEquals(keys.length, 2);
  assert(keys.includes(2));
  assert(keys.includes(3));
});

Deno.test("openCursor - no matches returns null", async () => {
  const store = await createPopulatedStore();
  const cursor = await store.openCursor(IDBKeyRangeImpl.bound(10, 20));
  assertEquals(cursor, null);
});

// =============================================================================
// String key store
// =============================================================================

Deno.test("string keys - exact match", async () => {
  const store = new IDBObjectStoreImpl("strings", { keyPath: null, autoIncrement: false });
  await store.put({ name: "Alice" }, "a");
  await store.put({ name: "Bob" }, "b");
  await store.put({ name: "Charlie" }, "c");

  const results = await store.getAll("b");
  assertEquals(results.length, 1);
  assertEquals((results[0] as any).name, "Bob");
});

Deno.test("string keys - range", async () => {
  const store = new IDBObjectStoreImpl("strings", { keyPath: null, autoIncrement: false });
  await store.put(1, "apple");
  await store.put(2, "banana");
  await store.put(3, "cherry");
  await store.put(4, "date");

  const results = await store.getAll(IDBKeyRangeImpl.bound("banana", "cherry"));
  assertEquals(results.length, 2);
});
