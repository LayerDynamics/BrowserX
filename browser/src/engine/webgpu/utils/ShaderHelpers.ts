/**
 * Shader Helpers
 *
 * Shader utilities using webgpu_x:
 * - Shader cache with hot-reload
 * - Runtime WGSL code generation
 * - Shader stage detection
 *
 * @module webgpu/utils/ShaderHelpers
 */

import { WebGPUX, type ShaderCacheStats, type ShaderSource } from "@webgpu_x";

let webgpuXInstance: WebGPUX | null = null;

function getWebGPUX(): WebGPUX {
    if (!webgpuXInstance) {
        webgpuXInstance = new WebGPUX();
    }
    return webgpuXInstance;
}

// ============================================================================
// Shader Cache
// ============================================================================

/**
 * Create shader cache for hot-reload support
 *
 * @returns Cache handle ID
 */
export function createShaderCache(): bigint {
    const webgpuX = getWebGPUX();
    return webgpuX.createShaderCache();
}

/**
 * Load shader from file with hot-reload detection
 *
 * @param cacheHandle - Cache handle from createShaderCache
 * @param filePath - Path to shader file
 * @returns Shader source object with code and metadata, or null if failed
 */
export function loadShader(cacheHandle: bigint, filePath: string): ShaderSource | null {
    const webgpuX = getWebGPUX();
    return webgpuX.shaderCacheLoad(cacheHandle, filePath);
}

/**
 * Check if shader file has changed since last load
 *
 * @param cacheHandle - Cache handle
 * @param filePath - Path to shader file
 * @returns true if file changed, false otherwise
 */
export function hasShaderChanged(cacheHandle: bigint, filePath: string): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.shaderCacheHasChanged(cacheHandle, filePath);
}

/**
 * Clear shader cache
 */
export function clearShaderCache(cacheHandle: bigint): void {
    const webgpuX = getWebGPUX();
    webgpuX.shaderCacheClear(cacheHandle);
}

/**
 * Get shader cache statistics
 */
export function getShaderCacheStats(cacheHandle: bigint): ShaderCacheStats | null {
    const webgpuX = getWebGPUX();
    return webgpuX.shaderCacheStats(cacheHandle);
}

/**
 * Destroy shader cache and release resources
 */
export function destroyShaderCache(cacheHandle: bigint): void {
    const webgpuX = getWebGPUX();
    webgpuX.destroyShaderCache(cacheHandle);
}

// ============================================================================
// WGSL Generation
// ============================================================================

/**
 * Generate WGSL binding declaration
 *
 * @param group - Bind group number
 * @param binding - Binding number
 * @param bufferType - "uniform", "storage", or "read-only-storage"
 * @param structDef - Struct definition (e.g., "data: array<f32>")
 * @returns WGSL binding code
 */
export function wgslBindingBuffer(
    group: number,
    binding: number,
    bufferType: string,
    structDef: string
): string {
    const webgpuX = getWebGPUX();
    return webgpuX.wgslBindingBuffer(group, binding, bufferType, structDef);
}

/**
 * Generate WGSL texture binding
 */
export function wgslBindingTexture(
    group: number,
    binding: number,
    textureType: string,
    sampleType: string
): string {
    const webgpuX = getWebGPUX();
    return webgpuX.wgslBindingTexture(group, binding, textureType, sampleType);
}

/**
 * Generate WGSL sampler binding
 */
export function wgslBindingSampler(
    group: number,
    binding: number,
    samplerType: string
): string {
    const webgpuX = getWebGPUX();
    return webgpuX.wgslBindingSampler(group, binding, samplerType);
}

/**
 * Generate WGSL compute entry point
 *
 * @param workgroupSize - Workgroup dimensions [x, y, z]
 * @param body - Shader body code
 * @returns Complete WGSL compute shader
 */
export function wgslComputeEntry(workgroupSize: [number, number, number], body: string): string {
    const webgpuX = getWebGPUX();
    return webgpuX.wgslComputeEntry("main", workgroupSize[0], workgroupSize[1], workgroupSize[2], ["@builtin(global_invocation_id) id: vec3<u32>"], body);
}

// Re-export types
export type { ShaderCacheStats, ShaderSource };
