/**
 * Typed Array Utilities
 *
 * Provides utilities for working with typed arrays in WebGPU context,
 * including conversions, validation, and interleaving.
 */

import type { GPUSize, ByteCount } from "../../../types/webgpu.ts";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Supported typed array types for GPU buffers
 */
export type TypedArray =
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array
    | BigInt64Array
    | BigUint64Array;

/**
 * Typed array constructor types
 */
export type TypedArrayConstructor =
    | Int8ArrayConstructor
    | Uint8ArrayConstructor
    | Uint8ClampedArrayConstructor
    | Int16ArrayConstructor
    | Uint16ArrayConstructor
    | Int32ArrayConstructor
    | Uint32ArrayConstructor
    | Float32ArrayConstructor
    | Float64ArrayConstructor
    | BigInt64ArrayConstructor
    | BigUint64ArrayConstructor;

/**
 * Vertex format to typed array mapping
 */
export type VertexFormat =
    | "uint8x2"
    | "uint8x4"
    | "sint8x2"
    | "sint8x4"
    | "unorm8x2"
    | "unorm8x4"
    | "snorm8x2"
    | "snorm8x4"
    | "uint16x2"
    | "uint16x4"
    | "sint16x2"
    | "sint16x4"
    | "unorm16x2"
    | "unorm16x4"
    | "snorm16x2"
    | "snorm16x4"
    | "float16x2"
    | "float16x4"
    | "float32"
    | "float32x2"
    | "float32x3"
    | "float32x4"
    | "uint32"
    | "uint32x2"
    | "uint32x3"
    | "uint32x4"
    | "sint32"
    | "sint32x2"
    | "sint32x3"
    | "sint32x4";

// ============================================================================
// Array Type Information
// ============================================================================

/**
 * Get bytes per element for typed array
 *
 * @param array - Typed array
 * @returns Bytes per element
 */
export function getBytesPerElement(array: TypedArray): number {
    return array.BYTES_PER_ELEMENT;
}

/**
 * Get total byte length of typed array
 *
 * @param array - Typed array
 * @returns Total bytes
 */
export function getByteLength(array: TypedArray): ByteCount {
    return array.byteLength as ByteCount;
}

/**
 * Get typed array constructor name
 *
 * @param array - Typed array
 * @returns Constructor name
 */
export function getArrayTypeName(array: TypedArray): string {
    return array.constructor.name;
}

/**
 * Check if value is a typed array
 *
 * @param value - Value to check
 * @returns True if value is typed array
 */
export function isTypedArray(value: unknown): value is TypedArray {
    return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

// ============================================================================
// Array Conversions
// ============================================================================

/**
 * Convert typed array to ArrayBuffer
 *
 * @param array - Typed array
 * @returns ArrayBuffer containing array data
 */
export function toArrayBuffer(array: TypedArray): ArrayBuffer {
    const sliced = array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength);
    // Convert SharedArrayBuffer to ArrayBuffer if needed
    if (sliced instanceof SharedArrayBuffer) {
        const regular = new ArrayBuffer(sliced.byteLength);
        new Uint8Array(regular).set(new Uint8Array(sliced));
        return regular;
    }
    return sliced as ArrayBuffer;
}

/**
 * Convert typed array to Uint8Array
 *
 * @param array - Typed array
 * @returns Uint8Array view of data
 */
export function toUint8Array(array: TypedArray): Uint8Array {
    return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
}

/**
 * Convert ArrayBuffer to typed array
 *
 * @param buffer - ArrayBuffer
 * @param ArrayType - Typed array constructor
 * @returns Typed array
 */
export function fromArrayBuffer<T extends TypedArray>(
    buffer: ArrayBuffer,
    ArrayType: TypedArrayConstructor,
): T {
    return new ArrayType(buffer) as T;
}

/**
 * Clone typed array
 *
 * @param array - Typed array to clone
 * @returns New typed array with copied data
 */
export function cloneArray<T extends TypedArray>(array: T): T {
    const ArrayType = array.constructor as TypedArrayConstructor;
    // Create new array from buffer copy to avoid type issues
    let buffer = array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength);
    // Convert SharedArrayBuffer to ArrayBuffer if needed
    if (buffer instanceof SharedArrayBuffer) {
        const regular = new ArrayBuffer(buffer.byteLength);
        new Uint8Array(regular).set(new Uint8Array(buffer));
        buffer = regular;
    }
    return new ArrayType(buffer as ArrayBuffer) as T;
}

/**
 * Concatenate multiple typed arrays
 *
 * @param arrays - Arrays to concatenate
 * @returns Concatenated array
 */
export function concatenateArrays<T extends TypedArray>(arrays: T[]): T {
    if (arrays.length === 0) {
        throw new Error("Cannot concatenate empty array list");
    }

    // Calculate total length
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);

    // Create result array
    const ArrayType = arrays[0].constructor as TypedArrayConstructor;
    const result = new ArrayType(totalLength) as T;

    // Copy arrays using type-safe approach
    let offset = 0;
    for (const array of arrays) {
        // Use any cast to bypass strict BigInt type checking - safe because all arrays have same constructor
        (result as any).set(array, offset);
        offset += array.length;
    }

    return result;
}

