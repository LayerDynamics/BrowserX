/**
 * Staging Buffer Pool
 *
 * Manages reusable staging buffers for efficient CPU→GPU data uploads.
 * Following the BufferPool pattern from network layer, adapted for GPU buffers.
 */

import { WebGPUBuffer, createStagingBuffer } from "./Create.ts";
import type { WebGPUDevice } from "../adapter/Device.ts";
import type { GPUSize, Timestamp } from "../../../types/webgpu.ts";
import type { BufferPoolStats } from "../../../types/webgpu.ts";

// ============================================================================
// Pool Configuration
// ============================================================================

/**
 * Standard staging buffer sizes (256B to 1MB)
 * Powers of 2 for efficient alignment
 */
const STAGING_SIZES = [
    256,      // 256 B
    512,      // 512 B
    1024,     // 1 KB
    2048,     // 2 KB
    4096,     // 4 KB
    8192,     // 8 KB
    16384,    // 16 KB
    32768,    // 32 KB
    65536,    // 64 KB
    131072,   // 128 KB
    262144,   // 256 KB
    524288,   // 512 KB
    1048576,  // 1 MB
];

/**
 * Maximum buffers per size in pool
 */
const MAX_BUFFERS_PER_SIZE = 50;

/**
 * Number of buffers to pre-allocate per size
 */
const PREALLOCATE_COUNT = 5;

// ============================================================================
// Pooled Buffer Wrapper
// ============================================================================

/**
 * Wrapper for pooled staging buffer with metadata
 */
export interface PooledStagingBuffer {
    buffer: WebGPUBuffer;
    size: GPUSize;
    inUse: boolean;
    createdAt: Timestamp;
    lastUsedAt: Timestamp | null;
    useCount: number;
}

// ============================================================================
// Staging Buffer Pool
// ============================================================================

/**
 * StagingBufferPool - Manages reusable staging buffers
 *
 * Staging buffers are used for CPU→GPU data uploads. The pool
 * reuses buffers to minimize allocation overhead.
 *
 * Usage:
 * 1. acquire(size) - Get buffer from pool or create new
 * 2. Use buffer for data upload
 * 3. release(buffer) - Return buffer to pool for reuse
 */
export class StagingBufferPool {
    /** Parent device */
    private device: WebGPUDevice;

    /** Pools organized by size */
    private pools: Map<number, PooledStagingBuffer[]> = new Map();

    /** Statistics */
    private stats: BufferPoolStats;

    /** Creation timestamp */
    private readonly createdAt: Timestamp;

