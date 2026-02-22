/**
 * TypeChecker Tests
 */

import { assertEquals, assert, assertThrows } from "@std/assert";
import { TypeChecker, TypeCheckError } from "../../analyzer/type-checker.ts";
import { SymbolTable, SymbolType } from "../../analyzer/symbols.ts";
import { DataType } from "../../types/primitives.ts";

function makeChecker() {
  return new TypeChecker(new SymbolTable());
}

function lit(dataType: DataType, value: any) { return { type: "LITERAL" as const, dataType, value }; }
function ident(name: string) { return { type: "IDENTIFIER" as const, name }; }
function bin(left: any, op: string, right: any) { return { type: "BINARY" as const, operator: op, left, right }; }

Deno.test("TypeChecker - constructor", () => {
  const tc = makeChecker();
  assert(tc instanceof TypeChecker);
});

Deno.test("TypeChecker - inferType for literal", () => {
  const tc = makeChecker();
  assertEquals(tc.inferType(lit(DataType.NUMBER, 42)), DataType.NUMBER);
  assertEquals(tc.inferType(lit(DataType.STRING, "hi")), DataType.STRING);
  assertEquals(tc.inferType(lit(DataType.BOOLEAN, true)), DataType.BOOLEAN);
});

Deno.test("TypeChecker - inferType for unknown identifier", () => {
  const tc = makeChecker();
  assertEquals(tc.inferType(ident("unknown")), DataType.UNKNOWN);
});

Deno.test("TypeChecker - inferType for defined identifier", () => {
  const st = new SymbolTable();
  st.define("x", SymbolType.VARIABLE, { dataType: DataType.NUMBER as any });
  const tc = new TypeChecker(st);
  assertEquals(tc.inferType(ident("x")), DataType.NUMBER);
});

Deno.test("TypeChecker - inferType binary comparison returns BOOLEAN", () => {
  const tc = makeChecker();
  const expr = bin(lit(DataType.NUMBER, 1), ">", lit(DataType.NUMBER, 2));
  assertEquals(tc.inferType(expr), DataType.BOOLEAN);
});

Deno.test("TypeChecker - binary arithmetic returns NUMBER", () => {
  const tc = makeChecker();
  assertEquals(tc.inferType(bin(lit(DataType.NUMBER, 1), "+", lit(DataType.NUMBER, 2))), DataType.NUMBER);
});

Deno.test("TypeChecker - string + string returns STRING", () => {
  const tc = makeChecker();
  assertEquals(tc.inferType(bin(lit(DataType.STRING, "a"), "+", lit(DataType.STRING, "b"))), DataType.STRING);
});

Deno.test("TypeChecker - AND requires boolean operands", () => {
  const tc = makeChecker();
  assertThrows(() => tc.inferType(bin(lit(DataType.NUMBER, 1), "AND", lit(DataType.BOOLEAN, true))), TypeCheckError);
});

Deno.test("TypeChecker - NOT requires boolean", () => {
  const tc = makeChecker();
  assertThrows(() => tc.inferType({ type: "UNARY", operator: "NOT", operand: lit(DataType.NUMBER, 1) }), TypeCheckError);
});

Deno.test("TypeChecker - unary minus returns NUMBER", () => {
  const tc = makeChecker();
  assertEquals(tc.inferType({ type: "UNARY", operator: "-", operand: lit(DataType.NUMBER, 5) }), DataType.NUMBER);
});

Deno.test("TypeChecker - CALL infers type for known functions", () => {
  const tc = makeChecker();
  assertEquals(tc.inferType({ type: "CALL", callee: "COUNT", arguments: [] }), DataType.NUMBER);
  assertEquals(tc.inferType({ type: "CALL", callee: "TEXT", arguments: [] }), DataType.STRING);
  assertEquals(tc.inferType({ type: "CALL", callee: "EXISTS", arguments: [] }), DataType.BOOLEAN);
});

Deno.test("TypeChecker - canCoerce same type", () => {
  const tc = makeChecker();
  assertEquals(tc.canCoerce(DataType.NUMBER, DataType.NUMBER), true);
});

Deno.test("TypeChecker - canCoerce NUMBER to STRING", () => {
  const tc = makeChecker();
  assertEquals(tc.canCoerce(DataType.NUMBER, DataType.STRING), true);
});

Deno.test("TypeChecker - canCoerce NULL to anything", () => {
  const tc = makeChecker();
  assertEquals(tc.canCoerce(DataType.NULL, DataType.STRING), true);
});

Deno.test("TypeChecker - cannot coerce STRING to NUMBER", () => {
  const tc = makeChecker();
  assertEquals(tc.canCoerce(DataType.STRING, DataType.NUMBER), false);
});
