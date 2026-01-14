#!/usr/bin/env -S deno run --allow-all

// Test event-driven 60 FPS rendering with VSync

import {
  create_window,
  window_render,
  window_upload_pixels,
  window_request_redraw,
  poll_event,
  window_close,
  get_last_error
} from "./bindings/bindings.ts";

console.log("⚡ Event-Driven 60 FPS Test");
console.log("==========================\n");

const WIDTH = 800;
const HEIGHT = 600;

// Create window
const windowId = create_window({
  title: "Event-Driven 60 FPS - VSync Locked",
  width: WIDTH,
  height: HEIGHT,
  resizable: false,
  decorations: true,
  transparent: false,
  always_on_top: false,
  maximized: false,
  visible: true,
  min_width: null,
  min_height: null,
  max_width: null,
  max_height: null,
});

if (windowId === 0n) {
  console.error("❌ Failed to create window:", get_last_error());
  Deno.exit(1);
}

// Create pixel buffer
const pixels = new Uint8Array(WIDTH * HEIGHT * 4);

// Fill with color that changes each frame
function updatePixels(frame: number) {
  const hue = (frame * 2) % 360;
  const r = Math.floor(Math.abs(Math.sin(hue * Math.PI / 180)) * 255);
  const g = Math.floor(Math.abs(Math.sin((hue + 120) * Math.PI / 180)) * 255);
  const b = Math.floor(Math.abs(Math.sin((hue + 240) * Math.PI / 180)) * 255);

  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
  }
}

console.log("✅ Window created");
console.log("Starting event-driven render loop...\n");
console.log("The window should smoothly cycle through colors at exactly 60 FPS");
console.log("Rendering happens ONLY on RedrawRequested events");
console.log("Close the window to exit\n");

let frame = 0;
const startTime = performance.now();
let lastSecond = Math.floor(startTime / 1000);
let framesThisSecond = 0;

// Request initial redraw to start the loop
window_request_redraw(windowId);

// Event-driven render loop
while (true) {
  // Wait for events (non-blocking poll)
  const event = await poll_event();

  // Yield to allow event loop to process
  await new Promise(resolve => setTimeout(resolve, 0));

  // Check for close event
  if (event.window_id !== 0n && event.event === "CloseRequested") {
    console.log("\n👋 Closing...");
    break;
  }

  // Debug: log all events for the window
  if (event.window_id === windowId) {
    console.log(`Event: ${event.event}`);
  }

  // Only render when RedrawRequested event is received
  if (event.window_id === windowId && event.event === "RedrawRequested") {
    // Update pixels for this frame
    updatePixels(frame);

    // Upload to GPU
    if (window_upload_pixels(windowId, pixels, WIDTH, HEIGHT) !== 0) {
      console.error("❌ Upload failed:", get_last_error());
      break;
    }

    // Render (this will automatically request the next redraw)
    if (window_render(windowId) !== 0) {
      console.error("❌ Render failed:", get_last_error());
      break;
    }

    frame++;
    framesThisSecond++;

    // Show FPS every second
    const currentSecond = Math.floor(performance.now() / 1000);
    if (currentSecond !== lastSecond) {
      const elapsed = (performance.now() - startTime) / 1000;
      const avgFps = frame / elapsed;
      console.log(
        `📊 Second ${currentSecond - Math.floor(startTime / 1000)}: ` +
        `${framesThisSecond} frames this second, ` +
        `${avgFps.toFixed(2)} FPS average`
      );
      framesThisSecond = 0;
      lastSecond = currentSecond;
    }
  }
}

// Cleanup
window_close(windowId);

const elapsed = (performance.now() - startTime) / 1000;
const avgFps = frame / elapsed;

console.log(`\n📈 Final Statistics:`);
console.log(`   Total frames: ${frame}`);
console.log(`   Total time: ${elapsed.toFixed(2)}s`);
console.log(`   Average FPS: ${avgFps.toFixed(2)}`);

if (avgFps >= 59.5 && avgFps <= 60.5) {
  console.log("   ✅ Perfect 60 FPS!");
} else if (avgFps >= 55) {
  console.log(`   ⚠️  Close to 60 FPS (off by ${Math.abs(60 - avgFps).toFixed(2)})`);
} else {
  console.log(`   ❌ Below target (${(60 - avgFps).toFixed(2)} FPS short)`);
}
