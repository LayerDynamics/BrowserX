import { assertEquals } from "@std/assert";
import { AnimationController } from "../../src/canvas/AnimationController.ts";

// ---------------------------------------------------------------------------
// Install mock requestAnimationFrame / cancelAnimationFrame for Deno.
// These replace the browser globals so the AnimationController can be tested
// without a real browser rendering pipeline.
// ---------------------------------------------------------------------------
let rafCallbacks: Array<(ts: number) => void> = [];

// Use an explicit cast to avoid TS7017 ("no index signature on typeof globalThis")
(globalThis as Record<string, unknown>)["requestAnimationFrame"] = (
  cb: (ts: number) => void,
): number => {
  rafCallbacks.push(cb);
  return rafCallbacks.length;
};

(globalThis as Record<string, unknown>)["cancelAnimationFrame"] = (_id: number): void => {
  rafCallbacks = [];
};

// performance.now is available in Deno; guard for completeness.
if (typeof globalThis.performance === "undefined") {
  (globalThis as Record<string, unknown>)["performance"] = { now: () => 0 };
}

/** Flush all currently queued rAF callbacks once, in order, with the given timestamp. */
function flushRaf(timestamp = 0): void {
  const pending = rafCallbacks.splice(0);
  for (const cb of pending) {
    cb(timestamp);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("AnimationController - start() sets isRunning true, stop() sets it false", () => {
  rafCallbacks = [];
  const controller = new AnimationController((_ts) => {});

  assertEquals(controller.isRunning, false);

  controller.start();
  assertEquals(controller.isRunning, true);

  controller.stop();
  assertEquals(controller.isRunning, false);
});

Deno.test("AnimationController - markDirty() causes renderFn to be called on next tick", () => {
  rafCallbacks = [];
  let callCount = 0;
  const controller = new AnimationController((_ts) => {
    callCount++;
  });

  // start() marks dirty=true and calls tick() synchronously, which fires renderFn once
  // (consuming the initial dirty flag), then queues the next rAF.
  controller.start();
  const countAfterStart = callCount; // 1 — the initial dirty render

  // Flush without marking dirty — renderFn must NOT fire again.
  flushRaf(1);
  assertEquals(callCount, countAfterStart, "renderFn should not fire when not dirty");

  // Now mark dirty and flush — renderFn must fire exactly once more.
  controller.markDirty();
  flushRaf(2);
  assertEquals(callCount, countAfterStart + 1, "renderFn should fire after markDirty");

  controller.stop();
});

Deno.test(
  "AnimationController - when not dirty, renderFn is NOT called on subsequent ticks",
  () => {
    rafCallbacks = [];
    let callCount = 0;
    const controller = new AnimationController((_ts) => {
      callCount++;
    });

    // After start() the dirty flag is consumed in the synchronous tick().
    controller.start();
    const countAfterStart = callCount; // 1 — one render on startup

    // Flush several rAF rounds without marking dirty — callCount must stay the same.
    flushRaf(10);
    flushRaf(20);
    flushRaf(30);

    assertEquals(
      callCount,
      countAfterStart,
      "renderFn must not fire on ticks when the controller is not dirty",
    );

    controller.stop();
  },
);
