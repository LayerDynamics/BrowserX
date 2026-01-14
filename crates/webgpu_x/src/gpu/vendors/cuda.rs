use deno_bindgen::deno_bindgen;

/// CUDA-specific GPU capabilities
#[derive(Debug, Clone)]
pub struct CUDACapabilities {
    pub compute_capability_major: u32,
    pub compute_capability_minor: u32,
    pub multiprocessor_count: u32,
    pub max_threads_per_block: u32,
    pub max_threads_per_multiprocessor: u32,
    pub warp_size: u32,
    pub max_shared_memory_per_block: u64,
    pub max_shared_memory_per_multiprocessor: u64,
    pub total_global_memory: u64,
    pub memory_clock_rate: u32,
    pub memory_bus_width: u32,
    pub l2_cache_size: u64,
}

/// CUDA device information
#[derive(Debug, Clone)]
pub struct CUDADeviceInfo {
    pub device_id: u32,
    pub name: String,
    pub pci_bus_id: String,
    pub capabilities: CUDACapabilities,
}

/// Get optimal CUDA workgroup size based on compute capability
pub fn cuda_optimal_workgroup_size(compute_major: u32, compute_minor: u32) -> u32 {
    // NVIDIA warp size is always 32
    let warp_size = 32u32;

    // Optimal workgroup size based on compute capability
    match (compute_major, compute_minor) {
        // Compute 3.x (Kepler)
        (3, _) => 256,
        // Compute 5.x (Maxwell)
        (5, _) => 256,
        // Compute 6.x (Pascal)
        (6, _) => 256,
        // Compute 7.x (Volta, Turing)
        (7, _) => 256,
        // Compute 8.x (Ampere)
        (8, _) => 256,
        // Compute 9.x (Hopper)
        (9, _) => 256,
        // Default: multiple of warp size
        _ => warp_size * 8,
    }
}

/// Calculate CUDA occupancy (warps per SM)
pub fn cuda_calculate_occupancy(
    threads_per_block: u32,
    shared_memory_per_block: u64,
    compute_major: u32,
) -> f64 {
    let warp_size = 32u32;
    let warps_per_block = (threads_per_block + warp_size - 1) / warp_size;

    // Max warps per SM depends on compute capability
    let max_warps_per_sm = match compute_major {
        3 => 64,  // Kepler
        5 => 64,  // Maxwell
        6 => 64,  // Pascal
        7 => 64,  // Volta/Turing
        8 => 64,  // Ampere
        9 => 64,  // Hopper
        _ => 32,  // Conservative default
    };

    let occupancy = warps_per_block as f64 / max_warps_per_sm as f64;
    occupancy.min(1.0)
}

/// Check if tensor cores are available (returns 1 if available, 0 otherwise)
pub fn cuda_has_tensor_cores(compute_major: u32, compute_minor: u32) -> u8 {
    // Tensor cores available from Volta (7.0) onwards
    if compute_major >= 7 { 1 } else { 0 }
}

/// Get recommended shared memory bank size
pub fn cuda_shared_memory_bank_size(compute_major: u32) -> u32 {
    // Shared memory bank size in bytes
    match compute_major {
        3..=5 => 4,  // Kepler, Maxwell: 4 bytes
        _ => 4,      // Pascal onwards: 4 bytes (can be configured to 8)
    }
}
