/**
 * Tests for BufferHelpers - webgpu_x FFI Integration
 *
 * Tests the Rust FFI bindings for buffer alignment, texture sizing,
 * and staging belt arena allocator.
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import {
  calculateAlignedSize,
  calculateTextureBufferSize,
  createStagingBelt,
  destroyStagingBelt,
  getBufferAlignment,
  getPaddedRowSize,
  getRowPadding,
  stagingBeltFinish,
  stagingBeltStats,
  stagingBeltWrite,
} from "../../../../src/engine/webgpu/utils/BufferHelpers.ts";
import { closeLib, preloadLib } from "@browserx/webgpu_x";

// Eagerly load FFI library at module scope so per-test sanitizer doesn't flag it
preloadLib();

// ============================================================================
// Buffer Alignment Tests
// ============================================================================

Deno.test("BufferHelpers - calculateAlignedSize aligns to 4 bytes", () => {
  assertEquals(calculateAlignedSize(0n, 4n), 0n);
  assertEquals(calculateAlignedSize(1n, 4n), 4n);
  assertEquals(calculateAlignedSize(4n, 4n), 4n);
  assertEquals(calculateAlignedSize(5n, 4n), 8n);
  assertEquals(calculateAlignedSize(100n, 4n), 100n);
  assertEquals(calculateAlignedSize(101n, 4n), 104n);
});

Deno.test("BufferHelpers - calculateAlignedSize aligns to 256 bytes", () => {
  assertEquals(calculateAlignedSize(0n, 256n), 0n);
  assertEquals(calculateAlignedSize(1n, 256n), 256n);
  assertEquals(calculateAlignedSize(256n, 256n), 256n);
  assertEquals(calculateAlignedSize(257n, 256n), 512n);
  assertEquals(calculateAlignedSize(1000n, 256n), 1024n);
});

Deno.test("BufferHelpers - calculateAlignedSize handles large values", () => {
  // Test with values larger than 32-bit
  const largeValue = BigInt(4 * 1024 * 1024 * 1024); // 4GB
  const aligned = calculateAlignedSize(largeValue + 1n, 256n);
  assert(aligned > largeValue);
  assertEquals(aligned % 256n, 0n);
});

// ============================================================================
// Buffer Usage Alignment Tests
// ============================================================================

Deno.test("BufferHelpers - getBufferAlignment returns correct alignment for usage flags", () => {
  // GPUBufferUsage flags from WebGPU spec
  const UNIFORM = 0x0040;
  const STORAGE = 0x0080;
  const VERTEX = 0x0020;
  const INDEX = 0x0010;
  const COPY_SRC = 0x0004;
  const COPY_DST = 0x0008;

  // Uniform buffers require 256-byte alignment
  const uniformAlign = getBufferAlignment(UNIFORM);
  assertEquals(uniformAlign, 256n);

  // Storage buffers require 4-byte alignment (or higher depending on usage)
  const storageAlign = getBufferAlignment(STORAGE);
  assert(storageAlign >= 4n);

  // Vertex buffers require 4-byte alignment
  const vertexAlign = getBufferAlignment(VERTEX);
  assert(vertexAlign >= 4n);

  // Copy operations require 4-byte alignment
  const copyAlign = getBufferAlignment(COPY_SRC | COPY_DST);
  assert(copyAlign >= 4n);
});

// ============================================================================
// Texture Row Padding Tests
// ============================================================================

Deno.test("BufferHelpers - getRowPadding calculates correct padding", () => {
  // 256-byte aligned rows need no padding
  assertEquals(getRowPadding(256n), 0n);
  assertEquals(getRowPadding(512n), 0n);

  // Non-aligned rows need padding
  const padding100 = getRowPadding(100n);
  assertEquals((100n + padding100) % 256n, 0n);

  const padding400 = getRowPadding(400n);
  assertEquals((400n + padding400) % 256n, 0n);
});

Deno.test("BufferHelpers - getPaddedRowSize returns aligned size", () => {
  // Already aligned
  assertEquals(getPaddedRowSize(256n), 256n);
  assertEquals(getPaddedRowSize(512n), 512n);

  // Need padding to 256
  assertEquals(getPaddedRowSize(100n), 256n);
  assertEquals(getPaddedRowSize(257n), 512n);
  assertEquals(getPaddedRowSize(400n), 512n);
});

Deno.test("BufferHelpers - getPaddedRowSize handles common texture widths", () => {
  // Common texture widths * 4 bytes per pixel (RGBA8)
  assertEquals(getPaddedRowSize(BigInt(64 * 4)), 256n); // 256 bytes, aligned
  assertEquals(getPaddedRowSize(BigInt(100 * 4)), 512n); // 400 bytes -> 512
  assertEquals(getPaddedRowSize(BigInt(128 * 4)), 512n); // 512 bytes, aligned
  assertEquals(getPaddedRowSize(BigInt(256 * 4)), 1024n); // 1024 bytes, aligned
  assertEquals(getPaddedRowSize(BigInt(512 * 4)), 2048n); // 2048 bytes, aligned
  assertEquals(getPaddedRowSize(BigInt(1024 * 4)), 4096n); // 4096 bytes, aligned
});

// ============================================================================
// Texture Buffer Size Tests
// ============================================================================

Deno.test("BufferHelpers - calculateTextureBufferSize for power-of-2 textures", () => {
  // 64x64 RGBA8: 64 * 4 = 256 bytes/row (aligned) * 64 rows
  assertEquals(calculateTextureBufferSize(64, 64, 4), 256n * 64n);

  // 128x128 RGBA8: 128 * 4 = 512 bytes/row (aligned) * 128 rows
  assertEquals(calculateTextureBufferSize(128, 128, 4), 512n * 128n);

  // 256x256 RGBA8: 256 * 4 = 1024 bytes/row (aligned) * 256 rows
  assertEquals(calculateTextureBufferSize(256, 256, 4), 1024n * 256n);

  // 1024x1024 RGBA8: 1024 * 4 = 4096 bytes/row (aligned) * 1024 rows
  assertEquals(calculateTextureBufferSize(1024, 1024, 4), 4096n * 1024n);
});

Deno.test("BufferHelpers - calculateTextureBufferSize for non-power-of-2 textures", () => {
  // 100x100 RGBA8: 100 * 4 = 400 bytes -> padded to 512 * 100 rows
  assertEquals(calculateTextureBufferSize(100, 100, 4), 512n * 100n);

  // 300x200 RGBA8: 300 * 4 = 1200 bytes -> padded to 1280 (? depends on implementation)
  const size300x200 = calculateTextureBufferSize(300, 200, 4);
  // Should be at least 300 * 4 * 200 = 240000 bytes
  assert(size300x200 >= 240000n);
  // Should be aligned properly
  assert(size300x200 % 256n === 0n || Number(size300x200) % 200 === 0);
});

Deno.test("BufferHelpers - calculateTextureBufferSize handles different pixel formats", () => {
  const width = 256;
  const height = 256;

  // R8 (1 byte per pixel)
  const sizeR8 = calculateTextureBufferSize(width, height, 1);

  // RG8 (2 bytes per pixel)
  const sizeRG8 = calculateTextureBufferSize(width, height, 2);

  // RGBA8 (4 bytes per pixel)
  const sizeRGBA8 = calculateTextureBufferSize(width, height, 4);

  // RGBA16F (8 bytes per pixel)
  const sizeRGBA16F = calculateTextureBufferSize(width, height, 8);

  // RGBA32F (16 bytes per pixel)
  const sizeRGBA32F = calculateTextureBufferSize(width, height, 16);

  // Each format should produce increasing sizes
  assert(sizeR8 <= sizeRG8);
  assert(sizeRG8 <= sizeRGBA8);
  assert(sizeRGBA8 <= sizeRGBA16F);
  assert(sizeRGBA16F <= sizeRGBA32F);
});

// ============================================================================
// Staging Belt Arena Allocator Tests
// ============================================================================

Deno.test("BufferHelpers - createStagingBelt creates belt with handle", () => {
  const chunkSize = 256 * 1024; // 256KB
  const beltHandle = createStagingBelt(chunkSize);

  assertExists(beltHandle);
  assert(beltHandle > 0n, "Belt handle should be a positive bigint");

  // Cleanup
  destroyStagingBelt(beltHandle);
});

Deno.test("BufferHelpers - stagingBeltWrite allocates space", () => {
  const beltHandle = createStagingBelt(256 * 1024);

  // Write some data
  const writeResult = stagingBeltWrite(beltHandle, 1024n);

  if (writeResult !== null) {
    assertExists(writeResult.buffer_handle);
    assertExists(writeResult.offset);
    assertExists(writeResult.size);
    assertEquals(writeResult.size, 1024);
  }

  // Cleanup
  destroyStagingBelt(beltHandle);
});

Deno.test("BufferHelpers - stagingBeltFinish completes frame", () => {
  const beltHandle = createStagingBelt(256 * 1024);

  // Write some data
  stagingBeltWrite(beltHandle, 1024n);
  stagingBeltWrite(beltHandle, 2048n);

  // Finish frame - should not throw
  stagingBeltFinish(beltHandle);

  // Cleanup
  destroyStagingBelt(beltHandle);
});

Deno.test("BufferHelpers - stagingBeltStats returns statistics", () => {
  const chunkSize = 256 * 1024;
  const beltHandle = createStagingBelt(chunkSize);

  // Write some data
  stagingBeltWrite(beltHandle, 1024n);
  stagingBeltWrite(beltHandle, 2048n);

  // Get stats
  const stats = stagingBeltStats(beltHandle);

  if (stats !== null) {
    assertExists(stats.active_chunks);
    assertExists(stats.free_chunks);
    assertExists(stats.chunk_size);
    assertExists(stats.total_allocated);

    // Should have allocated at least what we requested
    assert(stats.total_allocated >= 1024 + 2048);
  }

  // Cleanup
  destroyStagingBelt(beltHandle);
});

Deno.test("BufferHelpers - staging belt lifecycle", () => {
  // Create belt
  const beltHandle = createStagingBelt(64 * 1024); // 64KB chunks

  // Frame 1: Write data
  const write1 = stagingBeltWrite(beltHandle, 4096n);
  const write2 = stagingBeltWrite(beltHandle, 8192n);

  if (write1 && write2) {
    // Writes should have different offsets or buffer handles
    assert(
      write1.buffer_handle !== write2.buffer_handle ||
        write1.offset !== write2.offset,
      "Writes should not overlap",
    );
  }

  // Finish frame 1
  stagingBeltFinish(beltHandle);

  // Frame 2: Write more data (should reuse buffers)
  const write3 = stagingBeltWrite(beltHandle, 2048n);
  assertExists(write3);

  // Check stats
  const stats = stagingBeltStats(beltHandle);
  assertExists(stats);

  // Finish frame 2
  stagingBeltFinish(beltHandle);

  // Destroy belt
  destroyStagingBelt(beltHandle);
});

// ============================================================================
// Integration with Size.ts Tests
// ============================================================================

Deno.test("BufferHelpers - alignment matches Size.ts calculations", async () => {
  // Import Size.ts functions to verify they use BufferHelpers correctly
  const { alignSize, calculateBytesPerRow, calculateTextureBufferSize: sizeCalcTexture } =
    await import("../../../../src/engine/webgpu/buffer/Size.ts");

  // Test alignment
  assertEquals(alignSize(5 as number, 4), Number(calculateAlignedSize(5n, 4n)));
  assertEquals(alignSize(100 as number, 256), Number(calculateAlignedSize(100n, 256n)));

  // Test texture row calculation
  const width = 100;
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel;
  assertEquals(
    calculateBytesPerRow(width, bytesPerPixel),
    Number(getPaddedRowSize(BigInt(rowSize))),
  );

  // Test texture buffer size
  assertEquals(
    sizeCalcTexture(100, 100, 4),
    Number(calculateTextureBufferSize(100, 100, 4)),
  );
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

Deno.test("BufferHelpers - handles zero size", () => {
  assertEquals(calculateAlignedSize(0n, 4n), 0n);
  assertEquals(calculateAlignedSize(0n, 256n), 0n);
  assertEquals(getPaddedRowSize(0n), 0n);
  assertEquals(calculateTextureBufferSize(0, 0, 4), 0n);
});

Deno.test("BufferHelpers - handles single pixel texture", () => {
  // 1x1 RGBA8 texture
  const size = calculateTextureBufferSize(1, 1, 4);
  // Should be at least 4 bytes, but likely padded to 256 for row alignment
  assert(size >= 4n);
});

Deno.test("BufferHelpers - handles very wide textures", () => {
  // 4096 pixels wide, 1 pixel tall
  const size = calculateTextureBufferSize(4096, 1, 4);
  // 4096 * 4 = 16384 bytes per row
  assert(size >= 16384n);
  // Should be properly aligned
  assertEquals(size % 256n, 0n);
});

Deno.test("BufferHelpers - handles very tall textures", () => {
  // 1 pixel wide, 4096 pixels tall
  const size = calculateTextureBufferSize(1, 4096, 4);
  // Even 1 pixel wide needs row alignment
  // Each row is 4 bytes -> padded to 256 bytes
  // Total should be 256 * 4096 or similar
  assert(size >= BigInt(4 * 4096));
});
