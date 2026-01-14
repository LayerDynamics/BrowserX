/**
 * Buffer Size Utilities
 *
 * Provides alignment calculations and buffer size computations following
 * WebGPU alignment requirements.
 */

import type { GPUSize, ByteCount } from "../../../types/webgpu.ts";

// ============================================================================
// Alignment Constants
// ============================================================================

/**
 * Uniform buffer alignment requirement (256 bytes)
 * All uniform buffers must be aligned to 256-byte boundaries
 */
export const UNIFORM_BUFFER_ALIGNMENT = 256;

/**
 * Storage buffer alignment requirement (4 bytes)
 * All storage buffers must be aligned to 4-byte boundaries
 */
export const STORAGE_BUFFER_ALIGNMENT = 4;

/**
 * Vertex buffer alignment requirement (4 bytes)
 * Vertex attributes must be aligned to 4-byte boundaries
 */
export const VERTEX_BUFFER_ALIGNMENT = 4;

/**
 * Index buffer alignment requirement (4 bytes for uint32, 2 bytes for uint16)
 */
export const INDEX_BUFFER_ALIGNMENT_U32 = 4;
export const INDEX_BUFFER_ALIGNMENT_U16 = 2;

/**
 * Copy buffer alignment requirement (4 bytes)
 * Buffer-to-buffer copies require 4-byte alignment
 */
export const COPY_BUFFER_ALIGNMENT = 4;

/**
 * Texture data alignment requirement (256 bytes per row)
 * Used for buffer-to-texture and texture-to-buffer copies
 */
export const TEXTURE_DATA_ALIGNMENT = 256;

// ============================================================================
// WGSL Type Sizes and Alignments
// ============================================================================

/**
 * WGSL scalar type sizes (bytes)
 */
export const WGSL_TYPE_SIZES = {
    i32: 4,
    u32: 4,
    f32: 4,
    f16: 2,
    bool: 4, // Stored as u32
} as const;

/**
 * WGSL vector type sizes (bytes)
 */
export const WGSL_VECTOR_SIZES = {
    vec2i: 8,
    vec2u: 8,
    vec2f: 8,
    vec2h: 4,
    vec3i: 12,
    vec3u: 12,
    vec3f: 12,
    vec3h: 6,
    vec4i: 16,
    vec4u: 16,
    vec4f: 16,
    vec4h: 8,
} as const;

/**
 * WGSL matrix type sizes (bytes)
 */
export const WGSL_MATRIX_SIZES = {
    mat2x2f: 16,
    mat2x3f: 24,
    mat2x4f: 32,
    mat3x2f: 24,
    mat3x3f: 48,
    mat3x4f: 48,
    mat4x2f: 32,
    mat4x3f: 48,
    mat4x4f: 64,
} as const;

/**
 * WGSL type alignments (bytes)
 */
export const WGSL_TYPE_ALIGNMENTS = {
    // Scalars
    i32: 4,
    u32: 4,
    f32: 4,
    f16: 2,
    bool: 4,
    // Vec2
    vec2i: 8,
    vec2u: 8,
    vec2f: 8,
    vec2h: 4,
    // Vec3
    vec3i: 16,
    vec3u: 16,
    vec3f: 16,
    vec3h: 8,
    // Vec4
    vec4i: 16,
    vec4u: 16,
    vec4f: 16,
    vec4h: 8,
    // Matrices (column-major)
    mat2x2f: 8,
    mat2x3f: 16,
    mat2x4f: 16,
    mat3x2f: 8,
    mat3x3f: 16,
    mat3x4f: 16,
    mat4x2f: 8,
    mat4x3f: 16,
    mat4x4f: 16,
} as const;

// ============================================================================
// Core Alignment Functions
// ============================================================================

/**
 * Align size to specified alignment boundary
 *
 * @param size - Size to align
 * @param alignment - Alignment requirement (must be power of 2)
 * @returns Aligned size
 */
export function alignSize(size: GPUSize, alignment: number): GPUSize {
    if (alignment === 0) {
        throw new Error("Alignment must be non-zero");
    }

    if (!isPowerOf2(alignment)) {
        throw new Error(`Alignment must be power of 2, got ${alignment}`);
    }

    const mask = alignment - 1;
    return ((size + mask) & ~mask) as GPUSize;
}

/**
 * Check if size is aligned to specified boundary
 *
 * @param size - Size to check
 * @param alignment - Alignment requirement
 * @returns True if size is aligned
 */
export function isAligned(size: GPUSize, alignment: number): boolean {
    return (size % alignment) === 0;
}

/**
 * Calculate padding needed to reach alignment
 *
 * @param size - Current size
 * @param alignment - Alignment requirement
 * @returns Padding bytes needed
 */
export function calculatePadding(size: GPUSize, alignment: number): GPUSize {
    const aligned = alignSize(size, alignment);
    return (aligned - size) as GPUSize;
}

// ============================================================================
// Buffer Type Alignment Functions
// ============================================================================

/**
 * Calculate aligned size for uniform buffer
 *
 * Uniform buffers must be aligned to 256-byte boundaries
 *
 * @param dataSize - Size of data to store
 * @returns Aligned buffer size
 */
export function calculateUniformBufferSize(dataSize: GPUSize): GPUSize {
    return alignSize(dataSize, UNIFORM_BUFFER_ALIGNMENT);
}

/**
 * Calculate aligned size for storage buffer
 *
 * Storage buffers must be aligned to 4-byte boundaries
 *
 * @param dataSize - Size of data to store
 * @returns Aligned buffer size
 */
