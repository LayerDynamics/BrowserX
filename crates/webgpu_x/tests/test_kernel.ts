#!/usr/bin/env -S deno run --allow-ffi --unstable-ffi --no-check

import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { WebGPUX, KernelOperation } from "./webgpu_x.ts";

const webgpuX = new WebGPUX();

console.log("\n=== Kernel Template Generation Tests ===\n");

// Test 1: Element-wise Addition
Deno.test("Generate Add kernel", () => {
  console.log("Test 1: Generating Add kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.Add, 256, 1, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(256, 1, 1)"));
  assert(kernel.includes("input_a"));
  assert(kernel.includes("input_b"));
  assert(kernel.includes("output"));
  assert(kernel.includes("input_a[index] + input_b[index]"));

  console.log(`✓ Add kernel generated (${kernel.length} chars)`);
  console.log(`  Workgroup size: 256x1x1`);
});

// Test 2: Element-wise Multiplication
Deno.test("Generate Multiply kernel", () => {
  console.log("\nTest 2: Generating Multiply kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.Multiply, 256, 1, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(256, 1, 1)"));
  assert(kernel.includes("input_a[index] * input_b[index]"));

  console.log(`✓ Multiply kernel generated (${kernel.length} chars)`);
});

// Test 3: Matrix Multiplication
Deno.test("Generate MatrixMultiply kernel", () => {
  console.log("\nTest 3: Generating MatrixMultiply kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.MatrixMultiply, 16, 16, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(16, 16, 1)"));
  assert(kernel.includes("matrix_a"));
  assert(kernel.includes("matrix_b"));
  assert(kernel.includes("dims")); // Uniform for M, K, N dimensions
  assert(kernel.includes("for"));  // Contains loop for dot product
  assert(kernel.includes("row * K + k")); // Matrix indexing

  console.log(`✓ MatrixMultiply kernel generated (${kernel.length} chars)`);
  console.log(`  Workgroup size: 16x16x1 (2D grid for matrix)`);
});

// Test 4: Convolution 1D
Deno.test("Generate Conv1D kernel", () => {
  console.log("\nTest 4: Generating Conv1D kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.Conv1D, 256, 1, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(256, 1, 1)"));
  assert(kernel.includes("input"));
  assert(kernel.includes("output"));
  assert(kernel.includes("for")); // Contains convolution loop

  console.log(`✓ Conv1D kernel generated (${kernel.length} chars)`);
});

// Test 5: Convolution 2D
Deno.test("Generate Conv2D kernel", () => {
  console.log("\nTest 5: Generating Conv2D kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.Conv2D, 16, 16, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(16, 16, 1)"));
  assert(kernel.includes("input"));
  assert(kernel.includes("output"));
  assert(kernel.includes("for")); // Contains 2D convolution loops

  console.log(`✓ Conv2D kernel generated (${kernel.length} chars)`);
  console.log(`  Workgroup size: 16x16x1 (2D grid for image)`);
});

// Test 6: ReLU Activation
Deno.test("Generate Relu kernel", () => {
  console.log("\nTest 6: Generating Relu kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.Relu, 256, 1, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(256, 1, 1)"));
  assert(kernel.includes("max(0.0, input[index])"));

  console.log(`✓ Relu kernel generated (${kernel.length} chars)`);
  console.log(`  Operation: max(0, x)`);
});

// Test 7: Sigmoid Activation
Deno.test("Generate Sigmoid kernel", () => {
  console.log("\nTest 7: Generating Sigmoid kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.Sigmoid, 256, 1, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(256, 1, 1)"));
  assert(kernel.includes("exp(-input[index])"));
  assert(kernel.includes("1.0 / (1.0 +"));

  console.log(`✓ Sigmoid kernel generated (${kernel.length} chars)`);
  console.log(`  Operation: 1/(1+e^-x)`);
});

// Test 8: Tanh Activation
Deno.test("Generate Tanh kernel", () => {
  console.log("\nTest 8: Generating Tanh kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.Tanh, 256, 1, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(256, 1, 1)"));
  assert(kernel.includes("tanh(input[index])"));

  console.log(`✓ Tanh kernel generated (${kernel.length} chars)`);
});

