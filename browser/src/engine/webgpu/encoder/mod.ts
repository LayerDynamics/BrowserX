/**
 * WebGPU Command Encoder
 *
 * Manages command encoding for GPU operations:
 * - Render pass recording
 * - Compute pass recording
 * - Copy operations
 * - Command buffer submission
 * - Timing queries
 *
 * @module encoder
 */

import {
    GPUCommandEncoderID,
    GPURenderPassID,
    GPUComputePassID,
    GPUCommandBufferID,
    GPUBufferID,
    GPUTextureID,
    Timestamp,
    Nanoseconds,
} from "../../../types/webgpu.ts";
import { WebGPUDevice } from "../adapter/Device.ts";
import { GPUEncoderError } from "../errors.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Command encoder state
 */
export enum EncoderState {
    OPEN = "OPEN",
    ENCODING_RENDER = "ENCODING_RENDER",
    ENCODING_COMPUTE = "ENCODING_COMPUTE",
    FINISHED = "FINISHED",
    ERROR = "ERROR",
}

/**
 * Render pass descriptor
 */
export interface RenderPassDescriptor {
    colorAttachments: GPURenderPassColorAttachment[];
    depthStencilAttachment?: GPURenderPassDepthStencilAttachment;
    occlusionQuerySet?: GPUQuerySet;
    timestampWrites?: GPURenderPassTimestampWrites;
    label?: string;
}

/**
 * Compute pass descriptor
 */
export interface ComputePassDescriptor {
    timestampWrites?: GPUComputePassTimestampWrites;
    label?: string;
}

/**
 * Command buffer descriptor
 */
export interface CommandBufferDescriptor {
    label?: string;
}

/**
 * Copy buffer to buffer descriptor
 */
export interface CopyBufferToBufferDescriptor {
    source: GPUBuffer;
    sourceOffset?: number;
    destination: GPUBuffer;
    destinationOffset?: number;
    size: number;
}

/**
 * Image copy source from buffer
 */
export interface ImageCopyBuffer {
    buffer: GPUBuffer;
    offset?: number;
    bytesPerRow?: number;
    rowsPerImage?: number;
}

/**
 * Image copy source/destination for texture
 */
export interface ImageCopyTexture {
    texture: GPUTexture;
    mipLevel?: number;
    origin?: [number, number, number];
    aspect?: GPUTextureAspect;
}

/**
 * 3D extent for copy operations
 */
export interface Extent3D {
    width: number;
    height?: number;
    depthOrArrayLayers?: number;
}

/**
 * Copy buffer to texture descriptor
 */
export interface CopyBufferToTextureDescriptor {
    source: ImageCopyBuffer;
    destination: ImageCopyTexture;
    copySize: Extent3D;
}

/**
 * Copy texture to buffer descriptor
 */
export interface CopyTextureToBufferDescriptor {
    source: ImageCopyTexture;
    destination: ImageCopyBuffer;
    copySize: Extent3D;
}

/**
 * Copy texture to texture descriptor
 */
export interface CopyTextureToTextureDescriptor {
    source: ImageCopyTexture;
    destination: ImageCopyTexture;
    copySize: Extent3D;
}

/**
 * Timing query result
 */
export interface TimingQueryResult {
    passType: "render" | "compute";
    label?: string;
    startTime: Nanoseconds;
    endTime: Nanoseconds;
    duration: Nanoseconds;
}

/**
 * Encoder statistics
 */
export interface EncoderStatistics {
    renderPassCount: number;
    computePassCount: number;
    copyOperationCount: number;
    commandBuffersSubmitted: number;
    totalEncodingTime: Nanoseconds;
    averageEncodingTime: Nanoseconds;
}

// ============================================================================
// WebGPU Command Encoder
// ============================================================================

/**
 * Manages GPU command encoding and submission
 */
export class WebGPUCommandEncoder {
    private readonly id: GPUCommandEncoderID;
    private readonly device: WebGPUDevice;
    private encoder: GPUCommandEncoder | null = null;
    private state: EncoderState = EncoderState.OPEN;
    private createdAt: Timestamp;
    private finishedAt: Timestamp | null = null;

    // Current pass tracking
    private currentRenderPass: GPURenderPassEncoder | null = null;
    private currentComputePass: GPUComputePassEncoder | null = null;
    private currentPassLabel: string | undefined;

    // Statistics
    private renderPassCount = 0;
    private computePassCount = 0;
    private copyOperationCount = 0;

    // Timing queries
    private querySet: GPUQuerySet | null = null;
    private queryBuffer: GPUBuffer | null = null;
    private timingResults: TimingQueryResult[] = [];

