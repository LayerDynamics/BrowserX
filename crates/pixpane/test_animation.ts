#!/usr/bin/env -S deno run --allow-all

// Test animated pixel updates - simulates RenderingPipeline updates

import {
  create_window,
  window_render,
  window_upload_pixels,
  poll_event,
  window_close,
  get_last_error
} from "./bindings/bindings.ts";

console.log("🎬 Pixpane Animation Test");
console.log("=========================\n");

const WIDTH = 800;
const HEIGHT = 600;

// Create window
console.log("Creating window...");
const windowId = create_window({
  title: "Animation Test - Moving Circle",
  width: WIDTH,
  height: HEIGHT,
  resizable: true,
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

console.log(`✅ Window created\n`);

// Pixel buffer
const pixelBuffer = new Uint8Array(WIDTH * HEIGHT * 4);

function fillRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number
) {
  for (let py = y; py < y + h && py < HEIGHT; py++) {
    for (let px = x; px < x + w && px < WIDTH; px++) {
      const idx = (py * WIDTH + px) * 4;
      pixelBuffer[idx + 0] = r;
      pixelBuffer[idx + 1] = g;
      pixelBuffer[idx + 2] = b;
      pixelBuffer[idx + 3] = 255;
    }
  }
}

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
        pixelBuffer[idx + 0] = r;
        pixelBuffer[idx + 1] = g;
        pixelBuffer[idx + 2] = b;
        pixelBuffer[idx + 3] = 255;
      }
    }
  }
}

console.log("Starting animation...");
console.log("You should see a moving circle with a gradient background\n");
console.log("Close the window to exit\n");

let frameCount = 0;
let t = 0;
const startTime = Date.now();

async function renderLoop() {
  while (true) {
    // Clear to gradient background
    for (let y = 0; y < HEIGHT; y++) {
      const gradient = Math.floor((y / HEIGHT) * 100) + 100;
      fillRect(0, y, WIDTH, 1, gradient, gradient + 20, gradient + 40);
    }

    // Animated circle position (circular path)
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    const orbitRadius = 200;
    const cx = centerX + Math.cos(t * 0.02) * orbitRadius;
    const cy = centerY + Math.sin(t * 0.02) * orbitRadius;

    // Draw circle with color based on position
    const colorPhase = (t * 0.05) % (Math.PI * 2);
    const r = Math.floor((Math.sin(colorPhase) + 1) * 127.5);
    const g = Math.floor((Math.sin(colorPhase + Math.PI * 2 / 3) + 1) * 127.5);
    const b = Math.floor((Math.sin(colorPhase + Math.PI * 4 / 3) + 1) * 127.5);

    fillCircle(Math.floor(cx), Math.floor(cy), 50, r, g, b);

    // Upload updated pixels
    const uploadResult = window_upload_pixels(windowId, pixelBuffer, WIDTH, HEIGHT);
    if (uploadResult !== 0) {
      console.error("❌ Failed to upload pixels:", get_last_error());
      break;
    }

    // Render frame
    const renderResult = window_render(windowId);
    if (renderResult !== 0) {
      console.error("❌ Render failed:", get_last_error());
      break;
    }

    frameCount++;
    t++;

    // Show FPS every 60 frames
    if (frameCount % 60 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const fps = frameCount / elapsed;
      console.log(`📊 Frame ${frameCount} - ${fps.toFixed(1)} FPS`);
    }

    // Poll events
    const event = await poll_event();
    if (event.window_id !== 0n && event.event === "CloseRequested") {
      console.log("\n👋 Close requested");
      break;
    }

    // Target ~60 FPS
    await new Promise(resolve => setTimeout(resolve, 16));
  }

  // Cleanup
  window_close(windowId);
  console.log("✅ Window closed");

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`\n📈 Total: ${frameCount} frames in ${elapsed.toFixed(2)}s`);
  console.log(`   Average FPS: ${(frameCount / elapsed).toFixed(1)}`);
}

renderLoop().catch(console.error);
