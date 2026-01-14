/**
 * WebGPU Memory Management
 *
 * Comprehensive memory management system integrating:
 * - Buffer pooling for reusing GPU buffers
 * - Staging ring buffer for efficient CPU→GPU uploads
 * - Memory allocator for sub-buffer allocation
 * - Memory statistics and quota tracking
 */

import type { WebGPUDevice } from "../adapter/Device.ts";
import type { WebGPUBuffer } from "../buffer/Create.ts";
import {
    createVertexBuffer,
    createIndexBuffer,
    createUniformBuffer,
    createStorageBuffer,
    createStagingBuffer,
} from "../buffer/Create.ts";
import { StagingBufferPool } from "../buffer/Staging.ts";
import type { GPUSize, ByteCount, Timestamp } from "../../../types/webgpu.ts";
import { GPUBufferUsageFlags } from "../../../types/webgpu.ts";
import { GPUMemoryError } from "../errors.ts";
import {
    calculateUniformBufferSize,
    calculateStorageBufferSize,
    alignSize,
    UNIFORM_BUFFER_ALIGNMENT,
} from "../buffer/Size.ts";

// ============================================================================
// Memory Pool Configuration
// ============================================================================

/**
 * Buffer pool configuration
 */
export interface BufferPoolConfig {
    /** Initial number of buffers per size */
    initialBuffersPerSize?: number;

    /** Maximum number of buffers per size */
    maxBuffersPerSize?: number;

    /** Enable automatic pool trimming */
    enableAutoTrim?: boolean;

    /** Trim interval in milliseconds */
    trimIntervalMs?: number;

    /** Trim idle buffers older than this threshold */
    trimIdleThresholdMs?: number;
}

/**
 * Default buffer pool configuration
 */
const DEFAULT_POOL_CONFIG: Required<BufferPoolConfig> = {
    initialBuffersPerSize: 5,
    maxBuffersPerSize: 50,
    enableAutoTrim: true,
    trimIntervalMs: 60000, // 1 minute
    trimIdleThresholdMs: 300000, // 5 minutes
};

/**
 * Standard buffer sizes for pooling (1KB to 16MB)
 */
const STANDARD_BUFFER_SIZES = [
    1024,       // 1 KB
    2048,       // 2 KB
    4096,       // 4 KB
    8192,       // 8 KB
    16384,      // 16 KB
    32768,      // 32 KB
    65536,      // 64 KB
    131072,     // 128 KB
    262144,     // 256 KB
    524288,     // 512 KB
    1048576,    // 1 MB
    2097152,    // 2 MB
    4194304,    // 4 MB
    8388608,    // 8 MB
    16777216,   // 16 MB
];

// ============================================================================
// Pooled Buffer Types
// ============================================================================

/**
 * Pooled buffer wrapper with metadata
 */
interface PooledBuffer {
    buffer: WebGPUBuffer;
    size: GPUSize;
    usage: number;
    inUse: boolean;
    createdAt: Timestamp;
    lastUsedAt: Timestamp | null;
    useCount: number;
}

/**
 * Buffer pool statistics
 */
export interface BufferPoolStatistics {
    totalBuffers: number;
    inUseBuffers: number;
    availableBuffers: number;
    totalMemory: ByteCount;
    inUseMemory: ByteCount;
    availableMemory: ByteCount;
    poolHits: number;
    poolMisses: number;
    hitRate: number;
    buffersBySize: Map<GPUSize, number>;
}

// ============================================================================
// Buffer Pool
// ============================================================================

/**
 * BufferPool - Manages reusable GPU buffers
 *
 * Pools buffers by size and usage to minimize allocation overhead.
 * Separate pools for each usage type (VERTEX, INDEX, UNIFORM, STORAGE).
 */
export class BufferPool {
    private device: WebGPUDevice;
    private config: Required<BufferPoolConfig>;

    /** Pools organized by usage and size */
    private pools: Map<number, Map<GPUSize, PooledBuffer[]>> = new Map();

