/**
 * Cache API
 *
 * Implements Service Worker Cache API for storing HTTP request/response pairs.
 * Supports cache matching, quota enforcement, and expiration policies.
 */

import type { HTTPRequest, HTTPResponse } from "../../types/http.ts";
import type { CacheEntry } from "../../types/storage.ts";
import { QuotaManager, StorageType } from "./QuotaManager.ts";

/**
 * Cache match options
 */
export interface CacheMatchOptions {
    ignoreSearch?: boolean; // Ignore query string in matching
    ignoreMethod?: boolean; // Ignore HTTP method in matching
    ignoreVary?: boolean; // Ignore Vary header in matching
    cacheName?: string; // Specific cache to search (if not provided, searches all)
}

/**
 * Stored cache entry with metadata
 */
interface StoredCacheEntry extends CacheEntry {
    cachedAt: number;
}

/**
 * Cache instance
 */
export class Cache {
    readonly name: string;
    private entries: Map<string, StoredCacheEntry> = new Map();
    private origin: string;
    private quotaManager: QuotaManager;

    constructor(name: string, origin: string, quotaManager: QuotaManager) {
        this.name = name;
        this.origin = origin;
        this.quotaManager = quotaManager;
    }

    /**
     * Add request/response pair to cache
     */
    async put(request: HTTPRequest, response: HTTPResponse): Promise<void> {
        // Clone request and response to prevent modification
        const clonedRequest = this.cloneRequest(request);
        const clonedResponse = this.cloneResponse(response);

        // Create cache key
        const key = this.createCacheKey(clonedRequest);

        // Calculate size
        const size = this.calculateEntrySize(clonedRequest, clonedResponse);

        // Check if updating existing entry
        const existingEntry = this.entries.get(key);
        const sizeDelta = existingEntry ? size - existingEntry.size : size;

        // Check quota
        if (sizeDelta > 0 && !this.quotaManager.hasQuota(this.origin, sizeDelta)) {
            throw new Error("QuotaExceededError: Cache quota exceeded");
        }

        // Determine expiration
        const cachedAt = Date.now();
        const expiresAt = this.calculateExpiration(clonedResponse, cachedAt) ?? Infinity;

        // Store entry
        const entry: StoredCacheEntry = {
            request: clonedRequest,
            response: clonedResponse,
            storedAt: cachedAt,
            cachedAt,
            expiresAt,
            hitCount: 0,
            size,
        };

        this.entries.set(key, entry);

        // Update quota
        if (sizeDelta !== 0) {
            this.quotaManager.updateUsage(this.origin, sizeDelta, StorageType.CACHE_API);
        }
    }

    /**
     * Match request in cache
     */
    async match(
        request: HTTPRequest | string,
        options?: CacheMatchOptions,
    ): Promise<HTTPResponse | undefined> {
        const url = typeof request === "string" ? request : request.url;
        const method = typeof request === "string" ? "GET" : request.method;

        // Clean up expired entries
        this.cleanupExpired();

        // Search for matching entry
        for (const [key, entry] of this.entries.entries()) {
            if (this.matchesRequest(entry.request, url, method, options)) {
                // Check if expired
                if (entry.expiresAt && entry.expiresAt < Date.now()) {
                    this.entries.delete(key);
                    this.quotaManager.updateUsage(this.origin, -entry.size, StorageType.CACHE_API);
                    continue;
                }

                // Return cloned response
                return this.cloneResponse(entry.response);
            }
        }

        return undefined;
    }

    /**
     * Delete request from cache
     */
    async delete(request: HTTPRequest | string, options?: CacheMatchOptions): Promise<boolean> {
        const url = typeof request === "string" ? request : request.url;
        const method = typeof request === "string" ? "GET" : request.method;

        const toDelete: string[] = [];

        for (const [key, entry] of this.entries.entries()) {
            if (this.matchesRequest(entry.request, url, method, options)) {
                toDelete.push(key);
            }
        }

        if (toDelete.length === 0) {
            return false;
        }

        // Delete entries
        for (const key of toDelete) {
            const entry = this.entries.get(key)!;
            this.entries.delete(key);
            this.quotaManager.updateUsage(this.origin, -entry.size, StorageType.CACHE_API);
        }

        return true;
    }

