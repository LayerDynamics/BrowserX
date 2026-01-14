/**
 * Buffer Copy Operations
 *
 * Provides utilities for copying data between buffers, including
 * validation, optimization, and command encoding.
 */

import type { WebGPUBuffer } from "./Create.ts";
import type { WebGPUDevice } from "../adapter/Device.ts";
import type { GPUSize, ByteCount } from "../../../types/webgpu.ts";
import {
    GPUBufferUsageError,
    GPUBufferStateError,
    GPUBufferError,
} from "../errors.ts";
import { GPUBufferUsageFlags, GPUBufferState } from "../../../types/webgpu.ts";
import { alignSize, COPY_BUFFER_ALIGNMENT } from "./Size.ts";

// ============================================================================
// Copy Configuration
// ============================================================================

/**
 * Buffer copy descriptor
 */
export interface BufferCopyDescriptor {
    /** Source buffer */
    source: WebGPUBuffer;

    /** Source offset in bytes */
    sourceOffset?: GPUSize;

    /** Destination buffer */
    destination: WebGPUBuffer;

    /** Destination offset in bytes */
    destinationOffset?: GPUSize;

    /** Number of bytes to copy */
    size: GPUSize;
}

/**
 * Buffer-to-buffer copy result
 */
export interface BufferCopyResult {
    /** Copy successful */
    success: boolean;

    /** Bytes copied */
    bytesCopied: ByteCount;

    /** Copy duration in milliseconds */
    durationMs: number;

    /** Error if copy failed */
    error?: Error;
}

// ============================================================================
// Copy Validation
// ============================================================================

/**
 * Validate buffer copy parameters
 *
 * @param descriptor - Copy descriptor
 * @throws {GPUBufferError} If parameters are invalid
 */
function validateCopy(descriptor: BufferCopyDescriptor): void {
    const {
        source,
        sourceOffset = 0,
        destination,
        destinationOffset = 0,
        size,
    } = descriptor;

    // Validate size
    if (size === 0) {
        throw new GPUBufferError(
            "Copy size must be greater than 0",
            {
                code: "GPU_BUFFER_COPY_INVALID_SIZE",
            },
        );
    }

    // Validate alignment (4-byte requirement)
    if (sourceOffset % COPY_BUFFER_ALIGNMENT !== 0) {
        throw new GPUBufferError(
            `Source offset ${sourceOffset} is not aligned to ${COPY_BUFFER_ALIGNMENT} bytes`,
            {
                code: "GPU_BUFFER_COPY_ALIGNMENT",
            },
        );
    }

    if (destinationOffset % COPY_BUFFER_ALIGNMENT !== 0) {
        throw new GPUBufferError(
            `Destination offset ${destinationOffset} is not aligned to ${COPY_BUFFER_ALIGNMENT} bytes`,
            {
                code: "GPU_BUFFER_COPY_ALIGNMENT",
            },
        );
    }

    if (size % COPY_BUFFER_ALIGNMENT !== 0) {
        throw new GPUBufferError(
            `Copy size ${size} is not aligned to ${COPY_BUFFER_ALIGNMENT} bytes`,
            {
                code: "GPU_BUFFER_COPY_ALIGNMENT",
            },
        );
    }

    // Validate source buffer
    const sourceUsage = source.getUsage();
    if ((sourceUsage & GPUBufferUsageFlags.COPY_SRC) === 0) {
        throw new GPUBufferUsageError(
            source.label || "unknown",
            GPUBufferUsageFlags.COPY_SRC,
            sourceUsage,
            "buffer copy operation",
        );
    }

    // Validate destination buffer
    const destUsage = destination.getUsage();
    if ((destUsage & GPUBufferUsageFlags.COPY_DST) === 0) {
        throw new GPUBufferUsageError(
            destination.label || "unknown",
            GPUBufferUsageFlags.COPY_DST,
            destUsage,
            "buffer copy operation",
        );
    }

    // Validate buffer states
    const sourceState = source.getState();
    if (sourceState !== GPUBufferState.UNMAPPED) {
        throw new GPUBufferStateError(
            source.label || "unknown",
            "buffer copy operation",
            sourceState,
            GPUBufferState.UNMAPPED,
        );
    }

    const destState = destination.getState();
    if (destState !== GPUBufferState.UNMAPPED) {
        throw new GPUBufferStateError(
            destination.label || "unknown",
            "buffer copy operation",
            destState,
            GPUBufferState.UNMAPPED,
        );
    }

    // Validate bounds
    const sourceSize = source.getSize();
    if (sourceOffset + size > sourceSize) {
        throw new GPUBufferError(
            `Source copy range [${sourceOffset}, ${sourceOffset + size}) exceeds buffer size ${sourceSize}`,
            {
                code: "GPU_BUFFER_COPY_OUT_OF_BOUNDS",
                bufferId: source.label || "unknown",
                size: sourceSize,
            },
        );
    }

    const destSize = destination.getSize();
    if (destinationOffset + size > destSize) {
        throw new GPUBufferError(
            `Destination copy range [${destinationOffset}, ${destinationOffset + size}) exceeds buffer size ${destSize}`,
            {
                code: "GPU_BUFFER_COPY_OUT_OF_BOUNDS",
                bufferId: destination.label || "unknown",
                size: destSize,
            },
        );
    }

    // Validate no overlap if same buffer
    if (source === destination) {
        const sourceEnd = sourceOffset + size;
        const destEnd = destinationOffset + size;

        const overlaps =
            (sourceOffset >= destinationOffset && sourceOffset < destEnd) ||
            (destinationOffset >= sourceOffset && destinationOffset < sourceEnd);

        if (overlaps) {
            throw new GPUBufferError(
                "Source and destination ranges overlap in same buffer",
                {
                    code: "GPU_BUFFER_COPY_OVERLAP",
                    bufferId: source.label || "unknown",
                },
            );
        }
    }
}

