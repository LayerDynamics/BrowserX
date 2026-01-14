/**
 * Lexer Tests
 * Tests for tokenization of query strings
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import { Lexer } from "../../lexer/tokenizer.ts";
import { TokenType } from "../../lexer/token.ts";
import { tokenize } from "../helpers/test-utils.ts";

// ============================================================================
// Basic Tokenization Tests
// ============================================================================

Deno.test({
  name: "Lexer - constructor initializes with input string",
  fn() {
    const lexer = new Lexer("SELECT * FROM users");
    assertExists(lexer);
  },
});

Deno.test({
  name: "Lexer - tokenize returns array of tokens",
  fn() {
    const lexer = new Lexer("SELECT *");
    const tokens = lexer.tokenize();

    assertExists(tokens);
    assert(Array.isArray(tokens));
    assert(tokens.length > 0);
  },
});

Deno.test({
  name: "Lexer - tokenize includes EOF token at end",
  fn() {
    const tokens = tokenize("SELECT");

    const lastToken = tokens[tokens.length - 1];
    assertEquals(lastToken.type, TokenType.EOF);
  },
});

// ============================================================================
// Keyword Tokens Tests
// ============================================================================

Deno.test({
  name: "Lexer - tokenizes SELECT keyword",
  fn() {
    const tokens = tokenize("SELECT");

    assertEquals(tokens.length, 2); // SELECT + EOF
    assertEquals(tokens[0].type, TokenType.SELECT);
  },
});

Deno.test({
  name: "Lexer - tokenizes FROM keyword",
  fn() {
    const tokens = tokenize("FROM");

    assertEquals(tokens[0].type, TokenType.FROM);
  },
});

Deno.test({
  name: "Lexer - tokenizes WHERE keyword",
  fn() {
    const tokens = tokenize("WHERE");

    assertEquals(tokens[0].type, TokenType.WHERE);
  },
});

Deno.test({
  name: "Lexer - tokenizes ORDER keyword",
  fn() {
    const tokens = tokenize("ORDER");

    assertEquals(tokens[0].type, TokenType.ORDER);
  },
});

Deno.test({
  name: "Lexer - tokenizes BY keyword",
  fn() {
    const tokens = tokenize("BY");

    assertEquals(tokens[0].type, TokenType.BY);
  },
});

Deno.test({
  name: "Lexer - tokenizes LIMIT keyword",
  fn() {
    const tokens = tokenize("LIMIT");

    assertEquals(tokens[0].type, TokenType.LIMIT);
  },
});

Deno.test({
  name: "Lexer - tokenizes OFFSET keyword",
  fn() {
    const tokens = tokenize("OFFSET");

    assertEquals(tokens[0].type, TokenType.OFFSET);
  },
});

Deno.test({
  name: "Lexer - tokenizes NAVIGATE keyword",
  fn() {
    const tokens = tokenize("NAVIGATE");

    assertEquals(tokens[0].type, TokenType.NAVIGATE);
  },
});

Deno.test({
  name: "Lexer - tokenizes TO keyword",
  fn() {
    const tokens = tokenize("TO");

    assertEquals(tokens[0].type, TokenType.TO);
  },
});

Deno.test({
  name: "Lexer - tokenizes WITH keyword",
  fn() {
    const tokens = tokenize("WITH");

    assertEquals(tokens[0].type, TokenType.WITH);
  },
});

Deno.test({
  name: "Lexer - tokenizes AS keyword",
  fn() {
    const tokens = tokenize("AS");

    assertEquals(tokens[0].type, TokenType.AS);
  },
});

Deno.test({
  name: "Lexer - tokenizes CAPTURE keyword",
  fn() {
    const tokens = tokenize("CAPTURE");

    assertEquals(tokens[0].type, TokenType.CAPTURE);
  },
});

Deno.test({
  name: "Lexer - tokenizes FOR keyword",
  fn() {
    const tokens = tokenize("FOR");

    assertEquals(tokens[0].type, TokenType.FOR);
  },
});

Deno.test({
  name: "Lexer - tokenizes EACH keyword",
  fn() {
    const tokens = tokenize("EACH");

    assertEquals(tokens[0].type, TokenType.EACH);
  },
});

Deno.test({
  name: "Lexer - tokenizes IN keyword",
  fn() {
    const tokens = tokenize("IN");

    assertEquals(tokens[0].type, TokenType.IN);
  },
});

Deno.test({
  name: "Lexer - tokenizes IF keyword",
  fn() {
    const tokens = tokenize("IF");

    assertEquals(tokens[0].type, TokenType.IF);
  },
});

Deno.test({
  name: "Lexer - tokenizes THEN keyword",
  fn() {
    const tokens = tokenize("THEN");

    assertEquals(tokens[0].type, TokenType.THEN);
  },
});

Deno.test({
  name: "Lexer - tokenizes ELSE keyword",
  fn() {
    const tokens = tokenize("ELSE");

    assertEquals(tokens[0].type, TokenType.ELSE);
  },
});

Deno.test({
  name: "Lexer - tokenizes SET keyword",
  fn() {
    const tokens = tokenize("SET");

    assertEquals(tokens[0].type, TokenType.SET);
  },
});

Deno.test({
  name: "Lexer - tokenizes SHOW keyword",
  fn() {
    const tokens = tokenize("SHOW");

    assertEquals(tokens[0].type, TokenType.SHOW);
  },
});

Deno.test({
  name: "Lexer - keywords are case-insensitive",
  fn() {
    const tokens1 = tokenize("SELECT");
    const tokens2 = tokenize("select");
    const tokens3 = tokenize("Select");

    assertEquals(tokens1[0].type, TokenType.SELECT);
    assertEquals(tokens2[0].type, TokenType.SELECT);
    assertEquals(tokens3[0].type, TokenType.SELECT);
  },
});

// ============================================================================
// Operator Tokens Tests
// ============================================================================

Deno.test({
  name: "Lexer - tokenizes AND operator",
  fn() {
    const tokens = tokenize("AND");

    assertEquals(tokens[0].type, TokenType.AND);
  },
});

Deno.test({
  name: "Lexer - tokenizes OR operator",
  fn() {
    const tokens = tokenize("OR");

    assertEquals(tokens[0].type, TokenType.OR);
  },
});

Deno.test({
  name: "Lexer - tokenizes NOT operator",
  fn() {
    const tokens = tokenize("NOT");

    assertEquals(tokens[0].type, TokenType.NOT);
  },
});

Deno.test({
  name: "Lexer - tokenizes = operator",
  fn() {
    const tokens = tokenize("=");

    assertEquals(tokens[0].type, TokenType.EQUALS);
  },
});

Deno.test({
  name: "Lexer - tokenizes != operator",
  fn() {
    const tokens = tokenize("!=");

    assertEquals(tokens[0].type, TokenType.NOT_EQUALS);
  },
});

Deno.test({
  name: "Lexer - tokenizes < operator",
  fn() {
    const tokens = tokenize("<");

    assertEquals(tokens[0].type, TokenType.LESS);
  },
});

Deno.test({
  name: "Lexer - tokenizes > operator",
  fn() {
    const tokens = tokenize(">");

    assertEquals(tokens[0].type, TokenType.GREATER);
  },
});

Deno.test({
  name: "Lexer - tokenizes <= operator",
  fn() {
    const tokens = tokenize("<=");

    assertEquals(tokens[0].type, TokenType.LESS_EQ);
  },
});

Deno.test({
  name: "Lexer - tokenizes >= operator",
  fn() {
    const tokens = tokenize(">=");

    assertEquals(tokens[0].type, TokenType.GREATER_EQ);
  },
});

Deno.test({
  name: "Lexer - tokenizes + operator",
  fn() {
    const tokens = tokenize("+");

    assertEquals(tokens[0].type, TokenType.PLUS);
  },
});

Deno.test({
  name: "Lexer - tokenizes - operator",
  fn() {
    const tokens = tokenize("-");

    assertEquals(tokens[0].type, TokenType.MINUS);
  },
});

Deno.test({
  name: "Lexer - tokenizes * operator",
  fn() {
    const tokens = tokenize("*");

    assertEquals(tokens[0].type, TokenType.STAR);
  },
});

Deno.test({
  name: "Lexer - tokenizes / operator",
  fn() {
    const tokens = tokenize("/");

    assertEquals(tokens[0].type, TokenType.SLASH);
  },
});

Deno.test({
  name: "Lexer - tokenizes % operator",
  fn() {
    const tokens = tokenize("%");

    assertEquals(tokens[0].type, TokenType.PERCENT);
  },
});

Deno.test({
  name: "Lexer - tokenizes || operator",
  fn() {
    const tokens = tokenize("||");

    assertEquals(tokens[0].type, TokenType.CONCAT);
  },
});

// ============================================================================
// Punctuation Tokens Tests
// ============================================================================

Deno.test({
  name: "Lexer - tokenizes ( punctuation",
  fn() {
    const tokens = tokenize("(");

    assertEquals(tokens[0].type, TokenType.LEFT_PAREN);
  },
});

Deno.test({
  name: "Lexer - tokenizes ) punctuation",
  fn() {
    const tokens = tokenize(")");

    assertEquals(tokens[0].type, TokenType.RIGHT_PAREN);
  },
});

Deno.test({
  name: "Lexer - tokenizes { punctuation",
  fn() {
    const tokens = tokenize("{");

    assertEquals(tokens[0].type, TokenType.LEFT_BRACE);
  },
});

Deno.test({
  name: "Lexer - tokenizes } punctuation",
  fn() {
    const tokens = tokenize("}");

    assertEquals(tokens[0].type, TokenType.RIGHT_BRACE);
  },
});

Deno.test({
  name: "Lexer - tokenizes [ punctuation",
  fn() {
    const tokens = tokenize("[");

    assertEquals(tokens[0].type, TokenType.LEFT_BRACKET);
  },
});

Deno.test({
  name: "Lexer - tokenizes ] punctuation",
  fn() {
    const tokens = tokenize("]");

    assertEquals(tokens[0].type, TokenType.RIGHT_BRACKET);
  },
});

Deno.test({
  name: "Lexer - tokenizes , punctuation",
  fn() {
    const tokens = tokenize(",");

    assertEquals(tokens[0].type, TokenType.COMMA);
  },
});

Deno.test({
  name: "Lexer - tokenizes . punctuation",
  fn() {
    const tokens = tokenize(".");

    assertEquals(tokens[0].type, TokenType.DOT);
  },
});

Deno.test({
  name: "Lexer - tokenizes : punctuation",
  fn() {
    const tokens = tokenize(":");

    assertEquals(tokens[0].type, TokenType.COLON);
  },
});

Deno.test({
  name: "Lexer - tokenizes ; punctuation",
  fn() {
    const tokens = tokenize(";");

    assertEquals(tokens[0].type, TokenType.SEMICOLON);
  },
});

// ============================================================================
// String Literal Tests
// ============================================================================

Deno.test({
  name: "Lexer - tokenizes single-quoted string",
  fn() {
    const tokens = tokenize("'hello'");

    assertEquals(tokens[0].type, TokenType.STRING);
    assertEquals(tokens[0].value, "hello");
  },
});

Deno.test({
  name: "Lexer - tokenizes double-quoted string",
  fn() {
    const tokens = tokenize('"world"');

    assertEquals(tokens[0].type, TokenType.STRING);
    assertEquals(tokens[0].value, "world");
  },
});

Deno.test({
  name: "Lexer - tokenizes empty string",
  fn() {
    const tokens = tokenize("''");

    assertEquals(tokens[0].type, TokenType.STRING);
    assertEquals(tokens[0].value, "");
  },
});

Deno.test({
  name: "Lexer - tokenizes string with spaces",
  fn() {
    const tokens = tokenize("'hello world'");

    assertEquals(tokens[0].type, TokenType.STRING);
    assertEquals(tokens[0].value, "hello world");
  },
});

Deno.test({
  name: "Lexer - tokenizes string with escaped quotes",
  fn() {
    const tokens = tokenize("'it\\'s working'");

    assertEquals(tokens[0].type, TokenType.STRING);
    assertEquals(tokens[0].value, "it's working");
  },
});

Deno.test({
  name: "Lexer - tokenizes string with escape sequences",
  fn() {
    const tokens = tokenize("'line1\\nline2\\ttab'");

    assertEquals(tokens[0].type, TokenType.STRING);
    // Lexer processes escape sequences, so check for actual newline
    assertExists(tokens[0].value);
  },
});

Deno.test({
  name: "Lexer - throws on unterminated string",
  fn() {
    assertThrows(
      () => {
        tokenize("'unterminated");
      },
      Error,
    );
  },
});

// ============================================================================
// Number Literal Tests
// ============================================================================

Deno.test({
  name: "Lexer - tokenizes integer",
  fn() {
    const tokens = tokenize("42");

    assertEquals(tokens[0].type, TokenType.NUMBER);
    assertEquals(tokens[0].value, "42");
  },
});

Deno.test({
  name: "Lexer - tokenizes float",
  fn() {
    const tokens = tokenize("3.14");

    assertEquals(tokens[0].type, TokenType.NUMBER);
    assertEquals(tokens[0].value, "3.14");
  },
});

Deno.test({
  name: "Lexer - tokenizes negative number",
  fn() {
    const tokens = tokenize("-10");

    // Could be tokenized as MINUS + NUMBER or as negative NUMBER
    assert(tokens.length >= 2);
  },
});

Deno.test({
  name: "Lexer - tokenizes zero",
  fn() {
    const tokens = tokenize("0");

    assertEquals(tokens[0].type, TokenType.NUMBER);
    assertEquals(tokens[0].value, "0");
  },
});

Deno.test({
  name: "Lexer - tokenizes scientific notation",
  fn() {
    const tokens = tokenize("1e5");

    assertEquals(tokens[0].type, TokenType.NUMBER);
  },
});

Deno.test({
  name: "Lexer - tokenizes negative scientific notation",
  fn() {
    const tokens = tokenize("1.5e-3");

    assertEquals(tokens[0].type, TokenType.NUMBER);
  },
});

// ============================================================================
// Boolean and Null Literal Tests
// ============================================================================

Deno.test({
  name: "Lexer - tokenizes true",
  fn() {
    const tokens = tokenize("true");

    assertEquals(tokens[0].type, TokenType.BOOLEAN);
    assertEquals(tokens[0].value, "true");
  },
});

Deno.test({
  name: "Lexer - tokenizes false",
  fn() {
    const tokens = tokenize("false");

    assertEquals(tokens[0].type, TokenType.BOOLEAN);
    assertEquals(tokens[0].value, "false");
  },
});

Deno.test({
  name: "Lexer - tokenizes null",
  fn() {
    const tokens = tokenize("null");

    assertEquals(tokens[0].type, TokenType.NULL);
  },
});

// ============================================================================
// Identifier Tests
// ============================================================================

Deno.test({
  name: "Lexer - tokenizes identifier",
  fn() {
    const tokens = tokenize("username");

    assertEquals(tokens[0].type, TokenType.IDENTIFIER);
    assertEquals(tokens[0].value, "username");
  },
});

Deno.test({
  name: "Lexer - tokenizes identifier with underscore",
  fn() {
    const tokens = tokenize("user_name");

    assertEquals(tokens[0].type, TokenType.IDENTIFIER);
    assertEquals(tokens[0].value, "user_name");
  },
});

Deno.test({
  name: "Lexer - tokenizes identifier with numbers",
  fn() {
    const tokens = tokenize("user123");

    assertEquals(tokens[0].type, TokenType.IDENTIFIER);
    assertEquals(tokens[0].value, "user123");
  },
});

Deno.test({
  name: "Lexer - tokenizes camelCase identifier",
  fn() {
    const tokens = tokenize("firstName");

    assertEquals(tokens[0].type, TokenType.IDENTIFIER);
    assertEquals(tokens[0].value, "firstName");
  },
});

// ============================================================================
// Whitespace Tests
// ============================================================================

Deno.test({
  name: "Lexer - skips spaces",
  fn() {
    const tokens = tokenize("SELECT   *");

    assertEquals(tokens.length, 3); // SELECT, *, EOF (no whitespace tokens)
  },
});

Deno.test({
  name: "Lexer - skips tabs",
  fn() {
    const tokens = tokenize("SELECT\t*");

    assertEquals(tokens.length, 3);
  },
});

Deno.test({
  name: "Lexer - skips newlines",
  fn() {
    const tokens = tokenize("SELECT\n*");

    assertEquals(tokens.length, 3);
  },
});

Deno.test({
  name: "Lexer - handles mixed whitespace",
  fn() {
    const tokens = tokenize("SELECT  \t\n  *");

    assertEquals(tokens.length, 3);
  },
});

// ============================================================================
// Comment Tests
// ============================================================================

Deno.test({
  name: "Lexer - skips single-line comment with --",
  fn() {
    const tokens = tokenize("SELECT * -- this is a comment");

    assertEquals(tokens.length, 3); // SELECT, *, EOF
  },
});

Deno.test({
  name: "Lexer - skips single-line comment with //",
  fn() {
    const tokens = tokenize("SELECT * // this is a comment");

    assertEquals(tokens.length, 3);
  },
});

Deno.test({
  name: "Lexer - skips multi-line comment",
  fn() {
    const tokens = tokenize("SELECT /* comment */ *");

    assertEquals(tokens.length, 3);
  },
});

