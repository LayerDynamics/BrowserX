// Auto-generated with deno_bindgen
function encode(v: string | Uint8Array): Uint8Array {
  if (typeof v !== "string") return v
  return new TextEncoder().encode(v)
}

function decode(v: Uint8Array): string {
  return new TextDecoder().decode(v)
}

// deno-lint-ignore no-explicit-any
function readPointer(v: any): Uint8Array {
  const ptr = new Deno.UnsafePointerView(v)
  const lengthBe = new Uint8Array(4)
  const view = new DataView(lengthBe.buffer)
  ptr.copyInto(lengthBe, 0)
  const buf = new Uint8Array(view.getUint32(0))
  ptr.copyInto(buf, 4)
  return buf
}

const url = new URL("../../target/release", import.meta.url)

let uri = url.pathname
if (!uri.endsWith("/")) uri += "/"

// https://docs.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-loadlibrarya#parameters
if (Deno.build.os === "windows") {
  uri = uri.replace(/\//g, "\\")
  // Remove leading slash
  if (uri.startsWith("\\")) {
    uri = uri.slice(1)
  }
}

const libPaths = {
    darwin: uri + "libwebgpu_x.dylib",
    windows: uri + "webgpu_x.dll",
    linux: uri + "libwebgpu_x.so",
    freebsd: uri + "libwebgpu_x.so",
    netbsd: uri + "libwebgpu_x.so",
    aix: uri + "libwebgpu_x.so",
    solaris: uri + "libwebgpu_x.so",
    illumos: uri + "libwebgpu_x.so",
  } as Record<typeof Deno.build.os, string>;
const { symbols } = Deno.dlopen(libPaths[Deno.build.os]!,
  {
    buffer_calculate_aligned_size: {
      parameters: ["u64", "u64"],
      result: "u64",
      nonblocking: false,
    },
    buffer_calculate_texture_buffer_size: {
      parameters: ["u32", "u32", "u32"],
      result: "u64",
      nonblocking: false,
    },
    buffer_get_alignment: {
      parameters: ["u32"],
      result: "u64",
      nonblocking: false,
    },
    buffer_get_padded_row_size: {
      parameters: ["u64"],
      result: "u64",
      nonblocking: false,
    },
    buffer_get_row_padding: {
      parameters: ["u64"],
      result: "u64",
      nonblocking: false,
    },
    buffer_pool_acquire: {
      parameters: ["u64", "u32"],
      result: "u64",
      nonblocking: false,
    },
    buffer_pool_add: {
      parameters: ["u64", "u64", "u32"],
      result: "void",
      nonblocking: false,
    },
    buffer_pool_clear: { parameters: [], result: "void", nonblocking: false },
    buffer_pool_evict: { parameters: [], result: "void", nonblocking: false },
    buffer_pool_release: {
      parameters: ["u64"],
      result: "void",
      nonblocking: false,
    },
    buffer_pool_remove: {
      parameters: ["u64"],
      result: "void",
      nonblocking: false,
    },
    cuda_calculate_occupancy: {
      parameters: ["u32", "u64", "u32"],
      result: "f64",
      nonblocking: false,
    },
    cuda_has_tensor_cores: {
      parameters: ["u32", "u32"],
      result: "u8",
      nonblocking: false,
    },
    cuda_optimal_workgroup_size: {
      parameters: ["u32", "u32"],
      result: "u32",
      nonblocking: false,
    },
    cuda_shared_memory_bank_size: {
      parameters: ["u32"],
      result: "u32",
      nonblocking: false,
    },
    darwin_is_apple_silicon: {
      parameters: [],
      result: "u8",
      nonblocking: false,
    },
    darwin_preferred_backend: {
      parameters: [],
      result: "buffer",
      nonblocking: false,
    },
    darwin_recommended_memory_strategy: {
      parameters: [],
      result: "buffer",
      nonblocking: false,
    },
    detect_gpu_vendor: {
      parameters: ["u32"],
      result: "u32",
      nonblocking: false,
    },
    framework_device_config_default: {
      parameters: [],
      result: "buffer",
      nonblocking: false,
    },
    framework_matrix_model: {
      parameters: ["buffer", "usize", "buffer", "usize", "buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    framework_matrix_opengl_to_wgpu: {
      parameters: [],
      result: "buffer",
      nonblocking: false,
    },
    framework_matrix_orthographic: {
      parameters: ["f32", "f32", "f32", "f32", "f32", "f32"],
      result: "buffer",
      nonblocking: false,
    },
    framework_matrix_perspective: {
      parameters: ["f32", "f32", "f32", "f32"],
      result: "buffer",
      nonblocking: false,
    },
    framework_matrix_view: {
      parameters: ["buffer", "usize", "buffer", "usize", "buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    get_optimal_workgroup_size: {
      parameters: ["u32", "u32", "u32"],
      result: "u32",
      nonblocking: false,
    },
    kernel_generate_from_template: {
      parameters: ["u32", "u32", "u32", "u32"],
      result: "buffer",
      nonblocking: false,
    },
    linux_get_cpu_count: { parameters: [], result: "u32", nonblocking: false },
    linux_get_page_size: { parameters: [], result: "u64", nonblocking: false },
    linux_get_total_memory: {
      parameters: [],
      result: "u64",
      nonblocking: false,
    },
    linux_has_intel_gpu: { parameters: [], result: "u8", nonblocking: false },
    linux_has_nvidia_driver: {
      parameters: [],
      result: "u8",
      nonblocking: false,
    },
    linux_has_rocm_driver: { parameters: [], result: "u8", nonblocking: false },
    linux_is_arm: { parameters: [], result: "u8", nonblocking: false },
    linux_preferred_backend: {
      parameters: [],
      result: "buffer",
      nonblocking: false,
    },
    linux_recommended_memory_strategy: {
      parameters: [],
      result: "buffer",
      nonblocking: false,
    },
    metal_max_threadgroup_memory: {
      parameters: ["u32"],
      result: "u64",
      nonblocking: false,
    },
    metal_optimal_workgroup_size: {
      parameters: ["u32"],
      result: "u32",
      nonblocking: false,
    },
    metal_simd_group_size: {
      parameters: ["u32"],
      result: "u32",
      nonblocking: false,
    },
    metal_supports_raytracing: {
      parameters: ["u32"],
      result: "u8",
      nonblocking: false,
    },
    metal_supports_tier2_argument_buffers: {
      parameters: ["u32"],
      result: "u8",
      nonblocking: false,
    },
    opencl_optimal_workgroup_size: {
      parameters: ["u32", "u64"],
      result: "u64",
      nonblocking: false,
    },
    opencl_supports_fp64: {
      parameters: ["u32", "u32"],
      result: "u8",
      nonblocking: false,
    },
    opencl_supports_version: {
      parameters: ["u32", "u32", "u32", "u32"],
      result: "u8",
      nonblocking: false,
    },
    rocm_calculate_occupancy: {
      parameters: ["u32", "u64", "u32"],
      result: "f64",
      nonblocking: false,
    },
    rocm_has_matrix_cores: {
      parameters: ["u32"],
      result: "u8",
      nonblocking: false,
    },
    rocm_lds_size_per_cu: {
      parameters: ["u32"],
      result: "u64",
      nonblocking: false,
    },
    rocm_optimal_workgroup_size: {
      parameters: ["u32"],
      result: "u32",
      nonblocking: false,
    },
    rocm_supports_fp64: {
      parameters: ["u32"],
      result: "u8",
      nonblocking: false,
    },
    rocm_wavefront_size: {
      parameters: ["u32"],
      result: "u32",
      nonblocking: false,
    },
    shader_cache_clear: {
      parameters: ["u64"],
      result: "void",
      nonblocking: false,
    },
    shader_cache_create: { parameters: [], result: "u64", nonblocking: false },
    shader_cache_destroy: {
      parameters: ["u64"],
      result: "void",
      nonblocking: false,
    },
    shader_cache_has_changed: {
      parameters: ["u64", "buffer", "usize"],
      result: "u8",
      nonblocking: false,
    },
    shader_cache_load: {
      parameters: ["u64", "buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    shader_cache_load_from_string: {
      parameters: ["u64", "buffer", "usize", "u32", "buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    shader_cache_stats: {
      parameters: ["u64"],
      result: "buffer",
      nonblocking: false,
    },
    shader_detect_stage: {
      parameters: ["buffer", "usize"],
      result: "u32",
      nonblocking: false,
    },
    staging_belt_create: {
      parameters: ["u64"],
      result: "u64",
      nonblocking: false,
    },
    staging_belt_destroy: {
      parameters: ["u64"],
      result: "void",
      nonblocking: false,
    },
    staging_belt_finish: {
      parameters: ["u64"],
      result: "void",
      nonblocking: false,
    },
    staging_belt_stats: {
      parameters: ["u64"],
      result: "buffer",
      nonblocking: false,
    },
    staging_belt_write: {
      parameters: ["u64", "u64"],
      result: "buffer",
      nonblocking: false,
    },
    tensor_create: {
      parameters: ["u64", "buffer", "usize", "u32", "u32"],
      result: "buffer",
      nonblocking: false,
    },
    tensor_get_shape: {
      parameters: ["buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    tensor_get_strides: {
      parameters: ["buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    tensor_is_contiguous: {
      parameters: ["buffer", "usize"],
      result: "u8",
      nonblocking: false,
    },
    tensor_rank: {
      parameters: ["buffer", "usize"],
      result: "u32",
      nonblocking: false,
    },
    tensor_reshape: {
      parameters: ["buffer", "usize", "buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    tensor_size_bytes: {
      parameters: ["buffer", "usize"],
      result: "u64",
      nonblocking: false,
    },
    tensor_total_elements: {
      parameters: ["buffer", "usize"],
      result: "u64",
      nonblocking: false,
    },
    tensor_transpose_2d: {
      parameters: ["buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    tensor_view: {
      parameters: ["buffer", "usize", "u64"],
      result: "buffer",
      nonblocking: false,
    },
    texture_calculate_mip_levels: {
      parameters: ["u32", "u32"],
      result: "u32",
      nonblocking: false,
    },
    texture_get_mip_size: {
      parameters: ["u32", "u32", "u32"],
      result: "buffer",
      nonblocking: false,
    },
    texture_get_mip_size_3d: {
      parameters: ["u32", "u32", "u32", "u32"],
      result: "buffer",
      nonblocking: false,
    },
    vulkan_optimal_workgroup_size: {
      parameters: ["u32", "u32"],
      result: "u32",
      nonblocking: false,
    },
    vulkan_recommended_descriptor_sets: {
      parameters: [],
      result: "u32",
      nonblocking: false,
    },
    vulkan_supports_raytracing: {
      parameters: ["u32", "u32"],
      result: "u8",
      nonblocking: false,
    },
    vulkan_supports_version: {
      parameters: ["u32", "u32", "u32", "u32"],
      result: "u8",
      nonblocking: false,
    },
    webgpu_x_get_last_error: {
      parameters: [],
      result: "buffer",
      nonblocking: false,
    },
    webgpu_x_init: { parameters: [], result: "u8", nonblocking: false },
    webgpu_x_version: { parameters: [], result: "buffer", nonblocking: false },
    wgsl_binding_buffer: {
      parameters: ["u32", "u32", "buffer", "usize", "buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    wgsl_binding_sampler: {
      parameters: ["u32", "u32", "buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    wgsl_binding_texture: {
      parameters: ["u32", "u32", "buffer", "usize", "buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    wgsl_binding_uniform: {
      parameters: ["u32", "u32", "buffer", "usize", "buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    wgsl_builtin: {
      parameters: ["buffer", "usize", "buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    wgsl_compute_entry: {
      parameters: [
        "buffer",
        "usize",
        "u32",
        "u32",
        "u32",
        "buffer",
        "usize",
        "buffer",
        "usize",
      ],
      result: "buffer",
      nonblocking: false,
    },
    wgsl_extract_functions: {
      parameters: ["buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    wgsl_fragment_entry: {
      parameters: [
        "buffer",
        "usize",
        "buffer",
        "usize",
        "buffer",
        "usize",
        "buffer",
        "usize",
      ],
      result: "buffer",
      nonblocking: false,
    },
    wgsl_function: {
      parameters: [
        "buffer",
        "usize",
        "buffer",
        "usize",
        "buffer",
        "usize",
        "buffer",
        "usize",
      ],
      result: "buffer",
      nonblocking: false,
    },
    wgsl_line_count: {
      parameters: ["buffer", "usize"],
      result: "u32",
      nonblocking: false,
    },
    wgsl_location: {
      parameters: ["buffer", "usize", "u32", "buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    wgsl_minify: {
      parameters: ["buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    wgsl_struct: {
      parameters: ["buffer", "usize", "buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    wgsl_struct_field: {
      parameters: ["buffer", "usize", "buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    wgsl_vertex_entry: {
      parameters: [
        "buffer",
        "usize",
        "buffer",
        "usize",
        "buffer",
        "usize",
        "buffer",
        "usize",
      ],
      result: "buffer",
      nonblocking: false,
    },
    windows_get_logical_processor_count: {
      parameters: [],
      result: "u32",
      nonblocking: false,
    },
    windows_get_page_size: {
      parameters: [],
      result: "u64",
      nonblocking: false,
    },
    windows_has_amd_driver: {
      parameters: [],
      result: "u8",
      nonblocking: false,
    },
    windows_has_dx12: { parameters: [], result: "u8", nonblocking: false },
    windows_has_intel_driver: {
      parameters: [],
      result: "u8",
      nonblocking: false,
    },
    windows_has_nvidia_driver: {
      parameters: [],
      result: "u8",
      nonblocking: false,
    },
    windows_is_arm: { parameters: [], result: "u8", nonblocking: false },
    windows_preferred_backend: {
      parameters: [],
      result: "buffer",
      nonblocking: false,
    },
    windows_recommended_memory_strategy: {
      parameters: [],
      result: "buffer",
      nonblocking: false,
    },
  },
)
/**
 * macOS system information
 */
export type DarwinSystemInfo = {
  os_version: string
  kernel_version: string
  cpu_brand: string
  physical_cores: number
  logical_cores: number
  total_memory: number
}
/**
 * Linux system information
 */
export type LinuxSystemInfo = {
  kernel_version: string
  distribution: string
  cpu_brand: string
  physical_cores: number
  logical_cores: number
  total_memory: number
}
/**
 * Calculate texture dimensions at specific mip level
 * Returns (width, height) as separate values via MipSize struct
 */
export type MipSize = {
  width: number
  height: number
}
/**
 * Calculate 3D texture dimensions at specific mip level
 */
export type MipSize3D = {
  width: number
  height: number
  depth: number
}
/**
 * Shader cache statistics
 */
export type ShaderCacheStats = {
  cached_shaders: number
}
/**
 * Statistics about staging belt usage
 */
export type StagingBeltStats = {
  active_chunks: number
  free_chunks: number
  chunk_size: number
  total_allocated: number
}
/**
 * Result of a staging write operation
 */
export type StagingWrite = {
  buffer_handle: number
  offset: number
  size: number
}
/**
 * WebGPU extension error types
 */
export type WebGPUXError = /**
   * Device not found or initialization failed
   */
  | {
    DeviceNotFound: {
      message: string
    }
  }
  | /**
   * Buffer operation failed
   */
  {
    BufferError: {
      message: string
      buffer_id: number | undefined | null
    }
  }
  | /**
   * Texture operation failed
   */
  {
    TextureError: {
      message: string
      texture_id: number | undefined | null
    }
  }
  | /**
   * Pipeline creation or execution failed
   */
  {
    PipelineError: {
      message: string
      pipeline_id: number | undefined | null
    }
  }
  | /**
   * Descriptor validation failed
   */
  {
    ValidationError: {
      field: string
      message: string
    }
  }
  | /**
   * Memory allocation failed
   */
  {
    OutOfMemory: {
      requested_bytes: number
      available_bytes: number
    }
  }
  | /**
   * Device lost during operation
   */
  {
    DeviceLost: {
      reason: string
    }
  }
  | /**
   * FFI serialization error
   */
  {
    SerializationError: {
      message: string
    }
  }
  | /**
   * Limit exceeded
   */
  {
    LimitExceeded: {
      limit_name: string
      requested: number
      maximum: number
    }
  }
/**
 * Windows system information
 */
export type WindowsSystemInfo = {
  os_version: string
  build_number: string
  cpu_brand: string
  physical_cores: number
  logical_cores: number
  total_memory: number
}
export function buffer_calculate_aligned_size(a0: bigint, a1: bigint) {
  const rawResult = symbols.buffer_calculate_aligned_size(a0, a1)
  const result = rawResult
  return result
}
export function buffer_calculate_texture_buffer_size(
  a0: number,
  a1: number,
  a2: number,
) {
  const rawResult = symbols.buffer_calculate_texture_buffer_size(a0, a1, a2)
  const result = rawResult
  return result
}
export function buffer_get_alignment(a0: number) {
  const rawResult = symbols.buffer_get_alignment(a0)
  const result = rawResult
  return result
}
export function buffer_get_padded_row_size(a0: bigint) {
  const rawResult = symbols.buffer_get_padded_row_size(a0)
  const result = rawResult
  return result
}
export function buffer_get_row_padding(a0: bigint) {
  const rawResult = symbols.buffer_get_row_padding(a0)
  const result = rawResult
  return result
}
export function buffer_pool_acquire(a0: bigint, a1: number) {
  const rawResult = symbols.buffer_pool_acquire(a0, a1)
  const result = rawResult
  return result
}
export function buffer_pool_add(a0: bigint, a1: bigint, a2: number) {
  const rawResult = symbols.buffer_pool_add(a0, a1, a2)
  const result = rawResult
  return result
}
export function buffer_pool_clear() {
  const rawResult = symbols.buffer_pool_clear()
  const result = rawResult
  return result
}
export function buffer_pool_evict() {
  const rawResult = symbols.buffer_pool_evict()
  const result = rawResult
  return result
}
export function buffer_pool_release(a0: bigint) {
  const rawResult = symbols.buffer_pool_release(a0)
  const result = rawResult
  return result
}
export function buffer_pool_remove(a0: bigint) {
  const rawResult = symbols.buffer_pool_remove(a0)
  const result = rawResult
  return result
}
export function cuda_calculate_occupancy(a0: number, a1: bigint, a2: number) {
  const rawResult = symbols.cuda_calculate_occupancy(a0, a1, a2)
  const result = rawResult
  return result
}
export function cuda_has_tensor_cores(a0: number, a1: number) {
  const rawResult = symbols.cuda_has_tensor_cores(a0, a1)
  const result = rawResult
  return result
}
export function cuda_optimal_workgroup_size(a0: number, a1: number) {
  const rawResult = symbols.cuda_optimal_workgroup_size(a0, a1)
  const result = rawResult
  return result
}
export function cuda_shared_memory_bank_size(a0: number) {
  const rawResult = symbols.cuda_shared_memory_bank_size(a0)
  const result = rawResult
  return result
}
export function darwin_is_apple_silicon() {
  const rawResult = symbols.darwin_is_apple_silicon()
  const result = rawResult
  return result
}
export function darwin_preferred_backend() {
  const rawResult = symbols.darwin_preferred_backend()
  const result = readPointer(rawResult)
  return decode(result)
}
export function darwin_recommended_memory_strategy() {
  const rawResult = symbols.darwin_recommended_memory_strategy()
  const result = readPointer(rawResult)
  return decode(result)
}
export function detect_gpu_vendor(a0: number) {
  const rawResult = symbols.detect_gpu_vendor(a0)
  const result = rawResult
  return result
}
export function framework_device_config_default() {
  const rawResult = symbols.framework_device_config_default()
  const result = readPointer(rawResult)
  return decode(result)
}
export function framework_matrix_model(a0: string, a1: string, a2: string) {
  const a0_buf = encode(a0)
  const a1_buf = encode(a1)
  const a2_buf = encode(a2)

  const rawResult = symbols.framework_matrix_model(
    a0_buf as BufferSource,
    BigInt(a0_buf.byteLength),
    a1_buf as BufferSource,
    BigInt(a1_buf.byteLength),
    a2_buf as BufferSource,
    BigInt(a2_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function framework_matrix_opengl_to_wgpu() {
  const rawResult = symbols.framework_matrix_opengl_to_wgpu()
  const result = readPointer(rawResult)
  return decode(result)
}
export function framework_matrix_orthographic(
  a0: number,
  a1: number,
  a2: number,
  a3: number,
  a4: number,
  a5: number,
) {
  const rawResult = symbols.framework_matrix_orthographic(
    a0,
    a1,
    a2,
    a3,
    a4,
    a5,
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function framework_matrix_perspective(
  a0: number,
  a1: number,
  a2: number,
  a3: number,
) {
  const rawResult = symbols.framework_matrix_perspective(a0, a1, a2, a3)
  const result = readPointer(rawResult)
  return decode(result)
}
export function framework_matrix_view(a0: string, a1: string, a2: string) {
  const a0_buf = encode(a0)
  const a1_buf = encode(a1)
  const a2_buf = encode(a2)

  const rawResult = symbols.framework_matrix_view(
    a0_buf as BufferSource,
    BigInt(a0_buf.byteLength),
    a1_buf as BufferSource,
    BigInt(a1_buf.byteLength),
    a2_buf as BufferSource,
    BigInt(a2_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function get_optimal_workgroup_size(a0: number, a1: number, a2: number) {
  const rawResult = symbols.get_optimal_workgroup_size(a0, a1, a2)
  const result = rawResult
  return result
}
export function kernel_generate_from_template(
  a0: number,
  a1: number,
  a2: number,
  a3: number,
) {
  const rawResult = symbols.kernel_generate_from_template(a0, a1, a2, a3)
  const result = readPointer(rawResult)
  return decode(result)
}
export function linux_get_cpu_count() {
  const rawResult = symbols.linux_get_cpu_count()
  const result = rawResult
  return result
}
export function linux_get_page_size() {
  const rawResult = symbols.linux_get_page_size()
  const result = rawResult
  return result
}
export function linux_get_total_memory() {
  const rawResult = symbols.linux_get_total_memory()
  const result = rawResult
  return result
}
export function linux_has_intel_gpu() {
  const rawResult = symbols.linux_has_intel_gpu()
  const result = rawResult
  return result
}
export function linux_has_nvidia_driver() {
  const rawResult = symbols.linux_has_nvidia_driver()
  const result = rawResult
  return result
}
export function linux_has_rocm_driver() {
  const rawResult = symbols.linux_has_rocm_driver()
  const result = rawResult
  return result
}
export function linux_is_arm() {
  const rawResult = symbols.linux_is_arm()
  const result = rawResult
  return result
}
export function linux_preferred_backend() {
  const rawResult = symbols.linux_preferred_backend()
  const result = readPointer(rawResult)
  return decode(result)
}
export function linux_recommended_memory_strategy() {
  const rawResult = symbols.linux_recommended_memory_strategy()
  const result = readPointer(rawResult)
  return decode(result)
}
export function metal_max_threadgroup_memory(a0: number) {
  const rawResult = symbols.metal_max_threadgroup_memory(a0)
  const result = rawResult
  return result
}
export function metal_optimal_workgroup_size(a0: number) {
  const rawResult = symbols.metal_optimal_workgroup_size(a0)
  const result = rawResult
  return result
}
export function metal_simd_group_size(a0: number) {
  const rawResult = symbols.metal_simd_group_size(a0)
  const result = rawResult
  return result
}
export function metal_supports_raytracing(a0: number) {
  const rawResult = symbols.metal_supports_raytracing(a0)
  const result = rawResult
  return result
}
export function metal_supports_tier2_argument_buffers(a0: number) {
  const rawResult = symbols.metal_supports_tier2_argument_buffers(a0)
  const result = rawResult
  return result
}
export function opencl_optimal_workgroup_size(a0: number, a1: bigint) {
  const rawResult = symbols.opencl_optimal_workgroup_size(a0, a1)
  const result = rawResult
  return result
}
export function opencl_supports_fp64(a0: number, a1: number) {
  const rawResult = symbols.opencl_supports_fp64(a0, a1)
  const result = rawResult
  return result
}
export function opencl_supports_version(
  a0: number,
  a1: number,
  a2: number,
  a3: number,
) {
  const rawResult = symbols.opencl_supports_version(a0, a1, a2, a3)
  const result = rawResult
  return result
}
export function rocm_calculate_occupancy(a0: number, a1: bigint, a2: number) {
  const rawResult = symbols.rocm_calculate_occupancy(a0, a1, a2)
  const result = rawResult
  return result
}
export function rocm_has_matrix_cores(a0: number) {
  const rawResult = symbols.rocm_has_matrix_cores(a0)
  const result = rawResult
  return result
}
export function rocm_lds_size_per_cu(a0: number) {
  const rawResult = symbols.rocm_lds_size_per_cu(a0)
  const result = rawResult
  return result
}
export function rocm_optimal_workgroup_size(a0: number) {
  const rawResult = symbols.rocm_optimal_workgroup_size(a0)
  const result = rawResult
  return result
}
export function rocm_supports_fp64(a0: number) {
  const rawResult = symbols.rocm_supports_fp64(a0)
  const result = rawResult
  return result
}
export function rocm_wavefront_size(a0: number) {
  const rawResult = symbols.rocm_wavefront_size(a0)
  const result = rawResult
  return result
}
export function shader_cache_clear(a0: bigint) {
  const rawResult = symbols.shader_cache_clear(a0)
  const result = rawResult
  return result
}
export function shader_cache_create() {
  const rawResult = symbols.shader_cache_create()
  const result = rawResult
  return result
}
export function shader_cache_destroy(a0: bigint) {
  const rawResult = symbols.shader_cache_destroy(a0)
  const result = rawResult
  return result
}
export function shader_cache_has_changed(a0: bigint, a1: string) {
  const a1_buf = encode(a1)

  const rawResult = symbols.shader_cache_has_changed(
    a0,
    a1_buf as BufferSource,
    BigInt(a1_buf.byteLength),
  )
  const result = rawResult
  return result
}
export function shader_cache_load(a0: bigint, a1: string) {
  const a1_buf = encode(a1)

  const rawResult = symbols.shader_cache_load(a0, a1_buf as BufferSource, BigInt(a1_buf.byteLength))
  const result = readPointer(rawResult)
  return decode(result)
}
export function shader_cache_load_from_string(
  a0: bigint,
  a1: string,
  a2: number,
  a3: string,
) {
  const a1_buf = encode(a1)
  const a3_buf = encode(a3)

  const rawResult = symbols.shader_cache_load_from_string(
    a0,
    a1_buf as BufferSource,
    BigInt(a1_buf.byteLength),
    a2,
    a3_buf as BufferSource,
    BigInt(a3_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function shader_cache_stats(a0: bigint) {
  const rawResult = symbols.shader_cache_stats(a0)
  const result = readPointer(rawResult)
  return JSON.parse(decode(result)) as ShaderCacheStats
}
export function shader_detect_stage(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.shader_detect_stage(a0_buf as BufferSource, BigInt(a0_buf.byteLength))
  const result = rawResult
  return result
}
export function staging_belt_create(a0: bigint) {
  const rawResult = symbols.staging_belt_create(a0)
  const result = rawResult
  return result
}
export function staging_belt_destroy(a0: bigint) {
  const rawResult = symbols.staging_belt_destroy(a0)
  const result = rawResult
  return result
}
export function staging_belt_finish(a0: bigint) {
  const rawResult = symbols.staging_belt_finish(a0)
  const result = rawResult
  return result
}
export function staging_belt_stats(a0: bigint) {
  const rawResult = symbols.staging_belt_stats(a0)
  const result = readPointer(rawResult)
  return JSON.parse(decode(result)) as StagingBeltStats
}
export function staging_belt_write(a0: bigint, a1: bigint) {
  const rawResult = symbols.staging_belt_write(a0, a1)
  const result = readPointer(rawResult)
  return JSON.parse(decode(result)) as StagingWrite
}
export function tensor_create(a0: bigint, a1: string, a2: number, a3: number) {
  const a1_buf = encode(a1)

  const rawResult = symbols.tensor_create(a0, a1_buf as BufferSource, BigInt(a1_buf.byteLength), a2, a3)
  const result = readPointer(rawResult)
  return decode(result)
}
export function tensor_get_shape(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.tensor_get_shape(a0_buf as BufferSource, BigInt(a0_buf.byteLength))
  const result = readPointer(rawResult)
  return decode(result)
}
export function tensor_get_strides(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.tensor_get_strides(a0_buf as BufferSource, BigInt(a0_buf.byteLength))
  const result = readPointer(rawResult)
  return decode(result)
}
export function tensor_is_contiguous(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.tensor_is_contiguous(a0_buf as BufferSource, BigInt(a0_buf.byteLength))
  const result = rawResult
  return result
}
export function tensor_rank(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.tensor_rank(a0_buf as BufferSource, BigInt(a0_buf.byteLength))
  const result = rawResult
  return result
}
export function tensor_reshape(a0: string, a1: string) {
  const a0_buf = encode(a0)
  const a1_buf = encode(a1)

  const rawResult = symbols.tensor_reshape(
    a0_buf as BufferSource,
    BigInt(a0_buf.byteLength),
    a1_buf as BufferSource,
    BigInt(a1_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function tensor_size_bytes(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.tensor_size_bytes(a0_buf as BufferSource, BigInt(a0_buf.byteLength))
  const result = rawResult
  return result
}
export function tensor_total_elements(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.tensor_total_elements(a0_buf as BufferSource, BigInt(a0_buf.byteLength))
  const result = rawResult
  return result
}
export function tensor_transpose_2d(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.tensor_transpose_2d(a0_buf as BufferSource, BigInt(a0_buf.byteLength))
  const result = readPointer(rawResult)
  return decode(result)
}
export function tensor_view(a0: string, a1: bigint) {
  const a0_buf = encode(a0)

  const rawResult = symbols.tensor_view(a0_buf as BufferSource, BigInt(a0_buf.byteLength), a1)
  const result = readPointer(rawResult)
  return decode(result)
}
export function texture_calculate_mip_levels(a0: number, a1: number) {
  const rawResult = symbols.texture_calculate_mip_levels(a0, a1)
  const result = rawResult
  return result
}
export function texture_get_mip_size(a0: number, a1: number, a2: number) {
  const rawResult = symbols.texture_get_mip_size(a0, a1, a2)
  const result = readPointer(rawResult)
  return JSON.parse(decode(result)) as MipSize
}
export function texture_get_mip_size_3d(
  a0: number,
  a1: number,
  a2: number,
  a3: number,
) {
  const rawResult = symbols.texture_get_mip_size_3d(a0, a1, a2, a3)
  const result = readPointer(rawResult)
  return JSON.parse(decode(result)) as MipSize3D
}
export function vulkan_optimal_workgroup_size(a0: number, a1: number) {
  const rawResult = symbols.vulkan_optimal_workgroup_size(a0, a1)
  const result = rawResult
  return result
}
export function vulkan_recommended_descriptor_sets() {
  const rawResult = symbols.vulkan_recommended_descriptor_sets()
  const result = rawResult
  return result
}
export function vulkan_supports_raytracing(a0: number, a1: number) {
  const rawResult = symbols.vulkan_supports_raytracing(a0, a1)
  const result = rawResult
  return result
}
export function vulkan_supports_version(
  a0: number,
  a1: number,
  a2: number,
  a3: number,
) {
  const rawResult = symbols.vulkan_supports_version(a0, a1, a2, a3)
  const result = rawResult
  return result
}
export function webgpu_x_get_last_error() {
  const rawResult = symbols.webgpu_x_get_last_error()
  const result = readPointer(rawResult)
  return decode(result)
}
export function webgpu_x_init() {
  const rawResult = symbols.webgpu_x_init()
  const result = rawResult
  return result
}
export function webgpu_x_version() {
  const rawResult = symbols.webgpu_x_version()
  const result = readPointer(rawResult)
  return decode(result)
}
export function wgsl_binding_buffer(
  a0: number,
  a1: number,
  a2: string,
  a3: string,
) {
  const a2_buf = encode(a2)
  const a3_buf = encode(a3)

  const rawResult = symbols.wgsl_binding_buffer(
    a0,
    a1,
    a2_buf as BufferSource,
    BigInt(a2_buf.byteLength),
    a3_buf as BufferSource,
    BigInt(a3_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function wgsl_binding_sampler(a0: number, a1: number, a2: string) {
  const a2_buf = encode(a2)

  const rawResult = symbols.wgsl_binding_sampler(
    a0,
    a1,
    a2_buf as BufferSource,
    BigInt(a2_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function wgsl_binding_texture(
  a0: number,
  a1: number,
  a2: string,
  a3: string,
) {
  const a2_buf = encode(a2)
  const a3_buf = encode(a3)

  const rawResult = symbols.wgsl_binding_texture(
    a0,
    a1,
    a2_buf as BufferSource,
    BigInt(a2_buf.byteLength),
    a3_buf as BufferSource,
    BigInt(a3_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function wgsl_binding_uniform(
  a0: number,
  a1: number,
  a2: string,
  a3: string,
) {
  const a2_buf = encode(a2)
  const a3_buf = encode(a3)

  const rawResult = symbols.wgsl_binding_uniform(
    a0,
    a1,
    a2_buf as BufferSource,
    BigInt(a2_buf.byteLength),
    a3_buf as BufferSource,
    BigInt(a3_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function wgsl_builtin(a0: string, a1: string) {
  const a0_buf = encode(a0)
  const a1_buf = encode(a1)

  const rawResult = symbols.wgsl_builtin(
    a0_buf as BufferSource,
    BigInt(a0_buf.byteLength),
    a1_buf as BufferSource,
    BigInt(a1_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function wgsl_compute_entry(
  a0: string,
  a1: number,
  a2: number,
  a3: number,
  a4: string,
  a5: string,
) {
  const a0_buf = encode(a0)
  const a4_buf = encode(a4)
  const a5_buf = encode(a5)

  const rawResult = symbols.wgsl_compute_entry(
    a0_buf as BufferSource,
    BigInt(a0_buf.byteLength),
    a1,
    a2,
    a3,
    a4_buf as BufferSource,
    BigInt(a4_buf.byteLength),
    a5_buf as BufferSource,
    BigInt(a5_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function wgsl_extract_functions(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.wgsl_extract_functions(a0_buf as BufferSource, BigInt(a0_buf.byteLength))
  const result = readPointer(rawResult)
  return decode(result)
}
export function wgsl_fragment_entry(
  a0: string,
  a1: string,
  a2: string,
  a3: string,
) {
  const a0_buf = encode(a0)
  const a1_buf = encode(a1)
  const a2_buf = encode(a2)
  const a3_buf = encode(a3)

  const rawResult = symbols.wgsl_fragment_entry(
    a0_buf as BufferSource,
    BigInt(a0_buf.byteLength),
    a1_buf as BufferSource,
    BigInt(a1_buf.byteLength),
    a2_buf as BufferSource,
    BigInt(a2_buf.byteLength),
    a3_buf as BufferSource,
    BigInt(a3_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function wgsl_function(a0: string, a1: string, a2: string, a3: string) {
  const a0_buf = encode(a0)
  const a1_buf = encode(a1)
  const a2_buf = encode(a2)
  const a3_buf = encode(a3)

  const rawResult = symbols.wgsl_function(
    a0_buf as BufferSource,
    BigInt(a0_buf.byteLength),
    a1_buf as BufferSource,
    BigInt(a1_buf.byteLength),
    a2_buf as BufferSource,
    BigInt(a2_buf.byteLength),
    a3_buf as BufferSource,
    BigInt(a3_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function wgsl_line_count(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.wgsl_line_count(a0_buf as BufferSource, BigInt(a0_buf.byteLength))
  const result = rawResult
  return result
}
export function wgsl_location(a0: string, a1: number, a2: string) {
  const a0_buf = encode(a0)
  const a2_buf = encode(a2)

  const rawResult = symbols.wgsl_location(
    a0_buf as BufferSource,
    BigInt(a0_buf.byteLength),
    a1,
    a2_buf as BufferSource,
    BigInt(a2_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function wgsl_minify(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.wgsl_minify(a0_buf as BufferSource, BigInt(a0_buf.byteLength))
  const result = readPointer(rawResult)
  return decode(result)
}
export function wgsl_struct(a0: string, a1: string) {
  const a0_buf = encode(a0)
  const a1_buf = encode(a1)

  const rawResult = symbols.wgsl_struct(
    a0_buf as BufferSource,
    BigInt(a0_buf.byteLength),
    a1_buf as BufferSource,
    BigInt(a1_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function wgsl_struct_field(a0: string, a1: string) {
  const a0_buf = encode(a0)
  const a1_buf = encode(a1)

  const rawResult = symbols.wgsl_struct_field(
    a0_buf as BufferSource,
    BigInt(a0_buf.byteLength),
    a1_buf as BufferSource,
    BigInt(a1_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function wgsl_vertex_entry(
  a0: string,
  a1: string,
  a2: string,
  a3: string,
) {
  const a0_buf = encode(a0)
  const a1_buf = encode(a1)
  const a2_buf = encode(a2)
  const a3_buf = encode(a3)

  const rawResult = symbols.wgsl_vertex_entry(
    a0_buf as BufferSource,
    BigInt(a0_buf.byteLength),
    a1_buf as BufferSource,
    BigInt(a1_buf.byteLength),
    a2_buf as BufferSource,
    BigInt(a2_buf.byteLength),
    a3_buf as BufferSource,
    BigInt(a3_buf.byteLength),
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function windows_get_logical_processor_count() {
  const rawResult = symbols.windows_get_logical_processor_count()
  const result = rawResult
  return result
}
export function windows_get_page_size() {
  const rawResult = symbols.windows_get_page_size()
  const result = rawResult
  return result
}
export function windows_has_amd_driver() {
  const rawResult = symbols.windows_has_amd_driver()
  const result = rawResult
  return result
}
export function windows_has_dx12() {
  const rawResult = symbols.windows_has_dx12()
  const result = rawResult
  return result
}
export function windows_has_intel_driver() {
  const rawResult = symbols.windows_has_intel_driver()
  const result = rawResult
  return result
}
export function windows_has_nvidia_driver() {
  const rawResult = symbols.windows_has_nvidia_driver()
  const result = rawResult
  return result
}
export function windows_is_arm() {
  const rawResult = symbols.windows_is_arm()
  const result = rawResult
  return result
}
export function windows_preferred_backend() {
  const rawResult = symbols.windows_preferred_backend()
  const result = readPointer(rawResult)
  return decode(result)
}
export function windows_recommended_memory_strategy() {
  const rawResult = symbols.windows_recommended_memory_strategy()
  const result = readPointer(rawResult)
  return decode(result)
}
