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
  type WebGPUEngineConfig,
  WebGPUEngineError,
  WebGPUEngineState,
  type WebGPUEngineStatistics,
} from "./WebGPU.ts";

// ============================================================================
// Core Types
// ============================================================================

export type {
  ByteCount,
  Duration,
  GPUBindGroupID,
  GPUBufferID,
  GPUCommandBufferID,
  GPUCommandEncoderID,
  GPUComputePassID,
  GPUComputePipelineID,
  GPUDeviceID,
  GPUIndex,
  GPURenderPassID,
  GPURenderPipelineID,
  GPUShaderModuleID,
  GPUSize,
  GPUTextureID,
  Nanoseconds,
  PipelineID,
  Pixels,
  Timestamp,
} from "../../types/webgpu.ts";

// LayerID from types
export type { LayerID } from "../../types/webgpu.ts";

export {
  GPUBufferState,
  GPUBufferUsageFlags,
  GPUDeviceState,
  GPUVendor,
} from "../../types/webgpu.ts";

// ============================================================================
// Device and Driver
// ============================================================================

export { type DeviceConfig, WebGPUDevice } from "./adapter/Device.ts";

export { type DriverConfig, DriverState, WebGPUDriver } from "./driver/mod.ts";

// ============================================================================
// Buffer Management
// ============================================================================

export * from "./buffer/mod.ts";

// ============================================================================
// Memory Management
// ============================================================================

export {
  BufferPool,
  type BufferPoolConfig,
  type BufferPoolStatistics,
  MemoryAllocator,
  MemoryManager,
  type StagingRingConfig,
} from "./memory/mod.ts";

// ============================================================================
// Pipeline Management
// ============================================================================

export {
  type ComputePipelineDescriptor,
  ComputePipelineManager,
  PipelineManager,
  type PipelineManagerConfig,
  type PipelineResult,
  type RenderPipelineDescriptor,
  RenderPipelineManager,
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
  BlendMode,
  type CompositorConfig,
  CompositorState,
  type CompositorStatistics,
  type DamageRect,
  type FrameTiming,
  type LayerDescriptor,
  type Transform,
  WebGPUCompositorThread,
} from "./compositor/WebGPUCompositorThread.ts";

export {
  type LayerConfig,
  LayerState,
  LayerType,
  WebGPUCompositorLayer,
} from "./compositor/WebGPUCompositorLayer.ts";

// ============================================================================
// Canvas Context
// ============================================================================

export {
  type CanvasContextConfig,
  CanvasState,
  WebGPUCanvasContext,
} from "./canvas/CanvasContext.ts";

// ============================================================================
// Texture Operations
// ============================================================================

export {
  type SamplerDescriptor,
  type TextureDescriptor,
  WebGPUTextureManager,
} from "./operations/render/TextureManager.ts";

// ============================================================================
// Compute Operations
// ============================================================================

export {
  type BindGroupResources,
  type BufferBinding,
  type ComputeConfig,
  type ComputePassConfig,
  ComputePipeline,
  ComputePipelineError,
  type ComputeStatistics,
  type DispatchDimensions,
  type SamplerBinding,
  type TextureBinding,
  type WorkgroupDimensions,
} from "./operations/compute/mod.ts";

// ============================================================================
// Command Encoding
// ============================================================================

export { WebGPUCommandEncoder } from "./encoder/mod.ts";

// ============================================================================
// Errors
// ============================================================================

export {
  GPUBufferError,
  GPUBufferMapError,
  GPUBufferStateError,
  GPUBufferUsageError,
  GPUDeviceError,
  GPUDeviceInitializationError,
  GPUDeviceLostError,
  GPUMemoryError,
  GPUPipelineError,
  GPUValidationError,
  WebGPUError,
} from "./errors.ts";

// ============================================================================
// Utilities
// ============================================================================

// GPU Type Detection
export {
  detectGPUVendor,
  getOptimalWorkgroupSize,
  getOptimalWorkgroupSizeForDevice,
  getVendorFeatures,
  getVendorName,
  isAMD,
  isApple,
  isIntel,
  isNVIDIA,
} from "./utils/DetectGPUType.ts";

// Re-export webgpu_x GPUVendor with alias to avoid conflict with types/webgpu.ts GPUVendor
export { GPUVendor as WebGPUXVendor } from "./utils/DetectGPUType.ts";

