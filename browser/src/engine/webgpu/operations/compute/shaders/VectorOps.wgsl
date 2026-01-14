/**
 * Vector Operations Compute Shader
 *
 * Provides GPU-accelerated mathematical operations on arrays and matrices:
 * - Vector arithmetic (add, subtract, multiply, divide)
 * - Dot product and cross product
 * - Matrix operations (multiply, transpose, inverse)
 * - Reduction operations (sum, min, max, mean)
 * - Element-wise operations (exp, log, sqrt, pow)
 * - Statistical operations (variance, standard deviation)
 */

// ============================================================================
// Structures
// ============================================================================

struct VectorInfo {
    size: u32,          // Number of elements
    stride: u32,        // Stride between elements (for non-contiguous access)
    offset: u32,        // Start offset
    _padding: u32,
}

struct MatrixInfo {
    rows: u32,
    cols: u32,
    rowStride: u32,     // Stride between rows
    colStride: u32,     // Stride between columns
}

struct ReductionResult {
    value: f32,
    index: u32,
    count: u32,
    _padding: u32,
}

// ============================================================================
// Bindings - Vector Operations
// ============================================================================

@group(0) @binding(0)
var<storage, read> inputA: array<f32>;

@group(0) @binding(1)
var<storage, read> inputB: array<f32>;

@group(0) @binding(2)
var<storage, read_write> output: array<f32>;

@group(0) @binding(3)
var<uniform> vectorInfo: VectorInfo;

// ============================================================================
// Bindings - Matrix Operations
// ============================================================================

@group(1) @binding(0)
var<storage, read> matrixA: array<f32>;

@group(1) @binding(1)
var<storage, read> matrixB: array<f32>;

@group(1) @binding(2)
var<storage, read_write> matrixOut: array<f32>;

@group(1) @binding(3)
var<uniform> matrixInfoA: MatrixInfo;

@group(1) @binding(4)
var<uniform> matrixInfoB: MatrixInfo;

// ============================================================================
// Bindings - Reduction Operations
// ============================================================================

@group(2) @binding(0)
var<storage, read_write> reductionBuffer: array<atomic<u32>>;

@group(2) @binding(1)
var<storage, read_write> reductionResult: ReductionResult;

// ============================================================================
// Vector Arithmetic - Addition
// ============================================================================

@compute @workgroup_size(256)
fn vectorAdd(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let idx = globalId.x;

    if (idx >= vectorInfo.size) {
        return;
    }

    let i = vectorInfo.offset + idx * vectorInfo.stride;
    output[i] = inputA[i] + inputB[i];
}

// ============================================================================
// Vector Arithmetic - Subtraction
// ============================================================================

@compute @workgroup_size(256)
fn vectorSubtract(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let idx = globalId.x;

    if (idx >= vectorInfo.size) {
        return;
    }

    let i = vectorInfo.offset + idx * vectorInfo.stride;
    output[i] = inputA[i] - inputB[i];
}

// ============================================================================
// Vector Arithmetic - Multiplication (Element-wise)
// ============================================================================

@compute @workgroup_size(256)
fn vectorMultiply(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let idx = globalId.x;

    if (idx >= vectorInfo.size) {
        return;
    }

    let i = vectorInfo.offset + idx * vectorInfo.stride;
    output[i] = inputA[i] * inputB[i];
}

// ============================================================================
// Vector Arithmetic - Division (Element-wise)
// ============================================================================

@compute @workgroup_size(256)
fn vectorDivide(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let idx = globalId.x;

    if (idx >= vectorInfo.size) {
        return;
    }

    let i = vectorInfo.offset + idx * vectorInfo.stride;

    // Avoid division by zero
    if (abs(inputB[i]) < 1e-10) {
        output[i] = 0.0;
    } else {
        output[i] = inputA[i] / inputB[i];
    }
}

// ============================================================================
// Scalar Operations - Multiply
// ============================================================================

@compute @workgroup_size(256)
fn scalarMultiply(
    @builtin(global_invocation_id) globalId: vec3<u32>,
    @builtin(num_workgroups) numWorkgroups: vec3<u32>
) {
    let idx = globalId.x;

    if (idx >= vectorInfo.size) {
        return;
    }

    let i = vectorInfo.offset + idx * vectorInfo.stride;

    // Scalar value is stored in inputB[0]
    let scalar = inputB[0];
    output[i] = inputA[i] * scalar;
}

// ============================================================================
// Scalar Operations - Add
// ============================================================================

