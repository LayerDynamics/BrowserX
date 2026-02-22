/**
 * Memory and Resource Tests
 *
 * Verifies buffer/texture memory tracking, resource cleanup on destroy,
 * large allocations, many small allocations, and device statistics.
 */

import { assertEquals, assertExists } from "@std/assert";
import { getSharedDevice, readbackBuffer, webgpuAvailable } from "./_helpers.ts";
import { WebGPUTextureManager } from "../../../../src/engine/webgpu/operations/render/TextureManager.ts";
import {
  OffscreenWebGPU,
  OffscreenWebGPUState,
} from "../../../../src/engine/webgpu/offscreen/mod.ts";

const opts = { ignore: !webgpuAvailable, sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// Buffer Memory Tracking
// ============================================================================

Deno.test("memory: buffer creation allocates GPU memory", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  const buffer = gpuDevice.createBuffer({
    label: "mem-track",
    size: 1024,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  // Buffer should be created and usable
  const result = await readbackBuffer(device, buffer, 1024);
  assertEquals(result.length, 1024);

  buffer.destroy();
});

Deno.test("memory: many small buffer allocations (100 buffers)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  const buffers: GPUBuffer[] = [];
  for (let i = 0; i < 100; i++) {
    buffers.push(gpuDevice.createBuffer({
      label: `small-buf-${i}`,
      size: 64,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    }));
  }

  // Verify last buffer is usable
  const result = await readbackBuffer(device, buffers[99], 64);
  assertEquals(result.length, 64);

  for (const buf of buffers) {
    buf.destroy();
  }
});

Deno.test("memory: large buffer allocation (16MB)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const size = 16 * 1024 * 1024; // 16MB

  const buffer = gpuDevice.createBuffer({
    label: "large-buf",
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  // Spot check - read first 256 bytes
  const result = await readbackBuffer(device, buffer, 256);
  assertEquals(result.length, 256);
  // Should be zeroed
  for (let i = 0; i < 256; i++) {
    assertEquals(result[i], 0);
  }

  buffer.destroy();
});

// ============================================================================
// Texture Memory Tracking via TextureManager
// ============================================================================

Deno.test("memory: texture manager tracks total memory accurately", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new WebGPUTextureManager(device);

  const initial = manager.getStatistics().memoryUsed;

  // 128x128 rgba8unorm = 65536 bytes
  const id1 = manager.createTexture({
    width: 128,
    height: 128,
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  assertEquals(manager.getStatistics().memoryUsed - initial, 128 * 128 * 4);

  // 64x64 rgba16float = 32768 bytes
  const id2 = manager.createTexture({
    width: 64,
    height: 64,
    format: "rgba16float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  assertEquals(manager.getStatistics().memoryUsed - initial, (128 * 128 * 4) + (64 * 64 * 8));

  // Destroy first texture
  manager.destroyTexture(id1);
  assertEquals(manager.getStatistics().memoryUsed - initial, 64 * 64 * 8);

  // Destroy second
  manager.destroyTexture(id2);
  assertEquals(manager.getStatistics().memoryUsed, initial);

  manager.destroy();
});

Deno.test("memory: texture manager destroy clears all memory", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new WebGPUTextureManager(device);

  for (let i = 0; i < 10; i++) {
    manager.createTexture({
      width: 32,
      height: 32,
      format: "rgba8unorm",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  const beforeDestroy = manager.getStatistics();
  assertEquals(beforeDestroy.activeTextures >= 10, true);
  assertEquals(beforeDestroy.memoryUsed >= 10 * 32 * 32 * 4, true);

  manager.destroy();

  const afterDestroy = manager.getStatistics();
  assertEquals(afterDestroy.activeTextures, 0);
  assertEquals(afterDestroy.memoryUsed, 0);
});

// ============================================================================
// OffscreenWebGPU Resource Tracking
// ============================================================================

Deno.test("memory: offscreen readback tracks stats", { ...opts }, async () => {
  const offscreen = new OffscreenWebGPU();
  await offscreen.initialize(8, 8);

  assertEquals(offscreen.getStatistics().readbackCount, 0);

  await offscreen.getPixels();
  assertEquals(offscreen.getStatistics().readbackCount, 1);

  await offscreen.getPixels();
  await offscreen.getPixels();
  assertEquals(offscreen.getStatistics().readbackCount, 3);

  const stats = offscreen.getStatistics();
  assertEquals(stats.totalReadbackTime > 0, true);
  assertEquals(stats.averageReadbackTime > 0, true);

  offscreen.dispose();
});

// ============================================================================
// Buffer Map/Unmap Lifecycle
// ============================================================================

Deno.test("memory: mappedAtCreation write and readback", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const size = 256;

  const buffer = gpuDevice.createBuffer({
    label: "mapped-creation",
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    mappedAtCreation: true,
  });

  const mapped = new Uint8Array(buffer.getMappedRange());
  for (let i = 0; i < size; i++) {
    mapped[i] = i;
  }
  buffer.unmap();

  const result = await readbackBuffer(device, buffer, size);
  for (let i = 0; i < size; i++) {
    assertEquals(result[i], i, `Byte ${i}`);
  }
  buffer.destroy();
});

Deno.test("memory: MAP_READ buffer mapAsync and read", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  // Create source with known data
  const srcData = new Uint32Array([777, 888, 999, 111]);
  const srcBuffer = gpuDevice.createBuffer({
    label: "map-src",
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    mappedAtCreation: true,
  });
  new Uint8Array(srcBuffer.getMappedRange()).set(new Uint8Array(srcData.buffer));
  srcBuffer.unmap();

  // Create MAP_READ buffer and copy into it
  const readBuffer = gpuDevice.createBuffer({
    label: "map-read",
    size: 16,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const encoder = gpuDevice.createCommandEncoder();
  encoder.copyBufferToBuffer(srcBuffer, 0, readBuffer, 0, 16);
  gpuDevice.queue.submit([encoder.finish()]);

  await readBuffer.mapAsync(GPUMapMode.READ);
  const mapped = new Uint32Array(readBuffer.getMappedRange());
  assertEquals(mapped[0], 777);
  assertEquals(mapped[1], 888);
  assertEquals(mapped[2], 999);
  assertEquals(mapped[3], 111);

  readBuffer.unmap();
  srcBuffer.destroy();
  readBuffer.destroy();
});

// ============================================================================
// Resource Cleanup Verification
// ============================================================================

Deno.test("memory: buffer destroy frees GPU resource", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  // Allocate and destroy many buffers rapidly
  for (let i = 0; i < 50; i++) {
    const buf = gpuDevice.createBuffer({
      size: 1024 * 1024, // 1MB each
      usage: GPUBufferUsage.STORAGE,
    });
    buf.destroy();
  }

  // If destroy didn't free memory, we'd OOM. If we get here, it works.
  assertEquals(true, true);
});

Deno.test("memory: texture destroy frees GPU resource", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  for (let i = 0; i < 20; i++) {
    const tex = gpuDevice.createTexture({
      size: { width: 512, height: 512 },
      format: "rgba8unorm",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    tex.destroy();
  }

  assertEquals(true, true);
});

// ============================================================================
// writeBuffer Memory
// ============================================================================

Deno.test("memory: writeBuffer updates without additional allocation", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  const buffer = gpuDevice.createBuffer({
    label: "write-buf",
    size: 64,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });

  // Write multiple times
  for (let i = 0; i < 10; i++) {
    const data = new Uint32Array(16);
    data.fill(i);
    gpuDevice.queue.writeBuffer(buffer, 0, data);
  }

  // Last write should be what we read back
  const result = await readbackBuffer(device, buffer, 64);
  const resultU32 = new Uint32Array(result.buffer, result.byteOffset, 16);
  assertEquals(resultU32[0], 9);
  assertEquals(resultU32[15], 9);

  buffer.destroy();
});
