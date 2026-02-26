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
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;

  constructor(private maxBytes: number = 100 * 1024 * 1024) { // 100MB default
    this.store = new Map();
    this.byteSize = 0;
  }

  async get(key: string): Promise<Uint8Array | null> {
    const value = this.store.get(key) ?? null;
    if (value !== null) {
      this.accessOrder.set(key, ++this.accessCounter);
    }
    return value;
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    // Check if we need to evict
    const existingSize = this.store.has(key) ? this.store.get(key)!.length : 0;
    const newSize = value.length;
    let sizeChange = newSize - existingSize;

    while (this.byteSize + sizeChange > this.maxBytes && this.store.size > 0) {
      // LRU: remove entry with oldest (minimum) access counter
      let lruKey: string | undefined;
      let lruTime = Infinity;
      for (const [k, t] of this.accessOrder) {
        if (k !== key && t < lruTime) {
          lruTime = t;
          lruKey = k;
        }
      }
      if (lruKey) {
        await this.delete(lruKey);
        sizeChange = newSize - (this.store.has(key) ? this.store.get(key)!.length : 0);
      } else {
        break; // No more entries to evict
      }
    }

    this.store.set(key, value);
    this.accessOrder.set(key, ++this.accessCounter);
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
      this.accessOrder.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
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