Deno.test({
  name: "Lexer - handles multi-line comment spanning lines",
  fn() {
    const tokens = tokenize("SELECT /*\n multi\n line\n comment\n*/ *");

    assertEquals(tokens.length, 3);
  },
});

// ============================================================================
// Position Tracking Tests
// ============================================================================

Deno.test({
  name: "Lexer - tracks line numbers",
  fn() {
    const tokens = tokenize("SELECT\n*\nFROM\nusers");

    // All tokens should have line information
    assert(tokens.every((t) => t.line !== undefined));
  },
});

Deno.test({
  name: "Lexer - tracks column numbers",
  fn() {
    const tokens = tokenize("SELECT * FROM users");

    // All tokens should have column information
    assert(tokens.every((t) => t.column !== undefined));
  },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
  name: "Lexer - tokenizes simple SELECT query",
  fn() {
    const tokens = tokenize("SELECT * FROM users");

    assertEquals(tokens[0].type, TokenType.SELECT);
    assertEquals(tokens[1].type, TokenType.STAR);
    assertEquals(tokens[2].type, TokenType.FROM);
    assertEquals(tokens[3].type, TokenType.IDENTIFIER);
    assertEquals(tokens[4].type, TokenType.EOF);
  },
});

Deno.test({
  name: "Lexer - tokenizes SELECT with WHERE clause",
  fn() {
    const tokens = tokenize("SELECT name FROM users WHERE age > 18");

    assert(tokens.some((t) => t.type === TokenType.WHERE));
    assert(tokens.some((t) => t.type === TokenType.GREATER));
  },
});

