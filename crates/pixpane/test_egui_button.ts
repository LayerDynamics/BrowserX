#!/usr/bin/env -S deno run --allow-all

// Test egui button rendering

import {
  create_window,
  window_render,
  poll_event,
  pump_events,
  window_close,
  egui_begin_frame,
  egui_button,
  egui_end_frame,
  get_last_error
} from "./bindings/bindings.ts";

console.log("🎨 egui Button Test");
console.log("===================\n");

const WIDTH = 800;
const HEIGHT = 600;

// Create window
const windowId = create_window({
  title: "egui Button Test",
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

console.log("✅ Window created");
console.log("You should see a button that says 'Click Me!'");
console.log("Click it to see console output");
console.log("Close the window to exit\n");

let clickCount = 0;

// Render loop
while (true) {
  // Pump events to ensure egui gets latest input
  pump_events();

  // Begin egui frame
  if (egui_begin_frame(windowId) !== 0) {
    console.error("❌ egui_begin_frame failed:", get_last_error());
    break;
  }

  // Draw button
  const clicked = egui_button(windowId, "Click Me!");
  if (clicked) {
    clickCount++;
    console.log(`🖱️  Button clicked! Count: ${clickCount}`);
  }

  // End egui frame
  if (egui_end_frame(windowId) !== 0) {
    console.error("❌ egui_end_frame failed:", get_last_error());
    break;
  }

  // Render
  if (window_render(windowId) !== 0) {
    console.error("❌ Render failed:", get_last_error());
    break;
  }

  // Check for close event
  const result = await poll_event();
  if (result.has_event) {
    const evt = result.event.event;
    // Check both string and object formats
    if (evt === "CloseRequested" || (typeof evt === "object" && evt.type === "CloseRequested")) {
      console.log("\n👋 Closing...");
      break;
    }
  }
}

// Cleanup
window_close(windowId);

console.log(`\n📊 Total button clicks: ${clickCount}`);