    /** Statistics */
    private stats = {
        poolHits: 0,
        poolMisses: 0,
        totalAcquired: 0,
        totalReleased: 0,
    };

    /** Trim interval handle */
    private trimInterval: number | null = null;

    constructor(device: WebGPUDevice, config: BufferPoolConfig = {}) {
        this.device = device;
        this.config = { ...DEFAULT_POOL_CONFIG, ...config };

        // Initialize pools for common usage types
        this.initializePools();

        // Setup automatic trimming
        if (this.config.enableAutoTrim) {
            this.startAutoTrim();
        }
    }

    /**
     * Initialize pools for standard buffer usages
     */
    private initializePools(): void {
        const usageTypes = [
            GPUBufferUsageFlags.VERTEX | GPUBufferUsageFlags.COPY_DST,
            GPUBufferUsageFlags.INDEX | GPUBufferUsageFlags.COPY_DST,
            GPUBufferUsageFlags.UNIFORM | GPUBufferUsageFlags.COPY_DST,
            GPUBufferUsageFlags.STORAGE |
            GPUBufferUsageFlags.COPY_DST |
            GPUBufferUsageFlags.COPY_SRC,
        ];

        for (const usage of usageTypes) {
            const sizeMap = new Map<GPUSize, PooledBuffer[]>();

            for (const size of STANDARD_BUFFER_SIZES) {
                sizeMap.set(size as GPUSize, []);
            }

            this.pools.set(usage, sizeMap);
        }
    }

    /**
     * Acquire buffer from pool
     *
     * @param size - Minimum required size
     * @param usage - Buffer usage flags
     * @param label - Optional buffer label
     * @returns Buffer from pool or newly created
     */
    acquire(size: GPUSize, usage: number, label?: string): WebGPUBuffer {
        this.stats.totalAcquired++;

        // Find smallest standard size >= requested size
        const poolSize = STANDARD_BUFFER_SIZES.find((s) => s >= size);

        if (!poolSize) {
            // Size exceeds largest pool size, allocate directly
            this.stats.poolMisses++;
            return this.createBuffer(size, usage, label);
        }

        // Get pool for usage type
        const sizeMap = this.pools.get(usage);

        if (!sizeMap) {
            // No pool for this usage, allocate directly
            this.stats.poolMisses++;
            return this.createBuffer(size, usage, label);
        }

        const pool = sizeMap.get(poolSize as GPUSize);

        if (!pool) {
            // No pool for this size, allocate directly
            this.stats.poolMisses++;
            return this.createBuffer(size, usage, label);
        }

        // Try to find available buffer
        for (const pooled of pool) {
            if (!pooled.inUse) {
                pooled.inUse = true;
                pooled.lastUsedAt = Date.now();
                pooled.useCount++;
                this.stats.poolHits++;
                return pooled.buffer;
            }
        }

        // No available buffer, check if we can create new one
        if (pool.length < this.config.maxBuffersPerSize) {
            const buffer = this.createBuffer(poolSize as GPUSize, usage, label);
            const pooled: PooledBuffer = {
                buffer,
                size: poolSize as GPUSize,
                usage,
                inUse: true,
                createdAt: Date.now(),
                lastUsedAt: Date.now(),
                useCount: 1,
            };

            pool.push(pooled);
            this.stats.poolMisses++;
            return buffer;
        }

        // Pool exhausted, allocate non-pooled buffer
        this.stats.poolMisses++;
        return this.createBuffer(size, usage, label);
    }

    /**
     * Release buffer back to pool
     *
     * @param buffer - Buffer to release
     */
    release(buffer: WebGPUBuffer): void {
        this.stats.totalReleased++;

        const size = buffer.getSize();
        const usage = buffer.getUsage();

        // Check if size is pooled
        if (!STANDARD_BUFFER_SIZES.includes(size)) {
            buffer.destroy();
            return;
        }

        // Get pool
        const sizeMap = this.pools.get(usage);

        if (!sizeMap) {
            buffer.destroy();
            return;
        }

        const pool = sizeMap.get(size);

        if (!pool) {
            buffer.destroy();
            return;
        }

        // Find buffer in pool
        const pooled = pool.find((p) => p.buffer === buffer);

        if (!pooled) {
            buffer.destroy();
            return;
        }

        // Mark as available
        pooled.inUse = false;
    }

