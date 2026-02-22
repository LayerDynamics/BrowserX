/**
 * ProxyController Tests
 */

import { assertEquals, assert } from "@std/assert";
import { ProxyController } from "../../controllers/proxy/proxy-controller.ts";

Deno.test("ProxyController - constructor with defaults", () => {
  const pc = new ProxyController();
  const config = pc.getConfig();
  assertEquals(config.enabled, true);
  assertEquals(config.cache.enabled, true);
  assertEquals(config.cache.defaultTTL, 300000);
});

Deno.test("ProxyController - constructor with custom config", () => {
  const pc = new ProxyController(undefined, { enabled: false, cache: { enabled: false, defaultTTL: 1000, maxSize: 1024 } });
  assertEquals(pc.getConfig().enabled, false);
  assertEquals(pc.getConfig().cache.enabled, false);
});

Deno.test("ProxyController - cache store and lookup hit", async () => {
  const pc = new ProxyController();
  await pc.executeCacheStore({ type: "CACHE_STORE" as any, id: "s1", cacheKey: "k1", value: "hello", estimatedCost: 0, dependencies: [], cacheable: false });
  const result = await pc.executeCacheLookup({ type: "CACHE_LOOKUP" as any, id: "l1", cacheKey: "k1", estimatedCost: 0, dependencies: [], cacheable: false });
  assertEquals(result.hit, true);
  assertEquals(result.value, "hello");
});

Deno.test("ProxyController - cache lookup miss", async () => {
  const pc = new ProxyController();
  const result = await pc.executeCacheLookup({ type: "CACHE_LOOKUP" as any, id: "l1", cacheKey: "missing", estimatedCost: 0, dependencies: [], cacheable: false });
  assertEquals(result.hit, false);
  assertEquals(result.reason, "not_found");
});

Deno.test("ProxyController - cache disabled returns cache_disabled", async () => {
  const pc = new ProxyController(undefined, { cache: { enabled: false, defaultTTL: 1000, maxSize: 1024 } });
  const result = await pc.executeCacheLookup({ type: "CACHE_LOOKUP" as any, id: "l1", cacheKey: "k1", estimatedCost: 0, dependencies: [], cacheable: false });
  assertEquals(result.reason, "cache_disabled");
});

Deno.test("ProxyController - cache retrieve returns value", async () => {
  const pc = new ProxyController();
  await pc.executeCacheStore({ type: "CACHE_STORE" as any, id: "s1", cacheKey: "k1", value: 42, estimatedCost: 0, dependencies: [], cacheable: false });
  const val = await pc.executeCacheRetrieve({ type: "CACHE_RETRIEVE" as any, id: "r1", cacheKey: "k1", estimatedCost: 0, dependencies: [], cacheable: false });
  assertEquals(val, 42);
});

Deno.test("ProxyController - cache retrieve returns undefined on miss", async () => {
  const pc = new ProxyController();
  const val = await pc.executeCacheRetrieve({ type: "CACHE_RETRIEVE" as any, id: "r1", cacheKey: "nope", estimatedCost: 0, dependencies: [], cacheable: false });
  assertEquals(val, undefined);
});

Deno.test("ProxyController - clearCache resets everything", async () => {
  const pc = new ProxyController();
  await pc.executeCacheStore({ type: "CACHE_STORE" as any, id: "s1", cacheKey: "k1", value: "v", estimatedCost: 0, dependencies: [], cacheable: false });
  pc.clearCache();
  assertEquals(pc.getCacheStats().entries, 0);
  assertEquals(pc.getCacheStats().hitRate, 0);
});

Deno.test("ProxyController - getCacheStats tracks hit rate", async () => {
  const pc = new ProxyController();
  await pc.executeCacheStore({ type: "CACHE_STORE" as any, id: "s1", cacheKey: "k1", value: "v", estimatedCost: 0, dependencies: [], cacheable: false });
  await pc.executeCacheLookup({ type: "CACHE_LOOKUP" as any, id: "l1", cacheKey: "k1", estimatedCost: 0, dependencies: [], cacheable: false });
  await pc.executeCacheLookup({ type: "CACHE_LOOKUP" as any, id: "l2", cacheKey: "miss", estimatedCost: 0, dependencies: [], cacheable: false });
  assertEquals(pc.getCacheStats().hitRate, 0.5);
});

Deno.test("ProxyController - addRequestInterceptor", () => {
  const pc = new ProxyController();
  pc.addRequestInterceptor(async (req) => req);
  assertEquals(pc.getRequestInterceptors().length, 1);
});

Deno.test("ProxyController - interceptRequest without config returns unchanged", async () => {
  const pc = new ProxyController();
  const req = { id: "r1" as any, method: "GET", url: "http://x.com" as any, headers: {} };
  assertEquals(await pc.interceptRequest(req), req);
});

Deno.test("ProxyController - checkRateLimit allows when no limit", async () => {
  const pc = new ProxyController();
  assertEquals(await pc.checkRateLimit(), true);
});

Deno.test("ProxyController - updateConfig merges", () => {
  const pc = new ProxyController();
  pc.updateConfig({ enabled: false });
  assertEquals(pc.getConfig().enabled, false);
  assertEquals(pc.getConfig().cache.enabled, true);
});

Deno.test("ProxyController - getRuntime undefined without runtime", () => {
  const pc = new ProxyController();
  assertEquals(pc.getRuntime(), undefined);
});
