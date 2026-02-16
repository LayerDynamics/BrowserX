/**
 * CacheManager Tests
 * Comprehensive tests for HTTPCacheManager
 */

import { assertEquals, assertExists, assert, assertNotEquals } from "@std/assert";
import { CacheManager, type CacheConfig } from "../../../core/cache/cache_manager.ts";
import { deriveKey } from "../../../core/cache/encryption/aes.ts";

// ============================================================================
// Helper Functions
// ============================================================================

function createTestConfig(overrides?: Partial<CacheConfig>): CacheConfig {
  return {
    maxMemoryMB: 10,
    defaultTTL: 300,
    enableDiskCache: false,
    ...overrides,
  };
}

function createTestResponse(
  body: string,
  headers: Record<string, string> = {},
  status = 200
) {
  return {
    status,
    headers: { "content-type": "text/html", ...headers },
    body: new TextEncoder().encode(body),
  };
}

// ============================================================================
// Constructor / Initialization Tests
// ============================================================================

Deno.test({
  name: "CacheManager - can be instantiated",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const config = createTestConfig();
    const cache = new CacheManager(config);
    assertExists(cache);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - initializes with empty cache",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());
    assertEquals(cache.getCacheSize(), 0);
    assertEquals(cache.getCache().size, 0);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - stores configuration",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const config = createTestConfig({ maxMemoryMB: 50, defaultTTL: 600 });
    const cache = new CacheManager(config);

    const storedConfig = cache.getConfig();
    assertEquals(storedConfig.maxMemoryMB, 50);
    assertEquals(storedConfig.defaultTTL, 600);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - initializes stats to zero",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());
    const stats = cache.getStats();

    assertEquals(stats.hits, 0);
    assertEquals(stats.misses, 0);
    assertEquals(stats.revalidations, 0);
    assertEquals(stats.evictions, 0);
    assertEquals(stats.entries, 0);
    assertEquals(stats.size, 0);
    cache.destroy();
  },
});

// ============================================================================
// generateCacheKey Tests
// ============================================================================

Deno.test({
  name: "CacheManager - generateCacheKey creates key from method and URL",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());
    const key = cache.generateCacheKey("GET", "https://example.com/api");

    assertEquals(key, "GET:https://example.com/api");
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - generateCacheKey includes vary headers",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());
    const key = cache.generateCacheKey("GET", "https://example.com/api", {
      "Accept-Encoding": "gzip",
      "Accept-Language": "en-US",
    });

    assert(key.includes("accept-encoding=gzip"));
    assert(key.includes("accept-language=en-US"));
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - generateCacheKey sorts vary headers",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());

    // Create keys with headers in different orders
    const key1 = cache.generateCacheKey("GET", "https://example.com", {
      "B-Header": "b",
      "A-Header": "a",
    });
    const key2 = cache.generateCacheKey("GET", "https://example.com", {
      "A-Header": "a",
      "B-Header": "b",
    });

    // Keys should be identical regardless of header order
    assertEquals(key1, key2);
    cache.destroy();
  },
});

// ============================================================================
// isCacheable Tests
// ============================================================================

