/**
 * Symbol Table Tests
 * Tests for symbol table and scope management in semantic analysis
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import { SymbolTable, ScopeType, SymbolKind } from "../../../analyzer/symbols.ts";

// ============================================================================
// Constructor Tests
// ============================================================================

Deno.test({
  name: "SymbolTable - constructor creates global scope",
  fn() {
    const table = new SymbolTable();

    assertExists(table);
    assertEquals(table.currentScope.type, ScopeType.GLOBAL);
  },
});

Deno.test({
  name: "SymbolTable - global scope has no parent",
  fn() {
    const table = new SymbolTable();

    assertEquals(table.currentScope.parent, null);
  },
});

// ============================================================================
// Scope Management Tests
// ============================================================================

Deno.test({
  name: "SymbolTable - enterScope creates nested scope",
  fn() {
    const table = new SymbolTable();

    table.enterScope(ScopeType.FUNCTION);

    assertEquals(table.currentScope.type, ScopeType.FUNCTION);
    assertExists(table.currentScope.parent);
    assertEquals(table.currentScope.parent.type, ScopeType.GLOBAL);
  },
});

Deno.test({
  name: "SymbolTable - exitScope returns to parent",
  fn() {
    const table = new SymbolTable();

    table.enterScope(ScopeType.BLOCK);
    assertEquals(table.currentScope.type, ScopeType.BLOCK);

    table.exitScope();
    assertEquals(table.currentScope.type, ScopeType.GLOBAL);
  },
});

Deno.test({
  name: "SymbolTable - exitScope from global does nothing",
  fn() {
    const table = new SymbolTable();

    table.exitScope();
    assertEquals(table.currentScope.type, ScopeType.GLOBAL);
  },
});

Deno.test({
  name: "SymbolTable - multiple nested scopes",
  fn() {
    const table = new SymbolTable();

    table.enterScope(ScopeType.FUNCTION);
    table.enterScope(ScopeType.BLOCK);
    table.enterScope(ScopeType.BLOCK);

    assertEquals(table.currentScope.type, ScopeType.BLOCK);
    assertEquals(table.currentScope.parent.type, ScopeType.BLOCK);
    assertEquals(table.currentScope.parent.parent.type, ScopeType.FUNCTION);
    assertEquals(table.currentScope.parent.parent.parent.type, ScopeType.GLOBAL);
  },
});

Deno.test({
  name: "SymbolTable - scope depth tracking",
  fn() {
    const table = new SymbolTable();

    assertEquals(table.currentScope.depth, 0);

    table.enterScope(ScopeType.FUNCTION);
    assertEquals(table.currentScope.depth, 1);

    table.enterScope(ScopeType.BLOCK);
    assertEquals(table.currentScope.depth, 2);

    table.exitScope();
    assertEquals(table.currentScope.depth, 1);
  },
});

// ============================================================================
// Symbol Definition Tests
// ============================================================================

Deno.test({
  name: "SymbolTable - define symbol in current scope",
  fn() {
    const table = new SymbolTable();

    table.define("myVar", SymbolKind.VARIABLE, { dataType: "NUMBER" });

    const symbol = table.resolve("myVar");
    assertExists(symbol);
    assertEquals(symbol.name, "myVar");
    assertEquals(symbol.kind, SymbolKind.VARIABLE);
  },
});

Deno.test({
  name: "SymbolTable - define function symbol",
  fn() {
    const table = new SymbolTable();

    table.define("myFunc", SymbolKind.FUNCTION, {
      returnType: "STRING",
      parameters: ["arg1", "arg2"],
    });

    const symbol = table.resolve("myFunc");
    assertExists(symbol);
    assertEquals(symbol.kind, SymbolKind.FUNCTION);
  },
});

Deno.test({
  name: "SymbolTable - define throws on duplicate in same scope",
  fn() {
    const table = new SymbolTable();

    table.define("myVar", SymbolKind.VARIABLE);

    assertThrows(
      () => table.define("myVar", SymbolKind.VARIABLE),
      Error,
      "already defined"
    );
  },
});

Deno.test({
  name: "SymbolTable - define with metadata",
  fn() {
    const table = new SymbolTable();

    table.define("count", SymbolKind.VARIABLE, {
      dataType: "NUMBER",
      mutable: true,
      initialized: true,
    });

    const symbol = table.resolve("count");
    assertExists(symbol);
    assertEquals(symbol.metadata?.dataType, "NUMBER");
    assertEquals(symbol.metadata?.mutable, true);
  },
});

// ============================================================================
// Symbol Resolution Tests
// ============================================================================

Deno.test({
  name: "SymbolTable - resolve symbol in current scope",
  fn() {
    const table = new SymbolTable();

    table.define("local", SymbolKind.VARIABLE);

    const symbol = table.resolve("local");
    assertExists(symbol);
    assertEquals(symbol.name, "local");
  },
});

Deno.test({
  name: "SymbolTable - resolve symbol in parent scope",
  fn() {
    const table = new SymbolTable();

    table.define("global", SymbolKind.VARIABLE);
    table.enterScope(ScopeType.FUNCTION);

    const symbol = table.resolve("global");
    assertExists(symbol);
    assertEquals(symbol.name, "global");
  },
});

Deno.test({
  name: "SymbolTable - resolve walks scope chain",
  fn() {
    const table = new SymbolTable();

    table.define("var1", SymbolKind.VARIABLE);
    table.enterScope(ScopeType.FUNCTION);
    table.define("var2", SymbolKind.VARIABLE);
    table.enterScope(ScopeType.BLOCK);
    table.define("var3", SymbolKind.VARIABLE);

    assertEquals(table.resolve("var1")?.name, "var1");
    assertEquals(table.resolve("var2")?.name, "var2");
    assertEquals(table.resolve("var3")?.name, "var3");
  },
});

Deno.test({
  name: "SymbolTable - resolve returns null for undefined",
  fn() {
    const table = new SymbolTable();

    assertEquals(table.resolve("undefined"), null);
  },
});

Deno.test({
  name: "SymbolTable - isDefined checks current scope only",
  fn() {
    const table = new SymbolTable();

    table.define("global", SymbolKind.VARIABLE);
    table.enterScope(ScopeType.FUNCTION);

    assertEquals(table.isDefined("global"), false);
    assertEquals(table.resolve("global") !== null, true);
  },
});

// ============================================================================
// Shadowing Tests
// ============================================================================

Deno.test({
  name: "SymbolTable - shadowing allows redefining in nested scope",
  fn() {
    const table = new SymbolTable();

    table.define("x", SymbolKind.VARIABLE, { dataType: "NUMBER" });
    table.enterScope(ScopeType.BLOCK);
    table.define("x", SymbolKind.VARIABLE, { dataType: "STRING" });

    const symbol = table.resolve("x");
    assertExists(symbol);
    assertEquals(symbol.metadata?.dataType, "STRING");
  },
});

Deno.test({
  name: "SymbolTable - shadowing resolves to innermost definition",
  fn() {
    const table = new SymbolTable();

    table.define("value", SymbolKind.VARIABLE);
    table.enterScope(ScopeType.FUNCTION);
    table.define("value", SymbolKind.VARIABLE);
    table.enterScope(ScopeType.BLOCK);
    table.define("value", SymbolKind.VARIABLE);

    const symbol = table.resolve("value");
    assertEquals(symbol?.scope.depth, 2);
  },
});

Deno.test({
  name: "SymbolTable - exiting scope reveals shadowed symbol",
  fn() {
    const table = new SymbolTable();

    table.define("x", SymbolKind.VARIABLE, { dataType: "NUMBER" });
    table.enterScope(ScopeType.BLOCK);
    table.define("x", SymbolKind.VARIABLE, { dataType: "STRING" });

    assertEquals(table.resolve("x")?.metadata?.dataType, "STRING");

    table.exitScope();

    assertEquals(table.resolve("x")?.metadata?.dataType, "NUMBER");
  },
});

// ============================================================================
// Clear Scope Tests
// ============================================================================

Deno.test({
  name: "SymbolTable - clearCurrentScope removes all symbols",
  fn() {
    const table = new SymbolTable();

    table.define("var1", SymbolKind.VARIABLE);
    table.define("var2", SymbolKind.VARIABLE);
    table.define("var3", SymbolKind.VARIABLE);

    table.clearCurrentScope();

    assertEquals(table.resolve("var1"), null);
    assertEquals(table.resolve("var2"), null);
    assertEquals(table.resolve("var3"), null);
  },
});

Deno.test({
  name: "SymbolTable - clearCurrentScope only affects current scope",
  fn() {
    const table = new SymbolTable();

    table.define("global", SymbolKind.VARIABLE);
    table.enterScope(ScopeType.FUNCTION);
    table.define("local", SymbolKind.VARIABLE);

    table.clearCurrentScope();

    assertEquals(table.resolve("local"), null);
    assertExists(table.resolve("global"));
  },
});

// ============================================================================
// getAllSymbols Tests
// ============================================================================

Deno.test({
  name: "SymbolTable - getAllSymbols returns current scope symbols",
  fn() {
    const table = new SymbolTable();

    table.define("var1", SymbolKind.VARIABLE);
    table.define("var2", SymbolKind.VARIABLE);
    table.define("func1", SymbolKind.FUNCTION);

    const symbols = table.getAllSymbols();

    assertEquals(symbols.length, 3);
    assert(symbols.some(s => s.name === "var1"));
    assert(symbols.some(s => s.name === "var2"));
    assert(symbols.some(s => s.name === "func1"));
  },
});

Deno.test({
  name: "SymbolTable - getAllSymbols only includes current scope",
  fn() {
    const table = new SymbolTable();

    table.define("global", SymbolKind.VARIABLE);
    table.enterScope(ScopeType.FUNCTION);
    table.define("local", SymbolKind.VARIABLE);

    const symbols = table.getAllSymbols();

    assertEquals(symbols.length, 1);
    assertEquals(symbols[0].name, "local");
  },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
  name: "SymbolTable - complete function scope workflow",
  fn() {
    const table = new SymbolTable();

    // Global scope
    table.define("globalVar", SymbolKind.VARIABLE);

    // Function scope
    table.enterScope(ScopeType.FUNCTION);
    table.define("myFunc", SymbolKind.FUNCTION);
    table.define("param1", SymbolKind.VARIABLE);
    table.define("param2", SymbolKind.VARIABLE);

    // Block scope inside function
    table.enterScope(ScopeType.BLOCK);
    table.define("localVar", SymbolKind.VARIABLE);

    // Can resolve all symbols
    assertExists(table.resolve("globalVar"));
    assertExists(table.resolve("myFunc"));
    assertExists(table.resolve("param1"));
    assertExists(table.resolve("param2"));
    assertExists(table.resolve("localVar"));

    // Exit block
    table.exitScope();
    assertEquals(table.resolve("localVar"), null);
    assertExists(table.resolve("param1"));

    // Exit function
    table.exitScope();
    assertEquals(table.resolve("param1"), null);
    assertExists(table.resolve("globalVar"));
  },
});

Deno.test({
  name: "SymbolTable - nested loops with shadowing",
  fn() {
    const table = new SymbolTable();

    // Outer loop
    table.enterScope(ScopeType.LOOP);
    table.define("i", SymbolKind.VARIABLE, { dataType: "NUMBER" });

    // Inner loop shadows i
    table.enterScope(ScopeType.LOOP);
    table.define("i", SymbolKind.VARIABLE, { dataType: "NUMBER" });

    const innerI = table.resolve("i");
    assertEquals(innerI?.scope.type, ScopeType.LOOP);
    assertEquals(innerI?.scope.depth, 2);

    table.exitScope();

    const outerI = table.resolve("i");
    assertEquals(outerI?.scope.depth, 1);
  },
});

Deno.test({
  name: "SymbolTable - complex nested scopes",
  fn() {
    const table = new SymbolTable();

    table.define("global1", SymbolKind.VARIABLE);
    table.define("global2", SymbolKind.VARIABLE);

    table.enterScope(ScopeType.FUNCTION);
    table.define("func1", SymbolKind.FUNCTION);

    table.enterScope(ScopeType.BLOCK);
    table.define("block1", SymbolKind.VARIABLE);

    table.enterScope(ScopeType.LOOP);
    table.define("loop1", SymbolKind.VARIABLE);

    // All symbols should be resolvable
    assertExists(table.resolve("global1"));
    assertExists(table.resolve("global2"));
    assertExists(table.resolve("func1"));
    assertExists(table.resolve("block1"));
    assertExists(table.resolve("loop1"));

    // Exit to function scope
    table.exitScope(); // exit loop
    table.exitScope(); // exit block

    assertEquals(table.resolve("loop1"), null);
    assertEquals(table.resolve("block1"), null);
    assertExists(table.resolve("func1"));
    assertExists(table.resolve("global1"));
  },
});
