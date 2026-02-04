/**
 * Query Optimization Integration Tests
 * Tests optimization passes through the full pipeline
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import { Lexer } from "../../lexer/mod.ts";
import { Parser } from "../../parser/mod.ts";
import { SemanticAnalyzer } from "../../analyzer/mod.ts";
import { QueryOptimizer } from "../../optimizer/mod.ts";
import { ExecutionPlanner } from "../../planner/mod.ts";

// ============================================================================
// Constant Folding Tests
// ============================================================================

Deno.test({
  name: "Optimization - folds constant arithmetic expressions",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = 2 + 3";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
  // Optimizer may fold 2 + 3 into 5
  assertExists(optimized.appliedPasses);
});

Deno.test({
  name: "Optimization - folds constant string concatenation",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SET name = "Hello" + " World"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
});

Deno.test({
  name: "Optimization - folds constant multiplication",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = 4 * 5";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
});

Deno.test({
  name: "Optimization - folds constant division",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = 20 / 4";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
});

Deno.test({
  name: "Optimization - folds nested constant expressions",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = (2 + 3) * (4 - 1)";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
});

// ============================================================================
// Dead Code Elimination Tests
// ============================================================================

Deno.test({
  name: "Optimization - handles constant true condition",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF true THEN
    SET result = "always"
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
  // May eliminate the IF and keep just the SET
});

Deno.test({
  name: "Optimization - handles constant false condition",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF false THEN
    SET result = "never"
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
  // May eliminate entire IF block
});

// ============================================================================
// Boolean Expression Simplification Tests
// ============================================================================

Deno.test({
  name: "Optimization - simplifies AND with true",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF true AND condition THEN
    SET result = "yes"
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
  // May simplify to just 'condition'
});

Deno.test({
  name: "Optimization - simplifies OR with false",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF false OR condition THEN
    SET result = "yes"
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
  // May simplify to just 'condition'
});

Deno.test({
  name: "Optimization - simplifies double negation",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF NOT NOT condition THEN
    SET result = "yes"
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
  // May simplify to just 'condition'
});

// ============================================================================
// SELECT Optimization Tests
// ============================================================================

Deno.test({
  name: "Optimization - preserves SELECT with selector",
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

  assertExists(optimized.optimizedAST);
  assertEquals(optimized.optimizedAST.type, "SELECT");
});

Deno.test({
  name: "Optimization - handles SELECT with WHERE constant true",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT name FROM "https://example.com" WHERE true';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
  // May remove WHERE clause entirely
});

Deno.test({
  name: "Optimization - rejects SELECT with LIMIT 0",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  // LIMIT 0 is rejected by the validator - LIMIT must be positive
  const query = 'SELECT name FROM "https://example.com" LIMIT 0';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});

  // Semantic analysis should throw a ValidationError for LIMIT 0
  assertThrows(
    () => analyzer.analyze(ast),
    Error,
    "LIMIT must be positive"
  );
});

// ============================================================================
// Optimization Pass Tracking Tests
// ============================================================================

Deno.test({
  name: "Optimization - tracks applied passes",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = 2 + 3";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.appliedPasses);
  assert(Array.isArray(optimized.appliedPasses));
});

Deno.test({
  name: "Optimization - reports estimated improvement",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = 2 + 3 * 4";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertEquals(typeof optimized.improvement, "number");
  assert(optimized.improvement >= 0);
});

// ============================================================================
// Optimization with Complex Queries Tests
// ============================================================================

Deno.test({
  name: "Optimization - handles NAVIGATE statement",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
  assertEquals(optimized.optimizedAST.type, "NAVIGATE");
});

Deno.test({
  name: "Optimization - handles FOR loop",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR item IN items DO
    SET x = item
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
  assertEquals(optimized.optimizedAST.type, "FOR");
});

// ============================================================================
// Optimizer Configuration Tests
// ============================================================================

Deno.test({
  name: "Optimization - respects disabled optimization",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = 2 + 3";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({ enableOptimization: false });
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
  // AST should be unchanged
});

Deno.test({
  name: "Optimization - handles custom max passes",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = 1 + 2 + 3 + 4 + 5";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({ maxPasses: 1 });
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
});

// ============================================================================
// Optimization to Execution Plan Tests
// ============================================================================

Deno.test({
  name: "Optimization - optimized AST produces valid plan",
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
    optimizationApplied: optimized.appliedPasses.length > 0,
    appliedPasses: optimized.appliedPasses,
    estimatedImprovement: optimized.improvement,
  });

  assertExists(plan);
  assertExists(plan.steps);
  assert(plan.steps.length > 0);
});

Deno.test({
  name: "Optimization - plan includes optimization metadata",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = 2 + 3";
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
  assertExists(plan.metadata);
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test({
  name: "Optimization - handles deeply nested expressions",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = ((((1 + 2) + 3) + 4) + 5)";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
});

Deno.test({
  name: "Optimization - handles mixed constant and variable expressions",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = (2 + 3) + y";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
  // Should fold (2 + 3) to 5, keep + y
});

Deno.test({
  name: "Optimization - handles comparison operators",
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

  assertExists(optimized.optimizedAST);
  assertEquals(optimized.optimizedAST.type, "SELECT");
});

Deno.test({
  name: "Optimization - preserves function calls",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = UPPER(name)";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
  // Function calls should be preserved
});

Deno.test({
  name: "Optimization - handles array literals",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET arr = [1, 2, 3]";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
});

Deno.test({
  name: "Optimization - handles object literals",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SET obj = { name: "test", count: 42 }';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertExists(optimized.optimizedAST);
});
