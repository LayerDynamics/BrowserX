#!/usr/bin/env -S deno run --allow-all

// Test basic wgpu rendering - should show a white window

import { create_window, window_render, poll_event, window_close, get_last_error } from "./bindings/bindings.ts";

console.log("🎨 Pixpane Rendering Test");
console.log("========================\n");

// Create window
console.log("Creating window...");
const windowId = create_window({
  title: "Render Test - White Window",
  width: 800,
  height: 600,
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

console.log(`✅ Window created with ID: ${windowId}`);
console.log("   You should see a white window\n");

// Render loop
console.log("Starting render loop...");
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

    // Small delay to avoid burning CPU
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
