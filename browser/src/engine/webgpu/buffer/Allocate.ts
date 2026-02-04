/**
 * Buffer Allocation Utilities
 *
 * Provides helper functions for allocating GPU buffers with data.
 * Integrates with webgpu_x buffer pool for efficient buffer reuse.
 */

import { WebGPUBuffer } from "./Create.ts";
import type { WebGPUDevice } from "../adapter/Device.ts";
import type { GPUSize } from "../../../types/webgpu.ts";
import { GPUBufferUsageFlags } from "../../../types/webgpu.ts";
import {
    bufferPoolAcquire,
    bufferPoolRelease,
    bufferPoolAdd,
    clearBufferPool,
    evictOldBuffers,
    calculateAlignedSize,
    getBufferAlignment,
} from "../utils/BufferHelpers.ts";

/**
 * Buffer allocation result
 */
export interface BufferAllocation {
    buffer: WebGPUBuffer;
    size: GPUSize;
    usage: number;
    /** Handle for buffer pool (if pooled) */
    poolHandle?: bigint;
}

/**
 * Buffer allocation options
 */
export interface BufferAllocationOptions {
    /** Use buffer pool for allocation (default: false) */
    usePool?: boolean;
    /** Align size to buffer usage requirements (default: true) */
    alignSize?: boolean;
}

// Track pooled buffers for release
const pooledBuffers: Map<WebGPUBuffer, bigint> = new Map();

/**
 * Allocate a GPU buffer
 *
 * Uses webgpu_x buffer pool when usePool is true for efficient buffer reuse.
 *
 * @param device - WebGPU device
 * @param size - Buffer size in bytes
 * @param usage - GPUBufferUsage flags
 * @param label - Optional debug label
 * @param options - Allocation options
 */
export function allocateBuffer(
    device: WebGPUDevice,
    size: GPUSize,
    usage: number,
    label?: string,
    options?: BufferAllocationOptions
): BufferAllocation {
    const usePool = options?.usePool ?? false;
    const shouldAlignSize = options?.alignSize ?? true;

    // Calculate aligned size if requested
    let alignedSize = size;
    if (shouldAlignSize) {
        const alignment = Number(getBufferAlignment(usage));
        alignedSize = Number(calculateAlignedSize(BigInt(size), BigInt(alignment))) as GPUSize;
    }

    if (usePool) {
        // Try to acquire from pool
        const handle = bufferPoolAcquire(BigInt(alignedSize), usage);
        if (handle !== 0n) {
            // Got a pooled buffer handle, create wrapper
            const buffer = new WebGPUBuffer(device, { size: alignedSize, usage, label });
            pooledBuffers.set(buffer, handle);
            return { buffer, size: alignedSize, usage, poolHandle: handle };
        }
        // Fall through to direct allocation if pool exhausted
    }

    // Direct allocation
    const buffer = new WebGPUBuffer(device, { size: alignedSize, usage, label });
    return { buffer, size: alignedSize, usage };
}

/**
 * Allocate a GPU buffer and write initial data
 *
 * @param device - WebGPU device
 * @param data - Initial data to write
 * @param usage - GPUBufferUsage flags
 * @param label - Optional debug label
 * @param options - Allocation options
 */
export function allocateBufferWithData(
    device: WebGPUDevice,
    data: ArrayBuffer | ArrayBufferView,
    usage: number,
    label?: string,
    options?: BufferAllocationOptions
): BufferAllocation {
    const size = data.byteLength as GPUSize;
    const allocation = allocateBuffer(device, size, usage, label, options);

    // Write initial data
    if (data instanceof ArrayBuffer) {
        allocation.buffer.write(new Uint8Array(data) as BufferSource);
    } else {
        // ArrayBufferView - cast to BufferSource for type compatibility
        allocation.buffer.write(data as BufferSource);
    }

    return allocation;
}

/**
 * Release a pooled buffer back to the pool
 *
 * Uses webgpu_x buffer pool for efficient reuse.
 *
 * @param allocation - Buffer allocation to release
 */
export function releaseBuffer(allocation: BufferAllocation): void {
    if (allocation.poolHandle) {
        // Release back to pool
        bufferPoolRelease(allocation.poolHandle);
        pooledBuffers.delete(allocation.buffer);
    }
    // Destroy the WebGPU buffer
    allocation.buffer.destroy();
}

/**
 * Add a buffer to the pool for future reuse
 *
 * @param buffer - WebGPU buffer to add
 * @param size - Buffer size
 * @param usage - Buffer usage flags
 * @returns Pool handle
 */
export function addToBufferPool(
    buffer: WebGPUBuffer,
    size: GPUSize,
    usage: number
): bigint {
    // Generate a unique handle for the buffer
    const handle = BigInt(Date.now() + Math.floor(Math.random() * 1000000));
    bufferPoolAdd(handle, BigInt(size), usage);
    pooledBuffers.set(buffer, handle);
    return handle;
}

/**
 * Clear all buffers from the pool
 *
 * Uses webgpu_x to clear the pool state.
 */
export function clearAllBufferPools(): void {
    clearBufferPool();
    pooledBuffers.clear();
}

/**
 * Evict old unused buffers from the pool
 *
 * Uses webgpu_x to evict stale buffers.
 */
export function evictStaleBuffers(): void {
    evictOldBuffers();
}

/**
 * Check if a buffer is pooled
 *
 * @param buffer - Buffer to check
 * @returns True if buffer is in pool
 */
export function isBufferPooled(buffer: WebGPUBuffer): boolean {
    return pooledBuffers.has(buffer);
}

/**
 * Get pool handle for a buffer
 *
 * @param buffer - Buffer to check
 * @returns Pool handle or undefined
 */
export function getBufferPoolHandle(buffer: WebGPUBuffer): bigint | undefined {
    return pooledBuffers.get(buffer);
}
