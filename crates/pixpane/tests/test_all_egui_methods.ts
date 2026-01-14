#!/usr/bin/env -S deno run --allow-all

// Comprehensive test of all egui deno_bindgen methods

import {
  create_window,
  window_render,
  poll_event,
  pump_events,
  window_close,
  egui_begin_frame,
  egui_label,
  egui_button,
  egui_text_input,
  egui_horizontal_begin,
  egui_horizontal_end,
  egui_context_menu_area,
  egui_context_menu_begin,
  egui_context_menu_item,
  egui_context_menu_end,
  egui_end_frame,
  get_last_error,
  platform,
  window_count,
} from "./bindings/bindings.ts";

console.log("🧪 Comprehensive egui Methods Test");
console.log("===================================\n");

// Test platform info
console.log(`📱 Platform: ${platform()}`);
console.log(`🪟  Window count: ${window_count()}\n`);

const windowId = create_window({
  title: "All egui Methods Test",
  width: 800,
  height: 600,
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
console.log("Testing all egui methods:");
console.log("- Labels");
console.log("- Buttons");
console.log("- Text input");
console.log("- Horizontal layout");
console.log("- Context menu (right-click)\n");

let clickCount = 0;
let textValue = "Edit me!";
let menuClicks = 0;

// Render loop
let frameCount = 0;
while (frameCount < 600) { // Auto-exit after 10 seconds at 60fps
  frameCount++;

  pump_events();

  // Begin egui frame
  if (egui_begin_frame(windowId) !== 0) {
    console.error("❌ egui_begin_frame failed:", get_last_error());
    break;
  }

  // Test 1: Labels
  egui_label(windowId, `Frame: ${frameCount}`);
  egui_label(windowId, "This is a label");

  // Test 2: Buttons
  if (egui_button(windowId, "Click Me!")) {
    clickCount++;
    console.log(`🖱️  Button clicked! Count: ${clickCount}`);
  }

  // Test 3: Horizontal layout with multiple buttons
  egui_horizontal_begin(windowId);

  if (egui_button(windowId, "Left")) {
    console.log("⬅️  Left button clicked");
  }

  if (egui_button(windowId, "Middle")) {
    console.log("🔘 Middle button clicked");
  }

  if (egui_button(windowId, "Right")) {
    console.log("➡️  Right button clicked");
  }

  egui_horizontal_end(windowId);

  // Test 4: Text input
  const newText = egui_text_input(windowId, "text1", textValue);
  if (newText !== textValue) {
    textValue = newText;
    console.log(`✏️  Text changed: "${textValue}"`);
  }

  // Test 5: Status label
  egui_label(windowId, `Stats: Clicks=${clickCount} | Menu=${menuClicks}`);

  // Test 6: Context menu
  egui_context_menu_area(windowId, "main");
  egui_context_menu_begin(windowId, "main");

  const item1 = egui_context_menu_item(windowId, "main", "opt1", "📋 Option 1");
  if (item1 === "opt1") {
    menuClicks++;
    console.log(`🖱️  Context menu: Option 1 (${menuClicks})`);
  }

  const item2 = egui_context_menu_item(windowId, "main", "opt2", "📄 Option 2");
  if (item2 === "opt2") {
    menuClicks++;
    console.log(`🖱️  Context menu: Option 2 (${menuClicks})`);
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
      console.log("\n👋 User closed window");
      break;
    }
  }
}

// Cleanup
window_close(windowId);

console.log("\n✅ All egui methods tested successfully!");
console.log(`📊 Final stats:`);
console.log(`   Frames rendered: ${frameCount}`);
console.log(`   Button clicks: ${clickCount}`);
console.log(`   Menu clicks: ${menuClicks}`);
console.log(`   Final text: "${textValue}"`);
console.log(`   Window count: ${window_count()}`);
