/// Compute Kernel Templates
///
/// Provides pre-built WGSL kernel templates for common GPU operations.
/// Based on patterns from webgpu-torch, web-rwkv, and other WebGPU ML frameworks.

use serde::{Deserialize, Serialize};

/// Kernel operation type for template generation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum KernelOperation {
    /// Element-wise addition: C = A + B
    Add,
    /// Element-wise subtraction: C = A - B
    Subtract,
    /// Element-wise multiplication: C = A * B
    Multiply,
    /// Element-wise division: C = A / B
    Divide,
    /// Matrix multiplication: C = A * B
    MatrixMultiply,
    /// 1D Convolution
    Conv1D,
    /// 2D Convolution
    Conv2D,
    /// ReLU activation: max(0, x)
    Relu,
    /// Sigmoid activation: 1 / (1 + exp(-x))
    Sigmoid,
    /// Tanh activation
    Tanh,
    /// Softmax activation
    Softmax,
    /// Layer normalization
    LayerNorm,
    /// Batch normalization
    BatchNorm,
    /// Max pooling 2D
    MaxPool2D,
    /// Average pooling 2D
    AvgPool2D,
    /// Transpose matrix
    Transpose,
    /// Reduce sum along axis
    ReduceSum,
    /// Reduce max along axis
    ReduceMax,
    /// Reduce mean along axis
    ReduceMean,
}

/// Generate kernel code from operation template
pub fn generate_kernel(
    operation: KernelOperation,
    workgroup_size: (u32, u32, u32),
) -> String {
    match operation {
        KernelOperation::Add => generate_add_kernel(workgroup_size),
        KernelOperation::Subtract => generate_subtract_kernel(workgroup_size),
        KernelOperation::Multiply => generate_multiply_kernel(workgroup_size),
        KernelOperation::Divide => generate_divide_kernel(workgroup_size),
        KernelOperation::MatrixMultiply => generate_matmul_kernel(workgroup_size),
        KernelOperation::Conv1D => generate_conv1d_kernel(workgroup_size),
        KernelOperation::Conv2D => generate_conv2d_kernel(workgroup_size),
        KernelOperation::Relu => generate_relu_kernel(workgroup_size),
        KernelOperation::Sigmoid => generate_sigmoid_kernel(workgroup_size),
        KernelOperation::Tanh => generate_tanh_kernel(workgroup_size),
        KernelOperation::Softmax => generate_softmax_kernel(workgroup_size),
        KernelOperation::LayerNorm => generate_layernorm_kernel(workgroup_size),
        KernelOperation::BatchNorm => generate_batchnorm_kernel(workgroup_size),
        KernelOperation::MaxPool2D => generate_maxpool2d_kernel(workgroup_size),
        KernelOperation::AvgPool2D => generate_avgpool2d_kernel(workgroup_size),
        KernelOperation::Transpose => generate_transpose_kernel(workgroup_size),
        KernelOperation::ReduceSum => generate_reduce_sum_kernel(workgroup_size),
        KernelOperation::ReduceMax => generate_reduce_max_kernel(workgroup_size),
        KernelOperation::ReduceMean => generate_reduce_mean_kernel(workgroup_size),
    }
}

// ============================================================================
// Element-wise Operations
// ============================================================================

fn generate_add_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input_a: array<f32>;
@group(0) @binding(1) var<storage, read> input_b: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;