    /**
     * Get all cached request URLs
     */
    async keys(
        request?: HTTPRequest | string,
        options?: CacheMatchOptions,
    ): Promise<HTTPRequest[]> {
        this.cleanupExpired();

        const results: HTTPRequest[] = [];

        if (request === undefined) {
            // Return all requests
            for (const entry of this.entries.values()) {
                results.push(this.cloneRequest(entry.request));
            }
        } else {
            // Return matching requests
            const url = typeof request === "string" ? request : request.url;
            const method = typeof request === "string" ? "GET" : request.method;

            for (const entry of this.entries.values()) {
                if (this.matchesRequest(entry.request, url, method, options)) {
                    results.push(this.cloneRequest(entry.request));
                }
            }
        }

        return results;
    }

    /**
     * Check if request matches criteria
     */
    private matchesRequest(
        cachedRequest: HTTPRequest,
        url: string,
        method: string,
        options?: CacheMatchOptions,
    ): boolean {
        // Check method
        if (!options?.ignoreMethod && cachedRequest.method !== method) {
            return false;
        }

        // Check URL
        if (options?.ignoreSearch) {
            // Compare URLs without query strings
            const cachedUrl = this.stripQueryString(cachedRequest.url);
            const requestUrl = this.stripQueryString(url);
            if (cachedUrl !== requestUrl) {
                return false;
            }
        } else {
            // Exact URL match
            if (cachedRequest.url !== url) {
                return false;
            }
        }

        return true;
    }

    /**
     * Create cache key for request
     */
    private createCacheKey(request: HTTPRequest): string {
        return `${request.method}:${request.url}`;
    }

    /**
     * Calculate entry size
     */
    private calculateEntrySize(request: HTTPRequest, response: HTTPResponse): number {
        let size = 0;

        // URL and method
        size += (request.url.length + request.method.length) * 2;

        // Request headers
        for (const [key, value] of request.headers.entries()) {
            size += (key.length + value.length) * 2;
        }

        // Request body
        if (request.body) {
            size += request.body.byteLength;
        }

        // Response status
        size += response.statusText.length * 2;

        // Response headers
        for (const [key, value] of response.headers.entries()) {
            size += (key.length + value.length) * 2;
        }

        // Response body
        size += response.body.byteLength;

        return size;
    }

    /**
     * Calculate expiration time
     */
    private calculateExpiration(response: HTTPResponse, cachedAt: number): number | undefined {
        // Check Cache-Control max-age
        const cacheControl = response.headers.get("cache-control");
        if (cacheControl) {
            const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
            if (maxAgeMatch) {
                const maxAge = parseInt(maxAgeMatch[1], 10);
                return cachedAt + (maxAge * 1000);
            }
        }

        // Check Expires header
        const expires = response.headers.get("expires");
        if (expires) {
            const expiresDate = new Date(expires);
            if (!isNaN(expiresDate.getTime())) {
                return expiresDate.getTime();
            }
        }

        return undefined;
    }

    /**
     * Clone request
     */
    private cloneRequest(request: HTTPRequest): HTTPRequest {
        return {
            ...request,
            headers: new Map(request.headers),
            body: request.body ? request.body.slice(0) : undefined,
        };
    }

    /**
     * Clone response
     */
    private cloneResponse(response: HTTPResponse): HTTPResponse {
        return {
            ...response,
            headers: new Map(response.headers),
            body: response.body.slice(0),
        };
    }

    /**
     * Strip query string from URL
     */
    private stripQueryString(url: string): string {
        const queryIndex = url.indexOf("?");
        return queryIndex === -1 ? url : url.substring(0, queryIndex);
    }

    /**
     * Clean up expired entries
     */
    private cleanupExpired(): void {
        const now = Date.now();
        const toDelete: string[] = [];

        for (const [key, entry] of this.entries.entries()) {
            if (entry.expiresAt && entry.expiresAt < now) {
                toDelete.push(key);
            }
        }

        for (const key of toDelete) {
            const entry = this.entries.get(key)!;
            this.entries.delete(key);
            this.quotaManager.updateUsage(this.origin, -entry.size, StorageType.CACHE_API);
        }
    }

