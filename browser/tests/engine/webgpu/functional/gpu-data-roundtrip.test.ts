/**
 * GPU Data Roundtrip Tests
 *
 * Verifies actual GPU data flow: write data to GPU buffers/textures,
 * read it back, and confirm the values match. Tests buffer types,
 * sizes, partial writes, and texture pixel upload/readback.
 */

import { assertEquals } from "@std/assert";
import {
  assertPixelAt,
  assertSolidColor,
  createBufferWithData,
  createRenderTarget,
  getSharedDevice,
  readbackBuffer,
  readbackTexture,
  webgpuAvailable,
} from "./_helpers.ts";

const opts = { ignore: !webgpuAvailable, sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// Float32 Buffer Roundtrips
// ============================================================================

Deno.test("buffer roundtrip: Float32Array small (4 floats)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const data = new Float32Array([1.0, 2.5, -3.14, 0.0]);
  const buffer = createBufferWithData(device, data, GPUBufferUsage.STORAGE);
  const result = await readbackBuffer(device, buffer, data.byteLength);
  const resultFloats = new Float32Array(result.buffer, result.byteOffset, data.length);
  for (let i = 0; i < data.length; i++) {
    assertEquals(resultFloats[i], data[i], `Float32 index ${i}`);
  }
  buffer.destroy();
});

Deno.test("buffer roundtrip: Float32Array 256 elements", { ...opts }, async () => {
  const device = await getSharedDevice();
  const data = new Float32Array(256);
  for (let i = 0; i < 256; i++) data[i] = i * 0.1;
  const buffer = createBufferWithData(device, data, GPUBufferUsage.STORAGE);
  const result = await readbackBuffer(device, buffer, data.byteLength);
  const resultFloats = new Float32Array(result.buffer, result.byteOffset, data.length);
  for (let i = 0; i < data.length; i++) {
    assertEquals(resultFloats[i], data[i], `Float32 index ${i}`);
  }
  buffer.destroy();
});

Deno.test("buffer roundtrip: Float32Array 1024 elements (4KB)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const data = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) data[i] = Math.sin(i);
  const buffer = createBufferWithData(device, data, GPUBufferUsage.STORAGE);
  const result = await readbackBuffer(device, buffer, data.byteLength);
  const resultFloats = new Float32Array(result.buffer, result.byteOffset, data.length);
  for (let i = 0; i < data.length; i++) {
    assertEquals(resultFloats[i], data[i], `Float32 index ${i}`);
  }
  buffer.destroy();
});

// ============================================================================
// Uint32 Buffer Roundtrips
// ============================================================================

Deno.test("buffer roundtrip: Uint32Array small (4 values)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const data = new Uint32Array([0, 1, 4294967295, 12345]);
  const buffer = createBufferWithData(device, data, GPUBufferUsage.STORAGE);
  const result = await readbackBuffer(device, buffer, data.byteLength);
  const resultU32 = new Uint32Array(result.buffer, result.byteOffset, data.length);
  for (let i = 0; i < data.length; i++) {
    assertEquals(resultU32[i], data[i], `Uint32 index ${i}`);
  }
  buffer.destroy();
});

Deno.test("buffer roundtrip: Uint32Array sequential 0..999", { ...opts }, async () => {
  const device = await getSharedDevice();
  const data = new Uint32Array(1000);
  for (let i = 0; i < 1000; i++) data[i] = i;
  const buffer = createBufferWithData(device, data, GPUBufferUsage.STORAGE);
  const result = await readbackBuffer(device, buffer, data.byteLength);
  const resultU32 = new Uint32Array(result.buffer, result.byteOffset, data.length);
  for (let i = 0; i < data.length; i++) {
    assertEquals(resultU32[i], data[i], `Uint32 index ${i}`);
  }
  buffer.destroy();
});

// ============================================================================
// Uint8 Buffer Roundtrips
// ============================================================================

