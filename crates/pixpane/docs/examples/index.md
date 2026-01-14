# Pixpane Examples

Practical examples demonstrating how to use Pixpane for native windowing and GPU rendering.

## Overview

This directory contains runnable code examples showing real-world usage of Pixpane from Deno.

## Available Examples

### Basic Window Management

- **01-create-window.ts** - Creating and configuring a window
- **02-window-events.ts** - Handling window events (close, resize, move)
- **03-keyboard-input.ts** - Keyboard event handling
- **04-mouse-input.ts** - Mouse event handling
- **05-window-controls.ts** - Minimize, maximize, fullscreen

### Rendering

- **06-pixel-rendering.ts** - Uploading pixel buffers to GPU
- **07-gradient-render.ts** - Rendering color gradients
- **08-image-display.ts** - Displaying images
- **09-animation.ts** - Animated content
- **10-60fps-render.ts** - 60 FPS rendering loop

### egui UI

- **11-egui-basics.ts** - Basic egui UI elements
- **12-egui-buttons.ts** - Button interactions
- **13-egui-text-input.ts** - Text input fields
- **14-egui-layout.ts** - UI layout patterns
- **15-egui-windows.ts** - Multiple egui windows

### Advanced Features

- **16-multiple-windows.ts** - Managing multiple windows
- **17-window-transparency.ts** - Transparent windows
- **18-fullscreen-app.ts** - Fullscreen application
- **19-vsync-timing.ts** - VSync and frame timing
- **20-event-driven.ts** - Event-driven architecture

### Integration

- **21-browser-integration.ts** - Integrating with browser engine
- **22-custom-renderer.ts** - Custom rendering pipeline
- **23-performance-monitor.ts** - Performance monitoring

## Running Examples

```bash
cd crates/pixpane

# Basic example (requires display)
deno run --allow-ffi --unstable-ffi docs/examples/01-create-window.ts

# Rendering example
deno run --allow-ffi --unstable-ffi docs/examples/06-pixel-rendering.ts

# egui example
deno run --allow-ffi --unstable-ffi docs/examples/11-egui-basics.ts
```

## Example Structure

Each example follows this pattern:

```typescript
/**
 * Example: [Name]
 *
 * Description of what this example demonstrates.
 */

import {
  create_window,
  poll_event,
  render_window,
  type WindowConfig,
} from "../../bindings/bindings.ts";

// Configuration
const config: WindowConfig = {
  title: "Example",
  width: 800,
  height: 600,
  // ... other options
};

// Main function
async function main() {
  const windowId = create_window(config);
  if (windowId === 0n) {
    console.error("Failed to create window");
    return;
  }

  // Event loop
  while (true) {
    const event = poll_event();
    if (event.window_id === windowId && event.event === "CloseRequested") {
      break;
    }
    // Render frame
    render_window(windowId);
    await new Promise(r => setTimeout(r, 16)); // 60 FPS
  }
}

if (import.meta.main) {
  await main();
}
```

## Requirements

- **Display environment**: Examples create actual windows and require a display
- **Deno permissions**: `--allow-ffi --unstable-ffi` required for FFI calls
- **Built library**: Run `cargo build --release` first

## Status

🚧 **In Progress** - Examples are being added to demonstrate all features.

## See Also

- [Test Files](../../test*.ts) - Additional test examples in repository root