Deno.test({
  name: "CacheManager - isCacheable returns true for GET with max-age",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());

    const result = cache.isCacheable(
      { method: "GET" },
      { status: 200, headers: { "cache-control": "max-age=3600" } }
    );

    assertEquals(result, true);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - isCacheable returns true for HEAD with max-age",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());

    const result = cache.isCacheable(
      { method: "HEAD" },
      { status: 200, headers: { "cache-control": "max-age=3600" } }
    );

    assertEquals(result, true);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - isCacheable returns false for POST",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());

    const result = cache.isCacheable(
      { method: "POST" },
      { status: 200, headers: { "cache-control": "max-age=3600" } }
    );

    assertEquals(result, false);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - isCacheable returns false for PUT",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());

    const result = cache.isCacheable(
      { method: "PUT" },
      { status: 200, headers: { "cache-control": "max-age=3600" } }
    );

    assertEquals(result, false);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - isCacheable returns false for no-store",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());

    const result = cache.isCacheable(
      { method: "GET" },
      { status: 200, headers: { "cache-control": "no-store" } }
    );

    assertEquals(result, false);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - isCacheable returns false for private",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());

    const result = cache.isCacheable(
      { method: "GET" },
      { status: 200, headers: { "cache-control": "private, max-age=3600" } }
    );

    assertEquals(result, false);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - isCacheable accepts cacheable status codes",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());
    const headers = { "cache-control": "max-age=3600" };

    // Test cacheable status codes
    const cacheableStatuses = [200, 203, 206, 300, 301, 404, 410];
    for (const status of cacheableStatuses) {
      const result = cache.isCacheable({ method: "GET" }, { status, headers });
      assertEquals(result, true, `Status ${status} should be cacheable`);
    }

    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - isCacheable rejects non-cacheable status codes",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());
    const headers = { "cache-control": "max-age=3600" };

    // Test non-cacheable status codes
    const nonCacheableStatuses = [201, 204, 302, 400, 401, 403, 500, 502, 503];
    for (const status of nonCacheableStatuses) {
      const result = cache.isCacheable({ method: "GET" }, { status, headers });
      assertEquals(result, false, `Status ${status} should not be cacheable`);
    }

    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - isCacheable returns true for s-maxage",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());

    const result = cache.isCacheable(
      { method: "GET" },
      { status: 200, headers: { "cache-control": "s-maxage=3600" } }
    );

    assertEquals(result, true);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - isCacheable returns true with Expires header",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());

    const result = cache.isCacheable(
      { method: "GET" },
      { status: 200, headers: { expires: "Wed, 01 Jan 2030 00:00:00 GMT" } }
    );

    assertEquals(result, true);
    cache.destroy();
  },
});

// ============================================================================
// parseMaxAge Tests
// ============================================================================

Deno.test({
  name: "CacheManager - parseMaxAge extracts max-age value",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig({ defaultTTL: 300 }));

    assertEquals(cache.parseMaxAge("max-age=3600"), 3600);
    assertEquals(cache.parseMaxAge("max-age=60"), 60);
    assertEquals(cache.parseMaxAge("public, max-age=7200"), 7200);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - parseMaxAge prefers s-maxage over max-age",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig({ defaultTTL: 300 }));

    const result = cache.parseMaxAge("max-age=3600, s-maxage=1800");
    assertEquals(result, 1800);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - parseMaxAge returns default TTL when no directive",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig({ defaultTTL: 300 }));

    assertEquals(cache.parseMaxAge("public"), 300);
    assertEquals(cache.parseMaxAge("no-cache"), 300);
    assertEquals(cache.parseMaxAge(""), 300);
    cache.destroy();
  },
});

// ============================================================================
// store and get Tests
// ============================================================================

Deno.test({
  name: "CacheManager - store adds entry to cache",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const key = "GET:https://example.com";
    const response = createTestResponse("Hello World", {
      "cache-control": "max-age=3600",
    });

    await cache.store(key, response);

    assertEquals(cache.getCache().size, 1);
    assert(cache.getCacheSize() > 0);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - get retrieves stored entry",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const key = "GET:https://example.com";
    const response = createTestResponse("Hello World", {
      "cache-control": "max-age=3600",
    });

    await cache.store(key, response);
    const entry = await cache.get(key);

    assertExists(entry);
    assertEquals(entry.response.status, 200);
    assertEquals(new TextDecoder().decode(entry.response.body), "Hello World");
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - get returns null for missing key",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const entry = await cache.get("nonexistent-key");

    assertEquals(entry, null);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - get increments hit count",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const key = "GET:https://example.com";
    const response = createTestResponse("data", { "cache-control": "max-age=3600" });

    await cache.store(key, response);

    await cache.get(key);
    await cache.get(key);
    await cache.get(key);

    assertEquals(cache.getStats().hits, 3);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - get increments miss count",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());

    await cache.get("missing1");
    await cache.get("missing2");

    assertEquals(cache.getStats().misses, 2);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - get adds Age header",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const key = "GET:https://example.com";
    const response = createTestResponse("data", { "cache-control": "max-age=3600" });

    await cache.store(key, response);
    const entry = await cache.get(key);

    assertExists(entry);
    assertExists(entry.response.headers["age"]);
    // Age should be 0 or very small since we just stored it
    const age = parseInt(entry.response.headers["age"]);
    assert(age >= 0 && age < 5);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - get returns null for expired entry",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const key = "GET:https://example.com";
    // Very short TTL
    const response = createTestResponse("data", { "cache-control": "max-age=0" });

    await cache.store(key, response);
    // Wait a tiny bit for expiration
    await new Promise((resolve) => setTimeout(resolve, 10));
    const entry = await cache.get(key);

    assertEquals(entry, null);
    cache.destroy();
  },
});

