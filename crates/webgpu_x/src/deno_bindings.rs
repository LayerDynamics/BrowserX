// This file contains all FFI exports for deno_bindgen
// All #[deno_bindgen] decorated functions MUST be in this file
// deno_bindgen does NOT support cross-module type references

use deno_bindgen::deno_bindgen;

// NOTE: webgpu_x_init, webgpu_x_version, webgpu_x_get_last_error are exported directly from error.rs
// NOTE: detect_gpu_vendor, get_optimal_workgroup_size are exported directly from gpu/detection.rs
// NOTE: metal_* functions are exported directly from gpu/vendors/metal.rs
// NOTE: rocm_* functions are exported directly from gpu/vendors/rocm.rs
// NOTE: darwin_*, linux_*, windows_* functions are exported directly from os/*.rs

// ============================================================================
// GPU VENDOR DETECTION
// ============================================================================
// These functions are NOT exported elsewhere, so we export them here

// ============================================================================
// BUFFER POOL
// ============================================================================

#[deno_bindgen]
pub fn buffer_pool_acquire(size: u64, usage: u32) -> u64 {
    crate::memory::buffer_pool::buffer_pool_acquire(size, usage)
}

#[deno_bindgen]
pub fn buffer_pool_release(handle: u64) {
    crate::memory::buffer_pool::buffer_pool_release(handle);
}

#[deno_bindgen]
pub fn buffer_pool_add(handle: u64, size: u64, usage: u32) {
    crate::memory::buffer_pool::buffer_pool_add(handle, size, usage);
}

#[deno_bindgen]
pub fn buffer_pool_remove(handle: u64) {
    crate::memory::buffer_pool::buffer_pool_remove(handle);
}

#[deno_bindgen]
pub fn buffer_pool_clear() {
    crate::memory::buffer_pool::buffer_pool_clear();
}

#[deno_bindgen]
pub fn buffer_pool_evict() {
    crate::memory::buffer_pool::buffer_pool_evict();
}

// ============================================================================
// STAGING BELT
// ============================================================================

/// Result of a staging write operation
#[deno_bindgen]
pub struct StagingWrite {
    pub buffer_handle: u64,
    pub offset: u64,
    pub size: u64,
}

/// Statistics about staging belt usage
#[deno_bindgen]
pub struct StagingBeltStats {
    pub active_chunks: u32,
    pub free_chunks: u32,
    pub chunk_size: u64,
    pub total_allocated: u64,
}

#[deno_bindgen]
pub fn staging_belt_create(chunk_size: u64) -> u64 {
    crate::memory::staging_belt::staging_belt_create(chunk_size)
}

#[deno_bindgen]
pub fn staging_belt_write(belt_handle: u64, size: u64) -> StagingWrite {
    let write = crate::memory::staging_belt::staging_belt_write(belt_handle, size);
    StagingWrite {
        buffer_handle: write.buffer_handle,
        offset: write.offset,
        size: write.size,
    }
}

#[deno_bindgen]
pub fn staging_belt_finish(belt_handle: u64) {
    crate::memory::staging_belt::staging_belt_finish(belt_handle);
}

#[deno_bindgen]
pub fn staging_belt_stats(belt_handle: u64) -> StagingBeltStats {
    let stats = crate::memory::staging_belt::staging_belt_stats(belt_handle);
    StagingBeltStats {
        active_chunks: stats.active_chunks,
        free_chunks: stats.free_chunks,
        chunk_size: stats.chunk_size,
        total_allocated: stats.total_allocated,
    }
}

#[deno_bindgen]
pub fn staging_belt_destroy(belt_handle: u64) {
    crate::memory::staging_belt::staging_belt_destroy(belt_handle);
}

// ============================================================================
// BUFFER INITIALIZATION HELPERS
// ============================================================================

#[deno_bindgen]
pub fn buffer_calculate_aligned_size(size: u64, alignment: u64) -> u64 {
    crate::memory::buffer_init::calculate_aligned_size(size, alignment)
}

