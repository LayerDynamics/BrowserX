/**
 * Query cache manager with LRU eviction, TTL expiration, and size tracking
 */

import type { Bytes, DurationMs, Timestamp } from "../types/primitives.ts";
import type { CacheConfig, CacheEntryMetadata, CacheStats, EvictionPolicy } from "./types.ts";

/**
 * Cache entry with value and metadata
 */
class CacheEntry<T = unknown> {
  value: T;
  metadata: CacheEntryMetadata;

  // For LRU doubly-linked list
  prev: CacheEntry<T> | null = null;
  next: CacheEntry<T> | null = null;

  constructor(value: T, ttl: DurationMs, size: Bytes) {
    const now = Date.now();
    this.value = value;
    this.metadata = {
      createdAt: now,
      accessedAt: now,
      accessCount: 0,
      size,
      ttl,
      expiresAt: now + ttl,
    };
  }

  /**
   * Check if entry is expired
   */
  isExpired(): boolean {
    return Date.now() > this.metadata.expiresAt;
  }

  /**
   * Update access metadata
   */
  touch(): void {
    this.metadata.accessedAt = Date.now();
    this.metadata.accessCount++;
  }
}

/**
 * Query cache manager with configurable eviction policy
 *
 * Supports:
 * - LRU (Least Recently Used) eviction
 * - LFU (Least Frequently Used) eviction
 * - FIFO (First In First Out) eviction
 * - TTL-based expiration
 * - Size-based limits
 * - Automatic cleanup of expired entries
 */
export class QueryCacheManager {
  private readonly config: Required<CacheConfig>;
  private readonly entries: Map<string, CacheEntry>;

  // LRU doubly-linked list
  private head: CacheEntry | null = null;
  private tail: CacheEntry | null = null;

