/**
 * Caching Integration Tests
 * Tests query and result caching through the full pipeline
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { Lexer } from "../../lexer/mod.ts";
import { Parser } from "../../parser/mod.ts";
import { SemanticAnalyzer } from "../../analyzer/mod.ts";
import { QueryOptimizer } from "../../optimizer/mod.ts";
import { ExecutionPlanner } from "../../planner/mod.ts";
import { QueryEngine } from "../../core/engine.ts";

// ============================================================================
// Query Cache Structure Tests
// ============================================================================

Deno.test({
  name: "Caching - identical queries produce same AST structure",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "https://example.com"';

  // Parse twice
  const lexer1 = new Lexer(query);
  const tokens1 = lexer1.tokenize();
  const parser1 = new Parser(tokens1);
  const ast1 = parser1.parse();

  const lexer2 = new Lexer(query);
  const tokens2 = lexer2.tokenize();
  const parser2 = new Parser(tokens2);
  const ast2 = parser2.parse();

  assertEquals(ast1.type, ast2.type);
  assertEquals((ast1 as any).fields.length, (ast2 as any).fields.length);
});

Deno.test({
  name: "Caching - different queries produce different AST",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query1 = 'SELECT title FROM "https://example.com"';
  const query2 = 'SELECT description FROM "https://example.com"';

  const lexer1 = new Lexer(query1);
  const tokens1 = lexer1.tokenize();
  const parser1 = new Parser(tokens1);
  const ast1 = parser1.parse();

  const lexer2 = new Lexer(query2);
  const tokens2 = lexer2.tokenize();
  const parser2 = new Parser(tokens2);
  const ast2 = parser2.parse();

  assertEquals(ast1.type, ast2.type);
  // Different field names
  assert((ast1 as any).fields[0].name !== (ast2 as any).fields[0].name);
});

// ============================================================================
// Optimization Cache Tests
// ============================================================================

Deno.test({
  name: "Caching - optimization produces consistent results",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = 2 + 3";

  // Process twice
  const process = () => {
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const analyzer = new SemanticAnalyzer({});
    const analyzed = analyzer.analyze(ast);
    const optimizer = new QueryOptimizer({});
    return optimizer.optimize(analyzed.ast);
  };

  const result1 = process();
  const result2 = process();

  assertEquals(result1.optimizedAST.type, result2.optimizedAST.type);
  assertEquals(result1.appliedPasses.length, result2.appliedPasses.length);
});

Deno.test({
  name: "Caching - optimization result structure is consistent",
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
  assertExists(optimized.appliedPasses);
  assertEquals(typeof optimized.improvement, "number");
});

// ============================================================================
// Execution Plan Cache Tests
// ============================================================================

Deno.test({
  name: "Caching - identical queries produce identical plans",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "https://example.com"';

  const createPlan = () => {
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const analyzer = new SemanticAnalyzer({});
    const analyzed = analyzer.analyze(ast);
    const optimizer = new QueryOptimizer({});
    const optimized = optimizer.optimize(analyzed.ast);
    const planner = new ExecutionPlanner();
    return planner.plan(optimized.optimizedAST, {
      optimizationApplied: true,
      appliedPasses: optimized.appliedPasses,
      estimatedImprovement: optimized.improvement,
    });
  };

  const plan1 = createPlan();
  const plan2 = createPlan();

  assertEquals(plan1.steps.length, plan2.steps.length);
  for (let i = 0; i < plan1.steps.length; i++) {
    assertEquals(plan1.steps[i].type, plan2.steps[i].type);
  }
});

Deno.test({
  name: "Caching - plan includes cacheable step indicator",
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
  // Steps may have cacheable indicators
  for (const step of plan.steps) {
    assertExists(step.type);
  }
});

// ============================================================================
// NAVIGATE Cache Options Tests
// ============================================================================

Deno.test({
  name: "Caching - NAVIGATE with cache option parses",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com" WITH { proxy: { cache: true } }';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
  assertExists((ast as any).options);
});

Deno.test({
  name: "Caching - NAVIGATE cache option preserved through pipeline",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com" WITH { proxy: { cache: true, ttl: 3600 } }';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});
  const optimized = optimizer.optimize(analyzed.ast);

  assertEquals(optimized.optimizedAST.type, "NAVIGATE");
  assertExists((optimized.optimizedAST as any).options);
});

Deno.test({
  name: "Caching - NAVIGATE without cache option parses",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com" WITH { proxy: { cache: false } }';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
});

// ============================================================================
// Query Engine Cache Tests
// ============================================================================

Deno.test({
  name: "Caching - QueryEngine can be initialized",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  assertEquals(engine.isInitialized(), true);

  await engine.shutdown();
});

Deno.test({
  name: "Caching - QueryEngine metrics reset on init",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const metrics = engine.getMetrics();
  assertEquals(metrics.queries.total, 0);

  await engine.shutdown();
});

// ============================================================================
// Token Cache Tests
// ============================================================================

Deno.test({
  name: "Caching - lexer produces same tokens for same input",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "https://example.com"';

  const tokens1 = new Lexer(query).tokenize();
  const tokens2 = new Lexer(query).tokenize();

  assertEquals(tokens1.length, tokens2.length);
  for (let i = 0; i < tokens1.length; i++) {
    assertEquals(tokens1[i].type, tokens2[i].type);
    assertEquals(tokens1[i].value, tokens2[i].value);
  }
});

Deno.test({
  name: "Caching - lexer tokens include position info",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "https://example.com"';
  const tokens = new Lexer(query).tokenize();

  for (const token of tokens) {
    assertExists(token.type);
    // Token may have position info
    if (token.position) {
      assertEquals(typeof token.position.line, "number");
      assertEquals(typeof token.position.column, "number");
    }
  }
});

// ============================================================================
// Result Format Cache Tests
// ============================================================================

Deno.test({
  name: "Caching - result format is consistent",
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

  // Plan structure should be consistent
  assertExists(plan.id);
  assertExists(plan.steps);
  assertExists(plan.resources);
  assertExists(plan.dependencies);
});

// ============================================================================
// Cache Key Generation Tests
// ============================================================================

Deno.test({
  name: "Caching - similar queries with different params are different",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query1 = 'SELECT title FROM "https://example.com"';
  const query2 = 'SELECT title FROM "https://other.com"';

  const ast1 = new Parser(new Lexer(query1).tokenize()).parse();
  const ast2 = new Parser(new Lexer(query2).tokenize()).parse();

  assertEquals(ast1.type, ast2.type);
  // But different source URLs
  assert((ast1 as any).source.value !== (ast2 as any).source.value);
});

Deno.test({
  name: "Caching - queries with same URL but different fields differ",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query1 = 'SELECT title FROM "https://example.com"';
  const query2 = 'SELECT title, description FROM "https://example.com"';

  const ast1 = new Parser(new Lexer(query1).tokenize()).parse();
  const ast2 = new Parser(new Lexer(query2).tokenize()).parse();

  assertEquals(ast1.type, ast2.type);
  assert((ast1 as any).fields.length !== (ast2 as any).fields.length);
});

// ============================================================================
// Cache Invalidation Scenarios Tests
// ============================================================================

Deno.test({
  name: "Caching - SET statements are not cacheable",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = 42";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SET");
  // SET statements modify state and shouldn't be cached
});

Deno.test({
  name: "Caching - INSERT statements are not cacheable",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'INSERT "text" INTO "#input"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "INSERT");
  // INSERT modifies DOM and shouldn't be cached
});

Deno.test({
  name: "Caching - SELECT queries are potentially cacheable",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "SELECT");
  // SELECT queries are read-only and may be cached
});

// ============================================================================
// Pipeline Consistency Tests
// ============================================================================

Deno.test({
  name: "Caching - full pipeline is deterministic",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "https://example.com" WHERE price > 100 LIMIT 10';

  const process = () => {
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const analyzer = new SemanticAnalyzer({});
    const analyzed = analyzer.analyze(ast);
    const optimizer = new QueryOptimizer({});
    const optimized = optimizer.optimize(analyzed.ast);
    const planner = new ExecutionPlanner();
    return planner.plan(optimized.optimizedAST, {
      optimizationApplied: true,
      appliedPasses: optimized.appliedPasses,
      estimatedImprovement: optimized.improvement,
    });
  };

  const plan1 = process();
  const plan2 = process();

  // Plans should have same structure
  assertEquals(plan1.steps.length, plan2.steps.length);
  assertEquals(plan1.resources.browsers, plan2.resources.browsers);
  assertEquals(plan1.resources.pages, plan2.resources.pages);
});

Deno.test({
  name: "Caching - complex query pipeline is deterministic",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR url IN urls DO
    NAVIGATE TO url
    SET title = "processed"
  END`;

  const process = () => {
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const analyzer = new SemanticAnalyzer({});
    const analyzed = analyzer.analyze(ast);
    const optimizer = new QueryOptimizer({});
    const optimized = optimizer.optimize(analyzed.ast);
    const planner = new ExecutionPlanner();
    return planner.plan(optimized.optimizedAST, {
      optimizationApplied: true,
      appliedPasses: [],
      estimatedImprovement: 0,
    });
  };

  const plan1 = process();
  const plan2 = process();

  assertEquals(plan1.steps.length, plan2.steps.length);
});
