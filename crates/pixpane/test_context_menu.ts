#!/usr/bin/env -S deno run --allow-all

// Test right-click context menu with egui

import {
  create_window,
  window_render,
  poll_event,
  pump_events,
  window_close,
  egui_begin_frame,
  egui_label,
  egui_context_menu_area,
  egui_context_menu_begin,
  egui_context_menu_item,
  egui_context_menu_end,
  egui_end_frame,
  get_last_error
} from "./bindings/bindings.ts";

console.log("🖱️  Context Menu Test");
console.log("===================\n");

const windowId = create_window({
  title: "Context Menu Test",
  width: 600,
  height: 400,
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
console.log("Right-click anywhere to show context menu");
console.log("Close the window to exit\n");

let copyCount = 0;
let pasteCount = 0;
let deleteCount = 0;

// Render loop
while (true) {
  // Pump events
  pump_events();

  // Begin egui frame
  if (egui_begin_frame(windowId) !== 0) {
    console.error("❌ egui_begin_frame failed:", get_last_error());
    break;
  }

  // Main UI
  egui_label(windowId, "Right-click anywhere for context menu");
  egui_label(windowId, `Copy: ${copyCount} | Paste: ${pasteCount} | Delete: ${deleteCount}`);

  // Context menu area (covers entire window)
  egui_context_menu_area(windowId, "main_menu");
  egui_context_menu_begin(windowId, "main_menu");

  // Menu items
  const clickedItem = egui_context_menu_item(windowId, "main_menu", "copy", "📋 Copy");
  if (clickedItem === "copy") {
    copyCount++;
    console.log(`📋 Copy clicked (${copyCount})`);
  }

  const clickedItem2 = egui_context_menu_item(windowId, "main_menu", "paste", "📄 Paste");
  if (clickedItem2 === "paste") {
    pasteCount++;
    console.log(`📄 Paste clicked (${pasteCount})`);
  }

  const clickedItem3 = egui_context_menu_item(windowId, "main_menu", "delete", "🗑️  Delete");
  if (clickedItem3 === "delete") {
    deleteCount++;
    console.log(`🗑️  Delete clicked (${deleteCount})`);
  }

  egui_context_menu_end(windowId);

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
console.log(`  Copy: ${copyCount}`);
console.log(`  Paste: ${pasteCount}`);
console.log(`  Delete: ${deleteCount}`);
