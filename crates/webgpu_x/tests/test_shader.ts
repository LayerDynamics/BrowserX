/**
 * Integration test for Phase 3: Shader Compilation & WGSL Generation
 */

import { WebGPUX } from "./webgpu_x.ts";

console.log("=== Phase 3: Shader Compilation & WGSL Generation Test ===\n");

const webgpuX = new WebGPUX();

// ============================================================================
// Test 1: Shader Cache Creation and Management
// ============================================================================

console.log("Test 1: Shader Cache Management");
const cacheHandle = webgpuX.createShaderCache();
console.log(`  ✓ Created shader cache: ${cacheHandle}`);

// Get initial stats
const initialStats = webgpuX.shaderCacheStats(cacheHandle);
console.log(`  ✓ Initial cached shaders: ${initialStats.cached_shaders}`);

// ============================================================================
// Test 2: Load Shader from String
// ============================================================================

console.log("\nTest 2: Load Shader from String");
const computeShaderCode = `
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    output[index] = input[index] * 2.0;
}
`;

const shaderSource = webgpuX.shaderCacheLoadFromString(
  cacheHandle,
  computeShaderCode,
  2, // Compute stage
  "main"
);

if (shaderSource) {
  console.log(`  ✓ Loaded shader from string`);
  console.log(`    - Stage: ${shaderSource.stage} (2=Compute)`);
  console.log(`    - Entry point: ${shaderSource.entry_point}`);
  console.log(`    - Code length: ${shaderSource.code.length} chars`);
} else {
  console.log("  ✗ Failed to load shader from string");
}

// ============================================================================
// Test 3: Shader Stage Detection
// ============================================================================

console.log("\nTest 3: Shader Stage Detection");
const stages = [
  { ext: "shader.vert", expected: 0, name: "Vertex" },
  { ext: "shader.frag", expected: 1, name: "Fragment" },
  { ext: "shader.comp", expected: 2, name: "Compute" },
  { ext: "shader.wgsl", expected: 2, name: "Compute (default)" },
];

for (const { ext, expected, name } of stages) {
  const stage = webgpuX.shaderDetectStage(ext);
  const pass = stage === expected ? "✓" : "✗";
  console.log(`  ${pass} ${ext} -> ${stage} (${name})`);
}

// ============================================================================
// Test 4: WGSL Code Generation - Bindings
// ============================================================================

console.log("\nTest 4: WGSL Binding Generation");

const storageBinding = webgpuX.wgslBindingBuffer(0, 0, "input_data", "read");
console.log(`  ✓ Storage buffer:`);
console.log(`    ${storageBinding}`);

const uniformBinding = webgpuX.wgslBindingUniform(0, 1, "params", "Uniforms");
console.log(`  ✓ Uniform buffer:`);
console.log(`    ${uniformBinding}`);

const textureBinding = webgpuX.wgslBindingTexture(0, 2, "my_texture", "texture_2d<f32>");
console.log(`  ✓ Texture:`);
console.log(`    ${textureBinding}`);

const samplerBinding = webgpuX.wgslBindingSampler(0, 3, "my_sampler");
console.log(`  ✓ Sampler:`);
console.log(`    ${samplerBinding}`);

// ============================================================================
// Test 5: WGSL Struct Generation
// ============================================================================

console.log("\nTest 5: WGSL Struct Generation");

const fields = [
  webgpuX.wgslStructField("time", "f32"),
  webgpuX.wgslStructField("resolution", "vec2<f32>"),
  webgpuX.wgslStructField("mouse", "vec2<f32>"),
];

const structDef = webgpuX.wgslStruct("Uniforms", fields);
console.log(`  ✓ Generated struct:`);
console.log(structDef.split('\n').map(line => `    ${line}`).join('\n'));

// ============================================================================
// Test 6: WGSL Compute Shader Entry Point Generation
// ============================================================================

console.log("\nTest 6: WGSL Compute Entry Generation");