    /**
     * Create buffer based on usage
     */
    private createBuffer(
        size: GPUSize,
        usage: number,
        label?: string,
    ): WebGPUBuffer {
        // Determine primary usage
        if (usage & GPUBufferUsageFlags.VERTEX) {
            return createVertexBuffer(this.device, size, label);
        } else if (usage & GPUBufferUsageFlags.INDEX) {
            return createIndexBuffer(this.device, size, label);
        } else if (usage & GPUBufferUsageFlags.UNIFORM) {
            return createUniformBuffer(this.device, size, label);
        } else if (usage & GPUBufferUsageFlags.STORAGE) {
            return createStorageBuffer(this.device, size, label);
        } else {
            // Generic buffer
            return createStagingBuffer(this.device, size, label);
        }
    }

    /**
     * Trim pool by removing idle buffers
     */
    trim(): void {
        const now = Date.now();
        const threshold = this.config.trimIdleThresholdMs;

        for (const sizeMap of this.pools.values()) {
            for (const pool of sizeMap.values()) {
                // Find idle buffers to remove
                const toRemove: PooledBuffer[] = [];

                for (const pooled of pool) {
                    if (pooled.inUse) continue;

                    const idleTime = now - (pooled.lastUsedAt ?? pooled.createdAt);

                    if (idleTime > threshold) {
                        toRemove.push(pooled);
                    }
                }

                // Remove idle buffers
                for (const pooled of toRemove) {
                    pooled.buffer.destroy();

                    const index = pool.indexOf(pooled);
                    if (index !== -1) {
                        pool.splice(index, 1);
                    }
                }
            }
        }
    }

    /**
     * Start automatic trimming
     */
    private startAutoTrim(): void {
        this.trimInterval = setInterval(() => {
            this.trim();
        }, this.config.trimIntervalMs) as unknown as number;
    }

    /**
     * Stop automatic trimming
     */
    private stopAutoTrim(): void {
        if (this.trimInterval !== null) {
            clearInterval(this.trimInterval);
            this.trimInterval = null;
        }
    }

    /**
     * Get pool statistics
     */
    getStatistics(): BufferPoolStatistics {
        let totalBuffers = 0;
        let inUseBuffers = 0;
        let totalMemory = 0 as ByteCount;
        let inUseMemory = 0 as ByteCount;
        const buffersBySize = new Map<GPUSize, number>();

        for (const sizeMap of this.pools.values()) {
            for (const [size, pool] of sizeMap.entries()) {
                totalBuffers += pool.length;

                const inUse = pool.filter((p) => p.inUse).length;
                inUseBuffers += inUse;

                const sizeBytes = size;
                totalMemory = (totalMemory + pool.length * sizeBytes) as ByteCount;
                inUseMemory = (inUseMemory + inUse * sizeBytes) as ByteCount;

                buffersBySize.set(size, (buffersBySize.get(size) || 0) + pool.length);
            }
        }

        const total = this.stats.poolHits + this.stats.poolMisses;
        const hitRate = total > 0 ? (this.stats.poolHits / total) * 100 : 0;

        return {
            totalBuffers,
            inUseBuffers,
            availableBuffers: totalBuffers - inUseBuffers,
            totalMemory,
            inUseMemory,
            availableMemory: (totalMemory - inUseMemory) as ByteCount,
            poolHits: this.stats.poolHits,
            poolMisses: this.stats.poolMisses,
            hitRate,
            buffersBySize,
        };
    }

