# Pixpane

> 🦀 Native windowing and GPU rendering for Deno via Rust FFI

A cross-platform windowing toolkit built with Rust using **winit**, **wgpu**, and **egui**, exposed to Deno via **deno_bindgen 0.8.1**. Pixpane provides the native window layer for BrowserX's rendering output.

## Features

- ✅ **Cross-platform windowing** (macOS, Linux, Windows) via winit 0.30
- ✅ **GPU acceleration** with wgpu 22 for hardware-accelerated rendering
- ✅ **Immediate-mode UI** using egui 0.29 for built-in UI elements
- ✅ **Full window management** (create, resize, move, minimize, maximize, fullscreen)
- ✅ **Event handling** (window events, keyboard, mouse, touch)
- ✅ **Pixel buffer rendering** - upload RGBA pixels directly to GPU
- ✅ **FFI bindings** with full TypeScript types via deno_bindgen
- ✅ **Thread-safe** window registry with concurrent access
- ✅ **Non-blocking** event polling for async integration

## Architecture

Pixpane serves as the native window and GPU layer for BrowserX:

```
┌────────────────────────────────────┐
│  Browser Engine (TypeScript/Deno)  │
│  - Generates pixel buffers         │
│  - Layout, paint, composite        │
└────────────────────────────────────┘
               ↓ FFI (deno_bindgen)
┌────────────────────────────────────┐
│  Pixpane (Rust)                    │
│  - Window management (winit)       │
│  - GPU rendering (wgpu)            │
│  - UI overlays (egui)              │
└────────────────────────────────────┘
```

## Building & Development

### Prerequisites

- Rust 1.70+ with Cargo
- Deno 2.x or later

### Important: deno_bindgen Custom Script

**⚠️ The official `deno_bindgen` CLI doesn't work in Cargo workspaces.** Use the custom `gen_bindings.ts` script instead:

```bash
cd crates/pixpane

# 1. Build the Rust library
cargo build --release

# 2. Generate TypeScript bindings using custom script
deno run --allow-all gen_bindings.ts

# 3. Test the bindings
deno run --allow-ffi --unstable-ffi tests/test.ts
```

The `gen_bindings.ts` script:
- Locates `bindings.json` in Cargo build output (`target/release/build/pixpane-*/out/bindings.json`)
- Uses deno_bindgen codegen from `/resources/deno_bindgen-0.8.1/codegen.ts`
- Generates `bindings/bindings.ts` with FFI definitions and TypeScript types
- Sets correct library path for workspace structure

**Compiled library location:**
- macOS: `../../target/release/libpixpane.dylib`
- Linux: `../../target/release/libpixpane.so`
- Windows: `../../target/release/pixpane.dll`

### After Changes to FFI Bindings

After modifying `src/deno_bindings.rs`:

```bash
cargo build --release && deno run --allow-all gen_bindings.ts
```

## Usage from Deno

### Basic Window Creation

```typescript
import {
  create_window,
  poll_event,
  window_set_title,
  close_window,
  type WindowConfig,
  type Event,
} from "./bindings/bindings.ts";

// Create a window
const config: WindowConfig = {
  title: "My Window",
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
  console.error("Failed to create window");
  Deno.exit(1);
}

// Event loop
while (true) {
  const event: Event = poll_event();

  if (event.window_id === windowId) {
    console.log("Event:", event.event);

    if (event.event === "CloseRequested") {
      close_window(windowId);
      break;
    }
  }

  // 60 FPS
  await new Promise(resolve => setTimeout(resolve, 16));
}
```

### Uploading Pixels (Rendering)

```typescript
import { upload_pixels, render_window } from "./bindings/bindings.ts";

// Create RGBA pixel buffer (red gradient)
const width = 800;
const height = 600;
const pixels = new Uint8Array(width * height * 4);

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    pixels[i] = Math.floor((x / width) * 255);     // R
    pixels[i + 1] = 0;                             // G
    pixels[i + 2] = 0;                             // B
    pixels[i + 3] = 255;                           // A
  }
}

// Upload to GPU
upload_pixels(windowId, pixels, width, height);

// Render frame
render_window(windowId);
```

### Using egui for UI

