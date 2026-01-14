/**
 * WebGPU Extensions TypeScript Wrapper
 *
 * Provides high-level API over webgpu_x FFI bindings.
 */

import {
  // Initialization
  webgpu_x_init,
  webgpu_x_version,
  webgpu_x_get_last_error,

  // GPU Detection
  detect_gpu_vendor,
  get_optimal_workgroup_size,

  // Buffer Pool
  buffer_pool_acquire,
  buffer_pool_release,
  buffer_pool_add,
  buffer_pool_remove,
  buffer_pool_clear,
  buffer_pool_evict,

  // Staging Belt
  staging_belt_create,
  staging_belt_write,
  staging_belt_finish,
  staging_belt_stats,
  staging_belt_destroy,

  // Buffer Initialization
  buffer_calculate_aligned_size,
  buffer_get_alignment,
  buffer_get_row_padding,
  buffer_get_padded_row_size,
  buffer_calculate_texture_buffer_size,

  // Texture Utilities
  texture_calculate_mip_levels,
  texture_get_mip_size,
  texture_get_mip_size_3d,

  // Shader Compilation
  shader_cache_create,
  shader_detect_stage,
  shader_cache_stats,
  shader_cache_has_changed,
  shader_cache_clear,
  shader_cache_destroy,
  shader_cache_load,
  shader_cache_load_from_string,

  // WGSL Code Generation
  wgsl_binding_buffer,
  wgsl_binding_uniform,
  wgsl_binding_texture,
  wgsl_binding_sampler,
  wgsl_struct,
  wgsl_struct_field,
  wgsl_vertex_entry,
  wgsl_fragment_entry,
  wgsl_compute_entry,
  wgsl_builtin,
  wgsl_location,
  wgsl_function,
  wgsl_minify,
  wgsl_line_count,
  wgsl_extract_functions,

  // Compute Kernel Templates
  kernel_generate_from_template,

  // Tensor Operations
  tensor_create,
  tensor_size_bytes,
  tensor_rank,
  tensor_total_elements,
  tensor_reshape,
  tensor_transpose_2d,
  tensor_view,
  tensor_is_contiguous,
  tensor_get_shape,
  tensor_get_strides,

  // Framework Helpers
  framework_device_config_default,
  framework_matrix_opengl_to_wgpu,
  framework_matrix_perspective,
  framework_matrix_orthographic,
  framework_matrix_view,
  framework_matrix_model,

  // Platform Detection - Darwin
  darwin_is_apple_silicon,
  darwin_preferred_backend,
  darwin_recommended_memory_strategy,

  // Platform Detection - Linux
  linux_is_arm,
  linux_get_cpu_count,
  linux_get_page_size,
  linux_get_total_memory,
  linux_has_nvidia_driver,
  linux_has_rocm_driver,
  linux_has_intel_gpu,
  linux_preferred_backend,
  linux_recommended_memory_strategy,

  // Platform Detection - Windows
  windows_is_arm,
  windows_get_logical_processor_count,
  windows_get_page_size,
  windows_has_nvidia_driver,
  windows_has_amd_driver,
  windows_has_intel_driver,
  windows_has_dx12,
  windows_preferred_backend,
  windows_recommended_memory_strategy,

  // Metal
  metal_optimal_workgroup_size,
  metal_simd_group_size,
  metal_max_threadgroup_memory,
  metal_supports_raytracing,
  metal_supports_tier2_argument_buffers,

  // ROCm
  rocm_optimal_workgroup_size,
  rocm_wavefront_size,
  rocm_lds_size_per_cu,
  rocm_has_matrix_cores,
  rocm_supports_fp64,
  rocm_calculate_occupancy,

  // CUDA
  cuda_optimal_workgroup_size,
  cuda_shared_memory_bank_size,
  cuda_has_tensor_cores,
  cuda_calculate_occupancy,

  // Vulkan
  vulkan_optimal_workgroup_size,
  vulkan_supports_version,
  vulkan_supports_raytracing,
  vulkan_recommended_descriptor_sets,

  // OpenCL
  opencl_optimal_workgroup_size,
  opencl_supports_version,
  opencl_supports_fp64,

  // Types
  type DarwinSystemInfo,
  type LinuxSystemInfo,
  type WindowsSystemInfo,
  type WebGPUXError,
  type StagingWrite,
  type StagingBeltStats,
  type MipSize,
  type MipSize3D,
  type ShaderCacheStats,
} from "./bindings/bindings.ts";

/**
 * Shader source with metadata
 * Returned by shader cache load operations
 */
export interface ShaderSource {
  /** Shader source code (WGSL) */
  code: string;
  /** Shader stage: 0=Vertex, 1=Fragment, 2=Compute */
  stage: number;
  /** Entry point function name */
  entry_point: string;
  /** Optional file path if loaded from file */
  file_path?: string | null;
  /** Last modification time (Unix timestamp) */
  last_modified: number;
}

/**
 * GPU Vendor enumeration (matches Rust GPUVendor)
 * Maps to u32 values: 0=NVIDIA, 1=AMD, 2=Intel, 3=Apple, 4=Qualcomm, 5=ARM, 6=Unknown
 */
export enum GPUVendor {
  NVIDIA = 0,
  AMD = 1,
  Intel = 2,
  Apple = 3,
  Qualcomm = 4,
  ARM = 5,
  Unknown = 6,
}

/**
 * Metal GPU family enumeration (matches Rust MetalFamily)
 * Maps to u32 values: 0-8=Apple1-9, 9=Mac1, 10=Mac2, 11=Unknown
 */
export enum MetalFamily {
  Apple1 = 0,
  Apple2 = 1,
  Apple3 = 2,
  Apple4 = 3,
  Apple5 = 4,
  Apple6 = 5,
  Apple7 = 6,
  Apple8 = 7,
  Apple9 = 8,
  Mac1 = 9,
  Mac2 = 10,
  Unknown = 11,
}

/**
 * ROCm GPU architecture enumeration (matches Rust ROCmArchitecture)
 * Maps to u32 values: 0=GCN, 1=RDNA, 2=RDNA2, 3=RDNA3, 4=CDNA, 5=CDNA2, 6=CDNA3, 7=Unknown
 */