    /**
     * Clear all pools
     */
    clear(): void {
        for (const sizeMap of this.pools.values()) {
            for (const pool of sizeMap.values()) {
                for (const pooled of pool) {
                    pooled.buffer.destroy();
                }
                pool.length = 0;
            }
        }

        this.stats.poolHits = 0;
        this.stats.poolMisses = 0;
        this.stats.totalAcquired = 0;
        this.stats.totalReleased = 0;
    }

    /**
     * Destroy pool
     */
    destroy(): void {
        this.stopAutoTrim();
        this.clear();
        this.pools.clear();
    }
}

// ============================================================================
// Staging Ring Buffer
// ============================================================================

/**
 * Staging ring buffer configuration
 */
export interface StagingRingConfig {
    /** Ring buffer size */
    size?: GPUSize;

    /** Number of frames to buffer */
    frameCount?: number;
}

/**
 * Default staging ring configuration
 */
const DEFAULT_RING_CONFIG: Required<StagingRingConfig> = {
    size: (16 * 1024 * 1024) as GPUSize, // 16 MB
    frameCount: 3, // Triple buffering
};

/**
 * Staging ring allocation
 */
interface StagingAllocation {
    buffer: WebGPUBuffer;
    offset: GPUSize;
    size: GPUSize;
    frameIndex: number;
}

/**
 * StagingRing - Ring buffer for efficient CPU→GPU uploads
 *
 * Maintains circular buffer of staging memory. Allocations are
 * frame-based and automatically recycled after frameCount frames.
 */
export class StagingRing {
    private device: WebGPUDevice;
    private config: Required<StagingRingConfig>;

    /** Ring buffers (one per frame) */
    private ringBuffers: WebGPUBuffer[] = [];

    /** Current frame index */
    private currentFrame = 0;

    /** Current offset in current frame's buffer */
    private currentOffset: GPUSize = 0 as GPUSize;

    /** Active allocations per frame */
    private allocations: Map<number, StagingAllocation[]> = new Map();

    constructor(device: WebGPUDevice, config: StagingRingConfig = {}) {
        this.device = device;
        this.config = { ...DEFAULT_RING_CONFIG, ...config };

        // Create ring buffers
        for (let i = 0; i < this.config.frameCount; i++) {
            const buffer = createStagingBuffer(
                this.device,
                this.config.size,
                `Staging Ring Buffer ${i}`,
            );

            this.ringBuffers.push(buffer);
            this.allocations.set(i, []);
        }
    }

    /**
     * Allocate staging memory
     *
     * @param size - Size in bytes
     * @param alignment - Alignment requirement
     * @returns Staging allocation
     */
    allocate(size: GPUSize, alignment = 4): StagingAllocation {
        // Align offset
        this.currentOffset = alignSize(this.currentOffset, alignment);

        // Check if allocation fits in current frame
        if (this.currentOffset + size > this.config.size) {
            // Advance to next frame
            this.advanceFrame();

            // Realign after advancing
            this.currentOffset = alignSize(0 as GPUSize, alignment);

            // Check if still doesn't fit
            if (this.currentOffset + size > this.config.size) {
                throw new GPUMemoryError(
                    `Allocation of ${size} bytes exceeds ring buffer size ${this.config.size}`,
                    {
                        code: "GPU_STAGING_RING_EXHAUSTED",
                        requestedSize: size,
                        ringBufferSize: this.config.size,
                    },
                );
            }
        }

        // Create allocation
        const allocation: StagingAllocation = {
            buffer: this.ringBuffers[this.currentFrame],
            offset: this.currentOffset,
            size,
            frameIndex: this.currentFrame,
        };

        // Track allocation
        this.allocations.get(this.currentFrame)!.push(allocation);

        // Advance offset
        this.currentOffset = (this.currentOffset + size) as GPUSize;

        return allocation;
    }

    /**
     * Advance to next frame
     */
    advanceFrame(): void {
        // Move to next frame
        this.currentFrame = (this.currentFrame + 1) % this.config.frameCount;

        // Reset offset
        this.currentOffset = 0 as GPUSize;

        // Clear allocations for this frame (they're now expired)
        this.allocations.set(this.currentFrame, []);
    }

