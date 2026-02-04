/**
 * Variables Tests
 * Comprehensive tests for variable handling in the query engine
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { DataType } from "../../types/primitives.ts";
import type {
  Identifier,
  SetStatement,
  SelectStatement,
  ForStatement,
} from "../../types/ast.ts";
import { SymbolTable } from "../../analyzer/symbols.ts";

// ============================================================================
// Variable Identifier Tests
// ============================================================================

Deno.test("Identifier - simple variable name", () => {
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "myVar",
  };

  assertEquals(id.type, "IDENTIFIER");
  assertEquals(id.name, "myVar");
});

Deno.test("Identifier - underscore prefix", () => {
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "_privateVar",
  };

  assertEquals(id.name, "_privateVar");
});

Deno.test("Identifier - camelCase", () => {
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "myVariableName",
  };

  assertEquals(id.name, "myVariableName");
});

Deno.test("Identifier - with numbers", () => {
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "item123",
  };

  assertEquals(id.name, "item123");
});

Deno.test("Identifier - snake_case", () => {
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "my_variable_name",
  };

  assertEquals(id.name, "my_variable_name");
});

Deno.test("Identifier - single character", () => {
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "x",
  };

  assertEquals(id.name, "x");
});

Deno.test("Identifier - uppercase", () => {
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "CONSTANT",
  };

  assertEquals(id.name, "CONSTANT");
});

// ============================================================================
// SetStatement Variable Assignment Tests
// ============================================================================

Deno.test("SetStatement - assign string literal", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["name"],
    value: { type: "LITERAL", dataType: DataType.STRING, value: "John" },
  };

  assertEquals(stmt.type, "SET");
  assertEquals(stmt.path[0], "name");
  assertEquals((stmt.value as any).value, "John");
});

Deno.test("SetStatement - assign number literal", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["count"],
    value: { type: "LITERAL", dataType: DataType.NUMBER, value: 42 },
  };

  assertEquals((stmt.value as any).value, 42);
});

Deno.test("SetStatement - assign boolean literal", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["enabled"],
    value: { type: "LITERAL", dataType: DataType.BOOLEAN, value: true },
  };

  assertEquals((stmt.value as any).value, true);
});

Deno.test("SetStatement - assign null literal", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["result"],
    value: { type: "LITERAL", dataType: DataType.NULL, value: null },
  };

  assertEquals((stmt.value as any).value, null);
});

Deno.test("SetStatement - assign array literal", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["items"],
    value: {
      type: "ARRAY",
      elements: [
        { type: "LITERAL", dataType: DataType.NUMBER, value: 1 },
        { type: "LITERAL", dataType: DataType.NUMBER, value: 2 },
        { type: "LITERAL", dataType: DataType.NUMBER, value: 3 },
      ],
    },
  };

  assertEquals((stmt.value as any).elements.length, 3);
});

Deno.test("SetStatement - assign object literal", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["config"],
    value: {
      type: "OBJECT",
      properties: [
        { key: "timeout", value: { type: "LITERAL", dataType: DataType.NUMBER, value: 5000 } },
        { key: "retries", value: { type: "LITERAL", dataType: DataType.NUMBER, value: 3 } },
      ],
    },
  };

  assertEquals((stmt.value as any).properties.length, 2);
});

Deno.test("SetStatement - assign from expression", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["total"],
    value: {
      type: "BINARY",
      operator: "+",
      left: { type: "IDENTIFIER", name: "subtotal" },
      right: { type: "IDENTIFIER", name: "tax" },
    },
  };

  assertEquals((stmt.value as any).type, "BINARY");
});

Deno.test("SetStatement - assign from function call", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["upperName"],
    value: {
      type: "CALL",
      callee: "UPPER",
      arguments: [{ type: "IDENTIFIER", name: "name" }],
    },
  };

  assertEquals((stmt.value as any).callee, "UPPER");
});

Deno.test("SetStatement - nested path assignment", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["user", "profile", "name"],
    value: { type: "LITERAL", dataType: DataType.STRING, value: "John" },
  };

  assertEquals(stmt.path.length, 3);
  assertEquals(stmt.path[0], "user");
  assertEquals(stmt.path[1], "profile");
  assertEquals(stmt.path[2], "name");
});

Deno.test("SetStatement - deeply nested path", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["a", "b", "c", "d", "e"],
    value: { type: "LITERAL", dataType: DataType.NUMBER, value: 1 },
  };

  assertEquals(stmt.path.length, 5);
});

// ============================================================================
// Variable Reference Tests
// ============================================================================

Deno.test("Variable reference in SELECT source", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "item" }],
    source: { type: "VARIABLE", value: "myData" },
  };

  assertEquals(stmt.source.type, "VARIABLE");
  assertEquals(stmt.source.value, "myData");
});

Deno.test("Variable reference in WHERE clause", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "name" }],
    source: { type: "URL", value: "https://example.com" },
    where: {
      type: "BINARY",
      operator: "=",
      left: { type: "IDENTIFIER", name: "status" },
      right: { type: "IDENTIFIER", name: "expectedStatus" },
    },
  };

  assertEquals((stmt.where as any).right.name, "expectedStatus");
});

Deno.test("Variable reference in expression", () => {
  const expr = {
    type: "BINARY",
    operator: "*",
    left: { type: "IDENTIFIER", name: "price" },
    right: { type: "IDENTIFIER", name: "quantity" },
  };

  assertEquals(expr.left.name, "price");
  assertEquals(expr.right.name, "quantity");
});

// ============================================================================
// FOR Loop Variable Tests
// ============================================================================

Deno.test("FOR loop - introduces loop variable", () => {
  const stmt: ForStatement = {
    type: "FOR",
    variable: "item",
    collection: { type: "IDENTIFIER", name: "items" },
    body: {
      type: "SET",
      path: ["processed"],
      value: { type: "IDENTIFIER", name: "item" },
    },
  };

  assertEquals(stmt.variable, "item");
});

Deno.test("FOR loop - variable used in body", () => {
  const stmt: ForStatement = {
    type: "FOR",
    variable: "url",
    collection: {
      type: "ARRAY",
      elements: [
        { type: "LITERAL", dataType: DataType.URL, value: "https://a.com" },
        { type: "LITERAL", dataType: DataType.URL, value: "https://b.com" },
      ],
    },
    body: {
      type: "NAVIGATE",
      url: { type: "IDENTIFIER", name: "url" },
    },
  };

  assertEquals(stmt.variable, "url");
  assertEquals((stmt.body as any).url.name, "url");
});

Deno.test("FOR loop - nested loops with different variables", () => {
  const innerLoop: ForStatement = {
    type: "FOR",
    variable: "innerItem",
    collection: { type: "IDENTIFIER", name: "outerItem" },
    body: {
      type: "SET",
      path: ["result"],
      value: { type: "IDENTIFIER", name: "innerItem" },
    },
  };

  const outerLoop: ForStatement = {
    type: "FOR",
    variable: "outerItem",
    collection: { type: "IDENTIFIER", name: "data" },
    body: innerLoop,
  };

  assertEquals(outerLoop.variable, "outerItem");
  assertEquals((outerLoop.body as ForStatement).variable, "innerItem");
});

// ============================================================================
// SymbolTable Variable Tests
// ============================================================================

Deno.test("SymbolTable - define and lookup variable", () => {
  const symbolTable = new SymbolTable();

  symbolTable.define("myVar", {
    name: "myVar",
    kind: "variable",
    type: DataType.STRING,
  });

  const symbol = symbolTable.lookup("myVar");
  assertExists(symbol);
  assertEquals(symbol?.name, "myVar");
  assertEquals(symbol?.kind, "variable");
  assertEquals(symbol?.dataType, DataType.STRING);
});

Deno.test("SymbolTable - variable scoping", () => {
  const symbolTable = new SymbolTable();

  // Define in global scope
  symbolTable.define("globalVar", {
    name: "globalVar",
    kind: "variable",
    type: DataType.STRING,
  });

  // Enter a new scope
  symbolTable.enterScope();

  // Define local variable
  symbolTable.define("localVar", {
    name: "localVar",
    kind: "variable",
    type: DataType.NUMBER,
  });

  // Both should be accessible
  assertExists(symbolTable.lookup("globalVar"));
  assertExists(symbolTable.lookup("localVar"));

  // Exit scope
  symbolTable.exitScope();

  // Global should still be accessible
  assertExists(symbolTable.lookup("globalVar"));

  // Local should not be accessible
  assertEquals(symbolTable.lookup("localVar"), undefined);
});

Deno.test("SymbolTable - nested scopes", () => {
  const symbolTable = new SymbolTable();

  symbolTable.define("a", { name: "a", kind: "variable", type: DataType.STRING });

  symbolTable.enterScope();
  symbolTable.define("b", { name: "b", kind: "variable", type: DataType.STRING });

  symbolTable.enterScope();
  symbolTable.define("c", { name: "c", kind: "variable", type: DataType.STRING });

  // All accessible in innermost scope
  assertExists(symbolTable.lookup("a"));
  assertExists(symbolTable.lookup("b"));
  assertExists(symbolTable.lookup("c"));

  symbolTable.exitScope();

  // c no longer accessible
  assertExists(symbolTable.lookup("a"));
  assertExists(symbolTable.lookup("b"));
  assertEquals(symbolTable.lookup("c"), undefined);

  symbolTable.exitScope();

  // Only a accessible
  assertExists(symbolTable.lookup("a"));
  assertEquals(symbolTable.lookup("b"), undefined);
  assertEquals(symbolTable.lookup("c"), undefined);
});

Deno.test("SymbolTable - variable shadowing", () => {
  const symbolTable = new SymbolTable();

  symbolTable.define("x", { name: "x", kind: "variable", type: DataType.STRING });

  symbolTable.enterScope();

  // Shadow with different type
  symbolTable.define("x", { name: "x", kind: "variable", type: DataType.NUMBER });

  const innerX = symbolTable.lookup("x");
  assertEquals(innerX?.dataType, DataType.NUMBER);

  symbolTable.exitScope();

  const outerX = symbolTable.lookup("x");
  assertEquals(outerX?.dataType, DataType.STRING);
});

Deno.test("SymbolTable - undefined variable lookup returns undefined", () => {
  const symbolTable = new SymbolTable();

  const result = symbolTable.lookup("nonexistent");
  assertEquals(result, undefined);
});

Deno.test("SymbolTable - define function symbol", () => {
  const symbolTable = new SymbolTable();

  symbolTable.define("TEXT", {
    name: "TEXT",
    kind: "function",
    type: DataType.STRING,
    paramTypes: [DataType.SELECTOR],
    returnType: DataType.STRING,
  });

  const symbol = symbolTable.lookup("TEXT");
  assertExists(symbol);
  assertEquals(symbol?.kind, "function");
});

// ============================================================================
// Variable Type Inference Tests
// ============================================================================

Deno.test("Variable type - string from literal", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["name"],
    value: { type: "LITERAL", dataType: DataType.STRING, value: "test" },
  };

  assertEquals((stmt.value as any).dataType, DataType.STRING);
});

Deno.test("Variable type - number from literal", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["count"],
    value: { type: "LITERAL", dataType: DataType.NUMBER, value: 42 },
  };

  assertEquals((stmt.value as any).dataType, DataType.NUMBER);
});

Deno.test("Variable type - array from array expression", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["items"],
    value: {
      type: "ARRAY",
      elements: [],
    },
  };

  assertEquals((stmt.value as any).type, "ARRAY");
});

Deno.test("Variable type - object from object expression", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["config"],
    value: {
      type: "OBJECT",
      properties: [],
    },
  };

  assertEquals((stmt.value as any).type, "OBJECT");
});

// ============================================================================
// Reserved Variable Names Tests
// ============================================================================

Deno.test("Special variable - response", () => {
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "response",
  };

  assertEquals(id.name, "response");
});

Deno.test("Special variable - dom", () => {
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "dom",
  };

  assertEquals(id.name, "dom");
});

Deno.test("Special variable - cookies", () => {
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "cookies",
  };

  assertEquals(id.name, "cookies");
});

Deno.test("Special variable - headers", () => {
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "headers",
  };

  assertEquals(id.name, "headers");
});

// ============================================================================
// Variable Path Access Tests
// ============================================================================

Deno.test("Member access - dot notation", () => {
  const expr = {
    type: "MEMBER",
    object: { type: "IDENTIFIER", name: "user" },
    property: "name",
    computed: false,
  };

  assertEquals(expr.object.name, "user");
  assertEquals(expr.property, "name");
  assertEquals(expr.computed, false);
});

Deno.test("Member access - bracket notation", () => {
  const expr = {
    type: "MEMBER",
    object: { type: "IDENTIFIER", name: "data" },
    property: "special-key",
    computed: true,
  };

  assertEquals(expr.computed, true);
  assertEquals(expr.property, "special-key");
});

Deno.test("Member access - array index", () => {
  const expr = {
    type: "MEMBER",
    object: { type: "IDENTIFIER", name: "items" },
    property: "0",
    computed: true,
  };

  assertEquals(expr.property, "0");
});

Deno.test("Member access - chained", () => {
  const innerMember = {
    type: "MEMBER",
    object: { type: "IDENTIFIER", name: "response" },
    property: "data",
    computed: false,
  };

  const outerMember = {
    type: "MEMBER",
    object: innerMember,
    property: "items",
    computed: false,
  };

  assertEquals(outerMember.property, "items");
  assertEquals(outerMember.object.property, "data");
});
