pub mod detect;
pub mod find;
pub mod serialize;

pub use detect::{
    detect_architecture, detect_cpu_thread_count, detect_endianness, detect_os,
    detect_pointer_size, detect_preferred_backend, detect_simd_support,
    detect_vector_instructions, is_desktop_platform, is_mobile_platform, DetectedBackend,
    SystemGPUDetection,
};

pub use find::{
    clear_gpu_registry, find_compute_capable_gpus, find_discrete_gpus, find_gpu_with_min_memory,
    find_gpus_by_backend, find_gpus_by_vendor, find_highest_compute_gpu,
    find_highest_graphics_gpu, find_highest_memory_gpu, find_highest_performance_gpu,
    find_integrated_gpus, find_lowest_power_gpu, find_ml_optimized_gpu,
    find_optimal_gpu_for_workload, find_primary_display_gpu, get_gpu_count, get_gpu_info,
    gpu_exists, register_gpu_device, FoundGPUDevice,
};

pub use serialize::{
    deserialize_buffer_descriptor, json_get_field, json_merge, json_minify, json_pretty_print,
    json_validate, serialize_bind_group_layout_entry, serialize_blend_state,
    serialize_buffer_descriptor, serialize_color_target_state,
    serialize_compute_pipeline_descriptor, serialize_pipeline_layout_descriptor,
    serialize_render_pipeline_descriptor, serialize_sampler_descriptor,
    serialize_shader_module_descriptor, serialize_texture_descriptor, serialize_vertex_attribute,
    serialize_vertex_buffer_layout,
};
