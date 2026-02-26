/**
 * Integration Tests: Cache Integration
 *
 * Tests the HTTP cache manager with real caching workflows:
 * - Cache miss -> store -> cache hit
 * - TTL expiry and invalidation
 * - Cache-Control header parsing (max-age, s-maxage, no-store, private)
 * - LRU eviction under memory pressure
 * - Cache key generation with Vary headers
 * - Revalidation headers (ETag, Last-Modified)
 * - Pattern-based invalidation
 * - Cache statistics tracking
 */

import { assertEquals, assert } from "@std/assert";
import { CacheManager, type CacheConfig } from "../../core/cache/cache_manager.ts";
import { MemoryStorage } from "../../core/cache/kv/storage.ts";

// Helper: create a cache manager with test defaults
function makeCache(overrides: Partial<CacheConfig> = {}): CacheManager {
  return new CacheManager({
    maxMemoryMB: 1,
    defaultTTL: 60,
    enableDiskCache: false,
    ...overrides,
  });
}

// Helper: create a cacheable response
function makeResponse(
  body: string,
  headers: Record<string, string> = {},
  status = 200,
) {
  return {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "max-age=300, public",
      ...headers,
    },
    body: new TextEncoder().encode(body),
  };
}

// --- Tests ---

Deno.test({ name: "cache-integration: miss then store then hit", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const cache = makeCache();

  const key = cache.generateCacheKey("GET", "http://example.com/api/users");

  // First: cache miss
  const miss = await cache.get(key);
  assertEquals(miss, null);

  // Store response
  const response = makeResponse('{"users":[]}');
  await cache.store(key, response);

  // Second: cache hit
  const hit = await cache.get(key);
  assert(hit !== null, "Should be a cache hit");
  assertEquals(hit!.response.status, 200);
  const body = new TextDecoder().decode(hit!.response.body);
  assertEquals(body, '{"users":[]}');

  cache.destroy();
}});

Deno.test({ name: "cache-integration: TTL expiry returns null", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const cache = makeCache({ defaultTTL: 1 }); // 1 second default

  const key = cache.generateCacheKey("GET", "http://example.com/data");
  // Store with very short max-age via header
  await cache.store(key, makeResponse("data", { "cache-control": "max-age=1" }));

  // Immediate hit should work
  const hit = await cache.get(key);
  assert(hit !== null);

  // Wait for expiry
  await new Promise((r) => setTimeout(r, 1100));

  // Now should be expired
  const expired = await cache.get(key);
  assertEquals(expired, null);

  cache.destroy();
}});

Deno.test({ name: "cache-integration: no-store response is not cacheable", sanitizeOps: false, sanitizeResources: false, fn: () => {
  const cache = makeCache();

  const result = cache.isCacheable(
    { method: "GET" },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
  assertEquals(result, false);

  cache.destroy();
}});

Deno.test({ name: "cache-integration: private response is not cacheable in shared proxy", sanitizeOps: false, sanitizeResources: false, fn: () => {
  const cache = makeCache();

  const result = cache.isCacheable(
    { method: "GET" },
    { status: 200, headers: { "cache-control": "private, max-age=600" } },
  );
  assertEquals(result, false);

  cache.destroy();
}});

Deno.test({ name: "cache-integration: POST requests are not cacheable", sanitizeOps: false, sanitizeResources: false, fn: () => {
  const cache = makeCache();

  const result = cache.isCacheable(
    { method: "POST" },
    { status: 200, headers: { "cache-control": "max-age=300" } },
  );
  assertEquals(result, false);

  cache.destroy();
}});

Deno.test({ name: "cache-integration: s-maxage takes precedence over max-age", sanitizeOps: false, sanitizeResources: false, fn: () => {
  const cache = makeCache();

  const maxAge = cache.parseMaxAge("max-age=60, s-maxage=120");
  assertEquals(maxAge, 120);

  cache.destroy();
}});

Deno.test({ name: "cache-integration: cache key includes Vary headers", sanitizeOps: false, sanitizeResources: false, fn: () => {
  const cache = makeCache();

  const key1 = cache.generateCacheKey("GET", "http://example.com/api", { "accept-language": "en" });
  const key2 = cache.generateCacheKey("GET", "http://example.com/api", { "accept-language": "fr" });

  assert(key1 !== key2, "Different Vary header values should produce different keys");

  const key3 = cache.generateCacheKey("GET", "http://example.com/api", { "accept-language": "en" });
  assertEquals(key1, key3, "Same Vary values should produce same key");

  cache.destroy();
}});

Deno.test({ name: "cache-integration: explicit invalidation removes entry", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const cache = makeCache();

  const key = cache.generateCacheKey("GET", "http://example.com/page");
  await cache.store(key, makeResponse("page content"));

  // Verify stored
  const hit = await cache.get(key);
  assert(hit !== null);

  // Invalidate
  cache.invalidate(key);

  // Should be gone
  const miss = await cache.get(key);
  assertEquals(miss, null);

  cache.destroy();
}});

