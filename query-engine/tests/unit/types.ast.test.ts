/**
 * AST Types Tests
 * Comprehensive tests for Abstract Syntax Tree type definitions
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { DataType } from "../../types/primitives.ts";
import type {
  ASTNode,
  SourceLocation,
  Position,
  Statement,
  SelectStatement,
  Field,
  Source,
  OrderBy,
  LimitClause,
  NavigateStatement,
  NavigateOptions,
  ProxyConfig,
  InterceptConfig,
  BrowserConfig,
  CaptureClause,
  SetStatement,
  ShowStatement,
  ShowTarget,
  ForStatement,
  IfStatement,
  InsertStatement,
  UpdateStatement,
  Assignment,
  DeleteStatement,
  WithStatement,
  CTE,
  Expression,
  BinaryExpression,
  BinaryOperator,
  UnaryExpression,
  UnaryOperator,
  CallExpression,
  MemberExpression,
  Literal,
  Identifier,
  ArrayExpression,
  ObjectExpression,
  Property,
  TypeAnnotation,
} from "../../types/ast.ts";

// ============================================================================
// Position and SourceLocation Tests
// ============================================================================

Deno.test("Position - has line, column, offset", () => {
  const pos: Position = {
    line: 1,
    column: 5,
    offset: 4,
  };

  assertEquals(pos.line, 1);
  assertEquals(pos.column, 5);
  assertEquals(pos.offset, 4);
});

Deno.test("Position - zero-based offset", () => {
  const pos: Position = {
    line: 1,
    column: 1,
    offset: 0,
  };

  assertEquals(pos.offset, 0);
});

Deno.test("SourceLocation - has start and end positions", () => {
  const loc: SourceLocation = {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 10, offset: 9 },
  };

  assertEquals(loc.start.line, 1);
  assertEquals(loc.end.column, 10);
});

Deno.test("SourceLocation - multi-line span", () => {
  const loc: SourceLocation = {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 5, column: 15, offset: 100 },
  };

  assertEquals(loc.start.line, 1);
  assertEquals(loc.end.line, 5);
});

// ============================================================================
// Source Tests
// ============================================================================

Deno.test("Source - URL type", () => {
  const source: Source = {
    type: "URL",
    value: "https://example.com",
  };

  assertEquals(source.type, "URL");
  assertEquals(source.value, "https://example.com");
});

Deno.test("Source - VARIABLE type", () => {
  const source: Source = {
    type: "VARIABLE",
    value: "myData",
  };

  assertEquals(source.type, "VARIABLE");
  assertEquals(source.value, "myData");
});

Deno.test("Source - SUBQUERY type", () => {
  const subquery: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title" }],
    source: { type: "URL", value: "https://example.com" },
  };

  const source: Source = {
    type: "SUBQUERY",
    value: subquery,
  };

  assertEquals(source.type, "SUBQUERY");
  assertEquals((source.value as SelectStatement).type, "SELECT");
});

// ============================================================================
// Field Tests
// ============================================================================

Deno.test("Field - simple field name", () => {
  const field: Field = {
    name: "title",
  };

  assertEquals(field.name, "title");
  assertEquals(field.alias, undefined);
});

Deno.test("Field - with alias", () => {
  const field: Field = {
    name: "product_name",
    alias: "name",
  };

  assertEquals(field.name, "product_name");
  assertEquals(field.alias, "name");
});

Deno.test("Field - with nested path", () => {
  const field: Field = {
    name: "user",
    path: ["profile", "settings", "theme"],
  };

  assertEquals(field.name, "user");
  assertEquals(field.path!.length, 3);
  assertEquals(field.path![0], "profile");
});

Deno.test("Field - with expression", () => {
  const field: Field = {
    name: "count",
    expression: {
      type: "CALL",
      callee: "COUNT",
      arguments: [{ type: "IDENTIFIER", name: "items" }],
    },
  };

  assertExists(field.expression);
  assertEquals((field.expression as CallExpression).callee, "COUNT");
});

// ============================================================================
// OrderBy Tests
// ============================================================================

Deno.test("OrderBy - ascending order", () => {
  const orderBy: OrderBy = {
    field: "name",
    direction: "ASC",
  };

  assertEquals(orderBy.field, "name");
  assertEquals(orderBy.direction, "ASC");
});

Deno.test("OrderBy - descending order", () => {
  const orderBy: OrderBy = {
    field: "created_at",
    direction: "DESC",
  };

  assertEquals(orderBy.direction, "DESC");
});

// ============================================================================
// LimitClause Tests
// ============================================================================

Deno.test("LimitClause - limit only", () => {
  const limit: LimitClause = {
    count: 10,
  };

  assertEquals(limit.count, 10);
  assertEquals(limit.offset, undefined);
});

Deno.test("LimitClause - with offset", () => {
  const limit: LimitClause = {
    count: 10,
    offset: 20,
  };

  assertEquals(limit.count, 10);
  assertEquals(limit.offset, 20);
});

// ============================================================================
// SelectStatement Tests
// ============================================================================

Deno.test("SelectStatement - minimal select", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title" }],
    source: { type: "URL", value: "https://example.com" },
  };

  assertEquals(stmt.type, "SELECT");
  assertEquals(stmt.fields.length, 1);
  assertEquals(stmt.fields[0].name, "title");
});

Deno.test("SelectStatement - multiple fields", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [
      { name: "title" },
      { name: "description" },
      { name: "price", alias: "cost" },
    ],
    source: { type: "URL", value: "https://example.com" },
  };

  assertEquals(stmt.fields.length, 3);
});

Deno.test("SelectStatement - with WHERE clause", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title" }],
    source: { type: "URL", value: "https://example.com" },
    where: {
      type: "BINARY",
      operator: ">",
      left: { type: "IDENTIFIER", name: "price" },
      right: { type: "LITERAL", dataType: DataType.NUMBER, value: 100 },
    },
  };

  assertExists(stmt.where);
  assertEquals((stmt.where as BinaryExpression).operator, ">");
});

Deno.test("SelectStatement - with ORDER BY", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title" }, { name: "price" }],
    source: { type: "URL", value: "https://example.com" },
    orderBy: [
      { field: "price", direction: "DESC" },
      { field: "title", direction: "ASC" },
    ],
  };

  assertExists(stmt.orderBy);
  assertEquals(stmt.orderBy!.length, 2);
  assertEquals(stmt.orderBy![0].field, "price");
});

Deno.test("SelectStatement - with LIMIT and OFFSET", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title" }],
    source: { type: "URL", value: "https://example.com" },
    limit: { count: 10, offset: 5 },
  };

  assertExists(stmt.limit);
  assertEquals(stmt.limit!.count, 10);
  assertEquals(stmt.limit!.offset, 5);
});

Deno.test("SelectStatement - complete with all clauses", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [
      { name: "title" },
      { name: "price", alias: "cost" },
    ],
    source: { type: "URL", value: "https://example.com" },
    where: {
      type: "BINARY",
      operator: "AND",
      left: {
        type: "BINARY",
        operator: ">",
        left: { type: "IDENTIFIER", name: "price" },
        right: { type: "LITERAL", dataType: DataType.NUMBER, value: 10 },
      },
      right: {
        type: "BINARY",
        operator: "<",
        left: { type: "IDENTIFIER", name: "price" },
        right: { type: "LITERAL", dataType: DataType.NUMBER, value: 100 },
      },
    },
    orderBy: [{ field: "price", direction: "ASC" }],
    limit: { count: 20 },
  };

  assertEquals(stmt.type, "SELECT");
  assertExists(stmt.where);
  assertExists(stmt.orderBy);
  assertExists(stmt.limit);
});

// ============================================================================
// NavigateStatement Tests
// ============================================================================

Deno.test("NavigateStatement - simple navigate", () => {
  const stmt: NavigateStatement = {
    type: "NAVIGATE",
    url: { type: "LITERAL", dataType: DataType.URL, value: "https://example.com" },
  };

  assertEquals(stmt.type, "NAVIGATE");
  assertEquals((stmt.url as Literal).value, "https://example.com");
});

Deno.test("NavigateStatement - with variable URL", () => {
  const stmt: NavigateStatement = {
    type: "NAVIGATE",
    url: { type: "IDENTIFIER", name: "targetUrl" },
  };

  assertEquals((stmt.url as Identifier).name, "targetUrl");
});

Deno.test("NavigateStatement - with options", () => {
  const stmt: NavigateStatement = {
    type: "NAVIGATE",
    url: { type: "LITERAL", dataType: DataType.URL, value: "https://example.com" },
    options: {
      waitUntil: "networkidle",
      timeout: 30000,
    },
  };

  assertExists(stmt.options);
  assertEquals(stmt.options!.waitUntil, "networkidle");
  assertEquals(stmt.options!.timeout, 30000);
});

Deno.test("NavigateStatement - with capture clause", () => {
  const stmt: NavigateStatement = {
    type: "NAVIGATE",
    url: { type: "LITERAL", dataType: DataType.URL, value: "https://example.com" },
    capture: {
      fields: [
        { name: "title" },
        { name: "body" },
      ],
    },
  };

  assertExists(stmt.capture);
  assertEquals(stmt.capture!.fields.length, 2);
});

// ============================================================================
// NavigateOptions Tests
// ============================================================================

Deno.test("NavigateOptions - waitUntil options", () => {
  const options1: NavigateOptions = { waitUntil: "load" };
  const options2: NavigateOptions = { waitUntil: "domcontentloaded" };
  const options3: NavigateOptions = { waitUntil: "networkidle" };

  assertEquals(options1.waitUntil, "load");
  assertEquals(options2.waitUntil, "domcontentloaded");
  assertEquals(options3.waitUntil, "networkidle");
});

Deno.test("NavigateOptions - with proxy config", () => {
  const options: NavigateOptions = {
    proxy: {
      cache: true,
      headers: { "Authorization": "Bearer token" },
      timeout: 5000,
    },
  };

  assertExists(options.proxy);
  assertEquals(options.proxy!.cache, true);
  assertEquals(options.proxy!.headers!["Authorization"], "Bearer token");
});

Deno.test("NavigateOptions - with browser config", () => {
  const options: NavigateOptions = {
    browser: {
      viewport: { width: 1920, height: 1080 },
      userAgent: "Mozilla/5.0",
      headless: true,
    },
  };

  assertExists(options.browser);
  assertEquals(options.browser!.viewport!.width, 1920);
  assertEquals(options.browser!.headless, true);
});

// ============================================================================
// ProxyConfig Tests
// ============================================================================

Deno.test("ProxyConfig - cache modes", () => {
  const config1: ProxyConfig = { cache: true };
  const config2: ProxyConfig = { cache: false };
  const config3: ProxyConfig = { cache: "only" };

  assertEquals(config1.cache, true);
  assertEquals(config2.cache, false);
  assertEquals(config3.cache, "only");
});

Deno.test("ProxyConfig - load balancing strategies", () => {
  const strategies: ProxyConfig["strategy"][] = ["round-robin", "random", "least-connections"];

  for (const strategy of strategies) {
    const config: ProxyConfig = { strategy };
    assertEquals(config.strategy, strategy);
  }
});

Deno.test("ProxyConfig - with intercept", () => {
  const config: ProxyConfig = {
    intercept: {
      urls: ["**/api/*"],
      methods: ["GET", "POST"],
      resourceTypes: ["xhr", "fetch"],
    },
  };

  assertExists(config.intercept);
  assertEquals(config.intercept!.urls![0], "**/api/*");
});

// ============================================================================
// SetStatement Tests
// ============================================================================

Deno.test("SetStatement - simple assignment", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["name"],
    value: { type: "LITERAL", dataType: DataType.STRING, value: "John" },
  };

  assertEquals(stmt.type, "SET");
  assertEquals(stmt.path[0], "name");
});

Deno.test("SetStatement - nested path", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["user", "profile", "settings", "theme"],
    value: { type: "LITERAL", dataType: DataType.STRING, value: "dark" },
  };

  assertEquals(stmt.path.length, 4);
  assertEquals(stmt.path[3], "theme");
});

// ============================================================================
// ShowStatement Tests
// ============================================================================

Deno.test("ShowStatement - all targets", () => {
  const targets: ShowTarget[] = ["CACHE", "COOKIES", "HEADERS", "CONNECTIONS", "METRICS", "STATE"];

  for (const target of targets) {
    const stmt: ShowStatement = {
      type: "SHOW",
      target,
    };
    assertEquals(stmt.target, target);
  }
});

Deno.test("ShowStatement - with WHERE clause", () => {
  const stmt: ShowStatement = {
    type: "SHOW",
    target: "COOKIES",
    where: {
      type: "BINARY",
      operator: "=",
      left: { type: "IDENTIFIER", name: "domain" },
      right: { type: "LITERAL", dataType: DataType.STRING, value: "example.com" },
    },
  };

  assertExists(stmt.where);
});

// ============================================================================
// ForStatement Tests
// ============================================================================

Deno.test("ForStatement - basic loop", () => {
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

  assertEquals(stmt.type, "FOR");
  assertEquals(stmt.variable, "item");
});

Deno.test("ForStatement - with array literal", () => {
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

  assertEquals((stmt.collection as ArrayExpression).elements.length, 2);
});

// ============================================================================
// IfStatement Tests
// ============================================================================

Deno.test("IfStatement - simple condition", () => {
  const stmt: IfStatement = {
    type: "IF",
    condition: {
      type: "CALL",
      callee: "EXISTS",
      arguments: [{ type: "LITERAL", dataType: DataType.SELECTOR, value: "#login" }],
    },
    then: {
      type: "SET",
      path: ["loggedIn"],
      value: { type: "LITERAL", dataType: DataType.BOOLEAN, value: true },
    },
  };

  assertEquals(stmt.type, "IF");
  assertExists(stmt.condition);
  assertExists(stmt.then);
  assertEquals(stmt.else, undefined);
});

Deno.test("IfStatement - with else branch", () => {
  const stmt: IfStatement = {
    type: "IF",
    condition: {
      type: "BINARY",
      operator: ">",
      left: { type: "IDENTIFIER", name: "count" },
      right: { type: "LITERAL", dataType: DataType.NUMBER, value: 0 },
    },
    then: {
      type: "SET",
      path: ["hasItems"],
      value: { type: "LITERAL", dataType: DataType.BOOLEAN, value: true },
    },
    else: {
      type: "SET",
      path: ["hasItems"],
      value: { type: "LITERAL", dataType: DataType.BOOLEAN, value: false },
    },
  };

  assertExists(stmt.else);
});

// ============================================================================
// InsertStatement Tests
// ============================================================================

Deno.test("InsertStatement - insert text", () => {
  const stmt: InsertStatement = {
    type: "INSERT",
    value: { type: "LITERAL", dataType: DataType.STRING, value: "user@example.com" },
    target: { type: "LITERAL", dataType: DataType.SELECTOR, value: "#email" },
  };

  assertEquals(stmt.type, "INSERT");
  assertEquals((stmt.value as Literal).value, "user@example.com");
});

// ============================================================================
// UpdateStatement Tests
// ============================================================================

Deno.test("UpdateStatement - single assignment", () => {
  const stmt: UpdateStatement = {
    type: "UPDATE",
    target: { type: "LITERAL", dataType: DataType.SELECTOR, value: "#form" },
    assignments: [
      { property: "value", value: { type: "LITERAL", dataType: DataType.STRING, value: "new value" } },
    ],
  };

  assertEquals(stmt.type, "UPDATE");
  assertEquals(stmt.assignments.length, 1);
  assertEquals(stmt.assignments[0].property, "value");
});

Deno.test("UpdateStatement - multiple assignments", () => {
  const stmt: UpdateStatement = {
    type: "UPDATE",
    target: { type: "LITERAL", dataType: DataType.SELECTOR, value: ".element" },
    assignments: [
      { property: "innerText", value: { type: "LITERAL", dataType: DataType.STRING, value: "Updated" } },
      { property: "className", value: { type: "LITERAL", dataType: DataType.STRING, value: "active" } },
    ],
  };

  assertEquals(stmt.assignments.length, 2);
});

// ============================================================================
// DeleteStatement Tests
// ============================================================================

Deno.test("DeleteStatement - basic delete", () => {
  const stmt: DeleteStatement = {
    type: "DELETE",
    target: { type: "LITERAL", dataType: DataType.SELECTOR, value: ".ad-banner" },
  };

  assertEquals(stmt.type, "DELETE");
  assertEquals((stmt.target as Literal).value, ".ad-banner");
});

// ============================================================================
// WithStatement Tests
// ============================================================================

Deno.test("WithStatement - single CTE", () => {
  const stmt: WithStatement = {
    type: "WITH",
    ctes: [
      {
        name: "products",
        query: {
          type: "SELECT",
          fields: [{ name: "title" }, { name: "price" }],
          source: { type: "URL", value: "https://shop.example.com" },
        },
      },
    ],
    query: {
      type: "SELECT",
      fields: [{ name: "title" }],
      source: { type: "VARIABLE", value: "products" },
      where: {
        type: "BINARY",
        operator: "<",
        left: { type: "IDENTIFIER", name: "price" },
        right: { type: "LITERAL", dataType: DataType.NUMBER, value: 50 },
      },
    },
  };

  assertEquals(stmt.type, "WITH");
  assertEquals(stmt.ctes.length, 1);
  assertEquals(stmt.ctes[0].name, "products");
});

Deno.test("WithStatement - multiple CTEs", () => {
  const stmt: WithStatement = {
    type: "WITH",
    ctes: [
      {
        name: "page1",
        query: {
          type: "SELECT",
          fields: [{ name: "title" }],
          source: { type: "URL", value: "https://example.com/1" },
        },
      },
      {
        name: "page2",
        query: {
          type: "SELECT",
          fields: [{ name: "title" }],
          source: { type: "URL", value: "https://example.com/2" },
        },
      },
    ],
    query: {
      type: "SET",
      path: ["results"],
      value: {
        type: "ARRAY",
        elements: [
          { type: "IDENTIFIER", name: "page1" },
          { type: "IDENTIFIER", name: "page2" },
        ],
      },
    },
  };

  assertEquals(stmt.ctes.length, 2);
});

// ============================================================================
// BinaryExpression Tests
// ============================================================================

Deno.test("BinaryExpression - comparison operators", () => {
  const operators: BinaryOperator[] = ["=", "!=", ">", ">=", "<", "<="];

  for (const operator of operators) {
    const expr: BinaryExpression = {
      type: "BINARY",
      operator,
      left: { type: "IDENTIFIER", name: "a" },
      right: { type: "IDENTIFIER", name: "b" },
    };
    assertEquals(expr.operator, operator);
  }
});

Deno.test("BinaryExpression - arithmetic operators", () => {
  const operators: BinaryOperator[] = ["+", "-", "*", "/", "%"];

  for (const operator of operators) {
    const expr: BinaryExpression = {
      type: "BINARY",
      operator,
      left: { type: "LITERAL", dataType: DataType.NUMBER, value: 10 },
      right: { type: "LITERAL", dataType: DataType.NUMBER, value: 5 },
    };
    assertEquals(expr.operator, operator);
  }
});

Deno.test("BinaryExpression - logical operators", () => {
  const expr: BinaryExpression = {
    type: "BINARY",
    operator: "AND",
    left: {
      type: "BINARY",
      operator: ">",
      left: { type: "IDENTIFIER", name: "x" },
      right: { type: "LITERAL", dataType: DataType.NUMBER, value: 0 },
    },
    right: {
      type: "BINARY",
      operator: "<",
      left: { type: "IDENTIFIER", name: "x" },
      right: { type: "LITERAL", dataType: DataType.NUMBER, value: 100 },
    },
  };

  assertEquals(expr.operator, "AND");
  assertEquals((expr.left as BinaryExpression).operator, ">");
});

Deno.test("BinaryExpression - string operators", () => {
  const operators: BinaryOperator[] = ["LIKE", "NOT LIKE", "MATCHES", "CONTAINS", "||"];

  for (const operator of operators) {
    const expr: BinaryExpression = {
      type: "BINARY",
      operator,
      left: { type: "IDENTIFIER", name: "text" },
      right: { type: "LITERAL", dataType: DataType.STRING, value: "pattern" },
    };
    assertEquals(expr.operator, operator);
  }
});

Deno.test("BinaryExpression - IN operators", () => {
  const inExpr: BinaryExpression = {
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

  const notInExpr: BinaryExpression = {
    type: "BINARY",
    operator: "NOT IN",
    left: { type: "IDENTIFIER", name: "status" },
    right: {
      type: "ARRAY",
      elements: [
        { type: "LITERAL", dataType: DataType.STRING, value: "deleted" },
      ],
    },
  };

  assertEquals(inExpr.operator, "IN");
  assertEquals(notInExpr.operator, "NOT IN");
});

// ============================================================================
// UnaryExpression Tests
// ============================================================================

Deno.test("UnaryExpression - NOT operator", () => {
  const expr: UnaryExpression = {
    type: "UNARY",
    operator: "NOT",
    operand: { type: "IDENTIFIER", name: "isActive" },
  };

  assertEquals(expr.type, "UNARY");
  assertEquals(expr.operator, "NOT");
});

Deno.test("UnaryExpression - negation", () => {
  const expr: UnaryExpression = {
    type: "UNARY",
    operator: "-",
    operand: { type: "LITERAL", dataType: DataType.NUMBER, value: 5 },
  };

  assertEquals(expr.operator, "-");
});

Deno.test("UnaryExpression - positive", () => {
  const expr: UnaryExpression = {
    type: "UNARY",
    operator: "+",
    operand: { type: "IDENTIFIER", name: "value" },
  };

  assertEquals(expr.operator, "+");
});

// ============================================================================
// CallExpression Tests
// ============================================================================

Deno.test("CallExpression - no arguments", () => {
  const expr: CallExpression = {
    type: "CALL",
    callee: "NOW",
    arguments: [],
  };

  assertEquals(expr.callee, "NOW");
  assertEquals(expr.arguments.length, 0);
});

Deno.test("CallExpression - single argument", () => {
  const expr: CallExpression = {
    type: "CALL",
    callee: "TEXT",
    arguments: [
      { type: "LITERAL", dataType: DataType.SELECTOR, value: "#title" },
    ],
  };

  assertEquals(expr.callee, "TEXT");
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

  assertEquals(expr.arguments.length, 3);
});

Deno.test("CallExpression - nested calls", () => {
  const expr: CallExpression = {
    type: "CALL",
    callee: "UPPER",
    arguments: [
      {
        type: "CALL",
        callee: "TRIM",
        arguments: [
          { type: "IDENTIFIER", name: "name" },
        ],
      },
    ],
  };

  assertEquals(expr.callee, "UPPER");
  assertEquals((expr.arguments[0] as CallExpression).callee, "TRIM");
});

// ============================================================================
// MemberExpression Tests
// ============================================================================

Deno.test("MemberExpression - dot notation", () => {
  const expr: MemberExpression = {
    type: "MEMBER",
    object: { type: "IDENTIFIER", name: "user" },
    property: "name",
    computed: false,
  };

  assertEquals(expr.type, "MEMBER");
  assertEquals(expr.property, "name");
  assertEquals(expr.computed, false);
});

Deno.test("MemberExpression - bracket notation", () => {
  const expr: MemberExpression = {
    type: "MEMBER",
    object: { type: "IDENTIFIER", name: "data" },
    property: "special-key",
    computed: true,
  };

  assertEquals(expr.computed, true);
});

Deno.test("MemberExpression - chained access", () => {
  const expr: MemberExpression = {
    type: "MEMBER",
    object: {
      type: "MEMBER",
      object: { type: "IDENTIFIER", name: "response" },
      property: "data",
      computed: false,
    },
    property: "items",
    computed: false,
  };

  assertEquals(expr.property, "items");
  assertEquals((expr.object as MemberExpression).property, "data");
});

// ============================================================================
// Literal Tests
// ============================================================================

Deno.test("Literal - string value", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.STRING,
    value: "hello",
  };

  assertEquals(literal.dataType, DataType.STRING);
  assertEquals(literal.value, "hello");
});

Deno.test("Literal - number value", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: 42,
  };

  assertEquals(literal.dataType, DataType.NUMBER);
  assertEquals(literal.value, 42);
});

Deno.test("Literal - boolean value", () => {
  const literalTrue: Literal = {
    type: "LITERAL",
    dataType: DataType.BOOLEAN,
    value: true,
  };

  const literalFalse: Literal = {
    type: "LITERAL",
    dataType: DataType.BOOLEAN,
    value: false,
  };

  assertEquals(literalTrue.value, true);
  assertEquals(literalFalse.value, false);
});

Deno.test("Literal - null value", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NULL,
    value: null,
  };

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
});

Deno.test("Literal - selector value", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.SELECTOR,
    value: "#main > .content",
  };

  assertEquals(literal.dataType, DataType.SELECTOR);
});

// ============================================================================
// Identifier Tests
// ============================================================================

Deno.test("Identifier - simple name", () => {
  const id: Identifier = {
    type: "IDENTIFIER",
    name: "myVar",
  };

  assertEquals(id.type, "IDENTIFIER");
  assertEquals(id.name, "myVar");
});

Deno.test("Identifier - various naming conventions", () => {
  const names = ["camelCase", "snake_case", "UPPER_CASE", "_private", "x123"];

  for (const name of names) {
    const id: Identifier = {
      type: "IDENTIFIER",
      name,
    };
    assertEquals(id.name, name);
  }
});

// ============================================================================
// ArrayExpression Tests
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
});

Deno.test("ArrayExpression - mixed types", () => {
  const expr: ArrayExpression = {
    type: "ARRAY",
    elements: [
      { type: "LITERAL", dataType: DataType.STRING, value: "hello" },
      { type: "LITERAL", dataType: DataType.NUMBER, value: 42 },
      { type: "IDENTIFIER", name: "variable" },
    ],
  };

  assertEquals(expr.elements.length, 3);
  assertEquals((expr.elements[0] as Literal).dataType, DataType.STRING);
  assertEquals((expr.elements[2] as Identifier).name, "variable");
});

// ============================================================================
// ObjectExpression Tests
// ============================================================================

Deno.test("ObjectExpression - empty object", () => {
  const expr: ObjectExpression = {
    type: "OBJECT",
    properties: [],
  };

  assertEquals(expr.type, "OBJECT");
  assertEquals(expr.properties.length, 0);
});

Deno.test("ObjectExpression - with properties", () => {
  const expr: ObjectExpression = {
    type: "OBJECT",
    properties: [
      { key: "name", value: { type: "LITERAL", dataType: DataType.STRING, value: "John" } },
      { key: "age", value: { type: "LITERAL", dataType: DataType.NUMBER, value: 30 } },
    ],
  };

  assertEquals(expr.properties.length, 2);
  assertEquals(expr.properties[0].key, "name");
  assertEquals((expr.properties[0].value as Literal).value, "John");
});

Deno.test("ObjectExpression - nested object", () => {
  const expr: ObjectExpression = {
    type: "OBJECT",
    properties: [
      {
        key: "user",
        value: {
          type: "OBJECT",
          properties: [
            { key: "name", value: { type: "LITERAL", dataType: DataType.STRING, value: "John" } },
          ],
        },
      },
    ],
  };

  const nestedObj = expr.properties[0].value as ObjectExpression;
  assertEquals(nestedObj.type, "OBJECT");
  assertEquals(nestedObj.properties[0].key, "name");
});

// ============================================================================
// TypeAnnotation Tests
// ============================================================================

Deno.test("TypeAnnotation - simple type", () => {
  const annotation: TypeAnnotation = {
    dataType: DataType.STRING,
    nullable: false,
  };

  assertEquals(annotation.dataType, DataType.STRING);
  assertEquals(annotation.nullable, false);
});

Deno.test("TypeAnnotation - nullable type", () => {
  const annotation: TypeAnnotation = {
    dataType: DataType.NUMBER,
    nullable: true,
  };

  assertEquals(annotation.nullable, true);
});

Deno.test("TypeAnnotation - array type", () => {
  const annotation: TypeAnnotation = {
    dataType: DataType.ARRAY,
    nullable: false,
    arrayOf: DataType.STRING,
  };

  assertEquals(annotation.dataType, DataType.ARRAY);
  assertEquals(annotation.arrayOf, DataType.STRING);
});

// ============================================================================
// Statement Type Discrimination Tests
// ============================================================================

Deno.test("Statement - type discrimination works", () => {
  const statements: Statement[] = [
    {
      type: "SELECT",
      fields: [{ name: "title" }],
      source: { type: "URL", value: "https://example.com" },
    },
    {
      type: "NAVIGATE",
      url: { type: "LITERAL", dataType: DataType.URL, value: "https://example.com" },
    },
    {
      type: "SET",
      path: ["x"],
      value: { type: "LITERAL", dataType: DataType.NUMBER, value: 1 },
    },
  ];

  for (const stmt of statements) {
    switch (stmt.type) {
      case "SELECT":
        assertExists((stmt as SelectStatement).fields);
        break;
      case "NAVIGATE":
        assertExists((stmt as NavigateStatement).url);
        break;
      case "SET":
        assertExists((stmt as SetStatement).path);
        break;
    }
  }
});

// ============================================================================
// Expression Type Discrimination Tests
// ============================================================================

Deno.test("Expression - type discrimination works", () => {
  const expressions: Expression[] = [
    { type: "LITERAL", dataType: DataType.STRING, value: "hello" },
    { type: "IDENTIFIER", name: "x" },
    { type: "BINARY", operator: "+", left: { type: "IDENTIFIER", name: "a" }, right: { type: "IDENTIFIER", name: "b" } },
    { type: "UNARY", operator: "-", operand: { type: "IDENTIFIER", name: "x" } },
    { type: "CALL", callee: "FN", arguments: [] },
    { type: "MEMBER", object: { type: "IDENTIFIER", name: "obj" }, property: "prop", computed: false },
    { type: "ARRAY", elements: [] },
    { type: "OBJECT", properties: [] },
  ];

  assertEquals(expressions.length, 8);

  for (const expr of expressions) {
    assert(["LITERAL", "IDENTIFIER", "BINARY", "UNARY", "CALL", "MEMBER", "ARRAY", "OBJECT"].includes(expr.type));
  }
});

// ============================================================================
// ASTNode with Location Tests
// ============================================================================

Deno.test("ASTNode - with source location", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title" }],
    source: { type: "URL", value: "https://example.com" },
    location: {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 50, offset: 49 },
    },
  };

  assertExists(stmt.location);
  assertEquals(stmt.location!.start.line, 1);
  assertEquals(stmt.location!.end.offset, 49);
});
