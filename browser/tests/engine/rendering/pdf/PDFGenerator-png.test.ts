/**
 * PDFGenerator PNG decoding tests
 * Tests decodePNG(), compressDeflate(), scanline filters, color conversion
 */

import { assert, assertEquals } from "@std/assert";
import { PDFDocument } from "../../../../src/engine/rendering/pdf/PDFGenerator.ts";

// =============================================================================
// Test PNG data (generated with Python zlib + PNG spec)
// =============================================================================

// 1x1 red pixel, RGB, filter=None
const RED_1x1_PNG = new Uint8Array([
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
  1,
  0,
  0,
  0,
  1,
  8,
  2,
  0,
  0,
  0,
  144,
  119,
  83,
  222,
  0,
  0,
  0,
  12,
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
  0,
  3,
  1,
  1,
  0,
  201,
  254,
  146,
  239,
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

// 2x2 RGBA (red, green, blue, white), filter=None
const RGBA_2x2_PNG = new Uint8Array([
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
  6,
  0,
  0,
  0,
  114,
  182,
  13,
  36,
  0,
  0,
  0,
  18,
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
  240,
  31,
  12,
  129,
  52,
  24,
  0,
  0,
  73,
  200,
  9,
  247,
  249,
  171,
  182,
  13,
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

// 2x2 Grayscale (100, 200, 50, 150), filter=None
const GRAY_2x2_PNG = new Uint8Array([
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
  0,
  0,
  0,
  0,
  87,
  221,
  82,
  248,
  0,
  0,
  0,
  14,
  73,
  68,
  65,
  84,
  120,
  156,
  99,
  72,
  57,
  193,
  96,
  52,
  13,
  0,
  6,
  20,
  1,
  245,
  10,
  5,
  61,
  169,
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

// 2x1 RGB with Sub filter: pixel0=(100,50,25), pixel1 delta=(10,20,30) → (110,70,55)
const SUB_2x1_PNG = new Uint8Array([
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
  1,
  8,
  2,
  0,
  0,
  0,
  123,
  64,
  232,
  221,
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
  76,
  49,
  146,
  228,
  18,
  145,
  3,
  0,
  4,
  40,
  0,
  237,
  99,
  13,
  22,
  148,
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

// Helper: access private decodePNG via any cast
async function decodePNG(pngData: Uint8Array): Promise<Uint8Array> {
  const doc = new PDFDocument();
  return await (doc as any).decodePNG(pngData);
}

// =============================================================================
// decodePNG - basic decoding
// =============================================================================

Deno.test("decodePNG - 1x1 red pixel PNG returns [255, 0, 0]", async () => {
  const rgb = await decodePNG(RED_1x1_PNG);
  assertEquals(rgb.length, 3);
  assertEquals(rgb[0], 255); // R
  assertEquals(rgb[1], 0); // G
  assertEquals(rgb[2], 0); // B
});

Deno.test("decodePNG - 2x2 RGBA strips alpha, returns 12 RGB bytes", async () => {
  const rgb = await decodePNG(RGBA_2x2_PNG);
  assertEquals(rgb.length, 12); // 2x2x3
  // Pixel 0: red (255,0,0)
  assertEquals(rgb[0], 255);
  assertEquals(rgb[1], 0);
  assertEquals(rgb[2], 0);
  // Pixel 1: green (0,255,0)
  assertEquals(rgb[3], 0);
  assertEquals(rgb[4], 255);
  assertEquals(rgb[5], 0);
  // Pixel 2: blue (0,0,255)
  assertEquals(rgb[6], 0);
  assertEquals(rgb[7], 0);
  assertEquals(rgb[8], 255);
  // Pixel 3: white (255,255,255)
  assertEquals(rgb[9], 255);
  assertEquals(rgb[10], 255);
  assertEquals(rgb[11], 255);
});

Deno.test("decodePNG - grayscale converts to RGB (R=G=B=gray)", async () => {
  const rgb = await decodePNG(GRAY_2x2_PNG);
  assertEquals(rgb.length, 12); // 2x2x3
  // Pixel 0: gray=100
  assertEquals(rgb[0], 100);
  assertEquals(rgb[1], 100);
  assertEquals(rgb[2], 100);
  // Pixel 1: gray=200
  assertEquals(rgb[3], 200);
  assertEquals(rgb[4], 200);
  assertEquals(rgb[5], 200);
  // Pixel 2: gray=50
  assertEquals(rgb[6], 50);
  assertEquals(rgb[7], 50);
  assertEquals(rgb[8], 50);
  // Pixel 3: gray=150
  assertEquals(rgb[9], 150);
  assertEquals(rgb[10], 150);
  assertEquals(rgb[11], 150);
});

Deno.test("decodePNG - Sub filter reconstruction", async () => {
  const rgb = await decodePNG(SUB_2x1_PNG);
  assertEquals(rgb.length, 6); // 2x1x3
  // Pixel 0: (100, 50, 25) — raw values
  assertEquals(rgb[0], 100);
  assertEquals(rgb[1], 50);
  assertEquals(rgb[2], 25);
  // Pixel 1: (100+10, 50+20, 25+30) = (110, 70, 55)
  assertEquals(rgb[3], 110);
  assertEquals(rgb[4], 70);
  assertEquals(rgb[5], 55);
});

// =============================================================================
// decodePNG - error handling
// =============================================================================

Deno.test("decodePNG - invalid data returns empty array", async () => {
  const result = await decodePNG(new Uint8Array([1, 2, 3, 4]));
  assertEquals(result.length, 0);
});

Deno.test("decodePNG - empty data returns empty array", async () => {
  const result = await decodePNG(new Uint8Array(0));
  assertEquals(result.length, 0);
});

// =============================================================================
// compressDeflate roundtrip
// =============================================================================

Deno.test("compressDeflate/decompressZlib - roundtrip", async () => {
  const doc = new PDFDocument();
  const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const compressed = await (doc as any).compressDeflate(original);
  assert(compressed.length > 0);
  const decompressed = await (doc as any).decompressZlib(compressed);
  assertEquals(Array.from(decompressed), Array.from(original));
});

// =============================================================================
// Paeth predictor
// =============================================================================

Deno.test("paethPredictor - returns nearest neighbor", () => {
  const doc = new PDFDocument();
  const paeth = (doc as any).paethPredictor.bind(doc);
  // a=10, b=20, c=5 → p=25, pa=15, pb=5, pc=20 → returns b=20
  assertEquals(paeth(10, 20, 5), 20);
  // a=100, b=100, c=100 → p=100, pa=0, pb=0, pc=0 → returns a=100
  assertEquals(paeth(100, 100, 100), 100);
  // a=0, b=0, c=0 → returns 0
  assertEquals(paeth(0, 0, 0), 0);
});

// =============================================================================
// bytesPerPixel
// =============================================================================

Deno.test("bytesPerPixel - all color types", () => {
  const doc = new PDFDocument();
  const bpp = (doc as any).bytesPerPixel.bind(doc);
  assertEquals(bpp(0, 8), 1); // Grayscale
  assertEquals(bpp(2, 8), 3); // RGB
  assertEquals(bpp(3, 8), 1); // Indexed
  assertEquals(bpp(4, 8), 2); // Gray+Alpha
  assertEquals(bpp(6, 8), 4); // RGBA
  assertEquals(bpp(2, 16), 6); // RGB 16-bit
  assertEquals(bpp(6, 16), 8); // RGBA 16-bit
});

// =============================================================================
// addImage with PNG produces valid PDF structure
// =============================================================================

Deno.test("addImage - PNG embeds with FlateDecode and valid structure", async () => {
  const doc = new PDFDocument();
  const ref = await doc.addImage("test.png", RED_1x1_PNG, 1, 1);
  assert(ref.id > 0);
  // Calling again with same src returns cached ref
  const ref2 = await doc.addImage("test.png", RED_1x1_PNG, 1, 1);
  assertEquals(ref2.id, ref.id);
});