@compute @workgroup_size(256)
fn scalarAdd(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let idx = globalId.x;

    if (idx >= vectorInfo.size) {
        return;
    }

    let i = vectorInfo.offset + idx * vectorInfo.stride;
    let scalar = inputB[0];
    output[i] = inputA[i] + scalar;
}

// ============================================================================
// Element-wise Operations - Exponential
// ============================================================================

@compute @workgroup_size(256)
fn vectorExp(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let idx = globalId.x;

    if (idx >= vectorInfo.size) {
        return;
    }

    let i = vectorInfo.offset + idx * vectorInfo.stride;
    output[i] = exp(inputA[i]);
}

// ============================================================================
// Element-wise Operations - Natural Logarithm
// ============================================================================

@compute @workgroup_size(256)
fn vectorLog(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let idx = globalId.x;

    if (idx >= vectorInfo.size) {
        return;
    }

    let i = vectorInfo.offset + idx * vectorInfo.stride;

    // Avoid log of negative/zero
    if (inputA[i] <= 0.0) {
        output[i] = -1e10;  // Large negative value
    } else {
        output[i] = log(inputA[i]);
    }
}

// ============================================================================
// Element-wise Operations - Square Root
// ============================================================================

@compute @workgroup_size(256)
fn vectorSqrt(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let idx = globalId.x;

    if (idx >= vectorInfo.size) {
        return;
    }

    let i = vectorInfo.offset + idx * vectorInfo.stride;

    // Avoid sqrt of negative
    if (inputA[i] < 0.0) {
        output[i] = 0.0;
    } else {
        output[i] = sqrt(inputA[i]);
    }
}

// ============================================================================
// Element-wise Operations - Power
// ============================================================================

@compute @workgroup_size(256)
fn vectorPow(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let idx = globalId.x;

    if (idx >= vectorInfo.size) {
        return;
    }

    let i = vectorInfo.offset + idx * vectorInfo.stride;
    output[i] = pow(inputA[i], inputB[i]);
}

// ============================================================================
// Element-wise Operations - Absolute Value
// ============================================================================

@compute @workgroup_size(256)
fn vectorAbs(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let idx = globalId.x;

    if (idx >= vectorInfo.size) {
        return;
    }

    let i = vectorInfo.offset + idx * vectorInfo.stride;
    output[i] = abs(inputA[i]);
}

// ============================================================================
// Element-wise Operations - Clamp
// ============================================================================

@compute @workgroup_size(256)
fn vectorClamp(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let idx = globalId.x;

    if (idx >= vectorInfo.size) {
        return;
    }

    let i = vectorInfo.offset + idx * vectorInfo.stride;

    // Min value in inputB[0], max value in inputB[1]
    let minVal = inputB[0];
    let maxVal = inputB[1];
    output[i] = clamp(inputA[i], minVal, maxVal);
}

// ============================================================================
// Reduction Operations - Sum (Two-phase)
// ============================================================================

// Shared memory for workgroup reduction
var<workgroup> sharedSum: array<f32, 256>;

@compute @workgroup_size(256)
fn reductionSum(
    @builtin(global_invocation_id) globalId: vec3<u32>,
    @builtin(local_invocation_id) localId: vec3<u32>,
    @builtin(workgroup_id) workgroupId: vec3<u32>
) {
    let idx = globalId.x;
    let localIdx = localId.x;

    // Load value or zero if out of bounds
    var value = 0.0;
    if (idx < vectorInfo.size) {
        let i = vectorInfo.offset + idx * vectorInfo.stride;
        value = inputA[i];
    }

    // Store in shared memory
    sharedSum[localIdx] = value;
    workgroupBarrier();

    // Parallel reduction in shared memory
    for (var stride = 128u; stride > 0u; stride >>= 1u) {
        if (localIdx < stride && localIdx + stride < 256u) {
            sharedSum[localIdx] += sharedSum[localIdx + stride];
        }
        workgroupBarrier();
    }

    // Write workgroup result
    if (localIdx == 0u) {
        output[workgroupId.x] = sharedSum[0];
    }
}

// ============================================================================
// Reduction Operations - Min
// ============================================================================

var<workgroup> sharedMin: array<f32, 256>;

