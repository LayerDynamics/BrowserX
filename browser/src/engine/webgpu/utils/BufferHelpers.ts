/**
 * Buffer Helpers
 *
 * Advanced buffer utilities using webgpu_x:
 * - StagingBelt arena allocator for efficient uploads
 * - Buffer alignment calculations
 * - Texture buffer sizing with GPU alignment
 *
 * @module webgpu/utils/BufferHelpers
 */

import { WebGPUX, type StagingWrite, type StagingBeltStats } from "@webgpu_x";

// Lazy singleton
let webgpuXInstance: WebGPUX | null = null;

function getWebGPUX(): WebGPUX {
    if (!webgpuXInstance) {
        webgpuXInstance = new WebGPUX();
    }
    return webgpuXInstance;
}

// ============================================================================
// StagingBelt Arena Allocator
// ============================================================================

/**
 * Create staging belt for efficient large buffer uploads
 *
 * @param chunkSize - Chunk size in bytes (default 256KB)
 * @returns Belt handle ID
 */
export function createStagingBelt(chunkSize: number = 256 * 1024): bigint {
    const webgpuX = getWebGPUX();
    return webgpuX.createStagingBelt(BigInt(chunkSize));
}

/**
 * Write data to staging belt
 *
 * @param beltHandle - Belt handle from createStagingBelt
 * @param size - Size to allocate in bytes
 * @returns Write descriptor with buffer handle and offset
 */
export function stagingBeltWrite(beltHandle: bigint, size: bigint): StagingWrite | null {
    const webgpuX = getWebGPUX();
    return webgpuX.stagingBeltWrite(beltHandle, size);
}

/**
 * Finish current frame and recover completed buffers
 */
export function stagingBeltFinish(beltHandle: bigint): void {
    const webgpuX = getWebGPUX();
    webgpuX.stagingBeltFinish(beltHandle);
}

/**
 * Get staging belt statistics
 */
export function stagingBeltStats(beltHandle: bigint): StagingBeltStats | null {
    const webgpuX = getWebGPUX();
    return webgpuX.stagingBeltStats(beltHandle);
}

/**
 * Destroy staging belt and release resources
 */
export function destroyStagingBelt(beltHandle: bigint): void {
    const webgpuX = getWebGPUX();
    webgpuX.destroyStagingBelt(beltHandle);
}

// ============================================================================
// Buffer Alignment
// ============================================================================

/**
 * Calculate aligned buffer size
 *
 * @param size - Original size in bytes
 * @param alignment - Alignment requirement (4 or 256 bytes)
 * @returns Aligned size
 */
export function calculateAlignedSize(size: bigint, alignment: bigint): bigint {
    const webgpuX = getWebGPUX();
    return webgpuX.bufferCalculateAlignedSize(size, alignment);
}

/**
 * Get alignment requirement for buffer usage flags
 *
 * @param usage - GPUBufferUsage flags
 * @returns Required alignment (4 or 256 bytes)
 */
export function getBufferAlignment(usage: number): bigint {
    const webgpuX = getWebGPUX();
    return webgpuX.bufferGetAlignment(usage);
}

// ============================================================================
// Texture Buffer Sizing
// ============================================================================

/**
 * Calculate texture buffer size with GPU alignment
 *
 * @param width - Texture width in pixels
 * @param height - Texture height in pixels
 * @param bytesPerPixel - Bytes per pixel (4 for RGBA8)
 * @returns Total buffer size with row padding
 */
export function calculateTextureBufferSize(
    width: number,
    height: number,
    bytesPerPixel: number
): bigint {
    const webgpuX = getWebGPUX();
    return webgpuX.bufferCalculateTextureBufferSize(width, height, bytesPerPixel);
}

/**
 * Get row padding for texture copies
 *
 * @param rowSize - Row size in bytes
 * @returns Padding bytes needed for 256-byte alignment
 */
export function getRowPadding(rowSize: bigint): bigint {
    const webgpuX = getWebGPUX();
    return webgpuX.bufferGetRowPadding(rowSize);
}

/**
 * Get padded row size for texture copies
 *
 * @param rowSize - Original row size in bytes
 * @returns Padded row size (aligned to 256 bytes)
 */
export function getPaddedRowSize(rowSize: bigint): bigint {
    const webgpuX = getWebGPUX();
    return webgpuX.bufferGetPaddedRowSize(rowSize);
}

// Re-export types
export type { StagingWrite, StagingBeltStats };
