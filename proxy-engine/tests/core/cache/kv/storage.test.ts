/**
 * MemoryStorage Tests
 * Comprehensive tests for MemoryStorage
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { MemoryStorage } from "../../../../core/cache/kv/storage.ts";

// ============================================================================
// Constructor / Initialization Tests
// ============================================================================

Deno.test({
  name: "MemoryStorage - constructor creates empty store",
  async fn() {
    const store = new MemoryStorage();
    const keys = await store.keys();
    assertEquals(keys.length, 0);
  },
});

Deno.test({
  name: "MemoryStorage - constructor initializes byte size to zero",
  async fn() {
    const store = new MemoryStorage();
    const byteSize = await store.size();
    assertEquals(byteSize, 0);
  },
});

Deno.test({
  name: "MemoryStorage - constructor accepts custom maxBytes",
  async fn() {
    const store = new MemoryStorage(1024);
    const stats = store.getStats();
    assertEquals(stats.maxBytes, 1024);
  },
});

// ============================================================================
// set() and get() Tests
// ============================================================================

Deno.test({
  name: "MemoryStorage - set() and get() basic round-trip",
  async fn() {
    const store = new MemoryStorage();
    const value = new Uint8Array([1, 2, 3, 4]);
    await store.set("key1", value);
    const retrieved = await store.get("key1");
    assertExists(retrieved);
    assertEquals(retrieved, value);
  },
});

Deno.test({
  name: "MemoryStorage - get() returns null for missing key",
  async fn() {
    const store = new MemoryStorage();
    const result = await store.get("nonexistent");
    assertEquals(result, null);
  },
});

Deno.test({
  name: "MemoryStorage - set() overwrites existing value for same key",
  async fn() {
    const store = new MemoryStorage();
    const first = new Uint8Array([1, 2, 3]);
    const second = new Uint8Array([4, 5, 6, 7]);
    await store.set("key", first);
    await store.set("key", second);
    const retrieved = await store.get("key");
    assertExists(retrieved);
    assertEquals(retrieved, second);
  },
});

Deno.test({
  name: "MemoryStorage - set() preserves byte-exact data",
  async fn() {
    const store = new MemoryStorage();
    const value = new Uint8Array([0, 127, 128, 255]);
    await store.set("bytes", value);
    const retrieved = await store.get("bytes");
    assertExists(retrieved);
    assertEquals(retrieved![0], 0);
    assertEquals(retrieved![1], 127);
    assertEquals(retrieved![2], 128);
    assertEquals(retrieved![3], 255);
  },
});

Deno.test({
  name: "MemoryStorage - set() multiple keys independently",
  async fn() {
    const store = new MemoryStorage();
    const a = new Uint8Array([1]);
    const b = new Uint8Array([2]);
    await store.set("a", a);
    await store.set("b", b);
    assertEquals(await store.get("a"), a);
    assertEquals(await store.get("b"), b);
  },
});

// ============================================================================
// has() Tests
// ============================================================================

Deno.test({
  name: "MemoryStorage - has() returns true after set()",
  async fn() {
    const store = new MemoryStorage();
    await store.set("k", new Uint8Array([1]));
    const result = await store.has("k");
    assertEquals(result, true);
  },
});

Deno.test({
  name: "MemoryStorage - has() returns false for missing key",
  async fn() {
    const store = new MemoryStorage();
    const result = await store.has("missing");
    assertEquals(result, false);
  },
});

Deno.test({
  name: "MemoryStorage - has() returns false after delete()",
  async fn() {
    const store = new MemoryStorage();
    await store.set("k", new Uint8Array([1]));
    await store.delete("k");
    const result = await store.has("k");
    assertEquals(result, false);
  },
});

// ============================================================================
// delete() Tests
// ============================================================================

Deno.test({
  name: "MemoryStorage - delete() removes existing key",
  async fn() {
    const store = new MemoryStorage();
    await store.set("k", new Uint8Array([10, 20]));
    await store.delete("k");
    const result = await store.get("k");
    assertEquals(result, null);
  },
});

Deno.test({
  name: "MemoryStorage - delete() on missing key does not throw",
  async fn() {
    const store = new MemoryStorage();
    // Should complete without error
    await store.delete("nonexistent");
    const keys = await store.keys();
    assertEquals(keys.length, 0);
  },
});

Deno.test({
  name: "MemoryStorage - delete() decreases byte size",
  async fn() {
    const store = new MemoryStorage();
    const value = new Uint8Array([1, 2, 3, 4, 5]);
    await store.set("k", value);
    const sizeAfterSet = await store.size();
    assertEquals(sizeAfterSet, 5);
    await store.delete("k");
    const sizeAfterDelete = await store.size();
    assertEquals(sizeAfterDelete, 0);
  },
});

// ============================================================================
// keys() Tests
// ============================================================================

Deno.test({
  name: "MemoryStorage - keys() returns empty array when store is empty",
  async fn() {
    const store = new MemoryStorage();
    const keys = await store.keys();
    assertEquals(keys, []);
  },
});

Deno.test({
  name: "MemoryStorage - keys() returns all inserted keys",
  async fn() {
    const store = new MemoryStorage();
    await store.set("alpha", new Uint8Array([1]));
    await store.set("beta", new Uint8Array([2]));
    await store.set("gamma", new Uint8Array([3]));
    const keys = await store.keys();
    assertEquals(keys.length, 3);
    assert(keys.includes("alpha"));
    assert(keys.includes("beta"));
    assert(keys.includes("gamma"));
  },
});

Deno.test({
  name: "MemoryStorage - keys() does not include deleted key",
  async fn() {
    const store = new MemoryStorage();
    await store.set("keep", new Uint8Array([1]));
    await store.set("remove", new Uint8Array([2]));
    await store.delete("remove");
    const keys = await store.keys();
    assertEquals(keys.length, 1);
    assert(keys.includes("keep"));
    assert(!keys.includes("remove"));
  },
});

// ============================================================================
// size() Tests
// ============================================================================

Deno.test({
  name: "MemoryStorage - size() tracks byte count of stored values",
  async fn() {
    const store = new MemoryStorage();
    await store.set("k1", new Uint8Array(10));
    await store.set("k2", new Uint8Array(20));
    const byteSize = await store.size();
    assertEquals(byteSize, 30);
  },
});

Deno.test({
  name: "MemoryStorage - size() updates correctly when overwriting a key with larger value",
  async fn() {
    const store = new MemoryStorage();
    await store.set("k", new Uint8Array(5));
    await store.set("k", new Uint8Array(15));
    const byteSize = await store.size();
    assertEquals(byteSize, 15);
  },
});

Deno.test({
  name: "MemoryStorage - size() updates correctly when overwriting a key with smaller value",
  async fn() {
    const store = new MemoryStorage();
    await store.set("k", new Uint8Array(20));
    await store.set("k", new Uint8Array(5));
    const byteSize = await store.size();
    assertEquals(byteSize, 5);
  },
});

// ============================================================================
// clear() Tests
// ============================================================================

Deno.test({
  name: "MemoryStorage - clear() removes all keys",
  async fn() {
    const store = new MemoryStorage();
    await store.set("a", new Uint8Array([1]));
    await store.set("b", new Uint8Array([2]));
    await store.clear();
    const keys = await store.keys();
    assertEquals(keys.length, 0);
  },
});

Deno.test({
  name: "MemoryStorage - clear() resets byte size to zero",
  async fn() {
    const store = new MemoryStorage();
    await store.set("a", new Uint8Array(100));
    await store.clear();
    const byteSize = await store.size();
    assertEquals(byteSize, 0);
  },
});

Deno.test({
  name: "MemoryStorage - clear() allows re-use after clearing",
  async fn() {
    const store = new MemoryStorage();
    await store.set("k", new Uint8Array([9]));
    await store.clear();
    await store.set("k", new Uint8Array([42]));
    const result = await store.get("k");
    assertExists(result);
    assertEquals(result![0], 42);
  },
});

// ============================================================================
// getStats() Tests
// ============================================================================

Deno.test({
  name: "MemoryStorage - getStats() returns correct entry count",
  async fn() {
    const store = new MemoryStorage();
    await store.set("a", new Uint8Array([1]));
    await store.set("b", new Uint8Array([2]));
    const stats = store.getStats();
    assertEquals(stats.entries, 2);
  },
});

Deno.test({
  name: "MemoryStorage - getStats() returns correct byte count",
  async fn() {
    const store = new MemoryStorage();
    await store.set("k", new Uint8Array(50));
    const stats = store.getStats();
    assertEquals(stats.bytes, 50);
  },
});

Deno.test({
  name: "MemoryStorage - getStats() returns maxBytes as configured",
  async fn() {
    const store = new MemoryStorage(2048);
    const stats = store.getStats();
    assertEquals(stats.maxBytes, 2048);
  },
});

Deno.test({
  name: "MemoryStorage - getStats() returns utilization as percentage string",
  async fn() {
    const store = new MemoryStorage(1000);
    await store.set("k", new Uint8Array(500));
    const stats = store.getStats();
    assertExists(stats.utilization);
    assert(stats.utilization.endsWith("%"));
    assertEquals(stats.utilization, "50.00%");
  },
});

// ============================================================================
// LRU / Capacity Eviction Tests
// ============================================================================

Deno.test({
  name: "MemoryStorage - evicts first entry when capacity is exceeded",
  async fn() {
    // Create store with capacity of exactly 10 bytes
    const store = new MemoryStorage(10);
    await store.set("first", new Uint8Array(5));
    await store.set("second", new Uint8Array(5));
    // Now at capacity; adding 5 more bytes should trigger eviction of "first"
    await store.set("third", new Uint8Array(5));
    const hasFirst = await store.has("first");
    assertEquals(hasFirst, false);
  },
});

Deno.test({
  name: "MemoryStorage - new entry is accessible after eviction",
  async fn() {
    const store = new MemoryStorage(10);
    await store.set("first", new Uint8Array(5));
    await store.set("second", new Uint8Array(5));
    // Trigger eviction
    await store.set("third", new Uint8Array(5));
    const result = await store.get("third");
    assertExists(result);
    assertEquals(result!.length, 5);
  },
});

Deno.test({
  name: "MemoryStorage - byte size stays within bounds after eviction",
  async fn() {
    const store = new MemoryStorage(10);
    await store.set("first", new Uint8Array(5));
    await store.set("second", new Uint8Array(5));
    // Evicts "first" (5 bytes), then stores "third" (5 bytes)
    await store.set("third", new Uint8Array(5));
    const byteSize = await store.size();
    // "second" (5) + "third" (5) = 10
    assertEquals(byteSize, 10);
  },
});

Deno.test({
  name: "MemoryStorage - LRU: accessed item survives eviction while unaccessed item is evicted",
  async fn() {
    const store = new MemoryStorage(10);
    await store.set("first", new Uint8Array(5));
    await store.set("second", new Uint8Array(5));
    // Access "first" so it becomes most-recently-used
    await store.get("first");
    // Trigger eviction — should evict "second" (least recently used), not "first"
    await store.set("third", new Uint8Array(5));
    assertEquals(await store.has("first"), true);
    assertEquals(await store.has("second"), false);
    assertEquals(await store.has("third"), true);
  },
});

Deno.test({
  name: "MemoryStorage - LRU: multiple accesses keep item alive",
  async fn() {
    const store = new MemoryStorage(15);
    await store.set("a", new Uint8Array(5));
    await store.set("b", new Uint8Array(5));
    await store.set("c", new Uint8Array(5));
    // Access "a" multiple times — it should be most-recently-used
    await store.get("a");
    await store.get("a");
    // Trigger eviction — should evict "b" (oldest access), not "a"
    await store.set("d", new Uint8Array(5));
    assertEquals(await store.has("a"), true);
    assertEquals(await store.has("b"), false);
    assertEquals(await store.has("c"), true);
    assertEquals(await store.has("d"), true);
  },
});

Deno.test({
  name: "MemoryStorage - LRU: eviction targets oldest access time not oldest insertion",
  async fn() {
    const store = new MemoryStorage(10);
    await store.set("old", new Uint8Array(5));
    await store.set("new", new Uint8Array(5));
    // Access "old" making it more recent than "new"
    await store.get("old");
    // Trigger eviction — "new" has older access time despite later insertion
    await store.set("newest", new Uint8Array(5));
    assertEquals(await store.has("old"), true);
    assertEquals(await store.has("new"), false);
    assertEquals(await store.has("newest"), true);
  },
});
