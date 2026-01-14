/**
 * WebGPU Engine Module
 *
 * Complete WebGPU implementation for GPU-accelerated rendering and compute.
 * Exports all subsystems and utilities for browser rendering infrastructure.
 *
 * @module webgpu
 */

// ============================================================================
// Main Engine
// ============================================================================

export {
    WebGPUEngine,
    WebGPUEngineState,
    type WebGPUEngineConfig,
    type WebGPUEngineStatistics,
    WebGPUEngineError,
} from "./WebGPU.ts";

// ============================================================================
// Core Types
// ============================================================================

export type {
    GPUDeviceID,
    GPUBufferID,
    GPUTextureID,
    GPURenderPipelineID,
    GPUComputePipelineID,
    GPUBindGroupID,
    GPUShaderModuleID,
    GPUCommandBufferID,
    GPUCommandEncoderID,
    GPURenderPassID,
    GPUComputePassID,
    PipelineID,
    GPUSize,
    GPUIndex,
    Timestamp,
    Duration,
    Nanoseconds,
    ByteCount,
    Pixels,
} from "../../types/webgpu.ts";

// LayerID from types
export type { LayerID } from "../../types/webgpu.ts";

export {
    GPUDeviceState,
    GPUBufferState,
    GPUBufferUsageFlags,
    GPUVendor,
} from "../../types/webgpu.ts";

// ============================================================================
// Device and Driver
// ============================================================================

export {
    WebGPUDevice,
    type DeviceConfig,
} from "./adapter/Device.ts";

export {
    WebGPUDriver,
    DriverState,
    type DriverConfig,
} from "./driver/mod.ts";

// ============================================================================
// Buffer Management
// ============================================================================

export * from "./buffer/mod.ts";

// ============================================================================
// Memory Management
// ============================================================================

export {
    MemoryManager,
    BufferPool,
    MemoryAllocator,
    type BufferPoolConfig,
    type BufferPoolStatistics,
    type StagingRingConfig,
} from "./memory/mod.ts";

// ============================================================================
// Pipeline Management
// ============================================================================

export {
    PipelineManager,
    RenderPipelineManager,
    ComputePipelineManager,
    type RenderPipelineDescriptor,
    type ComputePipelineDescriptor,
    type PipelineManagerConfig,
} from "./pipelines/mod.ts";

export {
    CompositingPipeline,
    type CompositingPipelineConfig,
    type CompositingUniforms,
} from "./pipelines/CompositingPipeline.ts";

// ============================================================================
// Compositor
// ============================================================================

export {
    WebGPUCompositorThread,
    CompositorState,
    BlendMode,
    type CompositorConfig,
    type LayerDescriptor,
    type Transform,
    type DamageRect,
    type FrameTiming,
    type CompositorStatistics,
} from "./compositor/WebGPUCompositorThread.ts";

export {
    WebGPUCompositorLayer,
    LayerState,
    LayerType,
    type LayerConfig,
} from "./compositor/WebGPUCompositorLayer.ts";

// ============================================================================
// Canvas Context
// ============================================================================

export {
    WebGPUCanvasContext,
    CanvasState,
    type CanvasContextConfig,
} from "./canvas/CanvasContext.ts";

// ============================================================================
// Texture Operations
// ============================================================================

export {
    WebGPUTextureManager,
    type TextureDescriptor,
    type SamplerDescriptor,
} from "./operations/render/TextureManager.ts";

// ============================================================================
// Compute Operations
// ============================================================================

export {
    ComputePipeline,
    type WorkgroupDimensions,
    type DispatchDimensions,
    type ComputeConfig,
    type BufferBinding,
    type TextureBinding,
    type SamplerBinding,
    type BindGroupResources,
    type ComputePassConfig,
    type ComputeStatistics,
    ComputePipelineError,
} from "./operations/compute/mod.ts";

// ============================================================================
// Command Encoding
// ============================================================================

export {
    WebGPUCommandEncoder,
} from "./encoder/mod.ts";

// ============================================================================
// Errors
// ============================================================================

export {
    WebGPUError,
    GPUDeviceError,
    GPUDeviceInitializationError,
    GPUDeviceLostError,
    GPUValidationError,
    GPUBufferError,
    GPUBufferMapError,
    GPUBufferUsageError,
    GPUBufferStateError,
    GPUPipelineError,
    GPUMemoryError,
} from "./errors.ts";

