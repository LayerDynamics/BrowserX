/**
 * Compute Kernels
 *
 * Compute kernel templates using webgpu_x:
 * - 19 pre-built ML/AI operation templates
 * - Configurable workgroup sizes
 * - Automatic WGSL generation
 *
 * @module webgpu/utils/ComputeKernels
 */

import { WebGPUX, KernelOperation } from "@webgpu_x";

let webgpuXInstance: WebGPUX | null = null;

function getWebGPUX(): WebGPUX {
    if (!webgpuXInstance) {
        webgpuXInstance = new WebGPUX();
    }
    return webgpuXInstance;
}

/**
 * Generate kernel code from template
 *
 * @param operation - Kernel operation type
 * @param workgroupX - Workgroup size X dimension
 * @param workgroupY - Workgroup size Y dimension (default 1)
 * @param workgroupZ - Workgroup size Z dimension (default 1)
 * @returns Complete WGSL compute shader code
 */
export function generateKernel(
    operation: KernelOperation,
    workgroupX: number,
    workgroupY: number = 1,
    workgroupZ: number = 1
): string {
    const webgpuX = getWebGPUX();
    return webgpuX.kernelGenerateFromTemplate(operation, workgroupX, workgroupY, workgroupZ);
}

// Convenience functions for specific operations

export function generateAddKernel(workgroupSize: number = 256): string {
    return generateKernel(KernelOperation.Add, workgroupSize);
}

export function generateMatMulKernel(workgroupX: number = 16, workgroupY: number = 16): string {
    return generateKernel(KernelOperation.MatrixMultiply, workgroupX, workgroupY);
}

export function generateConv2DKernel(workgroupX: number = 16, workgroupY: number = 16): string {
    return generateKernel(KernelOperation.Conv2D, workgroupX, workgroupY);
}

export function generateReluKernel(workgroupSize: number = 256): string {
    return generateKernel(KernelOperation.Relu, workgroupSize);
}

export function generateSoftmaxKernel(workgroupSize: number = 256): string {
    return generateKernel(KernelOperation.Softmax, workgroupSize);
}

// Re-export KernelOperation enum
export { KernelOperation };
