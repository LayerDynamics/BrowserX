/**
 * Tests for Typed Array Utilities
 */

import { assertEquals, assertThrows } from "@std/assert";
import {
    getBytesPerElement,
    getByteLength,
    getArrayTypeName,
    isTypedArray,
    toArrayBuffer,
    toUint8Array,
    fromArrayBuffer,
    cloneArray,
    concatenateArrays,
    getVertexFormatSize,
    interleaveAttributes,
    deinterleaveAttributes,
    optimizeIndices,
    validateArraySize,
    validateArrayLength,
    validateNonEmpty,
    fillArray,
    copyArrayData,
    reverseArray,
    createZeroArray,
    createArrayFromValues,
} from "../../../../src/engine/webgpu/buffer/Array.ts";
import type { GPUSize } from "../../../../src/types/webgpu.ts";

// Helper function for floating point comparison with tolerance
function assertFloatEquals(actual: number, expected: number, tolerance = 0.0001) {
    const diff = Math.abs(actual - expected);
    if (diff > tolerance) {
        throw new Error(
            `Float values not equal within tolerance ${tolerance}. Expected: ${expected}, Actual: ${actual}, Diff: ${diff}`
        );
    }
}

Deno.test("Array - getBytesPerElement returns correct size", () => {
    assertEquals(getBytesPerElement(new Uint8Array(10)), 1);
    assertEquals(getBytesPerElement(new Uint16Array(10)), 2);
    assertEquals(getBytesPerElement(new Uint32Array(10)), 4);
    assertEquals(getBytesPerElement(new Float32Array(10)), 4);
    assertEquals(getBytesPerElement(new Float64Array(10)), 8);
});

Deno.test("Array - getByteLength returns total bytes", () => {
    assertEquals(getByteLength(new Uint8Array(10)), 10);
    assertEquals(getByteLength(new Uint16Array(10)), 20);
    assertEquals(getByteLength(new Uint32Array(10)), 40);
    assertEquals(getByteLength(new Float32Array(10)), 40);
});

Deno.test("Array - getArrayTypeName returns constructor name", () => {
    assertEquals(getArrayTypeName(new Uint8Array(10)), "Uint8Array");
    assertEquals(getArrayTypeName(new Float32Array(10)), "Float32Array");
    assertEquals(getArrayTypeName(new Int32Array(10)), "Int32Array");
});

Deno.test("Array - isTypedArray identifies typed arrays", () => {
    assertEquals(isTypedArray(new Uint8Array(10)), true);
    assertEquals(isTypedArray(new Float32Array(10)), true);
    assertEquals(isTypedArray([1, 2, 3]), false);
    assertEquals(isTypedArray({}), false);
    assertEquals(isTypedArray(null), false);
    assertEquals(isTypedArray(new DataView(new ArrayBuffer(10))), false);
});

Deno.test("Array - toArrayBuffer creates new buffer", () => {
    const array = new Uint8Array([1, 2, 3, 4]);
    const buffer = toArrayBuffer(array);

    assertEquals(buffer.byteLength, 4);
    assertEquals(new Uint8Array(buffer)[0], 1);
    assertEquals(new Uint8Array(buffer)[3], 4);
});

Deno.test("Array - toUint8Array creates Uint8Array view", () => {
    const array = new Float32Array([1.5, 2.5]);
    const uint8 = toUint8Array(array);

    assertEquals(uint8.byteLength, 8);
    assertEquals(uint8 instanceof Uint8Array, true);
});

Deno.test("Array - fromArrayBuffer creates typed array", () => {
    const buffer = new ArrayBuffer(16);
    const view = new Uint32Array(buffer);
    view[0] = 42;

    const array = fromArrayBuffer<Uint32Array>(buffer, Uint32Array);
    assertEquals(array[0], 42);
    assertEquals(array.length, 4);
});

Deno.test("Array - cloneArray creates independent copy", () => {
    const original = new Float32Array([1, 2, 3]);
    const clone = cloneArray(original);

    assertEquals(clone[0], 1);
    assertEquals(clone[1], 2);
    assertEquals(clone[2], 3);

    // Modify clone
    clone[0] = 99;

    // Original unchanged
    assertEquals(original[0], 1);
});

