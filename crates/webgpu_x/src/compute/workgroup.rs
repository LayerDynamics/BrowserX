use deno_bindgen::deno_bindgen;
use serde::{Deserialize, Serialize};
use crate::gpu::detection::GPUVendor;
use crate::gpu::limits::DeviceLimits;

/// Workgroup size calculation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkgroupSize {
    pub x: u32,
    pub y: u32,
    pub z: u32,
    pub total_invocations: u32,
}

/// Calculate optimal workgroup size for 1D problem
pub fn calculate_workgroup_size_1d(
    problem_size: u32,
    vendor: GPUVendor,
    limits: DeviceLimits,
) -> WorkgroupSize {
    let max_size = limits.max_compute_workgroup_size_x
        .min(limits.max_compute_invocations_per_workgroup);

    // Vendor-specific preferred sizes
    let preferred = match vendor {
        GPUVendor::NVIDIA => 256,  // Warp size 32
        GPUVendor::AMD => 256,     // Wavefront 64
        GPUVendor::Intel => 128,
        GPUVendor::Apple => 256,   // SIMD group 32
        _ => 64,
    };

    let size_x = preferred.min(max_size);
    let size_x = if size_x == 0 { 1 } else { size_x.next_power_of_two() / 2 };

    WorkgroupSize {
        x: size_x,
        y: 1,
        z: 1,
        total_invocations: size_x,
    }
}

/// Calculate optimal workgroup size for 2D problem
pub fn calculate_workgroup_size_2d(
    width: u32,
    height: u32,
    vendor: GPUVendor,
    limits: DeviceLimits,
) -> WorkgroupSize {
    // Common 2D sizes: 8x8, 16x16, 32x32
    let preferred_dim = match vendor {
        GPUVendor::NVIDIA => 16,
        GPUVendor::AMD => 16,
        GPUVendor::Apple => 16,
        _ => 8,
    };

    let size_x = preferred_dim.min(limits.max_compute_workgroup_size_x);
    let size_y = preferred_dim.min(limits.max_compute_workgroup_size_y);
    let total = size_x * size_y;

    if total <= limits.max_compute_invocations_per_workgroup {
        WorkgroupSize {
            x: size_x,
            y: size_y,
            z: 1,
            total_invocations: total,
        }
    } else {
        // Reduce size
        let size_x = size_x / 2;
        let size_y = size_y / 2;
        WorkgroupSize {
            x: size_x,
            y: size_y,
            z: 1,
            total_invocations: size_x * size_y,
        }
    }
}

/// Calculate optimal workgroup size for 3D problem
pub fn calculate_workgroup_size_3d(
    width: u32,
    height: u32,
    depth: u32,
    vendor: GPUVendor,
    limits: DeviceLimits,
) -> WorkgroupSize {
    // Common 3D sizes: 4x4x4, 8x8x8
    let preferred_dim = match vendor {
        GPUVendor::NVIDIA => 8,
        GPUVendor::AMD => 8,
        GPUVendor::Apple => 8,
        _ => 4,
    };

    let size_x = preferred_dim.min(limits.max_compute_workgroup_size_x);
    let size_y = preferred_dim.min(limits.max_compute_workgroup_size_y);
    let size_z = preferred_dim.min(limits.max_compute_workgroup_size_z);
    let total = size_x * size_y * size_z;

    if total <= limits.max_compute_invocations_per_workgroup {
        WorkgroupSize {
            x: size_x,
            y: size_y,
            z: size_z,
            total_invocations: total,
        }
    } else {
        // Reduce size
        let size_x = size_x / 2;
        let size_y = size_y / 2;
        let size_z = size_z / 2;
        WorkgroupSize {
            x: size_x,
            y: size_y,
            z: size_z,
            total_invocations: size_x * size_y * size_z,
        }
    }
}

/// Calculate number of workgroups needed
pub fn calculate_dispatch_size(
    problem_size_x: u32,
    problem_size_y: u32,
    problem_size_z: u32,
    workgroup: WorkgroupSize,
) -> WorkgroupSize {
    let groups_x = (problem_size_x + workgroup.x - 1) / workgroup.x;
    let groups_y = (problem_size_y + workgroup.y - 1) / workgroup.y;
    let groups_z = (problem_size_z + workgroup.z - 1) / workgroup.z;

    WorkgroupSize {
        x: groups_x,
        y: groups_y,
        z: groups_z,
        total_invocations: groups_x * groups_y * groups_z,
    }
}

/// Calculate dispatch size for 1D problem
pub fn calculate_dispatch_size_1d(
    problem_size: u32,
    workgroup_size: u32,
) -> u32 {
    (problem_size + workgroup_size - 1) / workgroup_size
}

/// Calculate dispatch size for 2D problem
pub fn calculate_dispatch_size_2d(
    width: u32,
    height: u32,
    workgroup: WorkgroupSize,
) -> WorkgroupSize {
    let groups_x = (width + workgroup.x - 1) / workgroup.x;
    let groups_y = (height + workgroup.y - 1) / workgroup.y;

    WorkgroupSize {
        x: groups_x,
        y: groups_y,
        z: 1,
        total_invocations: groups_x * groups_y,
    }
}

/// Round up to nearest multiple of workgroup size
pub fn round_up_to_workgroup(size: u32, workgroup_size: u32) -> u32 {
    if workgroup_size == 0 {
        return size;
    }
    ((size + workgroup_size - 1) / workgroup_size) * workgroup_size
}
