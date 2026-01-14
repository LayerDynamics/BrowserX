// ============================================================================
// STORAGE TYPES
// ============================================================================

import type { ByteCount, Timestamp } from "./identifiers.ts";
import type { HTTPRequest, HTTPResponse } from "./http.ts";

/**
 * Cookie
 */
export interface Cookie {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: Date;
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
}

/**
 * Cache entry
 */
export interface CacheEntry {
    request: HTTPRequest;
    response: HTTPResponse;
    storedAt: Timestamp;
    expiresAt: Timestamp;
    etag?: string;
    lastModified?: string;
    hitCount: number;
    size: ByteCount;
}

/**
 * IndexedDB object store options
 */
export interface IDBObjectStoreOptions {
    keyPath?: string | string[];
    autoIncrement?: boolean;
}

/**
 * IndexedDB transaction mode
 */
export type IDBTransactionMode = "readonly" | "readwrite";

/**
 * IndexedDB object store
 */
export interface IDBObjectStore {
    name: string;
    keyPath: string | string[] | null;
    autoIncrement: boolean;
    indexNames: string[];

    /**
     * Add record
     */
    add(value: unknown, key?: unknown): Promise<unknown>;

    /**
     * Put record
     */
    put(value: unknown, key?: unknown): Promise<unknown>;

    /**
     * Get record
     */
    get(key: unknown): Promise<unknown>;

    /**
     * Delete record
     */
    delete(key: unknown): Promise<void>;

    /**
     * Clear all records
     */
    clear(): Promise<void>;

    /**
     * Get all records
     */
    getAll(query?: unknown, count?: number): Promise<unknown[]>;
}

/**
 * IndexedDB transaction
 */
export interface IDBTransaction {
    db: IDBDatabase;
    mode: IDBTransactionMode;
    objectStoreNames: string[];

    /**
     * Get object store
     */
    objectStore(name: string): IDBObjectStore;

    /**
     * Abort transaction
     */
    abort(): void;

    /**
     * Commit transaction
     */
    commit(): void;
}

/**
 * IndexedDB database
 */
export interface IDBDatabase {
    name: string;
    version: number;
    objectStoreNames: string[];

    /**
     * Create object store
     */
    createObjectStore(name: string, options?: IDBObjectStoreOptions): IDBObjectStore;

    /**
     * Delete object store
     */
    deleteObjectStore(name: string): void;

    /**
     * Create transaction
     */
    transaction(storeNames: string | string[], mode: IDBTransactionMode): IDBTransaction;

    /**
     * Close database
     */
    close(): void;
}
