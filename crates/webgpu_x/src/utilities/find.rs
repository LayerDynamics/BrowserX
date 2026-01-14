use deno_bindgen::deno_bindgen;
use serde::{Deserialize, Serialize};
use crate::gpu::detection::GPUVendor;
use lazy_static::lazy_static;
use parking_lot::Mutex;
use std::collections::HashMap;

/// GPU device registry entry
#[derive(Debug, Clone)]
struct RegisteredGPU {
    index: u32,
    vendor_id: u32,
    device_id: u32,
    name: String,
    device_type: String, // "discrete", "integrated", "virtual", "cpu"
    backend: String,
    memory_size: u64,
}

/// Global GPU registry
lazy_static! {
    static ref GPU_REGISTRY: Mutex<HashMap<u32, RegisteredGPU>> = Mutex::new(HashMap::new());
}

/// Found GPU device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundGPUDevice {
    pub index: u32,
    pub vendor: GPUVendor,
    pub vendor_id: u32,
    pub device_id: u32,
    pub name: String,
    pub memory_size: u64,
    pub is_discrete: bool,
}

/// Register a GPU device
pub fn register_gpu_device(
    index: u32,
    vendor_id: u32,
    device_id: u32,
    name: String,
    device_type: String,
    backend: String,
    memory_size: u64,
) {
    let mut registry = GPU_REGISTRY.lock();
    registry.insert(index, RegisteredGPU {
        index,
        vendor_id,
        device_id,
        name,
        device_type,
        backend,
        memory_size,
    });
}

/// Clear GPU registry
pub fn clear_gpu_registry() {
    GPU_REGISTRY.lock().clear();
}

/// Get total number of registered GPUs
pub fn get_gpu_count() -> u32 {
    GPU_REGISTRY.lock().len() as u32
}

/// Check if GPU at index exists
pub fn gpu_exists(index: u32) -> bool {
    GPU_REGISTRY.lock().contains_key(&index)
}

/// Find optimal GPU device based on workload type
pub fn find_optimal_gpu_for_workload(workload_type: String) -> u32 {
    match workload_type.as_str() {
        "compute" => find_highest_compute_gpu(),
        "graphics" => find_highest_graphics_gpu(),
        "ml" => find_ml_optimized_gpu(),
        "power" => find_lowest_power_gpu(),
        "memory" => find_highest_memory_gpu(),
        _ => find_highest_performance_gpu(),
    }
}

/// Find GPU with highest compute capability (discrete NVIDIA/AMD preferred)
pub fn find_highest_compute_gpu() -> u32 {
    let registry = GPU_REGISTRY.lock();

    // Priority: Discrete NVIDIA > Discrete AMD > Discrete Intel > Any discrete
    let mut best_index = 0u32;
    let mut best_score = 0u32;

    for (index, gpu) in registry.iter() {
        let mut score = 0u32;

        // Discrete GPUs get bonus
        if gpu.device_type == "discrete" {
            score += 1000;
        }

        // Vendor preference for compute
        match gpu.vendor_id {
            0x10DE => score += 500, // NVIDIA - best for compute (CUDA)
            0x1002 | 0x1022 => score += 400, // AMD - good compute (ROCm)
            0x8086 | 0x8087 => score += 200, // Intel - okay compute
            0x106B => score += 300, // Apple - good compute (Metal)
            _ => score += 100,
        }

        // Memory size matters for compute
        score += (gpu.memory_size / (1024 * 1024 * 1024)) as u32; // GB bonus

        if score > best_score {
            best_score = score;
            best_index = *index;
        }
    }

    best_index
}

/// Find GPU with highest graphics capability
pub fn find_highest_graphics_gpu() -> u32 {
    let registry = GPU_REGISTRY.lock();

    let mut best_index = 0u32;
    let mut best_score = 0u32;

    for (index, gpu) in registry.iter() {
        let mut score = 0u32;

        // Discrete GPUs strongly preferred for graphics
        if gpu.device_type == "discrete" {
            score += 2000;
        }

        // Vendor preference for graphics (all high-end are good)
        match gpu.vendor_id {
            0x10DE => score += 500, // NVIDIA
            0x1002 | 0x1022 => score += 500, // AMD
            0x8086 | 0x8087 => score += 300, // Intel
            0x106B => score += 450, // Apple
            _ => score += 100,
        }

        // Memory matters
        score += (gpu.memory_size / (1024 * 1024 * 1024)) as u32;

        if score > best_score {
            best_score = score;
            best_index = *index;
        }
    }

    best_index
}

/// Find GPU optimized for machine learning (tensor/matrix cores preferred)
pub fn find_ml_optimized_gpu() -> u32 {
    let registry = GPU_REGISTRY.lock();

    let mut best_index = 0u32;
    let mut best_score = 0u32;

    for (index, gpu) in registry.iter() {
        let mut score = 0u32;

        // Discrete strongly preferred
        if gpu.device_type == "discrete" {
            score += 2000;
        }

        // NVIDIA dominates ML (tensor cores)
        match gpu.vendor_id {
            0x10DE => score += 1000, // NVIDIA - tensor cores
            0x1002 | 0x1022 => score += 600, // AMD - matrix cores (CDNA)
            0x106B => score += 500, // Apple - Neural Engine
            0x8086 | 0x8087 => score += 300, // Intel
            _ => score += 100,
        }

        // ML needs lots of memory
        score += (gpu.memory_size / (512 * 1024 * 1024)) as u32; // 512MB increments

        if score > best_score {
            best_score = score;
            best_index = *index;
        }
    }

    best_index
}

