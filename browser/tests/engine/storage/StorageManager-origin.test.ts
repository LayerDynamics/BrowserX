import { assertEquals, assertThrows } from "@std/assert";
import { StorageManager } from "../../../src/engine/storage/StorageManager.ts";

Deno.test("OriginStorage - same-origin runtime checks", async (t) => {
  await t.step("setItem rejects cross-origin URL", () => {
    const manager = new StorageManager();
    const storage = manager.getLocalStorage("https://example.com");
    assertThrows(
      () => storage.setItem("key", "value", "https://evil.com/page"),
      DOMException,
      "SecurityError",
    );
  });

  await t.step("setItem allows same-origin URL", () => {
    const manager = new StorageManager();
    const storage = manager.getLocalStorage("https://example.com");
    storage.setItem("key", "value", "https://example.com/page");
    assertEquals(storage.getItem("key"), "value");
  });

  await t.step("removeItem rejects cross-origin URL", () => {
    const manager = new StorageManager();
    const storage = manager.getLocalStorage("https://example.com");
    storage.setItem("key", "value", "https://example.com/page");
    assertThrows(
      () => storage.removeItem("key", "https://evil.com/page"),
      DOMException,
      "SecurityError",
    );
    // Value should still exist
    assertEquals(storage.getItem("key"), "value");
  });

  await t.step("port differences in origin cause rejection", () => {
    const manager = new StorageManager();
    const storage = manager.getLocalStorage("https://example.com:443");
    assertThrows(
      () => storage.setItem("key", "value", "https://example.com:8080/page"),
      DOMException,
      "SecurityError",
    );
  });
});
