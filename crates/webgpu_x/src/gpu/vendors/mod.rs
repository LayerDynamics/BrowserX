pub mod cuda;
pub mod metal;
pub mod rocm;

pub use cuda::{
    cuda_calculate_occupancy, cuda_has_tensor_cores, cuda_optimal_workgroup_size,
    cuda_shared_memory_bank_size, CUDACapabilities, CUDADeviceInfo,
};

pub use metal::{
    metal_max_threadgroup_memory, metal_optimal_workgroup_size, metal_simd_group_size,
    metal_supports_raytracing, metal_supports_tier2_argument_buffers, MetalCapabilities,
    MetalDeviceInfo, MetalFamily,
};

pub use rocm::{
    rocm_calculate_occupancy, rocm_has_matrix_cores, rocm_lds_size_per_cu,
    rocm_optimal_workgroup_size, rocm_supports_fp64, rocm_wavefront_size, ROCmArchitecture,
    ROCmCapabilities, ROCmDeviceInfo,
};
