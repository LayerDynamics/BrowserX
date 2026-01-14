/**
 * System Detection
 *
 * Utilities for detecting platform, OS, and system capabilities using webgpu_x.
 * Provides platform-specific optimizations and feature detection.
 *
 * @module utils
 */

import { WebGPUX, MetalFamily, ROCmArchitecture } from "@webgpu_x";

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
// Platform Detection
// ============================================================================

/**
 * Platform types
 */
export enum Platform {
    Darwin = "darwin",
    Linux = "linux",
    Windows = "windows",
    Unknown = "unknown",
}

/**
 * Detect current platform using Deno's built-in APIs
 *
 * @returns Platform enum value
 *
 * @example
 * ```ts
 * const platform = detectPlatform();
 * if (platform === Platform.Darwin) {
 *   // macOS-specific code
 * }
 * ```
 */
export function detectPlatform(): Platform {
    const os = Deno.build.os;
    switch (os) {
        case "darwin":
            return Platform.Darwin;
        case "linux":
            return Platform.Linux;
        case "windows":
            return Platform.Windows;
        default:
            return Platform.Unknown;
    }
}

/**
 * Check if running on macOS
 */
export function isDarwin(): boolean {
    return detectPlatform() === Platform.Darwin;
}

/**
 * Check if running on Linux
 */
export function isLinux(): boolean {
    return detectPlatform() === Platform.Linux;
}

/**
 * Check if running on Windows
 */
export function isWindows(): boolean {
    return detectPlatform() === Platform.Windows;
}

// ============================================================================
// Darwin/macOS System Detection
// ============================================================================

/**
 * Check if running on Apple Silicon
 */
export function isAppleSilicon(): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.isAppleSilicon();
}

/**
 * Get preferred backend for macOS
 */
export function darwinPreferredBackend(): string {
    const webgpuX = getWebGPUX();
    return webgpuX.darwinPreferredBackend();
}

/**
 * Get recommended memory strategy for macOS
 */
export function darwinRecommendedMemoryStrategy(): string {
    const webgpuX = getWebGPUX();
    return webgpuX.darwinRecommendedMemoryStrategy();
}

// ============================================================================
// Linux System Detection
// ============================================================================

/**
 * Check if Linux system is running on ARM
 */
export function linuxIsArm(): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.linuxIsArm();
}

/**
 * Get CPU count on Linux
 */
export function linuxGetCpuCount(): number {
    const webgpuX = getWebGPUX();
    return webgpuX.linuxGetCpuCount();
}

/**
 * Get page size on Linux
 */
export function linuxGetPageSize(): bigint {
    const webgpuX = getWebGPUX();
    return webgpuX.linuxGetPageSize();
}

/**
 * Get total memory on Linux
 */
export function linuxGetTotalMemory(): bigint {
    const webgpuX = getWebGPUX();
    return webgpuX.linuxGetTotalMemory();
}

/**
 * Check if NVIDIA driver is available on Linux
 */
export function linuxHasNvidiaDriver(): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.linuxHasNvidiaDriver();
}

/**
 * Check if ROCm driver is available on Linux
 */
export function linuxHasRocmDriver(): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.linuxHasRocmDriver();
}

/**
 * Check if Intel GPU is available on Linux
 */
export function linuxHasIntelGpu(): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.linuxHasIntelGpu();
}

/**
 * Get preferred backend for Linux
 */
export function linuxPreferredBackend(): string {
    const webgpuX = getWebGPUX();
    return webgpuX.linuxPreferredBackend();
}

/**
 * Get recommended memory strategy for Linux
 */
export function linuxRecommendedMemoryStrategy(): string {
    const webgpuX = getWebGPUX();
    return webgpuX.linuxRecommendedMemoryStrategy();
}

// ============================================================================
// Windows System Detection
// ============================================================================

/**
 * Check if Windows system is running on ARM
 */
export function windowsIsArm(): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.windowsIsArm();
}

/**
 * Get logical processor count on Windows
 */
export function windowsGetLogicalProcessorCount(): number {
    const webgpuX = getWebGPUX();
    return webgpuX.windowsGetLogicalProcessorCount();
}

/**
 * Get page size on Windows
 */
export function windowsGetPageSize(): bigint {
    const webgpuX = getWebGPUX();
    return webgpuX.windowsGetPageSize();
}

/**
 * Check if NVIDIA driver is available on Windows
 */
export function windowsHasNvidiaDriver(): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.windowsHasNvidiaDriver();
}

/**
 * Check if AMD driver is available on Windows
 */
export function windowsHasAmdDriver(): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.windowsHasAmdDriver();
}

/**
 * Check if Intel driver is available on Windows
 */
