/**
 * Tests for AST Builder Helpers
 */

import { assertEquals } from "@std/assert";
import {
  buildArrayExpression,
  buildAssignment,
  buildBinaryExpression,
  buildBlockStatement,
  buildField,
  buildFunctionCall,
  buildIdentifier,
  buildIfStatement,
  buildLiteral,
  buildMemberExpression,
  buildNavigateStatement,
  buildObjectExpression,
  buildSelectStatement,
  buildUnaryExpression,
} from "./ast-builders.ts";
import { DataType } from "../../types/primitives.ts";

Deno.test("buildLiteral - creates string literal", () => {
  const literal = buildLiteral("hello");
  assertEquals(literal.type, "LITERAL");
  assertEquals(literal.dataType, DataType.STRING);
  assertEquals(literal.value, "hello");
});

Deno.test("buildLiteral - creates number literal", () => {
  const literal = buildLiteral(42);
  assertEquals(literal.type, "LITERAL");
  assertEquals(literal.dataType, DataType.NUMBER);
  assertEquals(literal.value, 42);
});

Deno.test("buildLiteral - creates boolean literal", () => {
  const literal = buildLiteral(true);
  assertEquals(literal.type, "LITERAL");
  assertEquals(literal.dataType, DataType.BOOLEAN);
  assertEquals(literal.value, true);
});

Deno.test("buildLiteral - creates null literal", () => {
  const literal = buildLiteral(null);
  assertEquals(literal.type, "LITERAL");
  assertEquals(literal.dataType, DataType.NULL);
  assertEquals(literal.value, null);
});

Deno.test("buildLiteral - explicit type override", () => {
  const literal = buildLiteral("https://example.com", DataType.URL);
  assertEquals(literal.dataType, DataType.URL);
  assertEquals(literal.value, "https://example.com");
});

Deno.test("buildIdentifier - creates identifier node", () => {
  const id = buildIdentifier("myVar");
  assertEquals(id.type, "IDENTIFIER");
  assertEquals(id.name, "myVar");
});

Deno.test("buildBinaryExpression - creates equality comparison", () => {
  const left = buildIdentifier("status");
  const right = buildLiteral(200);
  const expr = buildBinaryExpression(left, "=", right);

  assertEquals(expr.type, "BINARY");
  assertEquals(expr.operator, "=");
  assertEquals(expr.left, left);
  assertEquals(expr.right, right);
});

Deno.test("buildBinaryExpression - creates AND expression", () => {
  const left = buildBinaryExpression(
    buildIdentifier("x"),
    ">",
    buildLiteral(0),
  );
  const right = buildBinaryExpression(
    buildIdentifier("y"),
    "<",
    buildLiteral(100),
  );
  const expr = buildBinaryExpression(left, "AND", right);

  assertEquals(expr.type, "BINARY");
  assertEquals(expr.operator, "AND");
  assertEquals((expr.left as any).operator, ">");
  assertEquals((expr.right as any).operator, "<");
});

Deno.test("buildUnaryExpression - creates NOT expression", () => {
  const operand = buildIdentifier("isActive");
  const expr = buildUnaryExpression("NOT", operand);

  assertEquals(expr.type, "UNARY");
  assertEquals(expr.operator, "NOT");
  assertEquals(expr.operand, operand);
});

Deno.test("buildUnaryExpression - creates negation", () => {
  const operand = buildLiteral(42);
  const expr = buildUnaryExpression("-", operand);

  assertEquals(expr.type, "UNARY");
  assertEquals(expr.operator, "-");
  assertEquals(expr.operand, operand);
});

Deno.test("buildFunctionCall - creates function call with args", () => {
  const call = buildFunctionCall("UPPER", [buildLiteral("hello")]);

  assertEquals(call.type, "CALL");
  assertEquals(call.callee, "UPPER");
  assertEquals(call.arguments.length, 1);
  assertEquals((call.arguments[0] as any).value, "hello");
});

Deno.test("buildFunctionCall - creates function call with no args", () => {
  const call = buildFunctionCall("NOW", []);

  assertEquals(call.type, "CALL");
  assertEquals(call.callee, "NOW");
  assertEquals(call.arguments.length, 0);
});

Deno.test("buildMemberExpression - creates dot access", () => {
  const member = buildMemberExpression(
    buildIdentifier("response"),
    "status",
    false,
  );

  assertEquals(member.type, "MEMBER");
  assertEquals((member.object as any).name, "response");
  assertEquals(member.property, "status");
  assertEquals(member.computed, false);
});