Deno.test({ name: "cache-integration: pattern invalidation removes matching entries", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const cache = makeCache();

  await cache.store(
    cache.generateCacheKey("GET", "http://example.com/api/users/1"),
    makeResponse("user 1"),
  );
  await cache.store(
    cache.generateCacheKey("GET", "http://example.com/api/users/2"),
    makeResponse("user 2"),
  );
  await cache.store(
    cache.generateCacheKey("GET", "http://example.com/api/posts/1"),
    makeResponse("post 1"),
  );

  // Invalidate all user entries
  cache.invalidatePattern(/users/);

  const stats = cache.getStats();
  assertEquals(stats.entries, 1); // only posts remain

  cache.destroy();
}});

Deno.test({ name: "cache-integration: LRU eviction when memory limit exceeded", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  // Very small cache: 1KB
  const cache = makeCache({ maxMemoryMB: 0.001 });

  // Store entries that exceed the limit
  const largeBody = "x".repeat(600);
  await cache.store("key1", makeResponse(largeBody));
  await cache.store("key2", makeResponse(largeBody));

  // key1 should have been evicted to make room for key2
  const stats = cache.getStats();
  assert(stats.evictions > 0, "Should have evictions");

  cache.destroy();
}});

Deno.test({ name: "cache-integration: stats track hits and misses", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const cache = makeCache();

  const key = cache.generateCacheKey("GET", "http://example.com/tracked");
  await cache.store(key, makeResponse("data"));

  // 1 miss
  await cache.get(cache.generateCacheKey("GET", "http://example.com/nonexistent"));
  // 2 hits
  await cache.get(key);
  await cache.get(key);

  const stats = cache.getStats();
  assertEquals(stats.hits, 2);
  assertEquals(stats.misses, 1);

  cache.destroy();
}});

Deno.test({ name: "cache-integration: revalidation headers from ETag and Last-Modified", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const cache = makeCache();

  const key = cache.generateCacheKey("GET", "http://example.com/resource");
  await cache.store(key, makeResponse("data", {
    "cache-control": "max-age=300",
    "etag": '"abc123"',
    "last-modified": "Wed, 01 Jan 2025 00:00:00 GMT",
  }));

  const entry = await cache.get(key);
  assert(entry !== null);

  const revalHeaders = cache.getRevalidationHeaders(entry!);
  assertEquals(revalHeaders["if-none-match"], '"abc123"');
  assertEquals(revalHeaders["if-modified-since"], "Wed, 01 Jan 2025 00:00:00 GMT");

  cache.destroy();
}});

Deno.test({ name: "cache-integration: handleNotModified refreshes timestamp", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const cache = makeCache();

  const key = cache.generateCacheKey("GET", "http://example.com/revalidate");
  await cache.store(key, makeResponse("data", { "cache-control": "max-age=300" }));

  // Get initial entry
  const initial = await cache.get(key);
  assert(initial !== null);
  const initialTimestamp = initial!.timestamp;

  // Wait a bit
  await new Promise((r) => setTimeout(r, 50));

  // Revalidate (304)
  await cache.handleNotModified(key);

  // Get again - timestamp should be updated
  const refreshed = cache.getCache().get(key);
  assert(refreshed !== null);
  assert(refreshed!.timestamp >= initialTimestamp);

  const stats = cache.getStats();
  assertEquals(stats.revalidations, 1);

  cache.destroy();
}});

Deno.test({ name: "cache-integration: purge clears all or by pattern", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const cache = makeCache();

  await cache.store("a:1", makeResponse("a1"));
  await cache.store("a:2", makeResponse("a2"));
  await cache.store("b:1", makeResponse("b1"));

  // Purge by pattern
  const purged = cache.purge("^a:");
  assertEquals(purged, 2);
  assertEquals(cache.getStats().entries, 1);

  // Purge all
  const purgedAll = cache.purge();
  assertEquals(purgedAll, 1);
  assertEquals(cache.getStats().entries, 0);

  cache.destroy();
}});

Deno.test({ name: "cache-integration: MemoryStorage set and get round-trip", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const storage = new MemoryStorage(1024); // 1KB

  const data = new TextEncoder().encode("hello world");
  await storage.set("key1", data);

  assert(await storage.has("key1"));
  const retrieved = await storage.get("key1");
  assert(retrieved !== null);
  assertEquals(new TextDecoder().decode(retrieved!), "hello world");

  // Keys
  const keys = await storage.keys();
  assertEquals(keys, ["key1"]);

  // Delete
  await storage.delete("key1");
  assertEquals(await storage.has("key1"), false);
}});

Deno.test({ name: "cache-integration: MemoryStorage evicts on size limit", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const storage = new MemoryStorage(100); // 100 bytes

  // Fill storage beyond limit
  await storage.set("key1", new Uint8Array(60));
  await storage.set("key2", new Uint8Array(60)); // should evict key1

  assertEquals(await storage.has("key1"), false);
  assertEquals(await storage.has("key2"), true);
}});

Deno.test({ name: "cache-integration: only GET and HEAD are cacheable", sanitizeOps: false, sanitizeResources: false, fn: () => {
  const cache = makeCache();

  const headers = { "cache-control": "max-age=300" };
  assert(cache.isCacheable({ method: "GET" }, { status: 200, headers }));
  assert(cache.isCacheable({ method: "HEAD" }, { status: 200, headers }));
  assertEquals(cache.isCacheable({ method: "POST" }, { status: 200, headers }), false);
  assertEquals(cache.isCacheable({ method: "PUT" }, { status: 200, headers }), false);
  assertEquals(cache.isCacheable({ method: "DELETE" }, { status: 200, headers }), false);

  cache.destroy();
}});
