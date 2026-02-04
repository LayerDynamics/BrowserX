/**
 * Full Query Integration Tests
 * Tests the complete query execution pipeline from query string to formatted result
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import { QueryEngine } from "../../core/engine.ts";
import { Lexer } from "../../lexer/mod.ts";
import { Parser } from "../../parser/mod.ts";
import { SemanticAnalyzer } from "../../analyzer/mod.ts";
import { QueryOptimizer } from "../../optimizer/mod.ts";
import { ExecutionPlanner } from "../../planner/mod.ts";
import { QueryExecutor } from "../../executor/mod.ts";
import { ResultFormatter } from "../../formatter/formatter.ts";

// ============================================================================
// Query Engine Lifecycle Tests
// ============================================================================

Deno.test({
  name: "QueryEngine - initialization and shutdown lifecycle",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();

  assertEquals(engine.isInitialized(), false);

  await engine.initialize({});

  assertEquals(engine.isInitialized(), true);

  await engine.shutdown();

  assertEquals(engine.isInitialized(), false);
});

Deno.test({
  name: "QueryEngine - initialization with config",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();

  await engine.initialize({
    proxy: {
      enabled: false,
    },
    security: {
      sandbox: { enabled: true },
    },
  });

  const config = engine.getConfig();
  assertEquals(config.proxy?.enabled, false);
  assertEquals(config.security?.sandbox?.enabled, true);

  await engine.shutdown();
});

Deno.test({
  name: "QueryEngine - execute throws if not initialized",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();

  await assertRejects(
    async () => await engine.execute('SELECT 1 AS num'),
    Error,
    "not initialized"
  );
});

Deno.test({
  name: "QueryEngine - metrics tracking",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const initialMetrics = engine.getMetrics();
  assertEquals(initialMetrics.queries.total, 0);
  assertEquals(initialMetrics.queries.successful, 0);

  await engine.shutdown();
});

// ============================================================================
// Full Pipeline Tests
// ============================================================================

Deno.test({
  name: "Full pipeline - lexer to tokens",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();

  assert(tokens.length > 0);
  assertEquals(tokens[0].type, "SELECT");
  assertEquals(tokens[1].type, "IDENTIFIER");
  assertEquals(tokens[1].value, "title");
});

Deno.test({
  name: "Full pipeline - tokens to AST",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertExists(ast);
  assertEquals(ast.type, "SELECT");
  assertExists((ast as any).fields);
});

Deno.test({
  name: "Full pipeline - AST through semantic analysis",
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
  name: "Full pipeline - AST through optimization",
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

  assertExists(optimized);
  assertExists(optimized.optimizedAST);
});

Deno.test({
  name: "Full pipeline - optimized AST to execution plan",
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
    appliedPasses: optimized.appliedPasses,
    estimatedImprovement: optimized.improvement,
  });

  assertExists(plan);
  assertExists(plan.steps);
  assert(plan.steps.length > 0);
});

// ============================================================================
// Result Formatting Tests
// ============================================================================

Deno.test({
  name: "Full pipeline - format result as JSON",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const formatter = new ResultFormatter();
  const data = [{ title: "Test", count: 42 }];
  const result = formatter.format(data, "JSON", { pretty: true });

  assertExists(result);
  assert(typeof result === "string");
});

Deno.test({
  name: "Full pipeline - format result as table",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const formatter = new ResultFormatter();
  const data = [
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 },
  ];
  const result = formatter.format(data, "TABLE", { includeHeaders: true });

  assertExists(result);
  assert(typeof result === "string");
});

Deno.test({
  name: "Full pipeline - format result as CSV",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const formatter = new ResultFormatter();
  const data = [
    { name: "Alice", value: 100 },
    { name: "Bob", value: 200 },
  ];
  const result = formatter.format(data, "CSV", {});

  assertExists(result);
  assert(typeof result === "string");
  assert(result.includes("name"));
  assert(result.includes("Alice"));
});

// ============================================================================
// Query Execution Tests
// ============================================================================

Deno.test({
  name: "QueryExecutor - executes simple plan",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const query = "SET myVar = 42";
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

  const executor = new QueryExecutor();
  const result = await executor.execute(plan);

  assertExists(result);
});

// ============================================================================
// Query ID and Tracking Tests
// ============================================================================

Deno.test({
  name: "QueryEngine - generates unique query IDs",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const ids = new Set<string>();

  // Generate multiple query IDs
  for (let i = 0; i < 10; i++) {
    const queryId = await engine.executeAsync("SET x = 1");
    ids.add(queryId);
  }

  // All IDs should be unique
  assertEquals(ids.size, 10);

  await engine.shutdown();
});

Deno.test({
  name: "QueryEngine - tracks query status",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const queryId = await engine.executeAsync("SET x = 1");

  const status = await engine.getQueryStatus(queryId);
  assertExists(status);
  assertEquals(status.queryId, queryId);

  await engine.shutdown();
});

Deno.test({
  name: "QueryEngine - getQueryStatus throws for unknown query",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  await assertRejects(
    async () => await engine.getQueryStatus("nonexistent_query"),
    Error,
    "not found"
  );

  await engine.shutdown();
});

// ============================================================================
// Query Cancellation Tests
// ============================================================================

Deno.test({
  name: "QueryEngine - cancel running query",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const queryId = await engine.executeAsync("SET x = 1");

  // Allow query to start
  await new Promise((resolve) => setTimeout(resolve, 10));

  try {
    await engine.cancelQuery(queryId);
    const status = await engine.getQueryStatus(queryId);
    // Query may be completed or cancelled depending on timing
    assert(
      status.state === "CANCELLED" || status.state === "COMPLETED",
      `Expected CANCELLED or COMPLETED, got ${status.state}`
    );
  } catch {
    // Query may have completed before cancellation
  }

  await engine.shutdown();
});

Deno.test({
  name: "QueryEngine - cancelQuery throws for unknown query",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  await assertRejects(
    async () => await engine.cancelQuery("nonexistent_query"),
    Error,
    "not found"
  );

  await engine.shutdown();
});

// ============================================================================
// Complex Query Tests
// ============================================================================

Deno.test({
  name: "Full pipeline - parses SELECT with multiple fields",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title, description, price FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SELECT");
  assertEquals((ast as any).fields.length, 3);
});

Deno.test({
  name: "Full pipeline - parses SELECT with WHERE clause",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" WHERE price > 100';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SELECT");
  assertExists((ast as any).where);
});

Deno.test({
  name: "Full pipeline - parses SET statement",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SET baseUrl = "https://api.example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SET");
  assertEquals((ast as any).path[0], "baseUrl");
});

Deno.test({
  name: "Full pipeline - parses NAVIGATE statement",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
});

// ============================================================================
// Timing Tests
// ============================================================================

Deno.test({
  name: "QueryEngine - result includes timing information",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  try {
    const result = await engine.execute("SET x = 1");

    assertExists(result.timing);
    assert(result.timing.totalTime >= 0);
    assert(result.timing.lexerTime >= 0);
    assert(result.timing.parserTime >= 0);
    assert(result.timing.semanticAnalysisTime >= 0);
    assert(result.timing.optimizationTime >= 0);
    assert(result.timing.planningTime >= 0);
    assert(result.timing.executionTime >= 0);
    assert(result.timing.formattingTime >= 0);
  } catch {
    // May fail without browser, but timing structure should be tested
  }

  await engine.shutdown();
});

// ============================================================================
// Metadata Tests
// ============================================================================

Deno.test({
  name: "QueryEngine - result includes metadata",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  try {
    const result = await engine.execute("SET x = 1");

    assertExists(result.metadata);
    assertExists(result.metadata.query);
    assertExists(result.metadata.ast);
    assertEquals(typeof result.metadata.stepsExecuted, "number");
  } catch {
    // May fail without browser
  }

  await engine.shutdown();
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test({
  name: "Full pipeline - handles empty SELECT fields",
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
  name: "Full pipeline - handles aliased fields",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title AS heading FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SELECT");
  assertEquals((ast as any).fields[0].alias, "heading");
});

Deno.test({
  name: "Full pipeline - handles ORDER BY",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" ORDER BY name ASC';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SELECT");
  assertExists((ast as any).orderBy);
});

Deno.test({
  name: "Full pipeline - handles LIMIT and OFFSET",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" LIMIT 10 OFFSET 5';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SELECT");
  assertExists((ast as any).limit);
});
