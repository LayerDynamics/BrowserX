/**
 * QuotaManager Tests
 */

import { assertEquals, assertThrows } from "@std/assert";
import { QuotaManager, StorageType } from "../../../src/engine/storage/QuotaManager.ts";

// ============================================================================
// Default Values
// ============================================================================

Deno.test("QuotaManager - default quota is 50MB", () => {
  const qm = new QuotaManager();
  assertEquals(qm.getDefaultQuota(), 50 * 1024 * 1024);
});

Deno.test("QuotaManager - default quota returned for unknown origin", () => {
  const qm = new QuotaManager(1000);
  assertEquals(qm.getQuota("https://example.com"), 1000);
});

// ============================================================================
// Allocation / hasQuota
// ============================================================================

Deno.test("QuotaManager - allocation succeeds within quota", () => {
  const qm = new QuotaManager(1000, 10000);
  assertEquals(qm.hasQuota("https://example.com", 500), true);
});

Deno.test("QuotaManager - allocation fails when over per-origin quota", () => {
  const qm = new QuotaManager(100, 10000);
  qm.updateUsage("https://example.com", 90);
  assertEquals(qm.hasQuota("https://example.com", 20), false);
});

Deno.test("QuotaManager - allocation fails when over global quota", () => {
  const qm = new QuotaManager(10000, 100);
  qm.updateUsage("https://a.com", 80);
  assertEquals(qm.hasQuota("https://b.com", 30), false);
});

Deno.test("QuotaManager - allocation at exact quota boundary succeeds", () => {
  const qm = new QuotaManager(100, 10000);
  assertEquals(qm.hasQuota("https://example.com", 100), true);
});

// ============================================================================
// Multiple Storage Types
// ============================================================================

Deno.test("QuotaManager - tracks multiple storage types independently", () => {
  const qm = new QuotaManager();
  qm.updateUsage("https://example.com", 100, StorageType.LOCAL_STORAGE);
  qm.updateUsage("https://example.com", 200, StorageType.SESSION_STORAGE);
  qm.updateUsage("https://example.com", 300, StorageType.INDEXED_DB);
  qm.updateUsage("https://example.com", 400, StorageType.CACHE_API);

  assertEquals(qm.getUsageByType("https://example.com", StorageType.LOCAL_STORAGE), 100);
  assertEquals(qm.getUsageByType("https://example.com", StorageType.SESSION_STORAGE), 200);
  assertEquals(qm.getUsageByType("https://example.com", StorageType.INDEXED_DB), 300);
  assertEquals(qm.getUsageByType("https://example.com", StorageType.CACHE_API), 400);
  assertEquals(qm.getUsage("https://example.com"), 1000);
});

// ============================================================================
// Usage Reporting
// ============================================================================

Deno.test("QuotaManager - getQuotaInfo returns correct info", () => {
  const qm = new QuotaManager(1000, 10000);
  qm.updateUsage("https://example.com", 300, StorageType.LOCAL_STORAGE);
  qm.updateUsage("https://example.com", 200, StorageType.INDEXED_DB);

  const info = qm.getQuotaInfo("https://example.com");
  assertEquals(info.quota, 1000);
  assertEquals(info.usage, 500);
  assertEquals(info.available, 500);
  assertEquals(info.usageByType.get(StorageType.LOCAL_STORAGE), 300);
  assertEquals(info.usageByType.get(StorageType.INDEXED_DB), 200);
});

Deno.test("QuotaManager - getUsagePercentage", () => {
  const qm = new QuotaManager(1000, 10000);
  qm.updateUsage("https://example.com", 250);
  assertEquals(qm.getUsagePercentage("https://example.com"), 25);
});

Deno.test("QuotaManager - global quota info", () => {
  const qm = new QuotaManager(1000, 5000);
  qm.updateUsage("https://a.com", 100);
  qm.updateUsage("https://b.com", 200);

  const info = qm.getGlobalQuotaInfo();
  assertEquals(info.quota, 5000);
  assertEquals(info.usage, 300);
  assertEquals(info.available, 4700);
  assertEquals(info.originCount, 2);
});

// ============================================================================
// Multiple Origins Isolated
// ============================================================================

