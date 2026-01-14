/**
 * Tests for Buffer Size Utilities
 */

import { assertEquals, assertThrows } from "@std/assert";
import {
    alignSize,
    isAligned,
    calculatePadding,
    calculateUniformBufferSize,
    calculateStorageBufferSize,
    calculateVertexBufferSize,
    calculateIndexBufferSize,
    calculateStagingBufferSize,
    calculateStructSize,
    calculateArraySize,
    calculateArrayStride,
    calculateBytesPerRow,
    calculateTextureBufferSize,
    isPowerOf2,
    nextPowerOf2,
    UNIFORM_BUFFER_ALIGNMENT,
    STORAGE_BUFFER_ALIGNMENT,
    VERTEX_BUFFER_ALIGNMENT,
    COPY_BUFFER_ALIGNMENT,
    TEXTURE_DATA_ALIGNMENT,
} from "../../../../src/engine/webgpu/buffer/Size.ts";
import type { GPUSize } from "../../../../src/types/webgpu.ts";

Deno.test("Size - alignSize aligns to power of 2", () => {
    assertEquals(alignSize(0 as GPUSize, 4), 0);
    assertEquals(alignSize(1 as GPUSize, 4), 4);
    assertEquals(alignSize(4 as GPUSize, 4), 4);
    assertEquals(alignSize(5 as GPUSize, 4), 8);
    assertEquals(alignSize(100 as GPUSize, 256), 256);
    assertEquals(alignSize(257 as GPUSize, 256), 512);
});

Deno.test("Size - alignSize throws on non-power-of-2", () => {
    assertThrows(() => {
        alignSize(10 as GPUSize, 3);
    }, Error, "power of 2");
});

Deno.test("Size - alignSize throws on zero alignment", () => {
    assertThrows(() => {
        alignSize(10 as GPUSize, 0);
    }, Error, "non-zero");
});

Deno.test("Size - isAligned checks alignment", () => {
    assertEquals(isAligned(0 as GPUSize, 4), true);
    assertEquals(isAligned(4 as GPUSize, 4), true);
    assertEquals(isAligned(8 as GPUSize, 4), true);
    assertEquals(isAligned(3 as GPUSize, 4), false);
    assertEquals(isAligned(5 as GPUSize, 4), false);
    assertEquals(isAligned(256 as GPUSize, 256), true);
    assertEquals(isAligned(255 as GPUSize, 256), false);
});

Deno.test("Size - calculatePadding returns correct padding", () => {
    assertEquals(calculatePadding(0 as GPUSize, 4), 0);
    assertEquals(calculatePadding(1 as GPUSize, 4), 3);
    assertEquals(calculatePadding(4 as GPUSize, 4), 0);
    assertEquals(calculatePadding(5 as GPUSize, 4), 3);
    assertEquals(calculatePadding(100 as GPUSize, 256), 156);
});

Deno.test("Size - calculateUniformBufferSize aligns to 256", () => {
    assertEquals(calculateUniformBufferSize(0 as GPUSize), 0);
    assertEquals(calculateUniformBufferSize(1 as GPUSize), 256);
    assertEquals(calculateUniformBufferSize(256 as GPUSize), 256);
    assertEquals(calculateUniformBufferSize(257 as GPUSize), 512);
    assertEquals(calculateUniformBufferSize(1000 as GPUSize), 1024);
});

Deno.test("Size - calculateStorageBufferSize aligns to 4", () => {
    assertEquals(calculateStorageBufferSize(0 as GPUSize), 0);
    assertEquals(calculateStorageBufferSize(1 as GPUSize), 4);
    assertEquals(calculateStorageBufferSize(4 as GPUSize), 4);
    assertEquals(calculateStorageBufferSize(5 as GPUSize), 8);
    assertEquals(calculateStorageBufferSize(100 as GPUSize), 100);
});

Deno.test("Size - calculateVertexBufferSize aligns to 4", () => {
    assertEquals(calculateVertexBufferSize(0 as GPUSize), 0);
    assertEquals(calculateVertexBufferSize(1 as GPUSize), 4);
    assertEquals(calculateVertexBufferSize(12 as GPUSize), 12);
    assertEquals(calculateVertexBufferSize(13 as GPUSize), 16);
});

Deno.test("Size - calculateIndexBufferSize handles uint16", () => {
    assertEquals(calculateIndexBufferSize(0, "uint16"), 0);
    assertEquals(calculateIndexBufferSize(1, "uint16"), 2);
    assertEquals(calculateIndexBufferSize(3, "uint16"), 6);
    assertEquals(calculateIndexBufferSize(4, "uint16"), 8);
});

