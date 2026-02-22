/**
 * Performance tests for large queries
 * Validates that lexing, parsing, and analysis of large/complex queries
 * complete within acceptable time bounds.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { Lexer } from "../../lexer/mod.ts";
import { Parser } from "../../parser/mod.ts";
import { SemanticAnalyzer } from "../../analyzer/mod.ts";

/**
 * Helper: build a multi-SELECT query with N statements separated by semicolons.
 */
function buildMultiSelectQuery(count: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(`SELECT col_${i} FROM "https://example.com/page${i}"`);
  }
  return lines.join(";\n");
}

/**
 * Helper: build a SELECT with many columns.
 */
function buildWideSelect(columnCount: number): string {
  const cols = Array.from({ length: columnCount }, (_, i) => `column_${i}`);
  return `SELECT ${cols.join(", ")} FROM "https://example.com"`;
}

/**
 * Helper: build nested IF/FOR blocks.
 */
function buildNestedBlocks(depth: number): string {
  let query = 'SET url = "https://example.com"\n';
  for (let i = 0; i < depth; i++) {
    query += "  ".repeat(i) + `IF EXISTS("#el_${i}") THEN\n`;
  }
  query += "  ".repeat(depth) + 'SELECT title FROM "https://example.com"\n';
  for (let i = depth - 1; i >= 0; i--) {
    query += "  ".repeat(i) + "END\n";
  }
  return query;
}

Deno.test("large-queries: parse 20-line multi-SELECT completes in < 1000ms", () => {
  const query = buildMultiSelectQuery(20);
  const start = performance.now();

  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  assertExists(tokens);
  assert(tokens.length > 0, "Should produce tokens");

  // Parse the first statement (parser handles one statement at a time)
  const parser = new Parser(tokens);
  const ast = parser.parse();
  assertExists(ast);

  const elapsed = performance.now() - start;
  assert(elapsed < 1000, `Expected < 1000ms but took ${elapsed.toFixed(2)}ms`);
});

Deno.test("large-queries: parse SELECT with 30+ columns completes in < 500ms", () => {
  const query = buildWideSelect(35);
  const start = performance.now();

  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const elapsed = performance.now() - start;
  assertExists(ast);
  assert(elapsed < 500, `Expected < 500ms but took ${elapsed.toFixed(2)}ms`);
});

Deno.test("large-queries: parse nested IF blocks (5 levels) completes in < 600ms", () => {
  const query = buildNestedBlocks(5);
  const start = performance.now();

  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const elapsed = performance.now() - start;
  assertExists(ast);
  assert(elapsed < 600, `Expected < 600ms but took ${elapsed.toFixed(2)}ms`);
});

Deno.test("large-queries: lex a 10KB query string in < 200ms", () => {
  // Build a query string that's at least 10KB
  const baseQuery = 'SELECT title, description, content FROM "https://example.com/page";\n';
  const repeatCount = Math.ceil(10240 / baseQuery.length);
  const largeQuery = baseQuery.repeat(repeatCount);
  assert(largeQuery.length >= 10240, `Query should be >= 10KB, got ${largeQuery.length} bytes`);

  const start = performance.now();
  const lexer = new Lexer(largeQuery);
  const tokens = lexer.tokenize();
  const elapsed = performance.now() - start;

  assertExists(tokens);
  assert(tokens.length > 0, "Should produce tokens");
  assert(elapsed < 200, `Expected < 200ms but took ${elapsed.toFixed(2)}ms`);
});

Deno.test("large-queries: parse + analyze complex query with multiple clauses", () => {
  const query = `SELECT title, description FROM "https://example.com" WHERE status = "active"`;
  const start = performance.now();

  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const analyzer = new SemanticAnalyzer({
    allowUndefinedVariables: true,
    strictTypeChecking: false,
  });
  const result = analyzer.analyze(ast);

  const elapsed = performance.now() - start;
  assertExists(result);
  assertExists(result.ast);
  assert(elapsed < 500, `Expected < 500ms but took ${elapsed.toFixed(2)}ms`);
});

Deno.test("large-queries: memory does not grow excessively for large queries", () => {
  // Force GC if available, otherwise just measure
  const before = Deno.memoryUsage().heapUsed;

  // Parse many queries
  for (let i = 0; i < 100; i++) {
    const query = `SELECT col_${i} FROM "https://example.com/page${i}"`;
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    parser.parse();
  }

  const after = Deno.memoryUsage().heapUsed;
  const growth = after - before;

  // Memory growth should be reasonable (< 50MB for 100 small queries)
  assert(growth < 50 * 1024 * 1024, `Memory grew by ${(growth / 1024 / 1024).toFixed(2)}MB, expected < 50MB`);
});

Deno.test("large-queries: repeated parsing of same query is consistent in timing", () => {
  const query = 'SELECT title, description FROM "https://example.com"';
  const times: number[] = [];

  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    parser.parse();
    times.push(performance.now() - start);
  }

  // All runs should complete and no single run should be > 5x the median
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const maxAllowed = Math.max(median * 5, 50); // At least 50ms threshold to avoid noise

  for (const t of times) {
    assert(t < maxAllowed, `Run took ${t.toFixed(2)}ms, max allowed ${maxAllowed.toFixed(2)}ms (median: ${median.toFixed(2)}ms)`);
  }
});

Deno.test("large-queries: very long string literals handled without hanging", () => {
  const longString = "a".repeat(10000);
  const query = `SELECT title FROM "${longString}"`;

  const start = performance.now();
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const elapsed = performance.now() - start;

  assertExists(tokens);
  assert(tokens.length > 0, "Should produce tokens");
  assert(elapsed < 500, `Expected < 500ms but took ${elapsed.toFixed(2)}ms`);
});

Deno.test("large-queries: SELECT with 50+ columns lexes and parses correctly", () => {
  const query = buildWideSelect(50);
  const start = performance.now();

  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const elapsed = performance.now() - start;
  assertExists(ast);
  assert(elapsed < 1000, `Expected < 1000ms but took ${elapsed.toFixed(2)}ms`);
});
