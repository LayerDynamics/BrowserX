#!/usr/bin/env deno run --allow-ffi --unstable-ffi

// Test script for pixpane window creation and event handling

import {
  create_window,
  get_last_error,
  platform,
  window_count,
  window_exists,
  window_set_title,
  poll_event,
  window_close,
  type WindowConfig,
} from "./bindings/bindings.ts";

console.log("🚀 Pixpane Test Script");
console.log("======================\n");

// Get platform info
const platformName = platform();
console.log(`Platform: ${platformName}`);

// Create a window
console.log("\nCreating window...");
const config: WindowConfig = {
  title: "Pixpane Test Window",
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
};

const windowId = create_window(config);

if (windowId === 0n) {
  const error = get_last_error();
  console.error(`❌ Failed to create window: ${error}`);
  Deno.exit(1);
}

console.log(`✅ Window created successfully! ID: ${windowId}`);
console.log(`   Window count: ${window_count()}`);
console.log(`   Window exists: ${window_exists(windowId) === 1}`);

// Change the window title
console.log("\nChanging window title...");
const titleResult = window_set_title(windowId, "Updated Title!");
if (titleResult === 0) {
  console.log("✅ Title updated successfully");
} else {
  console.log(`❌ Failed to update title: ${get_last_error()}`);
}

// Poll for events
console.log("\n📡 Polling for events (close the window to exit)...");
console.log("   Try resizing, moving, or focusing the window\n");

let eventCount = 0;
let running = true;

while (running) {
  const result = await poll_event();

  // Only process real events (has_event === 1)
  if (result.has_event === 1) {
    const event = result.event;
    eventCount++;
    console.log(`\nEvent ${eventCount}:`);

    if (typeof event.event === "string") {
      console.log(`  Type: ${event.event}`);

      // Close window if close requested
      if (event.event === "CloseRequested") {
        console.log("\n🔴 Close requested, closing window...");
        const closeResult = window_close(windowId);
        if (closeResult === 0) {
          console.log("✅ Window closed successfully");
        }
        running = false;
        break;
      }
    } else {
      console.log(`  Type: ${event.event.type}`);
      console.log(`  Data: ${JSON.stringify(event.event.data)}`);
    }
  }

  // Small delay to avoid busy waiting
  await new Promise(resolve => setTimeout(resolve, 16)); // ~60 FPS
}

console.log(`\n✨ Test completed! Processed ${eventCount} events`);
console.log(`   Final window count: ${window_count()}`);
