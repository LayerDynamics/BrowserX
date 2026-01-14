/**
 * IndexedDB Object Store
 *
 * Implements IndexedDB object store with key-value storage and indexing.
 */

import type { IDBObjectStoreOptions } from "../../types/storage.ts";

/**
 * Index structure
 */
interface IDBIndex {
    name: string;
    keyPath: string | string[];
    unique: boolean;
    multiEntry: boolean;
    data: Map<unknown, Set<unknown>>; // index value -> set of primary keys
}

/**
 * IDBObjectStore Implementation
 */
export class IDBObjectStoreImpl {
    readonly name: string;
    readonly keyPath: string | string[] | null;
    readonly autoIncrement: boolean;
    readonly indexNames: string[];

    private data: Map<unknown, unknown> = new Map();
    private indexes: Map<string, IDBIndex> = new Map();
    private currentKey: number = 1;
    private transaction: unknown; // Reference to parent transaction

    constructor(name: string, options?: IDBObjectStoreOptions) {
        this.name = name;
        this.keyPath = options?.keyPath ?? null;
        this.autoIncrement = options?.autoIncrement ?? false;
        this.indexNames = [];
    }

    /**
     * Add record to store
     */
    async add(value: unknown, key?: unknown): Promise<unknown> {
        // Determine the key
        const recordKey = await this.determineKey(value, key, false);

        // Check if key already exists
        if (this.data.has(recordKey)) {
            throw new Error("ConstraintError: Key already exists");
        }

        // Store the record
        this.data.set(recordKey, value);

        // Update indexes
        this.updateIndexes(recordKey, value);

        return recordKey;
    }

    /**
     * Put record in store (add or update)
     */
    async put(value: unknown, key?: unknown): Promise<unknown> {
        // Determine the key
        const recordKey = await this.determineKey(value, key, true);

        // Remove old index entries if updating
        if (this.data.has(recordKey)) {
            const oldValue = this.data.get(recordKey);
            this.removeFromIndexes(recordKey, oldValue);
        }

        // Store the record
        this.data.set(recordKey, value);

        // Update indexes
        this.updateIndexes(recordKey, value);

        return recordKey;
    }

    /**
     * Get record from store
     */
    async get(key: unknown): Promise<unknown> {
        return this.data.get(key);
    }

    /**
     * Delete record from store
     */
    async delete(key: unknown): Promise<void> {
        const value = this.data.get(key);

        if (value !== undefined) {
            // Remove from indexes
            this.removeFromIndexes(key, value);

            // Delete the record
            this.data.delete(key);
        }
    }

    /**
     * Clear all records
     */
    async clear(): Promise<void> {
        this.data.clear();

        // Clear all indexes
        for (const index of this.indexes.values()) {
            index.data.clear();
        }

        // Reset auto-increment counter
        this.currentKey = 1;
    }

    /**
     * Get all records
     */
    async getAll(query?: unknown, count?: number): Promise<unknown[]> {
        const results: unknown[] = [];

        for (const value of this.data.values()) {
            if (query === undefined || this.matchesQuery(value, query)) {
                results.push(value);

                if (count !== undefined && results.length >= count) {
                    break;
                }
            }
        }

        return results;
    }

    /**
     * Get all keys
     */
    async getAllKeys(query?: unknown, count?: number): Promise<unknown[]> {
        const results: unknown[] = [];

        for (const [key, value] of this.data.entries()) {
            if (query === undefined || this.matchesQuery(value, query)) {
                results.push(key);

                if (count !== undefined && results.length >= count) {
                    break;
                }
            }
        }

        return results;
    }

    /**
     * Count records
     */
    async count(query?: unknown): Promise<number> {
        if (query === undefined) {
            return this.data.size;
        }

        let count = 0;
        for (const value of this.data.values()) {
            if (this.matchesQuery(value, query)) {
                count++;
            }
        }

        return count;
    }

    /**
     * Open cursor
     */
    async openCursor(
        query?: unknown,
        direction: "next" | "prev" = "next",
    ): Promise<IDBCursorImpl | null> {
        const keys = Array.from(this.data.keys());

        if (direction === "prev") {
            keys.reverse();
        }

        const filteredKeys = query === undefined
            ? keys
            : keys.filter((key) => this.matchesQuery(this.data.get(key), query));

        if (filteredKeys.length === 0) {
            return null;
        }

        return new IDBCursorImpl(this, filteredKeys, 0);
    }

    /**
     * Create index
     */
    createIndex(name: string, keyPath: string | string[], options?: {
        unique?: boolean;
        multiEntry?: boolean;
    }): IDBIndex {
        if (this.indexes.has(name)) {
            throw new Error("ConstraintError: Index already exists");
        }

        const index: IDBIndex = {
            name,
            keyPath,
            unique: options?.unique ?? false,
            multiEntry: options?.multiEntry ?? false,
            data: new Map(),
        };

        // Populate index with existing data
        for (const [primaryKey, value] of this.data.entries()) {
            this.addToIndex(index, primaryKey, value);
        }

        this.indexes.set(name, index);
        this.indexNames.push(name);

        return index;
    }

