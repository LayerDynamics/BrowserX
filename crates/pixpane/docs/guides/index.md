# Pixpane Guides

Comprehensive guides for understanding and working with Pixpane.

## Overview

This directory contains detailed technical guides covering the architecture, FFI bindings, and usage patterns for Pixpane.

## Architecture Guides

### Overview

- **Architecture.md** - Overall architecture and component interaction
- **DataFlow.md** - How data flows from Deno → Rust → GPU

### Core Components

- **WindowManagement.md** - Window lifecycle and winit integration
- **GPURendering.md** - wgpu rendering pipeline and texture management
- **EguiIntegration.md** - Immediate-mode UI with egui
- **ThreadSafety.md** - Thread-safe window registry with parking_lot

### FFI Layer

- **DenoBindgen.md** - How deno_bindgen generates FFI bindings
- **FFIPatterns.md** - Common FFI patterns and best practices
- **Serialization.md** - Data serialization across FFI boundary
- **ErrorHandling.md** - Error propagation from Rust to Deno

## Implementation Guides

### Getting Started

- **BuildingPixpane.md** - Compiling the Rust library
- **GeneratingBindings.md** - Using gen_bindings.ts (not deno_bindgen CLI)
- **FirstWindow.md** - Creating your first window

### Window Management

- **WindowConfiguration.md** - All WindowConfig options explained
- **WindowOperations.md** - Moving, resizing, minimizing, maximizing
- **EventHandling.md** - Polling and processing window events
- **MultipleWindows.md** - Managing multiple windows concurrently

### Rendering

- **PixelBufferRendering.md** - Uploading RGBA8 pixels to GPU
- **TextureManagement.md** - GPU texture creation and updates
- **RenderLoop.md** - Implementing efficient 60 FPS render loops
- **VSync.md** - VSync timing and frame synchronization

### egui UI

- **EguiBasics.md** - Getting started with egui
- **EguiWidgets.md** - All available UI widgets
- **EguiLayouts.md** - Organizing UI with panels and layouts
- **EguiStyling.md** - Customizing egui appearance
- **EguiEvents.md** - Handling egui interactions

### Integration

- **BrowserIntegration.md** - Connecting to BrowserX browser engine
- **CompositorIntegration.md** - Receiving pixels from compositor
- **EventForwarding.md** - Forwarding input events to browser

### Advanced Topics

- **PerformanceOptimization.md** - Profiling and optimization
- **MemoryManagement.md** - GPU memory and buffer management
- **CustomShaders.md** - Writing custom WGSL shaders
- **Debugging.md** - Debugging FFI issues and GPU errors

## deno_bindgen Workflow

### Understanding deno_bindgen 0.8.1

- **WhyCustomScript.md** - Why we use gen_bindings.ts instead of deno_bindgen CLI
- **BindingGeneration.md** - How bindings.json becomes bindings.ts
- **TypeScriptTypes.md** - Generated TypeScript type definitions
- **FFIHelpers.md** - Helper functions for encoding/decoding

### Adding New FFI Functions

1. **AddingRustFunction.md** - Marking functions with #[deno_bindgen]
2. **RebuildingBindings.md** - cargo build + gen_bindings.ts workflow
3. **TestingFFI.md** - Testing new FFI functions
4. **DocumentingAPI.md** - Documenting new API surface

## Platform-Specific Guides

### macOS

- **macOSSetup.md** - macOS-specific setup and permissions
- **macOSQuirks.md** - Platform-specific behaviors

### Linux

- **LinuxSetup.md** - Linux dependencies and display servers
- **WaylandX11.md** - Wayland vs X11 considerations

### Windows

- **WindowsSetup.md** - Windows-specific setup
- **WindowsQuirks.md** - Platform-specific behaviors

## Dependencies

### Rust Crates

- **WinitGuide.md** - Cross-platform windowing with winit 0.30
- **WgpuGuide.md** - GPU API with wgpu 22
- **EguiGuide.md** - Immediate-mode UI with egui 0.29
- **DenoBindgenGuide.md** - FFI code generation with deno_bindgen 0.8.1

## How to Use These Guides

1. **New to Pixpane?** Start with `Architecture.md` and `FirstWindow.md`
2. **Adding FFI functions?** Read the deno_bindgen workflow guides
3. **Performance issues?** Check `PerformanceOptimization.md`
4. **Integrating with browser?** See `BrowserIntegration.md`

## Status

🚧 **In Progress** - Guides are being written to document the FFI layer and GPU rendering.

## Contributing

Found an error or want to improve a guide? See [CONTRIBUTING.md](../../../../CONTRIBUTING.md) for guidelines.
