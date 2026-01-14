import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { WebGPUX } from "./webgpu_x.ts";

const webgpuX = new WebGPUX();

// ============================================================================
// Framework Helpers Tests
// ============================================================================

Deno.test("Framework: Get default device config", () => {
  const config = webgpuX.frameworkDeviceConfigDefault();
  assertNotEquals(config, null, "Should return device config");
  assertEquals(Array.isArray(config!.required_features), true, "Should have required_features array");
  assertEquals(Array.isArray(config!.optional_features), true, "Should have optional_features array");
  assertEquals(typeof config!.required_limits, "object", "Should have required_limits object");
  console.log("✓ Default device config:", config);
});

Deno.test("Framework: OpenGL to WGPU matrix", () => {
  const matrix = webgpuX.frameworkMatrixOpenGLToWGPU();
  assertNotEquals(matrix, null, "Should return matrix");
  assertEquals(matrix!.length, 16, "Matrix should have 16 elements");
  assertEquals(matrix instanceof Float32Array, true, "Should be Float32Array");

  // Check conversion matrix structure (identity with z-axis scaling)
  assertEquals(matrix![0], 1.0, "m[0,0] should be 1.0");
  assertEquals(matrix![5], 1.0, "m[1,1] should be 1.0");
  assertEquals(matrix![10], 0.5, "m[2,2] should be 0.5 (z-axis scale)");
  assertEquals(matrix![15], 1.0, "m[3,3] should be 1.0");

  console.log("✓ OpenGL to WGPU matrix:", Array.from(matrix!));
});

Deno.test("Framework: Perspective projection matrix", () => {
  const fovY = Math.PI / 4; // 45 degrees
  const aspect = 16 / 9;
  const near = 0.1;
  const far = 100.0;

  const matrix = webgpuX.frameworkMatrixPerspective(fovY, aspect, near, far);
  assertNotEquals(matrix, null, "Should return matrix");
  assertEquals(matrix!.length, 16, "Matrix should have 16 elements");
  assertEquals(matrix instanceof Float32Array, true, "Should be Float32Array");

  // Check perspective matrix properties
  const f = 1.0 / Math.tan(fovY / 2.0);
  const expectedM00 = f / aspect;
  const expectedM11 = f;

  assertEquals(Math.abs(matrix![0] - expectedM00) < 0.001, true, "m[0,0] should match f/aspect");
  assertEquals(Math.abs(matrix![5] - expectedM11) < 0.001, true, "m[1,1] should match f");

  console.log("✓ Perspective matrix:", Array.from(matrix!));
});

Deno.test("Framework: Orthographic projection matrix", () => {
  const left = -10.0;
  const right = 10.0;
  const bottom = -10.0;
  const top = 10.0;
  const near = 0.1;
  const far = 100.0;

  const matrix = webgpuX.frameworkMatrixOrthographic(left, right, bottom, top, near, far);
  assertNotEquals(matrix, null, "Should return matrix");
  assertEquals(matrix!.length, 16, "Matrix should have 16 elements");
  assertEquals(matrix instanceof Float32Array, true, "Should be Float32Array");

  // Check orthographic matrix properties
  const rl = 1.0 / (right - left);
  const tb = 1.0 / (top - bottom);

  const expectedM00 = 2.0 * rl;
  const expectedM11 = 2.0 * tb;

  assertEquals(Math.abs(matrix![0] - expectedM00) < 0.001, true, "m[0,0] should match 2/(r-l)");
  assertEquals(Math.abs(matrix![5] - expectedM11) < 0.001, true, "m[1,1] should match 2/(t-b)");

  console.log("✓ Orthographic matrix:", Array.from(matrix!));
});

Deno.test("Framework: View matrix (look-at)", () => {
  const eye: [number, number, number] = [0, 0, 5];
  const target: [number, number, number] = [0, 0, 0];
  const up: [number, number, number] = [0, 1, 0];

  const matrix = webgpuX.frameworkMatrixView(eye, target, up);
  assertNotEquals(matrix, null, "Should return matrix");
  assertEquals(matrix!.length, 16, "Matrix should have 16 elements");
  assertEquals(matrix instanceof Float32Array, true, "Should be Float32Array");

  // View matrix should be valid transformation
  assertEquals(matrix![15], 1.0, "m[3,3] should be 1.0");

  console.log("✓ View matrix:", Array.from(matrix!));
});

Deno.test("Framework: Model matrix (TRS)", () => {
  const translation: [number, number, number] = [1, 2, 3];
  const rotation: [number, number, number] = [0, Math.PI / 4, 0]; // 45° around Y
  const scale: [number, number, number] = [2, 2, 2];

  const matrix = webgpuX.frameworkMatrixModel(translation, rotation, scale);
  assertNotEquals(matrix, null, "Should return matrix");
  assertEquals(matrix!.length, 16, "Matrix should have 16 elements");
  assertEquals(matrix instanceof Float32Array, true, "Should be Float32Array");

  // Model matrix should be valid transformation
  assertEquals(matrix![15], 1.0, "m[3,3] should be 1.0");

  // Check translation components (last column)
  assertEquals(matrix![12], translation[0], "Translation X should match");
  assertEquals(matrix![13], translation[1], "Translation Y should match");
  assertEquals(matrix![14], translation[2], "Translation Z should match");

  console.log("✓ Model matrix:", Array.from(matrix!));
});

Deno.test("Framework: Identity model matrix", () => {
  const translation: [number, number, number] = [0, 0, 0];
  const rotation: [number, number, number] = [0, 0, 0];
  const scale: [number, number, number] = [1, 1, 1];

  const matrix = webgpuX.frameworkMatrixModel(translation, rotation, scale);
  assertNotEquals(matrix, null, "Should return matrix");

  // Should be identity matrix
  const expected = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];

  for (let i = 0; i < 16; i++) {
    assertEquals(
      Math.abs(matrix![i] - expected[i]) < 0.001,
      true,
      `Identity matrix element [${i}] should be ${expected[i]}`,
    );
  }

  console.log("✓ Identity model matrix verified");
});

Deno.test("Framework: Combined transformations", () => {
  // Create a full MVP (Model-View-Projection) transformation
  const modelMatrix = webgpuX.frameworkMatrixModel(
    [0, 0, -5], // Move back 5 units
    [0, 0, 0],
    [1, 1, 1],
  );

  const viewMatrix = webgpuX.frameworkMatrixView(
    [0, 0, 10], // Camera at z=10
    [0, 0, 0],  // Looking at origin
    [0, 1, 0],  // Up is +Y
  );

  const projMatrix = webgpuX.frameworkMatrixPerspective(
    Math.PI / 4, // 45° FOV
    16 / 9,      // 16:9 aspect
    0.1,         // Near plane
    100.0,       // Far plane
  );

  assertNotEquals(modelMatrix, null, "Model matrix should be valid");
  assertNotEquals(viewMatrix, null, "View matrix should be valid");
  assertNotEquals(projMatrix, null, "Projection matrix should be valid");

  console.log("✓ MVP transformation chain created successfully");
});

console.log("\n🎉 All framework helper tests completed!");
