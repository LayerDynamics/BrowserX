/**
 * Encoder State Machine Tests
 *
 * Verifies WebGPUCommandEncoder state transitions, invalid state errors,
 * and copy operations with data verification.
 */

import { assertEquals, assertThrows } from "@std/assert";
import {
  createBufferWithData,
  createRenderTarget,
  getSharedDevice,
  readbackBuffer,
  readbackTexture,
  webgpuAvailable,
} from "./_helpers.ts";
import { EncoderState, WebGPUCommandEncoder } from "../../../../src/engine/webgpu/encoder/mod.ts";

const opts = { ignore: !webgpuAvailable, sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// State Transitions
// ============================================================================

Deno.test("encoder: initial state is OPEN", { ...opts }, async () => {
  const device = await getSharedDevice();
  const encoder = new WebGPUCommandEncoder(device, "test-encoder");
  assertEquals(encoder.getState(), EncoderState.OPEN);
});

Deno.test("encoder: OPEN -> ENCODING_RENDER -> OPEN -> FINISHED", { ...opts }, async () => {
  const device = await getSharedDevice();
  const encoder = new WebGPUCommandEncoder(device, "render-flow");
  const texture = createRenderTarget(device, 4, 4);

  assertEquals(encoder.getState(), EncoderState.OPEN);

  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
  });
  assertEquals(encoder.getState(), EncoderState.ENCODING_RENDER);

  pass.end();
  encoder.endRenderPass();
  assertEquals(encoder.getState(), EncoderState.OPEN);

  const commandBuffer = encoder.finish();
  assertEquals(encoder.getState(), EncoderState.FINISHED);

  device.getDevice().queue.submit([commandBuffer]);
  texture.destroy();
});

Deno.test("encoder: OPEN -> ENCODING_COMPUTE -> OPEN -> FINISHED", { ...opts }, async () => {
  const device = await getSharedDevice();
  const encoder = new WebGPUCommandEncoder(device, "compute-flow");

  assertEquals(encoder.getState(), EncoderState.OPEN);

  const pass = encoder.beginComputePass({ label: "test-compute" });
  assertEquals(encoder.getState(), EncoderState.ENCODING_COMPUTE);

  pass.end();
  encoder.endComputePass();
  assertEquals(encoder.getState(), EncoderState.OPEN);

  const commandBuffer = encoder.finish();
  assertEquals(encoder.getState(), EncoderState.FINISHED);

  device.getDevice().queue.submit([commandBuffer]);
});

// ============================================================================
// Invalid State Transitions
// ============================================================================

Deno.test("encoder: cannot begin render pass while render pass active", { ...opts }, async () => {
  const device = await getSharedDevice();
  const encoder = new WebGPUCommandEncoder(device, "double-render");
  const texture = createRenderTarget(device, 4, 4);

  encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
  });

  assertThrows(() => {
    encoder.beginRenderPass({
      colorAttachments: [{
        view: texture.createView(),
        loadOp: "clear" as GPULoadOp,
        storeOp: "store" as GPUStoreOp,
        clearValue: { r: 1, g: 0, b: 0, a: 1 },
      }],
    });
  });

  texture.destroy();
});

Deno.test("encoder: cannot begin compute pass while render pass active", { ...opts }, async () => {
  const device = await getSharedDevice();
  const encoder = new WebGPUCommandEncoder(device, "render-then-compute");
  const texture = createRenderTarget(device, 4, 4);

  encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
  });

  assertThrows(() => {
    encoder.beginComputePass({ label: "illegal" });
  });

  texture.destroy();
});

Deno.test("encoder: cannot begin render pass while compute pass active", { ...opts }, async () => {
  const device = await getSharedDevice();
  const encoder = new WebGPUCommandEncoder(device, "compute-then-render");
  const texture = createRenderTarget(device, 4, 4);

  encoder.beginComputePass({ label: "test" });

  assertThrows(() => {
    encoder.beginRenderPass({
      colorAttachments: [{
        view: texture.createView(),
        loadOp: "clear" as GPULoadOp,
        storeOp: "store" as GPUStoreOp,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      }],
    });
  });

  texture.destroy();
});

Deno.test("encoder: cannot begin compute pass while compute pass active", { ...opts }, async () => {
  const device = await getSharedDevice();
  const encoder = new WebGPUCommandEncoder(device, "double-compute");

  encoder.beginComputePass({ label: "first" });

  assertThrows(() => {
    encoder.beginComputePass({ label: "second" });
  });
});

