/**
 * ThreadWorker Tests
 *
 * ThreadWorker requires a real Deno.Worker (a script file path) to instantiate,
 * so tests focus on module exports and the createWorkerHandler utility function.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../../core/thread/worker.ts";

// ============================================================================
// Module exports
// ============================================================================

Deno.test({
  name: "ThreadWorker module - exports ThreadWorker class",
  fn() {
    assert(typeof mod.ThreadWorker === "function");
  },
});

Deno.test({
  name: "ThreadWorker module - ThreadWorker.name is 'ThreadWorker'",
  fn() {
    assertEquals(mod.ThreadWorker.name, "ThreadWorker");
  },
});

Deno.test({
  name: "ThreadWorker module - exports createWorkerHandler function",
  fn() {
    assert(typeof mod.createWorkerHandler === "function");
  },
});

// ============================================================================
// ThreadWorker prototype
// ============================================================================

Deno.test({
  name: "ThreadWorker - prototype has sendTask method",
  fn() {
    assert(typeof mod.ThreadWorker.prototype.sendTask === "function");
  },
});

Deno.test({
  name: "ThreadWorker - prototype has terminate method",
  fn() {
    assert(typeof mod.ThreadWorker.prototype.terminate === "function");
  },
});

Deno.test({
  name: "ThreadWorker - prototype has pause method",
  fn() {
    assert(typeof mod.ThreadWorker.prototype.pause === "function");
  },
});

Deno.test({
  name: "ThreadWorker - prototype has resume method",
  fn() {
    assert(typeof mod.ThreadWorker.prototype.resume === "function");
  },
});

Deno.test({
  name: "ThreadWorker - prototype has getStats method",
  fn() {
    assert(typeof mod.ThreadWorker.prototype.getStats === "function");
  },
});

Deno.test({
  name: "ThreadWorker - prototype has ping method",
  fn() {
    assert(typeof mod.ThreadWorker.prototype.ping === "function");
  },
});

// ============================================================================
// createWorkerHandler()
// ============================================================================

Deno.test({
  name: "createWorkerHandler - sets self.onmessage to a function",
  fn() {
    const prevHandler = (self as unknown as { onmessage: unknown }).onmessage;
    mod.createWorkerHandler(() => "result");
    const newHandler = (self as unknown as { onmessage: unknown }).onmessage;
    assertExists(newHandler);
    assert(typeof newHandler === "function");
    // Restore
    (self as unknown as { onmessage: unknown }).onmessage = prevHandler;
  },
});

Deno.test({
  name: "createWorkerHandler - accepts async handler",
  fn() {
    const prevHandler = (self as unknown as { onmessage: unknown }).onmessage;
    mod.createWorkerHandler(async () => {
      await Promise.resolve();
      return "async result";
    });
    const handler = (self as unknown as { onmessage: unknown }).onmessage;
    assertExists(handler);
    (self as unknown as { onmessage: unknown }).onmessage = prevHandler;
  },
});

Deno.test({
  name: "createWorkerHandler - replaces previous handler on second call",
  fn() {
    const prevHandler = (self as unknown as { onmessage: unknown }).onmessage;
    mod.createWorkerHandler(() => 1);
    const handler1 = (self as unknown as { onmessage: unknown }).onmessage;
    mod.createWorkerHandler(() => 2);
    const handler2 = (self as unknown as { onmessage: unknown }).onmessage;
    assert(handler1 !== handler2);
    (self as unknown as { onmessage: unknown }).onmessage = prevHandler;
  },
});
