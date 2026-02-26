// Shim HTMLElement for Deno (GraphXCanvas extends it at top level)
if (typeof globalThis.HTMLElement === "undefined") {
  (globalThis as Record<string, unknown>).HTMLElement = class HTMLElement {};
}

/**
 * E2E Tests: Browser → Proxy → Cache
 *
 * Validates the caching layer of the proxy engine:
 * cache miss → store → cache hit → expiry → upstream again.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { CacheManager } from "../../proxy-engine/core/cache/cache_manager.ts";
import { Browser } from "../../browser/src/main.ts";
import { RenderingPipeline } from "../../browser/src/engine/RenderingPipeline.ts";
import { RequestPipeline } from "../../browser/src/engine/RequestPipeline.ts";

// ============================================================================
// Test Helpers
// ============================================================================

function createDataURL(html: string): string {
  return `data:text/html,${encodeURIComponent(html)}`;
}

/**
 * Create an HTTPCacheManager with test-friendly config
 */
function createTestCache(): CacheManager {
  return new CacheManager({
    maxMemoryMB: 10,
    defaultTTL: 60,
    enableDiskCache: false,
  });
}

// ============================================================================
// Cache Miss → Store → Hit Tests
// ============================================================================

Deno.test({
  name: "E2E Browser-Proxy-Cache - Cache miss on first request, store, then cache hit",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = createTestCache();

    try {
      const cacheKey = cache.generateCacheKey("GET", "https://example.com/page");

      // First request: cache miss
      const miss = await cache.get(cacheKey);
      assertEquals(miss, null);

      const statsBefore = cache.getStats();
      assertEquals(statsBefore.misses, 1);
      assertEquals(statsBefore.hits, 0);

      // Store a response (simulating upstream response)
      const responseBody = new TextEncoder().encode("<html><body>Hello</body></html>");
      await cache.store(cacheKey, {
        status: 200,
        headers: {
          "content-type": "text/html",
          "cache-control": "max-age=300",
        },
        body: responseBody,
      });

      // Second request: cache hit
      const hit = await cache.get(cacheKey);
      assertExists(hit);
      assertEquals(hit.response.status, 200);
      assertEquals(new TextDecoder().decode(hit.response.body), "<html><body>Hello</body></html>");

      const statsAfter = cache.getStats();
      assertEquals(statsAfter.hits, 1);
      assertEquals(statsAfter.entries, 1);
    } finally {
      cache.destroy();
    }
  },
});

Deno.test({
  name: "E2E Browser-Proxy-Cache - Cache expiry causes subsequent miss",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = createTestCache();

    try {
      const cacheKey = cache.generateCacheKey("GET", "https://example.com/expire");

      // Store with very short TTL (1 second max-age)
      const body = new TextEncoder().encode("short-lived content");
      await cache.store(cacheKey, {
        status: 200,
        headers: {
          "content-type": "text/plain",
          "cache-control": "max-age=1",
        },
        body,
      });

      // Immediate hit should work
      const hit = await cache.get(cacheKey);
      assertExists(hit);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // After expiry: cache miss
      const expired = await cache.get(cacheKey);
      assertEquals(expired, null);

      // Stats should reflect the miss
      const stats = cache.getStats();
      assert(stats.misses >= 1, "Expected at least 1 miss after expiry");
    } finally {
      cache.destroy();
    }
  },
});

Deno.test({
  name: "E2E Browser-Proxy-Cache - No-store directive prevents caching",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = createTestCache();

    try {
      // Verify isCacheable correctly rejects no-store
      const isCacheable = cache.isCacheable(
        { method: "GET" },
        {
          status: 200,
          headers: { "cache-control": "no-store" },
        },
      );
      assertEquals(isCacheable, false);

      // Verify POST requests are not cacheable
      const postCacheable = cache.isCacheable(
        { method: "POST" },
        {
          status: 200,
          headers: { "cache-control": "max-age=300" },
        },
      );
      assertEquals(postCacheable, false);

      // Verify cacheable GET with max-age
      const getCacheable = cache.isCacheable(
        { method: "GET" },
        {
          status: 200,
          headers: { "cache-control": "max-age=300" },
        },
      );
      assertEquals(getCacheable, true);
    } finally {
      cache.destroy();
    }
  },
});

Deno.test({
  name: "E2E Browser-Proxy-Cache - Browser renders data URL, cache stores rendered content",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = new Browser({ width: 800, height: 600 });
    const cache = createTestCache();

    try {
      const html = "<html><head><title>Cached Page</title></head><body><p>Content</p></body></html>";
      const url = createDataURL(html);

      // Browser navigates and renders the page
      await browser.navigate(url);
      assertEquals(browser.getCurrentURL(), url);

      // Simulate caching the rendered response in the proxy cache
      const cacheKey = cache.generateCacheKey("GET", url);
      const body = new TextEncoder().encode(html);
      await cache.store(cacheKey, {
        status: 200,
        headers: {
          "content-type": "text/html",
          "cache-control": "max-age=600",
        },
        body,
      });

      // Verify cache contains the response
      const cached = await cache.get(cacheKey);
      assertExists(cached);
      assertEquals(cached.response.status, 200);

      const cachedHtml = new TextDecoder().decode(cached.response.body);
      assert(cachedHtml.includes("Cached Page"));
      assert(cachedHtml.includes("Content"));
    } finally {
      cache.destroy();
      await browser.close();
    }
  },
});

Deno.test({
  name: "E2E Browser-Proxy-Cache - Vary headers produce different cache keys",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const cache = createTestCache();

    try {
      const url = "https://example.com/api/data";

      // Same URL, different Vary headers → different cache keys
      const keyJson = cache.generateCacheKey("GET", url, { "accept": "application/json" });
      const keyHtml = cache.generateCacheKey("GET", url, { "accept": "text/html" });
      const keyPlain = cache.generateCacheKey("GET", url);

      // All three keys should be distinct
      assert(keyJson !== keyHtml, "JSON and HTML cache keys should differ");
      assert(keyJson !== keyPlain, "JSON and plain cache keys should differ");
      assert(keyHtml !== keyPlain, "HTML and plain cache keys should differ");

      // Store different responses per key
      await cache.store(keyJson, {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "max-age=60" },
        body: new TextEncoder().encode('{"data": "json"}'),
      });

      await cache.store(keyHtml, {
        status: 200,
        headers: { "content-type": "text/html", "cache-control": "max-age=60" },
        body: new TextEncoder().encode("<html>html</html>"),
      });

      // Verify independent retrieval
      const jsonHit = await cache.get(keyJson);
      assertExists(jsonHit);
      assert(new TextDecoder().decode(jsonHit.response.body).includes("json"));

      const htmlHit = await cache.get(keyHtml);
      assertExists(htmlHit);
      assert(new TextDecoder().decode(htmlHit.response.body).includes("html"));

      assertEquals(cache.getStats().entries, 2);
    } finally {
      cache.destroy();
    }
  },
});
