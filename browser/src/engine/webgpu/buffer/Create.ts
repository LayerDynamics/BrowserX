/**
 * WebGPU Buffer Management
 *
 * Provides GPU buffer creation, mapping, writing, and lifecycle management
 * with state machine tracking and usage validation.
 */

import { GPUBufferState, GPUBufferUsageFlags } from "../../../types/webgpu.ts";
import type {
    GPUBufferID,
    GPUSize,
    ByteCount,
    Timestamp,
} from "../../../types/webgpu.ts";
import {
    GPUBufferError,
    GPUBufferMapError,
    GPUBufferUsageError,
} from "../errors.ts";
import type { WebGPUDevice } from "../adapter/Device.ts";

// ============================================================================
// Buffer Configuration
// ============================================================================

/**
 * Configuration for buffer creation
 */
export interface BufferConfig {
    /** Buffer size in bytes */
    size: GPUSize;

    /** Buffer usage flags (bitfield) */
    usage: number;

    /** Enable buffer mapping */
    mappedAtCreation?: boolean;

    /** Label for debugging */
    label?: string;
}

/**
 * Buffer mapping mode
 */
export enum BufferMapMode {
    READ = "READ",
    WRITE = "WRITE",
}

// ============================================================================
// WebGPU Buffer
// ============================================================================

/**
 * WebGPUBuffer - Manages GPU buffer lifecycle with state machine
 *
 * State transitions:
 * UNMAPPED → MAPPING_PENDING → MAPPED_FOR_READING → UNMAPPED
 * UNMAPPED → MAPPING_PENDING → MAPPED_FOR_WRITING → UNMAPPED
 * Any state → DESTROYED (terminal)
 *
 * Best practices:
 * - Use writeBuffer() for one-time uploads (recommended)
 * - Use mapAsync() only when CPU needs to read/write buffer data
 * - Always unmap() after mapping operations
 */
export class WebGPUBuffer {
    /** Unique buffer identifier */
    public readonly id: GPUBufferID;

    /** Buffer size in bytes */
    public readonly size: GPUSize;

    /** Buffer usage flags */
    public readonly usage: number;

    /** Debug label */
    public readonly label?: string;

    /** Current buffer state */
    private state: GPUBufferState;

    /** Native GPU buffer */
    private buffer: GPUBuffer | null = null;

    /** Parent device */
    private device: WebGPUDevice;

    /** Mapped range (if mapped) */
    private mappedRange: ArrayBuffer | null = null;

    /** Creation timestamp */
    private readonly createdAt: Timestamp;

    /** Last write timestamp */
    private lastWriteAt: Timestamp | null = null;

    /** Last map timestamp */
    private lastMapAt: Timestamp | null = null;

    /** Total bytes written */
    private totalBytesWritten: ByteCount = 0 as ByteCount;

    /** Map operation count */
    private mapCount = 0;

    /** Unmap operation count */
    private unmapCount = 0;

    /** Write operation count */
    private writeCount = 0;

    constructor(device: WebGPUDevice, config: BufferConfig) {
        this.id = crypto.randomUUID() as GPUBufferID;
        this.device = device;
        this.size = config.size;
        this.usage = config.usage;
        this.label = config.label;
        this.createdAt = Date.now();

        // Validate configuration
        this.validateConfig(config);

        // Create native buffer
        this.createBuffer(config);

        // Set initial state
        if (config.mappedAtCreation) {
            this.state = GPUBufferState.MAPPED_FOR_WRITING;
            this.mappedRange = this.buffer!.getMappedRange();
        } else {
            this.state = GPUBufferState.UNMAPPED;
        }

        // Track buffer creation in device stats
        this.device.trackBufferCreated(this.size);
    }

    // ========================================================================
    // Buffer Creation
    // ========================================================================

    /**
     * Validate buffer configuration
     */
    private validateConfig(config: BufferConfig): void {
        // Validate size
        if (config.size <= 0) {
            throw new GPUBufferError(
                `Buffer size must be > 0, got ${config.size}`,
                { size: config.size }
            );
        }

        // Validate usage flags
        if (config.usage === 0) {
            throw new GPUBufferError(
                "Buffer usage flags must be specified",
                { usage: config.usage }
            );
        }

        // MAP_READ/MAP_WRITE validation
        const hasMapRead = (config.usage & GPUBufferUsageFlags.MAP_READ) !== 0;
        const hasMapWrite = (config.usage & GPUBufferUsageFlags.MAP_WRITE) !== 0;

        if (hasMapRead && hasMapWrite) {
            throw new GPUBufferError(
                "Buffer cannot have both MAP_READ and MAP_WRITE usage",
                { usage: config.usage }
            );
        }

        // MAP_READ restrictions
        if (hasMapRead) {
            const invalidWithMapRead = [
                GPUBufferUsageFlags.MAP_WRITE,
                GPUBufferUsageFlags.COPY_SRC,
            ];
            for (const flag of invalidWithMapRead) {
                if ((config.usage & flag) !== 0) {
                    throw new GPUBufferError(
                        `MAP_READ cannot be combined with ${this.usageFlagName(flag)}`,
                        { usage: config.usage }
                    );
                }
            }
        }

        // MAP_WRITE restrictions
        if (hasMapWrite) {
            const invalidWithMapWrite = [
                GPUBufferUsageFlags.MAP_READ,
                GPUBufferUsageFlags.COPY_DST,
            ];
            for (const flag of invalidWithMapWrite) {
                if ((config.usage & flag) !== 0) {
                    throw new GPUBufferError(
                        `MAP_WRITE cannot be combined with ${this.usageFlagName(flag)}`,
                        { usage: config.usage }
                    );
                }
            }
        }
    }

