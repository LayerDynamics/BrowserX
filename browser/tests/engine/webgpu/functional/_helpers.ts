/**
 * Shared helpers for functional WebGPU tests.
 *
 * Provides readback utilities, pixel assertions, and common WGSL shaders
 * for verifying actual GPU data flow and rendering output.
 *
 * @module functional-test-helpers
 */

import { getSharedDevice, webgpuAvailable } from "../shared_device.ts";
import type { WebGPUDevice } from "../../../../src/engine/webgpu/adapter/Device.ts";

export { getSharedDevice, webgpuAvailable };

// ============================================================================
// Buffer Readback
// ============================================================================

/**
 * Read back GPU buffer contents to CPU.
 * Creates a staging buffer, copies, maps, and returns the data.
 */
export async function readbackBuffer(
  device: WebGPUDevice,
  srcBuffer: GPUBuffer,
  size: number,
): Promise<Uint8Array> {
  const gpuDevice = device.getDevice();

  const stagingBuffer = gpuDevice.createBuffer({
    label: "readback-staging",
    size,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const encoder = gpuDevice.createCommandEncoder({ label: "readback-encoder" });
  encoder.copyBufferToBuffer(srcBuffer, 0, stagingBuffer, 0, size);
  gpuDevice.queue.submit([encoder.finish()]);

  await stagingBuffer.mapAsync(GPUMapMode.READ);
  const data = new Uint8Array(stagingBuffer.getMappedRange().slice(0));
  stagingBuffer.unmap();
  stagingBuffer.destroy();

  return data;
}

/**
 * Read back texture pixels to CPU, stripping 256-byte row padding.
 * Returns tightly-packed RGBA pixel data (width * height * 4 bytes).
 */
export async function readbackTexture(
  device: WebGPUDevice,
  texture: GPUTexture,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const gpuDevice = device.getDevice();
  const bytesPerPixel = 4; // RGBA8
  const bytesPerRow = width * bytesPerPixel;
  const paddedBytesPerRow = Math.ceil(bytesPerRow / 256) * 256;
  const bufferSize = paddedBytesPerRow * height;

  const stagingBuffer = gpuDevice.createBuffer({
    label: "texture-readback-staging",
    size: bufferSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const encoder = gpuDevice.createCommandEncoder({ label: "texture-readback-encoder" });
  encoder.copyTextureToBuffer(
    { texture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
    { buffer: stagingBuffer, offset: 0, bytesPerRow: paddedBytesPerRow, rowsPerImage: height },
    { width, height, depthOrArrayLayers: 1 },
  );
  gpuDevice.queue.submit([encoder.finish()]);

  await stagingBuffer.mapAsync(GPUMapMode.READ);
  const rawData = new Uint8Array(stagingBuffer.getMappedRange());

  // Strip row padding
  const result = new Uint8Array(width * height * bytesPerPixel);
  for (let row = 0; row < height; row++) {
    const srcOffset = row * paddedBytesPerRow;
    const dstOffset = row * bytesPerRow;
    result.set(rawData.subarray(srcOffset, srcOffset + bytesPerRow), dstOffset);
  }

  stagingBuffer.unmap();
  stagingBuffer.destroy();

  return result;
}

// ============================================================================
// Pixel Assertions
// ============================================================================

/**
 * Assert that pixel data matches expected values within tolerance.
 * GPU precision can vary by ±1 per channel.
 */
export function assertPixelsEqual(
  actual: Uint8Array,
  expected: Uint8Array,
  tolerance = 1,
  message?: string,
): void {
  if (actual.length !== expected.length) {
    throw new Error(
      `${
        message ? message + ": " : ""
      }Pixel data length mismatch: got ${actual.length}, expected ${expected.length}`,
    );
  }
  for (let i = 0; i < actual.length; i++) {
    const diff = Math.abs(actual[i] - expected[i]);
    if (diff > tolerance) {
      const pixelIdx = Math.floor(i / 4);
      const channel = ["R", "G", "B", "A"][i % 4];
      throw new Error(
        `${message ? message + ": " : ""}Pixel ${pixelIdx} channel ${channel}: got ${
          actual[i]
        }, expected ${expected[i]} (diff ${diff} > tolerance ${tolerance})`,
      );
    }
  }
}

/**
 * Assert every pixel in the data matches a single RGBA color within tolerance.
 */
export function assertSolidColor(
  pixels: Uint8Array,
  r: number,
  g: number,
  b: number,
  a: number,
  tolerance = 1,
  message?: string,
): void {
  const pixelCount = pixels.length / 4;
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const pr = pixels[offset],
      pg = pixels[offset + 1],
      pb = pixels[offset + 2],
      pa = pixels[offset + 3];
    if (
      Math.abs(pr - r) > tolerance ||
      Math.abs(pg - g) > tolerance ||
      Math.abs(pb - b) > tolerance ||
      Math.abs(pa - a) > tolerance
    ) {
      throw new Error(
        `${
          message ? message + ": " : ""
        }Pixel ${i}: got rgba(${pr},${pg},${pb},${pa}), expected rgba(${r},${g},${b},${a})`,
      );
    }
  }
}

/**
 * Assert a specific pixel at (x, y) matches expected color.
 */
export function assertPixelAt(
  pixels: Uint8Array,
  width: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number,
  tolerance = 1,
): void {
  const offset = (y * width + x) * 4;
  const pr = pixels[offset],
    pg = pixels[offset + 1],
    pb = pixels[offset + 2],
    pa = pixels[offset + 3];
  if (
    Math.abs(pr - r) > tolerance ||
    Math.abs(pg - g) > tolerance ||
    Math.abs(pb - b) > tolerance ||
    Math.abs(pa - a) > tolerance
  ) {
    throw new Error(
      `Pixel (${x},${y}): got rgba(${pr},${pg},${pb},${pa}), expected rgba(${r},${g},${b},${a})`,
    );
  }
}

// ============================================================================
// GPU Resource Helpers
// ============================================================================

/**
 * Create a GPU buffer initialized with data.
 */
export function createBufferWithData(
  device: WebGPUDevice,
  data: ArrayBufferView,
  usage: GPUBufferUsageFlags,
  label?: string,
): GPUBuffer {
  const gpuDevice = device.getDevice();
  const buffer = gpuDevice.createBuffer({
    label: label || "data-buffer",
    size: data.byteLength,
    usage: usage | GPUBufferUsage.COPY_SRC,
    mappedAtCreation: true,
  });
  new Uint8Array(buffer.getMappedRange()).set(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
  );
  buffer.unmap();
  return buffer;
}

/**
 * Create a render target texture with COPY_SRC for readback.
 */
export function createRenderTarget(
  device: WebGPUDevice,
  width: number,
  height: number,
  format: GPUTextureFormat = "rgba8unorm",
  label?: string,
): GPUTexture {
  return device.getDevice().createTexture({
    label: label || "render-target",
    size: { width, height, depthOrArrayLayers: 1 },
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST |
      GPUTextureUsage.TEXTURE_BINDING,
    sampleCount: 1,
  });
}

// ============================================================================
// Common WGSL Shaders
// ============================================================================

/** Fullscreen triangle vertex shader — emits a triangle covering the whole viewport. */
export const FULLSCREEN_VERTEX_SHADER = /* wgsl */ `
@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
    // Fullscreen triangle: 3 vertices cover clip space [-1,1]
    let x = f32(i32(vi) / 2) * 4.0 - 1.0;
    let y = f32(i32(vi) % 2) * 4.0 - 1.0;
    return vec4f(x, y, 0.0, 1.0);
}
`;

/** Fragment shader that outputs solid red. */
export const SOLID_RED_FRAGMENT = /* wgsl */ `
@fragment
fn fs_main() -> @location(0) vec4f {
    return vec4f(1.0, 0.0, 0.0, 1.0);
}
`;

/** Fragment shader that outputs solid green. */
export const SOLID_GREEN_FRAGMENT = /* wgsl */ `
@fragment
fn fs_main() -> @location(0) vec4f {
    return vec4f(0.0, 1.0, 0.0, 1.0);
}
`;

/** Fragment shader that outputs solid blue. */
export const SOLID_BLUE_FRAGMENT = /* wgsl */ `
@fragment
fn fs_main() -> @location(0) vec4f {
    return vec4f(0.0, 0.0, 1.0, 1.0);
}
`;

/** Fragment shader that reads color from a uniform buffer. */
export const UNIFORM_COLOR_FRAGMENT = /* wgsl */ `
@group(0) @binding(0) var<uniform> color: vec4f;

@fragment
fn fs_main() -> @location(0) vec4f {
    return color;
}
`;

/** Simple compute shader that doubles each u32 in the buffer. */
export const DOUBLE_COMPUTE_SHADER = /* wgsl */ `
@group(0) @binding(0) var<storage, read> input: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let idx = gid.x;
    if (idx < arrayLength(&input)) {
        output[idx] = input[idx] * 2u;
    }
}
`;

/** Compute shader that adds a constant from a uniform. */
export const ADD_CONSTANT_COMPUTE_SHADER = /* wgsl */ `
@group(0) @binding(0) var<storage, read> input: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;
@group(0) @binding(2) var<uniform> constant: u32;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let idx = gid.x;
    if (idx < arrayLength(&input)) {
        output[idx] = input[idx] + constant;
    }
}
`;

/** Compute shader that copies input to output (identity). */
export const COPY_COMPUTE_SHADER = /* wgsl */ `
@group(0) @binding(0) var<storage, read> input: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let idx = gid.x;
    if (idx < arrayLength(&input)) {
        output[idx] = input[idx];
    }
}
`;

/** Compute shader that squares f32 values. */
export const SQUARE_F32_COMPUTE_SHADER = /* wgsl */ `
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let idx = gid.x;
    if (idx < arrayLength(&input)) {
        output[idx] = input[idx] * input[idx];
    }
}
`;

// ============================================================================
// Test Configuration Constants
// ============================================================================

/** Default test options for GPU tests */
export const GPU_TEST_OPTIONS: Deno.TestDefinition["fn"] extends (...args: infer _A) => infer _R
  ? never
  : {
    ignore: boolean;
    sanitizeOps: false;
    sanitizeResources: false;
  } = {
    ignore: !webgpuAvailable,
    sanitizeOps: false,
    sanitizeResources: false,
  };

/**
 * Helper to create a render pipeline from vertex + fragment WGSL source.
 */
export function createSimpleRenderPipeline(
  device: WebGPUDevice,
  vertexShader: string,
  fragmentShader: string,
  format: GPUTextureFormat = "rgba8unorm",
  pipelineLayout?: GPUPipelineLayout,
): GPURenderPipeline {
  const gpuDevice = device.getDevice();
  const vertexModule = gpuDevice.createShaderModule({ label: "test-vertex", code: vertexShader });
  const fragmentModule = gpuDevice.createShaderModule({
    label: "test-fragment",
    code: fragmentShader,
  });

  return gpuDevice.createRenderPipeline({
    label: "test-pipeline",
    layout: pipelineLayout || "auto",
    vertex: {
      module: vertexModule,
      entryPoint: "vs_main",
    },
    fragment: {
      module: fragmentModule,
      entryPoint: "fs_main",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
    },
  });
}

/**
 * Render a fullscreen pass with a given pipeline and optional bind group,
 * then read back the result.
 */
export async function renderAndReadback(
  device: WebGPUDevice,
  pipeline: GPURenderPipeline,
  width: number,
  height: number,
  bindGroup?: GPUBindGroup,
  clearColor?: GPUColorDict,
): Promise<Uint8Array> {
  const texture = createRenderTarget(device, width, height);
  const view = texture.createView();
  const gpuDevice = device.getDevice();

  const encoder = gpuDevice.createCommandEncoder({ label: "render-readback" });
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view,
      loadOp: "clear" as GPULoadOp,
      storeOp: "store" as GPUStoreOp,
      clearValue: clearColor || { r: 0, g: 0, b: 0, a: 0 },
    }],
  });
  pass.setPipeline(pipeline);
  if (bindGroup) {
    pass.setBindGroup(0, bindGroup);
  }
  pass.draw(3); // fullscreen triangle
  pass.end();
  gpuDevice.queue.submit([encoder.finish()]);

  const pixels = await readbackTexture(device, texture, width, height);
  texture.destroy();
  return pixels;
}

