/**
 * Buffer Pool for efficient memory reuse
 *
 * Manages pre-allocated Uint8Array buffers to minimize allocations
 * during network operations. Standard sizes from 1KB to 64KB.
 */

/**
 * Buffer pool statistics
 */
export interface BufferPoolStats {
  totalBuffers: number;
  available: number;
  inUse: number;
  hits: number;
  misses: number;
  totalAcquired: number;
  totalReleased: number;
  bySize: Map<number, {
    total: number;
    available: number;
    inUse: number;
    hits: number;
    misses: number;
  }>;
}

/**
 * Pool for a specific buffer size
 */
class SizePool {
  private buffers: Uint8Array[] = [];
  private inUseBuffers: Set<Uint8Array> = new Set();
  private hits = 0;
  private misses = 0;

  constructor(
    private size: number,
    private initialCount: number,
  ) {
    this.preallocate();
  }

  /**
   * Pre-allocate initial buffers
   */
  private preallocate(): void {
    for (let i = 0; i < this.initialCount; i++) {
      this.buffers.push(new Uint8Array(this.size));
    }
  }

  /**
   * Acquire a buffer from the pool
   */
  acquire(): Uint8Array {
    let buffer = this.buffers.pop();

    if (buffer) {
      this.hits++;
    } else {
      // Pool exhausted, create new buffer
      buffer = new Uint8Array(this.size);
      this.misses++;
    }

    this.inUseBuffers.add(buffer);
    return buffer;
  }

  /**
   * Release a buffer back to the pool
   */
  release(buffer: Uint8Array): boolean {
    if (!this.inUseBuffers.has(buffer)) {
      return false;
    }

    this.inUseBuffers.delete(buffer);

    // Zero out buffer for security
    buffer.fill(0);

    // Return to pool
    this.buffers.push(buffer);
    return true;
  }

  /**
   * Get statistics for this size pool
   */
  getStats() {
    return {
      total: this.buffers.length + this.inUseBuffers.size,
      available: this.buffers.length,
      inUse: this.inUseBuffers.size,
      hits: this.hits,
      misses: this.misses,
    };
  }

  /**
   * Clear all buffers
   */
  clear(): void {
    this.buffers = [];
    this.inUseBuffers.clear();
  }
}

/**
 * Main buffer pool managing multiple size pools
 */
export class BufferPool {
  // Standard buffer sizes: 1KB, 2KB, 4KB, 8KB, 16KB, 32KB, 64KB
  private static readonly STANDARD_SIZES = [
    1024,
    2048,
    4096,
    8192,
    16384,
    32768,
    65536,
  ];

  private static readonly DEFAULT_INITIAL_COUNT = 10;

  private pools: Map<number, SizePool> = new Map();
  private totalAcquired = 0;
  private totalReleased = 0;

  constructor(
    sizes: number[] = BufferPool.STANDARD_SIZES,
    initialCount = BufferPool.DEFAULT_INITIAL_COUNT,
  ) {
    // Create pools for each size
    for (const size of sizes) {
      this.pools.set(size, new SizePool(size, initialCount));
    }
  }

  /**
   * Acquire a buffer of at least minSize bytes
   * Returns the smallest buffer that fits
   */
  acquire(minSize: number): Uint8Array {
    this.totalAcquired++;

    // Find smallest size that fits
    const sizes = Array.from(this.pools.keys()).sort((a, b) => a - b);

    for (const size of sizes) {
      if (size >= minSize) {
        const pool = this.pools.get(size)!;
        return pool.acquire();
      }
    }

    // No standard size fits, create custom buffer
    return new Uint8Array(minSize);
  }

  /**
   * Release a buffer back to the pool
   */
  release(buffer: Uint8Array): boolean {
    this.totalReleased++;

    const pool = this.pools.get(buffer.length);
    if (pool) {
      return pool.release(buffer);
    }

    // Non-pooled buffer, just discard (GC will handle it)
    return false;
  }

  /**
   * Get pool statistics
   */
  getStats(): BufferPoolStats {
    let totalBuffers = 0;
    let available = 0;
    let inUse = 0;
    let hits = 0;
    let misses = 0;

    const bySize = new Map<number, {
      total: number;
      available: number;
      inUse: number;
      hits: number;
      misses: number;
    }>();

    for (const [size, pool] of this.pools.entries()) {
      const stats = pool.getStats();
      totalBuffers += stats.total;
      available += stats.available;
      inUse += stats.inUse;
      hits += stats.hits;
      misses += stats.misses;
      bySize.set(size, stats);
    }

    return {
      totalBuffers,
      available,
      inUse,
      hits,
      misses,
      totalAcquired: this.totalAcquired,
      totalReleased: this.totalReleased,
      bySize,
    };
  }

  /**
   * Clear all pools
   */
  clear(): void {
    for (const pool of this.pools.values()) {
      pool.clear();
    }
    this.totalAcquired = 0;
    this.totalReleased = 0;
  }

  /**
   * Get supported buffer sizes
   */
  getBufferSizes(): number[] {
    return Array.from(this.pools.keys()).sort((a, b) => a - b);
  }

  /**
   * Get buffers by size (returns copy of pool state)
   */
  getBuffersBySize(): Map<number, { available: number; inUse: number }> {
    const result = new Map<number, { available: number; inUse: number }>();

    for (const [size, pool] of this.pools.entries()) {
      const stats = pool.getStats();
      result.set(size, {
        available: stats.available,
        inUse: stats.inUse,
      });
    }

    return result;
  }

  /**
   * Get hit rate (0-1)
   */
  getHitRate(): number {
    const stats = this.getStats();
    const total = stats.hits + stats.misses;
    return total > 0 ? stats.hits / total : 0;
  }
}

/**
 * Global shared buffer pool instance
 */
let globalPool: BufferPool | null = null;

/**
 * Get or create the global buffer pool
 */
export function getGlobalBufferPool(): BufferPool {
  if (!globalPool) {
    globalPool = new BufferPool();
  }
  return globalPool;
}

/**
 * Set custom global buffer pool
 */
export function setGlobalBufferPool(pool: BufferPool): void {
  globalPool = pool;
}

/**
 * Convenience function to acquire buffer from global pool
 */
export function acquireBuffer(minSize: number): Uint8Array {
  return getGlobalBufferPool().acquire(minSize);
}

/**
 * Convenience function to release buffer to global pool
 */
export function releaseBuffer(buffer: Uint8Array): boolean {
  return getGlobalBufferPool().release(buffer);
}
