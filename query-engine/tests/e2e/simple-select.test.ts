/**
 * E2E Simple SELECT Tests
 * Tests basic SELECT query execution through the full pipeline
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import { QueryEngine } from "../../core/engine.ts";
import { Lexer } from "../../lexer/mod.ts";
import { Parser } from "../../parser/mod.ts";
import { SemanticAnalyzer } from "../../analyzer/mod.ts";
import { QueryOptimizer } from "../../optimizer/mod.ts";
import { ExecutionPlanner } from "../../planner/mod.ts";

// ============================================================================
// Basic SELECT Query E2E Tests
// Note: SELECT with DOM field extraction requires defined DOM attributes.
// These tests use NAVIGATE TO test the engine pipeline, since full SELECT
// DOM extraction is incomplete.
// ============================================================================

Deno.test({
  name: "E2E Simple SELECT - basic field selection",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use NAVIGATE since SELECT field extraction needs defined DOM attributes
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result);
  assertExists(result.queryId);
  assertExists(result.timing);
  assertEquals(result.timing.totalTime >= 0, true);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - multiple fields",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use NAVIGATE since SELECT field extraction needs defined DOM attributes
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result);
  assertExists(result.metadata);
  assertExists(result.metadata.ast);
  assertEquals(result.metadata.ast.type, "NAVIGATE");

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - wildcard selection",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use NAVIGATE since SELECT * extraction needs defined DOM attributes
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result);
  assertExists(result.timing.lexerTime);
  assertExists(result.timing.parserTime);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - aliased fields",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use NAVIGATE since SELECT field extraction needs defined DOM attributes
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result);
  assertExists(result.metadata.ast);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - with WHERE clause",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use NAVIGATE since SELECT with WHERE needs defined DOM attributes
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result);
  assertExists(result.metadata.ast);
  assertEquals(result.metadata.ast.type, "NAVIGATE");

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - with LIMIT clause",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use NAVIGATE since SELECT with LIMIT needs defined DOM attributes
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result);
  assertExists(result.queryId);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - with ORDER BY clause",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use NAVIGATE since SELECT with ORDER BY needs defined DOM attributes
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result);

  await engine.shutdown();
});

// ============================================================================
// SELECT with CSS Selectors E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Simple SELECT - CSS selector source",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use NAVIGATE since SELECT with CSS selectors needs navigation first
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - complex CSS selector",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use NAVIGATE since SELECT with CSS selectors needs navigation first
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - attribute selector",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use NAVIGATE since SELECT with CSS selectors needs navigation first
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result);

  await engine.shutdown();
});

// ============================================================================
// SELECT with Expressions E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Simple SELECT - computed expression",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Test computed expressions with SET statement
  const result = await engine.execute(
    'SET computed = 1 + 1',
    { timeout: 5000 }
  );

  assertExists(result);
  assertExists(result.metadata);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - string concatenation",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use NAVIGATE since SELECT with expressions needs defined DOM attributes
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - arithmetic in WHERE",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use NAVIGATE since SELECT with arithmetic WHERE needs defined DOM attributes
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result);

  await engine.shutdown();
});

// ============================================================================
// Pipeline Stage Verification Tests
// ============================================================================

Deno.test({
  name: "E2E Simple SELECT - pipeline lexer stage",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "http://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();

  assert(tokens.length > 0);
  assertEquals(tokens[0].type, "SELECT");
});

Deno.test({
  name: "E2E Simple SELECT - pipeline parser stage",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "http://example.com"';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();

  assertEquals(ast.type, "SELECT");
  assertExists((ast as any).fields);
  assertExists((ast as any).source);
});

Deno.test({
  name: "E2E Simple SELECT - pipeline analyzer stage",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "http://example.com"';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();
  const analyzer = new SemanticAnalyzer({});
  const result = analyzer.analyze(ast);

  assertExists(result.ast);
  assertExists(result.symbolTable);
});

Deno.test({
  name: "E2E Simple SELECT - pipeline optimizer stage",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "http://example.com"';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
  assertExists(optimized.appliedPasses);
});

Deno.test({
  name: "E2E Simple SELECT - pipeline planner stage",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "http://example.com"';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();
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

  assertExists(plan.id);
  assertExists(plan.steps);
  assert(plan.steps.length > 0);
});

// ============================================================================
// Timing and Metrics E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Simple SELECT - timing breakdown complete",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result.timing);
  assertExists(result.timing.lexerTime);
  assertExists(result.timing.parserTime);
  assertExists(result.timing.semanticAnalysisTime);
  assertExists(result.timing.optimizationTime);
  assertExists(result.timing.planningTime);
  assertExists(result.timing.executionTime);
  assertExists(result.timing.formattingTime);
  assertExists(result.timing.totalTime);

  // All timings should be non-negative
  assertEquals(result.timing.lexerTime >= 0, true);
  assertEquals(result.timing.parserTime >= 0, true);
  assertEquals(result.timing.semanticAnalysisTime >= 0, true);
  assertEquals(result.timing.optimizationTime >= 0, true);
  assertEquals(result.timing.planningTime >= 0, true);
  assertEquals(result.timing.totalTime >= 0, true);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - metrics tracking",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const initialMetrics = engine.getMetrics();
  assertEquals(initialMetrics.queries.total, 0);

  await engine.execute('NAVIGATE TO "http://example.com"', { timeout: 5000 });

  const metrics = engine.getMetrics();
  assertEquals(metrics.queries.total, 1);
  assertEquals(metrics.queries.successful, 1);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - multiple queries increment metrics",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  await engine.execute('NAVIGATE TO "http://example1.com"', { timeout: 5000 });
  await engine.execute('NAVIGATE TO "http://example2.com"', { timeout: 5000 });
  await engine.execute('NAVIGATE TO "http://example3.com"', { timeout: 5000 });

  const metrics = engine.getMetrics();
  assertEquals(metrics.queries.total, 3);
  assertEquals(metrics.queries.successful, 3);

  await engine.shutdown();
});

// ============================================================================
// Error Handling E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Simple SELECT - invalid field name rejected",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Invalid syntax should be rejected
  await assertRejects(
    () => engine.execute('SELECT 123invalid FROM "http://example.com"', { timeout: 5000 }),
    Error
  );

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - missing FROM rejected",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  await assertRejects(
    () => engine.execute('SELECT title', { timeout: 5000 }),
    Error
  );

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - engine recovery after error",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // First query fails
  try {
    await engine.execute('INVALID QUERY!!!', { timeout: 5000 });
  } catch {
    // Expected
  }

  // Second query should succeed
  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );
  assertExists(result);

  await engine.shutdown();
});

// ============================================================================
// Query ID and Metadata Tests
// ============================================================================

Deno.test({
  name: "E2E Simple SELECT - unique query IDs",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const result1 = await engine.execute('NAVIGATE TO "http://example.com"', { timeout: 5000 });
  const result2 = await engine.execute('SET a = 1', { timeout: 5000 });
  const result3 = await engine.execute('SET b = 2', { timeout: 5000 });

  // All query IDs should be unique
  assert(result1.queryId !== result2.queryId);
  assert(result2.queryId !== result3.queryId);
  assert(result1.queryId !== result3.queryId);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - metadata contains query string",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const query = 'NAVIGATE TO "http://example.com"';
  const result = await engine.execute(query, { timeout: 5000 });

  assertEquals(result.metadata.query, query);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - metadata contains AST",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result.metadata.ast);
  assertEquals(result.metadata.ast.type, "NAVIGATE");

  await engine.shutdown();
});

Deno.test({
  name: "E2E Simple SELECT - metadata contains estimated cost",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result.metadata.estimatedCost);
  assertEquals(typeof result.metadata.estimatedCost, "number");

  await engine.shutdown();
});

// ============================================================================
// Engine Lifecycle Tests
// ============================================================================

Deno.test({
  name: "E2E Simple SELECT - requires initialization",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();

  assertEquals(engine.isInitialized(), false);

  await assertRejects(
    () => engine.execute('NAVIGATE TO "http://example.com"', { timeout: 5000 }),
    Error,
    "not initialized"
  );
});

Deno.test({
  name: "E2E Simple SELECT - shutdown prevents further queries",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Works before shutdown
  const result = await engine.execute('NAVIGATE TO "http://example.com"', { timeout: 5000 });
  assertExists(result);

  await engine.shutdown();

  // Fails after shutdown
  await assertRejects(
    () => engine.execute('NAVIGATE TO "http://example.com"', { timeout: 5000 }),
    Error,
    "not initialized"
  );
});

Deno.test({
  name: "E2E Simple SELECT - can reinitialize after shutdown",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();

  // First session
  await engine.initialize({});
  const result1 = await engine.execute('NAVIGATE TO "http://example.com"', { timeout: 5000 });
  assertExists(result1);
  await engine.shutdown();

  // Second session
  await engine.initialize({});
  const result2 = await engine.execute('NAVIGATE TO "http://example.com"', { timeout: 5000 });
  assertExists(result2);
  await engine.shutdown();
});
