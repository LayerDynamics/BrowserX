/**
 * Render Pass Execution Tests
 *
 * Verifies actual GPU rendering: clear colors, draw fullscreen quads
 * with shaders, read back pixels, and confirm output matches expectations.
 */

import { assertEquals, assertNotEquals } from "@std/assert";
import {
  assertPixelAt,
  assertSolidColor,
  createBufferWithData,
  createRenderTarget,
  createSimpleRenderPipeline,
  FULLSCREEN_VERTEX_SHADER,
  getSharedDevice,
  readbackTexture,
  renderAndReadback,
  SOLID_BLUE_FRAGMENT,
  SOLID_GREEN_FRAGMENT,
  SOLID_RED_FRAGMENT,
  UNIFORM_COLOR_FRAGMENT,
  webgpuAvailable,
} from "./_helpers.ts";

const opts = { ignore: !webgpuAvailable, sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// Clear Color Verification
// ============================================================================

Deno.test("render pass: clear to red", { ...opts }, async () => {
  const device = await getSharedDevice();
  const w = 4, h = 4;
  const texture = createRenderTarget(device, w, h);
  const gpuDevice = device.getDevice();
  const encoder = gpuDevice.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 1, g: 0, b: 0, a: 1 },
    }],
  });
  pass.end();
  gpuDevice.queue.submit([encoder.finish()]);
  const pixels = await readbackTexture(device, texture, w, h);
  assertSolidColor(pixels, 255, 0, 0, 255);
  texture.destroy();
});

Deno.test("render pass: clear to green", { ...opts }, async () => {
  const device = await getSharedDevice();
  const w = 4, h = 4;
  const texture = createRenderTarget(device, w, h);
  const gpuDevice = device.getDevice();
  const encoder = gpuDevice.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0, g: 1, b: 0, a: 1 },
    }],
  });
  pass.end();
  gpuDevice.queue.submit([encoder.finish()]);
  const pixels = await readbackTexture(device, texture, w, h);
  assertSolidColor(pixels, 0, 255, 0, 255);
  texture.destroy();
});

Deno.test("render pass: clear to blue", { ...opts }, async () => {
  const device = await getSharedDevice();
  const w = 4, h = 4;
  const texture = createRenderTarget(device, w, h);
  const gpuDevice = device.getDevice();
  const encoder = gpuDevice.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0, g: 0, b: 1, a: 1 },
    }],
  });
  pass.end();
  gpuDevice.queue.submit([encoder.finish()]);
  const pixels = await readbackTexture(device, texture, w, h);
  assertSolidColor(pixels, 0, 0, 255, 255);
  texture.destroy();
});

Deno.test("render pass: clear to white", { ...opts }, async () => {
  const device = await getSharedDevice();
  const w = 4, h = 4;
  const texture = createRenderTarget(device, w, h);
  const gpuDevice = device.getDevice();
  const encoder = gpuDevice.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 1, g: 1, b: 1, a: 1 },
    }],
  });
  pass.end();
  gpuDevice.queue.submit([encoder.finish()]);
  const pixels = await readbackTexture(device, texture, w, h);
  assertSolidColor(pixels, 255, 255, 255, 255);
  texture.destroy();
});

Deno.test("render pass: clear to black", { ...opts }, async () => {
  const device = await getSharedDevice();
  const w = 4, h = 4;
  const texture = createRenderTarget(device, w, h);
  const gpuDevice = device.getDevice();
  const encoder = gpuDevice.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
  });
  pass.end();
  gpuDevice.queue.submit([encoder.finish()]);
  const pixels = await readbackTexture(device, texture, w, h);
  assertSolidColor(pixels, 0, 0, 0, 255);
  texture.destroy();
});

Deno.test("render pass: clear to transparent", { ...opts }, async () => {
  const device = await getSharedDevice();
  const w = 4, h = 4;
  const texture = createRenderTarget(device, w, h);
  const gpuDevice = device.getDevice();
  const encoder = gpuDevice.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0, g: 0, b: 0, a: 0 },
    }],
  });
  pass.end();
  gpuDevice.queue.submit([encoder.finish()]);
  const pixels = await readbackTexture(device, texture, w, h);
  assertSolidColor(pixels, 0, 0, 0, 0);
  texture.destroy();
});

Deno.test("render pass: clear to custom color (128, 64, 192, 255)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const w = 4, h = 4;
  const texture = createRenderTarget(device, w, h);
  const gpuDevice = device.getDevice();
  const encoder = gpuDevice.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 128 / 255, g: 64 / 255, b: 192 / 255, a: 1 },
    }],
  });
  pass.end();
  gpuDevice.queue.submit([encoder.finish()]);
  const pixels = await readbackTexture(device, texture, w, h);
  assertSolidColor(pixels, 128, 64, 192, 255);
  texture.destroy();
});

// ============================================================================
// Draw with Shaders
// ============================================================================

Deno.test("render pass: draw fullscreen red quad", { ...opts }, async () => {
  const device = await getSharedDevice();
  const pipeline = createSimpleRenderPipeline(device, FULLSCREEN_VERTEX_SHADER, SOLID_RED_FRAGMENT);
  const pixels = await renderAndReadback(device, pipeline, 8, 8);
  assertSolidColor(pixels, 255, 0, 0, 255);
});

