/**
 * StorageManager Tests
 *
 * Comprehensive test coverage for StorageManager class.
 * Tests localStorage, sessionStorage, quota enforcement, origin isolation,
 * storage events, and edge cases.
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { StorageManager } from "../../../src/engine/storage/StorageManager.ts";
import { QuotaManager } from "../../../src/engine/storage/QuotaManager.ts";
import {
  type StorageEvent,
  StorageEventEmitter,
} from "../../../src/engine/storage/StorageEvents.ts";

// ============================================================================
// Basic Operations
// ============================================================================

Deno.test("StorageManager - localStorage setItem/getItem", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  await storage.setItem("key", "value", "https://example.com");
  assertEquals(storage.getItem("key"), "value");
  assertEquals(storage.length, 1);
});

Deno.test("StorageManager - sessionStorage setItem/getItem", async () => {
  const manager = new StorageManager();
  const storage = manager.getSessionStorage("https://example.com");

  await storage.setItem("key", "value", "https://example.com");
  assertEquals(storage.getItem("key"), "value");
  assertEquals(storage.length, 1);
});

Deno.test("StorageManager - getItem returns null for non-existent key", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  assertEquals(storage.getItem("nonexistent"), null);
});

Deno.test("StorageManager - removeItem", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  await storage.setItem("key", "value", "https://example.com");
  assertEquals(storage.getItem("key"), "value");

  await storage.removeItem("key", "https://example.com");
  assertEquals(storage.getItem("key"), null);
  assertEquals(storage.length, 0);
});

Deno.test("StorageManager - removeItem non-existent key is safe", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  // Should not throw
  await storage.removeItem("nonexistent", "https://example.com");
  assertEquals(storage.length, 0);
});

Deno.test("StorageManager - clear method", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  await storage.setItem("key1", "value1", "https://example.com");
  await storage.setItem("key2", "value2", "https://example.com");
  await storage.setItem("key3", "value3", "https://example.com");
  assertEquals(storage.length, 3);

  await storage.clear("https://example.com");
  assertEquals(storage.length, 0);
  assertEquals(storage.getItem("key1"), null);
  assertEquals(storage.getItem("key2"), null);
  assertEquals(storage.getItem("key3"), null);
});

Deno.test("StorageManager - clear empty storage is safe", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  // Should not throw
  await storage.clear("https://example.com");
  assertEquals(storage.length, 0);
});

Deno.test("StorageManager - key method for iteration", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  await storage.setItem("key1", "value1", "https://example.com");
  await storage.setItem("key2", "value2", "https://example.com");
  await storage.setItem("key3", "value3", "https://example.com");

  // Keys should be retrievable by index
  assertExists(storage.key(0));
  assertExists(storage.key(1));
  assertExists(storage.key(2));

  // Out of bounds returns null
  assertEquals(storage.key(3), null);
  assertEquals(storage.key(-1), null);
});

Deno.test("StorageManager - updating existing key", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  await storage.setItem("key", "value1", "https://example.com");
  assertEquals(storage.getItem("key"), "value1");

  await storage.setItem("key", "value2", "https://example.com");
  assertEquals(storage.getItem("key"), "value2");
  assertEquals(storage.length, 1); // Should still be 1, not 2
});

// ============================================================================
// Origin Isolation
// ============================================================================

Deno.test("StorageManager - origin isolation for localStorage", async () => {
  const manager = new StorageManager();

  const storage1 = manager.getLocalStorage("https://example.com");
  const storage2 = manager.getLocalStorage("https://other.com");

  await storage1.setItem("key", "value1", "https://example.com");
  await storage2.setItem("key", "value2", "https://other.com");

  assertEquals(storage1.getItem("key"), "value1");
  assertEquals(storage2.getItem("key"), "value2");
  assertEquals(storage1.length, 1);
  assertEquals(storage2.length, 1);
});

Deno.test("StorageManager - origin isolation for sessionStorage", async () => {
  const manager = new StorageManager();

  const storage1 = manager.getSessionStorage("https://example.com");
  const storage2 = manager.getSessionStorage("https://other.com");

  await storage1.setItem("key", "value1", "https://example.com");
  await storage2.setItem("key", "value2", "https://other.com");

  assertEquals(storage1.getItem("key"), "value1");
  assertEquals(storage2.getItem("key"), "value2");
});

Deno.test("StorageManager - localStorage and sessionStorage are separate per origin", async () => {
  const manager = new StorageManager();

  const local = manager.getLocalStorage("https://example.com");
  const session = manager.getSessionStorage("https://example.com");

  await local.setItem("key", "localStorage", "https://example.com");
  await session.setItem("key", "sessionStorage", "https://example.com");

  assertEquals(local.getItem("key"), "localStorage");
  assertEquals(session.getItem("key"), "sessionStorage");
});

// ============================================================================
// Quota Enforcement
// ============================================================================

Deno.test("StorageManager - quota enforcement", async () => {
  // Create manager with small quota (100 bytes)
  const quotaManager = new QuotaManager(100, 1000);
  const manager = new StorageManager(quotaManager);
  const storage = manager.getLocalStorage("https://example.com");

  // Each character is 2 bytes (UTF-16), so "x".repeat(30) = 60 bytes
  // Plus key "data" = 4 chars * 2 = 8 bytes
  // Total = 68 bytes - should work
  await storage.setItem("data", "x".repeat(30), "https://example.com");
  assertEquals(storage.getItem("data"), "x".repeat(30));

  // Now try to add more data that exceeds quota
  await assertRejects(
    () => storage.setItem("big", "x".repeat(30), "https://example.com"),
    Error,
    "QuotaExceededError",
  );
});

Deno.test("StorageManager - quota freed after removeItem", async () => {
  const quotaManager = new QuotaManager(100, 1000);
  const manager = new StorageManager(quotaManager);
  const storage = manager.getLocalStorage("https://example.com");

  // Fill quota
  await storage.setItem("data", "x".repeat(40), "https://example.com");

  // Remove item to free quota
  await storage.removeItem("data", "https://example.com");

  // Should now be able to add new data
  await storage.setItem("newdata", "x".repeat(40), "https://example.com");
  assertEquals(storage.getItem("newdata"), "x".repeat(40));
});

Deno.test("StorageManager - quota freed after clear", async () => {
  const quotaManager = new QuotaManager(100, 1000);
  const manager = new StorageManager(quotaManager);
  const storage = manager.getLocalStorage("https://example.com");

  // Fill with multiple items
  await storage.setItem("key1", "x".repeat(15), "https://example.com");
  await storage.setItem("key2", "x".repeat(15), "https://example.com");

  // Clear to free quota
  await storage.clear("https://example.com");

  // Should now be able to add new data
  await storage.setItem("newdata", "x".repeat(40), "https://example.com");
  assertEquals(storage.getItem("newdata"), "x".repeat(40));
});

Deno.test("StorageManager - updating value respects quota", async () => {
  const quotaManager = new QuotaManager(100, 1000);
  const manager = new StorageManager(quotaManager);
  const storage = manager.getLocalStorage("https://example.com");

  // Add initial value
  await storage.setItem("data", "x".repeat(20), "https://example.com");

  // Update to smaller value - should work
  await storage.setItem("data", "x".repeat(10), "https://example.com");
  assertEquals(storage.getItem("data"), "x".repeat(10));

  // Update to larger value - should work if within quota
  await storage.setItem("data", "x".repeat(30), "https://example.com");
  assertEquals(storage.getItem("data"), "x".repeat(30));

  // Update to value that exceeds quota
  await assertRejects(
    () => storage.setItem("data", "x".repeat(100), "https://example.com"),
    Error,
    "QuotaExceededError",
  );
});

// ============================================================================
// Storage Events
// ============================================================================

Deno.test("StorageManager - storage event emitted on setItem", async () => {
  const eventEmitter = new StorageEventEmitter();
  const manager = new StorageManager(undefined, eventEmitter);
  const storage = manager.getLocalStorage("https://example.com");

  let capturedEvent: StorageEvent | undefined;
  eventEmitter.addEventListener((event: StorageEvent) => {
    capturedEvent = event;
  });

  await storage.setItem("key", "value", "https://example.com/page");

  // Events are emitted via queueMicrotask
  await new Promise((resolve) => setTimeout(resolve, 10));

  assertExists(capturedEvent);
  assertEquals(capturedEvent.key, "key");
  assertEquals(capturedEvent.oldValue, null);
  assertEquals(capturedEvent.newValue, "value");
  assertEquals(capturedEvent.url, "https://example.com/page");
  assertEquals(capturedEvent.storageArea, "localStorage");
});

Deno.test("StorageManager - storage event emitted on removeItem", async () => {
  const eventEmitter = new StorageEventEmitter();
  const manager = new StorageManager(undefined, eventEmitter);
  const storage = manager.getLocalStorage("https://example.com");

  await storage.setItem("key", "value", "https://example.com");

  let capturedEvent: StorageEvent | undefined;
  eventEmitter.addEventListener((event: StorageEvent) => {
    capturedEvent = event;
  });

  await storage.removeItem("key", "https://example.com/page");

  await new Promise((resolve) => setTimeout(resolve, 10));

  assertExists(capturedEvent);
  assertEquals(capturedEvent.key, "key");
  assertEquals(capturedEvent.oldValue, "value");
  assertEquals(capturedEvent.newValue, null);
  assertEquals(capturedEvent.url, "https://example.com/page");
});

Deno.test("StorageManager - storage event emitted on clear", async () => {
  const eventEmitter = new StorageEventEmitter();
  const manager = new StorageManager(undefined, eventEmitter);
  const storage = manager.getLocalStorage("https://example.com");

  await storage.setItem("key1", "value1", "https://example.com");
  await storage.setItem("key2", "value2", "https://example.com");

  let capturedEvent: StorageEvent | undefined;
  eventEmitter.addEventListener((event: StorageEvent) => {
    capturedEvent = event;
  });

  await storage.clear("https://example.com/page");

  await new Promise((resolve) => setTimeout(resolve, 10));

  assertExists(capturedEvent);
  assertEquals(capturedEvent.key, ""); // Empty key indicates clear
  assertEquals(capturedEvent.oldValue, null);
  assertEquals(capturedEvent.newValue, null);
  assertEquals(capturedEvent.url, "https://example.com/page");
});

Deno.test("StorageManager - storage event shows old value on update", async () => {
  const eventEmitter = new StorageEventEmitter();
  const manager = new StorageManager(undefined, eventEmitter);
  const storage = manager.getLocalStorage("https://example.com");

  await storage.setItem("key", "oldValue", "https://example.com");

  let capturedEvent: StorageEvent | undefined;
  eventEmitter.addEventListener((event: StorageEvent) => {
    capturedEvent = event;
  });

  await storage.setItem("key", "newValue", "https://example.com");

  await new Promise((resolve) => setTimeout(resolve, 10));

  assertExists(capturedEvent);
  assertEquals(capturedEvent.oldValue, "oldValue");
  assertEquals(capturedEvent.newValue, "newValue");
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test("StorageManager - empty string key", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  await storage.setItem("", "value", "https://example.com");
  assertEquals(storage.getItem(""), "value");
  assertEquals(storage.length, 1);
});

Deno.test("StorageManager - empty string value", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  await storage.setItem("key", "", "https://example.com");
  assertEquals(storage.getItem("key"), "");
  assertEquals(storage.length, 1);
});

Deno.test("StorageManager - special characters in keys and values", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  const specialChars = "!@#$%^&*()_+-={}[]|\\:;\"'<>,.?/~`\n\t\r";
  await storage.setItem(specialChars, specialChars, "https://example.com");
  assertEquals(storage.getItem(specialChars), specialChars);
});

Deno.test("StorageManager - unicode characters", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  const unicode = "Hello 世界 🌍 مرحبا שלום";
  await storage.setItem("unicode", unicode, "https://example.com");
  assertEquals(storage.getItem("unicode"), unicode);
});

Deno.test("StorageManager - large number of keys", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  // Add 1000 keys
  for (let i = 0; i < 1000; i++) {
    await storage.setItem(`key${i}`, `value${i}`, "https://example.com");
  }

  assertEquals(storage.length, 1000);

  // Verify retrieval
  assertEquals(storage.getItem("key0"), "value0");
  assertEquals(storage.getItem("key500"), "value500");
  assertEquals(storage.getItem("key999"), "value999");
});

// ============================================================================
// Manager-level Operations
// ============================================================================

Deno.test("StorageManager - clearOrigin clears both local and session storage", async () => {
  const manager = new StorageManager();

  const local = manager.getLocalStorage("https://example.com");
  const session = manager.getSessionStorage("https://example.com");

  await local.setItem("key", "local", "https://example.com");
  await session.setItem("key", "session", "https://example.com");

  await manager.clearOrigin("https://example.com", "https://example.com");

  assertEquals(local.length, 0);
  assertEquals(session.length, 0);
});

Deno.test("StorageManager - deleteOrigin removes storage instances", async () => {
  const manager = new StorageManager();

  const local = manager.getLocalStorage("https://example.com");
  const session = manager.getSessionStorage("https://example.com");

  await local.setItem("key", "value", "https://example.com");
  await session.setItem("key", "value", "https://example.com");

  manager.deleteOrigin("https://example.com");

  // Getting storage again should return new empty instances
  const newLocal = manager.getLocalStorage("https://example.com");
  const newSession = manager.getSessionStorage("https://example.com");

  assertEquals(newLocal.length, 0);
  assertEquals(newSession.length, 0);
});

Deno.test("StorageManager - getAllOrigins returns all origins with storage", async () => {
  const manager = new StorageManager();

  await manager.getLocalStorage("https://example.com").setItem("k", "v", "https://example.com");
  await manager.getSessionStorage("https://other.com").setItem("k", "v", "https://other.com");
  await manager.getLocalStorage("https://third.com").setItem("k", "v", "https://third.com");

  const origins = manager.getAllOrigins();
  assertEquals(origins.length, 3);
  assertEquals(origins.includes("https://example.com"), true);
  assertEquals(origins.includes("https://other.com"), true);
  assertEquals(origins.includes("https://third.com"), true);
});

Deno.test("StorageManager - getUsage returns correct usage per origin", async () => {
  const manager = new StorageManager();

  const local = manager.getLocalStorage("https://example.com");
  const session = manager.getSessionStorage("https://example.com");

  await local.setItem("key", "value", "https://example.com"); // (3+5)*2 = 16 bytes
  await session.setItem("data", "test", "https://example.com"); // (4+4)*2 = 16 bytes

  const usage = manager.getUsage("https://example.com");
  assertEquals(usage.local, 16);
  assertEquals(usage.session, 16);
  assertEquals(usage.total, 32);
});

Deno.test("StorageManager - getTotalUsage across all origins", async () => {
  const manager = new StorageManager();

  await manager.getLocalStorage("https://example.com").setItem("key", "value", "https://example.com");
  await manager.getLocalStorage("https://other.com").setItem("key", "value", "https://other.com");
  await manager.getSessionStorage("https://third.com").setItem("key", "value", "https://third.com");

  const total = manager.getTotalUsage();
  // Each is (3+5)*2 = 16 bytes, times 3 = 48 bytes
  assertEquals(total, 48);
});

Deno.test("StorageManager - clearAllSessionStorage only clears session storage", async () => {
  const manager = new StorageManager();

  await manager.getLocalStorage("https://example.com").setItem("key", "local", "https://example.com");
  await manager.getSessionStorage("https://example.com").setItem("key", "session", "https://example.com");

  await manager.clearAllSessionStorage();

  // Session storage should be cleared
  const session = manager.getSessionStorage("https://example.com");
  assertEquals(session.length, 0);

  // Local storage should remain
  const local = manager.getLocalStorage("https://example.com");
  assertEquals(local.getItem("key"), "local");
});

// ============================================================================
// Export/Import
// ============================================================================

Deno.test("StorageManager - export and import data", async () => {
  const manager1 = new StorageManager();

  await manager1.getLocalStorage("https://example.com").setItem("key1", "value1", "https://example.com");
  await manager1.getSessionStorage("https://example.com").setItem(
    "key2",
    "value2",
    "https://example.com",
  );

  const exported = manager1.export();

  // Create new manager and import
  const manager2 = new StorageManager();
  manager2.import(exported);

  assertEquals(manager2.getLocalStorage("https://example.com").getItem("key1"), "value1");
  assertEquals(manager2.getSessionStorage("https://example.com").getItem("key2"), "value2");
});

// ============================================================================
// Helper Methods
// ============================================================================

Deno.test("StorageManager - keys() returns all keys", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  await storage.setItem("key1", "value1", "https://example.com");
  await storage.setItem("key2", "value2", "https://example.com");
  await storage.setItem("key3", "value3", "https://example.com");

  const keys = storage.keys();
  assertEquals(keys.length, 3);
  assertEquals(keys.includes("key1"), true);
  assertEquals(keys.includes("key2"), true);
  assertEquals(keys.includes("key3"), true);
});

Deno.test("StorageManager - values() returns all values", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  await storage.setItem("key1", "value1", "https://example.com");
  await storage.setItem("key2", "value2", "https://example.com");
  await storage.setItem("key3", "value3", "https://example.com");

  const values = storage.values();
  assertEquals(values.length, 3);
  assertEquals(values.includes("value1"), true);
  assertEquals(values.includes("value2"), true);
  assertEquals(values.includes("value3"), true);
});

Deno.test("StorageManager - entries() returns all key-value pairs", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  await storage.setItem("key1", "value1", "https://example.com");
  await storage.setItem("key2", "value2", "https://example.com");

  const entries = storage.entries();
  assertEquals(entries.length, 2);

  const entryMap = new Map(entries);
  assertEquals(entryMap.get("key1"), "value1");
  assertEquals(entryMap.get("key2"), "value2");
});

Deno.test("StorageManager - getSize() returns storage size in bytes", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  await storage.setItem("key", "value", "https://example.com");
  // (3+5)*2 = 16 bytes
  assertEquals(storage.getSize(), 16);

  await storage.setItem("data", "test", "https://example.com");
  // 16 + (4+4)*2 = 32 bytes
  assertEquals(storage.getSize(), 32);
});

// ============================================================================
// Write Lock Serialization
// ============================================================================

Deno.test("StorageManager - concurrent setItem writes are serialized via write lock", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");
  const url = "https://example.com";

  // Fire multiple concurrent writes without awaiting individually
  const p1 = storage.setItem("key", "first", url);
  const p2 = storage.setItem("key", "second", url);
  const p3 = storage.setItem("key", "third", url);

  // Wait for all writes to complete
  await Promise.all([p1, p2, p3]);

  // The last write in chain order should win
  assertEquals(storage.getItem("key"), "third");
});

Deno.test("StorageManager - write lock serializes setItem and removeItem", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");
  const url = "https://example.com";

  // Set then remove concurrently
  const p1 = storage.setItem("key", "value", url);
  const p2 = storage.removeItem("key", url);

  await Promise.all([p1, p2]);

  // removeItem should have run after setItem
  assertEquals(storage.getItem("key"), null);
  assertEquals(storage.length, 0);
});

Deno.test("StorageManager - write lock serializes setItem and clear", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");
  const url = "https://example.com";

  // Set multiple items then clear concurrently
  const p1 = storage.setItem("a", "1", url);
  const p2 = storage.setItem("b", "2", url);
  const p3 = storage.clear(url);

  await Promise.all([p1, p2, p3]);

  // clear should have run after both setItems
  assertEquals(storage.length, 0);
});

Deno.test("StorageManager - write lock preserves order across interleaved operations", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");
  const url = "https://example.com";
  const order: string[] = [];

  const eventEmitter = manager.getEventEmitter();
  eventEmitter.addEventListener((event: StorageEvent) => {
    if (event.key === "track") {
      order.push(event.newValue ?? "removed");
    }
  });

  // Chain: set "A" -> set "B" -> remove -> set "C"
  const p1 = storage.setItem("track", "A", url);
  const p2 = storage.setItem("track", "B", url);
  const p3 = storage.removeItem("track", url);
  const p4 = storage.setItem("track", "C", url);

  await Promise.all([p1, p2, p3, p4]);
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Final value should be "C"
  assertEquals(storage.getItem("track"), "C");
  // Events should have fired in order
  assertEquals(order, ["A", "B", "removed", "C"]);
});

Deno.test("StorageManager - waitForWrites resolves after all pending writes", async () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");
  const url = "https://example.com";

  // Fire writes without awaiting
  storage.setItem("a", "1", url);
  storage.setItem("b", "2", url);
  storage.setItem("c", "3", url);

  // Wait for all writes via waitForWrites
  await storage.waitForWrites();

  assertEquals(storage.getItem("a"), "1");
  assertEquals(storage.getItem("b"), "2");
  assertEquals(storage.getItem("c"), "3");
});

Deno.test("StorageManager - quota error in write lock does not break subsequent writes", async () => {
  const quotaManager = new QuotaManager(100, 1000);
  const manager = new StorageManager(quotaManager);
  const storage = manager.getLocalStorage("https://example.com");
  const url = "https://example.com";

  // This should succeed (68 bytes)
  await storage.setItem("data", "x".repeat(30), url);

  // This should fail (exceeds quota) - the lock chain should handle the error
  try {
    await storage.setItem("big", "x".repeat(100), url);
  } catch {
    // Expected
  }

  // Subsequent writes should still work after a failed write
  await storage.removeItem("data", url);
  await storage.setItem("small", "ok", url);
  assertEquals(storage.getItem("small"), "ok");
});

// ============================================================================
// clearAllLocalStorage / clearAllSessionStorage
// ============================================================================

Deno.test("StorageManager - clearAllLocalStorage clears data across origins", async () => {
  const quotaManager = new QuotaManager();
  const manager = new StorageManager(quotaManager);

  const url1 = "https://example.com";
  const url2 = "https://other.com";

  const ls1 = manager.getLocalStorage(url1);
  const ls2 = manager.getLocalStorage(url2);

  await ls1.setItem("a", "1", url1);
  await ls2.setItem("b", "2", url2);

  assertEquals(ls1.getItem("a"), "1");
  assertEquals(ls2.getItem("b"), "2");

  await manager.clearAllLocalStorage();

  // After clearing, getting fresh storage should be empty
  const ls1After = manager.getLocalStorage(url1);
  const ls2After = manager.getLocalStorage(url2);
  assertEquals(ls1After.length, 0);
  assertEquals(ls2After.length, 0);
});

Deno.test("StorageManager - clearAllSessionStorage clears data across origins", async () => {
  const quotaManager = new QuotaManager();
  const manager = new StorageManager(quotaManager);

  const url1 = "https://example.com";
  const url2 = "https://other.com";

  const ss1 = manager.getSessionStorage(url1);
  const ss2 = manager.getSessionStorage(url2);

  await ss1.setItem("x", "10", url1);
  await ss2.setItem("y", "20", url2);

  assertEquals(ss1.getItem("x"), "10");
  assertEquals(ss2.getItem("y"), "20");

  await manager.clearAllSessionStorage();

  const ss1After = manager.getSessionStorage(url1);
  const ss2After = manager.getSessionStorage(url2);
  assertEquals(ss1After.length, 0);
  assertEquals(ss2After.length, 0);
});

Deno.test("StorageManager - clearAllLocalStorage updates quota", async () => {
  const quotaManager = new QuotaManager();
  const manager = new StorageManager(quotaManager);

  const url = "https://example.com";
  const ls = manager.getLocalStorage(url);

  await ls.setItem("data", "x".repeat(1000), url);
  const usageBefore = quotaManager.getUsage(url);

  // Should have some usage tracked
  assertEquals(usageBefore > 0, true);

  await manager.clearAllLocalStorage();

  const usageAfter = quotaManager.getUsage(url);
  assertEquals(usageAfter < usageBefore, true);
});

// ============================================================================
// Write Lock Resilience
// ============================================================================

Deno.test("StorageManager - removeItem error does not break write lock", async () => {
  const eventEmitter = new StorageEventEmitter();
  // Create an emitter that throws on the first emit call
  let emitCount = 0;
  const originalEmit = eventEmitter.emit.bind(eventEmitter);
  eventEmitter.emit = (event) => {
    emitCount++;
    if (emitCount === 1) {
      throw new Error("Simulated removeItem error");
    }
    originalEmit(event);
  };

  const manager = new StorageManager(undefined, eventEmitter);
  const storage = manager.getLocalStorage("https://example.com");
  const url = "https://example.com/page";

  // Set two items (bypass the throwing emitter by resetting count after)
  emitCount = -10; // won't hit 1 during setup
  await storage.setItem("a", "1", url);
  await storage.setItem("b", "2", url);
  emitCount = 0; // arm the throw for next emit

  // removeItem should reject due to the thrown error
  let removeRejected = false;
  try {
    await storage.removeItem("a", url);
  } catch {
    removeRejected = true;
  }
  assertEquals(removeRejected, true);

  // Subsequent setItem should still work (lock not broken)
  emitCount = 100; // disable throwing
  await storage.setItem("c", "3", url);
  assertEquals(storage.getItem("c"), "3");
});

Deno.test("StorageManager - clear error does not break write lock", async () => {
  const eventEmitter = new StorageEventEmitter();
  let shouldThrow = false;
  const originalEmit = eventEmitter.emit.bind(eventEmitter);
  eventEmitter.emit = (event) => {
    if (shouldThrow) {
      shouldThrow = false;
      throw new Error("Simulated clear error");
    }
    originalEmit(event);
  };

  const manager = new StorageManager(undefined, eventEmitter);
  const storage = manager.getLocalStorage("https://example.com");
  const url = "https://example.com/page";

  await storage.setItem("x", "1", url);
  await storage.setItem("y", "2", url);

  // Arm the throw for clear's emit
  shouldThrow = true;

  let clearRejected = false;
  try {
    await storage.clear(url);
  } catch {
    clearRejected = true;
  }
  assertEquals(clearRejected, true);

  // Subsequent setItem should still work (lock not broken)
  await storage.setItem("z", "3", url);
  assertEquals(storage.getItem("z"), "3");
});
