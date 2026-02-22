/**
 * SymbolTable Tests
 */

import { assertEquals, assert, assertThrows } from "@std/assert";
import { SymbolTable, SymbolType, ScopeType } from "../../analyzer/symbols.ts";

Deno.test("SymbolTable - constructor creates global scope", () => {
  const st = new SymbolTable();
  assertEquals(st.getCurrentScope().type, ScopeType.GLOBAL);
  assertEquals(st.getCurrentScope().depth, 0);
  assertEquals(st.getCurrentScope().parent, null);
});

Deno.test("SymbolTable - define and resolve symbol", () => {
  const st = new SymbolTable();
  st.define("x", SymbolType.VARIABLE);
  const sym = st.resolve("x");
  assert(sym !== null);
  assertEquals(sym!.name, "x");
  assertEquals(sym!.type, SymbolType.VARIABLE);
});

Deno.test("SymbolTable - resolve returns null for undefined symbol", () => {
  const st = new SymbolTable();
  assertEquals(st.resolve("missing"), null);
});

Deno.test("SymbolTable - lookup returns undefined for missing", () => {
  const st = new SymbolTable();
  assertEquals(st.lookup("missing"), undefined);
});

Deno.test("SymbolTable - duplicate define throws", () => {
  const st = new SymbolTable();
  st.define("x", SymbolType.VARIABLE);
  assertThrows(() => st.define("x", SymbolType.VARIABLE), Error, "already defined");
});

Deno.test("SymbolTable - enterScope and exitScope", () => {
  const st = new SymbolTable();
  st.enterScope(ScopeType.BLOCK);
  assertEquals(st.getCurrentScope().type, ScopeType.BLOCK);
  assertEquals(st.getCurrentScope().depth, 1);
  st.exitScope();
  assertEquals(st.getCurrentScope().type, ScopeType.GLOBAL);
});

Deno.test("SymbolTable - resolve walks scope chain", () => {
  const st = new SymbolTable();
  st.define("outer", SymbolType.VARIABLE);
  st.enterScope(ScopeType.BLOCK);
  const sym = st.resolve("outer");
  assert(sym !== null);
  assertEquals(sym!.name, "outer");
});

Deno.test("SymbolTable - isDefined checks current scope only", () => {
  const st = new SymbolTable();
  st.define("outer", SymbolType.VARIABLE);
  st.enterScope(ScopeType.BLOCK);
  assertEquals(st.isDefined("outer"), false);
});

Deno.test("SymbolTable - getSymbolsInCurrentScope", () => {
  const st = new SymbolTable();
  st.define("a", SymbolType.VARIABLE);
  st.define("b", SymbolType.FUNCTION);
  const syms = st.getSymbolsInCurrentScope();
  assertEquals(syms.length, 2);
});

Deno.test("SymbolTable - getAllSymbolsInChain includes parent scopes", () => {
  const st = new SymbolTable();
  st.define("outer", SymbolType.VARIABLE);
  st.enterScope(ScopeType.BLOCK);
  st.define("inner", SymbolType.VARIABLE);
  const all = st.getAllSymbolsInChain();
  assertEquals(all.length, 2);
});

Deno.test("SymbolTable - clearCurrentScope", () => {
  const st = new SymbolTable();
  st.define("x", SymbolType.VARIABLE);
  st.clearCurrentScope();
  assertEquals(st.getSymbolsInCurrentScope().length, 0);
});

Deno.test("SymbolTable - exitScope at global is no-op", () => {
  const st = new SymbolTable();
  st.exitScope();
  assertEquals(st.getCurrentScope().type, ScopeType.GLOBAL);
});

Deno.test("SymbolTable - getScopeCounter increments", () => {
  const st = new SymbolTable();
  const initial = st.getScopeCounter();
  st.enterScope(ScopeType.BLOCK);
  assert(st.getScopeCounter() > initial);
});

Deno.test("SymbolTable - define with object options API", () => {
  const st = new SymbolTable();
  st.define("fn", { kind: SymbolType.FUNCTION, returnType: "String" });
  const sym = st.lookup("fn");
  assert(sym !== undefined);
  assertEquals(sym!.kind, SymbolType.FUNCTION);
});
