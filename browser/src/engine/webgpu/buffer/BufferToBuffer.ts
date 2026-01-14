/**
 * Buffer-to-Buffer Operations
 *
 * Optimized buffer copying operations.
 */

import { copyBufferToBuffer } from "./Copy.ts";
import type { WebGPUBuffer } from "./Create.ts";
import type { WebGPUDevice } from "../adapter/Device.ts";
import type { GPUSize } from "../../../types/webgpu.ts";

/**
 * Buffer-to-buffer copy options
 */
export interface BufferToBufferOptions {
    /** Source offset in bytes */
    sourceOffset?: GPUSize;
    /** Destination offset in bytes */
    destinationOffset?: GPUSize;
    /** Number of bytes to copy */
    size?: GPUSize;
}

/**
 * Copy data from one buffer to another
 */
export function bufferToBuffer(
    device: WebGPUDevice,
    source: WebGPUBuffer,
    destination: WebGPUBuffer,
    options: BufferToBufferOptions = {}
): void {
    const size = options.size ?? source.size;

    copyBufferToBuffer(device, {
        source,
        sourceOffset: options.sourceOffset,
        destination,
        destinationOffset: options.destinationOffset,
        size,
    });
}
