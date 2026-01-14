/**
 * Tests for WebGPU Buffer Operations
 */

import { assertEquals, assertExists, assertThrows } from "@std/assert";
import {
    WebGPUBuffer,
    BufferMapMode,
    createVertexBuffer,
    createIndexBuffer,
    createUniformBuffer,
    createStorageBuffer,
    createStagingBuffer,
    createReadbackBuffer,
} from "../../../../src/engine/webgpu/buffer/Create.ts";
import { WebGPUDevice } from "../../../../src/engine/webgpu/adapter/Device.ts";
import {
    GPUBufferState,
    GPUBufferUsageFlags,
} from "../../../../src/types/webgpu.ts";

const webgpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;

if (webgpuAvailable) {
    let device: WebGPUDevice;

    // Setup before tests
    async function setup() {
        device = new WebGPUDevice();
        await device.initialize();
    }

    // Teardown after tests
    function teardown() {
        device?.destroy();
    }

    Deno.test("Buffer - createVertexBuffer creates buffer with correct usage", async () => {
        await setup();

        const buffer = createVertexBuffer(device, 1024 as any, "Test Vertex Buffer");

        assertEquals(buffer.getSize(), 1024);
        assertEquals(buffer.getState(), GPUBufferState.UNMAPPED);
        assertEquals(
            (buffer.getUsage() & GPUBufferUsageFlags.VERTEX) !== 0,
            true,
        );
        assertEquals(
            (buffer.getUsage() & GPUBufferUsageFlags.COPY_DST) !== 0,
            true,
        );

        buffer.destroy();
        teardown();
    });

    Deno.test("Buffer - createIndexBuffer creates buffer with correct usage", async () => {
        await setup();

        const buffer = createIndexBuffer(device, 512 as any);

        assertEquals(buffer.getSize(), 512);
        assertEquals(
            (buffer.getUsage() & GPUBufferUsageFlags.INDEX) !== 0,
            true,
        );

        buffer.destroy();
        teardown();
    });

    Deno.test("Buffer - createUniformBuffer creates buffer with correct usage", async () => {
        await setup();

        const buffer = createUniformBuffer(device, 256 as any);

        assertEquals(buffer.getSize(), 256);
        assertEquals(
            (buffer.getUsage() & GPUBufferUsageFlags.UNIFORM) !== 0,
            true,
        );

        buffer.destroy();
        teardown();
    });

    Deno.test("Buffer - createStorageBuffer creates buffer with correct usage", async () => {
        await setup();

        const buffer = createStorageBuffer(device, 2048 as any);

        assertEquals(buffer.getSize(), 2048);
        assertEquals(
            (buffer.getUsage() & GPUBufferUsageFlags.STORAGE) !== 0,
            true,
        );

        buffer.destroy();
        teardown();
    });

    Deno.test("Buffer - createStagingBuffer creates buffer with correct usage", async () => {
        await setup();

        const buffer = createStagingBuffer(device, 1024 as any);

        assertEquals(buffer.getSize(), 1024);
        assertEquals(
            (buffer.getUsage() & GPUBufferUsageFlags.MAP_WRITE) !== 0,
            true,
        );
        assertEquals(
            (buffer.getUsage() & GPUBufferUsageFlags.COPY_SRC) !== 0,
            true,
        );

        buffer.destroy();
        teardown();
    });

    Deno.test("Buffer - createReadbackBuffer creates buffer with correct usage", async () => {
        await setup();

        const buffer = createReadbackBuffer(device, 512 as any);

        assertEquals(buffer.getSize(), 512);
        assertEquals(
            (buffer.getUsage() & GPUBufferUsageFlags.MAP_READ) !== 0,
            true,
        );
        assertEquals(
            (buffer.getUsage() & GPUBufferUsageFlags.COPY_DST) !== 0,
            true,
        );

        buffer.destroy();
        teardown();
    });

    Deno.test("Buffer - write uploads data to buffer", async () => {
        await setup();

        const buffer = createVertexBuffer(device, 64 as any);
        const data = new Float32Array([1, 2, 3, 4]);

        buffer.write(data);

        assertEquals(buffer.getState(), GPUBufferState.UNMAPPED);

        buffer.destroy();
        teardown();
    });

    Deno.test("Buffer - write with offset", async () => {
        await setup();

        const buffer = createVertexBuffer(device, 64 as any);
        const data = new Float32Array([1, 2, 3, 4]);

        buffer.write(data, 16);

        assertEquals(buffer.getState(), GPUBufferState.UNMAPPED);

        buffer.destroy();
        teardown();
    });

    Deno.test("Buffer - mapAsync for reading", async () => {
        await setup();

        const buffer = createReadbackBuffer(device, 64 as any);

        await buffer.mapAsync(BufferMapMode.READ);

        assertEquals(buffer.getState(), GPUBufferState.MAPPED_FOR_READING);
        assertEquals(buffer.isMapped(), true);

        const mappedData = buffer.getMappedRange();
        assertExists(mappedData);

        buffer.unmap();
        assertEquals(buffer.getState(), GPUBufferState.UNMAPPED);

        buffer.destroy();
        teardown();
    });

    Deno.test("Buffer - mapAsync for writing", async () => {
        await setup();

        const buffer = createStagingBuffer(device, 64 as any);

        await buffer.mapAsync(BufferMapMode.WRITE);

        assertEquals(buffer.getState(), GPUBufferState.MAPPED_FOR_WRITING);

        const mappedData = buffer.getMappedRange();
        assertExists(mappedData);

        // Write data
        const view = new Float32Array(mappedData);
        view[0] = 42;

        buffer.unmap();
        assertEquals(buffer.getState(), GPUBufferState.UNMAPPED);

        buffer.destroy();
        teardown();
    });

    Deno.test("Buffer - getMappedRange with offset and size", async () => {
        await setup();

        const buffer = createStagingBuffer(device, 64 as any);
        await buffer.mapAsync(BufferMapMode.WRITE);

        const mappedData = buffer.getMappedRange(16, 32);
        assertExists(mappedData);
        assertEquals(mappedData.byteLength, 32);

        buffer.unmap();
        buffer.destroy();
        teardown();
    });

    Deno.test("Buffer - destroy releases buffer", async () => {
        await setup();

        const buffer = createVertexBuffer(device, 64 as any);

        buffer.destroy();
        assertEquals(buffer.getState(), GPUBufferState.DESTROYED);

        teardown();
    });

    Deno.test("Buffer - multiple buffers can coexist", async () => {
        await setup();

        const buffer1 = createVertexBuffer(device, 64 as any);
        const buffer2 = createIndexBuffer(device, 32 as any);
        const buffer3 = createUniformBuffer(device, 256 as any);

        assertEquals(buffer1.getSize(), 64);
        assertEquals(buffer2.getSize(), 32);
        assertEquals(buffer3.getSize(), 256);

        buffer1.destroy();
        buffer2.destroy();
        buffer3.destroy();

        teardown();
    });

    Deno.test("Buffer - getStatistics returns buffer stats", async () => {
        await setup();

        const buffer = createVertexBuffer(device, 1024 as any);

        const stats = buffer.getStatistics();
        assertExists(stats);
        assertEquals(typeof stats.size, "number");
        assertEquals(typeof stats.usage, "number");
        assertEquals(typeof stats.state, "string");

        buffer.destroy();
        teardown();
    });
} else {
    Deno.test("Buffer - WebGPU not available", () => {
        console.log("Skipping WebGPU buffer tests - WebGPU not available");
        assertEquals(webgpuAvailable, false);
    });
}
