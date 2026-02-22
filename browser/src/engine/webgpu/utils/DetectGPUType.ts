/**
 * GPU Type Detection
 *
 * Utilities for detecting GPU vendor, family, and capabilities using webgpu_x.
 * Provides vendor-specific optimizations and hardware detection.
 *
 * @module utils
 */

import { GPUVendor, WebGPUX } from "@browserx/webgpu_x";

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
        supportsRayTracing: true, // RTX series
        supportsTensorCores: true, // RTX series
      };

    case GPUVendor.AMD:
      return {
        supportsSubgroups: true,
        preferredWorkgroupSize: 256,
        supportsRayTracing: true, // RDNA2+
        supportsTensorCores: false,
      };

    case GPUVendor.Intel:
      return {
        supportsSubgroups: true,
        preferredWorkgroupSize: 128,
        supportsRayTracing: true, // Arc series
        supportsTensorCores: false,
      };

    case GPUVendor.Apple:
      return {
        supportsSubgroups: true,
        preferredWorkgroupSize: 256,
        supportsRayTracing: true, // M3+
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
// Platform Detection
// ============================================================================

/**
 * Operating system platforms
 */
export enum Platform {
  Darwin = "darwin",
  Linux = "linux",
  Windows = "windows",
  Unknown = "unknown",
}

/**
 * Detect the current operating system platform
 */
export function detectPlatform(): Platform {
  // Check for Deno environment
  if (typeof Deno !== "undefined") {
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

  // Fallback for browser/other environments
  if (typeof navigator !== "undefined" && "userAgent" in navigator) {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("mac")) return Platform.Darwin;
    if (userAgent.includes("linux")) return Platform.Linux;
    if (userAgent.includes("win")) return Platform.Windows;
  }

  return Platform.Unknown;
}

// ============================================================================
// Metal (Apple) Capabilities
// ============================================================================

/**
 * Metal GPU family generations
 */
export enum MetalFamily {
  Apple1 = "apple1", // A7 (iPhone 5s, iPad Air)
  Apple2 = "apple2", // A8 (iPhone 6)
  Apple3 = "apple3", // A9 (iPhone 6s)
  Apple4 = "apple4", // A10 (iPhone 7)
  Apple5 = "apple5", // A11 (iPhone 8/X)
  Apple6 = "apple6", // A12 (iPhone XS)
  Apple7 = "apple7", // A13 (iPhone 11)
  Apple8 = "apple8", // A14/M1
  Apple9 = "apple9", // A15/M2
  Mac1 = "mac1", // Intel Macs
  Mac2 = "mac2", // Intel Macs with discrete GPU
  Common1 = "common1",
  Common2 = "common2",
  Common3 = "common3",
}

/**
 * Metal capabilities
 */
export interface MetalCapabilities {
  family: MetalFamily;
  supportsRaytracing: boolean;
  supportsMeshShaders: boolean;
  maxThreadgroupMemory: number;
  maxThreadsPerThreadgroup: number;
  maxBufferLength: number;
  simdGroupSize: number;
}

/**
 * Get Metal capabilities for Apple GPUs
 *
 * @param deviceName - Optional device name for more accurate detection
 * @returns Metal capabilities
 */
export function getMetalCapabilities(deviceName?: string): MetalCapabilities {
  // Default to Apple8 (M1) as a reasonable default for modern Apple Silicon
  let family = MetalFamily.Apple8;

  // Try to detect from device name
  if (deviceName) {
    const name = deviceName.toLowerCase();
    if (name.includes("m3") || name.includes("a17")) {
      family = MetalFamily.Apple9;
    } else if (name.includes("m2") || name.includes("a16") || name.includes("a15")) {
      family = MetalFamily.Apple9;
    } else if (name.includes("m1") || name.includes("a14")) {
      family = MetalFamily.Apple8;
    } else if (name.includes("intel")) {
      family = MetalFamily.Mac1;
    }
  }

  // Return capabilities based on family
  switch (family) {
    case MetalFamily.Apple9:
      return {
        family,
        supportsRaytracing: true,
        supportsMeshShaders: true,
        maxThreadgroupMemory: 64 * 1024, // 64KB
        maxThreadsPerThreadgroup: 1024,
        maxBufferLength: 256 * 1024 * 1024 * 1024, // 256GB
        simdGroupSize: 32,
      };

    case MetalFamily.Apple8:
      return {
        family,
        supportsRaytracing: true,
        supportsMeshShaders: true,
        maxThreadgroupMemory: 32 * 1024, // 32KB
        maxThreadsPerThreadgroup: 1024,
        maxBufferLength: 256 * 1024 * 1024 * 1024,
        simdGroupSize: 32,
      };

    case MetalFamily.Mac1:
      return {
        family,
        supportsRaytracing: false,
        supportsMeshShaders: false,
        maxThreadgroupMemory: 32 * 1024,
        maxThreadsPerThreadgroup: 1024,
        maxBufferLength: 1024 * 1024 * 1024, // 1GB
        simdGroupSize: 32,
      };

    default: {
      // Handle Mac2 and all other families with generic capabilities
      return {
        family,
        supportsRaytracing: false,
        supportsMeshShaders: false,
        maxThreadgroupMemory: 32 * 1024,
        maxThreadsPerThreadgroup: 1024,
        maxBufferLength: 1024 * 1024 * 1024, // 1GB
        simdGroupSize: 32,
      };
    }
  }
}

// ============================================================================
// ROCm (AMD) Capabilities
// ============================================================================

/**
 * AMD ROCm architectures
 */
export enum ROCmArchitecture {
  GFX900 = "gfx900", // Vega 10 (RX Vega 56/64)
  GFX906 = "gfx906", // Vega 20 (Radeon VII)
  GFX908 = "gfx908", // CDNA (MI100)
  GFX90a = "gfx90a", // CDNA2 (MI200)
  GFX940 = "gfx940", // CDNA3 (MI300)
  GFX1010 = "gfx1010", // RDNA (RX 5500/5600)
  GFX1030 = "gfx1030", // RDNA2 (RX 6000)
  GFX1100 = "gfx1100", // RDNA3 (RX 7000)
  Unknown = "unknown",
}

/**
 * ROCm capabilities
 */
export interface ROCmCapabilities {
  architecture: ROCmArchitecture;
  wavefrontSize: number;
  maxWavesPerCU: number;
  sharedMemoryPerCU: number;
  supportsRaytracing: boolean;
  supportsMatrixCores: boolean;
}

/**
 * Get ROCm capabilities for AMD GPUs
 *
 * @param deviceName - Optional device name for detection
 * @returns ROCm capabilities
 */
export function getROCmCapabilities(deviceName?: string): ROCmCapabilities {
  let arch = ROCmArchitecture.GFX1030; // Default to RDNA2

  if (deviceName) {
    const name = deviceName.toLowerCase();
    if (name.includes("7900") || name.includes("7800") || name.includes("7700")) {
      arch = ROCmArchitecture.GFX1100;
    } else if (name.includes("6900") || name.includes("6800") || name.includes("6700")) {
      arch = ROCmArchitecture.GFX1030;
    } else if (name.includes("mi300")) {
      arch = ROCmArchitecture.GFX940;
    } else if (name.includes("mi200") || name.includes("mi250")) {
      arch = ROCmArchitecture.GFX90a;
    }
  }

  switch (arch) {
    case ROCmArchitecture.GFX1100:
      return {
        architecture: arch,
        wavefrontSize: 32, // RDNA3 can use 32 or 64
        maxWavesPerCU: 32,
        sharedMemoryPerCU: 64 * 1024,
        supportsRaytracing: true,
        supportsMatrixCores: true,
      };

    case ROCmArchitecture.GFX1030:
      return {
        architecture: arch,
        wavefrontSize: 32,
        maxWavesPerCU: 32,
        sharedMemoryPerCU: 64 * 1024,
        supportsRaytracing: true,
        supportsMatrixCores: false,
      };

    case ROCmArchitecture.GFX940:
    case ROCmArchitecture.GFX90a:
      return {
        architecture: arch,
        wavefrontSize: 64,
        maxWavesPerCU: 40,
        sharedMemoryPerCU: 64 * 1024,
        supportsRaytracing: false,
        supportsMatrixCores: true,
      };

    default:
      return {
        architecture: arch,
        wavefrontSize: 64,
        maxWavesPerCU: 40,
        sharedMemoryPerCU: 32 * 1024,
        supportsRaytracing: false,
        supportsMatrixCores: false,
      };
  }
}

// ============================================================================
// CUDA (NVIDIA) Capabilities
// ============================================================================

/**
 * NVIDIA CUDA compute capabilities
 */
export enum CUDAComputeCapability {
  SM_50 = "sm_50", // Maxwell
  SM_60 = "sm_60", // Pascal
  SM_70 = "sm_70", // Volta
  SM_75 = "sm_75", // Turing
  SM_80 = "sm_80", // Ampere
  SM_86 = "sm_86", // Ampere (GA10x)
  SM_89 = "sm_89", // Ada Lovelace
  SM_90 = "sm_90", // Hopper
  Unknown = "unknown",
}

/**
 * CUDA capabilities
 */
export interface CUDACapabilities {
  computeCapability: CUDAComputeCapability;
  warpSize: number;
  maxThreadsPerBlock: number;
  maxSharedMemoryPerBlock: number;
  supportsRaytracing: boolean;
  supportsTensorCores: boolean;
  tensorCoreGenerations: number;
}

/**
 * Get CUDA capabilities for NVIDIA GPUs
 *
 * @param deviceName - Optional device name for detection
 * @returns CUDA capabilities
 */
export function getCUDACapabilities(deviceName?: string): CUDACapabilities {
  let cc = CUDAComputeCapability.SM_86; // Default to Ampere

  if (deviceName) {
    const name = deviceName.toLowerCase();
    if (
      name.includes("4090") || name.includes("4080") || name.includes("4070") ||
      name.includes("ada")
    ) {
      cc = CUDAComputeCapability.SM_89;
    } else if (name.includes("h100") || name.includes("hopper")) {
      cc = CUDAComputeCapability.SM_90;
    } else if (
      name.includes("3090") || name.includes("3080") || name.includes("3070") ||
      name.includes("a100")
    ) {
      cc = CUDAComputeCapability.SM_86;
    } else if (name.includes("a30") || name.includes("a40") || name.includes("ampere")) {
      cc = CUDAComputeCapability.SM_80;
    } else if (name.includes("2080") || name.includes("2070") || name.includes("turing")) {
      cc = CUDAComputeCapability.SM_75;
    } else if (name.includes("v100") || name.includes("volta")) {
      cc = CUDAComputeCapability.SM_70;
    }
  }

  switch (cc) {
    case CUDAComputeCapability.SM_90:
      return {
        computeCapability: cc,
        warpSize: 32,
        maxThreadsPerBlock: 1024,
        maxSharedMemoryPerBlock: 228 * 1024, // 228KB
        supportsRaytracing: true,
        supportsTensorCores: true,
        tensorCoreGenerations: 4,
      };

    case CUDAComputeCapability.SM_89:
      return {
        computeCapability: cc,
        warpSize: 32,
        maxThreadsPerBlock: 1024,
        maxSharedMemoryPerBlock: 100 * 1024, // 100KB
        supportsRaytracing: true,
        supportsTensorCores: true,
        tensorCoreGenerations: 4,
      };

    case CUDAComputeCapability.SM_86:
      return {
        computeCapability: cc,
        warpSize: 32,
        maxThreadsPerBlock: 1024,
        maxSharedMemoryPerBlock: 100 * 1024,
        supportsRaytracing: true,
        supportsTensorCores: true,
        tensorCoreGenerations: 3,
      };

    case CUDAComputeCapability.SM_80:
      return {
        computeCapability: cc,
        warpSize: 32,
        maxThreadsPerBlock: 1024,
        maxSharedMemoryPerBlock: 100 * 1024,
        supportsRaytracing: true,
        supportsTensorCores: true,
        tensorCoreGenerations: 3,
      };

    case CUDAComputeCapability.SM_75:
      return {
        computeCapability: cc,
        warpSize: 32,
        maxThreadsPerBlock: 1024,
        maxSharedMemoryPerBlock: 64 * 1024,
        supportsRaytracing: true,
        supportsTensorCores: true,
        tensorCoreGenerations: 2,
      };

    default:
      return {
        computeCapability: cc,
        warpSize: 32,
        maxThreadsPerBlock: 1024,
        maxSharedMemoryPerBlock: 48 * 1024,
        supportsRaytracing: false,
        supportsTensorCores: false,
        tensorCoreGenerations: 0,
      };
  }
}

// ============================================================================
// Re-export types
// ============================================================================

export { GPUVendor };

/**
 * Type alias for WebGPUX vendor (for backwards compatibility)
 */
export type WebGPUXVendor = GPUVendor;
