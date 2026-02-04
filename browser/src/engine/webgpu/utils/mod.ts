/**
 * WebGPU Utilities Module
 *
 * Re-exports utility functions for WebGPU operations including:
 * - Descriptor sanitization for Deno FFI compatibility
 * - Buffer operations (staging belt, alignment, sizing)
 * - Texture utilities (mipmap calculations, sizes)
 * - GPU detection and system info
 *
 * @module webgpu/utils
 */

// Descriptor sanitization for Deno FFI compatibility
export {
    sanitizeArray,
    sanitizeArrayRequired,
    createBindGroupLayout,
    createPipelineLayout,
    sanitizeTextureDescriptor,
    createTexture,
    sanitizeFragmentTargets,
    sanitizeRenderPipelineDescriptor,
    createRenderPipeline,
    createRenderPipelineAsync,
    sanitizeComputePipelineDescriptor,
    createComputePipeline,
    sanitizeBindGroupDescriptor,
    createBindGroup,
} from "./DescriptorSanitizer.ts";
