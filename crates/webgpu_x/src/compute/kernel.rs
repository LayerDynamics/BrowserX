use deno_bindgen::deno_bindgen;
use serde::{Deserialize, Serialize};

/// Kernel parameter type
#[derive(Serialize, Deserialize)]
pub enum KernelParamType {
    Buffer,
    Texture,
    Sampler,
    Uniform,
}

/// Kernel parameter
#[derive(Serialize, Deserialize)]
pub struct KernelParam {
    pub name: String,
    pub param_type: KernelParamType,
    pub binding: u32,
    pub group: u32,
}

/// Kernel specification
#[derive(Serialize, Deserialize)]
pub struct KernelSpec {
    pub name: String,
    pub workgroup_size_x: u32,
    pub workgroup_size_y: u32,
    pub workgroup_size_z: u32,
    pub parameters: Vec<KernelParam>,
    pub shader_code: String,
}

/// Create kernel specification
pub fn create_kernel_spec(
    name: String,
    workgroup_x: u32,
    workgroup_y: u32,
    workgroup_z: u32,
) -> KernelSpec {
    KernelSpec {
        name,
        workgroup_size_x: workgroup_x,
        workgroup_size_y: workgroup_y,
        workgroup_size_z: workgroup_z,
        parameters: Vec::new(),
        shader_code: String::new(),
    }
}

/// Add parameter to kernel
pub fn kernel_add_param(
    mut spec: KernelSpec,
    name: String,
    param_type: KernelParamType,
    binding: u32,
    group: u32,
) -> KernelSpec {
    spec.parameters.push(KernelParam {
        name,
        param_type,
        binding,
        group,
    });
    spec
}

/// Set kernel shader code
pub fn kernel_set_shader(mut spec: KernelSpec, shader_code: String) -> KernelSpec {
    spec.shader_code = shader_code;
    spec
}

/// Generate WGSL shader code from kernel spec
pub fn kernel_generate_wgsl(spec: KernelSpec) -> String {
    let mut wgsl = String::new();

    // Generate bindings
    for param in &spec.parameters {
        match param.param_type {
            KernelParamType::Buffer => {
                wgsl.push_str(&format!(
                    "@group({}) @binding({}) var<storage, read_write> {}: array<f32>;\n",
                    param.group, param.binding, param.name
                ));
            }
            KernelParamType::Uniform => {
                wgsl.push_str(&format!(
                    "@group({}) @binding({}) var<uniform> {}: vec4<f32>;\n",
                    param.group, param.binding, param.name
                ));
            }
            KernelParamType::Texture => {
                wgsl.push_str(&format!(
                    "@group({}) @binding({}) var {}: texture_2d<f32>;\n",
                    param.group, param.binding, param.name
                ));
            }
            KernelParamType::Sampler => {
                wgsl.push_str(&format!(
                    "@group({}) @binding({}) var {}: sampler;\n",
                    param.group, param.binding, param.name
                ));
            }
        }
    }

    // Generate compute shader
    wgsl.push_str(&format!(
        "\n@compute @workgroup_size({}, {}, {})\n",
        spec.workgroup_size_x, spec.workgroup_size_y, spec.workgroup_size_z
    ));
    wgsl.push_str(&format!("fn {}(", spec.name));
    wgsl.push_str("@builtin(global_invocation_id) global_id: vec3<u32>) {\n");
    wgsl.push_str(&spec.shader_code);
    wgsl.push_str("\n}\n");

    wgsl
}

/// Create simple 1D kernel
pub fn create_simple_kernel_1d(
    name: String,
    workgroup_size: u32,
    input_count: u32,
    output_count: u32,
) -> SimpleKernelBuilder {
    let mut input_buffers = Vec::new();
    let mut output_buffers = Vec::new();

    for i in 0..input_count {
        input_buffers.push(format!("input{}", i));
    }

    for i in 0..output_count {
        output_buffers.push(format!("output{}", i));
    }

    SimpleKernelBuilder {
        name,
        workgroup_size,
        input_buffers,
        output_buffers,
        uniforms: Vec::new(),
        body: String::new(),
    }
}

/// Kernel builder for simple kernels
#[derive(Serialize, Deserialize)]
pub struct SimpleKernelBuilder {
    pub name: String,
    pub workgroup_size: u32,
    pub input_buffers: Vec<String>,
    pub output_buffers: Vec<String>,
    pub uniforms: Vec<String>,
    pub body: String,
}

/// Build WGSL from simple kernel
pub fn simple_kernel_build(builder: SimpleKernelBuilder) -> String {
    let mut wgsl = String::new();
    let mut binding = 0u32;

    // Input buffers (storage, read)
    for input in &builder.input_buffers {
        wgsl.push_str(&format!(
            "@group(0) @binding({}) var<storage, read> {}: array<f32>;\n",
            binding, input
        ));
        binding += 1;
    }

    // Output buffers (storage, read_write)
    for output in &builder.output_buffers {
        wgsl.push_str(&format!(
            "@group(0) @binding({}) var<storage, read_write> {}: array<f32>;\n",
            binding, output
        ));
        binding += 1;
    }

    // Uniforms
    for uniform in &builder.uniforms {
        wgsl.push_str(&format!(
            "@group(0) @binding({}) var<uniform> {}: vec4<f32>;\n",
            binding, uniform
        ));
        binding += 1;
    }

    // Compute shader
    wgsl.push_str(&format!(
        "\n@compute @workgroup_size({}, 1, 1)\n",
        builder.workgroup_size
    ));
    wgsl.push_str(&format!("fn {}(", builder.name));
    wgsl.push_str("@builtin(global_invocation_id) global_id: vec3<u32>) {\n");
    wgsl.push_str("    let i = global_id.x;\n");
    wgsl.push_str(&builder.body);
    wgsl.push_str("\n}\n");

    wgsl
}

