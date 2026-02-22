/**
 * Tests for WebGPU Async Pipeline Compilation via webgpu_x FFI
 *
 * Deno's native createRenderPipelineAsync/createComputePipelineAsync have a
 * WebIDL conversion bug that loses descriptor properties (Deno #24317, still
 * broken in Deno 2.6.9).
 *
 * The webgpu_x Rust FFI crate provides an alternative:
 * - gpu_create_render_pipeline_async: creates render pipeline via wgpu on a
 *   background thread (non_blocking FFI), returning a Promise<bigint> handle
 * - gpu_create_compute_pipeline_async: same for compute pipelines
 *
 * These bypass Deno's WebIDL entirely, using wgpu's sync pipeline creation
 * on a background OS thread. wgpu itself does not have async compilation yet
 * (gfx-rs/wgpu#3794), but the non_blocking FFI achieves non-blocking behavior
 * from TypeScript's perspective.
 */

import { assertEquals, assertNotEquals } from "@std/assert";
import { preloadLib, WebGPUX } from "@browserx/webgpu_x";
import {
  type ComputePipelineDescriptor,
  ComputePipelineManager,
  type RenderPipelineDescriptor,
  RenderPipelineManager,
} from "../../../../src/engine/webgpu/pipelines/mod.ts";
import type { WebGPUDevice } from "../../../../src/engine/webgpu/adapter/Device.ts";
import { getSharedDevice, webgpuAvailable } from "../shared_device.ts";

preloadLib();

const VERTEX_SHADER = `
@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 0.5),
        vec2<f32>(-0.5, -0.5),
        vec2<f32>(0.5, -0.5)
    );
    return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
@fragment
fn fs_main() -> @location(0) vec4<f32> {
    return vec4<f32>(1.0, 0.0, 0.0, 1.0);
}
`;

const COMPUTE_SHADER = `
@group(0) @binding(0) var<storage, read_write> data: array<f32>;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    data[index] = data[index] * 2.0;
}
`;

const gpux = new WebGPUX();

