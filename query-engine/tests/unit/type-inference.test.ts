/**
 * Type Inference Tests
 * Comprehensive tests for TypeChecker and type inference
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import { TypeChecker, TypeCheckError } from "../../analyzer/type-checker.ts";
import { SymbolTable, SymbolType } from "../../analyzer/symbols.ts";
import { DataType } from "../../types/primitives.ts";
import type {
  Expression,
  BinaryExpression,
  UnaryExpression,
  Literal,
  Identifier,
  CallExpression,
  MemberExpression,
  ArrayExpression,
  ObjectExpression,
  SelectStatement,
} from "../../types/ast.ts";

// ============================================================================
// Helper Functions
// ============================================================================

function createTypeChecker(): TypeChecker {
  const symbolTable = new SymbolTable();
  return new TypeChecker(symbolTable);
}

function createTypeCheckerWithSymbols(): TypeChecker {
  const symbolTable = new SymbolTable();
  symbolTable.define({
    name: "myString",
    type: SymbolType.VARIABLE,
    dataType: DataType.STRING,
  });
  symbolTable.define({
    name: "myNumber",
    type: SymbolType.VARIABLE,
    dataType: DataType.NUMBER,
  });
  symbolTable.define({
    name: "myBoolean",
    type: SymbolType.VARIABLE,
    dataType: DataType.BOOLEAN,
  });
  symbolTable.define({
    name: "myArray",
    type: SymbolType.VARIABLE,
    dataType: DataType.ARRAY,
  });
  return new TypeChecker(symbolTable);
}

// ============================================================================
// Literal Type Inference Tests
// ============================================================================

Deno.test("TypeChecker - infer string literal type", () => {
  const checker = createTypeChecker();
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.STRING,
    value: "hello",
  };

  assertEquals(checker.inferType(literal), DataType.STRING);
});

Deno.test("TypeChecker - infer number literal type", () => {
  const checker = createTypeChecker();
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: 42,
  };

  assertEquals(checker.inferType(literal), DataType.NUMBER);
});

Deno.test("TypeChecker - infer boolean literal type", () => {
  const checker = createTypeChecker();
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.BOOLEAN,
    value: true,
  };

  assertEquals(checker.inferType(literal), DataType.BOOLEAN);
});

Deno.test("TypeChecker - infer null literal type", () => {
  const checker = createTypeChecker();
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NULL,
    value: null,
  };

  assertEquals(checker.inferType(literal), DataType.NULL);
});

Deno.test("TypeChecker - infer URL literal type", () => {
  const checker = createTypeChecker();
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.URL,
    value: "https://example.com",
  };

  assertEquals(checker.inferType(literal), DataType.URL);
});

// ============================================================================
// Identifier Type Inference Tests
// ============================================================================

Deno.test("TypeChecker - infer known identifier type", () => {
  const checker = createTypeCheckerWithSymbols();
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "myString",
  };

  assertEquals(checker.inferType(id), DataType.STRING);
});

Deno.test("TypeChecker - infer unknown identifier type", () => {
  const checker = createTypeChecker();
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "unknownVar",
  };

  assertEquals(checker.inferType(id), DataType.UNKNOWN);
});

Deno.test("TypeChecker - infer number identifier type", () => {
  const checker = createTypeCheckerWithSymbols();
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "myNumber",
  };

  assertEquals(checker.inferType(id), DataType.NUMBER);
});

// ============================================================================
// Array and Object Type Inference Tests
// ============================================================================

Deno.test("TypeChecker - infer array expression type", () => {
  const checker = createTypeChecker();
  const arr: ArrayExpression = {
    type: "ARRAY",
    elements: [
      { type: "LITERAL", dataType: DataType.NUMBER, value: 1 },
      { type: "LITERAL", dataType: DataType.NUMBER, value: 2 },
    ],
  };

  assertEquals(checker.inferType(arr), DataType.ARRAY);
});

Deno.test("TypeChecker - infer object expression type", () => {
  const checker = createTypeChecker();
  const obj: ObjectExpression = {
    type: "OBJECT",
    properties: [
      { key: "name", value: { type: "LITERAL", dataType: DataType.STRING, value: "John" } },
    ],
  };

  assertEquals(checker.inferType(obj), DataType.OBJECT);
});

// ============================================================================
// Binary Expression Type Inference Tests
// ============================================================================

Deno.test("TypeChecker - comparison operators return boolean", () => {
  const checker = createTypeChecker();
  const operators: BinaryExpression["operator"][] = ["=", "!=", ">", ">=", "<", "<="];

  for (const operator of operators) {
    const expr: BinaryExpression = {
      type: "BINARY",
      operator,
      left: { type: "LITERAL", dataType: DataType.NUMBER, value: 5 },
      right: { type: "LITERAL", dataType: DataType.NUMBER, value: 10 },
    };

    assertEquals(checker.inferType(expr), DataType.BOOLEAN);
  }
});

Deno.test("TypeChecker - IN operator returns boolean", () => {
  const checker = createTypeChecker();
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "IN",
    left: { type: "LITERAL", dataType: DataType.STRING, value: "a" },
    right: { type: "ARRAY", elements: [] },
  };

  assertEquals(checker.inferType(expr), DataType.BOOLEAN);
});

Deno.test("TypeChecker - LIKE operator returns boolean", () => {
  const checker = createTypeChecker();
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "LIKE",
    left: { type: "LITERAL", dataType: DataType.STRING, value: "hello" },
    right: { type: "LITERAL", dataType: DataType.STRING, value: "%llo" },
  };

  assertEquals(checker.inferType(expr), DataType.BOOLEAN);
});

Deno.test("TypeChecker - MATCHES operator returns boolean", () => {
  const checker = createTypeChecker();
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "MATCHES",
    left: { type: "LITERAL", dataType: DataType.STRING, value: "test" },
    right: { type: "LITERAL", dataType: DataType.REGEX, value: "^t.*" },
  };

  assertEquals(checker.inferType(expr), DataType.BOOLEAN);
});

Deno.test("TypeChecker - CONTAINS operator returns boolean", () => {
  const checker = createTypeChecker();
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "CONTAINS",
    left: { type: "LITERAL", dataType: DataType.STRING, value: "hello world" },
    right: { type: "LITERAL", dataType: DataType.STRING, value: "world" },
  };

  assertEquals(checker.inferType(expr), DataType.BOOLEAN);
});

Deno.test("TypeChecker - AND operator returns boolean", () => {
  const checker = createTypeChecker();
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "AND",
    left: { type: "LITERAL", dataType: DataType.BOOLEAN, value: true },
    right: { type: "LITERAL", dataType: DataType.BOOLEAN, value: false },
  };

  assertEquals(checker.inferType(expr), DataType.BOOLEAN);
});

Deno.test("TypeChecker - OR operator returns boolean", () => {
  const checker = createTypeChecker();
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "OR",
    left: { type: "LITERAL", dataType: DataType.BOOLEAN, value: true },
    right: { type: "LITERAL", dataType: DataType.BOOLEAN, value: false },
  };

  assertEquals(checker.inferType(expr), DataType.BOOLEAN);
});

Deno.test("TypeChecker - arithmetic operators return number", () => {
  const checker = createTypeChecker();
  const operators: BinaryExpression["operator"][] = ["+", "-", "*", "/", "%"];

  for (const operator of operators) {
    const expr: BinaryExpression = {
      type: "BINARY",
      operator,
      left: { type: "LITERAL", dataType: DataType.NUMBER, value: 10 },
      right: { type: "LITERAL", dataType: DataType.NUMBER, value: 5 },
    };

    assertEquals(checker.inferType(expr), DataType.NUMBER);
  }
});

Deno.test("TypeChecker - string concatenation with + returns string", () => {
  const checker = createTypeChecker();
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "+",
    left: { type: "LITERAL", dataType: DataType.STRING, value: "hello" },
    right: { type: "LITERAL", dataType: DataType.STRING, value: "world" },
  };

  assertEquals(checker.inferType(expr), DataType.STRING);
});

Deno.test("TypeChecker - || operator returns string", () => {
  const checker = createTypeChecker();
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "||",
    left: { type: "LITERAL", dataType: DataType.STRING, value: "hello" },
    right: { type: "LITERAL", dataType: DataType.STRING, value: "world" },
  };

  assertEquals(checker.inferType(expr), DataType.STRING);
});

// ============================================================================
// Unary Expression Type Inference Tests
// ============================================================================

Deno.test("TypeChecker - NOT operator returns boolean", () => {
  const checker = createTypeChecker();
  const expr: UnaryExpression = {
    type: "UNARY",
    operator: "NOT",
    operand: { type: "LITERAL", dataType: DataType.BOOLEAN, value: true },
  };

  assertEquals(checker.inferType(expr), DataType.BOOLEAN);
});

Deno.test("TypeChecker - unary minus returns number", () => {
  const checker = createTypeChecker();
  const expr: UnaryExpression = {
    type: "UNARY",
    operator: "-",
    operand: { type: "LITERAL", dataType: DataType.NUMBER, value: 5 },
  };

  assertEquals(checker.inferType(expr), DataType.NUMBER);
});

Deno.test("TypeChecker - unary plus returns number", () => {
  const checker = createTypeChecker();
  const expr: UnaryExpression = {
    type: "UNARY",
    operator: "+",
    operand: { type: "LITERAL", dataType: DataType.NUMBER, value: 5 },
  };

  assertEquals(checker.inferType(expr), DataType.NUMBER);
});

// ============================================================================
// Call Expression Type Inference Tests
// ============================================================================

Deno.test("TypeChecker - string functions return string", () => {
  const checker = createTypeChecker();
  const functions = ["UPPER", "LOWER", "TRIM", "SUBSTRING", "REPLACE"];

  for (const func of functions) {
    const expr: CallExpression = {
      type: "CALL",
      callee: func,
      arguments: [{ type: "LITERAL", dataType: DataType.STRING, value: "test" }],
    };

    assertEquals(checker.inferType(expr), DataType.STRING);
  }
});

Deno.test("TypeChecker - DOM functions return correct types", () => {
  const checker = createTypeChecker();

  // TEXT returns string
  assertEquals(
    checker.inferType({ type: "CALL", callee: "TEXT", arguments: [] }),
    DataType.STRING
  );

  // HTML returns string
  assertEquals(
    checker.inferType({ type: "CALL", callee: "HTML", arguments: [] }),
    DataType.STRING
  );

  // ATTR returns string
  assertEquals(
    checker.inferType({ type: "CALL", callee: "ATTR", arguments: [] }),
    DataType.STRING
  );

  // COUNT returns number
  assertEquals(
    checker.inferType({ type: "CALL", callee: "COUNT", arguments: [] }),
    DataType.NUMBER
  );

  // EXISTS returns boolean
  assertEquals(
    checker.inferType({ type: "CALL", callee: "EXISTS", arguments: [] }),
    DataType.BOOLEAN
  );
});

Deno.test("TypeChecker - network functions return correct types", () => {
  const checker = createTypeChecker();

  assertEquals(
    checker.inferType({ type: "CALL", callee: "HEADER", arguments: [] }),
    DataType.STRING
  );

  assertEquals(
    checker.inferType({ type: "CALL", callee: "BODY", arguments: [] }),
    DataType.STRING
  );

  assertEquals(
    checker.inferType({ type: "CALL", callee: "STATUS", arguments: [] }),
    DataType.NUMBER
  );

  assertEquals(
    checker.inferType({ type: "CALL", callee: "CACHED", arguments: [] }),
    DataType.BOOLEAN
  );
});

Deno.test("TypeChecker - utility functions return correct types", () => {
  const checker = createTypeChecker();

  assertEquals(
    checker.inferType({ type: "CALL", callee: "PARSE_JSON", arguments: [] }),
    DataType.OBJECT
  );

  assertEquals(
    checker.inferType({ type: "CALL", callee: "PARSE_HTML", arguments: [] }),
    DataType.DOCUMENT
  );

  assertEquals(
    checker.inferType({ type: "CALL", callee: "SCREENSHOT", arguments: [] }),
    DataType.BYTES
  );

  assertEquals(
    checker.inferType({ type: "CALL", callee: "PDF", arguments: [] }),
    DataType.BYTES
  );
});

Deno.test("TypeChecker - unknown function returns unknown", () => {
  const checker = createTypeChecker();
  const expr: CallExpression = {
    type: "CALL",
    callee: "UNKNOWN_FUNCTION",
    arguments: [],
  };

  assertEquals(checker.inferType(expr), DataType.UNKNOWN);
});

// ============================================================================
// Member Expression Type Inference Tests
// ============================================================================

Deno.test("TypeChecker - member expression on unknown returns unknown", () => {
  const checker = createTypeChecker();
  const expr: MemberExpression = {
    type: "MEMBER",
    object: { type: "IDENTIFIER", name: "unknownObj" },
    property: "field",
    computed: false,
  };

  assertEquals(checker.inferType(expr), DataType.UNKNOWN);
});

// ============================================================================
// Type Check Error Tests
// ============================================================================

Deno.test("TypeChecker - AND with non-boolean left throws", () => {
  const checker = createTypeCheckerWithSymbols();
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "AND",
    left: { type: "IDENTIFIER", name: "myString" },
    right: { type: "LITERAL", dataType: DataType.BOOLEAN, value: true },
  };

  assertThrows(
    () => checker.inferType(expr),
    TypeCheckError,
    "Left operand of AND must be Boolean"
  );
});

Deno.test("TypeChecker - OR with non-boolean right throws", () => {
  const checker = createTypeCheckerWithSymbols();
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "OR",
    left: { type: "LITERAL", dataType: DataType.BOOLEAN, value: true },
    right: { type: "IDENTIFIER", name: "myNumber" },
  };

  assertThrows(
    () => checker.inferType(expr),
    TypeCheckError,
    "Right operand of OR must be Boolean"
  );
});

Deno.test("TypeChecker - NOT with non-boolean throws", () => {
  const checker = createTypeCheckerWithSymbols();
  const expr: UnaryExpression = {
    type: "UNARY",
    operator: "NOT",
    operand: { type: "IDENTIFIER", name: "myString" },
  };

  assertThrows(
    () => checker.inferType(expr),
    TypeCheckError,
    "NOT operator requires Boolean operand"
  );
});

Deno.test("TypeChecker - unary minus on non-number throws", () => {
  const checker = createTypeCheckerWithSymbols();
  const expr: UnaryExpression = {
    type: "UNARY",
    operator: "-",
    operand: { type: "IDENTIFIER", name: "myString" },
  };

  assertThrows(
    () => checker.inferType(expr),
    TypeCheckError,
    "Unary - requires numeric operand"
  );
});

Deno.test("TypeChecker - arithmetic on non-numbers throws", () => {
  const checker = createTypeCheckerWithSymbols();
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "*",
    left: { type: "IDENTIFIER", name: "myString" },
    right: { type: "LITERAL", dataType: DataType.NUMBER, value: 5 },
  };

  // String operands get a more specific error message
  assertThrows(
    () => checker.inferType(expr),
    TypeCheckError,
    "Cannot apply * to string"
  );
});

Deno.test("TypeChecker - subtraction on strings throws", () => {
  const checker = createTypeChecker();
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "-",
    left: { type: "LITERAL", dataType: DataType.STRING, value: "hello" },
    right: { type: "LITERAL", dataType: DataType.STRING, value: "world" },
  };

  assertThrows(
    () => checker.inferType(expr),
    TypeCheckError,
    "Cannot apply - to string"
  );
});

// ============================================================================
// Statement Type Checking Tests
// ============================================================================

Deno.test("TypeChecker - SELECT with non-boolean WHERE throws", () => {
  const checker = createTypeCheckerWithSymbols();
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title" }],
    source: { type: "URL", value: "https://example.com" },
    where: { type: "IDENTIFIER", name: "myString" },
  };

  assertThrows(
    () => checker.checkStatement(stmt),
    TypeCheckError,
    "WHERE clause must be Boolean"
  );
});

Deno.test("TypeChecker - SELECT with negative LIMIT throws", () => {
  const checker = createTypeChecker();
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title" }],
    source: { type: "URL", value: "https://example.com" },
    limit: { count: -1 },
  };

  assertThrows(
    () => checker.checkStatement(stmt),
    TypeCheckError,
    "LIMIT must be non-negative"
  );
});

Deno.test("TypeChecker - SELECT with negative OFFSET throws", () => {
  const checker = createTypeChecker();
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title" }],
    source: { type: "URL", value: "https://example.com" },
    limit: { count: 10, offset: -5 },
  };

  assertThrows(
    () => checker.checkStatement(stmt),
    TypeCheckError,
    "OFFSET must be non-negative"
  );
});

Deno.test("TypeChecker - SELECT with invalid ORDER BY field throws", () => {
  const checker = createTypeChecker();
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title" }],
    source: { type: "URL", value: "https://example.com" },
    orderBy: [{ field: "nonexistent", direction: "ASC" }],
  };

  assertThrows(
    () => checker.checkStatement(stmt),
    TypeCheckError,
    "ORDER BY field 'nonexistent' not found in SELECT list"
  );
});

// ============================================================================
// Type Coercion Tests
// ============================================================================

Deno.test("TypeChecker - same type can coerce", () => {
  const checker = createTypeChecker();
  assert(checker.canCoerce(DataType.STRING, DataType.STRING));
  assert(checker.canCoerce(DataType.NUMBER, DataType.NUMBER));
  assert(checker.canCoerce(DataType.BOOLEAN, DataType.BOOLEAN));
});

Deno.test("TypeChecker - any type can coerce to UNKNOWN", () => {
  const checker = createTypeChecker();
  assert(checker.canCoerce(DataType.STRING, DataType.UNKNOWN));
  assert(checker.canCoerce(DataType.NUMBER, DataType.UNKNOWN));
  assert(checker.canCoerce(DataType.BOOLEAN, DataType.UNKNOWN));
});

Deno.test("TypeChecker - UNKNOWN can coerce to any type", () => {
  const checker = createTypeChecker();
  assert(checker.canCoerce(DataType.UNKNOWN, DataType.STRING));
  assert(checker.canCoerce(DataType.UNKNOWN, DataType.NUMBER));
  assert(checker.canCoerce(DataType.UNKNOWN, DataType.BOOLEAN));
});

Deno.test("TypeChecker - NULL can coerce to any type", () => {
  const checker = createTypeChecker();
  assert(checker.canCoerce(DataType.NULL, DataType.STRING));
  assert(checker.canCoerce(DataType.NULL, DataType.NUMBER));
  assert(checker.canCoerce(DataType.NULL, DataType.BOOLEAN));
  assert(checker.canCoerce(DataType.NULL, DataType.ARRAY));
});

Deno.test("TypeChecker - NUMBER can coerce to STRING", () => {
  const checker = createTypeChecker();
  assert(checker.canCoerce(DataType.NUMBER, DataType.STRING));
});

Deno.test("TypeChecker - BOOLEAN can coerce to STRING", () => {
  const checker = createTypeChecker();
  assert(checker.canCoerce(DataType.BOOLEAN, DataType.STRING));
});

Deno.test("TypeChecker - URL and STRING are mutually coercible", () => {
  const checker = createTypeChecker();
  assert(checker.canCoerce(DataType.URL, DataType.STRING));
  assert(checker.canCoerce(DataType.STRING, DataType.URL));
});

Deno.test("TypeChecker - DOCUMENT can coerce to STRING", () => {
  const checker = createTypeChecker();
  assert(checker.canCoerce(DataType.DOCUMENT, DataType.STRING));
});

Deno.test("TypeChecker - BYTES can coerce to STRING", () => {
  const checker = createTypeChecker();
  assert(checker.canCoerce(DataType.BYTES, DataType.STRING));
});

Deno.test("TypeChecker - incompatible types cannot coerce", () => {
  const checker = createTypeChecker();
  assert(!checker.canCoerce(DataType.STRING, DataType.NUMBER));
  assert(!checker.canCoerce(DataType.BOOLEAN, DataType.NUMBER));
  assert(!checker.canCoerce(DataType.ARRAY, DataType.STRING));
});

// ============================================================================
// Type Compatibility Tests
// ============================================================================

Deno.test("TypeChecker - comparing incompatible types throws", () => {
  const checker = createTypeCheckerWithSymbols();
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "=",
    left: { type: "IDENTIFIER", name: "myString" },
    right: { type: "IDENTIFIER", name: "myNumber" },
  };

  assertThrows(
    () => checker.inferType(expr),
    TypeCheckError,
    "Cannot compare"
  );
});

// ============================================================================
// getSymbolTable Tests
// ============================================================================

Deno.test("TypeChecker - getSymbolTable returns symbol table", () => {
  const checker = createTypeCheckerWithSymbols();
  const table = checker.getSymbolTable();

  assertExists(table);
  assertExists(table.resolve("myString"));
});
