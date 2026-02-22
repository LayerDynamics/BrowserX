/**
 * StorageEvents Tests
 */

import { assertEquals } from "@std/assert";
import {
  type StorageEvent,
  StorageEventCoordinator,
  StorageEventEmitter,
  type StorageEventListener,
} from "../../../src/engine/storage/StorageEvents.ts";

const wait = () => new Promise((r) => setTimeout(r, 10));

// ============================================================================
// StorageEventEmitter - Basic Emission
// ============================================================================

Deno.test("StorageEvents - event emitted on listener", async () => {
  const emitter = new StorageEventEmitter();
  let received: StorageEvent | undefined;
  emitter.addEventListener((e) => {
    received = e;
  });

  emitter.emit({
    key: "myKey",
    oldValue: null,
    newValue: "hello",
    url: "https://example.com",
    storageArea: "localStorage",
  });

  await wait();
  assertEquals(received?.key, "myKey");
  assertEquals(received?.oldValue, null);
  assertEquals(received?.newValue, "hello");
  assertEquals(received?.storageArea, "localStorage");
});

Deno.test("StorageEvents - event contains key, oldValue, newValue, storageArea", async () => {
  const emitter = new StorageEventEmitter();
  let received: StorageEvent | undefined;
  emitter.addEventListener((e) => {
    received = e;
  });

  emitter.emit({
    key: "color",
    oldValue: "red",
    newValue: "blue",
    url: "https://example.com/page",
    storageArea: "sessionStorage",
  });

  await wait();
  assertEquals(received?.key, "color");
  assertEquals(received?.oldValue, "red");
  assertEquals(received?.newValue, "blue");
  assertEquals(received?.url, "https://example.com/page");
  assertEquals(received?.storageArea, "sessionStorage");
});

// ============================================================================
// setItem / removeItem / clear event patterns
// ============================================================================

Deno.test("StorageEvents - setItem event pattern (null oldValue)", async () => {
  const emitter = new StorageEventEmitter();
  let received: StorageEvent | undefined;
  emitter.addEventListener((e) => {
    received = e;
  });

  emitter.emit({
    key: "k",
    oldValue: null,
    newValue: "v",
    url: "https://x.com",
    storageArea: "localStorage",
  });
  await wait();
  assertEquals(received?.oldValue, null);
  assertEquals(received?.newValue, "v");
});

Deno.test("StorageEvents - removeItem event pattern (null newValue)", async () => {
  const emitter = new StorageEventEmitter();
  let received: StorageEvent | undefined;
  emitter.addEventListener((e) => {
    received = e;
  });

  emitter.emit({
    key: "k",
    oldValue: "v",
    newValue: null,
    url: "https://x.com",
    storageArea: "localStorage",
  });
  await wait();
  assertEquals(received?.oldValue, "v");
  assertEquals(received?.newValue, null);
});

Deno.test("StorageEvents - clear event pattern (empty key, both null)", async () => {
  const emitter = new StorageEventEmitter();
  let received: StorageEvent | undefined;
  emitter.addEventListener((e) => {
    received = e;
  });

  emitter.emit({
    key: "",
    oldValue: null,
    newValue: null,
    url: "https://x.com",
    storageArea: "localStorage",
  });
  await wait();
  assertEquals(received?.key, "");
  assertEquals(received?.oldValue, null);
  assertEquals(received?.newValue, null);
});

// ============================================================================
// Multiple Listeners
// ============================================================================

Deno.test("StorageEvents - multiple listeners all receive events", async () => {
  const emitter = new StorageEventEmitter();
  const events: StorageEvent[] = [];

  emitter.addEventListener((e) => events.push(e));
  emitter.addEventListener((e) => events.push(e));
  emitter.addEventListener((e) => events.push(e));

  emitter.emit({
    key: "k",
    oldValue: null,
    newValue: "v",
    url: "https://x.com",
    storageArea: "localStorage",
  });
  await wait();
  assertEquals(events.length, 3);
});

// ============================================================================
// Listener Registration / Removal
// ============================================================================

Deno.test("StorageEvents - removeEventListener stops delivery", async () => {
  const emitter = new StorageEventEmitter();
  let count = 0;
  const listener: StorageEventListener = () => {
    count++;
  };

  emitter.addEventListener(listener);
  emitter.emit({
    key: "k",
    oldValue: null,
    newValue: "v",
    url: "https://x.com",
    storageArea: "localStorage",
  });
  await wait();
  assertEquals(count, 1);

  emitter.removeEventListener(listener);
  emitter.emit({
    key: "k",
    oldValue: null,
    newValue: "v2",
    url: "https://x.com",
    storageArea: "localStorage",
  });
  await wait();
  assertEquals(count, 1); // still 1
});

