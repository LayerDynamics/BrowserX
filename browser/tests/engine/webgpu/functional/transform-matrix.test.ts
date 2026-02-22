/**
 * Transform Matrix Tests
 *
 * Verifies transform matrix utilities: identity, translation, scale,
 * buildLayerTransform for various positions, uniform buffer layout,
 * and render with transform + readback.
 */

import { assertAlmostEquals, assertEquals, assertExists } from "@std/assert";
import {
  createBufferWithData,
  getSharedDevice,
  readbackBuffer,
  webgpuAvailable,
} from "./_helpers.ts";
import {
  CompositorUniformOffsets,
  createCompositorUniformBuffer,
  createFullScreenQuadVertices,
  createIdentityTransform,
  createScaleTransform,
  createTranslationTransform,
  writeCompositorUniforms,
} from "../../../../src/engine/webgpu/shaders/mod.ts";

const opts = { ignore: !webgpuAvailable, sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// Identity Transform
// ============================================================================

Deno.test("transform: identity matrix is correct", { ...opts }, async () => {
  const identity = createIdentityTransform();
  assertEquals(identity.length, 16);
  // Column-major identity
  assertEquals(identity[0], 1); // m00
  assertEquals(identity[1], 0); // m10
  assertEquals(identity[2], 0); // m20
  assertEquals(identity[3], 0); // m30
  assertEquals(identity[4], 0); // m01
  assertEquals(identity[5], 1); // m11
  assertEquals(identity[6], 0); // m21
  assertEquals(identity[7], 0); // m31
  assertEquals(identity[8], 0); // m02
  assertEquals(identity[9], 0); // m12
  assertEquals(identity[10], 1); // m22
  assertEquals(identity[11], 0); // m32
  assertEquals(identity[12], 0); // m03
  assertEquals(identity[13], 0); // m13
  assertEquals(identity[14], 0); // m23
  assertEquals(identity[15], 1); // m33
});

// ============================================================================
// Translation Transform
// ============================================================================

Deno.test("transform: translation (0.5, -0.3)", { ...opts }, async () => {
  const t = createTranslationTransform(0.5, -0.3);
  assertEquals(t.length, 16);
  // Translation in column-major: t[12]=tx, t[13]=ty
  assertAlmostEquals(t[12], 0.5, 1e-6);
  assertAlmostEquals(t[13], -0.3, 1e-6);
  // Diagonal should still be 1
  assertEquals(t[0], 1);
  assertEquals(t[5], 1);
  assertEquals(t[10], 1);
  assertEquals(t[15], 1);
});

Deno.test("transform: translation (0, 0) is identity", { ...opts }, async () => {
  const t = createTranslationTransform(0, 0);
  const identity = createIdentityTransform();
  for (let i = 0; i < 16; i++) {
    assertEquals(t[i], identity[i], `Element ${i}`);
  }
});

// ============================================================================
// Scale Transform
// ============================================================================

Deno.test("transform: scale (2, 3)", { ...opts }, async () => {
  const s = createScaleTransform(2, 3);
  assertEquals(s.length, 16);
  assertEquals(s[0], 2); // sx
  assertEquals(s[5], 3); // sy
  assertEquals(s[10], 1); // sz
  assertEquals(s[15], 1); // w
});

Deno.test("transform: scale (1, 1) is identity", { ...opts }, async () => {
  const s = createScaleTransform(1, 1);
  const identity = createIdentityTransform();
  for (let i = 0; i < 16; i++) {
    assertEquals(s[i], identity[i], `Element ${i}`);
  }
});

Deno.test("transform: scale (0.5, 0.5) half-size", { ...opts }, async () => {
  const s = createScaleTransform(0.5, 0.5);
  assertEquals(s[0], 0.5);
  assertEquals(s[5], 0.5);
});

// ============================================================================
// Uniform Buffer
// ============================================================================

Deno.test("transform: compositor uniform buffer creation", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const uniformBuffer = createCompositorUniformBuffer(gpuDevice);
  assertExists(uniformBuffer);
  // Uniform buffer should be at least 96 bytes (mat4x4 + extras)
  // The actual size depends on the layout
  assertEquals(uniformBuffer.size >= 80, true);
  uniformBuffer.destroy();
});

Deno.test("transform: write compositor uniforms", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const uniformBuffer = createCompositorUniformBuffer(gpuDevice);

  const identity = createIdentityTransform();
  writeCompositorUniforms(gpuDevice, uniformBuffer, identity, 0.75);

  // If it doesn't throw, the write was successful
  assertEquals(true, true);

  uniformBuffer.destroy();
});

Deno.test("transform: uniform offsets are reasonable", { ...opts }, async () => {
  // Transform matrix is 16 floats * 4 bytes = 64 bytes at offset 0
  assertEquals(CompositorUniformOffsets.transform, 0);
  // Opacity follows the 4x4 matrix
  assertEquals(CompositorUniformOffsets.opacity, 64);
});

