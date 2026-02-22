/**
 * Compositor Integration Tests
 *
 * Verifies CompositingPipeline creation, uniform buffer handling,
 * bind group creation, layer compositing, opacity, and z-ordering.
 */

import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import {
  assertSolidColor,
  createRenderTarget,
  getSharedDevice,
  readbackTexture,
  webgpuAvailable,
} from "./_helpers.ts";
import {
  BlendMode,
  CompositingPipeline,
} from "../../../../src/engine/webgpu/pipelines/CompositingPipeline.ts";
import {
  createCompositorUniformBuffer,
  createIdentityTransform,
  writeCompositorUniforms,
} from "../../../../src/engine/webgpu/shaders/mod.ts";
import {
  LayerState,
  LayerType,
  WebGPUCompositorLayer,
} from "../../../../src/engine/webgpu/compositor/WebGPUCompositorLayer.ts";
import { WebGPUTextureManager } from "../../../../src/engine/webgpu/operations/render/TextureManager.ts";
import type { LayerID } from "../../../../src/types/webgpu.ts";

const opts = { ignore: !webgpuAvailable, sanitizeOps: false, sanitizeResources: false };

/** Helper to create a fully-specified LayerConfig */
function makeLayerConfig(overrides: Partial<{
  id: string;
  type: LayerType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  opacity: number;
  visible: boolean;
  clipToBounds: boolean;
}> = {}) {
  return {
    id: (overrides.id || crypto.randomUUID()) as LayerID,
    type: overrides.type ?? LayerType.CONTENT,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 64,
    height: overrides.height ?? 64,
    zIndex: overrides.zIndex ?? 0,
    opacity: overrides.opacity ?? 1.0,
    blendMode: BlendMode.NORMAL,
    visible: overrides.visible ?? true,
    clipToBounds: overrides.clipToBounds ?? false,
  };
}

// ============================================================================
// CompositingPipeline Creation
// ============================================================================

Deno.test("compositor: create CompositingPipeline with normal blend", { ...opts }, async () => {
  const device = await getSharedDevice();
  const pipeline = new CompositingPipeline(device, { blendMode: BlendMode.NORMAL });
  assertExists(pipeline);
});

Deno.test("compositor: different blend modes produce distinct pipelines", { ...opts }, async () => {
  const device = await getSharedDevice();
  const normal = new CompositingPipeline(device, { blendMode: BlendMode.NORMAL });
  const multiply = new CompositingPipeline(device, { blendMode: BlendMode.MULTIPLY });
  const screen = new CompositingPipeline(device, { blendMode: BlendMode.SCREEN });

  assertExists(normal);
  assertExists(multiply);
  assertExists(screen);
  assertNotEquals(normal, multiply);
  assertNotEquals(multiply, screen);
});

Deno.test("compositor: all blend modes can be instantiated", { ...opts }, async () => {
  const device = await getSharedDevice();
  const modes = [
    BlendMode.NORMAL,
    BlendMode.MULTIPLY,
    BlendMode.SCREEN,
    BlendMode.OVERLAY,
    BlendMode.DARKEN,
    BlendMode.LIGHTEN,
    BlendMode.ADD,
  ];
  for (const mode of modes) {
    const pipeline = new CompositingPipeline(device, { blendMode: mode });
    assertExists(pipeline, `BlendMode ${mode} should create pipeline`);
  }
});

// ============================================================================
// Uniform Buffer
// ============================================================================

Deno.test("compositor: uniform buffer create and write", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const uniformBuffer = createCompositorUniformBuffer(gpuDevice);

  writeCompositorUniforms(gpuDevice, uniformBuffer, createIdentityTransform(), 1.0);

  assertExists(uniformBuffer);
  uniformBuffer.destroy();
});

Deno.test("compositor: uniform buffer opacity values", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  const opacities = [0.0, 0.25, 0.5, 0.75, 1.0];
  for (const opacity of opacities) {
    const uniformBuffer = createCompositorUniformBuffer(gpuDevice);
    writeCompositorUniforms(gpuDevice, uniformBuffer, createIdentityTransform(), opacity);
    uniformBuffer.destroy();
  }
});

Deno.test("compositor: uniform buffer layout (80-byte minimum)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const uniformBuffer = createCompositorUniformBuffer(gpuDevice);
  assertEquals(uniformBuffer.size >= 80, true);
  uniformBuffer.destroy();
});

// ============================================================================
// Layer Management
// ============================================================================

Deno.test("compositor: create layer with full config", { ...opts }, async () => {
  const device = await getSharedDevice();
  const texManager = new WebGPUTextureManager(device);
  const config = makeLayerConfig();
  const layer = new WebGPUCompositorLayer(device, texManager, config);

  assertEquals(layer.getState(), LayerState.READY);
  assertExists(layer.getId());

  layer.destroy();
  texManager.destroy();
});