Deno.test("StorageEvents - removeAllListeners clears all", async () => {
  const emitter = new StorageEventEmitter();
  emitter.addEventListener(() => {});
  emitter.addEventListener(() => {});
  assertEquals(emitter.getListenerCount(), 2);

  emitter.removeAllListeners();
  assertEquals(emitter.getListenerCount(), 0);
});

// ============================================================================
// Enable / Disable
// ============================================================================

Deno.test("StorageEvents - disabled emitter does not fire events", async () => {
  const emitter = new StorageEventEmitter();
  let count = 0;
  emitter.addEventListener(() => {
    count++;
  });

  emitter.setEnabled(false);
  assertEquals(emitter.isEnabled(), false);

  emitter.emit({
    key: "k",
    oldValue: null,
    newValue: "v",
    url: "https://x.com",
    storageArea: "localStorage",
  });
  await wait();
  assertEquals(count, 0);
});

Deno.test("StorageEvents - re-enabling emitter resumes events", async () => {
  const emitter = new StorageEventEmitter();
  let count = 0;
  emitter.addEventListener(() => {
    count++;
  });

  emitter.setEnabled(false);
  emitter.emit({
    key: "k",
    oldValue: null,
    newValue: "v",
    url: "https://x.com",
    storageArea: "localStorage",
  });
  await wait();
  assertEquals(count, 0);

  emitter.setEnabled(true);
  emitter.emit({
    key: "k",
    oldValue: null,
    newValue: "v2",
    url: "https://x.com",
    storageArea: "localStorage",
  });
  await wait();
  assertEquals(count, 1);
});

// ============================================================================
// StorageEventCoordinator - Cross-origin Isolation
// ============================================================================

Deno.test("StorageEvents - coordinator isolates per origin", async () => {
  const coord = new StorageEventCoordinator();
  const emitterA = coord.getEmitter("https://a.com");
  const emitterB = coord.getEmitter("https://b.com");

  let countA = 0;
  let countB = 0;
  emitterA.addEventListener(() => {
    countA++;
  });
  emitterB.addEventListener(() => {
    countB++;
  });

  emitterA.emit({
    key: "k",
    oldValue: null,
    newValue: "v",
    url: "https://a.com",
    storageArea: "localStorage",
  });
  await wait();
  assertEquals(countA, 1);
  assertEquals(countB, 0);
});

Deno.test("StorageEvents - coordinator broadcast skips source origin", async () => {
  const coord = new StorageEventCoordinator();
  const emitterA = coord.getEmitter("https://a.com");
  const emitterB = coord.getEmitter("https://b.com");

  let countA = 0;
  let countB = 0;
  emitterA.addEventListener(() => {
    countA++;
  });
  emitterB.addEventListener(() => {
    countB++;
  });

  const event: StorageEvent = {
    key: "k",
    oldValue: null,
    newValue: "v",
    url: "https://a.com",
    storageArea: "localStorage",
  };
  coord.broadcast(event, "https://a.com");
  await wait();
  assertEquals(countA, 0); // source origin skipped
  assertEquals(countB, 1); // other origin receives
});

Deno.test("StorageEvents - coordinator getOrigins and clearAll", () => {
  const coord = new StorageEventCoordinator();
  coord.getEmitter("https://a.com");
  coord.getEmitter("https://b.com");

  assertEquals(coord.getOrigins().length, 2);

  coord.clearAll();
  assertEquals(coord.getOrigins().length, 0);
});

Deno.test("StorageEvents - coordinator removeEmitter", () => {
  const coord = new StorageEventCoordinator();
  coord.getEmitter("https://a.com");
  coord.getEmitter("https://b.com");

  coord.removeEmitter("https://a.com");
  assertEquals(coord.getOrigins().length, 1);
  assertEquals(coord.getOrigins()[0], "https://b.com");
});

// ============================================================================
// Error Handling
// ============================================================================

Deno.test("StorageEvents - listener error does not stop other listeners", async () => {
  const emitter = new StorageEventEmitter();
  let secondCalled = false;

  emitter.addEventListener(() => {
    throw new Error("boom");
  });
  emitter.addEventListener(() => {
    secondCalled = true;
  });

  emitter.emit({
    key: "k",
    oldValue: null,
    newValue: "v",
    url: "https://x.com",
    storageArea: "localStorage",
  });
  await wait();
  assertEquals(secondCalled, true);
});
