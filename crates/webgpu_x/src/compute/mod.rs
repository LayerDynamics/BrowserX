pub mod workgroup;
pub mod kernel;
pub mod templates;

pub use workgroup::{
    calculate_dispatch_size, calculate_dispatch_size_1d, calculate_dispatch_size_2d,
    calculate_workgroup_size_1d, calculate_workgroup_size_2d, calculate_workgroup_size_3d,
    round_up_to_workgroup, WorkgroupSize,
};
pub use kernel::{
    create_kernel_spec, create_simple_kernel_1d, kernel_add_param, kernel_generate_wgsl,
    kernel_set_shader, simple_kernel_build, KernelParam, KernelParamType, KernelSpec,
    SimpleKernelBuilder,
};
pub use templates::{generate_kernel, KernelOperation};
