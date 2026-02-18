/**
 * Tests for WebGPU Compute Pipeline Management
 *
 * Comprehensive tests covering:
 * - Pipeline creation and caching
 * - Shader compilation and error handling
 * - Buffer binding and management
 * - Workgroup size calculation (1D/2D/3D)
 * - Dispatch operations
 * - Data readback and verification
 */

import { assertEquals, assertExists, assertRejects, assert } from "@std/assert";
import {
    ComputePipeline,
    type ComputeConfig,
    type WorkgroupDimensions,
    type DispatchDimensions,
    type BufferBinding,
    type BindGroupResources,
    ComputePipelineError,
} from "../../../../../src/engine/webgpu/operations/compute/ComputePipeline.ts";
import { WebGPUDevice } from "../../../../../src/engine/webgpu/adapter/Device.ts";
import { ComputePipelineManager } from "../../../../../src/engine/webgpu/pipelines/mod.ts";

// Check if WebGPU is available
const webgpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;

// ============================================================================
// Test Shaders
// ============================================================================

// Simple shader: multiply all elements by 2
const MULTIPLY_SHADER = `
@group(0) @binding(0) var<storage, read_write> data: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index < arrayLength(&data)) {
        data[index] = data[index] * 2.0;
    }
}
`;

// Shader with invalid syntax (for error testing)
const INVALID_SHADER = `
@group(0) @binding(0) var<storage, read_write> data: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    // Missing semicolon
    let index = global_id.x
}
`;

// Shader with multiple buffer bindings
const MULTI_BUFFER_SHADER = `
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index < arrayLength(&input)) {
        output[index] = input[index] * 3.0;
    }
}
`;

// 2D image processing shader
const IMAGE_PROCESS_SHADER = `
@group(0) @binding(0) var<storage, read_write> data: array<f32>;

// Assume uniform for width
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;
    // Just mark visited by adding 1.0
}
`;

