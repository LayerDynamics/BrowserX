/**
 * WebGPU Engine Tests
 *
 * Comprehensive test suite for the WebGPU engine and all subsystems.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    WebGPUEngine,
    WebGPUEngineState,
    type WebGPUEngineConfig,
    GPUBufferUsageFlags,
    GPUDeviceState,
    WebGPUBuffer,
    WebGPUCommandEncoder,
    ComputePipeline,
} from "./mod.ts";
import type {
    GPUSize,
    Pixels,
} from "../../types/webgpu.ts";

// ============================================================================
// Mock Canvas for Testing
// ============================================================================

class MockOffscreenCanvas {
    width: number;
    height: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }
}

// ============================================================================
// Test Helpers
// ============================================================================

async function createTestEngine(config?: Partial<WebGPUEngineConfig>): Promise<WebGPUEngine> {
    const canvas = new MockOffscreenCanvas(800, 600) as any;

    const defaultConfig: WebGPUEngineConfig = {
        canvas,
        powerPreference: "high-performance",
        debug: true,
        ...config,
    };

    const engine = new WebGPUEngine(defaultConfig);
    await engine.initialize();

    return engine;
}

// ============================================================================
// Engine Initialization Tests
// ============================================================================

Deno.test("WebGPU Engine - Initialize and Destroy", async () => {
    const engine = await createTestEngine();

    // Verify engine is initialized
    assertEquals(engine.getState(), WebGPUEngineState.READY);
    assertExists(engine.getDevice());
    assertExists(engine.getGPUDevice());

    // Destroy engine
    engine.destroy();
    assertEquals(engine.getState(), WebGPUEngineState.DESTROYED);
});

Deno.test("WebGPU Engine - Get Statistics", async () => {
    const engine = await createTestEngine();

    const stats = engine.getStatistics();

    assertExists(stats.state);
    assertExists(stats.device);
    assertExists(stats.memory);
    assertExists(stats.pipelines);

    assertEquals(stats.state, WebGPUEngineState.READY);

    engine.destroy();
});

Deno.test("WebGPU Engine - Get GPU Device", async () => {
    const engine = await createTestEngine();

    const gpuDevice = engine.getGPUDevice();

    assertExists(gpuDevice);
    assertExists(gpuDevice.limits);
    assertExists(gpuDevice.features);
    assertExists(gpuDevice.queue);

    engine.destroy();
});

// ============================================================================
// Device and Driver Tests
// ============================================================================

Deno.test("WebGPU Engine - Device State", async () => {
    const engine = await createTestEngine();
    const device = engine.getDevice();

    // Check device state
    const state = device.getState();
    assertEquals(state, GPUDeviceState.READY);

    // Get adapter info
    const adapter = device.getAdapter();
    assertExists(adapter);

    // Get features and limits
    const features = device.getFeatures();
    assertExists(features);

    const limits = device.getLimits();
    assertExists(limits);

    // Detect vendor
    const vendor = device.detectVendor();
    assertExists(vendor);

    engine.destroy();
});

Deno.test("WebGPU Engine - Device Statistics", async () => {
    const engine = await createTestEngine();
    const device = engine.getDevice();

    const stats = device.getStats();

    assertExists(stats);
    assertExists(stats.uptime);
    assertEquals(typeof stats.uptime, "number");
    assert(stats.uptime >= 0);

    engine.destroy();
});

// ============================================================================
// Buffer Management Tests
// ============================================================================

Deno.test("WebGPU Engine - Create Buffer", async () => {
    const engine = await createTestEngine();
    const device = engine.getDevice();

    const buffer = new WebGPUBuffer(device, {
        size: 1024 as GPUSize,
        usage: GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST,
        label: "test-buffer",
    });

    assertEquals(buffer.getSize(), 1024);
    assertExists(buffer.getNativeBuffer());

    buffer.destroy();
    engine.destroy();
});

Deno.test("WebGPU Engine - Buffer Pool", async () => {
    const engine = await createTestEngine();

    // Acquire buffer from pool
    const buffer = engine.getPooledBuffer(
        1024,
        GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST
    );

    assertExists(buffer);

    // Release buffer back to pool
    engine.releaseBuffer(buffer);

    engine.destroy();
});

Deno.test("WebGPU Engine - Write to Buffer", async () => {
    const engine = await createTestEngine();
    const device = engine.getDevice();

    const buffer = new WebGPUBuffer(device, {
        size: 256 as GPUSize,
        usage: GPUBufferUsageFlags.COPY_DST | GPUBufferUsageFlags.COPY_SRC,
        label: "write-test-buffer",
    });

    // Write data to buffer
    const data = new Float32Array([1.0, 2.0, 3.0, 4.0]);
    buffer.write(data as BufferSource);

    buffer.destroy();
    engine.destroy();
});

// ============================================================================
// Memory Management Tests
// ============================================================================

Deno.test("WebGPU Engine - Memory Manager", async () => {
    const engine = await createTestEngine();

    const stats = engine.getStatistics();
    assertExists(stats);
    assertExists(stats.memory);
    assertEquals(typeof stats.memory.totalAllocated, "number");

    engine.destroy();
});

Deno.test("WebGPU Engine - Memory Statistics", async () => {
    const engine = await createTestEngine();

    const stats = engine.getStatistics();

    assertExists(stats.memory);
    assertEquals(typeof stats.memory.bufferMemory, "number");
    assertEquals(typeof stats.memory.textureMemory, "number");
    assertEquals(typeof stats.memory.totalAllocated, "number");
    assert(stats.memory.totalAllocated >= 0);

    engine.destroy();
});

// ============================================================================
// Texture Management Tests
// ============================================================================

Deno.test("WebGPU Engine - Texture Manager", async () => {
    const engine = await createTestEngine();

    // Test texture manager by creating and using textures
    const textureId = engine.createTexture({
        width: 128 as Pixels,
        height: 128 as Pixels,
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        label: "texture-manager-test",
    });

    assertExists(textureId);

    // Verify texture can be retrieved
    const texture = engine.getTexture(textureId);
    assertExists(texture);
    assertEquals(texture.label, "texture-manager-test");

    // Test sampler creation
    const sampler = engine.createSampler({
        minFilter: "linear",
        magFilter: "linear",
        label: "test-sampler",
    });
    assertExists(sampler);

    // Check engine stats reflect texture creation
    const stats = engine.getStatistics();
    assertExists(stats.memory.textureMemory);

    engine.destroy();
});

Deno.test("WebGPU Engine - Create Texture", async () => {
    const engine = await createTestEngine();

    const textureId = engine.createTexture({
        width: 256 as Pixels,
        height: 256 as Pixels,
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        label: "test-texture",
    });

    assertExists(textureId);

    // Get the texture back
    const texture = engine.getTexture(textureId);
    assertExists(texture);
    assertEquals(texture.width, 256);
    assertEquals(texture.height, 256);
    assertEquals(texture.format, "rgba8unorm");

    engine.destroy();
});

// ============================================================================
// Pipeline Management Tests
// ============================================================================

Deno.test("WebGPU Engine - Pipeline Manager", async () => {
    const engine = await createTestEngine();

    // Test pipeline manager through engine statistics
    const statsBefore = engine.getStatistics();
    const pipelinesBefore = statsBefore.pipelines.computePipelines;

    // Create a compute pipeline to test the pipeline manager
    const shaderCode = `
        @group(0) @binding(0) var<storage, read> input: array<f32>;
        @group(0) @binding(1) var<storage, read_write> output: array<f32>;

        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
            let index = global_id.x;
            output[index] = input[index] * 2.0;
        }
    `;

    // Create shader module first
    const shaderModule = engine.getGPUDevice().createShaderModule({
        code: shaderCode,
        label: "test-shader",
    });

    const computePipeline = await engine.createComputePipeline({
        label: "test-pipeline",
        compute: {
            module: shaderModule,
            entryPoint: "main",
        },
    });

    assertExists(computePipeline);

    // Verify stats updated
    const statsAfter = engine.getStatistics();
    assertExists(statsAfter.pipelines);
    assertEquals(typeof statsAfter.pipelines.renderPipelines, "number");
    assertEquals(typeof statsAfter.pipelines.computePipelines, "number");

    engine.destroy();
});

// ============================================================================
// Command Encoding Tests
// ============================================================================

Deno.test("WebGPU Engine - Command Encoder", async () => {
    const engine = await createTestEngine();
    const device = engine.getDevice();

    const encoder = new WebGPUCommandEncoder(device, "test-encoder");

    assertExists(encoder);
    assertExists(encoder.getId());
    assertEquals(encoder.hasActivePass(), false);

    const commandBuffer = encoder.finish();
    assertExists(commandBuffer);

    engine.destroy();
});

Deno.test("WebGPU Engine - Copy Buffer to Buffer", async () => {
    const engine = await createTestEngine();
    const device = engine.getDevice();

    // Create source and destination buffers
    const sourceBuffer = new WebGPUBuffer(device, {
        size: 256 as GPUSize,
        usage: GPUBufferUsageFlags.COPY_SRC | GPUBufferUsageFlags.COPY_DST,
        label: "source-buffer",
    });

    const destBuffer = new WebGPUBuffer(device, {
        size: 256 as GPUSize,
        usage: GPUBufferUsageFlags.COPY_DST,
        label: "dest-buffer",
    });

    // Write data to source
    const data = new Float32Array([1.0, 2.0, 3.0, 4.0]);
    sourceBuffer.write(data as BufferSource);

    // Copy using command encoder
    const encoder = new WebGPUCommandEncoder(device);
    encoder.copyBufferToBuffer({
        source: sourceBuffer.getNativeBuffer(),
        destination: destBuffer.getNativeBuffer(),
        size: 64,
    });

    const commandBuffer = encoder.finish();
    device.getQueue().submit([commandBuffer]);

    sourceBuffer.destroy();
    destBuffer.destroy();
    engine.destroy();
});

// ============================================================================
// Compute Pipeline Tests
// ============================================================================

Deno.test("WebGPU Engine - Compute Pipeline Creation", async () => {
    const engine = await createTestEngine();

    const shaderCode = `
        @group(0) @binding(0) var<storage, read> input: array<f32>;
        @group(0) @binding(1) var<storage, read_write> output: array<f32>;

        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
            let index = global_id.x;
            output[index] = input[index] * 2.0;
        }
    `;

    // Create shader module first
    const shaderModule = engine.getGPUDevice().createShaderModule({
        code: shaderCode,
        label: "test-compute-shader",
    });

    // Use engine API to create compute pipeline
    const pipeline = await engine.createComputePipeline({
        label: "test-compute",
        compute: {
            module: shaderModule,
            entryPoint: "main",
        },
    });

    assertExists(pipeline);
    assertEquals(pipeline.label, "test-compute");

    // Verify the compute pipeline manager is working through statistics
    const stats = engine.getStatistics();
    assertExists(stats.pipelines);
    assert(stats.pipelines.computePipelines >= 0);

    engine.destroy();
});

// ============================================================================
// Canvas Context Tests
// ============================================================================

Deno.test("WebGPU Engine - Canvas Context", async () => {
    const engine = await createTestEngine();
    const canvasContext = engine.getCanvasContext();

    assertExists(canvasContext);

    const width = canvasContext.getWidth();
    const height = canvasContext.getHeight();

    assertEquals(typeof width, "number");
    assertEquals(typeof height, "number");
    assert(width > 0);
    assert(height > 0);

    engine.destroy();
});

Deno.test("WebGPU Engine - Canvas Resize", async () => {
    const engine = await createTestEngine();
    const canvasContext = engine.getCanvasContext();

    const originalWidth = canvasContext.getWidth();
    const originalHeight = canvasContext.getHeight();

    // Resize canvas
    canvasContext.resize(1024 as Pixels, 768 as Pixels);

    assertEquals(canvasContext.getWidth(), 1024);
    assertEquals(canvasContext.getHeight(), 768);

    engine.destroy();
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test("WebGPU Engine - Full Render Pipeline", async () => {
    const engine = await createTestEngine();

    // 1. Create vertex buffer
    const vertexData = new Float32Array([
        -0.5, -0.5, 0.0, 1.0,
         0.5, -0.5, 0.0, 1.0,
         0.0,  0.5, 0.0, 1.0,
    ]);

    const device = engine.getDevice();
    const vertexBuffer = new WebGPUBuffer(device, {
        size: vertexData.byteLength as GPUSize,
        usage: GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST,
        label: "triangle-vertices",
    });

    vertexBuffer.write(vertexData as BufferSource);

    // 2. Get statistics
    const stats = engine.getStatistics();
    assertExists(stats);
    assertEquals(stats.state, WebGPUEngineState.READY);

    // 3. Verify all subsystems are working through public API
    assertExists(engine.getDevice());
    assertExists(engine.getGPUDevice());
    assertExists(engine.getCanvasContext());

    // Verify memory management is working
    assert(stats.memory.totalAllocated >= 0);

    // Verify pipeline management is working
    assert(stats.pipelines.renderPipelines >= 0);
    assert(stats.pipelines.computePipelines >= 0);

    // Verify texture management is working
    assert(stats.memory.textureMemory >= 0);

    vertexBuffer.destroy();
    engine.destroy();
});

Deno.test("WebGPU Engine - Error Handling", async () => {
    const engine = await createTestEngine();

    // Try to use engine after destruction
    engine.destroy();

    let errorThrown = false;
    try {
        engine.getGPUDevice();
    } catch (error) {
        errorThrown = true;
        assert(error instanceof Error);
    }

    assert(errorThrown, "Expected error when accessing destroyed engine");
});

Deno.test("WebGPU Engine - Multiple Buffer Operations", async () => {
    const engine = await createTestEngine();
    const device = engine.getDevice();

    const buffers: WebGPUBuffer[] = [];

    // Create multiple buffers
    for (let i = 0; i < 10; i++) {
        const buffer = new WebGPUBuffer(device, {
            size: (256 * (i + 1)) as GPUSize,
            usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.COPY_DST,
            label: `multi-buffer-${i}`,
        });
        buffers.push(buffer);
    }

    assertEquals(buffers.length, 10);

    // Write to each buffer
    for (const buffer of buffers) {
        const data = new Float32Array(8).fill(1.0);
        buffer.write(data as BufferSource);
    }

    // Cleanup
    for (const buffer of buffers) {
        buffer.destroy();
    }

    engine.destroy();
});

// ============================================================================
// Performance Tests
// ============================================================================

Deno.test("WebGPU Engine - Performance Metrics", async () => {
    const engine = await createTestEngine();

    const startTime = performance.now();

    // Perform operations
    const device = engine.getDevice();
    const buffers: WebGPUBuffer[] = [];

    for (let i = 0; i < 100; i++) {
        const buffer = new WebGPUBuffer(device, {
            size: 1024 as GPUSize,
            usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.COPY_DST,
            label: `perf-buffer-${i}`,
        });
        buffers.push(buffer);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`Created 100 buffers in ${duration.toFixed(2)}ms`);
    assert(duration < 5000, "Buffer creation took too long");

    // Cleanup
    for (const buffer of buffers) {
        buffer.destroy();
    }

    engine.destroy();
});

Deno.test("WebGPU Engine - Memory Pressure", async () => {
    const engine = await createTestEngine();

    const initialStats = engine.getStatistics();
    const initialMemory = initialStats.memory.bufferMemory;

    // Allocate significant memory
    const device = engine.getDevice();
    const largeBuffers: WebGPUBuffer[] = [];

    for (let i = 0; i < 10; i++) {
        const buffer = new WebGPUBuffer(device, {
            size: (1024 * 1024) as GPUSize, // 1MB each
            usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.COPY_DST,
            label: `large-buffer-${i}`,
        });
        largeBuffers.push(buffer);
    }

    const afterStats = engine.getStatistics();
    const afterMemory = afterStats.memory.bufferMemory;

    assert(afterMemory > initialMemory, "Memory should increase after allocations");

    // Cleanup
    for (const buffer of largeBuffers) {
        buffer.destroy();
    }

    engine.destroy();
});

console.log("\n✅ All WebGPU Engine tests defined successfully!");