// ============================================================================
// Vertex Data Utilities
// ============================================================================

/**
 * Get byte size for vertex format
 *
 * @param format - Vertex format
 * @returns Size in bytes
 */
export function getVertexFormatSize(format: VertexFormat): number {
    const sizes: Record<VertexFormat, number> = {
        uint8x2: 2,
        uint8x4: 4,
        sint8x2: 2,
        sint8x4: 4,
        unorm8x2: 2,
        unorm8x4: 4,
        snorm8x2: 2,
        snorm8x4: 4,
        uint16x2: 4,
        uint16x4: 8,
        sint16x2: 4,
        sint16x4: 8,
        unorm16x2: 4,
        unorm16x4: 8,
        snorm16x2: 4,
        snorm16x4: 8,
        float16x2: 4,
        float16x4: 8,
        float32: 4,
        float32x2: 8,
        float32x3: 12,
        float32x4: 16,
        uint32: 4,
        uint32x2: 8,
        uint32x3: 12,
        uint32x4: 16,
        sint32: 4,
        sint32x2: 8,
        sint32x3: 12,
        sint32x4: 16,
    };

    return sizes[format];
}

/**
 * Interleave vertex attributes
 *
 * Combines separate attribute arrays into single interleaved buffer
 *
 * Example:
 * positions = [x1, y1, z1, x2, y2, z2]
 * colors = [r1, g1, b1, r2, g2, b2]
 * result = [x1, y1, z1, r1, g1, b1, x2, y2, z2, r2, g2, b2]
 *
 * @param attributes - Array of attribute data
 * @param componentsPerAttribute - Components per attribute (e.g., [3, 3] for position and color)
 * @returns Interleaved array
 */
export function interleaveAttributes(
    attributes: Float32Array[],
    componentsPerAttribute: number[],
): Float32Array {
    if (attributes.length !== componentsPerAttribute.length) {
        throw new Error("Attributes and components arrays must have same length");
    }

    if (attributes.length === 0) {
        return new Float32Array(0);
    }

    // Calculate vertex count
    const vertexCount = attributes[0].length / componentsPerAttribute[0];

    // Validate all attributes have correct length
    for (let i = 0; i < attributes.length; i++) {
        const expectedLength = vertexCount * componentsPerAttribute[i];
        if (attributes[i].length !== expectedLength) {
            throw new Error(
                `Attribute ${i} has incorrect length. Expected ${expectedLength}, got ${attributes[i].length}`,
            );
        }
    }

    // Calculate stride (total components per vertex)
    const stride = componentsPerAttribute.reduce((sum, count) => sum + count, 0);

    // Create result array
    const result = new Float32Array(vertexCount * stride);

    // Interleave data
    let resultOffset = 0;
    for (let vertex = 0; vertex < vertexCount; vertex++) {
        for (let attr = 0; attr < attributes.length; attr++) {
            const componentCount = componentsPerAttribute[attr];
            const attrOffset = vertex * componentCount;

            for (let component = 0; component < componentCount; component++) {
                result[resultOffset++] = attributes[attr][attrOffset + component];
            }
        }
    }

    return result;
}

/**
 * Deinterleave vertex attributes
 *
 * Splits interleaved buffer into separate attribute arrays
 *
 * @param interleavedData - Interleaved vertex data
 * @param componentsPerAttribute - Components per attribute
 * @returns Array of separate attribute arrays
 */
export function deinterleaveAttributes(
    interleavedData: Float32Array,
    componentsPerAttribute: number[],
): Float32Array[] {
    const stride = componentsPerAttribute.reduce((sum, count) => sum + count, 0);
    const vertexCount = interleavedData.length / stride;

    if (!Number.isInteger(vertexCount)) {
        throw new Error(
            `Interleaved data length ${interleavedData.length} is not divisible by stride ${stride}`,
        );
    }

    // Create result arrays
    const results: Float32Array[] = [];
    for (const componentCount of componentsPerAttribute) {
        results.push(new Float32Array(vertexCount * componentCount));
    }

    // Deinterleave data
    let interleavedOffset = 0;
    for (let vertex = 0; vertex < vertexCount; vertex++) {
        for (let attr = 0; attr < componentsPerAttribute.length; attr++) {
            const componentCount = componentsPerAttribute[attr];
            const attrOffset = vertex * componentCount;

            for (let component = 0; component < componentCount; component++) {
                results[attr][attrOffset + component] = interleavedData[interleavedOffset++];
            }
        }
    }

    return results;
}

// ============================================================================
// Index Buffer Utilities
// ============================================================================

/**
 * Convert 32-bit indices to 16-bit if possible
 *
 * WebGPU supports both uint16 and uint32 index formats.
 * uint16 uses less memory but limited to 65535 vertices.
 *
 * @param indices - 32-bit index array
 * @returns 16-bit index array if all indices fit, otherwise original
 */
export function optimizeIndices(indices: Uint32Array): Uint16Array | Uint32Array {
    // Check if all indices fit in uint16
    const max = Math.max(...Array.from(indices));

    if (max <= 0xFFFF) {
        // Convert to uint16
        return new Uint16Array(indices);
    }

    return indices;
}