#[deno_bindgen]
pub fn buffer_get_alignment(usage: u32) -> u64 {
    crate::memory::buffer_init::get_buffer_alignment(usage)
}

#[deno_bindgen]
pub fn buffer_get_row_padding(row_size: u64) -> u64 {
    crate::memory::buffer_init::get_row_padding(row_size)
}

#[deno_bindgen]
pub fn buffer_get_padded_row_size(row_size: u64) -> u64 {
    crate::memory::buffer_init::get_padded_row_size(row_size)
}

#[deno_bindgen]
pub fn buffer_calculate_texture_buffer_size(width: u32, height: u32, bytes_per_pixel: u32) -> u64 {
    crate::memory::buffer_init::calculate_texture_buffer_size(width, height, bytes_per_pixel)
}

// NOTE: OS detection functions (darwin_*, linux_*, windows_*) are exported directly from os/*.rs files

// ============================================================================
// CUDA HELPERS (not exported elsewhere, so we export them here)
// ============================================================================

#[deno_bindgen]
pub fn cuda_optimal_workgroup_size(compute_major: u32, compute_minor: u32) -> u32 {
    crate::gpu::vendors::cuda::cuda_optimal_workgroup_size(compute_major, compute_minor)
}

#[deno_bindgen]
pub fn cuda_calculate_occupancy(threads_per_block: u32, shared_memory_per_block: u64, compute_major: u32) -> f64 {
    crate::gpu::vendors::cuda::cuda_calculate_occupancy(threads_per_block, shared_memory_per_block, compute_major)
}

#[deno_bindgen]
pub fn cuda_has_tensor_cores(compute_major: u32, compute_minor: u32) -> u8 {
    crate::gpu::vendors::cuda::cuda_has_tensor_cores(compute_major, compute_minor)
}

#[deno_bindgen]
pub fn cuda_shared_memory_bank_size(compute_major: u32) -> u32 {
    crate::gpu::vendors::cuda::cuda_shared_memory_bank_size(compute_major)
}

// NOTE: metal_* functions are exported directly from gpu/vendors/metal.rs with u32 parameters
// NOTE: rocm_* functions are exported directly from gpu/vendors/rocm.rs with u32 parameters

// ============================================================================
// VULKAN HELPERS (not exported elsewhere, so we export them here)
// ============================================================================

#[deno_bindgen]
pub fn vulkan_optimal_workgroup_size(vendor_id: u32, subgroup_size: u32) -> u32 {
    crate::gpu::non_vendor::vulkan::vulkan_optimal_workgroup_size(vendor_id, subgroup_size)
}

#[deno_bindgen]
pub fn vulkan_supports_version(api_major: u32, api_minor: u32, required_major: u32, required_minor: u32) -> u8 {
    crate::gpu::non_vendor::vulkan::vulkan_supports_version(api_major, api_minor, required_major, required_minor)
}

#[deno_bindgen]
pub fn vulkan_supports_raytracing(api_major: u32, api_minor: u32) -> u8 {
    crate::gpu::non_vendor::vulkan::vulkan_supports_raytracing(api_major, api_minor)
}

#[deno_bindgen]
pub fn vulkan_recommended_descriptor_sets() -> u32 {
    crate::gpu::non_vendor::vulkan::vulkan_recommended_descriptor_sets()
}

// ============================================================================
// OPENCL HELPERS - using u32 for OpenCLDeviceType enum
// ============================================================================

#[deno_bindgen]
pub fn opencl_optimal_workgroup_size(device_type: u32, max_work_group_size: u64) -> u64 {
    use crate::gpu::non_vendor::opencl::OpenCLDeviceType;
    let dev_type = match device_type {
        0 => OpenCLDeviceType::CPU,
        1 => OpenCLDeviceType::GPU,
        2 => OpenCLDeviceType::Accelerator,
        3 => OpenCLDeviceType::Default,
        4 => OpenCLDeviceType::Custom,
        5 => OpenCLDeviceType::All,
        _ => OpenCLDeviceType::Default,
    };
    crate::gpu::non_vendor::opencl::opencl_optimal_workgroup_size(dev_type, max_work_group_size)
}

