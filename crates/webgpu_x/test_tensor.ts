#!/usr/bin/env -S deno run --allow-ffi --unstable-ffi --no-check

import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { WebGPUX, TensorDType, TensorAccess } from "./webgpu_x.ts";

const webgpuX = new WebGPUX();

console.log("\n=== Tensor Operations Tests ===\n");

// Test 1: Create tensor metadata
Deno.test("Create tensor metadata", () => {
  console.log("Test 1: Creating tensor metadata...");
  const tensor = webgpuX.tensorCreate(
    0n,  // buffer handle
    [2, 3, 4],  // dimensions
    TensorDType.Float32,
    TensorAccess.ReadWrite
  );

  assertExists(tensor);
  assertEquals(tensor.shape.dimensions, [2, 3, 4]);
  assertEquals(tensor.dtype, TensorDType.Float32);
  assertEquals(tensor.access, TensorAccess.ReadWrite);
  assertEquals(tensor.buffer_handle, 0n);
  assertEquals(tensor.offset, 0n);

  console.log(`✓ Tensor created: ${JSON.stringify(tensor.shape.dimensions)}`);
  console.log(`  DType: Float32, Access: ReadWrite`);
});

// Test 2: Calculate tensor size in bytes
Deno.test("Calculate tensor size in bytes", () => {
  console.log("\nTest 2: Calculating tensor size...");
  const tensor = webgpuX.tensorCreate(0n, [2, 3, 4], TensorDType.Float32, TensorAccess.ReadWrite);
  assertExists(tensor);

  const sizeBytes = webgpuX.tensorSizeBytes(tensor);
  assertEquals(sizeBytes, 96n);  // 2 * 3 * 4 = 24 elements * 4 bytes = 96 bytes

  console.log(`✓ Size: ${sizeBytes} bytes (24 elements × 4 bytes)`);
});

// Test 3: Get tensor rank
Deno.test("Get tensor rank", () => {
  console.log("\nTest 3: Getting tensor rank...");
  const tensor1d = webgpuX.tensorCreate(0n, [10], TensorDType.Float32, TensorAccess.ReadWrite);
  const tensor2d = webgpuX.tensorCreate(0n, [3, 4], TensorDType.Float32, TensorAccess.ReadWrite);
  const tensor3d = webgpuX.tensorCreate(0n, [2, 3, 4], TensorDType.Float32, TensorAccess.ReadWrite);

  assertExists(tensor1d);
  assertExists(tensor2d);
  assertExists(tensor3d);

  assertEquals(webgpuX.tensorRank(tensor1d), 1);
  assertEquals(webgpuX.tensorRank(tensor2d), 2);
  assertEquals(webgpuX.tensorRank(tensor3d), 3);

  console.log(`✓ Ranks: 1D=[10], 2D=[3,4], 3D=[2,3,4]`);
});

// Test 4: Get total elements
Deno.test("Get total elements", () => {
  console.log("\nTest 4: Getting total elements...");
  const tensor = webgpuX.tensorCreate(0n, [2, 3, 4], TensorDType.Float32, TensorAccess.ReadWrite);
  assertExists(tensor);

  const totalElements = webgpuX.tensorTotalElements(tensor);
  assertEquals(totalElements, 24n);

  console.log(`✓ Total elements: ${totalElements}`);
});

