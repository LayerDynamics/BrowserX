/**
 * WebGPU Buffer Management
 *
 * Exports buffer-related functionality.
 *
 * @module buffer
 */

// Buffer creation and management
export {
    WebGPUBuffer,
    type BufferConfig,
    BufferMapMode,
    createVertexBuffer,
    createIndexBuffer,
    createUniformBuffer,
    createStorageBuffer,
    createStagingBuffer,
} from "./Create.ts";

// Staging buffer pool
export {
    StagingBufferPool,
    type PooledStagingBuffer,
} from "./Staging.ts";

// Buffer copying operations
export {
    copyBufferToBuffer,
    copyBufferToBufferAsync,
    copyTextureToBuffer,
    copyBufferToTexture,
    batchCopyBuffers,
    fillBuffer,
    clearBuffer,
    alignCopySize,
    isValidCopyOffset,
    isValidCopySize,
    type BufferCopyDescriptor,
    type BufferCopyResult,
    type TextureToBufferCopyDescriptor,
    type BufferToTextureCopyDescriptor,
    type BatchCopyDescriptor,
} from "./Copy.ts";

// Buffer size utilities
export {
    calculateUniformBufferSize,
    calculateStorageBufferSize,
    calculateVertexBufferSize,
    calculateIndexBufferSize,
    alignSize,
    UNIFORM_BUFFER_ALIGNMENT,
    STORAGE_BUFFER_ALIGNMENT,
    VERTEX_BUFFER_ALIGNMENT,
    COPY_BUFFER_ALIGNMENT,
} from "./Size.ts";

// Buffer array utilities
export * from "./Array.ts";

// Buffer allocation
export {
    allocateBuffer,
    allocateBufferWithData,
    type BufferAllocation,
} from "./Allocate.ts";

// Buffer-to-buffer operations
export {
    bufferToBuffer,
    type BufferToBufferOptions,
} from "./BufferToBuffer.ts";

// Re-export BufferPool from memory module for convenience
export { BufferPool } from "../memory/mod.ts";