Deno.test("buffer roundtrip: Uint8Array 256 bytes (aligned)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const data = new Uint8Array(256);
  for (let i = 0; i < 256; i++) data[i] = i;
  const buffer = createBufferWithData(device, data, GPUBufferUsage.STORAGE);
  const result = await readbackBuffer(device, buffer, 256);
  for (let i = 0; i < 256; i++) {
    assertEquals(result[i], data[i], `Uint8 index ${i}`);
  }
  buffer.destroy();
});

Deno.test("buffer roundtrip: Uint8Array 1KB", { ...opts }, async () => {
  const device = await getSharedDevice();
  const data = new Uint8Array(1024);
  for (let i = 0; i < 1024; i++) data[i] = i % 256;
  const buffer = createBufferWithData(device, data, GPUBufferUsage.STORAGE);
  const result = await readbackBuffer(device, buffer, 1024);
  for (let i = 0; i < 1024; i++) {
    assertEquals(result[i], data[i], `Uint8 index ${i}`);
  }
  buffer.destroy();
});

// ============================================================================
// Large Buffers
// ============================================================================

Deno.test("buffer roundtrip: 1MB Float32Array", { ...opts }, async () => {
  const device = await getSharedDevice();
  const count = 1024 * 1024 / 4;
  const data = new Float32Array(count);
  for (let i = 0; i < count; i++) data[i] = i;
  const buffer = createBufferWithData(device, data, GPUBufferUsage.STORAGE);
  const result = await readbackBuffer(device, buffer, data.byteLength);
  const resultFloats = new Float32Array(result.buffer, result.byteOffset, count);
  assertEquals(resultFloats[0], 0);
  assertEquals(resultFloats[1000], 1000);
  assertEquals(resultFloats[count - 1], count - 1);
  buffer.destroy();
});

// ============================================================================
// Buffer Overwrite
// ============================================================================

Deno.test("buffer overwrite: writeBuffer replaces data", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const buffer = gpuDevice.createBuffer({
    label: "overwrite-test",
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  gpuDevice.queue.writeBuffer(buffer, 0, new Uint32Array([1, 2, 3, 4]));
  gpuDevice.queue.writeBuffer(buffer, 0, new Uint32Array([10, 20, 30, 40]));
  const result = await readbackBuffer(device, buffer, 16);
  const resultU32 = new Uint32Array(result.buffer, result.byteOffset, 4);
  assertEquals(resultU32[0], 10);
  assertEquals(resultU32[1], 20);
  assertEquals(resultU32[2], 30);
  assertEquals(resultU32[3], 40);
  buffer.destroy();
});

Deno.test("buffer partial overwrite: writeBuffer at offset", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const buffer = gpuDevice.createBuffer({
    label: "partial-overwrite",
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  gpuDevice.queue.writeBuffer(buffer, 0, new Uint32Array([1, 2, 3, 4]));
  gpuDevice.queue.writeBuffer(buffer, 8, new Uint32Array([99, 100]));
  const result = await readbackBuffer(device, buffer, 16);
  const resultU32 = new Uint32Array(result.buffer, result.byteOffset, 4);
  assertEquals(resultU32[0], 1);
  assertEquals(resultU32[1], 2);
  assertEquals(resultU32[2], 99);
  assertEquals(resultU32[3], 100);
  buffer.destroy();
});

// ============================================================================
// Zero-fill Verification
// ============================================================================

Deno.test("buffer zero-fill: new buffer is zeroed", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const buffer = gpuDevice.createBuffer({
    label: "zero-check",
    size: 256,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const result = await readbackBuffer(device, buffer, 256);
  for (let i = 0; i < 256; i++) {
    assertEquals(result[i], 0, `Byte ${i} should be zero`);
  }
  buffer.destroy();
});

// ============================================================================
// Texture Pixel Roundtrips
// ============================================================================

Deno.test("texture roundtrip: 1x1 red pixel", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const texture = createRenderTarget(device, 1, 1);
  gpuDevice.queue.writeTexture(
    { texture },
    new Uint8Array([255, 0, 0, 255]),
    { bytesPerRow: 4, rowsPerImage: 1 },
    { width: 1, height: 1 },
  );
  const pixels = await readbackTexture(device, texture, 1, 1);
  assertPixelAt(pixels, 1, 0, 0, 255, 0, 0, 255);
  texture.destroy();
});

Deno.test("texture roundtrip: 4x4 solid green", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 4, h = 4;
  const texture = createRenderTarget(device, w, h);
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4 + 1] = 255;
    data[i * 4 + 3] = 255;
  }
  gpuDevice.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: w * 4, rowsPerImage: h },
    { width: w, height: h },
  );
  const pixels = await readbackTexture(device, texture, w, h);
  assertSolidColor(pixels, 0, 255, 0, 255);
  texture.destroy();
});

