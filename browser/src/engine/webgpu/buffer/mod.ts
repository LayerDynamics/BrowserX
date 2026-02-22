/**
 * WebGPU Buffer Management
 *
 * Exports buffer-related functionality.
 *
 * @module buffer
 */

// Buffer creation and management
export {
  type BufferConfig,
  BufferMapMode,
  createIndexBuffer,
  createStagingBuffer,
  createStorageBuffer,
  createUniformBuffer,
  createVertexBuffer,
  WebGPUBuffer,
} from "./Create.ts";

// Staging buffer pool
export { type PooledStagingBuffer, StagingBufferPool } from "./Staging.ts";

// Buffer copying operations
export {
  alignCopySize,
  batchCopyBuffers,
  type BatchCopyDescriptor,
  type BufferCopyDescriptor,
  type BufferCopyResult,
  type BufferToTextureCopyDescriptor,
  clearBuffer,
  copyBufferToBuffer,
  copyBufferToBufferAsync,
  copyBufferToTexture,
  copyTextureToBuffer,
  fillBuffer,
  isValidCopyOffset,
  isValidCopySize,
  type TextureToBufferCopyDescriptor,
} from "./Copy.ts";

// Buffer size utilities
export {
  alignSize,
  calculateIndexBufferSize,
  calculateStorageBufferSize,
  calculateUniformBufferSize,
  calculateVertexBufferSize,
  COPY_BUFFER_ALIGNMENT,
  STORAGE_BUFFER_ALIGNMENT,
  UNIFORM_BUFFER_ALIGNMENT,
  VERTEX_BUFFER_ALIGNMENT,
} from "./Size.ts";

// Buffer array utilities
export * from "./Array.ts";

// Buffer allocation
export { allocateBuffer, allocateBufferWithData, type BufferAllocation } from "./Allocate.ts";

// Buffer-to-buffer operations
export { bufferToBuffer, type BufferToBufferOptions } from "./BufferToBuffer.ts";

// Re-export BufferPool from memory module for convenience
export { BufferPool } from "../memory/mod.ts";