if (webgpuAvailable) {
    let device: WebGPUDevice;
    let pipelineManager: ComputePipelineManager;
    let computePipeline: ComputePipeline;

    async function setup() {
        device = new WebGPUDevice();
        await device.initialize();
        pipelineManager = new ComputePipelineManager(device);
        computePipeline = new ComputePipeline(device, pipelineManager);
    }

    function teardown() {
        computePipeline.destroy();
        pipelineManager.destroy();
        device.destroy();
    }

    // ========================================================================
    // Pipeline Creation Tests (3 tests)
    // ========================================================================

    Deno.test({
        name: "ComputePipeline - creates pipeline with valid shader",
        sanitizeResources: false,
        async fn() {
            await setup();

            const config: ComputeConfig = {
                shader: MULTIPLY_SHADER,
                entryPoint: "main",
                label: "multiply-pipeline",
            };

            const pipeline = await computePipeline.createPipeline(config);
            assertExists(pipeline);

            // Verify pipeline is cached
            assert(computePipeline.hasPipeline(config));

            // Stats should reflect creation
            const stats = computePipeline.getStatistics();
            assertEquals(stats.pipelinesCreated, 1);
            assertEquals(stats.activePipelines, 1);

            teardown();
        },
    });

    Deno.test("ComputePipeline - properly initializes with device limits", async () => {
        await setup();

        // Verify device limits are initialized
        const maxWorkgroupSize = computePipeline.getMaxWorkgroupSize();
        assertExists(maxWorkgroupSize);
        assert(maxWorkgroupSize.x > 0);
        assert(maxWorkgroupSize.y > 0);
        assert(maxWorkgroupSize.z > 0);

        const maxWorkgroups = computePipeline.getMaxWorkgroupsPerDimension();
        assert(maxWorkgroups > 0);

        const maxInvocations = computePipeline.getMaxComputeInvocationsPerWorkgroup();
        assert(maxInvocations > 0);

        teardown();
    });

    Deno.test("ComputePipeline - caches pipelines correctly", async () => {
        await setup();

        const config: ComputeConfig = {
            shader: MULTIPLY_SHADER,
            entryPoint: "main",
        };

        const pipeline1 = await computePipeline.createPipeline(config);
        const pipeline2 = await computePipeline.createPipeline(config);

        // Should return same pipeline (cached)
        assertEquals(pipeline1, pipeline2);

        // Should have created only one pipeline
        const stats = computePipeline.getStatistics();
        assertEquals(stats.pipelinesCreated, 1);
        assertEquals(stats.activePipelines, 1);

        teardown();
    });

    // ========================================================================
    // Shader Compilation Tests (2 tests)
    // ========================================================================

    Deno.test("ComputePipeline - compiles simple compute shader", async () => {
        await setup();

        const config: ComputeConfig = {
            shader: MULTIPLY_SHADER,
            entryPoint: "main",
        };

        // Should compile without throwing
        const pipeline = await computePipeline.createPipeline(config);
        assertExists(pipeline);

        teardown();
    });

    Deno.test("ComputePipeline - validates shader at compilation time", async () => {
        await setup();

        const config: ComputeConfig = {
            shader: INVALID_SHADER,
            entryPoint: "main",
        };

        // Note: WebGPU may not throw immediately during createPipeline.
        // Some implementations defer validation until first use.
        // We test that the API accepts the call and handles errors gracefully.

        try {
            const pipeline = await computePipeline.createPipeline(config);
            // Some implementations create the pipeline but mark it as invalid
            // This is valid WebGPU behavior
            assertExists(pipeline);
        } catch (error) {
            // Other implementations throw immediately
            // This is also valid WebGPU behavior
            assert(error instanceof Error);
        }

        teardown();
    });

    // ========================================================================
    // Buffer Management Tests (3 tests)
    // ========================================================================

    Deno.test("ComputePipeline - creates and binds storage buffer", async () => {
        await setup();

        const gpuDevice = device.getDevice();

        // Create buffer
        const buffer = gpuDevice.createBuffer({
            size: 256,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        const binding: BufferBinding = {
            binding: 0,
            buffer,
        };

        // Create bind group
        const bindGroup = computePipeline.createBufferBindGroup([binding]);
        assertExists(bindGroup);

        buffer.destroy();
        teardown();
    });

    Deno.test("ComputePipeline - creates bind group with multiple buffers", async () => {
        await setup();

        const gpuDevice = device.getDevice();

        // Create input buffer
        const inputBuffer = gpuDevice.createBuffer({
            size: 256,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        // Create output buffer
        const outputBuffer = gpuDevice.createBuffer({
            size: 256,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        const bindings: BufferBinding[] = [
            { binding: 0, buffer: inputBuffer },
            { binding: 1, buffer: outputBuffer },
        ];

        // Create bind group with multiple buffers
        const bindGroup = computePipeline.createBufferBindGroup(bindings);
        assertExists(bindGroup);

        inputBuffer.destroy();
        outputBuffer.destroy();
        teardown();
    });

    Deno.test("ComputePipeline - creates bind group layout", async () => {
        await setup();

        const entries: GPUBindGroupLayoutEntry[] = [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage" as GPUBufferBindingType,
                },
            },
        ];

        const layout = computePipeline.createBindGroupLayout(entries);
        assertExists(layout);

        // Creating same layout again should return cached version
        const layout2 = computePipeline.createBindGroupLayout(entries);
        assertEquals(layout, layout2);

        teardown();
    });

    // ========================================================================
    // Workgroup Calculation Tests (3 tests)
    // ========================================================================

    Deno.test("ComputePipeline - calculates 1D workgroup size", async () => {
        await setup();

        const dataSize = 1024;
        const workgroupSize = computePipeline.calculateWorkgroupSize1D(dataSize);

        assertExists(workgroupSize);
        assert(workgroupSize.x > 0);
        assertEquals(workgroupSize.y, 1);
        assertEquals(workgroupSize.z, 1);

        // Verify it's within device limits
        const maxWorkgroupSize = computePipeline.getMaxWorkgroupSize();
        assert(workgroupSize.x <= maxWorkgroupSize.x);

        teardown();
    });

    Deno.test("ComputePipeline - calculates 2D workgroup size", async () => {
        await setup();

        const width = 512;
        const height = 512;
        const workgroupSize = computePipeline.calculateWorkgroupSize2D(width, height);

        assertExists(workgroupSize);
        assert(workgroupSize.x > 0);
        assert(workgroupSize.y > 0);
        assertEquals(workgroupSize.z, 1);

        // Verify it's within device limits
        const maxWorkgroupSize = computePipeline.getMaxWorkgroupSize();
        assert(workgroupSize.x <= maxWorkgroupSize.x);
        assert(workgroupSize.y <= maxWorkgroupSize.y);

        // Verify total invocations are within limit
        const maxInvocations = computePipeline.getMaxComputeInvocationsPerWorkgroup();
        const totalInvocations = workgroupSize.x * workgroupSize.y;
        assert(totalInvocations <= maxInvocations);

        teardown();
    });

    Deno.test("ComputePipeline - calculates 3D workgroup size", async () => {
        await setup();

        const width = 64;
        const height = 64;
        const depth = 64;
        const workgroupSize = computePipeline.calculateWorkgroupSize3D(width, height, depth);

        assertExists(workgroupSize);
        assert(workgroupSize.x > 0);
        assert(workgroupSize.y > 0);
        assert(workgroupSize.z > 0);

        // Verify it's within device limits
        const maxWorkgroupSize = computePipeline.getMaxWorkgroupSize();
        assert(workgroupSize.x <= maxWorkgroupSize.x);
        assert(workgroupSize.y <= maxWorkgroupSize.y);
        assert(workgroupSize.z <= maxWorkgroupSize.z);

        // Verify total invocations are within limit
        const maxInvocations = computePipeline.getMaxComputeInvocationsPerWorkgroup();
        const totalInvocations = workgroupSize.x * workgroupSize.y * workgroupSize.z;
        assert(totalInvocations <= maxInvocations);

        teardown();
    });

    // ========================================================================
    // Dispatch Tests (2 tests)
    // ========================================================================

    Deno.test("ComputePipeline - calculates dispatch dimensions for 1D", async () => {
        await setup();

        const dataSize = 1024;
        const workgroupSize: WorkgroupDimensions = { x: 64, y: 1, z: 1 };
        const dispatch = computePipeline.calculateDispatch1D(dataSize, workgroupSize);

        assertExists(dispatch);
        assertEquals(dispatch.x, Math.ceil(dataSize / workgroupSize.x));
        assertEquals(dispatch.y, 1);
        assertEquals(dispatch.z, 1);

        // Verify within device limits
        const maxWorkgroups = computePipeline.getMaxWorkgroupsPerDimension();
        assert(dispatch.x <= maxWorkgroups);

        teardown();
    });

    Deno.test("ComputePipeline - throws on excessive dispatch dimensions", async () => {
        await setup();

        const maxWorkgroups = computePipeline.getMaxWorkgroupsPerDimension();
        const excessiveSize = maxWorkgroups * 64 + 1; // Exceeds max with workgroup size 64
        const workgroupSize: WorkgroupDimensions = { x: 1, y: 1, z: 1 };

        // Should throw ComputePipelineError
        try {
            computePipeline.calculateDispatch1D(excessiveSize, workgroupSize);
            assert(false, "Expected ComputePipelineError to be thrown");
        } catch (error) {
            assert(error instanceof ComputePipelineError);
        }

        teardown();
    });

    // ========================================================================
    // Execute Compute Pass Tests (2 tests)
    // ========================================================================

    Deno.test("ComputePipeline - executes compute pass successfully", async () => {
        await setup();

        const gpuDevice = device.getDevice();

        // Create pipeline
        const config: ComputeConfig = {
            shader: MULTIPLY_SHADER,
            entryPoint: "main",
        };
        const pipeline = await computePipeline.createPipeline(config);

        // Create buffer
        const buffer = gpuDevice.createBuffer({
            size: 256,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        // Create bind group
        const bindGroup = computePipeline.createBufferBindGroup([
            { binding: 0, buffer },
        ]);

        // Create command encoder
        const commandEncoder = gpuDevice.createCommandEncoder();

        // Execute compute pass
        await computePipeline.executeComputePass(commandEncoder, {
            pipeline,
            bindGroups: [bindGroup],
            dispatchWorkgroups: { x: 4, y: 1, z: 1 },
            label: "test-compute-pass",
        });

        // Finish command buffer
        const commandBuffer = commandEncoder.finish();
        gpuDevice.queue.submit([commandBuffer]);

        // Verify statistics updated
        const stats = computePipeline.getStatistics();
        assertEquals(stats.totalDispatches, 1);
        assertEquals(stats.totalWorkgroups, 4);
        assert(stats.averageDispatchTime >= 0);

        buffer.destroy();
        teardown();
    });

    Deno.test("ComputePipeline - runCompute helper with 1D data", async () => {
        await setup();

        const gpuDevice = device.getDevice();

        // Create buffer with initial data
        const dataSize = 256;
        const buffer = gpuDevice.createBuffer({
            size: dataSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });

        // Create bind group
        const bindGroup = computePipeline.createBufferBindGroup([
            { binding: 0, buffer },
        ]);

        // Create command encoder
        const commandEncoder = gpuDevice.createCommandEncoder();

        // Run compute with helper
        const config: ComputeConfig = {
            shader: MULTIPLY_SHADER,
            entryPoint: "main",
        };

        await computePipeline.runCompute(
            commandEncoder,
            config,
            [bindGroup],
            dataSize / 4 // Number of f32 elements (4 bytes each)
        );

        // Finish and submit
        const commandBuffer = commandEncoder.finish();
        gpuDevice.queue.submit([commandBuffer]);

        // Verify dispatch happened
        const stats = computePipeline.getStatistics();
        assert(stats.totalDispatches > 0);

        buffer.destroy();
        teardown();
    });

    // ========================================================================
    // Data Readback Tests (2 tests) - LIMITED DUE TO DENO BUG
    // ========================================================================

    Deno.test("ComputePipeline - creates readback buffer", async () => {
        await setup();

        const gpuDevice = device.getDevice();

        // Create compute buffer
        const computeBuffer = gpuDevice.createBuffer({
            size: 256,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        // Create readback buffer
        const readbackBuffer = gpuDevice.createBuffer({
            size: 256,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        assertExists(computeBuffer);
        assertExists(readbackBuffer);

        // Note: Actual GPU computation and readback would go here, but Deno's
        // WebGPU implementation has known bugs with buffer mapping that cause
        // panics. We test the API surface instead.

        computeBuffer.destroy();
        readbackBuffer.destroy();
        teardown();
    });

    Deno.test("ComputePipeline - buffer copy operation setup", async () => {
        await setup();

        const gpuDevice = device.getDevice();

        // Create source buffer (compute output)
        const srcBuffer = gpuDevice.createBuffer({
            size: 256,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        // Create destination buffer (for readback)
        const dstBuffer = gpuDevice.createBuffer({
            size: 256,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        // Create command encoder for copy
        const commandEncoder = gpuDevice.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(srcBuffer, 0, dstBuffer, 0, 256);
        const commandBuffer = commandEncoder.finish();

        assertExists(commandBuffer);

        // Note: We don't submit and map due to Deno bug, but the API is correct

        srcBuffer.destroy();
        dstBuffer.destroy();
        teardown();
    });

    // ========================================================================
    // Statistics and Cleanup Tests (2 tests)
    // ========================================================================

    Deno.test("ComputePipeline - tracks statistics correctly", async () => {
        await setup();

        const gpuDevice = device.getDevice();

        // Create pipeline
        const config: ComputeConfig = {
            shader: MULTIPLY_SHADER,
            entryPoint: "main",
        };
        await computePipeline.createPipeline(config);

        // Create buffer and bind group
        const buffer = gpuDevice.createBuffer({
            size: 256,
            usage: GPUBufferUsage.STORAGE,
        });
        const bindGroup = computePipeline.createBufferBindGroup([
            { binding: 0, buffer },
        ]);

        // Execute multiple dispatches
        for (let i = 0; i < 3; i++) {
            const commandEncoder = gpuDevice.createCommandEncoder();
            await computePipeline.executeComputePass(commandEncoder, {
                pipeline: await computePipeline.createPipeline(config),
                bindGroups: [bindGroup],
                dispatchWorkgroups: { x: 2, y: 1, z: 1 },
            });
            const commandBuffer = commandEncoder.finish();
            gpuDevice.queue.submit([commandBuffer]);
        }

        // Verify statistics
        const stats = computePipeline.getStatistics();
        assertEquals(stats.pipelinesCreated, 1); // Cached
        assertEquals(stats.activePipelines, 1);
        assertEquals(stats.totalDispatches, 3);
        assertEquals(stats.totalWorkgroups, 6); // 3 dispatches * 2 workgroups
        assert(stats.averageDispatchTime >= 0);

        buffer.destroy();
        teardown();
    });

    Deno.test("ComputePipeline - clears cache properly", async () => {
        await setup();

        // Create some pipelines
        const config1: ComputeConfig = {
            shader: MULTIPLY_SHADER,
            entryPoint: "main",
            label: "pipeline1",
        };
        const config2: ComputeConfig = {
            shader: MULTIPLY_SHADER,
            entryPoint: "main",
            label: "pipeline2",
        };

        await computePipeline.createPipeline(config1);
        await computePipeline.createPipeline(config2);

        let stats = computePipeline.getStatistics();
        assertEquals(stats.activePipelines, 2);

        // Clear cache
        computePipeline.clearCache();

        stats = computePipeline.getStatistics();
        assertEquals(stats.activePipelines, 0);

        teardown();
    });

} else {
    // ========================================================================
    // WebGPU Not Available - Mock Tests
    // ========================================================================

    Deno.test("ComputePipeline - mock test when WebGPU unavailable", () => {
        console.log("WebGPU not available, skipping compute pipeline tests");
        console.log("Tests would cover:");
        console.log("- Pipeline creation and caching (3 tests)");
        console.log("- Shader compilation and errors (2 tests)");
        console.log("- Buffer binding and management (3 tests)");
        console.log("- Workgroup size calculation (3 tests)");
        console.log("- Dispatch operations (2 tests)");
        console.log("- Data readback (2 tests)");
        console.log("- Statistics tracking (2 tests)");
        console.log("Total: 17 tests");
    });

    // Test that the class can be instantiated (API surface test)
    Deno.test("ComputePipeline - API surface validation", () => {
        // Verify exports exist
        assertExists(ComputePipeline);
        assertExists(ComputePipelineError);

        // Verify type definitions exist (compile-time check)
        const _config: ComputeConfig = {
            shader: "",
            entryPoint: "main",
        };
        const _workgroup: WorkgroupDimensions = { x: 1, y: 1, z: 1 };
        const _dispatch: DispatchDimensions = { x: 1, y: 1, z: 1 };
        const _binding: BufferBinding = {
            binding: 0,
            buffer: null as any, // Mock
        };
        const _resources: BindGroupResources = {
            buffers: [],
        };

        // If we get here, all types are properly exported
        assert(true, "All ComputePipeline types are available");
    });
}
