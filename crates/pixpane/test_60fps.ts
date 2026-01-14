#!/usr/bin/env -S deno run --allow-all

// Test 60 FPS rendering with continuous redraw requests

import {
  create_window,
  window_render,
  window_upload_pixels,
  window_request_redraw,
  poll_event,
  window_close,
  get_last_error
} from "./bindings/bindings.ts";

console.log("⚡ Pixpane 60 FPS Test");
console.log("=====================\n");

const WIDTH = 800;
const HEIGHT = 600;

// Create window
const windowId = create_window({
  title: "60 FPS Test - Continuous Rendering",
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

console.log("✅ Window created\n");

// Pixel buffer
const pixelBuffer = new Uint8Array(WIDTH * HEIGHT * 4);

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

console.log("Starting 60 FPS render loop...");
console.log("Close the window to exit\n");

let frameCount = 0;
let t = 0;
const startTime = Date.now();
let lastFpsUpdate = startTime;
let framesThisSecond = 0;
let currentFps = 0;

// Request initial redraw to start the loop
window_request_redraw(windowId);

async function renderLoop() {
  while (true) {
    // Poll events (non-blocking)
    const event = await poll_event();

    // Handle close
    if (event.window_id !== 0n && event.event === "CloseRequested") {
      console.log("\n👋 Close requested");
      break;
    }

    // Render continuously (don't wait for RedrawRequested)
    // This runs as fast as possible, limited only by VSync
    {
      // Clear to gradient background
      for (let y = 0; y < HEIGHT; y++) {
        const gradient = Math.floor((y / HEIGHT) * 100) + 100;
        for (let x = 0; x < WIDTH; x++) {
          const idx = (y * WIDTH + x) * 4;
          pixelBuffer[idx + 0] = gradient;
          pixelBuffer[idx + 1] = gradient + 20;
          pixelBuffer[idx + 2] = gradient + 40;
          pixelBuffer[idx + 3] = 255;
        }
      }

      // Animated circle
      const centerX = WIDTH / 2;
      const centerY = HEIGHT / 2;
      const orbitRadius = 200;
      const cx = centerX + Math.cos(t * 0.02) * orbitRadius;
      const cy = centerY + Math.sin(t * 0.02) * orbitRadius;

      const colorPhase = (t * 0.05) % (Math.PI * 2);
      const r = Math.floor((Math.sin(colorPhase) + 1) * 127.5);
      const g = Math.floor((Math.sin(colorPhase + Math.PI * 2 / 3) + 1) * 127.5);
      const b = Math.floor((Math.sin(colorPhase + Math.PI * 4 / 3) + 1) * 127.5);

      fillCircle(Math.floor(cx), Math.floor(cy), 50, r, g, b);

      // Upload pixels
      const uploadResult = window_upload_pixels(windowId, pixelBuffer, WIDTH, HEIGHT);
      if (uploadResult !== 0) {
        console.error("❌ Failed to upload pixels:", get_last_error());
        break;
      }

      // Render
      const renderResult = window_render(windowId);
      if (renderResult !== 0) {
        console.error("❌ Render failed:", get_last_error());
        break;
      }

      // Request next redraw immediately
      window_request_redraw(windowId);

      frameCount++;
      framesThisSecond++;
      t++;

      // Calculate FPS every 500ms
      const now = Date.now();
      if (now - lastFpsUpdate >= 500) {
        const elapsed = (now - lastFpsUpdate) / 1000;
        currentFps = framesThisSecond / elapsed;
        console.log(`📊 Frame ${frameCount} - ${currentFps.toFixed(1)} FPS`);
        framesThisSecond = 0;
        lastFpsUpdate = now;
      }
    }

    // Yield to event loop (but no artificial delay)
    await Promise.resolve();
  }

  // Cleanup
  window_close(windowId);
  console.log("✅ Window closed");

  const elapsed = (Date.now() - startTime) / 1000;
  const avgFps = frameCount / elapsed;
  console.log(`\n📈 Total: ${frameCount} frames in ${elapsed.toFixed(2)}s`);
  console.log(`   Average FPS: ${avgFps.toFixed(1)}`);

  if (avgFps >= 59) {
    console.log("   ✅ Achieved 60 FPS target!");
  } else {
    console.log(`   ⚠️  Below 60 FPS target (${(60 - avgFps).toFixed(1)} FPS short)`);
  }
}

renderLoop().catch(console.error);