    constructor(device: WebGPUDevice, label?: string) {
        this.id = crypto.randomUUID() as GPUCommandEncoderID;
        this.device = device;
        this.createdAt = Date.now() as Timestamp;

        try {
            this.encoder = this.device.getDevice().createCommandEncoder({
                label: label || `CommandEncoder-${this.id}`,
            });
        } catch (error) {
            this.state = EncoderState.ERROR;
            throw new GPUEncoderError(
                `Failed to create command encoder: ${error instanceof Error ? error.message : String(error)}`,
                {
                    encoderId: this.id,
                    context: { label },
                }
            );
        }
    }

    // ========================================================================
    // Getters
    // ========================================================================

    /**
     * Get encoder ID
     */
    getId(): GPUCommandEncoderID {
        return this.id;
    }

    /**
     * Get encoder state
     */
    getState(): EncoderState {
        return this.state;
    }

    /**
     * Get underlying GPUCommandEncoder
     */
    getEncoder(): GPUCommandEncoder {
        if (!this.encoder || this.state === EncoderState.FINISHED || this.state === EncoderState.ERROR) {
            throw new GPUEncoderError(
                `Cannot access encoder in state ${this.state}`,
                {
                    encoderId: this.id,
                    encoderState: this.state,
                }
            );
        }
        return this.encoder;
    }

    /**
     * Get statistics
     */
    getStatistics(): EncoderStatistics {
        const now = Date.now() as Timestamp;
        const totalTime = (this.finishedAt || now) - this.createdAt;
        const totalPasses = this.renderPassCount + this.computePassCount;

        return {
            renderPassCount: this.renderPassCount,
            computePassCount: this.computePassCount,
            copyOperationCount: this.copyOperationCount,
            commandBuffersSubmitted: this.state === EncoderState.FINISHED ? 1 : 0,
            totalEncodingTime: totalTime as Nanoseconds,
            averageEncodingTime: totalPasses > 0 ? (totalTime / totalPasses) as Nanoseconds : 0 as Nanoseconds,
        };
    }

    // ========================================================================
    // Render Pass
    // ========================================================================

    /**
     * Begin a render pass
     */
    beginRenderPass(descriptor: RenderPassDescriptor): GPURenderPassEncoder {
        if (this.state !== EncoderState.OPEN) {
            throw new GPUEncoderError(
                `Cannot begin render pass in state ${this.state}`,
                {
                    encoderId: this.id,
                    encoderState: this.state,
                }
            );
        }

        if (this.currentRenderPass || this.currentComputePass) {
            throw new GPUEncoderError(
                "Cannot begin render pass while another pass is active",
                {
                    encoderId: this.id,
                    context: { hasRenderPass: !!this.currentRenderPass, hasComputePass: !!this.currentComputePass },
                }
            );
        }

        try {
            this.currentRenderPass = this.getEncoder().beginRenderPass(descriptor);
            this.state = EncoderState.ENCODING_RENDER;
            this.currentPassLabel = descriptor.label;
            this.renderPassCount++;

            return this.currentRenderPass;
        } catch (error) {
            this.state = EncoderState.ERROR;
            throw new GPUEncoderError(
                `Failed to begin render pass: ${error instanceof Error ? error.message : String(error)}`,
                {
                    encoderId: this.id,
                    context: { descriptor },
                }
            );
        }
    }

    /**
     * End the current render pass
     */
    endRenderPass(): void {
        if (this.state !== EncoderState.ENCODING_RENDER || !this.currentRenderPass) {
            this.state = EncoderState.ERROR;
            throw new GPUEncoderError(
                "No active render pass to end",
                {
                    encoderId: this.id,
                    encoderState: this.state,
                }
            );
        }

        try {
            this.currentRenderPass.end();
            this.currentRenderPass = null;
            this.currentPassLabel = undefined;
            this.state = EncoderState.OPEN;
        } catch (error) {
            this.state = EncoderState.ERROR;
            throw new GPUEncoderError(
                `Failed to end render pass: ${error instanceof Error ? error.message : String(error)}`,
                {
                    encoderId: this.id,
                }
            );
        }
    }

    /**
     * Get current render pass encoder
     */
    getCurrentRenderPass(): GPURenderPassEncoder | null {
        return this.currentRenderPass;
    }

    // ========================================================================
    // Compute Pass
    // ========================================================================

