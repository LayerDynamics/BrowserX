/**
 * Pipeline Lifecycle Tests
 *
 * Verifies RenderPipelineManager and ComputePipelineManager:
 * creation, PipelineResult fields, cache hit/miss stats, shader module caching,
 * destroy lifecycle, and PipelineManager unified access.
 */

import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import {
  COPY_COMPUTE_SHADER,
  DOUBLE_COMPUTE_SHADER,
  FULLSCREEN_VERTEX_SHADER,
  getSharedDevice,
  SOLID_BLUE_FRAGMENT,
  SOLID_GREEN_FRAGMENT,
  SOLID_RED_FRAGMENT,
  webgpuAvailable,
} from "./_helpers.ts";
import {
  ComputePipelineManager,
  PipelineManager,
  RenderPipelineManager,
} from "../../../../src/engine/webgpu/pipelines/mod.ts";

const opts = { ignore: !webgpuAvailable, sanitizeOps: false, sanitizeResources: false };

// ============================================================================
// RenderPipelineManager Creation
// ============================================================================

Deno.test("render pipeline: create returns PipelineResult", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new RenderPipelineManager(device);
  const gpuDevice = device.getDevice();

  const vertexModule = gpuDevice.createShaderModule({ code: FULLSCREEN_VERTEX_SHADER });
  const fragmentModule = gpuDevice.createShaderModule({ code: SOLID_RED_FRAGMENT });

  const result = await manager.createPipeline({
    vertex: { module: vertexModule, entryPoint: "vs_main" },
    fragment: {
      module: fragmentModule,
      entryPoint: "fs_main",
      targets: [{ format: "rgba8unorm" }],
    },
    primitive: { topology: "triangle-list" },
    label: "test-pipeline",
  });

  assertExists(result);
  assertExists(result.id);
  assertEquals(typeof result.isFFI, "boolean");
  if (result.isFFI) {
    assertExists(result.ffiHandle);
  } else {
    assertExists(result.nativePipeline);
  }

  manager.destroy();
});

Deno.test("render pipeline: cache hit on same label", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new RenderPipelineManager(device);
  const gpuDevice = device.getDevice();

  const vertexModule = gpuDevice.createShaderModule({ code: FULLSCREEN_VERTEX_SHADER });
  const fragmentModule = gpuDevice.createShaderModule({ code: SOLID_RED_FRAGMENT });

  const descriptor = {
    vertex: { module: vertexModule, entryPoint: "vs_main" },
    fragment: {
      module: fragmentModule,
      entryPoint: "fs_main",
      targets: [{ format: "rgba8unorm" as GPUTextureFormat }],
    },
    primitive: { topology: "triangle-list" as GPUPrimitiveTopology },
    label: "cached-pipeline",
  };

  await manager.getPipeline(descriptor);
  const statsBefore = manager.getStats();

  // Get from cache by same descriptor
  const cached = await manager.getPipeline(descriptor);
  assertExists(cached);
  const statsAfter = manager.getStats();
  assertEquals(statsAfter.hits, statsBefore.hits + 1);

  manager.destroy();
});

Deno.test(
  "render pipeline: different fragments produce different pipelines",
  { ...opts },
  async () => {
    const device = await getSharedDevice();
    const manager = new RenderPipelineManager(device);
    const gpuDevice = device.getDevice();

    const vertexModule = gpuDevice.createShaderModule({ code: FULLSCREEN_VERTEX_SHADER });
    const redModule = gpuDevice.createShaderModule({ code: SOLID_RED_FRAGMENT });
    const greenModule = gpuDevice.createShaderModule({ code: SOLID_GREEN_FRAGMENT });
    const blueModule = gpuDevice.createShaderModule({ code: SOLID_BLUE_FRAGMENT });

    const r1 = await manager.createPipeline({
      vertex: { module: vertexModule, entryPoint: "vs_main" },
      fragment: { module: redModule, entryPoint: "fs_main", targets: [{ format: "rgba8unorm" }] },
      primitive: { topology: "triangle-list" },
      label: "red-pipe",
    });
    const r2 = await manager.createPipeline({
      vertex: { module: vertexModule, entryPoint: "vs_main" },
      fragment: { module: greenModule, entryPoint: "fs_main", targets: [{ format: "rgba8unorm" }] },
      primitive: { topology: "triangle-list" },
      label: "green-pipe",
    });
    const r3 = await manager.createPipeline({
      vertex: { module: vertexModule, entryPoint: "vs_main" },
      fragment: { module: blueModule, entryPoint: "fs_main", targets: [{ format: "rgba8unorm" }] },
      primitive: { topology: "triangle-list" },
      label: "blue-pipe",
    });

    assertNotEquals(r1.id, r2.id);
    assertNotEquals(r2.id, r3.id);
    assertNotEquals(r1.id, r3.id);

    manager.destroy();
  },
);

Deno.test("render pipeline: stats track pipeline count", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new RenderPipelineManager(device);
  const gpuDevice = device.getDevice();

  const statsBefore = manager.getStats();

  const vertexModule = gpuDevice.createShaderModule({ code: FULLSCREEN_VERTEX_SHADER });
  const fragmentModule = gpuDevice.createShaderModule({ code: SOLID_RED_FRAGMENT });

  await manager.createPipeline({
    vertex: { module: vertexModule, entryPoint: "vs_main" },
    fragment: {
      module: fragmentModule,
      entryPoint: "fs_main",
      targets: [{ format: "rgba8unorm" }],
    },
    primitive: { topology: "triangle-list" },
    label: "stats-test",
  });

  const statsAfter = manager.getStats();
  assertEquals(statsAfter.total, statsBefore.total + 1);

  manager.destroy();
});

