/**
 * Compute Dispatch Tests
 *
 * Verifies actual GPU compute: input data → compute shader → output data.
 * Tests doubling, adding, squaring, copies, workgroup sizes, and chaining.
 */

import { assertEquals } from "@std/assert";
import {
  ADD_CONSTANT_COMPUTE_SHADER,
  computeAndReadback,
  COPY_COMPUTE_SHADER,
  createBufferWithData,
  DOUBLE_COMPUTE_SHADER,
  getSharedDevice,
  readbackBuffer,
  SQUARE_F32_COMPUTE_SHADER,
  webgpuAvailable,
} from "./_helpers.ts";

const opts = { ignore: !webgpuAvailable, sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// Basic Compute Operations
// ============================================================================

Deno.test("compute: double u32 values (4 elements)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const input = new Uint32Array([1, 2, 3, 4]);
  const result = await computeAndReadback(device, DOUBLE_COMPUTE_SHADER, input, 16, 1);
  const output = new Uint32Array(result.buffer, result.byteOffset, 4);
  assertEquals(output[0], 2);
  assertEquals(output[1], 4);
  assertEquals(output[2], 6);
  assertEquals(output[3], 8);
});

Deno.test("compute: double u32 values (64 elements, 1 workgroup)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const input = new Uint32Array(64);
  for (let i = 0; i < 64; i++) input[i] = i;
  const result = await computeAndReadback(device, DOUBLE_COMPUTE_SHADER, input, 256, 1);
  const output = new Uint32Array(result.buffer, result.byteOffset, 64);
  for (let i = 0; i < 64; i++) {
    assertEquals(output[i], i * 2, `Index ${i}`);
  }
});

Deno.test("compute: double u32 values (256 elements, 4 workgroups)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const input = new Uint32Array(256);
  for (let i = 0; i < 256; i++) input[i] = i + 1;
  const result = await computeAndReadback(device, DOUBLE_COMPUTE_SHADER, input, 1024, 4);
  const output = new Uint32Array(result.buffer, result.byteOffset, 256);
  for (let i = 0; i < 256; i++) {
    assertEquals(output[i], (i + 1) * 2, `Index ${i}`);
  }
});

Deno.test("compute: double u32 values (1024 elements, 16 workgroups)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const input = new Uint32Array(1024);
  for (let i = 0; i < 1024; i++) input[i] = i;
  const result = await computeAndReadback(device, DOUBLE_COMPUTE_SHADER, input, 4096, 16);
  const output = new Uint32Array(result.buffer, result.byteOffset, 1024);
  assertEquals(output[0], 0);
  assertEquals(output[100], 200);
  assertEquals(output[1023], 2046);
});

// ============================================================================
// Copy (Identity)
// ============================================================================

Deno.test("compute: copy (identity) u32 values", { ...opts }, async () => {
  const device = await getSharedDevice();
  const input = new Uint32Array([42, 100, 255, 0, 999]);
  const alignedSize = Math.ceil(input.byteLength / 4) * 4;
  const result = await computeAndReadback(device, COPY_COMPUTE_SHADER, input, alignedSize, 1);
  const output = new Uint32Array(result.buffer, result.byteOffset, 5);
  assertEquals(output[0], 42);
  assertEquals(output[1], 100);
  assertEquals(output[2], 255);
  assertEquals(output[3], 0);
  assertEquals(output[4], 999);
});

// ============================================================================
// Add Constant via Uniform
// ============================================================================