@compute @workgroup_size({}, {}, {})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {{
    let index = global_id.x;
    if (index >= arrayLength(&input_a)) {{
        return;
    }}
    output[index] = input_a[index] + input_b[index];
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

fn generate_subtract_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input_a: array<f32>;
@group(0) @binding(1) var<storage, read> input_b: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;

@compute @workgroup_size({}, {}, {})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {{
    let index = global_id.x;
    if (index >= arrayLength(&input_a)) {{
        return;
    }}
    output[index] = input_a[index] - input_b[index];
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

fn generate_multiply_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input_a: array<f32>;
@group(0) @binding(1) var<storage, read> input_b: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;

@compute @workgroup_size({}, {}, {})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {{
    let index = global_id.x;
    if (index >= arrayLength(&input_a)) {{
        return;
    }}
    output[index] = input_a[index] * input_b[index];
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

fn generate_divide_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input_a: array<f32>;
@group(0) @binding(1) var<storage, read> input_b: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;

@compute @workgroup_size({}, {}, {})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {{
    let index = global_id.x;
    if (index >= arrayLength(&input_a)) {{
        return;
    }}
    output[index] = input_a[index] / input_b[index];
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

// ============================================================================
// Matrix Operations
// ============================================================================

fn generate_matmul_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> matrix_a: array<f32>;
@group(0) @binding(1) var<storage, read> matrix_b: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
@group(0) @binding(3) var<uniform> dims: vec4<u32>;  // M, K, N, _

@compute @workgroup_size({}, {}, {})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {{
    let row = global_id.y;
    let col = global_id.x;
    let M = dims.x;
    let K = dims.y;
    let N = dims.z;

    if (row >= M || col >= N) {{
        return;
    }}

    var sum = 0.0;
    for (var k = 0u; k < K; k = k + 1u) {{
        sum = sum + matrix_a[row * K + k] * matrix_b[k * N + col];
    }}
    output[row * N + col] = sum;
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

fn generate_transpose_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> dims: vec2<u32>;  // rows, cols

@compute @workgroup_size({}, {}, {})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {{
    let row = global_id.y;
    let col = global_id.x;
    let rows = dims.x;
    let cols = dims.y;

    if (row >= rows || col >= cols) {{
        return;
    }}

    // Transpose: output[col, row] = input[row, col]
    output[col * rows + row] = input[row * cols + col];
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

// ============================================================================
// Convolution Operations
// ============================================================================

fn generate_conv1d_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read> kernel: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
@group(0) @binding(3) var<uniform> params: vec4<u32>;  // input_size, kernel_size, stride, padding

@compute @workgroup_size({}, {}, {})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {{
    let output_idx = global_id.x;
    let input_size = params.x;
    let kernel_size = params.y;
    let stride = params.z;
    let padding = params.w;

    let output_size = (input_size + 2u * padding - kernel_size) / stride + 1u;
    if (output_idx >= output_size) {{
        return;
    }}

    var sum = 0.0;
    let input_start = output_idx * stride;

    for (var k = 0u; k < kernel_size; k = k + 1u) {{
        let input_idx = input_start + k;
        if (input_idx >= padding && input_idx < input_size + padding) {{
            let actual_idx = input_idx - padding;
            sum = sum + input[actual_idx] * kernel[k];
        }}
    }}

    output[output_idx] = sum;
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

fn generate_conv2d_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read> kernel: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
@group(0) @binding(3) var<uniform> params: vec4<u32>;  // in_h, in_w, kernel_size, stride

@compute @workgroup_size({}, {}, {})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {{
    let out_y = global_id.y;
    let out_x = global_id.x;
    let in_h = params.x;
    let in_w = params.y;
    let kernel_size = params.z;
    let stride = params.w;

    let out_h = (in_h - kernel_size) / stride + 1u;
    let out_w = (in_w - kernel_size) / stride + 1u;

    if (out_y >= out_h || out_x >= out_w) {{
        return;
    }}

    var sum = 0.0;
    let in_y_start = out_y * stride;
    let in_x_start = out_x * stride;

    for (var ky = 0u; ky < kernel_size; ky = ky + 1u) {{
        for (var kx = 0u; kx < kernel_size; kx = kx + 1u) {{
            let in_y = in_y_start + ky;
            let in_x = in_x_start + kx;
            let in_idx = in_y * in_w + in_x;
            let k_idx = ky * kernel_size + kx;
            sum = sum + input[in_idx] * kernel[k_idx];
        }}
    }}

    output[out_y * out_w + out_x] = sum;
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

// ============================================================================
// Activation Functions
// ============================================================================

fn generate_relu_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size({}, {}, {})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {{
    let index = global_id.x;
    if (index >= arrayLength(&input)) {{
        return;
    }}
    output[index] = max(0.0, input[index]);
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

fn generate_sigmoid_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size({}, {}, {})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {{
    let index = global_id.x;
    if (index >= arrayLength(&input)) {{
        return;
    }}
    output[index] = 1.0 / (1.0 + exp(-input[index]));
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

fn generate_tanh_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size({}, {}, {})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {{
    let index = global_id.x;
    if (index >= arrayLength(&input)) {{
        return;
    }}
    output[index] = tanh(input[index]);
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

fn generate_softmax_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> size: u32;

var<workgroup> shared_max: f32;
var<workgroup> shared_sum: f32;

@compute @workgroup_size({}, {}, {})
fn main(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>
) {{
    let tid = local_id.x;

    // Find max value (for numerical stability)
    if (tid == 0u) {{
        var max_val = input[0];
        for (var i = 1u; i < size; i = i + 1u) {{
            max_val = max(max_val, input[i]);
        }}
        shared_max = max_val;
    }}
    workgroupBarrier();

    // Compute exp(x - max) and sum
    if (tid == 0u) {{
        var sum = 0.0;
        for (var i = 0u; i < size; i = i + 1u) {{
            sum = sum + exp(input[i] - shared_max);
        }}
        shared_sum = sum;
    }}
    workgroupBarrier();

    // Normalize
    let index = global_id.x;
    if (index < size) {{
        output[index] = exp(input[index] - shared_max) / shared_sum;
    }}
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

// ============================================================================
// Normalization Operations
// ============================================================================

fn generate_layernorm_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> size: u32;

var<workgroup> shared_mean: f32;
var<workgroup> shared_var: f32;

@compute @workgroup_size({}, {}, {})
fn main(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>
) {{
    let tid = local_id.x;
    let eps = 1e-5;

    // Compute mean
    if (tid == 0u) {{
        var sum = 0.0;
        for (var i = 0u; i < size; i = i + 1u) {{
            sum = sum + input[i];
        }}
        shared_mean = sum / f32(size);
    }}
    workgroupBarrier();

    // Compute variance
    if (tid == 0u) {{
        var sum_sq = 0.0;
        for (var i = 0u; i < size; i = i + 1u) {{
            let diff = input[i] - shared_mean;
            sum_sq = sum_sq + diff * diff;
        }}
        shared_var = sum_sq / f32(size);
    }}
    workgroupBarrier();

    // Normalize
    let index = global_id.x;
    if (index < size) {{
        output[index] = (input[index] - shared_mean) / sqrt(shared_var + eps);
    }}
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

fn generate_batchnorm_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read> gamma: array<f32>;
@group(0) @binding(2) var<storage, read> beta: array<f32>;
@group(0) @binding(3) var<storage, read_write> output: array<f32>;
@group(0) @binding(4) var<uniform> params: vec4<f32>;  // mean, variance, epsilon, _

@compute @workgroup_size({}, {}, {})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {{
    let index = global_id.x;
    if (index >= arrayLength(&input)) {{
        return;
    }}

    let mean = params.x;
    let variance = params.y;
    let epsilon = params.z;

    let normalized = (input[index] - mean) / sqrt(variance + epsilon);
    output[index] = gamma[index] * normalized + beta[index];
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

// ============================================================================
// Pooling Operations
// ============================================================================

fn generate_maxpool2d_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> params: vec4<u32>;  // in_h, in_w, pool_size, stride

@compute @workgroup_size({}, {}, {})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {{
    let out_y = global_id.y;
    let out_x = global_id.x;
    let in_h = params.x;
    let in_w = params.y;
    let pool_size = params.z;
    let stride = params.w;

    let out_h = (in_h - pool_size) / stride + 1u;
    let out_w = (in_w - pool_size) / stride + 1u;

    if (out_y >= out_h || out_x >= out_w) {{
        return;
    }}

    var max_val = -3.402823466e+38;  // -FLT_MAX
    let in_y_start = out_y * stride;
    let in_x_start = out_x * stride;

    for (var py = 0u; py < pool_size; py = py + 1u) {{
        for (var px = 0u; px < pool_size; px = px + 1u) {{
            let in_y = in_y_start + py;
            let in_x = in_x_start + px;
            let in_idx = in_y * in_w + in_x;
            max_val = max(max_val, input[in_idx]);
        }}
    }}

    output[out_y * out_w + out_x] = max_val;
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

fn generate_avgpool2d_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> params: vec4<u32>;  // in_h, in_w, pool_size, stride

@compute @workgroup_size({}, {}, {})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {{
    let out_y = global_id.y;
    let out_x = global_id.x;
    let in_h = params.x;
    let in_w = params.y;
    let pool_size = params.z;
    let stride = params.w;

    let out_h = (in_h - pool_size) / stride + 1u;
    let out_w = (in_w - pool_size) / stride + 1u;

    if (out_y >= out_h || out_x >= out_w) {{
        return;
    }}

    var sum = 0.0;
    let in_y_start = out_y * stride;
    let in_x_start = out_x * stride;

    for (var py = 0u; py < pool_size; py = py + 1u) {{
        for (var px = 0u; px < pool_size; px = px + 1u) {{
            let in_y = in_y_start + py;
            let in_x = in_x_start + px;
            let in_idx = in_y * in_w + in_x;
            sum = sum + input[in_idx];
        }}
    }}

    output[out_y * out_w + out_x] = sum / f32(pool_size * pool_size);
}}
"#, workgroup_size.0, workgroup_size.1, workgroup_size.2)
}

// ============================================================================
// Reduction Operations
// ============================================================================

fn generate_reduce_sum_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> size: u32;

var<workgroup> shared: array<f32, {}>;

@compute @workgroup_size({}, {}, {})
fn main(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>
) {{
    let tid = local_id.x;
    let gid = global_id.x;

    // Load data into shared memory
    if (gid < size) {{
        shared[tid] = input[gid];
    }} else {{
        shared[tid] = 0.0;
    }}
    workgroupBarrier();

    // Parallel reduction
    for (var stride = {}u / 2u; stride > 0u; stride = stride / 2u) {{
        if (tid < stride) {{
            shared[tid] = shared[tid] + shared[tid + stride];
        }}
        workgroupBarrier();
    }}

    // Write result
    if (tid == 0u) {{
        output[0] = shared[0];
    }}
}}
"#, workgroup_size.0, workgroup_size.0, workgroup_size.1, workgroup_size.2, workgroup_size.0)
}

fn generate_reduce_max_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> size: u32;

var<workgroup> shared: array<f32, {}>;

@compute @workgroup_size({}, {}, {})
fn main(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>
) {{
    let tid = local_id.x;
    let gid = global_id.x;

    // Load data into shared memory
    if (gid < size) {{
        shared[tid] = input[gid];
    }} else {{
        shared[tid] = -3.402823466e+38;  // -FLT_MAX
    }}
    workgroupBarrier();

    // Parallel reduction
    for (var stride = {}u / 2u; stride > 0u; stride = stride / 2u) {{
        if (tid < stride) {{
            shared[tid] = max(shared[tid], shared[tid + stride]);
        }}
        workgroupBarrier();
    }}

    // Write result
    if (tid == 0u) {{
        output[0] = shared[0];
    }}
}}
"#, workgroup_size.0, workgroup_size.0, workgroup_size.1, workgroup_size.2, workgroup_size.0)
}

fn generate_reduce_mean_kernel(workgroup_size: (u32, u32, u32)) -> String {
    format!(r#"
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> size: u32;

var<workgroup> shared: array<f32, {}>;

@compute @workgroup_size({}, {}, {})
fn main(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>
) {{
    let tid = local_id.x;
    let gid = global_id.x;

    // Load data into shared memory
    if (gid < size) {{
        shared[tid] = input[gid];
    }} else {{
        shared[tid] = 0.0;
    }}
    workgroupBarrier();

    // Parallel reduction (sum)
    for (var stride = {}u / 2u; stride > 0u; stride = stride / 2u) {{
        if (tid < stride) {{
            shared[tid] = shared[tid] + shared[tid + stride];
        }}
        workgroupBarrier();
    }}

    // Write mean result
    if (tid == 0u) {{
        output[0] = shared[0] / f32(size);
    }}
}}
"#, workgroup_size.0, workgroup_size.0, workgroup_size.1, workgroup_size.2, workgroup_size.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_add_kernel() {
        let kernel = generate_kernel(KernelOperation::Add, (64, 1, 1));
        assert!(kernel.contains("input_a[index] + input_b[index]"));
        assert!(kernel.contains("@workgroup_size(64, 1, 1)"));
    }

    #[test]
    fn test_generate_matmul_kernel() {
        let kernel = generate_kernel(KernelOperation::MatrixMultiply, (16, 16, 1));
        assert!(kernel.contains("matrix_a"));
        assert!(kernel.contains("matrix_b"));
        assert!(kernel.contains("@workgroup_size(16, 16, 1)"));
    }

    #[test]
    fn test_generate_relu_kernel() {
        let kernel = generate_kernel(KernelOperation::Relu, (256, 1, 1));
        assert!(kernel.contains("max(0.0, input[index])"));
    }
}
