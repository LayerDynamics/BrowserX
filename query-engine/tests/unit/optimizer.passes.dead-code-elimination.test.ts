/**
 * DeadCodeEliminationPass Tests
 */

import { assertEquals, assert } from "@std/assert";
import { DeadCodeEliminationPass } from "../../optimizer/passes/dead-code-elimination.ts";
import { DataType } from "../../types/primitives.ts";

function boolLit(v: boolean) { return { type: "LITERAL" as const, dataType: DataType.BOOLEAN, value: v }; }

Deno.test("DeadCodeElimination - constructor", () => {
  assert(new DeadCodeEliminationPass() instanceof DeadCodeEliminationPass);
});

Deno.test("DeadCodeElimination - IF true keeps then branch", () => {
  const pass = new DeadCodeEliminationPass();
  const thenBranch = { type: "SELECT" as const, fields: [{ name: "x" }], source: { type: "URL", value: "https://x.com" } };
  const elseBranch = { type: "SELECT" as const, fields: [{ name: "y" }], source: { type: "URL", value: "https://y.com" } };
  const stmt = { type: "IF" as const, condition: boolLit(true), then: thenBranch, else: elseBranch };
  const result = pass.apply(stmt as any);
  assert(result !== null);
  assertEquals((result as any).type, "SELECT");
  assertEquals((result as any).fields[0].name, "x");
});

Deno.test("DeadCodeElimination - IF false keeps else branch", () => {
  const pass = new DeadCodeEliminationPass();
  const thenBranch = { type: "SELECT" as const, fields: [{ name: "x" }], source: { type: "URL", value: "https://x.com" } };
  const elseBranch = { type: "SELECT" as const, fields: [{ name: "y" }], source: { type: "URL", value: "https://y.com" } };
  const stmt = { type: "IF" as const, condition: boolLit(false), then: thenBranch, else: elseBranch };
  const result = pass.apply(stmt as any);
  assert(result !== null);
  assertEquals((result as any).fields[0].name, "y");
});

Deno.test("DeadCodeElimination - IF false without else returns null", () => {
  const pass = new DeadCodeEliminationPass();
  const stmt = { type: "IF" as const, condition: boolLit(false), then: { type: "SELECT", fields: [{ name: "x" }], source: { type: "URL", value: "https://x.com" } } };
  const result = pass.apply(stmt as any);
  assertEquals(result, null);
});

Deno.test("DeadCodeElimination - FOR with empty array returns null", () => {
  const pass = new DeadCodeEliminationPass();
  const stmt = { type: "FOR" as const, variable: "x", collection: { type: "ARRAY", elements: [] }, body: { type: "SELECT", fields: [{ name: "x" }], source: { type: "URL", value: "https://x.com" } } };
  const result = pass.apply(stmt as any);
  assertEquals(result, null);
});

Deno.test("DeadCodeElimination - non-constant IF is preserved", () => {
  const pass = new DeadCodeEliminationPass();
  const cond = { type: "IDENTIFIER", name: "flag" };
  const thenBranch = { type: "SELECT", fields: [{ name: "x" }], source: { type: "URL", value: "https://x.com" } };
  const stmt = { type: "IF" as const, condition: cond, then: thenBranch };
  const result = pass.apply(stmt as any);
  assert(result !== null);
  assertEquals((result as any).type, "IF");
});

Deno.test("DeadCodeElimination - SELECT passes through unchanged", () => {
  const pass = new DeadCodeEliminationPass();
  const stmt = { type: "SELECT" as const, fields: [{ name: "x" }], source: { type: "URL", value: "https://x.com" } };
  const result = pass.apply(stmt as any);
  assertEquals(result, stmt as any);
});

Deno.test("DeadCodeElimination - SET passes through unchanged", () => {
  const pass = new DeadCodeEliminationPass();
  const stmt = { type: "SET" as const, path: ["x"], value: { type: "LITERAL", value: 1 } };
  const result = pass.apply(stmt as any);
  assertEquals(result, stmt as any);
});

Deno.test("DeadCodeElimination - nested IF with constant condition", () => {
  const pass = new DeadCodeEliminationPass();
  const inner = { type: "IF", condition: boolLit(false), then: { type: "SELECT", fields: [{ name: "x" }], source: { type: "URL", value: "https://x.com" } } };
  const outer = { type: "IF" as const, condition: boolLit(true), then: inner };
  const result = pass.apply(outer as any);
  // inner resolves to null since false + no else, then outer's then is null
  assertEquals(result, null);
});

Deno.test("DeadCodeElimination - FOR with non-empty collection preserved", () => {
  const pass = new DeadCodeEliminationPass();
  const body = { type: "SELECT", fields: [{ name: "x" }], source: { type: "URL", value: "https://x.com" } };
  const stmt = { type: "FOR" as const, variable: "x", collection: { type: "IDENTIFIER", name: "items" }, body };
  const result = pass.apply(stmt as any);
  assert(result !== null);
  assertEquals((result as any).type, "FOR");
});

Deno.test("DeadCodeElimination - WITH statement with eliminated CTEs", () => {
  const pass = new DeadCodeEliminationPass();
  const deadCte = { name: "a", query: { type: "IF", condition: boolLit(false), then: { type: "SELECT", fields: [{ name: "x" }], source: { type: "URL", value: "https://x.com" } } } };
  const stmt = { type: "WITH" as const, ctes: [deadCte], query: { type: "SELECT", fields: [{ name: "y" }], source: { type: "URL", value: "https://y.com" } } };
  const result = pass.apply(stmt as any);
  // CTE is eliminated (null), so no ctes remain -> returns null
  assertEquals(result, null);
});