```typescript
import {
  egui_begin,
  egui_button,
  egui_label,
  egui_text_input,
  egui_end,
  render_window,
} from "./bindings/bindings.ts";

let textBuffer = "Hello, world!";

function renderFrame() {
  // Start egui frame
  egui_begin(windowId);

  // Add UI elements
  egui_label(windowId, "Welcome to Pixpane!");

  if (egui_button(windowId, "Click Me")) {
    console.log("Button clicked!");
  }

  textBuffer = egui_text_input(windowId, textBuffer);

  // End frame and render
  egui_end(windowId);
  render_window(windowId);
}

// Call renderFrame() in event loop
```

## API Reference

### Window Operations

```typescript
// Create window, returns window ID (0 on failure)
create_window(config: WindowConfig): u64

// Window manipulation (all return 0 on success, 1 on failure)
window_set_title(id: u64, title: string): u8
window_set_size(id: u64, width: u32, height: u32): u8
window_set_position(id: u64, x: i32, y: i32): u8
window_set_visible(id: u64, visible: boolean): u8
window_set_minimized(id: u64, minimized: boolean): u8
window_set_maximized(id: u64, maximized: boolean): u8
window_set_fullscreen(id: u64, fullscreen: boolean): u8
window_request_redraw(id: u64): u8
close_window(id: u64): u8
```

### Event Handling

```typescript
// Non-blocking event poll
poll_event(): Event

// Event structure
interface Event {
  window_id: u64;  // 0 if no event
  event: string;   // Event type: "CloseRequested", "Resized", "Moved", etc.
  // Additional fields depend on event type
}
```

### Rendering

```typescript
// Upload RGBA8 pixel buffer to GPU
upload_pixels(id: u64, pixels: Uint8Array, width: u32, height: u32): u8

// Render current frame
render_window(id: u64): u8
```

### egui UI

```typescript
// Start UI frame
egui_begin(id: u64): u8

// UI elements (returns 1 if clicked/changed)
egui_label(id: u64, text: string): void
egui_button(id: u64, label: string): u8
egui_text_input(id: u64, buffer: string): string
egui_checkbox(id: u64, label: string, checked: boolean): boolean
egui_slider(id: u64, value: f64, min: f64, max: f64): f64

// End frame (must call before render_window)
egui_end(id: u64): u8
```

### Error Handling

```typescript
// Get last error message after failed operation
get_last_error(): string
```

All FFI functions return success codes:
- Window ID operations: `0` = success, `1` = failure
- `create_window`: Returns `u64` window ID, `0` on failure
- After failure, call `get_last_error()` for details

## Testing

```bash
# Run FFI test (creates actual windows, requires display)
deno run --allow-ffi --unstable-ffi tests/test.ts

# Run Rust unit tests
cargo test

# Run all tests
cargo test && deno run --allow-ffi --unstable-ffi tests/test.ts
```

## Dependencies

**Rust (from workspace root `/Cargo.toml`):**
- winit 0.30 - Cross-platform windowing
- wgpu 22 - GPU rendering backend
- egui 0.29 - Immediate-mode UI toolkit
- egui-wgpu 0.29 - egui wgpu integration
- egui-winit 0.29 - egui winit integration
- deno_bindgen 0.8.1 - FFI code generation
- serde 1, serde_json 1 - Serialization
- parking_lot 0.12 - Efficient synchronization
- lazy_static 1.5.0 - Thread-safe statics

**Deno:**
- `@std/assert` from JSR (for testing)

## Integration with BrowserX

Pixpane is designed to receive rendered output from the BrowserX browser engine:

1. **Browser Engine** performs layout and generates pixel buffers (RGBA8)
2. **Compositor** sends pixels via FFI to Pixpane
3. **Pixpane** uploads pixels to GPU and renders to window
4. **Events** flow back from Pixpane to browser for interactivity

See the main [BrowserX README](../../README.md) for architecture overview.

## Documentation

- **[BINDINGS.md](./BINDINGS.md)** - Detailed FFI binding documentation (if available)
- **[Rust API Docs](https://docs.rs/winit/)** - winit documentation
- **[wgpu Documentation](https://docs.rs/wgpu/)** - wgpu API reference
- **[egui Documentation](https://docs.rs/egui/)** - egui guide

## Contributing

When adding new FFI functions:

1. Add `#[deno_bindgen]` attribute to function in `src/deno_bindings.rs`
2. Rebuild: `cargo build --release`
3. Regenerate bindings: `deno run --allow-all gen_bindings.ts`
4. Update TypeScript wrapper in `pixpane.ts` (if applicable)
5. Add tests in `tests/test.ts`

## License

Part of the BrowserX project. See [LICENSE](../../LICENSE) for details.