#[deno_bindgen]
pub fn opencl_supports_version(version_major: u32, version_minor: u32, required_major: u32, required_minor: u32) -> u8 {
    crate::gpu::non_vendor::opencl::opencl_supports_version(version_major, version_minor, required_major, required_minor)
}

#[deno_bindgen]
pub fn opencl_supports_fp64(version_major: u32, version_minor: u32) -> u8 {
    crate::gpu::non_vendor::opencl::opencl_supports_fp64(version_major, version_minor)
}

// ============================================================================
// TEXTURE UTILITIES
// ============================================================================

/// Calculate mipmap level count for texture
#[deno_bindgen]
pub fn texture_calculate_mip_levels(width: u32, height: u32) -> u32 {
    crate::texture::calculate_mip_levels(width, height)
}

/// Calculate texture dimensions at specific mip level
/// Returns (width, height) as separate values via MipSize struct
#[deno_bindgen]
pub struct MipSize {
    pub width: u32,
    pub height: u32,
}

#[deno_bindgen]
pub fn texture_get_mip_size(width: u32, height: u32, mip_level: u32) -> MipSize {
    let (w, h) = crate::texture::get_mip_level_size(width, height, mip_level);
    MipSize { width: w, height: h }
}

/// Calculate 3D texture dimensions at specific mip level
#[deno_bindgen]
pub struct MipSize3D {
    pub width: u32,
    pub height: u32,
    pub depth: u32,
}

#[deno_bindgen]
pub fn texture_get_mip_size_3d(width: u32, height: u32, depth: u32, mip_level: u32) -> MipSize3D {
    let (w, h, d) = crate::texture::get_mip_level_size_3d(width, height, depth, mip_level);
    MipSize3D { width: w, height: h, depth: d }
}

// ============================================================================
// SHADER COMPILATION & HOT-RELOAD
// ============================================================================

/// Create a new shader cache
#[deno_bindgen]
pub fn shader_cache_create() -> u64 {
    crate::shader::shader_cache_create()
}

/// Detect shader stage from file extension
/// Returns: 0=Vertex, 1=Fragment, 2=Compute
#[deno_bindgen]
pub fn shader_detect_stage(file_path: &str) -> u32 {
    use crate::shader::ShaderStage;
    let stage = crate::shader::detect_shader_stage(file_path);
    match stage {
        ShaderStage::Vertex => 0,
        ShaderStage::Fragment => 1,
        ShaderStage::Compute => 2,
    }
}

/// Shader cache statistics
#[deno_bindgen]
pub struct ShaderCacheStats {
    pub cached_shaders: u32,
}

/// Get shader cache statistics
#[deno_bindgen]
pub fn shader_cache_stats(cache_handle: u64) -> ShaderCacheStats {
    let stats = crate::shader::shader_cache_stats(cache_handle);
    ShaderCacheStats {
        cached_shaders: stats.cached_shaders,
    }
}

/// Check if shader file has changed
/// Returns: 1 if changed, 0 if not changed
#[deno_bindgen]
pub fn shader_cache_has_changed(cache_handle: u64, file_path: &str) -> u8 {
    if crate::shader::shader_cache_has_changed(cache_handle, file_path.to_string()) {
        1
    } else {
        0
    }
}

/// Clear shader cache
#[deno_bindgen]
pub fn shader_cache_clear(cache_handle: u64) {
    crate::shader::shader_cache_clear(cache_handle);
}

/// Destroy shader cache
#[deno_bindgen]
pub fn shader_cache_destroy(cache_handle: u64) {
    crate::shader::shader_cache_destroy(cache_handle);
}