    /**
     * Get current frame index
     */
    getCurrentFrame(): number {
        return this.currentFrame;
    }

    /**
     * Get ring buffer size
     */
    getSize(): GPUSize {
        return this.config.size;
    }

    /**
     * Get frame count
     */
    getFrameCount(): number {
        return this.config.frameCount;
    }

    /**
     * Destroy staging ring
     */
    destroy(): void {
        for (const buffer of this.ringBuffers) {
            buffer.destroy();
        }

        this.ringBuffers = [];
        this.allocations.clear();
    }
}

// ============================================================================
// Memory Allocator
// ============================================================================

/**
 * Memory block in allocator
 */
interface MemoryBlock {
    offset: GPUSize;
    size: GPUSize;
    free: boolean;
    allocationId?: number;
}

/**
 * Memory allocator configuration
 */
export interface MemoryAllocatorConfig {
    /** Total allocator size */
    size: GPUSize;

    /** Buffer usage flags */
    usage: number;

    /** Minimum allocation size */
    minAllocationSize?: GPUSize;

    /** Enable block coalescing */
    enableCoalescing?: boolean;
}

/**
 * Memory allocation handle
 */
export interface MemoryAllocation {
    id: number;
    offset: GPUSize;
    size: GPUSize;
    buffer: WebGPUBuffer;
}

/**
 * MemoryAllocator - Sub-buffer allocator
 *
 * Allocates portions of larger buffer to minimize buffer count.
 * Uses best-fit allocation strategy with block coalescing.
 */
export class MemoryAllocator {
    private device: WebGPUDevice;
    private config: Required<Omit<MemoryAllocatorConfig, "size" | "usage">> & {
        size: GPUSize;
        usage: number;
    };

    /** Backing buffer */
    private buffer: WebGPUBuffer;

    /** Free blocks list */
    private blocks: MemoryBlock[] = [];

    /** Next allocation ID */
    private nextAllocationId = 1;

    /** Active allocations */
    private allocations: Map<number, MemoryAllocation> = new Map();

    constructor(device: WebGPUDevice, config: MemoryAllocatorConfig) {
        this.device = device;
        this.config = {
            size: config.size,
            usage: config.usage,
            minAllocationSize: config.minAllocationSize ?? (256 as GPUSize),
            enableCoalescing: config.enableCoalescing ?? true,
        };

        // Create backing buffer
        this.buffer = this.createBackingBuffer();

        // Initialize with single free block
        this.blocks.push({
            offset: 0 as GPUSize,
            size: this.config.size,
            free: true,
        });
    }

    /**
     * Create backing buffer
     */
    private createBackingBuffer(): WebGPUBuffer {
        const usage = this.config.usage;

        if (usage & GPUBufferUsageFlags.UNIFORM) {
            return createUniformBuffer(
                this.device,
                this.config.size,
                "Memory Allocator Buffer (Uniform)",
            );
        } else if (usage & GPUBufferUsageFlags.STORAGE) {
            return createStorageBuffer(
                this.device,
                this.config.size,
                "Memory Allocator Buffer (Storage)",
            );
        } else if (usage & GPUBufferUsageFlags.VERTEX) {
            return createVertexBuffer(
                this.device,
                this.config.size,
                "Memory Allocator Buffer (Vertex)",
            );
        } else {
            return createStorageBuffer(
                this.device,
                this.config.size,
                "Memory Allocator Buffer (Generic)",
            );
        }
    }