// ============================================================================
// DENO FFI BINDINGS
// ============================================================================

/// Create a kernel specification
/// Returns JSON-serialized KernelSpec
#[deno_bindgen]
pub fn kernel_create_spec(
    name: &str,
    workgroup_x: u32,
    workgroup_y: u32,
    workgroup_z: u32,
) -> String {
    let spec = create_kernel_spec(name.to_string(), workgroup_x, workgroup_y, workgroup_z);
    serde_json::to_string(&spec).unwrap_or_default()
}

/// Add a parameter to a kernel specification
/// spec_json: JSON-serialized KernelSpec
/// param_type: 0=Buffer, 1=Texture, 2=Sampler, 3=Uniform
/// Returns updated JSON-serialized KernelSpec
#[deno_bindgen]
pub fn kernel_spec_add_param(
    spec_json: &str,
    name: &str,
    param_type: u32,
    binding: u32,
    group: u32,
) -> String {
    let spec: KernelSpec = match serde_json::from_str(spec_json) {
        Ok(s) => s,
        Err(_) => return String::new(),
    };

    let ptype = match param_type {
        0 => KernelParamType::Buffer,
        1 => KernelParamType::Texture,
        2 => KernelParamType::Sampler,
        3 => KernelParamType::Uniform,
        _ => return String::new(),
    };

    let updated = kernel_add_param(spec, name.to_string(), ptype, binding, group);
    serde_json::to_string(&updated).unwrap_or_default()
}

/// Set shader code on a kernel specification
/// spec_json: JSON-serialized KernelSpec
/// Returns updated JSON-serialized KernelSpec
#[deno_bindgen]
pub fn kernel_spec_set_shader(spec_json: &str, shader_code: &str) -> String {
    let spec: KernelSpec = match serde_json::from_str(spec_json) {
        Ok(s) => s,
        Err(_) => return String::new(),
    };

    let updated = kernel_set_shader(spec, shader_code.to_string());
    serde_json::to_string(&updated).unwrap_or_default()
}

/// Generate WGSL shader code from a kernel specification
/// spec_json: JSON-serialized KernelSpec
/// Returns generated WGSL source code
#[deno_bindgen]
pub fn kernel_spec_generate_wgsl(spec_json: &str) -> String {
    let spec: KernelSpec = match serde_json::from_str(spec_json) {
        Ok(s) => s,
        Err(_) => return String::new(),
    };

    kernel_generate_wgsl(spec)
}

/// Create a simple 1D compute kernel builder
/// Returns JSON-serialized SimpleKernelBuilder
#[deno_bindgen]
pub fn kernel_create_simple_1d(
    name: &str,
    workgroup_size: u32,
    input_count: u32,
    output_count: u32,
) -> String {
    let builder = create_simple_kernel_1d(
        name.to_string(),
        workgroup_size,
        input_count,
        output_count,
    );
    serde_json::to_string(&builder).unwrap_or_default()
}

/// Set the body of a simple kernel builder
/// builder_json: JSON-serialized SimpleKernelBuilder
/// Returns updated JSON-serialized SimpleKernelBuilder
#[deno_bindgen]
pub fn kernel_simple_set_body(builder_json: &str, body: &str) -> String {
    let mut builder: SimpleKernelBuilder = match serde_json::from_str(builder_json) {
        Ok(b) => b,
        Err(_) => return String::new(),
    };

    builder.body = body.to_string();
    serde_json::to_string(&builder).unwrap_or_default()
}

/// Add a uniform to a simple kernel builder
/// builder_json: JSON-serialized SimpleKernelBuilder
/// Returns updated JSON-serialized SimpleKernelBuilder
#[deno_bindgen]
pub fn kernel_simple_add_uniform(builder_json: &str, uniform_name: &str) -> String {
    let mut builder: SimpleKernelBuilder = match serde_json::from_str(builder_json) {
        Ok(b) => b,
        Err(_) => return String::new(),
    };

    builder.uniforms.push(uniform_name.to_string());
    serde_json::to_string(&builder).unwrap_or_default()
}

/// Build WGSL from a simple kernel builder
/// builder_json: JSON-serialized SimpleKernelBuilder
/// Returns generated WGSL source code
#[deno_bindgen]
pub fn kernel_simple_build(builder_json: &str) -> String {
    let builder: SimpleKernelBuilder = match serde_json::from_str(builder_json) {
        Ok(b) => b,
        Err(_) => return String::new(),
    };

    simple_kernel_build(builder)
}