    constructor(device: WebGPUDevice) {
        this.device = device;
        this.createdAt = Date.now();
        this.stats = {
            poolHits: 0,
            poolMisses: 0,
            totalAcquired: 0,
            totalReleased: 0,
            currentPooled: 0,
            poolSizes: new Map(),
        };

        // Initialize pools for each standard size
        for (const size of STAGING_SIZES) {
            this.pools.set(size, []);
            this.stats.poolSizes.set(size, 0);
        }

        // Pre-allocate buffers for common sizes
        this.preallocateBuffers();
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Pre-allocate buffers for common sizes
     */
    private preallocateBuffers(): void {
        // Pre-allocate smaller sizes more aggressively
        const sizesToPreallocate = [
            { size: 256, count: PREALLOCATE_COUNT },
            { size: 512, count: PREALLOCATE_COUNT },
            { size: 1024, count: PREALLOCATE_COUNT },
            { size: 2048, count: PREALLOCATE_COUNT },
            { size: 4096, count: PREALLOCATE_COUNT },
            { size: 8192, count: 3 },
            { size: 16384, count: 3 },
            { size: 32768, count: 2 },
        ];

        for (const { size, count } of sizesToPreallocate) {
            const pool = this.pools.get(size);
            if (!pool) continue;

            for (let i = 0; i < count; i++) {
                const buffer = this.createStagingBuffer(size);
                const pooled: PooledStagingBuffer = {
                    buffer,
                    size,
                    inUse: false,
                    createdAt: Date.now(),
                    lastUsedAt: null,
                    useCount: 0,
                };
                pool.push(pooled);
                this.stats.poolSizes.set(size, pool.length);
            }
        }

        this.stats.currentPooled = this.getTotalPooledBuffers();
    }

    /**
     * Create a new staging buffer
     */
    private createStagingBuffer(size: GPUSize): WebGPUBuffer {
        return createStagingBuffer(
            this.device,
            size,
            `Staging Buffer ${size}B`
        );
    }

    // ========================================================================
    // Buffer Acquisition
    // ========================================================================

    /**
     * Acquire staging buffer of at least minSize bytes
     *
     * @param minSize - Minimum required buffer size
     * @returns Staging buffer from pool or newly created
     */
    acquire(minSize: GPUSize): WebGPUBuffer {
        this.stats.totalAcquired++;

        // Find smallest standard size >= minSize
        const size = STAGING_SIZES.find((s) => s >= minSize);

        if (!size) {
            // Requested size exceeds largest pool size
            // Allocate directly without pooling
            this.stats.poolMisses++;
            return this.createStagingBuffer(minSize);
        }

        const pool = this.pools.get(size)!;

        // Try to find available buffer in pool
        for (const pooled of pool) {
            if (!pooled.inUse) {
                // Reuse from pool
                pooled.inUse = true;
                pooled.lastUsedAt = Date.now();
                pooled.useCount++;
                this.stats.poolHits++;
                return pooled.buffer;
            }
        }

        // No available buffer in pool
        // Check if we can create a new one
        if (pool.length < MAX_BUFFERS_PER_SIZE) {
            // Create new buffer and add to pool
            const buffer = this.createStagingBuffer(size);
            const pooled: PooledStagingBuffer = {
                buffer,
                size,
                inUse: true,
                createdAt: Date.now(),
                lastUsedAt: Date.now(),
                useCount: 1,
            };
            pool.push(pooled);
            this.stats.poolSizes.set(size, pool.length);
            this.stats.currentPooled++;
            this.stats.poolMisses++;
            return buffer;
        }

        // Pool is full, allocate non-pooled buffer
        this.stats.poolMisses++;
        return this.createStagingBuffer(size);
    }

    // ========================================================================
    // Buffer Release
    // ========================================================================

    /**
     * Release buffer back to pool for reuse
     *
     * @param buffer - Buffer to release
     */
    release(buffer: WebGPUBuffer): void {
        this.stats.totalReleased++;

        const size = buffer.getSize();

        // Only pool standard sizes
        if (!STAGING_SIZES.includes(size)) {
            // Non-pooled buffer, destroy it
            buffer.destroy();
            return;
        }

        const pool = this.pools.get(size);
        if (!pool) {
            // Shouldn't happen, but handle gracefully
            buffer.destroy();
            return;
        }

        // Find buffer in pool
        const pooled = pool.find((p) => p.buffer === buffer);
        if (!pooled) {
            // Buffer not from this pool, destroy it
            buffer.destroy();
            return;
        }

        // Mark as available
        pooled.inUse = false;

        // Note: We don't clear the buffer data here because:
        // 1. GPU buffers don't expose direct data access unless mapped
        // 2. Staging buffers are write-only from CPU perspective
        // 3. Data will be overwritten on next use
    }

    // ========================================================================
    // Pool Management
    // ========================================================================

    /**
     * Trim pool by destroying least recently used buffers
     *
     * @param targetSize - Target number of buffers per size
     */
    trim(targetSize: number = PREALLOCATE_COUNT): void {
        for (const [size, pool] of this.pools.entries()) {
            // Sort by last used time (oldest first)
            const availableBuffers = pool
                .filter((p) => !p.inUse)
                .sort((a, b) => {
                    const aTime = a.lastUsedAt ?? a.createdAt;
                    const bTime = b.lastUsedAt ?? b.createdAt;
                    return aTime - bTime;
                });

            // Calculate how many to remove
            const toRemove = Math.max(0, availableBuffers.length - targetSize);

            // Remove oldest buffers
            for (let i = 0; i < toRemove; i++) {
                const pooled = availableBuffers[i];
                pooled.buffer.destroy();

                // Remove from pool
                const index = pool.indexOf(pooled);
                if (index !== -1) {
                    pool.splice(index, 1);
                }
            }

            this.stats.poolSizes.set(size, pool.length);
        }

        this.stats.currentPooled = this.getTotalPooledBuffers();
    }

    /**
     * Clear pool and destroy all buffers
     */
    clear(): void {
        for (const pool of this.pools.values()) {
            for (const pooled of pool) {
                pooled.buffer.destroy();
            }
            pool.length = 0;
        }

        // Reset statistics
        this.stats.poolHits = 0;
        this.stats.poolMisses = 0;
        this.stats.totalAcquired = 0;
        this.stats.totalReleased = 0;
        this.stats.currentPooled = 0;

        for (const size of STAGING_SIZES) {
            this.stats.poolSizes.set(size, 0);
        }
    }

    // ========================================================================
    // Statistics
    // ========================================================================

    /**
     * Get pool statistics
     */
    getStats(): BufferPoolStats {
        return {
            poolHits: this.stats.poolHits,
            poolMisses: this.stats.poolMisses,
            totalAcquired: this.stats.totalAcquired,
            totalReleased: this.stats.totalReleased,
            currentPooled: this.stats.currentPooled,
            poolSizes: new Map(this.stats.poolSizes),
        };
    }

    /**
     * Get pool hit rate (percentage)
     */
    getHitRate(): number {
        const total = this.stats.poolHits + this.stats.poolMisses;
        if (total === 0) return 0;
        return (this.stats.poolHits / total) * 100;
    }

    /**
     * Get total number of pooled buffers
     */
    private getTotalPooledBuffers(): number {
        let total = 0;
        for (const pool of this.pools.values()) {
            total += pool.length;
        }
        return total;
    }

    /**
     * Get total number of buffers in use
     */
    getInUseCount(): number {
        let count = 0;
        for (const pool of this.pools.values()) {
            for (const pooled of pool) {
                if (pooled.inUse) count++;
            }
        }
        return count;
    }

    /**
     * Get total memory allocated in pool (bytes)
     */
    getTotalMemory(): number {
        let total = 0;
        for (const pool of this.pools.values()) {
            for (const pooled of pool) {
                total += pooled.size;
            }
        }
        return total;
    }

    /**
     * Get detailed pool information
     */
    getPoolInfo(): Array<{
        size: number;
        total: number;
        inUse: number;
        available: number;
    }> {
        const info: Array<{
            size: number;
            total: number;
            inUse: number;
            available: number;
        }> = [];

        for (const [size, pool] of this.pools.entries()) {
            const inUse = pool.filter((p) => p.inUse).length;
            const available = pool.length - inUse;

            info.push({
                size,
                total: pool.length,
                inUse,
                available,
            });
        }

        return info.sort((a, b) => a.size - b.size);
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Destroy pool and release all resources
     */
    destroy(): void {
        this.clear();
        this.pools.clear();
    }
}