/// Load shader from file
/// Returns JSON-serialized ShaderSource or empty string on error
#[deno_bindgen]
pub fn shader_cache_load(cache_handle: u64, file_path: &str) -> String {
    match crate::shader::shader_cache_load(cache_handle, file_path.to_string()) {
        Ok(source) => serde_json::to_string(&source).unwrap_or_default(),
        Err(_) => String::new(),
    }
}

/// Load shader from string
/// Returns JSON-serialized ShaderSource
#[deno_bindgen]
pub fn shader_cache_load_from_string(
    cache_handle: u64,
    code: &str,
    stage: u32,
    entry_point: &str,
) -> String {
    use crate::shader::ShaderStage;
    let shader_stage = match stage {
        0 => ShaderStage::Vertex,
        1 => ShaderStage::Fragment,
        _ => ShaderStage::Compute,
    };

    match crate::shader::shader_cache_load_from_string(
        cache_handle,
        code.to_string(),
        shader_stage,
        entry_point.to_string(),
    ) {
        Ok(source) => serde_json::to_string(&source).unwrap_or_default(),
        Err(_) => String::new(),
    }
}

// ============================================================================
// WGSL CODE GENERATION
// ============================================================================

/// Generate WGSL storage buffer binding
#[deno_bindgen]
pub fn wgsl_binding_buffer(group: u32, binding: u32, var_name: &str, access: &str) -> String {
    crate::shader::wgsl_binding_buffer(group, binding, var_name.to_string(), access.to_string())
}

/// Generate WGSL uniform binding
#[deno_bindgen]
pub fn wgsl_binding_uniform(group: u32, binding: u32, var_name: &str, struct_name: &str) -> String {
    crate::shader::wgsl_binding_uniform(group, binding, var_name.to_string(), struct_name.to_string())
}

/// Generate WGSL texture binding
#[deno_bindgen]
pub fn wgsl_binding_texture(group: u32, binding: u32, var_name: &str, texture_type: &str) -> String {
    crate::shader::wgsl_binding_texture(group, binding, var_name.to_string(), texture_type.to_string())
}

/// Generate WGSL sampler binding
#[deno_bindgen]
pub fn wgsl_binding_sampler(group: u32, binding: u32, var_name: &str) -> String {
    crate::shader::wgsl_binding_sampler(group, binding, var_name.to_string())
}

/// Generate WGSL struct definition
/// fields should be JSON array of strings
#[deno_bindgen]
pub fn wgsl_struct(name: &str, fields_json: &str) -> String {
    if let Ok(fields) = serde_json::from_str::<Vec<String>>(fields_json) {
        crate::shader::wgsl_struct(name.to_string(), fields)
    } else {
        String::new()
    }
}

/// Generate WGSL struct field
#[deno_bindgen]
pub fn wgsl_struct_field(name: &str, type_name: &str) -> String {
    crate::shader::wgsl_struct_field(name.to_string(), type_name.to_string())
}

/// Generate WGSL vertex shader entry point
/// inputs and outputs should be JSON arrays of strings
#[deno_bindgen]
pub fn wgsl_vertex_entry(name: &str, inputs_json: &str, outputs_json: &str, body: &str) -> String {
    let inputs = serde_json::from_str::<Vec<String>>(inputs_json).unwrap_or_default();
    let outputs = serde_json::from_str::<Vec<String>>(outputs_json).unwrap_or_default();
    crate::shader::wgsl_vertex_entry(name.to_string(), inputs, outputs, body.to_string())
}

/// Generate WGSL fragment shader entry point
/// inputs and outputs should be JSON arrays of strings
#[deno_bindgen]
pub fn wgsl_fragment_entry(name: &str, inputs_json: &str, outputs_json: &str, body: &str) -> String {
    let inputs = serde_json::from_str::<Vec<String>>(inputs_json).unwrap_or_default();
    let outputs = serde_json::from_str::<Vec<String>>(outputs_json).unwrap_or_default();
    crate::shader::wgsl_fragment_entry(name.to_string(), inputs, outputs, body.to_string())
}