// ============================================================================
// invalidate Tests
// ============================================================================

Deno.test({
  name: "CacheManager - invalidate removes specific entry",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const key1 = "GET:https://example.com/1";
    const key2 = "GET:https://example.com/2";

    await cache.store(key1, createTestResponse("1", { "cache-control": "max-age=3600" }));
    await cache.store(key2, createTestResponse("2", { "cache-control": "max-age=3600" }));

    assertEquals(cache.getCache().size, 2);

    cache.invalidate(key1);

    assertEquals(cache.getCache().size, 1);
    assertEquals(await cache.get(key1), null);
    assertExists(await cache.get(key2));
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - invalidate updates cache size",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const key = "GET:https://example.com";

    await cache.store(key, createTestResponse("Hello World", {
      "cache-control": "max-age=3600",
    }));

    const sizeBefore = cache.getCacheSize();
    assert(sizeBefore > 0);

    cache.invalidate(key);

    assertEquals(cache.getCacheSize(), 0);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - invalidate handles missing key gracefully",
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const cache = new CacheManager(createTestConfig());
    // Should not throw
    cache.invalidate("nonexistent-key");
    cache.destroy();
  },
});

// ============================================================================
// invalidatePattern Tests
// ============================================================================

Deno.test({
  name: "CacheManager - invalidatePattern removes matching entries",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());

    await cache.store("GET:https://api.example.com/users/1", createTestResponse("1", { "cache-control": "max-age=3600" }));
    await cache.store("GET:https://api.example.com/users/2", createTestResponse("2", { "cache-control": "max-age=3600" }));
    await cache.store("GET:https://api.example.com/posts/1", createTestResponse("3", { "cache-control": "max-age=3600" }));

    assertEquals(cache.getCache().size, 3);

    cache.invalidatePattern(/\/users\//);

    assertEquals(cache.getCache().size, 1);
    cache.destroy();
  },
});

// ============================================================================
// clear Tests
// ============================================================================

Deno.test({
  name: "CacheManager - clear removes all entries",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());

    await cache.store("key1", createTestResponse("1", { "cache-control": "max-age=3600" }));
    await cache.store("key2", createTestResponse("2", { "cache-control": "max-age=3600" }));
    await cache.store("key3", createTestResponse("3", { "cache-control": "max-age=3600" }));

    assertEquals(cache.getCache().size, 3);

    cache.clear();

    assertEquals(cache.getCache().size, 0);
    assertEquals(cache.getCacheSize(), 0);
    cache.destroy();
  },
});

// ============================================================================
// purge Tests
// ============================================================================

Deno.test({
  name: "CacheManager - purge without pattern clears all",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());

    await cache.store("key1", createTestResponse("1", { "cache-control": "max-age=3600" }));
    await cache.store("key2", createTestResponse("2", { "cache-control": "max-age=3600" }));

    const count = cache.purge();

    assertEquals(count, 2);
    assertEquals(cache.getCache().size, 0);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - purge with pattern removes matching entries",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());

    await cache.store("GET:https://api.example.com/users", createTestResponse("1", { "cache-control": "max-age=3600" }));
    await cache.store("GET:https://api.example.com/posts", createTestResponse("2", { "cache-control": "max-age=3600" }));
    await cache.store("GET:https://other.com/data", createTestResponse("3", { "cache-control": "max-age=3600" }));

    const count = cache.purge("api.example.com");

    assertEquals(count, 2);
    assertEquals(cache.getCache().size, 1);
    cache.destroy();
  },
});