Deno.test("QuotaManager - origins are isolated", () => {
  const qm = new QuotaManager(1000, 10000);
  qm.updateUsage("https://a.com", 500);
  qm.updateUsage("https://b.com", 300);

  assertEquals(qm.getUsage("https://a.com"), 500);
  assertEquals(qm.getUsage("https://b.com"), 300);
  assertEquals(qm.getUsage("https://c.com"), 0);
  assertEquals(qm.getAllOrigins().length, 2);
});

// ============================================================================
// Clear / Reset
// ============================================================================

Deno.test("QuotaManager - clearOrigin resets origin usage and quota", () => {
  const qm = new QuotaManager(1000, 10000);
  qm.setQuota("https://example.com", 2000);
  qm.updateUsage("https://example.com", 500);

  qm.clearOrigin("https://example.com");

  assertEquals(qm.getUsage("https://example.com"), 0);
  assertEquals(qm.getQuota("https://example.com"), 1000); // back to default
  assertEquals(qm.getGlobalQuotaInfo().usage, 0);
});

Deno.test("QuotaManager - clearAll resets everything", () => {
  const qm = new QuotaManager(1000, 10000);
  qm.updateUsage("https://a.com", 100);
  qm.updateUsage("https://b.com", 200);
  qm.setQuota("https://a.com", 5000);

  qm.clearAll();

  assertEquals(qm.getAllOrigins().length, 0);
  assertEquals(qm.getGlobalQuotaInfo().usage, 0);
  assertEquals(qm.getQuota("https://a.com"), 1000); // default
});

// ============================================================================
// setQuota / setDefaultQuota / setGlobalQuota
// ============================================================================

Deno.test("QuotaManager - setQuota per origin", () => {
  const qm = new QuotaManager(1000, 10000);
  qm.setQuota("https://example.com", 5000);
  assertEquals(qm.getQuota("https://example.com"), 5000);
});

Deno.test("QuotaManager - setQuota negative throws", () => {
  const qm = new QuotaManager();
  assertThrows(() => qm.setQuota("https://example.com", -1), Error, "non-negative");
});

Deno.test("QuotaManager - setDefaultQuota negative throws", () => {
  const qm = new QuotaManager();
  assertThrows(() => qm.setDefaultQuota(-1), Error, "non-negative");
});

Deno.test("QuotaManager - setGlobalQuota negative throws", () => {
  const qm = new QuotaManager();
  assertThrows(() => qm.setGlobalQuota(-1), Error, "non-negative");
});

// ============================================================================
// Export / Import
// ============================================================================

Deno.test("QuotaManager - export and import round-trip", () => {
  const qm1 = new QuotaManager(1000, 10000);
  qm1.setQuota("https://example.com", 5000);
  qm1.updateUsage("https://example.com", 300, StorageType.LOCAL_STORAGE);
  qm1.updateUsage("https://example.com", 200, StorageType.CACHE_API);

  const exported = qm1.export();

  const qm2 = new QuotaManager(1000, 10000);
  qm2.import(exported);

  assertEquals(qm2.getQuota("https://example.com"), 5000);
  assertEquals(qm2.getUsageByType("https://example.com", StorageType.LOCAL_STORAGE), 300);
  assertEquals(qm2.getUsageByType("https://example.com", StorageType.CACHE_API), 200);
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test("QuotaManager - negative usage update clamps to zero", () => {
  const qm = new QuotaManager();
  qm.updateUsage("https://example.com", 50, StorageType.LOCAL_STORAGE);
  qm.updateUsage("https://example.com", -100, StorageType.LOCAL_STORAGE);
  assertEquals(qm.getUsageByType("https://example.com", StorageType.LOCAL_STORAGE), 0);
});

Deno.test("QuotaManager - zero quota origin usage percentage is 0", () => {
  const qm = new QuotaManager();
  qm.setQuota("https://example.com", 0);
  assertEquals(qm.getUsagePercentage("https://example.com"), 0);
});

Deno.test("QuotaManager - isOriginQuotaExceeded", () => {
  const qm = new QuotaManager(100, 10000);
  assertEquals(qm.isOriginQuotaExceeded("https://example.com"), false);
  // Force usage above quota via direct update (bypasses hasQuota check)
  qm.updateUsage("https://example.com", 150);
  assertEquals(qm.isOriginQuotaExceeded("https://example.com"), true);
});