Deno.test("texture roundtrip: 64x64 gradient", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 64, h = 64;
  const texture = createRenderTarget(device, w, h);
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      data[idx] = x * 4;
      data[idx + 1] = y * 4;
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }
  gpuDevice.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: w * 4, rowsPerImage: h },
    { width: w, height: h },
  );
  const pixels = await readbackTexture(device, texture, w, h);
  assertPixelAt(pixels, w, 0, 0, 0, 0, 128, 255);
  assertPixelAt(pixels, w, 63, 0, 252, 0, 128, 255);
  assertPixelAt(pixels, w, 0, 63, 0, 252, 128, 255);
  assertPixelAt(pixels, w, 63, 63, 252, 252, 128, 255);
  texture.destroy();
});

Deno.test("texture roundtrip: non-square 100x1", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 100, h = 1;
  const texture = createRenderTarget(device, w, h);
  const data = new Uint8Array(w * 4);
  for (let x = 0; x < w; x++) {
    data[x * 4] = x * 2;
    data[x * 4 + 3] = 255;
  }
  gpuDevice.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: w * 4, rowsPerImage: 1 },
    { width: w, height: 1 },
  );
  const pixels = await readbackTexture(device, texture, w, h);
  assertPixelAt(pixels, w, 0, 0, 0, 0, 0, 255);
  assertPixelAt(pixels, w, 50, 0, 100, 0, 0, 255);
  assertPixelAt(pixels, w, 99, 0, 198, 0, 0, 255);
  texture.destroy();
});

Deno.test("texture roundtrip: non-square 1x100", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 1, h = 100;
  const texture = createRenderTarget(device, w, h);
  const data = new Uint8Array(h * 4);
  for (let y = 0; y < h; y++) {
    data[y * 4 + 1] = y * 2;
    data[y * 4 + 3] = 255;
  }
  gpuDevice.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: 4, rowsPerImage: h },
    { width: 1, height: h },
  );
  const pixels = await readbackTexture(device, texture, w, h);
  assertPixelAt(pixels, w, 0, 0, 0, 0, 0, 255);
  assertPixelAt(pixels, w, 0, 50, 0, 100, 0, 255);
  assertPixelAt(pixels, w, 0, 99, 0, 198, 0, 255);
  texture.destroy();
});

Deno.test("texture roundtrip: 256x1 (row-alignment boundary)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 256, h = 1;
  const texture = createRenderTarget(device, w, h);
  const data = new Uint8Array(w * 4);
  for (let x = 0; x < w; x++) {
    data[x * 4] = x;
    data[x * 4 + 1] = 255 - x;
    data[x * 4 + 2] = 128;
    data[x * 4 + 3] = 255;
  }
  gpuDevice.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: w * 4, rowsPerImage: 1 },
    { width: w, height: 1 },
  );
  const pixels = await readbackTexture(device, texture, w, h);
  assertPixelAt(pixels, w, 0, 0, 0, 255, 128, 255);
  assertPixelAt(pixels, w, 128, 0, 128, 127, 128, 255);
  assertPixelAt(pixels, w, 255, 0, 255, 0, 128, 255);
  texture.destroy();
});