Deno.test("Array - concatenateArrays joins multiple arrays", () => {
    const a1 = new Float32Array([1, 2]);
    const a2 = new Float32Array([3, 4]);
    const a3 = new Float32Array([5, 6]);

    const result = concatenateArrays([a1, a2, a3]);

    assertEquals(result.length, 6);
    assertEquals(result[0], 1);
    assertEquals(result[3], 4);
    assertEquals(result[5], 6);
});

Deno.test("Array - concatenateArrays throws on empty list", () => {
    assertThrows(() => {
        concatenateArrays([]);
    }, Error, "empty");
});

Deno.test("Array - getVertexFormatSize returns correct sizes", () => {
    assertEquals(getVertexFormatSize("float32"), 4);
    assertEquals(getVertexFormatSize("float32x2"), 8);
    assertEquals(getVertexFormatSize("float32x3"), 12);
    assertEquals(getVertexFormatSize("float32x4"), 16);
    assertEquals(getVertexFormatSize("uint32"), 4);
    assertEquals(getVertexFormatSize("uint8x4"), 4);
    assertEquals(getVertexFormatSize("uint16x2"), 4);
});

Deno.test("Array - interleaveAttributes combines attributes", () => {
    // Positions: [x1, y1, z1, x2, y2, z2]
    const positions = new Float32Array([1, 2, 3, 4, 5, 6]);
    // Colors: [r1, g1, b1, r2, g2, b2]
    const colors = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);

    const interleaved = interleaveAttributes(
        [positions, colors],
        [3, 3],
    );

    // Result: [x1, y1, z1, r1, g1, b1, x2, y2, z2, r2, g2, b2]
    assertEquals(interleaved.length, 12);
    assertEquals(interleaved[0], 1); // x1
    assertEquals(interleaved[1], 2); // y1
    assertEquals(interleaved[2], 3); // z1
    assertFloatEquals(interleaved[3], 0.1); // r1
    assertFloatEquals(interleaved[4], 0.2); // g1
    assertFloatEquals(interleaved[5], 0.3); // b1
    assertEquals(interleaved[6], 4); // x2
    assertFloatEquals(interleaved[9], 0.4); // r2
});

Deno.test("Array - interleaveAttributes throws on length mismatch", () => {
    const positions = new Float32Array([1, 2, 3]);
    const colors = new Float32Array([0.1, 0.2]);

    assertThrows(() => {
        interleaveAttributes([positions, colors], [3, 3]);
    }, Error, "incorrect length");
});

Deno.test("Array - interleaveAttributes throws on array count mismatch", () => {
    const positions = new Float32Array([1, 2, 3]);

    assertThrows(() => {
        interleaveAttributes([positions], [3, 3]);
    }, Error, "same length");
});

Deno.test("Array - deinterleaveAttributes splits attributes", () => {
    // Interleaved: [x1, y1, r1, g1, x2, y2, r2, g2]
    const interleaved = new Float32Array([1, 2, 0.1, 0.2, 3, 4, 0.3, 0.4]);

    const [positions, colors] = deinterleaveAttributes(
        interleaved,
        [2, 2],
    );

    assertEquals(positions.length, 4);
    assertEquals(positions[0], 1); // x1
    assertEquals(positions[1], 2); // y1
    assertEquals(positions[2], 3); // x2
    assertEquals(positions[3], 4); // y2

    assertEquals(colors.length, 4);
    assertFloatEquals(colors[0], 0.1); // r1
    assertFloatEquals(colors[1], 0.2); // g1
    assertFloatEquals(colors[2], 0.3); // r2
    assertFloatEquals(colors[3], 0.4); // g2
});

Deno.test("Array - deinterleaveAttributes throws on invalid stride", () => {
    const interleaved = new Float32Array([1, 2, 3]);

    assertThrows(() => {
        deinterleaveAttributes(interleaved, [2, 2]);
    }, Error, "not divisible");
});

