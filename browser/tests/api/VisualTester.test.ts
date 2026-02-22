/**
 * VisualTester.compare() tests
 * Verifies pixel-level PNG comparison (not byte-level)
 */

import { assert, assertEquals } from "@std/assert";
import { VisualTester } from "../../src/api/VisualTester.ts";

// Test PNG data: 2x2 all-red pixels (RGB)
const RED_2x2 = new Uint8Array([
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10,
  0,
  0,
  0,
  13,
  73,
  72,
  68,
  82,
  0,
  0,
  0,
  2,
  0,
  0,
  0,
  2,
  8,
  2,
  0,
  0,
  0,
  253,
  212,
  154,
  115,
  0,
  0,
  0,
  16,
  73,
  68,
  65,
  84,
  120,
  156,
  99,
  248,
  207,
  192,
  0,
  68,
  12,
  16,
  10,
  0,
  31,
  238,
  3,
  253,
  139,
  95,
  20,
  212,
  0,
  0,
  0,
  0,
  73,
  69,
  78,
  68,
  174,
  66,
  96,
  130,
]);

// Same image — identical bytes
const RED_2x2_COPY = new Uint8Array([
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10,
  0,
  0,
  0,
  13,
  73,
  72,
  68,
  82,
  0,
  0,
  0,
  2,
  0,
  0,
  0,
  2,
  8,
  2,
  0,
  0,
  0,
  253,
  212,
  154,
  115,
  0,
  0,
  0,
  16,
  73,
  68,
  65,
  84,
  120,
  156,
  99,
  248,
  207,
  192,
  0,
  68,
  12,
  16,
  10,
  0,
  31,
  238,
  3,
  253,
  139,
  95,
  20,
  212,
  0,
  0,
  0,
  0,
  73,
  69,
  78,
  68,
  174,
  66,
  96,
  130,
]);

// 2x2 all-blue pixels (RGB)
const BLUE_2x2 = new Uint8Array([
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10,
  0,
  0,
  0,
  13,
  73,
  72,
  68,
  82,
  0,
  0,
  0,
  2,
  0,
  0,
  0,
  2,
  8,
  2,
  0,
  0,
  0,
  253,
  212,
  154,
  115,
  0,
  0,
  0,
  15,
  73,
  68,
  65,
  84,
  120,
  156,
  99,
  96,
  96,
  248,
  15,
  70,
  96,
  10,
  0,
  23,
  246,
  3,
  253,
  126,
  235,
  55,
  243,
  0,
  0,
  0,
  0,
  73,
  69,
  78,
  68,
  174,
  66,
  96,
  130,
]);

// 3x2 all-red pixels (different dimensions)
const RED_3x2 = new Uint8Array([
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10,
  0,
  0,
  0,
  13,
  73,
  72,
  68,
  82,
  0,
  0,
  0,
  3,
  0,
  0,
  0,
  2,
  8,
  2,
  0,
  0,
  0,
  18,
  22,
  241,
  77,
  0,
  0,
  0,
  16,
  73,
  68,
  65,
  84,
  120,
  156,
  99,
  248,
  207,
  192,
  0,
  65,
  12,
  112,
  22,
  0,
  65,
  210,
  5,
  251,
  135,
  240,
  185,
  72,
  0,
  0,
  0,
  0,
  73,
  69,
  78,
  68,
  174,
  66,
  96,
  130,
]);

// Create a VisualTester with minimal mock page
function createTester(): VisualTester {
  return new VisualTester({} as any);
}

// =============================================================================
// Identical images
// =============================================================================

Deno.test("compare - identical PNGs match perfectly", async () => {
  const tester = createTester();
  const result = await tester.compare(RED_2x2, RED_2x2_COPY);
  assertEquals(result.match, true);
  assertEquals(result.diffPercentage, 0);
  assertEquals(result.diffPixelCount, 0);
  assertEquals(result.totalPixels, 4);
  assertEquals(result.sameDimensions, true);
  assertEquals(result.dimensions.width, 2);
  assertEquals(result.dimensions.height, 2);
});

// =============================================================================
// Different images
// =============================================================================

Deno.test("compare - red vs blue PNG detects 100% diff", async () => {
  const tester = createTester();
  const result = await tester.compare(RED_2x2, BLUE_2x2);
  assertEquals(result.match, false);
  assertEquals(result.diffPixelCount, 4); // All 4 pixels differ
  assertEquals(result.diffPercentage, 100);
  assertEquals(result.sameDimensions, true);
});

// =============================================================================
// Different dimensions
// =============================================================================

Deno.test("compare - different dimensions detected", async () => {
  const tester = createTester();
  const result = await tester.compare(RED_2x2, RED_3x2);
  assertEquals(result.sameDimensions, false);
  // 3x2=6 total pixels, 2x2 only covers 4, so 2 pixels out of bounds
  assertEquals(result.dimensions.width, 3);
  assertEquals(result.dimensions.height, 2);
});

// =============================================================================
// Threshold
// =============================================================================

Deno.test("compare - threshold allows small differences", async () => {
  const tester = createTester();
  // Red vs blue with high threshold (1.0 = any difference OK)
  const result = await tester.compare(RED_2x2, BLUE_2x2, { threshold: 1.0 });
  assertEquals(result.match, true);
});

Deno.test("compare - exact threshold (0) requires identical pixels", async () => {
  const tester = createTester();
  const result = await tester.compare(RED_2x2, BLUE_2x2, { threshold: 0 });
  assertEquals(result.match, false);
});

// =============================================================================
// Decoded pixel dimensions are correct
// =============================================================================

Deno.test("compare - returns correct dimensions from decoded PNG", async () => {
  const tester = createTester();
  const result = await tester.compare(RED_3x2, RED_3x2);
  assertEquals(result.dimensions.width, 3);
  assertEquals(result.dimensions.height, 2);
  assertEquals(result.totalPixels, 6);
});

// =============================================================================
// PNG decoder (private method)
// =============================================================================

Deno.test("decodePNGToRGBA - decodes 2x2 red RGB PNG to RGBA", async () => {
  const tester = createTester();
  const decoded = await (tester as any).decodePNGToRGBA(RED_2x2);
  assertEquals(decoded.width, 2);
  assertEquals(decoded.height, 2);
  assertEquals(decoded.pixels.length, 16); // 2*2*4 RGBA
  // First pixel: R=255, G=0, B=0, A=255
  assertEquals(decoded.pixels[0], 255);
  assertEquals(decoded.pixels[1], 0);
  assertEquals(decoded.pixels[2], 0);
  assertEquals(decoded.pixels[3], 255);
});

Deno.test("decodePNGToRGBA - non-PNG data returns raw interpretation", async () => {
  const tester = createTester();
  const raw = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const decoded = await (tester as any).decodePNGToRGBA(raw);
  assert(decoded.width > 0);
  assert(decoded.height > 0);
});
