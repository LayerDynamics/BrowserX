/**
 * ProjectionPushdownPass Tests
 */

import { assertEquals, assert } from "@std/assert";
import { ProjectionPushdownPass } from "../../optimizer/passes/projection-pushdown.ts";

function makeSelect(fields: string[], source: any, where?: any, orderBy?: any) {
  return {
    type: "SELECT" as const,
    fields: fields.map(f => ({ name: f, alias: undefined, expression: undefined })),
    source,
    where,
    orderBy,
    limit: undefined,
  };
}

Deno.test("ProjectionPushdown - constructor", () => {
  assert(new ProjectionPushdownPass() instanceof ProjectionPushdownPass);
});

Deno.test("ProjectionPushdown - apply returns statement", () => {
  const pass = new ProjectionPushdownPass();
  const stmt = makeSelect(["title"], { type: "URL", value: "https://x.com" });
  const result = pass.apply(stmt as any);
  assertEquals(result.type, "SELECT");
});

Deno.test("ProjectionPushdown - wildcard select is not optimized", () => {
  const pass = new ProjectionPushdownPass();
  const sub = makeSelect(["a", "b", "c"], { type: "URL", value: "https://x.com" });
  const stmt = makeSelect(["*"], { type: "SUBQUERY", value: sub });
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.source.value.fields.length, 3);
});

Deno.test("ProjectionPushdown - prunes unused subquery fields", () => {
  const pass = new ProjectionPushdownPass();
  const sub = makeSelect(["a", "b", "c"], { type: "URL", value: "https://x.com" });
  const stmt = makeSelect(["a"], { type: "SUBQUERY", value: sub });
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.source.value.fields.length, 1);
  assertEquals(result.source.value.fields[0].name, "a");
});

Deno.test("ProjectionPushdown - keeps fields used in WHERE", () => {
  const pass = new ProjectionPushdownPass();
  const sub = makeSelect(["a", "b"], { type: "URL", value: "https://x.com" });
  const stmt = makeSelect(["a"], { type: "SUBQUERY", value: sub }, { type: "IDENTIFIER", name: "b" });
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.source.value.fields.length, 2);
});

Deno.test("ProjectionPushdown - keeps fields used in ORDER BY", () => {
  const pass = new ProjectionPushdownPass();
  const sub = makeSelect(["a", "b"], { type: "URL", value: "https://x.com" });
  const stmt = makeSelect(["a"], { type: "SUBQUERY", value: sub }, undefined, [{ field: "b", direction: "ASC" }]);
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.source.value.fields.length, 2);
});

Deno.test("ProjectionPushdown - non-subquery source unchanged", () => {
  const pass = new ProjectionPushdownPass();
  const stmt = makeSelect(["title"], { type: "URL", value: "https://x.com" });
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.source.type, "URL");
});

Deno.test("ProjectionPushdown - handles FOR statement body", () => {
  const pass = new ProjectionPushdownPass();
  const inner = makeSelect(["x"], { type: "URL", value: "https://x.com" });
  const stmt = { type: "FOR", variable: "i", collection: { type: "ARRAY", elements: [] }, body: inner };
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.body.type, "SELECT");
});

Deno.test("ProjectionPushdown - handles IF statement branches", () => {
  const pass = new ProjectionPushdownPass();
  const inner = makeSelect(["x"], { type: "URL", value: "https://x.com" });
  const stmt = { type: "IF", condition: { type: "LITERAL", value: true }, then: inner, else: inner };
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.then.type, "SELECT");
  assertEquals(result.else.type, "SELECT");
});

Deno.test("ProjectionPushdown - subquery wildcard preserved", () => {
  const pass = new ProjectionPushdownPass();
  const sub = makeSelect(["*"], { type: "URL", value: "https://x.com" });
  const stmt = makeSelect(["a"], { type: "SUBQUERY", value: sub });
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.source.value.fields[0].name, "*");
});
