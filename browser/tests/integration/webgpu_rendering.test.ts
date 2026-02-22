/**
 * WebGPU Rendering Integration Tests
 *
 * Tests the complete WebGPU rendering pipeline in Deno.
 */

import { assertEquals, assertExists } from "@std/assert";
import { OffscreenWebGPU } from "../../src/engine/webgpu/offscreen/OffscreenWebGPU.ts";

Deno.test({
  name: "OffscreenWebGPU - initialization",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Skip if no GPU available
    if (!navigator.gpu) {
      console.log("WebGPU not available, skipping test");
      return;
    }

    const offscreen = new OffscreenWebGPU();
    await offscreen.initialize(800, 600);

    assertExists(offscreen.gpuDevice, "GPU device should be initialized");
    assertExists(offscreen.texture, "Render texture should be created");

    offscreen.dispose();
  },
});

Deno.test({
  name: "OffscreenWebGPU - getPixels returns correct size",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    if (!navigator.gpu) {
      console.log("WebGPU not available, skipping test");
      return;
    }

    const width = 100;
    const height = 100;
    const offscreen = new OffscreenWebGPU();
    await offscreen.initialize(width, height);

    const pixels = await offscreen.getPixels();

    // RGBA = 4 bytes per pixel
    assertEquals(
      pixels.length,
      width * height * 4,
      "Pixel buffer should be width * height * 4 bytes",
    );

    offscreen.dispose();
  },
});

Deno.test({
  name: "OffscreenWebGPU - resize updates texture",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    if (!navigator.gpu) {
      console.log("WebGPU not available, skipping test");
      return;
    }

    const offscreen = new OffscreenWebGPU();
    await offscreen.initialize(100, 100);

    // Resize
    offscreen.resize(200, 150);

    const pixels = await offscreen.getPixels();
    assertEquals(pixels.length, 200 * 150 * 4, "Pixel buffer should match new dimensions");

    offscreen.dispose();
  },
});

Deno.test({
  name: "OffscreenWebGPU - clear renders solid color",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    if (!navigator.gpu) {
      console.log("WebGPU not available, skipping test");
      return;
    }

    const offscreen = new OffscreenWebGPU();
    await offscreen.initialize(10, 10);

    const device = offscreen.gpuDevice;
    const texture = offscreen.texture;

    if (!device || !texture) {
      console.log("Device or texture not available");
      return;
    }

    // Create command encoder and clear to red
    const encoder = device.createCommandEncoder();
    const colorAttachment = {
      view: texture.createView(),
      clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
      loadOp: "clear" as const,
      storeOp: "store" as const,
    };
    const pass = encoder.beginRenderPass({
      colorAttachments: Array.of(colorAttachment) as GPURenderPassColorAttachment[],
    });
    pass.end();
    device.queue.submit(Array.of(encoder.finish()) as GPUCommandBuffer[]);

    // Read back pixels
    const pixels = await offscreen.getPixels();

    // Check first pixel is red (RGBA)
    // Note: Values may vary slightly due to color space conversion
    const r = pixels[0];
    const g = pixels[1];
    const b = pixels[2];
    const a = pixels[3];

    // Red should be high, green and blue should be low
    assertEquals(r > 200, true, `Red channel should be high, got ${r}`);
    assertEquals(g < 50, true, `Green channel should be low, got ${g}`);
    assertEquals(b < 50, true, `Blue channel should be low, got ${b}`);
    assertEquals(a > 200, true, `Alpha channel should be high, got ${a}`);

    offscreen.dispose();
  },
});

Deno.test({
  name: "WebGPU availability check",
  fn() {
    // This test always passes - it just reports GPU availability
    if (navigator.gpu) {
      console.log("WebGPU is available");
    } else {
      console.log("WebGPU is NOT available (headless environment)");
    }
  },
});