    /**
     * Clear all entries
     */
    async clear(): Promise<void> {
        let totalSize = 0;
        for (const entry of this.entries.values()) {
            totalSize += entry.size;
        }

        this.entries.clear();

        if (totalSize > 0) {
            this.quotaManager.updateUsage(this.origin, -totalSize, StorageType.CACHE_API);
        }
    }

    /**
     * Get cache size
     */
    getSize(): number {
        let size = 0;
        for (const entry of this.entries.values()) {
            size += entry.size;
        }
        return size;
    }

    /**
     * Get entry count
     */
    getCount(): number {
        return this.entries.size;
    }
}

/**
 * CacheStorage - manages multiple caches
 */
export class CacheStorage {
    private caches: Map<string, Cache> = new Map();
    private origin: string;
    private quotaManager: QuotaManager;

    constructor(origin: string, quotaManager?: QuotaManager) {
        this.origin = origin;
        this.quotaManager = quotaManager || new QuotaManager();
    }

    /**
     * Open or create cache
     */
    async open(cacheName: string): Promise<Cache> {
        if (!this.caches.has(cacheName)) {
            const cache = new Cache(cacheName, this.origin, this.quotaManager);
            this.caches.set(cacheName, cache);
        }
        return this.caches.get(cacheName)!;
    }

    /**
     * Match request across all caches
     */
    async match(
        request: HTTPRequest | string,
        options?: CacheMatchOptions,
    ): Promise<HTTPResponse | undefined> {
        // If specific cache is specified
        if (options?.cacheName) {
            const cache = this.caches.get(options.cacheName);
            if (cache) {
                return await cache.match(request, options);
            }
            return undefined;
        }

        // Search all caches
        for (const cache of this.caches.values()) {
            const response = await cache.match(request, options);
            if (response) {
                return response;
            }
        }

        return undefined;
    }

    /**
     * Check if cache exists
     */
    async has(cacheName: string): Promise<boolean> {
        return this.caches.has(cacheName);
    }

    /**
     * Delete cache
     */
    async delete(cacheName: string): Promise<boolean> {
        const cache = this.caches.get(cacheName);
        if (!cache) {
            return false;
        }

        // Clear cache to update quota
        await cache.clear();

        this.caches.delete(cacheName);
        return true;
    }

    /**
     * Get all cache names
     */
    async keys(): Promise<string[]> {
        return Array.from(this.caches.keys());
    }

    /**
     * Get total storage size
     */
    getTotalSize(): number {
        let total = 0;
        for (const cache of this.caches.values()) {
            total += cache.getSize();
        }
        return total;
    }

    /**
     * Get cache count
     */
    getCacheCount(): number {
        return this.caches.size;
    }

    /**
     * Clear all caches
     */
    async clearAll(): Promise<void> {
        for (const cache of this.caches.values()) {
            await cache.clear();
        }
        this.caches.clear();
    }
}

/**
 * Global CacheStorage instances per origin
 */
class CacheStorageManager {
    private storages: Map<string, CacheStorage> = new Map();
    private quotaManager: QuotaManager;

    constructor(quotaManager?: QuotaManager) {
        this.quotaManager = quotaManager || new QuotaManager();
    }

    /**
     * Get CacheStorage for origin
     */
    getStorage(origin: string): CacheStorage {
        if (!this.storages.has(origin)) {
            this.storages.set(origin, new CacheStorage(origin, this.quotaManager));
        }
        return this.storages.get(origin)!;
    }

    /**
     * Delete all storage for origin
     */
    async deleteOrigin(origin: string): Promise<void> {
        const storage = this.storages.get(origin);
        if (storage) {
            await storage.clearAll();
            this.storages.delete(origin);
        }
    }

    /**
     * Get all origins with cache storage
     */
    getAllOrigins(): string[] {
        return Array.from(this.storages.keys());
    }

    /**
     * Get quota manager
     */
    getQuotaManager(): QuotaManager {
        return this.quotaManager;
    }
}

// Export singleton manager
export const cacheStorageManager = new CacheStorageManager();
