use deno_bindgen::deno_bindgen;

/// Complete device limits (including missing ones in Deno)
#[derive(Debug, Clone)]
pub struct DeviceLimits {
    // Standard limits
    pub max_texture_dimension_1d: u32,
    pub max_texture_dimension_2d: u32,
    pub max_texture_dimension_3d: u32,
    pub max_texture_array_layers: u32,
    pub max_bind_groups: u32,
    pub max_dynamic_uniform_buffers_per_pipeline_layout: u32,
    pub max_dynamic_storage_buffers_per_pipeline_layout: u32,
    pub max_sampled_textures_per_shader_stage: u32,
    pub max_samplers_per_shader_stage: u32,
    pub max_storage_buffers_per_shader_stage: u32,
    pub max_storage_textures_per_shader_stage: u32,
    pub max_uniform_buffers_per_shader_stage: u32,
    pub max_uniform_buffer_binding_size: u64,
    pub max_storage_buffer_binding_size: u64,
    pub min_uniform_buffer_offset_alignment: u32,
    pub min_storage_buffer_offset_alignment: u32,
    pub max_vertex_buffers: u32,
    pub max_vertex_attributes: u32,
    pub max_vertex_buffer_array_stride: u32,
    pub max_inter_stage_shader_components: u32,

    // MISSING in Deno (added here)
    pub max_bind_groups_plus_vertex_buffers: u32,
    pub max_inter_stage_shader_variables: u32,

    // Compute limits
    pub max_compute_workgroup_storage_size: u32,
    pub max_compute_invocations_per_workgroup: u32,
    pub max_compute_workgroup_size_x: u32,
    pub max_compute_workgroup_size_y: u32,
    pub max_compute_workgroup_size_z: u32,
    pub max_compute_workgroups_per_dimension: u32,
}

/// Validation result
#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub valid: u8,
    pub error_message: String,
}

impl ValidationResult {
    fn ok() -> Self {
        Self {
            valid: 1,
            error_message: String::new(),
        }
    }

    fn err(message: String) -> Self {
        Self {
            valid: 0,
            error_message: message,
        }
    }
}

/// Validate bind group count against limits
pub fn validate_bind_group_count(
    bind_groups: u32,
    vertex_buffers: u32,
    limits: DeviceLimits,
) -> ValidationResult {
    // Check missing limit: maxBindGroupsPlusVertexBuffers
    let total = bind_groups + vertex_buffers;
    if total > limits.max_bind_groups_plus_vertex_buffers {
        return ValidationResult::err(format!(
            "Total bind groups ({}) + vertex buffers ({}) = {} exceeds limit {}",
            bind_groups, vertex_buffers, total, limits.max_bind_groups_plus_vertex_buffers
        ));
    }

    // Check individual limits
    if bind_groups > limits.max_bind_groups {
        return ValidationResult::err(format!(
            "Bind group count {} exceeds limit {}",
            bind_groups, limits.max_bind_groups
        ));
    }

    if vertex_buffers > limits.max_vertex_buffers {
        return ValidationResult::err(format!(
            "Vertex buffer count {} exceeds limit {}",
            vertex_buffers, limits.max_vertex_buffers
        ));
    }

    ValidationResult::ok()
}

/// Validate inter-stage shader variables
pub fn validate_inter_stage_variables(
    variable_count: u32,
    limits: DeviceLimits,
) -> ValidationResult {
    // Check missing limit: maxInterStageShaderVariables
    if variable_count > limits.max_inter_stage_shader_variables {
        return ValidationResult::err(format!(
            "Inter-stage shader variable count {} exceeds limit {}",
            variable_count, limits.max_inter_stage_shader_variables
        ));
    }

    ValidationResult::ok()
}

/// Validate compute workgroup size
pub fn validate_workgroup_size(
    size_x: u32,
    size_y: u32,
    size_z: u32,
    limits: DeviceLimits,
) -> ValidationResult {
    if size_x > limits.max_compute_workgroup_size_x {
        return ValidationResult::err(format!(
            "Workgroup size X {} exceeds limit {}",
            size_x, limits.max_compute_workgroup_size_x
        ));
    }

    if size_y > limits.max_compute_workgroup_size_y {
        return ValidationResult::err(format!(
            "Workgroup size Y {} exceeds limit {}",
            size_y, limits.max_compute_workgroup_size_y
        ));
    }

    if size_z > limits.max_compute_workgroup_size_z {
        return ValidationResult::err(format!(
            "Workgroup size Z {} exceeds limit {}",
            size_z, limits.max_compute_workgroup_size_z
        ));
    }

    let total = size_x * size_y * size_z;
    if total > limits.max_compute_invocations_per_workgroup {
        return ValidationResult::err(format!(
            "Total workgroup invocations {} exceeds limit {}",
            total, limits.max_compute_invocations_per_workgroup
        ));
    }

    ValidationResult::ok()
}

/// Validate buffer size
pub fn validate_buffer_size(
    size: u64,
    is_uniform: u8,
    limits: DeviceLimits,
) -> ValidationResult {
    let max_size = if is_uniform != 0 {
        limits.max_uniform_buffer_binding_size
    } else {
        limits.max_storage_buffer_binding_size
    };

    if size > max_size {
        return ValidationResult::err(format!(
            "{} buffer size {} exceeds limit {}",
            if is_uniform != 0 { "Uniform" } else { "Storage" },
            size,
            max_size
        ));
    }

    ValidationResult::ok()
}

/// Validate texture dimensions
pub fn validate_texture_dimensions(
    dimension: String,
    width: u32,
    height: u32,
    depth: u32,
    limits: DeviceLimits,
) -> ValidationResult {
    match dimension.as_str() {
        "1d" => {
            if width > limits.max_texture_dimension_1d {
                return ValidationResult::err(format!(
                    "1D texture width {} exceeds limit {}",
                    width, limits.max_texture_dimension_1d
                ));
            }
        }
        "2d" => {
            if width > limits.max_texture_dimension_2d {
                return ValidationResult::err(format!(
                    "2D texture width {} exceeds limit {}",
                    width, limits.max_texture_dimension_2d
                ));
            }
            if height > limits.max_texture_dimension_2d {
                return ValidationResult::err(format!(
                    "2D texture height {} exceeds limit {}",
                    height, limits.max_texture_dimension_2d
                ));
            }
        }
        "3d" => {
            if width > limits.max_texture_dimension_3d {
                return ValidationResult::err(format!(
                    "3D texture width {} exceeds limit {}",
                    width, limits.max_texture_dimension_3d
                ));
            }
            if height > limits.max_texture_dimension_3d {
                return ValidationResult::err(format!(
                    "3D texture height {} exceeds limit {}",
                    height, limits.max_texture_dimension_3d
                ));
            }
            if depth > limits.max_texture_dimension_3d {
                return ValidationResult::err(format!(
                    "3D texture depth {} exceeds limit {}",
                    depth, limits.max_texture_dimension_3d
                ));
            }
        }
        _ => {
            return ValidationResult::err(format!("Invalid texture dimension: {}", dimension));
        }
    }

    ValidationResult::ok()
}