export enum ROCmArchitecture {
  GCN = 0,
  RDNA = 1,
  RDNA2 = 2,
  RDNA3 = 3,
  CDNA = 4,
  CDNA2 = 5,
  CDNA3 = 6,
  Unknown = 7,
}

/**
 * Kernel operation enumeration (matches Rust KernelOperation)
 * Maps to u32 values for template-based kernel generation
 */
export enum KernelOperation {
  /** Element-wise addition: C = A + B */
  Add = 0,
  /** Element-wise subtraction: C = A - B */
  Subtract = 1,
  /** Element-wise multiplication: C = A * B */
  Multiply = 2,
  /** Element-wise division: C = A / B */
  Divide = 3,
  /** Matrix multiplication: C = A * B */
  MatrixMultiply = 4,
  /** 1D Convolution */
  Conv1D = 5,
  /** 2D Convolution */
  Conv2D = 6,
  /** ReLU activation: max(0, x) */
  Relu = 7,
  /** Sigmoid activation: 1 / (1 + exp(-x)) */
  Sigmoid = 8,
  /** Tanh activation */
  Tanh = 9,
  /** Softmax activation */
  Softmax = 10,
  /** Layer normalization */
  LayerNorm = 11,
  /** Batch normalization */
  BatchNorm = 12,
  /** Max pooling 2D */
  MaxPool2D = 13,
  /** Average pooling 2D */
  AvgPool2D = 14,
  /** Transpose matrix */
  Transpose = 15,
  /** Reduce sum along axis */
  ReduceSum = 16,
  /** Reduce max along axis */
  ReduceMax = 17,
  /** Reduce mean along axis */
  ReduceMean = 18,
}

/**
 * Tensor data type
 */
export enum TensorDType {
  /** 32-bit floating point */
  Float32 = 0,
  /** 16-bit floating point */
  Float16 = 1,
  /** 32-bit signed integer */
  Int32 = 2,
  /** 8-bit signed integer */
  Int8 = 3,
  /** 8-bit unsigned integer */
  UInt8 = 4,
}

/**
 * Tensor access pattern for GPU buffers
 */
export enum TensorAccess {
  /** Read-only storage buffer */
  ReadOnly = 0,
  /** Write-only storage buffer */
  WriteOnly = 1,
  /** Read-write storage buffer */
  ReadWrite = 2,
  /** Uniform buffer */
  Uniform = 3,
}

/**
 * Tensor shape with dimensions
 */
export interface TensorShape {
  dimensions: number[];
}

/**
 * Tensor metadata for GPU tensors
 */
export interface TensorMeta {
  buffer_handle: bigint;
  shape: TensorShape;
  dtype: TensorDType;
  access: TensorAccess;
  offset: bigint;
  stride: bigint[];
}

/**
 * Device configuration for WebGPU device initialization
 */
export interface DeviceConfig {
  /** Required features that must be supported */
  required_features: string[];
  /** Optional features to enable if available */
  optional_features: string[];
  /** Required limits (name -> value) */
  required_limits: Record<string, number>;
}

/**
 * Main WebGPUX class providing high-level API
 */
export class WebGPUX {
  private initialized = false;

  constructor() {
    const result = webgpu_x_init();
    this.initialized = result === 1;
    if (!this.initialized) {
      throw new Error(`Failed to initialize webgpu_x: ${this.getLastError()}`);
    }
  }

  /**
   * Get library version
   */
  get version(): string {
    return webgpu_x_version();
  }

  /**
   * Get last error message (if any)
   */
  getLastError(): string {
    return webgpu_x_get_last_error();
  }

  // ============================================================================
  // GPU Detection
  // ============================================================================

  /**
   * Detect GPU vendor from PCI vendor ID
   * @param vendorId - PCI vendor ID (e.g., 0x10DE for NVIDIA)
   * @returns GPUVendor enum value
   */
  detectVendor(vendorId: number): GPUVendor {
    return detect_gpu_vendor(vendorId);
  }

  /**
   * Get vendor name from vendor ID
   * @param vendorId - PCI vendor ID
   * @returns Vendor name string
   */
  getVendorName(vendorId: number): string {
    const vendor = this.detectVendor(vendorId);
    return GPUVendor[vendor];
  }

  /**
   * Get optimal workgroup size for a given problem
   * @param problemSize - Size of the problem
   * @param maxWorkgroupSize - Maximum workgroup size supported by device
   * @param vendor - GPU vendor (GPUVendor enum)
   * @returns Optimal workgroup size
   */
  getOptimalWorkgroupSize(
    problemSize: number,
    maxWorkgroupSize: number,
    vendor: GPUVendor,
  ): number {
    return get_optimal_workgroup_size(problemSize, maxWorkgroupSize, vendor);
  }

  // ============================================================================
  // Buffer Pool Management
  // ============================================================================

  /**
   * Acquire a buffer from the pool
   * @param size - Buffer size in bytes
   * @param usage - Buffer usage flags (wgpu::BufferUsages bits)
   * @returns Buffer handle (0 if allocation failed)
   */
  acquireBuffer(size: bigint, usage: number): bigint {
    return buffer_pool_acquire(size, usage);
  }

  /**
   * Release a buffer back to the pool
   * @param handle - Buffer handle
   */
  releaseBuffer(handle: bigint): void {
    buffer_pool_release(handle);
  }

  /**
   * Add a buffer to the pool
   * @param handle - Buffer handle
   * @param size - Buffer size in bytes
   * @param usage - Buffer usage flags
   */
  addBuffer(handle: bigint, size: bigint, usage: number): void {
    buffer_pool_add(handle, size, usage);
  }

  /**
   * Remove a buffer from the pool
   * @param handle - Buffer handle
   */
  removeBuffer(handle: bigint): void {
    buffer_pool_remove(handle);
  }

  /**
   * Clear all buffers from the pool
   */
  clearBufferPool(): void {
    buffer_pool_clear();
  }

  /**
   * Evict old unused buffers from the pool
   */
  evictBuffers(): void {
    buffer_pool_evict();
  }

  // ============================================================================
  // Staging Belt Operations
  // ============================================================================

