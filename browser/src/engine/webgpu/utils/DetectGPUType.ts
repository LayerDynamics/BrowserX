/**
 * GPU Type Detection
 *
 * Utilities for detecting GPU vendor, family, and capabilities using webgpu_x.
 * Provides vendor-specific optimizations and hardware detection.
 *
 * @module utils
 */

import { WebGPUX, GPUVendor } from "@webgpu_x";

// ============================================================================
// Lazy Initialization
// ============================================================================

let webgpuXInstance: WebGPUX | null = null;

/**
 * Get or create webgpu_x instance
 */
function getWebGPUX(): WebGPUX {
    if (!webgpuXInstance) {
        webgpuXInstance = new WebGPUX();
    }
    return webgpuXInstance;
}

// ============================================================================
// GPU Vendor Detection
// ============================================================================

/**
 * Detect GPU vendor from vendor ID
 *
 * @param vendorId - PCI vendor ID (e.g., 0x10DE for NVIDIA)
 * @returns GPU vendor enum value
 *
 * @example
 * ```ts
 * const vendor = detectGPUVendor(0x10DE); // GPUVendor.NVIDIA
 * ```
 */
export function detectGPUVendor(vendorId: number): GPUVendor {
    const webgpuX = getWebGPUX();
    return webgpuX.detectVendor(vendorId);
}

/**
 * Get human-readable vendor name
 *
 * @param vendorId - PCI vendor ID
 * @returns Vendor name string (e.g., "NVIDIA", "AMD")
 *
 * @example
 * ```ts
 * const name = getVendorName(0x1002); // "AMD"
 * ```
 */
export function getVendorName(vendorId: number): string {
    const vendor = detectGPUVendor(vendorId);

    switch (vendor) {
        case GPUVendor.NVIDIA:
            return "NVIDIA";
        case GPUVendor.AMD:
            return "AMD";
        case GPUVendor.Intel:
            return "Intel";
        case GPUVendor.Apple:
            return "Apple";
        case GPUVendor.Qualcomm:
            return "Qualcomm";
        case GPUVendor.ARM:
            return "ARM";
        default:
            return "Unknown";
    }
}

/**
 * Check if vendor is NVIDIA
 */
export function isNVIDIA(vendorId: number): boolean {
    return detectGPUVendor(vendorId) === GPUVendor.NVIDIA;
}

/**
 * Check if vendor is AMD
 */
export function isAMD(vendorId: number): boolean {
    return detectGPUVendor(vendorId) === GPUVendor.AMD;
}

/**
 * Check if vendor is Intel
 */
export function isIntel(vendorId: number): boolean {
    return detectGPUVendor(vendorId) === GPUVendor.Intel;
}

/**
 * Check if vendor is Apple
 */
export function isApple(vendorId: number): boolean {
    return detectGPUVendor(vendorId) === GPUVendor.Apple;
}

// ============================================================================
// Optimal Workgroup Size
// ============================================================================

/**
 * Get optimal workgroup size for vendor
 *
 * Calculates vendor-specific optimal workgroup size based on hardware characteristics:
 * - NVIDIA: 256 (warp size 32, prefer multiples)
 * - AMD: 256 (wavefront size 64, prefer multiples)
 * - Intel: 128 (subgroup size 8-32)
 * - Apple: 256 (SIMD group size 32)
 *
 * @param problemSize - Total problem size (number of elements)
 * @param maxWorkgroupSize - Maximum workgroup size from device limits
 * @param vendorId - PCI vendor ID
 * @returns Optimal workgroup size for this vendor
 *
 * @example
 * ```ts
 * const optimal = getOptimalWorkgroupSize(1024 * 1024, 256, 0x10DE);
 * console.log(optimal); // 256 for NVIDIA
 * ```
 */
export function getOptimalWorkgroupSize(
    problemSize: number,
    maxWorkgroupSize: number,
    vendorId: number,
): number {
    const webgpuX = getWebGPUX();
    const vendor = webgpuX.detectVendor(vendorId);
    return webgpuX.getOptimalWorkgroupSize(problemSize, maxWorkgroupSize, vendor);
}

// ============================================================================
// GPU Device Info Helpers
// ============================================================================

/**
 * Get optimal workgroup size for GPU device
 *
 * This is a simplified helper that requires the vendor ID to be provided separately.
 * In a real application, you would extract the vendor ID from adapter.info (WebGPU API)
 * or from platform-specific APIs.
 *
 * @param vendorId - PCI vendor ID
 * @param problemSize - Total problem size
 * @param maxWorkgroupSize - Maximum workgroup size from device limits
 * @returns Optimal workgroup size
 *
 * @example
 * ```ts
 * // Assuming you have the vendor ID from adapter info:
 * const vendorId = 0x10DE; // NVIDIA
 * const optimal = getOptimalWorkgroupSizeForDevice(vendorId, 1024, 256);
 * ```
 */
export function getOptimalWorkgroupSizeForDevice(
    vendorId: number,
    problemSize: number,
    maxWorkgroupSize: number,
): number {
    return getOptimalWorkgroupSize(problemSize, maxWorkgroupSize, vendorId);
}

// ============================================================================
// GPU Capability Queries
// ============================================================================

/**
 * Check if GPU supports specific features based on vendor
 *
 * @param vendorId - PCI vendor ID
 * @returns Object with feature support flags
 */
export function getVendorFeatures(vendorId: number): {
    supportsSubgroups: boolean;
    preferredWorkgroupSize: number;
    supportsRayTracing: boolean;
    supportsTensorCores: boolean;
} {
    const vendor = detectGPUVendor(vendorId);

    switch (vendor) {
        case GPUVendor.NVIDIA:
            return {
                supportsSubgroups: true,
                preferredWorkgroupSize: 256,
                supportsRayTracing: true,  // RTX series
                supportsTensorCores: true,  // RTX series
            };

        case GPUVendor.AMD:
            return {
                supportsSubgroups: true,
                preferredWorkgroupSize: 256,
                supportsRayTracing: true,  // RDNA2+
                supportsTensorCores: false,
            };

        case GPUVendor.Intel:
            return {
                supportsSubgroups: true,
                preferredWorkgroupSize: 128,
                supportsRayTracing: true,  // Arc series
                supportsTensorCores: false,
            };

        case GPUVendor.Apple:
            return {
                supportsSubgroups: true,
                preferredWorkgroupSize: 256,
                supportsRayTracing: true,  // M3+
                supportsTensorCores: false,
            };

        default:
            return {
                supportsSubgroups: false,
                preferredWorkgroupSize: 64,
                supportsRayTracing: false,
                supportsTensorCores: false,
            };
    }
}

// ============================================================================
// Re-export types
// ============================================================================

export { GPUVendor };
