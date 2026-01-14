/**
 * Command Encoder Tests
 *
 * Tests for WebGPU command encoder functionality.
 */

import { assert, assertEquals, assertExists, assertRejects } from "@std/assert";
import { describe, it, beforeAll } from "jsr:@std/testing@1/bdd";
import { WebGPUDevice } from "../../../../src/engine/webgpu/adapter/Device.ts";
import {
    WebGPUCommandEncoder,
    EncoderState,
    type RenderPassDescriptor,
    type ComputePassDescriptor,
    type CopyBufferToBufferDescriptor,
} from "../../../../src/engine/webgpu/encoder/mod.ts";
import { GPUEncoderError } from "../../../../src/engine/webgpu/errors.ts";

// Test helpers
let device: WebGPUDevice;

beforeAll(async () => {
    device = new WebGPUDevice();
    await device.initialize();
});

describe("WebGPUCommandEncoder", () => {
    describe("Encoder Creation", () => {
        it("should create encoder with default label", () => {
            const encoder = new WebGPUCommandEncoder(device);

            assertExists(encoder.getId());
            assertEquals(encoder.getState(), EncoderState.OPEN);
            assertExists(encoder.getEncoder());
        });

        it("should create encoder with custom label", () => {
            const encoder = new WebGPUCommandEncoder(device, "test-encoder");

            assertExists(encoder.getId());
            assertEquals(encoder.getState(), EncoderState.OPEN);
        });

        it("should initialize statistics to zero", () => {
            const encoder = new WebGPUCommandEncoder(device);
            const stats = encoder.getStatistics();

            assertEquals(stats.renderPassCount, 0);
            assertEquals(stats.computePassCount, 0);
            assertEquals(stats.copyOperationCount, 0);
            assertEquals(stats.commandBuffersSubmitted, 0);
        });
    });

    describe("Encoder State Management", () => {
        it("should track encoder state correctly", () => {
            const encoder = new WebGPUCommandEncoder(device);

            assertEquals(encoder.getState(), EncoderState.OPEN);
            assertEquals(encoder.isFinished(), false);
            assertEquals(encoder.hasError(), false);
            assertEquals(encoder.hasActivePass(), false);
        });

        it("should not access encoder after finished", () => {
            const encoder = new WebGPUCommandEncoder(device);
            encoder.finish();

            assertEquals(encoder.getState(), EncoderState.FINISHED);
            assertEquals(encoder.isFinished(), true);

            try {
                encoder.getEncoder();
                assert(false, "Should throw error");
            } catch (error) {
                assert(error instanceof GPUEncoderError);
            }
        });
    });

    describe("Render Pass Operations", () => {
        it("should begin and end render pass", () => {
            const encoder = new WebGPUCommandEncoder(device);

            // Create test texture for render target
            const texture = device.getDevice().createTexture({
                size: { width: 256, height: 256 },
                format: "bgra8unorm",
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });

            const descriptor: RenderPassDescriptor = {
                colorAttachments: [{
                    view: texture.createView(),
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                }],
            };

            const pass = encoder.beginRenderPass(descriptor);
            assertExists(pass);
            assertEquals(encoder.getState(), EncoderState.ENCODING_RENDER);
            assertEquals(encoder.hasActivePass(), true);
            assertExists(encoder.getCurrentRenderPass());

            encoder.endRenderPass();
            assertEquals(encoder.getState(), EncoderState.OPEN);
            assertEquals(encoder.hasActivePass(), false);
            assertEquals(encoder.getCurrentRenderPass(), null);

            const stats = encoder.getStatistics();
            assertEquals(stats.renderPassCount, 1);
        });

        it("should not begin render pass when another pass is active", () => {
            const encoder = new WebGPUCommandEncoder(device);

            const texture = device.getDevice().createTexture({
                size: { width: 256, height: 256 },
                format: "bgra8unorm",
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });

            const descriptor: RenderPassDescriptor = {
                colorAttachments: [{
                    view: texture.createView(),
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                }],
            };

            encoder.beginRenderPass(descriptor);

            try {
                encoder.beginRenderPass(descriptor);
                assert(false, "Should throw error");
            } catch (error) {
                assert(error instanceof GPUEncoderError);
            }
        });

        it("should not end render pass when none is active", () => {
            const encoder = new WebGPUCommandEncoder(device);

            try {
                encoder.endRenderPass();
                assert(false, "Should throw error");
            } catch (error) {
                assert(error instanceof GPUEncoderError);
            }
        });
    });

    describe("Compute Pass Operations", () => {
        it("should begin and end compute pass", () => {
            const encoder = new WebGPUCommandEncoder(device);

            const pass = encoder.beginComputePass();
            assertExists(pass);
            assertEquals(encoder.getState(), EncoderState.ENCODING_COMPUTE);
            assertEquals(encoder.hasActivePass(), true);
            assertExists(encoder.getCurrentComputePass());

            encoder.endComputePass();
            assertEquals(encoder.getState(), EncoderState.OPEN);
            assertEquals(encoder.hasActivePass(), false);
            assertEquals(encoder.getCurrentComputePass(), null);

            const stats = encoder.getStatistics();
            assertEquals(stats.computePassCount, 1);
        });

        it("should begin compute pass with descriptor", () => {
            const encoder = new WebGPUCommandEncoder(device);

            const descriptor: ComputePassDescriptor = {
                label: "test-compute-pass",
            };

            const pass = encoder.beginComputePass(descriptor);
            assertExists(pass);
            assertEquals(encoder.getState(), EncoderState.ENCODING_COMPUTE);
        });

        it("should not begin compute pass when another pass is active", () => {
            const encoder = new WebGPUCommandEncoder(device);

            encoder.beginComputePass();

            try {
                encoder.beginComputePass();
                assert(false, "Should throw error");
            } catch (error) {
                assert(error instanceof GPUEncoderError);
            }
        });

        it("should not end compute pass when none is active", () => {
            const encoder = new WebGPUCommandEncoder(device);

            try {
                encoder.endComputePass();
                assert(false, "Should throw error");
            } catch (error) {
                assert(error instanceof GPUEncoderError);
            }
        });
    });

    describe("Copy Operations", () => {
        it("should copy buffer to buffer", () => {
            const encoder = new WebGPUCommandEncoder(device);

            const sourceBuffer = device.getDevice().createBuffer({
                size: 256,
                usage: GPUBufferUsage.COPY_SRC,
            });

            const destBuffer = device.getDevice().createBuffer({
                size: 256,
                usage: GPUBufferUsage.COPY_DST,
            });

            const descriptor: CopyBufferToBufferDescriptor = {
                source: sourceBuffer,
                sourceOffset: 0,
                destination: destBuffer,
                destinationOffset: 0,
                size: 256,
            };

            encoder.copyBufferToBuffer(descriptor);

            const stats = encoder.getStatistics();
            assertEquals(stats.copyOperationCount, 1);
        });

        it("should not copy when not in open state", () => {
            const encoder = new WebGPUCommandEncoder(device);

            const buffer = device.getDevice().createBuffer({
                size: 256,
                usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
            });

            const descriptor: CopyBufferToBufferDescriptor = {
                source: buffer,
                destination: buffer,
                size: 128,
            };

            // Begin a pass to change state
            encoder.beginComputePass();

            try {
                encoder.copyBufferToBuffer(descriptor);
                assert(false, "Should throw error");
            } catch (error) {
                assert(error instanceof GPUEncoderError);
            }
        });
    });

    describe("Command Buffer Finishing", () => {
        it("should finish and return command buffer", () => {
            const encoder = new WebGPUCommandEncoder(device);

            const commandBuffer = encoder.finish();
            assertExists(commandBuffer);
            assertEquals(encoder.getState(), EncoderState.FINISHED);
            assertEquals(encoder.isFinished(), true);

            const stats = encoder.getStatistics();
            assertEquals(stats.commandBuffersSubmitted, 1);
        });

        it("should finish with custom label", () => {
            const encoder = new WebGPUCommandEncoder(device);

            const commandBuffer = encoder.finish({ label: "test-commands" });
            assertExists(commandBuffer);
            assertEquals(encoder.getState(), EncoderState.FINISHED);
        });

        it("should not finish when already finished", () => {
            const encoder = new WebGPUCommandEncoder(device);
            encoder.finish();

            try {
                encoder.finish();
                assert(false, "Should throw error");
            } catch (error) {
                assert(error instanceof GPUEncoderError);
            }
        });

        it("should not finish with active pass", () => {
            const encoder = new WebGPUCommandEncoder(device);
            encoder.beginComputePass();

            try {
                encoder.finish();
                assert(false, "Should throw error");
            } catch (error) {
                assert(error instanceof GPUEncoderError);
            }
        });
    });

    describe("Statistics Tracking", () => {
        it("should track multiple operations", () => {
            const encoder = new WebGPUCommandEncoder(device);

            // Create texture for render pass
            const texture = device.getDevice().createTexture({
                size: { width: 256, height: 256 },
                format: "bgra8unorm",
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });

            // Render pass
            const renderDescriptor: RenderPassDescriptor = {
                colorAttachments: [{
                    view: texture.createView(),
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                }],
            };
            encoder.beginRenderPass(renderDescriptor);
            encoder.endRenderPass();

            // Compute pass
            encoder.beginComputePass();
            encoder.endComputePass();

            // Copy operation
            const buffer1 = device.getDevice().createBuffer({
                size: 256,
                usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
            });
            const buffer2 = device.getDevice().createBuffer({
                size: 256,
                usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
            });

            encoder.copyBufferToBuffer({
                source: buffer1,
                destination: buffer2,
                size: 256,
            });

            const stats = encoder.getStatistics();
            assertEquals(stats.renderPassCount, 1);
            assertEquals(stats.computePassCount, 1);
            assertEquals(stats.copyOperationCount, 1);
            assertEquals(stats.commandBuffersSubmitted, 0);

            encoder.finish();
            const finalStats = encoder.getStatistics();
            assertEquals(finalStats.commandBuffersSubmitted, 1);
        });

        it("should calculate timing statistics", () => {
            const encoder = new WebGPUCommandEncoder(device);

            // Perform some operations
            encoder.beginComputePass();
            encoder.endComputePass();

            const stats = encoder.getStatistics();
            assert(stats.totalEncodingTime >= 0);
            assert(stats.averageEncodingTime >= 0);
        });
    });

    describe("Error Handling", () => {
        it("should transition to error state on invalid operation", () => {
            const encoder = new WebGPUCommandEncoder(device);

            // Try to end a pass that was never started
            try {
                encoder.endRenderPass();
            } catch (error) {
                assert(error instanceof GPUEncoderError);
            }

            // State should be ERROR
            assertEquals(encoder.getState(), EncoderState.ERROR);
            assertEquals(encoder.hasError(), true);
        });

        it("should not perform operations in error state", () => {
            const encoder = new WebGPUCommandEncoder(device);

            // Force error state
            try {
                encoder.endRenderPass();
            } catch {
                // Ignore
            }

            // Try to begin a compute pass
            try {
                encoder.beginComputePass();
                assert(false, "Should throw error");
            } catch (error) {
                assert(error instanceof GPUEncoderError);
            }
        });
    });

    describe("Integration Tests", () => {
        it("should handle complete render workflow", () => {
            const encoder = new WebGPUCommandEncoder(device, "render-workflow");

            const texture = device.getDevice().createTexture({
                size: { width: 256, height: 256 },
                format: "bgra8unorm",
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });

            const descriptor: RenderPassDescriptor = {
                colorAttachments: [{
                    view: texture.createView(),
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                }],
                label: "test-render-pass",
            };

            const pass = encoder.beginRenderPass(descriptor);
            // In real scenario, would record draw commands here
            encoder.endRenderPass();

            const commandBuffer = encoder.finish({ label: "render-commands" });
            assertExists(commandBuffer);

            // Submit to queue
            device.getDevice().queue.submit([commandBuffer]);

            const stats = encoder.getStatistics();
            assertEquals(stats.renderPassCount, 1);
            assertEquals(stats.commandBuffersSubmitted, 1);
        });

        it("should handle complete compute workflow", () => {
            const encoder = new WebGPUCommandEncoder(device, "compute-workflow");

            const descriptor: ComputePassDescriptor = {
                label: "test-compute-pass",
            };

            const pass = encoder.beginComputePass(descriptor);
            // In real scenario, would record compute dispatches here
            encoder.endComputePass();

            const commandBuffer = encoder.finish({ label: "compute-commands" });
            assertExists(commandBuffer);

            device.getDevice().queue.submit([commandBuffer]);

            const stats = encoder.getStatistics();
            assertEquals(stats.computePassCount, 1);
            assertEquals(stats.commandBuffersSubmitted, 1);
        });

        it("should handle mixed render and compute workflow", () => {
            const encoder = new WebGPUCommandEncoder(device, "mixed-workflow");

            // Compute pass
            encoder.beginComputePass({ label: "compute-1" });
            encoder.endComputePass();

            // Render pass
            const texture = device.getDevice().createTexture({
                size: { width: 256, height: 256 },
                format: "bgra8unorm",
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });

            encoder.beginRenderPass({
                colorAttachments: [{
                    view: texture.createView(),
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                }],
                label: "render-1",
            });
            encoder.endRenderPass();

            // Another compute pass
            encoder.beginComputePass({ label: "compute-2" });
            encoder.endComputePass();

            const commandBuffer = encoder.finish();
            assertExists(commandBuffer);

            const stats = encoder.getStatistics();
            assertEquals(stats.computePassCount, 2);
            assertEquals(stats.renderPassCount, 1);
        });
    });
});
