use deno_bindgen::deno_bindgen;

/// Kernel parameter type
pub enum KernelParamType {
    Buffer,
    Texture,
    Sampler,
    Uniform,
}

/// Kernel parameter
pub struct KernelParam {
    pub name: String,
    pub param_type: KernelParamType,
    pub binding: u32,
    pub group: u32,
}

/// Kernel specification
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

/// Kernel builder for simple kernels
pub struct SimpleKernelBuilder {
    pub name: String,
    pub workgroup_size: u32,
    pub input_buffers: Vec<String>,
    pub output_buffers: Vec<String>,
    pub uniforms: Vec<String>,
    pub body: String,
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