if (webgpuAvailable) {
  // ========================================================================
  // FFI Async Render Pipeline Tests
  // ========================================================================

  Deno.test("FFI Async Render Pipeline - creates pipeline on background thread", async () => {
    // Initialize FFI GPU
    const initResult = gpux.init();
    assertEquals(initResult, true, "FFI GPU init should succeed");

    // Request adapter and device via FFI
    const adapterHandle = gpux.requestAdapter(0); // default backend
    assertNotEquals(adapterHandle, 0n, "Adapter handle should not be 0");

    const deviceHandle = gpux.requestDevice(adapterHandle);
    assertNotEquals(deviceHandle, 0n, "Device handle should not be 0");

    // Create shader modules via FFI
    const vertexModuleHandle = gpux.createShaderModule(
      deviceHandle,
      "async-test-vertex",
      VERTEX_SHADER,
    );
    assertNotEquals(vertexModuleHandle, 0n, "Vertex shader module handle should not be 0");

    const fragmentModuleHandle = gpux.createShaderModule(
      deviceHandle,
      "async-test-fragment",
      FRAGMENT_SHADER,
    );
    assertNotEquals(fragmentModuleHandle, 0n, "Fragment shader module handle should not be 0");

    // Create render pipeline ASYNC via FFI (runs on background thread)
    const pipelineHandle = await gpux.createRenderPipelineAsync(
      deviceHandle,
      "async-test-pipeline",
      vertexModuleHandle,
      "vs_main",
      fragmentModuleHandle,
      "fs_main",
      3, // bgra8unorm format code
      "", // no blend state
      3, // triangle-list topology
      0, // no culling
      0n, // auto layout
    );
    assertNotEquals(pipelineHandle, 0n, "Async render pipeline handle should not be 0");

    // Cleanup
    gpux.destroyRenderPipelineFfi(pipelineHandle);
    gpux.destroyShaderModule(fragmentModuleHandle);
    gpux.destroyShaderModule(vertexModuleHandle);
    gpux.destroyDevice(deviceHandle);
    gpux.destroyAdapter(adapterHandle);
  });

  Deno.test("FFI Async Render Pipeline - sync and async produce valid handles", async () => {
    const initResult = gpux.init();
    assertEquals(initResult, true);

    const adapterHandle = gpux.requestAdapter(0);
    const deviceHandle = gpux.requestDevice(adapterHandle);

    const vertexModuleHandle = gpux.createShaderModule(
      deviceHandle,
      "sync-async-vertex",
      VERTEX_SHADER,
    );
    const fragmentModuleHandle = gpux.createShaderModule(
      deviceHandle,
      "sync-async-fragment",
      FRAGMENT_SHADER,
    );

    // Create sync pipeline
    const syncHandle = gpux.createRenderPipelineSync(
      deviceHandle,
      "sync-pipeline",
      vertexModuleHandle,
      "vs_main",
      fragmentModuleHandle,
      "fs_main",
      3,
      "",
      3,
      0,
      0n,
    );
    assertNotEquals(syncHandle, 0n, "Sync render pipeline handle should not be 0");

    // Create async pipeline (same shaders, different label)
    const asyncHandle = await gpux.createRenderPipelineAsync(
      deviceHandle,
      "async-pipeline",
      vertexModuleHandle,
      "vs_main",
      fragmentModuleHandle,
      "fs_main",
      3,
      "",
      3,
      0,
      0n,
    );
    assertNotEquals(asyncHandle, 0n, "Async render pipeline handle should not be 0");

    // Both should have valid, different handles
    assertNotEquals(syncHandle, asyncHandle, "Sync and async should produce different handles");

    // Cleanup
    gpux.destroyRenderPipelineFfi(syncHandle);
    gpux.destroyRenderPipelineFfi(asyncHandle);
    gpux.destroyShaderModule(fragmentModuleHandle);
    gpux.destroyShaderModule(vertexModuleHandle);
    gpux.destroyDevice(deviceHandle);
    gpux.destroyAdapter(adapterHandle);
  });

  Deno.test("FFI Async Render Pipeline - with blend state", async () => {
    const initResult = gpux.init();
    assertEquals(initResult, true);

    const adapterHandle = gpux.requestAdapter(0);
    const deviceHandle = gpux.requestDevice(adapterHandle);

    const vertexModuleHandle = gpux.createShaderModule(
      deviceHandle,
      "blend-vertex",
      VERTEX_SHADER,
    );
    const fragmentModuleHandle = gpux.createShaderModule(
      deviceHandle,
      "blend-fragment",
      FRAGMENT_SHADER,
    );

    // Standard alpha blending
    const blendJson = JSON.stringify({
      color: { srcFactor: 4, dstFactor: 5, operation: 0 }, // SrcAlpha, OneMinusSrcAlpha, Add
      alpha: { srcFactor: 1, dstFactor: 5, operation: 0 }, // One, OneMinusSrcAlpha, Add
    });

    const pipelineHandle = await gpux.createRenderPipelineAsync(
      deviceHandle,
      "blend-pipeline",
      vertexModuleHandle,
      "vs_main",
      fragmentModuleHandle,
      "fs_main",
      3,
      blendJson,
      3,
      0,
      0n,
    );
    assertNotEquals(pipelineHandle, 0n, "Pipeline with blend state should succeed");

    // Cleanup
    gpux.destroyRenderPipelineFfi(pipelineHandle);
    gpux.destroyShaderModule(fragmentModuleHandle);
    gpux.destroyShaderModule(vertexModuleHandle);
    gpux.destroyDevice(deviceHandle);
    gpux.destroyAdapter(adapterHandle);
  });

  // ========================================================================
  // FFI Async Compute Pipeline Tests
  // ========================================================================

  Deno.test("FFI Async Compute Pipeline - creates pipeline on background thread", async () => {
    const initResult = gpux.init();
    assertEquals(initResult, true);

    const adapterHandle = gpux.requestAdapter(0);
    const deviceHandle = gpux.requestDevice(adapterHandle);

    const computeModuleHandle = gpux.createShaderModule(
      deviceHandle,
      "async-compute-shader",
      COMPUTE_SHADER,
    );
    assertNotEquals(computeModuleHandle, 0n, "Compute shader module handle should not be 0");

    // Create compute pipeline ASYNC via FFI (runs on background thread)
    const pipelineHandle = await gpux.createComputePipelineAsync(
      deviceHandle,
      "async-compute-pipeline",
      computeModuleHandle,
      "cs_main",
      0n, // auto layout
    );
    assertNotEquals(pipelineHandle, 0n, "Async compute pipeline handle should not be 0");

    // Cleanup
    gpux.destroyComputePipeline(pipelineHandle);
    gpux.destroyShaderModule(computeModuleHandle);
    gpux.destroyDevice(deviceHandle);
    gpux.destroyAdapter(adapterHandle);
  });

  Deno.test("FFI Async Compute Pipeline - sync and async produce valid handles", async () => {
    const initResult = gpux.init();
    assertEquals(initResult, true);

    const adapterHandle = gpux.requestAdapter(0);
    const deviceHandle = gpux.requestDevice(adapterHandle);

    const computeModuleHandle = gpux.createShaderModule(
      deviceHandle,
      "sync-async-compute",
      COMPUTE_SHADER,
    );

    // Sync
    const syncHandle = gpux.createComputePipelineSync(
      deviceHandle,
      "sync-compute",
      computeModuleHandle,
      "cs_main",
      0n,
    );
    assertNotEquals(syncHandle, 0n);

    // Async
    const asyncHandle = await gpux.createComputePipelineAsync(
      deviceHandle,
      "async-compute",
      computeModuleHandle,
      "cs_main",
      0n,
    );
    assertNotEquals(asyncHandle, 0n);

    assertNotEquals(syncHandle, asyncHandle);

    // Cleanup
    gpux.destroyComputePipeline(syncHandle);
    gpux.destroyComputePipeline(asyncHandle);
    gpux.destroyShaderModule(computeModuleHandle);
    gpux.destroyDevice(deviceHandle);
    gpux.destroyAdapter(adapterHandle);
  });

  // ========================================================================
  // Native Deno Pipeline Manager Tests (sync path, verifies it still works)
  // ========================================================================

  Deno.test("RenderPipelineManager - sync pipeline creation works correctly", async () => {
    const device = await getSharedDevice();
    const manager = new RenderPipelineManager(device, { enableAsync: false });
    const gpuDevice = device.getDevice();

    const vertexModule = gpuDevice.createShaderModule({ code: VERTEX_SHADER });
    const fragmentModule = gpuDevice.createShaderModule({ code: FRAGMENT_SHADER });

    const descriptor: RenderPipelineDescriptor = {
      vertex: { module: vertexModule, entryPoint: "vs_main" },
      fragment: {
        module: fragmentModule,
        entryPoint: "fs_main",
        targets: [{ format: "bgra8unorm" }],
      },
      layout: "auto" as const,
    };

    const pipeline = await manager.getPipeline(descriptor);
    assertNotEquals(pipeline, null);
    assertNotEquals(pipeline, undefined);

    const stats = manager.getStats();
    assertEquals(stats.total, 1);
    assertEquals(stats.misses, 1);
  });

  Deno.test("ComputePipelineManager - sync pipeline creation works correctly", async () => {
    const device = await getSharedDevice();
    const manager = new ComputePipelineManager(device, { enableAsync: false });
    const gpuDevice = device.getDevice();

    const computeModule = gpuDevice.createShaderModule({ code: COMPUTE_SHADER });

    const descriptor: ComputePipelineDescriptor = {
      compute: { module: computeModule, entryPoint: "cs_main" },
      layout: "auto" as const,
    };

    const pipeline = await manager.getPipeline(descriptor);
    assertNotEquals(pipeline, null);
    assertNotEquals(pipeline, undefined);

    const stats = manager.getStats();
    assertEquals(stats.total, 1);
    assertEquals(stats.misses, 1);
  });

  // ========================================================================
  // Cleanup test
  // ========================================================================

  Deno.test("FFI Pipeline Cleanup - cleanupPipelines clears all resources", () => {
    gpux.cleanupPipelines();
    // Should not throw — all pipeline resources cleared
  });
} else {
  Deno.test("Async Pipeline - skipped (no WebGPU)", () => {
    console.log("WebGPU not available, skipping async pipeline tests");
  });
}