/// Find GPU with highest performance
pub fn find_highest_performance_gpu() -> u32 {
    let registry = GPU_REGISTRY.lock();

    registry.iter()
        .filter(|(_, gpu)| gpu.device_type == "discrete")
        .max_by_key(|(_, gpu)| gpu.memory_size)
        .map(|(index, _)| *index)
        .unwrap_or(0)
}

/// Find GPU with highest memory
pub fn find_highest_memory_gpu() -> u32 {
    let registry = GPU_REGISTRY.lock();

    registry.iter()
        .max_by_key(|(_, gpu)| gpu.memory_size)
        .map(|(index, _)| *index)
        .unwrap_or(0)
}

/// Find all discrete GPUs
pub fn find_discrete_gpus() -> Vec<u32> {
    let registry = GPU_REGISTRY.lock();

    registry.iter()
        .filter(|(_, gpu)| gpu.device_type == "discrete")
        .map(|(index, _)| *index)
        .collect()
}

/// Find all integrated GPUs
pub fn find_integrated_gpus() -> Vec<u32> {
    let registry = GPU_REGISTRY.lock();

    registry.iter()
        .filter(|(_, gpu)| gpu.device_type == "integrated")
        .map(|(index, _)| *index)
        .collect()
}

/// Find GPUs by vendor
pub fn find_gpus_by_vendor(vendor: GPUVendor) -> Vec<u32> {
    let registry = GPU_REGISTRY.lock();

    let vendor_id = match vendor {
        GPUVendor::NVIDIA => 0x10DE,
        GPUVendor::AMD => 0x1002,
        GPUVendor::Intel => 0x8086,
        GPUVendor::Apple => 0x106B,
        GPUVendor::Qualcomm => 0x5143,
        GPUVendor::ARM => 0x13B5,
        GPUVendor::Unknown => return Vec::new(),
    };

    registry.iter()
        .filter(|(_, gpu)| gpu.vendor_id == vendor_id || (vendor_id == 0x1002 && gpu.vendor_id == 0x1022))
        .map(|(index, _)| *index)
        .collect()
}

/// Find GPU with minimum memory size (in MB)
pub fn find_gpu_with_min_memory(min_memory_mb: u64) -> u32 {
    let registry = GPU_REGISTRY.lock();
    let min_bytes = min_memory_mb * 1024 * 1024;

    registry.iter()
        .filter(|(_, gpu)| gpu.memory_size >= min_bytes)
        .max_by_key(|(_, gpu)| gpu.memory_size)
        .map(|(index, _)| *index)
        .unwrap_or(0)
}

/// Find lowest power consumption GPU (prefer integrated)
pub fn find_lowest_power_gpu() -> u32 {
    let registry = GPU_REGISTRY.lock();

    // Prefer integrated GPUs for low power
    if let Some((index, _)) = registry.iter().find(|(_, gpu)| gpu.device_type == "integrated") {
        return *index;
    }

    // Otherwise first GPU
    registry.keys().min().copied().unwrap_or(0)
}

/// Find all GPUs supporting compute
pub fn find_compute_capable_gpus() -> Vec<u32> {
    let registry = GPU_REGISTRY.lock();

    // Filter out CPU devices
    registry.iter()
        .filter(|(_, gpu)| gpu.device_type != "cpu")
        .map(|(index, _)| *index)
        .collect()
}

/// Find primary display GPU (first discrete, or first integrated)
pub fn find_primary_display_gpu() -> u32 {
    let registry = GPU_REGISTRY.lock();

    // Prefer first discrete GPU
    if let Some((index, _)) = registry.iter().find(|(_, gpu)| gpu.device_type == "discrete") {
        return *index;
    }

    // Otherwise first GPU
    registry.keys().min().copied().unwrap_or(0)
}

/// Get GPU info by index
pub fn get_gpu_info(index: u32) -> FoundGPUDevice {
    let registry = GPU_REGISTRY.lock();

    if let Some(gpu) = registry.get(&index) {
        let vendor = crate::gpu::detection::detect_gpu_vendor_enum(gpu.vendor_id);

        FoundGPUDevice {
            index: gpu.index,
            vendor,
            vendor_id: gpu.vendor_id,
            device_id: gpu.device_id,
            name: gpu.name.clone(),
            memory_size: gpu.memory_size,
            is_discrete: gpu.device_type == "discrete",
        }
    } else {
        FoundGPUDevice {
            index: 0,
            vendor: GPUVendor::Unknown,
            vendor_id: 0,
            device_id: 0,
            name: "Unknown".to_string(),
            memory_size: 0,
            is_discrete: false,
        }
    }
}

/// Find GPUs by backend type
pub fn find_gpus_by_backend(backend: String) -> Vec<u32> {
    let registry = GPU_REGISTRY.lock();

    registry.iter()
        .filter(|(_, gpu)| gpu.backend.to_lowercase() == backend.to_lowercase())
        .map(|(index, _)| *index)
        .collect()
}