  // Stats tracking
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    currentSize: 0,
    maxSize: 0,
    entryCount: 0,
    hitRate: 0,
  };

  // Cleanup interval timer
  private cleanupTimer: number | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize ?? 100 * 1024 * 1024, // 100MB default
      maxEntries: config.maxEntries ?? 1000,
      defaultTTL: config.defaultTTL ?? 5 * 60 * 1000, // 5 minutes
      maxTTL: config.maxTTL ?? 60 * 60 * 1000, // 1 hour
      evictionPolicy: config.evictionPolicy ?? "LRU",
      cleanupInterval: config.cleanupInterval ?? 60 * 1000, // 1 minute
    };

    this.entries = new Map();
    this.stats.maxSize = this.config.maxSize;

    // Start cleanup timer
    this.startCleanup();
  }

  /**
   * Get value from cache
   */
  get<T = unknown>(key: string): T | null {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check if expired
    if (entry.isExpired()) {
      this.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access metadata
    entry.touch();

    // Move to front for LRU
    if (this.config.evictionPolicy === "LRU") {
      this.moveToFront(entry);
    }

    this.stats.hits++;
    this.updateHitRate();

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: unknown, ttl?: DurationMs): void {
    // Use provided TTL or default
    const entryTTL = Math.min(
      ttl ?? this.config.defaultTTL,
      this.config.maxTTL,
    );

    // Calculate size (rough estimate)
    const size = this.estimateSize(value);

    // Check if entry already exists
    if (this.entries.has(key)) {
      this.delete(key);
    }

    // Evict if needed
    while (
      (this.entries.size >= this.config.maxEntries ||
        this.stats.currentSize + size > this.config.maxSize) &&
      this.entries.size > 0
    ) {
      this.evictOne();
    }

    // Create and add entry
    const entry = new CacheEntry(value, entryTTL, size);
    this.entries.set(key, entry);
    this.stats.currentSize += size;
    this.stats.entryCount = this.entries.size;

    // Add to LRU list
    if (this.config.evictionPolicy === "LRU") {
      this.addToFront(entry);
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.isExpired()) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;

    // Remove from map
    this.entries.delete(key);
    this.stats.currentSize -= entry.metadata.size;
    this.stats.entryCount = this.entries.size;

    // Remove from LRU list
    if (this.config.evictionPolicy === "LRU") {
      this.removeFromList(entry);
    }

    return true;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
    this.head = null;
    this.tail = null;
    this.stats.currentSize = 0;
    this.stats.entryCount = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get number of entries
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.isExpired()) {
        this.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Evict one entry based on policy
   */
  private evictOne(): void {
    let keyToEvict: string | null = null;

    switch (this.config.evictionPolicy) {
      case "LRU":
        // Evict tail (least recently used)
        if (this.tail) {
          keyToEvict = this.findKeyForEntry(this.tail);
        }
        break;

      case "LFU":
        // Evict least frequently used
        keyToEvict = this.findLFUKey();
        break;

      case "FIFO":
        // Evict oldest
        keyToEvict = this.findOldestKey();
        break;
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
      this.stats.evictions++;
    }
  }

  /**
   * Find key for given entry (reverse lookup)
   */
  private findKeyForEntry(entry: CacheEntry): string | null {
    for (const [key, e] of this.entries) {
      if (e === entry) return key;
    }
    return null;
  }

  /**
   * Find least frequently used key
   */
  private findLFUKey(): string | null {
    let minCount = Infinity;
    let lfuKey: string | null = null;

    for (const [key, entry] of this.entries) {
      if (entry.metadata.accessCount < minCount) {
        minCount = entry.metadata.accessCount;
        lfuKey = key;
      }
    }

    return lfuKey;
  }

  /**
   * Find oldest key (FIFO)
   */
  private findOldestKey(): string | null {
    let oldestTime = Infinity;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.entries) {
      if (entry.metadata.createdAt < oldestTime) {
        oldestTime = entry.metadata.createdAt;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Add entry to front of LRU list
   */
  private addToFront(entry: CacheEntry): void {
    entry.next = this.head;
    entry.prev = null;

    if (this.head) {
      this.head.prev = entry;
    }

    this.head = entry;

    if (!this.tail) {
      this.tail = entry;
    }
  }

  /**
   * Move entry to front of LRU list
   */
  private moveToFront(entry: CacheEntry): void {
    if (entry === this.head) return;

    this.removeFromList(entry);
    this.addToFront(entry);
  }

  /**
   * Remove entry from LRU list
   */
  private removeFromList(entry: CacheEntry): void {
    if (entry.prev) {
      entry.prev.next = entry.next;
    } else {
      this.head = entry.next;
    }

    if (entry.next) {
      entry.next.prev = entry.prev;
    } else {
      this.tail = entry.prev;
    }

    entry.prev = null;
    entry.next = null;
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: unknown): Bytes {
    if (value === null || value === undefined) return 8;

    const type = typeof value;

    switch (type) {
      case "boolean":
        return 4;
      case "number":
        return 8;
      case "string":
        return (value as string).length * 2; // UTF-16
      case "object":
        if (value instanceof Uint8Array) {
          return value.byteLength;
        }
        // Rough estimate for objects
        return JSON.stringify(value).length * 2;
      default:
        return 64; // Unknown, conservative estimate
    }
  }

  /**
   * Update hit rate statistic
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Get cache configuration
   */
  getConfig(): Required<CacheConfig> {
    return { ...this.config };
  }

  /**
   * Get all cache entries (returns copy of keys and metadata)
   */
  getEntries(): Array<{ key: string; metadata: CacheEntryMetadata }> {
    const entries: Array<{ key: string; metadata: CacheEntryMetadata }> = [];
    for (const [key, entry] of this.entries) {
      entries.push({
        key,
        metadata: { ...entry.metadata },
      });
    }
    return entries;
  }

  /**
   * Get maximum cache size in bytes
   */
  getMaxSize(): Bytes {
    return this.config.maxSize;
  }

  /**
   * Get maximum number of entries
   */
  getMaxEntries(): number {
    return this.config.maxEntries;
  }

  /**
   * Get default TTL in milliseconds
   */
  getDefaultTTL(): DurationMs {
    return this.config.defaultTTL;
  }

  /**
   * Get maximum TTL in milliseconds
   */
  getMaxTTL(): DurationMs {
    return this.config.maxTTL;
  }

  /**
   * Get eviction policy
   */
  getEvictionPolicy(): EvictionPolicy {
    return this.config.evictionPolicy;
  }

  /**
   * Get cleanup interval in milliseconds
   */
  getCleanupInterval(): DurationMs {
    return this.config.cleanupInterval;
  }

  /**
   * Get current size in bytes
   */
  getCurrentSize(): Bytes {
    return this.stats.currentSize;
  }

  /**
   * Get entry count
   */
  getEntryCount(): number {
    return this.stats.entryCount;
  }
}