Deno.test("buildMemberExpression - creates computed access", () => {
  const member = buildMemberExpression(
    buildIdentifier("data"),
    "key",
    true,
  );

  assertEquals(member.type, "MEMBER");
  assertEquals(member.computed, true);
});

Deno.test("buildArrayExpression - creates array with elements", () => {
  const arr = buildArrayExpression([
    buildLiteral(1),
    buildLiteral(2),
    buildLiteral(3),
  ]);

  assertEquals(arr.type, "ARRAY");
  assertEquals(arr.elements.length, 3);
  assertEquals((arr.elements[0] as any).value, 1);
  assertEquals((arr.elements[2] as any).value, 3);
});

Deno.test("buildArrayExpression - creates empty array", () => {
  const arr = buildArrayExpression([]);

  assertEquals(arr.type, "ARRAY");
  assertEquals(arr.elements.length, 0);
});

Deno.test("buildObjectExpression - creates object with properties", () => {
  const obj = buildObjectExpression({
    name: buildLiteral("John"),
    age: buildLiteral(30),
    active: buildLiteral(true),
  });

  assertEquals(obj.type, "OBJECT");
  assertEquals(obj.properties.length, 3);
  assertEquals(obj.properties[0].key, "name");
  assertEquals((obj.properties[0].value as any).value, "John");
  assertEquals(obj.properties[1].key, "age");
  assertEquals((obj.properties[1].value as any).value, 30);
});

Deno.test("buildObjectExpression - creates empty object", () => {
  const obj = buildObjectExpression({});

  assertEquals(obj.type, "OBJECT");
  assertEquals(obj.properties.length, 0);
});

Deno.test("buildSelectStatement - creates basic SELECT", () => {
  const stmt = buildSelectStatement({
    fields: ["title", "url"],
    source: "https://example.com",
  });

  assertEquals(stmt.type, "SELECT");
  assertEquals(stmt.fields.length, 2);
  assertEquals(stmt.fields[0].name, "title");
  assertEquals(stmt.fields[1].name, "url");
  assertEquals(stmt.source.type, "URL");
  assertEquals(stmt.source.value, "https://example.com");
});

Deno.test("buildSelectStatement - creates SELECT with WHERE clause", () => {
  const whereClause = buildBinaryExpression(
    buildIdentifier("status"),
    "=",
    buildLiteral(200),
  );

  const stmt = buildSelectStatement({
    fields: ["body"],
    source: "https://api.example.com",
    where: whereClause,
  });

  assertEquals(stmt.where, whereClause);
  assertEquals((stmt.where as any).operator, "=");
});

Deno.test("buildSelectStatement - creates SELECT with ORDER BY and LIMIT", () => {
  const stmt = buildSelectStatement({
    fields: ["name", "score"],
    source: { type: "VARIABLE", value: "$data" },
    orderBy: [{ field: "score", direction: "DESC" }],
    limit: { count: 10, offset: 5 },
  });

  assertEquals(stmt.orderBy?.length, 1);
  assertEquals(stmt.orderBy?.[0].field, "score");
  assertEquals(stmt.orderBy?.[0].direction, "DESC");
  assertEquals(stmt.limit?.count, 10);
  assertEquals(stmt.limit?.offset, 5);
});

Deno.test("buildNavigateStatement - creates basic NAVIGATE", () => {
  const stmt = buildNavigateStatement({
    url: "https://example.com",
  });

  assertEquals(stmt.type, "NAVIGATE");
  assertEquals((stmt.url as any).value, "https://example.com");
  assertEquals(stmt.options, undefined);
  assertEquals(stmt.capture, undefined);
});

Deno.test("buildNavigateStatement - creates NAVIGATE with options", () => {
  const stmt = buildNavigateStatement({
    url: "https://example.com",
    navigateOptions: {
      waitUntil: "load",
      timeout: 5000,
      proxy: {
        cache: true,
        ttl: 3600,
      },
    },
  });

  assertEquals(stmt.options?.waitUntil, "load");
  assertEquals(stmt.options?.timeout, 5000);
  assertEquals(stmt.options?.proxy?.cache, true);
  assertEquals(stmt.options?.proxy?.ttl, 3600);
});

Deno.test("buildNavigateStatement - creates NAVIGATE with CAPTURE", () => {
  const stmt = buildNavigateStatement({
    url: "https://example.com",
    capture: {
      fields: ["title", "description", { name: "body", alias: "content" }],
    },
  });

  assertEquals(stmt.capture?.fields.length, 3);
  assertEquals(stmt.capture?.fields[0].name, "title");
  assertEquals(stmt.capture?.fields[1].name, "description");
  assertEquals(stmt.capture?.fields[2].name, "body");
  assertEquals(stmt.capture?.fields[2].alias, "content");
});

