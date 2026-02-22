/**
 * ParallelDetectionPass Tests
 */

import { assertEquals, assert } from "@std/assert";
import { ParallelDetectionPass } from "../../optimizer/passes/parallel-detection.ts";

Deno.test("ParallelDetection - constructor", () => {
  const pass = new ParallelDetectionPass();
  assert(pass instanceof ParallelDetectionPass);
  assertEquals(pass.getParallelGroups().length, 0);
});

Deno.test("ParallelDetection - apply returns statement unchanged", () => {
  const pass = new ParallelDetectionPass();
  const stmt = { type: "SELECT" as const, fields: [{ name: "x" }], source: { type: "URL", value: "https://x.com" } } as any;
  assertEquals(pass.apply(stmt), stmt);
});

Deno.test("ParallelDetection - independent CTEs are parallel", () => {
  const pass = new ParallelDetectionPass();
  const cte1 = { name: "a", query: { type: "SELECT", fields: [{ name: "x" }], source: { type: "URL", value: "https://a.com" } } };
  const cte2 = { name: "b", query: { type: "SELECT", fields: [{ name: "y" }], source: { type: "URL", value: "https://b.com" } } };
  const stmt = { type: "WITH", ctes: [cte1, cte2], query: { type: "SELECT", fields: [{ name: "z" }], source: { type: "URL", value: "https://c.com" } } };
  pass.apply(stmt as any);
  assert(pass.getParallelGroups().length > 0);
});

Deno.test("ParallelDetection - dependent CTEs not parallel", () => {
  const pass = new ParallelDetectionPass();
  const cte1 = { name: "a", query: { type: "SELECT", fields: [{ name: "x" }], source: { type: "URL", value: "https://a.com" } } };
  const cte2 = { name: "b", query: { type: "SELECT", fields: [{ name: "y" }], source: { type: "VARIABLE", value: "a" } } };
  const stmt = { type: "WITH", ctes: [cte1, cte2], query: { type: "SELECT", fields: [{ name: "z" }], source: { type: "VARIABLE", value: "b" } } };
  pass.apply(stmt as any);
  // cte2 depends on cte1's output, and query depends on cte2
  assertEquals(pass.getParallelGroups().length, 0);
});

Deno.test("ParallelDetection - FOR loop with only loop var dependency is parallelizable", () => {
  const pass = new ParallelDetectionPass();
  const body = { type: "SELECT", fields: [{ name: "x", expression: { type: "IDENTIFIER", name: "item" } }], source: { type: "URL", value: "https://x.com" } };
  const stmt = { type: "FOR", variable: "item", collection: { type: "ARRAY", elements: [] }, body };
  pass.apply(stmt as any);
  assert(pass.getParallelGroups().length > 0);
});

Deno.test("ParallelDetection - canRunInParallel with independent stmts", () => {
  const pass = new ParallelDetectionPass();
  const s1 = { type: "SELECT" as const, fields: [{ name: "x" }], source: { type: "URL", value: "https://a.com" } };
  const s2 = { type: "SELECT" as const, fields: [{ name: "y" }], source: { type: "URL", value: "https://b.com" } };
  assertEquals(pass.canRunInParallel(s1 as any, s2 as any), true);
});

Deno.test("ParallelDetection - canRunInParallel with dependent stmts", () => {
  const pass = new ParallelDetectionPass();
  const s1 = { type: "SET" as const, path: ["x"], value: { type: "LITERAL", value: 1 } };
  const s2 = { type: "SELECT" as const, fields: [{ name: "y", expression: { type: "IDENTIFIER", name: "x" } }], source: { type: "URL", value: "https://a.com" } };
  assertEquals(pass.canRunInParallel(s1 as any, s2 as any), false);
});

Deno.test("ParallelDetection - SELECT with non-subquery has no groups", () => {
  const pass = new ParallelDetectionPass();
  const stmt = { type: "SELECT", fields: [{ name: "x" }], source: { type: "URL", value: "https://x.com" } };
  pass.apply(stmt as any);
  assertEquals(pass.getParallelGroups().length, 0);
});

Deno.test("ParallelDetection - FOR with cross-iteration deps not parallelizable", () => {
  const pass = new ParallelDetectionPass();
  const body = { type: "SET" as const, path: ["total"], value: { type: "IDENTIFIER", name: "total" } };
  const stmt = { type: "FOR", variable: "item", collection: { type: "ARRAY", elements: [] }, body };
  pass.apply(stmt as any);
  // body depends on "total" which is not the loop variable
  const groups = pass.getParallelGroups();
  assertEquals(groups.length, 0);
});

Deno.test("ParallelDetection - getParallelGroups returns accumulated groups", () => {
  const pass = new ParallelDetectionPass();
  assertEquals(Array.isArray(pass.getParallelGroups()), true);
});