// Test 5: Different data types
Deno.test("Different data types", () => {
  console.log("\nTest 5: Testing different data types...");

  const float32 = webgpuX.tensorCreate(0n, [10], TensorDType.Float32, TensorAccess.ReadWrite);
  const float16 = webgpuX.tensorCreate(0n, [10], TensorDType.Float16, TensorAccess.ReadWrite);
  const int32 = webgpuX.tensorCreate(0n, [10], TensorDType.Int32, TensorAccess.ReadWrite);
  const int8 = webgpuX.tensorCreate(0n, [10], TensorDType.Int8, TensorAccess.ReadWrite);
  const uint8 = webgpuX.tensorCreate(0n, [10], TensorDType.UInt8, TensorAccess.ReadWrite);

  assertExists(float32);
  assertExists(float16);
  assertExists(int32);
  assertExists(int8);
  assertExists(uint8);

  assertEquals(webgpuX.tensorSizeBytes(float32), 40n);  // 10 * 4
  assertEquals(webgpuX.tensorSizeBytes(float16), 20n);  // 10 * 2
  assertEquals(webgpuX.tensorSizeBytes(int32), 40n);    // 10 * 4
  assertEquals(webgpuX.tensorSizeBytes(int8), 10n);     // 10 * 1
  assertEquals(webgpuX.tensorSizeBytes(uint8), 10n);    // 10 * 1

  console.log(`✓ Float32: 40 bytes, Float16: 20 bytes, Int32: 40 bytes`);
  console.log(`  Int8: 10 bytes, UInt8: 10 bytes`);
});

// Test 6: Different access patterns
Deno.test("Different access patterns", () => {
  console.log("\nTest 6: Testing different access patterns...");

  const readOnly = webgpuX.tensorCreate(0n, [10], TensorDType.Float32, TensorAccess.ReadOnly);
  const writeOnly = webgpuX.tensorCreate(0n, [10], TensorDType.Float32, TensorAccess.WriteOnly);
  const readWrite = webgpuX.tensorCreate(0n, [10], TensorDType.Float32, TensorAccess.ReadWrite);
  const uniform = webgpuX.tensorCreate(0n, [10], TensorDType.Float32, TensorAccess.Uniform);

  assertExists(readOnly);
  assertExists(writeOnly);
  assertExists(readWrite);
  assertExists(uniform);

  assertEquals(readOnly.access, TensorAccess.ReadOnly);
  assertEquals(writeOnly.access, TensorAccess.WriteOnly);
  assertEquals(readWrite.access, TensorAccess.ReadWrite);
  assertEquals(uniform.access, TensorAccess.Uniform);

  console.log(`✓ All access patterns: ReadOnly, WriteOnly, ReadWrite, Uniform`);
});

// Test 7: Reshape tensor
Deno.test("Reshape tensor", () => {
  console.log("\nTest 7: Reshaping tensor...");
  const tensor = webgpuX.tensorCreate(0n, [2, 3, 4], TensorDType.Float32, TensorAccess.ReadWrite);
  assertExists(tensor);

  const reshaped = webgpuX.tensorReshape(tensor, [4, 6]);
  assertExists(reshaped);
  assertEquals(reshaped.shape.dimensions, [4, 6]);
  assertEquals(webgpuX.tensorTotalElements(reshaped), 24n);

  console.log(`✓ Reshaped [2,3,4] → [4,6] (24 elements preserved)`);
});

// Test 8: Transpose 2D tensor
Deno.test("Transpose 2D tensor", () => {
  console.log("\nTest 8: Transposing 2D tensor...");
  const tensor = webgpuX.tensorCreate(0n, [2, 3], TensorDType.Float32, TensorAccess.ReadWrite);
  assertExists(tensor);

  const transposed = webgpuX.tensorTranspose2D(tensor);
  assertExists(transposed);
  assertEquals(transposed.shape.dimensions, [3, 2]);

  console.log(`✓ Transposed [2,3] → [3,2]`);
});

// Test 9: Tensor view with offset
Deno.test("Create tensor view", () => {
  console.log("\nTest 9: Creating tensor view...");
  const tensor = webgpuX.tensorCreate(0n, [10], TensorDType.Float32, TensorAccess.ReadWrite);
  assertExists(tensor);

  const view = webgpuX.tensorView(tensor, 5n);
  assertExists(view);
  assertEquals(view.offset, 20n);  // 5 elements * 4 bytes = 20 bytes offset

  console.log(`✓ View created with 5 element offset (20 byte offset)`);
});

// Test 10: Check contiguous memory
Deno.test("Check contiguous memory", () => {
  console.log("\nTest 10: Checking memory contiguity...");
  const tensor = webgpuX.tensorCreate(0n, [2, 3, 4], TensorDType.Float32, TensorAccess.ReadWrite);
  assertExists(tensor);

  const isContiguous = webgpuX.tensorIsContiguous(tensor);
  assertEquals(isContiguous, true);

  console.log(`✓ Tensor is contiguous in memory`);
});

