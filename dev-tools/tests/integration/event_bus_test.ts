/**
 * Tests for EventBus
 *
 * Covers on/off subscriptions, emit, once, removeAllListeners,
 * listenerCount, eventNames, error isolation, and edge cases.
 */

import { assertEquals } from "@std/assert";
import { EventBus } from "../../integration/event-bus.ts";

// ---------------------------------------------------------------------------
// on() and emit()
// ---------------------------------------------------------------------------

Deno.test("on subscribes handler that receives emitted events", () => {
    const bus = new EventBus();
    const received: unknown[] = [];

    bus.on("test.event", (data) => {
        received.push(data);
    });

    bus.emit("test.event", { value: 42 });

    assertEquals(received.length, 1);
    assertEquals(received[0], { value: 42 });
});

Deno.test("emit without data passes undefined to handler", () => {
    const bus = new EventBus();
    const received: unknown[] = [];

    bus.on("no-data", (data) => {
        received.push(data);
    });

    bus.emit("no-data");

    assertEquals(received.length, 1);
    assertEquals(received[0], undefined);
});

Deno.test("emit with explicit data passes data to handler", () => {
    const bus = new EventBus();
    let capturedData: unknown = null;

    bus.on("data-event", (data) => {
        capturedData = data;
    });

    bus.emit("data-event", "hello world");

    assertEquals(capturedData, "hello world");
});

Deno.test("multiple handlers for same event all receive the event", () => {
    const bus = new EventBus();
    const calls: string[] = [];

    bus.on("multi", () => calls.push("handler-1"));
    bus.on("multi", () => calls.push("handler-2"));
    bus.on("multi", () => calls.push("handler-3"));

    bus.emit("multi");

    assertEquals(calls.length, 3);
    assertEquals(calls, ["handler-1", "handler-2", "handler-3"]);
});

Deno.test("handlers for different events are independent", () => {
    const bus = new EventBus();
    const aCalls: number[] = [];
    const bCalls: number[] = [];

    bus.on("event-a", (data) => aCalls.push(data as number));
    bus.on("event-b", (data) => bCalls.push(data as number));

    bus.emit("event-a", 1);
    bus.emit("event-b", 2);
    bus.emit("event-a", 3);

    assertEquals(aCalls, [1, 3]);
    assertEquals(bCalls, [2]);
});

// ---------------------------------------------------------------------------
// off()
// ---------------------------------------------------------------------------

Deno.test("off unsubscribes a handler so it no longer receives events", () => {
    const bus = new EventBus();
    const received: unknown[] = [];

    const handler = (data: unknown) => received.push(data);
    bus.on("test", handler);

    bus.emit("test", "first");
    assertEquals(received.length, 1);

    bus.off("test", handler);
    bus.emit("test", "second");
    assertEquals(received.length, 1); // Still 1, handler was removed
});

Deno.test("off only removes the specific handler, not others", () => {
    const bus = new EventBus();
    const calls1: number[] = [];
    const calls2: number[] = [];

    const handler1 = () => calls1.push(1);
    const handler2 = () => calls2.push(2);

    bus.on("event", handler1);
    bus.on("event", handler2);

    bus.emit("event");
    assertEquals(calls1, [1]);
    assertEquals(calls2, [2]);

    bus.off("event", handler1);

    bus.emit("event");
    assertEquals(calls1, [1]); // Not called again
    assertEquals(calls2, [2, 2]); // Called again
});

Deno.test("off with non-existent handler does not throw", () => {
    const bus = new EventBus();
    const handler = () => {};
    // Should not throw even though handler was never registered
    bus.off("nonexistent", handler);
});

Deno.test("off cleans up event entry when last handler is removed", () => {
    const bus = new EventBus();
    const handler = () => {};

    bus.on("cleanup-test", handler);
    assertEquals(bus.eventNames().includes("cleanup-test"), true);

    bus.off("cleanup-test", handler);
    assertEquals(bus.eventNames().includes("cleanup-test"), false);
});

// ---------------------------------------------------------------------------
// once()
// ---------------------------------------------------------------------------

Deno.test("once fires handler only once then auto-unsubscribes", () => {
    const bus = new EventBus();
    const received: unknown[] = [];

    bus.once("one-shot", (data) => {
        received.push(data);
    });

    bus.emit("one-shot", "first");
    bus.emit("one-shot", "second");
    bus.emit("one-shot", "third");

    assertEquals(received.length, 1);
    assertEquals(received[0], "first");
});

Deno.test("once removes itself from listener count after firing", () => {
    const bus = new EventBus();

    bus.once("count-test", () => {});
    assertEquals(bus.listenerCount("count-test"), 1);

    bus.emit("count-test");
    assertEquals(bus.listenerCount("count-test"), 0);
});

Deno.test("once alongside regular handlers works correctly", () => {
    const bus = new EventBus();
    const onceCalls: string[] = [];
    const regularCalls: string[] = [];

    bus.once("mixed", () => onceCalls.push("once"));
    bus.on("mixed", () => regularCalls.push("regular"));

    bus.emit("mixed");
    bus.emit("mixed");

    assertEquals(onceCalls, ["once"]);
    assertEquals(regularCalls, ["regular", "regular"]);
});

// ---------------------------------------------------------------------------
// removeAllListeners()
// ---------------------------------------------------------------------------

Deno.test("removeAllListeners clears all handlers for all events", () => {
    const bus = new EventBus();

    bus.on("event-1", () => {});
    bus.on("event-1", () => {});
    bus.on("event-2", () => {});
    bus.on("event-3", () => {});

    assertEquals(bus.eventNames().length, 3);

    bus.removeAllListeners();

    assertEquals(bus.eventNames().length, 0);
    assertEquals(bus.listenerCount("event-1"), 0);
    assertEquals(bus.listenerCount("event-2"), 0);
    assertEquals(bus.listenerCount("event-3"), 0);
});