// ============================================================================
// Finish Constraints
// ============================================================================

Deno.test("encoder: cannot begin render pass after finish", { ...opts }, async () => {
  const device = await getSharedDevice();
  const encoder = new WebGPUCommandEncoder(device, "finished-render");
  const cmdBuf = encoder.finish();
  device.getDevice().queue.submit([cmdBuf]);

  const texture = createRenderTarget(device, 4, 4);
  assertThrows(() => {
    encoder.beginRenderPass({
      colorAttachments: [{
        view: texture.createView(),
        loadOp: "clear" as GPULoadOp,
        storeOp: "store" as GPUStoreOp,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      }],
    });
  });
  texture.destroy();
});

Deno.test("encoder: cannot begin compute pass after finish", { ...opts }, async () => {
  const device = await getSharedDevice();
  const encoder = new WebGPUCommandEncoder(device, "finished-compute");
  const cmdBuf = encoder.finish();
  device.getDevice().queue.submit([cmdBuf]);

  assertThrows(() => {
    encoder.beginComputePass({ label: "illegal" });
  });
});

// ============================================================================
// Statistics
// ============================================================================

Deno.test("encoder: statistics track render passes", { ...opts }, async () => {
  const device = await getSharedDevice();
  const encoder = new WebGPUCommandEncoder(device, "stats-render");
  const texture = createRenderTarget(device, 4, 4);

  let stats = encoder.getStatistics();
  assertEquals(stats.renderPassCount, 0);
  assertEquals(stats.computePassCount, 0);

  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
  });
  pass.end();
  encoder.endRenderPass();

  stats = encoder.getStatistics();
  assertEquals(stats.renderPassCount, 1);
  assertEquals(stats.computePassCount, 0);

  const cmdBuf = encoder.finish();
  device.getDevice().queue.submit([cmdBuf]);
  texture.destroy();
});

Deno.test("encoder: statistics track compute passes", { ...opts }, async () => {
  const device = await getSharedDevice();
  const encoder = new WebGPUCommandEncoder(device, "stats-compute");

  const pass = encoder.beginComputePass({ label: "c1" });
  pass.end();
  encoder.endComputePass();

  const stats = encoder.getStatistics();
  assertEquals(stats.computePassCount, 1);
  assertEquals(stats.renderPassCount, 0);

  const cmdBuf = encoder.finish();
  device.getDevice().queue.submit([cmdBuf]);
});

// ============================================================================
// Copy Operations with Data Verification
// ============================================================================

Deno.test("encoder: copyBufferToBuffer with data verification", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const data = new Uint32Array([11, 22, 33, 44]);
  const src = createBufferWithData(device, data, GPUBufferUsage.STORAGE);
  const dst = gpuDevice.createBuffer({
    label: "copy-dst",
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });

  const encoder = new WebGPUCommandEncoder(device, "copy-buf");
  encoder.copyBufferToBuffer({
    source: src,
    destination: dst,
    size: 16,
  });

  const stats = encoder.getStatistics();
  assertEquals(stats.copyOperationCount, 1);

  const cmdBuf = encoder.finish();
  gpuDevice.queue.submit([cmdBuf]);

  const result = await readbackBuffer(device, dst, 16);
  const resultU32 = new Uint32Array(result.buffer, result.byteOffset, 4);
  assertEquals(resultU32[0], 11);
  assertEquals(resultU32[3], 44);

  src.destroy();
  dst.destroy();
});

Deno.test("encoder: copyBufferToTexture with data verification", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 4, h = 4;
  const pixelData = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    pixelData[i * 4 + 0] = 255; // R
    pixelData[i * 4 + 3] = 255; // A
  }

  const paddedBytesPerRow = Math.ceil((w * 4) / 256) * 256;
  const paddedData = new Uint8Array(paddedBytesPerRow * h);
  for (let row = 0; row < h; row++) {
    paddedData.set(pixelData.subarray(row * w * 4, (row + 1) * w * 4), row * paddedBytesPerRow);
  }

  const srcBuffer = createBufferWithData(device, paddedData, GPUBufferUsage.STORAGE);
  const texture = createRenderTarget(device, w, h);

  const encoder = new WebGPUCommandEncoder(device, "buf-to-tex");
  encoder.copyBufferToTexture({
    source: { buffer: srcBuffer, bytesPerRow: paddedBytesPerRow, rowsPerImage: h },
    destination: { texture },
    copySize: { width: w, height: h },
  });

  const cmdBuf = encoder.finish();
  gpuDevice.queue.submit([cmdBuf]);

  const pixels = await readbackTexture(device, texture, w, h);
  // Every pixel should be red
  for (let i = 0; i < w * h; i++) {
    assertEquals(pixels[i * 4 + 0], 255, `Pixel ${i} R`);
    assertEquals(pixels[i * 4 + 3], 255, `Pixel ${i} A`);
  }

  srcBuffer.destroy();
  texture.destroy();
});

