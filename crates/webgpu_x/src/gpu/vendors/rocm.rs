use deno_bindgen::deno_bindgen;

/// ROCm/AMD GPU architecture
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ROCmArchitecture {
    GCN,      // Graphics Core Next
    RDNA,     // RDNA 1.0
    RDNA2,    // RDNA 2.0
    RDNA3,    // RDNA 3.0
    CDNA,     // CDNA 1.0 (MI100)
    CDNA2,    // CDNA 2.0 (MI200)
    CDNA3,    // CDNA 3.0 (MI300)
    Unknown,
}

/// ROCm-specific GPU capabilities
#[derive(Debug, Clone)]
pub struct ROCmCapabilities {
    pub architecture: ROCmArchitecture,
    pub compute_units: u32,
    pub wavefront_size: u32,
    pub max_workgroup_size: u32,
    pub max_waves_per_cu: u32,
    pub lds_size_per_cu: u64,  // Local Data Share
    pub vgpr_count: u32,        // Vector General Purpose Registers
    pub sgpr_count: u32,        // Scalar General Purpose Registers
    pub total_vram: u64,
    pub memory_bandwidth: u64,
}

/// ROCm device information
#[derive(Debug, Clone)]
pub struct ROCmDeviceInfo {
    pub device_id: u32,
    pub name: String,
    pub pci_bus_id: String,
    pub architecture: ROCmArchitecture,
    pub capabilities: ROCmCapabilities,
}

/// Get optimal ROCm workgroup size based on architecture (architecture as u32: 0=GCN, 1=RDNA, 2=RDNA2, 3=RDNA3, 4=CDNA, 5=CDNA2, 6=CDNA3, 7=Unknown)
#[deno_bindgen]
pub fn rocm_optimal_workgroup_size(architecture: u32) -> u32 {
    match architecture {
        0 => 256,  // GCN: Wavefront 64, prefer 4 waves
        1 => 256,  // RDNA: Wavefront 32, prefer 8 waves
        2 => 256,  // RDNA2: Wavefront 32, prefer 8 waves
        3 => 256,  // RDNA3: Wavefront 32, prefer 8 waves
        4 => 256,  // CDNA: Wavefront 64, prefer 4 waves
        5 => 256,  // CDNA2: Wavefront 64, prefer 4 waves
        6 => 256,  // CDNA3: Wavefront 64, prefer 4 waves
        _ => 64,   // Unknown: Conservative default
    }
}

/// Get wavefront size for architecture (architecture as u32: 0=GCN, 1=RDNA, 2=RDNA2, 3=RDNA3, 4=CDNA, 5=CDNA2, 6=CDNA3, 7=Unknown)
#[deno_bindgen]
pub fn rocm_wavefront_size(architecture: u32) -> u32 {
    match architecture {
        0 => 64,          // GCN
        1 | 2 | 3 => 32,  // RDNA/RDNA2/RDNA3
        4 | 5 | 6 => 64,  // CDNA/CDNA2/CDNA3
        _ => 64,          // Unknown: Conservative default
    }
}

/// Calculate ROCm occupancy (waves per CU) - architecture as u32: 0=GCN, 1=RDNA, 2=RDNA2, 3=RDNA3, 4=CDNA, 5=CDNA2, 6=CDNA3, 7=Unknown
#[deno_bindgen]
pub fn rocm_calculate_occupancy(
    workgroup_size: u32,
    lds_usage: u64,
    architecture: u32,
) -> f64 {
    let wavefront_size = rocm_wavefront_size(architecture);
    let waves_per_workgroup = (workgroup_size + wavefront_size - 1) / wavefront_size;

    // Max waves per CU depends on architecture
    let max_waves_per_cu = match architecture {
        0 => 40,          // GCN
        1 | 2 | 3 => 32,  // RDNA/RDNA2/RDNA3
        4 => 40,          // CDNA
        5 => 56,          // CDNA2
        6 => 64,          // CDNA3
        _ => 32,          // Unknown
    };

    let occupancy = waves_per_workgroup as f64 / max_waves_per_cu as f64;
    occupancy.min(1.0)
}

/// Check if architecture supports matrix cores (architecture as u32: 0=GCN, 1=RDNA, 2=RDNA2, 3=RDNA3, 4=CDNA, 5=CDNA2, 6=CDNA3, 7=Unknown; returns 1 if supported, 0 otherwise)
#[deno_bindgen]
pub fn rocm_has_matrix_cores(architecture: u32) -> u8 {
    // CDNA/CDNA2/CDNA3 (4-6) and RDNA3 (3) support matrix cores
    if matches!(architecture, 3 | 4 | 5 | 6) { 1 } else { 0 }
}

/// Get LDS (Local Data Share) size per CU (architecture as u32: 0=GCN, 1=RDNA, 2=RDNA2, 3=RDNA3, 4=CDNA, 5=CDNA2, 6=CDNA3, 7=Unknown)
#[deno_bindgen]
pub fn rocm_lds_size_per_cu(architecture: u32) -> u64 {
    match architecture {
        0 => 64 * 1024,       // GCN: 64 KB
        1 => 128 * 1024,      // RDNA: 128 KB
        2 => 128 * 1024,      // RDNA2: 128 KB
        3 => 128 * 1024,      // RDNA3: 128 KB
        4 => 64 * 1024,       // CDNA: 64 KB
        5 => 64 * 1024,       // CDNA2: 64 KB
        6 => 64 * 1024,       // CDNA3: 64 KB
        _ => 64 * 1024,       // Unknown: Conservative 64 KB
    }
}

/// Check if architecture supports double precision (architecture as u32: 0=GCN, 1=RDNA, 2=RDNA2, 3=RDNA3, 4=CDNA, 5=CDNA2, 6=CDNA3, 7=Unknown; returns 1 if supported, 0 otherwise)
#[deno_bindgen]
pub fn rocm_supports_fp64(architecture: u32) -> u8 {
    // CDNA architectures (4-6) have full FP64 support
    if matches!(architecture, 4 | 5 | 6) { 1 } else { 0 }
}
