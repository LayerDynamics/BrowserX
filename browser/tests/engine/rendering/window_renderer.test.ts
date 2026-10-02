import { assertEquals } from "@std/assert";
import { WindowRenderer } from "../../../src/engine/rendering/WindowRenderer.ts";

// ---------------------------------------------------------------------------
// Offscreen mode tests (no pixpane needed)
// ---------------------------------------------------------------------------

Deno.test("WindowRenderer - offscreen mode initialize/destroy", async () => {
  const renderer = new WindowRenderer({
    mode: "offscreen",
    width: 800,
    height: 600,
  });
  assertEquals(renderer.isRunning(), false);
  await renderer.initialize();
  assertEquals(renderer.isRunning(), true);
  assertEquals(renderer.getMode(), "offscreen");
  renderer.destroy();
  assertEquals(renderer.isRunning(), false);
});

Deno.test("WindowRenderer - offscreen present stores pixels", async () => {
  const renderer = new WindowRenderer({
    mode: "offscreen",
    width: 4,
    height: 2,
  });
  await renderer.initialize();

  // Create a small RGBA8 buffer (4x2 = 32 bytes)
  const pixels = new Uint8ClampedArray(4 * 2 * 4);
  pixels[0] = 255; // R of pixel (0,0)

  const info = renderer.present(pixels, 4, 2);
  assertEquals(info.frameNumber, 1);
  assertEquals(typeof info.presentTime, "number");

  const stored = renderer.getPixels();
  assertEquals(stored !== null, true);
  assertEquals(stored![0], 255);
  assertEquals(renderer.getPixelDimensions(), { width: 4, height: 2 });

  renderer.destroy();
  assertEquals(renderer.getPixels(), null);
});

Deno.test("WindowRenderer - frame counter increments", async () => {
  const renderer = new WindowRenderer({
    mode: "offscreen",
    width: 2,
    height: 2,
  });
  await renderer.initialize();

  const px = new Uint8ClampedArray(2 * 2 * 4);
  renderer.present(px, 2, 2);
  renderer.present(px, 2, 2);
  renderer.present(px, 2, 2);

  assertEquals(renderer.getFrameNumber(), 3);
  renderer.destroy();
});

Deno.test("WindowRenderer - resize updates config", async () => {
  const renderer = new WindowRenderer({
    mode: "offscreen",
    width: 800,
    height: 600,
  });
  await renderer.initialize();
  renderer.resize(1920, 1080);
  // Resize doesn't affect stored pixel dimensions — only affects future renders
  assertEquals(renderer.isRunning(), true);
  renderer.destroy();
});

Deno.test("WindowRenderer - pollEvents returns empty in offscreen mode", async () => {
  const renderer = new WindowRenderer({
    mode: "offscreen",
    width: 800,
    height: 600,
  });
  await renderer.initialize();
  const events = await renderer.pollEvents();
  assertEquals(events.length, 0);
  renderer.destroy();
});

Deno.test("WindowRenderer - native mode falls back to offscreen when pixpane unavailable", async () => {
  const renderer = new WindowRenderer({
    mode: "native",
    title: "Test Window",
    width: 800,
    height: 600,
  });
  await renderer.initialize();
  assertEquals(renderer.isRunning(), true);

  // Present should work (stores in offscreen buffer, pixpane unavailable so no FFI call)
  const px = new Uint8ClampedArray(800 * 600 * 4);
  const info = renderer.present(px, 800, 600);
  assertEquals(info.frameNumber, 1);
  assertEquals(renderer.getPixels() !== null, true);

  renderer.destroy();
});

Deno.test("WindowRenderer - initialize is idempotent", async () => {
  const renderer = new WindowRenderer({
    mode: "offscreen",
    width: 100,
    height: 100,
  });
  await renderer.initialize();
  await renderer.initialize(); // should not throw
  assertEquals(renderer.isRunning(), true);
  renderer.destroy();
});