Deno.test("compute: add constant from uniform buffer", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const input = new Uint32Array([10, 20, 30, 40]);
  const constantBuffer = gpuDevice.createBuffer({
    label: "constant-uniform",
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  gpuDevice.queue.writeBuffer(constantBuffer, 0, new Uint32Array([5]));

  const result = await computeAndReadback(
    device,
    ADD_CONSTANT_COMPUTE_SHADER,
    input,
    16,
    1,
    [{ binding: 2, buffer: constantBuffer }],
  );
  const output = new Uint32Array(result.buffer, result.byteOffset, 4);
  assertEquals(output[0], 15);
  assertEquals(output[1], 25);
  assertEquals(output[2], 35);
  assertEquals(output[3], 45);
  constantBuffer.destroy();
});

// ============================================================================
// Float32 Compute
// ============================================================================

Deno.test("compute: square f32 values", { ...opts }, async () => {
  const device = await getSharedDevice();
  const input = new Float32Array([2.0, 3.0, 4.0, 5.0]);
  const result = await computeAndReadback(device, SQUARE_F32_COMPUTE_SHADER, input, 16, 1);
  const output = new Float32Array(result.buffer, result.byteOffset, 4);
  assertEquals(output[0], 4.0);
  assertEquals(output[1], 9.0);
  assertEquals(output[2], 16.0);
  assertEquals(output[3], 25.0);
});

Deno.test("compute: square f32 fractional values", { ...opts }, async () => {
  const device = await getSharedDevice();
  const input = new Float32Array([0.5, 1.5, 0.0, -2.0]);
  const result = await computeAndReadback(device, SQUARE_F32_COMPUTE_SHADER, input, 16, 1);
  const output = new Float32Array(result.buffer, result.byteOffset, 4);
  assertEquals(output[0], 0.25);
  assertEquals(output[1], 2.25);
  assertEquals(output[2], 0.0);
  assertEquals(output[3], 4.0);
});

// ============================================================================
// Single Element
// ============================================================================

Deno.test("compute: single element", { ...opts }, async () => {
  const device = await getSharedDevice();
  const input = new Uint32Array([7]);
  const result = await computeAndReadback(device, DOUBLE_COMPUTE_SHADER, input, 4, 1);
  const output = new Uint32Array(result.buffer, result.byteOffset, 1);
  assertEquals(output[0], 14);
});

// ============================================================================
// Zeros
// ============================================================================

Deno.test("compute: all zeros input", { ...opts }, async () => {
  const device = await getSharedDevice();
  const input = new Uint32Array(64);
  const result = await computeAndReadback(device, DOUBLE_COMPUTE_SHADER, input, 256, 1);
  const output = new Uint32Array(result.buffer, result.byteOffset, 64);
  for (let i = 0; i < 64; i++) {
    assertEquals(output[i], 0, `Index ${i}`);
  }
});

// ============================================================================
// Max Values
// ============================================================================

Deno.test("compute: large u32 values near max", { ...opts }, async () => {
  const device = await getSharedDevice();
  // Values that won't overflow when doubled
  const input = new Uint32Array([1000000000, 2000000000, 100, 0]);
  const result = await computeAndReadback(device, DOUBLE_COMPUTE_SHADER, input, 16, 1);
  const output = new Uint32Array(result.buffer, result.byteOffset, 4);
  assertEquals(output[0], 2000000000);
  assertEquals(output[1], 4000000000);
  assertEquals(output[2], 200);
  assertEquals(output[3], 0);
});

// ============================================================================
// Chained Dispatches
// ============================================================================

Deno.test("compute: chained dispatches (double twice = quadruple)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  const input = new Uint32Array([1, 2, 3, 4]);
  const inputBuf = createBufferWithData(device, input, GPUBufferUsage.STORAGE);
  const midBuf = gpuDevice.createBuffer({
    label: "mid",
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const outputBuf = gpuDevice.createBuffer({
    label: "output",
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const shaderModule = gpuDevice.createShaderModule({ code: DOUBLE_COMPUTE_SHADER });
  const bgl = gpuDevice.createBindGroupLayout({
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
    ],
  });
  const pipelineLayout = gpuDevice.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const pipeline = gpuDevice.createComputePipeline({
    layout: pipelineLayout,
    compute: { module: shaderModule, entryPoint: "main" },
  });

  const bg1 = gpuDevice.createBindGroup({
    layout: bgl,
    entries: [
      { binding: 0, resource: { buffer: inputBuf } },
      { binding: 1, resource: { buffer: midBuf } },
    ],
  });
  const bg2 = gpuDevice.createBindGroup({
    layout: bgl,
    entries: [
      { binding: 0, resource: { buffer: midBuf } },
      { binding: 1, resource: { buffer: outputBuf } },
    ],
  });

  const encoder = gpuDevice.createCommandEncoder();
  const pass1 = encoder.beginComputePass();
  pass1.setPipeline(pipeline);
  pass1.setBindGroup(0, bg1);
  pass1.dispatchWorkgroups(1);
  pass1.end();

  const pass2 = encoder.beginComputePass();
  pass2.setPipeline(pipeline);
  pass2.setBindGroup(0, bg2);
  pass2.dispatchWorkgroups(1);
  pass2.end();

  gpuDevice.queue.submit([encoder.finish()]);

  const result = await readbackBuffer(device, outputBuf, 16);
  const output = new Uint32Array(result.buffer, result.byteOffset, 4);
  assertEquals(output[0], 4); // 1 * 2 * 2
  assertEquals(output[1], 8); // 2 * 2 * 2
  assertEquals(output[2], 12); // 3 * 2 * 2
  assertEquals(output[3], 16); // 4 * 2 * 2

  inputBuf.destroy();
  midBuf.destroy();
  outputBuf.destroy();
});

// ============================================================================
// Problem Size = 100 (not power of 2)
// ============================================================================

Deno.test("compute: non-power-of-2 problem size (100 elements)", { ...opts }, async () => {
  const device = await getSharedDevice();
  const input = new Uint32Array(100);
  for (let i = 0; i < 100; i++) input[i] = i + 1;
  const result = await computeAndReadback(device, DOUBLE_COMPUTE_SHADER, input, 400, 2);
  const output = new Uint32Array(result.buffer, result.byteOffset, 100);
  assertEquals(output[0], 2);
  assertEquals(output[49], 100);
  assertEquals(output[99], 200);
});

// ============================================================================
// In-place Modification
// ============================================================================

Deno.test("compute: in-place modification shader", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  const inPlaceShader = /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> data: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let idx = gid.x;
    if (idx < arrayLength(&data)) {
        data[idx] = data[idx] + 10u;
    }
}
`;

  const input = new Uint32Array([1, 2, 3, 4]);
  const buffer = gpuDevice.createBuffer({
    label: "inplace-buf",
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    mappedAtCreation: true,
  });
  new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(input.buffer));
  buffer.unmap();

  const shaderModule = gpuDevice.createShaderModule({ code: inPlaceShader });
  const bgl = gpuDevice.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type: "storage" as GPUBufferBindingType },
    }],
  });
  const pipelineLayout = gpuDevice.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const pipeline = gpuDevice.createComputePipeline({
    layout: pipelineLayout,
    compute: { module: shaderModule, entryPoint: "main" },
  });
  const bindGroup = gpuDevice.createBindGroup({
    layout: bgl,
    entries: [{ binding: 0, resource: { buffer } }],
  });

  const encoder = gpuDevice.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();
  gpuDevice.queue.submit([encoder.finish()]);

  const result = await readbackBuffer(device, buffer, 16);
  const output = new Uint32Array(result.buffer, result.byteOffset, 4);
  assertEquals(output[0], 11);
  assertEquals(output[1], 12);
  assertEquals(output[2], 13);
  assertEquals(output[3], 14);
  buffer.destroy();
});
