/**
 * CacheAPI Tests
 */

import { assertEquals, assertExists } from "@std/assert";
import { Cache, CacheStorage } from "../../../src/engine/storage/CacheAPI.ts";
import { QuotaManager } from "../../../src/engine/storage/QuotaManager.ts";
import type { HTTPRequest, HTTPResponse } from "../../../src/types/http.ts";

// ============================================================================
// Helpers
// ============================================================================

function makeRequest(url: string, method = "GET"): HTTPRequest {
  return {
    id: `req-${Date.now()}`,
    method,
    url,
    version: "1.1",
    headers: new Map(),
    createdAt: Date.now(),
  } as HTTPRequest;
}

function makeResponse(status = 200, body = "OK", headers?: Map<string, string>): HTTPResponse {
  const encoder = new TextEncoder();
  return {
    id: `res-${Date.now()}`,
    statusCode: status,
    statusText: "OK",
    version: "1.1",
    headers: headers ?? new Map(),
    body: encoder.encode(body),
    receivedAt: Date.now(),
    fromCache: false,
    timings: {
      dnsStart: 0,
      dnsEnd: 0,
      connectStart: 0,
      connectEnd: 0,
      requestStart: 0,
      responseStart: 0,
      responseEnd: 0,
    },
  } as HTTPResponse;
}

// ============================================================================
// Cache.put / Cache.match
// ============================================================================

Deno.test("CacheAPI - put stores and match retrieves", async () => {
  const qm = new QuotaManager();
  const cache = new Cache("test", "https://example.com", qm);

  const req = makeRequest("https://example.com/page");
  const res = makeResponse(200, "Hello");

  await cache.put(req, res);
  const matched = await cache.match("https://example.com/page");

  assertExists(matched);
  assertEquals(matched.statusCode, 200);
});

Deno.test("CacheAPI - match returns undefined for miss", async () => {
  const qm = new QuotaManager();
  const cache = new Cache("test", "https://example.com", qm);

  const result = await cache.match("https://example.com/missing");
  assertEquals(result, undefined);
});

Deno.test("CacheAPI - match with request object", async () => {
  const qm = new QuotaManager();
  const cache = new Cache("test", "https://example.com", qm);

  const req = makeRequest("https://example.com/api");
  await cache.put(req, makeResponse(200, "data"));

  const matched = await cache.match(makeRequest("https://example.com/api"));
  assertExists(matched);
});

// ============================================================================
// Cache.delete
// ============================================================================

Deno.test("CacheAPI - delete removes entry", async () => {
  const qm = new QuotaManager();
  const cache = new Cache("test", "https://example.com", qm);

  await cache.put(makeRequest("https://example.com/a"), makeResponse());
  assertEquals(cache.getCount(), 1);

  const deleted = await cache.delete("https://example.com/a");
  assertEquals(deleted, true);
  assertEquals(cache.getCount(), 0);

  const matched = await cache.match("https://example.com/a");
  assertEquals(matched, undefined);
});

Deno.test("CacheAPI - delete returns false for non-existent", async () => {
  const qm = new QuotaManager();
  const cache = new Cache("test", "https://example.com", qm);

  const deleted = await cache.delete("https://example.com/nope");
  assertEquals(deleted, false);
});

// ============================================================================
// Cache.keys
// ============================================================================

Deno.test("CacheAPI - keys returns all request keys", async () => {
  const qm = new QuotaManager();
  const cache = new Cache("test", "https://example.com", qm);

  await cache.put(makeRequest("https://example.com/a"), makeResponse());
  await cache.put(makeRequest("https://example.com/b"), makeResponse());
  await cache.put(makeRequest("https://example.com/c"), makeResponse());

  const keys = await cache.keys();
  assertEquals(keys.length, 3);
  const urls = keys.map((k) => k.url);
  assertEquals(urls.includes("https://example.com/a"), true);
  assertEquals(urls.includes("https://example.com/b"), true);
  assertEquals(urls.includes("https://example.com/c"), true);
});

// ============================================================================
// Match Options
// ============================================================================

Deno.test("CacheAPI - ignoreSearch matches without query string", async () => {
  const qm = new QuotaManager();
  const cache = new Cache("test", "https://example.com", qm);

  await cache.put(makeRequest("https://example.com/page?v=1"), makeResponse(200, "v1"));

  const matched = await cache.match("https://example.com/page?v=2", { ignoreSearch: true });
  assertExists(matched);
});

