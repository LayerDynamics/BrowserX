/**
 * WebGPU Compute Operations
 *
 * GPU compute pipeline management for parallel processing.
 *
 * @module operations/compute
 */

export {
    ComputePipeline,
    type WorkgroupDimensions,
    type DispatchDimensions,
    type ComputeConfig,
    type BufferBinding,
    type TextureBinding,
    type SamplerBinding,
    type BindGroupResources,
    type ComputePassConfig,
    type ComputeStatistics,
    ComputePipelineError,
} from "./ComputePipeline.ts";
