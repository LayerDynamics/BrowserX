/**
 * Storage Manager
 *
 * Manages localStorage and sessionStorage per origin with quota enforcement.
 * Implements Web Storage API specification.
 */

import { type StorageEvent, StorageEventEmitter } from "./StorageEvents.ts";
import { QuotaManager } from "./QuotaManager.ts";

/**
 * Storage area type
 */
export type StorageArea = "localStorage" | "sessionStorage";

/**
 * Storage wrapper with quota enforcement
 */
class OriginStorage {
    private data: Map<string, string> = new Map();
    private origin: string;
    private area: StorageArea;
    private quotaManager: QuotaManager;
    private eventEmitter: StorageEventEmitter;

    constructor(
        origin: string,
        area: StorageArea,
        quotaManager: QuotaManager,
        eventEmitter: StorageEventEmitter,
    ) {
        this.origin = origin;
        this.area = area;
        this.quotaManager = quotaManager;
        this.eventEmitter = eventEmitter;
    }

    /**
     * Get item
     */
    getItem(key: string): string | null {
        return this.data.get(key) ?? null;
    }

    /**
     * Set item with quota check
     */
    setItem(key: string, value: string, url: string): void {
        const oldValue = this.data.get(key);

        // Calculate size change
        const oldSize = oldValue ? this.calculateSize(key, oldValue) : 0;
        const newSize = this.calculateSize(key, value);
        const sizeDelta = newSize - oldSize;

        // Check quota
        if (sizeDelta > 0 && !this.quotaManager.hasQuota(this.origin, sizeDelta)) {
            throw new Error("QuotaExceededError: Storage quota exceeded");
        }

        // Store value
        this.data.set(key, value);

        // Update quota
        if (sizeDelta !== 0) {
            this.quotaManager.updateUsage(this.origin, sizeDelta);
        }

        // Emit storage event
        this.eventEmitter.emit({
            key,
            oldValue: oldValue ?? null,
            newValue: value,
            url,
            storageArea: this.area,
        });
    }

    /**
     * Remove item
     */
    removeItem(key: string, url: string): void {
        const oldValue = this.data.get(key);

        if (oldValue !== undefined) {
            this.data.delete(key);

            // Update quota
            const size = this.calculateSize(key, oldValue);
            this.quotaManager.updateUsage(this.origin, -size);

            // Emit storage event
            this.eventEmitter.emit({
                key,
                oldValue,
                newValue: null,
                url,
                storageArea: this.area,
            });
        }
    }

    /**
     * Clear all items
     */
    clear(url: string): void {
        if (this.data.size === 0) {
            return;
        }

        // Calculate total size
        let totalSize = 0;
        for (const [key, value] of this.data.entries()) {
            totalSize += this.calculateSize(key, value);
        }

        // Clear data
        this.data.clear();

        // Update quota
        this.quotaManager.updateUsage(this.origin, -totalSize);

        // Emit storage event (with null key to indicate clear)
        this.eventEmitter.emit({
            key: "",
            oldValue: null,
            newValue: null,
            url,
            storageArea: this.area,
        });
    }

    /**
     * Get key at index
     */
    key(index: number): string | null {
        const keys = Array.from(this.data.keys());
        return keys[index] ?? null;
    }

    /**
     * Get number of items
     */
    get length(): number {
        return this.data.size;
    }

    /**
     * Get all keys
     */
    keys(): string[] {
        return Array.from(this.data.keys());
    }

    /**
     * Get all values
     */
    values(): string[] {
        return Array.from(this.data.values());
    }

    /**
     * Get all entries
     */
    entries(): [string, string][] {
        return Array.from(this.data.entries());
    }

    /**
     * Calculate storage size in bytes
     */
    private calculateSize(key: string, value: string): number {
        // UTF-16 encoding: 2 bytes per character
        return (key.length + value.length) * 2;
    }

    /**
     * Get current storage size
     */
    getSize(): number {
        let size = 0;
        for (const [key, value] of this.data.entries()) {
            size += this.calculateSize(key, value);
        }
        return size;
    }

    /**
     * Export data (for serialization)
     */
    export(): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [key, value] of this.data.entries()) {
            result[key] = value;
        }
        return result;
    }

    /**
     * Import data (for deserialization)
     */
    import(data: Record<string, string>): void {
        this.data.clear();
        for (const [key, value] of Object.entries(data)) {
            this.data.set(key, value);
        }
    }
}