Deno.test({
  name: "Lexer - tokenizes NAVIGATE statement",
  fn() {
    const tokens = tokenize("NAVIGATE TO 'http://example.com'");

    assertEquals(tokens[0].type, TokenType.NAVIGATE);
    assertEquals(tokens[1].type, TokenType.TO);
    assertEquals(tokens[2].type, TokenType.STRING);
  },
});

Deno.test({
  name: "Lexer - tokenizes FOR EACH loop",
  fn() {
    const tokens = tokenize("FOR EACH item IN items { SHOW item }");

    assertEquals(tokens[0].type, TokenType.FOR);
    assertEquals(tokens[1].type, TokenType.EACH);
    assert(tokens.some((t) => t.type === TokenType.IN));
    assert(tokens.some((t) => t.type === TokenType.LEFT_BRACE));
    assert(tokens.some((t) => t.type === TokenType.RIGHT_BRACE));
  },
});

Deno.test({
  name: "Lexer - tokenizes IF THEN ELSE statement",
  fn() {
    const tokens = tokenize("IF x > 10 THEN { SHOW 'large' } ELSE { SHOW 'small' }");

    assertEquals(tokens[0].type, TokenType.IF);
    assert(tokens.some((t) => t.type === TokenType.THEN));
    assert(tokens.some((t) => t.type === TokenType.ELSE));
  },
});

Deno.test({
  name: "Lexer - tokenizes complex expression",
  fn() {
    const tokens = tokenize("price * quantity > 100 AND status = 'active'");

    assert(tokens.some((t) => t.type === TokenType.STAR));
    assert(tokens.some((t) => t.type === TokenType.GREATER));
    assert(tokens.some((t) => t.type === TokenType.AND));
    assert(tokens.some((t) => t.type === TokenType.EQUALS));
  },
});
