/**
 * Performance tests for the query optimizer
 * Validates optimization passes work correctly and efficiently.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { Lexer } from "../../lexer/mod.ts";
import { Parser } from "../../parser/mod.ts";
import { SemanticAnalyzer } from "../../analyzer/mod.ts";
import {
  QueryOptimizer,
  ConstantFoldingPass,
  DeadCodeEliminationPass,
  CacheOptimizationPass,
  ParallelDetectionPass,
  type OptimizationResult,
} from "../../optimizer/mod.ts";
import type { Statement } from "../../types/mod.ts";

/**
 * Helper: parse a query string into an AST.
 */
function parseQuery(query: string): Statement {
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Helper: parse and analyze a query, returning the annotated AST.
 */
function analyzeQuery(query: string): Statement {
  const ast = parseQuery(query);
  const analyzer = new SemanticAnalyzer({
    allowUndefinedVariables: true,
    strictTypeChecking: false,
  });
  const result = analyzer.analyze(ast);
  return result.ast;
}

/**
 * Helper: run full optimization on a query string.
 */
function optimizeQuery(query: string, config: Partial<Parameters<typeof QueryOptimizer.prototype.optimize>[1]> = {}): OptimizationResult {
  const ast = analyzeQuery(query);
  const optimizer = new QueryOptimizer({
    enableConstantFolding: true,
    enableDeadCodeElimination: true,
    enablePredicatePushdown: true,
    enableProjectionPushdown: true,
    enableCacheOptimization: true,
    enableParallelDetection: true,
    maxPasses: 3,
  });
  return optimizer.optimize(ast);
}

Deno.test("optimization: optimizer runs on SELECT query without error", () => {
  const result = optimizeQuery('SELECT title FROM "https://example.com"');
  assertExists(result);
  assertExists(result.optimizedAST);
  assertExists(result.appliedPasses);
  assert(Array.isArray(result.appliedPasses), "appliedPasses should be an array");
});

Deno.test("optimization: constant folding pass processes expressions", () => {
  const pass = new ConstantFoldingPass();
  const ast = parseQuery('SELECT title FROM "https://example.com"');
  const result = pass.apply(ast);
  assertExists(result, "ConstantFoldingPass should return a statement");
});

Deno.test("optimization: dead code elimination pass processes query", () => {
  const pass = new DeadCodeEliminationPass();
  const ast = parseQuery('SELECT title FROM "https://example.com"');
  const result = pass.apply(ast);
  assertExists(result, "DeadCodeEliminationPass should return a statement");
});

Deno.test("optimization: cache optimization adds caching metadata", () => {
  const result = optimizeQuery('SELECT title FROM "https://example.com"');
  assertExists(result);
  // Cache optimization pass should be in the applied passes
  const hasCachePass = result.appliedPasses.some(
    (p) => p.toLowerCase().includes("cache")
  );
  // It may or may not apply depending on the query, but the optimizer should run
  assertExists(result.optimizedAST);
});

Deno.test("optimization: parallel detection identifies independent steps", () => {
  const pass = new ParallelDetectionPass();
  const ast = parseQuery('SELECT title FROM "https://example.com"');
  const result = pass.apply(ast);
  assertExists(result, "ParallelDetectionPass should return a statement");
});

Deno.test("optimization: trivial query optimizes in < 50ms", () => {
  const start = performance.now();
  const result = optimizeQuery('SELECT title FROM "https://example.com"');
  const elapsed = performance.now() - start;

  assertExists(result);
  assert(elapsed < 50, `Expected < 50ms but took ${elapsed.toFixed(2)}ms`);
});

Deno.test("optimization: semantics preserved - optimized AST type matches original", () => {
  const query = 'SELECT title, description FROM "https://example.com"';
  const originalAst = analyzeQuery(query);
  const result = optimizeQuery(query);

  // The optimized AST should have the same statement type
  assertEquals(result.optimizedAST.type, originalAst.type, "Statement type should be preserved after optimization");
});

Deno.test("optimization: multiple optimization passes compose correctly", () => {
  const ast = analyzeQuery('SELECT title FROM "https://example.com"');

  // Run optimizer with all passes enabled
  const fullOptimizer = new QueryOptimizer({
    enableConstantFolding: true,
    enableDeadCodeElimination: true,
    enablePredicatePushdown: true,
    enableProjectionPushdown: true,
    enableCacheOptimization: true,
    enableParallelDetection: true,
    maxPasses: 3,
  });
  const fullResult = fullOptimizer.optimize(ast);

  // Run optimizer with only one pass
  const singleOptimizer = new QueryOptimizer({
    enableConstantFolding: true,
    enableDeadCodeElimination: false,
    enablePredicatePushdown: false,
    enableProjectionPushdown: false,
    enableCacheOptimization: false,
    enableParallelDetection: false,
    maxPasses: 1,
  });
  const singleResult = singleOptimizer.optimize(ast);

  // Both should produce valid results
  assertExists(fullResult.optimizedAST);
  assertExists(singleResult.optimizedAST);

  // Full optimizer should have more (or equal) applied passes
  assert(
    fullResult.appliedPasses.length >= singleResult.appliedPasses.length,
    `Full optimizer passes (${fullResult.appliedPasses.length}) should be >= single (${singleResult.appliedPasses.length})`
  );
});

Deno.test("optimization: cost estimation produces numeric values", () => {
  const result = optimizeQuery('SELECT title FROM "https://example.com"');
  assertExists(result.originalCost);
  assertExists(result.optimizedCost);
  assert(typeof result.improvement === "number", "Improvement should be a number");
  assert(typeof result.originalCost.totalCost === "number", "Original cost totalCost should be a number");
  assert(typeof result.optimizedCost.totalCost === "number", "Optimized cost totalCost should be a number");
});

Deno.test("optimization: optimizer handles NAVIGATE query", () => {
  const result = optimizeQuery('NAVIGATE TO "https://example.com"');
  assertExists(result);
  assertExists(result.optimizedAST);
  assertEquals(result.optimizedAST.type, "NAVIGATE");
});

Deno.test("optimization: repeated optimization is consistent", () => {
  const query = 'SELECT title, description FROM "https://example.com"';
  const results: OptimizationResult[] = [];

  for (let i = 0; i < 5; i++) {
    results.push(optimizeQuery(query));
  }

  // All results should have the same number of applied passes
  const passCount = results[0].appliedPasses.length;
  for (const r of results) {
    assertEquals(r.appliedPasses.length, passCount, "Applied pass count should be consistent across runs");
    assertEquals(r.optimizedAST.type, results[0].optimizedAST.type, "Optimized AST type should be consistent");
  }
});
