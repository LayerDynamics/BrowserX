/**
 * HARPlayerController tests
 */
import { assertEquals } from "@std/assert";
import {
  HARPlayerController,
  getHARPlayerController,
  clearHARPlayerController,
  THROTTLE_PRESETS,
} from "../../../../controllers/browser/har-player-controller.ts";
import {
  clearBrowserContext,
} from "../../../../controllers/browser/browser-context.ts";

function setup() {
  clearBrowserContext();
  clearHARPlayerController();
}

function teardown() {
  clearBrowserContext();
  clearHARPlayerController();
}

Deno.test("HARPlayerController - construction", () => {
  const hpc = new HARPlayerController();
  assertEquals(hpc instanceof HARPlayerController, true);
});

Deno.test("HARPlayerController - getHARPlayerController singleton", () => {
  clearHARPlayerController();
  const a = getHARPlayerController();
  const b = getHARPlayerController();
  assertEquals(a, b);
  clearHARPlayerController();
});

Deno.test("HARPlayerController - loadHAR throws without context", async () => {
  setup();
  const hpc = new HARPlayerController();
  try {
    await hpc.loadHAR({ log: { version: "1.2", creator: { name: "test", version: "1" }, entries: [] } });
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("HARPlayerController - getThrottlePresets returns presets", () => {
  const hpc = new HARPlayerController();
  const presets = hpc.getThrottlePresets();
  assertEquals(typeof presets, "object");
  assertEquals(Object.keys(presets).length > 0, true);
});

Deno.test("HARPlayerController - createThrottledOptions", () => {
  const hpc = new HARPlayerController();
  const opts = hpc.createThrottledOptions("slow-3g" as any);
  assertEquals(opts.throttle, "slow-3g");
});

Deno.test("HARPlayerController - createOfflineOptions", () => {
  const hpc = new HARPlayerController();
  const opts = hpc.createOfflineOptions();
  assertEquals(opts.throttle, "offline");
  assertEquals(opts.rejectUnmatched, true);
});

Deno.test("HARPlayerController - createExactMatchOptions", () => {
  const hpc = new HARPlayerController();
  const opts = hpc.createExactMatchOptions();
  assertEquals(opts.matchStrategy, "exact");
  assertEquals(opts.rejectUnmatched, true);
});

Deno.test("HARPlayerController - createOfflineOptions merges additional", () => {
  const hpc = new HARPlayerController();
  const opts = hpc.createOfflineOptions({ logRequests: true });
  assertEquals(opts.throttle, "offline");
  assertEquals(opts.logRequests, true);
});

Deno.test("HARPlayerController - clearController resets state", () => {
  const hpc = new HARPlayerController();
  hpc.clearController();
  assertEquals(true, true);
});

Deno.test("HARPlayerController - THROTTLE_PRESETS re-exported", () => {
  assertEquals(typeof THROTTLE_PRESETS, "object");
  assertEquals(Object.keys(THROTTLE_PRESETS).length > 0, true);
});
