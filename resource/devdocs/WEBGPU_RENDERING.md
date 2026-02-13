# WebGPU Rendering Architecture

BrowserX supports GPU-accelerated rendering via WebGPU when running in Deno. This document describes the architecture and usage.

## Overview

The rendering pipeline has two modes:

1. **WebGPU Mode** - Actual GPU rendering with real pixel output (Deno with GPU)
2. **Headless Mode** - Fallback when no GPU available (returns white pixels)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RenderingPipeline                         │
│  (browser/src/engine/RenderingPipeline.ts)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │  OffscreenWebGPU │    │  CompositorThread (WebGL)    │   │
│  │  (WebGPU mode)   │    │  (Headless fallback)         │   │
│  └────────┬────────┘    └──────────────────────────────┘   │
│           │                                                  │
│  ┌────────▼────────────────────────────────────────────┐   │
│  │         WebGPUCompositorThread                       │   │
│  │  - Layer compositing                                 │   │
│  │  - WGSL shaders                                      │   │
│  │  - Texture management                                │   │
│  └────────┬────────────────────────────────────────────┘   │
│           │                                                  │
│  ┌────────▼────────────────────────────────────────────┐   │
│  │         WebGPUCompositorLayer                        │   │
│  │  - Individual layer rendering                        │   │
│  │  - Transforms & opacity                              │   │
│  │  - Tiling support                                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      webgpu_x Crate                          │
│  (crates/webgpu_x/)                                          │
├─────────────────────────────────────────────────────────────┤
│  - gpu/readback.rs    : Texture→CPU readback                │
│  - gpu/bind_group.rs  : Samplers, buffers, bind groups      │
│  - command/encoder.rs : Command encoding, render passes     │
│  - TypeScript bindings via deno_bindgen                     │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### OffscreenWebGPU

Located: `browser/src/engine/webgpu/offscreen/OffscreenWebGPU.ts`

Provides offscreen WebGPU rendering without a display canvas:

```typescript
const offscreen = new OffscreenWebGPU();
await offscreen.initialize(width, height);

// Access GPU resources
const device = offscreen.gpuDevice;
const texture = offscreen.texture;

// Read pixels back to CPU
const pixels = await offscreen.getPixels();

// Resize
offscreen.resize(newWidth, newHeight);

// Cleanup
offscreen.dispose();
```

### WebGPUCompositorThread

Located: `browser/src/engine/webgpu/compositor/WebGPUCompositorThread.ts`

Orchestrates multi-layer compositing:

- Manages compositor layers
- Handles frame scheduling
- Provides damage tracking

### WebGPUCompositorLayer

Located: `browser/src/engine/webgpu/compositor/WebGPUCompositorLayer.ts`

Individual layer rendering:

- Uploads display lists to GPU textures
- Creates bind groups for texture/sampler/uniforms
- Supports transforms (translate, rotate, scale)
- Supports opacity blending
- Handles tiling for large layers (256x256 tiles)

### WGSL Shaders

Located: `browser/src/engine/webgpu/shaders/`

Compositor shaders for layer blending:

```wgsl
// Vertex shader
@vertex
fn vs_main(@location(0) position: vec2<f32>, @location(1) texcoord: vec2<f32>) -> VertexOutput {
    var output: VertexOutput;
    output.position = uniforms.transform * vec4<f32>(position, 0.0, 1.0);
    output.texcoord = texcoord;
    return output;
}

// Fragment shader
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let color = textureSample(layer_texture, layer_sampler, input.texcoord);
    return color * uniforms.opacity;
}
```

## webgpu_x Crate FFI

The Rust crate provides FFI bindings for GPU operations not exposed by Deno's WebGPU:

### GPU Readback

```typescript
import { WebGPUX } from "./crates/webgpu_x/webgpu_x.ts";

const gpux = new WebGPUX();

// Create readback buffer
const buffer = gpux.createReadbackBuffer(deviceHandle, size);

// Copy texture to buffer
gpux.copyTextureToBuffer(encoder, texture, buffer, width, height, 4);

// Read data
const data = gpux.mapAndReadBuffer(deviceHandle, buffer);

// Cleanup
gpux.destroyReadbackBuffer(buffer);
```

### Command Encoding

```typescript
// Create command encoder
const encoder = gpux.createCommandEncoder(deviceHandle);

// Begin render pass
const pass = gpux.beginRenderPass(encoder, JSON.stringify({
  view: textureViewHandle,
  load_op: "clear",
  store_op: "store",
  clear_value: [0.0, 0.0, 0.0, 1.0]
}));

// Set pipeline and draw
gpux.renderPassSetPipeline(pass, pipeline);
gpux.renderPassDraw(pass, 6, 1, 0, 0);
gpux.endRenderPass(pass);

// Submit
const cmdBuffer = gpux.finishCommandEncoder(encoder);
gpux.queueSubmit(deviceHandle, cmdBuffer);
```

## RenderingPipeline Integration

The `RenderingPipeline` automatically uses WebGPU when available:

```typescript
const pipeline = new RenderingPipeline({
  enableGpu: true,  // Enables WebGPU
  width: 1920,
  height: 1080,
});

await pipeline.initialize();

// Check if WebGPU is active
if (pipeline.isWebGPUActive()) {
  console.log("GPU rendering enabled");
}

// Render a page
const result = await pipeline.render(html, css);

// Get pixels
const pixels = await pipeline.getPixels();
```

## Testing

Integration tests are in `browser/tests/integration/webgpu_rendering.test.ts`:

```bash
deno test --allow-all browser/tests/integration/webgpu_rendering.test.ts
```

Tests cover:
- Initialization
- Pixel buffer size
- Resize
- Clear/render operations
- WebGPU availability detection

## Requirements

- Deno 2.0+ (WebGPU stable) or Deno with `--unstable-webgpu`
- GPU with Vulkan/Metal/DX12 support
- macOS: Metal supported
- Linux: Vulkan required (nvidia/amd drivers)
- Windows: DX12 or Vulkan

## Fallback Behavior

When WebGPU is unavailable:

1. `OffscreenWebGPU.initialize()` throws an error
2. `RenderingPipeline` falls back to `CompositorThread` (headless mode)
3. `getPixels()` returns white pixels (RGBA: 255, 255, 255, 255)

This enables BrowserX to run in CI/headless environments without GPU support.
