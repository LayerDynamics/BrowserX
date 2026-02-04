/**
 * Statements Tests
 * Comprehensive tests for AST statement types
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { DataType } from "../../types/primitives.ts";
import type {
  Statement,
  SelectStatement,
  NavigateStatement,
  SetStatement,
  ShowStatement,
  ForStatement,
  IfStatement,
  InsertStatement,
  UpdateStatement,
  DeleteStatement,
  WithStatement,
  Field,
  Source,
  OrderBy,
  LimitClause,
  NavigateOptions,
  CaptureClause,
  ShowTarget,
  CTE,
} from "../../types/ast.ts";

// ============================================================================
// SelectStatement Tests
// ============================================================================

Deno.test("SelectStatement - basic SELECT with single field", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title" }],
    source: { type: "URL", value: "https://example.com" },
  };

  assertEquals(stmt.type, "SELECT");
  assertEquals(stmt.fields.length, 1);
  assertEquals(stmt.fields[0].name, "title");
  assertEquals(stmt.source.type, "URL");
  assertEquals(stmt.source.value, "https://example.com");
});

Deno.test("SelectStatement - multiple fields", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [
      { name: "title" },
      { name: "description" },
      { name: "author" },
    ],
    source: { type: "URL", value: "https://example.com" },
  };

  assertEquals(stmt.fields.length, 3);
  assertEquals(stmt.fields[0].name, "title");
  assertEquals(stmt.fields[1].name, "description");
  assertEquals(stmt.fields[2].name, "author");
});

Deno.test("SelectStatement - field with alias", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title", alias: "pageTitle" }],
    source: { type: "URL", value: "https://example.com" },
  };

  assertEquals(stmt.fields[0].alias, "pageTitle");
});

Deno.test("SelectStatement - field with path", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "address", path: ["user", "profile", "address"] }],
    source: { type: "URL", value: "https://example.com" },
  };

  assertEquals(stmt.fields[0].path?.length, 3);
  assertEquals(stmt.fields[0].path?.[0], "user");
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
  assertEquals(stmt.where?.type, "BINARY");
});

Deno.test("SelectStatement - with ORDER BY clause", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title" }],
    source: { type: "URL", value: "https://example.com" },
    orderBy: [
      { field: "price", direction: "DESC" },
      { field: "name", direction: "ASC" },
    ],
  };

  assertEquals(stmt.orderBy?.length, 2);
  assertEquals(stmt.orderBy?.[0].field, "price");
  assertEquals(stmt.orderBy?.[0].direction, "DESC");
  assertEquals(stmt.orderBy?.[1].direction, "ASC");
});

Deno.test("SelectStatement - with LIMIT clause", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title" }],
    source: { type: "URL", value: "https://example.com" },
    limit: { count: 10 },
  };

  assertEquals(stmt.limit?.count, 10);
});

Deno.test("SelectStatement - with LIMIT and OFFSET", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "title" }],
    source: { type: "URL", value: "https://example.com" },
    limit: { count: 10, offset: 20 },
  };

  assertEquals(stmt.limit?.count, 10);
  assertEquals(stmt.limit?.offset, 20);
});

Deno.test("SelectStatement - with SUBQUERY source", () => {
  const innerQuery: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "id" }],
    source: { type: "URL", value: "https://api.example.com/data" },
  };

  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "name" }],
    source: { type: "SUBQUERY", value: innerQuery },
  };

  assertEquals(stmt.source.type, "SUBQUERY");
});

Deno.test("SelectStatement - with VARIABLE source", () => {
  const stmt: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "item" }],
    source: { type: "VARIABLE", value: "results" },
  };

  assertEquals(stmt.source.type, "VARIABLE");
  assertEquals(stmt.source.value, "results");
});

// ============================================================================
// NavigateStatement Tests
// ============================================================================

Deno.test("NavigateStatement - basic navigation", () => {
  const stmt: NavigateStatement = {
    type: "NAVIGATE",
    url: { type: "LITERAL", dataType: DataType.URL, value: "https://example.com" },
  };

  assertEquals(stmt.type, "NAVIGATE");
  assertEquals((stmt.url as any).value, "https://example.com");
});

Deno.test("NavigateStatement - with proxy options", () => {
  const stmt: NavigateStatement = {
    type: "NAVIGATE",
    url: { type: "LITERAL", dataType: DataType.URL, value: "https://example.com" },
    options: {
      proxy: {
        cache: true,
        headers: { "Authorization": "Bearer token123" },
      },
    },
  };

  assertExists(stmt.options?.proxy);
  assertEquals(stmt.options?.proxy?.cache, true);
  assertEquals(stmt.options?.proxy?.headers?.["Authorization"], "Bearer token123");
});

Deno.test("NavigateStatement - with browser options", () => {
  const stmt: NavigateStatement = {
    type: "NAVIGATE",
    url: { type: "LITERAL", dataType: DataType.URL, value: "https://example.com" },
    options: {
      browser: {
        viewport: { width: 1920, height: 1080 },
        userAgent: "Mozilla/5.0",
        headless: true,
      },
    },
  };

  assertEquals(stmt.options?.browser?.viewport?.width, 1920);
  assertEquals(stmt.options?.browser?.headless, true);
});

Deno.test("NavigateStatement - with waitUntil option", () => {
  const stmt: NavigateStatement = {
    type: "NAVIGATE",
    url: { type: "LITERAL", dataType: DataType.URL, value: "https://example.com" },
    options: {
      waitUntil: "networkidle",
      timeout: 30000,
    },
  };

  assertEquals(stmt.options?.waitUntil, "networkidle");
  assertEquals(stmt.options?.timeout, 30000);
});

Deno.test("NavigateStatement - with CAPTURE clause", () => {
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

  assertEquals(stmt.capture?.fields.length, 2);
  assertEquals(stmt.capture?.fields[0].name, "title");
});

Deno.test("NavigateStatement - with intercept config", () => {
  const stmt: NavigateStatement = {
    type: "NAVIGATE",
    url: { type: "LITERAL", dataType: DataType.URL, value: "https://example.com" },
    options: {
      proxy: {
        intercept: {
          urls: ["*.js", "*.css"],
          methods: ["GET"],
          resourceTypes: ["script", "stylesheet"],
        },
      },
    },
  };

  assertEquals(stmt.options?.proxy?.intercept?.urls?.length, 2);
  assertEquals(stmt.options?.proxy?.intercept?.methods?.[0], "GET");
});

// ============================================================================
// SetStatement Tests
// ============================================================================

Deno.test("SetStatement - simple variable assignment", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["myVar"],
    value: { type: "LITERAL", dataType: DataType.STRING, value: "hello" },
  };

  assertEquals(stmt.type, "SET");
  assertEquals(stmt.path.length, 1);
  assertEquals(stmt.path[0], "myVar");
});

Deno.test("SetStatement - nested path assignment", () => {
  const stmt: SetStatement = {
    type: "SET",
    path: ["config", "proxy", "enabled"],
    value: { type: "LITERAL", dataType: DataType.BOOLEAN, value: true },
  };

  assertEquals(stmt.path.length, 3);
  assertEquals(stmt.path[0], "config");
  assertEquals(stmt.path[2], "enabled");
});

Deno.test("SetStatement - expression value", () => {
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
  assertEquals((stmt.value as any).operator, "+");
});

// ============================================================================
// ShowStatement Tests
// ============================================================================

Deno.test("ShowStatement - SHOW CACHE", () => {
  const stmt: ShowStatement = {
    type: "SHOW",
    target: "CACHE",
  };

  assertEquals(stmt.type, "SHOW");
  assertEquals(stmt.target, "CACHE");
});

Deno.test("ShowStatement - SHOW COOKIES", () => {
  const stmt: ShowStatement = {
    type: "SHOW",
    target: "COOKIES",
  };

  assertEquals(stmt.target, "COOKIES");
});

Deno.test("ShowStatement - SHOW HEADERS", () => {
  const stmt: ShowStatement = {
    type: "SHOW",
    target: "HEADERS",
  };

  assertEquals(stmt.target, "HEADERS");
});

Deno.test("ShowStatement - SHOW CONNECTIONS", () => {
  const stmt: ShowStatement = {
    type: "SHOW",
    target: "CONNECTIONS",
  };

  assertEquals(stmt.target, "CONNECTIONS");
});

Deno.test("ShowStatement - SHOW METRICS", () => {
  const stmt: ShowStatement = {
    type: "SHOW",
    target: "METRICS",
  };

  assertEquals(stmt.target, "METRICS");
});

Deno.test("ShowStatement - SHOW STATE", () => {
  const stmt: ShowStatement = {
    type: "SHOW",
    target: "STATE",
  };

  assertEquals(stmt.target, "STATE");
});

Deno.test("ShowStatement - with WHERE clause", () => {
  const stmt: ShowStatement = {
    type: "SHOW",
    target: "CACHE",
    where: {
      type: "BINARY",
      operator: "LIKE",
      left: { type: "IDENTIFIER", name: "key" },
      right: { type: "LITERAL", dataType: DataType.STRING, value: "user_*" },
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
      type: "SELECT",
      fields: [{ name: "name" }],
      source: { type: "VARIABLE", value: "item" },
    },
  };

  assertEquals(stmt.type, "FOR");
  assertEquals(stmt.variable, "item");
  assertEquals((stmt.collection as any).name, "items");
  assertEquals((stmt.body as SelectStatement).type, "SELECT");
});

Deno.test("ForStatement - loop over array literal", () => {
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
  assertEquals((stmt.collection as any).elements.length, 2);
});

// ============================================================================
// IfStatement Tests
// ============================================================================

Deno.test("IfStatement - basic if without else", () => {
  const stmt: IfStatement = {
    type: "IF",
    condition: {
      type: "CALL",
      callee: "EXISTS",
      arguments: [{ type: "LITERAL", dataType: DataType.SELECTOR, value: "#login" }],
    },
    then: {
      type: "NAVIGATE",
      url: { type: "LITERAL", dataType: DataType.URL, value: "https://login.example.com" },
    },
  };

  assertEquals(stmt.type, "IF");
  assertEquals((stmt.condition as any).callee, "EXISTS");
  assertEquals(stmt.else, undefined);
});

Deno.test("IfStatement - if with else", () => {
  const stmt: IfStatement = {
    type: "IF",
    condition: {
      type: "BINARY",
      operator: ">",
      left: { type: "IDENTIFIER", name: "count" },
      right: { type: "LITERAL", dataType: DataType.NUMBER, value: 0 },
    },
    then: {
      type: "SELECT",
      fields: [{ name: "item" }],
      source: { type: "VARIABLE", value: "items" },
    },
    else: {
      type: "SET",
      path: ["result"],
      value: { type: "LITERAL", dataType: DataType.NULL, value: null },
    },
  };

  assertExists(stmt.else);
  assertEquals((stmt.else as SetStatement).type, "SET");
});

Deno.test("IfStatement - nested if", () => {
  const innerIf: IfStatement = {
    type: "IF",
    condition: { type: "IDENTIFIER", name: "isVerified" },
    then: {
      type: "SET",
      path: ["status"],
      value: { type: "LITERAL", dataType: DataType.STRING, value: "verified" },
    },
  };

  const stmt: IfStatement = {
    type: "IF",
    condition: { type: "IDENTIFIER", name: "isLoggedIn" },
    then: innerIf,
  };

  assertEquals((stmt.then as IfStatement).type, "IF");
});

// ============================================================================
// InsertStatement Tests
// ============================================================================

Deno.test("InsertStatement - insert text into input", () => {
  const stmt: InsertStatement = {
    type: "INSERT",
    value: { type: "LITERAL", dataType: DataType.STRING, value: "user@example.com" },
    target: { type: "LITERAL", dataType: DataType.SELECTOR, value: "#email" },
  };

  assertEquals(stmt.type, "INSERT");
  assertEquals((stmt.value as any).value, "user@example.com");
  assertEquals((stmt.target as any).value, "#email");
});

Deno.test("InsertStatement - insert variable value", () => {
  const stmt: InsertStatement = {
    type: "INSERT",
    value: { type: "IDENTIFIER", name: "username" },
    target: { type: "LITERAL", dataType: DataType.SELECTOR, value: 'input[name="user"]' },
  };

  assertEquals((stmt.value as any).name, "username");
});

// ============================================================================
// UpdateStatement Tests
// ============================================================================

Deno.test("UpdateStatement - update single property", () => {
  const stmt: UpdateStatement = {
    type: "UPDATE",
    target: { type: "LITERAL", dataType: DataType.SELECTOR, value: "#element" },
    assignments: [
      { property: "innerHTML", value: { type: "LITERAL", dataType: DataType.STRING, value: "<b>New</b>" } },
    ],
  };

  assertEquals(stmt.type, "UPDATE");
  assertEquals(stmt.assignments.length, 1);
  assertEquals(stmt.assignments[0].property, "innerHTML");
});

Deno.test("UpdateStatement - update multiple properties", () => {
  const stmt: UpdateStatement = {
    type: "UPDATE",
    target: { type: "LITERAL", dataType: DataType.SELECTOR, value: ".box" },
    assignments: [
      { property: "style.width", value: { type: "LITERAL", dataType: DataType.STRING, value: "100px" } },
      { property: "style.height", value: { type: "LITERAL", dataType: DataType.STRING, value: "100px" } },
      { property: "className", value: { type: "LITERAL", dataType: DataType.STRING, value: "active" } },
    ],
  };

  assertEquals(stmt.assignments.length, 3);
});

// ============================================================================
// DeleteStatement Tests
// ============================================================================

Deno.test("DeleteStatement - delete by selector", () => {
  const stmt: DeleteStatement = {
    type: "DELETE",
    target: { type: "LITERAL", dataType: DataType.SELECTOR, value: ".ad-banner" },
  };

  assertEquals(stmt.type, "DELETE");
  assertEquals((stmt.target as any).value, ".ad-banner");
});

Deno.test("DeleteStatement - delete by xpath", () => {
  const stmt: DeleteStatement = {
    type: "DELETE",
    target: { type: "LITERAL", dataType: DataType.XPATH, value: "//div[@class='popup']" },
  };

  assertEquals((stmt.target as any).dataType, DataType.XPATH);
});

// ============================================================================
// WithStatement (CTE) Tests
// ============================================================================

Deno.test("WithStatement - single CTE", () => {
  const stmt: WithStatement = {
    type: "WITH",
    ctes: [
      {
        name: "top_pages",
        query: {
          type: "SELECT",
          fields: [{ name: "url" }, { name: "visits" }],
          source: { type: "URL", value: "https://analytics.example.com" },
          orderBy: [{ field: "visits", direction: "DESC" }],
          limit: { count: 10 },
        },
      },
    ],
    query: {
      type: "SELECT",
      fields: [{ name: "url" }],
      source: { type: "VARIABLE", value: "top_pages" },
    },
  };

  assertEquals(stmt.type, "WITH");
  assertEquals(stmt.ctes.length, 1);
  assertEquals(stmt.ctes[0].name, "top_pages");
});

Deno.test("WithStatement - multiple CTEs", () => {
  const stmt: WithStatement = {
    type: "WITH",
    ctes: [
      {
        name: "users",
        query: {
          type: "SELECT",
          fields: [{ name: "id" }],
          source: { type: "URL", value: "https://api.example.com/users" },
        },
      },
      {
        name: "orders",
        query: {
          type: "SELECT",
          fields: [{ name: "user_id" }],
          source: { type: "URL", value: "https://api.example.com/orders" },
        },
      },
    ],
    query: {
      type: "SELECT",
      fields: [{ name: "id" }],
      source: { type: "VARIABLE", value: "users" },
    },
  };

  assertEquals(stmt.ctes.length, 2);
  assertEquals(stmt.ctes[0].name, "users");
  assertEquals(stmt.ctes[1].name, "orders");
});

// ============================================================================
// Field Type Tests
// ============================================================================

Deno.test("Field - name only", () => {
  const field: Field = { name: "title" };
  assertEquals(field.name, "title");
  assertEquals(field.alias, undefined);
});

Deno.test("Field - with alias", () => {
  const field: Field = { name: "title", alias: "pageTitle" };
  assertEquals(field.alias, "pageTitle");
});

Deno.test("Field - with path", () => {
  const field: Field = { name: "city", path: ["user", "address", "city"] };
  assertEquals(field.path?.length, 3);
});

Deno.test("Field - with expression", () => {
  const field: Field = {
    name: "total",
    expression: {
      type: "BINARY",
      operator: "*",
      left: { type: "IDENTIFIER", name: "price" },
      right: { type: "IDENTIFIER", name: "quantity" },
    },
  };
  assertExists(field.expression);
});

// ============================================================================
// Source Type Tests
// ============================================================================

Deno.test("Source - URL type", () => {
  const source: Source = { type: "URL", value: "https://example.com" };
  assertEquals(source.type, "URL");
});

Deno.test("Source - VARIABLE type", () => {
  const source: Source = { type: "VARIABLE", value: "myData" };
  assertEquals(source.type, "VARIABLE");
});

Deno.test("Source - SUBQUERY type", () => {
  const innerQuery: SelectStatement = {
    type: "SELECT",
    fields: [{ name: "id" }],
    source: { type: "URL", value: "https://example.com" },
  };
  const source: Source = { type: "SUBQUERY", value: innerQuery };
  assertEquals(source.type, "SUBQUERY");
});

// ============================================================================
// OrderBy Type Tests
// ============================================================================

Deno.test("OrderBy - ascending", () => {
  const orderBy: OrderBy = { field: "name", direction: "ASC" };
  assertEquals(orderBy.direction, "ASC");
});

Deno.test("OrderBy - descending", () => {
  const orderBy: OrderBy = { field: "date", direction: "DESC" };
  assertEquals(orderBy.direction, "DESC");
});

// ============================================================================
// LimitClause Type Tests
// ============================================================================

Deno.test("LimitClause - limit only", () => {
  const limit: LimitClause = { count: 10 };
  assertEquals(limit.count, 10);
  assertEquals(limit.offset, undefined);
});

Deno.test("LimitClause - with offset", () => {
  const limit: LimitClause = { count: 10, offset: 100 };
  assertEquals(limit.count, 10);
  assertEquals(limit.offset, 100);
});

// ============================================================================
// ShowTarget Type Tests
// ============================================================================

Deno.test("ShowTarget - all targets are valid", () => {
  const targets: ShowTarget[] = [
    "CACHE", "COOKIES", "HEADERS", "CONNECTIONS", "METRICS", "STATE"
  ];
  assertEquals(targets.length, 6);
});

// ============================================================================
// Statement Type Discrimination Tests
// ============================================================================

Deno.test("Statement type discrimination - SELECT", () => {
  const stmt: Statement = {
    type: "SELECT",
    fields: [{ name: "title" }],
    source: { type: "URL", value: "https://example.com" },
  };

  if (stmt.type === "SELECT") {
    assertEquals(stmt.fields.length, 1);
  }
});

Deno.test("Statement type discrimination - NAVIGATE", () => {
  const stmt: Statement = {
    type: "NAVIGATE",
    url: { type: "LITERAL", dataType: DataType.URL, value: "https://example.com" },
  };

  if (stmt.type === "NAVIGATE") {
    assertExists(stmt.url);
  }
});

Deno.test("Statement type discrimination - FOR", () => {
  const stmt: Statement = {
    type: "FOR",
    variable: "item",
    collection: { type: "IDENTIFIER", name: "items" },
    body: {
      type: "SET",
      path: ["result"],
      value: { type: "IDENTIFIER", name: "item" },
    },
  };

  if (stmt.type === "FOR") {
    assertEquals(stmt.variable, "item");
  }
});