// ============================================================================
// ComputePipelineManager Creation
// ============================================================================

Deno.test("compute pipeline: create returns PipelineResult", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new ComputePipelineManager(device);
  const gpuDevice = device.getDevice();

  const shaderModule = gpuDevice.createShaderModule({ code: DOUBLE_COMPUTE_SHADER });

  const result = await manager.createPipeline({
    compute: { module: shaderModule, entryPoint: "main" },
    label: "double-compute",
  });

  assertExists(result);
  assertExists(result.id);
  assertEquals(typeof result.isFFI, "boolean");

  manager.destroy();
});

Deno.test(
  "compute pipeline: different shaders produce different pipelines",
  { ...opts },
  async () => {
    const device = await getSharedDevice();
    const manager = new ComputePipelineManager(device);
    const gpuDevice = device.getDevice();

    const doubleModule = gpuDevice.createShaderModule({ code: DOUBLE_COMPUTE_SHADER });
    const copyModule = gpuDevice.createShaderModule({ code: COPY_COMPUTE_SHADER });

    const result1 = await manager.createPipeline({
      compute: { module: doubleModule, entryPoint: "main" },
      label: "double",
    });
    const result2 = await manager.createPipeline({
      compute: { module: copyModule, entryPoint: "main" },
      label: "copy",
    });

    assertNotEquals(result1.id, result2.id);
    manager.destroy();
  },
);

Deno.test("compute pipeline: stats track pipeline count", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new ComputePipelineManager(device);
  const gpuDevice = device.getDevice();

  const statsBefore = manager.getStats();

  const shaderModule = gpuDevice.createShaderModule({ code: DOUBLE_COMPUTE_SHADER });
  await manager.createPipeline({
    compute: { module: shaderModule, entryPoint: "main" },
    label: "stats-compute",
  });

  const statsAfter = manager.getStats();
  assertEquals(statsAfter.total, statsBefore.total + 1);

  manager.destroy();
});

Deno.test("compute pipeline: createSimplePipeline helper", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new ComputePipelineManager(device);

  const result = await manager.createSimplePipeline(DOUBLE_COMPUTE_SHADER, "main");
  assertExists(result);
  assertExists(result.id);

  manager.destroy();
});

// ============================================================================
// PipelineManager Unified
// ============================================================================

Deno.test("pipeline manager: getStats returns combined stats", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new PipelineManager(device);

  const stats = manager.getStats();
  assertExists(stats);
  assertExists(stats.renderPipelines);
  assertExists(stats.computePipelines);
  assertEquals(typeof stats.cacheSize, "number");

  manager.destroy();
});

Deno.test("pipeline manager: render via sub-manager", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new PipelineManager(device);
  const gpuDevice = device.getDevice();

  const renderMgr = manager.getRenderPipelineManager();
  const vertexModule = gpuDevice.createShaderModule({ code: FULLSCREEN_VERTEX_SHADER });
  const fragmentModule = gpuDevice.createShaderModule({ code: SOLID_GREEN_FRAGMENT });

  const result = await renderMgr.createPipeline({
    vertex: { module: vertexModule, entryPoint: "vs_main" },
    fragment: {
      module: fragmentModule,
      entryPoint: "fs_main",
      targets: [{ format: "rgba8unorm" }],
    },
    primitive: { topology: "triangle-list" },
    label: "unified-render",
  });

  assertExists(result);
  assertEquals(manager.getStats().renderPipelines.total >= 1, true);

  manager.destroy();
});

Deno.test("pipeline manager: compute via sub-manager", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new PipelineManager(device);
  const gpuDevice = device.getDevice();

  const computeMgr = manager.getComputePipelineManager();
  const shaderModule = gpuDevice.createShaderModule({ code: DOUBLE_COMPUTE_SHADER });

  const result = await computeMgr.createPipeline({
    compute: { module: shaderModule, entryPoint: "main" },
    label: "unified-compute",
  });

  assertExists(result);
  assertEquals(manager.getStats().computePipelines.total >= 1, true);

  manager.destroy();
});

Deno.test("pipeline manager: destroy clears all", { ...opts }, async () => {
  const device = await getSharedDevice();
  const manager = new PipelineManager(device);
  const gpuDevice = device.getDevice();

  const renderMgr = manager.getRenderPipelineManager();
  const vertexModule = gpuDevice.createShaderModule({ code: FULLSCREEN_VERTEX_SHADER });
  const fragmentModule = gpuDevice.createShaderModule({ code: SOLID_RED_FRAGMENT });

  await renderMgr.createPipeline({
    vertex: { module: vertexModule, entryPoint: "vs_main" },
    fragment: {
      module: fragmentModule,
      entryPoint: "fs_main",
      targets: [{ format: "rgba8unorm" }],
    },
    primitive: { topology: "triangle-list" },
    label: "to-destroy",
  });

  manager.destroy();

  const stats = manager.getStats();
  assertEquals(stats.renderPipelines.total, 0);
  assertEquals(stats.computePipelines.total, 0);
});
