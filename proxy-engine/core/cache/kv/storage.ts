// storage.ts - Key-value storage implementation for cache

/**
 * Storage interface for cache entries
 */
export interface Storage {
  get(key: string): Promise<Uint8Array | null>;
  set(key: string, value: Uint8Array): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  size(): Promise<number>;
}

/**
 * In-memory storage implementation
 */
export class MemoryStorage implements Storage {
  private store: Map<string, Uint8Array>;
  private byteSize: number;

  constructor(private maxBytes: number = 100 * 1024 * 1024) { // 100MB default
    this.store = new Map();
    this.byteSize = 0;
  }

  async get(key: string): Promise<Uint8Array | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    // Check if we need to evict
    const existingSize = this.store.has(key) ? this.store.get(key)!.length : 0;
    const newSize = value.length;
    const sizeChange = newSize - existingSize;

    if (this.byteSize + sizeChange > this.maxBytes) {
      // Simple LRU: remove first entry
      const firstKey = this.store.keys().next().value;
      if (firstKey) {
        await this.delete(firstKey);
      }
    }

    this.store.set(key, value);
    this.byteSize += sizeChange;
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async delete(key: string): Promise<void> {
    const value = this.store.get(key);
    if (value) {
      this.byteSize -= value.length;
      this.store.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.byteSize = 0;
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async size(): Promise<number> {
    return this.byteSize;
  }

  getStats() {
    return {
      entries: this.store.size,
      bytes: this.byteSize,
      maxBytes: this.maxBytes,
      utilization: (this.byteSize / this.maxBytes * 100).toFixed(2) + '%'
    };
  }
}