Deno.test("render pass: draw fullscreen green quad", { ...opts }, async () => {
  const device = await getSharedDevice();
  const pipeline = createSimpleRenderPipeline(
    device,
    FULLSCREEN_VERTEX_SHADER,
    SOLID_GREEN_FRAGMENT,
  );
  const pixels = await renderAndReadback(device, pipeline, 8, 8);
  assertSolidColor(pixels, 0, 255, 0, 255);
});

Deno.test("render pass: draw fullscreen blue quad", { ...opts }, async () => {
  const device = await getSharedDevice();
  const pipeline = createSimpleRenderPipeline(
    device,
    FULLSCREEN_VERTEX_SHADER,
    SOLID_BLUE_FRAGMENT,
  );
  const pixels = await renderAndReadback(device, pipeline, 8, 8);
  assertSolidColor(pixels, 0, 0, 255, 255);
});

Deno.test("render pass: uniform-driven color", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  const uniformData = new Float32Array([1.0, 0.5, 0.0, 1.0]); // orange
  const uniformBuffer = gpuDevice.createBuffer({
    label: "color-uniform",
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  gpuDevice.queue.writeBuffer(uniformBuffer, 0, uniformData);

  const bindGroupLayout = gpuDevice.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform" as GPUBufferBindingType },
    }],
  });
  const pipelineLayout = gpuDevice.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
  const pipeline = createSimpleRenderPipeline(
    device,
    FULLSCREEN_VERTEX_SHADER,
    UNIFORM_COLOR_FRAGMENT,
    "rgba8unorm",
    pipelineLayout,
  );
  const bindGroup = gpuDevice.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  const pixels = await renderAndReadback(device, pipeline, 4, 4, bindGroup);
  // 1.0 * 255 = 255, 0.5 * 255 ≈ 128, 0.0 * 255 = 0
  assertSolidColor(pixels, 255, 128, 0, 255, 1);
  uniformBuffer.destroy();
});

// ============================================================================
// Multi-pass Rendering
// ============================================================================

Deno.test("render pass: clear then draw overlay", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 4, h = 4;
  const texture = createRenderTarget(device, w, h);
  const view = texture.createView();
  const pipeline = createSimpleRenderPipeline(device, FULLSCREEN_VERTEX_SHADER, SOLID_RED_FRAGMENT);

  const encoder = gpuDevice.createCommandEncoder();

  // First pass: clear to blue
  const pass1 = encoder.beginRenderPass({
    colorAttachments: [{
      view,
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0, g: 0, b: 1, a: 1 },
    }],
  });
  pass1.end();

  // Second pass: draw red over it (load existing)
  const pass2 = encoder.beginRenderPass({
    colorAttachments: [{
      view,
      loadOp: "load" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
    }],
  });
  pass2.setPipeline(pipeline);
  pass2.draw(3);
  pass2.end();

  gpuDevice.queue.submit([encoder.finish()]);
  const pixels = await readbackTexture(device, texture, w, h);
  // Red quad should fully cover the blue clear
  assertSolidColor(pixels, 255, 0, 0, 255);
  texture.destroy();
});

// ============================================================================
// Non-square Render Targets
// ============================================================================

Deno.test("render pass: non-square target 16x4", { ...opts }, async () => {
  const device = await getSharedDevice();
  const pipeline = createSimpleRenderPipeline(
    device,
    FULLSCREEN_VERTEX_SHADER,
    SOLID_GREEN_FRAGMENT,
  );
  const pixels = await renderAndReadback(device, pipeline, 16, 4);
  assertEquals(pixels.length, 16 * 4 * 4);
  assertSolidColor(pixels, 0, 255, 0, 255);
});

Deno.test("render pass: non-square target 4x16", { ...opts }, async () => {
  const device = await getSharedDevice();
  const pipeline = createSimpleRenderPipeline(
    device,
    FULLSCREEN_VERTEX_SHADER,
    SOLID_BLUE_FRAGMENT,
  );
  const pixels = await renderAndReadback(device, pipeline, 4, 16);
  assertEquals(pixels.length, 4 * 16 * 4);
  assertSolidColor(pixels, 0, 0, 255, 255);
});

// ============================================================================
// Depth Attachment
// ============================================================================

Deno.test("render pass: depth attachment clear", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 4, h = 4;
  const colorTexture = createRenderTarget(device, w, h);
  const depthTexture = gpuDevice.createTexture({
    label: "depth-target",
    size: { width: w, height: h },
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const encoder = gpuDevice.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: colorTexture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0, g: 1, b: 0, a: 1 },
    }],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthClearValue: 1.0,
      depthLoadOp: "clear" as GPULoadOp,
      depthStoreOp: "store" as GPUStoreOp,
    },
  });
  pass.end();
  gpuDevice.queue.submit([encoder.finish()]);

  const pixels = await readbackTexture(device, colorTexture, w, h);
  assertSolidColor(pixels, 0, 255, 0, 255);
  colorTexture.destroy();
  depthTexture.destroy();
});