    /**
     * Get usage flag name for error messages
     */
    private usageFlagName(flag: number): string {
        const names: Record<number, string> = {
            [GPUBufferUsageFlags.MAP_READ]: "MAP_READ",
            [GPUBufferUsageFlags.MAP_WRITE]: "MAP_WRITE",
            [GPUBufferUsageFlags.COPY_SRC]: "COPY_SRC",
            [GPUBufferUsageFlags.COPY_DST]: "COPY_DST",
            [GPUBufferUsageFlags.INDEX]: "INDEX",
            [GPUBufferUsageFlags.VERTEX]: "VERTEX",
            [GPUBufferUsageFlags.UNIFORM]: "UNIFORM",
            [GPUBufferUsageFlags.STORAGE]: "STORAGE",
            [GPUBufferUsageFlags.INDIRECT]: "INDIRECT",
            [GPUBufferUsageFlags.QUERY_RESOLVE]: "QUERY_RESOLVE",
        };
        return names[flag] || `UNKNOWN(${flag})`;
    }

    /**
     * Create native GPU buffer
     */
    private createBuffer(config: BufferConfig): void {
        const nativeDevice = this.device.getDevice();

        this.buffer = nativeDevice.createBuffer({
            size: config.size,
            usage: config.usage,
            mappedAtCreation: config.mappedAtCreation ?? false,
            label: config.label,
        });

        if (!this.buffer) {
            throw new GPUBufferError(
                "Failed to create GPU buffer",
                {
                    bufferId: this.id,
                    size: config.size,
                    usage: config.usage,
                }
            );
        }
    }

    // ========================================================================
    // Write Operations (Recommended Path)
    // ========================================================================

    /**
     * Write data to buffer using queue.writeBuffer (recommended)
     * This is the preferred method for uploading data to GPU buffers.
     *
     * @param data - Data to write
     * @param offset - Offset in buffer (bytes)
     */
    write(data: BufferSource | SharedArrayBuffer, offset: number = 0): void {
        // Validate state
        if (this.state === GPUBufferState.DESTROYED) {
            throw new GPUBufferError(
                "Cannot write to destroyed buffer",
                {
                    bufferId: this.id,
                    bufferState: this.state,
                }
            );
        }

        if (this.state !== GPUBufferState.UNMAPPED) {
            throw new GPUBufferError(
                `Cannot write to buffer in state ${this.state}`,
                {
                    bufferId: this.id,
                    bufferState: this.state,
                }
            );
        }

        // Validate usage
        if ((this.usage & GPUBufferUsageFlags.COPY_DST) === 0) {
            throw new GPUBufferUsageError(
                this.id,
                GPUBufferUsageFlags.COPY_DST,
                this.usage,
                "writeBuffer"
            );
        }

        // Validate size
        const dataSize = ArrayBuffer.isView(data)
            ? data.byteLength
            : (data as ArrayBuffer).byteLength;

        if (offset + dataSize > this.size) {
            throw new GPUBufferError(
                `Write would exceed buffer size: ${offset + dataSize} > ${this.size}`,
                {
                    bufferId: this.id,
                    size: this.size,
                    context: {
                        offset,
                        dataSize,
                        bufferSize: this.size,
                    },
                }
            );
        }

        // Perform write - handle SharedArrayBuffer by copying to regular ArrayBuffer
        const queue = this.device.getQueue();
        let bufferSource: BufferSource;
        if (data instanceof SharedArrayBuffer) {
            // Copy SharedArrayBuffer to regular ArrayBuffer
            const regularBuffer = new ArrayBuffer(data.byteLength);
            new Uint8Array(regularBuffer).set(new Uint8Array(data));
            bufferSource = regularBuffer;
        } else {
            bufferSource = data;
        }
        queue.writeBuffer(this.buffer!, offset, bufferSource, 0, dataSize);

        // Update statistics
        this.writeCount++;
        this.lastWriteAt = Date.now();
        this.totalBytesWritten = (this.totalBytesWritten + dataSize) as ByteCount;
    }

