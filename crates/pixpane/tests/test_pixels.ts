#!/usr/bin/env -S deno run --allow-all

// Test pixel upload - should show colored rectangles

import {
  create_window,
  window_render,
  window_upload_pixels,
  poll_event,
  window_close,
  get_last_error
} from "./bindings/bindings.ts";

console.log("🎨 Pixpane Pixel Upload Test");
console.log("============================\n");

const WIDTH = 800;
const HEIGHT = 600;

// Create window
console.log("Creating window...");
const windowId = create_window({
  title: "Pixel Upload Test",
  width: WIDTH,
  height: HEIGHT,
  resizable: true,
  decorations: true,
  transparent: false,
  always_on_top: false,
  maximized: false,
  visible: true,
  min_width: 400,
  min_height: 300,
  max_width: null,
  max_height: null,
});

if (windowId === 0n) {
  console.error("❌ Failed to create window:", get_last_error());
  Deno.exit(1);
}

console.log(`✅ Window created with ID: ${windowId}\n`);

// Create pixel buffer (RGBA8)
const pixelBuffer = new Uint8Array(WIDTH * HEIGHT * 4);

function fillRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
  a: number = 255
) {
  for (let py = y; py < y + h && py < HEIGHT; py++) {
    for (let px = x; px < x + w && px < WIDTH; px++) {
      const idx = (py * WIDTH + px) * 4;
      pixelBuffer[idx + 0] = r;
      pixelBuffer[idx + 1] = g;
      pixelBuffer[idx + 2] = b;
      pixelBuffer[idx + 3] = a;
    }
  }
}

// Draw some colored rectangles
console.log("Drawing colored rectangles...");

// Background - light gray
fillRect(0, 0, WIDTH, HEIGHT, 240, 240, 240);

// Red rectangle
fillRect(50, 50, 200, 150, 255, 0, 0);

// Green rectangle
fillRect(300, 50, 200, 150, 0, 255, 0);

// Blue rectangle
fillRect(550, 50, 200, 150, 0, 0, 255);

// Yellow rectangle
fillRect(50, 250, 200, 150, 255, 255, 0);

// Magenta rectangle
fillRect(300, 250, 200, 150, 255, 0, 255);

// Cyan rectangle
fillRect(550, 250, 200, 150, 0, 255, 255);

// White square in center (overlapping all rectangles)
fillRect(350, 150, 100, 100, 255, 255, 255);

console.log("✅ Pixel buffer created\n");

// Upload pixels
console.log("Uploading pixels to GPU...");
const uploadResult = window_upload_pixels(windowId, pixelBuffer, WIDTH, HEIGHT);
if (uploadResult !== 0) {
  console.error("❌ Failed to upload pixels:", get_last_error());
  Deno.exit(1);
}
console.log("✅ Pixels uploaded\n");

console.log("Starting render loop...");
console.log("You should see 6 colored rectangles with a white square\n");
console.log("Close the window to exit\n");

let frameCount = 0;
const startTime = Date.now();

async function renderLoop() {
  while (true) {
    // Render frame
    const renderResult = window_render(windowId);
    if (renderResult !== 0) {
      console.error("❌ Render failed:", get_last_error());
      break;
    }

    frameCount++;

    // Show FPS every second
    if (frameCount % 60 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const fps = frameCount / elapsed;
      console.log(`📊 Rendered ${frameCount} frames (${fps.toFixed(1)} FPS)`);
    }

    // Poll events
    const event = await poll_event();
    if (event.window_id !== 0n && event.event === "CloseRequested") {
      console.log("\n👋 Close requested");
      break;
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 16)); // ~60 FPS
  }

  // Cleanup
  window_close(windowId);
  console.log("✅ Window closed");

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`\n📈 Total: ${frameCount} frames in ${elapsed.toFixed(2)}s`);
  console.log(`   Average FPS: ${(frameCount / elapsed).toFixed(1)}`);
}

renderLoop().catch(console.error);