Deno.test("Array - optimizeIndices converts to uint16 when possible", () => {
    const indices = new Uint32Array([0, 1, 2, 3, 100]);
    const optimized = optimizeIndices(indices);

    assertEquals(optimized instanceof Uint16Array, true);
    assertEquals(optimized.length, 5);
    assertEquals(optimized[4], 100);
});

Deno.test("Array - optimizeIndices keeps uint32 when needed", () => {
    const indices = new Uint32Array([0, 1, 2, 100000]);
    const optimized = optimizeIndices(indices);

    assertEquals(optimized instanceof Uint32Array, true);
    assertEquals(optimized.length, 4);
    assertEquals(optimized[3], 100000);
});

Deno.test("Array - validateArraySize passes on correct size", () => {
    const array = new Uint8Array(10);
    validateArraySize(array, 10 as GPUSize);
});

Deno.test("Array - validateArraySize throws on wrong size", () => {
    const array = new Uint8Array(10);

    assertThrows(() => {
        validateArraySize(array, 20 as GPUSize);
    }, Error, "size mismatch");
});

Deno.test("Array - validateArrayLength passes on correct length", () => {
    const array = new Float32Array(10);
    validateArrayLength(array, 10);
});

Deno.test("Array - validateArrayLength throws on wrong length", () => {
    const array = new Float32Array(10);

    assertThrows(() => {
        validateArrayLength(array, 20);
    }, Error, "length mismatch");
});

Deno.test("Array - validateNonEmpty passes on non-empty array", () => {
    const array = new Float32Array([1]);
    validateNonEmpty(array);
});

Deno.test("Array - validateNonEmpty throws on empty array", () => {
    const array = new Float32Array(0);

    assertThrows(() => {
        validateNonEmpty(array);
    }, Error, "cannot be empty");
});

Deno.test("Array - fillArray fills with value", () => {
    const array = new Float32Array(5);
    fillArray(array, 42);

    assertEquals(array[0], 42);
    assertEquals(array[4], 42);
});

Deno.test("Array - fillArray fills range", () => {
    const array = new Float32Array(5);
    fillArray(array, 99, 1, 3);

    assertEquals(array[0], 0);
    assertEquals(array[1], 99);
    assertEquals(array[2], 99);
    assertEquals(array[3], 0);
});

Deno.test("Array - copyArrayData copies between arrays", () => {
    const source = new Float32Array([1, 2, 3, 4]);
    const dest = new Float32Array(10);

    copyArrayData(source, dest, 0, 2, 3);

    assertEquals(dest[0], 0);
    assertEquals(dest[1], 0);
    assertEquals(dest[2], 1);
    assertEquals(dest[3], 2);
    assertEquals(dest[4], 3);
    assertEquals(dest[5], 0);
});

Deno.test("Array - copyArrayData throws on out of bounds source", () => {
    const source = new Float32Array([1, 2]);
    const dest = new Float32Array(10);

    assertThrows(() => {
        copyArrayData(source, dest, 0, 0, 10);
    }, Error, "Source copy range");
});

Deno.test("Array - copyArrayData throws on out of bounds dest", () => {
    const source = new Float32Array([1, 2, 3]);
    const dest = new Float32Array(2);

    assertThrows(() => {
        copyArrayData(source, dest, 0, 0, 3);
    }, Error, "Destination copy range");
});

Deno.test("Array - reverseArray reverses in place", () => {
    const array = new Float32Array([1, 2, 3, 4]);
    reverseArray(array);

    assertEquals(array[0], 4);
    assertEquals(array[1], 3);
    assertEquals(array[2], 2);
    assertEquals(array[3], 1);
});

Deno.test("Array - createZeroArray creates zero-filled array", () => {
    const array = createZeroArray<Float32Array>(Float32Array, 5);

    assertEquals(array.length, 5);
    assertEquals(array[0], 0);
    assertEquals(array[4], 0);
});

Deno.test("Array - createArrayFromValues creates from values", () => {
    const array = createArrayFromValues<Float32Array>(
        Float32Array,
        [1.5, 2.5, 3.5],
    );

    assertEquals(array.length, 3);
    assertEquals(array[0], 1.5);
    assertEquals(array[1], 2.5);
    assertEquals(array[2], 3.5);
});
