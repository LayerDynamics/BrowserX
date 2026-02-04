/**
 * Parser Tests
 * Comprehensive tests for the Parser class using direct token input
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import { Parser } from "../../parser/parser.ts";
import { Token, TokenType } from "../../lexer/token.ts";
import type {
  SelectStatement,
  NavigateStatement,
  SetStatement,
  ForStatement,
  IfStatement,
  ShowStatement,
  InsertStatement,
  UpdateStatement,
  DeleteStatement,
  WithStatement,
  BinaryExpression,
  UnaryExpression,
  CallExpression,
  MemberExpression,
  Literal,
  Identifier,
} from "../../types/ast.ts";

// ============================================================================
// Helper Functions
// ============================================================================

function createToken(type: TokenType, value: string, line = 1, column = 1, offset = 0): Token {
  return { type, value, line, column, offset };
}

function createTokens(...specs: Array<[TokenType, string]>): Token[] {
  let offset = 0;
  const tokens = specs.map(([type, value], i) => {
    const token = createToken(type, value, 1, i * 5 + 1, offset);
    offset += value.length + 1; // +1 for whitespace
    return token;
  });
  // Always append EOF token - the parser expects it to detect end of input
  tokens.push(createToken(TokenType.EOF, "", 1, specs.length * 5 + 1, offset));
  return tokens;
}

// ============================================================================
// Parser Constructor Tests
// ============================================================================

Deno.test("Parser - constructor accepts token array", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.STAR, "*"],
    [TokenType.FROM, "FROM"],
    [TokenType.STRING, "'http://example.com'"]
  );

  const parser = new Parser(tokens);
  assertExists(parser);
});

Deno.test("Parser - constructor accepts empty array", () => {
  const parser = new Parser([]);
  assertExists(parser);
});

// ============================================================================
// SELECT Statement Parsing Tests
// ============================================================================

Deno.test("Parser - parse SELECT * FROM url", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.STAR, "*"],
    [TokenType.FROM, "FROM"],
    [TokenType.STRING, "http://example.com"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  assertEquals(ast.type, "SELECT");
  assertEquals(ast.fields.length, 1);
  assertEquals(ast.fields[0].name, "*");
  assertEquals(ast.source.type, "URL");
  assertEquals(ast.source.value, "http://example.com");
});

Deno.test("Parser - parse SELECT with single field", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.IDENTIFIER, "title"],
    [TokenType.FROM, "FROM"],
    [TokenType.STRING, "http://example.com"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  assertEquals(ast.fields.length, 1);
  assertEquals(ast.fields[0].name, "title");
});

Deno.test("Parser - parse SELECT with multiple fields", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.IDENTIFIER, "name"],
    [TokenType.COMMA, ","],
    [TokenType.IDENTIFIER, "age"],
    [TokenType.COMMA, ","],
    [TokenType.IDENTIFIER, "email"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "users"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  assertEquals(ast.fields.length, 3);
  assertEquals(ast.fields[0].name, "name");
  assertEquals(ast.fields[1].name, "age");
  assertEquals(ast.fields[2].name, "email");
});

Deno.test("Parser - parse SELECT with field alias", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.IDENTIFIER, "name"],
    [TokenType.AS, "AS"],
    [TokenType.IDENTIFIER, "fullName"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "users"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  assertEquals(ast.fields[0].name, "name");
  assertEquals(ast.fields[0].alias, "fullName");
});

Deno.test("Parser - parse SELECT with WHERE clause", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.STAR, "*"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "users"],
    [TokenType.WHERE, "WHERE"],
    [TokenType.IDENTIFIER, "age"],
    [TokenType.GREATER, ">"],
    [TokenType.NUMBER, "18"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  assertExists(ast.where);
  const where = ast.where as BinaryExpression;
  assertEquals(where.type, "BINARY");
  assertEquals(where.operator, ">");
});

Deno.test("Parser - parse SELECT with ORDER BY", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.STAR, "*"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "users"],
    [TokenType.ORDER, "ORDER"],
    [TokenType.BY, "BY"],
    [TokenType.IDENTIFIER, "age"],
    [TokenType.IDENTIFIER, "DESC"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  assertExists(ast.orderBy);
  assertEquals(ast.orderBy.length, 1);
  assertEquals(ast.orderBy[0].field, "age");
  assertEquals(ast.orderBy[0].direction, "DESC");
});

Deno.test("Parser - parse SELECT with LIMIT", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.STAR, "*"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "users"],
    [TokenType.LIMIT, "LIMIT"],
    [TokenType.NUMBER, "10"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  assertExists(ast.limit);
  assertEquals(ast.limit.count, 10);
});

Deno.test("Parser - parse SELECT with LIMIT and OFFSET", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.STAR, "*"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "users"],
    [TokenType.LIMIT, "LIMIT"],
    [TokenType.NUMBER, "10"],
    [TokenType.OFFSET, "OFFSET"],
    [TokenType.NUMBER, "20"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  assertExists(ast.limit);
  assertEquals(ast.limit.count, 10);
  assertEquals(ast.limit.offset, 20);
});

Deno.test("Parser - parse SELECT from variable source", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.STAR, "*"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "myData"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  assertEquals(ast.source.type, "VARIABLE");
  assertEquals(ast.source.value, "myData");
});

// ============================================================================
// NAVIGATE Statement Parsing Tests
// ============================================================================

Deno.test("Parser - parse NAVIGATE TO url", () => {
  const tokens = createTokens(
    [TokenType.NAVIGATE, "NAVIGATE"],
    [TokenType.TO, "TO"],
    [TokenType.STRING, "http://example.com"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as NavigateStatement;

  assertEquals(ast.type, "NAVIGATE");
  assertEquals((ast.url as Literal).value, "http://example.com");
});

Deno.test("Parser - parse NAVIGATE TO variable", () => {
  const tokens = createTokens(
    [TokenType.NAVIGATE, "NAVIGATE"],
    [TokenType.TO, "TO"],
    [TokenType.IDENTIFIER, "targetUrl"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as NavigateStatement;

  assertEquals(ast.type, "NAVIGATE");
  assertEquals((ast.url as Identifier).name, "targetUrl");
});

// ============================================================================
// SET Statement Parsing Tests
// ============================================================================

Deno.test("Parser - parse SET with string value", () => {
  const tokens = createTokens(
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "name"],
    [TokenType.EQUALS, "="],
    [TokenType.STRING, "John"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SetStatement;

  assertEquals(ast.type, "SET");
  assertEquals(ast.path, ["name"]);
  assertEquals((ast.value as Literal).value, "John");
});

Deno.test("Parser - parse SET with number value", () => {
  const tokens = createTokens(
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "count"],
    [TokenType.EQUALS, "="],
    [TokenType.NUMBER, "42"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SetStatement;

  assertEquals(ast.path, ["count"]);
  assertEquals((ast.value as Literal).value, 42);
});

Deno.test("Parser - parse SET with boolean value", () => {
  const tokens = createTokens(
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "enabled"],
    [TokenType.EQUALS, "="],
    [TokenType.BOOLEAN, "true"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SetStatement;

  assertEquals(ast.path, ["enabled"]);
  assertEquals((ast.value as Literal).value, true);
});

Deno.test("Parser - parse SET with nested path", () => {
  const tokens = createTokens(
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "user"],
    [TokenType.DOT, "."],
    [TokenType.IDENTIFIER, "profile"],
    [TokenType.DOT, "."],
    [TokenType.IDENTIFIER, "name"],
    [TokenType.EQUALS, "="],
    [TokenType.STRING, "John"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SetStatement;

  assertEquals(ast.path.length, 3);
  assertEquals(ast.path[0], "user");
  assertEquals(ast.path[1], "profile");
  assertEquals(ast.path[2], "name");
});

// ============================================================================
// SHOW Statement Parsing Tests
// ============================================================================

Deno.test("Parser - parse SHOW TABLES", () => {
  const tokens = createTokens(
    [TokenType.SHOW, "SHOW"],
    [TokenType.IDENTIFIER, "TABLES"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as ShowStatement;

  assertEquals(ast.type, "SHOW");
  assertEquals(ast.target, "TABLES");
});

Deno.test("Parser - parse SHOW VARIABLES", () => {
  const tokens = createTokens(
    [TokenType.SHOW, "SHOW"],
    [TokenType.IDENTIFIER, "VARIABLES"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as ShowStatement;

  assertEquals(ast.target, "VARIABLES");
});

// ============================================================================
// FOR Statement Parsing Tests
// ============================================================================

Deno.test("Parser - parse FOR EACH loop", () => {
  const tokens = createTokens(
    [TokenType.FOR, "FOR"],
    [TokenType.EACH, "EACH"],
    [TokenType.IDENTIFIER, "item"],
    [TokenType.IN, "IN"],
    [TokenType.IDENTIFIER, "items"],
    [TokenType.LEFT_BRACE, "{"],
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "result"],
    [TokenType.EQUALS, "="],
    [TokenType.IDENTIFIER, "item"],
    [TokenType.RIGHT_BRACE, "}"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as ForStatement;

  assertEquals(ast.type, "FOR");
  assertEquals(ast.variable, "item");
  assertEquals((ast.collection as Identifier).name, "items");
  assertExists(ast.body);
});

Deno.test("Parser - parse FOR loop over array literal", () => {
  const tokens = createTokens(
    [TokenType.FOR, "FOR"],
    [TokenType.EACH, "EACH"],
    [TokenType.IDENTIFIER, "url"],
    [TokenType.IN, "IN"],
    [TokenType.LEFT_BRACKET, "["],
    [TokenType.STRING, "http://a.com"],
    [TokenType.COMMA, ","],
    [TokenType.STRING, "http://b.com"],
    [TokenType.RIGHT_BRACKET, "]"],
    [TokenType.LEFT_BRACE, "{"],
    [TokenType.NAVIGATE, "NAVIGATE"],
    [TokenType.TO, "TO"],
    [TokenType.IDENTIFIER, "url"],
    [TokenType.RIGHT_BRACE, "}"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as ForStatement;

  assertEquals(ast.variable, "url");
  assertEquals(ast.collection.type, "ARRAY");
});

// ============================================================================
// IF Statement Parsing Tests
// ============================================================================

Deno.test("Parser - parse IF THEN", () => {
  const tokens = createTokens(
    [TokenType.IF, "IF"],
    [TokenType.IDENTIFIER, "condition"],
    [TokenType.THEN, "THEN"],
    [TokenType.LEFT_BRACE, "{"],
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "result"],
    [TokenType.EQUALS, "="],
    [TokenType.BOOLEAN, "true"],
    [TokenType.RIGHT_BRACE, "}"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as IfStatement;

  assertEquals(ast.type, "IF");
  assertEquals((ast.condition as Identifier).name, "condition");
  assertExists(ast.then);
});

Deno.test("Parser - parse IF THEN ELSE", () => {
  const tokens = createTokens(
    [TokenType.IF, "IF"],
    [TokenType.IDENTIFIER, "condition"],
    [TokenType.THEN, "THEN"],
    [TokenType.LEFT_BRACE, "{"],
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "result"],
    [TokenType.EQUALS, "="],
    [TokenType.BOOLEAN, "true"],
    [TokenType.RIGHT_BRACE, "}"],
    [TokenType.ELSE, "ELSE"],
    [TokenType.LEFT_BRACE, "{"],
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "result"],
    [TokenType.EQUALS, "="],
    [TokenType.BOOLEAN, "false"],
    [TokenType.RIGHT_BRACE, "}"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as IfStatement;

  assertEquals(ast.type, "IF");
  assertExists(ast.then);
  assertExists(ast.else);
});

Deno.test("Parser - parse IF with comparison condition", () => {
  const tokens = createTokens(
    [TokenType.IF, "IF"],
    [TokenType.IDENTIFIER, "count"],
    [TokenType.GREATER, ">"],
    [TokenType.NUMBER, "0"],
    [TokenType.THEN, "THEN"],
    [TokenType.LEFT_BRACE, "{"],
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "valid"],
    [TokenType.EQUALS, "="],
    [TokenType.BOOLEAN, "true"],
    [TokenType.RIGHT_BRACE, "}"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as IfStatement;

  const condition = ast.condition as BinaryExpression;
  assertEquals(condition.type, "BINARY");
  assertEquals(condition.operator, ">");
});

// ============================================================================
// INSERT Statement Parsing Tests
// ============================================================================

Deno.test("Parser - parse INSERT INTO selector", () => {
  const tokens = createTokens(
    [TokenType.INSERT, "INSERT"],
    [TokenType.STRING, "test@example.com"],
    [TokenType.INTO, "INTO"],
    [TokenType.STRING, "#email"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as InsertStatement;

  assertEquals(ast.type, "INSERT");
  assertEquals((ast.value as Literal).value, "test@example.com");
  assertEquals((ast.target as Literal).value, "#email");
});

// ============================================================================
// UPDATE Statement Parsing Tests
// ============================================================================

Deno.test("Parser - parse UPDATE with single assignment", () => {
  const tokens = createTokens(
    [TokenType.UPDATE, "UPDATE"],
    [TokenType.STRING, "#name"],
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "value"],
    [TokenType.EQUALS, "="],
    [TokenType.STRING, "New Name"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as UpdateStatement;

  assertEquals(ast.type, "UPDATE");
  assertEquals(ast.assignments.length, 1);
  assertEquals(ast.assignments[0].property, "value");
});

// ============================================================================
// DELETE Statement Parsing Tests
// ============================================================================

Deno.test("Parser - parse DELETE FROM", () => {
  const tokens = createTokens(
    [TokenType.DELETE, "DELETE"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "cache"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as DeleteStatement;

  assertEquals(ast.type, "DELETE");
  assertEquals((ast.target as any).type, "IDENTIFIER");
  assertEquals((ast.target as any).name, "cache");
});

// ============================================================================
// WITH Statement Parsing Tests
// ============================================================================

Deno.test("Parser - parse WITH CTE", () => {
  const tokens = createTokens(
    [TokenType.WITH, "WITH"],
    [TokenType.IDENTIFIER, "users_cte"],
    [TokenType.AS, "AS"],
    [TokenType.LEFT_PAREN, "("],
    [TokenType.SELECT, "SELECT"],
    [TokenType.STAR, "*"],
    [TokenType.FROM, "FROM"],
    [TokenType.STRING, "http://api.example.com/users"],
    [TokenType.RIGHT_PAREN, ")"],
    [TokenType.SELECT, "SELECT"],
    [TokenType.STAR, "*"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "users_cte"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as WithStatement;

  assertEquals(ast.type, "WITH");
  assertExists(ast.ctes);
  assertEquals(ast.ctes.length, 1);
  assertEquals(ast.ctes[0].name, "users_cte");
});

// ============================================================================
// Expression Parsing Tests
// ============================================================================

Deno.test("Parser - parse binary arithmetic expression", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.IDENTIFIER, "a"],
    [TokenType.PLUS, "+"],
    [TokenType.IDENTIFIER, "b"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "data"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  const expr = ast.fields[0].expression as BinaryExpression;
  assertExists(expr);
  assertEquals(expr.type, "BINARY");
  assertEquals(expr.operator, "+");
});

Deno.test("Parser - parse comparison expression", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.STAR, "*"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "users"],
    [TokenType.WHERE, "WHERE"],
    [TokenType.IDENTIFIER, "age"],
    [TokenType.GREATER_EQ, ">="],
    [TokenType.NUMBER, "21"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  const where = ast.where as BinaryExpression;
  assertEquals(where.operator, ">=");
});

Deno.test("Parser - parse logical AND expression", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.STAR, "*"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "users"],
    [TokenType.WHERE, "WHERE"],
    [TokenType.IDENTIFIER, "active"],
    [TokenType.AND, "AND"],
    [TokenType.IDENTIFIER, "verified"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  const where = ast.where as BinaryExpression;
  assertEquals(where.operator, "AND");
});

Deno.test("Parser - parse logical OR expression", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.STAR, "*"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "users"],
    [TokenType.WHERE, "WHERE"],
    [TokenType.IDENTIFIER, "admin"],
    [TokenType.OR, "OR"],
    [TokenType.IDENTIFIER, "moderator"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  const where = ast.where as BinaryExpression;
  assertEquals(where.operator, "OR");
});

Deno.test("Parser - parse NOT expression", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.STAR, "*"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "users"],
    [TokenType.WHERE, "WHERE"],
    [TokenType.NOT, "NOT"],
    [TokenType.IDENTIFIER, "deleted"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  const where = ast.where as UnaryExpression;
  assertEquals(where.type, "UNARY");
  assertEquals(where.operator, "NOT");
});

Deno.test("Parser - parse function call expression", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.IDENTIFIER, "UPPER"],
    [TokenType.LEFT_PAREN, "("],
    [TokenType.IDENTIFIER, "name"],
    [TokenType.RIGHT_PAREN, ")"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "users"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  const expr = ast.fields[0].expression as CallExpression;
  assertEquals(expr.type, "CALL");
  assertEquals(expr.callee, "UPPER");
  assertEquals(expr.arguments.length, 1);
});

Deno.test("Parser - parse member access expression", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.IDENTIFIER, "user"],
    [TokenType.DOT, "."],
    [TokenType.IDENTIFIER, "profile"],
    [TokenType.DOT, "."],
    [TokenType.IDENTIFIER, "name"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "data"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  assertExists(ast.fields[0].path);
  assertEquals(ast.fields[0].path?.length, 3);
});

Deno.test("Parser - parse array literal", () => {
  const tokens = createTokens(
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "items"],
    [TokenType.EQUALS, "="],
    [TokenType.LEFT_BRACKET, "["],
    [TokenType.NUMBER, "1"],
    [TokenType.COMMA, ","],
    [TokenType.NUMBER, "2"],
    [TokenType.COMMA, ","],
    [TokenType.NUMBER, "3"],
    [TokenType.RIGHT_BRACKET, "]"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SetStatement;

  assertEquals(ast.value.type, "ARRAY");
});

Deno.test("Parser - parse object literal", () => {
  const tokens = createTokens(
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "config"],
    [TokenType.EQUALS, "="],
    [TokenType.LEFT_BRACE, "{"],
    [TokenType.IDENTIFIER, "timeout"],
    [TokenType.COLON, ":"],
    [TokenType.NUMBER, "5000"],
    [TokenType.COMMA, ","],
    [TokenType.IDENTIFIER, "retries"],
    [TokenType.COLON, ":"],
    [TokenType.NUMBER, "3"],
    [TokenType.RIGHT_BRACE, "}"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SetStatement;

  assertEquals(ast.value.type, "OBJECT");
});

// ============================================================================
// Literal Parsing Tests
// ============================================================================

Deno.test("Parser - parse string literal", () => {
  const tokens = createTokens(
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "name"],
    [TokenType.EQUALS, "="],
    [TokenType.STRING, "hello"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SetStatement;

  const lit = ast.value as Literal;
  assertEquals(lit.type, "LITERAL");
  assertEquals(lit.value, "hello");
});

Deno.test("Parser - parse number literal", () => {
  const tokens = createTokens(
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "count"],
    [TokenType.EQUALS, "="],
    [TokenType.NUMBER, "42"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SetStatement;

  const lit = ast.value as Literal;
  assertEquals(lit.value, 42);
});

Deno.test("Parser - parse boolean true literal", () => {
  const tokens = createTokens(
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "flag"],
    [TokenType.EQUALS, "="],
    [TokenType.BOOLEAN, "true"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SetStatement;

  const lit = ast.value as Literal;
  assertEquals(lit.value, true);
});

Deno.test("Parser - parse boolean false literal", () => {
  const tokens = createTokens(
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "flag"],
    [TokenType.EQUALS, "="],
    [TokenType.BOOLEAN, "false"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SetStatement;

  const lit = ast.value as Literal;
  assertEquals(lit.value, false);
});

Deno.test("Parser - parse null literal", () => {
  const tokens = createTokens(
    [TokenType.SET, "SET"],
    [TokenType.IDENTIFIER, "data"],
    [TokenType.EQUALS, "="],
    [TokenType.NULL, "null"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SetStatement;

  const lit = ast.value as Literal;
  assertEquals(lit.value, null);
});

// ============================================================================
// Operator Precedence Tests
// ============================================================================

Deno.test("Parser - multiplication before addition", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.NUMBER, "2"],
    [TokenType.PLUS, "+"],
    [TokenType.NUMBER, "3"],
    [TokenType.STAR, "*"],
    [TokenType.NUMBER, "4"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "data"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  const expr = ast.fields[0].expression as BinaryExpression;
  assertEquals(expr.operator, "+");
  // Right side should be 3 * 4
  const right = expr.right as BinaryExpression;
  assertEquals(right.operator, "*");
});

Deno.test("Parser - comparison before logical AND", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.STAR, "*"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "users"],
    [TokenType.WHERE, "WHERE"],
    [TokenType.IDENTIFIER, "age"],
    [TokenType.GREATER, ">"],
    [TokenType.NUMBER, "18"],
    [TokenType.AND, "AND"],
    [TokenType.IDENTIFIER, "active"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  const where = ast.where as BinaryExpression;
  assertEquals(where.operator, "AND");
  const left = where.left as BinaryExpression;
  assertEquals(left.operator, ">");
});

Deno.test("Parser - parentheses override precedence", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.LEFT_PAREN, "("],
    [TokenType.NUMBER, "2"],
    [TokenType.PLUS, "+"],
    [TokenType.NUMBER, "3"],
    [TokenType.RIGHT_PAREN, ")"],
    [TokenType.STAR, "*"],
    [TokenType.NUMBER, "4"],
    [TokenType.FROM, "FROM"],
    [TokenType.IDENTIFIER, "data"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  const expr = ast.fields[0].expression as BinaryExpression;
  assertEquals(expr.operator, "*");
  // Left side should be (2 + 3)
  const left = expr.left as BinaryExpression;
  assertEquals(left.operator, "+");
});

// ============================================================================
// Error Handling Tests
// ============================================================================

Deno.test("Parser - throws on unexpected token", () => {
  const tokens = createTokens(
    [TokenType.COMMA, ","],
    [TokenType.FROM, "FROM"]
  );

  const parser = new Parser(tokens);

  assertThrows(
    () => parser.parse(),
    Error
  );
});

// ============================================================================
// Complex Query Tests
// ============================================================================

Deno.test("Parser - parse complex SELECT with all clauses", () => {
  const tokens = createTokens(
    [TokenType.SELECT, "SELECT"],
    [TokenType.IDENTIFIER, "name"],
    [TokenType.COMMA, ","],
    [TokenType.IDENTIFIER, "age"],
    [TokenType.FROM, "FROM"],
    [TokenType.STRING, "http://api.example.com/users"],
    [TokenType.WHERE, "WHERE"],
    [TokenType.IDENTIFIER, "active"],
    [TokenType.EQUALS, "="],
    [TokenType.BOOLEAN, "true"],
    [TokenType.ORDER, "ORDER"],
    [TokenType.BY, "BY"],
    [TokenType.IDENTIFIER, "name"],
    [TokenType.IDENTIFIER, "ASC"],
    [TokenType.LIMIT, "LIMIT"],
    [TokenType.NUMBER, "10"],
    [TokenType.OFFSET, "OFFSET"],
    [TokenType.NUMBER, "0"]
  );

  const parser = new Parser(tokens);
  const ast = parser.parse() as SelectStatement;

  assertEquals(ast.type, "SELECT");
  assertEquals(ast.fields.length, 2);
  assertExists(ast.where);
  assertExists(ast.orderBy);
  assertExists(ast.limit);
  assertEquals(ast.limit.offset, 0);
});
