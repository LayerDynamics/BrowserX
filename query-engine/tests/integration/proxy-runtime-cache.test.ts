/**
 * Integration test for ProxyController runtime cache integration
 * Verifies that ProxyController uses the proxy engine's runtime cache when provided
 */

import { assertEquals } from "@std/assert";
import { ProxyController } from "../../controllers/proxy/proxy-controller.ts";
import type { CacheLookupStep, CacheStoreStep } from "../../planner/mod.ts";
import { ExecutionStepType } from "../../planner/mod.ts";

// Mock Runtime with cache interface matching proxy-engine structure
class MockRuntime {
  private cacheStorage = new Map<string, { value: unknown; expiresAt: number }>();

  cache = {
    get: (key: string): unknown | null => {
      const entry = this.cacheStorage.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        this.cacheStorage.delete(key);
        return null;
      }
      return entry.value;
    },
    set: (key: string, value: unknown, ttl: number): void => {
      this.cacheStorage.set(key, {
        value,
        expiresAt: Date.now() + ttl,
      });
    },
    delete: (key: string): boolean => {
      return this.cacheStorage.delete(key);
    },
    has: (key: string): boolean => this.cacheStorage.has(key),
  };

  // Expose storage for testing
  getStorageSize(): number {
    return this.cacheStorage.size;
  }

  getStorageKeys(): string[] {
    return Array.from(this.cacheStorage.keys());
  }
}

Deno.test("ProxyController uses runtime cache when provided", async () => {
  const mockRuntime = new MockRuntime();

  // Create controller with runtime
  const controller = new ProxyController(mockRuntime as any, {
    enabled: true,
    cache: { enabled: true, defaultTTL: 60000, maxSize: 1024 * 1024 },
  });

  // Store via controller
  const storeStep: CacheStoreStep = {
    type: ExecutionStepType.CACHE_STORE,
    id: "step1",
    dependencies: [],
    estimatedCost: 1,
    cacheable: true,
    cacheKey: "test-key",
    value: { data: "test-value" },
    ttl: 60000,
  };
  await controller.executeCacheStore(storeStep);

  // Verify runtime cache was used (not just local Map)
  assertEquals(mockRuntime.getStorageSize(), 1, "Runtime cache should have 1 entry");
  assertEquals(mockRuntime.getStorageKeys()[0], "test-key");

  // Lookup via controller
  const lookupStep: CacheLookupStep = {
    type: ExecutionStepType.CACHE_LOOKUP,
    id: "step2",
    dependencies: [],
    estimatedCost: 1,
    cacheable: true,
    cacheKey: "test-key",
  };
  const result = await controller.executeCacheLookup(lookupStep);

  assertEquals(result.hit, true);
  assertEquals((result.value as any).data, "test-value");
});

Deno.test("ProxyController falls back to local cache when no runtime", async () => {
  // Create controller without runtime
  const controller = new ProxyController(undefined, {
    enabled: true,
    cache: { enabled: true, defaultTTL: 60000, maxSize: 1024 * 1024 },
  });

  // Store should still work with local cache
  const storeStep: CacheStoreStep = {
    type: ExecutionStepType.CACHE_STORE,
    id: "step1",
    dependencies: [],
    estimatedCost: 1,
    cacheable: true,
    cacheKey: "local-key",
    value: { data: "local-value" },
    ttl: 60000,
  };
  await controller.executeCacheStore(storeStep);

  const lookupStep: CacheLookupStep = {
    type: ExecutionStepType.CACHE_LOOKUP,
    id: "step2",
    dependencies: [],
    estimatedCost: 1,
    cacheable: true,
    cacheKey: "local-key",
  };
  const result = await controller.executeCacheLookup(lookupStep);

  assertEquals(result.hit, true);
  assertEquals((result.value as any).data, "local-value");
});

Deno.test("ProxyController returns cache miss for non-existent key", async () => {
  const mockRuntime = new MockRuntime();
  const controller = new ProxyController(mockRuntime as any, {
    enabled: true,
    cache: { enabled: true, defaultTTL: 60000, maxSize: 1024 * 1024 },
  });

  const lookupStep: CacheLookupStep = {
    type: ExecutionStepType.CACHE_LOOKUP,
    id: "step1",
    dependencies: [],
    estimatedCost: 1,
    cacheable: true,
    cacheKey: "nonexistent-key",
  };
  const result = await controller.executeCacheLookup(lookupStep);

  assertEquals(result.hit, false);
  assertEquals(result.reason, "not_found");
  assertEquals(result.value, null);
});

Deno.test("ProxyController respects cache disabled config", async () => {
  const mockRuntime = new MockRuntime();
  const controller = new ProxyController(mockRuntime as any, {
    enabled: true,
    cache: { enabled: false, defaultTTL: 60000, maxSize: 1024 * 1024 },
  });

  // Store should be skipped
  const storeStep: CacheStoreStep = {
    type: ExecutionStepType.CACHE_STORE,
    id: "step1",
    dependencies: [],
    estimatedCost: 1,
    cacheable: true,
    cacheKey: "disabled-key",
    value: { data: "should-not-store" },
    ttl: 60000,
  };
  await controller.executeCacheStore(storeStep);

  // Verify nothing was stored
  assertEquals(mockRuntime.getStorageSize(), 0);

  // Lookup should return cache_disabled
  const lookupStep: CacheLookupStep = {
    type: ExecutionStepType.CACHE_LOOKUP,
    id: "step2",
    dependencies: [],
    estimatedCost: 1,
    cacheable: true,
    cacheKey: "disabled-key",
  };
  const result = await controller.executeCacheLookup(lookupStep);

  assertEquals(result.hit, false);
  assertEquals(result.reason, "cache_disabled");
});
