/**
 * Tensor Helpers
 *
 * Tensor operations using webgpu_x:
 * - Multi-dimensional tensor metadata
 * - Shape operations (reshape, transpose)
 * - Tensor views with offsets
 *
 * @module webgpu/utils/TensorHelpers
 */

import { WebGPUX, TensorDType, TensorAccess, type TensorMeta } from "@webgpu_x";

let webgpuXInstance: WebGPUX | null = null;

function getWebGPUX(): WebGPUX {
    if (!webgpuXInstance) {
        webgpuXInstance = new WebGPUX();
    }
    return webgpuXInstance;
}

/**
 * Create tensor metadata
 *
 * @param bufferHandle - GPU buffer handle
 * @param shape - Tensor dimensions [batch, height, width, channels]
 * @param dtype - Data type
 * @param access - Access pattern
 * @returns Tensor metadata or null if failed
 */
export function createTensor(
    bufferHandle: bigint,
    shape: number[],
    dtype: TensorDType,
    access: TensorAccess
): TensorMeta | null {
    const webgpuX = getWebGPUX();
    return webgpuX.tensorCreate(bufferHandle, shape, dtype, access);
}

/**
 * Get tensor size in bytes
 */
export function tensorSizeBytes(tensor: TensorMeta): bigint {
    const webgpuX = getWebGPUX();
    return webgpuX.tensorSizeBytes(tensor);
}

/**
 * Get tensor rank (number of dimensions)
 */
export function tensorRank(tensor: TensorMeta): number {
    const webgpuX = getWebGPUX();
    return webgpuX.tensorRank(tensor);
}

/**
 * Get total number of elements
 */
export function tensorTotalElements(tensor: TensorMeta): bigint {
    const webgpuX = getWebGPUX();
    return webgpuX.tensorTotalElements(tensor);
}

/**
 * Reshape tensor to new dimensions
 *
 * @param tensor - Original tensor
 * @param newShape - New dimensions (must have same total elements)
 * @returns Reshaped tensor or null if invalid
 */
export function tensorReshape(tensor: TensorMeta, newShape: number[]): TensorMeta | null {
    const webgpuX = getWebGPUX();
    return webgpuX.tensorReshape(tensor, newShape);
}

/**
 * Transpose 2D tensor
 *
 * @param tensor - 2D tensor to transpose
 * @returns Transposed tensor or null if not 2D
 */
export function tensorTranspose2D(tensor: TensorMeta): TensorMeta | null {
    const webgpuX = getWebGPUX();
    return webgpuX.tensorTranspose2D(tensor);
}

/**
 * Create tensor view with offset
 *
 * @param tensor - Original tensor
 * @param offset - Byte offset into buffer
 * @returns Tensor view or null if invalid
 */
export function tensorView(tensor: TensorMeta, offset: bigint): TensorMeta | null {
    const webgpuX = getWebGPUX();
    return webgpuX.tensorView(tensor, offset);
}

/**
 * Check if tensor memory is contiguous
 */
export function tensorIsContiguous(tensor: TensorMeta): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.tensorIsContiguous(tensor);
}

// Re-export types and enums
export { TensorDType, TensorAccess };
export type { TensorMeta };
