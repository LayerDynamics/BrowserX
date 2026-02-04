/**
 * Scoping Tests
 * Comprehensive tests for symbol table scoping behavior
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import {
  SymbolTable,
  SymbolType,
  SymbolKind,
  ScopeType,
  type Symbol,
  type SymbolScope,
} from "../../analyzer/symbols.ts";
import { DataType } from "../../types/primitives.ts";

// ============================================================================
// SymbolType and SymbolKind Tests
// ============================================================================

Deno.test("SymbolType - contains all symbol types", () => {
  assertEquals(SymbolType.VARIABLE, "VARIABLE");
  assertEquals(SymbolType.FIELD, "FIELD");
  assertEquals(SymbolType.FUNCTION, "FUNCTION");
  assertEquals(SymbolType.PARAMETER, "PARAMETER");
  assertEquals(SymbolType.CTE, "CTE");
});

Deno.test("SymbolKind - is alias for SymbolType", () => {
  assertEquals(SymbolKind.VARIABLE, SymbolType.VARIABLE);
  assertEquals(SymbolKind.FIELD, SymbolType.FIELD);
  assertEquals(SymbolKind.FUNCTION, SymbolType.FUNCTION);
  assertEquals(SymbolKind.PARAMETER, SymbolType.PARAMETER);
  assertEquals(SymbolKind.CTE, SymbolType.CTE);
});

// ============================================================================
// ScopeType Tests
// ============================================================================

Deno.test("ScopeType - contains all scope types", () => {
  assertEquals(ScopeType.GLOBAL, "GLOBAL");
  assertEquals(ScopeType.QUERY, "QUERY");
  assertEquals(ScopeType.SUBQUERY, "SUBQUERY");
  assertEquals(ScopeType.FOR_LOOP, "FOR_LOOP");
  assertEquals(ScopeType.IF_BRANCH, "IF_BRANCH");
  assertEquals(ScopeType.CTE, "CTE");
  assertEquals(ScopeType.FUNCTION, "FUNCTION");
  assertEquals(ScopeType.BLOCK, "BLOCK");
  assertEquals(ScopeType.LOOP, "LOOP");
});

// ============================================================================
// SymbolTable Constructor Tests
// ============================================================================

Deno.test("SymbolTable - creates with global scope", () => {
  const table = new SymbolTable();

  const scope = table.getCurrentScope();
  assertExists(scope);
  assertEquals(scope.type, ScopeType.GLOBAL);
  assertEquals(scope.parent, null);
  assertEquals(scope.depth, 0);
});

Deno.test("SymbolTable - global scope has unique id", () => {
  const table = new SymbolTable();

  const scope = table.getCurrentScope();
  assert(scope.id.startsWith("scope_"));
});

Deno.test("SymbolTable - global scope has empty symbols map", () => {
  const table = new SymbolTable();

  const scope = table.getCurrentScope();
  assertEquals(scope.symbols.size, 0);
});

// ============================================================================
// Scope Creation Tests
// ============================================================================

Deno.test("SymbolTable - createScope creates new scope", () => {
  const table = new SymbolTable();

  const scope = table.createScope(ScopeType.QUERY, table.currentScope);
  assertExists(scope);
  assertEquals(scope.type, ScopeType.QUERY);
});

Deno.test("SymbolTable - createScope with parent", () => {
  const table = new SymbolTable();
  const globalScope = table.getCurrentScope();

  const scope = table.createScope(ScopeType.QUERY, globalScope);
  assertEquals(scope.parent, globalScope);
  assertEquals(scope.depth, 1);
});

Deno.test("SymbolTable - createScope increments scope counter", () => {
  const table = new SymbolTable();

  const counter1 = table.getScopeCounter();
  table.createScope(ScopeType.QUERY, table.currentScope);
  const counter2 = table.getScopeCounter();

  assertEquals(counter2, counter1 + 1);
});

Deno.test("SymbolTable - createScope with explicit depth", () => {
  const table = new SymbolTable();

  const scope = table.createScope(ScopeType.QUERY, null, 5);
  assertEquals(scope.depth, 5);
});

Deno.test("SymbolTable - createScope for different scope types", () => {
  const table = new SymbolTable();

  const queryScope = table.createScope(ScopeType.QUERY, table.currentScope);
  assertEquals(queryScope.type, ScopeType.QUERY);

  const forScope = table.createScope(ScopeType.FOR_LOOP, queryScope);
  assertEquals(forScope.type, ScopeType.FOR_LOOP);

  const ifScope = table.createScope(ScopeType.IF_BRANCH, forScope);
  assertEquals(ifScope.type, ScopeType.IF_BRANCH);
});

// ============================================================================
// enterScope and exitScope Tests
// ============================================================================

Deno.test("SymbolTable - enterScope changes current scope", () => {
  const table = new SymbolTable();
  const globalScope = table.getCurrentScope();

  table.enterScope(ScopeType.QUERY);

  const newScope = table.getCurrentScope();
  assert(newScope !== globalScope);
  assertEquals(newScope.type, ScopeType.QUERY);
  assertEquals(newScope.parent, globalScope);
});

Deno.test("SymbolTable - exitScope returns to parent scope", () => {
  const table = new SymbolTable();
  const globalScope = table.getCurrentScope();

  table.enterScope(ScopeType.QUERY);
  table.exitScope();

  assertEquals(table.getCurrentScope(), globalScope);
});

Deno.test("SymbolTable - nested enterScope/exitScope", () => {
  const table = new SymbolTable();
  const globalScope = table.getCurrentScope();

  table.enterScope(ScopeType.QUERY);
  const queryScope = table.getCurrentScope();

  table.enterScope(ScopeType.FOR_LOOP);
  const forScope = table.getCurrentScope();

  table.enterScope(ScopeType.IF_BRANCH);
  const ifScope = table.getCurrentScope();

  // Verify depth
  assertEquals(globalScope.depth, 0);
  assertEquals(queryScope.depth, 1);
  assertEquals(forScope.depth, 2);
  assertEquals(ifScope.depth, 3);

  // Exit and verify
  table.exitScope();
  assertEquals(table.getCurrentScope(), forScope);

  table.exitScope();
  assertEquals(table.getCurrentScope(), queryScope);

  table.exitScope();
  assertEquals(table.getCurrentScope(), globalScope);
});

Deno.test("SymbolTable - exitScope from global does nothing", () => {
  const table = new SymbolTable();
  const globalScope = table.getCurrentScope();

  table.exitScope();

  assertEquals(table.getCurrentScope(), globalScope);
});

// ============================================================================
// Symbol Definition Tests
// ============================================================================

Deno.test("SymbolTable - define with name and kind", () => {
  const table = new SymbolTable();

  table.define("x", SymbolType.VARIABLE, { dataType: DataType.STRING });

  const symbol = table.resolve("x");
  assertExists(symbol);
  assertEquals(symbol.name, "x");
  assertEquals(symbol.type, SymbolType.VARIABLE);
});

Deno.test("SymbolTable - define with Symbol object", () => {
  const table = new SymbolTable();

  const symbol: Symbol = {
    name: "myVar",
    type: SymbolType.VARIABLE,
    dataType: DataType.NUMBER,
    nullable: false,
    scope: table.getCurrentScope(),
  };

  table.define(symbol);

  const resolved = table.resolve("myVar");
  assertExists(resolved);
  assertEquals(resolved.name, "myVar");
  assertEquals(resolved.dataType, DataType.NUMBER);
});

Deno.test("SymbolTable - define sets scope to current scope", () => {
  const table = new SymbolTable();

  table.define("x", SymbolType.VARIABLE);

  const symbol = table.resolve("x");
  assertExists(symbol);
  assertEquals(symbol.scope, table.getCurrentScope());
});

Deno.test("SymbolTable - define throws on duplicate in same scope", () => {
  const table = new SymbolTable();

  table.define("x", SymbolType.VARIABLE);

  assertThrows(
    () => table.define("x", SymbolType.VARIABLE),
    Error,
    "Symbol 'x' is already defined in current scope"
  );
});

Deno.test("SymbolTable - define allows same name in different scopes", () => {
  const table = new SymbolTable();

  table.define("x", SymbolType.VARIABLE, { dataType: DataType.STRING });
  table.enterScope(ScopeType.QUERY);
  table.define("x", SymbolType.VARIABLE, { dataType: DataType.NUMBER });

  // Inner scope x shadows outer
  const symbol = table.resolve("x");
  assertExists(symbol);
  assertEquals(symbol.scope.type, ScopeType.QUERY);
});

Deno.test("SymbolTable - define different symbol types", () => {
  const table = new SymbolTable();

  table.define("var1", SymbolType.VARIABLE);
  table.define("field1", SymbolType.FIELD);
  table.define("func1", SymbolType.FUNCTION, {
    parameters: [DataType.STRING],
    returnType: DataType.STRING,
  });
  table.define("param1", SymbolType.PARAMETER);
  table.define("cte1", SymbolType.CTE);

  assertEquals(table.resolve("var1")?.type, SymbolType.VARIABLE);
  assertEquals(table.resolve("field1")?.type, SymbolType.FIELD);
  assertEquals(table.resolve("func1")?.type, SymbolType.FUNCTION);
  assertEquals(table.resolve("param1")?.type, SymbolType.PARAMETER);
  assertEquals(table.resolve("cte1")?.type, SymbolType.CTE);
});

// ============================================================================
// Symbol Resolution Tests
// ============================================================================

Deno.test("SymbolTable - resolve finds symbol in current scope", () => {
  const table = new SymbolTable();

  table.define("x", SymbolType.VARIABLE);

  const symbol = table.resolve("x");
  assertExists(symbol);
  assertEquals(symbol.name, "x");
});

Deno.test("SymbolTable - resolve finds symbol in parent scope", () => {
  const table = new SymbolTable();

  table.define("globalVar", SymbolType.VARIABLE);
  table.enterScope(ScopeType.QUERY);

  const symbol = table.resolve("globalVar");
  assertExists(symbol);
  assertEquals(symbol.name, "globalVar");
});

Deno.test("SymbolTable - resolve walks up scope chain", () => {
  const table = new SymbolTable();

  table.define("level0", SymbolType.VARIABLE);
  table.enterScope(ScopeType.QUERY);
  table.define("level1", SymbolType.VARIABLE);
  table.enterScope(ScopeType.FOR_LOOP);
  table.define("level2", SymbolType.VARIABLE);
  table.enterScope(ScopeType.IF_BRANCH);

  // From innermost scope, all should be resolvable
  assertExists(table.resolve("level0"));
  assertExists(table.resolve("level1"));
  assertExists(table.resolve("level2"));
});

Deno.test("SymbolTable - resolve returns null for undefined symbol", () => {
  const table = new SymbolTable();

  const symbol = table.resolve("nonexistent");
  assertEquals(symbol, null);
});

Deno.test("SymbolTable - resolve returns innermost shadowed symbol", () => {
  const table = new SymbolTable();

  table.define("x", SymbolType.VARIABLE, { dataType: DataType.STRING });
  table.enterScope(ScopeType.QUERY);
  table.define("x", SymbolType.VARIABLE, { dataType: DataType.NUMBER });

  const symbol = table.resolve("x");
  assertExists(symbol);
  assertEquals(symbol.metadata?.dataType, DataType.NUMBER);
});

// ============================================================================
// isDefined and existsInCurrentScope Tests
// ============================================================================

Deno.test("SymbolTable - isDefined checks current scope only", () => {
  const table = new SymbolTable();

  table.define("globalVar", SymbolType.VARIABLE);
  table.enterScope(ScopeType.QUERY);
  table.define("localVar", SymbolType.VARIABLE);

  assertEquals(table.isDefined("localVar"), true);
  assertEquals(table.isDefined("globalVar"), false); // Not in current scope
});

Deno.test("SymbolTable - existsInCurrentScope is alias for isDefined", () => {
  const table = new SymbolTable();

  table.define("x", SymbolType.VARIABLE);

  assertEquals(table.existsInCurrentScope("x"), true);
  assertEquals(table.existsInCurrentScope("y"), false);
});

// ============================================================================
// getSymbolsInCurrentScope and getAllSymbols Tests
// ============================================================================

Deno.test("SymbolTable - getSymbolsInCurrentScope returns current scope symbols", () => {
  const table = new SymbolTable();

  table.define("a", SymbolType.VARIABLE);
  table.define("b", SymbolType.VARIABLE);
  table.define("c", SymbolType.VARIABLE);

  const symbols = table.getSymbolsInCurrentScope();
  assertEquals(symbols.length, 3);

  const names = symbols.map(s => s.name).sort();
  assertEquals(names, ["a", "b", "c"]);
});

Deno.test("SymbolTable - getSymbolsInCurrentScope excludes parent scope", () => {
  const table = new SymbolTable();

  table.define("global", SymbolType.VARIABLE);
  table.enterScope(ScopeType.QUERY);
  table.define("local1", SymbolType.VARIABLE);
  table.define("local2", SymbolType.VARIABLE);

  const symbols = table.getSymbolsInCurrentScope();
  assertEquals(symbols.length, 2);

  const names = symbols.map(s => s.name).sort();
  assertEquals(names, ["local1", "local2"]);
});

Deno.test("SymbolTable - getAllSymbols returns current scope symbols", () => {
  const table = new SymbolTable();

  table.define("x", SymbolType.VARIABLE);
  table.define("y", SymbolType.VARIABLE);

  const symbols = table.getAllSymbols();
  assertEquals(symbols.length, 2);
});

// ============================================================================
// getAllSymbolsInChain Tests
// ============================================================================

Deno.test("SymbolTable - getAllSymbolsInChain includes all scopes", () => {
  const table = new SymbolTable();

  table.define("global", SymbolType.VARIABLE);
  table.enterScope(ScopeType.QUERY);
  table.define("query", SymbolType.VARIABLE);
  table.enterScope(ScopeType.FOR_LOOP);
  table.define("loop", SymbolType.VARIABLE);

  const symbols = table.getAllSymbolsInChain();
  assertEquals(symbols.length, 3);

  const names = symbols.map(s => s.name).sort();
  assertEquals(names, ["global", "loop", "query"]);
});

Deno.test("SymbolTable - getAllSymbolsInChain with shadowed symbols", () => {
  const table = new SymbolTable();

  table.define("x", SymbolType.VARIABLE, { dataType: DataType.STRING });
  table.enterScope(ScopeType.QUERY);
  table.define("x", SymbolType.VARIABLE, { dataType: DataType.NUMBER });

  const symbols = table.getAllSymbolsInChain();
  // Both x symbols should be returned
  assertEquals(symbols.length, 2);

  const xSymbols = symbols.filter(s => s.name === "x");
  assertEquals(xSymbols.length, 2);
});

// ============================================================================
// clearCurrentScope Tests
// ============================================================================

Deno.test("SymbolTable - clearCurrentScope removes all symbols", () => {
  const table = new SymbolTable();

  table.define("a", SymbolType.VARIABLE);
  table.define("b", SymbolType.VARIABLE);
  table.define("c", SymbolType.VARIABLE);

  table.clearCurrentScope();

  assertEquals(table.getSymbolsInCurrentScope().length, 0);
  assertEquals(table.resolve("a"), null);
});

Deno.test("SymbolTable - clearCurrentScope does not affect parent scope", () => {
  const table = new SymbolTable();

  table.define("global", SymbolType.VARIABLE);
  table.enterScope(ScopeType.QUERY);
  table.define("local", SymbolType.VARIABLE);

  table.clearCurrentScope();

  assertEquals(table.resolve("local"), null);
  assertExists(table.resolve("global")); // Parent still accessible
});

// ============================================================================
// getParentScope Tests
// ============================================================================

Deno.test("SymbolTable - getParentScope returns parent", () => {
  const table = new SymbolTable();
  const globalScope = table.getCurrentScope();

  table.enterScope(ScopeType.QUERY);

  assertEquals(table.getParentScope(), globalScope);
});

Deno.test("SymbolTable - getParentScope returns null for global", () => {
  const table = new SymbolTable();

  assertEquals(table.getParentScope(), null);
});

// ============================================================================
// Scope Chain Tests
// ============================================================================

Deno.test("Scope chain - parent references are correct", () => {
  const table = new SymbolTable();
  const globalScope = table.getCurrentScope();

  table.enterScope(ScopeType.QUERY);
  const queryScope = table.getCurrentScope();

  table.enterScope(ScopeType.FOR_LOOP);
  const forScope = table.getCurrentScope();

  assertEquals(forScope.parent, queryScope);
  assertEquals(queryScope.parent, globalScope);
  assertEquals(globalScope.parent, null);
});

Deno.test("Scope chain - depth increases correctly", () => {
  const table = new SymbolTable();

  assertEquals(table.getCurrentScope().depth, 0);

  table.enterScope(ScopeType.QUERY);
  assertEquals(table.getCurrentScope().depth, 1);

  table.enterScope(ScopeType.FOR_LOOP);
  assertEquals(table.getCurrentScope().depth, 2);

  table.enterScope(ScopeType.IF_BRANCH);
  assertEquals(table.getCurrentScope().depth, 3);
});

// ============================================================================
// Variable Shadowing Tests
// ============================================================================

Deno.test("Variable shadowing - inner scope shadows outer", () => {
  const table = new SymbolTable();

  table.define("x", SymbolType.VARIABLE, { dataType: DataType.STRING });

  table.enterScope(ScopeType.QUERY);
  table.define("x", SymbolType.VARIABLE, { dataType: DataType.NUMBER });

  // Inner x should be resolved
  const resolved = table.resolve("x");
  assertExists(resolved);
  assertEquals(resolved.scope.type, ScopeType.QUERY);
});

Deno.test("Variable shadowing - outer visible after exit", () => {
  const table = new SymbolTable();

  table.define("x", SymbolType.VARIABLE, { dataType: DataType.STRING });

  table.enterScope(ScopeType.QUERY);
  table.define("x", SymbolType.VARIABLE, { dataType: DataType.NUMBER });

  table.exitScope();

  // Outer x should now be resolved
  const resolved = table.resolve("x");
  assertExists(resolved);
  assertEquals(resolved.scope.type, ScopeType.GLOBAL);
  assertEquals(resolved.metadata?.dataType, DataType.STRING);
});

Deno.test("Variable shadowing - multiple levels", () => {
  const table = new SymbolTable();

  table.define("x", SymbolType.VARIABLE, { dataType: DataType.STRING });
  table.enterScope(ScopeType.QUERY);
  table.define("x", SymbolType.VARIABLE, { dataType: DataType.NUMBER });
  table.enterScope(ScopeType.FOR_LOOP);
  table.define("x", SymbolType.VARIABLE, { dataType: DataType.BOOLEAN });

  // Deepest x
  assertEquals(table.resolve("x")?.metadata?.dataType, DataType.BOOLEAN);

  table.exitScope();
  assertEquals(table.resolve("x")?.metadata?.dataType, DataType.NUMBER);

  table.exitScope();
  assertEquals(table.resolve("x")?.metadata?.dataType, DataType.STRING);
});

// ============================================================================
// FOR Loop Scoping Tests
// ============================================================================

Deno.test("FOR loop - loop variable is local to loop scope", () => {
  const table = new SymbolTable();

  table.enterScope(ScopeType.FOR_LOOP);
  table.define("item", SymbolType.VARIABLE, { dataType: DataType.OBJECT });

  assertExists(table.resolve("item"));

  table.exitScope();

  assertEquals(table.resolve("item"), null);
});

Deno.test("FOR loop - nested loops with different iterators", () => {
  const table = new SymbolTable();

  table.enterScope(ScopeType.FOR_LOOP);
  table.define("outerItem", SymbolType.VARIABLE);

  table.enterScope(ScopeType.FOR_LOOP);
  table.define("innerItem", SymbolType.VARIABLE);

  // Both visible in inner loop
  assertExists(table.resolve("outerItem"));
  assertExists(table.resolve("innerItem"));

  table.exitScope();

  // Only outer visible
  assertExists(table.resolve("outerItem"));
  assertEquals(table.resolve("innerItem"), null);
});

// ============================================================================
// IF Branch Scoping Tests
// ============================================================================

Deno.test("IF branch - variables defined in if are scoped", () => {
  const table = new SymbolTable();

  table.enterScope(ScopeType.IF_BRANCH);
  table.define("ifVar", SymbolType.VARIABLE);

  assertExists(table.resolve("ifVar"));

  table.exitScope();

  assertEquals(table.resolve("ifVar"), null);
});

Deno.test("IF branch - outer variables visible in if", () => {
  const table = new SymbolTable();

  table.define("outerVar", SymbolType.VARIABLE);

  table.enterScope(ScopeType.IF_BRANCH);

  assertExists(table.resolve("outerVar"));
});

// ============================================================================
// Function Scoping Tests
// ============================================================================

Deno.test("Function scope - parameters are local", () => {
  const table = new SymbolTable();

  table.enterScope(ScopeType.FUNCTION);
  table.define("param1", SymbolType.PARAMETER);
  table.define("param2", SymbolType.PARAMETER);

  assertExists(table.resolve("param1"));
  assertExists(table.resolve("param2"));

  table.exitScope();

  assertEquals(table.resolve("param1"), null);
  assertEquals(table.resolve("param2"), null);
});

Deno.test("Function scope - closure captures outer variables", () => {
  const table = new SymbolTable();

  table.define("outerVar", SymbolType.VARIABLE);

  table.enterScope(ScopeType.FUNCTION);
  table.define("localVar", SymbolType.VARIABLE);

  // Both accessible
  assertExists(table.resolve("outerVar"));
  assertExists(table.resolve("localVar"));
});

// ============================================================================
// CTE Scoping Tests
// ============================================================================

Deno.test("CTE scope - CTE is visible in query scope", () => {
  const table = new SymbolTable();

  table.enterScope(ScopeType.CTE);
  table.define("myCTE", SymbolType.CTE, { query: { type: "SELECT" } });

  assertExists(table.resolve("myCTE"));
  assertEquals(table.resolve("myCTE")?.type, SymbolType.CTE);
});

// ============================================================================
// Symbol Metadata Tests
// ============================================================================

Deno.test("Symbol metadata - function parameters and return type", () => {
  const table = new SymbolTable();

  table.define("myFunc", SymbolType.FUNCTION, {
    parameters: [DataType.STRING, DataType.NUMBER],
    returnType: DataType.BOOLEAN,
  });

  const symbol = table.resolve("myFunc");
  assertExists(symbol);
  assertExists(symbol.metadata);
  assertEquals(symbol.metadata.parameters, [DataType.STRING, DataType.NUMBER]);
  assertEquals(symbol.metadata.returnType, DataType.BOOLEAN);
});

Deno.test("Symbol metadata - field path", () => {
  const table = new SymbolTable();

  table.define("userEmail", SymbolType.FIELD, {
    path: ["user", "profile", "email"],
  });

  const symbol = table.resolve("userEmail");
  assertExists(symbol);
  assertExists(symbol.metadata);
  assertEquals(symbol.metadata.path, ["user", "profile", "email"]);
});

Deno.test("Symbol metadata - variable mutability", () => {
  const table = new SymbolTable();

  table.define("mutableVar", SymbolType.VARIABLE, {
    mutable: true,
    initialized: true,
  });

  const symbol = table.resolve("mutableVar");
  assertExists(symbol);
  assertEquals(symbol.metadata?.mutable, true);
  assertEquals(symbol.metadata?.initialized, true);
});

// ============================================================================
// Complex Scoping Scenarios Tests
// ============================================================================

Deno.test("Complex scenario - query with subquery and FOR loop", () => {
  const table = new SymbolTable();

  // Global scope
  table.define("globalConfig", SymbolType.VARIABLE);

  // Query scope
  table.enterScope(ScopeType.QUERY);
  table.define("queryResult", SymbolType.VARIABLE);

  // FOR loop in query
  table.enterScope(ScopeType.FOR_LOOP);
  table.define("item", SymbolType.VARIABLE);

  // IF in FOR loop
  table.enterScope(ScopeType.IF_BRANCH);
  table.define("matchedItem", SymbolType.VARIABLE);

  // All should be accessible
  assertExists(table.resolve("globalConfig"));
  assertExists(table.resolve("queryResult"));
  assertExists(table.resolve("item"));
  assertExists(table.resolve("matchedItem"));

  // Exit IF
  table.exitScope();
  assertEquals(table.resolve("matchedItem"), null);

  // Exit FOR
  table.exitScope();
  assertEquals(table.resolve("item"), null);

  // Exit query
  table.exitScope();
  assertEquals(table.resolve("queryResult"), null);

  // Global still accessible
  assertExists(table.resolve("globalConfig"));
});

Deno.test("Complex scenario - multiple parallel scopes", () => {
  const table = new SymbolTable();

  table.define("shared", SymbolType.VARIABLE);

  // First branch
  table.enterScope(ScopeType.IF_BRANCH);
  table.define("branchA", SymbolType.VARIABLE);
  table.exitScope();

  // Second branch (parallel, not nested)
  table.enterScope(ScopeType.IF_BRANCH);
  table.define("branchB", SymbolType.VARIABLE);

  // branchA should not be visible
  assertEquals(table.resolve("branchA"), null);
  assertExists(table.resolve("branchB"));
  assertExists(table.resolve("shared"));
});

Deno.test("Complex scenario - scope IDs are unique", () => {
  const table = new SymbolTable();

  const ids = new Set<string>();
  ids.add(table.getCurrentScope().id);

  for (let i = 0; i < 10; i++) {
    table.enterScope(ScopeType.QUERY);
    const id = table.getCurrentScope().id;
    assert(!ids.has(id), `Duplicate scope ID: ${id}`);
    ids.add(id);
  }

  assertEquals(ids.size, 11); // Global + 10 query scopes
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test("Edge case - empty scope", () => {
  const table = new SymbolTable();
  table.enterScope(ScopeType.QUERY);

  assertEquals(table.getSymbolsInCurrentScope().length, 0);
  assertEquals(table.resolve("anything"), null);
});

Deno.test("Edge case - deeply nested scopes", () => {
  const table = new SymbolTable();
  const depths = 20;

  for (let i = 0; i < depths; i++) {
    table.define(`var${i}`, SymbolType.VARIABLE);
    table.enterScope(ScopeType.BLOCK);
  }

  // All variables should be resolvable from deepest scope
  for (let i = 0; i < depths; i++) {
    assertExists(table.resolve(`var${i}`));
  }

  assertEquals(table.getCurrentScope().depth, depths);
});

Deno.test("Edge case - exit scope multiple times does not error", () => {
  const table = new SymbolTable();
  table.enterScope(ScopeType.QUERY);

  table.exitScope();
  table.exitScope(); // Already at global
  table.exitScope(); // Still at global

  assertEquals(table.getCurrentScope().type, ScopeType.GLOBAL);
});

Deno.test("Edge case - symbol names with special characters in metadata", () => {
  const table = new SymbolTable();

  table.define("normalName", SymbolType.VARIABLE, {
    dataType: "custom-type-with-dashes" as DataType,
  });

  const symbol = table.resolve("normalName");
  assertExists(symbol);
});