    /**
     * Begin a compute pass
     */
    beginComputePass(descriptor?: ComputePassDescriptor): GPUComputePassEncoder {
        if (this.state !== EncoderState.OPEN) {
            throw new GPUEncoderError(
                `Cannot begin compute pass in state ${this.state}`,
                {
                    encoderId: this.id,
                    encoderState: this.state,
                }
            );
        }

        if (this.currentRenderPass || this.currentComputePass) {
            throw new GPUEncoderError(
                "Cannot begin compute pass while another pass is active",
                {
                    encoderId: this.id,
                    context: { hasRenderPass: !!this.currentRenderPass, hasComputePass: !!this.currentComputePass },
                }
            );
        }

        try {
            this.currentComputePass = this.getEncoder().beginComputePass(descriptor);
            this.state = EncoderState.ENCODING_COMPUTE;
            this.currentPassLabel = descriptor?.label;
            this.computePassCount++;

            return this.currentComputePass;
        } catch (error) {
            this.state = EncoderState.ERROR;
            throw new GPUEncoderError(
                `Failed to begin compute pass: ${error instanceof Error ? error.message : String(error)}`,
                {
                    encoderId: this.id,
                    context: { descriptor },
                }
            );
        }
    }

    /**
     * End the current compute pass
     */
    endComputePass(): void {
        if (this.state !== EncoderState.ENCODING_COMPUTE || !this.currentComputePass) {
            this.state = EncoderState.ERROR;
            throw new GPUEncoderError(
                "No active compute pass to end",
                {
                    encoderId: this.id,
                    encoderState: this.state,
                }
            );
        }

        try {
            this.currentComputePass.end();
            this.currentComputePass = null;
            this.currentPassLabel = undefined;
            this.state = EncoderState.OPEN;
        } catch (error) {
            this.state = EncoderState.ERROR;
            throw new GPUEncoderError(
                `Failed to end compute pass: ${error instanceof Error ? error.message : String(error)}`,
                {
                    encoderId: this.id,
                }
            );
        }
    }

    /**
     * Get current compute pass encoder
     */
    getCurrentComputePass(): GPUComputePassEncoder | null {
        return this.currentComputePass;
    }

    // ========================================================================
    // Copy Operations
    // ========================================================================

    /**
     * Copy data from one buffer to another
     */
    copyBufferToBuffer(descriptor: CopyBufferToBufferDescriptor): void {
        if (this.state !== EncoderState.OPEN) {
            throw new GPUEncoderError(
                `Cannot copy buffer in state ${this.state}`,
                {
                    encoderId: this.id,
                    encoderState: this.state,
                }
            );
        }

        try {
            this.getEncoder().copyBufferToBuffer(
                descriptor.source,
                descriptor.sourceOffset || 0,
                descriptor.destination,
                descriptor.destinationOffset || 0,
                descriptor.size
            );
            this.copyOperationCount++;
        } catch (error) {
            this.state = EncoderState.ERROR;
            throw new GPUEncoderError(
                `Failed to copy buffer to buffer: ${error instanceof Error ? error.message : String(error)}`,
                {
                    encoderId: this.id,
                    context: { descriptor },
                }
            );
        }
    }

    /**
     * Copy data from buffer to texture
     */
    copyBufferToTexture(descriptor: CopyBufferToTextureDescriptor): void {
        if (this.state !== EncoderState.OPEN) {
            throw new GPUEncoderError(
                `Cannot copy buffer to texture in state ${this.state}`,
                {
                    encoderId: this.id,
                    encoderState: this.state,
                }
            );
        }

        try {
            this.getEncoder().copyBufferToTexture(
                descriptor.source,
                descriptor.destination,
                descriptor.copySize
            );
            this.copyOperationCount++;
        } catch (error) {
            this.state = EncoderState.ERROR;
            throw new GPUEncoderError(
                `Failed to copy buffer to texture: ${error instanceof Error ? error.message : String(error)}`,
                {
                    encoderId: this.id,
                    context: { descriptor },
                }
            );
        }
    }

    /**
     * Copy data from texture to buffer
     */
    copyTextureToBuffer(descriptor: CopyTextureToBufferDescriptor): void {
        if (this.state !== EncoderState.OPEN) {
            throw new GPUEncoderError(
                `Cannot copy texture to buffer in state ${this.state}`,
                {
                    encoderId: this.id,
                    encoderState: this.state,
                }
            );
        }

        try {
            this.getEncoder().copyTextureToBuffer(
                descriptor.source,
                descriptor.destination,
                descriptor.copySize
            );
            this.copyOperationCount++;
        } catch (error) {
            this.state = EncoderState.ERROR;
            throw new GPUEncoderError(
                `Failed to copy texture to buffer: ${error instanceof Error ? error.message : String(error)}`,
                {
                    encoderId: this.id,
                    context: { descriptor },
                }
            );
        }
    }

