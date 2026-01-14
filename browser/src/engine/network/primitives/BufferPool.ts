/**
 * Buffer pool for reusing byte buffers
 *
 * Provides efficient buffer allocation/deallocation by reusing buffers
 * instead of constantly allocating and garbage collecting.
 */

import type { ByteBuffer } from "../../../types/identifiers.ts";

/**
 * Buffer pool statistics
 */
export interface BufferPoolStats {
    totalAllocated: number;
    totalReleased: number;
    currentInUse: number;
    hits: number; // Reused from pool
    misses: number; // Had to allocate new
}

/**
 * Buffer Pool - Efficient buffer reuse
 *
 * Maintains pools of standard-sized buffers to avoid repeated allocation.
 */
export class BufferPool {
    private pools: Map<number, ByteBuffer[]> = new Map();
    private stats: BufferPoolStats;

    // Standard buffer sizes (power of 2)
    private static SIZES = [1024, 2048, 4096, 8192, 16384, 32768, 65536];

    constructor() {
        this.stats = {
            totalAllocated: 0,
            totalReleased: 0,
            currentInUse: 0,
            hits: 0,
            misses: 0,
        };

        // Pre-allocate some buffers for common sizes
        for (const size of BufferPool.SIZES) {
            this.pools.set(size, []);
            // Pre-allocate 10 buffers of each size
            for (let i = 0; i < 10; i++) {
                this.pools.get(size)!.push(new Uint8Array(size));
            }
        }
    }

    /**
     * Acquire buffer of at least minSize bytes
     * @param minSize - Minimum buffer size needed
     * @returns Buffer from pool or newly allocated
     */
    acquire(minSize: number): ByteBuffer {
        // Find smallest buffer size >= minSize
        const size = BufferPool.SIZES.find((s) => s >= minSize);

        if (!size) {
            // Size exceeds largest pool size, allocate directly
            this.stats.misses++;
            this.stats.totalAllocated++;
            this.stats.currentInUse++;
            return new Uint8Array(minSize);
        }

        const pool = this.pools.get(size)!;

        if (pool.length > 0) {
            // Reuse from pool
            this.stats.hits++;
            this.stats.currentInUse++;
            return pool.pop()!;
        } else {
            // Pool empty, allocate new
            this.stats.misses++;
            this.stats.totalAllocated++;
            this.stats.currentInUse++;
            return new Uint8Array(size);
        }
    }

    /**
     * Release buffer back to pool for reuse
     * @param buffer - Buffer to release
     */
    release(buffer: ByteBuffer): void {
        const size = buffer.byteLength;

        // Only pool standard sizes
        if (BufferPool.SIZES.includes(size)) {
            const pool = this.pools.get(size)!;

            // Limit pool size to prevent memory bloat
            if (pool.length < 100) {
                // Clear buffer before returning to pool (security)
                buffer.fill(0);
                pool.push(buffer);
            }
        }

        this.stats.totalReleased++;
        this.stats.currentInUse--;
    }

    /**
     * Get pool statistics
     */
    getStats(): BufferPoolStats {
        return { ...this.stats };
    }

    /**
     * Get hit rate (percentage of acquires from pool)
     */
    getHitRate(): number {
        const total = this.stats.hits + this.stats.misses;
        if (total === 0) return 0;
        return (this.stats.hits / total) * 100;
    }

    /**
     * Clear all pools (for testing/cleanup)
     */
    clear(): void {
        for (const pool of this.pools.values()) {
            pool.length = 0;
        }
        this.stats = {
            totalAllocated: 0,
            totalReleased: 0,
            currentInUse: 0,
            hits: 0,
            misses: 0,
        };
    }
}