/// Generate WGSL compute shader entry point
/// inputs should be JSON array of strings
#[deno_bindgen]
pub fn wgsl_compute_entry(
    name: &str,
    workgroup_x: u32,
    workgroup_y: u32,
    workgroup_z: u32,
    inputs_json: &str,
    body: &str,
) -> String {
    let inputs = serde_json::from_str::<Vec<String>>(inputs_json).unwrap_or_default();
    crate::shader::wgsl_compute_entry(
        name.to_string(),
        workgroup_x,
        workgroup_y,
        workgroup_z,
        inputs,
        body.to_string(),
    )
}

/// Generate WGSL builtin attribute
#[deno_bindgen]
pub fn wgsl_builtin(name: &str, builtin_type: &str) -> String {
    crate::shader::wgsl_builtin(name.to_string(), builtin_type.to_string())
}

/// Generate WGSL location attribute
#[deno_bindgen]
pub fn wgsl_location(name: &str, location: u32, type_name: &str) -> String {
    crate::shader::wgsl_location(name.to_string(), location, type_name.to_string())
}

/// Generate WGSL function
/// params should be JSON array of strings
#[deno_bindgen]
pub fn wgsl_function(name: &str, params_json: &str, return_type: &str, body: &str) -> String {
    let params = serde_json::from_str::<Vec<String>>(params_json).unwrap_or_default();
    crate::shader::wgsl_function(name.to_string(), params, return_type.to_string(), body.to_string())
}

/// Minify WGSL shader code (remove comments and excess whitespace)
#[deno_bindgen]
pub fn wgsl_minify(shader_code: &str) -> String {
    crate::shader::wgsl_minify(shader_code.to_string())
}

/// Count lines in shader code
#[deno_bindgen]
pub fn wgsl_line_count(shader_code: &str) -> u32 {
    crate::shader::wgsl_line_count(shader_code.to_string())
}

/// Extract function names from shader code
/// Returns JSON array of function names
#[deno_bindgen]
pub fn wgsl_extract_functions(shader_code: &str) -> String {
    let functions = crate::shader::wgsl_extract_functions(shader_code.to_string());
    serde_json::to_string(&functions).unwrap_or_default()
}

// ============================================================================
// COMPUTE KERNEL TEMPLATES
// ============================================================================

/// Generate compute kernel from template
/// operation: 0=Add, 1=Subtract, 2=Multiply, 3=Divide, 4=MatrixMultiply,
///            5=Conv1D, 6=Conv2D, 7=Relu, 8=Sigmoid, 9=Tanh, 10=Softmax,
///            11=LayerNorm, 12=BatchNorm, 13=MaxPool2D, 14=AvgPool2D,
///            15=Transpose, 16=ReduceSum, 17=ReduceMax, 18=ReduceMean
#[deno_bindgen]
pub fn kernel_generate_from_template(
    operation: u32,
    workgroup_x: u32,
    workgroup_y: u32,
    workgroup_z: u32,
) -> String {
    use crate::compute::KernelOperation;

    let op = match operation {
        0 => KernelOperation::Add,
        1 => KernelOperation::Subtract,
        2 => KernelOperation::Multiply,
        3 => KernelOperation::Divide,
        4 => KernelOperation::MatrixMultiply,
        5 => KernelOperation::Conv1D,
        6 => KernelOperation::Conv2D,
        7 => KernelOperation::Relu,
        8 => KernelOperation::Sigmoid,
        9 => KernelOperation::Tanh,
        10 => KernelOperation::Softmax,
        11 => KernelOperation::LayerNorm,
        12 => KernelOperation::BatchNorm,
        13 => KernelOperation::MaxPool2D,
        14 => KernelOperation::AvgPool2D,
        15 => KernelOperation::Transpose,
        16 => KernelOperation::ReduceSum,
        17 => KernelOperation::ReduceMax,
        18 => KernelOperation::ReduceMean,
        _ => return String::new(),
    };

    crate::compute::generate_kernel(op, (workgroup_x, workgroup_y, workgroup_z))
}