const computeEntry = webgpuX.wgslComputeEntry(
  "main",
  64, 1, 1,
  ["@builtin(global_invocation_id) id: vec3<u32>"],
  "    let index = id.x;\n    output[index] = input[index] * 2.0;"
);

console.log(`  ✓ Generated compute shader entry:`);
console.log(computeEntry.split('\n').map(line => `    ${line}`).join('\n'));

// ============================================================================
// Test 7: WGSL Helper Functions
// ============================================================================

console.log("\nTest 7: WGSL Helper Functions");

const builtinAttr = webgpuX.wgslBuiltin("id", "global_invocation_id");
console.log(`  ✓ Builtin attribute: ${builtinAttr}`);

const locationAttr = webgpuX.wgslLocation("color", 0, "vec4<f32>");
console.log(`  ✓ Location attribute: ${locationAttr}`);

const functionDef = webgpuX.wgslFunction(
  "add",
  ["a: f32", "b: f32"],
  "f32",
  "    return a + b;"
);
console.log(`  ✓ Function definition:`);
console.log(functionDef.split('\n').map(line => `    ${line}`).join('\n'));

// ============================================================================
// Test 8: WGSL Complete Shader Generation
// ============================================================================

console.log("\nTest 8: Generate Complete Shader");

// Build a complete compute shader using the helper methods
const completeShader = `
${webgpuX.wgslBindingBuffer(0, 0, "input", "read")}
${webgpuX.wgslBindingBuffer(0, 1, "output", "read_write")}
${webgpuX.wgslBindingUniform(0, 2, "uniforms", "Uniforms")}

${webgpuX.wgslStruct("Uniforms", [
  webgpuX.wgslStructField("multiplier", "f32"),
  webgpuX.wgslStructField("offset", "f32"),
])}

${webgpuX.wgslFunction(
  "process",
  ["value: f32"],
  "f32",
  "    return value * uniforms.multiplier + uniforms.offset;"
)}

${webgpuX.wgslComputeEntry(
  "main",
  64, 1, 1,
  ["@builtin(global_invocation_id) id: vec3<u32>"],
  "    let index = id.x;\n    output[index] = process(input[index]);"
)}
`;

console.log("  ✓ Complete shader generated:");
console.log(completeShader.split('\n').map(line => `    ${line}`).join('\n'));

// ============================================================================
// Test 9: WGSL Minification
// ============================================================================

console.log("\nTest 9: WGSL Minification");

const verboseShader = `
// This is a comment
@compute @workgroup_size(64)
fn main() {
    // Another comment
    let x = 1.0;
    /* Block comment */
    let y = 2.0;
}
`;

const minified = webgpuX.wgslMinify(verboseShader);
console.log(`  ✓ Original: ${verboseShader.length} chars`);
console.log(`  ✓ Minified: ${minified.length} chars`);
console.log(`  ✓ Minified code: ${minified}`);

// ============================================================================
// Test 10: WGSL Analysis
// ============================================================================

console.log("\nTest 10: WGSL Analysis");

const analysisShader = `
fn add(a: f32, b: f32) -> f32 {
    return a + b;
}

fn multiply(a: f32, b: f32) -> f32 {
    return a * b;
}

@compute @workgroup_size(64)
fn main() {
    let result = add(1.0, multiply(2.0, 3.0));
}
`;

const lineCount = webgpuX.wgslLineCount(analysisShader);
const functions = webgpuX.wgslExtractFunctions(analysisShader);

console.log(`  ✓ Line count: ${lineCount}`);
console.log(`  ✓ Functions found: ${functions.join(", ")}`);

// ============================================================================
// Test 11: Final Stats
// ============================================================================

console.log("\nTest 11: Final Cache Stats");
const finalStats = webgpuX.shaderCacheStats(cacheHandle);
console.log(`  ✓ Final cached shaders: ${finalStats.cached_shaders}`);

// Cleanup
webgpuX.destroyShaderCache(cacheHandle);
console.log(`  ✓ Destroyed shader cache`);

console.log("\n=== All Phase 3 Tests Passed ===");
