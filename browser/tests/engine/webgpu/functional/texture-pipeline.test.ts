/**
 * Texture Pipeline Tests
 *
 * Verifies TextureManager create/get/destroy lifecycle, memory tracking,
 * pixel upload/readback, sampler caching, and various formats.
 */

import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { assertSolidColor, getSharedDevice, readbackTexture, webgpuAvailable } from "./_helpers.ts";
import { WebGPUTextureManager } from "../../../../src/engine/webgpu/operations/render/TextureManager.ts";

const opts = { ignore: !webgpuAvailable, sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// TextureManager Lifecycle
// ============================================================================

Deno.test("texture manager: create and get texture", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new WebGPUTextureManager(device);

  const id = manager.createTexture({
    width: 64,
    height: 64,
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.TEXTURE_BINDING,
    label: "test-tex",
  });

  assertExists(id);
  const texture = manager.getTexture(id);
  assertExists(texture);

  manager.destroyTexture(id);
  manager.destroy();
});

Deno.test("texture manager: destroy removes texture", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new WebGPUTextureManager(device);

  const id = manager.createTexture({
    width: 32,
    height: 32,
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  manager.destroyTexture(id);
  const texture = manager.getTexture(id);
  assertEquals(texture, null);

  manager.destroy();
});

Deno.test("texture manager: destroy idempotent", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new WebGPUTextureManager(device);

  const id = manager.createTexture({
    width: 16,
    height: 16,
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  manager.destroyTexture(id);
  manager.destroyTexture(id); // Should not throw

  manager.destroy();
});

// ============================================================================
// Memory Tracking
// ============================================================================

Deno.test("texture manager: memory tracking for rgba8unorm", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new WebGPUTextureManager(device);

  const statsBefore = manager.getStatistics();
  const memBefore = statsBefore.memoryUsed;

  const id = manager.createTexture({
    width: 64,
    height: 64,
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  const statsAfter = manager.getStatistics();
  // rgba8unorm = 4 bytes per pixel, 64x64 = 16384 bytes
  assertEquals(statsAfter.memoryUsed - memBefore, 64 * 64 * 4);

  manager.destroyTexture(id);
  const statsDestroyed = manager.getStatistics();
  assertEquals(statsDestroyed.memoryUsed, memBefore);

  manager.destroy();
});

Deno.test("texture manager: memory tracking for rgba16float", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new WebGPUTextureManager(device);

  const statsBefore = manager.getStatistics();
  const memBefore = statsBefore.memoryUsed;

  const id = manager.createTexture({
    width: 32,
    height: 32,
    format: "rgba16float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  const statsAfter = manager.getStatistics();
  // rgba16float = 8 bytes per pixel
  assertEquals(statsAfter.memoryUsed - memBefore, 32 * 32 * 8);

  manager.destroyTexture(id);
  manager.destroy();
});

Deno.test("texture manager: multiple textures accumulate memory", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new WebGPUTextureManager(device);

  const statsBefore = manager.getStatistics();
  const memBefore = statsBefore.memoryUsed;

  const id1 = manager.createTexture({
    width: 16,
    height: 16,
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  const id2 = manager.createTexture({
    width: 32,
    height: 32,
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const statsAfter = manager.getStatistics();
  assertEquals(statsAfter.memoryUsed - memBefore, (16 * 16 * 4) + (32 * 32 * 4));
  assertEquals(statsAfter.activeTextures, statsBefore.activeTextures + 2);

  manager.destroyTexture(id1);
  manager.destroyTexture(id2);
  manager.destroy();
});

// ============================================================================
// Pixel Upload and Readback
// ============================================================================

Deno.test("texture manager: upload and readback pixels", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new WebGPUTextureManager(device);
  const w = 8, h = 8;

  const id = manager.createTexture({
    width: w,
    height: h,
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST |
      GPUTextureUsage.TEXTURE_BINDING,
  });

  const texture = manager.getTexture(id)!;
  const gpuDevice = device.getDevice();

  // Upload solid blue
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4 + 2] = 255; // B
    data[i * 4 + 3] = 255; // A
  }
  gpuDevice.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: w * 4, rowsPerImage: h },
    { width: w, height: h },
  );

  const pixels = await readbackTexture(device, texture, w, h);
  assertSolidColor(pixels, 0, 0, 255, 255);

  manager.destroyTexture(id);
  manager.destroy();
});

// ============================================================================
// Sampler Caching
// ============================================================================

Deno.test(
  "texture manager: sampler caching - same config returns same sampler",
  { ...opts },
  async () => {
    const device = await getSharedDevice();
    const manager = new WebGPUTextureManager(device);

    const sampler1 = manager.getSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
    const sampler2 = manager.getSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    assertEquals(sampler1, sampler2);
    manager.destroy();
  },
);

Deno.test("texture manager: sampler caching - different config returns different sampler", {
  ...opts,
}, async () => {
  const device = await getSharedDevice();
  const manager = new WebGPUTextureManager(device);

  const linear = manager.getSampler({
    magFilter: "linear",
    minFilter: "linear",
  });
  const nearest = manager.getSampler({
    magFilter: "nearest",
    minFilter: "nearest",
  });

  // Different configs should produce different sampler instances
  assertEquals(
    linear !== nearest,
    true,
    "Different sampler configs should produce different instances",
  );
  manager.destroy();
});

// ============================================================================
// Large Texture
// ============================================================================

Deno.test("texture manager: large texture 512x512", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new WebGPUTextureManager(device);

  const id = manager.createTexture({
    width: 512,
    height: 512,
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  const texture = manager.getTexture(id);
  assertExists(texture);

  const stats = manager.getStatistics();
  assertEquals(stats.memoryUsed >= 512 * 512 * 4, true);

  manager.destroyTexture(id);
  manager.destroy();
});

// ============================================================================
// Active Texture Count
// ============================================================================

Deno.test(
  "texture manager: active texture count tracks create and destroy",
  { ...opts },
  async () => {
    const device = await getSharedDevice();
    const manager = new WebGPUTextureManager(device);

    const initial = manager.getStatistics().activeTextures;

    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(manager.createTexture({
        width: 4,
        height: 4,
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      }));
    }
    assertEquals(manager.getStatistics().activeTextures, initial + 5);

    for (const id of ids) {
      manager.destroyTexture(id);
    }
    assertEquals(manager.getStatistics().activeTextures, initial);

    manager.destroy();
  },
);

// ============================================================================
// Manager Destroy Cleans Up All
// ============================================================================

Deno.test("texture manager: destroy cleans up all textures", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new WebGPUTextureManager(device);

  for (let i = 0; i < 3; i++) {
    manager.createTexture({
      width: 8,
      height: 8,
      format: "rgba8unorm",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  manager.destroy();
  const stats = manager.getStatistics();
  assertEquals(stats.activeTextures, 0);
  assertEquals(stats.memoryUsed, 0);
});

// ============================================================================
// Different Formats
// ============================================================================

Deno.test("texture manager: create textures with various formats", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new WebGPUTextureManager(device);

  const formats: GPUTextureFormat[] = ["rgba8unorm", "bgra8unorm", "rgba16float", "r8unorm"];
  const ids: string[] = [];

  for (const format of formats) {
    ids.push(manager.createTexture({
      width: 16,
      height: 16,
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    }));
  }

  for (const id of ids) {
    assertExists(manager.getTexture(id));
  }

  for (const id of ids) {
    manager.destroyTexture(id);
  }
  manager.destroy();
});

// ============================================================================
// Sampler Count Stats
// ============================================================================

Deno.test("texture manager: sampler stats track creation", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new WebGPUTextureManager(device);

  const before = manager.getStatistics().samplersCreated;

  manager.getSampler({ magFilter: "linear", minFilter: "linear" });
  assertEquals(manager.getStatistics().samplersCreated, before + 1);

  // Same config doesn't increment
  manager.getSampler({ magFilter: "linear", minFilter: "linear" });
  assertEquals(manager.getStatistics().samplersCreated, before + 1);

  // Different config increments
  manager.getSampler({ magFilter: "nearest", minFilter: "nearest" });
  assertEquals(manager.getStatistics().samplersCreated, before + 2);

  manager.destroy();
});
