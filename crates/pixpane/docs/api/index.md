# Pixpane API Reference

API documentation for Pixpane - the native windowing and GPU rendering layer.

## Overview

This directory contains detailed API documentation for both the Rust API and the TypeScript FFI bindings.

## Contents

### FFI Bindings (TypeScript/Deno)

#### Window Operations

- **create_window(config)** - Create a new window, returns window ID
- **close_window(id)** - Close a window
- **window_set_title(id, title)** - Set window title
- **window_set_size(id, width, height)** - Resize window
- **window_set_position(id, x, y)** - Move window
- **window_set_visible(id, visible)** - Show/hide window
- **window_set_minimized(id, minimized)** - Minimize/restore window
- **window_set_maximized(id, maximized)** - Maximize/restore window
- **window_set_fullscreen(id, fullscreen)** - Enter/exit fullscreen
- **window_request_redraw(id)** - Request window redraw

#### Event Handling

- **poll_event()** - Non-blocking event poll, returns Event
- **Event** - Window events: CloseRequested, Resized, Moved, KeyboardInput, MouseInput, etc.

#### Rendering

- **upload_pixels(id, pixels, width, height)** - Upload RGBA8 pixel buffer to GPU
- **render_window(id)** - Render current frame to window

#### egui UI

- **egui_begin(id)** - Start egui frame
- **egui_end(id)** - End egui frame and prepare for rendering
- **egui_label(id, text)** - Display text label
- **egui_button(id, label)** - Display clickable button
- **egui_text_input(id, buffer)** - Text input field
- **egui_checkbox(id, label, checked)** - Checkbox control
- **egui_slider(id, value, min, max)** - Slider control
- **egui_combo_box(id, label, items, selected)** - Dropdown combobox

#### Error Handling

- **get_last_error()** - Retrieve last error message after failed operation

### Rust API

#### Window Management (`src/window/`)

- **Window** - Core window structure
- **WindowConfig** - Window configuration
- **WindowOpener** - Window creation
- **WindowSystem** - Thread-safe window registry
- **WindowEvent** - Window event types

#### Rendering (`src/rendering/`)

- **WgpuState** - GPU state management (wgpu)
- **EguiState** - Immediate-mode UI state (egui)
- **Renderer** - Frame rendering orchestration
- **Texture** - Content texture management
- **Shaders** - GPU shader definitions (WGSL)

#### FFI Layer (`src/deno_bindings.rs`)

- All `#[deno_bindgen]` functions exposed to Deno
- Error handling via `LAST_ERROR` mutex
- Serialization/deserialization via serde

## Type Definitions

### WindowConfig

```rust
struct WindowConfig {
    title: String,
    width: u32,
    height: u32,
    resizable: bool,
    decorations: bool,
    transparent: bool,
    always_on_top: bool,
    maximized: bool,
    visible: bool,
    min_width: Option<u32>,
    min_height: Option<u32>,
    max_width: Option<u32>,
    max_height: Option<u32>,
}
```

### Event

```rust
struct Event {
    window_id: u64,
    event: String, // Event type name
    // Additional fields vary by event type
}
```

## Return Values

All FFI functions return success codes:

- **Window operations**: `0` = success, `1` = failure
- **create_window**: Returns `u64` window ID, `0` on failure
- After any failure, call `get_last_error()` for details

## Usage Patterns

### Creating a Window

```typescript
const config: WindowConfig = {
  title: "My Window",
  width: 800,
  height: 600,
  resizable: true,
  // ... other options
};

const windowId = create_window(config);
if (windowId === 0n) {
  console.error("Failed:", get_last_error());
}
```

### Event Loop

```typescript
while (true) {
  const event = poll_event();
  if (event.window_id === windowId) {
    if (event.event === "CloseRequested") {
      close_window(windowId);
      break;
    }
  }
  await new Promise(r => setTimeout(r, 16)); // 60 FPS
}
```

### Rendering Pixels

```typescript
const pixels = new Uint8Array(width * height * 4); // RGBA8
// Fill pixels...
upload_pixels(windowId, pixels, width, height);
render_window(windowId);
```

### egui UI

```typescript
egui_begin(windowId);
egui_label(windowId, "Hello!");
if (egui_button(windowId, "Click")) {
  console.log("Clicked!");
}
egui_end(windowId);
render_window(windowId);
```

## Status

✅ **Implemented** - Core API is stable and functional.

🚧 **In Progress** - Additional features being added.

## See Also

- [Examples](../examples/) - Runnable code examples
- [Guides](../guides/) - Implementation guides
- [README](../../README.md) - Getting started