Deno.test("texture roundtrip: 255x1 (off-alignment boundary)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 255, h = 1;
  const texture = createRenderTarget(device, w, h);
  const data = new Uint8Array(w * 4);
  for (let x = 0; x < w; x++) {
    data[x * 4] = x;
    data[x * 4 + 3] = 255;
  }
  gpuDevice.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: w * 4, rowsPerImage: 1 },
    { width: w, height: 1 },
  );
  const pixels = await readbackTexture(device, texture, w, h);
  assertPixelAt(pixels, w, 0, 0, 0, 0, 0, 255);
  assertPixelAt(pixels, w, 254, 0, 254, 0, 0, 255);
  texture.destroy();
});

// ============================================================================
// Copy Operations
// ============================================================================

Deno.test("buffer-to-buffer copy preserves data", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const srcData = new Uint32Array([100, 200, 300, 400]);
  const src = createBufferWithData(device, srcData, GPUBufferUsage.STORAGE);
  const dst = gpuDevice.createBuffer({
    label: "copy-dst",
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  const encoder = gpuDevice.createCommandEncoder();
  encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
  gpuDevice.queue.submit([encoder.finish()]);
  const result = await readbackBuffer(device, dst, 16);
  const resultU32 = new Uint32Array(result.buffer, result.byteOffset, 4);
  assertEquals(resultU32[0], 100);
  assertEquals(resultU32[3], 400);
  src.destroy();
  dst.destroy();
});

Deno.test("buffer-to-buffer partial copy", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const srcData = new Uint32Array([10, 20, 30, 40]);
  const src = createBufferWithData(device, srcData, GPUBufferUsage.STORAGE);
  const dst = gpuDevice.createBuffer({
    label: "partial-copy-dst",
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  const encoder = gpuDevice.createCommandEncoder();
  encoder.copyBufferToBuffer(src, 0, dst, 0, 8);
  gpuDevice.queue.submit([encoder.finish()]);
  const result = await readbackBuffer(device, dst, 16);
  const resultU32 = new Uint32Array(result.buffer, result.byteOffset, 4);
  assertEquals(resultU32[0], 10);
  assertEquals(resultU32[1], 20);
  assertEquals(resultU32[2], 0);
  assertEquals(resultU32[3], 0);
  src.destroy();
  dst.destroy();
});

// ============================================================================
// Mixed Type Verification
// ============================================================================

Deno.test("buffer roundtrip: Int32Array with negatives", { ...opts }, async () => {
  const device = await getSharedDevice();
  const data = new Int32Array([-1, -2147483648, 2147483647, 0]);
  const buffer = createBufferWithData(device, data, GPUBufferUsage.STORAGE);
  const result = await readbackBuffer(device, buffer, data.byteLength);
  const resultI32 = new Int32Array(result.buffer, result.byteOffset, data.length);
  for (let i = 0; i < data.length; i++) {
    assertEquals(resultI32[i], data[i], `Int32 index ${i}`);
  }
  buffer.destroy();
});

Deno.test("buffer roundtrip: Float32 special values (Inf, -Inf)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const data = new Float32Array([Infinity, -Infinity, 0.0, -0.0]);
  const buffer = createBufferWithData(device, data, GPUBufferUsage.STORAGE);
  const result = await readbackBuffer(device, buffer, data.byteLength);
  const resultFloats = new Float32Array(result.buffer, result.byteOffset, data.length);
  assertEquals(resultFloats[0], Infinity);
  assertEquals(resultFloats[1], -Infinity);
  assertEquals(resultFloats[2], 0);
  assertEquals(resultFloats[3], 0);
  buffer.destroy();
});
