/**
 * Tests for WebGPU Memory Management
 */

import { assertEquals, assertExists } from "@std/assert";
import {
    BufferPool,
    StagingRing,
    MemoryAllocator,
    MemoryManager,
} from "../../../../src/engine/webgpu/memory/mod.ts";
import { WebGPUDevice } from "../../../../src/engine/webgpu/adapter/Device.ts";
import { GPUBufferUsageFlags } from "../../../../src/types/webgpu.ts";

const webgpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;

if (webgpuAvailable) {
    let device: WebGPUDevice;

    async function setup() {
        device = new WebGPUDevice();
        await device.initialize();
    }

    function teardown() {
        device?.destroy();
    }

    // BufferPool Tests

    Deno.test("BufferPool - acquires buffer from pool", async () => {
        await setup();

        const pool = new BufferPool(device);
        const buffer = pool.acquire(
            1024 as any,
            GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST,
        );

        assertExists(buffer);
        assertEquals(buffer.getSize() >= 1024, true);

        pool.release(buffer);
        pool.destroy();
        teardown();
    });

    Deno.test("BufferPool - reuses released buffers", async () => {
        await setup();

        const pool = new BufferPool(device);

        const buffer1 = pool.acquire(
            1024 as any,
            GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST,
        );
        pool.release(buffer1);

        const buffer2 = pool.acquire(
            1024 as any,
            GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST,
        );

        // Should reuse the same buffer
        assertEquals(buffer1, buffer2);

        pool.release(buffer2);
        pool.destroy();
        teardown();
    });

    Deno.test("BufferPool - tracks pool statistics", async () => {
        await setup();

        const pool = new BufferPool(device);

        const buffer = pool.acquire(
            2048 as any,
            GPUBufferUsageFlags.UNIFORM | GPUBufferUsageFlags.COPY_DST,
        );

        const stats = pool.getStatistics();
        assertExists(stats);
        assertEquals(typeof stats.totalBuffers, "number");
        assertEquals(typeof stats.inUseBuffers, "number");
        assertEquals(typeof stats.poolHits, "number");
        assertEquals(typeof stats.poolMisses, "number");
        assertEquals(typeof stats.hitRate, "number");

        pool.release(buffer);
        pool.destroy();
        teardown();
    });

    Deno.test("BufferPool - handles multiple buffer sizes", async () => {
        await setup();

        const pool = new BufferPool(device);

        const buffer1k = pool.acquire(
            1024 as any,
            GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST,
        );
        const buffer2k = pool.acquire(
            2048 as any,
            GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST,
        );
        const buffer4k = pool.acquire(
            4096 as any,
            GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST,
        );

        assertEquals(buffer1k.getSize(), 1024);
        assertEquals(buffer2k.getSize(), 2048);
        assertEquals(buffer4k.getSize(), 4096);

        pool.release(buffer1k);
        pool.release(buffer2k);
        pool.release(buffer4k);
        pool.destroy();
        teardown();
    });

    Deno.test("BufferPool - trim removes idle buffers", async () => {
        await setup();

        const pool = new BufferPool(device, {
            enableAutoTrim: false,
        });

        const buffer = pool.acquire(
            1024 as any,
            GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST,
        );
        pool.release(buffer);

        pool.trim();

        const stats = pool.getStatistics();
        // After trimming, idle buffers should be reduced
        assertExists(stats);

        pool.destroy();
        teardown();
    });

    Deno.test("BufferPool - clear destroys all buffers", async () => {
        await setup();

        const pool = new BufferPool(device);

        pool.acquire(
            1024 as any,
            GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST,
        );
        pool.acquire(
            2048 as any,
            GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST,
        );

        pool.clear();

        const stats = pool.getStatistics();
        assertEquals(stats.totalBuffers, 0);

        pool.destroy();
        teardown();
    });

    // StagingRing Tests

    Deno.test("StagingRing - allocates staging memory", async () => {
        await setup();

        const ring = new StagingRing(device);

        const allocation = ring.allocate(1024 as any);

        assertExists(allocation);
        assertExists(allocation.buffer);
        assertEquals(typeof allocation.offset, "number");
        assertEquals(allocation.size, 1024);

        ring.destroy();
        teardown();
    });

    Deno.test("StagingRing - allocations are sequential", async () => {
        await setup();

        const ring = new StagingRing(device);

        const alloc1 = ring.allocate(256 as any);
        const alloc2 = ring.allocate(512 as any);

        assertEquals(alloc1.offset, 0);
        assertEquals(alloc2.offset >= alloc1.size, true);

        ring.destroy();
        teardown();
    });

    Deno.test("StagingRing - advances frame", async () => {
        await setup();

        const ring = new StagingRing(device);

        const initialFrame = ring.getCurrentFrame();
        ring.advanceFrame();
        const nextFrame = ring.getCurrentFrame();

        assertEquals(nextFrame, (initialFrame + 1) % ring.getFrameCount());

        ring.destroy();
        teardown();
    });

    Deno.test("StagingRing - wraps around after frame count", async () => {
        await setup();

        const ring = new StagingRing(device, { frameCount: 3 });

        for (let i = 0; i < 10; i++) {
            ring.advanceFrame();
        }

        const frame = ring.getCurrentFrame();
        assertEquals(frame >= 0 && frame < 3, true);

        ring.destroy();
        teardown();
    });

    Deno.test("StagingRing - respects alignment", async () => {
        await setup();

        const ring = new StagingRing(device);

        const alloc1 = ring.allocate(1 as any, 256);
        assertEquals(alloc1.offset % 256, 0);

        const alloc2 = ring.allocate(1 as any, 16);
        assertEquals(alloc2.offset % 16, 0);

        ring.destroy();
        teardown();
    });

    // MemoryAllocator Tests

    Deno.test("MemoryAllocator - allocates from backing buffer", async () => {
        await setup();

        const allocator = new MemoryAllocator(device, {
            size: (1024 * 1024) as any, // 1MB
            usage: GPUBufferUsageFlags.STORAGE |
                GPUBufferUsageFlags.COPY_DST |
                GPUBufferUsageFlags.COPY_SRC,
        });

        const allocation = allocator.allocate(4096 as any);

        assertExists(allocation);
        assertExists(allocation.buffer);
        assertEquals(typeof allocation.id, "number");
        assertEquals(allocation.size, 4096);

        allocator.free(allocation);
        allocator.destroy();
        teardown();
    });

    Deno.test("MemoryAllocator - reuses freed memory", async () => {
        await setup();

        const allocator = new MemoryAllocator(device, {
            size: (64 * 1024) as any,
            usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.COPY_DST,
        });

        const alloc1 = allocator.allocate(1024 as any);
        assertExists(alloc1);

        allocator.free(alloc1);

        const alloc2 = allocator.allocate(1024 as any);
        assertExists(alloc2);

        // Should reuse the freed memory
        assertEquals(alloc2.offset, alloc1.offset);

        allocator.free(alloc2);
        allocator.destroy();
        teardown();
    });

    Deno.test("MemoryAllocator - tracks fragmentation", async () => {
        await setup();

        const allocator = new MemoryAllocator(device, {
            size: (64 * 1024) as any,
            usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.COPY_DST,
        });

        const alloc1 = allocator.allocate(1024 as any);
        const alloc2 = allocator.allocate(1024 as any);
        const alloc3 = allocator.allocate(1024 as any);

        assertExists(alloc1);
        assertExists(alloc2);
        assertExists(alloc3);

        // Free middle allocation to create fragmentation
        allocator.free(alloc2);

        const fragmentation = allocator.getFragmentation();
        assertEquals(typeof fragmentation, "number");

        allocator.free(alloc1);
        allocator.free(alloc3);
        allocator.destroy();
        teardown();
    });

    Deno.test("MemoryAllocator - getUsage returns memory usage", async () => {
        await setup();

        const allocator = new MemoryAllocator(device, {
            size: (64 * 1024) as any,
            usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.COPY_DST,
        });

        const usage = allocator.getUsage();
        assertExists(usage);
        assertEquals(typeof usage.total, "number");
        assertEquals(typeof usage.used, "number");
        assertEquals(typeof usage.free, "number");
        assertEquals(typeof usage.allocations, "number");
        assertEquals(typeof usage.blocks, "number");

        allocator.destroy();
        teardown();
    });

    Deno.test("MemoryAllocator - clear frees all allocations", async () => {
        await setup();

        const allocator = new MemoryAllocator(device, {
            size: (64 * 1024) as any,
            usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.COPY_DST,
        });

        allocator.allocate(1024 as any);
        allocator.allocate(2048 as any);

        allocator.clear();

        const usage = allocator.getUsage();
        assertEquals(usage.allocations, 0);
        assertEquals(usage.used, 0);

        allocator.destroy();
        teardown();
    });

    // MemoryManager Tests

    Deno.test("MemoryManager - integrates buffer pool and staging ring", async () => {
        await setup();

        const manager = new MemoryManager(device);

        assertExists(manager.bufferPool);
        assertExists(manager.stagingRing);

        manager.destroy();
        teardown();
    });

    Deno.test("MemoryManager - acquireBuffer uses buffer pool", async () => {
        await setup();

        const manager = new MemoryManager(device);

        const buffer = manager.acquireBuffer(
            1024 as any,
            GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST,
        );

        assertExists(buffer);

        manager.releaseBuffer(buffer);
        manager.destroy();
        teardown();
    });

    Deno.test("MemoryManager - allocateStaging uses staging ring", async () => {
        await setup();

        const manager = new MemoryManager(device);

        const allocation = manager.allocateStaging(512 as any);

        assertExists(allocation);
        assertExists(allocation.buffer);

        manager.destroy();
        teardown();
    });

    Deno.test("MemoryManager - advanceStagingFrame advances ring", async () => {
        await setup();

        const manager = new MemoryManager(device);

        const initialFrame = manager.stagingRing.getCurrentFrame();
        manager.advanceStagingFrame();
        const nextFrame = manager.stagingRing.getCurrentFrame();

        assertEquals(
            nextFrame,
            (initialFrame + 1) % manager.stagingRing.getFrameCount(),
        );

        manager.destroy();
        teardown();
    });

    Deno.test("MemoryManager - getStatistics returns unified stats", async () => {
        await setup();

        const manager = new MemoryManager(device);

        const stats = manager.getStatistics();

        assertExists(stats);
        assertExists(stats.bufferPool);
        assertExists(stats.stagingRing);
        assertEquals(typeof stats.stagingRing.size, "number");
        assertEquals(typeof stats.stagingRing.frameCount, "number");

        manager.destroy();
        teardown();
    });

    Deno.test("MemoryManager - with staging pool enabled", async () => {
        await setup();

        const manager = new MemoryManager(device, {
            enableStagingPool: true,
        });

        assertExists(manager.stagingPool);

        manager.destroy();
        teardown();
    });

    Deno.test("MemoryManager - with staging pool disabled", async () => {
        await setup();

        const manager = new MemoryManager(device, {
            enableStagingPool: false,
        });

        assertEquals(manager.stagingPool, null);

        manager.destroy();
        teardown();
    });
} else {
    Deno.test("Memory - WebGPU not available", () => {
        console.log("Skipping WebGPU memory tests - WebGPU not available");
        assertEquals(webgpuAvailable, false);
    });
}
