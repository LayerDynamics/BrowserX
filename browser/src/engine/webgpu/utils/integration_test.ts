import { assertEquals, assert } from "@std/assert";
import { createStagingBelt, stagingBeltWrite, stagingBeltFinish } from "./BufferHelpers.ts";
import { calculateMipLevels, getMipSize } from "./TextureHelpers.ts";
import { generateAddKernel, KernelOperation } from "./ComputeKernels.ts";
import { createTensor, tensorSizeBytes, TensorDType, TensorAccess } from "./TensorHelpers.ts";
import { createPerspectiveMatrix } from "./FrameworkHelpers.ts";

Deno.test("BufferHelpers: StagingBelt operations", () => {
    const belt = createStagingBelt(256 * 1024);
    assert(belt > 0n, "Belt handle should be positive");

    const write = stagingBeltWrite(belt, 4096n);
    assert(write !== null, "Write should succeed");
    if (write) {
        assert(write.size === 4096, "Write size should match requested size");
    }

    stagingBeltFinish(belt);
});

Deno.test("TextureHelpers: Mipmap calculation", () => {
    const mipLevels = calculateMipLevels(1024, 1024);
    assertEquals(mipLevels, 11);  // log2(1024) + 1

    const mipSize = getMipSize(1024, 1024, 3);
    assertEquals(mipSize !== null, true);
    if (mipSize) {
        assertEquals(mipSize.width, 128);
        assertEquals(mipSize.height, 128);
    }
});

Deno.test("ComputeKernels: Kernel generation", () => {
    const code = generateAddKernel(256);
    assert(code.includes("@compute"));
    assert(code.includes("@workgroup_size(256, 1, 1)"));
    assert(code.includes("input_a"));
    assert(code.includes("input_b"));
});

Deno.test("TensorHelpers: Tensor operations", () => {
    const tensor = createTensor(
        123n,  // buffer handle
        [128, 256, 3],  // shape: [batch, features, channels]
        TensorDType.Float32,
        TensorAccess.ReadWrite
    );

    assert(tensor !== null, "Tensor creation should succeed");
    if (tensor) {
        const sizeBytes = tensorSizeBytes(tensor);
        assert(sizeBytes === BigInt(128 * 256 * 3 * 4), "Tensor size should match expected size");  // Float32 = 4 bytes
    }
});

Deno.test("FrameworkHelpers: Matrix operations", () => {
    const matrix = createPerspectiveMatrix(
        Math.PI / 4,  // 45 degrees FOV
        16 / 9,       // aspect ratio
        0.1,          // near plane
        100.0         // far plane
    );

    assertEquals(matrix !== null, true);
    if (matrix) {
        assertEquals(matrix.length, 16);
        assertEquals(matrix instanceof Float32Array, true);
    }
});