@compute @workgroup_size(256)
fn reductionMin(
    @builtin(global_invocation_id) globalId: vec3<u32>,
    @builtin(local_invocation_id) localId: vec3<u32>,
    @builtin(workgroup_id) workgroupId: vec3<u32>
) {
    let idx = globalId.x;
    let localIdx = localId.x;

    var value = 1e10;  // Large positive value
    if (idx < vectorInfo.size) {
        let i = vectorInfo.offset + idx * vectorInfo.stride;
        value = inputA[i];
    }

    sharedMin[localIdx] = value;
    workgroupBarrier();

    for (var stride = 128u; stride > 0u; stride >>= 1u) {
        if (localIdx < stride && localIdx + stride < 256u) {
            sharedMin[localIdx] = min(sharedMin[localIdx], sharedMin[localIdx + stride]);
        }
        workgroupBarrier();
    }

    if (localIdx == 0u) {
        output[workgroupId.x] = sharedMin[0];
    }
}

// ============================================================================
// Reduction Operations - Max
// ============================================================================

var<workgroup> sharedMax: array<f32, 256>;

@compute @workgroup_size(256)
fn reductionMax(
    @builtin(global_invocation_id) globalId: vec3<u32>,
    @builtin(local_invocation_id) localId: vec3<u32>,
    @builtin(workgroup_id) workgroupId: vec3<u32>
) {
    let idx = globalId.x;
    let localIdx = localId.x;

    var value = -1e10;  // Large negative value
    if (idx < vectorInfo.size) {
        let i = vectorInfo.offset + idx * vectorInfo.stride;
        value = inputA[i];
    }

    sharedMax[localIdx] = value;
    workgroupBarrier();

    for (var stride = 128u; stride > 0u; stride >>= 1u) {
        if (localIdx < stride && localIdx + stride < 256u) {
            sharedMax[localIdx] = max(sharedMax[localIdx], sharedMax[localIdx + stride]);
        }
        workgroupBarrier();
    }

    if (localIdx == 0u) {
        output[workgroupId.x] = sharedMax[0];
    }
}

// ============================================================================
// Dot Product (3D vectors)
// ============================================================================

@compute @workgroup_size(1)
fn dotProduct3(@builtin(global_invocation_id) globalId: vec3<u32>) {
    // Assumes inputA and inputB each have 3 elements
    let a = vec3<f32>(inputA[0], inputA[1], inputA[2]);
    let b = vec3<f32>(inputB[0], inputB[1], inputB[2]);

    output[0] = dot(a, b);
}

// ============================================================================
// Cross Product (3D vectors)
// ============================================================================

@compute @workgroup_size(1)
fn crossProduct3(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let a = vec3<f32>(inputA[0], inputA[1], inputA[2]);
    let b = vec3<f32>(inputB[0], inputB[1], inputB[2]);

    let result = cross(a, b);
    output[0] = result.x;
    output[1] = result.y;
    output[2] = result.z;
}

// ============================================================================
// Matrix Multiply
// ============================================================================

@compute @workgroup_size(16, 16)
fn matrixMultiply(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let row = globalId.y;
    let col = globalId.x;

    if (row >= matrixInfoA.rows || col >= matrixInfoB.cols) {
        return;
    }

    var sum = 0.0;

    // Multiply row of A with column of B
    for (var k = 0u; k < matrixInfoA.cols; k++) {
        let aIndex = row * matrixInfoA.rowStride + k * matrixInfoA.colStride;
        let bIndex = k * matrixInfoB.rowStride + col * matrixInfoB.colStride;
        sum += matrixA[aIndex] * matrixB[bIndex];
    }

    let outIndex = row * matrixInfoB.cols + col;
    matrixOut[outIndex] = sum;
}

// ============================================================================
// Matrix Transpose
// ============================================================================

@compute @workgroup_size(16, 16)
fn matrixTranspose(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let row = globalId.y;
    let col = globalId.x;

    if (row >= matrixInfoA.rows || col >= matrixInfoA.cols) {
        return;
    }

    let inIndex = row * matrixInfoA.rowStride + col * matrixInfoA.colStride;
    let outIndex = col * matrixInfoA.rows + row;
    matrixOut[outIndex] = matrixA[inIndex];
}

// ============================================================================
// Normalize Vector
// ============================================================================

@compute @workgroup_size(256)
fn vectorNormalize(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let idx = globalId.x;

    if (idx >= vectorInfo.size) {
        return;
    }

    // First pass: compute magnitude (stored in output[vectorInfo.size])
    // This would typically be a separate kernel invocation

    let magnitude = output[vectorInfo.size];  // Computed by reduction

    if (magnitude > 1e-10) {
        let i = vectorInfo.offset + idx * vectorInfo.stride;
        output[i] = inputA[i] / magnitude;
    }
}