// System Detection
export {
  calculateCUDAOccupancy,
  calculateROCmOccupancy,
  darwinPreferredBackend,
  darwinRecommendedMemoryStrategy,
  detectPlatform,
  getCUDACapabilities,
  getMetalCapabilities,
  getROCmCapabilities,
  getSystemInfo,
  isAppleSilicon,
  isDarwin,
  isLinux,
  isWindows,
  linuxGetCpuCount,
  linuxGetPageSize,
  linuxGetTotalMemory,
  linuxHasIntelGpu,
  linuxHasNvidiaDriver,
  linuxHasRocmDriver,
  linuxIsArm,
  linuxPreferredBackend,
  linuxRecommendedMemoryStrategy,
  MetalFamily,
  openclOptimalWorkgroupSize,
  openclSupportsFp64,
  openclSupportsVersion,
  Platform,
  ROCmArchitecture,
  vulkanOptimalWorkgroupSize,
  vulkanRecommendedDescriptorSets,
  vulkanSupportsRaytracing,
  vulkanSupportsVersion,
  windowsGetLogicalProcessorCount,
  windowsGetPageSize,
  windowsHasAmdDriver,
  windowsHasDx12,
  windowsHasIntelDriver,
  windowsHasNvidiaDriver,
  windowsIsArm,
  windowsPreferredBackend,
  windowsRecommendedMemoryStrategy,
} from "./utils/DetectSystem.ts";

// ============================================================================
// Buffer Utilities
// ============================================================================

export {
  calculateAlignedSize,
  calculateTextureBufferSize,
  createStagingBelt,
  destroyStagingBelt,
  getBufferAlignment,
  getPaddedRowSize,
  getRowPadding,
  stagingBeltFinish,
  type StagingBeltStats,
  stagingBeltStats,
  stagingBeltWrite,
  type StagingWrite,
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
  clearShaderCache,
  createShaderCache,
  destroyShaderCache,
  getShaderCacheStats,
  hasShaderChanged,
  loadShader,
  type ShaderCacheStats,
  type ShaderSource,
  wgslBindingBuffer,
  wgslBindingSampler,
  wgslBindingTexture,
  wgslComputeEntry,
} from "./utils/ShaderHelpers.ts";

// ============================================================================
// Compute Kernels
// ============================================================================

export {
  generateAddKernel,
  generateConv2DKernel,
  generateKernel,
  generateMatMulKernel,
  generateReluKernel,
  generateSoftmaxKernel,
  KernelOperation,
} from "./utils/ComputeKernels.ts";

// ============================================================================
// Tensor Operations
// ============================================================================

export {
  createTensor,
  TensorAccess,
  TensorDType,
  tensorIsContiguous,
  type TensorMeta,
  tensorRank,
  tensorReshape,
  tensorSizeBytes,
  tensorTotalElements,
  tensorTranspose2D,
  tensorView,
} from "./utils/TensorHelpers.ts";

// ============================================================================
// Framework Helpers
// ============================================================================

export {
  createModelMatrix,
  createOrthographicMatrix,
  createPerspectiveMatrix,
  createViewMatrix,
  type DeviceConfig as WebGPUXDeviceConfig,
  getDefaultDeviceConfig,
  getOpenGLToWGPUMatrix,
} from "./utils/FrameworkHelpers.ts";

// ============================================================================
// Offscreen Rendering
// ============================================================================

export {
  OffscreenDeviceLostError,
  OffscreenWebGPU,
  type OffscreenWebGPUConfig,
  OffscreenWebGPUError,
  OffscreenWebGPUState,
  type OffscreenWebGPUStatistics,
} from "./offscreen/mod.ts";

// ============================================================================
// WGSL Shaders
// ============================================================================

export {
  // Shader sources
  COMPOSITOR_SHADER,
  CompositorEntryPoints,
  type CompositorFragmentEntryPoint,
  // Uniform buffer layout
  CompositorUniformOffsets,
  CompositorVertexLayout,
  createCompositorBindGroup,
  createCompositorBindGroupLayout,
  // Helper functions
  createCompositorShaderModule,
  createCompositorUniformBuffer,
  createFullScreenQuadBuffer,
  // Vertex data
  createFullScreenQuadVertices,
  createIdentityTransform,
  createScaleTransform,
  createTranslationTransform,
  writeCompositorUniforms,
} from "./shaders/mod.ts";
