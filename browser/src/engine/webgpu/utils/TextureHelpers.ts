/**
 * Texture Helpers
 *
 * Texture utilities using webgpu_x:
 * - Mipmap level calculation
 * - Mip size computation for 2D and 3D textures
 *
 * @module webgpu/utils/TextureHelpers
 */

import { WebGPUX, type MipSize, type MipSize3D } from "@webgpu_x";

let webgpuXInstance: WebGPUX | null = null;

function getWebGPUX(): WebGPUX {
    if (!webgpuXInstance) {
        webgpuXInstance = new WebGPUX();
    }
    return webgpuXInstance;
}

/**
 * Calculate number of mipmap levels for texture
 *
 * @param width - Texture width in pixels
 * @param height - Texture height in pixels
 * @returns Number of mip levels
 */
export function calculateMipLevels(width: number, height: number): number {
    const webgpuX = getWebGPUX();
    return webgpuX.textureCalculateMipLevels(width, height);
}

/**
 * Get texture dimensions at specific mip level (2D)
 *
 * @param width - Base texture width
 * @param height - Base texture height
 * @param mipLevel - Mip level (0 = base)
 * @returns Mip dimensions {width, height}
 */
export function getMipSize(width: number, height: number, mipLevel: number): MipSize | null {
    const webgpuX = getWebGPUX();
    return webgpuX.textureGetMipSize(width, height, mipLevel);
}

/**
 * Get texture dimensions at specific mip level (3D)
 *
 * @param width - Base texture width
 * @param height - Base texture height
 * @param depth - Base texture depth
 * @param mipLevel - Mip level (0 = base)
 * @returns Mip dimensions {width, height, depth}
 */
export function getMipSize3D(
    width: number,
    height: number,
    depth: number,
    mipLevel: number
): MipSize3D | null {
    const webgpuX = getWebGPUX();
    return webgpuX.textureGetMipSize3D(width, height, depth, mipLevel);
}

// Re-export types
export type { MipSize, MipSize3D };