    // ========================================================================
    // Map Operations (For CPU Access)
    // ========================================================================

    /**
     * Map buffer for CPU access
     * Use only when CPU needs to read/write buffer data.
     *
     * @param mode - Mapping mode (READ or WRITE)
     * @param offset - Offset in buffer (bytes)
     * @param size - Size to map (bytes)
     */
    async mapAsync(
        mode: BufferMapMode,
        offset: number = 0,
        size?: number
    ): Promise<void> {
        // Validate state
        if (this.state === GPUBufferState.DESTROYED) {
            throw new GPUBufferError(
                "Cannot map destroyed buffer",
                {
                    bufferId: this.id,
                    bufferState: this.state,
                }
            );
        }

        if (this.state !== GPUBufferState.UNMAPPED) {
            throw new GPUBufferError(
                `Cannot map buffer in state ${this.state}`,
                {
                    bufferId: this.id,
                    bufferState: this.state,
                }
            );
        }

        // Validate usage for mapping mode
        if (mode === BufferMapMode.READ) {
            if ((this.usage & GPUBufferUsageFlags.MAP_READ) === 0) {
                throw new GPUBufferUsageError(
                    this.id,
                    GPUBufferUsageFlags.MAP_READ,
                    this.usage,
                    "mapAsync READ"
                );
            }
        } else {
            if ((this.usage & GPUBufferUsageFlags.MAP_WRITE) === 0) {
                throw new GPUBufferUsageError(
                    this.id,
                    GPUBufferUsageFlags.MAP_WRITE,
                    this.usage,
                    "mapAsync WRITE"
                );
            }
        }

        // Transition to mapping pending
        this.state = GPUBufferState.MAPPING_PENDING;

        try {
            // Perform async map operation
            const nativeMode = mode === BufferMapMode.READ
                ? GPUMapMode.READ
                : GPUMapMode.WRITE;

            const mapSize = size ?? (this.size - offset);
            await this.buffer!.mapAsync(nativeMode, offset, mapSize);

            // Get mapped range
            this.mappedRange = this.buffer!.getMappedRange(offset, mapSize);

            // Transition to mapped state
            this.state = mode === BufferMapMode.READ
                ? GPUBufferState.MAPPED_FOR_READING
                : GPUBufferState.MAPPED_FOR_WRITING;

            // Update statistics
            this.mapCount++;
            this.lastMapAt = Date.now();
        } catch (error) {
            // Mapping failed, return to unmapped
            this.state = GPUBufferState.UNMAPPED;
            this.mappedRange = null;

            throw new GPUBufferMapError(
                this.id,
                mode,
                { originalError: error }
            );
        }
    }

    /**
     * Get mapped range for CPU access
     * Must be called after successful mapAsync()
     */
    getMappedRange(offset: number = 0, size?: number): ArrayBuffer {
        if (
            this.state !== GPUBufferState.MAPPED_FOR_READING &&
            this.state !== GPUBufferState.MAPPED_FOR_WRITING
        ) {
            throw new GPUBufferError(
                `Buffer is not mapped (state: ${this.state})`,
                {
                    bufferId: this.id,
                    bufferState: this.state,
                }
            );
        }

        if (!this.mappedRange) {
            throw new GPUBufferError(
                "Mapped range is not available",
                {
                    bufferId: this.id,
                    bufferState: this.state,
                }
            );
        }

        if (offset === 0 && size === undefined) {
            return this.mappedRange;
        }

        return this.buffer!.getMappedRange(offset, size);
    }

    /**
     * Unmap buffer after mapping operations
     */
    unmap(): void {
        if (
            this.state !== GPUBufferState.MAPPED_FOR_READING &&
            this.state !== GPUBufferState.MAPPED_FOR_WRITING
        ) {
            throw new GPUBufferError(
                `Cannot unmap buffer in state ${this.state}`,
                {
                    bufferId: this.id,
                    bufferState: this.state,
                }
            );
        }

        // Perform unmap
        this.buffer!.unmap();

        // Clear mapped range
        this.mappedRange = null;

        // Transition to unmapped
        this.state = GPUBufferState.UNMAPPED;

        // Update statistics
        this.unmapCount++;
    }

    // ========================================================================
    // State Management
    // ========================================================================

    /**
     * Get current buffer state
     */
    getState(): GPUBufferState {
        return this.state;
    }

    /**
     * Check if buffer is mapped
     */
    isMapped(): boolean {
        return (
            this.state === GPUBufferState.MAPPED_FOR_READING ||
            this.state === GPUBufferState.MAPPED_FOR_WRITING
        );
    }