// Test 11: Get tensor shape
Deno.test("Get tensor shape", () => {
  console.log("\nTest 11: Getting tensor shape...");
  const tensor = webgpuX.tensorCreate(0n, [2, 3, 4], TensorDType.Float32, TensorAccess.ReadWrite);
  assertExists(tensor);

  const shape = webgpuX.tensorGetShape(tensor);
  assertEquals(shape, [2, 3, 4]);

  console.log(`✓ Shape: [${shape.join(", ")}]`);
});

// Test 12: Get tensor strides
Deno.test("Get tensor strides", () => {
  console.log("\nTest 12: Getting tensor strides...");
  const tensor = webgpuX.tensorCreate(0n, [2, 3, 4], TensorDType.Float32, TensorAccess.ReadWrite);
  assertExists(tensor);

  const strides = webgpuX.tensorGetStrides(tensor);
  assertEquals(strides.length, 3);
  assertEquals(strides[0], 12n);  // 3 * 4 = 12
  assertEquals(strides[1], 4n);   // 4
  assertEquals(strides[2], 1n);   // 1

  console.log(`✓ Strides: [${strides.join(", ")}]`);
  console.log(`  (for [2,3,4]: stride[0]=12, stride[1]=4, stride[2]=1)`);
});

// Test 13: Invalid reshape should fail
Deno.test("Invalid reshape fails gracefully", () => {
  console.log("\nTest 13: Testing invalid reshape...");
  const tensor = webgpuX.tensorCreate(0n, [2, 3, 4], TensorDType.Float32, TensorAccess.ReadWrite);
  assertExists(tensor);

  // Try to reshape 24 elements to 25 elements (should fail)
  const reshaped = webgpuX.tensorReshape(tensor, [5, 5]);
  assertEquals(reshaped, null);

  console.log(`✓ Invalid reshape correctly returns null`);
});

// Test 14: Transpose non-2D tensor should fail
Deno.test("Transpose non-2D tensor fails gracefully", () => {
  console.log("\nTest 14: Testing transpose on 3D tensor...");
  const tensor3d = webgpuX.tensorCreate(0n, [2, 3, 4], TensorDType.Float32, TensorAccess.ReadWrite);
  assertExists(tensor3d);

  const transposed = webgpuX.tensorTranspose2D(tensor3d);
  assertEquals(transposed, null);

  console.log(`✓ Transpose on 3D tensor correctly returns null`);
});

// Test 15: Large tensor
Deno.test("Large tensor", () => {
  console.log("\nTest 15: Creating large tensor...");
  const tensor = webgpuX.tensorCreate(
    0n,
    [64, 128, 256],  // 2,097,152 elements
    TensorDType.Float32,
    TensorAccess.ReadWrite
  );
  assertExists(tensor);

  const sizeBytes = webgpuX.tensorSizeBytes(tensor);
  assertEquals(sizeBytes, 8388608n);  // 2,097,152 * 4 = 8,388,608 bytes (8MB)

  console.log(`✓ Large tensor [64,128,256]: 2,097,152 elements, 8 MB`);
});

console.log("\n=== Tensor Operations Tests Complete ===\n");
console.log("Summary:");
console.log("  ✓ Tensor creation with various shapes and types");
console.log("  ✓ Size, rank, and element calculations");
console.log("  ✓ All data types: Float32, Float16, Int32, Int8, UInt8");
console.log("  ✓ All access patterns: ReadOnly, WriteOnly, ReadWrite, Uniform");
console.log("  ✓ Reshape operations");
console.log("  ✓ 2D transpose");
console.log("  ✓ Tensor views with offset");
console.log("  ✓ Memory contiguity checks");
console.log("  ✓ Shape and stride queries");
console.log("  ✓ Error handling for invalid operations");
console.log("\nTensor operations ready for GPU ML/compute workloads!");
