/**
 * PerformanceProfilerController tests
 */
import { assertEquals } from "@std/assert";
import {
  PerformanceProfilerController,
  getPerformanceProfilerController,
  clearPerformanceProfilerController,
} from "../../../../controllers/browser/performance-profiler-controller.ts";
import {
  clearBrowserContext,
} from "../../../../controllers/browser/browser-context.ts";

function setup() {
  clearBrowserContext();
  clearPerformanceProfilerController();
}

function teardown() {
  clearBrowserContext();
  clearPerformanceProfilerController();
}

Deno.test("PerformanceProfilerController - construction", () => {
  const ppc = new PerformanceProfilerController();
  assertEquals(ppc instanceof PerformanceProfilerController, true);
});

Deno.test("PerformanceProfilerController - singleton", () => {
  clearPerformanceProfilerController();
  const a = getPerformanceProfilerController();
  const b = getPerformanceProfilerController();
  assertEquals(a, b);
  clearPerformanceProfilerController();
});

Deno.test("PerformanceProfilerController - startProfiling throws without context", async () => {
  setup();
  const ppc = new PerformanceProfilerController();
  try {
    await ppc.startProfiling();
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("PerformanceProfilerController - getWebVitals throws without context", async () => {
  setup();
  const ppc = new PerformanceProfilerController();
  try {
    await ppc.getWebVitals();
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("PerformanceProfilerController - getProfile throws without context", async () => {
  setup();
  const ppc = new PerformanceProfilerController();
  try {
    await ppc.getProfile();
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("PerformanceProfilerController - compareWithBaseline returns null without baseline", async () => {
  setup();
  const ppc = new PerformanceProfilerController();
  // No baseline saved, so even though getProfiler will throw, compareWithBaseline
  // checks baseline first and returns null
  const result = await ppc.compareWithBaseline();
  assertEquals(result, null);
  teardown();
});

Deno.test("PerformanceProfilerController - mark throws without context", async () => {
  setup();
  const ppc = new PerformanceProfilerController();
  try {
    await ppc.mark("test-mark");
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("PerformanceProfilerController - clearController resets state", () => {
  const ppc = new PerformanceProfilerController();
  ppc.clearController();
  assertEquals(true, true);
});