Deno.test("removeAllListeners on empty bus does not throw", () => {
    const bus = new EventBus();
    bus.removeAllListeners();
    assertEquals(bus.eventNames().length, 0);
});

Deno.test("events are not received after removeAllListeners", () => {
    const bus = new EventBus();
    const received: unknown[] = [];

    bus.on("test", (data) => received.push(data));
    bus.emit("test", "before");
    assertEquals(received.length, 1);

    bus.removeAllListeners();
    bus.emit("test", "after");
    assertEquals(received.length, 1); // No new events
});

// ---------------------------------------------------------------------------
// listenerCount()
// ---------------------------------------------------------------------------

Deno.test("listenerCount returns 0 for unregistered events", () => {
    const bus = new EventBus();
    assertEquals(bus.listenerCount("nonexistent"), 0);
});

Deno.test("listenerCount returns correct count as handlers are added", () => {
    const bus = new EventBus();

    bus.on("counted", () => {});
    assertEquals(bus.listenerCount("counted"), 1);

    bus.on("counted", () => {});
    assertEquals(bus.listenerCount("counted"), 2);

    bus.on("counted", () => {});
    assertEquals(bus.listenerCount("counted"), 3);
});

Deno.test("listenerCount decrements when handler is removed", () => {
    const bus = new EventBus();
    const h1 = () => {};
    const h2 = () => {};

    bus.on("dec", h1);
    bus.on("dec", h2);
    assertEquals(bus.listenerCount("dec"), 2);

    bus.off("dec", h1);
    assertEquals(bus.listenerCount("dec"), 1);

    bus.off("dec", h2);
    assertEquals(bus.listenerCount("dec"), 0);
});

// ---------------------------------------------------------------------------
// eventNames()
// ---------------------------------------------------------------------------

Deno.test("eventNames returns empty array when no events registered", () => {
    const bus = new EventBus();
    assertEquals(bus.eventNames(), []);
});

Deno.test("eventNames returns names of all registered events", () => {
    const bus = new EventBus();

    bus.on("alpha", () => {});
    bus.on("beta", () => {});
    bus.on("gamma", () => {});

    const names = bus.eventNames();
    assertEquals(names.length, 3);
    assertEquals(names.includes("alpha"), true);
    assertEquals(names.includes("beta"), true);
    assertEquals(names.includes("gamma"), true);
});

Deno.test("eventNames does not include events whose last handler was removed", () => {
    const bus = new EventBus();
    const handler = () => {};

    bus.on("temp", handler);
    assertEquals(bus.eventNames().includes("temp"), true);

    bus.off("temp", handler);
    assertEquals(bus.eventNames().includes("temp"), false);
});

// ---------------------------------------------------------------------------
// Error isolation
// ---------------------------------------------------------------------------

Deno.test("error in one handler does not prevent other handlers from running", () => {
    const bus = new EventBus();
    const calls: string[] = [];

    bus.on("error-test", () => {
        calls.push("before-error");
    });
    bus.on("error-test", () => {
        throw new Error("Handler blew up!");
    });
    bus.on("error-test", () => {
        calls.push("after-error");
    });

    // Capture console.error to suppress test noise
    const originalError = console.error;
    const errorLogs: unknown[] = [];
    console.error = (...args: unknown[]) => errorLogs.push(args);

    try {
        bus.emit("error-test");
    } finally {
        console.error = originalError;
    }

    // All non-throwing handlers should have run
    assertEquals(calls, ["before-error", "after-error"]);
    // The error should have been caught and logged
    assertEquals(errorLogs.length, 1);
});

// ---------------------------------------------------------------------------
// Emitting unsubscribed events
// ---------------------------------------------------------------------------

Deno.test("emitting an event with no subscribers does nothing", () => {
    const bus = new EventBus();
    // Should not throw
    bus.emit("nobody-listening", { data: "test" });
    // Nothing to assert except no error was thrown
    assertEquals(true, true);
});

Deno.test("emitting an event with no subscribers after all were removed", () => {
    const bus = new EventBus();
    const handler = () => {};

    bus.on("transient", handler);
    bus.off("transient", handler);

    // Should not throw
    bus.emit("transient", "data");
    assertEquals(bus.listenerCount("transient"), 0);
});

// ---------------------------------------------------------------------------
// Same handler registered multiple times
// ---------------------------------------------------------------------------

Deno.test("same handler reference registered twice is stored once (Set behavior)", () => {
    const bus = new EventBus();
    const handler = () => {};

    bus.on("dedup", handler);
    bus.on("dedup", handler);

    // Set-based storage means the handler is only stored once
    assertEquals(bus.listenerCount("dedup"), 1);
});

// ---------------------------------------------------------------------------
// Event data types
// ---------------------------------------------------------------------------

Deno.test("emit passes various data types correctly", () => {
    const bus = new EventBus();
    const received: unknown[] = [];

    bus.on("types", (data) => received.push(data));

    bus.emit("types", 42);
    bus.emit("types", "string");
    bus.emit("types", null);
    bus.emit("types", [1, 2, 3]);
    bus.emit("types", { nested: { deep: true } });

    assertEquals(received[0], 42);
    assertEquals(received[1], "string");
    assertEquals(received[2], null);
    assertEquals(received[3], [1, 2, 3]);
    assertEquals(received[4], { nested: { deep: true } });
});
