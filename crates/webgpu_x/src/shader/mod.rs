use deno_bindgen::deno_bindgen;
use serde::{Deserialize, Serialize};

pub mod compilation;

// Re-export public types and functions from compilation
pub use compilation::{
    shader_cache_create,
    shader_cache_load,
    shader_cache_load_from_string,
    shader_cache_has_changed,
    shader_cache_clear,
    shader_cache_stats,
    shader_cache_destroy,
    detect_shader_stage,
    ShaderSource,
    ShaderCacheStats,
};

/// WGSL shader type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ShaderStage {
    Vertex,
    Fragment,
    Compute,
}

/// WGSL data type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WGSLType {
    F32,
    I32,
    U32,
    Bool,
    Vec2f,
    Vec3f,
    Vec4f,
    Vec2i,
    Vec3i,
    Vec4i,
    Vec2u,
    Vec3u,
    Vec4u,
    Mat2x2f,
    Mat3x3f,
    Mat4x4f,
}

impl WGSLType {
    fn to_wgsl(&self) -> &str {
        match self {
            WGSLType::F32 => "f32",
            WGSLType::I32 => "i32",
            WGSLType::U32 => "u32",
            WGSLType::Bool => "bool",
            WGSLType::Vec2f => "vec2<f32>",
            WGSLType::Vec3f => "vec3<f32>",
            WGSLType::Vec4f => "vec4<f32>",
            WGSLType::Vec2i => "vec2<i32>",
            WGSLType::Vec3i => "vec3<i32>",
            WGSLType::Vec4i => "vec4<i32>",
            WGSLType::Vec2u => "vec2<u32>",
            WGSLType::Vec3u => "vec3<u32>",
            WGSLType::Vec4u => "vec4<u32>",
            WGSLType::Mat2x2f => "mat2x2<f32>",
            WGSLType::Mat3x3f => "mat3x3<f32>",
            WGSLType::Mat4x4f => "mat4x4<f32>",
        }
    }
}

/// Generate WGSL binding declaration
pub fn wgsl_binding_buffer(
    group: u32,
    binding: u32,
    var_name: String,
    access: String,
) -> String {
    format!(
        "@group({}) @binding({}) var<storage, {}> {}: array<f32>;",
        group, binding, access, var_name
    )
}

/// Generate WGSL uniform binding
pub fn wgsl_binding_uniform(
    group: u32,
    binding: u32,
    var_name: String,
    struct_name: String,
) -> String {
    format!(
        "@group({}) @binding({}) var<uniform> {}: {};",
        group, binding, var_name, struct_name
    )
}

/// Generate WGSL texture binding
pub fn wgsl_binding_texture(
    group: u32,
    binding: u32,
    var_name: String,
    texture_type: String,
) -> String {
    format!(
        "@group({}) @binding({}) var {}: {};",
        group, binding, var_name, texture_type
    )
}

/// Generate WGSL sampler binding
pub fn wgsl_binding_sampler(group: u32, binding: u32, var_name: String) -> String {
    format!("@group({}) @binding({}) var {}: sampler;", group, binding, var_name)
}

/// Generate WGSL struct definition
pub fn wgsl_struct(name: String, fields: Vec<String>) -> String {
    let mut result = format!("struct {} {{\n", name);
    for field in fields {
        result.push_str(&format!("    {},\n", field));
    }
    result.push_str("}");
    result
}

/// Generate WGSL struct field
pub fn wgsl_struct_field(name: String, type_name: String) -> String {
    format!("{}: {}", name, type_name)
}

/// Generate WGSL vertex shader entry point
pub fn wgsl_vertex_entry(
    name: String,
    inputs: Vec<String>,
    outputs: Vec<String>,
    body: String,
) -> String {
    let mut result = String::from("@vertex\n");
    result.push_str(&format!("fn {}(\n", name));

    for (i, input) in inputs.iter().enumerate() {
        result.push_str(&format!("    {}", input));
        if i < inputs.len() - 1 {
            result.push_str(",\n");
        } else {
            result.push('\n');
        }
    }

    result.push_str(") -> ");

    if outputs.len() == 1 {
        result.push_str(&outputs[0]);
    } else {
        result.push_str("struct {\n");
        for output in outputs {
            result.push_str(&format!("    {},\n", output));
        }
        result.push('}');
    }

    result.push_str(" {\n");
    result.push_str(&body);
    result.push_str("\n}");

    result
}

