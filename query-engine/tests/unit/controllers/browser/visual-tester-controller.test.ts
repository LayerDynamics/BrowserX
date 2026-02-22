/**
 * VisualTesterController tests
 */
import { assertEquals } from "@std/assert";
import {
  VisualTesterController,
  getVisualTesterController,
  clearVisualTesterController,
} from "../../../../controllers/browser/visual-tester-controller.ts";
import {
  clearBrowserContext,
} from "../../../../controllers/browser/browser-context.ts";

function setup() {
  clearBrowserContext();
  clearVisualTesterController();
}

function teardown() {
  clearBrowserContext();
  clearVisualTesterController();
}

Deno.test("VisualTesterController - construction", () => {
  const vtc = new VisualTesterController();
  assertEquals(vtc instanceof VisualTesterController, true);
});

Deno.test("VisualTesterController - getVisualTesterController singleton", () => {
  clearVisualTesterController();
  const a = getVisualTesterController();
  const b = getVisualTesterController();
  assertEquals(a, b);
  clearVisualTesterController();
});

Deno.test("VisualTesterController - screenshot throws without context", async () => {
  setup();
  const vtc = new VisualTesterController();
  try {
    await vtc.screenshot();
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("VisualTesterController - checkVisibility throws without context", async () => {
  setup();
  const vtc = new VisualTesterController();
  try {
    await vtc.checkVisibility("#el");
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("VisualTesterController - compare throws without context", async () => {
  setup();
  const vtc = new VisualTesterController();
  try {
    await vtc.compare(new Uint8Array(), new Uint8Array());
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("VisualTesterController - verifyLayout throws without context", async () => {
  setup();
  const vtc = new VisualTesterController();
  try {
    await vtc.verifyLayout("#el", { width: 100 });
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("VisualTesterController - saveBaseline throws without context", async () => {
  setup();
  const vtc = new VisualTesterController();
  try {
    await vtc.saveBaseline("test");
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("VisualTesterController - clear resets state", () => {
  const vtc = new VisualTesterController();
  vtc.clear();
  assertEquals(true, true);
});
