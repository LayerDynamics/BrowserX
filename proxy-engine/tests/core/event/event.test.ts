/**
 * Event Tests
 * Comprehensive tests for EventEmitter and proxy event types
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
  EventEmitter,
  globalEventEmitter,
  type ProxyEvent,
  type RequestReceivedEvent,
  type RequestCompletedEvent,
  type CacheHitEvent,
  type CacheMissEvent,
  type ConnectionOpenedEvent,
  type ConnectionClosedEvent,
} from "../../../core/event/event.ts";

// ============================================================================
// EventEmitter Basic Tests
// ============================================================================

Deno.test({
  name: "EventEmitter - can be instantiated",
  fn() {
    const emitter = new EventEmitter();
    assertExists(emitter);
  },
});

Deno.test({
  name: "EventEmitter - on registers listener",
  fn() {
    const emitter = new EventEmitter();
    const listener = () => {};
    emitter.on("request_received", listener);
    assertEquals(emitter.listenerCount("request_received"), 1);
  },
});

Deno.test({
  name: "EventEmitter - on registers multiple listeners for same event",
  fn() {
    const emitter = new EventEmitter();
    emitter.on("request_received", () => {});
    emitter.on("request_received", () => {});
    emitter.on("request_received", () => {});
    assertEquals(emitter.listenerCount("request_received"), 3);
  },
});

Deno.test({
  name: "EventEmitter - off removes listener",
  fn() {
    const emitter = new EventEmitter();
    const listener = () => {};
    emitter.on("request_received", listener);
    assertEquals(emitter.listenerCount("request_received"), 1);

    emitter.off("request_received", listener);
    assertEquals(emitter.listenerCount("request_received"), 0);
  },
});

Deno.test({
  name: "EventEmitter - off does nothing for non-existent listener",
  fn() {
    const emitter = new EventEmitter();
    const listener = () => {};
    emitter.off("request_received", listener);
    assertEquals(emitter.listenerCount("request_received"), 0);
  },
});

Deno.test({
  name: "EventEmitter - off does nothing for non-existent event type",
  fn() {
    const emitter = new EventEmitter();
    const listener = () => {};
    emitter.off("non_existent_event", listener);
    assertEquals(emitter.listenerCount("non_existent_event"), 0);
  },
});

// ============================================================================
// EventEmitter emit Tests
// ============================================================================

Deno.test({
  name: "EventEmitter - emit calls registered listeners",
  async fn() {
    const emitter = new EventEmitter();
    let called = false;

    emitter.on("request_received", () => {
      called = true;
    });

    const event: RequestReceivedEvent = {
      type: "request_received",
      requestId: "req-123",
      clientIP: "192.168.1.1",
      clientPort: 12345,
      method: "GET",
      url: "https://example.com/api",
      protocol: "HTTP/1.1",
      timestamp: Date.now(),
    };

    await emitter.emit(event);
    assert(called, "Listener should have been called");
  },
});

Deno.test({
  name: "EventEmitter - emit passes event to listener",
  async fn() {
    const emitter = new EventEmitter();
    let receivedEvent: ProxyEvent | null = null;

    emitter.on("request_received", (event) => {
      receivedEvent = event;
    });

    const event: RequestReceivedEvent = {
      type: "request_received",
      requestId: "req-456",
      clientIP: "10.0.0.1",
      clientPort: 54321,
      method: "POST",
      url: "https://api.example.com/users",
      protocol: "HTTP/2",
      timestamp: 1234567890,
    };

    await emitter.emit(event);

    assertExists(receivedEvent);
    assertEquals((receivedEvent as RequestReceivedEvent).requestId, "req-456");
    assertEquals((receivedEvent as RequestReceivedEvent).method, "POST");
  },
});

Deno.test({
  name: "EventEmitter - emit calls all listeners for event type",
  async fn() {
    const emitter = new EventEmitter();
    const callOrder: number[] = [];

    emitter.on("cache_hit", () => {
      callOrder.push(1);
    });
    emitter.on("cache_hit", () => {
      callOrder.push(2);
    });
    emitter.on("cache_hit", () => {
      callOrder.push(3);
    });

    const event: CacheHitEvent = {
      type: "cache_hit",
      requestId: "req-1",
      key: "cache-key-1",
      age: 100,
      size: 1024,
      timestamp: Date.now(),
    };

    await emitter.emit(event);

    assertEquals(callOrder.length, 3);
    assert(callOrder.includes(1));
    assert(callOrder.includes(2));
    assert(callOrder.includes(3));
  },
});

Deno.test({
  name: "EventEmitter - emit handles async listeners",
  async fn() {
    const emitter = new EventEmitter();
    let asyncCalled = false;

    emitter.on("cache_miss", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      asyncCalled = true;
    });

    const event: CacheMissEvent = {
      type: "cache_miss",
      requestId: "req-1",
      key: "cache-key-1",
      reason: "not_found",
      timestamp: Date.now(),
    };

    await emitter.emit(event);
    assert(asyncCalled, "Async listener should have completed");
  },
});

Deno.test({
  name: "EventEmitter - emit continues on listener error",
  async fn() {
    const emitter = new EventEmitter();
    let secondCalled = false;

    emitter.on("cache_miss", () => {
      throw new Error("First listener error");
    });
    emitter.on("cache_miss", () => {
      secondCalled = true;
    });

    const event: CacheMissEvent = {
      type: "cache_miss",
      requestId: "req-1",
      key: "cache-key-1",
      reason: "expired",
      timestamp: Date.now(),
    };

    await emitter.emit(event);
    assert(secondCalled, "Second listener should still be called");
  },
});

// ============================================================================
// EventEmitter emitSync Tests
// ============================================================================

Deno.test({
  name: "EventEmitter - emitSync calls listeners synchronously",
  fn() {
    const emitter = new EventEmitter();
    let called = false;

    emitter.on("connection_opened", () => {
      called = true;
    });

    const event: ConnectionOpenedEvent = {
      type: "connection_opened",
      connectionId: "conn-1",
      clientIP: "192.168.1.1",
      clientPort: 12345,
      serverIP: "10.0.0.1",
      serverPort: 80,
      protocol: "HTTP/1.1",
      timestamp: Date.now(),
    };

    emitter.emitSync(event);
    assert(called, "Listener should have been called synchronously");
  },
});

Deno.test({
  name: "EventEmitter - emitSync continues on error",
  fn() {
    const emitter = new EventEmitter();
    let secondCalled = false;

    emitter.on("connection_closed", () => {
      throw new Error("Error in listener");
    });
    emitter.on("connection_closed", () => {
      secondCalled = true;
    });

    const event: ConnectionClosedEvent = {
      type: "connection_closed",
      connectionId: "conn-1",
      duration: 5000,
      requestsServed: 10,
      bytesIn: 1024,
      bytesOut: 2048,
      reason: "client_close",
      timestamp: Date.now(),
    };

    emitter.emitSync(event);
    assert(secondCalled, "Second listener should still be called");
  },
});

// ============================================================================
// EventEmitter once Tests
// ============================================================================

Deno.test({
  name: "EventEmitter - once listener is called once then removed",
  async fn() {
    const emitter = new EventEmitter();
    let callCount = 0;

    emitter.once("request_completed", () => {
      callCount++;
    });

    const event: RequestCompletedEvent = {
      type: "request_completed",
      requestId: "req-1",
      statusCode: 200,
      statusText: "OK",
      duration: 150,
      bytesIn: 512,
      bytesOut: 1024,
      fromCache: false,
      timestamp: Date.now(),
    };

    await emitter.emit(event);
    await emitter.emit(event);
    await emitter.emit(event);

    assertEquals(callCount, 1);
    assertEquals(emitter.listenerCount("request_completed"), 0);
  },
});

Deno.test({
  name: "EventEmitter - once works with async listeners",
  async fn() {
    const emitter = new EventEmitter();
    let callCount = 0;

    emitter.once("request_completed", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      callCount++;
    });

    const event: RequestCompletedEvent = {
      type: "request_completed",
      requestId: "req-1",
      statusCode: 200,
      statusText: "OK",
      duration: 100,
      bytesIn: 256,
      bytesOut: 512,
      fromCache: true,
      timestamp: Date.now(),
    };

    await emitter.emit(event);
    await emitter.emit(event);

    assertEquals(callCount, 1);
  },
});

// ============================================================================
// EventEmitter Wildcard Tests
// ============================================================================

Deno.test({
  name: "EventEmitter - wildcard listener receives all events",
  async fn() {
    const emitter = new EventEmitter();
    const receivedEvents: string[] = [];

    emitter.on("*", (event) => {
      receivedEvents.push(event.type);
    });

    const cacheHit: CacheHitEvent = {
      type: "cache_hit",
      requestId: "req-1",
      key: "key-1",
      age: 10,
      size: 100,
      timestamp: Date.now(),
    };

    const cacheMiss: CacheMissEvent = {
      type: "cache_miss",
      requestId: "req-2",
      key: "key-2",
      reason: "not_found",
      timestamp: Date.now(),
    };

    await emitter.emit(cacheHit);
    await emitter.emit(cacheMiss);

    assertEquals(receivedEvents.length, 2);
    assert(receivedEvents.includes("cache_hit"));
    assert(receivedEvents.includes("cache_miss"));
  },
});

Deno.test({
  name: "EventEmitter - wildcard and specific listeners both called",
  async fn() {
    const emitter = new EventEmitter();
    let wildcardCalled = false;
    let specificCalled = false;

    emitter.on("*", () => {
      wildcardCalled = true;
    });
    emitter.on("cache_hit", () => {
      specificCalled = true;
    });

    const event: CacheHitEvent = {
      type: "cache_hit",
      requestId: "req-1",
      key: "key-1",
      age: 10,
      size: 100,
      timestamp: Date.now(),
    };

    await emitter.emit(event);

    assert(wildcardCalled, "Wildcard listener should be called");
    assert(specificCalled, "Specific listener should be called");
  },
});

Deno.test({
  name: "EventEmitter - off removes wildcard listener",
  fn() {
    const emitter = new EventEmitter();
    const listener = () => {};

    emitter.on("*", listener);
    assertEquals(emitter.listenerCount("*"), 1);

    emitter.off("*", listener);
    assertEquals(emitter.listenerCount("*"), 0);
  },
});

// ============================================================================
// EventEmitter removeAllListeners Tests
// ============================================================================

Deno.test({
  name: "EventEmitter - removeAllListeners removes all for specific event",
  fn() {
    const emitter = new EventEmitter();
    emitter.on("cache_hit", () => {});
    emitter.on("cache_hit", () => {});
    emitter.on("cache_miss", () => {});

    emitter.removeAllListeners("cache_hit");

    assertEquals(emitter.listenerCount("cache_hit"), 0);
    assertEquals(emitter.listenerCount("cache_miss"), 1);
  },
});

Deno.test({
  name: "EventEmitter - removeAllListeners removes all wildcard listeners",
  fn() {
    const emitter = new EventEmitter();
    emitter.on("*", () => {});
    emitter.on("*", () => {});
    emitter.on("cache_hit", () => {});

    emitter.removeAllListeners("*");

    assertEquals(emitter.listenerCount("*"), 0);
    assertEquals(emitter.listenerCount("cache_hit"), 1);
  },
});

Deno.test({
  name: "EventEmitter - removeAllListeners with no argument removes everything",
  fn() {
    const emitter = new EventEmitter();
    emitter.on("*", () => {});
    emitter.on("cache_hit", () => {});
    emitter.on("cache_miss", () => {});
    emitter.on("request_received", () => {});

    emitter.removeAllListeners();

    assertEquals(emitter.listenerCount("*"), 0);
    assertEquals(emitter.listenerCount("cache_hit"), 0);
    assertEquals(emitter.listenerCount("cache_miss"), 0);
    assertEquals(emitter.listenerCount("request_received"), 0);
  },
});

// ============================================================================
// EventEmitter eventTypes Tests
// ============================================================================

Deno.test({
  name: "EventEmitter - eventTypes returns registered event types",
  fn() {
    const emitter = new EventEmitter();
    emitter.on("cache_hit", () => {});
    emitter.on("cache_miss", () => {});
    emitter.on("request_received", () => {});

    const types = emitter.eventTypes();

    assertEquals(types.length, 3);
    assert(types.includes("cache_hit"));
    assert(types.includes("cache_miss"));
    assert(types.includes("request_received"));
  },
});

Deno.test({
  name: "EventEmitter - eventTypes returns empty array when no listeners",
  fn() {
    const emitter = new EventEmitter();
    assertEquals(emitter.eventTypes().length, 0);
  },
});

Deno.test({
  name: "EventEmitter - eventTypes does not include wildcard",
  fn() {
    const emitter = new EventEmitter();
    emitter.on("*", () => {});
    emitter.on("cache_hit", () => {});

    const types = emitter.eventTypes();

    assertEquals(types.length, 1);
    assert(types.includes("cache_hit"));
    assert(!types.includes("*"));
  },
});

// ============================================================================
// EventEmitter listenerCount Tests
// ============================================================================

Deno.test({
  name: "EventEmitter - listenerCount returns correct count",
  fn() {
    const emitter = new EventEmitter();
    assertEquals(emitter.listenerCount("cache_hit"), 0);

    emitter.on("cache_hit", () => {});
    assertEquals(emitter.listenerCount("cache_hit"), 1);

    emitter.on("cache_hit", () => {});
    assertEquals(emitter.listenerCount("cache_hit"), 2);
  },
});

Deno.test({
  name: "EventEmitter - listenerCount returns wildcard count",
  fn() {
    const emitter = new EventEmitter();
    emitter.on("*", () => {});
    emitter.on("*", () => {});

    assertEquals(emitter.listenerCount("*"), 2);
  },
});

// ============================================================================
// Global Event Emitter Tests
// ============================================================================

Deno.test({
  name: "globalEventEmitter - is an EventEmitter instance",
  fn() {
    assertExists(globalEventEmitter);
    assert(globalEventEmitter instanceof EventEmitter);
  },
});

Deno.test({
  name: "globalEventEmitter - can register and emit events",
  async fn() {
    let called = false;
    const listener = () => {
      called = true;
    };

    globalEventEmitter.on("test_event" as any, listener);

    const event = {
      type: "test_event",
      timestamp: Date.now(),
    } as unknown as ProxyEvent;

    await globalEventEmitter.emit(event);

    assert(called, "Global emitter should call listener");

    // Clean up
    globalEventEmitter.off("test_event" as any, listener);
  },
});

// ============================================================================
// Event Type Structure Tests
// ============================================================================

Deno.test({
  name: "RequestReceivedEvent - has correct structure",
  fn() {
    const event: RequestReceivedEvent = {
      type: "request_received",
      requestId: "req-123",
      clientIP: "192.168.1.1",
      clientPort: 12345,
      method: "GET",
      url: "https://example.com",
      protocol: "HTTP/1.1",
      timestamp: Date.now(),
    };

    assertEquals(event.type, "request_received");
    assertExists(event.requestId);
    assertExists(event.clientIP);
    assertExists(event.clientPort);
    assertExists(event.method);
    assertExists(event.url);
    assertExists(event.protocol);
    assertExists(event.timestamp);
  },
});

Deno.test({
  name: "RequestCompletedEvent - has correct structure",
  fn() {
    const event: RequestCompletedEvent = {
      type: "request_completed",
      requestId: "req-123",
      statusCode: 200,
      statusText: "OK",
      duration: 150,
      bytesIn: 512,
      bytesOut: 1024,
      fromCache: false,
      timestamp: Date.now(),
    };

    assertEquals(event.type, "request_completed");
    assertEquals(event.statusCode, 200);
    assertEquals(event.fromCache, false);
  },
});

Deno.test({
  name: "CacheHitEvent - has correct structure",
  fn() {
    const event: CacheHitEvent = {
      type: "cache_hit",
      requestId: "req-123",
      key: "GET:https://example.com",
      age: 300,
      size: 2048,
      timestamp: Date.now(),
    };

    assertEquals(event.type, "cache_hit");
    assertExists(event.key);
    assertExists(event.age);
    assertExists(event.size);
  },
});

Deno.test({
  name: "CacheMissEvent - has correct structure with reason",
  fn() {
    const notFound: CacheMissEvent = {
      type: "cache_miss",
      requestId: "req-1",
      key: "key-1",
      reason: "not_found",
      timestamp: Date.now(),
    };
    assertEquals(notFound.reason, "not_found");

    const expired: CacheMissEvent = {
      type: "cache_miss",
      requestId: "req-2",
      key: "key-2",
      reason: "expired",
      timestamp: Date.now(),
    };
    assertEquals(expired.reason, "expired");

    const invalid: CacheMissEvent = {
      type: "cache_miss",
      requestId: "req-3",
      key: "key-3",
      reason: "invalid",
      timestamp: Date.now(),
    };
    assertEquals(invalid.reason, "invalid");
  },
});

Deno.test({
  name: "ConnectionOpenedEvent - has correct structure",
  fn() {
    const event: ConnectionOpenedEvent = {
      type: "connection_opened",
      connectionId: "conn-123",
      clientIP: "192.168.1.1",
      clientPort: 12345,
      serverIP: "10.0.0.1",
      serverPort: 443,
      protocol: "HTTP/2",
      timestamp: Date.now(),
    };

    assertEquals(event.type, "connection_opened");
    assertExists(event.connectionId);
    assertExists(event.serverIP);
    assertExists(event.serverPort);
  },
});

Deno.test({
  name: "ConnectionClosedEvent - has correct structure",
  fn() {
    const event: ConnectionClosedEvent = {
      type: "connection_closed",
      connectionId: "conn-123",
      duration: 30000,
      requestsServed: 50,
      bytesIn: 102400,
      bytesOut: 204800,
      reason: "idle_timeout",
      timestamp: Date.now(),
    };

    assertEquals(event.type, "connection_closed");
    assertEquals(event.requestsServed, 50);
    assertEquals(event.reason, "idle_timeout");
  },
});