    /**
     * Allocate memory
     *
     * @param size - Size in bytes
     * @param alignment - Alignment requirement
     * @returns Memory allocation
     */
    allocate(size: GPUSize, alignment = 256): MemoryAllocation | null {
        // Enforce minimum allocation size
        const allocSize = Math.max(size, this.config.minAllocationSize) as GPUSize;

        // Find best-fit free block
        let bestBlock: MemoryBlock | null = null;
        let bestBlockIndex = -1;
        let bestWaste = Infinity;

        for (let i = 0; i < this.blocks.length; i++) {
            const block = this.blocks[i];

            if (!block.free) continue;

            // Calculate aligned offset
            const alignedOffset = alignSize(block.offset, alignment);
            const alignmentPadding = alignedOffset - block.offset;

            // Check if block can fit allocation
            if (block.size >= allocSize + alignmentPadding) {
                const waste = block.size - allocSize - alignmentPadding;

                if (waste < bestWaste) {
                    bestBlock = block;
                    bestBlockIndex = i;
                    bestWaste = waste;

                    // Perfect fit, stop searching
                    if (waste === 0 && alignmentPadding === 0) {
                        break;
                    }
                }
            }
        }

        if (!bestBlock) {
            // No suitable block found
            return null;
        }

        // Calculate aligned offset
        const alignedOffset = alignSize(bestBlock.offset, alignment);
        const alignmentPadding = alignedOffset - bestBlock.offset;

        // Create allocation ID
        const allocationId = this.nextAllocationId++;

        // Split block if needed
        if (alignmentPadding > 0) {
            // Insert padding block before allocation
            this.blocks.splice(bestBlockIndex, 0, {
                offset: bestBlock.offset,
                size: alignmentPadding as GPUSize,
                free: true,
            });

            bestBlockIndex++;
            bestBlock.offset = alignedOffset;
            bestBlock.size = (bestBlock.size - alignmentPadding) as GPUSize;
        }

        if (bestBlock.size > allocSize) {
            // Split block
            const remainder: MemoryBlock = {
                offset: (alignedOffset + allocSize) as GPUSize,
                size: (bestBlock.size - allocSize) as GPUSize,
                free: true,
            };

            bestBlock.size = allocSize;

            this.blocks.splice(bestBlockIndex + 1, 0, remainder);
        }

        // Mark block as used
        bestBlock.free = false;
        bestBlock.allocationId = allocationId;

        // Create allocation
        const allocation: MemoryAllocation = {
            id: allocationId,
            offset: alignedOffset,
            size: allocSize,
            buffer: this.buffer,
        };

        this.allocations.set(allocationId, allocation);

        return allocation;
    }

    /**
     * Free allocation
     *
     * @param allocation - Allocation to free
     */
    free(allocation: MemoryAllocation): void {
        // Find block
        const blockIndex = this.blocks.findIndex(
            (b) => b.allocationId === allocation.id,
        );

        if (blockIndex === -1) {
            throw new GPUMemoryError(
                `Invalid allocation ID ${allocation.id}`,
                {
                    code: "GPU_MEMORY_INVALID_FREE",
                    allocationId: allocation.id,
                },
            );
        }

        // Mark block as free
        const block = this.blocks[blockIndex];
        block.free = true;
        block.allocationId = undefined;

        // Remove from allocations
        this.allocations.delete(allocation.id);

        // Coalesce adjacent free blocks
        if (this.config.enableCoalescing) {
            this.coalesceBlocks(blockIndex);
        }
    }

    /**
     * Coalesce adjacent free blocks
     */
    private coalesceBlocks(startIndex: number): void {
        let index = startIndex;

        // Coalesce with next blocks
        while (index < this.blocks.length - 1) {
            const current = this.blocks[index];
            const next = this.blocks[index + 1];

            if (current.free && next.free) {
                // Merge blocks
                current.size = (current.size + next.size) as GPUSize;
                this.blocks.splice(index + 1, 1);
            } else {
                break;
            }
        }

        // Coalesce with previous blocks
        while (index > 0) {
            const current = this.blocks[index];
            const prev = this.blocks[index - 1];

            if (current.free && prev.free) {
                // Merge blocks
                prev.size = (prev.size + current.size) as GPUSize;
                this.blocks.splice(index, 1);
                index--;
            } else {
                break;
            }
        }
    }