Deno.test("CacheAPI - ignoreMethod matches regardless of method", async () => {
  const qm = new QuotaManager();
  const cache = new Cache("test", "https://example.com", qm);

  await cache.put(makeRequest("https://example.com/api", "POST"), makeResponse(200, "posted"));

  // Without ignoreMethod - should miss (default GET vs POST)
  const miss = await cache.match("https://example.com/api");
  assertEquals(miss, undefined);

  // With ignoreMethod
  const hit = await cache.match("https://example.com/api", { ignoreMethod: true });
  assertExists(hit);
});

// ============================================================================
// Expiration / TTL
// ============================================================================

Deno.test("CacheAPI - expired entries are cleaned up on match", async () => {
  const qm = new QuotaManager();
  const cache = new Cache("test", "https://example.com", qm);

  const headers = new Map([["cache-control", "max-age=0"]]);
  await cache.put(makeRequest("https://example.com/expire"), makeResponse(200, "old", headers));

  // Wait for expiration
  await new Promise((r) => setTimeout(r, 50));

  const matched = await cache.match("https://example.com/expire");
  assertEquals(matched, undefined);
});

// ============================================================================
// Cache Isolation (CacheStorage)
// ============================================================================

Deno.test("CacheAPI - different cache names are isolated", async () => {
  const qm = new QuotaManager();
  const storage = new CacheStorage("https://example.com", qm);

  const cache1 = await storage.open("v1");
  const cache2 = await storage.open("v2");

  await cache1.put(makeRequest("https://example.com/data"), makeResponse(200, "from-v1"));
  await cache2.put(makeRequest("https://example.com/data"), makeResponse(200, "from-v2"));

  const r1 = await cache1.match("https://example.com/data");
  const r2 = await cache2.match("https://example.com/data");

  assertExists(r1);
  assertExists(r2);

  const decoder = new TextDecoder();
  assertEquals(decoder.decode(r1.body), "from-v1");
  assertEquals(decoder.decode(r2.body), "from-v2");
});

Deno.test("CacheAPI - CacheStorage.keys returns cache names", async () => {
  const storage = new CacheStorage("https://example.com");

  await storage.open("alpha");
  await storage.open("beta");

  const keys = await storage.keys();
  assertEquals(keys.length, 2);
  assertEquals(keys.includes("alpha"), true);
  assertEquals(keys.includes("beta"), true);
});

Deno.test("CacheAPI - CacheStorage.delete removes cache", async () => {
  const storage = new CacheStorage("https://example.com");

  await storage.open("temp");
  assertEquals(await storage.has("temp"), true);

  const deleted = await storage.delete("temp");
  assertEquals(deleted, true);
  assertEquals(await storage.has("temp"), false);
});

Deno.test("CacheAPI - CacheStorage.match searches all caches", async () => {
  const qm = new QuotaManager();
  const storage = new CacheStorage("https://example.com", qm);

  const c1 = await storage.open("first");
  const c2 = await storage.open("second");

  await c2.put(makeRequest("https://example.com/found"), makeResponse(200, "here"));

  const result = await storage.match("https://example.com/found");
  assertExists(result);
});

// ============================================================================
// Quota Integration
// ============================================================================

Deno.test("CacheAPI - quota exceeded throws on put", async () => {
  const qm = new QuotaManager(50, 10000); // very small quota
  const cache = new Cache("test", "https://example.com", qm);

  // Large body should exceed 50 byte quota
  const bigBody = "x".repeat(100);
  let threw = false;
  try {
    await cache.put(makeRequest("https://example.com/big"), makeResponse(200, bigBody));
  } catch (e) {
    threw = true;
    assertEquals((e as Error).message.includes("QuotaExceededError"), true);
  }
  assertEquals(threw, true);
});

// ============================================================================
// Clear
// ============================================================================

Deno.test("CacheAPI - clear removes all entries", async () => {
  const qm = new QuotaManager();
  const cache = new Cache("test", "https://example.com", qm);

  await cache.put(makeRequest("https://example.com/a"), makeResponse());
  await cache.put(makeRequest("https://example.com/b"), makeResponse());
  assertEquals(cache.getCount(), 2);

  await cache.clear();
  assertEquals(cache.getCount(), 0);
  assertEquals(cache.getSize(), 0);
});