// ============================================================================
// Copy Operations
// ============================================================================

/**
 * Copy data from one buffer to another
 *
 * @param device - WebGPU device
 * @param descriptor - Copy descriptor
 * @returns Copy result
 */
export function copyBufferToBuffer(
    device: WebGPUDevice,
    descriptor: BufferCopyDescriptor,
): BufferCopyResult {
    const startTime = Date.now();

    try {
        // Validate copy parameters
        validateCopy(descriptor);

        const {
            source,
            sourceOffset = 0,
            destination,
            destinationOffset = 0,
            size,
        } = descriptor;

        // Create command encoder
        const encoder = device.getDevice().createCommandEncoder({
            label: "Buffer Copy Encoder",
        });

        // Encode copy command
        encoder.copyBufferToBuffer(
            source.getNativeBuffer(),
            sourceOffset,
            destination.getNativeBuffer(),
            destinationOffset,
            size,
        );

        // Submit command buffer
        const commandBuffer = encoder.finish();
        device.getQueue().submit([commandBuffer]);

        const durationMs = Date.now() - startTime;

        return {
            success: true,
            bytesCopied: size as ByteCount,
            durationMs,
        };
    } catch (error) {
        const durationMs = Date.now() - startTime;

        return {
            success: false,
            bytesCopied: 0 as ByteCount,
            durationMs,
            error: error as Error,
        };
    }
}

/**
 * Copy data from one buffer to another (async version with wait)
 *
 * @param device - WebGPU device
 * @param descriptor - Copy descriptor
 * @returns Copy result after GPU completion
 */
export async function copyBufferToBufferAsync(
    device: WebGPUDevice,
    descriptor: BufferCopyDescriptor,
): Promise<BufferCopyResult> {
    const startTime = Date.now();

    try {
        // Validate copy parameters
        validateCopy(descriptor);

        const {
            source,
            sourceOffset = 0,
            destination,
            destinationOffset = 0,
            size,
        } = descriptor;

        // Create command encoder
        const encoder = device.getDevice().createCommandEncoder({
            label: "Buffer Copy Encoder (Async)",
        });

        // Encode copy command
        encoder.copyBufferToBuffer(
            source.getNativeBuffer(),
            sourceOffset,
            destination.getNativeBuffer(),
            destinationOffset,
            size,
        );

        // Submit command buffer
        const commandBuffer = encoder.finish();
        device.getQueue().submit([commandBuffer]);

        // Wait for GPU to complete
        await device.getQueue().onSubmittedWorkDone();

        const durationMs = Date.now() - startTime;

        return {
            success: true,
            bytesCopied: size as ByteCount,
            durationMs,
        };
    } catch (error) {
        const durationMs = Date.now() - startTime;

        return {
            success: false,
            bytesCopied: 0 as ByteCount,
            durationMs,
            error: error as Error,
        };
    }
}

// ============================================================================
// Batch Copy Operations
// ============================================================================

/**
 * Batch copy descriptor for multiple copies in single command buffer
 */