    /**
     * Check if buffer is destroyed
     */
    isDestroyed(): boolean {
        return this.state === GPUBufferState.DESTROYED;
    }

    // ========================================================================
    // Buffer Access
    // ========================================================================

    /**
     * Get native GPU buffer
     */
    getNativeBuffer(): GPUBuffer {
        if (this.state === GPUBufferState.DESTROYED) {
            throw new GPUBufferError(
                "Cannot access destroyed buffer",
                {
                    bufferId: this.id,
                    bufferState: this.state,
                }
            );
        }

        if (!this.buffer) {
            throw new GPUBufferError(
                "Native buffer is not available",
                { bufferId: this.id }
            );
        }

        return this.buffer;
    }

    /**
     * Get buffer size
     */
    getSize(): GPUSize {
        return this.size;
    }

    /**
     * Get buffer usage flags
     */
    getUsage(): number {
        return this.usage;
    }

    /**
     * Check if buffer has specific usage flag
     */
    hasUsage(flag: GPUBufferUsageFlags): boolean {
        return (this.usage & flag) !== 0;
    }

    // ========================================================================
    // Statistics
    // ========================================================================

    /**
     * Get buffer statistics
     */
    getStats() {
        return {
            id: this.id,
            size: this.size,
            usage: this.usage,
            state: this.state,
            createdAt: this.createdAt,
            lastWriteAt: this.lastWriteAt,
            lastMapAt: this.lastMapAt,
            totalBytesWritten: this.totalBytesWritten,
            mapCount: this.mapCount,
            unmapCount: this.unmapCount,
            writeCount: this.writeCount,
        };
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Destroy buffer and release GPU resources
     */
    /**
     * Get buffer statistics
     */
    getStatistics(): { size: number; usage: number; state: string } {
        return {
            size: this.size,
            usage: this.usage,
            state: this.state,
        };
    }

    destroy(): void {
        if (this.state === GPUBufferState.DESTROYED) {
            return;
        }

        // Unmap if mapped
        if (this.isMapped()) {
            this.unmap();
        }

        // Destroy native buffer
        if (this.buffer) {
            this.buffer.destroy();
            this.buffer = null;
        }

        // Clear mapped range
        this.mappedRange = null;

        // Update device statistics
        this.device.trackBufferDestroyed(this.size);

        // Transition to destroyed
        this.state = GPUBufferState.DESTROYED;
    }
}

// ============================================================================
// Buffer Factory Functions
// ============================================================================

/**
 * Create vertex buffer
 */
export function createVertexBuffer(
    device: WebGPUDevice,
    size: GPUSize,
    label?: string
): WebGPUBuffer {
    return new WebGPUBuffer(device, {
        size,
        usage: GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST,
        label: label || "Vertex Buffer",
    });
}

/**
 * Create index buffer
 */
export function createIndexBuffer(
    device: WebGPUDevice,
    size: GPUSize,
    label?: string
): WebGPUBuffer {
    return new WebGPUBuffer(device, {
        size,
        usage: GPUBufferUsageFlags.INDEX | GPUBufferUsageFlags.COPY_DST,
        label: label || "Index Buffer",
    });
}

/**
 * Create uniform buffer
 */
export function createUniformBuffer(
    device: WebGPUDevice,
    size: GPUSize,
    label?: string
): WebGPUBuffer {
    return new WebGPUBuffer(device, {
        size,
        usage: GPUBufferUsageFlags.UNIFORM | GPUBufferUsageFlags.COPY_DST,
        label: label || "Uniform Buffer",
    });
}

/**
 * Create storage buffer
 */
export function createStorageBuffer(
    device: WebGPUDevice,
    size: GPUSize,
    label?: string
): WebGPUBuffer {
    return new WebGPUBuffer(device, {
        size,
        usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.COPY_DST,
        label: label || "Storage Buffer",
    });
}

/**
 * Create staging buffer for CPU→GPU uploads
 */
export function createStagingBuffer(
    device: WebGPUDevice,
    size: GPUSize,
    label?: string
): WebGPUBuffer {
    return new WebGPUBuffer(device, {
        size,
        usage: GPUBufferUsageFlags.MAP_WRITE | GPUBufferUsageFlags.COPY_SRC,
        label: label || "Staging Buffer",
    });
}

/**
 * Create readback buffer for GPU→CPU downloads
 */
export function createReadbackBuffer(
    device: WebGPUDevice,
    size: GPUSize,
    label?: string
): WebGPUBuffer {
    return new WebGPUBuffer(device, {
        size,
        usage: GPUBufferUsageFlags.MAP_READ | GPUBufferUsageFlags.COPY_DST,
        label: label || "Readback Buffer",
    });
}