    /**
     * Copy data from one texture to another
     */
    copyTextureToTexture(descriptor: CopyTextureToTextureDescriptor): void {
        if (this.state !== EncoderState.OPEN) {
            throw new GPUEncoderError(
                `Cannot copy texture in state ${this.state}`,
                {
                    encoderId: this.id,
                    encoderState: this.state,
                }
            );
        }

        try {
            this.getEncoder().copyTextureToTexture(
                descriptor.source,
                descriptor.destination,
                descriptor.copySize
            );
            this.copyOperationCount++;
        } catch (error) {
            this.state = EncoderState.ERROR;
            throw new GPUEncoderError(
                `Failed to copy texture to texture: ${error instanceof Error ? error.message : String(error)}`,
                {
                    encoderId: this.id,
                    context: { descriptor },
                }
            );
        }
    }

    // ========================================================================
    // Command Buffer
    // ========================================================================

    /**
     * Finish encoding and return command buffer
     */
    finish(descriptor?: CommandBufferDescriptor): GPUCommandBuffer {
        if (this.state === EncoderState.FINISHED) {
            throw new GPUEncoderError(
                "Encoder already finished",
                {
                    encoderId: this.id,
                    encoderState: this.state,
                }
            );
        }

        if (this.state === EncoderState.ERROR) {
            throw new GPUEncoderError(
                "Cannot finish encoder in error state",
                {
                    encoderId: this.id,
                    encoderState: this.state,
                }
            );
        }

        if (this.currentRenderPass || this.currentComputePass) {
            throw new GPUEncoderError(
                "Cannot finish encoder with active pass",
                {
                    encoderId: this.id,
                    context: { hasRenderPass: !!this.currentRenderPass, hasComputePass: !!this.currentComputePass },
                }
            );
        }

        try {
            const commandBuffer = this.getEncoder().finish(descriptor);
            this.state = EncoderState.FINISHED;
            this.finishedAt = Date.now() as Timestamp;
            return commandBuffer;
        } catch (error) {
            this.state = EncoderState.ERROR;
            throw new GPUEncoderError(
                `Failed to finish encoder: ${error instanceof Error ? error.message : String(error)}`,
                {
                    encoderId: this.id,
                    context: { descriptor },
                }
            );
        }
    }

    // ========================================================================
    // Timing Queries
    // ========================================================================

    /**
     * Initialize timing queries
     */
    initializeTimingQueries(maxQueries: number): void {
        try {
            // Create query set for timestamp queries
            this.querySet = this.device.getDevice().createQuerySet({
                type: "timestamp",
                count: maxQueries * 2, // Start and end for each query
            });

            // Create buffer to read query results
            this.queryBuffer = this.device.getDevice().createBuffer({
                size: maxQueries * 2 * 8, // 8 bytes per timestamp
                usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
            });
        } catch (error) {
            throw new GPUEncoderError(
                `Failed to initialize timing queries: ${error instanceof Error ? error.message : String(error)}`,
                {
                    encoderId: this.id,
                    context: { maxQueries },
                }
            );
        }
    }

    /**
     * Get timing query results
     */
    async getTimingResults(): Promise<TimingQueryResult[]> {
        if (!this.querySet || !this.queryBuffer) {
            throw new GPUEncoderError(
                "Timing queries not initialized",
                {
                    encoderId: this.id,
                }
            );
        }

        try {
            // Resolve queries to buffer
            const resolveEncoder = this.device.getDevice().createCommandEncoder();
            resolveEncoder.resolveQuerySet(
                this.querySet,
                0,
                this.querySet.count,
                this.queryBuffer,
                0
            );
            this.device.getDevice().queue.submit([resolveEncoder.finish()]);

            // Read results (would need a staging buffer in real implementation)
            // For now, return cached results
            return this.timingResults;
        } catch (error) {
            throw new GPUEncoderError(
                `Failed to get timing results: ${error instanceof Error ? error.message : String(error)}`,
                {
                    encoderId: this.id,
                }
            );
        }
    }

    // ========================================================================
    // Utility
    // ========================================================================

    /**
     * Check if encoder is finished
     */
    isFinished(): boolean {
        return this.state === EncoderState.FINISHED;
    }

    /**
     * Check if encoder has error
     */
    hasError(): boolean {
        return this.state === EncoderState.ERROR;
    }

    /**
     * Check if a pass is active
     */
    hasActivePass(): boolean {
        return this.currentRenderPass !== null || this.currentComputePass !== null;
    }
}
