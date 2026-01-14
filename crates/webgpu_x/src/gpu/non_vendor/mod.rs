pub mod opencl;
pub mod vulkan;

pub use opencl::{
    opencl_calculate_local_memory, opencl_optimal_workgroup_size, opencl_supports_fp64,
    opencl_supports_version, OpenCLCapabilities, OpenCLDeviceInfo, OpenCLDeviceType,
    OpenCLVersion,
};

pub use vulkan::{
    vulkan_optimal_workgroup_size, vulkan_recommended_descriptor_sets,
    vulkan_supports_raytracing, vulkan_supports_version, VulkanCapabilities, VulkanDeviceInfo,
    VulkanVersion,
};
