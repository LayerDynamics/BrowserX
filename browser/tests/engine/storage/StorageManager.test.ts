/**
 * StorageManager Tests
 *
 * Comprehensive test coverage for StorageManager class.
 * Tests localStorage, sessionStorage, quota enforcement, origin isolation,
 * storage events, and edge cases.
 */

import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { StorageManager } from "../../../src/engine/storage/StorageManager.ts";
import { QuotaManager } from "../../../src/engine/storage/QuotaManager.ts";
import { StorageEventEmitter, type StorageEvent } from "../../../src/engine/storage/StorageEvents.ts";

// ============================================================================
// Basic Operations
// ============================================================================

Deno.test("StorageManager - localStorage setItem/getItem", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  storage.setItem("key", "value", "https://example.com");
  assertEquals(storage.getItem("key"), "value");
  assertEquals(storage.length, 1);
});

Deno.test("StorageManager - sessionStorage setItem/getItem", () => {
  const manager = new StorageManager();
  const storage = manager.getSessionStorage("https://example.com");

  storage.setItem("key", "value", "https://example.com");
  assertEquals(storage.getItem("key"), "value");
  assertEquals(storage.length, 1);
});

Deno.test("StorageManager - getItem returns null for non-existent key", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  assertEquals(storage.getItem("nonexistent"), null);
});

Deno.test("StorageManager - removeItem", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  storage.setItem("key", "value", "https://example.com");
  assertEquals(storage.getItem("key"), "value");

  storage.removeItem("key", "https://example.com");
  assertEquals(storage.getItem("key"), null);
  assertEquals(storage.length, 0);
});

Deno.test("StorageManager - removeItem non-existent key is safe", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  // Should not throw
  storage.removeItem("nonexistent", "https://example.com");
  assertEquals(storage.length, 0);
});

Deno.test("StorageManager - clear method", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  storage.setItem("key1", "value1", "https://example.com");
  storage.setItem("key2", "value2", "https://example.com");
  storage.setItem("key3", "value3", "https://example.com");
  assertEquals(storage.length, 3);

  storage.clear("https://example.com");
  assertEquals(storage.length, 0);
  assertEquals(storage.getItem("key1"), null);
  assertEquals(storage.getItem("key2"), null);
  assertEquals(storage.getItem("key3"), null);
});

Deno.test("StorageManager - clear empty storage is safe", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  // Should not throw
  storage.clear("https://example.com");
  assertEquals(storage.length, 0);
});

Deno.test("StorageManager - key method for iteration", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  storage.setItem("key1", "value1", "https://example.com");
  storage.setItem("key2", "value2", "https://example.com");
  storage.setItem("key3", "value3", "https://example.com");

  // Keys should be retrievable by index
  assertExists(storage.key(0));
  assertExists(storage.key(1));
  assertExists(storage.key(2));

  // Out of bounds returns null
  assertEquals(storage.key(3), null);
  assertEquals(storage.key(-1), null);
});

Deno.test("StorageManager - updating existing key", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  storage.setItem("key", "value1", "https://example.com");
  assertEquals(storage.getItem("key"), "value1");

  storage.setItem("key", "value2", "https://example.com");
  assertEquals(storage.getItem("key"), "value2");
  assertEquals(storage.length, 1); // Should still be 1, not 2
});

// ============================================================================
// Origin Isolation
// ============================================================================

Deno.test("StorageManager - origin isolation for localStorage", () => {
  const manager = new StorageManager();

  const storage1 = manager.getLocalStorage("https://example.com");
  const storage2 = manager.getLocalStorage("https://other.com");

  storage1.setItem("key", "value1", "https://example.com");
  storage2.setItem("key", "value2", "https://other.com");

  assertEquals(storage1.getItem("key"), "value1");
  assertEquals(storage2.getItem("key"), "value2");
  assertEquals(storage1.length, 1);
  assertEquals(storage2.length, 1);
});

Deno.test("StorageManager - origin isolation for sessionStorage", () => {
  const manager = new StorageManager();

  const storage1 = manager.getSessionStorage("https://example.com");
  const storage2 = manager.getSessionStorage("https://other.com");

  storage1.setItem("key", "value1", "https://example.com");
  storage2.setItem("key", "value2", "https://other.com");

  assertEquals(storage1.getItem("key"), "value1");
  assertEquals(storage2.getItem("key"), "value2");
});

Deno.test("StorageManager - localStorage and sessionStorage are separate per origin", () => {
  const manager = new StorageManager();

  const local = manager.getLocalStorage("https://example.com");
  const session = manager.getSessionStorage("https://example.com");

  local.setItem("key", "localStorage", "https://example.com");
  session.setItem("key", "sessionStorage", "https://example.com");

  assertEquals(local.getItem("key"), "localStorage");
  assertEquals(session.getItem("key"), "sessionStorage");
});

// ============================================================================
// Quota Enforcement
// ============================================================================