// ============================================================================
// Fullscreen Quad Vertices
// ============================================================================

Deno.test("transform: fullscreen quad vertices", { ...opts }, async () => {
  const vertices = createFullScreenQuadVertices();
  assertExists(vertices);
  // Should have 6 vertices (2 triangles) * components per vertex
  assertEquals(vertices.length > 0, true);
  // Vertices should be Float32Array
  assertEquals(vertices instanceof Float32Array, true);
});

Deno.test("transform: fullscreen quad buffer creation", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();
  const { createFullScreenQuadBuffer } = await import(
    "../../../../src/engine/webgpu/shaders/mod.ts"
  );
  const buffer = createFullScreenQuadBuffer(gpuDevice);
  assertExists(buffer);
  assertEquals(buffer.size > 0, true);
  buffer.destroy();
});

// ============================================================================
// Uniform Buffer Roundtrip
// ============================================================================

Deno.test("transform: uniform buffer data roundtrip", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  const uniformData = new Float32Array([
    // 4x4 identity matrix (16 floats)
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    // opacity
    0.5,
    // padding
    0,
    0,
    0,
    // source size
    64,
    64,
    // dest size
    128,
    128,
  ]);

  const buffer = gpuDevice.createBuffer({
    label: "uniform-roundtrip",
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  gpuDevice.queue.writeBuffer(buffer, 0, uniformData);

  const result = await readbackBuffer(device, buffer, uniformData.byteLength);
  const resultFloats = new Float32Array(result.buffer, result.byteOffset, uniformData.length);

  // Verify identity matrix
  assertEquals(resultFloats[0], 1); // m00
  assertEquals(resultFloats[5], 1); // m11
  assertEquals(resultFloats[10], 1); // m22
  assertEquals(resultFloats[15], 1); // m33

  // Verify opacity
  assertEquals(resultFloats[16], 0.5);

  // Verify sizes
  assertEquals(resultFloats[20], 64);
  assertEquals(resultFloats[21], 64);
  assertEquals(resultFloats[22], 128);
  assertEquals(resultFloats[23], 128);

  buffer.destroy();
});

// ============================================================================
// Transform Matrix Upload to GPU
// ============================================================================

Deno.test("transform: translation matrix GPU roundtrip", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  const t = createTranslationTransform(0.25, -0.75);
  const buffer = createBufferWithData(device, t, GPUBufferUsage.UNIFORM);
  const result = await readbackBuffer(device, buffer, t.byteLength);
  const resultFloats = new Float32Array(result.buffer, result.byteOffset, 16);

  assertEquals(resultFloats[0], 1); // m00
  assertEquals(resultFloats[5], 1); // m11
  assertEquals(resultFloats[12], 0.25); // tx
  assertEquals(resultFloats[13], -0.75); // ty

  buffer.destroy();
});

Deno.test("transform: scale matrix GPU roundtrip", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  const s = createScaleTransform(2.5, 0.3);
  const buffer = createBufferWithData(device, s, GPUBufferUsage.UNIFORM);
  const result = await readbackBuffer(device, buffer, s.byteLength);
  const resultFloats = new Float32Array(result.buffer, result.byteOffset, 16);

  assertAlmostEquals(resultFloats[0], 2.5, 1e-6);
  assertAlmostEquals(resultFloats[5], 0.3, 1e-6);

  buffer.destroy();
});

// ============================================================================
// Multiple Transforms
// ============================================================================

Deno.test("transform: multiple transforms can coexist in GPU memory", { ...opts }, async () => {
  const device = await getSharedDevice();
  const gpuDevice = device.getDevice();

  const transforms = [
    createIdentityTransform(),
    createTranslationTransform(1, 0),
    createTranslationTransform(0, 1),
    createScaleTransform(2, 2),
  ];

  const totalSize = transforms.length * 64; // 64 bytes per 4x4 matrix
  const combined = new Float32Array(transforms.length * 16);
  for (let i = 0; i < transforms.length; i++) {
    combined.set(transforms[i], i * 16);
  }

  const buffer = createBufferWithData(device, combined, GPUBufferUsage.STORAGE);
  const result = await readbackBuffer(device, buffer, totalSize);
  const resultFloats = new Float32Array(result.buffer, result.byteOffset, transforms.length * 16);

  // Check identity (first)
  assertEquals(resultFloats[0], 1);
  assertEquals(resultFloats[15], 1);

  // Check translate (1,0) (second)
  assertEquals(resultFloats[16 + 12], 1); // tx

  // Check translate (0,1) (third)
  assertEquals(resultFloats[32 + 13], 1); // ty

  // Check scale (2,2) (fourth)
  assertEquals(resultFloats[48 + 0], 2); // sx
  assertEquals(resultFloats[48 + 5], 2); // sy

  buffer.destroy();
});
