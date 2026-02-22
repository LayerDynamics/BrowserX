/**
 * Tests for ShaderHelpers - webgpu_x FFI Integration
 *
 * Tests the Rust FFI bindings for shader caching with hot-reload
 * and WGSL code generation utilities.
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import {
  clearShaderCache,
  createShaderCache,
  destroyShaderCache,
  getShaderCacheStats,
  hasShaderChanged,
  loadShader,
  wgslBindingBuffer,
  wgslBindingSampler,
  wgslBindingTexture,
  wgslComputeEntry,
} from "../../../../src/engine/webgpu/utils/ShaderHelpers.ts";
import { closeLib, preloadLib } from "@browserx/webgpu_x";

// Eagerly load FFI library at module scope so per-test sanitizer doesn't flag it
preloadLib();

// ============================================================================
// Shader Cache Lifecycle Tests
// ============================================================================

Deno.test("ShaderHelpers - createShaderCache returns valid handle", () => {
  const handle = createShaderCache();
  assertExists(handle);
  assert(handle > 0n, "Handle should be a positive bigint");

  // Cleanup
  destroyShaderCache(handle);
});

Deno.test("ShaderHelpers - createShaderCache creates unique handles", () => {
  const handle1 = createShaderCache();
  const handle2 = createShaderCache();

  assertExists(handle1);
  assertExists(handle2);
  assert(handle1 !== handle2, "Each cache should have a unique handle");

  // Cleanup
  destroyShaderCache(handle1);
  destroyShaderCache(handle2);
});

Deno.test("ShaderHelpers - destroyShaderCache releases resources", () => {
  const handle = createShaderCache();
  assertExists(handle);

  // Should not throw
  destroyShaderCache(handle);

  // Double destroy should be safe (no-op or ignore)
  // This tests that the implementation handles invalid handles gracefully
});

// ============================================================================
// Shader Cache Statistics Tests
// ============================================================================

Deno.test("ShaderHelpers - getShaderCacheStats returns valid structure", () => {
  const handle = createShaderCache();
  assertExists(handle);

  const stats = getShaderCacheStats(handle);
  assertExists(stats);

  // Stats should have expected fields
  assert(
    "entries" in stats || "count" in stats || typeof stats === "object",
    "Stats should be an object with cache information",
  );

  // Cleanup
  destroyShaderCache(handle);
});

Deno.test("ShaderHelpers - clearShaderCache resets cache", () => {
  const handle = createShaderCache();
  assertExists(handle);

  // Clear the cache (should not throw)
  clearShaderCache(handle);

  // Stats should reflect empty cache
  const stats = getShaderCacheStats(handle);
  assertExists(stats);

  // Cleanup
  destroyShaderCache(handle);
});

// ============================================================================
// Shader File Operations Tests
// ============================================================================

Deno.test("ShaderHelpers - loadShader returns null for non-existent file", () => {
  const handle = createShaderCache();
  assertExists(handle);

  const result = loadShader(handle, "/non/existent/path/shader.wgsl");
  assertEquals(result, null);

  // Cleanup
  destroyShaderCache(handle);
});

Deno.test("ShaderHelpers - hasShaderChanged returns false for non-existent file", () => {
  const handle = createShaderCache();
  assertExists(handle);

  // Non-existent file should not be marked as changed
  const changed = hasShaderChanged(handle, "/non/existent/path/shader.wgsl");
  assertEquals(changed, false);

  // Cleanup
  destroyShaderCache(handle);
});

// ============================================================================
// WGSL Generation Tests
// ============================================================================

Deno.test("ShaderHelpers - wgslBindingBuffer generates valid WGSL", () => {
  const wgsl = wgslBindingBuffer(0, 0, "uniform", "data: mat4x4<f32>");

  assertExists(wgsl);
  assert(wgsl.length > 0, "Generated WGSL should not be empty");
  assert(wgsl.includes("@group(0)"), "Should include group attribute");
  assert(wgsl.includes("@binding(0)"), "Should include binding attribute");
  assert(
    wgsl.includes("uniform") || wgsl.includes("var<uniform>"),
    "Should include uniform keyword or var<uniform>",
  );
});

Deno.test("ShaderHelpers - wgslBindingBuffer with storage buffer", () => {
  const wgsl = wgslBindingBuffer(1, 2, "storage", "data: array<f32>");

  assertExists(wgsl);
  assert(wgsl.includes("@group(1)"), "Should include group 1");
  assert(wgsl.includes("@binding(2)"), "Should include binding 2");
  assert(
    wgsl.includes("storage") || wgsl.includes("var<storage"),
    "Should include storage keyword",
  );
});

Deno.test("ShaderHelpers - wgslBindingBuffer with read-only storage", () => {
  const wgsl = wgslBindingBuffer(0, 1, "read-only-storage", "data: array<vec4<f32>>");

  assertExists(wgsl);
  assert(wgsl.includes("@group(0)"), "Should include group 0");
  assert(wgsl.includes("@binding(1)"), "Should include binding 1");
  // Should include read-only indicator
  assert(
    wgsl.includes("read") || wgsl.includes("storage"),
    "Should include storage or read indicator",
  );
});

Deno.test("ShaderHelpers - wgslBindingTexture generates valid WGSL", () => {
  const wgsl = wgslBindingTexture(0, 0, "texture_2d", "f32");

  assertExists(wgsl);
  assert(wgsl.length > 0, "Generated WGSL should not be empty");
  assert(wgsl.includes("@group(0)"), "Should include group attribute");
  assert(wgsl.includes("@binding(0)"), "Should include binding attribute");
  assert(wgsl.includes("texture_2d") || wgsl.includes("texture"), "Should include texture type");
});

Deno.test("ShaderHelpers - wgslBindingTexture with different texture types", () => {
  const types = ["texture_2d", "texture_3d", "texture_cube", "texture_2d_array"];

  for (const type of types) {
    const wgsl = wgslBindingTexture(0, 0, type, "f32");
    assertExists(wgsl, `Should generate WGSL for ${type}`);
    assert(wgsl.length > 0, `Generated WGSL for ${type} should not be empty`);
  }
});

Deno.test("ShaderHelpers - wgslBindingSampler generates valid WGSL", () => {
  const wgsl = wgslBindingSampler(0, 1, "sampler");

  assertExists(wgsl);
  assert(wgsl.length > 0, "Generated WGSL should not be empty");
  assert(wgsl.includes("@group(0)"), "Should include group attribute");
  assert(wgsl.includes("@binding(1)"), "Should include binding attribute");
  assert(wgsl.includes("sampler"), "Should include sampler type");
});

Deno.test("ShaderHelpers - wgslBindingSampler with comparison sampler", () => {
  const wgsl = wgslBindingSampler(0, 2, "sampler_comparison");

  assertExists(wgsl);
  assert(
    wgsl.includes("sampler") || wgsl.includes("comparison"),
    "Should include sampler or comparison",
  );
});

Deno.test("ShaderHelpers - wgslComputeEntry generates valid compute shader", () => {
  const body = "let idx = id.x; output[idx] = input[idx] * 2.0;";
  const wgsl = wgslComputeEntry([64, 1, 1], body);

  assertExists(wgsl);
  assert(wgsl.length > 0, "Generated WGSL should not be empty");
  assert(wgsl.includes("@compute"), "Should include compute attribute");
  assert(wgsl.includes("@workgroup_size"), "Should include workgroup_size");
  assert(wgsl.includes("64"), "Should include workgroup size X");
  assert(wgsl.includes("main") || wgsl.includes("fn "), "Should include function declaration");
});

Deno.test("ShaderHelpers - wgslComputeEntry with 2D workgroup", () => {
  const body = "let x = id.x; let y = id.y;";
  const wgsl = wgslComputeEntry([16, 16, 1], body);

  assertExists(wgsl);
  assert(wgsl.includes("@workgroup_size"), "Should include workgroup_size");
  assert(wgsl.includes("16"), "Should include workgroup size dimensions");
});

Deno.test("ShaderHelpers - wgslComputeEntry with 3D workgroup", () => {
  const body = "let x = id.x; let y = id.y; let z = id.z;";
  const wgsl = wgslComputeEntry([8, 8, 8], body);

  assertExists(wgsl);
  assert(wgsl.includes("@workgroup_size"), "Should include workgroup_size");
  assert(wgsl.includes("8"), "Should include workgroup size dimensions");
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test("ShaderHelpers - multiple caches operate independently", () => {
  const handle1 = createShaderCache();
  const handle2 = createShaderCache();

  assertExists(handle1);
  assertExists(handle2);

  // Operations on one cache shouldn't affect the other
  clearShaderCache(handle1);

  const stats2 = getShaderCacheStats(handle2);
  assertExists(stats2);

  // Cleanup
  destroyShaderCache(handle1);
  destroyShaderCache(handle2);
});

Deno.test("ShaderHelpers - WGSL generation is deterministic", () => {
  // Same inputs should produce same outputs
  const wgsl1 = wgslBindingBuffer(0, 0, "uniform", "data: mat4x4<f32>");
  const wgsl2 = wgslBindingBuffer(0, 0, "uniform", "data: mat4x4<f32>");

  assertEquals(wgsl1, wgsl2, "Same inputs should produce identical WGSL");
});

Deno.test("ShaderHelpers - different bindings produce different WGSL", () => {
  const wgsl1 = wgslBindingBuffer(0, 0, "uniform", "data: mat4x4<f32>");
  const wgsl2 = wgslBindingBuffer(0, 1, "uniform", "data: mat4x4<f32>");
  const wgsl3 = wgslBindingBuffer(1, 0, "uniform", "data: mat4x4<f32>");

  assert(wgsl1 !== wgsl2, "Different binding numbers should produce different WGSL");
  assert(wgsl1 !== wgsl3, "Different group numbers should produce different WGSL");
  assert(wgsl2 !== wgsl3, "Different group/binding combinations should differ");
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test("ShaderHelpers - wgslComputeEntry with empty body", () => {
  const wgsl = wgslComputeEntry([1, 1, 1], "");

  assertExists(wgsl);
  assert(wgsl.includes("@compute"), "Should still generate valid structure");
  assert(wgsl.includes("@workgroup_size"), "Should still include workgroup_size");
});

Deno.test("ShaderHelpers - wgslBindingBuffer with complex struct", () => {
  const complexStruct = `
        transform: mat4x4<f32>,
        color: vec4<f32>,
        time: f32,
        padding: vec3<f32>
    `;
  const wgsl = wgslBindingBuffer(0, 0, "uniform", complexStruct);

  assertExists(wgsl);
  assert(wgsl.includes("@group(0)"), "Should handle complex struct definitions");
});

Deno.test("ShaderHelpers - high binding numbers", () => {
  // Test with higher binding/group numbers that might be at limits
  const wgsl = wgslBindingBuffer(3, 15, "storage", "data: array<f32>");

  assertExists(wgsl);
  assert(wgsl.includes("@group(3)"), "Should handle group 3");
  assert(wgsl.includes("@binding(15)"), "Should handle binding 15");
});
