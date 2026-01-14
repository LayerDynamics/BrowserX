/**
 * Framework Helpers
 *
 * Framework utilities using webgpu_x:
 * - Device configuration defaults
 * - Matrix transformation utilities
 * - Coordinate system conversions
 *
 * @module webgpu/utils/FrameworkHelpers
 */

import { WebGPUX, type DeviceConfig } from "@webgpu_x";

let webgpuXInstance: WebGPUX | null = null;

function getWebGPUX(): WebGPUX {
    if (!webgpuXInstance) {
        webgpuXInstance = new WebGPUX();
    }
    return webgpuXInstance;
}

// ============================================================================
// Device Configuration
// ============================================================================

/**
 * Get default device configuration
 *
 * @returns Default device config with common features and limits
 */
export function getDefaultDeviceConfig(): DeviceConfig | null {
    const webgpuX = getWebGPUX();
    return webgpuX.frameworkDeviceConfigDefault();
}

// ============================================================================
// Matrix Utilities
// ============================================================================

/**
 * Get OpenGL to WGPU coordinate system conversion matrix
 *
 * @returns 4x4 transformation matrix (column-major, 16 elements)
 */
export function getOpenGLToWGPUMatrix(): Float32Array | null {
    const webgpuX = getWebGPUX();
    return webgpuX.frameworkMatrixOpenGLToWGPU();
}

/**
 * Create perspective projection matrix
 *
 * @param fovY - Field of view in radians (vertical)
 * @param aspect - Aspect ratio (width / height)
 * @param near - Near clipping plane
 * @param far - Far clipping plane
 * @returns 4x4 perspective matrix (column-major)
 */
export function createPerspectiveMatrix(
    fovY: number,
    aspect: number,
    near: number,
    far: number
): Float32Array | null {
    const webgpuX = getWebGPUX();
    return webgpuX.frameworkMatrixPerspective(fovY, aspect, near, far);
}

/**
 * Create orthographic projection matrix
 *
 * @param left - Left clipping plane
 * @param right - Right clipping plane
 * @param bottom - Bottom clipping plane
 * @param top - Top clipping plane
 * @param near - Near clipping plane
 * @param far - Far clipping plane
 * @returns 4x4 orthographic matrix (column-major)
 */
export function createOrthographicMatrix(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number
): Float32Array | null {
    const webgpuX = getWebGPUX();
    return webgpuX.frameworkMatrixOrthographic(left, right, bottom, top, near, far);
}

/**
 * Create view matrix for camera transformation
 *
 * @param eye - Camera position [x, y, z]
 * @param target - Look-at target [x, y, z]
 * @param up - Up direction [x, y, z]
 * @returns 4x4 view matrix (column-major)
 */
export function createViewMatrix(
    eye: [number, number, number],
    target: [number, number, number],
    up: [number, number, number]
): Float32Array | null {
    const webgpuX = getWebGPUX();
    return webgpuX.frameworkMatrixView(eye, target, up);
}

/**
 * Create model matrix from transform components
 *
 * @param translation - Translation [x, y, z]
 * @param rotation - Rotation in radians [x, y, z]
 * @param scale - Scale factors [x, y, z]
 * @returns 4x4 model matrix (column-major)
 */
export function createModelMatrix(
    translation: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
): Float32Array | null {
    const webgpuX = getWebGPUX();
    return webgpuX.frameworkMatrixModel(translation, rotation, scale);
}

// Re-export types
export type { DeviceConfig };