Deno.test("StorageManager - quota enforcement", () => {
  // Create manager with small quota (100 bytes)
  const quotaManager = new QuotaManager(100, 1000);
  const manager = new StorageManager(quotaManager);
  const storage = manager.getLocalStorage("https://example.com");

  // Each character is 2 bytes (UTF-16), so "x".repeat(30) = 60 bytes
  // Plus key "data" = 4 chars * 2 = 8 bytes
  // Total = 68 bytes - should work
  storage.setItem("data", "x".repeat(30), "https://example.com");
  assertEquals(storage.getItem("data"), "x".repeat(30));

  // Now try to add more data that exceeds quota
  // "big" = 6 bytes, value = 60 bytes, total = 66 bytes
  // Combined with existing 68 bytes = 134 bytes > 100 quota
  assertThrows(
    () => storage.setItem("big", "x".repeat(30), "https://example.com"),
    Error,
    "QuotaExceededError",
  );
});

Deno.test("StorageManager - quota freed after removeItem", () => {
  const quotaManager = new QuotaManager(100, 1000);
  const manager = new StorageManager(quotaManager);
  const storage = manager.getLocalStorage("https://example.com");

  // Fill quota
  storage.setItem("data", "x".repeat(40), "https://example.com");

  // Remove item to free quota
  storage.removeItem("data", "https://example.com");

  // Should now be able to add new data
  storage.setItem("newdata", "x".repeat(40), "https://example.com");
  assertEquals(storage.getItem("newdata"), "x".repeat(40));
});

Deno.test("StorageManager - quota freed after clear", () => {
  const quotaManager = new QuotaManager(100, 1000);
  const manager = new StorageManager(quotaManager);
  const storage = manager.getLocalStorage("https://example.com");

  // Fill with multiple items
  storage.setItem("key1", "x".repeat(15), "https://example.com");
  storage.setItem("key2", "x".repeat(15), "https://example.com");

  // Clear to free quota
  storage.clear("https://example.com");

  // Should now be able to add new data
  storage.setItem("newdata", "x".repeat(40), "https://example.com");
  assertEquals(storage.getItem("newdata"), "x".repeat(40));
});

Deno.test("StorageManager - updating value respects quota", () => {
  const quotaManager = new QuotaManager(100, 1000);
  const manager = new StorageManager(quotaManager);
  const storage = manager.getLocalStorage("https://example.com");

  // Add initial value
  storage.setItem("data", "x".repeat(20), "https://example.com");

  // Update to smaller value - should work
  storage.setItem("data", "x".repeat(10), "https://example.com");
  assertEquals(storage.getItem("data"), "x".repeat(10));

  // Update to larger value - should work if within quota
  storage.setItem("data", "x".repeat(30), "https://example.com");
  assertEquals(storage.getItem("data"), "x".repeat(30));

  // Update to value that exceeds quota
  assertThrows(
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

  storage.setItem("key", "value", "https://example.com/page");

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

  storage.setItem("key", "value", "https://example.com");

  let capturedEvent: StorageEvent | undefined;
  eventEmitter.addEventListener((event: StorageEvent) => {
    capturedEvent = event;
  });

  storage.removeItem("key", "https://example.com/page");

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

  storage.setItem("key1", "value1", "https://example.com");
  storage.setItem("key2", "value2", "https://example.com");

  let capturedEvent: StorageEvent | undefined;
  eventEmitter.addEventListener((event: StorageEvent) => {
    capturedEvent = event;
  });

  storage.clear("https://example.com/page");

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

  storage.setItem("key", "oldValue", "https://example.com");

  let capturedEvent: StorageEvent | undefined;
  eventEmitter.addEventListener((event: StorageEvent) => {
    capturedEvent = event;
  });

  storage.setItem("key", "newValue", "https://example.com");

  await new Promise((resolve) => setTimeout(resolve, 10));

  assertExists(capturedEvent);
  assertEquals(capturedEvent.oldValue, "oldValue");
  assertEquals(capturedEvent.newValue, "newValue");
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test("StorageManager - empty string key", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  storage.setItem("", "value", "https://example.com");
  assertEquals(storage.getItem(""), "value");
  assertEquals(storage.length, 1);
});

Deno.test("StorageManager - empty string value", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  storage.setItem("key", "", "https://example.com");
  assertEquals(storage.getItem("key"), "");
  assertEquals(storage.length, 1);
});

Deno.test("StorageManager - special characters in keys and values", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  const specialChars = "!@#$%^&*()_+-={}[]|\\:;\"'<>,.?/~`\n\t\r";
  storage.setItem(specialChars, specialChars, "https://example.com");
  assertEquals(storage.getItem(specialChars), specialChars);
});

Deno.test("StorageManager - unicode characters", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  const unicode = "Hello 世界 🌍 مرحبا שלום";
  storage.setItem("unicode", unicode, "https://example.com");
  assertEquals(storage.getItem("unicode"), unicode);
});