// ============================================================================
// Tensor Operations
// ============================================================================

/// Create tensor metadata
///
/// # Arguments
/// * `buffer_handle` - GPU buffer handle
/// * `dimensions_json` - JSON array of dimensions (e.g., "[2, 3, 4]")
/// * `dtype` - Data type (0=Float32, 1=Float16, 2=Int32, 3=Int8, 4=UInt8)
/// * `access` - Access pattern (0=ReadOnly, 1=WriteOnly, 2=ReadWrite, 3=Uniform)
///
/// # Returns
/// JSON string containing tensor metadata or empty string on error
#[deno_bindgen]
pub fn tensor_create(
    buffer_handle: u64,
    dimensions_json: &str,
    dtype: u32,
    access: u32,
) -> String {
    use crate::tensor::{TensorAccess, TensorDType, TensorMeta};

    let dimensions: Vec<u32> = match serde_json::from_str(dimensions_json) {
        Ok(dims) => dims,
        Err(_) => return String::new(),
    };

    let tensor_dtype = match dtype {
        0 => TensorDType::Float32,
        1 => TensorDType::Float16,
        2 => TensorDType::Int32,
        3 => TensorDType::Int8,
        4 => TensorDType::UInt8,
        _ => return String::new(),
    };

    let tensor_access = match access {
        0 => TensorAccess::ReadOnly,
        1 => TensorAccess::WriteOnly,
        2 => TensorAccess::ReadWrite,
        3 => TensorAccess::Uniform,
        _ => return String::new(),
    };

    let tensor = TensorMeta::new(buffer_handle, dimensions, tensor_dtype, tensor_access);
    serde_json::to_string(&tensor).unwrap_or_default()
}

/// Get tensor size in bytes
///
/// # Arguments
/// * `tensor_json` - JSON string containing tensor metadata
///
/// # Returns
/// Size in bytes or 0 on error
#[deno_bindgen]
pub fn tensor_size_bytes(tensor_json: &str) -> u64 {
    use crate::tensor::TensorMeta;

    let tensor: TensorMeta = match serde_json::from_str(tensor_json) {
        Ok(t) => t,
        Err(_) => return 0,
    };

    tensor.size_bytes()
}

/// Get tensor rank (number of dimensions)
///
/// # Arguments
/// * `tensor_json` - JSON string containing tensor metadata
///
/// # Returns
/// Number of dimensions or 0 on error
#[deno_bindgen]
pub fn tensor_rank(tensor_json: &str) -> u32 {
    use crate::tensor::TensorMeta;

    let tensor: TensorMeta = match serde_json::from_str(tensor_json) {
        Ok(t) => t,
        Err(_) => return 0,
    };

    tensor.rank()
}

/// Get total number of elements in tensor
///
/// # Arguments
/// * `tensor_json` - JSON string containing tensor metadata
///
/// # Returns
/// Total number of elements or 0 on error
#[deno_bindgen]
pub fn tensor_total_elements(tensor_json: &str) -> u64 {
    use crate::tensor::TensorMeta;

    let tensor: TensorMeta = match serde_json::from_str(tensor_json) {
        Ok(t) => t,
        Err(_) => return 0,
    };

    tensor.total_elements()
}

