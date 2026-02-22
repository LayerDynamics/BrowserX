/**
 * WebGPU Utilities Module
 *
 * Provides GPU vendor detection, platform detection, and system information
 * utilities for WebGPU integration.
 */

// ============================================================================
// TYPE EXTENSIONS
// ============================================================================

/**
 * Extended Navigator interface to include deprecated platform property
 * for browser fallback compatibility. This property is deprecated but
 * still widely available in browsers for architecture detection.
 */
interface NavigatorWithPlatform extends Navigator {
  readonly platform?: string;
}

// ============================================================================
// GPU VENDOR DETECTION
// ============================================================================

/**
 * GPU Vendor enumeration matching common PCI vendor IDs
 */
export enum GPUVendor {
  NVIDIA = "NVIDIA",
  AMD = "AMD",
  INTEL = "INTEL",
  APPLE = "APPLE",
  QUALCOMM = "QUALCOMM",
  ARM = "ARM",
  UNKNOWN = "UNKNOWN",
}

/**
 * Known GPU vendor PCI IDs
 */
const GPU_VENDOR_IDS: Record<number, GPUVendor> = {
  0x10de: GPUVendor.NVIDIA, // NVIDIA Corporation
  0x1002: GPUVendor.AMD, // Advanced Micro Devices, Inc.
  0x8086: GPUVendor.INTEL, // Intel Corporation
  0x106b: GPUVendor.APPLE, // Apple Inc.
  0x5143: GPUVendor.QUALCOMM, // Qualcomm
  0x13b5: GPUVendor.ARM, // ARM Ltd.
};

/**
 * Human-readable vendor names
 */
const VENDOR_NAMES: Record<GPUVendor, string> = {
  [GPUVendor.NVIDIA]: "NVIDIA Corporation",
  [GPUVendor.AMD]: "Advanced Micro Devices, Inc.",
  [GPUVendor.INTEL]: "Intel Corporation",
  [GPUVendor.APPLE]: "Apple Inc.",
  [GPUVendor.QUALCOMM]: "Qualcomm",
  [GPUVendor.ARM]: "ARM Ltd.",
  [GPUVendor.UNKNOWN]: "Unknown Vendor",
};

/**
 * Detect GPU vendor from PCI vendor ID
 * @param vendorId - PCI vendor ID (e.g., 0x10DE for NVIDIA)
 * @returns GPUVendor enum value
 */
export function detectGPUVendor(vendorId: number): GPUVendor {
  // Normalize to lowercase hex for lookup (IDs are case-insensitive)
  const normalizedId = vendorId & 0xffff; // Ensure 16-bit value
  return GPU_VENDOR_IDS[normalizedId] ?? GPUVendor.UNKNOWN;
}

/**
 * Get human-readable vendor name from PCI vendor ID
 * @param vendorId - PCI vendor ID
 * @returns Human-readable vendor name string
 */
export function getVendorName(vendorId: number): string {
  const vendor = detectGPUVendor(vendorId);
  return VENDOR_NAMES[vendor];
}

/**
 * Check if vendor ID corresponds to NVIDIA
 * @param vendorId - PCI vendor ID
 * @returns true if NVIDIA GPU
 */
export function isNVIDIA(vendorId: number): boolean {
  return detectGPUVendor(vendorId) === GPUVendor.NVIDIA;
}

/**
 * Check if vendor ID corresponds to AMD
 * @param vendorId - PCI vendor ID
 * @returns true if AMD GPU
 */
export function isAMD(vendorId: number): boolean {
  return detectGPUVendor(vendorId) === GPUVendor.AMD;
}

/**
 * Check if vendor ID corresponds to Intel
 * @param vendorId - PCI vendor ID
 * @returns true if Intel GPU
 */
export function isIntel(vendorId: number): boolean {
  return detectGPUVendor(vendorId) === GPUVendor.INTEL;
}

/**
 * Check if vendor ID corresponds to Apple
 * @param vendorId - PCI vendor ID
 * @returns true if Apple GPU
 */
export function isApple(vendorId: number): boolean {
  return detectGPUVendor(vendorId) === GPUVendor.APPLE;
}

// ============================================================================
// WORKGROUP SIZE OPTIMIZATION
// ============================================================================

/**
 * Optimal workgroup sizes by vendor for common compute workloads
 * These are tuned for typical GPU architectures
 */
const OPTIMAL_WORKGROUP_SIZES: Record<GPUVendor, number> = {
  [GPUVendor.NVIDIA]: 256, // Warp size 32, 8 warps optimal
  [GPUVendor.AMD]: 256, // Wavefront size 64, 4 wavefronts optimal
  [GPUVendor.INTEL]: 128, // EU subslice optimization
  [GPUVendor.APPLE]: 256, // Apple GPU threadgroup optimization
  [GPUVendor.QUALCOMM]: 128, // Adreno shader processor optimization
  [GPUVendor.ARM]: 64, // Mali GPU core optimization
  [GPUVendor.UNKNOWN]: 64, // Conservative default
};

/**
 * Calculate optimal workgroup size for a compute dispatch
 * @param problemSize - Total number of work items
 * @param maxWorkgroupSize - Maximum allowed workgroup size (from device limits)
 * @param vendorId - GPU vendor ID for vendor-specific optimization
 * @returns Optimal workgroup size
 */