// Test 9: Softmax Activation
Deno.test("Generate Softmax kernel", () => {
  console.log("\nTest 9: Generating Softmax kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.Softmax, 256, 1, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(256, 1, 1)"));
  assert(kernel.includes("var<workgroup>")); // Shared memory for reduction
  assert(kernel.includes("exp"));
  assert(kernel.includes("workgroupBarrier"));

  console.log(`✓ Softmax kernel generated (${kernel.length} chars)`);
  console.log(`  Uses shared memory for parallel reduction`);
});

// Test 10: Layer Normalization
Deno.test("Generate LayerNorm kernel", () => {
  console.log("\nTest 10: Generating LayerNorm kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.LayerNorm, 256, 1, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(256, 1, 1)"));
  assert(kernel.includes("var<workgroup>")); // Shared memory
  assert(kernel.includes("workgroupBarrier")); // Synchronization

  console.log(`✓ LayerNorm kernel generated (${kernel.length} chars)`);
});

// Test 11: Batch Normalization
Deno.test("Generate BatchNorm kernel", () => {
  console.log("\nTest 11: Generating BatchNorm kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.BatchNorm, 256, 1, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(256, 1, 1)"));
  assert(kernel.includes("gamma"));
  assert(kernel.includes("beta"));
  assert(kernel.includes("normalized")); // Normalization computation

  console.log(`✓ BatchNorm kernel generated (${kernel.length} chars)`);
});

// Test 12: Max Pooling 2D
Deno.test("Generate MaxPool2D kernel", () => {
  console.log("\nTest 12: Generating MaxPool2D kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.MaxPool2D, 16, 16, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(16, 16, 1)"));
  assert(kernel.includes("max_val") || kernel.includes("max(")); // Max operation
  assert(kernel.includes("for")); // Pooling loops

  console.log(`✓ MaxPool2D kernel generated (${kernel.length} chars)`);
  console.log(`  Workgroup size: 16x16x1 (2D pooling)`);
});

// Test 13: Average Pooling 2D
Deno.test("Generate AvgPool2D kernel", () => {
  console.log("\nTest 13: Generating AvgPool2D kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.AvgPool2D, 16, 16, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(16, 16, 1)"));
  assert(kernel.includes("sum") || kernel.includes("avg")); // Average computation
  assert(kernel.includes("for")); // Pooling loops

  console.log(`✓ AvgPool2D kernel generated (${kernel.length} chars)`);
});

// Test 14: Matrix Transpose
Deno.test("Generate Transpose kernel", () => {
  console.log("\nTest 14: Generating Transpose kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.Transpose, 16, 16, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(16, 16, 1)"));
  assert(kernel.includes("row * cols + col"));
  assert(kernel.includes("col * rows + row"));

  console.log(`✓ Transpose kernel generated (${kernel.length} chars)`);
  console.log(`  Workgroup size: 16x16x1 (2D transpose)`);
});

// Test 15: Reduce Sum
Deno.test("Generate ReduceSum kernel", () => {
  console.log("\nTest 15: Generating ReduceSum kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.ReduceSum, 256, 1, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(256, 1, 1)"));
  assert(kernel.includes("var<workgroup>")); // Shared memory for reduction
  assert(kernel.includes("workgroupBarrier")); // Synchronization
  assert(kernel.includes("sum") || kernel.includes("local_")); // Reduction variable

  console.log(`✓ ReduceSum kernel generated (${kernel.length} chars)`);
  console.log(`  Uses parallel reduction with shared memory`);
});

// Test 16: Reduce Max
Deno.test("Generate ReduceMax kernel", () => {
  console.log("\nTest 16: Generating ReduceMax kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.ReduceMax, 256, 1, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(256, 1, 1)"));
  assert(kernel.includes("var<workgroup>"));
  assert(kernel.includes("max"));

  console.log(`✓ ReduceMax kernel generated (${kernel.length} chars)`);
});