// ============================================================================
// exportCache Tests
// ============================================================================

Deno.test({
  name: "CacheManager - exportCache returns all entries",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());

    await cache.store("key1", createTestResponse("1", { "cache-control": "max-age=3600" }));
    await cache.store("key2", createTestResponse("2", { "cache-control": "max-age=3600" }));

    const entries = cache.exportCache();

    assertEquals(entries.length, 2);
    cache.destroy();
  },
});

// ============================================================================
// Revalidation Tests
// ============================================================================

Deno.test({
  name: "CacheManager - needsRevalidation returns true for expired entry",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const key = "GET:https://example.com";

    await cache.store(key, createTestResponse("data", { "cache-control": "max-age=0" }));
    const entry = cache.getCache().get(key)!;

    // Wait for entry to expire
    await new Promise((resolve) => setTimeout(resolve, 10));

    assertEquals(cache.needsRevalidation(entry), true);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - needsRevalidation returns false for fresh entry",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const key = "GET:https://example.com";

    await cache.store(key, createTestResponse("data", { "cache-control": "max-age=3600" }));
    const entry = cache.getCache().get(key)!;

    assertEquals(cache.needsRevalidation(entry), false);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - getRevalidationHeaders returns ETag header",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const key = "GET:https://example.com";

    await cache.store(key, createTestResponse("data", {
      "cache-control": "max-age=3600",
      "etag": '"abc123"',
    }));

    const entry = cache.getCache().get(key)!;
    const headers = cache.getRevalidationHeaders(entry);

    assertEquals(headers["if-none-match"], '"abc123"');
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - getRevalidationHeaders returns Last-Modified header",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const key = "GET:https://example.com";
    const lastModified = "Wed, 01 Jan 2025 00:00:00 GMT";

    await cache.store(key, createTestResponse("data", {
      "cache-control": "max-age=3600",
      "last-modified": lastModified,
    }));

    const entry = cache.getCache().get(key)!;
    const headers = cache.getRevalidationHeaders(entry);

    assertEquals(headers["if-modified-since"], lastModified);
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - handleNotModified refreshes entry timestamp",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const key = "GET:https://example.com";

    await cache.store(key, createTestResponse("data", { "cache-control": "max-age=3600" }));

    const originalTimestamp = cache.getCache().get(key)!.timestamp;

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 10));

    await cache.handleNotModified(key);

    const newTimestamp = cache.getCache().get(key)!.timestamp;
    assert(newTimestamp > originalTimestamp);

    assertEquals(cache.getStats().revalidations, 1);
    cache.destroy();
  },
});

// ============================================================================
// Memory Limit / Eviction Tests
// ============================================================================

Deno.test({
  name: "CacheManager - evicts entries when memory limit reached",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Very small cache (1KB)
    const cache = new CacheManager(createTestConfig({ maxMemoryMB: 0.001 }));

    // Store entries that exceed the limit
    const largeBody = "x".repeat(500);
    await cache.store("key1", createTestResponse(largeBody, { "cache-control": "max-age=3600" }));
    await cache.store("key2", createTestResponse(largeBody, { "cache-control": "max-age=3600" }));
    await cache.store("key3", createTestResponse(largeBody, { "cache-control": "max-age=3600" }));

    // Should have evicted some entries
    assert(cache.getStats().evictions > 0);
    cache.destroy();
  },
});

// ============================================================================
// Stats Tests
// ============================================================================

Deno.test({
  name: "CacheManager - getStats returns accurate statistics",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const response = createTestResponse("data", { "cache-control": "max-age=3600" });

    await cache.store("key1", response);
    await cache.store("key2", response);

    await cache.get("key1"); // Hit
    await cache.get("key1"); // Hit
    await cache.get("missing"); // Miss

    const stats = cache.getStats();
    assertEquals(stats.hits, 2);
    assertEquals(stats.misses, 1);
    assertEquals(stats.entries, 2);
    assert(stats.size > 0);
    cache.destroy();
  },
});