// ============================================================================
// LoadOp behavior
// ============================================================================

Deno.test("render pass: loadOp 'load' preserves previous content", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 4, h = 4;
  const texture = createRenderTarget(device, w, h);
  const view = texture.createView();

  // First: clear to cyan
  const enc1 = gpuDevice.createCommandEncoder();
  const p1 = enc1.beginRenderPass({
    colorAttachments: [{
      view,
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0, g: 1, b: 1, a: 1 },
    }],
  });
  p1.end();
  gpuDevice.queue.submit([enc1.finish()]);

  // Second: load (no draw), should keep cyan
  const enc2 = gpuDevice.createCommandEncoder();
  const p2 = enc2.beginRenderPass({
    colorAttachments: [{
      view,
      loadOp: "load" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
    }],
  });
  p2.end();
  gpuDevice.queue.submit([enc2.finish()]);

  const pixels = await readbackTexture(device, texture, w, h);
  assertSolidColor(pixels, 0, 255, 255, 255);
  texture.destroy();
});

// ============================================================================
// Different Clear Values Produce Different Output
// ============================================================================

Deno.test("render pass: different clear values produce distinct output", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 2, h = 2;

  const colors = [
    { r: 1, g: 0, b: 0, a: 1 },
    { r: 0, g: 1, b: 0, a: 1 },
    { r: 0, g: 0, b: 1, a: 1 },
    { r: 1, g: 1, b: 0, a: 1 },
  ];

  const results: Uint8Array[] = [];
  for (const color of colors) {
    const texture = createRenderTarget(device, w, h);
    const encoder = gpuDevice.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: texture.createView(),
        loadOp: "clear" as GPULoadOp,
        storeOp: "store" as GPUStoreOp,
        clearValue: color,
      }],
    });
    pass.end();
    gpuDevice.queue.submit([encoder.finish()]);
    results.push(await readbackTexture(device, texture, w, h));
    texture.destroy();
  }

  // Each result should differ from every other
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      let same = true;
      for (let k = 0; k < results[i].length; k++) {
        if (results[i][k] !== results[j][k]) {
          same = false;
          break;
        }
      }
      assertNotEquals(same, true, `Colors ${i} and ${j} should differ`);
    }
  }
});

// ============================================================================
// Large Render Target
// ============================================================================

Deno.test("render pass: 128x128 render target", { ...opts }, async () => {
  const device = await getSharedDevice();
  const pipeline = createSimpleRenderPipeline(device, FULLSCREEN_VERTEX_SHADER, SOLID_RED_FRAGMENT);
  const pixels = await renderAndReadback(device, pipeline, 128, 128);
  assertEquals(pixels.length, 128 * 128 * 4);
  assertSolidColor(pixels, 255, 0, 0, 255);
});

// ============================================================================
// Sequential Pipeline Switches
// ============================================================================

Deno.test("render pass: switch pipelines between passes", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 4, h = 4;

  const redPipeline = createSimpleRenderPipeline(
    device,
    FULLSCREEN_VERTEX_SHADER,
    SOLID_RED_FRAGMENT,
  );
  const greenPipeline = createSimpleRenderPipeline(
    device,
    FULLSCREEN_VERTEX_SHADER,
    SOLID_GREEN_FRAGMENT,
  );

  // Draw red first
  const tex1 = createRenderTarget(device, w, h);
  const enc1 = gpuDevice.createCommandEncoder();
  const p1 = enc1.beginRenderPass({
    colorAttachments: [{
      view: tex1.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0, g: 0, b: 0, a: 0 },
    }],
  });
  p1.setPipeline(redPipeline);
  p1.draw(3);
  p1.end();
  gpuDevice.queue.submit([enc1.finish()]);
  const px1 = await readbackTexture(device, tex1, w, h);
  assertSolidColor(px1, 255, 0, 0, 255);

  // Draw green next
  const tex2 = createRenderTarget(device, w, h);
  const enc2 = gpuDevice.createCommandEncoder();
  const p2 = enc2.beginRenderPass({
    colorAttachments: [{
      view: tex2.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 0, g: 0, b: 0, a: 0 },
    }],
  });
  p2.setPipeline(greenPipeline);
  p2.draw(3);
  p2.end();
  gpuDevice.queue.submit([enc2.finish()]);
  const px2 = await readbackTexture(device, tex2, w, h);
  assertSolidColor(px2, 0, 255, 0, 255);

  tex1.destroy();
  tex2.destroy();
});

// ============================================================================
// Half-alpha Clear
// ============================================================================

Deno.test("render pass: clear with half alpha", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const w = 4, h = 4;
  const texture = createRenderTarget(device, w, h);
  const encoder = gpuDevice.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: { r: 1, g: 0, b: 0, a: 0.5 },
    }],
  });
  pass.end();
  gpuDevice.queue.submit([encoder.finish()]);
  const pixels = await readbackTexture(device, texture, w, h);
  assertSolidColor(pixels, 255, 0, 0, 128, 1);
  texture.destroy();
});
