/**
 * Cache Index
 *
 * Indexing structures for efficient cache lookups
 */

/**
 * Cache index entry
 */
export interface CacheIndexEntry {
  key: string;
  size: number;
  storedAt: number;
  expiresAt?: number;
  accessCount: number;
  lastAccessedAt: number;
  tags: string[];
}

/**
 * Cache index for fast lookups and queries
 */
export class CacheIndex {
  private _entries = new Map<string, CacheIndexEntry>();
  private tagIndex = new Map<string, Set<string>>(); // tag -> Set<key>
  private sizeIndex: string[] = []; // keys sorted by size
  private timeIndex: string[] = []; // keys sorted by access time
  private needsSort = false;

  /**
   * Add entry to index
   */
  add(key: string, entry: CacheIndexEntry): void {
    this._entries.set(key, entry);

    // Update tag index
    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }

    // Mark indices as needing sort
    this.sizeIndex.push(key);
    this.timeIndex.push(key);
    this.needsSort = true;
  }

  /**
   * Remove entry from index
   */
  remove(key: string): boolean {
    const entry = this._entries.get(key);
    if (!entry) {
      return false;
    }

    // Remove from main index
    this._entries.delete(key);

    // Remove from tag index
    for (const tag of entry.tags) {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) {
        tagSet.delete(key);
        if (tagSet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    // Remove from sorted indices
    const sizeIdx = this.sizeIndex.indexOf(key);
    if (sizeIdx !== -1) {
      this.sizeIndex.splice(sizeIdx, 1);
    }

    const timeIdx = this.timeIndex.indexOf(key);
    if (timeIdx !== -1) {
      this.timeIndex.splice(timeIdx, 1);
    }

    return true;
  }

  /**
   * Get entry from index
   */
  get(key: string): CacheIndexEntry | undefined {
    return this._entries.get(key);
  }

  /**
   * Update entry metadata
   */
  update(key: string, updates: Partial<CacheIndexEntry>): boolean {
    const entry = this._entries.get(key);
    if (!entry) {
      return false;
    }

    Object.assign(entry, updates);
    this.needsSort = true;

    return true;
  }

  /**
   * Check if key exists in index
   */
  has(key: string): boolean {
    return this._entries.has(key);
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this._entries.keys());
  }

  /**
   * Get all entries
   */
  entries(): CacheIndexEntry[] {
    return Array.from(this._entries.values());
  }

  /**
   * Get entries by tag
   */
  getByTag(tag: string): CacheIndexEntry[] {
    const keys = this.tagIndex.get(tag);
    if (!keys) {
      return [];
    }

    const entries: CacheIndexEntry[] = [];
    for (const key of keys) {
      const entry = this._entries.get(key);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Get keys by tag
   */
  getKeysByTag(tag: string): string[] {
    const keys = this.tagIndex.get(tag);
    return keys ? Array.from(keys) : [];
  }

  /**
   * Get largest entries
   */
  getLargest(limit: number): CacheIndexEntry[] {
    this.ensureSorted();

    const largestKeys = this.sizeIndex.slice(-limit).reverse();
    return largestKeys
      .map((key) => this._entries.get(key))
      .filter((entry): entry is CacheIndexEntry => entry !== undefined);
  }

  /**
   * Get oldest entries (by last access time)
   */
  getOldest(limit: number): CacheIndexEntry[] {
    this.ensureSorted();

    const oldestKeys = this.timeIndex.slice(0, limit);
    return oldestKeys
      .map((key) => this._entries.get(key))
      .filter((entry): entry is CacheIndexEntry => entry !== undefined);
  }

  /**
   * Get expired entries
   */
  getExpired(): CacheIndexEntry[] {
    const now = Date.now();
    const expired: CacheIndexEntry[] = [];

    for (const entry of this._entries.values()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        expired.push(entry);
      }
    }

    return expired;
  }

  /**
   * Get total size of all entries
   */
  getTotalSize(): number {
    let total = 0;
    for (const entry of this._entries.values()) {
      total += entry.size;
    }
    return total;
  }

  /**
   * Get count of entries
   */
  getCount(): number {
    return this._entries.size;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this._entries.clear();
    this.tagIndex.clear();
    this.sizeIndex = [];
    this.timeIndex = [];
    this.needsSort = false;
  }

  /**
   * Get statistics
   */
  getStats() {
    const entries = Array.from(this._entries.values());

    return {
      count: entries.length,
      totalSize: this.getTotalSize(),
      averageSize: entries.length > 0 ? this.getTotalSize() / entries.length : 0,
      tags: this.tagIndex.size,
      expiredCount: this.getExpired().length,
    };
  }

  /**
   * Ensure sorted indices are up to date
   */
  private ensureSorted(): void {
    if (!this.needsSort) {
      return;
    }

    // Sort size index
    this.sizeIndex.sort((a, b) => {
      const entryA = this._entries.get(a);
      const entryB = this._entries.get(b);
      if (!entryA || !entryB) return 0;
      return entryA.size - entryB.size;
    });

    // Sort time index
    this.timeIndex.sort((a, b) => {
      const entryA = this._entries.get(a);
      const entryB = this._entries.get(b);
      if (!entryA || !entryB) return 0;
      return entryA.lastAccessedAt - entryB.lastAccessedAt;
    });

    this.needsSort = false;
  }
}