/// Reshape tensor to new dimensions
///
/// # Arguments
/// * `tensor_json` - JSON string containing tensor metadata
/// * `new_dimensions_json` - JSON array of new dimensions
///
/// # Returns
/// JSON string containing reshaped tensor metadata or empty string on error
#[deno_bindgen]
pub fn tensor_reshape(tensor_json: &str, new_dimensions_json: &str) -> String {
    use crate::tensor::TensorMeta;

    let tensor: TensorMeta = match serde_json::from_str(tensor_json) {
        Ok(t) => t,
        Err(_) => return String::new(),
    };

    let new_dimensions: Vec<u32> = match serde_json::from_str(new_dimensions_json) {
        Ok(dims) => dims,
        Err(_) => return String::new(),
    };

    match tensor.reshape(new_dimensions) {
        Ok(reshaped) => serde_json::to_string(&reshaped).unwrap_or_default(),
        Err(_) => String::new(),
    }
}

/// Transpose 2D tensor
///
/// # Arguments
/// * `tensor_json` - JSON string containing tensor metadata (must be 2D)
///
/// # Returns
/// JSON string containing transposed tensor metadata or empty string on error
#[deno_bindgen]
pub fn tensor_transpose_2d(tensor_json: &str) -> String {
    use crate::tensor::TensorMeta;

    let tensor: TensorMeta = match serde_json::from_str(tensor_json) {
        Ok(t) => t,
        Err(_) => return String::new(),
    };

    match tensor.transpose_2d() {
        Ok(transposed) => serde_json::to_string(&transposed).unwrap_or_default(),
        Err(_) => String::new(),
    }
}

/// Create tensor view with offset
///
/// # Arguments
/// * `tensor_json` - JSON string containing tensor metadata
/// * `offset_elements` - Number of elements to offset from start
///
/// # Returns
/// JSON string containing tensor view metadata or empty string on error
#[deno_bindgen]
pub fn tensor_view(tensor_json: &str, offset_elements: u64) -> String {
    use crate::tensor::TensorMeta;

    let tensor: TensorMeta = match serde_json::from_str(tensor_json) {
        Ok(t) => t,
        Err(_) => return String::new(),
    };

    match tensor.view(offset_elements) {
        Ok(view) => serde_json::to_string(&view).unwrap_or_default(),
        Err(_) => String::new(),
    }
}

/// Check if tensor is contiguous in memory
///
/// # Arguments
/// * `tensor_json` - JSON string containing tensor metadata
///
/// # Returns
/// 1 if contiguous, 0 if not or on error
#[deno_bindgen]
pub fn tensor_is_contiguous(tensor_json: &str) -> u8 {
    use crate::tensor::TensorMeta;

    let tensor: TensorMeta = match serde_json::from_str(tensor_json) {
        Ok(t) => t,
        Err(_) => return 0,
    };

    if tensor.is_contiguous() { 1 } else { 0 }
}

/// Get tensor shape dimensions as JSON array
///
/// # Arguments
/// * `tensor_json` - JSON string containing tensor metadata
///
/// # Returns
/// JSON array of dimensions or empty string on error
#[deno_bindgen]
pub fn tensor_get_shape(tensor_json: &str) -> String {
    use crate::tensor::TensorMeta;

    let tensor: TensorMeta = match serde_json::from_str(tensor_json) {
        Ok(t) => t,
        Err(_) => return String::new(),
    };

    serde_json::to_string(&tensor.shape.dimensions).unwrap_or_default()
}

/// Get tensor strides as JSON array
///
/// # Arguments
/// * `tensor_json` - JSON string containing tensor metadata
///
/// # Returns
/// JSON array of strides or empty string on error
#[deno_bindgen]
pub fn tensor_get_strides(tensor_json: &str) -> String {
    use crate::tensor::TensorMeta;

    let tensor: TensorMeta = match serde_json::from_str(tensor_json) {
        Ok(t) => t,
        Err(_) => return String::new(),
    };

    serde_json::to_string(&tensor.stride).unwrap_or_default()
}

// ============================================================================
// Framework Helpers - Matrix Operations and Device Configuration
// ============================================================================

/// Get default device configuration
///
/// # Returns
/// JSON string containing DeviceConfig with default settings
#[deno_bindgen]
pub fn framework_device_config_default() -> String {
    use crate::framework::DeviceConfig;

    let config = DeviceConfig::default();
    serde_json::to_string(&config).unwrap_or_default()
}