/// Generate WGSL fragment shader entry point
pub fn wgsl_fragment_entry(
    name: String,
    inputs: Vec<String>,
    outputs: Vec<String>,
    body: String,
) -> String {
    let mut result = String::from("@fragment\n");
    result.push_str(&format!("fn {}(\n", name));

    for (i, input) in inputs.iter().enumerate() {
        result.push_str(&format!("    {}", input));
        if i < inputs.len() - 1 {
            result.push_str(",\n");
        } else {
            result.push('\n');
        }
    }

    result.push_str(") -> ");

    if outputs.len() == 1 {
        result.push_str(&outputs[0]);
    } else {
        result.push_str("struct {\n");
        for output in outputs {
            result.push_str(&format!("    {},\n", output));
        }
        result.push('}');
    }

    result.push_str(" {\n");
    result.push_str(&body);
    result.push_str("\n}");

    result
}

/// Generate WGSL compute shader entry point
pub fn wgsl_compute_entry(
    name: String,
    workgroup_x: u32,
    workgroup_y: u32,
    workgroup_z: u32,
    inputs: Vec<String>,
    body: String,
) -> String {
    let mut result = format!(
        "@compute @workgroup_size({}, {}, {})\n",
        workgroup_x, workgroup_y, workgroup_z
    );
    result.push_str(&format!("fn {}(\n", name));

    for (i, input) in inputs.iter().enumerate() {
        result.push_str(&format!("    {}", input));
        if i < inputs.len() - 1 {
            result.push_str(",\n");
        } else {
            result.push('\n');
        }
    }

    result.push_str(") {\n");
    result.push_str(&body);
    result.push_str("\n}");

    result
}

/// Generate WGSL builtin attribute
pub fn wgsl_builtin(name: String, builtin_type: String) -> String {
    format!("@builtin({}) {}", builtin_type, name)
}

/// Generate WGSL location attribute
pub fn wgsl_location(name: String, location: u32, type_name: String) -> String {
    format!("@location({}) {}: {}", location, name, type_name)
}

/// Generate WGSL function
pub fn wgsl_function(
    name: String,
    params: Vec<String>,
    return_type: String,
    body: String,
) -> String {
    let mut result = format!("fn {}(\n", name);

    for (i, param) in params.iter().enumerate() {
        result.push_str(&format!("    {}", param));
        if i < params.len() - 1 {
            result.push_str(",\n");
        } else {
            result.push('\n');
        }
    }

    result.push_str(")");

    if !return_type.is_empty() {
        result.push_str(&format!(" -> {}", return_type));
    }

    result.push_str(" {\n");
    result.push_str(&body);
    result.push_str("\n}");

    result
}

/// Minify WGSL shader code (remove comments and excess whitespace)
pub fn wgsl_minify(shader_code: String) -> String {
    let mut result = String::new();
    let mut in_comment = false;
    let mut in_string = false;

    let chars: Vec<char> = shader_code.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];

        // Handle string literals
        if c == '"' && (i == 0 || chars[i - 1] != '\\') {
            in_string = !in_string;
            result.push(c);
            i += 1;
            continue;
        }

        if in_string {
            result.push(c);
            i += 1;
            continue;
        }

        // Handle line comments
        if !in_comment && i + 1 < chars.len() && c == '/' && chars[i + 1] == '/' {
            // Skip until end of line
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
            continue;
        }

        // Handle block comments
        if !in_comment && i + 1 < chars.len() && c == '/' && chars[i + 1] == '*' {
            in_comment = true;
            i += 2;
            continue;
        }

        if in_comment {
            if i + 1 < chars.len() && c == '*' && chars[i + 1] == '/' {
                in_comment = false;
                i += 2;
            } else {
                i += 1;
            }
            continue;
        }

        // Collapse whitespace
        if c.is_whitespace() {
            if !result.is_empty() && !result.chars().last().unwrap().is_whitespace() {
                result.push(' ');
            }
        } else {
            result.push(c);
        }

        i += 1;
    }

    result.trim().to_string()
}

/// Count lines in shader code
pub fn wgsl_line_count(shader_code: String) -> u32 {
    shader_code.lines().count() as u32
}

/// Extract function names from shader code
pub fn wgsl_extract_functions(shader_code: String) -> Vec<String> {
    let mut functions = Vec::new();
    let lines = shader_code.lines();

    for line in lines {
        let trimmed = line.trim();
        if trimmed.starts_with("fn ") {
            if let Some(name_part) = trimmed.strip_prefix("fn ") {
                if let Some(paren_pos) = name_part.find('(') {
                    let name = name_part[..paren_pos].trim();
                    functions.push(name.to_string());
                }
            }
        }
    }

    functions
}
