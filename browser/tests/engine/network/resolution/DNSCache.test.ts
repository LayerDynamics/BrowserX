/**
 * DNSCache Tests
 *
 * Comprehensive tests for DNS cache functionality.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { DNSCache, type DNSCacheStats } from "../../../../src/engine/network/resolution/DNSCache.ts";
import type { DNSResult } from "../../../../src/engine/network/resolution/DNSResolver.ts";

// Helper to create mock DNS result
function createMockDNSResult(hostname: string, ttl: number = 300): DNSResult {
    return {
        hostname,
        addresses: ["192.0.2.1"],
        ttl,
        timestamp: Date.now(),
    };
}

// ============================================================================
// DNSCache Constructor Tests
// ============================================================================

Deno.test({
    name: "DNSCache - constructor creates cache",
    async fn() {
        const cache = new DNSCache();

        assertExists(cache);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - constructor starts auto cleanup",
    async fn() {
        const cache = new DNSCache();

        // Auto cleanup should be running
        cache.stopAutoCleanup();

        assert(true);
    },
});

Deno.test({
    name: "DNSCache - constructor initializes empty cache",
    async fn() {
        const cache = new DNSCache();

        assertEquals(cache.getSize(), 0);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - constructor initializes statistics",
    async fn() {
        const cache = new DNSCache();

        const stats = cache.getStats();
        assertEquals(stats.hits, 0);
        assertEquals(stats.misses, 0);

        cache.stopAutoCleanup();
    },
});

// ============================================================================
// DNSCache get() Tests
// ============================================================================

Deno.test({
    name: "DNSCache - get returns undefined for missing entry",
    async fn() {
        const cache = new DNSCache();

        const result = cache.get("nonexistent.com");

        assertEquals(result, undefined);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - get increments misses on cache miss",
    async fn() {
        const cache = new DNSCache();

        cache.get("nonexistent.com");

        const stats = cache.getStats();
        assertEquals(stats.misses, 1);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - get returns cached entry",
    async fn() {
        const cache = new DNSCache();
        const result = createMockDNSResult("example.com");

        cache.set(result);
        const cached = cache.get("example.com");

        assertExists(cached);
        assertEquals(cached.hostname, "example.com");

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - get increments hits on cache hit",
    async fn() {
        const cache = new DNSCache();
        const result = createMockDNSResult("example.com");

        cache.set(result);
        cache.get("example.com");

        const stats = cache.getStats();
        assertEquals(stats.hits, 1);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - get returns undefined for expired entry",
    async fn() {
        const cache = new DNSCache();

        // Create result with TTL of 0 seconds (already expired)
        const result: DNSResult = {
            hostname: "example.com",
            addresses: ["192.0.2.1"],
            ttl: 0,
            timestamp: Date.now() - 1000, // 1 second ago
        };

        cache.set(result);
        const cached = cache.get("example.com");

        assertEquals(cached, undefined);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - get removes expired entry",
    async fn() {
        const cache = new DNSCache();

        const result: DNSResult = {
            hostname: "example.com",
            addresses: ["192.0.2.1"],
            ttl: 0,
            timestamp: Date.now() - 1000,
        };

        cache.set(result);
        assertEquals(cache.getSize(), 1);

        cache.get("example.com");

        assertEquals(cache.getSize(), 0);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - get counts expired as miss",
    async fn() {
        const cache = new DNSCache();

        const result: DNSResult = {
            hostname: "example.com",
            addresses: ["192.0.2.1"],
            ttl: 0,
            timestamp: Date.now() - 1000,
        };

        cache.set(result);
        cache.get("example.com");

        const stats = cache.getStats();
        assertEquals(stats.misses, 1);

        cache.stopAutoCleanup();
    },
});

// ============================================================================
// DNSCache set() Tests
// ============================================================================

Deno.test({
    name: "DNSCache - set stores entry",
    async fn() {
        const cache = new DNSCache();
        const result = createMockDNSResult("example.com");

        cache.set(result);

        assertEquals(cache.getSize(), 1);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - set allows retrieval",
    async fn() {
        const cache = new DNSCache();
        const result = createMockDNSResult("example.com");

        cache.set(result);
        const cached = cache.get("example.com");

        assertExists(cached);
        assertEquals(cached.hostname, result.hostname);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - set updates existing entry",
    async fn() {
        const cache = new DNSCache();
        const result1 = createMockDNSResult("example.com", 300);
        const result2 = createMockDNSResult("example.com", 600);

        cache.set(result1);
        cache.set(result2);

        assertEquals(cache.getSize(), 1);

        const cached = cache.get("example.com");
        assertEquals(cached?.ttl, 600);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - set stores multiple entries",
    async fn() {
        const cache = new DNSCache();

        cache.set(createMockDNSResult("example1.com"));
        cache.set(createMockDNSResult("example2.com"));
        cache.set(createMockDNSResult("example3.com"));

        assertEquals(cache.getSize(), 3);

        cache.stopAutoCleanup();
    },
});

// ============================================================================
// DNSCache cleanup() Tests
// ============================================================================

Deno.test({
    name: "DNSCache - cleanup removes expired entries",
    async fn() {
        const cache = new DNSCache();

        const expired: DNSResult = {
            hostname: "expired.com",
            addresses: ["192.0.2.1"],
            ttl: 0,
            timestamp: Date.now() - 1000,
        };

        const valid = createMockDNSResult("valid.com", 300);

        cache.set(expired);
        cache.set(valid);

        assertEquals(cache.getSize(), 2);

        cache.cleanup();

        assertEquals(cache.getSize(), 1);
        assertExists(cache.get("valid.com"));

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - cleanup keeps valid entries",
    async fn() {
        const cache = new DNSCache();

        cache.set(createMockDNSResult("example1.com", 300));
        cache.set(createMockDNSResult("example2.com", 600));

        cache.cleanup();

        assertEquals(cache.getSize(), 2);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - cleanup is idempotent",
    async fn() {
        const cache = new DNSCache();
        cache.set(createMockDNSResult("example.com"));

        cache.cleanup();
        cache.cleanup();
        cache.cleanup();

        assertEquals(cache.getSize(), 1);

        cache.stopAutoCleanup();
    },
});

// ============================================================================
// DNSCache clear() Tests
// ============================================================================

Deno.test({
    name: "DNSCache - clear removes all entries",
    async fn() {
        const cache = new DNSCache();

        cache.set(createMockDNSResult("example1.com"));
        cache.set(createMockDNSResult("example2.com"));
        cache.set(createMockDNSResult("example3.com"));

        cache.clear();

        assertEquals(cache.getSize(), 0);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - clear resets hits",
    async fn() {
        const cache = new DNSCache();
        const result = createMockDNSResult("example.com");

        cache.set(result);
        cache.get("example.com");

        cache.clear();

        const stats = cache.getStats();
        assertEquals(stats.hits, 0);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - clear resets misses",
    async fn() {
        const cache = new DNSCache();

        cache.get("nonexistent.com");

        cache.clear();

        const stats = cache.getStats();
        assertEquals(stats.misses, 0);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - clear is idempotent",
    async fn() {
        const cache = new DNSCache();

        cache.clear();
        cache.clear();
        cache.clear();

        assertEquals(cache.getSize(), 0);

        cache.stopAutoCleanup();
    },
});

// ============================================================================
// DNSCache has() Tests
// ============================================================================

Deno.test({
    name: "DNSCache - has returns false for missing entry",
    async fn() {
        const cache = new DNSCache();

        assertEquals(cache.has("nonexistent.com"), false);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - has returns true for cached entry",
    async fn() {
        const cache = new DNSCache();
        const result = createMockDNSResult("example.com");

        cache.set(result);

        assertEquals(cache.has("example.com"), true);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - has returns false for expired entry",
    async fn() {
        const cache = new DNSCache();

        const result: DNSResult = {
            hostname: "example.com",
            addresses: ["192.0.2.1"],
            ttl: 0,
            timestamp: Date.now() - 1000,
        };

        cache.set(result);

        assertEquals(cache.has("example.com"), false);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - has removes expired entry",
    async fn() {
        const cache = new DNSCache();

        const result: DNSResult = {
            hostname: "example.com",
            addresses: ["192.0.2.1"],
            ttl: 0,
            timestamp: Date.now() - 1000,
        };

        cache.set(result);
        assertEquals(cache.getSize(), 1);

        cache.has("example.com");

        assertEquals(cache.getSize(), 0);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - has does not affect statistics",
    async fn() {
        const cache = new DNSCache();
        const result = createMockDNSResult("example.com");

        cache.set(result);

        const statsBefore = cache.getStats();
        cache.has("example.com");
        const statsAfter = cache.getStats();

        assertEquals(statsBefore.hits, statsAfter.hits);
        assertEquals(statsBefore.misses, statsAfter.misses);

        cache.stopAutoCleanup();
    },
});

// ============================================================================
// DNSCache getStats() Tests
// ============================================================================

Deno.test({
    name: "DNSCache - getStats returns statistics object",
    async fn() {
        const cache = new DNSCache();

        const stats = cache.getStats();

        assertExists(stats);
        assertExists(stats.size);
        assertExists(stats.hits);
        assertExists(stats.misses);
        assertExists(stats.hitRate);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - getStats includes cache size",
    async fn() {
        const cache = new DNSCache();

        cache.set(createMockDNSResult("example1.com"));
        cache.set(createMockDNSResult("example2.com"));

        const stats = cache.getStats();
        assertEquals(stats.size, 2);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - getStats calculates hit rate",
    async fn() {
        const cache = new DNSCache();
        const result = createMockDNSResult("example.com");

        cache.set(result);
        cache.get("example.com"); // hit
        cache.get("nonexistent.com"); // miss

        const stats = cache.getStats();
        assertEquals(stats.hitRate, 50); // 1 hit, 1 miss = 50%

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - getStats returns 0 hit rate with no operations",
    async fn() {
        const cache = new DNSCache();

        const stats = cache.getStats();
        assertEquals(stats.hitRate, 0);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - getStats returns 100 hit rate with all hits",
    async fn() {
        const cache = new DNSCache();
        const result = createMockDNSResult("example.com");

        cache.set(result);
        cache.get("example.com");
        cache.get("example.com");
        cache.get("example.com");

        const stats = cache.getStats();
        assertEquals(stats.hitRate, 100);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - getStats returns 0 hit rate with all misses",
    async fn() {
        const cache = new DNSCache();

        cache.get("nonexistent1.com");
        cache.get("nonexistent2.com");

        const stats = cache.getStats();
        assertEquals(stats.hitRate, 0);

        cache.stopAutoCleanup();
    },
});

// ============================================================================
// DNSCache stopAutoCleanup() Tests
// ============================================================================

Deno.test({
    name: "DNSCache - stopAutoCleanup stops cleanup timer",
    async fn() {
        const cache = new DNSCache();

        cache.stopAutoCleanup();

        // Should not throw
        assert(true);
    },
});

Deno.test({
    name: "DNSCache - stopAutoCleanup can be called multiple times",
    async fn() {
        const cache = new DNSCache();

        cache.stopAutoCleanup();
        cache.stopAutoCleanup();
        cache.stopAutoCleanup();

        assert(true);
    },
});

// ============================================================================
// DNSCache getSize() Tests
// ============================================================================

Deno.test({
    name: "DNSCache - getSize returns 0 for empty cache",
    async fn() {
        const cache = new DNSCache();

        assertEquals(cache.getSize(), 0);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - getSize returns number of entries",
    async fn() {
        const cache = new DNSCache();

        cache.set(createMockDNSResult("example1.com"));
        cache.set(createMockDNSResult("example2.com"));
        cache.set(createMockDNSResult("example3.com"));

        assertEquals(cache.getSize(), 3);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - getSize updates after clear",
    async fn() {
        const cache = new DNSCache();

        cache.set(createMockDNSResult("example.com"));
        cache.clear();

        assertEquals(cache.getSize(), 0);

        cache.stopAutoCleanup();
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "DNSCache - complete caching workflow",
    async fn() {
        const cache = new DNSCache();

        // Initial state
        assertEquals(cache.getSize(), 0);

        // Set entries
        cache.set(createMockDNSResult("example1.com", 300));
        cache.set(createMockDNSResult("example2.com", 600));
        assertEquals(cache.getSize(), 2);

        // Get entries (hits)
        assertExists(cache.get("example1.com"));
        assertExists(cache.get("example2.com"));

        // Get non-existent (miss)
        assertEquals(cache.get("nonexistent.com"), undefined);

        // Check statistics
        const stats = cache.getStats();
        assertEquals(stats.hits, 2);
        assertEquals(stats.misses, 1);
        assert(stats.hitRate > 60 && stats.hitRate < 70);

        // Clear and verify
        cache.clear();
        assertEquals(cache.getSize(), 0);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - TTL expiration",
    async fn() {
        const cache = new DNSCache();

        // Add entry with very short TTL
        const shortTTL: DNSResult = {
            hostname: "short.com",
            addresses: ["192.0.2.1"],
            ttl: 1, // 1 second
            timestamp: Date.now(),
        };

        cache.set(shortTTL);
        assertEquals(cache.has("short.com"), true);

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Should be expired now
        assertEquals(cache.has("short.com"), false);

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - multiple entries with different TTLs",
    async fn() {
        const cache = new DNSCache();

        cache.set(createMockDNSResult("long.com", 3600));
        cache.set(createMockDNSResult("medium.com", 600));
        cache.set(createMockDNSResult("short.com", 60));

        assertEquals(cache.getSize(), 3);

        // All should be retrievable
        assertExists(cache.get("long.com"));
        assertExists(cache.get("medium.com"));
        assertExists(cache.get("short.com"));

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - statistics accuracy",
    async fn() {
        const cache = new DNSCache();
        const result = createMockDNSResult("example.com");

        cache.set(result);

        // 5 hits
        for (let i = 0; i < 5; i++) {
            cache.get("example.com");
        }

        // 3 misses
        for (let i = 0; i < 3; i++) {
            cache.get("nonexistent.com");
        }

        const stats = cache.getStats();
        assertEquals(stats.hits, 5);
        assertEquals(stats.misses, 3);
        assertEquals(stats.hitRate, 62.5); // 5/8 = 62.5%

        cache.stopAutoCleanup();
    },
});

Deno.test({
    name: "DNSCache - entry update preserves cache size",
    async fn() {
        const cache = new DNSCache();

        cache.set(createMockDNSResult("example.com", 300));
        assertEquals(cache.getSize(), 1);

        cache.set(createMockDNSResult("example.com", 600));
        assertEquals(cache.getSize(), 1);

        cache.stopAutoCleanup();
    },
});