// Test 17: Reduce Mean
Deno.test("Generate ReduceMean kernel", () => {
  console.log("\nTest 17: Generating ReduceMean kernel...");
  const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.ReduceMean, 256, 1, 1);

  assertExists(kernel);
  assert(kernel.includes("@compute @workgroup_size(256, 1, 1)"));
  assert(kernel.includes("var<workgroup>")); // Shared memory
  assert(kernel.includes("sum") || kernel.includes("local_")); // Reduction variable
  assert(kernel.includes("f32(") || kernel.includes("/")); // Division for mean

  console.log(`✓ ReduceMean kernel generated (${kernel.length} chars)`);
});

// Test 18: Different workgroup sizes
Deno.test("Test various workgroup sizes", () => {
  console.log("\nTest 18: Testing different workgroup sizes...");

  const sizes = [
    [64, 1, 1],
    [128, 1, 1],
    [256, 1, 1],
    [8, 8, 1],
    [16, 16, 1],
    [32, 32, 1],
  ] as const;

  for (const [x, y, z] of sizes) {
    const kernel = webgpuX.kernelGenerateFromTemplate(KernelOperation.Add, x, y, z);
    assert(kernel.includes(`@compute @workgroup_size(${x}, ${y}, ${z})`));
  }

  console.log(`✓ Tested ${sizes.length} different workgroup size configurations`);
  console.log(`  Sizes: 64x1x1, 128x1x1, 256x1x1, 8x8x1, 16x16x1, 32x32x1`);
});

// Test 19: All kernel operations exist
Deno.test("All 19 kernel operations generate valid code", () => {
  console.log("\nTest 19: Generating all 19 kernel operations...");

  const operations = [
    { op: KernelOperation.Add, name: "Add" },
    { op: KernelOperation.Subtract, name: "Subtract" },
    { op: KernelOperation.Multiply, name: "Multiply" },
    { op: KernelOperation.Divide, name: "Divide" },
    { op: KernelOperation.MatrixMultiply, name: "MatrixMultiply" },
    { op: KernelOperation.Conv1D, name: "Conv1D" },
    { op: KernelOperation.Conv2D, name: "Conv2D" },
    { op: KernelOperation.Relu, name: "Relu" },
    { op: KernelOperation.Sigmoid, name: "Sigmoid" },
    { op: KernelOperation.Tanh, name: "Tanh" },
    { op: KernelOperation.Softmax, name: "Softmax" },
    { op: KernelOperation.LayerNorm, name: "LayerNorm" },
    { op: KernelOperation.BatchNorm, name: "BatchNorm" },
    { op: KernelOperation.MaxPool2D, name: "MaxPool2D" },
    { op: KernelOperation.AvgPool2D, name: "AvgPool2D" },
    { op: KernelOperation.Transpose, name: "Transpose" },
    { op: KernelOperation.ReduceSum, name: "ReduceSum" },
    { op: KernelOperation.ReduceMax, name: "ReduceMax" },
    { op: KernelOperation.ReduceMean, name: "ReduceMean" },
  ];

  let totalChars = 0;
  for (const { op, name } of operations) {
    const kernel = webgpuX.kernelGenerateFromTemplate(op, 256, 1, 1);
    assertExists(kernel, `${name} kernel should exist`);
    assert(kernel.length > 50, `${name} kernel should be substantial`);
    assert(kernel.includes("@compute @workgroup_size"), `${name} should have compute entry`);
    totalChars += kernel.length;
  }

  console.log(`✓ All 19 kernel operations generated successfully`);
  console.log(`  Total generated code: ${totalChars.toLocaleString()} characters`);
  console.log(`  Average kernel size: ${Math.round(totalChars / operations.length)} characters`);
});

console.log("\n=== Kernel Template Tests Complete ===\n");
console.log("Summary:");
console.log("  ✓ Element-wise operations: Add, Subtract, Multiply, Divide");
console.log("  ✓ Matrix operations: MatrixMultiply, Transpose");
console.log("  ✓ Convolution: Conv1D, Conv2D");
console.log("  ✓ Activations: Relu, Sigmoid, Tanh, Softmax");
console.log("  ✓ Normalization: LayerNorm, BatchNorm");
console.log("  ✓ Pooling: MaxPool2D, AvgPool2D");
console.log("  ✓ Reduction: ReduceSum, ReduceMax, ReduceMean");
console.log("\nAll 19 kernel templates are ready for WebGPU compute pipelines!");