export function windowsHasIntelDriver(): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.windowsHasIntelDriver();
}

/**
 * Check if DirectX 12 is available on Windows
 */
export function windowsHasDx12(): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.windowsHasDx12();
}

/**
 * Get preferred backend for Windows
 */
export function windowsPreferredBackend(): string {
    const webgpuX = getWebGPUX();
    return webgpuX.windowsPreferredBackend();
}

/**
 * Get recommended memory strategy for Windows
 */
export function windowsRecommendedMemoryStrategy(): string {
    const webgpuX = getWebGPUX();
    return webgpuX.windowsRecommendedMemoryStrategy();
}

// ============================================================================
// Metal Detection (macOS only)
// ============================================================================

export { MetalFamily };

/**
 * Get Metal GPU capabilities
 *
 * @param family - Metal family enum
 * @returns Object with Metal-specific capabilities
 */
export function getMetalCapabilities(family: MetalFamily): {
    optimalWorkgroupSize: number;
    simdGroupSize: number;
    maxThreadgroupMemory: bigint;
    supportsRaytracing: boolean;
    supportsTier2ArgumentBuffers: boolean;
} {
    const webgpuX = getWebGPUX();

    return {
        optimalWorkgroupSize: webgpuX.metalOptimalWorkgroupSize(family),
        simdGroupSize: webgpuX.metalSimdGroupSize(family),
        maxThreadgroupMemory: webgpuX.metalMaxThreadgroupMemory(family),
        supportsRaytracing: webgpuX.metalSupportsRaytracing(family),
        supportsTier2ArgumentBuffers: webgpuX.metalSupportsTier2ArgumentBuffers(family),
    };
}

// ============================================================================
// ROCm Detection (AMD only)
// ============================================================================

export { ROCmArchitecture };

/**
 * Get ROCm-specific capabilities
 *
 * @param architecture - ROCm architecture enum
 * @returns Object with ROCm-specific capabilities
 */
export function getROCmCapabilities(architecture: ROCmArchitecture): {
    optimalWorkgroupSize: number;
    wavefrontSize: number;
    ldsSize: bigint;
    hasMatrixCores: boolean;
    supportsFp64: boolean;
} {
    const webgpuX = getWebGPUX();

    return {
        optimalWorkgroupSize: webgpuX.rocmOptimalWorkgroupSize(architecture),
        wavefrontSize: webgpuX.rocmWavefrontSize(architecture),
        ldsSize: webgpuX.rocmLdsSizePerCu(architecture),
        hasMatrixCores: webgpuX.rocmHasMatrixCores(architecture),
        supportsFp64: webgpuX.rocmSupportsFp64(architecture),
    };
}

/**
 * Calculate ROCm occupancy
 *
 * @param threadsPerBlock - Number of threads per workgroup
 * @param sharedMemoryPerBlock - Shared memory per workgroup in bytes
 * @param architecture - ROCm architecture enum
 * @returns Occupancy as a value between 0.0 and 1.0
 */
export function calculateROCmOccupancy(
    threadsPerBlock: number,
    sharedMemoryPerBlock: bigint,
    architecture: ROCmArchitecture,
): number {
    const webgpuX = getWebGPUX();
    return webgpuX.rocmCalculateOccupancy(
        threadsPerBlock,
        sharedMemoryPerBlock,
        architecture,
    );
}

// ============================================================================
// CUDA Detection (NVIDIA only)
// ============================================================================

/**
 * Get CUDA-specific capabilities
 *
 * @param computeCapabilityMajor - Compute capability major version
 * @param computeCapabilityMinor - Compute capability minor version
 * @returns Object with CUDA-specific capabilities
 */
export function getCUDACapabilities(
    computeCapabilityMajor: number,
    computeCapabilityMinor: number,
): {
    optimalWorkgroupSize: number;
    sharedMemoryBankSize: number;
    hasTensorCores: boolean;
} {
    const webgpuX = getWebGPUX();

    return {
        optimalWorkgroupSize: webgpuX.cudaOptimalWorkgroupSize(
            computeCapabilityMajor,
            computeCapabilityMinor,
        ),
        sharedMemoryBankSize: webgpuX.cudaSharedMemoryBankSize(computeCapabilityMajor),
        hasTensorCores: webgpuX.cudaHasTensorCores(
            computeCapabilityMajor,
            computeCapabilityMinor,
        ),
    };
}

/**
 * Calculate CUDA occupancy
 *
 * @param threadsPerBlock - Number of threads per block
 * @param sharedMemoryPerBlock - Shared memory per block in bytes
 * @param computeCapabilityMajor - Compute capability major version
 * @returns Occupancy as a value between 0.0 and 1.0
 */
