/**
 * Buffer Allocation Utilities
 *
 * Provides helper functions for allocating GPU buffers with data.
 */

import { WebGPUBuffer } from "./Create.ts";
import type { WebGPUDevice } from "../adapter/Device.ts";
import type { GPUSize } from "../../../types/webgpu.ts";
import { GPUBufferUsageFlags } from "../../../types/webgpu.ts";

/**
 * Buffer allocation result
 */
export interface BufferAllocation {
    buffer: WebGPUBuffer;
    size: GPUSize;
    usage: number;
}

/**
 * Allocate a GPU buffer
 */
export function allocateBuffer(
    device: WebGPUDevice,
    size: GPUSize,
    usage: number,
    label?: string
): BufferAllocation {
    const buffer = new WebGPUBuffer(device, { size, usage, label });
    return { buffer, size, usage };
}

/**
 * Allocate a GPU buffer and write initial data
 */
export function allocateBufferWithData(
    device: WebGPUDevice,
    data: ArrayBuffer | ArrayBufferView,
    usage: number,
    label?: string
): BufferAllocation {
    const size = data.byteLength;
    const buffer = new WebGPUBuffer(device, { size, usage, label });

    // Write initial data
    if (data instanceof ArrayBuffer) {
        buffer.write(new Uint8Array(data) as BufferSource);
    } else {
        // ArrayBufferView - cast to BufferSource for type compatibility
        buffer.write(data as BufferSource);
    }

    return { buffer, size, usage };
}
