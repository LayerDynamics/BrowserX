#!/usr/bin/env -S deno run --allow-all

// Test browser chrome UI with egui (URL bar, buttons, layouts)

import {
  create_window,
  window_render,
  poll_event,
  pump_events,
  window_close,
  egui_begin_frame,
  egui_horizontal_begin,
  egui_horizontal_end,
  egui_button,
  egui_label,
  egui_text_input,
  egui_end_frame,
  get_last_error
} from "./bindings/bindings.ts";

console.log("🌐 Browser Chrome UI Test");
console.log("========================\n");

const windowId = create_window({
  title: "Browser Chrome Test",
  width: 1200,
  height: 800,
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
console.log("You should see browser-like UI:");
console.log("- Back/Forward buttons");
console.log("- URL input field");
console.log("- Go button");
console.log("Close the window to exit\n");

let url = "https://example.com";
let backCount = 0;
let forwardCount = 0;

// Render loop
while (true) {
  // Pump events to ensure egui gets latest input
  pump_events();

  // Begin egui frame
  if (egui_begin_frame(windowId) !== 0) {
    console.error("❌ egui_begin_frame failed:", get_last_error());
    break;
  }

  // Build browser chrome UI
  // Horizontal layout for navigation bar
  egui_horizontal_begin(windowId);

  // Back button
  if (egui_button(windowId, "◀ Back")) {
    backCount++;
    console.log(`⬅️  Back clicked (${backCount})`);
  }

  // Forward button
  if (egui_button(windowId, "Forward ▶")) {
    forwardCount++;
    console.log(`➡️  Forward clicked (${forwardCount})`);
  }

  // URL input
  const newUrl = egui_text_input(windowId, "url", url);
  if (newUrl !== url) {
    url = newUrl;
    console.log(`🔗 URL changed: ${url}`);
  }

  // Go button
  if (egui_button(windowId, "Go")) {
    console.log(`🚀 Navigate to: ${url}`);
  }

  egui_horizontal_end(windowId);

  // Status label
  egui_label(windowId, `Back: ${backCount} | Forward: ${forwardCount}`);

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
    if (evt === "CloseRequested" || (typeof evt === "object" && evt.type === "CloseRequested")) {
      console.log("\n👋 Closing...");
      break;
    }
  }
}

// Cleanup
window_close(windowId);

console.log(`\n📊 Final stats:`);
console.log(`  Back clicks: ${backCount}`);
console.log(`  Forward clicks: ${forwardCount}`);
console.log(`  Final URL: ${url}`);