export function calculateCUDAOccupancy(
    threadsPerBlock: number,
    sharedMemoryPerBlock: bigint,
    computeCapabilityMajor: number,
): number {
    const webgpuX = getWebGPUX();
    return webgpuX.cudaCalculateOccupancy(
        threadsPerBlock,
        sharedMemoryPerBlock,
        computeCapabilityMajor,
    );
}

// ============================================================================
// Vulkan Detection
// ============================================================================

/**
 * Get Vulkan optimal workgroup size
 *
 * @param vendorId - Vulkan vendor ID
 * @param deviceId - Vulkan device ID
 * @returns Optimal workgroup size
 */
export function vulkanOptimalWorkgroupSize(vendorId: number, deviceId: number): number {
    const webgpuX = getWebGPUX();
    return webgpuX.vulkanOptimalWorkgroupSize(vendorId, deviceId);
}

/**
 * Check if Vulkan version is supported
 *
 * @param vendorId - Vulkan vendor ID
 * @param deviceId - Vulkan device ID
 * @param major - Vulkan major version
 * @param minor - Vulkan minor version
 * @returns true if supported
 */
export function vulkanSupportsVersion(
    vendorId: number,
    deviceId: number,
    major: number,
    minor: number,
): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.vulkanSupportsVersion(vendorId, deviceId, major, minor);
}

/**
 * Check if Vulkan device supports ray tracing
 *
 * @param vendorId - Vulkan vendor ID
 * @param deviceId - Vulkan device ID
 * @returns true if ray tracing is supported
 */
export function vulkanSupportsRaytracing(vendorId: number, deviceId: number): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.vulkanSupportsRaytracing(vendorId, deviceId);
}

/**
 * Get recommended number of descriptor sets for Vulkan
 *
 * @returns Recommended descriptor set count
 */
export function vulkanRecommendedDescriptorSets(): number {
    const webgpuX = getWebGPUX();
    return webgpuX.vulkanRecommendedDescriptorSets();
}

// ============================================================================
// OpenCL Detection
// ============================================================================

/**
 * Get OpenCL optimal workgroup size
 *
 * @param vendorId - Vendor ID
 * @param deviceType - Device type (0=CPU, 1=GPU)
 * @returns Optimal workgroup size
 */
export function openclOptimalWorkgroupSize(vendorId: number, deviceType: bigint): bigint {
    const webgpuX = getWebGPUX();
    return webgpuX.openclOptimalWorkgroupSize(vendorId, deviceType);
}

/**
 * Check if OpenCL version is supported
 *
 * @param vendorId - Vendor ID
 * @param deviceId - Device ID
 * @param major - OpenCL major version
 * @param minor - OpenCL minor version
 * @returns true if supported
 */
export function openclSupportsVersion(
    vendorId: number,
    deviceId: number,
    major: number,
    minor: number,
): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.openclSupportsVersion(vendorId, deviceId, major, minor);
}

/**
 * Check if OpenCL device supports double precision (FP64)
 *
 * @param vendorId - Vendor ID
 * @param deviceId - Device ID
 * @returns true if FP64 is supported
 */
export function openclSupportsFp64(vendorId: number, deviceId: number): boolean {
    const webgpuX = getWebGPUX();
    return webgpuX.openclSupportsFp64(vendorId, deviceId);
}

// ============================================================================
// System Info Summary
// ============================================================================

/**
 * Get comprehensive system information
 *
 * @returns Object with platform, architecture, and capabilities
 */
export function getSystemInfo(): {
    platform: Platform;
    version: string;
    isAppleSilicon?: boolean;
    preferredBackend?: string;
    memoryStrategy?: string;
} {
    const webgpuX = getWebGPUX();
    const platform = detectPlatform();
    const info: ReturnType<typeof getSystemInfo> = {
        platform,
        version: webgpuX.version,
    };

    if (platform === Platform.Darwin) {
        info.isAppleSilicon = webgpuX.isAppleSilicon();
        info.preferredBackend = webgpuX.darwinPreferredBackend();
        info.memoryStrategy = webgpuX.darwinRecommendedMemoryStrategy();
    } else if (platform === Platform.Linux) {
        info.preferredBackend = webgpuX.linuxPreferredBackend();
        info.memoryStrategy = webgpuX.linuxRecommendedMemoryStrategy();
    } else if (platform === Platform.Windows) {
        info.preferredBackend = webgpuX.windowsPreferredBackend();
        info.memoryStrategy = webgpuX.windowsRecommendedMemoryStrategy();
    }

    return info;
}
