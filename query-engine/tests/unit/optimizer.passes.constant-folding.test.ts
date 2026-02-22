/**
 * ConstantFoldingPass Tests
 */

import { assertEquals, assert } from "@std/assert";
import { ConstantFoldingPass } from "../../optimizer/passes/constant-folding.ts";
import { DataType } from "../../types/primitives.ts";

function numLit(v: number) { return { type: "LITERAL" as const, dataType: DataType.NUMBER, value: v }; }
function strLit(v: string) { return { type: "LITERAL" as const, dataType: DataType.STRING, value: v }; }
function boolLit(v: boolean) { return { type: "LITERAL" as const, dataType: DataType.BOOLEAN, value: v }; }
function binExpr(left: any, op: string, right: any) { return { type: "BINARY" as const, operator: op, left, right }; }

Deno.test("ConstantFolding - constructor", () => {
  assert(new ConstantFoldingPass() instanceof ConstantFoldingPass);
});

Deno.test("ConstantFolding - folds numeric addition", () => {
  const pass = new ConstantFoldingPass();
  const stmt = { type: "SET" as const, path: ["x"], value: binExpr(numLit(2), "+", numLit(3)) };
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.value.type, "LITERAL");
  assertEquals(result.value.value, 5);
});

Deno.test("ConstantFolding - folds numeric subtraction", () => {
  const pass = new ConstantFoldingPass();
  const stmt = { type: "SET" as const, path: ["x"], value: binExpr(numLit(10), "-", numLit(3)) };
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.value.value, 7);
});

Deno.test("ConstantFolding - folds numeric multiplication", () => {
  const pass = new ConstantFoldingPass();
  const stmt = { type: "SET" as const, path: ["x"], value: binExpr(numLit(4), "*", numLit(5)) };
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.value.value, 20);
});

Deno.test("ConstantFolding - folds numeric division", () => {
  const pass = new ConstantFoldingPass();
  const stmt = { type: "SET" as const, path: ["x"], value: binExpr(numLit(10), "/", numLit(2)) };
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.value.value, 5);
});

Deno.test("ConstantFolding - does not fold division by zero", () => {
  const pass = new ConstantFoldingPass();
  const stmt = { type: "SET" as const, path: ["x"], value: binExpr(numLit(10), "/", numLit(0)) };
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.value.type, "BINARY");
});

Deno.test("ConstantFolding - folds string concatenation with +", () => {
  const pass = new ConstantFoldingPass();
  const stmt = { type: "SET" as const, path: ["x"], value: binExpr(strLit("hello"), "+", strLit(" world")) };
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.value.value, "hello world");
});

Deno.test("ConstantFolding - folds boolean AND", () => {
  const pass = new ConstantFoldingPass();
  const stmt = { type: "SET" as const, path: ["x"], value: binExpr(boolLit(true), "AND", boolLit(false)) };
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.value.value, false);
});

Deno.test("ConstantFolding - folds NOT unary", () => {
  const pass = new ConstantFoldingPass();
  const stmt = { type: "SET" as const, path: ["x"], value: { type: "UNARY", operator: "NOT", operand: boolLit(true) } };
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.value.value, false);
});

Deno.test("ConstantFolding - folds negation unary", () => {
  const pass = new ConstantFoldingPass();
  const stmt = { type: "SET" as const, path: ["x"], value: { type: "UNARY", operator: "-", operand: numLit(5) } };
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.value.value, -5);
});

Deno.test("ConstantFolding - does not fold non-literal binary", () => {
  const pass = new ConstantFoldingPass();
  const stmt = { type: "SET" as const, path: ["x"], value: binExpr({ type: "IDENTIFIER", name: "y" }, "+", numLit(1)) };
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.value.type, "BINARY");
});

Deno.test("ConstantFolding - folds numeric comparison", () => {
  const pass = new ConstantFoldingPass();
  const stmt = { type: "SET" as const, path: ["x"], value: binExpr(numLit(5), ">", numLit(3)) };
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.value.value, true);
});

Deno.test("ConstantFolding - folds nested constant expressions", () => {
  const pass = new ConstantFoldingPass();
  const inner = binExpr(numLit(2), "+", numLit(3));
  const stmt = { type: "SET" as const, path: ["x"], value: binExpr(inner, "*", numLit(4)) };
  const result = pass.apply(stmt as any) as any;
  assertEquals(result.value.value, 20);
});