/// Get OpenGL to WGPU coordinate system conversion matrix
///
/// # Returns
/// JSON array of 16 f32 values (4x4 matrix in column-major order)
#[deno_bindgen]
pub fn framework_matrix_opengl_to_wgpu() -> String {
    use crate::framework::opengl_to_wgpu_matrix;

    let matrix = opengl_to_wgpu_matrix();
    serde_json::to_string(&matrix).unwrap_or_default()
}

/// Create perspective projection matrix
///
/// # Arguments
/// * `fov_y` - Field of view in radians (vertical)
/// * `aspect` - Aspect ratio (width / height)
/// * `near` - Near clipping plane distance
/// * `far` - Far clipping plane distance
///
/// # Returns
/// JSON array of 16 f32 values (4x4 matrix in column-major order)
#[deno_bindgen]
pub fn framework_matrix_perspective(fov_y: f32, aspect: f32, near: f32, far: f32) -> String {
    use crate::framework::create_perspective_matrix;

    let matrix = create_perspective_matrix(fov_y, aspect, near, far);
    serde_json::to_string(&matrix).unwrap_or_default()
}

/// Create orthographic projection matrix
///
/// # Arguments
/// * `left` - Left clipping plane coordinate
/// * `right` - Right clipping plane coordinate
/// * `bottom` - Bottom clipping plane coordinate
/// * `top` - Top clipping plane coordinate
/// * `near` - Near clipping plane distance
/// * `far` - Far clipping plane distance
///
/// # Returns
/// JSON array of 16 f32 values (4x4 matrix in column-major order)
#[deno_bindgen]
pub fn framework_matrix_orthographic(
    left: f32,
    right: f32,
    bottom: f32,
    top: f32,
    near: f32,
    far: f32,
) -> String {
    use crate::framework::create_orthographic_matrix;

    let matrix = create_orthographic_matrix(left, right, bottom, top, near, far);
    serde_json::to_string(&matrix).unwrap_or_default()
}

/// Create view matrix for camera
///
/// # Arguments
/// * `eye_json` - JSON array [x, y, z] for camera position
/// * `target_json` - JSON array [x, y, z] for look-at target
/// * `up_json` - JSON array [x, y, z] for up vector
///
/// # Returns
/// JSON array of 16 f32 values (4x4 matrix in column-major order)
#[deno_bindgen]
pub fn framework_matrix_view(eye_json: &str, target_json: &str, up_json: &str) -> String {
    use crate::framework::create_view_matrix;

    let eye: [f32; 3] = match serde_json::from_str(eye_json) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };

    let target: [f32; 3] = match serde_json::from_str(target_json) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };

    let up: [f32; 3] = match serde_json::from_str(up_json) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };

    let matrix = create_view_matrix(eye, target, up);
    serde_json::to_string(&matrix).unwrap_or_default()
}

/// Create model matrix from translation, rotation, and scale
///
/// # Arguments
/// * `translation_json` - JSON array [x, y, z] for position
/// * `rotation_json` - JSON array [x, y, z] for rotation in radians (Euler angles)
/// * `scale_json` - JSON array [x, y, z] for scale factors
///
/// # Returns
/// JSON array of 16 f32 values (4x4 matrix in column-major order)
#[deno_bindgen]
pub fn framework_matrix_model(
    translation_json: &str,
    rotation_json: &str,
    scale_json: &str,
) -> String {
    use crate::framework::create_model_matrix;

    let translation: [f32; 3] = match serde_json::from_str(translation_json) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };

    let rotation: [f32; 3] = match serde_json::from_str(rotation_json) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };

    let scale: [f32; 3] = match serde_json::from_str(scale_json) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };

    let matrix = create_model_matrix(translation, rotation, scale);
    serde_json::to_string(&matrix).unwrap_or_default()
}