    /**
     * Delete index
     */
    deleteIndex(name: string): void {
        this.indexes.delete(name);
        const indexIdx = this.indexNames.indexOf(name);
        if (indexIdx !== -1) {
            this.indexNames.splice(indexIdx, 1);
        }
    }

    /**
     * Get index
     */
    index(name: string): IDBIndex | undefined {
        return this.indexes.get(name);
    }

    /**
     * Determine key for record
     */
    private async determineKey(
        value: unknown,
        key: unknown | undefined,
        allowUpdate: boolean,
    ): Promise<unknown> {
        // If key is provided explicitly
        if (key !== undefined) {
            return key;
        }

        // If keyPath is set, extract key from value
        if (this.keyPath !== null && typeof value === "object" && value !== null) {
            const extractedKey = this.extractKeyFromValue(value, this.keyPath);

            if (extractedKey !== undefined) {
                return extractedKey;
            }

            // If auto-increment and no key in value, generate one
            if (this.autoIncrement) {
                const generatedKey = this.currentKey++;
                // Set the generated key in the object
                this.setKeyInValue(value, this.keyPath, generatedKey);
                return generatedKey;
            }
        }

        // If auto-increment, generate key
        if (this.autoIncrement) {
            return this.currentKey++;
        }

        throw new Error("DataError: No key specified and store does not have autoIncrement");
    }

    /**
     * Extract key from value using keyPath
     */
    private extractKeyFromValue(value: unknown, keyPath: string | string[]): unknown {
        if (typeof keyPath === "string") {
            return (value as Record<string, unknown>)[keyPath];
        } else {
            // Compound key
            const keys: unknown[] = [];
            for (const path of keyPath) {
                keys.push((value as Record<string, unknown>)[path]);
            }
            return keys;
        }
    }

    /**
     * Set key in value using keyPath
     */
    private setKeyInValue(value: unknown, keyPath: string | string[], key: unknown): void {
        if (typeof keyPath === "string") {
            (value as Record<string, unknown>)[keyPath] = key;
        }
        // For compound keys, we don't set them back
    }

    /**
     * Update indexes for a record
     */
    private updateIndexes(primaryKey: unknown, value: unknown): void {
        for (const index of this.indexes.values()) {
            this.addToIndex(index, primaryKey, value);
        }
    }

    /**
     * Remove record from indexes
     */
    private removeFromIndexes(primaryKey: unknown, value: unknown): void {
        for (const index of this.indexes.values()) {
            this.removeFromIndex(index, primaryKey, value);
        }
    }

    /**
     * Add record to index
     */
    private addToIndex(index: IDBIndex, primaryKey: unknown, value: unknown): void {
        const indexKey = this.extractKeyFromValue(value, index.keyPath);

        if (indexKey === undefined) {
            return;
        }

        // Handle multiEntry
        if (index.multiEntry && Array.isArray(indexKey)) {
            for (const key of indexKey) {
                this.addToIndexEntry(index, key, primaryKey);
            }
        } else {
            this.addToIndexEntry(index, indexKey, primaryKey);
        }
    }

    /**
     * Add entry to index
     */
    private addToIndexEntry(index: IDBIndex, indexKey: unknown, primaryKey: unknown): void {
        if (!index.data.has(indexKey)) {
            index.data.set(indexKey, new Set());
        }

        const primaryKeys = index.data.get(indexKey)!;

        if (index.unique && primaryKeys.size > 0) {
            throw new Error("ConstraintError: Index is unique and value already exists");
        }

        primaryKeys.add(primaryKey);
    }

    /**
     * Remove record from index
     */
    private removeFromIndex(index: IDBIndex, primaryKey: unknown, value: unknown): void {
        const indexKey = this.extractKeyFromValue(value, index.keyPath);

        if (indexKey === undefined) {
            return;
        }

        // Handle multiEntry
        if (index.multiEntry && Array.isArray(indexKey)) {
            for (const key of indexKey) {
                this.removeFromIndexEntry(index, key, primaryKey);
            }
        } else {
            this.removeFromIndexEntry(index, indexKey, primaryKey);
        }
    }

    /**
     * Remove entry from index
     */
    private removeFromIndexEntry(index: IDBIndex, indexKey: unknown, primaryKey: unknown): void {
        const primaryKeys = index.data.get(indexKey);

        if (primaryKeys) {
            primaryKeys.delete(primaryKey);

            if (primaryKeys.size === 0) {
                index.data.delete(indexKey);
            }
        }
    }

    /**
     * Check if value matches query
     */
    private matchesQuery(value: unknown, query: unknown): boolean {
        // Simplified query matching - in real implementation would support IDBKeyRange
        return true;
    }
}

/**
 * IDB Cursor implementation
 */
class IDBCursorImpl {
    private store: IDBObjectStoreImpl;
    private keys: unknown[];
    private index: number;

    constructor(store: IDBObjectStoreImpl, keys: unknown[], index: number) {
        this.store = store;
        this.keys = keys;
        this.index = index;
    }

    get key(): unknown {
        return this.keys[this.index];
    }

    async value(): Promise<unknown> {
        return await this.store.get(this.keys[this.index]);
    }

    continue(): void {
        this.index++;
    }

    async advance(count: number): Promise<void> {
        this.index += count;
    }

    get done(): boolean {
        return this.index >= this.keys.length;
    }
}
