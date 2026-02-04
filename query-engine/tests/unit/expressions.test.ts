/**
 * Expressions Tests
 * Comprehensive tests for AST expression types
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { DataType } from "../../types/primitives.ts";
import type {
  Expression,
  BinaryExpression,
  UnaryExpression,
  CallExpression,
  MemberExpression,
  Literal,
  Identifier,
  ArrayExpression,
  ObjectExpression,
  BinaryOperator,
  UnaryOperator,
} from "../../types/ast.ts";

// ============================================================================
// Literal Expression Tests
// ============================================================================

Deno.test("Literal - string literal", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.STRING,
    value: "hello world",
  };

  assertEquals(literal.type, "LITERAL");
  assertEquals(literal.dataType, DataType.STRING);
  assertEquals(literal.value, "hello world");
});

Deno.test("Literal - number literal integer", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: 42,
  };

  assertEquals(literal.type, "LITERAL");
  assertEquals(literal.dataType, DataType.NUMBER);
  assertEquals(literal.value, 42);
});

Deno.test("Literal - number literal float", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: 3.14159,
  };

  assertEquals(literal.type, "LITERAL");
  assertEquals(literal.dataType, DataType.NUMBER);
  assertEquals(literal.value, 3.14159);
});

Deno.test("Literal - boolean true", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.BOOLEAN,
    value: true,
  };

  assertEquals(literal.type, "LITERAL");
  assertEquals(literal.dataType, DataType.BOOLEAN);
  assertEquals(literal.value, true);
});

Deno.test("Literal - boolean false", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.BOOLEAN,
    value: false,
  };

  assertEquals(literal.value, false);
});

Deno.test("Literal - null value", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NULL,
    value: null,
  };

  assertEquals(literal.type, "LITERAL");
  assertEquals(literal.dataType, DataType.NULL);
  assertEquals(literal.value, null);
});

Deno.test("Literal - URL value", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.URL,
    value: "https://example.com",
  };

  assertEquals(literal.dataType, DataType.URL);
  assertEquals(literal.value, "https://example.com");
});

Deno.test("Literal - with source location", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.STRING,
    value: "test",
    location: {
      start: { line: 1, column: 10, offset: 9 },
      end: { line: 1, column: 16, offset: 15 },
    },
  };

  assertExists(literal.location);
  assertEquals(literal.location?.start.line, 1);
  assertEquals(literal.location?.start.column, 10);
});

// ============================================================================
// Identifier Expression Tests
// ============================================================================

Deno.test("Identifier - simple name", () => {
  const identifier: Identifier = {
    type: "IDENTIFIER",
    name: "title",
  };

  assertEquals(identifier.type, "IDENTIFIER");
  assertEquals(identifier.name, "title");
});

Deno.test("Identifier - variable name", () => {
  const identifier: Identifier = {
    type: "IDENTIFIER",
    name: "myVariable",
  };

  assertEquals(identifier.name, "myVariable");
});

Deno.test("Identifier - underscore prefix", () => {
  const identifier: Identifier = {
    type: "IDENTIFIER",
    name: "_privateVar",
  };

  assertEquals(identifier.name, "_privateVar");
});

Deno.test("Identifier - with numbers", () => {
  const identifier: Identifier = {
    type: "IDENTIFIER",
    name: "item123",
  };

  assertEquals(identifier.name, "item123");
});

// ============================================================================
// Binary Expression Tests
// ============================================================================

Deno.test("BinaryExpression - addition", () => {
  const left: Literal = { type: "LITERAL", dataType: DataType.NUMBER, value: 5 };
  const right: Literal = { type: "LITERAL", dataType: DataType.NUMBER, value: 3 };

  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "+",
    left,
    right,
  };

  assertEquals(expr.type, "BINARY");
  assertEquals(expr.operator, "+");
  assertEquals((expr.left as Literal).value, 5);
  assertEquals((expr.right as Literal).value, 3);
});

Deno.test("BinaryExpression - subtraction", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "-",
    left: { type: "LITERAL", dataType: DataType.NUMBER, value: 10 },
    right: { type: "LITERAL", dataType: DataType.NUMBER, value: 4 },
  };

  assertEquals(expr.operator, "-");
});

Deno.test("BinaryExpression - multiplication", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "*",
    left: { type: "LITERAL", dataType: DataType.NUMBER, value: 6 },
    right: { type: "LITERAL", dataType: DataType.NUMBER, value: 7 },
  };

  assertEquals(expr.operator, "*");
});

Deno.test("BinaryExpression - division", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "/",
    left: { type: "LITERAL", dataType: DataType.NUMBER, value: 20 },
    right: { type: "LITERAL", dataType: DataType.NUMBER, value: 4 },
  };

  assertEquals(expr.operator, "/");
});

Deno.test("BinaryExpression - modulo", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "%",
    left: { type: "LITERAL", dataType: DataType.NUMBER, value: 17 },
    right: { type: "LITERAL", dataType: DataType.NUMBER, value: 5 },
  };

  assertEquals(expr.operator, "%");
});

Deno.test("BinaryExpression - equality", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "=",
    left: { type: "IDENTIFIER", name: "status" },
    right: { type: "LITERAL", dataType: DataType.NUMBER, value: 200 },
  };

  assertEquals(expr.operator, "=");
});

Deno.test("BinaryExpression - inequality", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "!=",
    left: { type: "IDENTIFIER", name: "error" },
    right: { type: "LITERAL", dataType: DataType.NULL, value: null },
  };

  assertEquals(expr.operator, "!=");
});

Deno.test("BinaryExpression - greater than", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: ">",
    left: { type: "IDENTIFIER", name: "count" },
    right: { type: "LITERAL", dataType: DataType.NUMBER, value: 0 },
  };

  assertEquals(expr.operator, ">");
});

Deno.test("BinaryExpression - greater than or equal", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: ">=",
    left: { type: "IDENTIFIER", name: "age" },
    right: { type: "LITERAL", dataType: DataType.NUMBER, value: 18 },
  };

  assertEquals(expr.operator, ">=");
});

Deno.test("BinaryExpression - less than", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "<",
    left: { type: "IDENTIFIER", name: "price" },
    right: { type: "LITERAL", dataType: DataType.NUMBER, value: 100 },
  };

  assertEquals(expr.operator, "<");
});

Deno.test("BinaryExpression - less than or equal", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "<=",
    left: { type: "IDENTIFIER", name: "quantity" },
    right: { type: "LITERAL", dataType: DataType.NUMBER, value: 10 },
  };

  assertEquals(expr.operator, "<=");
});

Deno.test("BinaryExpression - AND logical", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "AND",
    left: { type: "IDENTIFIER", name: "isActive" },
    right: { type: "IDENTIFIER", name: "isVerified" },
  };

  assertEquals(expr.operator, "AND");
});

Deno.test("BinaryExpression - OR logical", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "OR",
    left: { type: "IDENTIFIER", name: "isAdmin" },
    right: { type: "IDENTIFIER", name: "isModerator" },
  };

  assertEquals(expr.operator, "OR");
});

Deno.test("BinaryExpression - IN operator", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "IN",
    left: { type: "IDENTIFIER", name: "status" },
    right: {
      type: "ARRAY",
      elements: [
        { type: "LITERAL", dataType: DataType.STRING, value: "active" },
        { type: "LITERAL", dataType: DataType.STRING, value: "pending" },
      ],
    },
  };

  assertEquals(expr.operator, "IN");
});

Deno.test("BinaryExpression - NOT IN operator", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "NOT IN",
    left: { type: "IDENTIFIER", name: "role" },
    right: {
      type: "ARRAY",
      elements: [
        { type: "LITERAL", dataType: DataType.STRING, value: "banned" },
      ],
    },
  };

  assertEquals(expr.operator, "NOT IN");
});

Deno.test("BinaryExpression - LIKE operator", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "LIKE",
    left: { type: "IDENTIFIER", name: "name" },
    right: { type: "LITERAL", dataType: DataType.STRING, value: "%John%" },
  };

  assertEquals(expr.operator, "LIKE");
});

Deno.test("BinaryExpression - NOT LIKE operator", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "NOT LIKE",
    left: { type: "IDENTIFIER", name: "email" },
    right: { type: "LITERAL", dataType: DataType.STRING, value: "%spam%" },
  };

  assertEquals(expr.operator, "NOT LIKE");
});

Deno.test("BinaryExpression - MATCHES operator", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "MATCHES",
    left: { type: "IDENTIFIER", name: "phone" },
    right: { type: "LITERAL", dataType: DataType.REGEX, value: "^\\d{3}-\\d{4}$" },
  };

  assertEquals(expr.operator, "MATCHES");
});

Deno.test("BinaryExpression - CONTAINS operator", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "CONTAINS",
    left: { type: "IDENTIFIER", name: "tags" },
    right: { type: "LITERAL", dataType: DataType.STRING, value: "featured" },
  };

  assertEquals(expr.operator, "CONTAINS");
});

Deno.test("BinaryExpression - string concatenation", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "||",
    left: { type: "IDENTIFIER", name: "firstName" },
    right: { type: "IDENTIFIER", name: "lastName" },
  };

  assertEquals(expr.operator, "||");
});

Deno.test("BinaryExpression - nested expressions", () => {
  // (a + b) * c
  const innerExpr: BinaryExpression = {
    type: "BINARY",
    operator: "+",
    left: { type: "IDENTIFIER", name: "a" },
    right: { type: "IDENTIFIER", name: "b" },
  };

  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "*",
    left: innerExpr,
    right: { type: "IDENTIFIER", name: "c" },
  };

  assertEquals(expr.operator, "*");
  assertEquals((expr.left as BinaryExpression).operator, "+");
});

// ============================================================================
// Unary Expression Tests
// ============================================================================

Deno.test("UnaryExpression - NOT operator", () => {
  const expr: UnaryExpression = {
    type: "UNARY",
    operator: "NOT",
    operand: { type: "IDENTIFIER", name: "isActive" },
  };

  assertEquals(expr.type, "UNARY");
  assertEquals(expr.operator, "NOT");
  assertEquals((expr.operand as Identifier).name, "isActive");
});

Deno.test("UnaryExpression - negative number", () => {
  const expr: UnaryExpression = {
    type: "UNARY",
    operator: "-",
    operand: { type: "LITERAL", dataType: DataType.NUMBER, value: 5 },
  };

  assertEquals(expr.operator, "-");
  assertEquals((expr.operand as Literal).value, 5);
});

Deno.test("UnaryExpression - positive number", () => {
  const expr: UnaryExpression = {
    type: "UNARY",
    operator: "+",
    operand: { type: "LITERAL", dataType: DataType.NUMBER, value: 10 },
  };

  assertEquals(expr.operator, "+");
});

Deno.test("UnaryExpression - double negation", () => {
  const inner: UnaryExpression = {
    type: "UNARY",
    operator: "NOT",
    operand: { type: "IDENTIFIER", name: "flag" },
  };

  const expr: UnaryExpression = {
    type: "UNARY",
    operator: "NOT",
    operand: inner,
  };

  assertEquals(expr.operator, "NOT");
  assertEquals((expr.operand as UnaryExpression).operator, "NOT");
});

// ============================================================================
// Call Expression Tests
// ============================================================================

Deno.test("CallExpression - no arguments", () => {
  const expr: CallExpression = {
    type: "CALL",
    callee: "NOW",
    arguments: [],
  };

  assertEquals(expr.type, "CALL");
  assertEquals(expr.callee, "NOW");
  assertEquals(expr.arguments.length, 0);
});

Deno.test("CallExpression - single argument", () => {
  const expr: CallExpression = {
    type: "CALL",
    callee: "UPPER",
    arguments: [
      { type: "IDENTIFIER", name: "name" },
    ],
  };

  assertEquals(expr.callee, "UPPER");
  assertEquals(expr.arguments.length, 1);
});

Deno.test("CallExpression - multiple arguments", () => {
  const expr: CallExpression = {
    type: "CALL",
    callee: "SUBSTRING",
    arguments: [
      { type: "IDENTIFIER", name: "text" },
      { type: "LITERAL", dataType: DataType.NUMBER, value: 0 },
      { type: "LITERAL", dataType: DataType.NUMBER, value: 10 },
    ],
  };

  assertEquals(expr.callee, "SUBSTRING");
  assertEquals(expr.arguments.length, 3);
});

Deno.test("CallExpression - TEXT function", () => {
  const expr: CallExpression = {
    type: "CALL",
    callee: "TEXT",
    arguments: [
      { type: "LITERAL", dataType: DataType.SELECTOR, value: "#content" },
    ],
  };

  assertEquals(expr.callee, "TEXT");
});

Deno.test("CallExpression - HTML function", () => {
  const expr: CallExpression = {
    type: "CALL",
    callee: "HTML",
    arguments: [
      { type: "LITERAL", dataType: DataType.SELECTOR, value: ".article" },
    ],
  };

  assertEquals(expr.callee, "HTML");
});

Deno.test("CallExpression - ATTR function", () => {
  const expr: CallExpression = {
    type: "CALL",
    callee: "ATTR",
    arguments: [
      { type: "LITERAL", dataType: DataType.SELECTOR, value: "a" },
      { type: "LITERAL", dataType: DataType.STRING, value: "href" },
    ],
  };

  assertEquals(expr.callee, "ATTR");
  assertEquals(expr.arguments.length, 2);
});

Deno.test("CallExpression - nested calls", () => {
  // UPPER(TRIM(name))
  const innerCall: CallExpression = {
    type: "CALL",
    callee: "TRIM",
    arguments: [{ type: "IDENTIFIER", name: "name" }],
  };

  const expr: CallExpression = {
    type: "CALL",
    callee: "UPPER",
    arguments: [innerCall],
  };

  assertEquals(expr.callee, "UPPER");
  assertEquals((expr.arguments[0] as CallExpression).callee, "TRIM");
});

// ============================================================================
// Member Expression Tests
// ============================================================================

Deno.test("MemberExpression - dot notation", () => {
  const expr: MemberExpression = {
    type: "MEMBER",
    object: { type: "IDENTIFIER", name: "response" },
    property: "status",
    computed: false,
  };

  assertEquals(expr.type, "MEMBER");
  assertEquals((expr.object as Identifier).name, "response");
  assertEquals(expr.property, "status");
  assertEquals(expr.computed, false);
});

Deno.test("MemberExpression - bracket notation", () => {
  const expr: MemberExpression = {
    type: "MEMBER",
    object: { type: "IDENTIFIER", name: "headers" },
    property: "Content-Type",
    computed: true,
  };

  assertEquals(expr.property, "Content-Type");
  assertEquals(expr.computed, true);
});

Deno.test("MemberExpression - chained access", () => {
  // response.data.items
  const innerMember: MemberExpression = {
    type: "MEMBER",
    object: { type: "IDENTIFIER", name: "response" },
    property: "data",
    computed: false,
  };

  const expr: MemberExpression = {
    type: "MEMBER",
    object: innerMember,
    property: "items",
    computed: false,
  };

  assertEquals(expr.property, "items");
  assertEquals((expr.object as MemberExpression).property, "data");
});

Deno.test("MemberExpression - array index access", () => {
  const expr: MemberExpression = {
    type: "MEMBER",
    object: { type: "IDENTIFIER", name: "items" },
    property: "0",
    computed: true,
  };

  assertEquals(expr.property, "0");
  assertEquals(expr.computed, true);
});

// ============================================================================
// Array Expression Tests
// ============================================================================

Deno.test("ArrayExpression - empty array", () => {
  const expr: ArrayExpression = {
    type: "ARRAY",
    elements: [],
  };

  assertEquals(expr.type, "ARRAY");
  assertEquals(expr.elements.length, 0);
});

Deno.test("ArrayExpression - number array", () => {
  const expr: ArrayExpression = {
    type: "ARRAY",
    elements: [
      { type: "LITERAL", dataType: DataType.NUMBER, value: 1 },
      { type: "LITERAL", dataType: DataType.NUMBER, value: 2 },
      { type: "LITERAL", dataType: DataType.NUMBER, value: 3 },
    ],
  };

  assertEquals(expr.elements.length, 3);
  assertEquals((expr.elements[0] as Literal).value, 1);
  assertEquals((expr.elements[2] as Literal).value, 3);
});

Deno.test("ArrayExpression - string array", () => {
  const expr: ArrayExpression = {
    type: "ARRAY",
    elements: [
      { type: "LITERAL", dataType: DataType.STRING, value: "apple" },
      { type: "LITERAL", dataType: DataType.STRING, value: "banana" },
    ],
  };

  assertEquals(expr.elements.length, 2);
});

Deno.test("ArrayExpression - mixed types", () => {
  const expr: ArrayExpression = {
    type: "ARRAY",
    elements: [
      { type: "LITERAL", dataType: DataType.STRING, value: "text" },
      { type: "LITERAL", dataType: DataType.NUMBER, value: 42 },
      { type: "LITERAL", dataType: DataType.BOOLEAN, value: true },
    ],
  };

  assertEquals(expr.elements.length, 3);
});

Deno.test("ArrayExpression - nested arrays", () => {
  const innerArray: ArrayExpression = {
    type: "ARRAY",
    elements: [
      { type: "LITERAL", dataType: DataType.NUMBER, value: 1 },
      { type: "LITERAL", dataType: DataType.NUMBER, value: 2 },
    ],
  };

  const expr: ArrayExpression = {
    type: "ARRAY",
    elements: [innerArray],
  };

  assertEquals(expr.elements.length, 1);
  assertEquals((expr.elements[0] as ArrayExpression).elements.length, 2);
});

// ============================================================================
// Object Expression Tests
// ============================================================================

Deno.test("ObjectExpression - empty object", () => {
  const expr: ObjectExpression = {
    type: "OBJECT",
    properties: [],
  };

  assertEquals(expr.type, "OBJECT");
  assertEquals(expr.properties.length, 0);
});

Deno.test("ObjectExpression - single property", () => {
  const expr: ObjectExpression = {
    type: "OBJECT",
    properties: [
      {
        key: "name",
        value: { type: "LITERAL", dataType: DataType.STRING, value: "John" },
      },
    ],
  };

  assertEquals(expr.properties.length, 1);
  assertEquals(expr.properties[0].key, "name");
  assertEquals((expr.properties[0].value as Literal).value, "John");
});

Deno.test("ObjectExpression - multiple properties", () => {
  const expr: ObjectExpression = {
    type: "OBJECT",
    properties: [
      {
        key: "name",
        value: { type: "LITERAL", dataType: DataType.STRING, value: "John" },
      },
      {
        key: "age",
        value: { type: "LITERAL", dataType: DataType.NUMBER, value: 30 },
      },
      {
        key: "active",
        value: { type: "LITERAL", dataType: DataType.BOOLEAN, value: true },
      },
    ],
  };

  assertEquals(expr.properties.length, 3);
});

Deno.test("ObjectExpression - nested object", () => {
  const innerObject: ObjectExpression = {
    type: "OBJECT",
    properties: [
      {
        key: "street",
        value: { type: "LITERAL", dataType: DataType.STRING, value: "123 Main St" },
      },
    ],
  };

  const expr: ObjectExpression = {
    type: "OBJECT",
    properties: [
      { key: "address", value: innerObject },
    ],
  };

  assertEquals(expr.properties.length, 1);
  assertEquals(expr.properties[0].key, "address");
  assertEquals((expr.properties[0].value as ObjectExpression).properties.length, 1);
});

Deno.test("ObjectExpression - property with expression value", () => {
  const expr: ObjectExpression = {
    type: "OBJECT",
    properties: [
      {
        key: "sum",
        value: {
          type: "BINARY",
          operator: "+",
          left: { type: "IDENTIFIER", name: "a" },
          right: { type: "IDENTIFIER", name: "b" },
        },
      },
    ],
  };

  assertEquals(expr.properties[0].key, "sum");
  assertEquals((expr.properties[0].value as BinaryExpression).operator, "+");
});

// ============================================================================
// Type Guard Pattern Tests
// ============================================================================

Deno.test("Expression type discrimination - LITERAL", () => {
  const expr: Expression = {
    type: "LITERAL",
    dataType: DataType.STRING,
    value: "test",
  };

  if (expr.type === "LITERAL") {
    assertEquals(expr.value, "test");
  }
});

Deno.test("Expression type discrimination - BINARY", () => {
  const expr: Expression = {
    type: "BINARY",
    operator: "+",
    left: { type: "LITERAL", dataType: DataType.NUMBER, value: 1 },
    right: { type: "LITERAL", dataType: DataType.NUMBER, value: 2 },
  };

  if (expr.type === "BINARY") {
    assertEquals(expr.operator, "+");
  }
});

Deno.test("Expression type discrimination - CALL", () => {
  const expr: Expression = {
    type: "CALL",
    callee: "UPPER",
    arguments: [],
  };

  if (expr.type === "CALL") {
    assertEquals(expr.callee, "UPPER");
  }
});

// ============================================================================
// Operator Type Tests
// ============================================================================

Deno.test("BinaryOperator - all operators are valid", () => {
  const operators: BinaryOperator[] = [
    "=", "!=", ">", ">=", "<", "<=",
    "+", "-", "*", "/", "%",
    "AND", "OR", "IN", "NOT IN",
    "LIKE", "NOT LIKE", "MATCHES", "CONTAINS",
    "||",
  ];

  assertEquals(operators.length, 20);
});

Deno.test("UnaryOperator - all operators are valid", () => {
  const operators: UnaryOperator[] = ["NOT", "-", "+"];

  assertEquals(operators.length, 3);
});