export interface BatchCopyDescriptor {
    /** Array of copy operations */
    copies: BufferCopyDescriptor[];
}

/**
 * Execute multiple buffer copies in single command buffer
 *
 * More efficient than individual copies when multiple operations are needed
 *
 * @param device - WebGPU device
 * @param descriptor - Batch copy descriptor
 * @returns Copy result
 */
export function batchCopyBuffers(
    device: WebGPUDevice,
    descriptor: BatchCopyDescriptor,
): BufferCopyResult {
    const startTime = Date.now();

    try {
        // Validate all copies first
        for (const copy of descriptor.copies) {
            validateCopy(copy);
        }

        // Create command encoder
        const encoder = device.getDevice().createCommandEncoder({
            label: "Batch Buffer Copy Encoder",
        });

        // Encode all copy commands
        let totalBytes = 0;
        for (const copy of descriptor.copies) {
            const {
                source,
                sourceOffset = 0,
                destination,
                destinationOffset = 0,
                size,
            } = copy;

            encoder.copyBufferToBuffer(
                source.getNativeBuffer(),
                sourceOffset,
                destination.getNativeBuffer(),
                destinationOffset,
                size,
            );

            totalBytes += size;
        }

        // Submit command buffer
        const commandBuffer = encoder.finish();
        device.getQueue().submit([commandBuffer]);

        const durationMs = Date.now() - startTime;

        return {
            success: true,
            bytesCopied: totalBytes as ByteCount,
            durationMs,
        };
    } catch (error) {
        const durationMs = Date.now() - startTime;

        return {
            success: false,
            bytesCopied: 0 as ByteCount,
            durationMs,
            error: error as Error,
        };
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate aligned copy size
 *
 * @param size - Desired copy size
 * @returns Aligned copy size (multiple of 4)
 */
export function alignCopySize(size: GPUSize): GPUSize {
    return alignSize(size, COPY_BUFFER_ALIGNMENT);
}

/**
 * Check if offset is valid for copy operations
 *
 * @param offset - Offset to check
 * @returns True if offset is aligned to 4 bytes
 */
export function isValidCopyOffset(offset: GPUSize): boolean {
    return offset % COPY_BUFFER_ALIGNMENT === 0;
}

/**
 * Check if size is valid for copy operations
 *
 * @param size - Size to check
 * @returns True if size is aligned to 4 bytes
 */
export function isValidCopySize(size: GPUSize): boolean {
    return size % COPY_BUFFER_ALIGNMENT === 0 && size > 0;
}

/**
 * Fill buffer with constant value
 *
 * Uses clearBuffer command (WebGPU extension) if available,
 * otherwise falls back to write operation
 *
 * @param device - WebGPU device
 * @param buffer - Buffer to fill
 * @param value - Fill value (0x00 to 0xFF)
 * @param offset - Offset in bytes
 * @param size - Size to fill in bytes
 */
export function fillBuffer(
    device: WebGPUDevice,
    buffer: WebGPUBuffer,
    value: number,
    offset: GPUSize = 0,
    size?: GPUSize,
): void {
    // Validate buffer has COPY_DST usage
    const usage = buffer.getUsage();
    if ((usage & GPUBufferUsageFlags.COPY_DST) === 0) {
        throw new GPUBufferUsageError(
            buffer.label || "unknown",
            GPUBufferUsageFlags.COPY_DST,
            usage,
            "buffer fill operation",
        );
    }

    // Determine fill size
    const fillSize = size !== undefined ? size : (buffer.getSize() - offset) as GPUSize;

    // Validate alignment
    if (offset % 4 !== 0) {
        throw new GPUBufferError(
            `Fill offset ${offset} must be aligned to 4 bytes`,
            {
                code: "GPU_BUFFER_FILL_ALIGNMENT",
                bufferId: buffer.label || "unknown",
            },
        );
    }

    if (fillSize % 4 !== 0) {
        throw new GPUBufferError(
            `Fill size ${fillSize} must be aligned to 4 bytes`,
            {
                code: "GPU_BUFFER_FILL_ALIGNMENT",
                bufferId: buffer.label || "unknown",
            },
        );
    }

    // Clamp value to byte range
    const byteValue = Math.max(0, Math.min(255, Math.floor(value)));

    // Create fill data (4-byte pattern repeated)
    const pattern = new Uint8Array(4);
    pattern.fill(byteValue);

    // Create full fill buffer
    const fillData = new Uint8Array(fillSize);
    for (let i = 0; i < fillSize; i += 4) {
        fillData.set(pattern, i);
    }

    // Write to buffer
    buffer.write(fillData, offset);
}

/**
 * Clear buffer to zeros
 *
 * @param device - WebGPU device
 * @param buffer - Buffer to clear
 * @param offset - Offset in bytes
 * @param size - Size to clear in bytes
 */
export function clearBuffer(
    device: WebGPUDevice,
    buffer: WebGPUBuffer,
    offset: GPUSize = 0,
    size?: GPUSize,
): void {
    fillBuffer(device, buffer, 0, offset, size);
}

// ============================================================================
// Texture Copy Operations
// ============================================================================

/**
 * Texture-to-buffer copy descriptor
 */
export interface TextureToBufferCopyDescriptor {
    /** Source texture */
    texture: GPUTexture;
    /** Mip level */
    mipLevel?: number;
    /** Texture origin */
    origin?: GPUOrigin3D;
    /** Destination buffer */
    buffer: WebGPUBuffer;
    /** Buffer offset */
    offset?: GPUSize;
    /** Bytes per row */
    bytesPerRow: number;
    /** Rows per image */
    rowsPerImage?: number;
    /** Copy size */
    copySize: GPUExtent3D;
}

/**
 * Buffer-to-texture copy descriptor
 */
export interface BufferToTextureCopyDescriptor {
    /** Source buffer */
    buffer: WebGPUBuffer;
    /** Buffer offset */
    offset?: GPUSize;
    /** Bytes per row */
    bytesPerRow: number;
    /** Rows per image */
    rowsPerImage?: number;
    /** Destination texture */
    texture: GPUTexture;
    /** Mip level */
    mipLevel?: number;
    /** Texture origin */
    origin?: GPUOrigin3D;
    /** Copy size */
    copySize: GPUExtent3D;
}

/**
 * Copy data from texture to buffer
 */
export function copyTextureToBuffer(
    device: WebGPUDevice,
    descriptor: TextureToBufferCopyDescriptor,
): BufferCopyResult {
    const startTime = Date.now();

    try {
        const encoder = device.getDevice().createCommandEncoder({
            label: "Texture to Buffer Copy",
        });

        encoder.copyTextureToBuffer(
            {
                texture: descriptor.texture,
                mipLevel: descriptor.mipLevel ?? 0,
                origin: descriptor.origin,
            },
            {
                buffer: descriptor.buffer.getNativeBuffer(),
                offset: descriptor.offset ?? 0,
                bytesPerRow: descriptor.bytesPerRow,
                rowsPerImage: descriptor.rowsPerImage,
            },
            descriptor.copySize,
        );

        const commandBuffer = encoder.finish();
        device.getQueue().submit([commandBuffer]);

        const durationMs = Date.now() - startTime;

        return {
            success: true,
            bytesCopied: (descriptor.bytesPerRow * (descriptor.copySize as any).height) as ByteCount,
            durationMs,
        };
    } catch (error) {
        return {
            success: false,
            bytesCopied: 0 as ByteCount,
            durationMs: Date.now() - startTime,
            error: error as Error,
        };
    }
}

/**
 * Copy data from buffer to texture
 */
export function copyBufferToTexture(
    device: WebGPUDevice,
    descriptor: BufferToTextureCopyDescriptor,
): BufferCopyResult {
    const startTime = Date.now();

    try {
        const encoder = device.getDevice().createCommandEncoder({
            label: "Buffer to Texture Copy",
        });

        encoder.copyBufferToTexture(
            {
                buffer: descriptor.buffer.getNativeBuffer(),
                offset: descriptor.offset ?? 0,
                bytesPerRow: descriptor.bytesPerRow,
                rowsPerImage: descriptor.rowsPerImage,
            },
            {
                texture: descriptor.texture,
                mipLevel: descriptor.mipLevel ?? 0,
                origin: descriptor.origin,
            },
            descriptor.copySize,
        );

        const commandBuffer = encoder.finish();
        device.getQueue().submit([commandBuffer]);

        const durationMs = Date.now() - startTime;

        return {
            success: true,
            bytesCopied: (descriptor.bytesPerRow * (descriptor.copySize as any).height) as ByteCount,
            durationMs,
        };
    } catch (error) {
        return {
            success: false,
            bytesCopied: 0 as ByteCount,
            durationMs: Date.now() - startTime,
            error: error as Error,
        };
    }
}