/**
 * Generate triangle strip indices from triangle list
 *
 * Converts [0, 1, 2, 2, 1, 3, 2, 3, 4, ...] to [0, 1, 2, 3, 4, ...]
 *
 * @param triangleIndices - Triangle list indices
 * @returns Triangle strip indices
 */
export function generateTriangleStrip(triangleIndices: Uint32Array): Uint32Array {
    if (triangleIndices.length % 3 !== 0) {
        throw new Error("Triangle indices must be multiple of 3");
    }

    const triangleCount = triangleIndices.length / 3;
    const stripIndices: number[] = [];

    // Add first triangle
    stripIndices.push(
        triangleIndices[0],
        triangleIndices[1],
        triangleIndices[2],
    );

    // Add remaining triangles
    for (let i = 1; i < triangleCount; i++) {
        const baseIndex = i * 3;

        // Check if triangle shares edge with previous
        const prevTriangle = [
            triangleIndices[baseIndex - 3],
            triangleIndices[baseIndex - 2],
            triangleIndices[baseIndex - 1],
        ];

        const currTriangle = [
            triangleIndices[baseIndex],
            triangleIndices[baseIndex + 1],
            triangleIndices[baseIndex + 2],
        ];

        // Find shared edge
        const shared = prevTriangle.filter((v) => currTriangle.includes(v));

        if (shared.length === 2) {
            // Triangles share edge, add next vertex
            const newVertex = currTriangle.find((v) => !shared.includes(v))!;
            stripIndices.push(newVertex);
        } else {
            // No shared edge, use degenerate triangles
            stripIndices.push(
                stripIndices[stripIndices.length - 1],
                currTriangle[0],
                currTriangle[0],
                currTriangle[1],
                currTriangle[2],
            );
        }
    }

    return new Uint32Array(stripIndices);
}

// ============================================================================
// Data Validation
// ============================================================================

/**
 * Validate typed array size
 *
 * @param array - Typed array
 * @param expectedSize - Expected size in bytes
 * @throws {Error} If size doesn't match
 */
export function validateArraySize(array: TypedArray, expectedSize: GPUSize): void {
    if (array.byteLength !== expectedSize) {
        throw new Error(
            `Array size mismatch. Expected ${expectedSize} bytes, got ${array.byteLength} bytes`,
        );
    }
}

/**
 * Validate typed array length
 *
 * @param array - Typed array
 * @param expectedLength - Expected element count
 * @throws {Error} If length doesn't match
 */
export function validateArrayLength(array: TypedArray, expectedLength: number): void {
    if (array.length !== expectedLength) {
        throw new Error(
            `Array length mismatch. Expected ${expectedLength} elements, got ${array.length} elements`,
        );
    }
}

/**
 * Validate array is not empty
 *
 * @param array - Typed array
 * @throws {Error} If array is empty
 */
export function validateNonEmpty(array: TypedArray): void {
    if (array.length === 0) {
        throw new Error("Array cannot be empty");
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Fill typed array with value
 *
 * @param array - Typed array to fill
 * @param value - Fill value
 * @param start - Start index (optional)
 * @param end - End index (optional)
 */
export function fillArray(
    array: TypedArray,
    value: number,
    start?: number,
    end?: number,
): void {
    // Use any cast to handle both number and bigint types
    (array as any).fill(value, start, end);
}

/**
 * Copy data between typed arrays
 *
 * @param source - Source array
 * @param destination - Destination array
 * @param sourceStart - Source start index
 * @param destinationStart - Destination start index
 * @param length - Number of elements to copy
 */
export function copyArrayData(
    source: TypedArray,
    destination: TypedArray,
    sourceStart: number = 0,
    destinationStart: number = 0,
    length?: number,
): void {
    const copyLength = length ?? source.length - sourceStart;

    if (sourceStart + copyLength > source.length) {
        throw new Error("Source copy range exceeds array bounds");
    }

    if (destinationStart + copyLength > destination.length) {
        throw new Error("Destination copy range exceeds array bounds");
    }

    // Use any cast to handle both number and bigint types
    (destination as any).set(
        source.subarray(sourceStart, sourceStart + copyLength),
        destinationStart,
    );
}

/**
 * Reverse typed array in place
 *
 * @param array - Typed array to reverse
 */
export function reverseArray(array: TypedArray): void {
    array.reverse();
}

/**
 * Create typed array filled with zeros
 *
 * @param ArrayType - Typed array constructor
 * @param length - Array length
 * @returns Zero-filled array
 */
export function createZeroArray<T extends TypedArray>(
    ArrayType: TypedArrayConstructor,
    length: number,
): T {
    return new ArrayType(length) as T;
}

/**
 * Create typed array from regular array
 *
 * @param ArrayType - Typed array constructor
 * @param values - Array of values
 * @returns Typed array
 */
export function createArrayFromValues<T extends TypedArray>(
    ArrayType: TypedArrayConstructor,
    values: number[],
): T {
    // Use any cast to handle both number and bigint array types
    return new ArrayType(values as any) as T;
}