Deno.test("buildIfStatement - creates IF statement", () => {
  const condition = buildBinaryExpression(
    buildIdentifier("count"),
    ">",
    buildLiteral(0),
  );
  const thenBranch = buildNavigateStatement({ url: "https://example.com" });

  const stmt = buildIfStatement(condition, thenBranch);

  assertEquals(stmt.type, "IF");
  assertEquals((stmt.condition as any).operator, ">");
  assertEquals(stmt.then, thenBranch);
  assertEquals(stmt.else, undefined);
});

Deno.test("buildIfStatement - creates IF-ELSE statement", () => {
  const condition = buildIdentifier("isLoggedIn");
  const thenBranch = buildNavigateStatement({ url: "https://dashboard.com" });
  const elseBranch = buildNavigateStatement({ url: "https://login.com" });

  const stmt = buildIfStatement(condition, thenBranch, elseBranch);

  assertEquals(stmt.then, thenBranch);
  assertEquals(stmt.else, elseBranch);
});

Deno.test("buildBlockStatement - creates block with multiple statements", () => {
  const stmt1 = buildNavigateStatement({ url: "https://example.com" });
  const stmt2 = buildNavigateStatement({ url: "https://example.org" });
  const block = buildBlockStatement([stmt1, stmt2]);

  assertEquals(block.type, "BLOCK");
  assertEquals(block.statements.length, 2);
  assertEquals(block.statements[0], stmt1);
  assertEquals(block.statements[1], stmt2);
});

Deno.test("buildBlockStatement - creates empty block", () => {
  const block = buildBlockStatement([]);

  assertEquals(block.type, "BLOCK");
  assertEquals(block.statements.length, 0);
});

Deno.test("buildField - creates simple field", () => {
  const field = buildField("title");

  assertEquals(field.name, "title");
  assertEquals(field.alias, undefined);
  assertEquals(field.path, undefined);
  assertEquals(field.expression, undefined);
});

Deno.test("buildField - creates field with alias", () => {
  const field = buildField("title", { alias: "pageTitle" });

  assertEquals(field.name, "title");
  assertEquals(field.alias, "pageTitle");
});

Deno.test("buildField - creates field with path", () => {
  const field = buildField("meta", { path: ["og", "title"] });

  assertEquals(field.name, "meta");
  assertEquals(field.path?.length, 2);
  assertEquals(field.path?.[0], "og");
  assertEquals(field.path?.[1], "title");
});

Deno.test("buildField - creates field with expression", () => {
  const expr = buildFunctionCall("UPPER", [buildIdentifier("title")]);
  const field = buildField("title", { expression: expr });

  assertEquals(field.name, "title");
  assertEquals(field.expression, expr);
  assertEquals((field.expression as any).callee, "UPPER");
});

Deno.test("buildAssignment - creates assignment for UPDATE", () => {
  const assignment = buildAssignment("className", buildLiteral("active"));

  assertEquals(assignment.property, "className");
  assertEquals((assignment.value as any).value, "active");
});

Deno.test("complex nested expression - WHERE clause with AND/OR", () => {
  // WHERE status = 200 AND (type = 'html' OR type = 'json')
  const statusCheck = buildBinaryExpression(
    buildIdentifier("status"),
    "=",
    buildLiteral(200),
  );

  const typeHtml = buildBinaryExpression(
    buildIdentifier("type"),
    "=",
    buildLiteral("html"),
  );

  const typeJson = buildBinaryExpression(
    buildIdentifier("type"),
    "=",
    buildLiteral("json"),
  );

  const typeOr = buildBinaryExpression(typeHtml, "OR", typeJson);
  const fullWhere = buildBinaryExpression(statusCheck, "AND", typeOr);

  assertEquals((fullWhere as any).operator, "AND");
  assertEquals((fullWhere.left as any).operator, "=");
  assertEquals((fullWhere.right as any).operator, "OR");
});

Deno.test("complex nested expression - function call with member access", () => {
  // UPPER(response.body.title)
  const bodyAccess = buildMemberExpression(
    buildIdentifier("response"),
    "body",
  );
  const titleAccess = buildMemberExpression(bodyAccess, "title");
  const upperCall = buildFunctionCall("UPPER", [titleAccess]);

  assertEquals(upperCall.callee, "UPPER");
  assertEquals((upperCall.arguments[0] as any).type, "MEMBER");
  assertEquals((upperCall.arguments[0] as any).property, "title");
});