Deno.test("StorageManager - large number of keys", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  // Add 1000 keys
  for (let i = 0; i < 1000; i++) {
    storage.setItem(`key${i}`, `value${i}`, "https://example.com");
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

Deno.test("StorageManager - clearOrigin clears both local and session storage", () => {
  const manager = new StorageManager();

  const local = manager.getLocalStorage("https://example.com");
  const session = manager.getSessionStorage("https://example.com");

  local.setItem("key", "local", "https://example.com");
  session.setItem("key", "session", "https://example.com");

  manager.clearOrigin("https://example.com", "https://example.com");

  assertEquals(local.length, 0);
  assertEquals(session.length, 0);
});

Deno.test("StorageManager - deleteOrigin removes storage instances", () => {
  const manager = new StorageManager();

  const local = manager.getLocalStorage("https://example.com");
  const session = manager.getSessionStorage("https://example.com");

  local.setItem("key", "value", "https://example.com");
  session.setItem("key", "value", "https://example.com");

  manager.deleteOrigin("https://example.com");

  // Getting storage again should return new empty instances
  const newLocal = manager.getLocalStorage("https://example.com");
  const newSession = manager.getSessionStorage("https://example.com");

  assertEquals(newLocal.length, 0);
  assertEquals(newSession.length, 0);
});

Deno.test("StorageManager - getAllOrigins returns all origins with storage", () => {
  const manager = new StorageManager();

  manager.getLocalStorage("https://example.com").setItem("k", "v", "https://example.com");
  manager.getSessionStorage("https://other.com").setItem("k", "v", "https://other.com");
  manager.getLocalStorage("https://third.com").setItem("k", "v", "https://third.com");

  const origins = manager.getAllOrigins();
  assertEquals(origins.length, 3);
  assertEquals(origins.includes("https://example.com"), true);
  assertEquals(origins.includes("https://other.com"), true);
  assertEquals(origins.includes("https://third.com"), true);
});

Deno.test("StorageManager - getUsage returns correct usage per origin", () => {
  const manager = new StorageManager();

  const local = manager.getLocalStorage("https://example.com");
  const session = manager.getSessionStorage("https://example.com");

  local.setItem("key", "value", "https://example.com"); // (3+5)*2 = 16 bytes
  session.setItem("data", "test", "https://example.com"); // (4+4)*2 = 16 bytes

  const usage = manager.getUsage("https://example.com");
  assertEquals(usage.local, 16);
  assertEquals(usage.session, 16);
  assertEquals(usage.total, 32);
});

Deno.test("StorageManager - getTotalUsage across all origins", () => {
  const manager = new StorageManager();

  manager.getLocalStorage("https://example.com").setItem("key", "value", "https://example.com");
  manager.getLocalStorage("https://other.com").setItem("key", "value", "https://other.com");
  manager.getSessionStorage("https://third.com").setItem("key", "value", "https://third.com");

  const total = manager.getTotalUsage();
  // Each is (3+5)*2 = 16 bytes, times 3 = 48 bytes
  assertEquals(total, 48);
});

Deno.test("StorageManager - clearAllSessionStorage only clears session storage", () => {
  const manager = new StorageManager();

  manager.getLocalStorage("https://example.com").setItem("key", "local", "https://example.com");
  manager.getSessionStorage("https://example.com").setItem("key", "session", "https://example.com");

  manager.clearAllSessionStorage();

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

Deno.test("StorageManager - export and import data", () => {
  const manager1 = new StorageManager();

  manager1.getLocalStorage("https://example.com").setItem("key1", "value1", "https://example.com");
  manager1.getSessionStorage("https://example.com").setItem("key2", "value2", "https://example.com");

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

Deno.test("StorageManager - keys() returns all keys", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  storage.setItem("key1", "value1", "https://example.com");
  storage.setItem("key2", "value2", "https://example.com");
  storage.setItem("key3", "value3", "https://example.com");

  const keys = storage.keys();
  assertEquals(keys.length, 3);
  assertEquals(keys.includes("key1"), true);
  assertEquals(keys.includes("key2"), true);
  assertEquals(keys.includes("key3"), true);
});

Deno.test("StorageManager - values() returns all values", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  storage.setItem("key1", "value1", "https://example.com");
  storage.setItem("key2", "value2", "https://example.com");
  storage.setItem("key3", "value3", "https://example.com");

  const values = storage.values();
  assertEquals(values.length, 3);
  assertEquals(values.includes("value1"), true);
  assertEquals(values.includes("value2"), true);
  assertEquals(values.includes("value3"), true);
});

Deno.test("StorageManager - entries() returns all key-value pairs", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  storage.setItem("key1", "value1", "https://example.com");
  storage.setItem("key2", "value2", "https://example.com");

  const entries = storage.entries();
  assertEquals(entries.length, 2);

  const entryMap = new Map(entries);
  assertEquals(entryMap.get("key1"), "value1");
  assertEquals(entryMap.get("key2"), "value2");
});

Deno.test("StorageManager - getSize() returns storage size in bytes", () => {
  const manager = new StorageManager();
  const storage = manager.getLocalStorage("https://example.com");

  storage.setItem("key", "value", "https://example.com");
  // (3+5)*2 = 16 bytes
  assertEquals(storage.getSize(), 16);

  storage.setItem("data", "test", "https://example.com");
  // 16 + (4+4)*2 = 32 bytes
  assertEquals(storage.getSize(), 32);
});