/**
 * Run a compute shader with input data and read back the output.
 */
export async function computeAndReadback(
  device: WebGPUDevice,
  shaderCode: string,
  inputData: ArrayBufferView,
  outputSize: number,
  workgroupCount: number,
  extraBindings?: Array<{ binding: number; buffer: GPUBuffer }>,
): Promise<Uint8Array> {
  const gpuDevice = device.getDevice();

  const inputBuffer = createBufferWithData(
    device,
    inputData,
    GPUBufferUsage.STORAGE,
    "compute-input",
  );
  const outputBuffer = gpuDevice.createBuffer({
    label: "compute-output",
    size: outputSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const shaderModule = gpuDevice.createShaderModule({ label: "compute-shader", code: shaderCode });

  const bindGroupLayout = gpuDevice.createBindGroupLayout({
    label: "compute-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" as GPUBufferBindingType },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" as GPUBufferBindingType },
      },
      ...(extraBindings || []).map((eb) => ({
        binding: eb.binding,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" as GPUBufferBindingType },
      })),
    ],
  });

  const pipelineLayout = gpuDevice.createPipelineLayout({
    label: "compute-pipeline-layout",
    bindGroupLayouts: [bindGroupLayout],
  });

  const pipeline = gpuDevice.createComputePipeline({
    label: "compute-pipeline",
    layout: pipelineLayout,
    compute: { module: shaderModule, entryPoint: "main" },
  });

  const bindGroupEntries: GPUBindGroupEntry[] = [
    { binding: 0, resource: { buffer: inputBuffer } },
    { binding: 1, resource: { buffer: outputBuffer } },
    ...(extraBindings || []).map((eb) => ({
      binding: eb.binding,
      resource: { buffer: eb.buffer },
    })),
  ];

  const bindGroup = gpuDevice.createBindGroup({
    label: "compute-bind-group",
    layout: bindGroupLayout,
    entries: bindGroupEntries,
  });

  const encoder = gpuDevice.createCommandEncoder({ label: "compute-encoder" });
  const pass = encoder.beginComputePass({ label: "compute-pass" });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(workgroupCount);
  pass.end();
  gpuDevice.queue.submit([encoder.finish()]);

  const result = await readbackBuffer(device, outputBuffer, outputSize);

  inputBuffer.destroy();
  outputBuffer.destroy();

  return result;
}
