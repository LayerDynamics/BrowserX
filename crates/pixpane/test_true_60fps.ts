#!/usr/bin/env -S deno run --allow-all

// Test true 60 FPS with VSync - no artificial delays

import {
  create_window,
  window_render,
  window_upload_pixels,
  poll_event,
  window_close,
  get_last_error
} from "./bindings/bindings.ts";

console.log("⚡ True 60 FPS Test - VSync Limited");
console.log("===================================\n");

const WIDTH = 800;
const HEIGHT = 600;

// Create window
const windowId = create_window({
  title: "True 60 FPS - VSync Locked",
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

// Helper functions for drawing
function fillCircle(
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number
) {
  const r2 = radius * radius;
  for (let py = Math.max(0, cy - radius); py < Math.min(HEIGHT, cy + radius); py++) {
    for (let px = Math.max(0, cx - radius); px < Math.min(WIDTH, cx + radius); px++) {
      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy <= r2) {
        const idx = (py * WIDTH + px) * 4;
        pixels[idx + 0] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = 255;
      }
    }
  }
}

// Update pixels with animated circle
function updatePixels(frame: number) {
  // Clear to gradient background
  for (let y = 0; y < HEIGHT; y++) {
    const gradient = Math.floor((y / HEIGHT) * 100) + 100;
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      pixels[idx + 0] = gradient;
      pixels[idx + 1] = gradient + 20;
      pixels[idx + 2] = gradient + 40;
      pixels[idx + 3] = 255;
    }
  }

  // Animated circle position (circular orbit)
  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;
  const orbitRadius = 200;
  const cx = centerX + Math.cos(frame * 0.02) * orbitRadius;
  const cy = centerY + Math.sin(frame * 0.02) * orbitRadius;

  // Circle color changes over time
  const colorPhase = (frame * 0.05) % (Math.PI * 2);
  const r = Math.floor((Math.sin(colorPhase) + 1) * 127.5);
  const g = Math.floor((Math.sin(colorPhase + Math.PI * 2 / 3) + 1) * 127.5);
  const b = Math.floor((Math.sin(colorPhase + Math.PI * 4 / 3) + 1) * 127.5);

  fillCircle(Math.floor(cx), Math.floor(cy), 50, r, g, b);
}

console.log("✅ Window created");
console.log("Starting continuous render loop...\n");
console.log("You should see a moving colored circle on a gradient background");
console.log("Rendering as fast as possible, limited only by VSync");
console.log("No setTimeout delays - pure VSync synchronization");
console.log("Close the window to exit\n");

let frame = 0;
const startTime = performance.now();
let lastSecond = Math.floor(startTime / 1000);
let framesThisSecond = 0;

// Continuous render loop - VSync will limit us to 60 FPS
while (true) {
  // Update pixels for this frame
  updatePixels(frame);

  // Upload to GPU
  if (window_upload_pixels(windowId, pixels, WIDTH, HEIGHT) !== 0) {
    console.error("❌ Upload failed:", get_last_error());
    break;
  }

  // Render - this will block until VSync and automatically request next redraw
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

  // Check for close event (non-blocking)
  const event = await poll_event();
  if (event.window_id !== 0n && event.event === "CloseRequested") {
    console.log("\n👋 Closing...");
    break;
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