// ============================================================================
// Utilities
// ============================================================================

// GPU Type Detection
export {
    detectGPUVendor,
    getVendorName,
    isNVIDIA,
    isAMD,
    isIntel,
    isApple,
    getOptimalWorkgroupSize,
    getOptimalWorkgroupSizeForDevice,
    getVendorFeatures,
} from "./utils/DetectGPUType.ts";

// Re-export webgpu_x GPUVendor with alias to avoid conflict with types/webgpu.ts GPUVendor
export { GPUVendor as WebGPUXVendor } from "./utils/DetectGPUType.ts";

// System Detection
export {
    Platform,
    MetalFamily,
    ROCmArchitecture,
    detectPlatform,
    isDarwin,
    isLinux,
    isWindows,
    isAppleSilicon,
    darwinPreferredBackend,
    darwinRecommendedMemoryStrategy,
    linuxIsArm,
    linuxGetCpuCount,
    linuxGetPageSize,
    linuxGetTotalMemory,
    linuxHasNvidiaDriver,
    linuxHasRocmDriver,
    linuxHasIntelGpu,
    linuxPreferredBackend,
    linuxRecommendedMemoryStrategy,
    windowsIsArm,
    windowsGetLogicalProcessorCount,
    windowsGetPageSize,
    windowsHasNvidiaDriver,
    windowsHasAmdDriver,
    windowsHasIntelDriver,
    windowsHasDx12,
    windowsPreferredBackend,
    windowsRecommendedMemoryStrategy,
    getMetalCapabilities,
    getROCmCapabilities,
    calculateROCmOccupancy,
    getCUDACapabilities,
    calculateCUDAOccupancy,
    vulkanOptimalWorkgroupSize,
    vulkanSupportsVersion,
    vulkanSupportsRaytracing,
    vulkanRecommendedDescriptorSets,
    openclOptimalWorkgroupSize,
    openclSupportsVersion,
    openclSupportsFp64,
    getSystemInfo,
} from "./utils/DetectSystem.ts";

// ============================================================================
// Buffer Utilities
// ============================================================================

export {
    createStagingBelt,
    stagingBeltWrite,
    stagingBeltFinish,
    stagingBeltStats,
    destroyStagingBelt,
    calculateAlignedSize,
    getBufferAlignment,
    calculateTextureBufferSize,
    getRowPadding,
    getPaddedRowSize,
    type StagingWrite,
    type StagingBeltStats,
} from "./utils/BufferHelpers.ts";

// ============================================================================
// Texture Utilities
// ============================================================================

export {
    calculateMipLevels,
    getMipSize,
    getMipSize3D,
    type MipSize,
    type MipSize3D,
} from "./utils/TextureHelpers.ts";

// ============================================================================
// Shader Utilities
// ============================================================================

export {
    createShaderCache,
    loadShader,
    hasShaderChanged,
    clearShaderCache,
    getShaderCacheStats,
    destroyShaderCache,
    wgslBindingBuffer,
    wgslBindingTexture,
    wgslBindingSampler,
    wgslComputeEntry,
    type ShaderCacheStats,
    type ShaderSource,
} from "./utils/ShaderHelpers.ts";

// ============================================================================
// Compute Kernels
// ============================================================================

export {
    generateKernel,
    generateAddKernel,
    generateMatMulKernel,
    generateConv2DKernel,
    generateReluKernel,
    generateSoftmaxKernel,
    KernelOperation,
} from "./utils/ComputeKernels.ts";

// ============================================================================
// Tensor Operations
// ============================================================================

export {
    createTensor,
    tensorSizeBytes,
    tensorRank,
    tensorTotalElements,
    tensorReshape,
    tensorTranspose2D,
    tensorView,
    tensorIsContiguous,
    TensorDType,
    TensorAccess,
    type TensorMeta,
} from "./utils/TensorHelpers.ts";

// ============================================================================
// Framework Helpers
// ============================================================================

export {
    getDefaultDeviceConfig,
    getOpenGLToWGPUMatrix,
    createPerspectiveMatrix,
    createOrthographicMatrix,
    createViewMatrix,
    createModelMatrix,
    type DeviceConfig as WebGPUXDeviceConfig,
} from "./utils/FrameworkHelpers.ts";
