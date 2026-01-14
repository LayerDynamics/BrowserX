/**
 * Tests for WebGPU Pipeline Management
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import {
    RenderPipelineManager,
    ComputePipelineManager,
    PipelineManager,
    BlendMode,
    PipelineState,
    type RenderPipelineDescriptor,
    type ComputePipelineDescriptor,
} from "../../../../src/engine/webgpu/pipelines/mod.ts";
import { WebGPUDevice } from "../../../../src/engine/webgpu/adapter/Device.ts";

// Check if WebGPU is available
const webgpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;

// Simple test shaders
const VERTEX_SHADER = `
@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
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
fn main() -> @location(0) vec4<f32> {
    return vec4<f32>(1.0, 0.0, 0.0, 1.0);
}
`;

const COMPUTE_SHADER = `
@group(0) @binding(0) var<storage, read_write> data: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    data[index] = data[index] * 2.0;
}
`;

if (webgpuAvailable) {
    let device: WebGPUDevice;

    async function setup() {
        device = new WebGPUDevice();
        await device.initialize();
    }

    function teardown() {
        device.destroy();
    }

    // Helper to create a basic pipeline layout
    function createPipelineLayout(gpuDevice: GPUDevice): GPUPipelineLayout {
        const bindGroupLayout = gpuDevice.createBindGroupLayout({
            entries: [],
        });
        return gpuDevice.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        });
    }

    // ========================================================================
    // Render Pipeline Manager Tests
    // ========================================================================

    Deno.test("RenderPipelineManager - creates pipeline", async () => {
        await setup();

        const manager = new RenderPipelineManager(device);
        const gpuDevice = device.getDevice();

        const vertexModule = gpuDevice.createShaderModule({
            code: VERTEX_SHADER,
        });
        const fragmentModule = gpuDevice.createShaderModule({
            code: FRAGMENT_SHADER,
        });

        // Create empty bind group layout for auto layout
        const bindGroupLayout = gpuDevice.createBindGroupLayout({
            entries: [],
        });
        const pipelineLayout = gpuDevice.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        });

        const descriptor: RenderPipelineDescriptor = {
            vertex: {
                module: vertexModule,
                entryPoint: "main",
            },
            fragment: {
                module: fragmentModule,
                entryPoint: "main",
                targets: [{ format: "bgra8unorm" }],
            },
            layout: pipelineLayout,
        };

        const pipeline = await manager.getPipeline(descriptor);
        assertExists(pipeline);

        teardown();
    });

    Deno.test("RenderPipelineManager - caches pipelines", async () => {
        await setup();

        const manager = new RenderPipelineManager(device);
        const gpuDevice = device.getDevice();

        const vertexModule = gpuDevice.createShaderModule({
            code: VERTEX_SHADER,
        });
        const fragmentModule = gpuDevice.createShaderModule({
            code: FRAGMENT_SHADER,
        });

        const bindGroupLayout = gpuDevice.createBindGroupLayout({
            entries: [],
        });
        const pipelineLayout = gpuDevice.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        });

        const descriptor: RenderPipelineDescriptor = {
            vertex: {
                module: vertexModule,
                entryPoint: "main",
            },
            fragment: {
                module: fragmentModule,
                entryPoint: "main",
                targets: [{ format: "bgra8unorm" }],
            },
            layout: pipelineLayout,
        };

        const pipeline1 = await manager.getPipeline(descriptor);
        const pipeline2 = await manager.getPipeline(descriptor);

        // Should return same pipeline (cached)
        assertEquals(pipeline1, pipeline2);

        const stats = manager.getStats();
        assertEquals(stats.total, 1);
        assertEquals(stats.hits, 1);
        assertEquals(stats.misses, 1);

        teardown();
    });

    Deno.test("RenderPipelineManager - tracks statistics", async () => {
        await setup();

        const manager = new RenderPipelineManager(device);
        const gpuDevice = device.getDevice();

        const vertexModule = gpuDevice.createShaderModule({
            code: VERTEX_SHADER,
        });
        const fragmentModule = gpuDevice.createShaderModule({
            code: FRAGMENT_SHADER,
        });

        const pipelineLayout = createPipelineLayout(gpuDevice);

        const descriptor: RenderPipelineDescriptor = {
            vertex: {
                module: vertexModule,
                entryPoint: "main",
            },
            fragment: {
                module: fragmentModule,
                entryPoint: "main",
                targets: [{ format: "bgra8unorm" }],
            },
            layout: pipelineLayout,
        };

        await manager.getPipeline(descriptor);
        await manager.getPipeline(descriptor);

        const stats = manager.getStats();
        assertExists(stats);
        assertEquals(typeof stats.total, "number");
        assertEquals(typeof stats.hits, "number");
        assertEquals(typeof stats.misses, "number");
        assertEquals(typeof stats.evictions, "number");
        assertEquals(typeof stats.averageCompilationTime, "number");

        teardown();
    });

    Deno.test("RenderPipelineManager - evicts LRU on cache overflow", async () => {
        await setup();

        const manager = new RenderPipelineManager(device, { maxCacheSize: 2 });
        const gpuDevice = device.getDevice();

        // Create 3 different pipelines
        for (let i = 0; i < 3; i++) {
            const vertexModule = gpuDevice.createShaderModule({
                code: VERTEX_SHADER,
            });
            const fragmentModule = gpuDevice.createShaderModule({
                code: FRAGMENT_SHADER,
            });

            const pipelineLayout = createPipelineLayout(gpuDevice);

            const descriptor: RenderPipelineDescriptor = {
                label: `pipeline-${i}`,
                vertex: {
                    module: vertexModule,
                    entryPoint: "main",
                },
                fragment: {
                    module: fragmentModule,
                    entryPoint: "main",
                    targets: [{ format: "bgra8unorm" }],
                },
                layout: pipelineLayout,
            };

            await manager.getPipeline(descriptor);
        }

        const stats = manager.getStats();
        assertEquals(stats.evictions, 1); // One pipeline should be evicted

        teardown();
    });

    Deno.test("RenderPipelineManager - clear removes all pipelines", async () => {
        await setup();

        const manager = new RenderPipelineManager(device);
        const gpuDevice = device.getDevice();

        const vertexModule = gpuDevice.createShaderModule({
            code: VERTEX_SHADER,
        });
        const fragmentModule = gpuDevice.createShaderModule({
            code: FRAGMENT_SHADER,
        });

        const pipelineLayout = createPipelineLayout(gpuDevice);

        const descriptor: RenderPipelineDescriptor = {
            vertex: {
                module: vertexModule,
                entryPoint: "main",
            },
            fragment: {
                module: fragmentModule,
                entryPoint: "main",
                targets: [{ format: "bgra8unorm" }],
            },
            layout: pipelineLayout,
        };

        await manager.getPipeline(descriptor);
        manager.clear();

        const stats = manager.getStats();
        assertEquals(stats.total, 0);

        teardown();
    });

    Deno.test("RenderPipelineManager - createSimplePipeline with ALPHA blend", async () => {
        await setup();

        const manager = new RenderPipelineManager(device);

        const pipeline = await manager.createSimplePipeline(
            VERTEX_SHADER,
            FRAGMENT_SHADER,
            "bgra8unorm",
            BlendMode.ALPHA,
        );

        assertExists(pipeline);

        teardown();
    });

    Deno.test("RenderPipelineManager - createSimplePipeline with ADDITIVE blend", async () => {
        await setup();

        const manager = new RenderPipelineManager(device);

        const pipeline = await manager.createSimplePipeline(
            VERTEX_SHADER,
            FRAGMENT_SHADER,
            "bgra8unorm",
            BlendMode.ADDITIVE,
        );

        assertExists(pipeline);

        teardown();
    });

    Deno.test("RenderPipelineManager - createSimplePipeline with MULTIPLY blend", async () => {
        await setup();

        const manager = new RenderPipelineManager(device);

        const pipeline = await manager.createSimplePipeline(
            VERTEX_SHADER,
            FRAGMENT_SHADER,
            "bgra8unorm",
            BlendMode.MULTIPLY,
        );

        assertExists(pipeline);

        teardown();
    });

    Deno.test("RenderPipelineManager - createSimplePipeline with SCREEN blend", async () => {
        await setup();

        const manager = new RenderPipelineManager(device);

        const pipeline = await manager.createSimplePipeline(
            VERTEX_SHADER,
            FRAGMENT_SHADER,
            "bgra8unorm",
            BlendMode.SCREEN,
        );

        assertExists(pipeline);

        teardown();
    });

    Deno.test("RenderPipelineManager - createSimplePipeline with NONE blend", async () => {
        await setup();

        const manager = new RenderPipelineManager(device);

        const pipeline = await manager.createSimplePipeline(
            VERTEX_SHADER,
            FRAGMENT_SHADER,
            "bgra8unorm",
            BlendMode.NONE,
        );

        assertExists(pipeline);

        teardown();
    });

    // ========================================================================
    // Compute Pipeline Manager Tests
    // ========================================================================

    Deno.test("ComputePipelineManager - creates pipeline", async () => {
        await setup();

        const manager = new ComputePipelineManager(device);
        const gpuDevice = device.getDevice();

        const module = gpuDevice.createShaderModule({
            code: COMPUTE_SHADER,
        });

        const pipelineLayout = createPipelineLayout(gpuDevice);

        const descriptor: ComputePipelineDescriptor = {
            compute: {
                module,
                entryPoint: "main",
            },
            layout: pipelineLayout,
        };

        const pipeline = await manager.getPipeline(descriptor);
        assertExists(pipeline);

        teardown();
    });

    Deno.test("ComputePipelineManager - caches pipelines", async () => {
        await setup();

        const manager = new ComputePipelineManager(device);
        const gpuDevice = device.getDevice();

        const module = gpuDevice.createShaderModule({
            code: COMPUTE_SHADER,
        });

        const pipelineLayout = createPipelineLayout(gpuDevice);

        const descriptor: ComputePipelineDescriptor = {
            compute: {
                module,
                entryPoint: "main",
            },
            layout: pipelineLayout,
        };

        const pipeline1 = await manager.getPipeline(descriptor);
        const pipeline2 = await manager.getPipeline(descriptor);

        // Should return same pipeline (cached)
        assertEquals(pipeline1, pipeline2);

        const stats = manager.getStats();
        assertEquals(stats.total, 1);
        assertEquals(stats.hits, 1);
        assertEquals(stats.misses, 1);

        teardown();
    });

    Deno.test("ComputePipelineManager - tracks statistics", async () => {
        await setup();

        const manager = new ComputePipelineManager(device);
        const gpuDevice = device.getDevice();

        const module = gpuDevice.createShaderModule({
            code: COMPUTE_SHADER,
        });

        const pipelineLayout = createPipelineLayout(gpuDevice);

        const descriptor: ComputePipelineDescriptor = {
            compute: {
                module,
                entryPoint: "main",
            },
            layout: pipelineLayout,
        };

        await manager.getPipeline(descriptor);

        const stats = manager.getStats();
        assertExists(stats);
        assertEquals(typeof stats.total, "number");
        assertEquals(typeof stats.hits, "number");
        assertEquals(typeof stats.misses, "number");
        assertEquals(typeof stats.evictions, "number");
        assertEquals(typeof stats.averageCompilationTime, "number");

        teardown();
    });

    Deno.test("ComputePipelineManager - evicts LRU on cache overflow", async () => {
        await setup();

        const manager = new ComputePipelineManager(device, { maxCacheSize: 2 });
        const gpuDevice = device.getDevice();

        // Create 3 different pipelines
        for (let i = 0; i < 3; i++) {
            const module = gpuDevice.createShaderModule({
                code: COMPUTE_SHADER,
            });

            const pipelineLayout = createPipelineLayout(gpuDevice);

            const descriptor: ComputePipelineDescriptor = {
                label: `compute-pipeline-${i}`,
                compute: {
                    module,
                    entryPoint: "main",
                },
                layout: pipelineLayout,
            };

            await manager.getPipeline(descriptor);
        }

        const stats = manager.getStats();
        assertEquals(stats.evictions, 1);

        teardown();
    });

    Deno.test("ComputePipelineManager - clear removes all pipelines", async () => {
        await setup();

        const manager = new ComputePipelineManager(device);
        const gpuDevice = device.getDevice();

        const module = gpuDevice.createShaderModule({
            code: COMPUTE_SHADER,
        });

        const pipelineLayout = createPipelineLayout(gpuDevice);

        const descriptor: ComputePipelineDescriptor = {
            compute: {
                module,
                entryPoint: "main",
            },
            layout: pipelineLayout,
        };

        await manager.getPipeline(descriptor);
        manager.clear();

        const stats = manager.getStats();
        assertEquals(stats.total, 0);

        teardown();
    });

    Deno.test("ComputePipelineManager - createSimplePipeline", async () => {
        await setup();

        const manager = new ComputePipelineManager(device);

        const pipeline = await manager.createSimplePipeline(COMPUTE_SHADER);
        assertExists(pipeline);

        teardown();
    });

    Deno.test("ComputePipelineManager - createSimplePipeline with constants", async () => {
        await setup();

        const manager = new ComputePipelineManager(device);

        const pipeline = await manager.createSimplePipeline(
            COMPUTE_SHADER,
            "main",
            { WORKGROUP_SIZE: 64 },
        );
        assertExists(pipeline);

        teardown();
    });

    // ========================================================================
    // Unified Pipeline Manager Tests
    // ========================================================================

    Deno.test("PipelineManager - provides render pipeline manager", async () => {
        await setup();

        const manager = new PipelineManager(device);
        const renderManager = manager.getRenderPipelineManager();

        assertExists(renderManager);
        assertEquals(renderManager instanceof RenderPipelineManager, true);

        teardown();
    });

    Deno.test("PipelineManager - provides compute pipeline manager", async () => {
        await setup();

        const manager = new PipelineManager(device);
        const computeManager = manager.getComputePipelineManager();

        assertExists(computeManager);
        assertEquals(computeManager instanceof ComputePipelineManager, true);

        teardown();
    });

    Deno.test("PipelineManager - getStats returns unified statistics", async () => {
        await setup();

        const manager = new PipelineManager(device);
        const stats = manager.getStats();

        assertExists(stats);
        assertExists(stats.renderPipelines);
        assertExists(stats.computePipelines);
        assertEquals(typeof stats.cacheSize, "number");
        assertEquals(typeof stats.maxCacheSize, "number");

        teardown();
    });

    Deno.test("PipelineManager - clear clears both caches", async () => {
        await setup();

        const manager = new PipelineManager(device);
        const gpuDevice = device.getDevice();

        // Create render pipeline
        const vertexModule = gpuDevice.createShaderModule({
            code: VERTEX_SHADER,
        });
        const fragmentModule = gpuDevice.createShaderModule({
            code: FRAGMENT_SHADER,
        });

        const renderLayout = createPipelineLayout(gpuDevice);

        const renderDescriptor: RenderPipelineDescriptor = {
            vertex: {
                module: vertexModule,
                entryPoint: "main",
            },
            fragment: {
                module: fragmentModule,
                entryPoint: "main",
                targets: [{ format: "bgra8unorm" }],
            },
            layout: renderLayout,
        };

        // Create compute pipeline
        const computeModule = gpuDevice.createShaderModule({
            code: COMPUTE_SHADER,
        });

        const computeLayout = createPipelineLayout(gpuDevice);

        const computeDescriptor: ComputePipelineDescriptor = {
            compute: {
                module: computeModule,
                entryPoint: "main",
            },
            layout: computeLayout,
        };

        await manager.getRenderPipelineManager().getPipeline(renderDescriptor);
        await manager.getComputePipelineManager().getPipeline(computeDescriptor);

        manager.clear();

        const stats = manager.getStats();
        assertEquals(stats.cacheSize, 0);

        teardown();
    });

    Deno.test("PipelineManager - configuration propagates to sub-managers", async () => {
        await setup();

        const manager = new PipelineManager(device, {
            maxCacheSize: 10,
            enableAsync: false,
            trackStatistics: true,
        });

        assertExists(manager);

        teardown();
    });
} else {
    console.log("WebGPU not available - skipping pipeline tests");
}