export function calculateStorageBufferSize(dataSize: GPUSize): GPUSize {
    return alignSize(dataSize, STORAGE_BUFFER_ALIGNMENT);
}

/**
 * Calculate aligned size for vertex buffer
 *
 * Vertex buffers must be aligned to 4-byte boundaries
 *
 * @param dataSize - Size of vertex data
 * @returns Aligned buffer size
 */
export function calculateVertexBufferSize(dataSize: GPUSize): GPUSize {
    return alignSize(dataSize, VERTEX_BUFFER_ALIGNMENT);
}

/**
 * Calculate aligned size for index buffer
 *
 * @param indexCount - Number of indices
 * @param indexFormat - Index format (uint16 or uint32)
 * @returns Aligned buffer size
 */
export function calculateIndexBufferSize(
    indexCount: number,
    indexFormat: "uint16" | "uint32",
): GPUSize {
    const bytesPerIndex = indexFormat === "uint32" ? 4 : 2;
    const size = (indexCount * bytesPerIndex) as GPUSize;
    const alignment = indexFormat === "uint32"
        ? INDEX_BUFFER_ALIGNMENT_U32
        : INDEX_BUFFER_ALIGNMENT_U16;
    return alignSize(size, alignment);
}

/**
 * Calculate aligned size for staging buffer
 *
 * Staging buffers used for CPU→GPU uploads should be aligned to 4 bytes
 *
 * @param dataSize - Size of data to upload
 * @returns Aligned buffer size
 */
export function calculateStagingBufferSize(dataSize: GPUSize): GPUSize {
    return alignSize(dataSize, COPY_BUFFER_ALIGNMENT);
}

// ============================================================================
// Struct and Array Size Calculations
// ============================================================================

/**
 * Calculate size of WGSL struct with proper alignment
 *
 * @param fields - Array of field sizes
 * @param alignments - Array of field alignments
 * @returns Total struct size with padding
 */
export function calculateStructSize(
    fields: GPUSize[],
    alignments: number[],
): GPUSize {
    if (fields.length !== alignments.length) {
        throw new Error("Fields and alignments arrays must have same length");
    }

    let offset = 0 as GPUSize;
    let maxAlignment = 0;

    for (let i = 0; i < fields.length; i++) {
        const fieldSize = fields[i];
        const fieldAlignment = alignments[i];

        // Track maximum alignment for struct alignment
        maxAlignment = Math.max(maxAlignment, fieldAlignment);

        // Align field offset
        offset = alignSize(offset, fieldAlignment);

        // Add field size
        offset = (offset + fieldSize) as GPUSize;
    }

    // Final struct size must be aligned to maximum field alignment
    return alignSize(offset, maxAlignment);
}

/**
 * Calculate size of WGSL array with stride
 *
 * @param elementSize - Size of each array element
 * @param elementAlignment - Alignment of array element
 * @param elementCount - Number of elements
 * @returns Total array size
 */
export function calculateArraySize(
    elementSize: GPUSize,
    elementAlignment: number,
    elementCount: number,
): GPUSize {
    // Array stride is element size aligned to element alignment
    const stride = alignSize(elementSize, elementAlignment);
    return (stride * elementCount) as GPUSize;
}

/**
 * Calculate stride for array elements
 *
 * Array stride is the aligned size of each element
 *
 * @param elementSize - Size of array element
 * @param elementAlignment - Alignment of array element
 * @returns Array stride
 */
export function calculateArrayStride(
    elementSize: GPUSize,
    elementAlignment: number,
): GPUSize {
    return alignSize(elementSize, elementAlignment);
}

// ============================================================================
// Texture Size Calculations
// ============================================================================

/**
 * Calculate bytes per row for texture data
 *
 * Texture data must be aligned to 256-byte boundaries per row
 *
 * @param width - Texture width in pixels
 * @param bytesPerPixel - Bytes per pixel (4 for RGBA8)
 * @returns Aligned bytes per row
 */
export function calculateBytesPerRow(
    width: number,
    bytesPerPixel: number,
): number {
    const unalignedBytesPerRow = width * bytesPerPixel;
    return alignSize(unalignedBytesPerRow as GPUSize, TEXTURE_DATA_ALIGNMENT);
}

/**
 * Calculate total buffer size for texture data
 *
 * @param width - Texture width in pixels
 * @param height - Texture height in pixels
 * @param bytesPerPixel - Bytes per pixel
 * @returns Total buffer size for texture
 */
export function calculateTextureBufferSize(
    width: number,
    height: number,
    bytesPerPixel: number,
): GPUSize {
    const bytesPerRow = calculateBytesPerRow(width, bytesPerPixel);
    return (bytesPerRow * height) as GPUSize;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if number is power of 2
 *
 * @param n - Number to check
 * @returns True if power of 2
 */
export function isPowerOf2(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Calculate next power of 2 greater than or equal to n
 *
 * @param n - Input number
 * @returns Next power of 2
 */
export function nextPowerOf2(n: number): number {
    if (n <= 0) return 1;
    if (isPowerOf2(n)) return n;

    let power = 1;
    while (power < n) {
        power *= 2;
    }
    return power;
}

/**
 * Calculate buffer size for multiple instances with stride
 *
 * @param instanceSize - Size of single instance
 * @param instanceAlignment - Alignment of instance
 * @param instanceCount - Number of instances
 * @returns Total buffer size
 */
export function calculateInstanceBufferSize(
    instanceSize: GPUSize,
    instanceAlignment: number,
    instanceCount: number,
): GPUSize {
    return calculateArraySize(instanceSize, instanceAlignment, instanceCount);
}
