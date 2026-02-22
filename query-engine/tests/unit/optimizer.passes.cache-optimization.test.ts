/**
 * CacheOptimizationPass Tests
 */

import { assertEquals, assert } from "@std/assert";
import { CacheOptimizationPass } from "../../optimizer/passes/cache-optimization.ts";
import { DataType } from "../../types/primitives.ts";

function makeSelectStmt(url: string, fields: string[] = ["title"], where?: any) {
  return {
    type: "SELECT" as const,
    fields: fields.map(f => ({ name: f, alias: undefined, expression: undefined })),
    source: { type: "URL" as const, value: url },
    where,
    orderBy: undefined,
    limit: undefined,
  };
}

Deno.test("CacheOptimization - constructor creates instance", () => {
  const pass = new CacheOptimizationPass();
  assert(pass instanceof CacheOptimizationPass);
});

Deno.test("CacheOptimization - SELECT from URL is cacheable", () => {
  const pass = new CacheOptimizationPass();
  const stmt = makeSelectStmt("https://example.com");
  pass.apply(stmt as any);
  const meta = pass.getCacheMetadata(stmt as any);
  assert(meta !== undefined);
  assertEquals(meta!.cacheable, true);
  assert(meta!.cacheKey !== undefined);
  assert(meta!.ttl !== undefined);
});

Deno.test("CacheOptimization - SELECT from non-URL source is not cacheable", () => {
  const pass = new CacheOptimizationPass();
  const stmt = { type: "SELECT", fields: [{ name: "x" }], source: { type: "VARIABLE", value: "myVar" } };
  pass.apply(stmt as any);
  const meta = pass.getCacheMetadata(stmt as any);
  assertEquals(meta!.cacheable, false);
  assert(meta!.reason!.includes("not a static URL"));
});

Deno.test("CacheOptimization - SELECT with non-deterministic call is not cacheable", () => {
  const pass = new CacheOptimizationPass();
  const stmt = makeSelectStmt("https://example.com", ["title"], {
    type: "CALL", callee: "NOW", arguments: [],
  });
  pass.apply(stmt as any);
  const meta = pass.getCacheMetadata(stmt as any);
  assertEquals(meta!.cacheable, false);
});

Deno.test("CacheOptimization - FOR loop is not cacheable", () => {
  const pass = new CacheOptimizationPass();
  const stmt = { type: "FOR", variable: "x", collection: { type: "ARRAY", elements: [] }, body: makeSelectStmt("https://example.com") };
  pass.apply(stmt as any);
  const meta = pass.getCacheMetadata(stmt as any);
  assertEquals(meta!.cacheable, false);
});

Deno.test("CacheOptimization - IF statement is not cacheable", () => {
  const pass = new CacheOptimizationPass();
  const stmt = { type: "IF", condition: { type: "LITERAL", dataType: DataType.BOOLEAN, value: true }, then: makeSelectStmt("https://example.com") };
  pass.apply(stmt as any);
  const meta = pass.getCacheMetadata(stmt as any);
  assertEquals(meta!.cacheable, false);
});

Deno.test("CacheOptimization - NAVIGATE with literal URL is cacheable", () => {
  const pass = new CacheOptimizationPass();
  const stmt = { type: "NAVIGATE", url: { type: "LITERAL", value: "https://example.com", dataType: DataType.STRING } };
  pass.apply(stmt as any);
  const meta = pass.getCacheMetadata(stmt as any);
  assertEquals(meta!.cacheable, true);
  assert(meta!.cacheKey!.startsWith("navigate:"));
});

Deno.test("CacheOptimization - NAVIGATE with non-literal URL is not cacheable", () => {
  const pass = new CacheOptimizationPass();
  const stmt = { type: "NAVIGATE", url: { type: "IDENTIFIER", name: "myUrl" } };
  pass.apply(stmt as any);
  const meta = pass.getCacheMetadata(stmt as any);
  assertEquals(meta!.cacheable, false);
});

Deno.test("CacheOptimization - getCacheableStatements returns only cacheable", () => {
  const pass = new CacheOptimizationPass();
  const s1 = makeSelectStmt("https://example.com");
  const s2 = { type: "IF", condition: { type: "LITERAL", dataType: DataType.BOOLEAN, value: true }, then: makeSelectStmt("https://x.com") };
  pass.apply(s1 as any);
  pass.apply(s2 as any);
  const cacheable = pass.getCacheableStatements();
  assertEquals(cacheable.length, 1);
});

Deno.test("CacheOptimization - TTL reduced with ORDER BY", () => {
  const pass = new CacheOptimizationPass();
  const stmt = { ...makeSelectStmt("https://example.com"), orderBy: [{ field: "name", direction: "ASC" }] };
  pass.apply(stmt as any);
  const meta = pass.getCacheMetadata(stmt as any);
  assertEquals(meta!.ttl, 30000);
});

Deno.test("CacheOptimization - apply returns statement unchanged", () => {
  const pass = new CacheOptimizationPass();
  const stmt = makeSelectStmt("https://example.com");
  const result = pass.apply(stmt as any);
  assertEquals(result, stmt as any);
});
