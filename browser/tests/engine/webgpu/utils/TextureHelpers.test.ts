/**
 * Tests for TextureHelpers - webgpu_x FFI Integration
 *
 * Tests the Rust FFI bindings for mipmap level calculations
 * and mip size computations.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    calculateMipLevels,
    getMipSize,
    getMipSize3D,
} from "../../../../src/engine/webgpu/utils/TextureHelpers.ts";

// ============================================================================
// Mip Level Count Tests
// ============================================================================

Deno.test("TextureHelpers - calculateMipLevels for power-of-2 textures", () => {
    // 1x1 -> 1 mip level
    assertEquals(calculateMipLevels(1, 1), 1);

    // 2x2 -> 2 mip levels (2x2, 1x1)
    assertEquals(calculateMipLevels(2, 2), 2);

    // 4x4 -> 3 mip levels (4x4, 2x2, 1x1)
    assertEquals(calculateMipLevels(4, 4), 3);

    // 8x8 -> 4 mip levels
    assertEquals(calculateMipLevels(8, 8), 4);

    // 16x16 -> 5 mip levels
    assertEquals(calculateMipLevels(16, 16), 5);

    // 32x32 -> 6 mip levels
    assertEquals(calculateMipLevels(32, 32), 6);

    // 64x64 -> 7 mip levels
    assertEquals(calculateMipLevels(64, 64), 7);

    // 128x128 -> 8 mip levels
    assertEquals(calculateMipLevels(128, 128), 8);

    // 256x256 -> 9 mip levels
    assertEquals(calculateMipLevels(256, 256), 9);

    // 512x512 -> 10 mip levels
    assertEquals(calculateMipLevels(512, 512), 10);

    // 1024x1024 -> 11 mip levels
    assertEquals(calculateMipLevels(1024, 1024), 11);

    // 2048x2048 -> 12 mip levels
    assertEquals(calculateMipLevels(2048, 2048), 12);

    // 4096x4096 -> 13 mip levels
    assertEquals(calculateMipLevels(4096, 4096), 13);
});

Deno.test("TextureHelpers - calculateMipLevels for non-power-of-2 textures", () => {
    // Formula: floor(log2(max(width, height))) + 1

    // 100x100 -> floor(log2(100)) + 1 = 6 + 1 = 7
    assertEquals(calculateMipLevels(100, 100), 7);

    // 300x200 -> floor(log2(300)) + 1 = 8 + 1 = 9
    assertEquals(calculateMipLevels(300, 200), 9);

    // 1920x1080 -> floor(log2(1920)) + 1 = 10 + 1 = 11
    assertEquals(calculateMipLevels(1920, 1080), 11);

    // 3840x2160 (4K) -> floor(log2(3840)) + 1 = 11 + 1 = 12
    assertEquals(calculateMipLevels(3840, 2160), 12);
});

Deno.test("TextureHelpers - calculateMipLevels for rectangular textures", () => {
    // Uses max dimension for calculation
    // 1024x512 -> floor(log2(1024)) + 1 = 10 + 1 = 11
    assertEquals(calculateMipLevels(1024, 512), 11);

    // 512x1024 -> same result
    assertEquals(calculateMipLevels(512, 1024), 11);

    // 2048x256 -> floor(log2(2048)) + 1 = 11 + 1 = 12
    assertEquals(calculateMipLevels(2048, 256), 12);

    // 1x4096 -> floor(log2(4096)) + 1 = 12 + 1 = 13
    assertEquals(calculateMipLevels(1, 4096), 13);
});

// ============================================================================
// Mip Size Tests (2D)
// ============================================================================

Deno.test("TextureHelpers - getMipSize for 256x256 texture", () => {
    const baseWidth = 256;
    const baseHeight = 256;

    // Level 0: 256x256
    const mip0 = getMipSize(baseWidth, baseHeight, 0);
    assertExists(mip0);
    assertEquals(mip0.width, 256);
    assertEquals(mip0.height, 256);

    // Level 1: 128x128
    const mip1 = getMipSize(baseWidth, baseHeight, 1);
    assertExists(mip1);
    assertEquals(mip1.width, 128);
    assertEquals(mip1.height, 128);

    // Level 2: 64x64
    const mip2 = getMipSize(baseWidth, baseHeight, 2);
    assertExists(mip2);
    assertEquals(mip2.width, 64);
    assertEquals(mip2.height, 64);

    // Level 3: 32x32
    const mip3 = getMipSize(baseWidth, baseHeight, 3);
    assertExists(mip3);
    assertEquals(mip3.width, 32);
    assertEquals(mip3.height, 32);

    // Level 4: 16x16
    const mip4 = getMipSize(baseWidth, baseHeight, 4);
    assertExists(mip4);
    assertEquals(mip4.width, 16);
    assertEquals(mip4.height, 16);

    // Level 5: 8x8
    const mip5 = getMipSize(baseWidth, baseHeight, 5);
    assertExists(mip5);
    assertEquals(mip5.width, 8);
    assertEquals(mip5.height, 8);

    // Level 6: 4x4
    const mip6 = getMipSize(baseWidth, baseHeight, 6);
    assertExists(mip6);
    assertEquals(mip6.width, 4);
    assertEquals(mip6.height, 4);

    // Level 7: 2x2
    const mip7 = getMipSize(baseWidth, baseHeight, 7);
    assertExists(mip7);
    assertEquals(mip7.width, 2);
    assertEquals(mip7.height, 2);

    // Level 8: 1x1
    const mip8 = getMipSize(baseWidth, baseHeight, 8);
    assertExists(mip8);
    assertEquals(mip8.width, 1);
    assertEquals(mip8.height, 1);
});

Deno.test("TextureHelpers - getMipSize for rectangular texture", () => {
    const baseWidth = 512;
    const baseHeight = 256;

    // Level 0: 512x256
    const mip0 = getMipSize(baseWidth, baseHeight, 0);
    assertExists(mip0);
    assertEquals(mip0.width, 512);
    assertEquals(mip0.height, 256);

    // Level 1: 256x128
    const mip1 = getMipSize(baseWidth, baseHeight, 1);
    assertExists(mip1);
    assertEquals(mip1.width, 256);
    assertEquals(mip1.height, 128);

    // Level 2: 128x64
    const mip2 = getMipSize(baseWidth, baseHeight, 2);
    assertExists(mip2);
    assertEquals(mip2.width, 128);
    assertEquals(mip2.height, 64);

    // Level 8: width reaches 2, height reaches 1
    const mip8 = getMipSize(baseWidth, baseHeight, 8);
    assertExists(mip8);
    assertEquals(mip8.width, 2);
    assertEquals(mip8.height, 1);

    // Level 9: 1x1
    const mip9 = getMipSize(baseWidth, baseHeight, 9);
    assertExists(mip9);
    assertEquals(mip9.width, 1);
    assertEquals(mip9.height, 1);
});

Deno.test("TextureHelpers - getMipSize for non-power-of-2 texture", () => {
    const baseWidth = 100;
    const baseHeight = 100;

    // Level 0: 100x100
    const mip0 = getMipSize(baseWidth, baseHeight, 0);
    assertExists(mip0);
    assertEquals(mip0.width, 100);
    assertEquals(mip0.height, 100);

    // Level 1: 50x50
    const mip1 = getMipSize(baseWidth, baseHeight, 1);
    assertExists(mip1);
    assertEquals(mip1.width, 50);
    assertEquals(mip1.height, 50);

    // Level 2: 25x25
    const mip2 = getMipSize(baseWidth, baseHeight, 2);
    assertExists(mip2);
    assertEquals(mip2.width, 25);
    assertEquals(mip2.height, 25);

    // Level 3: 12x12 (25 >> 1 = 12)
    const mip3 = getMipSize(baseWidth, baseHeight, 3);
    assertExists(mip3);
    assertEquals(mip3.width, 12);
    assertEquals(mip3.height, 12);
});

Deno.test("TextureHelpers - getMipSize handles out-of-range levels", () => {
    // 256x256 has 9 mip levels (0-8), level 9 clamps to 1x1
    const mip9 = getMipSize(256, 256, 9);
    assertExists(mip9);
    assertEquals(mip9.width, 1);
    assertEquals(mip9.height, 1);

    // Level 10 also clamps to 1x1
    const mip10 = getMipSize(256, 256, 10);
    assertExists(mip10);
    assertEquals(mip10.width, 1);
    assertEquals(mip10.height, 1);
});

// ============================================================================
// Mip Size Tests (3D)
// ============================================================================

Deno.test("TextureHelpers - getMipSize3D for 3D texture", () => {
    const baseWidth = 64;
    const baseHeight = 64;
    const baseDepth = 64;

    // Level 0: 64x64x64
    const mip0 = getMipSize3D(baseWidth, baseHeight, baseDepth, 0);
    assertExists(mip0);
    assertEquals(mip0.width, 64);
    assertEquals(mip0.height, 64);
    assertEquals(mip0.depth, 64);

    // Level 1: 32x32x32
    const mip1 = getMipSize3D(baseWidth, baseHeight, baseDepth, 1);
    assertExists(mip1);
    assertEquals(mip1.width, 32);
    assertEquals(mip1.height, 32);
    assertEquals(mip1.depth, 32);

    // Level 2: 16x16x16
    const mip2 = getMipSize3D(baseWidth, baseHeight, baseDepth, 2);
    assertExists(mip2);
    assertEquals(mip2.width, 16);
    assertEquals(mip2.height, 16);
    assertEquals(mip2.depth, 16);

    // Level 6: 1x1x1
    const mip6 = getMipSize3D(baseWidth, baseHeight, baseDepth, 6);
    assertExists(mip6);
    assertEquals(mip6.width, 1);
    assertEquals(mip6.height, 1);
    assertEquals(mip6.depth, 1);
});

Deno.test("TextureHelpers - getMipSize3D for non-cubic 3D texture", () => {
    const baseWidth = 128;
    const baseHeight = 64;
    const baseDepth = 32;

    // Level 0: 128x64x32
    const mip0 = getMipSize3D(baseWidth, baseHeight, baseDepth, 0);
    assertExists(mip0);
    assertEquals(mip0.width, 128);
    assertEquals(mip0.height, 64);
    assertEquals(mip0.depth, 32);

    // Level 1: 64x32x16
    const mip1 = getMipSize3D(baseWidth, baseHeight, baseDepth, 1);
    assertExists(mip1);
    assertEquals(mip1.width, 64);
    assertEquals(mip1.height, 32);
    assertEquals(mip1.depth, 16);

    // Level 5: depth reaches 1 first (32 >> 5 = 1)
    const mip5 = getMipSize3D(baseWidth, baseHeight, baseDepth, 5);
    assertExists(mip5);
    assertEquals(mip5.width, 4);
    assertEquals(mip5.height, 2);
    assertEquals(mip5.depth, 1);
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test("TextureHelpers - handles 1x1 texture", () => {
    // 1x1 texture has only 1 mip level
    assertEquals(calculateMipLevels(1, 1), 1);

    // Level 0 should be 1x1
    const mip0 = getMipSize(1, 1, 0);
    assertExists(mip0);
    assertEquals(mip0.width, 1);
    assertEquals(mip0.height, 1);

    // Level 1+ clamps to 1x1 (FFI behavior)
    const mip1 = getMipSize(1, 1, 1);
    assertExists(mip1);
    assertEquals(mip1.width, 1);
    assertEquals(mip1.height, 1);
});

Deno.test("TextureHelpers - handles very wide texture", () => {
    // 4096x1 texture
    const mipCount = calculateMipLevels(4096, 1);
    assertEquals(mipCount, 13); // floor(log2(4096)) + 1 = 12 + 1 = 13

    // Level 12: 1x1
    const mip12 = getMipSize(4096, 1, 12);
    assertExists(mip12);
    assertEquals(mip12.width, 1);
    assertEquals(mip12.height, 1);
});

Deno.test("TextureHelpers - handles very tall texture", () => {
    // 1x4096 texture
    const mipCount = calculateMipLevels(1, 4096);
    assertEquals(mipCount, 13);

    // Level 12: 1x1
    const mip12 = getMipSize(1, 4096, 12);
    assertExists(mip12);
    assertEquals(mip12.width, 1);
    assertEquals(mip12.height, 1);
});

Deno.test("TextureHelpers - handles large textures", () => {
    // 8192x8192 texture
    const mipCount = calculateMipLevels(8192, 8192);
    assertEquals(mipCount, 14); // floor(log2(8192)) + 1 = 13 + 1 = 14

    // 16384x16384 texture (max commonly supported)
    const mipCount16k = calculateMipLevels(16384, 16384);
    assertEquals(mipCount16k, 15);
});

// ============================================================================
// Integration with TextureManager Tests
// ============================================================================

Deno.test("TextureHelpers - mip calculations match manual calculation", () => {
    // Verify our FFI results match the expected formula:
    // mipLevels = floor(log2(max(width, height))) + 1

    const testCases = [
        { w: 256, h: 256 },
        { w: 512, h: 256 },
        { w: 100, h: 200 },
        { w: 1920, h: 1080 },
        { w: 3840, h: 2160 },
    ];

    for (const { w, h } of testCases) {
        const expected = Math.floor(Math.log2(Math.max(w, h))) + 1;
        const actual = calculateMipLevels(w, h);
        assertEquals(
            actual,
            expected,
            `Mip levels for ${w}x${h}: expected ${expected}, got ${actual}`
        );
    }
});

Deno.test("TextureHelpers - mip sizes match manual calculation", () => {
    // Verify getMipSize matches: max(1, dimension >> level)
    const baseWidth = 512;
    const baseHeight = 256;

    for (let level = 0; level < 10; level++) {
        const mip = getMipSize(baseWidth, baseHeight, level);
        const expectedWidth = Math.max(1, baseWidth >> level);
        const expectedHeight = Math.max(1, baseHeight >> level);

        if (expectedWidth >= 1 && expectedHeight >= 1) {
            assertExists(mip, `Mip level ${level} should exist`);
            assertEquals(
                mip.width,
                expectedWidth,
                `Width at level ${level}: expected ${expectedWidth}, got ${mip.width}`
            );
            assertEquals(
                mip.height,
                expectedHeight,
                `Height at level ${level}: expected ${expectedHeight}, got ${mip.height}`
            );
        }
    }
});