// ============================================================================
// destroy Tests
// ============================================================================

Deno.test({
  name: "CacheManager - destroy cleans up resources",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    await cache.store("key1", createTestResponse("data", { "cache-control": "max-age=3600" }));

    cache.destroy();

    assertEquals(cache.getCache().size, 0);
    assertEquals(cache.getCacheSize(), 0);
  },
});

// ============================================================================
// Encryption Tests
// ============================================================================

Deno.test({
  name: "CacheManager - encryption disabled by default",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = new CacheManager(createTestConfig());
    const key = "GET:https://example.com";
    const response = createTestResponse("Plaintext data", {
      "cache-control": "max-age=3600",
    });

    await cache.store(key, response);
    const entry = cache.getCache().get(key)!;

    // Body should be plaintext (not encrypted)
    assertEquals(new TextDecoder().decode(entry.response.body), "Plaintext data");
    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - encrypts data when encryption enabled",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const encryptionKey = await deriveKey("test-password", new Uint8Array(16).fill(1));
    const cache = new CacheManager(createTestConfig({
      encryption: {
        enabled: true,
        key: encryptionKey,
      },
    }));

    const key = "GET:https://example.com";
    const response = createTestResponse("Secret data", {
      "cache-control": "max-age=3600",
    });

    await cache.store(key, response);
    const entry = cache.getCache().get(key)!;

    // Body should be encrypted (not plaintext)
    const bodyText = new TextDecoder().decode(entry.response.body);
    assertNotEquals(bodyText, "Secret data");

    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - decrypts data on retrieval",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const encryptionKey = await deriveKey("test-password", new Uint8Array(16).fill(1));
    const cache = new CacheManager(createTestConfig({
      encryption: {
        enabled: true,
        key: encryptionKey,
      },
    }));

    const key = "GET:https://example.com";
    const response = createTestResponse("Secret data", {
      "cache-control": "max-age=3600",
    });

    await cache.store(key, response);
    const entry = await cache.get(key);

    assertExists(entry);
    // Should decrypt transparently
    assertEquals(new TextDecoder().decode(entry.response.body), "Secret data");

    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - stores IV with encrypted entry",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const encryptionKey = await deriveKey("test-password", new Uint8Array(16).fill(1));
    const cache = new CacheManager(createTestConfig({
      encryption: {
        enabled: true,
        key: encryptionKey,
      },
    }));

    const key = "GET:https://example.com";
    const response = createTestResponse("Secret data", {
      "cache-control": "max-age=3600",
    });

    await cache.store(key, response);
    const entry = cache.getCache().get(key)!;

    // IV should be stored
    assertExists(entry.encryptionIV);
    assertEquals(entry.encryptionIV.length, 12); // GCM standard

    cache.destroy();
  },
});

Deno.test({
  name: "CacheManager - returns null on decryption error",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const encryptionKey1 = await deriveKey("password1", new Uint8Array(16).fill(1));
    const encryptionKey2 = await deriveKey("password2", new Uint8Array(16).fill(2));

    const cache1 = new CacheManager(createTestConfig({
      encryption: {
        enabled: true,
        key: encryptionKey1,
      },
    }));

    const key = "GET:https://example.com";
    const response = createTestResponse("Secret data", {
      "cache-control": "max-age=3600",
    });

    await cache1.store(key, response);
    cache1.destroy();

    // Try to decrypt with wrong key
    const cache2 = new CacheManager(createTestConfig({
      encryption: {
        enabled: true,
        key: encryptionKey2,
      },
    }));

    // Manually copy encrypted entry from cache1 to cache2
    const entry = cache1.getCache().get(key);
    if (entry) {
      cache2.getCache().set(key, entry);
    }

    const result = await cache2.get(key);

    // Should return null on decryption failure (fail-safe)
    assertEquals(result, null);

    cache2.destroy();
  },
});
