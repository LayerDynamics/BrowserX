import { assertEquals } from "@std/assert";
import { WorkerNavigator } from "../../../src/engine/webgpu/worker/WorkerNavigator.ts";

Deno.test("WorkerNavigator - gpu is null when unavailable", () => {
  const nav = new WorkerNavigator({ gpuAvailable: false });
  assertEquals(nav.gpu, null);
  assertEquals(nav.isGPUAvailable(), false);
});

Deno.test("WorkerNavigator - default constructor checks globalThis", () => {
  // In Deno test environment, navigator.gpu is typically null
  const nav = new WorkerNavigator();
  assertEquals(nav.isGPUAvailable(), typeof navigator !== "undefined" && !!navigator.gpu);
});

Deno.test("WorkerNavigator - install returns instance", () => {
  const nav = WorkerNavigator.install();
  assertEquals(nav instanceof WorkerNavigator, true);
});

Deno.test("WorkerNavigator - gpuAvailable false forces null", () => {
  const nav = new WorkerNavigator({ gpuAvailable: false });
  assertEquals(nav.gpu, null);
});