  /**
   * Create a new staging belt with specified chunk size
   * @param chunkSize - Chunk size in bytes (typically 256KB to 1MB)
   * @returns Staging belt handle
   */
  createStagingBelt(chunkSize: bigint): bigint {
    return staging_belt_create(chunkSize);
  }

  /**
   * Write data to staging buffer
   * @param beltHandle - Staging belt handle
   * @param size - Size of data to write in bytes
   * @returns StagingWrite with buffer_handle, offset, and size
   */
  stagingBeltWrite(beltHandle: bigint, size: bigint): StagingWrite {
    return staging_belt_write(beltHandle, size);
  }

  /**
   * Finish current frame and recover completed buffers
   * @param beltHandle - Staging belt handle
   */
  stagingBeltFinish(beltHandle: bigint): void {
    staging_belt_finish(beltHandle);
  }

  /**
   * Get staging belt statistics
   * @param beltHandle - Staging belt handle
   * @returns StagingBeltStats with active/free chunks and memory usage
   */
  stagingBeltStats(beltHandle: bigint): StagingBeltStats {
    return staging_belt_stats(beltHandle);
  }

  /**
   * Destroy a staging belt
   * @param beltHandle - Staging belt handle
   */
  destroyStagingBelt(beltHandle: bigint): void {
    staging_belt_destroy(beltHandle);
  }

  // ============================================================================
  // Buffer Initialization Helpers
  // ============================================================================

  /**
   * Calculate aligned size for buffer
   * @param size - Unaligned size in bytes
   * @param alignment - Required alignment (must be power of 2)
   * @returns Aligned size in bytes
   */
  bufferCalculateAlignedSize(size: bigint, alignment: bigint): bigint {
    return buffer_calculate_aligned_size(size, alignment);
  }

  /**
   * Get alignment requirement for buffer usage
   * @param usage - Buffer usage flags (GPUBufferUsage)
   * @returns Required alignment in bytes (4 or 256)
   */
  bufferGetAlignment(usage: number): bigint {
    return buffer_get_alignment(usage);
  }

  /**
   * Calculate row padding for texture buffer copies
   * @param rowSize - Row size in bytes
   * @returns Padding bytes needed to reach 256-byte alignment
   */
  bufferGetRowPadding(rowSize: bigint): bigint {
    return buffer_get_row_padding(rowSize);
  }

  /**
   * Calculate padded row size for texture copies
   * @param rowSize - Row size in bytes
   * @returns Padded row size aligned to 256 bytes
   */
  bufferGetPaddedRowSize(rowSize: bigint): bigint {
    return buffer_get_padded_row_size(rowSize);
  }

  /**
   * Calculate total buffer size needed for texture data with padding
   * @param width - Texture width in pixels
   * @param height - Texture height in pixels
   * @param bytesPerPixel - Bytes per pixel (e.g., 4 for RGBA8)
   * @returns Total buffer size in bytes including padding
   */
  bufferCalculateTextureBufferSize(
    width: number,
    height: number,
    bytesPerPixel: number,
  ): bigint {
    return buffer_calculate_texture_buffer_size(width, height, bytesPerPixel);
  }

  // ============================================================================
  // Texture Utilities
  // ============================================================================

  /**
   * Calculate mipmap level count for texture dimensions
   * @param width - Texture width in pixels
   * @param height - Texture height in pixels
   * @returns Number of mipmap levels (including base level)
   * @example
   * const levels = textureCalculateMipLevels(1024, 1024);
   * // Returns 11 (log2(1024) + 1)
   */
  textureCalculateMipLevels(width: number, height: number): number {
    return texture_calculate_mip_levels(width, height);
  }

  /**
   * Calculate texture dimensions at specific mip level
   * @param width - Base texture width
   * @param height - Base texture height
   * @param mipLevel - Mipmap level (0 = base level)
   * @returns Object with width and height at the specified mip level
   * @example
   * const size = textureGetMipSize(1024, 1024, 1);
   * // Returns { width: 512, height: 512 }
   */
  textureGetMipSize(
    width: number,
    height: number,
    mipLevel: number,
  ): MipSize {
    return texture_get_mip_size(width, height, mipLevel);
  }

  /**
   * Calculate 3D texture dimensions at specific mip level
   * @param width - Base texture width
   * @param height - Base texture height
   * @param depth - Base texture depth
   * @param mipLevel - Mipmap level (0 = base level)
   * @returns Object with width, height, and depth at the specified mip level
   */
  textureGetMipSize3D(
    width: number,
    height: number,
    depth: number,
    mipLevel: number,
  ): MipSize3D {
    return texture_get_mip_size_3d(width, height, depth, mipLevel);
  }

  // ============================================================================
  // Shader Compilation & Hot-Reload
  // ============================================================================

  /**
   * Create a new shader cache for hot-reload functionality
   * @returns Shader cache handle
   */
  createShaderCache(): bigint {
    return shader_cache_create();
  }

  /**
   * Detect shader stage from file extension
   * @param filePath - Path to shader file
   * @returns Shader stage: 0=Vertex, 1=Fragment, 2=Compute
   * @example
   * const stage = shaderDetectStage("shader.vert");
   * // Returns 0 (Vertex)
   */
  shaderDetectStage(filePath: string): number {
    return shader_detect_stage(filePath);
  }

  /**
   * Get shader cache statistics
   * @param cacheHandle - Shader cache handle
   * @returns Statistics about cached shaders
   */
  shaderCacheStats(cacheHandle: bigint): ShaderCacheStats {
    return shader_cache_stats(cacheHandle);
  }

  /**
   * Check if a shader file has changed since last load
   * @param cacheHandle - Shader cache handle
   * @param filePath - Path to shader file
   * @returns true if file has changed, false otherwise
   */
  shaderCacheHasChanged(cacheHandle: bigint, filePath: string): boolean {
    return shader_cache_has_changed(cacheHandle, filePath) === 1;
  }

  /**
   * Clear all cached shaders
   * @param cacheHandle - Shader cache handle
   */
  shaderCacheClear(cacheHandle: bigint): void {
    shader_cache_clear(cacheHandle);
  }

  /**
   * Destroy a shader cache
   * @param cacheHandle - Shader cache handle
   */
  destroyShaderCache(cacheHandle: bigint): void {
    shader_cache_destroy(cacheHandle);
  }