Deno.test("encoder: copyTextureToBuffer with data verification", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 4, h = 4;
  const texture = createRenderTarget(device, w, h);

  // Write green pixels to texture
  const pixelData = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    pixelData[i * 4 + 1] = 255; // G
    pixelData[i * 4 + 3] = 255; // A
  }
  gpuDevice.queue.writeTexture(
    { texture },
    pixelData,
    { bytesPerRow: w * 4, rowsPerImage: h },
    { width: w, height: h },
  );

  const paddedBytesPerRow = Math.ceil((w * 4) / 256) * 256;
  const dstBuffer = gpuDevice.createBuffer({
    label: "tex-readback",
    size: paddedBytesPerRow * h,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const encoder = new WebGPUCommandEncoder(device, "tex-to-buf");
  encoder.copyTextureToBuffer({
    source: { texture },
    destination: { buffer: dstBuffer, bytesPerRow: paddedBytesPerRow, rowsPerImage: h },
    copySize: { width: w, height: h },
  });

  const cmdBuf = encoder.finish();
  gpuDevice.queue.submit([cmdBuf]);

  await dstBuffer.mapAsync(GPUMapMode.READ);
  const raw = new Uint8Array(dstBuffer.getMappedRange());
  // Check first row green pixels
  for (let x = 0; x < w; x++) {
    assertEquals(raw[x * 4 + 1], 255, `Pixel (${x},0) G`);
    assertEquals(raw[x * 4 + 3], 255, `Pixel (${x},0) A`);
  }
  dstBuffer.unmap();
  dstBuffer.destroy();
  texture.destroy();
});

// ============================================================================
// Multiple Sequential Passes
// ============================================================================

Deno.test("encoder: multiple sequential render passes", { ...opts }, async () => {
  const device = await getSharedDevice();
  const encoder = new WebGPUCommandEncoder(device, "multi-pass");
  const texture = createRenderTarget(device, 4, 4);
  const view = texture.createView();

  // Pass 1
  const p1 = encoder.beginRenderPass({
    colorAttachments: [{
      view,
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 1, g: 0, b: 0, a: 1 },
    }],
  });
  p1.end();
  encoder.endRenderPass();

  // Pass 2
  const p2 = encoder.beginRenderPass({
    colorAttachments: [{
      view,
      loadOp: "load" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
    }],
  });
  p2.end();
  encoder.endRenderPass();

  const stats = encoder.getStatistics();
  assertEquals(stats.renderPassCount, 2);

  const cmdBuf = encoder.finish();
  device.getDevice().queue.submit([cmdBuf]);
  texture.destroy();
});

Deno.test("encoder: mixed render and compute passes", { ...opts }, async () => {
  const device = await getSharedDevice();
  const encoder = new WebGPUCommandEncoder(device, "mixed-pass");
  const texture = createRenderTarget(device, 4, 4);

  // Render pass
  const rp = encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
  });
  rp.end();
  encoder.endRenderPass();

  // Compute pass
  const cp = encoder.beginComputePass({ label: "compute" });
  cp.end();
  encoder.endComputePass();

  const stats = encoder.getStatistics();
  assertEquals(stats.renderPassCount, 1);
  assertEquals(stats.computePassCount, 1);

  const cmdBuf = encoder.finish();
  device.getDevice().queue.submit([cmdBuf]);
  texture.destroy();
});

// ============================================================================
// Encoder ID
// ============================================================================

Deno.test("encoder: has unique ID", { ...opts }, async () => {
  const device = await getSharedDevice();
  const enc1 = new WebGPUCommandEncoder(device, "enc1");
  const enc2 = new WebGPUCommandEncoder(device, "enc2");
  const id1 = enc1.getId();
  const id2 = enc2.getId();
  assertEquals(typeof id1, "string");
  assertEquals(id1.length > 0, true);
  assertEquals(id1 !== id2, true);

  device.getDevice().queue.submit([enc1.finish()]);
  device.getDevice().queue.submit([enc2.finish()]);
});