/**
 * Storage Manager
 */
export class StorageManager {
    private localStorage: Map<string, OriginStorage> = new Map();
    private sessionStorage: Map<string, OriginStorage> = new Map();
    private quotaManager: QuotaManager;
    private eventEmitter: StorageEventEmitter;

    constructor(quotaManager?: QuotaManager, eventEmitter?: StorageEventEmitter) {
        this.quotaManager = quotaManager || new QuotaManager();
        this.eventEmitter = eventEmitter || new StorageEventEmitter();
    }

    /**
     * Get localStorage for origin
     */
    getLocalStorage(origin: string): OriginStorage {
        if (!this.localStorage.has(origin)) {
            this.localStorage.set(
                origin,
                new OriginStorage(origin, "localStorage", this.quotaManager, this.eventEmitter),
            );
        }
        return this.localStorage.get(origin)!;
    }

    /**
     * Get sessionStorage for origin
     */
    getSessionStorage(origin: string): OriginStorage {
        if (!this.sessionStorage.has(origin)) {
            this.sessionStorage.set(
                origin,
                new OriginStorage(origin, "sessionStorage", this.quotaManager, this.eventEmitter),
            );
        }
        return this.sessionStorage.get(origin)!;
    }

    /**
     * Clear all storage for origin
     */
    clearOrigin(origin: string, url: string): void {
        const local = this.localStorage.get(origin);
        if (local) {
            local.clear(url);
        }

        const session = this.sessionStorage.get(origin);
        if (session) {
            session.clear(url);
        }
    }

    /**
     * Delete all storage for origin
     */
    deleteOrigin(origin: string): void {
        this.localStorage.delete(origin);
        this.sessionStorage.delete(origin);
    }

    /**
     * Get all origins with storage
     */
    getAllOrigins(): string[] {
        const origins = new Set<string>();

        for (const origin of this.localStorage.keys()) {
            origins.add(origin);
        }

        for (const origin of this.sessionStorage.keys()) {
            origins.add(origin);
        }

        return Array.from(origins);
    }

    /**
     * Get storage usage for origin
     */
    getUsage(origin: string): { local: number; session: number; total: number } {
        const local = this.localStorage.get(origin)?.getSize() ?? 0;
        const session = this.sessionStorage.get(origin)?.getSize() ?? 0;

        return {
            local,
            session,
            total: local + session,
        };
    }

    /**
     * Get total storage usage across all origins
     */
    getTotalUsage(): number {
        let total = 0;

        for (const storage of this.localStorage.values()) {
            total += storage.getSize();
        }

        for (const storage of this.sessionStorage.values()) {
            total += storage.getSize();
        }

        return total;
    }

    /**
     * Get event emitter
     */
    getEventEmitter(): StorageEventEmitter {
        return this.eventEmitter;
    }

    /**
     * Get quota manager
     */
    getQuotaManager(): QuotaManager {
        return this.quotaManager;
    }

    /**
     * Export all storage data (for persistence)
     */
    export(): {
        localStorage: Record<string, Record<string, string>>;
        sessionStorage: Record<string, Record<string, string>>;
    } {
        const localData: Record<string, Record<string, string>> = {};
        for (const [origin, storage] of this.localStorage.entries()) {
            localData[origin] = storage.export();
        }

        const sessionData: Record<string, Record<string, string>> = {};
        for (const [origin, storage] of this.sessionStorage.entries()) {
            sessionData[origin] = storage.export();
        }

        return {
            localStorage: localData,
            sessionStorage: sessionData,
        };
    }

    /**
     * Import storage data (from persistence)
     */
    import(data: {
        localStorage?: Record<string, Record<string, string>>;
        sessionStorage?: Record<string, Record<string, string>>;
    }): void {
        if (data.localStorage) {
            for (const [origin, originData] of Object.entries(data.localStorage)) {
                const storage = this.getLocalStorage(origin);
                storage.import(originData);
            }
        }

        if (data.sessionStorage) {
            for (const [origin, originData] of Object.entries(data.sessionStorage)) {
                const storage = this.getSessionStorage(origin);
                storage.import(originData);
            }
        }
    }

    /**
     * Clear all session storage (on browser close)
     */
    clearAllSessionStorage(): void {
        this.sessionStorage.clear();
    }
}

export { OriginStorage };