  /**
   * Load shader from file with hot-reload support
   * @param cacheHandle - Shader cache handle
   * @param filePath - Path to shader file
   * @returns Shader source object or null on error
   */
  shaderCacheLoad(cacheHandle: bigint, filePath: string): ShaderSource | null {
    const json = shader_cache_load(cacheHandle, filePath);
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  /**
   * Load shader from string with custom stage and entry point
   * @param cacheHandle - Shader cache handle
   * @param code - Shader source code
   * @param stage - Shader stage: 0=Vertex, 1=Fragment, 2=Compute
   * @param entryPoint - Entry point function name (e.g., "main")
   * @returns Shader source object or null on error
   */
  shaderCacheLoadFromString(
    cacheHandle: bigint,
    code: string,
    stage: number,
    entryPoint: string
  ): ShaderSource | null {
    const json = shader_cache_load_from_string(cacheHandle, code, stage, entryPoint);
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  // ============================================================================
  // WGSL Code Generation
  // ============================================================================

  /**
   * Generate WGSL storage buffer binding declaration
   * @param group - Bind group index
   * @param binding - Binding index
   * @param varName - Variable name
   * @param access - Access mode: "read", "read_write"
   * @returns WGSL binding code
   * @example
   * wgslBindingBuffer(0, 0, "input_data", "read")
   * // Returns: "@group(0) @binding(0) var<storage, read> input_data: array<f32>;"
   */
  wgslBindingBuffer(group: number, binding: number, varName: string, access: string): string {
    return wgsl_binding_buffer(group, binding, varName, access);
  }

  /**
   * Generate WGSL uniform binding declaration
   * @param group - Bind group index
   * @param binding - Binding index
   * @param varName - Variable name
   * @param structName - Uniform struct type name
   * @returns WGSL binding code
   * @example
   * wgslBindingUniform(0, 0, "params", "Uniforms")
   * // Returns: "@group(0) @binding(0) var<uniform> params: Uniforms;"
   */
  wgslBindingUniform(group: number, binding: number, varName: string, structName: string): string {
    return wgsl_binding_uniform(group, binding, varName, structName);
  }

  /**
   * Generate WGSL texture binding declaration
   * @param group - Bind group index
   * @param binding - Binding index
   * @param varName - Variable name
   * @param textureType - Texture type (e.g., "texture_2d<f32>")
   * @returns WGSL binding code
   */
  wgslBindingTexture(group: number, binding: number, varName: string, textureType: string): string {
    return wgsl_binding_texture(group, binding, varName, textureType);
  }

  /**
   * Generate WGSL sampler binding declaration
   * @param group - Bind group index
   * @param binding - Binding index
   * @param varName - Variable name
   * @returns WGSL binding code
   */
  wgslBindingSampler(group: number, binding: number, varName: string): string {
    return wgsl_binding_sampler(group, binding, varName);
  }

  /**
   * Generate WGSL struct definition
   * @param name - Struct name
   * @param fields - Array of struct field declarations
   * @returns WGSL struct code
   * @example
   * wgslStruct("Uniforms", ["time: f32", "resolution: vec2<f32>"])
   * // Returns: "struct Uniforms {\n    time: f32,\n    resolution: vec2<f32>,\n}"
   */
  wgslStruct(name: string, fields: string[]): string {
    return wgsl_struct(name, JSON.stringify(fields));
  }

  /**
   * Generate WGSL struct field declaration
   * @param name - Field name
   * @param typeName - Field type
   * @returns WGSL field declaration
   * @example
   * wgslStructField("position", "vec3<f32>")
   * // Returns: "position: vec3<f32>"
   */
  wgslStructField(name: string, typeName: string): string {
    return wgsl_struct_field(name, typeName);
  }

  /**
   * Generate WGSL vertex shader entry point
   * @param name - Function name (usually "main")
   * @param inputs - Array of input parameter declarations
   * @param outputs - Array of output declarations
   * @param body - Function body code
   * @returns Complete vertex shader function
   */
  wgslVertexEntry(name: string, inputs: string[], outputs: string[], body: string): string {
    return wgsl_vertex_entry(name, JSON.stringify(inputs), JSON.stringify(outputs), body);
  }

  /**
   * Generate WGSL fragment shader entry point
   * @param name - Function name (usually "main")
   * @param inputs - Array of input parameter declarations
   * @param outputs - Array of output declarations
   * @param body - Function body code
   * @returns Complete fragment shader function
   */
  wgslFragmentEntry(name: string, inputs: string[], outputs: string[], body: string): string {
    return wgsl_fragment_entry(name, JSON.stringify(inputs), JSON.stringify(outputs), body);
  }

  /**
   * Generate WGSL compute shader entry point
   * @param name - Function name (usually "main")
   * @param workgroupX - Workgroup size X dimension
   * @param workgroupY - Workgroup size Y dimension
   * @param workgroupZ - Workgroup size Z dimension
   * @param inputs - Array of input parameter declarations
   * @param body - Function body code
   * @returns Complete compute shader function
   * @example
   * wgslComputeEntry("main", 64, 1, 1, ["@builtin(global_invocation_id) id: vec3<u32>"], "// shader code")
   */
  wgslComputeEntry(
    name: string,
    workgroupX: number,
    workgroupY: number,
    workgroupZ: number,
    inputs: string[],
    body: string
  ): string {
    return wgsl_compute_entry(name, workgroupX, workgroupY, workgroupZ, JSON.stringify(inputs), body);
  }

  /**
   * Generate WGSL builtin attribute
   * @param name - Variable name
   * @param builtinType - Builtin type (e.g., "global_invocation_id", "position")
   * @returns WGSL builtin declaration
   * @example
   * wgslBuiltin("id", "global_invocation_id")
   * // Returns: "@builtin(global_invocation_id) id"
   */
  wgslBuiltin(name: string, builtinType: string): string {
    return wgsl_builtin(name, builtinType);
  }

  /**
   * Generate WGSL location attribute
   * @param name - Variable name
   * @param location - Location index
   * @param typeName - Variable type
   * @returns WGSL location declaration
   * @example
   * wgslLocation("color", 0, "vec4<f32>")
   * // Returns: "@location(0) color: vec4<f32>"
   */
  wgslLocation(name: string, location: number, typeName: string): string {
    return wgsl_location(name, location, typeName);
  }

  /**
   * Generate WGSL function
   * @param name - Function name
   * @param params - Array of parameter declarations
   * @param returnType - Return type (empty string for void)
   * @param body - Function body code
   * @returns Complete function declaration
   */
  wgslFunction(name: string, params: string[], returnType: string, body: string): string {
    return wgsl_function(name, JSON.stringify(params), returnType, body);
  }

  /**
   * Minify WGSL shader code by removing comments and excess whitespace
   * @param shaderCode - Original shader code
   * @returns Minified shader code
   */
  wgslMinify(shaderCode: string): string {
    return wgsl_minify(shaderCode);
  }

  /**
   * Count lines in shader code
   * @param shaderCode - Shader source code
   * @returns Number of lines
   */
  wgslLineCount(shaderCode: string): number {
    return wgsl_line_count(shaderCode);
  }

  /**
   * Extract function names from shader code
   * @param shaderCode - Shader source code
   * @returns Array of function names
   */
  wgslExtractFunctions(shaderCode: string): string[] {
    const json = wgsl_extract_functions(shaderCode);
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  }

  // ============================================================================
  // Compute Kernel Templates
  // ============================================================================

  /**
   * Generate complete compute kernel from pre-built templates
   * @param operation - Kernel operation type (see KernelOperation enum)
   * @param workgroupX - Workgroup size X dimension (typically 64, 256, or 1024)
   * @param workgroupY - Workgroup size Y dimension (typically 1 for 1D, 16 for 2D)
   * @param workgroupZ - Workgroup size Z dimension (typically 1)
   * @returns Complete WGSL compute shader code ready for createShaderModule
   * @example
   * // Generate matrix multiplication kernel
   * const matmulShader = webgpuX.kernelGenerateFromTemplate(
   *   KernelOperation.MatrixMultiply,
   *   16, 16, 1
   * );
   *
   * // Generate ReLU activation kernel
   * const reluShader = webgpuX.kernelGenerateFromTemplate(
   *   KernelOperation.Relu,
   *   256, 1, 1
   * );
   */
  kernelGenerateFromTemplate(
    operation: KernelOperation,
    workgroupX: number,
    workgroupY: number,
    workgroupZ: number
  ): string {
    return kernel_generate_from_template(operation, workgroupX, workgroupY, workgroupZ);
  }

  // ============================================================================
  // Tensor Operations
  // ============================================================================

  /**
   * Helper: Serialize tensor for FFI (convert BigInt to Number for JSON)
   */
  private serializeTensor(tensor: TensorMeta): string {
    return JSON.stringify({
      ...tensor,
      buffer_handle: Number(tensor.buffer_handle),
      offset: Number(tensor.offset),
      stride: tensor.stride.map(s => Number(s))
    });
  }

  /**
   * Helper: Parse tensor from FFI (convert Number to BigInt)
   */
  private parseTensor(json: string): TensorMeta | null {
    try {
      const parsed = JSON.parse(json);
      return {
        buffer_handle: BigInt(parsed.buffer_handle),
        shape: parsed.shape,
        dtype: parsed.dtype,
        access: parsed.access,
        offset: BigInt(parsed.offset),
        stride: parsed.stride.map((s: number) => BigInt(s))
      };
    } catch {
      return null;
    }
  }

  /**
   * Create tensor metadata for GPU tensor operations
   * @param bufferHandle - GPU buffer handle
   * @param dimensions - Array of tensor dimensions (e.g., [2, 3, 4] for 3D tensor)
   * @param dtype - Data type (Float32, Float16, Int32, Int8, UInt8)
   * @param access - Access pattern (ReadOnly, WriteOnly, ReadWrite, Uniform)
   * @returns Tensor metadata object or null on error
   * @example
   * // Create a 2x3x4 float32 tensor
   * const tensor = webgpuX.tensorCreate(bufferHandle, [2, 3, 4], TensorDType.Float32, TensorAccess.ReadWrite);
   */
  tensorCreate(
    bufferHandle: bigint,
    dimensions: number[],
    dtype: TensorDType,
    access: TensorAccess
  ): TensorMeta | null {
    const json = tensor_create(bufferHandle, JSON.stringify(dimensions), dtype, access);
    if (!json) return null;
    return this.parseTensor(json);
  }

  /**
   * Get tensor size in bytes
   * @param tensor - Tensor metadata
   * @returns Size in bytes
   * @example
   * const size = webgpuX.tensorSizeBytes(tensor);
   * console.log(`Tensor size: ${size} bytes`);
   */
  tensorSizeBytes(tensor: TensorMeta): bigint {
    return BigInt(tensor_size_bytes(this.serializeTensor(tensor)));
  }

  /**
   * Get tensor rank (number of dimensions)
   * @param tensor - Tensor metadata
   * @returns Number of dimensions
   * @example
   * const rank = webgpuX.tensorRank(tensor);  // Returns 3 for [2, 3, 4]
   */
  tensorRank(tensor: TensorMeta): number {
    return tensor_rank(this.serializeTensor(tensor));
  }

  /**
   * Get total number of elements in tensor
   * @param tensor - Tensor metadata
   * @returns Total number of elements
   * @example
   * const elements = webgpuX.tensorTotalElements(tensor);  // Returns 24 for [2, 3, 4]
   */
  tensorTotalElements(tensor: TensorMeta): bigint {
    return BigInt(tensor_total_elements(this.serializeTensor(tensor)));
  }

  /**
   * Reshape tensor to new dimensions (must preserve total element count)
   * @param tensor - Tensor metadata
   * @param newDimensions - New dimensions array
   * @returns Reshaped tensor metadata or null on error
   * @example
   * // Reshape [2, 3, 4] to [4, 6]
   * const reshaped = webgpuX.tensorReshape(tensor, [4, 6]);
   */
  tensorReshape(tensor: TensorMeta, newDimensions: number[]): TensorMeta | null {
    const json = tensor_reshape(this.serializeTensor(tensor), JSON.stringify(newDimensions));
    if (!json) return null;
    return this.parseTensor(json);
  }

  /**
   * Transpose 2D tensor (swap rows and columns)
   * @param tensor - Tensor metadata (must be 2D)
   * @returns Transposed tensor metadata or null on error
   * @example
   * // Transpose [2, 3] to [3, 2]
   * const transposed = webgpuX.tensorTranspose2D(tensor);
   */
  tensorTranspose2D(tensor: TensorMeta): TensorMeta | null {
    const json = tensor_transpose_2d(this.serializeTensor(tensor));
    if (!json) return null;
    return this.parseTensor(json);
  }

  /**
   * Create tensor view with element offset
   * @param tensor - Tensor metadata
   * @param offsetElements - Number of elements to offset from start
   * @returns Tensor view metadata or null on error
   * @example
   * // Create view starting at element 10
   * const view = webgpuX.tensorView(tensor, 10n);
   */
  tensorView(tensor: TensorMeta, offsetElements: bigint): TensorMeta | null {
    const json = tensor_view(this.serializeTensor(tensor), offsetElements);
    if (!json) return null;
    return this.parseTensor(json);
  }

  /**
   * Check if tensor is contiguous in memory
   * @param tensor - Tensor metadata
   * @returns true if contiguous, false otherwise
   * @example
   * if (webgpuX.tensorIsContiguous(tensor)) {
   *   console.log("Tensor has contiguous memory layout");
   * }
   */
  tensorIsContiguous(tensor: TensorMeta): boolean {
    return tensor_is_contiguous(this.serializeTensor(tensor)) === 1;
  }

  /**
   * Get tensor shape dimensions
   * @param tensor - Tensor metadata
   * @returns Array of dimensions
   * @example
   * const shape = webgpuX.tensorGetShape(tensor);  // Returns [2, 3, 4]
   */
  tensorGetShape(tensor: TensorMeta): number[] {
    const json = tensor_get_shape(this.serializeTensor(tensor));
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  }

  /**
   * Get tensor strides (for dimension indexing)
   * @param tensor - Tensor metadata
   * @returns Array of strides
   * @example
   * const strides = webgpuX.tensorGetStrides(tensor);  // Returns stride for each dimension
   */
  tensorGetStrides(tensor: TensorMeta): bigint[] {
    const json = tensor_get_strides(this.serializeTensor(tensor));
    if (!json) return [];
    try {
      const parsed = JSON.parse(json);
      return parsed.map((s: number) => BigInt(s));
    } catch {
      return [];
    }
  }

  // ============================================================================
  // Platform Detection - Darwin/macOS
  // ============================================================================

  /**
   * Check if running on Apple Silicon
   * @returns true if Apple Silicon, false otherwise
   */
  isAppleSilicon(): boolean {
    return darwin_is_apple_silicon() === 1;
  }

  /**
   * Get preferred backend for macOS
   * @returns Backend name (e.g., "Metal")
   */
  darwinPreferredBackend(): string {
    return darwin_preferred_backend();
  }

  /**
   * Get recommended memory strategy for macOS
   * @returns Memory strategy name
   */
  darwinRecommendedMemoryStrategy(): string {
    return darwin_recommended_memory_strategy();
  }

  // ============================================================================
  // Platform Detection - Linux
  // ============================================================================

  /**
   * Check if running on ARM architecture (Linux)
   * @returns true if ARM, false otherwise
   */
  linuxIsArm(): boolean {
    return linux_is_arm() === 1;
  }

  /**
   * Get CPU core count (Linux)
   * @returns Number of logical CPU cores
   */
  linuxGetCpuCount(): number {
    return linux_get_cpu_count();
  }

  /**
   * Get system page size (Linux)
   * @returns Page size in bytes
   */
  linuxGetPageSize(): bigint {
    return linux_get_page_size();
  }

  /**
   * Get total system memory (Linux)
   * @returns Total memory in bytes
   */
  linuxGetTotalMemory(): bigint {
    return linux_get_total_memory();
  }

  /**
   * Check if NVIDIA driver is installed (Linux)
   * @returns true if NVIDIA driver found
   */
  linuxHasNvidiaDriver(): boolean {
    return linux_has_nvidia_driver() === 1;
  }

  /**
   * Check if ROCm driver is installed (Linux)
   * @returns true if ROCm driver found
   */
  linuxHasRocmDriver(): boolean {
    return linux_has_rocm_driver() === 1;
  }

  /**
   * Check if Intel GPU is present (Linux)
   * @returns true if Intel GPU found
   */
  linuxHasIntelGpu(): boolean {
    return linux_has_intel_gpu() === 1;
  }

  /**
   * Get preferred backend for Linux
   * @returns Backend name (e.g., "Vulkan", "OpenGL")
   */
  linuxPreferredBackend(): string {
    return linux_preferred_backend();
  }

  /**
   * Get recommended memory strategy for Linux
   * @returns Memory strategy name
   */
  linuxRecommendedMemoryStrategy(): string {
    return linux_recommended_memory_strategy();
  }

  // ============================================================================
  // Platform Detection - Windows
  // ============================================================================

  /**
   * Check if running on ARM architecture (Windows)
   * @returns true if ARM, false otherwise
   */
  windowsIsArm(): boolean {
    return windows_is_arm() === 1;
  }

  /**
   * Get logical processor count (Windows)
   * @returns Number of logical processors
   */
  windowsGetLogicalProcessorCount(): number {
    return windows_get_logical_processor_count();
  }

  /**
   * Get system page size (Windows)
   * @returns Page size in bytes
   */
  windowsGetPageSize(): bigint {
    return windows_get_page_size();
  }

  /**
   * Check if NVIDIA driver is installed (Windows)
   * @returns true if NVIDIA driver found
   */
  windowsHasNvidiaDriver(): boolean {
    return windows_has_nvidia_driver() === 1;
  }

  /**
   * Check if AMD driver is installed (Windows)
   * @returns true if AMD driver found
   */
  windowsHasAmdDriver(): boolean {
    return windows_has_amd_driver() === 1;
  }

  /**
   * Check if Intel driver is installed (Windows)
   * @returns true if Intel driver found
   */
  windowsHasIntelDriver(): boolean {
    return windows_has_intel_driver() === 1;
  }

  /**
   * Check if DirectX 12 is available (Windows)
   * @returns true if DX12 available
   */
  windowsHasDx12(): boolean {
    return windows_has_dx12() === 1;
  }

  /**
   * Get preferred backend for Windows
   * @returns Backend name (e.g., "DX12", "Vulkan")
   */
  windowsPreferredBackend(): string {
    return windows_preferred_backend();
  }

  /**
   * Get recommended memory strategy for Windows
   * @returns Memory strategy name
   */
  windowsRecommendedMemoryStrategy(): string {
    return windows_recommended_memory_strategy();
  }

  // ============================================================================
  // Metal GPU Capabilities
  // ============================================================================

  /**
   * Get optimal workgroup size for Metal GPU
   * @param family - Metal GPU family (MetalFamily enum)
   * @returns Optimal workgroup size
   */
  metalOptimalWorkgroupSize(family: MetalFamily): number {
    return metal_optimal_workgroup_size(family);
  }

  /**
   * Get SIMD group size for Metal GPU
   * @param family - Metal GPU family
   * @returns SIMD group size (typically 32)
   */
  metalSimdGroupSize(family: MetalFamily): number {
    return metal_simd_group_size(family);
  }

  /**
   * Get maximum threadgroup memory for Metal GPU
   * @param family - Metal GPU family
   * @returns Max threadgroup memory in bytes
   */
  metalMaxThreadgroupMemory(family: MetalFamily): bigint {
    return metal_max_threadgroup_memory(family);
  }

  /**
   * Check if Metal GPU supports raytracing
   * @param family - Metal GPU family
   * @returns true if raytracing supported
   */
  metalSupportsRaytracing(family: MetalFamily): boolean {
    return metal_supports_raytracing(family) === 1;
  }

  /**
   * Check if Metal GPU supports tier 2 argument buffers
   * @param family - Metal GPU family
   * @returns true if tier 2 argument buffers supported
   */
  metalSupportsTier2ArgumentBuffers(family: MetalFamily): boolean {
    return metal_supports_tier2_argument_buffers(family) === 1;
  }

  // ============================================================================
  // ROCm GPU Capabilities
  // ============================================================================

  /**
   * Get optimal workgroup size for ROCm GPU
   * @param architecture - ROCm architecture (ROCmArchitecture enum)
   * @returns Optimal workgroup size
   */
  rocmOptimalWorkgroupSize(architecture: ROCmArchitecture): number {
    return rocm_optimal_workgroup_size(architecture);
  }

  /**
   * Get wavefront size for ROCm GPU
   * @param architecture - ROCm architecture
   * @returns Wavefront size (32 or 64)
   */
  rocmWavefrontSize(architecture: ROCmArchitecture): number {
    return rocm_wavefront_size(architecture);
  }

  /**
   * Get LDS (Local Data Share) size per compute unit
   * @param architecture - ROCm architecture
   * @returns LDS size in bytes
   */
  rocmLdsSizePerCu(architecture: ROCmArchitecture): bigint {
    return rocm_lds_size_per_cu(architecture);
  }

  /**
   * Check if ROCm GPU has matrix cores
   * @param architecture - ROCm architecture
   * @returns true if matrix cores present
   */
  rocmHasMatrixCores(architecture: ROCmArchitecture): boolean {
    return rocm_has_matrix_cores(architecture) === 1;
  }

  /**
   * Check if ROCm GPU supports FP64
   * @param architecture - ROCm architecture
   * @returns true if FP64 supported
   */
  rocmSupportsFp64(architecture: ROCmArchitecture): boolean {
    return rocm_supports_fp64(architecture) === 1;
  }

  /**
   * Calculate GPU occupancy for ROCm
   * @param threadsPerBlock - Threads per block
   * @param sharedMemoryPerBlock - Shared memory per block in bytes
   * @param architecture - ROCm architecture
   * @returns Occupancy percentage (0.0 - 1.0)
   */
  rocmCalculateOccupancy(
    threadsPerBlock: number,
    sharedMemoryPerBlock: bigint,
    architecture: ROCmArchitecture,
  ): number {
    return rocm_calculate_occupancy(threadsPerBlock, sharedMemoryPerBlock, architecture);
  }

  // ============================================================================
  // CUDA GPU Capabilities
  // ============================================================================

  /**
   * Get optimal workgroup size for CUDA GPU
   * @param computeMajor - Compute capability major version
   * @param computeMinor - Compute capability minor version
   * @returns Optimal workgroup size
   */
  cudaOptimalWorkgroupSize(computeMajor: number, computeMinor: number): number {
    return cuda_optimal_workgroup_size(computeMajor, computeMinor);
  }

  /**
   * Get shared memory bank size for CUDA GPU
   * @param computeMajor - Compute capability major version
   * @returns Bank size in bytes (4 or 8)
   */
  cudaSharedMemoryBankSize(computeMajor: number): number {
    return cuda_shared_memory_bank_size(computeMajor);
  }

  /**
   * Check if CUDA GPU has tensor cores
   * @param computeMajor - Compute capability major version
   * @param computeMinor - Compute capability minor version
   * @returns true if tensor cores present
   */
  cudaHasTensorCores(computeMajor: number, computeMinor: number): boolean {
    return cuda_has_tensor_cores(computeMajor, computeMinor) === 1;
  }

  /**
   * Calculate GPU occupancy for CUDA
   * @param threadsPerBlock - Threads per block
   * @param sharedMemoryPerBlock - Shared memory per block in bytes
   * @param computeMajor - Compute capability major version
   * @returns Occupancy percentage (0.0 - 1.0)
   */
  cudaCalculateOccupancy(
    threadsPerBlock: number,
    sharedMemoryPerBlock: bigint,
    computeMajor: number,
  ): number {
    return cuda_calculate_occupancy(threadsPerBlock, sharedMemoryPerBlock, computeMajor);
  }

  // ============================================================================
  // Vulkan GPU Capabilities
  // ============================================================================

  /**
   * Get optimal workgroup size for Vulkan GPU
   * @param vendorId - PCI vendor ID
   * @param deviceId - PCI device ID
   * @returns Optimal workgroup size
   */
  vulkanOptimalWorkgroupSize(vendorId: number, deviceId: number): number {
    return vulkan_optimal_workgroup_size(vendorId, deviceId);
  }

  /**
   * Check if Vulkan version is supported
   * @param vendorId - PCI vendor ID
   * @param deviceId - PCI device ID
   * @param major - Vulkan major version
   * @param minor - Vulkan minor version
   * @returns true if version supported
   */
  vulkanSupportsVersion(
    vendorId: number,
    deviceId: number,
    major: number,
    minor: number,
  ): boolean {
    return vulkan_supports_version(vendorId, deviceId, major, minor) === 1;
  }

  /**
   * Check if Vulkan GPU supports raytracing
   * @param vendorId - PCI vendor ID
   * @param deviceId - PCI device ID
   * @returns true if raytracing supported
   */
  vulkanSupportsRaytracing(vendorId: number, deviceId: number): boolean {
    return vulkan_supports_raytracing(vendorId, deviceId) === 1;
  }

  /**
   * Get recommended descriptor set count for Vulkan
   * @returns Recommended descriptor set count
   */
  vulkanRecommendedDescriptorSets(): number {
    return vulkan_recommended_descriptor_sets();
  }

  // ============================================================================
  // OpenCL GPU Capabilities
  // ============================================================================

  /**
   * Get optimal workgroup size for OpenCL GPU
   * @param vendorId - PCI vendor ID
   * @param maxWorkgroupSize - Maximum workgroup size
   * @returns Optimal workgroup size
   */
  openclOptimalWorkgroupSize(vendorId: number, maxWorkgroupSize: bigint): bigint {
    return opencl_optimal_workgroup_size(vendorId, maxWorkgroupSize);
  }

  /**
   * Check if OpenCL version is supported
   * @param vendorId - PCI vendor ID
   * @param deviceId - PCI device ID
   * @param major - OpenCL major version
   * @param minor - OpenCL minor version
   * @returns true if version supported
   */
  openclSupportsVersion(
    vendorId: number,
    deviceId: number,
    major: number,
    minor: number,
  ): boolean {
    return opencl_supports_version(vendorId, deviceId, major, minor) === 1;
  }

  /**
   * Check if OpenCL GPU supports FP64
   * @param vendorId - PCI vendor ID
   * @param deviceId - PCI device ID
   * @returns true if FP64 supported
   */
  openclSupportsFp64(vendorId: number, deviceId: number): boolean {
    return opencl_supports_fp64(vendorId, deviceId) === 1;
  }

  // ============================================================================
  // Framework Helpers
  // ============================================================================

  /**
   * Get default device configuration
   * @returns Default DeviceConfig with common features and limits
   */
  frameworkDeviceConfigDefault(): DeviceConfig | null {
    const json = framework_device_config_default();
    if (!json) return null;
    try {
      return JSON.parse(json) as DeviceConfig;
    } catch {
      return null;
    }
  }

  /**
   * Get OpenGL to WGPU coordinate system conversion matrix
   * @returns 4x4 transformation matrix (column-major, 16 elements)
   */
  frameworkMatrixOpenGLToWGPU(): Float32Array | null {
    const json = framework_matrix_opengl_to_wgpu();
    if (!json) return null;
    try {
      const array = JSON.parse(json) as number[];
      return new Float32Array(array);
    } catch {
      return null;
    }
  }

  /**
   * Create perspective projection matrix
   * @param fovY - Field of view in radians (vertical)
   * @param aspect - Aspect ratio (width / height)
   * @param near - Near clipping plane
   * @param far - Far clipping plane
   * @returns 4x4 perspective matrix (column-major, 16 elements)
   */
  frameworkMatrixPerspective(
    fovY: number,
    aspect: number,
    near: number,
    far: number,
  ): Float32Array | null {
    const json = framework_matrix_perspective(fovY, aspect, near, far);
    if (!json) return null;
    try {
      const array = JSON.parse(json) as number[];
      return new Float32Array(array);
    } catch {
      return null;
    }
  }

  /**
   * Create orthographic projection matrix
   * @param left - Left clipping plane
   * @param right - Right clipping plane
   * @param bottom - Bottom clipping plane
   * @param top - Top clipping plane
   * @param near - Near clipping plane
   * @param far - Far clipping plane
   * @returns 4x4 orthographic matrix (column-major, 16 elements)
   */
  frameworkMatrixOrthographic(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number,
  ): Float32Array | null {
    const json = framework_matrix_orthographic(left, right, bottom, top, near, far);
    if (!json) return null;
    try {
      const array = JSON.parse(json) as number[];
      return new Float32Array(array);
    } catch {
      return null;
    }
  }

  /**
   * Create view matrix for camera transformation
   * @param eye - Camera position [x, y, z]
   * @param target - Look-at target [x, y, z]
   * @param up - Up direction [x, y, z]
   * @returns 4x4 view matrix (column-major, 16 elements)
   */
  frameworkMatrixView(
    eye: [number, number, number],
    target: [number, number, number],
    up: [number, number, number],
  ): Float32Array | null {
    const eyeJson = JSON.stringify(eye);
    const targetJson = JSON.stringify(target);
    const upJson = JSON.stringify(up);
    const json = framework_matrix_view(eyeJson, targetJson, upJson);
    if (!json) return null;
    try {
      const array = JSON.parse(json) as number[];
      return new Float32Array(array);
    } catch {
      return null;
    }
  }

  /**
   * Create model matrix from transform components
   * @param translation - Translation [x, y, z]
   * @param rotation - Rotation in radians [x, y, z]
   * @param scale - Scale factors [x, y, z]
   * @returns 4x4 model matrix (column-major, 16 elements)
   */
  frameworkMatrixModel(
    translation: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number],
  ): Float32Array | null {
    const translationJson = JSON.stringify(translation);
    const rotationJson = JSON.stringify(rotation);
    const scaleJson = JSON.stringify(scale);
    const json = framework_matrix_model(translationJson, rotationJson, scaleJson);
    if (!json) return null;
    try {
      const array = JSON.parse(json) as number[];
      return new Float32Array(array);
    } catch {
      return null;
    }
  }
}

// Re-export types (interfaces are already exported above)
export type {
  DarwinSystemInfo,
  LinuxSystemInfo,
  WindowsSystemInfo,
  WebGPUXError,
  StagingWrite,
  StagingBeltStats,
  MipSize,
  MipSize3D,
  ShaderCacheStats,
};