Deno.test("compositor: layer type assignment", { ...opts }, async () => {
  const device = await getSharedDevice();
  const texManager = new WebGPUTextureManager(device);

  const contentLayer = new WebGPUCompositorLayer(
    device,
    texManager,
    makeLayerConfig({ type: LayerType.CONTENT }),
  );
  const overlayLayer = new WebGPUCompositorLayer(
    device,
    texManager,
    makeLayerConfig({ type: LayerType.OVERLAY }),
  );

  assertEquals(contentLayer.getType(), LayerType.CONTENT);
  assertEquals(overlayLayer.getType(), LayerType.OVERLAY);

  contentLayer.destroy();
  overlayLayer.destroy();
  texManager.destroy();
});

Deno.test("compositor: layer destroy sets state", { ...opts }, async () => {
  const device = await getSharedDevice();
  const texManager = new WebGPUTextureManager(device);
  const layer = new WebGPUCompositorLayer(device, texManager, makeLayerConfig());

  layer.destroy();
  assertEquals(layer.getState(), LayerState.DESTROYED);

  texManager.destroy();
});

Deno.test("compositor: multiple layers have unique IDs", { ...opts }, async () => {
  const device = await getSharedDevice();
  const texManager = new WebGPUTextureManager(device);
  const layers: WebGPUCompositorLayer[] = [];

  for (let i = 0; i < 5; i++) {
    layers.push(new WebGPUCompositorLayer(device, texManager, makeLayerConfig()));
  }

  const ids = new Set(layers.map((l) => l.getId()));
  assertEquals(ids.size, 5, "All layer IDs should be unique");

  for (const layer of layers) layer.destroy();
  texManager.destroy();
});

// ============================================================================
// Layer Dimensions
// ============================================================================

Deno.test("compositor: layer dimensions match config", { ...opts }, async () => {
  const device = await getSharedDevice();
  const texManager = new WebGPUTextureManager(device);
  const layer = new WebGPUCompositorLayer(
    device,
    texManager,
    makeLayerConfig({ width: 128, height: 96 }),
  );

  assertEquals(layer.getConfig().width, 128);
  assertEquals(layer.getConfig().height, 96);

  layer.destroy();
  texManager.destroy();
});

// ============================================================================
// Layer Opacity
// ============================================================================

Deno.test("compositor: layer opacity default is 1.0", { ...opts }, async () => {
  const device = await getSharedDevice();
  const texManager = new WebGPUTextureManager(device);
  const layer = new WebGPUCompositorLayer(device, texManager, makeLayerConfig());

  assertEquals(layer.getOpacity(), 1.0);
  layer.destroy();
  texManager.destroy();
});

Deno.test("compositor: layer opacity can be set", { ...opts }, async () => {
  const device = await getSharedDevice();
  const texManager = new WebGPUTextureManager(device);
  const layer = new WebGPUCompositorLayer(device, texManager, makeLayerConfig());

  layer.setOpacity(0.5);
  assertEquals(layer.getOpacity(), 0.5);
  layer.setOpacity(0.0);
  assertEquals(layer.getOpacity(), 0.0);
  layer.setOpacity(1.0);
  assertEquals(layer.getOpacity(), 1.0);

  layer.destroy();
  texManager.destroy();
});

// ============================================================================
// Layer Visibility
// ============================================================================

Deno.test("compositor: layer visibility toggle", { ...opts }, async () => {
  const device = await getSharedDevice();
  const texManager = new WebGPUTextureManager(device);
  const layer = new WebGPUCompositorLayer(device, texManager, makeLayerConfig());

  assertEquals(layer.isVisible(), true);
  layer.setVisible(false);
  assertEquals(layer.isVisible(), false);
  layer.setVisible(true);
  assertEquals(layer.isVisible(), true);

  layer.destroy();
  texManager.destroy();
});

// ============================================================================
// Layer Z-Order
// ============================================================================

Deno.test("compositor: layer z-index", { ...opts }, async () => {
  const device = await getSharedDevice();
  const texManager = new WebGPUTextureManager(device);
  const layer = new WebGPUCompositorLayer(device, texManager, makeLayerConfig({ zIndex: 5 }));

  assertEquals(layer.getZIndex(), 5);
  layer.setZIndex(10);
  assertEquals(layer.getZIndex(), 10);

  layer.destroy();
  texManager.destroy();
});

// ============================================================================
// Clear Render Target
// ============================================================================

Deno.test("compositor: clear render target to color", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 8, h = 8;
  const texture = createRenderTarget(device, w, h);

  const encoder = gpuDevice.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
    }],
  });
  pass.end();
  gpuDevice.queue.submit([encoder.finish()]);

  const pixels = await readbackTexture(device, texture, w, h);
  assertSolidColor(pixels, 128, 128, 128, 255, 1);
  texture.destroy();
});

// ============================================================================
// Compositing Pipeline Config
// ============================================================================

Deno.test("compositor: pipeline config defaults", { ...opts }, async () => {
  const device = await getSharedDevice();
  const pipeline = new CompositingPipeline(device, {});
  assertExists(pipeline);
});

Deno.test("compositor: pipeline with custom format", { ...opts }, async () => {
  const device = await getSharedDevice();
  const pipeline = new CompositingPipeline(device, {
    blendMode: BlendMode.NORMAL,
    format: "bgra8unorm",
  });
  assertExists(pipeline);
});
