/**
 * DNS Cache
 *
 * Caches DNS query results with TTL-based expiration.
 * Automatically cleans up expired entries and tracks hit/miss statistics.
 */

import type { DNSResult } from "./DNSResolver.ts";
import type { Duration } from "../../../types/identifiers.ts";

/**
 * DNS cache statistics
 */
export interface DNSCacheStats {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
}

export class DNSCache {
    private cache: Map<string, DNSResult> = new Map();
    private hits: number = 0;
    private misses: number = 0;
    private cleanupInterval: number | null = null;
    private cleanupIntervalMs: Duration = 60000; // Cleanup every 60 seconds

    constructor() {
        // Start automatic cleanup timer
        this.startAutoCleanup();
    }

    /**
     * Get cached DNS result
     *
     * @param hostname - Hostname to lookup
     * @returns Cached result or undefined if not found/expired
     */
    get(hostname: string): DNSResult | undefined {
        const result = this.cache.get(hostname);
        if (!result) {
            this.misses++;
            return undefined;
        }

        // Check if expired
        const age = Date.now() - result.timestamp;
        if (age > result.ttl * 1000) {
            this.cache.delete(hostname);
            this.misses++;
            return undefined;
        }

        this.hits++;
        return result;
    }

    /**
     * Store DNS result in cache
     *
     * @param result - DNS result to cache
     */
    set(result: DNSResult): void {
        this.cache.set(result.hostname, result);
    }

    /**
     * Clear expired entries from cache
     */
    cleanup(): void {
        const now = Date.now();
        for (const [hostname, result] of this.cache.entries()) {
            const age = now - result.timestamp;
            if (age > result.ttl * 1000) {
                this.cache.delete(hostname);
            }
        }
    }

    /**
     * Clear all cached entries and reset statistics
     */
    clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Check if hostname is in cache (and not expired)
     *
     * @param hostname - Hostname to check
     * @returns True if hostname is cached and not expired
     */
    has(hostname: string): boolean {
        const result = this.cache.get(hostname);
        if (!result) {
            return false;
        }

        // Check if expired
        const age = Date.now() - result.timestamp;
        if (age > result.ttl * 1000) {
            this.cache.delete(hostname);
            return false;
        }

        return true;
    }

    /**
     * Get cache statistics
     */
    getStats(): DNSCacheStats {
        const total = this.hits + this.misses;
        const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate,
        };
    }

    /**
     * Start automatic cleanup timer
     */
    private startAutoCleanup(): void {
        if (this.cleanupInterval !== null) {
            return; // Already running
        }

        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.cleanupIntervalMs);
    }

    /**
     * Stop automatic cleanup timer
     */
    stopAutoCleanup(): void {
        if (this.cleanupInterval !== null) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Get number of entries in cache
     */
    getSize(): number {
        return this.cache.size;
    }
}
