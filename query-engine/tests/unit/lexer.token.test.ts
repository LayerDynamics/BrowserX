/**
 * Token Tests
 * Comprehensive tests for Token module
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
  TokenType,
  Token,
  Position,
  isKeyword,
  getKeywordType,
  createToken,
} from "../../lexer/token.ts";

// ============================================================================
// TokenType Enum Tests
// ============================================================================

Deno.test("TokenType - contains all keyword types", () => {
  // Keywords
  assertEquals(TokenType.SELECT, "SELECT");
  assertEquals(TokenType.FROM, "FROM");
  assertEquals(TokenType.WHERE, "WHERE");
  assertEquals(TokenType.ORDER, "ORDER");
  assertEquals(TokenType.BY, "BY");
  assertEquals(TokenType.LIMIT, "LIMIT");
  assertEquals(TokenType.OFFSET, "OFFSET");
  assertEquals(TokenType.NAVIGATE, "NAVIGATE");
  assertEquals(TokenType.TO, "TO");
  assertEquals(TokenType.WITH, "WITH");
  assertEquals(TokenType.CAPTURE, "CAPTURE");
  assertEquals(TokenType.SET, "SET");
  assertEquals(TokenType.SHOW, "SHOW");
  assertEquals(TokenType.FOR, "FOR");
  assertEquals(TokenType.EACH, "EACH");
  assertEquals(TokenType.IN, "IN");
  assertEquals(TokenType.IF, "IF");
  assertEquals(TokenType.THEN, "THEN");
  assertEquals(TokenType.ELSE, "ELSE");
  assertEquals(TokenType.INSERT, "INSERT");
  assertEquals(TokenType.INTO, "INTO");
  assertEquals(TokenType.UPDATE, "UPDATE");
  assertEquals(TokenType.DELETE, "DELETE");
  assertEquals(TokenType.AS, "AS");
});

Deno.test("TokenType - contains logical operators", () => {
  assertEquals(TokenType.AND, "AND");
  assertEquals(TokenType.OR, "OR");
  assertEquals(TokenType.NOT, "NOT");
});

Deno.test("TokenType - contains comparison operators", () => {
  assertEquals(TokenType.EQUALS, "EQUALS");
  assertEquals(TokenType.NOT_EQUALS, "NOT_EQUALS");
  assertEquals(TokenType.GREATER, "GREATER");
  assertEquals(TokenType.GREATER_EQ, "GREATER_EQ");
  assertEquals(TokenType.LESS, "LESS");
  assertEquals(TokenType.LESS_EQ, "LESS_EQ");
  assertEquals(TokenType.LIKE, "LIKE");
  assertEquals(TokenType.NOT_LIKE, "NOT_LIKE");
  assertEquals(TokenType.MATCHES, "MATCHES");
  assertEquals(TokenType.CONTAINS, "CONTAINS");
});

Deno.test("TokenType - contains arithmetic operators", () => {
  assertEquals(TokenType.PLUS, "PLUS");
  assertEquals(TokenType.MINUS, "MINUS");
  assertEquals(TokenType.STAR, "STAR");
  assertEquals(TokenType.SLASH, "SLASH");
  assertEquals(TokenType.PERCENT, "PERCENT");
  assertEquals(TokenType.CONCAT, "CONCAT");
});

Deno.test("TokenType - contains literal types", () => {
  assertEquals(TokenType.STRING, "STRING");
  assertEquals(TokenType.NUMBER, "NUMBER");
  assertEquals(TokenType.BOOLEAN, "BOOLEAN");
  assertEquals(TokenType.NULL, "NULL");
});

Deno.test("TokenType - contains identifier type", () => {
  assertEquals(TokenType.IDENTIFIER, "IDENTIFIER");
});

Deno.test("TokenType - contains punctuation types", () => {
  assertEquals(TokenType.LEFT_PAREN, "LEFT_PAREN");
  assertEquals(TokenType.RIGHT_PAREN, "RIGHT_PAREN");
  assertEquals(TokenType.LEFT_BRACE, "LEFT_BRACE");
  assertEquals(TokenType.RIGHT_BRACE, "RIGHT_BRACE");
  assertEquals(TokenType.LEFT_BRACKET, "LEFT_BRACKET");
  assertEquals(TokenType.RIGHT_BRACKET, "RIGHT_BRACKET");
  assertEquals(TokenType.COMMA, "COMMA");
  assertEquals(TokenType.DOT, "DOT");
  assertEquals(TokenType.COLON, "COLON");
  assertEquals(TokenType.SEMICOLON, "SEMICOLON");
  assertEquals(TokenType.ARROW, "ARROW");
});

Deno.test("TokenType - contains special literal types", () => {
  assertEquals(TokenType.URL, "URL");
  assertEquals(TokenType.REGEX, "REGEX");
  assertEquals(TokenType.DURATION, "DURATION");
  assertEquals(TokenType.BYTES, "BYTES");
});

Deno.test("TokenType - contains control flow types", () => {
  assertEquals(TokenType.PARALLEL, "PARALLEL");
  assertEquals(TokenType.BATCH, "BATCH");
  assertEquals(TokenType.STREAM, "STREAM");
  assertEquals(TokenType.RETRY, "RETRY");
});

Deno.test("TokenType - contains query operation types", () => {
  assertEquals(TokenType.CLICK, "CLICK");
  assertEquals(TokenType.TYPE, "TYPE");
  assertEquals(TokenType.WAIT, "WAIT");
  assertEquals(TokenType.SCREENSHOT, "SCREENSHOT");
  assertEquals(TokenType.PDF, "PDF");
  assertEquals(TokenType.EVALUATE, "EVALUATE");
});

Deno.test("TokenType - contains cache operation types", () => {
  assertEquals(TokenType.CACHE, "CACHE");
  assertEquals(TokenType.CACHED, "CACHED");
  assertEquals(TokenType.INVALIDATE, "INVALIDATE");
});

Deno.test("TokenType - contains metadata types", () => {
  assertEquals(TokenType.COOKIES, "COOKIES");
  assertEquals(TokenType.HEADERS, "HEADERS");
  assertEquals(TokenType.CONNECTIONS, "CONNECTIONS");
  assertEquals(TokenType.METRICS, "METRICS");
  assertEquals(TokenType.STATE, "STATE");
});

Deno.test("TokenType - contains special types", () => {
  assertEquals(TokenType.EOF, "EOF");
  assertEquals(TokenType.WHITESPACE, "WHITESPACE");
  assertEquals(TokenType.COMMENT, "COMMENT");
  assertEquals(TokenType.NEWLINE, "NEWLINE");
  assertEquals(TokenType.UNKNOWN, "UNKNOWN");
});

// ============================================================================
// isKeyword Function Tests
// ============================================================================

Deno.test("isKeyword - returns true for SELECT", () => {
  assert(isKeyword("SELECT"));
  assert(isKeyword("select"));
  assert(isKeyword("Select"));
});

Deno.test("isKeyword - returns true for all SQL keywords", () => {
  const keywords = [
    "SELECT", "FROM", "WHERE", "ORDER", "BY", "LIMIT", "OFFSET",
    "NAVIGATE", "TO", "WITH", "CAPTURE", "SET", "SHOW",
    "FOR", "EACH", "IN", "IF", "THEN", "ELSE",
    "INSERT", "INTO", "UPDATE", "DELETE", "AS",
  ];

  for (const keyword of keywords) {
    assert(isKeyword(keyword), `Expected '${keyword}' to be a keyword`);
    assert(isKeyword(keyword.toLowerCase()), `Expected '${keyword.toLowerCase()}' to be a keyword`);
  }
});

Deno.test("isKeyword - returns true for logical operators", () => {
  assert(isKeyword("AND"));
  assert(isKeyword("OR"));
  assert(isKeyword("NOT"));
});

Deno.test("isKeyword - returns true for comparison operators", () => {
  assert(isKeyword("LIKE"));
  assert(isKeyword("MATCHES"));
  assert(isKeyword("CONTAINS"));
});

Deno.test("isKeyword - returns true for boolean literals", () => {
  assert(isKeyword("TRUE"));
  assert(isKeyword("FALSE"));
  assert(isKeyword("true"));
  assert(isKeyword("false"));
});

Deno.test("isKeyword - returns true for NULL", () => {
  assert(isKeyword("NULL"));
  assert(isKeyword("null"));
});

Deno.test("isKeyword - returns true for control flow keywords", () => {
  assert(isKeyword("PARALLEL"));
  assert(isKeyword("BATCH"));
  assert(isKeyword("STREAM"));
  assert(isKeyword("RETRY"));
});

Deno.test("isKeyword - returns true for operation keywords", () => {
  assert(isKeyword("CLICK"));
  assert(isKeyword("TYPE"));
  assert(isKeyword("WAIT"));
  assert(isKeyword("SCREENSHOT"));
  assert(isKeyword("PDF"));
  assert(isKeyword("EVALUATE"));
});

Deno.test("isKeyword - returns true for cache keywords", () => {
  assert(isKeyword("CACHE"));
  assert(isKeyword("CACHED"));
  assert(isKeyword("INVALIDATE"));
});

Deno.test("isKeyword - returns true for metadata keywords", () => {
  assert(isKeyword("COOKIES"));
  assert(isKeyword("HEADERS"));
  assert(isKeyword("CONNECTIONS"));
  assert(isKeyword("METRICS"));
  assert(isKeyword("STATE"));
});

Deno.test("isKeyword - returns false for identifiers", () => {
  assert(!isKeyword("title"));
  assert(!isKeyword("username"));
  assert(!isKeyword("myVariable"));
  assert(!isKeyword("foo"));
  assert(!isKeyword("bar"));
});

Deno.test("isKeyword - returns false for numbers", () => {
  assert(!isKeyword("123"));
  assert(!isKeyword("0"));
  assert(!isKeyword("3.14"));
});

Deno.test("isKeyword - returns false for operators", () => {
  assert(!isKeyword("+"));
  assert(!isKeyword("-"));
  assert(!isKeyword("*"));
  assert(!isKeyword("="));
  assert(!isKeyword("!="));
});

// ============================================================================
// getKeywordType Function Tests
// ============================================================================

Deno.test("getKeywordType - returns SELECT for 'SELECT'", () => {
  assertEquals(getKeywordType("SELECT"), TokenType.SELECT);
  assertEquals(getKeywordType("select"), TokenType.SELECT);
});

Deno.test("getKeywordType - returns correct type for all keywords", () => {
  assertEquals(getKeywordType("FROM"), TokenType.FROM);
  assertEquals(getKeywordType("WHERE"), TokenType.WHERE);
  assertEquals(getKeywordType("ORDER"), TokenType.ORDER);
  assertEquals(getKeywordType("BY"), TokenType.BY);
  assertEquals(getKeywordType("LIMIT"), TokenType.LIMIT);
  assertEquals(getKeywordType("OFFSET"), TokenType.OFFSET);
  assertEquals(getKeywordType("NAVIGATE"), TokenType.NAVIGATE);
  assertEquals(getKeywordType("TO"), TokenType.TO);
  assertEquals(getKeywordType("WITH"), TokenType.WITH);
  assertEquals(getKeywordType("CAPTURE"), TokenType.CAPTURE);
  assertEquals(getKeywordType("SET"), TokenType.SET);
  assertEquals(getKeywordType("SHOW"), TokenType.SHOW);
  assertEquals(getKeywordType("FOR"), TokenType.FOR);
  assertEquals(getKeywordType("EACH"), TokenType.EACH);
  assertEquals(getKeywordType("IN"), TokenType.IN);
  assertEquals(getKeywordType("IF"), TokenType.IF);
  assertEquals(getKeywordType("THEN"), TokenType.THEN);
  assertEquals(getKeywordType("ELSE"), TokenType.ELSE);
  assertEquals(getKeywordType("INSERT"), TokenType.INSERT);
  assertEquals(getKeywordType("INTO"), TokenType.INTO);
  assertEquals(getKeywordType("UPDATE"), TokenType.UPDATE);
  assertEquals(getKeywordType("DELETE"), TokenType.DELETE);
  assertEquals(getKeywordType("AS"), TokenType.AS);
});

Deno.test("getKeywordType - returns BOOLEAN for TRUE and FALSE", () => {
  assertEquals(getKeywordType("TRUE"), TokenType.BOOLEAN);
  assertEquals(getKeywordType("FALSE"), TokenType.BOOLEAN);
  assertEquals(getKeywordType("true"), TokenType.BOOLEAN);
  assertEquals(getKeywordType("false"), TokenType.BOOLEAN);
});

Deno.test("getKeywordType - returns correct type for logical operators", () => {
  assertEquals(getKeywordType("AND"), TokenType.AND);
  assertEquals(getKeywordType("OR"), TokenType.OR);
  assertEquals(getKeywordType("NOT"), TokenType.NOT);
});

Deno.test("getKeywordType - returns IDENTIFIER for non-keywords", () => {
  assertEquals(getKeywordType("title"), TokenType.IDENTIFIER);
  assertEquals(getKeywordType("username"), TokenType.IDENTIFIER);
  assertEquals(getKeywordType("myVar"), TokenType.IDENTIFIER);
});

Deno.test("getKeywordType - is case insensitive", () => {
  assertEquals(getKeywordType("select"), TokenType.SELECT);
  assertEquals(getKeywordType("SELECT"), TokenType.SELECT);
  assertEquals(getKeywordType("Select"), TokenType.SELECT);
  assertEquals(getKeywordType("sElEcT"), TokenType.SELECT);
});

// ============================================================================
// createToken Function Tests
// ============================================================================

Deno.test("createToken - creates token with all properties", () => {
  const token = createToken(TokenType.SELECT, "SELECT", 1, 1, 0);

  assertEquals(token.type, TokenType.SELECT);
  assertEquals(token.value, "SELECT");
  assertEquals(token.line, 1);
  assertEquals(token.column, 1);
  assertEquals(token.offset, 0);
});

Deno.test("createToken - creates token for string literal", () => {
  const token = createToken(TokenType.STRING, '"hello world"', 1, 10, 9);

  assertEquals(token.type, TokenType.STRING);
  assertEquals(token.value, '"hello world"');
  assertEquals(token.line, 1);
  assertEquals(token.column, 10);
  assertEquals(token.offset, 9);
});

Deno.test("createToken - creates token for number literal", () => {
  const token = createToken(TokenType.NUMBER, "42", 3, 5, 25);

  assertEquals(token.type, TokenType.NUMBER);
  assertEquals(token.value, "42");
  assertEquals(token.line, 3);
  assertEquals(token.column, 5);
  assertEquals(token.offset, 25);
});

Deno.test("createToken - creates token for identifier", () => {
  const token = createToken(TokenType.IDENTIFIER, "myVariable", 2, 1, 15);

  assertEquals(token.type, TokenType.IDENTIFIER);
  assertEquals(token.value, "myVariable");
  assertEquals(token.line, 2);
  assertEquals(token.column, 1);
  assertEquals(token.offset, 15);
});

Deno.test("createToken - creates token for operators", () => {
  const plus = createToken(TokenType.PLUS, "+", 1, 5, 4);
  const equals = createToken(TokenType.EQUALS, "=", 1, 7, 6);

  assertEquals(plus.type, TokenType.PLUS);
  assertEquals(plus.value, "+");
  assertEquals(equals.type, TokenType.EQUALS);
  assertEquals(equals.value, "=");
});

Deno.test("createToken - creates EOF token", () => {
  const token = createToken(TokenType.EOF, "", 10, 1, 150);

  assertEquals(token.type, TokenType.EOF);
  assertEquals(token.value, "");
  assertEquals(token.line, 10);
  assertEquals(token.column, 1);
  assertEquals(token.offset, 150);
});

// ============================================================================
// Token Interface Tests
// ============================================================================

Deno.test("Token - interface has required properties", () => {
  const token: Token = {
    type: TokenType.SELECT,
    value: "SELECT",
    line: 1,
    column: 1,
    offset: 0,
  };

  assertExists(token.type);
  assertExists(token.value);
  assertExists(token.line);
  assertExists(token.column);
  assertEquals(typeof token.offset, "number");
});

Deno.test("Token - can represent complex token", () => {
  const token: Token = {
    type: TokenType.URL,
    value: "https://example.com/path?query=value",
    line: 5,
    column: 15,
    offset: 100,
  };

  assertEquals(token.type, TokenType.URL);
  assertEquals(token.value, "https://example.com/path?query=value");
});

// ============================================================================
// Position Interface Tests
// ============================================================================

Deno.test("Position - interface has required properties", () => {
  const pos: Position = {
    line: 1,
    column: 1,
    offset: 0,
  };

  assertEquals(pos.line, 1);
  assertEquals(pos.column, 1);
  assertEquals(pos.offset, 0);
});

Deno.test("Position - tracks multi-line positions", () => {
  const pos: Position = {
    line: 25,
    column: 30,
    offset: 500,
  };

  assertEquals(pos.line, 25);
  assertEquals(pos.column, 30);
  assertEquals(pos.offset, 500);
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

Deno.test("isKeyword - handles empty string", () => {
  assert(!isKeyword(""));
});

Deno.test("isKeyword - handles whitespace", () => {
  assert(!isKeyword(" "));
  assert(!isKeyword("  SELECT"));
  assert(!isKeyword("SELECT  "));
});

Deno.test("getKeywordType - handles empty string", () => {
  assertEquals(getKeywordType(""), TokenType.IDENTIFIER);
});

Deno.test("createToken - handles zero position", () => {
  const token = createToken(TokenType.IDENTIFIER, "x", 0, 0, 0);

  assertEquals(token.line, 0);
  assertEquals(token.column, 0);
  assertEquals(token.offset, 0);
});

Deno.test("createToken - handles large position values", () => {
  const token = createToken(TokenType.IDENTIFIER, "x", 10000, 500, 1000000);

  assertEquals(token.line, 10000);
  assertEquals(token.column, 500);
  assertEquals(token.offset, 1000000);
});

Deno.test("createToken - handles special characters in value", () => {
  const token = createToken(TokenType.STRING, '"hello\\nworld"', 1, 1, 0);

  assertEquals(token.value, '"hello\\nworld"');
});

Deno.test("createToken - handles unicode in value", () => {
  const token = createToken(TokenType.STRING, '"你好世界"', 1, 1, 0);

  assertEquals(token.value, '"你好世界"');
});

// ============================================================================
// TokenType Coverage - All 80+ Types
// ============================================================================

Deno.test("TokenType - has at least 80 types", () => {
  const types = Object.keys(TokenType);
  assert(types.length >= 80, `Expected at least 80 token types, got ${types.length}`);
});

Deno.test("TokenType - all values are unique", () => {
  const values = Object.values(TokenType);
  const uniqueValues = new Set(values);
  assertEquals(values.length, uniqueValues.size, "TokenType enum should have unique values");
});
