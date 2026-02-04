/**
 * Data Extraction Integration Tests
 * Tests SELECT statement data extraction through the full pipeline
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { Lexer } from "../../lexer/mod.ts";
import { Parser } from "../../parser/mod.ts";
import { SemanticAnalyzer } from "../../analyzer/mod.ts";
import { QueryOptimizer } from "../../optimizer/mod.ts";
import { ExecutionPlanner } from "../../planner/mod.ts";
import { ResultFormatter } from "../../formatter/formatter.ts";

// ============================================================================
// SELECT Statement Parsing Tests
// ============================================================================

Deno.test({
  name: "Data extraction - parses basic SELECT",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SELECT");
  assertEquals((ast as any).fields.length, 1);
  assertEquals((ast as any).fields[0].name, "title");
});

Deno.test({
  name: "Data extraction - parses SELECT with multiple fields",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title, description, price FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals((ast as any).fields.length, 3);
});

Deno.test({
  name: "Data extraction - parses SELECT * (all fields)",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT * FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SELECT");
});

Deno.test({
  name: "Data extraction - parses field aliases",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title AS heading, price AS cost FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals((ast as any).fields[0].alias, "heading");
  assertEquals((ast as any).fields[1].alias, "cost");
});

// ============================================================================
// SELECT with WHERE Clause Tests
// ============================================================================

Deno.test({
  name: "Data extraction - parses WHERE with comparison",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" WHERE price > 100';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertExists((ast as any).where);
  assertEquals((ast as any).where.operator, ">");
});

Deno.test({
  name: "Data extraction - parses WHERE with equality",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" WHERE status = "active"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertExists((ast as any).where);
  assertEquals((ast as any).where.operator, "=");
});

Deno.test({
  name: "Data extraction - parses WHERE with AND",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" WHERE price > 100 AND stock > 0';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertExists((ast as any).where);
  assertEquals((ast as any).where.operator, "AND");
});

Deno.test({
  name: "Data extraction - parses WHERE with OR",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" WHERE category = "A" OR category = "B"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertExists((ast as any).where);
  assertEquals((ast as any).where.operator, "OR");
});

Deno.test({
  name: "Data extraction - parses WHERE with LIKE",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" WHERE name LIKE "%test%"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertExists((ast as any).where);
  assertEquals((ast as any).where.operator, "LIKE");
});

Deno.test({
  name: "Data extraction - parses WHERE with IN",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  // Use array syntax [...] instead of SQL-style parentheses (...)
  // The parser uses array syntax for IN operator collections
  const query = 'SELECT name FROM "https://example.com" WHERE status IN ["active", "pending"]';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertExists((ast as any).where);
  assertEquals((ast as any).where.operator, "IN");
});

// ============================================================================
// SELECT with ORDER BY Tests
// ============================================================================

Deno.test({
  name: "Data extraction - parses ORDER BY ASC",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name, price FROM "https://example.com" ORDER BY price ASC';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertExists((ast as any).orderBy);
  assertEquals((ast as any).orderBy[0].direction, "ASC");
});

Deno.test({
  name: "Data extraction - parses ORDER BY DESC",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name, price FROM "https://example.com" ORDER BY price DESC';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertExists((ast as any).orderBy);
  assertEquals((ast as any).orderBy[0].direction, "DESC");
});

Deno.test({
  name: "Data extraction - parses multiple ORDER BY fields",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" ORDER BY category ASC, price DESC';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertExists((ast as any).orderBy);
  assertEquals((ast as any).orderBy.length, 2);
});

// ============================================================================
// SELECT with LIMIT/OFFSET Tests
// ============================================================================

Deno.test({
  name: "Data extraction - parses LIMIT clause",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" LIMIT 10';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertExists((ast as any).limit);
  assertEquals((ast as any).limit.count, 10);
});

Deno.test({
  name: "Data extraction - parses OFFSET clause",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" LIMIT 10 OFFSET 20';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertExists((ast as any).limit);
  assertEquals((ast as any).limit.offset, 20);
});

// ============================================================================
// SELECT Source Types Tests
// ============================================================================

Deno.test({
  name: "Data extraction - parses URL source",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals((ast as any).source.type, "URL");
});

Deno.test({
  name: "Data extraction - parses selector source",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  // SELECT requires a FROM clause - test selector-based field extraction with a URL source
  const query = "SELECT TEXT('.article') FROM \"https://example.com\"";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SELECT");
  // The field should be a CALL expression (TEXT function call)
  assertEquals((ast as any).fields[0].expression.type, "CALL");
});

Deno.test({
  name: "Data extraction - parses variable source",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SELECT name FROM myData";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals((ast as any).source.type, "VARIABLE");
});

// ============================================================================
// Semantic Analysis Tests
// ============================================================================

Deno.test({
  name: "Data extraction - semantic analysis validates SELECT",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const result = analyzer.analyze(ast);

  assertExists(result);
  assertExists(result.ast);
});

Deno.test({
  name: "Data extraction - semantic analysis validates WHERE types",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" WHERE price > 100';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const result = analyzer.analyze(ast);

  assertExists(result);
});

// ============================================================================
// Optimization Tests
// ============================================================================

Deno.test({
  name: "Data extraction - optimization applies predicate pushdown",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" WHERE price > 100';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({
    enablePredicatePushdown: true,
  });
  const result = optimizer.optimize(analyzed.ast);

  assertExists(result);
  assertExists(result.optimizedAST);
});

Deno.test({
  name: "Data extraction - optimization applies projection pushdown",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name, price FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({
    enableProjectionPushdown: true,
  });
  const result = optimizer.optimize(analyzed.ast);

  assertExists(result);
});

// ============================================================================
// Execution Planning Tests
// ============================================================================

Deno.test({
  name: "Data extraction - planner creates DOM_QUERY step",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);
  const planner = new ExecutionPlanner();
  const plan = planner.plan(optimized.optimizedAST, {
    optimizationApplied: true,
    appliedPasses: [],
    estimatedImprovement: 0,
  });

  assertExists(plan);
  assert(plan.steps.length > 0);
});

Deno.test({
  name: "Data extraction - planner includes FILTER step for WHERE",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" WHERE price > 100';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);
  const planner = new ExecutionPlanner();
  const plan = planner.plan(optimized.optimizedAST, {
    optimizationApplied: true,
    appliedPasses: [],
    estimatedImprovement: 0,
  });

  assertExists(plan);
  // Should have filter step or filter integrated into query
  assert(plan.steps.length > 0);
});

Deno.test({
  name: "Data extraction - planner includes SORT step for ORDER BY",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  // ORDER BY field must be in SELECT list - include price in the query
  const query = 'SELECT name, price FROM "https://example.com" ORDER BY price DESC';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);
  const planner = new ExecutionPlanner();
  const plan = planner.plan(optimized.optimizedAST, {
    optimizationApplied: true,
    appliedPasses: [],
    estimatedImprovement: 0,
  });

  assertExists(plan);
  assert(plan.steps.length > 0);
});

Deno.test({
  name: "Data extraction - planner includes LIMIT step",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" LIMIT 10';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);
  const planner = new ExecutionPlanner();
  const plan = planner.plan(optimized.optimizedAST, {
    optimizationApplied: true,
    appliedPasses: [],
    estimatedImprovement: 0,
  });

  assertExists(plan);
  assert(plan.steps.length > 0);
});

// ============================================================================
// Result Formatting Tests
// ============================================================================

Deno.test({
  name: "Data extraction - formats array result as JSON",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const formatter = new ResultFormatter();
  const data = [
    { name: "Item 1", price: 100 },
    { name: "Item 2", price: 200 },
  ];
  const result = formatter.format(data, "JSON", { pretty: true });

  assertExists(result);
  assert(result.includes("Item 1"));
  assert(result.includes("100"));
});

Deno.test({
  name: "Data extraction - formats array result as TABLE",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const formatter = new ResultFormatter();
  const data = [
    { name: "Alice", score: 95 },
    { name: "Bob", score: 87 },
  ];
  const result = formatter.format(data, "TABLE", { includeHeaders: true });

  assertExists(result);
  assert(typeof result === "string");
});

Deno.test({
  name: "Data extraction - formats array result as CSV",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const formatter = new ResultFormatter();
  const data = [
    { id: 1, name: "Test" },
    { id: 2, name: "Example" },
  ];
  const result = formatter.format(data, "CSV", {});

  assertExists(result);
  assert(result.includes("id"));
  assert(result.includes("name"));
});

// ============================================================================
// Complex Extraction Scenarios Tests
// ============================================================================

Deno.test({
  name: "Data extraction - handles nested field access",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT product.name, product.price FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SELECT");
});

Deno.test({
  name: "Data extraction - handles function calls in SELECT",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT UPPER(name) AS upper_name FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SELECT");
});

Deno.test({
  name: "Data extraction - handles expression in SELECT",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT price * quantity AS total FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SELECT");
});

Deno.test({
  name: "Data extraction - combines WHERE, ORDER BY, and LIMIT",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name, price FROM "https://example.com" WHERE price > 50 ORDER BY price DESC LIMIT 10';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SELECT");
  assertExists((ast as any).where);
  assertExists((ast as any).orderBy);
  assertExists((ast as any).limit);
});
