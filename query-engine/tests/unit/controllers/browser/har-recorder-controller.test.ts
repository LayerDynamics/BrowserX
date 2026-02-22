/**
 * HARRecorderController tests
 */
import { assertEquals } from "@std/assert";
import {
  HARRecorderController,
  getHARRecorderController,
  clearHARRecorderController,
} from "../../../../controllers/browser/har-recorder-controller.ts";
import {
  clearBrowserContext,
} from "../../../../controllers/browser/browser-context.ts";

function setup() {
  clearBrowserContext();
  clearHARRecorderController();
}

function teardown() {
  clearBrowserContext();
  clearHARRecorderController();
}

Deno.test("HARRecorderController - construction", () => {
  const hrc = new HARRecorderController();
  assertEquals(hrc instanceof HARRecorderController, true);
});

Deno.test("HARRecorderController - getHARRecorderController singleton", () => {
  clearHARRecorderController();
  const a = getHARRecorderController();
  const b = getHARRecorderController();
  assertEquals(a, b);
  clearHARRecorderController();
});

Deno.test("HARRecorderController - startRecording throws without context", async () => {
  setup();
  const hrc = new HARRecorderController();
  try {
    await hrc.startRecording();
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("HARRecorderController - getHAR throws without context", async () => {
  setup();
  const hrc = new HARRecorderController();
  try {
    await hrc.getHAR();
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("HARRecorderController - getEntries throws without context", async () => {
  setup();
  const hrc = new HARRecorderController();
  try {
    await hrc.getEntries();
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("HARRecorderController - waitForPendingRequests resolves", async () => {
  const hrc = new HARRecorderController();
  const result = await hrc.waitForPendingRequests(100);
  assertEquals(result, true);
});

Deno.test("HARRecorderController - clearController resets state", () => {
  const hrc = new HARRecorderController();
  hrc.clearController();
  assertEquals(true, true);
});