Deno.test("Size - calculateIndexBufferSize handles uint32", () => {
    assertEquals(calculateIndexBufferSize(0, "uint32"), 0);
    assertEquals(calculateIndexBufferSize(1, "uint32"), 4);
    assertEquals(calculateIndexBufferSize(3, "uint32"), 12);
    assertEquals(calculateIndexBufferSize(4, "uint32"), 16);
});

Deno.test("Size - calculateStagingBufferSize aligns to 4", () => {
    assertEquals(calculateStagingBufferSize(0 as GPUSize), 0);
    assertEquals(calculateStagingBufferSize(1 as GPUSize), 4);
    assertEquals(calculateStagingBufferSize(100 as GPUSize), 100);
    assertEquals(calculateStagingBufferSize(101 as GPUSize), 104);
});

Deno.test("Size - calculateStructSize with single field", () => {
    const size = calculateStructSize([4 as GPUSize], [4]);
    assertEquals(size, 4);
});

Deno.test("Size - calculateStructSize with multiple fields", () => {
    // struct { f32, vec3<f32> }
    // f32: size=4, align=4, offset=0
    // vec3<f32>: size=12, align=16, offset=16
    // Total: 28, aligned to 16 = 32
    const size = calculateStructSize(
        [4 as GPUSize, 12 as GPUSize],
        [4, 16],
    );
    assertEquals(size, 32);
});

Deno.test("Size - calculateStructSize throws on length mismatch", () => {
    assertThrows(() => {
        calculateStructSize([4 as GPUSize], [4, 8]);
    }, Error, "same length");
});

Deno.test("Size - calculateArraySize", () => {
    // Array of 10 vec4<f32>, each 16 bytes, aligned to 16
    const size = calculateArraySize(16 as GPUSize, 16, 10);
    assertEquals(size, 160);
});

Deno.test("Size - calculateArraySize with padding", () => {
    // Array of 10 vec3<f32>, each 12 bytes, aligned to 16
    // Stride = 16, total = 160
    const size = calculateArraySize(12 as GPUSize, 16, 10);
    assertEquals(size, 160);
});

Deno.test("Size - calculateArrayStride", () => {
    assertEquals(calculateArrayStride(4 as GPUSize, 4), 4);
    assertEquals(calculateArrayStride(12 as GPUSize, 16), 16);
    assertEquals(calculateArrayStride(1 as GPUSize, 4), 4);
});

Deno.test("Size - calculateBytesPerRow aligns to 256", () => {
    // 100 pixels * 4 bytes = 400 bytes, aligned to 256 = 512
    assertEquals(calculateBytesPerRow(100, 4), 512);

    // 64 pixels * 4 bytes = 256 bytes, aligned to 256 = 256
    assertEquals(calculateBytesPerRow(64, 4), 256);

    // 65 pixels * 4 bytes = 260 bytes, aligned to 256 = 512
    assertEquals(calculateBytesPerRow(65, 4), 512);
});

Deno.test("Size - calculateTextureBufferSize", () => {
    // 100x100 texture, 4 bytes per pixel
    // Bytes per row = 512 (aligned)
    // Total = 512 * 100 = 51200
    assertEquals(calculateTextureBufferSize(100, 100, 4), 51200);
});

Deno.test("Size - isPowerOf2 checks powers of 2", () => {
    assertEquals(isPowerOf2(0), false);
    assertEquals(isPowerOf2(1), true);
    assertEquals(isPowerOf2(2), true);
    assertEquals(isPowerOf2(3), false);
    assertEquals(isPowerOf2(4), true);
    assertEquals(isPowerOf2(256), true);
    assertEquals(isPowerOf2(255), false);
    assertEquals(isPowerOf2(1024), true);
});

Deno.test("Size - nextPowerOf2 finds next power", () => {
    assertEquals(nextPowerOf2(0), 1);
    assertEquals(nextPowerOf2(1), 1);
    assertEquals(nextPowerOf2(2), 2);
    assertEquals(nextPowerOf2(3), 4);
    assertEquals(nextPowerOf2(5), 8);
    assertEquals(nextPowerOf2(100), 128);
    assertEquals(nextPowerOf2(256), 256);
    assertEquals(nextPowerOf2(257), 512);
});

Deno.test("Size - alignment constants are correct", () => {
    assertEquals(UNIFORM_BUFFER_ALIGNMENT, 256);
    assertEquals(STORAGE_BUFFER_ALIGNMENT, 4);
    assertEquals(VERTEX_BUFFER_ALIGNMENT, 4);
    assertEquals(COPY_BUFFER_ALIGNMENT, 4);
    assertEquals(TEXTURE_DATA_ALIGNMENT, 256);
});