    /**
     * Get fragmentation percentage
     */
    getFragmentation(): number {
        const freeBlocks = this.blocks.filter((b) => b.free);

        if (freeBlocks.length <= 1) {
            return 0;
        }

        return ((freeBlocks.length - 1) / this.blocks.length) * 100;
    }

    /**
     * Get memory usage
     */
    getUsage(): {
        total: ByteCount;
        used: ByteCount;
        free: ByteCount;
        allocations: number;
        blocks: number;
        fragmentation: number;
    } {
        const used = this.blocks
            .filter((b) => !b.free)
            .reduce((sum, b) => sum + b.size, 0) as ByteCount;

        const free = (this.config.size - used) as ByteCount;

        return {
            total: this.config.size as ByteCount,
            used,
            free,
            allocations: this.allocations.size,
            blocks: this.blocks.length,
            fragmentation: this.getFragmentation(),
        };
    }

    /**
     * Clear all allocations
     */
    clear(): void {
        this.allocations.clear();
        this.blocks = [{
            offset: 0 as GPUSize,
            size: this.config.size,
            free: true,
        }];
        this.nextAllocationId = 1;
    }

    /**
     * Destroy allocator
     */
    destroy(): void {
        this.clear();
        this.buffer.destroy();
    }
}

// ============================================================================
// Unified Memory Manager
// ============================================================================

/**
 * Memory manager configuration
 */
export interface MemoryManagerConfig {
    /** Buffer pool configuration */
    bufferPool?: BufferPoolConfig;

    /** Staging ring configuration */
    stagingRing?: StagingRingConfig;

    /** Enable staging buffer pool */
    enableStagingPool?: boolean;
}

/**
 * MemoryManager - Unified memory management
 *
 * Integrates:
 * - Buffer pooling for reusable GPU buffers
 * - Staging ring for efficient uploads
 * - Staging buffer pool for one-off uploads
 */
export class MemoryManager {
    private device: WebGPUDevice;

    /** Buffer pool */
    public readonly bufferPool: BufferPool;

    /** Staging ring buffer */
    public readonly stagingRing: StagingRing;

    /** Staging buffer pool (optional) */
    public readonly stagingPool: StagingBufferPool | null;

    constructor(device: WebGPUDevice, config: MemoryManagerConfig = {}) {
        this.device = device;

        this.bufferPool = new BufferPool(device, config.bufferPool);
        this.stagingRing = new StagingRing(device, config.stagingRing);

        this.stagingPool = config.enableStagingPool !== false
            ? new StagingBufferPool(device)
            : null;
    }

    /**
     * Acquire buffer from pool
     */
    acquireBuffer(size: GPUSize, usage: number, label?: string): WebGPUBuffer {
        return this.bufferPool.acquire(size, usage, label);
    }

    /**
     * Release buffer to pool
     */
    releaseBuffer(buffer: WebGPUBuffer): void {
        this.bufferPool.release(buffer);
    }

    /**
     * Allocate staging memory from ring
     */
    allocateStaging(size: GPUSize, alignment?: number): StagingAllocation {
        return this.stagingRing.allocate(size, alignment);
    }

    /**
     * Advance staging ring frame
     */
    advanceStagingFrame(): void {
        this.stagingRing.advanceFrame();
    }

    /**
     * Get unified statistics
     */
    getStatistics(): {
        bufferPool: BufferPoolStatistics;
        stagingRing: {
            size: GPUSize;
            frameCount: number;
            currentFrame: number;
        };
    } {
        return {
            bufferPool: this.bufferPool.getStatistics(),
            stagingRing: {
                size: this.stagingRing.getSize(),
                frameCount: this.stagingRing.getFrameCount(),
                currentFrame: this.stagingRing.getCurrentFrame(),
            },
        };
    }

    /**
     * Destroy memory manager
     */
    destroy(): void {
        this.bufferPool.destroy();
        this.stagingRing.destroy();
        this.stagingPool?.destroy();
    }
}
