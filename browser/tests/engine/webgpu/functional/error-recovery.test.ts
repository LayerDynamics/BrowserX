/**
 * Error Recovery Tests
 *
 * Verifies graceful error handling: invalid dimensions, double dispose,
 * operations after destroy, resize behavior, and invalid shader WGSL.
 */

import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { getSharedDevice, webgpuAvailable } from "./_helpers.ts";
import {
  OffscreenWebGPU,
  OffscreenWebGPUError,
  OffscreenWebGPUState,
} from "../../../../src/engine/webgpu/offscreen/mod.ts";
import { WebGPUDevice } from "../../../../src/engine/webgpu/adapter/Device.ts";

const opts = { ignore: !webgpuAvailable, sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// OffscreenWebGPU Error Cases
// ============================================================================

Deno.test("offscreen: valid initialization", { ...opts }, async () => {
  const offscreen = new OffscreenWebGPU();
  await offscreen.initialize(32, 32);
  assertEquals(offscreen.getState(), OffscreenWebGPUState.READY);
  offscreen.dispose();
});

Deno.test("offscreen: dispose sets state to DESTROYED", { ...opts }, async () => {
  const offscreen = new OffscreenWebGPU();
  await offscreen.initialize(16, 16);
  offscreen.dispose();
  assertEquals(offscreen.getState(), OffscreenWebGPUState.DESTROYED);
});

Deno.test("offscreen: double dispose does not throw", { ...opts }, async () => {
  const offscreen = new OffscreenWebGPU();
  await offscreen.initialize(16, 16);
  offscreen.dispose();
  offscreen.dispose(); // Should not throw
  assertEquals(offscreen.getState(), OffscreenWebGPUState.DESTROYED);
});

Deno.test("offscreen: getPixels after dispose throws", { ...opts }, async () => {
  const offscreen = new OffscreenWebGPU();
  await offscreen.initialize(16, 16);
  offscreen.dispose();
  await assertRejects(
    () => offscreen.getPixels(),
    OffscreenWebGPUError,
  );
});

Deno.test("offscreen: resize to new dimensions", { ...opts }, async () => {
  const offscreen = new OffscreenWebGPU();
  await offscreen.initialize(16, 16);

  const stats1 = offscreen.getStatistics();
  assertEquals(stats1.width, 16);
  assertEquals(stats1.height, 16);

  offscreen.resize(32, 32);

  const stats2 = offscreen.getStatistics();
  assertEquals(stats2.width, 32);
  assertEquals(stats2.height, 32);

  offscreen.dispose();
});

Deno.test("offscreen: resize to same dimensions is no-op", { ...opts }, async () => {
  const offscreen = new OffscreenWebGPU();
  await offscreen.initialize(16, 16);

  // Should not throw or create new resources
  offscreen.resize(16, 16);

  const stats = offscreen.getStatistics();
  assertEquals(stats.width, 16);
  assertEquals(stats.height, 16);

  offscreen.dispose();
});

Deno.test("offscreen: statistics reflect correct state", { ...opts }, async () => {
  const offscreen = new OffscreenWebGPU();
  await offscreen.initialize(64, 48);

  const stats = offscreen.getStatistics();
  assertEquals(stats.state, OffscreenWebGPUState.READY);
  assertEquals(stats.width, 64);
  assertEquals(stats.height, 48);
  assertEquals(stats.textureFormat, "rgba8unorm");
  assertEquals(stats.readbackCount, 0);

  offscreen.dispose();
});

Deno.test("offscreen: readback increments statistics", { ...opts }, async () => {
  const offscreen = new OffscreenWebGPU();
  await offscreen.initialize(4, 4);

  await offscreen.getPixels();
  await offscreen.getPixels();

  const stats = offscreen.getStatistics();
  assertEquals(stats.readbackCount, 2);

  offscreen.dispose();
});

// ============================================================================
// WebGPUDevice Error Cases
// ============================================================================

Deno.test("device: destroy is idempotent", { ...opts }, async () => {
  const device = new WebGPUDevice();
  await device.initialize();
  device.destroy();
  device.destroy(); // Should not throw
});

// ============================================================================
// Buffer Error Cases
// ============================================================================

Deno.test("buffer: destroy is idempotent", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const buffer = gpuDevice.createBuffer({
    label: "destroy-test",
    size: 64,
    usage: GPUBufferUsage.STORAGE,
  });
  buffer.destroy();
  buffer.destroy(); // Should not throw
});

// ============================================================================
// Invalid Shader
// ============================================================================

Deno.test("shader: invalid WGSL produces compilation error info", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  const module = gpuDevice.createShaderModule({
    label: "bad-shader",
    code: "this is not valid WGSL at all!!!",
  });

  // Shader compilation info should report errors
  const info = await module.getCompilationInfo();
  const hasErrors = info.messages.some((m) => m.type === "error");
  assertEquals(hasErrors, true, "Invalid WGSL should produce compilation errors");
});

// ============================================================================
// Texture Constraints
// ============================================================================

Deno.test("texture: 1x1 minimum size works", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  const texture = gpuDevice.createTexture({
    label: "min-size",
    size: { width: 1, height: 1 },
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  // Should successfully create
  const view = texture.createView();
  assertEquals(view !== null, true);
  texture.destroy();
});

Deno.test("texture: destroy is idempotent", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  const texture = gpuDevice.createTexture({
    label: "destroy-tex",
    size: { width: 4, height: 4 },
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  texture.destroy();
  texture.destroy(); // Should not throw
});