export function getOptimalWorkgroupSize(
  problemSize: number,
  maxWorkgroupSize: number,
  vendorId: number,
): number {
  const vendor = detectGPUVendor(vendorId);
  const preferredSize = OPTIMAL_WORKGROUP_SIZES[vendor];

  // Clamp to device limit
  let workgroupSize = Math.min(preferredSize, maxWorkgroupSize);

  // For small problems, use smaller workgroups to avoid waste
  if (problemSize < workgroupSize) {
    // Round down to nearest power of 2 that fits
    workgroupSize = Math.max(1, 1 << Math.floor(Math.log2(problemSize)));
  }

  // Ensure workgroup size is a power of 2 (most efficient for GPU)
  if ((workgroupSize & (workgroupSize - 1)) !== 0) {
    workgroupSize = 1 << Math.floor(Math.log2(workgroupSize));
  }

  return workgroupSize;
}

// ============================================================================
// PLATFORM DETECTION
// ============================================================================

/**
 * Operating system platform enumeration
 */
export enum Platform {
  Darwin = "darwin",
  Windows = "windows",
  Linux = "linux",
  FreeBSD = "freebsd",
  Android = "android",
  iOS = "ios",
  Unknown = "unknown",
}

/**
 * Detect the current operating system platform
 * @returns Platform enum value
 */
export function detectPlatform(): Platform {
  // Deno provides Deno.build.os - this is the canonical way in Deno
  const os = Deno.build.os;
  switch (os) {
    case "darwin":
      return Platform.Darwin;
    case "windows":
      return Platform.Windows;
    case "linux":
      return Platform.Linux;
    case "freebsd":
      return Platform.FreeBSD;
    case "android":
      return Platform.Android;
    default:
      return Platform.Unknown;
  }
}

/**
 * Check if running on Apple Silicon (M1/M2/M3 chips)
 * @returns true if Apple Silicon detected
 */
export function isAppleSilicon(): boolean {
  // First check if we're on macOS
  if (detectPlatform() !== Platform.Darwin) {
    return false;
  }

  // Check Deno's architecture - Apple Silicon uses aarch64
  if (Deno.build.arch === "aarch64") {
    return true;
  }

  // Browser fallback - check for Apple Silicon hints via navigator platform
  // Cast to extended interface to access deprecated platform property
  const nav = navigator as NavigatorWithPlatform;
  if (nav.platform) {
    // Modern browsers on Apple Silicon report ARM architecture
    const platform = nav.platform.toLowerCase();
    if (platform.includes("arm") || platform.includes("aarch64")) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// SYSTEM INFO
// ============================================================================

/**
 * WebGPU backend preference
 */
export enum WebGPUBackend {
  Metal = "metal",
  Vulkan = "vulkan",
  D3D12 = "d3d12",
  D3D11 = "d3d11",
  OpenGL = "opengl",
  WebGPU = "webgpu",
}

/**
 * Memory allocation strategy
 */
export enum MemoryStrategy {
  Unified = "unified", // Unified memory (Apple Silicon, integrated GPUs)
  Discrete = "discrete", // Dedicated VRAM (discrete GPUs)
  Shared = "shared", // Shared system memory
}

/**
 * System information structure
 */
export interface SystemInfo {
  platform: Platform;
  version: string;
  arch: string;
  preferredBackend?: WebGPUBackend;
  memoryStrategy?: MemoryStrategy;
  cpuCores?: number;
  isAppleSilicon?: boolean;
}

/**
 * Get comprehensive system information for WebGPU optimization
 * @returns SystemInfo object with platform and capability details
 */
export function getSystemInfo(): SystemInfo {
  const platform = detectPlatform();
  const appleSilicon = isAppleSilicon();

  // Get Deno-specific info
  const arch = Deno.build.arch;
  const version = Deno.version.deno;

  // CPU cores if available
  let cpuCores: number | undefined;
  try {
    cpuCores = navigator?.hardwareConcurrency;
  } catch {
    // Permission denied or not available
  }

  // Determine preferred backend based on platform
  let preferredBackend: WebGPUBackend | undefined;
  switch (platform) {
    case Platform.Darwin:
      preferredBackend = WebGPUBackend.Metal;
      break;
    case Platform.Windows:
      preferredBackend = WebGPUBackend.D3D12;
      break;
    case Platform.Linux:
    case Platform.FreeBSD:
    case Platform.Android:
      preferredBackend = WebGPUBackend.Vulkan;
      break;
    case Platform.iOS:
      preferredBackend = WebGPUBackend.Metal;
      break;
    default:
      preferredBackend = undefined;
  }

  // Determine memory strategy
  let memoryStrategy: MemoryStrategy | undefined;
  if (appleSilicon) {
    memoryStrategy = MemoryStrategy.Unified;
  } else if (platform === Platform.Darwin || platform === Platform.iOS) {
    // Intel Macs or older devices may have integrated GPUs
    memoryStrategy = MemoryStrategy.Shared;
  }
  // For other platforms, we'd need GPU info to determine this

  return {
    platform,
    version,
    arch,
    preferredBackend,
    memoryStrategy,
    cpuCores,
    isAppleSilicon: appleSilicon,
  };
}

// ============================================================================
// RE-EXPORTS FOR CONVENIENCE
// ============================================================================

export type { SystemInfo as WebGPUSystemInfo };
